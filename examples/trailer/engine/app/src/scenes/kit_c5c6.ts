// Private kit for C5 (how it's made, cutting room) and C6 (reel, epicycles, logo, end card). Owner: the C5/C6 builder.
//
// - chapterFrame(): renders a frame of ANOTHER chapter of this trailer (its own scene module, at a fixed time) into a
//   canvas, once, in init. Every strip frame, timeline tile and phone Short in C5/C6 comes from here, so nothing on
//   screen is footage from anywhere else. A scene built with params.thumb = true must not load thumbnails itself.
// - film strip: the shared `trailer_filmstrip_kit.ts` (C0 builder), drawn through an extra transform (stripAt).
// - the vibe-animator mark: one closed curve (a play triangle whose back edge is a wave), its DFT for the epicycles.
// - generic phone, tape splicer, light table: schematic objects drawn in code (no platform UI, no logos).
import { clamp, ease, lerp, rgba, F, font, type SC } from './_shots';
import {
  STRIP, drawStrip, pullBack, pushIn, slideOn, outro, intro, chapterFrame, chapterWindow, drawFrame, type StripOpt,
} from './trailer_filmstrip_kit';

// ------------------------------------------------------------------ frames of this trailer's own chapters
// chapterFrame / chapterWindow / drawFrame now live in the shared film-strip kit (C0 uses them too); re-exported here
// unchanged, so C5's imports keep working.
export { chapterFrame, chapterWindow, drawFrame };

// ------------------------------------------------------------------ film strip (shared kit, read-only)
/** drawStrip from the shared kit, drawn through an extra world transform (translate tx, ty; scale kx, ky): a strip
 *  smaller than the working view (light table) or squeezed (twisting into the reel). The kit's edge-number gate sees
 *  the matching camera, so numbers only print where they are ≥ 24 px. */
export function stripAt(o: SC, tx: number, ty: number, kx: number, ky: number, opt: StripOpt, zMul = 1) {
  const c = o.c, s = o.s;
  c.save(); s.save();
  for (const g of [c, s]) { g.translate(tx, ty); g.scale(kx, ky); }
  drawStrip({ ...o, cam: { x: (o.cam.x - tx) / kx, y: (o.cam.y - ty) / ky, z: o.cam.z * Math.min(kx, ky) * zMul } }, opt);
  c.restore(); s.restore();
}
/** World rect of frame k's picture for a strip drawn by stripAt(o, tx, ty, k, k, {cx: 0, cy: 0, scroll}). */
export function frameRect(tx: number, ty: number, ks: number, k: number, scroll: number) {
  return { x: tx - (STRIP.fw / 2) * ks, y: ty + (-STRIP.fh / 2 + (k - scroll) * STRIP.pitch) * ks, w: STRIP.fw * ks, h: STRIP.fh * ks };
}
export { STRIP, drawStrip, pullBack, pushIn, slideOn, outro, intro };
export type { StripOpt };

// ------------------------------------------------------------------ light table, splicer, phone (schematic objects)
/** Light table: a calm, backlit opal panel (warm light from the centre, soft falloff) in a thin dark frame. No grid. */
export function lightTable(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lit: number) {
  c.save();
  c.fillStyle = rgba('ink2', 1); c.beginPath(); c.roundRect(x - 18, y - 18, w + 36, h + 36, 14); c.fill();
  const g = c.createRadialGradient(x + w / 2, y + h / 2, 60, x + w / 2, y + h / 2, Math.max(w, h) * 0.62);
  g.addColorStop(0, `rgba(252,248,238,${0.97 * lit})`);
  g.addColorStop(0.6, `rgba(236,229,214,${0.93 * lit})`);
  g.addColorStop(1, `rgba(196,188,172,${0.88 * lit})`);
  c.fillStyle = g; c.beginPath(); c.roundRect(x, y, w, h, 6); c.fill();
  c.restore();
}

/** Tape splicer seen from above: two cast guide blocks either side of the strip and a yoke carrying two blades
 *  across it (one per frame line of the cut frame). `w` = the strip's width; `down` 0 = blades raised (offset, with a
 *  shadow), 1 = down (the cut). */
export function splicer(c: CanvasRenderingContext2D, cx: number, y: number, w: number, down: number, gapH: number) {
  const lift = (1 - clamp(down)) * 30, bw = 120, bh = gapH + 90;
  c.save();
  // guide blocks (engraved: graphite body, ink outline, diagonal hatching)
  for (const bx of [cx - w / 2 - bw - 6, cx + w / 2 + 6]) {
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(bx + 10, y - bh / 2 + 14, bw, bh);
    c.fillStyle = rgba('graphite', 1); c.beginPath(); c.roundRect(bx, y - bh / 2, bw, bh, 10); c.fill();
    c.strokeStyle = rgba('bone', 0.6); c.lineWidth = 2; c.stroke();
  }
  // the yoke and its two blades
  const x0 = cx - w / 2 - bw, x1 = cx + w / 2 + bw;
  for (const by of [y - gapH / 2, y + gapH / 2]) {
    c.fillStyle = `rgba(0,0,0,${0.4 * (1 - down) + 0.1})`; c.fillRect(x0 + lift * 0.6, by - 9 + lift, x1 - x0, 18);
    c.fillStyle = rgba('bone', 0.95); c.fillRect(x0 - lift * 0.3, by - 9 - lift * 0.4, x1 - x0, 18);
    c.strokeStyle = rgba('ink', 0.95); c.lineWidth = 2; c.strokeRect(x0 - lift * 0.3, by - 9 - lift * 0.4, x1 - x0, 18);
    c.fillStyle = rgba('ink', 0.8); c.fillRect(x0 - lift * 0.3, by - 1 - lift * 0.4, x1 - x0, 2); // the edge
  }
  c.fillStyle = rgba('bone', 0.95); c.strokeStyle = rgba('ink', 0.95); c.lineWidth = 2;
  for (const xx of [x0 - 34, x1 + 4]) { c.fillRect(xx - lift * 0.3, y - gapH / 2 - 9 - lift * 0.4, 30, gapH + 18); c.strokeRect(xx - lift * 0.3, y - gapH / 2 - 9 - lift * 0.4, 30, gapH + 18); }
  c.restore();
}

/** A generic phone: a plain rounded slab with a dark screen, clearly a phone on a dark plate (light metal rim, side
 *  buttons). No platform UI, no logos, no icons. Draw before the screen content; returns the screen rect. */
export function phone(c: CanvasRenderingContext2D, cx: number, cy: number, sh: number, a: number) {
  const sw = (sh * 9) / 16, bz = sh * 0.036;
  const x = cx - sw / 2, y = cy - sh / 2, R = bz * 3.4;
  if (a > 0.001) {
    c.save(); c.globalAlpha *= a;
    c.fillStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.roundRect(x - bz + 20, y - bz + 24, sw + 2 * bz, sh + 2 * bz, R); c.fill();
    // side buttons (power right, volume left)
    c.fillStyle = rgba('ash', 0.9);
    c.beginPath(); c.roundRect(x + sw + bz - 2, y + sh * 0.2, 9, sh * 0.11, 4); c.fill();
    c.beginPath(); c.roundRect(x - bz - 7, y + sh * 0.16, 9, sh * 0.07, 4); c.fill();
    c.beginPath(); c.roundRect(x - bz - 7, y + sh * 0.25, 9, sh * 0.07, 4); c.fill();
    // body: a light metal rim around a dark glass face
    const g = c.createLinearGradient(x - bz, y, x + sw + bz, y + sh);
    g.addColorStop(0, '#8d8a85'); g.addColorStop(0.5, '#5d5a56'); g.addColorStop(1, '#3d3b38');
    c.fillStyle = g; c.beginPath(); c.roundRect(x - bz, y - bz, sw + 2 * bz, sh + 2 * bz, R); c.fill();
    c.strokeStyle = rgba('bone', 0.85); c.lineWidth = 3; c.stroke();
    c.fillStyle = '#121212'; c.beginPath(); c.roundRect(x - bz + 7, y - bz + 7, sw + 2 * bz - 14, sh + 2 * bz - 14, R - 6); c.fill();
    c.fillStyle = '#060606'; c.beginPath(); c.roundRect(x, y, sw, sh, bz * 2); c.fill();
    c.restore();
  }
  return { x, y, w: sw, h: sh, r: bz * 2 };
}

/** Over the screen content: the earpiece slot in the top bezel and a plain swipe bar at the foot of the screen, with
 *  an up-chevron that brightens with `hint` (0..1, before a swipe). Generic hardware/gesture marks only. */
export function phoneTop(c: CanvasRenderingContext2D, scr: { x: number; y: number; w: number; h: number }, a: number, hint = 0) {
  if (a <= 0.001) return;
  const cx = scr.x + scr.w / 2, bz = (scr.h * 0.036);
  c.save(); c.globalAlpha *= a;
  c.fillStyle = rgba('ink', 0.9); c.beginPath(); c.roundRect(cx - 44, scr.y - bz / 2 - 4, 88, 8, 4); c.fill();
  c.fillStyle = rgba('bone', 0.75); c.beginPath(); c.roundRect(cx - 70, scr.y + scr.h - 22, 140, 8, 4); c.fill();
  if (hint > 0.01) {
    const yy = scr.y + scr.h - 52 - 14 * hint;
    c.strokeStyle = rgba('bone', 0.9 * clamp(hint)); c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(cx - 26, yy + 13); c.lineTo(cx, yy - 7); c.lineTo(cx + 26, yy + 13); c.stroke();
  }
  c.restore();
}

/** A thumb from the lower right, pressing at (x, y): engraved outline, pale fill, nail, a few contour hairlines. */
export function thumb(c: CanvasRenderingContext2D, x: number, y: number, s: number, a: number) {
  if (a <= 0.001) return;
  c.save(); c.globalAlpha *= a;
  c.translate(x, y); c.rotate(-0.5);
  const body = new Path2D();
  body.moveTo(-s * 0.5, s * 3.2); body.lineTo(-s * 0.5, s * 0.55);
  body.bezierCurveTo(-s * 0.5, -s * 0.2, s * 0.5, -s * 0.2, s * 0.5, s * 0.55); body.lineTo(s * 0.56, s * 3.2);
  c.fillStyle = 'rgba(214,204,190,0.92)'; c.fill(body);
  c.save(); c.clip(body);
  c.strokeStyle = 'rgba(94,91,87,0.45)'; c.lineWidth = 1.2;
  for (let i = 0; i < 9; i++) { const xx = s * (0.12 + i * 0.05); c.beginPath(); c.moveTo(xx, s * 0.3 + i * 4); c.lineTo(xx + 2, s * 3.2); c.stroke(); }
  c.restore();
  c.strokeStyle = 'rgba(10,10,11,0.85)'; c.lineWidth = 2; c.stroke(body);
  c.beginPath(); c.roundRect(-s * 0.3, -s * 0.0, s * 0.6, s * 0.62, s * 0.26);
  c.fillStyle = 'rgba(238,233,223,0.95)'; c.fill(); c.lineWidth = 1.5; c.stroke();
  c.beginPath(); c.moveTo(-s * 0.36, s * 1.5); c.quadraticCurveTo(0, s * 1.62, s * 0.36, s * 1.5); c.stroke(); // the joint crease
  c.restore();
}

// ------------------------------------------------------------------ the mark: play triangle with a wave for a back edge
/** The vibe-animator mark as one closed curve, unit size (fits in about [-1, 1]²), sampled at n points. */
export function markPoints(n = 512): [number, number][] {
  const A: [number, number] = [-0.72, -0.92], B: [number, number] = [0.98, 0], C: [number, number] = [-0.72, 0.92];
  const seg = (p: [number, number], q: [number, number], u: number): [number, number] => [lerp(p[0], q[0], u), lerp(p[1], q[1], u)];
  const LAB = Math.hypot(B[0] - A[0], B[1] - A[1]), LCA = 1.84 * 1.18; // the wave edge is a little longer than straight
  const tot = LAB * 2 + LCA;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const s = (i / n) * tot;
    if (s < LAB) pts.push(seg(A, B, s / LAB));
    else if (s < 2 * LAB) pts.push(seg(B, C, (s - LAB) / LAB));
    else {
      const u = (s - 2 * LAB) / LCA; // C (bottom) up to A (top): a wave of one and a half periods
      pts.push([-0.72 + 0.17 * Math.sin(u * Math.PI * 3), lerp(0.92, -0.92, u)]);
    }
  }
  return pts;
}

export interface Arm { k: number; re: number; im: number; amp: number; ph: number }
/** DFT of a closed curve (complex samples), arms sorted by amplitude (k = 0 is the centre, returned separately). */
export function dft(pts: [number, number][], nArms: number): { c0: [number, number]; arms: Arm[] } {
  const N = pts.length, arms: Arm[] = [];
  let c0: [number, number] = [0, 0];
  const K = Math.ceil(nArms / 2) + 2;
  for (let k = -K; k <= K; k++) {
    let re = 0, im = 0;
    for (let i = 0; i < N; i++) {
      const a = (-2 * Math.PI * k * i) / N;
      re += pts[i]![0] * Math.cos(a) - pts[i]![1] * Math.sin(a);
      im += pts[i]![0] * Math.sin(a) + pts[i]![1] * Math.cos(a);
    }
    re /= N; im /= N;
    if (k === 0) c0 = [re, im];
    else arms.push({ k, re, im, amp: Math.hypot(re, im), ph: Math.atan2(im, re) });
  }
  arms.sort((a, b) => b.amp - a.amp);
  return { c0, arms: arms.slice(0, nArms) };
}

/** The finished mark as C0's epicycles leave it: the DFT reconstruction (nArms arms) of markPoints, as unit points
 *  centred on the mark's own centre (so it can be drawn at any centre and scale without a trace). */
export function markCurve(n = 600, nArms = 44, samples = 720): [number, number][] {
  const { arms } = dft(markPoints(samples), nArms);
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const ph = i / n;
    let x = 0, y = 0;
    for (const a of arms) { const ang = 2 * Math.PI * a.k * ph + a.ph; x += a.amp * Math.cos(ang); y += a.amp * Math.sin(ang); }
    out.push([x, y]); // (c0, the centroid, left out: centred)
  }
  return out;
}
/** Stroke the mark (unit curve from markCurve) at (cx, cy), `s` px per unit, amber on the signal layer `g`. `p` 0..1
 *  draws a fraction of the outline (1 = closed). */
export function drawMark(g: CanvasRenderingContext2D, curve: [number, number][], cx: number, cy: number, s: number, a: number, lw = 7, p = 1) {
  if (a <= 0.001 || p <= 0) return;
  const n = Math.max(2, Math.round((curve.length - 1) * clamp(p)));
  g.save(); g.globalAlpha *= clamp(a);
  g.strokeStyle = rgba('signal', 1); g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(cx + curve[0]![0] * s, cy + curve[0]![1] * s);
  for (let i = 1; i <= n; i++) g.lineTo(cx + curve[i]![0] * s, cy + curve[i]![1] * s);
  if (p >= 1) g.closePath();
  g.stroke(); g.restore();
}

/** Wordmark: «vibe-animator», light «vibe», bold «animator», the hyphen as a short amber-free rule. Returns width. */
export function wordmark(c: CanvasRenderingContext2D, cx: number, y: number, size: number, a: number, colr = 'bone') {
  if (a <= 0.001) return 0;
  c.save(); c.globalAlpha *= clamp(a);
  c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.letterSpacing = `${size * -0.01}px`;
  const fL = font(F.archivo(100, 300), size), fB = font(F.archivo(100, 700), size);
  c.font = fL; const w1 = c.measureText('vibe').width, wd = c.measureText('-').width;
  c.font = fB; const w2 = c.measureText('animator').width;
  const x0 = cx - (w1 + wd + w2) / 2;
  c.fillStyle = rgba(colr, 0.92);
  c.font = fL; c.fillText('vibe', x0, y); c.fillStyle = rgba('ash', 0.9); c.fillText('-', x0 + w1, y);
  c.fillStyle = rgba(colr, 1); c.font = fB; c.fillText('animator', x0 + w1 + wd, y);
  c.restore();
  return w1 + wd + w2;
}

/** The director's console line: «› typed text» in mono with a blinking caret (deterministic in t). */
export function consoleLine(c: CanvasRenderingContext2D, s: string, x: number, y: number, t: number, a: number, colr: string, size = 36) {
  if (a <= 0.001) return;
  c.save(); c.globalAlpha *= clamp(a);
  c.font = font(F.mono(500), size); c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.letterSpacing = '0px';
  c.fillStyle = colr;
  const pre = '› ';
  c.fillText(pre + s, x, y);
  if (Math.floor(t * 2) % 2 === 0) c.fillRect(x + c.measureText(pre + s).width + 4, y - size * 0.78, size * 0.5, size * 0.95);
  c.restore();
}

export { clamp, ease, lerp };
