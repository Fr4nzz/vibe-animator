// Agent-session replay kit: draws a generic, clean agent-chat UI from a scrubbed session (tools/session_import.py):
// a prompt box, the agent's short progress lines, tool-call cards (name, one-line argument, one-line result, a spinner
// while running), a "thinking" pill that shows only how long, never what, and a fan-out panel of subagent lanes.
// It evokes an agent harness without copying any product's branding: engine palette, IBM Plex Mono, hairlines.
// Pure function of time: every row's height and alpha come from the session clock, so a backward seek is exact.
// The scene maps the session onto word cues: `clock(sess, t, t0, t1)` stretches 0..sess.duration onto t0..t1.
import { W, H, clamp, ease, lerp, rgba, F, font, tw } from './_shots';

// ------------------------------------------------------------------ data (written by tools/session_import.py)
export interface SessEvent {
  t: number; kind: 'tool' | 'text' | 'thinking';
  name?: string; title?: string; arg?: string; result?: string; status?: 'ok' | 'error'; t_end?: number;
  text?: string; secs?: number;
}
export interface Lane { label: string; t0: number; t1: number; main?: boolean; steps: { t: number; title: string }[] }
export interface Session {
  version: number; source: string; label: string; prompt: string; prompt_source?: string;
  duration: number; real_seconds: number; time_map?: string;
  events: SessEvent[]; lanes: Lane[]; dropped?: number;
}
export interface Rect { x: number; y: number; w: number; h: number }

/** Scene time → video time of the session's own map (0..duration), linear between t0 and t1. */
export const toSess = (sess: Session, t: number, t0: number, t1: number) => ((t - t0) / Math.max(1e-3, t1 - t0)) * sess.duration;
/** Session time → scene time. */
export const toScene = (sess: Session, st: number, t0: number, t1: number) => t0 + (st / sess.duration) * (t1 - t0);

// ------------------------------------------------------------------ type (all ≥ 24 px at z = 1)
export const RT = { title: 28, mono: 24, text: 30, lane: 26, kicker: 24, prompt: 44 };
const MONO = (w = 400) => F.mono(w);

const fitCache = new Map<string, string>();
/** Cut s with an ellipsis to fit maxW in font f at size (cached: measuring is the slow part). */
export function fit(c: CanvasRenderingContext2D, s: string, f: string, size: number, maxW: number): string {
  const key = `${f}|${size}|${maxW}|${s}`;
  const hit = fitCache.get(key);
  if (hit !== undefined) return hit;
  c.save(); c.font = font(f, size);
  let out = s;
  if (c.measureText(s).width > maxW) {
    let lo = 0, hi = s.length;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (c.measureText(s.slice(0, m) + '…').width <= maxW) lo = m; else hi = m - 1; }
    out = s.slice(0, lo).trimEnd() + '…';
  }
  c.restore();
  fitCache.set(key, out);
  return out;
}

function text(c: CanvasRenderingContext2D, s: string, x: number, y: number, f: string, size: number, col: string, p = 1, align: CanvasTextAlign = 'left') {
  if (p <= 0 || !s) return;
  c.font = font(f, size); c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillStyle = col;
  c.fillText(p >= 1 ? s : s.slice(0, Math.ceil(s.length * p)), x, y);
}

function rrect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
}

/** A spinner arc (signal layer) whose angle is a function of t only. */
function spinner(s: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, a: number) {
  s.save(); s.globalAlpha *= a; s.strokeStyle = rgba('signal', 0.95); s.lineWidth = 3; s.lineCap = 'round';
  const a0 = t * 7;
  s.beginPath(); s.arc(x, y, r, a0, a0 + Math.PI * 1.3); s.stroke(); s.restore();
}
function tick(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number) {
  c.save(); c.globalAlpha *= a; c.strokeStyle = col; c.lineWidth = 2.6; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x - r * 0.7, y + r * 0.05); c.lineTo(x - r * 0.15, y + r * 0.6); c.lineTo(x + r * 0.8, y - r * 0.6); c.stroke(); c.restore();
}
function cross(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a: number) {
  c.save(); c.globalAlpha *= a; c.strokeStyle = col; c.lineWidth = 2.6; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - r * 0.6, y - r * 0.6); c.lineTo(x + r * 0.6, y + r * 0.6); c.moveTo(x + r * 0.6, y - r * 0.6); c.lineTo(x - r * 0.6, y + r * 0.6); c.stroke(); c.restore();
}

// ------------------------------------------------------------------ prompt box
/** The prompt as the user typed it: a rounded box, `p` of its letters, a caret (signal) while typing. */
export function drawPrompt(c: CanvasRenderingContext2D, s: CanvasRenderingContext2D, str: string, p: number, x: number, y: number, w: number, a: number, t: number, size = RT.prompt) {
  if (a <= 0.001) return;
  const h = size * 2.1;
  c.save(); c.globalAlpha *= a;
  c.fillStyle = rgba('ink2', 0.92); rrect(c, x, y, w, h, 14); c.fill();
  c.strokeStyle = rgba('ash', 0.55); c.lineWidth = 1.4; c.stroke();
  text(c, '›', x + 28, y + h * 0.66, MONO(600), size, rgba('graphite', 1));
  const shown = str.slice(0, Math.round(str.length * clamp(p)));
  text(c, shown, x + 28 + size * 0.9, y + h * 0.66, F.archivo(100, 500), size, rgba('bone', 0.96));
  c.font = font(F.archivo(100, 500), size);
  const cx = x + 28 + size * 0.9 + c.measureText(shown).width + 6;
  c.restore();
  const blink = p < 1 ? 1 : (Math.sin(t * 9) > 0 ? 1 : 0);
  if (blink) { s.save(); s.globalAlpha *= a; s.fillStyle = rgba('signal', 0.95); s.fillRect(cx, y + h * 0.28, 3, size * 0.95); s.restore(); }
}

// ------------------------------------------------------------------ chat column
const APPEAR = 0.28; // s (scene time) for a row to open
const GAP = 12;
function rowH(e: SessEvent): number {
  if (e.kind === 'tool') return 112;
  if (e.kind === 'thinking') return 46;
  return 92;
}

/**
 * The agent's chat column inside rect r: rows appear at their (mapped) times and push the column up, so the newest
 * row is always in view. `t0..t1` is the scene-time window the session is stretched onto.
 */
export function drawChat(c: CanvasRenderingContext2D, s: CanvasRenderingContext2D, sess: Session, t: number, t0: number, t1: number, r: Rect, a: number, header?: string) {
  if (a <= 0.001) return;
  const at = (st: number) => toScene(sess, st, t0, t1);
  c.save(); s.save(); c.globalAlpha *= a; s.globalAlpha *= a;
  // frame
  c.fillStyle = rgba('ink2', 0.78); rrect(c, r.x, r.y, r.w, r.h, 18); c.fill();
  c.strokeStyle = rgba('graphite', 0.9); c.lineWidth = 1.2; c.stroke();
  const hd = 58;
  text(c, header ?? `agent · ${sess.label}`, r.x + 26, r.y + 38, MONO(500), RT.kicker, rgba('ash', 1));
  c.strokeStyle = rgba('graphite', 0.7); c.beginPath(); c.moveTo(r.x, r.y + hd); c.lineTo(r.x + r.w, r.y + hd); c.stroke();
  // rows
  const view: Rect = { x: r.x + 18, y: r.y + hd + 14, w: r.w - 36, h: r.h - hd - 28 };
  const rows = sess.events.map((e) => ({ e, g: tw(t, at(e.t), at(e.t) + APPEAR, ease.outCubic), h: rowH(e) + GAP }));
  const total = rows.reduce((acc, x) => acc + x.h * x.g, 0);
  const scroll = Math.max(0, total - view.h);
  c.save(); c.beginPath(); c.rect(view.x - 6, view.y, view.w + 12, view.h); c.clip();
  s.save(); s.beginPath(); s.rect(view.x - 6, view.y, view.w + 12, view.h); s.clip();
  let y = view.y - scroll;
  for (const { e, g, h } of rows) {
    if (g <= 0) continue;
    const y0 = y; y += h * g;
    if (y < view.y - 4 || y0 > view.y + view.h) continue;
    const edge = clamp((y0 + h - view.y) / 90); // fade as it leaves the top
    const ra = g * edge;
    if (e.kind === 'tool') drawToolCard(c, s, e, t, at, view.x, y0, view.w, rowH(e), ra);
    else if (e.kind === 'thinking') {
      c.save(); c.globalAlpha *= ra;
      c.strokeStyle = rgba('graphite', 0.9); c.lineWidth = 1.2; rrect(c, view.x + 2, y0 + 4, 290, 38, 19); c.stroke();
      text(c, `thinking · ${e.secs ?? 0} s`, view.x + 22, y0 + 31, F.mono(400, true), RT.mono, rgba('ash', 1));
      c.restore();
    } else {
      c.save(); c.globalAlpha *= ra;
      const line = fit(c, (e.text ?? '').replace(/^\d+\.\s+/, ''), F.serif(500, true), RT.text, view.w * 2 - 40);
      const p = tw(t, at(e.t), at(e.t) + 1.2, ease.linear);
      // two lines: split where the first fills the width
      c.font = font(F.serif(500, true), RT.text);
      let cut = line.length;
      while (cut > 0 && c.measureText(line.slice(0, cut)).width > view.w - 20) cut = line.lastIndexOf(' ', cut - 1);
      const l1 = line.slice(0, cut), l2 = line.slice(cut).trim();
      const n = Math.ceil(line.length * p);
      text(c, l1.slice(0, n), view.x + 4, y0 + 34, F.serif(500, true), RT.text, rgba('bone', 0.95));
      text(c, l2.slice(0, Math.max(0, n - l1.length)), view.x + 4, y0 + 72, F.serif(500, true), RT.text, rgba('bone', 0.95));
      c.restore();
    }
  }
  c.restore(); s.restore();
  c.restore(); s.restore();
}

function drawToolCard(c: CanvasRenderingContext2D, s: CanvasRenderingContext2D, e: SessEvent, t: number, at: (st: number) => number,
  x: number, y: number, w: number, h: number, a: number) {
  const ts = at(e.t), te = e.t_end !== undefined ? at(e.t_end) : ts + 0.2;
  const running = t >= ts && t < te;
  const done = t >= te;
  c.save(); c.globalAlpha *= a;
  c.fillStyle = rgba('ink', 0.55); rrect(c, x, y, w, h, 12); c.fill();
  c.strokeStyle = rgba(running ? 'ash' : 'graphite', running ? 0.9 : 0.75); c.lineWidth = 1.2; c.stroke();
  // tool name chip
  const name = e.name ?? 'Tool';
  c.font = font(MONO(600), RT.mono);
  const nw = c.measureText(name).width + 22;
  c.fillStyle = rgba('graphite', 0.35); rrect(c, x + 16, y + 14, nw, 34, 8); c.fill();
  text(c, name, x + 27, y + 39, MONO(600), RT.mono, rgba('ochre', 1));
  // title (typed in)
  const tx = x + 16 + nw + 14, tmax = w - (tx - x) - 60;
  text(c, fit(c, e.title ?? '', F.archivo(100, 500), RT.title, tmax), tx, y + 41, F.archivo(100, 500), RT.title, rgba('bone', 0.96), tw(t, ts, ts + 0.3, ease.linear));
  // argument
  text(c, fit(c, e.arg ?? '', MONO(400), RT.mono, w - 52), x + 18, y + 73, MONO(400), RT.mono, rgba('ash', 0.95), tw(t, ts + 0.05, ts + 0.4, ease.linear));
  // result, once it lands
  if (done) {
    const err = e.status === 'error';
    const res = fit(c, `→ ${e.result ?? 'done'}`, MONO(500), RT.mono, w - 52);
    text(c, res, x + 18, y + 101, MONO(500), RT.mono, rgba(err ? 'ochre' : 'bone', err ? 1 : 0.8), tw(t, te, te + 0.25, ease.linear));
  }
  c.restore();
  // status glyph (top right): spinner on the signal layer while running, a tick or a cross when done
  const gx = x + w - 30, gy = y + 31;
  if (running) {
    spinner(s, gx, gy, 11, t, a);
    s.save(); s.globalAlpha *= a * 0.9; s.fillStyle = rgba('signal', 0.9); s.fillRect(x, y + 8, 3, h - 16); s.restore();
  } else if (done) (e.status === 'error' ? cross : tick)(c, gx, gy, 12, rgba(e.status === 'error' ? 'ochre' : 'ash', 1), a * tw(t, te, te + 0.2));
}

// ------------------------------------------------------------------ fan-out panel
/**
 * Subagent lanes: the orchestrator node at the top, a spine, one row per lane: a status glyph (spinner while running,
 * a tick when done), the lane label, a tool-call counter and the lane's current step typing in. The `main` lane (the
 * one the chat column shows) is outlined on the signal layer. Returns the main lane's row centre y (for a connector).
 */
export function drawFanout(c: CanvasRenderingContext2D, s: CanvasRenderingContext2D, sess: Session, t: number, t0: number, t1: number, r: Rect, a: number, root = 'orchestrator'): number {
  if (a <= 0.001) return r.y;
  const at = (st: number) => toScene(sess, st, t0, t1);
  c.save(); s.save(); c.globalAlpha *= a; s.globalAlpha *= a;
  // root node
  const rx = r.x, ry = r.y;
  c.fillStyle = rgba('ink2', 0.92); rrect(c, rx, ry, r.w, 64, 14); c.fill();
  c.strokeStyle = rgba('ash', 0.6); c.lineWidth = 1.3; c.stroke();
  text(c, root, rx + 24, ry + 41, MONO(600), RT.lane, rgba('bone', 0.95));
  const nRun = sess.lanes.filter((l) => t >= at(l.t0) && t < at(l.t1)).length;
  const nDone = sess.lanes.filter((l) => t >= at(l.t1)).length;
  text(c, `${nRun} running · ${nDone} done`, rx + r.w - 22, ry + 41, MONO(400), RT.mono, rgba('ash', 1), 1, 'right');
  // lanes
  const top = ry + 100, rowH = Math.min(104, (r.h - 100) / Math.max(1, sess.lanes.length));
  const spineX = rx + 30;
  let mainY = top;
  sess.lanes.forEach((l, i) => {
    const la = tw(t, at(l.t0) - 0.1, at(l.t0) + 0.35, ease.outCubic);
    if (la <= 0) return;
    const cy = top + i * rowH + rowH / 2;
    if (l.main) mainY = cy;
    // branch from the spine
    c.save(); c.globalAlpha *= la;
    c.strokeStyle = rgba('graphite', 1); c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(spineX, ry + 64); c.lineTo(spineX, cy - 18); c.quadraticCurveTo(spineX, cy, spineX + 18, cy); c.lineTo(spineX + 44, cy); c.stroke();
    const running = t < at(l.t1);
    const x0 = spineX + 60;
    // label, counter, current step
    text(c, fit(c, l.label, MONO(500), RT.lane, rx + r.w - 170 - (x0 + 40)), x0 + 40, cy - 8, MONO(500), RT.lane, rgba('bone', l.main ? 1 : 0.9));
    const steps = l.steps.filter((st) => t >= at(st.t));
    text(c, `${steps.length} calls`, rx + r.w - 22, cy - 8, MONO(400), RT.mono, rgba('ash', 1), 1, 'right');
    const cur = running ? steps[steps.length - 1] : undefined;
    const line = cur ? cur.title : (running ? 'starting…' : 'done · report sent');
    const pt = cur ? tw(t, at(cur.t), at(cur.t) + 0.25, ease.linear) : 1;
    text(c, fit(c, line, MONO(400), RT.mono, r.w - 130), x0 + 40, cy + 26, MONO(400), RT.mono, rgba('ash', 0.95), pt);
    c.restore();
    if (running) spinner(s, x0 + 12, cy - 16, 11, t + i * 0.37, la);
    else tick(c, x0 + 12, cy - 16, 12, rgba('ash', 1), la);
    if (l.main) {
      s.save(); s.globalAlpha *= la * 0.85; s.strokeStyle = rgba('signal', 0.9); s.lineWidth = 2;
      rrect(s, x0 - 14, cy - rowH / 2 + 8, r.w - (x0 - rx) + 4, rowH - 16, 12); s.stroke(); s.restore();
    }
  });
  c.restore(); s.restore();
  return mainY;
}

/** Kicker that says what the viewer is looking at: a real session, how much it was sped up. */
export function replayKicker(sess: Session, t0: number, t1: number) {
  const k = sess.real_seconds / Math.max(1e-3, t1 - t0);
  const m = Math.floor(sess.real_seconds / 60), s = Math.round(sess.real_seconds % 60);
  return `REAL SESSION · ${m} MIN ${s} S SHOWN AT ~${Math.round(k)}×`;
}

export { W, H, lerp };
