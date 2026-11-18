import { describe, it, expect } from 'vitest';
import { TUNINGS, STREET_TUNINGS, tuningOf, roomTune } from './brawl-tunings.js';
import { GUNS, readGun } from './brawl-guns.js';
import { CROWD_TYPES } from './brawl-crowd.js';
import { playStreet } from './brawl-playthrough.js';
import { brawlYardData } from './brawl-page.js';
import { streetRoomOf, stepYard } from './brawl-practice.js';
import { streetLevel, readLevelStreet } from '../gameworld/brawl-cast.js';
import { STREET_FROM_A_SENTENCE } from '../gameworld/genre-forms.js';

// A STREET'S TUNING: one word chooses how hard it hits. The arcade card is the arcade run & gun's (one soldier, an army,
// a few lives); its numbers are held to targets by the scripted player, so the card stays what it says.
const G = { intent: { from: 'run-and-gun' }, foes: { goon: { class: 'walker' }, slinger: { class: 'hunter' }, tough: { class: 'guard', rank: 'elite' }, king: { class: 'brute', rank: 'boss' } } };
const { lives: _l, ...design } = STREET_FROM_A_SENTENCE;
const yard = (words = {}, world = G) => brawlYardData(streetLevel(world, { ...design, ...words }, {}).manifest.brawl);

describe('a street\'s tuning', () => {
  it('a card is known by its id; the measured one changes nothing in the room', () => {
    expect(STREET_TUNINGS).toEqual(expect.arrayContaining(['measured', 'arcade']));
    expect(roomTune(tuningOf('measured'))).toBeNull();
    expect(() => tuningOf('brutal')).toThrow(/tuning is one of/);
    expect(() => readLevelStreet({ ...design, tuning: 'brutal' })).toThrow(/street\.tuning/);
    // (its foe guns are dials over guns the shelf holds)
    for (const [g, over] of Object.entries(TUNINGS.arcade.foeGuns)) expect(() => readGun({ from: g, ...over }), g).not.toThrow();
  });

  it('a run & gun\'s street is the arcade\'s unless it says; a beat-em-up\'s the sim\'s own numbers', () => {
    expect(yard().tune).toEqual(roomTune(TUNINGS.arcade));
    expect(yard().stakes).toBe(TUNINGS.arcade.lives);
    expect(yard().belt.depth).toEqual([...TUNINGS.arcade.depth]);
    expect(yard({ tuning: 'measured' }).tune).toBeUndefined();
    expect(yard({ tuning: 'measured' }).stakes).toBe(3);
    const brawl = yard({}, { foes: G.foes });
    expect(brawl.tune).toBeUndefined();
    expect(brawl.belt.depth).toEqual([-2.5, 2.5]);
    // (the street's own word wins over the card's)
    expect(yard({ lives: 2 }).stakes).toBe(2);
  });

  it('the arcade card sends an army from above and out of doors; the design still says who', () => {
    const waves = yard().street.waves, plain = yard({ tuning: 'measured' }).street.waves;
    const count = (W) => W.map((w) => w.crowd.reduce((a, c) => a + c.n, 0));
    expect(count(waves)[0]).toBe(count(plain)[0] * TUNINGS.arcade.army);
    for (const w of waves) expect(w.crowd.reduce((a, c) => a + c.n, 0)).toBeLessThanOrEqual(12);
    expect(waves.map((w) => w.crowd.map((c) => c.type))).toEqual(plain.map((w) => w.crowd.map((c) => c.type)));
    expect(new Set(waves.flatMap((w) => w.crowd.map((c) => c.entrance ?? 'walk')))).toEqual(new Set(['walk', 'drop', 'door']));
  });

  it('its targets: a rifleman falls within three machine-gun rounds, a player within six of a rifle\'s', () => {
    const Y = yard(), R = streetRoomOf({ belt: Y.belt, players: Y.players.map((i) => ({ recipe: Y.roster[i].recipe })), waves: Y.street.waves, stakes: Y.stakes, range: { guns: Y.range.guns }, tune: Y.tune });
    const rifleman = R.s.bodies.find((b) => b.side === 'crowd' && String(R.ctx.guns[b.gn]?.id).startsWith('rifle'));
    expect(Math.ceil(rifleman.hp / GUNS['machine-gun'].damage)).toBeLessThanOrEqual(3);
    expect(rifleman.hp).toBeLessThan(CROWD_TYPES.rifleman.hp);
    expect(Math.ceil(R.s.bodies[0].hp / GUNS.rifle.damage)).toBeLessThanOrEqual(6);
    // (the crowd's rifle on the card: its warning shorter, its round faster)
    const rifle = R.ctx.guns.find((g) => String(g.id).startsWith('rifle'));
    expect(rifle.telegraph).toBeLessThan(GUNS.rifle.telegraph);
    expect(rifle.speed).toBeGreaterThan(GUNS.rifle.speed);
  });

  it('held by the scripted player: one basic player wins the default arcade street, taking hits, with falls to spare', () => {
    const one = playStreet(yard()), still = playStreet(yard(), { player: 'still', seconds: 60 });
    expect(one).toMatchObject({ won: true, boss: { down: true } });
    expect(one.struck).toBeGreaterThan(5);
    expect(one.falls).toBeLessThan(one.stakes);
    expect(still.won).toBe(false);
    // (the same street on the sim's own numbers is the longer fight: its soldiers take many more rounds)
    const slow = playStreet(yard({ tuning: 'measured' }));
    expect(slow.landed).toBeGreaterThan(one.landed);
  }, 120_000);

  it('ducking is a way out of a round, not a place to live: a player that only ducks and fires is still hit', () => {
    const Y = yard();
    let r = streetRoomOf({ belt: Y.belt, players: Y.players.map((i) => ({ recipe: Y.roster[i].recipe })), waves: Y.street.waves, stakes: Y.stakes, range: { guns: Y.range.guns }, tune: Y.tune });
    let struck = 0, low = 0;
    // (it walks on until a foe stands, then stays down firing the way it faces)
    for (let f = 0; f < 60 * 60 && !r.yard.over; f++) {
      const foe = r.s.bodies.some((b) => b.side === 'crowd' && !b.gone && !b.ko);
      r = stepYard(r, [foe ? { h: true, z: -1, a: true } : { x: 1 }]);
      struck += r.s.events.filter((e) => e.t === 'hit' && e.d === 0).length;
      low += r.s.shots.filter((t) => t.side === 'crowd' && !t.lob && t.y < 1000).length;
    }
    expect(low).toBeGreaterThan(0);
    expect(struck).toBeGreaterThan(0);
  }, 120_000);
});
