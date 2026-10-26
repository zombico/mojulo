import { describe, it, expect } from 'vitest';
import { athleteNodes, athleteBase, strideStick, swingStick } from './athlete-pose.js';
import { figureSegments } from '../versus/versus-figure.js';

// a small rig in the layered hero's names and frame (metres, z up, facing +y): longer legs than the stick's
const bone = (id, head, tail) => ({ id, head, tail });
const RIG = [
  bone('pelvis', [0, 0, 1.0], [0, 0, 1.25]), bone('torso', [0, 0, 1.25], [0, 0, 1.52]), bone('neck', [0, 0, 1.52], [0, 0, 1.64]), bone('head', [0, 0, 1.64], [0, 0, 1.86]),
  ...[['L', -1], ['R', 1]].flatMap(([S, x]) => [
    bone(`upperArm${S}`, [x * 0.22, 0, 1.5], [x * 0.25, 0, 1.2]), bone(`foreArm${S}`, [x * 0.25, 0, 1.2], [x * 0.3, 0, 0.95]), bone(`hand${S}`, [x * 0.3, 0, 0.95], [x * 0.31, 0, 0.86]),
    bone(`thigh${S}`, [x * 0.11, 0.05, 1.0], [x * 0.09, 0.06, 0.53]), bone(`shank${S}`, [x * 0.09, 0.06, 0.53], [x * 0.09, 0, 0.05]), bone(`foot${S}`, [x * 0.09, 0, 0.05], [x * 0.09, 0.09, 0.03]), bone(`toes${S}`, [x * 0.09, 0.09, 0.03], [x * 0.09, 0.17, 0.025]),
  ]),
];
const base = athleteBase(RIG);
const V = { sub: (a, b) => a.map((v, i) => v - b[i]), len: (a) => Math.hypot(...a) };
const unit = (a) => { const l = V.len(a); return a.map((v) => v / l); };
const LIMBS = [['hip', 'knee'], ['knee', 'ankle'], ['shoulder', 'elbow'], ['elbow', 'wrist']];
const sole = (N) => Math.min(...['L', 'R'].flatMap((S) => [N[`ankle${S}`][2] - base[`ankle${S}`][2], N[`toe${S}`][2] - base[`toe${S}`][2]]));

describe('athlete pose: a character on a sport\'s stick', () => {
  const run = strideStick({ at: [3, -2], heading: 0.4, phase: 1.1, speed: 6 });

  it('lays each limb along the stick\'s bone at the character\'s own length', () => {
    const N = athleteNodes(base, run, { face: [Math.cos(0.4), Math.sin(0.4)] });
    for (const S of ['L', 'R']) for (const [a, b] of LIMBS) {
      expect(V.len(V.sub(N[b + S], N[a + S]))).toBeCloseTo(V.len(V.sub(base[b + S], base[a + S])), 6);
      const want = unit(V.sub(run[b + S], run[a + S])), got = unit(V.sub(N[b + S], N[a + S]));
      want.forEach((w, i) => expect(got[i]).toBeCloseTo(w, 6));
    }
  });

  it('stands on the ground by its lowest sole, and the stick\'s air lifts it', () => {
    expect(sole(athleteNodes(base, run, { face: [1, 0] }))).toBeCloseTo(0, 9);
    expect(sole(athleteNodes(base, run, { face: [1, 0], ground: 0.2, lift: 0.5 }))).toBeCloseTo(0.7, 9);
  });

  it('faces where it is told: the trunk turned rigidly, the right side on the right', () => {
    const stand = strideStick({ at: [0, 0], heading: Math.PI, speed: 0 });
    const N = athleteNodes(base, stand, { face: [-1, 0] });
    // facing -x, its right is +y
    expect(N.hipR[1] - N.hipL[1]).toBeGreaterThan(0.2);
    expect(Math.abs(N.hipR[0] - N.hipL[0])).toBeLessThan(1e-6);
    expect(V.len(V.sub(N.shoulderR, N.hipR))).toBeCloseTo(V.len(V.sub(base.shoulderR, base.hipR)), 9);
  });

  it('closes the chain: every segment of the figure turns its rest bone onto the posed one', () => {
    const N = athleteNodes(base, run, { face: [Math.cos(0.4), Math.sin(0.4)], lift: 0.1 });
    const S = figureSegments(base, N);
    const ride = (seg, v) => { const { R, from, at } = S[seg], d = V.sub(v, from); return R.map((row, i) => row[0] * d[0] + row[1] * d[1] + row[2] * d[2] + at[i]); };
    for (const [seg, end] of [['thighR', 'kneeR'], ['shinL', 'ankleL'], ['foreArmR', 'wristR'], ['footL', 'toeL']]) {
      ride(seg, base[end]).forEach((v, i) => expect(v).toBeCloseTo(N[end][i], 6));
    }
  });

  it('is the same pose for the same stick, a standing body symmetric', () => {
    expect(athleteNodes(base, run, { face: [1, 0] })).toEqual(athleteNodes(base, run, { face: [1, 0] }));
    const st = strideStick({ at: [0, 0], heading: Math.PI / 2, speed: 0 });
    expect(st.kneeL[2]).toBeCloseTo(st.kneeR[2], 9);
  });

  it('addresses a ball: golf\'s hands together, bowling\'s right arm alone, the swing out along the target', () => {
    const golf = swingStick({ at: [0, 0], face: Math.PI / 2, along: 0, swing: 0, both: true });
    expect(golf.wristL).toEqual(golf.wristR);
    const through = swingStick({ at: [0, 0], face: Math.PI / 2, along: 0, swing: 1.2, both: true });
    expect(through.wristR[0]).toBeGreaterThan(golf.wristR[0] + 0.3);
    const bowl = swingStick({ at: [0, 0], face: 0, along: 0, swing: -0.8, both: false });
    expect(bowl.wristL).not.toEqual(bowl.wristR);
    expect(bowl.wristR[0]).toBeLessThan(bowl.shoulderR[0]);
  });
});
