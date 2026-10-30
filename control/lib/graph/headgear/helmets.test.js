// helmets.test.js — the helmet library (headgear/helmets.js) worn from an outfit's `head`: its words read and refused; a
// helmet one cowl on the cranium, its skirt along its own edge, its extras (a band, a net, a night-vision mount) added to
// it; on the game body its shell baked, the hair dropped under it, nothing of it without a head; a camouflaged cover
// painted as the outfit's layers are; the realistic body leaves it off rather than refusing the mint. One card with a
// skirt and one without, chosen in code.
import { describe, it, expect } from 'vitest';
import { HELMETS, HELMET_WORDS, validateHead, headOf, helmetKit, helmetTones } from './helmets.js';
import { CAMOS, camoTone, camoFieldPaint, isCamo } from '../outfit/camouflage.js';
import { SEEDED_OUTFITS, validateOutfitCard } from '../outfit/styles.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm } from '../polygonizer/motion-stamp.js';

const SKIRTED = HELMET_WORDS.find((w) => HELMETS[w].skirt?.length), BARE = HELMET_WORDS.find((w) => !HELMETS[w].skirt?.length);
const CAMO = Object.keys(CAMOS)[0];
const card = (head) => ({ ...SEEDED_OUTFITS.fatigues, language: { ...SEEDED_OUTFITS.fatigues.language, ...(head === undefined ? {} : { head }) } });
// (the hero as the door mints it: the tiered game body unless it names a form)
const mint = (head, more = {}) => expandLayeredManifest({ kind: 'layered', hero: heroRecord(withDefaultForm({ cast: 'male', outfit: { type: 'outfit', style: card(head) }, ...more })) });
const helmetParts = (R) => Object.keys(R.parts).filter((k) => k.startsWith('adorn.helmet'));

describe('helmets', () => {
  it('reads a helmet\'s name or its words; refuses what it does not know', () => {
    expect(SKIRTED && BARE).toBeTruthy();
    for (const h of [SKIRTED, { helmet: BARE, cover: true, band: true, net: true, nvg: true }, { helmet: SKIRTED, cover: CAMO }]) expect(validateOutfitCard(card(h))).toEqual([]);
    expect(validateOutfitCard(card('tophat')).join()).toMatch(/language\.head\.helmet/);
    expect(validateHead({ helmet: BARE, cover: 'paisley' }, 'h', Object.keys(CAMOS)).join()).toMatch(/h\.cover/);
    expect(validateHead({ helmet: BARE, plume: true }).join()).toMatch(/head\.plume/);
    expect(validateHead({ helmet: BARE, nvg: 'yes' }).join()).toMatch(/head\.nvg/);
    expect(headOf({ head: BARE })).toEqual({ helmet: BARE, cover: false, band: false, net: false, nvg: false });
    // (a cover `true` takes the top's camouflage, else it is a cloth cover in the helmet's tone)
    expect(headOf({ head: { helmet: BARE, cover: true }, top: { pattern: CAMO } }, isCamo).cover).toBe(CAMO);
    expect(headOf({ head: { helmet: BARE, cover: true }, top: {} }, isCamo).cover).toBe(true);
    expect(headOf({})).toBeNull();
  });

  it('a helmet is one cowl on the cranium, its skirt along its own edge, its extras added to it', () => {
    const [A] = helmetKit(headOf({ head: SKIRTED })), sig = A.signature;
    expect(helmetKit(null)).toEqual([]);
    expect(A).toMatchObject({ id: 'helmet', part: 'cranium', group: 'Helmet' });
    expect(sig.kind).toBe('cowl');
    expect(sig.fittings.filter((F) => F.kind === 'brim').every((F) => F.edge)).toBe(true);
    const plain = helmetKit(headOf({ head: BARE }))[0].signature, all = helmetKit(headOf({ head: { helmet: BARE, band: true, net: true, nvg: true } }))[0].signature;
    expect(plain.ornaments).toBeUndefined();
    expect(all.ornaments.some((O) => O.group === 'HelmetBand')).toBe(true);
    expect(all.ornaments.some((O) => O.group === 'HelmetNet')).toBe(true);
    expect(all.fittings.filter((F) => F.kind === 'scope')).toHaveLength(2);
    expect(Object.keys(helmetTones(headOf({ head: { helmet: BARE, band: true, net: true, nvg: true } })))).toEqual(expect.arrayContaining(['Helmet', 'HelmetTrim', 'HelmetBand', 'HelmetNet', 'HelmetNvg', 'HelmetLens']));
  });

  it('on the game body: the shell baked, the hair dropped under it; without a head, neither', () => {
    const R = mint(SKIRTED).recipe, B = mint(undefined).recipe;
    expect(helmetParts(R).length).toBeGreaterThan(0);
    expect(R.palette.Helmet).toBe(HELMETS[SKIRTED].tones.Helmet);
    expect(Object.keys(R.parts).some((k) => /^hair/.test(k))).toBe(false);
    expect(helmetParts(B)).toEqual([]);
    expect(B.palette.Helmet).toBeUndefined();
    expect(Object.keys(B.parts).some((k) => /^hair/.test(k))).toBe(true);
  });

  it('a camouflaged cover: its ground the helmet\'s tone, its marks painted on the helmet with the outfit\'s', () => {
    const L = { top: { pattern: CAMO }, bottom: { pattern: CAMO }, head: { helmet: BARE, cover: true } };
    expect(camoTone(L).Helmet).toBe(CAMOS[CAMO].ground);
    const m = mint({ helmet: BARE, cover: CAMO });
    expect(m.recipe.palette.Helmet).toBe(CAMOS[CAMO].ground);
    const E = camoFieldPaint({ head: { helmet: BARE, cover: CAMO } }, m.recipe);
    expect(E.length).toBeGreaterThan(0);
    for (const e of E) { expect(e.only).toContain('Helmet'); expect(e.part.every((k) => k.startsWith('adorn.helmet') || m.recipe.parts[k].group === 'Helmet')).toBe(true); }
    expect(new Set(E.map((e) => e.chart))).toContain('top');
  });

  it('the realistic body leaves the helmet off and mints', { timeout: 300000 }, () => {
    const R = mint(SKIRTED, { form: 'realistic', face: { seed: 11, ethnicity: 'western' } }).recipe;
    expect(helmetParts(R)).toEqual([]);
  });
});
