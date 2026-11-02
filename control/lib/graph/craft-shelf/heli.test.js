// The helicopter parts on the craft shelf (heli-odm.js, heli-parts.js, heli-archetypes.js): a main rotor's head (its
// mast, the swashplate's two rings, a pitch link and a grip per blade, the hub and its cap) and its blades (drooping toward
// their tips, washing out, banded), spun by the pose with its hub still, folding aft; a tail rotor and a ducted fan; a
// tail rotor's thrust against its main rotor's torque; a helicopter standing on its skids, its rotor clear above its
// head, its rotors spinning in its figure, within its budget; a helicopter by the words people say. The cases are chosen
// from the shelf in code.
import { describe, it, expect } from 'vitest';
import { assembleCraft, resolveCraftPart, CRAFT_ODM, CRAFT_ARCHETYPES } from './index.js';
import { craftForm, craftFormFigure } from './craft-form.js';
import { HELI_ODM, HELI_KINDS } from './heli-odm.js';
import { resolveVehicle, handlesOf } from '../vehicle-registry/roster.js';

const A = CRAFT_ARCHETYPES;
const HELIS = Object.keys(A).filter((k) => A[k].layout.some((e) => CRAFT_ODM[e.sku]?.kind === 'heli-rotor'));
const LIGHT = HELIS[0];
const skuOf = (kind, family) => Object.keys(HELI_ODM).find((s) => HELI_ODM[s].kind === kind && (!family || HELI_ODM[s].build.family === family));
const ids = (src) => ['lathes', 'sweeps', 'extrudes', 'lofts'].flatMap((k) => (src[k] ?? []).map((m) => m.id));
const loft = (src, id) => src.lofts.find((l) => l.id === id);
const P = (p) => [p.x, p.y, p.z];

describe('the main rotor', () => {
  const sku = skuOf('heli-rotor'), row = HELI_ODM[sku], src = resolveCraftPart(sku, { seat: 'mount' }), n = row.build.blades;
  it('its head: the mast, the swashplate\'s two rings, a pitch link, a grip and a bearing per blade, the hub and its cap', () => {
    const got = ids(src);
    for (const id of ['mast', 'swash_low', 'swash_up', 'hub', 'cap', 'scissors']) expect(got, id).toContain(id);
    for (const re of [/^pitch_link_/, /^grip_/, /^bearing_/, /^blade_\d+$/, /^blade_\d+_tip$/]) expect(got.filter((i) => re.test(i)).length, String(re)).toBe(n);
  });
  it('its blades droop toward their tips and reach its radius; spun, they turn about the hub, which stays', () => {
    const b = loft(src, 'blade_0'), tip = loft(src, 'blade_0_tip');
    expect(tip.axisTo.z).toBeLessThan(b.axisFrom.z);
    expect(Math.hypot(tip.axisTo.x, tip.axisTo.y)).toBeCloseTo(row.dims.diameter / 2, 1);
    const spun = resolveCraftPart(sku, { seat: 'mount', pose: { rotor: 40 } });
    expect(spun.lathes.find((l) => l.id === 'hub')).toEqual(src.lathes.find((l) => l.id === 'hub'));
    expect(P(loft(spun, 'blade_0_tip').axisTo)).not.toEqual(P(tip.axisTo));
  });
  it('folded, every blade lies aft along the boom', () => {
    const f = resolveCraftPart(sku, { seat: 'mount', fold: 1 });
    for (let k = 0; k < n; k++) {
      const t = loft(f, `blade_${k}_tip`).axisTo;
      expect(t.y).toBeLessThan(-row.dims.diameter * 0.35);
      expect(Math.abs(t.x)).toBeLessThan(row.dims.diameter * 0.12);
    }
  });
});

describe('the tail', () => {
  it('a tail rotor and a ducted fan, each spinning about the craft\'s x; the fan\'s shroud open, a fin\'s root on top', () => {
    for (const fam of ['rotor', 'fan']) {
      const src = resolveCraftPart(skuOf('heli-tail', fam), { seat: 'mount' });
      expect(src.garage.joints[0].dir.slice(1)).toEqual([0, 0]);
      expect(ids(src).filter((i) => /^blade_\d+$/.test(i)).length).toBe(HELI_ODM[skuOf('heli-tail', fam)].build.blades);
    }
    const fan = resolveCraftPart(skuOf('heli-tail', 'fan'), { seat: 'mount' });
    expect(fan.lathes.filter((l) => /^shroud_/.test(l.id)).every((l) => l.caps === false)).toBe(true);
    expect(fan.garage.hardpoints.finRoot[2]).toBeGreaterThan(HELI_ODM[skuOf('heli-tail', 'fan')].dims.diameter / 2);
  });
  it('a tail rotor\'s thrust (its blades\' lift, toward its own +x unless mirrored) against its main rotor\'s torque', () => {
    for (const k of HELIS) {
      const { manifest } = assembleCraft(k), main = manifest.items.find((i) => i.source.garage.kind === 'heli-rotor'), tail = manifest.items.find((i) => i.source.garage.kind === 'heli-tail');
      if (!tail) continue;
      // (a rotor turning anticlockwise seen from above turns its fuselage clockwise, nose right: its tail rotor pushes
      // the tail right, +x, to hold it)
      const turn = main.source.garage.joints[0].dir[2] * ((main.flip || '').includes('x') ? -1 : 1), thrust = (tail.flip || '').includes('x') ? -1 : 1;
      expect(thrust, k).toBe(turn);
    }
  });
});

describe('a helicopter', () => {
  it('stands on its skids, level, its rotor clear above its head; at its class\'s figures', () => {
    const { readout } = assembleCraft(LIGHT);
    expect(readout.gear.length).toBe(2);
    for (const g of readout.gear) expect(Math.abs(g.contact[2])).toBeLessThan(0.002);
    expect(readout.clearance['heli-rotor']).toBeGreaterThan(2);
    expect(readout.audit.ok).toBe(true);
    expect(Math.abs(readout.measures.length / readout.reference.length - 1)).toBeLessThan(0.08);
  });
  it('its rotors spinning in its figure: a bone at each hub, the main about the vertical, the tail about the craft\'s x', () => {
    const C = craftForm(LIGHT), F = craftFormFigure(LIGHT, { spin: true });
    const main = C.spins.find((s) => s.axis[2] === 1), tail = C.spins.find((s) => s.axis[0] === 1);
    expect(main && tail).toBeTruthy();
    expect(F.bones.find((b) => b.id === main.id).head).toEqual(main.hub);
    expect(F.clips.idle).toEqual(F.clips.spin);
  });
  it('within its budget; the same twice; found by the words people say', () => {
    const C = craftForm(LIGHT, { pose: { gear: 0 }, attitude: 'ground' });
    expect(C.items.flatMap((i) => i.faces).reduce((s, f) => s + f.corners.length - 2, 0)).toBeLessThan(50000);
    expect(JSON.stringify(craftForm(LIGHT))).toBe(JSON.stringify(craftForm(LIGHT)));
    expect(handlesOf(resolveVehicle('news helicopter').id).craft).toEqual([LIGHT]);
    expect(Object.keys(HELI_KINDS).every((k) => Object.values(HELI_ODM).some((r) => r.kind === k))).toBe(true);
  });
});
