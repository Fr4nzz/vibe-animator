"""Unit test for multi-voice narration (no network, no media):  python3 tools/test_voices.py

Covers voice.voices / default_role resolution in make_vo.py, the per-line voice cache, same-voice-only request
context, check_script's role validation, and the speaker / typed fields make_engine_data.py adds to lyrics.json.
"""
import base64, contextlib, io, json, os, pathlib, subprocess, sys, tempfile, unittest
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import make_vo  # noqa: E402
from common import Episode  # noqa: E402

SCRIPT = {"title": "t", "chapters": [{"id": "C0", "title": "c", "lines": [
    {"id": "C0-L1", "voice": "HOST", "typed": True, "text": "Make me a video."},
    {"id": "C0-L2", "text": "One sentence is the brief."},
    {"id": "C0-L3", "text": "Watch it build."},
    {"id": "C0-L4", "voice": "GUEST", "typed": "make it hurt", "text": "Make it hurt."}]}]}


class VoiceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = pathlib.Path(self.tmp.name)
        self.cfg = {"id": "t", "voice": {"voices": {"NARRATOR": "vid-n", "HOST": "vid-h", "GUEST": ""},
                                         "default_role": "NARRATOR"}}
        self.write()
        (self.d / "vo").mkdir()
        self.env = mock.patch.dict(os.environ, {"ELEVENLABS_VOICE_GUEST": "vid-g-env"}, clear=False)
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.tmp.cleanup()

    def write(self, script=SCRIPT):
        (self.d / "episode.json").write_text(json.dumps(self.cfg))
        (self.d / "script.json").write_text(json.dumps(script))

    def ep(self):
        return Episode(self.d)

    def flat(self):
        return [l for c in SCRIPT["chapters"] for l in c["lines"]]

    def test_plan(self):
        self.assertEqual(make_vo.voice_plan(self.ep(), self.flat()), ["vid-h", "vid-n", "vid-n", "vid-g-env"])

    def test_single_voice_unchanged(self):
        self.cfg["voice"] = {"voice_id": "solo"}
        self.write()
        self.assertEqual(make_vo.voice_plan(self.ep(), [{"id": "C0-L1", "text": "x"}]), ["solo"])

    def test_unknown_role_fails_before_spending(self):
        with self.assertRaises(SystemExit) as e:
            make_vo.voice_plan(self.ep(), [{"id": "C0-L1", "voice": "NOBODY", "text": "x"}])
        self.assertIn("NOBODY", str(e.exception.code))

    def fake_post(self, calls):
        def post(url, body, key):
            calls.append((url.split("/text-to-speech/")[1].split("/")[0], body))
            chars = list(body["text"])
            return {"audio_base64": base64.b64encode(b"mp3").decode(),
                    "alignment": {"characters": chars, "character_start_times_seconds": [i * 0.05 for i in range(len(chars))],
                                  "character_end_times_seconds": [i * 0.05 + 0.05 for i in range(len(chars))]}}
        return post

    def test_voice_per_line_cache_and_context(self):
        ep, flat = self.ep(), self.flat()
        vids, calls = make_vo.voice_plan(ep, flat), []
        with mock.patch.object(make_vo, "_post", self.fake_post(calls)), contextlib.redirect_stderr(io.StringIO()):
            for k in range(len(flat)):
                make_vo.tts_elevenlabs(ep, "key", flat, k, {}, vids)
            self.assertEqual([c[0] for c in calls], vids)
            # context only from neighbours in the same voice: L2 and L3 are both NARRATOR, L1/L4 stand alone
            self.assertEqual([(b["previous_text"], b["next_text"]) for _, b in calls],
                             [(None, None), (None, "Watch it build."), ("One sentence is the brief.", None), (None, None)])
            meta = json.loads((self.d / "vo/C0-L4.json").read_text())
            self.assertEqual((meta["voice_id"], meta["role"]), ("vid-g-env", "GUEST"))
            calls.clear()
            for k in range(len(flat)):  # cached: no new requests
                make_vo.tts_elevenlabs(ep, "key", flat, k, {}, vids)
            self.assertEqual(calls, [])
            vids2 = list(vids)
            vids2[1] = "vid-other"      # a role's voice changed: that line is re-voiced
            make_vo.tts_elevenlabs(ep, "key", flat, 1, {}, vids2)
            self.assertEqual([c[0] for c in calls], ["vid-other"])

    def test_revoiced_line_refreshes_decoded_audio(self):
        # regression: stretched() reused vo/<id>.dec.wav after a re-voice, so the mix kept the old take
        ep, mp3 = self.ep(), self.d / "vo/C0-L1.mp3"
        tone = lambda d: subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"sine=d={d}", str(mp3)], check=True)
        tone(1)
        self.assertAlmostEqual(make_vo.duration(make_vo.stretched(ep, "C0-L1", 1.0)), 1.0, delta=0.1)
        tone(2)
        st = mp3.stat()
        os.utime(mp3, ns=(st.st_atime_ns, st.st_mtime_ns + 10**9))  # the new take is newer than the cache
        self.assertAlmostEqual(make_vo.duration(make_vo.stretched(ep, "C0-L1", 1.0)), 2.0, delta=0.1)

    def test_check_script_roles(self):
        bad = json.loads(json.dumps(SCRIPT))
        bad["chapters"][0]["lines"][0]["voice"] = "NOBODY"
        self.write(bad)
        p = subprocess.run([sys.executable, HERE / "check_script.py", self.d], capture_output=True, text=True)
        self.assertEqual(p.returncode, 1)
        self.assertIn("voice role 'NOBODY'", p.stdout)
        self.write()
        (self.d / "SCRIPT.md").write_text("# hand-written\n")
        p = subprocess.run([sys.executable, HERE / "check_script.py", self.d], capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stdout)
        self.assertEqual((self.d / "SCRIPT.md").read_text(), "# hand-written\n")   # kept
        self.assertIn("**HOST** · Make me a video.", (self.d / "SCRIPT.generated.md").read_text())

    def test_engine_data_speaker_and_typed(self):
        lines = [{"id": l["id"], "start": i, "end": i + 0.5, "text": l["text"],
                  "words": [{"w": w, "s": i, "e": i + 0.1} for w in l["text"].split()]} for i, l in enumerate(self.flat())]
        (self.d / "timing.json").write_text(json.dumps({"total": 5, "chapters": [{"id": "C0", "title": "c", "start": 0, "end": 4, "lines": lines}]}))
        subprocess.run([sys.executable, HERE / "make_engine_data.py", self.d], capture_output=True, check=True)
        ly = json.loads((self.d / "engine/data/lyrics.json").read_text())["lines"]
        self.assertEqual([l.get("voice") for l in ly], ["HOST", "NARRATOR", "NARRATOR", "GUEST"])
        self.assertEqual([l.get("typed") for l in ly], ["Make me a video.", None, None, "make it hurt"])
        self.assertEqual(set(ly[0]), {"text", "start", "end", "id", "voice", "typed", "words"})


if __name__ == "__main__":
    unittest.main(verbosity=0)
