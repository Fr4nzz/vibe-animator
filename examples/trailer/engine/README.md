# engine/ — the engine template

A Vite + TypeScript + three.js app that renders a narrated video as a pure function of time, from word-timed
narration. `tools/init_episode.py` copies this folder into each episode (`<episode>/engine/`); you never render from
the template itself.

## Data contract (written by the pipeline, read by the engine)

| File | Written by | Content |
|---|---|---|
| `data/lyrics.json` | `tools/make_engine_data.py` | `{lines: [{id, text, start, end, words: [{w, start, end}]}]}` in episode order; line ids `C<n>-L<m>` |
| `data/audio.json` | `tools/make_engine_data.py` | `{duration, bpm, beats, downbeats, sections, onsets}` (synthetic grid; downbeats = line starts) |
| `data/chapters.json` | `tools/make_engine_data.py` | `[{id: "C0", title, start, end}]` |
| `audio/voice.mp3` | `tools/make_engine_data.py` (copy of `<episode>/vo/voice.mp3`) | narration used by the preview and the encoder |
| `app/src/captions_chunks.json` | `tools/make_captions.py` | burned-in caption tokens per line |

## Layout

- `app/src/engine/` — core (from mexicat/pdoom-video, MIT): GL compositor, post (bloom, grain, vignette, paper),
  fonts, stroke fonts, lyrics/audio model, HUD, `qa.ts` (text-draw recorder for `?qa=1`).
- `app/src/timeline.ts` — one entry per chapter; chapter `C<n>` renders `src/scenes/c<n>.ts`, else the placeholder.
- `app/src/scenes/` — generic kits: `_kit.ts` (paths, hatching, callouts, plate backgrounds, ink + signal layers),
  `_refart.ts` (reference art → engraving), `_shots.ts` (shot system on a moving camera, word cues, paper-page viewer,
  type helpers), `_devices.ts` (type scale, translation panel, buckets, protocol cards, arrows, dials), `_papers.ts`
  (`paperBeat`: a Short-aware real-paper-page beat with its quote budget), `_manim.ts` (the manim-web math layer:
  Axes, plots, MathTex, Create/Write/Transform on word cues), `_placeholder.ts`. `KIT_INDEX.md` lists every export.
- `app/scripts/` — agent-facing tools, all lock-safe: `qa.ts` (layout QA, contact sheet, stills, strips, crops),
  `render_chapter.ts` (clip render with frame check, receipts and atomic swap; `--all-pending` by content hash),
  `encode.ts` (single-worker encoder), `render.ts` (stills, perf, multi-worker video), `grid.ts` (post-render stills
  grid), `typecheck.ts` (sub-second scene type check), `kit_index.ts` (helper index), `lib.ts` (paths, config, render
  slots, memory wait, GPU env, HMR blocking, hashes).
- `app/public/fonts/` (licences in `LICENSES.md`), `app/public/refs/` (reference art, credits in `SOURCES.md`).
- `tools/svgflat.py` — flattens an SVG into the `refs/*.json` format `_refart.ts` reads.

## Preview

```sh
cd <episode>/engine/app && bun install
bunx vite --port 5730 --strictPort     # any free port; open http://localhost:5730 (space = play, [ ] = chapters)
```

Machine settings (render lock, GPU env, Chromium path, memory floor, private ports) are read by `scripts/lib.ts`
from environment variables or the `render` block of `<episode>/episode.json`; see `docs/CONFIG.md`.
