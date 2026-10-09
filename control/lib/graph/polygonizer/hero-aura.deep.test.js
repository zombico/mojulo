// hero-aura, the sweep: every showcase pose and its mirror, on both anime casts, keeps every law it is held to — the
// held pose and its performance from the stand.
import { describe, expect, it } from 'vitest';
import { validateRig, bindLayered } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest, planLayered } from '../../mcp/tools/layered.js';
import { heroAura, auraBody, AURA_NAMES } from './hero-aura.js';

const heroOf = (cast) => {
  const hero = heroRecord({ cast, head: 'anime' }), ex = expandLayeredManifest({ kind: 'layered', title: 't', hero });
  const { mesh } = planLayered({ kind: 'layered', title: 't', recipe: ex.recipe, hero, dials: ex.dials, units: 'm' });
  const R = validateRig(ex.recipe.rig); return { R, body: auraBody(R, mesh, bindLayered(mesh, ex.recipe, R)) };
};

describe('hero-aura, every pose and its mirror', () => {
  for (const cast of ['female', 'male']) {
    const { R, body } = heroOf(cast);
    for (const name of AURA_NAMES) it(`${cast} ${name}`, () => {
      const c = heroAura(name, R, { body }).checks;
      expect(c.laws, JSON.stringify(c)).toEqual(Object.fromEntries(Object.keys(c.laws).map((k) => [k, true])));
    }, 90000);
  }
});
