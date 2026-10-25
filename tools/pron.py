"""Pronunciation table: how the narrator says each acronym or tricky token, kept out of the script text.

The script stays canonical ("SQL", "GPU"): the fact check, qa cues (`q.w('C3-L2', 'SQL')`) and the captions all match
it. `make_vo.py` applies the table only to the text it sends to the TTS (`spoken()`), then maps the aligned words back
to the canonical tokens (`canonical_words()`), so timing.json, lyrics.json and the captions show "SQL".

The table lives in episode.json, `voice.pronounce`: {"SQL": "sequel", "GPU": "gee-pee-you"}. Every value must be ONE
token (hyphens, no spaces), so each canonical word maps to exactly one spoken word. Keep one table per series (copy it
into each episode.json) rather than respelling words in a script.

  python3 tools/pron.py <episode> "Some line with SQL in it."     prints the spoken form and the round trip
"""
import re
import sys

_TOK = re.compile(r"^([¿¡(«\"'“]*)(.*?)([.,;:?!…)»\"'”]*)$")


def check(table):
    bad = [k for k, v in table.items() if not v or any(ch.isspace() for ch in v)]
    if bad:
        sys.exit(f"voice.pronounce: values must be one token (no spaces): {', '.join(bad)}")
    return table


def _split(tok):
    m = _TOK.match(tok)
    return m.group(1), m.group(2), m.group(3)


def spoken(text, table):
    """The text the TTS reads: each canonical token replaced by its spoken spelling (punctuation kept)."""
    if not table:
        return text
    out = []
    for tok in text.split():
        a, core, b = _split(tok)
        out.append(a + table[core] + b if core in table else tok)
    return " ".join(out)


def canonical_words(text, ws, table):
    """Aligned words of the spoken text -> the same timings with canonical tokens. ws: [{w, s, e}].
    One-to-one when the TTS kept the word count; otherwise each spoken word is mapped back on its own."""
    if not table:
        return ws
    canon = text.split()
    if len(canon) == len(ws):
        return [dict(w, w=c) if c != w["w"] else w for c, w in zip(canon, ws)]
    back = {v: k for k, v in table.items()}
    out = []
    for w in ws:
        a, core, b = _split(w["w"])
        out.append(dict(w, w=a + back[core] + b) if core in back else w)
    return out


if __name__ == "__main__":
    import pathlib
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
    from common import Episode  # noqa: E402
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    table = check(Episode(sys.argv[1]).cfg["voice"]["pronounce"])
    t = sys.argv[2]
    s = spoken(t, table)
    print(s)
    ws = [{"w": x, "s": i, "e": i + 1} for i, x in enumerate(s.split())]
    print(" ".join(w["w"] for w in canonical_words(t, ws, table)))
