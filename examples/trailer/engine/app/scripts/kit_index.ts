#!/usr/bin/env bun
// Kit index: one Markdown table of every export in the shared scene kits, so builders find a helper without paging
// through scene files. Then `show` prints one export's source (with its doc comment) and nothing else.
//   bun scripts/kit_index.ts [--out KIT_INDEX.md] [--dir src/scenes]   write the index (default: ./KIT_INDEX.md)
//   bun scripts/kit_index.ts show <name> [--dir src/scenes]            print that export's source, file:line first
//   bun scripts/kit_index.ts list                                     names only, one line per kit file
// Kits are src/scenes/_*.ts plus private kits (kit_*.ts, *_kit.ts). Each row: name, kind, signature, the first line
// of its doc comment, file:line, and up to three uses in chapter scenes (c<N>.ts) or other kits.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1]! : d; };
const dir = path.resolve(opt('dir', 'src/scenes'));
const isKit = (f: string) => f.endsWith('.ts') && (f.startsWith('_') || f.startsWith('kit_') || f.endsWith('_kit.ts'));
const files = readdirSync(dir).filter(isKit).sort();
const scenes = readdirSync(dir).filter((f) => f.endsWith('.ts')).sort();

interface Entry { name: string; kind: string; sig: string; doc: string; file: string; line: number; start: number; end: number }

/** Index of the matching close bracket for the open bracket at `i`, skipping strings, templates and comments. */
function matchClose(s: string, i: number): number {
  const open = s[i]!, close = ({ '{': '}', '(': ')', '[': ']' } as Record<string, string>)[open]!;
  let depth = 0;
  for (let k = i; k < s.length; k++) {
    const ch = s[k]!;
    if (ch === '/' && s[k + 1] === '/') { k = s.indexOf('\n', k); if (k < 0) return s.length; continue; }
    if (ch === '/' && s[k + 1] === '*') { k = s.indexOf('*/', k + 2) + 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      for (k++; k < s.length && s[k] !== ch; k++) if (s[k] === '\\') k++;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) return k;
  }
  return s.length;
}

/** End of a declaration that starts at `i`: the body's closing brace, or the `;`/newline ending a one-liner. */
function declEnd(s: string, i: number, kind: string): number {
  if (kind === 'function' || kind === 'class' || kind === 'interface' || kind === 'enum') {
    let k = i;
    // skip the parameter list (may hold object types with braces), then take the body
    const p = s.indexOf('(', i), b = s.indexOf('{', i);
    if (kind === 'function' && p >= 0 && p < b) k = matchClose(s, p) + 1;
    const body = s.indexOf('{', k);
    return body < 0 ? s.indexOf('\n', i) : matchClose(s, body) + 1;
  }
  // const/let/type: up to the first ';' or blank-line-ending newline at bracket depth 0
  for (let k = i, depth = 0; k < s.length; k++) {
    const ch = s[k]!;
    if (ch === '(' || ch === '{' || ch === '[') { k = matchClose(s, k); continue; }
    if (ch === '"' || ch === "'" || ch === '`') { for (k++; k < s.length && s[k] !== ch; k++) if (s[k] === '\\') k++; continue; }
    if (depth === 0 && (ch === ';' || (ch === '\n' && !/^\s*[.?:|&+\-*/=]/.test(s.slice(k + 1, k + 40)) && !/[=,(\[{+\-*/|&?:]\s*$/.test(s.slice(Math.max(i, k - 40), k))))) return k + 1;
  }
  return s.length;
}

/** The doc comment (/** … *\/ or // lines) directly above offset `i`, and where it starts. */
function docAbove(s: string, i: number): { doc: string; start: number } {
  const before = s.slice(0, i).replace(/\s+$/, '');
  if (before.endsWith('*/')) {
    const a = before.lastIndexOf('/**');
    if (a >= 0 && !before.slice(a, -2).includes('*/')) {
      const text = before.slice(a + 3, -2).split('\n').map((l) => l.replace(/^\s*\*\s?/, '').trim()).filter(Boolean);
      return { doc: text[0] ?? '', start: a };
    }
  }
  const lines = before.split('\n');
  const doc: string[] = [];
  while (lines.length && /^\s*\/\/(?!\s*-{4})/.test(lines[lines.length - 1]!)) doc.unshift(lines.pop()!.replace(/^\s*\/\/\s?/, ''));
  return { doc: doc[0] ?? '', start: doc.length ? lines.join('\n').length + (lines.length ? 1 : 0) : i };
}

function signature(s: string, i: number, kind: string, name: string): string {
  let sig: string;
  if (kind === 'function') {
    const p = s.indexOf('(', i);
    const close = matchClose(s, p);
    const rest = s.slice(close + 1, s.indexOf('{', close + 1));
    sig = s.slice(p, close + 1) + (rest.trim().startsWith(':') ? rest.trim() : '');
  } else if (kind === 'class' || kind === 'interface') {
    sig = s.slice(i, s.indexOf('{', i)).replace(/^export\s+(abstract\s+)?(class|interface)\s+\w+/, '').trim();
  } else {
    const line = s.slice(i, s.indexOf('\n', i));
    sig = line.replace(new RegExp(`^export\\s+(const|let|type)\\s+${name}\\s*`), '');
  }
  sig = sig.replace(/\s+/g, ' ').trim();
  return sig.length > 150 ? sig.slice(0, 147) + '…' : sig;
}

const RX = /^export\s+(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(function\*?|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;

function indexFile(f: string): { entries: Entry[]; reexports: string[] } {
  const s = readFileSync(path.join(dir, f), 'utf8');
  const entries: Entry[] = [];
  for (const m of s.matchAll(RX)) {
    const kind = m[1]!.replace('*', ''), name = m[2]!, i = m.index!;
    const { doc, start } = docAbove(s, i);
    let sig = signature(s, i, kind, name), d = doc;
    const tail = sig.match(/;?\s*\/\/\s*(.+)$/);
    if (tail) { sig = sig.slice(0, tail.index).trim(); d = d || tail[1]!; }
    entries.push({ name, kind, sig, doc: d, file: f, line: s.slice(0, i).split('\n').length, start, end: declEnd(s, i, kind) });
  }
  const reexports = [...s.matchAll(/^export\s+(?:type\s+)?\{([^}]+)\}/gm)].flatMap((m) => m[1]!.split(',').map((x) => x.trim()).filter(Boolean));
  return { entries, reexports };
}

const all = files.map((f) => ({ f, ...indexFile(f) }));

function uses(name: string, own: string): string[] {
  const rx = new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`);
  const out: string[] = [];
  for (const f of scenes) {
    if (f === own) continue;
    const lines = readFileSync(path.join(dir, f), 'utf8').split('\n');
    for (let k = 0; k < lines.length && out.length < 3; k++) {
      const l = lines[k]!;
      if (rx.test(l) && !/^\s*import\b/.test(l) && !/^\s*(\/\/|\*)/.test(l)) { out.push(`${f}:${k + 1}`); break; }
    }
    if (out.length >= 3) break;
  }
  return out;
}

const cmd = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'write';
if (cmd === 'show') {
  const name = argv[1];
  const hits = all.flatMap((x) => x.entries).filter((e) => e.name === name);
  if (!name || !hits.length) {
    const near = all.flatMap((x) => x.entries).map((e) => e.name).filter((n) => name && n.toLowerCase().includes(name.toLowerCase()));
    console.error(`no export named ${name ?? '(none)'}${near.length ? `; similar: ${near.slice(0, 8).join(', ')}` : ''}`);
    process.exit(1);
  }
  for (const e of hits) {
    const s = readFileSync(path.join(dir, e.file), 'utf8');
    console.log(`// ${path.relative(process.cwd(), path.join(dir, e.file))}:${e.line}`);
    console.log(s.slice(e.start, e.end).replace(/^\n+/, '').trimEnd());
  }
} else if (cmd === 'list') {
  for (const x of all) console.log(`${x.f}: ${x.entries.map((e) => e.name).join(', ')}`);
} else {
  const out = path.resolve(opt('out', 'KIT_INDEX.md'));
  const esc = (t: string) => t.replace(/\|/g, '\\|');
  const md: string[] = [
    '# Kit index (generated)',
    '',
    `Generated by \`bun scripts/kit_index.ts\` from \`${path.relative(path.dirname(out), dir) || '.'}\`; do not edit by hand.`,
    'Find the helper here, then `bun scripts/kit_index.ts show <name>` prints its source. Do not page through scene files.',
    '',
  ];
  let n = 0;
  for (const x of all) {
    md.push(`## ${x.f}`, '');
    if (x.reexports.length) md.push(`Re-exports: ${x.reexports.map((r) => `\`${r}\``).join(', ')}`, '');
    if (!x.entries.length) { md.push('(no exports)', ''); continue; }
    md.push('| name | kind | signature | doc | at | used in |', '|---|---|---|---|---|---|');
    for (const e of x.entries) {
      md.push(`| \`${e.name}\` | ${e.kind} | ${e.sig ? `\`${esc(e.sig)}\`` : ''} | ${esc(e.doc)} | ${e.file}:${e.line} | ${uses(e.name, e.file).join(' ')} |`);
      n++;
    }
    md.push('');
  }
  writeFileSync(out, md.join('\n'));
  console.log(`kit index: ${n} exports in ${all.length} kit files -> ${path.relative(process.cwd(), out)}`);
}
