// node --test docs/examples/ring-plans/test-hero.mjs — the hero form: joints are the vajra rest, the register never
// moves a joint, every cast stands, the rig binds and every clip poses with its planted feet where they were.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { heroPlan, REGISTERS, HERO_CASTS, SCALE, planPath } from './hero.plan.mjs';
import { bakeHero } from '../hero-head/head.mjs';
import { layeredExposure } from '../../../control/lib/graph/polygonizer/station-loft-exposure.js';
import { expandPlan, r6 } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';
import { compileLayered, auditLayered } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered, layeredClip, VAJRA_CORE } from '../../../control/lib/graph/polygonizer/station-loft-rig.js';
import { castArmature, CAST_PRESET_NAMES } from '../../../control/lib/graph/polygonizer/figure-cast.js';

const closed = (recipe, dials = {}) => { const m = compileLayered(recipe, dials); return Object.entries(auditLayered(m)).filter(([, r]) => !r.pass).map(([n]) => n); };

test('hero.plan.json is the canonical hero, byte for byte', () => {
  assert.equal(readFileSync(planPath, 'utf8'), JSON.stringify(heroPlan(), null, 1) + '\n');
});

test('the rig core is the vajra rest skeleton of the cast, in metres', () => {
  for (const cast of ['canonical', 'heroic', 'chibi']) {
    const plan = heroPlan({ cast }); const m = castArmature(cast); const recipe = expandPlan(plan);
    for (const k of VAJRA_CORE) assert.deepEqual(recipe.rig.joints[k].at ?? recipe.rig.joints[k], [m[k].x, m[k].y, m[k].z].map((v) => r6(v * SCALE)), `${cast} ${k}`);
  }
});

test('the female cast independently balances a relaxed yoke, integrated chest and wider pelvic mass', () => {
  const male = heroPlan({ cast: 'male' }), female = heroPlan({ cast: 'female' });
  const scale = HERO_CASTS.female.scale, m = castArmature(HERO_CASTS.female.dials), FJ = expandPlan(female).rig.joints;
  for (const k of VAJRA_CORE) {
    const actual = FJ[k].at ?? FJ[k], expected = [m[k].x, m[k].y, m[k].z].map((v) => r6(v * SCALE * scale));
    assert.ok(actual.every((v, i) => Math.abs(v - expected[i]) < 2e-6), `${k}: ${actual} vs ${expected}`);
  }
  const height = (plan) => { const zs = compileLayered(expandPlan(plan)).vertices.map((v) => v[2]); return Math.max(...zs) - Math.min(...zs); };
  assert.ok(height(female) / height(male) > 0.94 && height(female) / height(male) < 0.97, `${height(female)} / ${height(male)}`);
  const width = (plan, part, st) => { const pts = Object.values(expandPlan(plan).parts[part].stations.find((s) => s.id === st).points); return Math.max(...pts.map((p) => p[0])); };
  assert.ok(width(female, 'torso', 'st3') / scale < 0.86 * width(male, 'torso', 'st3'), 'the relaxed female yoke is narrower beyond uniform scale');
  assert.ok(width(female, 'thighR', 'st1') / scale > width(male, 'thighR', 'st1'), 'the pelvic mass is independently wider beyond uniform scale');
  assert.ok(width(female, 'torso', 'st0') < width(female, 'thighR', 'st1') && width(female, 'torso', 'st0') < width(female, 'torso', 'st2'), 'waist separates chest from pelvis');
  // Both casts fill through the centre at the crest and hip rings. The female carries the width in flesh
  // around a restrained vajra socket, so her legs do not need a broad stance to make a pelvic silhouette.
  for (const plan of [male, female]) for (const st of ['st0', 'st1']) {
    const xs = Object.values(expandPlan(plan).parts.thighR.stations.find((s) => s.id === st).points).map((p) => p[0]);
    assert.ok(Math.min(...xs) < -0.005, `${st} crosses the mirror plane by ${(-Math.min(...xs)).toFixed(3)}: the pelvis is filled through the middle`);
  }
  const span = (plan, part, st, axis) => { const pts = Object.values(expandPlan(plan).parts[part].stations.find((s) => s.id === st).points).map((p) => p[axis]); return Math.max(...pts) - Math.min(...pts); };
  assert.ok(span(female, 'torso', 'st2', 1) > span(female, 'torso', 'st0', 1) * 1.25, 'chest volume is integrated into the torso envelope');
  assert.ok(span(female, 'neck', 'st1', 0) < span(male, 'neck', 'st1', 0) && span(female, 'shankR', 'st1', 0) < span(male, 'shankR', 'st1', 0), 'neck and calf remain lighter');
  assert.ok(width(heroPlan({ cast: 'male', body: { calf: 0.06 } }), 'shankR', 'st1') < width(male, 'shankR', 'st1'), 'calf is a body control');
  const shallow = heroPlan({ cast: 'female', body: { hipDepth: 0.08 } }), deep = heroPlan({ cast: 'female', body: { hipDepth: 0.14 } });
  assert.ok(span(shallow, 'thighR', 'st1', 1) < span(deep, 'thighR', 'st1', 1) * 0.75, 'hipDepth changes profile without changing pelvic width');
  assert.ok(Math.abs(width(shallow, 'thighR', 'st1') - width(deep, 'thighR', 'st1')) < 0.001, 'hipDepth leaves frontal width alone');
  const recipe = expandPlan(female); assert.ok(!recipe.parts.bustR && !recipe.parts.bustL && !expandPlan(male).parts.bustR && !expandPlan(heroPlan()).parts.bustR);
  assert.throws(() => heroPlan({ cast: 'female', body: { bust: -1 } }), /not a body control/); assert.throws(() => heroPlan({ scale: 0 }), /scale/);
  const optionalBust = expandPlan(heroPlan({ cast: 'female', body: { bust: 0.05 } }));
  assert.equal(optionalBust.parts.bustR.stations.length, 4);
  assert.ok(optionalBust.dials.bulk.parts.includes('bustL') && optionalBust.dials.lean.parts.includes('bustR'));
});

test('a register changes every ring through the style block and no joint', () => {
  const base = heroPlan({ register: 'round' });
  for (const register of Object.keys(REGISTERS)) {
    const plan = heroPlan({ register }); assert.deepEqual(plan.joints, base.joints); assert.deepEqual(plan.rig.joints, base.rig.joints); assert.deepEqual(plan.style, REGISTERS[register]);
    const recipe = expandPlan(plan); assert.deepEqual(closed(recipe), []);
  }
  const box = expandPlan(heroPlan({ register: 'box' })); const round = expandPlan(base);
  assert.notEqual(JSON.stringify(box.parts.torso.stations), JSON.stringify(round.parts.torso.stations));
});

test('every cast preset (figure-cast and the hero\'s own) expands, closes at rest and at every dial extreme, and its feet stay on the ground', () => {
  for (const cast of [...CAST_PRESET_NAMES, ...Object.keys(HERO_CASTS)]) {
    const recipe = expandPlan(heroPlan({ cast, headScale: cast === 'chibi' ? 1.3 : 1 }));
    const D = recipe.dials; const lo = Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.min])), hi = Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.max]));
    for (const dials of [{}, lo, hi]) assert.deepEqual(closed(recipe, dials), [], `${cast} ${JSON.stringify(dials)}`);
    const zs = compileLayered(recipe).vertices.map((v) => v[2]); assert.ok(Math.min(...zs) > -0.02 && Math.min(...zs) < 0.02, `${cast} sole ${Math.min(...zs)}`);
  }
});

test('the rig binds and every clip key poses with planted feet at their rest and no reach error', () => {
  const recipe = expandPlan(heroPlan({ cast: 'heroic' })); const mesh = compileLayered(recipe); const R = validateRig(recipe.rig); const skin = bindLayered(mesh, recipe, R);
  for (const [name, keys] of Object.entries(recipe.clips)) {
    const f = layeredClip(keys, R);
    for (const ph of [0, 0.25, 0.5, 0.75]) {
      const { nodes, report } = rigNodesAt(R, f(ph)); const posed = skinLayered(mesh, skin, boneFrames(R, R.joints, nodes));
      assert.equal(posed.length, mesh.vertices.length);
      for (const S of ['R', 'L']) { assert.equal(report.legs[S].metaError, 0, `${name}@${ph} ${S}`); if (report.legs[S].planted) assert.deepEqual(nodes[`toeBase${S}`], R.joints[`toeBase${S}`]); }
    }
  }
});

test('the hero wears the baked head: it closes at every dial extreme, the jaw chain opens the jaw, the eyes read from the front and the hair from the back', () => {
  const head = bakeHero({ hair: ['cap', 'bangs'] }); const plan = heroPlan({ cast: 'heroic', register: 'chamfer', head }); const recipe = expandPlan(plan);
  assert.ok(!recipe.parts.head && !recipe.parts.pelvis && recipe.parts.thighR && recipe.parts.cranium && recipe.parts.jaw && recipe.parts.eyeR && recipe.parts.eyeL);
  assert.deepEqual(Object.keys(recipe.dials), ['jawOpen', 'bulk', 'stance', 'lean']);
  const D = recipe.dials; const lo = Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.min])), hi = Object.fromEntries(Object.entries(D).map(([k, s]) => [k, s.max]));
  for (const dials of [{}, lo, hi]) assert.deepEqual(closed(recipe, dials), [], JSON.stringify(dials));
  const mesh = compileLayered(recipe); const R = validateRig(recipe.rig); const skin = bindLayered(mesh, recipe, R);
  const { nodes } = rigNodesAt(R, { jaw: 20 }); assert.ok(Math.hypot(...nodes.jawTip.map((v, i) => v - R.joints.jawTip[i])) > 0.02); assert.deepEqual(nodes.jawHinge, R.joints.jawHinge);
  assert.equal(skinLayered(mesh, skin, boneFrames(R, R.joints, nodes)).length, mesh.vertices.length);
  const ex = layeredExposure(mesh, { res: 384 });
  for (const eye of ['eyeR', 'eyeL']) { assert.equal(ex.parts[eye].flag, 'reads', `${eye} ${JSON.stringify(ex.parts[eye])}`); assert.ok(ex.parts[eye].visible.frontal >= 0.25 && ex.parts[eye].visible['three-quarter'] + ex.parts[eye].visible['three-quarter-left'] > 0.25, JSON.stringify(ex.parts[eye].visible)); }
  const hair = Object.entries(ex.parts).filter(([k]) => k.startsWith('tile0')); assert.ok(hair.length >= 20);
  assert.ok(hair.filter(([, p]) => p.visible.back >= 0.25).length >= hair.length / 3, 'the cap reads from the back');
});
