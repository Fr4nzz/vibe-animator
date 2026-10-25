// Shared helpers for the agent-facing scripts (qa.ts, render_chapter.ts, encode.ts, render.ts).
// Every path is derived from this file's location, so the scripts work in any episode's engine copy:
//   <episode>/engine/app/scripts/lib.ts
// Machine settings (render lock, GPU env, browser, memory floor, dev-server ports) come from, in order:
// environment variables, then the "render" block of <episode>/episode.json, then the defaults below.
import { chromium, type Browser, type Page } from 'playwright-core';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export const APP = path.resolve(import.meta.dir, '..');
export const ENGINE = path.resolve(APP, '..');
export const EP = path.resolve(ENGINE, '..');

export const readJSON = <T = any>(p: string): T => JSON.parse(readFileSync(p, 'utf8'));

/** <episode>/episode.json (empty object when this engine copy is not inside an episode). */
export const EPISODE: Record<string, any> = existsSync(path.join(EP, 'episode.json')) ? readJSON(path.join(EP, 'episode.json')) : {};
const RCFG: Record<string, any> = EPISODE.render ?? {};
/** Episode id (clips are engine/renders/<EPID>_c<N>.mp4): episode.json "id", else the episode folder name. */
export const EPID: string = EPISODE.id ?? path.basename(EP);
/** Shared render lock (slot 0): every headless browser on the machine that is not a chapter render runs under it. */
export const LOCK: string = process.env.HARNESS_RENDER_LOCK ?? RCFG.lock ?? '/tmp/vibe-animator-render.lock';
/**
 * Render slots: LOCK and LOCK.2 (render.slots, default 2; env HARNESS_RENDER_SLOTS). A render takes the first free
 * one (non-blocking flock each), then its own MemAvailable >= MIN_FREE_GB gate inside it, so two chapter renders can
 * run side by side (measured on a 14 GB machine: about 1.6 GB for both). QA, stills and every other browser stay on
 * slot 0 (LOCK), which older tools also take.
 */
export const SLOT_LOCKS: string[] = [LOCK, `${LOCK}.2`].slice(0, Math.max(1, Math.min(2, +(process.env.HARNESS_RENDER_SLOTS ?? RCFG.slots ?? 2))));
/** Free memory (GB, MemAvailable) required before a headless browser starts. */
export const MIN_FREE_GB: number = +(process.env.HARNESS_MIN_FREE_GB ?? RCFG.min_free_gb ?? 3);
/** Big temporary files (never /tmp, which may be RAM-backed). */
export const BIG_TMP: string = process.env.HARNESS_TMPDIR ?? RCFG.tmpdir ?? '/var/tmp';
/** Port range [lo, hi) for private dev servers started by the scripts. */
export const PORT_RANGE: [number, number] = (process.env.HARNESS_PORTS?.split('-').map(Number) as [number, number]) ?? RCFG.private_ports ?? [5600, 5900];
/** Optional folder (relative to the episode) whose .mp4 files may be hard links of clips; refreshed on re-render. */
export const REVIEW_DIR: string | null = RCFG.review_dir ? path.resolve(EP, RCFG.review_dir) : null;

export interface Chapter { id: string; title: string; start: number; end: number }
export interface Win { id: string; n: string; from: number; to: number }

/** Audio duration (s), from the engine's audio analysis. */
export const audioDuration = (): number => readJSON(path.join(ENGINE, 'data/audio.json')).duration;

/**
 * Chapter render windows, the same rule as the timeline: C0 starts at 0, every other chapter 0.4 s before
 * its first word; each ends where the next starts (its start − 0.4); the last ends at the audio's end.
 */
export function chapterWindows(): Win[] {
  const ch = readJSON<Chapter[]>(path.join(ENGINE, 'data/chapters.json'));
  const dur = audioDuration();
  return ch.map((c, i) => ({
    id: c.id, n: c.id.replace(/^C/i, '').toLowerCase(),
    from: i === 0 ? 0 : +(c.start - 0.4).toFixed(3),
    to: i + 1 < ch.length ? +(ch[i + 1]!.start - 0.4).toFixed(3) : dur,
  }));
}

export interface Line { id: string; text: string; start: number; end: number; words: { w: string; start: number; end: number }[] }
export const lyricsLines = (): Line[] => readJSON(path.join(ENGINE, 'data/lyrics.json')).lines;
/** Chapter id of a line id ("C3-L8" -> "C3"). */
export const chapterOf = (lineId: string) => lineId.split('-')[0]!;

/** Line ids inside each Short unit (from <episode>/timing.json, else script.json): id -> short id. */
export function shortLines(): Map<string, string> {
  const src = [path.join(EP, 'timing.json'), path.join(EP, 'script.json')].find(existsSync);
  const out = new Map<string, string>();
  if (!src) return out;
  for (const c of readJSON(src).chapters ?? []) {
    let open: string | null = null;
    for (const l of c.lines ?? []) {
      const s = l.short;
      if (s && (s.edge === 'start' || !s.edge)) open = s.id;
      if (open) out.set(l.id, open);
      if (s && (s.edge === 'end' || !s.edge)) open = null;
    }
  }
  return out;
}

/** GB of memory available (MemAvailable). */
export function memAvailGB() {
  const m = /MemAvailable:\s+(\d+)/.exec(readFileSync('/proc/meminfo', 'utf8'));
  return m ? +m[1]! / 1048576 : 0;
}
export async function waitForMemory(gb = MIN_FREE_GB, quiet = false) {
  let said = false;
  while (memAvailGB() < gb) {
    if (!said && !quiet) { console.error(`waiting for ${gb} GB free memory (have ${memAvailGB().toFixed(1)})`); said = true; }
    await Bun.sleep(15000);
  }
}

/** True if an ancestor process is `flock <LOCK> …` (re-taking it would deadlock). */
export function lockHeldByAncestor() {
  let pid = process.ppid;
  for (let i = 0; i < 12 && pid > 1; i++) {
    try {
      const cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
      if (path.basename(cmd[0] ?? '') === 'flock' && cmd.some((a) => SLOT_LOCKS.includes(a))) return true;
      pid = +(/^PPid:\s+(\d+)/m.exec(readFileSync(`/proc/${pid}/status`, 'utf8'))?.[1] ?? 0);
    } catch { return false; }
  }
  return false;
}

// ------------------------------------------------------------------ locks (T7)
// Two flock(2) files: LOCK (exclusive: one render at a time; the same file and lock type as `flock LOCK …`, so
// older tools on the machine still interoperate) and LOCK.qa (one QA/stills browser at a time). A QA run takes
// LOCK too when it is free (renders then wait a minute behind it); when a render holds LOCK, QA runs beside it only
// if MemAvailable >= QA_MIN_FREE_GB. Every wait is bounded by a budget (--budget s, default 200): past it the tool
// exits LOCK_BUSY (75) with "lock busy (held by <pid cmd>), rerun later". --budget 0 waits indefinitely (queues).

/** Exit code for "lock or memory not available within the budget": rerun later. (EX_TEMPFAIL) */
export const LOCK_BUSY = 75;
/** QA/stills lock beside the render lock. */
export const QA_LOCK = `${LOCK}.qa`;
/** Free memory (GB) required to run a QA/stills browser beside a running render. */
export const QA_MIN_FREE_GB: number = +(process.env.HARNESS_QA_MIN_FREE_GB ?? RCFG.qa_min_free_gb ?? MIN_FREE_GB);
/** --budget <s> from argv (default $HARNESS_BUDGET, else 200; 0 = wait indefinitely). */
export const budgetOf = (argv: string[]) => { const i = argv.indexOf('--budget'); return +(i >= 0 ? argv[i + 1]! : process.env.HARNESS_BUDGET ?? 200); };

export class LockBusy extends Error {}
export interface LockHandle { release(): void; mode: 'render' | 'qa'; beside?: string; /** render slot taken (index in SLOT_LOCKS) */ slot?: number }

type FlockFn = (fd: number, op: number) => number;
let flockFn: FlockFn | null | undefined;
function libcFlock(): FlockFn | null {
  if (flockFn !== undefined) return flockFn;
  try {
    const { dlopen, FFIType } = require('bun:ffi');
    const lib = dlopen(process.platform === 'darwin' ? 'libc.dylib' : 'libc.so.6', { flock: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 } });
    flockFn = lib.symbols.flock as FlockFn;
  } catch { flockFn = null; }
  return flockFn;
}
const LOCK_EX = 2, LOCK_NB = 4, LOCK_UN = 8;
function openLock(file: string) {
  mkdirSync(path.dirname(file), { recursive: true });
  try { return openSync(file, 'a'); } catch { return openSync(file, 'r'); }
}
/** fd holding an exclusive flock on `file`, or null if another process holds it (blocking: wait for it). */
function tryFlock(file: string, blocking = false): number | null {
  const fd = openLock(file);
  if (libcFlock()!(fd, LOCK_EX | (blocking ? 0 : LOCK_NB)) === 0) return fd;
  closeSync(fd);
  return null;
}
function unflock(fd: number) { try { libcFlock()!(fd, LOCK_UN); closeSync(fd); } catch {} }

/** "pid 123 bun scripts/render_chapter.ts C3" for the process holding a flock on `file` (from /proc/locks). */
export function lockHolder(file = LOCK): string {
  try {
    const ino = statSync(file).ino;
    for (const l of readFileSync('/proc/locks', 'utf8').split('\n')) {
      const m = /^\d+:\s+FLOCK\s+\S+\s+\S+\s+(\d+)\s+[0-9a-f]+:[0-9a-f]+:(\d+)\s/.exec(l);
      if (!m || +m[2]! !== ino) continue;
      let cmd = '';
      try { cmd = readFileSync(`/proc/${m[1]}/cmdline`, 'utf8').split('\0').filter(Boolean).map((a) => path.basename(a)).join(' '); } catch {}
      return `pid ${m[1]}${cmd ? ' ' + (cmd.length > 70 ? cmd.slice(0, 69) + '…' : cmd) : ''}`;
    }
  } catch {}
  return 'unknown process';
}

/**
 * Take the shared lock for this process (released at exit, or by release()). mode 'render': LOCK exclusively, then
 * MemAvailable >= minGB inside it. mode 'qa': LOCK.qa, then LOCK if free (and MIN_FREE_GB), else beside a running
 * render if MemAvailable >= QA_MIN_FREE_GB. Throws LockBusy when the budget (s; 0 = none) runs out. A no-op when a
 * parent already holds the lock (HARNESS_LOCKED=1, or a `flock LOCK` ancestor).
 */
export async function acquireLock(mode: 'render' | 'qa', budget = 200, minGB = MIN_FREE_GB): Promise<LockHandle> {
  const none: LockHandle = { mode, release() {} };
  if (process.env.HARNESS_LOCKED === '1' || lockHeldByAncestor()) return none;
  if (!libcFlock()) throw new Error('flock(2) unavailable through bun:ffi: use ensureLocked() (re-exec under the flock CLI)');
  const deadline = budget > 0 ? Date.now() + budget * 1000 : Infinity;
  const busy = (what: string) => new LockBusy(what);
  let said = '';
  const note = (m: string) => { const k = m.replace(/[\d.]+/g, '#'); if (k !== said) { console.error(m); said = k; } };
  const held: number[] = [];
  const releaseAll = () => { for (const fd of held.splice(0)) unflock(fd); };
  try {
    if (mode === 'qa') {
      for (;;) {
        const fd = tryFlock(QA_LOCK);
        if (fd !== null) { held.push(fd); break; }
        if (Date.now() > deadline) throw busy(`lock busy (QA lock held by ${lockHolder(QA_LOCK)}), rerun later`);
        note(`waiting for the QA lock (held by ${lockHolder(QA_LOCK)})`);
        await Bun.sleep(500);
      }
    }
    // render: the first free slot (each non-blocking, each with its own memory gate); qa: slot 0 only
    const slots = mode === 'render' ? SLOT_LOCKS : [LOCK];
    let slot = -1;
    for (;;) {
      let fd: number | null = null;
      for (let k = 0; k < slots.length && fd === null; k++) { fd = tryFlock(slots[k]!); if (fd !== null) slot = k; }
      if (fd !== null) {
        if (memAvailGB() >= minGB) { held.push(fd); break; }
        unflock(fd); // (memory is short: don't hold a render slot while waiting for it)
        if (Date.now() > deadline) throw busy(`memory low (${memAvailGB().toFixed(1)} GB free, need ${minGB}), rerun later`);
        note(`waiting for ${minGB} GB free memory (have ${memAvailGB().toFixed(1)})`);
      } else if (mode === 'qa' && memAvailGB() >= QA_MIN_FREE_GB) {
        const h = lockHolder(LOCK);
        console.error(`render lock held by ${h}: running beside it (${memAvailGB().toFixed(1)} GB free)`);
        return { mode, beside: h, release: releaseAll };
      } else {
        const who = slots.map((f) => lockHolder(f)).join('; ');
        if (Date.now() > deadline) throw busy(`lock busy (held by ${who}), rerun later`);
        note(`waiting for ${slots.length > 1 ? 'a render slot' : 'the render lock'} (held by ${who})`);
      }
      await Bun.sleep(mode === 'qa' ? 1000 : 2000);
    }
    return { mode, slot: mode === 'render' ? slot : undefined, release: releaseAll };
  } catch (e) { releaseAll(); throw e; }
}

/**
 * Make sure this script runs holding the shared lock (see acquireLock), bounded by --budget (default 200 s): on
 * timeout print "lock busy (held by …), rerun later" and exit 75. Without bun:ffi it falls back to re-running itself
 * under `flock -w <budget> -E 75` (same args; never returns in the parent).
 */
export async function ensureLocked(mode: 'render' | 'qa' = 'render', budget = budgetOf(process.argv), minGB = MIN_FREE_GB): Promise<LockHandle> {
  if (process.env.HARNESS_LOCKED === '1' || lockHeldByAncestor()) return { mode, release() {} };
  if (libcFlock()) {
    try { return await acquireLock(mode, budget, minGB); } catch (e) {
      if (e instanceof LockBusy) { console.log(e.message); process.exit(LOCK_BUSY); }
      throw e;
    }
  }
  const p = Bun.spawn(lockedCmd([process.execPath, ...process.argv.slice(1)], minGB, budget),
    { stdio: ['inherit', 'inherit', 'inherit'], env: { ...process.env, HARNESS_LOCKED: '1', TMPDIR: process.env.TMPDIR ?? BIG_TMP } });
  const code = await p.exited;
  if (code === LOCK_BUSY) console.log(`lock busy (held by ${lockHolder(LOCK)}), rerun later`);
  process.exit(code);
}

/** `cmd` wrapped as: flock LOCK (bounded by budget s; 0 = none; exit 75 on timeout) → wait (inside the lock) until
 * minGB are free → exec cmd. */
export function lockedCmd(cmd: string[], minGB = MIN_FREE_GB, budget = 0): string[] {
  return ['flock', ...(budget > 0 ? ['-w', String(budget), '-E', String(LOCK_BUSY)] : []), LOCK, 'bash', '-c',
    `while [ "$(awk '/MemAvailable/{print int($2/1048576)}' /proc/meminfo)" -lt ${Math.ceil(minGB)} ]; do sleep 15; done; exec "$@"`, '_', ...cmd];
}

export async function reachable(url: string) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.ok; } catch { return false; }
}

/** The dev server at `url` (or $HARNESS_URL); when unreachable/omitted, a private one without HMR. */
export async function devServer(url?: string): Promise<{ url: string; stop: () => void }> {
  const u0 = url ?? process.env.HARNESS_URL;
  if (u0 && (await reachable(u0))) return { url: u0, stop: () => {} };
  if (u0) console.error(`${u0} unreachable: starting a private dev server`);
  const port = PORT_RANGE[0] + Math.floor(Math.random() * (PORT_RANGE[1] - PORT_RANGE[0]));
  // run vite itself (not through bunx, whose child would survive a kill of the wrapper)
  const vite = path.join(APP, 'node_modules/.bin/vite');
  const proc = Bun.spawn(existsSync(vite) ? [vite, '--port', String(port), '--strictPort'] : ['bunx', 'vite', '--port', String(port), '--strictPort'],
    { cwd: APP, stdout: 'ignore', stderr: 'ignore', env: { ...process.env, PDOOM_NO_HMR: '1' } });
  const u = `http://localhost:${port}`;
  process.on('exit', () => proc.kill()); // never leave a private server behind, even on an error exit
  for (let i = 0; i < 200 && !(await reachable(u)); i++) await Bun.sleep(100);
  if (!(await reachable(u))) { proc.kill(); throw new Error(`private dev server did not start on ${u}`); }
  return { url: u, stop: () => proc.kill() };
}

/** ANGLE backend flags: $ANGLE_ARGS, else episode.json render.angle_args, else Vulkan. ("--use-angle=gl" in headless
 * Chromium may fall back to SwiftShader, i.e. the CPU: correct but several times slower.) */
const ANGLE: string = process.env.ANGLE_ARGS ?? RCFG.angle_args ?? '--use-angle=vulkan --enable-features=Vulkan';
export const CHROME_ARGS = [
  ...ANGLE.split(' ').filter(Boolean),
  '--no-sandbox', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
];

/**
 * GPU environment for the browser (and every child that renders): episode.json render.gpu_env, default
 * {"DRI_PRIME": "1"}; a variable already set in the environment wins. On a hybrid-GPU Linux laptop DRI_PRIME=1 puts
 * Vulkan on the discrete/external GPU; without it headless Chromium may pick the iGPU and frames can come out
 * tile-garbled. Set "gpu_env": {} on machines with one GPU.
 */
export const GPU_ENV: Record<string, string> = Object.fromEntries(
  Object.entries<string>(RCFG.gpu_env ?? { DRI_PRIME: '1' }).map(([k, v]) => [k, process.env[k] ?? String(v)]));
export const CHROME_ENV = { ...process.env, ...GPU_ENV } as Record<string, string>;

// ------------------------------------------------------------------ encoders
/**
 * VAAPI render node for hardware encode: $HARNESS_VAAPI_DEVICE, else render.vaapi_device (a /dev/dri path; prefer
 * the stable /dev/dri/by-path/pci-…-render name, since renderD numbers can change), else "auto": the first
 * /dev/dri/by-path/*-render node, sorted (on a hybrid machine set it explicitly to the GPU that should encode).
 */
export function vaapiDevice(): string | null {
  let d: string | undefined = process.env.HARNESS_VAAPI_DEVICE ?? RCFG.vaapi_device ?? 'auto';
  if (d === 'auto') {
    const bp = '/dev/dri/by-path';
    d = existsSync(bp) ? readdirSync(bp).filter((f) => f.endsWith('-render')).sort().map((f) => path.join(bp, f))[0] : undefined;
  }
  try { return d ? realpathSync(d) : null; } catch { return null; }
}
const vaapiOk = new Map<string, boolean>();
/** True if ffmpeg can open `dev` and encode a few frames with `codec` (h264_vaapi / hevc_vaapi). */
export async function vaapiWorks(codec: string, dev: string | null = vaapiDevice()): Promise<boolean> {
  if (!dev) return false;
  const k = `${codec}@${dev}`;
  if (vaapiOk.has(k)) return vaapiOk.get(k)!;
  const p = Bun.spawn(['ffmpeg', '-v', 'error', '-vaapi_device', dev, '-f', 'lavfi', '-i', 'color=c=gray:s=256x144:r=30:d=0.2', '-vf', 'format=nv12,hwupload', '-c:v', codec, '-f', 'null', '-'], { stdout: 'ignore', stderr: 'pipe' });
  const ok = (await p.exited) === 0;
  vaapiOk.set(k, ok);
  return ok;
}
export type Enc = 'h264_vaapi' | 'hevc_vaapi' | 'x264' | 'x264-fast' | 'webcodecs';
export const ENCODERS: Enc[] = ['h264_vaapi', 'hevc_vaapi', 'x264', 'x264-fast', 'webcodecs'];
/**
 * Encoder: --enc, else $HARNESS_ENC, else render.encoder, default h264_vaapi (VBR render.video_bitrate, 10M, max
 * 17M): H.264 High plays on YouTube, TVs and Chrome on Linux (HEVC there needs hardware decode), and clips with the
 * same settings join by stream copy (assemble.py). >= 24 Mbit/s keeps fine film grain (at ~9 it smears).
 */
export const DEFAULT_ENC: Enc = (process.env.HARNESS_ENC ?? RCFG.encoder ?? 'h264_vaapi') as Enc;
export const VIDEO_BITRATE: string = RCFG.video_bitrate ?? '10M';
/** The encoder actually used for `want`: a VAAPI codec falls back to x264-fast (noted on stderr) if it cannot encode. */
export async function resolveEnc(want: Enc): Promise<Enc> {
  if (!ENCODERS.includes(want)) throw new Error(`--enc ${want}: use ${ENCODERS.join('|')}`);
  if (want.endsWith('_vaapi') && !(await vaapiWorks(want))) {
    console.error(`${want} unavailable (VAAPI device ${vaapiDevice() ?? 'none'}): falling back to x264-fast`);
    return 'x264-fast';
  }
  return want;
}
const TAGS = 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv';
const COLOR_OUT = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv'];
export interface EncSettings { bv?: string; maxrate?: string; qp?: string; crf?: string; preset?: string; gop?: number }
/**
 * ffmpeg args to encode raw frames (`inPix`: yuv420p = the page's GPU-packed I420, rgb24 = the old bottom-up path):
 * pre (global, before the inputs), filter (the -vf chain), hwTail (appended to a -filter_complex output for VAAPI),
 * codec (-c:v …, 2 s GOP, BT.709 tags).
 */
export function encoderArgs(enc: Enc, inPix: 'yuv420p' | 'rgb24', s: EncSettings = {}) {
  const base = inPix === 'yuv420p' ? TAGS : `vflip,scale=out_color_matrix=bt709,${TAGS}`;
  const gop = ['-g', String(s.gop ?? 60)];
  if (enc === 'h264_vaapi' || enc === 'hevc_vaapi') {
    const rc = enc === 'h264_vaapi'
      ? ['-profile:v', 'high', '-rc_mode', 'VBR', '-b:v', s.bv ?? VIDEO_BITRATE, '-maxrate', s.maxrate ?? '17M']
      : ['-profile:v', 'main', '-rc_mode', 'CQP', '-qp', s.qp ?? '16'];
    return { pre: ['-vaapi_device', vaapiDevice()!], filter: `${base},format=nv12,hwupload`, hwTail: 'format=nv12,hwupload', codec: ['-c:v', enc, ...rc, ...gop, ...COLOR_OUT] };
  }
  if (enc === 'x264' || enc === 'x264-fast') {
    const preset = s.preset ?? (enc === 'x264-fast' ? 'fast' : 'medium');
    return { pre: [], filter: base, hwTail: '', codec: ['-c:v', 'libx264', '-preset', preset, '-crf', s.crf ?? '18', '-pix_fmt', 'yuv420p', '-tune', 'grain', '-x264-params', 'aq-mode=3', ...gop, ...COLOR_OUT] };
  }
  throw new Error(`encoderArgs: ${enc} is encoded in the page`);
}

/** Chromium binary: $CHROME_PATH, episode.json render.chrome_path, a system Chromium/Chrome, else Playwright's download. */
export function chromePath(): string {
  const cands = [process.env.CHROME_PATH, RCFG.chrome_path, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
  for (const c of cands) if (c && existsSync(c)) return c;
  const pw = path.join(homedir(), '.cache/ms-playwright');
  if (existsSync(pw)) {
    for (const d of readdirSync(pw).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse())
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium'])
        if (existsSync(path.join(pw, d, sub))) return path.join(pw, d, sub);
  }
  throw new Error('no Chromium found: set CHROME_PATH or render.chrome_path in episode.json (or `bunx playwright install chromium`)');
}

/** Unmasked WebGL renderer of the last launch() (for summary lines), e.g. "ANGLE (AMD, Vulkan 1.3 (… RADV …))". */
export let GL_RENDERER = '';
/** Software rasterisers: a render on one of these is correct but several times slower (it silently happened for days). */
const SOFTWARE_GL = new RegExp(['swiftshader', 'llvmpipe', 'softpipe', 'software', 'subzero', process.env.HARNESS_GL_DENY ?? RCFG.gl_deny].filter(Boolean).join('|'), 'i');

/**
 * Launch the headless browser for every script (render, encode, stills, qa). Every page it opens gets the HMR block
 * (blockHmr) before any navigation. Before returning, it reads the WebGL UNMASKED_RENDERER once in this browser (the
 * probe idea from JohnHeibel/ClaudeAnimationBase gpu_probe.mjs, MIT), logs it to stderr once per process, and exits
 * with code 3 if it is a software rasteriser (SwiftShader, llvmpipe, …; extra pattern: $HARNESS_GL_DENY or
 * render.gl_deny) unless HARNESS_ALLOW_SOFTWARE_GL=1 (CI without a GPU).
 */
export async function launch(headed = false): Promise<Browser> {
  const b = await chromium.launch({ executablePath: chromePath(), headless: !headed, args: CHROME_ARGS, env: CHROME_ENV });
  const newPage = b.newPage.bind(b);
  b.newPage = async (o?: Parameters<Browser['newPage']>[0]) => { const p = await newPage(o); await blockHmr(p); return p; };
  try {
    const p = await newPage();
    const r: string = await p.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2') as WebGL2RenderingContext | null;
      if (!gl) return 'no WebGL2 context';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    });
    await p.close();
    const first = !GL_RENDERER;
    GL_RENDERER = r;
    if (first) console.error(`gl: ${r}`);
    if ((SOFTWARE_GL.test(r) || r === 'no WebGL2 context') && process.env.HARNESS_ALLOW_SOFTWARE_GL !== '1') {
      console.log(`ABORT: software WebGL (${r}); check render.angle_args / render.gpu_env (or HARNESS_ALLOW_SOFTWARE_GL=1 for CI)`);
      await b.close();
      process.exit(3);
    }
  } catch (e) { await b.close().catch(() => {}); throw e; }
  return b;
}

/**
 * Keep the Vite HMR WebSocket from opening on export pages: a file saved on the shared dev server would
 * otherwise full-reload the page mid-render ("Execution context was destroyed"). Frames are unchanged.
 */
const hmrBlocked = new WeakSet<Page>();
export async function blockHmr(page: Page) {
  if (hmrBlocked.has(page)) return;
  hmrBlocked.add(page);
  await page.addInitScript(() => {
    const W = window.WebSocket;
    (window as any).WebSocket = new Proxy(W, {
      construct(target, args: any[]) {
        const p = args[1];
        if (p === 'vite-hmr' || (Array.isArray(p) && p.includes('vite-hmr'))) {
          return { readyState: 0, protocol: 'vite-hmr', addEventListener() {}, removeEventListener() {}, send() {}, close() {} } as any;
        }
        return Reflect.construct(target, args);
      },
    });
  });
}

/** Open `${url}/?export=1${query}` (HMR blocked) and wait for the engine. Throws on a boot error. */
export async function openExport(page: Page, url: string, query = '') {
  await blockHmr(page);
  await page.goto(`${url}/?export=1${query}`);
  await page.waitForFunction(() => (window as any).__pdoom?.ready || (window as any).__pdoom?.error, null, { timeout: 180000 });
  const err = await page.evaluate(() => (window as any).__pdoom.error);
  if (err) throw new Error(`app failed to boot:\n${err}`);
}

/** Timeline entry ids overlapping [from, to) (asks a page booted with no scenes). */
export async function entriesFor(page: Page, url: string, from: number, to: number): Promise<string[]> {
  await openExport(page, url, '&only=__none__');
  const tl: { id: string; start: number; end: number }[] = await page.evaluate(() => (window as any).__pdoom.timeline);
  return tl.filter((e) => e.end > from && e.start < to).map((e) => e.id);
}

export function argParser(argv: string[]) {
  const opt = (k: string, d?: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
  const flag = (k: string) => argv.includes(`--${k}`);
  return { opt, flag };
}

// ------------------------------------------------------------------ inputs, receipts, atomic outputs (T1, T2, T11)
const SCENES = path.join(APP, 'src/scenes');
const PUBLIC = path.join(APP, 'public');
const ASSET = /['"`]\/?((?:[\w.-]+\/)*[\w.-]+\.(?:png|jpe?g|webp|svg|gif|json|txt|glb|ttf|otf|woff2?))['"`]/g;

/** A chapter's scene files: scenes/c<N>.ts (or *_c<N>.ts) and every scenes/ module they import (kits), recursively. */
export function sceneFiles(w: Win): string[] {
  const seen = new Set<string>();
  const visit = (f: string) => {
    if (seen.has(f) || !existsSync(f)) return;
    seen.add(f);
    for (const m of readFileSync(f, 'utf8').matchAll(/from\s+['"]\.\/([\w.-]+?)(\.ts)?['"]/g)) visit(path.join(SCENES, /\.\w+$/.test(m[1]!) ? m[1]! : `${m[1]}.ts`));
  };
  if (existsSync(SCENES)) for (const f of readdirSync(SCENES)) if (new RegExp(`(^|_)c${w.n}\\.ts$`, 'i').test(f)) visit(path.join(SCENES, f));
  return [...seen];
}

/**
 * Every file a render of these chapters reads: their scene files and kits, the public assets those name (string
 * literals with an asset extension, and refs/<name>.* for refArt('<name>')), the narration data (lyrics, chapters,
 * audio analysis), the timeline, the caption chunks and the narration audio. Absolute paths, sorted, existing only.
 */
export function renderInputs(ws: Win[]): string[] {
  const out = new Set<string>();
  const refs = existsSync(path.join(PUBLIC, 'refs')) ? readdirSync(path.join(PUBLIC, 'refs')) : [];
  for (const w of ws) for (const f of sceneFiles(w)) {
    out.add(f);
    if (!f.endsWith('.ts')) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(ASSET)) { const a = path.join(PUBLIC, m[1]!); if (existsSync(a)) out.add(a); }
    for (const m of src.matchAll(/['"]([\w-]+)['"]/g)) for (const r of refs) if (r.startsWith(m[1]! + '.') && !r.endsWith('.md')) out.add(path.join(PUBLIC, 'refs', r));
  }
  for (const f of ['data/lyrics.json', 'data/chapters.json', 'data/audio.json', 'audio/voice.mp3', 'app/src/timeline.ts', 'app/src/captions_chunks.json']) out.add(path.join(ENGINE, f));
  // paper-quote indexes (panel text and timing budget come from them): public/papers/**/quotes.json
  const walk = (d: string): void => { if (!existsSync(d)) return; for (const e of readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === 'quotes.json') out.add(p); } };
  walk(path.join(PUBLIC, 'papers'));
  return [...out].filter((f) => existsSync(f) && statSync(f).isFile()).sort();
}

/** Chapter windows overlapping [from, to). */
export const windowsIn = (from: number, to: number) => chapterWindows().filter((w) => w.to > from && w.from < to);

/**
 * sha256 (hex) of a file, streamed. Cached across runs in engine/work/renders/.sha-cache.json by (size, mtime, inode),
 * so a pending check re-hashes only files whose mtime moved; a touched-but-unchanged file hashes the same and is not
 * pending. The cache is written once, when the process exits.
 */
const SHA_CACHE = path.join(ENGINE, 'work/renders/.sha-cache.json');
let shaCache: Record<string, { k: string; sha: string }> | null = null;
let shaDirty = false;
export function sha256File(f: string): string {
  if (!shaCache) {
    try { shaCache = JSON.parse(readFileSync(SHA_CACHE, 'utf8')); } catch { shaCache = {}; }
    process.on('exit', saveShaCache);
  }
  const st = statSync(f), k = `${st.size}:${st.mtimeMs}:${st.ino}`;
  const c = shaCache![f];
  if (c?.k === k) return c.sha;
  const h = new Bun.CryptoHasher('sha256'), buf = Buffer.allocUnsafe(4 << 20), fd = openSync(f, 'r');
  try { for (let n; (n = readSync(fd, buf, 0, buf.length, null)) > 0;) h.update(buf.subarray(0, n)); } finally { closeSync(fd); }
  const sha = h.digest('hex');
  shaCache![f] = { k, sha }; shaDirty = true;
  return sha;
}
/** Persist the hash cache (runs on process exit; harmless if nothing changed or the folder is gone). */
export function saveShaCache() {
  if (!shaDirty || !shaCache) return;
  try { writeAtomic(SHA_CACHE, JSON.stringify(shaCache)); shaDirty = false; } catch { /* best effort */ }
}

/** {path relative to `base` (posix): sha256} for these files. */
export function hashFiles(files: string[], base: string): Record<string, string> {
  return Object.fromEntries(files.map((f) => [path.relative(base, f).split(path.sep).join('/'), sha256File(f)]));
}

/** Write text/bytes to `file` atomically (temp beside it, then rename): readers never see a partial file. */
export function writeAtomic(file: string, data: string | Uint8Array) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

/**
 * Receipt `<file>.receipt.json` (same schema as tools/receipts.py): the output's sha256 and size, and the sha256 of
 * every input, keyed by path relative to the output's folder. tools/receipts.py verify-fresh checks it (recursively:
 * an input with its own receipt is verified too).
 */
export interface Receipt { version: 1; file: string; sha256: string; size: number; created: string; inputs: Record<string, string>; info: Record<string, any> }
export const receiptPath = (file: string) => `${file}.receipt.json`;
export function receiptFor(file: string, inputs: Record<string, string>, info: Record<string, any> = {}): Receipt {
  const st = statSync(file);
  return { version: 1, file: path.basename(file), sha256: sha256File(file), size: st.size, created: new Date().toISOString(), inputs, info: { ...info, ino: st.ino, mtime_ms: st.mtimeMs } };
}
export function readReceipt(file: string): Receipt | null {
  try { return readJSON<Receipt>(receiptPath(file)); } catch { return null; }
}

/** Video facts from ffprobe: frames (packets), duration, stream kinds and the first video size. */
export async function probeVideo(f: string) {
  const p = Bun.spawn(['ffprobe', '-v', 'error', '-count_packets', '-show_entries', 'stream=codec_type,width,height,nb_read_packets:format=duration', '-of', 'json', f], { stdout: 'pipe', stderr: 'pipe' });
  const j = JSON.parse((await new Response(p.stdout).text()) || '{}');
  const v = (j.streams ?? []).find((s: any) => s.codec_type === 'video');
  return { frames: +(v?.nb_read_packets ?? 0), dur: +(j.format?.duration ?? 0), width: +(v?.width ?? 0), height: +(v?.height ?? 0), audio: (j.streams ?? []).some((s: any) => s.codec_type === 'audio') };
}

/** Temp path beside `out` for a staged write (same folder, so the final rename is atomic; keeps the extension). */
export const stagedPath = (out: string) => path.join(path.dirname(out), `.${path.basename(out, path.extname(out))}.${process.pid}.part${path.extname(out)}`);

/** Validate a staged video (a video stream, duration within ±1 frame of `want` s if given) and rename it over `out`.
 * Never writes into `out`, so hard links of the old file (review copies) keep the old content. Throws on a bad file. */
export async function commitVideo(staged: string, out: string, want?: { dur?: number; fps?: number; audio?: boolean }) {
  const v = await probeVideo(staged);
  const tol = want?.fps ? 1.01 / want.fps : 0.1;
  const bad = !v.frames ? 'no video stream' : want?.dur !== undefined && Math.abs(v.dur - want.dur) > tol ? `duration ${v.dur.toFixed(3)} s, want ${want.dur.toFixed(3)}` : want?.audio && !v.audio ? 'no audio stream' : '';
  if (bad) throw new Error(`${path.basename(out)}: ${bad} (staged file kept: ${staged})`);
  mkdirSync(path.dirname(out), { recursive: true });
  renameSync(staged, out);
  return v;
}
