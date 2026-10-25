"""Shared helpers for the pipeline tools: episode paths, episode.json config with defaults, ffprobe, atomic writes,
the shared render lock.

Every tool takes the episode directory as its first argument (default: the current directory) and reads
<episode>/episode.json. Nothing is hard-coded to one project: voice, captions, Shorts branding and machine
settings all come from that file (documented in docs/CONFIG.md; template in tools/templates/episode.json).
"""
import copy, json, os, pathlib, shutil, subprocess, sys

HARNESS = pathlib.Path(__file__).resolve().parents[1]
TEMPLATE_ENGINE = HARNESS / "engine"

DEFAULTS = {
    "id": None,
    "title": "",
    "language": "en",
    "voice": {
        "provider": "elevenlabs",
        "voice_id": "",                  # empty -> env named by voice_id_env (the voice is tied to your TTS account)
        "voice_id_env": "ELEVENLABS_VOICE_ID",
        "model": "eleven_multilingual_v2",
        "language_code": None,           # None -> episode "language"
        "api_key_env": "ELEVENLABS_API_KEY",
        "pronounce": {},                 # canonical token -> one spoken token sent to the TTS, e.g. {"SQL": "sequel"}
        "tempo": 1.0,                    # > 1 speeds the voice up (Rubber Band R3); 1.0 skips the stretch
        "gap": 0.3,                      # s of silence after each line
        "chapter_gap": 0.9,              # s of silence between chapters (replaces the line gap)
        "lead_in": 0.5,                  # s before the first line
        "tail": 0.6,                     # s after the last line
        "loudness_lufs": -14.0,
    },
    "captions": {
        "numbers": "none",               # "none" | "es" (spelled-out numbers -> digits); see tools/lang/
        "acronyms": {},                  # spoken form -> shown form, e.g. {"sequel": "SQL"}
        "fixes": [],                     # [[["shown","tokens"], "replacement"], ...] applied after conversion
        "max_chars": 78,
        "line_chars": 44,
    },
    "render": {
        "lock": "/tmp/vibe-animator-render.lock",
        "min_free_gb": 3,
        "gpu_env": {"DRI_PRIME": "1"},
        "angle_args": None,
        "chrome_path": None,
        "private_ports": [5600, 5900],
        "tmpdir": "/var/tmp",
        "review_dir": None,
        "fps": 30,
        "samples": 4,
        "slots": 2,                      # render slots: <lock> and <lock>.2 (two chapter renders at once); qa/stills use <lock>
        "encoder": "h264_vaapi",         # h264_vaapi | hevc_vaapi | x264 | x264-fast | webcodecs (one per episode)
        "video_bitrate": "10M",          # h264_vaapi VBR target (max 17M); video platforms re-encode the grain away
        "vaapi_device": "auto",          # /dev/dri/by-path/pci-…-render of the GPU that encodes; auto = the first one
    },
    "shorts": {
        "brand_line": "",
        "accent_color": "0xF2A33A",
        "ink_color": "0x0A0A0B",
        "bone_color": "0xEEE9DF",
        "hook_font": "CormorantItalic-600.ttf",
        "brand_font": "Archivo-w1000-500.ttf",
        "caption_font": "Archivo",
        "caption_size": 66,
        "samples": 2,
        "max_hook_chars": 60,
    },
}


def merge(base, over):
    out = copy.deepcopy(base)
    for k, v in (over or {}).items():
        out[k] = merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


class Episode:
    """An episode directory: episode.json, script.json, timing.json, vo/, engine/, renders/, shorts/, publish/."""

    def __init__(self, path=None):
        self.dir = pathlib.Path(path or ".").resolve()
        cfg_file = self.dir / "episode.json"
        if not cfg_file.exists():
            sys.exit(f"{cfg_file} not found: create the episode with tools/init_episode.py")
        self.cfg = merge(DEFAULTS, json.loads(cfg_file.read_text()))
        self.id = self.cfg["id"] or self.dir.name
        self.lang = self.cfg["language"]
        self.engine = self.dir / "engine"
        self.app = self.engine / "app"

    # paths
    def p(self, *parts):
        return self.dir.joinpath(*parts)

    def read(self, name):
        return json.loads(self.p(name).read_text())

    @property
    def script(self):
        return self.read("script.json")

    @property
    def timing(self):
        return self.read("timing.json")

    def flat_lines(self, src="timing"):
        doc = self.timing if src == "timing" else self.script
        return [l for c in doc["chapters"] for l in c["lines"]]

    def rel_path(self, rel):
        """A path from episode.json: absolute (with ~), or relative to the episode folder."""
        if not rel:
            return None
        q = pathlib.Path(os.path.expanduser(rel))
        return q if q.is_absolute() else self.dir / q

    def lock_cmd(self, cmd):
        """cmd wrapped: flock <lock> -> wait inside the lock for free memory -> exec cmd (same rule as engine lib.ts)."""
        r = self.cfg["render"]
        lock = os.environ.get("HARNESS_RENDER_LOCK", r["lock"])
        gb = int(float(os.environ.get("HARNESS_MIN_FREE_GB", r["min_free_gb"])) + 0.999)
        wait = f'while [ "$(awk \'/MemAvailable/{{print int($2/1048576)}}\' /proc/meminfo)" -lt {gb} ]; do sleep 15; done; exec "$@"'
        return ["flock", lock, "bash", "-c", wait, "_", *cmd]

    def render_env(self):
        env = dict(os.environ)
        for k, v in (self.cfg["render"]["gpu_env"] or {}).items():
            env.setdefault(k, str(v))
        env["HARNESS_LOCKED"] = "1"
        env.setdefault("TMPDIR", self.cfg["render"]["tmpdir"])
        return env


def episode_from_argv(argv=None):
    """(Episode, remaining args): the first positional argument that is a directory with episode.json, else cwd."""
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv and not argv[0].startswith("-") and (pathlib.Path(argv[0]) / "episode.json").exists():
        return Episode(argv[0]), argv[1:]
    return Episode("."), argv


def opt(args, key, default=None):
    return args[args.index(key) + 1] if key in args else default


def duration(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)]))


def probe(f):
    return json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
                                               "stream=codec_type,width,height,r_frame_rate:format=duration", "-of", "json", str(f)]))


def save_json(path, data, indent=1):
    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=indent) + "\n")
    os.replace(tmp, path)


def place_at(src, dst):
    """Put src at dst atomically: hard link (or copy) to a temp name beside dst, then rename over it. Never truncates
    dst in place, so other hard links of the old dst (e.g. review copies) keep the old file."""
    dst = pathlib.Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_name(f".{dst.name}.{os.getpid()}.tmp")
    try:
        os.link(src, tmp)
    except OSError:
        shutil.copyfile(src, tmp)
    os.replace(tmp, dst)


def srt_time(x):
    ms = int(round(x * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def caption_cues(ep, line_range=None):
    """Caption cues [(start, end, text)] from timing.json + engine caption chunks (the burned-in text)."""
    flat = ep.flat_lines()
    caps = json.loads((ep.app / "src/captions_chunks.json").read_text())
    if len(caps) != len(flat):
        sys.exit(f"captions_chunks.json has {len(caps)} lines, timing.json {len(flat)}: run make_captions.py")
    rng = range(len(flat)) if line_range is None else range(line_range[0], line_range[1] + 1)
    cues = []
    for li in rng:
        line, wi = flat[li], 0
        for ch in caps[li]:
            toks = []
            for tk in ch:
                ws = line["words"][wi:wi + tk["n"]]
                wi += tk["n"]
                toks.append((tk["s"], ws[0]["s"], ws[-1]["e"], tk["br"]))
            cues.append(toks)
    return cues
