/**
 * The form render's grass (scene/channels/form-grass.js): every sward has its clump, the short one spares polygons, and
 * the page's block parses.
 */
import { describe, expect, it } from 'vitest';

import { GRASS_TIERS, formGrassScript } from './form-grass.js';
import { SWARDS } from '../../era/biocube.js';

// a clump's triangles: each blade a strip of segments, two triangles a segment (the tip narrowed, not closed); a
// bristle, one segment, a single triangle
const tris = (c) => c.blades * (c.segs === 1 ? 1 : c.segs * 2);

describe('form grass', () => {
  it('each of the biocube\'s swards grows a clump, and the short one spends fewer triangles a square metre', () => {
    for (const w of SWARDS) expect(GRASS_TIERS.some((t) => t.sward === w)).toBe(true);
    const tall = GRASS_TIERS.find((t) => t.sward === 'tall'), short = GRASS_TIERS.find((t) => t.sward === 'short');
    expect(tris(short.clump)).toBeLessThan(tris(tall.clump));
    // (per metre within each one's own reach: the short tier's finer grid still cheaper than the near tall one's)
    const near = GRASS_TIERS.filter((t) => t.sward === 'tall').reduce((a, t) => (t.spacing < a.spacing ? t : a));
    expect(tris(short.clump) / short.spacing ** 2).toBeLessThan(tris(near.clump) / near.spacing ** 2);
  });

  it('the short sward is a bed: bristles scattered over the cell, so its cells run together', () => {
    expect(GRASS_TIERS.find((t) => t.sward === 'short').clump.bed).toBe(true);
  });

  it('the page\'s block parses, and names every tier', () => {
    const src = formGrassScript();
    expect(() => new Function('THREE', 'scene', 'D', 'LAYER_U', 'bytes', src)).not.toThrow();
    for (const t of GRASS_TIERS) expect(src).toContain(t.id);
  });
});
