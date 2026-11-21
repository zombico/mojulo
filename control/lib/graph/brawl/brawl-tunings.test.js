import { describe, it, expect } from 'vitest';
import { TUNINGS, STREET_TUNINGS, HERO_TEAM, tuningOf, roomTune, seatPower } from './brawl-tunings.js';
import { ATTACK_POWER } from './brawl-powers.js';
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

// THE HEROES CARD: the superhero beat-em-up. Every seat a hero with its power (the game's hero its own attack, the rest
// the team's in seat order), an army that drops in and comes out of doors, a crowd that falls fast; held to its claim by
// the scripted hero, which presses its power when a crowd is on it.
describe('the heroes tuning', () => {
  const B = { foes: G.foes };
  const heroes = (words = {}, world = B, o = {}) => brawlYardData(streetLevel(world, { ...design, tuning: 'heroes', ...words }, o).manifest.brawl);

  it('every seat a hero with a power: the team\'s in seat order; no other card gives one', () => {
    const Y = heroes({ players: 4 });
    expect(Y.roster.slice(0, 4).map((r) => r.power?.id)).toEqual(HERO_TEAM.slice(0, 4));
    for (const r of Y.roster.slice(0, 4)) expect(r.power.colour).toMatch(/^#[0-9a-f]{6}$/);
    expect(seatPower(tuningOf('measured'), 0)).toBeNull();
    expect(yard({}, B).roster.some((r) => r.power)).toBe(false);
    // (the street's screen shows each seat's stock only where its heroes have powers)
    expect(JSON.stringify(Y.yard.spec)).toContain('powerOn');
    expect(JSON.stringify(yard({}, B).yard.spec)).not.toContain('powerOn');
    // (and its lens, the super beat's screen layer, with its sheet; a street with no powers carries neither)
    expect(Y.yard.spec.lens).toMatchObject({ use: 'lens', children: [{ use: 'strike' }] });
    expect(Y.yard.css).toContain('.moj-brawl-lens .mana-lens');
    expect(yard({}, B).yard.spec.lens).toBeUndefined();
    expect(yard({}, B).yard.css).not.toContain('mana-lens');
  });

  it('the game\'s hero throws its own actions page\'s attack, drawn in that beam', () => {
    const attack = Object.keys(ATTACK_POWER).find((b) => ATTACK_POWER[b] !== HERO_TEAM[0]);
    const world = { ...B, characters: { hero: { actions: { powers: [{ id: 'gift', verb: 'loose it', attack }] } } } };
    const M = streetLevel(world, { ...design, tuning: 'heroes' }, { heroRef: 'hero-ref' }).manifest.brawl;
    expect(M.practice.roster[0]).toMatchObject({ id: 'hero', power: { id: ATTACK_POWER[attack], beam: attack } });
  });

  it('its army: twice each one a stop names, dropping in and coming out of doors; its falls and its crowd\'s health the card\'s', () => {
    const Y = heroes(), plain = yard({ tuning: 'measured' }, B);
    const count = (W) => W.map((w) => w.crowd.reduce((a, c) => a + c.n, 0));
    expect(count(Y.street.waves)[0]).toBe(count(plain.street.waves)[0] * TUNINGS.heroes.army);
    expect(new Set(Y.street.waves.flatMap((w) => w.crowd.map((c) => c.entrance ?? 'walk')))).toEqual(new Set(TUNINGS.heroes.entrances));
    expect(Y.stakes).toBe(TUNINGS.heroes.lives);
    expect(Y.tune).toEqual(roomTune(TUNINGS.heroes));
  });

  it('a street says its seats\' own powers, designed or of the shelf; a far one is advised, a run & gun refuses them', () => {
    const mine = { kind: HERO_TEAM[1], name: 'Thunderclap', strength: 110 };
    const L = streetLevel(B, { ...design, tuning: 'heroes', players: 2, powers: [null, mine] }, {});
    const R = L.manifest.brawl.practice.roster;
    expect(R[0].power).toBe(HERO_TEAM[0]);
    expect(R[1].power).toEqual(mine);
    expect(L.laws.some((l) => l.concern === 'balance')).toBe(false);
    expect(brawlYardData(L.manifest.brawl).roster[1].power).toMatchObject({ id: HERO_TEAM[1], name: 'Thunderclap', dials: { strength: 110 } });
    // (powers on a street with no card that gives them: the seats it says alone)
    expect(streetLevel(B, { ...design, powers: [HERO_TEAM[0]] }, {}).manifest.brawl.practice.roster[0].power).toBe(HERO_TEAM[0]);
    const far = streetLevel(B, { ...design, tuning: 'heroes', powers: [{ kind: HERO_TEAM[0], strength: 200, stock: 9 }] }, {});
    expect(far.laws.find((l) => l.concern === 'balance')).toMatchObject({ holds: false });
    expect(() => readLevelStreet({ ...design, powers: [{ kind: 'telekinesis' }] })).toThrow(/powers\[0\]/);
    expect(() => readLevelStreet({ ...design, guns: true, powers: [HERO_TEAM[0]] })).toThrow(/run & gun/);
  });

  it('held by the scripted hero: one hero wins the default street alone, using its power, with falls to spare', () => {
    const Y = heroes(), one = playStreet(Y, { player: 'hero' }), still = playStreet(Y, { player: 'still', seconds: 60 });
    expect(one).toMatchObject({ won: true, boss: { down: true } });
    expect(one.powers).toBeGreaterThan(0);
    expect(one.falls).toBeLessThan(one.stakes);
    expect(still.won).toBe(false);
  }, 180_000);
});
