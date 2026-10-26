// Trailer C4 "Kepler's page" (v2; T3 composer → engraved plate, bone paper). Every line is in Short S05, so all text
// stays inside the square x 420-1500 and above the caption band.
//   in    spill hand-off from C3 (shared film-strip kit): C3's last frame pulls back, our frame (the T3 window, frame
//         000) slides up, push in.
//   L5    the prompt types in T3 Code's composer (shared T3 kit), the camera pushes to the text, the line lifts out
//         as the plate title and the UI dissolves into the bone plate.
//   L7    GOAL FIRST: six planets on schematic orbits; a clock ticks Mars's year from «planet's»; a ruler marks Mars's
//         distance on «distance»; on «year» everything stops and the clock shows «?».
//   L8    on «1619» the real page (Harmonices Mundi, Bk V ch. III, p. 189; public domain, Smithsonian Libraries scan via
//         Wikimedia Commons, public/papers/SOURCES.md) slides in; graphite highlight on «Sed res est certissima …
//         sesquialtera …»; translation panel; then the gloss: two orbits, one 4× the other's radius, stopwatches
//         reading 1 and 8 (the 8 lands on «longer»).
//   L9    log-log axes (ticks 1, 10, 100) on «plot»; a graphite line on «line»; Mercury..Saturn (NASA NSSDCA) drop in
//         on «six planets» and land on «sit», where the line turns amber (insight sting) and Kepler's own word
//         «praecise» stamps beside it. Fitted slope 1.498 is labelled; the narration never says "exactly".
//   out   spill hand-off to C5: the plot stays full size to the cut.
import { ShotScene, W, H, rgba, tw, ease, clamp, lerp, F, txt, PaperView, type SC } from './_shots';
import { lab, K } from './_devices';
import { paperBeat, beatTimes, type BeatOpts, type BeatQuote } from './_papers';
import { STRIP, drawStrip, intro, inCam, inScroll, inStrip, inDrift, prevStill, drawFrame } from './trailer_filmstrip_kit';
import { t3Line } from './trailer_t3_kit';

const L = (n: number) => `C4-L${n}`;
// receipt hash: the T3 capture this chapter shows
export const T3_USED = 't3/C4-L5/index.json';

// NASA NSSDCA Planetary Fact Sheet: mean distance a (AU), sidereal period T (years). Fitted log-log slope 1.498.
const PLANETS: [name: string, a: number, T: number][] = [
  ['MERCURY', 0.387, 0.241], ['VENUS', 0.723, 0.615], ['EARTH', 1, 1],
  ['MARS', 1.524, 1.881], ['JUPITER', 5.204, 11.86], ['SATURN', 9.57, 29.43],
];
const SLOPE = 1.498;

// ---- L7 orbit plate (schematic radii; angular speed follows the real periods)
const SUN = { x: 960, y: 548 };
const RAD = [70, 110, 150, 200, 268, 328];
const PH0 = [0.6, 2.4, 4.1, 2.45, 5.3, 1.2]; // start angles (rad); Mars starts lower left, sweeps up
const YPS = 0.21; // simulated years per second of narration
const CLK = { x: 1392, y: 300, r: 62 };

// ---- L9 plot box (world px = screen px at z 1), log10 ranges: ticks 1, 10, 100 on both axes
const PX0 = 640, PX1 = 1440, PY0 = 800, PY1 = 214;
const LA0 = -0.62, LA1 = 2.06, LT0 = -0.78, LT1 = 2.08;
const px = (a: number) => PX0 + ((Math.log10(a) - LA0) / (LA1 - LA0)) * (PX1 - PX0);
const py = (T: number) => PY0 - ((Math.log10(T) - LT0) / (LT1 - LT0)) * (PY0 - PY1);
const lineY = (a: number) => py(Math.pow(10, SLOPE * Math.log10(a)));
const LOFF: [number, number, CanvasTextAlign][] = [[24, 12, 'left'], [22, 44, 'left'], [22, 44, 'left'], [22, 44, 'left'], [22, 46, 'left'], [24, 14, 'left']];

export default class C4 extends ShotScene {
  page: PaperView | null = null;

  async build() {
    const q = this.q, ctx = this.ctx;
    const tEnd = ctx.end;
    const t3 = await t3Line(q, L(5), 'page', { title: { paper: 1, size: 44, y: 150 } });
    const tm = t3.tm;
    // L7
    const tRule = q.w(L(7), 'rule'), tPlanetS = q.w(L(7), "planet's"), tDist = q.w(L(7), 'distance'), tYear = q.w(L(7), 'year');
    // L8
    const t1619 = q.w(L(8), '1619'), tFour = q.w(L(8), 'Four'), tLonger = q.w(L(8), 'longer');
    // L9
    const tL9 = q.s(L(9)), tPlot = q.w(L(9), 'plot'), tLine = q.w(L(9), 'line'), tSix = q.w(L(9), 'six'), tSit = q.w(L(9), 'sit');

    // ---- the 1619 page (public domain scan) and its beat
    this.page = await PaperView.load('kepler1619');
    const base: BeatQuote = this.page
      ? (this.page.q('third-law') as BeatQuote)
      : { id: 'third-law', page: 0, lines: [], text: '' };
    // The Short panel must leave the gloss its time before «longer»: 7 words (a 4 s hold) instead of quotes.json's
    // 14-word tr_short. Same sense as the full translation (tr): the periods go as the 3/2 power of the distances.
    const quote: BeatQuote = { ...base, tr_short: 'Periods: precisely the 3/2 power of distances.' };
    const tIn = t1619 - 0.25;
    const opts: BeatOpts = {
      view: this.page, q: quote, short: true,
      // paperBeat's own citeBar sets 15/14 px (below the 24 px floor): pass it empty, draw ours (citeBig)
      head: '', cite: '',
      line: [tIn, q.end(L(8))], tIn, hi0: tIn + 0.45, hi1: tIn + 2.0,
      card: { head: 'KEPLER · HARMONICES MUNDI · 1619', cite: 'Book V, ch. III, p. 189', text: '«Sed res est certissima exactissimaque … sit praecise sesquialtera proportionis mediarum distantiarum»' },
    };
    const { pIn, pOut } = beatTimes(opts);
    const tGloss = pOut - 0.25; // the gloss plate fades in as the panel leaves

    // ---- arrival through the strip (C3 → C4 'spill')
    const ib = intro('C4');
    const prev = await prevStill(ctx, ib);
    const t3shot = t3.shot({
      t0: ctx.start,
      // the strip keys first; the T3 push starts where the push-in lands
      cam: inCam(ib),
      drift: (t) => inDrift(ib)(t) * (1 - clamp((t - (tm.e - 0.6)) / 0.4)),
      paint: (o, p) => {
        if (!inStrip(ib, o.t)) { p(o); return; }
        drawStrip(o, {
          cx: W / 2, cy: H / 2, frames: 5, first: STRIP.first(4), scroll: inScroll(ib, o.t),
          inner: (oo, k, x, y, w, h) => {
            if (k === -1) drawFrame(oo.c, prev, x, y, w, h);
            if (k === 0) { oo.c.save(); oo.s.save(); oo.c.translate(x, y); oo.s.translate(x, y); p(oo); oo.c.restore(); oo.s.restore(); }
          },
        });
      },
    });
    // drop the kit's first key (z 1 at the line start): the strip push-in lands later than that
    t3shot.cam = [...inCam(ib), ...t3.keys().filter((k) => k[0] > ib.push1 + 0.05)];
    // the re-typed tag waits until the push-in has landed (no tag floating beside a strip frame)
    t3shot.hud = (o) => {
      t3.tag(o, tw(o.t, ib.push1 - 0.1, ib.push1 + 0.2));
      if (o.t >= tm.lift0 && o.t < tm.dis1 - 0.02) t3.title(o);
    };
    // the lifted title shrinks to a kicker as the page arrives
    t3.opt.title!.shrink = { t0: tIn - 0.55, t1: tIn - 0.05, size: 26, y: 62 };

    const k = { tRule, tPlanetS, tDist, tYear, tIn, tGloss, tFour, tLonger, tL9, tPlot, tLine, tSix, tSit, plate0: tm.dis0 };
    this.shots = [
      t3shot,
      {
        t0: tm.dis1, t1: tEnd, paper: 1, fi: 0.5,
        cam: [K(tm.dis0, W / 2, 548, 1.04), K(tYear + 0.4, W / 2, 540, 1.0), K(tGloss, W / 2, 540, 1.0), K(tL9 - 0.1, W / 2, 540, 1.01),
          K(tL9 + 0.3, W / 2, 540, 1.0), K(tEnd, W / 2, 540, 1.012)],
        draw: (o: SC) => {
          const t = o.t;
          const aOrb = 1 - tw(t, tIn - 0.35, tIn + 0.05);
          if (aOrb > 0.001) orbits(o, k, aOrb);
          const aGl = tw(t, tGloss, tGloss + 0.4) * (1 - tw(t, tL9 - 0.25, tL9 + 0.1));
          if (aGl > 0.001) gloss(o, k, aGl);
          if (t > tL9 - 0.25) plot(o, k, tw(t, tL9 - 0.25, tL9 + 0.15));
        },
        hud: (o: SC) => {
          const c = o.c, t = o.t;
          t3.title(o);
          paperBeat(c, t, opts);
          const ca = (1 - tw(t, pIn - 0.15, pIn + 0.35)) * tw(t, tIn + 0.2, tIn + 0.7);
          if (this.page && ca > 0.001) citeBig(c, ca);
          const ad = tw(t, tL9, tL9 + 0.5);
          if (ad > 0.001) lab(c, 'DATA: NASA NSSDCA PLANETARY FACT SHEET', 432, 112, ad * 0.75, rgba('ink', 0.75), 24, 'left', 500, 1);
        },
      },
    ];
  }
}

type Keys = { tRule: number; tPlanetS: number; tDist: number; tYear: number; tIn: number; tGloss: number; tFour: number; tLonger: number; tL9: number; tPlot: number; tLine: number; tSix: number; tSit: number; plate0: number };
const ink = (a: number) => rgba('ink', a);

/** citation lower-third under the page window (paperBeat's page rect), type at the 24 px floor */
function citeBig(c: CanvasRenderingContext2D, a: number) {
  c.save(); c.globalAlpha *= a;
  c.fillStyle = rgba('ink', 0.94); c.fillRect(432, 746, 1056, 92);
  txt(c, 'KEPLER · HARMONICES MUNDI · LINZ 1619', 454, 782, { size: 26, f: F.mono(600), ls: 2, col: rgba('bone', 1) });
  txt(c, 'Book V, ch. III, p. 189 · Smithsonian scan · public domain', 454, 818, { size: 24, f: F.mono(400), col: rgba('bone', 0.8) });
  c.restore();
}

/** an engraved sun: a ring, radial hatching, a hatched core */
function sun(c: CanvasRenderingContext2D, x: number, y: number, r: number, a: number) {
  c.save(); c.globalAlpha *= a;
  c.strokeStyle = ink(0.85); c.lineWidth = 1.6; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 1; c.strokeStyle = ink(0.5);
  for (let i = 0; i < 24; i++) { const g = (i / 24) * Math.PI * 2; c.beginPath(); c.moveTo(x + Math.cos(g) * (r + 5), y + Math.sin(g) * (r + 5)); c.lineTo(x + Math.cos(g) * (r + (i % 2 ? 11 : 17)), y + Math.sin(g) * (r + (i % 2 ? 11 : 17))); c.stroke(); }
  c.save(); c.beginPath(); c.arc(x, y, r - 1, 0, Math.PI * 2); c.clip();
  c.strokeStyle = ink(0.35); for (let d = -r; d < r; d += 4) { c.beginPath(); c.moveTo(x + d, y - r); c.lineTo(x + d + r, y + r); c.stroke(); }
  c.restore(); c.restore();
}

/** a stopwatch: dial, crown, eight hairline ticks; amber progress ring to `p` (0..1); text in the middle */
function stopwatch(o: SC, x: number, y: number, r: number, p: number, mid: string, midSize: number, a: number, hand = true) {
  const c = o.c, s = o.s;
  c.save(); c.globalAlpha *= a;
  c.fillStyle = 'rgba(250,247,240,0.96)'; c.strokeStyle = ink(0.85); c.lineWidth = 2.2;
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
  c.lineWidth = 1; c.beginPath(); c.arc(x, y, r - 7, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 2; c.beginPath(); c.roundRect(x - 9, y - r - 18, 18, 12, 3); c.stroke(); c.beginPath(); c.moveTo(x, y - r - 6); c.lineTo(x, y - r); c.stroke();
  for (let i = 0; i < 8; i++) { const g = -Math.PI / 2 + (i / 8) * Math.PI * 2; c.beginPath(); c.moveTo(x + Math.cos(g) * (r - 7), y + Math.sin(g) * (r - 7)); c.lineTo(x + Math.cos(g) * (r - 16), y + Math.sin(g) * (r - 16)); c.stroke(); }
  c.restore();
  if (p > 0) {
    s.save(); s.globalAlpha *= a; s.strokeStyle = rgba('blood', 0.95); s.lineWidth = 6; s.lineCap = 'round';
    s.beginPath(); s.arc(x, y, r - 3.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(p)); s.stroke(); s.restore();
    if (hand) {
      const g = -Math.PI / 2 + Math.PI * 2 * p;
      c.save(); c.globalAlpha *= a; c.strokeStyle = rgba('blood', 1); c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(g) * (r - 18), y + Math.sin(g) * (r - 18)); c.stroke(); c.restore();
    }
  }
  if (mid) txt(c, mid, x, y + midSize * 0.36, { size: midSize, f: F.archivo(100, 800), col: ink(0.95 * a), align: 'center' });
}

// ------------------------------------------------------------------ L7: the goal (six orbits, ruler, clock, «?»)
function orbits(o: SC, k: Keys, a: number) {
  const c = o.c, s = o.s, t = o.t;
  const pIn = tw(t, k.plate0, k.plate0 + 0.9, ease.outCubic);
  const tStop = k.tYear + 0.05;
  const tt = Math.min(t, tStop), years = Math.max(0, tt - k.plate0) * YPS;
  const ang = (i: number) => PH0[i]! + (2 * Math.PI * years) / PLANETS[i]![2] * -1; // counter-clockwise on screen
  c.save(); c.globalAlpha *= a;
  sun(c, SUN.x, SUN.y, 26, pIn);
  // orbits: hairlines drawn in, outward
  RAD.forEach((r, i) => {
    const p = tw(t, k.plate0 + 0.05 * i, k.plate0 + 0.5 + 0.06 * i, ease.outCubic);
    if (p <= 0) return;
    c.strokeStyle = ink(i === 3 ? 0.7 : 0.42); c.lineWidth = i === 3 ? 1.5 : 1.1;
    c.beginPath(); c.arc(SUN.x, SUN.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); c.stroke();
  });
  // planets
  const SZ = [6, 9, 9, 8, 17, 15];
  RAD.forEach((r, i) => {
    const pa = tw(t, k.plate0 + 0.3 + 0.06 * i, k.plate0 + 0.6 + 0.06 * i);
    if (pa <= 0) return;
    const g = ang(i), x = SUN.x + Math.cos(g) * r, y = SUN.y + Math.sin(g) * r;
    if (i === 3) { s.save(); s.globalAlpha *= a * pa; s.fillStyle = rgba('blood', 1); s.beginPath(); s.arc(x, y, SZ[i]! + 2, 0, Math.PI * 2); s.fill(); s.restore(); }
    else { c.save(); c.globalAlpha *= pa; c.fillStyle = ink(0.88); c.beginPath(); c.arc(x, y, SZ[i]!, 0, Math.PI * 2); c.fill(); c.restore(); }
    if (i === 5) { c.save(); c.globalAlpha *= pa; c.strokeStyle = ink(0.7); c.lineWidth = 1.4; c.beginPath(); c.ellipse(x, y, SZ[i]! * 1.9, SZ[i]! * 0.55, -0.35, 0, Math.PI * 2); c.stroke(); c.restore(); }
  });
  const gM = ang(3), mx = SUN.x + Math.cos(gM) * RAD[3]!, my = SUN.y + Math.sin(gM) * RAD[3]!;
  lab(c, 'MARS', mx + 22, my - 18, tw(t, k.plate0 + 0.6, k.plate0 + 1.0), ink(0.85), 30, 'left', 600, 1);
  // the ruler: Sun → Mars, end ticks, «DISTANCE»
  const pr = tw(t, k.tDist - 0.15, k.tDist + 0.35, ease.outCubic);
  if (pr > 0) {
    const ex = lerp(SUN.x, mx, pr), ey = lerp(SUN.y, my, pr), nx = -(my - SUN.y) / RAD[3]!, ny = (mx - SUN.x) / RAD[3]!;
    s.save(); s.globalAlpha *= a; s.strokeStyle = rgba('blood', 0.95); s.lineWidth = 3;
    s.beginPath(); s.moveTo(SUN.x, SUN.y); s.lineTo(ex, ey); s.stroke();
    for (const [qx, qy] of [[SUN.x, SUN.y], [ex, ey]]) { s.beginPath(); s.moveTo(qx! - nx * 12, qy! - ny * 12); s.lineTo(qx! + nx * 12, qy! + ny * 12); s.stroke(); }
    for (let j = 1; j < 8; j++) { const u = j / 8; if (u > pr) break; const qx = lerp(SUN.x, mx, u), qy = lerp(SUN.y, my, u); s.beginPath(); s.moveTo(qx - nx * 6, qy - ny * 6); s.lineTo(qx + nx * 6, qy + ny * 6); s.stroke(); }
    s.restore();
    const sg = ny >= 0 ? 1 : -1; // the label sits on the lower side of the ruler, clear of the Sun
    const lx = (SUN.x + mx) / 2 + nx * 56 * sg, ly = (SUN.y + my) / 2 + ny * 56 * sg;
    lab(c, 'DISTANCE', lx, ly + 10, tw(t, k.tDist, k.tDist + 0.3), rgba('blood', 1), 30, 'center', 600, 2);
  }
  // the clock: Mars's year; it ticks with Mars from «planet's» and stops on «year» with «?»
  const pc = tw(t, k.tPlanetS - 0.25, k.tPlanetS + 0.15, ease.outBack);
  if (pc > 0) {
    // leader from Mars to the clock
    c.save(); c.setLineDash([6, 7]); c.strokeStyle = ink(0.4 * pc); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(mx, my); c.lineTo(CLK.x - CLK.r - 6, CLK.y); c.stroke(); c.restore();
    const swept = Math.max(0, Math.min(t, tStop) - (k.tPlanetS - 0.25)) * YPS / PLANETS[3]![2];
    const q = tw(t, k.tYear, k.tYear + 0.25, ease.outBack);
    c.save(); c.translate(CLK.x, CLK.y); c.scale(pc, pc); c.translate(-CLK.x, -CLK.y);
    stopwatch(o, CLK.x, CLK.y, CLK.r, swept, '', 0, 1, q < 0.5);
    if (q > 0) {
      c.save(); c.translate(CLK.x, CLK.y); c.scale(lerp(1.6, 1, clamp(q)), lerp(1.6, 1, clamp(q)));
      txt(c, '?', 0, 26, { size: 76, f: F.serif(700, false), col: rgba('blood', clamp(q)), align: 'center' }); c.restore();
    }
    c.restore();
    lab(c, 'YEAR', CLK.x, CLK.y + CLK.r + 52, pc, ink(0.85), 30, 'center', 600, 2);
  }
  txt(c, 'SCHEMATIC · NOT TO SCALE', 1460, 884, { size: 24, f: F.mono(500), ls: 2, align: 'right', col: ink(0.42 * pIn) });
  c.restore();
}

// ------------------------------------------------------------------ L8 gloss: 4× farther, 8× longer
function gloss(o: SC, k: Keys, a: number) {
  const c = o.c, s = o.s, t = o.t;
  const S0 = { x: 810, y: 540 }, r1 = 78, r4 = 312;
  const A = { x: 1330, y: 318 }, B = { x: 1330, y: 640 }, R = 66;
  c.save(); c.globalAlpha *= a;
  sun(c, S0.x, S0.y, 22, 1);
  c.strokeStyle = ink(0.55); c.lineWidth = 1.3;
  c.beginPath(); c.arc(S0.x, S0.y, r1, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.arc(S0.x, S0.y, r4, 0, Math.PI * 2); c.stroke();
  // the two planets: inner one at the top, outer one at the right
  const p1 = { x: S0.x, y: S0.y - r1 }, p4 = { x: S0.x + r4, y: S0.y };
  c.fillStyle = ink(0.9);
  c.beginPath(); c.arc(p1.x, p1.y, 10, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(p4.x, p4.y, 13, 0, Math.PI * 2); c.fill();
  // rulers: 1 and 4
  c.strokeStyle = ink(0.8); c.lineWidth = 2;
  c.beginPath(); c.moveTo(S0.x, S0.y - 30); c.lineTo(p1.x, p1.y + 14); c.stroke();
  c.beginPath(); c.moveTo(S0.x + 30, S0.y); c.lineTo(p4.x - 16, p4.y); c.stroke();
  for (let j = 1; j < 4; j++) { const x = S0.x + (r4 * j) / 4; c.beginPath(); c.moveTo(x, S0.y - 9); c.lineTo(x, S0.y + 9); c.stroke(); }
  c.restore();
  lab(c, '1', S0.x - 22, S0.y - r1 / 2 + 12, a, ink(0.9), 40, 'right', 600, 0);
  lab(c, '4× FARTHER', S0.x + r4 / 2, S0.y + 58, a, ink(0.9), 34, 'center', 600, 1);
  // stopwatches: each planet's year; the outer one sweeps to a full turn and reads 8 on «longer»
  const pB = tw(t, k.tGloss + 0.25, k.tLonger + 0.05, ease.inOutQuad);
  const eight = tw(t, k.tLonger - 0.05, k.tLonger + 0.25, ease.outBack);
  for (const [P, Q] of [[p1, A], [p4, B]] as const) {
    c.save(); c.globalAlpha *= a; c.setLineDash([6, 7]); c.strokeStyle = ink(0.4); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(P.x + 14, P.y); c.lineTo(Q.x - R - 8, Q.y); c.stroke(); c.restore();
  }
  stopwatch(o, A.x, A.y, R, 1 / 8, '1', 60, a, true);
  stopwatch(o, B.x, B.y, R, pB, eight > 0 ? '8' : '', 60, a, true);
  if (eight > 0) {
    s.save(); s.globalAlpha *= a * (1 - clamp((t - k.tLonger - 0.1) / 0.5)) * 0.8; s.strokeStyle = rgba('signal', 1); s.lineWidth = 3;
    s.beginPath(); s.arc(B.x, B.y, R + 10 + 20 * clamp(eight), 0, Math.PI * 2); s.stroke(); s.restore();
  }
  lab(c, 'YEAR', A.x, A.y + R + 46, a, ink(0.8), 30, 'center', 600, 2);
  lab(c, '8× LONGER', B.x, B.y + R + 46, a * clamp(eight), rgba('blood', 1), 34, 'center', 700, 1);
}

// ------------------------------------------------------------------ L9: log-log plot, the snap on «sit»
function plot(o: SC, k: Keys, a: number) {
  const c = o.c, s = o.s, t = o.t;
  const lb = (str: string, x: number, y: number, al: number, col: string, size = 30, ...r: [CanvasTextAlign?, number?, number?]) => lab(c, str, x, y, al * a, col, size, ...r);
  const ax = tw(t, k.tL9 - 0.2, k.tL9 + 0.6, ease.outCubic);
  c.save(); c.globalAlpha *= a; c.lineWidth = 1.6; c.strokeStyle = ink(0.85);
  c.beginPath(); c.moveTo(PX0, PY0); c.lineTo(lerp(PX0, PX1, ax), PY0); c.stroke();
  c.beginPath(); c.moveTo(PX0, PY0); c.lineTo(PX0, lerp(PY0, PY1, ax)); c.stroke();
  // log grid: decades bold, the minor lines (2..9) hairline; it draws in on «plot»
  c.lineWidth = 0.9;
  const ga = tw(t, k.tPlot - 0.5, k.tPlot + 0.4);
  for (let d = -1; d <= 2; d++) for (let m = 1; m <= 9; m++) {
    const v = m * Math.pow(10, d), lv = Math.log10(v);
    if (lv > LA0 && lv < LA1) { c.strokeStyle = ink((m === 1 ? 0.3 : 0.1) * ga); c.beginPath(); c.moveTo(px(v), PY0); c.lineTo(px(v), PY1); c.stroke(); }
    if (lv > LT0 && lv < LT1) { c.strokeStyle = ink((m === 1 ? 0.3 : 0.1) * ga); c.beginPath(); c.moveTo(PX0, py(v)); c.lineTo(PX1, py(v)); c.stroke(); }
  }
  c.restore();
  // ticks 1, 10, 100 (each decade the same length: that is «this kind of plot»)
  const ta = tw(t, k.tPlot - 0.4, k.tPlot + 0.2);
  for (const v of [1, 10, 100]) {
    lb(String(v), px(v), PY0 + 46, ta, ink(0.9), 38, 'center', 600, 0);
    lb(String(v), PX0 - 18, py(v) + 13, ta, ink(0.9), 38, 'right', 600, 0);
  }
  lb('DISTANCE FROM THE SUN (AU) →', PX1, PY0 + 100, ax, ink(0.9), 32, 'right', 600, 1);
  lb('↑ YEAR (EARTH YEARS)', PX0 - 18, PY1 - 30, ax, ink(0.9), 32, 'left', 600, 1);

  // the rule as a graphite line on «line»
  const a0 = 0.3, a1 = 22; // (the line stays inside the plot box)
  const g = tw(t, k.tLine - 0.6, k.tLine + 0.4, ease.inOutCubic);
  if (g > 0) {
    c.save(); c.globalAlpha *= a; c.setLineDash([12, 8]); c.lineWidth = 2.2; c.strokeStyle = ink(0.75);
    const aE = Math.pow(10, lerp(Math.log10(a0), Math.log10(a1), g));
    c.beginPath(); c.moveTo(px(a0), lineY(a0)); c.lineTo(px(aE), lineY(aE)); c.stroke(); c.restore();
  }
  // on «sit» the line turns amber: the insight sting
  const sn = tw(t, k.tSit - 0.05, k.tSit + 0.3, ease.outCubic);
  if (sn > 0) {
    const aE = Math.pow(10, lerp(Math.log10(a0), Math.log10(a1), sn));
    for (const [lw, col] of [[9, rgba('signal', 0.35)], [3.2, rgba('signal', 1)]] as [number, string][]) {
      s.save(); s.globalAlpha *= a; s.lineCap = 'round'; s.lineWidth = lw; s.strokeStyle = col;
      s.beginPath(); s.moveTo(px(a0), lineY(a0)); s.lineTo(px(aE), lineY(aE)); s.stroke(); s.restore();
    }
    c.save(); c.globalAlpha *= a; c.lineCap = 'round'; c.lineWidth = 2.4; c.strokeStyle = rgba('blood', 0.9);
    c.beginPath(); c.moveTo(px(a0), lineY(a0)); c.lineTo(px(aE), lineY(aE)); c.stroke(); c.restore();
  }
  // the six planets drop from the top on «six planets» and land on their real points on «sit»
  PLANETS.forEach(([name, aa, T], i) => {
    const td = k.tSix + i * 0.08, u = tw(t, td, k.tSit + 0.02, (x) => ease.outBack(x, 1.3));
    if (u <= 0) return;
    const x = px(aa), y = lerp(PY1 - 60, py(T), u);
    const al = clamp((t - td) / 0.12) * a;
    const pulse = sn > 0 ? Math.max(0, 1 - (t - k.tSit - i * 0.04) / 0.5) : 0;
    c.save(); c.globalAlpha *= al; c.fillStyle = ink(0.92);
    c.beginPath(); c.arc(x, y, 12, 0, Math.PI * 2); c.fill(); c.restore();
    if (sn > 0) { s.save(); s.globalAlpha *= sn * a; s.fillStyle = rgba('signal', 1); s.beginPath(); s.arc(x, y, 7 + 10 * pulse, 0, Math.PI * 2); s.fill(); s.restore(); }
    const [dx, dy, al2] = LOFF[i]!;
    lab(c, name, x + dx, y + dy, al * tw(t, k.tSit, k.tSit + 0.3), ink(0.9), 30, al2, 600, 1);
  });
  // Kepler's own word, stamped beside the line on «sit», and the measured slope
  const kw = tw(t, k.tSit + 0.15, k.tSit + 0.45, ease.outBack);
  if (kw > 0) {
    c.save(); c.globalAlpha *= a * clamp(kw); c.translate(652, 280); c.rotate(-0.05); c.scale(lerp(1.35, 1, clamp(kw)), lerp(1.35, 1, clamp(kw)));
    txt(c, '«praecise»', 0, 0, { size: 84, f: F.serif(600, true), col: rgba('blood', 1) });
    c.restore();
    lb('KEPLER’S WORD: “PRECISELY”', 658, 324, clamp(kw), ink(0.8), 28, 'left', 600, 1);
  }
  const fs = tw(t, k.tSit + 0.5, k.tSit + 0.9);
  if (fs > 0) lb('FITTED SLOPE 1.498', 1430, 700, fs, ink(0.85), 36, 'right', 600, 1);
}

