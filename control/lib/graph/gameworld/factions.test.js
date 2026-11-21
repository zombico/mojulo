// FACTIONS: the sides of an open city, each a row its maker writes; turf a part of the district, never shared.
import { describe, it, expect } from 'vitest';
import { readFactions, turfRect, factionAt, turfZones, FACTIONS } from './factions.js';

const TWO = { reds: { colour: '#C0392B', turf: 'north', rivals: ['dockers'] }, dockers: { name: 'The Dockers', colour: '#2e86c1', turf: [0, 0, 1, 0.4], says: 'Welcome aboard.' } };

describe('factions', () => {
  it('reads each row: a name from its id, its colour, its turf from a side\'s word or a rectangle, its rivals', () => {
    const F = readFactions(TWO);
    expect(F).toEqual([
      { id: 'reds', name: 'Reds', colour: '#c0392b', turf: [0, 0.5, 1, 1], rivals: ['dockers'], says: FACTIONS.says, board: [] },
      { id: 'dockers', name: 'The Dockers', colour: '#2e86c1', turf: [0, 0, 1, 0.4], rivals: [], says: 'Welcome aboard.', board: [] },
    ]);
    expect(readFactions(undefined)).toBeNull();
  });
  it('turf is laid on the district\'s own box, and a point is one faction\'s or no one\'s', () => {
    const F = readFactions(TWO), box = [100, 200, 500, 1000];
    expect(turfRect(F[0], box)).toEqual([100, 600, 500, 1000]);
    expect(factionAt(F, box, 300, 900)).toBe('reds');
    expect(factionAt(F, box, 300, 300)).toBe('dockers');
    expect(factionAt(F, box, 300, 560)).toBeNull();
    expect(turfZones(F, box).map((z) => [z.id, z.colour, z.r])).toEqual([['reds', '#c0392b', [100, 600, 500, 1000]], ['dockers', '#2e86c1', [100, 200, 500, 520]]]);
  });
  it('a board is what a faction posts: acts, each a verb on a target, paid in money and standing, posted at a rank', async () => {
    const { actLine } = await import('./factions.js');
    const F = readFactions({ ...TWO, reds: { ...TWO.reds, board: [{ id: 'torch', act: { verb: 'torch', target: 'car', on: 'dockers' }, reward: [{ item: 'coin', n: 50 }] }, { id: 'tag', act: { verb: 'tag' }, standing: 2, rank: 1 }] } });
    expect(F[0].board).toEqual([{ id: 'torch', name: 'Torch', act: { verb: 'torch', target: 'car', on: 'dockers' }, reward: [{ item: 'coin', n: 50 }], standing: 1, rank: 0 }, { id: 'tag', name: 'Tag', act: { verb: 'tag' }, reward: [], standing: 2, rank: 1 }]);
    expect(actLine(F[0].board[0], F)).toBe('Torch a car on The Dockers turf');
    expect(actLine(F[0].board[1], F)).toBe('Tag');
    const bad = (board) => () => readFactions({ ...TWO, reds: { ...TWO.reds, board } });
    expect(bad([])).toThrow(/what it posts/);
    expect(bad([{ id: 'torch' }])).toThrow(/act is \{ verb/);
    expect(bad([{ id: 'torch', act: { verb: 'torch', on: 'reds' } }])).toThrow(/another faction/);
    expect(bad([{ id: 'torch', act: { verb: 'torch' }, rank: -1 }])).toThrow(/rank is the standing/);
    expect(() => readFactions({ reds: { ...TWO.reds, rivals: [], board: [{ id: 'x', act: { verb: 'tag' } }] }, dockers: { ...TWO.dockers, board: [{ id: 'x', act: { verb: 'tag' } }] } })).toThrow(/names two postings/);
  });
  it('refuses a malformed one, saying what a faction is', () => {
    expect(() => readFactions({})).toThrow(/the sides of the city/);
    expect(() => readFactions({ Reds: { colour: '#c0392b', turf: 'north' } })).toThrow(/one lower-case word/);
    expect(() => readFactions({ reds: { colour: 'red', turf: 'north' } })).toThrow(/#rrggbb/);
    expect(() => readFactions({ reds: { colour: '#c0392b', turf: 'uptown' } })).toThrow(/a side \(north/);
    expect(() => readFactions({ reds: { colour: '#c0392b', turf: 'north', rivals: ['law'] } })).toThrow(/names other factions/);
    expect(() => readFactions({ reds: { colour: '#c0392b', turf: 'north', boss: 'x' } })).toThrow(/not a faction's key/);
    expect(() => readFactions({ reds: { colour: '#c0392b', turf: 'north' }, blues: { colour: '#2e86c1', turf: 'north-east' } })).toThrow(/may not overlap/);
  });
});
