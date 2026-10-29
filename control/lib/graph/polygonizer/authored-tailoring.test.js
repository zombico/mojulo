// The tailoring on the GAME BODY (authored-tailoring.js over tailored-front.js, the realistic body's front and shape), and
// the jacket's fit (authored-jacket.js fitJacket, shoulderUnderJacket), one hero per concept. A densified piece keeps its
// stations' ids and stays round; a suit's front is made (the V, the lapels alone, the edge, the buttons, the tie), no
// collar on it nor the shirt's under it; a waistcoat's V and its buttons; the jacket lies within its ease
// over the shirt; the tiered body's shoulder sockets take the sleeve's colour.
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { densePiece, denseRead, AROUND, STEP } from './authored-tailoring.js';
import { clearanceOver } from './body-relational-tailor.js';
import { FIT } from './authored-jacket.js';

const recipeOf = (style, extra = {}) => expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', outfit: { type: 'outfit', style }, ...extra }) }).recipe;
const mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k], 0) / ps.length);
const middle = (st) => mean(Object.values(st.points));
const radius = (st) => { const c = middle(st), ps = Object.values(st.points); return ps.reduce((t, p) => t + Math.hypot(p[0] - c[0], p[1] - c[1]), 0) / ps.length; };

describe('tailoring on the game body', () => {
  const suit = recipeOf('business');

  it('a densified piece keeps its own stations, its rings close and round (never on the old ring\'s chords)', () => {
    const torso = suit.parts.torso, D = densePiece(torso, 'torso');
    expect(D.slots.length).toBe(AROUND);
    const ids = D.stations.map((st) => st.id);
    for (const st of torso.stations) expect(ids).toContain(st.id);
    for (let i = 1; i < D.stations.length; i++) expect(Math.hypot(...[0, 1, 2].map((k) => middle(D.stations[i])[k] - middle(D.stations[i - 1])[k]))).toBeLessThanOrEqual(STEP + 1e-6);
    // (each new point round the old ring's centre between its two old neighbours: its distance never under the nearer of
    // theirs, where a chord between them cut inside)
    const st = torso.stations[Math.floor(torso.stations.length / 2)], same = D.stations.find((x) => x.id === st.id), c = middle(st);
    const polar = (p) => [Math.atan2(p[1] - c[1], p[0] - c[0]), Math.hypot(p[0] - c[0], p[1] - c[1])], old = Object.values(st.points).map(polar).sort((a, b) => a[0] - b[0]);
    for (const p of Object.values(same.points)) {
      const [t, r] = polar(p), i = old.findIndex((o) => o[0] >= t), a = old[(i - 1 + old.length) % old.length], b = old[i < 0 ? 0 : i];
      expect(r).toBeGreaterThanOrEqual(Math.min(a[1], b[1]) - 1e-4);
    }
  });

  it('a suit\'s front: the V and its lapels alone (no collar), the right front\'s edge, its buttons, the tie', () => {
    for (const k of ['outerLapelR_torso', 'outerLapelL_torso', 'outerEdge_torso', 'outerEdgeUnder_torso', 'outerButton0_torso', 'outerButton1_torso', 'tie_torso']) expect(suit.parts[k], k).toBeTruthy();
    expect(suit.parts.outer_torso.slots.length).toBe(AROUND);
    // (no collar on the jacket, nor the shirt's stand collar under its lapels: off the recipe and the dials; and the lapels
    // end at the gorge, none round the back of the neck)
    for (const k of ['outerCollar_neck', 'topCollar_neck', 'outerLapel_torso']) expect(suit.parts[k], k).toBeUndefined();
    for (const d of Object.values(suit.dials)) for (const k of ['outerCollar_neck', 'topCollar_neck']) expect(d.parts ?? []).not.toContain(k);
    for (const S of ['R', 'L']) expect(Math.min(...suit.parts[`outerLapel${S}_torso`].stations.flatMap((st) => Object.values(st.points)).map((p) => p[1]))).toBeGreaterThan(-0.02);
    // (the V: the jacket's front taken in to the shirt above the top button, painted as the shirt there)
    expect(Object.values(suit.parts.outer_torso.bandGroups ?? {}).flat()).toContain('Top');
  });

  it('a waistcoat: its V, its buttons down it, under the jacket', () => {
    const P = recipeOf('threepiece').parts;
    expect(Object.keys(P).filter((k) => /^vestButton\d+_torso$/.test(k)).length).toBeGreaterThan(2);
    expect(P.vest_torso.slots.length).toBe(AROUND);
  });

  it('the jacket fitted: within its ease over the shirt across the back of the chest, never inside it', () => {
    // (along each ray across the back, away from the V: how far out the shirt reaches there, read densified)
    const J = suit.parts.outer_torso, shirt = denseRead(suit.parts.top_torso).stations.flatMap((st) => Object.values(st.points));
    const chest = J.stations[Math.floor(J.stations.length * 0.6)], c = middle(chest), reach = clearanceOver(shirt, 0.012)(c);
    const over = Object.values(chest.points).filter((p) => p[1] < c[1] - 0.03).map((p) => { const h = [p[0] - c[0], p[1] - c[1]], r = Math.hypot(...h), d = [h[0] / r, h[1] / r, 0], R = reach(d); return R ? r - R : null; }).filter((x) => x !== null);
    expect(over.length).toBeGreaterThan(4);
    for (const o of over) { expect(o).toBeGreaterThan(-0.002); expect(o).toBeLessThan(FIT.trunk + 0.008); }
  });

  it('the tiered body\'s shoulder sockets take the sleeve\'s colour under a jacket, the shirt\'s with no jacket', () => {
    const tiered = recipeOf('business', { form: 'tiered' });
    for (const k of ['shoulderBallR', 'shoulderConeR', 'shoulderWebL']) expect(tiered.parts[k].group, k).toBe(tiered.parts.outerSleeve_upperArmR.group);
    const shirt = recipeOf('casual', { form: 'tiered' });
    const sleeve = Object.keys(shirt.parts).filter((k) => /_upperArmR$/.test(k) && shirt.parts[k].garment).pop();
    if (sleeve) expect(shirt.parts.shoulderBallR.group).toBe(shirt.parts[sleeve].group);
  });
});
