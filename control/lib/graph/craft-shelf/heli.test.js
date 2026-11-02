// The helicopter parts on the craft shelf (heli-odm.js, heli-parts.js, heli-archetypes.js): a main rotor's head (its
// mast, the swashplate's two rings, a pitch link and a grip per blade, the hub and its cap) and its blades (drooping toward
// their tips, washing out, banded), spun by the pose with its hub still, folding aft; a tail rotor and a ducted fan; a
// tail rotor's thrust against its main rotor's torque; a helicopter standing on its skids, its rotor clear above its
// head, its rotors spinning in its figure, within its budget; a helicopter by the words people say; its cockpit, a part
// of its own (side by side or tandem, its seats, panel and controls), inside its cabin under its bubble. The cases are
// chosen from the shelf in code.
import { describe, it, expect } from 'vitest';
import { assembleCraft, resolveCraftPart, CRAFT_ODM, CRAFT_ARCHETYPES } from './index.js';
import { craftForm, craftFormFigure } from './craft-form.js';
import { HELI_ODM, HELI_KINDS } from './heli-odm.js';
import { buildCockpit } from './cockpit-parts.js';
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

describe('the cockpit, a part of its own', () => {
  const ck = (row) => buildCockpit(row, {});
  const idsOf = (g) => ['lathes', 'sweeps', 'extrudes'].flatMap((k) => (g[k] ?? []).map((m) => m.id));
  it('side by side: a seat and its controls each, one panel across, a console between, a bench behind', () => {
    const g = ck({ dims: { length: 2.6, width: 1.4, height: 1.1 }, build: { layout: 'side', seats: 2, panel: 'glass', controls: 'heli', bench: 3 } }), got = idsOf(g);
    for (const i of [0, 1]) for (const p of ['seat_%_pan', 'seat_%_back', 'seat_%_headrest', 'seat_%_strap_l', 'ctl_%_cyclic', 'ctl_%_collective', 'ctl_%_pedal_r']) expect(got, p.replace('%', i)).toContain(p.replace('%', i));
    for (const p of ['panel', 'panel_shield', 'console', 'bench', 'bench_back']) expect(got, p).toContain(p);
    expect(got.filter((i) => /^panel_display_/.test(i)).length).toBeGreaterThan(1);
  });
  it('tandem: the seats down the centreline, the rear one raised, a panel before each; a stick or a yoke when asked', () => {
    const g = ck({ dims: { length: 3.2, width: 0.9, height: 1.2 }, build: { layout: 'tandem', seats: 2, panel: 'dials', controls: 'stick' } }), got = idsOf(g);
    for (const p of ['panel_0', 'panel_1', 'seat_0_pan', 'seat_1_pan', 'ctl_0_stick', 'ctl_1_stick', 'deck_1']) expect(got, p).toContain(p);
    const pan = (i) => g.extrudes.find((e) => e.id === `seat_${i}_pan`).axisFrom;
    expect(pan(1).z).toBeGreaterThan(pan(0).z + 0.2);
    expect(pan(1).y).toBeLessThan(pan(0).y);
    expect(idsOf(ck({ dims: { length: 2, width: 1.3, height: 1.1 }, build: { layout: 'side', seats: 2, panel: 'dials', controls: 'yoke' } }))).toContain('ctl_0_yoke');
  });
  it('in the helicopter: inside its cabin under its bubble, its seats\' cushions a seat\'s height off its floor', () => {
    const C = craftForm(LIGHT), fs = (id) => C.items.find((i) => i.id === id).faces;
    const ext = (faces, k) => { let lo = Infinity, hi = -Infinity; for (const f of faces) for (const c of f.corners) { lo = Math.min(lo, c[k]); hi = Math.max(hi, c[k]); } return [lo, hi]; };
    const ck2 = A[LIGHT].layout.find((e) => CRAFT_ODM[e.sku].kind === 'craft-cockpit').id, hull = fs('hull'), canopy = fs('canopy'), cp = fs(ck2);
    for (const k of [0, 1]) { const [a, b] = ext(cp, k), [c, d] = ext(hull, k); expect(a).toBeGreaterThan(c); expect(b).toBeLessThan(d); }
    expect(ext(cp, 2)[1]).toBeLessThan(ext(canopy, 2)[1]);
    // (its hull open over it: no skin across the cockpit between its seats' cushions and the bubble)
    // (over its seats: behind its panel, under the bubble's length, inside its walls, above its floor by a seat's height)
    const [cx0, cx1] = ext(cp, 0), [gy0] = ext(canopy, 1), [, cy1] = ext(cp, 1), [floor] = ext(cp, 2);
    const lid = hull.filter((f) => { const c = [0, 1, 2].map((k) => f.corners.reduce((t, q) => t + q[k], 0) / f.corners.length); return Math.abs(c[0] - (cx0 + cx1) / 2) < (cx1 - cx0) * 0.2 && c[1] > gy0 + 0.3 && c[1] < cy1 - 0.3 && c[2] > floor + 0.3; });
    expect(lid).toEqual([]);
  });
  it('a hull with no open span is lofted as it always was: one closed skin', () => {
    const plain = Object.keys(CRAFT_ODM).find((sku) => CRAFT_ODM[sku].kind === 'craft-fuselage' && !CRAFT_ODM[sku].build.open && CRAFT_ODM[sku].build.family === 'tube');
    expect(resolveCraftPart(plain).lofts.filter((l) => /^(tub|hull_nose)$/.test(l.id))).toEqual([]);
    const open = Object.keys(CRAFT_ODM).find((sku) => CRAFT_ODM[sku].build.open);
    expect(resolveCraftPart(open).lofts.map((l) => l.id).slice(0, 3)).toEqual(['hull_nose', 'tub', 'hull']);
  });
});
