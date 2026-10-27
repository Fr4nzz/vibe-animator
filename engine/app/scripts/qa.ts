#!/usr/bin/env bun
// Layout QA for scene builders: a short text report, one line per violation, nothing for passing items.
//   bun scripts/qa.ts [--chapter C3[,C4]] [--lines C3-L2,C3-L5] [--url http://localhost:<port>] [--json]
//                     [--every 2] [--min-px 24] [--no-panels]
//   bun scripts/qa.ts --sheet C3 [--url …]     one ~1600 px contact sheet (a tile per line, guides at x 420/1500,
//                                              violations boxed in red); prints its path
//   bun scripts/qa.ts --texts C3               every scene text drawn per line, as plain text (one line per sample:
//                                              "C3-L2 12.34s | text | text"), for grepping required phrases
//   --at end|end-0.5|<0..1>|<percent>|+<s>[,…]  where in each line to sample (sheet, texts, checks, stills): "end" = the line's end − 0.3 s
//                            with captions off (late reveals complete); a fraction of the line (sheet/texts default 0.6)
// Review images (print only PNG paths; at most 12 images per chapter per run; under engine/work/qa/):
//   --still C3-L2[,C3-L5] [--t 12.5,13 | --at end]   full-resolution 1920x1080 still(s) of a line (default its 60 %)
//   --strip C3-L2 [--n 8] [--from s --to s]          one horizontal strip of N frames (320 px) across the line: motion
//   --crop C3-L2 x,y,w,h [--t s | --at f]            a full-resolution crop (1920x1080 coordinates): art, legibility
//   [--samples 1] sub-frames per still (4 = the render's motion blur)   [--no-captions]
// Before the browser: a type check of the chapters' scene files changed since the last clean check (scripts/
// typecheck.ts; errors are reported as kind "type"; --no-typecheck skips it).
// Lock: the QA lock (lib.ts acquireLock 'qa'): runs beside a render only when free memory allows; gives up after
// --budget s (default 200) with exit 75 "lock busy (held by …), rerun later". Wrapping it in flock is harmless.
// Checks (sampled at each line's 30 % and 60 % points and 0.15 s before its end, plus every --every s):
//   square   text crossing x 420 / x 1500 in a line inside a Short unit (timing.json short markers)
//   size     text below the style floor: --panel-px (40) for translation-panel text, else --min-px (24); 3 % slack
//   offframe text leaving the 1920x1080 frame
//   caption  scene text inside the caption band (where the HUD drew captions; at least the two-line band, y > 928)
//   cue      q.w/q.e/q.s/q.end-style cues naming a line or word missing from data/lyrics.json (static scan
//            of app/src/scenes), plus scene init/render errors
//   type     a TypeScript error in the chapters' scene files or kits (scripts/typecheck.ts)
//   hold     a translation panel (text matching a "tr", "tr_panel" or "tr_short" (legacy "es", "es_panel",
//            "es_short") in public/papers/**/quotes.json) visible shorter than max(4, 0.33 s x words + 1.5 s);
//            edges found to 1/60 s
//   squeeze  a panel up for more than 6 s that leaves the plate beside it too small: the largest free rectangle of
//            the frame (or the Short square, in a Short line) above the caption band and outside the panel must be
//            at least --squeeze-h (0.55, about 600 px) of 1080 px tall and --squeeze-w (0.5) of the region wide.
//            Checked only when scene text (a plate's labels, below y 140) is drawn outside the panel: a panel-only
//            beat passes. Fix: a side column outside Shorts; page → panel → plate in sequence inside one.
// Line ids follow the convention <CHAPTER>-L<n> ("C3-L8"); chapters come from engine/data/chapters.json.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  APP, ENGINE, argParser, chapterOf, chapterWindows, devServer, ensureLocked, launch, lyricsLines, openExport, entriesFor, readJSON, sceneFiles,
  shortLines, writeAtomic, type Line,
} from './lib';
import { typecheckFiles } from './typecheck';

const argv = process.argv.slice(2);
const { opt, flag } = argParser(argv);
const JSON_OUT = flag('json');
const SHEET = opt('sheet');
const TEXTS = opt('texts');
const STILL = opt('still'), STRIP = opt('strip'), CROP = opt('crop');
const CROP_BOX = CROP ? argv[argv.indexOf('--crop') + 2]?.split(',').map(Number) : undefined;
const IMAGES = STILL ?? STRIP ?? CROP; // review-image modes: line ids
const REPORT = !SHEET && !TEXTS && !IMAGES;
const MAX_IMAGES = 12; // per chapter per run (tokens)
/** --at: where in a line to sample: "end" = end − 0.3 s (captions off); 0..1 = that fraction of the line; 1 < v ≤ 100
 *  = that percent (`--at 30,60,end`); "+1.5" = 1.5 s after the line starts; "end-0.5" = 0.5 s before it ends. For a
 *  song time use --t. (Values > 1 used to be clamped to the fraction 1, i.e. every sample landed on the line end.) */
const AT = opt('at')?.split(',').filter(Boolean);
const atTime = (l: Line, a: string): number => {
  const s = a.trim();
  if (s === 'end') return Math.max(l.start, l.end - 0.3);
  const m = /^end-(\d*\.?\d+)$/.exec(s);
  if (m) return Math.max(l.start, l.end - +m[1]!);
  if (s.startsWith('+')) return l.start + Number(s.slice(1));
  const v = Number(s);
  if (!Number.isFinite(v) || v < 0 || v > 100) { console.error(`--at: cannot read "${a}" (end | end-0.5 | 0..1 | 30 (%) | +1.5; song times: --t)`); process.exit(2); }
  const f = v > 1 ? v / 100 : v;
  return Math.min(l.end - 1 / 60, l.start + f * (l.end - l.start));
};
const atTimes = (l: Line, dflt: string[]) => (AT ?? dflt).map((a) => atTime(l, a));
const CAPTIONS_OFF = !!AT?.includes('end') || !!TEXTS || flag('no-captions');
const MIN_PX = +opt('min-px', '24')!;
const PANEL_PX = +opt('panel-px', '40')!;
const EVERY = +opt('every', '0')!;
const SQZ_H = +opt('squeeze-h', '0.55')!, SQZ_W = +opt('squeeze-w', '0.5')!;
const SQ0 = 420, SQ1 = 1500, FW = 1920, FH = 1080;
const ALPHA_MIN = 0.35; // fainter text is a fade, not a layout
const T0 = performance.now();
const dbg = (m: string) => { if (process.env.QA_DEBUG) console.error(`[${((performance.now() - T0) / 1000).toFixed(1)}s] ${m}`); };

interface Rec { scene: string; text: string; family: string; px: number; x0: number; y0: number; x1: number; y1: number; alpha: number }
interface Violation { chapter: string; line: string; t: number; kind: string; text: string; detail: string }

// ------------------------------------------------------------------ selection
const wins = chapterWindows();
const allLines = lyricsLines();
const shorts = shortLines();
let chapters = (opt('chapter') ?? SHEET ?? TEXTS ?? '').split(',').filter(Boolean).map((s) => s.toUpperCase());
// line ids keep their case (C5-L2b): match case-insensitively, then use the id as lyrics.json spells it
const canonId = (s: string) => allLines.find((l) => l.id.toUpperCase() === s.toUpperCase())?.id ?? s.toUpperCase();
const lineSel = (IMAGES ?? opt('lines'))?.split(',').filter(Boolean).map(canonId);
if (IMAGES && !lineSel!.length) { console.error('--still/--strip/--crop need line ids (C3-L2[,…])'); process.exit(2); }
if (CROP && (!CROP_BOX || CROP_BOX.length !== 4 || CROP_BOX.some((v) => !Number.isFinite(v)) || CROP_BOX[2]! <= 0 || CROP_BOX[3]! <= 0)) { console.error('usage: --crop C3-L2 x,y,w,h (1920x1080 coordinates)'); process.exit(2); }
if (lineSel) chapters = [...new Set([...chapters, ...lineSel.map(chapterOf)])];
if (!chapters.length) chapters = wins.map((w) => w.id);
const bad = chapters.filter((c) => !wins.some((w) => w.id === c));
if (bad.length) { console.error(`unknown chapter ${bad.join(',')} (have ${wins.map((w) => w.id).join(',')})`); process.exit(2); }
const lines = allLines.filter((l) => chapters.includes(chapterOf(l.id)) && (!lineSel || lineSel.includes(l.id)));
const missing = lineSel?.filter((id) => !allLines.some((l) => l.id === id)) ?? [];
if (IMAGES && missing.length) { console.error(`unknown line ${missing.join(',')}`); process.exit(2); }

// ------------------------------------------------------------------ static cue check (no browser)
const lineById = new Map(allLines.map((l) => [l.id, l]));
const normW = (s: string) => s.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}¿?\-]/gu, ''); // (same rule as Cues in scenes/_shots.ts)
let nCues = 0;
function cueCheck(): Violation[] {
  const out: Violation[] = [];
  const dir = opt('scenes') ?? path.join(APP, 'src/scenes'); // (--scenes: check another folder's sources)
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(path.join(dir, f), 'utf8');
    // line-id helpers: const L = (n: number) => `C3-L${n}`
    const helpers = new Map<string, string>();
    for (const m of src.matchAll(/const\s+(\w+)\s*=\s*\(\s*\w+\s*(?::[^)]*)?\)\s*=>\s*`([A-Z]\w*-L)\$\{/g)) helpers.set(m[1]!, m[2]!);
    const H = [...helpers.keys()].join('|') || '__no_helper__'; // (always present: keeps the group numbers fixed)
    const ref = `(?:(['"\`])([A-Z]\\w*-L\\w+)\\1|\\b(${H})\\(\\s*(\\d+|'\\w+')\\s*\\))`;
    // groups: 1 quote, 2 quoted id | 3 helper name, 4 its argument
    const resolve = (m: RegExpMatchArray) => m[2] ?? (m[3] ? helpers.get(m[3])! + m[4]!.replace(/'/g, '') : '');
    const lineNo = (i: number) => src.slice(0, i).split('\n').length;
    // word cues: anything(LINEREF, 'word'[, n])
    for (const m of src.matchAll(new RegExp(`\\b[\\w.]+\\(\\s*${ref}\\s*,\\s*(['"])((?:(?!\\5).)+)\\5\\s*(?:,\\s*(\\d+)\\s*)?\\)`, 'g'))) {
      const id = resolve(m), w = m[6]!, nth = +(m[7] ?? 0);
      if (!chapters.includes(chapterOf(id)) || (lineSel && !lineSel.includes(id))) continue;
      nCues++;
      const l = lineById.get(id);
      if (!l) { out.push({ chapter: chapterOf(id), line: id, t: 0, kind: 'cue', text: w, detail: `no line ${id} in lyrics.json (${f}:${lineNo(m.index!)})` }); continue; }
      const ex = l.words.filter((x) => normW(x.w) === normW(w)); // same rule as Cues: an exact word wins over a prefix
      const hits = ex.length ? ex : l.words.filter((x) => normW(x.w).startsWith(normW(w)));
      if (hits.length <= nth) out.push({ chapter: chapterOf(id), line: id, t: l.start, kind: 'cue', text: w, detail: `word not in line${nth ? ` (#${nth}, ${hits.length} found)` : ''} (${f}:${lineNo(m.index!)})` });
    }
    // bare line references
    for (const m of src.matchAll(new RegExp(ref, 'g'))) {
      const id = resolve(m);
      if (!id || !/-L\d+$/.test(id) || lineById.has(id) || !chapters.includes(chapterOf(id))) continue;
      out.push({ chapter: chapterOf(id), line: id, t: 0, kind: 'cue', text: id, detail: `no line ${id} in lyrics.json (${f}:${lineNo(m.index!)})` });
    }
  }
  const seen = new Set<string>();
  return out.filter((v) => { const k = v.line + v.text + v.detail; if (seen.has(k)) return false; seen.add(k); return true; });
}

// ------------------------------------------------------------------ translation texts
const norm = (s: string) => s.toLowerCase().replace(/[“”"«»‘’']/g, '').replace(/\s+/g, ' ').trim();
const panels: { key: string; es: string; n: string }[] = []; // es = the translation text (field "tr", or legacy "es")
(function loadQuotes(dir: string) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) loadQuotes(p);
    else if (f === 'quotes.json') {
      const q = readJSON(p);
      for (const [paper, e] of Object.entries<any>(q)) for (const x of e?.quotes ?? []) {
        for (const [k, tr] of [['', x.tr ?? x.es], [':panel', x.tr_panel ?? x.es_panel], [':short', x.tr_short ?? x.es_short]] as [string, string | undefined][])
          if (tr) panels.push({ key: `${paper}/${x.id}${k}`, es: tr, n: norm(tr) });
      }
    }
  }
})(path.join(APP, 'public'));
const holdFor = (es: string) => Math.max(4, 0.33 * es.split(/\s+/).filter(Boolean).length + 1.5);
function panelOf(r: Rec) {
  const t = norm(r.text);
  if (t.length < 3) return null;
  return panels.find((p) => (t.length >= 10 || t.length === p.n.length) && p.n.includes(t)) ?? null;
}
/** Translation texts readable in a frame: >= 60 % of the "es" text drawn at alpha >= 0.5 (one phrase that merely
 * repeats a few words of a translation elsewhere is not a panel). */
function panelsIn(recs: Rec[]) {
  // per key and font: share of the translation drawn (a label elsewhere that repeats a few of its words is in another font)
  const cov = new Map<string, number>();
  for (const r of recs) if (r.scene !== 'hud' && r.alpha >= 0.5) {
    const p = panelOf(r);
    if (p) { const k = `${p.key}\n${r.family}`; cov.set(k, (cov.get(k) ?? 0) + norm(r.text).length / p.n.length); }
  }
  return new Set([...cov].filter(([, c]) => c >= 0.6).map(([k]) => k));
}
const isPanelText = (r: Rec, shown: Set<string>) => { const p = panelOf(r); return !!p && shown.has(`${p.key}\n${r.family}`); };

// ------------------------------------------------------------------ records
/** Join pieces drawn one after another on one baseline (per-word or per-glyph drawing) into one run. */
function merge(recs: Rec[]): Rec[] {
  const out: Rec[] = [];
  for (const r of recs) {
    const p = out[out.length - 1];
    if (p && p.scene === r.scene && p.family === r.family && Math.abs(p.px - r.px) < 0.5) {
      const ov = Math.min(p.y1, r.y1) - Math.max(p.y0, r.y0), h = Math.min(p.y1 - p.y0, r.y1 - r.y0);
      const gap = r.x0 - p.x1;
      if (ov > 0.5 * h && gap > -0.3 * r.px && gap < 0.7 * r.px) {
        p.text += gap > 0.18 * r.px && !/\s$/.test(p.text) && !/^\s/.test(r.text) ? ' ' + r.text : r.text;
        p.x1 = Math.max(p.x1, r.x1); p.y0 = Math.min(p.y0, r.y0); p.y1 = Math.max(p.y1, r.y1); p.alpha = Math.max(p.alpha, r.alpha);
        continue;
      }
    }
    out.push({ ...r });
  }
  // the same run drawn twice (a halo stroke and its fill): keep one
  const seen = new Set<string>();
  return out.filter((r) => { const k = `${r.scene}|${r.text}|${r.x0.toFixed(0)}|${r.y0.toFixed(0)}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

interface Sample { t: number; line: string; recs: Rec[] }
const lineAt = (t: number) => { let b: Line | undefined; for (const l of allLines) if (l.start <= t + 1e-6) b = l; return b?.id ?? '—'; };
const clip = (s: string, n = 44) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// ------------------------------------------------------------------ run
const static_ = REPORT ? cueCheck() : [];
dbg(`${nCues} word cues checked statically`);
// type check first (no browser, no lock): the selected chapters' scene files and kits, if changed since a clean check
if ((REPORT || SHEET) && !flag('no-typecheck')) {
  const tc = await typecheckFiles(wins.filter((w) => chapters.includes(w.id)).flatMap(sceneFiles), true);
  dbg(`typecheck ${tc.skipped ? 'skipped' : `${tc.errors.length} errors`} ${tc.ms.toFixed(0)}ms`);
  if (REPORT) for (const e of tc.errors.slice(0, 20)) static_.push({ chapter: chapters[0]!, line: '—', t: 0, kind: 'type', text: '', detail: e });
  else if (tc.errors.length) console.error(`${tc.errors.length} type errors (bun scripts/typecheck.ts --chapter ${chapters.join(',')})`);
}
await ensureLocked('qa');
const { url, stop } = await devServer(opt('url'));
const browser = await launch(flag('headed'));
const pageErrors = new Set<string>();
try {
  const page = await browser.newPage({ viewport: { width: FW, height: FH }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) pageErrors.add(m.text().split('\n')[0]!.slice(0, 160)); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) pageErrors.add(`HTTP ${r.status()} ${r.url().replace(url, '')}`); });
  page.on('pageerror', (e) => pageErrors.add(String(e.message).split('\n')[0]!.slice(0, 160)));
  const cw = wins.filter((w) => chapters.includes(w.id));
  const from = Math.min(...cw.map((w) => w.from)), to = Math.max(...cw.map((w) => w.to));
  dbg('browser up');
  const ids = await entriesFor(page, url, from, to);
  dbg('timeline ' + ids.join(','));
  await openExport(page, url, `&qa=1&only=${ids.join(',') || '__none__'}${CAPTIONS_OFF ? '&captions=0' : ''}`);
  const sceneErrors: string[] = await page.evaluate(() => (window as any).__pdoom.errors);
  dbg('scenes loaded');
  if (!(await page.evaluate(() => !!(window as any).__pdoom.qaFrame))) throw new Error('this engine has no ?qa=1 support (engine/qa.ts)');

  const frame = async (t: number): Promise<Rec[]> => {
    const r = await page.evaluate((t) => (window as any).__pdoom.qaFrame(t), t);
    const z: number = r.zoom, [sx, sy] = r.shake as [number, number];
    const recs = (r.recs as Rec[]).map((x) => x.scene === 'hud' || (z === 1 && !sx && !sy) ? x : {
      ...x, px: x.px * z, x0: (x.x0 - FW / 2 + sx) * z + FW / 2, x1: (x.x1 - FW / 2 + sx) * z + FW / 2, y0: (x.y0 - FH / 2 + sy) * z + FH / 2, y1: (x.y1 - FH / 2 + sy) * z + FH / 2,
    });
    return merge(recs);
  };
  const keyTimes = (l: Line) => {
    const d = l.end - l.start;
    return d > 1 ? [l.start + 0.3 * d, l.start + 0.6 * d, l.end - 0.15] : [l.start + 0.5 * d];
  };

  // ---------------------------------------------------------------- review images (--still / --strip / --crop)
  const reviewImages = async () => {
    const SAMPLES = +opt('samples', '1')!;
    const dir = path.join(ENGINE, 'work/qa');
    const T = opt('t')?.split(',').map(Number).filter(Number.isFinite);
    const used = new Map<string, number>();
    let skipped = 0;
    const take = (l: Line) => { const c = chapterOf(l.id), n = used.get(c) ?? 0; if (n >= MAX_IMAGES) { skipped++; return false; } used.set(c, n + 1); return true; };
    /** Render t with the export's own readback into an offscreen canvas in the page (copying the WebGL canvas
     * garbles tiles under Vulkan). */
    const grab = (t: number) => page.evaluate(async ({ t, s }) => {
      const P = (window as any).__pdoom;
      P.still(t, s, 0.5);
      const px: Uint8Array = await P.engine.readPixelsAsync(), PW = P.width, PH = P.height, row = PW * 4;
      const img = new ImageData(PW, PH);
      for (let y = 0; y < PH; y++) img.data.set(px.subarray((PH - 1 - y) * row, (PH - y) * row), y * row);
      const w = window as any;
      if (!w.__qaGrab) w.__qaGrab = new OffscreenCanvas(PW, PH);
      w.__qaGrab.getContext('2d').putImageData(img, 0, 0);
    }, { t, s: SAMPLES });
    const png = async (fn: string) => {
      const b64: string = await page.evaluate(fn);
      return Buffer.from(b64, 'base64');
    };
    const blob64 = `async (cv) => { const b = new Uint8Array(await (await cv.convertToBlob({ type: 'image/png' })).arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); }`;
    for (const l of lines) {
      if (STILL) {
        for (const t of T ?? atTimes(l, ['0.6'])) {
          if (!take(l)) continue;
          await grab(t);
          const out = path.join(dir, `still_${l.id}_${t.toFixed(2)}.png`);
          writeAtomic(out, await png(`(${blob64})(window.__qaGrab)`));
          console.log(out);
        }
      } else if (STRIP) {
        if (!take(l)) continue;
        const a = +opt('from', String(l.start))!, b = +opt('to', String(l.end))!, n = Math.max(2, Math.min(MAX_IMAGES, +opt('n', '8')!));
        const tw = 320, th = 180, lab = 16, pad = 3;
        await page.evaluate(({ n, tw, th, lab, pad }) => {
          const cv = new OffscreenCanvas(n * (tw + pad) + pad, th + lab + 2 * pad);
          const c = cv.getContext('2d')!; c.fillStyle = '#1b1b1b'; c.fillRect(0, 0, cv.width, cv.height);
          (window as any).__qaStrip = cv;
        }, { n, tw, th, lab, pad });
        for (let i = 0; i < n; i++) {
          const t = a + ((b - a) * i) / (n - 1) - (i === n - 1 ? 1 / 60 : 0);
          await grab(t);
          await page.evaluate(({ i, t, tw, th, lab, pad }) => {
            const w = window as any, c = w.__qaStrip.getContext('2d'), x = pad + i * (tw + pad);
            c.imageSmoothingQuality = 'high';
            c.drawImage(w.__qaGrab, x, pad + lab, tw, th);
            c.fillStyle = '#ddd'; c.font = '12px monospace'; c.fillText(`${t.toFixed(2)}s`, x + 2, pad + 12);
          }, { i, t, tw, th, lab, pad });
        }
        const out = path.join(dir, `strip_${l.id}.png`);
        writeAtomic(out, await png(`(${blob64})(window.__qaStrip)`));
        console.log(out);
      } else if (CROP) {
        const [x, y, w, h] = CROP_BOX!;
        for (const t of T ?? atTimes(l, ['0.6'])) {
          if (!take(l)) continue;
          await grab(t);
          const out = path.join(dir, `crop_${l.id}_${t.toFixed(2)}_${x}-${y}-${w}x${h}.png`);
          writeAtomic(out, await png(`((cv) => { const o = new OffscreenCanvas(${w}, ${h}); o.getContext('2d').drawImage(cv, ${x}, ${y}, ${w}, ${h}, 0, 0, ${w}, ${h}); return (${blob64})(o); })(window.__qaGrab)`));
          console.log(out);
        }
      }
    }
    if (skipped) console.log(`capped: ${skipped} image${skipped > 1 ? 's' : ''} skipped (at most ${MAX_IMAGES} per chapter per run)`);
  };

  // ---------------------------------------------------------------- contact sheet
  if (IMAGES) await reviewImages();
  else if (TEXTS) {
    // ---------------------------------------------------------------- plain-text dump
    for (const l of lines) for (const t of atTimes(l, ['0.6'])) {
      const recs = (await frame(t)).filter((r) => r.scene !== 'hud' && r.alpha >= ALPHA_MIN && r.x1 > 0 && r.y1 > 0 && r.x0 < FW && r.y0 < FH)
        .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
      const texts = [...new Set(recs.map((r) => r.text.replace(/\s+/g, ' ').trim()).filter(Boolean))];
      console.log(`${l.id} ${t.toFixed(2)}s${texts.length ? ' | ' + texts.join(' | ') : ' (no text)'}`);
    }
  } else if (SHEET) {
    const tiles = lines.flatMap((l) => atTimes(l, ['0.6']).map((t) => ({ t, l })));
    await page.evaluate((n) => {
      const cols = 4, tw = 392, th = 221, lab = 20, pad = 4;
      const cv = document.createElement('canvas');
      cv.width = cols * (tw + pad) + pad; cv.height = Math.ceil(n / cols) * (th + lab + pad) + pad;
      const c = cv.getContext('2d')!; c.fillStyle = '#1b1b1b'; c.fillRect(0, 0, cv.width, cv.height);
      (window as any).__qaSheet = { cv, c, cols, tw, th, lab, pad };
    }, tiles.length);
    for (let i = 0; i < tiles.length; i++) {
      const { t, l } = tiles[i]!;
      const recs = await frame(t);
      const sh = shorts.get(l.id);
      const boxes = violationsAt({ t, line: l.id, recs }, bandOf([{ t, line: l.id, recs }])).map((v) => (v as any).box);
      await page.evaluate(async ({ i, label, sh, boxes }) => {
        const S = (window as any).__qaSheet, k = S.tw / 1920, P = (window as any).__pdoom;
        // the frame through the export's own readback (copying the WebGL canvas garbles tiles under Vulkan)
        const px: Uint8Array = await P.engine.readPixelsAsync(), PW = P.width, PH = P.height, row = PW * 4;
        const img = new ImageData(PW, PH);
        for (let y = 0; y < PH; y++) img.data.set(px.subarray((PH - 1 - y) * row, (PH - y) * row), y * row);
        if (!S.oc) S.oc = new OffscreenCanvas(PW, PH);
        S.oc.getContext('2d').putImageData(img, 0, 0);
        const x = S.pad + (i % S.cols) * (S.tw + S.pad), y = S.pad + Math.floor(i / S.cols) * (S.th + S.lab + S.pad);
        const c: CanvasRenderingContext2D = S.c;
        c.imageSmoothingQuality = 'high';
        c.drawImage(S.oc, x, y + S.lab, S.tw, S.th);
        c.save();
        c.strokeStyle = sh ? 'rgba(255,40,40,0.95)' : 'rgba(255,255,255,0.35)'; c.lineWidth = 1;
        if (!sh) c.setLineDash([3, 3]);
        for (const gx of [420, 1500]) { c.beginPath(); c.moveTo(x + gx * k + 0.5, y + S.lab); c.lineTo(x + gx * k + 0.5, y + S.lab + S.th); c.stroke(); }
        c.setLineDash([]); c.strokeStyle = '#ff2a2a'; c.lineWidth = 2;
        for (const b of boxes) if (b) c.strokeRect(x + b[0] * k - 1, y + S.lab + b[1] * k - 1, (b[2] - b[0]) * k + 2, (b[3] - b[1]) * k + 2);
        c.restore();
        c.fillStyle = boxes.length ? '#ff6b6b' : '#ddd'; c.font = '13px monospace';
        c.fillText(label + (boxes.length ? `  ${boxes.length} issue${boxes.length > 1 ? 's' : ''}` : ''), x + 3, y + 14);
      }, { i, label: `${l.id} ${t.toFixed(1)}s${sh ? ' ' + sh : ''}`, sh: sh ?? null, boxes });
    }
    const dataUrl: string = await page.evaluate(() => (window as any).__qaSheet.cv.toDataURL('image/png'));
    const out = path.join(ENGINE, 'work/qa', `sheet_${SHEET.toUpperCase()}${lineSel ? '_sel' : ''}${AT ? '_' + AT.join('-') : ''}.png`);
    writeAtomic(out, Buffer.from(dataUrl.split(',')[1]!, 'base64'));
    console.log(out);
  } else {
    // ---------------------------------------------------------------- report
    const samples: Sample[] = [];
    for (const l of lines) for (const t of AT ? atTimes(l, []) : keyTimes(l)) samples.push({ t, line: l.id, recs: await frame(t) });
    if (EVERY > 0) for (const w of cw) for (let t = w.from + EVERY / 2; t < w.to; t += EVERY) {
      const id = lineAt(t);
      if (!lineSel || lineSel.includes(id)) samples.push({ t, line: id, recs: await frame(t) });
    }
    dbg(`${samples.length} samples, ${samples.reduce((n, s) => n + s.recs.length, 0)} text runs`);
    if (process.env.QA_DEBUG === '2') for (const s of samples) for (const r of s.recs) console.error(s.line, s.t.toFixed(2), r.scene, JSON.stringify(r.text), r.family, r.px.toFixed(1), [r.x0, r.y0, r.x1, r.y1].map((v) => v.toFixed(0)).join(','), r.alpha.toFixed(2));
    const band = bandOf(samples);
    const found: Violation[] = [...static_];
    for (const e of sceneErrors) found.push({ chapter: chapters[0]!, line: '—', t: 0, kind: 'cue', text: '', detail: 'scene error: ' + e.split('\n')[0]!.slice(0, 140) });
    for (const s of samples) found.push(...violationsAt(s, band));

    // translation panels: find them on a 1 s scan, then each appearance's edges to 1/60 s
    if (!flag('no-panels') && panels.length) {
      const visible = (recs: Rec[], key: string) => [...panelsIn(recs)].some((k) => k.split('\n')[0] === key);
      const seen = new Map<string, number[]>();
      const scan = new Map<number, Rec[]>();
      const spans = lineSel ? lines.map((l) => [l.start, l.end] as const) : cw.map((w) => [w.from, w.to] as const);
      for (const [a, b] of spans) for (let t = a + 0.25; t < b; t += 1) {
        const recs = await frame(t); scan.set(t, recs);
        for (const k of new Set([...panelsIn(recs)].map((k) => k.split('\n')[0]!))) seen.set(k, [...(seen.get(k) ?? []), t]);
      }
      for (const [key, ts] of seen) {
        const p = panels.find((x) => x.key === key)!;
        const vis = async (t: number) => visible(scan.get(t) ?? (await frame(t)), key);
        const done: [number, number][] = [];
        for (const t of [...new Set(ts)].sort((a, b) => a - b)) {
          if (done.some(([a, b]) => t >= a && t <= b)) continue;
          let lo = t, hi = t - 1; // left edge: hi invisible, lo visible
          while (hi > t - 60 && (await vis(hi))) { lo = hi; hi -= 1; }
          for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; if (await vis(m)) lo = m; else hi = m; }
          const left = lo;
          lo = t; hi = t + 1;
          while (hi < t + 60 && (await vis(hi))) { lo = hi; hi += 1; }
          for (let k = 0; k < 7; k++) { const m = (lo + hi) / 2; if (await vis(m)) lo = m; else hi = m; }
          done.push([left, lo]);
          const held = lo - left, need = holdFor(p.es);
          dbg(`panel ${key} ${left.toFixed(2)}–${lo.toFixed(2)} held ${held.toFixed(2)} need ${need.toFixed(2)}`);
          const id = lineAt(left);
          if (held < need - 0.05 && (!lineSel || lineSel.includes(id)))
            found.push({ chapter: chapterOf(id), line: id, t: left, kind: 'hold', text: p.es, detail: `${key} held ${held.toFixed(2)}s < ${need.toFixed(2)}s` });
          if (held > 6 && !flag('no-squeeze')) {
            let worst: { t: number; d: string; line: string; score: number } | null = null;
            for (const ts of [left + 1, (left + lo) / 2, lo - 1]) {
              const sq = squeezeAt(await frame(ts), key, lineAt(ts), band.y0);
              if (sq && (!worst || sq.score < worst.score)) worst = { t: ts, d: sq.detail, line: lineAt(ts), score: sq.score };
            }
            if (worst && (!lineSel || lineSel.includes(worst.line)))
              found.push({ chapter: chapterOf(worst.line), line: worst.line, t: worst.t, kind: 'squeeze', text: p.es, detail: `${key} up ${held.toFixed(1)}s: ${worst.d}` });
          }
        }
      }
    }

    // one line per (line, kind, text): first time, worst detail kept
    const uniq = new Map<string, Violation>();
    for (const v of found) { const k = `${v.line}|${v.kind}|${v.text}`; if (!uniq.has(k)) uniq.set(k, v); }
    const vs = [...uniq.values()].sort((a, b) => a.chapter.localeCompare(b.chapter, 'en', { numeric: true }) || a.t - b.t);
    for (const e of pageErrors) if (!sceneErrors.some((s) => s.includes(e.slice(0, 40)))) vs.push({ chapter: '—', line: '—', t: 0, kind: 'cue', text: '', detail: 'page error: ' + e });
    const counts: Record<string, number> = {};
    for (const v of vs) counts[v.kind] = (counts[v.kind] ?? 0) + 1;
    if (JSON_OUT) console.log(JSON.stringify({ chapters, samples: samples.length, band, violations: vs.map(({ ...v }) => { delete (v as any).box; return v; }) }, null, 1));
    else {
      let cur = '';
      for (const v of vs) {
        if (v.chapter !== cur) { cur = v.chapter; console.log(`${cur}:`); }
        console.log(`  ${v.line.padEnd(7)} ${v.t ? v.t.toFixed(2).padStart(7) + 's' : '        '}  ${v.kind.padEnd(8)} ${v.text ? `"${clip(v.text)}"  ` : ''}${v.detail}`);
      }
      console.log(`TOTAL ${vs.length}${vs.length ? ' (' + Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', ') + ')' : ''} · ${chapters.join(',')} · ${lines.length} lines, ${samples.length} samples`);
    }
  }
} finally {
  await browser.close();
  stop();
}
process.exit(0);

// ------------------------------------------------------------------ checks
/** The caption band: the box the HUD's captions occupied over these samples (else the two-line default). */
function bandOf(samples: Sample[]) {
  let y0 = Infinity, x0 = Infinity, x1 = -Infinity;
  for (const s of samples) for (const r of s.recs) if (r.scene === 'hud' && r.y0 > FH * 0.6) { y0 = Math.min(y0, r.y0); x0 = Math.min(x0, r.x0); x1 = Math.max(x1, r.x1); }
  return y0 < Infinity ? { y0: Math.min(y0, 928), x0: Math.min(x0, 240), x1: Math.max(x1, FW - 240) } : { y0: 928, x0: 240, x1: FW - 240 };
}

function violationsAt(s: Sample, band: { y0: number; x0: number; x1: number }): (Violation & { box?: number[] })[] {
  const out: (Violation & { box?: number[] })[] = [];
  const short = shorts.get(s.line);
  const ch = chapterOf(s.line);
  const shown = panelsIn(s.recs);
  for (const r of s.recs) {
    if (r.scene === 'hud' || r.alpha < ALPHA_MIN) continue;
    if (r.x1 <= 0 || r.y1 <= 0 || r.x0 >= FW || r.y0 >= FH) continue; // wholly off-frame: not seen
    const box = [r.x0, r.y0, r.x1, r.y1];
    const v = (kind: string, detail: string) => out.push({ chapter: ch, line: s.line, t: s.t, kind, text: r.text, detail, box });
    if (short && (r.x0 < SQ0 - 1 || r.x1 > SQ1 + 1)) v('square', `x ${r.x0.toFixed(0)}–${r.x1.toFixed(0)} (${short}: keep in 420–1500)`);
    const panel = isPanelText(r, shown);
    const need = panel ? PANEL_PX : MIN_PX;
    if (r.px < need * 0.97) v('size', `${r.px.toFixed(1)} px < ${need}${panel ? ' (translation)' : ''} · ${r.family}`);
    if (r.x0 < -1 || r.y0 < -1 || r.x1 > FW + 1 || r.y1 > FH + 1) v('offframe', `box ${r.x0.toFixed(0)},${r.y0.toFixed(0)}–${r.x1.toFixed(0)},${r.y1.toFixed(0)}`);
    else if (r.y1 > band.y0 && r.x1 > band.x0 && r.x0 < band.x1) v('caption', `bottom y ${r.y1.toFixed(0)} > caption band ${band.y0.toFixed(0)}`);
  }
  return out;
}

/**
 * The plate left beside a translation panel. null = fine (or no plate drawn beside the panel); else the largest free
 * rectangle (outside the padded panel box, above the caption band, inside the frame or the Short square) and a score.
 */
function squeezeAt(recs: Rec[], key: string, line: string, bandY: number): { detail: string; score: number } | null {
  const mine = recs.filter((r) => r.scene !== 'hud' && r.alpha >= 0.5 && panelOf(r)?.key === key);
  if (!mine.length) return null;
  const bx0 = Math.min(...mine.map((r) => r.x0)) - 44, bx1 = Math.max(...mine.map((r) => r.x1)) + 44;
  const by0 = Math.min(...mine.map((r) => r.y0)) - 84, by1 = Math.max(...mine.map((r) => r.y1)) + 40;
  const inShort = !!shorts.get(line);
  const rx0 = inShort ? SQ0 : 0, rx1 = inShort ? SQ1 : FW, ry0 = 0, ry1 = Math.min(bandY, FH);
  const inPanel = (r: Rec) => r.x0 >= bx0 - 2 && r.x1 <= bx1 + 2 && r.y0 >= by0 - 2 && r.y1 <= by1 + 2;
  // a plate beside the panel shows itself by its labels (FIG headers and kickers at the top are not a plate)
  const plate = recs.filter((r) => r.scene !== 'hud' && r.alpha >= ALPHA_MIN && !inPanel(r) && !panelOf(r) && r.y0 > 140 && !/^TRADUCCI/i.test(r.text)
    && (r.x0 + r.x1) / 2 > rx0 && (r.x0 + r.x1) / 2 < rx1 && (r.y0 + r.y1) / 2 < ry1);
  if (!plate.length) return null;
  const rects = [
    [rx0, ry0, Math.max(rx0, Math.min(rx1, bx0)), ry1], [Math.min(rx1, Math.max(rx0, bx1)), ry0, rx1, ry1],
    [rx0, ry0, rx1, Math.max(ry0, Math.min(ry1, by0))], [rx0, Math.min(ry1, Math.max(ry0, by1)), rx1, ry1],
  ].map(([a, b, c, d]) => ({ w: Math.max(0, c! - a!), h: Math.max(0, d! - b!) }));
  const needH = SQZ_H * FH, needW = SQZ_W * (rx1 - rx0);
  const ok = rects.some((r) => r.w >= needW && r.h >= needH);
  if (ok) return null;
  const best = rects.reduce((m, r) => (Math.min(r.w / needW, r.h / needH) > Math.min(m.w / needW, m.h / needH) ? r : m));
  return { detail: `plate left ${best.w.toFixed(0)}×${best.h.toFixed(0)} px < ${needW.toFixed(0)}×${needH.toFixed(0)}${inShort ? ' (Short square)' : ''}; use a side column or page → panel → plate in sequence`, score: Math.min(best.w / needW, best.h / needH) };
}
