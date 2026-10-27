/**
 * The form render's grass (scene/channels/form-grass.js): every sward has its clump, the short one spares polygons, and
 * the page's block parses.
 */
import { describe, expect, it } from 'vitest';

import { GRASS_TIERS, CARPET, BLADE_KEEP, BLADE_RISE, STRAND_RISE, formGrassScript } from './form-grass.js';
import { SWARDS } from '../../era/biocube.js';

// a clump's triangles: each blade a strip of segments, two triangles a segment (the tip narrowed, not closed); a
// bristle, one segment, a single triangle, and its dark twin another
const tris = (c) => c.blades * (c.segs === 1 ? (c.dark ? 2 : 1) : c.segs * 2);

describe('form grass', () => {
  it('each of the biocube\'s swards grows a clump, and the short one spends fewer triangles a square metre', () => {
    for (const w of SWARDS) expect(GRASS_TIERS.some((t) => t.sward === w)).toBe(true);
    const tall = GRASS_TIERS.find((t) => t.sward === 'tall'), short = GRASS_TIERS.find((t) => t.sward === 'short');
    expect(tris(short.clump)).toBeLessThan(tris(tall.clump));
    // (per metre within each one's own reach: the short tier's finer grid still cheaper than the near tall one's)
    const near = GRASS_TIERS.filter((t) => t.sward === 'tall').reduce((a, t) => (t.spacing < a.spacing ? t : a));
    expect(tris(short.clump) / short.spacing ** 2).toBeLessThan(tris(near.clump) / near.spacing ** 2);
  });

  it('the short sward is a bed: bristles scattered over the cell, so its cells run together, each with a dark twin', () => {
    const C = GRASS_TIERS.find((t) => t.sward === 'short').clump;
    expect(C.bed).toBe(true);
    expect(C.dark).toBe(true);
  });

  it('nothing sprouts from nothing: the carpet stands to the blades\' height and out past their reach, and a blade past its reach goes into it at most of its height', () => {
    const tall = GRASS_TIERS.find((t) => t.id === 'tall'), short = GRASS_TIERS.find((t) => t.id === 'short');
    expect(CARPET.radius).toBeGreaterThan(tall.reach);
    expect(CARPET.flat[0]).toBeGreaterThan(tall.reach);
    // (the carpet's strands' mean top where the sward's blades' mean top is: a blade hands over at its own height)
    const mean = (r) => r[0] + r[1] / 2, bladeTop = (T, rise) => T.scale * (T.clump.height[0] + T.clump.height[1]) / 2 * mean(rise);
    expect(CARPET.tall.height * mean(STRAND_RISE)).toBeCloseTo(bladeTop(tall, BLADE_RISE.tall), 2);
    expect(CARPET.short.height * mean(STRAND_RISE)).toBeCloseTo(bladeTop(short, BLADE_RISE.short), 2);
    expect(BLADE_KEEP).toBeGreaterThanOrEqual(0.7);
    // (its strands blades seen wide: coarser than the blades they stand for, wide along their facing, thin across; the
    // short sward's finer, with its dark twin)
    for (const S of [CARPET.tall, CARPET.short]) expect(S.width).toBeGreaterThan(S.thick * 2);
    expect(CARPET.tall.cell).toBeGreaterThan(tall.spacing / 3);
    expect(CARPET.short.cell).toBeLessThan(CARPET.tall.cell);
    expect(CARPET.short.twin).toBe(true);
    expect(GRASS_TIERS.some((t) => t.sward === 'any')).toBe(false);
  });

  it('bends in the page\'s one gust field when it has one, and stands still when it has none', () => {
    const src = formGrassScript();
    expect(src).toContain('mojWindAt');
    expect(src).toContain('__mojTerrain');
    expect(src).not.toContain('brush');
    expect(src).toContain('form-grass-carpet');
  });

  it('the page\'s block parses, and names every tier', () => {
    const src = formGrassScript();
    expect(() => new Function('THREE', 'scene', 'D', 'LAYER_U', 'bytes', src)).not.toThrow();
    for (const t of GRASS_TIERS) expect(src).toContain(t.id);
  });
});
