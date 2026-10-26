# Story music

Score an explainer the way a composer scores to picture: a few mood beds that change where the story turns, each
crossfade ending on the word where the turn lands, ducked under the voice, with a subtle lift on "insight" words.
`tools/music.py` does it; `assemble.py` and `make_shorts.py` use the result. The research behind the design (sources,
licences, generators) is in `docs/research/2026-10-25-story-music.md`.

## Quick use

```sh
# episode.json
"music": "library"            # or "elevenlabs", "reuse", or "none" (the default); or an object, see Settings
```

```sh
tools/nx music <ep> plan      # music/music_plan.json: sections, crossfades, accents (and warnings)
tools/nx music <ep> fetch     # library mode: download the demo tracks (sha256-checked) into ~/.cache/vibe-animator/music/
tools/nx music <ep> reuse --dry-run      # free: which cached takes/sections would cover this plan
tools/nx music <ep> generate --dry-run   # cost estimate + the request; spends nothing
tools/nx music <ep> generate --yes       # elevenlabs mode: compose ONE take (or set music.max_credits)
tools/nx music <ep> mix       # music/mix.wav: voice + ducked bed, -14 LUFS (assemble does this by itself)
tools/nx music <ep> measure   # loudness, true peak, ducking depth, bed under the voice, bed in the gaps
tools/nx music cache list     # the private cache of takes (~/.cache/vibe-animator/music/index.json)
tools/nx assemble <ep>        # the master carries the mix; --no-music for the voice alone
```

With music on, `assemble.py` builds (or reuses) `music/mix.wav` and muxes it instead of `vo/voice.wav`. The video is
still stream-copied; music is audio-only work. Shorts slice the same mix (`make_shorts.py`, both in the chapter pass
and separately). **A music failure never blocks a render**: it prints `warning: music skipped, voice only (…)` and
the master gets the narration alone. **`assemble`, `mix` and Shorts never call the music API**; only `generate`
spends credits (section 3b).

## 1. Script schema

```json
{"id": "C1-L4", "text": "…", "mood": "struggle"}
{"id": "C2-L1", "text": "One short equation predicts it.", "mood": "hope", "mood_cue": "equation"}
{"id": "C2-L3", "text": "And suddenly it clicks.", "mood": "insight", "mood_cue": "clicks"}
```

- `mood`: `wonder | struggle | tension | hope | resolution | none` (none = silence), plus `insight`. A mood carries
  forward to later lines until another one appears, so only the turns need it. Lines before the first mood take the
  first mood; a script without any mood uses `default_mood`.
- `insight` is an **accent, not a track change**: the current bed lifts by `accent_db` (+4 dB) for about 3 s,
  peaking just after the cue word, after the ducking so it is heard through the voice.
- `mood_cue`: the word of the line where the turn (or the accent) lands. Default: the line's first word.
  (`cue_word` in the visual brief is a different field, for scenes.)
- `check_script.py` rejects unknown moods and a `mood_cue` that is not a word of the line.

## 2. The plan (`music/music_plan.json`)

Computed from `script.json` + `timing.json` (word times) by `compute_plan()`, unit-tested in `tools/test_music.py`:

- Section *i* is fully in from `start` (the first word of its first line, or its `mood_cue`) to the next section's
  `start`. The first section plays from 0 and fades in over `fade_in` (1.5 s); the last fades out over `fade_out` (3 s).
- **Each crossfade ends exactly on the cue word**: `fade = [start − d, start]`, with `d` the pause before the word
  clamped to `fade_min`…`fade_max` (1–2.5 s). A long pause holds the whole fade; a short one lets it start under the
  last words of the previous line (which are ducked anyway).
- A section shorter than `min_section` (3 s, also the API minimum) is merged into the previous one; under
  `warn_section` (8 s) it is kept with a warning, since short sections sound like channel-surfing.

## 3. Sources

### Library mode (free, offline after one download)

`tools/music_library.json` is a manifest: URL, sha256, duration, loudness, mood and the exact credit lines of five
Kevin MacLeod tracks (incompetech.com, **CC BY 4.0**): Dreamy Flashback (wonder), Lightless Dawn (struggle),
Darkling (tension), Inspired (hope), Wholesome (resolution). The files are not in git; `fetch` downloads them
through `fetch_ref.py` and checks the sha256. `music/CREDITS.txt` collects the credit lines of the tracks a mix used:
**paste them into the video description** (CC BY requires it; see `THIRD_PARTY.md`).

Each section is gained to `bed_lufs` from the track's measured loudness. A mood that comes back continues its track
where it stopped; a section longer than the rest of the track loops it (with an audible seam at the loop point: pick
long tracks for long sections). Point `music.library` at your own manifest (same fields) and pick tracks per mood
with `music.tracks`: `{"wonder": "dreamy-flashback"}`.

### ElevenLabs mode (generated, scored to the plan)

**Choice: one composed track per request, with a `composition_plan` of one section per mood**, rather than one
track per mood joined with crossfades. A composition plan fixes every section's `duration_ms`, so the model composes
the transitions themselves, on time, in one key and instrumentation; per-mood tracks would need seams that never
quite match. Insight accents become a short extra section ("Hope, insight": the same mood plus "a subtle lift, soft
bell accent"), which keeps them inside the composition.

API facts, from the official docs (`POST /v1/music`, checked 2026-10-25):
- `model_id` `music_v1` (the API default) takes `composition_plan: {positive_global_styles, negative_global_styles,
  sections: [{section_name, positive_local_styles, negative_local_styles, duration_ms, lines}]}` plus
  `respect_sections_durations: true`; `music_v2`/`music_v2_5` take `{chunks: [{text, duration_ms, positive_styles,
  negative_styles}]}` and always keep durations. Both shapes are implemented (`music.elevenlabs.model`).
- Instrumental: no lyric lines, and "vocals, singing, lyrics, choir, spoken word" as negative styles
  (`force_instrumental` only works with a plain prompt).
- Limits: each section 3–120 s; at most 30 sections; a song of at most 5 minutes (the overview page; the plan page
  says 10). So `requests_for()` splits sections longer than 120 s, and cuts the video into requests of at most
  `max_request_s` (290 s), preferably at a mood change. A later request starts `overlap` (2 s) early and the two are
  crossfaded, ending on the boundary.
- Needs a paid plan and an API key with the **`music_generation` permission** (keys can be scoped; a TTS-only key
  answers 401 `missing_permissions`, which is what our test key did).

Generated files go to `<episode>/music/cache/<hash of the request>.mp3` with a `.json` beside it (the request, the
song id, the time it took and the account's character counter before/after), and are copied into the private cache
(3c). The episode cache is git-ignored: **never commit ElevenLabs output** — the music terms forbid building a
redistributable music library (§4.2). A plan that changes (re-voiced lines move the sections) is a new request.
`assemble` never calls the API: with a stale cache it warns and keeps the voice alone (the old
`elevenlabs.auto_generate` switch is gone and ignored). Follow each platform's AI-disclosure rules for the generated
music (music terms §4.4).

### 3b. Cost guard (`generate`)

Added after the trailer run of 2026-10-25 spent 5,428 credits instead of ~2,600: an 18 s test (248), the kept take
(2,590) and a second, unrequested take with harder prompts (2,590). The rules, all unit-tested in `tools/test_music.py`:

- **Estimate first.** `generate` always prints `seconds × CREDITS_PER_SECOND` (13.8 credits/s, measured on the trailer
  on 2026-10-25, a constant at the top of `tools/music.py`; update it when ElevenLabs changes prices), the episode's
  spend so far and its budget. `--dry-run` stops there and also prints the request.
- **Consent or budget.** It spends only with `--yes` or a budget: `music.max_credits` in `episode.json` (the
  episode's total over all takes, summed from `music/spend.jsonl`) or `--max-credits N` (this call). A budget is a
  hard cap, also with `--yes`.
- **Exactly one take per call**, one request per ≤ 290 s of video, each sent once (no retries, no loops). If the
  episode already has a take, any new one (same plan, changed prompts, or a re-timed plan) needs **`--retake`**,
  which is checked against the budget like the first; the earlier file is kept as `<hash>.<timestamp>.mp3`.
- **Reuse first.** Before a first take it runs the `reuse` search (3c); if the private cache already covers every
  section it refuses and points at `"mode": "reuse"`, unless `--fresh`.
- **Spend log.** Every generation appends to `music/spend.jsonl`: time, take, request hash, model, seconds, the
  estimate and the measured counter delta, song id. The trailer's three earlier spends are back-filled there.
- `assemble`, `mix` and `make_shorts` never generate.

### 3c. Private cache and reuse (free)

Every generated take is also copied into a **local, user-level, git-ignored** cache:
`~/.cache/vibe-animator/music/takes/<sha>.mp3` (+ its request `.json`), indexed in
`~/.cache/vibe-animator/music/index.json` by mood sequence, prompt hash (the full request), style hash (model + global
styles), duration, model, date, measured loudness and per-section tempo (from the `NN bpm` in the styles, else an
onset-autocorrelation estimate), plus a label, a note and a `rank` (−1 = avoid). `VIBE_MUSIC_CACHE` moves it.

- **Licence.** ElevenLabs' terms forbid redistributing generated music as a library. The cache stays private: it lives
  outside every repository, is never committed and never shared. Reusing your own takes in your own videos is fine.
- `tools/nx music cache list` shows it; `tools/nx music <ep> cache add [--label L] [--note N] [--rank R] [file.mp3 …]`
  indexes takes (default: every take in the episode's `music/cache/`). The trailer's take 1 (`trailer take 1`, rank 0,
  used in the master) and take 2 (`trailer take 2`, rank −1: struggle texture late, two hard dropouts) are in it.
- `tools/nx music <ep> reuse [--dry-run]` fits the episode's plan from the cache, section by section: a run of the same
  mood (consecutive sections of one take; else a neighbouring mood: tension ↔ struggle, resolution → hope/wonder),
  preferring higher rank, no loop, an unused run, the same style hash, then the longest. A run longer than the section
  is trimmed from a bar-aligned point (a mood that returns continues where it stopped); one up to 3 s too short starts
  that much early, inside the take's own transition; a shorter one loops in whole bars (4 beats at its tempo, 4 s if
  unknown) with 1 s crossfades on the bar line. It writes `music/reuse_plan.json`; `"music": {"mode": "reuse"}`
  mixes from it (uncovered sections stay silent, with a warning). With an exact request already in the cache,
  `elevenlabs` mode simply copies the file back, free.

## 4. The mix (`music/mix.wav`)

One ffmpeg graph, two passes (measure, then apply):

```
[0:a] voice → asplit → [vo] [key]
[k:a] per piece: atrim (offset, length) → volume (to bed_lufs) → afade in/out (qsin, the plan's windows) → adelay
[p1]…[pn] amix normalize=0 → apad/atrim to the episode length → (volume=0 over "none" sections)        [bed]
[bed][key] sidechaincompress threshold=0.02 ratio=20 attack=20 release=300 knee=6 mix=m(duck_db)       [ducked]
[ducked] volume='1 + accent envelopes'                                                             [bedf]
[vo][bedf] amix normalize=0 → (alimiter, only if needed) → loudnorm I=-14 TP=-1.5 LRA=11 (pass 2: linear) → wav
```

- **Level: `bed_db` and `duck_db`.** Each piece is gained so the unducked bed sits at the voice's integrated loudness
  + `bed_db` + `duck_db`; after ducking by `duck_db` it is `bed_db` under the voice during speech, and back at full
  level in the gaps and the end card. Defaults (documentary): `bed_db` −15, `duck_db` 6. The trailer: −10 and 5.
  `bed_lufs` (absolute) still overrides.
- **Bounded, soft ducking.** A high ratio with a soft knee (6), attack 20 ms, release 300 ms, and the depth limited
  through the compressor's dry/wet `mix`: `m = (1 − 10^(−duck_db/20)) / 0.74` (0.74 = 1 − the fully compressed gain
  averaged over speech, measured on the trailer narration), so the bed dips by about `duck_db` and never vanishes.
- Only the voice is in the key, and the voice itself is never processed (no carving, no compression).
- The two-pass `loudnorm` is linear (a static gain). When that gain would push the peaks over the ceiling, a lookahead
  `alimiter` holds them 0.7 dB under it first, so loudnorm still does not pump.
- `mix.wav` has a receipt (voice, plan, track files) and the settings' hash; it is rebuilt only when one changes.

## 5. Measured

`examples/trailer` re-mixed 2026-10-25 from the cached take 1 (no API call), `bed_db` −10, `duck_db` 5, `fade_out`
1.5 s: master −14.0 LUFS, true peak −1.7 dBTP (AAC master and mix alike), LRA 3.5 LU; ducking 4.9 dB; bed 10.1 dB
under the voice during speech; in the gaps 5.5 dB louder than under speech and at its unducked level (+0.3 dB). The
first mix (−25 LUFS bed, 8.3 dB ducking, bed 18.9 dB under the voice) was inaudible to the owner.

Older measurements, with the old defaults (`bed_lufs` −25, threshold 0.04, ratio 8, release 450 ms, no `mix`):

`examples/lens` (23 s, fake voice with `--tone`, moods wonder → insight accent → tension → resolution, library mode):

| | value |
|---|---|
| master (AAC) integrated | −13.9 LUFS, LRA 1.4 LU |
| mix true peak | −10.3 dBTP |
| ducking depth under speech | 12.5 dB |
| bed under the voice | −26 dB |

A real narration (a 13.7-minute episode, 8 sections, library mode): −14.0 LUFS, −3.4 dBTP, ducking 9.3 dB
averaged over the speech windows (the bed swells back in the short pauses inside lines), bed 19.9 dB under the voice,
back at full level in the gaps between lines (+0.1 dB vs unducked). Mixing took about 33 s including the measurement.

## Settings (`episode.json` → `"music"`)

`"music": "library"` is shorthand for `{"mode": "library"}`. Every key and its default is in `DEFAULTS` at the top of
`tools/music.py`: `default_mood`, `bed_db` (−15) / `duck_db` (6) / `bed_lufs` (None), `duck` (threshold, ratio,
attack, release, knee), `fade_min` / `fade_max` / `fade_in` / `fade_out`, `min_section` / `warn_section`,
`accent_db`, `loudness` (−14) / `true_peak` (−1.5) / `lra`, `max_credits` (None), `shorts` (true: Shorts use the
mix), `library`, `tracks`, and `elevenlabs` (`model`, `api_key_env`, `styles`,
`negative_styles`, `max_request_s`, `overlap`, `seed`, `mood_styles`, `mood_negative_styles`,
`section_styles`, `counter_wait`). Mood → style lists are in `MOOD_STYLES`; `mood_styles` replaces them per mood, and
`section_styles` (line id → styles) starts a new composition section at that line's first word (or `mood_cue`)
inside its mood section, or restyles an insight accent. `examples/trailer/episode.json` uses both to follow its
`MUSIC_PLAN.md` row by row.

## Limits and open points

- Shorts slice the master mix, so a Short starts mid-bed (its voice starts there too); no extra fade.
- Library loops have a seam; long sections want long tracks. No bar-snapping of fades (no BPM in the manifest yet).
  Reuse mode loops in whole bars, but its tempo estimate can lock onto double time (the trailer's struggle run reads
  139.5 bpm for a ~70 bpm pulse: still bar-aligned, half-bar loops), and a crossfade on a bar line is not a musical
  edit: listen to looped sections.
- `CREDITS_PER_SECOND` is one measurement on one plan and model; the spend log's measured deltas are the check.
- ElevenLabs Music, run end to end on the trailer (2026-10-25, Creator plan, `music_v1`): about **13.8 credits per
  second** of music (248 for an 18 s test, 2,590 for the 188.4 s score), 30–35 s per request. The character counter
  lags the call by some seconds, so `generate` polls it (`counter_wait`). First mix: −14.0 LUFS, −2.5 dBTP, ducking
  8.3 dB, bed 18.9 dB under the voice (too quiet; re-mixed, see section 5). The composed sections are seamless (no clicks at joins) and harmonic changes land near
  the early section boundaries, but the model does not always *mark* a mood turn: in the kept take the struggle and
  hope turns are gradual. A second take with harder contrast prompts ("sudden shift to D minor", negative local
  styles) marked the struggle texture ~2 s late and added two hard dropouts, so it was not used.
- A voice-band carve of the bed (about 250 Hz–2.5 kHz, −6 to −8 dB before the sidechain) would allow less ducking;
  not implemented.
