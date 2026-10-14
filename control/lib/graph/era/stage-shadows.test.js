/**
 * A stage's `shadows`: the gen-6 shadow upgrades, opt-in. Torch shadows (a placed light reaches only what it can
 * see), a soft sun edge, and finer cells for a shadow to land on. Absent, the bake is today's.
 */
import { describe, expect, it } from 'vitest';

import { assembleStageScene } from './stage.js';
import { makePointShadow, makeSoftSunShadow, makeSunShadow, sunDir } from './sun.js';

const ROOM = { kind: 'stage', kit: 'gothic-stone', reference: 'gothic-night', rooms: [{ id: 'r', x: 0, y: 0, w: 12, d: 12, h: 6, open: ['-y', '+x'] }] };
const lit = (p) => p.faces.filter((f) => f.cornerFills).reduce((a, f) => a + f.cornerFills.reduce((b, h) => b + [1, 3, 5].reduce((c, i) => c + parseInt(h.slice(i, i + 2), 16), 0), 0), 0);
const wall = [{ corners: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], normal: [-1, 0, 0] }];

describe('sun.js: a point light\'s shadow and a soft sun', () => {
  it('is dark behind a wall and lit in front, with a soft edge between', () => {
    const hard = makePointShadow(wall, [0, 0, 0]), soft = makePointShadow(wall, [0, 0, 0], { soft: 0.3 });
    expect(hard([2, 0, 0], [-1, 0, 0])).toBe(0);
    expect(hard([-1, 0, 0], [1, 0, 0])).toBe(1);
    const edge = soft([2, 2.05, 0], [-1, 0, 0]);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(1);
  });
  it('a soft sun is the hard one at 0 degrees, and partial at a shadow\'s edge otherwise', () => {
    const roof = [{ corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], normal: [0, 0, -1] }], up = sunDir(90, 0);
    expect(makeSoftSunShadow(roof, up, 0)([0, 0, 0], [0, 0, 1])).toBe(makeSunShadow(roof, up)([0, 0, 0], [0, 0, 1]));
    const s = makeSoftSunShadow(roof, sunDir(89, 0), 3)([0.99, 0, 0], [0, 0, 1]);
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(1);
  });
});

describe('stage: shadows', () => {
  it('reads its settings and refuses what it does not know', () => {
    expect(() => assembleStageScene({ ...ROOM, shadows: { glow: 1 } }, {})).toThrow(/shadows.glow is not a setting/);
    expect(() => assembleStageScene({ ...ROOM, shadows: { torch: 'on' } }, {})).toThrow(/shadows.torch is 'off', 'hard' or 'soft'/);
    expect(() => assembleStageScene({ ...ROOM, shadows: { cells: 0.1 } }, {})).toThrow(/shadows.cells/);
  });
  it('cuts the surfaces finer, and the torches stop at what stands in their way', () => {
    const today = assembleStageScene(ROOM, {}), cells = assembleStageScene({ ...ROOM, shadows: { cells: 0.5 } }, {}), torch = assembleStageScene({ ...ROOM, shadows: { torch: 'hard', cells: 0.5 } }, {});
    expect(cells.faces.length).toBeGreaterThan(today.faces.length);
    expect(torch.faces.length).toBe(cells.faces.length);
    expect(lit(torch)).toBeLessThan(lit(cells) * 0.97);
    // the page's lights stay plain: a shadow test is the bake's, never the payload's
    expect(torch.lights.every((l) => l.shadow === undefined)).toBe(true);
  });
});
