# Agent workflow

Two briefs in one file: the **scene builder's** (one chapter, then stop) and the **orchestrator's** (script → voice →
parallel builders → render queue → master, Shorts, subtitles). `docs/WORKFLOW.md` is the reference both point to
(pipeline map, qa rules, machine rules, every flag). Every rule here was paid for once; `docs/LESSONS.md` says when.

Commands run from the repository root as `tools/nx <command> <ep>`; `<ep>` is the episode folder, `<port>` the dev
server the orchestrator started (`<ep>/engine/.devport`).

---

## Part 1 — Scene builder (read this, your pack, STYLE_GUIDE; nothing else broadly)

You build **one chapter** (sometimes two short ones): `<ep>/engine/app/src/scenes/c<N>.ts`, plus one private kit
(`kit_<range>.ts`) if you need helpers. Do not edit `timeline.ts`, `engine/app/src/engine/`, the generic kits
(`_kit.ts`, `_shots.ts`, `_devices.ts`, `_refart.ts`, `_papers.ts`, `_manim.ts`), `engine/data/`, `timing.json`,
`script.json` or another chapter's file. Import other kits read-only; copy what you need to change into your kit.

### The loop (then stop)

1. **Read narrowly.** Your pack, `<ep>/packs/C<N>.md`: your lines with timing, Short markers and visual notes, the
   fact-check rows, the paper quotes, the refs and the kit pointers. For any other helper read
   `engine/app/KIT_INDEX.md`, then `tools/nx kit <ep> show <name>` for its source. Never page through other
   episodes' scene files. **Never re-read a file after editing it**: the edit succeeded or it errored.
2. **Storyboard in a few lines**: one plate idea per line, what moves on which word.
3. **Build** the shots (`ShotScene`, one moving camera; `examples/lens/scenes/` and `examples/hello/scenes/` show the
   pattern). Every cue is a word lookup, `this.q.w('C3-L8', 'lens')`, never a hard-coded second, so a re-voiced line
   keeps its sync. Paper beats use `paperBeat` (`scenes/_papers.ts`); formulas and plots use the manim-web layer
   (`scenes/_manim.ts`, see `examples/lens/scenes/c1.ts`).
4. **`tools/nx qa <ep> --chapter CK --url http://localhost:<port>`**: fix every line it prints, run it again. Passing
   items print nothing; the last line is `TOTAL n`. If it prints `lock busy … rerun later` (exit 75, after
   `--budget` s, default 200), end your turn and say so: never sleep-poll it, never background it.
5. **Look at it**, about 3–6 images in all:
   - one contact sheet, `tools/nx sheet <ep> CK --url …` (about 1600 px; a tile per line; guides at x 420/1500, red
     on Short lines; problems boxed in red; `--at 30,60,end` for more samples);
   - for each mechanism line, `tools/nx qa <ep> --strip CK-Lx --n 6` (the motion across the line);
   - one `tools/nx qa <ep> --still CK-Lx --at end` per new drawn plate (full size: art and legibility; a 390 px tile
     cannot show whether an illustration looks professional);
   - after fixes, one re-sheet of only the lines you changed (`--lines CK-L2,CK-L5`).
   Don't screenshot anything else.
6. **Finish without rendering.** Write `<ep>/engine/work/renders/CK.ready` (one line: the qa total) and report in five
   lines or fewer: what you built, the qa total, and **every known weakness or anything you did not see** (the
   orchestrator decides; don't bury it). If you found a bug in a file you don't own (captions, data, timing), say so
   first. **Never start a background job** (`&`, `nohup`, watchers): its completion notice wakes you after your
   prompt cache has expired (~5 min), and that re-write costs 150–250k tokens.

### What qa checks (STYLE_GUIDE in machine form)

| kind | rule |
|---|---|
| `square` | on a line inside a Short (`short` markers), all text inside **x 420–1500** |
| `size` | text ≥ **24 px** on screen after camera zoom; translation-panel text ≥ **40 px** |
| `offframe` | text cut by the frame edge |
| `caption` | scene text in the caption band (**y > 928**); keep baselines above about y 900 |
| `cue` | a cue naming a line or word missing from `lyrics.json`; scene init/render errors; `[paperBeat]` budget errors |
| `hold` | a translation panel readable for max(4 s, 0.33 s × words + 1.5 s) |
| `squeeze` | a panel up > 6 s beside a plate leaves < 594 px of height or < half the width for the plate |
| `type` | a TypeScript error in your scene files or kits (sub-second check of changed files) |

It samples each line at 30 %, 60 % and its end − 0.15 s (`--every 1` adds one sample per second, which catches
transitions). It sees only `fillText`/`strokeText` on the scene layers: text inside images (paper pages) and manim-web
glyphs are not checked, so keep them inside the square by construction. A deliberate exception may stay; say so.

### Style rules you will be held to (full text: `docs/STYLE_GUIDE.md`)

- **Type floors (px at 1920×1080, after zoom):** headline or key number 96 · serif statement 44 · diagram label and
  chart axis 30 · kicker, annotation, citation 24 · translation panel 40 · protocol card 56 / 36 · a real paper page
  ≥ 55 % of the frame height during its proof moment. When the plate has room, the text grows. Fewer words rather
  than smaller type.
- **One glowing colour** (the signal layer) for the series protagonist; everything else hairline and muted.
- **Real references, never procedural anatomy or organisms**: `refArt('name', width)` from `public/refs/`, or
  `refart find → clean → trace`; otherwise ask the orchestrator for an asset agent.
- **Captions own the bottom** of the frame (y > ~928).
- **Shorts:** on Short lines everything that matters sits in x 420–1500.
- **Paper beats:** `paperBeat`: page large for ≥ 2.5 s, then the panel in a side column outside a Short, or page →
  panel → plate in sequence inside one. Fix an over-budget quote (`tr_panel`, `tr_short`), not the timing.

---

## Part 2 — Orchestrator

### New-episode checklist

0. **Script first** (`docs/templates/SCRIPT_BRIEF.md`): brief echo, one-page outline for the user's approval, then the
   full script as `script.json` (explicit line ids `C<n>-L<m>`, a `visual` note per line, `short` markers on the first
   and last line of each Short). `tools/nx check <ep>` until clean. Text stays canonical ("SQL"); pronunciation lives
   in `episode.json` `voice.pronounce`. Check every DOI once with `tools/nx doi check`.
1. **Scaffold:** `tools/nx new <ep> --id … --title … --script script.json [--fake-vo]`. It copies the engine, installs
   it, writes `KIT_INDEX.md`, picks a free dev port and writes `BUILD_BRIEF.md` from `docs/templates/`. With
   `--fake-vo` (estimated timings, silent track) it also writes the engine data, captions and packs, starts Vite, and
   `--selftest` runs qa on C0. Never render a fake voice for real.
2. **Quotes (if the episode shows paper pages):** build `public/papers/**/quotes.json` and run
   `tools/nx quote-budget <ep>`. Launch the papers/asset agent the moment it passes, before voicing; it gathers
   reference art and pages and returns a table. Builders don't browse.
3. **Voice:** `ELEVENLABS_API_KEY=… tools/nx vo <ep>` (voice id from `ELEVENLABS_VOICE_ID` or `voice.voice_id`). A line
   whose spoken text changed is re-voiced. Run speech-to-text on every new take and read the worst pairs; re-voice
   misreads (delete `vo/<line id>.*`). Then `tools/nx quote-budget <ep> --timing`.
4. **Data, captions, packs, dev server:** `python3 tools/new_episode.py <ep> --data`. After a script change,
   `tools/nx packs <ep>`.
5. **Chapters:** one builder per chapter (pair chapters under about 50 s), each given Part 1 of this file, its pack and
   the BUILD_BRIEF. Launch them all at once. Builders don't render.
6. **Review each report:** a reported weakness that breaks a style rule blocks that chapter until fixed or waived by
   the user. Open the full-size still of every new plate yourself.
7. **Queue:** `nohup tools/nx render <ep> --all-pending --jobs 2 --budget 0 > <ep>/engine/work/renders/queue.log 2>&1 &`,
   then `tools/nx wait-renders <ep>` as the command whose exit *is* "renders done" (never `pgrep -f`). Pending is by
   content hash of every input, recorded at render start, so an edit made mid-render leaves the chapter pending. Each
   chapter pass also makes the Shorts whose window starts in it, and `engine/work/renders/CK.grid.jpg` (two tiles per
   line): look at each grid once as it lands.
8. **Assemble:** `tools/nx assemble <ep>`, then watch the master once, at full size, with sound.
9. **Shorts:** `qa --every 1` must report zero `square`, `hold`, `caption` findings on every Short line; then
   `tools/nx shorts <ep>` fills in any missing or stale Short. Watch each one.
10. **Subtitles and publishing:** `tools/nx srt <ep>`; `tools/nx verify-fresh <ep> <master> <shorts…>`; upload with your
    platform's tools, private first. Credit every CC BY asset in the description (`public/refs/SOURCES.md`) and
    disclose synthetic narration.
11. **Cleanup, after the upload is verified:** `tools/nx cleanup <ep>` (dry run), then `--yes`. It keeps the master,
    the Shorts, `vo/`, the engine source and the receipts; chapters re-render in minutes if a fix is ever needed.

### Orchestrator habits

- **One fresh chat per episode**, started from a short handoff file (≤ 5k characters: what is approved, what is next,
  the paths). Write the handoff at each boundary (research → script → production → publish).
- **Compact at about 150k context**, and before any idle longer than an hour (the cache can't bridge it).
- **Delegate every blocking or side task** (ffmpeg cuts, uploads, engine or tool fixes, filling a script slot). Never
  do more than three consecutive tool calls of non-orchestration work yourself. While a queue runs, run nothing that
  takes more than two minutes. Every "I'll do X when Y finishes" is backed by a command whose exit *is* Y.
- **Outline approval before full scripts.** Write full narration only for the next episode in production; put user
  feedback into the script brief template at once, so later drafts inherit it.
- **Mechanical agents at lower effort** (asset fetching, DOI runs, assembly, uploads). Don't re-verify DOIs the cache
  marks ok, and don't re-write a subagent's report: link it.
- **State the tool and model** when launching work for the user; default to the user's current model.
- **Steering lines that held up:** an exemplar is a reference, not a template; model the viewer (what do they see first,
  what do they read next); the user's direction overrides this guide; give every review a budget (how many images).
