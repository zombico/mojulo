/**
 * The card smoothed (scene/channels/card-smooth.js): an impression's atlas, baked point-sampled, gets coverage at its
 * edges, its empty texels its own colour, and is drawn mipmapped and filtered with its alpha sharpened to a pixel's edge
 * and taken as coverage, so a far tree or tile reads as the 3D world far off rather than as a pixel asset.
 */
import { describe, expect, it } from 'vitest';

import { CARD_SMOOTH, cardCover, cardSmoothSource, cardAlphaGlsl } from './card-smooth.js';
import { formFloraScript } from './form-flora.js';
import { farStructuresScript } from './far-structures.js';

// (two cells side by side, 4 × 4 texels each: a 2 × 2 mark in the left cell's corner by the shared edge)
const atlas = () => {
  const a = new Uint8Array(8 * 4 * 4);
  for (const [x, y] of [[2, 1], [3, 1], [2, 2], [3, 2]]) a.set([200, 100, 50, 255], (y * 8 + x) * 4);
  return a;
};
const at = (a, x, y) => [...a.slice((y * 8 + x) * 4, (y * 8 + x) * 4 + 4)];

describe('the card smoothed', () => {
  it('keeps the mark whole and gives the texels round it a share, in its own colour', () => {
    const a = cardCover(atlas(), 4, 4, 2, 1, CARD_SMOOTH.fringe);
    expect(at(a, 2, 1)).toEqual([200, 100, 50, 255]);
    const edge = at(a, 1, 1);
    expect(edge.slice(0, 3)).toEqual([200, 100, 50]);
    expect(edge[3]).toBeGreaterThan(0);
    expect(edge[3]).toBeLessThan(255);
  });

  it('never bleeds into the next cell, and fills every empty texel with its cell\'s colour at no coverage', () => {
    const a = cardCover(atlas(), 4, 4, 2, 1, CARD_SMOOTH.fringe);
    // (the right cell, beside the mark across the shared edge: nothing of it)
    expect(at(a, 4, 1)[3]).toBe(0);
    expect(at(a, 4, 1).slice(0, 3)).toEqual([0, 0, 0]);
    // (the left cell's far corner, past the fringe: no coverage, the mark's colour for its mipmaps)
    expect(at(a, 0, 3)).toEqual([200, 100, 50, 0]);
  });

  it('sharpens the filtered alpha to an edge a pixel wide, lifted with the mip level', () => {
    const g = cardAlphaGlsl('tX', 'vUv', 'uSize', 'cov');
    expect(g).toContain('fwidth( covA )');
    expect(g).toContain(`( 1.0 + covL * ${CARD_SMOOTH.mip} )`);
    expect(cardSmoothSource()).toContain('THREE.LinearMipmapLinearFilter');
    expect(() => new Function('THREE', cardSmoothSource())).not.toThrow();
  });

  it('draws both far impressions smoothed: the trees\' cards and the far structures\' tiles', () => {
    const flora = formFloraScript({ templates: [], n: 0, trees: '', lod: { detail: [6, 16], mid: 25, sprayed: 6 }, leafRef: [0.1, 0.2, 0.1], barks: {} });
    for (const src of [flora, farStructuresScript()]) {
      expect(src).toContain('__cardTex(atlas, IW, IH, IB');
      expect(src).toContain('alphaToCoverage: true');
      expect(src).not.toContain('THREE.NearestFilter');
    }
    // (the trees' wood marked in the tone, so the alpha is the coverage alone)
    expect(flora).toContain('atlas[o + 2] = kind === 128 ? 255 : Math.round(Math.min(0.5, tone) * 255); atlas[o + 3] = 255;');
  });
});
