// A mascot's kit: a sport's kit lowered onto a mascot's own parts as paint, as far as its shape has them. One mascot
// with a trunk and limbs, one orb (all head); the kit worn, re-worn and taken off, and the plan still expands.
import { describe, it, expect } from 'vitest';
import { mascotKit, mascotKitParts } from './mascot-kit.js';
import { rollMascot } from '../egocube/mascot.js';
import { mascotPlanFromSheet } from '../egocube/mascot-form.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { SPORT_KITS } from './kits.js';

const planOf = (spec) => mascotPlanFromSheet(rollMascot(spec)).create.spec.plan;
const groupsOf = (recipe) => new Set(Object.values(recipe.parts).flatMap((p) => Object.values(p.bandGroups || {}).flat()));

describe('a mascot\'s kit', () => {
  const body = planOf({ brief: 'a round friendly bear', seed: 3 }), orb = planOf({ brief: 'an orb', seed: 5, facets: { form: 'orb' } });

  it('is worn on the parts the shape has: a trunk and limbs, or an orb\'s middle and its legs', () => {
    expect(mascotKitParts(body)).toMatchObject({ trunk: 'body', orb: false });
    expect(mascotKitParts(orb)).toMatchObject({ trunk: 'head', orb: true });
    for (const plan of [body, orb]) {
      const worn = mascotKit(plan, 'hockey'), names = new Set(plan.segments.map((s) => s.name.replace(/[RL]$/, '')));
      const kit = worn.paint.filter((e) => e.id === 'kit');
      expect(kit.length).toBeGreaterThan(0);
      for (const e of kit) expect(names.has(e.part)).toBe(true);
      // it expands, and the kit's colours are on the body: the shirt, the shorts, the gloves the hockey card wears
      const groups = groupsOf(expandPlan(worn));
      for (const g of ['Top', 'Bottom']) expect(groups.has(g)).toBe(true);
      expect(worn.palette).toMatchObject({ Top: SPORT_KITS.hockey.colours[0], Glove: SPORT_KITS.hockey.colours[1] });
    }
    // the orb's band is low on it, clear of its face
    expect(mascotKit(orb, 'tennis').paint.find((e) => e.id === 'kit' && e.part === 'head').run[1]).toBeLessThan(0.2);
  });

  it('keeps the mascot\'s own paint under it; a new kit replaces the old, and none takes it off to the colour beneath', () => {
    const worn = mascotKit(body, { sport: 'soccer', colours: ['#d7263d'], pattern: 'hoops' });
    expect(worn.paint.slice(0, body.paint.length)).toEqual(body.paint);
    expect(worn.mascot.kit).toEqual({ sport: 'soccer', colours: ['#d7263d'], pattern: 'hoops' });
    expect(mascotKit(worn, 'tennis')).toEqual(mascotKit(body, 'tennis'));
    expect(mascotKit(mascotKit(body, 'hockey'), null)).toEqual(body);   // the gloves' colour back to the mascot's own
    expect(mascotKit(body, 'soccer')).toEqual(mascotKit(body, 'soccer'));
    expect(() => mascotKit(body, 'quidditch')).toThrow(/'quidditch' is not a sport's kit/);
  });
});
