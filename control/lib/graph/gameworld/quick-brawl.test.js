import { describe, it, expect } from 'vitest';
import { readQuick, brawlArenas, brawlHeroes, QUICK_GOALS, BRAWL, BRAWL_WAVES, RUNGUN_WAVES, BRAWL_STREET } from './quick.js';
import { brawlStreet, withStreetBodies } from './brawl-cast.js';
import { QUICK_GENRE } from './intent.js';
import { brawlYardData } from '../brawl/brawl-page.js';
import { practiceOf, yardOver } from '../brawl/brawl-practice.js';

// THE BRAWL DOORS: a quick game's `brawl` (a beat-em-up) and `rungun` (a run & gun) are one structure, a street and the
// crowd in waves, laid as one level on the brawl's own runtime with a game on its room (its `stakes`). What differs is
// the action and the hitting: the room is the melee yard's or the range's.
const level = (Q) => brawlArenas(readQuick(Q), { title: 'T' })[0];

describe('the brawl doors', () => {
  it('both are quick goals with a genre, and take only their own words', () => {
    for (const g of ['brawl', 'rungun']) expect(QUICK_GOALS[g]).toEqual(expect.any(String));
    expect(QUICK_GENRE).toMatchObject({ brawl: 'co-op-brawler', rungun: 'run-and-gun' });
    expect(() => readQuick({ goal: 'brawl', hero: {} })).toThrow(/a brawl takes/);
    expect(() => readQuick({ goal: 'brawl', guns: ['spread'] })).toThrow(/rungun goal/);
    expect(() => readQuick({ goal: 'rungun', armed: true })).toThrow(/beat-em-up/);
    expect(() => readQuick({ goal: 'rungun', guns: ['no-such-gun'] })).toThrow(/guns/);
    expect(() => readQuick({ goal: 'brawl', players: 5 })).toThrow(/1 to 4/);
    expect(() => readQuick({ goal: 'brawl', waves: [{ crowd: [{ type: 'nobody', n: 1 }] }] })).toThrow(/waves/);
  });

  it('one structure: the same street, contract and stakes; the room is what differs', () => {
    const b = level({ goal: 'brawl' }), g = level({ goal: 'rungun' });
    for (const L of [b, g]) {
      expect(L.id).toBe('street');
      expect(L.manifest).toMatchObject({ kind: 'stage', kit: BRAWL.kit, game: { levelRef: 'street', produces: { results: ['success', 'fail'] } } });
      expect(L.manifest.brawl.belt.screens).toHaveLength(1);
      expect(L.manifest.brawl.practice).toMatchObject({ players: [0], dummies: [], stakes: BRAWL.lives });
    }
    expect(b.manifest.rooms).toEqual(g.manifest.rooms);
    // (hand to hand: the yard's own waves; with guns: the range, its waves on it)
    expect(b.manifest.brawl.practice).toMatchObject({ waves: BRAWL_WAVES, loop: false });
    expect(b.manifest.brawl.practice.range).toBeUndefined();
    expect(g.manifest.brawl.practice.range).toMatchObject({ waves: RUNGUN_WAVES, loop: false });
    expect(g.manifest.brawl.practice.waves).toBeUndefined();
  });

  it('its words reach the level: the players, the lives, the look, the weapons, the guns, its own waves', () => {
    const mine = [{ crowd: [{ type: 'knife', n: 2 }], formation: 'pincer' }];
    const b = level({ goal: 'brawl', players: 3, lives: 5, register: 'anime', armed: true, waves: mine }).manifest.brawl;
    expect(b).toMatchObject({ register: 'anime', armed: true, practice: { players: [0, 1, 2], stakes: 5, waves: mine } });
    expect(level({ goal: 'rungun', guns: ['spread'] }).manifest.brawl.practice.range.guns).toEqual(['spread']);
  });

  it('its heroes are characters, as a fight\'s fighters are: one for each player unless its roster says', () => {
    expect(brawlHeroes(readQuick({ goal: 'brawl' }), 3)).toHaveLength(1);
    expect(brawlHeroes(readQuick({ goal: 'rungun', players: 3 }), 3)).toHaveLength(3);
    const own = brawlHeroes(readQuick({ goal: 'brawl', players: 2, roster: [{ hero: { ref: 'sk_made' } }, 'outlaw'] }), 3);
    expect(own[0].hero).toEqual({ ref: 'sk_made' });
    expect(own[1].roll).toBeDefined();
    expect(() => readQuick({ goal: 'brawl', players: 3, roster: ['outlaw'] })).toThrow(/a hero for every player/);
    expect(() => readQuick({ goal: 'brawl', roster: ['grappler'] })).toThrow(/gameworld: quick\.roster/);
    // (the roster the run made reaches the level's room: who is played is a character, drawn in its own body)
    const roster = [{ id: 'a', hero: { ref: 'sk_a' } }];
    expect(brawlArenas(readQuick({ goal: 'brawl' }), { title: 'T', roster })[0].manifest.brawl.practice.roster).toEqual(roster);
  });

  it('a street reaches the level: its screens the belt\'s, its waves and boss the room\'s; guns on a run & gun\'s', () => {
    const G = { foes: { goon: { class: 'walker', skin: { people: 'goblin' } }, king: { class: 'brute', rank: 'boss', skin: { people: 'orc' } } } };
    for (const goal of ['brawl', 'rungun']) {
      const S = brawlStreet(G, BRAWL_STREET, { gun: goal === 'rungun' });
      const cast = { street: { screens: S.screens, waves: withStreetBodies(S.waves, { goon: 1, king: 2 }) }, playable: 1 };
      const roster = [{ id: 'h', archetype: 'all-rounder' }, { id: 'goon', archetype: 'rushdown' }, { id: 'king', archetype: 'grappler' }];
      const L = brawlArenas(readQuick({ goal }), { title: 'T', roster, cast })[0].manifest;
      expect(L.brawl.belt.screens.map((sc) => [!!sc.gate, !!sc.boss])).toEqual([[false, false], [true, false], [true, false], [true, false], [true, true]]);
      expect(L.brawl.practice).toMatchObject({ playable: 1, stakes: BRAWL.lives, street: { waves: cast.street.waves } });
      expect(L.brawl.practice.waves).toBeUndefined();
      expect(!!L.brawl.practice.range).toBe(goal === 'rungun');
      // (the page reads it: its boss the roster's fighter, its street ready for the room)
      const Y = brawlYardData(L.brawl);
      expect(Y.street.waves.at(-1).boss).toMatchObject({ roster: 2 });
      expect(Y.street.waves.at(-1).boss.recipe).toBeDefined();
    }
    expect(() => readQuick({ goal: 'brawl', street: { stops: [{ wave: { grunt: 1 } }] }, waves: [{ grunt: 1 }] })).toThrow(/no `waves` beside it/);
    expect(() => readQuick({ goal: 'brawl', street: { stops: [] } })).toThrow(/gameworld: quick\.street\.stops/);
  });

  it('the page is given a game that can end: its room built from the level starts, not over', () => {
    for (const goal of ['brawl', 'rungun']) {
      const block = level({ goal }).manifest.brawl, Y = brawlYardData(block);
      expect(Y.stakes).toBe(BRAWL.lives);
      const P = block.practice;
      const room = practiceOf({ belt: Y.belt, players: Y.players.map((i) => ({ recipe: Y.roster[i].recipe, style: Y.roster[i].style })), dummies: Y.dummies, stakes: Y.stakes, ...(P.range ? { range: { guns: Y.range.guns, waves: Y.range.waves, loop: Y.range.loop } } : { waves: Y.waves, loop: Y.loop }) });
      expect(room.yard).toMatchObject({ stakes: BRAWL.lives, falls: 0, over: null });
      expect(room.yard.wave.loop).toBe(false);
      expect(!!room.yard.range).toBe(goal === 'rungun');
      expect(yardOver(room)).toBeNull();
    }
  });
});
