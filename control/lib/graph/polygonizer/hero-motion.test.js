// hero-motion — the locomotion bake's laws on real hero rigs: the rig without `feet` / `sink` is the rig as it was, the
// stance toe is on the floor and slides back at ONE speed (so at v a planted foot stays put), the swing toe clears the
// floor, every phase solves on a rig that refuses an unreachable toe, and the bake is deterministic.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroLocomotion, groundedPose, rigCore, locomotionCameraCurve, motionPlan, locomotionClips, MOTION_GAITS } from './hero-motion.js';
import { resolveMotion } from './figure-posing.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const rigOf = (hero) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord(hero) }).recipe.rig);
const HEROES = {
  female: rigOf({ cast: 'female', head: 'anime' }),
  male: rigOf({ cast: 'male', head: 'anime' }),
  bare: rigOf({ cast: 'male' }),
};
const WALK = 'walk', JOG = { sprint: { dutyFactor: 0.45, strideLength: 0.5, lean: 0.15 } };
const N = 48;

/** each toe over a cycle: height above its rest floor and fore-aft place */
function trace(R, fn) {
  const sides = Object.keys(R.legs);
  return Array.from({ length: N }, (_, i) => { const { nodes } = rigNodesAt(R, fn(i / N)); return Object.fromEntries(sides.map((S) => { const L = R.legs[S]; return [S, { h: nodes[L.toeBase][2] - R.joints[L.toeBase][2], y: nodes[L.toeBase][1] }]; })); });
}

describe('hero-motion: the rig channels', () => {
  it('a pose without feet or sink solves exactly as before (the channels are absent ⇒ nothing moves)', () => {
    const R = HEROES.female;
    for (const pose of [{}, { support: 'R', kneeL: 30 }, { crouch: 0.3, heelL: -10 }, { lift: 0.05, support: 'none' }]) {
      expect(rigNodesAt(R, { ...pose, feet: undefined, sink: undefined }).nodes).toEqual(rigNodesAt(R, pose).nodes);
    }
  });
  it('feet place a leg\'s toe base where asked, and sink lowers the root by its metres', () => {
    const R = HEROES.male; const L = R.legs.L; const at = [R.joints[L.toeBase][0], R.joints[L.toeBase][1] + 0.1, R.joints[L.toeBase][2]];
    const { nodes } = rigNodesAt(R, { feet: { L: at }, sink: 0.03 });
    expect(nodes[L.toeBase]).toEqual(at);
    expect(nodes.pelvisHub[2]).toBeCloseTo(R.joints.pelvisHub[2] - 0.03, 9);
  });
});

describe('hero-motion: the locomotion bake', () => {
  for (const [name, R] of Object.entries(HEROES)) for (const [gait, spec] of [['walk', WALK], ['jog', JOG]]) {
    it(`${name} ${gait}: every phase solves; stance on the floor sliding at one speed; the swing clears`, () => {
      const loco = heroLocomotion(spec, R, { frames: N });
      expect(loco.travel).toBeGreaterThan(0.2);
      const T = trace(R, loco.fn);   // throws on an unreachable toe (the hero rig refuses)
      for (const S of Object.keys(R.legs)) {
        const planted = T.map((f) => f[S].h < 1e-6);
        expect(planted.some(Boolean)).toBe(true);
        expect(T.every((f) => f[S].h > -1e-6)).toBe(true);          // never through the floor
        expect(Math.max(...T.map((f) => f[S].h))).toBeGreaterThan(0.05);   // the swing lifts
        // the planted slide, frame to frame, is one speed: travel per cycle ÷ N per frame
        const steps = T.map((f, i) => (planted[i] && planted[(i + 1) % N] ? f[S].y - T[(i + 1) % N][S].y : null)).filter((x) => x !== null);
        for (const d of steps) expect(d).toBeCloseTo(loco.travel / N, 6);
      }
    });
  }
  // THE CAMERA TEST: anything riding the head (a first-person camera on the head bone, the viewer's eye on the figure)
  // feels the root's motion. The sink is planned over the whole cycle, so the head bobs; it never drops in one frame as
  // a foot lands far forward (phase by phase it did: ~1600 g at the walk's footfall).
  for (const [gait, spec, seconds, gMax] of [['walk', WALK, 1.1, 1.2], ['jog', JOG, 0.7, 3.5]]) {
    it(`${gait}: the head's vertical acceleration stays a bob (under ${gMax} g), the heel rolls without a step`, () => {
      const R = HEROES.male; const loco = heroLocomotion(spec, R); const M = 480, dt = seconds / M;
      const poses = Array.from({ length: M }, (_, i) => loco.fn(i / M));
      const z = poses.map((p) => rigNodesAt(R, p).nodes.headBase[2]);
      const acc = z.map((v, i) => (z[(i + 1) % M] - 2 * v + z[(i - 1 + M) % M]) / (dt * dt));
      expect(Math.max(...acc.map(Math.abs)) / 9.81).toBeLessThan(gMax);
      for (const S of Object.keys(R.legs)) { const h = poses.map((p) => p[`heel${S}`]); expect(Math.max(...h.map((v, i) => Math.abs(h[(i + 1) % M] - v)))).toBeLessThan(3); }
    });
  }
  it('is deterministic', () => {
    const R = HEROES.female; const a = heroLocomotion(WALK, R, { frames: N }), b = heroLocomotion(WALK, R, { frames: N });
    for (const p of [0, 0.13, 0.5, 0.77]) expect(JSON.stringify(a.fn(p))).toBe(JSON.stringify(b.fn(p)));
    expect(a.travel).toBe(b.travel);
  });
  it('a longer stride covers more ground; v is travel over the clip\'s seconds', () => {
    const R = HEROES.male; const short = heroLocomotion({ walk: { strideLength: 0.25 } }, R), long = heroLocomotion({ walk: { strideLength: 0.42 } }, R);
    expect(long.travel).toBeGreaterThan(short.travel);
    expect(long.v(2)).toBeCloseTo(long.travel / 2, 12);
  });
  it('groundedPose without the timed stance falls back to the gait\'s own plant weight', () => {
    const R = HEROES.bare; const dof = resolveMotion('walk', { base: rigCore(R) })(0.25);
    const { pose, plant } = groundedPose(R, dof);
    expect(plant.L + plant.R).toBeGreaterThan(0);
    expect(pose.feet.L).toHaveLength(3); expect(pose.sink).toBeGreaterThanOrEqual(0);
  });
  it('the first-person bob is read off the hero\'s own gait: zero-meaned, a real bob, travel in STAND units', () => {
    const R = HEROES.female; const c = locomotionCameraCurve(WALK, R, { samples: 32 });
    expect(c.curve).toHaveLength(32);
    for (const k of ['dx', 'dy', 'dz', 'pitch', 'roll', 'yaw']) expect(Math.abs(c.curve.reduce((s, r) => s + r[k], 0) / 32)).toBeLessThan(1e-5);
    const dz = c.curve.map((r) => r.dz); expect(Math.max(...dz) - Math.min(...dz)).toBeGreaterThan(0.01);
    expect(c.strideDistance).toBeGreaterThan(0);
  });
  // THE DOOR'S GAITS as studied (walk; jog tilted 10°; sprint tilted 18° and driven): every rig bakes them, the feet
  // hold the floor, the head bobs without a jolt, the trunk leans by the tilt and the gaze is held up
  for (const [name, R] of Object.entries(HEROES)) it(`${name}: walk, jog and sprint as studied bake and hold their gates`, () => {
    const plan = motionPlan({ walk: true, jog: true, sprint: true });
    const L = locomotionClips(plan, R);
    expect(L.speeds.walk).toBeLessThan(L.speeds.jog); expect(L.speeds.jog).toBeLessThan(L.speeds.sprint);
    for (const [gait, gMax] of [['walk', 1.2], ['jog', 3.5], ['sprint', 5]]) {
      const M = 240, dt = L.seconds[gait] / M; const nodes = Array.from({ length: M }, (_, i) => rigNodesAt(R, L.clips[gait](i / M)).nodes);
      for (const S of Object.keys(R.legs)) expect(Math.min(...nodes.map((n) => n[R.legs[S].toeBase][2] - R.joints[R.legs[S].toeBase][2]))).toBeGreaterThan(-1e-6);
      const z = nodes.map((n) => n.headBase[2]); const acc = z.map((v, i) => (z[(i + 1) % M] - 2 * v + z[(i - 1 + M) % M]) / (dt * dt));
      expect(Math.max(...acc.map(Math.abs)) / 9.81).toBeLessThan(gMax);
      const lean = nodes.map((n) => Math.atan2(n.neckHub[1] - n.pelvisHub[1], n.neckHub[2] - n.pelvisHub[2]) * 180 / Math.PI);
      const mean = lean.reduce((a, b) => a + b, 0) / M;
      expect(mean).toBeGreaterThan(MOTION_GAITS[gait].tilt - 2);
    }
  });
});
