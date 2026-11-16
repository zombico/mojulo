// chest-line.test.js — THE RISE AND THE BELTED TUNIC (body-garment.js riseToNeck, `cinch`; outfit-plan.js gownOf, outfit
// laws 2, the tiered body): a top's front is one surface from the chest to its neckline, never the torso's boxy top turned
// over as a lid (a level edge across the upper chest), its neckline at the neck's root; a sleeveless over-garment's side
// runs up from the chest to its armhole instead of standing out over the arm's root; a bodice under a belt is taken in
// to it and its skirt hangs from under the belt. One card per procedure, chosen in code: the fantasy card whose designed
// over-garment is sleeveless, over a sleeved shirt, under a belt at the waist, on the low-poly register.
import { describe, expect, it } from 'vitest';

import { FANTASY_OUTFITS, SEEDED_OUTFITS } from '../outfit/styles.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';

const GOWNS = ['gown', 'robe', 'tunic', 'wizardRobe'];
const CARD = FANTASY_OUTFITS.find((id) => { const C = SEEDED_OUTFITS[id], G = C.pieces.find((P) => GOWNS.includes(P.kind));
  return G && G.sleeve === 'none' && C.language.top?.sleeve === 'long' && !C.pieces.some((P) => P.kind === 'cloak') && C.pieces.some((P) => P.kind === 'belt' && P.at === 'waist'); });
const expandOf = (laws) => expandLayeredManifest({ kind: 'layered', title: 't', hero: heroRecord({ cast: 'male', form: 'tiered', register: 'lowpoly', outfit: { type: 'outfit', style: CARD, ...(laws ? { laws } : {}) } }) });
const E2 = expandOf(), parts = E2.recipe.parts;
const ptsOf = (P) => P.stations.flatMap((st) => Object.values(st.points));
const bodice = Object.keys(parts).find((n) => /Bodice_torso$/.test(n)), id = bodice.replace(/Bodice_torso$/, '');
// a slot's line up a piece, ring by ring (y forward, z up), and the largest turn between two of its steps (degrees)
const line = (P, sl) => P.stations.map((st) => st.points[sl]);
const turns = (L) => L.slice(1, -1).map((p, i) => { const a = [p[1] - L[i][1], p[2] - L[i][2]], b = [L[i + 2][1] - p[1], L[i + 2][2] - p[2]];
  return Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1])) * 180 / Math.PI; });
const armpit = Math.min(...['shoulderBallR', 'shoulderBallL'].flatMap((n) => ptsOf(parts[n]).map((p) => p[2])));
const half = (P, j) => Math.max(...Object.values(P.stations[j].points).map((p) => Math.abs(p[0])));

describe('the chest line and the belted tunic (outfit laws 2, the tiered body)', () => {
  it('the card chosen, and the pieces it makes', () => {
    expect(CARD).toBeTruthy();
    expect(parts[bodice] && parts[`${id}Skirt_skirt`] && parts.girdle_torso && parts.top_torso).toBeTruthy();
  });
  it('no edge but the neckline from the chest up: the front and the back rise ring by ring and never turn a corner', () => {
    for (const P of [parts[bodice], parts.top_torso]) for (const sl of ['front', 'back']) {
      const L = line(P, sl).filter((p) => p[2] >= armpit - 0.08), z = L.map((p) => p[2]);
      // (rising: each ring's point above the one below it, so no lid turns back down into a V at the neck)
      for (let i = 1; i < z.length; i++) expect(z[i] - z[i - 1], `${sl} ring ${i}`).toBeGreaterThan(-0.002);
      // (no corner below the neckline's own band, the last step into it: the line turns by at most 40 degrees between two
      // rings, on the low-poly register's coarse stack, at its steepest a band under the neckline where the shoulder's cone
      // lifts it; the lid turned it through 70 to 80)
      expect(Math.max(...turns(L.slice(0, -1))), sl).toBeLessThan(40);
    }
  });
  it('the neckline is the neck\'s root: its front at the torso\'s top ring, carried out, close to the neck', () => {
    const top = parts[bodice].stations.at(-1).points, neck = parts.torso.stations.at(-1).points;
    // (at the root, or lifted with the ring under it over the layers at the neck, a crew neck's height at most, never
    // dropped below it into a V)
    expect(top.front[2] - neck.front[2]).toBeGreaterThan(-0.002);
    expect(top.front[2] - neck.front[2]).toBeLessThan(0.025);
    expect(top.front[1] - neck.front[1]).toBeGreaterThan(0);
    expect(top.front[1] - neck.front[1]).toBeLessThan(0.03);
  });
  it('a sleeveless side runs up from the chest to its armhole, never out over the arm\'s root', () => {
    // (the chest: the ring under the armpit where the body under the front stands furthest out, where the rise starts)
    const P = parts[bodice], T = parts.torso.stations, zc = T.filter((st) => st.points.front[2] >= armpit - 0.1 && st.points.front[2] < armpit).reduce((b, st) => (st.points.front[1] > b.points.front[1] ? st : b)).points.front[2];
    const j0 = P.stations.findIndex((st) => st.points.front[2] >= zc - 1e-6), chest = half(P, j0);
    for (let j = j0; j < P.stations.length; j++) {
      const lo = Math.min(...Object.values(P.stations[j].points).map((p) => p[2]));
      if (lo < armpit) expect(half(P, j), `ring ${j}`).toBeLessThan(chest + 0.012);
    }
  });
  it('taken in at the belt: the bodice narrows from the chest to the waist, the skirt hangs from under the belt', () => {
    const P = parts[bodice], zs = P.stations.map((st) => Math.min(...Object.values(st.points).map((p) => p[2])));
    const g = ptsOf(parts.girdle_torso).map((p) => p[2]), beltLo = Math.min(...g), beltHi = Math.max(...g);
    const waist = zs.findIndex((z) => z >= (beltLo + beltHi) / 2), chest = zs.findIndex((z) => z >= armpit - 0.06);
    expect(half(P, chest) - half(P, waist)).toBeGreaterThan(0.03);
    // (the bodice does not run on below the belt inside the skirt, and the skirt's top lies under the belt)
    expect(Math.min(...zs)).toBeGreaterThan(beltLo - 0.05);
    const top = parts[`${id}Skirt_skirt`].stations[0].points, ztop = Object.values(top)[0][2];
    expect(ztop).toBeGreaterThan(beltLo - 0.01);
    expect(ztop).toBeLessThan(beltHi);
    expect(Math.max(...Object.values(top).map((p) => Math.hypot(p[0], p[1])))).toBeLessThan(Math.max(...ptsOf(parts.girdle_torso).map((p) => Math.hypot(p[0], p[1]))));
  });
  it('it holds at a raised arm: the front from the chest to the neckline skins as the trunk does, no arm in it', () => {
    const P = parts[bodice], B = P.bind.blend;
    for (const st of P.stations) { const w = B[`${st.id}.front`] ?? B[st.id] ?? {};
      expect(Object.keys(w).filter((b) => /arm|Arm|hand/.test(b)), st.id).toEqual([]); }
  });
  it('outfit laws 1 cut as before (no rise, no cinch, the skirt from the hips); the same card twice is the same recipe', () => {
    const E1 = expandOf(1), P1 = E1.recipe.parts[bodice], z = line(P1, 'front').map((p) => p[2]);
    // (laws 1: the front's top ring dips under the ring below it, the lid turned over into the neckline's V)
    expect(z.at(-1)).toBeLessThan(Math.max(...z));
    const skirt1 = E1.recipe.parts[`${id}Skirt_skirt`], pelvisTop = Math.max(...ptsOf(E1.recipe.parts.pelvis).map((p) => p[2]));
    expect(Object.values(skirt1.stations[0].points)[0][2]).toBeLessThan(pelvisTop + 0.01);
    expect(JSON.stringify(expandOf().recipe.parts)).toBe(JSON.stringify(parts));
  });
});
