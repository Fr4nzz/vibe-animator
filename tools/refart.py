#!/usr/bin/env python3
"""refart: find, clean and trace reference art, so anatomy on screen is a real plate and never a procedural guess.

  tools/refart find "kidney section" [--limit 15] [--sources commons,bioicons,servier] [--download 1,3]
                [--dest references/raw]
      Ranked table of Wikimedia Commons files (public domain, CC0, CC BY, CC BY-SA only; licence and author from the
      file page), Bioicons SVGs (licence from the repository folder) and Servier Medical Art images (CC BY 4.0).
      --download N[,M] saves the originals into --dest and appends a row per file to <dest>/SOURCES.md.
      CC BY-SA is marked "SA": allowed in an episode only under share-alike terms, never in engine/app/public/refs.
  tools/refart clean IMAGE [-o OUT.png] [--region x,y,w,h …] [--keep x,y,w,h …] [--mask extra.png]
                [--method telea|ns|fsr] [--min-conf 55] [--no-ocr] [--no-heuristic] [--no-leaders]
      Finds printed label text (tesseract at several rotations, plus small bold components on cleared paper) and
      the leader lines that start at it, masks only the dark glyph/line pixels, and inpaints them (OpenCV, else a
      diffusion fill). Never paints rectangles. --region adds a box to search for glyph pixels in (the box itself is
      not filled); --keep protects a box. Writes OUT (default <stem>_clean.png), <stem>_clean_mask.png and a
      before/after preview <stem>_clean_preview.png (mask in red on the left).
  tools/refart trace IMAGE [-o OUT.png] [--mode xdog|adaptive] [--scale auto|2] [--sigma 0.6] [--k 1.6] [--p 6]
                [--eps 0.5] [--phi 6] [--block 31] [--c 9] [--levels 0.05,0.95] [--despeckle 4] [--vector]
      Engraved line art: dark lines on white paper, the format rasterArt() loads (alpha = darkness). Writes OUT
      (default <stem>_trace.png), a sidecar <stem>_trace.json (size, params, the rasterArt call) and a preview
      <stem>_trace_preview.png (source | trace | as the engine draws it: bone on ink, ink on bone). With --vector and the potrace
      CLI installed, also <stem>_trace.svg and a refArt JSON (<stem>_trace_ref.json, via engine/tools/svgflat.py).

Downloads go through tools/fetch_ref.py (project User-Agent, polite spacing). Optional dependencies, each with a
fallback: opencv-python-headless (inpainting, components, leader lines; without it: diffusion fill, pure-Python
components, no leader lines), the tesseract CLI (OCR; without it: heuristics only), the potrace CLI (vector output).
If OpenCV is missing but tools/.venv exists, refart re-runs itself with tools/.venv/bin/python
(uv venv tools/.venv && uv pip install --python tools/.venv/bin/python opencv-python-headless numpy pillow).
"""
import hashlib, html, json, math, os, pathlib, re, shutil, subprocess, sys, tempfile, time, urllib.parse

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from fetch_ref import CACHE, FetchError, fetch  # noqa: E402

VENV_PY = HERE / ".venv" / "bin" / "python"


def _need_imaging():
    """numpy + PIL are required for clean/trace; cv2 is optional (re-exec into tools/.venv if it has it)."""
    try:
        import cv2  # noqa: F401
        return
    except ImportError:
        pass
    if VENV_PY.exists() and pathlib.Path(sys.executable).resolve() != VENV_PY.resolve() and not os.environ.get("REFART_NO_VENV"):
        os.execv(str(VENV_PY), [str(VENV_PY), __file__, *sys.argv[1:]])
    try:
        import numpy, PIL  # noqa: F401
    except ImportError:
        sys.exit("refart clean/trace need numpy and pillow (optional: opencv-python-headless); see the header")
    print("refart: OpenCV not found: diffusion inpainting, no leader-line detection", file=sys.stderr)


def opt(a, k, d=None):
    return a[a.index(k) + 1] if k in a else d


def opts(a, k):
    return [a[i + 1] for i, x in enumerate(a) if x == k and i + 1 < len(a)]


# ======================================================================= find
def cached_json(url, ttl_h=24):
    d = CACHE / "refart" / "http"
    d.mkdir(parents=True, exist_ok=True)
    f = d / (hashlib.sha256(url.encode()).hexdigest()[:20] + ".json")
    if f.exists() and time.time() - f.stat().st_mtime < ttl_h * 3600:
        return json.loads(f.read_text())
    data = json.loads(fetch(url))
    f.write_text(json.dumps(data))
    return data


def norm_license(s):
    s = (s or "").lower().replace("_", " ")
    if re.search(r"\bn[cd]\b|noncommercial|noderiv", s):
        return None
    if "public domain" in s or re.match(r"^pd\b|^pd-", s):
        return "Public domain"
    if "cc0" in s or "cc-0" in s:
        return "CC0 1.0"
    m = re.search(r"cc[- ]by[- ]sa(?:[- ]([\d.]+))?", s)
    if m:
        return "CC BY-SA " + (m.group(1) or "").strip()
    m = re.search(r"cc[- ]by(?:[- ]([\d.]+))?", s)
    if m:
        return "CC BY " + (m.group(1) or "").strip()
    return None


def strip_html(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s or ""))).strip()


def tokens(s):
    return [t for t in re.split(r"[^a-z0-9]+", s.lower()) if len(t) > 1]


def search_commons(q, n=30):
    p = {"action": "query", "format": "json", "generator": "search", "gsrsearch": q, "gsrnamespace": 6, "gsrlimit": n,
         "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata",
         "iiextmetadatafilter": "LicenseShortName|Artist|ImageDescription|ObjectName"}
    data = cached_json("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p))
    pages = sorted((data.get("query") or {}).get("pages", {}).values(), key=lambda x: x.get("index", 0))
    out, excluded = [], 0
    for i, pg in enumerate(pages):
        ii = (pg.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata") or {}
        lic = norm_license((md.get("LicenseShortName") or {}).get("value"))
        if not ii.get("mime", "").startswith("image/") or "djvu" in ii.get("mime", ""):
            continue  # PDFs, scans of whole books, video, audio
        if not lic or not ii.get("url"):
            excluded += 1
            continue
        title = pg["title"].split(":", 1)[1]
        desc = strip_html((md.get("ImageDescription") or {}).get("value"))[:300]
        out.append({"source": "commons", "title": title, "licence": lic,
                    "author": strip_html((md.get("Artist") or {}).get("value"))[:80] or "unknown",
                    "page": ii.get("descriptionurl"), "download": ii["url"].split("?")[0],
                    "size": f"{ii.get('width', 0)}x{ii.get('height', 0)}", "w": ii.get("width", 0), "h": ii.get("height", 0),
                    "name": title, "desc": desc, "prior": 0.4 * (1 - i / max(1, len(pages)))})
    return out, excluded


BIOICONS_LIC = {"cc-0": "CC0 1.0", "cc-by-3.0": "CC BY 3.0", "cc-by-4.0": "CC BY 4.0", "cc-by-sa-3.0": "CC BY-SA 3.0",
                "cc-by-sa-4.0": "CC BY-SA 4.0"}


def search_bioicons(q):
    tree = cached_json("https://api.github.com/repos/duerrsimon/bioicons/git/trees/main?recursive=1", ttl_h=24 * 7)
    out, excluded = [], 0
    qt = set(tokens(q))
    for e in tree.get("tree", []):
        p = e.get("path", "")
        if not (p.startswith("static/icons/") and p.endswith(".svg")):
            continue
        parts = p.split("/")
        if len(parts) < 6:
            continue
        lic_dir, cat, author, fn = parts[2], parts[3], parts[4], parts[-1]
        if not qt & set(tokens(fn + " " + cat)):
            continue
        lic = BIOICONS_LIC.get(lic_dir)
        if not lic:
            excluded += 1
            continue
        out.append({"source": "bioicons", "title": fn[:-4], "licence": lic, "author": author.replace("_", " ").replace("-", " ") + " (via Bioicons)",
                    "page": "https://github.com/duerrsimon/bioicons/blob/main/" + urllib.parse.quote(p),
                    "download": "https://raw.githubusercontent.com/duerrsimon/bioicons/main/" + urllib.parse.quote(p),
                    "size": "svg", "w": 0, "h": 0, "name": fn[:-4], "desc": cat.replace("_", " "), "prior": 0.2})
    return out, excluded


def search_servier(q, n=20):
    data = cached_json("https://smart.servier.com/wp-json/wp/v2/search?" + urllib.parse.urlencode({"search": q, "per_page": n}))
    out = []
    for i, r in enumerate(data if isinstance(data, list) else []):
        if r.get("subtype") != "smart_image":
            continue
        slug = r["url"].rstrip("/").rsplit("/", 1)[-1]
        out.append({"source": "servier", "title": strip_html(r.get("title")) + f" [{slug}]", "licence": "CC BY 4.0",
                    "author": "Servier Medical Art", "page": r["url"], "download": None, "size": "png", "w": 0, "h": 0,
                    "name": strip_html(r.get("title")) + " " + slug, "desc": "", "prior": 0.25 * (1 - i / n)})
    return out, 0


def rank(items, q):
    qt = tokens(q)
    for it in items:
        nt, dt_ = set(tokens(it["name"])), set(tokens(it["desc"]))
        hit = sum(1 for t in qt if t in nt or any(x.startswith(t) for x in nt))
        dhit = sum(1 for t in qt if t in dt_)
        lic = it["licence"]
        bonus = 0.3 if lic in ("Public domain", "CC0 1.0") else (0.0 if "SA" in lic else 0.2)
        res = 0.3 if it["size"] == "svg" or it["download"] and it["download"].lower().endswith(".svg") else 0
        res += 0.3 if min(it["w"], it["h"]) >= 1000 else (0.1 if min(it["w"], it["h"]) >= 500 else 0)
        it["score"] = round(2 * hit / max(1, len(qt)) + 0.5 * dhit / max(1, len(qt)) + it["prior"] + bonus + res, 2)  # vectors first
    return sorted(items, key=lambda x: -x["score"])


def servier_download_url(page):
    h = fetch(page).decode("utf-8", "replace")
    m = re.search(r'href="([^"]+\.(?:png|jpg|svg))"[^>]*\bdownload\b', h) or re.search(r'property="og:image" content="([^"]+)"', h)
    if not m:
        raise FetchError(f"no downloadable image on {page}")
    return m.group(1)


def append_source(dest, fname, it, sha):
    f = dest / "SOURCES.md"
    if not f.exists():
        f.write_text("# Downloaded reference art\n\nOne row per file (written by tools/refart.py find --download). Credit every "
                     "CC BY / CC BY-SA item in the video description. CC BY-SA never goes into engine/app/public/refs.\n\n"
                     "| File | Subject | Author | Licence | Source | sha256 (12) |\n|---|---|---|---|---|---|\n")
    clean = lambda s: str(s).replace("|", "/").replace("\n", " ")
    with f.open("a") as w:
        w.write(f"| `{fname}` | {clean(it['title'])} | {clean(it['author'])} | {it['licence']} | {it['page']} | {sha[:12]} |\n")


def cmd_find(a):
    q = a[0] if a and not a[0].startswith("-") else sys.exit("usage: refart find \"query\" [--download N]")
    srcs = (opt(a, "--sources") or "commons,bioicons,servier").split(",")
    items, notes = [], []
    for s, fn in (("commons", search_commons), ("bioicons", search_bioicons), ("servier", search_servier)):
        if s not in srcs:
            continue
        try:
            r, ex = fn(q)
            items += r
            if ex:
                notes.append(f"{s}: {ex} excluded (licence not PD/CC0/CC BY/CC BY-SA)")
        except (FetchError, ValueError, KeyError) as e:
            notes.append(f"{s}: unavailable ({e})")
    items = rank(items, q)[: int(opt(a, "--limit", 15))]
    print(f"{'#':>2} {'score':>5} {'source':8} {'licence':13} {'size':10} title  (author)  page")
    for i, it in enumerate(items, 1):
        sa = " SA!" if "SA" in it["licence"] else ""
        print(f"{i:>2} {it['score']:>5} {it['source']:8} {it['licence'] + sa:13} {it['size']:10} {it['title'][:60]}  "
              f"({it['author'][:40]})  {it['page']}")
    for n in notes:
        print("note:", n)
    if not opt(a, "--download"):
        return
    dest = pathlib.Path(opt(a, "--dest", "references/raw"))
    dest.mkdir(parents=True, exist_ok=True)
    for k in opt(a, "--download").split(","):
        it = items[int(k) - 1]
        url = it["download"] or servier_download_url(it["page"])
        ext = pathlib.Path(urllib.parse.urlsplit(url).path).suffix.lower() or ".bin"
        stem = re.sub(r"[^A-Za-z0-9_-]+", "_", pathlib.Path(urllib.parse.unquote(urllib.parse.urlsplit(url).path)).stem)[:60]
        fname = f"{it['source']}_{stem}{ext}"
        data = fetch(url, out=dest / fname)
        sha = hashlib.sha256(data).hexdigest()
        append_source(dest, fname, it, sha)
        warn = "  (CC BY-SA: share-alike terms apply; not for engine/app/public/refs)" if "SA" in it["licence"] else ""
        print(f"saved {dest / fname} ({len(data) // 1024} KB, {it['licence']}){warn}")


# ======================================================================= imaging helpers
def _cv():
    try:
        import cv2
        return cv2
    except ImportError:
        return None


def load_gray(path):
    import numpy as np
    from PIL import Image
    im = Image.open(path)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        im = Image.alpha_composite(bg, im)
    rgb = np.asarray(im.convert("RGB"))
    g = np.asarray(im.convert("L"))
    colour = float(np.abs(rgb.astype(int) - g[..., None].astype(int)).mean()) > 3
    return g.copy(), (rgb.copy() if colour else None)


def resize(a, w, h, nearest=False):
    import numpy as np
    cv2 = _cv()
    if cv2 is not None:
        return cv2.resize(a, (w, h), interpolation=cv2.INTER_NEAREST if nearest else (cv2.INTER_AREA if w < a.shape[1] else cv2.INTER_CUBIC))
    from PIL import Image
    return np.asarray(Image.fromarray(a).resize((w, h), Image.NEAREST if nearest else Image.LANCZOS))


def blur(f, sigma):
    """Gaussian blur of a float image (OpenCV, else separable numpy convolution)."""
    import numpy as np
    cv2 = _cv()
    if cv2 is not None:
        return cv2.GaussianBlur(f, (0, 0), sigma)
    r = max(1, int(3 * sigma + 0.5))
    x = np.arange(-r, r + 1)
    k = np.exp(-x * x / (2 * sigma * sigma))
    k /= k.sum()
    p = np.pad(f, r, mode="reflect")
    p = np.apply_along_axis(lambda v: np.convolve(v, k, mode="valid"), 1, p)
    return np.apply_along_axis(lambda v: np.convolve(v, k, mode="valid"), 0, p)


def dilate(m, r):
    import numpy as np
    if r <= 0:
        return m
    cv2 = _cv()
    if cv2 is not None:
        return cv2.dilate(m.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))) > 0
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def otsu(v):
    import numpy as np
    h = np.bincount(v.ravel().astype(np.uint8), minlength=256).astype(float)
    p = h / max(1, h.sum())
    w = np.cumsum(p)
    mu = np.cumsum(p * np.arange(256))
    with np.errstate(divide="ignore", invalid="ignore"):
        s = (mu[-1] * w - mu) ** 2 / (w * (1 - w))
    return int(np.nanargmax(s))


def components(binary):
    """(n, labels, stats[x, y, w, h, area]) of 8-connected components; OpenCV or a pure-Python BFS."""
    import numpy as np
    cv2 = _cv()
    if cv2 is not None:
        n, lab, st, _ = cv2.connectedComponentsWithStats(binary.astype(np.uint8), connectivity=8)
        return n, lab, st
    from collections import deque
    H, W = binary.shape
    lab = np.zeros((H, W), np.int32)
    stats = [[0, 0, W, H, 0]]
    ys, xs = np.nonzero(binary)
    b = binary
    for y0, x0 in zip(ys.tolist(), xs.tolist()):
        if lab[y0, x0]:
            continue
        k = len(stats)
        lab[y0, x0] = k
        dq = deque([(y0, x0)])
        x1 = x2 = x0
        y1 = y2 = y0
        area = 0
        while dq:
            y, x = dq.popleft()
            area += 1
            x1, x2, y1, y2 = min(x1, x), max(x2, x), min(y1, y), max(y2, y)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and b[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = k
                        dq.append((yy, xx))
        stats.append([x1, y1, x2 - x1 + 1, y2 - y1 + 1, area])
    return len(stats), lab, np.array(stats)


def poly_mask(shape, poly):
    import numpy as np
    from PIL import Image, ImageDraw
    im = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(im).polygon([tuple(map(float, p)) for p in poly], fill=1)
    return np.asarray(im) > 0


def line_mask(shape, p0, p1, width):
    import numpy as np
    from PIL import Image, ImageDraw
    im = Image.new("L", (shape[1], shape[0]), 0)
    ImageDraw.Draw(im).line([tuple(map(float, p0)), tuple(map(float, p1))], fill=1, width=max(1, int(round(width))))
    return np.asarray(im) > 0


# ======================================================================= clean
def ocr_words(g, min_conf, scale):
    """Word polygons (in g's coordinates) from tesseract at several rotations. [] without tesseract."""
    import numpy as np
    from PIL import Image
    if not shutil.which("tesseract"):
        print("refart: tesseract not found: OCR skipped (heuristics only)", file=sys.stderr)
        return []
    H, W = g.shape
    big = resize(g, int(W * scale), int(H * scale))
    words = []
    with tempfile.TemporaryDirectory(prefix="refart-ocr-", dir=os.environ.get("HARNESS_TMPDIR", "/var/tmp")) as td:
        for ang in (0, 90, -90, 35, -35, 65, -65):
            im = Image.fromarray(big).rotate(ang, expand=True, fillcolor=255, resample=Image.BICUBIC)
            f = os.path.join(td, f"r{ang}.png")
            im.save(f)
            tsv = subprocess.run(["tesseract", f, "-", "--psm", "11", "tsv"], capture_output=True, text=True, timeout=120).stdout
            # rotation maps big-image point p to rotated point R(p - c0) + c1 (PIL rotates counter-clockwise)
            c0 = np.array([big.shape[1] / 2, big.shape[0] / 2])
            c1 = np.array([im.width / 2, im.height / 2])
            t = math.radians(ang)
            Rinv = np.array([[math.cos(t), -math.sin(t)], [math.sin(t), math.cos(t)]])  # rotated -> original (y down)
            for row in tsv.splitlines()[1:]:
                f_ = row.split("\t")
                if len(f_) < 12 or not f_[11].strip():
                    continue
                conf, text = float(f_[10]), f_[11].strip()
                letters = sum(ch.isalpha() for ch in text)
                if not ((letters >= 3 and conf >= min_conf and letters / len(text) >= 0.6) or (letters >= 2 and conf >= 85)):
                    continue
                if not re.fullmatch(r"[\"'(‘’]*[A-Za-z][a-z'’.-]*[A-Za-z.]?[,.;)'’]*", text):
                    continue  # one word, letters only: random glyph soup from hatching rarely is
                x, y, w, h = (int(v) for v in f_[6:10])
                corners = np.array([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], float)
                pts = (corners - c1) @ Rinv.T + c0
                words.append({"text": text, "conf": conf, "angle": ang, "poly": pts / scale, "h": h / scale})
    # the same word found at two rotations: keep the more confident
    keep = []
    for wd in sorted(words, key=lambda d: -d["conf"]):
        c = wd["poly"].mean(0)
        if all(np.hypot(*(c - k["poly"].mean(0))) > 0.6 * max(k["h"], wd["h"]) for k in keep):
            keep.append(wd)
    return keep


def label_glyphs(g, dark_thr, s0, min_light=0.8, min_thick=1.7, region=None):
    """Printed label glyphs. Engravers set labels on cleared paper in bold strokes, so a glyph is a small dark
    component (long side <= 5 x text size, short side <= 1.8 x) whose surrounding ring is mostly light paper, with a
    stroke thicker than a hatch line (area / long side >= min_thick). Hatching fails the ring test, thin hatch dashes
    fail the thickness test. Inside `region` (a bool mask the user drew around a missed label) every small component
    wholly inside counts, so the hint masks glyph pixels only, never the box. Returns (mask, n_glyphs)."""
    import numpy as np
    n, lab, st = components(g < dark_thr)
    light = g >= dark_thr
    H, W = g.shape
    ring_r = max(2, int(round(s0 / 3)))
    sel = np.zeros(n, bool)
    for i in range(1, n):
        x, y, w, h, area = (int(v) for v in st[i][:5])
        if area < 3 or max(w, h) > 5 * s0 or min(w, h) > 1.8 * s0:
            continue
        if region is not None:
            if region[y:y + h, x:x + w].all():
                sel[i] = True
            continue
        if area / max(w, h) < min_thick:
            continue
        x0, y0, x1, y1 = max(0, x - ring_r - 2), max(0, y - ring_r - 2), min(W, x + w + ring_r + 2), min(H, y + h + ring_r + 2)
        m = lab[y0:y1, x0:x1] == i
        ring = dilate(m, ring_r) & ~dilate(m, 1)
        if ring.any() and light[y0:y1, x0:x1][ring].mean() >= min_light:
            sel[i] = True
    return sel[lab], int(sel.sum())


def words_from(text, size):
    """Group glyph pixels into words: components closer than ~1.3 glyph sizes. Returns [(member_mask, n_glyphs)]."""
    import numpy as np
    n, lab, st = components(dilate(text, max(1, int(round(0.65 * size)))))
    out = []
    for i in range(1, n):
        m = (lab == i) & text
        k = components(m)[0] - 1
        if k >= 3:
            out.append(m)
    return out


def leader_lines(g, text, size, dark_thr, debug=False):
    """Leader lines: at most one per word (>= 3 glyphs). A thin straight segment whose near end is within ~1.5 glyphs
    of the word, pointing away from the word's centre, at least three glyphs long, and with light paper on
    BOTH sides; it is masked only up to where it enters tissue (an anatomy outline has tissue on one side, a hatch
    stroke has neighbours), so a false candidate never cuts the drawing. OpenCV only."""
    import numpy as np
    cv2 = _cv()
    out = np.zeros_like(text)
    if cv2 is None or not text.any():
        return out
    dark = (g < min(250, dark_thr + 40)).astype(np.uint8)   # leader lines are often lighter than the type
    found = []  # probabilistic Hough drops fragmented 1-2 px lines at random: union a few parameter sets
    for res, th, gap in ((np.pi / 360, 1.1, 2), (np.pi / 180, 1.45, 2), (np.pi / 180, 1.1, 4)):
        r = cv2.HoughLinesP(dark * 255, 1, res, threshold=int(max(8, th * size)), minLineLength=int(max(12, 2.0 * size)), maxLineGap=gap)
        if r is not None:
            found.append(r.reshape(-1, 4))
    if not found:
        return out
    segs = np.concatenate(found).astype(float)
    light = g >= dark_thr
    H, W = g.shape
    for wm in words_from(text, size):
        ys, xs = np.nonzero(wm)
        c = np.array([xs.mean(), ys.mean()])
        dist = cv2.distanceTransform((~dilate(wm, 1)).astype(np.uint8), cv2.DIST_L2, 3)
        cands = []
        for x1, y1, x2, y2 in segs:
            p1, p2 = np.array([x1, y1]), np.array([x2, y2])
            d1, d2 = dist[int(y1), int(x1)], dist[int(y2), int(x2)]
            if d1 > d2:
                p1, p2, d1, d2 = p2, p1, d2, d1
            if d1 > 1.5 * size or d2 < 2.5 * size:
                continue
            u = (p2 - p1) / np.linalg.norm(p2 - p1)
            r = p1 - c
            if np.linalg.norm(r) > 0 and float(u @ r) / np.linalg.norm(r) < 0.5:
                continue  # does not point away from the word
            nrm = np.array([-u[1], u[0]])
            # walk out from the word; stop where either side stops being light paper (the line enters tissue)
            L = float(np.linalg.norm(p2 - p1))
            run, bad = 0.0, 0
            for t in np.arange(0, L, 1.0):
                q = p1 + t * u
                ok = True
                for o in (-4.5, -3.0, 3.0, 4.5):
                    qx, qy = int(round(q[0] + o * nrm[0])), int(round(q[1] + o * nrm[1]))
                    if not (0 <= qx < W and 0 <= qy < H) or (dist[qy, qx] > 1 and not light[qy, qx]):
                        ok = False
                bad = 0 if ok else bad + 1
                if bad >= 3:
                    break
                run = t
            end = p1 + max(0.0, run - 2) * u
            if debug:
                print("leader?", p1.astype(int).tolist(), p2.astype(int).tolist(), "free run", round(run), file=sys.stderr)
            if run >= 2.5 * size:
                cands.append((run, p1, end, run, u))
        if not cands:
            continue
        best = max(cands, key=lambda k: k[0])
        n_best = np.array([-best[4][1], best[4][0]])
        for sc, p1, p2, d2, u in cands:  # the best leader plus its collinear fragments
            if abs(float(u @ best[4])) > 0.995 and abs(float((p1 - best[1]) @ n_best)) < 2.5 and d2 <= best[3] + 3:
                out |= line_mask(g.shape, p1, p2, 5) & dilate(dark > 0, 1)
    return out


def inpaint(img, mask, method, radius):
    import numpy as np
    cv2 = _cv()
    m8 = mask.astype(np.uint8) * 255
    if cv2 is not None:
        if method == "fsr" and hasattr(cv2, "xphoto"):
            dst = img.copy()
            cv2.xphoto.inpaint(img, (~mask).astype(np.uint8) * 255, dst, cv2.xphoto.INPAINT_FSR_FAST)
            return dst
        return cv2.inpaint(img, m8, radius, cv2.INPAINT_NS if method == "ns" else cv2.INPAINT_TELEA)
    # diffusion fill: unknown pixels repeatedly take the normalised blur of known ones
    f = img.astype(np.float32)
    known = (~mask).astype(np.float32)
    if f.ndim == 3:
        known = known[..., None]
    out = f * known
    for s in (8, 4, 2, 1):
        num = np.stack([blur(out[..., c] if out.ndim == 3 else out, s) for c in range(f.shape[2])], -1) if f.ndim == 3 else blur(out, s)
        den = blur(known[..., 0] if f.ndim == 3 else known, s)
        fill = num / np.maximum(den[..., None] if f.ndim == 3 else den, 1e-4)
        out = np.where(known > 0, f, fill)
    return np.clip(out, 0, 255).astype(np.uint8)


def preview(left, right, path, mask=None, labels=None):
    import numpy as np
    from PIL import Image
    L = np.stack([left] * 3, -1) if left.ndim == 2 else left.copy()
    if mask is not None:
        L[mask] = (0.35 * L[mask] + 0.65 * np.array([230, 30, 30])).astype(np.uint8)
    R = np.stack([right] * 3, -1) if right.ndim == 2 else right
    gap = np.full((L.shape[0], 8, 3), 128, np.uint8)
    im = np.concatenate([L, gap, R], 1)
    if im.shape[1] > 1600:
        k = 1600 / im.shape[1]
        im = np.asarray(Image.fromarray(im).resize((1600, int(im.shape[0] * k)), Image.LANCZOS))
    save_small(Image.fromarray(im), path)


def save_small(im, path):
    """Previews are for eyes, not pixels: a 64-colour palette keeps them small enough to commit."""
    im.quantize(colors=64, method=0, dither=0).save(path, optimize=True)


def parse_box(s):
    return [float(v) for v in s.split(",")]


def cmd_clean(a):
    _need_imaging()
    import numpy as np
    from PIL import Image
    src = pathlib.Path(a[0])
    out = pathlib.Path(opt(a, "-o") or src.with_name(src.stem + "_clean.png"))
    g, rgb = load_gray(src)
    H, W = g.shape
    thr = min(otsu(g), 170)
    scale = max(1.0, min(4.0, 1600 / max(H, W)))
    words = [] if "--no-ocr" in a else ocr_words(g, float(opt(a, "--min-conf", 55)), scale)
    text = np.zeros((H, W), bool)
    sizes = []
    for wd in words:
        sizes.append(wd["h"])
    s_ocr = float(np.median(sizes)) if sizes else max(6.0, min(H, W) / 45)
    for wd in words:  # components wholly inside the (slightly grown) word box: glyphs, not the hatching crossing it
        text |= label_glyphs(g, thr, s_ocr, region=dilate(poly_mask(g.shape, wd["poly"]), 2))[0]
    # glyph size: OCR word boxes include ascenders/descenders, a single glyph's long side is about 0.7 of that
    s0 = float(opt(a, "--text-px", 0)) or (0.7 * float(np.median(sizes)) if len(sizes) >= 2 else max(6.0, min(H, W) / 45))
    nglyph = 0
    if "--no-heuristic" not in a:
        m, nglyph = label_glyphs(g, thr, s0, float(opt(a, "--min-light", 0.8)), float(opt(a, "--min-thick", 1.7)))
        text |= m
    for b in opts(a, "--region"):
        x, y, w, h = parse_box(b)
        reg = np.zeros((H, W), bool)
        reg[int(y):int(y + h), int(x):int(x + w)] = True
        m, k = label_glyphs(g, thr, s0, region=reg)
        text |= m
        nglyph += k
    lines = np.zeros_like(text) if "--no-leaders" in a else leader_lines(g, text, s0, thr, "--debug" in a)
    mask = dilate(text | lines, 1)
    if opt(a, "--mask"):
        extra = np.asarray(Image.open(opt(a, "--mask")).convert("L").resize((W, H))) > 127
        mask |= extra
    for b in opts(a, "--keep"):
        x, y, w, h = parse_box(b)
        mask[int(y):int(y + h), int(x):int(x + w)] = False
    method = opt(a, "--method", "telea")
    base = rgb if rgb is not None else g
    cleaned = inpaint(base, mask, method, int(opt(a, "--radius", 3)))
    Image.fromarray(cleaned).save(out)
    Image.fromarray((mask * 255).astype(np.uint8)).save(out.with_name(out.stem + "_mask.png"))
    pv = out.with_name(out.stem + "_preview.png")
    preview(base, cleaned, pv, mask)
    found = ", ".join(sorted({w["text"] for w in words}))[:200]
    print(f"clean: {len(words)} OCR words [{found}], {nglyph} label glyphs (text size {s0:.0f} px), leader px {int(lines.sum())}, "
          f"masked {mask.mean():.1%} of the image, inpaint={method if _cv() else 'diffusion'}")
    print(f"wrote {out}  {pv}")


# ======================================================================= trace
def cmd_trace(a):
    _need_imaging()
    import numpy as np
    from PIL import Image
    src = pathlib.Path(a[0])
    out = pathlib.Path(opt(a, "-o") or src.with_name(src.stem.replace("_clean", "") + "_trace.png"))
    g, _ = load_gray(src)
    H, W = g.shape
    sc = opt(a, "--scale", "auto")
    k = max(1.0, min(4.0, 1600 / max(H, W))) if sc == "auto" else float(sc)
    if k != 1:
        g = resize(g, int(W * k), int(H * k))
    f = g.astype(np.float32) / 255
    lo, hi = (float(v) for v in opt(a, "--levels", "0.05,0.95").split(","))
    f = np.clip((f - lo) / max(1e-3, hi - lo), 0, 1)
    mode = opt(a, "--mode", "xdog")
    P = {"mode": mode, "scale": round(k, 3), "levels": [lo, hi]}
    if mode == "xdog":
        sigma, kk, p = float(opt(a, "--sigma", 0.6)) * k ** 0.5, float(opt(a, "--k", 1.6)), float(opt(a, "--p", 6))
        eps, phi = float(opt(a, "--eps", 0.5)), float(opt(a, "--phi", 6))
        S = (1 + p) * blur(f, sigma) - p * blur(f, sigma * kk)
        o = np.where(S >= eps, 1.0, 1 + np.tanh(phi * (S - eps)))
        P.update(sigma=round(sigma, 3), k=kk, p=p, eps=eps, phi=phi)
    else:
        block, c = int(opt(a, "--block", 31)), float(opt(a, "--c", 9))
        m = blur(f, block / 6)
        o = np.clip(1 - (m - f - c / 255) * float(opt(a, "--phi", 14)), 0, 1)
        P.update(block=block, c=c)
    o = np.clip(o, 0, 1)
    sp = int(opt(a, "--despeckle", 4))
    cv2 = _cv()
    if sp and cv2 is not None:
        n, lab, st, _ = cv2.connectedComponentsWithStats((o < 0.5).astype(np.uint8), connectivity=8)
        small = np.nonzero(st[:, 4] < sp * k * k)[0]
        small = small[small > 0]
        o[np.isin(lab, small)] = 1.0
        P["despeckle"] = sp
    img = (o * 255).astype(np.uint8)
    Image.fromarray(img).save(out, optimize=True)
    side = {"kind": "raster", "png": out.name, "w": img.shape[1], "h": img.shape[0], "source": src.name, "params": P,
            "engine": f"rasterArt('refs/{out.name}', null, 'bone') on ink plates, 'ink' on bone plates (alpha = darkness)",
            "dark_fraction": round(float((img < 128).mean()), 4)}
    if "--vector" in a:
        if shutil.which("potrace"):
            pbm = out.with_suffix(".pbm")
            Image.fromarray(((img < 128) * 255).astype(np.uint8)).convert("1").save(pbm)
            svg = out.with_suffix(".svg")
            subprocess.run(["potrace", "-s", "--flat", "-t", "3", "-o", str(svg), str(pbm)], check=True, timeout=200)
            pbm.unlink()
            ref = out.with_name(out.stem + "_ref.json")
            subprocess.run([sys.executable, "-I", str(HERE.parent / "engine/tools/svgflat.py"), str(svg), str(ref)], check=True, timeout=200)
            side.update(svg=svg.name, ref_json=ref.name, engine_vector=f"refArt('{ref.stem}', 900)")
        else:
            side["vector"] = "skipped: potrace CLI not installed (raster output is loadable by rasterArt)"
    out.with_name(out.stem + ".json").write_text(json.dumps(side, indent=1) + "\n")
    # preview: source | trace | as the engine draws it: rasterArt(…, 'bone') on ink, rasterArt(…, 'ink') on bone
    H7 = 640
    small = lambda x: np.asarray(Image.fromarray(x).resize((int(x.shape[1] * H7 / x.shape[0]), H7), Image.LANCZOS))
    s1, s2 = small(g), small(img)
    alpha = (np.clip((1 - s2.astype(np.float32) / 255) * 1.15, 0, 1) ** 0.9)[..., None]
    ink, bone = np.array([10, 10, 11], np.float32), np.array([238, 233, 223], np.float32)
    on_ink = (ink * (1 - alpha) + bone * alpha).astype(np.uint8)
    on_bone = (bone * (1 - alpha) + ink * alpha).astype(np.uint8)
    pv = out.with_name(out.stem + "_preview.png")
    gap = np.full((H7, 8, 3), 128, np.uint8)
    rgb = lambda x: np.stack([x] * 3, -1)
    save_small(Image.fromarray(np.concatenate([rgb(s1), gap, rgb(s2), gap, on_ink, gap, on_bone], 1)), pv)
    print(f"trace: {mode} {img.shape[1]}x{img.shape[0]}, dark {side['dark_fraction']:.1%}" +
          (f", vector {side.get('ref_json')}" if side.get("ref_json") else (", " + side["vector"] if "vector" in side else "")))
    print(f"wrote {out}  {pv}")


def main():
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help") or a[0] not in ("find", "clean", "trace"):
        sys.exit(__doc__)
    try:
        {"find": cmd_find, "clean": cmd_clean, "trace": cmd_trace}[a[0]](a[1:])
    except FetchError as e:
        sys.exit(f"refart: {e}")


if __name__ == "__main__":
    main()
