"""Validate <episode>/script.json and write the human-readable <episode>/SCRIPT.md from it (so the two never drift).

  python3 tools/check_script.py <episode> [--wpm 165]

script.json: {title, chapters: [{id: "C0", title, lines: [{id: "C0-L1", text, refs: [], visual: "", short?, hold?,
display?}]}]}. Line ids are explicit and stable ("C3-L5", "C3-L5b"): inserting or deleting a line never renumbers the
others, and scene cues (q.w('C3-L5', 'word')) keep pointing at the right sentence.
Voices: an optional "voice" role per line ("NARRATOR", "GUEST"); when episode.json has voice.voices, every role used
must be listed there (or line-less roles fall back to voice.default_role). An optional "typed" field (true = the line's
text, or a string) marks a line whose words are also typed on screen; scenes read it with q.typed(id, t).
A SCRIPT.md that tools/check_script.py did not write (no "Generated from script.json by tools/check_script.py") is
left alone; the generated view then goes to SCRIPT.generated.md.
Music: an optional "mood" (wonder | struggle | tension | hope | resolution | none | insight) carries forward until
it changes; "mood_cue" names the word the turn lands on (tools/music.py checks section lengths when it plans).
Shorts: a `short` marker {id: "S01", hook_title, edge: "start"|"end"} on the first and the last line of each unit;
both in the same chapter, same hook_title (<= shorts.max_hook_chars).
Exits non-zero on an error; prints a duration estimate per chapter.
"""
import pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import episode_from_argv, opt  # noqa: E402
from music import MOODS  # noqa: E402


def main():
    ep, args = episode_from_argv()
    S = ep.script
    wpm = float(opt(args, "--wpm", "165"))
    v = ep.cfg["voice"]
    errs, ids = [], set()
    for c in S["chapters"]:
        if not re.fullmatch(r"C\d+", c["id"]):
            errs.append(f"chapter id {c['id']!r}: use C<n>")
        if not c.get("lines"):
            errs.append(f"{c['id']}: no lines")
        for l in c.get("lines", []):
            if not re.fullmatch(rf"{c['id']}-L\w+", l.get("id", "")):
                errs.append(f"{c['id']}: line id {l.get('id')!r} must be {c['id']}-L<n>")
            if l.get("id") in ids:
                errs.append(f"duplicate line id {l['id']}")
            ids.add(l.get("id"))
            if not l.get("text", "").strip():
                errs.append(f"{l.get('id')}: empty text")
            role = l.get("voice") or v.get("default_role")
            if v.get("voices") and role and role not in v["voices"]:
                errs.append(f"{l.get('id')}: voice role {role!r} is not in episode.json voice.voices")
            if "typed" in l and not isinstance(l["typed"], (bool, str)):
                errs.append(f"{l.get('id')}: typed must be true/false or a string")
            if l.get("mood") and l["mood"] not in MOODS:  # story music (tools/music.py, docs/STORY_MUSIC.md)
                errs.append(f"{l.get('id')}: mood {l['mood']!r} is not one of {', '.join(MOODS)}")
            if l.get("mood_cue") and not any(re.sub(r"[^\w'’-]", "", w.lower()) == l["mood_cue"].lower() for w in l.get("text", "").split()):
                errs.append(f"{l.get('id')}: mood_cue {l['mood_cue']!r} is not a word of the line")
    shorts = {}
    for c in S["chapters"]:
        for i, l in enumerate(c.get("lines", [])):
            if l.get("short"):
                shorts.setdefault(l["short"]["id"], []).append((c["id"], i, l["short"]))
    maxh = ep.cfg["shorts"]["max_hook_chars"]
    for sid, marks in sorted(shorts.items()):
        (c0, i0, s0), (c1, i1, s1) = marks[0], marks[-1]
        if not (len(marks) == 2 and c0 == c1 and s0.get("edge") == "start" and s1.get("edge") == "end"):
            errs.append(f"short {sid}: needs one start and one end marker in one chapter")
        elif s0.get("hook_title") != s1.get("hook_title") or len(s0.get("hook_title", "")) > maxh:
            errs.append(f"short {sid}: hook_title must match on both markers and be <= {maxh} chars")
    for e in errs:
        print("ERROR", e)
    n = sum(len(c["lines"]) for c in S["chapters"])
    w = sum(len(l["text"].split()) for c in S["chapters"] for l in c["lines"])
    est = w / wpm + (n * v["gap"] + len(S["chapters"]) * v["chapter_gap"]) / 60
    print(f"{n} lines, {w} words, ~{est:.1f} min at {wpm:.0f} wpm")
    for c in S["chapters"]:
        cw = sum(len(l["text"].split()) for l in c["lines"])
        print(f"  {c['id']:4} {len(c['lines']):3} lines {cw:5} words ~{cw / wpm:.1f} min  {c.get('title', '')}")
    md = [f"# {S.get('title', ep.id)}: script for review", "",
          f"{n} lines · {w} words · ~{est:.1f} min. Generated from script.json by tools/check_script.py; edit script.json, "
          "not this file. In brackets: references. ▶ = start/end of a Short.", ""]
    for c in S["chapters"]:
        md += ["", f"## {c['id']} · {c.get('title', '')}", ""]
        for l in c["lines"]:
            mark = ""
            if l.get("short"):
                sh = l["short"]
                mark = f" ▶ {sh['id']} ({sh.get('edge', 'start')}): «{sh.get('hook_title', '')}»"
            refs = f"  `[{', '.join(l.get('refs', []))}]`" if l.get("refs") else ""
            who = f"**{l['voice']}** · " if l.get("voice") else ""
            md.append(f"{l['id'].split('-', 1)[1]}. {who}{l['text']}{refs}{mark}")
            if l.get("visual"):
                md.append(f"   _Visual: {l['visual']}_")
            md.append("")
    if shorts:
        md += ["", "## Shorts", "", "| Short | Lines | Words | Approx. | hook_title |", "|---|---|---|---|---|"]
        for sid, marks in sorted(shorts.items()):
            (c0, i0, s0), (c1, i1, s1) = marks[0], marks[-1]
            lines = next(c for c in S["chapters"] if c["id"] == c0)["lines"][i0:i1 + 1]
            sw = sum(len(l["text"].split()) for l in lines)
            md.append(f"| {sid} | {lines[0]['id']} → {lines[-1]['id']} | {sw} | ~{sw / wpm * 60:.0f} s | {s0.get('hook_title', '')} |")
    out = ep.p("SCRIPT.md")
    if out.exists() and "Generated from script.json by tools/check_script.py" not in out.read_text():
        out = ep.p("SCRIPT.generated.md")  # a hand-written SCRIPT.md is the author's; never overwrite it
    out.write_text("\n".join(md) + "\n")
    print("wrote", out)
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
