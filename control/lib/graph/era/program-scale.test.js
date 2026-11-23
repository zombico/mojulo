import { describe, it, expect } from 'vitest';
import { withProgram, planProgram } from './programs.js';
import { planStage } from './stage.js';
import { STAIR_PROFILES } from '../construction/circulation.js';
import { buildingStage } from '../gameworld/levels.js';

// A BUILDING LAID LARGER (program-core.js `scale`): a third-person camera's room. One use of the core shape with a
// storey over its ground stands for the procedure: its rooms, corridors and core that many times larger, its storeys
// the root of it taller, its stair the `hall` flight; scale 1 the plan as it was.

const USE = 'warehouse';
const sizeOf = (r) => [+(r.x1 - r.x0).toFixed(2), +(r.y1 - r.y0).toFixed(2)];

describe('a building laid larger', () => {
  it('scale 1 is the plan as it was, byte for byte', () => {
    expect(withProgram(buildingStage({ use: USE, seed: 1, scale: 1 }))).toEqual(withProgram(buildingStage({ use: USE, seed: 1 })));
  });

  it('its rooms, corridors and core larger, its storeys taller, its stair the hall flight with more floor at its ends', () => {
    const a = withProgram(buildingStage({ use: USE, seed: 1 })), b = withProgram(buildingStage({ use: USE, seed: 1, scale: 1.5 }));
    const A = planStage(a), B = planStage(b), by = (P, id) => P.rooms.find((r) => r.id === id);
    expect(a.stair).toBe('game');
    expect(b.stair).toBe('hall');
    for (const id of ['core-1', 'corridor-1a', a.rooms.find((r) => /-101$/.test(r.id)).id]) {
      const [w0, d0] = sizeOf(by(A, id)), [w1, d1] = sizeOf(by(B, id));
      expect(w1 * d1, id).toBeGreaterThan(1.8 * w0 * d0);
      expect(by(B, id).h, id).toBeGreaterThan(by(A, id).h);
    }
    expect(B.stairs.length).toBe(A.stairs.length);
    const span = (s) => Math.min(s.rect[2] - s.rect[0], s.rect[3] - s.rect[1]);
    expect(span(B.stairs[0])).toBeGreaterThan(span(A.stairs[0]));
    expect(STAIR_PROFILES.hall.width).toBeGreaterThan(STAIR_PROFILES.game.width);
    expect(STAIR_PROFILES.hall.landing).toBeGreaterThan(STAIR_PROFILES.game.landing);
  });

  it('refused past twice a walker\'s room', () => {
    expect(() => planProgram({ use: USE, scale: 3 }, 'bay-utility')).toThrow(/scale is how much larger/);
  });
});
