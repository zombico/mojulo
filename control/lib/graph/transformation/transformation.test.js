import { describe, it, expect } from 'vitest';

import { bakeTransformer, bakeVariableSuit, composeTransformer, innerFrameManifest, TRANSFORM_SCHEMES } from './index.js';
import { decodePart, soupBounds } from './rig-parts.js';
import { bakeUnitRig } from '../worlds/unit-rig.js';

// one case per procedure: a car-bot (a car's shell cut into panels, wheels that turn), a jet-bot (a craft's items,
// wings mounted by their root), a waverider (a robot alone, folded into its own flight form)
const carbot = () => bakeTransformer({ vehicle: { supercar: { preset: 'razor' } } });
const jetbot = () => bakeTransformer({ vehicle: { craft: 'jetFighter' } });
const frame = (H = 6) => bakeUnitRig(innerFrameManifest({ H }), { keys: 12, targetH: H });

// every part's lowest corner under a clip key
function minZ(fig, clip, k) {
  const c = fig.clips[clip], nb = fig.bones.length;
  let mn = Infinity;
  fig.bones.forEach((b, i) => {
    const s = decodePart(fig.parts[i]);
    if (!s) return;
    const o = (k * nb + i) * 7, q = c.b.slice(o, o + 4), h = c.b.slice(o + 4, o + 7);
    for (let j = 0; j < s.pos.length; j += 3) {
      const v = [s.pos[j] - b.head[0], s.pos[j + 1] - b.head[1], s.pos[j + 2] - b.head[2]];
      const [x, y, z, w] = q;
      const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]);
      const rz = v[2] + w * 2 * (x * v[1] - y * v[0]) + (x * ty - y * tx);
      if (h[2] + rz < mn) mn = h[2] + rz;
    }
  });
  return mn;
}

describe('transformation (more-than-meets): one body in two forms', () => {
  it('a car-bot keeps every triangle of its robot and its car', async () => {
    const { figure, readout } = await carbot();
    expect(readout.tris.composed).toBe(readout.tris.robot + readout.tris.vehicle);
    expect(figure.rig).toBe(true);
    expect(figure.forms.kind).toBe('ground');
  });

  it('the robot\'s bones stay first and in order, and its clips are all there, beside the forms\' own', async () => {
    const robot = frame(4.4);
    const { figure } = composeTransformer({ robot, vehicle: null, scheme: 'waverider' });
    expect(figure.bones.slice(0, robot.bones.length).map((b) => b.id)).toEqual(robot.bones.map((b) => b.id));
    for (const name of Object.keys(robot.clips)) expect(figure.clips[name]).toBeDefined();
    expect(figure.clips['vehicle:idle']).toBeDefined();
    expect(figure.clips['transform:vehicle'].once).toBe(true);
    expect(figure.clips['transform:robot'].once).toBe(true);
  });

  it('the vehicle form puts the car back together: every panel at its place in the car, the wheels on the ground', async () => {
    const { figure, readout } = await carbot();
    expect(readout.panels.some((p) => p.id === 'v_chest' && p.on === 'torso')).toBe(true);
    // the front wheels ride the shoulders, the rear the shins (the car-bot's row)
    for (const p of readout.panels.filter((x) => /^v_wheel/.test(x.id))) expect(p.on).toMatch(/^(upperArm|shin)/);
    expect(figure.clips['vehicle:drive'].k).toBeGreaterThan(1);
    expect(Math.abs(minZ(figure, 'vehicle:idle', 0))).toBeLessThan(0.02);
    expect(figure.forms.wheelbase).toBeGreaterThan(1);
  });

  it('every key of the sequence stands on the ground, and the sequence ends where each form begins', async () => {
    const { figure, readout } = await carbot();
    expect(readout.ground.transformMin).toBeGreaterThanOrEqual(0);
    const K = figure.clips['transform:vehicle'].k, nb = figure.bones.length;
    const last = figure.clips['transform:vehicle'].b.slice((K - 1) * nb * 7);
    const vehicle = figure.clips['vehicle:idle'].b;
    // the same rotation (q and −q are one turn) and the same head, bone by bone
    for (let i = 0; i < nb; i++) {
      const o = i * 7, dot = last[o] * vehicle[o] + last[o + 1] * vehicle[o + 1] + last[o + 2] * vehicle[o + 2] + last[o + 3] * vehicle[o + 3];
      expect(Math.abs(dot)).toBeGreaterThan(0.999);
      for (let k = 4; k < 7; k++) expect(Math.abs(last[o + k] - vehicle[o + k])).toBeLessThan(0.02);
    }
    for (const k of [0, Math.floor(K / 2), K - 1]) expect(minZ(figure, 'transform:vehicle', k)).toBeGreaterThan(-0.02);
    // the way back is the same keys, reversed
    expect(figure.clips['transform:robot'].b.slice(0, nb * 7)).toEqual(last);
  });

  it('a jet-bot mounts its wings on its back and hides most of its narrow frame in the fuselage', async () => {
    const { figure, readout } = await jetbot();
    expect(figure.forms.kind).toBe('air');
    expect(readout.panels.filter((p) => /^v_wing/.test(p.id)).every((p) => p.on === 'torso')).toBe(true);
    expect(readout.frameHidden.top).toBeGreaterThan(0.5);
  });

  it('a robot alone folds into its own flight form, lying flat', () => {
    const robot = frame(18);
    const { figure } = composeTransformer({ robot, scheme: 'waverider' });
    // flying flat: the flight form is far longer than it is tall
    const nb = figure.bones.length, b = figure.clips['vehicle:idle'].b;
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < nb; i++) for (let k = 0; k < 3; k++) { const v = b[i * 7 + 4 + k]; mn[k] = Math.min(mn[k], v); mx[k] = Math.max(mx[k], v); }
    expect(mx[1] - mn[1]).toBeGreaterThan(2 * (mx[2] - mn[2]));
  });

  it('a variable suit keeps its kit, rides it standing, and folds it into a waverider: the shield its nose ahead', () => {
    const { figure, readout } = bakeVariableSuit({ H: 18 });
    expect(readout.tris.composed).toBe(readout.tris.robot + readout.tris.kit);
    const on = Object.fromEntries(readout.panels.map((p) => [p.id, p.on]));
    expect(on).toMatchObject({ kit_shield: 'forearmL', kit_binder_l: 'torso', kit_binder_r: 'torso', kit_hip_fin_l: 'pelvis' });
    // folded: long and flat, the shield out ahead of everything else (the nose), the binders spread wider than the body
    const nb = figure.bones.length, b = figure.clips['vehicle:idle'].b, at = (id) => b.slice(figure.bones.findIndex((x) => x.id === id) * 7 + 4, figure.bones.findIndex((x) => x.id === id) * 7 + 7);
    const ys = figure.bones.map((_, i) => b[i * 7 + 5]);
    expect(at('kit_shield')[1]).toBe(Math.max(...ys));
    expect(Math.abs(at('kit_binder_l')[0])).toBeGreaterThan(Math.abs(at('upperArmL')[0]));
    expect(minZ(figure, 'vehicle:idle', 0)).toBeGreaterThan(-0.05);
    expect(figure.thrusters.some((t) => t.kind === 'foot')).toBe(true);   // the heels' jets: the waverider's engines
    expect(nb).toBe(figure.parts.length);
  });

  it('is deterministic', async () => {
    const a = await carbot(), b = await carbot();
    expect(JSON.stringify(a.figure)).toBe(JSON.stringify(b.figure));
  });

  it('every scheme row names a form and a stow', () => {
    for (const [id, S] of Object.entries(TRANSFORM_SCHEMES)) {
      expect(['ground', 'air'], id).toContain(S.form);
      expect(S.stow.root.length, id).toBeGreaterThan(0);
    }
  });

  it('the inner frame is a biped the suit bake rigs, standing its height', () => {
    const f = frame(5);
    expect(f.figH).toBeCloseTo(5, 3);
    expect(f.bones.map((b) => b.id)).toEqual(expect.arrayContaining(['pelvis', 'torso', 'head', 'handL', 'shinR']));
    expect(soupBounds(decodePart(f.parts[0]))).not.toBe(null);
  });
});
