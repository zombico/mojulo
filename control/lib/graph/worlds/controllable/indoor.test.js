// The wall and the swinger INDOORS (wall.js, swing.js): a warehouse of boxes (its walls, a ceiling slab, the beams under
// it, racks of shelves), where the line goes up to a beam or the ceiling, the arc keeps clear of the floor under a
// lower pivot, a wall is crawled up to the ceiling and held there, a rack is climbed and stood on. Each law in one room.
import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld } from '../controllable-world.js';

const groundOf = (boxes) => ({ ground: (p) => boxes.reduce((g, b) => (p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= b.min[1] && p[1] <= b.max[1] && b.max[2] <= p[2] + 1e-6 ? Math.max(g, b.max[2]) : g), 0) });
const hero = (pos, heading = 0, rule = {}) => ({ id: 'hero', pilotable: true, rule: { type: 'platform', collideRadius: 0.35, collideHeight: 1.7, wall: true, gear: 'swinger', ...rule }, transform: { pos, heading } });
const make = (boxes, h) => ({ w: createWorld({ entities: [h], colliders: boxes }), G: groundOf(boxes) });
const step = (W, input, n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) stepWorld(W.w, typeof input === 'function' ? input(i) : input, dt, W.G); return W.w.byId.hero; };
// a warehouse 60 × 30 m: walls 12 m tall, a slab over them, three beams across at 9 m, two racks of shelves 6 m tall
const WAREHOUSE = [
  { min: [-1, -1, 0], max: [0, 31, 12] }, { min: [60, -1, 0], max: [61, 31, 12] },
  { min: [0, -1, 0], max: [60, 0, 12] }, { min: [0, 30, 0], max: [60, 31, 12] },
  { min: [-1, -1, 12], max: [61, 31, 12.5] },
  ...[15, 30, 45].map((x) => ({ min: [x - 0.3, 0, 9], max: [x + 0.3, 30, 9.4] })),
  { min: [20, 4, 0], max: [40, 6, 6] }, { min: [20, 24, 0], max: [40, 26, 6] },
];
const inside = (p) => p[0] > 0 && p[0] < 60 && p[1] > 0 && p[1] < 30 && p[2] >= 0 && p[2] < 12;

describe('indoors: the swinger under a warehouse\'s beams', () => {
  it('casts up to a beam or the ceiling, swings inside the walls, its arc clear of the floor', () => {
    const W = make(WAREHOUSE, hero([5, 15, 3], 0));
    const h = step(W, { boost: 1 });
    expect(h.swinging).toBeTruthy();
    expect(h.swinging.face.ax).toBe(2);
    expect(h.swinging.anchor[2]).toBeGreaterThan(8);
    let low = Infinity;
    for (let i = 0; i < 60 && h.swinging; i++) { step(W, { boost: 1 }); expect(inside(h.transform.pos)).toBe(true); low = Math.min(low, h.transform.pos[2]); }
    expect(low).toBeGreaterThan(0.2);
    expect(h.transform.pos[0]).toBeGreaterThan(6);
  });

  it('casts to the ceiling itself in a hall with nothing under it: where the line\'s ideal ray meets its underside', () => {
    const hall = [{ min: [-1, -1, 14], max: [81, 41, 14.5] }, { min: [80, -1, 0], max: [81, 41, 14] }];
    const h = step(make(hall, hero([5, 20, 3], 0)), { boost: 1 });
    expect(h.swinging.face).toEqual({ ax: 2, s: -1, at: 14 });
    // 55° up the heading, from the hand to the ceiling's plane
    const hand = 3 + 1.7 * 0.9;
    expect(h.swinging.anchor[0] - 5).toBeCloseTo((14 - hand) / Math.tan(55 * Math.PI / 180), 6);
  });

  it('casts no line in a room too low to swing in', () => {
    const office = [{ min: [-1, -1, 3], max: [21, 21, 3.3] }, { min: [-1, -1, 0], max: [0, 21, 3] }, { min: [20, -1, 0], max: [21, 21, 3] }];
    const h = step(make(office, hero([2, 10, 1.2], 0)), { boost: 1 }, 5);
    expect(h.swinging || null).toBeNull();
  });

  it('zips to a wall, never to the ceiling: the wall takes hold where it lands', () => {
    const W = make(WAREHOUSE, hero([50, 15, 0], 0));
    step(W, {}, 5);
    step(W, (i) => ({ boost: i === 0 ? 1 : 0 }), 1);
    const h = step(W, {}, 120);
    expect(h.swung.end).toBe('zip');
    expect(h.walling).toMatchObject({ ax: 0, s: -1, at: 60 });
  });
});

describe('indoors: the wall', () => {
  it('crawls a warehouse wall up to the ceiling and holds there, with no roof to mantle onto; jumps off it', () => {
    const W = make(WAREHOUSE, hero([58, 15, 0], 0, { gear: undefined }));
    const h = step(W, { forward: 1 }, 60 * 6);
    expect(h.walling).toBeTruthy();
    expect(h.transform.pos[2]).toBeGreaterThan(9);
    expect(h.transform.pos[2] + 1.7).toBeLessThanOrEqual(12 + 1e-6);
    step(W, (i) => (i < 2 ? { jumpHeld: 1, jump: i === 0 ? 1 : 0 } : {}), 3);
    expect(h.walled.end).toBe('jump');
  });

  it('climbs a rack of shelves, mantles onto its top and perches at its edge', () => {
    const W = make(WAREHOUSE, hero([30, 2, 0], Math.PI / 2, { gear: undefined }));
    const h = W.w.byId.hero;
    for (let i = 0; i < 60 * 8 && !(h.walled && h.walled.end === 'top'); i++) step(W, { forward: 1 });
    expect(h.walled.end).toBe('top');
    expect(h.transform.pos[2]).toBeCloseTo(6, 3);
    step(W, {}, 30);
    expect(h.locomotion).toBe('perch');
  });
});
