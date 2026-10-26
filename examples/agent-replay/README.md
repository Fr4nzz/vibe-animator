# Agent replay example

A 16-second chapter that replays a real agent session as video: the prompt types with the voice, a fan-out panel
shows six builder agents working at once, and a chat column streams one builder's tool calls and results. The data is
`session.json` (and the same data as `scenes/agent_session.ts`), made by `tools/session_import.py` from the Claude Code
transcripts of the agents that built this repository's launch trailer, scrubbed (no paths outside the repo, no
emails, no secrets, no prompt text) and time-compressed from 7 min 51 s to 12 s.

```sh
tools/nx new /var/tmp/agent-replay --id agent-replay --title "Agent replay" \
  --script examples/agent-replay/script.json --scenes examples/agent-replay/scenes --fake-vo --port 5741 --selftest
tools/nx qa /var/tmp/agent-replay --still C0-L3 --at 40 --url http://localhost:5741
```

Your own session (keep the deny file outside the repository):

```sh
python3 tools/session_import.py claude ~/.claude/projects/<project>/<session>/subagents/agent-<id>.jsonl \
  --fanout <sibling agent jsonl …> --deny-file ~/.config/vibe-animator/deny.txt \
  --rewrite /abs/path/to/repo=repo --prompt "Make me a trailer." --duration 12 \
  -o session.json --ts scenes/agent_session.ts
```

The kit (`scenes/agent_replay_kit.ts`): `drawPrompt`, `drawChat`, `drawFanout`, `replayKicker`. The scene stretches the
session's clock onto two word cues, so a re-voiced line keeps the replay in sync. Design notes:
`docs/research/2026-10-25-agent-replay.md`.
