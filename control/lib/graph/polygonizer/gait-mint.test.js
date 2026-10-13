// The walk as minted now (WALK_MINT) against measured human gait: the machine gate for the calibration. Distances are
// read in cm at an 85 cm standing hip height (the vajra figure's hip joint stands 0.61 STAND over its soles).
import { describe, it, expect } from 'vitest';
import { WALK_DEFAULTS, WALK_MINT } from './figure-posing.js';
import { balancedArmature, sampleMotionPose } from './figure-render.js';
import { basePositions } from './figure-vajra.js';
import { heroLocomotion, validateHeroMotion } from './hero-motion.js';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const CM = 85 / 0.61;
const N = 30;
const frames = (walk) => Array.from({ length: N }, (_, i) => balancedArmature(sampleMotionPose({ walk }, i / N, N)));
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.round(p * (s.length - 1))]; };
const p2p = (xs) => pct(xs, 0.97) - pct(xs, 0.03);
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const read = (walk) => {
  const A = frames(walk);
  return {
    sway: p2p(A.map((a) => a.pelvisHub.x)) * CM,                       // the hips, side to side
    gap: mean(A.map((a) => Math.abs(a.ankleL.x - a.ankleR.x))) * CM,   // the feet, side to side
    bob: p2p(A.map((a) => a.pelvisHub.z)) * CM,                        // the hips, up and down
  };
};

describe('stepWidth — the feet closer than the hip joints', () => {
  it('a stepWidth of the hip joints\' own span is the frozen walk', () => {
    const B = basePositions(); const span = Math.abs(B.hipL.x - B.hipR.x);
    const a = frames({ ...WALK_DEFAULTS }), b = frames({ ...WALK_DEFAULTS, stepWidth: span });
    for (let i = 0; i < N; i++) for (const k of Object.keys(a[i])) for (const ax of ['x', 'y', 'z']) expect(b[i][k][ax]).toBeCloseTo(a[i][k][ax], 9);
  });

  it('the minted walk lands its feet and carries its hips inside the measured band; the frozen one waddles', () => {
    const now = read(WALK_MINT), was = read(WALK_DEFAULTS);
    expect(was.sway).toBeGreaterThan(20);                  // 29 cm: the body thrown over each hip-width foot
    expect(now.sway).toBeGreaterThan(6); expect(now.sway).toBeLessThan(10);   // people: 6 … 9 cm
    expect(now.gap).toBeGreaterThan(5); expect(now.gap).toBeLessThan(11);     // people: about 4 … 10 cm
    expect(now.bob).toBeGreaterThan(3); expect(now.bob).toBeLessThan(5);    // people: about 4 cm (the frozen walk 6.4)
  });
});

describe('heelRise — the foot rolls onto its toes in late stance', () => {
  it('absent, the walk has no heel channel; set, the trailing ankle stands off the floor and its knee bends', () => {
    expect(sampleMotionPose({ walk: { ...WALK_DEFAULTS } }, 0.4, N).heelLift).toBeUndefined();
    const d = sampleMotionPose({ walk: WALK_MINT }, 0.4, N), A = balancedArmature(d);
    expect(d.heelLift.L).toBeGreaterThan(0.02);                       // STAND: about 4 cm at an 85 cm hip
    expect(A.ankleL.z).toBeGreaterThan(basePositions().ankleL.z + 0.02);
    const u = ['x', 'y', 'z'].map((k) => A.kneeL[k] - A.hipL[k]), v = ['x', 'y', 'z'].map((k) => A.ankleL[k] - A.kneeL[k]);
    const knee = Math.acos((u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / Math.hypot(...u) / Math.hypot(...v)) * 180 / Math.PI;
    expect(knee).toBeGreaterThan(20);                                 // the frozen walk holds it at 5°
  });

  it('the leg reaches forward about as far as a person\'s (25 … 35°; the frozen walk 40°)', () => {
    const A = frames(WALK_MINT);
    const fwd = pct(A.map((a) => Math.atan2(a.kneeL.y - a.hipL.y, a.hipL.z - a.kneeL.z) * 180 / Math.PI), 0.97);
    expect(fwd).toBeGreaterThan(25); expect(fwd).toBeLessThan(35);
  });
});

describe('the minted walk on a hero', () => {
  const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'female', head: 'anime' }) }).recipe.rig);
  const toeGap = (spec) => {
    const loco = heroLocomotion(spec, R);
    return mean(Array.from({ length: 24 }, (_, i) => {
      const { nodes } = rigNodesAt(R, loco.fn(i / 24));
      return Math.abs(nodes[R.legs.L.toeBase][0] - nodes[R.legs.R.toeBase][0]);
    }));
  };

  it('the minted walk keeps a hero\'s toes on the floor (the rig lifts its own heels)', () => {
    const loco = heroLocomotion({ walk: { ...WALK_MINT } }, R);
    for (const S of Object.keys(R.legs)) {
      const z = Array.from({ length: 120 }, (_, i) => rigNodesAt(R, loco.fn(i / 120)).nodes[R.legs[S].toeBase][2] - R.joints[R.legs[S].toeBase][2]);
      expect(Math.min(...z)).toBeGreaterThan(-1e-6);
    }
  }, 120_000);

  it('the hero door takes the dials, and the minted walk brings the hero\'s feet in', () => {
    expect(validateHeroMotion({ walk: { stepWidth: 0.05, heelRise: 30 } })).toEqual([]);
    expect(toeGap({ walk: { ...WALK_MINT } })).toBeLessThan(0.75 * toeGap({ walk: { ...WALK_DEFAULTS } }));
  }, 120_000);
});
