import { describe, it, expect } from 'vitest';
import { courseCube, courseColours, skinCourse, SKIN } from './course-skin.js';
import { coursePlan, lowerCourse } from './course.js';
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
    const built = L.parts.filter((p, k) => p.stair || (p.floor > 0 && plan.gaps[p.floor - 1]?.kind === 'wall')).length;
    expect(trim.blocks).toHaveLength(built);
    expect(turf.blocks).toHaveLength(L.parts.length - built);
    for (const a of asks) expect(a).toMatchObject({ course: false });
  });

  it('is the same every time', () => {
    expect(skinCourse(L, plan, C)).toEqual(asks);
  });
});
