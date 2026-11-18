import { describe, it, expect } from 'vitest';
import { VILLAINS } from './brawl-villains.js';
import { quickWorld } from '../gameworld/quick.js';
import { runSteps } from '../gameworld/runner.js';
import { brawlYardData } from './brawl-page.js';
import { playStreet } from './brawl-playthrough.js';
import { solveFighter } from '../versus/versus-solver.js';

// EACH IDIOM PLAYED THROUGH: a villain of each idiom at the end of the heroes campaign's last street, held by the scripted
// hero alone (the heroes as fighters with their powers: a character's body is only how it is drawn). It must be won, the
// villain down, and its idiom seen (its summons called and cut, its form become, its pair enraged).
const SEEN = { summoner: ['summon', 'cut'], modes: ['becomes'], pair: ['enrage'] };
const yardOf = (B) => {
  const roster = B.street.roster.filter((r) => r.power).map((r) => ({ id: r.id, name: r.name, recipe: { ...solveFighter({ id: r.id, archetype: r.style ?? 'all-rounder' }).recipe, archetype: r.style ?? 'all-rounder' }, power: r.power }));
  const { cast: _c, ...street } = B.street;
  return brawlYardData({ ...B, street: { ...street, roster } });
};
describe('each supervillain idiom, played through', () => {
  const idioms = [...new Set(Object.values(VILLAINS).filter((v) => !v.lieutenant).map((v) => v.idiom))];
  for (const idiom of idioms) {
    const kind = Object.keys(VILLAINS).find((k) => !VILLAINS[k].lieutenant && VILLAINS[k].idiom === idiom);
    it(`${idiom} (${kind}): one hero wins the lair, the villain down, its idiom seen`, () => {
      const steps = runSteps(quickWorld({ id: 'w', name: 'H', quick: { goal: 'brawl', heroes: { villain: { member: 'mastermind', kind } } } }), { ref: 'gw' });
      const R = playStreet(yardOf(steps.find((s) => s.key === 'level-street-lair').order.manifest.brawl), { player: 'hero', seconds: 300 });
      expect(R).toMatchObject({ won: true, boss: { down: true } });
      for (const e of SEEN[idiom] ?? []) expect(R.idioms?.[e], e).toBeGreaterThan(0);
    }, 240_000);
  }
});

// THE CAMPAIGN CLIMBS: each street played by each of the team's heroes alone (its own style and power), the falls and
// the blows taken averaged over them; a single run is chaotic (a step's difference turns 2 blows into 14), the average
// is the street's
describe('the heroes campaign, played through', () => {
  it('every street is won by each hero alone, and on average no street is easier than the one before it', () => {
    const steps = runSteps(quickWorld({ id: 'w', name: 'H', quick: { goal: 'brawl', heroes: true } }), { ref: 'gw' });
    const means = ['level-street-street', 'level-street-works', 'level-street-lair'].map((key) => {
      const B = steps.find((s) => s.key === key).order.manifest.brawl, team = B.street.roster.filter((r) => r.power);
      const runs = team.map((r) => {
        const roster = [{ id: r.id, name: r.name, recipe: { ...solveFighter({ id: r.id, archetype: r.style ?? 'all-rounder' }).recipe, archetype: r.style ?? 'all-rounder' }, power: r.power }];
        const { cast: _c, ...street } = B.street;
        return playStreet(brawlYardData({ ...B, street: { ...street, roster } }), { player: 'hero', seconds: 300 });
      });
      for (const R of runs) expect(R.won, key).toBe(true);
      return { falls: runs.reduce((a, R) => a + R.falls, 0) / runs.length, taken: runs.reduce((a, R) => a + R.struck, 0) / runs.length };
    });
    for (let i = 1; i < means.length; i++) {
      expect(means[i].falls).toBeGreaterThanOrEqual(means[i - 1].falls);
      expect(means[i].taken).toBeGreaterThanOrEqual(means[i - 1].taken);
    }
  }, 900_000);
});
