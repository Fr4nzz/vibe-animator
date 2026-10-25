// Demo chapter C0 "Bending light" (examples/lens). One ShotScene on an ink plate; every hit is a word cue
// (this.q.w(line, word)), never a hard-coded second. The focal point is the only thing on the signal layer.
import { ShotScene, W, rgba, tw, ease, type SC } from './_shots';
import { fig2, lab, K } from './_devices';

const L = (n: number) => `C0-L${n}`;
const LX = W / 2, AX = 540, LH = 250, LT = 46;   // lens centre x, optical axis y, lens half-height, half-thickness
const F: [number, number] = [LX + 420, AX];        // focal point (world px)
const X0 = 180, X1 = 1760;                         // rays enter / leave
const RAYS = [-200, -100, 0, 100, 200];

/** A convex lens: two hairline arcs and light hatching inside. */
function lens(o: SC, a: number) {
  if (a <= 0) return;
  const c = o.c;
  c.save(); c.globalAlpha *= a;
  const p = new Path2D();
  p.moveTo(LX, AX - LH);
  p.quadraticCurveTo(LX + LT * 2, AX, LX, AX + LH);
  p.quadraticCurveTo(LX - LT * 2, AX, LX, AX - LH);
  c.fillStyle = rgba('bone', 0.06); c.fill(p);
  c.strokeStyle = rgba('bone', 0.9); c.lineWidth = 1.8; c.stroke(p);
  c.restore();
}

/** A line from a to b, drawn to fraction p. */
function seg(c: CanvasRenderingContext2D, a: [number, number], b: [number, number], p: number) {
  if (p <= 0) return;
  c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p); c.stroke();
}

export default class C0 extends ShotScene {
  build() {
    const q = this.q;
    const t0 = q.s(L(1)), tEnd = q.end(L(2));
    const tStraight = q.w(L(1), 'straight'), tGlass = q.w(L(1), 'glass');
    const tSlows = q.w(L(2), 'slows'), tBends = q.w(L(2), 'bends'), tCross = q.w(L(2), 'cross'), tFocus = q.w(L(2), 'focus');
    this.shots = [{
      t0: t0 - 0.5, t1: tEnd + 1, paper: 0,
      cam: [K(t0 - 0.5, LX - 120, AX, 0.95), K(tGlass, LX, AX, 1.0), K(tFocus - 0.3, LX + 160, AX, 1.12, ease.inOutCubic), K(tEnd + 1, LX + 180, AX, 1.16)],
      draw: (o) => {
        const t = o.t, c = o.c;
        lens(o, tw(t, tGlass - 0.4, tGlass + 0.4));
        // optical axis
        c.save(); c.strokeStyle = rgba('ash', 0.35); c.lineWidth = 1; c.setLineDash([6, 8]);
        seg(c, [X0, AX], [X1, AX], 1); c.restore();
        // the rays: straight to the lens (L1), then bent through the focus (L2)
        c.save(); c.strokeStyle = rgba('bone', 0.85); c.lineWidth = 1.6;
        const pIn = tw(t, tStraight - 0.2, tGlass + 0.2, ease.inOutQuad);
        const pOut = tw(t, tBends - 0.1, tCross + 0.4, ease.inOutQuad);
        for (const dy of RAYS) {
          seg(c, [X0, AX + dy], [LX, AX + dy], pIn);
          const end: [number, number] = [X1, AX + dy + ((F[1] - (AX + dy)) * (X1 - LX)) / (F[0] - LX)];
          seg(c, [LX, AX + dy], end, pOut);
        }
        c.restore();
        // the focus: the one glowing thing
        const aF = tw(t, tCross - 0.1, tFocus + 0.2, ease.outCubic);
        if (aF > 0) {
          const s = o.s;
          s.save(); s.globalAlpha *= aF;
          const g = s.createRadialGradient(F[0], F[1], 0, F[0], F[1], 46);
          g.addColorStop(0, rgba('ember', 1)); g.addColorStop(0.3, rgba('signal', 0.9)); g.addColorStop(1, rgba('signal', 0));
          s.fillStyle = g; s.beginPath(); s.arc(F[0], F[1], 46, 0, Math.PI * 2); s.fill();
          s.restore();
        }
        const col = rgba('bone', 0.92);
        lab(o.c, 'GLASS', LX, AX - LH - 34, tw(t, tGlass, tGlass + 0.5), col, 34, 'center', 600, 3);
        lab(o.c, 'SLOWER HERE', LX, AX + LH + 60, tw(t, tSlows, tSlows + 0.5) * (1 - tw(t, tFocus, tFocus + 0.5)), rgba('bone', 0.7), 30, 'center', 500, 2);
        lab(o.c, 'FOCUS', F[0], F[1] - 70, tw(t, tFocus - 0.05, tFocus + 0.4), col, 40, 'center', 700, 3);
      },
      hud: (o) => fig2(o.c, 'FIG. 1', 'BENDING LIGHT', tw(o.t, t0 - 0.4, t0 + 0.3), false),
    }];
  }
}
