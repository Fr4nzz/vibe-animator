# {{EPISODE}} build brief (scene builders): «{{TITLE}}»

Written by `tools/new_episode.py` from `docs/templates/BUILD_BRIEF.md`; the orchestrator fills the sections marked
(orchestrator) before builders start. Dev server **http://localhost:{{PORT}}** (started by the orchestrator; never
start your own).

Read, in this order, and nothing else broadly:
1. `docs/AGENT_WORKFLOW.md`, Part 1 (binding: the loop, qa, finish without rendering).
2. `docs/STYLE_GUIDE.md` (binding).
3. This file.
4. Your pack: `packs/C<N>.md` (your lines with timing and visual notes, fact-check rows, quotes, refs, kit pointers).
5. `engine/app/KIT_INDEX.md` for any other helper; `tools/nx kit <ep> show <name>` prints one export's source.

Paper beats: `paperBeat` (`scenes/_papers.ts`). Math: the manim-web layer (`scenes/_manim.ts`).

## Inputs (orchestrator)
- `script.json` / `SCRIPT.md`: **frozen narration**. The `visual` notes are a starting point; improve them where a
  clearer mechanism picture exists, but never contradict the colour code below.
- `timing.json` and `engine/data/lyrics.json`: word cues. Every hit is a word cue (`q.w('C2-L3', 'word')`), never a
  hard-coded second. Line ids may not be in numeric order: cue by id.
- `FACT_CHECK.md` (if any): on-screen numbers must match it and the narration exactly. No extra numbers.
- `refs.json` (if any): citation lower-thirds, **24 px or more**. The narration names no journals or dates; the
  lower-third carries them.
- `engine/app/public/papers/**/quotes.json` (a papers agent may still be filling it). Never fabricate a page: if a
  page image is missing when you build, use a typeset citation card (`paperBeat` `card`, or `typeCard`) and leave
  `// TODO paper page` so the line can be upgraded.

## Metaphor (orchestrator)
One household analogy per mechanism, kept all the way through. Say what it is, and what it must never be drawn as
(no cartoons, faces or clip-art: the analogy lives in the words and the motion, the drawing stays a real plate).
- …

## Colour code (orchestrator; binding, every chapter)
| what | colour | rule |
|---|---|---|
| the series protagonist | `signal` `#FF9124` (core `ember`) | the only thing that glows |
| … | muted, never glows | one colour per actor for the whole series |

Constants you need go in your own kit (same values everywhere); do not edit `_kit.ts`.

## Shared helpers (orchestrator)
- Kits from earlier episodes copied into `src/scenes/` read-only: import, never edit; copy into your kit to change.

## Key mechanism scenes (orchestrator)
One variable moves, the result moves with it, the viewer can predict the next frame. List the two or three plates the
episode lives or dies on, with the chapter that owns each.

## Known traps for this episode (orchestrator)
- …
