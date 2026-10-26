"""Unit test for per-line loudness leveling in make_vo.mix (voice.line_lufs):  python3 tools/test_vo_level.py

Synthetic line clips (tones at very different levels, one shorter than SHORT_LINE with silence around it) go through
layout + mix. Checks: every line lands within 1 LU of the others, the timing and the sample count are identical to an
unleveled mix, line_lufs null turns it off, a silent clip gets no gain, and --cached never needs a key or the TTS.
Needs ffmpeg; no network.
"""
import json, pathlib, re, subprocess, sys, tempfile, unittest
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import make_vo  # noqa: E402
from common import Episode  # noqa: E402

# (id, dB amplitude, seconds of tone, seconds of silence before and after)
CLIPS = [("C0-L1", -6, 4.0, 0.0), ("C0-L2", -30, 4.0, 0.0), ("C0-L3", -18, 1.2, 0.3), ("C0-L4", -28, 1.5, 0.2)]


def tone(path, db, secs, pad):
    amp = 10 ** (db / 20)
    expr = f"if(between(t\\,{pad}\\,{pad + secs})\\,{amp}*sin(2*PI*440*t)*(0.6+0.4*sin(2*PI*3*t))\\,0)"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i",
                    f"aevalsrc={expr}:s=44100:d={secs + 2 * pad}", str(path)], check=True)


def lufs(path, start=None, end=None):
    cut = ["-ss", str(start), "-to", str(end)] if start is not None else []
    err = subprocess.run(["ffmpeg", "-hide_banner", *cut, "-i", str(path), "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", err)[-1])


def samples(path):
    return int(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "stream=duration_ts", "-of", "csv=p=0",
                                        str(path)]).decode().split()[0])


class LineLevelTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.d = pathlib.Path(cls.tmp.name)
        (cls.d / "vo").mkdir()
        for lid, db, secs, pad in CLIPS:
            tone(cls.d / "vo" / f"{lid}.dec.wav", db, secs, pad)
        tone(cls.d / "vo" / "silent.wav", -200, 1.0, 0.0)
        cls.script = {"title": "t", "chapters": [{"id": "C0", "title": "c",
                                                  "lines": [{"id": lid, "text": "x"} for lid, *_ in CLIPS]}]}
        (cls.d / "script.json").write_text(json.dumps(cls.script))

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def build(self, line_lufs):
        (self.d / "episode.json").write_text(json.dumps({"id": "t", "voice": {"line_lufs": line_lufs}}))
        ep = Episode(str(self.d))
        timing, parts = make_vo.layout(ep, self.script, lambda k, ln: (ep.p(f"vo/{ln['id']}.dec.wav"), []))
        with mock.patch("builtins.print"):
            make_vo.mix(ep, parts, timing["total"])
        wav = ep.p("vo/voice.wav")
        lines = timing["chapters"][0]["lines"]
        return timing, samples(wav), [lufs(wav, ln["start"], ln["end"]) for ln in lines]

    def test_levels_lines_and_keeps_timing(self):
        t_off, n_off, l_off = self.build(None)
        t_on, n_on, l_on = self.build(-20.0)
        self.assertGreater(max(l_off) - min(l_off), 15, l_off)      # the fixture really is uneven
        self.assertLessEqual(max(l_on) - min(l_on), 2.0, l_on)      # every line within +-1 LU of the others
        self.assertEqual(t_on, t_off)                               # timing.json unchanged
        self.assertEqual(n_on, n_off)                               # same sample count
        self.assertAlmostEqual(lufs(self.d / "vo" / "voice.wav"), -14.0, delta=0.6)  # master target still met

    def test_short_clip_gating(self):
        # a 1.2 s tone inside 1.8 s of clip: the speech-gated reading tracks the tone, not the padded average
        loud, _ = make_vo.line_loudness(self.d / "vo" / "C0-L3.dec.wav")
        bare = self.d / "vo" / "bare.wav"
        tone(bare, -18, 1.2, 0.0)
        self.assertAlmostEqual(loud, make_vo.line_loudness(bare)[0], delta=1.0)

    def test_silent_and_peak_cap(self):
        (self.d / "episode.json").write_text(json.dumps({"id": "t", "voice": {"line_lufs": -10.0, "line_peak": -1.0}}))
        ep = Episode(str(self.d))
        g = make_vo.line_gains(ep, [self.d / "vo" / "silent.wav", self.d / "vo" / "C0-L1.dec.wav"])
        self.assertEqual(g[self.d / "vo" / "silent.wav"], 0.0)
        _, tp = make_vo.line_loudness(self.d / "vo" / "C0-L1.dec.wav")
        self.assertLessEqual(tp + g[self.d / "vo" / "C0-L1.dec.wav"], -1.0 + 1e-6)

    def test_cached_never_calls_tts(self):
        (self.d / "episode.json").write_text(json.dumps({"id": "t", "voice": {"voice_id": "v"}}))
        ep = Episode(str(self.d))
        with mock.patch.object(make_vo, "_post") as post, self.assertRaises(SystemExit):
            make_vo.tts_elevenlabs(ep, None, [{"id": "C9-L1", "text": "x"}], 0, {}, ["v"])
        post.assert_not_called()


if __name__ == "__main__":
    unittest.main()
