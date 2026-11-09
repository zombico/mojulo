// The fighter in 3D: the vajra's skeleton posed from the sim's figure. Its side view is the sim's figure (the hands and
// the feet where the boxes are), its bones keep their lengths, it stands bladed with the chest to the camera and the
// lead on the far side, and a character's mesh rides it segment by segment with every joint closed.
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest } from '@/lib/mcp/tools/layered.js';
import { validateRig } from '@/lib/graph/polygonizer/station-loft-rig.js';
import { figureBase, characterBase, figurePose, figureSegments, segmentOf, figureBulk, FIG_LIMITS } from './versus-figure.js';
import { rigJoints, RIG_LIMITS, limitPose } from './versus-rig.js';
import { POSES } from './versus-library.js';
import { compileFighter } from './versus-compile.js';
import { solveFighter } from './versus-solver.js';

const F = compileFighter(solveFighter({ id: 'k', archetype: 'all-rounder' }).recipe);
const BASE = figureBase(F.body);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const side = (p) => [p[1] * 1000, p[2] * 1000];   // the plane: forward, up (mm)
const near2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// every pose the fight shows: the states, and every frame of every move
const POSE_LIST = [...Object.values(POSES), ...Object.values(F.moves).flatMap((m) => m.frames.slice(1).map((f) => f.pose))];
// a hero's rig as its pack carries it
const R = validateRig(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male' }) }).recipe.rig);
const BONES = R.bones.map((b) => ({ id: b.id, head: R.joints[b.head], tail: R.joints[b.tail] }));

describe('versus: the fighter in 3D', () => {
  it('seen from the side it is the sim\'s figure: the hands, the feet and the trunk where the boxes are, both ways it faces', () => {
    // (a toe is the sim's, or its foot is held at the ankle's limit against the shin as it is drawn: RIG_LIMITS)
    const ankle = (N, S) => {
      const sd = [N[`knee${S}`][1] - N[`ankle${S}`][1], N[`knee${S}`][2] - N[`ankle${S}`][2]], fd = [N[`toe${S}`][1] - N[`ankle${S}`][1], N[`toe${S}`][2] - N[`ankle${S}`][2]];
      const a = (Math.atan2(sd[1], sd[0]) - Math.atan2(fd[1], fd[0])) * 180 / Math.PI;
      return Math.atan2(Math.sin(a * Math.PI / 180), Math.cos(a * Math.PI / 180)) * 180 / Math.PI;
    };
    const atLimit = (b) => RIG_LIMITS.ankle.some((v) => Math.abs(b - (180 - v)) < 0.01);
    let worst = 0, held = 0, toes = 0;
    for (const pose of POSE_LIST) {
      const J = rigJoints(F.body, pose);
      for (const face of [1, -1]) {
        const N = figurePose(BASE, J, { face, air: !!pose.air });
        const lead = face > 0 ? 'L' : 'R', rear = lead === 'L' ? 'R' : 'L';
        for (const [S, X] of [[lead, 'F'], [rear, 'B']]) {
          worst = Math.max(worst, near2(side(N[`wrist${S}`]), J[`hand${X}`]));
          toes++;
          const off = near2(side(N[`toe${S}`]), J[`toe${X}`]);
          if (off < 2) continue;
          // (and never far: a sixth of the foot)
          expect(off).toBeLessThan(F.body.foot / 6);
          expect(atLimit(ankle(N, S)), `a toe ${off.toFixed(1)} mm off the sim's with its ankle not at its limit`).toBe(true);
          held++;
        }
        worst = Math.max(worst, near2(side(N.pelvisHub), J.pelvis));
      }
    }
    expect(worst).toBeLessThan(2);   // mm
    // (a hold is the exception: about one toe in twenty, measured 5.2% when it was written)
    expect(held / toes).toBeLessThan(0.08);
  });

  it('keeps every bone its length', () => {
    const pose = F.moves['stand.H'].frames[F.moves['stand.H'].startup].pose;
    const N = figurePose(BASE, rigJoints(F.body, pose), { face: 1 });
    for (const [a, b] of [['shoulderL', 'elbowL'], ['elbowL', 'wristL'], ['hipR', 'kneeR'], ['kneeR', 'ankleR'], ['ankleR', 'toeR'], ['pelvisHub', 'neckHub']]) {
      expect(dist(N[a], N[b]), `${a}-${b}`).toBeCloseTo(dist(BASE[a], BASE[b]), 6);
    }
  });

  it('stands bladed: the chest toward the camera, the lead shoulder forward and on the far side, whichever way it faces', () => {
    const J = rigJoints(F.body, POSES.guard);
    for (const face of [1, -1]) {
      const N = figurePose(BASE, J, { face });
      // the camera is the figure's right when it faces +x, its left when it faces -x
      const toCam = face, lead = face > 0 ? 'L' : 'R', rear = lead === 'L' ? 'R' : 'L';
      expect(Math.sign(N[`shoulder${lead}`][0]), `face ${face}: lead far`).toBe(-toCam);
      expect(N[`shoulder${lead}`][1]).toBeGreaterThan(N[`shoulder${rear}`][1] + 0.05);
      const chest = [N.shoulderR[1] - N.shoulderL[1], -(N.shoulderR[0] - N.shoulderL[0])];   // the shoulder line's normal, forward-ish
      expect(Math.sign(chest[0]) * toCam, `face ${face}: chest to the camera`).toBeLessThan(0);
    }
    const square = figurePose(BASE, J, { face: 1, blade: 0 });
    expect(square.shoulderL[1]).toBeCloseTo(square.shoulderR[1], 9);
  });

  it('a character\'s rig is its skeleton: its mesh rides each segment, every joint closed, unturned at its own rest', () => {
    const B = characterBase(BONES);
    const S0 = figureSegments(B, B);
    for (const { R: M } of Object.values(S0)) M.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(i === j ? 1 : 0, 9)));
    const pose = F.moves['stand.M'].frames[F.moves['stand.M'].startup].pose;
    const N = figurePose(B, rigJoints(F.body, pose), { face: 1 });
    const S = figureSegments(B, N);
    const ride = (seg, p) => { const { R: M, from, at } = S[seg]; const d = [p[0] - from[0], p[1] - from[1], p[2] - from[2]]; return M.map((r, i) => r[0] * d[0] + r[1] * d[1] + r[2] * d[2] + at[i]); };
    for (const [seg, end] of [['upperArmR', 'elbowR'], ['foreArmL', 'wristL'], ['thighL', 'kneeL'], ['shinR', 'ankleR'], ['footL', 'toeL'], ['torso', 'neckHub'], ['head', 'headTop']]) {
      expect(dist(ride(seg, B[end]), N[end]), seg).toBeLessThan(1e-9);
    }
  });

  it('every bone of a rig rides a segment by its name', () => {
    const rides = Object.fromEntries(BONES.map((b) => [b.id, segmentOf(b.id)]));
    expect(rides).toMatchObject({ pelvis: 'pelvis', lumbar: 'pelvis', jaw: 'head', clavicleR: 'torso', thumb2L: 'foreArmL', handR: 'foreArmR', kneeFoldL: 'shinL', toesR: 'footR', hipFoldR: 'thighR' });
    // a creature's: digitigrade legs, fingers, a tail
    expect(['metaR', 'fingerB2L', 'tail3', 'shinL'].map(segmentOf)).toEqual(['shinR', 'foreArmL', 'pelvis', 'shinL']);
  });
});

describe('versus: the arena carries a character\'s body only when it has one', () => {
  it('a roster without a character adds no bodies; with one, its body rides the channel under its ref', async () => {
    const { versusArenaData } = await import('./versus-page.js');
    const { versusChannelScript } = await import('../scene/channels/versus.js');
    const plain = versusArenaData({ roster: [{ id: 'a', archetype: 'zoner' }] });
    expect(plain).not.toHaveProperty('bodies');
    const body = { bones: BONES.slice(0, 2), parts: [null, null] };
    const carried = versusArenaData({ roster: [{ id: 'a', archetype: 'zoner', character: 'him', body: { height: 1700 } }], bodies: { him: body } });
    expect(carried.bodies).toEqual({ him: body });
    expect(carried.roster[0].character).toBe('him');
    expect(versusChannelScript(carried)).toContain('"bodies":{"him"');
    expect(versusChannelScript(plain)).not.toContain('"bodies"');
  });
});

describe('versus: the stance, and the side tilt', () => {
  const pose = (stance, face = 1, extra = {}) => figurePose(BASE, rigJoints(F.body, POSES.guard), { face, stance, ...extra });
  const opening = (N) => Math.abs(Math.atan2(N.shoulderL[1] - N.shoulderR[1], N.shoulderL[0] - N.shoulderR[0]) * 180 / Math.PI);
  it('each style stands its own way: a rushdown opens to the screen further than a grappler', () => {
    const rush = compileFighter(solveFighter({ id: 'r', archetype: 'rushdown' }).recipe).stance;
    const grab = compileFighter(solveFighter({ id: 'g', archetype: 'grappler' }).recipe).stance;
    expect(rush.open).toBeGreaterThan(grab.open);
    expect(Math.abs(180 - opening(pose(rush)))).toBeGreaterThan(Math.abs(180 - opening(pose(grab))));
    expect(() => compileFighter({ ...solveFighter({ id: 'x' }).recipe, stance: { open: 90 } })).toThrow(/stance\.open is degrees from 0 to 70/);
  });

  it('tilts the trunk toward the camera: the shoulder on the camera\'s side lower than it would stand, whichever way it faces', () => {
    for (const face of [1, -1]) {
      const near = face > 0 ? 'R' : 'L', far = near === 'R' ? 'L' : 'R';
      const drop = (N) => N[`shoulder${near}`][2] - N[`shoulder${far}`][2];
      const tilted = pose({ open: 45, hips: 28, tilt: 12 }, face), upright = pose({ open: 45, hips: 28, tilt: 0 }, face);
      expect(drop(tilted), `face ${face}`).toBeLessThan(drop(upright) - 0.05);
      // the trunk leans toward the screen: the neck nearer the camera than the pelvis
      expect(Math.sign(tilted.neckHub[0] - tilted.pelvisHub[0])).toBe(face);
    }
    // and the side view stays the sim's: the hands where the boxes are
    const J = rigJoints(F.body, POSES.guard), N = pose({ open: 60, hips: 40, tilt: 20 });
    expect(Math.hypot(N.wristL[1] * 1000 - J.handF[0], N.wristL[2] * 1000 - J.handF[1])).toBeLessThan(2);
  });
});

describe('versus: the round body\'s joints and its own parts', () => {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180 / Math.PI;
  const fold = (a, j, b) => 180 - angle(sub(a, j), sub(b, j));
  // every pose of the fighter, standing in its own stance and turned by its own channels
  const posed = POSE_LIST.map((pose) => figurePose(BASE, rigJoints(F.body, pose), { air: !!pose.air, stance: F.stance, twist: pose.twist ?? 0, sway: pose.sway ?? 0, tilt: pose.tilt ?? 0, ...(pose.hands ? { hands: pose.hands } : {}), ...(pose.feet ? { feet: pose.feet } : {}) }));

  it('the side view\'s bends are held as poses become joints: a knee one way and not past its fold, the ankle, the neck, the shoulder', () => {
    expect(limitPose(POSES.guard)).toBe(POSES.guard);
    const bad = limitPose({ torso: 0, head: 80, armB: [-90, -60], legF: [10, 40, 200], legB: [90, -100, 90] });
    expect(bad.head).toBe(RIG_LIMITS.neck);
    // (an arm thrown behind the back stops there, its forearm carried with it)
    expect(bad.armB).toEqual([RIG_LIMITS.shoulder, RIG_LIMITS.shoulder + 30]);
    expect(bad.legF[0] - bad.legF[1]).toBe(RIG_LIMITS.knee[0]);
    expect(bad.legB[0] - bad.legB[1]).toBe(RIG_LIMITS.knee[1]);
    expect(bad.legF[2] - bad.legF[1]).toBe(RIG_LIMITS.ankle[1]);
    expect(rigJoints(F.body, bad)).toEqual(rigJoints(F.body, limitPose(bad)));
  });

  it('in the round no elbow or knee folds past its limit, and the spine twists no further than its own', () => {
    let elbow = 0, knee = 0, spine = 0;
    for (const N of posed) {
      for (const S of ['L', 'R']) {
        elbow = Math.max(elbow, fold(N[`shoulder${S}`], N[`elbow${S}`], N[`wrist${S}`]));
        knee = Math.max(knee, fold(N[`hip${S}`], N[`knee${S}`], N[`ankle${S}`]));
      }
      const up = unit(sub(N.neckHub, N.pelvisHub)), flat = (v) => sub(v, up.map((u) => u * dot(v, up)));
      spine = Math.max(spine, angle(flat(sub(N.hipR, N.hipL)), flat(sub(N.shoulderR, N.shoulderL))));
    }
    expect(elbow).toBeLessThanOrEqual(FIG_LIMITS.elbow + 0.5);
    expect(knee).toBeLessThanOrEqual(FIG_LIMITS.knee + 0.5);
    // (the turns are whole degrees, and the trunk's tilt reads in the shoulder line)
    expect(spine).toBeLessThanOrEqual(FIG_LIMITS.spine + 2);
  });

  it('its arms keep out of its trunk and its head, and its legs out of each other', () => {
    const B = figureBulk(BASE);
    // (the shortest distance between two segments, sampled finely: enough to read a depth in millimetres)
    const segDist = (p, q, a, b) => {
      let best = Infinity;
      for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) {
        const u = i / 40, v = j / 40, x = p.map((c, k) => c + (q[k] - c) * u), y = a.map((c, k) => c + (b[k] - c) * v);
        best = Math.min(best, Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]));
      }
      return best;
    };
    let arm = 0, legs = 0;
    for (const N of posed.filter((_, i) => i % 7 === 0)) {
      const up = unit(sub(N.neckHub, N.pelvisHub)), across = unit(sub(N.shoulderR, N.shoulderL)), fwd = unit(cross(up, across)), lat = unit(cross(fwd, up));
      const k = B.trunkW / B.trunkD, inT = (v) => { const d = sub(v, N.pelvisHub); return [dot(d, lat), dot(d, fwd) * k, dot(d, up)]; };
      for (const S of ['L', 'R']) {
        arm = Math.max(arm, B.trunkW + B.limb - segDist(inT(N[`elbow${S}`]), inT(N[`fist${S}`]), inT(N.pelvisHub), inT(N.neckHub)));
        arm = Math.max(arm, B.head + B.limb - segDist(N[`elbow${S}`], N[`fist${S}`], N.headBase, N.headTop));
      }
      legs = Math.max(legs, 2 * B.leg * 0.85 - segDist(N.kneeL, N.ankleL, N.kneeR, N.ankleR));
    }
    // (touching to the skin's depth, and a few millimetres of a pose whose hand nothing frees)
    expect(arm * 1000).toBeLessThan(B.skin * 1000 + 10);
    expect(legs * 1000).toBeLessThan(B.skin * 1000 + 5);
  });
});
