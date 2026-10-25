// Demo chapter C1 "The lens equation" (examples/lens). Both lines are a Short (S01), so every text and the key action
// stay inside the square x 420-1500 and above the caption band. Bone-paper plate; the thin-lens equation is set by
// manim-web (the math layer, scenes/_manim.ts) and written in on a word cue.
import type * as THREE from 'three';
import { ShotScene, W, rgba, tw, ease, lerp, type SC, type Cam } from './_shots';
import { fig2, lab, K } from './_devices';
import { ManimLayer, M, MC, toM } from './_manim';

const L = (n: number) => `C1-L${n}`;
const LX = W / 2, AX = 660, LH = 170, FL = 150;   // lens x, optical axis y, lens half-height, focal length (px)

function arrowUp(c: CanvasRenderingContext2D, x: number, y0: number, y1: number, col: string, lw = 3) {
  const dir = Math.sign(y1 - y0) || -1;
  c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw;
  c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y1 - dir * 14); c.stroke();
  c.beginPath(); c.moveTo(x, y1); c.lineTo(x - 11, y1 - dir * 22); c.lineTo(x + 11, y1 - dir * 22); c.closePath(); c.fill();
  c.restore();
}

export default class C1 extends ShotScene {
  m!: ManimLayer;

  async build() {
    const q = this.q;
    const t0 = q.s(L(1)), tEnd = q.end(L(2));
    const tMove = q.w(L(1), 'move'), tCloser = q.w(L(1), 'closer'), tAway = q.w(L(1), 'away');
    const tEq = q.w(L(2), 'equation'), tWhere = q.w(L(2), 'where');

    // the math layer: the thin-lens equation, written on "equation"
    this.m = new ManimLayer((m) => {
      const eq = m.add(m.tex('\\frac{1}{f} = \\frac{1}{d_o} + \\frac{1}{d_i}', { color: MC.ink, fontSize: 76 }), tEq - 0.2).moveTo(toM(LX, 300));
      m.play(new M.Write(eq, { duration: 1.1 }), tEq - 0.2);
    });
    await this.m.init();

    this.shots = [{
      t0: t0 - 0.5, t1: tEnd + 1, paper: 1,
      cam: [K(t0 - 0.5, LX, 540, 1), K(tEnd + 1, LX, 530, 1.03)],
      draw: (o: SC) => {
        const t = o.t, c = o.c;
        const ink = rgba('ink', 0.9);
        // axis and lens
        c.save(); c.strokeStyle = rgba('ink', 0.35); c.lineWidth = 1; c.setLineDash([6, 8]);
        c.beginPath(); c.moveTo(440, AX); c.lineTo(1480, AX); c.stroke(); c.restore();
        c.save(); c.strokeStyle = ink; c.lineWidth = 1.8;
        c.beginPath(); c.moveTo(LX, AX - LH); c.quadraticCurveTo(LX + 60, AX, LX, AX + LH); c.quadraticCurveTo(LX - 60, AX, LX, AX - LH); c.stroke();
        c.restore();
        // focal marks
        for (const fx of [LX - FL, LX + FL]) { c.fillStyle = ink; c.beginPath(); c.arc(fx, AX, 5, 0, Math.PI * 2); c.fill(); }
        lab(c, 'F', LX + FL, AX + 46, 1, ink, 32, 'center', 600, 0);
        // the object slides toward the lens on "closer"; the image follows from 1/f = 1/do + 1/di
        const u = tw(t, tCloser - 0.2, tAway + 0.6, ease.inOutCubic);
        const dO = lerp(420, 250, u), dI = 1 / (1 / FL - 1 / dO);
        const h = 110, hi = (h * dI) / dO;
        const ox = LX - dO, ix = Math.min(1440, LX + dI);
        const aObj = tw(t, tMove - 0.6, tMove);
        if (aObj > 0) {
          c.save(); c.globalAlpha *= aObj;
          arrowUp(c, ox, AX, AX - h, ink);
          // the ray from the arrow tip: parallel to the axis, then through F to the image tip
          c.strokeStyle = rgba('blood', 0.85); c.lineWidth = 1.6;
          c.beginPath(); c.moveTo(ox, AX - h); c.lineTo(LX, AX - h); c.lineTo(ix, AX + hi); c.stroke();
          c.strokeStyle = rgba('ink', 0.45);
          c.beginPath(); c.moveTo(ox, AX - h); c.lineTo(ix, AX + hi); c.stroke();
          arrowUp(c, ix, AX, AX + hi, rgba('blood', 0.95));
          c.restore();
          lab(c, 'OBJECT', ox, AX - h - 30, aObj, ink, 30, 'center', 600, 2);
          lab(c, 'IMAGE', ix, AX + hi + 50, aObj, rgba('blood', 1), 30, 'center', 600, 2);
        }
        void tWhere;
      },
      hud: (o) => fig2(o.c, 'FIG. 2', 'THE LENS EQUATION', tw(o.t, t0 - 0.4, t0 + 0.3), true),
    }];
  }

  protected override underlay(t: number, out: THREE.WebGLRenderTarget, cam: Cam) {
    this.m.draw(this.ctx.renderer, this.ctx.comp, out, t, cam);
  }
}
