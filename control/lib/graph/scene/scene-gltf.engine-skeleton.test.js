// The engine skeleton (docs/emote-bridge.md phase 4): a T-pose humanoid written nested on the VRM tree, in the VRM space
// (y up, facing +z, the left on +x), every clip parent-local — and composing it back gives the same world motion.
import { describe, expect, it } from 'vitest';

import { facesToGlb } from './scene-gltf.js';
import { parseGlb } from './scene-gltf-read.js';
import { assembleFigureScene } from '../figures/figure-world.js';
import { tposeRig, vrmSpacePack, humanoidParents, withClavicles, withTrunkJoints, withProfileJoints } from '../figures/rig-tpose.js';
import { humanoidBonesFor } from '../polygonizer/figure-humanoid-map.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

function accessor(json, bin, idx) {
  const acc = json.accessors[idx], view = json.bufferViews[acc.bufferView];
  const Ctor = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[acc.componentType];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[acc.type];
  const start = (view.byteOffset || 0) + (acc.byteOffset || 0), n = acc.count * comps;
  return new Ctor(Uint8Array.from(bin.subarray(start, start + n * Ctor.BYTES_PER_ELEMENT)).buffer);
}
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qrot = (q, v) => { const u = [q[0], q[1], q[2]], c = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; const t = c(u, v).map((x) => 2 * x), ct = c(u, t); return [v[0] + q[3] * t[0] + ct[0], v[1] + q[3] * t[1] + ct[1], v[2] + q[3] * t[2] + ct[2]]; };
// the angle between two rotations; normalized first (the pack's keys are rounded to four decimals, slightly off unit)
const qangle = (a, b) => { const na = Math.hypot(...a), nb = Math.hypot(...b); return 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]) / (na * nb))) * 180 / Math.PI; };

const flatT = Object.values(assembleFigureScene({ motion: { emote: 'bow' } }, { tpose: true }).figures)[0];

function checkEngineSkeleton(packed) {
  const { json, bin } = parseGlb(facesToGlb({ faces: [], figures: { f: packed } }, { clips: '_all', skinned: true, humanoid: true }).bytes);
  const fig = withProfileJoints(packed);   // the engine skeleton's bones: the pack's, its trunk joints and its clavicles
  const skin = json.skins[0], joints = skin.joints, parents = humanoidParents(fig.bones), V = vrmSpacePack(fig);
  const parentNode = new Map();
  json.nodes.forEach((n, i) => (n.children || []).forEach((c) => parentNode.set(c, i)));
  // nested on the VRM tree; the roots (the hips) under the wrapper, which cancels the root's z-up → y-up
  joints.forEach((node, bi) => { if (parents[bi] >= 0) expect(parentNode.get(node)).toBe(joints[parents[bi]]); });
  const wrap = json.nodes[parentNode.get(joints[parents.indexOf(-1)])], root = json.nodes[parentNode.get(json.nodes.indexOf(wrap))];
  const net = qmul(root.rotation, wrap.rotation);
  expect(qangle(net, [0, 0, 0, 1])).toBeLessThan(1e-4);
  // the T rest: no joint rotation; offsets that sum to the VRM-space heads
  const restHead = (bi) => (bi < 0 ? [0, 0, 0] : (() => { const p = restHead(parents[bi]), t = json.nodes[joints[bi]].translation; return [p[0] + t[0], p[1] + t[1], p[2] + t[2]]; })());
  fig.bones.forEach((_, bi) => {
    expect(json.nodes[joints[bi]].rotation).toBeUndefined();
    restHead(bi).forEach((c, a) => expect(c).toBeCloseTo(V.bones[bi].head[a], 5));
  });
  // the VRM leaves sit under their bone
  const { leaves } = humanoidBonesFor(V.bones);
  for (const l of leaves) expect(parentNode.get(json.nodes.findIndex((n) => n.name === `f:${l.vrm}`))).toBe(joints[l.parent]);
  // every clip, composed back down the chain, is the world motion of the pack (in the VRM space)
  let worstH = 0, worstQ = 0;
  for (const anim of json.animations) {
    const clip = V.clips[anim.name.slice(2)];
    if (!clip) continue;
    const local = new Map();   // node → { r: [keys × 4], t: [keys × 3] }
    for (const ch of anim.channels) {
      const out = accessor(json, bin, anim.samplers[ch.sampler].output);
      const e = local.get(ch.target.node) || {}; e[ch.target.path === 'rotation' ? 'r' : 't'] = out; local.set(ch.target.node, e);
    }
    const nb = fig.bones.length;
    for (let k = 0; k < clip.k; k++) {
      const world = new Array(nb);
      const solve = (bi) => {
        if (world[bi]) return world[bi];
        const L = local.get(joints[bi]), r = Array.from(L.r.slice(4 * k, 4 * k + 4)), t = Array.from(L.t.slice(3 * k, 3 * k + 3));
        if (parents[bi] < 0) return (world[bi] = { q: r, h: t });
        const P = solve(parents[bi]), d = qrot(P.q, t);
        return (world[bi] = { q: qmul(P.q, r), h: [P.h[0] + d[0], P.h[1] + d[1], P.h[2] + d[2]] });
      };
      for (let bi = 0; bi < nb; bi++) {
        const w = solve(bi), o = (k * nb + bi) * 7;
        worstQ = Math.max(worstQ, qangle(w.q, clip.b.slice(o, o + 4)));
        worstH = Math.max(worstH, Math.hypot(w.h[0] - clip.b[o + 4], w.h[1] - clip.b[o + 5], w.h[2] - clip.b[o + 6]));
      }
    }
  }
  expect(worstQ).toBeLessThan(0.05);    // degrees (float32 keys down a chain)
  expect(worstH).toBeLessThan(1e-4);    // metres
  return json;
}

describe('the engine skeleton', () => {
  it('the flat figure in T: nested, in the VRM space, every clip composes to the same world motion', () => {
    checkEngineSkeleton(flatT);
  });

  it('the VRM space: up is +y, the figure faces +z, its left arm reaches +x', () => {
    const V = vrmSpacePack(flatT), { names } = humanoidBonesFor(V.bones), by = Object.fromEntries([...names].map(([i, v]) => [v, V.bones[i]]));
    expect(by.head.head[1]).toBeGreaterThan(by.hips.head[1]);
    expect(by.leftUpperArm.tail[0]).toBeGreaterThan(by.leftUpperArm.head[0]);
    expect(by.rightUpperArm.tail[0]).toBeLessThan(by.rightUpperArm.head[0]);
  });

  it('the clavicles: weightless shoulders between the chest and the upper arms, riding the chest in every key', () => {
    const C = withClavicles(flatT), { names } = humanoidBonesFor(C.bones), by = Object.fromEntries([...names].map(([i, v]) => [v, i]));
    expect(C.bones.length).toBe(flatT.bones.length + 2);
    expect(C.parts.slice(-2)).toEqual([null, null]);
    expect(humanoidParents(C.bones)[by.leftUpperArm]).toBe(by.leftShoulder);
    expect(C.bones[by.leftShoulder].tail).toEqual(C.bones[by.leftUpperArm].head);
    expect(withClavicles(C)).toBe(C);
  });

  it('the trunk joints: the flat figure\'s spine split into spine, chest and upper chest; its own motion unchanged', () => {
    const T = withTrunkJoints(flatT), { names } = humanoidBonesFor(T.bones), by = Object.fromEntries([...names].map(([i, v]) => [v, i]));
    expect(T.bones.length).toBe(flatT.bones.length + 2);
    expect(humanoidParents(T.bones)[by.upperChest]).toBe(by.chest);
    expect(humanoidParents(T.bones)[by.head]).toBe(by.upperChest);
    expect(humanoidParents(withProfileJoints(flatT).bones)[by.upperChest + 1]).toBe(by.upperChest);   // a clavicle hangs off it
    // the torso part now carries weights over the chain, each vertex summing to 1, the chest and upper chest among them
    const P = T.parts[by.spine], j = Uint8Array.from(Buffer.from(P.jnt, 'base64')), w = new Float32Array(Uint8Array.from(Buffer.from(P.wgt, 'base64')).buffer);
    const used = new Set();
    for (let k = 0; k < j.length / 4; k++) { let s = 0; for (let a = 0; a < 4; a++) { s += w[4 * k + a]; if (w[4 * k + a] > 0) used.add(j[4 * k + a]); } expect(s).toBeCloseTo(1, 5); }
    expect([...used].sort()).toEqual([by.spine, by.chest, by.upperChest].sort());
    // the new joints ride the spine: in every key of the pack's own clip they carry its rotation
    const nb = T.bones.length, c = Object.values(T.clips)[0];
    for (let k = 0; k < c.k; k++) for (const v of [by.chest, by.upperChest]) expect(c.b.slice((k * nb + v) * 7, (k * nb + v) * 7 + 4)).toEqual(c.b.slice((k * nb + by.spine) * 7, (k * nb + by.spine) * 7 + 4));
    expect(withTrunkJoints(T)).toBe(T);
  });

  it('a pack without the T-pose keeps the flat skeleton, byte for byte as before', () => {
    const { tpose, ...plain } = flatT;
    const a = facesToGlb({ faces: [], figures: { f: plain } }, { clips: '_all', skinned: true, humanoid: true });
    const { json } = parseGlb(a.bytes);
    for (const j of json.skins[0].joints) expect(json.nodes[j].children).toBeUndefined();
  });

  it('a hero in T: the same, with fingers and toes on the tree', { timeout: 120000 }, async () => {
    const manifest = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', gesture: 'guard' }) });
    const { payload } = await resolveWorldScene({ ref: 'sk_test', manifest });
    checkEngineSkeleton(tposeRig(payload.figures.body));
  });
});
