# Episode configuration: `episode.json`

Every per-project value lives in `<episode>/episode.json`; the code holds none. `tools/init_episode.py` writes it from
`tools/templates/episode.json`; missing keys fall back to the defaults in `tools/common.py` (`DEFAULTS`). The engine
scripts (`engine/app/scripts/lib.ts`) read the `id` and the `render` block.

| Key | Default | Meaning |
|---|---|---|
| `id` | folder name | Episode id. Clips are `engine/renders/<id>_c<N>.mp4`, the master `renders/<id>_full.mp4`. |
| `title` | `""` | Working title (SCRIPT.md heading). |
| `language` | `"en"` | Narration language: TTS language code, subtitle file name. |
| **`voice`** | | |
| `voice.provider` | `"elevenlabs"` | Only ElevenLabs is implemented (`tools/make_vo.py`). No key: `tools/fake_vo.py`. |
| `voice.voice_id` | `""` | The TTS voice. Voice ids are tied to an account: leave it empty in anything you publish and set `ELEVENLABS_VOICE_ID` instead. |
| `voice.voice_id_env` | `"ELEVENLABS_VOICE_ID"` | Environment variable read when `voice_id` is empty. |
| `voice.voices` | `{}` | Several voices: role → voice id, e.g. `{"NARRATOR": "…", "GUEST": "…"}`. A script line's `voice` field names its role; each line is voiced with its role's id. An empty id reads `ELEVENLABS_VOICE_<ROLE>` from the environment, then falls back to `voice_id`. A role missing from the map stops `make_vo` before any characters are spent; `check_script` flags it too. Changing a role's id re-voices only that role's lines. |
| `voice.default_role` | `null` | Role of lines without a `voice` field (e.g. `"NARRATOR"`). `null`: such lines use the single voice. |
| `voice.model` | `"eleven_multilingual_v2"` | TTS model id. |
| `voice.language_code` | `null` (= `language`) | Sent to the TTS. |
| `voice.api_key_env` | `"ELEVENLABS_API_KEY"` | Environment variable holding the key. Keys are read **only** from the environment, never from files in the repo or the episode. |
| `voice.pronounce` | `{}` | Canonical token → one spoken token, sent to the TTS only: `{"SQL": "sequel"}`. Timings and captions keep the canonical token (`tools/pron.py`); a line whose spoken text changes is re-voiced. |
| `voice.tempo` | `1.0` | Speed-up applied with Rubber Band R3 (`rubberband -3`); 1.0 skips it. |
| `voice.gap` / `chapter_gap` | `0.3` / `0.9` | Seconds of silence after a line / between chapters. A line's own `hold` adds to its gap. |
| `voice.lead_in` / `tail` | `0.5` / `0.6` | Silence before the first and after the last line. |
| `voice.loudness_lufs` | `-14` | Integrated loudness of `vo/voice.wav` (one static gain plus a true-peak limiter). |
| `voice.line_lufs` | `-20` | Before the mix, each line clip gets one static gain to this loudness, so voices that come out of the TTS several dB apart sit level (EBU R128 integrated for clips of 3 s or more; shorter clips use the speech-gated 400 ms momentary loudness). Timing and sample positions do not change. `null` turns it off. Rebuild without the TTS: `make_vo.py <episode> --cached`. |
| `voice.line_peak` | `-1` | True-peak ceiling (dBTP) of a leveled clip; caps that clip's gain. |
| **`captions`** | | |
| `captions.numbers` | `"none"` | `"none"` or a module in `tools/lang/` (`"es"`: spelled-out Spanish numbers to digits). |
| `captions.acronyms` | `{}` | Spoken form → shown form, e.g. `{"sequel": "SQL"}`. |
| `captions.fixes` | `[]` | `[[["shown", "tokens"], "replacement"], …]` for phrases the converter cannot read. |
| `captions.max_chars` / `line_chars` | `78` / `44` | Chunk length; a chunk longer than `line_chars` breaks into two lines. |
| **`render`** | | Machine settings. Each has an environment override. |
| `render.lock` | `/tmp/vibe-animator-render.lock` | Shared `flock` file: one headless browser at a time on the machine. Env `HARNESS_RENDER_LOCK`. Use the same path for every project on one machine. |
| `render.min_free_gb` | `3` | Free memory (MemAvailable) required before a browser starts; checked again inside the lock. Env `HARNESS_MIN_FREE_GB`. |
| `render.gpu_env` | `{"DRI_PRIME": "1"}` | Environment for Chromium. `DRI_PRIME=1` selects the discrete/external GPU on hybrid Linux machines; use `{}` on a single-GPU machine. A variable already set in the environment wins. |
| `render.angle_args` | Vulkan | Chromium ANGLE flags. Env `ANGLE_ARGS`. `--use-angle=gl` may fall back to SwiftShader (CPU) in headless mode: correct but slow. |
| `render.chrome_path` | auto | Chromium binary. Env `CHROME_PATH`. Auto: system Chromium/Chrome, then Playwright's download in `~/.cache/ms-playwright`. |
| `render.private_ports` | `[5600, 5900]` | Range for the private dev servers the scripts start when no `--url` is given. Env `HARNESS_PORTS=lo-hi`. |
| `render.tmpdir` | `/var/tmp` | Big temporary files (never `/tmp`, which can be RAM-backed). Env `HARNESS_TMPDIR`. |
| `render.review_dir` | `null` | Optional folder (relative to the episode) with hard-linked review copies; re-renders refresh them atomically. |
| `render.fps` / `samples` | `30` / `4` | Frame rate; motion-blur sub-frames per frame. |
| `render.slots` | `2` | Render slots: `<lock>` and `<lock>.2`, each taken without blocking with its own memory gate (two chapter renders at once; `render --jobs 2`). QA and stills always use `<lock>`. Env `HARNESS_RENDER_SLOTS`. |
| `render.encoder` | `"h264_vaapi"` | `h264_vaapi` (VBR) · `hevc_vaapi` (CQP 16) · `x264` (CPU, medium, CRF 18, tune grain) · `x264-fast` (also the automatic fallback when VAAPI cannot encode) · `webcodecs` (H.264 in the page, opt-in). One per episode: clips are joined by stream copy. Env `HARNESS_ENC`; per run `--enc`. |
| `render.video_bitrate` | `"10M"` | h264_vaapi VBR target (max 17M). Video platforms re-encode to about 0.8 Mbit/s AV1 and remove film grain anyway; 8M blocked 24 px text in page dissolves (2026-10-18). Raise it only for a local master that must keep grain. |
| `render.vaapi_device` | `"auto"` | VAAPI node for the encoder: prefer `/dev/dri/by-path/pci-…-render` (`renderD` numbers can change). `auto`: the first by-path render node; set it explicitly on hybrid machines. Env `HARNESS_VAAPI_DEVICE`. |
| **`shorts`** | | |
| `shorts.brand_line` | `""` | Small line at the top of each Short (empty: none). |
| `shorts.accent_color` / `ink_color` / `bone_color` | amber / ink / bone | `0xRRGGBB`. |
| `shorts.hook_font` / `brand_font` | Cormorant italic / Archivo | Files in `engine/app/public/fonts/`. |
| `shorts.caption_font` / `caption_size` | `"Archivo"` / `66` | Caption family (libass, from the fonts folder) and size. |
| `shorts.samples` | `2` | Sub-frames for Shorts made separately (`make_shorts.py --separate`, or missing ones). Shorts made in the chapter pass have the chapter's `render.samples`. |
| `shorts.max_hook_chars` | `60` | Checked by `check_script.py`. |
| **`music`** | `"none"` | Story music (`tools/music.py`, `docs/STORY_MUSIC.md`): `"none"`, `"library"` (CC BY demo tracks, `tools/music_library.json`), `"elevenlabs"` (one composed bed per ≤ 290 s, key from `ELEVENLABS_API_KEY`, needs the `music_generation` permission; only `music generate` spends, see below) or `"reuse"` (sections of earlier takes from the private cache `~/.cache/vibe-animator/music/`, free). With music on, the master and the Shorts carry `music/mix.wav`; a failure falls back to the voice with a warning. |
| `music.*` | see `tools/music.py` | As an object: `{"mode": "library", "bed_db": -15, "duck_db": 6, "duck": {…}, "loudness": -14, "true_peak": -1.5, "max_credits": null, "tracks": {"wonder": "<track id>"}, "elevenlabs": {"model": "music_v1"}, …}`. Defaults live in `DEFAULTS` in `tools/music.py`. |
| `music.bed_db` | `-15` | Bed level under the voice during speech (dB, after ducking). Documentary −14 to −16; a trailer about −10 (`examples/trailer`). In the gaps the bed is `duck_db` louder. `bed_lufs` (absolute, unducked) overrides it. |
| `music.duck_db` | `6` | Ducking depth under speech (dB), soft knee, attack 20 ms, release 300 ms (`music.duck`); the bed is back at full level in the gaps and the end card. |
| `music.max_credits` | `null` | ElevenLabs budget for the episode, all takes together (summed from `music/spend.jsonl`). `music generate` refuses anything over it, even with `--yes`; with no budget it needs `--yes`. |

## Several voices (script.json)

A line may carry `"voice": "ROLE"` and `"typed": true` (or a string). Voicing, `timing.json`, the word timings and the
captions are unchanged by either. `make_engine_data.py` copies the speaker (`voice`, defaulting to
`voice.default_role`) and the typed text into `engine/data/lyrics.json`; scenes read them with `this.q.speaker(id)`,
`this.q.speakerAt(t)` and `this.q.typed(id, t)`, the on-screen typing that follows the voice word by word
(`scenes/_shots.ts`, `Cues`). The request context (`previous_text` / `next_text`) only uses neighbouring lines in the
same voice. Packs and the generated SCRIPT view show each line's speaker; a hand-written `SCRIPT.md` is never
overwritten (the generated view goes to `SCRIPT.generated.md`).

## Files an episode holds

```
<episode>/
  episode.json   script.json   SCRIPT.md (generated)   timing.json (generated)
  vo/            per-line TTS cache, voice.wav (master), voice.mp3 (engine)
  music/         music_plan.json, mix.wav (+ receipt), CREDITS.txt (library credits), spend.jsonl (every music spend), reuse_plan.json, cache/ (generated takes; never commit)
  engine/        the episode's own copy of the engine; scenes in engine/app/src/scenes/c<N>.ts
  renders/       <id>_full.mp4         shorts/  <S..>.mp4, raw/, ass/         publish/  subtitles.<lang>.srt
  packs/         per-chapter build packs (tools/new_episode.py)   BUILD_BRIEF.md   FACT_CHECK.md / refs.json (optional)
Keys and tokens live only in environment variables (ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID); never in these folders.
```
