import { describe, it, expect } from 'vitest';
import { brawlPlay, brawlCast, brawlBodies, withBodies, readBrawlWaves, BRAWL_PLAYS, brawlStreet, readStreet, withStreetBodies, STREET } from './brawl-cast.js';
import { readBelt } from '../brawl/brawl-belt.js';
import { readWaves } from '../brawl/brawl-crowd.js';
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

// THE STREET: the level design's page. A free first screen, then its stops (each held until its wave falls), then its
// boss's screen; the waves are the cast's, and what the design leaves thin is said, never refused.
describe('a brawl\'s street', () => {
  const street = { stops: [{ wave: { grunt: 2 }, name: 'the alley mouth' }, { wave: { grunt: 2, shooter: 1 }, length: 20 }], boss: { foe: 'warlord', with: { grunt: 1 }, hp: 900 } };
  it('is a free screen, a held screen a stop, and the boss\'s last: a belt and waves the street\'s sim takes', () => {
    const S = brawlStreet(G, street);
    expect(S.screens).toEqual([{ length: STREET.open }, { length: STREET.stop, gate: true }, { length: 20, gate: true }, { length: STREET.stop, boss: true }]);
    expect(S.waves.map((w) => w.screen)).toEqual([1, 2, 3]);
    expect(S.waves[0]).toMatchObject({ name: 'the alley mouth', crowd: [{ type: 'thug', n: 2, foe: 'goon' }] });
    expect(S.waves[2]).toMatchObject({ crowd: [{ type: 'thug', n: 1, foe: 'goon' }], boss: { foe: 'warlord', hp: 900 } });
    expect(S.boss).toBe('warlord');
    expect(S.foes).toEqual(['goon', 'slinger', 'warlord']);
    // (the sim reads them: its gates hold a wave each, its boss stands on the boss's screen)
    const belt = readBelt({ at: [0, 0], heading: 0, depth: [-2.5, 2.5], angle: 'classic', screens: S.screens }, 'belt');
    const page = withStreetBodies(S.waves, { goon: 1, warlord: 3 }).map((w) => (w.boss ? { ...w, boss: { ...w.boss, recipe: { id: 'w', archetype: 'grappler' } } } : w));
    expect(page[0].crowd).toEqual([{ type: 'thug', n: 2, roster: 1 }]);
    expect(page[2].boss).toMatchObject({ fighter: 3, hp: 900 });
    expect(() => readWaves(page.map(({ name: _n, ...w }) => w), belt)).not.toThrow();
  });

  it('a boss by its role; a boss with no body is stood in by a fighter, and said', () => {
    expect(brawlStreet(G, { stops: [{ wave: { grunt: 1 } }], boss: 'boss' }).boss).toBe('warlord');
    const S = brawlStreet(G, { stops: [{ wave: { grunt: 1 } }], boss: 'hound' });
    expect(S.says.some((x) => /^hound is drawn as a jointed figure/.test(x))).toBe(true);
    expect(withStreetBodies(S.waves, { goon: 1 })[1].boss).toMatchObject({ archetype: 'grappler', name: 'hound' });
  });

  it('advises, never refuses: a street with no boss, a stop that meets fewer than the one before', () => {
    const S = brawlStreet(G, { stops: [{ wave: { grunt: 3 } }, { wave: { grunt: 1 } }] });
    expect(S.boss).toBeNull();
    expect(S.screens).toHaveLength(3);
    expect(S.says).toEqual(expect.arrayContaining([expect.stringMatching(/names no boss/), expect.stringMatching(/stop 2 meets 1, fewer than the 3 before it/)]));
  });

  it('its words are checked: its stops, its lengths, its boss', () => {
    expect(() => readStreet({ stops: [] })).toThrow(/stops is where the street holds/);
    expect(() => readStreet({ stops: [{ wave: { grunt: 1 }, length: 2 }] })).toThrow(/8 to 48 m/);
    expect(() => readStreet({ stops: [{ wave: { grunt: 1 } }], boss: { hp: 5 } })).toThrow(/street\.boss is/);
    expect(() => brawlStreet(G, { stops: [{ wave: { grunt: 1 } }], boss: 'nobody' })).toThrow(/street\.boss: a role/);
  });
});
