import { describe, expect, it } from 'vitest';

import { resolveVehBodyRecipe } from './veh-body.js';
import { resolveVehChassisRecipe } from './veh-chassis.js';
import { deriveAxleSockets, planComponentFit } from './veh-garage.js';
import { resolveVehWheelRecipe } from './veh-wheel.js';
import { bakeVehicleRig, deriveVehicleRig } from './vehicle-rig.js';

// ── D1 gate (drivable-vehicles.plan.md): derive a sedan build → 4 wheel bones classified
// FL/FR/RL/RR by position; wheelbase = front/rear socket y-distance; the bake emits the packed
// rig-figure format and a probe frame shows the wheels ROTATED between phase 0 and 0.5 while the
// root holds still (parts are rigid — the clip quaternion IS the displacement).

function sedanBuild() {
  const chassis = resolveVehChassisRecipe({ seed: 7 });
  const wheel = resolveVehWheelRecipe({ seed: 7 });
  const body = resolveVehBodyRecipe({ seed: 7 });
  const { placements } = planComponentFit(wheel, chassis);
  return {
    manifest: {
      kind: 'assembler',
      items: [
        { id: 'chassis', source: chassis },                                     // authored at ride height (contact patch z=0)
        ...placements.map((p) => ({ source: wheel, at: p.at, ...(p.flip ? { flip: p.flip } : {}) })),
        { id: 'body', source: body },                                           // the shell superposes at [0,0,0] over its chassis
      ],
    },
    chassis, wheel,
  };
}

describe('deriveVehicleRig (D1)', () => {
  it('classifies 4 wheels FL/FR/RL/RR by position against the derived axle sockets', () => {
    const { manifest } = sedanBuild();
    const rig = deriveVehicleRig(manifest);
    expect(rig.model).toBe('vehicle');
    expect(rig.facing).toBe('+y');
    expect(rig.wheels).toHaveLength(4);
    expect(rig.wheels.map((w) => w.bone)).toEqual(['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR']);
    const fl = rig.wheels.find((w) => w.bone === 'wheelFL');
    expect(fl.side).toBe('left');
    expect(fl.axle).toBe('front');
    expect(fl.hubCenter[0]).toBeLessThan(0);        // left = −x in vehicle space
    expect(fl.hubCenter[1]).toBeGreaterThan(0);     // front = +y (forward of travel)
    expect(rig.warnings).toEqual([]);
  });

  it('wheelbase = front/rear socket y-distance; track from the front pair; radius off the garage block', () => {
    const { manifest, chassis, wheel } = sedanBuild();
    const rig = deriveVehicleRig(manifest);
    const sockets = deriveAxleSockets(chassis);
    const frontY = sockets.find((s) => s.axle === 'front').anchor[1];
    const rearY = sockets.find((s) => s.axle === 'rear').anchor[1];
    expect(rig.wheelbase).toBeCloseTo(Math.abs(frontY - rearY), 3);
    expect(rig.track).toBeGreaterThan(0);
    for (const w of rig.wheels) expect(w.radius).toBeCloseTo(wheel.garage.dims.radius, 3);
  });

  it('refuses a build with no chassis; warns on a wheel count that is not 4', () => {
    expect(() => deriveVehicleRig({ kind: 'assembler', items: [] })).toThrow(/veh-chassis/);
    const { manifest } = sedanBuild();
    const threeWheeler = { ...manifest, items: manifest.items.slice(0, manifest.items.length - 2).concat(manifest.items[manifest.items.length - 1]) };
    const rig = deriveVehicleRig(threeWheeler);
    expect(rig.warnings.join(' ')).toMatch(/expected 4 wheels/);
  });
});

describe('bakeVehicleRig (D1)', () => {
  it('emits the packed rig-figure format: bones + per-bone parts + the roll clip', () => {
    const { manifest } = sedanBuild();
    const fig = bakeVehicleRig(manifest, { keys: 12 });
    expect(fig.rig).toBe(true);
    expect(fig.bones.map((b) => b.id)).toEqual(['root', 'wheelFL', 'wheelFR', 'wheelRL', 'wheelRR']);
    expect(fig.parts).toHaveLength(5);
    for (const p of fig.parts) {
      expect(p).not.toBeNull();                     // every bone carries geometry (chassis+body → root)
      expect(typeof p.pos).toBe('string');          // b64 f32 positions
      expect(typeof p.col).toBe('string');          // b64 u8 colours
    }
    expect(fig.clips.roll.k).toBe(12);
    expect(fig.clips.roll.b).toHaveLength(12 * 5 * 7);   // keys × bones × [q4 + head3]
    expect(fig.yaw).toBeCloseTo(-Math.PI / 2, 6);   // authored +y nose → heading-forward
    expect(fig.figH).toBeGreaterThan(0);
    expect(fig.wheelbase).toBeGreaterThan(0);
    expect(fig.wheelRadius).toBeGreaterThan(0);
  });

  it('probe frames: phase 0.5 ROTATES every wheel a half turn about the axle; the root never moves', () => {
    const { manifest } = sedanBuild();
    const fig = bakeVehicleRig(manifest, { keys: 12 });
    const B = 5, F = 7;
    const frame = (k, bone) => fig.clips.roll.b.slice((k * B + bone) * F, (k * B + bone) * F + F);
    // root: identity at every key, head pinned
    for (const k of [0, 3, 6, 9]) {
      const [qx, qy, qz, qw, ...head] = frame(k, 0);
      expect([qx, qy, qz, qw]).toEqual([0, 0, 0, 1]);
      expect(head).toEqual(fig.bones[0].head);
    }
    // wheels: identity at phase 0; a half turn (|qx|≈1, qw≈0) at phase 0.5 (key 6 of 12) — the
    // renderer's T(head)·R(q)·T(−head) then displaces every rim vertex about the hub.
    for (let b = 1; b < 5; b++) {
      const k0 = frame(0, b), k6 = frame(6, b);
      expect([k0[0], k0[1], k0[2], k0[3]]).toEqual([0, 0, 0, 1]);
      expect(Math.abs(k6[0])).toBeCloseTo(1, 4);    // sin(−π/2)
      expect(k6[3]).toBeCloseTo(0, 4);              // cos(−π/2)
      expect(k6[1]).toBe(0);
      expect(k6[2]).toBe(0);                        // pure axle-axis (x) spin
      expect(k6.slice(4)).toEqual(fig.bones[b].head);   // spinning in place on its hub
    }
  });

  it('targetH scales the whole read: figH, wheelbase and wheelRadius shrink together', () => {
    const { manifest } = sedanBuild();
    const raw = bakeVehicleRig(manifest);
    const scaled = bakeVehicleRig(manifest, { targetH: raw.figH / 10 });
    expect(scaled.figH).toBeCloseTo(raw.figH / 10, 2);
    expect(scaled.wheelbase).toBeCloseTo(raw.wheelbase / 10, 2);
    expect(scaled.wheelRadius).toBeCloseTo(raw.wheelRadius / 10, 2);
  });
});
