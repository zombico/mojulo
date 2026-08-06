import { describe, it, expect } from 'vitest';

import { deriveBipedRig, compileUnitPose, freezeUnitRig, eulerToMat, matToEuler } from './unit-pose.js';
import { resolveAssemblerPlacements } from './workbench-assembler.js';

// A minimal biped in the g-series authoring convention: facing '-y', station ids
// with (screen-relative) _l/_r suffixes, one gravity-seated item. `_l` stations
// sit at suit −x, which for a '-y'-facing unit is the ANATOMICAL RIGHT.
const strut = (len, r = 0.3) => ({
  lathes: [{
    axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: -len },
    profile: [{ t: 0.5, radius: r }], crossSections: 4, samples: 6, tint: '#888888',
  }],
});
const footStrut = () => ({
  lathes: [{
    axisFrom: { x: 0, y: 0.1, z: 0.2 }, axisTo: { x: 0, y: -0.8, z: 0.2 },
    profile: [{ t: 0.5, radius: 0.2 }], crossSections: 4, samples: 6, tint: '#888888',
  }],
});

function miniBiped() {
  return {
    kind: 'assembler',
    facing: '-y',
    items: [
      { id: 'head', source: strut(1, 0.5), at: [0, 0, 9] },
      { id: 'torso', source: strut(3, 1), at: [0, 0, 8] },
      { id: 'pelvis', source: strut(1, 0.9), at: [0, 0, 5] },
      { id: 'upper_arm_l', source: strut(1.5), at: [-2, 0, 8] },
      { id: 'upper_arm_r', source: strut(1.5), at: [2, 0, 8] },
      { id: 'forearm_l', source: strut(1.5), at: [-2, 0, 6.5] },
      { id: 'forearm_r', source: strut(1.5), at: [2, 0, 6.5] },
      { id: 'thigh_l', source: strut(2, 0.4), at: [-1, 0, 4] },
      { id: 'thigh_r', source: strut(2, 0.4), at: [1, 0, 4] },
      { id: 'lower_leg_l', source: strut(2, 0.35), at: [-1, 0, 2] },
      { id: 'lower_leg_r', source: strut(2, 0.35), at: [1, 0, 2] },
      { id: 'foot_l', source: footStrut(), on: 'ground', at: [-1, 0, 0] },
      { id: 'foot_r', source: footStrut(), on: 'ground', at: [1, 0, 0] },
    ],
  };
}

const boundsByKey = (manifest) => Object.fromEntries(
  resolveAssemblerPlacements(manifest).map((pl, i) => [pl.id || String(i), pl.bounds]));

describe('deriveBipedRig', () => {
  it('classifies stations into vajra bones, sides resolved by position (not suffix)', () => {
    const rig = deriveBipedRig(miniBiped());
    // facing '-y': suit −x is the anatomical RIGHT → '_l' stations map to R bones.
    expect(rig.bones.upper_arm_l).toBe('upperArmR');
    expect(rig.bones.upper_arm_r).toBe('upperArmL');
    expect(rig.bones.forearm_l).toBe('forearmR');
    expect(rig.bones.thigh_l).toBe('thighR');
    expect(rig.bones.lower_leg_l).toBe('shinR');
    expect(rig.bones.foot_l).toBe('shinR');   // foot rides the shin (no ankle DOF)
    expect(rig.bones.head).toBe('head');
    expect(rig.bones.torso).toBe('torso');
    expect(rig.bones.pelvis).toBe('pelvis');
    expect(rig.model).toBe('biped');
  });

  it('derives joints from station geometry in the rig frame', () => {
    const rig = deriveBipedRig(miniBiped());
    // suit upper_arm_l (x −2, top z 8) → rig frame x +2 → the RIGHT shoulder.
    expect(rig.joints.shoulderR.x).toBeCloseTo(2, 5);
    expect(rig.joints.shoulderR.z).toBeCloseTo(8, 5);
    // elbow = boundary midpoint of upper-arm bottom (6.5) and forearm top (6.5).
    expect(rig.joints.elbowR.z).toBeCloseTo(6.5, 5);
    // knee = boundary of thigh (min 2) and lower leg (max 2).
    expect(rig.joints.kneeR.z).toBeCloseTo(2, 5);
    // pelvisHub centered between the hips.
    expect(rig.joints.pelvisHub.x).toBeCloseTo(0, 5);
    expect(rig.joints.pelvisHub.z).toBeCloseTo(4, 5);
    expect(rig.joints.headTop.z).toBeCloseTo(9, 5);
  });

  it('honors explicit rig overrides from the manifest', () => {
    const m = miniBiped();
    m.rig = { bones: { foot_l: 'thighR' }, joints: { kneeR: { x: -1, y: 0, z: 2.5 } } };
    const rig = deriveBipedRig(m);
    expect(rig.bones.foot_l).toBe('thighR');
    // Joint override given in SUIT frame (x −1) lands in the rig frame (x +1).
    expect(rig.joints.kneeR.x).toBeCloseTo(1, 5);
    expect(rig.joints.kneeR.z).toBeCloseTo(2.5, 5);
  });

  it('throws a clear error when a limb group is missing', () => {
    const m = miniBiped();
    m.items = m.items.filter((it) => !/thigh/.test(it.id));
    expect(() => deriveBipedRig(m)).toThrow(/limb stations/);
  });
});

describe('compileUnitPose', () => {
  it('identity pose keeps every station in place (gravity seats frozen to absolute)', () => {
    const rest = miniBiped();
    const before = boundsByKey(rest);
    const { manifest: posed, report } = compileUnitPose(rest, {});
    expect(posed.items).toHaveLength(rest.items.length);
    expect(posed.items.every((it) => it.on === undefined && it.gap === undefined)).toBe(true);
    const after = boundsByKey(posed);
    for (const key of Object.keys(before)) {
      for (const axis of [0, 1, 2]) {
        expect(after[key].min[axis]).toBeCloseTo(before[key].min[axis], 4);
        expect(after[key].max[axis]).toBeCloseTo(before[key].max[axis], 4);
      }
    }
    expect(report.movedBones).toEqual([]);
    expect(posed.model).toBe('biped');
  });

  it("a 90° right-elbow bend swings the unit's right forearm forward (suit −y)", () => {
    const rest = miniBiped();
    const { manifest: posed, report } = compileUnitPose(rest, { elbowR: 90 });
    expect(report.movedBones).toEqual(['forearmR']);
    const item = posed.items.find((it) => it.id === 'forearm_l');   // suit −x = anatomical right
    // Hinge about the elbow: rig Rx(90) conjugated through facing '-y' = suit Rx(−90).
    expect(item.rotate[0]).toBeCloseTo(-90, 3);
    expect(item.rotate[1]).toBeCloseTo(0, 3);
    expect(item.rotate[2]).toBeCloseTo(0, 3);
    // The station pivots at the elbow (its own translate) and now extends forward.
    expect(item.at[0]).toBeCloseTo(-2, 3);
    expect(item.at[2]).toBeCloseTo(6.5, 3);
    const b = boundsByKey(posed).forearm_l;
    expect(b.min[1]).toBeLessThan(-1);         // reaches forward of the body
    expect(b.min[2]).toBeGreaterThan(6);       // no longer hangs down
    // The left forearm is untouched.
    const other = posed.items.find((it) => it.id === 'forearm_r');
    expect(other.rotate).toBeUndefined();
  });

  it('a knee bend lifts the shin AND the foot riding it, and the unit stays grounded', () => {
    const rest = miniBiped();
    const { manifest: posed, report } = compileUnitPose(rest, { kneeR: 90 });
    expect(report.movedBones).toEqual(['shinR']);
    const foot = boundsByKey(posed).foot_l;
    expect(foot.min[2]).toBeGreaterThan(0.5);  // lifted off the ground with the shin
    // The planted side keeps the unit on the grid: overall min z stays 0.
    let minZ = Infinity;
    for (const b of Object.values(boundsByKey(posed))) if (b.min[2] < minZ) minZ = b.min[2];
    expect(minZ).toBeCloseTo(0, 4);
    expect(report.groundShift).toBeCloseTo(0, 4);
  });

  it('composes bone rotation over a pre-rotated station exactly', () => {
    const rest = miniBiped();
    rest.items.find((it) => it.id === 'forearm_l').rotate = [0, 0, 30];
    const { manifest: posed } = compileUnitPose(rest, { elbowR: 90 });
    const item = posed.items.find((it) => it.id === 'forearm_l');
    // Expected: suit-frame bone rotation Rx(−90) composed over Rz(30).
    const expected = matToEuler(
      // Rx(-90) · Rz(30)
      (() => {
        const Rb = eulerToMat([-90, 0, 0]);
        const Ro = eulerToMat([0, 0, 30]);
        return Rb.map((r) => [
          r[0] * Ro[0][0] + r[1] * Ro[1][0] + r[2] * Ro[2][0],
          r[0] * Ro[0][1] + r[1] * Ro[1][1] + r[2] * Ro[2][1],
          r[0] * Ro[0][2] + r[1] * Ro[1][2] + r[2] * Ro[2][2],
        ]);
      })(),
    );
    for (let i = 0; i < 3; i += 1) expect(item.rotate[i]).toBeCloseTo(expected[i], 3);
  });

  it('freezeUnitRig pins the derived rig; a frozen unit derives without limb stations', () => {
    const m = miniBiped();
    const frozen = freezeUnitRig(m);
    expect(frozen.model).toBe('biped');
    expect(frozen.rig.bones.upper_arm_l).toBe('upperArmR');
    // derivation over the frozen manifest reproduces the derived joints exactly
    const a = deriveBipedRig(m);
    const b = deriveBipedRig(frozen);
    for (const name of Object.keys(a.joints)) {
      for (const axis of ['x', 'y', 'z']) expect(b.joints[name][axis]).toBeCloseTo(a.joints[name][axis], 3);
    }
    // and no longer needs per-segment limb stations: strip the forearms — the
    // un-frozen manifest throws, the frozen one is a pure read
    const strip = (mm) => ({ ...mm, items: mm.items.filter((it) => !/forearm/.test(it.id)) });
    expect(() => deriveBipedRig(strip(m))).toThrow(/limb stations/);
    expect(() => deriveBipedRig(strip(frozen))).not.toThrow();
  });

  it('euler round-trips through the matrix form', () => {
    for (const e of [[0, 0, 0], [30, 0, 0], [10, 20, 30], [-45, 60, -120], [0, 89.9, 45]]) {
      const back = matToEuler(eulerToMat(e));
      const M1 = eulerToMat(e), M2 = eulerToMat(back);
      for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) {
        expect(M2[i][j]).toBeCloseTo(M1[i][j], 6);
      }
    }
  });
});
