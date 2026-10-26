#!/usr/bin/env python3
"""session_import: turn a real agent session into a small, scrubbed `session.json` for replay scenes.

  python3 tools/session_import.py claude <agent.jsonl> [--fanout A.jsonl B.jsonl …] -o session.json
  python3 tools/session_import.py t3 <statev2.sqlite> --thread <thread id> -o session.json
      [--deny-file FILE] [--rewrite OLD=NEW …] [--tools Bash,Read,Edit,Write,Agent,Grep,Glob]
      [--duration 12] [--compress sqrt|linear] [--max-events 40] [--prompt "…"] [--ts scenes/agent_session.ts]

Sources
- Claude Code: `~/.claude/projects/<project>/<session>.jsonl`, or a subagent's `<session>/subagents/agent-*.jsonl`
  (its `agent-*.meta.json` beside it gives the description). Only assistant `tool_use` blocks, their `tool_result`,
  assistant `text` blocks and the *duration* of `thinking` blocks are read. User messages are never copied (they carry
  system reminders, CLAUDE.md files and personal context), except the first prompt, scrubbed, or `--prompt`.
- T3 Code (Orchestrator V2, `userdata/statev2.sqlite`, opened read-only): `orchestration_v2_projection_turn_items` of one
  thread, in `ordinal` order (user_message, assistant_message, reasoning, command_execution, dynamic_tool, file_change,
  subagent). Older T3 (`state.sqlite`, `projection_thread_activities`) is not supported.
- `--fanout`: other subagent transcripts launched beside the main one. Each becomes a lane of the fan-out panel: its
  description (meta.json), start and end, and the titles of its tool calls (nothing else).

Scrubbing (every string that leaves this tool passes through `scrub`):
1. path rewriting: `--rewrite OLD=NEW` pairs first (longest first), then any `/home/<user>/` or `/Users/<user>/` → `~/`;
2. emails, URLs with credentials, API-key-looking tokens (sk-…, ghp_…, xi-…, long hex/base64) → `[redacted]`;
3. truncation to one line and a width;
4. a deny-list (`--deny-file`, one case-insensitive regex per line, `#` comments): a hit in a title or prompt drops
   the whole event, a hit in an argument or result blanks that field. Keep project-specific deny files OUTSIDE the
   repository (they name what must not be shown).
A final audit serialises the output and refuses to write it (exit 3) if any deny pattern, email or home path remains.

Time: real timestamps become video seconds by a monotone map: each gap between consecutive events is compressed
(`sqrt` by default: a 2-minute think reads as a pause, not as dead air), floored at `--min-gap`, then all gaps are
scaled so the whole session lasts `--duration` s. Order is always kept. Scenes stretch the result onto word cues.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

DEFAULT_TOOLS = ['Bash', 'Read', 'Edit', 'Write', 'Agent', 'Task', 'Grep', 'Glob', 'TodoWrite']
EMAIL = re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+')
HOME = re.compile(r'(?:/home|/Users)/[^/\s"\'`]+')
SECRET = re.compile(
    r'(?:sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|xi-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}'
    r'|\b[0-9a-f]{32,}\b|\b(?=[A-Za-z0-9+]*\d)(?=[A-Za-z0-9+]*[A-Za-z])[A-Za-z0-9+]{32,}={0,2}|(?:API_KEY|TOKEN|SECRET|PASSWORD)\s*=\s*\S+)')
CRED_URL = re.compile(r'(https?://)[^/\s:@]+:[^/\s@]+@')
NOISE = re.compile(r'^(gl: |\s*$|EOF$)')  # result lines that say nothing (the engine's GPU banner)


def ts(s: str) -> float:
    return datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()


class Scrubber:
    def __init__(self, deny: list[str], rewrites: list[tuple[str, str]]):
        self.deny = [re.compile(p, re.I) for p in deny]
        self.rewrites = sorted(rewrites, key=lambda r: -len(r[0]))

    def denied(self, s: str) -> bool:
        return any(p.search(s) for p in self.deny)

    def clean(self, s: str | None, width: int = 110, line: bool = True) -> str:
        if not s:
            return ''
        for old, new in self.rewrites:
            s = s.replace(old, new)
        s = HOME.sub('~', s)
        s = CRED_URL.sub(r'\1[redacted]@', s)
        s = EMAIL.sub('[email]', s)
        s = SECRET.sub('[redacted]', s)
        if line:
            s = ' '.join(s.split())
        if len(s) > width:
            s = s[: width - 1].rstrip() + '…'
        return s


# ------------------------------------------------------------------ Claude Code
def _result_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for x in content:
            if isinstance(x, dict) and x.get('type') == 'text':
                parts.append(x.get('text', ''))
            elif isinstance(x, dict) and x.get('type') == 'image':
                parts.append('[image]')
        return '\n'.join(parts)
    return ''


def _n(k: int) -> str:
    return f'{k} line' + ('s' if k != 1 else '')


def _one_line_result(name: str, text: str, inp: dict) -> str:
    if name == 'Read':
        if text.strip() in ('', '[image]'):
            return 'image'
        return _n(text.count(chr(10)) + 1)
    if name == 'Write':
        return f'+{(inp.get("content") or "").count(chr(10)) + 1} lines'
    if name == 'Edit':
        a = (inp.get('old_string') or '').count('\n') + 1
        b = (inp.get('new_string') or '').count('\n') + 1
        return f'−{a} +{b} lines'
    lines = [l.strip() for l in text.splitlines() if not NOISE.match(l)]
    if not lines or lines == ['(Bash completed with no output)']:
        return 'done'
    for l in reversed(lines):  # a verdict line says more than the last line of a file dump
        if re.match(r'(TOTAL\b|Traceback|\w*Error\b|error:|FAIL|PASS|ok\b)', l):
            return l
    # anything else is file content: say how much, never quote it (a doc line can be off-topic or private)
    return lines[-1] if len(lines) == 1 and len(lines[-1]) < 60 else _n(len(lines))


def _tool_view(name: str, inp: dict) -> tuple[str, str]:
    """(title, argument) for a tool call: the human line and the mono detail line."""
    base = lambda p: os.path.basename(p or '')
    if name == 'Bash':
        cmd = inp.get('command') or ''
        cmd = re.sub(r'^\s*cd\s+\S+\s*&&\s*', '', cmd)  # the cd prefix says nothing
        first = cmd.splitlines()[0] if cmd else ''
        return inp.get('description') or first[:60], first
    if name in ('Read', 'Write', 'Edit'):
        return f'{name} {base(inp.get("file_path"))}', inp.get('file_path') or ''
    if name in ('Agent', 'Task'):
        return inp.get('description') or 'subagent', inp.get('subagent_type') or 'agent'
    if name in ('Grep', 'Glob'):
        return f'{name} {inp.get("pattern", "")}', inp.get('path') or ''
    if name == 'TodoWrite':
        todos = inp.get('todos') or []
        return 'Update plan', f'{len(todos)} steps'
    return name, ''


def load_claude(path: Path, tools: set[str]) -> dict:
    recs = [json.loads(l) for l in path.open() if l.strip()]
    events, pending, prompt, t_first = [], {}, '', None
    for d in recs:
        if d.get('type') not in ('user', 'assistant') or not d.get('timestamp'):
            continue
        t = ts(d['timestamp'])
        t_first = t if t_first is None else t_first
        content = d['message'].get('content')
        if d['type'] == 'user':
            if isinstance(content, str) or (isinstance(content, list) and content
                                            and content[0].get('type') == 'text'):
                if not prompt:
                    prompt = content if isinstance(content, str) else content[0].get('text', '')
                continue
            for b in content or []:
                if b.get('type') == 'tool_result' and b.get('tool_use_id') in pending:
                    ev = pending.pop(b['tool_use_id'])
                    ev['t_end'] = t
                    ev['status'] = 'error' if b.get('is_error') else 'ok'
                    ev['_result'] = _result_text(b.get('content'))
            continue
        for b in content or []:
            bt = b.get('type')
            if bt == 'thinking' or bt == 'redacted_thinking':
                # never the text: only that it thought, and for how long
                events.append({'t': t, 'kind': 'thinking', 'ms': d.get('thinkingDurationMs') or 0})
            elif bt == 'text' and b.get('text', '').strip():
                events.append({'t': t, 'kind': 'text', '_text': b['text']})
            elif bt == 'tool_use':
                name = b.get('name', '')
                if name not in tools:
                    continue
                ev = {'t': t, 'kind': 'tool', 'name': 'Agent' if name == 'Task' else name, '_input': b.get('input') or {}}
                pending[b.get('id')] = ev
                events.append(ev)
    for ev in events:
        if ev['kind'] == 'tool':
            title, arg = _tool_view(ev['name'], ev['_input'])
            ev['_title'], ev['_arg'] = title, arg
            ev['_res'] = _one_line_result(ev['name'], ev.pop('_result', ''), ev['_input'])
    meta = path.with_suffix('.meta.json')
    label = json.loads(meta.read_text()).get('description', '') if meta.exists() else ''
    return {'source': 'claude-code', 'label': label, 'prompt': prompt, 'events': events,
            't0': t_first, 't1': max([e.get('t_end', e['t']) for e in events] + [t_first or 0])}


def load_fanout(path: Path, tools: set[str]) -> dict:
    s = load_claude(path, tools)
    titles = [{'t': e['t'], '_title': e['_title']} for e in s['events'] if e['kind'] == 'tool']
    return {'label': s['label'] or path.stem, 't0': s['t0'], 't1': s['t1'], 'steps': titles}


# ------------------------------------------------------------------ T3 Code (Orchestrator V2)
T3_TOOL = {'command_execution': 'Bash', 'file_change': 'Edit', 'web_search': 'WebSearch', 'subagent': 'Agent'}


def load_t3(db: Path, thread: str, tools: set[str]) -> dict:
    con = sqlite3.connect(f'file:{db}?mode=ro', uri=True)
    rows = con.execute('select type, status, payload_json from orchestration_v2_projection_turn_items '
                       'where thread_id = ? order by ordinal', (thread,)).fetchall()
    title = (con.execute('select title from orchestration_v2_projection_threads where thread_id = ?',
                         (thread,)).fetchone() or [''])[0]
    events, prompt = [], ''
    for ty, status, pj in rows:
        p = json.loads(pj)
        t = ts(p.get('startedAt') or p['updatedAt'])
        t_end = ts(p['completedAt']) if p.get('completedAt') else None
        st = 'error' if status in ('failed', 'cancelled', 'interrupted') else 'ok'
        if ty == 'user_message':
            prompt = prompt or p.get('text', '')
        elif ty == 'assistant_message' and (p.get('text') or '').strip():
            events.append({'t': t, 'kind': 'text', '_text': p['text']})
        elif ty == 'reasoning':
            events.append({'t': t, 'kind': 'thinking', 'ms': int(((t_end or t) - t) * 1000)})
        elif ty in ('command_execution', 'dynamic_tool', 'file_change', 'subagent'):
            name = p.get('toolName') if ty == 'dynamic_tool' else T3_TOOL[ty]
            if name not in tools:
                continue
            if ty == 'command_execution':
                title, arg, res = p.get('title') or (p.get('input') or '')[:60], p.get('input') or '', 'done'
            elif ty == 'file_change':
                title, arg, res = f'Edit {os.path.basename(p.get("fileName") or "")}', p.get('fileName') or '', 'edited'
            elif ty == 'subagent':
                title, arg, res = p.get('title') or 'subagent', p.get('driver') or '', (p.get('result') or 'done')
            else:
                inp = p.get('input') if isinstance(p.get('input'), dict) else {}
                title, arg = _tool_view(name, inp)
                out = p.get('output') if isinstance(p.get('output'), str) else ''
                res = _one_line_result(name, out, inp)
            ev = {'t': t, 'kind': 'tool', 'name': name, '_title': title, '_arg': arg, '_res': res, 'status': st}
            if t_end:
                ev['t_end'] = t_end
            events.append(ev)
    t0 = min([e['t'] for e in events], default=0)
    return {'source': 't3code', 'label': title, 'prompt': prompt, 'events': events,
            't0': t0, 't1': max([e.get('t_end', e['t']) for e in events] + [t0])}


# ------------------------------------------------------------------ time map
def time_map(knots: list[float], duration: float, mode: str, min_gap: float, cap: float):
    """Monotone map real epoch seconds → video seconds over the sorted knots (0 … duration)."""
    ks = sorted(set(knots))
    gaps = []
    for a, b in zip(ks, ks[1:]):
        g = min(b - a, cap)
        gaps.append(max(min_gap, math.sqrt(g) if mode == 'sqrt' else g))
    total = sum(gaps) or 1.0
    vs = [0.0]
    for g in gaps:
        vs.append(vs[-1] + g * duration / total)

    def f(x: float) -> float:
        if x <= ks[0]:
            return 0.0
        for i in range(len(ks) - 1):
            if x <= ks[i + 1]:
                u = (x - ks[i]) / max(1e-9, ks[i + 1] - ks[i])
                return round(vs[i] + u * (vs[i + 1] - vs[i]), 3)
        return round(vs[-1], 3)
    return f


# ------------------------------------------------------------------ build
def build(main: dict, fan: list[dict], sc: Scrubber, a) -> dict:
    events = main['events']
    # thin out: keep every tool and text, merge runs of thinking into one, cap the count
    thin, last_think = [], None
    for e in events:
        if e['kind'] == 'thinking':
            if last_think is not None:
                last_think['ms'] += e['ms']
                continue
            last_think = e
        else:
            last_think = None
        thin.append(e)
    thin = [e for e in thin if e['kind'] != 'thinking' or e['ms'] >= a.min_think_ms]
    if len(thin) > a.max_events:
        keep = set(range(len(thin) - 2, len(thin)))  # always keep the ending
        tools_i = [i for i, e in enumerate(thin) if e['kind'] != 'thinking']
        step = max(1, math.ceil(len(tools_i) / (a.max_events - 2)))
        keep |= set(tools_i[::step])
        thin = [e for i, e in enumerate(thin) if i in keep]

    knots = [main['t0']] + [e['t'] for e in thin] + [e['t_end'] for e in thin if e.get('t_end')]
    for f in fan:
        knots += [f['t0'], f['t1']] + [s['t'] for s in f['steps']]
    if a.clip_to_main:
        knots = [k for k in knots if k <= main['t1']]
    tm = time_map(knots, a.duration, a.compress, a.min_gap, a.cap)

    out_events, dropped = [], 0
    for e in thin:
        v = {'t': tm(e['t']), 'kind': e['kind']}
        if e['kind'] == 'thinking':
            v['secs'] = round(e['ms'] / 1000, 1)
        elif e['kind'] == 'text':
            raw = e['_text'].strip().split('\n')[0]
            v['text'] = sc.clean(raw, a.text_width)
            if sc.denied(v['text']):
                dropped += 1
                continue
        else:
            v['name'] = e['name']
            v['title'] = sc.clean(e['_title'], 60)
            if not v['title'] or sc.denied(v['title']):
                dropped += 1
                continue
            v['arg'] = sc.clean(e['_arg'], a.width)
            v['result'] = sc.clean(e['_res'], a.width)
            for k in ('arg', 'result'):
                if sc.denied(v[k]):
                    v[k] = '…'
            v['status'] = e.get('status', 'ok')
            if e.get('t_end'):
                v['t_end'] = tm(e['t_end'])
        out_events.append(v)

    lanes = []
    for f in fan:
        label = sc.clean(f['label'], 40)
        if sc.denied(label):
            continue
        steps = []
        for s in f['steps']:
            title = sc.clean(s['_title'], 48)
            if title and not sc.denied(title):
                steps.append({'t': tm(s['t']), 'title': title})
        lanes.append({'label': label, 't0': tm(f['t0']), 't1': tm(f['t1']), 'steps': steps,
                      'main': f.get('main', False)})
    prompt = a.prompt if a.prompt is not None else sc.clean(main['prompt'], 140)
    if sc.denied(prompt):
        prompt = ''
    return {
        'version': 1,
        'source': main['source'],
        'label': sc.clean(main['label'], 60),
        'prompt': prompt,
        'prompt_source': 'override' if a.prompt is not None else 'transcript',
        'duration': a.duration,
        'real_seconds': round(main['t1'] - main['t0'], 1),
        'time_map': a.compress,
        'events': out_events,
        'lanes': sorted(lanes, key=lambda l: l['t0']),
        'dropped': dropped,
    }


def audit(doc: dict, sc: Scrubber) -> list[str]:
    s = json.dumps(doc, ensure_ascii=False)
    bad = [p.pattern for p in sc.deny if p.search(s)]
    if EMAIL.search(s):
        bad.append('email')
    if HOME.search(s):
        bad.append('home path')
    return bad


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('kind', choices=['claude', 't3'])
    ap.add_argument('source', type=Path)
    ap.add_argument('--thread', help='T3 thread id')
    ap.add_argument('--fanout', nargs='*', type=Path, default=[], help='sibling subagent jsonl files (fan-out lanes)')
    ap.add_argument('-o', '--out', type=Path, required=True)
    ap.add_argument('--ts', type=Path, help='also write a TypeScript module exporting the session (for scenes/)')
    ap.add_argument('--deny-file', type=Path, action='append', default=[])
    ap.add_argument('--rewrite', action='append', default=[], metavar='OLD=NEW')
    ap.add_argument('--tools', default=','.join(DEFAULT_TOOLS))
    ap.add_argument('--duration', type=float, default=12.0)
    ap.add_argument('--compress', choices=['sqrt', 'linear'], default='sqrt')
    ap.add_argument('--min-gap', type=float, default=1.0, help='floor of a compressed gap (before scaling)')
    ap.add_argument('--cap', type=float, default=600.0, help='real gaps longer than this (s) count as this')
    ap.add_argument('--max-events', type=int, default=40)
    ap.add_argument('--min-think-ms', type=int, default=4000, help='shorter thinking is not shown')
    ap.add_argument('--width', type=int, default=90)
    ap.add_argument('--text-width', type=int, default=140)
    ap.add_argument('--prompt', help='show this prompt instead of the transcript\'s first message')
    ap.add_argument('--clip-to-main', action='store_true', help='fan-out lanes are cut at the main session\'s end')
    a = ap.parse_args(argv)

    deny = []
    for f in a.deny_file:
        deny += [l.strip() for l in f.read_text().splitlines() if l.strip() and not l.startswith('#')]
    rewrites = [tuple(r.split('=', 1)) for r in a.rewrite]
    sc = Scrubber(deny, rewrites)
    tools = set(a.tools.split(','))

    if a.kind == 'claude':
        main_s = load_claude(a.source, tools)
    else:
        if not a.thread:
            ap.error('t3 needs --thread')
        main_s = load_t3(a.source, a.thread, tools)
    fan = []
    for p in a.fanout:
        f = load_fanout(p, tools)
        f['main'] = p.resolve() == a.source.resolve()
        fan.append(f)
    doc = build(main_s, fan, sc, a)
    bad = audit(doc, sc)
    if bad:
        print(f'refused: the scrubbed session still matches {bad}; nothing written', file=sys.stderr)
        return 3
    body = json.dumps(doc, ensure_ascii=False, indent=1)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    tmp = a.out.with_suffix('.tmp')
    tmp.write_text(body + '\n')
    tmp.replace(a.out)
    if a.ts:
        a.ts.write_text('// Generated by tools/session_import.py (scrubbed). Do not edit by hand.\n'
                        f'import type {{ Session }} from \'./agent_replay_kit\';\n'
                        f'const session: Session = {body};\nexport default session;\n')
    n_tool = sum(e['kind'] == 'tool' for e in doc['events'])
    print(f'{a.out}: {len(doc["events"])} events ({n_tool} tool calls), {len(doc["lanes"])} lanes, '
          f'{doc["real_seconds"]:.0f} s real → {doc["duration"]} s, dropped {doc["dropped"]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
