# Demo episode: "How a lens focuses light"

About 23 seconds, two chapters, no TTS key needed (fake voice: estimated word timings and a silent track).

- `script.json` — 2 chapters, 4 lines, explicit line ids, one Short (`S01`, both lines of C1).
- `scenes/c0.ts` — "Bending light": rays drawn on word cues, a convex lens, the focal point as the one glowing thing
  (signal layer), a moving camera.
- `scenes/c1.ts` — "The lens equation": an object/image ray diagram computed from 1/f = 1/d_o + 1/d_i while the object
  slides, and the equation itself set and written in by the manim-web math layer (`ManimLayer`, `_manim.ts`). Both
  lines are a Short, so everything sits inside x 420–1500.

## Run it

```sh
tools/nx new work/lens --id lens --title "How a lens focuses light" \
  --script examples/lens/script.json --scenes examples/lens/scenes --fake-vo --selftest
#   1. episode lens … 2. engine data … 3. bun install … 4. packs … 6. dev server http://localhost:5730 …
#   7. selftest qa C0: TOTAL 0
tools/nx qa work/lens --url http://localhost:5730 --every 1              # TOTAL 0 · C0,C1 · 4 lines
tools/nx qa work/lens --url http://localhost:5730 --still C0-L2,C1-L2 --at end   # two full-size PNGs
tools/nx qa work/lens --url http://localhost:5730 --strip C1-L1 --n 6     # the object sliding, one strip
tools/nx render work/lens C0 C1 && tools/nx assemble work/lens            # chapter clips + master (+ the Short)
kill "$(cat work/lens/engine/work/vite.pid)"                             # stop the dev server when done
```

The port is the first free one from 5730; `new` prints it. For a real voice: `export ELEVENLABS_API_KEY=…
ELEVENLABS_VOICE_ID=…`, delete `work/lens/timing.json`, then `tools/nx vo work/lens` and
`python3 tools/new_episode.py work/lens --data`.
