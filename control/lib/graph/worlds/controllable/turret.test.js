import { describe, expect, it } from 'vitest';
import { composeLive, composeControllable, EMISSION, EMISSION_OPT_IN } from './compose.js';

// THE TURRET (turret.js, opt-in `turret` on any entity): a gun on a mount, aimed by hand on any base. The hand moves the
// ask; the mount slews to it at its rates, braking onto it, within its limits; a stabilized mount holds its line in the
// world while its base turns, an unstabilized one is carried; the weapon fires from the muzzle along the barrel. Absent,
// nothing.

const E = composeLive(), DT = 1 / 60, hooks = { ground: () => 0 };
const gun = (mount, extra = {}) => ({ mount: { at: [0.5, 0.2, 2], look: 0.1, ...mount }, gun: { barrel: 5 }, ...extra });
const ALL_ROUND = { traverse: { rate: 40, accel: 60 }, elevation: { rate: 15, accel: 40, min: -8, max: 20 } };
const ARC = { traverse: { rate: 5, accel: 10, min: -20, max: 20 }, elevation: { rate: 3, accel: 6, min: -5, max: 60 } };
function world(turret, weapon = null) {
  const w = E.createWorld({ entities: [{ id: 'g', pilotable: true, rule: { type: 'static' }, body: { type: 'none' }, turret, ...(weapon ? { weapon } : {}), transform: { pos: [10, 4, 0], heading: 0.4, pitch: 0 } }] });
  for (let i = 0; i < 3; i++) E.stepWorld(w, {}, DT, hooks);
  return { w, g: w.byId.g };
}
const run = (w, s, input = {}) => { for (let i = 0; i < Math.round(s * 60); i++) E.stepWorld(w, typeof input === 'function' ? input(i) : input, DT, hooks); };
// the hand asks dy° of yaw and dp° of pitch (the page's look: a positive lookDX left, lookDY up)
const ask = (w, dy, dp) => E.stepWorld(w, { lookDX: dy / 0.1, lookDY: dp / 0.1 }, DT, hooks);
const worldYaw = (g) => g.turret.yaw + g.transform.heading * 180 / Math.PI;

describe('the turret', () => {
  it('the hand moves the ask and the mount slews to it at its rate, braking onto it; the base never turns', () => {
    const { w, g } = world(gun({ ...ALL_ROUND, stabilized: true })), h0 = g.transform.heading;
    ask(w, 60, 10);
    run(w, 1);
    // (after a second, short of it: the rate, not the hand, sets the pace)
    expect(g.turret.yaw).toBeGreaterThan(20); expect(g.turret.yaw).toBeLessThan(40);
    let over = 0;
    for (let i = 0; i < 180; i++) { E.stepWorld(w, {}, DT, hooks); over = Math.max(over, g.turret.yaw - 60, g.turret.pitch - 10); }
    expect(g.turret.yaw).toBeCloseTo(60, 3); expect(g.turret.pitch).toBeCloseTo(10, 3);
    expect(over).toBeLessThan(0.01);
    expect(g.transform.heading).toBe(h0);
  });

  it('within its limits: asked past its stops it rests on them; its elevation never past its depression or elevation', () => {
    const { w, g } = world(gun(ARC));
    ask(w, 80, 90); run(w, 30);
    expect(g.turret.yaw).toBeCloseTo(20, 6); expect(g.turret.pitch).toBeCloseTo(60, 6);
    ask(w, -500, -200); run(w, 40);
    expect(g.turret.yaw).toBeCloseTo(-20, 6); expect(g.turret.pitch).toBeCloseTo(-5, 6);
  });

  it('stabilized, it holds its line in the world while its base turns (up to its own rate); unstabilized, it is carried', () => {
    const turn = (turret, degPerS) => { const { w, g } = world(turret), y0 = worldYaw(g); let most = 0;
      for (let i = 0; i < 120; i++) { g.transform.heading += degPerS * DT * Math.PI / 180; E.stepWorld(w, {}, DT, hooks); most = Math.max(most, Math.abs(worldYaw(g) - y0)); }
      return most; };
    expect(turn(gun({ ...ALL_ROUND, stabilized: true }), 25)).toBeLessThan(1e-6);
    // (a base turning faster than the mount traverses drags it by the difference)
    expect(turn(gun({ ...ALL_ROUND, stabilized: true }), 55)).toBeCloseTo(15 * 2, 0);
    expect(turn(gun({ ...ALL_ROUND, stabilized: false }), 25)).toBeCloseTo(25 * 2, 6);
  });

  it('a hand sweeping slower than the mount traverses is tracked, not trailed', () => {
    const { w, g } = world(gun({ ...ALL_ROUND, stabilized: true }));
    run(w, 3, () => ({ lookDX: (30 * DT) / 0.1 }));
    expect(Math.abs(g.turret.want.yaw - worldYaw(g))).toBeLessThan(1);
  });

  it('a round leaves from the muzzle along the barrel, the base\'s heading aside: a hitscan round and a travelling one', () => {
    const sight = { fireClass: 'sight', auto: false, cooldown: 0.5, magazine: 9, damage: 1, range: 2000 };
    const { w, g } = world(gun({ ...ALL_ROUND, stabilized: true }), sight);
    ask(w, -70, 12); run(w, 4);
    E.stepWorld(w, { fire: 1 }, DT, hooks);
    const T = g.turret, s = g.lastShot, d = [s.to[0] - s.from[0], s.to[1] - s.from[1], s.to[2] - s.from[2]], L = Math.hypot(...d);
    for (let i = 0; i < 3; i++) { expect(s.from[i]).toBeCloseTo(T.muzzle[i], 6); expect(d[i] / L).toBeCloseTo(T.dir[i], 6); }
    // (the muzzle a barrel's length from the trunnion along the barrel)
    expect(Math.hypot(...T.dir)).toBeCloseTo(1, 9);
    const lob = { fireClass: 'lob', auto: false, cooldown: 1, magazine: 3, damage: 1, projectileSpeed: 300, projectileGravity: 9.81, fuse: 20, range: 4000 };
    const L2 = world(gun({ ...ALL_ROUND, stabilized: true }), lob);
    ask(L2.w, 35, 15); run(L2.w, 3);
    E.stepWorld(L2.w, { fire: 1 }, DT, hooks);
    const p = L2.w.projectiles[0], v = Math.hypot(...p.vel);
    expect(v).toBeGreaterThan(299);
    for (let i = 0; i < 2; i++) expect(p.vel[i] / v).toBeCloseTo(L2.g.turret.dir[i], 2);
  });

  it('absent, nothing: a world without a turret steps as it did without the builder', () => {
    const spec = { entities: [{ id: 'p', pilotable: true, rule: { type: 'walk', speed: 3, eye: 1.7 }, weapon: { fireClass: 'sight', auto: true, rof: 8, magazine: 30, damage: 1, range: 60 }, transform: { pos: [0, 0, 1.7], heading: 0, pitch: 0 } }] };
    const without = composeControllable([...EMISSION, ...Object.entries(EMISSION_OPT_IN).filter(([k]) => k !== 'turret').map(([, b]) => b)]);
    const a = E.createWorld(spec), b = without.createWorld(spec);
    for (let i = 0; i < 60; i++) { const inp = { forward: 1, lookDX: 3, fire: i % 2 }; E.stepWorld(a, inp, DT, hooks); without.stepWorld(b, inp, DT, hooks); }
    expect(JSON.stringify(a.byId.p)).toBe(JSON.stringify(b.byId.p));
  });

  it('deterministic: the same hand, the same gun', () => {
    const once = () => { const { w, g } = world(gun({ ...ALL_ROUND, stabilized: true })); run(w, 2, (i) => ({ lookDX: (i % 7) * 3, lookDY: (i % 5) - 2 })); return JSON.stringify(g.turret); };
    expect(once()).toBe(once());
  });
});
