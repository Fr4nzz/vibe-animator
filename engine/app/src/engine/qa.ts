// Layout QA (`?qa=1` only; see scripts/qa.ts). Records every fillText/strokeText drawn on an on-screen
// Layer2D (scene layers and the HUD/captions) with its on-screen box and effective size in logical px.
// Inactive without ?qa=1: nothing is patched and the hooks below are no-ops, so rendered frames are unchanged.

export interface QaRec {
  /** Timeline entry id that drew it, or 'hud' (captions, crop marks). */
  scene: string;
  text: string;
  /** Font family as set on the context (e.g. "Plex-500"). */
  family: string;
  /** Effective size in logical px after the CTM (camera zoom included). */
  px: number;
  /** On-screen box in logical px (ink extents from measureText). */
  x0: number; y0: number; x1: number; y1: number;
  /** globalAlpha x the fill/stroke colour's alpha. */
  alpha: number;
}

export const QA = typeof location !== 'undefined' && new URLSearchParams(location.search).has('qa');

export const qa = {
  /** The entry being drawn (null: not recording, e.g. during a stateful scene's preroll). */
  scene: null as string | null,
  recs: [] as QaRec[],
};

const canvases = new WeakMap<HTMLCanvasElement, 'scene' | 'hud'>();

/** Mark a canvas as composited full-screen (Layer2D does this for itself; the HUD re-marks its layer as 'hud'). */
export function qaRegister(canvas: HTMLCanvasElement, kind: 'scene' | 'hud') {
  if (QA) canvases.set(canvas, kind);
}

function styleAlpha(s: unknown): number {
  if (typeof s !== 'string') return 1;
  const m = /^rgba?\(([^)]+)\)/.exec(s);
  if (m) { const p = m[1]!.split(/[\s,/]+/).filter(Boolean); return p.length >= 4 ? parseFloat(p[3]!) * (p[3]!.endsWith('%') ? 0.01 : 1) : 1; }
  if (/^#[0-9a-f]{8}$/i.test(s)) return parseInt(s.slice(7), 16) / 255;
  return s === 'transparent' ? 0 : 1;
}

function record(c: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number | undefined, fill: boolean) {
  const kind = canvases.get(c.canvas as HTMLCanvasElement);
  if (!kind || !text || !text.trim()) return;
  const scene = kind === 'hud' ? 'hud' : qa.scene;
  if (!scene) return;
  const m = c.measureText(text);
  let l = m.actualBoundingBoxLeft, r = m.actualBoundingBoxRight;
  if (maxWidth !== undefined && m.width > maxWidth && m.width > 0) { const k = maxWidth / m.width; l *= k; r *= k; }
  const T = c.getTransform(); // logical px (scaleContext2D patches it)
  const pts = [[x - l, y - m.actualBoundingBoxAscent], [x + r, y - m.actualBoundingBoxAscent], [x - l, y + m.actualBoundingBoxDescent], [x + r, y + m.actualBoundingBoxDescent]]
    .map(([px, py]) => [T.a * px! + T.c * py! + T.e, T.b * px! + T.d * py! + T.f]);
  const xs = pts.map((p) => p[0]!), ys = pts.map((p) => p[1]!);
  const fm = /([\d.]+)px\s+"?([^",]+)"?/.exec(c.font);
  const size = fm ? parseFloat(fm[1]!) : 10;
  qa.recs.push({
    scene, text, family: fm ? fm[2]! : c.font,
    px: size * Math.sqrt(Math.abs(T.a * T.d - T.b * T.c)),
    x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys),
    alpha: c.globalAlpha * styleAlpha(fill ? c.fillStyle : c.strokeStyle),
  });
}

/** Patch CanvasRenderingContext2D text drawing (call once at boot, only when QA). */
export function installQa() {
  if (!QA) return;
  const P = CanvasRenderingContext2D.prototype;
  const fillText = P.fillText, strokeText = P.strokeText;
  P.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
    record(this, String(text), x, y, maxWidth, true);
    return maxWidth === undefined ? fillText.call(this, text, x, y) : fillText.call(this, text, x, y, maxWidth);
  };
  P.strokeText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
    record(this, String(text), x, y, maxWidth, false);
    return maxWidth === undefined ? strokeText.call(this, text, x, y) : strokeText.call(this, text, x, y, maxWidth);
  };
}
