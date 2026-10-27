/**
 * The sprays (vegetation/sprays.js): one per species' outline, the same bytes twice, a spray's triangles within the
 * budget a cloned crown affords, its colours the leaves' own (never lit), its leaves set by the architecture's phyllotaxis.
 */
import { describe, expect, it } from 'vitest';

import { leafSpray, leafOutline, SPRAY_LEAVES } from './sprays.js';
import { SPECIES } from './species.js';
import { ARCHITECTURES } from './grow.js';
import { TONES } from './tree-mesh.js';

// one tree species per outline the table names, chosen from the catalogue
const byOutline = new Map(); for (const [k, S] of Object.entries(SPECIES)) if (S.kind === 'tree' && !byOutline.has(leafOutline(k))) byOutline.set(leafOutline(k), k);

describe('sprays', () => {
  it('grows the same spray twice, within a clone\'s budget, its colours the leaves\' and the twig\'s own', () => {
    for (const [outline, sp] of byOutline) {
      const a = leafSpray(sp, { seed: 3 }), b = leafSpray(sp, { seed: 3 });
      expect(a).toEqual(b);
      expect(a.leaves).toBe(SPRAY_LEAVES[outline].leaves);
      expect(a.tris.length).toBeLessThanOrEqual(64);
      // (albedo between the leaf's two tones, the twig's shoot tone: no exposure, no sun)
      for (const t of a.tris) {
        if (t.kind === 'wood') expect(t.c).toEqual(TONES.shoot);
        else for (let k = 0; k < 3; k++) { expect(t.c[k]).toBeGreaterThanOrEqual(Math.min(TONES.leaf[k], TONES.leafLit[k]) - 1e-9); expect(t.c[k]).toBeLessThanOrEqual(Math.max(TONES.leaf[k], TONES.leafLit[k]) + 1e-9); }
      }
    }
  });

  it('sets its leaves as its architecture does: two ranks in one plane, or round the twig', () => {
    const distich = Object.keys(SPECIES).find((k) => SPECIES[k].kind === 'tree' && ARCHITECTURES[SPECIES[k].arch].phyllo === 'distichous');
    const spiral = Object.keys(SPECIES).find((k) => SPECIES[k].kind === 'tree' && ARCHITECTURES[SPECIES[k].arch].phyllo === 'spiral');
    // (how far the leaves' tips stray out of the twig's horizontal plane: a distichous spray stays flat)
    const spread = (sp) => { const L = leafSpray(sp, { seed: 1 }).tris.filter((t) => t.kind === 'leaf'); return Math.max(...L.flatMap((t) => t.p.map((p) => Math.abs(p[2] - 0)))) / Math.max(...L.flatMap((t) => t.p.map((p) => Math.abs(p[1])))); };
    expect(spread(distich)).toBeLessThan(spread(spiral));
  });
});
