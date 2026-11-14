import { describe, it, expect } from 'vitest';
import { LIFE, lifeErrors, hasLife, flowLife, lifeFaces, lifeDims } from './life.js';
import { FLOW } from '../geocity/flow.js';
import { sceneScreenplay, sceneStamp } from './film.js';
import { departmentOfPath, ADVICE_HOME } from './departments.js';

// the set's life: a metro's traffic plan read with the page's own model, about where a scene is played.
// The smallest plan that still drives: one lane along y with two vehicles, one crossing far up it.
const T = { ...FLOW.T, CLEARANCE: 7, CAR_LEN: 5, CAR_WID: 2 };
const lane = (over = {}) => ({ axis: 'y', cross: 10, lo: 0, hi: 600, dir: 1, total: 600, speed: 12, crossings: [], ground: [0, 2, 300, 2, 600, 8], ...over });
const flow = (lanes = [lane()], cars = [[0, 0, 0, 0.1], [0, 0, 1, 0.5]]) => ({
  T, near: 320, signals: [{ x: 5000, y: 5000, cycle: 2 * (T.GREEN + T.AMBER + T.CLEARANCE), offset: 0, streetW: 12 }],
  kinds: [{ model: 'familySedan', len: 4.88, wid: 2.05 }], tints: [[1, 0, 0], [0, 0, 1]], lanes, cars,
});

describe('the set\'s life', () => {
  it('is asked as true or by its clock, reach and most', () => {
    expect(lifeErrors(true)).toEqual([]);
    expect(lifeErrors({ clock: 30, reach: 60, most: 4 })).toEqual([]);
    expect(lifeErrors('busy')[0]).toMatch(/life: true/);
    expect(lifeErrors({ cars: 3 })[0]).toMatch(/not cars/);
    expect(lifeErrors({ most: 0 })[0]).toMatch(/life\.most/);
  });

  it('reads a world that moves, and nothing from one that does not', () => {
    expect(hasLife({ flow: flow() })).toBe(true);
    expect(hasLife({ faces: [] })).toBe(false);
    expect(flowLife(null, { about: [0, 0], seconds: 5 })).toEqual([]);
  });

  it('keys each vehicle within reach along its lane, on the road, facing as it drives', () => {
    const F = flow(), L = flowLife(F, { about: [10, 300], seconds: 4, reach: 60 });
    // (the one that starts mid-lane is near; the one far down it is not)
    expect(L).toHaveLength(1);
    const V = L[0];
    expect(V).toMatchObject({ model: 'familySedan', tint: [0, 0, 1], len: 4.88 });
    expect(V.keys[0].t).toBe(0);
    expect(V.keys.at(-1).t).toBe(4);
    expect(V.keys).toHaveLength(Math.ceil(4 / LIFE.key) + 1);
    // (along +y at the lane's speed, on the lane, the road rising under it)
    for (const k of V.keys) { expect(k.x).toBe(10); expect(k.turn).toBe(0); }
    expect(V.keys.at(-1).y - V.keys[0].y).toBeCloseTo(48, 0);
    expect(V.keys.at(-1).z).toBeGreaterThan(V.keys[0].z);
    // (the other way, and across: it faces where it goes)
    expect(flowLife(flow([lane({ dir: -1 })]), { about: [10, 300], seconds: 2, reach: 80 })[0].keys[0].turn).toBe(180);
    const X = flowLife(flow([lane({ axis: 'x' })]), { about: [300, 10], seconds: 2, reach: 80 })[0];
    expect(X.keys[0].turn).toBe(90);
    expect(X.keys[0].y).toBe(10);
  });

  it('is the same read twice, starts at the world\'s clock, and keeps to how many are asked', () => {
    const F = flow(), ask = { about: [10, 300], seconds: 3, reach: 320 };
    expect(JSON.stringify(flowLife(F, ask))).toBe(JSON.stringify(flowLife(F, ask)));
    expect(flowLife(F, ask)).toHaveLength(2);
    expect(flowLife(F, { ...ask, most: 1 })).toHaveLength(1);
    const later = flowLife(F, { ...ask, clock: 5 });
    expect(later.find((v) => v.id === 'flow:0:1').keys[0].y - flowLife(F, ask).find((v) => v.id === 'flow:0:1').keys[0].y).toBeCloseTo(60, 0);
  });

  it('leaves out a vehicle that goes round the lane\'s ring during the scene', () => {
    // (a short ring: the vehicle goes out at one end and comes in at the other within the scene)
    const F = flow([lane({ hi: 150, total: 150, ground: [0, 0, 150, 0] })], [[0, 0, 0, 0.5]]);
    expect(flowLife(F, { about: [10, 140], seconds: 2, reach: 300 })).toHaveLength(1);
    expect(flowLife(F, { about: [10, 140], seconds: 8, reach: 300 })).toHaveLength(0);
  });

  it('builds a vehicle as the parked ones are, its paint the tint\'s', () => {
    const red = lifeFaces({ model: 'familySedan', tint: [1, 0, 0] }), white = lifeFaces({ model: 'familySedan', tint: [1, 1, 1] });
    expect(red.length).toBe(white.length);
    expect(red.some((f, i) => f.fill !== white[i].fill)).toBe(true);
    expect(red.filter((f, i) => f.fill !== white[i].fill).every((f) => /^#[0-9a-f]{2}0000$/.test(f.fill))).toBe(true);
    expect(lifeFaces({ model: 'familySedan', extra: 'taxi-sign' }).length).toBeGreaterThan(white.length);
    const [w, l, h] = lifeDims('familySedan');
    expect(l).toBeGreaterThan(w);
    expect(w).toBeGreaterThan(h * 0.9);
  });

  it('is a scene\'s key, the set department\'s, and a change of it remakes the scene', () => {
    const F = { cast: { a: {} }, scenes: [{ id: 'x', life: true, cast: { a: {} }, script: 'A: Hi.' }] };
    expect(sceneScreenplay(F, 'x').life).toBe(true);
    expect(sceneStamp(F, 'x')).not.toBe(sceneStamp({ ...F, scenes: [{ ...F.scenes[0], life: { clock: 40 } }] }, 'x'));
    expect(departmentOfPath('/scenes/0/life')).toBe('set');
    expect(ADVICE_HOME['life-unused']).toBe('set');
    expect(ADVICE_HOME['life-crosses']).toBe('set');
  });
});
