#!/usr/bin/env python3
"""New-episode scaffolder: one call replaces the manual init / install / voice-data / captions / dev-server steps.

  python3 tools/new_episode.py <dest> [--id x] [--title "…"] [--language en] [--script s.json] [--scenes DIR]
                               [--fake-vo] [--port N] [--no-install] [--no-dev] [--selftest] [--force]
  python3 tools/new_episode.py <episode> --data [--fake-vo] [--no-dev]   after make_vo: data + captions + packs (+ dev)
  python3 tools/new_episode.py <episode> --packs                         only rewrite packs/C<N>.md (after a script change)
  (tools/nx new … is the same command; tools/nx packs <episode> runs --packs.)

In order:
  1. tools/init_episode.py: episode.json, script.json (--script copies yours), the engine copy, empty folders;
     --scenes DIR copies DIR/*.ts into engine/app/src/scenes/ (e.g. examples/lens/scenes);
  2. narration: with --fake-vo and no timing.json, tools/fake_vo.py writes estimated timings and a silent track (for
     layout and tests only; never render a fake voice for real). Then check_script, make_engine_data and
     make_captions. Without timing.json and without --fake-vo it stops after the engine copy and says to run
     `tools/nx vo <ep>`, then `new_episode.py <ep> --data`;
  3. bun install (--no-install skips it) and KIT_INDEX.md (engine/app/scripts/kit_index.ts);
  4. per-chapter build packs <ep>/packs/C<N>.md: the chapter's lines with timing, Short markers and visual notes, its
     fact-check rows (FACT_CHECK.md lines naming its line ids), its paper quotes, refs (refs.json), and the
     KIT_INDEX.md exports that match its visual notes. A builder reads its pack, docs/AGENT_WORKFLOW.md and
     docs/STYLE_GUIDE.md, nothing else broadly;
  5. a BUILD_BRIEF.md from docs/templates/BUILD_BRIEF.md if the episode has none;
  6. picks the dev port (--port, else the first free one from 5730 in steps of 10) and starts Vite in the background
     (log engine/work/vite.log, pid engine/work/vite.pid; it keeps running: stop it when the episode is done);
  7. --selftest: `qa.ts --chapter C0` on the running server must end with TOTAL 0 (the placeholder or your C0 scene).
"""
import json, os, pathlib, re, shutil, socket, subprocess, sys, time

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import HARNESS, Episode, opt  # noqa: E402

CORE_KITS = ["paperBeat", "beatTimes", "PaperView", "transPanel", "holdFor", "refArt", "rasterArt", "drawArt",
             "fig2", "lab", "say", "arrow", "citeBar", "typeCard", "SQ", "K", "ManimLayer"]


def say(*a):
    print(*a, flush=True)


def run(cmd, cwd=None, check=True, quiet=False):
    p = subprocess.run([str(c) for c in cmd], cwd=cwd, capture_output=True, text=True)
    if not quiet and p.stdout.strip():
        say("   " + p.stdout.strip().splitlines()[-1])
    if check and p.returncode:
        sys.exit(f"FAILED ({p.returncode}): {' '.join(map(str, cmd))}\n{(p.stderr or p.stdout).strip()[-1500:]}")
    return p


def port_free(port):
    # Vite binds "localhost", which is often [::1] only: probe IPv4 and IPv6, a fresh socket per attempt
    for fam, addr in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
        try:
            with socket.socket(fam) as s:
                s.settimeout(0.5)
                if s.connect_ex((addr, port)) == 0:
                    return False
        except OSError:
            pass
    return True


def pick_port(want):
    if want:
        if not port_free(want):
            sys.exit(f"port {want} is in use")
        return want
    for p in range(5730, 6000, 10):
        if port_free(p) and port_free(p + 1):
            return p
    sys.exit("no free dev port in 5730–5990")


# ---------------------------------------------------------------- steps
def data_steps(E, fake):
    if not E.p("timing.json").exists():
        if fake:
            run([sys.executable, HERE / "fake_vo.py", E.dir], quiet=True)
        else:
            say(f"2. no timing.json: run `tools/nx vo {E.dir}` (ELEVENLABS_API_KEY), then `new_episode.py {E.dir} --data`")
            return False
    run([sys.executable, HERE / "check_script.py", E.dir], quiet=True)
    run([sys.executable, HERE / "make_engine_data.py", E.dir], quiet=True)
    run([sys.executable, HERE / "make_captions.py", E.dir], quiet=True)
    fake_note = " (FAKE VO: estimated timings; voice it before rendering for real)" if json.load(open(E.p("timing.json"))).get("fake") else ""
    say(f"2. engine/data/{{lyrics,audio,chapters}}.json, engine/audio/voice.mp3, captions_chunks.json written{fake_note}")
    return True


def kit_index(E):
    p = run(["bun", "scripts/kit_index.ts", "--out", "KIT_INDEX.md"], cwd=E.app, quiet=True)
    say("   " + (p.stdout.strip().splitlines() or ["KIT_INDEX.md written"])[-1])


def kits_table(E):
    """name -> (file:line, doc, used-in) from KIT_INDEX.md."""
    out = {}
    f = E.app / "KIT_INDEX.md"
    if not f.exists():
        return out
    for line in f.read_text().splitlines():
        m = re.match(r"\| `([^`]+)` \| (\w+) \| (.*?) \| (.*?) \| (\S+) \| (.*?) \|$", line)
        if m:
            out.setdefault(m.group(1), (m.group(5), m.group(4).replace("\\|", "|"), m.group(6)))
    return out


def quotes_by_line(E):
    """line id -> [(paper key, quote)] from public/papers/**/quotes.json (quotes carrying lines_vo)."""
    out = {}
    for qf in sorted((E.app / "public/papers").glob("**/quotes.json")):
        try:
            data = json.load(open(qf))
        except ValueError:
            continue
        for key, e in data.items():
            for q in (e or {}).get("quotes", []):
                for lid in q.get("lines_vo", []):
                    out.setdefault(lid, []).append((key, q))
    return out


def packs(E):
    T = E.timing
    S = E.script
    vis = {l["id"]: l for c in S["chapters"] for l in c["lines"]}
    refs = json.load(open(E.p("refs.json"))) if E.p("refs.json").exists() else {}
    fc = E.p("FACT_CHECK.md").read_text().splitlines() if E.p("FACT_CHECK.md").exists() else []
    qbl = quotes_by_line(E)
    kits = kits_table(E)
    port = (E.engine / ".devport").read_text().strip() if (E.engine / ".devport").exists() else "<port>"
    E.p("packs").mkdir(exist_ok=True)
    for ch in T["chapters"]:
        cid = ch["id"]
        n = cid[1:].lower()
        ids = [l["id"] for l in ch["lines"]]
        md = [f"# {E.id} {cid} · {ch['title']}: build pack", "",
              f"Generated by `tools/new_episode.py` ({time.strftime('%Y-%m-%d %H:%M')}); regenerate with `tools/nx packs <ep>`. "
              "Read this, `docs/AGENT_WORKFLOW.md`, `docs/STYLE_GUIDE.md` and the episode's BUILD_BRIEF.md; nothing else broadly.", "",
              f"- Scene file: `engine/app/src/scenes/c{n}.ts` · dev server http://localhost:{port}",
              f"- qa: `tools/nx qa <ep> --chapter {cid} --url http://localhost:{port}` · sheet: `tools/nx sheet <ep> {cid} --url …`",
              f"- Window {ch['start']:.2f}–{ch['end']:.2f} s ({ch['end'] - ch['start']:.1f} s), {len(ids)} lines", "", "## Lines", ""]
        words = set()
        for l in ch["lines"]:
            sv = vis.get(l["id"], {})
            sh = l.get("short") or sv.get("short")
            short = f" · Short {sh.get('id', '?')} {sh.get('edge', '')}".rstrip() if sh else ""
            role = sv.get("voice") or E.cfg["voice"].get("default_role")
            md.append(f"### {l['id']} · {l['start']:.2f}–{l['end']:.2f} s{short}{f' · {role}' if role else ''}")
            md.append(f"> {l['text']}")
            if sv.get("cue_word"):
                md.append(f"- **Cue word:** `{sv['cue_word']}` (`this.q.w('{l['id']}', '{sv['cue_word']}')`)")
            if sv.get("typed"):
                typed = l["text"] if sv["typed"] is True else sv["typed"]
                md.append(f"- **Typed on screen:** «{typed}» (follows the voice: `this.q.typed('{l['id']}', t)`)")
            if sv.get("visual"):
                md.append(f"- **Visual:** {sv['visual']}")
                words |= {w.lower() for w in re.findall(r"[^\W\d_]{5,}", sv["visual"])}
            if l.get("refs"):
                md.append(f"- **Refs:** {', '.join(l['refs'])}")
            md.append("")
        rows = [r for r in fc if any(re.search(rf"\b{re.escape(i)}\b", r) for i in ids)]
        if rows:
            md += ["## Fact-check rows (on-screen numbers must match these)", ""] + rows + [""]
        qs = [(lid, k, q) for lid in ids for k, q in qbl.get(lid, [])]
        if qs:
            md += ["## Paper quotes (public/papers/**/quotes.json; the panel shows tr_short in a Short, else tr_panel, else tr)", ""]
            for lid, k, q in qs:
                md += [f"- **{k}/{q['id']}** ({lid}): \"{q.get('text', '')}\" → panel: \"{q.get('tr_panel') or q.get('tr', '')}\""
                       + (f" · Short: \"{q['tr_short']}\"" if q.get("tr_short") else "")]
            md.append("")
        used = sorted({r for l in ch["lines"] for r in l.get("refs", [])})
        if used:
            md += ["## Refs (citation lower-thirds, ≥ 24 px)", ""] + [f"- **{k}**: {refs.get(k, '(not in refs.json)')}" for k in used] + [""]
        if kits:
            def score(name):
                doc = kits[name][1].lower()
                return sum(1 for w in words if w in name.lower() or w in doc)
            pick = [k for k in CORE_KITS if k in kits] + [k for k in sorted(kits, key=score, reverse=True) if score(k) > 0 and k not in CORE_KITS][:12]
            md += ["## Kit pointers (from KIT_INDEX.md; open a file only at the line given, or `tools/nx kit <ep> show <name>`)", "",
                   "| name | at | doc | used in |", "|---|---|---|---|"]
            md += [f"| `{k}` | {kits[k][0]} | {kits[k][1][:110]} | {kits[k][2][:120]} |" for k in pick] + [""]
        E.p("packs", f"{cid}.md").write_text("\n".join(md) + "\n")
    say(f"4. packs: {', '.join(c['id'] for c in T['chapters'])} -> {E.dir.name}/packs/")


def build_brief(E, port):
    f = E.p("BUILD_BRIEF.md")
    tpl = HARNESS / "docs/templates/BUILD_BRIEF.md"
    if f.exists() or not tpl.exists():
        return
    title = E.cfg.get("title") or E.id
    f.write_text(tpl.read_text().replace("{{EPISODE}}", E.id).replace("{{TITLE}}", title).replace("{{PORT}}", str(port)))
    say("5. BUILD_BRIEF.md written from docs/templates/BUILD_BRIEF.md (fill in the episode notes)")


def start_dev(E, port):
    (E.engine / "work").mkdir(parents=True, exist_ok=True)
    log = open(E.engine / "work/vite.log", "a")
    p = subprocess.Popen(["bunx", "vite", "--port", str(port), "--strictPort"], cwd=E.app, stdout=log, stderr=log,
                         stdin=subprocess.DEVNULL, start_new_session=True)
    for _ in range(150):
        if not port_free(port):
            break
        time.sleep(0.2)
    (E.engine / ".devport").write_text(f"{port}\n")
    (E.engine / "work/vite.pid").write_text(f"{p.pid}\n")
    say(f"6. dev server http://localhost:{port} (pid {p.pid}, log engine/work/vite.log)")


def selftest(E, port):
    p = run(["bun", "scripts/qa.ts", "--chapter", "C0", "--url", f"http://localhost:{port}", "--budget", "300"], cwd=E.app, check=False, quiet=True)
    last = (p.stdout.strip().splitlines() or ["(no output)"])[-1]
    ok = last.startswith("TOTAL 0")
    say(f"7. selftest qa C0: {last}{'' if ok else '  <-- FAILED'}")
    if not ok:
        say(p.stdout[-2000:] + p.stderr[-1000:])
        sys.exit(1)


def main():
    a = sys.argv[1:]
    if not a or a[0].startswith("-"):
        sys.exit(__doc__)
    dest = pathlib.Path(a[0]).resolve()
    fake = "--fake-vo" in a
    if "--packs" in a or "--data" in a:
        E = Episode(dest)
        if "--packs" in a:
            kit_index(E)
            packs(E)
            return
        if data_steps(E, fake):
            kit_index(E)
            packs(E)
            dp = E.engine / ".devport"
            port = int(dp.read_text()) if dp.exists() else pick_port(None)
            if "--no-dev" not in a and port_free(port):
                start_dev(E, port)
            else:
                say(f"   dev server: http://localhost:{port}{'' if not port_free(port) else ' (not started: --no-dev)'}")
        return

    init = [sys.executable, HERE / "init_episode.py", dest]
    for k in ("--id", "--title", "--language", "--script"):
        if opt(a, k):
            init += [k, opt(a, k)]
    if "--force" in a:
        init.append("--force")
    run(init, quiet=True)
    E = Episode(dest)
    if opt(a, "--scenes"):
        src = pathlib.Path(opt(a, "--scenes"))
        for f in sorted(src.glob("*.ts")):
            shutil.copy2(f, E.app / "src/scenes" / f.name)
    say(f"1. episode {E.id} at {dest} (engine copied{', scenes from ' + opt(a, '--scenes') if opt(a, '--scenes') else ''})")
    have_data = data_steps(E, fake)
    if "--no-install" not in a:
        run(["bun", "install", "--frozen-lockfile"], cwd=E.app, quiet=True)
        say("3. bun install done")
    kit_index(E)
    port = pick_port(int(opt(a, "--port")) if opt(a, "--port") else None)
    (E.engine / ".devport").write_text(f"{port}\n")
    if have_data:
        packs(E)
    build_brief(E, port)
    if "--no-dev" not in a and have_data:
        start_dev(E, port)
        if "--selftest" in a:
            selftest(E, port)
    elif "--selftest" in a:
        say("7. selftest skipped (needs voice data and the dev server)")
    say(f"done: {E.id}, port {port}. Next: docs/AGENT_WORKFLOW.md, new-episode checklist.")


if __name__ == "__main__":
    main()
