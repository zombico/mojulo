/**
 * The surveyor (form/survey.js): what an eye sees of a form land, solved from its data. On the smallest land (two
 * triangles, a grass map over half of it) a ray down meets the ground, a ray up meets the sky, the far half outside the
 * map reads as outside, and the land's edge against the sky is its contour.
 */
import { describe, expect, it } from 'vitest';

import { surveyView, surveyChart } from './survey.js';

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
});
