// The kit as pieces on the GAME BODY (authored-kit.js): the realistic body's construction (body-relational-kit.js) worn on
// the authored hero, one hero per concept. A belt is one section over what is worn under it, its buckle a frame, the
// kernel's band left off; cloth worn over a belt clears it; a pouch hangs on its belt and rides it rigidly, a thigh rig's
// pouch rides the thigh; every piece takes the weights of the cloth's ring under it; the same hero, the same pieces.
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { BELT_ROUND } from './authored-kit.js';
import { compileLayered } from './station-loft.js';

const recipeOf = (outfit) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', outfit }) }).recipe;
const pointsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
/** the farthest `pts` reach from `c` in each of `n` level directions (0 the front, +y; then toward +x) */
const reach = (pts, c, n = BELT_ROUND) => { const R = new Array(n).fill(0); for (const p of pts) { const a = Math.atan2(p[0] - c[0], p[1] - c[1]), j = ((Math.round((a / (2 * Math.PI)) * n) % n) + n) % n; R[j] = Math.max(R[j], Math.hypot(p[0] - c[0], p[1] - c[1])); } return R; };

describe('the kit on the game body', () => {
  const tactical = recipeOf({ type: 'outfit', style: 'tactical', pieces: [{ kind: 'pouches' }, { kind: 'thighPouch' }] });

  it('a belt is one section over what is worn under it, its buckle a frame, the kernel\'s band left off', () => {
    const P = tactical.parts, B = P.belt_pelvis;
    expect(B.slots.length).toBe(BELT_ROUND);
    expect(Object.keys(P).some((k) => k.startsWith('adorn.belt'))).toBe(false);
    for (const k of ['Top', 'Bottom', 'Right', 'Left', 'Tongue', 'Tail', 'Keeper']) expect(P[`beltBuckle${k}_pelvis`], k).toBeTruthy();
    // (one section top to bottom: the rings between its rounded edges all the same shape)
    const flat = B.stations.slice(2, -2), c = mean(pointsOf(B));
    for (const st of flat) for (const sl of B.slots) expect(Math.hypot(st.points[sl][0] - c[0], st.points[sl][1] - c[1])).toBeCloseTo(Math.hypot(flat[0].points[sl][0] - c[0], flat[0].points[sl][1] - c[1]), 6);
    // (its inner face clears the trousers it is cinched over across its whole width)
    const zs = pointsOf(B).map((p) => p[2]), lo = Math.min(...zs), hi = Math.max(...zs);
    const inner = reach(pointsOf({ stations: [B.stations[0]] }), c), under = reach(pointsOf(P.bottomSeat_pelvis).filter((p) => p[2] > lo && p[2] < hi), c);
    under.forEach((r, j) => { if (r) expect(inner[j]).toBeGreaterThan(r - 0.004); });
  });

  it('cloth worn over a belt is carried out over it', () => {
    // (fatigues: the shirt worn out over the trousers and their belt)
    const P = recipeOf({ type: 'outfit', style: 'fatigues' }).parts, B = P.belt_pelvis, c = mean(pointsOf(B));
    const zs = pointsOf(B).map((p) => p[2]), lo = Math.min(...zs), hi = Math.max(...zs);
    const belt = reach(pointsOf(B), c), tail = pointsOf(P.topTail_pelvis).filter((p) => p[2] > lo && p[2] < hi);
    expect(tail.length).toBeGreaterThan(0);
    const over = reach(tail, c);
    over.forEach((r, j) => { if (r) expect(r).toBeGreaterThan(belt[j] - 0.004); });
  });

  it('a pouch hangs on its belt and rides it rigidly; a thigh rig\'s pouch rides the thigh', () => {
    const P = tactical.parts, belt = P.pouchesBelt_pelvis, top = Math.max(...pointsOf(belt).map((p) => p[2]));
    const body = P.pouchesRBody_kit, w = Object.values(body.bind.blend);
    expect(w.every((x) => JSON.stringify(x) === JSON.stringify(w[0]))).toBe(true);
    expect(Math.max(...pointsOf(body).map((p) => p[2]))).toBeGreaterThan(top - 0.02);
    expect(Math.max(...pointsOf(body).map((p) => p[2]))).toBeLessThan(top + 0.02);
    // (the thigh's pouch below the hip pouch, its weights the thigh's)
    const thigh = P.thighPouchRBody_kit;
    expect(Math.max(...pointsOf(thigh).map((p) => p[2]))).toBeLessThan(Math.min(...pointsOf(body).map((p) => p[2])));
    expect(Object.keys(Object.values(thigh.bind.blend)[0]).some((b) => /thighR|hipFoldR/.test(b))).toBe(true);
    expect(P.thighPouchStrapR_kit).toBeTruthy();
  });

  it('each piece takes the weights of the cloth ring under it (the game body weighs by ring)', () => {
    // (the trousers' waist ring is shared by the pelvis and the lumbar: the belt there is too, never the pelvis alone)
    const W = Object.values(tactical.parts.belt_pelvis.bind.blend);
    expect(W.some((w) => (w.lumbar ?? 0) > 0)).toBe(true);
  });

  it('trousers have no ease at the waist (outfit law 2): the band on the skin, the ease back by the hips', () => {
    // (fatigues: the trousers worn first, nothing under their waistband)
    const P = recipeOf({ type: 'outfit', style: 'fatigues' }).parts, S = P.bottomSeat_pelvis, B = P.pelvis;
    const ring = (Q, z) => Q.stations.reduce((a, st) => (Math.abs(mean(Object.values(st.points))[2] - z) < Math.abs(mean(Object.values(a.points))[2] - z) ? st : a));
    const off = (st) => { const c = mean(Object.values(st.points)), b = ring(B, c[2]), cb = mean(Object.values(b.points)), r = (x, o) => Object.values(x.points).reduce((t, p) => t + Math.hypot(p[0] - o[0], p[1] - o[1]), 0) / Object.keys(x.points).length; return r(st, c) - r(b, cb); };
    const top = S.stations.reduce((a, st) => (mean(Object.values(st.points))[2] > mean(Object.values(a.points))[2] ? st : a));
    expect(off(top)).toBeLessThan(0.005);
    expect(Math.max(...S.stations.map(off))).toBeGreaterThan(off(top) + 0.008);
  });

  it('the pieces follow the live dials: at the extremes of each dial that widens the trunk the belt clears it as at rest', () => {
    // (the ranger: a belt on the torso's hem, which `bulk` widens; `lean` swings the trunk above it, which no belt follows)
    const R = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', register: 'round', detail: 'clothed', adorn: 'ranger' }) }).recipe;
    const belt = Object.keys(R.parts).find((k) => /^belt_/.test(k));
    expect(Object.values(R.dials).some((d) => d.parts?.includes(belt))).toBe(true);
    // (the least the belt's inner face stands over the trunk's skin, ray by ray, within 2 cm of its height: the rings are sparse)
    const margin = (dials) => {
      const M = compileLayered(R, dials).parts, B = Object.values(M[belt].points), S = ['torso', 'pelvis'].flatMap((k) => Object.values(M[k].points)), c = mean(B), zs = B.map((p) => p[2]);
      const skin = reach(S.filter((p) => p[2] > Math.min(...zs) - 0.02 && p[2] < Math.max(...zs) + 0.02), c), inner = reach(B, c);
      return Math.min(...skin.map((r, j) => (r ? inner[j] - r : Infinity)));
    };
    const rest = margin({});
    for (const [k, d] of Object.entries(R.dials)) if (d.op === 'scale' && ['torso', 'pelvis', belt].some((p) => d.parts?.includes(p)) && Number.isFinite(d.max)) expect(margin({ [k]: d.max }), k).toBeGreaterThan(rest - 0.004);
  });

  it('the same hero, the same pieces', () => {
    const again = recipeOf({ type: 'outfit', style: 'tactical', pieces: [{ kind: 'pouches' }, { kind: 'thighPouch' }] });
    const kit = (R) => JSON.stringify(Object.entries(R.parts).filter(([k]) => /_kit$|Belt|belt/.test(k)));
    expect(kit(again)).toBe(kit(tactical));
  });
});
