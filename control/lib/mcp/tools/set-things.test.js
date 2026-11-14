import { describe, it, expect } from 'vitest';
import { readThing, thingPayload, thingScale, THING_SHELVES } from './set-things.js';
import { prepareScreenplay, screenplayErrors, arrivalKeys } from './scene-film.js';
import { PROP_KINDS } from '@/lib/graph/era/props.js';
import { FURNITURE_STYLES } from '@/lib/graph/furnishings/forms.js';
import { VEHICLES } from '@/lib/graph/vehicle-registry/roster.js';
import { dimsOf } from '@/lib/graph/vehicle-registry/builds.js';

// a set dressed by word: one thing per shelf (each shelf is one procedure), chosen from the shelf itself
const PROP = PROP_KINDS[0], STYLE = Object.keys(FURNITURE_STYLES)[0];
const CAR = Object.keys(VEHICLES).find((id) => dimsOf(id)?.L);
const extent = (faces) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const f of faces) for (const c of f.corners) for (const i of [0, 1, 2]) { lo[i] = Math.min(lo[i], c[i]); hi[i] = Math.max(hi[i], c[i]); } return hi.map((v, i) => v - lo[i]); };

describe('a thing by its word', () => {
  it('is found on the shelf that has it, as people say it', () => {
    expect(readThing(PROP)).toMatchObject({ shelf: 'prop', id: PROP });
    expect(readThing(`a ${STYLE.replace(/-/g, ' ')}`)).toMatchObject({ shelf: 'furniture', like: STYLE });
    const V = readThing(`the ${VEHICLES[CAR].label ?? CAR}`);
    expect(V).toMatchObject({ shelf: 'vehicle', id: CAR });
    expect(V.metres[0]).toBe(dimsOf(CAR).L);
    for (const T of [readThing(PROP), readThing(STYLE), V]) expect(THING_SHELVES).toContain(T.shelf);
  });

  it('a word no shelf has is refused, naming what the shelves have', () => {
    expect(() => readThing('unicorn')).toThrow(/on no shelf.*Props: .*Furniture: .*Vehicles: /s);
    expect(() => readThing('')).toThrow(/named by a word/);
  });

  it('has a form, never stored: a prop built on its own, a piece of furniture at its size', async () => {
    const P = await thingPayload(readThing(PROP));
    expect(P.faces.length).toBeGreaterThan(0);
    const F = await thingPayload(readThing(STYLE)), k = F.metersPerUnit ?? 1, size = extent(F.faces).map((v) => v * k);
    // (a piece of furniture is made in millimetres: read in metres it is the size of furniture)
    expect(Math.max(...size)).toBeGreaterThan(0.3);
    expect(Math.max(...size)).toBeLessThan(4);
  });

  it('stands at the size its shelf measures', () => {
    expect(thingScale({ metres: [4.8, 1.8, 1.4] }, [1.2, 2.4, 0.7])).toBe(2);
    expect(thingScale({ metres: null }, [1, 2, 3])).toBe(1);
  });
});

describe('a scene dressed by word', () => {
  const sp = (props) => ({ cast: { ada: {}, jon: {} }, props, script: 'ADA: Hello.\nJON: Hello.' });

  it('stands the thing in the scene, its name a place, with nothing minted', async () => {
    const { set, screenplay } = await prepareScreenplay(sp({ box: { thing: PROP, at: [3, 2] } }), { getRow: () => null });
    expect(set.props).toHaveLength(1);
    expect(set.props[0]).toMatchObject({ name: 'box', thing: PROP, shelf: 'prop', at: [3, 2] });
    expect(set.props[0].ref).toBeUndefined();
    expect(screenplay.marks.box).toBeDefined();
    expect(set.faces.length).toBeGreaterThan(0);
  });

  it('takes a word or a ref, not both, and says so', () => {
    expect(screenplayErrors(sp({ box: { thing: PROP, ref: 'sk_x', at: [0, 0] } })).join()).toMatch(/not both/);
    expect(screenplayErrors(sp({ box: { at: [0, 0] } })).join()).toMatch(/thing, a word a shelf knows/);
    expect(screenplayErrors(sp({ box: { thing: PROP, at: [0, 0] } }))).toEqual([]);
  });

  it('a word no shelf has is refused with the prop\'s name', async () => {
    await expect(prepareScreenplay(sp({ beast: { thing: 'unicorn', at: [0, 0] } }), { getRow: () => null })).rejects.toThrow(/props\.beast\.thing: 'unicorn' is on no shelf/);
  });
});

describe('a thing that arrives', () => {
  const sp = (props) => ({ cast: { ada: {}, jon: {} }, props, script: 'ADA: Hello.\nJON: Hello.' });

  it('comes from somewhere to where it stands: read where it rests, facing the way it came, with how long it takes', async () => {
    const { set } = await prepareScreenplay(sp({ box: { thing: PROP, at: [3, 10], from: [3, 3], start: 2, speed: 3.5 } }), { getRow: () => null });
    expect(set.props[0]).toMatchObject({ name: 'box', at: [3, 10], move: { from: [3, 3], start: 2, seconds: 2 } });
    // it came along +y: no turn; along +x it is turned a quarter
    expect(set.props[0].turn).toBeUndefined();
    const east = (await prepareScreenplay(sp({ box: { thing: PROP, at: [10, 3], from: [3, 3] } }), { getRow: () => null })).set.props[0];
    expect(east.turn).toBe(90);
    expect(east.move.seconds).toBe(5);
    // (a turn of its own wins; a thing that stands has no move)
    expect((await prepareScreenplay(sp({ box: { thing: PROP, at: [10, 3], from: [3, 3], turn: 15 } }), { getRow: () => null })).set.props[0].turn).toBe(15);
    expect((await prepareScreenplay(sp({ box: { thing: PROP, at: [10, 3] } }), { getRow: () => null })).set.props[0].move).toBeUndefined();
  });

  it('is keyed along its way on the scene\'s clock, on the ground under it', () => {
    const Q = { at: [3, 10], move: { from: [3, 3], start: 2, seconds: 3.5 } };
    const K = arrivalKeys(Q);
    expect(K[0]).toEqual({ t: 2, x: 3, y: 3 });
    expect(K.at(-1)).toEqual({ t: 5.5, x: 3, y: 10 });
    expect(K.length).toBe(5);
    for (let i = 1; i < K.length; i++) expect(K[i].t).toBeGreaterThan(K[i - 1].t);
    // on land that rises and falls each key takes the ground's height
    expect(arrivalKeys(Q, (x, y) => y / 10).map((k) => k.z)).toEqual([0.3, 0.475, 0.65, 0.825, 1]);
    expect(arrivalKeys({ at: [0, 0] })).toBe(null);
  });

  it('says what it takes', async () => {
    expect(screenplayErrors(sp({ box: { thing: PROP, at: [0, 0], from: 7 } })).join()).toMatch(/from: where it comes from/);
    expect(screenplayErrors(sp({ box: { thing: PROP, at: [0, 0], start: 2 } })).join()).toMatch(/say where it comes from/);
    expect(screenplayErrors(sp({ box: { thing: PROP, at: [0, 0], from: [1, 1], speed: 0 } })).join()).toMatch(/speed: metres a second/);
    await expect(prepareScreenplay(sp({ box: { thing: PROP, at: [0, 0], from: 'nowhere' } }), { getRow: () => null })).rejects.toThrow(/props\.box\.from: no mark 'nowhere'/);
  });
});

