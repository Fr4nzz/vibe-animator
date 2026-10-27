// Recurring on-screen devices (generic kit), on top of _shots.ts: the type scale (docs/STYLE_GUIDE.md), serif/mono
// statement helpers, a figure kicker, the Shorts-safe square, a translation panel with its minimum hold, rich text
// with *bold* spans, the four warning buckets (docs/TONE.md) as tags and card sheets, numbered protocol cards,
// arrows, bars, dials and a graphite highlighter. Everything is a pure function of time.
// On-screen words live in LABELS so an episode in another language changes them in one place.
import { hatch } from './_kit';
import {
  txt, wrap, Polyline, camAt, W, H, clamp, ease, lerp, rgba, F, font, tw,
  type SC, type CamKey, type P2,
} from './_shots';

export const PI2 = Math.PI * 2;
export const fgc = (o: SC, a = 1) => rgba(o.fg, a);
/** square-safe area for vertical Shorts (x 420–1500), content kept above the caption band (y < ~900) */
export const SQ = { x0: 420, x1: 1500, y0: 0, y1: 900 };

/** On-screen words used by the devices. Override per episode, e.g. `LABELS.translation = 'TRADUCCIÓN'`. */
export const LABELS = {
  translation: 'TRANSLATION',
  schematic: 'SCHEMATIC',
  buckets: {
    contra: 'CONTRAINDICATED',
    monitor: 'REQUIRES MONITORING',
    under: 'UNDER-STUDIED',
    impl: 'IMPLEMENTATION ERROR',
    fact: 'EVIDENCE',
  } as Record<Bucket, string>,
};

// ------------------------------------------------------------------ type scale, screen px at camera z = 1
/** H: key number / headline ≥ 96 · S: serif statement ≥ 44 · L: diagram label ≥ 30 · A: annotation / kicker / citation ≥ 24
 *  TR: translation panel ≥ 40 · CB/CT: protocol card body ≥ 36 / title ≥ 56 */
export const T = { H: 104, S: 50, S2: 56, L: 32, A: 24, TR: 42, CB: 38, CT: 60 };
const ser = (w = 600) => F.serif(w, true);
/** serif statement (italic), one line */
export function say(c: CanvasRenderingContext2D, s: string, x: number, y: number, a: number, colr: string, size = T.S, align: CanvasTextAlign = 'center', w = 600) {
  if (a <= 0.001) return 0;
  return txt(c, s, x, y, { size, f: ser(w), align, col: colr.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * clamp(a)})`) });
}
/** mono diagram label (≥ 30 px) */
export function lab(c: CanvasRenderingContext2D, s: string, x: number, y: number, a: number, colr: string, size = T.L, align: CanvasTextAlign = 'left', w = 600, ls = 1) {
  if (a <= 0.001) return 0;
  c.save(); c.globalAlpha *= clamp(a);
  const r = txt(c, s, x, y, { size, f: F.mono(w), align, ls, col: colr });
  c.restore();
  return r;
}
/** sans statement (Archivo) */
export function sansT(c: CanvasRenderingContext2D, s: string, x: number, y: number, a: number, colr: string, size = 40, align: CanvasTextAlign = 'left', w = 500) {
  if (a <= 0.001) return 0;
  c.save(); c.globalAlpha *= clamp(a);
  const r = txt(c, s, x, y, { size, f: F.archivo(100, w), align, col: colr });
  c.restore();
  return r;
}
/** plain caption-style qualifier, said once where it matters ("in mice", "in cells") */
export function species(c: CanvasRenderingContext2D, s: string, x: number, y: number, a: number, colr: string, align: CanvasTextAlign = 'left') {
  if (a <= 0.001) return;
  c.save(); c.globalAlpha *= clamp(a);
  txt(c, s, x, y, { size: 42, f: F.serif(500, true), align, col: colr });
  c.restore();
}
/** "SCHEMATIC" (uniform, small, low contrast) for schematic drawings a viewer could mistake for data */
export function schematic(c: CanvasRenderingContext2D, x: number, y: number, a: number, paper: boolean, align: CanvasTextAlign = 'right', label = LABELS.schematic) {
  if (a <= 0.001) return;
  txt(c, label, x, y, { size: T.A, f: F.mono(500), ls: 3, align, col: rgba(paper ? 'ink' : 'bone', 0.45 * clamp(a)) });
}

/** figure kicker (FIG. n · TITLE), 24 px, inside the Shorts square by default */
export function fig2(c: CanvasRenderingContext2D, fig: string, title: string, a: number, ink = false, x = 432, y = 78) {
  // Crossfade-safe: a header shows only while its shot is more than half visible, so the outgoing and incoming FIG
  // headers never overlap into garbled text.
  const A = clamp((c.globalAlpha * clamp(a) - 0.5) * 2);
  if (A <= 0.001) return;
  c.save(); c.globalAlpha = A;
  const col = ink ? 'ink' : 'bone';
  c.font = font(F.mono(600), T.A); c.letterSpacing = '3px'; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  c.fillStyle = rgba(col, 0.95); c.fillText(fig, x, y);
  const fw = c.measureText(fig).width;
  c.font = font(F.mono(400), T.A); c.letterSpacing = '1.5px';
  c.fillStyle = rgba(col, 0.66); c.fillText(title, x + fw + 22, y);
  c.fillStyle = rgba(col, 0.35); c.fillRect(x, y + 16, 640 * clamp(a * 1.3), 1);
  c.restore();
}


// ------------------------------------------------------------------ translation panel
/** minimum hold (s) for a translation panel (docs/STYLE_GUIDE.md): max(4, 0.33 × words + 1.5) */
export const holdFor = (es: string) => Math.max(4, 0.33 * es.split(/\s+/).filter(Boolean).length + 1.5);
/** height of a translation panel for a given text and width */
export function panelH(c: CanvasRenderingContext2D, es: string, w: number, size = T.TR) {
  const lines = wrap(c, es, F.serif(500, false), size, w - 84);
  return 96 + lines.length * size * 1.2;
}
/** Large translation card on bone paper; fully set (no typewriter); optional leader to (lx, ly). */
export function transPanel(c: CanvasRenderingContext2D, x: number, y: number, w: number, es: string, p: number, o: { size?: number; lx?: number; ly?: number; label?: string } = {}) {
  if (p <= 0.001) return 0;
  const size = o.size ?? T.TR;
  const lines = wrap(c, es, F.serif(500, false), size, w - 84);
  const h = 96 + lines.length * size * 1.2;
  const e = ease.outCubic(clamp(p));
  const yy = y + (1 - e) * 26;
  c.save(); c.globalAlpha *= clamp(p * 1.6);
  if (o.lx != null && o.ly != null) {
    c.strokeStyle = rgba('ink', 0.7); c.lineWidth = 1.4;
    const ax = x, ay = clamp(o.ly, yy + 30, yy + h - 30);
    c.beginPath(); c.moveTo(o.lx, o.ly); c.lineTo(ax, ay); c.stroke();
    c.fillStyle = rgba('ink', 0.85); c.beginPath(); c.arc(o.lx, o.ly, 4.5, 0, PI2); c.fill();
  }
  c.shadowColor = rgba('ink', 0.28); c.shadowBlur = 28; c.shadowOffsetY = 8;
  c.fillStyle = '#F2EDE3'; c.fillRect(x, yy, w, h);
  c.shadowColor = 'transparent';
  c.strokeStyle = rgba('ink', 0.55); c.lineWidth = 1; c.strokeRect(x + 10.5, yy + 10.5, w - 21, h - 21);
  txt(c, o.label ?? LABELS.translation, x + 42, yy + 56, { size: T.A, f: F.mono(700), ls: 5, col: rgba('ink', 0.62) });
  c.fillStyle = rgba('ink', 0.25); c.fillRect(x + 42, yy + 70, 180, 1);
  lines.forEach((ln, i) => txt(c, ln, x + 42, yy + 72 + (i + 0.95) * size * 1.2, { size, f: F.serif(500, false), col: rgba('ink', 0.95) }));
  c.restore();
  return h;
}


// ------------------------------------------------------------------ rich text (*bold* spans)
export const RUBRIC = '#8E2A1E'; // printed rubric red (non-glowing), reserved for the contraindicated bucket

/** Rich-text tokens: *bold* segments. */
interface Tok { s: string; b: boolean }
function toks(text: string): Tok[] {
  const out: Tok[] = [];
  let bold = false;
  for (const part of text.split(/(\*)/)) {
    if (part === '*') { bold = !bold; continue; }
    for (const w of part.split(/(\s+)/)) if (w && !/^\s+$/.test(w)) out.push({ s: w, b: bold });
  }
  return out;
}

export interface TextStyle { size: number; lh?: number; fam?: string; famB?: string; color?: string; colorB?: string; ls?: number }

/** Wrap rich text to lines of at most `maxW` px. Returns tokens with x offsets. */
export function layoutText(c: CanvasRenderingContext2D, text: string, maxW: number, st: TextStyle) {
  const fam = st.fam ?? F.archivo(100, 400), famB = st.famB ?? F.archivo(100, 700);
  const lines: { s: string; b: boolean; x: number; w: number }[][] = [[]];
  c.font = font(fam, st.size);
  const sp = c.measureText(' ').width;
  let x = 0;
  for (const tk of toks(text)) {
    c.font = font(tk.b ? famB : fam, st.size);
    const w = c.measureText(tk.s).width;
    if (x > 0 && /^[,.;:!?)]/.test(tk.s)) x -= sp; // punctuation after an emphasised span: no space
    if (x > 0 && x + w > maxW) { lines.push([]); x = 0; }
    lines[lines.length - 1]!.push({ ...tk, x, w });
    x += w + sp;
  }
  return lines;
}

/** Draw wrapped rich text. `p` reveals characters left to right (0..1). Returns the height used. */
export function drawText(c: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, st: TextStyle, p = 1, align: 'left' | 'center' = 'left') {
  const lh = st.lh ?? st.size * 1.28;
  const fam = st.fam ?? F.archivo(100, 400), famB = st.famB ?? F.archivo(100, 700);
  const lines = layoutText(c, text, maxW, st);
  const total = lines.reduce((s, l) => s + l.reduce((s2, tk) => s2 + tk.s.length + 1, 0), 0);
  let left = Math.ceil(total * clamp(p));
  c.save();
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  c.letterSpacing = `${st.ls ?? 0}px`;
  lines.forEach((ln, i) => {
    const lw = ln.length ? ln[ln.length - 1]!.x + ln[ln.length - 1]!.w : 0;
    const ox = align === 'center' ? x - lw / 2 : x;
    for (const tk of ln) {
      if (left <= 0) break;
      const n = Math.min(tk.s.length, left);
      left -= tk.s.length + 1;
      c.font = font(tk.b ? famB : fam, st.size);
      c.fillStyle = tk.b ? (st.colorB ?? st.color ?? rgba('ink', 0.95)) : (st.color ?? rgba('ink', 0.9));
      c.fillText(tk.s.slice(0, n), ox + tk.x, y + i * lh);
    }
  });
  c.restore();
  return lines.length * lh;
}

export function textHeight(c: CanvasRenderingContext2D, text: string, maxW: number, st: TextStyle) {
  return layoutText(c, text, maxW, st).length * (st.lh ?? st.size * 1.28);
}


/** Typewriter mono text revealed between t0 and t1. */
export function typed(c: CanvasRenderingContext2D, s: string, x: number, y: number, t: number, t0: number, t1: number) {
  const n = Math.floor(s.length * clamp((t - t0) / Math.max(0.05, t1 - t0)));
  if (n > 0) c.fillText(s.slice(0, n), x, y);
}


// ------------------------------------------------------------------ the four buckets (docs/TONE.md)
/** contra = contraindicated · monitor = requires monitoring · under = under-studied (not the same as dangerous) ·
 *  impl = implementation error · fact = plain evidence tag */
export type Bucket = 'contra' | 'monitor' | 'under' | 'impl' | 'fact';
export const BUCKET_LABEL = LABELS.buckets;

/** A bucket tag (paper plates). Returns its width. */
export function bucketTag(c: CanvasRenderingContext2D, kind: Bucket, x: number, y: number, a: number, text?: string, size = 16) {
  if (a <= 0.001) return 0;
  const s = text ?? BUCKET_LABEL[kind];
  c.save();
  c.globalAlpha *= a;
  c.font = font(F.mono(600), size); c.letterSpacing = '2.5px'; c.textBaseline = 'middle'; c.textAlign = 'left';
  const w = c.measureText(s).width + 28, h = size * 2.1;
  const ink = rgba('ink', 0.9);
  if (kind === 'contra') {
    c.fillStyle = RUBRIC; c.fillRect(x, y - h / 2, w, h);
    c.fillStyle = rgba('bone', 1); c.fillText(s, x + 14, y + 1);
  } else if (kind === 'monitor') {
    c.strokeStyle = ink; c.lineWidth = 1.6; c.strokeRect(x + 0.5, y - h / 2 + 0.5, w, h);
    c.fillStyle = ink; c.fillText(s, x + 14, y + 1);
    // a tiny gauge mark
  } else if (kind === 'under') {
    c.strokeStyle = ink; c.lineWidth = 1.4; c.setLineDash([5, 4]); c.strokeRect(x + 0.5, y - h / 2 + 0.5, w, h); c.setLineDash([]);
    c.fillStyle = ink; c.fillText(s, x + 14, y + 1);
  } else if (kind === 'impl') {
    const p = new Path2D(); p.rect(x, y - h / 2, w, h);
    c.fillStyle = rgba('bone', 1); c.fill(p);
    hatch(c, p, [x, y - h / 2, x + w, y + h / 2], 6, -0.8, 0.8, rgba('ink', 0.16));
    c.strokeStyle = ink; c.lineWidth = 1.2; c.strokeRect(x + 0.5, y - h / 2 + 0.5, w, h);
    c.fillStyle = rgba('bone', 1); c.fillRect(x + 8, y - size * 0.62, w - 16, size * 1.24);
    c.fillStyle = ink; c.fillText(s, x + 14, y + 1);
  } else {
    c.fillStyle = rgba('ink', 0.88); c.fillRect(x, y - h / 2, w, h);
    c.fillStyle = rgba('bone', 1); c.fillText(s, x + 14, y + 1);
  }
  c.restore();
  return w;
}

/** A typeset paper card (sheet with a soft shadow, hairline frame). `kind` sets the border weight. */
export function cardSheet(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number, kind: Bucket | 'plain' = 'plain') {
  if (a <= 0.001) return;
  c.save();
  c.globalAlpha *= a;
  c.shadowColor = rgba('ink', 0.16); c.shadowBlur = 26; c.shadowOffsetY = 8;
  c.fillStyle = '#F4EFE6'; c.fillRect(x, y, w, h);
  c.shadowColor = 'transparent';
  if (kind === 'contra') {
    c.strokeStyle = RUBRIC; c.lineWidth = 5; c.strokeRect(x + 10, y + 10, w - 20, h - 20);
    c.lineWidth = 1.2; c.strokeRect(x + 20, y + 20, w - 40, h - 40);
  } else {
    c.strokeStyle = rgba('ink', 0.55); c.lineWidth = 1; c.strokeRect(x + 12.5, y + 12.5, w - 25, h - 25);
    if (kind === 'under') { c.setLineDash([6, 5]); c.strokeRect(x + 18.5, y + 18.5, w - 37, h - 37); c.setLineDash([]); }
  }
  c.restore();
}

/** Strike-through drawn across a span (ink pen), p 0..1. */
export function strike(c: CanvasRenderingContext2D, x0: number, y: number, x1: number, p: number, color = rgba('ink', 0.9), lw = 3) {
  if (p <= 0) return;
  c.save();
  c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x0, y + 2); c.lineTo(lerp(x0, x1, p), y - 2 * p); c.stroke();
  c.restore();
}

/** Graphite highlighter sweep over boxes (x, y, w, h) in the current transform. */
export function highlight(c: CanvasRenderingContext2D, boxes: number[][], p: number, pad = 6, col = 'rgba(118,110,98,0.55)') {
  if (p <= 0) return;
  const total = boxes.reduce((s, b) => s + b[2]!, 0);
  let left = total * ease.inOutQuad(clamp(p));
  c.save();
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = col;
  for (const [x, y, bw, bh] of boxes) {
    const ww = Math.min(bw!, left); left -= ww;
    if (ww <= 0) break;
    c.fillRect(x! - pad, y! - pad, ww + 2 * pad, bh! + 2 * pad);
  }
  c.restore();
}

// ------------------------------------------------------------------ small glyphs and charts
/** an arrow along points, drawn to p */
export function arrow(c: CanvasRenderingContext2D, pts: P2[], p: number, colr: string, lw = 1.6, head = 12) {
  if (p <= 0.001) return;
  const pl = new Polyline(pts);
  c.save(); c.strokeStyle = colr; c.fillStyle = colr; c.lineWidth = lw; c.lineCap = 'round';
  pl.draw(c, p);
  const s = pl.total * clamp(p), q = pl.at(s), q0 = pl.at(Math.max(0, s - 4));
  const an = Math.atan2(q[1] - q0[1], q[0] - q0[0]);
  if (p > 0.05) { c.beginPath(); c.moveTo(q[0], q[1]); c.lineTo(q[0] - Math.cos(an - 0.4) * head, q[1] - Math.sin(an - 0.4) * head); c.lineTo(q[0] - Math.cos(an + 0.4) * head, q[1] - Math.sin(an + 0.4) * head); c.closePath(); c.fill(); }
  c.restore();
}
/** horizontal bar with label + value, grows with p */
export function hbar(c: CanvasRenderingContext2D, x: number, y: number, len: number, h: number, p: number, fill: string, stroke: string, label: string, value: string, labCol: string) {
  if (p <= 0.001) return;
  c.save(); c.globalAlpha *= clamp(p * 3);
  c.fillStyle = fill; c.fillRect(x, y, len * ease.outCubic(clamp(p)), h);
  c.strokeStyle = stroke; c.lineWidth = 1.2; c.strokeRect(x + 0.5, y + 0.5, len * ease.outCubic(clamp(p)), h);
  txt(c, label, x, y - 14, { size: T.L, f: F.mono(600), ls: 1, col: labCol });
  txt(c, value, x + len * ease.outCubic(clamp(p)) + 16, y + h / 2 + 14, { size: 44, f: F.archivo(100, 700), col: labCol });
  c.restore();
}
/** hairline dial 0..1 with an optional hatched zone [z0, z1] */
export function dial(c: CanvasRenderingContext2D, x: number, y: number, r: number, v: number, colr: string, label: string, zone?: [number, number], zoneLab?: string, ticks?: [string, string]) {
  const a0 = Math.PI * 0.85, a1 = Math.PI * 2.15, A = (u: number) => lerp(a0, a1, u);
  c.save(); c.strokeStyle = colr; c.fillStyle = colr; c.lineWidth = 1.5;
  if (zone) {
    const p = new Path2D(); p.arc(x, y, r, A(zone[0]), A(zone[1])); p.arc(x, y, r - 30, A(zone[1]), A(zone[0]), true); p.closePath();
    hatch(c, p, [x - r, y - r, x + r, y + r], 5, -0.8, 1, colr); c.stroke(p);
    if (zoneLab) { const am = A((zone[0] + zone[1]) / 2); txt(c, zoneLab, x + Math.cos(am) * (r + 26), y + Math.sin(am) * (r + 26), { size: T.L, f: F.mono(600), ls: 1, col: colr, align: Math.cos(am) > 0 ? 'left' : 'right' }); }
  }
  c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke();
  for (let i = 0; i <= 20; i++) { const an = A(i / 20), L = i % 5 ? 8 : 15; c.lineWidth = i % 5 ? 1 : 1.5; c.beginPath(); c.moveTo(x + Math.cos(an) * r, y + Math.sin(an) * r); c.lineTo(x + Math.cos(an) * (r - L), y + Math.sin(an) * (r - L)); c.stroke(); }
  if (ticks) { txt(c, ticks[0], x + Math.cos(a0) * (r + 10), y + Math.sin(a0) * (r + 10) + 34, { size: T.A + 4, f: F.mono(500), col: colr, align: 'center' }); txt(c, ticks[1], x + Math.cos(a1) * (r + 10), y + Math.sin(a1) * (r + 10) + 34, { size: T.A + 4, f: F.mono(500), col: colr, align: 'center' }); }
  const na = A(clamp(v));
  c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - Math.cos(na) * 14, y - Math.sin(na) * 14); c.lineTo(x + Math.cos(na) * (r - 22), y + Math.sin(na) * (r - 22)); c.stroke();
  c.beginPath(); c.arc(x, y, 7, 0, PI2); c.fill();
  txt(c, label, x, y + r * 0.6, { size: T.L, f: F.mono(600), ls: 2, col: colr, align: 'center' });
  c.restore();
}

/** points along a quadratic curve from a to b with bend */
export function curve(a: P2, b: P2, bend = 0.25, n = 24): P2[] {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const nx = -(b[1] - a[1]) * bend, ny = (b[0] - a[0]) * bend;
  const out: P2[] = [];
  for (let i = 0; i <= n; i++) { const u = i / n; const x = (1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * (mx + nx) + u * u * b[0]; const y = (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * (my + ny) + u * u * b[1]; out.push([x, y]); }
  return out;
}

/** camera key helper: K(t, x, y, z[, ease]) */
export const K = (t: number, x: number, y: number, z: number, e?: (u: number) => number): CamKey => [t, x, y, z, e];

// ------------------------------------------------------------------ protocol cards, numbered "n / N"
export interface PBullet { text: string; t: number }
export interface PCard {
  n: string; kind: Bucket | 'plain';
  tags: { kind: Bucket; text?: string; t: number }[];
  title: string; titleT: number;
  bullets: PBullet[];
  foot?: string;
  icons?: (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) => void;
  appear: number;
  bsize?: number; tsize?: number; iconW?: number;
}
/** card sheet: 1400 × 780 world px; at camera z = 1 it spans x 260–1660, y ≈ 115–895 (above the captions) */
export const PCW = 1400, PCH = 780, ICON_W = 360;
/** a protocol card centred at (cx, cy) (world units); complete sentences revealed on their words */
export function protocolCard(c: CanvasRenderingContext2D, s: PCard, cx: number, cy: number, t: number) {
  const a = tw(t, s.appear, s.appear + 0.45);
  if (a <= 0.001) return;
  const x0 = cx - PCW / 2, y0 = cy - PCH / 2 + (1 - a) * 30;
  cardSheet(c, x0, y0, PCW, PCH, a, s.kind === 'plain' ? 'plain' : s.kind);
  c.save(); c.globalAlpha *= a;
  let tx = x0 + 52;
  for (const tg of s.tags) {
    const p = tw(t, tg.t - 0.12, tg.t + 0.2, ease.outCubic);
    tx += bucketTag(c, tg.kind, tx, y0 + 74, p, tg.text, T.A) + 16;
  }
  txt(c, s.n, x0 + PCW - 52, y0 + 84, { size: 30, f: F.mono(600), ls: 3, align: 'right', col: rgba('ink', 0.62) });
  let y = y0 + 186;
  const tp = tw(t, s.titleT - 0.12, s.titleT + 0.35);
  const ts = s.tsize ?? T.CT;
  c.save(); c.globalAlpha *= tp;
  const th = drawText(c, s.title, x0 + 52, y, PCW - 104, { size: ts, lh: Math.round(ts * 1.12), fam: F.archivo(100, 700), color: rgba('ink', 0.95) }, 1);
  c.restore();
  y += th - ts * 0.72;
  c.fillStyle = rgba('ink', 0.35); c.fillRect(x0 + 52, y, (PCW - 104) * tp, 1.2);
  y += 62;
  const IW = s.iconW ?? ICON_W;
  const bz = s.bsize ?? T.CB, bw = s.icons ? PCW - 104 - 48 - IW - 30 : PCW - 104 - 48;
  const bst = { size: bz, lh: Math.round(bz * 1.24), color: rgba('ink', 0.88), colorB: rgba('ink', 1) };
  s.bullets.forEach((b, i) => {
    const p = tw(t, b.t - 0.12, b.t + 0.18, ease.outCubic);
    const h = textHeight(c, b.text, bw, bst);
    if (p > 0) {
      c.save(); c.globalAlpha *= p;
      c.font = font(F.mono(600), 26); c.fillStyle = s.kind === 'contra' && i === 0 ? RUBRIC : rgba('ink', 0.7); c.textBaseline = 'alphabetic';
      c.fillText(String(i + 1).padStart(2, '0'), x0 + 52, y + 1);
      drawText(c, b.text, x0 + 100 + (1 - p) * 8, y, bw, bst, 1);
      c.restore();
    }
    y += h + 18;
  });
  if (s.icons) s.icons(c, x0 + PCW - 52 - IW, y0 + 240, IW, PCH - 300, t);
  txt(c, s.foot ?? '', x0 + 52, y0 + PCH - 40, { size: T.A, f: F.mono(400), ls: 0.5, col: rgba('ink', 0.55 * tw(t, s.titleT, s.titleT + 0.5)) });
  c.restore();
}


export { camAt, W, H, Polyline };
