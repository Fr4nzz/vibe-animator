---
name: vibe-animator
description: Produce a narrated explainer video (long-form episode plus vertical Shorts) with the vibe-animator engine. Use when creating a new episode, writing or reviewing an episode script, building or fixing a chapter scene, running layout QA or contact sheets, rendering chapter clips, assembling the master, or making Shorts and subtitles from an episode folder (one with episode.json and engine/).
---

# vibe-animator

A script becomes word-timed narration, the narration drives a canvas/WebGL engine (default look: "engraved treatise") where every
visual hit is a word cue, and the clips are assembled into a 16:9 master, vertical Shorts and subtitles.
`<repo>` = the repo containing this skill; `<ep>` = an episode folder.

## When to use

- "Make / start a new episode", "write the script", "voice it", "build chapter C3", "why is this text cut off in the
  Short", "render", "assemble", "make the Shorts".
- Not for a one-off motion graphic without narration or chapters.

## Pipeline map (all through `<repo>/tools/nx <cmd> <ep>`)

| Step | Command | Read first |
|---|---|---|
| new episode | `nx new <ep> --id … --title … --script s.json [--fake-vo --selftest]` | `docs/CONFIG.md`, `docs/AGENT_WORKFLOW.md` |
| script | `script.json`, `nx check <ep>`, `nx doi check …`, `nx quote-budget <ep>` | `docs/templates/SCRIPT_BRIEF.md`, `docs/TONE.md` |
| voice | `nx vo <ep>` (`ELEVENLABS_API_KEY`) or `nx fake-vo <ep>` (none) | `docs/CONFIG.md` (voice, `pronounce`) |
| engine data + captions + packs | `python3 tools/new_episode.py <ep> --data` (or `nx prep <ep>`) | — |
| preview | `nx dev <ep> <free port>` | `engine/README.md` |
| build a chapter | write `engine/app/src/scenes/c<N>.ts` | `docs/AGENT_WORKFLOW.md` Part 1, your `packs/C<N>.md`, `docs/STYLE_GUIDE.md`, `examples/lens/scenes/` |
| QA | `nx qa <ep> --chapter C3 --url …`; `nx sheet <ep> C3 --url …` | `docs/WORKFLOW.md` (what qa checks) |
| render (orchestrator only) | `nx render <ep> --all-pending --jobs 2`, then `nx wait-renders <ep>` | `docs/WORKFLOW.md` (machine rules) |
| master / Shorts / subs | `nx assemble`, `nx shorts`, `nx srt` | `docs/STYLE_GUIDE.md` §D |
| sanity check of an install | `tools/smoke_test.sh`; the lens demo (`examples/lens/README.md`) | `examples/hello/README.md` |

## Scene-builder essentials (details in docs/AGENT_WORKFLOW.md)

- One `ShotScene` per chapter (`_shots.ts`); devices in `_devices.ts`; reference art via `refArt('name', width)` from
  `engine/app/public/refs/` (credits in its `SOURCES.md`); paper beats via `paperBeat` (`_papers.ts`); formulas,
  axes and plots via the manim-web layer (`ManimLayer`, `_manim.ts`).
- Every cue is a word lookup: `this.q.w('C3-L8', 'word')`. Never a hard-coded second.
- Loop: read your pack → storyboard → build → `qa` until `TOTAL 0` → one contact sheet, strips, one still per new plate
  → write `engine/work/renders/CK.ready` → report in ≤ 5 lines. Builders never render and never start background jobs. Don't re-read files you just edited; don't screenshot full-size stills to check layout.
- Write only your `c<N>.ts` files and one private kit. The orchestrator owns `timeline.ts`, the engine core, the
  generic kits, `engine/data/`, `timing.json`, `script.json`.

## Hard rules

- **Type floors (on screen, after zoom):** headline 96 · statement 44 · label/axis 30 · kicker/citation 24 ·
  translation 40 · protocol card 56/36. Bigger when there is room; fewer words rather than smaller type.
- **Shorts:** on lines inside a `short` unit, all text inside x 420–1500. Captions own y > ~928.
- **One glowing colour** (signal layer) for the series protagonist; everything else hairline and muted.
- **Tone:** confident advocacy; honesty concentrated in one chapter; caveats moved there, never dropped; no
  evidence-tier tags; myth cards only against critics' myths; safety as calm protocol cards sorted into the four
  buckets (contraindicated / requires monitoring / under-studied / implementation error).
- **Evidence:** never invent a citation, identifier or data point; never fabricate a paper page (typeset card
  instead); highlight only text that is on the page; on-screen numbers match the fact check and the narration.
- **Machine:** one headless browser at a time under the shared `flock` lock (`render.lock` / `HARNESS_RENDER_LOCK`),
  only with ≥ `min_free_gb` free; the scripts do this themselves, any other browser you start must too. Never kill
  processes or restart dev servers you did not start; use a free port. Big temp files in `engine/work/` or
  `/var/tmp`. Never write `engine/renders/*.mp4` in place (use `nx render`). Queue long renders and end the turn.
- **Secrets:** API keys only in environment variables (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`). Never print or
  commit them. Run `nx verify-fresh` before publishing anything; upload private first.
- **Assets:** only CC0 / CC BY / public-domain art, logged with its licence in `refs/SOURCES.md`; credit CC BY in the
  description. **Never draw anatomy procedurally**: `refart find` → `refart clean` (inpaint labels) → `refart trace`,
  else ask for an asset agent. Download only through `fetch_ref` (no personal data in requests).
- **Reviews:** the contact sheet is for layout; every new plate also gets one full-size still or crop for craft. A
  weakness a builder reports that breaks a style rule blocks the asset until fixed or waived by the user.
- **Tokens:** never block more than ~4 min in one call (subagent caches expire at ~5 min and the whole context is
  re-written); queue long jobs and end the turn. Find helpers with `kit_index.ts`, not by reading old scenes.
- **Lessons:** read `docs/LESSONS.md` once per project; it lists the mistakes agents actually made.
