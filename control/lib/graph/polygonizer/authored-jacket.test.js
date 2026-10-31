// The jacket as built on the GAME BODY (authored-jacket.js): the realistic body's construction (body-relational-jacket.js)
// worn on the authored hero, one hero per concept. Closed on a zip, its trunk pieces are opened at the centre front, their
// two edges a zip's width apart, the zip between them and its pieces on its own front; worn open, the gap widens up the
// chest and there is no zip; its trims are carried across the opening; its pieces follow the dials; the same hero, the
// same jacket.
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { JACKET } from './body-relational-jacket.js';
import { ARC } from './authored-jacket.js';

/** the seeded A-2 flight jacket: zip, rib bands, flap pockets, epaulettes, a shirt collar */
const FLIGHT = { type: 'outfit', style: 'flight' };
const recipeOf = (outfit) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', outfit }) }).recipe;
const pointsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
/** a station's two front edges (openFront's `fronts`, the outer face's first slot each side) */
const edges = (P, st) => P.fronts.map((sl) => st.points[sl]);

describe('the jacket on the game body', () => {
  const zipped = recipeOf(FLIGHT);

  it('closed on a zip: its trunk pieces opened at the centre front, the edges a zip apart, the zip between them', () => {
    for (const k of ['outer_torso', 'outerTail_pelvis']) {
      const P = zipped.parts[k];
      expect(P.slots.length, k).toBe(4 * ARC - 2);
      for (const st of P.stations.slice(1, -1)) {
        const [R, L] = edges(P, st);
        expect(R[1], `${k} ${st.id}`).toBeGreaterThan(mean(Object.values(st.points))[1]);   // (on the front)
        expect(R[0] - L[0]).toBeCloseTo(JACKET.zipGap, 2);
      }
    }
    const teeth = pointsOf(zipped.parts.outerZipTeeth);
    expect(Math.max(...teeth.map((p) => Math.abs(p[0])))).toBeLessThan(JACKET.zipGap);
    expect(Math.min(...teeth.map((p) => p[1]))).toBeGreaterThan(0);
  });

  it('its pieces on its own front, each inside its own front: the pockets, the flaps, the collar\'s points; rib bands at the hem and the cuffs', () => {
    for (const [S, sx] of [['R', 1], ['L', -1]]) {
      for (const k of [`outerPocket${S}`, `outerFlap${S}`, `outerCollarPoint${S}`]) {
        const ps = pointsOf(zipped.parts[k]);
        expect(Math.min(...ps.map((p) => p[1])), k).toBeGreaterThan(0);
        expect(Math.min(...ps.map((p) => sx * p[0])), k).toBeGreaterThan(0);
      }
      expect(zipped.parts[`outerEpaulette${S}`]).toBeTruthy(); expect(zipped.parts[`outerRib_cuff${S}`]).toBeTruthy();
    }
    const rib = pointsOf(zipped.parts.outerRib_waist), body = pointsOf(zipped.parts.outerTail_pelvis);
    expect(Math.min(...rib.map((p) => p[2]))).toBeLessThan(Math.min(...body.map((p) => p[2])));
  });

  it('worn open: no zip, the gap widening up the chest; its trims carried across the opening', () => {
    const outer = { family: 'woven', sleeve: 'long', hem: 'hip', fit: 'eased', collar: 'shirt', rib: 'both', pockets: 'flap', epaulettes: true, cloth: 'leather', open: true };
    const P = recipeOf({ ...FLIGHT, language: { outer } }).parts;
    expect(P.outerZipTeeth).toBeUndefined();
    const T = P.outer_torso, S = T.stations.slice(1, -1), gap = (st) => { const [R, L] = edges(T, st); return R[0] - L[0]; };
    const low = S.reduce((a, b) => (mean(Object.values(b.points))[2] < mean(Object.values(a.points))[2] ? b : a)), high = S.reduce((a, b) => (mean(Object.values(b.points))[2] > mean(Object.values(a.points))[2] ? b : a));
    expect(gap(low)).toBeGreaterThan(0.06); expect(gap(high)).toBeGreaterThan(gap(low));
    // (the tail's hem trim, painted on its band before, on every slot of the opened ring)
    const bands = Object.values(zipped.parts.outerTail_pelvis.bandGroups ?? {});
    expect(bands.length).toBeGreaterThan(0);
    for (const G of bands) expect(G.length).toBe(zipped.parts.outerTail_pelvis.slots.length / 2);
  });

  it('its pieces follow the dials as the trunk under them, and take the weights of the jacket under them', () => {
    const joined = Object.values(zipped.dials).filter((d) => d.parts?.includes('outerPocketR'));
    expect(joined.length).toBeGreaterThan(0);
    expect(Object.keys(zipped.parts.outerPocketR.bind.blend).length).toBeGreaterThan(0);
  });

  it('the same hero, the same jacket', () => {
    const jacket = (R) => JSON.stringify(Object.entries(R.parts).filter(([k]) => /^outer/.test(k)));
    expect(jacket(recipeOf(FLIGHT))).toBe(jacket(zipped));
  });
});
