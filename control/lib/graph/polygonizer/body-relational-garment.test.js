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

  it('a skin-fitting shirt lies nearer the skin than the tee, yet spans its grooves; its sleeves to the wrist', () => {
    const mint = (w) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', outfit: [w] }) }).recipe;
    const tee = mint('tee'), fit = mint('fittedShirt');
    const A = auditLayered(compileLayered(fit, {}));
    for (const k of ['fittedShirt_torso', 'fittedShirt_upperArmR', 'fittedShirt_foreArmR', 'fittedShirt_foreArmL']) expect(A[k]?.pass, k).toBe(true);
    // the sleeve down the forearm to the wrist
    expect(fit.parts.fittedShirt_foreArmR.stations.length).toBeGreaterThan(0.85 * fit.parts.foreArmR.stations.length);
    // each cloth point's lift off the skin point under it, over the torso
    const lifts = (r, id) => { const G = r.parts[`${id}_torso`], P = r.parts.torso, out = [];
      for (const st of G.stations) { const S = P.stations.find((x) => x.id === st.id); for (const sl of P.slots) out.push(Math.hypot(...[0, 1, 2].map((q) => st.points[sl][q] - S.points[sl][q]))); }
      return out; };
    const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length, lt = lifts(tee, 'tee'), lf = lifts(fit, 'fittedShirt');
    expect(mean(lf)).toBeLessThan(0.4 * mean(lt));
    // half of it within a centimetre of the skin (the tee: four), and lifted farther where it spans a groove
    const mid = [...lf].sort((x, y) => x - y)[Math.floor(lf.length / 2)];
    expect(mid).toBeLessThan(0.012);
    expect(Math.max(...lf)).toBeGreaterThan(0.02);
  }, 240_000);

  it('trousers: the seat over the crotch wound outward, to the waist, as close as the fitted shirt', () => {
    const r = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic', physique: 'heavyset', outfit: ['trousers'] }) }).recipe;
    const A = auditLayered(compileLayered(r, {})), pieces = Object.keys(r.parts).filter((k) => /^trousers_/.test(k));
    expect(pieces).toEqual(expect.arrayContaining(['trousers_pelvis', 'trousers_thighR', 'trousers_thighL', 'trousers_shankR', 'trousers_shankL']));
    for (const k of pieces) { expect(A[k].pass, k).toBe(true); expect(A[k].windingErrors, k).toBe(0); }
    // the seat from above the crotch's flat floor up to the pelvis's top ring (the waist)
    expect(r.parts.trousers_pelvis.stations.at(-1).id).toBe(r.parts.pelvis.stations.at(-1).id);
    expect(r.parts.trousers_pelvis.stations[0].id).not.toBe(r.parts.pelvis.stations[0].id);
    // a leg as close to its skin as the shirt to the torso: half within a centimetre
    const G = r.parts.trousers_thighR, P = r.parts.thighR, lift = [];
    for (const st of G.stations) { const S = P.stations.find((x) => x.id === st.id); for (const sl of P.slots) lift.push(Math.hypot(...[0, 1, 2].map((q) => st.points[sl][q] - S.points[sl][q]))); }
    expect([...lift].sort((x, y) => x - y)[Math.floor(lift.length / 2)]).toBeLessThan(0.012);
  }, 240_000);
});
