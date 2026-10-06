#!/usr/bin/env node
/**
 * The fauna fit loop's scorer: one species ring plan → the gates and the matched-view silhouette compare, with no
 * database. Each pass of the loop changes ONE plan number, re-runs this, and keeps the change only if every gate
 * passes and the score rose. The references are filled silhouettes (clay renders or masks) at NAMED views.
 *
 * Usage (from control/):
 *   node scripts/fauna-fit.mjs --species wolf --compare lateral=ref/side.png,frontal=ref/front.png --out <dir>
 *   node scripts/fauna-fit.mjs --plan <plan.json> --targets '{"withers":0.8,"length":1.1}' --compare … --out <dir>
 *   options: --targets JSON of metres (withers = top of the trunk, shoulder = trunk top at the shoulder station, length = rump→snout tip), --tol 0.1 (fraction)
 *            --el 10 --compare-res 256
 * Prints { ok, gates: { closed, grounded, size }, pass, compare: { <view>: { iou, aspect, centroid } }, score } and
 * writes compare-<view>.png sheets (reference | source | overlap) plus fit.json to --out. `score` is the mean iou.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { register } from 'node:module';

const { values: args } = parseArgs({ options: {
  species: { type: 'string' }, plan: { type: 'string' }, out: { type: 'string' }, compare: { type: 'string' },
  targets: { type: 'string' }, tol: { type: 'string', default: '0.1' }, el: { type: 'string', default: '10' }, 'compare-res': { type: 'string', default: '256' },
} });
const fail = (msg) => { process.stdout.write(`${JSON.stringify({ ok: false, error: msg })}\n`); process.exit(1); };
if (!args.out || (!args.species && !args.plan)) fail('need --out <dir> and one of --species <name> | --plan <plan.json>');

register('./mcp-stdio-loader.mjs', import.meta.url);
const { expandPlan } = await import('@/lib/graph/polygonizer/station-loft-plan.js');
const { compileLayered, auditLayered } = await import('@/lib/graph/polygonizer/station-loft.js');

let plan;
if (args.plan) plan = JSON.parse(await fs.readFile(args.plan, 'utf8'));
else {
  const { SPECIES: SPECIES_PLANS, speciesPlan } = await import('@/lib/graph/fauna/species.js');
  plan = speciesPlan(args.species); if (!plan) fail(`no ring plan for '${args.species}' (have ${Object.keys(SPECIES_PLANS).join(', ')})`);
}

const recipe = expandPlan(plan);
const D = recipe.dials || {};
const extremes = [{}, Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.min])), Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.max]))];
const open = new Set();
for (const dials of extremes) for (const [n, r] of Object.entries(auditLayered(compileLayered(recipe, dials)))) if (!r.pass) open.add(n);
const mesh = compileLayered(recipe);

// grounded: the lowest vertex sits on z = 0 (pads planted, nothing below the floor)
const minZ = Math.min(...mesh.vertices.map((v) => v[2]));
const r3 = (x) => Math.round(x * 1000) / 1000;
const J = plan.joints;
// withers: the top of the trunk (or, for an old ring plan, its `withers` joint); length: the trunk's back to the
// muzzle tip (the tail is not body length)
const ptsOf = (re) => Object.entries(mesh.parts).filter(([n]) => re.test(n)).flatMap(([, p]) => Object.values(p.points || {}));
const trunk = ptsOf(/^torso$/), headPts = ptsOf(/^(cranium|jaw|head)$/);
const withers = trunk.length ? Math.max(...trunk.map((v) => v[2])) : J.withers?.[2] ?? NaN;
const back = trunk.length ? Math.min(...trunk.map((v) => v[1])) : J.rump?.[1] ?? 0;
const nose = Math.max(...(headPts.length ? headPts : mesh.vertices).map((v) => v[1]));
// height: the top of the whole animal (a biped bird's published standing height; for a quadruped, its head)
// shoulder: the top of the trunk AT the shoulder station (the front of the torso: trunk points within a tenth of the
// trunk's length of the shoulder joint's y, else the front quarter) — withers is the trunk's highest point anywhere,
// which on a hunched or rising back (beaver, otter) is the rump
const front = trunk.length ? Math.max(...trunk.map((v) => v[1])) : 0, span = front - back;
const atShoulder = J.shoulder ? trunk.filter((v) => Math.abs(v[1] - J.shoulder[1]) <= 0.1 * span) : [];
const shoulderPts = atShoulder.length ? atShoulder : trunk.filter((v) => v[1] >= front - 0.25 * span);
const shoulder = shoulderPts.length ? Math.max(...shoulderPts.map((v) => v[2])) : withers;
const measured = { withers: r3(withers), shoulder: r3(shoulder), length: r3(nose - back), height: r3(Math.max(...mesh.vertices.map((v) => v[2]))), minZ: r3(minZ) };
const targets = args.targets ? JSON.parse(args.targets) : {}; const tol = Number(args.tol);
const sizeMiss = Object.entries(targets).filter(([k, t]) => !(Math.abs(measured[k] - t) <= tol * t)).map(([k, t]) => `${k} ${measured[k]} vs ${t}`);
// attached: every pinned detail (ears, claws) still touches its host — a detail whose base stayed put while the host
// moved floats free and still "closes", so closure alone never catches it
// the host's SURFACE (its triangles sampled on a barycentric grid), not its sparse ring vertices: a correctly seated
// ear base sits on a face between them, centimetres from the nearest vertex
const partVerts = (name) => Object.values(mesh.parts[name]?.points || {});
// the grid is FINER on a long triangle (a giraffe's neck band is ~0.6 m): N grows with the triangle's longest edge so
// samples sit at most ~4 mm apart (8 at least, as before, so a short triangle samples as it always did)
const hostSamples = (name) => { const P = mesh.parts[name]; const out = [];
  for (const tri of Object.values(P?.faces || {})) { const [A, B, C] = tri.map((id) => P.points[id]);
    const edge = Math.max(...[[A, B], [B, C], [C, A]].map(([p, q]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))), N = Math.max(8, Math.min(200, Math.ceil(edge / 0.004)));
    for (let i = 0; i <= N; i++) for (let j = 0; i + j <= N; j++) { const u = i / N, v = j / N, w = 1 - u - v; out.push([0, 1, 2].map((c) => A[c] * w + B[c] * u + C[c] * v)); } }
  return out; };
const attachGap = {}; const hostCache = {};
// catchlights float just proud of the eye by design
const detached = Object.entries(mesh.parts).filter(([n, p]) => p.pin?.parent && !/^catch/.test(n)).filter(([name, p]) => {
  const V = partVerts(name), lo = [0, 1, 2].map((c) => Math.min(...V.map((v) => v[c])) - 0.05), hi = [0, 1, 2].map((c) => Math.max(...V.map((v) => v[c])) + 0.05);
  const host = (hostCache[p.pin.parent] ??= hostSamples(p.pin.parent)).filter((b) => b.every((x, c) => x >= lo[c] && x <= hi[c])); let d = Infinity;
  for (const a of V) for (const b of host) d = Math.min(d, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  attachGap[name] = r3(d);
  return d > 0.012;
}).map(([n]) => n);
measured.attachGap = attachGap;
const gates = { closed: open.size ? [...open] : true, attached: detached.length ? detached : true, grounded: Math.abs(minZ) <= 0.02 ? true : `min z ${r3(minZ)}`, size: sizeMiss.length ? sizeMiss : true };
const pass = Object.values(gates).every((g) => g === true);

await fs.mkdir(args.out, { recursive: true });
let compare; let score = null;
if (args.compare) {
  const { weldFaces } = await import('@/lib/graph/scene/wire-svg.js');
  const { sourceSilhouette, compareSilhouette, referenceMask, writeCompareSheet } = await import('@/lib/graph/scene/wire-compare.js');
  const faces = mesh.faces.map((tri, i) => ({ corners: tri.map((vi) => mesh.vertices[vi]), group: mesh.groups?.[i] }));
  const source = { schema: 'wire-source-v1', kind: 'layered', ...weldFaces(faces) };
  const res = Number(args['compare-res']); compare = {};
  for (const pair of args.compare.split(',').map((s) => s.trim()).filter(Boolean)) {
    const eq = pair.indexOf('='); if (eq < 0) fail(`--compare wants view=path pairs (got '${pair}')`);
    const viewName = pair.slice(0, eq).trim(); const view = Number.isFinite(Number(viewName)) ? Number(viewName) : viewName;
    const sil = sourceSilhouette(source, view, { res, elevationDegrees: Number(args.el) }); const ref = await referenceMask(pair.slice(eq + 1).trim());
    const { fitted, ...numbers } = compareSilhouette(sil, ref.mask, ref.res);
    const sheet = `compare-${String(viewName).replace(/[^a-z0-9-]/gi, '_')}.png`; await writeCompareSheet(path.join(args.out, sheet), sil, ref.mask, ref.res, fitted);
    compare[viewName] = { ...numbers, sheet };
  }
  const ious = Object.values(compare).map((c) => c.iou); score = r3(ious.reduce((s, x) => s + x, 0) / ious.length);
}
const out = { ok: true, species: args.species || null, gates, pass, measured, ...(compare ? { compare, score } : {}) };
await fs.writeFile(path.join(args.out, 'fit.json'), `${JSON.stringify(out, null, 1)}\n`);
process.stdout.write(`${JSON.stringify(out)}\n`);
