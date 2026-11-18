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
