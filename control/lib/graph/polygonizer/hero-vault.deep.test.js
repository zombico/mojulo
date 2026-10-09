// hero-vault, the sweep: every move across its band (the ends and the middle of its heights, its depths) from each foot,
// on both anime casts, keeps every law it is held to.
import { describe, expect, it } from 'vitest';
import { validateRig } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { heroVault, VAULTS } from './hero-vault.js';

const rigOf = (cast) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);

describe('hero-vault, every move across its band', () => {
  for (const cast of ['female', 'male']) {
    const R = rigOf(cast), hip = R.joints.pelvisHub[2];
    for (const [name, V] of Object.entries(VAULTS)) for (const [from, [lo, hi]] of Object.entries(V.band)) {
      const ds = [...new Set([Math.max(V.depth[0], 0.1), V.depth[1]])];
      for (const r of [lo, (lo + hi) / 2, hi]) for (const d of ds) for (const side of ['', 'Left']) {
        it(`${cast} ${name}${side} ${from} ${r.toFixed(3)} of the hip × ${d} m`, () => {
          const c = heroVault(`${name}${side}`, R, { h: r * hip, d, from }).checks;
          expect(c.laws, JSON.stringify(c)).toEqual(Object.fromEntries(Object.keys(c.laws).map((k) => [k, true])));
        }, 90000);
      }
    }
  }
});
