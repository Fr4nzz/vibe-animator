# Music plan: story-beat score (English cut)

Generated 2026-10-25 (`tools/nx music examples/trailer generate`; the rows below are `music.elevenlabs.mood_styles`/`section_styles` in `episode.json`; the track stays in the git-ignored `music/cache/`). The score is built for this trailer with ElevenLabs Music, as one
`POST /v1/music` request with a `composition_plan` (one section per row below, `force_instrumental: true`). That way
the model composes the transitions itself and there are no seams.

- **Timing.** Times are estimates (160 wpm, 0.3 s line gaps, script holds). After the voice is recorded, set each
  section's `duration_ms` from `timing.json`, from the first word of the start line to the first word of the next
  section's start line.
- **Crossfades and stings.** Bed changes land in the pause *before* the start line's first word. *Insight* is not a
  bed: it is a 2–4 s sting mixed after the ducking, on the cue word.
- **Mix.** Bed about −20 dB, sidechain-ducked under the voice. Master at −14 LUFS.
- **Rights.** Use a Starter-or-higher plan (no attribution needed; downloads allowed). Do not commit the generated
  files to the public repo (ElevenLabs music terms §4.2, "music library").
- **Global style for every section.** Instrumental documentary score, no vocals, no drum kit, clean modern mix,
  restrained.
- **Global negative styles.** vocals, choir words, EDM drop, trailer braams, dubstep, heavy percussion, lo-fi hiss.

| # | Mood | Start line → end line | ~Time | Section prompt (positive local styles) |
|---|---|---|---|---|
| M1 | wonder | C0-L1 → C1-L4 | 0:00–0:41 | Sparse felt piano and soft celesta over a warm string pad, slow 70 bpm pulse, curious and open, a gentle rising motif that repeats as things "build"; light shimmer when the particles rush at C0-L5. |
| M2 | wonder (story) | C2-L1 → C2-L4 | 0:41–0:55 | Same motif, re-voiced warmer: plucked strings and a soft hand-drum heartbeat, a modal (Dorian) colour, intimate and patient, like a lesson in a quiet courtyard. Nothing ornamental or exotic-pastiche. |
| S1 | *insight* sting | C2-L5, on **"fill"** | ~0:55, 3 s | Bright resolving chord swell: strings and a bell tone open into a major chord, then settle. |
| M3 | wonder (resolve) | C2-L6 → C2-L7 | 0:59–1:10 | The story motif resolves and thins, piano returns, a sense of a long time passing, gentle hand-off at "centuries later". |
| M4 | struggle | C3-L1 → C3-L6 | 1:10–1:38 | Low cello ostinato in a minor key, ticking pizzicato like a clock, a rising tension layer that grows when the search "explodes" (C3-L3) and then holds unresolved; slight lift, not release, under "AI might help". |
| M5 | wonder | C4-L1 → C4-L3 | 1:38–1:52 | Return to the opening motif, airy and spacious: high strings, celesta, a slow orbit-like arpeggio; reverent, archival. |
| S2 | *insight* sting | C4-L4, on **"exactly"** | ~1:57, 3 s | A clean click into place: harp gliss and a warm brass-free swell landing on one sustained major chord. |
| M6 | hope | C5-L1 → C6-L3 (to end card) | 2:00–2:40 | Hopeful build: steady 90 bpm pulse with muted piano eighths, warm strings swelling, light mallets; momentum through the cutting room, then a broad final statement of the main motif under the end card, ending on a held chord with a 3 s tail. |

**Mood-length check.** Every bed lasts at least about 8 s. M2 runs about 14 s and M3 about 11 s. There are 6 beds
and 2 stings, which is within the "about 6 cues per 10 minutes" guideline.

**Shorts.** Each Short reuses its slice of this plan. S04 (P vs NP) takes M4 alone. S03 takes M2 + S1 + M3. If a
slice starts mid-phrase, add a 1 s fade-in.

**Spanish cut.** Segments stretch, about 15 %. Regenerate from the same section prompts with the Spanish
`timing.json` durations. Do not time-stretch the English score.
