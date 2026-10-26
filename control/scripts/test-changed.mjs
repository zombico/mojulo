#!/usr/bin/env node
// test:changed — the tests a change needs, picked off the import graph (scripts/test-graph.mjs), not the whole suite.
//
//   npm run test:changed                         the uncommitted change (staged, unstaged, untracked)
//   npm run test:changed -- --since <ref>        and every commit since <ref> (a branch: --since origin/1023-consolidated)
//   npm run test:changed -- --depth 2            reach further up the graph (default 1: the tests that import a changed
//                                                module; 2 adds those of its importers: a branch's check before a merge)
//   npm run test:changed -- --list               say what would run, run nothing
//   npm run test:changed -- --files a.js,b.js    as if these files had changed (paths relative to control/)
//
// What runs, for the changed files:
//   - every test file within `depth` import hops of a changed module (1, the default: the tests that import it; 2:
//     those that import a module that imports it), and a changed test file itself;
//   - every byte pin (*.char.test.js, *.trace.test.js) the change reaches at any depth: the emission contract;
//   - the deep sweeps (*.deep.test.js) among those, under the deep config; the e2e suites among those are named, not
//     run (CI runs that tier);
//   - a source a module reads as TEXT (inlined into a page, scanned for its keys) counts as a change to that reader
//     (TEXT_READERS); a guard test (test-changed.test.js) fails when a module starts reading files beside it and is
//     declared neither there nor in DATA_READERS;
//   - a changed data file (a card, a table, a kernel in another language) runs the tests in its folder;
//   - a changed config (package.json, a vitest config, next.config) runs the critical tier instead: the graph cannot
//     say what a config reaches.
// Prose (the changelog, docs, a README) runs nothing. The whole suite, the deep tier and e2e run in CI.
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONTROL, importGraph, testsReaching, isTest } from './test-graph.mjs';

/** Sources read as text, and the modules (or tests) that read them: a change to one is a change to its readers. */
export const TEXT_READERS = Object.freeze([
  { reads: /^lib\/graph\/versus\/[^/]+\.js$/, by: ['lib/graph/versus/versus-page.js'], why: 'the versus page inlines its modules and clients' },
  { reads: /^lib\/graph\/gameworld\/feel\/(cards|kernel|page\.client)\.js$/, by: ['lib/graph/gameworld/feel/page.js'], why: 'the action lab page inlines its kernel' },
  { reads: /^lib\/graph\/pixelizer\/[^/]+\.js$/, by: ['lib/graph/pixelizer/brickster-shell.js', 'lib/graph/pixelizer/philosophers-stone-shell.js'], why: 'the pixelizer shells inline their siblings' },
  { reads: /^lib\/graph\/(worlds\/controllable\/[^/]+|scene\/scene-three|scene\/engine-score|scene\/channels\/events)\.js$/, by: ['lib/graph/scene/engines/mark-sources.js', 'lib/graph/scene/godot-marks.test.js'], why: 'the engine marks scan the runtime\'s source for its keys' },
  { reads: /^lib\/graph\/scene\/(godot-kernel|godot-arcade-kernel)\//, by: ['lib/graph/scene/engines/runners.js', 'lib/graph/scene/godot-harness.js'], why: 'the Godot kernels are copied into the project' },
  { reads: /^lib\/graph\/scene\/roblox-kernel\//, by: ['lib/graph/scene/roblox-gate.js', 'lib/graph/scene/engines/runners.js'], why: 'the Roblox kernel is copied into the place' },
  { reads: /^lib\/mcp\/apps\/preview-ui\.js$/, by: ['lib/mcp/apps/preview.js'], why: 'the app preview inlines its UI script' },
]);
/** Modules that read files beside them that are DATA (cards, tables, stores, fonts, versions), not code: their own
 * data files are covered by the folder rule. */
export const DATA_READERS = Object.freeze([
  'app/api/sketches/[ref]/model.glb/route.js', 'lib/app-mcp-scaffold/install.js', 'lib/graph/beats/beats-vocab/loader.js',
  'lib/graph/creature-heads/index.js', 'lib/graph/game/hud-cards/loader.js', 'lib/graph/game/mechanic-cards/loader.js',
  'lib/graph/game/title-carve.js', 'lib/graph/game/title-words.js',
  'lib/graph/game/slice-cards/loader.js', 'lib/graph/image-outcomes/fonts/font-shelf.js', 'lib/graph/image-outcomes/render-store.js',
  'lib/graph/image-outcomes/sheet-store.js', 'lib/graph/manji-programs/loader.js', 'lib/graph/motion-vocab/loader.js',
  'lib/graph/painted-landscape-cards/loader.js', 'lib/graph/polygonizer/humanoid-head-fit.js', 'lib/graph/polygonizer/relational-face-store.js',
  'lib/graph/polygonizer/skin-store.js',
  'lib/graph/scene/emit-util.js', 'lib/graph/scene/mesh-store.js', 'lib/graph/scene/scene-three.js', 'lib/graph/sketch-vocab/loader.js',
  'lib/graph/solid-vocab/loader.js', 'lib/graph/views/recipe-book/cards.js', 'lib/graph/views/view-vocab/loader.js',
  'lib/graph/voice/voice-sample-store.js', 'lib/graph/worlds/world-scene.js', 'lib/mcp/adapters/loader.js', 'lib/mcp/catalysts/loader.js',
  'lib/mcp/hosts/registry.js', 'lib/mcp/mcp-orbit-components/generator.js', 'lib/mcp/mcp-orbit-components/loader.js',
  'lib/mcp/routing-cards/loader.js', 'lib/mcp/seeds/mcp-capabilities-seed.js', 'lib/mcp/tools/mcp-orbit.js', 'lib/motion/glyph-carver.js',
  'lib/server-version.js', 'lib/version/local.js', 'lib/workers/find.js',
]);
const PROSE = /(^|\/)(CHANGELOG[^/]*|README[^/]*|NOTICE|LICENSE[^/]*)$|^\.\.\/docs\/|^\.\.\/[^/]+\.md$/;
const CONFIG = /^(package(-lock)?\.json|vitest[^/]*\.js|next\.config\.mjs|jsconfig\.json)$/;
const PIN = /\.(char|trace)\.test\.js$/;
const NEVER = /\.(gen|spike|godot)\.test\.js$|\.spike\.gen\.test\.js$/;

const git = (args) => execFileSync('git', args, { cwd: CONTROL, encoding: 'utf8' });
/** The changed files, relative to control/ (a file outside it keeps its ../ path). */
export function changedFiles({ since = null } = {}) {
  const top = git(['rev-parse', '--show-toplevel']).trim(), prefix = path.relative(top, CONTROL).split(path.sep).join('/');
  const toControl = (p) => (prefix && p.startsWith(`${prefix}/`) ? p.slice(prefix.length + 1) : path.posix.relative(prefix, p));
  const out = new Set();
  for (const line of git(['status', '--porcelain', '--untracked-files=all']).split('\n')) {
    if (!line.trim()) continue;
    const p = line.slice(3).split(' -> ').pop().replace(/^"|"$/g, '');
    out.add(toControl(p));
  }
  if (since) for (const p of git(['diff', '--name-only', `${since}...HEAD`]).split('\n')) if (p.trim()) out.add(toControl(p.trim()));
  return [...out].sort();
}

/** What a set of changed files needs run → { tests, deep, e2e, pins, critical, why, prose } */
export function selectTests(changed, { depth = 1, graph = importGraph(), e2eList = [] } = {}) {
  const why = [], targets = new Map(), direct = new Set(), readBy = new Map();
  const target = (f, hop) => { if (!(targets.get(f) <= hop)) targets.set(f, hop); };
  const readers = new Set(TEXT_READERS.flatMap((T) => T.by));
  let critical = false;
  const prose = changed.filter((f) => PROSE.test(f));
  for (const f of changed) {
    if (PROSE.test(f) || f.startsWith('../') || f.startsWith('node_modules/') || f.startsWith('data/') || f.startsWith('.next/')) continue;
    if (CONFIG.test(f)) { critical = true; why.push(`${f}: a config, so the critical tier`); continue; }
    // (a reader is one hop up from what it reads: its own tests count as the change's first hop)
    if (!isTest(f) && !readers.has(f)) for (const T of TEXT_READERS) if (T.reads.test(f)) for (const r of T.by) { target(r, 0); if (!readBy.has(r)) readBy.set(r, { why: T.why, n: 0 }); readBy.get(r).n++; }
    if (graph.files.has(f)) { target(f, 0); if (isTest(f)) direct.add(f); continue; }
    if (!fs.existsSync(path.join(CONTROL, f))) { why.push(`${f}: removed; its importers are named by the graph's own errors`); continue; }
    // a data file: the tests beside it
    const dir = path.posix.dirname(f);
    const here = [...graph.files].filter((t) => isTest(t) && path.posix.dirname(t) === dir);
    for (const t of here) direct.add(t);
    if (here.length) why.push(`${f}: data, so the ${here.length} test file${here.length === 1 ? '' : 's'} in ${dir}`);
  }
  for (const [r, { why: w, n }] of readBy) why.push(`${n} changed file${n === 1 ? '' : 's'} read as text by ${r} (${w})`);
  const reach = testsReaching(graph, targets);
  const picked = new Set(direct);
  for (const [t, d] of reach) if (d <= depth || PIN.test(t)) picked.add(t);
  const all = [...picked].filter((t) => !NEVER.test(t) && fs.existsSync(path.join(CONTROL, t))).sort();
  const e2e = all.filter((t) => e2eList.includes(t)), deep = all.filter((t) => /\.deep\.test\.js$/.test(t));
  const tests = all.filter((t) => !e2e.includes(t) && !deep.includes(t));
  return { tests, deep, e2e, pins: tests.filter((t) => PIN.test(t)), critical, why, prose };
}

async function main() {
  const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const depth = opt('--depth') ? Number(opt('--depth')) : 1, since = opt('--since'), list = args.includes('--list');
  const { E2E } = await import(path.join(CONTROL, 'vitest.config.js'));
  const changed = opt('--files') ? opt('--files').split(',').filter(Boolean) : changedFiles({ since });
  if (!changed.length) { console.log('test:changed: nothing changed'); return 0; }
  const t0 = Date.now(), S = selectTests(changed, { depth, e2eList: E2E });
  console.log(`test:changed: ${changed.length} changed file${changed.length === 1 ? '' : 's'}${since ? ` (with commits since ${since})` : ''}; graph and selection in ${Date.now() - t0} ms`);
  for (const w of S.why) console.log(`  ${w}`);
  console.log(`  ${S.tests.length} test file${S.tests.length === 1 ? '' : 's'} within ${depth} hop${depth === 1 ? '' : 's'} (${S.pins.length} byte pins among them), ${S.deep.length} deep sweep${S.deep.length === 1 ? '' : 's'}${S.critical ? ', and the critical tier' : ''}`);
  if (S.e2e.length) console.log(`  the e2e tier reaches it too (${S.e2e.join(', ')}): CI runs it; run \`npm run test:e2e\` yourself only for a gameworld, city, game or structure kernel change`);
  if (list) { for (const t of [...S.tests, ...S.deep]) console.log(`    ${t}`); return 0; }
  if (!S.tests.length && !S.deep.length && !S.critical) { console.log(S.prose.length === changed.length ? '  prose only: no tests' : '  no test reaches the change'); return 0; }
  const run = (cfg, files) => spawnSync('npx', ['vitest', 'run', ...(cfg ? ['--config', cfg] : []), ...files], { cwd: CONTROL, stdio: 'inherit' }).status;
  // every tier runs: a red in one must not hide what the next would say
  const statuses = [];
  if (S.critical) statuses.push(run('vitest.critical.config.js', []));
  if (S.tests.length) statuses.push(run(null, S.tests));
  if (S.deep.length) statuses.push(run('vitest.deep.config.js', S.deep));
  return statuses.find((s) => s !== 0) ?? 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().then((s) => process.exit(s ?? 0));
