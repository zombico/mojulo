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
    const P = setPlaces({ metersPerUnit: 0.5, rooms: [{ id: 'lounge', box: { min: [0, 0, 0], max: [10, 8, 6] }, h: 6, walled: true, stand: [4, 6, 0], solids: [{ min: [0, 2], max: [1, 4] }] }], anchors: [{ id: 'sofa', kind: 'spot', at: [5, 3, 0] }] });
    expect(P.rooms).toEqual([{ id: 'lounge', min: [0, 0], max: [5, 4], walled: true, h: 3, solids: [{ min: [0, 1], max: [0.5, 2] }] }]);
    expect(P.marks['room-lounge']).toEqual([2, 3]);
    expect(P.marks.sofa).toEqual([2.5, 1.5]);
    // (a cast with no marks stands about the room's `stand`, not its middle)
    const { screenplay } = castOnSet({ cast: { ada: {}, jon: {} }, script: 'ADA: Hi.' }, P);
    expect(screenplay.marks['ada-mark'][1]).toBe(3);
    // (a room that is not walled keeps the shape it had)
    expect(setPlaces({ rooms: [{ id: 'hall', box: { min: [0, 0, 0], max: [4, 4, 3] }, h: 3 }] }).rooms).toEqual([{ id: 'hall', min: [0, 0], max: [4, 4] }]);
  });
});
