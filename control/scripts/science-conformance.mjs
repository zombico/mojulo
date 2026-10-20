#!/usr/bin/env node
/**
 * The shader conformance gate from the shell: is what a shader-drawn science page computes what its solver computes?
 * Loads the page in headless Chrome (capture mode), evaluates the shader's model function at the probes and measures
 * rendered frames, against JS (lib/graph/science-worlds/conformance.js). Advisory like every gate.
 *
 *   node scripts/science-conformance.mjs --selftest [--json]   the gate's own check: a faithful shader agrees, a fudged one does not
 *   node scripts/science-conformance.mjs --examples [--json]   every shader-drawn law example (the relativistic light world's,
 *                                                              the hydrogen orbitals drawn as a volume, the slits' plane,
 *                                                              the coulomb row's field as a volume and as shells)
 *   node scripts/science-conformance.mjs --ref <ref> [--json]  a stored shader-drawn world (a relativistic light world, an
 *                                                              atom world drawn as a volume, a quantum plane world, a
 *                                                              classical world whose field is a volume or shells)
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
const { lightProbes } = await import('../lib/graph/science-worlds/relativistic/probes.js');
const { RELATIVISTIC_LAWS } = await import('../lib/graph/science-worlds/relativistic/laws.js');
const { volumeProbes, planeProbes } = await import('../lib/graph/science-worlds/quantum/probes.js');
const { QUANTUM_LAW, QUANTUM_LAWS } = await import('../lib/graph/science-worlds/quantum/laws.js');
const { fieldProbes } = await import('../lib/graph/science-worlds/classical/probes.js');
const { CLASSICAL_LAW } = await import('../lib/graph/science-worlds/classical/laws.js');

const argv = process.argv.slice(2);
const json = argv.includes('--json');
const refAt = argv.indexOf('--ref');
if (!argv.includes('--selftest') && !argv.includes('--examples') && refAt < 0) {
  console.error('usage: node scripts/science-conformance.mjs --selftest | --examples | --ref <ref> [--json]');
  process.exit(2);
}

const out = [];
// a light world's two runs: the page's rays, and its shadow face-on against a lit sky
async function light(name, manifest) {
  const p = lightProbes(manifest);
  const a = await runConformance(p.page.payload, p.page.probes, p.size);
  const b = await runConformance(p.shadow.payload, p.shadow.probes, p.size);
  const rows = [...(a.rows ?? []), ...(b.rows ?? [])];
  const gate = conformanceGate(a.ran && b.ran ? { ran: true, ok: a.ok && b.ok, rows, worst: [a.worst, b.worst].filter(Boolean).sort((x, y) => y.error / y.tol - x.error / x.tol)[0] } : (a.ran ? b : a));
  out.push({ name, wantOk: true, gate, rows });
}
// a shader page whose probes all run on the page itself
async function onePage(name, p) {
  const r = await runConformance(p.page.payload, p.page.probes, p.size);
  out.push({ name, wantOk: true, gate: conformanceGate(r), rows: r.rows ?? [] });
}
const isVolume = (m) => m.kind === 'quantum-view' && m.model?.system === 'atom' && m.dress?.render === 'volume';
const isPlane = (m) => m.kind === 'quantum-view' && m.model?.system === 'plane';
const isField = (m) => m.kind === 'classical-view' && ['volume', 'shells'].includes(m.dress?.field);
if (argv.includes('--selftest')) {
  for (const [name, fudge, wantOk] of [['faithful', 1, true], ['fudged ×1.1', 1.1, false]]) {
    const c = selftestCase({ fudge });
    // eslint-disable-next-line no-await-in-loop -- one browser at a time
    const r = await runConformance(c.payload, c.probes, c.size);
    out.push({ name, wantOk, gate: conformanceGate(r), rows: r.rows ?? [] });
  }
}
if (argv.includes('--examples')) {
  // eslint-disable-next-line no-await-in-loop -- one browser at a time
  for (const row of RELATIVISTIC_LAWS.filter((q) => q.example.system === 'light')) await light(`relativistic ${row.id}`, { kind: 'relativistic-view', model: row.example });
  // the hydrogen row's example as a volume, and orbitals out to the largest n beside it
  const h = QUANTUM_LAW.hydrogen.example;
  await onePage('quantum hydrogen (volume)', volumeProbes({ kind: 'quantum-view', model: h, dress: { render: 'volume' } }));
  for (const row of QUANTUM_LAWS.filter((q) => q.system === 'plane')) await onePage(`quantum ${row.id}`, planeProbes({ kind: 'quantum-view', model: row.example }));
  for (const field of ['volume', 'shells']) await onePage(`classical coulomb (field ${field})`, fieldProbes({ kind: 'classical-view', model: CLASSICAL_LAW.coulomb.example, dress: { field } }));
  await onePage('quantum hydrogen n = 1 to 7 (volume)', volumeProbes({ kind: 'quantum-view', model: { ...h, state: { orbitals: [{ n: 1 }, { n: 4, l: 3, m: -2 }, { n: 7, l: 5, m: 4 }] } }, dress: { render: 'volume' } }));
}
if (refAt >= 0) {
  const ref = argv[refAt + 1];
  const { SketchRepository } = await import('../lib/db/repositories/sketches.js');
  const sketch = SketchRepository.getByRef(ref);
  if (!sketch) { console.error(`no sketch '${ref}'`); process.exit(2); }
  if (isVolume(sketch.manifest)) await onePage(ref, volumeProbes(sketch.manifest));
  else if (isPlane(sketch.manifest)) await onePage(ref, planeProbes(sketch.manifest));
  else if (isField(sketch.manifest)) await onePage(ref, fieldProbes(sketch.manifest));
  else if (sketch.manifest.kind === 'relativistic-view' && sketch.manifest.model?.system === 'light') await light(ref, sketch.manifest);
  else { console.error(`'${ref}' is not drawn by a shader (a relativistic light world is, an atom world drawn as a volume, a quantum plane world, and a classical field drawn as a volume or shells)`); process.exit(2); }
}
if (json) console.log(JSON.stringify(out, null, 2));
else for (const o of out) console.log(`${o.name}: ${o.gate.ran ? (o.gate.ok ? 'agrees' : 'disagrees') : 'not run'} — ${o.gate.detail}${o.gate.value ? ` (${o.gate.value.probes} probes)` : ''}`);
if (out.some((o) => !o.gate.ran)) process.exit(2);
process.exit(out.every((o) => o.gate.ok === o.wantOk) ? 0 : 1);
