// The hero door wearing an armour build: the record stores the words (stamped with the laws), the plan regenerates
// the kit on every read, a dial patch restyles the suit in place, and the adornment layer's data signatures (facing,
// boards with their own lacing group, crest) and `stack: false` bake on a real hero.
import { describe, expect, it } from 'vitest';

import { heroRecord, heroPlanOf, expandLayeredManifest, validateHeroSpec, heroReadout } from '@/lib/mcp/tools/layered';
import { compileLayered } from '@/lib/graph/polygonizer/station-loft';
import { expandPlan } from '@/lib/graph/polygonizer/station-loft-plan';
import { ARMOR_LAWS_VERSION } from '@/lib/graph/armor/expand';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { derivedShade } from '@/lib/graph/polygonizer/station-loft-shade';

const adornParts = (recipe) => Object.keys(recipe.parts).filter((n) => n.startsWith('adorn.'));

describe('hero door: an armour build on adorn', () => {
  it('stores the words stamped with the laws, and refuses a bad build naming the choices', () => {
    const hero = heroRecord({ cast: 'male', adorn: { type: 'armor', style: 'knight', dials: { coverage: 0.4 } } });
    expect(hero.adorn).toEqual({ type: 'armor', style: 'knight', dials: { coverage: 0.4 }, laws: ARMOR_LAWS_VERSION });
    expect(validateHeroSpec({ adorn: { type: 'armor', style: 'paladin' } }).join(' ')).toMatch(/not a sample/);
    expect(() => heroRecord({ adorn: { type: 'armor', dials: { coverage: 3 } } })).toThrow(/coverage: a number 0–1/);
  });

  it('regenerates the suit from the hero on read; a coverage patch restyles it in place', () => {
    const hero = heroRecord({ cast: 'male', adorn: { type: 'armor', style: 'knight', dials: { coverage: 0 } } });
    const a = expandLayeredManifest({ kind: 'layered', hero });
    const b = expandLayeredManifest({ kind: 'layered', hero: { ...hero, adorn: { ...hero.adorn, dials: { coverage: 0.6 } } } });
    const pa = adornParts(a.recipe), pb = adornParts(b.recipe);
    expect(pa).toContain('adorn.torso-pauldronR');
    expect(pa).not.toContain('adorn.torso-pauldronL');
    expect(pb).toContain('adorn.torso-pauldronL');   // the partner arrives at 0.5
    expect(pb.length).toBeGreaterThan(pa.length);
    expect(JSON.stringify(expandLayeredManifest({ kind: 'layered', hero }).recipe.parts)).toBe(JSON.stringify(a.recipe.parts));   // deterministic
    expect(a.plan.palette.Plate).toBe('#aeb4bb');   // the card's tones, beneath the operator's
  });

  it('bakes the data signatures: the focal boss faces the eye, the boards lay lacquer and silk, the crest reads', () => {
    const hero = heroRecord({ cast: 'male', hair: 'none', adorn: { type: 'armor', style: 'aka' } });
    const plan = heroPlanOf(hero); const { recipe } = expandLayeredManifest({ kind: 'layered', hero });
    const mesh = compileLayered(recipe, {});
    const groups = new Set(mesh.groups);
    for (const g of ['Lacquer', 'Odoshi', 'Crest', 'Kanamono']) expect(groups.has(g), g).toBe(true);
    expect(Object.keys(mesh.parts).filter((n) => n.startsWith('adorn.upperArmR-sode.sig')).length).toBeGreaterThan(4);   // rows + cords from one signature
    const out = heroReadout(hero, plan, null, [], { mesh, recipe });
    expect(out.dress.adorn).toBe('armor:aka');
    expect(out.dress.armor).toMatchObject({ family: 'lamellar', focal: 'crest:kuwagata' });
    const crest = out.dress.adornments.find((r) => r.id === 'cranium-mabizashiR');
    expect(crest.verdict).toBe('justified');
    expect((out.warnings || []).some((w) => /kabuto/.test(w))).toBe(false);   // hair 'none' under the kabuto
  }, 60000);

  it('warns when hair passes through the kabuto', () => {
    const hero = heroRecord({ cast: 'male', adorn: { type: 'armor', style: 'shiro', dials: { coverage: 0 } } });
    const plan = heroPlanOf(hero); const { recipe } = expandLayeredManifest({ kind: 'layered', hero });
    const out = heroReadout(hero, plan, null, [], { mesh: compileLayered(recipe, {}), recipe });
    expect(out.warnings.some((w) => /kabuto covers the head/.test(w))).toBe(true);
  }, 60000);

  it('stack: false keeps lamellar rows a sawtooth — stacked, the same rows pile outward', () => {
    const hero = heroRecord({ cast: 'male', hair: 'none', adorn: { type: 'armor', style: 'kuro-kon', dials: { coverage: 0.2 } } });
    const plan = heroPlanOf(hero);
    // at a kit's usual 5 cm hull radius, the flag alone decides: the same rows with and without `stack: false`
    const wide = (keep) => ({ ...plan, adorn: plan.adorn.map(({ stack, ...A }) => ({ ...A, rad: 0.05, ...(keep && stack === false ? { stack } : {}) })) });
    const width = (p) => { const mesh = compileLayered(expandPlan(p), {}); const xs = Object.values(mesh.parts['adorn.torso-do0'].points).map((q) => q[0]); return Math.max(...xs) - Math.min(...xs); };
    // the top row of the dō: at its own standoff as a sawtooth; lifted over every row below it when stacked
    expect(width(wide(false)) - width(wide(true))).toBeGreaterThan(0.03);
  }, 60000);

  // the static solid's full-bright glow (layeredFaces) reaches the character light's page and the rig pack too: the
  // clip preview and the skinned GLB used to shade a lens like any plate
  it('the emissive groups stay full-bright under the character light and in the rig pack', async () => {
    const hero = heroRecord({ cast: 'male', adorn: { type: 'armor', style: 'armored-hero', dials: { coverage: 0 } } });
    const m = expandLayeredManifest({ kind: 'layered', hero });
    expect(m.recipe.emissive).toContain('Lens');
    const lens = m.recipe.palette.Lens;
    const lit = (await resolveWorldScene({ ref: 'x', title: 't', manifest: { ...m, toon: { light: { toLight: [0.3, -0.6, 0.75], threshold: 0.3 } } } })).payload;
    const fills = new Set(lit.faces.map((f) => f.fill));
    expect(fills.has(lens)).toBe(true); expect(fills.has(derivedShade('Lens', lens))).toBe(false);
    const figures = async (recipe) => JSON.stringify((await resolveWorldScene({ ref: 'x', title: 't', manifest: { ...m, recipe } })).payload.figures);
    expect(await figures(m.recipe)).not.toBe(await figures({ ...m.recipe, emissive: [] }));
  }, 60000);
});
