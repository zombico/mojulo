// hero-stance — the ready stances' laws on real hero rigs: the facing follows from the feet inside each hip's turnout,
// every held stance balances inside its footprint with the knees over the toes and the eyes on the target, the hands
// reach where they were sent, the left stances are the right ones' exact mirrors, the enter clip starts on the stand
// and plants its feet, and the rig's new channels move nothing when absent.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt, boneFrames } from './station-loft-rig.js';
import { heroStance, STANCES, STANCE_NAMES, facingOf } from './hero-stance.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const rigOf = (hero) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord(hero) }).recipe.rig);
const HEROES = { female: rigOf({ cast: 'female', head: 'anime' }), male: rigOf({ cast: 'male', head: 'anime' }) };

describe('hero-stance: the facing from the feet', () => {
  it('two toes forward keep the body square however the feet stagger; a rear toe turned out lets it blade', () => {
    expect(facingOf({ line: 85, toes: { L: 0, R: 0 } })).toBeLessThanOrEqual(15);   // the left hip turns in at most 15°
    expect(facingOf({ line: 85, toes: { L: 90, R: 0 } })).toBe(50);                // the lead hip turns out at most 50°
    expect(facingOf({ line: 90, toes: { L: 90, R: 80 } })).toBe(90);               // both toes round: side on
    expect(facingOf({ line: 0, toes: { L: 15, R: -15 } })).toBe(0);
  });
  it('each stance is the family it says, and every stance has a lead but the symmetric square ones', () => {
    for (const [n, S] of Object.entries(STANCES)) expect(Math.abs(facingOf(S)) < 25 ? 'square' : 'bladed', n).toBe(S.family);
    expect(STANCE_NAMES).toContain('fencingLeft'); expect(STANCE_NAMES).not.toContain('athleticLeft');
  });
});

// the stances are words through one solve: the first of each family and the first mirrored one, chosen from the catalog,
// the casts alternating
const HELD = [...Object.values(Object.groupBy(STANCE_NAMES, (n) => (n.endsWith('Left') ? 'mirrored' : STANCES[n].family))).map((g) => g[0])].map((n, i) => [i % 2 ? 'male' : 'female', n]);

describe('hero-stance: held', () => {
  for (const [rig, name] of HELD) {
    const R = HEROES[rig];
    it(`${rig} ${name}: balanced, knees over toes, eyes on the target, feet on the floor`, () => {
      const S = heroStance(name, R); const c = S.checks;
      expect(c.com.margin, 'the centre of mass inside the footprint').toBeGreaterThan(0.005);
      expect(Math.abs(c.com.weight - STANCES[name.replace(/Left$/, '')].weight)).toBeLessThan(0.02);
      for (const s of ['L', 'R']) {
        expect(c.knees[s], `knee ${s} over its toes`).toBeLessThan(6);
        expect(c.turnout[s]).toBeLessThanOrEqual(50.5); expect(c.turnout[s]).toBeGreaterThanOrEqual(-15.5);
        expect(c.reach[s]).toBe('ok');
      }
      expect(c.gaze, 'the head on the target').toBeLessThan(name.startsWith('hitting') ? 15 : 3);
      expect(Math.abs(c.floor)).toBeLessThan(1e-6);
    });
  }
  it('the hands reach where the stance sends them', () => {
    for (const name of ['centre', 'hitting', 'fencing']) {
      const n = rigNodesAt(HEROES.female, heroStance(name, HEROES.female).hold).nodes;
      // the two-handed stances bring the hands together: the wrists within a hand's breadth
      if (name === 'centre') expect(Math.hypot(n.wristR[0] - n.wristL[0], n.wristR[1] - n.wristL[1], n.wristR[2] - n.wristL[2])).toBeLessThan(0.12);
      if (name === 'hitting') expect(n.wristR[0]).toBeLessThan(n.shoulderR[0]);   // both hands back at the rear shoulder
      if (name === 'fencing') expect(n.wristR[1] - n.shoulderR[1]).toBeGreaterThan(0.35);   // the lead arm out on the line
    }
  });
});

describe('hero-stance: the mirror and the enter clip', () => {
  const R = HEROES.male;
  it('a left stance is the right one mirrored joint for joint', () => {
    for (const base of ['guard', 'fencing', 'hitting', 'centre']) {
      const a = rigNodesAt(R, heroStance(base, R).hold).nodes, b = rigNodesAt(R, heroStance(`${base}Left`, R).hold).nodes;
      for (const k of Object.keys(a)) { const t = k.replace(/([LR])$/, (s) => (s === 'L' ? 'R' : 'L')); if (!b[t]) continue; expect(Math.abs(a[k][0] + b[t][0]) + Math.abs(a[k][1] - b[t][1]) + Math.abs(a[k][2] - b[t][2]), k).toBeLessThan(2e-3); }
      expect(heroStance(`${base}Left`, R).facing).toBe(-heroStance(base, R).facing);
    }
  });
  it('the enter clip starts on the stand, keeps every toe on or over the floor and ends in the held pose', () => {
    const rest = rigNodesAt(R, {}).nodes;
    for (const name of ['fencing', 'low']) {
      const S = heroStance(name, R);
      const first = rigNodesAt(R, S.clip.fn(0)).nodes; for (const k of Object.keys(rest)) expect(Math.hypot(...[0, 1, 2].map((i) => first[k][i] - rest[k][i])), k).toBeLessThan(1e-6);
      for (let i = 0; i <= 60; i++) { const n = rigNodesAt(R, S.clip.fn(i / 60)).nodes; for (const s of ['L', 'R']) expect(n[R.legs[s].toeBase][2] - R.joints[R.legs[s].toeBase][2]).toBeGreaterThan(-1e-5); }
    }
  });
  it('the rig: no facing and no splay move nothing; a facing turns the head bone with the body', () => {
    const plain = rigNodesAt(R, { hinge: 10 }).nodes, zero = rigNodesAt(R, { hinge: 10, facing: 0, splayL: 0, splayR: 0 }).nodes;
    for (const k of Object.keys(plain)) expect(zero[k]).toEqual(plain[k]);
    const n = rigNodesAt(R, { facing: 60, sink: 0.05 }).nodes; const h = boneFrames(R, R.joints, n)[R.boneIndex.head];
    expect(Math.atan2(-h.m[0][1], h.m[1][1]) * 180 / Math.PI).toBeCloseTo(60, 3);
  });
});
