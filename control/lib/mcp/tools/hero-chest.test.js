// hero-chest.test.js — a dressed hero's CHEST under the outfit laws 2 (outfit/principles.js): a gown's, a robe's or a
// tunic's bodice lies smooth from a short band above the waist to the shoulders (body-garment.js `lie`), so no ring
// stands a roll there; and a MANTLE is a short cape over the shoulders with a round clasp, never a band with a buckle
// across the collarbones (which the realistic tailor made a belt there). One case per body path, chosen in code: the
// game body's landmark head and the anime head (the kernel the tiered registers share), and the realistic plan, whose
// tailor makes a belt of every wrap round the trunk. Each beside its laws 1 twin, the look a stored row keeps.
import { describe, expect, it } from 'vitest';

import { heroRecord, heroPlanOf, expandLayeredManifest } from './layered.js';
import { bodyMap } from '../../graph/polygonizer/outfit-plan.js';

const outfit = (laws, pieces) => ({ type: 'outfit', style: 'adventurer', laws, pieces });
const ROBE = [{ kind: 'robe', sleeve: 'long' }, { kind: 'sash' }];
const MANTLE = [{ kind: 'robe', sleeve: 'long' }, { kind: 'mantle' }];
const PATHS = { landmark: { cast: 'female' }, anime: { cast: 'female', head: 'anime' } };
const partsOf = (spec) => expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord(spec) }).recipe.parts;
const mid = (st) => { const P = Object.values(st.points); return [0, 1, 2].map((k) => P.reduce((t, p) => t + p[k], 0) / P.length); };

/** the rings above `z0` that stand in under the line between their neighbours by more than `tol` (a roll's valley), by
 * slot: [{ id, sl, by }]. (Read off the cloth's own ring middles, where the kernel reads the body's: a millimetre between
 * the two is no roll; laws 1's were up to a centimetre and a half) */
function dents(P, z0, tol = 0.0015) {
  const S = P.stations.filter((st) => mid(st)[2] >= z0), C = S.map(mid), out = [];
  const L = [0]; for (let i = 1; i < S.length; i++) L.push(L[i - 1] + Math.hypot(...[0, 1, 2].map((k) => C[i][k] - C[i - 1][k])));
  const r = (i, sl) => Math.hypot(S[i].points[sl][0] - C[i][0], S[i].points[sl][1] - C[i][1]);
  for (const sl of P.slots) for (let i = 1; i + 1 < S.length; i++) {
    const line = r(i - 1, sl) + (r(i + 1, sl) - r(i - 1, sl)) * (L[i] - L[i - 1]) / (L[i + 1] - L[i - 1]), by = line - r(i, sl);
    if (by > tol) out.push({ id: S[i].id, sl, by });
  }
  return out;
}

describe('the chest, outfit laws 2', () => {
  for (const [path, body] of Object.entries(PATHS)) {
    it(`${path}: the robe's bodice lies smooth above the band over the sash, and gathers below it as before`, { timeout: 60000 }, () => {
      const plan = heroPlanOf(heroRecord({ ...body, outfit: outfit(2, ROBE) })), B = bodyMap(plan), band = B.waist + 0.07 * B.k;
      const now = partsOf({ ...body, outfit: outfit(2, ROBE) }).robeBodice_torso, was = partsOf({ ...body, outfit: outfit(1, ROBE) }).robeBodice_torso;
      expect(dents(was, band).length, 'laws 1 stood a roll above the band').toBeGreaterThan(0);
      expect(dents(now, band)).toEqual([]);
      // (only ever out, and the rings in the band and below it, where the sash holds the cloth, as they were)
      now.stations.forEach((st, i) => { if (mid(was.stations[i])[2] < band - 0.01) expect(st).toEqual(was.stations[i]); });
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
  it('realistic: the mantle wraps nothing round the trunk, so its tailor makes no belt of it', () => {
    const wraps = (laws) => heroPlanOf(heroRecord({ cast: 'female', form: 'realistic', outfit: outfit(laws, MANTLE) })).adorn.filter((A) => /^mantle/.test(A.id) && (A.mode === 'band' || A.t === 'wrap'));
    expect(wraps(2)).toEqual([]);
    expect(wraps(1).map((A) => A.id)).toEqual(['mantle']);
  });
});
