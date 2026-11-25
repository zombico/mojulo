// fantasy.test.js — THE FANTASY WARDROBE (outfit/styles.js FANTASY_OUTFITS): each archetype a card carrying its own
// underlayer (its cut) and its designed pieces over it in the order a costume is worn (the over-garment, the girdle, the
// outer layer, what hangs over all), its values dark low and light high, its cloth named by the cloth law. The laws over
// the cards' data are read on every card (data, no mesh); the mint through the real door is one card per distinct
// procedure (an over-garment that is a designed piece with a skirt; one that is the cut's own outer layer), chosen in
// code, on each body lane.
import { describe, expect, it } from 'vitest';

import { SEEDED_OUTFITS, FANTASY_OUTFITS, validateOutfitCard } from './styles.js';
import { validateOutfitBuild } from './expand.js';
import { OUTFIT_LAWS_VERSION } from './principles.js';
import { MATERIAL_NAMES } from '../polygonizer/cloth-law.js';
import { HOOD_WORDS } from '../polygonizer/body-garment.js';
import { OUTFIT_KINDS, bodyMap, pieceChannels } from '../polygonizer/outfit-plan.js';
import { validateRig, rigNodesAt } from '../polygonizer/station-loft-rig.js';
import { HERO_LAWS_VERSION } from '../polygonizer/hero-form.js';
import { heroRecord, heroPlanOf, expandLayeredManifest } from '../../mcp/tools/layered.js';

const card = (id) => SEEDED_OUTFITS[id];
const GARMENTS = ['gown', 'robe', 'tunic', 'wizardRobe'];
// the order a costume is worn in (the research's principle 4): the cut beneath all, then these, each over the last
const RANK = { gown: 2, robe: 2, tunic: 2, wizardRobe: 2, belt: 3, sash: 3, cloak: 4, mantle: 4, bracers: 5, medallion: 5, chain: 5, satchel: 5, thighPouch: 5, quiver: 5, pack: 5 };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lightness = (h) => { const [r, g, b] = hex(h).map((c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); const y = 0.2126 * r + 0.7152 * g + 0.0722 * b; return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };
/** the cloth over the chest: a designed over-garment's colour role (its base by default), else the cut's outer layer */
const chestTone = (C) => { const G = C.pieces.find((P) => GARMENTS.includes(P.kind)); return G ? C.tones.OutfitBase : C.tones.Outer; };
const waisted = (id) => card(id).pieces.find((P) => P.kind === 'belt');

describe('the fantasy wardrobe: the laws over the cards', () => {
  it('each card is a seeded sample the door takes, its pieces catalogue words', () => {
    for (const id of FANTASY_OUTFITS) {
      expect(validateOutfitCard(card(id)), id).toEqual([]);
      expect(validateOutfitBuild({ type: 'outfit', style: id }), id).toEqual([]);
      for (const P of card(id).pieces) expect(OUTFIT_KINDS[P.kind], `${id} ${P.kind}`).toBeTruthy();
    }
  });
  it('its own underlayer and an over-garment, the layers in the order they are worn', () => {
    for (const id of FANTASY_OUTFITS) { const C = card(id), L = C.language;
      expect(L.top && L.bottom, `${id}: a shirt and legs of its own beneath`).toBeTruthy();
      expect(C.pieces.some((P) => GARMENTS.includes(P.kind)) || !!L.outer, `${id}: an over-garment`).toBe(true);
      const ranks = C.pieces.map((P) => RANK[P.kind]);
      expect(ranks.every(Number.isFinite), id).toBe(true);
      expect(ranks, `${id}: under to over`).toEqual([...ranks].sort((a, b) => a - b)); }
  });
  it('a belt at the waist, always, and the cut spends none of its own beneath the over-garment', () => {
    for (const id of FANTASY_OUTFITS) {
      expect(waisted(id), id).toMatchObject({ at: 'waist' });
      expect(waisted(id).id, `${id}: its own id, so a cut that spends a belt keeps both`).not.toBe('belt');
      expect(card(id).dials.ornament, id).toBeLessThan(2);   // (the belt edge is the budget's second tier)
    }
  });
  it('values dark low, light high: the feet darkest, the legs, then the cloth over the chest, a clear step from the feet', () => {
    for (const id of FANTASY_OUTFITS) { const T = card(id).tones, feet = lightness(T.Shoes), legs = lightness(T.Bottom), chest = lightness(chestTone(card(id)));
      expect(feet, id).toBeLessThan(legs); expect(legs, id).toBeLessThan(chest); expect(chest - feet, id).toBeGreaterThanOrEqual(20); }
  });
  it('neighbouring layers part by a value step or by their cloth', () => {
    for (const id of FANTASY_OUTFITS) { const C = card(id), step = Math.abs(lightness(C.tones.Top) - lightness(chestTone(C)));
      const G = C.pieces.find((P) => GARMENTS.includes(P.kind)), over = G ? G.material : C.language.outer?.cloth;
      expect(step >= 20 || (over !== undefined && over !== C.language.top.cloth), `${id}: the shirt against what is over it (ΔL* ${step.toFixed(1)})`).toBe(true); }
  });
  it('what each cloth piece is made of is a cloth-law material, and every hood says the hood\'s words', () => {
    for (const id of FANTASY_OUTFITS) { const C = card(id);
      expect(C.pieces.some((P) => P.material), `${id} names a material`).toBe(true);
      for (const P of C.pieces) { if (P.material !== undefined) expect(MATERIAL_NAMES, `${id} ${P.kind}`).toContain(P.material);
        if (P.hood && typeof P.hood === 'object') for (const [k, v] of Object.entries(P.hood)) expect(HOOD_WORDS[k], `${id} hood.${k}`).toContain(v); } }
  });
});

// one card per procedure, chosen in code: an over-garment that is a designed piece with a skirt, and one that is the
// cut's own outer layer
const PIECED = FANTASY_OUTFITS.find((id) => card(id).pieces.some((P) => ['robe', 'wizardRobe', 'gown'].includes(P.kind)) && card(id).pieces.some((P) => P.hood));
const OUTER = FANTASY_OUTFITS.find((id) => card(id).language.outer && card(id).pieces.some((P) => P.kind === 'mantle' || P.kind === 'cloak'));
const plan = (spec) => { const hero = heroRecord(spec); return { hero, plan: heroPlanOf(hero) }; };
/** the girdle's window on the torso against the body's own natural waist and the middle of the chest */
const atWaist = (P) => { const G = P.adorn.find((A) => A.id === 'girdle'), B = bodyMap(P), w = B.ringAt(B.torso, B.waist).s, chest = B.ringAt(B.torso, (B.waist + B.shoulder) / 2).s;
  return { G, waist: G.s[0] <= w && G.s[1] >= w, belowChest: G.s[1] < chest }; };

describe('the fantasy wardrobe on the hero door', () => {
  it('the cards chosen', () => { expect(PIECED).toBeTruthy(); expect(OUTER).toBeTruthy(); });
  it('the game body: the over-garment, its hood, the girdle at the natural waist; stamped with the laws that flow it', () => {
    for (const style of [PIECED, OUTER]) {
      const { hero, plan: P } = plan({ cast: 'male', register: 'round', outfit: { type: 'outfit', style } });
      expect(hero.outfit.laws, style).toBe(OUTFIT_LAWS_VERSION); expect(hero.laws, style).toBe(HERO_LAWS_VERSION);
      const ids = (P.garments || []).map((E) => E.id), r = atWaist(P);
      expect(r.G, `${style}: its girdle`).toBeTruthy(); expect(r.waist, `${style}: at the waist`).toBe(true); expect(r.belowChest, `${style}: never on the chest`).toBe(true);
      // the layers: the cut's shirt under the over-garment, the outer layer over it
      expect(ids.indexOf('top'), style).toBeGreaterThanOrEqual(0);
      const over = style === PIECED ? ids.findIndex((n) => /Bodice$/.test(n)) : ids.indexOf('outer'), outerAt = ids.findIndex((n) => n === 'mantle' || n === 'cloak');
      expect(over, style).toBeGreaterThan(ids.indexOf('top'));
      if (outerAt >= 0) expect(outerAt, style).toBeGreaterThan(over);
      if (style === PIECED) expect(P.garments.find((E) => E.fit === 'hood'), `${style}: the draped hood`).toMatchObject({ worn: expect.any(String), material: expect.any(String) });
    }
  });
  it('the anime body wears the same card; the realistic body wears what it can, the girdle among it', { timeout: 120000 }, () => {
    const anime = plan({ cast: 'female', head: 'anime', outfit: { type: 'outfit', style: PIECED } }).plan;
    expect(atWaist(anime).G).toBeTruthy();
    expect((anime.garments || []).some((E) => E.fit === 'skirt' && /Skirt$/.test(E.id))).toBe(true);
    const real = plan({ cast: 'male', form: 'realistic', outfit: { type: 'outfit', style: OUTER } }).plan;
    const worn = [...(real.adorn || []), ...(real.garments || [])].map((E) => E.id);
    expect(worn).toEqual(expect.arrayContaining(['girdle', 'outer']));
  });
  it('a skirt\'s hem binding lies on its hem under outfit laws 2; laws 1 keep their band', () => {
    const bound = FANTASY_OUTFITS.find((id) => card(id).pieces.some((P) => ['robe', 'gown', 'tunic', 'wizardRobe'].includes(P.kind) && P.trim?.hem === 'binding'));
    const kind = card(bound).pieces.find((P) => P.trim?.hem === 'binding').kind;
    const band = (laws) => plan({ cast: 'male', register: 'round', outfit: { type: 'outfit', style: bound, ...(laws ? { laws } : {}) } }).plan.paint.find((Q) => Q.part === `${kind}Skirt_skirt`);
    expect(band()).toMatchObject({ u: [10.4, 11] });
    expect(band(1)).toMatchObject({ run: [0.94, 1] });
  });
  it('deterministic: the same card minted twice is the same recipe', () => {
    const m = () => JSON.stringify(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'female', register: 'lowpoly', outfit: { type: 'outfit', style: PIECED } }) }).recipe);
    expect(m()).toBe(m());
  });
});

// the fantasy headgear (headgear/cards.js): the circlet an eyegear cast that keeps the hair, a hat a helmet shell that
// drops it; one of each builder, chosen in code by family, worn through the door's word on the game body
describe('the fantasy headgear', () => {
  it('a circlet keeps the hair, a hat drops it and carries its brim; on the realistic body each is built over the hair', async () => {
    const { HEADGEAR, HEADGEAR_IDS } = await import('../headgear/cards.js');
    const { wearHeadgear, headgearErrors } = await import('../headgear/wear.js');
    const circlet = HEADGEAR_IDS.find((id) => HEADGEAR[id].family === 'crown'), hat = HEADGEAR_IDS.find((id) => HEADGEAR[id].family === 'hat');
    const spec = { cast: 'male', register: 'round', hair: 'crop', outfit: { type: 'outfit', style: 'peasant' } };
    const c = wearHeadgear({ ...spec, headgear: circlet }), h = wearHeadgear({ ...spec, headgear: hat });
    expect(c.hair).toBe('crop'); expect(c.adorn.map((A) => A.id)).toContain('circlet');
    expect(h.hair).toBe('none'); expect(h.adorn[0].signature.fittings.some((F) => F.kind === 'brim')).toBe(true);
    // (the realistic body: the card lowers to the headwear word, headgear/realistic.js, and the hair is kept)
    expect(headgearErrors(hat, { ...spec, form: 'realistic' })).toEqual([]);
    const r = wearHeadgear({ ...spec, form: 'realistic', headgear: hat }); expect(r.headwear).toBe(hat); expect(r.hair).toBe('crop');
    expect(heroPlanOf(heroRecord({ ...spec, headgear: hat })).adorn.some((A) => A.id === 'helmet')).toBe(true);
  });
});

// RAGS (outfit-plan.js `rags`): torn strips draped from the hips, and with `shoulders` from the arms' tops, each a ribbon
// laid over what lies beneath, no two alike, torn at its end
describe('rags hung off what is worn', () => {
  it('drapes its strips from the hips and the shoulders, each its own length, width and torn end', () => {
    const style = { id: 'rags-only', dials: { stylize: 0.4, fit: 0.4, coverage: 1, ornament: 1 }, language: { top: false, bottom: false, focal: 'collar' }, pieces: [{ kind: 'rags', count: 6, len: 0.5, shoulders: true }] };
    const { plan: P } = plan({ cast: 'male', register: 'round', adorn: { type: 'armor', style: 'knight', without: ['pauldron'] }, outfit: { type: 'outfit', style } });
    const rags = (P.adorn || []).filter((A) => /^rag/.test(A.id));
    expect(rags.filter((A) => A.part === 'pelvis')).toHaveLength(6);
    expect(rags.filter((A) => /^upperArm/.test(A.part))).toHaveLength(2);
    for (const A of rags) { expect(A.signature.kind).toBe('ribbon'); expect(A.signature.drape.len).toBeGreaterThan(0); }
    const S = rags.map((A) => A.signature);
    expect(new Set(S.map((x) => x.drape.len)).size).toBeGreaterThan(2);
    expect(new Set(S.map((x) => x.tip))).toEqual(new Set(['point', 'swallow']));
    expect(plan({ cast: 'male', register: 'round', adorn: { type: 'armor', style: 'knight', without: ['pauldron'] }, outfit: { type: 'outfit', style } }).plan).toEqual(P);
  });
});

// WINGS (outfit-plan.js `wings`): a pair of membrane wings off the shoulder blades, each a board of level slices sweeping
// up and out, an arm of bone up its leading edge and two fingers across it; swept back, they lie along the body
describe('wings', () => {
  const style = (sweep) => ({ id: 'wings-only', dials: { stylize: 0.4, fit: 0.4, coverage: 1, ornament: 1 }, language: { top: false, bottom: false, focal: 'collar' }, pieces: [{ kind: 'wings', span: 1, rise: 0.9, sweep }] });
  const wingsOf = (sweep, more = {}) => (plan({ cast: 'male', register: 'round', ...more, outfit: { type: 'outfit', style: style(sweep) } }).plan.segments || []).filter((g) => /^wing/.test(g.name));
  it('a pair, each its membrane, its arm and two fingers; swept back, its slices lie along the body', () => {
    const spread = wingsOf(0), swept = wingsOf(0.8);
    expect(spread.map((g) => g.name).sort()).toEqual(['wingFinger0L', 'wingFinger0R', 'wingFinger1L', 'wingFinger1R', 'wingL', 'wingR', 'wingSparL', 'wingSparR']);
    const R = (W) => W.find((g) => g.name === 'wingR'), top = (g) => g.stations[g.stations.length - 1];
    // (the wing rises over the shoulders, and its right one on the right)
    expect(top(R(spread)).at[2]).toBeGreaterThan(R(spread).stations[0].at[2] + 0.5);
    expect(top(R(spread)).at[0]).toBeGreaterThan(0.5);
    // (spread: wide across, thin along; swept: thin across, wide along, and back along the body)
    const mid = (g) => g.stations[2].r;
    expect(mid(R(spread))[0]).toBeGreaterThan(mid(R(spread))[1]);
    expect(mid(R(swept))[1]).toBeGreaterThan(mid(R(swept))[0]);
    expect(top(R(swept)).at[1]).toBeLessThan(top(R(spread)).at[1] - 0.3);
    expect(top(R(swept)).at[0]).toBeLessThan(top(R(spread)).at[0]);
    // (on a beast's body as on a person's: a dragon on two legs)
    expect(wingsOf(0.8, { head: 'none', beast: { kin: 'draconic', legs: 'digitigrade', head: 'dragon', tail: 'thick' } })).toHaveLength(8);
  });
  it('each wing on a bone of its own riding the trunk, beaten by its channel: raised high, beaten down and back', () => {
    const { hero } = plan({ cast: 'male', register: 'round', outfit: { type: 'outfit', style: style(0.8) } }), R = validateRig(expandLayeredManifest({ hero }).recipe.rig);
    for (const g of wingsOf(0.8)) expect(g.bind.bone).toBe(`wingBone${g.name.slice(-1)}`);
    expect(pieceChannels(style(0.8).pieces)).toEqual(['wingR', 'wingL']);
    expect(Object.keys(R.chains)).toEqual(expect.arrayContaining(['wingR', 'wingL']));
    const tip = (pose) => rigNodesAt(R, pose).nodes.wingTipR, rest = tip({}), up = tip({ wingR: -40 }), down = tip({ wingR: 45 });
    // (raised: the tip over the shoulder, higher and forward; beaten: low behind; the root where it was, the other wing still)
    expect(up[2]).toBeGreaterThan(rest[2] - 0.05); expect(up[1]).toBeGreaterThan(rest[1] + 0.3);
    expect(down[2]).toBeLessThan(rest[2] - 0.5); expect(down[1]).toBeLessThan(rest[1]);
    expect(rigNodesAt(R, { wingR: 45 }).nodes.wingRootR).toEqual(rigNodesAt(R, {}).nodes.wingRootR);
    expect(rigNodesAt(R, { wingR: 45 }).nodes.wingTipL).toEqual(rigNodesAt(R, {}).nodes.wingTipL);
  });
});

// CORSET (outfit-plan.js `corset`): a stiff band from the natural waist up under the bust, laced up the back, skulls set
// down the lacing (`skulls`), the topmost horned
describe('corset', () => {
  const style = (more = {}) => ({ id: 'corset-only', dials: { stylize: 0.4, fit: 0.4, coverage: 1, ornament: 1 }, language: { top: false, bottom: false, focal: 'collar' }, pieces: [{ kind: 'corset', ...more }] });
  const adornOf = (more) => (plan({ cast: 'female', register: 'round', outfit: { type: 'outfit', style: style(more) } }).plan.adorn || []).filter((A) => /^corset/.test(A.id));
  it('a band round the trunk, its lacing and its skulls on the back\'s middle line, as many as it asks', () => {
    const A = adornOf({});
    expect(A.find((x) => x.id === 'corset').t).toBe('wrap');
    const skulls = A.filter((x) => /Skull/.test(x.id));
    expect(skulls).toHaveLength(3);
    for (const k of skulls) { expect(k.share).toBe(true); expect(k.t[0]).toBeGreaterThan(0.9); expect(k.signature.kind).toBe('skull'); expect(k.signature.dir[1]).toBeLessThan(0); }
    // (down the back, the topmost horned, the rest not)
    expect(skulls.map((k) => k.s[0])).toEqual([...skulls.map((k) => k.s[0])].sort((a, b) => a - b));
    expect(skulls.map((k) => k.signature.horns)).toEqual([0, 0, 2]);
    expect(adornOf({ skulls: 0 }).filter((x) => /Skull/.test(x.id))).toHaveLength(0);
  });
});
