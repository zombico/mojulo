#!/usr/bin/env node
/**
 * The conformance gate, for any engine with a runtime kernel: is the engine's kernel EQUAL to the web runtime, frame by
 * frame, over a corpus (lib/graph/scene/engines/conformance.js)? Builds a scratch folder (the kernel modules the corpus
 * needs and the engine's runner script, scripts/conformance/<engine>/<corpus>), runs it headless, and compares every
 * frame's canonical snapshot. Advisory like every engine gate: it needs the engine (Godot: $MOJULO_GODOT or the app;
 * Roblox: Lune, $MOJULO_LUNE or on the PATH).
 *
 *   node scripts/conformance.mjs --engine godot|roblox --corpus bus|combat|mind|rules|scenes [--random 24] [--seed 7] [--only <id>] [--json]
 *
 * Exit 0 when every frame of every scenario is equal; 1 with the first difference of each unequal scenario; 2 when the
 * engine is not found or its kernel does not have the corpus's modules yet.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTROL = path.resolve(HERE, '..');
register(pathToFileURL(path.join(HERE, 'mcp-stdio-loader.mjs')).href, pathToFileURL(`${CONTROL}/`).href);

const { scenariosOf, compare } = await import('../lib/graph/scene/engines/conformance.js');
const { runCorpus, runnerOf } = await import('../lib/graph/scene/engines/runners.js');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const engine = arg('--engine', 'godot'), corpus = arg('--corpus', 'bus'), only = arg('--only', null);
const opts = {};
if (argv.includes('--random')) opts.random = Number(arg('--random'));
if (argv.includes('--seed')) opts.seed = Number(arg('--seed'));
if (corpus === 'bus' && opts.random === undefined) opts.random = 24;
if (corpus === 'bus' && opts.seed === undefined) opts.seed = 7;

const bin = runnerOf(engine).find();
if (!bin) { console.error(`conformance: no ${engine} runner found (lib/workers/find.js)`); process.exit(2); }
let scenarios = scenariosOf(corpus, opts);
if (only && Array.isArray(scenarios)) scenarios = scenarios.filter((sc) => sc.id === only);
const { out, errors, status } = runCorpus(engine, corpus, scenarios, { bin });
if (!out) { console.error(`${engine} exited ${status}:\n${errors.join('\n') || 'no output'}`); process.exit(status === null ? 2 : 1); }
let rows = compare(corpus, scenarios, out, opts);
if (only) rows = rows.filter((r) => r.id === only);
if (argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
else {
  const eq = rows.filter((r) => r.equal).length, frames = rows.reduce((n, r) => n + r.frames, 0);
  console.log(`${corpus} conformance on ${engine} · ${eq}/${rows.length} scenarios equal · ${frames} frames`);
  for (const r of rows.filter((x) => !x.equal)) console.log(`  ✗ ${r.id} frame ${r.first.frame} at char ${r.first.at}\n      web    ${r.first.web}\n      ${engine.padEnd(6)} ${r.first.engine}`);
  if (errors.length) console.log(`  (${errors.length} error line${errors.length > 1 ? 's' : ''}: ${errors[0]})`);
}
process.exit(rows.every((r) => r.equal) ? 0 : 1);
