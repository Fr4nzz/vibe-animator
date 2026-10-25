#!/usr/bin/env bun
// Single-browser encoder. One headless Chromium renders the frames (the engine's export API, __pdoom.stream), packs
// them on the GPU as I420 (BT.709 limited range, top-down) and streams them over a WebSocket to ffmpeg, which
// encodes them on the GPU (VAAPI) by default. It can also make the episode's Shorts of this window in the same pass.
//   bun scripts/encode.ts --out ../work/renders/x.mp4 [--url http://localhost:<port>] [--from 0] [--to 12.5]
//     [--fps 30] [--samples 4] [--shutter 0.4] [--chunk 30]
//     [--enc h264_vaapi|hevc_vaapi|x264|x264-fast|webcodecs]  default render.encoder (h264_vaapi, lib.ts DEFAULT_ENC)
//         h264_vaapi: VBR --bv (render.video_bitrate, 10M) --maxrate 17M · hevc_vaapi: CQP --qp 16 · x264: the old CPU
//         path (--preset medium --crf 18, tune grain) · x264-fast: preset fast, also the automatic fallback when VAAPI
//         cannot encode · webcodecs: H.264 encoded in the page (Chrome's encoder, --wc-bitrate 10e6), opt-in.
//         All clips of an episode must use one encoder and settings: assemble.py joins them by stream copy.
//     [--rgb]      old transport (rgb24 bottom-up, vflip + swscale in ffmpeg)   [--socks 2]  two frame sockets (~+10 %)
//     [--shorts plan.json --short-ids S01,S02]  also make these Shorts (tools/make_shorts.py --plan): inside each
//         Short's window the page post-processes the frame again without captions and crops the square; a second
//         ffmpeg composes the vertical Short with the narration. Frames a Short needs outside --from/--to are rendered
//         for the Short only. Each Short is checked, renamed into place with a receipt and its review copy refreshed.
//     [--only id,id | --only auto]  load only these timeline entries (auto: those overlapping the frames rendered)
//     [--query "&captions=0"]  extra page query   [--quiet]  no progress line, one summary line at the end
//     [--noaudio]  video only (default: the episode's engine/audio/voice.mp3, same window)
//     [--budget 200]  give up waiting for a render slot / free memory after this many s (exit 75; 0 = wait)
// Each frame is acknowledged to the page only after it was written to ffmpeg (real backpressure: memory cannot pile
// up when the encoder is slower than the page). Takes a render slot itself after the memory check (no deadlock if a
// caller already holds one). The Vite HMR socket is always blocked and Chromium gets the episode's GPU env (a
// software WebGL renderer aborts, lib.ts launch). Without --url (or if it is unreachable) a private dev server is
// started and stopped. The video is staged beside --out, checked with ffprobe and renamed over --out.
// For chapter clips use render_chapter.ts, which adds the window, the frame check, the receipts and the atomic replace.
import {
  DEFAULT_ENC, REVIEW_DIR, blockHmr, commitVideo, devServer, encoderArgs, ensureLocked, entriesFor, hashFiles, launch, probeVideo,
  receiptFor, receiptPath, renderInputs, resolveEnc, stagedPath, windowsIn, writeAtomic, type Enc,
} from './lib';
import { copyFileSync, existsSync, linkSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1]! : d; };
await ensureLocked('render');
const srv = await devServer(argv.includes('--url') ? opt('url', '') : undefined);
const url = srv.url;
const ROOT = path.resolve(import.meta.dir, '..', '..');
const out = path.resolve(opt('out', path.join(ROOT, 'work/renders/encode.mp4')));
mkdirSync(path.dirname(out), { recursive: true });
const staged = stagedPath(out);
const stagedV = staged.replace(/\.mp4$/, '.video.mp4');   // webcodecs: video-only pass, audio muxed afterwards
const fps = +opt('fps', '30'), samples = +opt('samples', '4'), shutter = +opt('shutter', '0.4'), chunk = +opt('chunk', '30');
const W = 1920, H = 1080;
const QUIET = argv.includes('--quiet');
const enc: Enc = await resolveEnc(opt('enc', DEFAULT_ENC) as Enc);
const WC = enc === 'webcodecs';
const YUV = !argv.includes('--rgb') || WC, NS = WC ? 1 : Math.max(1, +opt('socks', '1'));
const FB = YUV ? (W * H * 3) / 2 : W * H * 3;
const settings = { bv: argv.includes('--bv') ? opt('bv', '') : undefined, maxrate: opt('maxrate', '17M'), qp: opt('qp', '16'), crf: opt('crf', '18'), preset: argv.includes('--preset') ? opt('preset', '') : undefined };

// ------------------------------------------------------------------ Shorts plan
interface ShortJob { id: string; t0: number; t1: number; out: string; filter: string; audio: string; inputs: string[]; info?: Record<string, unknown> }
interface Plan { crop: [number, number, number, number]; size: [number, number]; shorts: ShortJob[] }
const plan: Plan | null = argv.includes('--shorts') ? JSON.parse(readFileSync(opt('shorts', ''), 'utf8')) : null;
const shortIds = opt('short-ids', '').split(',').filter(Boolean);
const jobs = plan ? plan.shorts.filter((s) => shortIds.includes(s.id)) : [];
if (plan && shortIds.some((id) => !jobs.find((j) => j.id === id))) { console.error(`--short-ids: not in the plan: ${shortIds.filter((id) => !jobs.find((j) => j.id === id))}`); process.exit(2); }
const SQ = jobs.map((j) => ({ ...j, n0: Math.round(j.t0 * fps), n1: Math.round(j.t1 * fps) }));
// each Short's inputs as they are when the render starts (its receipt; a later edit makes it stale)
const sqBefore = new Map(SQ.map((j) => [j.id, hashFiles([...renderInputs(windowsIn(j.t0, j.t1)), ...j.inputs].filter(existsSync), path.dirname(j.out))]));

const browser = await launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
const from = +opt('from', '0');
const to0 = argv.includes('--to') ? +opt('to', '0') : null;
const rFrom = Math.min(from, ...SQ.map((s) => s.t0)), rTo = to0 === null ? 1e9 : Math.max(to0, ...SQ.map((s) => s.t1));
let only = opt('only', '');
if (only === 'auto') only = (await entriesFor(page, url, rFrom, rTo)).join(',') || '__none__';
await blockHmr(page);
await page.goto(`${url}/?export=1${only ? `&only=${only}` : ''}${opt('query', '')}`);
await page.waitForFunction(() => (window as any).__pdoom?.ready || (window as any).__pdoom?.error, null, { timeout: 180000 });
const err = await page.evaluate(() => (window as any).__pdoom.error);
if (err) throw new Error(err);
const sceneErrors: string[] = await page.evaluate(() => (window as any).__pdoom.errors);
if (sceneErrors.length) { console.error('SCENE ERRORS\n' + sceneErrors.join('\n')); process.exit(1); }
if (SQ.length && (await page.evaluate(() => (window as any).__pdoom.scale)) !== 1) { console.error('--shorts needs output scale 1'); process.exit(2); }
const dur: number = await page.evaluate(() => (window as any).__pdoom.duration);
const to = to0 ?? dur;
const f0 = Math.round(from * fps), f1 = Math.round(to * fps), total = f1 - f0;
const r0 = Math.min(f0, ...SQ.map((s) => s.n0)), r1 = Math.max(f1, ...SQ.map((s) => s.n1));

// ------------------------------------------------------------------ encoders
const audio = path.join(ROOT, 'audio/voice.mp3');
const withAudio = !argv.includes('--noaudio') && existsSync(audio);
const audioIn = withAudio ? ['-ss', String(from), '-t', String(to - from), '-i', audio] : [];
const audioOut = [...(withAudio ? ['-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest'] : []), '-movflags', '+faststart'];
let ffArgs: string[];
if (WC) {
  // H.264 Annex B from the page; VUI colour set to the BT.709 limited range the frames were packed in
  // Video only here: the Annex B stream from the page has no timestamps, and muxing the narration in the same pass
  // silently dropped the audio track. The audio is added in a second, stream-copy pass after ffmpeg exits.
  ffArgs = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'h264', '-r', String(fps), '-i', 'pipe:0', '-map', '0:v',
    '-c:v', 'copy', '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0', '-movflags', '+faststart', stagedV];
} else {
  const e = encoderArgs(enc, YUV ? 'yuv420p' : 'rgb24', settings);
  ffArgs = ['ffmpeg', '-y', '-loglevel', 'error', ...e.pre, '-f', 'rawvideo', '-pix_fmt', YUV ? 'yuv420p' : 'rgb24', '-s', `${W}x${H}`, '-r', String(fps), '-i', 'pipe:0',
    ...audioIn, '-map', '0:v', '-vf', e.filter, ...e.codec, ...audioOut, staged];
}
const ff = Bun.spawn(ffArgs, { stdin: 'pipe', stdout: 'inherit', stderr: 'inherit' });

// one encoder per Short, started with its first frame: square I420 in, the composed vertical Short out
const sqEnc: Enc = WC ? await resolveEnc('h264_vaapi') : enc;
const sqFF = new Map<string, ReturnType<typeof Bun.spawn>>();
const sqStaged = (j: ShortJob) => stagedPath(j.out);
function startShort(j: (typeof SQ)[number]) {
  const e = encoderArgs(sqEnc, 'yuv420p', settings);
  const [w, h] = plan!.crop;
  mkdirSync(path.dirname(j.out), { recursive: true });
  const graph = `[0:v]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv,${j.filter}${e.hwTail ? `;[v]${e.hwTail}[vo]` : ''}`;
  const p = Bun.spawn(['ffmpeg', '-y', '-loglevel', 'error', ...e.pre, '-f', 'rawvideo', '-pix_fmt', 'yuv420p', '-s', `${w}x${h}`, '-r', String(fps), '-i', 'pipe:0',
    '-ss', String(j.t0), '-t', String(j.t1 - j.t0), '-i', j.audio, '-filter_complex', graph, '-map', e.hwTail ? '[vo]' : '[v]', '-map', '1:a',
    ...e.codec, '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-movflags', '+faststart', sqStaged(j)], { stdin: 'pipe', stdout: 'inherit', stderr: 'inherit' });
  sqFF.set(j.id, p);
  return p;
}
/** The square frames, in order: the sorted union of the Shorts' frame ranges. */
const sqFrames: number[] = [...new Set(SQ.flatMap((s) => Array.from({ length: s.n1 - s.n0 }, (_, i) => s.n0 + i)))].sort((a, b) => a - b);

// ------------------------------------------------------------------ receiver
// main frame n arrives on socket n % NS (in order per socket) and is written in global order; square frames arrive
// in sqFrames order on their own socket. A frame is acknowledged to the page once it has been written.
let written = 0, sqWritten = 0, wcEnded = false, failed = '';
const t0 = performance.now();
const queues: Uint8Array[][] = Array.from({ length: NS }, () => []);
const socks: any[] = [];
const sockAck = new Array(NS).fill(0);
let next = f0, draining = false;
const progress = () => {
  if (QUIET || written % 30) return;
  const el = (performance.now() - t0) / 1000;
  process.stdout.write(`\r${written}/${total} frames  ${(written / el).toFixed(2)} fps  eta ${((total - written) / (written / el)).toFixed(0)}s   `);
};
async function drain() {
  if (draining) return;
  draining = true;
  try {
    for (;;) {
      const k = next % NS, q = queues[k]!;
      if (!q.length) break;
      const buf = q.shift()!;
      ff.stdin.write(buf); await ff.stdin.flush();
      next++; written++;
      socks[k].send(String(++sockAck[k]));
      progress();
    }
  } catch (e) { failed = `ffmpeg write: ${e}`; } finally { draining = false; }
  if (queues[next % NS]!.length) void drain();
}
const sqQueue: Uint8Array[] = [];
let sqSock: any = null, sqDraining = false;
async function sqDrain() {
  if (sqDraining) return;
  sqDraining = true;
  try {
    while (sqQueue.length) {
      const buf = sqQueue.shift()!, n = sqFrames[sqWritten]!;
      for (const j of SQ) {
        if (n < j.n0 || n >= j.n1) continue;
        const stdin = (sqFF.get(j.id) ?? startShort(j)).stdin as import('bun').FileSink;
        stdin.write(buf); await stdin.flush();
        if (n === j.n1 - 1) stdin.end();
      }
      sqWritten++;
      sqSock.send(String(sqWritten));
    }
  } catch (e) { failed = `Short ffmpeg write: ${e}`; } finally { sqDraining = false; }
}
const server = Bun.serve({
  port: 0,
  fetch(req, s) {
    const u = new URL(req.url);
    return s.upgrade(req, { data: { k: +(u.searchParams.get('k') ?? 0), kind: u.pathname.slice(1) || 'main' } } as any) ? undefined : new Response('ws only', { status: 400 });
  },
  websocket: {
    maxPayloadLength: 64 * 1024 * 1024,
    open(ws) { const d = ws.data as any; if (d.kind === 'sq') sqSock = ws; else if (d.kind === 'main') socks[d.k] = ws; },
    message(ws, m) {
      const d = ws.data as any;
      if (d.kind === 'wc') {
        if (typeof m === 'string') { if (m === 'end') wcEnded = true; return; }
        ff.stdin.write(m as Uint8Array); return;
      }
      const buf = new Uint8Array(m as Uint8Array); // own copy
      if (d.kind === 'sq') {
        if (buf.length !== (plan!.crop[0] * plan!.crop[1] * 3) / 2) { console.error('bad square frame size', buf.length); process.exit(1); }
        sqQueue.push(buf); void sqDrain(); return;
      }
      if (buf.length !== FB) { console.error('bad frame size', buf.length); process.exit(1); }
      queues[d.k]!.push(buf);
      void drain();
    },
  },
});

const used: Record<string, number> = {};
const ws = `ws://127.0.0.1:${server.port}/main`;
const sqOpt = SQ.length ? { ws: `ws://127.0.0.1:${server.port}/sq`, crop: plan!.crop, ranges: SQ.map((s) => [s.n0, s.n1]) } : undefined;
const wcOpt = WC ? { ws: `ws://127.0.0.1:${server.port}/wc`, bitrate: +opt('wc-bitrate', '10e6'), keyEvery: 2 * fps, start: f0 } : undefined;
for (let a = r0; a < r1 && !failed; a += chunk) {
  const b = Math.min(r1, a + chunk);
  const h: Record<string, number> = await page.evaluate((o) => (window as any).__pdoom.stream(o), {
    from: a / fps, to: b / fps, fps, ws, samples, shutter, inflight: 4, yuv: YUV, socks: NS, main: [f0, f1] as [number, number], sq: sqOpt, wc: wcOpt,
  });
  for (const [c, n] of Object.entries(h)) used[c] = (used[c] ?? 0) + n;
}
let wcInfo: any = null;
if (WC && !failed) { wcInfo = await page.evaluate(() => (window as any).__pdoom.wcFlush()); while (!wcEnded) await Bun.sleep(20); }
// wait for the last frames to be written
while (!failed && ((!WC && written < total) || sqWritten < sqFrames.length)) await Bun.sleep(20);
await browser.close();
server.stop(true);
srv.stop();
ff.stdin.end();
let code = await ff.exited;
if (failed) { console.error(failed); code = code || 1; }

// ------------------------------------------------------------------ outputs
function placeAt(src: string, dst: string) {
  mkdirSync(path.dirname(dst), { recursive: true });
  const tmp = path.join(path.dirname(dst), `.${path.basename(dst)}.${process.pid}.tmp`);
  try { linkSync(src, tmp); } catch { copyFileSync(src, tmp); }
  renameSync(tmp, dst);
}
const shortsDone: string[] = [];
for (const j of SQ) {
  const p = sqFF.get(j.id);
  const c = p ? await p.exited : -1;
  const f = sqStaged(j);
  const v = c === 0 && existsSync(f) ? await probeVideo(f) : null;
  const want = j.t1 - j.t0;
  if (!v || v.width !== plan!.size[0] || v.height !== plan!.size[1] || !v.audio || Math.abs(v.dur - want) > 0.1 || Math.abs(v.frames - (j.n1 - j.n0)) > 1) {
    console.error(`short ${j.id} FAILED (ffmpeg exit ${c}${v ? `; ${v.width}x${v.height} ${v.frames} frames ${v.dur.toFixed(3)} s audio ${v.audio}, want ${plan!.size.join('x')} ${j.n1 - j.n0} / ${want.toFixed(3)} s` : ''}); staged file kept: ${f}`);
    code = code || 1;
    continue;
  }
  renameSync(f, j.out);
  const rec = receiptFor(j.out, sqBefore.get(j.id)!, { short: j.id, from: j.t0, to: j.t1, fps, samples, enc: sqEnc, made_by: 'chapter pass', ...(j.info ?? {}) });
  writeAtomic(receiptPath(j.out), JSON.stringify(rec, null, 1) + '\n');
  if (REVIEW_DIR) placeAt(j.out, path.join(REVIEW_DIR, 'shorts', path.basename(j.out)));
  shortsDone.push(`${j.id} ${v.frames}f`);
}
if (WC && code === 0 && existsSync(stagedV)) {
  const mux = Bun.spawnSync(['ffmpeg', '-y', '-loglevel', 'error', '-i', stagedV, ...audioIn, '-map', '0:v', '-c:v', 'copy', ...audioOut, staged]);
  rmSync(stagedV, { force: true });
  if (mux.exitCode !== 0) { console.error(`webcodecs audio mux failed (exit ${mux.exitCode})`); code = mux.exitCode ?? 1; }
}
if (code === 0) {
  try { await commitVideo(staged, out, { dur: total / fps, fps }); } catch (e) { console.error(String((e as Error).message)); code = 1; }
} else rmSync(staged, { force: true });
const el = (performance.now() - t0) / 1000;
console.log(`${QUIET ? '' : '\n'}wrote ${out} (${total} frames in ${el.toFixed(1)}s, ${(total / el).toFixed(1)} fps; enc ${enc}${YUV ? ' yuv' : ' rgb'}${NS > 1 ? ` ${NS} sockets` : ''}; sub-frames ${JSON.stringify(used)}`
  + `${SQ.length ? `; shorts ${shortsDone.join(', ') || 'none'} (+${r1 - r0 - total} frames outside the window)` : ''}${wcInfo ? `; webcodecs ${JSON.stringify(wcInfo)}` : ''}) ffmpeg exit ${code}`);
process.exit(code);
