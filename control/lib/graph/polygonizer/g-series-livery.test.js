import { describe, it, expect } from 'vitest';

import {
  GSERIES_LIVERY_SHELF,
  GSERIES_ROLES,
  GSERIES_LIVERIES,
  classifyGSeriesHex,
  classifyGSeriesTints,
  applyGSeriesLivery,
} from './g-series-livery.js';

// A miniature unit exercising every role plus a near-tint stray and a foreign hex.
function miniUnit() {
  return {
    kind: 'assembler',
    items: [
      {
        id: 'torso',
        source: {
          lathes: [
            { tint: '#e7dfcf' },   // armor dominant
            { tint: '#d8d0c1' },   // armor break stray (off-anchor by 1)
            { tint: '#214f95' },   // identity main
            { tint: '#173b70' },   // identity deep
          ],
          extrudes: [
            { tint: '#b13b28' },   // signal main
            { tint: '#7f241e' },   // signal deepest (unpaired in every livery)
            { tint: '#d59a19' },   // emblem gold
          ],
        },
      },
      {
        id: 'head',
        source: {
          sweeps: [
            { tint: '#111315' },   // frame
            { tint: '#35e7ef' },   // eyes
            { tint: '#00ff00' },   // foreign: not a g-series color
          ],
        },
      },
    ],
  };
}

describe('classifyGSeriesHex', () => {
  it('classifies every card anchor into its own role', () => {
    for (const [role, def] of Object.entries(GSERIES_ROLES)) {
      for (const anchor of def.anchors) {
        expect(classifyGSeriesHex(anchor)).toEqual({ role, anchor });
      }
    }
  });

  it('absorbs near-tint strays and rejects foreign hexes', () => {
    expect(classifyGSeriesHex('#d8d0c1')).toEqual({ role: 'armor', anchor: '#d8d0c0' });
    expect(classifyGSeriesHex('#0f1113')).toEqual({ role: 'frame', anchor: '#111315' });
    expect(classifyGSeriesHex('#00ff00')).toBeNull();
    expect(classifyGSeriesHex('#ffffff')).toBeNull();
  });
});

describe('classifyGSeriesTints', () => {
  it('counts monomers per role and surfaces unknowns', () => {
    const census = classifyGSeriesTints(miniUnit());
    expect(census.total).toBe(10);
    expect(census.roles.armor.monomers).toBe(2);
    expect(census.roles.identity.monomers).toBe(2);
    expect(census.roles.signal.monomers).toBe(2);
    expect(census.roles.emblem.monomers).toBe(1);
    expect(census.roles.frame.monomers).toBe(1);
    expect(census.roles.eyes.monomers).toBe(1);
    expect(census.unknown).toEqual({ '#00ff00': 1 });
  });
});

describe('applyGSeriesLivery', () => {
  it('maps card-pinned anchors to their exact card targets', () => {
    for (const livery of GSERIES_LIVERY_SHELF) {
      const { manifest } = applyGSeriesLivery(miniUnit(), { livery });
      const tints = manifest.items.flatMap((it) =>
        ['lathes', 'extrudes', 'sweeps'].flatMap((k) => (it.source[k] || []).map((m) => m.tint)));
      for (const [src, tgt] of Object.entries(GSERIES_LIVERIES[livery].armor)) {
        if (src === '#e7dfcf') expect(tints).toContain(tgt);
      }
      expect(tints).toContain(GSERIES_LIVERIES[livery].identity['#214f95']);
      expect(tints).toContain(GSERIES_LIVERIES[livery].signal['#b13b28']);
    }
  });

  it('never touches frame, emblem, eyes, or unknown hexes', () => {
    for (const livery of GSERIES_LIVERY_SHELF) {
      const { manifest } = applyGSeriesLivery(miniUnit(), { livery });
      const head = manifest.items[1].source.sweeps.map((m) => m.tint);
      expect(head).toEqual(['#111315', '#35e7ef', '#00ff00']);
      expect(manifest.items[0].source.extrudes[2].tint).toBe('#d59a19');
    }
  });

  it('remaps unpaired family hexes by residual delta off the nearest paired anchor', () => {
    const { manifest, remapped } = applyGSeriesLivery(miniUnit(), { livery: 'akai-comet' });
    // #d8d0c1 is 1 blue above the paired break anchor #d8d0c0 → target #b04a37 + (0,0,1).
    expect(remapped['#d8d0c1']).toBe('#b04a38');
    // #7f241e (signal deepest) has no pair in any livery; nearest paired anchor is
    // #b13b28 → #3d1210 + (−50,−23,−10), green clamps at 0.
    expect(manifest.items[0].source.extrudes[1].tint).toBe('#0b0006');
  });

  it('is pure and deterministic', () => {
    const input = miniUnit();
    const frozen = JSON.stringify(input);
    const a = applyGSeriesLivery(input, { livery: 'titanic' });
    const b = applyGSeriesLivery(input, { livery: 'titanic' });
    expect(JSON.stringify(input)).toBe(frozen);
    expect(JSON.stringify(a.manifest)).toBe(JSON.stringify(b.manifest));
  });

  it('rolls the shelf pick from the seed, reproducibly', () => {
    const a = applyGSeriesLivery(miniUnit(), { seed: 7 });
    const b = applyGSeriesLivery(miniUnit(), { seed: 7 });
    expect(a.picked).toBe(true);
    expect(a.livery).toBe(b.livery);
    expect(GSERIES_LIVERY_SHELF).toContain(a.livery);
    // Different seeds cover the shelf (not a fixed pick).
    const picks = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => applyGSeriesLivery(miniUnit(), { seed: s }).livery));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('jitter only moves panel-break tints, deterministically', () => {
    const plain = applyGSeriesLivery(miniUnit(), { livery: 'union-green', seed: 3 });
    const jittered = applyGSeriesLivery(miniUnit(), { livery: 'union-green', seed: 3, jitter: true });
    const again = applyGSeriesLivery(miniUnit(), { livery: 'union-green', seed: 3, jitter: true });
    expect(JSON.stringify(jittered.manifest)).toBe(JSON.stringify(again.manifest));
    // Dominant armor, identity, signal, and fixed roles are identical with or without jitter.
    expect(jittered.manifest.items[0].source.lathes[0].tint).toBe(plain.manifest.items[0].source.lathes[0].tint);
    expect(jittered.manifest.items[0].source.lathes[2].tint).toBe(plain.manifest.items[0].source.lathes[2].tint);
    expect(jittered.manifest.items[1].source.sweeps[0].tint).toBe('#111315');
  });
});
