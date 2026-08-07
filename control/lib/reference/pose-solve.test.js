import { describe, it, expect } from 'vitest';
import { articulate } from '@/lib/graph/polygonizer/figure-vajra';
import { solvePoseFromXManji, projectLandmarks } from './pose-solve.js';

// A clear gesture: weight-shift contrapposto-ish stand with one arm raised.
const TRUE_POSE = {
  shR: { yaw: -28, pitch: -62 }, elbowR: 52,
  shL: { yaw: 22, pitch: -38 }, elbowL: 24,
  hipL: { yaw: 10, pitch: 8 }, kneeL: 22,
  hipR: { yaw: -6, pitch: -4 }, kneeR: 6,
  head: { yaw: 14, pitch: -6 },
  spine: { sagittal: -0.08, lateral: 0.3, axial: 0.12 },
};

describe('pose-solve — X-manji → dials round trip', () => {
  it('recovers a pose from its own projected X-manji (tiny reprojection error)', () => {
    const view = 22;
    const target2D = projectLandmarks(articulate(TRUE_POSE), view);
    const { dof, error } = solvePoseFromXManji(target2D, { view, passes: 18 });
    // The real proof: the solved dials reproject onto the target X-manji.
    expect(error).toBeLessThan(0.01);
    // And the gesture's signature dials land in the right neighborhood.
    expect(dof.elbowR).toBeGreaterThan(25);
    expect(dof.shR?.pitch).toBeLessThan(-25); // right arm raised (negative pitch)
    expect(dof.spine?.lateral).toBeGreaterThan(0.05); // side-bend recovered
  });

  it('tracks a perturbation: tilting the shoulder bar moves spine.lateral', () => {
    const view = 0;
    const base = solvePoseFromXManji(projectLandmarks(articulate({ spine: { lateral: 0 } }), view), { view });
    const tilted = solvePoseFromXManji(projectLandmarks(articulate({ spine: { lateral: 0.6 } }), view), { view });
    expect((tilted.dof.spine?.lateral ?? 0)).toBeGreaterThan((base.dof.spine?.lateral ?? 0) + 0.2);
  });
});
