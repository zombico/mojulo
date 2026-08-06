import { describe, it, expect } from 'vitest';

import {
  articulate,
  articulateTransforms,
  basePositions,
  BONE_CARRIERS,
} from './figure-vajra.js';

// Deterministic dof samples spanning every articulation channel (seeded values,
// no dice — some intentionally beyond LIMITS to exercise the clamps).
const DOF_SAMPLES = [
  {},
  { elbowL: 90, kneeR: 45 },
  { shL: { yaw: 40, pitch: -60, roll: 50 }, elbowL: 120 },
  { shR: { yaw: -170, pitch: 120 }, elbowR: 200 },              // clamped swivel + clamped hinge
  { hipL: { yaw: 30, pitch: -40, roll: 30 }, kneeL: 70 },
  { spine: { sagittal: 0.8, lateral: -0.7, axial: 0.5 } },      // unified-budget path
  { bend: 40, twist: -50, pelvis: 30, hinge: 90, shoulders: 45 }, // every trunk clamp
  { neck: { yaw: 30, pitch: -20 }, head: { yaw: -50, pitch: 60 } },
  {
    spine: { sagittal: -0.4, axial: -0.6 }, twist: 20, pelvis: -12, shoulders: -20,
    shL: { yaw: 80, pitch: 30, roll: -40 }, shR: { yaw: -30, pitch: 100 },
    hipL: { yaw: -20, pitch: 40 }, hipR: { yaw: 15, pitch: -30, roll: 25 },
    elbowL: 60, elbowR: 140, kneeL: 30, kneeR: 100,
    neck: { yaw: -15, pitch: 10 }, head: { yaw: 20, pitch: -30 },
  },
];

const apply = (T, p) => ({
  x: T.m[0][0] * p.x + T.m[0][1] * p.y + T.m[0][2] * p.z + T.t.x,
  y: T.m[1][0] * p.x + T.m[1][1] * p.y + T.m[1][2] * p.z + T.t.y,
  z: T.m[2][0] * p.x + T.m[2][1] * p.y + T.m[2][2] * p.z + T.t.z,
});

const expectClose = (a, b, msg) => {
  expect(Math.abs(a.x - b.x), msg).toBeLessThan(1e-9);
  expect(Math.abs(a.y - b.y), msg).toBeLessThan(1e-9);
  expect(Math.abs(a.z - b.z), msg).toBeLessThan(1e-9);
};

describe('articulateTransforms parity with articulate', () => {
  it('reproduces every node of articulate() exactly, for every dof sample', () => {
    for (const dof of DOF_SAMPLES) {
      const truth = articulate(dof);
      const { nodes } = articulateTransforms(dof);
      for (const key of Object.keys(truth)) {
        expectClose(nodes[key], truth[key], `node ${key} for dof ${JSON.stringify(dof)}`);
      }
    }
  });

  it('bone transforms carry each carrier node from rest to its posed position', () => {
    const base = basePositions();
    for (const dof of DOF_SAMPLES) {
      const truth = articulate(dof);
      const { bones } = articulateTransforms(dof);
      for (const [bone, carrier] of Object.entries(BONE_CARRIERS)) {
        expectClose(apply(bones[bone], base[carrier]), truth[carrier],
          `bone ${bone} carrier ${carrier} for dof ${JSON.stringify(dof)}`);
      }
    }
  });

  it('bone transforms are rigid (rotation part is orthonormal)', () => {
    const { bones } = articulateTransforms(DOF_SAMPLES[DOF_SAMPLES.length - 1]);
    for (const [bone, T] of Object.entries(bones)) {
      const M = T.m;
      for (let i = 0; i < 3; i += 1) {
        for (let j = 0; j < 3; j += 1) {
          const dot = M[0][i] * M[0][j] + M[1][i] * M[1][j] + M[2][i] * M[2][j];
          expect(Math.abs(dot - (i === j ? 1 : 0)), `bone ${bone} col ${i}·${j}`).toBeLessThan(1e-9);
        }
      }
    }
  });

  it('runs over a non-human base: same joint topology, mech proportions', () => {
    // A suit-scaled skeleton (rig frame, +y forward): tall legs, wide arms.
    const base = {
      headTop: { x: 0, y: 0, z: 22 }, headBase: { x: 0, y: 0, z: 20 },
      neckHub: { x: 0, y: 0, z: 18.7 }, navel: { x: 0, y: 0, z: 14.4 }, pelvisHub: { x: 0, y: 0, z: 10.5 },
      shoulderL: { x: -4.65, y: 0, z: 18.7 }, shoulderR: { x: 4.65, y: 0, z: 18.7 },
      elbowL: { x: -4.65, y: 0, z: 15 }, elbowR: { x: 4.65, y: 0, z: 15 },
      wristL: { x: -4.65, y: 0, z: 12 }, wristR: { x: 4.65, y: 0, z: 12 },
      hipL: { x: -2.24, y: 0, z: 10.5 }, hipR: { x: 2.24, y: 0, z: 10.5 },
      kneeL: { x: -2.24, y: 0, z: 6.6 }, kneeR: { x: 2.24, y: 0, z: 6.6 },
      ankleL: { x: -2.24, y: 0, z: 1.2 }, ankleR: { x: 2.24, y: 0, z: 1.2 },
    };
    const { nodes, bones } = articulateTransforms({ elbowR: 90, kneeL: 45, shL: { yaw: 0, pitch: 90 } }, base);
    // The base object is untouched.
    expect(base.wristR).toEqual({ x: 4.65, y: 0, z: 12 });
    // 90° elbow hinge folds the wrist FORWARD (+y) about the elbow: wrist moves
    // from 3 below the elbow to 3 forward of it.
    expectClose(nodes.wristR, { x: 4.65, y: 3, z: 15 }, 'suit elbow hinge');
    // 90° shoulder pitch swings the whole left arm forward to horizontal.
    expectClose(nodes.elbowL, { x: -4.65, y: 3.7, z: 18.7 }, 'suit shoulder pitch');
    // The forearm bone transform maps the rest wrist onto the posed wrist.
    expectClose(apply(bones.forearmR, base.wristR), nodes.wristR, 'suit forearm transform');
    // Unposed leg bones stay identity: the right knee never moved.
    expectClose(apply(bones.thighR, base.kneeR), base.kneeR, 'unposed thigh identity');
  });
});
