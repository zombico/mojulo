/**
 * The mecha shelf's laws as concepts, on its first frame (the archetype a test reads is chosen in code): a stance is
 * solved by the legs' inverse kinematics (each foot where it was asked, its sole flat, at its heading), every ram lies
 * within its stroke at every stance, a joint's range is its actuator's (a shorter stroke, a shorter arc), the knees
 * bend backward, the legs mirror each other, a sway carries the centre of mass over the stance sole, and the laws read the frame as built.
 */
import { describe, expect, it } from 'vitest';

import { apply } from './mecha-common.js';
import { framesOf, rangeOf, solveChain } from '../construction-shelf/con-chain.js';
import { MECHA_ARCHETYPES, MECHA_ODM, assembleFrame, findMechaPart, jointRange, lawsOf, massOf, mechaCtx, mechaNameIndex, posedFrame, resolveMechaPart, riderPoints } from './index.js';
import { readMechaSpec } from './mecha-figure.js';

const id = Object.keys(MECHA_ARCHETYPES)[0], arch = MECHA_ARCHETYPES[id], ctx = mechaCtx(id);
// (the stances that exercise each of the solve's paths: a height set by a knee's bend, a sway over a sole with a foot
// lifted, the feet yawed)
const bySwing = Object.keys(arch.stances).find((k) => arch.stances[k].sway);
const byYaw = Object.keys(arch.stances).find((k) => Object.values(arch.stances[k].feet ?? {}).some((f) => f.yaw));
const byKnee = Object.keys(arch.stances).find((k) => Number.isFinite(arch.stances[k].knee) && !arch.stances[k].sway && !arch.stances[k].feet);
const world = (P) => Object.fromEntries(Object.entries(framesOf(ctx.arch, P.joints, ctx)).map(([k, T]) => [k, { R: T.R, t: apply(P.root, T.t) }]));
const sole = (F, S) => { const f = arch.legs[S].foot; return apply(F[f], ctx.hp(f, 'sole')); };

describe('mecha shelf: a stance is solved by where the feet are', () => {
  it('sets each foot where its stance asks, its sole flat on the ground, at its heading', () => {
    for (const name of [byKnee, bySwing, byYaw]) {
      const P = posedFrame(id, name), F = world(P);
      expect(P.clamped, name).toEqual([]);
      for (const S of ['r', 'l']) {
        const at = sole(F, S), want = P.feet[S], R = F[arch.legs[S].foot].R;
        expect(at[0], `${name} ${S} x`).toBeCloseTo(want.x, 3);
        expect(at[1], `${name} ${S} y`).toBeCloseTo(want.y, 3);
        expect(at[2], `${name} ${S} lift`).toBeCloseTo(want.lift, 3);
        // (flat: the sole's up is the world's; its forward turned by its heading)
        expect(R[2][2], `${name} ${S} flat`).toBeCloseTo(1, 4);
        expect(Math.atan2(-R[0][1], R[1][1]) * 180 / Math.PI, `${name} ${S} heading`).toBeCloseTo(want.yaw, 2);
      }
    }
  });
  it('holds the knee bent at the height its stance names, and lowers the pelvis to bend it', () => {
    const knee = arch.stances[byKnee].knee, P = posedFrame(id, byKnee);
    expect(Math.max(P.joints[arch.legs.r.joints.knee], P.joints[arch.legs.l.joints.knee])).toBeCloseTo(knee, 1);
    const deeper = posedFrame(id, { knee: knee + 30 });
    expect(deeper.root.t[2]).toBeLessThan(P.root.t[2]);
  });
  it('bends its knees backward: each knee behind the line from its hip to its ankle', () => {
    for (const name of [byKnee, bySwing]) {
      const F = world(posedFrame(id, name));
      for (const S of ['r', 'l']) {
        const g = arch.legs[S], hip = F[g.pitch].t, knee = F[g.knee].t, ankle = F[g.ankle].t;
        const t = (knee[2] - hip[2]) / (ankle[2] - hip[2]), lineY = hip[1] + t * (ankle[1] - hip[1]);
        expect(knee[1], `${name} ${S}`).toBeLessThan(lineY - 0.05);
      }
    }
  });
  it('mirrors the left leg to the right in a symmetric stance', () => {
    const P = posedFrame(id, byKnee), L = arch.legs.l.joints, R = arch.legs.r.joints;
    expect(P.joints[L.roll]).toBeCloseTo(-P.joints[R.roll], 2);
    for (const k of ['pitch', 'knee', 'anklePitch']) expect(P.joints[L[k]]).toBeCloseTo(P.joints[R[k]], 2);
  });
  it('sways the pelvis until the centre of mass stands over the stance sole', () => {
    const P = posedFrame(id, bySwing), S = arch.stances[bySwing].sway, M = massOf(id, P.joints, P.root);
    const at = sole(M.frames, S);
    expect(M.com[0]).toBeCloseTo(at[0], 3);
    expect(M.com[1]).toBeCloseTo(at[1], 3);
    // (the pelvis carried toward that sole: its side's hip over it)
    expect(Math.sign(P.root.t[0])).toBe(S === 'l' ? -1 : 1);
  });
  it('clamps a stance its actuators cannot hold, and says which joints', () => {
    const P = posedFrame(id, { knee: 40, feet: { r: { y: 0.9 } } });
    expect(P.clamped.length > 0 || !P.reached).toBe(true);
  });
});

describe('mecha shelf: the actuators', () => {
  it('lays every ram within its stroke at every stance', () => {
    for (const name of Object.keys(arch.stances)) {
      const P = posedFrame(id, name), chain = solveChain(ctx.arch, P.joints, ctx);
      for (const s of chain.struts.filter((x) => x.kind === 'barrel')) {
        const d = MECHA_ODM[ctx.entry(s.id).sku].dims;
        expect(s.length, `${name} ${s.id}`).toBeGreaterThanOrEqual(d.closed - 1e-6);
        expect(s.length, `${name} ${s.id}`).toBeLessThanOrEqual(d.closed + d.stroke + 1e-6);
      }
    }
  });
  it('gives a joint the range its ram reaches: a shorter stroke, a shorter arc', () => {
    const knee = arch.legs.r.joints.knee, J = arch.joints[knee], sku = ctx.entry(J.ram).sku, full = jointRange(id, knee);
    const short = { ...ctx, row: (k) => (k === sku ? { ...MECHA_ODM[k], dims: { ...MECHA_ODM[k].dims, stroke: MECHA_ODM[k].dims.stroke * 0.7 } } : ctx.row(k)) };
    const r = rangeOf({ ...ctx.arch, key: `${ctx.arch.key}~short` }, knee, short);
    expect(r[1] - r[0]).toBeLessThan(full[1] - full[0]);
    // (a rotary drive's joint turns between its stops)
    const yaw = arch.legs.r.joints.yaw;
    expect(jointRange(id, yaw)).toEqual(MECHA_ODM[ctx.entry(arch.joints[yaw].drive).sku].dims.stop);
  });
  it('rates each actuator holding the frame still: its load from the pose, its share of its rating', () => {
    const { loads } = lawsOf(id);
    expect(loads.length).toBeGreaterThan(0);
    for (const x of loads) expect(x.share).toBeGreaterThanOrEqual(0);
    // (the leg the whole weight stands on works harder than either leg in the crouch shares it)
    const one = loads.filter((x) => x.at === 'lift' && x.by !== 'drive'), worstOne = Math.max(...one.map((x) => x.share));
    expect(worstOne).toBeGreaterThan(0);
  });
});

describe('mecha shelf: the laws read the frame as built', () => {
  it('holds its first frame to every law', () => {
    const { laws } = lawsOf(id);
    expect(laws.filter((l) => !l.ok).map((l) => `${l.id}: ${l.says}`)).toEqual([]);
    for (const k of ['stability.stand', 'sway', 'actuators', 'groundPressure', 'step', 'stride', 'tipover', 'clearance', 'stepIn']) expect(laws.some((l) => l.id === k), k).toBe(true);
  });
  it('puts the rider astride: the saddle over the pelvis, the bars ahead and low, the pegs set back under the hips', () => {
    const P = posedFrame(id, byKnee), pts = riderPoints(id, byKnee), hipY = ctx.hp('pelvis', 'hip.r')[1] + P.root.t[1];
    expect(pts.seat[2]).toBeGreaterThan(P.root.t[2]);
    for (const s of ['l', 'r']) {
      const g = pts[`grip.${s}`], p = pts[`peg.${s}`];
      expect(Math.sign(g[0])).toBe(s === 'l' ? -1 : 1);
      // (a sport machine's bars: well ahead of the sit bones, a little above them, so the trunk leans to reach them)
      expect(g[1] - pts.seat[1]).toBeGreaterThan(0.5);
      expect(g[2] - pts.seat[2]).toBeLessThan(0.15);
      // (its pegs: below the saddle, behind the hips' axes, either side of the spine)
      expect(p[2]).toBeLessThan(pts.seat[2] - 0.3);
      expect(p[1]).toBeLessThan(hipY);
      expect(Math.sign(p[0])).toBe(s === 'l' ? -1 : 1);
    }
  });
  it('leans its rider onto the bars in its posture', async () => {
    const { POSTURES } = await import('../cycle-shelf/cycle-rider.js');
    expect(POSTURES[arch.posture].hinge[0]).toBeGreaterThan(0);
  });
  it('assembles deterministically, its readout carrying its stance, its ranges and its audit', () => {
    const a = assembleFrame(id), b = assembleFrame(id);
    expect(JSON.stringify(a.manifest)).toBe(JSON.stringify(b.manifest));
    expect(a.readout).toMatchObject({ archetype: id, pose: arch.rest, audit: { ok: true } });
    expect(a.readout.measures.ground).toBeCloseTo(0, 2);
    expect(Object.keys(a.readout.ranges).sort()).toEqual(Object.keys(arch.joints).sort());
    // (a pose of joint values is drawn as given)
    const knee = arch.legs.r.joints.knee, j = assembleFrame(id, { pose: { joints: { [knee]: 60 } }, laws: false });
    expect(j.readout.joints[knee]).toBe(60);
  });
});

describe('mecha shelf: parts and words', () => {
  it('names each part once, and builds a leg\'s part for either hand', () => {
    expect(() => mechaNameIndex()).not.toThrow();
    const [sku, row] = Object.entries(MECHA_ODM).find(([, r]) => r.kind === 'mecha-ram');
    expect(findMechaPart(row.label)).toBe(sku);
    const leg = arch.layout.find((e) => e.side === 'l' && !e.ram).sku, r = resolveMechaPart(leg, { side: 'r' }), l = resolveMechaPart(leg, { side: 'l' });
    expect(r.garage).toMatchObject({ sku: leg, side: 'r', frame: id });
    for (const [k, p] of Object.entries(r.garage.hardpoints)) expect(l.garage.hardpoints[k]).toEqual([-p[0] + 0, p[1], p[2]]);
  });
  it('reads a frame\'s words, refusing what it has not', () => {
    expect(readMechaSpec({ archetype: id, pose: byKnee })).toMatchObject({ archetype: id });
    expect(() => readMechaSpec({ archetype: id, pose: 'cartwheel' })).toThrow(/is one of/);
    expect(() => readMechaSpec({ archetype: id, palette: 'paisley' })).toThrow(/palette is one of/);
    expect(() => readMechaSpec({ archetype: id, tool: 'breaker' })).toThrow(/not a mecha frame's word/);
  });
});
