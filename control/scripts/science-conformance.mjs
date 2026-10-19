#!/usr/bin/env node
/**
 * The shader conformance gate from the shell: is what a shader-drawn science page computes what its solver computes?
 * Loads the page in headless Chrome (capture mode), evaluates the shader's model function at the probes and measures
 * rendered frames, against JS (lib/graph/science-worlds/conformance.js). Advisory like every gate.
 *
 *   node scripts/science-conformance.mjs --selftest [--json]   the gate's own check: a faithful shader agrees, a fudged one does not
 *
 * Exit 0 when every probe agrees; 1 when one disagrees; 2 when no browser was found ("not run").
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTROL = path.resolve(HERE, '..');
register(pathToFileURL(path.join(HERE, 'mcp-stdio-loader.mjs')).href, pathToFileURL(`${CONTROL}/`).href);

const { runConformance, conformanceGate } = await import('../lib/graph/science-worlds/conformance.js');
const { selftestCase } = await import('../lib/graph/science-worlds/conformance-selftest.js');

const argv = process.argv.slice(2);
const json = argv.includes('--json');
if (!argv.includes('--selftest')) {
  console.error('usage: node scripts/science-conformance.mjs --selftest [--json]');
  process.exit(2);
}

const out = [];
for (const [name, fudge, wantOk] of [['faithful', 1, true], ['fudged ×1.1', 1.1, false]]) {
  const c = selftestCase({ fudge });
  // eslint-disable-next-line no-await-in-loop -- one browser at a time
  const r = await runConformance(c.payload, c.probes, c.size);
  out.push({ name, wantOk, gate: conformanceGate(r), rows: r.rows ?? [] });
}
if (json) console.log(JSON.stringify(out, null, 2));
else for (const o of out) console.log(`${o.name}: ${o.gate.ran ? (o.gate.ok ? 'agrees' : 'disagrees') : 'not run'} — ${o.gate.detail}`);
if (out.some((o) => !o.gate.ran)) process.exit(2);
process.exit(out.every((o) => o.gate.ok === o.wantOk) ? 0 : 1);
