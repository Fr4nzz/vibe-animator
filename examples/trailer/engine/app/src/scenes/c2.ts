// trailer v2 · C2 · Completing the square (al-Khwarizmi), rebuilt GOAL FIRST. Look: the watercolour courtyard and two
// seated figures (washed from al-Wasiti's public-domain Maqamat miniature; public/refs/c2_wash_*.png, SOURCES.md) with
// crisp ink geometry on top; the 5x5 corner (and, at the end, the answer it buys) is the one amber thing.
//
// Storyboard (every cue is a word):
//   L8 DIRECTOR   spill hand-off from C1 -> strip lands on the T3 frame 000; the prompt types with the voice while the
//                 camera pushes to the text (z 2.2); on 'square' the prompt lifts out into the title; the UI dissolves
//                 into the courtyard; the title then shrinks into the FIG. kicker.
//   L9 STUDENT    the question: a square whose side is "?", a 10-by-? strip beside it, "= 39" under both; '?' pulses
//                 on 'side'.
//   L12 KHWARIZMI the insight before any move: on 'perfect' the shape slides into place and a dashed TARGET square draws
//                 around it; a small demo square "area 64" ('area'), its side "8" on 'eight', then it parks in a corner.
//   L13 KHWARIZMI 'not'/'fit': the 10 strip pokes out of the outline and bumps it (overhang hatched, "does not fit");
//                 'Split': cut on the outline edge, "10" -> "5" + "5"; 'five': the outside half swings onto the second
//                 side; 'corner': the empty 5x5 gap glows amber; 'five' (by five): "25".
//   L14 KHWARIZMI 'Fill': the corner fills, the square locks into the outline (ring sting), "39 + 25 = 64" writes;
//                 'sixty': the demo flashes; 'Side'/'eight': brackets 8; 'away': the right side splits 3 + 5, the 5 dims;
//                 'three': an amber 3 flies across and lands on the "?".
//   L7 NARRATOR   the picture moves left; the problem in his words; 'Centuries' CENTURIES LATER first; 'later' the same
//                 pieces get letters in place (ten -> b, halves -> b/2, corner -> (b/2)^2, thirty-nine -> c, 3 -> x);
//                 'picture' each term flies from its piece into x = sqrt((b/2)^2 + c) - b/2 (manim-web); 'formula' the
//                 textbook formula writes under it: "same recipe, general form". Spill hand-off: held full size to the cut.
import type * as THREE from 'three';
import { ShotScene, W, H, tw, clamp, ease, lerp, rgba, F, font, txt, loadImg, type SC, type Cam, type CamKey } from './_shots';
import { fig2, K } from './_devices';
import { ManimLayer, M, MC, toM, UNIT } from './_manim';
import { STRIP, drawStrip, intro, outro, inCam, inScroll, inStrip, inDrift, prevStill, handPost, drawFrame, type Hand } from './trailer_filmstrip_kit';
import { courtyard, rectP, piece, dashed, bracket, num, ser, mon, bez, INKC, SQ_FILL, SQ_EDGE, ST_FILL, ST_EDGE } from './kit_c2';
import { t3Line } from './trailer_t3_kit';

// T3 capture: 't3/C2-L8/index.json' (loaded and hashed through trailer_t3_kit.ts)
const U = 56; // world px per unit length
const X0 = 736, Y0 = 232; // top-left of the target 8x8 square
const GX = X0 + 4 * U, GY = Y0 + 4 * U; // its centre (960, 456)
const DX0 = (W / 2 - 6.5 * U) - X0; // the 13-wide problem shape, centred, before it moves into the target
const LS = 56; // geometry label size (world px; still >= 42 px at the L7 scale 0.75)
const EQY = 860; // baseline of the bottom equation line
const BONE = [238, 233, 223], INK = [10, 10, 11];
const mixC = (u: number, a: number) => `rgba(${BONE.map((b, i) => Math.round(lerp(b, INK[i]!, clamp(u)))).join(',')},${a})`;

export default class C2 extends ShotScene {
  m!: ManimLayer;
  ib!: Hand;

  async build() {
    const q = this.q;
    const t0 = this.ctx.start;
    const ib = (this.ib = intro('C2') as Hand & { t0: number; t1: number });
    const ob = outro('C2'); // 'spill': we stay full size to the cut; C3 opens on our last frame
    const prev = await prevStill(this.ctx, ib);

    // ---- cues
    const s8 = q.s('C2-L8'), e8 = q.end('C2-L8'), tLift = q.e('C2-L8', 'square');
    const s9 = q.s('C2-L9'), tSq = q.w('C2-L9', 'square'), tTen = q.w('C2-L9', 'ten'), t39 = q.w('C2-L9', 'thirty'), tQ = q.w('C2-L9', 'side', 1);
    const tPerf = q.w('C2-L12', 'perfect'), tEasy = q.w('C2-L12', 'easy'), tArea = q.w('C2-L12', 'area');
    const tSide12 = q.w('C2-L12', 'side', 1), tEight = q.w('C2-L12', 'eight'), e12 = q.end('C2-L12');
    const tTen13 = q.w('C2-L13', 'ten'), tNot = q.w('C2-L13', 'not'), tSplit = q.w('C2-L13', 'Split'), tFive = q.w('C2-L13', 'five');
    const tCorner = q.w('C2-L13', 'corner'), t25 = q.w('C2-L13', 'five', 1);
    const tFill = q.w('C2-L14', 'Fill'), t64 = q.w('C2-L14', 'sixty'), tSideE = q.w('C2-L14', 'Side'), tEight14 = q.w('C2-L14', 'eight');
    const tAway = q.w('C2-L14', 'away'), tFive14 = q.w('C2-L14', 'five'), tThree = q.w('C2-L14', 'three');
    const s7 = q.s('C2-L7'), tWrote = q.w('C2-L7', 'wrote'), tWordsE = q.e('C2-L7', 'words'), tCent = q.w('C2-L7', 'centuries');
    const tLater = q.w('C2-L7', 'later'), tPic = q.w('C2-L7', 'picture'), tForm = q.w('C2-L7', 'formula');
    const tEnd = this.ctx.end;
    // the lift-out and the dissolve (BUILD_BRIEF: lift 0.7 s from the cue word's end, dissolve 0.5 s overlapping it)
    const t3 = await t3Line(q, 'C2-L8', 'square', {
      title: { paper: 1, font: F.serif(600, true), size: 52, y: 150, shrink: { t0: s9, t1: s9 + 0.6, size: 26, y: 92 }, out: [s9 + 0.1, s9 + 0.6] },
    });
    const { dis0, dis1 } = t3.tm;
    void tLift; void e8; void s8;
    // letters-in-place and assembly times (L7)
    const tLb = tLater + 0.02, tLcor = tLater + 0.17, tLc = tLater + 0.3, tLx = tLater + 0.42, tCmp0 = tLater + 0.5, tCmp1 = tLater + 0.85;
    const fX = [tPic - 0.3, tPic + 0.1] as const, fB = [tPic - 0.15, tPic + 0.3] as const, fC = [tPic + 0.05, tPic + 0.5] as const;

    // ---- art
    const wash = courtyard();
    const [stu, mas] = await Promise.all([loadImg('refs/c2_wash_student.png'), loadImg('refs/c2_wash_master.png')]);
    const FIG = { stu: { x: 225, y: 560, w: 430 }, mas: { x: 1700, y: 556, w: 410 } };

    // ---- manim-web: the formula column (right of the moved picture)
    const FX = 1185, FY1 = 318, FY2 = 528, FMAX = 560;
    const FT: { a: number[]; b1: number[]; b2: number[]; c: number[]; eBot: number } = { a: [0, 0], b1: [0, 0], b2: [0, 0], c: [0, 0], eBot: 600 };
    const wpx = (p: number[]) => [W / 2 + p[0]! * UNIT, H / 2 - p[1]! * UNIT];
    this.m = new ManimLayer((m) => {
      const o = { color: MC.ink, fontSize: 64 };
      const A = m.tex('x =', o), B = m.tex('\\sqrt{\\left(\\frac{b}{2}\\right)^{2} + c}', o), C = m.tex('-\\,\\frac{b}{2}', o);
      const lay = () => { B.moveTo(toM(FX, FY1)); A.nextTo(B, M.LEFT, 0.18); C.nextTo(B, M.RIGHT, 0.26); };
      lay();
      const span = (C.getRight()[0] - A.getLeft()[0]) * UNIT;
      if (span > FMAX) { const k = FMAX / span; A.scale(k); B.scale(k); C.scale(k); lay(); }
      // centre the three parts as one line on FX
      const mid = (A.getLeft()[0] + C.getRight()[0]) / 2, sh = toM(FX, FY1)[0] - mid;
      for (const x of [A, B, C]) x.shift([sh, 0, 0]);
      const bl = B.getLeft()[0], bw = B.getWidth();
      FT.a = wpx([A.getLeft()[0] + A.getWidth() * 0.18, A.getCenter()[1]]);
      FT.b1 = wpx([bl + bw * 0.45, B.getCenter()[1]]);
      FT.b2 = wpx([bl + bw * 0.88, B.getCenter()[1]]);
      FT.c = wpx([C.getLeft()[0] + C.getWidth() * 0.62, C.getCenter()[1]]);
      m.add(A, fX[1] - 0.05); m.play(new M.FadeIn(A, { duration: 0.25 }), fX[1] - 0.05);
      m.add(B, fB[1] - 0.05); m.play(new M.FadeIn(B, { duration: 0.25 }), fB[1] - 0.05);
      m.add(C, fC[1] - 0.05); m.play(new M.FadeIn(C, { duration: 0.25 }), fC[1] - 0.05);
      const E = m.tex('x = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}', { color: MC.ink, fontSize: 60 });
      E.moveTo(toM(FX, FY2));
      if (E.getWidth() * UNIT > FMAX) { E.scale(FMAX / (E.getWidth() * UNIT)); E.moveTo(toM(FX, FY2)); }
      FT.eBot = wpx([0, E.getBottom()[1]])[1]!;
      m.add(E, tForm - 0.02);
      m.play(new M.Write(E, { duration: 0.6 }), tForm - 0.02);
    });
    await this.m.init();

    // ---- speaker emphasis (smoothed over 0.35 s; deterministic in t)
    const target = (t: number, who: string) => {
      if (t < s9 - 0.3) return 0.75;
      if (t >= s7 - 0.1) return 0.45 - 0.2 * tw(t, s7 + 0.3, s7 + 1.2);
      const sp = q.speakerAt(t);
      return sp === who ? 1 : 0.5;
    };
    const emph = (t: number, who: string) => { let s = 0; for (let i = 0; i < 8; i++) s += target(t - i * 0.05, who); return s / 8; };
    const speaking = (t: number, who: string) => (q.speakerAt(t) === who && t >= s9 - 0.1 && t < s7 ? 1 : 0);
    const tagA = (t: number, who: string) => { let s = 0; for (let i = 0; i < 8; i++) s += speaking(t - i * 0.05, who); return s / 8; };

    // ---- the picture group transform (L7: scale 0.75, move left to make room for the formula column)
    const mvOf = (t: number) => tw(t, s7 + 0.1, s7 + 0.9, ease.inOutCubic);
    const grp = (t: number) => { const mv = mvOf(t); return { k: lerp(1, 0.75, mv), cx: lerp(GX, 700, mv), cy: lerp(GY, 400, mv) }; };
    const P = (t: number, x: number, y: number): [number, number] => { const g = grp(t); return [g.cx + (x - GX) * g.k, g.cy + (y - GY) * g.k]; };

    // the words line (L7) and its letters: segment -> symbol, then the symbols close up
    const WSEG = ['a square', 'and', 'ten roots', 'equal', 'thirty-nine'];
    const SYM = ['x²', '+', 'bx', '=', 'c'];
    const SYM_T = [tLx, tLb + 0.05, tLb, tLb + 0.05, tLc];
    const WSZ = 58, SSZ = 72, WY = 800;
    const segPos = (c: CanvasRenderingContext2D) => {
      c.save(); c.letterSpacing = '0px';
      c.font = font(F.serif(600, true), WSZ);
      const sp = c.measureText(' ').width, ws = WSEG.map((s) => c.measureText(s).width);
      c.font = font(F.serif(600, true), SSZ);
      const ss = SYM.map((s) => c.measureText(s).width), ssp = c.measureText(' ').width * 0.9;
      c.restore();
      const tot = ws.reduce((a, b) => a + b, 0) + sp * (ws.length - 1), stot = ss.reduce((a, b) => a + b, 0) + ssp * (ss.length - 1);
      let x = W / 2 - tot / 2, xs = W / 2 - stot / 2;
      const wc: number[] = [], sc: number[] = [];
      for (let i = 0; i < ws.length; i++) { wc.push(x + ws[i]! / 2); x += ws[i]! + sp; sc.push(xs + ss[i]! / 2); xs += ss[i]! + ssp; }
      return { wc, sc, x0: W / 2 - tot / 2 };
    };
    const cPos = (t: number, c: CanvasRenderingContext2D): [number, number] => {
      const sp = segPos(c), u = tw(t, tCmp0, tCmp1, ease.inOutCubic);
      return [lerp(sp.wc[4]!, sp.sc[4]!, u), WY];
    };

    const plate = (o: SC, ox: number, oy: number) => {
      const { c, s, t } = o;
      c.save(); s.save(); c.translate(ox, oy); s.translate(ox, oy);
      const L7 = tw(t, s7 - 0.05, s7 + 0.5);

      // courtyard wash and the two figures (the speaker lit; never glow)
      c.save(); c.globalAlpha *= lerp(1, 0.62, tw(t, tSq - 0.4, tSq)) * lerp(1, 0.6, L7); c.drawImage(wash, 0, 0); c.restore();
      for (const [img, f, who] of [[stu, FIG.stu, 'STUDENT'], [mas, FIG.mas, 'KHWARIZMI']] as const) {
        const e = emph(t, who), h = (f.w * img.naturalHeight) / img.naturalWidth;
        const halo = clamp((e - 0.85) / 0.15);
        if (halo > 0.01) {
          const g = c.createRadialGradient(f.x, f.y - 60, 0, f.x, f.y - 60, 340);
          g.addColorStop(0, `rgba(205,164,99,${0.22 * halo})`); g.addColorStop(1, 'rgba(205,164,99,0)');
          c.fillStyle = g; c.fillRect(f.x - 360, f.y - 420, 720, 720);
        }
        c.save(); c.globalAlpha *= e; c.drawImage(img, f.x - f.w / 2, f.y - h / 2, f.w, h); c.restore();
      }

      // ---------------------------------------------------------------- the picture (group-transformed in L7)
      const geoOn = tw(t, tSq - 0.35, tSq + 0.05);
      if (geoOn > 0.001) {
        const g = grp(t);
        for (const x of [c, s]) { x.save(); x.translate(g.cx, g.cy); x.scale(g.k, g.k); x.translate(-GX, -GY); }
        const dx = DX0 * (1 - tw(t, tPerf, tPerf + 0.8, ease.inOutCubic));
        const split = t >= tSplit + 0.15;
        // the bump: the strip tries to fit and springs back
        const bt = t - tNot, bump = bt > 0 && bt < 1 ? -16 * Math.exp(-4.5 * bt) * Math.sin(16 * bt) : 0;

        // target outline: dashed from 'perfect', solid (locked) on 'Fill'
        const oA = tw(t, tPerf + 0.2, tPerf + 0.5), oP = tw(t, tPerf + 0.2, tPerf + 1.1, ease.inOutCubic);
        const lock = tw(t, tFill + 0.15, tFill + 0.5);
        dashed(c, X0, Y0, 8 * U, 8 * U, oP, 0.55 * oA * (1 - lock), 2.6);
        // the crossing segment of the outline flashes while the strip bumps
        const hit = tw(t, tNot - 0.05, tNot + 0.15) * (1 - tw(t, tSplit - 0.2, tSplit + 0.2));
        if (hit > 0.01) { c.strokeStyle = INKC(0.85 * hit); c.lineWidth = 5; c.beginPath(); c.moveTo(X0 + 8 * U, Y0 - 14); c.lineTo(X0 + 8 * U, Y0 + 3 * U + 14); c.stroke(); }

        // the corner (signal layer: the one amber thing)
        const cA = tw(t, tCorner - 0.05, tCorner + 0.45), cF = tw(t, tFill, tFill + 0.5);
        if (cA > 0.001) {
          const cx = X0 + 3 * U, cy = Y0 + 3 * U, cw = 5 * U;
          const pulse = 0.5 + 0.5 * Math.cos((t - tCorner) * 3.4);
          const fp = tw(t, fB[0] - 0.25, fB[0]) * (1 - tw(t, fB[1], fB[1] + 0.4)); // glows as its term leaves
          s.fillStyle = rgba('signal', (0.2 + 0.14 * pulse * (1 - cF)) * cA + 0.36 * cF + 0.2 * fp);
          s.fillRect(cx, cy, cw, cw);
          s.strokeStyle = rgba('blood', 0.9 * cA); s.lineWidth = 3;
          if (cF < 0.5) s.setLineDash([12, 10]);
          rectP(s, cx, cy, cw, cw, tw(t, tCorner - 0.1, tCorner + 0.45)); s.setLineDash([]);
          const lc = tw(t, tLcor, tLcor + 0.15), lcIn = tw(t, tLcor + 0.12, tLcor + 0.4);
          num(c, '25', cx + cw / 2, cy + cw / 2 + 38, (1 - lc) * tw(t, t25, t25 + 0.3), 104, INKC(0.9), 'center', tw(t, t25, t25 + 0.35));
          ser(c, '(b/2)²', cx + cw / 2, cy + cw / 2 + 28, lcIn, 88);
        }

        // the square (side "?")
        piece(c, X0 + dx, Y0, 3 * U, 3 * U, SQ_FILL, SQ_EDGE, tw(t, tSq + 0.1, tSq + 0.6), tw(t, tSq - 0.25, tSq + 0.35));
        // the strip: one 10-by-? piece, then two halves; the outside half swings onto the second side
        const halfGlow = tw(t, fC[0] - 0.25, fC[0]) * (1 - tw(t, fC[1], fC[1] + 0.4));
        if (halfGlow > 0.01) { s.fillStyle = rgba('signal', 0.16 * halfGlow); s.fillRect(X0 + 3 * U, Y0, 5 * U, 3 * U); }
        if (!split) {
          const gr = tw(t, tTen - 0.05, tTen + 0.5, ease.outCubic);
          const sx = X0 + 3 * U + dx + bump;
          piece(c, sx, Y0, 10 * U * gr, 3 * U, ST_FILL, ST_EDGE, clamp(gr * 1.5), gr > 0 ? 1 : 0);
          // overhang (outside the target): hatched while it does not fit
          const ov = tw(t, tNot, tNot + 0.3);
          if (ov > 0.01) {
            c.save(); c.beginPath(); c.rect(X0 + 8 * U + bump, Y0, 5 * U, 3 * U); c.clip();
            c.strokeStyle = INKC(0.32 * ov); c.lineWidth = 2;
            c.beginPath(); for (let d = -3 * U; d < 5 * U; d += 18) { c.moveTo(X0 + 8 * U + d + bump, Y0 + 3 * U); c.lineTo(X0 + 8 * U + d + 3 * U + bump, Y0); } c.stroke();
            c.restore();
          }
          num(c, '10', X0 + 8 * U + dx + bump, Y0 - 22, tw(t, tTen + 0.2, tTen + 0.5) * (1 - tw(t, tSplit, tSplit + 0.15)), LS);
          // the cut on the outline edge
          const cut = tw(t, tSplit - 0.05, tSplit + 0.2);
          if (cut > 0.01) { c.save(); c.setLineDash([9, 7]); c.strokeStyle = INKC(0.85); c.lineWidth = 2.6; c.beginPath(); c.moveTo(X0 + 8 * U, Y0 - 16); c.lineTo(X0 + 8 * U, Y0 - 16 + (3 * U + 32) * cut); c.stroke(); c.restore(); }
        } else {
          piece(c, X0 + 3 * U, Y0, 5 * U, 3 * U, ST_FILL, ST_EDGE, 1, 1);
          const sep = 26 * tw(t, tSplit + 0.15, tSplit + 0.45) * (1 - tw(t, tFive, tFive + 0.3));
          const p = tw(t, tFive, tFive + 1.0, ease.inOutCubic);
          const [bx, by] = bez(p, [X0 + 10.5 * U + sep, Y0 + 1.5 * U], [X0 + 10 * U, Y0 + 8.2 * U], [X0 + 1.5 * U, Y0 + 5.5 * U]);
          const farGlow = tw(t, fC[0] - 0.25, fC[0]) * (1 - tw(t, fC[1], fC[1] + 0.4));
          c.save(); c.translate(bx, by); c.rotate((Math.PI / 2) * p);
          piece(c, -2.5 * U, -1.5 * U, 5 * U, 3 * U, ST_FILL, ST_EDGE, 1, 1);
          c.restore();
          if (farGlow > 0.01 && p >= 1) { s.fillStyle = rgba('signal', 0.16 * farGlow); s.fillRect(X0, Y0 + 3 * U, 3 * U, 5 * U); }
          const cut = 1 - tw(t, tSplit + 0.35, tSplit + 0.7);
          if (cut > 0.01) { c.save(); c.setLineDash([9, 7]); c.strokeStyle = INKC(0.85 * cut); c.lineWidth = 2.6; c.beginPath(); c.moveTo(X0 + 8 * U, Y0 - 16); c.lineTo(X0 + 8 * U, Y0 + 3 * U + 16); c.stroke(); c.restore(); }
          // "5" labels -> "b/2" (L7)
          const a5 = tw(t, tSplit + 0.2, tSplit + 0.5), lb = tw(t, tLb, tLb + 0.15), lbIn = tw(t, tLb + 0.12, tLb + 0.4);
          num(c, '5', X0 + 5.5 * U, Y0 - 22, a5 * (1 - lb), LS);
          ser(c, 'b/2', X0 + 5.5 * U, Y0 - 22, lbIn, 64);
          const lx = lerp(bx, X0 - 24, p), ly = lerp(by - 1.5 * U - 22, Y0 + 5.5 * U + 20, p), al = p < 0.5 ? 'center' : 'right';
          num(c, '5', lx, ly, a5 * (1 - lb), LS, INKC(0.9), al);
          ser(c, 'b/2', X0 - 24, Y0 + 5.5 * U + 18, lbIn, 64, INKC(0.9), 'right');
        }

        // "does not fit" under the overhang
        const nf = tw(t, tNot + 0.1, tNot + 0.4) * (1 - tw(t, tSplit, tSplit + 0.25));
        ser(c, 'does not fit', X0 + 10.5 * U, Y0 + 3 * U + 62, nf, 48);

        // "?" labels of the square; the pulse on 'side'; the amber 3 lands on them; "x" in L7
        const pz = 1 + 0.32 * Math.max(0, Math.sin(clamp((t - tQ) / 0.9) * Math.PI * 2)) * (t > tQ && t < tQ + 0.9 ? 1 : 0);
        const qA = tw(t, tSq + 0.2, tSq + 0.5);
        const land = tw(t, tThree + 0.55, tThree + 0.75), lx3 = tw(t, tLx, tLx + 0.15), lx3In = tw(t, tLx + 0.12, tLx + 0.4);
        const qTop: [number, number] = [X0 + dx + 1.5 * U, Y0 - 22], qLeft: [number, number] = [X0 + dx - 24, Y0 + 1.5 * U + 20];
        for (const [qx, qy, al] of [[qTop[0], qTop[1], 'center'], [qLeft[0], qLeft[1], 'right']] as const) {
          c.save(); c.translate(qx, qy - LS * 0.35); c.scale(pz, pz);
          num(c, '?', 0, LS * 0.35, qA * (1 - land), LS + 8, INKC(0.92), al);
          c.restore();
          num(s, '3', qx, qy, land * (1 - lx3), LS + 4, rgba('signal', 1), al);
          ser(s, 'x', qx, qy, lx3In, 70, rgba('signal', 1), al);
        }

        // lock: solid outline, ring sting
        if (lock > 0) {
          c.strokeStyle = INKC(0.95); c.lineWidth = 5; rectP(c, X0, Y0, 8 * U, 8 * U, lock);
          const r = tw(t, tFill + 0.35, tFill + 1.05, ease.outCubic);
          if (r > 0 && r < 1) { c.strokeStyle = INKC(0.5 * (1 - r)); c.lineWidth = 3; const d = 50 * r; c.strokeRect(X0 - d, Y0 - d, 8 * U + 2 * d, 8 * U + 2 * d); }
        }
        // brackets: eight by eight; the right one splits 3 + 5 on 'away'; the 5 dims on 'five'
        const out7 = 1 - tw(t, s7, s7 + 0.4);
        const br = tw(t, tSideE, tSideE + 0.4), spl = tw(t, tAway, tAway + 0.35), dim = tw(t, tFive14, tFive14 + 0.3);
        if (br > 0.01 && out7 > 0.01) {
          const xr = X0 + 8 * U + 26, yb = Y0 + 8 * U + 26;
          c.save(); c.globalAlpha *= out7;
          bracket(c, 'b', yb, X0, X0 + 8 * U, br, INKC(0.75));
          num(c, '8', X0 + 4 * U, yb + 62, tw(t, tEight14 - 0.1, tEight14 + 0.25), LS);
          const gap = 8 * spl;
          bracket(c, 'r', xr, Y0, Y0 + 3 * U - gap, br, INKC(0.75));
          bracket(c, 'r', xr, Y0 + 3 * U + gap, Y0 + 8 * U, spl > 0 ? 1 : 0, INKC(0.75 * (1 - 0.65 * dim)));
          if (spl <= 0) bracket(c, 'r', xr, Y0, Y0 + 8 * U, br, INKC(0.75));
          num(c, '8', xr + 22, Y0 + 4 * U + 20, tw(t, tEight14 - 0.1, tEight14 + 0.25) * (1 - spl), LS, INKC(0.9), 'left');
          num(c, '5', xr + 22, Y0 + 5.5 * U + 20, spl, LS, INKC(0.9 * (1 - 0.65 * dim)), 'left');
          if (dim > 0.01) { c.strokeStyle = INKC(0.6 * dim); c.lineWidth = 3; c.beginPath(); c.moveTo(xr + 14, Y0 + 5.5 * U + 30); c.lineTo(xr + 14 + 44 * dim, Y0 + 5.5 * U - 22); c.stroke(); }
          // the amber 3: appears on the right, flies across and lands on the "?"
          const a3 = tw(t, tThree - 0.05, tThree + 0.15), f3 = tw(t, tThree + 0.2, tThree + 0.75, ease.inOutCubic);
          if (a3 > 0.01 && f3 < 1) {
            const fx = lerp(xr + 38, qLeft[0] - 18, f3), fy = Y0 + 1.5 * U + 20 - 70 * Math.sin(Math.PI * f3);
            num(s, '3', fx, fy, a3, LS + 4, rgba('signal', 1));
          }
          c.restore();
        }
        for (const x of [c, s]) x.restore();
      }

      // ---------------------------------------------------------------- outside the group
      // "= 39": under the problem, then down to the equation line; it becomes "39 + 25 = 64" on 'Fill'
      {
        const mv = tw(t, tPerf, tPerf + 0.8, ease.inOutCubic), wr = tw(t, tFill + 0.25, tFill + 1.0, ease.linear);
        const out = 1 - tw(t, s7, s7 + 0.4);
        const y = lerp(Y0 + 3 * U + 128, EQY, mv);
        num(c, '= 39', W / 2, y, tw(t, t39 - 0.05, t39 + 0.3) * (1 - wr) * out, 96, INKC(0.9), 'center', tw(t, t39, t39 + 0.45));
        if (wr > 0) num(c, '39 + 25 = 64', W / 2, EQY, out, 96, INKC(0.9), 'center', clamp(0.25 + wr));
      }

      // the demo square: area 64 -> side 8; parks small in the top-left corner; flashes on 'sixty'
      {
        const dA = tw(t, tEasy - 0.35, tEasy + 0.1) * (1 - tw(t, s7, s7 + 0.4));
        if (dA > 0.01) {
          const pk = tw(t, e12 + 0.05, e12 + 0.65, ease.inOutCubic);
          const D = lerp(180, 104, pk), x = lerp(486, 452, pk), y = lerp(438, 238, pk), k = D / 180;
          const fl = Math.max(0, Math.sin(clamp((t - t64) / 0.7) * Math.PI)) * (t > t64 ? 1 : 0);
          c.save(); c.globalAlpha *= dA;
          piece(c, x, y, D, D, SQ_FILL, SQ_EDGE, 1, tw(t, tEasy - 0.35, tEasy + 0.15), 2.6 + 2 * fl);
          mon(c, 'area', x + D / 2, y + D * 0.36, 1 - pk, 32);
          num(c, '64', x + D / 2, y + D * (0.36 + 0.33 * (1 - pk)) + 20 * pk + (1 - pk) * 6, tw(t, tArea + 0.1, tArea + 0.4), lerp(72, 46, pk), INKC(0.9 + 0.1 * fl));
          bracket(c, 'b', y + D + 18, x, x + D, tw(t, tSide12, tSide12 + 0.35), INKC(0.7 + 0.3 * fl), 2.2);
          num(c, '8', x + D / 2, y + D + 18 + lerp(62, 44, pk), tw(t, tEight - 0.05, tEight + 0.25), lerp(64, 38, pk) * (1 + 0.2 * fl), INKC(0.9 + 0.1 * fl));
          c.restore();
        }
      }

      // L7: the problem in his words; its words get letters in place and close up into x² + bx = c
      {
        const aW = tw(t, tWrote - 0.1, tWrote + 0.2);
        if (aW > 0.01) {
          const sp = segPos(c), u = tw(t, tCmp0, tCmp1, ease.inOutCubic);
          const pw = tw(t, tWrote, tWordsE + 0.1, ease.linear);
          for (let i = 0; i < WSEG.length; i++) {
            const lo = tw(t, SYM_T[i]!, SYM_T[i]! + 0.15), li = tw(t, SYM_T[i]! + 0.12, SYM_T[i]! + 0.4);
            const segP = clamp(pw * WSEG.length - i);
            ser(c, WSEG[i]!, sp.wc[i]!, WY, aW * (1 - lo), WSZ, INKC(0.88), 'center', segP);
            ser(c, SYM[i]!, lerp(sp.wc[i]!, sp.sc[i]!, u), WY + 4, li, SSZ, INKC(0.92));
          }
        }
      }

      // the flights: each term glows out of its piece and lands in the formula
      const fly = (s0: [number, number], s1: number[], w: readonly [number, number], label: string, size0: number) => {
        const u = tw(t, w[0], w[1], ease.inOutCubic);
        if (u <= 0 || t > w[1] + 0.12) return;
        const a = tw(t, w[0], w[0] + 0.1) * (1 - tw(t, w[1] - 0.02, w[1] + 0.12));
        const x = lerp(s0[0], s1[0]!, u), y = lerp(s0[1], s1[1]! + 22, u) - 60 * Math.sin(Math.PI * u);
        ser(s, label, x, y, a, lerp(size0, 64, u), rgba('signal', 1));
      };
      fly(P(t, X0 - 44, Y0 + 1.5 * U + 20), FT.a, fX, 'x', 70 * 0.75);
      fly(P(t, X0 + 5.5 * U, Y0 + 5.5 * U + 28), FT.b1, fB, '(b/2)²', 88 * 0.75);
      fly(cPos(t, c), FT.b2, fB, 'c', SSZ);
      fly(P(t, X0 + 5.5 * U, Y0 - 22), FT.c, fC, 'b/2', 64 * 0.75);
      // 'c' glows in the words line as it leaves
      { const g = tw(t, fB[0] - 0.2, fB[0]) * (1 - tw(t, fB[1], fB[1] + 0.3)); if (g > 0.01) { const [x, y] = cPos(t, c); ser(s, 'c', x, y + 4, g, SSZ, rgba('signal', 1)); } }

      // the textbook form, labelled
      ser(c, 'same recipe, general form', FX, FT.eBot + 64, tw(t, tForm + 0.35, tForm + 0.7), 46);
      mon(c, 'for ax² + bx + c = 0', FX, FT.eBot + 112, 0.8 * tw(t, tForm + 0.6, tForm + 0.95), 28);

      c.restore(); s.restore();
    };

    // ---- camera: in from the strip onto frame 000; push to the text while it types; back out to the plate
    // ---- shots: the T3 window (strip arrival, typing push, lift-out, dissolve), then the plate crossfading in
    const fillK = (k: number) => (k === -1 ? '#0A0A0B' : STRIP.dark);
    const t3s = t3.shot({
      t0,
      paint: (o, p) => {
        if (!inStrip(ib, o.t)) { p(o); return; }
        drawStrip(o, {
          cx: W / 2, cy: H / 2, frames: 5, first: STRIP.first(2), live: 0, fill: fillK, on: 0, scroll: inScroll(ib, o.t),
          inner: (oo, k, x, y, w, h) => {
            if (k === 0) { oo.c.translate(x, y); oo.s.translate(x, y); p(oo); }
            else if (k === -1) drawFrame(oo.c, prev, x, y, w, h);
          },
        });
      },
    });
    // strip arrival first, then the kit's push to the text (its z-1 key at the line start is already behind us)
    t3s.cam = [...inCam(ib), ...t3.keys().filter((k) => k[0] > ib.push1 + 0.05)];
    const kitDrift = t3s.drift!, inD = inDrift(ib);
    t3s.drift = (t) => Math.min(inD(t), kitDrift(t));
    const cam: CamKey[] = [
      K(dis0, W / 2, H / 2 - 10, 1.08), K(dis1 + 0.5, W / 2, H / 2, 1.0),
      K(tPerf, W / 2, H / 2, 1.015), K(tCorner, W / 2, H / 2, 1.03), K(tThree + 0.8, W / 2, H / 2, 1.03),
      K(s7 + 0.9, W / 2, H / 2, 1.0), K(tEnd, W / 2, H / 2, 1.01),
    ];
    // post: ink while the T3 window is up (dark UI, light captions), then the shots' own crossfade to paper
    this.postPaper = (t, paper) => (t < dis0 ? 0 : paper);
    void ob; void handPost;
    this.shots = [t3s, {
      t0: dis1, t1: tEnd, paper: 1, fi: dis1 - dis0, fo: 0.001, cam,
      draw: (o) => plate(o, 0, 0),
      hud: (o) => {
        const { c, t } = o;
        if (t >= dis1 - 0.02) t3.title(o);
        // FIG. kicker (the title shrinks into it)
        fig2(c, 'FIG. 2', 'COMPLETING THE SQUARE', tw(t, s9 + 0.2, s9 + 0.6), true);
        // speaker tags (screen space, inside the square), hairline leader towards the figure
        const aS = tagA(t, 'STUDENT'), aK = tagA(t, 'KHWARIZMI');
        if (aS > 0.01) {
          txt(c, 'STUDENT · DRAMATIZED', 440, 152, { size: 30, f: F.mono(500), align: 'left', ls: 1, col: INKC(0.85 * aS) });
          c.strokeStyle = INKC(0.4 * aS); c.lineWidth = 1.4; c.beginPath(); c.moveTo(432, 144); c.lineTo(330, 236); c.stroke();
        }
        if (aK > 0.01) {
          txt(c, 'AL-KHWARIZMI', 1480, 152, { size: 30, f: F.mono(500), align: 'right', ls: 1, col: INKC(0.85 * aK) });
          c.strokeStyle = INKC(0.4 * aK); c.lineWidth = 1.4; c.beginPath(); c.moveTo(1488, 144); c.lineTo(1610, 236); c.stroke();
        }
        // source note for the figures, while the courtyard first shows
        const aSrc = tw(t, dis1 - 0.1, dis1 + 0.3) * (1 - tw(t, tTen, tTen + 0.4));
        txt(c, "figures after al-Wasiti's Maqamat miniature, Baghdad", 440, 890, { size: 24, f: F.mono(500), align: 'left', col: INKC(0.55 * aSrc) });
        // CENTURIES LATER (before any letter appears)
        const aC = tw(t, tCent - 0.05, tCent + 0.3);
        if (aC > 0.01) {
          txt(c, 'CENTURIES LATER', W / 2, 150, { size: 34, f: F.mono(500), align: 'center', ls: 4, col: INKC(0.85 * aC) });
          c.fillStyle = INKC(0.35 * aC);
          c.fillRect(W / 2 - 440 * aC, 138, 240 * aC, 1.4); c.fillRect(W / 2 + 200 * aC, 138, 240 * aC, 1.4);
        }
      },
    }];
  }

  protected override underlay(t: number, out: THREE.WebGLRenderTarget, cam: Cam) {
    this.m.draw(this.ctx.renderer, this.ctx.comp, out, t, cam);
  }
}
