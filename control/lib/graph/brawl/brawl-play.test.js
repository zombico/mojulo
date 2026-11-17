import { describe, it, expect } from 'vitest';
import { PLAY_TYPES, PLAY_IDS, CRATE_GUNS, playWaves, playThings } from './brawl-play.js';
import { streetOf, stepStreet, joinStreet, readWaves, CROWD_TYPES } from './brawl-crowd.js';
import { STREET_PLAYS, readStreet } from './brawl-street.js';
import { streetRead, tallyRounds, accuracyOf, streetSession } from './brawl-street-read.js';
import { newGunReader, readGunButtons } from './brawl-gunner.js';
import { readBelt } from './brawl-belt.js';
import { THINGS, readThings } from './brawl-things.js';
import { GUNS } from './brawl-guns.js';
import { DRESS_SETTING_IDS, DRESS_SETTINGS, DRESS_SETS, DRESS_PIECES, dressCover, settingCover, coverModels, coverPiece, dressSets } from './brawl-dress.js';
import { solveFighter } from '../versus/versus-solver.js';

// a short map: an open screen, a held one, the boss's
const belt = readBelt({ at: [0, 0], heading: 0, screens: [{ length: 12 }, { length: 12, gate: true }, { length: 12, boss: true }] });
const hero = (hp = 99999) => ({ recipe: { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder', hp } });
const gunner = { guns: ['machine-gun'], grenades: 2 };
const run = (st, frames, buttons) => { let r = newGunReader(), s = st; for (let k = 0; k < frames; k++) { const [pad, r2] = readGunButtons(r, typeof buttons === 'function' ? buttons(s, k) : buttons, s.s.bodies[0]); r = r2; s = stepStreet(s, [pad]); } return s; };

describe('the play types', () => {
  it('a row a way to play a sideways map, the street\'s own plays', () => {
    expect(PLAY_IDS).toEqual([...STREET_PLAYS]);
    for (const id of PLAY_IDS) for (const k of ['says', 'kit', 'asks', 'hud', 'stands', 'waves', 'result']) expect(PLAY_TYPES[id][k], `${id}.${k}`).toBeTruthy();
    expect(PLAY_TYPES.gun.asks).toContain('gun');
    expect(PLAY_TYPES.gun.result).toContain('accuracy');
  });
  it('its shelves name real things: a crate\'s guns, a gun to take up', () => {
    for (const g of CRATE_GUNS) expect(THINGS.gun[g], g).toBeTruthy();
    for (const [id, row] of Object.entries(THINGS.gun)) expect(GUNS[row.gun].ammo, id).toBeGreaterThan(0);
  });
});

describe('a run & gun\'s map, laid when it names nothing', () => {
  const BASE = settingCover('base'), W = playWaves('gun', belt), T = playThings('gun', belt, { cover: BASE });
  it('every screen has a wave of shooters; the held one a rush with them, the last its boss, a shooter', () => {
    expect(W.map((w) => w.screen)).toEqual([0, 1, 2]);
    for (const w of W) expect(w.crowd.some((c) => CROWD_TYPES[c.type].gun)).toBe(true);
    expect(W[1].crowd.some((c) => !CROWD_TYPES[c.type].gun)).toBe(true);
    // (its boss a shooter of the crowd's own kind, never a brawler)
    expect(W[2].boss).toMatchObject({ type: 'bazooka' });
    expect(W[2].boss.recipe).toBeUndefined();
    expect(() => readWaves(W, belt)).not.toThrow();
    // (a crew's own: its shooters shoot, its others rush)
    const own = playWaves('gun', belt, ['grenadier', 'knife']);
    expect(own[1].crowd.map((c) => c.type).sort()).toEqual(['grenadier', 'knife']);
  });
  it('cover on every screen in the band, the setting\'s; a gun in a crate on the held one, food before the boss', () => {
    expect(() => readThings(T, belt)).not.toThrow();
    for (const sc of belt.screens) expect(T.some((t) => t.kind === 'cover' && t.at >= sc.from && t.at <= sc.to)).toBe(true);
    expect(T.filter((t) => t.kind === 'cover').every((t) => BASE.includes(t.what))).toBe(true);
    expect(T.find((t) => t.holds?.kind === 'gun').at).toBeGreaterThan(belt.screens[1].from);
    expect(T.find((t) => t.holds?.kind === 'food').at).toBeGreaterThan(belt.screens[2].from);
    expect(() => readStreet({ play: 'gun', waves: W, things: T }, belt)).not.toThrow();
  });
  it('lays nothing for a brawl: its own', () => { expect(() => playWaves('brawl', belt)).toThrow(/run & gun/); expect(() => playThings('brawl', belt)).toThrow(/run & gun/); });
});

describe('a street played as a run & gun', () => {
  const street = (over = {}) => streetOf({ belt, players: [hero()], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 2 }] }], gunner, ...over });
  it('its players hold their first gun over the sidearm, loaded, with their grenades; a brawl\'s hold none', () => {
    const me = street().s.bodies[0], G = street().ctx.guns;
    expect(G[me.gn].id).toBe('machine-gun');
    expect(G[me.sd].id).toBe('sidearm');
    expect(me.am).toBe(GUNS['machine-gun'].ammo);
    expect([me.gr, G[me.gi].id]).toEqual([2, 'grenade']);
    expect(streetOf({ belt, players: [hero()], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 1 }] }] }).s.bodies[0].gn).toBeUndefined();
  });
  it('fires its rounds down the street: they are tallied, and its screen reads its gun', () => {
    let st = street(), tally = { fired: 0, landed: 0 };
    let r = newGunReader();
    for (let k = 0; k < 60; k++) { const [pad, r2] = readGunButtons(r, { x: 0, z: 0, a: 1 }, st.s.bodies[0]); r = r2; st = stepStreet(st, [pad]); tally = tallyRounds(tally, st.s.events, 1); }
    expect(tally.fired).toBeGreaterThan(5);
    expect(accuracyOf(tally)).toBe(0);
    expect(accuracyOf({ fired: 0, landed: 0 })).toBeNull();
    const R = streetRead(st, []);
    expect(R.gun).toMatchObject({ on: true, name: 'Machine Gun', grenades: 2 });
    expect(Number(R.gun.ammo)).toBe(GUNS['machine-gun'].ammo - tally.fired);
    expect(streetRead(streetOf({ belt, players: [hero()], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 1 }] }] }), []).gun).toBeUndefined();
  });
  it('takes up a gun it walks over, in its stride; a brawler leaves it lying', () => {
    const things = [{ kind: 'gun', what: 'spread', at: 6, n: 0 }];
    const mid = (st) => { st.s.bodies[0].z = 0; return st; };
    const walked = run(mid(street({ things })), 120, { x: 1, z: 0 });
    const me = walked.s.bodies[0];
    expect(walked.ctx.guns[me.gn].id).toBe('spread');
    expect(me.am).toBe(GUNS.spread.ammo);
    expect(walked.s.things.some((t) => t.kind === 'gun')).toBe(false);
    let plain = mid(streetOf({ belt, players: [hero()], waves: [{ screen: 1, crowd: [{ type: 'thug', n: 1 }] }], things }));
    for (let k = 0; k < 120; k++) plain = stepStreet(plain, [{ x: 1, z: 0 }]);
    expect(plain.s.things.some((t) => t.kind === 'gun')).toBe(true);
  });
  it('its turn\'s pick names the gun it starts with', () => {
    expect(streetSession({ __picks: { gun: 'spread' } }, [{ id: 'a' }], [0]).gun).toBe('spread');
    expect(streetSession({}, [{ id: 'a' }], [0]).gun).toBeUndefined();
  });
});

describe('a wave fought on the move', () => {
  const waves = [{ screen: 0, crowd: [{ type: 'rifleman', n: 2 }] }, { screen: 1, crowd: [{ type: 'thug', n: 1 }] }];
  it('comes in on an open screen and is let go as the player walks on: the camera is never held by it', () => {
    let st = streetOf({ belt, players: [hero()], waves, gunner });
    const seen = [];
    let r = newGunReader();
    for (let k = 0; k < 900 && st.mind.wave === 0; k++) { const [pad, r2] = readGunButtons(r, { x: 1, z: 0 }, st.s.bodies[0]); r = r2; st = stepStreet(st, [pad]); for (const e of st.s.events) seen.push(e.t); }
    expect(seen).toContain('wave');
    expect(seen).toContain('passed');
    expect(st.mind.wave).toBe(1);
    expect(st.s.bodies[0].x).toBeGreaterThan(belt.screens[1].from * 1000);
    // (the held screen is still to beat: the street is not won by walking)
    expect(streetRead(st, []).won).toBe(false);
  });
  it('plays the same twice', () => {
    const go = () => { let st = streetOf({ belt, players: [hero()], waves, gunner }); st = run(st, 400, (s, k) => ({ x: 1, z: k % 40 < 20 ? 1 : -1, a: 1 })); return JSON.stringify(st.s.bodies.map((b) => [b.x, b.z, b.hp])); };
    expect(go()).toBe(go());
  });
});

describe('a boss of the crowd\'s own kind', () => {
  const waves = [{ screen: 2, crowd: [], boss: { type: 'bazooka', name: 'Big Rocket', hp: 500 } }];
  it('is read: a crowd type, a name, its health; a fault is said', () => {
    expect(readWaves(waves, belt)[0].boss).toEqual({ type: 'bazooka', name: 'Big Rocket', hp: 500 });
    expect(readWaves([{ screen: 2, boss: { type: 'rifleman' } }], belt)[0].boss).toMatchObject({ name: 'The Boss', hp: CROWD_TYPES.rifleman.hp * 4 });
    expect(() => readWaves([{ screen: 2, boss: { type: 'wizard' } }], belt)).toThrow(/boss.type/);
    expect(() => readWaves([{ screen: 2, boss: { type: 'bazooka', plays: ['chain'] } }], belt)).toThrow(/boss.plays/);
    expect(() => readWaves([{ screen: 1, boss: { type: 'bazooka' } }], belt)).toThrow(/boss screen/);
  });
  it('stands on the street as its type, with its gun, its health and its bar; felled, the street is won', () => {
    let st = streetOf({ belt, players: [hero()], waves, gunner });
    const id = Number(Object.keys(st.mind.bosses)[0]), B = st.s.bodies[id];
    expect(B.hp).toBe(500);
    expect(st.ctx.guns[B.gn].id).toBe(CROWD_TYPES.bazooka.gun);
    st.s.bodies[0].x = (belt.screens[2].from + 3) * 1000;
    let fired = false, bar = null;
    for (let k = 0; k < 900 && !fired; k++) { st = stepStreet(st, [{}]); fired = st.s.events.some((e) => e.t === 'fire' && e.p === id); if (!st.s.bodies[id].gone) bar = streetRead(st, []).boss; }
    expect(bar).toMatchObject({ on: true, name: 'Big Rocket' });
    expect(fired).toBe(true);
    st.s.bodies[id].hp = 0; st.s.bodies[id].ko = 1;
    for (let k = 0; k < 5; k++) st = stepStreet(st, [{}]);
    expect(streetRead(st, []).won).toBe(true);
  });
});

describe('cover from the dress: a place\'s cover is of the place', () => {
  it('every setting has cover of its own, each a dress piece that stops a round', () => {
    for (const id of DRESS_SETTING_IDS) {
      const L = settingCover(id);
      expect(L.length, id).toBeGreaterThan(1);
      for (const c of L) { expect(THINGS.cover[c], c).toBeTruthy(); expect(DRESS_PIECES[coverPiece(c)], c).toBeTruthy(); }
    }
    // (no two settings fight from the same things)
    expect(new Set(DRESS_SETTING_IDS.map((id) => settingCover(id).join())).size).toBe(DRESS_SETTING_IDS.length);
  });
  it('a screen\'s cover is what its set stands on its floor; a set with none takes its setting\'s', () => {
    const setting = DRESS_SETTING_IDS.find((id) => DRESS_SETTINGS[id].kits.length), sets = dressSets(belt, setting), C = dressCover({ setting, sets }, belt);
    expect(C).toHaveLength(belt.screens.length);
    C.forEach((list, i) => { for (const c of list) expect(Object.keys(DRESS_SETS[sets[i]].far).includes(c) || settingCover(setting).includes(c)).toBe(true); });
    expect(dressCover({ setting, sets: sets.map(() => null) }, belt)[0]).toEqual(settingCover(setting));
    expect(dressCover({ setting, sets: [{ far: { litter: 1 } }, ...sets.slice(1)] }, belt)[0]).toEqual(settingCover(setting));
    expect(dressCover(null, belt)).toBeNull();
    // (laid: each screen's cover is its own, in the band, clear of its edges)
    const T = playThings('gun', belt, { cover: C });
    belt.screens.forEach((sc, i) => { for (const t of T.filter((x) => x.kind === 'cover' && x.at >= sc.from && x.at < sc.to)) { expect(C[i]).toContain(t.what); expect(t.n - THINGS.cover[t.what].d / 2).toBeGreaterThan(belt.depth[0]); expect(t.n + THINGS.cover[t.what].d / 2).toBeLessThan(belt.depth[1]); } });
    expect(() => readThings(T, belt)).not.toThrow();
  });
  it('is drawn as the dress draws it: its piece fitted to the box that stops a round, and what it leaves broken', () => {
    const what = settingCover('base')[0], M = coverModels([what, 'wall'])
    expect(Object.keys(M)).toEqual([what]);
    const P = M[what].whole.pos, at = (i) => P.filter((_, k) => k % 3 === i), D = THINGS.cover[what];
    expect(Math.max(...at(0)) - Math.min(...at(0))).toBeCloseTo(D.w, 2);
    expect(Math.max(...at(1)) - Math.min(...at(1))).toBeCloseTo(D.d, 2);
    expect(Math.max(...at(2))).toBeCloseTo(D.h, 2);
    expect(Math.min(...at(2))).toBeGreaterThanOrEqual(0);
    expect(M[what].wreck.pos.length).toBeGreaterThan(0);
    expect(coverModels([what])).toEqual({ [what]: M[what] });
  });
});

describe('a boss with phases', () => {
  const boss = { type: 'bazooka', name: 'Big Rocket', hp: 400, phases: [{ at: 0.5, type: 'gunner', volley: 4, calls: [{ type: 'rifleman', n: 2 }], says: 'Reinforcements' }, { at: 0.2, volley: 6 }] };
  const waves = [{ screen: 2, crowd: [], boss }];
  it('is read: each phase lower than the last, its type, its calls; a fault is said', () => {
    expect(readWaves(waves, belt)[0].boss.phases).toEqual(boss.phases);
    const bad = (ph) => () => readWaves([{ screen: 2, boss: { type: 'bazooka', phases: ph } }], belt);
    expect(bad([{ at: 0.5 }, { at: 0.6 }])).toThrow(/lower than the last/);
    expect(bad([{ at: 1.2 }])).toThrow(/phases\[0\].at/);
    expect(bad([{ at: 0.5, type: 'wizard' }])).toThrow(/type/);
    expect(bad([{ at: 0.5, calls: [{ type: 'thug', n: 0 }] }])).toThrow(/calls/);
    expect(bad([{ at: 0.5, sings: 1 }])).toThrow(/not a phase's word/);
    expect(bad([])).toThrow(/1 to 4 phases/);
  });
  it('turns as its health falls: another gun, more rounds, the bodies it calls come in; it is said, and read', () => {
    let st = streetOf({ belt, players: [hero()], waves, gunner });
    const id = Number(Object.keys(st.mind.bosses)[0]), called = st.mind.bosses[id].phases[0].calls;
    expect(called).toHaveLength(2);
    st.s.bodies[0].x = (belt.screens[2].from + 3) * 1000;
    const seen = [];
    const run = (n) => { for (let k = 0; k < n; k++) { st = stepStreet(st, [{}]); for (const e of st.s.events) if (e.t === 'phase') seen.push(e); } };
    run(120);
    expect(st.s.bodies[id].gone).toBe(0);
    expect(streetRead(st, []).phase).toEqual({ at: 1, of: 3 });
    // (those it calls wait for their phase: not on the street, and not what the wave is waiting for)
    expect(called.every((c) => st.s.bodies[c].gone)).toBe(true);
    st.s.bodies[id].hp = 190; run(200);
    expect(seen.map((e) => [e.k, e.says])).toEqual([[1, 'Reinforcements']]);
    expect(st.ctx.guns[st.s.bodies[id].gn].id).toBe(CROWD_TYPES.gunner.gun);
    expect(called.every((c) => !st.s.bodies[c].gone)).toBe(true);
    expect(streetRead(st, []).phase).toEqual({ at: 2, of: 3 });
    st.s.bodies[id].hp = 60; run(5);
    expect(seen.map((e) => e.k)).toEqual([1, 2]);
    // (a blow that takes it through two marks at once turns it twice)
    let two = streetOf({ belt, players: [hero()], waves, gunner });
    two.s.bodies[0].x = (belt.screens[2].from + 3) * 1000;
    for (let k = 0; k < 120; k++) two = stepStreet(two, [{}]);
    two.s.bodies[id].hp = 10; two = stepStreet(two, [{}]);
    expect(two.s.events.filter((e) => e.t === 'phase').map((e) => e.k)).toEqual([1, 2]);
  });
  it('felled before it called them, those it would have called never come: the street is won', () => {
    let st = streetOf({ belt, players: [hero()], waves, gunner });
    const id = Number(Object.keys(st.mind.bosses)[0]);
    st.s.bodies[0].x = (belt.screens[2].from + 3) * 1000;
    for (let k = 0; k < 120; k++) st = stepStreet(st, [{}]);
    st.s.bodies[id].hp = 0; st.s.bodies[id].ko = 1;
    for (let k = 0; k < 5; k++) st = stepStreet(st, [{}]);
    expect(streetRead(st, []).won).toBe(true);
  });
});

describe('a second seat taken mid-street', () => {
  const waves = [{ screen: 1, crowd: [{ type: 'thug', n: 1 }] }];
  const two = () => streetOf({ belt, players: [hero(), { ...hero(), away: true }], waves, gunner });
  it('waits off the street: not read, not fought, and the street\'s end is the seated players\'', () => {
    let st = two();
    expect(st.s.bodies[1]).toMatchObject({ side: 'player', gone: 1, aw: 1 });
    // (a seat that waits moves no one: the one who plays starts where it would alone)
    expect(st.s.bodies[0].z).toBe(streetOf({ belt, players: [hero()], waves, gunner }).s.bodies[0].z);
    expect(streetRead(st, []).mates).toMatchObject([{ on: false }]);
    st.s.bodies[0].ko = 1; st.s.bodies[0].hp = 0;
    expect(streetRead(st, []).lost).toBe(true);
  });
  it('joins where the first stands, whole, armed as it; the street goes on from the frame it was at', () => {
    let st = two();
    for (let k = 0; k < 200; k++) st = stepStreet(st, [{ x: 1 }]);
    const f = st.s.f, before = st.s.bodies[0].x, joined = joinStreet(st, 1);
    expect(st.s.bodies[1].gone).toBe(1);   // (the street it joined from is as it was)
    expect(joined.s.f).toBe(f);
    const p = joined.s.bodies[1];
    expect(p).toMatchObject({ gone: 0, ko: 0 });
    expect(p.aw).toBeUndefined();
    expect(Math.abs(p.x - before)).toBeLessThan(1500);
    expect(joined.ctx.guns[p.gn].id).toBe('machine-gun');
    expect(joined.s.events.some((e) => e.t === 'join' && e.p === 1)).toBe(true);
    expect(streetRead(joined, []).mates[0]).toMatchObject({ on: true, gun: 'Machine Gun' });
    expect(joinStreet(joined, 1)).toBe(joined);
    // (both fire, both are tallied; one down does not end it)
    let s2 = joined, tally = { fired: 0, landed: 0 }, r0 = newGunReader(), r1 = newGunReader(), mine = 0;
    for (let k = 0; k < 40; k++) { const [a, ra] = readGunButtons(r0, { x: 0, z: 0, a: 1 }, s2.s.bodies[0]), [b, rb] = readGunButtons(r1, { x: 0, z: 0, a: 1 }, s2.s.bodies[1]); r0 = ra; r1 = rb; s2 = stepStreet(s2, [a, b]); tally = tallyRounds(tally, s2.s.events, 2); mine += s2.s.events.filter((e) => e.t === 'fire' && e.p === 1).length; }
    expect(mine).toBeGreaterThan(2);
    expect(tally.fired).toBeGreaterThan(mine);
    s2.s.bodies[0].ko = 1;
    expect(streetRead(s2, []).lost).toBe(false);
  });
});
