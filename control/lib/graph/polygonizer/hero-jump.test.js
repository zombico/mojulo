// hero-jump — the jumps' laws on real hero rigs: every jump bakes (the rig refuses an unreachable toe), the feet never
// pass the floor and hold their rest spot while planted, nothing pops between frames, the clip starts and ends on the
// stand, and the air timing is a flight (a double jump's kick inside it, its second apex above the kick).
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt, boneFrames } from './station-loft-rig.js';
import { heroJump, JUMPS, JUMP_NAMES, fleshOf } from './hero-jump.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const rigOf = (hero) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord(hero) }).recipe.rig);
const HEROES = { female: rigOf({ cast: 'female', head: 'anime' }), male: rigOf({ cast: 'male', head: 'anime' }), bare: rigOf({ cast: 'male' }) };
const N = 120;

describe('hero-jump', () => {
  for (const [rig, R] of Object.entries(HEROES)) for (const name of JUMP_NAMES) {
    it(`${rig} ${name}: bakes, holds the floor, never pops, starts and ends on the stand`, () => {
      const J = heroJump(name, R);
      const nodes = Array.from({ length: N + 1 }, (_, i) => rigNodesAt(R, J.fn(i / N)).nodes);
      const run = !!JUMPS[name].run;   // a running jump's planted feet slide with the run, and it starts and ends in stride
      const ground = (t) => { if (run) return false; const k = JUMPS[name].keys; let i = 0; while (i < k.length - 1 && k[i + 1].t <= t) i++; return k[i].ground === 1 && (k[i + 1] ?? k[i]).ground === 1; };
      for (const S of Object.keys(R.legs)) {
        const L = R.legs[S]; const floor = R.joints[L.toeBase][2];
        nodes.forEach((n, i) => {
          expect(n[L.toeBase][2] - floor).toBeGreaterThan(JUMPS[name].roll ? -1e-4 : -1e-5);   // a roll's lift is sampled (400 a clip) and read between
          if (ground(i / N)) for (const a of [0, 2]) expect(Math.abs(n[L.toeBase][a] - R.joints[L.toeBase][a])).toBeLessThan(1e-6);   // on the floor, in line (fore-aft is the `foot` slide)
        });
      }
      // speeds a body reaches (the hands throw fast; the head, the pelvis and the feet do not), and no POP: no frame
      // breaks from its neighbours (the second difference stays small)
      const dt = J.seconds / N;
      for (const [k, vMax] of [['wristL', 17], ['wristR', 17],   // (the shoulder girdle rising with a fast arm swing adds to the hand's speed)
         ['headTop', JUMPS[name].roll ? 11 : 7], ['pelvisHub', JUMPS[name].roll ? 8 : 4],   // a roll swings the head and the hips round its pivot
        ['toeBaseL', run ? 18 : JUMPS[name].roll ? 16 : 7], ['toeBaseR', run ? 18 : JUMPS[name].roll ? 16 : 7]]) {   // a sprinter's swing foot passes the body faster than the run (the sprint's own peaks ~17.7 m/s)
        for (let i = 0; i < N; i++) { const a = nodes[i][k], b = nodes[i + 1][k]; expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / dt).toBeLessThan(vMax); }
        // a roll turns the whole body fast: its bound is wider (a pop would not shrink with a finer step; this does)
        for (let i = 1; i < N; i++) expect(Math.hypot(...[0, 1, 2].map((c) => nodes[i + 1][k][c] - 2 * nodes[i][k][c] + nodes[i - 1][k][c]))).toBeLessThan(JUMPS[name].roll ? 0.12 : 0.075);
      }
      if (!run) for (const k of ['headTop', 'wristL', 'ankleR']) for (let a = 0; a < 3; a++) { expect(nodes[0][k][a]).toBeCloseTo(R.joints[k][a], 6); expect(nodes[N][k][a]).toBeCloseTo(R.joints[k][a], 6); }
      if (JUMPS[name].roll) {   // a roll: a full turn along the floor, the head never the part that meets it
        expect(J.air).toBeNull(); expect(J.roll.end).toBeGreaterThan(J.roll.start); expect(J.roll.speed).toBeGreaterThan(1.5); expect(J.roll.speed).toBeLessThan(8);   // a game dodge roll: a full turn in ~0.7 s on a ~0.55 m rolling radius
        const flesh = (k) => fleshOf(k, R);
        for (const n of nodes) { let lo = null, lv = Infinity; for (const [k, p] of Object.entries(n)) { const v = p[2] - flesh(k); if (v < lv - 1e-9) { lv = v; lo = k; } } expect(lo).not.toMatch(/^head/); }
        return;
      }
      expect(J.air.takeoff).toBeGreaterThan(0); expect(J.air.land).toBeGreaterThan(J.air.takeoff); expect(J.air.land).toBeLessThan(J.seconds);
      expect(J.air.height).toBeGreaterThan(0.1); expect(J.air.height).toBeLessThan(0.8);
      if (run) { expect(J.air.speed).toBe(5); for (const S of ['L', 'R']) expect(nodes.some((n) => n[R.legs[S].toeBase][2] - R.joints[R.legs[S].toeBase][2] < 1e-6)).toBe(true); }
      if (name === 'doubleJump') { expect(J.air.kick).toBeGreaterThan(J.air.takeoff); expect(J.air.kick).toBeLessThan(J.air.land); expect(J.air.kickSpeed).toBeGreaterThan(0); expect(J.air.apexHeight).toBeGreaterThan(J.air.kickHeight); }
      else expect(J.air.kick).toBeUndefined();
    });
  }
  it('is deterministic, and a longer clip stretches the air', () => {
    const R = HEROES.female; const a = heroJump('jump', R), b = heroJump('jump', R);
    for (const t of [0, 0.3, 0.55, 1]) expect(JSON.stringify(a.fn(t))).toBe(JSON.stringify(b.fn(t)));
    expect(heroJump('jump', R, { seconds: 1.4 }).air.height).toBeGreaterThan(a.air.height);
    expect(() => heroJump('backflip', R)).toThrow(/no jump 'backflip'/);
  });
  it('the running jump: the trail leg comes round at the side (knee out, shin behind) at the apex; planted feet slide at the run', () => {
    const R = HEROES.male; const J = heroJump('runningJump', R, { speed: 5 }); const n = rigNodesAt(R, J.fn(0.48)).nodes;
    expect(n.kneeL[0] - n.hipL[0]).toBeLessThan(-0.15);       // the trail (left) knee well out to the side
    expect(n.ankleL[1]).toBeLessThan(n.kneeL[1]);             // its shin trailing behind the knee
    expect(n.ankleR[1]).toBeGreaterThan(n.hipR[1] + 0.3);     // the lead foot out in front
    // NO SKATE: wherever a toe is on the floor it moves back at exactly the run's speed (a touch-down clamped to the
    // floor while still blending from the swing slid at twice it)
    const M = 400, dtM = J.seconds / M;
    for (const S of ['L', 'R']) { const f = R.joints[R.legs[S].toeBase][2]; const toe = Array.from({ length: M + 1 }, (_, i) => rigNodesAt(R, J.fn(i / M)).nodes[R.legs[S].toeBase]);
      for (let i = 0; i < M; i++) if (toe[i][2] - f < 0.003 && toe[i + 1][2] - f < 0.003) expect((toe[i + 1][1] - toe[i][1]) / dtM).toBeCloseTo(-5, 0); }
    // the take-off foot, planted, moves back at the run's speed
    const dt = 0.01, a = rigNodesAt(R, J.fn(0.05)).nodes.toeBaseL[1], b = rigNodesAt(R, J.fn(0.05 + dt)).nodes.toeBaseL[1];
    expect((a - b) / (dt * J.seconds)).toBeCloseTo(5, 1);
  });
  it('the left rolls are the right ones mirrored: every joint reflected across the midline, its twin\'s name swapped', () => {
    const R = HEROES.male; const twin = (k) => k.replace(/([LR])$/, (c) => (c === 'L' ? 'R' : 'L'));
    for (const [right, left] of [['rollForward', 'rollForwardLeft'], ['rollSide', 'rollSideLeft']]) {
      const A = heroJump(right, R), B = heroJump(left, R);
      expect(B.roll.travel).toBeCloseTo(A.roll.travel, 3); expect([A.roll.side, B.roll.side]).toEqual(['right', 'left']);
      for (const t of [0.2, 0.3, 0.45, 0.6, 0.75]) {
        const a = rigNodesAt(R, A.fn(t)).nodes, b = rigNodesAt(R, B.fn(t)).nodes;
        for (const k of Object.keys(a)) { const m = b[twin(k)] ?? b[k]; expect(m[0]).toBeCloseTo(-a[k][0], 3); expect(m[1]).toBeCloseTo(a[k][1], 3); expect(m[2]).toBeCloseTo(a[k][2], 3); }
      }
    }
  });
  it('a whole-body turn turns every bone exactly with it (the head never spun by a shortest arc); a zero turn is no turn', () => {
    const R = HEROES.female; const hi = R.bones.findIndex((b) => b.id === 'head'), pi = R.bones.findIndex((b) => b.id === 'pelvis');
    const diff = (A, B) => Math.max(...A.flatMap((row, r) => row.map((v, c) => Math.abs(v - B[r][c]))));
    for (const body of [{ roll: 90 }, { roll: 180 }, { pitch: 180 }, { roll: -40, pitch: 120 }]) {
      const F = boneFrames(R, R.joints, rigNodesAt(R, { support: 'none', body: { ...body, at: R.joints.navel } }).nodes);
      expect(diff(F[hi].m, F[pi].m)).toBeLessThan(1e-9);
    }
    const pose = { support: 'none', kneeL: 40, shL: { pitch: 50 }, head: { yaw: 10 } };
    const A = boneFrames(R, R.joints, rigNodesAt(R, { ...pose, body: { at: R.joints.navel, up: 0.1 } }).nodes), B = boneFrames(R, R.joints, rigNodesAt(R, pose).nodes);
    A.forEach((f, i) => expect(diff(f.m, B[i].m)).toBeLessThan(1e-9));
  });
});
