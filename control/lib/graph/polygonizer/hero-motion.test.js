// hero-motion — the locomotion bake's laws on real hero rigs: the rig without `feet` / `sink` is the rig as it was, the
// stance toe is on the floor and slides back at ONE speed (so at v a planted foot stays put), the swing toe clears the
// floor, every phase solves on a rig that refuses an unreachable toe, and the bake is deterministic.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt } from './station-loft-rig.js';
import { heroLocomotion, groundedPose, rigCore, locomotionCameraCurve, motionPlan, locomotionClips, MOTION_GAITS, heroStop } from './hero-motion.js';
import { mirrored } from './hero-jump.js';
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
  // each rig once, the gaits alternating
  for (const [i, [name, R]] of Object.entries(HEROES).entries()) {
    const [gait, spec] = [['walk', WALK], ['jog', JOG]][i % 2];
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

// THE STOP: letting go of forward. It starts on the gait's own frame (an engine cuts to it without a pop), the feet
// never slide or pass the floor (the game has stopped the body; nothing may skate), the momentum shows as the trunk
// pitching past the feet, and it ends exactly on the stand (it hands over to the idle).
describe('hero-motion: the stop', () => {
  const R = HEROES.female; const plan = motionPlan({ walk: true, jog: true, sprint: true });
  // each gait once, the leads alternating (the leads are mirrors: below)
  for (const [gait, lead] of [['walk', 'R'], ['jog', 'L'], ['sprint', 'R']]) it(`${gait} (${lead} brakes): from the gait's frame, feet held, the lurch, onto the stand`, () => {
    const S = heroStop(plan[gait], R, { from: gait, lead }); const loco = heroLocomotion(plan[gait].spec, R, { tilt: plan[gait].tilt });
    const a = rigNodesAt(R, loco.fn(S.stop.phase)).nodes, b = rigNodesAt(R, S.fn(0)).nodes;
    for (const k of Object.keys(a)) expect(Math.hypot(...[0, 1, 2].map((c) => a[k][c] - b[k][c]))).toBeLessThan(gait === 'walk' ? 0.025 : 0.002);   // the walk's swing clearance lifts its toe a little over the leg's own
    const N = 120, n = Array.from({ length: N + 1 }, (_, i) => rigNodesAt(R, S.fn(i / N)).nodes); const trail = lead === 'R' ? 'L' : 'R';
    for (const s of ['L', 'R']) {
      const L = R.legs[s]; const z = n.map((m) => m[L.toeBase][2] - R.joints[L.toeBase][2]);
      expect(Math.min(...z)).toBeGreaterThan(-1e-6);
      // a toe on the floor in two frames running stays where it is
      for (let i = 0; i < N; i++) if (z[i] < 1e-6 && z[i + 1] < 1e-6) expect(Math.abs(n[i + 1][L.toeBase][1] - n[i][L.toeBase][1])).toBeLessThan(1e-6);
    }
    expect(Math.max(...n.map((m) => m[R.legs[trail].toeBase][2] - R.joints[R.legs[trail].toeBase][2]))).toBeGreaterThan(0.02);   // the catch step lifts
    const lean = n.map((m) => Math.atan2(m.neckHub[1] - m.pelvisHub[1], m.neckHub[2] - m.pelvisHub[2]) * 180 / Math.PI);
    expect(Math.max(...lean)).toBeGreaterThan(plan[gait].tilt + 4);   // past the gait's own lean: the momentum
    const stand = rigNodesAt(R, {}).nodes;   // the rig's own stand (the idle's first frame), its knees by the leg solve
    for (const k of Object.keys(n[N])) for (let c = 0; c < 3; c++) expect(n[N][k][c]).toBeCloseTo(stand[k][c], 6);
    const dt = S.seconds / N;
    for (const k of ['headTop', 'pelvisHub']) for (let i = 0; i < N; i++) expect(Math.hypot(...[0, 1, 2].map((c) => n[i + 1][k][c] - n[i][k][c])) / dt).toBeLessThan(4);
  });
  it('the harder the gait, the bigger the lurch; the two leads are mirrors', () => {
    const peak = (g) => { const S = heroStop(plan[g], R, { from: g }); return Math.max(...Array.from({ length: 61 }, (_, i) => { const m = rigNodesAt(R, S.fn(i / 60)).nodes; return Math.atan2(m.neckHub[1] - m.pelvisHub[1], m.neckHub[2] - m.pelvisHub[2]); })); };
    expect(peak('walk')).toBeLessThan(peak('jog')); expect(peak('jog')).toBeLessThan(peak('sprint'));
    const A = heroStop(plan.jog, R, { from: 'jog', lead: 'R' }), B = heroStop(plan.jog, R, { from: 'jog', lead: 'L' });
    const twin = (k) => k.replace(/([LR])$/, (c) => (c === 'L' ? 'R' : 'L'));
    for (const t of [0.3, 0.5, 0.8]) { const a = rigNodesAt(R, A.fn(t)).nodes, b = rigNodesAt(R, B.fn(t)).nodes; for (const k of ['headTop', 'wristL', 'kneeR', 'toeBaseL']) { expect(b[twin(k)][0]).toBeCloseTo(-a[k][0], 2); expect(b[twin(k)][2]).toBeCloseTo(a[k][2], 2); } }
    expect(mirrored({ hipL: { yaw: 3 }, groundR: 1 })).toEqual({ hipR: { yaw: -3 }, groundL: 1 });
  });
});
