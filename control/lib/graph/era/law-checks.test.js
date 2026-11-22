// The law checks over a building's worth of faces (law-checks.js): a stage of many rooms carries more faces than a call's
// arguments hold, so the vault's crown and the darkest corner are folded over them, never spread.
import { describe, it, expect } from 'vitest';
import { checkStageLaws } from './law-checks.js';

describe('the law checks over a large stage', () => {
  it('reads the crown and the darkest corner of more faces than a spread can take', () => {
    const n = 200_000, faces = [];
    for (let i = 0; i < n; i++) faces.push({ group: i % 2 ? 'stage:ceiling' : 'stage:wall', corners: [[i % 50, 0, i === n - 1 ? 21 : 6]], cornerFills: [i === 7 ? '#020202' : '#808080'] });
    const L = checkStageLaws({ faces, lights: [] }).laws;
    expect(L.find((l) => l.law === 'dare-height').why).toMatch(/21\.0 m/);
    expect(L.find((l) => l.law === 'shade-is-colour').why).toMatch(/0\.008/);
  });
});
