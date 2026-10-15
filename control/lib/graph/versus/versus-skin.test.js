// A character's own body posed by the fight: each bone turned in the plane by its stick segment's turn from rest, the
// chain closed down from the pelvis, the bones their own length, the lead side the one nearer the camera, the feet on
// the ground as at rest.
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest } from '@/lib/mcp/tools/layered.js';
import { validateRig } from '@/lib/graph/polygonizer/station-loft-rig.js';
import { skinSkeleton, skinPose } from './versus-skin.js';
import { rigJoints } from './versus-rig.js';
import { compileFighter } from './versus-compile.js';
import { solveFighter } from './versus-solver.js';

// a hero's bones as its packed rig carries them: { id, head, tail } at the rig's joints (metres, z up, facing +y)
const R = validateRig(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male' }) }).recipe.rig);
const BONES = R.bones.map((b) => ({ id: b.id, head: R.joints[b.head], tail: R.joints[b.tail] }));
const SK = skinSkeleton(BONES);
const ix = (id) => BONES.findIndex((b) => b.id === id);
const F = compileFighter(solveFighter({ id: 'k', archetype: 'all-rounder' }).recipe);
const turn = (v, a) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
const tailOf = (P, i) => { const b = BONES[i], d = turn([b.tail[0] - b.head[0], b.tail[1] - b.head[1], b.tail[2] - b.head[2]], P.a[i]); return P.h[i].map((v, k) => v + d[k]); };
const near = (p, q, eps = 1e-9) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < eps;
// the jab at its first active frame: the lead arm out
const jab = F.moves['stand.L'].frames[F.moves['stand.L'].startup].pose;

describe('versus: a character posed by the fight', () => {
  it('reads every bone: the limbs turned, the fingers and toes riding their hand and foot, the folds between', () => {
    const role = (id) => SK.roles[ix(id)];
    expect(role('foreArmR')).toMatchObject({ kind: 'aim', seg: ['elbow$', 'hand$'] });
    expect(role('thumb1R')).toMatchObject({ kind: 'follow', of: ix('handR') });
    expect(role('toesL')).toMatchObject({ kind: 'follow', of: ix('footL') });
    expect(role('kneeFoldR')).toMatchObject({ kind: 'fold', mix: [ix('thighR'), ix('shankR')] });
    expect(SK.order).toHaveLength(BONES.length);
    SK.order.forEach((i, k) => { if (SK.roles[i].parent >= 0) expect(SK.order.indexOf(SK.roles[i].parent)).toBeLessThan(k); });
  });

  it('at the fight\'s rest every bone stands where the character\'s rest has it', () => {
    const P = skinPose(SK, rigJoints(F.body, {}), 1, false);
    P.a.forEach((a) => expect(Math.abs(a)).toBeLessThan(1e-12));
    BONES.forEach((b, i) => expect(near(P.h[i], b.head, 1e-9)).toBe(true));
  });

  it('a strike closes the chain: each joint where its parent bone ends, every bone its own length', () => {
    const P = skinPose(SK, rigJoints(F.body, jab), 1, false);
    for (const [a, b] of [['upperArmR', 'foreArmR'], ['foreArmR', 'handR'], ['thighL', 'shankL'], ['shankL', 'footL'], ['torso', 'neck'], ['clavicleR', 'upperArmR']]) {
      expect(near(tailOf(P, ix(a)), P.h[ix(b)], 1e-9), `${a} → ${b}`).toBe(true);
    }
  });

  it('the lead hand goes out toward the foe, on the side nearer the camera whichever way it faces', () => {
    for (const [face, lead, rear] of [[1, 'handR', 'handL'], [-1, 'handL', 'handR']]) {
      const P = skinPose(SK, rigJoints(F.body, jab), face, false);
      const reach = (id) => P.h[ix(id)][1] - BONES[ix(id)].head[1];
      expect(reach(lead), `face ${face}`).toBeGreaterThan(0.25);
      expect(reach(lead)).toBeGreaterThan(reach(rear) + 0.2);
    }
  });

  it('a grounded pose stands on its feet as the rest does; an airborne one keeps the fight\'s height', () => {
    const lowFoot = (P) => Math.min(...['footR', 'footL', 'toesR', 'toesL'].flatMap((id) => [P.h[ix(id)][2], tailOf(P, ix(id))[2]]));
    const rest = lowFoot(skinPose(SK, rigJoints(F.body, {}), 1, false));
    const crouch = F.moves['crouch.M'].frames[1].pose;
    expect(lowFoot(skinPose(SK, rigJoints(F.body, crouch), 1, false))).toBeCloseTo(rest, 9);
    const air = F.moves['air.M'].frames[1].pose;
    const J = rigJoints(F.body, air);
    expect(skinPose(SK, J, 1, true).h[ix('pelvis')][2]).toBeCloseTo(J.pelvis[1] / 1000, 9);
  });
});

describe('versus: the arena carries a character\'s body only when it has one', () => {
  it('a roster without a character adds no bodies; with one, its body rides the channel under its ref', async () => {
    const { versusArenaData } = await import('./versus-page.js');
    const { versusChannelScript } = await import('../scene/channels/versus.js');
    const plain = versusArenaData({ roster: [{ id: 'a', archetype: 'zoner' }] });
    expect(plain).not.toHaveProperty('bodies');
    const body = { bones: BONES.slice(0, 2), parts: [null, null] };
    const carried = versusArenaData({ roster: [{ id: 'a', archetype: 'zoner', character: 'him', body: { height: 1700 } }], bodies: { him: body } });
    expect(carried.bodies).toEqual({ him: body });
    expect(carried.roster[0].character).toBe('him');
    expect(versusChannelScript(carried)).toContain('"bodies":{"him"');
    expect(versusChannelScript(plain)).not.toContain('"bodies"');
  });
});
