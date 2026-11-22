import { describe, it, expect } from 'vitest';
import { readInnerWindows } from './inner-windows.js';
import { planStage, assembleStageScene } from './stage.js';
import { withProgram } from './programs.js';
import { buildingStage } from '../gameworld/levels.js';
import { sees } from '../gameworld/stealth-routes.js';

// INNER WINDOWS (inner-windows.js): glass between a room and its corridor, a hole in both walls, a pane a body cannot
// pass and a gaze can. One building of offices off corridors stands for the procedure.

const B = { use: 'command', seed: 1, scale: 1.5 };

describe('inner windows', () => {
  it('a program\'s windows are read, their dials checked; absent, none', () => {
    expect(readInnerWindows(true)).toMatchObject({ sill: 1, top: 2.1, width: 2.4 });
    expect(() => readInnerWindows({ panes: 2 })).toThrow(/not a setting/);
    expect(() => readInnerWindows({ sill: 1.2, top: 1.5 })).toThrow(/over the sill/);
    expect(planStage(withProgram(buildingStage(B))).windows).toBeUndefined();
  });

  it('each window is cut in the room\'s wall and the corridor\'s, beside the doorway, and its pane is a barrier the scene carries', () => {
    const P = planStage(withProgram(buildingStage({ ...B, windows: true }))), [w] = P.windows.windows;
    const byId = new Map(P.rooms.map((r) => [r.id, r])), FLIP = { '+x': '-x', '-x': '+x', '+y': '-y', '-y': '+y' };
    expect(byId.get(w.room).openings[w.side].some((o) => o.glass && o.sill === w.sill)).toBe(true);
    expect(byId.get(w.corridor).openings[FLIP[w.side]].some((o) => o.glass && o.lo === w.lo)).toBe(true);
    expect(byId.get(w.room).openings[w.side].filter((o) => !o.glass).every((o) => o.hi < w.lo || o.lo > w.hi)).toBe(true);
    const S = assembleStageScene(buildingStage({ ...B, windows: true }));
    expect(S.barriers.filter((b) => b.kind === 'glass').length).toBeGreaterThan(0);
    expect(S.faces.some((f) => f.group === 'stage:pane')).toBe(true);
  });

  it('a guard sees a body through a pane, and not through the wall the pane is cut in', () => {
    const S = assembleStageScene(buildingStage({ ...B, windows: true })), b = S.barriers.find((x) => x.kind === 'glass');
    const X = b.max[0] - b.min[0] < b.max[1] - b.min[1], mid = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2];
    const a = X ? [mid[0] - 2, mid[1]] : [mid[0], mid[1] - 2], c = X ? [mid[0] + 2, mid[1]] : [mid[0], mid[1] + 2];
    const w = { at: a, to: a, cone: 3.2, range: 14, eye: 1.6 };
    // (the wall a floor-to-ceiling box where the pane stands: the route search reads a box off the floor as overhead)
    const pane = { min: [b.min[0], b.min[1], 0], max: [b.max[0], b.max[1], 3], sight: false }, wall = { min: [b.min[0], b.min[1], 0], max: [b.max[0], b.max[1], 3] };
    expect(sees(w, c, 1.6, 0, [pane])).toBe(true);
    expect(sees(w, c, 1.6, 0, [wall])).toBe(false);
  });
});
