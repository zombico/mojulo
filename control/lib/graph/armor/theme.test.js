// armor/theme: laws 13–16 as testable claims over the expanded kit (the hero compile is layered-armor.test.js's).
import { describe, expect, it } from 'vitest';

import { expandArmor, validateArmor, armorTones } from './expand.js';
import { THEMES, validateTheme } from '../themes/themes.js';

const CTX = { Ht: 4, Hl: 3, scale: 1 };
const suit = (theme, dials = {}, style = 'knight') => expandArmor({ type: 'armor', style, theme, dials }, CTX);
const sig = (kit, id) => kit.find((A) => A.id === id)?.signature;

describe('theme cards', () => {
  it('every theme is plain JSON and a valid card', () => {
    for (const [id, card] of Object.entries(THEMES)) {
      expect(JSON.parse(JSON.stringify(card))).toEqual(card);
      expect(validateTheme(card), id).toEqual([]);
      expect(card.id).toBe(id);
    }
  });
  it('names the choices', () => {
    expect(validateArmor({ type: 'armor', theme: 'lich' })[0]).toMatch(/not a theme \(death-knight, radiant\)/);
    expect(validateTheme({ primary: { motif: 'rose', group: 'Bone' } })[0]).toMatch(/primary.motif: one of skull, boss/);
    expect(validateTheme({ edge: { motif: 'fur', group: 'Fur', on: ['hem'] } })[0]).toMatch(/cuffs, trims/);
    expect(validateTheme({ primary: { motif: 'skull', group: 'Bone', horns: { knees: 3 } } })[0]).toMatch(/0 \| 1 \| 2/);
    expect(() => suit('lich')).toThrow(/Invalid armour build/);
  });
  it('an inline theme is a new direction with no code', () => {
    const { kit, trace } = suit({ primary: { motif: 'skull', group: 'Bone' }, tones: { Bone: '#eeeeee' } });
    expect(trace.theme.id).toBe('inline');
    expect(sig(kit, 'torso-pauldronR').kind).toBe('skull');
  });
});

describe('the theme laws', () => {
  it('is deterministic, and absent it contributes nothing', () => {
    expect(JSON.stringify(suit('death-knight'))).toBe(JSON.stringify(suit('death-knight')));
    const plain = expandArmor({ type: 'armor', style: 'knight' }, CTX);
    expect(plain.trace.theme).toBeUndefined();
    expect(plain.kit.some((A) => /helm|tabard|crest/.test(A.id))).toBe(false);
  });
  it('precedence: the style, then the theme\'s lean, then the build\'s own words', () => {
    expect(suit('death-knight').trace.dials).toMatchObject(THEMES['death-knight'].dials);
    expect(suit('death-knight', { stylize: 0.2 }).trace.dials.stylize).toBe(0.2);
    expect(suit('radiant').trace.language.pauldron).toBe('bell');
    expect(armorTones({ type: 'armor', style: 'knight', theme: 'death-knight' }).Plate).toBe(THEMES['death-knight'].tones.Plate);
    expect(suit('death-knight').emissive).toEqual(['Glow']);
  });
  it('law 14: the primary motif is full size at the focal and smaller down a fixed order, as far as the budget reaches', () => {
    const skulls = (orn) => suit('death-knight', { ornament: orn }).kit.filter((A) => A.signature.kind === 'skull');
    expect(skulls(0).map((A) => A.id)).toEqual(['torso-pauldronR']);
    for (let o = 1; o <= 3; o++) expect(skulls(o).length).toBeGreaterThan(skulls(o - 1).length);
    const { kit } = suit('death-knight');
    const r = (id) => sig(kit, id).r;
    expect(r('torso-pauldronR')).toBeGreaterThan(r('torso-ridge'));
    expect(r('torso-ridge')).toBeGreaterThan(r('torso-pauldronL'));
    expect(r('torso-pauldronL')).toBeGreaterThan(r('torso-belt'));
    expect(r('torso-belt')).toBeGreaterThan(r('thighR-poleyn'));
    expect(sig(kit, 'torso-pauldronR').socketGroup).toBe('Glow');   // law 5: the glow spends on the focal
    expect(sig(kit, 'torso-pauldronL').socketGroup).toBe('Socket');
    expect(sig(kit, 'thighR-poleyn').horns).toBe(1);
  });
  it('law 14: never every piece', () => {
    const { kit } = suit('death-knight');
    const worn = kit.filter((A) => A.mode === 'shell' && !/crest|helm/.test(A.id));
    expect(worn.filter((A) => A.signature.kind === 'skull').length).toBeLessThan(worn.length / 3);
  });
  it('law 15: the secondary motif is the field\'s line', () => {
    const { kit } = suit('death-knight');
    for (const S of ['R', 'L']) expect(sig(kit, `torso-breast${S}`)).toMatchObject({ kind: 'ribs', group: 'Bone' });
    expect(sig(suit('radiant').kit, 'torso-breastR').kind).toBe('studs');   // a theme without one leaves the field alone
  });
  it('law 16: the edge verb on the edges it names, the crest verb only on the crest line', () => {
    const { kit } = suit('death-knight');
    expect(kit.filter((A) => A.signature.kind === 'fur').map((A) => A.id).sort()).toEqual(['foreArmL-cuff', 'foreArmR-cuff']);
    const spiky = kit.filter((A) => A.signature.kind === 'spikes').map((A) => A.id);
    expect(spiky.every((id) => id.endsWith('-crest'))).toBe(true);
    expect(sig(kit, 'cranium-helm').coronet.count).toBeGreaterThan(0);
    // law 9 carried: the focal crest is grander than the partner's
    expect(sig(kit, 'torso-pauldronR-crest').len).toBeGreaterThan(sig(kit, 'torso-pauldronL-crest').len);
  });
  it('the pieces only a theme wants: a helm on plate, a tabard under a belt that carries the belt motif', () => {
    const { kit } = suit('death-knight');
    const ids = kit.map((A) => A.id);
    expect(ids.indexOf('torso-tabard')).toBeLessThan(ids.indexOf('torso-belt'));
    expect(kit.find((A) => A.id === 'torso-tabard').stack).toBe(false);
    expect(sig(kit, 'torso-belt').kind).toBe('skull');
    expect(sig(kit, 'torso-fauld').kind).toBe('studs');   // hidden by the tabard, so the belt carries the motif
    expect(sig(kit, 'cranium-helm')).toMatchObject({ kind: 'helm', visor: 'slits', visorGroup: 'Glow', faceplate: 'Socket' });
  });
  it('one family, two themes: two characters, not two palettes', () => {
    const a = suit('death-knight'), b = suit('radiant');
    const kinds = (s) => new Set(s.kit.map((A) => A.signature.kind));
    expect([...kinds(a)].filter((x) => !kinds(b).has(x)).length).toBeGreaterThanOrEqual(3);
    expect(a.trace.language.pauldron).not.toBe(b.trace.language.pauldron);
  });
});
