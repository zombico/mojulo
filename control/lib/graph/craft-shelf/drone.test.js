// The drone parts on the craft shelf (drone-odm.js, drone-parts.js, drone-archetypes.js): every drone kind a builder and
// a row, each part the same twice; a multirotor's arms radial by the layout's yaw; a mirrored pair of rotors handed
// opposite, its diagonals alike; the quad standing on its four feet; its arms folding about the vertical; its rotors
// spun by the pose; the drone in the form render, its LEDs both sides; a drone role filled in both realms; a drone by
// the words people say. The cases are chosen from the shelf in code.
import { describe, it, expect } from 'vitest';
import { assembleCraft, resolveCraftPart, CRAFT_ODM, CRAFT_ARCHETYPES, craftRoleAnalogues } from './index.js';
import { DRONE_KINDS, DRONE_ODM } from './drone-odm.js';
import { DRONE_ROLES } from './drone-archetypes.js';
import { craftForm } from './craft-form.js';
import { resolveVehicle, handlesOf } from '../vehicle-registry/roster.js';

const A = CRAFT_ARCHETYPES;
// (a multirotor on the shelf: an earth drone whose rotors stand on its arms' motors)
const QUAD = Object.keys(A).find((k) => A[k].realm === 'earth' && A[k].layout.some((e) => CRAFT_ODM[e.sku]?.kind === 'drone-rotor'));
const itemOf = (m, id) => m.items.find((i) => i.id === id);
const lathe = (src, id) => src.lathes.find((l) => l.id === id);
const loft = (src, id) => src.lofts.find((l) => l.id === id);
const P = (p) => [p.x, p.y, p.z];

describe('the drone parts', () => {
  it('every drone kind on the shelf with a row, each building the same part twice', () => {
    for (const kind of Object.keys(DRONE_KINDS)) {
      const skus = Object.keys(DRONE_ODM).filter((s) => DRONE_ODM[s].kind === kind);
      expect(skus.length, kind).toBeGreaterThan(0);
      for (const sku of skus) {
        expect(CRAFT_ODM[sku], sku).toBe(DRONE_ODM[sku]);
        expect(JSON.stringify(resolveCraftPart(sku)), sku).toBe(JSON.stringify(resolveCraftPart(sku)));
      }
    }
  });
});

describe('a multirotor assembled', () => {
  const { manifest, readout } = assembleCraft(QUAD);
  const arms = A[QUAD].layout.filter((e) => CRAFT_ODM[e.sku].kind === 'drone-arm').map((e) => e.id);
  const motorOf = (id) => manifest.items.find((i) => i.id === id);
  it('its arms radial: each pair mirrored across the centreline, the front pair ahead and the rear behind', () => {
    const motors = A[QUAD].layout.filter((e) => CRAFT_ODM[e.sku].kind === 'drone-motor');
    expect(motors.length).toBe(arms.length);
    for (const e of motors) {
      const r = motorOf(`${e.id}-r`).at, l = motorOf(`${e.id}-l`).at;
      expect(r[0]).toBeGreaterThan(0.05);
      expect(l[0]).toBeCloseTo(-r[0], 3);
      expect(l[1]).toBeCloseTo(r[1], 3);
    }
    const ys = motors.map((e) => motorOf(`${e.id}-r`).at[1]);
    expect(Math.max(...ys)).toBeGreaterThan(0.05);
    expect(Math.min(...ys)).toBeLessThan(-0.05);
  });
  it('its rotors handed: a mirrored pair turns opposite ways, its diagonals alike', () => {
    const rotors = A[QUAD].layout.filter((e) => CRAFT_ODM[e.sku].kind === 'drone-rotor');
    // (a rotor's turn seen from above: its joint's axis, mirrored with the copy)
    const turn = (id) => { const it = itemOf(manifest, id), d = it.source.garage.joints[0].dir[2]; return (it.flip || '').includes('x') ? -d : d; };
    for (const e of rotors) expect(turn(`${e.id}-r`), e.id).toBe(-turn(`${e.id}-l`));
    const [f, r] = rotors.map((e) => e.id);
    expect(turn(`${f}-r`)).toBe(turn(`${r}-l`));
    expect(turn(`${f}-l`)).toBe(turn(`${r}-r`));
  });
  it('standing on its four feet, each on the ground, within its class figures', () => {
    expect(readout.gear.length).toBe(4);
    for (const g of readout.gear) expect(Math.abs(g.contact[2])).toBeLessThan(0.002);
    expect(readout.audit.ok).toBe(true);
    expect(Math.abs(readout.measures.span / readout.reference.span - 1)).toBeLessThan(0.08);
  });
  it('its arms fold about the vertical toward the body; its rotors spin with the pose, their hubs staying put', () => {
    const folded = assembleCraft(QUAD, { fold: 1 }).manifest;
    const tipOf = (m, id) => { const it = itemOf(m, id); return it.source.garage.hardpoints.motor; };
    for (const id of arms) {
      const open = tipOf(manifest, `${id}-r`), shut = tipOf(folded, `${id}-r`);
      expect(Math.hypot(shut[0], shut[1])).toBeCloseTo(Math.hypot(open[0], open[1]), 3);
      expect(shut).not.toEqual(open);
    }
    const sku = A[QUAD].layout.find((e) => CRAFT_ODM[e.sku].kind === 'drone-rotor').sku;
    const a = resolveCraftPart(sku), b = resolveCraftPart(sku, { pose: { rotor: 45 } });
    expect(lathe(b, 'hub')).toEqual(lathe(a, 'hub'));
    expect(P(loft(b, 'blade_0').axisTo)).not.toEqual(P(loft(a, 'blade_0').axisTo));
  });
});

describe('in the form render and on the roster', () => {
  it('a part a slot; a lit LED each side; within a small quad\'s budget', () => {
    const C = craftForm(QUAD, { pose: { gear: 0 }, attitude: 'ground' }), fs = C.items.flatMap((i) => i.faces);
    expect(fs.every((f) => f.material && f.part)).toBe(true);
    expect(fs.some((f) => f.material === 'navGreen') && fs.some((f) => f.material === 'navRed')).toBe(true);
    expect(fs.reduce((s, f) => s + f.corners.length - 2, 0)).toBeLessThan(25000);
  });
  it('every drone role has its earth drone and its starship drone; a drone found by the words people say', () => {
    for (const role of Object.keys(DRONE_ROLES)) {
      const r = craftRoleAnalogues(role);
      expect(r.earth.length, role).toBeGreaterThan(0);
      expect(r.space.length, role).toBeGreaterThan(0);
    }
    expect(handlesOf(resolveVehicle('quadcopter').id).craft).toEqual([QUAD]);
  });
});
