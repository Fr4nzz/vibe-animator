// Shared, Short-aware paper beat: the real page large, then the translation panel, laid out so a mechanism plate is
// never squeezed under a full-width panel (a ~380 px strip under a panel is too small on a TV; whole chapters had
// to be redone before this helper existed).
//
//   const v = await PaperView.load('smith2020');              // in init()
//   const pb = paperBeat(c, t, { view: v, q, head: 'SMITH 2020', cite: 'J. Example · 2020 · CC BY 4.0',
//                                line: [q0, q1], short: inShort(t) });
//   drawPlate(c, pb.plate, pb.plateA);                       // pb.plate = where the plate may draw now, pb.plateA its opacity
//
// Outside a Short (layout 'side'): the page fills a 1056x640 window (>= 55 % of the frame height) for at least
//   2.5 s while the highlight draws; then it lifts away and the panel takes a right-hand column (38 % of the width,
//   text >= 40 px). The plate gets the left 60 % at full height while the panel holds, then the whole frame.
// Inside a Short (layout 'sequential'): page in the square -> the panel over the lower part of the square, with the
//   page (or the typeset card, `card`, for a quote without a legal page image) kept large and dimmed behind it, so
//   the square never shows a lone panel on black -> plate in the square. Plate and panel never share the square.
// Budget: it reads the panel text (tr_short in a Short, else tr_panel, else tr), its hold (max(4, 0.33 s x words +
//   1.5 s)) and the quote's narration window `line`. When 2.5 s of page + the hold do not fit in the window, the
//   panel is over 30 words or 3 numbers, or a Short panel is over 20 words with no tr_short, it logs one
//   console.error per quote ("[paperBeat] …"), which qa reports as a `cue` page error. Fix the quote, not the timing.
//   tools/quote_budget.py checks the same rules before voicing.
// Pure function of time, like every scene helper.
import { tw } from './_kit';
import { W, ease, PaperView, citeBar, typeCard, F, type PaperQuote } from './_shots';
import { transPanel, panelH, holdFor } from './_devices';

export type Rect = [x: number, y: number, w: number, h: number];
export interface BeatQuote extends PaperQuote { tr_panel?: string; tr_short?: string }
export interface BeatOpts {
  /** the page (await PaperView.load(key)); null draws no page, only the panel (and `card` if given) */
  view: PaperView | null;
  q: BeatQuote;
  /** citation lower-third: head line (AUTHOR YEAR) and detail line (journal · year · licence) */
  head: string;
  cite: string;
  /** the quote's narration window [start of its first line, end of its last line] (q.s / q.end cues) */
  line: [number, number];
  /** page in (default line[0]); highlight from hi0 to hi1 (default tIn + 0.5 … tIn + 2.0) */
  tIn?: number; hi0?: number; hi1?: number;
  /** inside a Short window */
  short?: boolean;
  layout?: 'auto' | 'side' | 'sequential';
  /** panel text px (>= 40), label */
  size?: number; label?: string;
  /** no page image: the typeset citation card drawn in place of the page (visibly not a facsimile) */
  card?: { head: string; cite: string; text: string; size?: number };
}
export interface Beat {
  /** where the mechanism plate may draw now (frame px) and its opacity: 0 while the page is up (and, in a Short,
   * while the panel is up); fades in as the page lifts */
  plate: Rect; plateA: number;
  pageA: number; panelA: number;
  /** the beat's times: page in, panel in, panel out */
  tIn: number; pIn: number; pOut: number;
}

const FRAME: Rect = [96, 92, W - 192, 928 - 92 - 20];
const SQUARE: Rect = [432, 92, 1056, 928 - 92 - 20];
const PAGE_MIN = 2.5;
/** Short layout: the page / card opacity behind the panel (the card's text stays under qa's 0.35 fade threshold) */
const DIM_PAGE = 0.42, DIM_CARD = 0.3;
/** Short layout: the panel's bottom edge (above the caption band) */
const PANEL_BOTTOM = 896;
const warned = new Set<string>();
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const numbers = (s: string) => (s.match(/\d+(?:[.,]\d+)*/g) ?? []).length;

/** The panel text a beat shows. */
export const beatText = (q: BeatQuote, short = false) => (short ? q.tr_short ?? q.tr_panel ?? q.tr ?? '' : q.tr_panel ?? q.tr ?? '');

/** Timing of a beat without drawing (for a scene that schedules other shots around it). */
export function beatTimes(o: BeatOpts) {
  const short = !!o.short;
  const text = beatText(o.q, short);
  const tIn = o.tIn ?? o.line[0];
  const hi1 = o.hi1 ?? tIn + 2.0;
  const pIn = Math.max(tIn + PAGE_MIN, hi1 + 0.3);
  const pOut = pIn + holdFor(text) + 0.6;   // + the fade-in/out, so the readable hold (alpha >= 0.5) meets holdFor
  return { text, tIn, hi0: o.hi0 ?? tIn + 0.5, hi1, pIn, pOut };
}

function budget(o: BeatOpts, text: string, pIn: number, pOut: number) {
  const k = `${o.q.id}|${o.short ? 's' : 'w'}`;
  if (warned.has(k)) return;
  const issues: string[] = [];
  const n = words(text), m = numbers(text);
  if (n > 30) issues.push(`${n} words > 30 (add tr_panel)`);
  if (m > 3) issues.push(`${m} numbers > 3 (numbers go on the plate)`);
  if (o.short && n > 20 && !o.q.tr_short) issues.push(`${n} words in a Short with no tr_short (<= 15 words)`);
  if (pOut > o.line[1] + 0.5) issues.push(`page ${PAGE_MIN}s + hold ${(pOut - pIn).toFixed(1)}s ends ${(pOut - o.line[1]).toFixed(1)}s after its line`);
  if (issues.length) { warned.add(k); console.error(`[paperBeat] ${o.q.id}: ${issues.join('; ')}`); }
}

/** Paper beat: page >= 2.5 s, then the translation panel in a side column (outside Shorts) or in the square (inside one); returns where the plate may draw. */
export function paperBeat(c: CanvasRenderingContext2D, t: number, o: BeatOpts): Beat {
  const short = !!o.short;
  const layout = o.layout && o.layout !== 'auto' ? o.layout : short ? 'sequential' : 'side';
  const { text, tIn, hi0, hi1, pIn, pOut } = beatTimes(o);
  budget(o, text, pIn, pOut);
  const size = Math.max(40, o.size ?? 42);
  const region = short ? SQUARE : FRAME;

  // 1. the page, large: 1056x640 centred in the square (inside the Short crop in both layouts). In the sequential
  //    layout it stays, dimmed, behind the panel, and leaves with it.
  const pageUp = tw(t, tIn - 0.3, tIn + 0.35), pageDown = tw(t, pIn - 0.15, pIn + 0.4);
  const seq = layout === 'sequential';
  const dim = o.view ? DIM_PAGE : DIM_CARD;
  const pageA = seq ? pageUp * (1 - (1 - dim) * pageDown) * (1 - tw(t, pOut - 0.35, pOut)) : pageUp * (1 - pageDown);
  if (pageA > 0.001 && !o.view && o.card) {
    const k = o.card;
    typeCard(c, 452, 120, 1016, [
      { s: k.head, size: 30, f: F.mono(600), a: 0.75 },
      { s: k.text, size: k.size ?? 40, f: F.serif(500, true) },
      { s: k.cite, size: 24, f: F.mono(400), a: 0.65 },
    ], '', pageA * (0.85 + 0.15 * tw(t, hi0, hi1)));
  }
  if (pageA > 0.001 && o.view) {
    const v = o.view, qid = o.q.id;
    const x = 432, w = 1056, y = 92, hh = 640;
    const ub = v.ubox(qid), pw = v.e.pages[0]!.w;
    const fitA = (w / pw) * 0.97;
    const zA = Math.min(1.6, (w * 0.9) / Math.max(200, ub[2]));
    const qx = ub[0] + ub[2] / 2, qy = ub[1] + ub[3] / 2;
    const keys: [number, number, number, number][] = [
      [tIn - 0.4, pw / 2, Math.max(hh / 2 / fitA, ub[1] - 160), fitA],
      [hi0 - 0.4, qx, qy + 30, zA * 0.95],
      [pIn + 0.5, qx, qy + 20, zA * 1.04],
    ];
    v.draw(c, t, { win: [x, y, w, hh], keys, hi: [{ id: qid, t0: hi0, t1: hi1 }], a: pageA, slide: ease.outCubic(tw(t, tIn - 0.3, tIn + 0.5)) });
    citeBar(c, x, y + hh + 14, w, o.head, o.cite, null, pageUp * (1 - pageDown) * tw(t, tIn + 0.2, tIn + 0.7));
  }

  // 2. the panel: a right-hand column (side) or the lower part of the square (sequential)
  const panelA = tw(t, pIn, pIn + 0.45) * (1 - tw(t, pOut - 0.35, pOut));
  let plate: Rect, plateA: number;
  if (layout === 'side') {
    const pw2 = Math.round(W * 0.38), px = W - 96 - pw2;
    const ph = panelH(c, text, pw2, size);
    transPanel(c, px, Math.max(92, (928 - ph) / 2 - 20), pw2, text, panelA, { size, label: o.label });
    plate = t < pOut ? [FRAME[0], FRAME[1], px - 48 - FRAME[0], FRAME[3]] : FRAME;
    plateA = tw(t, pIn - 0.2, pIn + 0.5);
  } else {
    const ph = panelH(c, text, SQUARE[2], size);
    transPanel(c, SQUARE[0], Math.max(92, PANEL_BOTTOM - ph), SQUARE[2], text, panelA, { size, label: o.label });
    plate = region;
    plateA = tw(t, pOut - 0.2, pOut + 0.5);
  }
  return { plate, plateA, pageA, panelA, tIn, pIn, pOut };
}
