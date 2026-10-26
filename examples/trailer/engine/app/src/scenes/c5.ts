// C5 · How it's made (engraved plate, v2: 9.2 s). Every line is in Short S06: all text inside x 420–1500, above y 900.
// Storyboard
//   in   spill hand-off from C4 (shared kit): C4's last frame pulls back, our bone frame slides up, push in.
//   L6   «writes»: one agent node inks in beside a plan sheet; «plan»: the sheet rules itself; «nine»: nine links fan
//        out from the plan to nine builder agents, which then work at once («same»). The four owner-supplied numbers
//        slam in under them, on screen only, verbatim (BUILD_BRIEF «C5 numbers»).
//   L9   cutting room (ink): this trailer's own strip (frames C0–C4, rendered from their scenes) runs down a light table
//        and stops on the C3 frame; «cut»: the splicer chops it out; «vertical»: the frame stands up; «Short»: a crop
//        square locks on and the sides fall away; «captions»: the caption writes in; it becomes a generic phone (no
//        platform UI) and a thumb swipes through three Shorts from this trailer (C3, C1, C2). Then a short pull-back to
//        the strip view; C6 opens on that view and winds the film onto its reel.
import { ShotScene, W, H, rgba, tw, ease, F, txt, clamp, lerp, font, type SC } from './_shots';
import { fig2, K } from './_devices';
import {
  chapterFrame, drawFrame, stripAt, frameRect, STRIP, drawStrip, lightTable, splicer, phone, phoneTop, thumb,
} from './kit_c5c6';
import { intro, inCam, inScroll, inStrip, inDrift, prevStill, handPost } from './trailer_filmstrip_kit';

const L = (n: number) => `C5-L${n}`;
const CH = ['C0', 'C1', 'C2', 'C3', 'C4'];

export default class C5 extends ShotScene {
  frames: Record<string, HTMLCanvasElement | null> = {};
  async build() {
    const q = this.q, ctx = this.ctx;
    const t0 = ctx.start, tEnd = ctx.end;
    const tWrites = q.w(L(6), 'writes'), tPlan = q.w(L(6), 'plan'), tNine = q.w(L(6), 'nine'), tSame = q.w(L(6), 'same');
    const tL9 = q.s(L(9)), tCut = q.w(L(9), 'cut'), tVert = q.w(L(9), 'vertical'), tShort = q.w(L(9), 'Short'), tCap = q.w(L(9), 'captions');

    // ---- frames of this trailer (rendered once from each chapter's own scene; kit chapterFrame). The strip on the
    // table is C0..C4; the frame the splicer cuts is C3 (the curve race, «polynomial time»); the three phone Shorts
    // are C3, C1 (the picked word drops into the sentence) and C2 (the square locked, side 8), each with the caption
    // its own narration has at that moment.
    const at: Record<string, number> = {
      C0: q.w('C0-L10', 'law') + 0.6, C1: q.w('C1-L2', 'space') + 0.6, C2: q.w('C2-L13', 'corner') + 0.6,
      C3: 95.7, C4: q.w('C4-L9', 'sit') + 0.7, // C3: the C3 builder's pick (2ⁿ shooting up, the tree filling the frame)
      S1: q.w('C1-L7', 'picks') + 0.7, S2: q.w('C2-L14', 'Side') + 0.4,
    };
    {
      const ids = Object.keys(at);
      const imgs = await Promise.all(ids.map((id) => chapterFrame(ctx, id.startsWith('S') ? (id === 'S1' ? 'C1' : 'C2') : id, at[id]!)));
      ids.forEach((id, i) => { this.frames[id] = imgs[i]!; });
    }
    const fr = this.frames;
    const shorts: { img: () => HTMLCanvasElement | null | undefined; cap: string }[] = [
      { img: () => fr.C3, cap: 'every empty square.' },
      { img: () => fr.S1, cap: 'and picks one.' },
      { img: () => fr.S2, cap: 'Side 8.' },
    ];

    // ---- geometry, shot A (bone plate)
    const cx = W / 2;
    const AG = { x: 790, y: 232 }, PL = { x: 1010, y: 232, s: 150 }; // the plan agent and its sheet
    const agY = 478, agX = (i: number) => 480 + i * 120;
    const cells = [
      { x: 700, y: 664, pre: 'about ', num: '1.1M', post: 'tokens per finished minute' },
      { x: 1220, y: 664, pre: '', num: '54 %', post: 'fewer than the previous pipeline' },
      { x: 700, y: 812, pre: 'chapters render in ', num: '1–3', post: 'minutes' },
      { x: 1220, y: 812, pre: '', num: '9', post: 'builder agents in parallel' },
    ];
    const cellT = cells.map((_, i) => tNine + 0.45 + 0.28 * i);

    // ---- geometry, shot B (ink, light table)
    const ks = 600 / STRIP.fw; // the strip on the table: a frame 600 px wide; frame k = chapter Ck
    const TBL = { x: 300, y: 60, w: 1320, h: 820 }, SY = 470;
    const stripScroll = (t: number) => 3 - 2.6 * (1 - ease.outCubic(tw(t, tL9 - 0.3, tL9 + 1.1, (x) => x)));
    const fr3 = frameRect(cx, SY, ks, 3, 3);
    const cutRect = { x: fr3.x, y: fr3.y - (STRIP.gap / 2) * ks, w: fr3.w, h: STRIP.pitch * ks, fy: fr3.y };
    const tLift = tCut + 0.4;
    const stand = (t: number) => tw(t, tCut + 0.3, tVert + 0.35, ease.inOutCubic); // lying on the table → upright
    const FD = { w: 840, h: 472.5, cy: 460 }; // the upright frame
    const SQ1 = { x: cx - FD.h / 2, y: FD.cy - FD.h / 2, w: FD.h, h: FD.h };
    const SCR = { x: cx - FD.h / 2, y: FD.cy - 420, w: FD.h, h: 840 }; // the portrait Short (= the phone's screen)
    const tSides = tShort + 0.3, tPhone = tShort + 0.45, SWD = 0.3;
    const swipes = [tCap + 1.05, tCap + 1.7];
    // hand-off to C6 (custom, short): the phone holds past the last word, then this plate pulls back to one frame of
    // the strip; C6 opens on that strip view and winds the film onto its reel
    const [o0, o1] = [tEnd - 0.7, tEnd];
    const ib = intro('C5');
    const prev = await prevStill(ctx, ib);
    this.postPaper = (t, p) => (t < ib.push1 + 0.1 ? handPost(ib, 'in', t) : p);

    const chapterInner = (o: SC, k: number, x: number, y: number, w: number, h: number) =>
      drawFrame(o.c, k >= 0 && k < CH.length ? fr[CH[k]!] : null, x, y, w, h, k === 3 ? 0.95 : 0.22);
    const drawStripOn = (o: SC, t: number, squash: number) =>
      stripAt(o, cx, SY, ks, ks, { cx: 0, cy: 0, frames: 5, first: STRIP.first(0), scroll: stripScroll(t), on: 0, inner: chapterInner }, squash);

    const plateA = (o: SC) => {
      const c = o.c, s = o.s, t = o.t, ink = (a = 1) => rgba('ink', a);
      // the plan agent
      const pN = tw(t, tWrites - 0.1, tWrites + 0.4, ease.outBack);
      if (pN > 0) {
        c.save(); c.strokeStyle = ink(0.9); c.lineWidth = 3;
        c.beginPath(); c.arc(AG.x, AG.y, 56 * pN, 0, Math.PI * 2); c.stroke();
        c.lineWidth = 1.2; c.beginPath(); c.arc(AG.x, AG.y, 70 * pN, 0, Math.PI * 2); c.stroke(); c.restore();
        s.fillStyle = rgba('blood', 0.95); s.beginPath(); s.arc(AG.x, AG.y, 36 * pN, 0, Math.PI * 2); s.fill();
        txt(c, 'AGENT', AG.x, AG.y + 118, { size: 32, f: F.mono(600), col: ink(0.85), align: 'center', ls: 2, p: tw(t, tWrites, tWrites + 0.4) });
      }
      // a pen line from the agent to the sheet while it writes
      const pW = tw(t, tWrites + 0.1, tPlan + 0.1);
      if (pW > 0) {
        c.save(); c.strokeStyle = ink(0.7); c.lineWidth = 1.6; c.setLineDash([8, 7]);
        c.beginPath(); c.moveTo(AG.x + 74, AG.y); c.lineTo(lerp(AG.x + 74, PL.x - PL.s / 2 - 8, pW), AG.y); c.stroke(); c.restore();
      }
      // the plan: a ruled sheet that writes itself
      const pP = tw(t, tPlan - 0.35, tPlan + 0.45);
      if (pP > 0) {
        const x0 = PL.x - PL.s / 2, y0 = PL.y - PL.s / 2;
        c.save(); c.globalAlpha *= clamp(pP * 4);
        c.strokeStyle = ink(0.85); c.lineWidth = 1.6; c.fillStyle = 'rgba(250,247,240,0.95)';
        c.beginPath(); c.rect(x0, y0, PL.s, PL.s); c.fill(); c.stroke();
        c.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
          const pl = clamp(pP * 7 - i);
          if (pl <= 0) break;
          c.beginPath(); c.moveTo(x0 + 20, y0 + 26 + i * 17); c.lineTo(x0 + 20 + (i === 6 ? 60 : 110) * pl, y0 + 26 + i * 17); c.stroke();
        }
        c.restore();
        txt(c, 'PLAN', PL.x, PL.y + 118, { size: 32, f: F.mono(600), col: ink(0.85), ls: 2, align: 'center', p: tw(t, tPlan, tPlan + 0.35) });
      }
      // nine links fan out from the plan to nine builder agents (centre first, outwards)
      for (let i = 0; i < 9; i++) {
        const d = Math.abs(i - 4), tA = tNine - 0.05 + 0.035 * d;
        const pl = tw(t, tA, tA + 0.4, ease.outCubic);
        if (pl <= 0) continue;
        const x = agX(i), sx = PL.x, sy = PL.y + PL.s / 2 + 52; // (below the PLAN label)
        c.save(); c.strokeStyle = ink(0.65); c.lineWidth = 1.4; c.beginPath();
        const N = 24;
        for (let j = 0; j <= N * pl; j++) {
          const u = j / N, mx = lerp(sx, x, ease.inOutQuad(u)), my = lerp(sy, agY - 34, u);
          if (j === 0) c.moveTo(mx, my); else c.lineTo(mx, my);
        }
        c.stroke(); c.restore();
        const pa = tw(t, tA + 0.25, tA + 0.55, ease.outBack);
        if (pa > 0) {
          c.save(); c.strokeStyle = ink(0.9); c.lineWidth = 2; c.fillStyle = ink(0.88);
          c.beginPath(); c.arc(x, agY, 30 * pa, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
          // at work, all at once («same time»): a mark orbits each agent
          const w8 = tw(t, tSame - 0.6, tSame - 0.1);
          if (w8 > 0) {
            const ang = (t - tSame) * 5.2 + i * 0.7;
            s.fillStyle = rgba('blood', 0.9 * w8);
            s.beginPath(); s.arc(x + Math.cos(ang) * 44, agY + Math.sin(ang) * 44, 7, 0, Math.PI * 2); s.fill();
          }
        }
      }
      // the four numbers (owner-supplied, verbatim; no count-up, so no other number is ever on screen)
      cells.forEach((cl, i) => {
        const tc = cellT[i]!, p = tw(t, tc - 0.05, tc + 0.3, ease.outBack), a = tw(t, tc - 0.05, tc + 0.15);
        if (a <= 0.001) return;
        c.save(); c.globalAlpha *= a;
        c.font = font(F.archivo(100, 400), 36); const wPre = c.measureText(cl.pre).width;
        c.font = font(F.archivo(100, 800), 96); const wNum = c.measureText(cl.num).width;
        const x0 = cl.x - (wPre + wNum) / 2;
        if (cl.pre) txt(c, cl.pre, x0, cl.y, { size: 36, f: F.archivo(100, 400), col: ink(0.8) });
        c.save(); c.translate(x0 + wPre + wNum / 2, cl.y - 34); c.scale(lerp(1.25, 1, clamp(p)), lerp(1.25, 1, clamp(p)));
        txt(c, cl.num, 0, 34, { size: 96, f: F.archivo(100, 800), col: ink(0.95), align: 'center' });
        c.restore();
        txt(c, cl.post, cl.x, cl.y + 46, { size: 31, f: F.archivo(100, 500), col: ink(0.78), align: 'center', p: tw(t, tc + 0.1, tc + 0.45) });
        c.restore();
      });
    };

    this.shots = [
      // ================================================================ A · plan agent, nine builders, numbers
      {
        t0, t1: tL9 + 0.1, paper: 1, fo: 0.4,
        cam: [...inCam(ib), K(tNine - 0.2, cx, 540, 1.0), K(tL9 + 0.4, cx, 548, 1.04, ease.inOutQuad)],
        drift: inDrift(ib),
        draw: (o) => {
          if (!inStrip(ib, o.t)) { plateA(o); return; }
          drawStrip(o, {
            cx, cy: H / 2, frames: 5, first: STRIP.first(5), live: 0, scroll: inScroll(ib, o.t),
            inner: (oo, k, x, y, w, h) => {
              if (k === -1) drawFrame(oo.c, prev ?? fr.C4, x, y, w, h);
              if (k === 0) { oo.c.save(); oo.s.save(); oo.c.translate(x, y); oo.s.translate(x, y); plateA(oo); oo.c.restore(); oo.s.restore(); }
            },
          });
        },
        hud: (o) => fig2(o.c, 'FIG. 5', 'HOW IT IS MADE', tw(o.t, ib.push1, ib.push1 + 0.4) * (1 - tw(o.t, tL9 - 0.4, tL9)), true),
      },
      // ================================================================ B · cutting room
      {
        t0: tL9 - 0.2, t1: tEnd + 0.4, paper: 0, fi: 0.4,
        cam: [K(tL9 - 0.6, cx, 500, 1.06), K(tL9 + 1.0, cx, 480, 1.0), K(tCut, cx, 475, 1.02), K(tVert, cx, 470, 1.0),
          K(tPhone, cx, 470, 1.0), K(tPhone + 0.5, cx, H / 2, 1), K(o0, cx, H / 2, 1), K(o1, cx, H / 2, STRIP.z, ease.inOutQuart)],
        draw: (o) => {
          const c = o.c, s = o.s, t = o.t;
          const st = stand(t);
          // the table (and everything on it) tips away as the frame stands up: a vertical squash about y = 900
          const tableA = 1 - tw(t, tVert, tShort + 0.1);
          if (tableA > 0.001) {
            c.save(); s.save(); c.globalAlpha *= tableA; s.globalAlpha *= tableA;
            const sy = lerp(1, 0.22, st), py = 900;
            for (const g of [c, s]) { g.translate(0, py); g.scale(1, sy); g.translate(0, -py); }
            lightTable(c, TBL.x, TBL.y, TBL.w, TBL.h, 1);
            const cut = t >= tCut + 0.08;
            c.save(); s.save();
            if (cut) {
              const clip = new Path2D(); clip.rect(-1e4, -1e4, 3e4, 3e4); clip.rect(cutRect.x, cutRect.fy, cutRect.w, cutRect.w * 9 / 16);
              c.clip(clip, 'evenodd'); s.clip(clip, 'evenodd');
            }
            drawStripOn(o, t, sy);
            c.restore(); s.restore();
            // the splicer slides in over the frame as the strip settles, chops on «cut», lifts away
            const pin = tw(t, tCut - 0.75, tCut - 0.15, ease.outCubic), down = tw(t, tCut - 0.12, tCut + 0.06) * (1 - tw(t, tCut + 0.25, tCut + 0.5));
            if (pin > 0) {
              const xo = lerp(1300, 0, pin);
              c.save(); c.globalAlpha *= 1 - tw(t, tLift, tLift + 0.3);
              splicer(c, cx + xo, cutRect.y + cutRect.h / 2, (STRIP.fw + 2 * STRIP.margin) * ks, down, cutRect.h);
              c.restore();
              if (down > 0.9) {
                s.fillStyle = rgba('signal', 0.9);
                s.fillRect(cx - 360, cutRect.y - 1.5, 720, 3); s.fillRect(cx - 360, cutRect.y + cutRect.h - 1.5, 720, 3);
              }
            }
            c.restore(); s.restore();
          }
          // ---- the cut frame: lifts, stands up, crop square, Short, phone
          if (t >= tCut + 0.08) {
            const lift = tw(t, tCut + 0.15, tLift + 0.2, ease.outCubic);
            const x0 = lerp(cutRect.x, cx - FD.w / 2, st), w0 = lerp(cutRect.w, FD.w, st);
            const yLy = cutRect.fy - 14 * lift;
            const y0 = lerp(yLy, FD.cy - FD.h / 2, st), h0 = w0 * 9 / 16;
            const crop = tw(t, tShort - 0.2, tShort + 0.25, ease.outBack);
            const sides = tw(t, tSides - 0.1, tSides + 0.3);
            const inPhone = tw(t, tPhone, tPhone + 0.4, ease.outCubic);
            c.save(); c.fillStyle = `rgba(0,0,0,${0.35 * lift * (1 - st)})`; c.fillRect(x0 + 16 * lift, y0 + 22 * lift, w0, h0); c.restore();
            const scr = phone(c, cx, SCR.y + SCR.h / 2, SCR.h, inPhone);
            if (sides > 0) {
              c.save(); c.fillStyle = `rgba(6,6,6,${0.92 * sides})`; c.beginPath(); c.roundRect(SCR.x, SCR.y, SCR.w, SCR.h, scr.r * inPhone); c.fill();
              c.strokeStyle = rgba('bone', 0.55 * sides * (1 - inPhone)); c.lineWidth = 1.5; c.stroke(); c.restore();
            }
            const sw = tw(t, swipes[0]!, swipes[0]! + SWD, ease.inOutCubic) + tw(t, swipes[1]!, swipes[1]! + SWD, ease.inOutCubic);
            c.save();
            if (sides > 0) { c.beginPath(); c.roundRect(SCR.x, SCR.y, SCR.w, SCR.h, scr.r * inPhone); c.clip(); }
            shorts.forEach((sh, i) => {
              const dy = (i - sw) * SCR.h;
              if (Math.abs(dy) >= SCR.h) return;
              const img = sh.img();
              if (i === 0) {
                c.save(); c.translate(0, dy);
                if (sides < 1) { c.save(); c.globalAlpha *= 1 - sides; drawFrame(c, img, x0, y0, w0, h0); c.restore(); }
                const sx = x0 + (w0 - h0) / 2;
                if (img) c.drawImage(img, (img.width - img.height) / 2, 0, img.height, img.height, sx, y0, h0, h0);
                c.restore();
              } else if (img) {
                c.drawImage(img, (img.width - img.height) / 2, 0, img.height, img.height, SQ1.x, SQ1.y + dy, SQ1.w, SQ1.h);
              }
              // caption, word by word on «captions» for Short 0 (the others arrive captioned)
              const capP = i === 0 ? tw(t, tCap - 0.05, tCap + 0.4, (x) => x) : 1;
              const capY = SQ1.y + SQ1.h + 96 + dy;
              if (capP > 0 && capY > SCR.y + 50 && capY < SCR.y + SCR.h - 30) {
                const ws = sh.cap.split(' '), n = Math.ceil(ws.length * capP);
                txt(c, ws.slice(0, n).join(' '), cx, capY, { size: 38, f: F.archivo(100, 800), col: rgba('bone', 0.97 * (1 - tw(t, o0, o0 + 0.25))), align: 'center' }); // (gone before the pull-back shrinks it under 24 px)
              }
              if (sides > 0.5) {
                const pr = i === 0 ? tw(t, tCap, tEnd, (x) => x) * 0.6 : 0.15 + 0.5 * tw(t, swipes[i - 1]!, tEnd, (x) => x);
                s.fillStyle = rgba('signal', 0.85 * sides); s.fillRect(SCR.x, SCR.y + SCR.h - 6 + dy, SCR.w * pr, 4);
              }
            });
            c.restore();
            {
              const hint = Math.max(...swipes.map((sv) => tw(t, sv - 0.35, sv - 0.1) * (1 - tw(t, sv + 0.05, sv + 0.25))));
              phoneTop(c, scr, inPhone, hint);
            }
            // crop square: amber brackets close from the frame's corners onto the centre square
            if (crop > 0 && sw < 0.5) {
              const fx0 = lerp(x0, SQ1.x, crop), fx1 = lerp(x0 + w0, SQ1.x + SQ1.w, crop), fy0 = lerp(y0 - 14, SQ1.y, crop), fy1 = lerp(y0 + h0 + 14, SQ1.y + SQ1.h, crop);
              const L2 = 46, ca = (1 - tw(t, tPhone, tPhone + 0.35)) * clamp(crop * 3);
              s.save(); s.strokeStyle = rgba('signal', 0.95 * ca); s.lineWidth = 4;
              for (const [bx, by, dx, dy] of [[fx0, fy0, 1, 1], [fx1, fy0, -1, 1], [fx0, fy1, 1, -1], [fx1, fy1, -1, -1]] as const) {
                s.beginPath(); s.moveTo(bx + dx * L2, by); s.lineTo(bx, by); s.lineTo(bx, by + dy * L2); s.stroke();
              }
              s.restore();
            }
            // the thumb swipes up through the Shorts
            {
              const [s0, s1] = swipes as [number, number];
              const th = tw(t, s0 - 0.3, s0 - 0.05) * (1 - tw(t, s1 + SWD, s1 + SWD + 0.2));
              const back = tw(t, s0 + SWD + 0.02, s1 - 0.03, ease.inOutCubic);
              const up = t < s1 - 0.03 ? tw(t, s0, s0 + SWD, ease.inOutCubic) * (1 - back) : tw(t, s1, s1 + SWD, ease.inOutCubic);
              const lifted = t > s0 + SWD + 0.02 && t < s1 - 0.03 ? 0.45 : 1;
              if (th > 0) thumb(c, cx + 120, lerp(720, 380, up), 58, th * lifted);
            }
          }
          // pull-back: this plate becomes one frame of the strip again (frame -1 = C4, as on the way in)
          if (t > o0) {
            c.save(); c.globalAlpha *= tw(t, o0, o0 + 0.3);
            drawStrip(o, { cx, cy: H / 2, frames: 5, first: STRIP.first(5), live: 0, scroll: 0, on: 0, inner: (oo, k, x, y, w, h) => { if (k === -1) drawFrame(oo.c, fr.C4, x, y, w, h); } });
            c.restore();
          }
        },
        hud: (o) => {
          const a = tw(o.t, tL9, tL9 + 0.4) * (1 - tw(o.t, tCut + 0.2, tCut + 0.6));
          if (a <= 0.001) return;
          o.c.fillStyle = rgba('ink', 0.88 * a); o.c.fillRect(420, 44, 600, 64); // a dark slip under the kicker (over the strip)
          fig2(o.c, 'FIG. 5', 'THE CUTTING ROOM', a, false);
        },
      },
    ];
  }
}
