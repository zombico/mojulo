// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { routeWalk, BODY, SQUEEZE } from './route.js';
import { actScene, placeOn, WALK } from './scene.js';

const table = { min: [2, -0.5], max: [3, 0.5] };
const room = { min: [0, -2], max: [5, 2] };
// how near a point comes to a rect (0 inside it)
const off = (B, p) => Math.hypot(Math.max(B.min[0] - p[0], 0, p[0] - B.max[0]), Math.max(B.min[1] - p[1], 0, p[1] - B.max[1]));
const along = (way, n = 200) => way.slice(1).flatMap((q, k) => Array.from({ length: n + 1 }, (_, i) => [way[k][0] + ((q[0] - way[k][0]) * i) / n, way[k][1] + ((q[1] - way[k][1]) * i) / n]));

describe('a cross walked round what stands in the way', () => {
  it('is the straight line with nothing in its way', () => {
    expect(routeWalk([0, 0], [5, 0])).toEqual([[0, 0], [5, 0]]);
    expect(routeWalk([0, 1.5], [5, 1.5], { blocks: [table], room })).toEqual([[0, 1.5], [5, 1.5]]);
  });
  it('goes round a piece, a body’s width off it, by the shorter side, inside the room', () => {
    const way = routeWalk([0.5, 0.1], [4.5, 0.1], { blocks: [table], room });
    expect(way.length).toBeGreaterThan(2);
    for (const p of along(way)) expect(off(table, p)).toBeGreaterThanOrEqual(BODY - 1e-6);
    // (the walk starts above the table's middle: round its far side is shorter)
    expect(way[1][1]).toBeGreaterThan(0.5);
    for (const p of way) { expect(p[1]).toBeGreaterThanOrEqual(room.min[1]); expect(p[1]).toBeLessThanOrEqual(room.max[1]); }
  });
  it('goes round the others, and takes no corner outside the room', () => {
    const way = routeWalk([0.5, 0], [4.5, 0], { people: [[2.5, 0]], room });
    expect(way.length).toBeGreaterThan(2);
    for (const p of along(way)) expect(Math.max(Math.abs(p[0] - 2.5), Math.abs(p[1]))).toBeGreaterThanOrEqual(0.3 + BODY - 1e-6);
    // (a piece wall to wall: no way round it inside the room, so the line is walked as written)
    expect(routeWalk([0.5, 0], [4.5, 0], { blocks: [{ min: [2, -2], max: [3, 2] }], room })).toEqual([[0.5, 0], [4.5, 0]]);
  });
  it('lets the script’s word win: a walk from or to a place inside a piece is not turned away from it', () => {
    expect(routeWalk([0.5, 0], [2.5, 0], { blocks: [table], room })).toEqual([[0.5, 0], [2.5, 0]]);
  });
  it('squeezes through a gap too narrow to walk easy, rather than through a piece', () => {
    // two pieces 0.36 m apart, wall to wall but for the gap between them
    const blocks = [{ min: [2, -2], max: [3, -0.18] }, { min: [2, 0.18], max: [3, 2] }];
    const way = routeWalk([0.5, 1], [4.5, 1], { blocks, room });
    expect(way.length).toBeGreaterThan(2);
    for (const p of along(way)) for (const B of blocks) expect(off(B, p)).toBeGreaterThanOrEqual(SQUEEZE[1] - 1e-6);
  });
  it('is deterministic', () => {
    const o = { blocks: [table, { min: [3.6, -1.5], max: [4, -0.2] }], room, people: [[1.2, 0.9]] };
    expect(routeWalk([0.5, 0.1], [4.5, -1], o)).toEqual(routeWalk([0.5, 0.1], [4.5, -1], o));
  });
});

describe('a scene on a floor with pieces on it', () => {
  const sp = { cast: { ada: { mark: 'a' }, jon: { mark: 'b' } }, marks: { a: [0.5, 0.1], b: [0.5, 1.5], far: [4.5, 0.1] }, script: 'ADA: I am going.\nAda crosses to the far.\nJON: Go on.' };
  const plan = { floor_plan: { blocks: [table], rooms: [room] } };
  it('bends the cross round the piece: the walk’s corners, its length and time by the way walked', () => {
    const S = actScene({ ...sp, ...plan }), [W] = S.actors.ada.walks;
    expect(W.via.length).toBeGreaterThan(0);
    expect(W.distance).toBeGreaterThan(4);
    expect(W.end - W.start).toBeCloseTo(W.distance / WALK, 2);
    // (every moment of the walk is clear of the table)
    for (let s = W.start; s <= W.end; s += 0.05) { const p = placeOn(S.actors.ada.root, s); expect(off(table, [p.x, p.y])).toBeGreaterThanOrEqual(BODY - 0.02); }
    const end = placeOn(S.actors.ada.root, W.end);
    expect(end.x).toBeCloseTo(4.5, 6); expect(end.y).toBeCloseTo(0.1, 6);
  });
  it('is the scene it always was with no floor plan', () => {
    const S = actScene(sp), [W] = S.actors.ada.walks;
    expect(W.via).toBeUndefined();
    expect(W.distance).toBe(4);
    expect(S.actors.ada.root.length).toBeLessThan(actScene({ ...sp, ...plan }).actors.ada.root.length);
  });
});
