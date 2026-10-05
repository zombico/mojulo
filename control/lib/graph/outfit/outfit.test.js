// outfit.test.js — OUTFIT BUILDS (outfit/expand.js): the cards, the laws, the dials and the passes, on the hero door.
import { describe, it, expect } from 'vitest';
import { SEEDED_OUTFITS, validateOutfitCard } from './styles.js';
import { expandOutfit, validateOutfitBuild, OUTFIT_LAWS_VERSION } from './expand.js';
import { stepLength, outfitProportion } from './principles.js';
import { heroRecord, heroPlanOf } from '../../mcp/tools/layered.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { compileLayered, auditLayered } from '../polygonizer/station-loft.js';
import { bindLayered } from '../polygonizer/station-loft-rig.js';

const build = (style, more = {}) => ({ type: 'outfit', style, ...more });
const wear = (spec) => { const hero = heroRecord({ detail: 'swimsuit', ...spec }); const plan = heroPlanOf(hero); const recipe = expandPlan(plan); return { hero, plan, recipe, mesh: compileLayered(recipe) }; };
const groupsOf = (mesh) => new Set(mesh.groups);
const STRUCT = new Set(['torso', 'pelvis', 'neck', 'upperArm', 'foreArm', 'thigh', 'shank', 'foot', 'hallux', 'pectoral']);

describe('the cards', () => {
  it('every seeded card is plain JSON and valid', () => {
    for (const [id, card] of Object.entries(SEEDED_OUTFITS)) {
      expect(JSON.parse(JSON.stringify(card)), id).toEqual(card);
      expect(validateOutfitCard(card), id).toEqual([]);
      expect(validateOutfitBuild(build(id)), id).toEqual([]);
    }
  });
  it('refuses by name', () => {
    expect(validateOutfitBuild(build('gala'))[0]).toMatch(/'gala' is not a sample/);
    expect(validateOutfitBuild(build('casual', { dials: { fit: 2 } }))).toEqual(['outfit.dials.fit: a number 0–1']);
    expect(validateOutfitBuild(build('casual', { dials: { drape: 1 } }))[0]).toMatch(/not a dial/);
    expect(validateOutfitBuild(build('casual', { language: { top: { sleeve: 'puffed' } } }))[0]).toMatch(/sleeve: 'puffed'/);
    expect(validateOutfitBuild(build('casual', { laws: 99 }))[0]).toMatch(/outfit laws 1/);
    expect(() => heroRecord({ outfit: build('gala') })).toThrow(/'gala' is not a sample/);
  });
});

describe('the laws as arithmetic', () => {
  it('law 3: coverage steps a length shorter per third, never past the shortest', () => {
    expect(stepLength('sleeve', 'long', 1)).toBe('long');
    expect(stepLength('sleeve', 'long', 0.67)).toBe('threeQuarter');
    expect(stepLength('leg', 'short', 0)).toBe('brief');
  });
  it('laws 1, 2, 8: fit and stylize move ease, hang and trims one way', () => {
    const a = outfitProportion({ fit: 0, stylize: 0 }), b = outfitProportion({ fit: 1, stylize: 0 }), c = outfitProportion({ fit: 1, stylize: 1 });
    expect(b.ease).toBeGreaterThan(a.ease); expect(b.hang).toBeGreaterThan(a.hang); expect(c.ease).toBeGreaterThan(b.ease); expect(c.trim).toBeGreaterThan(b.trim);
  });
});

describe('the passes', () => {
  it('every card on both casts and both cores: built, audit clean, bound, laws stamped, the edges in the readout', () => {
    for (const style of Object.keys(SEEDED_OUTFITS)) for (const core of ['structured', 'streamlined']) for (const cast of ['male', 'female']) {
      const { hero, recipe, mesh } = wear({ cast, core, outfit: build(style) });
      expect(hero.outfit.laws, style).toBe(OUTFIT_LAWS_VERSION);
      expect(Object.entries(auditLayered(mesh)).filter(([, r]) => !r.pass).map(([n]) => n), `${style} ${core} ${cast}`).toEqual([]);
      expect(() => bindLayered(mesh, recipe)).not.toThrow();
    }
  });
  it('the card\'s tones reach the recipe (through the head\'s include too), beneath the operator\'s', () => {
    expect(wear({ cast: 'male', outfit: build('adventurer') }).recipe.palette.Top).toBe(SEEDED_OUTFITS.adventurer.tones.Top);
    expect(wear({ cast: 'male', outfit: build('adventurer'), palette: { Top: '#123456' } }).recipe.palette.Top).toBe('#123456');
  });
  it('the CUT: language and coverage set the pieces', () => {
    const t = (o) => expandOutfit(build('office', o), { have: STRUCT, scale: 1 }).trace;
    expect(t().lengths).toEqual({ sleeve: 'long', hem: 'hip', leg: 'long' });
    expect(t({ dials: { coverage: 0.34 } }).lengths).toEqual({ sleeve: 'elbow', hem: 'crop', leg: 'knee' });
    expect(t({ language: { top: { sleeve: 'short' }, feet: 'boots' } }).pieces).toEqual(expect.arrayContaining(['topSleeve', 'bootShaft', 'boot']));
    expect(t({ language: { top: { sleeve: 'short' } } }).pieces).not.toContain('topCuff');
  });
  it('the FIT: a looser fit stands further off the body', () => {
    const top = (fit) => expandOutfit(build('casual', { dials: { fit } }), { have: STRUCT, scale: 1 }).garments.find((E) => E.id === 'top').ease;
    expect(top(1)).toBeGreaterThan(top(0.5)); expect(top(0.5)).toBeGreaterThan(top(0));
  });
  it('the LAYER: worn out, the bottom first and the top\'s tail over it; tucked, the reverse', () => {
    const order = (tuck) => expandOutfit(build('casual', { language: { tuck } }), { have: STRUCT, scale: 1 }).garments.map((E) => E.id);
    expect(order(false).indexOf('bottomSeat')).toBeLessThan(order(false).indexOf('topTail'));
    expect(order(true).indexOf('topTail')).toBeLessThan(order(true).indexOf('bottomSeat'));
  });
  it('the ORNAMENT budget: 0 the construction alone, 1 the focal, 2 the edges, 3 the seams; a knit waist takes no belt', () => {
    const edges = (style, ornament) => expandOutfit(build(style, { dials: { ornament } }), { have: STRUCT, scale: 1 }).trace.edges;
    expect(edges('office', 0)).toEqual(['placket']);
    expect(edges('office', 1)).toEqual(['placket', 'collar']);
    expect(edges('office', 2)).toEqual(expect.arrayContaining(['buttons', 'belt', 'cuffs', 'waistband'])); expect(edges('office', 2)).not.toContain('seams');
    expect(edges('office', 3)).toContain('seams');
    expect(edges('athlete', 3)).not.toContain('belt');
    const m = wear({ cast: 'male', outfit: build('office') }).mesh;
    for (const g of ['Placket', 'Button', 'Collar', 'Trim', 'Seam', 'Waistband', 'Leather', 'Buckle']) expect(groupsOf(m).has(g), g).toBe(true);
    expect(groupsOf(wear({ cast: 'male', outfit: build('office', { dials: { ornament: 0 } }) }).mesh).has('Button')).toBe(false);
  });
  it('the LEDGER: what this body could not wear is said, never refused', () => {
    const tr = expandOutfit(build('adventurer'), { have: new Set(['torso', 'neck', 'upperArm', 'foreArm', 'thigh', 'shank', 'foot', 'toes']), scale: 1 }).trace;
    expect(tr.warnings.join(' ')).toMatch(/no pelvis to belt/);
    expect(tr.warnings.join(' ')).toMatch(/focal: 'belt'/);
  });
  it('deterministic: the same words, the same recipe', () => {
    const a = JSON.stringify(wear({ cast: 'female', outfit: build('casual') }).recipe);
    expect(JSON.stringify(wear({ cast: 'female', outfit: build('casual') }).recipe)).toBe(a);
  });
});
