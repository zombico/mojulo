/**
 * The form render's grass (scene/channels/form-grass.js): every sward has its clump, the short one spares polygons, each
 * length its own areas, the far grass in patches walled by real blades, taking over by height, and the page's block parses.
 */
import { describe, expect, it } from 'vitest';

import { GRASS_TIERS, GRASS_RINGS, SWARD_LENGTH, HANDOVER, PATCHES, formGrassScript } from './form-grass.js';
import { SWARDS } from '../../era/biocube.js';

// a clump's triangles: each blade a strip of segments, two triangles a segment (the tip narrowed, not closed); a
// bristle, one segment, a single triangle, and its dark twin another
const tris = (c) => c.blades * (c.segs === 1 ? (c.dark ? 2 : 1) : c.segs * 2);

describe('form grass', () => {
  it('each of the biocube\'s swards grows a clump, and the short one\'s clump spends fewer triangles', () => {
    for (const w of SWARDS) expect(GRASS_TIERS.some((t) => t.sward === w)).toBe(true);
    const tall = GRASS_TIERS.find((t) => t.sward === 'tall'), short = GRASS_TIERS.find((t) => t.sward === 'short');
    expect(tris(short.clump)).toBeLessThan(tris(tall.clump));
  });

  it('each length its own areas: one tier a sward, their bands on the map apart, the medium between the tall and the short', () => {
    const ws = GRASS_TIERS.map((t) => t.sward);
    expect(new Set(ws).size).toBe(ws.length);
    const L = ['tall', 'medium', 'short'].map((w) => SWARD_LENGTH[w]);
    expect(L).toEqual([...L].sort((a, b) => a - b));
    for (let i = 1; i < L.length; i++) expect(L[i] - L[i - 1]).toBeGreaterThanOrEqual(2 * SWARD_LENGTH.band);
    const top = (w) => { const T = GRASS_TIERS.find((t) => t.sward === w); return T.scale * T.clump.height[1]; };
    expect(top('tall')).toBeGreaterThan(top('medium'));
    expect(top('medium')).toBeGreaterThan(top('short'));
    // (on the page each tier keeps to its band: no clump where the sward is another length)
    expect(formGrassScript()).toContain('float mine = 1.0 - step( 1.0, dL );');
  });

  it('the short sward is a bed: bristles scattered over the cell, so its cells run together, each with a dark twin', () => {
    const C = GRASS_TIERS.find((t) => t.sward === 'short').clump;
    expect(C.bed).toBe(true);
    expect(C.dark).toBe(true);
  });

  it('the far grass is patches: a low top under its tips, green alone far off; near, its tufts and a wall of real blades where no patch borders it, densest facing the eye', () => {
    expect(PATCHES.top).toBeLessThan(PATCHES.tip[0]);
    expect(PATCHES.tip[1]).toBeGreaterThan(1);
    expect(PATCHES.dense.rows).toBeGreaterThanOrEqual(2);
    expect(PATCHES.dense.gap).toBeLessThan(PATCHES.gap);
    expect(PATCHES.warp.reach).toBeLessThan(0.5);
    // (the patches risen under the near blades before those thin, each clump going at its own distance, none growing)
    expect(HANDOVER.rise[1]).toBeLessThanOrEqual(HANDOVER.thin[0]);
    expect(HANDOVER.thin[1]).toBe(1);
    // (out in rings, each a coarser grid of the clumps that live that far: the bounds rising inside the reach, every clump
    // gone short of the bound of its last ring)
    expect(GRASS_RINGS.rings.every((f, k, a) => f > HANDOVER.thin[0] && f < 1 && (k === 0 || f > a[k - 1]))).toBe(true);
    expect(formGrassScript()).toContain("'float kEnd = lvC < 0.5 ? uRings.x :");
    const src = formGrassScript();
    // (far, the tops and backings only; near, chosen again as the eye crosses a cell: the walls only on the sides no
    // patch borders, the dense ones facing the eye; a point's height the grass's where it stands, so neighbours meet)
    expect(src).toContain('form-grass-patch');
    expect(src).toContain('farTop.fill(tops); farBack.fill(backs);');
    expect(src).toContain('if (!at.has(key(i + di, j + dj))) (faces ? sdn : ss).push(');
    expect(src).toContain('farTop.mesh.onBeforeRender');
    expect(src).toContain('float outG = fgStage( dG,');
    expect(src).toContain("texture( tGrass, ( wpJ - uGO ) / uGM ).a");
    // (no grass drawn as flat slices, no far tufts, nothing dithered)
    expect(src).not.toContain('aShell');
    expect(src).not.toContain('uWide');
    expect(src).not.toContain('> vFade ) discard');
    expect(GRASS_TIERS.some((t) => t.sward === 'any')).toBe(false);
  });

  it('bends in the page\'s one gust field when it has one, and stands still when it has none', () => {
    const src = formGrassScript();
    expect(src).toContain('mojWindAt');
    expect(src).toContain('__mojTerrain');
    expect(src).not.toContain('brush');
    expect(src).toContain('fgBend');
  });

  it('the page\'s block parses, and names every tier', () => {
    const src = formGrassScript();
    expect(() => new Function('THREE', 'scene', 'D', 'LAYER_U', 'bytes', src)).not.toThrow();
    for (const t of GRASS_TIERS) expect(src).toContain(t.id);
  });
});
