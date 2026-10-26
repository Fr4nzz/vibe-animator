// Trailer T3 composer kit (shared; OWNER: the C0 builder; C1–C4 import it read-only and report needed changes).
// A DIRECTOR prompt types into T3 Code's composer in sync with the voice, the camera pushes in to the typed text, the
// typed line lifts out as crisp scene text and settles as the chapter title, and the T3 UI dissolves into the plate.
// Everything is a pure function of t (frame chosen by the typed-prefix length, never by time).
//
// Assets: public/t3/<lineid>/index.json (BUILD_BRIEF «T3 Code assets»). 1× full frames NNN.webp (1920 × 1080) plus,
// when present, a 2× layer `hi`: hi/bg.webp (the static region around the composer, crisp at the z 2.2 push) and
// hi/NNN.webp (the composer region per typed prefix). The kit draws the 1× frame, then the 2× layers over it, so the
// push stays sharp; without `hi` it falls back to the 1× frame.
//
// Typical use (one prompt line L with cue word w; see BUILD_BRIEF «Composer → title lift-out»):
//   const t3 = await t3Line(this.q, 'C1-L8', 'word', { title: { paper: 0 } });     // in build(): loads every frame
//   this.shots = [
//     t3.shot({ t0: ctx.start }),                                                   // arrive → type → lift → dissolve
//     { t0: t3.tm.dis1, fi: 0.5, t1: …, paper: 0, cam: […], draw: …, hud: (o) => { t3.title(o); … } },  // your plate
//   ];
// The plate shot starts at t3.tm.dis1 with fi 0.5, so it fades in exactly while the T3 shot fades out (ShotScene
// crossfade). The lifted title is drawn by the T3 shot until dis1 (unfaded), then by your hud via t3.title(o).
// Strip arrival (C2–C4): pass `cam: inCam(hi)` and `paint: (o, p) => …drawStrip(…, inner: (oo, k, x, y) => { if (k ===
// 0) { oo.c.translate(x, y); oo.s.translate(x, y); p(oo); } })…` while inStrip(hi, t), else p(o).
import { W, H, clamp, ease, lerp, rgba, F, font, loadImg, type SC, type Shot, type CamKey, type Cues } from './_shots';
import { HEX } from '../engine/palette';

// String literals so the render receipt hashes the indexes (each lists every frame's sha1).
export const T3_INDEX: Record<string, string> = {
  'C1-L8': 't3/C1-L8/index.json',
  'C2-L8': 't3/C2-L8/index.json',
  'C3-L7': 't3/C3-L7/index.json',
  'C4-L5': 't3/C4-L5/index.json',
};
/** The honest tag (owner decision 2026-10-25): shown while any re-typed composer is on screen. */
export const T3_TAG = 'prompt re-typed for this trailer';
/** Push-in zoom at the end of the typing (BUILD_BRIEF: about 2.2, never past 2.4). */
export const T3_Z = 2.2;
/** Tag baseline in frame px: clear below the «Current checkout» bar under the composer (bar ends ~y 645). */
export const T3_TAG_Y = 673;

export interface T3Frame { file: string; chars: number; caret: [number, number, number] | null; hi?: string }
export interface T3Index {
  line: string; prompt: string; chars: number; size: [number, number];
  composer_bbox: [number, number, number, number]; text_origin: [number, number]; frames: T3Frame[];
  /** 2× layer: `scale` backing px per frame px; `bg` = [x, y, w, h] frame px of hi/bg.webp; `clip` = [x, y, w, h]
   *  frame px of every hi/NNN.webp */
  hi?: { scale: number; bg: [number, number, number, number]; clip: [number, number, number, number] };
}
export interface T3Seq {
  id: string; ix: T3Index; dir: string;
  full: HTMLImageElement[]; hiBg: HTMLImageElement | null; hi: (HTMLImageElement | null)[];
  /** composer fill (sampled) for covering the image glyphs at the lift */
  fill: string; pageFill: string;
  /** prompt text in frame px: left x, right x (final caret), line top, line height; and the font px that matches it */
  tx0: number; tx1: number; ty: number; th: number; fpx: number;
}

const seqs = new Map<string, Promise<T3Seq>>();
const base = (u: string) => u.slice(0, u.lastIndexOf('/') + 1);
/** The prompt's face: T3 renders its UI sans; Archivo 400 matched to the same width reads the same. */
export const T3_FONT = () => F.archivo(100, 400);

/** Load a prompt's index and every frame (decoded once; call in build(), never in render). Cached per line id. */
export function t3Frames(lineId: string): Promise<T3Seq> {
  let p = seqs.get(lineId);
  if (!p) {
    p = (async () => {
      const url = T3_INDEX[lineId];
      if (!url) throw new Error(`t3Frames: no T3 capture for ${lineId}`);
      const ix = (await (await fetch(url)).json()) as T3Index;
      const dir = base(url);
      const [full, hiBg, hi] = await Promise.all([
        Promise.all(ix.frames.map((f) => loadImg(dir + f.file))),
        ix.hi ? loadImg(dir + 'hi/bg.webp').catch(() => null) : Promise.resolve(null),
        Promise.all(ix.frames.map((f) => (ix.hi && f.hi ? loadImg(dir + f.hi).catch(() => null) : Promise.resolve(null)))),
      ]);
      // sample the composer's fill (left padding, mid-height) and the page's (top-centre gap) from frame 000
      const cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1080;
      const g = cv.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(full[0]!, 0, 0);
      const px = (x: number, y: number) => { const d = g.getImageData(x, y, 1, 1).data; return `rgb(${d[0]},${d[1]},${d[2]})`; };
      const [bx, by] = ix.composer_bbox, [ox, oy] = ix.text_origin;
      const last = ix.frames[ix.frames.length - 1]!;
      const th = last.caret?.[2] ?? 19, tx1 = last.caret?.[0] ?? ox + ix.chars * 8;
      g.font = font(T3_FONT(), 100);
      const fpx = (100 * (tx1 - ox)) / Math.max(1, g.measureText(ix.prompt).width);
      return { id: lineId, ix, dir, full, hiBg, hi, fill: px(bx + 8, oy + 40), pageFill: px(960, 300), tx0: ox, tx1, ty: oy, th, fpx };
    })();
    seqs.set(lineId, p);
  }
  return p;
}

/** Frame index for the typed prefix of line `id` at t: frames[k] shows k characters. `untype` = [t0, t1] runs the
 *  prompt back from full to empty over that window (C0 → C1 hand-off). */
export function t3FrameIdx(seq: T3Seq, q: Cues, t: number, untype?: [number, number]): number {
  if (untype && t >= untype[0]) return Math.round(seq.ix.chars * (1 - clamp((t - untype[0]) / Math.max(1e-3, untype[1] - untype[0]))));
  return Math.min(q.typed(seq.id, t).length, seq.ix.chars);
}

/** Draw frame k with frame px (fx, fy) at world (x + fx·s, y + fy·s): the 1× frame, then the 2× layers over it.
 *  `cover` paints the composer fill over the prompt glyphs (the lift-out has taken them). */
export function t3Draw(c: CanvasRenderingContext2D, seq: T3Seq, k: number, x = 0, y = 0, s = 1, a = 1, cover = false) {
  if (a <= 0.001) return;
  const kk = clamp(Math.round(k), 0, seq.full.length - 1);
  c.save(); c.globalAlpha *= a;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  if (cover) {
    // masked layers are composited opaque offscreen (once, cached) and drawn at the fading alpha, so a dissolve never
    // lets the prompt glyphs ghost through a half-transparent mask
    const m = covered(seq, kk);
    c.drawImage(m.full, x, y, W * s, H * s);
    if (m.hi && m.rect) c.drawImage(m.hi, x + m.rect[0] * s, y + m.rect[1] * s, m.rect[2] * s, m.rect[3] * s);
    c.restore();
    return;
  }
  c.drawImage(seq.full[kk]!, x, y, W * s, H * s);
  const hi = seq.ix.hi;
  if (hi) {
    if (seq.hiBg) { const [bx, by, bw, bh] = hi.bg; c.drawImage(seq.hiBg, x + bx * s, y + by * s, bw * s, bh * s); }
    const im = seq.hi[kk];
    if (im) { const [cx, cy, cw, ch] = hi.clip; c.drawImage(im, x + cx * s, y + cy * s, cw * s, ch * s); }
  }
  c.restore();
}

type Covered = { full: HTMLCanvasElement; hi: HTMLCanvasElement | null; rect: [number, number, number, number] | null };
const coveredCache = new WeakMap<T3Seq, Map<number, Covered>>();
/** Frame kk with the prompt glyphs painted over, as opaque canvases: the 1× frame, and the 2× region (hi bg +
 *  composer crop) when present. Built once per (seq, frame). */
function covered(seq: T3Seq, kk: number): Covered {
  let m = coveredCache.get(seq);
  if (!m) { m = new Map(); coveredCache.set(seq, m); }
  const hit = m.get(kk);
  if (hit) return hit;
  const mask = (g: CanvasRenderingContext2D) => { g.fillStyle = seq.fill; g.fillRect(seq.tx0 - 4, seq.ty - 3, seq.tx1 - seq.tx0 + 10, seq.th + 6); };
  const full = document.createElement('canvas'); full.width = W; full.height = H;
  const gf = full.getContext('2d')!; gf.drawImage(seq.full[kk]!, 0, 0, W, H); mask(gf);
  let hi: HTMLCanvasElement | null = null, rect: Covered['rect'] = null;
  const h = seq.ix.hi;
  if (h && seq.hiBg) {
    const [bx, by, bw, bh] = h.bg, sc = h.scale;
    hi = document.createElement('canvas'); hi.width = Math.round(bw * sc); hi.height = Math.round(bh * sc);
    const g = hi.getContext('2d')!;
    g.setTransform(sc, 0, 0, sc, -bx * sc, -by * sc); // frame px in
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(seq.hiBg, bx, by, bw, bh);
    const im = seq.hi[kk];
    if (im) { const [cx, cy, cw, ch] = h.clip; g.drawImage(im, cx, cy, cw, ch); }
    mask(g);
    rect = [bx, by, bw, bh];
  }
  const out = { full, hi, rect };
  m.set(kk, out);
  return out;
}

/** The composer card alone (crop of composer_bbox of frame k, 2× when available) drawn into a world rect. */
export function t3Composer(c: CanvasRenderingContext2D, seq: T3Seq, k: number, x: number, y: number, w: number, h: number, a = 1) {
  if (a <= 0.001) return;
  const kk = clamp(Math.round(k), 0, seq.full.length - 1);
  const [bx, by, bw, bh] = seq.ix.composer_bbox, hi = seq.ix.hi, im = seq.hi[kk];
  c.save(); c.globalAlpha *= a;
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  if (hi && im) { const sc = hi.scale, [cx, cy] = hi.clip; c.drawImage(im, (bx - cx) * sc, (by - cy) * sc, bw * sc, bh * sc, x, y, w, h); }
  else c.drawImage(seq.full[kk]!, bx, by, bw, bh, x, y, w, h);
  c.restore();
}

/** Our own caret (screenshots hide the real one): a 1.5 px bone bar at the frame's caret, blinking at 1 Hz. */
export function t3Caret(c: CanvasRenderingContext2D, seq: T3Seq, k: number, t: number, x = 0, y = 0, s = 1, a = 1) {
  if (a <= 0.001 || Math.floor(t * 2) % 2 === 1) return;
  const f = seq.ix.frames[clamp(Math.round(k), 0, seq.ix.frames.length - 1)]!;
  const [cx, cy, ch] = f.caret ?? [seq.tx0 + 1, seq.ty, seq.th];
  c.save(); c.globalAlpha *= a; c.fillStyle = rgba('bone', 0.95);
  c.fillRect(x + (cx + 1) * s, y + cy * s, Math.max(1.5, 1.5 * s), ch * s);
  c.restore();
}

/** «prompt re-typed for this trailer»: 24 px sans, ash, ~60 % alpha, no box (on bone paper pass graphite). Screen space (call from a hud).
 *  (x, y) = the anchor (default: right-aligned, baseline). Clamped inside x 420–1500 and above y 900. */
export function t3Tag(c: CanvasRenderingContext2D, x: number, y: number, a: number, align: CanvasTextAlign = 'right', size = 24, colr = rgba('ash', 0.62)) {
  if (a <= 0.001) return;
  c.save(); c.globalAlpha *= clamp(a);
  c.font = font(F.archivo(100, 500), size); c.letterSpacing = '0.5px';
  c.textAlign = align; c.textBaseline = 'alphabetic';
  const w = c.measureText(T3_TAG).width;
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  const xs = clamp(x0, 424, 1496 - w);
  c.fillStyle = colr;
  c.textAlign = 'left';
  c.fillText(T3_TAG, xs, Math.min(y, 896));
  c.restore();
}

/** World → screen for an SC camera. */
export const t3Scr = (o: SC, wx: number, wy: number): [number, number] => [W / 2 + (wx - o.cam.x) * o.cam.z, H / 2 + (wy - o.cam.y) * o.cam.z];

// ------------------------------------------------------------------ timing and camera
export interface T3Timing {
  /** line start, line end, end of the cue word */
  s: number; e: number; cue: number;
  /** scene text replaces the image glyphs at lift0 (= max(cue end, line end): never lift a half-typed line) and lands
   *  as the title at lift1 (0.1 s + 0.7 s travel; = e + the 0.8 s hold for a cue on the last word) */
  lift0: number; lift1: number;
  /** T3 frame + tag fade out / plate fades in (0.5 s, overlapping the travel) */
  dis0: number; dis1: number;
}
export function t3Timing(q: Cues, lineId: string, cueWord: string): T3Timing {
  const s = q.s(lineId), e = q.end(lineId), cue = q.e(lineId, cueWord);
  const lift0 = Math.max(cue, e);
  return { s, e, cue, lift0, lift1: lift0 + 0.8, dis0: lift0 + 0.35, dis1: lift0 + 0.85 };
}

/** The text-centred view at the end of the typing: centre of the prompt line, z ≤ T3_Z with the line ≤ 1000 px wide
 *  on screen (inside the Shorts square). */
export function t3View(seq: T3Seq): { x: number; y: number; z: number } {
  const span = seq.tx1 - seq.tx0;
  return { x: (seq.tx0 + seq.tx1) / 2, y: seq.ty + seq.th / 2, z: Math.min(T3_Z, 1000 / Math.max(1, span)) };
}

/** Camera keys (world = frame px): full window at z 1 until s, eased push to the text view at e, hold through the
 *  lift, ease back a little during the dissolve. Prepend arrival keys (strip) before these. */
export function t3Keys(seq: T3Seq, tm: T3Timing): CamKey[] {
  const v = t3View(seq);
  return [
    [tm.s, W / 2, H / 2, 1, ease.inOutCubic],
    [tm.e, v.x, v.y, v.z, ease.inOutCubic],
    [tm.dis0, v.x, v.y, v.z, ease.linear],
    [tm.dis1 + 0.05, v.x, v.y - 20, v.z * 0.8, ease.inOutCubic],
  ];
}

// ------------------------------------------------------------------ the lifted title
export interface T3TitleOpt {
  /** the chapter's plate: 0 ink (bone title), 1 paper (ink title); default 0 */
  paper?: 0 | 1;
  /** final baseline y and size (screen px); default 150, 60 (≥ 44) */
  y?: number; size?: number;
  /** final face (default the prompt's sans; a different face crossfades in during the travel) */
  font?: string;
  /** final colour (CSS); default bone on ink, ink on paper */
  color?: string;
  /** later shrink to a kicker: from t0 to t1, to `size` px at baseline `y` */
  shrink?: { t0: number; t1: number; size: number; y: number };
  /** the title fades out over [t0, t1] (default: never) */
  out?: [number, number];
}

const hex = (s: string): [number, number, number] => {
  const h = s.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const mixHex = (a: string, b: string, u: number) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i]!, u))).join(',')})`; };

export class T3Line {
  constructor(public q: Cues, public seq: T3Seq, public tm: T3Timing, public opt: { title?: T3TitleOpt } = {}) {}
  get id() { return this.seq.id; }
  get prompt() { return this.seq.ix.prompt; }
  /** camera keys of the T3 view (see t3Keys) */
  keys(): CamKey[] { return t3Keys(this.seq, this.tm); }
  /** frame index at t */
  frameIdx(t: number, untype?: [number, number]) { return t3FrameIdx(this.seq, this.q, t, untype); }

  /** Paint the T3 window at t in frame coordinates (world 0..1920 × 0..1080 at the current transform): frame by
   *  prefix, own caret while typing, glyphs covered from lift0. For a strip `inner`, translate to the frame first. */
  paint(o: SC) {
    const t = o.t, k = this.frameIdx(t);
    o.c.save(); o.c.fillStyle = this.seq.pageFill; o.c.fillRect(-400, -400, W + 800, H + 800); o.c.restore();
    t3Draw(o.c, this.seq, k, 0, 0, 1, 1, t >= this.tm.lift0);
    if (t < this.tm.lift0) t3Caret(o.c, this.seq, k, t);
  }

  /** The tag under the composer's bottom-right corner, screen space; fades in with the first typed character. */
  tag(o: SC, a = 1) {
    // baseline at frame y T3_TAG_Y: below T3's «Current checkout» bar (frame y ~616–645), never on it
    const [bx, , bw] = this.seq.ix.composer_bbox;
    const [sx, sy] = t3Scr(o, bx + bw, T3_TAG_Y);
    const tIn = this.q.w(this.id, this.prompt.split(' ')[0]!);
    t3Tag(o.c, Math.min(sx, 1496), Math.min(sy, 896), a * clamp((o.t - tIn) / 0.25));
  }

  /** Title geometry at t (screen px): centre x, baseline y, size, and the face mix u (0 prompt sans .. 1 title face). */
  titleAt(o: SC) {
    const t = o.t, tm = this.tm, T = this.opt.title ?? {};
    const size1 = T.size ?? 60, y1 = T.y ?? 150;
    // start: exactly over the image glyphs at lift0 (the T3 shot's camera at that moment)
    const v = t3View(this.seq);
    const z0 = v.z; // the push has landed by e ≤ lift0 (held until dis0)
    const [sx0, sy0] = [W / 2 + (this.seq.tx0 - v.x) * z0, H / 2 + (this.seq.ty - v.y) * z0];
    const w0 = (this.seq.tx1 - this.seq.tx0) * z0, size0 = this.seq.fpx * z0;
    const cx0 = sx0 + w0 / 2, by0 = sy0 + this.seq.th * z0 * 0.74; // alphabetic baseline inside the line box
    const u = ease.inOutCubic(clamp((t - (tm.lift0 + 0.1)) / 0.7));
    let cx = lerp(cx0, W / 2, u), y = lerp(by0, y1, u) - 36 * Math.sin(Math.PI * u), size = lerp(size0, size1, u);
    if (T.shrink) { const r = ease.inOutCubic(clamp((t - T.shrink.t0) / Math.max(1e-3, T.shrink.t1 - T.shrink.t0))); y = lerp(y, T.shrink.y, r); size = lerp(size, T.shrink.size, r); }
    return { cx, y, size, u };
  }

  /** Draw the lifted title at t (screen space). From lift0; colour goes from the T3 text colour to the plate's over
   *  the dissolve. Your plate hud calls this from dis1 on (the T3 shot draws it before that). */
  title(o: SC, a = 1) {
    const t = o.t, tm = this.tm, T = this.opt.title ?? {};
    if (t < tm.lift0) return;
    const fo = T.out ? 1 - clamp((t - T.out[0]) / Math.max(1e-3, T.out[1] - T.out[0])) : 1;
    if (a * fo <= 0.001) return;
    const g = this.titleAt(o), c = o.c;
    const end = T.color ?? (T.paper ? HEX.ink : HEX.bone);
    const colr = end.startsWith('#') ? mixHex('#E6E6E6', end, clamp((t - tm.dis0) / (tm.dis1 - tm.dis0))) : end;
    const faces: [string, number][] = T.font && T.font !== T3_FONT() ? [[T3_FONT(), 1 - g.u], [T.font, g.u]] : [[T3_FONT(), 1]];
    c.save(); c.globalAlpha *= a * fo;
    c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.letterSpacing = '0px'; c.fillStyle = colr;
    for (const [f, fa] of faces) {
      if (fa <= 0.001) continue;
      c.save(); c.globalAlpha *= fa; c.font = font(f, g.size); c.fillText(this.prompt, g.cx, g.y); c.restore();
    }
    c.restore();
  }

  /** The T3 shot: arrive (your `cam` keys first) → type with the push → lift → dissolve. paper 0; ends at dis0 with
   *  a 0.5 s fade-out (fo), so a plate shot with t0 = tm.dis1, fi = 0.5 crossfades with it. */
  shot(opt: { t0?: number; cam?: CamKey[]; drift?: (t: number) => number; paint?: (o: SC, paint: (o: SC) => void) => void; extraHud?: (o: SC) => void } = {}): Shot {
    const tm = this.tm;
    return {
      t0: opt.t0 ?? tm.s - 0.4, t1: tm.dis0, paper: 0, fi: 0.01, fo: tm.dis1 - tm.dis0,
      cam: [...(opt.cam ?? []), ...this.keys()],
      // no handheld drift while the lifted text must sit exactly on the glyphs
      drift: opt.drift ?? ((t) => 1 - clamp((t - (tm.e - 0.6)) / 0.4)),
      draw: (o) => (opt.paint ? opt.paint(o, (oo) => this.paint(oo)) : this.paint(o)),
      hud: (o) => {
        this.tag(o);
        opt.extraHud?.(o);
        if (o.t >= tm.lift0 && o.t < tm.dis1 - 0.02) { o.c.save(); o.c.globalAlpha = 1; this.title(o); o.c.restore(); }
      },
    };
  }
}

/** Load a prompt line and its timing (call in build()). `cueWord` = the BUILD_BRIEF cue of that line. */
export async function t3Line(q: Cues, lineId: string, cueWord: string, opt: { title?: T3TitleOpt } = {}): Promise<T3Line> {
  return new T3Line(q, await t3Frames(lineId), t3Timing(q, lineId, cueWord), opt);
}
