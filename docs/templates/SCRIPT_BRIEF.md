# Script brief (series template)

Copy this file to `<ep>/SCRIPT_BRIEF.md` for each episode. Fill §0, keep §1–§6 unless the user changes a rule, and give
the copy to the research and script agents.

**User feedback goes into this template in the same turn it arrives**, not only into memory or a one-off prompt:
subagents never see an agent's memory, and they may see a stale summary of it.

The script is written in two stages. Stage A is a one-page index for the user. Stage B, the full narration, is written
only after the user approves the index, and only for the next episode in production.

---

## 0. Brief echo (the orchestrator fills this; the user sees it at the top of the outline message)

- **User request (verbatim):** "…"
- **Thesis** (one sentence, in the user's terms): …
- **User's examples** (seeds, not scope): …
- **Interpretation check:** if the thesis is broader than the examples, the episode covers the thesis.
- **Pillars**, each tagged `[user]` or `[found]`. **At least half must be `[found]`**, from your own research and not
  from the user's list.
  - [user] …
  - [found] …
- **Out of scope / parked:** one line each, kept in a project-wide parked list.

## 1. Standing preferences (do not override without the user's explicit OK)

The orchestrator checks its own outline and any brief override against this list, line by line, before it sends
anything. A deviation goes to the user as a question; it is never applied silently. Edit the list per series.

- **One thesis per episode.** Several pillars may serve it. What is banned is a *second contrarian front* in the same
  episode. Where a fight isn't this episode's subject, state the mainstream view fairly and move on.
- **Trust comes from mechanisms, not from naming authorities.** Never make an institution, a guideline or a committee
  the subject of a line. Sources live on screen (lower third, paper page). Name a person only when the name carries
  the story.
- **Tone** (`docs/TONE.md`): confident; each chapter opens on a human phenomenon or a reversal of common sense and
  tells the mechanism as a marvel. Honesty concentrated in one chapter. Overcaution is a defect.
- **Audience:** say who watches (age, background, what they already believe) and pick the evidence that matters to
  them. Edge cases that mainly concern a minority get a short box, never an episode.
- **Examples from more than one place or population**, so no single local study becomes the frame.
- **Safety and hard limits** for the subject (if any) are written once, completely, as calm protocol cards, sorted into
  the four buckets of `docs/TONE.md`. Never softened for flow.
- **Visuals:** real references (never procedural anatomy or organisms); one glowing colour for the protagonist; type
  readable on a TV; real paper pages with a faithful translation panel where the language differs; mechanistic,
  didactic animation (one dial, one gate, things that move for a reason).
- **Shorts:** about 6–8 per episode, 30–60 s each, each self-contained. Every line inside a Short keeps all its text
  inside x 420–1500.
- **Length:** about 12–15 min, which is about 2,100–2,500 words at ~175 words/min plus pauses, in about 9–12
  chapters.
- **Language and voice:** one narrator; name the language and the pace.

## 2. Evidence rules

- **Never invent a citation, identifier or number.** Check DOIs once, at the end, with the shared cache:
  `tools/nx doi check <file-or-DOIs>`. It verifies only the misses and prints one summary line. Record failures in
  `FACT_CHECK.md`; drop them or cite without the identifier.
- **Every number in the narration** is checked against the abstract or full text. Give each line a verdict of
  yes / partial / no-paper-found; rewrite every partial line until it is a yes, or cut it.
- **Advocates and clinicians are a source of mechanisms and hooks, never proof.** Primary literature decides.
- **Script text stays canonical.** Write acronyms as acronyms ("SQL", "GPU"), never phonetically; pronunciation lives
  in `episode.json` `voice.pronounce` and is applied only to what the TTS hears.

### Quote budget (paper-page moments)

- 4–8 paper-page moments per episode. Every source sentence is copied exactly from text you actually read; prefer
  open-access (CC BY) papers.
- **Each translation panel: at most 30 words and at most 3 numbers**, bracketed glosses counted. A longer source
  sentence gets a `tr_panel` excerpt (faithful, with an ellipsis). The numbers belong on the plate, not in the panel.
  Plain-language sentences, not statistics (no ±, CI, I², p-values in the panel).
- **Shorts:** don't put a Short window over a panel above 20 words; if one is unavoidable, add a `tr_short` of at most
  15 words.
- `tools/nx quote-budget <ep>` before voicing; `--timing` after voicing checks that 2.5 s of page plus the panel's
  hold fits inside the quote's own line(s).

## 3. Deliverables

**Stage A (all episodes of a batch): `<ep>/INDEX.md` only:**
```
# <ep> · <title>: index for review
<lines> lines · <words> words · ~<min> min · <n> Shorts
## Brief echo                                   (copied from §0)
| Ch | Title | ~min | What it argues (one line) | [user]/[found] | self-score |
## C0 · <title> (~x.x min)
- **Argument:** two or three sentences.
- **Key numbers on screen:** each with its ref key.
- **Mechanism animation:** what moves, which dial or gate, and why it is didactic.
- **Diagrams / plates:** what is drawn and from which real reference.
- **Paper-page moments:** Qn (panel word count).
- **Shorts:** Sxx "hook".
## Open questions for the user
## Parked (off scope)
```

**Stage B (next episode only, after the user approves the index), in `<ep>/`:**
1. `script.json` (a small build script that writes it is easiest to keep honest): explicit chapter and line ids,
   refs, a `visual` note per line, `short` markers on the first and last line of each Short. `tools/nx check <ep>`
   passes and writes `SCRIPT.md`.
2. `refs.json`, verified entries only.
3. `FACT_CHECK.md`, line by line.
4. The paper quotes (`public/papers/**/quotes.json` with `tr`, `tr_panel`, `tr_short`, `lines_vo`), with the quote
   budget passing.

## 4. Report back (≤ 15 lines)

Give the totals (lines, words, minutes, Shorts), the `doi check` summary line, any line you could not make a "yes",
any deviation from §1, and the paths. Don't paste the script.

## 5. Orchestrator checklist (research → script)

1. Read this template; apply any user feedback since the last episode to it first.
2. Write §0 from the user's verbatim words. If the thesis is broader than the examples, say so there.
3. Launch research lanes **split by question** (pillar or episode), never by source type, plus one "beyond the list"
   sweep lane. Every lane steelmans its own rejections and parks off-scope finds in one line.
4. Check your own synthesis against §1, line by line.
5. **User gate 1: outline.** Send §0, the pillar table with tags, one line per chapter and the parked list.
6. Stage A for the batch. **User gate 2: indexes.** Apply corrections to this template and to the indexes.
7. Stage B for the next episode only.
8. Review the script against §1. **User gate 3: script approval.** Then voice and build (`docs/AGENT_WORKFLOW.md`).

## 6. Episode boundaries

Kept per episode in `<ep>/SCRIPT_BRIEF.md` §0: what this episode argues, and what it leaves to others.
