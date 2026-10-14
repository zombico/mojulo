// hero-vault, the sweep: every move out of each gait it takes, at the ends of its band (the lowest box at its shallowest,
// the highest at its deepest), keeps every law it is held to. The side and the cast alternate across the moves so each
// end meets each foot and each anime cast.
import { describe, expect, it } from 'vitest';
import { validateRig } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { heroVault, VAULTS } from './hero-vault.js';

const rigOf = (cast) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);
const RIGS = { female: rigOf('female'), male: rigOf('male') };
const BANDS = Object.entries(VAULTS).flatMap(([name, V]) => Object.entries(V.band).map(([from, [lo, hi]]) => ({ name, from, ends: [[lo, Math.max(V.depth[0], 0.1)], [hi, V.depth[1]]] })));

describe('hero-vault, every move across its band', () => {
  BANDS.forEach(({ name, from, ends }, b) => ends.forEach(([r, d], k) => {
    const cast = (b + k) % 2 ? 'male' : 'female', side = b % 2 ? 'Left' : '', R = RIGS[cast], hip = R.joints.pelvisHub[2];
    it(`${cast} ${name}${side} ${from} ${r.toFixed(3)} of the hip × ${d} m`, () => {
      const c = heroVault(`${name}${side}`, R, { h: r * hip, d, from }).checks;
      expect(c.laws, JSON.stringify(c)).toEqual(Object.fromEntries(Object.keys(c.laws).map((k) => [k, true])));
    }, 90000);
  }));
});
