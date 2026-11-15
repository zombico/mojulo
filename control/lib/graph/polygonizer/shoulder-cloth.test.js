// shoulder-cloth.test.js — THE SHOULDER UNDER CLOTH (body-garment.js layShoulders / withShoulders, outfit laws 2): on the
// tiered body a top's cloth runs from its neck ring over the shoulder to an armhole on the shoulder point (sleeveless) or
// into its sleeve's head (sleeved), the body's shoulder forms laid under it and an under-layer's shoulder inside the
// over-garment's. One card per procedure, chosen in code: the fantasy card whose designed over-garment is sleeveless worn
// over a sleeved shirt (both procedures on one mint), on the low-poly register, the cheapest tiered body.
import { describe, expect, it } from 'vitest';

import { FANTASY_OUTFITS, SEEDED_OUTFITS } from '../outfit/styles.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const GOWNS = ['gown', 'robe', 'tunic', 'wizardRobe'];
// (a card whose over-garment is a designed piece with no sleeve, over a cut with a long sleeve)
const CARD = FANTASY_OUTFITS.find((id) => { const C = SEEDED_OUTFITS[id], G = C.pieces.find((P) => GOWNS.includes(P.kind));
  return G && G.sleeve === 'none' && C.language.top?.sleeve === 'long' && !C.pieces.some((P) => P.kind === 'cloak'); });
const recipeOf = (laws) => expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'male', form: 'tiered', register: 'lowpoly', outfit: { type: 'outfit', style: CARD, ...(laws ? { laws } : {}) } }) }).recipe;
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((t, p) => t + p[k], 0) / ps.length);
const ptsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));
const R2 = recipeOf(), parts = R2.parts;
const over = Object.keys(parts).find((n) => /Bodice_torso$/.test(n)).replace(/_torso$/, '');

describe('the shoulder under cloth (outfit laws 2, the tiered body)', () => {
  it('the card chosen, and its pieces: the over-garment to an armhole, the shirt into its sleeve\'s head', () => {
    expect(CARD).toBeTruthy();
    expect(parts[`${over}Yoke_shoulderConeR`]).toBeTruthy();
    expect(parts[`${over}Yoke_shoulderWebR`]).toBeUndefined();
    expect(parts.topYoke_shoulderConeR && parts.topYoke_shoulderWebR).toBeTruthy();
  });
  it('one run of cloth from the neck ring to the shoulder point: the cone\'s first ring by the neck, its last at the ball', () => {
    const Y = parts[`${over}Yoke_shoulderConeR`], C = Y.stations.map((st) => mean(Object.values(st.points)));
    const neckX = Math.max(...Object.values(parts.torso.stations.at(-1).points).map((p) => p[0]));
    const ball = mean(ptsOf(parts.shoulderBallR));
    expect(C[0][0]).toBeLessThan(neckX + 0.01);
    expect(Math.hypot(...C.at(-1).map((x, k) => x - ball[k]))).toBeLessThan(0.02);
    // (and the shirt's sleeve head ends on the arm's ring its sleeve runs down from)
    const W = parts.topYoke_shoulderWebR, S = parts.topSleeve_upperArmR, end = mean(Object.values(W.stations.at(-1).points));
    expect(Math.min(...S.stations.map((st) => Math.hypot(...mean(Object.values(st.points)).map((x, k) => x - end[k]))))).toBeLessThan(0.01);
  });
  it('the shoulder line drops from the neck to the shoulder point; the forms beneath lie under the over-garment\'s top', () => {
    const top = (P) => ptsOf(P).reduce((b, p) => (p[2] > b[2] ? p : b));
    const Y = parts[`${over}Yoke_shoulderConeR`], C = Y.stations.map((st) => Object.values(st.points));
    const crest = C.map((ring) => Math.max(...ring.map((p) => p[2])));
    expect(crest[0] - crest.at(-1)).toBeGreaterThan(0.02);
    for (const f of ['shoulderBallR', 'shoulderConeR', 'shoulderWebR']) expect(top(parts[f])[2], f).toBeLessThan(Math.max(...crest));
  });
  it('the under-layer\'s shoulder lies inside the over-garment\'s: no shirt point over the shoulder stands above it', () => {
    const Y = ptsOf(parts[`${over}Yoke_shoulderConeR`]), xEnd = Math.max(...Y.map((p) => p[0]));
    // (the over-garment's top over each 2 cm of the shoulder's run, from the neck to its armhole)
    const bin = (x) => Math.floor(x / 0.02), crest = new Map();
    for (const p of [...Y, ...ptsOf(parts[`${over}_torso`])]) if (p[0] > 0) crest.set(bin(p[0]), Math.max(crest.get(bin(p[0])) ?? -9, p[2]));
    const shirt = ['topYoke_shoulderConeR', 'topYoke_shoulderWebR', 'top_torso'].flatMap((n) => ptsOf(parts[n])).filter((p) => p[0] > 0.06 && p[0] < xEnd - 0.02);
    const worst = Math.max(...shirt.map((p) => p[2] - Math.max(crest.get(bin(p[0])) ?? -9, crest.get(bin(p[0]) + 1) ?? -9)));
    expect(worst).toBeLessThan(0.002);
  });
  it('it moves as the shoulder does: each piece skins as the form it is copied from, so a raised arm carries it', () => {
    const Y = parts[`${over}Yoke_shoulderConeR`], F = parts.shoulderConeR;
    const own = Object.keys(Y.bind.blend).filter((k) => /^st\d+$/.test(k) && F.bind.blend[k]);
    expect(own.length).toBeGreaterThan(2);
    for (const k of own) expect(Y.bind.blend[k], k).toEqual(F.bind.blend[k]);
    expect(Object.keys(Y.bind.blend.st0).some((b) => /torso|chest|spine|clavicle/i.test(b)) || Y.bind.blend.st0[F.bind.bone] !== undefined).toBe(true);
  });
  it('outfit laws 1 lay nothing and wear nothing over the forms; the same card twice is the same recipe', () => {
    const R1 = recipeOf(1);
    expect(Object.keys(R1.parts).filter((n) => /Yoke_/.test(n))).toEqual([]);
    const crown = (R) => Math.max(...ptsOf(R.parts.shoulderWebR).map((p) => p[2]));
    expect(crown(R1)).toBeGreaterThan(crown(R2));
    expect(JSON.stringify(recipeOf().parts)).toBe(JSON.stringify(parts));
  });
});
