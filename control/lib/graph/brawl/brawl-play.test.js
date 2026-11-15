import { describe, it, expect } from 'vitest';
import { PLAY_TYPES, PLAY_IDS, SETTING_COVER, CRATE_GUNS, playWaves, playThings } from './brawl-play.js';
import { streetOf, stepStreet, readWaves, CROWD_TYPES } from './brawl-crowd.js';
import { STREET_PLAYS, readStreet } from './brawl-street.js';
import { streetRead, tallyRounds, accuracyOf, streetSession } from './brawl-street-read.js';
import { newGunReader, readGunButtons } from './brawl-gunner.js';
import { readBelt } from './brawl-belt.js';
import { THINGS, readThings } from './brawl-things.js';
import { GUNS } from './brawl-guns.js';
import { DRESS_SETTING_IDS } from './brawl-dress.js';
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
  it('its shelves name real things: a setting\'s cover, a crate\'s guns, a gun to take up', () => {
    expect(Object.keys(SETTING_COVER).sort()).toEqual([...DRESS_SETTING_IDS].sort());
    for (const list of Object.values(SETTING_COVER)) for (const c of list) expect(THINGS.cover[c], c).toBeTruthy();
    for (const g of CRATE_GUNS) expect(THINGS.gun[g], g).toBeTruthy();
    for (const [id, row] of Object.entries(THINGS.gun)) expect(GUNS[row.gun].ammo, id).toBeGreaterThan(0);
  });
});

describe('a run & gun\'s map, laid when it names nothing', () => {
  const W = playWaves('gun', belt), T = playThings('gun', belt, { cover: SETTING_COVER.base });
  it('every screen has a wave of shooters; the held one a rush with them, the last a last stand with a rocket and no brawler', () => {
    expect(W.map((w) => w.screen)).toEqual([0, 1, 2]);
    for (const w of W) expect(w.crowd.some((c) => CROWD_TYPES[c.type].gun)).toBe(true);
    expect(W[1].crowd.some((c) => !CROWD_TYPES[c.type].gun)).toBe(true);
    expect(W[2].boss).toBeUndefined();
    expect(W[2].crowd.some((c) => c.type === 'bazooka')).toBe(true);
    expect(() => readWaves(W, belt)).not.toThrow();
    // (a crew's own: its shooters shoot, its others rush)
    const own = playWaves('gun', belt, ['grenadier', 'knife']);
    expect(own[1].crowd.map((c) => c.type).sort()).toEqual(['grenadier', 'knife']);
  });
  it('cover on every screen in the band, the setting\'s; a gun in a crate on the held one, food before the boss', () => {
    expect(() => readThings(T, belt)).not.toThrow();
    for (const sc of belt.screens) expect(T.some((t) => t.kind === 'cover' && t.at >= sc.from && t.at <= sc.to)).toBe(true);
    expect(T.filter((t) => t.kind === 'cover').every((t) => SETTING_COVER.base.includes(t.what))).toBe(true);
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
