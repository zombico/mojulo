#!/usr/bin/env node
/**
 * The tool-surface page: the listed MCP tools by ring × verb, the packs and Workflows rails, and the cosmos cube board,
 * as one self-contained HTML file (docs/tool-surface/index.html), and the hill-climb page agents read
 * (docs/tool-surface/hillclimb.md: what to build next, and what to build together). Every number is read from the tree: TOOL_LINES and
 * packs.js for the tools, the cosmos registry and sweep for the board. The only hand-kept input is
 * docs/tool-surface/board-notes.json (facet owners, stages, next steps, the work log).
 *
 *   node scripts/tool-surface.mjs [--out <path>] [--n 500] [--seed 1] [--density 0.2] [--check]
 *
 *   --check  exit 1 when either written page would differ from the one on disk (stale), and write nothing
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOL_LINES, RING_TITLES, VERBS } from '../lib/mcp/tool-lines.js';
import { PACKS, SPINE, FOLDED, RETIRED_PACKS } from '../lib/mcp/packs.js';
import { register } from 'node:module';
// (the cosmos registry reads its tables live, and they import by '@/': plain Node takes the repo's resolver first)
if (!process.env.VITEST) register('./mcp-stdio-loader.mjs', import.meta.url);
const { FACETS, STATUSES } = await import('../lib/graph/cosmos/facets/index.js');
const { capabilityRegistry } = await import('../lib/graph/cosmos/registry.js');
const { FIXTURES } = await import('../lib/graph/cosmos/fixtures.js');
const { sweep } = await import('../lib/graph/cosmos/sweep.js');
const { dryRun } = await import('../lib/graph/cosmos/cosmos.js');
const { composeCandidates } = await import('../lib/graph/cosmos/compose.js');
import { ENGINES, MARKED_ENGINES } from '../lib/graph/scene/engines/registry.js';

// what proves an engine's marks, said under its scoreboard
const SCOREBOARD_PROOF = {
  godot: 'The fixture matrix (`npm run test:godot`)\nplays them in both engines.',
  roblox: 'A built mark names its Lune conformance test;\nthe Roblox kernel is young, so its flow offers only what is marked.',
};

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = resolve(HERE, '../../docs/tool-surface');

export function parseArgs(argv) {
  const opts = { out: join(DOCS, 'index.html'), md: join(DOCS, 'hillclimb.md'), n: 500, seed: 1, density: 0.2, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') opts.check = true;
    else if (a === '--out') opts.out = resolve(argv[++i]);
    else if (a === '--md') opts.md = resolve(argv[++i]);
    else if (['--n', '--seed', '--density'].includes(a)) {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v)) throw new Error(`${a} takes a number`);
      opts[a.slice(2)] = v;
    } else throw new Error(`unknown argument '${a}' (known: --out, --md, --n, --seed, --density, --check)`);
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
    id: f.id, name: f.name, anchor: !!f.anchor, why: cubes[f.id]?.why || '', verdict: f.verdict, godot: !!f.engines.godot,
    touched: Object.keys(cubes[f.id]?.cube || {}),
    issues: [...f.blocked, ...f.gaps].map((k) => [k, statusOf(k)]),
  }));
  return {
    seed: r.seed, n: r.n, density: r.density, roll: r.roll, verdicts: r.verdicts, godotOk: r.engines.godot.ok,
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

/** Two builds of a page match when they differ only in the head stamp: the commit the page was built from, which
 * committing the page itself moves. */
export function samePage(a, b) {
  const unstamped = (t) => t.replace(/"head":\{[^}]*\}/, '"head":{}').replace(/^Built from \S+ on \S+ \([^)]*\)\./m, 'Built from');
  return unstamped(a) === unstamped(b);
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

/**
 * THE HILL-CLIMB PAGE: the same sweep as the board, written for an agent choosing the next build. Ranked three ways: one
 * package at a time (worlds lifted per unit of effort), the exact sets worlds wait on (recipes), and the pairs that make
 * worlds neither makes alone (a pair that keeps appearing is one concept: build it, or declare it, as one package).
 */
export function hillclimbMd(opts) {
  const { n, seed, density } = opts;
  const reg = capabilityRegistry(), r = sweep({ n, seed, density }), probes = sweep({ n, seed, density, around: 'probes' });
  const c = composeCandidates({ n, seed, density });
  const head = gitHead();
  let date = '';
  try { date = execFileSync('git', ['log', '-1', '--format=%cs'], { cwd: HERE, encoding: 'utf8' }).trim(); } catch {}
  const code = (x) => '`' + x + '`';
  const name = (id) => (c.names[id]?.name && c.names[id].name !== id ? c.names[id].name + ' (' + code(id) + ')' : code(id));
  const per = (w, cost) => (cost ? (Math.round((100 * w) / cost) / 100).toString() : '–');
  const L = [];
  L.push('# Hill-climb: what to build next, and what to build together', '');
  L.push(`<!-- generated by control/scripts/tool-surface.mjs: do not edit; npm run tool-surface -->`);
  L.push(`Built from ${head.sha || '?'} on ${head.branch || '?'} (${date || '?'}). Sweep: ${n} rolled worlds, seed ${seed}, density ${density}.`, '');
  L.push('Internal: for maintainers and their agents, not an MCP surface. A world is a cosmos cube (lib/graph/cosmos):');
  L.push('six facets of settings, each value built, local, partial or absent in the registry. A world is makeable when');
  L.push('every value it asks for is built. Effort: S = 1, M = 3, L = 8 (packages.js); "–" is unpriced: price it first.', '');
  L.push('## The loop', '');
  L.push('1. Pick from the three rankings below: a package that lifts many worlds per effort, a recipe many worlds wait on,');
  L.push('   or a pair with synergy (build the two as one concept).');
  L.push('2. Write its plan section and its changelog theme file (control/changelog/<MMYY>/<MMDD>/<theme>.md); build it opt-in (absent keys keep every byte).');
  L.push('3. Mark the registry (status, lowers, each engine\'s mark) in lib/graph/cosmos/facets; a pair worth keeping becomes a package.');
  L.push('4. `npm run tool-surface`, read this page again, and note the move (verdict totals, the genre probes).', '');
  L.push('## Where it stands', '');
  const plays = MARKED_ENGINES.map((e) => `plays in ${ENGINES[e].name}`), bars = MARKED_ENGINES.map(() => '---');
  L.push(`| sweep | makeable | gaps | blocked | ${plays.join(' | ')} |`, `|---|---|---|---|${bars.join('|')}|`);
  L.push(`| ${n} random worlds | ${r.verdicts.makeable} | ${r.verdicts.gaps} | ${r.verdicts.blocked} | ${MARKED_ENGINES.map((e) => r.engines[e].ok).join(' | ')} |`);
  L.push(`| ${n} worlds near the genre probes | ${probes.verdicts.makeable} | ${probes.verdicts.gaps} | ${probes.verdicts.blocked} | ${MARKED_ENGINES.map((e) => probes.engines[e].ok).join(' | ')} |`, '');
  L.push('## One at a time: packages by worlds lifted per effort', '');
  L.push('Lifted: a world steps up a verdict once the package (and what it needs) is built. Made: it becomes makeable.', '');
  L.push('| package | effort | cost with needs | lifted | made | per effort | needs |', '|---|---|---|---|---|---|---|');
  for (const p of r.unlock.packages.slice(0, 20)) L.push(`| ${name(p.id)} | ${p.effort || '–'} | ${p.cost ?? '–'} | ${p.lifts} | ${p.makeable} | ${p.perEffort ?? '–'} | ${p.needs.map(code).join(', ')} |`);
  L.push('', '## Together: the recipes worlds wait on', '');
  L.push('The exact packages between a world and makeable, counted. Build the whole recipe and those worlds are made.', '');
  L.push('| worlds | cost | worlds per effort | build |', '|---|---|---|---|');
  for (const x of c.recipes.slice(0, 20)) L.push(`| ${x.worlds} | ${x.cost ?? '–'} | ${per(x.worlds, x.cost)} | ${x.packages.map(name).join(' + ')} |`);
  L.push('', '## Together: pairs that make what neither makes alone', '');
  L.push('Synergy: worlds the pair makes that neither package makes by itself. High synergy means one concept split in two.', '');
  L.push('| synergy | worlds | cost | pair |', '|---|---|---|---|');
  for (const p of c.pairs.filter((x) => x.synergy).slice(0, 15)) L.push(`| ${p.synergy} | ${p.worlds} | ${p.cost ?? '–'} | ${name(p.a)} + ${name(p.b)} |`);
  L.push('', '## The genre probes', '');
  L.push(`| genre | verdict | ${plays.join(' | ')} | waits on |`, `|---|---|${bars.join('|')}|---|`);
  const cubes = Object.fromEntries(FIXTURES.map((x) => [x.id, x]));
  for (const x of r.fixtures) L.push(`| ${cubes[x.id]?.name || x.id}${x.anchor ? ' (anchor)' : ''} | ${x.verdict} | ${MARKED_ENGINES.map((e) => (x.engines[e] ? 'yes' : 'no')).join(' | ')} | ${[...x.blocked, ...x.gaps].map(code).join(', ') || '–'} |`);
  // THE ENGINE SCOREBOARDS: what each engine's export plays, read from its marks module through the registry. A value the
  // web builds and the export loses fails a world; one it carries simpler does not.
  for (const e of MARKED_ENGINES) {
    const E = ENGINES[e], u = r.engines[e].unlock;
    L.push('', `## ${E.name}: what an export plays`, '');
    L.push('Marks: built, approximated (it runs, simpler) or absent (nothing in the kernel runs it), from');
    L.push(`\`${E.marksPath}\` and the export's own tables (a mechanic's by lowering it). A world survives`);
    L.push(`the export when it asks for nothing the web builds and ${E.name} loses. ${SCOREBOARD_PROOF[e]}`, '');
    L.push(`| genre | lost on ${E.name} export | carried simpler |`, '|---|---|---|');
    for (const f of FIXTURES) {
      const g = dryRun(f.cube).engines[e], k = (x) => code(`${x.facet}.${x.setting}=${x.value}`);
      L.push(`| ${f.name}${f.anchor ? ' (anchor)' : ''} | ${g.lost.map(k).join(', ') || '–'} | ${g.approximated.length} |`);
    }
    L.push('', 'Each facet\'s settings made to travel one at a time, the largest gain first (worlds of ' + n + ' surviving):', '');
    L.push('| facet | now | ladder |', '|---|---|---|');
    for (const [facet, ladder] of Object.entries(u.ladders)) L.push(`| ${facet} | ${r.engines[e].ok} | ${ladder.filter((x) => x.gain).map((x) => `${code(x.setting)} +${x.gain}`).join(', ') || '–'} |`);
    L.push('', 'The values whose travelling alone would free the most worlds:', '');
    L.push('| value | worlds it alone would free | worlds that ask for it |', '|---|---|---|');
    for (const x of u.values.slice(0, 15)) L.push(`| ${code(x.key)} | ${x.survives} | ${x.touches} |`);
  }
  L.push('', '## The matrix', '');
  L.push('Every setting of every facet, its values by status. Statuses: ' + STATUSES.join(', ') + '.', '');
  for (const { id, asks } of FACETS) {
    L.push(`### ${id}: ${asks}`, '');
    for (const [setting, { values }] of Object.entries(reg[id])) {
      const by = Object.fromEntries(STATUSES.map((st) => [st, []]));
      for (const [v, row] of Object.entries(values)) by[row.status].push(v);
      const parts = STATUSES.filter((st) => by[st].length).map((st) => `${st}: ${by[st].join(', ')}`);
      L.push(`- **${setting}**: ${parts.join('; ')}`);
    }
    L.push('');
  }
  return L.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  const pages = [[opts.out, buildPage(opts)], [opts.md, hillclimbMd(opts)]];
  if (opts.check) {
    const stale = pages.filter(([path, page]) => !samePage(page, existsSync(path) ? readFileSync(path, 'utf8') : ''));
    for (const [path] of stale) process.stderr.write(`${path} is stale: run node scripts/tool-surface.mjs\n`);
    if (stale.length) process.exit(1);
    for (const [path] of pages) process.stdout.write(`${path} is current\n`);
  } else {
    for (const [path, page] of pages) {
      writeFileSync(path, page);
      process.stdout.write(`wrote ${path} (${page.length} bytes)\n`);
    }
  }
}
