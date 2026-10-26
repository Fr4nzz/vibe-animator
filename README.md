# vibe-animator

**Agentic narrated explainer videos.** You give a prompt; Claude Code agents turn it into a script; ElevenLabs voices
it with word-level timings; parallel agents build one chapter each as a canvas/WebGL scene in which every visual hit
is cued to a spoken word; a deterministic GPU renderer turns the chapters into a 16:9 master; and the vertical Shorts
and the captions come out of the same pass.

```
prompt ─▶ script.json ─▶ ElevenLabs (word timings) ─▶ scenes cued to words ─▶ deterministic GPU render ─▶ master
                                                       (one agent per chapter)                       └─▶ Shorts + captions
```

The default look is an **"engraved treatise"**: hairline plates from an illustrated scientific treatise, real
reference art restyled as engraving, one glowing signal colour, alternating ink and bone paper, a camera that is
always moving. It is one preset (`docs/STYLE_GUIDE.md`); the pipeline does not depend on it. Formulas, axes and plots
come from a **manim-web math layer** that runs on the same clock.

## Results so far

Measured on the production runs this framework was extracted from:

- A **14-minute documentary episode** cost about **1.1M weighted tokens per finished minute**, **54 % less** than the
  previous pipeline, with about 68 minutes of wall time from "start" to finished upload.
- Rendering runs at about **1.2× real time per chapter** on a GPU (H.264 encoded on the GPU, frames packed as I420 in
  the page), two chapters at once, and about **4× real time** with the opt-in in-page WebCodecs encoder.
- Frames are a pure function of time: renders are reproducible, any frame can be sought directly, and an edit
  re-renders only the chapters whose input hashes changed.

## Quick start

```sh
git clone https://github.com/Fr4nzz/vibe-animator && cd vibe-animator
(cd engine/app && bun install && bun run typecheck)

# a 23-second demo with a fake voice (no API key): scaffold, QA, one still
tools/nx new work/lens --id lens --title "How a lens focuses light" \
  --script examples/lens/script.json --scenes examples/lens/scenes --fake-vo --selftest
tools/nx qa work/lens --url http://localhost:5730 --still C1-L2 --at end

# the install smoke test (another tiny example, "How a candle burns")
tools/smoke_test.sh
```

Your own episode:

```sh
export ELEVENLABS_API_KEY=…  ELEVENLABS_VOICE_ID=…        # secrets come only from the environment
tools/nx new ../my-episode --id my-ep --title "My episode" --script my-script.json
tools/nx vo ../my-episode                                 # TTS per line, word timings, one loudness-matched mix
python3 tools/new_episode.py ../my-episode --data         # engine data, captions, per-chapter build packs, dev server
# … one agent per chapter builds engine/app/src/scenes/c<N>.ts (docs/AGENT_WORKFLOW.md) …
tools/nx render ../my-episode --all-pending --jobs 2 && tools/nx wait-renders ../my-episode
tools/nx assemble ../my-episode && tools/nx shorts ../my-episode && tools/nx srt ../my-episode
```

## Requirements

- **bun** ≥ 1.2 (engine scripts, npm dependencies)
- **Python** ≥ 3.9 (standard library only; `tools/refart.py` sets up its own optional venv)
- **ffmpeg** / **ffprobe** with libx264, libmp3lame and libass; VAAPI for GPU encoding (falls back to x264)
- **Chromium** with WebGL2: a system Chromium/Chrome, or `bunx playwright install chromium`
- **An ElevenLabs API key** in `ELEVENLABS_API_KEY` (and a voice id in `ELEVENLABS_VOICE_ID`) for real narration;
  `tools/nx fake-vo` works without one
- A GPU is strongly recommended (software WebGL is refused unless `HARNESS_ALLOW_SOFTWARE_GL=1`); Linux with `flock`
  and `/proc/meminfo` for the shared render lock and memory gate
- Optional: `rubberband` (tempo change), `pdftotext` (paper-page quote boxes), `paper-search` (DOI verification)

## Architecture

| Path | What |
|---|---|
| `engine/` | The engine template (Vite + TypeScript + three.js), copied into each episode. Core compositor and post (`src/engine/`), generic scene kits (`src/scenes/_kit.ts`, `_shots.ts`, `_devices.ts`, `_refart.ts`, `_papers.ts`, `_manim.ts`), agent scripts (`scripts/qa.ts`, `render_chapter.ts`, `encode.ts`, `grid.ts`, `typecheck.ts`, `kit_index.ts`), fonts and a CC/PD reference-art library. See `engine/README.md`. |
| `tools/` | The Python pipeline behind the `tools/nx` dispatcher: `new_episode` (one-call scaffold + per-chapter packs), `check_script`, `make_vo` (ElevenLabs with timestamps), `fake_vo`, `pron` (pronunciation table), `make_engine_data`, `make_captions`, `assemble`, `music` (story music), `make_shorts`, `make_srt`, `receipts`, `wait_renders`, `cleanup`, `quote_budget`, `doi_cache`, `fetch_ref`, `refart`. |
| `docs/` | `AGENT_WORKFLOW.md` (builder and orchestrator briefs), `WORKFLOW.md` (pipeline reference, qa, machine rules), `STYLE_GUIDE.md`, `TONE.md`, `CONFIG.md` (`episode.json`), `LESSONS.md`, `templates/` (script and build briefs), `STORY_MUSIC.md` (mood music), `research/`. |
| `skills/vibe-animator/` | A Claude Code skill that routes an agent to the right doc for each step. |
| `examples/` | `lens/` (the demo), `hello/` (smoke test), `manim-curve/` (manim-web on its own), `refart-kidney/` (reference-art cleaning and tracing). |

**Several voices.** A narrator plus characters: map roles to voice ids in `episode.json` (`"voice": {"voices":
{"NARRATOR": "…", "GUEST": "…"}, "default_role": "NARRATOR"}`) and give a script line `"voice": "GUEST"`. Each line is
voiced with its role's voice; timings and captions work exactly as with one voice. Scenes can read the speaker
(`this.q.speaker(id)`) and type a line on screen in step with the voice (`"typed": true`, `this.q.typed(id, t)`).
`docs/CONFIG.md` has the details.

**Narration drives everything.** `make_vo.py` voices each line with ElevenLabs' timestamped endpoint and writes
`timing.json` (absolute times for every word). The engine reads it as `data/lyrics.json`, and a scene never uses a
hard-coded second: `this.q.w('C0-L2', 'focus')` is the start of the word "focus", so a re-voiced line keeps its sync.

**Deterministic render.** Every scene is a pure function of time, so the renderer seeks frame by frame (with motion-blur
sub-frames), the QA tool can sample any line at any moment, and backward seeks give identical pixels. Frames are packed
as I420 on the GPU and encoded with VAAPI (or in-page WebCodecs); `render_chapter.ts` stages each clip, checks frames
and duration, writes a receipt with the sha256 of every input, and renames it into place.

**Story music.** A line can carry a `mood` (wonder, struggle, tension, hope, resolution; `insight` is a subtle accent,
not a track change). `tools/music.py` turns the moods into timed sections whose crossfades end on the cue word, takes
the beds from a CC BY demo library (Kevin MacLeod, downloaded on demand), composes one ElevenLabs Music track with a
section per mood, or reuses sections of your earlier takes from a private cache (`~/.cache/vibe-animator/music/`,
never committed), ducks the bed under the voice (sidechain keyed by the narration; `music.bed_db` / `music.duck_db`
per episode: −15 / 6 dB for a documentary, −10 / 5 dB for the trailer) and normalizes the mix to −14 LUFS (two-pass
`loudnorm`, true peak ≤ −1.5 dBTP). Set `"music": "library"`, `"elevenlabs"` or `"reuse"` in `episode.json`; the
master and the Shorts then carry the mix, the video is still stream-copied, and a music failure only warns.
**Only `music generate` spends credits**: it prints a cost estimate (13.8 credits per second, measured), needs `--yes`
or a `music.max_credits` budget, makes exactly one take (another needs `--retake`), tries the free `reuse` first and
logs every spend to `music/spend.jsonl`; `assemble` never generates (`docs/STORY_MUSIC.md`).

**Shorts and captions in the same pass.** Lines carry `short` markers. Inside a Short's window the chapter pass renders
a second, caption-free copy of the frame, crops the central square on the GPU and composes the vertical Short (hook
title, word-timed captions, narration). Captions are burned into the master and also written as an SRT.

**Machine rules in code.** One shared `flock` lock and a free-memory gate for every headless browser, two render slots,
a software-WebGL refusal, blocked hot reload during renders, atomic writes, receipts and `verify-fresh`, and a
content-hash pending check. `docs/WORKFLOW.md` lists each rule and the incident that produced it.

## The agent workflow

An orchestrating Claude Code session writes the script with the user (outline first, then the full script), voices
it, and scaffolds the episode with `tools/nx new`, which also writes a **build pack** per chapter: that chapter's lines
with timing, Short markers, visual notes, fact-check rows, quotes and pointers into `KIT_INDEX.md`. It then launches
**one builder agent per chapter, all at once**. Each builder reads only its pack, `docs/AGENT_WORKFLOW.md` and the
style guide, builds its scene on word cues, and loops on `tools/nx qa` until it prints `TOTAL 0`:

| qa check | rule |
|---|---|
| `square` | on Short lines, all text inside x 420–1500 |
| `size` | text ≥ 24 px on screen after camera zoom; translation panels ≥ 40 px |
| `caption` / `offframe` | nothing in the caption band (y > 928), nothing cut by the frame |
| `cue` | every word cue exists in the narration |
| `hold` / `squeeze` | translation panels readable long enough, and never squeezing the plate beside them |
| `type` | the chapter type-checks |

Builders look at one contact sheet, a strip per mechanism line and one full-size still per new plate, then write a
`.ready` file and stop; they never render or start background jobs (a sleeping agent's prompt cache expires). The
orchestrator queues every pending chapter (`render --all-pending --jobs 2`), waits on `wait-renders` instead of
polling, looks at each chapter's stills grid as it lands, and assembles the master, Shorts and subtitles.

## The manim-web math layer

`engine/app/src/scenes/_manim.ts` lets a scene use [manim-web](https://github.com/maloyan/manim-web), a TypeScript port
of the Manim Community API, as a drawing and animation layer: `Axes`, `plot`, `MathTex` (MathJax, bundled; renders
work offline), `Create` / `Write` / `Transform`. The engine keeps the clock, the word cues, the camera, the
post-processing and the render path: every manim animation starts on a word cue, and a backward seek rebuilds the
segment synchronously, so frames stay deterministic. `examples/lens/scenes/c1.ts` and `examples/manim-curve/` show the
pattern; `docs/research/2026-10-25-manim-web-spike.md` has the measurements (about 0.7 ms per frame).

## Credits

- **Built with [Claude Code](https://claude.com/claude-code).** The pipeline, the engine kits, the agent workflow and
  these docs were written by Claude Code agents directed by the author, and the workflow is designed for them.
- **[manim-web](https://github.com/maloyan/manim-web)** by Narek Maloyan, MIT. It ports the API of
  [Manim Community](https://www.manim.community/) (MIT), itself derived from 3Blue1Brown's manim.
- The engine core derives from **[mexicat/pdoom-video](https://github.com/mexicat/pdoom-video)** (MIT); agent-workflow
  ideas and a GPU probe from **[JohnHeibel/ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase)** (MIT).
- Fonts (SIL OFL) and reference art (Servier Medical Art and DBCLS under CC BY, Bioicons CC0, Gray's Anatomy and other
  public-domain plates) keep their own licences: `THIRD_PARTY.md`. CC BY art needs a credit line in your video
  description.
- Author: **Fr4nzz**.

## Licence

MIT, © 2026 Fr4nzz (`LICENSE`). Third-party code, fonts and reference art: `THIRD_PARTY.md`,
`engine/app/public/fonts/LICENSES.md`, `engine/app/public/refs/SOURCES.md`.
