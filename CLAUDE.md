# Working on vibe-animator

This file is for agents (and people) changing the framework itself. Agents *using* it to make an episode read
`docs/AGENT_WORKFLOW.md` instead; the skill in `skills/vibe-animator/` routes them there.

## What this repo is

A pipeline for narrated explainer videos: `script.json` → ElevenLabs narration with word timings → one canvas/WebGL
scene per chapter, cued to words, built by parallel agents → a deterministic GPU render → a 16:9 master, vertical Shorts
and captions. The engine template in `engine/` is copied into each episode; `tools/` is the Python pipeline behind the
`tools/nx` dispatcher.

## Before you commit

```sh
(cd engine/app && bun install && bun run typecheck)          # the engine and its scripts type-check
python3 tools/test_receipts.py                               # receipts unit tests
python3 tools/test_music.py                                  # story-music plan, cost guard, cache/reuse tests
python3 tools/test_voices.py                                 # multi-voice narration unit tests
python3 tools/test_vo_level.py                               # per-line loudness leveling (voice.line_lufs)
tools/smoke_test.sh                                          # fake voice → data → qa → stills → 3 s encode (~30 s)
tools/nx new work/lens --id lens --title "How a lens focuses light" \
  --script examples/lens/script.json --scenes examples/lens/scenes --fake-vo --selftest   # ends "TOTAL 0"
kill "$(cat work/lens/engine/work/vite.pid)"
```

If you changed a kit export, regenerate the index: `(cd engine/app && bun scripts/kit_index.ts --out KIT_INDEX.md)`.

## Hard-won machine rules (keep them; each one cost real time)

- **Deterministic seek.** A scene is a pure function of time `t`: no `Date.now()`, no `Math.random()` without a seeded
  generator, no state carried between frames that a backward seek cannot rebuild. QA samples lines out of order and
  stills are taken at arbitrary times; renders must be reproducible bit for bit. Layers that mutate state (manim-web)
  rebuild on a backward seek (`_manim.ts`).
- **Word cues, never seconds.** Every visual hit is `q.w(lineId, word)` / `q.s` / `q.e` / `q.end`. A re-voiced line
  must keep its sync without touching the scene.
- **One render lock and a memory gate per machine.** Every headless browser runs under the shared `flock`
  (`render.lock` / `HARNESS_RENDER_LOCK`) after MemAvailable ≥ `min_free_gb`; chapter renders take one of two slots
  (`<lock>`, `<lock>.2`), QA and stills stay on slot 0. New browser-launching code goes through `lib.ts`
  (`ensureLocked`, `launch`), which also refuses software WebGL.
- **No blocking call longer than ~4 minutes** in an agent-facing tool: `--budget` (default 200 s), then exit 75 "lock
  busy, rerun later". Subagent prompt caches expire at ~5 minutes; a long wait re-writes the whole context.
- **Never write outputs in place.** Stage, ffprobe-check (frames and duration ±1 frame), rename. Review copies may be
  hard links. Every clip, master and Short gets a receipt with input hashes; pending is by content hash.
- **Never wait with `pgrep -f`** on a pattern that appears in your own command line; wait on a PID, a lock or a file
  (`tools/wait_renders.py`).
- **Block hot reload during renders** (`lib.ts` does it for export pages); never restart dev servers you didn't start.
- **qa is the style guide in machine form.** When you change a threshold in `docs/STYLE_GUIDE.md`, change `qa.ts` in the
  same commit (`square` x 420–1500, `size` 24/40 px, `caption` y > 928, `cue`, `hold`, `squeeze`, `type`).
- **Big temp files** go in `engine/work/` or `/var/tmp`, never `/tmp`.

## Content rules for this repository

- **No secrets, ever.** Keys come only from environment variables (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`). No
  voice ids, tokens, account names, personal paths or emails in code, docs, examples or commit messages. Requests to
  third parties go through `tools/fetch_ref.py` (fixed User-Agent, no personal data).
- **Examples stay neutral** (optics, combustion, algebra) and ship no media beyond tiny fixtures.
  Exception: `examples/trailer/` may ship its T3 Code frame assets (`engine/app/public/t3/`, WebP, ≤ ~15 MB): they
  are the trailer's on-screen proof of the real session and the typed prompts, cannot be regenerated without an
  isolated T3 instance, and passed the privacy audit (OCR + DOM text, 0 hits). Nothing else large.
- **Assets:** only CC0, CC BY or public-domain art, each logged with author, licence and source URL in
  `engine/app/public/refs/SOURCES.md` in the same commit; `THIRD_PARTY.md` stays complete. No share-alike,
  non-commercial or unknown-licence files; never pages of copyrighted papers.
- **Never invent a citation, DOI or number** in docs or examples.
- `docs/LESSONS.md` records only mistakes agents actually made, with the rule and where it now lives. Add to it when a
  rule is paid for.

## Layout

`engine/app/src/engine/` core (from mexicat/pdoom-video, MIT) · `engine/app/src/scenes/` generic kits ·
`engine/app/scripts/` agent tools · `tools/` pipeline · `docs/` briefs and references · `examples/` · `skills/`.
`work/` is scratch and git-ignored.
