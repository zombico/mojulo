// hero-relational-head.deep.test.js — the hero's relational head is laid out on a tune SOLVED once and kept
// (hero-relational-head.js HEAD_TUNES): each pole's kept tune is the solver's. A solve takes most of a minute, so this
// sweep is deep: it says something only when head-relational.js's solver or its relations move (then re-pin, in the
// same commit, knowing every minted relational head moves with it).
import { describe, it, expect } from 'vitest';

import { solveTune } from './head-relational.js';
import { HEAD_TUNES } from './hero-relational-head.js';

describe('the relational hero head\'s kept tunes', () => {
  for (const sex of Object.keys(HEAD_TUNES)) it(`${sex}: the solver's`, { timeout: 300000 }, () => {
    expect(solveTune({ sex }).tune).toEqual(HEAD_TUNES[sex]);
  });
});
