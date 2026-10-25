"""timing.json -> the engine's data: engine/data/{lyrics,audio,chapters}.json, and vo/voice.mp3 -> engine/audio/.

  python3 tools/make_engine_data.py <episode>

lyrics.json: the lines in episode order with word times ({w, start, end}). audio.json: a synthetic analysis (the
engine came from a music-video engine): a 120 BPM grid, "downbeats" at line starts, one section per line, word
onsets. chapters.json: [{id, title, start, end}].
"""
import pathlib, shutil, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import episode_from_argv, save_json  # noqa: E402


def main():
    ep, _ = episode_from_argv()
    T = ep.timing
    out = ep.engine / "data"
    flat = [l for c in T["chapters"] for l in c["lines"]]
    save_json(out / "lyrics.json", {"lines": [{"text": l["text"], "start": l["start"], "end": l["end"], "id": l["id"],
                                               "words": [{"w": w["w"], "start": w["s"], "end": w["e"]} for w in l["words"]]} for l in flat]})
    dur, step = T["total"], 0.5
    save_json(out / "audio.json", {"duration": dur, "bpm": 120.0, "fps": 100, "beats": [round(i * step, 4) for i in range(int(dur / step) + 1)],
                                   "downbeats": [l["start"] for l in flat],
                                   "sections": [{"name": l["id"], "start": l["start"], "end": l["end"]} for l in flat],
                                   "features": {}, "onsets": {"vocal": [[w["s"], 1.0] for l in flat for w in l["words"]]}})
    save_json(out / "chapters.json", [{"id": c["id"], "title": c["title"], "start": c["start"], "end": c["end"]} for c in T["chapters"]])
    mp3 = ep.p("vo/voice.mp3")
    if mp3.exists():
        (ep.engine / "audio").mkdir(exist_ok=True)
        shutil.copyfile(mp3, ep.engine / "audio/voice.mp3")
    else:
        print("warning: no vo/voice.mp3 (run make_vo.py or fake_vo.py); the engine will have no audio", file=sys.stderr)
    print(len(flat), "lines;", len(T["chapters"]), "chapters; duration", dur)


if __name__ == "__main__":
    main()
