"""Unit tests for tools/music.py (no network; the API is faked and must not be reached):  python3 tools/test_music.py
Plan, cost guard (estimate, budget, one take, --retake, spend log), assemble never generating, the private cache and
reuse."""
import json, os, pathlib, sys, tempfile, unittest
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import music  # noqa: E402


def line(i, start, words, mood=None, cue=None, step=0.5):
    w = [{"w": t, "s": round(start + k * step, 3), "e": round(start + k * step + 0.4, 3)} for k, t in enumerate(words.split())]
    s = {"id": f"C0-L{i}", "text": words}
    if mood:
        s["mood"] = mood
    if cue:
        s["mood_cue"] = cue
    return s, {"id": f"C0-L{i}", "start": w[0]["s"], "end": w[-1]["e"], "words": w}


def episode(*specs, total):
    pairs = [line(*sp) for sp in specs]
    return ({"chapters": [{"id": "C0", "lines": [s for s, _ in pairs]}]},
            {"total": total, "chapters": [{"id": "C0", "lines": [t for _, t in pairs]}]})


class PlanTest(unittest.TestCase):
    def test_carry_forward_and_crossfade_ends_on_first_word(self):
        script, timing = episode((1, 0.5, "light travels in lines", "wonder"),
                                 (2, 5.0, "then it hits glass"),
                                 (3, 12.0, "and nothing works", "struggle"),
                                 (4, 20.0, "until it does", "hope"), total=30.0)
        p = music.compute_plan(script, timing)
        self.assertEqual([s["mood"] for s in p["sections"]], ["wonder", "struggle", "hope"])
        s1 = p["sections"][1]
        self.assertEqual(s1["start"], 12.0)            # the first word of C0-L3
        self.assertEqual(s1["fade"][1], 12.0)          # the crossfade ends exactly there
        self.assertAlmostEqual(s1["fade"][0], 12.0 - music.DEFAULTS["fade_max"])  # long pause: the longest fade, in the gap
        self.assertEqual(p["sections"][0]["start"], 0.0)
        self.assertEqual(p["sections"][0]["end"], 12.0)
        self.assertEqual(p["sections"][-1]["end"], 30.0)

    def test_short_gap_uses_minimum_fade(self):
        script, timing = episode((1, 0.5, "a b c d e f g h i j k l m n o p q r s", "wonder"),
                                 (2, 10.2, "x y z w v u t s r q p o n m", "tension"), total=20.0)
        s = music.compute_plan(script, timing)["sections"][1]
        self.assertEqual(s["fade"], [round(10.2 - music.DEFAULTS["fade_min"], 3), 10.2])

    def test_named_cue_word(self):
        script, timing = episode((1, 0.5, "one two three four", "wonder"),
                                 (2, 6.0, "but then everything broke apart", "struggle", "everything"), total=20.0)
        s = music.compute_plan(script, timing)["sections"][1]
        self.assertEqual(s["start"], 7.0)              # "everything" is the third word: 6.0 + 2 * 0.5
        self.assertEqual(s["word"], "everything")
        self.assertEqual(s["fade"][1], 7.0)

    def test_insight_is_an_accent_not_a_section(self):
        script, timing = episode((1, 0.5, "a b c", "wonder"), (2, 8.0, "and suddenly it clicks", "insight", "clicks"),
                                 (3, 14.0, "so we go on"), total=20.0)
        p = music.compute_plan(script, timing)
        self.assertEqual([s["mood"] for s in p["sections"]], ["wonder"])
        self.assertEqual(p["accents"], [{"t": 9.5, "line": "C0-L2", "word": "clicks"}])

    def test_short_section_is_merged_and_warned(self):
        script, timing = episode((1, 0.5, "a b c d", "wonder"), (2, 10.0, "x", "tension"),
                                 (3, 11.0, "y z", "wonder"), total=20.0)
        p = music.compute_plan(script, timing)
        self.assertEqual([s["mood"] for s in p["sections"]], ["wonder"])
        self.assertTrue(any("merged" in w for w in p["warnings"]))

    def test_no_moods_uses_default_and_lines_before_first_mood_take_it(self):
        script, timing = episode((1, 0.5, "a b"), (2, 3.0, "c d"), total=10.0)
        self.assertEqual([s["mood"] for s in music.compute_plan(script, timing)["sections"]], ["wonder"])
        script, timing = episode((1, 0.5, "a b"), (2, 3.0, "c d", "tension"), total=10.0)
        p = music.compute_plan(script, timing)
        self.assertEqual([(s["mood"], s["start"]) for s in p["sections"]], [("tension", 0.0)])

    def test_elevenlabs_requests_cover_the_video_within_limits(self):
        specs = [(1, 0.5, "a b", "wonder")] + [(k, 60.0 * k, "x y", m) for k, m in
                                                 [(2, "struggle"), (3, "tension"), (4, "hope"), (5, "resolution"), (6, "wonder")]]
        script, timing = episode(*specs, total=400.0)
        o = music.merge(music.DEFAULTS, {"mode": "elevenlabs"})
        p = music.compute_plan(script, timing, o)
        reqs = music.requests_for(p, o)
        self.assertGreater(len(reqs), 1)
        self.assertEqual(reqs[0]["t0"], 0.0)
        self.assertEqual(reqs[-1]["t1"], 400.0)
        for a, b in zip(reqs, reqs[1:]):
            self.assertAlmostEqual(b["t0"], a["t1"] - o["elevenlabs"]["overlap"])   # overlap for the crossfade
        for r in reqs:
            self.assertLessEqual(r["t1"] - r["t0"], o["elevenlabs"]["max_request_s"] + o["elevenlabs"]["overlap"])
            self.assertEqual(sum(c["duration_ms"] for c in r["chunks"]), round((r["t1"] - r["t0"]) * 1000))
            self.assertTrue(all(3000 <= c["duration_ms"] <= 120000 for c in r["chunks"]))

    def test_section_styles_split_a_section_and_style_its_accent(self):
        script, timing = episode((1, 0.5, "a b c d", "wonder"), (2, 10.0, "new chapter here"),
                                 (3, 20.0, "and it clicks", "insight", "clicks"), (4, 26.0, "and on"), total=40.0)
        o = music.merge(music.DEFAULTS, {"mode": "elevenlabs", "elevenlabs": {
            "mood_styles": {"wonder": ["felt piano"]},
            "section_styles": {"C0-L2": ["plucked strings"], "C0-L3": ["harp glissando"], "C0-L4": ["piano returns"]}}})
        p = music.compute_plan(script, timing, o)
        self.assertEqual(p["marks"], [{"t": 10.0, "line": "C0-L2"}, {"t": 26.0, "line": "C0-L4"}])
        ch = music.chunks_for(p, o)
        self.assertEqual([(round(c[0], 2), round(c[1], 2), c[4]) for c in ch],
                         [(0.0, 10.0, ["felt piano"]), (10.0, 20.5, ["plucked strings"]),
                          (20.5, 24.5, ["harp glissando"]),          # accent on "clicks" (21.0): its own styles
                          (24.5, 40.0, ["piano returns"])])          # C0-L4 is < 3 s into that chunk: takes it whole
        r = music.requests_for(p, o)[0]
        self.assertEqual(sum(c["duration_ms"] for c in r["chunks"]), 40000)
        body = music.request_body(r, o)
        self.assertEqual(body["composition_plan"]["sections"][1]["positive_local_styles"], ["plucked strings"])
        self.assertNotIn("marks", music.compute_plan(script, timing))   # no section_styles: plan unchanged
        o["elevenlabs"]["mood_negative_styles"] = {"wonder": ["minor key"]}
        self.assertEqual(music.request_body(r, o)["composition_plan"]["sections"][0]["negative_local_styles"], ["minor key"])

    def test_settings_accept_a_string(self):
        self.assertEqual(music.settings({"music": "library"})["mode"], "library")
        self.assertEqual(music.settings({})["mode"], "none")


def fake_episode(root, music, name="ep"):
    """A minimal episode directory (episode.json, script.json, timing.json): wonder 0-12 s, struggle 12-30 s."""
    d = pathlib.Path(root) / name
    d.mkdir(parents=True)
    script, timing = episode((1, 0.5, "light travels in lines", "wonder"), (2, 12.0, "and nothing works", "struggle"),
                             total=30.0)
    (d / "episode.json").write_text(json.dumps({"id": name, "music": music}))
    (d / "script.json").write_text(json.dumps(script))
    (d / "timing.json").write_text(json.dumps(timing))
    return music_ep(d)


def music_ep(d):
    from common import Episode
    return Episode(d)


def no_api(*a, **k):
    raise AssertionError("the music API must not be called here")


class CostGuardTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cache = pathlib.Path(self.tmp.name) / "usercache"
        self.calls = []

        def fake_http(method, path, key, body=None, timeout=60):
            self.calls.append(path)
            return b"ID3 not really audio", {"song-id": f"song{len(self.calls)}"}
        self.patches = [mock.patch.object(music, "CACHE", self.cache), mock.patch.object(music, "_http", fake_http),
                        mock.patch.object(music, "_used_chars", lambda key: None),
                        mock.patch.dict(os.environ, {"ELEVENLABS_API_KEY": "test-key"})]
        for p in self.patches:
            p.start()
        self.ep = fake_episode(self.tmp.name, {"mode": "elevenlabs"})

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def gen(self, *args, cfg=None):
        o = music.settings({"music": dict({"mode": "elevenlabs"}, **(cfg or {}))})
        with mock.patch("sys.stderr"), mock.patch("builtins.print"):
            return music.generate(self.ep, o, music.compute_plan(self.ep.script, self.ep.timing, o), list(args))

    def test_estimate_uses_the_measured_rate(self):
        self.assertEqual(music.CREDITS_PER_SECOND, 13.8)
        self.assertEqual(music.estimate_credits(188.4), 2600)

    def test_refuses_without_yes_or_budget(self):
        with self.assertRaisesRegex(RuntimeError, "without --yes or a budget"):
            self.gen()
        self.assertEqual(self.calls, [])

    def test_budget_is_a_hard_cap_even_with_yes(self):
        with self.assertRaisesRegex(RuntimeError, "over budget"):
            self.gen("--yes", cfg={"max_credits": 100})         # 30 s ~ 414 credits
        with self.assertRaisesRegex(RuntimeError, "over budget"):
            self.gen("--yes", "--max-credits", "50")
        self.assertEqual(self.calls, [])

    def test_budget_alone_allows_one_take_and_logs_it(self):
        made = self.gen(cfg={"max_credits": 1000})
        self.assertEqual(len(made), 1)
        self.assertEqual(self.calls, ["/v1/music"])                # exactly one request, one take
        log = music.spend_log(self.ep)
        self.assertEqual(len(log), 1)
        self.assertEqual(log[0]["credits_estimate"], music.estimate_credits(30.0))
        self.assertEqual(log[0]["take"], 1)
        self.assertEqual(len(music.load_index()["takes"]), 1)      # indexed in the private cache

    def test_second_take_needs_retake_and_still_checks_the_budget(self):
        self.gen("--yes")
        self.assertEqual(len(self.calls), 1)
        self.gen("--yes")                                           # same plan, cached: nothing spent
        self.assertEqual(len(self.calls), 1)
        o_new = {"elevenlabs": {"styles": ["different prompt"]}}    # a changed prompt is a new take too
        with self.assertRaisesRegex(RuntimeError, "--retake"):
            self.gen("--yes", "--fresh", cfg=o_new)
        with self.assertRaisesRegex(RuntimeError, "over budget"):
            self.gen("--yes", "--retake", cfg={"max_credits": 500})  # 414 spent + 414 > 500
        self.assertEqual(len(self.calls), 1)
        self.gen("--retake", "--max-credits", "1000")
        self.assertEqual(len(self.calls), 2)
        self.assertEqual(len(music.spend_log(self.ep)), 2)
        kept = list(self.ep.p("music/cache").glob("*.*.mp3"))
        self.assertEqual(len(kept), 1)                              # the earlier take is kept beside the new one

    def test_refuses_to_spend_when_the_cache_covers_the_plan(self):
        other = fake_episode(self.tmp.name, {"mode": "elevenlabs"}, name="other")
        o = music.settings({"music": {"mode": "elevenlabs"}})
        p = music.compute_plan(other.script, other.timing, o)
        with mock.patch("builtins.print"):
            music.generate(other, o, p, ["--yes"])                  # other episode composes wonder + struggle
        self.assertEqual(len(self.calls), 1)
        with self.assertRaisesRegex(RuntimeError, "reuse"):
            self.gen("--yes", cfg={"elevenlabs": {"styles": ["another prompt"]}})
        self.assertEqual(len(self.calls), 1)
        self.gen("--yes", "--fresh", cfg={"elevenlabs": {"styles": ["another prompt"]}})
        self.assertEqual(len(self.calls), 2)

    def test_dry_run_and_assemble_never_generate(self):
        with mock.patch.object(music, "_http", no_api):
            self.gen("--dry-run", "--yes")
            with mock.patch("sys.stderr"):
                audio, info = music.audio_for(self.ep)             # what assemble.py and make_shorts.py call
        self.assertIsNone(info)                                    # no take: voice alone, nothing spent
        self.assertEqual(audio.name, "voice.wav")
        self.assertFalse(self.ep.p("music/spend.jsonl").exists())

    def test_a_cached_request_is_restored_from_the_user_cache(self):
        self.gen("--yes")
        for f in self.ep.p("music/cache").glob("*"):
            f.unlink()
        o = music.settings({"music": {"mode": "elevenlabs"}})
        with mock.patch.object(music, "_http", no_api), mock.patch("sys.stderr"):
            rows = music.take_files(self.ep, o, music.compute_plan(self.ep.script, self.ep.timing, o))
        self.assertTrue(rows[0]["file"] and rows[0]["file"].exists())


def take(tid, chunks, rank=0, bpm=None, style="s1"):
    t, cs = 0.0, []
    for mood, d in chunks:
        cs.append({"name": mood.title(), "mood": mood, "t0": t, "t1": t + d, "insight": False, "styles": [], "bpm": bpm})
        t += d
    return {"id": tid, "file": f"takes/{tid}.mp3", "rank": rank, "lufs": -14.0, "style_hash": style, "chunks": cs}


def plan_of(*secs, total):
    """sections (mood, start) with 1 s fades."""
    out = []
    for i, (m, st) in enumerate(secs):
        end = secs[i + 1][1] if i + 1 < len(secs) else total
        out.append({"mood": m, "start": st, "end": end, "fade": [0.0, 1.5] if i == 0 else [st - 1.0, st],
                    "line": f"L{i}", "word": None})
    return {"total": total, "sections": out, "accents": []}


class ReuseTest(unittest.TestCase):
    def test_trims_matching_runs(self):
        p = plan_of(("wonder", 0.0), ("struggle", 20.0), total=40.0)
        r = music.reuse_assign(p, [take("a", [("wonder", 30), ("struggle", 30)])])
        self.assertEqual(r["missing"], [])
        self.assertEqual([(pc["mood"], pc["offset"], pc["t0"], pc["t1"], pc["loop"]) for pc in r["pieces"]],
                         [("wonder", 0.0, 0.0, 20.0, False), ("struggle", 30.0, 19.0, 40.0, False)])

    def test_short_run_loops_in_whole_bars_with_crossfades(self):
        p = plan_of(("hope", 0.0), total=30.0)
        r = music.reuse_assign(p, [take("a", [("wonder", 2), ("hope", 11)], bpm=60)])   # bar = 4 s
        pcs = r["pieces"]
        self.assertGreater(len(pcs), 2)
        self.assertTrue(all(pc["loop"] and pc["offset"] == 2.0 for pc in pcs))
        for a, b in zip(pcs, pcs[1:]):
            self.assertAlmostEqual(b["t0"] - a["t0"], 8.0)        # 2 bars of 4 s: (11 - 1 s xfade) // 4 = 2
            self.assertAlmostEqual(a["t1"] - b["t0"], 1.0)        # 1 s crossfade on the bar line
        self.assertEqual(pcs[-1]["t1"], 30.0)

    def test_nearly_long_enough_starts_early_instead_of_looping(self):
        p = plan_of(("wonder", 0.0), ("hope", 10.0), total=30.0)
        r = music.reuse_assign(p, [take("a", [("wonder", 20), ("hope", 19)])])
        hope = r["pieces"][-1]
        self.assertFalse(hope["loop"])
        self.assertAlmostEqual(hope["offset"], 20.0 - 2.0)        # 21 s needed (9..30), the run has 19

    def test_rank_and_continuation_and_neighbours(self):
        p = plan_of(("wonder", 0.0), ("tension", 10.0), ("wonder", 20.0), ("resolution", 30.0), total=40.0)
        takes = [take("bad", [("wonder", 60)], rank=-1), take("good", [("wonder", 60), ("struggle", 20)])]
        r = music.reuse_assign(p, takes)
        self.assertEqual({pc["source"] for pc in r["pieces"] if pc["mood"] == "wonder"}, {"good"})
        w = [pc for pc in r["pieces"] if pc["mood"] == "wonder"]
        self.assertGreater(w[1]["offset"], w[0]["offset"])           # a returning mood continues its run
        self.assertEqual(r["pieces"][1]["source"], "good")           # tension borrows struggle
        self.assertTrue(any("borrowed struggle" in n for n in r["notes"]))
        self.assertTrue(any(pc["mood"] == "resolution" for pc in r["pieces"]))  # resolution borrows wonder

    def test_missing_mood_is_reported(self):
        p = plan_of(("struggle", 0.0), total=10.0)
        r = music.reuse_assign(p, [take("a", [("wonder", 30)])])
        self.assertEqual(r["pieces"], [])
        self.assertEqual(r["missing"][0]["mood"], "struggle")


class CacheTest(unittest.TestCase):
    def test_index_fields_and_dedupe(self):
        with tempfile.TemporaryDirectory() as d:
            root, f = pathlib.Path(d) / "c", pathlib.Path(d) / "x.mp3"
            f.write_bytes(b"fake")
            body = {"model_id": "music_v1", "composition_plan": {"positive_global_styles": ["a"], "negative_global_styles": [],
                    "sections": [{"section_name": "Wonder", "positive_local_styles": ["70 bpm"], "duration_ms": 5000},
                                 {"section_name": "Wonder, insight", "positive_local_styles": [], "duration_ms": 3000},
                                 {"section_name": "Struggle (C3-L3)", "positive_local_styles": [], "duration_ms": 4000}]}}
            e = music.cache_add(f, {"request": body, "song_id": "s"}, episode="ep", label="take 1", root=root, analyze=False)
            self.assertEqual(e["mood_sequence"], ["wonder", "struggle"])
            self.assertEqual(e["duration_s"], 12.0)
            self.assertEqual(e["model"], "music_v1")
            self.assertEqual(e["request_hash"], music.request_hash(body))
            self.assertTrue((root / e["file"]).exists())
            music.cache_add(f, None, rank=-1, root=root)
            idx = music.load_index(root)
            self.assertEqual(len(idx["takes"]), 1)
            self.assertEqual(idx["takes"][0]["rank"], -1)


class MixSettingsTest(unittest.TestCase):
    def test_bed_and_duck_defaults_and_override(self):
        o = music.settings({"music": "library"})
        self.assertEqual((o["bed_db"], o["duck_db"]), (-15.0, 6.0))      # documentary default
        self.assertLessEqual(o["true_peak"], -1.5)
        o = music.settings({"music": {"mode": "library", "bed_db": -10, "duck_db": 5}})
        self.assertEqual(o["bed_db"], -10)
        self.assertLess(music.duck_mix({"duck_db": 4}), music.duck_mix({"duck_db": 6}))
        self.assertEqual(music.duck_mix({"duck_db": 40}), 1.0)
        self.assertIn(f"mix={music.duck_mix(o)}", music.graph({"sections": [], "accents": []}, [], o, 10.0))

    def test_reuse_mode_and_auto_generate_ignored(self):
        self.assertEqual(music.settings({"music": "reuse"})["mode"], "reuse")
        with mock.patch("sys.stderr"):
            o = music.settings({"music": {"mode": "elevenlabs", "elevenlabs": {"auto_generate": True}}})
        self.assertNotIn("auto_generate", o["elevenlabs"])


if __name__ == "__main__":
    unittest.main()
