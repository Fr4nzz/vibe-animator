// Example chapter C0 "The flame" (examples/hello): a pattern to copy. One ShotScene; every hit is a word cue looked
// up in the narration (this.q.w(line, word)), never a hard-coded second, so a re-voiced line keeps its sync.
// Ink plate, the flame is the only thing on the signal layer (the only thing that blooms).
import { ShotScene, lead, stamp, W, H, rgba, tw, ease, type SC } from './_shots';
import { fig2, lab, arrow, T, K } from './_devices';
import { hatch } from './_kit';

const L = (n: number) => `C0-L${n}`;
const X = W / 2, TOP = 640, BW = 150, BH = 330; // candle: centre x, top of the wax, body width/height (world px)

function candle(o: SC, melt: number) {
  const c = o.c;
  c.save();
  c.strokeStyle = rgba('bone', 0.9); c.lineWidth = 1.6;
  const body = new Path2D(); body.rect(X - BW / 2, TOP, BW, BH);
  hatch(c, body, [X - BW / 2, TOP, X + BW / 2, TOP + BH], 7, 0.9, 1, rgba('bone', 0.22));
  c.stroke(body);
  // melt pool: a hairline ellipse that widens as the wax melts
  c.beginPath(); c.ellipse(X, TOP, (BW / 2 - 8) * (0.35 + 0.65 * melt), 11, 0, 0, Math.PI * 2); c.stroke();
  // wick
  c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(X, TOP); c.quadraticCurveTo(X + 4, TOP - 28, X + 2, TOP - 50); c.stroke();
  c.restore();
}

function flame(o: SC) {
  const s = o.s, t = o.t;
  const k = 1 + 0.04 * Math.sin(t * 11) + 0.03 * Math.sin(t * 17.3);
  const base = TOP - 38, tip = TOP - 38 - 190 * k, sway = 6 * Math.sin(t * 2.3);
  s.save();
  const g = s.createLinearGradient(0, base, 0, tip);
  g.addColorStop(0, rgba('signal', 0.25)); g.addColorStop(0.35, rgba('signal', 0.95)); g.addColorStop(1, rgba('ember', 0.0));
  s.fillStyle = g;
  s.beginPath();
  s.moveTo(X, base + 14);
  s.bezierCurveTo(X - 46, base - 10, X - 30 + sway, tip + 90, X + sway, tip);
  s.bezierCurveTo(X + 30 + sway, tip + 90, X + 46, base - 10, X, base + 14);
  s.fill();
  s.restore();
}

export default class C0 extends ShotScene {
  build() {
    const q = this.q;
    const t0 = q.s(L(1)), tEnd = q.end(L(2));
    const tWick = q.w(L(1), 'wick'), tNot = q.w(L(1), 'not');
    const tMelt = q.w(L(2), 'melts'), tDraw = q.w(L(2), 'draws'), tVap = q.w(L(2), 'vapour');
    this.shots = [{
      t0: t0 - 0.5, t1: tEnd + 1, paper: 0,
      cam: [K(t0 - 0.5, X, 560, 1), K(q.s(L(2)), X, 560, 1.05), K(tVap - 0.2, X, 520, 1.7, ease.inOutCubic), K(tEnd + 1, X, 515, 1.78)],
      draw: (o) => {
        const t = o.t;
        candle(o, tw(t, tMelt, tMelt + 1.2));
        flame(o);
        const col = rgba('bone', 0.92);
        // L1: name the wick, then deny it
        const aWick = tw(t, tWick - 0.1, tWick + 0.5) * (1 - tw(t, q.s(L(2)) - 0.2, q.s(L(2)) + 0.3));
        lead(o.c, X + 3, TOP - 30, 200, -60, 'WICK', aWick, col, 34);
        const aNot = tw(t, tNot - 0.05, tNot + 0.3, ease.outCubic) * (1 - tw(t, q.s(L(2)) - 0.2, q.s(L(2)) + 0.2));
        stamp(o.c, 'NOT THE WICK', X - 330, 470, aNot, rgba('bone', 0.9), 36);
        // L2: melt pool, the liquid drawn up the wick, the vapour zone above it
        lead(o.c, X - 60, TOP + 4, -150, 36, 'MELT POOL', tw(t, tMelt, tMelt + 0.6), col, 26);
        arrow(o.c, [[X - 16, TOP - 4], [X - 16, TOP - 46]], tw(t, tDraw, tDraw + 0.6), col, 2, 9);
        const aV = tw(t, tVap - 0.15, tVap + 0.5);
        if (aV > 0) {
          const zone = new Path2D(); zone.ellipse(X, TOP - 76, 34, 22, 0, 0, Math.PI * 2);
          o.c.save(); o.c.globalAlpha *= aV;
          hatch(o.c, zone, [X - 40, TOP - 100, X + 40, TOP - 52], 4, -0.8, 1, rgba('bone', 0.8));
          o.c.strokeStyle = col; o.c.lineWidth = 1.2; o.c.stroke(zone);
          o.c.restore();
          lab(o.c, 'WAX VAPOUR', X + 54, TOP - 92, aV, col, 22, 'left', 600, 1);
          lab(o.c, 'burns here', X + 54, TOP - 66, aV, rgba('bone', 0.7), 18, 'left', 400, 0);
        }
      },
      hud: (o) => fig2(o.c, 'FIG. 1', 'THE FLAME', tw(o.t, t0 - 0.4, t0 + 0.3), false),
    }];
    void H; void T;
  }
}
