import { describe, it, expect } from 'vitest';
import { rebase } from './rebase.js';

// A run's write laid onto the world as stored now (rebase.js): what another chapter wrote while the run ran is kept,
// what the run changed is written, and a run alone writes exactly what it always wrote.

const base = { id: 'w', name: 'Vale', levels: { a: { name: 'A' }, b: { name: 'B' } }, review: { world: { status: 'approved' } } };

describe('rebase: a run\'s changes onto the world as stored', () => {
  it('nothing written in between: the run\'s world, as it is', () => {
    const mine = { ...base, made: { hero: { ref: 'h' } } };
    expect(rebase(structuredClone(base), base, mine)).toBe(mine);
  });

  it('keeps a page written during the run and writes the run\'s record', () => {
    const stored = { ...base, levels: { ...base.levels, b: { name: 'The Crypt' } }, foes: { bestiary: ['bat'] } };
    const mine = { ...base, made: { 'level-a-1': { ref: 'x' } } };
    const out = rebase(stored, base, mine);
    expect(out.levels.b.name).toBe('The Crypt');
    expect(out.foes).toEqual({ bestiary: ['bat'] });
    expect(out.made).toEqual({ 'level-a-1': { ref: 'x' } });
  });

  it('follows an object key by key: the run\'s change to one part, another writer\'s to its sibling', () => {
    const stored = { ...base, review: { ...base.review, 'level:b': { status: 'revise', note: 'darker' } } };
    const mine = { ...base, review: { ...base.review, 'hero:base': { status: 'approved' } } };
    expect(rebase(stored, base, mine).review).toEqual({ world: { status: 'approved' }, 'level:b': { status: 'revise', note: 'darker' }, 'hero:base': { status: 'approved' } });
  });

  it('the run wins only where it changed the same value; a key it removed is removed', () => {
    const stored = { ...base, name: 'Vale Renamed', made: { old: 1 } };
    const withMade = { ...base, made: { old: 1 } };
    const mine = { ...base, name: 'Vale Run' };
    const out = rebase(stored, withMade, mine);
    expect(out.name).toBe('Vale Run');
    expect(out.made).toBeUndefined();
  });

  it('a key another writer removed stays removed where the run left it alone', () => {
    const { levels: _gone, ...stored } = base;
    expect(rebase(stored, base, { ...base, made: {} }).levels).toBeUndefined();
  });

  it('is deterministic', () => {
    const stored = { ...base, levels: { ...base.levels, c: { name: 'C' } } };
    const mine = { ...base, made: { m: 1 } };
    expect(JSON.stringify(rebase(stored, base, mine))).toBe(JSON.stringify(rebase(structuredClone(stored), structuredClone(base), structuredClone(mine))));
  });
});
