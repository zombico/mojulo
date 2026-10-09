// hero-rise, the sweep: every rest pose, up and down, on both anime casts keeps every law it is held to.
import { describe, expect, it } from 'vitest';
import { validateRig } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { heroRise } from './hero-rise.js';
import { REST_NAMES } from './hero-rest.js';

const rigOf = (cast) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast, head: 'anime' }) }).recipe.rig);

describe('hero-rise, every rest both ways', () => {
  for (const cast of ['female', 'male']) {
    const R = rigOf(cast);
    for (const name of REST_NAMES) for (const down of [false, true]) {
      it(`${cast} ${name} ${down ? 'down' : 'up'}`, () => {
        const c = heroRise(name, R, { down }).checks;
        expect(c.laws, JSON.stringify(c)).toEqual(Object.fromEntries(Object.keys(c.laws).map((k) => [k, true])));
      }, 90000);
    }
  }
});
