// The shot system (generic kit). A chapter scene is a list of shots on one moving camera; shots crossfade, and the
// plate crossfades between ink and bone paper. Every cue is looked up from the narration (data/lyrics.json via
// ctx.lyrics) by line id and word, never hard-coded: `this.q.w(lineId, word)` = start of that word.
// Also here: type helpers, stamps/leaders/cards, a real-paper-page viewer with highlighter sweeps, and the
// reference-art loaders (engraved vectors, tinted public-domain rasters).
// Extracted from the source project's per-episode kits; scenes import from here (or from _devices.ts).
import type * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { W, H } from '../engine/gl';
import { clamp, ease, lerp } from '../engine/util';
import { rgba, F, font, PlateBG, Layers, figHeader, tw, type P2, Polyline } from './_kit';
import { loadRef, engrave, defaultStyle, type Engraved, type RefShape, type EngraveStyle } from './_refart';
import { HEX as HEXC_ } from '../engine/palette';
const HEXC = HEXC_ as unknown as Record<string, string>;

export { W, H, clamp, ease, lerp, rgba, F, font, tw };
export type { P2 };

// ------------------------------------------------------------------ cues
/** Word normaliser for cue lookup (any script's letters and digits; same rule as scripts/qa.ts). */
export const normW = (s: string) => s.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}¿?\-]/gu, '');

export class Cues {
  constructor(private ly: { lines: any[] }) {}
  line(id: string) {
    const l = this.ly.lines.find((x) => x.id === id);
    if (!l) throw new Error('line not found ' + id);
    return l as { start: number; end: number; words: { w: string; start: number; end: number }[] };
  }
  /** start of the nth word in line `id` that starts with `q` */
  w(id: string, q: string, nth = 0): number { return this.word(id, q, nth).start; }
  /** end of that word */
  e(id: string, q: string, nth = 0): number { return this.word(id, q, nth).end; }
  word(id: string, q: string, nth = 0) {
    const nq = normW(q);
    const hits = this.line(id).words.filter((x) => normW(x.w).startsWith(nq));
    const x = hits[nth];
    if (!x) throw new Error(`word not found: ${id} "${q}" #${nth}`);
    return x;
  }
  s(id: string) { return this.line(id).start; }
  end(id: string) { return this.line(id).end; }
}

// ------------------------------------------------------------------ camera
export interface Cam { x: number; y: number; z: number }
export type CamKey = [t: number, x: number, y: number, z: number, e?: (x: number) => number];
/** Interpolated camera (log zoom, screen-stable pan) through keys. World = screen px at z = 1. */
export function camAt(keys: CamKey[], t: number): Cam {
  const k0 = keys[0]!;
  if (t <= k0[0]) return { x: k0[1], y: k0[2], z: k0[3] };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!, b = keys[i + 1]!;
    if (t <= b[0]) {
      const u = (b[4] ?? ease.inOutCubic)(clamp((t - a[0]) / Math.max(1e-4, b[0] - a[0])));
      const z = Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), u));
      return { x: lerp(a[1], b[1], u), y: lerp(a[2], b[2], u), z };
    }
  }
  const kl = keys[keys.length - 1]!;
  return { x: kl[1], y: kl[2], z: kl[3] };
}

/** Handheld drift: a few screen px, always moving. */
export const drift = (cam: Cam, t: number): Cam =>
  ({ x: cam.x + (Math.sin(t * 0.53) * 5 + Math.sin(t * 1.31) * 2) / cam.z, y: cam.y + (Math.cos(t * 0.41) * 4) / cam.z, z: cam.z * (1 + Math.sin(t * 0.37) * 0.004) });

// ------------------------------------------------------------------ shots
export interface SC {
  c: CanvasRenderingContext2D; s: CanvasRenderingContext2D;
  t: number; a: number; cam: Cam; paper: boolean;
  /** foreground colour key for this plate */
  fg: string;
}
export interface Shot {
  t0: number; t1: number; paper: 0 | 1;
  fi?: number; fo?: number;
  cam?: CamKey[];
  /** world-space drawing (camera applied) */
  draw?: (o: SC) => void;
  /** screen-space drawing (headers, lower-thirds) */
  hud?: (o: SC) => void;
}

export abstract class ShotScene extends Scene {
  bg = new PlateBG();
  L = new Layers();
  shots: Shot[] = [];
  q!: Cues;
  abstract build(): Promise<void> | void;
  override async init() {
    this.q = new Cues(this.ctx.lyrics as any);
    await this.build();
  }
  /** Drawn into `out` over the plate and under the ink/signal layers (e.g. a ManimLayer, see _manim.ts). */
  protected underlay(_t: number, _out: THREE.WebGLRenderTarget, _cam: Cam): void {}
  alphaOf(sh: Shot, t: number) {
    const fi = sh.fi ?? 0.35, fo = sh.fo ?? 0.35;
    if (t < sh.t0 - fi || t > sh.t1 + fo) return 0;
    return Math.min(clamp((t - (sh.t0 - fi)) / fi), clamp((sh.t1 + fo - t) / fo));
  }
  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    const act = this.shots.map((sh) => ({ sh, a: this.alphaOf(sh, t) })).filter((x) => x.a > 0.001);
    let pw = 0, ps = 0;
    for (const x of act) { pw += x.a; ps += x.a * x.sh.paper; }
    const paper = pw > 0 ? ps / pw : 0;
    const main = act.reduce((b, x) => (x.a > (b?.a ?? -1) ? x : b), act[0]);
    const mc = main?.sh.cam ? camAt(main.sh.cam, t) : { x: W / 2, y: H / 2, z: 1 };
    this.bg.render(renderer, out, paper, t, mc.x * mc.z * 0.06, mc.y * mc.z * 0.06);
    this.underlay(t, out, drift(mc, t));
    this.L.clear();
    const c = this.L.ink.ctx, s = this.L.sig.ctx;
    for (const { sh, a } of act) {
      let cam = sh.cam ? camAt(sh.cam, t) : { x: W / 2, y: H / 2, z: 1 };
      cam = drift(cam, t);
      const o: SC = { c, s, t, a, cam, paper: sh.paper === 1, fg: sh.paper ? 'ink' : 'bone' };
      const set = (ctx: CanvasRenderingContext2D) => ctx.setTransform(cam.z, 0, 0, cam.z, W / 2 - cam.x * cam.z, H / 2 - cam.y * cam.z);
      if (sh.draw) {
        c.save(); s.save(); set(c); set(s);
        c.globalAlpha = a; s.globalAlpha = a;
        sh.draw(o);
        c.restore(); s.restore();
      }
      if (sh.hud) {
        c.save(); s.save(); c.setTransform(1, 0, 0, 1, 0, 0); s.setTransform(1, 0, 0, 1, 0, 0);
        c.globalAlpha = a; s.globalAlpha = a;
        sh.hud(o);
        c.restore(); s.restore();
      }
    }
    this.L.composite(renderer, comp, out, paper, true);
    return {
      paper: paper > 0.5 ? 1 : 0,
      bloom: lerp(0.75, 0.25, paper), bloomThreshold: 0.9,
      vignette: lerp(0.42, 0.25, paper), grain: lerp(0.04, 0.035, paper), halation: lerp(0.12, 0, paper), ca: lerp(0.6, 0.3, paper),
    } as any;
  }
}

// ------------------------------------------------------------------ colours
export const col = (o: SC, a = 1) => rgba(o.fg, a);

// ------------------------------------------------------------------ type helpers
export function txt(c: CanvasRenderingContext2D, s: string, x: number, y: number, o: { size?: number; f?: string; col?: string; align?: CanvasTextAlign; ls?: number; base?: CanvasTextBaseline; p?: number } = {}) {
  const p = o.p ?? 1;
  if (p <= 0) return 0;
  c.save();
  c.font = font(o.f ?? F.mono(500), o.size ?? 17);
  c.letterSpacing = `${o.ls ?? 0}px`;
  c.textAlign = o.align ?? 'left';
  c.textBaseline = o.base ?? 'alphabetic';
  c.fillStyle = o.col ?? rgba('bone', 0.9);
  const n = p >= 1 ? s.length : Math.ceil(s.length * p);
  c.fillText(s.slice(0, n), x, y);
  const w = c.measureText(s).width;
  c.restore();
  return w;
}
export const mono = (w = 500) => F.mono(w);
export const serifI = (w = 600) => F.serif(w, true);
export const serif = (w = 600) => F.serif(w, false);
export const sans = (w = 700) => F.archivo(100, w);

/** big number that counts/slams: returns scale-in factor */
export function slam(t: number, t0: number, d = 0.25) { return tw(t, t0 - 0.05, t0 + d, ease.outCubic); }

/** a rubber stamp: framed upper-case word, rotated, scaling in from 1.4× */
export function stamp(c: CanvasRenderingContext2D, s: string, x: number, y: number, p: number, colr: string, size = 34, rot = -0.08) {
  if (p <= 0) return;
  const k = 1 + 0.5 * (1 - ease.outCubic(clamp(p)));
  c.save();
  c.translate(x, y); c.rotate(rot); c.scale(k, k);
  c.globalAlpha *= clamp(p * 2.5);
  c.font = font(F.mono(700), size); c.letterSpacing = '4px';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  const w = c.measureText(s).width + 34, h = size * 1.6;
  c.strokeStyle = colr; c.lineWidth = 3;
  c.strokeRect(-w / 2, -h / 2, w, h);
  c.lineWidth = 1; c.strokeRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
  c.fillStyle = colr; c.fillText(s, 2, 2);
  c.restore();
}

/** hand-drawn cross-out (two strokes) */
export function crossOut(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: number, colr: string, lw = 4) {
  if (p <= 0) return;
  c.save(); c.strokeStyle = colr; c.lineWidth = lw; c.lineCap = 'round';
  const a = clamp(p * 2), b = clamp(p * 2 - 1);
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * a, y + h * a); c.stroke();
  if (b > 0) { c.beginPath(); c.moveTo(x + w, y); c.lineTo(x + w - w * b, y + h * b); c.stroke(); }
  c.restore();
}

/** a leader-line label in world space: dot at (ax, ay), elbow to (ax+dx, ay+dy), text */
export function lead(c: CanvasRenderingContext2D, ax: number, ay: number, dx: number, dy: number, s: string, p: number, colr: string, size = 18, sub?: string) {
  if (p <= 0.001) return;
  const lp = clamp(p * 1.6), tp = clamp(p * 1.6 - 0.6);
  const ex = ax + dx, ey = ay + dy;
  c.save();
  c.strokeStyle = colr; c.fillStyle = colr; c.lineWidth = 1.1;
  new Polyline([[ax, ay], [ax + dx * 0.55, ey], [ex, ey]]).draw(c, lp);
  c.beginPath(); c.arc(ax, ay, 2.8, 0, Math.PI * 2); c.fill();
  if (tp > 0) {
    const right = dx >= 0;
    c.globalAlpha *= clamp(tp * 3);
    txt(c, s, ex + (right ? 10 : -10), ey + 6, { size, col: colr, align: right ? 'left' : 'right', p: tp, f: F.mono(500), ls: 1 });
    if (sub) txt(c, sub, ex + (right ? 10 : -10), ey + 6 + size + 4, { size: size - 4, col: colr, align: right ? 'left' : 'right', f: F.mono(400) });
  }
  c.restore();
}

/** hairline box */
export function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colr: string, lw = 1) {
  c.save(); c.strokeStyle = colr; c.lineWidth = lw; c.strokeRect(x + 0.5, y + 0.5, w, h); c.restore();
}

/** a white card with a soft shadow (bone paper plates) */
export function card(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a = 1, rot = 0) {
  c.save();
  c.translate(x + w / 2, y + h / 2); c.rotate(rot);
  c.globalAlpha *= a;
  c.shadowColor = rgba('ink', 0.2); c.shadowBlur = 22; c.shadowOffsetY = 6;
  c.fillStyle = rgba('bone', 1); c.fillRect(-w / 2, -h / 2, w, h);
  c.shadowColor = 'transparent';
  c.strokeStyle = rgba('ink', 0.45); c.lineWidth = 1; c.strokeRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20);
  c.restore();
}

/** screen-space figure header (FIG. n · TITLE) */
export function hdr(o: SC, fig: string, title: string, a = 1) { figHeader(o.c, fig, title, a, o.paper); }

// ------------------------------------------------------------------ instruments
/** dial gauge (0..1 needle) with a labelled arc */
export function gauge(c: CanvasRenderingContext2D, x: number, y: number, r: number, v: number, colr: string, label: string, ticks: string[] = [], band?: [number, number], bandCol?: string) {
  const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
  const A = (u: number) => lerp(a0, a1, u);
  c.save();
  c.strokeStyle = colr; c.fillStyle = colr; c.lineWidth = 1.2;
  if (band) { c.strokeStyle = bandCol ?? colr; c.lineWidth = 8; c.globalAlpha *= 0.35; c.beginPath(); c.arc(x, y, r - 8, A(band[0]), A(band[1])); c.stroke(); c.globalAlpha /= 0.35; c.strokeStyle = colr; }
  c.lineWidth = 1.4;
  c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke();
  for (let i = 0; i <= 20; i++) {
    const a = A(i / 20), l = i % 5 === 0 ? 14 : 7;
    c.lineWidth = i % 5 === 0 ? 1.5 : 1;
    c.beginPath(); c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.lineTo(x + Math.cos(a) * (r - l), y + Math.sin(a) * (r - l)); c.stroke();
  }
  ticks.forEach((tk, i) => {
    const a = A(i / Math.max(1, ticks.length - 1));
    txt(c, tk, x + Math.cos(a) * (r + 22), y + Math.sin(a) * (r + 22) + 5, { size: 13, col: colr, align: 'center', f: F.mono(400) });
  });
  const na = A(clamp(v));
  c.lineWidth = 2.4;
  c.beginPath(); c.moveTo(x - Math.cos(na) * 10, y - Math.sin(na) * 10); c.lineTo(x + Math.cos(na) * (r - 18), y + Math.sin(na) * (r - 18)); c.stroke();
  c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill();
  txt(c, label, x, y + r * 0.62, { size: 15, col: colr, align: 'center', ls: 2, f: F.mono(600) });
  c.restore();
}

// ------------------------------------------------------------------ real paper pages
/** A verbatim quote on a page: `lines` = [x, y, w, h] boxes in page px (measured with `pdftotext -bbox`); `tr` = its translation. */
export interface PaperQuote { id: string; page: number; text: string; lines: number[][]; tr?: string; note?: string }
export interface PaperEntry { citation: string; license: string; oa: string; pages: { img: string; w: number; h: number }[]; quotes: PaperQuote[] }
/** Where the paper-page index lives (public/papers/quotes.json by default; see docs/WORKFLOW.md "Real paper pages"). */
export const PAPERS_INDEX = { url: 'papers/quotes.json' };
let QUOTES: Promise<Record<string, PaperEntry>> | null = null;
export function loadQuotes() {
  if (!QUOTES) QUOTES = fetch(PAPERS_INDEX.url).then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : {})).catch(() => ({}));
  return QUOTES;
}
const IMG = new Map<string, Promise<HTMLImageElement>>();
export function loadImg(u: string) {
  let p = IMG.get(u);
  if (!p) { p = (async () => { const im = new Image(); im.src = u; await im.decode(); return im; })(); IMG.set(u, p); }
  return p;
}

/** A real paper page in a window: page camera keys, graphite highlighter sweeps on verbatim quote boxes. */
export class PaperView {
  imgs: HTMLImageElement[] = [];
  gap = 90;
  constructor(public key: string, public e: PaperEntry) {}
  static async load(key: string) {
    const all = await loadQuotes();
    const e = all[key];
    if (!e) return null;
    const v = new PaperView(key, e);
    v.imgs = await Promise.all(e.pages.map((p) => loadImg(p.img)));
    return v;
  }
  q(id: string) { const x = this.e.quotes.find((k) => k.id === id); if (!x) throw new Error(`quote ${this.key}/${id}`); return x; }
  pageY(i: number) { let y = 0; for (let k = 0; k < i; k++) y += this.e.pages[k]!.h + this.gap; return y; }
  /** union box (strip px) of a quote */
  ubox(id: string): [number, number, number, number] {
    const qq = this.q(id), oy = this.pageY(qq.page);
    const xs = qq.lines.map((l) => l[0]!), ys = qq.lines.map((l) => l[1]!), xe = qq.lines.map((l) => l[0]! + l[2]!), ye = qq.lines.map((l) => l[1]! + l[3]!);
    return [Math.min(...xs), Math.min(...ys) + oy, Math.max(...xe) - Math.min(...xs), Math.max(...ye) - Math.min(...ys)];
  }
  /** focus key on a quote: [t, cx, cy, scale] so the quote's union box spans `fill` of the window width */
  focus(t: number, id: string, winW: number, fill = 0.8, dy = 0): [number, number, number, number] {
    const [x, y, w, h] = this.ubox(id);
    return [t, x + w / 2, y + h / 2 + dy, Math.min(1.2, (winW * fill) / Math.max(200, w))];
  }
  draw(c: CanvasRenderingContext2D, t: number, o: { win: [number, number, number, number]; keys: [number, number, number, number][]; hi: { id: string; t0: number; t1: number; under?: boolean }[]; a?: number; slide?: number }) {
    const [wx, wy, ww, wh] = o.win;
    const keys = o.keys;
    let fx = keys[0]![1], fy = keys[0]![2], sc = keys[0]![3];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i]!, b = keys[i + 1]!;
      if (t >= a[0]) {
        const u = ease.inOutCubic(clamp((t - a[0]) / Math.max(1e-3, b[0] - a[0])));
        fx = lerp(a[1], b[1], u); fy = lerp(a[2], b[2], u); sc = Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), u));
      }
    }
    const slide = o.slide ?? 1;
    c.save();
    c.globalAlpha *= o.a ?? 1;
    const m = c.getTransform();
    c.fillStyle = rgba('ink', 0.06); c.fillRect(wx, wy, ww, wh);
    c.beginPath(); c.rect(wx, wy, ww, wh); c.clip();
    const ox = wx + ww / 2 + (1 - slide) * (ww + 200), oy = wy + wh / 2;
    c.transform(sc, 0, 0, sc, ox - fx * sc, oy - fy * sc);
    c.imageSmoothingQuality = 'high';
    this.e.pages.forEach((p, i) => {
      const y = this.pageY(i);
      c.shadowColor = rgba('ink', 0.22); c.shadowBlur = 30; c.shadowOffsetY = 10;
      c.fillStyle = '#ffffff'; c.fillRect(0, y, p.w, p.h);
      c.shadowColor = 'transparent';
      c.drawImage(this.imgs[i]!, 0, y, p.w, p.h);
    });
    for (const h of o.hi) {
      const p = clamp((t - h.t0) / Math.max(0.05, h.t1 - h.t0));
      if (p <= 0) continue;
      const qq = this.q(h.id), oy2 = this.pageY(qq.page);
      const total = qq.lines.reduce((s2, b) => s2 + b[2]!, 0);
      let left = total * ease.inOutQuad(p);
      c.save();
      if (h.under) {
        c.fillStyle = rgba('ink', 0.85);
        for (const [x, y, bw, bh] of qq.lines) { const w2 = Math.min(bw!, left); left -= w2; if (w2 <= 0) break; c.fillRect(x!, y! + oy2 + bh! + 4, w2, 5); }
      } else {
        c.globalCompositeOperation = 'multiply';
        c.fillStyle = 'rgba(118,110,98,0.62)';
        for (const [x, y, bw, bh] of qq.lines) { const w2 = Math.min(bw!, left); left -= w2; if (w2 <= 0) break; c.fillRect(x! - 6, y! - 6 + oy2, w2 + 12, bh! + 12); }
      }
      c.restore();
    }
    c.restore();
    c.save(); c.setTransform(m);
    c.globalAlpha *= o.a ?? 1;
    c.strokeStyle = rgba('ink', 0.45); c.lineWidth = 1; c.strokeRect(wx + 0.5, wy + 0.5, ww, wh);
    c.restore();
  }
}

/** citation lower-third on ink (screen or world space) */
export function citeBar(c: CanvasRenderingContext2D, x: number, y: number, w: number, head: string, l1: string, l2: string | null, a: number) {
  if (a <= 0) return;
  c.save();
  c.globalAlpha *= a;
  c.fillStyle = rgba('ink', 0.94); c.fillRect(x, y, w, l2 ? 80 : 60);
  txt(c, head, x + 22, y + 26, { size: 15, f: F.mono(600), ls: 2, col: rgba('bone', 1) });
  txt(c, l1, x + 22, y + 48, { size: 14, f: F.mono(400), col: rgba('bone', 0.78) });
  if (l2) txt(c, l2, x + 22, y + 68, { size: 13, f: F.mono(400), col: rgba('bone', 0.6) });
  c.restore();
}

/** wrap text to a width; returns lines */
export function wrap(c: CanvasRenderingContext2D, s: string, f: string, size: number, maxW: number): string[] {
  c.save(); c.font = font(f, size);
  const out: string[] = []; let cur = '';
  for (const w of s.split(' ')) {
    const tryS = cur ? cur + ' ' + w : w;
    if (c.measureText(tryS).width > maxW && cur) { out.push(cur); cur = w; } else cur = tryS;
  }
  if (cur) out.push(cur);
  c.restore();
  return out;
}

export { Polyline };

// ------------------------------------------------------------------ reference art (engraved)
export { loadRef, engrave, defaultStyle };
export type { Engraved, RefShape, EngraveStyle };

/** Engraving for bone-paper plates: ink outlines and ink hatching (dark = dense), bone base. */
export function paperStyle(strength = 1, edge = 0.75, tint = 'ink') {
  return (s: RefShape, i: number): EngraveStyle => {
    if (!s.fill) return { outline: s.stroke ? rgba(tint, 0.6 * strength) : null, lw: 0.8, hatch: null, base: null };
    const L = s.lum ?? 1;
    return {
      base: rgba('bone', 1),
      outline: L < edge ? rgba(tint, Math.min(1, (0.45 + 0.4 * (1 - L)) * strength)) : rgba(tint, 0.35 * strength),
      lw: 0.8,
      hatch: L > 0.93 ? null : rgba(tint, Math.min(1, (0.18 + 0.5 * (1 - L)) * strength)),
      gap: 2.2 + 7 * Math.pow(L, 1.4),
      angle: 0.78 + ((i * 37) % 5) * 0.06,
    };
  };
}

/** Load + engrave a ref (null if the file is missing), rendered `targetW` canvas px wide. */
export async function refArt(name: string, targetW: number, style?: (s: RefShape, i: number) => EngraveStyle, crop?: number[]): Promise<Engraved | null> {
  try {
    const r = await loadRef(name);
    const cw = (crop ?? r.viewBox)[2]!;
    return engrave(r, { px: targetW / cw, style: style ?? defaultStyle('bone', 1), crop });
  } catch (e) { console.warn('ref missing', name, e); return null; }
}

/** A public-domain raster engraving (white paper, dark lines) as tinted line art: alpha = darkness. */
export async function rasterArt(url: string, crop: [number, number, number, number] | null, tint: string, gamma = 0.9): Promise<HTMLCanvasElement | null> {
  try {
    const im = await loadImg(url);
    const [x, y, w, h] = crop ?? [0, 0, im.naturalWidth, im.naturalHeight];
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const c = cv.getContext('2d')!;
    c.drawImage(im, x, y, w, h, 0, 0, w, h);
    const d = c.getImageData(0, 0, w, h), p = d.data;
    const n = parseInt((HEXC[tint] ?? tint).replace('#', ''), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    for (let i = 0; i < p.length; i += 4) {
      const L = (0.299 * p[i]! + 0.587 * p[i + 1]! + 0.114 * p[i + 2]!) / 255;
      p[i] = r; p[i + 1] = g; p[i + 2] = b; p[i + 3] = Math.round(255 * Math.pow(clamp((1 - L) * 1.15), gamma));
    }
    c.putImageData(d, 0, 0);
    return cv;
  } catch (e) { console.warn('raster missing', url, e); return null; }
}

/** Draw an engraved plate centred at (x, y), `w` world units wide. */
export function drawArt(c: CanvasRenderingContext2D, e: Engraved | HTMLCanvasElement | null | undefined, x: number, y: number, w: number) {
  if (!e) return;
  const cv = e instanceof HTMLCanvasElement ? e : e.canvas;
  const h = (w * cv.height) / cv.width;
  c.drawImage(cv, x - w / 2, y - h / 2, w, h);
}

// ------------------------------------------------------------------ paper segments
export interface PSeq { id: string; t0: number; t1: number; under?: boolean; fill?: number }
/** Page camera: whole-page-width view at tIn, then a push to each quote shortly before its highlight. Missing quote ids are skipped. */
export function paperKeys(v: PaperView, tIn: number, win: [number, number, number, number], seq: PSeq[], tOut: number): [number, number, number, number][] {
  const pw = v.e.pages[0]!.w;
  const keys: [number, number, number, number][] = [[tIn - 0.5, pw / 2, 700, (win[2] / pw) * 0.98]];
  const ok = seq.filter((s) => v.e.quotes.some((q) => q.id === s.id));
  ok.forEach((s, i) => {
    const k = v.focus(Math.max(keys[keys.length - 1]![0] + 0.35, s.t0 - 0.35), s.id, win[2], s.fill ?? 0.86);
    keys.push(k);
    const nx = ok[i + 1];
    const hold = Math.min(nx ? nx.t0 - 0.4 : tOut, s.t1 + 1.5);
    if (hold > k[0] + 0.1) keys.push([hold, k[1] + 30, k[2] + 6, k[3] * 1.04]);
  });
  keys.push([tOut + 0.6, keys[keys.length - 1]![1] + 20, keys[keys.length - 1]![2] + 10, keys[keys.length - 1]![3] * 1.03]);
  return keys;
}
export function hasQ(v: PaperView | null, id: string) { return !!v && v.e.quotes.some((q) => q.id === id); }

/** Typeset citation card (used when no legal page image exists): never a facsimile. */
export function typeCard(c: CanvasRenderingContext2D, x: number, y: number, w: number, lines: { s: string; size: number; f: string; a?: number }[], note: string, a: number, rot = -0.006) {
  if (a <= 0) return;
  let h = 70; for (const l of lines) h += l.size * 1.35; h += 50;
  card(c, x, y, w, h, a, rot);
  c.save(); c.globalAlpha *= a; c.translate(x + w / 2, y + h / 2); c.rotate(rot); c.translate(-w / 2, -h / 2);
  let yy = 60;
  for (const l of lines) { for (const ln of wrap(c, l.s, l.f, l.size, w - 100)) { yy += l.size * 1.2; txt(c, ln, 50, yy, { size: l.size, f: l.f, col: rgba('ink', l.a ?? 0.9) }); } yy += l.size * 0.25; }
  txt(c, note, w - 40, h - 26, { size: 12, f: F.mono(500), ls: 1, align: 'right', col: rgba('ink', 0.45) });
  c.restore();
}

/** split a citation string for the lower-third */
export function citeLines(e: PaperEntry): [string, string] {
  return [e.citation.slice(0, 118), (e.license ?? '').slice(0, 118)];
}
