import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';
import { shippedRule } from '@/lib/graph/gameworld/feel/reach.js';
import { feelRule } from '@/lib/graph/gameworld/feel/lower.js';
import { POLE_IDS, poleCard } from '@/lib/graph/gameworld/feel/cards.js';

// THE WALL AND THE DASH (rules-platform.js, opt-in `cling` and `dash`, a feel's with its takes): the card's wall slide,
// wall kick (Mega Man X's: a single wall climbed by kicks), ground dash, air dash and dash jump, played on the rule a game
// ships. The wall on a template with an air jump, the dash on one with the dash, each chosen from the catalog; absent its
// takes, neither is in the rule.

const DT = 1 / 60;
const pole = POLE_IDS.find((id) => { const C = poleCard(id); return C.cling && C.dash?.kind === 'dash' && C.dash.air?.count > 0 && C.dash.jump && C.dash.wall && C.lane; });
const R = shippedRule({ pole, takes: true });
// the wall on a card with an air jump beside it (the mascot platformer's: its kick, its grace, then the air jump)
const wallPole = POLE_IDS.find((id) => { const C = poleCard(id); return C.cling && C.lane && Math.round(C.air?.jumps ?? 0) > 0; });
const RW = shippedRule({ pole: wallPole, takes: true });
// a wall across the way at x 3 (the hero faces +x), the floor at 0
const COLLIDERS = [{ min: [3, -20, 0], max: [3.6, 20, 30] }];
const WALL = { ground: () => 0 }, OPEN = WALL;
const mk = (rule = RW, walls = COLLIDERS) => createWorld({ colliders: walls, entities: [{ id: 'p', rule: { ...rule, eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
const run = (w, inputs, n, world = WALL) => Array.from({ length: n }, (_, f) => { stepWorld(w, inputs(f) ?? {}, DT, world); const e = w.byId.p; return { x: e.transform.pos[0], z: e.transform.pos[2], vz: e.vel[2], cling: !!e.cling, grounded: e.grounded, drive: e.drive ? Math.hypot(e.drive[0], e.drive[1]) : 0, loco: e.locomotion }; });
// on the wall: run at it, jump, keep pushing into it until it is held
function onWall() {
  const w = mk(); run(w, () => ({}), 6);
  const fr = run(w, (f) => ({ forward: 1, jump: f === 10, jumpHeld: f >= 10 && f < 40 }), 80);
  return { w, fr };
}

describe('the wall', () => {
  it('absent the takes, the rule has neither wall nor dash', () => {
    expect(feelRule(pole).cling).toBeUndefined();
    expect(feelRule(pole).dash).toBeUndefined();
    expect(RW.cling.kick).toBeGreaterThan(0);
  });

  it('falling against it with the stick into it slides down at the card\'s speed', () => {
    const { fr } = onWall();
    const held = fr.filter((x) => x.cling && !x.grounded);
    expect(held.length).toBeGreaterThan(5);
    for (const x of held) expect(x.vz).toBeCloseTo(-RW.cling.slide, 9);
    expect(Math.max(...held.map((x) => x.x))).toBeLessThanOrEqual(3 - 0.3 + 1e-6);   // the body's side on the wall
  });

  it('a jump on it kicks up and away, the stick locked out; held back toward it, kick after kick climbs it', () => {
    const { w, fr } = onWall();
    const at = fr.findIndex((x) => x.cling), z0 = fr[at + 2].z;
    const kicks = [], tops = [];
    let f0 = 0;
    const climb = run(w, (f) => {
      const near = w.byId.p.cling;
      const kick = near && f - f0 > 4;
      if (kick) { kicks.push(f); f0 = f; }
      return { forward: 1, jump: kick, jumpHeld: true };
    }, 240);
    expect(kicks.length).toBeGreaterThanOrEqual(3);
    // the kick leaves the wall: the frame after, the body is off it, moving away (its x drops) before the stick brings it back
    const k = kicks[0];
    expect(climb[k + 1].x).toBeLessThan(climb[k].x);
    // each kick tops out higher than the last: a single wall climbed
    for (let i = 0; i < 3; i++) tops.push(Math.max(...climb.slice(kicks[i], kicks[i + 1] ?? kicks[i] + 30).map((x) => x.z)));
    expect(tops[1]).toBeGreaterThan(tops[0]); expect(tops[2]).toBeGreaterThan(tops[1]);
    expect(tops[0]).toBeGreaterThan(z0);
  });

  it('let go, it still kicks within its grace; past it, the jump is the air jump\'s or none', () => {
    const { w } = onWall();
    run(w, () => ({}), 1);   // let go: off the wall, the grace counting
    const late = mk(); run(late, () => ({}), 6); run(late, (f) => ({ forward: 1, jump: f === 10, jumpHeld: f >= 10 && f < 40 }), 80);
    run(late, () => ({}), Math.ceil(RW.cling.coyote / DT) + 4);
    const e = w.byId.p, x0 = e.transform.pos[0];
    run(w, (f) => ({ jump: f === 0, jumpHeld: true }), 3);
    expect(e.vel[2]).toBeGreaterThan(0);
    expect(e.transform.pos[0]).toBeLessThan(x0);   // the kick's away, not a straight air jump
    expect(late.byId.p.wallCoyote).toBe(0);
  });
});

describe('the dash: a burst, not a run', () => {
  const N = Math.round(R.dash.time / DT);
  it('a tap and a hold dash alike: up to the dash\'s speed, held, eased back to the run\'s, the card\'s frames long', () => {
    const go = (held) => { const w = mk(R, []); run(w, () => ({}), 6, OPEN); return run(w, (f) => ({ boost: held ? f < 90 : f === 0 }), 90, OPEN); };
    const tap = go(false), hold = go(true);
    expect(hold.map((x) => x.x)).toEqual(tap.map((x) => x.x));             // holding F sustains nothing
    const top = Math.max(...tap.map((x) => x.drive));
    expect(top).toBeCloseTo(R.dash.speed, 6);                               // the card's speed, never past it
    const at = tap.findIndex((x) => Math.abs(x.drive - top) < 1e-9);
    expect(at).toBeGreaterThan(1);                                          // reached, not jumped to
    expect(tap[N].drive).toBeLessThanOrEqual(R.speed + 1e-6);               // eased back down by its end
    expect(tap[N - 2].drive).toBeLessThan(top);
    expect(tap.slice(N + 30).every((x) => x.drive < 1e-6)).toBe(true);      // no stick: then it stops
  });

  it('takes no strides: a ground dash holds the running jump\'s gather, a lunge', () => {
    const w = mk(R, []); run(w, () => ({}), 6, OPEN);
    const fr = run(w, (f) => ({ boost: f === 0 }), N + 4, OPEN);
    expect(fr.slice(0, N - 1).every((x) => x.loco === 'jump_fwd')).toBe(true);
    expect(fr[N + 2].loco).not.toBe('jump_fwd');
  });

  it('in the air: the fall stopped while it is at speed and given back as it eases; once an airtime, given back by the ground', () => {
    const w = mk(R, []); run(w, () => ({}), 6, OPEN);
    const M = Math.round(R.dash.air.time / DT);
    const fr = run(w, (f) => ({ jump: f === 0, jumpHeld: f < 20, boost: f === 25 || f === 25 + M + 4 }), 140, OPEN);
    for (const x of fr.slice(25, 25 + Math.floor(0.55 * M))) expect(x.vz).toBe(0);
    expect(fr[25 + M - 1].vz).toBeLessThan(0);                              // falling again before it ends: nothing to stand on
    expect(fr[25 + M + 5].grounded).toBe(false);
    expect(fr[25 + M + 6].vz).toBeLessThan(fr[25 + M + 4].vz);             // the second press in the same airtime: no dash
    expect(w.byId.p.airDashes).toBe(R.dash.air.count);                     // down: given back
  });

  it('a jump in a ground dash keeps the dash\'s speed through the air, past the run\'s', () => {
    const w = mk(R, []); run(w, () => ({}), 6, OPEN);
    const fr = run(w, (f) => ({ forward: 1, boost: f === 0, jump: f === 8, jumpHeld: f >= 8 && f < 30 }), 40, OPEN);
    const air = fr.slice(8).filter((x) => !x.grounded);
    expect(air.length).toBeGreaterThan(10);
    expect(Math.min(...air.map((x) => x.drive))).toBeGreaterThan(R.speed + 1e-6);
  });
});
