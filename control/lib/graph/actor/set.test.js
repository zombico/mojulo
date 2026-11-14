import { describe, it, expect } from 'vitest';
import { setPlaces, castOnSet } from './set.js';

// a world as a set: its rooms' middles, its anchors and the stands at its doors as marks, nothing on a wall, in metres
const payload = {
  rooms: [{ id: 'hall', box: { min: [0, 0, 0], max: [8, 6, 4] } }, { id: 'den', box: { min: [0, 6, 0.5], max: [4, 10, 3] } }],
  anchors: [
    { id: 'doorway-hall-den', kind: 'doorway', at: [2, 6, 0], N: [0, 1, 0], between: ['hall', 'den'] },
    { id: 'torch-1', kind: 'torch', at: [0.1, 3, 2.7], N: [1, 0, 0] },
    { id: 'pocket-1', kind: 'beat', at: [6, 2, 1.25] },
  ],
};

describe('a set', () => {
  it('names its rooms, its places and the stands at its doors, with the floor under each, and nothing on a wall', () => {
    const P = setPlaces(payload);
    expect(P.marks['room-hall']).toEqual([4, 3]);
    expect(P.floors['room-den']).toBe(0.5);
    expect(P.marks['pocket-1']).toEqual([6, 2]);
    expect(P.floors['pocket-1']).toBe(1.25);
    expect(Object.keys(P.marks)).toContain('doorway-hall-den-hall');
    expect(Object.keys(P.marks)).not.toContain('torch-1');
    expect(P.rooms.map((R) => R.id)).toEqual(['hall', 'den']);
  });

  it('reads a feet world in metres', () => {
    const P = setPlaces({ ...payload, metersPerUnit: 0.3048 });
    expect(P.marks['room-hall'][0]).toBeCloseTo(4 * 0.3048, 3);
    expect(P.rooms[0].max[1]).toBeCloseTo(6 * 0.3048, 3);
  });

  it('stands a part with no mark in the largest room, its own marks and a part\'s mark kept', () => {
    const P = setPlaces(payload);
    const { screenplay, floor } = castOnSet({ cast: { ana: {}, ben: { mark: 'pocket-1' } }, marks: { chair: [1, 1] }, script: 'ANA: Hi.' }, P);
    expect(screenplay.cast.ana.mark).toBe('ana-mark');
    expect(screenplay.marks['ana-mark'][1]).toBe(3);
    expect(screenplay.cast.ben.mark).toBe('pocket-1');
    expect(screenplay.marks.chair).toEqual([1, 1]);
    expect(floor).toBe(0);
    expect(castOnSet({ cast: { ben: { mark: 'pocket-1' } }, script: 'BEN: Hi.' }, P).floor).toBe(1.25);
  });
  it('reads a walled room: where its cast stands, its ceiling and what stands tall in it, in metres', () => {
    const P = setPlaces({ metersPerUnit: 0.5, rooms: [{ id: 'lounge', box: { min: [0, 0, 0], max: [10, 8, 6] }, h: 6, walled: true, stand: [4, 6, 0], solids: [{ min: [0, 2], max: [1, 4] }], blocks: [{ min: [0, 2], max: [1, 4], h: 6 }, { min: [6, 2], max: [8, 3] }], openings: [{ kind: 'door', min: [2, 8], max: [5, 8], sill: 0, head: 4 }, { kind: 'window', min: [0, 1], max: [0, 3], sill: 2, head: 5 }] }], anchors: [{ id: 'sofa', kind: 'spot', at: [5, 3, 0] }] });
    expect(P.rooms).toEqual([{ id: 'lounge', min: [0, 0], max: [5, 4], walled: true, h: 3, solids: [{ min: [0, 1], max: [0.5, 2] }], blocks: [{ min: [0, 1], max: [0.5, 2], h: 3 }, { min: [3, 1], max: [4, 1.5] }], openings: [{ kind: 'door', min: [1, 4], max: [2.5, 4], sill: 0, head: 2 }, { kind: 'window', min: [0, 0.5], max: [0, 1.5], sill: 1, head: 2.5 }] }]);
    expect(P.marks['room-lounge']).toEqual([2, 3]);
    expect(P.marks.sofa).toEqual([2.5, 1.5]);
    // (a cast with no marks stands about the room's `stand`, not its middle)
    const { screenplay } = castOnSet({ cast: { ada: {}, jon: {} }, script: 'ADA: Hi.' }, P);
    expect(screenplay.marks['ada-mark'][1]).toBe(3);
    // (a room that is not walled keeps the shape it had)
    expect(setPlaces({ rooms: [{ id: 'hall', box: { min: [0, 0, 0], max: [4, 4, 3] }, h: 3 }] }).rooms).toEqual([{ id: 'hall', min: [0, 0], max: [4, 4] }]);
  });
});

describe('a building as a place', () => {
  it('is stood before its front, on the ground it stands on, not in its middle', () => {
    const P = setPlaces({ anchors: [{ id: 'house-1', kind: 'house', at: [24.6, 47, 4.7], N: [-1, 0, 0], floor: 4.7, box: { min: [22.5, 42, 4.7], max: [38.5, 49, 15] } }, { id: 'well', kind: 'spot', at: [3, 3, 0], N: [0, 1, 0] }] });
    expect(P.marks['house-1'][0]).toBeLessThan(22.5 - 1);
    expect(P.marks['house-1'][1]).toBe(47);
    expect(P.floors['house-1']).toBe(4.7);
    // (a place with no box is where it says)
    expect(P.marks.well).toEqual([3, 3]);
  });
});

describe('the places a geocube\'s world knows', () => {
  const town = { geocube: { show: 'geotown' }, walk: { spawn: [17.7, 56.8, 6.58], minEye: 1.7 },
    geotown: { ports: [{ id: 'ns-0', from: [9, 0], to: [9, 70], z: [3, 5] }, { id: 'ew-0', from: [0, 10], to: [115, 10], z: [3.6, 2] }] },
    walkers: [{ path: [[10, 0, 3], [10, 20, 3.5], [10, 40, 4]] }], anchors: [{ id: 'house-1', kind: 'house', at: [24, 47, 4.7] }] };

  it('are its walk\'s start, its streets and where two cross, and the ways a walker goes', () => {
    const P = setPlaces(town);
    expect(P.marks.start).toEqual([17.7, 56.8]);
    expect(P.floors.start).toBeCloseTo(4.88, 2);
    expect(P.marks.street).toEqual([9, 35]);
    expect(P.floors.street).toBe(4);
    expect(P.marks['street-2']).toEqual([57.5, 10]);
    expect(P.marks.crossing).toEqual([9, 10]);
    expect(P.paths).toEqual([[[10, 0], [10, 20], [10, 40]]]);
    // (its own places come first: a part with no mark stands by the first)
    expect(Object.keys(P.marks)[0]).toBe('house-1');
  });

  it('a city\'s are the street corners nearest its seat, on the pavement, at the height its walker goes', () => {
    const P = setPlaces({ geocity: { seat: [100, 100] }, walk: { spawn: [100, 90, 8], minEye: 1.7 }, walkers: [{ path: [[101, 95, 6.5], [140, 95, 6.9]] }],
      flow: { signals: [{ x: 300, y: 100, wx: 30, wy: 20 }, { x: 110, y: 100, wx: 30, wy: 20 }] } });
    expect(P.marks.corner).toEqual([127, 88]);
    expect(P.floors.corner).toBe(6.9);
    expect(P.marks['corner-2'][0]).toBeGreaterThan(300);
    expect(P.marks.start).toBeDefined();
  });

  it('a world that is no geocube\'s names none of them', () => {
    const P = setPlaces({ walk: { spawn: [1, 2, 3] }, walkers: [{ path: [[0, 0, 0], [5, 0, 0]] }], anchors: [{ id: 'well', kind: 'spot', at: [3, 3, 0] }] });
    expect(Object.keys(P.marks)).toEqual(['well']);
    expect(P.paths).toBeUndefined();
  });
});

