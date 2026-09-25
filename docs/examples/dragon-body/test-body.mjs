// node --test docs/examples/dragon-body/test-body.mjs — the machine gate for the body recipe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { compileLayered, auditLayered, mirrorPid } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { lowerLayeredToWorkbench } from '../../../control/lib/graph/polygonizer/station-loft-workbench.js';
import { loftToFaces } from '../../../control/lib/graph/polygonizer/loft-faces.js';
import { auditClosure } from '../../../control/lib/graph/polygonizer/face-closure.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames, skinLayered, auditRig, packLayeredRig, layeredClip } from '../../../control/lib/graph/polygonizer/station-loft-rig.js';
import { facesToGlb } from '../../../control/lib/graph/scene/scene-gltf.js';
import { recipePath, HEAD_SHIFT, HEAD_EXPRESSION, mirrorId, mirrorPartName } from './seed-recipe.mjs';
import { HEADS, EXPRESSIONS, bakeLayered } from '../head-detail/compile.mjs';
import { headSeam } from '../../../control/lib/graph/polygonizer/station-loft-head.js';

const recipe = JSON.parse(readFileSync(recipePath, 'utf8')); const head = bakeLayered(HEADS.dragon, EXPRESSIONS[HEAD_EXPRESSION]);
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
test('the loft library form: every loft-shaped part lowers closed and exact; the detail parts are omitted; seated with the soles on the grid at rest', () => {
  for (const dials of EXTREMES) { const m = compileLayered(recipe, dials); const { spec, loweringError, omitted, seatedFrom } = lowerLayeredToWorkbench(m);
    for (const [name, err] of Object.entries(loweringError)) if (!recipe.parts[name].pin || recipe.parts[name].loft) assert.ok(err < (name.startsWith('horn') ? 0.005 : 2e-6), `${name} lowering error ${err} m at ${JSON.stringify(dials)}`);   // recipe coordinates are rounded to the micrometre
    for (const loft of spec.lofts) { const faces = loftToFaces(loft, {}); const a = auditClosure(faces); assert.ok(a.closed && a.boundaryEdgeCount === 0, `${loft.id} ${JSON.stringify(a)}`); assert.ok(signedVolume(faces) > 0, `${loft.id} bakes inside out`); }
    assert.ok(omitted.length > 100, `the loft form omits the detail parts it cannot express (${omitted.length})`);   // the kind renders the mesh; the loft lowering is a library form
    if (!Object.keys(dials).length) assert.ok(Math.abs(seatedFrom ?? 0) < 0.02, `rest sole at ${seatedFrom}`); }
});
test('the detailed head rides along: every baked head point is the bake translated by HEAD_SHIFT; head dials unchanged but for the shifted pivot', () => {
  const body = at(compileLayered(recipe)); const baked = at(compileLayered({ frame: {}, parts: head.parts, dials: head.dials, creases: head.creases }));
  let n = 0; for (const [id, v] of Object.entries(baked)) { assert.ok(body[id], id); for (let k = 0; k < 3; k++) assert.ok(Math.abs(body[id][k] - (v[k] + HEAD_SHIFT[k])) < 5e-6, `${id}[${k}]`); n++; }
  assert.ok(n > 3000, `head points ${n}`); for (const p of ['eyeR', 'surroundL', 'browR', 'tongue.0', 'webL', 'nostrilR']) assert.ok(recipe.parts[p], p);
  for (const [k, d] of Object.entries(head.dials)) { const b = recipe.dials[k]; assert.ok(b, k); if (d.op === 'scale') assert.ok(Math.abs(b.pivot - (d.pivot + HEAD_SHIFT[['x', 'y', 'z'].indexOf(d.axis)])) < 1e-9, k); else assert.deepEqual(b, d); }
});
test('lean hinges the torso, arms, neck and head forward about the pelvis tip; the legs stay planted', () => {
  const P0 = at(compileLayered(recipe)); const P = at(compileLayered(recipe, { lean: 20 }));
  assert.deepEqual(P['pelvis/tip'], P0['pelvis/tip']); assert.ok(P['torso/tip'][1] > P0['torso/tip'][1] + 0.1); assert.ok(P['cranium/tip'][1] > P0['cranium/tip'][1] + 0.25);
  for (const id of ['torso/st4.front', 'neck/tip', 'cranium/st5.top', 'hornR/tip', 'tongue.0/st3.s2', 'eyeR/tip', 'upperArmR/st0.front', 'handL/tip', 'clawH1R/apex']) assert.ok(Math.abs(dist(P[id], P['pelvis/tip']) - dist(P0[id], P0['pelvis/tip'])) < 1e-9, id);
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
test('rig: every L1 part binds by declaration, details inherit, rest skinning is identity, every clip keypose keeps toes planted and bone lengths', () => {
  const mesh = compileLayered(recipe); const R = validateRig(recipe.rig); const skin = bindLayered(mesh, recipe, R);
  const poses = Object.values(recipe.clips).flat(); const a = auditRig(mesh, skin, R, poses);
  assert.equal(a.badWeights, 0); assert.ok(a.restIdentity < 1e-12, `rest identity ${a.restIdentity}`); assert.ok(a.maxLengthError < 1e-9); assert.ok(a.maxOrthoError < 1e-9); assert.equal(a.maxPlantedDrift, 0); assert.ok(a.blended > 200, `blended ${a.blended}`);
  for (const p of a.poses) for (const S of ['L', 'R']) assert.equal(p.legs[S].reach, 'ok', JSON.stringify(p.pose));
  const bi = (part) => skin.joints[mesh.provenance.findIndex((p) => p.part === part)][0];
  assert.equal(R.bones[bi('toothL.0R')].id, 'jaw'); assert.equal(R.bones[bi('tongue.0')].id, 'jaw'); assert.equal(R.bones[bi('eyeR')].id, 'head'); assert.equal(R.bones[bi('surroundL')].id, 'head'); assert.equal(R.bones[bi('hornR')].id, 'head'); assert.equal(R.bones[bi('clawF1L')].id, 'toesL'); assert.equal(R.bones[bi('clawH0R')].id, 'fingerA2R');
});
test('rig: the crouch drops the pelvis with the toes planted and the knees forward; the roar opens the jaw and lifts the head; mirrored legs mirror', () => {
  const R = validateRig(recipe.rig); const rest = R.joints; const c = rigNodesAt(R, recipe.clips.crouch[1]).nodes; const r = rigNodesAt(R, recipe.clips.roar[1]).nodes;
  assert.ok(c.pelvisHub[2] < rest.pelvisHub[2] - 0.15); assert.deepEqual(c.toeBaseR, rest.toeBaseR); assert.deepEqual(c.toeTipL, rest.toeTipL); assert.ok(c.kneeR[1] > rest.kneeR[1]);
  for (const k of ['knee', 'ankle', 'toeBase', 'toeTip']) assert.deepEqual(c[`${k}L`].map((x) => +x.toFixed(9)), [-c[`${k}R`][0] + 0, c[`${k}R`][1], c[`${k}R`][2]].map((x) => +x.toFixed(9)), k);
  assert.ok(dist(r.jawTip, r.jawHinge) - dist(rest.jawTip, rest.jawHinge) < 1e-9); assert.ok(r.jawTip[2] < rigNodesAt(R, { ...recipe.clips.roar[1], jaw: 0 }).nodes.jawTip[2] - 0.05, 'jaw opened');
  assert.ok(r.headTop[2] > rest.headTop[2] + 0.1, 'head lifted'); assert.ok(r.tail5[2] > 0, 'the roar tail stays above the floor');
  assert.throws(() => rigNodesAt(R, { heelR: 180 }), /cannot reach/);
});
test('rig: the packed figure exports as a skinned GLB whose engine-side skin matches the JS skin at three keys of every clip', () => {
  const mesh = compileLayered(recipe); const R = validateRig(recipe.rig); const skin = bindLayered(mesh, recipe, R); const KEYS = 6;
  const fig = packLayeredRig(mesh, skin, R, { clips: recipe.clips, keys: KEYS }); assert.deepEqual(packLayeredRig(mesh, skin, R, { clips: recipe.clips, keys: KEYS }), fig);
  const glb = facesToGlb({ faces: [], figures: { dragon: fig } }, { generator: 'test', clips: '_all', skinned: true }).bytes;
  const jsonLen = glb.readUInt32LE(12); const j = JSON.parse(glb.subarray(20, 20 + jsonLen).toString()); const bin = glb.subarray(20 + jsonLen + 8);
  const acc = (i) => { const a = j.accessors[i]; const bv = j.bufferViews[a.bufferView]; const off = (bv.byteOffset || 0) + (a.byteOffset || 0); const n = { 5126: 4, 5123: 2, 5121: 1 }[a.componentType]; const comps = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type]; const rows = []; for (let k = 0; k < a.count; k++) { const r = []; for (let c = 0; c < comps; c++) { const p = off + (k * comps + c) * n; r.push(a.componentType === 5126 ? bin.readFloatLE(p) : a.componentType === 5123 ? bin.readUInt16LE(p) : bin.readUInt8(p)); } rows.push(r); } return rows; };
  const skinJ = j.skins[0]; const prim = j.meshes.find((m) => m.name === 'dragon:skinned').primitives[0]; assert.equal(skinJ.joints.length, R.bones.length);
  const POS = acc(prim.attributes.POSITION), JNT = acc(prim.attributes.JOINTS_0), WGT = acc(prim.attributes.WEIGHTS_0), IBM = acc(skinJ.inverseBindMatrices);
  assert.ok(WGT.every((w) => Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-5 && w.every((x) => x >= 0))); assert.ok(JNT.every((r) => r.every((x) => x < skinJ.joints.length)));
  const qrot = (q, v) => { const [qx, qy, qz, qw] = q; const [vx, vy, vz] = v; const tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx); return [vx + qw * tx + (qy * tz - qz * ty), vy + qw * ty + (qz * tx - qx * tz), vz + qw * tz + (qx * ty - qy * tx)]; };
  const restIdx = POS.map((p) => { let best = 0, bd = Infinity; mesh.vertices.forEach((v, i) => { const d = dist(p, v); if (d < bd) { bd = d; best = i; } }); return best; });
  let worst = 0;
  for (const anim of j.animations) { const rot = new Map(), tr = new Map(); for (const ch of anim.channels) { const s = anim.samplers[ch.sampler]; (ch.target.path === 'rotation' ? rot : tr).set(ch.target.node, acc(s.output)); }
    const clipFn = layeredClip(recipe.clips[anim.name.replace(/^dragon:/, '')], R);
    for (const k of [0, 2, 4]) { const engine = POS.map((v, i) => { const out = [0, 0, 0]; for (let c = 0; c < 4; c++) { const w = WGT[i][c]; if (w <= 0) continue; const bi = JNT[i][c]; const ni = skinJ.joints[bi]; const q = rot.get(ni)[k], t = tr.get(ni)[k]; const local = [v[0] + IBM[bi][12], v[1] + IBM[bi][13], v[2] + IBM[bi][14]]; const p = qrot(q, local); for (let c2 = 0; c2 < 3; c2++) out[c2] += w * (p[c2] + t[c2]); } return out; });
      const js = skinLayered(mesh, skin, boneFrames(R, R.joints, rigNodesAt(R, clipFn(k / KEYS)).nodes)); engine.forEach((p, i) => { worst = Math.max(worst, dist(p, js[restIdx[i]])); } ); } }
  assert.ok(worst < 2e-3, `engine vs JS skin ${worst} m`);   // the packed clips round q and head to 1e-4
});
test('the seed reproduces recipe.json byte for byte', () => {
  const before = readFileSync(recipePath); execFileSync(process.execPath, [new URL('./seed-recipe.mjs', import.meta.url).pathname]); assert.ok(before.equals(readFileSync(recipePath)));
});

test('the head is worn by name and sealed: nape on neckTop, rig joints read from the head, and the neck buried in the skull at every dial extreme', () => {
  const plan = JSON.parse(readFileSync(new URL('../head-detail/heads/dragon.head.json', import.meta.url), 'utf8'));
  const cap = recipe.parts.cranium.caps.tip; assert.deepEqual(recipe.rig.joints.headTop.at, cap);
  const J = recipe.parts.jaw.stations.find((s) => s.id === 'st0').points.gum; assert.deepEqual(recipe.rig.joints.jawHinge.at, J);
  assert.deepEqual(recipe.rig.joints.jawTip.at, recipe.parts.jaw.caps.tip);
  assert.deepEqual(HEAD_SHIFT, plan.landmarks.nape.map((v, i) => Math.round((recipe.rig.joints.headBase.at[i] - v) * 1e6) / 1e6 + 0));
  const sets = [{}, ...Object.entries(recipe.dials).flatMap(([k, d]) => (Number.isFinite(d.min) && Number.isFinite(d.max) ? [{ [k]: d.min }, { [k]: d.max }] : [])), { jawOpen: 35, lean: 25, skullWidth: 0.8 }];
  for (const d of sets) { const s = headSeam(compileLayered(recipe, d), { neck: 'neck' }); assert.ok(s.sealed, `${JSON.stringify(d)}: ${s.inside}/${s.points} of the neck's top ring inside the head`); }
});

test('a detail pinned on a head detail (L3 on L2) rides its host\'s bone', () => {
  const r = JSON.parse(JSON.stringify(recipe)); const host = r.parts.hornR; const face = Object.keys(host.faces)[0]; const tri = host.faces[face];
  r.parts.hornBand = { layer: 3, closure: 'closed', group: 'Band', pin: { parent: 'hornR', face, weights: [1 / 3, 1 / 3, 1 / 3], tangentEdge: [tri[0], tri[1]], handedness: 1 },
    offsets: { a: [0.01, 0, 0.005], b: [-0.005, 0.009, 0.005], c: [-0.005, -0.009, 0.005], d: [0, 0, 0.02] }, faces: { f0: ['a', 'c', 'b'], f1: ['a', 'b', 'd'], f2: ['b', 'c', 'd'], f3: ['c', 'a', 'd'] }, groups: { f0: 'Band', f1: 'Band', f2: 'Band', f3: 'Band' } };
  const m = compileLayered(r, {}); const R = validateRig(r.rig); const sk = bindLayered(m, r, R); const i = m.provenance.findIndex((p) => p.part === 'hornBand');
  assert.equal(sk.joints[i][0], R.boneIndex.head); assert.ok(Math.abs(sk.weights[i][0] - 1) < 1e-12);
});
