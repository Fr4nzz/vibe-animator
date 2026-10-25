"""Vertical Shorts (1080x1920) from an episode.

A Short is an ink canvas, hook title + brand line on top, the central 1080x1080 square (x 420-1500) of the 16:9 frame
WITHOUT burned captions in the middle inside hairline rules, big word-timed captions below (the same caption chunks
the episode shows), and a thin progress rule in the accent colour. Audio comes from the lossless vo/voice.wav.

Shorts are normally made by the chapter pass: `--plan` writes engine/work/shorts/plan.json (each Short's window,
compose filter, captions and output; `nx render` runs it first), and render_chapter.ts hands each Short to the
chapter whose window holds its start. Inside the window the page post-processes each frame once more without
captions, crops the square on the GPU and a second encoder composes the Short. No second render, no second encode.

  python3 tools/make_shorts.py <episode> --plan          write the plan (and the .ass captions); print its path
  python3 tools/make_shorts.py <episode> [S01 S02 ...] [--separate] [--compose-only] [--url …] [--samples 2] [--enc …]
      every requested Short that is missing or stale (its receipt does not verify) is made the old two-step way: a
      clean render (captions off) of its window, then the compose (with the episode's encoder). Fresh Shorts from
      the chapter pass are left alone unless --separate.

Output: <episode>/shorts/<id>.mp4 (+ raw/<id>.mp4 clean renders, ass/<id>.ass captions), each with a receipt
(<file>.receipt.json: sha256 of the engine inputs of the raw render taken at its start, and of the raw render,
narration, timing and captions for the Short; check with `tools/receipts.py verify-fresh`). Every file is staged in
engine/work/shorts/, checked with ffprobe and renamed into place (never written in place). Branding (brand line, colours,
fonts, caption size) comes from episode.json "shorts". Scenes must keep text inside x 420-1500 on Short lines
(engine/app/scripts/qa.ts checks it).
"""
import json, os, pathlib, subprocess, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import caption_cues, episode_from_argv, opt, place_at, probe, save_json  # noqa: E402
import receipts  # noqa: E402


def ass_time(x):
    h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def ass_color(hex0x, alpha="00"):
    v = hex0x.replace("0x", "").replace("#", "")
    return f"&H{alpha}{v[4:6]}{v[2:4]}{v[0:2]}".upper()


def ass_for(ep, i0, i1, t0, out):
    """Captions for lines i0..i1 as ASS, times relative to t0: karaoke fill, active word bright, upcoming dimmed."""
    sc = ep.cfg["shorts"]
    bone, ink = sc["bone_color"], sc["ink_color"]
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{sc['caption_font']},{sc['caption_size']},{ass_color(bone)},{ass_color(bone, '66')},{ass_color(ink)},&H00000000,-1,0,0,0,100,100,0,0,1,0,0,8,70,70,1560,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    chunks = caption_cues(ep, (i0, i1))
    ev = []
    for k, toks in enumerate(chunks):
        st = toks[0][1] - 0.1
        en = chunks[k + 1][0][1] - 0.1 if k + 1 < len(chunks) else toks[-1][2] + 0.8
        en = min(en, toks[-1][2] + 1.2)
        parts, prev = [], st
        for s, a, b, br in toks:
            gap = max(0, a - prev)
            if gap > 0.02:
                parts.append(f"{{\\k{int(gap * 100)}}}")
            parts.append(("\\N" if br else "") + f"{{\\kf{max(1, int((b - a) * 100))}}}{s} ")
            prev = b
        ev.append(f"Dialogue: 0,{ass_time(max(0, st - t0))},{ass_time(max(0, en - t0))},Cap,,0,0,0,,{''.join(parts).strip()}")
    out.write_text(head + "\n".join(ev) + "\n")


def esc(s):  # ffmpeg drawtext escaping
    return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’").replace("%", "\\%")


def check_video(path, width, height, expected, fps, audio=False):
    d = probe(path)
    if not any(s["codec_type"] == "video" and (s["width"], s["height"]) == (width, height) and s["r_frame_rate"] == f"{fps}/1"
               for s in d["streams"]):
        sys.exit(f"{path}: no {width}x{height} video at {fps} fps (staged file kept)")
    if audio and not any(s["codec_type"] == "audio" for s in d["streams"]):
        sys.exit(f"{path}: no audio stream (staged file kept)")
    if abs(float(d["format"]["duration"]) - expected) >= 0.1:
        sys.exit(f"{path}: duration {d['format']['duration']} vs {expected:.3f} (staged file kept)")


def engine_inputs(ep, t0, t1):
    """Files the engine reads to render [t0, t1) (engine/app/scripts/inputs.ts, the same set render_chapter hashes)."""
    r = subprocess.run(["bun", "scripts/inputs.ts", "--from", str(t0), "--to", str(t1)], cwd=ep.app, check=True, capture_output=True, text=True)
    return json.loads(r.stdout)


def compose_graph(ep, sid, hook, i0, i1, t0, t1, sq_in):
    """filter_complex from the 1080x1080 square (`sq_in`: a chain head, e.g. "[0:v]crop=…,") to [v]; writes the .ass."""
    sc, fps = ep.cfg["shorts"], int(ep.cfg["render"]["fps"])
    fonts = ep.app / "public/fonts"
    ass = ep.p(f"shorts/ass/{sid}.ass")
    ass.parent.mkdir(parents=True, exist_ok=True)
    ass_for(ep, i0, i1, t0, ass)
    dur = round(t1 - t0, 3)
    words = hook.split()
    if len(hook) > 22 and len(words) > 1:  # two balanced lines
        k = min(range(1, len(words)), key=lambda j: abs(len(" ".join(words[:j])) - len(" ".join(words[j:]))))
        hook_lines = [" ".join(words[:k]), " ".join(words[k:])]
    else:
        hook_lines = [hook]
    size = 74 if max(map(len, hook_lines)) <= 24 else 62
    y0 = 300 - (len(hook_lines) - 1) * size * 0.55
    bone, ink, accent = sc["bone_color"], sc["ink_color"], sc["accent_color"]
    hook_dt = ",".join(
        f"drawtext=fontfile={fonts / sc['hook_font']}:text='{esc(hl)}':fontsize={size}:expansion=none:fontcolor={bone}:x=(w-text_w)/2:y={int(y0 + i * size * 1.1)}"
        for i, hl in enumerate(hook_lines))
    brand = (f"drawtext=fontfile={fonts / sc['brand_font']}:text='{esc(sc['brand_line'])}':expansion=none:fontsize=26:fontcolor={bone}@0.55:x=(w-text_w)/2:y=120,"
             if sc["brand_line"] else "")
    return (f"{sq_in}setsar=1[sq];"
            f"color=c={ink}:s=1080x1920:r={fps}:d={dur}[bg];"
            f"[bg][sq]overlay=0:420[v1];"
            f"[v1]drawbox=x=0:y=419:w=1080:h=1:color={bone}@0.35:t=fill,drawbox=x=0:y=1500:w=1080:h=1:color={bone}@0.35:t=fill,"
            f"{brand}{hook_dt},"
            f"drawbox=x=0:y=1912:w='1080*t/{dur}':h=8:color={accent}@0.9:t=fill,"
            f"ass={ass}:fontsdir={fonts}[v]"), ass


def encoder(ep, enc):
    """The engine's ffmpeg args for the compose (lib.ts encoderArgs; webcodecs -> h264_vaapi), from a tiny bun call."""
    e = json.dumps(enc or "")
    js = ("import { encoderArgs, resolveEnc, DEFAULT_ENC } from './scripts/lib';"
          f"let w = {e} || DEFAULT_ENC; if (w === 'webcodecs') w = 'h264_vaapi';"
          "console.log(JSON.stringify(encoderArgs(await resolveEnc(w), 'yuv420p')));")
    r = subprocess.run(["bun", "-e", js], cwd=ep.app, check=True, capture_output=True, text=True)
    return json.loads(r.stdout.strip().splitlines()[-1])


def main():
    ep, args = episode_from_argv()
    sc, rc = ep.cfg["shorts"], ep.cfg["render"]
    url = opt(args, "--url")
    samples = opt(args, "--samples", str(sc["samples"]))
    fps = int(rc["fps"])
    want = [a for a in args if a.startswith("S") and a[1:].isdigit()]
    compose_only = "--compose-only" in args

    flat = ep.flat_lines()
    line_idx = {l["id"]: i for i, l in enumerate(flat)}
    shorts = {}
    for c in ep.script["chapters"]:
        for l in c["lines"]:
            sh = l.get("short")
            if sh:
                d = shorts.setdefault(sh["id"], {"hook": sh["hook_title"]})
                d[sh.get("edge", "start")] = l["id"]
    if not shorts:
        sys.exit("no `short` markers in script.json")
    for sub in ["shorts/raw", "shorts/ass"]:
        ep.p(sub).mkdir(parents=True, exist_ok=True)
    work = ep.engine / "work/shorts"
    work.mkdir(parents=True, exist_ok=True)

    def window(sid):
        sh = shorts[sid]
        i0, i1 = line_idx[sh["start"]], line_idx[sh["end"]]
        return i0, i1, round(flat[i0]["start"] - 0.25, 3), round(flat[i1]["end"] + 0.6, 3)

    if "--plan" in args:
        plan = {"crop": [1080, 1080, 420, 0], "size": [1080, 1920], "shorts": []}
        for sid in sorted(shorts):
            if want and sid not in want:
                continue
            i0, i1, t0, t1 = window(sid)
            # (encode.ts prefixes "[0:v]setparams=<BT.709 tags>," to the graph)
            fc, ass = compose_graph(ep, sid, shorts[sid]["hook"], i0, i1, t0, t1, "")
            plan["shorts"].append({"id": sid, "t0": t0, "t1": t1, "out": str(ep.p(f"shorts/{sid}.mp4")), "filter": fc, "audio": str(ep.p("vo/voice.wav")),
                                   # (script.json: the hook; episode.json: the branding)
                                   "inputs": [str(f) for f in (ep.p("vo/voice.wav"), ep.p("timing.json"), ep.p("script.json"), ep.p("episode.json"),
                                                               ep.app / "src/captions_chunks.json", ass)],
                                   "info": {"hook": shorts[sid]["hook"]}})
        out = work / "plan.json"
        save_json(out, plan)
        print(out)
        return

    separate = "--separate" in args
    E = None

    for sid in sorted(shorts):
        if want and sid not in want:
            continue
        sh = shorts[sid]
        i0, i1, t0, t1 = window(sid)
        out = ep.p(f"shorts/{sid}.mp4")
        if not separate and out.exists() and receipts.receipt_path(out).exists() and not receipts.problems(out):
            print(f"{sid} up to date ({json.loads(receipts.receipt_path(out).read_text()).get('info', {}).get('made_by', 'separate render')})", flush=True)
            continue
        E = E or encoder(ep, opt(args, "--enc"))
        raw = ep.p(f"shorts/raw/{sid}.mp4")
        if not compose_only or not raw.exists():
            staged = work / f"{sid}.raw.{os.getpid()}.mp4"
            enc = ["bun", "scripts/encode.ts", *(["--url", url] if url else []), "--query", "&captions=0", "--from", str(t0), "--to", str(t1),
                   "--fps", str(fps), "--samples", samples, "--only", "auto", "--quiet", "--out", str(staged),
                   *(["--enc", opt(args, "--enc")] if opt(args, "--enc") else [])]
            print("render", sid, t0, t1, flush=True)
            files = engine_inputs(ep, t0, t1)
            before = receipts.hash_inputs(files, raw.parent)
            subprocess.run(ep.lock_cmd(enc), cwd=ep.app, check=True, env=ep.render_env())
            check_video(staged, 1920, 1080, t1 - t0, fps)
            changed = receipts.changed_inputs(before, engine_inputs(ep, t0, t1), raw.parent)
            os.replace(staged, raw)
            receipts.write_receipt(raw, before, {"short": sid, "from": t0, "to": t1, "fps": fps, "changed_mid_render": changed})
            if changed:
                print(f"  warning: {sid} inputs changed mid-render ({', '.join(changed[:4])}): re-render it", flush=True)
        dur = t1 - t0
        fc, ass = compose_graph(ep, sid, sh["hook"], i0, i1, t0, t1, "[0:v]crop=1080:1080:420:0,")
        if E["hwTail"]:
            fc += f";[v]{E['hwTail']}[vo]"
        staged = work / f"{sid}.final.{os.getpid()}.mp4"
        compose_inputs = [raw, ep.p("vo/voice.wav"), ep.p("timing.json"), ep.app / "src/captions_chunks.json", ass]
        before = receipts.hash_inputs(compose_inputs, out.parent)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *E["pre"], "-i", str(raw), "-ss", str(t0), "-t", str(dur), "-i", str(ep.p("vo/voice.wav")),
                        "-filter_complex", fc, "-map", "[vo]" if E["hwTail"] else "[v]", "-map", "1:a",
                        *E["codec"], "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
                        "-movflags", "+faststart", str(staged)], check=True)
        check_video(staged, 1080, 1920, dur, fps, audio=True)
        os.replace(staged, out)
        receipts.write_receipt(out, before, {"short": sid, "from": t0, "to": t1, "hook": sh["hook"], "made_by": "separate render",
                                             "changed_mid_render": receipts.changed_inputs(before, compose_inputs, out.parent)})
        if rc["review_dir"]:
            place_at(out, ep.rel_path(rc["review_dir"]) / "shorts" / out.name)
        print("wrote", out, round(dur, 1), "s", flush=True)


if __name__ == "__main__":
    main()
