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

describe('a thing that moves', () => {
  const sp = (props) => ({ cast: { ada: {}, jon: {} }, props, script: 'ADA: Hello.\nJON: Hello.' });
  const stood = async (Q) => (await prepareScreenplay(sp({ box: { thing: PROP, ...Q } }), { getRow: () => null })).set.props[0];

  it('arrives from somewhere at its place, read where it rests, facing the way it came', async () => {
    expect(await stood({ at: [3, 10], from: [3, 3], start: 2, speed: 3.5 })).toMatchObject({ name: 'box', at: [3, 10], move: { from: [[3, 3]], start: 2, speed: 3.5 } });
    // it came along +y: no turn; along +x it is turned a quarter; a turn of its own wins
    expect((await stood({ at: [3, 10], from: [3, 3] })).turn).toBeUndefined();
    expect((await stood({ at: [10, 3], from: [3, 3] })).turn).toBe(90);
    expect((await stood({ at: [10, 3], from: [3, 3], turn: 15 })).turn).toBe(15);
    // a thing that stands has no move
    expect((await stood({ at: [10, 3] })).move).toBeUndefined();
  });

  it('leaves for somewhere, facing the way it goes when that is all it does', async () => {
    const P = await stood({ at: [3, 3], to: [10, 3], leave: { line: 2 } });
    expect(P.move).toMatchObject({ to: [[10, 3]], leave: { line: 2 } });
    expect(P.move.from).toBeUndefined();
    expect(P.turn).toBe(90);
  });

  it('is keyed along its way on the scene\'s clock, on the ground under it, facing along it', () => {
    const S = { turns: [{ at: 0, end: 4 }, { at: 9, end: 12 }] };
    const arrive = { at: [3, 10], move: { from: [[3, 3]], start: 2, speed: 2 } };
    const K = arrivalKeys(arrive);
    expect(K[0]).toEqual({ t: 2, x: 3, y: 3, turn: 0 });
    expect(K.at(-1)).toEqual({ t: 5.5, x: 3, y: 10, turn: 0 });
    expect(K.length).toBe(5);
    for (let i = 1; i < K.length; i++) expect(K[i].t).toBeGreaterThan(K[i - 1].t);
    // on land that rises and falls each key takes the ground's height
    expect(arrivalKeys(arrive, (x, y) => y / 10).map((k) => k.z)).toEqual([0.3, 0.475, 0.65, 0.825, 1]);
    // set off on a line: its start, or its end
    expect(arrivalKeys({ ...arrive, move: { ...arrive.move, start: { line: 2 } } }, null, S)[0].t).toBe(9);
    expect(arrivalKeys({ ...arrive, move: { ...arrive.move, start: { line: 1, at: 'end' } } }, null, S)[0].t).toBe(4);
    // it arrives, rests, and leaves as the last line begins (no `leave` said): never before it has arrived
    const both = arrivalKeys({ at: [3, 10], move: { from: [[3, 3]], start: 0, to: [[3, 20]], speed: 2 } }, null, S);
    expect(both.filter((k) => k.y === 10).map((k) => k.t)).toEqual([3.5, 9]);
    expect(both.at(-1)).toMatchObject({ t: 14, x: 3, y: 20 });
    expect(arrivalKeys({ at: [3, 10], move: { from: [[3, 3]], start: 0, to: [[3, 20]], leave: 1, speed: 2 } }, null, S).filter((k) => k.y === 10)).toHaveLength(1);
    // a thing that only leaves sets off from its place, facing as it stands, and turns to its way
    expect(arrivalKeys({ at: [0, 0], turn: 90, move: { to: [[4, 0]], leave: 6, speed: 2 } })).toEqual([{ t: 6, x: 0, y: 0, turn: 90 }, { t: 7, x: 2, y: 0, turn: 90 }, { t: 8, x: 4, y: 0, turn: 90 }]);
    expect(arrivalKeys({ at: [0, 0] })).toBe(null);
  });

  it('follows a route round a corner, turning into it the short way, and rests facing the way it came in', async () => {
    // north 8 m, then east 6 m to its place
    const P = await stood({ at: [6, 8], from: [[0, 0], [0, 8]], speed: 2 });
    expect(P.move.from).toEqual([[0, 0], [0, 8]]);
    expect(P.turn).toBe(90);
    const K = arrivalKeys(P);
    expect(K[0]).toMatchObject({ x: 0, y: 0, turn: 0 });
    // at the corner it already faces east; it gets there after 4 s and to its place after 7
    expect(K.find((k) => k.x === 0 && k.y === 8)).toMatchObject({ t: 4, turn: 90 });
    expect(K.at(-1)).toMatchObject({ t: 7, x: 6, y: 8, turn: 90 });
    // a turn past a half turn is taken the short way: from facing south-west round to north-west, never the long way
    const turns = arrivalKeys({ at: [-4, 4], turn: -45, move: { from: [[4, 4], [0, 0]], start: 0, speed: 2 } }).map((k) => k.turn);
    for (let i = 1; i < turns.length; i++) expect(Math.abs(turns[i] - turns[i - 1])).toBeLessThanOrEqual(180);
    // a route may name marks
    const viaMark = await prepareScreenplay({ ...sp({ box: { thing: PROP, at: [6, 8], from: ['gate', [0, 8]] } }), marks: { gate: [0, -5] } }, { getRow: () => null });
    expect(viaMark.set.props[0].move.from).toEqual([[0, -5], [0, 8]]);
  });

  it('says what it takes', async () => {
    const errs = (Q) => screenplayErrors(sp({ box: { thing: PROP, at: [0, 0], ...Q } })).join();
    expect(errs({ from: 7 })).toMatch(/from: where it comes from/);
    expect(errs({ to: {} })).toMatch(/to: where it leaves for/);
    expect(errs({ start: 2 })).toMatch(/say where it comes from/);
    expect(errs({ leave: 2 })).toMatch(/say where \(to\)/);
    expect(errs({ from: [1, 1], start: { line: 0 } })).toMatch(/start: when it sets off/);
    expect(errs({ from: [1, 1], speed: 0 })).toMatch(/speed: metres a second/);
    expect(errs({ from: [1, 1], to: [5, 5], start: { line: 1 }, leave: { line: 2, at: 'end' } })).toBe('');
    await expect(prepareScreenplay(sp({ box: { thing: PROP, at: [0, 0], from: 'nowhere' } }), { getRow: () => null })).rejects.toThrow(/props\.box\.from: no mark 'nowhere'/);
  });
});
