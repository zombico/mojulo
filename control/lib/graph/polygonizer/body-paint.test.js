// body-paint.test.js — SECOND-SKIN garments painted on the body's own faces (body-paint.js), and the hero's paint words
// (hero-dress.js PAINT_WORDS) through the plan grammar's `paint` block.
import { describe, it, expect } from 'vitest';
import { humanoidPlan } from './humanoid-plan.js';
import { expandPlan } from './station-loft-plan.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { paintParts, validatePaint } from './body-paint.js';
import { PAINT_WORDS, validateDressPaint, lowerPaint } from './hero-dress.js';

const failures = (m) => Object.entries(auditLayered(m)).filter(([, r]) => !r.pass).map(([n]) => n);
const groupsOf = (mesh, re) => new Set(mesh.groups.filter((_, i) => re.test(mesh.faceIds[i])));
const worn = (opts) => { const plan = humanoidPlan({ detail: 'swimsuit', ...opts }); const recipe = expandPlan(plan); return { plan, recipe, mesh: compileLayered(recipe) }; };

describe('absent is zero bytes', () => {
  it('no paint, null paint: the plan and the recipe are the swimsuit hero\'s', () => {
    for (const preset of ['male', 'female']) {
      const plain = humanoidPlan({ preset, detail: 'swimsuit' });
      expect(humanoidPlan({ preset, detail: 'swimsuit', paint: null })).toEqual(plain);
      expect(plain.paint).toBeUndefined();
    }
    expect(humanoidPlan({ preset: 'male' })).toEqual(humanoidPlan({ preset: 'male', paint: undefined }));
  });
  it('an empty list paints nothing', () => {
    const parts = { a: { layer: 1, slots: ['f', 'fR', 's', 'bR', 'b', 'bL', 'sL', 'fL'], stations: [{ id: 'st0' }, { id: 'st1' }] } };
    expect(paintParts(JSON.parse(JSON.stringify(parts)), [])).toEqual(parts);
  });
});

describe('the grammar', () => {
  const ring8 = ['front', 'frontR', 'sideR', 'backR', 'back', 'backL', 'sideL', 'frontL'];
  const part = (n = 3, extra = {}) => ({ layer: 1, slots: ring8, group: 'Skin', stations: Array.from({ length: n }, (_, i) => ({ id: `st${i}` })), ...extra });
  it('windows in u, run and t pick bands by their middle; a later entry paints over an earlier one', () => {
    const P = { torso: part(5) };
    paintParts(P, [{ part: 'torso', u: [1, 3], group: 'Top' }, { part: 'torso', u: [2, 3], t: [0, 0.5], group: 'Skin' }]);
    expect(P.torso.bandGroups).toEqual({ 'st1-st2': ['Top', 'Top', 'Top', 'Top'], 'st2-st3': ['Skin', 'Skin', 'Top', 'Top'] });
    const Q = { leg: part(5) }; paintParts(Q, [{ part: 'leg', run: [0.5, 1], group: 'Bottom' }]);
    expect(Object.keys(Q.leg.bandGroups)).toEqual(['st2-st3', 'st3-st4']);
  });
  it('a whole end ring closes its cap; a base name paints both sides, a side name one; mirrored limbs share nothing', () => {
    const shared = { 'st0-st1': ['Swim', 'Swim', 'Swim', 'Swim'] };
    const P = { legR: part(3, { bandGroups: shared }), legL: part(3, { bandGroups: shared }) };
    paintParts(P, [{ part: 'legR', group: 'Bottom' }]);
    expect(P.legR.capGroups).toEqual({ back: 'Bottom', tip: 'Bottom' });
    expect(P.legL.bandGroups).toBe(shared); expect(shared['st0-st1'][0]).toBe('Swim');
    paintParts(P, [{ part: 'leg', only: ['Swim'], group: 'Skin' }]);
    expect(P.legL.bandGroups['st0-st1']).toEqual(['Skin', 'Skin', 'Skin', 'Skin']); expect(P.legR.bandGroups['st0-st1'][0]).toBe('Bottom');
  });
  it('refuses by name', () => {
    expect(validatePaint('tank')).toEqual(['paint: a list of { part, u?, run?, t?, group }']);
    expect(validatePaint([{ part: 'torso' }])).toEqual(['paint[0].group: a palette group name']);
    expect(validatePaint([{ part: 'torso', group: 'Top', run: [0, 2] }])[0]).toMatch(/paint\[0\]\.run/);
    expect(validatePaint([{ part: 'torso', group: 'Top', colour: 'red' }])[0]).toMatch(/not a paint field/);
    expect(() => paintParts({ torso: part() }, [{ part: 'tail', group: 'Top' }])).toThrow(/'tail' is not an L1 part/);
    expect(validateDressPaint('cape')[0]).toMatch(/'cape' is not a paint word/);
    expect(() => expandPlan({ ...humanoidPlan({ preset: 'male' }), paint: [{ part: 'tail', group: 'Top' }] })).toThrow(/layered plan: paint\[0\]: 'tail'/);
  });
});

describe('the paint words on the hero', () => {
  it('every word on both casts and both cores: painted, no audit failure, the forms untouched', () => {
    for (const core of ['structured', 'streamlined']) for (const preset of ['male', 'female']) {
      const bare = worn({ preset, core }).recipe;
      for (const w of Object.keys(PAINT_WORDS)) {
        const { plan, recipe, mesh } = worn({ preset, core, paint: w });
        expect(plan.paint.length, `${core} ${preset} ${w}`).toBeGreaterThan(0);
        expect(failures(mesh), `${core} ${preset} ${w}`).toEqual([]);
        // paint is colour, never geometry: every ring point is the bare body's
        for (const [n, p] of Object.entries(recipe.parts)) if (p.layer === 1) expect(p.stations, `${w} ${n}`).toEqual(bare.parts[n].stations);
      }
    }
  });
  it('a word names only the parts this body has', () => {
    const plan = humanoidPlan({ preset: 'male', core: 'streamlined', detail: 'swimsuit' });
    expect(lowerPaint('leggings', plan).flatMap((E) => E.part)).toEqual(['thigh', 'shank']);
    expect(lowerPaint('leggings', humanoidPlan({ preset: 'male', detail: 'swimsuit' })).flatMap((E) => E.part)).toEqual(['pelvis', 'thigh', 'shank']);
  });
  it('a leotard covers the swimwear; tights reach the toes; the tones are the figure\'s own and the operator\'s win', () => {
    for (const core of ['structured', 'streamlined']) for (const preset of ['male', 'female']) {
      const { mesh } = worn({ preset, core, paint: ['tights', 'leotard'] });
      expect(mesh.groups, `${core} ${preset}`).not.toContain('Swim');
      expect(groupsOf(mesh, /^torso\//).has('Top')).toBe(true);
      expect(groupsOf(mesh, /^shank[RL]\//)).toEqual(new Set(['Bottom']));
      expect(groupsOf(mesh, /^foot[RL]\//)).toEqual(new Set(['Bottom']));
    }
    const { plan } = worn({ preset: 'female', paint: ['gloves'], palette: { Top: '#112233' } });
    expect(plan.palette.Glove).toMatch(/^#[0-9a-f]{6}$/); expect(plan.palette.Top).toBe('#112233');
  });
  it('a crop leaves the midriff and the navel bare; a tee keeps a scoop at the collar; socks stop at the calf', () => {
    const crop = worn({ preset: 'female', paint: 'crop' }).mesh;
    expect(groupsOf(crop, /^torso\/st0-st1\./)).toEqual(new Set(['Skin'])); expect(groupsOf(crop, /^navel\//)).toEqual(new Set(['Navel']));
    expect(groupsOf(worn({ preset: 'male', paint: 'tee' }).mesh, /^torso\/st3_st4_50-st4\./)).toEqual(new Set(['Top', 'Skin']));
    expect(groupsOf(worn({ preset: 'male', paint: 'socks' }).mesh, /^shank[RL]\/st0-/)).toEqual(new Set(['Skin']));
  });
  it('deterministic: the same words, the same recipe', () => {
    const a = JSON.stringify(worn({ preset: 'female', paint: ['longSleeve', 'bikeShorts', 'gloves'] }).recipe);
    expect(JSON.stringify(worn({ preset: 'female', paint: ['longSleeve', 'bikeShorts', 'gloves'] }).recipe)).toBe(a);
  });
});
