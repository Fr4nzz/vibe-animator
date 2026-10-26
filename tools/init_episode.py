"""Create a new episode project from the vibe-animator template.

  python3 tools/init_episode.py <dest-dir> [--id my-ep] [--title "My episode"] [--language en]
                                [--script path/to/script.json] [--install] [--force]

Creates:
  <dest>/episode.json         config (copy of tools/templates/episode.json with id/title/language filled in)
  <dest>/script.json          the script (template stub, or a copy of --script)
  <dest>/engine/              a copy of the template engine (no node_modules, renders, work)
  <dest>/engine/renders/, engine/work/, engine/data/, engine/audio/   empty
  <dest>/vo/, renders/, shorts/, publish/                             empty
  <dest>/.gitignore           keeps renders, audio, node_modules and secrets out of git
--install runs `bun install` in engine/app. The episode then owns its engine copy: scenes go in
engine/app/src/scenes/c<N>.ts. Engine fixes in the template do not propagate automatically (copy the changed files).
"""
import json, pathlib, shutil, subprocess, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from common import TEMPLATE_ENGINE, HARNESS, opt, save_json  # noqa: E402

SKIP = {"node_modules", "renders", "work", "dist"}

GITIGNORE = """node_modules/
renders/
work/
shorts/raw/
shorts/ass/
engine/audio/*
!engine/audio/.gitkeep
vo/*.mp3
vo/*.wav
music/cache/
music/*.wav
vo/*.json
!vo/.gitkeep
*.mp4
*.env
*token*.json
*credentials*.json
"""


def main(argv):
    if not argv or argv[0].startswith("-"):
        sys.exit(__doc__)
    dest = pathlib.Path(argv[0]).resolve()
    if dest.exists() and any(dest.iterdir()) and "--force" not in argv:
        sys.exit(f"{dest} exists and is not empty (use --force to add the missing pieces)")
    dest.mkdir(parents=True, exist_ok=True)
    ep_id = opt(argv, "--id", dest.name)
    title = opt(argv, "--title", ep_id)
    lang = opt(argv, "--language", "en")

    cfg_path = dest / "episode.json"
    if not cfg_path.exists():
        cfg = json.loads((HARNESS / "tools/templates/episode.json").read_text())
        cfg.update(id=ep_id, title=title, language=lang)
        save_json(cfg_path, cfg, indent=2)
    script_path = dest / "script.json"
    if not script_path.exists():
        src = opt(argv, "--script")
        if src:
            shutil.copyfile(src, script_path)
        else:
            s = json.loads((HARNESS / "tools/templates/script.json").read_text())
            s["title"] = title
            save_json(script_path, s)

    eng = dest / "engine"
    if not eng.exists():
        shutil.copytree(TEMPLATE_ENGINE, eng, ignore=lambda d, names: [n for n in names if n in SKIP])
    for d in ["engine/renders", "engine/work", "engine/data", "engine/audio", "vo", "renders", "shorts", "publish"]:
        (dest / d).mkdir(parents=True, exist_ok=True)
    for keep in ["engine/audio/.gitkeep", "vo/.gitkeep"]:
        (dest / keep).touch()
    if not (eng / "data/chapters.json").exists() or (eng / "data/chapters.json").read_text().strip() in ("", "[]"):
        (eng / "data/chapters.json").write_text("[]\n")
    gi = dest / ".gitignore"
    if not gi.exists():
        gi.write_text(GITIGNORE)
    if "--install" in argv:
        subprocess.run(["bun", "install"], cwd=eng / "app", check=True)
    print(f"episode {ep_id} at {dest}")
    print("next: edit script.json, then  tools/nx vo|fake-vo, data, captions  (docs/WORKFLOW.md)")


if __name__ == "__main__":
    main(sys.argv[1:])
