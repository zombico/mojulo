import { describe, expect, it } from 'vitest';

import { createWorld, stepWorld } from '../controllable-world.js';
import { composeControllable, EMISSION } from './compose.js';

// run a fixed input for N steps at fixed dt.
const run = (state, input, steps, dt = 1 / 60, hooks) => { for (let i = 0; i < steps; i++) stepWorld(state, input, dt, hooks); return state; };

// a pilotable dummy the director reads as "the pilot" without any live rule fighting the
// test's hand-set state ('static' has no RULES entry, so nothing resets what we poke).
const pilotEnt = (over = {}) => ({ id: 'p', pilotable: true, rule: { type: 'static' }, body: { type: 'none', hittable: true, hp: 100, poise: 100 }, ...over });

const tutWorld = (steps, extras = [], spec = {}) => createWorld({
  entities: [pilotEnt(), ...extras],
  tutorial: { steps },
  ...spec,
});

describe('tutorial director (tutorial-mode.plan.md T1) — state init + step machine', () => {
  it('absent spec.tutorial → state.tutorial null (byte-identical opt-in)', () => {
    const w = createWorld({ entities: [pilotEnt()] });
    expect(w.tutorial).toBeNull();
    run(w, {}, 5);   // the pass is inert
    expect(w.tutorial).toBeNull();
  });

  it('normalizes steps and enters step 0 on the first pass', () => {
    const w = tutWorld([{ prompt: 'MOVE OUT', goal: { fact: 'move', count: 10 } }]);
    expect(w.tutorial.idx).toBe(-1);
    run(w, {}, 1);
    expect(w.tutorial.idx).toBe(0);
    expect(w.tutorial.steps[0].id).toBe('step-0');
    expect(w.tutorial.steps[0].goal.count).toBe(10);
    expect(w.tutorial.over).toBe(false);
  });

  it('move: accumulates the pilot planar distance and advances at count', () => {
    const w = tutWorld([{ goal: { fact: 'move', count: 5 } }, { goal: { fact: 'jump' } }]);
    run(w, {}, 1);
    for (let i = 0; i < 8; i++) { w.byId.p.transform.pos[0] += 1; stepWorld(w, {}, 1 / 60); }
    expect(w.tutorial.idx).toBe(1);   // 8 units > 5 → advanced
  });

  it('boost: integrates seconds while e.boosting', () => {
    const w = tutWorld([{ goal: { fact: 'boost', count: 0.5 } }, { goal: { fact: 'jump' } }]);
    run(w, {}, 1);
    w.byId.p.boosting = true;
    run(w, {}, 31);   // ~0.52s
    expect(w.tutorial.idx).toBe(1);
  });

  it('boost-steer: counts mid-boost dominant-direction flips', () => {
    const w = tutWorld([{ goal: { fact: 'boost-steer', count: 2 } }, { goal: { fact: 'jump' } }]);
    run(w, {}, 1);
    const p = w.byId.p;
    p.boosting = true; p.boostDir = 'boost'; run(w, {}, 1);
    p.boostDir = 'boost_left'; run(w, {}, 1);    // flip 1
    run(w, {}, 3);                                // held — no extra counts
    expect(w.tutorial.idx).toBe(0);
    p.boostDir = 'boost_right'; run(w, {}, 1);   // flip 2 → advance
    expect(w.tutorial.idx).toBe(1);
  });

  it('jump: the grounded→airborne launch edge, boost excluded', () => {
    const w = tutWorld([{ goal: { fact: 'jump' } }, { goal: { fact: 'boost' } }]);
    run(w, {}, 1);
    const p = w.byId.p;
    p.grounded = true; run(w, {}, 1);
    p.boosting = true; p.grounded = false; p.vel[2] = 8; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(0);   // a boost lift is not the jump
    p.boosting = false; p.grounded = true; p.vel[2] = 0; run(w, {}, 1);
    p.grounded = false; p.vel[2] = 8; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(1);
  });

  it('hit / clip-empty / switch: the firing chapter facts', () => {
    const tgt = { id: 'z', rule: { type: 'static' }, body: { type: 'none', hittable: true, hp: 50, poise: 100 } };
    const w = tutWorld([
      { goal: { fact: 'hit', of: 'z', count: 2 } },
      { goal: { fact: 'clip-empty' } },
      { goal: { fact: 'switch', slot: 1 } },
      { goal: { fact: 'jump' } },
    ], [tgt]);
    run(w, {}, 1);
    w.byId.z.hits = 1; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(0);
    w.byId.z.hits = 2; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(1);   // two hits landed
    const p = w.byId.p;
    p.weapon = { reloading: false }; run(w, {}, 1);
    p.weapon.reloading = true; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(2);   // the auto-reload edge = clip ran dry
    p.switched = true; p.loadoutIdx = 0; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(2);   // wrong slot
    p.loadoutIdx = 1; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(3);
    p.switched = false;
  });

  it('swing (directional) / combo / stagger / destroy: the melee chapter facts', () => {
    const tgt = { id: 'z', rule: { type: 'static' }, body: { type: 'none', hittable: true, hp: 50, poise: 100 } };
    const w = tutWorld([
      { goal: { fact: 'swing', dir: 'left' } },
      { goal: { fact: 'swing', dir: 'back' } },
      { goal: { fact: 'combo' } },
      { goal: { fact: 'stagger', of: 'z' } },
      { goal: { fact: 'destroy', of: 'z' } },
    ], [tgt]);
    run(w, {}, 1);
    const p = w.byId.p;
    p.swingCount = 1; p.lastSwingDir = 'right'; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(0);   // wrong direction
    p.swingCount = 2; p.lastSwingDir = 'left'; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(1);
    p.swingCount = 3; p.lastSwingDir = 'back'; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(2);   // the downswing
    p.meleeHitCount = 1; p.swingCombo = false; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(2);   // a plain connect is not the combo
    p.meleeHitCount = 2; p.swingCombo = true; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(3);   // the follow-up connected
    w.byId.z.staggerT = 0; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(4);
    w.byId.z.downed = true; run(w, {}, 1);
    expect(w.tutorial.over).toBe(true);
    expect(w.tutorial.result).toBe('success');
  });

  it('ascend / descend: vertical travel integrates like move, signed by the fact', () => {
    const w = tutWorld([
      { goal: { fact: 'ascend', count: 10 } },
      { goal: { fact: 'descend', count: 10 } },
      { goal: { fact: 'switch' } },
    ]);
    run(w, {}, 1);
    const p = w.byId.p;
    p.transform.pos[2] -= 20; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(0);            // sinking is not ascending
    p.transform.pos[2] += 12; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(1);            // 12 up ≥ 10
    p.transform.pos[2] += 12; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(1);            // rising is not descending
    p.transform.pos[2] -= 12; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(2);
  });

  it('tackle / dodge: the maneuver-counter facts (edge off e.tackleCount / e.dodgeCount)', () => {
    const w = tutWorld([
      { goal: { fact: 'tackle' } },
      { goal: { fact: 'dodge' } },
      { goal: { fact: 'jump' } },
    ]);
    run(w, {}, 1);
    const p = w.byId.p;
    p.dodgeCount = 1; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(0);   // a dodge is not the tackle
    p.tackleCount = 1; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(1);
    p.dodgeCount = 2; run(w, {}, 1);
    expect(w.tutorial.idx).toBe(2);
  });

  it('heal on step entry restores hull + shield to the minted max; of:[ids] needs every named body', () => {
    const r1 = { id: 'r1', rule: { type: 'static' }, body: { type: 'none', hittable: true, hp: 20, poise: 10 } };
    const r2 = { id: 'r2', rule: { type: 'static' }, body: { type: 'none', hittable: true, hp: 20, poise: 10 } };
    const w = createWorld({
      entities: [pilotEnt({ body: { type: 'none', hittable: true, hp: 100, poise: 100, shield: { hp: 50, arc: 120 } } }), r1, r2],
      tutorial: { steps: [
        { goal: { fact: 'switch' } },
        { heal: ['pilot'], goal: { fact: 'destroy', of: ['r1', 'r2'], count: 2 } },
      ] },
    });
    run(w, {}, 1);
    const p = w.byId.p;
    p.body.hp = 30; p.shieldHp = 5;            // chewed up in "phase 1"
    p.switched = true; run(w, {}, 1);          // advance → heal fires on entry
    expect(w.tutorial.idx).toBe(1);
    expect(p.body.hp).toBe(100);
    expect(p.shieldHp).toBe(50);
    w.byId.r1.downed = true; run(w, {}, 1);
    expect(w.tutorial.over).toBe(false);       // one of two — the set needs both
    w.byId.r2.downed = true; run(w, {}, 1);
    expect(w.tutorial.over).toBe(true);
    expect(w.tutorial.result).toBe('success');
  });

  it('optional step: the pilot going down ends the script with SUCCESS (the clear was already earned)', () => {
    const w = tutWorld([
      { goal: { fact: 'switch' } },
      { optional: true, goal: { fact: 'boost', count: 5 } },
    ]);
    run(w, {}, 1);
    const p = w.byId.p;
    p.downed = true; run(w, {}, 1);            // down on the REQUIRED step → fail
    expect(w.tutorial.over).toBe(true);
    expect(w.tutorial.result).toBe('fail');
    const w2 = tutWorld([
      { goal: { fact: 'switch' } },
      { optional: true, goal: { fact: 'boost', count: 5 } },
    ]);
    run(w2, {}, 1);
    const p2 = w2.byId.p;
    p2.switched = true; run(w2, {}, 1);
    expect(w2.tutorial.idx).toBe(1);           // in the optional phase now
    p2.downed = true; run(w2, {}, 1);          // going down here merely confirms
    expect(w2.tutorial.over).toBe(true);
    expect(w2.tutorial.result).toBe('success');
  });

  it('softlock guard: a step whose named target is already down self-completes', () => {
    const tgt = { id: 'z', rule: { type: 'static' }, body: { type: 'none', hittable: true, hp: 50, poise: 100 } };
    const w = tutWorld([
      { goal: { fact: 'stagger', of: 'z', count: 2 } },
      { goal: { fact: 'destroy', of: 'z' } },
    ], [tgt]);
    run(w, {}, 1);
    w.byId.z.downed = true;   // destroyed while the stagger lesson was still open
    run(w, {}, 2);            // stagger self-completes, then destroy self-completes
    expect(w.tutorial.over).toBe(true);
    expect(w.tutorial.result).toBe('success');
  });

  it("of:'*' matches any non-pilot body", () => {
    const a = { id: 'a', rule: { type: 'static' }, body: { type: 'none', hittable: true, hp: 10, poise: 10 } };
    const w = tutWorld([{ goal: { fact: 'destroy', of: '*' } }], [a]);
    run(w, {}, 1);
    w.byId.a.downed = true; run(w, {}, 1);
    expect(w.tutorial.over).toBe(true);
  });

  it('the pilot going down fails the script', () => {
    const w = tutWorld([{ goal: { fact: 'jump' } }]);
    run(w, {}, 1);
    w.byId.p.downed = true; run(w, {}, 1);
    expect(w.tutorial.over).toBe(true);
    expect(w.tutorial.result).toBe('fail');
  });

  it("set.aiDifficulty on step entry retunes the world brain (the L2 phase switch)", () => {
    const cw = composeControllable(EMISSION);
    const w = cw.createWorld({
      entities: [pilotEnt()],
      tutorial: { steps: [
        { goal: { fact: 'jump' }, set: { aiDifficulty: 'easy' } },
        { goal: { fact: 'boost' }, set: { aiDifficulty: 'medium' } },
      ] },
    });
    cw.stepWorld(w, {}, 1 / 60);
    expect(w.aiTuning).toBe(cw.AI_DIFFICULTY.easy);
    const p = w.byId.p;
    p.grounded = true; cw.stepWorld(w, {}, 1 / 60);
    p.grounded = false; p.vel[2] = 8; cw.stepWorld(w, {}, 1 / 60);
    expect(w.aiTuning).toBe(cw.AI_DIFFICULTY.medium);
  });

  it('a director fault self-quarantines (tutorial.dead) and never kills the sim', () => {
    const w = tutWorld([{ goal: { fact: 'jump' } }]);
    run(w, {}, 1);
    w.tutorial.steps = null;   // sabotage
    run(w, {}, 2);
    expect(w.tutorial.dead).toBe(true);
    expect(() => run(w, {}, 2)).not.toThrow();
  });
});

describe('dormant seats — the deterministic reinforcement', () => {
  const dormantEnt = { id: 'geof', pilotable: true, dormant: true, rule: { type: 'static' }, body: { type: 'none', hittable: true, hp: 100, poise: 100 } };

  it('a dormant entity seats hidden, unhittable, rule-suppressed', () => {
    const w = createWorld({ entities: [pilotEnt(), dormantEnt] });
    const g = w.byId.geof;
    expect(g.dormant).toBe(true);
    expect(g.gone).toBe(true);
    expect(g.body.hittable).toBe(false);
  });

  it('a dormant contender is never enrolled by the match layer', () => {
    const w = createWorld({ entities: [pilotEnt(), dormantEnt], match: { killTarget: 1 } });
    expect(w.match.kills.geof).toBeUndefined();
    expect(w.match.kills.p).toBe(0);
  });

  it("a step's activate wakes it: visible, hittable, dropping in from the sky", () => {
    const w = createWorld({
      entities: [pilotEnt(), dormantEnt],
      tutorial: { steps: [
        { goal: { fact: 'jump' } },
        { goal: { fact: 'destroy', of: 'geof' }, activate: ['geof'] },
      ] },
    });
    run(w, {}, 1);
    expect(w.byId.geof.gone).toBe(true);
    const p = w.byId.p;
    p.grounded = true; run(w, {}, 1);
    p.grounded = false; p.vel[2] = 8; run(w, {}, 1);   // clear step 0 → step 1 entry wakes geof
    const g = w.byId.geof;
    expect(g.dormant).toBe(false);
    expect(g.gone).toBe(false);
    expect(g.body.hittable).toBe(true);
    expect(g.dropping).toBe(true);   // the sky entrance
  });
});

describe('rule: patrol — the passive walker', () => {
  it('marches between waypoints, turning first, and loops', () => {
    const w = createWorld({ entities: [{
      id: 'z', rule: { type: 'patrol', speed: 10, turn: 8, waypoints: [[40, 0], [40, 40]], arrive: 4 },
      transform: { pos: [0, 0, 0], heading: 0 },
      body: { type: 'none', hittable: true, hp: 50, poise: 100 },
    }] });
    run(w, {}, 240);   // 4s at speed 10 → reaches [40,0], advances toward [40,40]
    const z = w.byId.z;
    expect(z.patrolIdx).toBe(1);
    expect(z.moving).toBe(true);
    expect(z.transform.pos[1]).toBeGreaterThan(0);   // now walking the second leg
  });

  it('without waypoints it walks a slow deterministic arc — same steps, same pose', () => {
    const mk = () => createWorld({ entities: [{ id: 'z', rule: { type: 'patrol', speed: 6 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    const a = run(mk(), {}, 120), b = run(mk(), {}, 120);
    expect(a.byId.z.transform.pos).toEqual(b.byId.z.transform.pos);
    expect(a.byId.z.transform.heading).toBeCloseTo(b.byId.z.transform.heading, 12);
    expect(a.byId.z.transform.heading).not.toBe(0);
  });

  it('a downed patroller stays down (the walk never restarts a wreck)', () => {
    const w = createWorld({ entities: [{ id: 'z', rule: { type: 'patrol', speed: 10, waypoints: [[40, 0]] }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, {}, 10);
    const at = [...w.byId.z.transform.pos];
    w.byId.z.downed = true;
    run(w, {}, 30);
    expect(w.byId.z.transform.pos).toEqual(at);
    expect(w.byId.z.moving).toBe(false);
  });
});
