// hero-grip — the sword-holding laws on real hero rigs: each guard's hands close on their stations of the grip with the
// frames the sword wants, the wrists stay in their range (a skilled guard's in its functional range), the point holds its
// aim, the edge its facing, the blade clears the body, the body stands over its feet with the sword's weight, a skilled
// guard carries the sword close; a Left guard is its right-handed twin mirrored; the wrist channel the solver writes is
// the one the rig turns the hand by.
import { describe, expect, it } from 'vitest';
import { validateRig, rigNodesAt, boneFrames } from './station-loft-rig.js';
import { heroGuard, GUARDS, GUARD_NAMES, GRIPS, LEVER, wristFor, anatomicalForearm, humeralTurn } from './hero-grip.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const rigOf = (hero) => validateRig(expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord(hero) }).recipe.rig);
const HEROES = { female: rigOf({ cast: 'female', head: 'anime' }), male: rigOf({ cast: 'male', head: 'anime' }) };
// one guard per distinct hold (hero-grip.js heroGuard: the regime, one hand or two, an off-hand blade or a shield, the
// grip), chosen from the catalog, the casts alternating
const HOLDS = Object.values(Object.groupBy(Object.keys(GUARDS), (n) => { const K = GUARDS[n]; return `${K.regime} ${K.hands} ${K.off ? 'off' : ''}${K.shield ? 'shield' : ''} ${K.grip ?? 'handshake'}`; }))
  .map((g, i) => [i % 2 ? 'male' : 'female', g[0]]);
const turnOf = (a, b) => { const t = [0, 1, 2].reduce((s, i) => s + a[0][i] * b[0][i] + a[1][i] * b[1][i] + a[2][i] * b[2][i], 0); return (Math.acos(Math.max(-1, Math.min(1, (t - 1) / 2))) * 180) / Math.PI; };

describe('hero-grip', () => {
  for (const [rig, name] of HOLDS) {
    const R = HEROES[rig];
    it(`${rig} ${name}: the hands on the hilt, the wrists in range, the point, the edge, clear, balanced`, () => {
      const g = heroGuard(name, R), c = g.checks;
      expect(c.laws, JSON.stringify(c)).toEqual(Object.fromEntries(Object.keys(c.laws).map((k) => [k, true])));
      for (const h of Object.values(c.hands)) { expect(h.hilt.at).toBeLessThan(0.006); expect(h.inRange).toBe(true); expect(Math.abs(h.humerus), 'the elbow never folds backward').toBeLessThanOrEqual(90.5); }
    }, 30000);
  }
  it('a Left guard is its twin mirrored: the held pose and the measures', () => {
    const R = HEROES.male;
    for (const base of ['chudan', 'niten', 'shield']) {
      const a = heroGuard(base, R), b = heroGuard(`${base}Left`, R);
      const p = rigNodesAt(R, a.hold).nodes, q = rigNodesAt(R, b.hold).nodes;
      for (const k of Object.keys(p)) { const m = k.replace(/([LR])$/, (s) => (s === 'L' ? 'R' : 'L')); if (!q[m]) continue; expect(Math.abs(p[k][0] + q[m][0]) + Math.abs(p[k][1] - q[m][1]) + Math.abs(p[k][2] - q[m][2]), `${base} ${k}`).toBeLessThan(2e-3); }
      for (const key of ['point', 'edge', 'lever']) expect(b.checks[key], `${base} ${key}`).toBeCloseTo(a.checks[key], 1);
    }
  }, 60000);
  it('the wrist channel it writes is the one the rig turns the hand by (flex, then deviation, then twist)', () => {
    const R = HEROES.female, fa = { bones: [R.bones[R.boneIndex.foreArmR]] };
    for (const w of [{ flex: 30, deviation: -20, twist: 40 }, { flex: -50, deviation: 10, twist: -70 }]) {
      const n = rigNodesAt(R, { shR: { pitch: 60, yaw: 10, roll: 20 }, elbowR: 70, wristR: w }).nodes;
      const F = boneFrames(fa, R.joints, n)[0].m, m = boneFrames(R, R.joints, n)[R.boneIndex.handR].m;
      const got = wristFor(R, 'R', F, m);
      for (const k of ['flex', 'deviation', 'twist']) expect(got[k], k).toBeCloseTo(w[k], 1);
    }
  });
  it('the anatomical forearm is the rest at rest, and the elbow carries its roll (the thumb up over a forearm raised forward)', () => {
    const R = HEROES.female, I = anatomicalForearm(R, R.joints, 'R');
    expect(turnOf(I, [[1, 0, 0], [0, 1, 0], [0, 0, 1]])).toBeLessThan(1e-6);
    const n = rigNodesAt(R, { shR: { pitch: 10, yaw: 0, roll: 0 }, elbowR: 90 }).nodes; const N = anatomicalForearm(R, n, 'R');
    const thumb = [N[0][1], N[1][1], N[2][1]];   // the rest's forward (the thumb) carried
    expect(thumb[2]).toBeGreaterThan(0.8);
  });
  it('the humerus reads its turn: 0 for a hanging arm bent forward, the shoulder roll each way, mirrored', () => {
    const R = HEROES.female; const at = (p) => rigNodesAt(R, p).nodes;
    expect(humeralTurn(at({ elbowR: 90 }), 'R')).toBeCloseTo(0, 3);
    expect(humeralTurn(at({ elbowR: 90, shR: { pitch: 0, yaw: 0, roll: 60 } }), 'R')).toBeCloseTo(60, 0);
    expect(humeralTurn(at({ elbowL: 90, shL: { pitch: 0, yaw: 0, roll: -60 } }), 'L')).toBeCloseTo(60, 0);
  });
  it('the regimes: the weightless challenge holds the blade out past the skilled lever; a skilled guard never does', () => {
    const R = HEROES.female;
    expect(heroGuard('challenge', R).checks.lever).toBeGreaterThan(LEVER);
    expect(heroGuard('terza', R).checks.lever).toBeLessThan(LEVER);
  }, 30000);
  it('plays out of the stand into the stance and the guard: the last frame is the held guard', () => {
    const R = HEROES.female, g = heroGuard('chudan', R);
    const a = rigNodesAt(R, g.clip.fn(1)).nodes, b = rigNodesAt(R, g.hold).nodes;
    for (const k of Object.keys(b)) expect(Math.hypot(...[0, 1, 2].map((i) => a[k][i] - b[k][i])), k).toBeLessThan(1e-9);
    expect(g.mounts).toHaveLength(1); expect(g.mounts[0].bone).toBe('handR');
  }, 30000);
  it('names every guard and its mirror and every grip; refuses an unknown guard', () => {
    expect(GUARD_NAMES).toHaveLength(2 * Object.keys(GUARDS).length);
    expect(Object.keys(GRIPS)).toEqual(['hammer', 'handshake', 'reverse', 'reverseHammer']);
    expect(() => heroGuard('ochsLeftish', HEROES.male)).toThrow(/no guard/);
  });
});
