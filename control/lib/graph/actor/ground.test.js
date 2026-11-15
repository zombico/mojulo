import { describe, it, expect } from 'vitest';
import { standingOf, openGround, floorUnder, middleOf, STEP, HEAD, EASE } from './ground.js';
import { routeWalk } from './route.js';
import { faceSight } from '../shoot/clearance.js';
import { fitSight, SIGHT_NEAR } from './coverage.js';

// the ground of ANY world, read from its faces: no world has to say what stands in it. Tested on faces built by hand
// the way every world resolves to them (worlds/world-scene.js): a floor, a wall on edge, a box, a lintel overhead.
const quad = (a, b, c, d) => ({ corners: [a, b, c, d] });
const floor = quad([-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]);
/** a wall on edge along x at y, from x0 to x1, z0 to z1 */
const wall = (y, x0, x1, z0 = 0, z1 = 2.6) => quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]);
/** a closed box */
const box = (x0, y0, x1, y1, h) => [
  quad([x0, y0, h], [x1, y0, h], [x1, y1, h], [x0, y1, h]),
  wall(y0, x0, x1, 0, h), wall(y1, x0, x1, 0, h),
  quad([x0, y0, 0], [x0, y1, 0], [x0, y1, h], [x0, y0, h]), quad([x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]),
];
const inBlock = (B, p) => p[0] > B.min[0] && p[0] < B.max[0] && p[1] > B.min[1] && p[1] < B.max[1];

describe('the ground of any world', () => {
  it('reads what stands at a body\'s height: a wall and a table, not the floor, a rug or a lintel overhead', () => {
    const faces = [floor, wall(2, -3, 3), ...box(-1, -2, 0.2, -1.2, 0.75), quad([-5, -5, 0.02], [5, -5, 0.02], [5, 5, 0.02], [-5, 5, 0.02]), quad([-3, 0, 2.3], [3, 0, 2.3], [3, 0.3, 2.3], [-3, 0.3, 2.3])];
    const { blocks } = standingOf(faces, { about: [[0, 0]] });
    expect(blocks.length).toBeGreaterThan(0);
    // the wall, to its height; the table, to its top
    expect(blocks.some((B) => B.h > 2 && inBlock({ min: [B.min[0], B.min[1] - 0.01], max: [B.max[0], B.max[1] + 0.01] }, [0, 2]))).toBe(true);
    expect(blocks.some((B) => Math.abs(B.h - 0.75) < 0.01 && inBlock(B, [-0.4, -1.6]))).toBe(true);
    // the open floor, the rug and the ground under the lintel are clear
    for (const p of [[0, 0.15], [3, -3], [-3, -0.5]]) expect(blocks.some((B) => inBlock(B, p))).toBe(false);
    expect(STEP).toBeLessThan(0.75); expect(HEAD).toBeLessThan(2.3);
  });

  it('is read only about where the scene is played, and gathered into few boxes however much stands there', () => {
    const many = [floor];
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) many.push(...box(-9 + i * 1.5, -9 + j * 1.5, -8.6 + i * 1.5, -8.6 + j * 1.5, 1));
    const near = standingOf(many, { about: [[0, 0]], reach: 2 });
    expect(near.blocks.every((B) => B.max[0] >= -2.5 && B.min[0] <= 2.5)).toBe(true);
    const all = standingOf(many, { about: [[0, 0]], reach: 9, most: 40 });
    expect(all.blocks.length).toBeLessThanOrEqual(40);
    expect(all.cell).toBeGreaterThan(0.2);
    expect(standingOf(many, { about: [] }).blocks).toEqual([]);
    expect(standingOf([], { about: [[0, 0]] }).blocks).toEqual([]);
  });

  it('is what a cross goes round: the same boxes a decorated room gives, so the walk is routed in any world', () => {
    const { blocks } = standingOf([floor, ...box(-0.5, -1.5, 0.5, 1.5, 1)], { about: [[-3, 0], [3, 0]] });
    const way = routeWalk([-3, 0], [3, 0], { blocks });
    expect(way.length).toBeGreaterThan(2);
    for (let i = 0; i + 1 < way.length; i++) for (let s = 0; s <= 20; s++) {
      const p = [way[i][0] + ((way[i + 1][0] - way[i][0]) * s) / 20, way[i][1] + ((way[i + 1][1] - way[i][1]) * s) / 20];
      expect(blocks.some((B) => inBlock(B, p))).toBe(false);
    }
  });

  it('stands a cast in a world that names no place: the clear ground nearest its middle, on the floor under it', () => {
    // an object stood on a plinth of ground: its middle is inside it
    const thing = [quad([-10, -10, 1], [10, -10, 1], [10, 10, 1], [-10, 10, 1]), ...box(-2, -2, 2, 2, 4).map((f) => ({ corners: f.corners.map((c) => [c[0], c[1], c[2] + 1]) }))];
    const mid = middleOf(thing);
    expect(mid).toEqual([0, 0]);
    expect(floorUnder(thing, mid)).toBe(1);
    expect(floorUnder(thing, [50, 50])).toBe(1);   // (off the world: the lowest it goes)
    const onFloor = thing.map((f) => ({ corners: f.corners.map((c) => [c[0], c[1], c[2] - 1]) }));
    const at = openGround(onFloor, mid, { width: 1.4 });
    // (each figure of the line stands clear of the object)
    for (const dx of [-0.7, 0, 0.7]) expect(Math.hypot(Math.max(Math.abs(at[0] + dx) - 2, 0), Math.max(Math.abs(at[1]) - 2, 0))).toBeGreaterThanOrEqual(EASE - 0.25);
    expect(Math.hypot(at[0], at[1])).toBeLessThan(6);
    // a bare place is stood on where asked
    expect(openGround([floor], [1, 1])).toEqual([1, 1]);
  });
});

describe('a camera that sees its subject, on any set', () => {
  const sight = faceSight([floor, wall(-2, -6, 6, 0, 4)]);
  it('asks the world\'s faces for a line of sight', () => {
    expect(sight([0, -5, 1.5], [0, 0, 1.3])).toBeGreaterThan(0);
    expect(sight([0, -1.5, 1.5], [0, 0, 1.3])).toBe(-1);
    expect(faceSight([])([0, -5, 1.5], [0, 0, 1.3])).toBe(-1);
  });
  it('brings a camera past what stands between it and its subject, its lens opened to hold the framing', () => {
    const f = { pos: [0, -5, 1.5], poi: [0, 0, 1.3], fov: 40 }, g = fitSight(f, sight);
    expect(g.pos[1]).toBeGreaterThan(-2);
    expect(g.fov).toBeGreaterThan(40);
    expect(sight(g.pos, g.poi)).toBe(-1);
    expect(Math.hypot(g.pos[0] - g.poi[0], g.pos[1] - g.poi[1], g.pos[2] - g.poi[2])).toBeGreaterThanOrEqual(SIGHT_NEAR - 1e-6);
    // a clear camera, and a set with no faces, keep the framing they had
    const clear = { pos: [0, -1.5, 1.5], poi: [0, 0, 1.3], fov: 40 };
    expect(fitSight(clear, sight)).toBe(clear);
    expect(fitSight(f, null)).toBe(f);
  });
});
