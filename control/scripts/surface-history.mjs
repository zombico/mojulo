#!/usr/bin/env node
// How the tool surface grew, commit by commit along the first-parent line: the listed tools (tool-lines.js keys),
// tools added and removed, routing and vocab cards added, the flat tools/list pin and the studio body ceiling and
// whether each moved, and merges that resolved a shared drawer by hand. Reads git only (no build, no server), so it
// runs over any range. Whether a feature lands as a door or as an argument on one shows here first.
//
//   node scripts/surface-history.mjs [--since 2026-10-10] [--rev HEAD] [--json]
//
// tool-lines.js exists from 2026-10-10 on; a commit before it reads as null tools.
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const SINCE = opt('since', '2026-10-10');
const REV = opt('rev', 'HEAD');
const JSON_OUT = args.includes('--json');

// paths below are from the repository root, wherever this runs from
const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
const show = (sha, path) => {
  try { return git('show', `${sha}:${path}`); } catch { return null; }
};

// Files every feature appends to: a merge that had to edit one of them by hand is a collision on a shared drawer.
const SHARED = [
  'control/lib/graph/gameworld/gameworld-cards.js',
  'control/lib/mcp/tools/context.js',
  'control/lib/mcp/tool-lines.js',
  'control/lib/mcp/packs.js',
  'control/lib/mcp/tools/tool-descriptions.test.js',
  'control/lib/mcp/routing-cards/routing-eval.fixture.js',
];

const toolsAt = (sha) => {
  const src = show(sha, 'control/lib/mcp/tool-lines.js');
  if (!src) return null;
  const body = src.slice(src.indexOf('export const TOOL_LINES'));
  return new Set([...body.matchAll(/^ {2}([a-z][a-z0-9_]*): L\(/gm)].map((m) => m[1]));
};
const num = (src, re) => {
  const m = src && src.match(re);
  return m ? Number(m[1].replace(/_/g, '')) : null;
};
const cardsAt = (sha) => {
  const files = git('ls-tree', '-r', '--name-only', sha, 'control/lib').split('\n');
  return {
    routing: new Set(files.filter((f) => /\/mcp\/routing-cards\/[^/]+\.md$/.test(f))),
    vocab: new Set(files.filter((f) => /\/[a-z-]+-vocab\/[^/]+\.md$/.test(f))),
  };
};
// a merge whose result differs from every parent in a file: someone resolved it there
const handResolved = (sha) => git('diff-tree', '--cc', '--name-only', '--no-commit-id', sha, '--', ...SHARED)
  .split('\n').filter((f) => f && SHARED.includes(f));

const log = git('log', '--first-parent', `--since=${SINCE}`, '--reverse', '--format=%H%x09%P%x09%ad%x09%s', '--date=short', REV)
  .trim().split('\n').filter(Boolean)
  .map((l) => { const [sha, parents, date, subject] = l.split('\t'); return { sha, merge: parents.split(' ').length > 1, date, subject }; });

const rows = [];
let prev = null;
for (const c of log) {
  const tools = toolsAt(c.sha);
  const cards = cardsAt(c.sha);
  const desc = show(c.sha, 'control/lib/mcp/tools/tool-descriptions.test.js');
  const ctx = show(c.sha, 'control/lib/mcp/tools/context.test.js');
  const row = {
    sha: c.sha.slice(0, 8), date: c.date, merge: c.merge, subject: c.subject.slice(0, 90),
    tools: tools ? tools.size : null,
    added: prev?.tools && tools ? [...tools].filter((t) => !prev.tools.has(t)) : [],
    removed: prev?.tools && tools ? [...prev.tools].filter((t) => !tools.has(t)) : [],
    routingCards: prev ? [...cards.routing].filter((f) => !prev.cards.routing.has(f)).length : 0,
    vocabCards: prev ? [...cards.vocab].filter((f) => !prev.cards.vocab.has(f)).length : 0,
    payloadPin: num(desc, /const PAYLOAD_CEILING = ([\d_]+)/),
    bodyCeiling: num(ctx, /MODE_CEILINGS = \{ studio: ([\d_]+)/),
    handResolved: c.merge ? handResolved(c.sha) : [],
  };
  row.payloadMoved = prev && row.payloadPin !== prev.row.payloadPin ? row.payloadPin - prev.row.payloadPin : 0;
  row.bodyMoved = prev && row.bodyCeiling !== prev.row.bodyCeiling ? row.bodyCeiling - prev.row.bodyCeiling : 0;
  rows.push(row);
  prev = { tools, cards, row };
}

const sum = (f) => rows.reduce((n, r) => n + f(r), 0);
const total = {
  since: SINCE, commits: rows.length,
  tools: { first: rows.find((r) => r.tools != null)?.tools ?? null, last: rows.at(-1)?.tools ?? null },
  toolsAdded: sum((r) => r.added.length), toolsRemoved: sum((r) => r.removed.length),
  routingCardsAdded: sum((r) => r.routingCards), vocabCardsAdded: sum((r) => r.vocabCards),
  payloadPin: { first: rows[0]?.payloadPin, last: rows.at(-1)?.payloadPin, raised: rows.filter((r) => r.payloadMoved > 0).length, lowered: rows.filter((r) => r.payloadMoved < 0).length },
  bodyCeiling: { first: rows[0]?.bodyCeiling, last: rows.at(-1)?.bodyCeiling, raised: rows.filter((r) => r.bodyMoved > 0).length },
  mergesResolvingASharedFile: rows.filter((r) => r.handResolved.length).length,
};

if (JSON_OUT) {
  console.log(JSON.stringify({ total, rows }, null, 2));
} else {
  const moved = rows.filter((r) => r.added.length || r.removed.length || r.payloadMoved || r.bodyMoved || r.handResolved.length || r.routingCards);
  for (const r of moved) {
    const bits = [
      r.added.length ? `+${r.added.join(' +')}` : '', r.removed.length ? `-${r.removed.join(' -')}` : '',
      r.routingCards ? `${r.routingCards} routing card(s)` : '', r.vocabCards ? `${r.vocabCards} vocab card(s)` : '',
      r.payloadMoved ? `pin ${r.payloadMoved > 0 ? '+' : ''}${r.payloadMoved}` : '', r.bodyMoved ? `body ${r.bodyMoved > 0 ? '+' : ''}${r.bodyMoved}` : '',
      r.handResolved.length ? `resolved by hand: ${r.handResolved.map((f) => f.split('/').pop()).join(', ')}` : '',
    ].filter(Boolean);
    console.log(`${r.date} ${r.sha} [${r.tools ?? '-'}] ${r.subject}\n    ${bits.join(' · ')}`);
  }
  console.log('\n' + JSON.stringify(total, null, 2));
}
