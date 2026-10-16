import { describe, it, expect } from 'vitest';
import { rollEgocube } from './egocube.js';
import { outfitFromSheet, adornFromSheet, outfitPalette } from './outfit.js';
import { planFromSheet, CLOTHED_H } from './plan.js';
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

  it('reads the character: the cut by principles, a ruler\'s chain of office, a frontline\'s armour, the body\'s own cover', () => {
    const ruler = outfitFromSheet(rollEgocube({ seed: 3, facets: { ancestry: 'ursine' } })).outfit;
    // her station: a long coat; her fur: breeches to the knee and sleeves to the elbow; the chain of office leads
    expect(['knee', 'midi', 'maxi']).toContain(ruler.cut.language.outer.hem);
    expect(ruler.cut.language.bottom.leg).toBe('knee');
    expect(ruler.pieces.find((p) => p.kind === 'chain').role).toBe('focal');
    expect(ruler.pieces.filter((p) => ['pack', 'satchel'].includes(p.kind)).length).toBeLessThanOrEqual(1);
    const front = outfitFromSheet(rollEgocube({ seed: 1, facets: { ancestry: 'ursine', role: 'frontline', archetype: 'hero' } })).outfit;
    expect(front.pieces.map((p) => p.kind)).toEqual(expect.arrayContaining(['pauldron', 'bracers']));
    expect(front.pieces.find((p) => p.kind === 'pauldron').shoulder).toBeGreaterThan(1);   // the wedge's broad shoulder line
    // a tail that reads: no skirt, and the outer layer stops at the hip
    const wolf = outfitFromSheet(rollEgocube({ seed: 3, facets: { ancestry: 'lupine', archetype: 'ruler' } })).outfit;
    expect(wolf.cut.language.bottom.kind).not.toBe('skirt');
    expect(['waist', 'hip']).toContain(wolf.cut.language.outer.hem);
    // chitin is the ground: no shirt, a kilt; feathered wings: no sleeves; fit by zone, tight against full
    const bug = outfitFromSheet(rollEgocube({ seed: 1, facets: { ancestry: 'insectoid' } })).outfit.cut.language;
    expect(bug.top).toBe(false); expect(bug.bottom.kind).toBe('skirt');
    const bird = outfitFromSheet(rollEgocube({ seed: 1, facets: { ancestry: 'avian' } })).outfit.cut.language;
    expect(bird.top.sleeve).toBe('none'); expect(bird.top.fit).toBe('skin');
    expect([bird.top.fit, bird.bottom.fit, bird.outer?.fit]).toEqual(expect.arrayContaining(['fitted']));
  });

  it('the palette steps: garment, secondary, trim and accent each a clear value from the others and from the coat', () => {
    for (const a of LINEAGES) for (let seed = 1; seed <= 4; seed++) {
      const sheet = rollEgocube({ seed, facets: { ancestry: a } }), P = outfitPalette(sheet, sheet.ancestry.colours.Skin), L = (h) => hexLch(h)[0];
      expect(Math.abs(L(P.base) - L(sheet.ancestry.colours.Skin))).toBeGreaterThanOrEqual(15);
      for (const [x, y] of [['base', 'secondary'], ['base', 'trim'], ['base', 'accent'], ['secondary', 'trim']]) expect(Math.abs(L(P[x]) - L(P[y]))).toBeGreaterThanOrEqual(15);
    }
  });

  it('a beast is adorned, not clothed: its frame shows, the laws hold, and the frame offers its own places', () => {
    const CLOTH = ['gown', 'robe', 'tunic', 'mantle', 'cloak', 'collar', 'sash'];
    const sets = new Set();
    for (const a of LINEAGES) for (let seed = 1; seed <= 8; seed++) {
      const sheet = rollEgocube({ seed, facets: { ancestry: a } }); if (sheet.ancestry.door !== 'creature') continue;
      const { outfit, laws } = adornFromSheet(sheet);
      expect(laws.filter((l) => !l.ok).map((l) => `${a} ${seed}: ${l.law}: ${l.why}`)).toEqual([]);
      expect(outfit.cut).toBeUndefined();
      expect(outfit.pieces.filter((p) => CLOTH.includes(p.kind))).toEqual([]);
      expect(laws.find((l) => l.law === 'the frame shows').ok).toBe(true);
      sets.add(outfit.pieces.map((p) => p.kind).sort().join('+'));
    }
    expect(sets.size).toBeGreaterThan(15);
    // the bird's scaled shins banded on the tarsus; chitin strapped between its plates; a planned beast is adorned
    expect(adornFromSheet(rollEgocube({ seed: 2, facets: { ancestry: 'avian' } })).outfit.pieces.map((p) => p.kind)).toContain('anklets');
    expect(adornFromSheet(rollEgocube({ seed: 2, facets: { ancestry: 'insectoid' } })).outfit.pieces.map((p) => p.kind)).toContain('harness');
    // the door adorns a people near the beast, and clothes one with enough of a person in it, from the cut
    const at = (humanity) => planFromSheet(rollEgocube({ seed: 1, facets: { ancestry: 'draconic', humanity } }), { dress: 'designed' }).create.spec.plan;
    const beast = at(CLOTHED_H - 0.05), kin = at(CLOTHED_H + 0.2);
    expect(beast.outfit.cut).toBeUndefined();
    expect(kin.outfit.cut.language).toBeTruthy();
    for (const plan of [beast, kin]) expect(() => expandPlan(compileOutfit(plan))).not.toThrow();
    // cloth carries the mass beneath it: no muscle swell on a part a garment lies over (it would push the skin through)
    const clothed = compileOutfit(kin), parts = new Set(clothed.garments.flatMap((g) => [g.part].flat()).map((n) => n.replace(/[RL]$/, '')));
    for (const V of clothed.body.volume ?? []) expect(parts.has(V[0].replace(/[RL]$/, '')), V[0]).toBe(false);
  });

  it('a cut still compiles onto a creature when an author asks: second skin painted, cloth fitted, the worn pieces over it', () => {
    const sheet = rollEgocube({ seed: 1, facets: { ancestry: 'draconic' } }), base = planFromSheet(sheet, { dress: 'designed' }).create.spec.plan;
    const plan = { ...base, outfit: outfitFromSheet(sheet).outfit }, built = compileOutfit(plan), L = plan.outfit.cut.language;
    expect(plan.style.drawn).toEqual({ markings: { pattern: 'both', ventral: 'panel' } });
    expect(plan.adorn).toEqual([]);
    const ids = built.garments.map((g) => g.id);
    expect(ids).toEqual(expect.arrayContaining(['outer', 'bottomSeat', 'bottomLeg']));
    // the hero's shank is the creature's shin, and its pelvis windows are carried across by share
    expect(built.garments.some((g) => [g.part].flat().includes('shank'))).toBe(false);
    for (const g of built.garments) if ([g.part].flat()[0] === 'pelvis' && g.u) expect(Math.max(...g.u)).toBeLessThanOrEqual(plan.segments.find((x) => x.name === 'pelvis').stations.length - 1);
    // a second-skin undershirt is paint, not cloth
    if (L.top?.fit === 'skin') { expect(ids).not.toContain('top'); expect(built.paint.some((P) => [P.part].flat().includes('torso') && P.group === 'Top')).toBe(true); }
    expect(built.palette.Outer).toBe(plan.outfit.intent.palette[plan.outfit.cut.colours.Outer]);
    expect(() => expandPlan(built)).not.toThrow();
    // the catalogue's tailored gown still compiles: a bodice on rounded proportional rings, and a skirt that is the garment
    // kernel's hull round the hips and the legs, its hem riding the thighs
    const gown = compileOutfit({ ...plan, outfit: { intent: plan.outfit.intent, pieces: [{ kind: 'gown', why: 'x' }] } });
    const bodice = gown.garments.find((g) => g.id === 'gownBodice'), skirtE = gown.garments.find((g) => g.id === 'gownSkirt');
    expect(bodice.dense && bodice.proportional > 0).toBe(true);
    expect(skirtE.fit).toBe('skirt');
    const skirt = expandPlan(gown).parts.gownSkirt_skirt, hemRing = skirt.stations.findIndex((st, i, S) => i > 0 && Object.values(st.points)[0][2] > Object.values(S[i - 1].points)[0][2]) - 1;
    expect(Object.entries(skirt.bind.blend).some(([k, w]) => k.startsWith(`st${hemRing}.`) && w.thighR > 0)).toBe(true);
    // the detail list rides the cut onto the creature: a binding on the hem lands on the outermost hem, by share
    const detailed = compileOutfit({ ...plan, outfit: { ...plan.outfit, cut: { ...plan.outfit.cut, detail: [{ prim: 'binding', role: 'hem', group: 'OutfitAccent' }] } } });
    const hem = detailed.paint.find((P) => P.group === 'OutfitAccent');
    expect(hem).toBeTruthy();
    if (/_pelvis$/.test(hem.part)) expect(Math.max(...hem.u)).toBeLessThanOrEqual(plan.segments.find((x) => x.name === 'pelvis').stations.length - 1);
    expect(detailed.paint.filter((P) => P.group === 'Trim').length).toBeLessThan(built.paint.filter((P) => P.group === 'Trim').length + 1);
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

describe("the era's kit (a modern or future world's people)", () => {
  it('a designed outfit in each era is its look\'s card, passes the visual-interest laws with one focal, its gear the look\'s', async () => {
    const { ERA_GEAR, eraLookOf, lookGear } = await import('./outfit.js');
    const { SEEDED_OUTFITS } = await import('../outfit/styles.js');
    for (const era of Object.keys(ERA_GEAR)) for (const role of ['frontline', 'support']) {
      const sheet = rollEgocube({ seed: 3, facets: { role, archetype: 'hero' }, setting: { era } }), { outfit, laws } = outfitFromSheet(sheet), look = eraLookOf(sheet);
      // a uniform is tonal by design: only the colour laws may advise against it (they advise, never refuse)
      const COLOUR_LAWS = ['three values, unequal', 'accent on the focal', 'repetition with variation'];
      expect(laws.filter((l) => !l.ok && !COLOUR_LAWS.includes(l.law)).map((l) => `${era} ${role}: ${l.law}: ${l.why}`)).toEqual([]);
      expect(outfit.pieces.filter((p) => p.role === 'focal')).toHaveLength(1);
      expect(outfit.cut.language).toEqual(SEEDED_OUTFITS[look.style].language);
      for (const g of lookGear(ERA_GEAR[era], look, role)) expect(outfit.pieces.map((p) => p.kind)).toContain(g.kind);
    }
  });
  it('its pieces compile on a hero body: the carrier front and back, the pouches at both hips, a pad over each knee', async () => {
    const { heroRecord, expandLayeredManifest } = await import('../../mcp/tools/layered.js');
    const palette = { base: '#445566', secondary: '#334433', trim: '#c0c0c0', accent: '#cc3333', leather: '#5a3b24' };
    const hero = heroRecord({ cast: 'female', outfit: { type: 'outfit', style: 'casual', dials: { ornament: 0 }, pieces: [{ kind: 'vest' }, { kind: 'pouches' }, { kind: 'kneepads' }], intent: { palette } } });
    const ids = new Set(JSON.stringify(expandLayeredManifest({ kind: 'layered', hero })).match(/"(vest|pouches|kneepad)[A-Za-z0-9]*"/g).map((x) => x.slice(1, -1)));
    for (const id of ['vestR', 'vestL', 'vestBack', 'pouchesR', 'pouchesL', 'pouchesBelt', 'kneepadR', 'kneepadL']) expect(ids).toContain(id);
    // the vest's cuts are different things: a carrier's lames, a slick plate's one, a rig's straps and pouches, no plate
    const cutIds = (cut) => new Set(JSON.stringify(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', outfit: { type: 'outfit', style: 'tactical', pieces: [{ kind: 'vest', cut }], intent: { palette } } }) })).match(/"vest[A-Za-z0-9]*"/g));
    const [carrier, slick, rig] = ['carrier', 'slick', 'rig'].map(cutIds);
    expect(carrier.has('"vestRLame1"')).toBe(true); expect(slick.has('"vestRLame1"')).toBe(false); expect(slick.has('"vestR"')).toBe(true);
    expect(rig.has('"vestR"')).toBe(false); expect(rig.has('"vestPouchR0"')).toBe(true); expect(rig.has('"vestStrapR"')).toBe(true);
  });
});
