import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { SOUNDS, SOUND_IDS } from './roster.js';
import { familyCue } from './families.js';

// characterization pin: a family's output for given dials is a compatibility promise, as a kernel's is (a level that
// names `explosion` today hears the same blast tomorrow). Every roster row a family builds, hashed. A change is
// legitimate only when the step says the sound changes: re-pin with a line saying why.
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));

describe('the families\' builds, pinned', () => {
  it('every row a family builds is the cue it was', () => {
    const made = SOUND_IDS.filter((id) => SOUNDS[id].make).map((id) => [id, familyCue(SOUNDS[id].make.family, SOUNDS[id].make.dials)]);
    expect(made.length).toBeGreaterThan(0);
    expect(createHash('sha256').update(canon(made)).digest('hex').slice(0, 16)).toBe('1297e4501bc2688d');
  });
});
