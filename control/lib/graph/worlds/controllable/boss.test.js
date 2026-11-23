import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { bossRule, vehicleEntity } from '../../boss/stand.js';
import { BOSSES } from '../../boss/bosses.js';

// THE BOSS DIRECTOR (boss.js) on the live runtime: a human boss's moves laid at its tempo, their hazards landing on a body
// standing in them and not on one diving through, crouched under or behind cover; a phase crossing's event; a vehicle's
// hits judged by part, its state moving on as its parts break; a mine under its track (mines.js).

const E = composeLive();
const hooks = { ground: () => 0 };
const pilot = (at, extra = {}) => ({ id: 'p', pilotable: true, team: 'hero', rule: { type: 'platform', speed: 5, eye: 0, jumpSpeed: 0 }, body: { type: 'mesh', hittable: true, hp: 100, egg: { a: 0.35, c: 0.9, cz: 0.9 } }, transform: { pos: [...at, 0], heading: 0 }, ...extra });
// (a boss of one move, so what it lands is known)
const oneMove = (id, move, extra = {}) => { const R = bossRule(id, { first: 0.5, ...extra }); return { ...R, phases: R.phases.map((p) => ({ ...p, moves: { [move]: 1 } })) }; };
const human = (rule, at = [0, 0]) => ({ id: 'b', team: 'guards', rule: { type: 'none', boss: rule }, body: { type: 'mesh', hittable: true, hp: 500, egg: { a: 0.4, c: 1, cz: 1 } }, transform: { pos: [...at, 0], heading: 0 } });
const run = (s, secs, input = {}, each) => { for (let k = 0; k < secs / 0.05; k++) { E.stepWorld(s, input, 0.05, hooks); if (each) each(s); } return s; };
const world = (ents, extra = {}) => E.createWorld({ camera: { rule: 'follow', target: 'p' }, entities: ents, ...extra });

describe('a human boss', () => {
  const id = Object.keys(BOSSES).find((k) => Object.values(BOSSES[k].moves).some((m) => m.pattern === 'charge'));
  const charge = Object.keys(BOSSES[id].moves).find((m) => BOSSES[id].moves[m].pattern === 'charge');

  it('lays its move\'s hazards at its tempo, each marked before it lands, and they land on a body standing in them', () => {
    const s = world([pilot([8, 0]), human(oneMove(id, charge))]);
    let seen = null;
    run(s, 4, {}, (w) => { if (!seen && w.bossHazards.length) seen = { ...w.bossHazards[0] }; });
    expect(seen).not.toBeNull();
    expect(seen.t0 - seen.tm).toBeGreaterThanOrEqual(0.6);
    expect(s.byId.p.body.hp).toBeLessThan(100);
    expect(s.bosses.b.name).toBe(BOSSES[id].name);
  });

  it('a body diving through it, or out of its lane, is not hurt', () => {
    const s = world([pilot([8, 0]), human(oneMove(id, charge))]);
    run(s, 4, {}, (w) => { w.byId.p.invincible = true; });
    expect(s.byId.p.body.hp).toBe(100);
    const t = world([pilot([8, 6]), human(oneMove(id, charge))]);
    // (it aims where the body stood, then the body steps out of the lane before it lands)
    run(t, 1.2); t.byId.p.transform.pos[1] = 9; run(t, 3);
    expect(t.byId.p.body.hp).toBe(100);
  });

  it('a cover hazard is stopped by a box between its origin and the body', () => {
    const lockMove = Object.keys(BOSSES.glint.moves).find((m) => BOSSES.glint.moves[m].pattern === 'lock');
    const open = world([pilot([12, 0]), human(oneMove('glint', lockMove))]);
    run(open, 4);
    const walled = world([pilot([12, 0]), human(oneMove('glint', lockMove))], { colliders: [{ min: [5, -2, 0], max: [6, 2, 3], of: 'wall' }] });
    run(walled, 4);
    expect(open.byId.p.body.hp).toBeLessThan(100);
    expect(walled.byId.p.body.hp).toBe(100);
  });

  it('a relocate goes on from the perch it stands at', () => {
    const perches = [[10, 0], [0, 10], [-10, 0]];
    const R = { ...bossRule('glint', { first: 99, arena: { perches } }) }, b = human(R, [0.3, 9.8]);
    const s = world([pilot([0, -10]), b]);
    run(s, 0.1);
    s.byId.b.mindPhase = 0;
    run(s, 0.1);
    expect(s.byId.b.transform.pos.slice(0, 2)).toEqual([-10, 0]);
  });

  it('a phase crossed runs its event: a tear takes the piece of its cover nearest the body', () => {
    const A = { id: 'crate-a', min: [8, -1, 0], max: [9, 1, 2] }, Bx = { id: 'crate-b', min: [-9, -1, 0], max: [-8, 1, 2] };
    const R = { ...bossRule('breaker', { first: 99, arena: { cover: [A, Bx] } }) };
    const s = world([pilot([10, 0]), human(R)], { colliders: [{ min: A.min, max: A.max }, { min: Bx.min, max: Bx.max }] });
    run(s, 0.2);
    s.byId.b.mindPhase = 0;
    run(s, 0.1);
    expect(s.colliders.map((c) => c.min[0])).toEqual([-9]);
  });
});

describe('a human boss\'s counter', () => {
  // (a boss with a part counter, and the move that bares it, chosen from the shelf)
  const id = Object.keys(BOSSES).find((k) => (BOSSES[k].counters || []).some((c) => c.kind === 'part' && c.when === 'vent'));
  const C = BOSSES[id].counters.find((c) => c.kind === 'part'), vent = Object.keys(BOSSES[id].moves).find((m) => BOSSES[id].moves[m].vent);
  const shooter = (at) => ({ id: 's', team: 'hero', rule: { type: 'none' }, body: { type: 'mesh', hp: 100 }, transform: { pos: [...at, 0], heading: 0 } });
  // (a round lands on the boss in the step about to run: what the director reads off the shooter, as a fired round leaves it)
  const shoot = (s) => { s.byId.s.lastShot = { targetId: 'b', t: s.time, to: [0, 0, 1.3] }; E.stepWorld(s, {}, 0.05, hooks); };
  const toVent = (s) => { for (let k = 0; k < 200; k++) { const c = s.byId.b.bossS && s.byId.b.bossS.cur; if (c && c.vent && s.time >= c.openAt + 0.05) return true; E.stepWorld(s, {}, 0.05, hooks); } return false; };
  const fight = (shooterAt) => { const s = world([pilot([8, 0]), shooter(shooterAt), human(oneMove(id, vent))]); s.byId.p.invincible = true; return s; };

  it('the vent turns it away from the aim through its opening', () => {
    const s = fight([8, 0]);
    expect(toVent(s)).toBe(true);
    const S = s.byId.b.bossS, h = s.byId.b.transform.heading;
    expect(Math.cos(h - (S.cur.aim + Math.PI))).toBeGreaterThan(0.99);
    expect(s.bosses.b.counters[C.id].bare).toBe(true);
  });

  it('its part breaks only to its hits from behind while bare: then it reels, loses health, and the move reaches less far', () => {
    const s = fight([8, 0]);
    // (rounds before it is bare count for nothing)
    for (let k = 0; k < C.hits; k++) shoot(s);
    expect(s.bosses.b.counters[C.id].hits).toBe(0);
    expect(toVent(s)).toBe(true);
    const hp0 = s.byId.b.body.hp, reach0 = Math.max(...s.byId.b.rule.boss.moves[vent].hazards.map((h) => h.reach || 0));
    for (let k = 0; k < C.hits; k++) shoot(s);
    const B = s.bosses.b.counters[C.id];
    expect(B.broken).toBe(true);
    expect(hp0 - s.byId.b.body.hp).toBeGreaterThanOrEqual((C.breaks.harm || 0) * 500 - 1e-6);
    expect(s.byId.b.bossS.reel).toBeGreaterThan(s.time);
    if (C.breaks.shorten && C.breaks.shorten[vent]) expect(Math.max(...s.byId.b.rule.boss.moves[vent].hazards.map((h) => h.reach || 0))).toBeCloseTo(reach0 * C.breaks.shorten[vent], 6);
  });

  it('rounds from in front of it, while it is turned away, do not count', () => {
    const s = fight([-8, 0]);
    expect(toVent(s)).toBe(true);
    for (let k = 0; k < C.hits; k++) shoot(s);
    expect(s.bosses.b.counters[C.id].hits).toBe(0);
  });

  it('a phase\'s look swaps its figure', () => {
    const look = Object.keys(BOSSES[id].looks || {})[0];
    if (!look) return;
    const R = bossRule(id, { first: 99, figures: { [look]: 'boss-' + look } }), b = human(R);
    b.body.figure = 'boss';
    const s = world([pilot([10, 0]), b]);
    run(s, 0.1);
    const k = R.phases.findIndex((p) => p.figure);
    s.byId.b.mindPhase = k - 1;
    run(s, 0.1);
    expect(s.byId.b.body.figure).toBe('boss-' + look);
  });
});

describe('a flash counter', () => {
  // (a boss with a flash counter, and the move that holds its eye to a scope, from the shelf)
  const id = Object.keys(BOSSES).find((k) => (BOSSES[k].counters || []).some((c) => c.kind === 'flash'));
  const C = BOSSES[id].counters.find((c) => c.kind === 'flash'), scope = Object.keys(BOSSES[id].moves).find((m) => BOSSES[id].moves[m].scope);
  const fight = () => { const s = world([pilot([12, 0]), human(oneMove(id, scope))]); s.byId.p.invincible = true; return s; };
  const toScope = (s) => { for (let k = 0; k < 200; k++) { const c = s.byId.b.bossS && s.byId.b.bossS.cur; if (c && c.scope && s.time > c.t0 + 0.3) return true; E.stepWorld(s, {}, 0.05, hooks); } return false; };
  // (a stun bursting at a place in the step about to run, as a thrown one leaves its record)
  const stun = (s, at) => { s.bursts.push({ seq: s.burstSeq++, pos: [...at, 0], t: s.time, radius: 6, effect: 'stun' }); E.stepWorld(s, {}, 0.05, hooks); };

  it('a stun bursting in front of it while its eye is at the scope blinds it: its shot called off, planted, never asleep', () => {
    const s = fight();
    expect(toScope(s)).toBe(true);
    stun(s, [3, 0]);
    const S = s.byId.b.bossS;
    expect(S.blind).toBeGreaterThan(s.time + C.breaks.blind - 0.2);
    expect(s.bossHazards.filter((h) => h.by === 'b' && h.t0 > s.time)).toEqual([]);
    expect(s.bosses.b.counters[C.id].blind).toBe(true);
    expect(s.byId.b.ko || null).toBeNull();
    const at = s.byId.b.transform.pos.slice(); E.stepWorld(s, {}, 0.05, hooks);
    expect(s.byId.b.transform.pos).toEqual(at);
  });

  it('one behind it, or one while no scope is up, does nothing', () => {
    const s = fight();
    expect(toScope(s)).toBe(true);
    stun(s, [-3, 0]);
    expect(s.byId.b.bossS.blind == null).toBe(true);
    const t = world([pilot([12, 0]), human(oneMove(id, scope))]);
    t.byId.p.invincible = true;
    stun(t, [3, 0]);
    expect(t.byId.b.bossS.blind == null).toBe(true);
  });
});

describe('a vehicle boss', () => {
  const at = [0, 0, 0];
  it('a mine under its track breaks the track; both broken, it is stranded and its grille is then there to hit', () => {
    const route = [[0, 0], [30, 0], [30, 20], [0, 20]];
    const s = world([pilot([10, -12]), vehicleEntity('tank', { at, route, hp: 1000 })]);
    run(s, 0.1);
    const T = s.byId.tank;
    // (a hit on the grille while it drives does nothing; mines under each track)
    // (a launcher round on its rear while it drives scratches its armour, a twelfth of what lands: the grille is not there)
    E.bossHit(s, T, 'explosive', [T.transform.pos[0] - 3.6, T.transform.pos[1], 1.6], 100);
    expect(T.body.hp).toBe(992);
    s.mines = [{ id: 'm1', at: [T.transform.pos[0] + 6, T.transform.pos[1] + 1.5, 0], armAt: 0, trip: 1.4, splash: 3, dmg: 40, owner: 'p', team: 'hero' },
      { id: 'm2', at: [T.transform.pos[0] + 6, T.transform.pos[1] - 1.5, 0], armAt: 0, trip: 1.4, splash: 3, dmg: 40, owner: 'p', team: 'hero' }];
    run(s, 4);
    expect(T.bossS.broken).toMatchObject({ 'track-left': true, 'track-right': true });
    expect(T.bossS.state).toBe('stranded');
    const p = T.transform.pos, h = T.transform.heading, back = [p[0] - Math.cos(h) * 3.6, p[1] - Math.sin(h) * 3.6, 1.6];
    E.bossHit(s, T, 'explosive', back, 100);
    expect(T.body.hp).toBe(892);
  });

  it('a walker\'s plate counts its hits; the knee behind it is there to hit only once the plate is off', () => {
    const s = world([pilot([14, 0]), vehicleEntity('walker', { at, hp: 1000 })]);
    run(s, 0.1);
    const Wk = s.byId.walker, on = (q) => { const p = Wk.transform.pos, h = Wk.transform.heading; return [p[0] + q[0] * Math.cos(h) - q[1] * Math.sin(h), p[1] + q[0] * Math.sin(h) + q[1] * Math.cos(h), p[2] + q[2]]; };
    E.bossHit(s, Wk, 'round', on([0, 1.8, 2.4]), 10);
    expect(Wk.bossS.hits['plate-left'] || 0).toBe(0);
    for (let k = 0; k < 3; k++) E.bossHit(s, Wk, 'explosive', on([0, 1.9, 2.4]), 10);
    expect(Wk.bossS.broken['plate-left']).toBe(true);
    for (let k = 0; k < 6; k++) E.bossHit(s, Wk, 'round', on([0, 1.85, 2.4]), 10);
    expect(Wk.bossS.broken['knee-left']).toBe(true);
    run(s, 0.2);
    expect(Wk.bossS.state).toBe('limping');
  });
});

// (the page: a world with a boss carries the director, its pattern functions, the mines and the view; a world with a mine
// alone the mines and the view; one with neither not a byte of them)
import { controllableChannelScript } from '../../scene/channels/controllable/index.js';
describe('the page carries the boss fight only where there is one', () => {
  it('a boss, a mine, neither', () => {
    const cam = { rule: 'follow', target: 'p' }, P = pilot([0, 0]);
    const plain = controllableChannelScript([P], cam, {}), withBoss = controllableChannelScript([P, vehicleEntity('tank', { at: [0, 0, 0] })], cam, {});
    const withMine = controllableChannelScript([{ ...P, rule: { ...P.rule, loadout: [{ name: 'land mine', weapon: { fireClass: 'lob', place: { arm: 1 } } }] } }], cam, {});
    for (const k of ['stepWithBoss', 'buildBossLib', 'stepWithMines', '__bvFrame']) expect(plain).not.toContain(k);
    for (const k of ['stepWithBoss', 'buildBossLib', 'stepWithMines', '__bvFrame']) expect(withBoss).toContain(k);
    expect(withMine).toContain('stepWithMines');
    expect(withMine).not.toContain('stepWithBoss');
  });
});
