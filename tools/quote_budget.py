#!/usr/bin/env python3
"""Quote budget for translation panels. Long statistical panels squeezed the mechanism plates beside them and could
not be read in their hold, so the budget is checked before voicing and again after.

Rules (docs/SCRIPT_BRIEF_TEMPLATE.md, "Quote budget"):
  - the panel text (tr_panel if given, else tr) has at most 30 words and at most 3 numbers, bracketed glosses counted;
  - a quote shown inside a Short with a panel over 20 words needs a tr_short of at most 15 words;
  - --timing (after voicing): 2.5 s of page + the panel's hold, max(4, 0.33 s x words + 1.5 s), fits inside the
    quote's own narration line(s), with 0.5 s of slack.

  python3 tools/quote_budget.py <episode> [--timing]        (or: tools/nx quote-budget <episode> [--timing])
      checks every engine/app/public/papers/**/quotes.json of the episode; a quote's narration lines come from its
      "lines_vo" field (["C3-L4"]), or from <episode>/quote_lines.json ({"<paper key>/<quote id>": ["C3-L4"]}).
  import quote_budget; quote_budget.check(...)               the same rules for a quote-building script

The engine applies the same budget at draw time: `paperBeat` (scenes/_papers.ts) logs "[paperBeat] …", which qa
reports as a `cue` error. Exit 1 on any violation, one line each.
"""
import json, pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import Episode  # noqa: E402

MAX_WORDS, MAX_NUMS, SHORT_PANEL, MAX_SHORT_WORDS, PAGE_S = 30, 3, 20, 15, 2.5

words = lambda s: len(s.split())
numbers = lambda s: len(re.findall(r"\d+(?:[.,]\d+)*", s))
hold_for = lambda s: max(4.0, 0.33 * words(s) + 1.5)


def short_lines(ep_dir):
    """Line ids inside a Short (script.json / timing.json `short` markers) -> Short id."""
    src = next((ep_dir / f for f in ("timing.json", "script.json") if (ep_dir / f).exists()), None)
    out = {}
    if not src:
        return out
    for c in json.load(open(src)).get("chapters", []):
        cur = None
        for l in c.get("lines", []):
            s = l.get("short") or {}
            if s and s.get("edge") in ("start", None):
                cur = s["id"]
            if cur:
                out[l["id"]] = cur
            if s and s.get("edge") in ("end", None):
                cur = None
    return out


def check(name, tr, lines=(), tr_panel=None, tr_short=None, shorts=None, timing=None):
    """Violations (strings) of one quote. lines: its narration line ids; timing: {line id: (start, end)}."""
    bad = []
    panel = tr_panel or tr
    n, m = words(panel), numbers(panel)
    if n > MAX_WORDS:
        bad.append(f"{name}: panel {n} words > {MAX_WORDS}: add tr_panel (a faithful excerpt with …)")
    if m > MAX_NUMS:
        bad.append(f"{name}: panel {m} numbers > {MAX_NUMS}: the numbers go on the plate")
    in_short = [l for l in lines if shorts and l in shorts]
    if in_short and n > SHORT_PANEL:
        if not tr_short:
            bad.append(f"{name}: in Short {shorts[in_short[0]]} with a {n}-word panel: add tr_short (≤ {MAX_SHORT_WORDS} words) or move the Short")
        elif words(tr_short) > MAX_SHORT_WORDS:
            bad.append(f"{name}: tr_short {words(tr_short)} words > {MAX_SHORT_WORDS}")
    if timing is not None and lines:
        have = [timing[l] for l in lines if l in timing]
        if len(have) != len(lines):
            bad.append(f"{name}: lines {','.join(l for l in lines if l not in timing)} not in timing.json")
        elif have:
            win = max(e for _, e in have) - min(s for s, _ in have)
            need = PAGE_S + hold_for(tr_short if in_short and tr_short else panel)
            if need > win + 0.5:
                bad.append(f"{name}: page {PAGE_S}s + hold {need - PAGE_S:.1f}s = {need:.1f}s > its line window {win:.1f}s ({','.join(lines)}): shorten the panel")
    return bad


def timing_map(ep_dir):
    t = json.load(open(ep_dir / "timing.json"))
    return {l["id"]: (l["start"], l["end"]) for c in t["chapters"] for l in c["lines"]}


def main():
    a = sys.argv[1:]
    if not a or a[0].startswith("-"):
        sys.exit(__doc__)
    E = Episode(a[0])
    files = sorted((E.app / "public/papers").glob("**/quotes.json"))
    if not files:
        print("quote budget: no public/papers/**/quotes.json (no paper moments)")
        return
    lines_of = json.load(open(E.p("quote_lines.json"))) if E.p("quote_lines.json").exists() else {}
    shorts = short_lines(E.dir)
    timing = timing_map(E.dir) if "--timing" in a else None
    bad, n = [], 0
    for qf in files:
        for paper, e in json.load(open(qf)).items():
            for q in (e or {}).get("quotes", []):
                tr = q.get("tr") or q.get("es")
                if not tr:
                    continue
                n += 1
                key = f"{paper}/{q['id']}"
                bad += check(key, tr, q.get("lines_vo") or lines_of.get(key, []), q.get("tr_panel") or q.get("es_panel"),
                             q.get("tr_short") or q.get("es_short"), shorts, timing)
    for b in bad:
        print(b)
    print(f"quote budget: {n} panels, {len(bad)} violation(s)")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
