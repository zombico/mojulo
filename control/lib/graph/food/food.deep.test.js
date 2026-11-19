// The deep sweep of the food: every work starter's food held to every law (the regular tier picks one card a procedure;
// a new starter is swept here, so a card whose things look alike or do not fit is caught the day it lands).
import { describe, it, expect } from 'vitest';
import { foodLaws } from './laws.js';
import { SCENARIOS } from '../worksim/scenarios.js';

describe('the food, every starter', () => {
  it('holds every law on every work starter', () => {
    for (const [id, c] of Object.entries(SCENARIOS)) expect(foodLaws(c).filter((l) => !l.holds), id).toEqual([]);
  });
});
