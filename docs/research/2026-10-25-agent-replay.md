# Agent-session replay scenes (research and design spike, 2026-10-25)

**Question.** The trailer's cold open types «Make me a trailer.» but never shows the AI working. Can we show a real
harness in action (short progress lines, tool calls, subagents fanning out, results streaming) from real chat
histories, as a reusable tool?

**Answer.** Yes. Recommended: **Option A, an engine-native replay kit fed by a scrubbed `session.json`**. A working
prototype is in the repo: `tools/session_import.py`, `examples/agent-replay/` (kit, scene, real scrubbed session).
It replays the real trailer C1-builder session (471 s, 32 tool calls) beside the six-builder fan-out in about 13 s;
qa `TOTAL 0` with `--every 1`, the kit type-checks.

## 1. T3 Code

- **Open source:** `pingdotgg/t3code`, **MIT** (© 2026 T3 Tools Inc.), TypeScript monorepo (`apps/web`, `server`,
  `desktop`, `mobile`, `marketing`; Effect, Vite). The web UI is served by the local `t3` server (`t3` starts it and
  opens the web app); it is not a standalone static page: it needs a running T3 server with threads behind it.
- **Share/replay view:** there is a *guest share* (`apps/server/src/guest/GuestShareService.ts`): a signed, expiring
  (TTL) link to a live thread. No replay or export-to-video mode was found.
- **Brand:** the MIT licence covers the code, not the name or look. T3's terms of service: "You may not use our
  trademarks, service marks, or trade dress without written permission." A screen capture of the T3 UI in a public
  trailer shows its trade dress; that needs permission or a style that only evokes it.
- **How another of the owner's projects (a lab web app) uses T3:** as a stock T3 install embedded in the app's «Asistente» tab
  (`server/t3bridge.mjs`: the app proxies T3's page loads and injects a small bridge script that reports the open
  chat via `postMessage`); it reads T3's database read-only to link proposals to chats and tool calls
  (`server/t3chats.mjs`), provisions per-person T3 projects (`scripts/t3-provision.mjs`) and updates T3 from an admin
  dialog (`scripts/t3-update.mjs`). Nothing in it renders or replays chats.
- **Local state** (queried read-only):
  - `~/.t3/userdata/state.sqlite` (T3 ≤ 0.0.45; last write 2026-09-27): `projection_thread_messages` (role, text,
    turn_id, created_at) and `projection_thread_activities` (kind, tone, summary, payload_json, sequence). Tool calls
    are `tool.started` / `tool.updated` / `tool.completed` with `payload.data.item` (command, cwd, exitCode,
    durationMs, aggregatedOutput); subagents are `task.started` / `task.progress` / `task.completed` (taskId, title,
    agentKind, model, token usage, summary); plans are `turn.plan.updated`.
  - `~/.t3-orchestrator-v2/userdata/statev2.sqlite` (Orchestrator V2, current; `state.sqlite` there is empty):
    `orchestration_v2_projection_turn_items` (thread_id, run_id, ordinal, type, status, payload_json). Types seen:
    `user_message`, `assistant_message` (text, streaming), `reasoning` (text; not shown), `command_execution` (input),
    `dynamic_tool` (toolName, input, output), `file_change` (fileName, diffStr), `web_search`, `subagent` (title,
    prompt, progress, result, childThreadId), `todo_list`, `checkpoint`, `compaction`, `notification`, `error`.
    Subagents also have `orchestration_v2_projection_subagents` (provider, child_thread_id, status, started/completed).
    `startedAt` / `completedAt` on every item give the timing.

## 2. Claude Code transcripts

`~/.claude/projects/<project-slug>/<session>.jsonl`, one JSON record per line; subagents in
`<session>/subagents/agent-<id>.jsonl` plus `agent-<id>.meta.json` (`description`, `agentType`, `toolUseId` of the
parent's `Agent` call). Record `type`s: `user`, `assistant`, `attachment`, `api-request`, `api-request-blob`,
`api-request-shape`; each has `timestamp` (ISO, ms), `uuid`/`parentUuid`, `isSidechain`, `cwd`, `sessionId`.

- `assistant.message.content[]`: `text`, `tool_use` (`id`, `name`, `input`), `thinking` (`thinking`, `signature`).
  In this session thinking is **summarized** (`thinkingDisplay: "summarized"`, `thinkingDurationMs` on the record);
  the text is a summary and is never shown. The replay shows only "thinking · N s".
- `user.message.content[]`: `tool_result` (`tool_use_id`, `content` string or blocks, `is_error`); the result's record
  timestamp is the call's end. The first user message is the prompt, *but user records and attachments also carry
  system reminders, CLAUDE.md files, memory and the account email*: never copy them.
- Bash `input.description` is a ready-made progress line ("Run qa on C1"); builders write almost no assistant text
  between calls (the C1 builder: 32 tool calls, 1 final text), so the descriptions *are* the progress messages.

## 3. Privacy

The source transcripts live under a folder named after a private repository and contain personal context in their
user records. Candidates: the subagents that built the trailer (first user message mentions vibe-animator/trailer):
scaffold, music, C0–C6 builders, fix rounds, score. The prototype uses the **C1 builder** (`agent-acede…`) and, for
the fan-out, the six builders launched at 20:57 (descriptions from `meta.json`, start/end, tool-call titles).

`session_import.py` scrubs on the way out: it reads only tool_use (allow-listed names), tool_result, assistant text
and thinking *duration*; rewrites `--rewrite OLD=NEW` paths, then any `/home/<user>` to `~`; redacts emails, keyed
URLs and token-shaped strings; truncates every field to one line; summarises file dumps as "N lines" (only verdict
lines such as `TOTAL 19 …` are quoted; a doc line once leaked off-topic vocabulary through the "last line" rule);
applies a deny-list (`--deny-file`, regex per line): a hit drops the event (title) or blanks the field
(argument/result). A final audit refuses to write (exit 3) if any deny pattern, email or home path survives. The
project-specific deny file lives outside the repo (`/var/tmp/agent-replay/deny.txt` for this spike). Every string in
the committed example was read by eye: titles, results and lane steps are trailer/framework work only. `--prompt`
replaces the builder's long prompt with «Make me a trailer.» (`prompt_source: "override"` in the JSON).

## 4. Options

| | A: engine-native replay kit | B: Playwright capture of the T3 web UI |
|---|---|---|
| Determinism | pure function of t; seekable; qa and stills work | live app, websocket streaming, animations on wall clock: needs a fake server or record-then-cut |
| Data | any source (Claude Code jsonl, T3 sqlite) → one schema | only threads inside a running T3 with real data, so the private content is on screen until scrubbed in T3 itself |
| Privacy | scrub before render, audited | the UI shows project names, paths, sidebar with other chats |
| Style | engine palette, word cues, 24 px floor, captions band respected | T3's look; type size and layout not ours |
| Licence/brand | ours | code MIT, but T3 trade dress needs permission for a public trailer |
| Cost | one kit (~300 lines) | a T3 instance, seeded DB, Playwright scripting, re-capture on any change |

**Recommendation: A**, styled to *evoke* an agent harness (chat column, tool chips, spinner, fan-out tree) in the
engine's own palette and IBM Plex Mono, without T3's or Claude Code's logos, colours or layout. A cheap live run
(Haiku) adds nothing over replaying the real sessions we already have; a fake chat loses the "this really happened"
claim, which the kicker states ("REAL SESSION · 7 MIN 51 S SHOWN AT ~36×").

## 5. The prototype

- `tools/session_import.py claude|t3 …` → `session.json` (`version, source, label, prompt, duration, real_seconds,
  events[{t, kind: tool|text|thinking, name, title, arg, result, status, t_end, secs, text}], lanes[{label, t0, t1,
  main, steps[{t, title}]}]`) and optionally a `.ts` module (scenes copy only `*.ts`). Time: each real gap is
  compressed (`sqrt` by default, `--cap 600 s`, `--min-gap`), then scaled to `--duration`; order is kept. Tested on
  the C1 builder (34 events, 6 lanes) and on one T3 V2 thread (30 events; counts only were printed).
- `examples/agent-replay/scenes/agent_replay_kit.ts`: `drawPrompt` (typed prompt, signal caret), `drawChat` (rows
  open over 0.28 s and push the column up; tool cards with name chip, title typed in, mono argument, `→ result` when
  the call ends, spinner/active bar on the signal layer while running, tick or cross after; thinking pill; final text
  in serif italic), `drawFanout` (orchestrator node with running/done counts, spine, one lane per subagent with
  spinner or tick, call counter, current step), `replayKicker`. `toScene`/`toSess` stretch the session onto two word
  cues.
- `examples/agent-replay/scenes/c0.ts` (16 s, fake voice): L1 types the prompt; on "orchestrator" the prompt rises and
  the replay opens; it ends with L3.
- Stills: `/var/tmp/agent-replay/ep/engine/work/qa/sheet_C0_30-60-end.png`, `still_C0-L3_11.61.png`,
  `strip_C0-L2.png`.

**Known limits.** At 36× the first 10 reading calls pass in about a second: the column scrolls fast (it reads as
"busy", individual cards are not meant to be read). Text sits at the 24–28 px floors; a trailer cut would zoom the
camera onto the chat column for a beat. Long lane labels are cut with an ellipsis. T3 V1 (`projection_thread_activities`)
is not imported. Next step if adopted: promote the kit to `engine/app/src/scenes/_agent_replay.ts` (generic kit,
KIT_INDEX) and add a `tools/nx replay` wrapper.

## 6. Using it in the trailer's C0

C0 now: L1 «Make me a trailer.» (DIRECTOR) → L2 "One sentence. That is the whole brief." → L3 "Script, voices,
scenes and cuts: Claude Code agents make them all." (four labels, agent nodes light up) → L4 flash frames → L5.

Proposal: keep L1–L2; on L3 replace the four static labels with **6–8 s of the real replay**: the prompt rises, the
fan-out panel opens on "agents" with the real builder lanes (C0 … C5+C6), and the chat column streams the C1 builder
until its `TOTAL … ` verdict and report, then the panels collapse into the flash frames of L4. Since L3 is about 6 s,
either stretch the replay window from `q.w('C0-L3', 'Script')` to `q.end('C0-L3')` (about 5.9 s at ~80×), or add one
short line before L4 (for example "Six builders, at once.") to buy the 6–8 s. Generate the session with
`--duration 8`, copy `agent_replay_kit.ts` and `agent_session.ts` into the trailer's scenes, and call `drawFanout` /
`drawChat` from C0's L3 shot. Nothing in `examples/trailer/` was changed by this spike.
