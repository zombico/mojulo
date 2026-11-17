import { describe, it, expect } from 'vitest';
import { SLOT, ENTER_CARDS, TENANCY, tenantOf, readEnter, slotOf, storeSlot, openingLess, rectLess } from './store-slot.js';
import { mulberry32 } from '../city/plan/dice.js';
import { SEEDED_CARDS } from './store-cards.js';

// one slot a town's shop gives (a 7 m front, its door off its middle), one card: the lightest of the street's
const ASK = { w: 7.3, d: 14.6, h: 2.75, door: { x: 2.6, w: 1.05 } };
const slot = slotOf(ASK), S = storeSlot('electronics', slot);

describe('a slot', () => {
  it('is the widest and deepest standard unit that fits it, its door kept on the client\'s', () => {
    expect(SLOT.units.w).toContain(slot.w); expect(SLOT.units.d).toContain(slot.d); expect(SLOT.units.h).toContain(slot.h);
    expect(slot.w).toBeLessThanOrEqual(ASK.w); expect(slot.d).toBeLessThanOrEqual(ASK.d); expect(slot.h).toBeLessThanOrEqual(ASK.h);
    // (the slot's left edge in the client's frame plus the door in the slot is the client's door; the unit inside its room)
    expect(slot.slack[0] + slot.door.x).toBeCloseTo(ASK.door.x, 9);
    expect(slot.slack[0]).toBeGreaterThanOrEqual(-SLOT.slide - 1e-9);
    expect(slot.slack[0] + slot.w).toBeLessThanOrEqual(ASK.w + SLOT.slide + 1e-9);
    expect(SLOT.units.door).toContain(slot.door.x / slot.w);
  });
  it('holds no store when it is smaller than every unit or its door is wider than a unit\'s', () => {
    expect(slotOf({ ...ASK, w: 3.9 })).toBeNull();
    expect(slotOf({ ...ASK, d: 5 })).toBeNull();
    expect(slotOf({ ...ASK, h: 2.2 })).toBeNull();
    expect(slotOf({ ...ASK, door: { x: 2.6, w: 2.4 } })).toBeNull();
  });
  it('shops of every size within a unit share its key, wherever their doors stand near one place', () => {
    expect(slotOf({ ...ASK, w: 7.2, d: 14.9 }).key).toBe(slot.key);
    expect(slotOf({ ...ASK, w: 6.6, d: 13.1, door: { x: 2.3, w: 1.2 } }).key).toBe(slot.key);
    // (a door at the other end of its front: the same unit, its other standard place)
    const other = slotOf({ ...ASK, door: { x: ASK.w - 2.6, w: 1.05 } });
    expect(other.w).toBe(slot.w); expect(other.key).not.toBe(slot.key);
  });
});

describe('a store in a slot', () => {
  it('stands about its door: its inside the slot\'s, its faces and boxes inside it', () => {
    expect(S.inside.x1 - S.inside.x0).toBeCloseTo(slot.w, 4);
    expect(S.inside.x0).toBeCloseTo(-slot.door.x, 4);
    const E = 0.35;   // (the shell's own wall, astride the slot's edge)
    for (const f of S.faces) for (const [x, y, z] of f.corners) {
      expect(x).toBeGreaterThan(S.inside.x0 - E); expect(x).toBeLessThan(S.inside.x1 + E);
      expect(y).toBeGreaterThan(-E); expect(y).toBeLessThan(slot.d + E);
      expect(z).toBeGreaterThan(-0.01); expect(z).toBeLessThan(S.inside.h + E);
    }
    expect(S.boxes.length).toBeGreaterThan(0);
    for (const b of S.boxes) { expect(b.min[0]).toBeGreaterThan(S.inside.x0 - E); expect(b.max[0]).toBeLessThan(S.inside.x1 + E); expect(b.max[1]).toBeLessThan(slot.d + E); }
  });
  it('keeps its door\'s way clear of every box', () => {
    const hit = (x, y) => S.boxes.some((b) => x > b.min[0] && x < b.max[0] && y > b.min[1] && y < b.max[1]);
    for (const y of [0.1, 0.5, 1, 1.4]) expect(hit(0, y)).toBe(false);
  });
  it('tells its shell\'s parts and its card\'s finishes, and leaves out what a walker could never see', () => {
    expect(S.faces.filter((f) => f.part === 'floor').length).toBeGreaterThan(0);
    expect(S.faces.filter((f) => f.part === 'wall').length).toBeGreaterThan(0);
    expect(S.faces.filter((f) => f.part === 'ceiling').length).toBeGreaterThan(0);
    expect(S.faces.filter((f) => f.part).every((f) => f.normal)).toBe(true);
    expect(S.finish).toEqual({ floor: SEEDED_CARDS.electronics.finishes.floor, wall: SEEDED_CARDS.electronics.finishes.wall });
    // (no face lies flat against the back or a side wall, facing into it: a shelf's back against its wall is left out)
    const E = 0.02, against = S.faces.filter((f) => !f.part && f.normal && f.corners.length === 4 && ((f.normal[1] > 0.9 && f.corners.every((c) => c[1] > slot.d - E)) || (f.normal[0] > 0.9 && f.corners.every((c) => c[0] > S.inside.x1 - E)) || (f.normal[0] < -0.9 && f.corners.every((c) => c[0] < S.inside.x0 + E))));
    expect(against).toHaveLength(0);
  });
  it('carries only paint a template draws, a till, and its grade', () => {
    expect(S.faces.every((f) => /^#[0-9a-f]{6}$/i.test(f.fill))).toBe(true);
    expect(S.faceCount).toBeLessThanOrEqual(SLOT.faces);
    expect(S.till).toHaveLength(3);
    expect(S.assessment.ok).toBe(true);
  });
  it('is the same bytes twice', () => {
    expect(JSON.stringify(storeSlot('electronics', slot))).toBe(JSON.stringify(S));
  });
  it('every card a street lets to is a seeded card', () => {
    for (const id of ENTER_CARDS) expect(SEEDED_CARDS[id]).toBeTruthy();
  });
});

describe('a street\'s tenancy', () => {
  const street = Object.keys(TENANCY)[0], T = TENANCY[street];
  it('lets by its shares, the same dice the same tenant', () => {
    const R = mulberry32(5), n = {};
    for (let i = 0; i < 2000; i++) { const id = tenantOf(street, R); n[id] = (n[id] ?? 0) + 1; }
    expect(Object.keys(n).sort()).toEqual(Object.keys(T).sort());
    const [most] = Object.entries(T).sort((a, b) => b[1] - a[1])[0], [least] = Object.entries(T).sort((a, b) => a[1] - b[1])[0];
    expect(n[most]).toBeGreaterThan(n[least]);
    expect(tenantOf(street, mulberry32(9))).toBe(tenantOf(street, mulberry32(9)));
  });
  it('never lets to its neighbour\'s tenant where another may be had, and keeps to the cards a place names', () => {
    const R = mulberry32(3);
    let prev = null;
    for (let i = 0; i < 200; i++) { const id = tenantOf(street, R, { prev }); expect(id).not.toBe(prev); prev = id; }
    for (let i = 0; i < 50; i++) expect(['cafe', 'food']).toContain(tenantOf(street, R, { cards: ['cafe', 'food'] }));
    expect(tenantOf(street, R, { cards: ['cafe'], prev: 'cafe' })).toBe('cafe');
  });
  it('reads a place\'s setting: its own cards, or none (the street\'s)', () => {
    expect(readEnter(true).cards).toBeNull();
    expect(readEnter({ cards: ['cafe'] }).cards).toEqual(['cafe']);
  });
});

describe('an opening cut', () => {
  const wall = { corners: [[0, 0, 0], [6, 0, 0], [6, 0, 3], [0, 0, 3]], part: 'wall' }, O = { x0: 2, x1: 3, z0: 0.02, z1: 2.1, y0: -0.25, y1: 0.4 };
  const area = (f) => { const xs = f.corners.map((c) => c[0]), zs = f.corners.map((c) => c[2]); return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs)); };
  it('cuts a wall to the strips round it, wound as it was', () => {
    const out = openingLess([wall], O);
    expect(out).toHaveLength(3);   // (left, right, over: the sliver under it left out)
    expect(out.reduce((a, f) => a + area(f), 0)).toBeCloseTo(18 - 1 * 2.1, 6);
    expect(out.every((f) => f.part === 'wall' && f.corners[0][0] < f.corners[1][0] && f.corners[1][2] < f.corners[2][2])).toBe(true);
  });
  it('leaves out a leaf in it, keeps a face beside it, behind it or under it', () => {
    const leaf = { corners: [[2.1, 0.05, 0.1], [2.9, 0.05, 0.1], [2.5, 0.05, 2]] }, beside = { corners: [[4, 0, 1], [5, 0, 1], [5, 0, 2], [4, 0, 2]] };
    const behind = { corners: [[2, 3, 0], [3, 3, 0], [3, 3, 2], [2, 3, 2]] }, step = { corners: [[2, -0.2, 0], [3, -0.2, 0], [3, 0, 0], [2, 0, 0]] };
    expect(openingLess([leaf, beside, behind, step], O)).toEqual([beside, behind, step]);
  });
  it('a box in plan less another is its pieces round it', () => {
    const ps = rectLess([0, 0, 10, 10], [4, -1, 6, 3]);
    expect(ps.reduce((a, r) => a + (r[2] - r[0]) * (r[3] - r[1]), 0)).toBeCloseTo(100 - 6, 9);
    expect(rectLess([0, 0, 1, 1], [5, 5, 6, 6])).toEqual([[0, 0, 1, 1]]);
  });
});
