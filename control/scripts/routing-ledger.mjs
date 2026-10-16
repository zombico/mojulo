#!/usr/bin/env node
// How real sessions found their way, from the server's own tool-call ledger (`mcp_tool_calls`). Per session: calls
// before the first successful make, orientation reads before it, errors, errors that point at another tool (the
// wrong door, said in-band), calls to folded or retired names, and a make tool called again where a revise was
// likely. Aggregates only: no input or result values are printed. Read-only.
//
//   node scripts/routing-ledger.mjs [--db <path>] [--since 2026-10-15] [--gap-min 30] [--json]
//
// --db defaults to the bins' database ($MOJULO_DATA_DIR or ~/.mojulo/data, mojulo-lite.db). --since splits the
// sessions into before and after a date (a branch landing). A call without a session id joins the session of the
// call before it when it came within --gap-min minutes.
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';
import { TOOL_LINES } from '../lib/mcp/tool-lines.js';
import { RETIRED_TOOLS } from '../lib/mcp/packs.js';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const DB = opt('db', path.join(process.env.MOJULO_DATA_DIR || path.join(os.homedir(), '.mojulo', 'data'), 'mojulo-lite.db'));
const SINCE = opt('since', null);
const GAP_MS = Number(opt('gap-min', 30)) * 60_000;

const verbOf = (tool) => TOOL_LINES[tool]?.verb ?? null;
// a make is a door: a create / compose tool, or a folded name that was one
const FOLDED_MAKES = new Set(['create_shoot_plan']);
const isMake = (tool) => ['create', 'compose'].includes(verbOf(tool)) || FOLDED_MAKES.has(tool);
const isOrient = (tool) => verbOf(tool) === 'orient';
const LISTED = Object.keys(TOOL_LINES);
const RETIRED = new Set(RETIRED_TOOLS);
// an error that names another listed tool in backticks or as `→ name`: the server pointing at the right door
const pointsElsewhere = (c) => c.status !== 'ok' && c.error_message
  && LISTED.some((t) => t !== c.tool && new RegExp(`(\`${t}\`|→ ?${t}\\b|\\b${t}\\()`).test(c.error_message));

const db = new Database(DB, { readonly: true, fileMustExist: true });
const calls = db.prepare('SELECT tool, session_id, started_at, status, error_message FROM mcp_tool_calls ORDER BY started_at').all();

// sessions: by id, else by nearness to the call before
const sessions = [];
const byId = new Map();
let last = null;
for (const c of calls) {
  let s = c.session_id ? byId.get(c.session_id) : null;
  if (!s && !c.session_id && last && c.started_at - last.end <= GAP_MS && !last.id) s = last;
  if (!s) {
    s = { id: c.session_id || null, start: c.started_at, end: c.started_at, calls: [] };
    sessions.push(s);
    if (c.session_id) byId.set(c.session_id, s);
  }
  s.calls.push(c);
  s.end = c.started_at;
  last = s;
}

function measure(s) {
  const firstMake = s.calls.findIndex((c) => isMake(c.tool) && c.status === 'ok');
  const before = firstMake < 0 ? s.calls : s.calls.slice(0, firstMake);
  const makes = s.calls.filter((c) => isMake(c.tool) && c.status === 'ok').map((c) => c.tool);
  const repeats = makes.filter((t, i) => makes.indexOf(t) !== i).length;
  return {
    start: new Date(s.start).toISOString().slice(0, 16),
    calls: s.calls.length,
    made: firstMake >= 0,
    callsBeforeFirstMake: firstMake >= 0 ? firstMake : null,
    orientBeforeFirstMake: before.filter((c) => isOrient(c.tool)).length,
    errors: s.calls.filter((c) => c.status !== 'ok').length,
    wrongDoorErrors: s.calls.filter(pointsElsewhere).length,
    retiredCalls: s.calls.filter((c) => RETIRED.has(c.tool)).length,
    repeatMakes: repeats,
  };
}

const median = (xs) => {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null;
};
function aggregate(ms) {
  const sum = (k) => ms.reduce((n, m) => n + m[k], 0);
  const calls = sum('calls');
  return {
    sessions: ms.length, calls,
    sessionsThatMade: ms.filter((m) => m.made).length,
    medianCallsBeforeFirstMake: median(ms.map((m) => m.callsBeforeFirstMake)),
    medianOrientBeforeFirstMake: median(ms.filter((m) => m.made).map((m) => m.orientBeforeFirstMake)),
    errorRate: calls ? +(sum('errors') / calls).toFixed(3) : null,
    wrongDoorErrors: sum('wrongDoorErrors'), retiredCalls: sum('retiredCalls'), repeatMakes: sum('repeatMakes'),
  };
}

const measured = sessions.map((s) => ({ s, m: measure(s) }));
const cut = SINCE ? Date.parse(SINCE) : null;
const out = {
  db: DB, calls: calls.length,
  ...(cut
    ? { before: aggregate(measured.filter((x) => x.s.start < cut).map((x) => x.m)), after: aggregate(measured.filter((x) => x.s.start >= cut).map((x) => x.m)) }
    : { all: aggregate(measured.map((x) => x.m)) }),
  sessions: measured.map((x) => x.m),
};
if (args.includes('--json')) console.log(JSON.stringify(out, null, 2));
else {
  for (const m of out.sessions) console.log(`${m.start}  ${String(m.calls).padStart(4)} calls  first make after ${m.callsBeforeFirstMake ?? '—'} (${m.orientBeforeFirstMake} reads)  errors ${m.errors} (wrong door ${m.wrongDoorErrors})  retired ${m.retiredCalls}  repeat makes ${m.repeatMakes}`);
  const { sessions: _, ...head } = out;
  console.log('\n' + JSON.stringify(head, null, 2));
}
