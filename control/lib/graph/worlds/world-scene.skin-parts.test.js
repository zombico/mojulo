// ONE SKIN A HERO (realistic laws 17): a realistic hero minted under them is drawn on the page as one skin
// (heroFigure's `skinParts`, its parts' bones and weights carried); one minted before, as rigid parts, as it was.
// (Beside the module, not in the critical tier: two realistic mints.)
import { describe, it, expect } from 'vitest';
import { heroFigure } from './world-scene.js';

describe('a realistic hero drawn as one skin', () => {
  it('from realistic laws 17, and not before', { timeout: 1_200_000 }, async () => {
    const at = (laws) => heroFigure('hero', { hero: { cast: 'male', form: 'realistic', physique: { from: 'athletic', laws } } });
    const [now, before] = [await at(17), await at(16)];
    expect(now.skinParts).toBe(true);
    expect(now.parts.filter(Boolean).every((p) => p.jnt && p.wgt)).toBe(true);
    expect(before.skinParts).toBeUndefined();
  });
});
