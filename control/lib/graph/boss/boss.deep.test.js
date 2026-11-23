import { describe, it, expect } from 'vitest';
import { PATTERN_IDS } from './patterns.js';
import { patternLaws } from './laws.js';
import { BOSS_IDS, bossLaws } from './bosses.js';
import { VEHICLE_IDS, vehicleLaws } from './vehicles.js';

// THE SHELF SWEPT (lib/graph/boss/): every pattern, boss and vehicle boss holds its laws. The law tests are
// boss.test.js; this is the exhaustive sweep over the rows.

describe('the boss shelf, every row', () => {
  it('every pattern is told, escapable, survivable and opened after', () => {
    for (const id of PATTERN_IDS) expect(patternLaws(id).filter((l) => !l.holds).map((l) => l.law), id).toEqual([]);
  });
  it('every human boss holds its laws', () => {
    for (const id of BOSS_IDS) expect(bossLaws(id).filter((l) => !l.holds).map((l) => l.law), id).toEqual([]);
  });
  it('every vehicle boss holds its laws', () => {
    for (const id of VEHICLE_IDS) expect(vehicleLaws(id).filter((l) => !l.holds).map((l) => l.law), id).toEqual([]);
  });
});
