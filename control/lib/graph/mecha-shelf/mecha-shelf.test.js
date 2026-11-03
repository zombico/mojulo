/**
 * The mecha shelf's laws as concepts, on its first frame (the archetype a test reads is chosen in code): a stance is
 * solved by the legs' inverse kinematics (each foot where it was asked, its sole flat, at its heading), every ram lies
 * within its stroke at every stance, a joint's range is its actuator's (a shorter stroke, a shorter arc), the knees
 * bend backward, the legs mirror each other, a sway carries the centre of mass over the stance sole, and the laws read the frame as built.
 */
import { describe, expect, it } from 'vitest';

import { apply, ramForce } from './mecha-common.js';
import { arcsFor, solveMount } from './mecha-gap-makers.js';
import { framesOf, rangeOf, solveChain } from '../construction-shelf/con-chain.js';
import { lowerAssemblerFaces } from '../worlds/workbench-assembler.js';
import { MECHA_BACKPACKS, MECHA_WEAPONS, TAIL_POSES } from './mecha-backpacks.js';
import { MECHA_ARCHETYPES, MECHA_MAKERS, MECHA_MAKER_IDS, MECHA_ODM, MECHA_PACK_TASKS, MECHA_TASKS, MECHA_TOOLS, assembleFrame, composeFrame, frameRow, findMechaPart, jointRange, lawsOf, massOf, mechaCtx, mechaNameIndex, partShape, posedFrame, resolveMechaPart, riderPoints } from './index.js';
import { readMechaSpec } from './mecha-figure.js';
import { dressFaces } from './mecha-military.js';
import { MECHA_PALETTES } from './mecha-common.js';

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

// (a frame with arms, its knees forward: chosen in code by what it carries)
const worker = Object.keys(MECHA_ARCHETYPES).find((k) => MECHA_ARCHETYPES[k].arms && MECHA_ARCHETYPES[k].bend === 'forward');
const W = MECHA_ARCHETYPES[worker], wctx = mechaCtx(worker);
const carryOf = Object.keys(W.stances).find((k) => W.stances[k].load);
const wworld = (P) => Object.fromEntries(Object.entries(framesOf(wctx.arch, P.joints, wctx)).map(([k, T]) => [k, { R: T.R, t: apply(P.root, T.t) }]));

describe('mecha shelf: a frame with arms, its knees forward', () => {
  it('bends its knees forward: each knee ahead of the line from its hip to its ankle', () => {
    const F = wworld(posedFrame(worker, W.rest));
    for (const S of ['r', 'l']) {
      const g = W.legs[S], hip = F[g.pitch].t, knee = F[g.knee].t, ankle = F[g.ankle].t;
      const t = (knee[2] - hip[2]) / (ankle[2] - hip[2]);
      expect(knee[1]).toBeGreaterThan(hip[1] + t * (ankle[1] - hip[1]) + 0.05);
    }
  });
  it('sets each wrist where its arm pose asks, from the shoulder, its claw at the asked angle', () => {
    const P = posedFrame(worker, carryOf), F = wworld(P), want = W.armPoses[W.stances[carryOf].arms];
    for (const S of ['r', 'l']) {
      // (the pose's wrist as shares of the arm's length)
      const a = W.arms[S], sh = F[a.upper].t, wr = F[a.wrist].t, n = -wctx.hp(a.upper, 'elbow')[2] - wctx.hp(a.fore, 'wrist')[2];
      expect(wr[1] - sh[1]).toBeCloseTo(want.wrist[0] * n, 3);
      expect(wr[2] - sh[2]).toBeCloseTo(want.wrist[1] * n, 3);
      // (the claw's down axis turned forward by its angle: at 90° its fingers point ahead)
      const R = F[a.claw].R, ang = Math.atan2(-R[1][2], R[2][2]) * 180 / Math.PI;
      expect(Math.abs(ang)).toBeCloseTo(180 - want.claw, 1);
    }
  });
  it('weighs a load in its claws: its centre of mass moves toward them, its arms\' actuators work harder', () => {
    const P = posedFrame(worker, carryOf), light = massOf(worker, P.joints, P.root), heavy = massOf(worker, P.joints, P.root, { load: 200 });
    expect(heavy.mass - light.mass).toBe(200);
    expect(heavy.com[1]).toBeGreaterThan(light.com[1]);
    const { laws, loads } = lawsOf(worker);
    expect(loads.some((x) => x.at === 'carry' && x.share > 0)).toBe(true);
    // (its rated lift is what first gives, tipping or an arm's actuator, at 75%)
    expect(laws.find((l) => l.id === 'lift').value).toBeGreaterThan(0);
  });
  it('holds its work frame to every law, its arms clear of the operator', () => {
    const { laws } = lawsOf(worker);
    expect(laws.filter((l) => !l.ok).map((l) => `${l.id}: ${l.says}`)).toEqual([]);
    for (const k of ['reach', 'lift', 'clearance', 'tipover']) expect(laws.some((l) => l.id === k), k).toBe(true);
  });
});

describe('mecha shelf: a frame drawn larger, its operator in a closed cab', () => {
  // (a scaled part and a frame with a closed cab: chosen in code by what they are)
  const [sku, row] = Object.entries(MECHA_ODM).find(([, r]) => r.dims.scale);
  const base = row.from;
  it('draws a part at another size as its design scaled whole: its pins at k times, its mass at k³', () => {
    const k = row.dims.scale, a = resolveMechaPart(base, { side: 'r' }).garage, b = resolveMechaPart(sku, { side: 'r' }).garage;
    for (const [h, p] of Object.entries(a.hardpoints)) for (let i = 0; i < 3; i++) expect(b.hardpoints[h][i]).toBeCloseTo(p[i] * k, 2);
    expect(row.mass).toBe(Math.round(MECHA_ODM[base].mass * k ** 3));
  });
  const cabbed = Object.keys(MECHA_ARCHETYPES).find((k) => MECHA_ARCHETYPES[k].laws.cab);
  it('holds its operator inside its cab, and every law on the larger frame', () => {
    const { laws } = lawsOf(cabbed);
    expect(laws.filter((l) => !l.ok).map((l) => `${l.id}: ${l.says}`)).toEqual([]);
    expect(laws.find((l) => l.id === 'cab').value).toBeGreaterThan(0);
    // (its arms' ranges are its design's: a ram scaled with its pins reaches the same arc)
    const pitch = MECHA_ARCHETYPES[cabbed].arms.r.joints.pitch, utility = Object.keys(MECHA_ARCHETYPES).find((k) => k !== cabbed && MECHA_ARCHETYPES[k].arms);
    const [lo, hi] = jointRange(cabbed, pitch), [lo0, hi0] = jointRange(utility, MECHA_ARCHETYPES[utility].arms.r.joints.pitch);
    expect(lo).toBeCloseTo(lo0, 0);
    expect(hi).toBeCloseTo(hi0, 0);
  });
});

describe('mecha shelf: a modular frame fitted for its task', () => {
  // (a frame with a mount, and loadouts chosen in code by what they carry)
  const modular = Object.keys(MECHA_ARCHETYPES).find((k) => MECHA_ARCHETYPES[k].mount), Mo = MECHA_ARCHETYPES[modular].mount;
  const own = Mo.loadout.r.tool, other = Mo.tools.find((t) => t !== own && MECHA_TOOLS[t].holds > 0 && MECHA_TOOLS[t].sku !== MECHA_TOOLS[own].sku);
  const idle = Mo.tools.filter((t) => MECHA_TOOLS[t].holds === 0), longKit = Mo.arms.find((a) => a !== Mo.loadout.r.arm);
  const law = (key, id) => lawsOf(key).laws.find((l) => l.id === id);
  it('puts each arm\'s tool in its claw\'s place: its mass the tools\' difference, its own loadout its own key', () => {
    expect(composeFrame(modular, { tools: { r: own, l: own } })).toBe(modular);
    const key = composeFrame(modular, { tools: { r: other, l: other } }), a = assembleFrame(modular).readout, b = assembleFrame(modular, { tools: { r: other, l: other } }).readout;
    expect(b.composed).toBe(key);
    expect(b.loadout).toMatchObject({ r: { tool: other }, l: { tool: other } });
    expect(b.mass.parts - a.mass.parts).toBe(2 * (MECHA_ODM[MECHA_TOOLS[other].sku].mass - MECHA_ODM[MECHA_TOOLS[own].sku].mass));
    expect(JSON.stringify(assembleFrame(modular, { tools: { r: other, l: other } }).manifest)).toBe(JSON.stringify(assembleFrame(modular, { tools: { r: other, l: other } }).manifest));
  });
  it('reads a task as its loadout, and refuses what its mount does not take', () => {
    const task = Object.keys(MECHA_TASKS).find((k) => MECHA_TASKS[k].r.tool !== own);
    expect(frameRow(composeFrame(modular, { task })).loadout.r.tool).toBe(MECHA_TASKS[task].r.tool);
    expect(() => composeFrame(modular, { task: 'juggling' })).toThrow(/task 'juggling' is one of/);
    expect(() => composeFrame(modular, { tools: { r: 'spoon' } })).toThrow(/takes a tool of/);
    expect(() => composeFrame(Object.keys(MECHA_ARCHETYPES).find((k) => !MECHA_ARCHETYPES[k].mount), { task })).toThrow(/its arms are its own/);
  });
  it('rates its lift no higher than its tools hold, and reads none when neither tool holds', () => {
    const key = composeFrame(modular, { tools: { r: other, l: other } });
    expect(law(key, 'lift').value).toBeLessThanOrEqual(2 * MECHA_TOOLS[other].holds);
    if (idle.length) expect(law(composeFrame(modular, { tools: { r: idle[0], l: idle[idle.length - 1] } }), 'lift')).toBeUndefined();
  });
  it('sums its tools\' flow against its pump\'s', () => {
    const [a, b] = [...Mo.tools].sort((x, y) => MECHA_TOOLS[y].flow - MECHA_TOOLS[x].flow), key = composeFrame(modular, { tools: { r: a, l: b } });
    const supply = MECHA_ODM[MECHA_ARCHETYPES[modular].layout.find((e) => e.id === 'pack').sku].dims.flow;
    expect(law(key, 'flow').value).toBeCloseTo((MECHA_TOOLS[a].flow + MECHA_TOOLS[b].flow) / supply, 2);
  });
  it('trades lift for reach on a long arm, the same tool on it', () => {
    // (its own tools: the arms' reach, and the load at its end, are what the kit changes)
    const std = modular, long = composeFrame(modular, { arms: { r: longKit, l: longKit } });
    expect(law(long, 'reach').value).toBeGreaterThan(law(std, 'reach').value);
    expect(law(long, 'lift').value).toBeLessThan(law(std, 'lift').value);
  });
  it('holds every task\'s loadout to every law', () => {
    // (one task per distinct procedure: one that lifts with both arms, one whose tools draw the most flow)
    const flows = (k) => MECHA_TOOLS[MECHA_TASKS[k].r.tool].flow + MECHA_TOOLS[MECHA_TASKS[k].l.tool].flow;
    const pick = [Object.keys(MECHA_TASKS).find((k) => ['r', 'l'].every((S) => MECHA_TOOLS[MECHA_TASKS[k][S].tool].holds > 0)), Object.keys(MECHA_TASKS).sort((x, y) => flows(y) - flows(x))[0]];
    for (const task of pick) expect(lawsOf(composeFrame(modular, { task })).laws.filter((l) => !l.ok).map((l) => `${task} ${l.id}: ${l.says}`)).toEqual([]);
  });
});

describe('mecha shelf: a giant arm pack on a frame', () => {
  // (a frame carrying a pack's arms, chosen in code)
  const packed = Object.keys(MECHA_ARCHETYPES).find((k) => MECHA_ARCHETYPES[k].packArms), Pk = MECHA_ARCHETYPES[packed], pctx = mechaCtx(packed);
  const heave = Object.keys(Pk.stances).find((k) => Pk.stances[k].loadOn === 'packArms');
  const law = (key, id) => lawsOf(key).laws.find((l) => l.id === id);
  it('solves the pack\'s giant arms as the frame\'s own are: each wrist where its pose asks, from its own shoulder', () => {
    const P = posedFrame(packed, heave), F = Object.fromEntries(Object.entries(framesOf(pctx.arch, P.joints, pctx)).map(([k, T]) => [k, { R: T.R, t: apply(P.root, T.t) }]));
    const want = Pk.armPoses[Pk.stances[heave].packArms];
    for (const S of ['r', 'l']) {
      const a = Pk.packArms[S], n = -pctx.hp(a.upper, 'elbow')[2] - pctx.hp(a.fore, 'wrist')[2];
      expect(F[a.wrist].t[1] - F[a.upper].t[1]).toBeCloseTo(want.wrist[0] * n, 3);
      expect(F[a.wrist].t[2] - F[a.upper].t[2]).toBeCloseTo(want.wrist[1] * n, 3);
    }
  });
  it('weighs a load on the pack\'s arms where it is held, and rates their lift apart from the frame\'s own', () => {
    const P = posedFrame(packed, heave), on = massOf(packed, P.joints, P.root, { load: 1000, loadOn: 'packArms' }), off = massOf(packed, P.joints, P.root, { load: 1000 });
    expect(on.parts.filter((q) => q.id.startsWith('load.')).every((q) => Pk.packArms[q.id.slice(-1)])).toBe(true);
    expect(on.com[2]).not.toBeCloseTo(off.com[2], 3);
    expect(law(packed, 'packLift').value).toBeGreaterThan(law(packed, 'lift').value);
    expect(law(packed, 'packReach').value).toBeGreaterThan(law(packed, 'reach').value);
  });
  it('fits its giant arms by a pack task, and a pack tool that holds nothing reads no lift', () => {
    const task = Object.keys(MECHA_PACK_TASKS).find((k) => ['r', 'l'].some((S) => MECHA_PACK_TASKS[k][S].tool !== Pk.packMount.loadout[S].tool));
    expect(frameRow(composeFrame(packed, { packTask: task })).packLoadout.r.tool).toBe(MECHA_PACK_TASKS[task].r.tool);
    const idle = Pk.packMount.tools.find((t) => MECHA_TOOLS[t].holds === 0);
    if (idle) expect(law(composeFrame(packed, { packTools: { r: idle, l: idle } }), 'packLift')).toBeUndefined();
    expect(() => composeFrame(Object.keys(MECHA_ARCHETYPES).find((k) => !MECHA_ARCHETYPES[k].packArms), { packTask: task })).toThrow(/carries no giant arm pack/);
    expect(() => composeFrame(packed, { packTools: { r: 'grapple' } })).toThrow(/giant arm takes a tool of/);
  });
  it('sums every arm\'s tools\' flow, the pack\'s with the frame\'s, against its pump', () => {
    const supply = MECHA_ODM[Pk.layout.find((e) => e.id === 'pack').sku].dims.flow;
    const own = ['r', 'l'].reduce((s, S) => s + MECHA_TOOLS[Pk.mount.loadout[S].tool].flow + MECHA_TOOLS[Pk.packMount.loadout[S].tool].flow, 0);
    expect(law(packed, 'flow').value).toBeCloseTo(own / supply, 2);
  });
  it('holds the frame and its pack to every law, its operator inside its cab', () => {
    expect(lawsOf(packed).laws.filter((l) => !l.ok).map((l) => `${l.id}: ${l.says}`)).toEqual([]);
    // (the pack task whose tools draw the most flow, its heaviest working)
    const flows = (k) => MECHA_TOOLS[MECHA_PACK_TASKS[k].r.tool].flow + MECHA_TOOLS[MECHA_PACK_TASKS[k].l.tool].flow;
    const hardest = Object.keys(MECHA_PACK_TASKS).sort((x, y) => flows(y) - flows(x))[0];
    expect(lawsOf(composeFrame(packed, { packTask: hardest })).laws.filter((l) => !l.ok).map((l) => `${hardest} ${l.id}: ${l.says}`)).toEqual([]);
  });
});

describe('mecha shelf: giant arm packs by design house', () => {
  // (a frame carrying a pack, and a house of each actuator, chosen in code)
  const packed = Object.keys(MECHA_ARCHETYPES).find((k) => MECHA_ARCHETYPES[k].packMount), Pk = MECHA_ARCHETYPES[packed];
  const hydraulic = MECHA_MAKER_IDS.find((h) => MECHA_MAKERS[h].actuator === 'hydraulic'), screw = MECHA_MAKER_IDS.find((h) => MECHA_MAKERS[h].actuator === 'screw');
  const law = (key, id) => lawsOf(key).laws.find((l) => l.id === id);
  it('solves a ram\'s pins so its joint turns the whole arc its arm\'s poses ask, wider pins for a wider spread', () => {
    const tight = solveMount('elbow', 0.55, 0.55, { spread: 0.1 }), wide = solveMount('elbow', 0.55, 0.55, { spread: 0.18 });
    expect(wide.arm).toBeGreaterThan(tight.arm);
    for (const h of [hydraulic, screw]) {
      const key = composeFrame(packed, { packMaker: h }), m = MECHA_MAKERS[h], arcs = arcsFor(0.55, Math.round(0.55 * m.fore * 1000) / 1000, Pk.armPoses);
      const J = Pk.packArms.r.joints;
      for (const [joint, arc] of [[J.pitch, arcs.shoulder], [J.elbow, arcs.elbow]]) {
        const [lo, hi] = jointRange(key, joint);
        expect(lo).toBeLessThanOrEqual(arc[0]);
        expect(hi).toBeGreaterThanOrEqual(arc[1]);
      }
    }
  });
  it('sizes its actuators by statics for its rated heave: its lift reaches it unless the frame tips first', () => {
    for (const h of [hydraulic, screw]) {
      const L = law(composeFrame(packed, { packMaker: h }), 'packLift');
      if (L.value < MECHA_MAKERS[h].target) expect(L.says).toMatch(/tips it/);
    }
    const rams = MECHA_ODM[`ram-shoulder-${screw}`];
    expect(rams.build.family).toBe('screw');
    expect(ramForce(rams.dims)).toEqual({ push: rams.dims.force, pull: rams.dims.force });
  });
  it('trades lift for reach by its philosophy: the longest forearm reaches farthest, the shortest lifts most', () => {
    const byFore = [...MECHA_MAKER_IDS].sort((a, b) => MECHA_MAKERS[a].fore - MECHA_MAKERS[b].fore), strong = byFore[0], far = byFore[byFore.length - 1];
    const S = composeFrame(packed, { packMaker: strong }), F = composeFrame(packed, { packMaker: far });
    expect(law(F, 'packReach').value).toBeGreaterThan(law(S, 'packReach').value);
    expect(law(S, 'packLift').value).toBeGreaterThan(law(F, 'packLift').value);
  });
  it('dresses its own parts in its house\'s livery, the frame in its palette, the operator\'s colours over both', () => {
    const key = composeFrame(packed, { packMaker: hydraulic }), m = MECHA_MAKERS[hydraulic];
    const pack = frameRow(key).layout.find((e) => e.id === 'pack');
    expect(pack.sku).toBe(`gap-${hydraulic}`);
    expect(resolveMechaPart(pack.sku, { archetype: key }).garage.colors.paint).toBe(m.livery.paint);
    expect(resolveMechaPart(frameRow(key).layout[0].sku, { archetype: key }).garage.colors.paint).not.toBe(m.livery.paint);
    expect(resolveMechaPart(pack.sku, { archetype: key, colors: { paint: '#123456' } }).garage.colors.paint).toBe('#123456');
  });
  it('takes its house\'s hand for the giant hand, a pack task\'s other tools as they are, and refuses what it has not', () => {
    const key = composeFrame(packed, { packMaker: screw }), a = frameRow(key), claw = (k, S) => frameRow(k).layout.find((e) => e.id === frameRow(k).packArms[S].claw).sku;
    expect(a.packMaker).toBe(screw);
    expect(claw(key, 'r')).toBe(`hand-${screw}`);
    const other = Pk.packMount.tools.find((t) => t !== 'giantHand');
    expect(claw(composeFrame(packed, { packMaker: screw, packTools: { r: other } }), 'r')).toBe(MECHA_TOOLS[other].sku);
    expect(() => composeFrame(packed, { packMaker: 'nobody' })).toThrow(/packMaker 'nobody' is one of/);
    expect(() => composeFrame(Object.keys(MECHA_ARCHETYPES).find((k) => !MECHA_ARCHETYPES[k].packMount), { packMaker: screw })).toThrow(/carries no giant arm pack/);
    expect(readMechaSpec({ archetype: packed, packMaker: screw }).packMaker).toBe(screw);
  });
  it('holds a house\'s frame to every law, at its own loadout and at its hardest pack task', () => {
    const flows = (k) => MECHA_TOOLS[MECHA_PACK_TASKS[k].r.tool].flow + MECHA_TOOLS[MECHA_PACK_TASKS[k].l.tool].flow;
    const hardest = Object.keys(MECHA_PACK_TASKS).sort((x, y) => flows(y) - flows(x))[0];
    for (const h of [hydraulic, screw]) for (const packTask of [undefined, hardest]) {
      expect(lawsOf(composeFrame(packed, { packMaker: h, packTask })).laws.filter((l) => !l.ok).map((l) => `${h} ${packTask ?? ''} ${l.id}: ${l.says}`)).toEqual([]);
    }
  });
});

describe('mecha shelf: a frame hardened for rough ground, dressed in the field\'s look', () => {
  // (the dressed frame, and the frame it hardens: the undressed one on the same saddle, knees bent the same way)
  const field = Object.keys(MECHA_ARCHETYPES).find((k) => MECHA_ARCHETYPES[k].dress), Fd = MECHA_ARCHETYPES[field];
  const base = Object.keys(MECHA_ARCHETYPES).find((k) => !MECHA_ARCHETYPES[k].dress && MECHA_ARCHETYPES[k].bend === Fd.bend && MECHA_ARCHETYPES[k].station === Fd.station);
  const law = (key, id) => lawsOf(key).laws.find((l) => l.id === id);
  const dress = (opts = {}) => { const { manifest, readout } = assembleFrame(field, { finish: false, laws: false }); return dressFaces({ manifest, anchors: readout.anchors, colors: MECHA_PALETTES[Fd.palette], archetype: field }, opts); };
  it('stands steadier, presses softer ground and steps higher than the frame it hardens, and holds every law', () => {
    expect(law(field, 'stability.stand').value).toBeGreaterThan(law(base, 'stability.stand').value);
    expect(law(field, 'groundPressure').value).toBeLessThan(law(base, 'groundPressure').value);
    expect(law(field, 'step').value).toBeGreaterThan(law(base, 'step').value);
    expect(law(field, 'belly').value).toBeGreaterThan(0.5);
    expect(lawsOf(field).laws.filter((l) => !l.ok).map((l) => `${l.id}: ${l.says}`)).toEqual([]);
  });
  it('stands its cleated sole on its lugs: nothing of the foot below the sole the legs are solved to', () => {
    const e = Fd.layout.find((x) => x.id === Fd.legs.r.foot), sole = mechaCtx(field).hp(e.id, 'sole')[2];
    const low = Math.min(...partShape(field, e.sku, e.side).corners.map((c) => c[2]));
    expect(low).toBeGreaterThanOrEqual(sole - 1e-6);
    expect(low - sole).toBeLessThan(0.003);
  });
  it('places its kit\'s anchors where their bodies stand, each surface\'s out and up a frame', () => {
    const { readout } = assembleFrame(field, { laws: false });
    expect(readout.anchors.map((a) => a.id)).toEqual(Fd.dress.kit.map((k) => k.id));
    for (const a of readout.anchors) {
      expect(Math.hypot(...a.out)).toBeCloseTo(1, 3);
      expect(a.out[0] * a.up[0] + a.out[1] * a.up[1] + a.out[2] * a.up[2]).toBeCloseTo(0, 3);
    }
    expect(assembleFrame(base, { laws: false }).readout.anchors).toBeUndefined();
  });
  it('dresses deterministically: its kit fitted, a camo cut into its paint, a harder wear caking more mud', () => {
    const plain = dress(), camo = dress({ livery: 'woodland' }), clean = dress({ wear: 'pristine' }), hard = dress({ wear: 'battered' });
    expect(dress()).toEqual(plain);
    const { manifest } = assembleFrame(field, { finish: false, laws: false });
    expect(plain.length).toBeGreaterThan(lowerAssemblerFaces(manifest).length);
    expect(camo.length).toBeGreaterThan(plain.length);
    expect(new Set(camo.map((f) => f.fill)).size).toBeGreaterThan(new Set(plain.map((f) => f.fill)).size);
    expect(hard.length).toBeGreaterThan(clean.length);
  });
  it('closes its rider in an armoured cabin as an option: held inside its walls, its mass on the class\'s, every law holding', () => {
    const [name, cab] = Object.entries(Fd.cabins).find(([, c]) => c.sku !== Fd.cabins.open.sku), key = composeFrame(field, { cabin: name });
    expect(composeFrame(field, { cabin: 'open' })).toBe(field);
    expect(frameRow(key).layout.find((e) => e.id === 'cage').sku).toBe(cab.sku);
    expect(frameRow(key).mass).toBe(Fd.mass + cab.mass);
    expect(law(key, 'cab').ok).toBe(true);
    expect(law(field, 'cab')).toBeUndefined();
    expect(lawsOf(key).laws.filter((l) => !l.ok).map((l) => `${l.id}: ${l.says}`)).toEqual([]);
  });
  it('sees out through no glass: its vision slits under lids, open or shut, and a camera unit; the lids alone move', () => {
    const sku = Object.values(Fd.cabins).find((c) => c.sku !== Fd.cabins.open.sku).sku, C = MECHA_PALETTES[Fd.palette];
    const open = resolveMechaPart(sku, { finish: false }), shut = resolveMechaPart(sku, { part: 'shut', finish: false });
    const glassy = ['extrudes', 'lathes', 'lofts', 'sweeps'].flatMap((k) => open[k] ?? []).filter((m) => m.tint === C.glass).map((m) => m.id);
    expect(glassy.length).toBeGreaterThan(0);
    expect(glassy.every((id) => /lens/i.test(id))).toBe(true);
    const lids = (r) => r.extrudes.filter((m) => /Lid$/.test(m.id));
    expect(lids(open).length).toBeGreaterThan(2);
    expect(lids(open)).not.toEqual(lids(shut));
    expect(open.extrudes.filter((m) => !/Lid$/.test(m.id))).toEqual(shut.extrudes.filter((m) => !/Lid$/.test(m.id)));
    expect(open.garage.hardpoints).toEqual(shut.garage.hardpoints);
    const key = composeFrame(field, { cabin: 'armoured', slits: 'shut' });
    expect(frameRow(key).layout.find((e) => e.id === 'cage').part).toBe('shut');
    expect(() => composeFrame(field, { slits: 'shut' })).toThrow(/slits are a closed cabin's/);
    expect(() => composeFrame(field, { cabin: 'armoured', slits: 'ajar' })).toThrow(/'open' or 'shut'/);
    expect(() => composeFrame(field, { cabin: 'tent' })).toThrow(/cabin 'tent' is one of/);
    expect(() => composeFrame(base, { cabin: 'armoured' })).toThrow(/its cabin is its own/);
    expect(readMechaSpec({ archetype: field, cabin: 'armoured', slits: 'shut' }).cabin).toBe('armoured');
  });
  it('takes a livery and a wear on a dressed frame only, read as the field\'s words', () => {
    expect(readMechaSpec({ archetype: field, livery: 'desert', wear: 'battered' }).livery).toBe('desert');
    expect(() => readMechaSpec({ archetype: field, livery: 'paisley' })).toThrow(/livery/);
    expect(() => readMechaSpec({ archetype: field, wear: 'shiny' })).toThrow(/wear/);
    expect(() => readMechaSpec({ archetype: base, livery: 'woodland' })).toThrow(/wears no dress/);
  });
});

describe('mecha shelf: a functional backpack, its payloads and its service tail', () => {
  // (a frame that takes a backpack, and the backpack, chosen in code)
  const carrier = Object.keys(MECHA_ARCHETYPES).find((k) => MECHA_ARCHETYPES[k].backpacks?.length), Ab = MECHA_ARCHETYPES[carrier];
  const name = Ab.backpacks[0], BPc = MECHA_BACKPACKS[name], key = composeFrame(carrier, { backpack: name });
  const law = (k, id) => lawsOf(k).laws.find((l) => l.id === id);
  it('takes the power pack\'s place: its payloads on its mounts, its tail, its parts asked heavier, its mass on the class\'s', () => {
    const A = frameRow(key);
    expect(A.layout.find((e) => e.id === 'pack').sku).toBe(BPc.sku);
    for (const S of BPc.mounts) expect(A.layout.find((e) => e.id === `weapon${S.toUpperCase()}`).sku).toBe(MECHA_WEAPONS[BPc.loadout[S]].sku);
    for (const [from, to] of Object.entries(BPc.swap ?? {})) { expect(A.layout.some((e) => e.sku === from)).toBe(false); expect(A.layout.some((e) => e.sku === to)).toBe(true); }
    expect(A.mass).toBe(Ab.mass + BPc.mass);
    if (Ab.dress) expect(A.dress.kit.some((k) => k.body === 'pack')).toBe(false);
    expect(Object.keys(A.joints)).toEqual(expect.arrayContaining(Object.values(A.tail.joints)));
  });
  it('reaches every service point with its tail from above, within its drives\' stops, its grip on the point', () => {
    const ctx = mechaCtx(key), A = ctx.arch;
    for (const [st, T] of Object.entries(TAIL_POSES).filter(([, t]) => t.at)) {
      const P = posedFrame(key, st), F = framesOf(A, P.joints, ctx), dot = T.at.indexOf('.'), body = T.at.slice(0, dot);
      expect(P.clamped).toEqual([]);
      expect(P.reached).toBe(true);
      const grip = apply(F[A.tail.head], ctx.hp(A.tail.head, 'grip')), want = apply(F[body], ctx.hp(body, T.at.slice(dot + 1)));
      for (let k = 0; k < 3; k++) expect(grip[k]).toBeCloseTo(want[k], 2);
    }
  });
  it('holds its tail and a magazine on its drives, fires braced without being pushed over, its backblast and its fire clear of the rider', () => {
    expect(law(key, 'tailTorque').ok).toBe(true);
    expect(law(key, 'recoil')).toMatchObject({ ok: true });
    expect(law(key, 'recoil').says).toMatch(/braced/);
    expect(law(key, 'backblast').ok).toBe(true);
    expect(law(key, 'fireClear').ok).toBe(true);
    expect(law(carrier, 'recoil')).toBeUndefined();
    expect(lawsOf(key).laws.filter((l) => !l.ok).map((l) => `${l.id}: ${l.says}`)).toEqual([]);
  });
  it('swaps its payloads side for side, every law holding, and refuses what it does not take', () => {
    const [r, l] = BPc.mounts, swapped = composeFrame(carrier, { backpack: name, weapons: { [r]: BPc.loadout[l], [l]: BPc.loadout[r] } });
    expect(frameRow(swapped).weapons).toEqual({ [r]: BPc.loadout[l], [l]: BPc.loadout[r] });
    expect(lawsOf(swapped).laws.filter((x) => !x.ok).map((x) => `${x.id}: ${x.says}`)).toEqual([]);
    expect(() => composeFrame(carrier, { weapons: { r: BPc.loadout.r } })).toThrow(/weapons are a backpack's/);
    expect(() => composeFrame(carrier, { backpack: name, weapons: { r: 'catapult' } })).toThrow(/mount takes/);
    expect(() => composeFrame(carrier, { backpack: name, weapons: { x: BPc.loadout.r } })).toThrow(/mounts are/);
    expect(() => composeFrame(carrier, { backpack: 'jetpack' })).toThrow(/backpack 'jetpack'/);
    expect(() => composeFrame(Object.keys(MECHA_ARCHETYPES).find((k) => !MECHA_ARCHETYPES[k].backpacks), { backpack: name })).toThrow(/it takes none/);
    expect(readMechaSpec({ archetype: carrier, backpack: name, weapons: { r: BPc.loadout.r } }).backpack).toBe(name);
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
