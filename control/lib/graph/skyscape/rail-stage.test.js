// THE RAIL STAGE (skyscape/rail-stage.js): a stage laid down a path through an airspace. On a planet a canyon's floor
// skimmed at least a floor over its ground, the box narrower than the floor; in space a field of rocks, none on the way's
// line; each with waves posted ahead of their marks, hazards that leave a way past, and a boss at the path's end. The
// same map and seed, the same stage; what it cannot lay is refused, teaching.
import { describe, expect, it } from 'vitest';

import { planRailStage, railPathFrame, RAIL } from './rail-stage.js';
import { airspaceOf, validateAirspace } from './airspace.js';

const CANYON = { kind: 'airspace', map: { form: 'canyon', craft: 'multirole' }, rail: { speed: 120, waves: 3 }, seed: 4 };
const VOID = { kind: 'airspace', map: { craft: 'fighter', field: 6000 }, space: { asteroids: 'field' }, rail: { speed: 60 }, seed: 4 };
const stageOf = (m) => { const { map, field } = airspaceOf(m); return { S: planRailStage(map, field, { seed: m.seed, ...m.rail }), map, field }; };

describe('the rail stage', () => {
  it('a canyon: the way skims its floor, at least the floor over the ground all along', () => {
    const { S, field } = stageOf(CANYON);
    expect(S.laws.every((l) => l.ok), JSON.stringify(S.laws)).toBe(true);
    for (let s = 0; s <= S.length; s += 50) { const q = railPathFrame(S.path, s).p; expect(q[2] - field.groundAt(q[0], q[1])).toBeGreaterThanOrEqual(RAIL.floor - 1e-6); }
    expect(S.rule).toMatchObject({ type: 'rail', speed: 120, floor: RAIL.floor, box: RAIL.box });
    expect(S.seconds).toBeGreaterThanOrEqual(RAIL.minS);
    // pillars in the way, standing from the ground up past the box
    expect(S.hazards.length).toBeGreaterThan(2);
    for (const h of S.hazards) expect(h.size[2]).toBeGreaterThan(RAIL.box.hz);
    // down a gorge: the way on its line, walls over it on both sides (the law says so)
    expect(field.gorge).toBeTruthy();
    for (const q of S.path) expect(Math.abs(q[1] - field.gorge.line(q[0]))).toBeLessThan(1e-6 + 0.01);
    expect(S.laws.find((l) => l.law === 'walled')?.ok).toBe(true);
  });

  it('a ground with no gorge (`gorge: false`) lays the canyon open: no gorge, no walled law', () => {
    const { S, field } = stageOf({ ...CANYON, ground: { gorge: false } });
    expect(field.gorge).toBeUndefined();
    expect(S.laws.some((l) => l.law === 'walled')).toBe(false);
  });

  it('space: the way through the rocks, none on its line; rocks let in as its hazards; no floor', () => {
    const { S, field } = stageOf(VOID);
    expect(S.laws.every((l) => l.ok), JSON.stringify(S.laws)).toBe(true);
    for (let s = 0; s <= S.length; s += 20) { const q = railPathFrame(S.path, s).p; expect(field.hitAt(q[0], q[1], q[2], 4)).toBe(false); }
    expect(field.asteroids.length).toBeGreaterThan(10);
    expect(S.rule.floor).toBeUndefined();
    expect(S.hazards.every((h) => !h.size)).toBe(true);
  });

  it('waves posted ahead of their marks, every fighter named once; the boss at the path\'s end; the same seed the same stage', () => {
    const { S } = stageOf(CANYON);
    expect(S.waves.length).toBe(3);
    const ids = S.foes.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(S.waves.flatMap((w) => w.foes)).toEqual(ids);
    for (let w = 1; w < S.waves.length; w++) expect(S.waves[w].along).toBeGreaterThan(S.waves[w - 1].along);
    expect(S.boss.parts.map((p) => p.id)).toEqual(['boss-core', 'boss-gun-1', 'boss-gun-2']);
    expect(JSON.stringify(stageOf(CANYON).S)).toBe(JSON.stringify(S));
  });

  it('refuses a stage it cannot lay, teaching', () => {
    expect(validateAirspace({ kind: 'airspace', map: { form: 'island' }, rail: true }).join(' ')).toMatch(/a ground stage runs down a canyon/);
    expect(validateAirspace({ kind: 'airspace', map: { form: 'canyon' }, rail: { lanes: 3 } }).join(' ')).toMatch(/rail is true or \{ speed\?, waves\?, per\? \}/);
    expect(validateAirspace({ kind: 'airspace', map: { form: 'canyon' }, rail: true, course: true }).join(' ')).toMatch(/a rail stage has its path, not a course/);
    expect(() => stageOf({ ...CANYON, rail: { speed: 400 } })).toThrow(/under the 70 s a stage needs/);
  });
});
