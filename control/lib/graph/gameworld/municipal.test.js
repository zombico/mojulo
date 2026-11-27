// The municipal office (municipal.js): constituents' infra requests read and placed. The laws: a request is its kind's
// words and pay unless it says its own, and a malformed one is refused, teaching; each is placed at a place its kind can
// have (a pothole at a kerb, a fence down a lot's side, a park's litter on its lawn), its material at the works yard, or
// left out; City Hall's clerk desk is a Deskwork shift of work orders whose win is a work order in the bag.
import { describe, it, expect } from 'vitest';
import { readMunicipal, requestSites, REQUEST_KINDS, MUNICIPAL, CLERK_DESK, SITES } from './municipal.js';
import { deskCast } from './temp-agency.js';
import { readMinigames } from '../playscape/ui/minigames.js';

describe('the municipal office: its requests read', () => {
  it('each its kind\'s words and pay unless it says its own; a malformed one refused', () => {
    const M = readMunicipal({ requests: [{ id: 'hole', kind: 'pothole' }, { id: 'fence', kind: 'fence', from: 'Marjorie', reward: 99 }] });
    expect(M.requests[0]).toMatchObject({ id: 'hole', kind: 'pothole', says: REQUEST_KINDS.pothole.says, reward: REQUEST_KINDS.pothole.reward });
    expect(M.requests[1]).toMatchObject({ from: 'Marjorie', reward: 99 });
    expect(readMunicipal(undefined)).toBe(null);
    expect(() => readMunicipal({ requests: [{ id: 'x', kind: 'bridge' }] })).toThrow(/pothole, fence, park/);
    expect(() => readMunicipal({ requests: [{ id: 'x', kind: 'pothole' }, { id: 'x', kind: 'fence' }] })).toThrow(/twice/);
    expect(() => readMunicipal({ requests: [] })).toThrow(/at least one/);
  });
});

describe('the municipal office: its requests placed', () => {
  // (a district told: its start, its works yard, a place by a road whose kerb is free, a building site, a park)
  const park = { id: 'P.park', rect: [200, 0, 260, 36], z: 1, at: [230, 18, 1], trees: [], things: [[200, 17, 260, 19]], gates: [] };
  const ends = { spawn: [0, 0, 1], depots: [{ yard: 'works', at: [100, 100, 1], half: [10, 10] }],
    places: [{ at: [10, 0, 1], N: [0, -1], card: 'gun-store' }, { at: [75, 8, 1], N: [0, -1], card: 'cafe' }, { at: [140, 0, 1], N: [0, -1], card: 'bakery' }],
    kerbAt: (p) => ({ at: [p[0], p[1] - 3, 1], heading: 0 }), lots: [{ id: 'B1', kind: 'construction', rect: [60, 20, 90, 50], at: [75, 35, 1] }], parks: [park] };
  const R = readMunicipal({ requests: [{ id: 'hole', kind: 'pothole' }, { id: 'fence', kind: 'fence' }, { id: 'litter', kind: 'park' }] }).requests;
  const S = requestSites(ends, R);
  it('a pothole at a kerb before a place, a fence down a building site\'s side by its street, the park\'s litter on its lawn', () => {
    expect(S.map((x) => x.id)).toEqual(['hole', 'fence', 'litter']);
    expect(S[0]).toMatchObject({ spots: [{ at: [10, -3, 1] }], where: 'the gun store' });
    expect(S[1].spots).toHaveLength(REQUEST_KINDS.fence.spots);
    expect(S[1].spots.every((q) => q.at[1] === 20 + SITES.inset && q.N[1] === -1)).toBe(true);
    expect(S[1].where).toBe('the building site');
    expect(S[2].spots).toHaveLength(3);
    for (const x of S) expect(x.yard).toEqual({ at: [100, 100, 1], half: [10, 10] });
  });
  it('none where the district keeps no works yard; a kind with no place left out', () => {
    expect(requestSites({ ...ends, depots: [] }, R)).toEqual([]);
    expect(requestSites({ ...ends, lots: [], parks: [] }, R).map((x) => x.id)).toEqual(['hole']);
  });
});

describe('City Hall\'s clerk desk', () => {
  it('a Deskwork shift of work orders, gated by the city worker\'s ID; a shift won a work order in the bag', () => {
    const room = (id, x, y) => ({ id, x, y, w: 6, d: 6, z: 0 });
    const X = deskCast({ seed: 2 }, {}, { spawn: [11, 3, 0], rooms: [room('lobby', 6, 0), room('office-104', 22, 2)] }, CLERK_DESK);
    const [g] = readMinigames(X.play);
    expect(g).toMatchObject({ id: 'clerk', game: 'deskwork', if: { var: 'held:bag:city-id', gte: 1 }, each: `held:bag:${MUNICIPAL.order.item}`, level: 'held:bag:commendation' });
    expect(new Set(g.schedules.flat().map((x) => x.kind))).toEqual(new Set(['permit']));
  });
});
