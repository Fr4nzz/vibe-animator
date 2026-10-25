#!/usr/bin/env bun
// Post-render stills grid: one JPEG per chapter clip, for whoever reviews the renders to look at once, as each clip lands.
//   bun scripts/grid.ts C3 [C4 …] | --all        -> engine/work/renders/<CH>.grid.jpg (prints each path)
// Per narration line two 384 px tiles: the line's middle and its end − 0.3 s (late reveals complete), 5 tiles per
// row (about 1930 px wide), each labelled "<line> mid|end <t>s". Pure ffmpeg on the finished clip
// (renders/<ep>_c<N>.mp4): no browser, no render lock, about a second. render_chapter.ts calls it after every clip.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { APP, ENGINE, EPID, chapterOf, chapterWindows, lyricsLines, type Win } from './lib';

const TW = 384, TH = 216, COLS = 5;
const FONT = path.join(APP, 'public/fonts/Archivo-w750-500.ttf');

/** Write <CH>.grid.jpg for one chapter's clip; returns its path, or null (no clip / ffmpeg failed). */
export function makeGrid(w: Win, clip = path.join(ENGINE, 'renders', `${EPID}_c${w.n}.mp4`)): string | null {
  if (!existsSync(clip)) return null;
  const lines = lyricsLines().filter((l) => chapterOf(l.id) === w.id);
  const tiles: { t: number; label: string }[] = [];
  for (const l of lines) {
    tiles.push({ t: (l.start + l.end) / 2, label: `${l.id} mid` });
    tiles.push({ t: Math.max(l.start, l.end - 0.3), label: `${l.id} end` });
  }
  if (!tiles.length) tiles.push({ t: (w.from + w.to) / 2, label: `${w.id} mid` });
  const dur = w.to - w.from;
  const inputs: string[] = [], chains: string[] = [];
  tiles.forEach((x, i) => {
    const rel = Math.min(Math.max(0, x.t - w.from), Math.max(0, dur - 0.05));
    inputs.push('-ss', rel.toFixed(3), '-i', clip);
    const txt = `${x.label} ${x.t.toFixed(1)}s`.replace(/[:\\']/g, ' ');
    chains.push(`[${i}:v]trim=end_frame=1,setpts=PTS-STARTPTS,scale=${TW}:${TH},` +
      `drawtext=fontfile='${FONT}':text='${txt}':x=6:y=6:fontsize=15:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=3[t${i}]`);
  });
  const rows = Math.ceil(tiles.length / COLS);
  const pad = rows * COLS - tiles.length;
  let graph = chains.join(';') + ';';
  for (let k = 0; k < pad; k++) graph += `color=c=0x1b1b1b:s=${TW}x${TH}:d=0.04,trim=end_frame=1[p${k}];`;
  const all = [...tiles.map((_, i) => `[t${i}]`), ...Array.from({ length: pad }, (_, k) => `[p${k}]`)].join('');
  graph += `${all}concat=n=${tiles.length + pad}:v=1:a=0,tile=${COLS}x${rows}:padding=2:margin=2:color=0x1b1b1b[g]`;
  const out = path.join(ENGINE, 'work/renders', `${w.id}.grid.jpg`);
  const p = Bun.spawnSync(['ffmpeg', '-y', '-v', 'error', ...inputs, '-filter_complex', graph, '-map', '[g]', '-frames:v', '1', '-q:v', '4', out], { stdout: 'ignore', stderr: 'pipe' });
  if (p.exitCode !== 0) { console.error(`grid ${w.id} failed: ${p.stderr.toString().trim().split('\n').pop()}`); return null; }
  return out;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const wins = chapterWindows();
  const want = argv.includes('--all') ? wins : argv.filter((a) => !a.startsWith('--')).map((a) => wins.find((w) => w.id === a.toUpperCase()));
  if (!want.length || want.some((w) => !w)) { console.error(`usage: grid.ts C3 [C4 …] | --all (have ${wins.map((w) => w.id).join(',')})`); process.exit(2); }
  let bad = 0;
  for (const w of want as Win[]) { const g = makeGrid(w); if (g) console.log(g); else { bad++; console.log(`${w.id}: no grid (no clip?)`); } }
  process.exit(bad ? 1 : 0);
}
