#!/usr/bin/env bun
// Render one or more chapters to their clips, safely, with one summary line each.
//   bun scripts/render_chapter.ts C9 [C3 …] [--url http://localhost:<port>] [--samples 4] [--crf 18] [--budget 200]
//   bun scripts/render_chapter.ts --all-pending [--dry-run]   chapters whose inputs changed since their clip
//     [--jobs 2]  two chapters at once, one per render slot (lib.ts SLOT_LOCKS; each with its own memory gate; a
//                 second job starts 20 s after the first so its gate sees the first one's memory)
//     [--enc h264_vaapi|hevc_vaapi|x264|x264-fast|webcodecs] [--socks 2]  passed to encode.ts (one encoder per episode)
//     [--no-shorts]  don't make the Shorts in the chapter pass
// For each chapter:
//   window from data/chapters.json (C0 from 0; others from start − 0.4; each ends at the next start − 0.4, the
//   last at the audio end) → take the shared render lock and wait for free memory inside it (lib.ts acquireLock; per
//   chapter, so a queue does not starve other agents; bounded by --budget s, default 200, 0 = wait indefinitely: on
//   timeout exit 75 "lock busy (held by …), rerun later") → hash every input (lib.ts renderInputs: scene files, kits,
//   the assets they name, lyrics/chapters/audio data, timeline, caption chunks, narration audio) into
//   engine/work/renders/<CH>.inputs.json → encode.ts --quiet (HMR blocked, GPU checked, only the overlapping entries)
//   into engine/work/renders/ → check frames and duration against the window (±1 frame) → write the clip as a NEW
//   file renders/<EPID>_c<N>.mp4 by rename (never truncating in place) plus its receipt <clip>.receipt.json (the
//   input hashes taken at render START) → refresh every copy under episode.json render.review_dir that was a hard
//   link of the old clip (new hard link, renamed over it).
// Pending (--all-pending) = no clip, or any input whose sha256 differs from the clip's receipt (an input edited while
// the chapter rendered therefore leaves it pending), or a new/removed input; clips without a receipt (older tools)
// fall back to "an input is newer than the clip". One reason line per pending chapter.
// Shorts: when engine/work/shorts/plan.json (tools/make_shorts.py --plan; `nx render` writes it first) is newer than
// script.json, timing.json, episode.json and the caption chunks, every Short whose window starts in a chapter is made
// in that chapter's pass (encode.ts --shorts): shorts/<S>.mp4 with its receipt, no second render.
// A failed check leaves the old clip untouched; the new file stays in work/renders/ for inspection.
// After each clip: engine/work/renders/<CH>.grid.jpg (scripts/grid.ts: two tiles per line, mid and end), in the ok line.
// Sentinels for `nx wait-renders` (no pgrep, which matches its own command line): while it runs,
//   engine/work/renders/queue.running.<pid>.json; when it exits, engine/work/renders/queue.done.json
//   ({finished, ok, chapters: [{id, status, detail, grid}]}).
// Queue in the background and stop:
//   nohup bun scripts/render_chapter.ts --all-pending --budget 0 > ../work/renders/queue.log 2>&1 &
// then `tools/nx wait-renders <episode>` blocks until the queue is done and nothing is pending (exit 0).
import { copyFileSync, existsSync, linkSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import {
  APP, ENGINE, EP, EPID, BIG_TMP, GPU_ENV, LOCK_BUSY, LockBusy, REVIEW_DIR, acquireLock, argParser, budgetOf, chapterWindows, devServer,
  hashFiles, lockHeldByAncestor, probeVideo, readJSON, readReceipt, receiptFor, receiptPath, renderInputs, writeAtomic, type Win,
} from './lib';
import { makeGrid } from './grid';

const argv = process.argv.slice(2);
const { opt, flag } = argParser(argv);
const FPS = +opt('fps', '30')!;
const BUDGET = budgetOf(argv);
const wins = chapterWindows();
const RENDERS = path.join(ENGINE, 'renders');
const WORK = path.join(ENGINE, 'work/renders');
const clipOf = (w: Win) => path.join(RENDERS, `${EPID}_c${w.n}.mp4`);
/** "ANGLE (AMD, Vulkan 1.4 (AMD Radeon RX 7600M XT (RADV NAVI33) (0x…)), radv)" -> "AMD Radeon RX 7600M XT (RADV NAVI33)". */
const glShort = (r: string) => /Vulkan [\d.]+ \((.+?) \(0x[0-9a-f]+\)\)/i.exec(r)?.[1] ?? (r.slice(0, 48) || '?');
const short = (rels: string[]) => { const b = rels.map((r) => path.basename(r)); return b.length > 4 ? `${b.slice(0, 4).join(', ')} +${b.length - 4}` : b.join(', '); };

// ------------------------------------------------------------------ which chapters
/** '' if the clip is up to date with its inputs, else a one-line reason. */
function pending(w: Win): string {
  const clip = clipOf(w);
  if (!existsSync(clip)) return 'no clip';
  const files = renderInputs([w]);
  const rec = readReceipt(clip);
  if (!rec) {
    const ct = statSync(clip).mtimeMs;
    const newer = files.filter((f) => statSync(f).mtimeMs > ct);
    return newer.length ? `newer than the clip (no receipt): ${short(newer)}` : '';
  }
  const st = statSync(clip);
  if (rec.size !== st.size || (rec.info.ino !== st.ino && hashFiles([clip], RENDERS)[path.basename(clip)] !== rec.sha256)) return 'clip does not match its receipt';
  const now = hashFiles(files, RENDERS);
  const mid = new Set<string>(rec.info.changed_mid_render ?? []);
  const changed = Object.keys(now).filter((k) => k in rec.inputs && rec.inputs[k] !== now[k]);
  const added = Object.keys(now).filter((k) => !(k in rec.inputs));
  const removed = Object.keys(rec.inputs).filter((k) => !(k in now));
  const parts = [
    changed.some((k) => mid.has(k)) && `changed mid-render: ${short(changed.filter((k) => mid.has(k)))}`,
    changed.some((k) => !mid.has(k)) && `changed: ${short(changed.filter((k) => !mid.has(k)))}`,
    added.length && `new input: ${short(added)}`, removed.length && `input gone: ${short(removed)}`,
  ].filter(Boolean);
  return parts.join('; ');
}

let todo: Win[];
if (flag('all-pending')) {
  const reasons = new Map(wins.map((w) => [w.id, pending(w)]));
  todo = wins.filter((w) => reasons.get(w.id));
  for (const w of todo) console.log(`${w.id} pending: ${reasons.get(w.id)}`);
  if (flag('dry-run') || !todo.length) {
    if (!todo.length) console.log('nothing pending');
    process.exit(0);
  }
} else {
  const VALUED = ['--url', '--fps', '--samples', '--shutter', '--crf', '--preset', '--query', '--budget', '--enc', '--jobs', '--socks', '--bv', '--maxrate', '--qp'];
  const ids = argv.filter((a, i) => !a.startsWith('--') && !VALUED.includes(argv[i - 1] ?? ''))
    .map((a) => (/^\d+$/.test(a) ? `C${a}` : a.toUpperCase()));
  todo = ids.map((id) => wins.find((w) => w.id === id) ?? (console.error(`unknown chapter ${id} (have ${wins.map((w) => w.id).join(',')})`), process.exit(2)));
  if (!todo.length) { console.error('usage: render_chapter.ts C9 [C3 …] | --all-pending [--dry-run] [--budget s]'); process.exit(2); }
}

// ------------------------------------------------------------------ queue sentinels (tools/nx wait-renders)
const RUNNING = path.join(WORK, `queue.running.${process.pid}.json`);
const results: { id: string; status: 'ok' | 'FAILED'; detail: string; grid?: string }[] = [];
const T_START = new Date().toISOString();
function writeDone(ok: boolean) {
  writeAtomic(path.join(WORK, 'queue.done.json'), JSON.stringify({ started: T_START, finished: new Date().toISOString(), pid: process.pid, mode: flag('all-pending') ? 'all-pending' : 'chapters', ok, chapters: results }, null, 1) + '\n');
}
const cleanup = () => { try { unlinkSync(RUNNING); } catch { /* gone */ } };

// ------------------------------------------------------------------ render
mkdirSync(WORK, { recursive: true });
writeAtomic(RUNNING, JSON.stringify({ pid: process.pid, started: T_START, chapters: todo.map((w) => w.id) }) + '\n');
process.on('exit', cleanup);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(sig, () => { for (const w of todo) if (!results.some((r) => r.id === w.id)) results.push({ id: w.id, status: 'FAILED', detail: `interrupted (${sig})` }); writeDone(false); cleanup(); process.exit(130); });
mkdirSync(RENDERS, { recursive: true }); // (the atomic rename needs the folder; a new-episode checklist once deleted it)
const { url, stop } = await devServer(opt('url'));
const passthrough = ['samples', 'shutter', 'crf', 'preset', 'query', 'enc', 'socks', 'bv', 'maxrate', 'qp'].flatMap((k) => (opt(k) !== undefined ? [`--${k}`, opt(k)!] : []));

/** Review copies: files under REVIEW_DIR (episode.json render.review_dir) that are the same inode as the clip. */
function reviewLinks(clip: string): string[] {
  if (!existsSync(clip)) return [];
  const { ino, dev } = statSync(clip);
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.mp4')) { const s = statSync(p); if (s.ino === ino && s.dev === dev) out.push(p); }
    }
  };
  if (REVIEW_DIR && existsSync(REVIEW_DIR)) walk(REVIEW_DIR);
  return out;
}

/** Put `src` at `dst` atomically: hard link (or copy) to a temp name beside dst, then rename over it. */
function placeAt(src: string, dst: string) {
  mkdirSync(path.dirname(dst), { recursive: true });
  const tmp = path.join(path.dirname(dst), `.${path.basename(dst)}.${process.pid}.tmp`);
  try { linkSync(src, tmp); } catch { copyFileSync(src, tmp); }
  renameSync(tmp, dst);
}

// ------------------------------------------------------------------ Shorts plan
const PLAN = path.join(ENGINE, 'work/shorts/plan.json');
let planShorts: { id: string; t0: number; t1: number }[] = [];
if (!flag('no-shorts') && !opt('query') && existsSync(PLAN)) {
  const pt = statSync(PLAN).mtimeMs;
  const newer = [path.join(EP, 'script.json'), path.join(EP, 'timing.json'), path.join(EP, 'episode.json'), path.join(APP, 'src/captions_chunks.json')]
    .filter((f) => existsSync(f) && statSync(f).mtimeMs > pt);
  if (newer.length) console.log(`shorts: plan.json is older than ${short(newer)}: rendering without Shorts (rerun tools/make_shorts.py <ep> --plan, or nx render)`);
  else planShorts = readJSON(PLAN).shorts;
}
/** The Shorts a chapter makes: those whose window starts inside the chapter's window. */
const shortsOf = (w: Win) => planShorts.filter((s) => s.t0 >= w.from && s.t0 < w.to).map((s) => s.id);

let failed = 0;
// (a caller holding the lock for us means one render at a time)
const JOBS = process.env.HARNESS_LOCKED === '1' || lockHeldByAncestor() ? 1 : Math.max(1, Math.min(2, +(opt('jobs') ?? '1')));
const queue = [...todo], busy: string[] = [];
let busyMsg = '', lastStart = 0;

async function renderOne(w: Win) {
    const t0 = performance.now(), started = new Date().toISOString();
    const clip = clipOf(w);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const out = path.join(WORK, `${EPID}_c${w.n}.${stamp}.mp4`);
    let lock;
    try { lock = await acquireLock('render', BUDGET); } catch (e) {
      if (!(e instanceof LockBusy)) throw e;
      busy.push(w.id, ...queue.splice(0).map((x) => x.id));
      busyMsg = e.message;
      return;
    }
    lastStart = performance.now();
    // the inputs as they are when the render starts (a later edit makes the chapter pending again)
    const files = renderInputs([w]);
    const before = hashFiles(files, RENDERS);
    writeAtomic(path.join(WORK, `${w.id}.inputs.json`), JSON.stringify({ chapter: w.id, from: w.from, to: w.to, started, out: path.relative(RENDERS, out), base: '../../renders', inputs: before }, null, 1) + '\n');
    const sids = shortsOf(w);
    const enc = [process.execPath, path.join(APP, 'scripts/encode.ts'), '--url', url, '--from', String(w.from), '--to', String(w.to), '--fps', String(FPS), '--only', 'auto', '--out', out, '--quiet', ...passthrough,
      ...(sids.length ? ['--shorts', PLAN, '--short-ids', sids.join(',')] : [])];
    const p = Bun.spawn(enc, { cwd: APP, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, ...GPU_ENV, HARNESS_LOCKED: '1', TMPDIR: BIG_TMP } });
    const [so, se, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
    lock.release();
    const gl = /^gl: (.*)$/m.exec(se)?.[1] ?? '';
    const secs = ((performance.now() - t0) / 1000).toFixed(0);
    const speed = /, ([\d.]+) fps; enc (\S+)/.exec(so), shDone = /; shorts ([^()]*?) \(/.exec(so)?.[1];
    const extra = `${speed ? ` · ${speed[1]} fps ${speed[2]}${lock.slot !== undefined ? ` slot ${lock.slot}` : ''}` : ''}${sids.length ? ` · shorts ${shDone ?? `FAILED (${sids.join(',')}; see log)`}` : ''}`;
    const want = w.to - w.from, wantF = Math.round(w.to * FPS) - Math.round(w.from * FPS);
    if (code !== 0 || !existsSync(out)) {
      failed++;
      const log = out.replace(/\.mp4$/, '.log');
      await Bun.write(log, so + se);
      console.log(`${w.id} FAILED (encode exit ${code}${code === 3 ? ': software WebGL' : ''}) in ${secs}s; log ${path.relative(EP, log)}`);
      results.push({ id: w.id, status: 'FAILED', detail: `encode exit ${code}; log ${path.relative(EP, log)}` });
      return;
    }
    const { frames, dur } = await probeVideo(out);
    if (Math.abs(dur - want) > 1.01 / FPS || Math.abs(frames - wantF) > 1) {
      failed++;
      console.log(`${w.id} FAILED check: ${frames} frames / ${dur.toFixed(3)}s vs window ${wantF} / ${want.toFixed(3)}s (±1 frame); old clip kept; new file ${path.relative(EP, out)}`);
      results.push({ id: w.id, status: 'FAILED', detail: `${frames} frames / ${dur.toFixed(3)}s vs ${wantF} / ${want.toFixed(3)}s` });
      return;
    }
    const after = hashFiles(renderInputs([w]), RENDERS);
    const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => before[k] !== after[k]);
    const links = reviewLinks(clip);
    const rec = receiptFor(out, before, { chapter: w.id, from: w.from, to: w.to, fps: FPS, frames, duration: dur, started, gl, changed_mid_render: changed });
    placeAt(out, clip); // a new inode at renders/: old links keep the old file until refreshed below
    unlinkSync(out);
    const st = statSync(clip);
    rec.info.ino = st.ino; rec.info.mtime_ms = st.mtimeMs;
    writeAtomic(receiptPath(clip), JSON.stringify(rec, null, 1) + '\n');
    for (const r of links) placeAt(clip, r);
    const grid = makeGrid(w, clip);
    results.push({ id: w.id, status: 'ok', detail: `${frames} frames ${dur.toFixed(3)}s${changed.length ? '; STILL PENDING (changed mid-render)' : ''}`, ...(grid ? { grid: path.relative(EP, grid) } : {}) });
    const mb = (st.size / 1e6).toFixed(0);
    console.log(`${w.id} ok ${w.from.toFixed(3)}–${w.to.toFixed(3)} · ${frames} frames ${dur.toFixed(3)}s · ${mb} MB · ${secs}s${extra} · gl ${glShort(gl)} → ${path.relative(EP, clip)}`
      + `${links.length ? ` (review refreshed: ${links.map((r) => path.relative(EP, r)).join(', ')})` : ''}`
      + `${grid ? ` · grid ${path.relative(EP, grid)}` : ''}`
      + `${changed.length ? ` · STILL PENDING: inputs changed mid-render: ${short(changed)}` : ''}`);
}

try {
  // a pool of JOBS workers; the second starts only after the first has its slot, and 20 s apart (memory gate)
  const worker = async (k: number) => {
    while (queue.length) {
      while ((k > 0 && !lastStart) || (JOBS > 1 && lastStart && performance.now() - lastStart < 20000)) { if (!queue.length) return; await Bun.sleep(1000); }
      const w = queue.shift();
      if (!w) break;
      await renderOne(w);
    }
  };
  await Promise.all(Array.from({ length: Math.min(JOBS, todo.length) }, (_, k) => worker(k)));
  if (busy.length) {
    for (const id of busy) results.push({ id, status: 'FAILED', detail: `not rendered: ${busyMsg}` });
    console.log(`not rendered: ${busy.join(',')}: ${busyMsg}`); stop(); writeDone(false); cleanup(); process.exit(LOCK_BUSY);
  }
} finally {
  stop();
  writeDone(!failed && results.length === todo.length && results.every((r) => r.status === 'ok'));
  cleanup();
}
process.exit(failed ? 1 : 0);
