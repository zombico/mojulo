// The round-out (realistic laws 4, body-relational-builds.js ROUND_OUT): read on each limb's rings as the slice laid them
// (each station's girth, its section square to the run), the joints are filled between their bellies and the bellies
// kept: no pinch over the knee, the wrist a person's share of the forearm, the forearm tapering rather than stepping,
// the calf still peaking behind. Laws 3 as it was. One body (the man's: his knee pinched the deeper). (Beside the
// module, not in the critical tier: two realistic mints.)
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest, REALISTIC_LAWS_VERSION } from '../../mcp/tools/layered.js';

const sub = (a, b) => a.map((v, i) => v - b[i]), len = (a) => Math.hypot(...a);
/** each limb's rings along its run: [run (m), girth (m)] (the girth the ring polygon's perimeter) */
function limbs(spec) {
  const P = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) }).recipe.parts, out = {};
  for (const n of ['foreArmR', 'thighR', 'shankR']) {
    const part = P[n], rings = part.stations.map((st) => part.slots.map((s) => st.points[s]));
    const C = rings.map((r) => [0, 1, 2].map((a) => r.reduce((t, p) => t + p[a], 0) / r.length));
    let run = 0;
    out[n] = rings.map((r, i) => { if (i) run += len(sub(C[i], C[i - 1])); return [run, r.reduce((t, p, k) => t + len(sub(r[(k + 1) % r.length], p)), 0)]; });
  }
  return out;
}
/** the deepest pinch: a ring under both the largest ring before it and the largest after it, by how much */
const pinch = (rows, from = 0, to = Infinity) => Math.max(0, ...rows.map(([s, g], i) => (s < from || s > to || !i || i === rows.length - 1 ? 0 : Math.min(...[Math.max(...rows.slice(0, i).map((r) => r[1])), Math.max(...rows.slice(i + 1).map((r) => r[1]))]) - g)));
const steepest = (rows) => Math.max(...rows.slice(1).map(([s, g], i) => Math.abs(g - rows[i][1]) / Math.max(1e-3, s - rows[i][0])));

describe('the round-out', () => {
  it('under laws 4 the knee and the wrist are filled between their bellies, the forearm tapers, the calf still peaks; laws 3 as it was', { timeout: 300_000 }, () => {
    expect(REALISTIC_LAWS_VERSION).toBeGreaterThanOrEqual(4);
    const now = limbs({ cast: 'male', form: 'realistic' }), before = limbs({ cast: 'male', form: 'realistic', physique: { from: 'athletic', laws: 3 } });
    const T = now.thighR, Tb = before.thighR, L = T.at(-1)[0];
    // (over the knee: the thigh's lower third)
    expect(pinch(Tb, (2 * L) / 3)).toBeGreaterThan(0.04); expect(pinch(T, (2 * L) / 3)).toBeLessThan(0.025);
    // (the wrist: the forearm's last tenth against its belly; people about 0.6)
    const wrist = (rows) => Math.min(...rows.filter(([s]) => s > 0.75 * rows.at(-1)[0]).map(([, g]) => g)) / Math.max(...rows.map(([, g]) => g));
    expect(wrist(before.foreArmR)).toBeLessThan(0.52); expect(wrist(now.foreArmR)).toBeGreaterThan(0.58); expect(wrist(now.foreArmR)).toBeLessThan(0.7);
    expect(steepest(now.foreArmR)).toBeLessThan(steepest(before.foreArmR) - 0.5);
    // (not a cylinder: the calf's girth still runs a third over the ankle's, its peak in the shank's upper half)
    const S = now.shankR, gMax = Math.max(...S.map(([, g]) => g)), gMin = Math.min(...S.map(([, g]) => g)), peak = S.find(([, g]) => g === gMax)[0];
    expect(gMax / gMin).toBeGreaterThan(1.6); expect(peak).toBeLessThan(S.at(-1)[0] / 2);
  });
});
