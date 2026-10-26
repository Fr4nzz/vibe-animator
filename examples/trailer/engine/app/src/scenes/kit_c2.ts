// C2's private kit (trailer v2): the watercolour courtyard and washed pieces (carried over from v1 c2.ts), and the
// small drawing helpers of the goal-first completing-the-square plate. Owned by the C2 builder; nobody else imports it.
import { W, clamp, rgba, F, txt } from './_shots';

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
}

/** The courtyard wash (an arcade of pointed arches, a floor band, warm blotches), painted once. */
export function courtyard(): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = 1080;
  const c = cv.getContext('2d')!;
  const r = rng(29);
  for (let i = 0; i < 16; i++) {
    const x = r() * W, y = r() * 1080, rad = 200 + r() * 380;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(205,164,99,${0.05 + r() * 0.05})`); g.addColorStop(1, 'rgba(205,164,99,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, 1080);
  }
  const arch = (cx: number, w: number, spring: number, apex: number, floor: number) => {
    const p = new Path2D(), hw = w / 2;
    p.moveTo(cx - hw, floor); p.lineTo(cx - hw, spring);
    p.quadraticCurveTo(cx - hw, apex + (spring - apex) * 0.25, cx, apex);
    p.quadraticCurveTo(cx + hw, apex + (spring - apex) * 0.25, cx + hw, spring);
    p.lineTo(cx + hw, floor); p.closePath();
    return p;
  };
  c.filter = 'blur(10px)';
  c.fillStyle = 'rgba(205,164,99,0.10)'; c.fillRect(-40, 90, W + 80, 700);
  for (let pass = 0; pass < 4; pass++) {
    for (const cx of [300, 760, 1160, 1620]) {
      c.save(); c.translate((r() - 0.5) * 12, (r() - 0.5) * 10);
      c.fillStyle = `rgba(127,151,166,${0.07 + r() * 0.03})`;
      c.fill(arch(cx, 330, 330, 150, 760));
      c.restore();
    }
  }
  c.filter = 'blur(1.6px)';
  c.strokeStyle = 'rgba(181,86,14,0.16)'; c.lineWidth = 3;
  for (const cx of [300, 760, 1160, 1620]) c.stroke(arch(cx, 330, 330, 150, 760));
  c.fillStyle = 'rgba(181,86,14,0.10)'; c.fillRect(-20, 96, W + 40, 6);
  c.filter = 'blur(14px)';
  c.fillStyle = 'rgba(168,149,156,0.12)'; c.fillRect(-40, 760, W + 80, 360);
  c.filter = 'none';
  return cv;
}

/** Part of a rectangle's perimeter (p 0..1), from the top-left corner clockwise. */
export function rectP(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: number) {
  if (p <= 0) return;
  const pts: [number, number][] = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  let left = 2 * (w + h) * clamp(p);
  c.beginPath(); c.moveTo(x, y);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const [ax, ay] = pts[i - 1]!, [bx, by] = pts[i]!;
    const L = Math.hypot(bx - ax, by - ay), u = Math.min(1, left / L);
    c.lineTo(ax + (bx - ax) * u, ay + (by - ay) * u); left -= L;
  }
  c.stroke();
}

export const INKC = (a: number) => rgba('ink', a);
export const SQ_FILL = 'rgba(142,154,174,0.30)', SQ_EDGE = 'rgba(142,154,174,0.55)'; // blue-grey wash (the square)
export const ST_FILL = 'rgba(168,149,156,0.30)', ST_EDGE = 'rgba(168,149,156,0.60)'; // rose-grey wash (the strip)

/** A washed piece: pigment fill with a pooled edge, and a clean ink outline drawn to p. */
export function piece(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, edge: string, fa: number, p: number, lw = 2.6) {
  if (fa > 0) {
    c.save(); c.globalAlpha *= clamp(fa);
    c.fillStyle = fill; c.fillRect(x, y, w, h);
    c.strokeStyle = edge; c.lineWidth = 7; c.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
    c.restore();
  }
  c.strokeStyle = INKC(0.85); c.lineWidth = lw; c.lineJoin = 'miter';
  rectP(c, x, y, w, h, p);
}

/** Dashed outline of a rectangle drawn to p (the target square). */
export function dashed(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, p: number, a: number, lw = 2.4, dash: [number, number] = [14, 10]) {
  if (a <= 0.001 || p <= 0) return;
  c.save(); c.setLineDash(dash); c.strokeStyle = INKC(a); c.lineWidth = lw; c.lineCap = 'butt';
  rectP(c, x, y, w, h, p); c.restore();
}

/** A bracket along one side (outside the shape), drawn to p. side 'r': vertical at x from y0 to y1; 'b': horizontal. */
export function bracket(c: CanvasRenderingContext2D, side: 'r' | 'b' | 'l', at: number, a0: number, a1: number, p: number, colr: string, lw = 2.2) {
  if (p <= 0.001) return;
  const e = a0 + (a1 - a0) * clamp(p), tick = 10;
  c.strokeStyle = colr; c.lineWidth = lw; c.beginPath();
  if (side === 'b') { c.moveTo(a0, at - tick); c.lineTo(a0, at); c.lineTo(e, at); c.lineTo(e, at - tick); }
  else { const d = side === 'r' ? -tick : tick; c.moveTo(at + d, a0); c.lineTo(at, a0); c.lineTo(at, e); c.lineTo(at + d, e); }
  c.stroke();
}

/** Sans number/label (Archivo), centred by default; `k` is the plate scale so the caller can keep sizes honest. */
export const num = (c: CanvasRenderingContext2D, s: string, x: number, y: number, a: number, size: number, colr = INKC(0.9), align: CanvasTextAlign = 'center', p = 1) =>
  a > 0.001 && txt(c, s, x, y, { size, f: F.archivo(100, 700), align, col: colr.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * clamp(a)})`), p });
/** Serif italic (Cormorant), for the letters of the "centuries later" beat and statements. */
export const ser = (c: CanvasRenderingContext2D, s: string, x: number, y: number, a: number, size: number, colr = INKC(0.9), align: CanvasTextAlign = 'center', p = 1) =>
  a > 0.001 && txt(c, s, x, y, { size, f: F.serif(600, true), align, col: colr.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * clamp(a)})`), p });
/** Mono label (Plex Mono). */
export const mon = (c: CanvasRenderingContext2D, s: string, x: number, y: number, a: number, size: number, colr = INKC(0.85), align: CanvasTextAlign = 'center', ls = 1) =>
  a > 0.001 && txt(c, s, x, y, { size, f: F.mono(500), align, ls, col: colr.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * clamp(a)})`) });

/** Quadratic bezier point. */
export const bez = (p: number, a: [number, number], k: [number, number], b: [number, number]): [number, number] =>
  [(1 - p) * (1 - p) * a[0] + 2 * (1 - p) * p * k[0] + p * p * b[0], (1 - p) * (1 - p) * a[1] + 2 * (1 - p) * p * k[1] + p * p * b[1]];
