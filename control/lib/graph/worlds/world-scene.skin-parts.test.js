// ONE SKIN A HERO (realistic laws 17): a realistic hero minted under them is drawn on the page as one skin
// (heroFigure's `skinParts`, its parts' bones and weights carried); one minted before, as rigid parts, as it was.
// (Beside the module, not in the critical tier: two realistic mints.)
import { describe, it, expect } from 'vitest';
import { heroFigure } from './world-scene.js';

describe('a realistic hero drawn as one skin', () => {
  it('from realistic laws 17, and not before', { timeout: 1_200_000 }, async () => {
    const at = (laws, more = {}) => heroFigure('hero', { hero: { cast: 'male', form: 'realistic', physique: { from: 'athletic', laws } } }, more);
    const [now, before] = [await at(17, { marks: { Skin: 2 } }), await at(16)];
    // (asked for marks, the halo's: its skin's corners marked; a figure not asked carries none)
    expect(now.parts.some((p) => p && p.hc)).toBe(true);
    expect(before.parts.some((p) => p && p.hc)).toBe(false);
    expect(now.skinParts).toBe(true);
    expect(now.parts.filter(Boolean).every((p) => p.jnt && p.wgt)).toBe(true);
    expect(before.skinParts).toBeUndefined();
  });
});
