import { describe, it, expect } from 'vitest';
import { newBrawl, stepBrawl, enterBody, brawlHash, BRAWL_RULES } from './brawl-core.js';
import { brawlFighter } from './brawl-moves.js';
import { readGun } from './brawl-guns.js';
import { THINGS } from './brawl-things.js';
import { practiceOf, stepYard } from './brawl-practice.js';
import { readRangeWaves, ENTRANCE_IDS, WAVE_RULES } from './brawl-waves.js';
import { streetOf, stepStreet, readWaves } from './brawl-crowd.js';
import { brawlPreset } from './brawl-levels.js';
import { readBelt } from './brawl-belt.js';
import { solveFighter } from '../versus/versus-solver.js';

// HOW A BODY COMES IN AND WHERE IT HIDES, for both games: walking, out of a door, dropping from above, digging out of
// the ground, vaulting the back fence; crouched hidden (a round at the chest passes over); behind cover (a round
// stopped, unless fired over its shooter's own; cover worn down and broken, gone over by a grenade, reached behind by a
// burst; never walked through); a range wave's entrance, cover and ambush; a street wave's.
const recipe = { ...solveFighter({ id: 'hero', archetype: 'all-rounder' }).recipe, archetype: 'all-rounder' };
const F = brawlFighter(recipe);
const guns = [readGun('sidearm'), readGun('grenade'), readGun('rocket')];
const ctx = { fighters: [F], guns, belt: brawlPreset('yard').belt };
const n1 = Math.round(ctx.belt.depth[1] * 1000);
const two = (o = {}, things) => newBrawl(ctx, { bodies: [{ fighter: 0, side: 'player', x: 4000, gun: 0, grenades: 3, grenadeGun: 1, ...o }, { fighter: 0, side: 'crowd', x: 8000, face: -1, grabs: false }], ...(things ? { things } : {}) });
function run(s, n, pads = () => []) { const ev = []; for (let k = 0; k < n; k++) { s = stepBrawl(s, pads(k, s), ctx); ev.push(...s.events.map((e) => ({ ...e, k }))); } return { s, ev }; }

describe('brawl entrances: how a body comes in', () => {
  it('dropping from above: up there first, landing where it is put', () => {
    const s0 = two(); enterBody(s0, ctx, 1, { how: 'drop', x: 7000, z: 300 });
    expect(s0.bodies[1].y).toBe(BRAWL_RULES.dropH);
    const { s, ev } = run(s0, 60);
    expect(ev.some((e) => e.t === 'land' && e.p === 1 && e.drop)).toBe(true);
    expect([s.bodies[1].x, s.bodies[1].z, s.bodies[1].y]).toEqual([7000, 300, 0]);
  });
  it('digging out: from below the ground, untouchable until it is out', () => {
    const s0 = two(); enterBody(s0, ctx, 1, { how: 'dig', x: 6000, z: 0 });
    expect(s0.bodies[1].y).toBeLessThan(0);
    const { s, ev } = run(s0, BRAWL_RULES.dig + 20, (k) => [{ fire: [1, 0] }, {}]);
    const out = ev.find((e) => e.t === 'dug');
    expect(out).toBeTruthy();
    expect(ev.some((e) => e.t === 'hit' && e.d === 1 && e.k < out.k)).toBe(false);
    expect(s.bodies[1].y).toBe(0);
  });
  it('over the back fence: from the street\'s far side in an arc, onto the band', () => {
    const s0 = two(); enterBody(s0, ctx, 1, { how: 'vault', x: 7000, z: 0 });
    expect(s0.bodies[1].z).toBe(n1);
    const { s } = run(s0, 90);
    expect(s.bodies[1].y).toBe(0);
    expect(s.bodies[1].z).toBeLessThan(n1 - 500);
  });
  it('out of a door: from the street\'s far side where it stands', () => {
    const s0 = two(); enterBody(s0, ctx, 1, { how: 'door', x: 7000, z: 0 });
    expect([s0.bodies[1].x, s0.bodies[1].z, s0.bodies[1].st]).toEqual([7000, n1, 'stand']);
    expect(ENTRANCE_IDS).toEqual(['walk', 'door', 'drop', 'dig', 'vault']);
  });
});

describe('brawl entrances: hiding and cover', () => {
  it('hidden, crouched: a round at the chest passes over it; standing, it lands', () => {
    const fire = (hide) => { const s0 = two(); if (hide) enterBody(s0, ctx, 1, { how: 'walk', x: 8000, z: 0, hide: true }); return run(s0, 60, (k) => [k === 0 ? { fire: [1, 0] } : {}, {}]).ev.some((e) => e.t === 'hit' && e.d === 1); };
    expect(fire(true)).toBe(false);
    expect(fire(false)).toBe(true);
  });
  it('a hidden body comes up on a command (an aim, a step, a pop), and goes down on one', () => {
    const s0 = two(); enterBody(s0, ctx, 1, { how: 'walk', x: 8000, z: 0, hide: true });
    const { s, ev } = run(s0, 3, (k) => [{}, k === 1 ? { pop: true } : {}]);
    expect(ev.some((e) => e.t === 'pop' && e.p === 1)).toBe(true);
    expect(s.bodies[1].st).not.toBe('hide');
    expect(run(s, 2, () => [{}, { hide: true }]).s.bodies[1].st).toBe('hide');
  });
  const cover = (x, what = 'sandbags') => ({ id: 1, kind: 'cover', what, x, z: 0, hp: THINGS.cover[what].hp });
  it('cover stops a round meeting it, worn down by it; a body behind it fires over its own', () => {
    const shielded = run(two({}, [cover(7000)]), 60, (k) => [k === 0 ? { fire: [1, 0] } : {}, {}]);
    expect(shielded.ev.some((e) => e.t === 'cover')).toBe(true);
    expect(shielded.ev.some((e) => e.t === 'hit' && e.d === 1)).toBe(false);
    expect(shielded.s.things[0].hp).toBe(THINGS.cover.sandbags.hp - guns[0].damage);
    // (the player behind its own cover: its round goes on over it)
    const own = run(two({}, [cover(4800)]), 60, (k) => [k === 0 ? { fire: [1, 0] } : {}, {}]);
    expect(own.ev.some((e) => e.t === 'hit' && e.d === 1)).toBe(true);
  });
  it('worn through, it breaks; a grenade goes over it and its burst wears it; no body walks through it', () => {
    const thin = { ...cover(7000, 'crates'), hp: 20 };
    const broke = run(two({}, [thin]), 90, (k) => [{ fire: [1, 0] }, {}]);
    expect(broke.ev.some((e) => e.t === 'break' && e.cover)).toBe(true);
    expect(broke.s.things.length).toBe(0);
    // (the grenade lobbed over the cover by the player, bursting beyond it where the crowd body stands)
    const lob = run(two({ x: 5000 }, [cover(7600)]), 90, (k) => [k === 0 ? { lob: [1, 0] } : {}, {}]);
    expect(lob.ev.some((e) => e.t === 'burst')).toBe(true);
    expect(lob.s.things[0].hp).toBeLessThan(THINGS.cover.sandbags.hp);
    const walk = run(two({}, [cover(5600)]), 80, () => [{ x: 1 }, {}]);
    expect(walk.s.bodies[0].x).toBeLessThan(5600 - (THINGS.cover.sandbags.w * 1000) / 2);
  });
});

// (the range's waves, one at a time)
const range = (waves) => practiceOf({ belt: ctx.belt, players: [{ recipe }], dummies: [], range: { guns: ['machine-gun'], waves } });
function yard(r, n, fn = () => ({})) { const ev = []; const log = []; for (let k = 0; k < n; k++) { r = stepYard(r, [fn(r)]); ev.push(...r.s.events.map((e) => ({ ...e, f: r.s.f }))); log.push(r); } return { r, ev, log }; }

describe('brawl entrances: a range wave\'s', () => {
  it('its entrance: dropping onto its stations, or digging up out of them', () => {
    for (const how of ['drop', 'dig']) {
      const { ev, log } = yard(range([{ crowd: [{ type: 'rifleman', n: 2 }], entrance: how, after: 20 }]), 30);
      expect(ev.filter((e) => e.t === 'enter' && e.how === how).length, how).toBe(2);
      const k = log.findIndex((x) => x.s.events.some((e) => e.t === 'wave'));
      const b = log[k].s.bodies[1];
      expect(how === 'drop' ? b.y > 0 : b.y < 0, how).toBe(true);
    }
    expect(() => readRangeWaves([{ crowd: [{ type: 'thug', n: 1 }], entrance: 'teleport' }])).toThrow(/entrance/);
  });
  it('its cover: a piece between each station and the player; its shooters down between volleys, up to fire over it', () => {
    const { r, ev, log } = yard(range([{ crowd: [{ type: 'rifleman', n: 2, hp: 9999 }], cover: 'sandbags', pattern: 'volley', after: 20 }]), 500);
    const pieces = r.s.things.filter((c) => c.kind === 'cover');
    expect(pieces.length).toBe(2);
    for (const c of pieces) expect(Math.abs(c.x - r.s.bodies[0].x)).toBeLessThan(Math.abs(r.s.bodies[1].x - r.s.bodies[0].x) + 100);
    expect(log.some((x) => x.s.bodies[1].st === 'hide')).toBe(true);
    expect(ev.some((e) => e.t === 'fire' && e.p === 1)).toBe(true);
    expect(ev.some((e) => e.t === 'pop' && e.p === 1)).toBe(true);
  });
  it('lying in wait: hidden until the player comes near, then up', () => {
    const w = [{ crowd: [{ type: 'thug', n: 1 }], formation: 'line', ambush: true, after: 20 }];
    const still = yard(range(w), 200);
    expect(still.r.s.bodies[1].st).toBe('hide');
    const near = yard(range(w), 400, (r) => ({ x: Math.sign(r.s.bodies[1].x - r.s.bodies[0].x) }));
    expect(near.log.some((x) => x.s.bodies[1].st === 'hide')).toBe(true);
    expect(near.ev.some((e) => e.t === 'pop' && e.p === 1)).toBe(true);
    expect(WAVE_RULES.ambush).toBeGreaterThan(0);
  });
});

describe('brawl entrances: a street wave\'s', () => {
  const belt = readBelt({ at: [0, 0], heading: 0, screens: [{ length: 14 }, { length: 16, gate: true }] });
  const street = (crowd) => { let st = streetOf({ belt, players: [{ recipe: { ...recipe, hp: 99999 } }], waves: [{ screen: 1, crowd }] }); st.s.bodies[0].x = 18000; return st; };
  it('a crowd entry drops in onto the view; another lies in wait until a player is near', () => {
    let st = street([{ type: 'thug', n: 2, entrance: 'drop' }, { type: 'thug', n: 1, ambush: true }]);
    const ev = [], sts = [];
    const id = Number(Object.keys(st.mind.entries).find((k) => st.mind.entries[k].ambush));
    for (let k = 0; k < 40; k++) { st = stepStreet(st, [{}]); ev.push(...st.s.events); sts.push(st.s.bodies[id].st); }
    expect(ev.filter((e) => e.t === 'enter' && e.how === 'drop').length).toBe(2);
    expect(ev.some((e) => e.t === 'enter' && e.p === id && e.hide)).toBe(true);
    expect(sts).toContain('hide');
    expect(() => readWaves([{ screen: 1, crowd: [{ type: 'thug', n: 1, entrance: 'teleport' }] }], belt)).toThrow(/entrance/);
  });
  it('the same street and pads, the same brawl', () => {
    const go = () => { let st = street([{ type: 'thug', n: 2, entrance: 'dig' }, { type: 'rifleman', n: 1, entrance: 'vault' }]); for (let k = 0; k < 300; k++) st = stepStreet(st, [{ x: k % 60 < 30 ? 1 : 0 }]); return brawlHash(st.s); };
    expect(go()).toBe(go());
  });
});

describe('brawl entrances: the brawler yard\'s own waves', () => {
  it('the wave tester in a melee yard: a wave of thugs digging out round the player, fighting as the crowd', () => {
    let r = practiceOf({ belt: ctx.belt, players: [{ recipe }], dummies: [], waves: [{ crowd: [{ type: 'thug', n: 3 }], formation: 'surround', entrance: 'dig', after: 20 }] });
    const ev = [];
    for (let k = 0; k < 600; k++) { r = stepYard(r, [{}]); ev.push(...r.s.events); }
    expect(ev.filter((e) => e.t === 'enter' && e.how === 'dig').length).toBe(3);
    expect(ev.some((e) => e.t === 'hit' && e.d === 0)).toBe(true);
    expect(r.s.bodies[0].gn).toBeUndefined();
  });
});
