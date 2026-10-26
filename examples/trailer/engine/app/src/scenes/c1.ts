// Trailer C1 "A chatbot's next word" (v2; dark-math look; original code). Every line is in Short S02, so all text sits
// inside x 420-1500 and above the caption band.
//   L8  GOAL FIRST (shared trailer_t3_kit). The T3 composer (frame 000 at z 1, handed over by C0's card push) types the prompt with the
//       director's voice (frame by typed prefix, own caret, «prompt re-typed for this trailer» tag); the camera pushes
//       into the text; on `word` the prompt lifts out as scene text and settles as the chapter title; the UI dissolves
//       into the ink plate. The sentence writes in as token chips with an empty slot holding a «?» after 'tired'.
//   L2  on `space` the tokens lift into a slowly rotating 3D embedding cloud; on `related` 'cat' drifts next to 'mat'
//       and the pair glows (reused from v1).
//   L6  the reason first ("to know what 'it' means"): the cloud folds back into the rows; on the quoted `it` faint
//       lines run from 'it' to every earlier word; on `back` they take their weights; on "the cat" the line to
//       'The cat' turns amber. Corner tag ILLUSTRATIVE.
//   L7  payoff: the «?» slot opens into a panel where next-word bars race (`weighs`), the long tail appears on `every`,
//       the bars settle on `probability`; on `picks` a marker samples one and 'and' drops up into the slot.
//       P(next word) is set by the manim-web layer. Then the film-strip hand-off (spill: C2 does the pull-back).
// The amber signal moves with the story: the cat/mat pair (L2), 'it' and its line to 'The cat' (L6), the picked word (L7).
import type * as THREE from 'three';
import { ShotScene, W, H, rgba, tw, ease, lerp, clamp, type SC, type Cam, type CamKey } from './_shots';
import { fig2, lab, schematic, K } from './_devices';
import { ManimLayer, M, MC, toM } from './_manim';
import { mulberry32 } from '../engine/util';
import { STRIP, drawStrip, outro, outCam, outScroll, handPost, stripAmount } from './trailer_filmstrip_kit';
import { t3Line } from './trailer_t3_kit';

const CX = W / 2;
const PROMPT = 'C1-L8';
export const T3_C1 = 't3/C1-L8/index.json'; // named as a literal so the render receipt hashes the capture

// ---- tokens: "The cat sat on the mat / because it was tired [?]"
const TOK = ['The', 'cat', 'sat', 'on', 'the', 'mat', 'because', 'it', 'was', 'tired'];
const ROW = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1];
const IT = 7, SLOT = TOK.length;
const FS = 56, CH = 86, PADX = 20, GAP = 20;         // chip font, height, padding, gap (IBM Plex Mono advance 0.6 em)
const FS3 = 40;                                      // label size in the 3D cloud
const chipW = (s: string, fs = FS) => s.length * fs * 0.6 + PADX * 2;
const SLOT_W = chipW('tired');

// 3D embedding positions (unit cube). Function words together, verbs and states together; 'cat' moves next to 'mat'.
const P3: [number, number, number][] = [
  [-0.78, 0.42, 0.22], [-0.25, 0.70, -0.62], [0.18, 0.74, 0.18], [-0.85, 0.05, -0.55], [-0.62, 0.58, 0.40],
  [0.74, -0.40, 0.42], [-0.70, -0.62, -0.35], [-0.05, -0.66, -0.45], [0.42, 0.56, -0.28], [0.36, 0.10, -0.80],
];
const CAT_NEAR: [number, number, number] = [0.56, -0.20, 0.58];
// illustrative attention weights from 'it' to each earlier token (line width only; never printed)
const ATT = [0.30, 0.42, 0.04, 0.02, 0.03, 0.08, 0.06];
// next-word candidates (illustrative, no numbers on screen); the first one is the one sampled
const CAND = ['and', 'after', 'from', 'so'];
const PFIN = [0.92, 0.50, 0.34, 0.22];

const roundRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  c.beginPath(); c.roundRect(x, y, w, h, r);
};

export default class C1 extends ShotScene {
  m!: ManimLayer;
  scroll: (t: number) => number = () => 0;

  async build() {
    const q = this.q;
    // ---- cues (all word lookups)
    // the T3 opening (shared kit): arrive at z 1 on frame 000, type with the push, lift out on `word`, dissolve
    const t3 = await t3Line(q, PROMPT, 'word', { title: { paper: 0, y: 158, size: 54 } });
    const tPlate = t3.tm.dis1;
    const l2s = q.s('C1-L2'), tSpace = q.w('C1-L2', 'space'), tRelated = q.w('C1-L2', 'related'), tClose = q.w('C1-L2', 'close');
    const l2e = q.end('C1-L2');
    const l6s = q.s('C1-L6'), tIt = q.w('C1-L6', 'it'), tBack = q.w('C1-L6', 'back'), tCat = q.w('C1-L6', 'the', 1); // the quoted "the cat", not "the model"
    const l7s = q.s('C1-L7'), tWeighs = q.w('C1-L7', 'weighs'), tEvery = q.w('C1-L7', 'every');
    const tProb = q.w('C1-L7', 'probability'), tPicks = q.w('C1-L7', 'picks');
    const tLand = tPicks + 0.22, tDrop = tLand + 0.38;  // the chapter then holds full size to its end (spill hand-off)

    // ---- the math layer: P(next word), written as the bars race
    this.m = new ManimLayer((m) => {
      const eq = m.add(m.tex('P(\\,\\text{next word}\\,)', { color: MC.bone, fontSize: 50 }), tWeighs - 0.1).moveTo(toM(684, 610));
      m.play(new M.Write(eq, { duration: 0.8 }), tWeighs - 0.1);
    });
    await this.m.init();

    // ---- layout of the chip rows: L2-L6 low, raised for L7 (room for the bar panel)
    const rowsUp = (t: number) => tw(t, l7s - 0.2, l7s + 0.5, ease.inOutCubic);
    const rowY = (r: number, t: number) => lerp(r ? 590 : 410, r ? 384 : 270, rowsUp(t));
    const rowX: number[] = [];
    for (const r of [0, 1]) {
      const idx = TOK.map((_, i) => i).filter((i) => ROW[i] === r);
      const ws = idx.map((i) => chipW(TOK[i]!));
      if (r === 1) ws.push(SLOT_W);
      let x = CX - (ws.reduce((a, b) => a + b, 0) + GAP * (ws.length - 1)) / 2;
      idx.forEach((i, k) => { rowX[i] = x + ws[k]! / 2; x += ws[k]! + GAP; });
      if (r === 1) rowX[SLOT] = x + SLOT_W / 2;
    }
    const chipPos = (i: number, t: number): [number, number] => [rowX[i]!, rowY(i === SLOT ? 1 : ROW[i]!, t)];

    // ---- the 3D cloud (reused from v1)
    const rnd = mulberry32(1107);
    const gauss = () => { let s = 0; for (let k = 0; k < 4; k++) s += rnd(); return (s - 2) * 0.62; };
    const DUST: [number, number, number][] = Array.from({ length: 110 }, () => [gauss(), gauss(), gauss()]);
    const CC = { x: CX, y: 560, S: 285, f: 3.4 };
    const yaw = (t: number) => 0.55 + 0.24 * (t - tSpace);
    const PITCH = 0.32;
    const proj = (p: [number, number, number], t: number): [number, number, number] => {
      const a = yaw(t), ca = Math.cos(a), sa = Math.sin(a);
      const x1 = p[0] * ca + p[2] * sa, z1 = -p[0] * sa + p[2] * ca;
      const cb = Math.cos(PITCH), sb = Math.sin(PITCH);
      const y2 = p[1] * cb - z1 * sb, z2 = p[1] * sb + z1 * cb;
      const k = CC.f / (CC.f - z2);
      return [CC.x + CC.S * x1 * k, CC.y - CC.S * y2 * k, z2];
    };
    const catMove = (t: number) => tw(t, tRelated - 0.1, tClose + 0.5, ease.inOutCubic);
    const p3 = (i: number, t: number): [number, number, number] => {
      if (i !== 1) return P3[i]!;
      const u = catMove(t), a = P3[1]!;
      return [lerp(a[0], CAT_NEAR[0], u), lerp(a[1], CAT_NEAR[1], u), lerp(a[2], CAT_NEAR[2], u)];
    };
    // up into the cloud on `space`; back into the rows in the gap before L6, done before the quoted "it"
    const up = (t: number) => tw(t, tSpace - 0.35, tSpace + 0.9, ease.inOutCubic) * (1 - tw(t, l2e + 0.05, Math.min(tIt - 0.12, l6s + 0.55), ease.inOutCubic));

    const tokPos = (i: number, t: number): [number, number, number] => {
      const u = up(t), a = chipPos(i, t);
      if (u <= 0) return [a[0], a[1], 0];
      const b = proj(p3(i, t), t);
      return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), b[2] * u];
    };
    // the sentence writes in once the composer has dissolved, before L2's "each word"
    const tokIn = (i: number) => lerp(tPlate - 0.25, l2s + 0.6, i / (TOK.length - 1));
    const slotIn = tokIn(TOK.length - 1) + 0.25;

    const drawChip = (o: SC, s: string, x: number, y: number, a: number, chipA: number, size: number, hot: number) => {
      const c = o.c;
      const w = chipW(s, size), h = lerp(60, CH, (size - FS3) / (FS - FS3));
      if (chipA > 0.01) {
        c.save(); c.globalAlpha *= a * chipA;
        roundRect(c, x - w / 2, y - h / 2, w, h, 8);
        c.fillStyle = rgba('ink2', 0.92); c.fill();
        c.strokeStyle = rgba('bone', 0.42); c.lineWidth = 1.4; c.stroke();
        c.restore();
      }
      lab(c, s, x, y + size * 0.35, a * (1 - hot), rgba('bone', 0.95), size, 'center', 500, 0);
      if (hot > 0.01) {
        const sg = o.s;
        sg.save(); sg.globalAlpha *= a * hot * chipA;
        roundRect(sg, x - w / 2, y - h / 2, w, h, 8);
        sg.strokeStyle = rgba('signal', 0.95); sg.lineWidth = 2.2 * chipA + 1.2; sg.stroke();
        sg.restore();
        lab(sg, s, x, y + size * 0.35, a * hot, rgba('ember', 1), size, 'center', 600, 0);
      }
    };

    // attention line from 'it' (row 1) to token i: an arc between the rows (row 0) or under row 1 ('because')
    const attPath = (c: CanvasRenderingContext2D, i: number, t: number, p = 1) => {
      const [xj, yj] = chipPos(IT, t), [xi, yi] = chipPos(i, t);
      const h2 = CH / 2, pts = 32;
      c.beginPath();
      if (ROW[i] === 1) {
        const ya = yj + h2, hh = 30 + 0.2 * Math.abs(xj - xi);
        for (let k = 0; k <= pts * p; k++) {
          const u = k / pts;
          const x = lerp(xj, xi, u), y = ya + hh * 4 * u * (1 - u);
          k ? c.lineTo(x, y) : c.moveTo(x, y);
        }
      } else {
        const ya = yj - h2, yb = yi + h2, ym = (ya + yb) / 2;
        for (let k = 0; k <= pts * p; k++) {
          const u = k / pts, v = 1 - u;
          const x = v * v * v * xj + 3 * v * v * u * xj + 3 * v * u * u * xi + u * u * u * xi;
          const y = v * v * v * ya + 3 * v * v * u * ym + 3 * v * u * u * ym + u * u * u * yb;
          k ? c.lineTo(x, y) : c.moveTo(x, y);
        }
      }
    };

    // ---- plate camera (the T3 shot has its own push-in keys): the v1 drift
    const ho = outro('C1');
    const cam: CamKey[] = [
      K(tPlate - 0.5, CX, H / 2, 1.0),
      K(tSpace, CX, H / 2, 1.0), K(tClose + 0.4, CX, H / 2, 1.03), K(tIt, CX, H / 2, 1.0),
      K(tCat + 0.3, CX, H / 2, 1.02), K(l7s + 0.3, CX, H / 2, 1.0), K(tDrop + 0.3, CX, H / 2, 1.0), K(ho.cut, CX, H / 2, 1.012),
      ...outCam(ho),
    ];
    this.scroll = (t: number) => outScroll(ho, t);
    this.postPaper = (t: number) => handPost(ho, 'out', t);
    const bone = rgba('bone', 1);
    const fillK = (k: number) => (k === 1 ? (STRIP.plate.C2 ? bone : rgba('ink', 1)) : STRIP.dark);

    const plate = (o: SC) => {
      const t = o.t, c = o.c, sg = o.s;
      const u = up(t);

      // --- 3D axes, ground grid and dust (L2)
      if (u > 0.01) {
        c.save(); c.globalAlpha *= u;
        const O = proj([0, 0, 0], t);
        c.strokeStyle = rgba('ash', 0.10); c.lineWidth = 1;
        for (let k = -4; k <= 4; k++) {
          const g = k / 4;
          const a1 = proj([g, -0.95, -1], t), b1 = proj([g, -0.95, 1], t);
          const a2 = proj([-1, -0.95, g], t), b2 = proj([1, -0.95, g], t);
          c.beginPath(); c.moveTo(a1[0], a1[1]); c.lineTo(b1[0], b1[1]); c.moveTo(a2[0], a2[1]); c.lineTo(b2[0], b2[1]); c.stroke();
        }
        const axes: [number, number, number][] = [[1.15, 0, 0], [0, 1.0, 0], [0, 0, 1.15]];
        c.strokeStyle = rgba('ash', 0.55); c.lineWidth = 1.3;
        for (const ax of axes) {
          const a = proj([-ax[0], -ax[1], -ax[2]], t), b = proj(ax, t);
          c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
          const d = Math.hypot(b[0] - O[0], b[1] - O[1]) || 1, ux = (b[0] - O[0]) / d, uy = (b[1] - O[1]) / d;
          c.fillStyle = rgba('ash', 0.7);
          c.beginPath(); c.moveTo(b[0] + ux * 12, b[1] + uy * 12); c.lineTo(b[0] - uy * 6, b[1] + ux * 6); c.lineTo(b[0] + uy * 6, b[1] - ux * 6); c.fill();
        }
        const dIn = tw(t, tSpace, tSpace + 1.4);
        for (let k = 0; k < DUST.length; k++) {
          const p = proj(DUST[k]!, t);
          const a = dIn * clamp(0.18 + 0.22 * (p[2] + 1)) * clamp((dIn * DUST.length - k) / 8);
          if (a <= 0) continue;
          c.fillStyle = rgba('bone', a);
          c.beginPath(); c.arc(p[0], p[1], 2.2 + p[2] * 0.6, 0, Math.PI * 2); c.fill();
        }
        c.restore();

        // vectors from the origin to each token; cat & mat glow once they are close
        const glow = tw(t, tClose - 0.2, tClose + 0.5) * u;
        for (let i = 0; i < TOK.length; i++) {
          const [x, y] = tokPos(i, t);
          const hot = (i === 1 || i === 5) ? glow : 0;
          const vecIn = tw(t, tSpace + 0.2 + i * 0.07, tSpace + 0.9 + i * 0.07);
          const ctx = hot > 0.5 ? sg : c;
          ctx.save(); ctx.globalAlpha *= u * vecIn;
          ctx.strokeStyle = hot > 0.5 ? rgba('signal', 0.95) : rgba('bone', 0.55); ctx.lineWidth = hot > 0.5 ? 2.4 : 1.3;
          ctx.beginPath(); ctx.moveTo(O[0], O[1]); ctx.lineTo(x, y); ctx.stroke();
          ctx.fillStyle = hot > 0.5 ? rgba('ember', 1) : rgba('bone', 0.9);
          ctx.beginPath(); ctx.arc(x, y, hot > 0.5 ? 6 : 4.5, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
        const ring = tw(t, tClose, tClose + 0.6) * u;
        if (ring > 0.01) {
          const a = tokPos(1, t), b = tokPos(5, t);
          const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, r = Math.hypot(a[0] - b[0], a[1] - b[1]) / 2 + 62;
          sg.save(); sg.globalAlpha *= ring; sg.strokeStyle = rgba('signal', 0.7); sg.lineWidth = 1.5; sg.setLineDash([7, 7]);
          sg.beginPath(); sg.arc(mx, my, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ring); sg.stroke(); sg.restore();
        }
      }

      // --- attention (L6): on the quoted "it", faint lines to every earlier word; on `back` they take their
      // weights; on "the cat" the line to 'The cat' turns amber
      const attA = tw(t, tIt - 0.05, tIt + 0.3) * (1 - tw(t, l7s - 0.4, l7s + 0.1));
      if (attA > 0.01) {
        const wgt = tw(t, tBack - 0.1, tBack + 0.5, ease.inOutCubic);
        const hotCat = tw(t, tCat - 0.05, tCat + 0.4);
        for (let i = 0; i < IT; i++) {
          const toCat = i <= 1;
          const w = lerp(1.4, 0.8 + ATT[i]! * 9, wgt);
          const al = lerp(0.55, toCat ? 0.85 : 0.75 - 0.4 * wgt, wgt) * (toCat ? 1 - hotCat : 1 - 0.35 * hotCat);
          const p = tw(t, tIt + i * 0.05, tIt + 0.5 + i * 0.05, ease.outCubic);
          c.save(); c.globalAlpha *= attA * al;
          c.strokeStyle = rgba('bone', 0.75); c.lineWidth = w;
          attPath(c, i, t, p); c.stroke(); c.restore();
          if (toCat && hotCat > 0.01) {
            sg.save(); sg.globalAlpha *= attA * hotCat; sg.strokeStyle = rgba('signal', 0.95); sg.lineWidth = w;
            attPath(sg, i, t, tw(t, tCat - 0.05, tCat + 0.45)); sg.stroke(); sg.restore();
          }
        }
        // "the cat": an amber overline above the pair
        const ul = tw(t, tCat - 0.05, tCat + 0.4);
        if (ul > 0.01) {
          const [xa, ya] = chipPos(0, t), [xb] = chipPos(1, t);
          const x0 = xa - chipW('The') / 2, x1 = xb + chipW('cat') / 2;
          sg.save(); sg.globalAlpha *= attA; sg.strokeStyle = rgba('signal', 0.9); sg.lineWidth = 2.5;
          sg.beginPath(); sg.moveTo(x0, ya - CH / 2 - 14); sg.lineTo(lerp(x0, x1, ul), ya - CH / 2 - 14); sg.stroke(); sg.restore();
        }
      }

      // --- tokens (chips in rows, labels in the cloud)
      const order = TOK.map((_, i) => i).sort((a, b) => tokPos(a, t)[2] - tokPos(b, t)[2]);
      for (const i of order) {
        const a = tw(t, tokIn(i), tokIn(i) + 0.3, ease.outCubic);
        if (a <= 0) continue;
        const [x, y, z] = tokPos(i, t);
        const size = lerp(FS, FS3, u);
        const mv = catMove(t), off = i === 1 ? [-62 * mv, lerp(-30, -22, mv)] : i === 5 ? [78 * mv, lerp(-30, 12, mv)] : [0, -30];
        const xx = x + u * off[0]!;
        const yy = y + (1 - a) * 14 + u * off[1]!;
        const depthA = lerp(1, clamp(0.6 + 0.3 * (z + 1)), u);
        let hot = 0;
        if (i === IT) hot = tw(t, tIt - 0.05, tIt + 0.3) * (1 - tw(t, l7s - 0.3, l7s + 0.3));
        if ((i === 1 || i === 5) && u > 0.5) hot = tw(t, tClose - 0.2, tClose + 0.5) * clamp((u - 0.5) * 2);
        drawChip(o, TOK[i]!, xx, yy, a * depthA, 1 - u, size, hot);
      }

      // --- the «?» slot (the goal, from the end of L8) and its filling (L7)
      const [sx, sy] = chipPos(SLOT, t);
      const fill = tw(t, tDrop - 0.05, tDrop + 0.2);
      {
        const a = tw(t, slotIn, slotIn + 0.4) * (1 - u);
        if (a > 0.01 && fill < 1) {
          c.save(); c.globalAlpha *= a * (1 - fill);
          roundRect(c, sx - SLOT_W / 2, sy - CH / 2, SLOT_W, CH, 8);
          c.setLineDash([6, 6]); c.strokeStyle = rgba('bone', 0.6); c.lineWidth = 1.6; c.stroke();
          c.restore();
          const pulse = 0.8 + 0.2 * Math.sin((t - slotIn) * 3.2);
          lab(c, '?', sx, sy + FS * 0.35, a * (1 - fill) * pulse, rgba('bone', 0.9), FS, 'center', 600, 0);
        }
        if (fill > 0.01) {
          c.save(); c.globalAlpha *= fill; roundRect(c, sx - SLOT_W / 2, sy - CH / 2, SLOT_W, CH, 8); c.fillStyle = rgba('ink2', 0.92); c.fill(); c.restore();
          sg.save(); sg.globalAlpha *= fill;
          roundRect(sg, sx - SLOT_W / 2, sy - CH / 2, SLOT_W, CH, 8);
          sg.strokeStyle = rgba('signal', 0.95); sg.lineWidth = 2.4; sg.stroke(); sg.restore();
          lab(sg, CAND[0]!, sx, sy + FS * 0.35, fill, rgba('ember', 1), FS, 'center', 600, 0);
        }
      }

      // --- the slot opens into a panel of next-word bars (L7), hanging from the slot; folds back after the pick
      const open = tw(t, l7s + 0.25, l7s + 0.75, ease.outCubic) * (1 - tw(t, tDrop + 0.1, tDrop + 0.55, ease.inOutCubic));
      if (open > 0.01) {
        const PW = 560, PR = sx + SLOT_W / 2, PX = PR - PW, PY = sy + CH / 2 + 10;
        const DY = 70, BH = 34, LX = PX + 46, BX = PX + 172, LMAX = PW - 172 - 26;
        const PH = 40 + CAND.length * DY + 96;
        // panel frame (unfolds downward from the slot)
        c.save();
        c.beginPath(); c.rect(PX - 4, PY - 4, PW + 8, PH * open + 8); c.clip();
        roundRect(c, PX, PY, PW, PH, 10);
        c.fillStyle = rgba('ink2', 0.9); c.fill();
        c.strokeStyle = rgba('bone', 0.4); c.lineWidth = 1.4; c.setLineDash([6, 6]); c.stroke(); c.setLineDash([]);
        // a hairline from the slot into the panel
        c.strokeStyle = rgba('bone', 0.35); c.beginPath(); c.moveTo(sx, sy + CH / 2); c.lineTo(sx, PY); c.stroke();
        c.restore();
        const inA = open * tw(t, l7s + 0.55, l7s + 0.9);
        const grow = tw(t, tWeighs, tEvery + 0.5, ease.outCubic);
        const settle = tw(t, tProb - 0.3, tPicks - 0.15, ease.inOutCubic);
        const sel = tw(t, tLand - 0.05, tLand + 0.2);
        for (let i = 0; i < CAND.length; i++) {
          const y = PY + 40 + i * DY + DY / 2 - 10;
          if (y > PY + PH * open - 10) continue;
          const race = 0.5 + 0.32 * Math.sin(t * (5.1 + i * 1.7) + i * 2.3) + 0.14 * Math.sin(t * (11.3 - i) + i);
          const len = LMAX * grow * lerp(race, PFIN[i]!, settle);
          const hot = i === 0 ? sel : 0;
          lab(c, CAND[i]!, LX, y + 13, inA * (1 - hot), rgba('bone', 0.92), 36, 'left', 500, 0);
          c.save(); c.globalAlpha *= inA * (1 - hot);
          c.fillStyle = rgba('bone', 0.16); c.fillRect(BX, y - BH / 2, len, BH);
          c.strokeStyle = rgba('bone', 0.6); c.lineWidth = 1.2; c.strokeRect(BX, y - BH / 2, len, BH);
          c.restore();
          if (hot > 0.01) {
            sg.save(); sg.globalAlpha *= inA * hot;
            sg.fillStyle = rgba('signal', 0.55); sg.fillRect(BX, y - BH / 2, len, BH);
            sg.strokeStyle = rgba('ember', 1); sg.lineWidth = 1.6; sg.strokeRect(BX, y - BH / 2, len, BH);
            sg.restore();
            const gone = tw(t, tLand + 0.02, tLand + 0.12);
            lab(sg, CAND[i]!, LX, y + 13, inA * hot * (1 - 0.8 * gone), rgba('ember', 1), 36, 'left', 600, 0);
          }
        }
        // the long tail: every other word it knows
        const yT = PY + 40 + CAND.length * DY + 6;
        const tailA = inA * tw(t, tEvery, tEvery + 0.7);
        if (tailA > 0.01 && yT + 60 < PY + PH * open) {
          const r = mulberry32(77);
          c.save(); c.globalAlpha *= tailA; c.strokeStyle = rgba('bone', 0.45); c.lineWidth = 1;
          const n = 90;
          for (let k = 0; k < n; k++) {
            const x = BX + (k / n) * LMAX * 0.98;
            const h = (4 + 20 * Math.pow(r(), 3)) * grow * (1 - 0.6 * k / n);
            c.beginPath(); c.moveTo(x, yT + 10); c.lineTo(x, yT + 10 - h); c.stroke();
          }
          c.restore();
          lab(c, '…', LX, yT + 8, tailA, rgba('bone', 0.8), 36, 'left', 500, 0);
          lab(c, 'every other word', BX, yT + 50, tailA, rgba('ash', 0.95), 26, 'left', 500, 1);
        }
        // the sampling marker: runs down the list on `picks` and lands on the first candidate
        const spin = clamp((t - (tPicks - 0.1)) / (tLand - tPicks + 0.1));
        const mA = inA * tw(t, tPicks - 0.15, tPicks + 0.05) * (1 - tw(t, tDrop, tDrop + 0.3));
        if (mA > 0.01) {
          const steps = CAND.length * 2;
          const idx = Math.min(steps, Math.floor(ease.outCubic(spin) * (steps + 0.999))) % CAND.length;
          const y = PY + 40 + idx * DY + DY / 2 - 10, x = PX + 22;
          const ctx = spin >= 1 ? sg : c;
          ctx.save(); ctx.globalAlpha *= mA; ctx.fillStyle = spin >= 1 ? rgba('signal', 1) : rgba('bone', 0.9);
          ctx.beginPath(); ctx.moveTo(x + 14, y); ctx.lineTo(x - 4, y - 11); ctx.lineTo(x - 4, y + 11); ctx.closePath(); ctx.fill(); ctx.restore();
        }
        // the picked word rises into the slot
        const fly = tw(t, tLand + 0.05, tDrop, ease.inOutCubic);
        const flyA = tw(t, tLand + 0.02, tLand + 0.12);
        if (fly > 0.001 && fly < 1) {
          const ax = LX + chipW(CAND[0]!, 36) / 2 - PADX, ay = PY + 40 + DY / 2 - 10;
          const x = lerp(ax, sx, fly), y = lerp(ay, sy, fly) - Math.sin(fly * Math.PI) * 50;
          lab(sg, CAND[0]!, x, y + lerp(13, FS * 0.35, fly), flyA, rgba('ember', 1), lerp(36, FS, fly), 'center', 600, 0);
        }
      }

      // kicker and honesty tag live in the frame (world space), so they would travel with it into a strip
      const plateA = tw(t, tPlate - 0.4, tPlate + 0.2);
      fig2(c, 'FIG. 1', "A CHATBOT'S NEXT WORD", plateA, false, 452, 74);
      // the attention map and the bars are illustrative, not measured
      schematic(c, 1470, 74, tw(t, l6s, l6s + 0.5), false, 'right', 'ILLUSTRATIVE');
    };

    this.shots = [t3.shot({ t0: this.ctx.start }), {
      t0: tPlate, t1: this.ctx.end + 0.5, paper: 0, fi: 0.5, fo: 0.3, cam,
      draw: (o: SC) => drawStrip(o, {
        cx: W / 2, cy: H / 2, frames: 5, first: STRIP.first(1), live: 0, scroll: this.scroll(o.t), fill: fillK,
        inner: (o2, k, _x, y) => {
          if (k !== 0) return;
          o2.c.translate(0, y); o2.s.translate(0, y);
          plate(o2);
        },
      }),
      // screen space: the lifted prompt, now the chapter title (the T3 shot draws it until dis1)
      hud: (o: SC) => {
        if (o.t < tPlate - 0.02) return;
        const a = 1 - stripAmount(Math.min(1, o.cam.z));
        if (a > 0.01) { o.c.save(); o.c.globalAlpha = a; t3.title(o); o.c.restore(); }
      },
    }];
  }

  protected override underlay(t: number, out: THREE.WebGLRenderTarget, cam: Cam) {
    // the math layer rides with the live frame if the strip ever slides up
    this.m.draw(this.ctx.renderer, this.ctx.comp, out, t, { ...cam, y: cam.y + this.scroll(t) * STRIP.pitch });
  }
}

