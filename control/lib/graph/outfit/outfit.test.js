// outfit.test.js — OUTFIT BUILDS (outfit/expand.js): the cards, the laws, the dials and the passes, on the hero door.
import { describe, it, expect } from 'vitest';
import { SEEDED_OUTFITS, validateOutfitCard } from './styles.js';
import { expandOutfit, validateOutfitBuild, OUTFIT_LAWS_VERSION, GARMENT_ROLES, MOTIF_NAMES } from './expand.js';
import { stepLength, outfitProportion } from './principles.js';
import { heroRecord, heroPlanOf } from '../../mcp/tools/layered.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { compileLayered, auditLayered } from '../polygonizer/station-loft.js';
import { bindLayered } from '../polygonizer/station-loft-rig.js';
import { dressSilhouette, SILHOUETTE_BANDS } from '../polygonizer/dress-silhouette.js';

const build = (style, more = {}) => ({ type: 'outfit', style, ...more });
const wear = (spec) => { const hero = heroRecord({ detail: 'swimsuit', ...spec }); const plan = heroPlanOf(hero); const recipe = expandPlan(plan); return { hero, plan, recipe, mesh: compileLayered(recipe) }; };
const groupsOf = (mesh) => new Set(mesh.groups);
const STRUCT = new Set(['torso', 'pelvis', 'neck', 'upperArm', 'foreArm', 'thigh', 'shank', 'foot', 'hallux', 'pectoral']);
// each garment piece and edge is its own pass, worn on each core and cast: the fewest card × core × cast cases that
// run every one (greedy cover over the cut's trace, in code; the trace costs nothing, a wear costs a mesh)
const WEARS = (() => {
  const cases = Object.keys(SEEDED_OUTFITS).flatMap((style) => ['structured', 'streamlined'].flatMap((core) => ['male', 'female'].map((cast) => [style, core, cast])));
  const traces = new Map(Object.keys(SEEDED_OUTFITS).map((id) => [id, expandOutfit(build(id), { have: STRUCT, scale: 1 }).trace]));
  const keysOf = ([style, core, cast]) => { const t = traces.get(style);
    return [...t.pieces.map((p) => `piece:${p}`), ...t.edges.map((e) => `edge:${e}`), `dress:${!!t.dress}`, `core:${core}`, `cast:${cast}`, `on:${core}/${cast}`]; };
  const left = new Set(cases.flatMap(keysOf)), picked = [];
  while (left.size) {
    const gain = (c) => keysOf(c).filter((k) => left.has(k)).length;
    const best = cases.reduce((a, b) => (gain(b) > gain(a) ? b : a));
    picked.push(best); for (const k of keysOf(best)) left.delete(k);
  }
  return picked;
})();

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
  it('every piece and edge, on both casts and both cores: built, audit clean, bound, laws stamped, the edges in the readout', () => {
    for (const [style, core, cast] of WEARS) {
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
    // each cut once, the cores taken in turn
    for (const [i, cut] of ['pencil', 'aline', 'full'].entries()) {
      const core = ['structured', 'streamlined'][i % 2];
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
  it('the skirt skins by nearness: its weights sum to one, the cloth over a leg follows that leg, over the seat the pelvis, below it the cloth between them hangs from both thighs', () => {
    const { recipe } = wear({ cast: 'female', outfit: build('sundress', { language: { bottom: { leg: 'midi' } } }) });
    const B = recipe.parts.skirt_skirt.bind.blend;
    for (const [k, w] of Object.entries(B)) expect(Object.values(w).reduce((a, b) => a + b, 0), k).toBeCloseTo(1, 9);
    expect(B['st9.sideR'].thighR ?? 0).toBeGreaterThan(B['st9.sideR'].pelvis ?? 0);
    expect((B['st9.back'].thighR ?? 0) + (B['st9.back'].thighL ?? 0)).toBeGreaterThan(B['st9.back'].pelvis ?? 0);   // a hip hinge never swings it into the legs
    expect(B['st9.back'].thighR).toBeCloseTo(B['st9.back'].thighL, 6);   // between them: evenly
    expect(B['st2.back'].pelvis ?? 0).toBeGreaterThan(0.9);   // over the seat it goes back with the pelvis
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

describe('the outer layer, fit by zone, and the detail on the garment\'s roles', () => {
  const ctx = { have: STRUCT, scale: 1 };
  const coat = { type: 'outfit', style: { id: 'x', dials: { ornament: 2 }, language: { top: { family: 'woven', sleeve: 'long', hem: 'hip', fit: 'skin' }, bottom: { family: 'woven', leg: 'long', fit: 'fitted' }, outer: { family: 'woven', sleeve: 'long', hem: 'knee', open: true }, feet: 'boots', tuck: true, focal: 'belt' } } };
  it('an outer layer over a second skin: the coat its skirt and sleeves, the undershirt paint, the trousers fitted without a hang', () => {
    const out = expandOutfit(coat, ctx), ids = out.garments.map((E) => E.id);
    expect(ids).toEqual(expect.arrayContaining(['outer', 'outerSkirt', 'outerSleeve', 'outerCuff', 'bottomLeg']));
    expect(ids).not.toContain('top');                                                    // a second skin is not cloth
    expect(out.paint.some((P) => [P.part].flat().includes('torso') && P.group === 'Top')).toBe(true);
    expect(out.garments.find((E) => E.id === 'bottomShin').flare).toBeUndefined();        // fitted: no hang at the hem
    expect(out.trace.outer).toEqual({ open: true });
  });
  it('the roles sit on the outermost layer; the detail list owns the bindings and the budget keeps the construction', () => {
    const bare = expandOutfit({ ...coat, detail: [] }, ctx);
    expect(bare.trace.roles).toEqual(expect.arrayContaining(['opening', 'hem', 'cuffs', 'waist', 'yoke', 'chest', 'back', 'sleeveBand', 'skirtField']));
    expect(bare.paint.filter((P) => P.group === 'Trim')).toEqual([]);                    // no bindings asked: none drawn
    expect(bare.kit.map((A) => A.id)).toContain('belt');                                  // the focal's construction stays
    const bound = expandOutfit({ ...coat, detail: [{ prim: 'binding', role: 'hem' }, { prim: 'binding', role: 'cuffs', group: 'Accent' }] }, ctx);
    expect(bound.paint).toContainEqual({ part: 'outerSkirt_skirt', u: [10.6, 11], group: 'Trim' });   // the coat's hem, not the shirt's
    expect(bound.paint).toContainEqual({ part: 'outerCuff_foreArm', run: [0.998, 1], group: 'Accent' });
    expect(bound.trace.detail).toEqual(['binding@hem', 'binding@cuffs']);
    // a role nothing worn covers is skipped with a word, never forced
    expect(expandOutfit({ ...coat, detail: [{ prim: 'binding', role: 'skirtHem' }] }, ctx).trace.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/no skirtHem/)]));
    // absent, the budget spends the bindings as before
    expect(expandOutfit(coat, ctx).paint.filter((P) => P.group === 'Trim').length).toBeGreaterThan(0);
    expect(expandOutfit(coat, ctx).trace.roles).toBeUndefined();
  });
  it('refuses a detail by name: an unknown primitive or role, a binding on a field', () => {
    expect(validateOutfitBuild({ ...coat, detail: [{ prim: 'sequins', role: 'hem' }] })[0]).toMatch(/prim: one of binding/);
    expect(validateOutfitBuild({ ...coat, detail: [{ prim: 'binding', role: 'pocket' }] })[0]).toMatch(/role: one of/);
    expect(validateOutfitBuild({ ...coat, detail: [{ prim: 'binding', role: 'chest' }] })[0]).toMatch(/sits on an edge role; 'chest' is a field/);
    expect(Object.values(GARMENT_ROLES).every((k) => ['edge', 'field'].includes(k))).toBe(true);
    expect(validateOutfitBuild({ ...coat, style: { ...coat.style, language: { ...coat.style.language, outer: { ...coat.style.language.outer, fit: 'skin' } } } })[0]).toMatch(/outer.fit/);
  });
  it('embroidery: a motif worked in thread on a role, a border on an edge and an emblem on a field, on both sleeves', () => {
    const emb = { ...coat, detail: [{ prim: 'embroidery', role: 'hem', motif: 'vine' }, { prim: 'embroidery', role: 'cuffs', motif: 'key' }, { prim: 'embroidery', role: 'chest', motif: 'star', group: 'Accent' }, { prim: 'embroidery', role: 'opening', motif: 'chevron' }] };
    expect(validateOutfitBuild(emb)).toEqual([]);
    const out = expandOutfit(emb, ctx), K = Object.fromEntries(out.kit.map((A) => [A.id, A]));
    // a ghost carrier in share windows, the thread its signature
    for (const A of out.kit.filter((A) => A.id.startsWith('emb'))) { expect(A.ghost).toBe(true); expect(A.share).toBe(true); expect(A.signature.kind).toBe('motif'); }
    expect(K.emb0hem.part).toBe('outerSkirt_skirt');
    expect([K.emb1cuffsR.part, K.emb1cuffsL.part]).toEqual(['outerCuff_foreArmR', 'outerCuff_foreArmL']);   // a limb's work on both sides
    expect(K.emb2chest.signature).toMatchObject({ mode: 'emblem', at: 'front', name: 'star', group: 'Accent' });
    expect([K.emb3openingR.side, K.emb3openingL.side]).toEqual(['R', 'L']);
    expect(validateOutfitBuild({ ...coat, detail: [{ prim: 'embroidery', role: 'hem', motif: 'paisley' }] })[0]).toMatch(/motif: one of vine/);
    expect(validateOutfitBuild({ ...coat, detail: [{ prim: 'binding', role: 'hem', motif: 'vine' }] })[0]).toMatch(/an embroidery's/);
    expect(MOTIF_NAMES).toEqual(expect.arrayContaining(['vine', 'knot', 'key', 'wave', 'chevron', 'diamond', 'dots', 'star']));
  });
  it('embroidery builds on the hero: the thread in its group, no carrier plate drawn', () => {
    const { mesh } = wear({ cast: 'female', outfit: { ...coat, detail: [{ prim: 'embroidery', role: 'hem', motif: 'wave' }, { prim: 'embroidery', role: 'back', motif: 'knot', group: 'Accent' }] } });
    expect(groupsOf(mesh).has('Accent')).toBe(true);
    expect(Object.keys(mesh.parts || {}).some((n) => /^adorn\.emb\d+hem$/.test(n))).toBe(false);
  });
});

// LAW 2 as it stands: cloth hugs and tapers; a hem falls away only where it is cut to; the flow is in panels cut to hang.
describe('law 2: the cut, the panels and the dressed silhouette', () => {
  const pieces = (lang) => expandOutfit(build('casual', { language: lang }), { have: STRUCT, scale: 1 }).garments;
  it('trousers taper by default: no hang at the hem; straight and wide fall away, wide the most; skinny lies closest', () => {
    const shin = (cut) => pieces({ bottom: { cut } }).find((E) => E.id === 'bottomShin');
    expect(shin(undefined).flare).toBeUndefined(); expect(shin('tapered').flare).toBeUndefined();
    expect(shin('wide').flare[1]).toBeGreaterThan(shin('straight').flare[1]);
    expect(shin('skinny').ease).toBeLessThan(shin('tapered').ease);
    expect(validateOutfitBuild(build('casual', { language: { bottom: { cut: 'baggy' } } }))[0]).toMatch(/bottom\.cut: 'baggy'/);
  });
  it('every copy piece keeps the body\'s ratios on a dense ring; a skirt, a shoe and a panel are their own constructions', () => {
    for (const E of expandOutfit(build('traveler'), { have: STRUCT, scale: 1 }).garments) {
      if (E.fit) { expect(E.proportional).toBeUndefined(); continue; }
      expect(E.proportional).toBeGreaterThan(0); expect(E.dense).toBe(true);
    }
  });
  it('panels: an arc per panel at its place, two tails side by side apart, the belt over their tops, a hem trim, a tone', () => {
    const X = expandOutfit(build('casual', { language: { panels: [{ at: 'back', length: 'knee', split: 2 }, { at: 'sides', length: 'mini', width: 0.3 }] } }), { have: STRUCT, scale: 1 });
    const P = X.garments.filter((E) => E.fit === 'panel'), mid = (E) => (E.around[0] + E.around[1]) / 2;
    expect(P.map((E) => E.id)).toEqual(['panel0a', 'panel0b', 'panel1R', 'panel1L']);
    expect(P[0].around[1]).toBeLessThan(P[1].around[0]);   // a gap between the tails
    expect(mid(P[2])).toBe(90); expect(mid(P[3])).toBe(270);
    expect(P.every((E) => E.rigidity === 'soft')).toBe(true);
    expect(X.kit.find((A) => A.id === 'belt').over).toEqual(expect.arrayContaining(P.map((E) => `${E.id}_panel`)));
    expect(X.paint.filter((Q) => /_panel$/.test(Q.part)).length).toBe(4); expect(X.tones.Panel).toMatch(/^#/);
    expect(validateOutfitBuild(build('casual', { language: { panels: [{ at: 'up', length: 'knee' }] } }))[0]).toMatch(/panels\[0\]\.at/);
  });
  it('the dressed silhouette: the dials\' own cut keeps the waist and the taper; a loose top and a wide leg are said, never refused', () => {
    const read = (lang) => wear({ cast: 'female', head: 'anime', outfit: build('casual', lang ? { language: lang } : {}) }).recipe;
    const fine = dressSilhouette(read({ top: { fit: 'eased' } })), loose = dressSilhouette(read({ top: { fit: 'loose' }, bottom: { cut: 'wide' } }));
    expect(fine.advice).toEqual([]); expect(fine.waist.cloth).toBeLessThan(fine.waist.body + SILHOUETTE_BANDS.waist);
    expect(Math.abs(fine.taper.cloth - fine.taper.body)).toBeLessThan(SILHOUETTE_BANDS.taper);
    expect(loose.advice.map((a) => a.split(':')[0]).sort()).toEqual(['taper', 'waist']);
    expect(dressSilhouette({ parts: {} })).toBeNull();
  });
});

describe('law 10: the drawn figure', () => {
  it('on an anime hero a top or trousers with no fit of their own lie close (knit a second skin, woven fitted); a fit word, the outer layer and a skirt keep theirs; elsewhere as before', () => {
    const X = (style, lang, drawn = 'anime') => expandOutfit(build(style, lang ? { language: lang } : {}), { have: STRUCT, scale: 1, drawn });
    expect(X('casual').trace.fits).toEqual({ top: 'skin', bottom: 'fitted' });
    expect(X('casual').garments.some((E) => E.id === 'top')).toBe(false);   // painted, no shell
    expect(X('casual', { top: { fit: 'loose' } }).trace.fits.top).toBe('loose');
    expect(X('casual', { bottom: { cut: 'wide' } }).trace.fits.bottom).toBe('eased');   // a cut to fall away keeps it
    expect(X('traveler').trace.fits.outer).toBe('fitted');   // its card's own word
    expect(X('sundress').garments.find((E) => E.id === 'skirt').fit).toBe('skirt');
    expect(X('casual', null, null)).toEqual(expandOutfit(build('casual'), { have: STRUCT, scale: 1 }));
    expect(X('casual', null, null).trace.fits).toBeUndefined();
  });
});
