// The food, read off a card: one small card per rule of the reading (a dish by its words, an ingredient in the state its
// words or its station give, a produce grown from another, a thing no row names, a packed thing), the laws on the
// orders starter chosen in code, the faces placed, the same card the same food.
import { describe, it, expect } from 'vitest';
import { foodOf, lookFaces, foodFaces, bounds } from './derive.js';
import { foodLaws } from './laws.js';
import { SCENARIOS } from '../worksim/scenarios.js';

const card = (stations, wants) => ({ id: 't', stations, demand: { every: 30, patience: 60, orders: [{ name: 'o', wants }] }, session: 120 });
const [, ORDERS] = Object.entries(SCENARIOS).find(([, c]) => (c.demand.mode ?? 'orders') === 'orders' && Object.values(c.stations).some((s) => Object.keys(s.takes ?? {}).length > 1));

describe('the food, read off the card', () => {
  it('a dish by its words: its parts what its station takes, its arrangement and vessel the dish row\'s', () => {
    const F = foodOf(card({ cut: { verb: 'shovel', takes: { fish: 1 }, gives: { 'sliced-fish': 1 }, work: 2 }, cook: { verb: 'shovel', takes: { rice: 1 }, gives: { 'cooked-rice': 1 }, work: 1, wait: 3 }, plate: { verb: 'bucket', takes: { 'sliced-fish': 1, 'cooked-rice': 1 }, gives: { sushi: 1 }, work: 1 } }, { sushi: 1 }));
    expect(F.sushi).toMatchObject({ kind: 'dish', arrangement: 'nigiri', vessel: 'plate' });
    expect(F.sushi.parts.map((p) => p.item)).toEqual(['sliced-fish', 'cooked-rice']);
  });
  it('an ingredient in the state its words say, else its station gives: worked prepped, run alone cooked, raw whole', () => {
    const F = foodOf(card({ chop: { verb: 'shovel', takes: { carrot: 1 }, gives: { 'carrot-bits': 1 }, work: 2 }, oven: { verb: 'shovel', takes: { 'carrot-bits': 1 }, gives: { 'roasted-carrot': 1 }, work: 1, wait: 3 } }, { 'roasted-carrot': 1 }));
    expect([F.carrot.state, F['carrot-bits'].state, F['roasted-carrot'].state]).toEqual(['whole', 'prepped', 'cooked']);
    expect(F['carrot-bits'].form).not.toBe(F.carrot.form);
  });
  it('a produce grown from another thing is itself as it comes (wheat from seed is wheat, not cooked seed)', () => {
    const F = foodOf(card({ field: { verb: 'shovel', takes: { seed: 1 }, gives: { wheat: 3 }, work: 2, wait: 5 } }, { wheat: 1 }));
    expect(F.wheat).toMatchObject({ ingredient: 'wheat', state: 'whole' });
  });
  it('a thing no row names: a block in its name\'s colour, and what a station makes of it lighter or darker, never the same', () => {
    const F = foodOf(card({ mix: { verb: 'shovel', takes: { gloop: 1 }, gives: { set: 1 }, work: 1, wait: 2 } }, { set: 1 }));
    expect(F.gloop.kind).toBe('block');
    expect(F.set.colours[0]).not.toBe(F.gloop.colours[0]);
  });
  it('packed by its words: a crate or a sack, its thing on top of a crate', () => {
    const F = foodOf(card({ box: { verb: 'bucket', takes: { tomato: 2 }, gives: { 'tomato-crate': 1 }, work: 1 }, bag: { verb: 'bucket', takes: { tomato: 2 }, gives: { 'tomato-bag': 1 }, work: 1 } }, { 'tomato-crate': 1 }));
    expect([F['tomato-crate'].vessel, F['tomato-bag'].vessel]).toEqual(['crate', 'sack']);
  });
  it('a starter\'s food holds every law, and the same card draws the same food', () => {
    expect(foodLaws(ORDERS).filter((l) => !l.holds)).toEqual([]);
    const a = foodOf(ORDERS), b = foodOf(ORDERS);
    for (const item of Object.keys(a)) expect(lookFaces(a[item])).toEqual(lookFaces(b[item]));
  });
  it('placed: its middle where asked, its base on the ground there, its widest the size asked', () => {
    const L = Object.values(foodOf(ORDERS)).find((x) => x.kind === 'dish');
    const [lo, hi] = bounds(foodFaces(L, { at: [3, -2, 0.9], size: 0.4 }));
    expect(lo[2]).toBeCloseTo(0.9, 3);
    expect(Math.max(hi[0] - lo[0], hi[1] - lo[1])).toBeCloseTo(0.4, 2);
    expect((lo[0] + hi[0]) / 2).toBeCloseTo(3, 2);
  });
  it('drawn smooth and chamfered: a round shaded a corner at a time, a box with its edges and corners cut', () => {
    const F = foodOf(ORDERS), all = Object.values(F).flatMap((L) => lookFaces(L));
    const rounds = all.filter((f) => Array.isArray(f.cornerFills));
    expect(rounds.length).toBeGreaterThan(0);
    expect(rounds.every((f) => f.cornerFills.length === f.corners.length && !f.round)).toBe(true);
    // (a box is 6 faces set in, 12 edge strips and 8 corner triangles: the triangles are its cut corners)
    const fillet = Object.values(F).find((L) => L.form === 'fillet'), tris = lookFaces(fillet).filter((f) => new Set(f.corners.map(String)).size === 3);
    expect(tris.length).toBeGreaterThanOrEqual(8);
  });
  it('a method finer than its state where the row has one: an egg boiled is halved, fried is fried', () => {
    const F = foodOf(card({ pot: { verb: 'shovel', takes: { egg: 1 }, gives: { 'boiled-egg': 1 }, work: 1, wait: 3 }, pan: { verb: 'shovel', takes: { egg: 1 }, gives: { 'fried-egg': 1 }, work: 1, wait: 3 } }, { 'boiled-egg': 1 }));
    expect([F['boiled-egg'].form, F['fried-egg'].form]).toEqual(['halved', 'fried']);
  });
  it('several things made into one that names its base: tossed in the pan where it runs alone (fried rice), its base marked', () => {
    const F = foodOf(card({ pot: { verb: 'shovel', takes: { rice: 1 }, gives: { 'cooked-rice': 1 }, work: 1, wait: 3 }, wok: { verb: 'shovel', takes: { 'cooked-rice': 1, carrot: 1 }, gives: { 'fried-rice': 1 }, work: 1, wait: 3 } }, { 'fried-rice': 1 }));
    expect(F['fried-rice']).toMatchObject({ kind: 'dish', arrangement: 'tossed' });
    expect(F['fried-rice'].parts.find((p) => p.base).item).toBe('cooked-rice');
  });
  it('a dish put through an oven is that dish browned, told apart from it', () => {
    const F = foodOf(card({ top: { verb: 'bucket', takes: { dough: 1, cheese: 1 }, gives: { 'raw-pizza': 1 }, work: 1 }, oven: { verb: 'shovel', takes: { 'raw-pizza': 1 }, gives: { pizza: 1 }, work: 1, wait: 3 } }, { pizza: 1 }));
    expect([F['raw-pizza'].browned, F.pizza.browned]).toEqual([undefined, true]);
    expect(lookFaces(F.pizza).map((f) => f.fill)).not.toEqual(lookFaces(F['raw-pizza']).map((f) => f.fill));
  });
});

