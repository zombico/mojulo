// hero-carry, the sweep: every hold on both anime casts keeps every law it is held to.
import { describe, expect, it } from 'vitest';
import { validateRig } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { heroHold, HOLD_NAMES } from './hero-carry.js';

const rigOf = (cast) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);

describe('hero-carry, every hold', () => {
  for (const cast of ['female', 'male']) {
    const R = rigOf(cast);
    for (const name of HOLD_NAMES) {
      it(`${cast} ${name}`, () => {
        const c = heroHold(name, R).checks;
        expect(c.laws, JSON.stringify(c)).toEqual(Object.fromEntries(Object.keys(c.laws).map((k) => [k, true])));
      }, 90000);
    }
  }
});
