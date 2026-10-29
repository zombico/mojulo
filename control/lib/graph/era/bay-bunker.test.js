// The bunker construction (style/bay-axes.js CONSTRUCTIONS.bunker): the bay shell's fittings a military base's walled
// layers are built with, laid by bay.js only where a construction asks for them (B.fittings): a blast door's leaf
// parked over each doorway, chevrons down its jambs, cable trays down the long walls under the crown, a placard by each
// door. On the same two-room suite the other bay tests build: one construction stands for the procedure.
import { describe, expect, it } from 'vitest';
import { planStage, buildStageGeometry } from './stage.js';
import { readCompose } from './compose.js';
import { dipPath } from './bay.js';

const SUITE = { kind: 'stage', kit: 'bay-military', rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 12, h: 3.5 }, { id: 'tall', x: -6, y: 12, w: 18, d: 30, h: 12 }], links: [{ from: 'low', to: 'tall' }] };
const build = (m) => buildStageGeometry(planStage(m));

describe('the bunker', () => {
  it('lays its fittings: a leaf over each doorway, trays down the long walls, a placard by each door', () => {
    const g = build({ ...SUITE, compose: { construction: 'bunker' } });
    const F = g.bayRooms.map((R) => R.fittings);
    expect(F.every(Boolean)).toBe(true);
    expect(F.reduce((n, f) => n + f.leaves, 0)).toBeGreaterThan(0);
    expect(F.reduce((n, f) => n + f.trays, 0)).toBeGreaterThan(0);
    expect(F.reduce((n, f) => n + f.placards, 0)).toBeGreaterThan(0);
  });

  it('is heard in words: a bunker, blast doors', () => {
    expect(readCompose({ words: 'a hardened bunker with blast doors' }).resolved.construction).toBe('bunker');
    expect(readCompose({ words: 'board-formed concrete and steel plate' }).resolved.construction).toBe('military');
  });

  it('is absent everywhere else: a military stage lays none of it', () => {
    const g = build(SUITE);
    expect(g.bayRooms.every((R) => R.fittings === undefined)).toBe(true);
  });
});

describe('a cable bent along the wall', () => {
  it('dips at 45° where a span holds the dip, and runs straight past one too short', () => {
    const pts = dipPath(0, 10, 5, 4, [[1, 5], [6, 7]]);
    expect(pts).toEqual([[0, 5], [1.3, 5], [2.3, 4], [3.7, 4], [4.7, 5], [10, 5]]);
    // every leg level, or a 45° slope
    for (let i = 1; i < pts.length; i++) {
      const du = Math.abs(pts[i][0] - pts[i - 1][0]), dz = Math.abs(pts[i][1] - pts[i - 1][1]);
      expect(dz === 0 || Math.abs(du - dz) < 1e-9, `leg ${i}`).toBe(true);
    }
  });
});
