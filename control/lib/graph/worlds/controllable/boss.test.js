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
