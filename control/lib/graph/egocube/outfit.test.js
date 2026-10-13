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

  it('compiles the cut onto the creature in layer order: second skin painted, cloth fitted, the worn pieces over it', () => {
    const sheet = rollEgocube({ seed: 1, facets: { ancestry: 'draconic' } }), call = planFromSheet(sheet, { dress: 'designed' });
    const plan = call.create.spec.plan, built = compileOutfit(plan), L = plan.outfit.cut.language;
    expect(plan.style.drawn).toBe(true);
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
    // the catalogue's tailored gown still compiles: a fitted bodice, a skirt with a flat hem riding the thighs
    const gown = compileOutfit({ ...plan, outfit: { intent: plan.outfit.intent, pieces: [{ kind: 'gown', why: 'x' }] } });
    const skirt = gown.segments.find((x) => x.name === 'gownSkirt');
    expect(gown.garments.map((g) => g.id)).toContain('gownBodice');
    expect(skirt.caps.tip[2]).toBe(skirt.stations[skirt.stations.length - 1].at[2]);
    expect(Object.keys(skirt.bind.blend).some((k) => /^st3\.sideR$/.test(k) && skirt.bind.blend[k].thighR > 0)).toBe(true);
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
