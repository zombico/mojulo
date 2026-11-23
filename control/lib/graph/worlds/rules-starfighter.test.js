import { describe, expect, it } from 'vitest';

import { createWorld, stepWorld } from './controllable-world.js';
import { composeLive } from './controllable/compose.js';

const E = composeLive();

// ── the `starfighter` rule and the ship's systems (worlds/controllable/rules-starfighter.js) ──────────────────────────
// A craft flown from its cockpit: a true attitude (it loops and rolls), the throttle a setting, the speed easing to it;
// fore and aft shields over the hull, power over lasers, shields and engines, the cannons linked; a targeting
// computer; a cockpit camera rolled with the craft. Deterministic.

const DT = 1 / 60;
const space = { ground: () => null };
const fighter = (over = {}) => ({
  id: 'p', pilotable: true, team: 'rebels',
  rule: { type: 'starfighter', speed: 100, accel: 50, pitchRate: 1.5, yawRate: 1, rollRate: 2, throttle: 1 / 3, ...over.rule },
  body: { type: 'mesh', hittable: true, hp: 10, ship: { shields: { max: 6, regen: 1 }, lasers: { regen: 4 } }, ...over.body },
  weapon: { fireClass: 'sight', auto: true, rof: 8, damage: 1, range: 600, energyMax: 20, energyCost: 1, energyRegen: 0, coreAngle: 3, assistAngle: 6 },
  transform: { pos: [0, 0, 0], heading: 0 },
});
const run = (w, input, steps) => { for (let i = 0; i < steps; i++) stepWorld(w, typeof input === 'function' ? input(i) : input, DT, space); return w.byId.p; };
const nose = (p) => p.sfF.map((v) => Math.round(v * 1000) / 1000);

describe('rule: starfighter', () => {
  it('goes where its nose points at its throttle setting; loops through the vertical and comes round', () => {
    const w = createWorld({ entities: [fighter()] });
    let p = run(w, {}, 240);                                     // 4 s at a third of 100 m/s, the speed eased to it
    expect(p.airspeed).toBeCloseTo(100 / 3, 3);
    expect(p.transform.pos[0]).toBeGreaterThan(100);
    expect(Math.abs(p.transform.pos[1])).toBeLessThan(1e-6);
    // a loop: the nose held up all the way round; it passes straight up and straight back, and comes back level
    let up = false, back = false;
    for (let i = 0; i < 1200 && !(up && back && p.sfF[0] > 0.999); i++) { p = run(w, { pitch: 1 }, 1); if (p.sfF[2] > 0.99) up = true; if (p.sfF[0] < -0.99) back = true; }
    expect(up && back).toBe(true);
    expect(p.sfF[0]).toBeGreaterThan(0.999);
    expect(Math.abs(p.tilt.roll)).toBeLessThan(0.05);
  });

  it('rolls about its nose without turning it; yaw turns the nose across', () => {
    const w = createWorld({ entities: [fighter()] });
    let p = run(w, { roll: 1 }, 30);                             // half a second at 2 rad/s
    expect(p.tilt.roll).toBeCloseTo(1, 2);
    expect(nose(p)).toEqual([1, 0, 0]);
    p = run(w, { yaw: 1 }, 30);
    expect(p.sfF[1]).toBeLessThan(-0.1);                         // yawed right of the nose (heading east → toward -y), rolled
    // the page's angles reproduce the frame: rotation (roll, -pitch, heading) 'ZYX' carries +x to the nose
    const { heading: h } = p.transform, pt = p.tilt.pitch;
    expect(Math.cos(pt) * Math.cos(h)).toBeCloseTo(p.sfF[0], 6);
    expect(Math.cos(pt) * Math.sin(h)).toBeCloseTo(p.sfF[1], 6);
    expect(Math.sin(pt)).toBeCloseTo(p.sfF[2], 6);
  });

  it('the throttle is a setting: zero, full, and the target\'s speed matched', () => {
    const w = createWorld({ entities: [fighter(), { id: 'f', team: 'empire', rule: { type: 'static' }, body: { type: 'mesh', hittable: true, hp: 3 }, transform: { pos: [300, 0, 0] } }] });
    let p = run(w, { thr: 'full' }, 1);
    p = run(w, {}, 300);
    expect(p.airspeed).toBeCloseTo(100, 3);
    p = run(w, { thr: 'zero' }, 1); p = run(w, {}, 300);
    expect(p.airspeed).toBe(0);
    w.byId.f.airspeed = 40;
    run(w, { tgt: 'near' }, 1);
    p = run(w, { thr: 'match' }, 1); p = run(w, {}, 300);
    expect(p.airspeed).toBeCloseTo(40, 3);
    // W and S move the setting, held
    p = run(w, { forward: 1 }, 30);
    expect(p.throttle).toBeCloseTo(0.4 + 0.3, 2);
  });

  it('shields fore and aft take a round from their side while they hold, then the hull lets it through; they recharge where they are set', () => {
    const w = E.createWorld({ entities: [fighter()] });
    const p = w.byId.p;
    E.stepWorld(w, {}, DT, space);
    expect(p.ship.sh).toEqual([6, 6]);
    expect(E.absorbShield(p, [50, 0, 0], 4, w)).toBe(true);      // from ahead: the fore shield
    expect(p.ship.sh).toEqual([2, 6]);
    expect(E.absorbShield(p, [-50, 0, 0], 6, w)).toBe(true);     // from behind: the aft, to nothing
    expect(p.ship.sh).toEqual([2, 0]);
    expect(E.absorbShield(p, [-50, 0, 0], 1, w)).toBe(false);    // the aft gone: the hull's (the caller's hp)
    expect(E.absorbShield(p, [50, 0, 0], 3, w)).toBe(true);      // more than the fore holds: it takes its 2, the hull the 1
    expect(p.ship.sh[0]).toBe(0);
    expect(p.body.hp).toBe(9);
    p.body.hp = 1; p.ship.sh[0] = 0.5;
    expect(E.absorbShield(p, [50, 0, 0], 3, w)).toBe(true);      // the rest past the shield is the killing blow: down
    expect(p.downed).toBe(true);
    p.downed = false; p.ship.sh[0] = 2; p.body.hp = 10;
    // recharged at its regen times its power; set to the aft, all of it goes there
    for (let i = 0; i < 60; i++) E.stepWorld(w, {}, DT, space);
    expect(p.ship.sh[0]).toBeCloseTo(3, 1); expect(p.ship.sh[1]).toBeCloseTo(1, 1);
    E.stepWorld(w, { shieldSet: 1 }, DT, space); E.stepWorld(w, { shieldSet: 1 }, DT, space);   // held: one press
    E.stepWorld(w, {}, DT, space); E.stepWorld(w, { shieldSet: 1 }, DT, space);                 // even → fore → aft
    expect(p.ship.mode).toBe('aft');
    const a0 = p.ship.sh[1], f0 = p.ship.sh[0];
    for (let i = 0; i < 60; i++) E.stepWorld(w, {}, DT, space);
    expect(p.ship.sh[1] - a0).toBeCloseTo(2, 1);
    expect(p.ship.sh[0]).toBeCloseTo(f0, 6);
  });

  it('power over lasers, shields and engines: a pip taken from the fullest of the others; the engines set the top speed, the lasers their recharge', () => {
    const w = E.createWorld({ entities: [fighter()] });
    const p = w.byId.p;
    E.stepWorld(w, { power: 'engines' }, DT, space);
    expect(p.ship.pow.engines).toBe(3);
    E.stepWorld(w, {}, DT, space); E.stepWorld(w, { power: 'engines' }, DT, space);
    expect(p.ship.pow).toMatchObject({ engines: 4 });
    expect(p.ship.pow.lasers + p.ship.pow.shields).toBe(2);
    expect(p.topSpeed).toBeCloseTo(130, 6);
    E.stepWorld(w, {}, DT, space); E.stepWorld(w, { power: 'even' }, DT, space);
    expect(p.topSpeed).toBeCloseTo(100, 6);
    E.stepWorld(w, {}, DT, space); E.stepWorld(w, { power: 'lasers' }, DT, space);
    E.stepWorld(w, {}, DT, space);
    expect(p.weapon.energyRegen).toBeCloseTo(6, 6);               // 4 × 3 pips / 2
  });

  it('the cannons linked: one, two, all four a shot, each costing and hurting as that many', () => {
    const w = E.createWorld({ entities: [fighter()] });
    const p = w.byId.p;
    E.stepWorld(w, {}, DT, space);
    expect([p.ship.link, p.weapon.energyCost, p.weapon.damage]).toEqual([1, 1, 1]);
    E.stepWorld(w, { link: 1 }, DT, space);
    expect([p.ship.link, p.weapon.energyCost, p.weapon.damage, p.weapon.muzzleDual]).toEqual([2, 2, 2, true]);
    E.stepWorld(w, {}, DT, space); E.stepWorld(w, { link: 1 }, DT, space);
    expect([p.ship.link, p.weapon.energyCost, p.weapon.damage]).toEqual([4, 4, 4]);
  });

  it('the targeting computer: the nearest hostile, the next round, the one that hit it; its facts kept', () => {
    const at = (id, team, pos) => ({ id, team, rule: { type: 'static' }, body: { type: 'mesh', hittable: true, hp: 4, name: id }, transform: { pos } });
    const w = E.createWorld({ entities: [fighter(), at('wing', 'rebels', [50, 0, 0]), at('f1', 'empire', [400, 0, 0]), at('f2', 'empire', [200, 30, 0])] });
    const p = w.byId.p;
    E.stepWorld(w, { tgt: 'near' }, DT, space);
    expect(p.target).toBe('f2');
    expect(p.tgtInfo).toMatchObject({ id: 'f2', name: 'f2', hull: 100, team: 'empire' });
    E.stepWorld(w, {}, DT, space); E.stepWorld(w, { tgt: 'next' }, DT, space);
    expect(p.target).toBe('f1');                                  // the next by distance from f2 (wing, f2, f1)
    E.stepWorld(w, {}, DT, space); E.stepWorld(w, { tgt: 'next' }, DT, space);
    expect(p.target).toBe('wing');
    p.lastHitBy = 'f1';
    E.stepWorld(w, {}, DT, space); E.stepWorld(w, { tgt: 'atk' }, DT, space);
    expect(p.target).toBe('f1');
    w.byId.f1.gone = true;
    E.stepWorld(w, {}, DT, space);
    expect(p.target).toBe(null);
  });

  it('the cockpit: the eye at the seat, down the nose, rolled with the craft; the view swaps the chase for it and back', () => {
    const w = E.createWorld({ entities: [fighter({ rule: { seat: [2, 0, 1] } })], camera: { rule: 'follow', target: 'p', dist: 20, height: 4 } });
    const p = w.byId.p, c = w.camera;
    E.stepWorld(w, { roll: 1 }, DT, space);
    E.stepWorld(w, { view: 1 }, DT, space);
    expect(c.rule.type).toBe('cockpit');
    expect(c.rule.hideTarget).toBe(true);
    for (let i = 0; i < 20; i++) E.stepWorld(w, { view: 1, roll: 1 }, DT, space);   // held: one press
    expect(c.rule.type).toBe('cockpit');
    const f = p.sfF, u = p.sfU, q = p.transform.pos;
    for (let k = 0; k < 3; k++) expect(c.transform.pos[k]).toBeCloseTo(q[k] + 2 * f[k] + u[k], 6);
    expect(c.up).toEqual(u);
    expect(c.up[2]).toBeLessThan(0.99);                            // rolled with the craft
    E.stepWorld(w, {}, DT, space); E.stepWorld(w, { view: 1 }, DT, space);
    expect(c.rule.type).toBe('follow');
    expect(c.up).toBe(null);
  });

  it('a world that starts in the cockpit goes out to the chase it names, and back', () => {
    const w = E.createWorld({ entities: [fighter({ rule: { seat: [2, 0, 1] } })], camera: { rule: 'cockpit', target: 'p', seat: [2, 0, 1], hideTarget: true, chase: { rule: 'follow', target: 'p', dist: 20, height: 4 } } });
    const c = w.camera;
    E.stepWorld(w, {}, DT, space);
    expect(c.up).toEqual(w.byId.p.sfU);
    E.stepWorld(w, { view: 1 }, DT, space);
    expect(c.rule).toMatchObject({ type: 'follow', target: 'p', dist: 20 });
    E.stepWorld(w, {}, DT, space); E.stepWorld(w, { view: 1 }, DT, space);
    expect(c.rule).toMatchObject({ type: 'cockpit', seat: [2, 0, 1] });
  });

  it('is deterministic: the same inputs, the same flight', () => {
    const script = (i) => ({ lookDX: Math.sin(i / 17) * 30, lookDY: Math.cos(i / 23) * 20, roll: Math.sin(i / 50), thr: i === 100 ? 'full' : null, tgt: i === 5 ? 'near' : null });
    const go = () => { const w = E.createWorld({ entities: [fighter()] }); for (let i = 0; i < 600; i++) E.stepWorld(w, script(i), DT, space); return w.byId.p; };
    const a = go(), b = go();
    expect(a.transform.pos).toEqual(b.transform.pos);
    expect(a.tilt).toEqual(b.tilt);
  });
});
