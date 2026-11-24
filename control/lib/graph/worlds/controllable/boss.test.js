import { describe, it, expect } from 'vitest';
import { composeLive, composeControllable, EMISSION, EMISSION_OPT_IN } from './compose.js';
import { bossRule, vehicleEntity, carrierEntities } from '../../boss/stand.js';
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

  it('a hazard that says how high it reaches misses a body whose feet are over it: a jump clears it', () => {
    // (a boss of the side view's spring, `lunge`: a low line down the aim)
    const row = { ...BOSSES[id], moves: { ...BOSSES[id].moves, spring: { pattern: 'lunge', says: 'springs low' } } };
    const R = bossRule(row, { first: 0.5 }), rule = { ...R, phases: R.phases.map((p) => ({ ...p, moves: { spring: 1 } })) };
    const s = world([pilot([4, 0]), human(rule)]);
    run(s, 3);
    expect(s.byId.p.body.hp).toBeLessThan(100);
    const t = world([pilot([4, 0]), human(rule)]);
    run(t, 3, {}, (w) => { w.byId.p.transform.pos[2] = 1.6; w.byId.p.vel = [0, 0, 0]; });
    expect(t.byId.p.body.hp).toBe(100);
  });

  it('a boss kept to its room takes no move while the body is out of it', () => {
    const rule = { ...oneMove(id, charge), room: [-5, 5, -1, 4] };
    const s = world([pilot([0, 12]), human(rule)]);
    run(s, 4);
    expect(s.bossHazards.length).toBe(0);
    s.byId.p.transform.pos = [0, 3, 0];
    run(s, 3);
    expect(s.byId.p.body.hp).toBeLessThan(100);
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

// A MECHA (boss.js `frame`): THE SIEGE WALKER, its barrage and cover, its reload slowed by its reloaders shot from behind,
// mines under its feet folding it into a tank, beaten as a tank with its hips open from its sides.
describe('the siege walker', () => {
  const ROUTE = [[-20, 0], [20, 0]];
  const walker = (extra = {}) => ({ ...vehicleEntity('siege-walker', { at: [-20, 0], hp: 300, route: ROUTE, seed: 3 }), ...extra });
  const local = (e, q) => { const h = e.transform.heading, p = e.transform.pos; return [p[0] + Math.cos(h) * q[0] - Math.sin(h) * q[1], p[1] + Math.sin(h) * q[0] + Math.cos(h) * q[1], p[2] + q[2]]; };
  const mid = (box) => [0, 1, 2].map((k) => (box[0][k] + box[1][k]) / 2);
  const st = (s) => s.byId['siege-walker'].bossS.state;

  it('its barrage lands on a body in the open; a wall between its gun and the body, nothing does', () => {
    const open = world([pilot([0, 0]), walker()]);
    run(open, 9);
    expect(open.byId.p.body.hp).toBeLessThan(100);
    const covered = world([pilot([0, 0]), walker()], { colliders: [{ min: [-3, -6, 0], max: [-2.5, 6, 3] }] });
    run(covered, 9);
    expect(covered.byId.p.body.hp).toBe(100);
  });

  it('its tails reload it; each reloader shot from behind (and only from behind) makes the reload slower', () => {
    const s = world([pilot([30, 0]), walker()]);
    run(s, 0.1);
    const e = s.byId['siege-walker'], tail = local(e, mid(e.rule.boss.parts['tail-right'].box));
    // (from in front: nothing counts)
    for (let k = 0; k < 4; k++) E.bossHit(s, e, 'round', tail, 0, local(e, [20, 0, 1.5]));
    run(s, 0.05);
    expect(s.bosses['siege-walker'].broken).not.toContain('tail-right');
    for (const side of ['tail-right', 'tail-left']) { const q = local(e, mid(e.rule.boss.parts[side].box)); for (let k = 0; k < 4; k++) E.bossHit(s, e, 'round', q, 0, local(e, [-20, 0, 1.5])); }
    run(s, 0.05);
    expect(s.bosses['siege-walker'].broken).toEqual(expect.arrayContaining(['tail-right', 'tail-left']));
    let t0 = null, t1 = null;
    run(s, 40, {}, (w) => { if (st(w) === 'reloading' && t0 == null) t0 = w.time; if (t0 != null && t1 == null && st(w) !== 'reloading') t1 = w.time; });
    // (eight seconds, 1.8 times that for each of the two)
    expect(t1 - t0).toBeGreaterThan(8 * 2.6 - 0.2);
    expect(s.byId['siege-walker'].locomotion).toBeDefined();
  });

  it('mines on its round break a leg under it: it folds onto its wheels and fights as a tank, its hips open from its sides', () => {
    const s = world([pilot([0, 25]), walker()]);
    run(s, 0.1);
    // (two mines on its round, armed, a stride ahead of where it walks)
    s.mines = [{ id: 'm1', at: [-6, -1.2, 0], armAt: 0, trip: 1.4, splash: 3.5, dmg: 40, owner: 'p', team: 'hero' }, { id: 'm2', at: [2, -1.2, 0], armAt: 0, trip: 1.4, splash: 3.5, dmg: 40, owner: 'p', team: 'hero' }];
    const seen = new Set();
    run(s, 60, {}, (w) => seen.add(st(w)));
    expect(seen.has('folding')).toBe(true);
    expect(st(s)).toBe('tank');
    const e = s.byId['siege-walker'];
    expect(e.form).toBe('tank');
    // (a hip from in front counts nothing; from its side it hurts)
    const hp = e.body.hp, hip = local(e, mid(e.rule.boss.parts['hip-right'].box));
    E.bossHit(s, e, 'round', hip, 20, local(e, [20, 0, 1]));
    expect(e.body.hp).toBe(hp);
    E.bossHit(s, e, 'round', hip, 20, local(e, [0, -20, 1]));
    expect(e.body.hp).toBeLessThan(hp);
  });
});

// A CARRIER (boss.js `carrier`): THE BROOD WALKER, its gunners, its drones hacked with the RF gun and turned on it.
describe('the brood walker', () => {
  // (the RF gun's round on a drone, laid inside the step as its rounds would: a builder before the director)
  function buildAim(X) { const step = X.stepWorld; X.stepWorld = function stepWithAim(state, input, dt, h) { const out = step(state, input, dt, h); if (state.aimAt) state.byId.p.lastShot = { mode: 'core', targetId: state.aimAt, t: state.time }; return out; }; }
  const OPT = Object.entries(EMISSION_OPT_IN), at = OPT.findIndex(([k]) => k === 'bossLib');
  const EA = composeControllable([...EMISSION, ...OPT.slice(0, at).map(([, b]) => b), buildAim, ...OPT.slice(at).map(([, b]) => b)]);
  const RF = { name: 'RF gun', weapon: { fireClass: 'sight', auto: true, rof: 10, damage: 0, magazine: 999, range: 60, jam: true } };
  const runA = (s, secs, input = {}, each) => { for (let k = 0; k < secs / 0.05; k++) { EA.stepWorld(s, input, 0.05, hooks); if (each) each(s); } return s; };
  const brood = (pilotAt, { hp = 330 } = {}) => EA.createWorld({ camera: { rule: 'follow', target: 'p' }, entities: [
    pilot(pilotAt, { rule: { type: 'platform', speed: 5, eye: 0, jumpSpeed: 0, collideHeight: 1.7, loadout: [RF] }, weapon: RF.weapon }),
    vehicleEntity('brood-walker', { at: [0, 0], hp, packages: [{ id: 'pkg', at: [10, -12] }] }),
    ...carrierEntities('brood-walker', { at: [0, 0], crewBody: { figure: 'guard', hp: 100 } }),
  ] });
  const C = (s) => s.bosses['brood-walker'].carrier;
  const crewDown = (s) => { for (const id of ['roof', 'door-right', 'door-left']) s.byId[`brood-walker:${id}`].downed = true; };
  const holdOn = (s, id, secs) => { s.aimAt = id; runA(s, secs, { fire: 1 }); s.aimAt = null; };
  const lapping = (s) => ['brood-walker:drone1', 'brood-walker:drone8'].find((id) => s.byId[id].drone && s.byId[id].drone.st === 'lap');
  const courierOut = (s) => { for (let k = 0; k < 600 && !lapping(s); k++) runA(s, 0.05); return lapping(s); };

  it('a gunner fires on the pilot in its arc; down, it stays down and fires no more', () => {
    // (off its right side: the right door gunner's arc)
    const s = brood([0, -25]);
    runA(s, 6);
    expect(s.byId.p.body.hp).toBeLessThan(100);
    expect(C(s).crew['door-right'].up).toBe(true);
    s.byId['brood-walker:door-right'].ko = { t0: s.time }; s.byId['brood-walker:roof'].downed = true;
    runA(s, 0.1);
    const hp = s.byId.p.body.hp;
    runA(s, 6);
    expect(C(s).crew['door-right'].up).toBe(false);
    expect(s.byId.p.body.hp).toBe(hp);
  });

  it('only a courier is hacked; hacked, it fetches the package and goes off in an open door', () => {
    const s = brood([0, 30]);
    runA(s, 0.05); crewDown(s);
    const c1 = courierOut(s);
    holdOn(s, 'brood-walker:drone2', 1); runA(s, 0.05);
    expect(C(s).drones['brood-walker:drone2'].hacked).toBe(false);
    holdOn(s, c1, 2.4);
    expect(C(s).drones[c1].hacked).toBe(true);
    runA(s, 60, {}, () => {}); 
    expect(C(s).deliveries).toBeGreaterThanOrEqual(1);
    expect(s.byId['brood-walker'].body.hp).toBeLessThanOrEqual(220);
  });

  it('from the second delivery its hunters chase the hacked courier and, left alone, shoot it down', () => {
    const s = brood([0, 30]);
    runA(s, 0.05); crewDown(s);
    s.byId['brood-walker'].bossS.carrier.deliveries = 1;
    const c1 = courierOut(s);
    holdOn(s, c1, 2.4);
    runA(s, 0.2);
    expect(Object.values(C(s).drones).some((d) => d.chase)).toBe(true);
    let lost = false;
    runA(s, 40, {}, (w) => { if (!C(w).drones[c1].hacked) lost = true; });
    expect(lost).toBe(true);
    expect(C(s).deliveries).toBe(1);
  });

  it('three deliveries destroy it, and its drones fall', () => {
    const s = brood([0, 30], { hp: 330 });
    runA(s, 0.05); crewDown(s);
    for (let n = 0; n < 6 && !s.bosses['brood-walker'].down; n++) {
      // (the pilot kept standing through the minutes it takes: its hunters' drops are another test's)
      s.byId.p.body.hp = 100;
      holdOn(s, courierOut(s), 2.4);
      // (its chasers kept off it)
      runA(s, 60, {}, (w) => { for (const x of w.byId['brood-walker'].bossS.carrier.drones) if (x.drone.chase) x.body.hp = 0; });
    }
    expect(s.bosses['brood-walker'].down).toBe(true);
    expect(s.bosses['brood-walker'].carrier.deliveries).toBe(3);
  });
});
