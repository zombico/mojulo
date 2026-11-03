/**
 * The surveyor (form/survey.js): what an eye sees of a form land, solved from its data. On the smallest land (two
 * triangles, a grass map over half of it) a ray down meets the ground, a ray up meets the sky, the far half outside the
 * map reads as outside, and the land's edge against the sky is its contour.
 */
import { describe, expect, it } from 'vitest';

import { surveyView, surveyChart, surveyRegions, contourScan } from './survey.js';

const b64 = (a) => Buffer.from(new Float32Array(a).buffer).toString('base64');
// (a flat square 0..100 m at z 0, its grass map over x < 50 only, full cover)
const G = { origin: [0, 0], cell: 1, size: [50, 100], z: [0, 1], px: Buffer.from(new Uint8Array(50 * 100 * 4).map((_, i) => (i % 4 === 2 ? 255 : 0))).toString('base64') };
const land = { pos: b64([0, 0, 0, 100, 0, 0, 100, 100, 0, 0, 0, 0, 100, 100, 0, 0, 100, 0]), ranges: [{ key: 'ground', start: 0, count: 6 }], grass: G };

describe('the surveyor', () => {
  it('meets the ground below the horizon and the sky above it, and finds the contour at the land\'s edge', () => {
    const S = surveyView(land, { eye: [25, 2, 1.7], target: [25, 60, 1.7], vfov: 40, cols: 8, rows: 12, reach: 10 });
    expect(S.samples[0].every((s) => s === null)).toBe(true);
    expect(S.samples[S.rows - 1].every((s) => s && s.d < 10)).toBe(true);
    expect(S.counts.contour).toBeGreaterThan(0);
    expect(surveyChart(S, 10).split('\n')).toHaveLength(12);
  });

  it('reads the grass map: inside it grass, past its edge outside', () => {
    const S = surveyView(land, { eye: [50, 2, 1.7], target: [50, 60, 1.7], vfov: 40, cols: 16, rows: 12, reach: 5 });
    const far = S.samples.flat().filter((s) => s && s.d >= 5);
    expect(far.some((s) => s.map === 'in' && s.cover > 0)).toBe(true);
    expect(far.some((s) => s.map === 'out')).toBe(true);
    expect(S.byClass.ground.far).toBe(far.length);
  });

  it('hands the art its regions: the grass as one, its bounds left to right, its top over its bottom, what stands on it', () => {
    const S = surveyView(land, { eye: [25, 2, 1.7], target: [25, 60, 1.7], vfov: 40, cols: 8, rows: 24, reach: 10 });
    const grass = surveyRegions(S, { reach: 10, height: 720, vfov: 40 }).filter((R) => R.substance === 'grass');
    expect(grass).toHaveLength(1);
    const [R] = grass;
    expect(R.x[0]).toBeLessThan(R.x[1]);
    for (const k of R.columns) {
      expect(k.top).toBeLessThan(k.bottom);
      expect(k.standsPx).toBeGreaterThan(0);
      expect(k.d).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('the contour scan', () => {
  // (a ground map 100 m square at 1 m, flat, a ridge 3 m high across it at y 40..41, grass everywhere half a metre tall)
  const N = 100, map = (ridge) => ({ n: [N, N], cell: 1, centre: [0, 0], zs: Float32Array.from({ length: N * N }, (_, k) => (ridge && Math.floor(k / N) >= 40 && Math.floor(k / N) <= 41 ? 3 : 0)),
    hs: new Float32Array(N * N).fill(0.5), slots: new Uint8Array(N * N), tones: new Uint8Array(N * N).fill(128) });

  it('finds the ridge as the contour past the reach, and none on flat ground short of the map\'s edge', () => {
    const S = contourScan(map(true), [50, 5, 1.7], { reach: 20, bearings: 360, strands: 1 });
    const ys = []; for (let i = 0; i < S.length; i += 6) ys.push(S[i + 1]);
    expect(ys.some((y) => y >= 39 && y <= 42)).toBe(true);
    // (flat: the only contour is where the map ends)
    const F = contourScan(map(false), [50, 50, 1.7], { reach: 20, bearings: 360, strands: 1 });
    for (let i = 0; i < F.length; i += 6) expect(Math.min(F[i], F[i + 1], N - 1 - F[i], N - 1 - F[i + 1])).toBeLessThan(2);
  });

  it('is deterministic, and nothing inside the reach is handed to the art', () => {
    const a = contourScan(map(true), [50, 5, 1.7], { reach: 60 }), b = contourScan(map(true), [50, 5, 1.7], { reach: 60 });
    expect(Array.from(a)).toEqual(Array.from(b));
    for (let i = 0; i < a.length; i += 6) expect(Math.hypot(a[i] - 50, a[i + 1] - 5)).toBeGreaterThanOrEqual(59);
  });
});
