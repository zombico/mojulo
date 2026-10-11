#!/usr/bin/env node
/**
 * The tool-surface page: the listed MCP tools by ring × verb, the packs and Workflows rails, and the cosmos cube board,
 * as one self-contained HTML file (docs/tool-surface/index.html). Every number is read from the tree: TOOL_LINES and
 * packs.js for the tools, the cosmos registry and sweep for the board. The only hand-kept input is
 * docs/tool-surface/board-notes.json (facet owners, stages, next steps, the work log).
 *
 *   node scripts/tool-surface.mjs [--out <path>] [--n 500] [--seed 1] [--density 0.2] [--check]
 *
 *   --check  exit 1 when the written page would differ from the one on disk (stale), and write nothing
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOL_LINES, RING_TITLES, VERBS } from '../lib/mcp/tool-lines.js';
import { PACKS, SPINE, FOLDED, RETIRED_PACKS } from '../lib/mcp/packs.js';
import { FACETS, STATUSES } from '../lib/graph/cosmos/facets/index.js';
import { capabilityRegistry } from '../lib/graph/cosmos/registry.js';
import { FIXTURES } from '../lib/graph/cosmos/fixtures.js';
import { sweep } from '../lib/graph/cosmos/sweep.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = resolve(HERE, '../../docs/tool-surface');

export function parseArgs(argv) {
  const opts = { out: join(DOCS, 'index.html'), n: 500, seed: 1, density: 0.2, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') opts.check = true;
    else if (a === '--out') opts.out = resolve(argv[++i]);
    else if (['--n', '--seed', '--density'].includes(a)) {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v)) throw new Error(`${a} takes a number`);
      opts[a.slice(2)] = v;
    } else throw new Error(`unknown argument '${a}' (known: --out, --n, --seed, --density, --check)`);
  }
  return opts;
}

export function toolSurface() {
  const home = {};
  for (const p of PACKS) for (const m of p.members) home[m] = p;
  const tools = Object.entries(TOOL_LINES).map(([name, l]) => ({
    name,
    verb: l.verb,
    line: l.line,
    pack: home[name]?.id || (SPINE.includes(name) || FOLDED.includes(name) ? 'spine' : null),
    ring: home[name]?.ring || 'orientation',
  }));
  const packs = PACKS.map((p) => ({ id: p.id, ring: p.ring, title: p.title, members: p.members, shared: p.shared || [], body: p.body || null }));
  const retired = RETIRED_PACKS.map((p) => ({ id: p.id, title: p.title, members: p.members }));
  return { VERBS, RING_TITLES, tools, packs, retired, spine: SPINE };
}

export function cosmosBoard({ n, seed, density }, notes = {}) {
  const reg = capabilityRegistry();
  const r = sweep({ n, seed, density });
  const unlock = Object.fromEntries(r.unlock.facets.map((f) => [f.facet, f]));
  const facets = FACETS.map((f) => {
    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const { values } of Object.values(reg[f.id])) for (const v of Object.values(values)) counts[v.status]++;
    const u = unlock[f.id] || {};
    const note = notes.facets?.[f.id] || {};
    return {
      id: f.id, name: note.name || f.id[0].toUpperCase() + f.id.slice(1), asks: f.asks, settings: Object.keys(reg[f.id]).length,
      counts, lifts: u.lifts ?? 0, makeable: u.makeable ?? 0, touches: u.touches ?? 0,
      owner: note.owner || '', stage: note.stage || '', next: note.next || '',
    };
  });
  const statusOf = (k) => {
    const m = /^([^.=]+)\.([^.=]+)=(.+)$/.exec(k);
    return (m && reg[m[1]]?.[m[2]]?.values[m[3]]?.status) || 'absent';
  };
  const cubes = Object.fromEntries(FIXTURES.map((f) => [f.id, f]));
  const fixtures = r.fixtures.map((f) => ({
    id: f.id, name: f.name, anchor: !!f.anchor, why: cubes[f.id]?.why || '', verdict: f.verdict, godot: !!f.godot,
    touched: Object.keys(cubes[f.id]?.cube || {}),
    issues: [...f.blocked, ...f.gaps].map((k) => [k, statusOf(k)]),
  }));
  return {
    seed: r.seed, n: r.n, density: r.density, roll: r.roll, verdicts: r.verdicts, godotOk: r.godotOk,
    facets, fixtures, packages: r.unlock.packages, values: r.unlock.values.slice(0, 15),
    now: notes.now || '', next: notes.next || '', board: notes.board || '', log: notes.log || [],
  };
}

function gitHead() {
  try {
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: HERE, encoding: 'utf8' }).trim();
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: HERE, encoding: 'utf8' }).trim();
    return { sha, branch };
  } catch {
    return { sha: '', branch: '' };
  }
}

export function buildPage(opts) {
  const template = readFileSync(join(DOCS, 'template.html'), 'utf8');
  const notesPath = join(DOCS, 'board-notes.json');
  const notes = existsSync(notesPath) ? JSON.parse(readFileSync(notesPath, 'utf8')) : {};
  // The page names the commit it was built from; the date is that commit's, so a rebuild of the same tree is
  // byte-identical and --check means something.
  const head = gitHead();
  let date = '';
  try { date = execFileSync('git', ['log', '-1', '--format=%cs'], { cwd: HERE, encoding: 'utf8' }).trim(); } catch {}
  const data = { ...toolSurface(), cosmos: cosmosBoard(opts, notes), head: { ...head, date } };
  // `</` would end the inline script early.
  const json = JSON.stringify(data).replace(/<\//g, '<\\/');
  return template.replace('/*DATA*/', () => json);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  const page = buildPage(opts);
  const current = existsSync(opts.out) ? readFileSync(opts.out, 'utf8') : '';
  if (opts.check) {
    if (page !== current) {
      process.stderr.write(`${opts.out} is stale: run node scripts/tool-surface.mjs\n`);
      process.exit(1);
    }
    process.stdout.write(`${opts.out} is current\n`);
  } else {
    writeFileSync(opts.out, page);
    process.stdout.write(`wrote ${opts.out} (${page.length} bytes)\n`);
  }
}
