import { describe, it, expect } from 'vitest';
import { SPRITE_VERBS, SPRITE_VERB_IDS, DEFERRED_VERBS, beadsFor, resolveSpriteSfxLayers } from './glyph-sfx-sprites.js';

const finite3 = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);

describe('glyph-sfx-sprites verb-path evaluator', () => {
  it('every verb yields finite bead positions + weights in [0,1] across a full cycle', () => {
    for (const verb of SPRITE_VERB_IDS) {
      for (const ph of [0, 0.7, 1.9, Math.PI, 6.28]) {
        const beads = beadsFor(verb, [3, -2, 0], ph);
        expect(beads.length).toBeGreaterThan(0);
        for (const b of beads) {
          expect(finite3(b.p)).toBe(true);
          expect(Number.isFinite(b.w)).toBe(true);
          expect(b.w).toBeGreaterThanOrEqual(0);
          expect(b.w).toBeLessThanOrEqual(1.0001);
        }
      }
    }
  });

  it('is deterministic in phase — same (verb, cc, ph) → identical beads', () => {
    const a = beadsFor('enchant', [1, 1, 0], 2.3);
    const b = beadsFor('enchant', [1, 1, 0], 2.3);
    expect(a).toEqual(b);
  });

  it('beads move with phase (the paths actually animate)', () => {
    const t0 = beadsFor('heal', [0, 0, 0], 0.0);
    const t1 = beadsFor('heal', [0, 0, 0], 1.2);
    const moved = t0.some((b, i) => Math.hypot(b.p[0] - t1[i].p[0], b.p[1] - t1[i].p[1], b.p[2] - t1[i].p[2]) > 0.05);
    expect(moved).toBe(true);
  });

  it('anchors translate the whole path (cc offset)', () => {
    const at0 = beadsFor('ward', [0, 0, 0], 1.0);
    const at5 = beadsFor('ward', [5, 0, 0], 1.0);
    at0.forEach((b, i) => expect(at5[i].p[0]).toBeCloseTo(b.p[0] + 5, 6));
  });

  it('aura brightness stays within its bounded pulse envelope', () => {
    for (const ph of [0, 1, 2, 3, 4, 5, 6]) {
      const w = beadsFor('aura', [0, 0, 0], ph)[0].w;
      expect(w).toBeGreaterThanOrEqual(0.55 - 1e-9);
      expect(w).toBeLessThanOrEqual(0.55 + 0.35 + 1e-9);
    }
  });

  it('unknown and deferred verbs yield no beads', () => {
    expect(beadsFor('nope', [0, 0, 0], 0)).toEqual([]);
    for (const v of DEFERRED_VERBS) expect(SPRITE_VERBS[v]).toBeUndefined();
  });

  it('resolveSpriteSfxLayers fills anchors from at / on and carries color+size', () => {
    const entities = [{ id: 'coin', transform: { pos: [7, 0, 0] } }];
    const layers = resolveSpriteSfxLayers(
      [
        { verb: 'sparkle', on: 'coin' },
        { verb: 'aura', at: [1, 2, 0], color: [1, 0, 0], size: 0.9 },
        { verb: 'aura', on: 'missing' },   // unresolvable → dropped
        { verb: 'kokusen', at: [0, 0, 0] }, // deferred verb → dropped
      ],
      entities,
    );
    expect(layers.length).toBe(2);
    expect(layers[0]).toMatchObject({ verb: 'sparkle', cc: [7, 0, 0] });
    expect(layers[1]).toMatchObject({ verb: 'aura', cc: [1, 2, 0], color: [1, 0, 0], size: 0.9 });
  });
});
