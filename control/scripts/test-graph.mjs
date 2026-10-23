#!/usr/bin/env node
// The import graph of control's own sources, read statically (no transform, no execution): which modules each file
// imports (static, re-exports and literal dynamic imports, `@/` the control root), and from it which test files reach
// a given module and in how many hops. scripts/test-changed.mjs selects a change's tests off it.
//
//   importGraph()                          → { files: Set, deps: Map<file, Set<file>>, rdeps: Map<file, Set<file>> }
//   testsReaching(graph, files, { depth }) → Map<test file, hops> (a changed test file is 0 hops from itself)
//
// Paths are relative to control/, '/'-separated. Run directly to print the tests a module reaches by hop count:
//   node scripts/test-graph.mjs lib/graph/versus/versus-kinds.js [more files] [--depth 4]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['lib', 'app', 'components', 'scripts', 'book', 'middleware.js'];
const SKIP = new Set(['node_modules', '.next', 'data', 'models']);
const EXT = /\.(m?js|jsx)$/;
const IMPORT = /(?:^|[\s;])(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|(?:^|[\s;(=,])import\s*['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

const rel = (abs) => path.relative(CONTROL, abs).split(path.sep).join('/');
export const isTest = (f) => /\.test\.m?js$/.test(f);

function walk(abs, out) {
  let st;
  try { st = fs.statSync(abs); } catch { return; }
  if (st.isFile()) { if (EXT.test(abs)) out.push(rel(abs)); return; }
  for (const name of fs.readdirSync(abs)) if (!SKIP.has(name)) walk(path.join(abs, name), out);
}

function resolveSpec(from, spec, files) {
  let base;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else return null;   // a package
  for (const c of [base, `${base}.js`, `${base}.mjs`, `${base}.jsx`, `${base}/index.js`]) if (files.has(c)) return c;
  return null;
}

export function importGraph() {
  const list = [];
  for (const r of ROOTS) walk(path.join(CONTROL, r), list);
  const files = new Set(list), deps = new Map(), rdeps = new Map();
  for (const f of list) {
    const src = fs.readFileSync(path.join(CONTROL, f), 'utf8'), out = new Set();
    for (const m of src.matchAll(IMPORT)) { const to = resolveSpec(f, m[1] ?? m[2] ?? m[3], files); if (to && to !== f) out.add(to); }
    deps.set(f, out);
    for (const to of out) { if (!rdeps.has(to)) rdeps.set(to, new Set()); rdeps.get(to).add(f); }
  }
  return { files, deps, rdeps };
}

/** The test files that import any of `files` within `depth` hops (breadth first), each with its nearest hop count.
 * `files` is a list (each starting at hop 0) or a Map of file → the hop it starts at (a text reader starts at 1). */
export function testsReaching(graph, files, { depth = Infinity } = {}) {
  const start = files instanceof Map ? files : new Map(files.map((f) => [f, 0]));
  const seen = new Map(), out = new Map();
  for (const [f, h] of start) if (graph.files.has(f) && !(seen.get(f) <= h)) seen.set(f, h);
  let frontier = [...seen.keys()];
  while (frontier.length) {
    const next = new Set();
    for (const f of frontier) {
      const d = seen.get(f);
      if (isTest(f) && !(out.get(f) <= d)) out.set(f, d);
      if (d >= depth) continue;
      for (const up of graph.rdeps.get(f) ?? []) if (!(seen.get(up) <= d + 1)) { seen.set(up, d + 1); next.add(up); }
    }
    frontier = [...next];
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), di = args.indexOf('--depth');
  const depth = di >= 0 ? Number(args[di + 1]) : Infinity, targets = args.filter((a, i) => a !== '--depth' && !(di >= 0 && i === di + 1));
  const t0 = Date.now(), G = importGraph(), T = testsReaching(G, targets, { depth });
  const byHop = {};
  for (const [f, d] of T) (byHop[d] ??= []).push(f);
  console.log(`${G.files.size} files read in ${Date.now() - t0} ms; ${T.size} test files reach ${targets.join(', ')}${Number.isFinite(depth) ? ` within ${depth} hops` : ''}`);
  for (const d of Object.keys(byHop).sort((a, b) => a - b)) console.log(`  ${d} hop${d === '1' ? '' : 's'}: ${byHop[d].length}${byHop[d].length <= 12 ? `  ${byHop[d].sort().join(' ')}` : ''}`);
}
