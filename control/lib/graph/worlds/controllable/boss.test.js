import { describe, expect, it } from 'vitest';
import { composeControllable, EMISSION, EMISSION_OPT_IN } from './compose.js';
import { buildCarry } from './carry.js';
import { buildBoss } from './boss.js';

// A BOSS FOUGHT IN PHASES (boss.js): its barrage hurts in the open and not behind cover; its tails reload it, slower for
// each one shot down; the pilot's mines under its tread break a leg, and a broken leg folds it into its tank form; there
// its weak spots are reached only from where they face, and its core worn down destroys it.

const E = composeControllable([...EMISSION, buildCarry, buildBoss]);
const DT = 1 / 30;
const hooks = { ground: () => 0 };
const ON = { r: { at: [0, 2, 6], atTank: [0, 2, 3], barrel: 3 }, l: { at: [0, -2, 6], atTank: [0, -2, 3], barrel: 1 } };
const SPOTS = [
  { id: 'tailR', name: 'the right reloader', part: 'tail', side: 'r', at: { walker: [-3, 0.6, 6], tank: [-3, 0.6, 3] }, hp: 40, from: 'behind' },
  { id: 'tailL', name: 'the left reloader', part: 'tail', side: 'l', at: { walker: [-3, -0.6, 6], tank: [-3, -0.6, 3] }, hp: 40, from: 'behind' },
  { id: 'legR', part: 'leg', side: 'r', at: { walker: [0, 1.2, 0.5] }, hp: 100, by: 'mine', phases: ['stand'] },
  { id: 'legL', part: 'leg', side: 'l', at: { walker: [0, -1.2, 0.5] }, hp: 100, by: 'mine', phases: ['stand'] },
  { id: 'engine', part: 'engine', at: { tank: [-2.6, 0, 2] }, core: 1, from: 'behind', phases: ['tank'] },
];
const BOSS = (over = {}) => ({
  name: 'Siege walker', hp: 100, fold: 1, weapons: ON, spots: SPOTS, mine: { item: 'mine', arm: 0.5 }, down: { item: 'walker-down' },
  phases: {
    stand: { kind: 'walker', speed: 3, turn: 0.8, stride: 7, then: 'tank', fall: 0.5,
      barrage: { aim: 0.5, shells: 2, gap: 0.3, missiles: 0, scatter: 0, flight: 1, r: 5, hurt: 40 }, reload: { secs: 2, slow: [1, 2, 3] }, advance: { max: 12, stop: 1 }, legs: { break: 100 } },
    tank: { kind: 'tank', speed: 5, turn: 0.6, stride: 3, gun: { lay: 0.6, traverse: 90 }, reload: { secs: 1.5 } },
  },
  ...over,
});
const spotEnts = (spots = SPOTS) => spots.filter((s) => (s.by || 'round') === 'round').map((s) => ({ id: `b:${s.id}`, rule: { type: 'static', bossSpot: { boss: 'b', spot: s.id } }, body: { type: 'none', radius: 0.8, egg: { a: 0.8, c: 0.8, cz: 0.8 } }, transform: { pos: [0, 0, 0], heading: 0 } }));
const world = ({ at = [30, 0, 0], colliders = null, boss = BOSS(), mines = 4, transformDur = 1 } = {}) => E.createWorld({
  ...(colliders ? { colliders } : {}),
  camera: { rule: 'follow', target: 'p' },
  entities: [
    { id: 'p', pilotable: true, rule: { type: 'platform', speed: 4, eye: 0, collideHeight: 1.7, carry: { items: [{ id: 'mine', name: 'mine', count: mines }] } }, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: at, heading: Math.PI } },
    { id: 'b', rule: { type: 'static', boss }, transformDur, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } },
    ...spotEnts(),
  ],
});
const run = (w, secs, input = {}) => { for (let i = 0; i < Math.round(secs / DT); i++) E.stepWorld(w, input, DT, hooks); };
const facts = (w) => E.bossFacts(w, 'b');
// a round of the pilot's landing on a spot's body, as the rounds' hit leaves it
const shoot = (w, spot, dmg) => { const s = w.byId[`b:${spot}`]; s.hits = (s.hits || 0) + 1; s.lastHitDmg = dmg; };
const layMine = (w) => { E.stepWorld(w, { itemHold: 1 }, DT, hooks); E.stepWorld(w, {}, DT, hooks); };

describe('the boss: a barrage, and cover', () => {
  it('a barrage aimed at a pilot in the open hurts it; behind a wall between it and the burst, nothing does', () => {
    const open = world();
    run(open, 0.6 + 0.6 + 1.2);
    expect(open.byId.p.body.hp).toBeLessThan(100);
    // (a wall 1.5 m high, a metre on the boss's side of the pilot: the bursts land on the pilot, so the line to its chest
    // and to its head runs through the wall only when the burst lands beyond it; a burst on top of the pilot is not covered)
    const off = world({ boss: BOSS({ phases: { ...BOSS().phases, stand: { ...BOSS().phases.stand, barrage: { ...BOSS().phases.stand.barrage, r: 8 } } } }) });
    run(off, 0.6);
    // (the pilot steps behind a wall once the shells are in the air, out of where they fall)
    const p = off.byId.p; p.transform.pos = [34, 0, 0];
    off.colliders = [{ min: [32.5, -5, 0], max: [33, 5, 3] }];
    run(off, 2);
    expect(off.byId.p.body.hp).toBe(100);
    expect(facts(off).cycle).toBe(1);
  });

  it('it reloads with its tails, slower for each one shot down from behind', () => {
    const w = world();
    run(w, 0.6 + 0.7);
    expect(facts(w).step).toBe('reload');
    expect(facts(w).reloadFor).toBeCloseTo(2, 5);
    // (from in front, the reloaders cannot be hit: their bodies are not hittable there)
    expect(w.byId['b:tailR'].body.hittable).toBe(false);
    w.byId.p.transform.pos = [-20, 0, 0];
    run(w, DT);
    expect(w.byId['b:tailR'].body.hittable).toBe(true);
    shoot(w, 'tailR', 25); run(w, DT); shoot(w, 'tailR', 25); run(w, DT);
    const F = facts(w);
    expect(F.spots.tailR.gone).toBe(true);
    expect(F.tailsLost).toBe(1);
    expect(F.reloadFor).toBeCloseTo(4, 5);
    expect(w.byId.b.locomotion).toBe('tails:reload');
  });
});

describe('the boss: mines, the legs and the fold', () => {
  it('a mine laid where it walks breaks a leg under its tread; broken, it falls, folds and fights as a tank', () => {
    const w = world({ at: [11, 0.8, 0] });
    // (two mines where it will walk, laid at the pilot's feet off its right foot's side; the pilot waits there for the
    // barrage to be laid on it, then runs: it walks on to where the shells fell, over the mines)
    layMine(w); w.byId.p.transform.pos = [12, 1, 0]; layMine(w);
    expect(w.bossFx.mines.length).toBe(2);
    run(w, 0.6);
    w.byId.p.transform.pos = [30, 25, 0];
    let legs = null;
    for (let i = 0; i < 600 && facts(w).phase === 'stand'; i++) { run(w, DT); legs = facts(w).spots; }
    expect(legs.legR.hp + legs.legL.hp).toBeLessThan(200);
    expect(['fall', 'transform', 'tank']).toContain(facts(w).phase);
    run(w, 0.6 + 1.1);
    expect(facts(w).phase).toBe('tank');
    expect(w.byId.b.form).toBe('tank');
  });
});

describe('the boss: the tank, its weak spots and its end', () => {
  const tank = () => world({ boss: BOSS({ start: 'tank' }) });
  it('its engine is reached from behind only; worn through it, the boss is destroyed and the mission holds its item', () => {
    const w = tank();
    w.ms = { held: {} };
    run(w, DT);
    expect(w.byId['b:engine'].body.hittable).toBe(false);
    w.byId.p.transform.pos = [-25, 0, 0];
    run(w, DT);
    expect(w.byId['b:engine'].body.hittable).toBe(true);
    for (let k = 0; k < 5; k++) { shoot(w, 'engine', 25); run(w, DT); }
    expect(facts(w).phase).toBe('down');
    expect(w.ms.held['walker-down']).toBe(true);
    // (and a leg spot is no part of its tank form: never hittable, never laid as a body)
    expect(w.byId['b:legR']).toBeUndefined();
  });

  it('a sleep dart hurts no machine', () => {
    const w = tank();
    w.byId.p.rule.loadout = [{ name: 'dart gun', weapon: { fireClass: 'sight', stun: true, damage: 100 } }]; w.byId.p.loadoutIdx = 0;
    w.byId.p.transform.pos = [-25, 0, 0];
    run(w, DT); shoot(w, 'engine', 100); run(w, DT);
    expect(facts(w).hp).toBe(100);
  });

  it('it lays its gun on the pilot and fires along the line: a pilot that stays on it is hit, the same every run', () => {
    const a = tank(), b = tank();
    run(a, 6); run(b, 6);
    expect(a.byId.p.body.hp).toBeLessThan(100);
    expect(a.byId.p.body.hp).toBe(b.byId.p.body.hp);
    expect(a.byId.b.transform.pos).toEqual(b.byId.b.transform.pos);
  });
});

describe('the boss: absent, nothing', () => {
  it('is an opt-in of the page, and a world without a boss steps as it did without it', () => {
    expect(EMISSION_OPT_IN.boss).toBe(buildBoss);
    const plain = composeControllable([...EMISSION, buildCarry]);
    const spec = () => ({ entities: [{ id: 'p', pilotable: true, rule: { type: 'platform', speed: 4, eye: 0 }, body: { type: 'mesh', hp: 100 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    const x = E.createWorld(spec()), y = plain.createWorld(spec());
    for (let i = 0; i < 30; i++) { E.stepWorld(x, { moveY: 1 }, DT, hooks); plain.stepWorld(y, { moveY: 1 }, DT, hooks); }
    expect(x.byId.p.transform).toEqual(y.byId.p.transform);
    expect(x.bossFx).toBeUndefined();
  });
});

// THE CARRIER (boss.js CARRIER): its gunners lay bursts on a pilot in their arc and stay down once put down; its drones
// are endless; a courier held in the RF gun is hacked, fetches a package and goes off in a hangar door; from the second
// delivery its hunters chase the hacked courier; three deliveries destroy it.
describe('the boss: a carrier, its gunners and its own drones turned on it', () => {
  const DOORS = { r: [0, 1.5, 7], l: [0, -1.5, 7] };
  const CREW = [
    { id: 'gunnerR', name: 'the right gunner', part: 'crew', at: { walker: [0, 1.2, 6] }, face: 90, arc: 75, door: 'r' },
    { id: 'gunnerL', name: 'the left gunner', part: 'crew', at: { walker: [0, -1.2, 6] }, face: -90, arc: 75, door: 'l' },
  ];
  const CARRIER = {
    kind: 'carrier', crew: { lay: 0.5, every: 1, burst: 2, hurt: 10, range: 45 },
    drones: { reprint: 3, alt: 7, speed: 10, orbit: 15, hunter: { most: 2, see: 0, drop: { every: 99 } }, courier: { every: 0.5, stay: 60, speed: 6, orbit: 12 }, chase: { after: 1, most: 2, every: 1, hurt: 15, range: 30 } },
    hack: { secs: 1, decay: 0.3, slip: 0.3 }, packages: [{ id: 'pkg', at: [10, -12, 0] }], restock: 2, delivery: { core: 110, r: 4 }, doors: DOORS,
  };
  const RF = { name: 'RF gun', weapon: { fireClass: 'sight', auto: true, rof: 10, damage: 0, magazine: 999, range: 60, jam: true, coreAngle: 3 } };
  const drone = (i, role) => ({ id: `c:d${i}`, team: 'brood', rule: { type: 'static', bossDrone: { boss: 'c', role, bay: [i % 2 ? 2 : -2, i % 3 - 1, 3] } }, body: { type: 'none', hittable: false, hp: role === 'courier' ? 120 : 30, radius: 0.6, egg: { a: 0.6, c: 0.35, cz: 0 } }, transform: { pos: [0, 0, 0], heading: 0 } });
  // (the RF gun's round on a body, as the rounds leave it: the shot's target, inside the step)
  function buildAim(X) { const step = X.stepWorld; X.stepWorld = function stepWithAim(state, input, dt, h) { const out = step(state, input, dt, h); if (state.aimAt) state.byId.p.lastShot = { mode: 'core', targetId: state.aimAt, t: state.time }; return out; }; }
  const EA = composeControllable([...EMISSION, buildCarry, buildAim, buildBoss]);
  const runA = (w, secs) => { for (let i = 0; i < Math.round(secs / DT); i++) EA.stepWorld(w, {}, DT, hooks); };
  const carrierWorld = ({ at = [0, -25, 0] } = {}) => EA.createWorld({
    camera: { rule: 'follow', target: 'p' },
    entities: [
      { id: 'p', pilotable: true, team: 'pilot', rule: { type: 'platform', speed: 4, eye: 0, collideHeight: 1.7, loadout: [RF] }, weapon: RF.weapon, body: { type: 'mesh', hittable: true, hp: 100 }, transform: { pos: at, heading: Math.PI / 2 } },
      { id: 'c', rule: { type: 'static', boss: { name: 'Brood walker', hp: 330, phases: { brood: CARRIER }, spots: CREW, weapons: {} } }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0 } },
      ...CREW.map((sp) => ({ id: `c:${sp.id}`, team: 'brood', rule: { type: 'static', bossSpot: { boss: 'c', spot: sp.id } }, body: { type: 'mesh', hittable: true, hp: 100, egg: { a: 0.35, c: 0.9, cz: 0.9 } }, transform: { pos: [0, 0, 0], heading: 0 } })),
      drone(1, 'courier'), drone(2, 'hunter'), drone(3, 'hunter'),
    ],
  });
  const B = (w) => EA.bossFacts(w, 'c');
  // the RF gun held on a courier: what its round leaves (the beam is the rounds' own: the shot's target)
  // (laid inside the step, as the RF gun's rounds would: buildAim below)
  const holdOn = (w, id, secs) => { w.aimAt = id; for (let i = 0; i < Math.round(secs / DT); i++) EA.stepWorld(w, { fire: 1 }, DT, hooks); w.aimAt = null; };
  const courierOut = (w) => { for (let i = 0; i < 300 && !(w.byId['c:d1'].drone && w.byId['c:d1'].drone.st === 'lap'); i++) runA(w, DT); };

  it('a gunner whose arc the pilot stands in fires on it; put down, it stays down and the burst stops', () => {
    // (the pilot off the right side: the right gunner's arc, the left's never)
    const w = carrierWorld({ at: [0, -25, 0] });
    runA(w, 3);
    expect(w.byId.p.body.hp).toBeLessThan(100);
    const hp = w.byId.p.body.hp;
    w.byId['c:gunnerR'].ko = { t0: w.time }; w.byId['c:gunnerR'].downed = true;
    runA(w, DT);
    expect(B(w).crew.gunnerR).toBe(false);
    runA(w, 3);
    expect(w.byId.p.body.hp).toBe(hp);
  });

  it('only a courier is hacked; hacked, it fetches the package, goes home by the open door and goes off in it', () => {
    const w = carrierWorld({ at: [0, 30, 0] });
    w.byId['c:gunnerR'].downed = true; w.byId['c:gunnerL'].downed = true;
    courierOut(w);
    expect(B(w).drones['c:d1'].st).toBe('lap');
    // (a hunter in the beam is not hacked)
    runA(w, 1); holdOn(w, 'c:d2', 1.2);
    expect(B(w).drones['c:d2'].hacked).toBe(false);
    holdOn(w, 'c:d1', 1.2);
    expect(B(w).drones['c:d1'].hacked).toBe(true);
    for (let i = 0; i < 1200 && B(w).deliveries === 0; i++) runA(w, DT);
    expect(B(w).deliveries).toBe(1);
    expect(B(w).hp).toBe(220);
    expect(B(w).drones['c:d1'].st).toBe('dock');
  });

  it('the beam let go drains the hack; from the second delivery its hunters chase the hacked courier and shoot it down', () => {
    const w = carrierWorld({ at: [0, 30, 0] });
    w.byId['c:gunnerR'].downed = true; w.byId['c:gunnerL'].downed = true;
    courierOut(w);
    holdOn(w, 'c:d1', 0.5);
    const u = B(w).jam.u;
    expect(u).toBeGreaterThan(0.3);
    runA(w, 0.5);
    expect(B(w).jam.u).toBeLessThan(u);
    // (one delivered, then the next hacked: chased, and left alone it is shot down, its package lost)
    w.byId.c.boss.deliveries = 1;
    holdOn(w, 'c:d1', 1.2);
    runA(w, 0.2);
    expect(Object.values(B(w).drones).filter((d) => d.chase).length).toBeGreaterThan(0);
    for (let i = 0; i < 900 && B(w).drones['c:d1'].hacked; i++) runA(w, DT);
    expect(B(w).drones['c:d1'].hacked).toBe(false);
    expect(B(w).deliveries).toBe(1);
  });

  it('three deliveries destroy it, and its drones fall', () => {
    const w = carrierWorld({ at: [0, 30, 0] });
    w.byId['c:gunnerR'].downed = true; w.byId['c:gunnerL'].downed = true;
    runA(w, DT); w.ms = { held: {} }; w.byId.c.boss.cfg.down = { item: 'brood-down' };
    w.byId.c.boss.hp = 110;
    courierOut(w); holdOn(w, 'c:d1', 1.2);
    // (its chasers kept off: shot down as they come)
    for (let i = 0; i < 1500 && B(w).phase !== 'down'; i++) { for (const id of ['c:d2', 'c:d3']) if (w.byId[id].drone.chase) w.byId[id].body.hp = 0; runA(w, DT); }
    expect(B(w).phase).toBe('down');
    expect(w.ms.held['brood-down']).toBe(true);
  });
});
