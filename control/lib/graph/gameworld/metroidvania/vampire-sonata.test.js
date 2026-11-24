import { describe, it, expect } from 'vitest';
import { validateHeroSpec, heroRecord, heroStature } from '@/lib/mcp/tools/layered.js';
import { feelRule } from '../feel/lower.js';
import { readGameworld } from '../world.js';
import { gameStages } from '../levels.js';
import { erinaHero, vampireSonataGame, VAMPIRE_SONATA_FEEL } from './vampire-sonata.js';

describe('Vampire Sonata: Erina and her castle', () => {
  it('Erina is a hero the character door takes: a grown woman on the anime head, her longsword in her right hand', () => {
    const { as, spec } = erinaHero();
    expect(as).toBe('hero');
    expect(validateHeroSpec(spec)).toEqual([]);
    expect(spec.head).toBe('anime');
    expect(spec.gear.right.item).toBe('sword');
    // (an adult's height, not the toy hero's kid cast)
    expect(heroStature(heroRecord(spec))).toBeGreaterThan(1.5);
  });

  it('she fights with Zero Boy\'s saber string, and never kicks off a wall, stomps or fires a buster', () => {
    const R = feelRule(VAMPIRE_SONATA_FEEL);
    expect(R.strike).toBe('melee');
    expect(Object.keys(R.moveset?.moves ?? R.moveset ?? {}).length).toBeGreaterThan(0);
    expect(R.cling).toBeUndefined();
    expect(R.buster).toBeUndefined();
    expect(R.airJumps ?? 0).toBe(0);
    // (her sword is steel: no strand of light over it)
    expect(R.strikeFx.strand).toBe(false);
  });

  it('the game reads as a world whose castle is one metroidvania stage, seen from the side', () => {
    const W = readGameworld(vampireSonataGame({ heroRef: 'erina' })), stages = gameStages(W);
    expect(W.camera).toBe('side');
    expect(stages.map((s) => s.section)).toEqual(['metroidvania']);
    expect(stages[0].manifest.show).toBe('metroidvania');
  });
});
