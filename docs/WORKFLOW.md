# Workflow (pipeline reference)

How an episode goes from a script to finished videos, and the machine rules that keep parallel agents from breaking
each other's renders. Commands use the `tools/nx` dispatcher (`tools/nx <command> <episode>`); each maps to one
script, listed in `tools/nx`'s header. **Who does what, step by step, is in `docs/AGENT_WORKFLOW.md`** (the
scene-builder brief and the orchestrator checklists); this file is the reference both point to.

## Pipeline map

| Step | Command | Reads | Writes |
|---|---|---|---|
| 0. New episode | `tools/nx new <dir> --id x --title "…" --script s.json [--fake-vo]` (or the bare `tools/nx init`) | `tools/templates/`, `engine/` | `episode.json`, `script.json`, `engine/` copy, empty `renders/ work/ vo/ shorts/ publish/`; with a voice: engine data, captions, `packs/C<N>.md`, a running dev server |
| 1. Script | edit `script.json`; `tools/nx check <ep>` | `script.json` | `SCRIPT.md` (review copy), errors |
| 2. Voice | `tools/nx vo <ep>` (`ELEVENLABS_API_KEY`) or `tools/nx fake-vo <ep>` (no key) | `script.json`, `episode.json` voice (`pronounce`) | `vo/voice.wav` (master), `vo/voice.mp3`, `timing.json` |
| 3. Engine data | `tools/nx data <ep>` | `timing.json` | `engine/data/{lyrics,audio,chapters}.json`, `engine/audio/voice.mp3` |
| 4. Captions | `tools/nx captions <ep>` | `timing.json`, `episode.json` captions | `engine/app/src/captions_chunks.json` |
| 5. Dev server | `tools/nx dev <ep> <port>` | | preview at `http://localhost:<port>` |
| 6. Scenes | one agent per chapter (`docs/AGENT_WORKFLOW.md`) | `packs/C<N>.md`, `engine/data/lyrics.json`, kits | `engine/app/src/scenes/c<N>.ts` (+ a private kit) |
| 7. QA | `tools/nx qa <ep> --chapter C3`; `tools/nx sheet <ep> C3` | running engine | violation report; one contact-sheet PNG |
| 8. Render | `tools/nx render <ep> C3` or `--all-pending [--jobs 2]` | scenes, `short` markers | `engine/renders/<id>_c<N>.mp4`, and the Shorts that start in each chapter (`shorts/S<nn>.mp4`) |
| 9. Assemble | `tools/nx assemble <ep>` | clips, `vo/voice.wav` | `renders/<id>_full.mp4` |
| 10. Shorts | `tools/nx shorts <ep>` (only fills in Shorts that are missing or stale; `--separate` redoes them the old two-step way) | `short` markers, receipts | `shorts/S<nn>.mp4` |
| 11. Subtitles | `tools/nx srt <ep>` | timing, caption chunks | `publish/subtitles.<lang>.srt` |
| 12. Publish | your platform's own uploader (not included); `tools/nx verify-fresh <ep> <files>` first, private first | receipts | |

`tools/nx prep <ep>` runs steps 1, 3 and 4 together after a voice pass. Re-run 3 and 4 after every re-voice: the
cues, the QA and the renders all read the engine data.

## Inputs a scene builder gets

- Its pack, `packs/C<N>.md` (`tools/nx packs <ep>`): its lines with timing, Short markers and visual notes, the
  fact-check rows, paper quotes, refs and kit pointers that concern them. `script.json` / `SCRIPT.md` hold the rest.
- `engine/data/lyrics.json`: absolute word times. **Every visual hit is a word cue** (`this.q.w('C3-L2', 'lens')`),
  never a hard-coded second, so a re-voiced line keeps its sync.
- A fact-check file for the episode (if the project keeps one): on-screen numbers must match it and the narration
  exactly. No extra numbers.
- The episode's references list, for citation lower-thirds.
- Real paper pages, if any (see below).

## Ownership

The orchestrator owns `timeline.ts`, the engine core (`engine/app/src/engine/`), the generic kits (`_kit.ts`,
`_refart.ts`, `_shots.ts`, `_devices.ts`), `engine/data/`, `timing.json` and `script.json`. A scene builder writes only
`engine/app/src/scenes/c<N>.ts` for its chapters plus one private kit (`kit_<range>.ts`). Import the generic kits and
other builders' kits read-only; copy what you need to change into your own kit.

## The scene-builder loop

The full brief, with the reasons, is `docs/AGENT_WORKFLOW.md`. In short: read your pack and `KIT_INDEX.md` narrowly →
build on word cues → `tools/nx qa <ep> --chapter CK --url …` until `TOTAL 0` → one contact sheet, a strip per
mechanism line, one full-size still per new plate → write `engine/work/renders/CK.ready` and report in five lines.
Builders do not render and do not start background jobs; the orchestrator owns the render queue.

## What qa checks (the style guide in machine form)

| kind | rule |
|---|---|
| `square` | in a line inside a Short unit (`short` markers), all text inside **x 420–1500** |
| `size` | text ≥ **24 px** on screen after camera zoom (3 % slack; `--min-px`); translation-panel text ≥ **40 px** (`--panel-px`) |
| `offframe` | text cut by the frame edge (text wholly off-frame is ignored) |
| `caption` | scene text in the caption band (**y > 928**, measured from the HUD); keep baselines above about y 900 |
| `cue` | `q.w/q.e/q.s/q.end`-style cues naming a line or word missing from `lyrics.json` (a static scan of the scenes folder, comments included; line ids match case-insensitively); scene init and render errors; `[paperBeat]` budget warnings |
| `hold` | a translation panel (text matching a `tr`, `tr_panel` or `tr_short` in `public/papers/**/quotes.json`) readable for max(4 s, 0.33 s × words + 1.5 s) |
| `type` | a TypeScript error in the chapter's scene files or kits (sub-second check of changed files first; `--no-typecheck` skips it) |
| `squeeze` | a panel up more than 6 s while a plate (its labels) is drawn beside it: the largest free rectangle (frame, or the Short square, above the captions, outside the panel) must be ≥ 594 px tall and ≥ half the region wide |

Options: `--lines C3-L2,C3-L5`, `--every 1` (also sample every second, which catches transitions), `--json`,
`--no-panels`. It samples each line at 30 %, 60 % and its end − 0.15 s. It sees only `fillText`/`strokeText` on the
scene layers: text inside images (paper pages) is not checked, so keep pages inside the square by construction. A
deliberate exception (e.g. neighbouring cards peeking in at the frame edge) may stay; say so in your report.

## Real paper pages

Showing the actual page of a cited paper is the strongest proof device, and the riskiest legally.

- Pages live in the **episode** (`engine/app/public/papers/<key>/…`) and its index `public/papers/quotes.json`:
  `{key: {citation, license, oa, pages: [{img, w, h}], quotes: [{id, page, text, tr, lines: [[x, y, w, h], …]}]}}`.
  Boxes are measured with `pdftotext -bbox`, and checked by eye.
- Never commit copyrighted pages to this repository. Prefer open-access (CC BY) papers; otherwise the use rests on
  quotation for commentary, which is the episode owner's call. Log source URL and licence for every page.
- **Never fabricate a page.** No scan available: use a typeset citation card (`typeCard` in `_shots.ts`), visibly not a
  facsimile.
- Highlight only text that exists on the page. The highlighted sentence must say what the narration says it says.
- Translations (`tr`) are faithful; the panel holds for at least max(4 s, 0.33 s × words + 1.5 s). A long source
  sentence gets a `tr_panel` (a faithful excerpt with …) and, inside a Short, a `tr_short`. Use `paperBeat`
  (`scenes/_papers.ts`) for the beat itself, and `tools/nx quote-budget` before voicing.
- Prefer CC BY pages: the demo and examples in this repository ship no paper pages at all.

## Machine rules (each of these cost real time before)

- **Render lock and memory.** Every headless browser on the machine runs under one `flock` file
  (`render.lock` / `HARNESS_RENDER_LOCK`), after MemAvailable ≥ `render.min_free_gb` (checked again inside the lock).
  `qa.ts`, `render.ts`, `encode.ts`, `render_chapter.ts` and `make_shorts.py` take it themselves; wrapping them in
  `flock` is harmless (detected, no deadlock). Any other browser you start goes under the same lock. On a 14 GB
  machine the OOM killer takes everything, so do not skip this.
- **One lock per machine.** Every project on the machine must use the same lock path.
- **Two render slots.** Chapter renders (`render_chapter.ts`, `encode.ts`) take the first free of `<lock>` and
  `<lock>.2` (`render.slots`, default 2). Each is taken without blocking, with its own memory gate, so at most two
  renders run at once (about 1.6 GB for both, measured). `render --jobs 2` uses both. QA, stills and every other
  browser stay on `<lock>` (slot 0). Never take `<lock>.2` by hand.
- **Encoder.** Frames leave the page as GPU-packed I420 and are encoded on the GPU (`render.encoder`, default
  `h264_vaapi` at 10 Mbit/s: YouTube serves about 0.8 Mbit/s AV1 and its re-encode removes film grain, so more only bloats local files; 8 Mbit/s blocked 24 px text in page dissolves). Set `render.vaapi_device` to the `/dev/dri/by-path/…-render`
  of the GPU that should encode, because `renderD` numbers can change. Without VAAPI, the encoder falls back to
  x264-fast and says so. Use one encoder per episode: `assemble` joins clips by stream copy and refuses mixed
  settings. After you switch, re-render every chapter. `--enc webcodecs` (in-page H.264, about 3× faster again) is
  opt-in: check its grain on the target screen first.
- **GPU.** The scripts pass `render.gpu_env` (default `DRI_PRIME=1`) to Chromium. On hybrid-GPU Linux machines,
  without it Vulkan may land on the iGPU and frames come out tile-garbled. Stills use the same path as renders, so
  what you check is what renders.
- **HMR.** The scripts block Vite's reload socket on export pages, so another agent saving a file cannot kill your
  render mid-run. Don't restart shared dev servers or kill processes you didn't start. Private servers the scripts
  start use `render.private_ports` and are stopped on exit.
- **Clips.** Never write `engine/renders/*.mp4` directly: review copies may be hard links, and writing in place
  truncates them. `render_chapter.ts` renders into `engine/work/renders/`, checks frames and duration (±1 frame),
  renames a new file into place and refreshes the hard links in `render.review_dir`.
- **Temp files.** Big files go in `engine/work/` or `render.tmpdir` (`/var/tmp`), never `/tmp`.
- **Output.** Keep it short (`| tail -3`). No progress bars, no full logs in context. Don't write ad-hoc helper
  scripts for checks the tools already do; if a check is missing, say so in your report.
- **Waiting.** Never block one call for more than ~4 minutes: a subagent's prompt cache expires after ~5 minutes and
  its next call re-writes the whole context (measured: 15.8M of one builder's 16.4M cache-write tokens). Queue long
  jobs (`--all-pending` renders every chapter whose recorded input hashes changed) and end your turn.
- **Waiters.** Wait on a PID, a lock or an output file, never `pgrep -f`/`pkill -f` with a pattern that also appears
  in your own command line (it matches itself and never finishes). A monitor that waits for a finish file also checks
  that the producer is alive (PID or log time) and fails if it is gone.
- **No edits during renders.** Never edit an episode's engine while that episode renders, even "tooling only".
- **Downloads.** External assets only through `tools/fetch_ref` / `refart`; never compose your own request headers,
  and never put a person's email, name or account in a URL, header or User-Agent.
- **Secrets.** API keys only in environment variables (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`). Never write them
  into an episode, a log, a commit or a report.

## Tool reference (flags added for agents)

| Flag / command | What it does |
|---|---|
| `qa --texts C3 [--at end]` | Every scene text drawn per line, one plain-text line per sample. Grep required phrases (safety wording) here, not in images. |
| `--at end\|<fraction>` | Where to sample (qa checks, `--sheet`, `--texts`, `--still`, `--crop`): `end` = line end − 0.3 s, captions off (late reveals complete). |
| `qa --still C3-L2 [--t s,s \| --at f]` | Full-resolution still(s); prints PNG paths. |
| `qa --strip C3-L2 [--n 8] [--from s --to s]` | One strip of N frames across a line: motion and transition check. |
| `qa --crop C3-L2 x,y,w,h [--t s \| --at f]` | Full-resolution crop (1920x1080 coordinates): art and legibility check. Image modes: ≤ 12 images per chapter per run; `--samples 4` adds motion blur. |
| `bun scripts/typecheck.ts [c3 …] [--chapter C3] [--changed]` (`nx typecheck <ep> c3`) | Type-checks just those scene files and their imports in under a second; qa runs it first on changed files (kind `type`). |
| `--budget <s>` (qa, render, stills, encode) | Give up waiting for the lock or free memory after s (default 200): exit **75**, "lock busy (held by …), rerun later". Background queues: `--budget 0` (wait). |
| QA lock | qa and stills/sheets use `<lock>.qa`; they run beside a render only if MemAvailable ≥ `render.qa_min_free_gb` (default `min_free_gb`), else wait for the render lock. |
| `render --jobs 2` · `--enc …` · `--socks 2` · `--no-shorts` | Two chapters at once (one per slot, 20 s apart) · encoder for every clip (`h264_vaapi` default, `hevc_vaapi`, `x264` = the old CPU path, `x264-fast`, `webcodecs`) · two frame sockets (+10 %) · skip the in-pass Shorts. |
| `make_shorts.py --plan` | Writes `engine/work/shorts/plan.json` (each Short's window, compose graph, captions, output). `nx render` runs it first; a plan older than script/timing/episode.json/captions is ignored with a note. |
| `render --all-pending [--dry-run]` | Pending = an input's sha256 differs from the clip's receipt (taken at render START), so an edit during a render keeps the chapter pending. One reason line per chapter. |
| `<file>.receipt.json` | Written beside every chapter clip, master, Short and raw Short render: output and input hashes. |
| `nx verify-fresh <ep> <file…>` | Exit 1 if any input of the file (recursively through clip receipts) changed. Run it on the master and every Short before publishing; publishing code can call `receipts.require_fresh()`. |
| `render --all-pending` hash cache | Input hashes are cached across runs in `engine/work/renders/.sha-cache.json` by (size, mtime, inode): touching a file without changing it re-renders nothing. |
| GPU check | Every browser logs `gl: <UNMASKED_RENDERER>` once and exits 3 on SwiftShader/llvmpipe/software (`HARNESS_ALLOW_SOFTWARE_GL=1` for CI; extra pattern `render.gl_deny`). |
| Outputs | Clips, masters, Shorts, `encode --out` and `render.ts video` are staged, ffprobe-checked and renamed: never written in place. |

Waiting: wait on a PID (`$!`), a file or the lock (`lockHolder()` in lib.ts), never on `pgrep -f`/`pkill -f` with a pattern
that also matches your own command line. `tools/nx wait-renders <ep>` does this for the render queue
(`queue.running.<pid>.json` / `queue.done.json` in engine/work/renders/). After the upload is verified, `tools/nx cleanup <ep>`
(dry run; `--yes`) deletes the chapter clips and engine/work/, keeping the master, Shorts, vo/ and receipts.

## Tool reference: assets, kits, scripts

| Command | What it does |
|---|---|
| `tools/fetch_ref URL -o FILE` | The **only** way to download external assets: fixed project User-Agent (`fetch.user_agent` in episode.json or `HARNESS_FETCH_UA`), refuses any UA/URL holding an email, ≥ 1 s between requests per host. Never put a name, email or account in a request. |
| `tools/nx refart find "kidney section" [--download N --dest DIR]` | Ranked Commons (PD/CC0/CC BY/CC BY-SA, licence + author), Bioicons and Servier hits; `--download` saves originals and a SOURCES row. `SA!` = share-alike: never in `public/refs`. |
| `tools/nx refart clean IMG [--region x,y,w,h …] [--keep …]` | Removes printed labels and leader lines by inpainting their pixels (never rectangles); check `<stem>_clean_preview.png` (mask in red). `--region` hints a missed label; `--keep` protects anatomy. |
| `tools/nx refart trace IMG` | Engraved line art for `rasterArt()` (dark lines on white) + `<stem>_trace.json` + a preview in both engine looks. Example: `examples/refart-kidney/run.sh`. |
| `tools/nx new <dir> … [--fake-vo] [--selftest]` | One-call scaffold (`tools/new_episode.py`): init, install, voice data, captions, per-chapter packs, KIT_INDEX.md, a BUILD_BRIEF.md, a dev server on a free port; `--selftest` runs qa on C0. `--data` after a real voice pass; `--packs` after a script change. |
| `tools/nx quote-budget <ep> [--timing]` | Translation-panel budget of every `public/papers/**/quotes.json`: ≤ 30 words and ≤ 3 numbers per panel; a Short panel over 20 words needs a `tr_short` (≤ 15); with `--timing`, 2.5 s of page + the hold fits the quote's own lines. |
| `tools/nx pron <ep> "a line"` | How the TTS will say a line under `voice.pronounce`, and the canonical round trip. |
| `tools/nx doi check <files or DOIs>` | Cached DOI verification (`tools/doi_cache.py`; cache `$DOI_CACHE` or `./doi_cache.jsonl`): verifies only the misses, prints one summary line. Never re-verify a DOI the cache marks ok; never invent one. |
| `tools/nx kit <ep>` / `kit <ep> show <name>` | `KIT_INDEX.md` (every kit export: signature, doc line, file:line, uses); `show` prints one export's source. Read these, not old scene files. |

Anatomy on screen is a real plate: a flattened vector (`refArt`) or a cleaned, traced PD raster (`rasterArt`). Draw
anatomy procedurally only if `refart find` returns nothing usable, and say so in your report. Before anything is
published, `verify-fresh` must pass on it.

