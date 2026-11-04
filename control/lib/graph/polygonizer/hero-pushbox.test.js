// hero-pushbox: two bodies kept apart by capsules on their skeletons. The concepts on two heroes' rigs squared up: apart,
// nothing is pushed; stepped into each other, the push is the least that parts them (a little less leaves them meeting),
// the forearms and the hands never count (gloves meet), and the radii are read off a skin as its points' distances to their segments.
import { describe, it, expect } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { heroStance } from './hero-stance.js';
import { capsulesOf, capsuleRadii, overlap, pushApart, segSeg, PUSH_CHAINS } from './hero-pushbox.js';

const R = validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'male' }) }).recipe.rig);
// (the rig's nodes under the GLB's bone names the chains read)
const BONES = { pelvis: 'pelvisHub', neck: 'neckHub', head: 'headBase', thighR: 'hipR', thighL: 'hipL', shankR: 'kneeR', shankL: 'kneeL', footR: 'ankleR', footL: 'ankleL', upperArmR: 'shoulderR', upperArmL: 'shoulderL', foreArmR: 'elbowR', foreArmL: 'elbowL' };
const guard = rigNodesAt(R, heroStance('guard', R).clip.fn(1)).nodes;
const RADII = { trunk: 0.15, head: 0.1, thighR: 0.08, thighL: 0.08, shinR: 0.06, shinL: 0.06, upperArmR: 0.06, upperArmL: 0.06 };
/** the guard's joints, turned to face −y (a half turn about z) and set `d` metres ahead along +y */
const faced = (d) => Object.fromEntries(Object.entries(BONES).map(([b, n]) => [b, [-guard[n][0], -guard[n][1] + d, guard[n][2]]]));
const own = Object.fromEntries(Object.entries(BONES).map(([b, n]) => [b, guard[n]]));

describe('hero-pushbox', () => {
  it('builds the body\'s capsules, never the arms, and measures the nearest of two segments', () => {
    const C = capsulesOf(own, RADII);
    expect(C.map((c) => c.id).sort()).toEqual(PUSH_CHAINS.map((c) => c.id).sort());
    expect(C.some((c) => /foreArm|hand/i.test(c.id))).toBe(false);
    expect(segSeg([0, 0, 0], [1, 0, 0], [0.5, 1, -1], [0.5, 1, 1])).toBeCloseTo(1, 9);
    expect(segSeg([0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0])).toBeCloseTo(1, 9);
  }, 60000);
  it('pushes nothing apart, and the least that parts two bodies stepped into each other', () => {
    const A = capsulesOf(own, RADII);
    expect(pushApart(A, capsulesOf(faced(1.5), RADII), [0, 1, 0])).toBe(0);
    const B = capsulesOf(faced(0.2), RADII), s = pushApart(A, B, [0, 1, 0], { gap: 0 });
    expect(overlap(A, B)).toBeGreaterThan(0.05);
    expect(s).toBeGreaterThan(0.05);
    const at = (d) => capsulesOf(faced(0.2 + d), RADII);
    expect(overlap(A, at(s))).toBeLessThan(1e-3);
    expect(overlap(A, at(s - 0.01))).toBeGreaterThan(0);
  }, 60000);
  it('reads a capsule\'s radius off a skin: its points\' distances to its segment', () => {
    const a = own.pelvis, b = own.neck, pts = [], owner = [];
    for (let k = 0; k < 200; k++) { const t = k / 199, th = k * 2.4; pts.push([a[0] + (b[0] - a[0]) * t + 0.12 * Math.cos(th), a[1] + (b[1] - a[1]) * t + 0.12 * Math.sin(th), a[2] + (b[2] - a[2]) * t]); owner.push('trunk'); }
    expect(capsuleRadii(pts, (i) => owner[i], own).trunk).toBeCloseTo(0.12, 2);
  });
});
