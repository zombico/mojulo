// the FOLDS (station-loft-rig.js foldPoints, hero-form.js): the knee's and the elbow's helper bone sits on its hinge at
// rest, turns half the bend (the mitre of the two limb tubes), its head pushed to the bend's outside by the mitre's own
// growth — so the rings at a bent hinge keep their volume instead of folding flat through the joint — and the hinge's
// rings ride it alone.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const recipeOf = (hero) => expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord(hero) }).recipe;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
const angle = (a, b) => (Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180) / Math.PI;

describe('the folds', () => {
  const recipe = recipeOf({ cast: 'female', head: 'anime' }); const R = validateRig(recipe.rig);
  it('sit on the hinge at rest', () => {
    for (const S of ['L', 'R']) for (const h of ['hip', 'knee', 'elbow']) expect(Math.hypot(...sub(R.joints[`${h}Fold${S}`], R.joints[`${h}${S}`]))).toBeLessThan(1e-3);
  });
  it('a bent knee: the fold turns half the bend and its head goes out to the kneecap by the mitre', () => {
    const n = rigNodesAt(R, { sink: 0.3, hinge: 30 }).nodes; const F = R.folds.kneeFoldR;
    const thigh = sub(n.kneeR, n.hipR), shank = sub(n.ankleR, n.kneeR), axis = sub(n.kneeFoldTipR, n.kneeFoldR);
    const bend = angle(thigh, shank); expect(bend).toBeGreaterThan(60);
    expect(Math.abs(angle(thigh, axis) - bend / 2)).toBeLessThan(0.5); expect(Math.abs(angle(axis, shank) - bend / 2)).toBeLessThan(0.5);
    const push = Math.hypot(...sub(n.kneeFoldR, n.kneeR)), want = F.push * Math.min(F.cap, 1 / Math.cos((bend / 2) * Math.PI / 180) - 1);
    expect(push).toBeCloseTo(want, 6);
    // the outside: away from the hip-to-ankle line (the knee's own side of it), so forward on a crouch
    const mid = [(n.hipR[0] + n.ankleR[0]) / 2, (n.hipR[1] + n.ankleR[1]) / 2, (n.hipR[2] + n.ankleR[2]) / 2];
    expect(dot(sub(n.kneeFoldR, n.kneeR), sub(n.kneeR, mid))).toBeGreaterThan(0);
  });
  it('a bent elbow pushes its point out behind the arm', () => {
    const n = rigNodesAt(R, { shR: { pitch: 30 }, elbowR: 110 }).nodes;
    const mid = [(n.shoulderR[0] + n.wristR[0]) / 2, (n.shoulderR[1] + n.wristR[1]) / 2, (n.shoulderR[2] + n.wristR[2]) / 2];
    expect(Math.hypot(...sub(n.elbowFoldR, n.elbowR))).toBeGreaterThan(0.01);
    expect(dot(sub(n.elbowFoldR, n.elbowR), sub(n.elbowR, mid))).toBeGreaterThan(0);
  });
  it('the hip (a ball joint): the fold turns half the thigh off the pelvis, both sides mirrored, and carries the hip ring with the basin', () => {
    const n = rigNodesAt(R, { hipR: { pitch: 60, yaw: -25 }, hipL: { pitch: 60, yaw: 25 }, support: 'none' }).nodes;
    for (const S of ['R', 'L']) {
      const thigh = sub(n[`knee${S}`], n[`hip${S}`]), socket = R.folds[`hipFold${S}`].inAxis, axis = sub(n[`hipFoldTip${S}`], n[`hipFold${S}`]);
      const bend = angle(socket, thigh); expect(bend).toBeGreaterThan(40);
      expect(Math.abs(angle(socket, axis) - bend / 2)).toBeLessThan(1);
    }
    expect(n.hipFoldL[0]).toBeCloseTo(-n.hipFoldR[0], 6); expect(n.hipFoldL[1]).toBeCloseTo(n.hipFoldR[1], 6);
    expect(recipe.parts.thighR.bind.blend.st1).toEqual({ pelvis: 0.5, hipFoldR: 0.5 }); expect(recipe.parts.thighR.bind.blend.st2).toEqual({ thighR: 1 });   // the thigh rigid below the hip ring (a hard limb)
  });
  it('the hinge rings ride the fold alone; the streamlined core has none', () => {
    expect(recipe.parts.thighR.bind.blend.st4).toEqual({ kneeFoldR: 1 }); expect(recipe.parts.shankR.bind.blend.st0).toEqual({ kneeFoldR: 1 });
    expect(recipe.parts.foreArmL.bind.blend.st0).toEqual({ elbowFoldL: 1 }); expect(recipe.parts.shankR.bind.blend.back).toEqual({ thighR: 1 });   // the pinched cap stays inside the other limb
    const plain = recipeOf({ cast: 'female', core: 'streamlined' }); expect(plain.rig.folds).toBeUndefined();
  });
});
