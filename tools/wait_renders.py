#!/usr/bin/env python3
"""Block until an episode's render queue is done and nothing is pending:  tools/nx wait-renders <episode> [--timeout s]

Replaces `until ! pgrep -f render_chapter.ts …` loops, which match their own command line (one stalled an
assembly for 15 min). This matches nothing by name:
  1. waits while any engine/work/renders/queue.running.<pid>.json belongs to a live render_chapter.ts process
     (render_chapter.ts writes it while it runs; files of dead pids are removed);
  2. takes and releases the render slots (episode.json render.lock and <lock>.2) with flock, so a render started
     some other way has finished too (this also waits for other episodes' renders and qa on that lock);
  3. checks step 1 again, then prints engine/work/renders/queue.done.json (one line per chapter, with its grid path)
     and `render_chapter.ts --all-pending --dry-run`.
Exit 0: queue done, last queue ok, nothing pending. Exit 1: a chapter FAILED or is still pending (listed).
Exit 3: --timeout reached. Run it as the orchestrator's background command or Monitor: its exit IS "renders done".
"""
import fcntl, json, os, pathlib, re, subprocess, sys, time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import Episode  # noqa: E402


def alive_queue(pid):
    try:
        cmd = pathlib.Path(f"/proc/{pid}/cmdline").read_bytes().split(b"\0")
    except OSError:
        return False
    return any(a.endswith(b"render_chapter.ts") for a in cmd)


def running(work):
    out = []
    for f in work.glob("queue.running.*.json"):
        try:
            pid = int(f.name.split(".")[2])
        except ValueError:
            continue
        if alive_queue(pid):
            out.append(pid)
        else:
            f.unlink(missing_ok=True)
    return out


def main():
    a = sys.argv[1:]
    if not a or a[0].startswith("-"):
        sys.exit(__doc__)
    E = Episode(a[0])
    timeout = float(a[a.index("--timeout") + 1]) if "--timeout" in a else 0
    lock = os.environ.get("HARNESS_RENDER_LOCK", E.cfg["render"]["lock"])
    LOCKS = [lock, lock + ".2"]
    app = E.app
    work = E.engine / "work/renders"
    if not app.is_dir():
        sys.exit(f"no engine at {app}")
    work.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    left = lambda: (timeout - (time.time() - t0)) if timeout else 1e9
    said = False
    while True:
        while running(work):
            if not said:
                print(f"waiting for render queue pid {','.join(map(str, running(work)))}", flush=True)
                said = True
            if left() <= 0:
                print("timeout"); sys.exit(3)
            time.sleep(5)
        for lk in LOCKS:
            if not os.path.exists(lk):
                continue
            with open(lk, "a") as fh:
                while True:
                    try:
                        fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
                        break
                    except BlockingIOError:
                        if left() <= 0:
                            print(f"timeout (lock {lk} held)"); sys.exit(3)
                        time.sleep(3)
                fcntl.flock(fh, fcntl.LOCK_UN)
        if not running(work):
            break
    ok = True
    done = work / "queue.done.json"
    if done.exists():
        d = json.loads(done.read_text())
        ok = bool(d.get("ok"))
        print(f"queue {d.get('mode')} finished {d.get('finished')}: {'ok' if ok else 'NOT ok'}")
        for c in d.get("chapters", []):
            print(f"  {c['id']} {c['status']} {c.get('detail', '')}{'  grid ' + c['grid'] if c.get('grid') else ''}")
    else:
        print("no queue.done.json (no queue has finished in this engine yet)")
    p = subprocess.run(["bun", "scripts/render_chapter.ts", "--all-pending", "--dry-run"], cwd=app, capture_output=True, text=True)
    pend = [l for l in p.stdout.splitlines() if re.match(r"^C\w+ pending", l)]
    for l in pend:
        print("  " + l)
    if p.returncode != 0:
        print(f"pending check failed: {p.stderr.strip().splitlines()[-1:]}")
        sys.exit(1)
    print("nothing pending" if not pend else f"{len(pend)} pending")
    sys.exit(0 if ok and not pend else 1)


if __name__ == "__main__":
    main()
