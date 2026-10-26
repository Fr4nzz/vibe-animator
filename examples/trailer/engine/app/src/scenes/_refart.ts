// Reference-based anatomy. Real illustrations (Servier Medical Art CC BY 3.0, Gray's Anatomy PD,
// CC0 bioicons — see public/refs/SOURCES.md) are flattened to JSON by engine/tools/svgflat.py and restyled here
// as engraved line art: every filled shape becomes a hairline outline plus parallel hatching whose
// density follows the original fill's darkness (dark = dense), over an ink base so that shapes occlude
// each other like the original. Plates are pre-rendered once into canvases and drawn as images.
import { rgba } from '../engine/palette';

export interface RefShape { d: string; m: number[]; fill: string | null; stroke: string | null; sw: number; lum: number | null }
export interface RefJSON { viewBox: number[]; shapes: RefShape[] }

const cache = new Map<string, Promise<RefJSON>>();
export function loadRef(name: string): Promise<RefJSON> {
  let p = cache.get(name);
  if (!p) { p = fetch(`refs/${name}.json`).then((r) => r.json()); cache.set(name, p); }
  return p;
}

export interface EngraveStyle {
  /** skip this shape */
  skip?: boolean;
  /** outline colour (null = no outline) */
  outline?: string | null;
  /** outline width in output px */
  lw?: number;
  /** hatch colour (null = none) */
  hatch?: string | null;
  /** hatch spacing in output px */
  gap?: number;
  angle?: number;
  /** base fill painted under the hatch (occludes what is behind); null = transparent */
  base?: string | null;
}

export interface EngraveOpts {
  /** output px per SVG unit */
  px: number;
  /** region of the SVG to render [x, y, w, h] (default: viewBox) */
  crop?: number[];
  flipX?: boolean;
  style?: (s: RefShape, i: number) => EngraveStyle;
  /** extra drawing in SVG units after the art (e.g. masks) */
  after?: (c: CanvasRenderingContext2D) => void;
}

/**
 * Default engraving, white-line (scratchboard) logic for ink plates: light areas of the original get
 * dense bone hatching, dark areas (sulci, shadows) stay black; dark shapes keep a hairline edge.
 */
export function defaultStyle(tint = 'bone', strength = 1, edge = 0.62): (s: RefShape, i: number) => EngraveStyle {
  return (s, i) => {
    if (!s.fill) return { outline: s.stroke ? rgba(tint, 0.6 * strength) : null, lw: 0.7, hatch: null, base: null };
    const L = s.lum ?? 1;
    return {
      base: rgba('ink', 1),
      outline: L < edge ? rgba(tint, (0.3 + 0.5 * (1 - L)) * strength) : null,
      lw: 0.7,
      hatch: L < 0.12 ? null : rgba(tint, (0.1 + 0.42 * L) * strength),
      gap: 1.9 + 7.5 * Math.pow(1 - L, 1.3),
      angle: 0.78 + ((i * 37) % 5) * 0.06,
    };
  };
}

export function shapePath(s: RefShape): Path2D {
  const p = new Path2D();
  p.addPath(new Path2D(s.d), new DOMMatrix(s.m as [number, number, number, number, number, number]));
  return p;
}

/** Pre-render a reference as engraved line art. Returns the canvas and the mapping (SVG unit → canvas px). */
export function engrave(ref: RefJSON, o: EngraveOpts) {
  const [cx, cy, cw, ch] = o.crop ?? ref.viewBox;
  const W = Math.ceil(cw! * o.px), H = Math.ceil(ch! * o.px);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!;
  const base = new DOMMatrix().translate(o.flipX ? W : 0, 0).scale(o.flipX ? -o.px : o.px, o.px).translate(-cx!, -cy!);
  const style = o.style ?? defaultStyle();
  c.lineJoin = 'round'; c.lineCap = 'round';
  ref.shapes.forEach((s, i) => {
    const st = style(s, i);
    if (st.skip) return;
    const p = shapePath(s);
    c.setTransform(base);
    if (st.base && s.fill) { c.fillStyle = st.base; c.fill(p, 'nonzero'); }
    if (st.hatch && s.fill) {
      c.save();
      c.clip(p);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.strokeStyle = st.hatch;
      c.lineWidth = 0.65;
      const a = st.angle ?? 0.8, gap = st.gap ?? 4;
      const ca = Math.cos(a), sa = Math.sin(a), R = Math.hypot(W, H);
      c.beginPath();
      for (let d = -R; d <= R; d += gap) {
        const px = W / 2 - sa * d, py = H / 2 + ca * d;
        c.moveTo(px - ca * R, py - sa * R); c.lineTo(px + ca * R, py + sa * R);
      }
      c.stroke();
      c.restore();
      c.setTransform(base);
    }
    if (st.outline) {
      c.strokeStyle = st.outline;
      c.lineWidth = (st.lw ?? 0.8) / o.px;
      c.stroke(p);
    }
  });
  if (o.after) { c.setTransform(base); o.after(c); }
  return { canvas: cv, px: o.px, crop: [cx!, cy!, cw!, ch!], flipX: !!o.flipX };
}

export type Engraved = ReturnType<typeof engrave>;

/** Draw an engraved plate so that SVG point (sx, sy) of the source lands at world (wx, wy) with `unit` world units per SVG unit. */
export function drawPlate(c: CanvasRenderingContext2D, e: Engraved, unit: number, sx: number, sy: number, wx: number, wy: number) {
  const [cx, cy, cw, ch] = e.crop;
  const wpp = unit / e.px; // world units per canvas px
  // canvas px of the source point
  const px = (e.flipX ? cx! + cw! - sx : sx - cx!) * e.px, py = (sy - cy!) * e.px;
  c.drawImage(e.canvas, wx - px * wpp, wy - py * wpp, e.canvas.width * wpp, e.canvas.height * wpp);
}
