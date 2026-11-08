import { describe, it, expect } from 'vitest';
import { measureSets } from '../../../scripts/sfx-baseline.mjs';
import { BASELINE } from './baseline.js';
import { nearBaseline, meetsFloor } from './measure.js';
import { SETS } from './sets.js';

// the sweep: every cue of every set re-rendered and re-measured against the stored baseline (within the yardstick's
// tolerance, not byte for byte: the render is equal within tolerance across runtimes)
describe('the sfx shelf baseline (deep)', () => {
  it('every set cue measures at its baseline', async () => {
    const measured = await measureSets();
    const off = Object.entries(measured).flatMap(([s, cues]) => Object.entries(cues).flatMap(([c, m]) => nearBaseline(m, BASELINE[s]?.[c] ?? {}).map((o) => `${s}:${c}: ${o}`)));
    expect(off).toEqual([]);
    // and every set that stands on a floor meets it, cue for cue
    const below = Object.entries(measured).filter(([s]) => SETS[s].floor).flatMap(([s, cues]) => Object.entries(cues).flatMap(([c, m]) => meetsFloor(m, BASELINE[SETS[s].floor][c]).map((o) => `${s}:${c}: ${o}`)));
    expect(below).toEqual([]);
  }, 120_000);
});
