// The herobots (gameworld/herobots.js): the side scroller's playable heroes. The concepts: each is the herobot body in
// the toy suit under the hero robot's helm, its face window open, the hero door taking it; Galaxy Boy wears the cannon,
// Zero Boy none but a saber in his right hand and a ponytail out of his helm, in his own colours; the same hero, the same
// spec.
import { describe, it, expect } from 'vitest';
import { HEROBOTS, herobotSpec } from './herobots.js';
import { heroRecord } from '@/lib/mcp/tools/layered.js';

describe('the herobots', () => {
  it('each the herobot body in the toy suit under the helm, its face open; the hero door takes it', () => {
    for (const id of ['galaxy-boy', 'zero-boy']) {
      const S = herobotSpec(id);
      expect(S).toMatchObject({ proportions: 'herobot', adorn: { type: 'armor', style: 'herobot' } });
      expect(S.adorn.with[0].signature.window).toBeDefined();
      expect(() => heroRecord(S)).not.toThrow();
      expect(herobotSpec(id)).toEqual(S);
    }
  });
  it('Galaxy Boy the cannon; Zero Boy a saber in his right hand, a ponytail, his own colours', () => {
    const G = herobotSpec('galaxy-boy'), Z = herobotSpec('zero-boy');
    expect(G.adorn.language.cannon).toBe('R');
    expect(G.gear).toBeUndefined();
    expect(Z.adorn.language).toBeUndefined();
    expect(Z.gear.right).toMatchObject({ item: 'sword', style: 'saber' });
    expect(Z.adorn.with[0].signature.ponytail).toMatchObject({ group: 'Hair' });
    expect(Z.palette.Armor).not.toBe(G.palette.Armor);
    expect(Z.palette.Hair).toBe(HEROBOTS['zero-boy'].palette.Hair);
  });
});
