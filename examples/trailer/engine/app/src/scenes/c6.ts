// C6 · Try it (engraved plate, ink; v2: one line, 4.9 s + hold). Not in a Short.
// Storyboard
//   in   C5 ends on its strip view (custom pull-back); we open on the same view: the strip runs up and winds onto a
//        reel (the film twists edge-on into it).
//   L6   «Every animation here…»: the reel spins down and gives way to the vibe-animator mark from C0 (the finished
//        mark returns as a match-cut from the hub; no second epicycle trace); it settles up and the wordmark sets on
//        «vibe-animator»; on «GitHub» github.com/Fr4nzz/vibe-animator writes in. Then the end card (verbatim from the
//        brief) and the credits line, with T3 Code's own header (cropped from the capture) as its logo. Hold.
import { ShotScene, W, H, rgba, tw, ease, F, txt, clamp, lerp, font, loadImg, type SC } from './_shots';
import { fig2, K } from './_devices';
import { chapterFrame, drawFrame, drawStrip, STRIP, markCurve, drawMark, wordmark } from './kit_c5c6';

const L = 'C6-L6';
const URL = 'github.com/Fr4nzz/vibe-animator';
const CARD = ['Describe a video. Claude Code agents make it.', 'Built with Claude Code + ElevenLabs. Prompts shown in T3 Code.'];
const CREDIT1 = 'manim-web (MIT) · ElevenLabs · Claude Code · ';
const CREDIT2 = 'Kepler, Harmonices Mundi (1619): Smithsonian Libraries scan via Wikimedia Commons, public domain'; // public/papers/SOURCES.md
// T3 Code's logo: its own header, cropped from the audited capture (frame px [x, y, w, h])
const T3_IMG = 't3/C4-L5/000.webp', T3_CROP = [10, 6, 104, 38] as const;

export default class C6 extends ShotScene {
  frames: (HTMLCanvasElement | null)[] = [];
  t3: HTMLImageElement | null = null;
  async build() {
    const q = this.q, ctx = this.ctx;
    const t0 = ctx.start, tEnd = ctx.end;
    const tName = q.w(L, 'vibe-animator'), tGit = q.w(L, 'GitHub'), tLast = q.end(L);

    // the strip's last frames: C3, C4 and the end of C5 (the phone), rendered from those chapters' own scenes
    if (!ctx.params?.thumb) {
      this.frames = await Promise.all([
        chapterFrame(ctx, 'C3', 95.7), // the same C3 frame C5 cuts
        chapterFrame(ctx, 'C4', q.w('C4-L9', 'sit') + 0.7),
        chapterFrame(ctx, 'C5', t0 - 1.0), // C5's phone just before its pull-back (c5.ts o0)
      ]);
    }
    this.t3 = await loadImg(T3_IMG).catch(() => null);
    const fr = this.frames;

    // ---- timing
    const tWa = t0 + 0.15, tWb = t0 + 1.45;          // winding
    const tMa = tWb - 0.15, tMb = tMa + 0.6;          // reel → mark (match-cut from the hub)
    const tSa = tMb - 0.1, tSb = tName + 0.25;        // the mark settles up as the wordmark sets
    const tC1 = tLast - 0.15, tC2 = tC1 + 0.45, tK = tC2 + 0.5;

    // ---- geometry
    const RC = { x: W / 2, y: 470 }, R = 300, HUB = 46, ks = STRIP.z;
    const curve = markCurve(600);
    const MARK0 = { x: RC.x, y: RC.y, s: 240 }, MARK1 = { x: W / 2, y: 214, s: 150 };

    const rFilm = (t: number) => lerp(HUB + 12, 262, tw(t, tWa, tWb, (x) => x));
    const theta = (t: number) => -0.4 - 9.5 * tw(t, tWa, tWb, ease.inOutCubic) - 1.2 * tw(t, tWb, tMb, ease.outCubic);
    const scroll = (t: number) => 3.2 * tw(t, tWa, tWb, ease.inCubic);
    const wb = (t: number) => tw(t, tWa, tWa + 0.8, ease.inOutCubic); // straight strip → feeding the reel

    // The feeding strip is drawn flat into an offscreen canvas, then warped row by row onto the screen: its centre line
    // bends to the reel's tangent and its width closes to a hairline (the film turning edge-on as it winds).
    const OX = 420, Y0 = -320, OW = 840, OH = 1520;
    const offc = document.createElement('canvas'); offc.width = OW; offc.height = OH;
    const og = offc.getContext('2d')!;
    const drawFeed = (o: SC, t: number) => {
      const c = o.c, w = wb(t), sc = scroll(t);
      const fade = 1 - tw(t, tWb - 0.4, tWb);
      if (fade <= 0.001) return;
      const yTop = lerp(Y0, RC.y, w), rf = rFilm(t);
      // frame 0 = C5's plate (centred at the cut), -1 = C4, -2 = C3; after it, unexposed leader
      const inner = (oo: SC, k: number, x: number, y: number, ww: number, hh: number) => {
        const img = k <= 0 && k >= -2 ? fr[k + 2] : null;
        if (img) drawFrame(oo.c, img, x, y, ww, hh);
      };
      og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, OW, OH);
      og.translate(OX, H / 2 - Y0); og.scale(ks, ks);
      drawStrip({ ...o, c: og, s: og, cam: { x: 0, y: 0, z: o.cam.z * ks } }, { cx: 0, cy: 0, frames: 9, first: STRIP.first(5), scroll: sc, on: 0, inner });
      c.save(); c.globalAlpha *= fade;
      if (w < 0.001) c.drawImage(offc, W / 2 - OX, Y0);
      else {
        for (let y = Math.floor(yTop); y < Y0 + OH; y += 2) {
          const g = clamp((1180 - y) / (1180 - RC.y)), gg = ease.inOutQuad(g);
          const xc = W / 2 + w * (rf + 6) * gg, wf = 1 - w * 0.975 * Math.pow(g, 1.6);
          c.drawImage(offc, 0, y - Y0, OW, 2, xc - OX * wf, y, OW * wf, 2.4);
        }
      }
      c.restore();
    };

    this.shots = [{
      t0, t1: tEnd + 0.5, paper: 0,
      cam: [K(t0, W / 2, 540, 1), K(tSb, W / 2, 535, 1.0), K(tEnd, W / 2, 530, 1.025)],
      draw: (o) => {
        const c = o.c, s = o.s, t = o.t;
        const m = tw(t, tMa, tMb, ease.inOutCubic);           // reel → mark
        const reelA = tw(t, tWa + 0.1, tWa + 0.6) * (1 - m);
        const th = theta(t), rf = rFilm(t);
        // ---- the reel: wound film (edge-on rings), flange rims, six spokes; it shrinks into its hub as the mark opens
        if (reelA > 0.001) {
          const k = lerp(1, 0.35, ease.inCubic(m));
          c.save(); c.globalAlpha *= reelA;
          c.translate(RC.x, RC.y); c.scale(k, k); c.translate(-RC.x, -RC.y);
          c.fillStyle = 'rgba(22,20,18,0.97)'; c.beginPath(); c.arc(RC.x, RC.y, rf, 0, Math.PI * 2); c.fill();
          c.strokeStyle = rgba('graphite', 0.45); c.lineWidth = 1;
          for (let r = HUB + 14; r < rf; r += 5.5) { c.beginPath(); c.arc(RC.x, RC.y, r, 0, Math.PI * 2); c.stroke(); }
          c.strokeStyle = rgba('bone', 0.75); c.lineWidth = 2.2; c.beginPath(); c.arc(RC.x, RC.y, R, 0, Math.PI * 2); c.stroke();
          c.strokeStyle = rgba('bone', 0.3); c.lineWidth = 1; c.beginPath(); c.arc(RC.x, RC.y, R - 12, 0, Math.PI * 2); c.stroke();
          for (let j = 0; j < 6; j++) {
            const a = th + (j * Math.PI) / 3, ex = RC.x + (R - 14) * Math.cos(a), ey = RC.y + (R - 14) * Math.sin(a);
            const hx = RC.x + HUB * Math.cos(a), hy = RC.y + HUB * Math.sin(a);
            c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 3.2; c.beginPath(); c.moveTo(hx, hy); c.lineTo(ex, ey); c.stroke();
            const nx = -Math.sin(a) * 7, ny = Math.cos(a) * 7;
            c.strokeStyle = rgba('bone', 0.35); c.lineWidth = 1; c.beginPath(); c.moveTo(hx + nx, hy + ny); c.lineTo(ex + nx, ey + ny); c.stroke();
          }
          c.strokeStyle = rgba('bone', 0.8); c.lineWidth = 2; c.beginPath(); c.arc(RC.x, RC.y, HUB, 0, Math.PI * 2); c.stroke();
          c.restore();
        }
        drawFeed(o, t);
        // ---- the mark from C0 returns: it opens out of the hub, then settles up over the wordmark
        if (m > 0) {
          const st = tw(t, tSa, tSb, ease.inOutCubic);
          const grow = lerp(0.18, 1, ease.outCubic(m));
          const x = lerp(MARK0.x, MARK1.x, st), y = lerp(MARK0.y, MARK1.y, st), sc = lerp(MARK0.s, MARK1.s, st) * grow;
          drawMark(s, curve, x, y, sc, clamp(m * 1.6), lerp(8, 6, st));
        }
        // ---- wordmark, URL, card, credits
        const pW = tw(t, tName - 0.1, tName + 0.45, ease.outCubic);
        if (pW > 0) { c.save(); c.translate(0, 16 * (1 - pW)); wordmark(c, W / 2, 492, 124, pW); c.restore(); }
        const pU = tw(t, tGit - 0.05, tGit + 0.7, (x) => x);
        if (pU > 0) {
          txt(c, URL, W / 2, 590, { size: 56, f: F.mono(500), col: rgba('ochre', 1), align: 'center', p: pU });
          c.save(); c.fillStyle = rgba('ochre', 0.6); c.font = font(F.mono(500), 56); const uw = c.measureText(URL).width;
          c.fillRect(W / 2 - uw / 2, 612, uw * ease.outCubic(pU), 3); c.restore();
        }
        const pC1 = tw(t, tC1, tC1 + 0.5), pC2 = tw(t, tC2, tC2 + 0.5);
        if (pC1 > 0) txt(c, CARD[0]!, W / 2, 696, { size: 46, f: F.serif(500, true), col: rgba('bone', 0.95 * pC1), align: 'center' });
        if (pC2 > 0) txt(c, CARD[1]!, W / 2, 752, { size: 46, f: F.serif(500, true), col: rgba('bone', 0.95 * pC2), align: 'center' });
        const pK = tw(t, tK, tK + 0.6);
        if (pK > 0) {
          const fK = F.archivo(100, 500), size = 28;
          c.save(); c.font = font(fK, size); c.letterSpacing = '0px';
          const w1 = c.measureText(CREDIT1).width; c.restore();
          const [sx, sy, sw, sh] = T3_CROP, lh = 44, lw = (sw * lh) / sh;
          const x0 = W / 2 - (w1 + lw) / 2, yb = 830;
          txt(c, CREDIT1, x0, yb, { size, f: fK, col: rgba('bone', 0.82 * pK) });
          if (this.t3) {
            c.save(); c.globalAlpha *= pK;
            c.beginPath(); c.roundRect(x0 + w1, yb - lh + 11, lw, lh, 8); c.clip();
            c.drawImage(this.t3, sx, sy, sw, sh, x0 + w1, yb - lh + 11, lw, lh);
            c.restore();
          } else txt(c, 'T3 Code', x0 + w1, yb, { size, f: F.archivo(100, 700), col: rgba('bone', 0.82 * pK) });
          txt(c, CREDIT2, W / 2, yb + 44, { size: 26, f: fK, col: rgba('bone', 0.7 * pK), align: 'center' });
        }
      },
      hud: (o) => fig2(o.c, 'FIG. 6', 'TRY IT', tw(o.t, t0 + 0.3, t0 + 0.8) * (1 - tw(o.t, tMa, tMa + 0.4)), false, 432, 46),
    }];
  }
}
