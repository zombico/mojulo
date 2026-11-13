// A kin dressed and sized (foes/packs.js): one body, many foes, its gear never designed by hand. The laws, each on one
// case chosen from the tables: a PACK is the frame-adorned principles with what a band shares pinned, so its members
// are dressed ALIKE whoever they are (one cloth, one palette, one focal, one mark), told apart by their WORK (a class's
// role gives its gear) and their RANK (a leader keeps more of what the principles offer, and is helmed); the laws the
// principles keep still hold in the pack's colours; a WILD kin is bare and told apart by its size; the words are the
// hero door's own; a skin that names neither takes none; a word it does not know is refused by name.
import { describe, it, expect } from 'vitest';
import { PACK_STYLES, PACK_STYLE_IDS, PACK_RANKS, WILD_SIZES, WILD_SIZE_IDS, packStylesOf, readPack, readKinBody, kinWords, kinBare, packAdornment, packSheet, packSays, bodySays } from './packs.js';
import { readPeopleSkin, peopleBody, peopleStands, peopleRoll, peopleRole, peopleSeed } from './people.js';
import { FOE_CLASSES } from './index.js';
import { fitOfPeople } from './fit.js';
import { BEAST_KINS, kinCoat } from '../beast/cards.js';
import { KIN_HEADGEAR } from '../creature-heads/headgear.js';
import { LINEAGES } from '../egocube/ancestry.js';
import { rollEgocube } from '../egocube/egocube.js';
import { validateHeroSpec } from '../../mcp/tools/layered.js';
import { withDefaultForm, withDefaultWalk } from '../polygonizer/motion-stamp.js';
import { beastWords } from '../beast/tiered.js';

// one style and a people it is cut for; the lowest and the highest rank; two classes of different work the people can play
const STYLE = PACK_STYLE_IDS[0], S = PACK_STYLES[STYLE], KIN = S.peoples[0];
const [LOW, HIGH] = [Object.keys(PACK_RANKS)[0], Object.keys(PACK_RANKS).at(-1)];
const plays = (c) => fitOfPeople(c.id, { people: KIN }).ok, CLASSES = Object.values(FOE_CLASSES).filter(plays);
const FIGHTER = CLASSES.find((c) => peopleRole(c) === 'frontline'), OTHER = CLASSES.find((c) => peopleRole(c) !== 'frontline');
const PACK = { people: KIN, pack: { style: STYLE } };
// a member's sheet, as a run rolls it: its skin, its class, its own seed
const sheetOf = (skin, cls, id) => rollEgocube(peopleRoll(skin, cls, { seed: peopleSeed(3, id) }));
const kinds = (A) => A.outfit.pieces.map((p) => p.kind);
// a size that moves the stature and the frame both, and the one that is the card's own
const SIZED = WILD_SIZE_IDS.find((z) => WILD_SIZES[z].stature > 1 && Object.keys(WILD_SIZES[z].frame).length), OWN = WILD_SIZE_IDS.find((z) => WILD_SIZES[z].stature === 1);

describe('a pack: the frame-adorned principles with what a band shares pinned', () => {
  it('dresses its members alike whoever they are: two of one class and rank, each its own roll, wear the same', () => {
    const a = sheetOf(PACK, FIGHTER, 'a'), b = [1, 2, 3, 4, 5, 6].map((i) => sheetOf(PACK, FIGHTER, `b${i}`)).find((x) => x.facets.archetype !== a.facets.archetype || x.facets.order !== a.facets.order);
    expect(b, 'a second member whose own character differs').toBeTruthy();
    expect(kinWords(PACK, { rank: LOW, sheet: b })).toEqual(kinWords(PACK, { rank: LOW, sheet: a }));
    // (the pack's character in place of each one's own; its role and its body its own)
    const P = packSheet(PACK, b);
    expect(P.facets).toMatchObject({ archetype: S.archetype, order: S.order, role: b.facets.role, build: b.facets.build });
  });
  it('tells its members apart by their work: a class of another role wears that role\'s gear, in the same cloth, colours and focal rule', () => {
    const f = packAdornment(PACK, { rank: LOW, sheet: sheetOf(PACK, FIGHTER, 'f') }), o = packAdornment(PACK, { rank: LOW, sheet: sheetOf(PACK, OTHER, 'o') });
    expect(kinds(o)).not.toEqual(kinds(f));
    expect(o.outfit.intent.palette).toEqual(f.outfit.intent.palette);
    expect(o.concept.word).toBe(f.concept.word);
    const wf = kinWords(PACK, { rank: LOW, sheet: sheetOf(PACK, FIGHTER, 'f') }), wo = kinWords(PACK, { rank: LOW, sheet: sheetOf(PACK, OTHER, 'o') });
    expect(wo.outfit.style).toEqual(wf.outfit.style);
    expect(wo.palette).toEqual(wf.palette);
    // (each one focal, and every piece says why)
    for (const A of [f, o]) { expect(A.outfit.pieces.filter((p) => p.role === 'focal').length).toBe(1); expect(A.outfit.pieces.every((p) => p.why)).toBe(true); }
  });
  it('its leaders wear more of the same: every piece of the rank and file\'s kept, more beside them, and a helmet', () => {
    const sheet = sheetOf(PACK, FIGHTER, 'r'), low = packAdornment(PACK, { rank: LOW, sheet }), high = packAdornment(PACK, { rank: HIGH, sheet });
    expect(kinds(low).length).toBeLessThanOrEqual(PACK_RANKS[LOW].room);
    expect(kinds(high).length).toBeGreaterThan(kinds(low).length);
    for (const k of kinds(low)) expect(kinds(high)).toContain(k);
    const wl = kinWords(PACK, { rank: LOW, sheet }), wh = kinWords(PACK, { rank: HIGH, sheet });
    expect(wh.outfit.style).toEqual(wl.outfit.style); expect(wh.palette).toEqual(wl.palette);
    expect(wl.headgear).toBeUndefined();
    const helmed = Object.keys(S.head ?? {})[0];
    if (helmed) { const w = kinWords(PACK, { rank: helmed, sheet }); expect(w.headgear).toBe(S.head[helmed]); expect(KIN_HEADGEAR[w.headgear]).toBeTruthy(); }
    // (a rank the table does not name stands as the rank and file)
    expect(kinWords(PACK, { rank: 'no-such-rank', sheet })).toEqual(wl);
  });
  it('its colours and its mark are its own words: the pack\'s palette on every piece, its mark on its plates, one coat', () => {
    const sheet = sheetOf(PACK, FIGHTER, 'c'), [a, b] = Object.keys(S.colourways), m = S.motifs.at(-1);
    const A = packAdornment({ people: KIN, pack: { style: STYLE, colourway: a } }, { rank: HIGH, sheet }), B = packAdornment({ people: KIN, pack: { style: STYLE, colourway: b, motif: m } }, { rank: HIGH, sheet });
    expect(A.outfit.intent.palette).toEqual(S.colourways[a].roles); expect(B.outfit.intent.palette).toEqual(S.colourways[b].roles);
    expect(kinds(B)).toEqual(kinds(A));
    const plates = B.outfit.pieces.filter((p) => ['pauldron', 'chestPlate'].includes(p.kind));
    expect(plates.length).toBeGreaterThan(0); expect(plates.every((p) => p.motif === m)).toBe(true);
    const W = kinWords({ people: KIN, pack: { style: STYLE, colourway: b } }, { rank: LOW, sheet });
    expect(W.palette.Skin).toBe(kinCoat(KIN));
    expect(W.palette.Panel).toBe(S.colourways[b].roles.accent);
    expect(packSays({ people: KIN, pack: { style: STYLE, colourway: b, motif: m } })).toContain(S.colourways[b].reads);
  });
  it('keeps the principles\' laws in every colourway: a clear step of value between its roles, one focal, the frame shown', () => {
    const sheet = sheetOf(PACK, FIGHTER, 'l');
    for (const colourway of Object.keys(S.colourways)) {
      const { laws } = packAdornment({ people: KIN, pack: { style: STYLE, colourway } }, { rank: HIGH, sheet });
      expect(laws.filter((l) => !l.ok).map((l) => `${colourway}: ${l.law}: ${l.why}`)).toEqual([]);
    }
  });
  it('the words are the hero door\'s own: each people\'s figure with them is a valid hero', () => {
    for (const people of S.peoples) {
      const skin = { people, pack: { style: STYLE }, body: { size: SIZED } }, cls = Object.values(FOE_CLASSES).find((c) => fitOfPeople(c.id, { people }).ok && peopleRole(c) === 'frontline');
      const words = kinWords(skin, { rank: HIGH, sheet: sheetOf(skin, cls, 'v') });
      const spec = withDefaultWalk(beastWords(withDefaultForm({ form: 'tiered', cast: { pole: 'male', build: LINEAGES[people].builds[0] }, beast: { kin: people }, ...words })));
      expect(validateHeroSpec(spec)).toEqual([]);
    }
  });
  it('is dressed from its member\'s sheet: without one it says so', () => {
    expect(() => kinWords(PACK, { rank: LOW })).toThrow(/dressed from its member's sheet/);
  });
});

describe('wild, adorned or a pack: which a kin stands as', () => {
  it('a kin the cube would adorn stands bare where its skin names neither, the wild; adorned or in a pack it does not', () => {
    const sheet = sheetOf({ people: KIN }, FIGHTER, 'w');
    expect(kinBare({ people: KIN }, sheet)).toBe(true);
    expect(kinBare({ people: KIN, body: { size: SIZED } }, sheet)).toBe(true);
    expect(kinBare({ people: KIN, adorned: true }, sheet)).toBe(false);
    expect(kinBare(PACK, sheet)).toBe(false);
    expect(kinBare({ people: 'human' }, null)).toBe(false);
  });
  it('a kin whose card is one body is rolled at its lineage\'s one build, whatever the dice say; a skin\'s own build stands', () => {
    const one = LINEAGES[KIN].builds.length === 1 && BEAST_KINS[KIN].stands !== undefined;
    expect(one, 'the style\'s first people is a one-build kin').toBe(true);
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) expect(sheetOf({ people: KIN }, FIGHTER, id).facets.build).toBe(LINEAGES[KIN].builds[0]);
    expect(peopleRoll({ people: 'human' }, FIGHTER, { seed: 1 }).facets.build).toBeUndefined();
  });
});

describe('a kin\'s body, its own colour and size', () => {
  it('a size moves its stature and its frame over its card\'s; the card\'s own size moves the frame nowhere', () => {
    const big = kinWords({ people: KIN, body: { size: SIZED } }).tune, own = kinWords({ people: KIN, body: { size: OWN } }).tune;
    expect(big.stature / own.stature).toBeCloseTo(WILD_SIZES[SIZED].stature, 2);
    expect(Object.keys(own)).toEqual(['stature']);
    const [k, m] = Object.entries(WILD_SIZES[SIZED].frame)[0];
    expect(big[k]).toBeCloseTo((BEAST_KINS[KIN].frame[k] ?? 1) * m, 3);
    // (and the foe shelf measures it at that size)
    expect(peopleStands({ people: KIN, body: { size: SIZED } }) / peopleStands({ people: KIN })).toBeCloseTo(WILD_SIZES[SIZED].stature, 2);
    expect(peopleBody({ people: KIN, body: { size: SIZED } }).height).toBeGreaterThan(peopleBody({ people: KIN }).height);
  });
  it('a coat is one of its lineage\'s swatches by word, or a colour; a kin that names none keeps its sheet\'s roll', () => {
    const [word, hex] = Object.entries(LINEAGES[KIN].cover).at(-1), sheet = sheetOf(PACK, FIGHTER, 'k');
    expect(kinWords({ people: KIN, body: { coat: word } })).toEqual({ palette: { Skin: hex } });
    expect(kinWords({ people: KIN, body: { coat: '#123456' } }).palette.Skin).toBe('#123456');
    expect(kinWords({ people: KIN, pack: { style: STYLE }, body: { coat: word } }, { sheet }).palette.Skin).toBe(hex);
    expect(bodySays({ people: KIN, body: { coat: word, size: SIZED } })).toContain(word);
  });
  it('a skin that names neither takes no words: the figure is its sheet\'s', () => {
    expect(kinWords({ people: KIN })).toBeNull();
    expect(kinWords({ people: KIN, adorned: true })).toBeNull();
    expect(kinWords({ people: 'human' })).toBeNull();
    expect(kinWords(undefined)).toBeNull();
    expect(packSays({ people: KIN })).toBeNull(); expect(bodySays({ people: KIN })).toBeNull();
  });
});

describe('the words read', () => {
  it('a people\'s skin carries them checked; absent, it is as it was', () => {
    expect(readPeopleSkin({ people: KIN, pack: { style: STYLE }, body: { size: SIZED } })).toEqual({ people: KIN, pack: readPack({ style: STYLE }, KIN), body: { size: SIZED } });
    expect(readPeopleSkin({ people: KIN, adorned: true })).toEqual({ people: KIN, adorned: true });
    expect(readPeopleSkin({ people: KIN })).toEqual({ people: KIN });
    expect(packStylesOf(KIN)).toContain(STYLE); expect(packStylesOf('human')).toEqual([]);
  });
  it('refuses what it does not know, by name', () => {
    expect(() => readPack({ style: 'no-such-style' }, KIN)).toThrow(/no pack style 'no-such-style'/);
    expect(() => readPack({ style: STYLE, colourway: 'no-such' }, KIN)).toThrow(/colours are/);
    expect(() => readPack({ style: STYLE, motif: 'no-such' }, KIN)).toThrow(/marks are/);
    expect(() => readPack({ style: STYLE, cut: 1 }, KIN)).toThrow(/no key 'cut'/);
    expect(() => readPeopleSkin({ people: 'human', pack: { style: STYLE } })).toThrow(/cut for/);
    expect(() => readKinBody({ size: 'no-such' }, KIN)).toThrow(/\.size: one of/);
    expect(() => readKinBody({ coat: 'no-such' }, KIN)).toThrow(/\.coat: one of/);
    expect(() => readPeopleSkin({ people: 'human', body: { size: SIZED } })).toThrow(/a body's words are a kin's/);
    expect(() => readPeopleSkin({ people: 'human', adorned: true })).toThrow(/adorned: a kin's word/);
    expect(() => readPeopleSkin({ people: KIN, adorned: 1 })).toThrow(/adorned: true/);
    expect(() => readPeopleSkin({ people: KIN, adorned: true, pack: { style: STYLE } })).toThrow(/one or the other/);
  });
});
