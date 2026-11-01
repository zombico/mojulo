// A military base's buildings (programs.js BASE_USES): corridor-and-core uses whose rooms are what a base is stocked
// for, each on the bay kit of what it is. One case per way the core lays them: with an annex (the hangar bay's hangar
// off its first wing's end, its own doors out) and without (the barracks' L of bunk rooms on two storeys).
import { describe, expect, it } from 'vitest';
import { planProgram, PROGRAMS, BASE_USES, PROGRAM_IDS } from './programs.js';

const plan = (use, o = {}) => planProgram({ use, seed: 1, ...o }, PROGRAMS[use].kit);
const roles = (P) => new Set(P.rooms.map((r) => r.id.replace(/-\d+[a-z]?$/, '')));

describe('a base building', () => {
  it('with an annex: the hangar bay, its hangar a way out of its own, flight ops its goal', () => {
    const P = plan(BASE_USES.find((u) => PROGRAMS[u].annex));
    expect(P.findings).toEqual([]);
    expect(P.goal).toBe('flight-ops');
    // (a wing's first bay is its service room or the use's second, by the plan's dice; the rest are the use's own)
    for (const r of ['lobby', 'core', 'corridor', 'shop', 'parts', 'flight-ops', 'hangar']) expect(roles(P).has(r), r).toBe(true);
    expect(P.ways).toContainEqual({ room: 'hangar', side: '+x' });
  });

  it('without one: the barracks, bunk rooms up two storeys, the first sergeant at the top', () => {
    const P = plan(BASE_USES.find((u) => !PROGRAMS[u].annex && PROGRAMS[u].core.storeys > 1));
    expect(P.findings).toEqual([]);
    expect(P.goal).toBe('nco-office');
    expect(P.rooms.find((r) => r.id === 'nco-office').storey).toBe(1);
    expect(P.rooms.filter((r) => r.id.startsWith('bunks-')).length).toBeGreaterThan(4);
  });

  it('the base uses are listed apart, and are uses like any other', () => {
    expect(BASE_USES.length).toBeGreaterThan(0);
    expect(BASE_USES.every((u) => PROGRAM_IDS.includes(u) && PROGRAMS[u].base)).toBe(true);
    expect(PROGRAM_IDS.filter((u) => PROGRAMS[u].base)).toEqual(BASE_USES);
  });
});
