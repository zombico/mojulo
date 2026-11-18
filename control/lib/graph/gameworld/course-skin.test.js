import { describe, it, expect } from 'vitest';
import { courseCube, courseColours, skinCourse, SKIN } from './course-skin.js';
import { coursePlan, lowerCourse, slabOf, liftOf } from './course.js';
import { reachOf } from './feel/reach.js';
import { readFeel } from './feel/lower.js';
import { SIDE_CUBE } from '../era/geocube-side.js';
import { GEOCUBE_PRESETS } from '../era/geocube.js';

// THE COURSE'S SKIN: a course in the round drawn as part of its place. One small course on a straight line.
const reach = reachOf(readFeel({ pole: 'jumping-giuseppe', takes: true }));
const lane = { line: Array.from({ length: 90 }, (_, i) => [i, 0]), ground: () => 0 };
const plan = coursePlan(reach, { teach: 'advanced', verticality: 'climbing', length: lane.line.length - 1 });
const L = lowerCourse(plan, lane), stage = { level: 'a', manifest: { kit: 'isekai-meadow', trail: true } };
const C = courseColours(stage, SIDE_CUBE), asks = skinCourse(L, plan, C);
const boxes = asks.flatMap((a) => a.blocks);
const key = (b) => `${b.min[0]},${b.min[1]},${b.max[0]},${b.max[1]}`;

describe('the course\'s skin', () => {
  it('reads its cube from what the level needs: the level, the world, the kit it stands on, the meadow', () => {
    expect(courseCube({ levels: { a: { style: { geocube: 'island-noon' } } }, style: { geocube: 'gothic-night' } }, stage)).toEqual({ cube: 'island-noon', from: 'level' });
    expect(courseCube({ levels: { a: {} }, style: { geocube: 'gothic-night' } }, stage)).toEqual({ cube: 'gothic-night', from: 'world' });
    expect(courseCube({ levels: {} }, stage)).toEqual({ cube: SIDE_CUBE, from: 'kit' });
    // (a kit another cube is made for takes that cube; a kit none is made for, the meadow's)
    const other = Object.keys(GEOCUBE_PRESETS).find((id) => GEOCUBE_PRESETS[id].outside.base !== GEOCUBE_PRESETS[SIDE_CUBE].outside.base);
    expect(courseCube({ levels: {} }, { level: 'a', manifest: { kit: GEOCUBE_PRESETS[other].outside.base } })).toMatchObject({ from: 'kit' });
    expect(courseCube({ levels: {} }, { level: 'a', manifest: { kit: 'no-such-kit' } })).toEqual({ cube: SIDE_CUBE, from: 'default' });
  });

  it('every band is a colour: the land\'s turf is green, the cube\'s masonry is not the land\'s rock', () => {
    for (const c of Object.values(C)) { expect(c).toHaveLength(3); for (const v of c) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); } }
    expect(C.turf[1]).toBeGreaterThan(C.turf[0]);
    expect(C.stone).not.toEqual(C.rock);
    // (another cube, another masonry; the land stays the stage's own)
    const night = courseColours(stage, 'gothic-night');
    expect(night.stone).not.toEqual(C.stone);
    expect(night.turf).toEqual(C.turf);
  });

  it('a cube the level or the world names paints the land, so the turf is the cube\'s own ground', () => {
    const named = courseColours(stage, 'sherbet-orchard', 'world'), unnamed = courseColours(stage, 'sherbet-orchard', 'kit');
    expect(unnamed.turf).toEqual(C.turf);
    expect(named.turf).not.toEqual(C.turf);
    // (the orchard's floor is warm: more red than green, where the meadow's is green)
    expect(named.turf[0]).toBeGreaterThan(named.turf[1]);
    expect(named.stone).toEqual(unnamed.stone);
  });

  it('cuts every box into bands that fill it exactly: the same footprint, the same top, the same foot', () => {
    const src = L.blocks[0].blocks;
    for (const b of src) {
      const mine = boxes.filter((x) => key(x) === key(b) && x.min[2] >= b.min[2] - 1e-6 && x.max[2] <= b.max[2] + 1e-6).sort((p, q) => q.max[2] - p.max[2]);
      expect(mine.length).toBeGreaterThan(0);
      expect(Math.max(...mine.map((x) => x.max[2]))).toBeCloseTo(b.max[2], 3);
      expect(Math.min(...mine.map((x) => x.min[2]))).toBeCloseTo(b.min[2], 3);
    }
  });

  it('a floor is turf over dirt over rock; the stairs and a floor up a wall are trim over stone', () => {
    const by = Object.fromEntries(asks.map((a) => [JSON.stringify(a.tint), a]));
    const turf = by[JSON.stringify(C.turf)], trim = by[JSON.stringify(C.trim)];
    expect(turf.blocks.length).toBeGreaterThan(0);
    for (const b of turf.blocks) expect(b.max[2] - b.min[2]).toBeLessThanOrEqual(SKIN.cap + 1e-6);
    for (const b of trim.blocks) expect(b.max[2] - b.min[2]).toBeLessThanOrEqual(SKIN.cornice + 1e-6);
    // (the stairs are built: as many cornices as there are stair blocks and floors up a wall)
    // (a cornice on each floor up a wall; a stair is stone alone)
    const stairs = L.parts.filter((p) => p.stair).length, walled = L.parts.filter((p) => !p.stair && p.floor > 0 && plan.gaps[p.floor - 1]?.kind === 'wall').length;
    expect(trim.blocks).toHaveLength(walled);
    expect(turf.blocks).toHaveLength(L.parts.length - stairs - walled);
    expect(by[JSON.stringify(C.stone)].blocks.length).toBeGreaterThanOrEqual(stairs);
    for (const a of asks) expect(a).toMatchObject({ course: false });
  });

  it('is the same every time', () => {
    expect(skinCourse(L, plan, C)).toEqual(asks);
  });
});

describe('a course sized by what its hero clears', () => {
  const H = reach.moves.run.height, slab = slabOf(reach), S = lowerCourse(plan, lane, { slab });
  const floors = (R) => R.blocks[0].blocks.filter((_, k) => R.parts[k].floor !== undefined);
  const drawn = (bs) => bs.reduce((a, b) => a + (b.max[2] - b.min[2]), 0);

  it('its lift and a floor\'s thickness are shares of the running jump, never fixed metres', () => {
    expect(plan.lift).toBe(liftOf(reach));
    expect(plan.lift).toBeGreaterThan(H);
    expect(slab).toBeLessThan(H);
    // (a hero that clears twice as much: a course twice as tall and slabs twice as thick)
    const tall = { ...reach, moves: { ...reach.moves, run: { ...reach.moves.run, height: 2 * H } } };
    expect(liftOf(tall)).toBeCloseTo(2 * liftOf(reach), 3);
    expect(slabOf(tall)).toBeCloseTo(2 * slabOf(reach), 3);
  });

  it('a slab keeps every top and footprint, and is never thicker than a column', () => {
    const a = floors(L), b = floors(S);
    expect(b).toHaveLength(a.length);
    b.forEach((x, k) => { expect(x.max).toEqual(a[k].max); expect(x.min.slice(0, 2)).toEqual(a[k].min.slice(0, 2)); expect(x.min[2]).toBeGreaterThanOrEqual(a[k].min[2]); });
  });

  it('draws less: a climbing course\'s floors are under half the height of their columns', () => {
    expect(drawn(floors(S))).toBeLessThan(0.5 * drawn(floors(L)));
  });

  it('a step or a wall\'s face is whole: a floor reaches down past the lower floor beside it', () => {
    const tops = plan.floors.map((f) => S.base + f.z);
    floors(S).forEach((b, i) => {
      const k = S.parts.filter((p) => p.floor !== undefined)[i].floor;
      for (const z of [tops[k - 1], tops[k + 1]].filter((v) => v !== undefined && v < b.max[2])) expect(b.min[2]).toBeLessThan(z);
    });
  });
});
