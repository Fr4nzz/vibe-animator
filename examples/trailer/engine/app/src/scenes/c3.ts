// Trailer C3 "P versus NP" (dark math look), v2: goal first. Every line is in Short S04, so all text stays inside
// x 420-1500 and above the caption band. manim-web draws the axes, the three graphs, their LaTeX labels and the
// definition; canvas draws the T3 composer, the sudoku grids, the stopwatches, the search tree, the cards and the HUD.
//
// Storyboard (cue words):
//  L7  the strip slides on to T3 frame 000; the prompt types with the DIRECTOR voice, the camera pushes to the text
//      (z 2.2); at "sudoku" end the prompt lifts out as scene text and travels to the title band; the UI dissolves.
//  L11 GOAL. A filled sudoku ticks green row by row in one second, ending on "second"; its stopwatch makes one turn
//      and reads "1 s". "Is finding..." writes as the question; on "fast" an empty grid appears with a stopwatch "?".
//  L12 REASON. The empty grid moves centre-left and grows; on "trying" a search tree branches from it, one level per
//      empty square (the square being tried lights amber and cycles digits). On "multiply" the grid drops into the
//      plot's corner and the race starts: n^2, n^3, 2^n in lockstep in n; 2^n goes vertical on "square" while the
//      tree bursts across the frame.
//  L13 On "grows" n^2 and n^3 turn amber, 2^n dims, the tree fades; on "polynomial" a brace and "polynomial time"
//      write on the amber curves. On "If" the plot goes and the goal question returns; on "yes" the definition writes
//      under it (P = NP: every problem checkable in polynomial time is solvable in polynomial time).
//  L10 On "Nobody" the = becomes =?; on "million" the $1,000,000 Millennium Prize card slams in.
//  L6  the prize card rises; on "On (other problems)" the FunSearch and AlphaEvolve cards come in; on "new" each is
//      stamped NOT P VS NP (full size from ~116.4 s to the cut at 118.46 s; C4 opens on this frame, spill hand-off).
// No "NP-complete" anywhere.
//
// Build notes. C5 cutting-room splice frame: C3-L12 at t = 95.7 s (2^n vertical through the top in amber, n^3 and n^2
// still racing, the search tree burst across the frame, the puzzle inset in the plot's corner). Runner-up: C3-L6 at
// 117.5 s (both cards stamped). The T3 composer, tag and lifted title come from the shared trailer_t3_kit.ts.
import type * as THREE from 'three';
import { ShotScene, W, H, rgba, tw, ease, lerp, clamp, font, F, txt, type SC, type Cam, type CamKey } from './_shots';
import { K } from './_devices';
import { ManimLayer, M, MC, toM, UNIT } from './_manim';
import { STRIP, drawStrip, outro, intro, outCam, outScroll, outStrip, inCam, inScroll, inStrip, inDrift, prevStill, handPost, drawFrame } from './trailer_filmstrip_kit';
import { t3Line } from './trailer_t3_kit';
import { grid, emptyAt, stopwatch, tree, prize, aiCard, brace, GREEN } from './kit_c3';

const L = (n: number) => `C3-L${n}`;
const COOL = '#8E9AAE';    // n^3, a cool secondary
const CX = W / 2;

// ---- plot geometry (world px) ----
const PX0 = 480, PX1 = 980, PY0 = 820, PY1 = 330;
const XMAX = 20, YMAX = 8000;
const XL = (PX1 - PX0) / UNIT, YL = (PY0 - PY1) / UNIT;
const px = (n: number) => PX0 + (n / XMAX) * (PX1 - PX0);
const py = (v: number) => PY0 - (v / YMAX) * (PY0 - PY1);

const QUESTION = 'Is finding the answer always that fast?';

const SCENE_START = (t0: number) => t0 - 0.4;   // timeline rule: a chapter starts 0.4 s before its first word

export default class C3 extends ShotScene {
  m!: ManimLayer;

  async build() {
    const q = this.q;

    // ---- cues
    const tL12 = q.s(L(12)), tMillion = q.w(L(10), 'million');
    const t3 = await t3Line(q, L(7), 'sudoku', { title: { paper: 0, y: 150, size: 58, shrink: { t0: tL12, t1: tL12 + 0.6, size: 36, y: 100 }, out: [tMillion - 0.3, tMillion] } });
    const tT0 = t3.tm.s, tDis0 = t3.tm.dis0, tDis1 = t3.tm.dis1;
    const tCheck1 = q.w(L(11), 'second'), tCheck0 = tCheck1 - 1.0, tIs = q.w(L(11), 'is'), tFast = q.w(L(11), 'fast');
    const tTry = q.w(L(12), 'trying'), tMul = q.w(L(12), 'multiply'), tSq = q.w(L(12), 'square');
    const tGrows = q.w(L(13), 'grows'), tPoly = q.w(L(13), 'polynomial'), tIf = q.w(L(13), 'if'), tYes = q.w(L(13), 'yes');
    const tNobody = q.w(L(10), 'nobody');
    const tL6 = q.s(L(6)), tOn = q.w(L(6), 'on'), tNew = q.w(L(6), 'new');

    // the race clock: n runs linearly from "multiply", so 2^n crosses the top of the axes on "square"
    const nVert = Math.log2(YMAX) - 0.25;
    const vel = nVert / (tSq - tMul);
    const tOfN = (n: number) => tMul + n / vel;
    const tPlotOut = tIf;
    const tRecol = tGrows - 0.1;

    // ---------------------------------------------------------------- manim-web: plot + definition
    this.m = new ManimLayer((m) => {
      const axes = m.add(new M.Axes({
        xRange: [0, XMAX, 5], yRange: [0, YMAX, 2000], xLength: XL, yLength: YL, tips: false,
        axisConfig: { color: MC.ash, strokeWidth: 2 },
      }), tMul - 0.5, tPlotOut + 0.5);
      axes.moveTo(toM((PX0 + PX1) / 2, (PY0 + PY1) / 2));
      m.play(new M.Create(axes, { duration: 0.6 }), tMul - 0.5);

      // the race: short segments that appear as n passes them, so the three curves move in lockstep in n
      const n2top = Math.log2(YMAX * 1.3);
      const race = (f: (n: number) => number, nEnd: number, color: string, sw: number) => {
        const segs = 90, segsN = Math.ceil((segs * nEnd) / XMAX);
        for (let i = 0; i < segsN; i++) {
          const a = (i * XMAX) / segs, b = Math.min(nEnd, ((i + 1) * XMAX) / segs);
          if (b <= a) break;
          m.add(axes.plot(f, { xRange: [a, b], color, strokeWidth: sw }), tOfN(b), tRecol + 0.6);
        }
      };
      race((n) => n * n, XMAX, MC.bone, 4);
      race((n) => n * n * n, XMAX, COOL, 4);
      race((n) => 2 ** n, n2top, MC.signal, 6);
      // recoloured copies: the gentle curves take the amber, 2^n dims
      const whole = (f: (n: number) => number, nEnd: number, color: string, sw: number) => {
        const g = m.add(axes.plot(f, { xRange: [0, nEnd], color, strokeWidth: sw }), tRecol, tPlotOut + 0.5);
        m.play(new M.FadeIn(g, { duration: 0.6 }), tRecol);
        m.play(new M.FadeOut(g, { duration: 0.45 }), tPlotOut);
      };
      whole((n) => n * n, XMAX, MC.signal, 6);
      whole((n) => n * n * n, XMAX, MC.signal, 6);
      whole((n) => 2 ** n, n2top, MC.graphite, 3);

      // labels (LaTeX): written when each curve's head gets there; recoloured with the curves
      const at2 = toM(px(XMAX) + 52, py(400) - 22), at3 = toM(px(XMAX) + 52, py(YMAX) + 10), atE = toM(px(n2top) + 62, py(YMAX * 1.3) + 20);
      const tEndRace = tOfN(XMAX) - 0.05;
      const l2 = m.add(m.tex('n^2', { color: MC.bone, fontSize: 52 }), tEndRace, tRecol + 0.6).moveTo(at2);
      const l3 = m.add(m.tex('n^3', { color: COOL, fontSize: 52 }), tEndRace, tRecol + 0.6).moveTo(at3);
      const lE = m.add(m.tex('2^n', { color: MC.signal, fontSize: 64 }), tSq + 0.05, tRecol + 0.6).moveTo(atE);
      m.play(new M.FadeIn(l2, { duration: 0.3 }), tEndRace);
      m.play(new M.FadeIn(l3, { duration: 0.3 }), tEndRace);
      m.play(new M.Write(lE, { duration: 0.35 }), tSq + 0.05);
      const l2b = m.add(m.tex('n^2', { color: MC.signal, fontSize: 52 }), tRecol, tPlotOut + 0.5).moveTo(at2);
      const l3b = m.add(m.tex('n^3', { color: MC.signal, fontSize: 52 }), tRecol, tPlotOut + 0.5).moveTo(at3);
      const lEb = m.add(m.tex('2^n', { color: MC.graphite, fontSize: 64 }), tRecol, tPlotOut + 0.5).moveTo(atE);
      for (const x of [l2b, l3b, lEb]) { m.play(new M.FadeIn(x, { duration: 0.6 }), tRecol); m.play(new M.FadeOut(x, { duration: 0.45 }), tPlotOut); }
      m.play(new M.FadeOut(axes, { duration: 0.45 }), tPlotOut);

      // the definition, under the returning goal question, written on "yes"
      const tDefOut = tMillion - 0.3;
      const d1 = m.add(m.tex('\\mathrm{P} = \\mathrm{NP}:', { color: MC.bone, fontSize: 84 }), tYes - 0.05, tNobody + 0.4).moveTo(toM(CX, 500));
      const d1q = m.add(m.tex('\\mathrm{P} \\overset{?}{=} \\mathrm{NP}', { color: MC.bone, fontSize: 84 }), tNobody, tDefOut + 0.5).moveTo(toM(CX, 490));
      const d2 = m.add(m.tex('\\text{every problem checkable}', { color: MC.bone, fontSize: 50 }), tYes + 0.2, tDefOut + 0.5).moveTo(toM(CX, 605));
      const d3 = m.add(m.tex('\\text{in polynomial time}', { color: MC.bone, fontSize: 50 }), tYes + 0.55, tDefOut + 0.5).moveTo(toM(CX, 674));
      const d4 = m.add(m.tex('\\text{is solvable in polynomial time}', { color: MC.bone, fontSize: 50 }), tYes + 0.9, tDefOut + 0.5).moveTo(toM(CX, 748));
      m.play(new M.Write(d1, { duration: 0.5 }), tYes - 0.05);
      m.play(new M.Write(d2, { duration: 0.5 }), tYes + 0.2);
      m.play(new M.Write(d3, { duration: 0.45 }), tYes + 0.55);
      m.play(new M.Write(d4, { duration: 0.6 }), tYes + 0.9);
      m.play(new M.FadeOut(d1, { duration: 0.35 }), tNobody);
      m.play(new M.FadeIn(d1q, { duration: 0.35 }), tNobody);
      for (const x of [d1q, d2, d3, d4]) m.play(new M.FadeOut(x, { duration: 0.4 }), tDefOut);
    });
    await this.m.init();

    // ---------------------------------------------------------------- camera + hand-offs
    // C2 -> C3 and C3 -> C4 are 'spill': we open on C2's last frame (frame -1), pull back, slide our frame (T3 frame
    // 000) in and push in; at the end our last frame (the stamped cards) stays full size to the cut.
    const ib = intro('C3'), ob = outro('C3');
    const prev = await prevStill(this.ctx, ib);
    this.postPaper = (t, p) => (t < ib.push1 + 0.1 ? handPost(ib, 'in', t) : t > ob.hold - 0.3 ? handPost(ob, 'out', t) : p);
    // T3 shot: strip arrival, then the kit's push (its first key, full window at the line start, is the arrival's end)
    const camT3: CamKey[] = [...inCam(ib), ...t3.keys().slice(1)];
    const tmE = t3.tm.e;
    const driftT3 = (t: number) => Math.min(inDrift(ib)(t), 1 - clamp((t - (tmE - 0.6)) / 0.4));
    const cam: CamKey[] = [
      K(tDis0, CX, 540, 1.0),
      K(tFast, CX, 540, 1.01), K(tMul, CX, 540, 1.0), K(tSq + 0.3, CX, 545, 0.985, ease.outCubic),
      K(tIf, CX, 540, 1.0), K(tMillion - 0.2, CX, 540, 1.0), K(tOn, CX, 540, 0.995), K(ob.cut, CX, 540, 1.005),
      ...outCam(ob),
    ];

    const strip = (o: SC, plate: (o: SC) => void) => {
      const t = o.t, out = outStrip(ob, t);
      drawStrip(o, {
        cx: W / 2, cy: H / 2, frames: 5, first: STRIP.first(3), live: 0,
        scroll: out ? outScroll(ob, t) : inScroll(ib, t),
        on: 0, fill: (k) => (k === 1 ? (STRIP.plate.C4 ? '#E9E3D6' : STRIP.dark) : STRIP.dark),
        inner: (oo, k, x, y, w, h) => {
          if (k === -1 && prev) drawFrame(oo.c, prev, x, y, w, h);
          if (k === 0) { oo.c.save(); oo.s.save(); oo.c.translate(x, y); oo.s.translate(x, y); plate(oo); oo.c.restore(); oo.s.restore(); }
        },
      });
    };

    // ---------------------------------------------------------------- layout over time
    const GA = { x: 500, y: 270, s: 360 };          // filled grid (CHECK)
    const GB = { x: 1060, y: 270, s: 360 };         // the puzzle (FIND)
    const GB2 = { x: 470, y: 250, s: 450 };         // ...grown, centre-left (L12)
    const GB3 = { x: PX0 + 22, y: PY1 + 8, s: 200 }; // ...inset in the plot's corner (race)
    const gridB = (t: number) => {
      const u1 = tw(t, tL12, tL12 + 1.0, ease.inOutCubic), u2 = tw(t, tMul - 0.25, tMul + 0.45, ease.inOutCubic);
      const x = lerp(lerp(GB.x, GB2.x, u1), GB3.x, u2), y = lerp(lerp(GB.y, GB2.y, u1), GB3.y, u2), s = lerp(lerp(GB.s, GB2.s, u1), GB3.s, u2);
      return { x, y, s, u2 };
    };

    const plate = (o: SC) => {
      const t = o.t, c = o.c, s = o.s;
      c.save(); s.save();

      // ---- L11: CHECK (filled grid, rows green over one second, stopwatch 1 s)
      const aA = 1 - tw(t, tL12, tL12 + 0.5);
      if (aA > 0.001) {
        const rows = clamp((t - tCheck0) / 1.0) * 9;
        grid(o, GA.x, GA.y, GA.s, aA, { filled: true, rows });
        const sw = clamp((t - tCheck0) / 1.0);
        stopwatch(c, GA.x + 110, 718, 44, sw, aA, '1 s', tw(t, tCheck1 - 0.05, tCheck1 + 0.2), GREEN);
        txt(c, 'CHECK', GA.x + GA.s / 2, 830, { size: 34, f: F.mono(600), col: rgba('bone', 0.9 * aA), align: 'center', ls: 5 });
      }
      // ---- L11 -> L12: FIND (the puzzle, stopwatch ?), grows, then drops into the plot
      const aB = tw(t, tFast - 0.1, tFast + 0.3) * (1 - tw(t, tPlotOut, tPlotOut + 0.4));
      const gb = gridB(t);
      const lit = t < tMul ? clamp((t - tTry) / (tMul - tTry)) * 4 : 4 + tw(t, tMul, tSq + 0.3) * 5;
      if (aB > 0.001) {
        grid(o, gb.x, gb.y, gb.s, aB, { filled: false, lit: t > tTry ? lit : 0, digits: 1 - clamp(gb.u2 * 3) });
        const aSw = aB * (1 - tw(t, tL12, tL12 + 0.4));
        stopwatch(c, GB.x + 110, 718, 44, Math.max(0, t - tFast) * 0.9, aSw, '?', tw(t, tFast + 0.1, tFast + 0.35), rgba('bone', 0.95));
        txt(c, 'FIND', GB.x + GB.s / 2, 830, { size: 34, f: F.mono(600), col: rgba('signal', 0.95 * aSw), align: 'center', ls: 5 });
      }
      // ---- L12: the search tree, one level per empty square; bursts on "multiply"
      const aT = tw(t, tTry - 0.2, tTry + 0.2) * (1 - tw(t, tRecol - 0.2, tRecol + 0.6));
      if (aT > 0.001) {
        const burst = tw(t, tMul, tSq + 0.3, ease.outCubic);
        const depth = t < tMul ? lit : 4 + burst * 4.6;
        const rx = lerp(1210, 1225, burst), ry = lerp(300, 270, burst);
        const span = lerp(540, 2900, burst), gap = lerp(112, 100, burst);
        // a hairline from the square being tried to the root
        const [ex, ey] = emptyAt(Math.max(0, Math.ceil(lit) - 1), gb.x, gb.y, gb.s);
        c.save(); c.globalAlpha *= aT * (1 - burst); c.strokeStyle = rgba('ash', 0.5); c.lineWidth = 1.5; c.setLineDash([6, 6]);
        c.beginPath(); c.moveTo(ex, ey); c.lineTo(rx, ry); c.stroke(); c.restore();
        tree(c, s, rx, ry, span, gap, depth, aT, burst);
      }
      // ---- plot words (world): axis framing
      const aAx = tw(t, tMul - 0.2, tMul + 0.3) * (1 - tw(t, tPlotOut, tPlotOut + 0.4));
      if (aAx > 0.001) {
        txt(c, 'puzzle size →', PX0, PY0 + 54, { size: 30, f: F.mono(500), col: rgba('ash', 0.95 * aAx), ls: 2 });
        txt(c, 'steps', PX0 - 6, PY1 - 22, { size: 30, f: F.mono(500), col: rgba('ash', 0.95 * aAx), ls: 2 });
      }
      // ---- L13: "polynomial time" on the amber curves (a brace over their right ends)
      const aPoly = 1 - tw(t, tPlotOut, tPlotOut + 0.4);
      const pb = tw(t, tPoly - 0.15, tPoly + 0.35, ease.outCubic);
      if (pb > 0.001 && aPoly > 0.001) {
        s.save(); s.globalAlpha *= aPoly;
        brace(s, 1080, PY1 + 4, PY0 - 4, pb, rgba('signal', 0.95));
        const pw = tw(t, tPoly, tPoly + 0.55);
        s.save(); s.beginPath(); s.rect(1150, 400, 360 * pw, 300); s.clip();
        txt(s, 'polynomial', 1150, 560, { size: 62, f: F.archivo(100, 700), col: rgba('signal', 1) });
        txt(s, 'time', 1150, 630, { size: 62, f: F.archivo(100, 700), col: rgba('signal', 1) });
        s.restore(); s.restore();
      }
      // ---- the goal question: L11 under the title; returns on "If" over the definition
      const aQ1 = tw(t, tIs - 0.05, tIs + 0.6) * (1 - tw(t, tL12, tL12 + 0.4));
      if (aQ1 > 0.001) {
        c.save(); c.beginPath(); c.rect(0, 0, lerp(420, 1500, tw(t, tIs - 0.05, tFast - 0.1)), H); c.clip();
        txt(c, QUESTION, CX, 226, { size: 48, f: F.serif(500, true), col: rgba('bone', 0.95 * aQ1), align: 'center' });
        c.restore();
      }
      const aQ2 = tw(t, tIf + 0.3, tIf + 0.8) * (1 - tw(t, tMillion - 0.3, tMillion));
      if (aQ2 > 0.001) txt(c, QUESTION, CX, 380, { size: 64, f: F.serif(500, true), col: rgba('bone', 0.96 * aQ2), align: 'center' });

      // ---- L10 / L6: the prize card
      const aC = tw(t, tMillion - 0.12, tMillion + 0.2, ease.outCubic);
      if (aC > 0.001) {
        const up = tw(t, tL6 - 0.1, tL6 + 0.8);
        prize(c, s, CX, lerp(540, 250, up), lerp(1, 0.6, up) * (1 + 0.12 * (1 - aC)), aC);
      }
      // ---- L6: the two AI cards, each stamped NOT P VS NP
      const cards: [string, string, string][] = [
        ['FunSearch', 'new cap-set constructions', '2023'],
        ['AlphaEvolve', 'improved algorithms', '2025'],
      ];
      cards.forEach(([h, sub, yr], i) => {
        const a = tw(t, tOn - 0.1 + i * 0.15, tOn + 0.4 + i * 0.15, ease.outCubic);
        if (a <= 0.001) return;
        aiCard(c, i === 0 ? 448 : 972, lerp(450, 410, a), 500, 420, a, h, sub, yr, tw(t, tNew - 0.2 + i * 0.12, tNew + 0.2 + i * 0.12));
      });
      c.restore(); s.restore();
    };

    this.shots = [
      // L7: arrive on the strip, type, push, lift, dissolve (shared T3 kit; it draws the tag and the travelling title)
      t3.shot({
        t0: SCENE_START(tT0), cam: camT3, drift: driftT3,
        paint: (o, p) => (inStrip(ib, o.t) ? strip(o, p) : p(o)),
      }),
      // the plate: fades in under the dissolve (t0 = dis1, fi 0.5)
      {
        t0: tDis1, fi: tDis1 - tDis0, t1: Math.max(ob.slide1, ob.cut), paper: 0, fo: 0.01, cam,
        draw: (o) => (outStrip(ob, o.t) ? strip(o, plate) : plate(o)),
        hud: (o) => t3.title(o),
      },
    ];
  }

  protected override underlay(t: number, out: THREE.WebGLRenderTarget, cam: Cam) {
    this.m.draw(this.ctx.renderer, this.ctx.comp, out, t, cam);
  }
}
