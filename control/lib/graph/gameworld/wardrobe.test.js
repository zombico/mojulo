// THE WARDROBE (wardrobe.js): each party member in each armour its class may wear, a figure apiece: its own order with
// the armour's build laid over its words (a cast member through its cast, the hero through the hero door); none asked,
// none minted; a book's own table over the presets, null leaving an armour as cloth
import { describe, it, expect } from 'vitest';
import { WARDROBE, wardrobeOf, wardrobeLooks, lookKey, wearLooks } from './wardrobe.js';
import { gameworldBibleHtml } from './bible-html.js';
import { levelRecord } from '../scene/handoff.js';
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
  }, 180000);

  it('a level wears the looks: each member\'s figure copied a look, its entity told which is which; a stand-in left be', () => {
    const M = { figures: { hero: { heroRef: 'h', clips: { idle: 'Idle' } }, foe: { library: 'x' } }, entities: [{ id: 'hero', body: { figure: 'hero' } }, { id: 'foe', body: { figure: 'foe' } }] };
    const out = wearLooks(M, { hero: { 'chain-mail': 'h-chain' }, foe: { 'chain-mail': 'f-chain' } });
    expect(out.figures['hero-look-chain-mail']).toEqual({ heroRef: 'h-chain', clips: { idle: 'Idle' } });
    expect(out.entities[0].looks).toEqual({ base: 'hero', by: { 'chain-mail': 'hero-look-chain-mail' } });
    expect(out.entities[1].looks).toBeUndefined();
    expect(wearLooks(M, null)).toBe(M);
  });

  it('the book shows what each wears, photographed where made; nothing of it without a wardrobe', () => {
    const W = composeGameworld({ prompt: 'a jrpg where we storm the citadel', seed: 3 });
    const on = gameworldBibleHtml({ ...W, battles: { ...W.battles, wardrobe: true } }, { lookPortraits: { 'hero:': { figure: 'data:own' }, 'hero:leather-armor': { figure: 'data:leather' } } });
    expect(on).toMatch(/What each wears/);
    expect(on).toMatch(/src="data:leather"/);
    expect(on).toMatch(/not made yet/);
    const off = gameworldBibleHtml(W);
    expect(off).not.toMatch(/What each wears|wd-row/);
  }, 180000);

  it('the engine handoff\'s level record carries each member\'s looks: the figure and the made body behind it', () => {
    const sketch = { ref: 'lv', manifest: { figures: { 'hero-look-chain-mail': { heroRef: 'h-chain' } } } };
    const L = levelRecord(sketch, { entities: [{ id: 'hero', transform: { pos: [0, 0, 0] }, looks: { base: 'hero', by: { 'chain-mail': 'hero-look-chain-mail' } } }, { id: 'rock', transform: { pos: [1, 0, 0] } }] });
    const hero = L.markers.find((m) => m.name === 'entity:hero'), rock = L.markers.find((m) => m.name === 'entity:rock');
    expect(hero.looks).toEqual({ 'chain-mail': { figure: 'hero-look-chain-mail', ref: 'h-chain' } });
    expect(rock.looks).toBeUndefined();
  });
});
