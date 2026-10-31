// The circulation laws (circulation.js): one list of concerns, the house flow's livable numbers and the stage's stair
// profiles. The house reads the same table it always did; the game's stair keeps its walker's step and its camera's room.
import { describe, expect, it } from 'vitest';
import { CIRCULATION, DESIGN_RULES, STAIR_PROFILES, stairProfile } from './circulation.js';
import { DESIGN_RULES as HOUSE_RULES, designRules } from '../polygonizer/floorplan-design.js';

describe('the circulation laws', () => {
  it('the house flow reads the traditions from here, as it did', () => {
    expect(HOUSE_RULES).toBe(DESIGN_RULES);
    expect(designRules({ tradition: 'british' }).stair).toEqual(DESIGN_RULES.british.stair);
  });

  it('every stair profile keeps the stair laws it names, the game\'s inside its walker\'s step', () => {
    for (const k of ['riser', 'going', 'landing', 'stair-foot', 'stair-head', 'stair-door', 'guard']) expect(CIRCULATION[k], k).toBeTruthy();
    // (era/storeys.js: a walker steps 0.35)
    for (const [id, p] of Object.entries(STAIR_PROFILES)) expect(p.riser, id).toBeLessThanOrEqual(0.35);
    const g = stairProfile('game');
    expect(g.landing).toBeGreaterThanOrEqual(g.width);
    expect(() => stairProfile('ladder')).toThrow(/keep, game/);
  });
});
