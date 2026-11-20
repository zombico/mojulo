import { describe, it, expect } from 'vitest';
import { FACILITIES, FACILITY_IDS, facilityBuilding } from './facilities.js';
import { PROGRAMS, withProgram } from './programs.js';
import { planStage } from './stage.js';
import { roleOf } from './stocking.js';
import { buildingStage } from '../gameworld/levels.js';
import { readWcd } from '../wcd/wcd.js';
import { readGameworld, MEADOWMARK } from '../gameworld/index.js';

// FACILITIES (facilities.js): a building designed to move through, named; its rooms' floors laid in figures
// (room-layouts.js) and held to their laws (compose-dress.js layoutReport). One facility, the one with a hall (its use's
// annex), stands for the procedure; the bare building beside it is the absence.

const planOf = (B) => planStage(withProgram(buildingStage({ seed: 1, ...B })));
const withHall = FACILITY_IDS.find((id) => PROGRAMS[FACILITIES[id].use].annex);

describe('facilities', () => {
  it('a facility is its use, look, dials and layouts; the recipe\'s own over them; a use not its own refused', () => {
    const F = FACILITIES[withHall], B = facilityBuilding(withHall, { seed: 3, look: { palette: 'science' }, layouts: { lobby: 'islands' } });
    expect(B.use).toBe(F.use);
    expect(B.seed).toBe(3);
    expect(B.look).toEqual({ ...F.look, palette: 'science' });
    expect(B.layouts.lobby).toBe('islands');
    expect(Object.keys(B.layouts)).toEqual(expect.arrayContaining(Object.keys(F.layouts)));
    expect(B.facility).toBeUndefined();
    expect(() => facilityBuilding('moon-base')).toThrow(/not one/);
    expect(() => facilityBuilding(withHall, { use: FACILITY_IDS.map((id) => FACILITIES[id].use).find((u) => u !== F.use) })).toThrow(/give its use or none/);
  });

  it('built, its rooms of the roles it names are laid in their figures, and its hall holds every law; the same building bare lays none', () => {
    const F = FACILITIES[withHall], P = planOf({ facility: withHall }), L = P.compose.layouts;
    const roles = new Set(P.rooms.map((r) => roleOf(r.id)));
    for (const role of Object.keys(F.layouts)) expect(roles, role).toContain(role);
    const hall = PROGRAMS[F.use].annex.role;
    expect(L[hall].layout).toBe(F.layouts[hall].layout);
    expect(L[hall].pieces).toBeGreaterThan(8);
    for (const l of L[hall].laws) expect(l.holds, `${hall}: ${l.law}: ${l.says}`).toBe(true);
    expect(P.props.some((it) => it.room === hall && it.id.includes('/layout/'))).toBe(true);
    const bare = planOf({ use: F.use, look: F.look, fight: F.fight });
    expect(bare.compose.layouts).toBeUndefined();
    expect(bare.props.some((it) => it.id.includes('/layout/'))).toBe(false);
  });

  it('a walled-core dungeon\'s space names a facility: its use and look the facility\'s, its own look winning', () => {
    const F = FACILITIES[withHall];
    const W = readWcd({ core: 'b', spaces: { a: { kind: 'outer', depth: 0, facility: withHall }, b: { kind: 'inner', depth: 1, facility: withHall, look: { construction: 'bunker', palette: 'military' } } }, doors: [{ from: 'a', to: 'b', via: 'door', gate: { clearance: 1 } }] });
    expect(W.spaces.a).toMatchObject({ use: F.use, facility: withHall, look: F.look });
    expect(W.spaces.b.look).toEqual({ construction: 'bunker', palette: 'military' });
    expect(() => readWcd({ core: 'a', spaces: { a: { kind: 'inner', depth: 0, facility: 'moon-base' } } })).toThrow(/facility 'moon-base' is not one/);
  });

  it('a world reads a level\'s building by its facility, or the facility of the dungeon\'s space on it; a word not one refused', () => {
    const W = (building, wcd) => ({ ...MEADOWMARK, levels: { ...MEADOWMARK.levels, base: { name: 'The base', building } }, ...(wcd ? { wcd } : {}) });
    expect(() => readGameworld(W({ facility: withHall, seed: 2 }))).not.toThrow();
    expect(() => readGameworld(W({ facility: 'moon-base' }))).toThrow(/facility 'moon-base' is not one/);
    expect(() => readGameworld(W({ use: withHall === 'depot' ? 'plant' : 'warehouse', facility: withHall }))).toThrow(/give its use or none/);
    const spaced = readGameworld(W({ seed: 2 }, { core: 'hq', spaces: { hq: { kind: 'inner', depth: 0, level: 'base', facility: withHall } }, doors: [] }));
    expect(spaced.wcd.spaces.hq.use).toBe(FACILITIES[withHall].use);
  });
});
