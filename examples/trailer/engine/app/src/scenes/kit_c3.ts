// C3 private kit (P vs NP): the sudoku grids, the stopwatch, the search tree and the cards. Pure functions of t; no other chapter imports this file.
import { W, H, rgba, clamp, lerp, ease, tw, font, F, txt, stamp, type SC } from './_shots';

// ================================================================== the sudoku
/** a valid filled grid (shifted-row pattern) */
export const SUD = (r: number, k: number) => ((r * 3 + Math.floor(r / 3) + k) % 9) + 1;
/** the puzzle's givens (the rest are empty squares) */
const GIVEN = new Set([1, 5, 9, 12, 16, 20, 22, 27, 31, 35, 40, 44, 46, 49, 53, 58, 60, 64, 67, 71, 75, 79]);
export const isGiven = (r: number, k: number) => GIVEN.has(r * 9 + k);
/** the first empty squares in reading order: the search tries them one level at a time */
export const EMPTY: [number, number][] = [];
for (let i = 0; i < 81 && EMPTY.length < 9; i++) if (!GIVEN.has(i)) EMPTY.push([Math.floor(i / 9), i % 9]);

export const GREEN = '#7FB08A'; // "checked": muted, never glows

export interface GridOpt {
  /** filled (all digits) or the puzzle (givens only) */
  filled: boolean;
  /** rows ticked green, 0..9 (fractional: the row in progress) */
  rows?: number;
  /** empty squares being tried (amber outline, cycling digit), how many and how far */
  lit?: number;
  /** digit size factor (0 hides digits) */
  digits?: number;
}
/** A 9x9 sudoku at (x, y), s px wide. */
export function grid(o: SC, x: number, y: number, s: number, a: number, g: GridOpt) {
  if (a <= 0.001) return;
  const c = o.c, sg = o.s, cs = s / 9, rows = g.rows ?? 0, da = g.digits ?? 1;
  c.save(); c.globalAlpha *= clamp(a);
  c.fillStyle = rgba('ink2', 0.92); c.fillRect(x, y, s, s);
  for (let r = 0; r < 9; r++) {
    const p = clamp(rows - r);
    if (p > 0) { c.fillStyle = rgba(GREEN, 0.24 * p); c.fillRect(x, y + r * cs, s * p, cs); }
  }
  c.strokeStyle = rgba('ash', 0.42); c.lineWidth = 1; c.beginPath();
  for (let i = 0; i <= 9; i++) { c.moveTo(x + i * cs, y); c.lineTo(x + i * cs, y + s); c.moveTo(x, y + i * cs); c.lineTo(x + s, y + i * cs); }
  c.stroke();
  c.strokeStyle = rgba('bone', 0.75); c.lineWidth = Math.max(1.4, s / 180); c.beginPath();
  for (let i = 0; i <= 9; i += 3) { c.moveTo(x + i * cs, y); c.lineTo(x + i * cs, y + s); c.moveTo(x, y + i * cs); c.lineTo(x + s, y + i * cs); }
  c.stroke();
  if (da > 0.01) {
    const fs = Math.round(cs * 0.62 * da);
    c.font = font(F.mono(500), fs); c.textAlign = 'center'; c.textBaseline = 'middle'; c.letterSpacing = '0px';
    for (let r = 0; r < 9; r++) for (let k = 0; k < 9; k++) {
      if (!g.filled && !isGiven(r, k)) continue;
      const done = clamp(rows - r) >= 1;
      c.fillStyle = done ? rgba(GREEN, 0.98) : g.filled ? rgba('bone', 0.85) : rgba('ash', 0.9);
      c.fillText(String(SUD(r, k)), x + (k + 0.5) * cs, y + (r + 0.54) * cs);
    }
  }
  c.restore();
  // squares being tried: amber outline; the newest cycles through digits (deterministic in t)
  const lit = g.lit ?? 0;
  if (lit > 0.001) {
    sg.save(); sg.globalAlpha *= clamp(a);
    const nFull = Math.min(EMPTY.length, Math.ceil(lit));
    for (let i = 0; i < nFull; i++) {
      const [r, k] = EMPTY[i]!, p = clamp(lit - i);
      const newest = i === nFull - 1;
      sg.strokeStyle = rgba('signal', newest ? 0.95 : 0.55); sg.lineWidth = Math.max(1.5, cs * 0.07);
      sg.strokeRect(x + k * cs + 2, y + r * cs + 2, cs - 4, cs - 4);
      if (da > 0.01 && p > 0.05) {
        const d = newest ? 1 + (Math.floor(o.t * 9 + i * 3) % 9) : SUD(r, k);
        sg.font = font(F.mono(600), Math.round(cs * 0.62 * da)); sg.textAlign = 'center'; sg.textBaseline = 'middle';
        sg.fillStyle = rgba('signal', newest ? 0.95 : 0.6);
        sg.fillText(String(d), x + (k + 0.5) * cs, y + (r + 0.54) * cs);
      }
    }
    sg.restore();
  }
}
/** World centre of empty square i of a grid at (x, y, s). */
export const emptyAt = (i: number, x: number, y: number, s: number) => {
  const [r, k] = EMPTY[Math.min(i, EMPTY.length - 1)]!;
  return [x + (k + 0.5) * (s / 9), y + (r + 0.5) * (s / 9)] as const;
};

// ================================================================== the stopwatch
/** A stopwatch at (x, y), radius r; `sweep` turns of the hand; readout text to its right. */
export function stopwatch(c: CanvasRenderingContext2D, x: number, y: number, r: number, sweep: number, a: number, read: string, readA: number, readCol: string) {
  if (a <= 0.001) return;
  c.save(); c.globalAlpha *= clamp(a);
  c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 3;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 4; c.beginPath(); c.moveTo(x, y - r); c.lineTo(x, y - r - 12); c.stroke();
  c.fillStyle = rgba('bone', 0.8); c.fillRect(x - 10, y - r - 20, 20, 7);
  c.strokeStyle = rgba('ash', 0.7); c.lineWidth = 2; c.beginPath();
  for (let i = 0; i < 12; i++) {
    const an = (i / 12) * Math.PI * 2;
    c.moveTo(x + Math.sin(an) * r * 0.82, y - Math.cos(an) * r * 0.82); c.lineTo(x + Math.sin(an) * r * 0.94, y - Math.cos(an) * r * 0.94);
  }
  c.stroke();
  const an = sweep * Math.PI * 2;
  c.strokeStyle = rgba('bone', 0.95); c.lineWidth = 3.5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(an) * r * 0.78, y - Math.cos(an) * r * 0.78); c.stroke();
  c.fillStyle = rgba('bone', 1); c.beginPath(); c.arc(x, y, 4.5, 0, Math.PI * 2); c.fill();
  c.restore();
  if (readA > 0.001) {
    c.save(); c.globalAlpha *= clamp(a * readA);
    txt(c, read, x + r + 26, y + 26, { size: 76, f: F.archivo(100, 700), col: readCol });
    c.restore();
  }
}

// ================================================================== the search tree
/** Ternary search tree: hairline edges, the newest level (the frontier) in amber on the signal layer. */
export function tree(c: CanvasRenderingContext2D, s: CanvasRenderingContext2D, rx: number, ry: number, span: number, gap: number, depth: number, a: number, burst: number, B = 3) {
  if (a <= 0.001 || depth <= 0) return;
  const full = Math.floor(depth), frac = depth - full;
  const maxD = Math.min(9, full + 1);
  const vis = (x: number) => x > -60 && x < W + 60;
  let prev: number[] = [rx];
  c.save(); s.save(); c.globalAlpha *= a; s.globalAlpha *= a;
  for (let d = 1; d <= maxD; d++) {
    const p = d <= full ? 1 : frac;
    if (p <= 0) break;
    const y0 = ry + (d - 1) * gap, y1 = ry + d * gap;
    if (y0 > H + 40) break;
    const w = span / B ** d;
    const cur: number[] = [];
    const alpha = lerp(0.6, 0.18, clamp((d - 1) / 6)) * lerp(1, 0.75, burst);
    c.strokeStyle = rgba('ash', alpha); c.lineWidth = d > 5 ? 0.8 : d > 3 ? 1.2 : 2;
    c.beginPath();
    prev.forEach((xp, i) => {
      for (let k = 0; k < B; k++) {
        const xc = rx - span / 2 + (i * B + k + 0.5) * w;
        cur.push(xc);
        if (!vis(xp) && !vis(xc)) continue;
        c.moveTo(xp, y0); c.lineTo(lerp(xp, xc, p), lerp(y0, y1, p));
      }
    });
    c.stroke();
    const front = d === maxD || (d === full && frac < 0.05);
    const r = Math.max(1.4, Math.min(9, w * 0.18));
    const ctx = front ? s : c;
    // dense levels thin out (no solid amber bar where thousands of nodes touch)
    const dens = clamp(w / 14, 0.07, 1);
    ctx.fillStyle = front ? rgba('signal', 0.95 * dens) : rgba('ash', alpha * 1.3 * dens);
    ctx.beginPath();
    cur.forEach((xc, j) => {
      if (!vis(xc)) return;
      const xx = lerp(prev[Math.floor(j / B)] ?? xc, xc, p), yy = lerp(y0, y1, p);
      ctx.moveTo(xx + r, yy); ctx.arc(xx, yy, r, 0, Math.PI * 2);
    });
    ctx.fill();
    prev = cur;
  }
  s.fillStyle = rgba('signal', 1); s.beginPath(); s.arc(rx, ry, 9, 0, Math.PI * 2); s.fill();
  c.restore(); s.restore();
}

// ================================================================== cards
/** the $1,000,000 Millennium Prize card (amber number on the signal layer), centred at (cx, cy), scale k */
export function prize(c: CanvasRenderingContext2D, s: CanvasRenderingContext2D, cx: number, cy: number, k: number, a: number) {
  if (a <= 0.001) return;
  const w = 900, h = 400;
  for (const ctx of [c, s]) { ctx.save(); ctx.globalAlpha *= clamp(a); ctx.translate(cx, cy); ctx.scale(k, k); }
  c.fillStyle = rgba('ink2', 0.95); c.fillRect(-w / 2, -h / 2, w, h);
  c.strokeStyle = rgba('bone', 0.55); c.lineWidth = 1.5; c.strokeRect(-w / 2, -h / 2, w, h);
  c.strokeStyle = rgba('bone', 0.22); c.lineWidth = 1; c.strokeRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24);
  txt(c, 'MILLENNIUM PRIZE', 0, -h / 2 + 84, { size: 44, f: F.mono(600), col: rgba('bone', 0.92), align: 'center', ls: 6 });
  txt(s, '$1,000,000', 0, 72, { size: 172, f: F.archivo(100, 800), col: rgba('signal', 1), align: 'center' });
  txt(c, 'for a proof of P vs NP, either way', 0, h / 2 - 46, { size: 44, f: F.serif(500, true), col: rgba('ash', 0.95), align: 'center' });
  c.restore(); s.restore();
}

/** An AI-result card at (x, y), w x h, stamped NOT P VS NP with progress `st` (big, on a dark slip). */
export function aiCard(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number, head: string, sub: string, yr: string, st: number) {
  if (a <= 0.001) return;
  c.save(); c.globalAlpha *= clamp(a);
  c.fillStyle = rgba('ink2', 0.96); c.fillRect(x, y, w, h);
  c.strokeStyle = rgba('bone', 0.5); c.lineWidth = 1.5; c.strokeRect(x, y, w, h);
  txt(c, head, x + 30, y + 86, { size: 68, f: F.archivo(100, 700), col: rgba('bone', 0.97) });
  txt(c, sub, x + 30, y + 152, { size: 42, f: F.serif(500, true), col: rgba('bone', 0.88) });
  txt(c, yr, x + 30, y + 208, { size: 38, f: F.mono(500), col: rgba('ash', 0.95), ls: 2 });
  c.restore();
  if (st > 0) {
    c.save(); c.globalAlpha *= clamp(st * 2.5) * clamp(a); c.fillStyle = rgba('ink', 0.9);
    c.fillRect(x + 20, y + h - 136, w - 40, 110); c.restore();
  }
  stamp(c, 'NOT P VS NP', x + w / 2, y + h - 81, st * clamp(a), rgba('ochre', 1), 58, -0.04);
}

/** A right-hand curly brace from (x, y0) to (x, y1), hairline, drawn to p. */
export function brace(c: CanvasRenderingContext2D, x: number, y0: number, y1: number, p: number, colr: string, d = 26) {
  if (p <= 0.001) return;
  const ym = (y0 + y1) / 2;
  c.save(); c.strokeStyle = colr; c.lineWidth = 3; c.lineCap = 'round';
  const path = new Path2D();
  path.moveTo(x, y0); path.quadraticCurveTo(x + d, y0, x + d, y0 + d);
  path.lineTo(x + d, ym - d); path.quadraticCurveTo(x + d, ym, x + 2 * d, ym);
  path.quadraticCurveTo(x + d, ym, x + d, ym + d); path.lineTo(x + d, y1 - d); path.quadraticCurveTo(x + d, y1, x, y1);
  const len = (y1 - y0) + 4 * d;
  c.setLineDash([len * clamp(p), len * 2]);
  c.stroke(path);
  c.restore();
}

export { ease, tw };
