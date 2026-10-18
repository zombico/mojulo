#!/usr/bin/env node
/**
 * The cosmos sweep from a shell: which kinds of game the builder can make today, and which facet is the bottleneck
 * (lib/graph/cosmos/sweep.js). It builds nothing and reads no database.
 *
 *   node scripts/cosmos-sweep.mjs [--n 500] [--seed 1] [--density 0.2] [--roll fair|flat] [--around <id>|probes]
 *                                 [--top 15] [--fixture <id>] [--json]
 *
 *   --roll     fair (the default) gives every facet the same odds of settings; flat sets each setting at `density`
 *   --around   nudge a fixture (or every probe) one or two settings at a time instead of rolling blind
 *   --fixture  dry-run one fixture and print its report (every row, what it lowers to, the notes); no dice
 *   --json     print the whole report as JSON instead of the summary
 */
import { fileURLToPath } from 'node:url';
import { sweep } from '../lib/graph/cosmos/sweep.js';
import { fixture } from '../lib/graph/cosmos/fixtures.js';
import { dryRun } from '../lib/graph/cosmos/cosmos.js';
import { ENGINES, MARKED_ENGINES } from '../lib/graph/scene/engines/registry.js';

export function parseArgs(argv) {
  const opts = { n: 500, seed: 1, density: 0.2, roll: 'fair', around: null, top: 15, fixture: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--fixture') opts.fixture = argv[++i];
    else if (a === '--around') opts.around = argv[++i];
    else if (a === '--roll') opts.roll = argv[++i];
    else if (['--n', '--seed', '--density', '--top'].includes(a)) {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v)) throw new Error(`${a} takes a number`);
      opts[a.slice(2)] = v;
    } else throw new Error(`unknown argument '${a}' (known: --n, --seed, --density, --roll, --around, --top, --fixture, --json)`);
  }
  return opts;
}

const pad = (s, w) => String(s).padEnd(w);
const pct = (k, n) => `${Math.round((100 * k) / n)}%`;

export function formatSweep(r, { top = 15 } = {}) {
  const out = [];
  const draw = r.around ? `around ${r.around}` : `density ${r.density} · ${r.roll} roll`;
  out.push(`cosmos sweep · n ${r.n} · seed ${r.seed} · ${draw}`, '');
  out.push('fixtures');
  for (const f of r.fixtures) {
    const why = [...f.blocked.map((k) => `✗ ${k}`), ...f.gaps.map((k) => `~ ${k}`)].join('  ');
    const lost = MARKED_ENGINES.map((e) => (f.engines[e] ? ' '.repeat(e.length + 1) : `${e}✗`)).join(' ');
    out.push(`  ${f.anchor ? '◆' : ' '} ${pad(f.id, 20)} ${pad(f.verdict, 9)} ${lost}  ${why}`);
  }
  const { makeable, gaps, blocked } = r.verdicts;
  out.push('', `rolled  makeable ${makeable} (${pct(makeable, r.n)}) · gaps ${gaps} (${pct(gaps, r.n)}) · blocked ${blocked} (${pct(blocked, r.n)}) · ${MARKED_ENGINES.map((e) => `survive ${ENGINES[e].name} ${r.engines[e].ok} (${pct(r.engines[e].ok, r.n)})`).join(' · ')}`);
  out.push('', 'unlock by facet: built whole, how many rolled cubes step up (and how many become makeable)');
  for (const f of r.unlock.facets) out.push(`  ${pad(f.facet, 9)} lifts ${pad(f.lifts, 5)} makeable ${pad(f.makeable, 5)} touches ${f.touches}`);
  out.push('', 'build order: work packages by lifts per unit of work, with what each needs built first (S 1 · M 3 · L 8; unsized last)');
  for (const p of r.unlock.packages.slice(0, top)) {
    const needs = p.needs.length ? `  + ${p.needs.join(', ')}` : '';
    out.push(`  ${pad(p.name, 56)} ${pad(p.effort || '?', 2)} cost ${pad(p.cost ?? '?', 3)} per-effort ${pad(p.perEffort ?? '—', 6)} lifts ${pad(p.lifts, 5)} makeable ${pad(p.makeable, 5)}${needs}`);
  }
  for (const e of MARKED_ENGINES) {
    const g = r.engines[e].unlock;
    for (const [facet, ladder] of Object.entries(g.ladders)) {
      out.push('', `${e} ladder, ${facet}: its settings made to travel one at a time, largest gain first (cubes surviving the export, of ${r.n})`);
      out.push(`  ${pad('now', 36)} ${r.engines[e].ok}`);
      for (const l of ladder) out.push(`  ${pad(`+ ${l.setting}`, 36)} ${pad(l.survives, 5)} +${l.gain}`);
    }
    out.push('', `${e} by value: cubes that would survive the export if this one value travelled`);
    for (const v of g.values.slice(0, top)) out.push(`  ${pad(v.key, 36)} survives ${pad(v.survives, 5)} touches ${v.touches}`);
  }
  out.push('', `unlock by value: the top ${top}`);
  for (const v of r.unlock.values.slice(0, top)) out.push(`  ${pad(v.key, 36)} ${pad(v.status, 8)} lifts ${pad(v.lifts, 5)} makeable ${pad(v.makeable, 5)} touches ${v.touches}`);
  return out.join('\n') + '\n';
}

export function formatFixture(f, r) {
  const out = [`${f.id}: ${f.name}${f.anchor ? ' (anchor)' : ''}`, `  ${f.why}`, `  verdict ${r.verdict}${MARKED_ENGINES.map((e) => (r.engines[e].ok ? '' : ` · lost on ${ENGINES[e].name} export: ${r.engines[e].lost.map((x) => `${x.facet}.${x.setting}=${x.value}`).join(', ')}`)).join('')}`, ''];
  for (const [id, facet] of Object.entries(r.facets)) {
    if (!facet.rows.length) continue;
    out.push(`  ${id} (depth ${facet.depth})`);
    for (const row of facet.rows) out.push(`    ${pad(`${row.setting}=${row.value}`, 30)} ${pad(row.status, 8)} ${row.lowers || ''}${row.note ? `  · ${row.note}` : ''}`);
  }
  return out.join('\n') + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.fixture) {
    const f = fixture(opts.fixture), r = dryRun(f.cube);
    process.stdout.write(opts.json ? JSON.stringify({ fixture: f, report: r }, null, 2) + '\n' : formatFixture(f, r));
  } else {
    const r = sweep(opts);
    process.stdout.write(opts.json ? JSON.stringify(r, null, 2) + '\n' : formatSweep(r, opts));
  }
}
