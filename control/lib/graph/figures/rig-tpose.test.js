// The T-pose mold: a humanoid pack re-rested in the VRM T-pose, its clips re-expressed so they play the same motion.
import { describe, expect, it } from 'vitest';

import { tposeRig, tposeFrames } from './rig-tpose.js';
import { bakeRigFigure } from './rig-bake.js';
import { figureRigSamples } from '../polygonizer/figure-render.js';
import { humanoidBonesFor } from '../polygonizer/figure-humanoid-map.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { parseGlb } from '../scene/scene-gltf-read.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { assembleFigureScene } from './figure-world.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const qrot = (q, v) => { const u = [q[0], q[1], q[2]], c = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; const t = c(u, v).map((x) => 2 * x); const ct = c(u, t); return [v[0] + q[3] * t[0] + ct[0], v[1] + q[3] * t[1] + ct[1], v[2] + q[3] * t[2] + ct[2]]; };
const F32 = new Map();   // decoded once per base64 string
const f32 = (b64) => { if (!F32.has(b64)) { const b = Buffer.from(b64, 'base64'); F32.set(b64, new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4)); } return F32.get(b64); };
const u8 = (b64) => Uint8Array.from(Buffer.from(b64, 'base64'));

const { restFaces, restNodes, nodeFrames } = figureRigSamples({ motion: { emote: 'cheer' } }, 6);
const flat = bakeRigFigure({ nodesAt: () => restNodes, facesAt: () => restFaces, clips: { cheer: { nodeFrames } } });
const heroPack = async (spec) => {
  const manifest = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });
  const { payload } = await resolveWorldScene({ ref: 'sk_test', manifest });
  return payload.figures.body;
};

// every part vertex wholly bound to one bone (as the mold bound it): [part index, vertex index, bone index]
function rigidVertices(fig) {
  const out = [];
  fig.parts.forEach((P, pi) => {
    if (!P) return;
    const n = f32(P.pos).length / 3, jnt = P.jnt ? u8(P.jnt) : null, wgt = P.wgt ? f32(P.wgt) : null;
    for (let k = 0; k < n; k += 13) { if (!jnt) out.push([pi, k, pi]); else if (wgt[4 * k] === 1) out.push([pi, k, jnt[4 * k]]); }
  });
  return out;
}
// a vertex posed at clip key k by the runtime formula: head' + q·(v − restHead)
function posed(fig, clip, key, pi, k, bone) {
  const P = f32(fig.parts[pi].pos), v = [P[3 * k], P[3 * k + 1], P[3 * k + 2]], nb = fig.bones.length, o = (key * nb + bone) * 7, b = fig.clips[clip].b;
  const q = b.slice(o, o + 4), h = b.slice(o + 4, o + 7), d = qrot(q, sub(v, fig.bones[bone].head));
  return [h[0] + d[0], h[1] + d[1], h[2] + d[2]];
}

function checkMold(fig, T, clip) {
  const { names } = humanoidBonesFor(fig.bones);
  const left = unit((() => { const by = Object.fromEntries([...names].map(([i, v]) => [v, i])); const l = fig.bones[by.leftUpperArm].head, r = fig.bones[by.rightUpperArm].head; return [l[0] - r[0], l[1] - r[1], 0]; })());
  fig.bones.forEach((b, i) => {
    const v = names.get(i), d = sub(T.bones[i].tail, T.bones[i].head);
    expect(len(d)).toBeCloseTo(len(sub(b.tail, b.head)), 3);   // lengths kept
    if (/^left(UpperArm|LowerArm|Hand)$/.test(v)) expect(dot(unit(d), left)).toBeGreaterThan(0.9999);
    if (/^right(UpperArm|LowerArm|Hand)$/.test(v)) expect(dot(unit(d), left)).toBeLessThan(-0.9999);
    if (/(UpperLeg|LowerLeg)$/.test(v)) expect(unit(d)[2]).toBeLessThan(-0.9999);
  });
  // stands on the floor it stood on
  const minZ = (f) => { let m = Infinity; for (const P of f.parts) if (P) { const a = f32(P.pos); for (let k = 2; k < a.length; k += 3) m = Math.min(m, a[k]); } return m; };
  expect(minZ(T)).toBeCloseTo(minZ(fig), 4);
  // every clip plays the same motion on a rigid vertex
  let worst = 0;
  for (const [pi, k, bone] of rigidVertices(T)) for (let key = 0; key < fig.clips[clip].k; key++) worst = Math.max(worst, len(sub(posed(fig, clip, key, pi, k, bone), posed(T, clip, key, pi, k, bone))));
  expect(worst).toBeLessThan(2e-3);   // the pack's 4-decimal quaternions, on a ~1.8 m figure
  return worst;
}

describe('the T-pose mold', () => {
  it('any rigid humanoid pack: arms out, legs down, lengths kept, the cheer plays the same on a rigid vertex', () => {
    checkMold(flat, tposeRig(flat), 'cheer');
  });

  it('the flat figure is REBUILT on the T armature: arms out, legs down, lengths kept, every clip bone posed the same', () => {
    const m = { motion: { emote: 'cheer' } };
    const A = Object.values(assembleFigureScene(m, {}).figures)[0], T = Object.values(assembleFigureScene(m, { tpose: true }).figures)[0];
    expect(T.tpose).toEqual({ rebuilt: true });
    expect(A.tpose).toBeUndefined();
    const { names } = humanoidBonesFor(T.bones);
    T.bones.forEach((b, i) => {
      const v = names.get(i), d = unit(sub(b.tail, b.head));
      expect(len(sub(b.tail, b.head))).toBeCloseTo(len(sub(A.bones[i].tail, A.bones[i].head)), 3);
      if (/^left(UpperArm|LowerArm)$/.test(v)) expect(d[0]).toBeLessThan(-0.9999);
      if (/^right(UpperArm|LowerArm)$/.test(v)) expect(d[0]).toBeGreaterThan(0.9999);
      if (/(UpperLeg|LowerLeg)$/.test(v)) expect(d[2]).toBeLessThan(-0.9999);
    });
    const nb = A.bones.length, a = A.clips.forward, t = T.clips.forward;
    // the bake centres each pack on its own rest bounds (the arms out move them), so the posed heads agree up to one shift
    const shift = sub(t.b.slice(4, 7), a.b.slice(4, 7));
    let worst = 0;
    for (let k = 0; k < a.k; k++) for (let i = 0; i < nb; i++) {
      const o = (k * nb + i) * 7;
      const ta = qrot(a.b.slice(o, o + 4), sub(A.bones[i].tail, A.bones[i].head)), tt = qrot(t.b.slice(o, o + 4), sub(T.bones[i].tail, T.bones[i].head));
      worst = Math.max(worst, len(sub(ta, tt)), len(sub(sub(t.b.slice(o + 4, o + 7), a.b.slice(o + 4, o + 7)), shift)));
    }
    expect(worst).toBeLessThan(2e-3);
  });

  it('is idempotent: a T rest moulds to itself', () => {
    const once = tposeRig(flat), twice = tposeRig(once);
    once.bones.forEach((b, i) => { for (let a = 0; a < 3; a++) { expect(twice.bones[i].head[a]).toBeCloseTo(b.head[a], 3); expect(twice.bones[i].tail[a]).toBeCloseTo(b.tail[a], 3); } });
    for (const q of Object.values(twice.tpose.offsets)) expect(Math.abs(q[3])).toBeGreaterThan(0.9999);
  });

  it('keeps the trunk, the head and the feet as authored; the input is untouched', () => {
    const before = JSON.stringify(flat), T = tposeFrames(flat.bones);
    expect(JSON.stringify(flat)).toBe(before);
    for (const t of T) if (t.role === 'world') expect(t.q).toEqual([0, 0, 0, 1]);
    expect(T.filter((t) => t.role === 'aim').map((t) => t.vrm).sort()).toEqual(['leftLowerArm', 'leftLowerLeg', 'leftUpperArm', 'leftUpperLeg', 'rightLowerArm', 'rightLowerLeg', 'rightUpperArm', 'rightUpperLeg']);
  });

  it('refuses a rig that is not humanoid', () => {
    expect(() => tposeFrames([{ id: 'spine', head: [0, 0, 1], tail: [1, 0, 1] }])).toThrow(/not a humanoid rig/);
  });

  it('the skinned GLB of a moulded figure parses: the same clips, and the engine skeleton adds the hand and foot leaves and the clavicles as bones', () => {
    const a = parseGlb(facesToGlb({ faces: [], figures: { f: flat } }, { clips: '_all', skinned: true, humanoid: true }).bytes);
    const b = parseGlb(facesToGlb({ faces: [], figures: { f: tposeRig(flat) } }, { clips: '_all', skinned: true, humanoid: true }).bytes);
    expect(b.json.skins[0].joints.length).toBe(a.json.skins[0].joints.length + humanoidBonesFor(flat.bones).leaves.length + 2);   // and the two clavicles
    expect(b.json.animations.map((x) => x.name)).toEqual(a.json.animations.map((x) => x.name));
  });

  for (const spec of [{ cast: 'male', gesture: 'guard' }, { cast: 'female', head: 'anime', hair: 'bob' }, { cast: 'male', proportions: 'herobot' }]) {
    it(`a hero: ${JSON.stringify(spec)}`, { timeout: 120000 }, async () => {
      const fig = await heroPack(spec), T = tposeRig(fig);
      checkMold(fig, T, Object.keys(fig.clips)[0]);
      // the hands straight out, the fingers riding them
      const roles = tposeFrames(fig.bones);
      expect(roles.filter((t) => /Hand$/.test(t.vrm || '')).every((t) => t.role === 'aim')).toBe(true);
      expect(roles.filter((t) => /(Proximal|Intermediate|Distal|Metacarpal)$/.test(t.vrm || '')).every((t) => t.role === 'ride')).toBe(true);
    });
  }
});
