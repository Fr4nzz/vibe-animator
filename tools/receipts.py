"""Receipts: prove an output (chapter clip, master, Short) was made from the inputs that exist now.

A receipt is `<file>.receipt.json` beside the output (written by render_chapter.ts for clips, assemble.py for
masters, make_shorts.py for Shorts and their raw renders):

  {"version": 1, "file": "S01.mp4", "sha256": "<output>", "size": n, "created": iso,
   "inputs": {"<path relative to the output's folder>": "<sha256>", ...}, "info": {...}}

Input hashes are taken when the render STARTS, so an input edited while it rendered leaves the output stale.

  python3 tools/receipts.py verify-fresh <file> [<file> ...] [--base <dir>]   (one line per file; exit 1 if any stale)

A file is fresh when its receipt exists, its own sha256 matches the receipt, every input still has the recorded
sha256, and every input that has a receipt of its own (a master's chapter clips, a Short's raw render) is fresh too.
Publishing code calls require_fresh(paths) before uploading anything.
"""
import datetime as dt, hashlib, json, os, pathlib, sys

_cache = {}


def sha256(path):
    """sha256 hex of a file, cached per process by (size, mtime, inode)."""
    p = pathlib.Path(path)
    st = p.stat()
    key = (str(p.resolve()), st.st_size, st.st_mtime_ns, st.st_ino)
    if key not in _cache:
        h = hashlib.sha256()
        with open(p, "rb") as f:
            for block in iter(lambda: f.read(4 << 20), b""):
                h.update(block)
        _cache[key] = h.hexdigest()
    return _cache[key]


def receipt_path(path):
    p = pathlib.Path(path)
    return p.with_name(p.name + ".receipt.json")


def hash_inputs(paths, base):
    """{path relative to base (posix): sha256} for existing files."""
    base = pathlib.Path(base).resolve()
    return {pathlib.Path(os.path.relpath(pathlib.Path(p).resolve(), base)).as_posix(): sha256(p)
            for p in paths if pathlib.Path(p).is_file()}


def changed_inputs(before, paths, base):
    """Inputs whose hash differs between `before` (a hash_inputs result) and now."""
    now = hash_inputs(paths, base)
    return sorted(k for k in set(before) | set(now) if before.get(k) != now.get(k))


def write_receipt(output, inputs, info=None):
    """Write <output>.receipt.json atomically. `inputs`: a hash_inputs() dict relative to output's folder, or paths."""
    output = pathlib.Path(output)
    if not isinstance(inputs, dict):
        inputs = hash_inputs(inputs, output.parent)
    st = output.stat()
    rec = {"version": 1, "file": output.name, "sha256": sha256(output), "size": st.st_size,
           "created": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "inputs": inputs,
           "info": dict(info or {}, ino=st.st_ino, mtime_ms=st.st_mtime_ns / 1e6)}
    rp = receipt_path(output)
    tmp = rp.with_name(f".{rp.name}.{os.getpid()}.tmp")
    tmp.write_text(json.dumps(rec, indent=1) + "\n")
    os.replace(tmp, rp)
    return rec


def problems(path, depth=0, seen=None):
    """Reasons `path` is not fresh ([] = fresh). Recurses into inputs that have receipts of their own."""
    p = pathlib.Path(path)
    seen = set() if seen is None else seen
    key = str(p.resolve())
    if key in seen or depth > 4:
        return []
    seen.add(key)
    if not p.is_file():
        return [f"{p.name} missing"]
    rp = receipt_path(p)
    if not rp.is_file():
        return [f"{p.name} has no receipt"]
    try:
        rec = json.loads(rp.read_text())
    except ValueError:
        return [f"{rp.name} unreadable"]
    if rec.get("size") != p.stat().st_size or rec.get("sha256") != sha256(p):
        return [f"{p.name} was replaced after its receipt was written"]
    out = []
    for rel, h in sorted(rec.get("inputs", {}).items()):
        q = p.parent / rel
        if not q.is_file():
            out.append(f"{rel} missing")
        elif sha256(q) != h:
            mid = rel in rec.get("info", {}).get("changed_mid_render", [])
            out.append(f"{rel} changed{' (mid-render)' if mid else ''}")
        elif receipt_path(q).is_file():
            out += [f"{rel}: {r}" for r in problems(q, depth + 1, seen)]
    return out


def verify_fresh(paths):
    """[(path, [reasons])] for each path."""
    return [(p, problems(p)) for p in paths]


def require_fresh(paths):
    """For publishing code: exit with one line per stale file unless every file is fresh."""
    bad = [(p, r) for p, r in verify_fresh(paths) if r]
    if bad:
        sys.exit("\n".join(f"STALE {p}: {'; '.join(r[:3])}{f' (+{len(r) - 3})' if len(r) > 3 else ''}" for p, r in bad)
                 + "\nrefusing to publish stale outputs: re-render, or check them with tools/receipts.py verify-fresh")


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv or argv[0] != "verify-fresh":
        sys.exit(__doc__)
    args = argv[1:]
    base = None
    if "--base" in args:
        i = args.index("--base")
        base = pathlib.Path(args[i + 1])
        del args[i:i + 2]
    if not args:
        sys.exit("usage: receipts.py verify-fresh <file> [<file> ...] [--base <dir>]")
    paths = [pathlib.Path(a) if pathlib.Path(a).exists() or base is None else base / a for a in args]
    stale = 0
    for p, r in verify_fresh(paths):
        stale += bool(r)
        print(f"STALE {p}: {'; '.join(r[:3])}{f' (+{len(r) - 3})' if len(r) > 3 else ''}" if r else f"OK {p}")
    sys.exit(1 if stale else 0)


if __name__ == "__main__":
    main()
