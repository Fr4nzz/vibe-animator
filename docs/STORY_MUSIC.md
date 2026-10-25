# Story music (planned, not implemented)

Status: **design only.** Nothing in `tools/` reads `mood` yet, and `assemble.py` mixes the narration alone. The
research behind this design (music sources and their licences, generators, the ffmpeg graph) is in
`docs/research/2026-10-25-story-music.md`.

The idea: score an explainer the way a composer scores to picture. A few mood beds that change where the story turns,
crossfaded inside the pauses between lines, ducked under the voice, with an occasional short accent on a cue word.

## Where it fits

`tools/assemble.py` already stream-copies the chapter clips and adds `vo/voice.wav`, so a music bed is **audio-only
work in that same pass** (no re-encode, no GPU). `timing.json` already holds per-line and per-word times, which is all
the cueing needs.

## 1. Script schema

An optional `mood` on a line in `script.json`, carried over to later lines until it changes, so only the turns need it:

```json
{"id": "C1-L4", "text": "…", "mood": "struggle"}
```

Closed set: `wonder | struggle | tension | insight | hope | resolution`, plus `none` for silence. `check_script.py`
would check that the names are valid, that a mood segment lasts at least about 8 s (shorter sounds like
channel-surfing) and that there are no more than about 6 cues per 10 minutes. `insight` is a 2–4 s **sting or swell**
on the cue word, not a bed.

## 2. Track resolution: `tools/make_music.py <episode>` → `music/plan.json`

1. Merge consecutive lines with the same mood into segments `{mood, start, end}` from `timing.json`.
2. Resolve each mood, in order:
   1. a track from a music manifest (`music/manifest.json`: source URL, licence, attribution, sha256, `mood`,
      optional trimmed `start` and `bpm`) with enough length;
   2. otherwise one generated piece for the whole episode with a per-section composition plan (one section per mood
      segment, durations from `timing.json`), so the transitions are composed rather than seamed. Long episodes may
      need several requests.
3. Record source, licence, attribution and sha256 in a receipt, as `receipts.py` does for clips. Audio files are
   never committed: a `tools/fetch_music.py` downloads into an ignored `music/cache/`.

## 3. Transition timing

- A crossfade **ends at the first word of the cue line**: it runs over about 1.5–3 s inside the pause before it. When
  that gap is shorter than the fade, centre the fade on the gap.
- A line may carry `"cue_word": "…"`: the turn then lands on that word's start, the same mechanism the engine uses
  for visual hits.
- With a known `bpm`, snap the fade start to the nearest bar of the outgoing track within ±0.5 s. Generated plans need
  no snapping.

## 4. Mux pass (video still stream-copied)

```
[2:a]atrim=start=S0:duration=D0,asetpts=PTS-STARTPTS[m0];
[3:a]atrim=start=S1:duration=D1,asetpts=PTS-STARTPTS[m1];
[m0][m1]acrossfade=d=2.0:c1=tri:c2=tri[bed];                  # repeat per segment
[bed]volume=-20dB,afade=t=in:d=1.5,afade=t=out:st=T-3:d=3[bedq];
[1:a]asplit=2[vo][vokey];
[bedq][vokey]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400:makeup=1[ducked];
[vo][ducked]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11[aout]
```

- `acrossfade` overlaps its inputs, so each segment's trim includes the fade; the bed's total equals `timing.total`.
- A sting is added with `adelay` **after** the ducking, so it punches through.
- Starting values, to tune by ear: bed about −20 dB before ducking; 8:1 ratio (bed 8–12 dB under speech); 400 ms
  release so it swells back in pauses; −14 LUFS integrated. `normalize=0` keeps `amix` from halving the voice.
- A later refinement: carve the voice band (about 250 Hz–2.5 kHz, deepest near 1.6 kHz) out of the bed before the
  sidechain, so it can be ducked less. Only the voice goes in the key signal; the voice itself is never carved.
- `--no-music` keeps a voice-only master. `make_shorts.py` reuses the plan sliced to the Short's window, or skips
  music.

## Licences (the part that bites)

Only music that allows commercial use and syncing to video: CC0, CC BY (credit in the description, generated from the
manifest), or a generator whose output terms allow it. Not CC BY-NC (monetised channels), not CC BY-ND (no syncing),
not model weights licensed non-commercially. If a demo must work offline, a couple of CC BY tracks with a CREDITS file
are the only clearly redistributable option.

## Open decisions

- Library (cheaper, repeatable) versus a generated composition plan (seamless, scored to picture; files never
  committed).
- Whether the `insight` sting is used at all.
- The −14 LUFS target versus the current masters (measure with `ffmpeg -af ebur128`).
