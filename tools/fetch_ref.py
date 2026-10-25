"""fetch_ref: the one way agents download external assets (reference art, plates, indexes, API queries).

  tools/fetch_ref URL [-o OUT] [--episode DIR] [--max-mb 50] [--quiet]
      Without -o the body goes to stdout. Prints "saved OUT (N bytes, content-type)" on stderr.

Why a wrapper: every request carries one fixed project User-Agent (Wikimedia and others require a descriptive UA),
requests to one host are spaced politely, and no request ever carries personal data. Agents must not compose their
own curl/wget headers.

User-Agent, in order: env HARNESS_FETCH_UA, then "fetch": {"user_agent": …} in the episode's episode.json (--episode,
or the current directory), then the default below. The tool REFUSES to run if the UA or the URL contains an email
address: put a repository URL in the UA, never a person's name, email or account.

Politeness: at least fetch.min_interval_s (default 1.0 s) between requests to the same host, across processes
(a timestamp file under ~/.cache/vibe-animator/fetch_ref/, taken under flock). On HTTP 429/503 it waits
for Retry-After (at most 60 s) and tries again, at most twice; any other error stops.

Python use (refart.py): `from fetch_ref import fetch; data = fetch(url)` or `fetch(url, out=path)`.
"""
import fcntl, json, os, pathlib, re, sys, time, urllib.error, urllib.parse, urllib.request

DEFAULT_UA = "vibe-animator/0.1 (+https://github.com/Fr4nzz/vibe-animator)"
DEFAULTS = {"user_agent": DEFAULT_UA, "min_interval_s": 1.0, "max_mb": 50, "timeout_s": 60}
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+(@|%40)[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
CACHE = pathlib.Path(os.environ.get("XDG_CACHE_HOME", pathlib.Path.home() / ".cache")) / "vibe-animator"


class FetchError(RuntimeError):
    pass


def config(episode=None):
    cfg = dict(DEFAULTS)
    ep = pathlib.Path(episode) if episode else pathlib.Path.cwd()
    f = ep / "episode.json"
    if f.is_file():
        try:
            cfg.update(json.loads(f.read_text()).get("fetch") or {})
        except (ValueError, OSError):
            pass
    if os.environ.get("HARNESS_FETCH_UA"):
        cfg["user_agent"] = os.environ["HARNESS_FETCH_UA"]
    ua = (cfg.get("user_agent") or "").strip()
    if not ua:
        raise FetchError("empty User-Agent: set fetch.user_agent or HARNESS_FETCH_UA to a project UA")
    if EMAIL.search(ua) or "mailto:" in ua.lower():
        raise FetchError("the User-Agent contains an email address; use a project UA with a repository URL instead")
    cfg["user_agent"] = ua
    return cfg


def _wait_turn(host, interval):
    """Space requests to one host by `interval` seconds, across processes."""
    d = CACHE / "fetch_ref"
    d.mkdir(parents=True, exist_ok=True)
    with open(d / (re.sub(r"[^A-Za-z0-9.-]", "_", host) + ".ts"), "a+") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        f.seek(0)
        try:
            last = float(f.read().strip() or 0)
        except ValueError:
            last = 0.0
        delay = last + interval - time.time()
        if delay > 0:
            time.sleep(min(delay, interval))
        f.seek(0)
        f.truncate()
        f.write(str(time.time()))


def fetch(url, out=None, episode=None, max_mb=None, headers=None, quiet=True):
    """GET `url` with the project UA. Returns the bytes (and writes them atomically to `out` if given)."""
    cfg = config(episode)
    if EMAIL.search(urllib.parse.unquote(url)):
        raise FetchError("the URL contains an email address; refusing (no personal data in requests)")
    u = urllib.parse.urlsplit(url)
    if u.scheme not in ("http", "https"):
        raise FetchError(f"only http(s) URLs: {url}")
    limit = int(float(max_mb or cfg["max_mb"]) * 1024 * 1024)
    h = {"User-Agent": cfg["user_agent"], "Accept-Encoding": "identity", **(headers or {})}
    for attempt in range(3):
        _wait_turn(u.hostname or "", float(cfg["min_interval_s"]))
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=cfg["timeout_s"]) as r:
                n = int(r.headers.get("Content-Length") or 0)
                if n > limit:
                    raise FetchError(f"{url}: {n} bytes exceeds the {limit >> 20} MB limit (--max-mb)")
                data = r.read(limit + 1)
                if len(data) > limit:
                    raise FetchError(f"{url}: body exceeds the {limit >> 20} MB limit (--max-mb)")
                ctype = r.headers.get("Content-Type", "")
            break
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < 2:
                wait = min(60.0, float(e.headers.get("Retry-After") or 5) if (e.headers.get("Retry-After") or "5").isdigit() else 5.0)
                print(f"fetch_ref: HTTP {e.code} from {u.hostname}; waiting {wait:.0f} s", file=sys.stderr)
                time.sleep(wait)
                continue
            raise FetchError(f"{url} -> HTTP {e.code}") from None
        except urllib.error.URLError as e:
            raise FetchError(f"{url} -> {e.reason}") from None
    if out:
        out = pathlib.Path(out)
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_name(f".{out.name}.{os.getpid()}.part")
        tmp.write_bytes(data)
        os.replace(tmp, out)
        if not quiet:
            print(f"saved {out} ({len(data)} bytes, {ctype})", file=sys.stderr)
    return data


def fetch_json(url, **kw):
    return json.loads(fetch(url, **kw))


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        sys.exit(__doc__)
    opt = lambda k: argv[argv.index(k) + 1] if k in argv else None
    url = argv[0]
    try:
        data = fetch(url, out=opt("-o"), episode=opt("--episode"), max_mb=opt("--max-mb"), quiet="--quiet" in argv)
    except FetchError as e:
        sys.exit(f"fetch_ref: {e}")
    if not opt("-o"):
        sys.stdout.buffer.write(data)


if __name__ == "__main__":
    main(sys.argv[1:])
