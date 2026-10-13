import { describe, it, expect } from 'vitest';
import { drawnPlan, creatureJoints, creatureBodyParts, headAtTier, adornAtTier, BRIDGE_MIN_PX, READ_PX, TUFT_MIN_PX } from './creature-drawn.js';
import { headPlan } from '../creature-heads/index.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered } from './station-loft.js';
import { keepsSilhouette } from './silhouette-gates.js';

// a digitigrade leg under a hip block, the creature door's grammar: segments chained by their binds
const LEG = Object.freeze({
  schema: 'layered-plan-v1', frame: { up: '+z', front: '+y' },
  joints: { hip: [0.15, 0, 0.9], knee: [0.17, 0.12, 0.52], hock: [0.18, -0.12, 0.22], toe: [0.18, 0.06, 0.02], claw: [0.18, 0.09, 0.015] },
  segments: [
    { name: 'pelvis', kind: 'trunk', stations: [{ z: 0.8, r: [0.22, 0.16] }, { z: 1.0, r: [0.24, 0.17] }, { z: 1.25, r: [0.26, 0.18] }], caps: { back: [0, 0, 0.72], tip: [0, 0, 1.35] }, group: 'Body', tint: '#a08870', mirror: 'plane', bind: { bone: 'pelvis' } },
    { name: 'thighR', kind: 'segment', from: 'hip', to: 'knee', rA: 0.11, rB: 0.08, group: 'Legs', tint: '#a08870', mirror: 'name', bind: { bone: 'thighR', prev: 'pelvis', next: 'shinR' } },
    { name: 'shinR', kind: 'segment', from: 'knee', to: 'hock', rA: 0.075, rB: 0.05, group: 'Legs', tint: '#a08870', mirror: 'name', bind: { bone: 'shinR', prev: 'thighR', next: 'metaR' } },
    { name: 'metaR', kind: 'segment', from: 'hock', to: 'toe', rA: 0.045, rB: 0.035, group: 'Legs', tint: '#a08870', mirror: 'name', bind: { bone: 'metaR', prev: 'shinR', next: 'clawR' } },
    // a claw: its knuckle too small at the target to show a bend, so it keeps the shared overshoot ring
    { name: 'clawR', kind: 'segment', from: 'toe', to: 'claw', rA: 0.008, rB: 0.004, group: 'Claws', tint: '#333333', mirror: 'name', bind: { bone: 'clawR', prev: 'metaR' } },
  ],
  dials: {},
});
const drawn = (target) => ({ ...LEG, style: { drawn: target ? { target } : true } });
const meshOf = (plan) => compileLayered(expandPlan(drawnPlan(plan)), {}, { details: false, creases: false });

describe('the drawn creature', () => {
  it('absent `style.drawn`, the plan is itself: the same object, the same recipe', () => {
    expect(drawnPlan(LEG)).toBe(LEG);
    expect(JSON.stringify(expandPlan(drawnPlan(LEG)))).toBe(JSON.stringify(expandPlan(LEG)));
  });

  it('bridges every joint its bind chains name that reads at the target: the knee and the hock, not the claw', () => {
    const plan = drawn(), J = creatureJoints({ ...plan, style: { slots: 'ring8', limbSlots: 'limb6', ...plan.style } });
    expect(J.map((j) => [j.bridge, j.upper, j.lower])).toEqual([['shinBridgeR', 'thighR', 'shinR'], ['metaBridgeR', 'shinR', 'metaR']]);
    expect(BRIDGE_MIN_PX).toBe(4);
    const parts = expandPlan(drawnPlan(plan)).parts;
    for (const n of ['shinBridgeR', 'shinBridgeL', 'metaBridgeR', 'metaBridgeL']) expect(parts[n]?.layer).toBe(1);
    expect(parts.clawBridgeR).toBeUndefined();
    // the bridge wears its upper limb's tint (a creature colours by tint where its palette names no group)
    expect(parts.shinBridgeR.tint).toBe('#a08870');
    expect(creatureBodyParts(plan)).toEqual(['pelvis', 'thighR', 'shinR', 'metaR', 'clawR']);
  });

  it('keeps the creature\'s outline (the test silhouette gate) while it spends more triangles where its target reads them', () => {
    const before = compileLayered(expandPlan(LEG), {}, { details: false, creases: false }), after = meshOf(drawn());
    const kept = keepsSilhouette(before, after);
    expect(kept.ok).toBe(true);
    expect(after.faces.length).toBeGreaterThan(before.faces.length);
    // a closer target asks more of the outline than a far one (seen top-down at 480p, the hip reads in a few pixels)
    expect(meshOf(drawn({ resolution: '1080p', framing: 'close' })).faces.length).toBeGreaterThan(meshOf(drawn({ resolution: '480p', framing: 'top-down' })).faces.length);
  });

  it('spends by what reads: at a third-person 1080p a whisker, a wrinkle and a short tuft are gone; at a close-up they stay', () => {
    const wolf = headPlan('wolf'), far = headAtTier(wolf, 170), near = headAtTier(wolf, 2000);
    expect(2 * wolf.regions.whiskers.r * 170).toBeLessThan(READ_PX);
    expect(far.regions.whiskers).toBeUndefined();
    expect(far.regions.wrinkles).toBeUndefined();
    expect(near.regions.whiskers).toEqual(wolf.regions.whiskers);
    expect(near.regions.wrinkles).toEqual(wolf.regions.wrinkles);
    // the eye's surround: the sides its outline asks, fewer far than near
    expect(far.regions.orbit.sections).toBeLessThan(near.regions.orbit.sections);
    expect(far.regions.orbit.sections).toBeGreaterThanOrEqual(8);
    // tufts by their height: the head's own fur reads (4 cm at 170 px a metre is 6.8 px), a short tuft would not
    expect(far.regions.tiles?.length ?? 0).toBe(wolf.regions.tiles.filter((T) => T.height * 170 >= TUFT_MIN_PX).length);
    // a ribbon's rows by its length on screen, a chain's links by their loop
    const wrap = adornAtTier({ id: 'w', signature: { kind: 'ribbon', spine: [[0, 0, 0], [0, 0, -0.09]], width: 0.022 } }, 170).signature;
    expect(wrap.rows).toBeLessThan(12);
    expect(wrap.cols).toBeGreaterThanOrEqual(2);
    const cord = adornAtTier({ id: 'c', signature: { kind: 'medallion', links: 5, len: 0.04, link: 0.005, r: 0.05, m: 14 } }, 170).signature;
    expect(cord.linkSides[0]).toBeLessThan(10);
    expect(cord.m).toBeLessThanOrEqual(14);
  });

  it('the density is the target\'s, not the author\'s: a hand-written refine of a part the rule sets is dropped', () => {
    const authored = { ...drawn(), body: { refine: [{ parts: ['thighR', 'thighL', 'shinR', 'shinL'] }] } };
    const refine = drawnPlan(authored).body.refine, named = refine.flatMap((e) => e.parts);
    // the rule's own entries name them (split for the target), the author's does not survive as its own entry
    expect(refine.some((e) => e.parts.length === 4 && e.slots === undefined)).toBe(false);
    expect(named).toContain('thighR');
  });
});
