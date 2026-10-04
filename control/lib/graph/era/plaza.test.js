import { describe, it, expect } from 'vitest';
import { makeSunShadow, sunDir } from './sun.js';
import { assembleStageScene, buildStageGeometry, planStage } from './stage.js';

const PLAZA_SET = { kind: 'stage', reference: 'sunshine', kit: 'delfino-plaza', rooms: [{ id: 'plaza', x: 0, y: 0, w: 26, d: 22, h: 12, open: ['-y', '+x'] }] };

describe('sun', () => {
  it('sunDir points up at the elevation, round from +x by the azimuth', () => {
    const d = sunDir(90, 0); expect(d[2]).toBeCloseTo(1);
    const e = sunDir(0, 90); expect(e[1]).toBeCloseTo(1); expect(e[2]).toBeCloseTo(0);
  });
  it('a slab overhead shades the ground under it, not the ground beside it; a face turned away is dark', () => {
    const slab = { corners: [[0, 0, 3], [2, 0, 3], [2, 2, 3], [0, 2, 3]] };
    const lit = makeSunShadow([slab], [0, 0, 1]);
    expect(lit([1, 1, 0], [0, 0, 1])).toBe(0);
    expect(lit([5, 1, 0], [0, 0, 1])).toBe(1);
    expect(lit([5, 1, 0], [0, 0, -1])).toBe(0);
  });
  it('a low sun throws a long shadow along its azimuth', () => {
    const wall = { corners: [[0, -5, 0], [0, 5, 0], [0, 5, 4], [0, -5, 4]] };
    const lit = makeSunShadow([wall], sunDir(30, 0));   // sun toward +x: the shadow falls to −x
    expect(lit([-3, 0, 0], [0, 0, 1])).toBe(0);
    expect(lit([-9, 0, 0], [0, 0, 1])).toBe(1);
    expect(lit([3, 0, 0], [0, 0, 1])).toBe(1);
  });
});

describe('the plaza kit', () => {
  const plan = planStage(PLAZA_SET), { faces } = buildStageGeometry(plan);
  it('is open to the sky (no ceiling) and fronts its closed sides with houses of different heights', () => {
    expect(faces.some((f) => f.group === 'stage:ceiling')).toBe(false);
    const tops = new Set(faces.filter((f) => f.group === 'stage:wall' && f.top).map((f) => f.top));
    expect(tops.size).toBeGreaterThan(1);   // a stepped skyline
    expect(faces.some((f) => f.texture === 'clay-terracotta')).toBe(true);
  });
  it('has stuff between pavement and stucco: a raised step and a stone base band', () => {
    expect(faces.some((f) => f.texture === 'granite-pink' && f.corners.every((c) => Math.abs(c[2] - 0.16) < 1e-6))).toBe(true);
    expect(faces.some((f) => f.texture && f.texture.startsWith('rock-sandstone-'))).toBe(true);
  });
  it('bakes daylight with cast shadows: some sunward faces are shaded, the payload carries a sky dome; deterministic', () => {
    const a = assembleStageScene(PLAZA_SET), b = assembleStageScene(PLAZA_SET);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.sky.zenith).toEqual([52, 122, 214]);
    expect(a.lights).toHaveLength(0);
    expect(a.faces.every((f) => f.top === undefined)).toBe(true);
    const lum = (h) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    const sunward = a.faces.filter((f) => f.group === 'stage:wall' && f.cornerFills && f.normal[1] < -0.9);   // the +y row faces −y, toward the sun
    const values = sunward.flatMap((f) => f.cornerFills.map(lum));
    expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(150);   // lit stucco vs eave/balcony shadow
  });
});
