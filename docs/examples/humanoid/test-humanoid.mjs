// node --test docs/examples/humanoid/test-humanoid.mjs — the humanoid starter: both presets in every register close,
// the landmark head's jaw hinges by the ear, both eyes read, hair and expression never move a joint.
import test from 'node:test';
import assert from 'node:assert/strict';
import { humanoidPlan, REGISTERS, HAIR_STYLES, EXPRESSIONS } from './humanoid.plan.mjs';
import { humanoidHead } from './head.mjs';
import { expandPlan } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';
import { compileLayered, auditLayered } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { validateRig, bindLayered, rigNodesAt } from '../../../control/lib/graph/polygonizer/station-loft-rig.js';
import { layeredExposure } from '../../../control/lib/graph/polygonizer/station-loft-exposure.js';

const closed = (recipe, dials = {}) => Object.entries(auditLayered(compileLayered(recipe, dials))).filter(([, r]) => !r.pass).map(([n]) => n);

test('male and female close in every register, at rest and at every dial extreme', () => {
  for (const preset of ['male', 'female']) for (const register of Object.keys(REGISTERS)) {
    const recipe = expandPlan(humanoidPlan({ preset, register }));
    const D = recipe.dials; const lo = Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.min])), hi = Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.max]));
    for (const dials of [{}, lo, hi]) assert.deepEqual(closed(recipe, dials), [], `${preset}/${register} ${JSON.stringify(dials)}`);
  }
});

test('the landmark head: the jaw hinges by the ear and the chin drops, both eyes read, the chin clears the collar', () => {
  const recipe = expandPlan(humanoidPlan({ preset: 'male' })); const mesh = compileLayered(recipe); const R = validateRig(recipe.rig); bindLayered(mesh, recipe, R);
  assert.ok(R.joints.jawHinge[1] < 0 && R.joints.jawTip[1] > 0.06, 'the hinge is behind the face, the tip at the chin');
  const { nodes } = rigNodesAt(R, { jaw: 20 }); assert.ok(nodes.jawTip[2] < R.joints.jawTip[2] - 0.02);
  const ex = layeredExposure(mesh, { res: 320 }); for (const eye of ['eyeR', 'eyeL']) assert.equal(ex.parts[eye].flag, 'reads');
  const chin = Math.min(...mesh.pointIds.map((id, i) => (id.startsWith('jaw/') ? mesh.vertices[i][2] : Infinity)));
  assert.ok(chin > recipe.rig.joints.neckHub.at[2] + 0.05, `chin ${chin} above the collar`);
});

test('the female head is narrower than the male beyond her scale; the nose is a narrow wedge that stands forward of the face on both', () => {
  const eyeRow = (h) => h.parts.cranium.stations[4].points, noseRow = (h) => h.parts.cranium.stations[2].points;
  const m = humanoidHead({ preset: 'male' }), f = humanoidHead({ preset: 'female' });
  assert.ok(eyeRow(f).sideR[0] < 0.95 * eyeRow(m).sideR[0], `female head ${eyeRow(f).sideR[0]} vs male ${eyeRow(m).sideR[0]}`);
  for (const h of [m, f]) { const r = noseRow(h); assert.ok(r.noseR[0] < 0.12 * r.sideR[0], 'the ala sits within a tenth of the head width'); assert.ok(r.front[1] - r.innerR[1] > 0.02, `the tip stands ${(r.front[1] - r.innerR[1]).toFixed(3)} forward of the face`); }
});

test('the cheek plane: the outer slot stands furthest forward at the eye row and recedes row by row to the mouth; the eye sits in an orbit under the brow', () => {
  for (const preset of ['male', 'female']) {
    const st = humanoidHead({ preset }).parts.cranium.stations; const cheek = (i) => st[i].points.outerR[1] / st[i].points.innerR[1];
    for (let i = 4; i > 0; i--) assert.ok(cheek(i) > cheek(i - 1) + 0.02, `${preset} row ${i} ${cheek(i).toFixed(3)} ahead of row ${i - 1} ${cheek(i - 1).toFixed(3)}`);
    assert.ok(st[4].points.innerR[1] < st[5].points.innerR[1] - 0.004 && st[4].points.innerR[1] < st[3].points.innerR[1], `${preset} the orbit sits behind the brow and the bridge`);
  }
});

test('hair, expression and face knobs never move a joint; an unknown preset, hair or body control refuses', () => {
  const base = humanoidPlan({ preset: 'female' });
  for (const hair of HAIR_STYLES) for (const expression of Object.keys(EXPRESSIONS)) { const p = humanoidPlan({ preset: 'female', hair, expression, face: { eyeSize: 1.2 } }); assert.deepEqual(p.joints, base.joints); assert.deepEqual(p.rig.joints.hipR, base.rig.joints.hipR); }
  assert.throws(() => humanoidPlan({ preset: 'child' }), /unknown preset/);
  assert.throws(() => humanoidPlan({ hair: 'mohawk' }), /unknown hair/);
  assert.throws(() => humanoidPlan({ body: { tail: 1 } }), /not a body control/);
});
