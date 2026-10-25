// Example chapter C1 "Where the wax goes" (examples/hello). Both lines are a Short (S01), so every word on screen
// stays inside the square x 420–1500 (scripts/qa.ts checks it) and above the caption band (y < ~900).
// Bone-paper plate: ink type, no glow.
import { ShotScene, W, rgba, tw, ease, F, txt } from './_shots';
import { fig2, say, lab, arrow, T, K, SQ } from './_devices';

const L = (n: number) => `C1-L${n}`;

export default class C1 extends ShotScene {
  build() {
    const q = this.q;
    const t0 = q.s(L(1)), tEnd = q.end(L(2));
    const tWax = q.w(L(1), 'wax'), tOx = q.w(L(1), 'oxygen'), tGas = q.w(L(1), 'gases');
    const tCO2 = q.w(L(1), 'carbon'), tH2O = q.w(L(1), 'water'), tVan = q.w(L(2), 'vanish'), tAir = q.w(L(2), 'air');
    const cx = (SQ.x0 + SQ.x1) / 2, xL = cx - 270, xR = cx + 270;
    this.shots = [{
      t0: t0 - 0.5, t1: tEnd + 1.2, paper: 1,
      cam: [K(t0 - 0.5, W / 2, 540, 1), K(tEnd + 1.2, W / 2, 530, 1.04)],
      draw: (o) => {
        const t = o.t, ink = (a = 1) => rgba('ink', 0.92 * a);
        const rise = tw(t, tVan, tAir + 0.6, ease.inOutCubic); // the gases drift up and fade on L2
        // inputs
        txt(o.c, 'WAX', xL, 330, { size: 64, f: F.archivo(100, 700), col: ink(), align: 'center', p: tw(t, tWax - 0.1, tWax + 0.4) });
        txt(o.c, '+ OXYGEN', xR, 330, { size: 64, f: F.archivo(100, 700), col: ink(), align: 'center', p: tw(t, tOx - 0.1, tOx + 0.4) });
        lab(o.c, 'one gram', xL, 380, tw(t, tWax, tWax + 0.5), ink(0.7), T.L, 'center', 400, 0);
        lab(o.c, 'from the air', xR, 380, tw(t, tOx, tOx + 0.5), ink(0.7), T.L, 'center', 400, 0);
        // two arrows down to the two gases
        const pA = tw(t, tGas - 0.2, tGas + 0.5);
        const yG = 620 - 40 * rise, aG = 1 - rise * 0.85;
        arrow(o.c, [[cx, 410], [cx, 470], [xL, 520]], pA, ink(0.8 * aG), 1.8, 12);
        arrow(o.c, [[cx, 410], [cx, 470], [xR, 520]], pA, ink(0.8 * aG), 1.8, 12);
        o.c.save(); o.c.globalAlpha *= aG;
        txt(o.c, 'CO2', xL, yG, { size: 96, f: F.archivo(100, 700), col: ink(), align: 'center', p: tw(t, tCO2 - 0.1, tCO2 + 0.4) });
        txt(o.c, 'H2O', xR, yG, { size: 96, f: F.archivo(100, 700), col: ink(), align: 'center', p: tw(t, tH2O - 0.1, tH2O + 0.4) });
        lab(o.c, 'carbon dioxide', xL, yG + 50, tw(t, tCO2, tCO2 + 0.5), ink(0.7), T.L, 'center', 400, 0);
        lab(o.c, 'water vapour', xR, yG + 50, tw(t, tH2O, tH2O + 0.5), ink(0.7), T.L, 'center', 400, 0);
        o.c.restore();
        say(o.c, 'Air you cannot see.', cx, 830, tw(t, tAir - 0.2, tAir + 0.5), rgba('ink', 0.95), T.S + 6, 'center');
      },
      hud: (o) => fig2(o.c, 'FIG. 2', 'WHERE THE WAX GOES', tw(o.t, t0 - 0.4, t0 + 0.3), true),
    }];
  }
}
