import { describe, it, expect } from 'vitest';
import { rollEgocube } from './egocube.js';
import { outfitFromSheet, outfitPalette } from './outfit.js';
import { planFromSheet } from './plan.js';
import { compileOutfit, outfitLaws, OUTFIT_KIND_NAMES } from '../polygonizer/outfit-plan.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { hexLch } from '../polygonizer/station-loft-shade.js';

const LINEAGES = ['ursine', 'lupine', 'feline', 'avian', 'draconic', 'insectoid'];

describe('the outfit, designed from the sheet', () => {
  it('every rolled character\'s outfit passes the visual-interest laws, and the outfits vary', () => {
    const sets = new Set();
    for (const a of LINEAGES) for (let seed = 1; seed <= 8; seed++) {
      const sheet = rollEgocube({ seed, facets: { ancestry: a } }), { outfit, laws } = outfitFromSheet(sheet);
      expect(laws.filter((l) => !l.ok).map((l) => `${a} ${seed}: ${l.law}: ${l.why}`)).toEqual([]);
      expect(outfit.pieces.filter((p) => p.role === 'focal')).toHaveLength(1);
      for (const p of outfit.pieces) { expect(OUTFIT_KIND_NAMES).toContain(p.kind); expect(p.why).toBeTruthy(); }
      sets.add(outfit.pieces.map((p) => p.kind).sort().join('+'));
    }
    expect(sets.size).toBeGreaterThan(12);
  });

  it('reads the character: a ruler wears a gown and a chain of office, not a porter\'s kit; a frontline wears armour', () => {
    const ruler = outfitFromSheet(rollEgocube({ seed: 3, facets: { ancestry: 'ursine' } })).outfit;
    // her sheet says a column, which a ruler allows: the long garment is a robe (a bell would be a gown)
    expect(['gown', 'robe']).toContain(ruler.pieces[0].kind);
    expect(ruler.pieces.map((p) => p.kind)).toEqual(expect.arrayContaining(['mantle', 'chain']));
    expect(ruler.pieces.find((p) => p.kind === 'chain').role).toBe('focal');
    expect(ruler.pieces.filter((p) => ['pack', 'satchel'].includes(p.kind)).length).toBeLessThanOrEqual(1);
    const front = outfitFromSheet(rollEgocube({ seed: 1, facets: { ancestry: 'ursine', role: 'frontline', archetype: 'hero' } })).outfit;
    expect(front.pieces.map((p) => p.kind)).toEqual(expect.arrayContaining(['pauldron', 'bracers']));
    // a tail that reads keeps its skirt short
    const wolf = outfitFromSheet(rollEgocube({ seed: 3, facets: { ancestry: 'lupine', archetype: 'ruler' } })).outfit;
    expect(wolf.pieces[0].kind).toBe('tunic');
  });

  it('the palette steps: garment, secondary, trim and accent each a clear value from the others and from the coat', () => {
    for (const a of LINEAGES) for (let seed = 1; seed <= 4; seed++) {
      const sheet = rollEgocube({ seed, facets: { ancestry: a } }), P = outfitPalette(sheet, sheet.ancestry.colours.Skin), L = (h) => hexLch(h)[0];
      expect(Math.abs(L(P.base) - L(sheet.ancestry.colours.Skin))).toBeGreaterThanOrEqual(15);
      for (const [x, y] of [['base', 'secondary'], ['base', 'trim'], ['base', 'accent'], ['secondary', 'trim']]) expect(Math.abs(L(P[x]) - L(P[y]))).toBeGreaterThanOrEqual(15);
    }
  });

  it('compiles onto the body in layer order: a fitted bodice, a skirt with a flat hem riding the thighs, the worn pieces', () => {
    const sheet = rollEgocube({ seed: 3, facets: { ancestry: 'ursine' } }), call = planFromSheet(sheet, { dress: 'designed' });
    const plan = call.create.spec.plan, built = compileOutfit(plan);
    expect(plan.style.drawn).toBe(true);
    expect(plan.adorn).toEqual([]);
    const core = plan.outfit.pieces[0].kind;
    expect(built.garments.map((g) => g.id)).toContain(`${core}Bodice`);
    const skirt = built.segments.find((s) => s.name === `${core}Skirt`);
    expect(skirt.caps.tip[2]).toBe(skirt.stations[skirt.stations.length - 1].at[2]);   // the hem flat, not a point
    expect(Object.keys(skirt.bind.blend).some((k) => /^st3\.sideR$/.test(k) && skirt.bind.blend[k].thighR > 0)).toBe(true);
    expect(built.adorn.map((a) => a.id)).toEqual(expect.arrayContaining(['mantle', 'sash', 'chain']));
    expect(built.palette.OutfitBase).toBe(plan.outfit.intent.palette.base);
    expect(() => expandPlan(built)).not.toThrow();
    // without `dress`, the stock kit as before
    expect(planFromSheet(sheet).create.spec.plan.outfit).toBeUndefined();
    expect(compileOutfit({ segments: [] })).toEqual({ segments: [] });
  });

  it('the laws name what fails: two focals, an accent spent twice, a flat value step, a hidden tail, a piece with no reason', () => {
    const laws = outfitLaws({ intent: { silhouette: 'wedge', palette: { base: '#3b2b48', secondary: '#45304f', trim: '#c9a24a', accent: '#e0bd5a' } },
      pieces: [{ kind: 'gown', why: 'x' }, { kind: 'chain', role: 'focal', why: 'x' }, { kind: 'pauldron', role: 'focal', colour: 'accent' }] }, { order: 0.2, archetype: 'ruler', mustSee: ['tail'] });
    const failing = laws.filter((l) => !l.ok).map((l) => l.law);
    expect(failing).toEqual(expect.arrayContaining(['one focal', 'clear value steps', 'shape from the archetype', 'the must-see stays seen', 'every piece has a reason']));
  });
});
