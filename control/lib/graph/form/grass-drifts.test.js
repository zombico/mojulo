/**
 * The grass's drifts (form/grass-drifts.js): the biocube's words in order, the library's plants grown before light, a
 * kind that stands told from one that lies among the blades.
 */
import { describe, expect, it } from 'vitest';

import { readDrifts, driftForms, weedForms, WEED_SET, DRIFT_MAX, DRIFT_STANDS } from './grass-drifts.js';
import { WEEDS } from '../vegetation/wildflowers.js';
import { GRASSES } from '../vegetation/grass.js';

describe('grass drifts', () => {
  it('reads the grass kinds first, the flowers last, none at a share of nothing, at most DRIFT_MAX', () => {
    expect(readDrifts({ drifts: { wheat: 0.2, chaff: 0 }, flowers: { share: 0.1 } }).map((d) => d.id)).toEqual(['wheat', 'flowers']);
    expect(readDrifts({}).length).toBe(0);
    expect(readDrifts({ drifts: { wheat: 0.1, chaff: 0.1, sedge: 0.1 }, flowers: { share: 0.1 } }).length).toBeLessThanOrEqual(DRIFT_MAX);
  });

  it('grows the same plants twice; a tall kind stands in the blades\' place, a low one lies among them', () => {
    const ratio = [1, 1, 1], a = driftForms({ id: 'wheat', share: 0.2 }, ratio);
    expect(driftForms({ id: 'wheat', share: 0.2 }, ratio)).toEqual(a);
    expect(a.stands).toBe(GRASSES.wheat.heights[1] > DRIFT_STANDS);
    expect(a.stands).toBe(true);
    expect(driftForms({ id: 'chaff', share: 0.2 }, ratio).stands).toBe(false);
    // (each form grown full, three positions and three colours a vertex)
    for (const F of a.forms) { expect(F.p.length).toBeGreaterThan(0); expect(F.c.length).toBe(F.p.length); }
  });

  it('the weeds any grass carries: every weed kind in its variants, each its own plant, the weights one in all', () => {
    const W = weedForms([1, 1, 1]);
    expect(new Set(W.forms.map((f) => f.kind))).toEqual(new Set(WEEDS));
    expect(W.forms.length).toBe(WEEDS.length * WEED_SET.variants);
    expect(W.forms.reduce((a, f) => a + f.w, 0)).toBeCloseTo(1, 2);
    const one = W.forms.filter((f) => f.kind === WEEDS[0]);
    expect(JSON.stringify(one[0].p)).not.toBe(JSON.stringify(one[1].p));
    expect(JSON.stringify(weedForms([1, 1, 1]))).toBe(JSON.stringify(W));
  });

  it('carries the library\'s colours into the cube\'s light by its ratio, never lights them', () => {
    const one = driftForms({ id: 'chaff', share: 0.2 }, [1, 1, 1]), half = driftForms({ id: 'chaff', share: 0.2 }, [0.5, 0.5, 0.5]);
    one.forms[0].c.slice(0, 30).forEach((v, i) => expect(half.forms[0].c[i]).toBeCloseTo(v * 0.5, 3));
    const fl = driftForms({ id: 'flowers', share: 0.1, mix: { poppy: 1, daisy: 1 } }, [1, 1, 1]);
    expect(fl.forms.reduce((s, f) => s + f.w, 0)).toBeCloseTo(1, 3);
    expect(fl.stands).toBe(false);
  });
});
