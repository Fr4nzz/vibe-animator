// Trailer continuity device: the vertical 35 mm film strip (shared kit; OWNER: the C0 builder; others import it
// read-only and report needed changes). At the end of every chapter the camera pulls back until the working frame is
// one frame of a vertical strip (perforations both sides, edge numbers, frame lines); the strip slides up one frame
// to the next chapter, whose first ~0.6 s pushes back in. Everything is a pure function of t.
//
// Geometry: frame k of a strip drawn at (cx, cy) with scroll s has its picture at
//   x = cx - W/2, y = cy - H/2 + (k - s) * STRIP.pitch, size W x H (one full 1920x1080 working view).
// So with cx = W/2, cy = H/2, scroll 0, frame 0 IS the working view: the pull-back is seamless.
//
// Typical use (v2 hand-off, see "hand-offs" below; c1.ts is the reference for both sides):
//   outgoing chapter n:   const ho = outro('C<n>');            // optional { holdAfter: [lineId, word] | songTime }
//     cam: [...yourKeys, ...outCam(ho)]   scroll: outScroll(ho, t)   draw the strip only while outStrip(ho, t)
//     this.postPaper = (t) => handPost(ho, 'out', t)
//   incoming chapter n+1: const hi = intro('C<n+1>');           // same opt as the previous chapter's outro
//     const still = await prevStill(this.ctx, hi);               // the previous chapter's last frame (spill mode)
//     first shot: cam: [...inCam(hi), ...yourKeys], drift: inDrift(hi)
//     draw while inStrip(hi, t): drawStrip(o, { cx: W/2, cy: H/2, frames: 5, first: STRIP.first(n+1), live: 0,
//            scroll: inScroll(hi, t), inner: (o, k, x, y, w, h) => { if (k === -1) drawFrame(o.c, still, x, y, w, h);
//            if (k === 0) { translate(x, y); yourPlate(o); } } })
//     this.postPaper = (t) => handPost(hi, 'in', t)   (combine with the outro's: t < hi.push1 ? in : out)
// Legacy numeric outro(n)/intro(t) still compile (old timing).
// Match the neighbour across the cut: the outgoing chapter fills frame 1 with the incoming plate
// (`fill: k => k === 1 ? rgba(STRIP.plate.C<n+1> ? 'bone' : 'ink', 1) : STRIP.dark`) and fades its table to that plate
// (drawTable); the incoming chapter fills frame -1 with the outgoing plate the same way. C0 ends with frame 11 bone,
// frame 12 ink, table ink, strip colours `on: 0`, edge numbers 11/12 (STRIP.first(0) = 11).
// Draw your plate *inside* `inner` for the live frame during the strip view: it is clipped to the frame window, so
// nothing spills onto the film base or the table. Screen-space hud (FIG. kicker) should fade out by `pull0`.
import * as THREE from 'three';
import { FSPass } from '../engine/gl';
import { qa } from '../engine/qa';
import type { SceneCtx, SceneClass, Frame } from '../engine/scene';
import { W, H, clamp, ease, lerp, rgba, F, font, Cues, type SC, type CamKey } from './_shots';
import CHAPTERS from '../../../data/chapters.json';
import LYRICS from '../../../data/lyrics.json';

export const STRIP = {
  /** picture area of one frame, world px (= the working view at z 1) */
  fw: W, fh: H,
  /** frame line (unexposed band between frames), world px */
  gap: 90,
  /** frame-to-frame pitch, world px */
  pitch: H + 90,
  /** film margin each side of the picture (perforations + edge print), world px */
  margin: 360,
  /** perforations per frame, their size and corner radius (world px), and their centre's distance from the film edge */
  perfs: 4, perfW: 150, perfH: 104, perfR: 20, perfX: 128,
  /** edge-number size (world px): ≥ 24 px on screen down to z 0.26 */
  numSize: 92,
  /** camera zoom of the strip view (whole frame ≈ 540 px wide, strip ≈ 740 px, inside the Shorts square) */
  z: 0.28,
  /** film base colour, by plate under the strip */
  base: { ink: '#25211C', paper: '#1C1916' },
  /** gauge colour: edge print, perforation rims, edge hairlines; by plate under the strip */
  gauge: { ink: rgba('bone', 0.55), paper: rgba('ochre', 0.85) },
  /** unexposed frame (no `inner`, or a frame you leave dark) */
  dark: '#0E0D0C',
  /** each chapter's plate (1 = bone paper, 0 = ink), so an outgoing chapter can pre-fill the next frame */
  plate: { C0: 1, C1: 0, C2: 1, C3: 0, C4: 1, C5: 1, C6: 0 } as Record<string, 0 | 1>,
  /** edge number of chapter n's own frame (frame 0 of its strip); the next chapter's frame is first(n) + 1 */
  first: (n: number) => 11 + n,
};

export interface StripOpt {
  cx: number; cy: number;
  /** frames tall (the strip view at z 0.28 shows about 3.3; 5 covers any slide) */
  frames: number;
  /** edge number of frame 0 (STRIP.first(chapter)) */
  first: number;
  /** offset in frames; growing scroll moves the film up */
  scroll: number;
  /** paints frame k's picture; called clipped to the frame window, after the frame is filled */
  inner?: (o: SC, k: number, x: number, y: number, w: number, h: number) => void;
  /** frame left clear (no fill) so the plate background shows through: the live picture. Default: none. */
  live?: number;
  /** fill colour of frame k before `inner` (default: STRIP.dark; ignored for `live`) */
  fill?: (k: number) => string;
  /** overall opacity (default 1) */
  a?: number;
  /** plate the strip lies on, for its colours (1 paper, 0 ink; default: the shot's plate). In a hand-off both
   *  chapters pass the incoming chapter's plate, STRIP.plate['C<n+1>'], so the film looks the same across the cut. */
  on?: 0 | 1;
}

const rr = (p: Path2D, x: number, y: number, w: number, h: number, r: number) => {
  p.moveTo(x + r, y); p.arcTo(x + w, y, x + w, y + h, r); p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r); p.arcTo(x, y, x + w, y, r); p.closePath();
};
const scr = (o: SC, wx: number, wy: number) => [W / 2 + (wx - o.cam.x) * o.cam.z, H / 2 + (wy - o.cam.y) * o.cam.z] as const;

/** A vertical 35 mm strip centred at (cx, cy); see the header for the frame geometry. */
export function drawStrip(o: SC, opt: StripOpt) {
  const c = o.c, S = STRIP, a = opt.a ?? 1;
  if (a <= 0.001) return;
  const x0 = opt.cx - S.fw / 2, x1 = x0 + S.fw;
  const sx0 = x0 - S.margin, sx1 = x1 + S.margin;
  const kLo = -Math.floor((opt.frames - 1) / 2) + Math.floor(opt.scroll);
  const kHi = kLo + opt.frames; // one extra so a partial scroll never shows the end of the film
  const fy = (k: number) => opt.cy - S.fh / 2 + (k - opt.scroll) * S.pitch;
  const yTop = fy(kLo) - S.gap / 2, yBot = fy(kHi) + S.fh + S.gap / 2;
  const onInk = opt.on === undefined ? !o.paper : opt.on === 0;
  c.save();
  c.globalAlpha *= a;
  // film base with holes: frame windows and perforations (even-odd)
  const base = new Path2D();
  base.rect(sx0, yTop, sx1 - sx0, yBot - yTop);
  const perfs = new Path2D();
  for (let k = kLo; k <= kHi; k++) {
    const y = fy(k);
    base.rect(x0, y, S.fw, S.fh);
    for (let i = 0; i < S.perfs; i++) {
      const py = y - S.gap / 2 + (i + 0.5) * (S.pitch / S.perfs) - S.perfH / 2;
      rr(perfs, sx0 + S.perfX - S.perfW / 2, py, S.perfW, S.perfH, S.perfR);
      rr(perfs, sx1 - S.perfX - S.perfW / 2, py, S.perfW, S.perfH, S.perfR);
    }
  }
  base.addPath(perfs);
  c.fillStyle = onInk ? S.base.ink : S.base.paper;
  c.fill(base, 'evenodd');
  // engraved touch: sparse diagonal hairlines on the margins only
  const gauge = onInk ? S.gauge.ink : S.gauge.paper;
  c.save();
  const mg = new Path2D();
  mg.rect(sx0, yTop, S.margin, yBot - yTop); mg.rect(x1, yTop, S.margin, yBot - yTop);
  c.clip(mg); c.clip(base, 'evenodd');
  c.strokeStyle = rgba(onInk ? 'bone' : 'ochre', 0.07); c.lineWidth = 2.2;
  c.beginPath();
  for (let d = yTop - S.margin * 2; d < yBot; d += 26) {
    c.moveTo(sx0, d); c.lineTo(sx0 + S.margin * 1.6, d + S.margin * 1.6);
    c.moveTo(x1, d); c.lineTo(x1 + S.margin * 1.6, d + S.margin * 1.6);
  }
  c.stroke();
  c.restore();
  // perforation rims and film-edge hairlines
  c.strokeStyle = gauge; c.lineWidth = 3;
  c.stroke(perfs);
  c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(sx0, yTop); c.lineTo(sx0, yBot); c.moveTo(sx1, yTop); c.lineTo(sx1, yBot); c.stroke();
  // frames: fill (unless live), picture, frame hairline, frame-line tick, edge number
  for (let k = kLo; k <= kHi; k++) {
    const y = fy(k);
    if (k !== opt.live) { c.fillStyle = opt.fill?.(k) ?? S.dark; c.fillRect(x0, y, S.fw, S.fh); }
    if (opt.inner) {
      c.save(); o.s.save();
      const clip = new Path2D(); clip.rect(x0, y, S.fw, S.fh);
      c.clip(clip); o.s.clip(clip);
      opt.inner(o, k, x0, y, S.fw, S.fh);
      c.restore(); o.s.restore();
    }
    c.strokeStyle = gauge; c.lineWidth = 3;
    c.strokeRect(x0 - 1.5, y - 1.5, S.fw + 3, S.fh + 3);
    c.beginPath(); c.moveTo(x1 + 20, y - S.gap / 2); c.lineTo(x1 + 70, y - S.gap / 2); c.stroke();
    // edge number: only where it is legible and inside the Shorts square, above the caption band
    const nx = sx0 + S.perfX + S.perfW / 2 + 22, ny = y + S.numSize + 30;
    const [px, py] = scr(o, nx, ny), [px2] = scr(o, nx + S.numSize * 1.4, ny);
    if (px >= 430 && px2 <= 1490 && py > 90 && py < 880 && S.numSize * o.cam.z >= 24) {
      c.font = font(F.mono(600), S.numSize); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.letterSpacing = '0px'; c.fillStyle = gauge;
      c.fillText(String(opt.first + k).padStart(2, '0'), nx, ny);
    }
  }
  c.restore();
}

/** Camera keys from the working view (W/2, H/2, z 1) to the strip view (z STRIP.z), eased. Append to the last
 *  shot's `cam` (its last own key should sit on the working view at or before t0). `t` is accepted and unused. */
export function pullBack(_t: number, t0: number, t1: number): CamKey[] {
  return [[t0, W / 2, H / 2, 1, ease.inOutCubic], [t1, W / 2, H / 2, STRIP.z, ease.inOutQuart]];
}

/** The mirror of pullBack for the incoming chapter: strip view at t0, working view at t1. Prepend to the first
 *  shot's `cam`. */
export function pushIn(t0: number, t1: number): CamKey[] {
  return [[t0, W / 2, H / 2, STRIP.z, ease.inOutCubic], [t1, W / 2, H / 2, 1, ease.inOutCubic]];
}

/** The strip's scroll (frames) for the hand-off: 0 → 1 over [t0, t1], with a small settle past 1 at the end. */
export function slideOn(t: number, t0: number, t1: number): number {
  const p = clamp((t - t0) / Math.max(1e-4, t1 - t0));
  return ease.inOutCubic(p) + 0.022 * Math.sin(Math.PI * clamp((p - 0.62) / 0.38));
}

/** Legacy pull-back pause (s), used only by the legacy numeric `outro(n)`. */
export const HOLD = 0.3;
/** The hand-off out of chapter `id` (see `handoff`). */
export function outro(id: string, opt?: HandOpt): Hand;
/** LEGACY (numeric argument): pull-back 1.6 s ending HOLD s after the last word, slide 1.0 s. It shrinks the payoff
 *  too early; use `outro('C<n>')` (the hand-off below). Kept so unconverted chapters still compile
 *  (declared last so `ReturnType<typeof outro>` stays the legacy shape). */
export function outro(chapterEnd: number): { pull0: number; pull1: number; slide0: number; slide1: number };
export function outro(a: number | string, opt?: HandOpt) {
  if (typeof a === 'string') return handoff(a, opt);
  const pull1 = a + HOLD;
  return { pull0: pull1 - 1.6, pull1, slide0: pull1, slide1: pull1 + 1.0 };
}
/** The hand-off INTO chapter `id` (= handoff(previous chapter)); pass the same `opt` the previous chapter used. */
export function intro(id: string, opt?: HandOpt): Hand & { t0: number; t1: number };
/** LEGACY (numeric argument): push-in over the first 0.6 s. */
export function intro(chapterStart: number): { t0: number; t1: number };
export function intro(a: number | string, opt?: HandOpt) {
  if (typeof a === 'number') return { t0: a, t1: a + 0.6 };
  const i = CH.findIndex((c) => c.id === a);
  if (i < 1) throw new Error(`intro: no chapter before ${a}`);
  const h = handoff(CH[i - 1]!.id, opt);
  return { ...h, t0: h.push0, t1: h.push1 };
}

/** convenience: how far into the strip view the camera is (0 at z 1, 1 at STRIP.z) for fading hud/labels */
export const stripAmount = (z: number) => clamp(Math.log(z) / Math.log(STRIP.z));

/** The table under the strip, as a flat plate colour over the whole view except the live frame's window (if
 *  `opt.live` is set): an outgoing chapter fades this to the incoming chapter's plate during the slide so the cut
 *  does not switch paper and ink. `plate` 1 = bone paper, 0 = ink; `a` its opacity. Draw it before drawStrip. */
export function drawTable(o: SC, opt: StripOpt, plate: 0 | 1, a: number) {
  if (a <= 0.001) return;
  const c = o.c, hw = W / 2 / o.cam.z + 200, hh = H / 2 / o.cam.z + 200;
  const p = new Path2D();
  p.rect(o.cam.x - hw, o.cam.y - hh, hw * 2, hh * 2);
  if (opt.live !== undefined) {
    const y = opt.cy - STRIP.fh / 2 + (opt.live - opt.scroll) * STRIP.pitch;
    p.rect(opt.cx - STRIP.fw / 2, y, STRIP.fw, STRIP.fh);
  }
  c.save(); c.globalAlpha *= clamp(a);
  c.fillStyle = plate ? rgba('bone', 1) : rgba('ink', 1);
  c.fill(p, 'evenodd');
  c.restore();
}

// ================================================================== hand-offs (v2): hold the payoff, then hand off
// Every chapter gap is 1.3 s (C0: 2.5 s, C5: 2.0 s), too short for a 1.2 s hold on the payoff PLUS pull + slide. So a
// hand-off has two modes, decided by the kit from data/chapters.json, so both chapters compute the same thing:
//   'out'   (enough gap: cut - hold >= HAND.minOut) the outgoing chapter holds until `hold`, then pulls back and slides
//           inside its own window (pull/slide compressed into the time left); the incoming chapter pushes in from the
//           strip view over its first 0.6 s (as before).
//   'spill' (otherwise; C1-C4 with the default hold) the outgoing chapter stays FULL SIZE to its very last frame (no
//           pull at all); the incoming chapter opens on a still of that last frame (prevStill: a real render of the
//           previous chapter at cut - 0.02 s) filling the screen at z 1 as frame -1 of its strip, pulls back (0.4 s),
//           slides its own frame up (0.35 s) and pushes in (0.45 s): done 1.2 s after the cut, 0.8 s into its line 1.
// `hold` defaults to the end of the chapter's last spoken word + 1.2 s; `holdAfter` (a song time, or [line, word] =
// that word's end + 1.2 s) moves it. Pass the SAME opt on both sides (outro in chapter n, intro in chapter n + 1).
export const HAND = { hold: 1.2, minOut: 0.9, pull: 0.4, slide: 0.35, push: 0.45, inPush: 0.6 };
export interface HandOpt { holdAfter?: number | [line: string, word: string] }
export interface Hand {
  from: string; to: string; mode: 'out' | 'spill';
  /** end of the outgoing chapter's last spoken word */
  last: number;
  /** the payoff stays full size until here (= pull0) */
  hold: number;
  /** the scene boundary (outgoing end = incoming start) */
  cut: number;
  pull0: number; pull1: number; slide0: number; slide1: number; push0: number; push1: number;
}
type ChRow = { id: string; title: string; start: number; end: number };
const CH = CHAPTERS as ChRow[];
const CUES = new Cues(LYRICS as { lines: any[] });

/** The hand-off between chapter `from` and the next one. Pure function of data/chapters.json, lyrics.json and opt. */
export function handoff(from: string, opt: HandOpt = {}): Hand {
  const i = CH.findIndex((c) => c.id === from);
  if (i < 0 || i + 1 >= CH.length) throw new Error(`handoff: no chapter after ${from}`);
  // the last spoken word: lyrics.json word ends can run a little past chapters.json's end
  const words = (LYRICS as { lines: { id: string; words: { end: number }[] }[] }).lines.filter((l) => l.id.startsWith(from + '-')).flatMap((l) => l.words);
  const last = Math.max(CH[i]!.end, ...words.map((w) => w.end)), cut = CH[i + 1]!.start - 0.4;
  const ha = opt.holdAfter;
  const hold = ha === undefined ? last + HAND.hold : typeof ha === 'number' ? ha : CUES.e(ha[0], ha[1]) + HAND.hold;
  const base = { from, to: CH[i + 1]!.id, last, cut };
  if (cut - hold >= HAND.minOut) {
    const avail = cut - hold, pull = Math.min(1.6, avail * 0.55), slide = Math.min(1.0, avail - pull);
    return { ...base, mode: 'out', hold, pull0: hold, pull1: hold + pull, slide0: hold + pull, slide1: hold + pull + slide, push0: cut, push1: cut + HAND.inPush };
  }
  const pull1 = cut + HAND.pull, slide1 = pull1 + HAND.slide;
  return { ...base, mode: 'spill', hold: cut, pull0: cut, pull1, slide0: pull1, slide1, push0: slide1, push1: slide1 + HAND.push };
}

// ---- outgoing side (chapter n)
/** Camera keys to append to the last shot's cam: the pull-back ('out'), nothing ('spill': stay full size). */
export const outCam = (h: Hand): CamKey[] => (h.mode === 'out' ? pullBack(0, h.pull0, h.pull1) : []);
/** Strip scroll of the outgoing chapter (0 until the slide; always 0 in 'spill'). */
export const outScroll = (h: Hand, t: number) => (h.mode === 'out' ? slideOn(t, h.slide0, h.slide1) : 0);
/** True while the outgoing chapter should draw its plate as a strip frame. */
export const outStrip = (h: Hand, t: number) => h.mode === 'out' && t >= h.pull0;

// ---- incoming side (chapter n + 1)
/** Camera keys to put first in the first shot's cam. */
export function inCam(h: Hand): CamKey[] {
  if (h.mode === 'out') return pushIn(h.push0, h.push1);
  return [[h.cut, W / 2, H / 2, 1, ease.inOutCubic], [h.pull1, W / 2, H / 2, STRIP.z, ease.inOutCubic],
    [h.slide1, W / 2, H / 2, STRIP.z, ease.inOutCubic], [h.push1, W / 2, H / 2, 1, ease.inOutCubic]];
}
/** Strip scroll of the incoming chapter: -1 (previous frame centred) -> 0 over the slide in 'spill'; 0 in 'out'. */
export const inScroll = (h: Hand, t: number) => (h.mode === 'spill' ? -1 + slideOn(t, h.slide0, h.slide1) : 0);
/** True while the incoming chapter should draw the strip (until just after the push-in lands). */
export const inStrip = (h: Hand, t: number) => t < h.push1 + 0.05;
/** Handheld-drift multiplier for the incoming shot (`Shot.drift`): 0 at the cut in 'spill' (the still must sit
 *  exactly on the outgoing frame), back to 1 by the end of the push-in. */
export const inDrift = (h: Hand) => (t: number) => (h.mode === 'spill' ? clamp((t - h.cut) / Math.max(1e-3, h.push1 - h.cut)) : 1);
/** The previous chapter's last frame (spill) as a 1920-px canvas, for frame -1 of the incoming strip. Null in 'out'
 *  mode, inside a thumbnail render, or if that chapter fails. Call once in build(). */
export function prevStill(ctx: SceneCtx, h: Hand): Promise<HTMLCanvasElement | null> {
  if (h.mode !== 'spill' || ctx.params?.thumb) return Promise.resolve(null);
  return chapterFrame(ctx, h.from, h.cut - 0.02, 1920);
}
/** Post-processing plate (0 ink .. 1 paper) for ShotScene.postPaper, so bloom/grain/vignette do not jump at the cut.
 *  Outgoing side: eases to the next plate over the slide ('out'). Incoming side: starts at the previous plate and
 *  eases to its own over the pull + slide ('spill'). */
export function handPost(h: Hand, side: 'out' | 'in', t: number): number {
  const a = STRIP.plate[h.from] ?? 0, b = STRIP.plate[h.to] ?? 0;
  if (side === 'out') return h.mode === 'out' ? lerp(a, b, ease.inOutCubic(clamp((t - (h.slide0 - 0.2)) / Math.max(1e-3, h.slide1 - h.slide0 + 0.2)))) : a;
  return h.mode === 'spill' ? lerp(a, b, ease.inOutCubic(clamp((t - h.cut) / Math.max(1e-3, h.slide1 - h.cut)))) : b;
}

// ================================================================== real frames of this trailer's chapters
// chapterFrame(): renders a frame of ANOTHER chapter (its own scene module, at a fixed song time) into a canvas, once.
// Used for C0's flash frames, the spill hand-off still, and C5/C6's strips (re-exported by kit_c5c6). A scene built
// as a thumbnail gets params.thumb = depth (1, 2, ...): at depth >= 1 it must not load its prevStill, and C0 loads its
// flash stills only at depth < 2, so the recursion is bounded.
const mods = import.meta.glob<{ default: SceneClass }>('./c*.ts');
const cache = new Map<string, Promise<HTMLCanvasElement | null>>();
let toSrgb: FSPass | null = null;

/** Chapter window by the timeline rule (C0 from 0; others 0.4 s before their first word, to the next one's start). */
export function chapterWindow(id: string) {
  const i = CH.findIndex((c) => c.id === id);
  const c = CH[i]!;
  return { start: i === 0 ? 0 : c.start - 0.4, end: i + 1 < CH.length ? CH[i + 1]!.start - 0.4 : c.end + 4, title: c.title };
}

/** One frame of chapter `id` (e.g. 'C3') at song time t, as an sRGB canvas `w` px wide (16:9). Null if that chapter
 *  has no scene module yet or fails. Rendered once (cached); call from build()/init, never per frame. */
export function chapterFrame(ctx: SceneCtx, id: string, t: number, w = 960): Promise<HTMLCanvasElement | null> {
  const key = `${id}@${t.toFixed(3)}@${w}`;
  let p = cache.get(key);
  if (!p) { p = renderFrame(ctx, id, t, w).catch((e) => { console.warn(`[filmstrip] chapterFrame ${key}`, e); return null; }); cache.set(key, p); }
  return p;
}

async function renderFrame(ctx: SceneCtx, id: string, t: number, w: number): Promise<HTMLCanvasElement | null> {
  const n = id.replace(/^C/i, '').toLowerCase();
  const ld = mods[`./c${n}.ts`];
  if (!ld) return null;
  const win = chapterWindow(id.toUpperCase());
  const Cls = (await ld()).default;
  const depth = (+ctx.params?.thumb || 0) + 1;
  const sc = new Cls({ ...ctx, id: `c${n}`, params: { title: win.title, fig: `CH. ${n}`, thumb: depth }, start: win.start, end: win.end });
  await sc.init();
  const h = Math.round((w * 9) / 16);
  const r = ctx.renderer;
  const hdr = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: true });
  const ldr = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false });
  const prev = r.getRenderTarget(), q = qa.scene;
  qa.scene = null; // its text is a picture here, not this chapter's layout
  try {
    const f = {
      t, dt: 0, lt: t - win.start, p: (t - win.start) / (win.end - win.start), start: win.start, end: win.end,
      seeked: true, preroll: false, beat: 0, bar: 0, beatPhase: 0, barPhase: 0, a: {} as any, under: null, tin: 1, tout: 0,
    } as unknown as Frame;
    sc.render(f, hdr);
    toSrgb ??= new FSPass(/* glsl */ `uniform sampler2D src; void main() { fragColor = vec4(toSRGB(clamp(texture(src, vUv).rgb, 0.0, 1.0)), 1.0); }`, { src: { value: null } });
    toSrgb.u.src!.value = hdr.texture;
    toSrgb.render(r, ldr);
    const buf = new Uint8Array(w * h * 4);
    r.readRenderTargetPixels(ldr, 0, 0, w, h, buf);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4); // GL rows are bottom-up
    g.putImageData(img, 0, 0);
    return cv;
  } finally {
    qa.scene = q;
    r.setRenderTarget(prev);
    hdr.dispose(); ldr.dispose();
    sc.dispose();
  }
}

/** Draw a chapter frame into a rect, or a dark empty frame while that chapter is not built. */
export function drawFrame(c: CanvasRenderingContext2D, img: HTMLCanvasElement | null | undefined, x: number, y: number, w: number, h: number, a = 1) {
  if (a <= 0.001) return;
  c.save(); c.globalAlpha *= a;
  if (img) c.drawImage(img, x, y, w, h);
  else { c.fillStyle = rgba('ink2', 1); c.fillRect(x, y, w, h); }
  c.restore();
}
