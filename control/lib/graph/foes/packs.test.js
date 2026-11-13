// A kin dressed and sized (foes/packs.js): one body, many foes. The laws, each on one case chosen from the tables: a
// pack's members are dressed ALIKE whatever their rank (one cut, one colourway, one mark, one coat) and its leaders wear
// more of the same; a wild one is bare and told apart by its size; a people's own cut leaves off what its body does not
// take; the words are the hero door's own (it takes them); a skin that names neither takes none; a word it does not know
// is refused by name.
import { describe, it, expect } from 'vitest';
import { PACK_STYLES, PACK_STYLE_IDS, PACK_RANKS, WILD_SIZES, WILD_SIZE_IDS, packStylesOf, readPack, readKinBody, kinWords, packSays, bodySays } from './packs.js';
import { readPeopleSkin, peopleBody, peopleStands } from './people.js';
import { BEAST_KINS, kinCoat } from '../beast/cards.js';
import { KIN_HEADGEAR } from '../creature-heads/headgear.js';
import { LINEAGES } from '../egocube/ancestry.js';
import { validateHeroSpec } from '../../mcp/tools/layered.js';
import { withDefaultForm, withDefaultWalk } from '../polygonizer/motion-stamp.js';
import { beastWords } from '../beast/tiered.js';

// one style and the people it is cut for whole; a people with a cut of its own, where the table has one
const STYLE = PACK_STYLE_IDS[0], S = PACK_STYLES[STYLE];
const KIN = S.peoples.find((p) => !S.cuts?.[p]), CUT = S.peoples.find((p) => S.cuts?.[p]);
const [LOW, HIGH] = [Object.keys(PACK_RANKS)[0], Object.keys(PACK_RANKS).at(-1)];
// a size that moves the stature and the frame both, and the one that is the card's own
const SIZED = WILD_SIZE_IDS.find((z) => WILD_SIZES[z].stature > 1 && Object.keys(WILD_SIZES[z].frame).length), OWN = WILD_SIZE_IDS.find((z) => WILD_SIZES[z].stature === 1);

describe('a kin dressed as its pack', () => {
  it('dresses every rank alike: one cut, one colourway over one coat, one mark; its leaders wear more of the same', () => {
    const low = kinWords({ people: KIN, pack: { style: STYLE } }, { rank: LOW }), high = kinWords({ people: KIN, pack: { style: STYLE } }, { rank: HIGH });
    expect(high.outfit).toEqual(low.outfit);
    expect(high.palette).toEqual(low.palette);
    expect(low.palette.Skin).toBe(kinCoat(KIN));
    expect(low.palette).toMatchObject(S.colourways[Object.keys(S.colourways)[0]].tones);
    expect(high.stylism.motif).toBe(low.stylism.motif);
    expect({ ...high.stylism, register: 0, detail: 0 }).toEqual({ ...low.stylism, register: 0, detail: 0 });
    expect([high.stylism.register, high.stylism.detail]).not.toEqual([low.stylism.register, low.stylism.detail]);
    // (and on the head: its rank and file bare-headed, a leader in a kin's helmet where the style names one for its rank)
    expect(low.headgear).toBeUndefined();
    const helmed = Object.keys(S.head ?? {})[0];
    if (helmed) { const w = kinWords({ people: KIN, pack: { style: STYLE } }, { rank: helmed }); expect(w.headgear).toBe(S.head[helmed]); expect(KIN_HEADGEAR[w.headgear]).toBeTruthy(); }
    // (a rank the table does not name wears the rank and file's)
    expect(kinWords({ people: KIN, pack: { style: STYLE } }, {}).stylism).toEqual(low.stylism);
  });
  it('its colourway and its mark are its own words; two packs of one style differ by them alone', () => {
    const [a, b] = Object.keys(S.colourways), m = S.motifs.at(-1);
    const A = kinWords({ people: KIN, pack: { style: STYLE, colourway: a } }), B = kinWords({ people: KIN, pack: { style: STYLE, colourway: b, motif: m } });
    expect(B.outfit).toEqual(A.outfit);
    expect(B.palette).not.toEqual(A.palette);
    expect(B.stylism.motif).toBe(m);
    expect(packSays({ people: KIN, pack: { style: STYLE, colourway: b, motif: m } })).toContain(S.colourways[b].reads);
  });
  it('a people\'s own cut leaves off what its body does not take', () => {
    if (!CUT) return;
    const whole = kinWords({ people: KIN, pack: { style: STYLE } }).outfit.style.language, cut = kinWords({ people: CUT, pack: { style: STYLE } }).outfit.style.language;
    for (const part of S.cuts[CUT].without) { expect(whole[part]).toBeDefined(); expect(cut[part]).toBeUndefined(); }
    expect(Object.keys(cut).length).toBe(Object.keys(whole).length - S.cuts[CUT].without.length);
  });
  it('the words are the hero door\'s own: a kin\'s figure with them is a valid hero', () => {
    for (const people of [KIN, CUT].filter(Boolean)) {
      const words = kinWords({ people, pack: { style: STYLE }, body: { size: SIZED } }, { rank: HIGH });
      const spec = withDefaultWalk(beastWords(withDefaultForm({ form: 'tiered', cast: { pole: 'male', build: LINEAGES[people].builds[0] }, beast: { kin: people }, ...words })));
      expect(validateHeroSpec(spec)).toEqual([]);
    }
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
  it('a coat is one of its lineage\'s swatches by word, or a colour; a wild one that names none keeps its sheet\'s roll', () => {
    const [word, hex] = Object.entries(LINEAGES[KIN].cover).at(-1);
    expect(kinWords({ people: KIN, body: { coat: word } })).toEqual({ palette: { Skin: hex } });
    expect(kinWords({ people: KIN, body: { coat: '#123456' } }).palette.Skin).toBe('#123456');
    expect(kinWords({ people: KIN, pack: { style: STYLE }, body: { coat: word } }).palette.Skin).toBe(hex);
    expect(bodySays({ people: KIN, body: { coat: word, size: SIZED } })).toContain(word);
  });
  it('a skin that names neither takes no words: the figure is its sheet\'s, as before', () => {
    expect(kinWords({ people: KIN })).toBeNull();
    expect(kinWords({ people: 'human' })).toBeNull();
    expect(kinWords(undefined)).toBeNull();
    expect(packSays({ people: KIN })).toBeNull(); expect(bodySays({ people: KIN })).toBeNull();
  });
});

describe('the words read', () => {
  it('a people\'s skin carries them checked; absent, it is as it was', () => {
    expect(readPeopleSkin({ people: KIN, pack: { style: STYLE }, body: { size: SIZED } })).toEqual({ people: KIN, pack: readPack({ style: STYLE }, KIN), body: { size: SIZED } });
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
  });
});
