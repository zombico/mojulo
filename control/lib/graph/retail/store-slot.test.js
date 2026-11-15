import { describe, it, expect } from 'vitest';
import { SLOT, ENTER_CARDS, slotOf, storeSlot, openingLess, rectLess } from './store-slot.js';
import { SEEDED_CARDS } from './store-cards.js';

// one slot a town's shop gives (a 7 m front, its door off its middle), one card: the lightest of the street's
const ASK = { w: 7.3, d: 14.6, h: 2.75, door: { x: 2.6, w: 1.05 } };
const slot = slotOf(ASK), S = storeSlot('electronics', slot);

describe('a slot', () => {
  it('is rounded down to its steps, its door kept on the client\'s', () => {
    expect(slot.w).toBe(7); expect(slot.d).toBe(14); expect(slot.h).toBe(2.7);
    // (the slot's left edge in the client's frame plus the door in the slot is the client's door)
    expect(slot.slack[0] + slot.door.x).toBeCloseTo(ASK.door.x, 9);
    expect(Math.abs(slot.slack[0] - (ASK.w - slot.w) / 2)).toBeLessThanOrEqual(SLOT.step.door / 2 + 1e-9);
  });
  it('holds no store when it is too small or its door stands in its pier', () => {
    expect(slotOf({ ...ASK, w: 3.9 })).toBeNull();
    expect(slotOf({ ...ASK, d: 5 })).toBeNull();
    expect(slotOf({ ...ASK, door: { x: 0.3, w: 1.05 } })).toBeNull();
  });
  it('two shops of one size share a key', () => {
    expect(slotOf({ ...ASK, w: 7.2, d: 14.9 }).key).toBe(slot.key);
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
  it('carries only paint a template draws, a till, and its grade', () => {
    expect(S.faces.every((f) => /^#[0-9a-f]{6}$/i.test(f.fill))).toBe(true);
    expect(S.faceCount).toBeLessThanOrEqual(SLOT.faces);
    expect(S.till).toHaveLength(3);
    expect(S.assessment.ok).toBe(true);
  });
  it('is the same bytes twice', () => {
    expect(JSON.stringify(storeSlot('electronics', slot))).toBe(JSON.stringify(S));
  });
  it('the street\'s cards are seeded cards', () => {
    for (const id of ENTER_CARDS) expect(SEEDED_CARDS[id]).toBeTruthy();
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
