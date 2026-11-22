// THE GEOCITY'S BACK LANDS (backs.js): behind a row of houses a yard each and the fences between them, the spine's fence
// drawn once, a yard cut where a terrace steps; a block's park the geotown's; a vacant lot's young trees by its fence;
// and in the metro, an evoked neighbourhood's outskirts lived in, a house at most three storeys, the grass claimed under
// every hard thing in the form render, and a metro with nothing evoked as it was.
import { describe, it, expect } from 'vitest';
import { rowYards, shopYards, blockPark, volunteers, BACKS } from './backs.js';
import { PATTERNS, PATTERN_IDS } from '../geotown/pattern.js';
import { mulberry32 } from '../city/plan/dice.js';
import { assembleGeocityScene } from './scene.js';

const P = PATTERNS[PATTERN_IDS.find((id) => PATTERNS[id].yards && PATTERNS[id].sites?.park)];
const flat = () => 10;
const within = (f, [u0, v0, u1, v1], pad = 0.5) => f.corners.every(([u, v]) => u >= u0 - pad && u <= u1 + pad && v >= v0 - pad && v <= v1 + pad);
const upright = (f) => Math.abs(f.out[2]) < 0.5;

describe('a row of houses\' yards', () => {
  const plots = [[0, 6.8], [6.8, 13.6], [13.6, 20.4], [20.4, 27.2]], v0 = 17, v1 = 31;
  it('a yard each, inside its row, on its ground, its trees in it', () => {
    const Y = rowYards(plots, { v0, v1, zAt: flat, P, R: mulberry32(3) });
    expect(Y.plans).toHaveLength(plots.length);
    expect(Y.faces.every((f) => within(f, [0, v0 - 1.5, 27.2, v1]))).toBe(true);
    expect(Y.faces.every((f) => f.corners.every((c) => c[2] >= 10 - 1e-9))).toBe(true);
    expect(Y.trees.every((t) => t.u > 0 && t.u < 27.2 && t.v > v0 && t.v < v1 && t.h >= BACKS.young[0])).toBe(true);
    // (no two neighbours' yards the same in every zone)
    for (let k = 1; k < Y.plans.length; k++) expect(['near', 'mid', 'back'].some((z) => Y.plans[k][z] !== Y.plans[k - 1][z] || Y.plans[k][z] === 'lawn')).toBe(true);
  });
  it('fenced between every two yards and at the row\'s ends; the spine\'s fence only where the row draws it', () => {
    const lines = (Y) => new Set(Y.faces.filter((f) => upright(f) && (() => { const vs = f.corners.map((c) => c[1]); return Math.min(...vs) > v0 - 0.2 && Math.max(...vs) < v1 + 0.2 && Math.max(...vs) - Math.min(...vs) > (v1 - v0) / 2; })()).flatMap((f) => { const us = f.corners.map((c) => c[0]); return Math.max(...us) - Math.min(...us) < 1 ? [Math.round((us.reduce((a, b) => a + b) / us.length) * 2) / 2] : []; }));
    const Y = rowYards(plots, { v0, v1, zAt: flat, P, R: mulberry32(5) }), at = lines(Y);
    for (const u of [0, 6.8, 13.6, 20.4, 27.2]) expect([...at].some((x) => Math.abs(x - u) < 0.6)).toBe(true);
    const spineFaces = (Y) => Y.faces.filter((f) => upright(f) && f.corners.every(([, v]) => Math.abs(v - v1) < 0.5) && Math.max(...f.corners.map((c) => c[0])) - Math.min(...f.corners.map((c) => c[0])) > 5).length;
    expect(spineFaces(Y)).toBeGreaterThan(0);
    expect(spineFaces(rowYards(plots, { v0, v1, zAt: flat, P, R: mulberry32(5), spine: false }))).toBe(0);
  });
  it('a yard across a terrace\'s step is two, each on its own level, a fence along the step on its higher side', () => {
    const zAt = (u) => (u < 10 ? 10 : 11.2), Y = rowYards(plots, { v0, v1, zAt, P, R: mulberry32(7), steps: [10] });
    expect(Y.plans.length).toBe(plots.length + 1);
    // (nothing flat on the wrong level: a face lying down stands on its own side's ground)
    for (const f of Y.faces.filter((g) => g.out[2] > 0.9 && g.role !== 'canvas')) { const u = f.corners.reduce((a, c) => a + c[0], 0) / f.corners.length, z = Math.min(...f.corners.map((c) => c[2])); expect(z).toBeGreaterThanOrEqual(zAt(u) - 1e-6); }
    expect(Y.faces.some((f) => upright(f) && f.corners.every((c) => Math.abs(c[0] - 10) < 0.6) && Math.min(...f.corners.map((c) => c[2])) >= 11.2 - 1e-6)).toBe(true);
  });
  it('a row of shops\' yard: paved behind each bay, its bins, its cars on it', () => {
    const Y = shopYards([[0.4, 29.6], [30.4, 59.6]], { v0: 14, v1: 30, zAt: flat, R: mulberry32(2) });
    expect(Y.faces.filter((f) => f.role === 'lane')).toHaveLength(2);
    expect(Y.faces.some((f) => f.role === 'bin')).toBe(true);
    expect(Y.cars.every((c) => c.v > 14 && c.v < 30)).toBe(true);
  });
});

describe('a block\'s park and a vacant lot', () => {
  it('the park: its paths across it, its benches, its trees on its lawn clear of its paths', () => {
    const K = blockPark(70, 100, { zAt: flat, P, R: mulberry32(4) });
    expect(K.faces.filter((f) => f.role === 'park-path').length).toBeGreaterThan(0);
    expect(K.faces.some((f) => f.role === 'seat' || f.role === 'timber')).toBe(true);
    expect(K.trees.length).toBeGreaterThan(5);
    for (const t of K.trees) for (const p of K.paths) expect(t.u < p[0] - 2 || t.u > p[2] + 2 || t.v < p[1] - 2 || t.v > p[3] + 2).toBe(true);
  });
  it('a vacant lot\'s young trees stand nearer its fence than its middle', () => {
    const T = volunteers([0, 0, 60, 100], { zAt: flat, R: mulberry32(9) }).trees;
    expect(T.length).toBeGreaterThan(3);
    for (const t of T) { expect(Math.min(t.u, 60 - t.u, t.v, 100 - t.v)).toBeLessThan(BACKS.wild.edge * 1.4 + 1e-9); expect(t.h).toBeLessThanOrEqual(BACKS.wild.h[1]); }
  });
});

describe('a metro\'s back lands', () => {
  // (the smallest metro that still rings, an outskirts neighbourhood evoked: enter.test.js's)
  const geocity = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
  const M = { kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, geocity: { ...geocity, evoke: 'neighbourhood', at: 'B4' } };
  it('an evoked neighbourhood is lived in behind its rows; a house at most three storeys; read as form, its grass claimed under them', () => {
    const P1 = assembleGeocityScene(M, { form: true }), backs = P1.faces.filter((f) => /^geocity:back-/.test(f.group));
    expect(backs.length).toBeGreaterThan(1000);
    for (const role of ['fence-board', 'deck', 'park-path']) expect(backs.some((f) => f.group === `geocity:back-${role}`)).toBe(true);
    // (a house's eaves no higher than three storeys over its ground, under its gable)
    const tallest = Math.max(...P1.faces.filter((f) => f.group === 'geocity:house').map((f) => Math.max(...f.corners.map((c) => c[2])) - Math.min(...f.corners.map((c) => c[2]))));
    expect(tallest).toBeLessThan(3 * 3 + 4.5 + 0.01);
    expect(P1.plants.clear.length).toBeGreaterThan(P1.plants.trees.length);
    expect(P1.geocity.laws.find((l) => l.law === 'faces').ok).toBe(true);
  });
  it('a metro with nothing evoked has none', () => {
    const P0 = assembleGeocityScene({ ...M, geocity: geocity });
    expect(P0.faces.some((f) => /^geocity:back-/.test(f.group))).toBe(false);
  });
}, 300000);
