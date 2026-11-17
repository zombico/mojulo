// THE HERO'S KIT: movement, fighting style, ranged and special chosen apart. Each part read and refused by name; a style
// an arsenal the arsenal's own reader and lowering take; one case per procedure, chosen from the tables.
import { describe, it, expect } from 'vitest';
import { readHeroKit, kitArsenal, kitMoves, kitGrants, kitLegendOf, MOVEMENT_KITS, FIGHTING_STYLES, RANGED_KITS, HERO_KITS } from './hero-kits.js';
import { readArsenal, lowerArsenal } from './combos.js';
import { HERO_MOVES, TRAVERSAL_MOVES } from './actions.js';

describe('the hero\'s kit', () => {
  it('is a named kit, or its four parts said apart; a part it lacks is refused by name', () => {
    const name = Object.keys(HERO_KITS)[0], K = HERO_KITS[name];
    expect(readHeroKit(name)).toEqual({ movement: K.movement, style: K.style, ranged: K.ranged, special: K.special, from: name });
    // a named kit with one part changed: the same hero, fighting another way
    const other = Object.keys(FIGHTING_STYLES).find((s) => s !== K.style);
    expect(readHeroKit({ from: name, style: other })).toMatchObject({ movement: K.movement, style: other });
    // four words and no name; ranged null carries none
    expect(readHeroKit({ movement: 'flyer', style: 'bruiser', ranged: null })).toEqual({ movement: 'flyer', style: 'bruiser', ranged: null, special: 'context' });
    expect(() => readHeroKit('wizard')).toThrow(/not a named kit/);
    expect(() => readHeroKit({ movement: 'teleporter' })).toThrow(/how it gets about/);
    expect(() => readHeroKit({ style: 'fencer' })).toThrow(/how it fights/);
    expect(() => readHeroKit({ ranged: 'cannon' })).toThrow(/at range/);
    expect(() => readHeroKit({ weapon: 'sword' })).toThrow(/not part of a kit/);
  });

  it('every row points at what exists: a movement\'s moves and grants, a named kit\'s parts', () => {
    for (const M of Object.values(MOVEMENT_KITS)) { for (const m of M.moves) expect(HERO_MOVES[m]).toBeTruthy(); for (const g of M.grants) expect(TRAVERSAL_MOVES[g]).toBeTruthy(); }
    for (const id of Object.keys(HERO_KITS)) expect(() => readHeroKit(id)).not.toThrow();
  });

  it('a fighting style is ONE punch button: an arsenal of the hands, every string on the light beat, read and lowered as any kit', () => {
    // one style per shape of string: the shortest and the longest
    const byLen = Object.keys(FIGHTING_STYLES).sort((a, b) => FIGHTING_STYLES[a].weapon.combos[0].moves.length - FIGHTING_STYLES[b].weapon.combos[0].moves.length);
    for (const style of [byLen[0], byLen.at(-1)]) {
      const A = kitArsenal({ style });
      expect(() => readArsenal(A)).not.toThrow();
      expect(A.weapons).toHaveLength(1);
      for (const c of A.weapons[0].combos) expect(new Set(c.beats)).toEqual(new Set(['L']));
      expect(A.weapons[0].combos.some((c) => c.air)).toBe(true);
      expect(A.ranged).toBeUndefined();
      const low = lowerArsenal(A);
      expect(low[0].moveset).toBeTruthy();
      expect(low[0].sidearm ?? null).toBeNull();
    }
    expect(FIGHTING_STYLES[byLen[0]].weapon.combos[0].moves.length).toBeLessThan(FIGHTING_STYLES[byLen.at(-1)].weapon.combos[0].moves.length);
  });

  it('a ranged part is the arsenal\'s one sidearm, on the range button; the legend says the buttons a kit has', () => {
    const r = Object.keys(RANGED_KITS)[0], A = kitArsenal({ style: 'brawler', ranged: r });
    expect(() => readArsenal(A)).not.toThrow();
    expect(A.ranged).toHaveLength(1);
    expect(lowerArsenal(A)[0].sidearm.id).toBe(RANGED_KITS[r].sidearm.id);
    expect(kitLegendOf({ style: 'brawler', ranged: r })).toMatch(/punch.*S .*special/);
    expect(kitLegendOf({ style: 'brawler' })).toBe('click  punch · E  special');
  });

  it('a world\'s hero starts with its kit\'s movement, beside what its actions page says', () => {
    const G = (hero) => ({ characters: { hero } });
    expect(kitMoves(G({ kit: 'swinger' }))).toEqual(['wall', 'swinger']);
    expect(kitMoves(G({ kit: { movement: 'flyer' }, actions: { none: true, moves: ['wall'] } }))).toEqual(['wall']);
    expect(kitGrants(G({ kit: { movement: 'leaper' } })).map((g) => g.move)).toEqual(['high-jump', 'double-jump']);
    expect(kitMoves(G({ actions: { none: true, moves: ['wall'] } }))).toEqual(['wall']);
    expect(kitGrants(G({}))).toEqual([]);
  });
});

describe('a kit on a world', () => {
  it('makes the hero of its level: its movement on its rule, its style its moveset, its ranged its sidearm, its buttons on the legend', async () => {
    const { MEADOWMARK_HERO } = await import('./examples.js'), { readGameworld } = await import('./world.js'), { runSteps } = await import('./runner.js');
    const CITY = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2], evoke: 'neighbourhood' };
    const world = (kit) => {
      const W = { ...MEADOWMARK_HERO, levels: { downtown: { name: 'Downtown', geocity: CITY } } };
      for (const k of ['links', 'start', 'review', 'fights', 'mainQuest', 'errands', 'equipment', 'mechanics', 'arsenal', 'feel']) delete W[k];
      const { actions: _a, adornment: _d, ...hero } = W.characters.hero;
      W.characters = { ...W.characters, hero: { ...hero, kit } };
      return W;
    };
    const heroOf = (kit) => { const W = world(kit); readGameworld(W); const lv = runSteps(W, { ref: 'gw' }).find((s) => /^level-/.test(s.key)), m = lv.order.args ? lv.order.args.manifest : lv.order.manifest; return { m, r: m.entities.find((e) => e.pilotable).rule }; };
    // two kits that differ in every part: the swinger with no ranged, the blaster that flies and shoots
    const S = heroOf('swinger'), B = heroOf('blaster');
    expect(S.r).toMatchObject({ wall: true, gear: 'swinger' });
    expect(S.r.weapon).toBeUndefined();
    expect(Object.keys(S.r.weapons[0].moveset.moves)).toEqual(expect.arrayContaining(['launch']));
    expect(JSON.stringify(S.m.events)).toMatch(/click {2}punch · E {2}special/);
    expect(B.r.gear).toBeUndefined();
    expect(B.r.vayo).toBeTruthy();
    expect(B.r.weapon).toBeTruthy();
    expect(JSON.stringify(B.m.events)).toMatch(/click {2}punch · S {2}bolt · E {2}special/);
    // the same hero given another way to fight: its movement kept, its string the other style's
    const X = heroOf({ from: 'swinger', style: 'bruiser' });
    expect(X.r.gear).toBe('swinger');
    expect(Object.keys(X.r.weapons[0].moveset.moves)).not.toEqual(expect.arrayContaining(['launch']));
    // a word a kit lacks is refused where the world is read
    expect(() => readGameworld(world('wizard'))).toThrow(/not a named kit/);
  }, 120_000);
});
