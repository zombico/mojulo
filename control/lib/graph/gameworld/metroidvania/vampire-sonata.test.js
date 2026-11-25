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
  it('cuts her castle a segment a level on the megaworld\'s chain, and refuses a segment the castle has not', () => {
    const W0 = vampireSonataGame({ heroRef: 'erina', castle: 'segments' }), W = readGameworld(W0), stages = gameStages(W);
    expect(stages.map((s) => [s.section, s.manifest.segment])).toEqual([['metroidvania', 'tower'], ['metroidvania', 'court'], ['metroidvania', 'keep']]);
    expect(W0.megaworld).toEqual({ shape: 'chain', rings: [['tower'], ['court'], ['keep']] });
    expect(() => readGameworld({ ...W0, levels: { ...W0.levels, tower: { ...W0.levels.tower, segment: 'moat' } } })).toThrow(/one of the castle's boxes \(tower, court, keep\)/);
    expect(() => readGameworld({ ...W0, levels: { ...W0.levels, tower: { name: 'x', segment: 'tower' } } })).toThrow(/segment is a metroidvania castle's/);
  });
});
