"""Story-beat music: mood sections from script.json + timing.json, a music bed per section (a CC BY demo library,
one ElevenLabs Music composition, or sections reused from your private cache of earlier takes), crossfaded on the
narration's cue words, ducked under the voice, loudness-normalized.

  python3 tools/music.py <episode> plan               music/music_plan.json (sections, crossfades, accents); prints it
  python3 tools/music.py <episode> fetch              download the library tracks the plan needs (no episode: all)
  python3 tools/music.py <episode> reuse [--dry-run]  find cached takes/sections for the plan's moods and lengths (free);
                                                      writes music/reuse_plan.json (mode "reuse" mixes from it)
  python3 tools/music.py <episode> generate [--dry-run] [--yes] [--max-credits N] [--retake] [--fresh]
                                                      ElevenLabs Music: prints the cost estimate first; spends only with
                                                      --yes or a budget (music.max_credits / --max-credits); exactly ONE
                                                      take per call; a second take for the episode needs --retake;
                                                      every spend is logged to music/spend.jsonl
  python3 tools/music.py <episode> mix [--force]      music/mix.wav: voice + ducked bed, two-pass loudnorm (receipt)
  python3 tools/music.py <episode> measure            mix loudness (ebur128), ducking depth, bed under the voice
  python3 tools/music.py [<episode>] cache list       the private music cache (~/.cache/vibe-animator/music/index.json)
  python3 tools/music.py <episode> cache add [--label L] [--note N] [--rank R] [file.mp3 …]
                                                      index takes (default: every take in <episode>/music/cache/)

Script schema: a line may carry "mood": wonder | struggle | tension | hope | resolution | none, carried forward to
later lines until another mood appears. "insight" is an accent, not a section: a subtle lift of the current bed on the
line's first word. "mood_cue": "<word>" moves the turn (or the accent) onto that word of the line. Lines before the
first mood use the first mood; a script without moods uses music.default_mood.

Episode setting (episode.json): "music": "none" | "library" | "elevenlabs" | "reuse", or an object {"mode": …, …} with
the keys of DEFAULTS below. assemble.py and make_shorts.py call audio_for(): with music on they use music/mix.wav, and
any music failure falls back to the voice alone with a warning. A render is never blocked by music, and assemble,
mix and Shorts NEVER call the music API: only `generate` spends credits.

ElevenLabs: key only from the environment (music.elevenlabs.api_key_env, default ELEVENLABS_API_KEY). Generated takes
stay in <episode>/music/cache/ and the private user cache (CACHE below), both git-ignored: ElevenLabs' music terms
forbid redistributing generated music as a library. Reusing your own takes in your own videos is fine.
Design and tuning notes: docs/STORY_MUSIC.md.
"""
import array, datetime, hashlib, json, math, os, pathlib, re, shutil, subprocess, sys, time, urllib.error, urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import HARNESS, episode_from_argv, merge, save_json  # noqa: E402
import receipts  # noqa: E402

BED_MOODS = ("wonder", "struggle", "tension", "hope", "resolution", "none")
MOODS = BED_MOODS + ("insight",)
LIBRARY = HARNESS / "tools/music_library.json"
# Private, user-level music cache: library downloads, and every generated take (takes/<sha>.mp3 + index.json).
# Never inside a repo, never committed (ElevenLabs' terms forbid redistributing generated music as a library).
CACHE = pathlib.Path(os.environ.get("VIBE_MUSIC_CACHE") or
                     pathlib.Path(os.environ.get("XDG_CACHE_HOME", pathlib.Path.home() / ".cache")) / "vibe-animator/music")
API = "https://api.elevenlabs.io"
# ElevenLabs Music cost, measured on the trailer 2026-10-25 (Creator plan, music_v1): 2,590 credits for 188.4 s and
# 248 for 18 s, about 13.8 credits per second of music. `generate` estimates seconds x this before spending.
CREDITS_PER_SECOND = 13.8
# a mood with no cached run may borrow a neighbouring one (reuse mode only), in this order
MOOD_NEAR = {"wonder": ["hope", "resolution"], "struggle": ["tension"], "tension": ["struggle"],
             "hope": ["resolution", "wonder"], "resolution": ["hope", "wonder"]}

DEFAULTS = {
    "mode": "none",                  # none | library | elevenlabs | reuse (sections of cached takes, no API)
    "default_mood": "wonder",        # used when no line has a mood
    "bed_db": -15.0,                 # bed under the voice DURING SPEECH (dB, after ducking): documentary -14..-16,
                                     # trailer about -10. In the gaps the bed is duck_db louder than that.
    "duck_db": 6.0,                  # ducking depth under speech (dB); the bed is back at full level in the gaps
    "bed_lufs": None,                # absolute override: loudness of the unducked bed (LUFS), ignoring bed_db
    "duck": {"threshold": 0.02, "ratio": 20, "attack": 20, "release": 300, "knee": 6},  # sidechaincompress, VO key;
                                     # depth limited to duck_db through its dry/wet mix (a soft, bounded duck)
    "fade_min": 1.0, "fade_max": 2.5,  # crossfade length (s); it always ENDS on the cue word
    "fade_in": 1.5, "fade_out": 3.0,   # first bed in from 0; last bed out to the end
    "min_section": 3.0,              # a shorter section is merged into the previous one (also the API's minimum)
    "warn_section": 8.0,             # shorter sections are allowed but warned about (sounds like channel-surfing)
    "accent_db": 4.0,                # insight: lift of the (ducked) bed, peaking just after the cue word
    "loudness": -14.0, "true_peak": -1.5, "lra": 11.0,
    "max_credits": None,             # ElevenLabs budget for this episode (all takes, from music/spend.jsonl); None: --yes
    "shorts": True,                  # Shorts use the same mix (sliced); false: Shorts keep the voice alone
    "library": None,                 # manifest path (default tools/music_library.json)
    "tracks": {},                    # mood -> track id override, e.g. {"wonder": "dreamy-flashback"}
    "elevenlabs": {
        "model": "music_v1",         # music_v1 (sections) | music_v2 / music_v2_5 (chunks)
        "api_key_env": "ELEVENLABS_API_KEY",
        "styles": ["cinematic documentary underscore", "instrumental", "background music under narration",
                   "unobtrusive", "consistent instrumentation", "warm mix"],
        "negative_styles": ["vocals", "singing", "lyrics", "choir", "spoken word", "loud drums", "EDM drop"],
        "max_request_s": 290,        # one request per <= this much video (docs: 5 min max song, 120 s per section)
        "overlap": 2.0,              # s of crossfade between two requests (at a section change)
        "seed": None,
        "mood_styles": {},           # mood -> local styles, replacing MOOD_STYLES[mood] (insight: the accent's additions)
        "mood_negative_styles": {},  # mood -> negative local styles for its sections (e.g. struggle: ["major key"])
        "section_styles": {},        # line id -> local styles from that line's first word (or mood_cue) on, within its
                                     # mood section; on an insight line, the accent section's styles. Splits a section.
        "counter_wait": 90,          # s to wait for the account's character counter to register a generation (it lags)
    },
}

MOOD_STYLES = {
    "wonder": ["curious", "airy", "gentle piano arpeggios", "soft strings", "celesta", "sense of discovery", "slow tempo"],
    "struggle": ["somber", "minor key", "low cello", "sparse piano", "heavy", "unresolved"],
    "tension": ["suspenseful", "pulsing low strings ostinato", "building unease", "minor key", "restrained"],
    "hope": ["warm", "rising", "major key", "piano and strings", "gentle build", "optimistic"],
    "resolution": ["resolved", "calm", "major key", "full warm strings", "settled", "final cadence"],
    "none": ["near silence", "very soft sustained pad"],
    "insight": ["a subtle lift", "soft bell accent at the start", "brief shimmer", "same tempo and instrumentation"],
}


# ---------- settings ----------

def settings(ep_or_cfg):
    cfg = ep_or_cfg.cfg if hasattr(ep_or_cfg, "cfg") else ep_or_cfg
    m = cfg.get("music", "none")
    if m is None or isinstance(m, (str, bool)):
        m = {"mode": "none" if m in (None, False) else m}
    o = merge(DEFAULTS, m)
    if o["mode"] not in ("none", "library", "elevenlabs", "reuse"):
        raise ValueError(f"music mode {o['mode']!r}: use none | library | elevenlabs | reuse")
    if (o.get("elevenlabs") or {}).pop("auto_generate", None):
        print("  music warning: music.elevenlabs.auto_generate is ignored: only `generate` spends credits", file=sys.stderr)
    return o


def bed_target(ep, o):
    """Loudness (LUFS) the unducked bed is gained to: bed_lufs if set, else the voice's integrated loudness + bed_db
    + duck_db, so that after ducking by duck_db the bed sits bed_db under the voice during speech."""
    if o.get("bed_lufs") is not None:
        return float(o["bed_lufs"])
    return round(lufs_of(ep.p("vo/voice.wav")) + float(o["bed_db"]) + float(o["duck_db"]), 2)


def duck_mix(o):
    """sidechaincompress dry/wet mix that bounds the ducking at about duck_db: out = (1 - m) + m * g, where g, the
    fully compressed gain averaged over speech (word gaps and the 300 ms release included), measured about 0.26 on
    the trailer narration. So duck_db can reach about 11 dB at most (m = 1)."""
    return round(min(1.0, max(0.0, (1 - 10 ** (-float(o["duck_db"]) / 20)) / 0.74)), 4)


def _norm(w):
    return re.sub(r"[^\w'’-]", "", w.lower()).strip("'’-")


# ---------- plan (pure; unit-tested in tools/test_music.py) ----------

def compute_plan(script, timing, o=None):
    """Mood sections with exact times. Section i is fully in from `start` (the first word of its first line, or its
    mood_cue word) to `end`; its crossfade runs over `fade` = [a, start] and ends on that word. Accents are times."""
    o = merge(DEFAULTS, o or {})
    smap = {l["id"]: l for c in script["chapters"] for l in c["lines"]}
    lines = [l for c in timing["chapters"] for l in c["lines"]]
    total = float(timing["total"])
    warnings, turns, accents, marks = [], [], [], []
    styled = set(((o.get("elevenlabs") or {}).get("section_styles") or {}))
    prev_end = 0.0  # end of the last word before the current point

    for ln in lines:
        src = smap.get(ln["id"], {})
        mood, cue = src.get("mood"), src.get("mood_cue")
        words = ln.get("words") or [{"w": ln.get("text", ""), "s": ln["start"], "e": ln["end"]}]
        if mood:
            if mood not in MOODS:
                warnings.append(f"{ln['id']}: unknown mood {mood!r} (ignored)")
                mood = None
        if mood:
            k = 0
            if cue:
                hits = [i for i, w in enumerate(words) if _norm(w["w"]) == _norm(cue)]
                if hits:
                    k = hits[0]
                else:
                    warnings.append(f"{ln['id']}: mood_cue {cue!r} is not a word of the line (first word used)")
            t = round(float(words[k]["s"]), 3)
            before = round(float(words[k - 1]["e"]) if k > 0 else prev_end, 3)
            if mood == "insight":
                accents.append({"t": t, "line": ln["id"], "word": words[k]["w"]})
            else:
                turns.append({"mood": mood, "t": t, "gap_from": before, "line": ln["id"], "word": words[k]["w"]})
        if ln["id"] in styled and src.get("mood") != "insight":
            k = next((i for i, w in enumerate(words) if cue and _norm(w["w"]) == _norm(cue)), 0)
            marks.append({"t": round(float(words[k]["s"]), 3), "line": ln["id"]})
        prev_end = float(words[-1]["e"])

    if not turns:
        turns = [{"mood": o["default_mood"], "t": 0.0, "gap_from": 0.0, "line": None, "word": None}]
    turns[0] = dict(turns[0], t=0.0, gap_from=0.0)  # the first mood plays from the start
    # drop non-changes, then merge sections shorter than min_section into the previous one
    merged = []
    for tn in turns:
        if merged and tn["mood"] == merged[-1]["mood"]:
            continue
        merged.append(tn)
    changed = True
    while changed:
        changed = False
        for i in range(1, len(merged)):
            end = merged[i + 1]["t"] if i + 1 < len(merged) else total
            if end - merged[i]["t"] < o["min_section"]:
                warnings.append(f"{merged[i]['line']}: {merged[i]['mood']} section is {end - merged[i]['t']:.1f} s "
                                f"(< {o['min_section']} s): merged into the previous section")
                del merged[i]
                # neighbours may now share a mood
                merged = [m for j, m in enumerate(merged) if j == 0 or m["mood"] != merged[j - 1]["mood"]]
                changed = True
                break

    sections = []
    for i, tn in enumerate(merged):
        end = merged[i + 1]["t"] if i + 1 < len(merged) else total
        if i == 0:
            fade = [0.0, round(min(o["fade_in"], end), 3)]
        else:
            gap = tn["t"] - tn["gap_from"]
            d = min(o["fade_max"], max(o["fade_min"], gap))
            d = min(d, tn["t"] - sections[-1]["start"] - 0.5)  # never start the fade before the previous section is in
            fade = [round(tn["t"] - max(0.2, d), 3), tn["t"]]
        sections.append({"mood": tn["mood"], "start": round(tn["t"], 3), "end": round(end, 3), "fade": fade,
                         "line": tn["line"], "word": tn["word"]})
        if end - tn["t"] < o["warn_section"] and len(merged) > 1:
            warnings.append(f"{tn['line'] or 'start'}: {tn['mood']} lasts {end - tn['t']:.1f} s (< {o['warn_section']} s)")
    out = {"version": 1, "total": total, "sections": sections, "accents": accents, "warnings": warnings}
    if marks:  # only with elevenlabs.section_styles (keeps other plans, and their hashes, unchanged)
        out["marks"] = marks
    return out


def plan(ep, quiet=False):
    o = settings(ep)
    p = compute_plan(ep.script, ep.timing, o)
    out = ep.p("music/music_plan.json")
    old = out.read_text() if out.exists() else None
    new = json.dumps(p, ensure_ascii=False, indent=1) + "\n"
    if new != old:  # unchanged plan keeps its hash (receipts stay fresh)
        save_json(out, p)
    if not quiet:
        for s in p["sections"]:
            print(f"  {s['start']:8.2f}–{s['end']:8.2f}  {s['mood']:11} fade {s['fade'][0]:.2f}→{s['fade'][1]:.2f}"
                  f"{'  on «' + s['word'] + '» (' + s['line'] + ')' if s['word'] else ''}")
        for a in p["accents"]:
            print(f"  {a['t']:8.2f}            insight accent on «{a['word']}» ({a['line']})")
        for w in p["warnings"]:
            print("  warning:", w)
        print("wrote", out)
    return p


# ---------- library ----------

def library(o):
    f = pathlib.Path(o["library"]) if o.get("library") else LIBRARY
    return json.loads(f.read_text())["tracks"]


def track_for(o, mood, lib):
    want = (o.get("tracks") or {}).get(mood)
    for t in lib:
        if (want and t["id"] == want) or (not want and t["mood"] == mood):
            return t
    raise LookupError(f"no library track for mood {mood!r}" + (f" (id {want!r})" if want else ""))


def fetch_track(t):
    """Download one manifest track into the cache (sha256-checked); returns its path."""
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f"{t['id']}{pathlib.Path(t['url'].split('?')[0]).suffix or '.mp3'}"
    if f.exists() and receipts.sha256(f) == t["sha256"]:
        return f
    from fetch_ref import fetch
    tmp = f.with_name(f".{f.name}.{os.getpid()}.part")
    fetch(t["url"], out=tmp, quiet=True)
    got = receipts.sha256(tmp)
    if got != t["sha256"]:
        tmp.unlink(missing_ok=True)
        raise RuntimeError(f"{t['id']}: sha256 mismatch ({got[:12]}…), not using it")
    os.replace(tmp, f)
    print(f"  fetched {t['title']} -> {f}")
    return f


def library_pieces(ep, p, o, target):
    lib, pieces, offsets, credits = library(o), [], {}, []
    secs = p["sections"]
    for i, s in enumerate(secs):
        if s["mood"] == "none":
            continue
        t = track_for(o, s["mood"], lib)
        f = fetch_track(t)
        t0 = s["fade"][0]
        nxt = secs[i + 1] if i + 1 < len(secs) else None
        t1 = nxt["start"] if nxt else p["total"]
        fade_out = [nxt["fade"][0], nxt["start"]] if nxt else [max(t0, p["total"] - o["fade_out"]), p["total"]]
        off = offsets.get(t["id"], float(t.get("start", 0.0)))  # a mood that returns continues its track
        dur = t1 - t0
        pieces.append({"file": str(f), "offset": round(off % t["duration"], 3), "t0": t0, "t1": t1,
                       "fade_in": s["fade"], "fade_out": fade_out, "loop": off % t["duration"] + dur > t["duration"] - 0.05,
                       "gain_db": round(target - lufs_of(f, t.get("lufs")), 2), "mood": s["mood"], "source": t["id"]})
        offsets[t["id"]] = off + dur
        if t["credit"] not in credits:
            credits.append(t["credit"])
    if credits:
        ep.p("music/CREDITS.txt").write_text("Music\n\n" + "\n\n".join(credits) + "\n")
    return pieces


# ---------- ElevenLabs Music ----------

def _styles(o, mood):
    return list(((o.get("elevenlabs") or {}).get("mood_styles") or {}).get(mood) or MOOD_STYLES[mood])


def chunks_for(p, o):
    """[(t0, t1, mood, name, styles)] covering [0, total]: one per section, an insight chunk split out around each
    accent, a new chunk at each section_styles line, sections > 120 s split evenly. Every chunk >= 3 s."""
    out = []
    ss = (o.get("elevenlabs") or {}).get("section_styles") or {}
    accents = sorted((a["t"], a["line"]) for a in p["accents"])
    marks = sorted((m["t"], m["line"]) for m in p.get("marks", []))
    for s in p["sections"]:
        a0, a1 = s["start"], s["end"]
        if not out:
            a0 = 0.0
        mood, title = s["mood"], s["mood"].title()
        cuts = [[a0, a1, mood, title, None]]   # styles None: resolved below from the region
        for at, aline in accents:
            if not (a0 <= at < a1):
                continue
            last = cuts.pop()
            x0, x1 = at - 0.5, at + 3.5
            if x0 - last[0] < 3:
                x0 = last[0]
            if last[1] - x1 < 3:
                x1 = last[1]
            if x1 - x0 < 3 and x0 > last[0]:   # accent near the section end: take the 3 s before it instead
                x0 = max(last[0], x1 - 3.0)
                if x0 - last[0] < 3:
                    x0 = last[0]
            if x1 - x0 < 3:
                cuts.append(last)
                continue
            if x0 > last[0]:
                cuts.append([last[0], x0, mood, last[3], None])
            cuts.append([x0, x1, mood, f"{title}, insight", ss.get(aline) or "insight"])
            if x1 < last[1]:
                cuts.append([x1, last[1], mood, f"{title}, continued", None])
        regions = [(a0, ss.get(s["line"]) if s["line"] else None)]
        for mt, mline in marks:
            if not (a0 < mt < a1):
                continue
            at_t = mt
            for i, c in enumerate(cuts):
                if not (c[0] <= mt < c[1]):
                    continue
                if c[4] is None and mt - c[0] >= 3 and c[1] - mt >= 3:
                    cuts[i:i + 1] = [[c[0], mt, *c[2:]], [mt, c[1], mood, f"{title} ({mline})", None]]
                elif mt - c[0] < 3:   # too close to a chunk start to split: the new styles take that whole chunk
                    at_t = c[0]
                else:                 # too close to its end: they start with the next chunk
                    at_t = c[1]
                break
            regions.append((at_t, ss[mline]))
        for c in cuts:
            region = [st for t, st in regions if t <= c[0] + 1e-6][-1] or _styles(o, mood)
            if c[4] == "insight":
                c[4] = region + _styles(o, "insight")
            elif c[4] is None:
                c[4] = list(region)
        for c in cuts:
            n = max(1, math.ceil((c[1] - c[0]) / 120.0))
            for k in range(n):
                out.append((c[0] + (c[1] - c[0]) * k / n, c[0] + (c[1] - c[0]) * (k + 1) / n, c[2],
                            c[3] + (f" {k + 1}/{n}" if n > 1 else ""), c[4]))
    return out


def requests_for(p, o):
    """Group chunks into API requests of <= max_request_s and <= 30 chunks, cut preferably at a mood change. A later
    request starts `overlap` s early so the two can crossfade, ending on the boundary."""
    e = o["elevenlabs"]
    ch = chunks_for(p, o)
    groups, cur = [], []
    for c in ch:
        if cur and (c[1] - cur[0][0] > e["max_request_s"] or len(cur) >= 30):
            # back up to the last mood change inside cur, if any, so the seam sits on a turn
            k = max((i for i in range(1, len(cur)) if cur[i][2] != cur[i - 1][2]), default=len(cur))
            groups.append(cur[:k])
            cur = cur[k:]
        cur.append(c)
    groups.append(cur)
    reqs = []
    for gi, g in enumerate(groups):
        pre = e["overlap"] if gi > 0 else 0.0
        g = [(g[0][0] - pre, *g[0][1:])] + g[1:]
        # integer ms from absolute boundaries, so the sum is exact
        edges = [round(c[0] * 1000) for c in g] + [round(g[-1][1] * 1000)]
        reqs.append({"t0": edges[0] / 1000, "t1": edges[-1] / 1000,
                     "chunks": [{"name": c[3], "mood": c[2], "insight": "insight" in c[3], "styles": c[4],
                                 "duration_ms": edges[i + 1] - edges[i]}
                                for i, c in enumerate(g)]})
    return reqs


def request_body(req, o):
    e = o["elevenlabs"]
    model = e["model"]

    def styles(c):
        return c["styles"]

    def neg(c):
        return list((e.get("mood_negative_styles") or {}).get(c["mood"]) or [])
    if model == "music_v1":
        body = {"model_id": model, "respect_sections_durations": True, "composition_plan": {
            "positive_global_styles": e["styles"], "negative_global_styles": e["negative_styles"],
            "sections": [{"section_name": c["name"], "positive_local_styles": styles(c), "negative_local_styles": neg(c),
                          "duration_ms": c["duration_ms"], "lines": []} for c in req["chunks"]]}}
    else:
        body = {"model_id": model, "composition_plan": {"chunks": [
            {"text": f"[{c['name']}] {{instrumental}}", "duration_ms": c["duration_ms"],
             "positive_styles": e["styles"] + styles(c), "negative_styles": e["negative_styles"] + neg(c)} for c in req["chunks"]]}}
    if e.get("seed") is not None:
        body["seed"] = e["seed"]
    return body


def _http(method, path, key, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method,
                               headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "*/*"})
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        return resp.read(), dict(resp.headers)


def _used_chars(key):
    try:
        return json.loads(_http("GET", "/v1/user/subscription", key)[0]).get("character_count")
    except Exception:  # needs the user_read permission; the cost is then unknown, not an error
        return None


def e_wait(o):
    return float(o["elevenlabs"].get("counter_wait") or 0)


def request_hash(body):
    return hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()[:20]


def estimate_credits(seconds):
    """Credits ElevenLabs Music is expected to charge for `seconds` of music (CREDITS_PER_SECOND, measured)."""
    return int(math.ceil(seconds * CREDITS_PER_SECOND))


def take_files(ep, o, p):
    """[{req, body, hash, file}] for the plan's requests. `file` is <episode>/music/cache/<hash>.mp3, restored from the
    private user cache when only that has it; None when no take exists. Never calls the API."""
    out = []
    for r in requests_for(p, o):
        body = request_body(r, o)
        h = request_hash(body)
        f = ep.p("music/cache") / f"{h}.mp3"
        if not f.exists():
            hit = next((t for t in load_index()["takes"] if t.get("request_hash") == h and (CACHE / t["file"]).exists()), None)
            if hit:  # same request generated before (another checkout, or a cleaned episode): copy it back, free
                f.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(CACHE / hit["file"], f)
                print(f"  restored {f.name} from the private music cache ({hit.get('label') or hit['id']})", file=sys.stderr)
        out.append({"req": r, "body": body, "hash": h, "file": f if f.exists() else None})
    return out


def eleven_pieces(ep, p, o, target):
    """Pieces from the cached takes of the plan's requests. Never generates: a missing take is an error (the mix then
    falls back to the voice); `generate` is the only command that spends credits."""
    rows = take_files(ep, o, p)
    miss = [r for r in rows if r["file"] is None]
    if miss:
        secs = sum(r["req"]["t1"] - r["req"]["t0"] for r in miss)
        raise RuntimeError(f"no generated music for this plan ({secs:.0f} s not cached, about "
                           f"{estimate_credits(secs)} credits): run `tools/nx music {ep.dir} reuse` (free) or "
                           f"`tools/nx music {ep.dir} generate` (spends ElevenLabs credits)")
    files = [(r["req"], r["file"]) for r in rows]
    pieces, ov = [], o["elevenlabs"]["overlap"]
    for i, (r, f) in enumerate(files):
        t0, t1 = r["t0"], r["t1"]
        fi = [t0, t0 + ov] if i > 0 else [0.0, min(o["fade_in"], t1)]
        fo = [t1 - ov, t1] if i + 1 < len(files) else [max(t0, p["total"] - o["fade_out"]), p["total"]]
        if i + 1 < len(files):  # the next request starts `overlap` early: fade this one out over that window
            fo = [files[i + 1][0]["t0"], t1]
        pieces.append({"file": str(f), "offset": 0.0, "t0": t0, "t1": t1, "fade_in": fi, "fade_out": fo, "loop": False,
                       "gain_db": round(target - lufs_of(f), 2), "mood": "composed", "source": f.name})
    return pieces


# ---------- spend guard (generate only) ----------

def spend_log(ep):
    f = ep.p("music/spend.jsonl")
    return [json.loads(x) for x in f.read_text().splitlines() if x.strip()] if f.exists() else []


def spent(ep):
    """Credits this episode has spent on music: measured where the account counter showed it, else the estimate."""
    return sum((e.get("credits_measured") or e.get("credits_estimate") or 0) for e in spend_log(ep))


def _log_spend(ep, entry):
    f = ep.p("music/spend.jsonl")
    f.parent.mkdir(parents=True, exist_ok=True)
    with open(f, "a") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _opt(args, key):
    return args[args.index(key) + 1] if key in args and args.index(key) + 1 < len(args) else None


def generate(ep, o, p, args):
    """ONE take of the plan (one request per <= max_request_s of video), after a printed cost estimate. Refuses unless
    --yes or a budget (music.max_credits for the episode, all takes; --max-credits N for this call) covers it; any
    budget is a hard cap, also with --yes. A second take of the episode (same plan, or a changed one) needs --retake.
    When the private cache already covers every section, it refuses too (run `reuse`), unless --fresh."""
    dry, retake, fresh = "--dry-run" in args, "--retake" in args, "--fresh" in args
    rows = take_files(ep, o, p)
    todo = [r for r in rows if retake or r["file"] is None]
    secs = sum(r["req"]["t1"] - r["req"]["t0"] for r in todo)
    est = estimate_credits(secs)
    print(f"cost estimate: {secs:.1f} s of music x {CREDITS_PER_SECOND} credits/s = about {est} credits "
          f"({len(todo)} of {len(rows)} requests; episode spent so far: {spent(ep)}; budget: "
          f"{o.get('max_credits') if o.get('max_credits') is not None else 'none set'})")
    for r in rows:
        print(f"  request {r['req']['t0']:.2f}–{r['req']['t1']:.2f} s ({r['req']['t1'] - r['req']['t0']:.1f} s, "
              f"{len(r['req']['chunks'])} sections) {r['hash']}{'  cached' if r['file'] else ''}")
        if dry:
            print("   ", json.dumps(r["body"])[:600])
    if dry:
        return []
    if not todo:
        print("every request is cached: nothing to spend (a new take needs --retake)")
        return []
    prior = spend_log(ep) or (list(ep.p("music/cache").glob("*.mp3")) if ep.p("music/cache").exists() else [])
    if prior and not retake:
        raise RuntimeError("this episode already has a music take; a new take (new prompts or a re-timed plan count too) "
                           "needs --retake")
    if not fresh and not retake:
        cov = reuse_assign(p, load_index()["takes"], o)
        if cov["pieces"] and not cov["missing"]:
            raise RuntimeError("the private music cache already covers every section of this plan: set music.mode "
                               "\"reuse\" (free; preview with `reuse --dry-run`), or pass --fresh to compose anyway")
    budget, cap = o.get("max_credits"), _opt(args, "--max-credits")
    if budget is None and cap is None and "--yes" not in args:
        raise RuntimeError(f"not spending about {est} credits without --yes or a budget (episode.json music.max_credits, "
                           "or --max-credits N)")
    if budget is not None and spent(ep) + est > float(budget):
        raise RuntimeError(f"over budget: {spent(ep)} spent + about {est} > music.max_credits {budget}")
    if cap is not None and est > float(cap):
        raise RuntimeError(f"over budget: about {est} credits > --max-credits {cap}")
    key = os.environ.get(o["elevenlabs"]["api_key_env"] or "")
    if not key:
        raise RuntimeError(f"no ElevenLabs key: export {o['elevenlabs']['api_key_env']}")
    cache = ep.p("music/cache")
    cache.mkdir(parents=True, exist_ok=True)
    take_no = len({e.get("take") for e in spend_log(ep)}) + 1
    stamp = datetime.datetime.now().strftime("%Y%m%dT%H%M%S")
    made = []
    for r in todo:  # each request exactly once: no retries, no loops (a failure stops the take)
        f, meta, secs_r = cache / f"{r['hash']}.mp3", cache / f"{r['hash']}.json", r["req"]["t1"] - r["req"]["t0"]
        before = _used_chars(key)
        t = time.time()
        try:
            audio, hdr = _http("POST", "/v1/music", key, r["body"], timeout=240)
        except urllib.error.HTTPError as err:
            raise RuntimeError(f"ElevenLabs Music HTTP {err.code}: {err.read()[:400].decode('utf8', 'replace')}")
        after = _used_chars(key)
        waited = 0
        while before is not None and after == before and waited < e_wait(o):  # the counter lags the call
            time.sleep(5)
            waited += 5
            after = _used_chars(key)
        if f.exists():  # --retake of the same request: keep the earlier take beside it
            os.replace(f, f.with_name(f"{r['hash']}.{stamp}.mp3"))
            if meta.exists():
                os.replace(meta, meta.with_name(f"{r['hash']}.{stamp}.json"))
        tmp = f.with_name(f".{f.name}.{os.getpid()}.part")
        tmp.write_bytes(audio)
        os.replace(tmp, f)
        used = (after - before) if None not in (before, after) else None
        info = {"request": r["body"], "seconds": round(secs_r, 3), "elapsed_s": round(time.time() - t, 1),
                "song_id": next((v for k, v in hdr.items() if k.lower() in ("song-id", "song_id", "x-song-id")), None),
                "cost_headers": {k: v for k, v in hdr.items() if any(s in k.lower() for s in ("cost", "character", "credit"))},
                "characters_used": used}
        save_json(meta, info)
        _log_spend(ep, {"time": datetime.datetime.now().astimezone().isoformat(timespec="seconds"), "episode": ep.id,
                        "take": take_no, "retake": retake, "request_hash": r["hash"], "model": o["elevenlabs"]["model"],
                        "seconds": round(secs_r, 3), "credits_estimate": estimate_credits(secs_r),
                        "credits_measured": used or None, "song_id": info["song_id"], "file": f"music/cache/{f.name}"})
        try:
            cache_add(f, info, episode=ep.id, label=f"{ep.id} take {take_no}")
        except Exception as e:  # noqa: BLE001 - indexing must not lose a paid take
            print(f"  warning: not indexed in the private cache ({e})", file=sys.stderr)
        print(f"  generated {f.name}: {secs_r:.1f} s in {info['elapsed_s']} s; credits used: {used} "
              f"(account counter; other jobs on the same key add to it); logged to music/spend.jsonl")
        made.append(f)
    return made


# ---------- private music cache (user-level, never committed) ----------

def load_index(root=None):
    f = (root or CACHE) / "index.json"
    return json.loads(f.read_text()) if f.exists() else {"version": 1, "takes": []}


def _save_index(idx, root=None):
    save_json((root or CACHE) / "index.json", idx)


def body_chunks(body):
    """[{name, mood, t0, t1, insight, styles}] of a music request body (both model shapes), in the take's own time."""
    cp = body.get("composition_plan") or {}
    out, t = [], 0.0
    for c in cp.get("sections") or cp.get("chunks") or []:
        name = c.get("section_name") or re.sub(r"^\[([^\]]*)\].*$", r"\1", c.get("text", ""))
        mood = re.split(r"[\s,(]", name.strip(), maxsplit=1)[0].lower()
        d = c["duration_ms"] / 1000
        out.append({"name": name, "mood": mood if mood in BED_MOODS else "wonder", "t0": round(t, 3), "t1": round(t + d, 3),
                    "insight": "insight" in name.lower(),
                    "styles": c.get("positive_local_styles") or c.get("positive_styles") or []})
        t += d
    return out


def style_hash(body):
    """The global sound of a request (model + global styles): takes with the same hash share instrumentation."""
    cp = body.get("composition_plan") or {}
    key = [body.get("model_id"), cp.get("positive_global_styles"), cp.get("negative_global_styles")]
    return hashlib.sha256(json.dumps(key, sort_keys=True).encode()).hexdigest()[:12]


def _onsets(f, rate=100):
    """Onset strength at `rate` Hz (positive change of log energy), for the tempo estimate."""
    a = _pcm(f, 8000)
    hop = 8000 // rate
    en = [math.log10(1e-9 + sum(x * x for x in a[i:i + hop]) / hop) for i in range(0, len(a) - hop, hop)]
    return [max(0.0, en[i] - en[i - 1]) for i in range(1, len(en))], rate


def estimate_bpm(onsets, rate, t0, t1, lo=60, hi=140):
    """Tempo of [t0, t1] by autocorrelation of the onset strength; None when there is no clear pulse."""
    x = onsets[int(t0 * rate):int(t1 * rate)]
    if len(x) < rate * 6:
        return None
    m = sum(x) / len(x)
    x = [v - m for v in x]
    best, score, zero = None, 0.0, sum(v * v for v in x) or 1.0
    for lag in range(int(rate * 60 / hi), int(rate * 60 / lo) + 1):
        c = sum(x[i] * x[i + lag] for i in range(len(x) - lag)) / zero
        if c > score:
            best, score = lag, c
    return round(60.0 * rate / best, 1) if best and score > 0.1 else None


def cache_add(f, meta, episode=None, label=None, note=None, rank=None, date=None, root=None, analyze=True):
    """Copy one take into the private cache (takes/<sha>.mp3 + its request json) and index it by mood sequence,
    prompt hash, style hash, duration, model and date. Re-adding the same audio only updates label/note/rank."""
    root = root or CACHE
    f = pathlib.Path(f)
    sha = receipts.sha256(f)[:16]
    idx = load_index(root)
    hit = next((t for t in idx["takes"] if t["id"] == sha), None)
    if hit:
        for k, v in (("label", label), ("note", note), ("rank", rank)):
            if v is not None:
                hit[k] = v
        _save_index(idx, root)
        return hit
    body = (meta or {}).get("request") or {}
    chunks = body_chunks(body)
    dst = root / "takes" / f"{sha}{f.suffix or '.mp3'}"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(f, dst)
    save_json(dst.with_suffix(".json"), meta or {})
    lufs, duration = None, sum(c["t1"] - c["t0"] for c in chunks) or None
    if analyze:
        try:
            lufs = lufs_of(dst)
            on, rate = _onsets(dst)
            duration = round(len(on) / rate, 2)
            for c in chunks:
                m = re.search(r"(\d{2,3})\s*bpm", " ".join(c["styles"]), re.I)
                c["bpm"] = float(m.group(1)) if m else estimate_bpm(on, rate, c["t0"], c["t1"])
        except Exception as e:  # noqa: BLE001 - an unanalysed take is still reusable (4 s phrases, measured gain)
            print(f"  warning: could not analyse {f.name} ({e})", file=sys.stderr)
    moods = [c["mood"] for c in chunks]
    entry = {"id": sha, "file": f"takes/{dst.name}", "label": label, "episode": episode, "note": note,
             "rank": rank or 0, "date": date or datetime.datetime.fromtimestamp(f.stat().st_mtime).astimezone().isoformat(timespec="seconds"),
             "added": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
             "model": body.get("model_id"), "duration_s": duration, "lufs": lufs,
             "mood_sequence": [m for i, m in enumerate(moods) if i == 0 or m != moods[i - 1]],
             "prompt_hash": request_hash(body) if body else None, "request_hash": request_hash(body) if body else None,
             "style_hash": style_hash(body) if body else None, "song_id": (meta or {}).get("song_id"),
             "credits": (meta or {}).get("characters_used"), "chunks": chunks}
    idx["takes"].append(entry)
    _save_index(idx, root)
    return entry


def runs_of(take):
    """Consecutive chunks of one mood merged into a run: {take, file, mood, t0, t1, bpm, rank, lufs, style}."""
    runs = []
    for c in take.get("chunks") or []:
        if runs and runs[-1]["mood"] == c["mood"]:
            runs[-1]["t1"] = c["t1"]
            runs[-1]["bpm"] = runs[-1]["bpm"] or c.get("bpm")
        else:
            runs.append({"take": take["id"], "file": take["file"], "mood": c["mood"], "t0": c["t0"], "t1": c["t1"],
                         "bpm": c.get("bpm"), "rank": take.get("rank", 0), "lufs": take.get("lufs"),
                         "style": take.get("style_hash")})
    return runs


def reuse_assign(p, takes, o=None, style=None, xfade=1.0, preroll=3.0):
    """Pure: pieces covering the plan's sections from cached runs of the same mood (else a neighbouring one, see
    MOOD_NEAR). Preference: higher rank, no loop needed, not used yet, same style hash, longer. A section is trimmed
    from a bar-aligned point of its run; a run shorter than the section is looped in whole bars (bar = 4 beats at the
    run's bpm, 4 s when unknown) with `xfade` s crossfades on the bar line; a run at most `preroll` s too short starts
    that much early instead (inside the take's own transition into it). A mood that returns continues its run."""
    o = merge(DEFAULTS, o or {})
    runs = [r for t in takes for r in runs_of(t) if r["mood"] != "none"]
    used, pieces, missing, notes = {}, [], [], []
    secs = p["sections"]
    for i, s in enumerate(secs):
        if s["mood"] == "none":
            continue
        nxt = secs[i + 1] if i + 1 < len(secs) else None
        t0, t1 = s["fade"][0], (nxt["start"] if nxt else p["total"])
        fade_out = [nxt["fade"][0], nxt["start"]] if nxt else [max(t0, p["total"] - o["fade_out"]), p["total"]]
        need = t1 - t0
        cand = None
        for k, mood in enumerate([s["mood"]] + MOOD_NEAR.get(s["mood"], [])):
            rs = [r for r in runs if r["mood"] == mood]
            if rs:
                cand = min(rs, key=lambda r: (-r["rank"], (r["t1"] - r["t0"]) + min(preroll, r["t0"]) < need,
                                              (r["take"], r["t0"]) in used,
                                              style is not None and r["style"] != style, -(r["t1"] - r["t0"]),
                                              r["take"], r["t0"]))
                if k:
                    notes.append(f"{s['line'] or 'start'}: no cached {s['mood']} run, borrowed {mood}")
                break
        if not cand:
            missing.append({"mood": s["mood"], "t0": t0, "t1": t1, "line": s["line"]})
            continue
        r, key = cand, (cand["take"], cand["t0"])
        bar = 240.0 / r["bpm"] if r.get("bpm") else 4.0
        length = r["t1"] - r["t0"]
        off = r["t0"] + math.ceil(used.get(key, 0.0) / bar - 1e-6) * bar
        base = {"file": r["file"], "mood": s["mood"], "source": r["take"], "run": [r["t0"], r["t1"]], "loop": False}
        if r["t1"] - off >= need:          # continue the run where it stopped
            pieces.append(dict(base, offset=round(off, 3), t0=t0, t1=t1, fade_in=s["fade"], fade_out=fade_out))
            used[key] = off - r["t0"] + need
        elif length >= need:               # restart the run
            pieces.append(dict(base, offset=r["t0"], t0=t0, t1=t1, fade_in=s["fade"], fade_out=fade_out))
            used[key] = need
        elif need - length <= min(preroll, r["t0"]):   # nearly long enough: start a little early, inside the
            pieces.append(dict(base, offset=round(r["t0"] - (need - length), 3), t0=t0, t1=t1,   # take's own
                               fade_in=s["fade"], fade_out=fade_out))                            # transition
            used[key] = length
        else:                              # loop whole bars of the run
            n = math.floor((length - xfade) / bar)
            lp = n * bar if n >= 1 else max(1.0, length - xfade)
            k, a = 0, t0
            while a < t1 - 1e-6:
                b = min(t1, a + lp + xfade)
                last = b >= t1 - 1e-6
                pieces.append(dict(base, offset=r["t0"], t0=round(a, 3), t1=round(b, 3), loop=True,
                                   fade_in=s["fade"] if k == 0 else [round(a, 3), round(a + xfade, 3)],
                                   fade_out=fade_out if last else [round(a + lp, 3), round(b, 3)]))
                if last:
                    break
                a, k = a + lp, k + 1
            used[key] = length
            notes.append(f"{s['line'] or 'start'}: {s['mood']} looped ({lp:.1f} s = {max(n, 1)} bar(s) of the "
                         f"{length:.1f} s run)")
    return {"pieces": pieces, "missing": missing, "notes": notes}


def reuse_pieces(ep, p, o, target, write=True):
    idx = load_index()
    style = style_hash(request_body(requests_for(p, o)[0], o)) if p["sections"] else None
    res = reuse_assign(p, idx["takes"], o, style=style)
    lufs = {t["id"]: t.get("lufs") for t in idx["takes"]}
    for pc in res["pieces"]:
        pc["file"] = str(CACHE / pc["file"])
        if not pathlib.Path(pc["file"]).exists():
            raise RuntimeError(f"cached take missing: {pc['file']} (private cache {CACHE})")
        pc["gain_db"] = round(target - lufs_of(pc["file"], lufs.get(pc["source"])), 2)
    if write:
        save_json(ep.p("music/reuse_plan.json"), {"cache": str(CACHE), **res})
    if not res["pieces"]:
        raise RuntimeError(f"the private music cache ({CACHE}) has nothing for this plan's moods")
    for m in res["missing"]:
        print(f"  music warning: no cached music for {m['mood']} {m['t0']:.1f}–{m['t1']:.1f} s (silent there)", file=sys.stderr)
    return res["pieces"]


def cache_cmd(ep, args):
    sub = args[0] if args else "list"
    if sub == "list":
        idx = load_index()
        print(f"private music cache: {CACHE} (never commit; ElevenLabs' terms forbid redistributing it as a library)")
        for t in idx["takes"]:
            print(f"  {t['id']}  {t.get('label') or '':24} {t.get('model') or '':9} {t.get('duration_s') or 0:7.1f} s  "
                  f"rank {t.get('rank', 0):+d}  {' > '.join(t.get('mood_sequence') or [])}  {t.get('date', '')[:10]}"
                  f"{'  (' + t['note'] + ')' if t.get('note') else ''}")
        return
    if sub != "add" or ep is None:
        sys.exit(__doc__)
    files = [pathlib.Path(a) for a in args[1:] if a.endswith(".mp3")]
    if not files:
        files = sorted(ep.p("music/cache").glob("*.mp3"), key=lambda q: q.stat().st_mtime)
    rank = _opt(args, "--rank")
    for f in files:
        meta = f.with_suffix(".json")
        e = cache_add(f, json.loads(meta.read_text()) if meta.exists() else None, episode=ep.id,
                      label=_opt(args, "--label"), note=_opt(args, "--note"), rank=int(rank) if rank is not None else None)
        print(f"  cached {f.name} -> {CACHE / e['file']}  ({' > '.join(e['mood_sequence'])})")


# ---------- mix ----------

def lufs_of(f, known=None):
    if known is not None:
        return float(known)
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(f), "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", err)
    return float(m[-1]) if m else -20.0


def _env(shapes):
    """Piecewise-linear trapezoids [(a, b, c, d)] (0 at a, 1 from b to c, 0 at d) as one ffmpeg expression."""
    terms = []
    for a, b, c, d in shapes:
        terms.append(f"if(between(t,{a:.3f},{b:.3f}),(t-{a:.3f})/{max(b - a, 1e-3):.3f},"
                     f"if(between(t,{b:.3f},{c:.3f}),1,if(between(t,{c:.3f},{d:.3f}),({d:.3f}-t)/{max(d - c, 1e-3):.3f},0)))")
    return "+".join(terms) or "0"


def graph(p, pieces, o, total, stems=False):
    """filter_complex: input 0 = voice, inputs 1.. = pieces. Ends in [mix] (and [raw]/[duck] stems when asked)."""
    d = o["duck"]
    g = [f"[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asplit={3 if stems else 2}[vo][key]{'[vstem]' if stems else ''}"]
    for i, pc in enumerate(pieces, 1):
        dur = pc["t1"] - pc["t0"]
        fi = max(0.01, pc["fade_in"][1] - pc["fade_in"][0])
        fo_st, fo_d = pc["fade_out"][0] - pc["t0"], max(0.01, pc["fade_out"][1] - pc["fade_out"][0])
        ms = int(round(pc["t0"] * 1000))
        g.append(f"[{i}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
                 f"atrim=start={pc['offset']:.3f}:duration={dur:.3f},asetpts=PTS-STARTPTS,volume={pc['gain_db']:.2f}dB,"
                 f"afade=t=in:st=0:d={fi:.3f}:curve=qsin,afade=t=out:st={fo_st:.3f}:d={fo_d:.3f}:curve=qsin,"
                 f"adelay={ms}:all=1[p{i}]")
    if pieces:
        g.append("".join(f"[p{i}]" for i in range(1, len(pieces) + 1)) +
                 f"amix=inputs={len(pieces)}:normalize=0:duration=longest,apad,atrim=0:{total:.3f}[bed0]")
    else:
        g.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{total:.3f}[bed0]")
    # "none" sections of a composed track are muted (library mode has no piece there)
    mutes = [(s["fade"][0], s["fade"][1], (nx["fade"][0] if nx else total), (nx["start"] if nx else total))
             for s, nx in zip(p["sections"], p["sections"][1:] + [None]) if s["mood"] == "none"]
    g.append(f"[bed0]volume='max(0,1-({_env(mutes)}))':eval=frame[bed]" if mutes else "[bed0]anull[bed]")
    g.append(f"[bed]{'asplit=2[bedk][rawstem];[bedk]' if stems else ''}[key]sidechaincompress=threshold={d['threshold']}:ratio={d['ratio']}:"
             f"attack={d['attack']}:release={d['release']}:knee={d['knee']}:makeup=1:mix={duck_mix(o)}[ducked]")
    acc = [(a["t"] - 0.4, a["t"] + 0.3, a["t"] + 0.6, a["t"] + 3.0) for a in p["accents"]]
    gain = 10 ** (o["accent_db"] / 20) - 1
    g.append(f"[ducked]volume='1+{gain:.4f}*min(1,{_env(acc)})':eval=frame[bedf]" if acc else "[ducked]anull[bedf]")
    if stems:
        g.append("[bedf]asplit=2[bedm][duckstem]")
    g.append(f"[vo][{'bedm' if stems else 'bedf'}]amix=inputs=2:normalize=0:duration=first[mix]")
    return ";".join(g)


def _inputs(ep, pieces):
    args = ["-i", str(ep.p("vo/voice.wav"))]
    for pc in pieces:
        args += (["-stream_loop", "-1"] if pc["loop"] else []) + ["-i", pc["file"]]
    return args


def _loudnorm(o, measured=None):
    base = f"loudnorm=I={o['loudness']}:TP={o['true_peak']}:LRA={o['lra']}:print_format=json"
    if not measured:
        return base
    return (base + f":measured_I={measured['input_i']}:measured_TP={measured['input_tp']}:measured_LRA={measured['input_lra']}"
            f":measured_thresh={measured['input_thresh']}:offset={measured['target_offset']}:linear=true")


def _limiter(o, m, margin=0.7):
    """'' when a linear (static) loudnorm fits under the true-peak ceiling; else an alimiter (lookahead peak limiter
    on the mix) holding the peaks `margin` dB below where the static gain would put them over the ceiling."""
    gain = o["loudness"] - float(m["input_i"])
    if float(m["input_tp"]) + gain <= o["true_peak"]:
        return ""
    lim = 10 ** ((o["true_peak"] - gain - margin) / 20)
    return f"alimiter=limit={min(1.0, max(0.0625, lim)):.4f}:level=disabled:attack=5:release=60,"


def _ln_json(stderr):
    m = re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", stderr)
    if not m:
        raise RuntimeError("loudnorm printed no measurement")
    return json.loads(m[-1])


def ebur128(f):
    err = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(f), "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    summ = err[err.rfind("Summary:"):]
    i = re.search(r"I:\s+(-?[\d.]+) LUFS", summ)
    tp = re.search(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summ)
    return float(i.group(1)) if i else None, float(tp.group(1)) if tp else None


def _settings_hash(o):
    return hashlib.sha256(json.dumps(o, sort_keys=True).encode()).hexdigest()[:16]


def resolve_pieces(ep, p, o, target=None):
    """Bed pieces for the mode. Never calls the music API (only `generate` does)."""
    if o["mode"] == "none":
        return []
    target = bed_target(ep, o) if target is None else target
    if o["mode"] == "library":
        return library_pieces(ep, p, o, target)
    if o["mode"] == "elevenlabs":
        return eleven_pieces(ep, p, o, target)
    return reuse_pieces(ep, p, o, target)


def build_mix(ep, force=False, quiet=False):
    """music/mix.wav for the current plan; reused while its receipt is fresh and the settings are unchanged."""
    o = settings(ep)
    p = plan(ep, quiet=True)
    for w in p["warnings"]:
        print("  music warning:", w, file=sys.stderr)
    out = ep.p("music/mix.wav")
    rp = receipts.receipt_path(out)
    if not force and out.exists() and rp.exists() and not receipts.problems(out):
        info = json.loads(rp.read_text()).get("info", {})
        if info.get("settings") == _settings_hash(o):
            return out, info
    target = bed_target(ep, o)
    pieces = resolve_pieces(ep, p, o, target)
    total = p["total"]
    deps = [ep.p("vo/voice.wav"), ep.p("music/music_plan.json")] + [pathlib.Path(pc["file"]) for pc in pieces]
    before = receipts.hash_inputs(deps, out.parent)
    fc = graph(p, pieces, o, total)
    base = ["ffmpeg", "-hide_banner", "-nostats", "-y", *_inputs(ep, pieces), "-filter_complex"]
    r1 = subprocess.run(base + [fc + ";[mix]" + _loudnorm(o) + "[out]", "-map", "[out]", "-f", "null", "-"],
                        capture_output=True, text=True)
    if r1.returncode:
        raise RuntimeError("mix pass 1 failed: " + r1.stderr.strip()[-600:])
    m1 = _ln_json(r1.stderr)
    pre = _limiter(o, m1)
    if pre:  # the static gain would overshoot the true-peak ceiling: limit the peaks first, so loudnorm stays linear
        r1 = subprocess.run(base + [fc + ";[mix]" + pre + _loudnorm(o) + "[out]", "-map", "[out]", "-f", "null", "-"],
                            capture_output=True, text=True)
        if r1.returncode:
            raise RuntimeError("mix pass 1b failed: " + r1.stderr.strip()[-600:])
        m1 = _ln_json(r1.stderr)
    staged = out.with_name(f".mix.{os.getpid()}.wav")
    r2 = subprocess.run(base + [fc + ";[mix]" + pre + _loudnorm(o, m1) + ",aresample=48000[out]", "-map", "[out]",
                                "-t", f"{total:.3f}", "-c:a", "pcm_s24le", "-ar", "48000", str(staged)], capture_output=True, text=True)
    if r2.returncode:
        staged.unlink(missing_ok=True)
        raise RuntimeError("mix pass 2 failed: " + r2.stderr.strip()[-600:])
    m2 = _ln_json(r2.stderr)
    lufs, tp = ebur128(staged)
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(staged)]))
    if abs(dur - total) > 0.1:
        staged.unlink(missing_ok=True)
        raise RuntimeError(f"mix is {dur:.2f} s, timing.json {total:.2f} s")
    os.replace(staged, out)
    info = {"mode": o["mode"], "settings": _settings_hash(o), "lufs": lufs, "true_peak": tp, "bed_target_lufs": target,
            "loudnorm": {"type": m2.get("normalization_type"), "gain_db": m2.get("target_offset")},
            "pieces": [{k: pc[k] for k in ("source", "mood", "t0", "t1", "offset", "gain_db", "loop")} for pc in pieces],
            "changed_mid_render": receipts.changed_inputs(before, deps, out.parent)}
    receipts.write_receipt(out, before, info)
    if not quiet:
        print(f"wrote {out}: {lufs} LUFS integrated, true peak {tp} dBTP ({m2.get('normalization_type')} loudnorm)")
    if tp is not None and tp > o["true_peak"] + 0.1:
        print(f"  music warning: true peak {tp} dBTP above {o['true_peak']}", file=sys.stderr)
    return out, info


def audio_for(ep, no_music=False, purpose="master"):
    """(audio file, music info or None) for the master/Shorts. Never raises: music problems fall back to the voice."""
    voice = ep.p("vo/voice.wav")
    try:
        o = settings(ep)
        if no_music or o["mode"] == "none" or (purpose == "shorts" and not o["shorts"]):
            return voice, None
        return build_mix(ep, quiet=True)  # never generates: a missing take falls back to the voice
    except (Exception, SystemExit) as e:  # noqa: BLE001 - music must never block a render
        print(f"warning: music skipped, voice only ({str(e).strip()[:300]})", file=sys.stderr)
        return voice, None


# ---------- measure ----------

def _pcm(f, rate=8000):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(f), "-ac", "1", "-ar", str(rate), "-f", "s16le", "-"],
                         capture_output=True, check=True).stdout
    a = array.array("h")
    a.frombytes(raw)
    return a


def _db(a, windows, rate=8000):
    acc = n = 0
    for s, e in windows:
        seg = a[int(s * rate):int(e * rate)]
        acc += sum(x * x for x in seg)
        n += len(seg)
    return 10 * math.log10(acc / n / 32768 ** 2) if n and acc else float("-inf")


def measure(ep):
    o = settings(ep)
    if o["mode"] == "none":
        sys.exit("music is off (episode.json music: none)")
    out, info = build_mix(ep, quiet=True)
    p = json.loads(ep.p("music/music_plan.json").read_text())
    pieces = resolve_pieces(ep, p, o, info.get("bed_target_lufs"))
    total = p["total"]
    tmp = pathlib.Path(ep.cfg["render"]["tmpdir"]) / f"music-measure-{os.getpid()}"
    tmp.mkdir(parents=True, exist_ok=True)
    fc = graph(p, pieces, o, total, stems=True)
    files = {k: tmp / f"{k}.wav" for k in ("vstem", "rawstem", "duckstem")}
    cmd = ["ffmpeg", "-hide_banner", "-v", "error", "-y", *_inputs(ep, pieces), "-filter_complex", fc + ";[mix]anullsink"]
    for k, f in files.items():
        cmd += ["-map", f"[{k}]", str(f)]   # no -t: the graph is already trimmed (and -t per output can hang ffmpeg)
    subprocess.run(cmd, check=True)
    a = {k: _pcm(f) for k, f in files.items()}
    lines = [l for c in ep.timing["chapters"] for l in c["lines"]]
    speech = [(l["start"] + 0.3, l["end"] - 0.1) for l in lines if l["end"] - l["start"] > 0.6]
    gaps, prev = [], 0.0
    for l in lines + [{"start": total, "end": total}]:
        a0, a1 = prev + 0.25, l["start"] - 0.05   # pauses between lines (the bed comes back up over `release`)
        if a1 - a0 >= 0.25:
            gaps.append((a0, a1))
        prev = l["end"]
    raw_s, duck_s = _db(a["rawstem"], speech), _db(a["duckstem"], speech)
    raw_g, duck_g = _db(a["rawstem"], gaps), _db(a["duckstem"], gaps)
    voice_s = _db(a["vstem"], speech)
    for f in files.values():
        f.unlink(missing_ok=True)
    tmp.rmdir()
    res = {"integrated_lufs": info.get("lufs"), "true_peak_dbtp": info.get("true_peak"),
           "ducking_depth_db": round(raw_s - duck_s, 1), "bed_in_gaps_vs_raw_db": round(duck_g - raw_g, 1),
           "bed_under_voice_db": round(duck_s - voice_s, 1), "bed_gaps_vs_speech_db": round(duck_g - duck_s, 1),
           "speech_windows": len(speech), "gap_windows": len(gaps)}
    print(json.dumps(res, indent=1))
    return res


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "cache":   # cache list needs no episode
        return cache_cmd(None, sys.argv[2:])
    ep, args = episode_from_argv()
    cmd = args[0] if args else "plan"
    if cmd == "plan":
        plan(ep)
    elif cmd == "fetch":
        o = settings(ep)
        lib = library(o)
        moods = {s["mood"] for s in compute_plan(ep.script, ep.timing, o)["sections"]} if ep.p("timing.json").exists() else None
        for t in lib:
            if moods is None or t["mood"] in moods or t["id"] in (o.get("tracks") or {}).values():
                fetch_track(t)
        print("library cache:", CACHE)
    elif cmd == "generate":
        o = settings(ep)
        o["mode"] = "elevenlabs"
        generate(ep, o, plan(ep, quiet=True), args[1:])
    elif cmd == "reuse":
        o = settings(ep)
        p = plan(ep, quiet=True)
        style = style_hash(request_body(requests_for(p, o)[0], o)) if p["sections"] else None
        res = reuse_assign(p, load_index()["takes"], o, style=style)
        for pc in res["pieces"]:
            print(f"  {pc['t0']:8.2f}–{pc['t1']:8.2f}  {pc['mood']:11} from {pc['source']} @ {pc['offset']:.2f} s"
                  f"{'  (loop)' if pc['loop'] else ''}")
        for m in res["missing"]:
            print(f"  {m['t0']:8.2f}–{m['t1']:8.2f}  {m['mood']:11} NOT COVERED (generate, or add takes to the cache)")
        for n in res["notes"]:
            print("  note:", n)
        if "--dry-run" not in args:
            save_json(ep.p("music/reuse_plan.json"), {"cache": str(CACHE), **res})
            print("wrote", ep.p("music/reuse_plan.json"), '(mixed when episode.json music.mode is "reuse"; costs nothing)')
    elif cmd == "cache":
        cache_cmd(ep, args[1:])
    elif cmd == "mix":
        o = settings(ep)
        if o["mode"] == "none":
            sys.exit('music is off: set "music": "library", "elevenlabs" or "reuse" in episode.json')
        build_mix(ep, force="--force" in args)
    elif cmd == "measure":
        measure(ep)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, LookupError, ValueError) as e:
        sys.exit(f"music: {e}")
