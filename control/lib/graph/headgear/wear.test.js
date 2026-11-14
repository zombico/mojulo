// wear.test.js — the hero door's `headgear` word (headgear/wear.js): a card's id or a helmet by tradition, read and
// refused by name (an unknown word answered with the nearest, a body the card is not fitted to, a tradition helmet with no
// outfit build to wear it); worn, the word lowered into the hero's own words and dropped, the card's colours beneath the
// operator's, a tradition helmet as the outfit's language head keeping its cover; absent, the hero itself. One card per
// family, chosen in code.
import { describe, it, expect } from 'vitest';
import { HEADGEAR, HEADGEAR_IDS, withHeadgear } from './cards.js';
import { HELMETS, HELMET_WORDS } from './helmets.js';
import { KIN_HEADGEAR_IDS } from '../creature-heads/headgear.js';
import { BEAST_KINS } from '../beast/cards.js';
import { HEADGEAR_WORDS, headgearOf, headgearErrors, wearHeadgear, headgearBody } from './wear.js';

const FAMILY_FIRSTS = [...new Set(HEADGEAR_IDS.map((id) => HEADGEAR[id].family))].map((f) => HEADGEAR_IDS.find((id) => HEADGEAR[id].family === f));
const BOTH = HEADGEAR_IDS.find((id) => headgearOf(id).fits.includes('realistic'));
const TIERED_ONLY = HEADGEAR_IDS.find((id) => !headgearOf(id).fits.includes('realistic'));
const OUTFIT = { type: 'outfit', style: 'streetwear' };

describe('headgear words', () => {
  it('every word is a card or a helmet by tradition, never both; each reads, names a family and the bodies it fits', () => {
    expect(new Set(HEADGEAR_WORDS).size).toBe(HEADGEAR_WORDS.length);
    expect(HEADGEAR_IDS.filter((id) => HELMETS[id])).toEqual([]);
    for (const w of [...FAMILY_FIRSTS, HELMET_WORDS[0]]) { const H = headgearOf(w); expect(H.reads && H.family && H.fits.includes('tiered'), w).toBe(true); }
    expect(headgearOf(HELMET_WORDS[0]).tradition).toBe(true);
    expect(headgearOf('crown')).toBe(null);
  });
  it('refuses by name: an unknown word (with the nearest), a body the card does not fit, a tradition helmet with no outfit build', () => {
    expect(headgearErrors(undefined)).toEqual([]);
    expect(headgearErrors(FAMILY_FIRSTS[0], {})).toEqual([]);
    expect(headgearErrors(`${FAMILY_FIRSTS[0]}x`)[0]).toMatch(new RegExp(`did you mean ${FAMILY_FIRSTS[0]}\\?`));
    expect(headgearErrors(7)[0]).toMatch(/a word/);
    expect(headgearErrors(TIERED_ONLY, { form: 'realistic' })[0]).toMatch(/not fitted to the realistic body \(fits: tiered\)/);
    expect(headgearErrors(BOTH, { form: 'realistic', outfit: OUTFIT })).toEqual([]);
    expect(headgearErrors(HELMET_WORDS[0], {})[0]).toMatch(/helmet by tradition, worn on an outfit build/);
    expect(headgearErrors(HELMET_WORDS[0], { outfit: OUTFIT })).toEqual([]);
    expect(headgearBody({ form: 'realistic' })).toBe('realistic'); expect(headgearBody({})).toBe('tiered');
  });
});

describe('a kin\'s headgear word', () => {
  // (a kin whose card's head is a relational skull, chosen from the cards; a kin helmet, from its table)
  const KIN = Object.keys(BEAST_KINS).find((k) => BEAST_KINS[k].head?.relational), HELM = KIN_HEADGEAR_IDS[0];
  it('is worn on a kin\'s own skull: the word rides its head\'s word, the card\'s where the hero names none, and is dropped', () => {
    const hero = { form: 'tiered', beast: { kin: KIN } };
    expect(headgearBody(hero)).toBe('kin');
    expect(headgearOf(HELM)).toMatchObject({ family: 'kin helmet', fits: ['kin'] });
    expect(headgearErrors(HELM, hero)).toEqual([]);
    const worn = wearHeadgear({ ...hero, headgear: HELM });
    expect(worn.headgear).toBeUndefined();
    expect(worn.beast).toEqual({ kin: KIN, head: { ...BEAST_KINS[KIN].head, gear: HELM } });
    // (a head word of the hero's own keeps its relations under the gear)
    const own = { relational: BEAST_KINS[KIN].head.relational, relations: { fang: 0.2 } };
    expect(wearHeadgear({ form: 'tiered', beast: { kin: KIN, head: own }, headgear: HELM }).beast.head).toEqual({ ...own, gear: HELM });
  });
  it('fits no other body, and a person\'s card does not fit a kin: each refused by name', () => {
    expect(headgearErrors(HELM, {})[0]).toMatch(/not fitted to the tiered body \(fits: kin\)/);
    expect(headgearErrors(TIERED_ONLY, { form: 'tiered', beast: { kin: KIN } })[0]).toMatch(/not fitted to the kin body/);
    expect(() => wearHeadgear({ cast: 'male', headgear: HELM })).toThrow(/not fitted/);
  });
});

describe('wearing a headgear word', () => {
  it('absent, the hero itself; worn, the card lowered as by hand and the word dropped, on the body the hero has', () => {
    const hero = { cast: 'male', form: 'tiered', hair: 'swept', outfit: OUTFIT };
    expect(wearHeadgear(hero)).toBe(hero);
    for (const id of FAMILY_FIRSTS) {
      const worn = wearHeadgear({ ...hero, headgear: id });
      expect(worn.headgear, id).toBeUndefined();
      expect(worn, id).toEqual(withHeadgear({ ...hero }, 'tiered', id));
    }
  });
  it('the card\'s colours sit beneath the operator\'s palette', () => {
    const id = FAMILY_FIRSTS.find((w) => Object.keys(wearHeadgear({ cast: 'male', outfit: OUTFIT, headgear: w }).palette || {}).length);
    const group = Object.keys(wearHeadgear({ cast: 'male', outfit: OUTFIT, headgear: id }).palette)[0];
    expect(wearHeadgear({ cast: 'male', outfit: OUTFIT, headgear: id, palette: { [group]: '#123456' } }).palette[group]).toBe('#123456');
  });
  it('a tradition helmet is the outfit\'s language head, its cover kept when the language names one', () => {
    const [a, b] = HELMET_WORDS;
    expect(wearHeadgear({ outfit: OUTFIT, headgear: a }).outfit.language.head).toBe(a);
    const covered = { ...OUTFIT, language: { head: { helmet: a, cover: true } } };
    expect(wearHeadgear({ outfit: covered, headgear: b }).outfit.language.head).toEqual({ helmet: b, cover: true });
    expect(() => wearHeadgear({ headgear: a })).toThrow(/helmet by tradition/);
  });
});
