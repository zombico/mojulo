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
  it('a skirt: one hull round the hips and both legs, holding them at rest, never narrowing below the hips, open beneath', () => {
    for (const core of ['structured', 'streamlined']) for (const cut of ['pencil', 'aline', 'full']) {
      const { recipe, mesh } = wear({ cast: 'female', core, outfit: build('blouse', { language: { bottom: { cut } } }) });
      const S = recipe.parts.skirt_skirt, outer = S.stations.slice(0, 12), rad = (st) => Object.values(st.points).map((p) => Math.hypot(p[0], p[1] - outer[0].points.front[1] + (outer[0].points.front[1] - outer[0].points.back[1]) / 2));
      // below the hips' widest ring each ring is at least as wide as the one above it, everywhere round
      const mean = (st) => rad(st).reduce((a, b) => a + b, 0); let hip = 0; outer.forEach((st, i) => { if (mean(st) > mean(outer[hip])) hip = i; });
      for (let i = hip + 1; i < 12; i++) rad(outer[i]).forEach((r, k) => expect(r, `${core} ${cut} ring ${i}`).toBeGreaterThanOrEqual(rad(outer[i - 1])[k] - 1e-6));
      // folded at the hem: an inner wall back up, so the skirt is open beneath
      expect(S.stations.length).toBeGreaterThan(12);
      // the thighs' points between the waist and the hem lie inside the outer rings (each ring's support, in plan)
      const zw = outer[0].points.front[2], zh = outer[11].points.front[2];
      for (const n of ['thighR', 'thighL']) for (const st of recipe.parts[n].stations) for (const p of Object.values(st.points)) {
        if (p[2] > zw || p[2] < zh) continue; const i = Math.min(11, Math.max(0, Math.round((zw - p[2]) / (zw - zh) * 11)));
        const ring = Object.values(outer[i].points), cy = (outer[i].points.front[1] + outer[i].points.back[1]) / 2;
        const ang = Math.atan2(p[0], p[1] - cy), r = Math.hypot(p[0], p[1] - cy), near = ring.reduce((b, q) => { const a2 = Math.atan2(q[0], q[1] - cy); return Math.abs(a2 - ang) < Math.abs(Math.atan2(b[0], b[1] - cy) - ang) ? q : b; });
        expect(r, `${core} ${cut} ${n}`).toBeLessThanOrEqual(Math.hypot(near[0], near[1] - cy) + 0.02);
      }
      expect(Object.entries(auditLayered(mesh)).filter(([, r2]) => !r2.pass).map(([n]) => n)).toEqual([]);
    }
  });
  it('the skirt skins by nearness: its weights sum to one, the cloth over a leg follows that leg, the cloth between them the pelvis', () => {
    const { recipe } = wear({ cast: 'female', outfit: build('sundress', { language: { bottom: { leg: 'midi' } } }) });
    const B = recipe.parts.skirt_skirt.bind.blend;
    for (const [k, w] of Object.entries(B)) expect(Object.values(w).reduce((a, b) => a + b, 0), k).toBeCloseTo(1, 9);
    expect(B['st9.sideR'].thighR ?? 0).toBeGreaterThan(B['st9.sideR'].pelvis ?? 0);
    expect(B['st9.back'].pelvis ?? 0).toBeGreaterThan(Math.max(B['st9.back'].thighR ?? 0, B['st9.back'].thighL ?? 0));
    expect(B['st0.front']).toEqual({ pelvis: 1 });
  });
  it('a dress is one garment: the skirt in the top\'s cloth, no waistband, no placket, the belt its focal', () => {
    const { trace, garments } = expandOutfit(build('sundress'), { have: STRUCT, scale: 1 });
    expect(trace.dress).toBe(true); expect(garments.find((E) => E.id === 'skirt').group).toBe('Top');
    expect(trace.edges).toEqual(['belt']);
    expect(validateOutfitBuild(build('casual', { language: { dress: true } }))[0]).toMatch(/a dress is a top and a skirt/);
  });
  it('the top drapes from what holds it out: under the bust the shirt comes in no faster than its drape', () => {
    const { recipe } = wear({ cast: 'female', outfit: build('blouse') });
    const T = recipe.parts.top_torso, front = (id) => T.stations.find((s) => s.id === id).points.front[1];
    expect(front('st1')).toBeGreaterThan(front('st2') - 0.35 * Math.abs(T.stations.find((s) => s.id === 'st2').points.front[2] - T.stations.find((s) => s.id === 'st1').points.front[2]) - 0.01);
  });
  it('deterministic: the same words, the same recipe', () => {
    const a = JSON.stringify(wear({ cast: 'female', outfit: build('casual') }).recipe);
    expect(JSON.stringify(wear({ cast: 'female', outfit: build('casual') }).recipe)).toBe(a);
  });
});
