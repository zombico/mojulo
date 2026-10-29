// Every construction in every palette, under every plot and dressing: the composer may pair any of them, so each pairing
// composes a kit card (the sweep over the axes' cross product; bay-axes.test.js holds the law on one case).
import { describe, expect, it } from 'vitest';
import { CONSTRUCTIONS, PALETTES, PLOTS, DRESSINGS } from './bay-axes.js';
import { bayKitOf } from './bay-kits.js';

describe('the bay axes, every pairing', () => {
  it('composes a kit card', () => {
    for (const construction of Object.keys(CONSTRUCTIONS)) for (const palette of Object.keys(PALETTES)) for (const plot of Object.keys(PLOTS)) for (const dressing of Object.keys(DRESSINGS)) {
      expect(() => bayKitOf({ construction, palette, plot, dressing }), `${construction}/${palette}/${plot}/${dressing}`).not.toThrow();
    }
  });
});
