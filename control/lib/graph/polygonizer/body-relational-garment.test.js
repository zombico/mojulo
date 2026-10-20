// body-relational-garment.test.js — a garment tailored to body parts on the realistic body: the tee made from the parts
// it covers (found on whichever segments carry them), on one cloth field, outside the skin, on the skin's own grid (so its
// bind and correctives are the skin's), closed, cut down the arm, the same twice. One build (the procedure is one).
import { describe, it, expect } from 'vitest';

import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered, auditLayered } from './station-loft.js';

describe('a field garment (the tee)', () => {
  it('covers its parts across segments, outside the skin, on the skin\'s grid, closed, and the same twice', () => {
    const hero = heroRecord({ cast: 'male', form: 'realistic', outfit: ['tee'] }), m = expandLayeredManifest({ kind: 'layered', hero });
    const tee = Object.keys(m.recipe.parts).filter((k) => /^tee_/.test(k));
    expect(tee).toEqual(expect.arrayContaining(['tee_torso', 'tee_upperArmR', 'tee_upperArmL']));
    expect(Object.keys(m.recipe.parts).filter((k) => /^teeSleeve_/.test(k))).toEqual([]);   // the segment pieces gone
    const A = auditLayered(compileLayered(m.recipe, m.dials));
    for (const k of tee) { expect(A[k].pass, k).toBe(true); expect(A[k].windingErrors, k).toBe(0); }
    // on the skin's grid and outside it: each cloth point farther from its ring's middle than the skin's point there
    for (const k of tee) {
      const G = m.recipe.parts[k], P = m.recipe.parts[k.slice(4)];
      expect(G.slots).toEqual(P.slots);
      for (const st of G.stations) {
        const S = P.stations.find((x) => x.id === st.id); expect(S, `${k} ${st.id}`).toBeTruthy();
        const c = P.slots.reduce((a, sl) => a.map((v, i) => v + S.points[sl][i] / P.slots.length), [0, 0, 0]), r = (p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
        for (const sl of P.slots) expect(r(st.points[sl]), `${k} ${st.id}.${sl}`).toBeGreaterThanOrEqual(r(S.points[sl]) - 1e-6);
      }
    }
    // the sleeve cut short: under half the upper arm's rings
    expect(m.recipe.parts.tee_upperArmR.stations.length).toBeLessThan(m.recipe.parts.upperArmR.stations.length / 2 + 1);
    // the skin's correctives worn: a raised arm lifts the sleeve's top with the skin under it
    expect(m.recipe.correctives.some((c) => Object.keys(c.d).some((id) => id.startsWith('tee_upperArmR/')))).toBe(true);
    expect(JSON.stringify(expandLayeredManifest({ kind: 'layered', hero }).recipe)).toBe(JSON.stringify(m.recipe));
  }, 180_000);
});
