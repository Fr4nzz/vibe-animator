// manim-web adapter: the math layer. Lets a scene use manim-web (npm, MIT, maloyan/manim-web) as a
// drawing and animation layer for math (Axes, plots, MathTex, Create/Write/Transform) while our engine keeps the clock,
// the word cues, the camera, the post-processing and the render path. See docs/research/2026-10-25-manim-web-spike.md.
//
// How it works. A HEADLESS manim-web Scene (NullRenderer: no WebGL context, no rAF loop) is used only as a mobject
// container holding a THREE.Scene. The segment is a synchronous BUILD function that adds mobjects and schedules
// animations at ABSOLUTE song times (word cues). draw(t) evaluates every started animation at t (manim-web animations
// are pure in alpha), syncs dirty mobjects into three.js, and renders the THREE.Scene with OUR WebGLRenderer into our
// own MSAA render target, which is composited over the plate. One three.js copy: bun dedupes manim-web's to ours.
//
// Time only moves forward inside a manim-web scene (animations mutate their mobjects). A backward seek (stills, QA,
// scrubbing) therefore throws the scene away and runs the build again; MathTex comes from a cache of pre-rendered
// prototypes (m.tex), so a rebuild is synchronous. (manim-web's own reset paths are not usable for this in 0.40.1:
// Animation.reset() throws after a Transform changed a VGroup's point count, and become() on a moved MathTex lands at
// twice its offset and does not restore the glyphs.)
//
//   class C0 extends ShotScene {
//     m = new ManimLayer((m) => {
//       const axes = m.add(new M.Axes({ ... }), tAxes);          // visible from tAxes
//       const eq = m.add(m.tex('y = x^2', { fontSize: 84 }), tSq);
//       m.play(new M.Create(axes, { duration: 1 }), tAxes);       // starts on the word cue
//     });
//     async build() { ...cues...; await this.m.init(); this.shots = [...] }
//     protected override underlay(t, out, cam) { this.m.draw(this.ctx.renderer, this.ctx.comp, out, t, cam); }
//   }
import * as THREE from 'three';
import * as M from 'manim-web';
import { W, H, PW, PH, type Compositor } from '../engine/gl';
import { HEX } from '../engine/palette';

export { M };

// MathJax comes from the npm bundle (@mathjax/src). Never fall back to the jsDelivr script: renders must be offline.
M.setMathJaxScriptUrl(null);

/** World px (our 1920x1080 layout) per manim unit at camera zoom 1: the manim frame is 8 units tall. */
export const UNIT = H / 8;
/** Our world px -> a manim point (origin at the frame centre, y up). */
export const toM = (x: number, y: number): [number, number, number] => [(x - W / 2) / UNIT, -(y - H / 2) / UNIT, 0];
/** Palette colours for manim-web (CSS hex). */
export const MC = HEX;

type TexOpts = Omit<M.MathTexOptions, 'latex'>;

export class ManimLayer {
  scene!: M.Scene;
  rt: THREE.WebGLRenderTarget;
  private entries: { m: M.Mobject; tIn: number; tOut: number }[] = [];
  private anims: { a: M.Animation; t0: number; started: boolean }[] = [];
  private texCache = new Map<string, M.MathTex>();
  private texPending: Promise<void>[] = [];
  private lastT = Infinity;
  /** Times the segment was rebuilt (init + backward seeks), for perf notes. */
  rebuilds = 0;

  constructor(private build: (m: ManimLayer) => void, o: { samples?: number } = {}) {
    this.rt = new THREE.WebGLRenderTarget(PW, PH, { type: THREE.HalfFloatType, samples: o.samples ?? 4, depthBuffer: true, stencilBuffer: true });
  }

  /** Run the build once to collect and render every MathTex, then build for real. Await in Scene.init/build(). */
  async init() {
    this.fresh();
    this.build(this); // pass 1: m.tex() starts the MathJax renders
    await Promise.all(this.texPending);
    this.texPending = [];
    this.rebuild();
  }

  /** Add a mobject that is visible from song time tIn (default: always) until tOut. Returns it. */
  add<T extends M.Mobject>(m: T, tIn = -Infinity, tOut = Infinity): T {
    this.scene.add(m);
    this.entries.push({ m, tIn, tOut });
    return m;
  }

  /** Schedule an animation to start at song time t0 (it runs for its own `duration`). */
  play<A extends M.Animation>(a: A, t0: number): A { this.anims.push({ a, t0, started: false }); return a; }

  /** A MathTex: a copy of a cached, already rendered prototype (synchronous after init()). */
  tex(latex: string, o: TexOpts = {}): M.MathTex {
    const key = JSON.stringify([latex, o]);
    const proto = this.texCache.get(key);
    if (proto && !this.texPending.length) return proto.copy() as M.MathTex;
    if (!proto) {
      const p = new M.MathTex({ latex, ...o });
      this.texCache.set(key, p);
      this.texPending.push(p.waitForRender());
    }
    return new M.MathTex({ latex, ...o }); // pass-1 placeholder (its geometry is never awaited or drawn)
  }

  /** Evaluate the manim layer at song time t (a pure function of t) and composite it over `out`. */
  draw(renderer: THREE.WebGLRenderer, comp: Compositor, out: THREE.WebGLRenderTarget, t: number, cam?: { x: number; y: number; z: number }, opacity = 1) {
    if (t < this.lastT) this.rebuild();
    this.lastT = t;
    for (const x of this.anims) {
      if (t < x.t0) continue;
      if (!x.started) { x.a.startTime = x.t0; x.started = true; }
      if (t <= x.t0 + x.a.duration || !x.a.isFinished()) x.a.update(0, t);
    }
    for (const e of this.entries) e.m.getThreeObject().visible = t >= e.tIn && t < e.tOut;
    const c = this.scene.camera;
    if (cam) { // follow our shot camera: world px -> manim units
      c.frameHeight = 8 / cam.z;
      c.setAspectRatio(W / H);
      const [x, y] = toM(cam.x, cam.y);
      c.moveTo([x, y, 10]);
    }
    // sync dirty mobjects into three.js (the headless renderer's own render() is a no-op)
    (this.scene as unknown as { _render(): void })._render();
    const prevA = renderer.getClearAlpha(), prevC = renderer.getClearColor(new THREE.Color());
    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(this.scene.threeScene, c.getCamera());
    renderer.setClearColor(prevC, prevA);
    // three's normal blending into a cleared target leaves premultiplied colour
    comp.draw(renderer, this.rt.texture, out, { premult: false, opacity });
  }

  private fresh() {
    if (this.scene) disposeScene(this.scene);
    // headless: no canvas, no rAF; width/height size the Line2 stroke resolution (px)
    this.scene = new M.Scene(null, { headless: true, width: PW, height: PH, backgroundOpacity: 0, autoRender: false, frustumCulling: false });
    this.entries = [];
    this.anims = [];
  }

  private rebuild() {
    this.fresh();
    this.build(this);
    this.lastT = -Infinity;
    this.rebuilds++;
  }

  dispose() { this.rt.dispose(); if (this.scene) disposeScene(this.scene); }
}

function disposeScene(s: M.Scene) {
  s.threeScene.traverse((o) => {
    const x = o as THREE.Mesh;
    x.geometry?.dispose();
    const mats = Array.isArray(x.material) ? x.material : x.material ? [x.material] : [];
    for (const m of mats) m.dispose();
  });
  s.dispose();
}
