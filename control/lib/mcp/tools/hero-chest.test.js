// hero-chest.test.js — a dressed hero's CHEST under the outfit laws 2 (outfit/principles.js): a gown's, a robe's or a
// tunic's bodice lies smooth from a short band above the waist to the shoulders (body-garment.js `lie`), so no ring
// stands a roll there; and a MANTLE is a short cape over the shoulders with a round clasp, never a band with a buckle
// across the collarbones (which the realistic tailor made a belt there). One case per body path, chosen in code: the
// game body's landmark head and the anime head (the kernel the tiered registers share), and the realistic plan, whose
// tailor makes a belt of every wrap round the trunk. Each beside its laws 1 twin, the look a stored row keeps.
import { describe, expect, it } from 'vitest';

import { heroRecord, heroPlanOf, expandLayeredManifest } from './layered.js';
import { bodyMap } from '../../graph/polygonizer/outfit-plan.js';
import { compileLayered } from '../../graph/polygonizer/station-loft.js';

const outfit = (laws, pieces) => ({ type: 'outfit', style: 'adventurer', laws, pieces });
const ROBE = [{ kind: 'robe', sleeve: 'long' }, { kind: 'sash' }];
const MANTLE = [{ kind: 'robe', sleeve: 'long' }, { kind: 'mantle' }];
const PATHS = { landmark: { cast: 'female' }, tiered: { cast: 'female', form: 'tiered', register: 'round' }, box: { cast: 'female', form: 'tiered', register: 'box' }, anime: { cast: 'female', head: 'anime' } };
const partsOf = (spec) => expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord(spec) }).recipe.parts;
const mid = (st) => { const P = Object.values(st.points); return [0, 1, 2].map((k) => P.reduce((t, p) => t + p[k], 0) / P.length); };

/** a ROLL's depth: along each slot's line up the piece, read in ONE frame (the straight axis from the first ring's
 * middle at or above `z0` to the last ring's), how far a ring stands in under the line between rings either side of it
 * within `span` rings: [{ id, sl, by }] past `tol`. (Off each ring's own middle, which jumps forward at the bust, a
 * bridged line in space reads as dents, and dents read off it are no rolls: the one frame is the cloth's) */
function rolls(P, z0, tol = 0.002, span = 4, facing = 180) {
  const S = P.stations.filter((st) => mid(st)[2] >= z0), a = mid(S[0]), ax = [0, 1, 2].map((k) => mid(S[S.length - 1])[k] - a[k]), L2 = ax.reduce((t, v) => t + v * v, 0);
  const r = (p) => { const t = [0, 1, 2].reduce((u, k) => u + (p[k] - a[k]) * ax[k], 0) / L2; return Math.hypot(...[0, 1, 2].map((k) => p[k] - a[k] - ax[k] * t)); };
  const out = [];
  // (`facing`: the slots within that many degrees of the front or the back at the first ring; the yoke's sides, where the
  // cut holds the cloth in to the arm's root under the sleeve, are the cut's)
  const c0 = mid(S[0]), seen = (sl) => { const p = S[0].points[sl], az = Math.abs(Math.atan2(p[0] - c0[0], p[1] - c0[1]) * 180 / Math.PI); return Math.min(az, 180 - az) <= facing; };
  for (const sl of P.slots.filter(seen)) { const R = S.map((st) => r(st.points[sl])), x = [0]; for (let i = 1; i < S.length; i++) x.push(x[i - 1] + Math.hypot(...[0, 1, 2].map((k) => S[i].points[sl][k] - S[i - 1].points[sl][k])));
    for (let i = 1; i + 1 < S.length; i++) { let by = 0; for (let j = Math.max(0, i - span); j < i; j++) for (let k = i + 1; k <= Math.min(S.length - 1, i + span); k++) by = Math.max(by, R[j] + (R[k] - R[j]) * (x[i] - x[j]) / (x[k] - x[j]) - R[i]);
      if (by > tol) out.push({ id: S[i].id, sl, by: Math.round(by * 1e4) / 1e4 }); } }
  return out;
}
/** the deepest ROLL the drawn surface shows from the front and the back (within 40° of either): along vertical rays from
 * the body's axis at every 15°, 4 mm apart from `z0` to `z1`, how far the cloth stands in under a chord across 6 cm (m) */
function drawnRoll(recipe, part, z0, z1) {
  const mesh = compileLayered(recipe), V = mesh.vertices, tris = mesh.faces.filter((f) => mesh.provenance[f[0]].part === part).map((f) => f.map((i) => V[i]));
  const reach = (az, z) => { const d = [Math.sin(az), Math.cos(az), 0]; let best = null;
    for (const [a, b, c] of tris) { if (Math.min(a[2], b[2], c[2]) > z || Math.max(a[2], b[2], c[2]) < z) continue;
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], q = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
      const det = e1[0] * q[0] + e1[1] * q[1] + e1[2] * q[2]; if (Math.abs(det) < 1e-12) continue; const s = [-a[0], -a[1], z - a[2]], u = (s[0] * q[0] + s[1] * q[1] + s[2] * q[2]) / det; if (u < 0 || u > 1) continue;
      const r = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (d[0] * r[0] + d[1] * r[1]) / det; if (v < 0 || u + v > 1) continue;
      const t = (e2[0] * r[0] + e2[1] * r[1] + e2[2] * r[2]) / det; if (t > 0 && (best === null || t > best)) best = t; }
    return best; };
  let worst = 0;
  for (const deg of [0, 15, 30, 40, 140, 150, 165, 180, 195, 210, 220, 320, 330, 345]) { const zs = []; for (let z = z0; z <= z1; z += 0.004) zs.push(z); const r = zs.map((z) => reach(deg * Math.PI / 180, z));
    for (let i = 1; i + 1 < r.length; i++) { if (r[i] === null) continue; for (let j = Math.max(0, i - 15); j < i; j++) for (let k = i + 1; k <= Math.min(r.length - 1, i + 15); k++) { if (r[j] === null || r[k] === null) continue; worst = Math.max(worst, r[j] + (r[k] - r[j]) * (i - j) / (k - j) - r[i]); } } }
  return worst;
}

describe('the chest, outfit laws 2', () => {
  for (const [path, body] of Object.entries(PATHS)) {
    it(`${path}: the robe's bodice lies smooth above the band over the sash, and gathers below it as before`, { timeout: 60000 }, () => {
      const plan = heroPlanOf(heroRecord({ ...body, outfit: outfit(2, ROBE) })), B = bodyMap(plan), band = B.waist + 0.07 * B.k;
      const nowP = partsOf({ ...body, outfit: outfit(2, ROBE) }), wasP = partsOf({ ...body, outfit: outfit(1, ROBE) }), now = nowP.robeBodice_torso, was = wasP.robeBodice_torso;
      expect(rolls(was, band, 0.002, 4, 50).length, 'laws 1 stood a roll above the band').toBeGreaterThan(0);
      expect(rolls(now, band, 0.002, 4, 50).map((d) => `${d.id}.${d.sl}:${d.by}`).join(" "), "the chest and the back, one surface").toEqual("");
      // (the rings in the band and below it, where the sash holds the cloth, as they were)
      now.stations.forEach((st, i) => { if (mid(was.stations[i])[2] < band - 0.01) expect(st).toEqual(was.stations[i]); });
      // (and the sleeve down the arm: one surface, never a stack of rings)
      expect(rolls(wasP.robeSleeve_upperArmR, -Infinity).length + rolls(wasP.robeCuff_foreArmR, -Infinity).length, 'laws 1 stacked the sleeve').toBeGreaterThan(0);
      expect([...rolls(nowP.robeSleeve_upperArmR, -Infinity), ...rolls(nowP.robeCuff_foreArmR, -Infinity)]).toEqual([]);
    });
    it(`${path}: the mantle is a cape on the shoulders with a clasp, no buckle above the waist`, { timeout: 60000 }, () => {
      const plan = heroPlanOf(heroRecord({ ...body, outfit: outfit(2, MANTLE) })), B = bodyMap(plan), waistS = B.ringAt(B.torso, B.waist).s;
      expect(plan.adorn.filter((A) => A.signature?.kind === 'buckle' && A.part === 'torso' && A.s?.[1] > waistS + 0.3).map((A) => A.id)).toEqual([]);
      expect(plan.adorn.find((A) => A.id === 'mantleClasp')?.signature.kind).toBe('boss');
      const cape = partsOf({ ...body, outfit: outfit(2, MANTLE) }).mantle_cape, zs = cape.stations.map((st) => mid(st)[2]);
      // from the neck's root down over the shoulders, its hem above the waist and below the armpit's line, wider than the
      // shoulders it lies over
      expect(Math.max(...zs)).toBeGreaterThan(B.shoulder);
      expect(Math.min(...zs)).toBeGreaterThan(B.waist);
      expect(Math.min(...zs)).toBeLessThan(B.shoulder - 0.08 * B.k);
      const xs = cape.stations.flatMap((st) => Object.values(st.points).map((p) => Math.abs(p[0])));
      expect(Math.max(...xs)).toBeGreaterThan(Math.abs(B.J.shoulder[0]));
      // (laws 1, the look a stored row keeps: the band round the upper chest with its buckle)
      const old = heroPlanOf(heroRecord({ ...body, outfit: outfit(1, MANTLE) })).adorn.find((A) => A.id === 'mantle');
      expect(old.signature.kind).toBe('buckle');
    });
  }
  it('as drawn: the bodice above the band shows no roll from the front or the back on the tiered body, the box and the anime hero (laws 1 did)', { timeout: 120000 }, () => {
    for (const [path, body] of Object.entries(PATHS).filter(([p]) => p !== 'landmark')) {
      const plan = heroPlanOf(heroRecord({ ...body, outfit: outfit(2, ROBE) })), B = bodyMap(plan), band = B.waist + 0.07 * B.k;
      const R = (laws) => { const r = expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ ...body, outfit: outfit(laws, ROBE) }) }).recipe, P = r.parts.robeBodice_torso;
        return drawnRoll(r, 'robeBodice_torso', band, Math.min(...P.slots.map((sl) => P.stations.at(-1).points[sl][2])) - 0.03); };
      const now = R(2); expect(now, `${path}: a roll on the drawn bodice (m)`).toBeLessThan(0.003);
      if (path === 'tiered') expect(R(1), 'laws 1 drew rolls').toBeGreaterThan(0.004);
    }
  });
  it('realistic: the mantle wraps nothing round the trunk, so its tailor makes no belt of it', () => {
    const wraps = (laws) => heroPlanOf(heroRecord({ cast: 'female', form: 'realistic', outfit: outfit(laws, MANTLE) })).adorn.filter((A) => /^mantle/.test(A.id) && (A.mode === 'band' || A.t === 'wrap'));
    expect(wraps(2)).toEqual([]);
    expect(wraps(1).map((A) => A.id)).toEqual(['mantle']);
  });
});
