import { describe, expect, it } from 'vitest';

import { IDIOM_ABOUT, IDIOM_KINDS, IDIOM_LOWERING, PLAY_TIERS, compose, lowerIdioms } from '../../worlds/game-idioms.js';
import * as idioms from '../../worlds/game-idioms.js';
import { getIdiomVocabCatalog, IDIOM_CARD_BODY_CEILING } from './loader.js';

describe('the idiom shelf', () => {
  it('lowers every exported idiom function, and gives each an about row', () => {
    const fns = Object.keys(idioms).filter((k) => /^[a-z]/.test(k) && typeof idioms[k] === 'function' && !['compose', 'lowerIdioms'].includes(k));
    expect(new Set(IDIOM_KINDS)).toEqual(new Set(fns));
    expect(new Set(Object.keys(IDIOM_ABOUT))).toEqual(new Set(IDIOM_KINDS));
  });

  it('tags each idiom with a tier on the ladder', () => {
    for (const k of IDIOM_KINDS) expect(PLAY_TIERS, k).toContain(IDIOM_ABOUT[k].tier);
  });

  it('lowers each card example to a fragment compose() accepts', () => {
    for (const k of IDIOM_KINDS) {
      const frag = IDIOM_LOWERING[k](IDIOM_ABOUT[k].example);
      expect(Object.keys(frag).length, k).toBeGreaterThan(0);
      expect(() => compose(frag), k).not.toThrow();
    }
  });

  it('names the shelf when a recipe asks for an idiom it does not hold', () => {
    expect(() => lowerIdioms([{ kind: 'doorHinge' }])).toThrow(/unknown kind 'doorHinge'.*banner/);
  });

  it('carries the guide and one card per idiom, each under its ceiling', () => {
    const cat = getIdiomVocabCatalog();
    expect(cat.size).toBe(IDIOM_KINDS.length + 1);
    for (const k of IDIOM_KINDS) expect(cat.get(`idiom-${k}`), k).toBeTruthy();
    for (const card of cat.values()) {
      for (const f of ['id', 'name', 'summary', 'when', 'body']) expect(typeof card[f], `${card.id}.${f}`).toBe('string');
      expect(card.body.length, card.id).toBeLessThanOrEqual(IDIOM_CARD_BODY_CEILING);
    }
  });

  it('prints what the example lowers to, so the card cannot drift from the function', () => {
    const card = getIdiomVocabCatalog().get('idiom-deed');
    expect(card.body).toContain('inputs: [{"on":"pick","emit":{"type":"flip"}}]');
  });
});
