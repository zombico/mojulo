// The head turn: the neck and skull turn about the neck line (neck.turn / head.turn, `glance`). An absent turn adds no
// key and moves nothing; an un-nodded head moves no node either, so the turn lives in the bone frames that span the
// neck (the hero's neck and head, the packed biped's head, rigid armor, the protoform skull), read from a twist pair.
import { describe, expect, it } from 'vitest';

import { articulate, articulateTransforms, FIGURE_NODES, LIMITS, TWIST_REFS, TWIST_REF_NODES } from './figure-vajra.js';
import { resolvePose } from './figure-posing.js';
import { groundBalance } from './figure-balance.js';
import { headRings } from './figure-head.js';
import { emoteMotion } from './figure-emotes.js';
import { compileLayered } from './station-loft.js';
import { validateRig, bindLayered, rigNodesAt, boneFrames } from './station-loft-rig.js';
import { poseLayered } from './hero-gesture.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { bakeRigFigure } from '../figures/rig-bake.js';

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit = (a) => { const l = Math.hypot(a.x, a.y, a.z); return { x: a.x / l, y: a.y / l, z: a.z / l }; };
// the signed angle (degrees) a bone's twist pair measures about the bone's posed axis
function twistOf(m, bone, [h, t]) {
  const [s, f] = TWIST_REFS[bone], z = unit(sub(m[t], m[h]));
  const perp = (p) => { const v = sub(p, m[h]), k = dot(v, z); return { x: v.x - z.x * k, y: v.y - z.y * k, z: v.z - z.z * k }; };
  const u = perp(m[s]), v = perp(m[f]);
  return Math.atan2(dot(z, cross(u, v)), dot(u, v)) * 180 / Math.PI;
}
const SPAN = { neck: ['neckHub', 'headBase'], head: ['headBase', 'headTop'], crown: ['neckHub', 'headTop'] };
// a 3×3 rotation's angle (degrees) and unit axis
const angleOf = (M) => Math.acos(Math.max(-1, Math.min(1, (M[0][0] + M[1][1] + M[2][2] - 1) / 2))) * 180 / Math.PI;
const axisOf = (M) => unit({ x: M[2][1] - M[1][2], y: M[0][2] - M[2][0], z: M[1][0] - M[0][1] });
const mulT = (A, B) => A.map((r, i) => B.map((__, j) => A[i][0] * B[j][0] + A[i][1] * B[j][1] + A[i][2] * B[j][2]));   // A · Bᵀ

describe('the head turn on the vajra armature', () => {
  it('absent or zero: no new key, the same map', () => {
    for (const dof of [{}, { neck: { turn: 0 }, head: { turn: 0, pitch: -12 } }, { head: { pitch: -12 } }]) {
      const m = articulate(dof);
      for (const k of TWIST_REF_NODES) expect(m[k]).toBeUndefined();
    }
    expect(articulate({ neck: { turn: 0 }, head: { turn: 0, pitch: -12 } })).toEqual(articulate({ head: { pitch: -12 } }));
  });

  it('an un-nodded head moves no node; the twist pair measures the turn on every span', () => {
    const still = articulate({}), m = articulate({ neck: { turn: 14 }, head: { turn: 21 } });
    for (const k of Object.keys(FIGURE_NODES)) for (const a of ['x', 'y', 'z']) expect(m[k][a]).toBeCloseTo(still[k][a], 12);
    expect(twistOf(m, 'neck', SPAN.neck)).toBeCloseTo(14, 9);
    expect(twistOf(m, 'head', SPAN.head)).toBeCloseTo(35, 9);
    expect(twistOf(m, 'crown', SPAN.crown)).toBeCloseTo(35, 9);
  });

  it('a nodded and tilted head: the nod turns with the face about the neck line', () => {
    const dof = { neck: { pitch: -10, yaw: 6, turn: -12 }, head: { pitch: -22, yaw: 9, turn: -18 }, spine: { sagittal: 0.3 } };
    const m = articulate(dof), still = articulate({ ...dof, neck: { ...dof.neck, turn: 0 }, head: { ...dof.head, turn: 0 } });
    expect(Math.hypot(m.headTop.x - still.headTop.x, m.headTop.y - still.headTop.y)).toBeGreaterThan(1e-3);   // the nodded crown swings
    for (const k of ['neckHub', 'headBase', 'shoulderL', 'navel']) expect(m[k]).toEqual(still[k]);
    expect(twistOf(m, 'neck', SPAN.neck)).toBeCloseTo(-12, 9);
    // about the skull's OWN axis a nodded head's twist is near the turn, not equal: the turn is about the neck line,
    // and the frame it builds is that rigid turn exactly (articulateTransforms and the hero below pin it)
    expect(twistOf(m, 'head', SPAN.head)).toBeLessThan(-25);
    expect(twistOf(m, 'head', SPAN.head)).toBeGreaterThan(-35);
  });

  it('the turn is clamped per joint, never refused', () => {
    const m = articulate({ neck: { turn: 500 }, head: { turn: -720 } });
    expect(twistOf(m, 'neck', SPAN.neck)).toBeCloseTo(LIMITS.neckTurn, 9);
    expect(twistOf(m, 'head', SPAN.head)).toBeCloseTo(LIMITS.neckTurn - LIMITS.headTurn, 9);
  });

  it('articulateTransforms: the same nodes; the head bone turns about the neck line', () => {
    const dof = { neck: { pitch: -8, turn: 10 }, head: { pitch: -15, turn: 25 } };
    const { nodes, bones } = articulateTransforms(dof), m = articulate(dof);
    for (const k of Object.keys(m)) for (const a of ['x', 'y', 'z']) expect(nodes[k][a]).toBeCloseTo(m[k][a], 12);
    const still = articulateTransforms({ neck: { pitch: -8 }, head: { pitch: -15 } }).bones.head.m;
    const R = mulT(bones.head.m, still);   // the turn alone, in the world
    expect(angleOf(R)).toBeCloseTo(35, 9);
    expect(Math.abs(dot(axisOf(R), unit(sub(m.headBase, m.neckHub))))).toBeCloseTo(1, 9);
    expect(articulateTransforms({}).bones.head).toEqual(articulateTransforms({ head: { turn: 0 } }).bones.head);
  });

  it('the balance solve carries the twist pair with the head', () => {
    const full = articulate({ head: { turn: 30 }, spine: { lateral: 0.4 }, hipL: { pitch: 20 } });
    const p = groundBalance(full, { feet: ['R'] });
    expect(p.headBase).not.toEqual(full.headBase);
    expect(twistOf(p, 'head', SPAN.head)).toBeCloseTo(30, 9);
  });
});

describe('the pose words', () => {
  it('`turn` passes through raw angles; `glance` splits 40/60 neck/head', () => {
    expect(resolvePose({ head: { turn: 20 } }).head).toEqual({ turn: 20 });
    expect(resolvePose({ glance: 'left' })).toEqual({ neck: { turn: 24 }, head: { turn: 36 } });
    expect(resolvePose({ glance: -50, head: { pitch: -10 } })).toEqual({ neck: { turn: -20 }, head: { pitch: -10, turn: -30 } });
    expect(resolvePose({ glance: 'ahead' })).toEqual({});
    expect(() => resolvePose({ glance: 'sideways' })).toThrow(/glance is left \/ right \/ ahead or degrees/);
  });

  it('headshake turns the head and leaves the trunk square', () => {
    const move = emoteMotion('headshake', { perform: false });
    const turns = [0.1, 0.3, 0.5].map((t) => move(t));
    expect(turns.some((d) => Math.abs(d.head?.turn || 0) > 10)).toBe(true);
    for (const d of turns) expect(d.spine?.axial || 0).toBe(0);
  });
});

describe('the turned frames', () => {
  it('the protoform skull turns about its bone; no turn keeps its rings', () => {
    const still = headRings(articulate({})), turned = headRings(articulate({ head: { turn: 30 } }));
    expect(headRings(articulate({ head: { turn: 0 } }))).toEqual(still);
    const hb = articulate({}).headBase, c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
    still.forEach((r, i) => r.polyline.forEach((p, j) => {
      const q = turned[i].polyline[j], d = sub(p, hb);
      expect(q.x).toBeCloseTo(hb.x + d.x * c - d.y * s, 9);
      expect(q.y).toBeCloseTo(hb.y + d.x * s + d.y * c, 9);
      expect(q.z).toBeCloseTo(p.z, 9);
    }));
  });

  it('the packed biped: the head bone bakes the turn, every other bone as before', () => {
    const nodesAt = (dof) => articulate(dof);
    const facesAt = () => [{ corners: [[0, 0, 0.9], [0.01, 0, 0.9], [0, 0.01, 0.9]], fill: '#ffffff' }];
    const rig = bakeRigFigure({ nodesAt, facesAt, keys: 2, clips: { look: () => ({ head: { turn: 30 } }), still: () => ({}) } });
    const H = rig.bones.findIndex((b) => b.id === 'head');
    const q = rig.clips.look.b.slice(H * 7, H * 7 + 4);
    expect(q[2]).toBeCloseTo(Math.sin(Math.PI / 12), 4);   // 30° about +z (the left turn)
    expect(q[3]).toBeCloseTo(Math.cos(Math.PI / 12), 4);
    rig.bones.forEach((b, i) => { if (i !== H) expect(rig.clips.look.b.slice(i * 7, i * 7 + 7)).toEqual(rig.clips.still.b.slice(i * 7, i * 7 + 7)); });
  });

  for (const spec of [{ cast: 'male' }, { cast: 'female', hair: 'bob', gesture: 'relaxed' }]) {
    it(`the hero: the neck and head bones turn about the neck line, the jaw seam stays shut: ${JSON.stringify(spec)}`, () => {
      const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) }), mesh = compileLayered(m.recipe, m.dials || {}, m.channels || {});
      const R = validateRig(m.recipe.rig), skin = bindLayered(mesh, m.recipe, R);
      const framesAt = (pose) => { const { nodes } = rigNodesAt(R, pose); return { F: boneFrames(R, R.joints, nodes), nodes }; };
      const base = { head: { pitch: -10 } };
      const still = framesAt(base), turned = framesAt({ ...base, glance: 'left' });
      const neckLine = unit(sub({ x: turned.nodes.headBase[0], y: turned.nodes.headBase[1], z: turned.nodes.headBase[2] }, { x: turned.nodes.neckHub[0], y: turned.nodes.neckHub[1], z: turned.nodes.neckHub[2] }));
      for (const [bone, deg] of [['neck', 24], ['head', 60]]) {
        const W = mulT(turned.F[R.boneIndex[bone]].m, still.F[R.boneIndex[bone]].m);
        expect(angleOf(W)).toBeCloseTo(deg, 6);
        expect(dot(axisOf(W), neckLine)).toBeCloseTo(1, 6);
      }
      for (const b of ['torso', 'upperArmL', 'thighR']) expect(turned.F[R.boneIndex[b]].q).toEqual(still.F[R.boneIndex[b]].q);
      // no turn: the frames as they were (the twist pair absent)
      expect(framesAt({ ...base, glance: 'ahead' }).F).toEqual(still.F);
      if (R.boneIndex.jaw !== undefined) {
        const key = (p) => p.map((x) => Math.round(x * 1e5)).join(), cr = new Map(), jaw = new Set();
        mesh.faces.forEach((t) => { const part = mesh.provenance[t[0]].part; if (part === 'cranium') t.forEach((v) => cr.set(key(mesh.vertices[v]), v)); else if (part === 'jaw') t.forEach((v) => jaw.add(v)); });
        const seam = [...jaw].map((v) => [v, cr.get(key(mesh.vertices[v]))]).filter(([, c]) => c !== undefined);
        for (const pose of [{ glance: 'left' }, { neck: { turn: -20 }, head: { pitch: 10, turn: 30 } }]) {
          const V = poseLayered(mesh, m.recipe, pose, { R, skin }).mesh.vertices;
          for (const [j, c] of seam) expect(Math.hypot(V[j][0] - V[c][0], V[j][1] - V[c][1], V[j][2] - V[c][2])).toBeLessThan(1e-5);
        }
      }
    });
  }
});
