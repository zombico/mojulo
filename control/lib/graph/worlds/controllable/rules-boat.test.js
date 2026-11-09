import { describe, expect, it } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { BOAT_DRIVE, boatDrive } from '../../craft-shelf/boat-drive.js';
import { CRAFT_ARCHETYPES } from '../../craft-shelf/craft-archetypes.js';

// THE BOAT RULE (rules-boat.js, opt-in): a hull driven over the water at its class's figures (craft-shelf/boat-drive.js).
// One case per procedure, chosen in code: the lightest boat that planes (an outboard's thrust turned to steer) and the
// lightest that displaces (a screw and its rudder). The concept: its lever holds; its power holds it at its top speed;
// a planing hull climbs its hump bow up and runs flatter on the plane; it turns on its circle slow, no tighter than its
// grip fast; an outboard turns standing, a rudder needs way; the bottom within its draft stops it; it rides the swell.

const E = composeLive(), DT = 1 / 60, deep = { ground: () => -50 };
const byMass = (f) => Object.keys(BOAT_DRIVE).filter((a) => f(BOAT_DRIVE[a])).sort((a, b) => CRAFT_ARCHETYPES[a].reference.mtow - CRAFT_ARCHETYPES[b].reference.mtow)[0];
const PLANE = byMass((d) => d.drive === 'outboard'), SHIP = byMass((d) => d.drive === 'screw');
const D = { [PLANE]: boatDrive(PLANE), [SHIP]: boatDrive(SHIP) };
function sail(a, rule = {}, hooks = deep) {
  const w = E.createWorld({ entities: [{ id: 'b', pilotable: true, rule: { ...D[a].rule, ...rule }, body: { type: 'none' }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } }] });
  return { w, b: w.byId.b, run: (s, input = {}) => { for (let i = 0; i < Math.round(s * 60); i++) E.stepWorld(w, typeof input === 'function' ? input(i) : input, DT, hooks); } };
}

describe('the boat rule', () => {
  for (const a of [PLANE, SHIP]) {
    it(`${a}: its lever stays where it is set, and its power holds it at its top speed`, () => {
      const { b, run } = sail(a);
      run(2.5, { forward: 1 });
      expect(b.lever).toBeCloseTo(1, 9);
      run(240);
      expect(b.lever).toBeCloseTo(1, 9);
      expect(b.speed / D[a].rule.top).toBeGreaterThan(0.98);
      expect(b.speed / D[a].rule.top).toBeLessThan(1.02);
      // (its waterline at the surface: its origin its waterline's height under it)
      expect(b.transform.pos[2]).toBeLessThan(0.5);
    });
    it(`${a}: slow, it turns on its circle; fast, no tighter than its hull's grip`, () => {
      const R = D[a].rule, G = 9.81;
      const slow = sail(a, { leverStart: 0.08 }); slow.run(60); const u = slow.b.speed; slow.run(20, { turn: 1 });
      const rs = u / Math.abs(slow.b.yawV);
      expect(rs).toBeGreaterThan(0.45 * R.circle); expect(rs).toBeLessThan(0.6 * R.circle + (u * u) / ((R.planing ? 0.6 : 0.12) * G));
      const fast = sail(a, { leverStart: 1 }); fast.run(240); fast.run(20, { turn: 1 });
      const U = fast.b.speed, lat = U * Math.abs(fast.b.yawV);
      expect(lat).toBeLessThanOrEqual((R.planing ? 0.6 : 0.12) * G * 1.02);
    });
  }
  it('a planing hull climbs its hump bow up and runs flatter on the plane; a ship trims no more than a squat', () => {
    const p = sail(PLANE); let most = 0;
    for (let i = 0; i < 60 * 30; i++) { E.stepWorld(p.w, { forward: i < 120 ? 1 : 0 }, DT, deep); most = Math.max(most, p.b.trim); }
    expect(most).toBeGreaterThan(0.05);
    expect(p.b.trim).toBeLessThan(most);
    const s = sail(SHIP, { leverStart: 1 }); s.run(120);
    expect(Math.abs(s.b.trim)).toBeLessThan(0.01);
  });
  it('an outboard turns standing (its thrust turned); a rudder needs way on it', () => {
    const o = sail(PLANE, { leverStart: 0.3 }), r = sail(SHIP, { leverStart: 0.3 });
    o.run(1, { turn: 1 }); r.run(1, { turn: 1 });
    expect(Math.abs(o.b.transform.heading)).toBeGreaterThan(5 * Math.abs(r.b.transform.heading));
  });
  it('where the bottom comes up within its draft it runs aground: stopped', () => {
    const shoal = { ground: ([x]) => (x > 20 ? 0 : -50) }, { b, run } = sail(PLANE, { leverStart: 1 }, shoal);
    run(20);
    expect(b.aground).toBe(true);
    expect(b.speed).toBe(0);
    expect(b.transform.pos[0]).toBeLessThanOrEqual(20);
  });
  it('it rides the swell: heaving and pitching as the water under it moves', () => {
    const swell = [{ length: 20, amp: 0.5, dir: 0, ph: 0 }], { b, run } = sail(PLANE, { swell });
    const zs = [], ps = [];
    for (let i = 0; i < 120; i++) { run(1 / 30); zs.push(b.transform.pos[2]); ps.push(b.transform.pitch); }
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(0.3);
    expect(Math.max(...ps) - Math.min(...ps)).toBeGreaterThan(0.05);
  });
  it('absent, nothing: a page without a boat is emitted without the rule', () => {
    expect(emissionSource({})).not.toMatch(/buildRulesBoat/);
    expect(emissionSource({ boat: true })).toMatch(/buildRulesBoat/);
  });
  it('deterministic: the same hands, the same wake on the water', () => {
    const a = sail(PLANE), b = sail(PLANE), hands = (i) => ({ forward: Math.sin(i / 50), turn: Math.cos(i / 80) });
    a.run(10, hands); b.run(10, hands);
    expect(a.b.transform).toEqual(b.b.transform);
  });
});
