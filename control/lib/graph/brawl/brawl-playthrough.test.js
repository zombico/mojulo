import { describe, it, expect } from 'vitest';
import { playStreet, streetSummary, PLAYERS } from './brawl-playthrough.js';
import { brawlYardData } from './brawl-page.js';
import { brawlStreet, withStreetBodies } from '../gameworld/brawl-cast.js';
import { brawlArenas, readQuick, BRAWL_STREET } from '../gameworld/quick.js';

// A STREET PLAYED: the scripted players on the room the page steps. The basic one (line up, close, press attack; on a
// run & gun line up and fire) must be able to win a street; the still one must not. What it measures is the street's
// design, so a street its basic player loses is said, never refused.
const G = { foes: { goon: { class: 'walker' }, slinger: { class: 'hunter' }, tough: { class: 'guard', rank: 'elite' }, king: { class: 'brute', rank: 'boss' } } };
const yardOf = (goal, street, words = {}) => {
  const S = brawlStreet(G, street, { gun: goal === 'rungun' });
  return brawlYardData(brawlArenas(readQuick({ goal, ...words }), { title: 'T', cast: { street: { screens: S.screens, waves: withStreetBodies(S.waves, {}) } } })[0].manifest.brawl);
};

describe('a street played', () => {
  it('the default street: one basic player wins it with falls to spare, its boss down; a still one never ends it', () => {
    const Y = yardOf('brawl', BRAWL_STREET);
    const basic = playStreet(Y, { player: 'basic' }), still = playStreet(Y, { player: 'still', seconds: 60 });
    expect(basic).toMatchObject({ outcome: 'won', won: true, stops: { cleared: 4, of: 4 }, boss: { down: true } });
    expect(basic.falls).toBeLessThan(basic.stakes);
    expect(basic.landed).toBeGreaterThan(0);
    expect(still).toMatchObject({ outcome: null, won: false, stops: { cleared: 0 }, landed: 0 });
    expect(streetSummary(basic)).toMatch(/^basic: won in [\d.]+ s \(the last wave fell\); 4 of 4 stops cleared/);
    expect(streetSummary(still)).toMatch(/the clock ran out at stop 1 of 4/);
  }, 120_000);

  it('a run & gun\'s street is won with its guns; the same play twice is the same play', () => {
    const Y = yardOf('rungun', BRAWL_STREET);
    const a = playStreet(Y), b = playStreet(Y);
    expect(a.won).toBe(true);
    expect(b).toEqual(a);
  }, 120_000);

  it('measures the design: a boss at the sim\'s own level beats one basic player, and the readout says where', () => {
    const hard = playStreet(yardOf('brawl', { ...BRAWL_STREET, boss: 'boss' }));
    expect(hard).toMatchObject({ outcome: 'lost', won: false, stops: { cleared: 3, of: 4 }, boss: { down: false } });
    expect(hard.reason).toMatch(/fell 3 times/);
    // (the same street with two at the stick is won)
    expect(playStreet(yardOf('brawl', { ...BRAWL_STREET, boss: 'boss' }, { players: 2 })).won).toBe(true);
  }, 120_000);

  it('plays a street only, by a player it knows', () => {
    expect(PLAYERS).toEqual(['basic', 'still']);
    expect(() => playStreet({})).toThrow(/plays a street/);
    expect(() => playStreet(yardOf('brawl', BRAWL_STREET), { player: 'expert' })).toThrow(/player is one of/);
  });
});
