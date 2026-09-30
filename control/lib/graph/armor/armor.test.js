// armor: the laws as testable claims over the expanded kit (no hero compile here; armor-hero.test.js does that).
import { describe, expect, it } from 'vitest';

import { expandArmor, validateArmor, isArmorBuild, armorTones, ARMOR_LAWS_VERSION } from './expand.js';
import { SEEDED_ARMOR, validateArmorCard } from './styles.js';
import { PLATE_ORDER } from './plate.js';
import { LAMELLAR_ORDER } from './lamellar.js';

const CTX = { Ht: 4, Hl: 3, scale: 1 };
const kitOf = (style, dials = {}, language) => expandArmor({ type: 'armor', style, dials, ...(language ? { language } : {}) }, CTX);

describe('armor cards', () => {
  it('every seeded card is plain JSON and a valid card', () => {
    for (const [id, card] of Object.entries(SEEDED_ARMOR)) {
      expect(JSON.parse(JSON.stringify(card))).toEqual(card);
      expect(validateArmorCard(card), id).toEqual([]);
      expect(card.id).toBe(id);
    }
  });
  it('an inline card is a new direction with no code', () => {
    const card = { family: 'plate', dials: { stylize: 0.8 }, language: { pauldron: 'bell', focalSide: 'L', fnSide: 'R' }, tones: { Plate: '#303030' } };
    const { kit, trace } = expandArmor({ type: 'armor', style: card }, CTX);
    expect(trace.style).toBe('inline');
    expect(kit.some((A) => A.id === 'torso-pauldronL')).toBe(true);
    expect(kit.some((A) => A.id === 'upperArmL-skirt')).toBe(true);   // the bell's skirt, on the focal side
  });
});

describe('armor build validation', () => {
  it('names the choices', () => {
    expect(isArmorBuild({ type: 'armor' })).toBe(true);
    expect(isArmorBuild('ranger')).toBe(false);
    expect(validateArmor({ type: 'armor', style: 'knight' })).toEqual([]);
    expect(validateArmor({ type: 'armor', style: 'paladin' })[0]).toMatch(/not a sample \(knight, kuro-kon, aka, shiro, grim-scifi, fantasy-space, armored-hero\)/);
    expect(validateArmor({ type: 'armor', dials: { coverage: 2 } })[0]).toMatch(/coverage: a number 0–1/);
    expect(validateArmor({ type: 'armor', dials: { heft: 1 } })[0]).toMatch(/not a dial/);
    expect(validateArmor({ type: 'armor', dials: { ornament: 1.5 } })[0]).toMatch(/an integer 0–3/);
    expect(validateArmor({ type: 'armor', laws: 99 })[0]).toMatch(/unknown/);
    expect(validateArmor({ type: 'armor', style: 'aka', language: { crest: 'dragon' } })[0]).toMatch(/crescent, kuwagata, sun/);
    expect(() => expandArmor({ type: 'armor', style: 'paladin' }, CTX)).toThrow(/Invalid armour build/);
  });
  it('stamps the current laws when absent', () => {
    expect(kitOf('knight').trace.laws).toBe(ARMOR_LAWS_VERSION);
  });
  it('the hard-suit samples wear genre colours, not a franchise livery (the palette only: the kits are pinned)', () => {
    // armored-hero was red plate with a gold faceplate and trim; grim-scifi slate-blue plate with gold trim
    const hero = armorTones({ type: 'armor', style: 'armored-hero' }), grim = armorTones({ type: 'armor', style: 'grim-scifi' });
    expect([hero.Plate, hero.Helm, hero.Face, hero.Trim]).toEqual(['#6b7580', '#6b7580', '#c9ced3', '#d9772b']);
    expect([grim.Plate, grim.Helm, grim.Trim, grim.Lens]).toEqual(['#8c7a5b', '#8c7a5b', '#3d3a36', '#ffb238']);
  });
  it('suggests the card tones beneath the operator', () => {
    expect(armorTones({ type: 'armor', style: 'aka' }).Lacquer).toBe('#9e2621');
    expect(armorTones('ranger')).toEqual({});
  });
});

describe('the laws', () => {
  it('is deterministic: the same words give the same kit', () => {
    for (const style of Object.keys(SEEDED_ARMOR)) expect(JSON.stringify(kitOf(style))).toBe(JSON.stringify(kitOf(style)));
  });
  it('law 9 (plate): coverage grows the suit out from the focal, asymmetric until the partner arrives at 0.5', () => {
    let last = 0;
    for (const c of [0, 0.15, 0.25, 0.35, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
      const { kit, trace } = kitOf('knight', { coverage: c });
      expect(kit.length).toBeGreaterThanOrEqual(last); last = kit.length;
      expect(trace.worn[0]).toBe('pauldron:R');   // the focal piece is always first
      expect(kit.some((A) => A.id === 'torso-pauldronL')).toBe(c >= 0.5);
    }
    expect(kitOf('knight', { coverage: 0.25 }).trace.worn).toContain('vambrace:L');   // the bow arm takes the first bracer
    expect(PLATE_ORDER.map(([th]) => th)).toEqual([...PLATE_ORDER.map(([th]) => th)].sort((a, b) => a - b));
  });
  it('law 9: the partner is a lesser piece — less standoff, fewer lames, rivets for a boss', () => {
    const { kit } = kitOf('knight', { coverage: 1, stylize: 0.6 });
    const R = kit.find((A) => A.id === 'torso-pauldronR'), L = kit.find((A) => A.id === 'torso-pauldronL');
    expect(R.mugen).toBeGreaterThan(L.mugen);
    expect(R.signature.kind).toBe('facing');
    expect(L.signature.kind).toBe('studs');
    expect(kit.filter((A) => /upperArmR-lame/.test(A.id)).length).toBeGreaterThan(kit.filter((A) => /upperArmL-lame/.test(A.id)).length);
  });
  it('law 2: rows and lames get fewer as stylize rises; the focal piece grows', () => {
    const lames = (s) => kitOf('knight', { coverage: 0, stylize: s }).kit.filter((A) => /-lame\d+$/.test(A.id)).length;
    expect(lames(0)).toBeGreaterThan(lames(1));
    const rows = (s) => kitOf('aka', { stylize: s }).trace.rows;
    expect(rows(0).do).toBeGreaterThanOrEqual(rows(1).do);
    expect(rows(0).shikoro).toBeGreaterThan(rows(1).shikoro);
    const crest = (s) => kitOf('kuro-kon', { stylize: s }).kit.find((A) => A.id === 'cranium-mabizashiR').signature.w;
    expect(crest(1)).toBeGreaterThan(crest(0));
  });
  it('law 8: plate stays off the inner thigh', () => {
    const { kit } = kitOf('knight', { coverage: 1 });
    const inner = kit.find((A) => A.id === 'thighR-cuisseM'), outer = kit.find((A) => A.id === 'thighR-cuisse');
    expect(inner.t[1]).toBeLessThan(outer.t[1] / 2);
  });
  it('law 9 (lamellar): the crested kabuto is the focal and comes first; the rest follow its order', () => {
    const at0 = kitOf('aka', { coverage: 0 });
    expect(at0.trace.worn).toEqual(['kabuto']);
    expect(at0.kit.find((A) => A.id === 'cranium-mabizashiR').signature).toMatchObject({ kind: 'crest', shape: 'kuwagata' });
    expect(kitOf('aka', { coverage: 1 }).trace.worn).toEqual(LAMELLAR_ORDER.map(([, p]) => p));
  });
  it('law 12: lamellar rows are a sawtooth (never stacked); boards lay their lacing in its own group', () => {
    const { kit } = kitOf('shiro');
    for (const A of kit.filter((e) => /^torso-do\d+$/.test(e.id))) { expect(A.stack).toBe(false); expect(A.ramp).toBeGreaterThan(0); }
    const sode = kit.find((A) => A.id === 'upperArmR-sode');
    expect(sode.signature).toMatchObject({ kind: 'boards', group: 'Lacquer', cordGroup: 'Odoshi', bottom: 'jN' });
    expect(sode.pin[3]).toBe('torso');   // hung from the shoulder strap: the arm moves beneath it
  });
});
