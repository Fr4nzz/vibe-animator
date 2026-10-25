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
| `voice.model` | `"eleven_multilingual_v2"` | TTS model id. |
| `voice.language_code` | `null` (= `language`) | Sent to the TTS. |
| `voice.api_key_env` | `"ELEVENLABS_API_KEY"` | Environment variable holding the key. Keys are read **only** from the environment, never from files in the repo or the episode. |
| `voice.pronounce` | `{}` | Canonical token → one spoken token, sent to the TTS only: `{"SQL": "sequel"}`. Timings and captions keep the canonical token (`tools/pron.py`); a line whose spoken text changes is re-voiced. |
| `voice.tempo` | `1.0` | Speed-up applied with Rubber Band R3 (`rubberband -3`); 1.0 skips it. |
| `voice.gap` / `chapter_gap` | `0.3` / `0.9` | Seconds of silence after a line / between chapters. A line's own `hold` adds to its gap. |
| `voice.lead_in` / `tail` | `0.5` / `0.6` | Silence before the first and after the last line. |
| `voice.loudness_lufs` | `-14` | Integrated loudness of `vo/voice.wav` (one static gain plus a true-peak limiter). |
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

## Files an episode holds

```
<episode>/
  episode.json   script.json   SCRIPT.md (generated)   timing.json (generated)
  vo/            per-line TTS cache, voice.wav (master), voice.mp3 (engine)
  engine/        the episode's own copy of the engine; scenes in engine/app/src/scenes/c<N>.ts
  renders/       <id>_full.mp4         shorts/  <S..>.mp4, raw/, ass/         publish/  subtitles.<lang>.srt
  packs/         per-chapter build packs (tools/new_episode.py)   BUILD_BRIEF.md   FACT_CHECK.md / refs.json (optional)
Keys and tokens live only in environment variables (ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID); never in these folders.
```
