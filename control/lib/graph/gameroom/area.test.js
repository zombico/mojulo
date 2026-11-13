// The area a room stands in (area.js): a trade's own or one written over it, its walls cut away on the camera's side at
// a section and their colliders raised to the height drawn, the surround outside the room, all of it seeded.
import { describe, it, expect } from 'vitest';
import { AREAS, FLOORS, WALLS, SURROUNDS, readArea, buildArea, raiseWalls, planeFaces } from './area.js';
import { floorOf } from '../gameworld/practice-room.js';

const H = 8;
const corners = (faces) => faces.flatMap((f) => f.corners);
// a solid style and a low one, chosen from the table (not a list): the tallest and the lowest that draw
const drawn = Object.entries(WALLS).filter(([, w]) => w.height > 0).sort((a, b) => b[1].height - a[1].height);
const TALL = drawn[0][0], LOW = drawn[drawn.length - 1][0];

describe('the area', () => {
  it('reads a trade\'s own, a name, an object over one, and false (the plane); a malformed one is taught', () => {
    const trade = Object.keys(AREAS)[0], A = readArea(undefined, trade);
    expect(A.name).toBe(trade);
    expect(A.walls.style).toBe(AREAS[trade].walls.style);
    expect(readArea(false)).toBeNull();
    // a pattern changed takes the pattern's colours; kept, the area's
    const other = Object.keys(FLOORS).find((p) => p !== A.floor.pattern);
    expect(readArea({ like: trade, floor: other }).floor.colors).toEqual(FLOORS[other].colors);
    expect(readArea({ like: trade, walls: { style: TALL, height: 6, colors: { [Object.keys(WALLS[TALL].colors)[0]]: '#123456' } } }).walls).toMatchObject({ style: TALL, height: 6 });
    expect(readArea({ surround: false }).surround).toEqual([]);
    expect(readArea({ cut: true }).cut.sort()).toEqual(['e', 'n', 's', 'w']);
    expect(() => readArea('nowhere')).toThrow(/area is/);
    expect(() => readArea({ walls: 'glass' })).toThrow(/walls is/);
    expect(() => readArea({ sky: 'blue' })).toThrow(/colour/);
    expect(() => readArea({ roof: true })).toThrow(/has no 'roof'/);
    expect(() => readArea({ surround: ['moon'] })).toThrow(/surround is/);
  });
  it('draws its walls full on the far sides and cut to a section on the camera\'s, and the colliders take their heights', () => {
    const A = readArea({ walls: TALL });
    const B = buildArea(A, { half: H, cut: ['s'] });
    expect(B.heights.n).toBe(A.walls.height);
    expect(B.heights.s).toBeLessThan(A.walls.height);
    // every wall face stands in its band round the floor, never on it
    for (const [x, y] of corners(B.faces.filter((f) => f.group === 'room:area:wall'))) expect(Math.max(Math.abs(x), Math.abs(y))).toBeGreaterThan(H - 0.3);
    const C = raiseWalls(floorOf({ half: H, blocks: [{ id: 'b', x: [0, 1], y: [0, 1], h: 0.9 }] }).colliders, H, B.heights);
    expect(C.slice(0, 4).map((c) => c.max[2]).sort()).toEqual(Object.values(B.heights).sort());
    expect(C[4].max[2]).toBe(0.9);
    // a low style is the same height everywhere; none draws no walls and keeps the colliders
    const L = buildArea(readArea({ walls: LOW }), { half: H, cut: ['s'] });
    expect(new Set(Object.values(L.heights)).size).toBeLessThanOrEqual(2);
    expect(buildArea(readArea({ walls: 'none' }), { half: H }).heights).toBeNull();
    expect(raiseWalls([{ min: [0, 0, 0], max: [1, 1, 1] }], H, null)[0].max[2]).toBe(1);
  });
  it('lays its surround outside the room, never on its floor, the same for the same seed', () => {
    const A = readArea({ surround: Object.keys(SURROUNDS) });
    const B = buildArea(A, { half: H, seed: 3 });
    const out = B.faces.filter((f) => /^room:area:(?!floor|wall|cut|ground)/.test(f.group));
    expect(new Set(out.map((f) => f.group.slice(10)))).toEqual(new Set(Object.keys(SURROUNDS)));
    for (const [x, y, z] of corners(out)) expect(Math.abs(x) > H || Math.abs(y) > H || z > 12).toBe(true);
    expect(buildArea(A, { half: H, seed: 3 })).toEqual(B);
    expect(B.bg).toBe(A.sky);
    // the floor covers the room and only the room
    for (const [x, y] of corners(B.faces.filter((f) => f.group === 'room:area:floor'))) expect(Math.max(Math.abs(x), Math.abs(y))).toBeLessThanOrEqual(H + 1e-9);
    expect(planeFaces(H).some((f) => f.group === 'room:rule')).toBe(true);
  });
});
