// A building's plan, corridor and core (program-core.js, through era/programs.js): each shape round its core, each
// loading of a corridor, the typical floor stacked, the annex and its dock, the settings a building takes and refuses.
import { describe, expect, it } from 'vitest';
import { PROGRAMS, PROGRAM_IDS, planProgram, withProgram } from './programs.js';
import { CORE } from './program-core.js';
import { assembleStageScene } from './stage.js';

const BUILDINGS = PROGRAM_IDS.filter((u) => PROGRAMS[u].shape === 'core');
const office = (o = {}) => planProgram({ use: 'office', ...o }, 'bay-everyday');
const corridors = (P, s = 0) => P.rooms.filter((r) => r.id.startsWith('corridor-') && (r.storey ?? 0) === s);

describe('corridor and core', () => {
  it('each shape lays its wings round the core: an I two, an L and a T their corner, a U its arms', () => {
    const want = { I: 2, L: 2, T: 3, U: 4 };
    for (const w of CORE.wings) {
      const P = office({ wings: w, storeys: 1 });
      expect(corridors(P).length, w).toBe(want[w]);
      expect(P.findings, w).toEqual([]);
    }
  });

  it('a double-loaded corridor has rooms both sides, a single-loaded one on one (its other side the outside wall)', () => {
    const rooms = (loading) => office({ wings: 'I', storeys: 1, bays: 3, loading }).rooms.filter((r) => /-1\d\d$/.test(r.id) || r.id === 'boardroom').length;
    expect(rooms('double')).toBe(2 * rooms('single'));
  });

  it('every storey above the ground the same plate: each room over its twin, one stair a storey up the core', () => {
    const P = office({ storeys: 3 }), on = (s) => P.rooms.filter((r) => (r.storey ?? 0) === s && r.id !== 'lobby');
    const key = (r) => `${r.x},${r.y},${r.w},${r.d}`;
    expect(on(2).map(key).sort()).toEqual(on(1).map(key).sort());
    expect(on(1).map(key).sort()).toEqual(on(0).map(key).sort());
    expect(P.links.filter((l) => l.from.startsWith('core-') && l.to.startsWith('core-'))).toEqual([{ from: 'core-1', to: 'core-2' }, { from: 'core-2', to: 'core-3' }]);
    // the goal on the top storey, its doorway last
    expect(P.rooms.find((r) => r.id === P.goal).storey).toBe(2);
    expect(P.links[P.links.length - 1].to).toBe(P.goal);
  });

  it('an annex stands off the first wing\'s end on the ground, nothing over it, its own ways out', () => {
    const P = planProgram({ use: 'warehouse' }, 'bay-utility'), shed = P.rooms.find((r) => r.id === 'shed');
    expect(shed.h).toBeGreaterThanOrEqual(9);
    expect(shed.storey ?? 0).toBe(0);
    expect(P.rooms.some((r) => r.storey && r.x < shed.x + shed.w && shed.x < r.x + r.w && r.y < shed.y + shed.d && shed.y < r.y + r.d)).toBe(false);
    expect(P.ways).toEqual([{ room: 'lobby', side: '-y' }, { room: 'shed', side: '+x' }]);
  });

  it('a building takes its plan\'s settings and refuses a house\'s; a house refuses a building\'s', () => {
    expect(() => office({ storeys: 7 })).toThrow(/storeys/);
    expect(() => office({ wings: 'H' })).toThrow(/wings is I, L, T, U/);
    expect(() => office({ rooms: {} })).toThrow(/not a setting/);
    expect(() => planProgram({ use: 'tavern', storeys: 2 })).toThrow(/not a setting/);
  });

  it('lowered on a stage, a building takes its use\'s bay kit and its ways, and the bay laws hold', () => {
    const use = BUILDINGS[0], m = withProgram({ kind: 'stage', program: { use, storeys: 2 } });
    expect(m.kit).toBe(PROGRAMS[use].kit);
    expect(m.ways[0]).toEqual({ room: 'lobby', side: '-y' });
    expect(assembleStageScene({ kind: 'stage', program: { use, storeys: 2, bays: 2 } }, {}).bay.laws.filter((l) => !l.ok)).toEqual([]);
  });
});
