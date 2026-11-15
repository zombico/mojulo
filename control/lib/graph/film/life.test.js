import { describe, it, expect } from 'vitest';
import { LIFE, lifeErrors, hasLife, flowLife, walkLife, carLife, carFaces, lifeFaces, lifeDims } from './life.js';
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

  it('reads a city\'s people in metres, facing as they go, the gait\'s phase from the ground covered', () => {
    const fig = { rig: true, bones: [], parts: [], clips: {}, figH: 2 };
    const square = [[0, 0, 0], [20, 0, 0], [20, 20, 0], [0, 20, 0], [0, 0, 0]];
    const P = { metersPerUnit: 2, figures: { p: fig, d: fig }, walkers: [{ figure: 'd', path: square, speed: 1, follow: true }, { figure: 'p', path: square, speed: 1, scale: 0.5 }] };
    expect(hasLife(P)).toBe(true);
    expect(hasLife({ ...P, walkers: [P.walkers[0]] })).toBe(false);
    const L = walkLife(P, { about: [0, 0], seconds: 4, reach: 50 });
    // (the followed walker is the viewer's; the other is counted as the page counts it)
    expect(L.map((W) => W.id)).toEqual(['walker:1']);
    const W = L[0];
    expect(W).toMatchObject({ figure: 'p', hgt: 2 });
    // (a unit a second along +x is two metres a second; a stride is 0.72 of its height)
    expect(W.keys.at(-1)).toMatchObject({ t: 4, x: 8, y: 0, turn: 90 });
    expect(W.keys.at(-1).p).toBeCloseTo(8 / 1.44, 2);
    expect(W.keys.every((k, i) => !i || k.p >= W.keys[i - 1].p)).toBe(true);
    // (round a corner it turns the short way; out of reach it is not read)
    const far = walkLife(P, { about: [0, 0], seconds: 25, reach: 50 })[0].keys;
    expect(far.at(-1).turn).toBe(0);
    expect(walkLife(P, { about: [500, 500], seconds: 4, reach: 50 })).toEqual([]);
    expect(JSON.stringify(walkLife(P, { about: [0, 0], seconds: 4 }))).toBe(JSON.stringify(walkLife(P, { about: [0, 0], seconds: 4 })));
  });

  it('reads a planned city\'s cars on their lanes, at their baked size, their mesh turned to face +y', () => {
    // (one triangle, nose along +x, in linear light: mid grey 0.2159 is sRGB 128)
    const pos = Buffer.from(new Float32Array([1, 0, 0, -1, 0.4, 0, -1, -0.4, 0.5]).buffer).toString('base64'), col = Buffer.from(new Uint8Array(9).fill(55)).toString('base64');
    const P = { metersPerUnit: 2, carMeshes: { c: { pos, col, len: 2, wid: 0.8 } }, cars: [{ car: 'c', path: [[0, 5, 0.1], [100, 5, 0.1]], speed: 2 }] };
    expect(hasLife(P)).toBe(true);
    const [V] = carLife(P, { about: [0, 10], seconds: 4, reach: 30 });
    expect(V).toMatchObject({ id: 'car:0', car: 'c', dims: [1.6, 4, 1], wid: 1.6 });
    expect(V.keys[0]).toMatchObject({ t: 0, x: 0, y: 10, z: 0.2, turn: 90 });
    expect(V.keys.at(-1).x).toBeCloseTo(16, 1);
    expect(V.keys.every((k) => k.p === undefined)).toBe(true);
    const [F] = carFaces(P.carMeshes.c);
    expect(F.corners[0]).toEqual([0, 1, 0]);
    expect(F.cornerFills[0]).toBe('#808080');
    // (a car that relands at its lane's start during the scene is left out)
    expect(carLife(P, { about: [190, 10], seconds: 12, reach: 60 })).toEqual([]);
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
