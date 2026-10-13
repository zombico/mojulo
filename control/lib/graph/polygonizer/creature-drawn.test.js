import { describe, it, expect } from 'vitest';
import { drawnPlan, creatureJoints, creatureBodyParts, BRIDGE_MIN_PX } from './creature-drawn.js';
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
});
