// A wall's rhythm (wall-rhythm.js): at least two kinds of segment along a wall, never a run of three, never a pair
// followed by the same pair.
import { describe, it, expect } from 'vitest';
import { rhythmFaults, wallRhythms, wallRhythm } from './wall-rhythm.js';

const faults = (s) => rhythmFaults(s).map((f) => f.fault);

describe('a wall\'s rhythm', () => {
  it('a run of three fails, a beat fails, one kind fails; a pair, and a pair mirrored, keep the rule', () => {
    expect(faults('AAAA')).toEqual(['one-kind', 'run', 'run']);
    expect(faults('ABAB')).toEqual(['beat']);
    expect(faults('BABA')).toEqual(['beat']);
    expect(faults('ABABA')).toContain('beat');
    for (const ok of ['ABBA', 'BAAB', 'ABA', 'BAB', 'BBA', 'AAB', 'BAA', 'ABB', 'BBABB', 'AABAA']) expect(faults(ok), ok).toEqual([]);
    // (a wall of one segment has no rhythm to keep; kinds may be anything, not letters)
    expect(rhythmFaults('A')).toEqual([]);
    expect(rhythmFaults(['niche', 'blind', 'blind', 'niche'])).toEqual([]);
  });

  it('every length from two has an order that keeps it, in two kinds; from three, a mirrored one', () => {
    for (let n = 2; n <= 14; n++) {
      const all = wallRhythms(n, 2);
      expect(all.length, `n ${n}`).toBeGreaterThan(0);
      expect(all.every((s) => rhythmFaults(s).length === 0)).toBe(true);
      if (n >= 3) expect(all[0]).toBe([...all[0]].reverse().join(''));
    }
    // (four segments in two kinds, mirrored: the two the rule was stated with)
    expect(wallRhythms(4, 2).slice(0, 2)).toEqual(['ABBA', 'BAAB']);
    expect(wallRhythms(5, 2).slice(0, 2)).toEqual(['AABAA', 'BBABB']);
    expect(wallRhythms(4, 3).length).toBeGreaterThan(wallRhythms(4, 2).length);
  });

  it('one is picked by a dice\'s number, a mirrored one where the length has one; a wall of one segment has none', () => {
    expect(wallRhythm(1)).toBeNull();
    expect(wallRhythm(4, { pick: 0 })).toBe('ABBA');
    expect(wallRhythm(4, { pick: 0.9 })).toBe('BAAB');
    expect(rhythmFaults(wallRhythm(9, { kinds: 3, pick: 0.42 }))).toEqual([]);
    expect(wallRhythm(7, { pick: 0.3 })).toBe(wallRhythm(7, { pick: 0.3 }));
  });
});
