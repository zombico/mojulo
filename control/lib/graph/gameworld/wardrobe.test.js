// THE WARDROBE (wardrobe.js): each party member in each armour its class may wear, a figure apiece: its own order with
// the armour's build laid over its words (a cast member through its cast, the hero through the hero door); none asked,
// none minted; a book's own table over the presets, null leaving an armour as cloth
import { describe, it, expect } from 'vitest';
import { WARDROBE, wardrobeOf, wardrobeLooks, lookKey } from './wardrobe.js';
import { readRpg } from '../playscape/rpg/rpg.js';
import { readBattles } from './battles.js';
import { composeGameworld, runSteps } from './index.js';

describe('the wardrobe', () => {
  it('each member\'s look for each armour its class may wear; a book\'s own over the presets', () => {
    const cfg = readRpg({ rpg: { party: [{ id: 'hero', class: 'fighter' }, { id: 'mira', class: 'mage' }] } });
    const looks = wardrobeLooks({ battles: { wardrobe: true } }, cfg).map((l) => `${l.member}:${l.item}`);
    expect(looks).toEqual(['hero:leather-armor', 'hero:chain-mail', 'mira:leather-armor']);
    expect(wardrobeLooks({ battles: {} }, cfg)).toEqual([]);
    expect(Object.keys(wardrobeOf({ battles: { wardrobe: { 'chain-mail': null } } }))).toEqual(['leather-armor']);
    expect(lookKey('hero', 'chain-mail')).toBe('hero-look-chain-mail');
    expect(lookKey('mira', 'robe')).toBe('cast-mira-look-robe');
    expect(() => readBattles({ wardrobe: { 'chain-mail': { style: 'knight' } } })).toThrow(/adorn: <an armour build/);
  });

  it('a composed round asked for it mints each look: the member\'s own order, the armour over its words', () => {
    const W = composeGameworld({ prompt: 'a jrpg where we storm the citadel', seed: 3 });
    W.battles = { ...W.battles, wardrobe: true };
    const S = runSteps(W, { ref: 'wd' }), looks = S.filter((s) => /-look-/.test(s.key));
    expect(looks.length).toBeGreaterThan(2);
    for (const L of looks) {
      const base = S.find((s) => s.key === L.key.replace(/-look-.*$/, ''));
      const item = L.key.replace(/^.*-look-/, '');
      expect(base, L.key).toBeTruthy();
      const spec = L.order.egocube ? L.order.spec : L.order.mint.spec;
      expect(spec.adorn).toEqual(WARDROBE[item].adorn);
      if (L.order.egocube) expect(L.order).toMatchObject({ egocube: base.order.egocube, member: base.order.member });
    }
    expect(runSteps({ ...W, battles: { ...W.battles, wardrobe: false } }, { ref: 'wd' }).some((s) => /-look-/.test(s.key))).toBe(false);
  });
});
