import { describe, it, expect } from 'vitest';
import { measureSets } from '../../../scripts/sfx-baseline.mjs';
import { BASELINE } from './baseline.js';
import { nearBaseline } from './measure.js';

// the sweep: every cue of every set re-rendered and re-measured against the stored baseline (within the yardstick's
// tolerance, not byte for byte: the render is equal within tolerance across runtimes)
describe('the sfx shelf baseline (deep)', () => {
  it('every set cue measures at its baseline', async () => {
    const measured = await measureSets();
    const off = Object.entries(measured).flatMap(([s, cues]) => Object.entries(cues).flatMap(([c, m]) => nearBaseline(m, BASELINE[s]?.[c] ?? {}).map((o) => `${s}:${c}: ${o}`)));
    expect(off).toEqual([]);
  }, 60_000);
});
