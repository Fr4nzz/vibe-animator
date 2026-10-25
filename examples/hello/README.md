# Example episode: "How a candle burns"

Two short chapters with neutral content, enough to exercise every stage without a TTS key:

- `episode.json` — config (English, no number conversion, a Shorts brand line).
- `script.json` — 2 chapters, 4 lines, explicit line ids, one Short (`S01`, both lines of C1).
- `timing.json` — the output of `tools/fake_vo.py` for this script (estimated word times, 160 wpm). Kept for reference;
  the smoke test regenerates it, with a silent `vo/voice.wav`.
- `scenes/c0.ts`, `scenes/c1.ts` — the two chapter scenes, copied into the episode engine's `src/scenes/`. They show
  the pattern: one `ShotScene` per chapter, every hit a word cue (`q.w('C1-L1', 'oxygen')`), the signal layer used
  only for the one glowing thing, Short lines kept inside x 420–1500.

## Smoke test

```sh
tools/smoke_test.sh            # init → fake voice → data/captions → typecheck → qa → 2 stills → 3 s encode (~30 s)
tools/smoke_test.sh --full     # also both chapter clips, the master, the SRT and the vertical Short (~5 min)
```

It builds the episode in `work/smoke-hello/` (git-ignored) and ends with `== smoke test passed`. Browser steps take
the shared render lock: set `HARNESS_RENDER_LOCK` to the lock file the other projects on your machine use, so two
headless browsers never run at once.

Expected: `qa` prints `TOTAL 0`; the encode writes 90 frames at 1920×1080 with an audio track.
