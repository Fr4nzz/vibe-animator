# manim-web inside our engine: spike (2026-10-25)

Branch `spike/manim-web` (from `render-speed`), local only. Question: can
[maloyan/manim-web](https://github.com/maloyan/manim-web) (npm `manim-web`, MIT) be a dependency that draws and
animates math scenes, while our engine keeps the timeline, word cues, rendering, Shorts and captions?
Background and alternatives are in `2026-10-25-manim-ecosystem.md`.

## Verdict

**Yes. Use it as an npm dependency behind an adapter (`engine/app/src/scenes/_manim.ts`), with the version pinned
exactly. Do not fork it.** The demo scene renders through our normal path. Its frames are pixel-identical across runs
and across seek orders. The math layer adds about 0.7 ms per frame at 1 sample. Nothing in it needs patching. Every
problem found was fixed in the adapter (about 130 lines) or in `vite.config.ts`.

Port pieces into our own code instead only if one of these happens:
- upstream breaks the private hook the adapter uses (`Scene._render()`);
- the release churn becomes a burden (one maintainer, a 0.x release about every week);
- the 15 MB build becomes a problem. It does not matter for a local renderer.

A fork costs more than either path and buys nothing over them.

## What was checked (manim-web 0.40.1, source at commit 2a1085e)

| Question | Finding |
|---|---|
| Evaluate at an arbitrary t, deterministically? | **Yes, with the adapter.** `Animation.update(0, t)` maps time to alpha, and `interpolate(alpha)` is pure in alpha (ARCHITECTURE.md invariant). `Timeline.seek(t)` exists. But mobjects are mutated in place, and the library's way back (`Animation.reset()`, `Timeline.seek` backwards) **throws after a Transform** (`VGroup.setPoints: expected 296 points ..., got 281`). `become()` puts a moved MathTex at twice its offset and does not restore its glyphs. **The adapter therefore rebuilds the segment on every backward seek.** The build is a synchronous function. MathTex comes from a cache of prototypes that are already rendered, and `copy()` of a rendered MathTex is synchronous. A rebuild takes about 2 ms. No wall-clock time or `Math.random` enters the classes used here (`Math.random` appears only in point clouds, random graph layouts and unseeded VectorFields). |
| Draw into our canvas / three scene? | **Yes.** `new Scene(null, {headless: true})` uses a `NullRenderer`, so no WebGL context and no rAF loop are created. It still owns a real `THREE.Scene` (`scene.threeScene`) and an orthographic `Camera2D`. Each frame the adapter calls `scene._render()`, which syncs dirty mobjects into three.js; for the NullRenderer its draw is a no-op. The adapter then renders `threeScene` with **our** `WebGLRenderer` into its own 4x MSAA half-float target and composites it with our `Compositor` (premultiplied) between the plate and the ink/signal layers. Our post-processing (bloom, grain, vignette, CA) then applies, so the amber curve glows like any signal element. The adapter maps our shot camera (world px, zoom) onto `Camera2D`, so the math moves with the handheld drift and pushes in. |
| Shared three.js or its own copy? | **Shared.** `three@^0.186.1` is a regular dependency, and bun dedupes it to our single `node_modules/three` (0.186.1). The dist imports `"three"` as a bare specifier and does not bundle it. `@types/three` matches too. |
| Bundle size | npm unpacked 22 MB. `bun add` installed 119 packages: manim-web 24 MB, @mathjax 95 MB, jspdf 29 MB, lottie-web 25 MB. The production `vite build` of the spike episode is **15 MB versus 0.65 MB** for the example episode. MathJax is an 11 MB chunk (full NewCM font data), `_manim` is 1.8 MB, and the main chunk grows from 587 to 806 KB. jspdf, lottie and html2canvas are lazy chunks that load only if used. Dev boot to `ready` took 1.2 s. |
| LaTeX: MathJax or KaTeX, offline? | **`MathTex` is MathJax 4 SVG to real Bézier VMobjects**, bundled from `@mathjax/src` (morphable, strokable). KaTeX (bundled) is used only by `MathTexImage`, which needs its CSS from jsDelivr unless `setKatexStylesheetUrl` is set. **Offline: yes.** The adapter calls `setMathJaxScriptUrl(null)`, which disables the jsDelivr fallback. A request log showed no external request. Typst is an optional peer dependency and was not installed. |

## Demo and measurements

- Files: `examples/manim-curve/` contains the script, the episode config, and `scenes/c0.ts`. It is one `ShotScene` with
  a `ManimLayer`. The axes are created on "axes". y = x² is drawn on "curve". `MathTex("y = x^2")` is written on
  "squared". The graph transforms to x³ on "raise". The formula transforms to `y = x^3` on "cubed". The timing comes
  from `fake_vo`. The episode was built in `/var/tmp/mw-ep` with `nx init`, `fake-vo`, `prep` and `typecheck`
  (`typecheck ok`).
- Stills: `/var/tmp/mw-out/manim-web-spike_t6.30.png` (graph mid-morph, y = x²) and `/var/tmp/mw-out/manim-web-spike_t9.40.png`
  (end state, y = x³).
- **Normal render path:** `nx encode --from 4.5 --to 9.5 --samples 1` produced 150 frames at 1920x1080 with h264_vaapi
  in 4.0 s (37 fps), with audio.
- **Determinism:** five separate browser runs requested stills in different orders: fresh, forward, backward
  (9.4 → 8.9 → 6.3 → 4.6) and mixed. They gave **identical PNG md5s** at t = 4.6, 6.3 and 8.9. Two full encodes gave
  identical decoded-frame md5s (`ffmpeg -f framemd5`).
- **Speed** (`render.ts perf`, 5 s at 60 fps, readback included, DRI_PRIME=1, RX 7600M XT):

  | Scene | 1 sample | 4 samples |
  |---|---|---|
  | manim-spike C0 | 11.6 ms/frame (86 fps) | 17.6 ms (57 fps) |
  | examples/hello C0 (normal scene) | 10.9 ms (92 fps) | 13.6 ms (74 fps) |

  A forward still costs 2.3 ms and a backward still 9.2 ms (rebuild plus re-upload).

## Blockers and caveats (none stop adoption)

1. **Backward seeks need the rebuild.** As a result, a segment must be a **synchronous build function with no side
   effects outside `m`**, and every MathTex must come from `m.tex()`. The rule is simple and agent-writable, but a
   builder who calls `new M.MathTex` directly gets a blank or late formula.
2. **Adaptive sampling (`--samples auto`)** renders sub-frames out of time order, which causes about 2 rebuilds per
   frame. The output is still correct, but slow. Fixed `--samples N` is monotonic and needs no rebuilds. Use fixed
   samples for chapters with a manim layer, or cap them with the entry's `maxSamples`.
3. **One private API:** `Scene._render()` syncs dirty mobjects. Ask upstream for a public `syncToThree()` or
   `renderTo(renderer, target)`. Pinning the exact version covers this meanwhile.
4. **Vite:** manim-web contains `import(/* @vite-ignore */ 'pptxgenjs')` inside a try/catch. Vite 8's dependency
   pre-bundle still tries to resolve it and returns HTTP 500, so the scene module fails to load. The fix is the
   `optionalDeps()` plugin in `engine/app/vite.config.ts`, which resolves it to a module that throws.
5. **API docs are wrong in places.** For example, `MathTexOptions.fontSize` is documented as a "scale factor
   (1 = standard)" but is in points, like CE (default 48). We should keep our own short cheat-sheet in the kit.
6. **Not seen by our QA:** `scripts/qa.ts` records Canvas2D `fillText` only, so MathTex glyphs are invisible to
   the caption-overlap and Shorts-square checks. Either register manim bounding boxes with `qa`, or check layout by
   eye on stills.
7. **Look:** strokes are Line2 polylines with widths in physical px (resolution = PW x PH). Not tested at
   `--scale 2`, where strokes would probably come out thinner. The engraved look (hatching, hairlines) still comes
   from our kits. manim-web supplies geometry and motion, not our style.
8. **Maintenance:** created 2026-01-29; 80 of the 88 commits in a shallow clone (depth 50) are by one author; the ecosystem note counted 685 of ~950 overall. Releases come about weekly.
   Pin `"manim-web": "0.40.1"` (exact, already so in `package.json`). On upgrade, rerun the determinism check below.
9. The `core-js` postinstall (a funding banner) is blocked by bun. That is harmless.

## Adapter API sketch (how a builder writes a manim-web segment)

```ts
import { ShotScene, W, type Cam } from './_shots';
import { ManimLayer, M, MC } from './_manim';

export default class C3 extends ShotScene {
  m!: ManimLayer;
  async build() {
    const q = this.q, L = 'C3-L2';
    const tAxes = q.w(L, 'axes'), tCurve = q.w(L, 'curve'), tCube = q.w(L, 'cubed');
    this.m = new ManimLayer((m) => {                    // synchronous, rerun on backward seeks
      const axes = m.add(new M.Axes({ xRange: [-2, 2, 1], yRange: [-4, 4, 1] }), tAxes); // visible from tAxes
      const g = m.add(axes.plot((x) => x * x, { color: MC.signal }), tCurve);
      const eq = m.add(m.tex('y = x^2', { color: MC.bone, fontSize: 84 }), tCurve).moveTo([3.6, 1.6, 0]);
      m.play(new M.Create(axes, { duration: 1 }), tAxes); // every start is a word cue (song seconds)
      m.play(new M.Create(g, { duration: 1.2 }), tCurve);
      m.play(new M.Transform(g, axes.plot((x) => x ** 3, { color: MC.signal })), tCube);
      m.play(new M.Transform(eq, m.tex('y = x^3', { color: MC.bone, fontSize: 84 }).moveTo([3.6, 1.6, 0])), tCube);
    });
    await this.m.init();                                  // renders every MathTex once (MathJax), then builds
    this.shots = [{ t0: q.s(L) - 0.5, t1: q.end(L) + 1, paper: 0, cam: [/* our camera keys */], hud: /* our HUD */ }];
  }
  protected override underlay(t: number, out: THREE.WebGLRenderTarget, cam: Cam) {
    this.m.draw(this.ctx.renderer, this.ctx.comp, out, t, cam); // over the plate, under ink/signal + HUD + captions
  }
}
```

`ManimLayer` methods:
- `add(mobject, tIn?, tOut?)` adds a mobject with a visibility window;
- `play(animation, t0)` starts an animation at song time `t0`;
- `tex(latex, opts)` returns a cached MathTex copy;
- `init()` must be awaited;
- `draw(renderer, comp, out, t, cam?, opacity?)`;
- `UNIT`, `toM(x, y)` convert our world px to manim units (frame height 8 units = 1080 px);
- `MC` is our palette.

Engine changes on the branch:
- `ShotScene.underlay()`, a no-op hook;
- the `drift()` helper, factored out so the math layer drifts with the camera;
- `optionalDeps()` in `vite.config.ts`;
- the manim-web entry in `THIRD_PARTY.md`.

Next steps if adopted:
- a `shot.manim` field, so a segment lives inside its shot and fades with it;
- an `m.at(line, word)` cue helper;
- manim bounding boxes fed to `qa.ts`;
- a smoke-test step that renders `examples/manim-curve` and compares two stills.

**Determinism check to rerun on upgrade:**

```sh
tools/nx stills <ep> --t 6.3,8.9 --out A
tools/nx stills <ep> --t 9.4,8.9,6.3 --out B
md5sum A/* B/*    # must match per t
```

## Version, licence, attribution

- Pin: `manim-web` **0.40.1** (exact). It needs `three` 0.186.x, which we already use.
- Licence: MIT, "Copyright (c) 2025 Narek Maloyan". Transitive: MathJax and the NewCM font package are Apache-2.0.
  Everything else in its dependency tree is MIT or ISC. All are compatible with our MIT repo, and we do not vendor
  any of it.
- `THIRD_PARTY.md` text (added on this branch, under "npm dependencies"):

  > **manim-web** (pinned to 0.40.1): https://github.com/maloyan/manim-web, npm `manim-web`. Copyright (c) 2025 Narek
  > Maloyan. MIT License. A TypeScript port of the Manim Community API, used as a drawing and animation layer through
  > `engine/app/src/scenes/_manim.ts`; not vendored, not modified. Its transitive dependencies include MathJax
  > (`@mathjax/src`, Apache-2.0) with the New Computer Modern math font data (`@mathjax/mathjax-newcm-font`,
  > Apache-2.0), KaTeX (MIT), jsPDF (MIT), lottie-web (MIT), html2canvas (MIT), typia (MIT), earcut (ISC) and
  > polygon-clipping (MIT). Rendered formulas are glyph outlines of that font.

- A video description needs no credit line (MIT, and the rendered output is not the software). Crediting it is optional.
