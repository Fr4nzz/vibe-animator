// manim-web example, chapter C0 (examples/manim-curve): a manim-web segment inside a normal ShotScene.
// manim-web draws the math (Axes, FunctionGraph, MathTex, Create/Write/Transform); our engine owns the clock (every
// step starts on a word cue), the moving camera, the plate, the post and the render. The HUD stays ours.
import type * as THREE from 'three';
import { ShotScene, W, tw, type Cam } from './_shots';
import { fig2, K } from './_devices';
import { ManimLayer, M, MC } from './_manim';

const L = 'C0-L1';

export default class C0 extends ShotScene {
  m!: ManimLayer;

  async build() {
    const q = this.q;
    const t0 = q.s(L), tEnd = q.end(L);
    const tAxes = q.w(L, 'axes'), tCurve = q.w(L, 'curve'), tSq = q.w(L, 'squared');
    const tRaise = q.w(L, 'raise'), tCubed = q.w(L, 'cubed');

    // the manim-web segment: a synchronous build, rerun on backward seeks (so: no side effects outside `m`)
    this.m = new ManimLayer((m) => {
      const axes = m.add(new M.Axes({
        xRange: [-2, 2, 1], yRange: [-4, 4, 1], xLength: 6, yLength: 6.4, tips: false,
        axisConfig: { color: MC.ash, strokeWidth: 2 },
      }), tAxes);
      axes.shift([-2.2, -0.2, 0]);
      const g2 = m.add(axes.plot((x) => x * x, { xRange: [-2, 2], color: MC.signal, strokeWidth: 5 }), tCurve);
      const g3 = axes.plot((x) => x * x * x, { xRange: [-1.587, 1.587], color: MC.signal, strokeWidth: 5 }); // target only
      // fontSize is in points like CE (default 48), although the d.ts comment says "scale factor (1 = standard)"
      const e2 = m.add(m.tex('y = x^2', { color: MC.bone, fontSize: 84 }), tSq - 0.1).moveTo([3.6, 1.6, 0]);
      const e3 = m.tex('y = x^3', { color: MC.bone, fontSize: 84 }).moveTo([3.6, 1.6, 0]);

      m.play(new M.Create(axes, { duration: 1.0 }), tAxes);
      m.play(new M.Create(g2, { duration: 1.2 }), tCurve);
      m.play(new M.Write(e2, { duration: 0.8 }), tSq - 0.1);
      m.play(new M.Transform(g2, g3, { duration: 1.4 }), tRaise);
      m.play(new M.Transform(e2, e3, { duration: 1.0 }), tCubed - 0.2);
    });
    await this.m.init();

    this.shots = [{
      t0: t0 - 0.5, t1: tEnd + 1, paper: 0,
      cam: [K(t0 - 0.5, W / 2, 540, 1), K(tRaise, W / 2, 540, 1.04), K(tEnd + 1, W / 2 - 40, 530, 1.1)],
      hud: (o) => fig2(o.c, 'FIG. 1', 'A CURVE CHANGES ITS POWER', tw(o.t, t0 - 0.4, t0 + 0.3), false),
    }];
  }

  protected override underlay(t: number, out: THREE.WebGLRenderTarget, cam: Cam) {
    this.m.draw(this.ctx.renderer, this.ctx.comp, out, t, cam);
  }
}
