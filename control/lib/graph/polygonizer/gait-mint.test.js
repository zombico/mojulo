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
    expect(now.bob).toBeLessThan(was.bob + 0.5);           // the bounce is not made worse
  });
});

describe('stepWidth on a hero', () => {
  const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'female', head: 'anime' }) }).recipe.rig);
  const toeGap = (spec) => {
    const loco = heroLocomotion(spec, R);
    return mean(Array.from({ length: 24 }, (_, i) => {
      const { nodes } = rigNodesAt(R, loco.fn(i / 24));
      return Math.abs(nodes[R.legs.L.toeBase][0] - nodes[R.legs.R.toeBase][0]);
    }));
  };

  it('the hero door takes the dial, and the minted walk brings the hero\'s feet in', () => {
    expect(validateHeroMotion({ walk: { stepWidth: 0.05 } })).toEqual([]);
    expect(toeGap({ walk: { ...WALK_MINT } })).toBeLessThan(0.75 * toeGap({ walk: { ...WALK_DEFAULTS } }));
  }, 120_000);
});
