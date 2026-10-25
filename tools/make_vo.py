"""Narration: TTS per line (ElevenLabs, with character timestamps) -> optional Rubber Band R3 tempo -> one mix at a
fixed loudness -> <episode>/vo/voice.wav (+ voice.mp3 for the engine) and <episode>/timing.json.

  python3 tools/make_vo.py <episode>

timing.json: {total, chapters: [{id, title, start, end, lines: [{id, start, end, text, display, refs, short, hold,
visual, words: [{w, s, e}]}]}]}. All times are absolute episode seconds. A per-line "hold" (s) adds a pause after it.
Per-line audio is cached in vo/<line id>.mp3 + .json (the alignment + the text that was sent); delete a line's files
to re-voice it. A line whose spoken text changed (script edit, or a new voice.pronounce entry) is re-voiced.
API key: only from the environment, the variable named by voice.api_key_env (default ELEVENLABS_API_KEY).
Voice: voice.voice_id, else the variable named by voice.voice_id_env (default ELEVENLABS_VOICE_ID).
Pronunciation: voice.pronounce respells tokens for the TTS only; timings come back with the canonical tokens
(tools/pron.py).
No key? Use tools/fake_vo.py, which writes the same files with estimated timings and a silent or tone track.
"""
import base64, json, os, re, subprocess, sys, urllib.request
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import duration, episode_from_argv, save_json  # noqa: E402
import pron  # noqa: E402


def api_key(ep):
    v = ep.cfg["voice"]
    k = os.environ.get(v["api_key_env"] or "")
    if k:
        return k
    sys.exit(f"no TTS key: export {v['api_key_env']}=... (or use tools/fake_vo.py)")


def voice_id(ep):
    v = ep.cfg["voice"]
    vid = v["voice_id"] or os.environ.get(v.get("voice_id_env") or "", "")
    if not vid:
        sys.exit(f"no voice: set voice.voice_id in episode.json or export {v.get('voice_id_env')}=...")
    return vid


def tts_elevenlabs(ep, key, flat, k, table):
    ln = flat[k]
    out, meta = ep.p(f"vo/{ln['id']}.mp3"), ep.p(f"vo/{ln['id']}.json")
    say = pron.spoken(ln["text"], table)
    if out.exists() and meta.exists():
        al = json.loads(meta.read_text())
        if al.get("spoken", say) == say:
            return al
        print("re-voicing", ln["id"], "(spoken text changed)", file=sys.stderr)
    v = ep.cfg["voice"]
    body = {"text": say, "model_id": v["model"], "language_code": v.get("language_code") or ep.lang,
            "previous_text": pron.spoken(flat[k - 1]["text"], table) if k else None,
            "next_text": pron.spoken(flat[k + 1]["text"], table) if k + 1 < len(flat) else None}
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id(ep)}/with-timestamps?output_format=mp3_44100_128",
        data=json.dumps(body).encode(), headers={"xi-api-key": key, "Content-Type": "application/json"})
    r = json.load(urllib.request.urlopen(req, timeout=240))
    out.write_bytes(base64.b64decode(r["audio_base64"]))
    al = dict(r.get("normalized_alignment") or r["alignment"], spoken=say)
    meta.write_text(json.dumps(al, ensure_ascii=False))
    print("voiced", ln["id"], file=sys.stderr)
    return al


def words_from_alignment(al):
    ws, cur, st, pe = [], "", None, None
    for ch, s, e in zip(al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]):
        if ch.isspace():
            if cur:
                ws.append({"w": cur, "s": st, "e": pe})
                cur = ""
            continue
        if not cur:
            st = s
        cur += ch
        pe = e
    if cur:
        ws.append({"w": cur, "s": st, "e": pe})
    return ws


def stretched(ep, lid, tempo):
    """Decode once to PCM; if tempo != 1, time-stretch with the Rubber Band R3 ("finer") engine. (ffmpeg's rubberband
    filter only has the older R2 engine, whose phase-vocoder smear makes a voice sound phasey.)"""
    src, dec, dst = ep.p(f"vo/{lid}.mp3"), ep.p(f"vo/{lid}.dec.wav"), ep.p(f"vo/{lid}.r3.wav")
    if abs(tempo - 1) < 1e-6:
        if not dec.exists():
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), str(dec)], check=True)
        return dec
    if not dst.exists():
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), str(dec)], check=True)
        subprocess.run(["rubberband", "-3", "-q", "-T", str(tempo), str(dec), str(dst)], check=True, stdout=subprocess.DEVNULL)
        dec.unlink()
    return dst


def layout(ep, script, per_line):
    """per_line(k, line) -> (audio file, words [{w, s, e}] in the file's own seconds, already tempo-scaled).
    Returns (timing dict, [(file, start)])."""
    v = ep.cfg["voice"]
    gap, ch_gap = v["gap"], v["chapter_gap"]
    t, k, chapters, parts = v["lead_in"], 0, [], []
    for ch in script["chapters"]:
        cst, lines = t, []
        for ln in ch["lines"]:
            f, ws = per_line(k, ln)
            k += 1
            d = duration(f)
            lines.append({"id": ln["id"], "start": round(t, 3), "end": round(t + d, 3), "text": ln["text"],
                          "display": ln.get("display", ln["text"]), "refs": ln.get("refs", []), "short": ln.get("short"),
                          "hold": ln.get("hold", 0), "visual": ln.get("visual", ""),
                          "words": [{"w": w["w"], "s": round(t + w["s"], 3), "e": round(t + w["e"], 3)} for w in ws]})
            parts.append((f, t))
            t += d + gap + ln.get("hold", 0)
        t += ch_gap - gap
        chapters.append({"id": ch["id"], "title": ch.get("title", ""), "start": round(cst, 3), "end": round(lines[-1]["end"], 3), "lines": lines})
    total = round(t - (ch_gap - gap) - gap + v["tail"], 2) if chapters else 0
    return {"total": total, "chapters": chapters}, parts


def mix(ep, parts, total, batch=60):
    """Lay every line at its start, then one static gain to the target loudness plus a true-peak limiter that only
    touches rare peaks (no dynamic loudnorm, which pumps like a compressor). Writes vo/voice.wav and vo/voice.mp3."""
    work = ep.p("vo/_mix")
    work.mkdir(exist_ok=True)
    stems = []
    for b in range(0, len(parts), batch):  # batches keep ffmpeg's input count reasonable
        chunk = parts[b:b + batch]
        inputs, filt = [], []
        for i, (f, st) in enumerate(chunk):
            inputs += ["-i", str(f)]
            ms = int(st * 1000)
            filt.append(f"[{i}:a]aresample=48000,adelay={ms}|{ms}[a{i}]")
        filt.append("".join(f"[a{i}]" for i in range(len(chunk))) + f"amix=inputs={len(chunk)}:normalize=0,apad,atrim=0:{total}[out]")
        stem = work / f"stem{b // batch}.wav"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(filt), "-map", "[out]",
                        "-ar", "48000", "-c:a", "pcm_s24le", str(stem)], check=True)
        stems.append(stem)
    m = work / "mix.wav"
    if len(stems) == 1:
        os.replace(stems[0], m)
    else:
        ins = sum((["-i", str(s)] for s in stems), [])
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex",
                        "".join(f"[{i}:a]" for i in range(len(stems))) + f"amix=inputs={len(stems)}:normalize=0[out]",
                        "-map", "[out]", "-ar", "48000", "-c:a", "pcm_s24le", str(m)], check=True)
    target = ep.cfg["voice"]["loudness_lufs"]
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(m), "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    found = re.findall(r"I:\s+(-?[\d.]+) LUFS", err)
    lufs = float(found[-1]) if found else float("-inf")
    gain = 0.0 if lufs == float("-inf") or lufs < -69 else target - lufs  # silent track (fake voice): no gain
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(m), "-af",
                    f"volume={gain:.2f}dB,alimiter=limit=0.84:attack=1:release=60:level=disabled",
                    "-ar", "48000", "-c:a", "pcm_s24le", str(ep.p("vo/voice.wav"))], check=True)
    for f in work.iterdir():
        f.unlink()
    work.rmdir()
    # mp3 for the engine preview/encoder only; masters (assemble, Shorts) use voice.wav
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(ep.p("vo/voice.wav")), "-c:a", "libmp3lame", "-b:a", "320k",
                    str(ep.p("vo/voice.mp3"))], check=True)
    print(f"mix {lufs:.1f} LUFS, gain {gain:+.2f} dB")


def report(timing):
    print("total", timing["total"])
    for c in timing["chapters"]:
        print(c["id"], c["start"], c["end"], round(c["end"] - c["start"], 1), "s", c["title"])


def main():
    ep, args = episode_from_argv()
    script = ep.script
    v = ep.cfg["voice"]
    if v["provider"] != "elevenlabs":
        sys.exit(f"voice.provider {v['provider']!r} is not implemented (elevenlabs only; or tools/fake_vo.py)")
    ep.p("vo").mkdir(exist_ok=True)
    key = api_key(ep)
    voice_id(ep)
    table = pron.check(v.get("pronounce") or {})
    flat = [ln for ch in script["chapters"] for ln in ch["lines"]]
    tempo = float(v["tempo"])

    def per_line(k, ln):
        al = tts_elevenlabs(ep, key, flat, k, table)
        ws = [{"w": w["w"], "s": w["s"] / tempo, "e": w["e"] / tempo} for w in pron.canonical_words(ln["text"], words_from_alignment(al), table)]
        return stretched(ep, ln["id"], tempo), ws

    timing, parts = layout(ep, script, per_line)
    mix(ep, parts, timing["total"])
    save_json(ep.p("timing.json"), timing)
    report(timing)


if __name__ == "__main__":
    main()
