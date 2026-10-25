"""Join the chapter clips (engine/renders/<id>_c<N>.mp4, contiguous timeline windows) and lay the full narration
(vo/voice.wav) over them. Checks each clip's duration against its window first.

  python3 tools/assemble.py <episode>

Output: <episode>/renders/<id>_full.mp4 (staged in engine/work/assembly/, checked with ffprobe, then renamed into
place; never written in place; refused if the clips were encoded with different settings, since stream copy keeps
the first clip's SPS/PPS: after switching render.encoder, re-render every chapter) and its receipt renders/<id>_full.mp4.receipt.json (sha256 of every clip, the
narration, chapters.json and timing.json; `tools/receipts.py verify-fresh` also checks each clip's own receipt). If
episode.json render.review_dir is set, a hard link (or copy) is refreshed there too.
"""
import json, os, pathlib, subprocess, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import duration, episode_from_argv, place_at, probe  # noqa: E402
import receipts  # noqa: E402


def windows(chapters, total):
    """Same rule as engine timeline.ts / lib.ts: C0 from 0, others from start - 0.4, each to the next start - 0.4."""
    out = []
    for i, c in enumerate(chapters):
        a = 0.0 if i == 0 else c["start"] - 0.4
        b = chapters[i + 1]["start"] - 0.4 if i + 1 < len(chapters) else total
        out.append((c["id"], a, b))
    return out


def video_key(f):
    """Codec settings + SPS/PPS (extradata) hash: the concat demuxer keeps the first clip's, so all must match."""
    return subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_data_hash", "sha256", "-show_entries",
                                    "stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,color_space,color_primaries,color_transfer,extradata_hash",
                                    "-of", "csv=p=0", str(f)]).decode().strip()


def main():
    ep, _ = episode_from_argv()
    R = ep.engine / "renders"
    ch = json.loads((ep.engine / "data/chapters.json").read_text())
    total = ep.timing["total"]
    lst, ok, clips, keys = [], True, [], {}
    for cid, a, b in windows(ch, total):
        f = R / f"{ep.id}_c{cid[1:].lower()}.mp4"
        if not f.exists():
            print("MISSING", f.name)
            ok = False
            continue
        d = duration(f)
        bad = abs(d - (b - a)) >= 0.25
        ok &= not bad
        print(f"{f.name}: {d:.2f}s (window {b - a:.2f}s){'  <-- duration mismatch' if bad else ''}")
        lst.append(f"file '{f}'")
        clips.append(f)
        keys.setdefault(video_key(f), []).append(f.name)
        stale = receipts.problems(f) if receipts.receipt_path(f).exists() else []
        if stale:
            print(f"  warning: {f.name} is stale ({'; '.join(stale[:2])}): the master's receipt will not verify")
    if len(keys) > 1:
        ok = False
        print("clips encoded with different settings (re-render them with one encoder): "
              + " | ".join(", ".join(v) for v in keys.values()))
    if not ok:
        sys.exit("missing chapter, duration mismatch or mixed encoder settings")
    work = ep.engine / "work/assembly"
    work.mkdir(parents=True, exist_ok=True)
    inputs = work / "concat.txt"
    inputs.write_text("\n".join(lst) + "\n")
    out = ep.p(f"renders/{ep.id}_full.mp4")
    out.parent.mkdir(exist_ok=True)
    staged = work / f"{ep.id}_full.{os.getpid()}.mp4"
    deps = clips + [ep.p("vo/voice.wav"), ep.engine / "data/chapters.json", ep.p("timing.json")]
    before = receipts.hash_inputs(deps, out.parent)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(inputs), "-i", str(ep.p("vo/voice.wav")),
                    "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", str(staged)], check=True)
    pr = probe(staged)
    bad = ("no 1920x1080 video" if not any(s["codec_type"] == "video" and (s["width"], s["height"]) == (1920, 1080) for s in pr["streams"])
           else "no audio" if not any(s["codec_type"] == "audio" for s in pr["streams"])
           else f"duration {pr['format']['duration']} vs {total}" if abs(float(pr["format"]["duration"]) - total) >= 0.25 else "")
    if bad:
        sys.exit(f"assembled master failed its check ({bad}); staged file kept: {staged}")
    changed = receipts.changed_inputs(before, deps, out.parent)
    os.replace(staged, out)
    receipts.write_receipt(out, before, {"total": total, "windows": [[c, a, b] for c, a, b in windows(ch, total)], "changed_mid_render": changed})
    if changed:
        print("  warning: inputs changed while assembling:", ", ".join(changed))
    rd = ep.cfg["render"]["review_dir"]
    if rd:
        place_at(out, ep.rel_path(rd) / out.name)
    print("wrote", out, f"{duration(out):.2f}s")


if __name__ == "__main__":
    main()
