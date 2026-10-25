"""Spoken text -> burned-in caption chunks for the engine: engine/app/src/captions_chunks.json.

  python3 tools/make_captions.py <episode>

Output: [[ [ {s, n, br} ... ] (chunk) ... ] (line) ...] in timing.json order. A token shows `s` for `n` spoken words
(a number spelled in words becomes digits, a phonetic acronym becomes the acronym), `br` = line break before it.
Language rules (numbers, acronyms) come from episode.json "captions": numbers = "none" | "<lang code>" (tools/lang/),
acronyms = {spoken: shown}; fixes = [[[shown tokens...], replacement], ...] for phrases the converter cannot read.
Lines whose shown text differs from the spoken words are printed for review.
"""
import importlib, pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import episode_from_argv, save_json  # noqa: E402

PUNCT = re.compile(r"^([¿¡(«\"']*)(.*?)([.,;:?!…)»\"']*|\.\.\.)$")


def split(w):
    m = PUNCT.match(w)
    return m.group(1), m.group(2), m.group(3)


def convert_plain(words, acronyms):
    out = []
    for w in words:
        pre, core, post = split(w)
        out.append([pre + acronyms[core.lower()] + post if core.lower() in acronyms else w, 1])
    return out


def chunk(tokens, maxc=78, linec=44):
    """tokens: [[shown, n]] -> chunks of tokens, broken at sentence ends or before maxc characters; a chunk longer than
    linec gets one line break near its middle, preferring a phrase boundary."""
    chunks, cur = [], []
    L = lambda ts: len(" ".join(t[0] for t in ts))
    for t in tokens:
        if cur and L(cur + [t]) > maxc:
            chunks.append(cur)
            cur = []
        cur.append(t)
        if re.search(r"[.?!…:]$", t[0]) and L(cur) > 18:
            chunks.append(cur)
            cur = []
    if cur:
        if chunks and L(chunks[-1] + cur) <= maxc and L(cur) < 14:
            chunks[-1] += cur
        else:
            chunks.append(cur)
    res = []
    for ch in chunks:
        toks = [{"s": t[0], "n": t[1], "br": False} for t in ch]
        if L(ch) > linec and len(ch) > 1:
            half = L(ch) / 2
            best, bd = 1, 1e9
            for k in range(1, len(ch)):
                d = abs(L(ch[:k]) - half) - (8 if re.search(r"[,;:]$", ch[k - 1][0]) else 0)
                if d < bd:
                    best, bd = k, d
            toks[best]["br"] = True
        res.append(toks)
    return res


def apply_fixes(conv, fixes):
    """Replace runs of shown tokens (punctuation-insensitive) by one token, before chunking."""
    i = 0
    while i < len(conv):
        for words, new in fixes:
            ss = [t[0].rstrip(",.") for t in conv[i:i + len(words)]]
            if ss == words:
                last = conv[i + len(words) - 1][0]
                conv[i:i + len(words)] = [[new + last[len(last.rstrip(",.")):], sum(t[1] for t in conv[i:i + len(words)])]]
                break
        i += 1
    return conv


def main():
    ep, _ = episode_from_argv()
    cc = ep.cfg["captions"]
    acr = {k.lower(): v for k, v in cc["acronyms"].items()}
    conv_fn = convert_plain if cc["numbers"] in (None, "none") else importlib.import_module(f"lang.{cc['numbers']}").convert
    out = []
    flat = ep.flat_lines()
    for ln in flat:
        words = [w["w"] for w in ln["words"]]
        conv = apply_fixes(conv_fn(words, acr), cc["fixes"])
        assert sum(n for _, n in conv) == len(words), ln["id"]
        out.append(chunk(conv, cc["max_chars"], cc["line_chars"]))
    dst = ep.app / "src/captions_chunks.json"
    save_json(dst, out, indent=None)
    print("wrote", dst, len(out), "lines")
    for l, chs in zip(flat, out):
        shown = [t["s"] for c in chs for t in c]
        if shown != [w["w"] for w in l["words"]]:
            print(" ", l["id"], " || ".join(" ".join(("/ " if t["br"] else "") + t["s"] for t in c) for c in chs)[:300])


if __name__ == "__main__":
    main()
