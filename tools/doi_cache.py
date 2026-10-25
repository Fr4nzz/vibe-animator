#!/usr/bin/env python3
"""Shared DOI cache + batch verifier. Check the cache first; verify only the misses, once.

  python3 tools/doi_cache.py check <file|DOI|text> … [--refresh] [--quiet] [--json] [--cache FILE]
      Extracts every DOI (files: md, json, py, txt; balanced parentheses are kept, so 10.1016/s0140-6736(17)32252-3
      survives), looks each one up in the cache, and verifies the misses in batches with
      `paper-search metadata-dois <dois> --source-timeout 30` (an external CLI; any tool that writes the same
      {"results": [{"doi", "metadata": {"title", "published_date", ...}}]} JSON works). A DOI is ok when at least one
      metadata source returns a title. New results are appended to the cache (under flock). One line per DOI unless
      --quiet, then the summary line:  N ok (C cached, M new) / K failed.  Exit 1 if any failed.
      --refresh re-verifies cached DOIs too.
  python3 tools/doi_cache.py seed <metadata.json …> [--dry-run]
      Adds DOIs from verification output already on disk (paper-search JSON with results[].metadata).
  python3 tools/doi_cache.py get <DOI>     print the cached record

Cache: --cache FILE, else $DOI_CACHE, else ./doi_cache.jsonl. Line: {"doi", "ok", "title", "year", "journal", "via",
"verified_at"}; the last line per DOI wins. DOIs are lower-cased. A failed lookup is cached as ok:false, so a retry
needs --refresh (it may have been a source timeout).
Rule for agents: read only the summary line, and never re-verify a DOI the cache marks ok. Never invent an identifier:
a DOI that fails stays out of the script, or the citation is given without it.
"""
import fcntl, json, os, pathlib, re, subprocess, sys, tempfile, time

BATCH = 25
_DOI_HEAD = re.compile(r"\b10\.\d{4,9}/")


def cache_path(args):
    if "--cache" in args:
        return pathlib.Path(args[args.index("--cache") + 1])
    return pathlib.Path(os.environ.get("DOI_CACHE", "doi_cache.jsonl"))


def extract(text):
    """DOIs in text, keeping balanced parentheses and dropping trailing punctuation."""
    out = []
    for m in _DOI_HEAD.finditer(text):
        i, depth = m.end(), 0
        while i < len(text):
            ch = text[i]
            if ch == "(":
                depth += 1
            elif ch == ")":
                if depth == 0:
                    break
                depth -= 1
            elif ch.isspace() or ch in "\"'<>[]{}|,;`":
                break
            i += 1
        d = text[m.start():i].rstrip(".:")
        while d.endswith(")") and d.count("(") < d.count(")"):
            d = d[:-1]
        if "/" in d and len(d.split("/", 1)[1]) > 1:
            out.append(d.lower())
    return out


def load(cache):
    rec = {}
    if cache.exists():
        for line in cache.read_text().splitlines():
            try:
                r = json.loads(line)
                rec[r["doi"]] = r
            except (ValueError, KeyError):
                pass
    return rec


def append(cache, rows):
    if not rows:
        return
    cache.parent.mkdir(parents=True, exist_ok=True)
    with open(cache, "a") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
        fcntl.flock(f, fcntl.LOCK_UN)


def from_metadata(r, via):
    """A cache row from one paper-search results[] entry."""
    md = r.get("metadata") or {}
    title = (md.get("title") or "").strip()
    year = (md.get("published_date") or "")[:4]
    journal = ""
    for rec in (md.get("records") or {}).values():
        ex = rec.get("extra") or ""
        m = re.search(r"'container_title': '([^']+)'", ex) if isinstance(ex, str) else None
        if m:
            journal = m.group(1)
            break
    return {"doi": (r.get("doi") or md.get("doi") or "").lower(), "ok": bool(title), "title": title, "year": year,
            "journal": journal, "via": via, "verified_at": time.strftime("%Y-%m-%d")}


def verify(dois):
    rows = []
    for k in range(0, len(dois), BATCH):
        chunk = dois[k:k + BATCH]
        with tempfile.NamedTemporaryFile("r", suffix=".json", delete=False) as tf:
            out = tf.name
        try:
            p = subprocess.run(["paper-search", "metadata-dois", *chunk, "--source-timeout", "30", "-o", out],
                               capture_output=True, text=True, timeout=60 + 40 * len(chunk))
            data = json.load(open(out)) if os.path.getsize(out) else json.loads(p.stdout or "{}")
        except FileNotFoundError:
            sys.exit("paper-search is not installed: verify these DOIs another way, or install it")
        except (subprocess.TimeoutExpired, ValueError, OSError) as e:
            print(f"paper-search batch failed ({type(e).__name__}); those DOIs count as failed", file=sys.stderr)
            data = {}
        finally:
            if os.path.exists(out):
                os.unlink(out)
        got = {}
        for r in data.get("results", []):
            row = from_metadata(r, "paper-search")
            if row["doi"]:
                got[row["doi"]] = row
        for d in chunk:
            rows.append(got.get(d) or {"doi": d, "ok": False, "title": "", "year": "", "journal": "", "via": "paper-search",
                                       "verified_at": time.strftime("%Y-%m-%d")})
    return rows


def positional(args):
    out, skip = [], False
    for a in args:
        if skip:
            skip = False
        elif a == "--cache":
            skip = True
        elif not a.startswith("--"):
            out.append(a)
    return out


def cmd_check(args):
    cache = cache_path(args)
    refresh, quiet, as_json = "--refresh" in args, "--quiet" in args, "--json" in args
    dois = []
    for a in positional(args):
        text = pathlib.Path(a).read_text(errors="replace") if os.path.isfile(a) else a
        dois += extract(text)
    dois = list(dict.fromkeys(dois))
    known = load(cache)
    hit = [d for d in dois if d in known and not refresh]
    miss = [d for d in dois if d not in hit]
    new = verify(miss) if miss else []
    append(cache, new)
    res = {**{d: dict(known[d], cached=True) for d in hit}, **{r["doi"]: dict(r, cached=False) for r in new}}
    rows = [res[d] for d in dois]
    if as_json:
        print(json.dumps(rows, ensure_ascii=False, indent=1))
    elif not quiet:
        for r in rows:
            tag = "ok    " if r["ok"] else "FAILED"
            print(f"{tag} {'cached' if r['cached'] else 'new   '} {r['doi']}  {r.get('year', '')} {r.get('title', '')[:70]}")
    ok = [r for r in rows if r["ok"]]
    bad = [r for r in rows if not r["ok"]]
    print(f"{len(ok)} ok ({sum(r['cached'] for r in ok)} cached, {sum(not r['cached'] for r in ok)} new) / {len(bad)} failed"
          + (": " + ", ".join(r["doi"] for r in bad[:10]) + (" …" if len(bad) > 10 else "") if bad else ""))
    return 1 if bad else 0


def cmd_seed(args):
    cache = cache_path(args)
    dry = "--dry-run" in args
    known = load(cache)
    rows = {}
    for f in positional(args):
        try:
            data = json.load(open(f))
        except (ValueError, OSError, UnicodeDecodeError):
            continue
        if not isinstance(data, dict) or not isinstance(data.get("results"), list):
            continue
        for r in data["results"]:
            if not isinstance(r, dict) or "metadata" not in r:
                continue
            row = from_metadata(r, f"seed:{os.path.basename(f)}")
            if row["doi"] and row["ok"] and (row["doi"] not in rows or not rows[row["doi"]]["ok"]):
                rows[row["doi"]] = row
    add = [r for d, r in rows.items() if d not in known or (not known[d].get("ok") and r["ok"])]
    print(f"seed: {len(rows)} DOIs found; {len(add)} new to the cache ({len(known)} already there){' (dry run)' if dry else ''}")
    if not dry:
        append(cache, add)
    return 0


def main():
    a = sys.argv[1:]
    if not a or a[0] not in ("check", "seed", "get"):
        sys.exit(__doc__)
    if a[0] == "check":
        sys.exit(cmd_check(a[1:]))
    if a[0] == "seed":
        sys.exit(cmd_seed(a[1:]))
    p = positional(a[1:])
    r = load(cache_path(a)).get(p[0].lower()) if p else None
    print(json.dumps(r, ensure_ascii=False, indent=1) if r else "not cached")
    sys.exit(0 if r else 1)


if __name__ == "__main__":
    main()
