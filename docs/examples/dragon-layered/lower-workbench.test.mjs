import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, loadRecipe, DIALS } from './compile.mjs';
import { lowerToWorkbench } from './lower-workbench.mjs';
import { loftToFaces } from '../../../control/lib/graph/polygonizer/loft-faces.js';
import { auditClosure } from '../../../control/lib/graph/polygonizer/face-closure.js';
const recipe = loadRecipe();
const EXTREMES = [{}, Object.fromEntries(Object.entries(DIALS).map(([k, s]) => [k, s.min])), Object.fromEntries(Object.entries(DIALS).map(([k, s]) => [k, s.max])), { jawOpen: 30, snoutLength: 1.3 }];
const bake = (loft) => loftToFaces(loft, {});
const nearest = (p, pts) => Math.min(...pts.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])));

test('every lowered monomer bakes to a CLOSED shell through loft-faces at baseline and every dial extreme', () => {
  for (const dials of EXTREMES) { const { spec } = lowerToWorkbench(compile(recipe, dials));
    for (const loft of spec.lofts) { const faces = bake(loft); assert.ok(faces.length > 0, loft.id); const a = auditClosure(faces); assert.ok(a.closed && a.boundaryEdgeCount === 0, `${loft.id} at ${JSON.stringify(dials)}: ${JSON.stringify(a)}`); } }
});
test('L1 stations reproduce the compiled ring points exactly; L2 lowering error is measured and bounded', () => {
  for (const dials of EXTREMES) { const mesh = compile(recipe, dials); const { spec, loweringError } = lowerToWorkbench(mesh);
    assert.ok(loweringError.cranium < 1e-9 && loweringError.jaw < 1e-9, JSON.stringify(loweringError));
    for (const [name, err] of Object.entries(loweringError)) assert.ok(err < (name.startsWith('horn') ? 0.005 : 1e-9), `${name} lowering error ${err} m`);
    for (const part of ['cranium', 'jaw']) { const loft = spec.lofts.find((l) => l.id === part); const baked = bake(loft); const verts = baked.flatMap((f) => f.corners);
      for (const [id, p] of Object.entries(mesh.parts[part].points)) { const q = [p[0], p[1], p[2] - (lowerToWorkbench(mesh).seatedFrom ?? 0)]; assert.ok(nearest(q, verts) < 2e-6, `${id} not on the baked loft (${nearest(q, verts)})`); } } }
});
test('an opened jaw lowers on its rotated axis (the loft path follows the hinge)', () => {
  const closed = lowerToWorkbench(compile(recipe)).spec.lofts.find((l) => l.id === 'jaw'); const open = lowerToWorkbench(compile(recipe, { jawOpen: 30 })).spec.lofts.find((l) => l.id === 'jaw');
  const dir = (l) => { const [a, b] = l.path; const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const n = Math.hypot(...d); return d.map((x) => x / n); };
  const c = dir(closed), o = dir(open); const angle = Math.acos(Math.min(1, c[0] * o[0] + c[1] * o[1] + c[2] * o[2])) * 180 / Math.PI;
  assert.ok(Math.abs(angle - 30) < 1e-3, `jaw axis turned ${angle}°`); assert.ok(o[2] < c[2]);
});
test('seated by default: the lowest baked point sits on the grid; seat:false keeps the neck-height origin', () => {
  const mesh = compile(recipe); const seated = lowerToWorkbench(mesh); const raw = lowerToWorkbench(mesh, { seat: false });
  const minZ = (spec) => Math.min(...spec.lofts.flatMap((l) => bake(l).flatMap((f) => f.corners.map((c) => c[2]))));
  assert.ok(Math.abs(minZ(seated.spec)) < 1e-6, `seated min z ${minZ(seated.spec)}`); assert.ok(minZ(raw.spec) > 1.5); assert.equal(raw.seatedFrom, null); assert.ok(seated.seatedFrom > 1.5);
});
test('the spec is workbench-shaped, deterministic, and names every part as a patchable id', () => {
  const a = lowerToWorkbench(compile(recipe)), b = lowerToWorkbench(compile(recipe)); assert.deepEqual(a, b);
  assert.equal(a.spec.units, 'm'); assert.ok(a.spec.lofts.every((l) => l.id && l.group === l.id && l.stations.length >= 2 && l.stations.every((s) => s.profile.length === l.stations[0].profile.length)));
  assert.deepEqual(a.omitted.sort(), ['nostrilL', 'nostrilR']); assert.equal(a.spec.lofts.length, 19);
  const flat = lowerToWorkbench(compile(recipe, { crestHeight: 0 })); assert.deepEqual(flat.omitted.sort(), ['crest1', 'crest2', 'crest3', 'nostrilL', 'nostrilR']);
});
