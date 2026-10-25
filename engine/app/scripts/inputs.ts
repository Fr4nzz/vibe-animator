#!/usr/bin/env bun
// The files a render reads (lib.ts renderInputs), as a JSON array of absolute paths, for receipts made outside the
// engine (tools/make_shorts.py). No browser, no lock.
//   bun scripts/inputs.ts --from 12.3 --to 40     chapters overlapping the window
//   bun scripts/inputs.ts --chapter C3[,C4]
import { argParser, chapterWindows, renderInputs, windowsIn } from './lib';

const { opt } = argParser(process.argv.slice(2));
const chs = opt('chapter')?.split(',').map((c) => c.toUpperCase());
const ws = chs ? chapterWindows().filter((w) => chs.includes(w.id)) : windowsIn(+opt('from', '0')!, +opt('to', '1e9')!);
console.log(JSON.stringify(renderInputs(ws)));
