"""Unit test for tools/receipts.py (no media, no browser):  python3 tools/test_receipts.py"""
import pathlib, sys, tempfile, unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import receipts  # noqa: E402


class ReceiptTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = pathlib.Path(self.tmp.name)
        (self.d / "scene.ts").write_text("v1")
        (self.d / "renders").mkdir()
        self.clip = self.d / "renders/c0.mp4"
        self.clip.write_bytes(b"clip")
        receipts.write_receipt(self.clip, [self.d / "scene.ts"])
        self.master = self.d / "renders/full.mp4"
        self.master.write_bytes(b"master")
        receipts.write_receipt(self.master, [self.clip])

    def tearDown(self):
        self.tmp.cleanup()

    def test_fresh(self):
        self.assertEqual(receipts.problems(self.master), [])

    def test_nested_input_changed(self):
        (self.d / "scene.ts").write_text("v2")
        self.assertEqual(receipts.problems(self.master), ["c0.mp4: ../scene.ts changed"])

    def test_output_replaced(self):
        self.master.write_bytes(b"old master")
        self.assertIn("replaced", receipts.problems(self.master)[0])

    def test_no_receipt(self):
        other = self.d / "renders/x.mp4"
        other.write_bytes(b"x")
        self.assertEqual(receipts.problems(other), ["x.mp4 has no receipt"])

    def test_changed_mid_render(self):
        before = receipts.hash_inputs([self.d / "scene.ts"], self.d / "renders")
        (self.d / "scene.ts").write_text("v3")
        self.assertEqual(receipts.changed_inputs(before, [self.d / "scene.ts"], self.d / "renders"), ["../scene.ts"])

    def test_require_fresh_exits(self):
        (self.d / "scene.ts").write_text("v2")
        with self.assertRaises(SystemExit) as e:
            receipts.require_fresh([self.master])
        self.assertIn("STALE", str(e.exception.code))


if __name__ == "__main__":
    unittest.main(verbosity=0)
