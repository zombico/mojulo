import { describe, expect, it } from 'vitest';
import { quickWorld, goalMechanics } from './quick.js';
import { gameStages, stageLevelOrder } from './levels.js';

// A race's level laid whole (its dressed track among it): it wears the race's HUD, reading its own laps mechanic.
describe('the race\'s HUD on a made level', () => {
  it('a quick kart race\'s level wears it, reading its own laps mechanic', () => {
    const W = quickWorld({ id: 'q', quick: { goal: 'race', ride: 'car', rivals: 3, laps: 3, roadway: { intent: 'a short kart track' } } });
    const st = gameStages(W).find((x) => x.section === 'roadway'), L = stageLevelOrder(W, st, { goal: (ends) => goalMechanics(W.quick, ends) });
    const m = L.args.manifest, mi = m.game.mechanics.findIndex((x) => x.kind === 'laps');
    expect(mi).toBeGreaterThanOrEqual(0);
    expect(m.manaHud.feed).toMatchObject({ kind: 'race', mech: mi, laps: 3, racers: 4, speedMax: 90 });
    expect(m.manaHud.feed.frame).toBeTruthy();
  }, 120000);
});
