import { describe, it, expect } from 'vitest';
import { MASSIF_CARDS, readMassif, massifField, massifLaws } from './massif.js';
import { readLocalMeru } from './plan.js';

// THE MASSIF (massif.js): a field's standing rock as words. One case per concept, on the smallest massif that has it: one
// block, one cut, one pool. The words read and refuse; a wall stands sheer and steps at the column's beds; a cut is
// floored and walled by the same beds; a pool and a river are carved under the floor's datum; the field is the same for
// the same words; the laws read the land it made; absent, the meru is as it was.
const one = (more = {}) => readMassif({ from: 'wadi', blocks: [{ at: [0, 0], size: [160, 120], dir: 0, height: 90 }], cuts: [], pools: [], clefts: { per: 0, width: [12, 20], reach: 0.5 }, warp: { strength: 0, scale: 50 }, flute: { depth: 0, scale: 10 }, ...more });

describe('the massif', () => {
  it('reads a card or its words, and refuses what it does not know, teaching', () => {
    const id = Object.keys(MASSIF_CARDS)[0];
    expect(readMassif(id).id).toBe(id);
    expect(readMassif({ from: id, slope: 0 }).id).toBe(`${id}*`);
    expect(readMassif(undefined)).toBeNull();
    expect(() => readMassif('swamp')).toThrow(/not a card/);
    expect(() => readMassif({ walls: 3 })).toThrow(/not a word/);
    expect(() => readMassif({ beds: [{ top: 20, bench: 2 }, { top: 10, bench: 2 }] })).toThrow(/bottom up/);
    expect(() => readMassif({ cuts: [{ path: [[0, 0]], width: 10 }] })).toThrow(/2 or more/);
  });

  it('stands its walls sheer and steps them at the column\'s beds, the same for the same words', () => {
    const M = one(), F = massifField(M, [0, 0], 3), G = massifField(structuredClone(M), [0, 0], 3);
    // (inside, the block's height and its cap; outside past its talus, none)
    expect(F.rock(0, 0)).toBeGreaterThanOrEqual(90);
    expect(F.rock(300, 0)).toBe(0);
    // (across a riser: a bed's height climbed within a few metres)
    let steepest = 0;
    for (let x = 100; x < 170; x += 1) steepest = Math.max(steepest, F.rock(x, 0) - F.rock(x + 4, 0));
    expect(steepest).toBeGreaterThan(20);
    for (const [x, y] of [[0, 0], [159, 3], [170, -10]]) expect(G.rock(x, y)).toBe(F.rock(x, y));
  });

  it('floors and walls a cut with the same beds, and carves water under the floor\'s datum', () => {
    const M = one({ cuts: [{ path: [[-300, 0], [300, 0]], width: 80, river: { width: 10, depth: 5 } }], pools: [{ at: [250, 250], radius: 30, depth: 4 }] });
    const F = massifField(M, [0, 0], 3, 10);
    expect(F.rock(0, 0)).toBeLessThan(2);   // (the cut's floor through the block)
    expect(F.rock(0, 90)).toBeGreaterThan(40);   // (and the block beside it)
    expect(F.water(0, 0)).toBe(true);
    expect(F.at(0, 0, 12)).toBeLessThan(10 - 4);   // (the river's bed under the datum whatever the floor's roll)
    expect(F.at(250, 250, 11)).toBeLessThan(10 - 3);
    expect(F.water(-250, 250)).toBe(false);
  });

  it('strews its fallen blocks on the talus, off the water', () => {
    const M = one({ strew: { count: 12, size: [2, 3] } }), F = massifField(M, [0, 0], 5);
    expect(F.boulders.length).toBeGreaterThan(0);
    for (const b of F.boulders) { expect(F.water(b.x, b.y)).toBe(false); expect(F.rock(b.x, b.y)).toBeLessThan(90 * M.talus.share * 2); }
  });

  it('reads its laws off the land a card made: walls stand, the floor is open', () => {
    const F = massifField(readMassif(Object.keys(MASSIF_CARDS)[0]), [0, 0], 3), L = massifLaws((x, y) => F.at(x, y, 0), [-400, -400, 400, 400]);
    expect(L.map((l) => l.law)).toEqual(['walls-stand', 'talus-repose', 'floor-open']);
    expect(L.find((l) => l.law === 'walls-stand').ok).toBe(true);
    expect(L.find((l) => l.law === 'floor-open').ok).toBe(true);
  });

  it('stands only on an island, and a meru that names none reads as it always did', () => {
    expect(() => readLocalMeru({ massif: 'wadi' })).toThrow(/stands on an island/);
    expect(readLocalMeru({ island: { walk: 'none' }, massif: 'wadi' }).massif.id).toBe('wadi');
    expect(readLocalMeru({ island: { walk: 'none' } })).not.toHaveProperty('massif');
  });
});
