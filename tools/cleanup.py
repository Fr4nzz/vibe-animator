#!/usr/bin/env python3
"""Post-publish cleanup of one episode:  tools/nx cleanup <episode> [--yes]

Run only after the YouTube upload is verified. Dry-run by default: it lists what it would delete and the sizes.
  Deletes: the chapter clips engine/renders/<ep>_c<N>.mp4 (assemble.py stream-copied them into renders/<ep>_full.mp4)
           and the scratch folder engine/work/ (staged renders, qa images, logs, the hash cache).
  Keeps:   the full master renders/<ep>_full.mp4, shorts/, vo/, the scripts, the engine source and audio, and the
           receipts (engine/renders/*.receipt.json). Chapters re-render in minutes if a fix is ever needed.
Hard links: a clip with hard links under episode.json render.review_dir is deleted together with those links (listed).
A clip with any other hard link is skipped and reported. Refuses to run if the full master is missing.
"""
import os, pathlib, shutil, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import Episode  # noqa: E402


def size(p):
    if p.is_file():
        return p.stat().st_size
    return sum(f.stat().st_size for f in p.rglob("*") if f.is_file() and not f.is_symlink())


def gb(n):
    return f"{n / 1e9:.2f} GB"


def main():
    a = sys.argv[1:]
    if not a or a[0].startswith("-"):
        sys.exit(__doc__)
    X, yes = Episode(a[0]), "--yes" in a
    ep, E, eng = X.id, X.dir, X.engine
    MV = E.parent
    master = E / "renders" / f"{ep}_full.mp4"
    if not master.exists():
        sys.exit(f"refusing: no full master at {master} (the chapter clips are the only copy)")
    before = size(E)
    rd = X.cfg["render"].get("review_dir")
    review = (E / rd).resolve() if rd else E / "__no_review_dir__"
    links = {}
    if review.is_dir():
        for f in review.rglob("*.mp4"):
            st = f.stat()
            links.setdefault((st.st_dev, st.st_ino), []).append(f)
    plan, skipped = [], []
    mst = master.stat()
    for clip in sorted((eng / "renders").glob(f"{ep}_c*.mp4")):
        st = clip.stat()
        if (st.st_dev, st.st_ino) == (mst.st_dev, mst.st_ino):
            skipped.append((clip, "is the master's inode"))
            continue
        rl = links.get((st.st_dev, st.st_ino), [])
        if st.st_nlink > 1 + len(rl):
            skipped.append((clip, f"{st.st_nlink - 1 - len(rl)} hard link(s) outside review/"))
            continue
        plan.append((clip, rl, st.st_size))
    work = eng / "work"
    wsize = size(work) if work.exists() else 0
    freed = sum(s for _, _, s in plan) + wsize
    for clip, rl, s in plan:
        print(f"{'delete' if yes else 'would delete'} {clip.relative_to(MV)} ({gb(s)})" + (f" + review links: {', '.join(os.path.relpath(r, MV) for r in rl)}" if rl else ""))
    if work.exists():
        print(f"{'delete' if yes else 'would delete'} {work.relative_to(MV)}/ ({gb(wsize)})")
    for clip, why in skipped:
        print(f"skip {clip.relative_to(MV)}: {why}")
    if yes:
        for clip, rl, _ in plan:
            for r in rl:
                r.unlink()
            clip.unlink()
        if work.exists():
            shutil.rmtree(work)
        print(f"freed {gb(freed)}; {ep} now {gb(size(E))} (was {gb(before)})")
    else:
        print(f"dry run: would free {gb(freed)}; {ep} would be {gb(before - freed)} (now {gb(before)}). Rerun with --yes.")


if __name__ == "__main__":
    main()
