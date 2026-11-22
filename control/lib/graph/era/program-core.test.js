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

describe('a floor 0 lodged deeper', () => {
  // (a core building with an annex: the one whose undercroft is the hall)
  const use = BUILDINGS.find((u) => PROGRAMS[u].annex), kit = PROGRAMS[use].kit, role = PROGRAMS[use].annex.role;
  it('basement: { hall } makes the annex\'s undercroft that high and lays no flight to it; the storey over stands that much higher', () => {
    const flat = planProgram({ use, basement: true }, kit), deep = planProgram({ use, basement: { hall: 10 } }, kit);
    const under = (P) => P.rooms.find((r) => r.id === `${role}-under`);
    expect(under(flat).h).toBeLessThan(5);
    expect(under(deep).h).toBe(10);
    expect(flat.links.some((l) => l.from === 'core-0' && l.to === 'core-1')).toBe(true);
    expect(deep.links.some((l) => l.from === 'core-0' && l.to === 'core-1')).toBe(false);
    expect(deep.findings.map((f) => f.id)).toContain('deep-floor');
    const S = assembleStageScene({ kind: 'stage', kit, program: { use, basement: { hall: 10 } }, level: {}, compose: {} });
    const z = (id) => S.rooms.find((r) => r.id.replace(/@\d+$/, '') === id).box.min[2];
    expect(z(role) - z(`${role}-under`)).toBeGreaterThan(10);
  });
  it('refuses a hall that is no height, and a setting it does not know', () => {
    expect(() => planProgram({ use, basement: { hall: 2 } }, kit)).toThrow(/hall/);
    expect(() => planProgram({ use, basement: { depth: 10 } }, kit)).toThrow(/hall/);
  });
});

describe('a lift between the annex and the hall under it', () => {
  const use = BUILDINGS.find((u) => PROGRAMS[u].annex), kit = PROGRAMS[use].kit, role = PROGRAMS[use].annex.role;
  const stage = (basement) => assembleStageScene({ kind: 'stage', kit, program: { use, basement }, level: {}, compose: {} });
  const inRect = (f, R) => { const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]); const cx = xs.reduce((a, b) => a + b, 0) / xs.length, cy = ys.reduce((a, b) => a + b, 0) / ys.length; return cx > R[0] + 0.2 && cx < R[2] - 0.2 && cy > R[1] + 0.2 && cy < R[3] - 0.2; };
  it('basement: { lift } cuts an opening through the floor between them, lines its shaft and marks its edge', () => {
    const S = stage({ hall: 10, lift: true }), L = S.anchors.find((a) => a.kind === 'lift');
    expect(L).toMatchObject({ between: [`${role}-under`, role] });
    expect(L.to[2] - L.at[2]).toBeGreaterThan(10);
    const flat = (f) => Math.max(...f.corners.map((c) => c[2])) - Math.min(...f.corners.map((c) => c[2])) < 1e-6;
    // nothing level lies across the opening between the lower hall's floor and the upper hall's ceiling
    const across = S.faces.filter((f) => flat(f) && f.corners[0][2] > L.at[2] + 0.1 && f.corners[0][2] < L.to[2] + 0.5 && inRect(f, L.rect));
    expect(across).toEqual([]);
    // (where the same building without the lift has its floor and its ceiling there)
    const whole = stage({ hall: 10 });
    expect(whole.anchors.some((a) => a.kind === 'lift')).toBe(false);
    expect(whole.faces.filter((f) => flat(f) && f.corners[0][2] > L.at[2] + 0.1 && f.corners[0][2] < L.to[2] + 0.5 && inRect(f, L.rect)).length).toBeGreaterThan(0);
    expect(S.faces.some((f) => f.group === 'stage:hazard' && Math.abs(f.corners[0][2] - L.to[2]) < 0.1)).toBe(true);
  });
  it('it stands where it is asked across the hall, inside its walls, and a word it does not know is refused', () => {
    const at = (lift) => stage({ hall: 10, lift }).anchors.find((a) => a.kind === 'lift').rect;
    const a = at({ at: [0.2, 0.5] }), b = at({ at: [0.8, 0.5] }), small = at({ w: 4, d: 5 });
    expect(b[0]).toBeGreaterThan(a[0]);
    expect([small[2] - small[0], small[3] - small[1]]).toEqual([4, 5]);
    expect(() => planProgram({ use, basement: { hall: 10, lift: { deep: 1 } } }, kit)).toThrow(/lift/);
  });
});
