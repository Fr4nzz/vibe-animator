// C0 · What vibe-animator does (v2). Engraved bone-paper plate + the real T3 Code window. Every line is in Short S01,
// so all scene text sits in x 420–1500, above y 900.
// Storyboard:
//  L6   Fourier epicycles (ink hairline arms) trace the mark in blood; on «vibe-animator» the wordmark writes in under it.
//  L7   the mark's frame opens into the full T3 Code window (x 480–1440): the REAL session (t3/session, 48 s shown in
//       ~7 s) plays from «You», kicker REAL SESSION… above it, «T3 Code» credit under its bottom-left corner; the camera
//       pushes in slowly; four engraved chips SCRIPT / VOICES / ANIMATION / SHORTS pop in under it on their words.
//  L10  the window dissolves; four T3 composer cards (the four prompts, fully typed, 2× crops) stack in a column with
//       an empty 16:9 slot right of each; one «prompt re-typed» tag under the column. On each phrase's first word a
//       real full-screen frame of that chapter (chapterFrame) holds 0.4 s, then FLIPs into its slot (0.6 s outCubic).
//       After «law» the camera pushes into card 1 until it sits exactly on composer_bbox of a full T3 frame; the
//       other cards and slots fade, the full C1 frame 000 fades in around the card and the prompt un-types, so C1
//       opens on frame 000 at z 1.
import { ShotScene, W, H, rgba, tw, ease, txt, clamp, lerp, font, F, loadImg, type SC } from './_shots';
import { lab, K } from './_devices';
import { chapterFrame, drawFrame } from './trailer_filmstrip_kit';
import { markPoints, dft, wordmark } from './kit_c5c6';
import { t3Frames, t3Composer, t3Draw, t3Tag, t3FrameIdx, type T3Seq } from './trailer_t3_kit';

const L = (n: number) => `C0-L${n}`;
const SESSION = 't3/session/index.json';
const CH = ['C1', 'C2', 'C3', 'C4'] as const;
const LINES = ['C1-L8', 'C2-L8', 'C3-L7', 'C4-L5'] as const;
const TITLES = ["A chatbot's next word", 'Completing the square', 'P versus NP', "Kepler's page"];
const PLATE: Record<string, 0 | 1> = { C1: 0, C2: 1, C3: 0, C4: 1 };

// ---- layout (world = screen at z 1)
const MARK = { x: 960, y: 380, s: 150 };                        // mark centre and unit (curve fits ±1)
const WIN = { x: 480, y: 170, w: 960, h: 540 };                  // the T3 window (frame scale 0.5)
const CARD = { x: 430, w: 600, h: 116 }, SLOT = { x: 1060, w: 320, h: 180 }, ROW0 = 96, PITCH = 192;
const slotY = (i: number) => ROW0 + i * PITCH;
const cardY = (i: number) => slotY(i) + (SLOT.h - CARD.h) / 2;

/** Offscreen placeholder plate for a chapter not built yet (an image: its text is a picture, not layout). */
function placeholder(i: number): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const look = ['dark', 'wash', 'dark', 'engraved'][i]!;
  g.fillStyle = look === 'dark' ? '#0B0B0C' : look === 'wash' ? '#E7DCC4' : '#EEE9DF'; g.fillRect(0, 0, W, H);
  if (look === 'wash') for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(150,170,180,${0.08 + 0.03 * k})`; g.beginPath(); g.ellipse(300 + k * 230, 700 - (k % 3) * 120, 260, 170, 0.3 * k, 0, 6.3); g.fill(); }
  g.fillStyle = look === 'dark' ? '#EEE9DF' : '#141414';
  g.font = font(F.serif(600, true), 110); g.textAlign = 'center'; g.fillText(TITLES[i]!, W / 2, H / 2);
  g.font = font(F.mono(500), 36); g.fillText('PREVIEW PENDING', W / 2, H / 2 + 90);
  return cv;
}

export default class C0 extends ShotScene {
  async build() {
    const q = this.q, ctx = this.ctx;
    const tEnd = ctx.end;
    const tWord = q.w(L(6), 'vibe-animator');
    const tYou = q.s(L(7));
    const tChips = ['script', 'voices', 'animation', 'Shorts'].map((w) => q.w(L(7), w));
    const t10 = q.s(L(10));
    const tPh = [q.w(L(10), "chatbot's"), q.w(L(10), 'completing'), q.w(L(10), 'P'), q.w(L(10), "Kepler's")];
    const tLaw = q.e(L(10), 'law');
    // the window opens between the wordmark's hold and «You»
    const tOpen0 = Math.min(tWord + 0.95, tYou - 0.75), tOpen1 = tYou - 0.05;
    // cards come in with L10; the push to C1 starts as the fourth preview lands
    const tCards = t10 + 0.1, tLand = tPh.map((t) => t + 1.0);
    const tPush0 = Math.max(tLaw, tLand[3]!) + 0.05, tPush1 = tEnd - 0.06;
    const tFull0 = lerp(tPush0, tPush1, 0.35), tFull1 = lerp(tPush0, tPush1, 0.65);
    const untype: [number, number] = [tPush1 - 0.38, tPush1 - 0.08];

    // ---- assets: session frames, the four prompts, the mark's DFT, preview frames
    const sIx = (await (await fetch(SESSION)).json()) as { fps: number; count: number; frames: { file: string }[] };
    const sess = await Promise.all(sIx.frames.map((f) => loadImg('t3/session/' + f.file)));
    const seqs: T3Seq[] = await Promise.all(LINES.map((id) => t3Frames(id)));
    const curve = markPoints(600).map(([x, y]) => [MARK.x + x * MARK.s, MARK.y + y * MARK.s] as [number, number]);
    const { c0: c0m, arms } = dft(markPoints(256), 24);
    const depth = +ctx.params?.thumb || 0;
    const at = (f: () => number, d: number) => { try { return f(); } catch { return d; } };
    const PREV_T = [
      at(() => q.w('C1-L6', 'it') + 1.6, 36),          // the attention line reaching back to «the cat»
      at(() => q.w('C2-L14', 'Fill') + 1.2, 69.3),     // the filled 8 × 8 square
      at(() => q.w('C3-L12', 'multiply') + 2.0, 95),    // the 2ⁿ curve racing away
      at(() => q.w('C4-L8', '1619') + 1.3, 131),        // the 1619 page / typeset card
    ];
    const real = depth < 1 ? await Promise.all(CH.map((id, i) => chapterFrame(ctx, id, PREV_T[i]!, 1920))) : [null, null, null, null];
    const prev: HTMLCanvasElement[] = real.map((r, i) => r ?? placeholder(i));

    // ---- FLIP state of preview i at t: 0 = not yet, 'full' (0.4 s), flying u 0..1, landed
    const flip = (i: number, t: number) => {
      const t0 = tPh[i]!;
      if (t < t0) return -1;
      return ease.outCubic(clamp((t - t0 - 0.4) / 0.6));
    };
    const fullness = (t: number) => { // how much of the screen a preview covers (for the post-processing plate)
      let best = { i: -1, v: 0 };
      CH.forEach((_, i) => { const u = flip(i, t); if (u >= 0) { const v = (1 - u) * (1 - u); if (v > best.v) best = { i, v }; } });
      return best;
    };
    this.postPaper = (t: number) => {
      const f = fullness(t);
      let p = f.i >= 0 ? lerp(1, PLATE[CH[f.i]!]!, f.v) : 1;
      return lerp(p, 0, tw(t, tFull0, tFull1)); // to C1's ink as its frame takes over
    };

    // ---- painters (world space)
    const ink = (a = 1) => rgba('ink', 0.92 * a);
    const paintMark = (o: SC) => {
      const t = o.t, c = o.c, s = o.s;
      const ph = tw(t, 0.15, tWord + 0.05, ease.inOutQuad);
      const fade = 1 - tw(t, tOpen0, tOpen0 + 0.45);
      if (fade <= 0.001) return;
      const armsA = (1 - tw(t, tWord + 0.05, tWord + 0.5)) * tw(t, 0, 0.25);
      c.save(); s.save(); c.globalAlpha *= fade; s.globalAlpha *= fade;
      if (armsA > 0.001) {
        let px = MARK.x + c0m[0] * MARK.s, py = MARK.y + c0m[1] * MARK.s;
        c.save(); c.globalAlpha *= armsA;
        for (const a of arms) {
          const ang = 2 * Math.PI * a.k * ph + a.ph, len = a.amp * MARK.s;
          if (len > 2) { c.strokeStyle = ink(0.28); c.lineWidth = 1; c.beginPath(); c.arc(px, py, len, 0, Math.PI * 2); c.stroke(); }
          const ex = px + len * Math.cos(ang), ey = py + len * Math.sin(ang);
          c.strokeStyle = ink(0.8); c.lineWidth = 1.8; c.beginPath(); c.moveTo(px, py); c.lineTo(ex, ey); c.stroke();
          px = ex; py = ey;
        }
        s.fillStyle = rgba('blood', armsA); s.beginPath(); s.arc(px, py, 6, 0, Math.PI * 2); s.fill();
        c.restore();
      }
      const n = Math.max(2, Math.round(600 * ph));
      s.strokeStyle = rgba('blood', 1); s.lineWidth = 7; s.lineCap = 'round'; s.lineJoin = 'round';
      s.beginPath(); s.moveTo(curve[0]![0], curve[0]![1]);
      for (let i = 1; i < Math.min(n, curve.length); i++) s.lineTo(curve[i]![0], curve[i]![1]);
      if (ph >= 1) s.closePath();
      s.stroke();
      // wordmark writes in left to right on «vibe-animator»
      const pw = tw(t, tWord - 0.05, tWord + 0.6, ease.inOutCubic);
      if (pw > 0) {
        c.save(); c.beginPath(); c.rect(0, 0, 420 + 1080 * pw, H); c.clip();
        wordmark(c, 960, 680, 112, 1, 'ink');
        c.restore();
      }
      c.restore(); s.restore();
    };

    const winRect = (t: number) => { // the mark's frame opening into the window
      const u = tw(t, tOpen0, tOpen1, ease.inOutCubic);
      const m = { x: MARK.x - MARK.s * 1.15, y: MARK.y - MARK.s * 1.1, w: MARK.s * 2.3, h: MARK.s * 2.2 };
      return { x: lerp(m.x, WIN.x, u), y: lerp(m.y, WIN.y, u), w: lerp(m.w, WIN.w, u), h: lerp(m.h, WIN.h, u), u };
    };
    const winOut = (t: number) => 1 - tw(t, t10 - 0.1, t10 + 0.45);
    const paintWindow = (o: SC) => {
      const t = o.t, c = o.c;
      if (t < tOpen0) return;
      const r = winRect(t), a = winOut(t);
      if (a <= 0.001) return;
      c.save(); c.globalAlpha *= a;
      // soft shadow + engraved double frame
      c.fillStyle = 'rgba(20,16,10,0.18)'; c.fillRect(r.x + 10, r.y + 14, r.w, r.h);
      c.save(); c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip();
      const k = clamp(Math.floor((t - tYou) * sIx.fps), 0, sIx.count - 1);
      // the frame is anchored to the window's final geometry, revealed by the opening rect
      c.globalAlpha *= tw(t, tOpen0, tOpen0 + 0.3);
      c.drawImage(sess[k]!, WIN.x, WIN.y, WIN.w, WIN.h);
      c.restore();
      c.strokeStyle = ink(0.85); c.lineWidth = 2; c.strokeRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12);
      c.strokeStyle = ink(0.4); c.lineWidth = 1; c.strokeRect(r.x - 11, r.y - 11, r.w + 22, r.h + 22);
      c.restore();
    };

    const cardsA = (i: number, t: number) => tw(t, tCards + i * 0.12, tCards + i * 0.12 + 0.4, ease.outCubic);
    const othersOut = (t: number) => 1 - tw(t, tPush0, tPush0 + 0.45);
    const paintCards = (o: SC) => {
      const t = o.t, c = o.c;
      if (t < tCards) return;
      for (let i = 0; i < 4; i++) {
        const a = cardsA(i, t) * (i === 0 ? 1 : othersOut(t));
        if (a <= 0.001) continue;
        const seq = seqs[i]!, y = cardY(i), dx = 40 * (1 - cardsA(i, t));
        c.save(); c.globalAlpha *= a;
        c.fillStyle = seq.pageFill; c.beginPath(); c.roundRect(CARD.x - 10 + dx, y - 10, CARD.w + 20, CARD.h + 20, 14); c.fill();
        const k = i === 0 ? t3FrameIdx(seq, q, t, untype) : seq.ix.chars;
        const kk = i === 0 && t >= untype[0] ? k : seq.ix.frames.length - 1;
        t3Composer(c, seq, kk, CARD.x + dx, y, CARD.w, CARD.h);
        c.restore();
        // the empty slot (hairline, dashed until its preview lands)
        const sa = a * (i === 0 ? othersOut(t) : 1);
        c.save(); c.globalAlpha *= sa; c.strokeStyle = ink(0.6); c.lineWidth = 1.5;
        if (flip(i, t) < 1) c.setLineDash([7, 6]);
        c.strokeRect(SLOT.x, slotY(i), SLOT.w, SLOT.h); c.restore();
      }
    };

    // C1's full frame around card 1: frame px → world with card 1 exactly on composer_bbox
    const paintC1 = (o: SC) => {
      const t = o.t, a = tw(t, tFull0, tFull1);
      if (a <= 0.001) return;
      const seq = seqs[0]!, [bx, by, bw] = seq.ix.composer_bbox, s = CARD.w / bw;
      const ox = CARD.x - bx * s, oy = cardY(0) - by * s;
      const k = t3FrameIdx(seq, q, t, untype);
      const kk = t >= untype[0] ? k : seq.ix.frames.length - 1;
      o.c.save(); o.c.globalAlpha *= a; o.c.fillStyle = seq.pageFill; o.c.fillRect(ox - 200, oy - 200, W * s + 400, H * s + 400); o.c.restore();
      t3Draw(o.c, seq, kk, ox, oy, s, a);
    };

    // camera: card 1 → composer_bbox of a full frame at z 1 (C1's opening view)
    const [cbx, cby, cbw] = seqs[0]!.ix.composer_bbox, zC = cbw / CARD.w;
    const camC1 = { x: CARD.x - (cbx - W / 2) / zC, y: cardY(0) - (cby - H / 2) / zC };

    this.shots = [{
      t0: -0.5, t1: tEnd, paper: 1, fi: 0.01, fo: 0.01,
      cam: [
        K(0, 960, 540, 1), K(tOpen0, 960, 540, 1), K(tOpen1, 960, 520, 1.0),
        K(t10 - 0.4, 960, 470, 1.08, ease.inOutQuad), K(tCards + 0.4, 960, 540, 1),
        K(tPush0, 960, 540, 1), K(tPush1, camC1.x, camC1.y, zC, ease.inOutCubic),
      ],
      drift: (t) => 1 - clamp((t - (tPush0 - 0.3)) / 0.3),
      draw: (o) => {
        paintMark(o);
        paintWindow(o);
        paintCards(o);
        paintC1(o);
      },
      hud: (o) => {
        const t = o.t, c = o.c, cam = o.cam;
        const sx = (wx: number) => W / 2 + (wx - cam.x) * cam.z, sy = (wy: number) => H / 2 + (wy - cam.y) * cam.z;
        // ---- L7: kicker, credit, chips
        const wa = tw(t, tOpen1 - 0.2, tOpen1 + 0.3) * winOut(t);
        if (wa > 0.001) {
          txt(c, 'REAL SESSION IN T3 CODE · CLAUDE HAIKU 5.5 · 25 S SHOWN IN ~7 S', 960, Math.min(sy(WIN.y) - 24, 150),
            { size: 24, f: F.mono(600), col: rgba('ink', 0.85 * wa), align: 'center', ls: 1.5 });
          txt(c, 'T3 Code', Math.max(432, sx(WIN.x)), sy(WIN.y + WIN.h) + 36, { size: 24, f: F.archivo(100, 600), col: rgba('graphite', 0.95 * wa) });
          const NAMES = ['SCRIPT', 'VOICES', 'ANIMATION', 'SHORTS'];
          c.save(); c.font = font(F.mono(600), 26); c.letterSpacing = '3px';
          const ws = NAMES.map((n) => c.measureText(n).width + 36);
          c.restore();
          let x = 1490 - ws.reduce((a, b) => a + b, 0) - 14 * 3;
          const cy = Math.min(sy(WIN.y + WIN.h) + 50, 868);
          NAMES.forEach((n, i) => {
            const p = tw(t, tChips[i]! - 0.05, tChips[i]! + 0.3, ease.outBack as any);
            const w = ws[i]!;
            if (p > 0.001) {
              const k = lerp(1.35, 1, clamp(p)), cx = x + w / 2;
              c.save(); c.globalAlpha *= clamp(p * 2) * wa; c.translate(cx, cy); c.scale(k, k);
              c.fillStyle = rgba('bone', 1); c.fillRect(-w / 2, -24, w, 48);
              c.strokeStyle = rgba('ink', 0.9); c.lineWidth = 2; c.strokeRect(-w / 2, -24, w, 48);
              c.strokeStyle = rgba('ink', 0.35); c.lineWidth = 1; c.strokeRect(-w / 2 + 4, -20, w - 8, 40);
              c.restore();
              lab(c, n, cx, cy + 9, clamp(p * 2) * wa, rgba('ink', 0.95), 26, 'center', 400, 3);
            }
            x += w + 14;
          });
        }
        // ---- L10: the re-typed tag under the card column
        const ta = tw(t, tCards + 0.3, tCards + 0.7) * othersOut(t);
        if (ta > 0.001) t3Tag(c, Math.max(432, sx(CARD.x)), Math.min(sy(slotY(3) + SLOT.h) + 34, 896), ta, 'left', 24, rgba('graphite', 0.9));
        // ---- FLIP previews (screen space; slots follow the camera)
        for (let i = 0; i < 4; i++) {
          const u = flip(i, t);
          if (u < 0) continue;
          const a = i === 0 ? 1 : othersOut(t);
          const x1 = sx(SLOT.x), y1 = sy(slotY(i)), w1 = SLOT.w * cam.z, h1 = SLOT.h * cam.z;
          drawFrame(c, prev[i], lerp(0, x1, u), lerp(0, y1, u), lerp(W, w1, u), lerp(H, h1, u), a * (i === 0 ? othersOut(t) : 1));
        }
      },
    }];
  }
}
