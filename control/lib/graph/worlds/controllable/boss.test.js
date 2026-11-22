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
