"""Stand-in narration without any TTS key: estimated word timings and a silent (or quiet tone) track, written to the
same files make_vo.py writes (vo/voice.wav, vo/voice.mp3, timing.json). For layout work, QA and smoke tests; replace it
with make_vo.py before the real render.

  python3 tools/fake_vo.py <episode> [--wpm 160] [--tone]

Each word lasts in proportion to its length (min 0.18 s) at the given words per minute; a comma or full stop adds a
short pause. --tone puts a quiet 220 Hz tone under each line instead of silence (to hear the layout).
"""
import pathlib, subprocess, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import episode_from_argv, opt, save_json  # noqa: E402
from make_vo import layout, mix, report  # noqa: E402


def estimate(text, wpm):
    words = text.split()
    avg = sum(len(w) for w in words) / max(1, len(words))
    per_char = 60.0 / wpm / max(1.0, avg)
    t, out = 0.0, []
    for w in words:
        d = max(0.18, len(w.strip(".,;:!?¿¡\"'()")) * per_char)
        out.append({"w": w, "s": round(t, 3), "e": round(t + d, 3)})
        t += d + (0.22 if w[-1] in ".!?…" else 0.12 if w[-1] in ",;:" else 0.04)
    return out, round(t + 0.05, 3)


def main():
    ep, args = episode_from_argv()
    wpm, tone = float(opt(args, "--wpm", "160")), "--tone" in args
    vo = ep.p("vo/fake")
    vo.mkdir(parents=True, exist_ok=True)

    def per_line(k, ln):
        ws, d = estimate(ln["text"], wpm)
        f = vo / f"{ln['id']}.wav"
        src = f"sine=frequency=220:duration={d}" if tone else f"anullsrc=r=48000:cl=mono"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", src, "-t", str(d),
                        *(["-af", "volume=0.05"] if tone else []), "-ar", "48000", "-ac", "1", str(f)], check=True)
        return f, ws

    timing, parts = layout(ep, ep.script, per_line)
    timing["fake"] = {"wpm": wpm, "note": "estimated timings from tools/fake_vo.py; not a real narration"}
    mix(ep, parts, timing["total"])
    save_json(ep.p("timing.json"), timing)
    report(timing)


if __name__ == "__main__":
    main()
