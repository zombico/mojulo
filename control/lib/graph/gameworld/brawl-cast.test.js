import { describe, it, expect } from 'vitest';
import { brawlPlay, brawlCast, brawlBodies, withBodies, readBrawlWaves, BRAWL_PLAYS } from './brawl-cast.js';
import { FOE_CLASSES } from '../foes/index.js';
import { CROWD_TYPES } from '../brawl/brawl-crowd.js';
import { practiceOf } from '../brawl/brawl-practice.js';
import { brawlPreset } from '../brawl/brawl-levels.js';
import { brawlYardData } from '../brawl/brawl-page.js';
import { solveFighter } from '../versus/versus-solver.js';

// A BRAWL'S CAST: the street's crowd is the game's own bestiary. A wave is written by role or foe id; each foe fights
// as what it is (its class a crowd type, its rank over it); a foe skinned as a person is drawn in its own body.
const G = { foes: {
  goon: { class: 'walker', skin: { people: 'goblin' } },
  slinger: { class: 'hunter', skin: { people: 'goblin' } },
  hound: { class: 'charger' },
  warlord: { class: 'brute', rank: 'boss', skin: { people: 'orc' } },
} };

describe('a brawl\'s cast', () => {
  it('every foe class has a play, and each is a crowd type the street knows', () => {
    for (const c of Object.keys(FOE_CLASSES)) expect(CROWD_TYPES[BRAWL_PLAYS[c]], c).toBeDefined();
  });

  it('a foe fights as what it is: its class, its rank over it; on a run & gun everyone carries a gun', () => {
    expect(brawlPlay(G.foes.goon)).toBe('thug');
    expect(brawlPlay({ class: 'walker', rank: 'elite' })).toBe('charger');
    expect(brawlPlay(G.foes.warlord)).toBe('heavy');
    expect(brawlPlay(G.foes.slinger)).toBe('gunner');
    for (const e of Object.values(G.foes)) expect(CROWD_TYPES[brawlPlay(e, { gun: true })].gun, e.class).toBeDefined();
    expect(brawlPlay(G.foes.warlord, { gun: true })).toBe('bazooka');
  });

  it('waves are written by role or by foe id, read against the bestiary; a word it does not hold is refused', () => {
    const C = brawlCast(G, [{ grunt: 2 }, { foes: { hound: 1, shooter: 1 }, formation: 'pincer', name: 'the yard' }, { boss: 1 }]);
    expect(C.foes).toEqual(['goon', 'hound', 'slinger', 'warlord']);
    expect(C.waves[0].crowd).toEqual([{ type: 'thug', n: 2, foe: 'goon' }]);
    expect(C.waves[1]).toMatchObject({ formation: 'pincer', name: 'the yard', crowd: [{ type: 'charger', n: 1, foe: 'hound' }, { type: 'gunner', n: 1, foe: 'slinger' }] });
    expect(C.waves[2].crowd[0]).toMatchObject({ type: 'heavy', foe: 'warlord' });
    expect(() => brawlCast(G, [{ nobody: 1 }])).toThrow(/a role .* or one of the bestiary/);
    expect(() => readBrawlWaves([{ grunt: 9 }])).toThrow(/1 to 8/);
    // (the creator's own play for a foe wins over the read)
    expect(brawlCast(G, [{ grunt: 1 }], { plays: { goon: 'knife' } }).waves[0].crowd[0].type).toBe('knife');
    expect(() => brawlCast(G, [{ grunt: 1 }], { plays: { goon: 'dragon' } })).toThrow(/plays\.goon/);
  });

  it('a person has a body on the street; a beast is said to be drawn as a figure, never dropped', () => {
    const C = brawlCast(G, [{ grunt: 1, hound: 1 }]);
    expect(brawlBodies(G, C)).toEqual({ goon: true, hound: false });
    expect(C.says).toHaveLength(1);
    expect(C.says[0]).toMatch(/^hound is drawn as a jointed figure/);
    expect(withBodies(C.waves, { goon: 2 })[0].crowd).toEqual([{ type: 'thug', n: 1, roster: 2 }, { type: 'charger', n: 1 }]);
  });

  it('the page draws a wave\'s bodies from the roster it names; a brawl with no cast is as it was', () => {
    const { belt } = brawlPreset('yard');
    const recipe = { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' };
    const room = (crowd) => practiceOf({ belt, players: [{ recipe }], dummies: [], waves: [{ crowd }], loop: false });
    expect(room([{ type: 'thug', n: 2, roster: 1 }, { type: 'heavy', n: 1 }]).yard.cast).toEqual([1, 1, null]);
    expect(room([{ type: 'thug', n: 2 }]).yard.cast).toBeUndefined();
    const block = (crowd, playable) => ({ belt, practice: { roster: [{ archetype: 'all-rounder' }, { archetype: 'grappler' }], players: [0], dummies: [], waves: [{ crowd }], ...(playable ? { playable } : {}) } });
    expect(brawlYardData(block([{ type: 'thug', n: 1, roster: 1 }], 1))).toMatchObject({ playable: 1 });
    expect(brawlYardData(block([{ type: 'thug', n: 1 }])).playable).toBeUndefined();
    expect(() => brawlYardData(block([{ type: 'thug', n: 1, roster: 5 }]))).toThrow(/the roster holds 2/);
  });
});
