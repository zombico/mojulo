// node --test docs/examples/dragon-body/test-body.mjs — the machine gate for the body recipe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { compileLayered, auditLayered, mirrorPid } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { lowerLayeredToWorkbench } from '../../../control/lib/graph/polygonizer/station-loft-workbench.js';
import { loftToFaces } from '../../../control/lib/graph/polygonizer/loft-faces.js';
import { auditClosure } from '../../../control/lib/graph/polygonizer/face-closure.js';
import { recipePath, headPath, HEAD_SHIFT, mirrorId, mirrorPartName } from './seed-recipe.mjs';

const recipe = JSON.parse(readFileSync(recipePath, 'utf8')); const head = JSON.parse(readFileSync(headPath, 'utf8'));
const D = recipe.dials;
const EXTREMES = [{}, Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.min])), Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.max])), { lean: 20, jawOpen: 30, bulk: 1.2, stance: 1.2, clawLength: 1.5 }];
const at = (m) => Object.fromEntries(m.pointIds.map((id, i) => [id, m.vertices[i]]));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const tet = (a, b, c) => (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
const signedVolume = (faces) => faces.reduce((s, f) => { const c = f.corners; let v = 0; for (let i = 1; i + 1 < c.length; i++) v += tet(c[0], c[i], c[i + 1]); return s + v; }, 0);   // fan every polygon

test('every part passes the audit at rest and at every dial extreme; ids are dial-invariant', () => {
  const rest = compileLayered(recipe);
  for (const dials of EXTREMES) { const m = compileLayered(recipe, dials); const a = auditLayered(m);
    const bad = Object.entries(a).filter(([, r]) => !r.pass).map(([n, r]) => `${n}: ${JSON.stringify(r)}`); assert.deepEqual(bad, [], JSON.stringify(dials));
    assert.deepEqual(m.pointIds, rest.pointIds); assert.deepEqual(m.faceIds, rest.faceIds); }
});
test('the whole figure mirrors by name: part suffix and slot suffix R ↔ L, x negated, at rest and under every dial but the sway', () => {
  for (const dials of EXTREMES.map((d) => ({ ...d, ...('tailSway' in d ? { tailSway: 0 } : {}) }))) { const P = at(compileLayered(recipe, dials)); let checked = 0;
    for (const [id, v] of Object.entries(P)) { const [part, rest] = id.split('/'); if (!/[RL]$/.test(part) && !/[RL]$/.test(rest) && !/[RL]\d*$/.test(part)) continue;
      const mid = part.startsWith('claw') || part.startsWith('tooth') ? `${mirrorPartName(part)}/${rest}` : /[RL]$/.test(part) ? mirrorId(id) : `${part}/${mirrorPid(rest)}`;
      assert.ok(P[mid], `${id} has no mirror ${mid}`); assert.deepEqual(P[mid].map((x) => +x.toFixed(9)), [-v[0] + 0, v[1], v[2]].map((x) => +x.toFixed(9)), `${id} ↔ ${mid} at ${JSON.stringify(dials)}`); checked++; }
    assert.ok(checked > 400, `checked ${checked}`); }
});
test('every part lowers to one closed loft; L1 and claws exact to the micrometre; seated with the soles on the grid at rest', () => {
  for (const dials of EXTREMES) { const m = compileLayered(recipe, dials); const { spec, loweringError, omitted, seatedFrom } = lowerLayeredToWorkbench(m);
    for (const n of ['nostrilL', 'nostrilR']) assert.ok(omitted.includes(n), n); for (const n of omitted) assert.ok(/^(nostril|crest)/.test(n), `${n} omitted at ${JSON.stringify(dials)}`);   // crest spikes vanish at crestHeight 0
    for (const [name, err] of Object.entries(loweringError)) assert.ok(err < (name.startsWith('horn') ? 0.005 : 2e-6), `${name} lowering error ${err} m at ${JSON.stringify(dials)}`);   // recipe coordinates are rounded to the micrometre
    for (const loft of spec.lofts) { const faces = loftToFaces(loft, {}); const a = auditClosure(faces); assert.ok(a.closed && a.boundaryEdgeCount === 0, `${loft.id} ${JSON.stringify(a)}`); assert.ok(signedVolume(faces) > 0, `${loft.id} bakes inside out`); }
    if (!Object.keys(dials).length) assert.ok(Math.abs(seatedFrom ?? 0) < 0.02, `rest sole at ${seatedFrom}`); }
});
test('the head rides along: every head L1 point is the dragon recipe translated by HEAD_SHIFT; head dials unchanged but for the shifted pivot', () => {
  const body = at(compileLayered(recipe)); const dragon = at(compileLayered(head));
  for (const [id, v] of Object.entries(dragon)) { assert.ok(body[id], id); for (let k = 0; k < 3; k++) assert.ok(Math.abs(body[id][k] - (v[k] + HEAD_SHIFT[k])) < 2e-6, `${id}[${k}]`); }
  for (const [k, d] of Object.entries(head.dials)) { const b = recipe.dials[k]; assert.ok(b, k); if (d.op === 'scale') assert.ok(Math.abs(b.pivot - (d.pivot + HEAD_SHIFT[['x', 'y', 'z'].indexOf(d.axis)])) < 1e-9, k); else assert.deepEqual(b, d); }
});
test('lean hinges the torso, arms, neck and head forward about the pelvis tip; the legs stay planted', () => {
  const P0 = at(compileLayered(recipe)); const P = at(compileLayered(recipe, { lean: 20 }));
  assert.deepEqual(P['pelvis/tip'], P0['pelvis/tip']); assert.ok(P['torso/tip'][1] > P0['torso/tip'][1] + 0.1); assert.ok(P['cranium/tip'][1] > P0['cranium/tip'][1] + 0.25);
  for (const id of ['torso/st4.front', 'neck/tip', 'cranium/st5.top', 'hornR/tip', 'toothL1R/apex', 'upperArmR/st0.front', 'handL/tip', 'clawH1R/apex']) assert.ok(Math.abs(dist(P[id], P['pelvis/tip']) - dist(P0[id], P0['pelvis/tip'])) < 1e-9, id);
  for (const id of Object.keys(P0)) if (/^(thigh|shin|meta|toes|clawF|pelvis)/.test(id)) assert.deepEqual(P[id], P0[id], id);
});
test('stance widens both legs symmetrically; bulk carries the arms outward with the chest; a claw stretches along its own axis only', () => {
  const P0 = at(compileLayered(recipe)); const S = at(compileLayered(recipe, { stance: 1.3 })); const B = at(compileLayered(recipe, { bulk: 1.3 })); const C = at(compileLayered(recipe, { clawLength: 1.8 }));
  assert.ok(Math.abs(S['toesR/tip'][0] / P0['toesR/tip'][0] - 1.3) < 1e-9); assert.deepEqual(S['torso/st3.sideR'], P0['torso/st3.sideR']);
  assert.ok(Math.abs(B['torso/st3.sideR'][0] / P0['torso/st3.sideR'][0] - 1.3) < 1e-9); assert.ok(Math.abs(B['handR/tip'][0] / P0['handR/tip'][0] - 1.3) < 1e-9); assert.deepEqual(B['thighR/tip'], P0['thighR/tip']);
  const grow = dist(C['clawF1R/apex'], C['clawF1R/root']) / dist(P0['clawF1R/apex'], P0['clawF1R/root']); assert.ok(Math.abs(grow - 1.8) < 1e-6, `claw grew ${grow}`); assert.deepEqual(C['toesR/tip'], P0['toesR/tip']);
});
test('tail chains: each joint stays joined and each segment rigid; curl lifts the tip; sway is antisymmetric in x; grip curls every finger of both hands', () => {
  const P0 = at(compileLayered(recipe)); const C = at(compileLayered(recipe, { tailCurl: 20 })); const Sp = at(compileLayered(recipe, { tailSway: 12 })); const Sn = at(compileLayered(recipe, { tailSway: -12 })); const G = at(compileLayered(recipe, { grip: 40 }));
  for (const P of [C, Sp, G]) for (let k = 0; k < 5; k++) { assert.ok(Math.abs(dist(P[`tail${k}/tip`], P[`tail${k}/back`]) - dist(P0[`tail${k}/tip`], P0[`tail${k}/back`])) < 1e-9, `tail${k} rigid`); if (k) assert.ok(Math.abs(dist(P[`tail${k}/back`], P[`tail${k - 1}/tip`]) - dist(P0[`tail${k}/back`], P0[`tail${k - 1}/tip`])) < 1e-9, `joint ${k} joined`); }
  assert.deepEqual(C['tail0/back'], P0['tail0/back']); assert.ok(C['tail4/tip'][2] > P0['tail4/tip'][2] + 0.5, `tip rose to ${C['tail4/tip'][2]}`);
  assert.ok(Sp['tail4/tip'][0] > 0.4); for (let k = 0; k < 3; k++) assert.ok(Math.abs(Sp['tail4/tip'][k] - (k === 0 ? -1 : 1) * Sn['tail4/tip'][k]) < 1e-9, `sway antisymmetric [${k}]`);
  for (const S of ['R', 'L']) for (const X of ['A', 'B', 'C']) { const tip = `finger${X}2${S}/tip`, kn = `finger${X}1${S}/back`; assert.deepEqual(G[kn], P0[kn], kn); assert.ok(G[tip][1] < P0[tip][1] - 0.05 && G[tip][2] < P0[tip][2] - 0.02, `${tip} curled: ${G[tip]} from ${P0[tip]}`); assert.ok(Math.abs(dist(G[tip], G[kn]) - dist(P0[tip], P0[kn])) > 0.02, `${tip} folded`); }
  for (const id of ['clawH1R/apex', 'clawH1L/apex']) assert.ok(dist(G[id], P0[id]) > 0.05, `${id} rides its finger`);
});
test('the seed reproduces recipe.json byte for byte', () => {
  const before = readFileSync(recipePath); execFileSync(process.execPath, [new URL('./seed-recipe.mjs', import.meta.url).pathname]); assert.ok(before.equals(readFileSync(recipePath)));
});
