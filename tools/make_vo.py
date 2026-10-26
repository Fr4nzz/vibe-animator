"""Narration: TTS per line (ElevenLabs, with character timestamps) -> optional Rubber Band R3 tempo -> one mix at a
fixed loudness -> <episode>/vo/voice.wav (+ voice.mp3 for the engine) and <episode>/timing.json.

  python3 tools/make_vo.py <episode> [--cached]

--cached rebuilds voice.wav and timing.json from the per-line cache only (no key needed, no TTS call; stops if a line
is missing or stale). Each line clip is first leveled to voice.line_lufs (default -20 LUFS, true peak capped at
voice.line_peak), because different TTS voices come out several dB apart; null turns that off.

timing.json: {total, chapters: [{id, title, start, end, lines: [{id, start, end, text, display, refs, short, hold,
visual, words: [{w, s, e}]}]}]}. All times are absolute episode seconds. A per-line "hold" (s) adds a pause after it.
Per-line audio is cached in vo/<line id>.mp3 + .json (the alignment + the text that was sent); delete a line's files
to re-voice it. A line whose spoken text changed (script edit, or a new voice.pronounce entry) is re-voiced.
API key: only from the environment, the variable named by voice.api_key_env (default ELEVENLABS_API_KEY).
Voice: voice.voice_id, else the variable named by voice.voice_id_env (default ELEVENLABS_VOICE_ID).
Several voices: voice.voices maps a role to a voice id ({"NARRATOR": "...", "GUEST": "..."}); a line's "voice" field
names its role, and lines without one use voice.default_role. An empty id in the map reads ELEVENLABS_VOICE_<ROLE>
from the environment, then falls back to the single voice above. Each line is voiced with its role's id; the voice id is cached beside the line, so changing a
role's voice re-voices its lines. timing.json, word timings and captions are the same as with one voice.
Pronunciation: voice.pronounce respells tokens for the TTS only; timings come back with the canonical tokens
(tools/pron.py).
No key? Use tools/fake_vo.py, which writes the same files with estimated timings and a silent or tone track.
"""
import base64, json, math, os, re, subprocess, sys, urllib.error, urllib.request
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


def role_of(ep, ln):
    """The voice role a line is spoken in: its "voice" field, else voice.default_role (None: single-voice episode)."""
    return ln.get("voice") or ep.cfg["voice"].get("default_role") or None


def voice_id(ep, role=None):
    """The voice id for a role. Multi-voice: voice.voices[role], else env ELEVENLABS_VOICE_<ROLE>. Single voice (no
    voice.voices, or a listed role with an empty id and no env): voice.voice_id, else env voice.voice_id_env."""
    v = ep.cfg["voice"]
    roles = v.get("voices") or {}
    if role:
        env = "ELEVENLABS_VOICE_" + "".join(ch if ch.isalnum() else "_" for ch in role.upper())
        vid = roles.get(role) or os.environ.get(env, "")
        if vid:
            return vid
        if roles and role not in roles:
            sys.exit(f"no voice for role {role!r}: add it to voice.voices in episode.json or export {env}=...")
    vid = v["voice_id"] or os.environ.get(v.get("voice_id_env") or "", "")
    if not vid:
        sys.exit(f"no voice: set voice.voice_id in episode.json or export {v.get('voice_id_env')}=...")
    return vid


def voice_plan(ep, flat):
    """[voice id per line], resolved up front so a missing role fails before any characters are spent."""
    return [voice_id(ep, role_of(ep, ln)) for ln in flat]


def tts_elevenlabs(ep, key, flat, k, table, vids):
    ln, vid = flat[k], vids[k]
    out, meta = ep.p(f"vo/{ln['id']}.mp3"), ep.p(f"vo/{ln['id']}.json")
    say = pron.spoken(ln["text"], table)
    if out.exists() and meta.exists():
        al = json.loads(meta.read_text())
        if al.get("spoken", say) == say and al.get("voice_id", vid) == vid:
            return al
        why = "spoken text" if al.get("spoken", say) != say else "voice"
        if key is None:
            sys.exit(f"--cached: {ln['id']} needs re-voicing ({why} changed); not calling the TTS")
        print("re-voicing", ln["id"], f"({why} changed)", file=sys.stderr)
    elif key is None:
        sys.exit(f"--cached: {ln['id']} has no cached audio; not calling the TTS")
    v = ep.cfg["voice"]
    # context for prosody: the neighbouring lines in the same voice only (another speaker's line is not continuity)
    prev = pron.spoken(flat[k - 1]["text"], table) if k and vids[k - 1] == vid else None
    nxt = pron.spoken(flat[k + 1]["text"], table) if k + 1 < len(flat) and vids[k + 1] == vid else None
    body = {"text": say, "model_id": v["model"], "language_code": v.get("language_code") or ep.lang,
            "previous_text": prev, "next_text": nxt}
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{vid}/with-timestamps?output_format=mp3_44100_128"
    try:
        r = _post(url, body, key)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:400]
        if e.code in (400, 422) and (prev or nxt) and ("previous_text" in detail or "next_text" in detail):
            # some models refuse request stitching: retry once without the context
            r = _post(url, dict(body, previous_text=None, next_text=None), key)
        else:
            sys.exit(f"TTS failed for {ln['id']}: HTTP {e.code} {detail}")
    out.write_bytes(base64.b64decode(r["audio_base64"]))
    al = dict(r.get("normalized_alignment") or r["alignment"], spoken=say, voice_id=vid)
    if role_of(ep, ln):
        al["role"] = role_of(ep, ln)
    meta.write_text(json.dumps(al, ensure_ascii=False))
    print("voiced", ln["id"], f"[{role_of(ep, ln)}]" if role_of(ep, ln) else "", len(say), "chars", file=sys.stderr)
    return al


def _post(url, body, key):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"xi-api-key": key, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=240))


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
    fresh = lambda f: f.exists() and f.stat().st_mtime_ns >= src.stat().st_mtime_ns  # a re-voiced line rebuilds these
    if abs(tempo - 1) < 1e-6:
        if not fresh(dec):
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), str(dec)], check=True)
        return dec
    if not fresh(dst):
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


SHORT_LINE = 3.0  # s: below this a clip's integrated loudness is too few blocks to trust; use speech-gated momentary
MAX_LINE_GAIN = 18.0  # dB: a clip needing more than this is broken (or silent), not quiet


def line_loudness(f):
    """(loudness LUFS or None, true peak dBTP) of one line clip. Clips of SHORT_LINE s or more: EBU R128 integrated.
    Shorter clips: the energy mean of the 400 ms momentary values within 10 LU of the loudest one (speech gating, so
    the lead/trail silence and breaths do not drag it down). None: silent (a fake-voice track) or too short to read."""
    err = subprocess.run(["ffmpeg", "-hide_banner", "-v", "verbose", "-nostats", "-i", str(f), "-af", "ebur128=peak=true",
                          "-f", "null", "-"], capture_output=True, text=True).stderr
    summary = err[err.rfind("Summary:"):]
    found = re.findall(r"I:\s+(-?[\d.]+) LUFS", summary)
    peak = re.findall(r"Peak:\s+(-?[\d.]+|-inf) dBFS", summary)
    tp = float(peak[-1]) if peak else 0.0
    if duration(f) >= SHORT_LINE:
        i = float(found[-1]) if found else -70.0
        return (None if i <= -69.9 else i), tp
    ms = [float(m) for m in re.findall(r"\bM:\s*(-?[\d.]+)", err[:len(err) - len(summary)])]
    ms = [m for m in ms if m > -70]
    if not ms:
        return None, tp
    top = max(ms)
    gated = [m for m in ms if m >= top - 10]
    return 10 * math.log10(sum(10 ** (m / 10) for m in gated) / len(gated)), tp


def line_gains(ep, files):
    """{file: dB} bringing each line clip to voice.line_lufs, capped so its true peak stays at or under voice.line_peak.
    Different TTS voices come out several dB apart; without this a quiet voice stays quiet after the one master gain.
    Empty when voice.line_lufs is null/false (the old behaviour: clips mixed as they came)."""
    v = ep.cfg["voice"]
    target = v.get("line_lufs")
    if target is None or target is False:
        return {}
    ceiling = float(v.get("line_peak", -1.0))
    gains = {}
    for f in dict.fromkeys(files):
        lufs, tp = line_loudness(f)
        if lufs is None:
            gains[f] = 0.0
            continue
        g = max(-MAX_LINE_GAIN, min(MAX_LINE_GAIN, float(target) - lufs))
        gains[f] = round(min(g, ceiling - tp), 2)
    return gains


def mix(ep, parts, total, batch=60):
    """Level every line clip to voice.line_lufs (one static gain per clip; timing untouched), lay each at its start,
    then one static gain to the target loudness plus a true-peak limiter that only touches rare peaks (no dynamic
    loudnorm, which pumps like a compressor). Writes vo/voice.wav and vo/voice.mp3."""
    work = ep.p("vo/_mix")
    work.mkdir(exist_ok=True)
    gains = line_gains(ep, [f for f, _ in parts])
    if gains:
        vals = sorted(gains.values())
        print(f"line leveling to {ep.cfg['voice']['line_lufs']} LUFS: gains {vals[0]:+.1f} .. {vals[-1]:+.1f} dB")
    stems = []
    for b in range(0, len(parts), batch):  # batches keep ffmpeg's input count reasonable
        chunk = parts[b:b + batch]
        inputs, filt = [], []
        for i, (f, st) in enumerate(chunk):
            inputs += ["-i", str(f)]
            ms = int(st * 1000)
            vol = f"volume={gains[f]:.2f}dB," if gains.get(f) else ""
            filt.append(f"[{i}:a]aresample=48000,{vol}adelay={ms}|{ms}[a{i}]")
        filt.append("".join(f"[a{i}]" for i in range(len(chunk))) + f"amix=inputs={len(chunk)}:normalize=0,apad,atrim=0:{total}[out]")
        stem = work / f"stem{b // batch}.wav"
        # float stems: a boosted line may pass 0 dBFS before the master gain and limiter; integer PCM would clip it here
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(filt), "-map", "[out]",
                        "-ar", "48000", "-c:a", "pcm_f32le", str(stem)], check=True)
        stems.append(stem)
    m = work / "mix.wav"
    if len(stems) == 1:
        os.replace(stems[0], m)
    else:
        ins = sum((["-i", str(s)] for s in stems), [])
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex",
                        "".join(f"[{i}:a]" for i in range(len(stems))) + f"amix=inputs={len(stems)}:normalize=0[out]",
                        "-map", "[out]", "-ar", "48000", "-c:a", "pcm_f32le", str(m)], check=True)
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
    key = None if "--cached" in args else api_key(ep)  # --cached: rebuild from vo/ only, never call the TTS
    table = pron.check(v.get("pronounce") or {})
    flat = [ln for ch in script["chapters"] for ln in ch["lines"]]
    vids = voice_plan(ep, flat)
    tempo = float(v["tempo"])

    def per_line(k, ln):
        al = tts_elevenlabs(ep, key, flat, k, table, vids)
        ws = [{"w": w["w"], "s": w["s"] / tempo, "e": w["e"] / tempo} for w in pron.canonical_words(ln["text"], words_from_alignment(al), table)]
        return stretched(ep, ln["id"], tempo), ws

    timing, parts = layout(ep, script, per_line)
    mix(ep, parts, timing["total"])
    save_json(ep.p("timing.json"), timing)
    report(timing)


if __name__ == "__main__":
    main()
