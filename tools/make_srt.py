"""Subtitles (.srt) for the full episode, from timing.json + the engine caption chunks (the same text as the
burned-in captions).

  python3 tools/make_srt.py <episode>   ->  <episode>/publish/subtitles.<lang>.srt
"""
import pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import caption_cues, episode_from_argv, srt_time  # noqa: E402


def srt(ep, line_range=None, t0=0.0):
    cues = [[toks[0][1] - t0, toks[-1][2] + 0.3 - t0, " ".join(t[0] for t in toks)] for toks in caption_cues(ep, line_range)]
    for a, b in zip(cues, cues[1:]):
        a[1] = min(a[1], b[0] - 0.02)
    return "\n".join(f"{i + 1}\n{srt_time(max(0, a))} --> {srt_time(max(0, b))}\n{t}\n" for i, (a, b, t) in enumerate(cues))


def main():
    ep, _ = episode_from_argv()
    out = ep.p(f"publish/subtitles.{ep.lang}.srt")
    out.parent.mkdir(exist_ok=True)
    text = srt(ep)
    out.write_text(text)
    print(out, text.count(" --> "), "cues")


if __name__ == "__main__":
    main()
