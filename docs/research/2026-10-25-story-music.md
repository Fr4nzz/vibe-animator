# Story-beat background music: research and design (2026-10-25)

The question: how do we score a narrated explainer the way Jia-Bin Huang (youtube.com/@jbhuang0604) appears to,
with a few music tracks that follow the story arc (wonder, struggle, a named solution where the music turns hopeful,
clever-insight moments)? This note covers what he publishes, existing open-source tools, music sources we can
legally use, and a design for our pipeline.

Evidence labels: **[seen]** means I read it myself (a file, an API response or a page). **[unverified]** means I
could not confirm it.

---

## 1. What Jia-Bin Huang publishes

### He publishes his video sources, but not the full pipeline

- **[seen]** The repository `github.com/jbhuang0604/videos` ("YouTube video project sources").
  - It has 6 stars, **no licence file** (`licenseInfo: null`), was created on 2026-08-30 and was last pushed on
    2026-08-30. It has two commits, and both are co-authored by "Cursor <cursoragent@cursor.com>".
  - It contains two projects:
    - `2026/speculative_decoding/`: `script` (20 KB of narration), `speculative_decoding.py` (300 KB of scenes) and
      `thumbnail.py`.
    - `2026/steal_reasoning/`: `script`, `steal_reasoning.py` (213 KB) and `thumbnail.py`.
  - `.gitignore` excludes `media/`, which is Manim's render output folder.
- **[seen] His tool is Manim Community Edition.**
  - The scene files start with `from manim import *`.
  - The YouTube description of "How LLMs Get Faster Without Changing Their Outputs | Speculative Decoding"
    (l8gWQlrVOKQ) ends with "Animation made with Manim: https://www.manim.community/".
  - I found no evidence that he uses Keynote, PowerPoint or After Effects for these videos.
  - The `supp/` folder of his site repository holds old **conference** slide decks (`.ppt`/`.pptx`/`.pdf`, 2009–2018),
    which are not video sources.
- **[seen] Part of the pipeline is not published.** The scenes import a shared module
  (`from tools import SectionScene, rounded_elbow, draw_network`) and a `common_images/` folder, both from two levels
  up. Neither is in the repo, so the code cannot be rendered as published.
- **[seen] He works in story beats.**
  - The narration `script` is plain prose split into `[Act0Reasoning]`, `[Act1Tokens]` … `[Act5Closing]` blocks,
    and the scene file has one Manim Scene class per act.
  - A comment in `steal_reasoning.py` explains the mechanism: `SectionScene` "overrides play() and wait() to open an
    'animated' and a 'static' section respectively — one clip per beat to cut against". The `# ── Beat N ──` headers
    are "what a cut list is read against".
  - So he renders one clip per beat and cuts them against the voice in an editor.
- **[seen] The sources contain no music.**
  - Neither the code nor the scripts mention music or mood. Grepping for music, sound, audio, bgm and mood found only
    unrelated words.
  - The two video descriptions I fetched (l8gWQlrVOKQ and qkngB1Q46CY) contain **no music credit**.
- **[unverified]** Which editor he uses and where his music comes from. Music is almost certainly added at the edit
  stage, outside anything he has published.
- **[unverified]** That his videos use 4–5 tracks matched to beats. I could not listen to them. That is the owner's
  description.
- **[seen, not useful]**
  - His `awesome-tips` README links a thread, "How to present your work via videos?" (x.com/jbhuang0604/status/1752768310087737588).
    I could not fetch its content.
  - His site (jbhuang0604.github.io) only links his YouTube channel. It has no page about his workflow.
  - Web searches found no talk or post about his workflow.

### Takeaway

His beat discipline (one script block per act, one clip per beat) matches our line-and-word cue model. There is no
published music method from him to copy, so the scoring design below is ours.

---

## 2. Open-source repos that pick, generate or duck background music

Stars, licence and last push come from `gh repo view` / `gh search repos` on 2026-10-25. **None of them switches
music per story beat within one video.** Every one uses a single music bed per video. Mood-tagged selection exists
only at the whole-video level.

| Repo | Stars | Licence | Last push | What it does with music (read from its source) |
|---|---|---|---|---|
| gyoridavid/short-video-maker | 1432 | MIT | 2025-06-21 | Closest match. `src/short-creator/music.ts` holds a hand-tagged list: `{file, start, end, mood: MusicMoodEnum.melancholic / chill / uneasy / excited …}`. The API takes `music: "<mood>"` (one per video, listed at `GET /api/music-tags`) and `musicVolume` low/medium/high/muted. It ships MP3s in `static/music/` (artists include Telecasted, Joel Cummins, Jeremy Korpas). **[unverified]** whether those tracks may legally be redistributed. Renders with Remotion. |
| harry0703/MoneyPrinterTurbo | 135075 | MIT | 2026-10-25 | `app/services/bgm.py` picks a random file or a user-chosen one at a fixed volume, with no mood logic. `app/services/elevenlabs_music.py` calls ElevenLabs **`/v1/music/video-to-music`** (models `music_v1`/`music_v2`, video up to 600 s, prompt up to 1000 chars), which scores a whole video from its frames. |
| RayVentura/ShortGPT | 8070 | MIT | 2025-02-10 | `editing_steps/background_music.json`: loop the bed, normalize, set volume percentage. No mood logic and no ducking. |
| sonilo-ai/skills | 117 | MIT (the skills) | 2026-10-20 | Agent skills for the paid Sonilo API: `audio-ducking` ("lowers the music wherever the voice is speaking and lifts it back in the gaps"), `text-to-music`, `video-to-music`. Ducking happens in their cloud, not locally. |
| ndenissov/FastDub | 10 | — | 2026-10-23 | Dubbing CLI. Its description mentions "audio ducking". I did not read its code. |
| ManimCommunity/manim-voiceover | 322 | MIT | 2026-06-15 | Voiceover plus word-timed animation for Manim. It has no music support but is the nearest analogue to our word-cue engine. |
| facebookresearch/audiocraft (MusicGen) | 23758 | Code MIT; **weights CC-BY-NC 4.0** (README §License) | 2026-03-03 | Local text-to-music. **Weights are non-commercial, so they cannot be used on a monetized channel.** |
| Stability-AI/stable-audio-tools | 3891 | MIT (code) | 2026-10-24 | Inference code for Stable Audio Open 1.0. The model card says "Stability AI Community License", "up to 47s", and that it was trained on Freesound and FMA. The commercial terms are at stability.ai/license. **[unverified]** the revenue threshold. |
| HamSanders/soundbox | 39 | — | 2026-10-25 | Described as a local alternative to ElevenLabs and Suno. I did not read its code. |

Search gaps:
- GitHub search hit the API rate limit partway through. I did not get to run the queries for "soundtrack emotion
  segment", "music crossfade", "storytelling video generator music" and "podcast ducking".
- A repo that does per-segment mood switching may exist and have been missed. Nothing I did find does it.

---

## 3. Music sources for a monetized YouTube channel and an MIT repo demo

| Source | Monetized YouTube | Attribution | Can the audio files go in a public repo? |
|---|---|---|---|
| **YouTube Audio Library** | **[seen]** Yes. support.google.com/youtube/answer/3376882: "you can monetize videos with music and sound effects from the Audio Library", and its tracks "won't be claimed by a rights holder". | Creative Commons tracks: "you must credit the artist in your video's description". Standard-licence tracks: none. | **No / [unverified].** The help page says nothing about redistribution or use off YouTube. Treat as no. Downloads require a Studio login, so the download script cannot be automated. |
| **Pixabay Music** | **[unverified] probably yes.** The licence grants free use, no attribution and modification. The summary and full terms say nothing about YouTube or Content ID. | Not required. | **No.** Terms §5: "cannot sell or distribute the Content … on a Standalone basis". §8: "Bulk, large-scale or systematic copying … strictly prohibited". So the manifest should be links only, and downloads should be manual or small. |
| **Free Music Archive** | Per track. CC BY permits commercial use. **BY-NC is not allowed** on a monetized channel. **BY-ND forbids syncing to video** ("You cannot put this song in a video"). | Required for CC BY. | **Yes for CC BY tracks**, with credits. The FMA itself "cannot license original work to you", so the licence must be checked on each track page. |
| **Kevin MacLeod / incompetech** | **[seen]** "Yes, AND you can monetize the videos". Credits can go in the description. | CC BY 4.0. The template is "Title Kevin MacLeod (incompetech.com) / Licensed under Creative Commons: By Attribution 4.0 / https://creativecommons.org/licenses/by/4.0/". A paid licence removes the attribution requirement. | **Legally yes** under CC BY 4.0, with attribution. The FAQ says nothing about rehosting the MP3s. **[unverified]** Content ID: the FAQ links a separate article I did not read. |
| **ElevenLabs Music** | **[seen]** elevenlabs.io/music-terms (updated 09 Oct 2026). Plans from Free through Enterprise Music Lite: "All online and offline commercial use permitted, except film, TV, radio, and Studio Games". Free plan: no API, downloads "Not permitted", attribution required. Starter and above: "No Attribution Required". Free/Starter/Creator/Pro are "For Individual Use Only". §2.2: "you retain any and all rights in and to your Input and Output". §4.4: you must follow each platform's AI-disclosure policy. YouTube and Content ID are not mentioned. | Starter and above: none. | **Caution.** §4.2 forbids using Output "to compile, create, or contribute to a Music Library". Shipping a reusable mood-track pack in a public repo could count as one. Generate per project and do not commit the files. |
| MusicGen weights | **No** (CC-BY-NC 4.0). | — | — |
| Stable Audio Open | **[unverified]** Community Licence terms. | — | — |

Repo policy:
- Ship `music/manifest.json` (source URL, licence, attribution string, sha256 and a `mood` tag for each track) plus a
  `tools/fetch_music.py` that downloads into an ignored `music/cache/`. Do not commit audio.
- If the demo must work offline, two or three CC BY 4.0 Kevin MacLeod tracks are the only clearly redistributable
  option. Commit them with a CREDITS file.
- Every published video's description gets the attribution lines from the manifest automatically.

---

## 4. Design for our framework

### Where music fits in today's pipeline

- `tools/assemble.py` runs `ffmpeg -f concat` over the chapter clips, adds `vo/voice.wav`, maps
  `0:v` + `1:a`, stream-copies the video and encodes AAC 256k.
- The video is never re-encoded, so adding a music bed is **audio-only work in that same pass**. It costs nothing on
  the GPU.
- The local ffmpeg has `sidechaincompress`, `acrossfade`, `amix` and `loudnorm` **[seen]**.
- `timing.json` already has per-line and per-word start and end times. `make_engine_data.py` sets "downbeats" at
  line starts.

### a. Script schema

Add an optional `mood` to each line in `script.json`. The mood carries over to later lines until it changes, so only
the lines where the story turns need it.

```json
{"id": "C1-L4", "text": "…", "mood": "struggle"}
```

The set of moods is closed: `wonder | struggle | tension | insight | hope | resolution`, plus `none` for silence.

`check_script.py` should check that:
- the mood names are valid;
- a mood segment lasts at least about 8 s, because shorter segments sound like channel-surfing;
- there are no more than about 6 cues per 10 minutes.

`insight` is a **sting or swell**, not a bed: a 2–4 s accent on the cue word. Scoring every clever moment with a
track change would wear the effect out.

### b. Track resolution: `tools/make_music.py <episode>`

Writes `music/plan.json`.

1. Merge consecutive lines with the same mood into segments `{mood, start, end}`, using the line start/end times
   from `timing.json`.
2. Resolve each mood in this order:
   1. a track from the episode or library manifest with a matching `mood` and enough length, using the trimmed
      `start` offset noted in the manifest (the same idea as short-video-maker's `{start, end, mood}`);
   2. otherwise generate one ElevenLabs piece for the whole episode using a `composition_plan`.
      - **[seen]** In the `POST /v1/music` docs, each section has `section_name`, `positive_local_styles`,
        `negative_local_styles` and a `duration_ms` of 3–120 s. `music_length_ms` can be 3–600 s, and
        `force_instrumental` can be set.
      - **[seen] Conflict:** the overview page says the maximum is 5 minutes. Expect to split long episodes into
        several requests.
      - Making one section per mood segment, with durations taken from `timing.json`, gives transitions the model
        composes itself, with no seams between tracks. This is the closest thing to a composer scoring to picture.
3. Record the source, licence, attribution and sha256 in the receipt, the same way `receipts.py` does for clips.

### c. Transition timing

- Crossfades end **at the first word of the cue line**: the fade runs over about 1.5–3 s **before** the new line's
  first word, inside the pause between lines.
  - When the gap before the line (previous line's end to this line's start) is shorter than the fade, centre the fade
    on the gap.
- A "hope" cue (the named solution) can wait for the **named word**: the line carries `"cue_word": "speculative"`, and
  the turn lands on that word's start from `timing.json`. This is the same mechanism the engine already uses for
  visual hits.
- If a library track has a known BPM (an optional `bpm` field in the manifest), snap the fade start to the nearest
  bar of the *outgoing* track that falls within ±0.5 s of the target.
- Generated plans need no snapping, because the sections already end on time.

### d. Mux pass

The video is still stream-copied. The music filter graph, built in Python:

```
# per segment i: trim + fade, then chain with acrossfade
[2:a]atrim=start=S0:duration=D0,asetpts=PTS-STARTPTS[m0];
[3:a]atrim=start=S1:duration=D1,asetpts=PTS-STARTPTS[m1];
[m0][m1]acrossfade=d=2.0:c1=tri:c2=tri[bed];          # repeat for further segments
[bed]volume=-20dB,afade=t=in:d=1.5,afade=t=out:st=T-3:d=3[bedq];
[1:a]asplit=2[vo][vokey];
[bedq][vokey]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400:makeup=1[ducked];
[vo][ducked]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11[aout]
```

- Map `0:v` and `[aout]`.
- `acrossfade` overlaps its inputs, so each segment's `trim` duration must include the fade length. Compute the
  durations so the bed's total length equals `timing.total`.
- For the "insight" sting, use `adelay=<ms>|<ms>` on the sting file and add it to the `amix` *after* the ducking.
  A sting should punch through, not duck.
- Starting values to tune by ear:
  - bed about −20 dB before ducking;
  - 8:1 ratio, so the bed sits about 8–12 dB down under speech;
  - 400 ms release so the bed swells back in pauses;
  - −14 LUFS integrated, the usual YouTube target.
- `normalize=0` keeps `amix` from halving the voice.
- Keep a `--no-music` flag and a plain voice-only master for Shorts, where the music may not suit the cut.
- `make_shorts.py` should reuse the same plan sliced to the Short's window, or skip music.

### e. Ideas worth borrowing from local skills

- **[seen]** `~/.claude/skills/media-use/audio/references/bgm.md` (HeyGen / Lyria / MusicGen resolver):
  - one bed per composition at `BGM_BED_VOLUME = 0.12` (about −18 dB) under voice;
  - mood inference from keywords and the narrative arc (for example "PAS → MINOR to MAJOR build",
    "tension→relief");
  - it checks whether a later section of the track makes a better entry point than the start;
  - it generates one seed clip and crossfade-loops it to length, which avoids seams;
  - BGM failure "never blocks a render".
  - Its MusicGen fallback inherits the CC-BY-NC weights problem above.
- **[seen]** `~/.claude/skills/hyperframes-audio/SKILL.md` "Voiceover carve":
  - Instead of ducking the whole bed, it cuts only the bands the voice occupies, at about 250 Hz–2.5 kHz. At
    strength 0.8 that is about 7 dB per band, 15 dB at 1.6 kHz, with 19 dB of level room.
  - The rule is "Carve by default — required whenever music plays under a voice".
  - An ffmpeg version to try after plain sidechain ducking works: on the bed, add `equalizer=f=1600:t=q:w=1.2:g=-8`
    plus a shallow 250 Hz–2.5 kHz shelf/peak set before `sidechaincompress`, so the bed can be ducked less and still
    sound fuller.
  - Its other rules carry over too:
    - never carve the voice itself;
    - only voice belongs in the key signal, never SFX or music.

### Open decisions for the owner

- Library (cheaper and repeatable) versus ElevenLabs composition plans (seamless and scored to picture; needs Starter
  or above, and the files are not committed).
- Whether the "insight" sting is used at all.
- The −14 LUFS target versus our current master loudness. **[unverified]** what the current masters measure; check
  with `ffmpeg -af ebur128`.
