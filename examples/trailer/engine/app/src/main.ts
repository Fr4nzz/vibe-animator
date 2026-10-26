// Entry: preview player (default) or export mode (?export=1, driven by scripts/render.ts).
import { Engine, type AdaptiveSampling } from './engine/engine';
import { PW, PH, SCALE } from './engine/gl';
import { makeTimeline } from './timeline';
import { QA, qa, installQa } from './engine/qa';

const params = new URLSearchParams(location.search);
const EXPORT = params.has('export');
const ONLY = params.get('only'); // comma-separated scene ids to load (faster stills)
const FROM = params.get('t') ? parseFloat(params.get('t')!) : null;

const canvas = document.getElementById('c') as HTMLCanvasElement;
// physical size: 1920x1080 times ?scale= (the page CSS keeps showing it at 1920x1080)
canvas.width = PW;
canvas.height = PH;

installQa(); // ?qa=1 only (scripts/qa.ts): records text draws; a no-op otherwise
const engine = new Engine(canvas, makeTimeline);

declare global {
  interface Window { __pdoom: any }
}

let TIMELINE: typeof engine.timeline = [];

async function boot() {
  const onlySet = ONLY ? new Set(ONLY.split(',')) : null;
  await engine.init(onlySet ? (e) => onlySet.has(e.id) : undefined);
  TIMELINE = engine.timeline;
  if (EXPORT) setupExport();
  else setupPlayer();
}

// ------------------------------------------------------------------ export API
/** The last frame stream() rendered (a range starting right after it needs no warm-up). */
let lastStreamed = -2;
const senders = new Map<string, Promise<Sender>>();
interface Sender { send(fill: (buf: Uint8Array) => Promise<unknown>): Promise<void> }

/**
 * A WebSocket written from a worker thread: send() fills a pooled frame buffer, transfers it to the worker
 * (no copy) and returns once the buffer is on its way, waiting first while `inflight` frames are unacknowledged.
 */
function sender(url: string, inflight: number, bytes = Engine.RGB_BYTES): Promise<Sender> {
  let s = senders.get(url);
  if (s) return s;
  s = new Promise<Sender>((resolve, reject) => {
    const src = `let ws;
      onmessage = (e) => {
        const m = e.data;
        if (m.open) {
          ws = new WebSocket(m.open); ws.binaryType = 'arraybuffer';
          ws.onopen = () => postMessage({ open: true });
          ws.onerror = () => postMessage({ error: 'websocket error' });
          ws.onclose = (ev) => postMessage({ error: 'websocket closed ' + ev.code + ' ' + ev.reason + ' clean=' + ev.wasClean });
          ws.onmessage = (ev) => postMessage({ acked: +ev.data || 0 });
        } else {
          ws.send(m.buf); // (copies the frame: the buffer can go straight back)
          postMessage({ free: m.buf }, [m.buf]);
        }
      };`;
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    const free: ArrayBuffer[] = [];
    let sent = 0, acked = 0, failed = '', pool = 0;
    let wake: (() => void) | null = null;
    const notify = () => { const f = wake; wake = null; f?.(); };
    const wait = () => new Promise<void>((r) => { wake = r; });
    w.onmessage = (e) => {
      const m = e.data;
      if (m.open) resolve({ send });
      else if (m.error) { failed = m.error; reject(new Error(m.error)); notify(); }
      else if (m.acked !== undefined) { acked = Math.max(acked, m.acked); notify(); }
      else if (m.free) { free.push(m.free); notify(); }
    };
    async function send(fill: (buf: Uint8Array) => Promise<unknown>) {
      while (!failed && sent - acked >= inflight) await wait();
      if (failed) throw new Error(failed);
      // two buffers: one being filled while the other is with the worker (it comes straight back)
      if (!free.length && pool < 2) { free.push(new ArrayBuffer(bytes)); pool++; }
      while (!free.length) await wait();
      const buf = free.pop()!;
      await fill(new Uint8Array(buf));
      w.postMessage({ buf }, [buf]);
      sent++;
    }
    w.postMessage({ open: url });
  });
  senders.set(url, s);
  return s;
}

// ------------------------------------------------------------------ WebCodecs (opt-in: encode.ts --enc webcodecs)
interface WcState { encode(n: number, fill: (buf: Uint8Array) => Promise<unknown>): Promise<void>; close(): Promise<void>; info: Record<string, unknown> }
let wcState: WcState | null = null;
/**
 * One VideoEncoder for the whole encode (kept across stream() ranges so timestamps and the GOP run on): Chrome's
 * H.264 (its hardware encoder fails on this machine: prefer-software), fed the GPU-packed BT.709 I420 frames as
 * VideoFrames (so its input is the same pixels the ffmpeg path encodes, no canvas colour conversion). Chunks (Annex B)
 * go out over a plain WebSocket; the receiver muxes them with `-c:v copy`.
 */
async function wcEncoder(o: { ws: string; bitrate: number; keyEvery: number; start: number }): Promise<WcState> {
  if (wcState) return wcState;
  const ws = new WebSocket(o.ws);
  ws.binaryType = 'arraybuffer';
  await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = () => rej(new Error('wc websocket error')); });
  let err = '';
  const info: Record<string, unknown> = { chunks: 0, bytes: 0 };
  const enc = new VideoEncoder({
    output: (ch, meta) => {
      if (meta?.decoderConfig && !info.codec) { info.codec = meta.decoderConfig.codec; info.hw = (meta.decoderConfig as any).hardwareAcceleration; }
      const b = new Uint8Array(ch.byteLength);
      ch.copyTo(b);
      ws.send(b);
      info.chunks = (info.chunks as number) + 1; info.bytes = (info.bytes as number) + b.length;
    },
    error: (e) => { err = String(e); },
  });
  const cfg: VideoEncoderConfig = {
    codec: 'avc1.640028', width: PW, height: PH, bitrate: o.bitrate, framerate: 30, hardwareAcceleration: 'prefer-software',
    avc: { format: 'annexb' }, latencyMode: 'quality', bitrateMode: 'variable',
  } as VideoEncoderConfig;
  const sup = await VideoEncoder.isConfigSupported(cfg);
  if (!sup.supported) throw new Error('WebCodecs: avc1.640028 1080p not supported');
  enc.configure(cfg);
  const fps = 30, buf = new Uint8Array(Engine.YUV_BYTES);
  const drain = async () => {
    while (!err && (enc.encodeQueueSize > 4 || ws.bufferedAmount > 32 << 20)) await new Promise((r) => setTimeout(r, 1));
    if (err) throw new Error(`WebCodecs: ${err}`);
  };
  wcState = {
    info,
    async encode(n, fill) {
      await drain();
      await fill(buf);
      const k = n - o.start;
      const vf = new VideoFrame(buf, {
        format: 'I420', codedWidth: PW, codedHeight: PH, timestamp: Math.round((k * 1e6) / fps), duration: Math.round(1e6 / fps),
        colorSpace: { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false },
      });
      enc.encode(vf, { keyFrame: k % o.keyEvery === 0 });
      vf.close();
    },
    async close() {
      if (enc.state !== 'closed') await enc.flush();
      if (err) throw new Error(`WebCodecs: ${err}`);
      enc.close();
      while (ws.bufferedAmount > 0) await new Promise((r) => setTimeout(r, 5));
      ws.send('end'); // (the receiver closes the file on this)
    },
  };
  return wcState;
}

function setupExport() {
  document.body.classList.add('export');
  window.__pdoom = {
    engine,
    duration: engine.duration,
    errors: engine.errors,
    /** Output size in px (1920x1080 times scale); stream() sends frames of width*height*3 bytes (rgb24). */
    scale: SCALE,
    width: PW,
    height: PH,
    timeline: TIMELINE.map(({ id, start, end }) => ({ id, start, end })),
    /** ?qa=1: render t (1 sample, to the canvas) and return its text draws (see engine/qa.ts) and the post zoom/shake. */
    qaFrame: QA ? (t: number) => {
      qa.recs = [];
      engine.render(t, 1 / 60, true, 1, 0.5);
      return { recs: qa.recs, zoom: engine.lastPost.zoom ?? 1, shake: engine.lastPost.shake ?? [0, 0] };
    } : undefined,
    /** Render a single frame at t (seeks as needed). */
    still(t: number, samples: number | AdaptiveSampling = 1, shutter = 0.5) { return engine.render(t, 1 / 60, true, samples, shutter); },
    /** The last rendered frame as a full-resolution (PW x PH) PNG, base64 (for stills at scale > 1). */
    async png() {
      const px = await engine.readPixelsAsync(), row = PW * 4;
      const img = new ImageData(PW, PH);
      for (let y = 0; y < PH; y++) img.data.set(px.subarray((PH - 1 - y) * row, (PH - y) * row), y * row); // bottom-up -> top-down
      const oc = new OffscreenCanvas(PW, PH);
      oc.getContext('2d')!.putImageData(img, 0, 0);
      const b = new Uint8Array(await (await oc.convertToBlob({ type: 'image/png' })).arrayBuffer());
      let s = '';
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      return btoa(s);
    },
    /**
     * Render [from, to) at fps and stream raw frames over a WebSocket, in order. Frames are rgb24 bottom-up, or with
     * `yuv` I420 top-down (GPU-packed BT.709 limited range, Engine.YUV_BYTES: ffmpeg reads -pix_fmt yuv420p as is).
     * Returns when all frames were handed to the socket, with a histogram of sub-frames per frame. The
     * receiver acknowledges each frame once it has WRITTEN it to the encoder (a text message with its running count
     * per socket) and at most `inflight` frames are unacknowledged per socket: backpressure from the encoder, so a
     * slow encode cannot pile frames up in memory. Pipelined: frame n's readback is collected while n+1 renders, and
     * each socket is written from a worker thread. Calls with the same `ws` reuse its connection, so a renderer can
     * be handed several ranges; a range that goes on where the last one ended skips the warm-up.
     *   socks: N sockets (`ws` + `?k=i`), frame n on socket n % N (the receiver reorders).
     *   main: [n0, n1) frame numbers that go to `ws` (default: all; frames outside are rendered for `sq` only).
     *         'wc' instead of 'ws' (see wc below) encodes them in the page.
     *   sq: { ws, crop: [w, h, x0, y0], ranges: [n0, n1][] }: frames inside a range are also post-processed once
     *       more WITHOUT captions (Engine.renderClean), cropped and sent as I420 on their own socket (the Shorts).
     *   wc: { ws, bitrate, keyEvery, start }: WebCodecs H.264 in the page (opt-in): the I420 frames go to a
     *       VideoEncoder (avc1.640028, Annex B, quality latency mode, VBR) and only the compressed chunks leave over
     *       `ws`; frame timestamps count from frame `start`. Call wcFlush() after the last range.
     */
    async stream(opts: {
      from: number; to: number; fps: number; ws: string; samples?: number | AdaptiveSampling; shutter?: number; inflight?: number;
      yuv?: boolean; socks?: number; main?: [number, number];
      sq?: { ws: string; crop: [number, number, number, number]; ranges: [number, number][] };
      wc?: { ws: string; bitrate: number; keyEvery: number; start: number };
    }) {
      const NS = Math.max(1, opts.socks ?? 1), YUV = !!opts.yuv || !!opts.wc, bytes = YUV ? Engine.YUV_BYTES : Engine.RGB_BYTES;
      const inflight = opts.inflight ?? 4;
      const snds = opts.wc ? [] : await Promise.all(Array.from({ length: NS }, (_, i) => sender(NS > 1 ? `${opts.ws}${opts.ws.includes('?') ? '&' : '?'}k=${i}` : opts.ws, inflight, bytes)));
      const sq = opts.sq;
      const sqSnd = sq ? await sender(sq.ws, inflight, Engine.yuvBytes(sq.crop[0], sq.crop[1])) : null;
      const wc = opts.wc ? await wcEncoder(opts.wc) : null;
      const dt = 1 / opts.fps;
      const n0 = Math.round(opts.from * opts.fps), n1 = Math.round(opts.to * opts.fps);
      const [m0, m1] = opts.main ?? [n0, n1];
      const inSq = (n: number) => !!sq && sq.ranges.some(([a, b]) => n >= a && n < b);
      const S = opts.samples ?? 1, SH = opts.shutter ?? 0.5;
      // warm-up: render one frame before the range so the first frame is sequential for stateful scenes
      // (adaptive sampling only runs stateless scenes: one sample is enough for the warm-up)
      if (n0 > 0 && lastStreamed !== n0 - 1) engine.render((n0 - 1) * dt, dt, false, typeof S === 'number' ? S : 1, SH);
      const used: Record<number, number> = {}; // sub-frames per frame -> frames
      // readback slots: frame n uses n & 1 (main) and 2 + (n & 1) (square)
      let pending: { n: number; main: boolean; sq: boolean } | null = null;
      const collect = async (p: { n: number; main: boolean; sq: boolean }) => {
        if (p.main) {
          if (wc) await wc.encode(p.n, (buf) => engine.readFinish(p.n & 1, buf));
          else await snds[p.n % NS]!.send((buf) => engine.readFinish(p.n & 1, buf));
        }
        if (p.sq) await sqSnd!.send((buf) => engine.readFinish(2 + (p.n & 1), buf));
      };
      for (let n = n0; n < n1; n++) {
        const k = engine.render(n * dt, dt, false, S, SH);
        used[k] = (used[k] ?? 0) + 1;
        const cur = { n, main: n >= m0 && n < m1, sq: inSq(n) };
        if (cur.main) { if (YUV) engine.readStartYuv(n & 1); else engine.readStart(n & 1); }
        if (cur.sq) { engine.renderClean(); engine.readStartYuv(2 + (n & 1), sq!.crop, true); }
        if (pending) await collect(pending);
        pending = cur;
      }
      if (pending) await collect(pending);
      lastStreamed = n1 - 1;
      return used;
    },
    /** WebCodecs mode: flush the page encoder (after the last stream() range) and close its socket. */
    async wcFlush() { const e = wcState; wcState = null; if (e) await e.close(); return e?.info ?? null; },
  };
  window.__pdoom.ready = true;
}

// ------------------------------------------------------------------ preview player
function setupPlayer() {
  const audio = new Audio('audio/voice.mp3');
  audio.preload = 'auto';
  const ui = document.getElementById('ui')!;
  const scrub = document.getElementById('scrub') as HTMLInputElement;
  const info = document.getElementById('info')!;
  const marks = document.getElementById('marks')!;
  const errs = document.getElementById('errs')!;
  scrub.max = String(engine.duration);
  scrub.step = '0.001';
  if (engine.errors.length) { errs.textContent = engine.errors.join('\n\n'); errs.style.display = 'block'; }

  for (const e of TIMELINE) {
    const m = document.createElement('div');
    m.className = 'mark';
    m.style.left = `${(e.start / engine.duration) * 100}%`;
    m.style.width = `${((e.end - e.start) / engine.duration) * 100}%`;
    m.title = `${e.id} ${e.start.toFixed(2)}–${e.end.toFixed(2)}`;
    m.textContent = e.id;
    m.onclick = () => seek(e.start);
    marks.appendChild(m);
  }

  let t = FROM ?? 0;
  let playing = false;
  let loop: [number, number] | null = null;
  let lastAudioT = 0, lastPerf = 0;
  const seek = (x: number) => { t = Math.max(0, Math.min(engine.duration - 0.001, x)); audio.currentTime = t; };
  seek(t);

  const toggle = () => { playing = !playing; if (playing) { audio.currentTime = t; audio.play(); } else audio.pause(); };
  canvas.onclick = toggle;
  scrub.oninput = () => seek(parseFloat(scrub.value));
  window.addEventListener('keydown', (ev) => {
    if (ev.key === ' ') { ev.preventDefault(); toggle(); }
    if (ev.key === 'ArrowRight') seek(t + (ev.shiftKey ? 5 : 1));
    if (ev.key === 'ArrowLeft') seek(t - (ev.shiftKey ? 5 : 1));
    if (ev.key === '.') seek(t + 1 / 60);
    if (ev.key === ',') seek(t - 1 / 60);
    if (ev.key === 'l') {
      const e = TIMELINE.find((x) => t >= x.start && t < x.end);
      loop = loop ? null : e ? [e.start, e.end] : null;
    }
    if (ev.key === 'h') ui.classList.toggle('hidden');
    if (ev.key === ']') { const e = TIMELINE.find((x) => x.start > t + 0.01); if (e) seek(e.start); }
    if (ev.key === '[') { const es = TIMELINE.filter((x) => x.start < t - 0.3); const e = es[es.length - 1]; if (e) seek(e.start); }
  });

  let frames = 0, fpsT = performance.now(), fps = 0;
  const tick = () => {
    if (playing) {
      // smooth the coarse audio clock with performance.now()
      const now = performance.now();
      if (audio.currentTime !== lastAudioT) { lastAudioT = audio.currentTime; lastPerf = now; }
      t = lastAudioT + (audio.paused ? 0 : (now - lastPerf) / 1000);
      if (loop && t >= loop[1]) seek(loop[0]);
      if (audio.ended) playing = false;
    }
    engine.render(t, 1 / 60);
    scrub.value = String(t);
    frames++;
    const now = performance.now();
    if (now - fpsT > 500) { fps = (frames * 1000) / (now - fpsT); frames = 0; fpsT = now; }
    const e = TIMELINE.find((x) => t >= x.start && t < x.end);
    const l = engine.lyrics.lineAt(t);
    info.textContent = `${t.toFixed(2)}s  beat ${engine.audio.beatAt(t).toFixed(2)}  bar ${engine.audio.barAt(t).toFixed(2)}  [${e?.id ?? '—'}]  ${fps.toFixed(0)}fps   ${l ? '“' + l.text + '”' : ''}${loop ? '  LOOP' : ''}`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // Vite HMR: re-instantiate scenes whose module changed
  if (import.meta.hot) {
    import.meta.hot.on('vite:afterUpdate', (payload: any) => {
      for (const u of payload.updates ?? []) {
        const m = /scenes\/([\w-]+)\.ts/.exec(u.path ?? '');
        if (m) for (const e of TIMELINE) if (e.id === m[1] || (e as any).file === m[1]) engine.reload(e.id);
      }
    });
  }
}

boot().catch((e) => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f55;position:fixed;top:0;left:0">${String(e?.stack ?? e)}</pre>`);
  window.__pdoom = { error: String(e?.stack ?? e) };
});
