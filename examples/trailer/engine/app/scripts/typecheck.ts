#!/usr/bin/env bun
// Fast type check of just some scene files (and what they import), with compact output: one line per error.
//   bun scripts/typecheck.ts [file.ts …]       paths, or bare names in src/scenes ("c3", "c3.ts", "kit_c3")
//   bun scripts/typecheck.ts --chapter C3[,C4] the chapters' scene files and kits (lib.ts sceneFiles)
//   [--changed]  skip when none of those files changed since the last clean check (stamp: engine/work/typecheck/)
//   [--max 15]   error lines printed (the rest are counted)
// No file and no chapter: every file in src/scenes. Exit 0 clean, 1 type errors. Uses the app tsconfig (a generated
// config in engine/work/typecheck/ extends it with only these files), so a check takes well under a second.
// qa.ts runs it first (--changed) on the scene files of the chapters it checks; the full-project check is
// `tools/nx typecheck <ep>`.
import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { APP, ENGINE, chapterWindows, hashFiles, readJSON, sceneFiles, writeAtomic } from './lib';

const SCENES = path.join(APP, 'src/scenes');
const DIR = path.join(ENGINE, 'work/typecheck');
const STAMP = path.join(DIR, 'passed.json');

/** Resolve a file argument: a path, or a bare name in src/scenes. */
export function sceneArg(a: string): string {
  for (const c of [path.resolve(a), path.join(SCENES, a), path.join(SCENES, `${a}.ts`)]) if (existsSync(c)) return c;
  throw new Error(`no such scene file: ${a}`);
}

export interface TypecheckResult { ok: boolean; skipped: boolean; files: number; errors: string[]; ms: number }

/**
 * Type-check `files` (absolute .ts paths) with the app's compiler options. `changed`: skip (ok, skipped) when every
 * file has the hash it had at the last clean check. Errors come back as "src/scenes/c3.ts:12:5 TS2322 message".
 */
export async function typecheckFiles(files: string[], changed = false): Promise<TypecheckResult> {
  const t0 = performance.now();
  files = [...new Set(files.filter((f) => f.endsWith('.ts')))].sort();
  if (!files.length) return { ok: true, skipped: true, files: 0, errors: [], ms: 0 };
  const hashes = hashFiles(files, APP);
  const passed: Record<string, string> = existsSync(STAMP) ? readJSON(STAMP) : {};
  if (changed && Object.entries(hashes).every(([k, v]) => passed[k] === v)) return { ok: true, skipped: true, files: files.length, errors: [], ms: 0 };
  const cfg = path.join(DIR, `tsconfig.${process.pid}.json`);
  // (typeRoots: the config lives outside the app, where "types": ["vite/client"] would not resolve)
  const nm = path.join(APP, 'node_modules');
  writeAtomic(cfg, JSON.stringify({ extends: path.join(APP, 'tsconfig.json'), compilerOptions: { typeRoots: [path.join(nm, '@types'), nm] }, files, include: [] }));
  const tsc = path.join(APP, 'node_modules/.bin/tsc');
  const p = Bun.spawn([existsSync(tsc) ? tsc : 'tsc', '--noEmit', '--pretty', 'false', '-p', cfg], { cwd: APP, stdout: 'pipe', stderr: 'pipe' });
  const [so, se, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  rmSync(cfg, { force: true });
  const errors: string[] = [];
  for (const l of (so + se).split('\n')) {
    const m = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(l.trim());
    if (m) errors.push(`${path.relative(APP, path.resolve(APP, m[1]!))}:${m[2]}:${m[3]} ${m[4]} ${m[5]!.length > 140 ? m[5]!.slice(0, 139) + '…' : m[5]}`);
    else if (/error/i.test(l) && !errors.length && code !== 0 && l.trim()) errors.push(l.trim().slice(0, 160));
  }
  const ok = code === 0 && !errors.length;
  if (ok) writeAtomic(STAMP, JSON.stringify({ ...passed, ...hashes }, null, 1) + '\n');
  return { ok, skipped: false, files: files.length, errors, ms: performance.now() - t0 };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const val = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const VALUED = ['--chapter', '--max'];
  const args = argv.filter((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1] ?? ''));
  let files: string[];
  try {
    files = args.map(sceneArg);
    const chs = val('chapter')?.split(',').filter(Boolean).map((c) => c.toUpperCase());
    if (chs) files.push(...chapterWindows().filter((w) => chs.includes(w.id)).flatMap(sceneFiles));
    if (!args.length && !chs) files = readdirSync(SCENES).filter((f) => f.endsWith('.ts')).map((f) => path.join(SCENES, f));
  } catch (e) { console.log(String((e as Error).message)); process.exit(2); }
  const r = await typecheckFiles(files, argv.includes('--changed'));
  const max = +(val('max') ?? 15);
  for (const e of r.errors.slice(0, max)) console.log(e);
  if (r.errors.length > max) console.log(`… ${r.errors.length - max} more`);
  console.log(r.skipped ? `typecheck skipped (${r.files} files unchanged since the last clean check)` : r.ok ? `typecheck ok (${r.files} files, ${(r.ms / 1000).toFixed(1)}s)` : `typecheck: ${r.errors.length} error${r.errors.length === 1 ? '' : 's'} (${r.files} files)`);
  process.exit(r.ok ? 0 : 1);
}
