// A wall's rhythm (wall-rhythm.js): along a wall never a run of three alike, never a pair followed by the same pair;
// a local rule, the same on a short wall as a long one.
import { describe, it, expect } from 'vitest';
import { rhythmFaults, wallRhythms, wallRhythm, wallOrder } from './wall-rhythm.js';

const faults = (s) => rhythmFaults(s).map((f) => f.fault);

describe('a wall\'s rhythm', () => {
  it('a run of three fails, a beat fails; a pair, and a pair mirrored, keep the rule, on a wall of any length', () => {
    expect(faults('AAAA')).toEqual(['run', 'run']);
    expect(faults('ABAB')).toEqual(['beat']);
    expect(faults('BABA')).toEqual(['beat']);
    expect(faults('ABABA')).toContain('beat');
    for (const ok of ['ABBA', 'BAAB', 'ABA', 'BAB', 'BBA', 'AAB', 'BAA', 'ABB', 'BBABB', 'AABAA']) expect(faults(ok), ok).toEqual([]);
    // (the rule is local: a pair alike keeps it on a wall of two as inside a wall of ten; kinds may be anything)
    expect(rhythmFaults('A')).toEqual([]);
    expect(rhythmFaults('AA')).toEqual([]);
    expect(rhythmFaults('BAABBAABBA')).toEqual([]);
    expect(rhythmFaults(['niche', 'blind', 'blind', 'niche'])).toEqual([]);
  });

  it('every length from three has an order that keeps it in two kinds, a mirrored one first, and none of one kind', () => {
    for (let n = 3; n <= 14; n++) {
      const all = wallRhythms(n, 2);
      expect(all.length, `n ${n}`).toBeGreaterThan(0);
      expect(all.every((s) => rhythmFaults(s).length === 0)).toBe(true);
      expect(all[0]).toBe([...all[0]].reverse().join(''));
      // (two kinds follow from the rule: no order of three or more is one kind)
      expect(all.every((o) => new Set(o).size >= 2)).toBe(true);
    }
    // (four segments in two kinds, mirrored: the two the rule was stated with)
    expect(wallRhythms(4, 2).slice(0, 2)).toEqual(['ABBA', 'BAAB']);
    expect(wallRhythms(5, 2).slice(0, 2)).toEqual(['AABAA', 'BBABB']);
    expect(wallRhythms(4, 3).length).toBeGreaterThan(wallRhythms(4, 2).length);
  });

  it('one is picked by a dice\'s number, a mirrored one where the length has one; a wall of one or two is all A', () => {
    // (a wall of one or two is solved as it stands: all A)
    expect([wallRhythm(1), wallRhythm(2)]).toEqual(['A', 'AA']);
    expect(wallRhythm(4, { pick: 0 })).toBe('ABBA');
    expect(wallRhythm(4, { pick: 0.9 })).toBe('BAAB');
    expect(rhythmFaults(wallRhythm(9, { kinds: 3, pick: 0.42 }))).toEqual([]);
    expect(wallRhythm(7, { pick: 0.3 })).toBe(wallRhythm(7, { pick: 0.3 }));
  });

  it('the rhythm is reached for unasked; a wall all alike is a stated intent, and then its bay is clean and repeatable', () => {
    // (unasked: the rule, never all alike on a wall of three or more)
    const d = wallOrder(4);
    expect(d).toEqual({ order: 'ABBA', by: 'rule', clean: false });
    expect(rhythmFaults(wallOrder(10, { pick: 0.5 }).order)).toEqual([]);
    // (stated: the rule steps aside, and the wall is marked to be drawn clean)
    expect(wallOrder(4, { order: 'same' })).toEqual({ order: 'AAAA', by: 'intent', clean: true });
    expect(wallOrder(4, { order: 'aaaa' })).toEqual({ order: 'AAAA', by: 'intent', clean: true });
    // (any written order is an intent, a beat too; only a wall all alike is the clean one)
    expect(wallOrder(4, { order: 'ABAB' })).toEqual({ order: 'ABAB', by: 'intent', clean: false });
    expect(() => wallOrder(4, { order: 'ABA' })).toThrow(/names 3 segments and the wall has 4/);
    expect(() => wallOrder(4, { order: 'ABCA' })).toThrow(/'C' is not one of the wall's 2 kinds/);
  });
});
