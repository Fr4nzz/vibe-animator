// Shared drawing kit for the treatise plates: smooth paths, hatching, leader-line callouts,
// figure headers, scale bars, the plate backgrounds and a two-layer (ink + signal) compositor.
import * as THREE from 'three';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import type { Compositor } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, mulberry32 } from '../engine/util';

export type P2 = [number, number];
export const tw = (t: number, a: number, b: number, fn: (x: number) => number = ease.inOutCubic) => fn(clamp((t - a) / Math.max(1e-4, b - a)));
/** 0..1 visibility window with fades. */
export const win = (t: number, a: number, b: number, fi = 0.25, fo = 0.25) => Math.min(clamp((t - a) / fi), clamp((b - t) / fo));

/** Catmull-Rom spline through points as a canvas path (optionally closed). */
export function spline(c: CanvasRenderingContext2D | Path2D, pts: P2[], closed = false, tension = 0.5) {
  const n = pts.length;
  if (n < 2) return;
  const P = (i: number) => (closed ? pts[(i + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!);
  c.moveTo(pts[0]![0], pts[0]![1]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const k = tension / 3;
    c.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k, p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k, p2[0], p2[1]);
  }
  if (closed) c.closePath();
}

export function splinePath(pts: P2[], closed = false, tension = 0.5) {
  const p = new Path2D();
  spline(p, pts, closed, tension);
  return p;
}

/** Polyline resampled along a Catmull-Rom spline (for flows and partial draws). */
export function sampleSpline(pts: P2[], perSeg = 16): P2[] {
  const n = pts.length, out: P2[] = [];
  const P = (i: number) => pts[Math.max(0, Math.min(n - 1, i))]!;
  for (let i = 0; i < n - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let j = 0; j < perSeg; j++) {
      const u = j / perSeg, u2 = u * u, u3 = u2 * u;
      const f = (a: number, b: number, c2: number, d: number) => 0.5 * (2 * b + (-a + c2) * u + (2 * a - 5 * b + 4 * c2 - d) * u2 + (-a + 3 * b - 3 * c2 + d) * u3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[n - 1]!);
  return out;
}

export class Polyline {
  L: number[] = [0];
  total = 0;
  constructor(public pts: P2[]) {
    for (let i = 1; i < pts.length; i++) {
      this.total += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
      this.L.push(this.total);
    }
  }
  at(s: number): P2 {
    s = clamp(s, 0, this.total);
    let lo = 0, hi = this.L.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (this.L[m]! <= s) lo = m; else hi = m; }
    const a = this.pts[lo]!, b = this.pts[hi]!, d = this.L[hi]! - this.L[lo]! || 1, k = (s - this.L[lo]!) / d;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  }
  /** Stroke the first fraction `p` of the line. */
  draw(c: CanvasRenderingContext2D, p = 1) {
    const s = this.total * clamp(p);
    c.beginPath();
    c.moveTo(this.pts[0]![0], this.pts[0]![1]);
    for (let i = 1; i < this.pts.length; i++) {
      if (this.L[i]! >= s) { const q = this.at(s); c.lineTo(q[0], q[1]); break; }
      c.lineTo(this.pts[i]![0], this.pts[i]![1]);
    }
    c.stroke();
  }
}

/** Parallel hatching inside a clip path. `gap` and `lw` are in the current units. */
export function hatch(c: CanvasRenderingContext2D, clip: Path2D, box: [number, number, number, number], gap: number, angle: number, lw: number, style: string) {
  c.save();
  c.clip(clip);
  c.strokeStyle = style;
  c.lineWidth = lw;
  const [x0, y0, x1, y1] = box;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  c.beginPath();
  for (let d = -R; d <= R; d += gap) {
    const px = cx - sa * d, py = cy + ca * d;
    c.moveTo(px - ca * R, py - sa * R);
    c.lineTo(px + ca * R, py + sa * R);
  }
  c.stroke();
  c.restore();
}

/** Seeded stipple dots inside a clip. */
export function stipple(c: CanvasRenderingContext2D, clip: Path2D, box: [number, number, number, number], n: number, r: number, style: string, seed = 1) {
  c.save();
  c.clip(clip);
  c.fillStyle = style;
  const rnd = mulberry32(seed);
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const x = box[0] + rnd() * (box[2] - box[0]), y = box[1] + rnd() * (box[3] - box[1]);
    c.moveTo(x + r, y);
    c.arc(x, y, r, 0, Math.PI * 2);
  }
  c.fill();
  c.restore();
}

export interface Callout {
  /** anchor (screen px) */
  ax: number; ay: number;
  /** label position offset from the anchor (screen px) */
  dx: number; dy: number;
  text: string;
  sub?: string;
  /** 0..1 reveal */
  p: number;
  color?: string;
  dim?: string;
  size?: number;
}

/** A mono callout: anchor dot, elbow leader line, label. Screen space. */
export function callout(c: CanvasRenderingContext2D, o: Callout) {
  if (o.p <= 0.001) return;
  const col = o.color ?? rgba('bone', 0.92);
  const lineP = clamp(o.p * 1.6), textP = clamp(o.p * 1.6 - 0.6);
  const ex = o.ax + o.dx, ey = o.ay + o.dy;
  const bend: P2 = [o.ax + o.dx * 0.55, ey];
  c.save();
  c.strokeStyle = o.dim ?? col;
  c.fillStyle = col;
  c.lineWidth = 1.1;
  c.globalAlpha *= 0.85;
  const pl = new Polyline([[o.ax, o.ay], bend, [ex, ey]]);
  pl.draw(c, lineP);
  c.globalAlpha /= 0.85;
  c.beginPath(); c.arc(o.ax, o.ay, 2.6, 0, Math.PI * 2); c.fill();
  if (textP > 0) {
    const sz = o.size ?? 17;
    c.font = font(F.mono(500), sz);
    c.letterSpacing = '1px';
    c.textBaseline = 'middle';
    const right = o.dx >= 0;
    c.textAlign = right ? 'left' : 'right';
    const n = Math.ceil(o.text.length * textP);
    c.globalAlpha *= clamp(textP * 3);
    c.fillText(o.text.slice(0, n), ex + (right ? 10 : -10), ey);
    if (o.sub) {
      c.font = font(F.mono(400), sz - 4);
      c.globalAlpha *= 0.7;
      c.fillText(o.sub, ex + (right ? 10 : -10), ey + sz + 2);
    }
  }
  c.restore();
}

/** Figure header: "FIG. 3" + title + hairline rule, top-left on the Swiss grid. `size` 24 px = the style-guide floor. */
export function figHeader(c: CanvasRenderingContext2D, fig: string, title: string, a: number, ink = false, x = 96, y = 82, size = 24) {
  // Crossfade-safe: shown only while its shot is more than half visible, so two FIG headers never overlap during a
  // crossfade.
  const A = clamp((c.globalAlpha * a - 0.5) * 2);
  if (A <= 0.001) return;
  c.save();
  c.globalAlpha = A;
  const col = ink ? 'ink' : 'bone';
  c.font = font(F.mono(600), size);
  c.letterSpacing = '3px';
  c.textBaseline = 'alphabetic';
  c.fillStyle = rgba(col, 0.95);
  c.fillText(fig, x, y);
  const fw = c.measureText(fig).width;
  c.font = font(F.mono(400), size);
  c.letterSpacing = '1.5px';
  c.fillStyle = rgba(col, 0.62);
  c.fillText(title, x + fw + 22, y);
  c.fillStyle = rgba(col, 0.35);
  c.fillRect(x, y + 14, 520 * clamp(a * 1.3), 1);
  c.restore();
}

/** Scale bar with end ticks and a mono label. */
export function scaleBar(c: CanvasRenderingContext2D, x: number, y: number, len: number, label: string, a: number, ink = false, size = 24) {
  if (a <= 0.001 || !isFinite(len) || len <= 0) return;
  c.save();
  c.globalAlpha *= a;
  const col = rgba(ink ? 'ink' : 'bone', 0.75);
  c.fillStyle = col;
  c.fillRect(x, y, len, 1.4);
  c.fillRect(x, y - 6, 1.4, 12);
  c.fillRect(x + len - 1.4, y - 6, 1.4, 12);
  c.font = font(F.mono(400), size);
  c.letterSpacing = '1px';
  c.textBaseline = 'alphabetic';
  c.fillText(label, x + len + 12, y + size * 0.36);
  c.restore();
}

/** Plate background: ink or bone paper with fibre and a faint Swiss grid; `paper` crossfades. */
export class PlateBG {
  pass = new FSPass(/* glsl */ `
    uniform float paper; uniform float t; uniform vec2 drift;
    void main() {
      vec2 px = FRAG_PX;
      float n = fbm(px * vec2(0.004, 0.02) + 3.1, 4) * 0.5 + snoise(px * 0.35) * 0.08;
      vec3 ink = C_INK + vec3(0.004) * n;
      vec3 bone = mix(C_BONE, C_ASH, 0.10 + 0.07 * n);
      // vignette toward the corners (paper darkens a little like a printed plate)
      vec2 q = vUv - 0.5; float v = dot(q, q);
      bone *= 1.0 - v * 0.35;
      // faint construction grid on paper (96 px modules) drifting with the camera
      vec2 g = mod(px + drift, 96.0);
      float line = max(pxLine(min(g.x, 96.0 - g.x), 0.0, 1.0), pxLine(min(g.y, 96.0 - g.y), 0.0, 1.0));
      bone = mix(bone, C_GRAPHITE, line * 0.07);
      ink = mix(ink, C_GRAPHITE, line * 0.035);
      fragColor = vec4(mix(ink, bone, paper), 1.0);
    }`, { paper: { value: 0 }, t: { value: 0 }, drift: { value: new THREE.Vector2() } });
  render(renderer: THREE.WebGLRenderer, out: THREE.WebGLRenderTarget, paper: number, t: number, dx = 0, dy = 0) {
    this.pass.u.paper!.value = paper;
    this.pass.u.t!.value = t;
    (this.pass.u.drift!.value as THREE.Vector2).set(dx, dy);
    this.pass.render(renderer, out);
  }
}

/** Ink layer (lines, type) + signal layer (amber: the protagonist only, pushed into HDR so only it blooms). */
export class Layers {
  ink = new Layer2D();
  sig = new Layer2D();
  clear() { this.ink.clear(); this.sig.clear(); }
  composite(renderer: THREE.WebGLRenderer, comp: Compositor, out: THREE.WebGLRenderTarget, paper = 0, sigUsed = true) {
    comp.draw(renderer, this.ink.upload(), out);
    if (sigUsed) comp.draw(renderer, this.sig.upload(), out, paper > 0.5 ? {} : { tint: [1.9, 1.9, 1.9] });
  }
}

export const W2 = W / 2, H2 = H / 2;
export { rgba, F, font };
