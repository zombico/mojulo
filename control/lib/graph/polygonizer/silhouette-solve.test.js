import { describe, expect, it } from 'vitest';

import { compileLayered } from './station-loft.js';
import { cameraRecord, strokeCamera } from './stroke-resolve.js';
import { fitSilhouetteDials, solvableDials, strokeMask, residualOf, solvedRecord } from './silhouette-solve.js';
import { projectVertices } from '../scene/wire-svg.js';

// A convex prism (no detail), so its silhouette from any view IS the convex hull of its projected vertices —
// the stroke a person would trace around it.
const body = {
  layer: 1, closure: 'closed', slots: ['top', 'sideR', 'bottom', 'sideL'], group: 'Body',
  stations: [
    { id: 'st0', points: { top: [0, 0, 1], sideR: [1, 0, 0.5], bottom: [0, 0, 0], sideL: [-1, 0, 0.5] } },
    { id: 'st1', points: { top: [0, 1, 1], sideR: [1, 1, 0.5], bottom: [0, 1, 0], sideL: [-1, 1, 0.5] } },
  ],
  caps: { back: [0, -0.5, 0.5], tip: [0, 1.5, 0.5] },
};
const recipe = {
  frame: { up: '+z', front: '+y' },
  dials: {
    width: { min: 0.5, max: 2, rest: 1, op: 'scale', axis: 'x', pivot: 0, parts: ['body'], blend: { st0: 1, st1: 1 } },
    lift: { min: 0, max: 1, rest: 0, op: 'offset', axis: 'z', slots: ['top'], parts: ['body'], blend: { st0: 1, st1: 1 } },
    tilt: { min: 0, max: 45, rest: 0, op: 'hinge', part: 'body', pivot: 'body/st0.bottom', axis: 'x', sign: -1 },
  },
  parts: { body },
};

/** Andrew's monotone chain: the convex hull of 2-D points, counter-clockwise. */
function hull(pts) {
  const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = []; for (const p of P) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper = []; for (const p of [...P].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
/** the silhouette stroke of the body at `dials`, as drawn on the START mesh's camera (what the person sees) */
function traced(view, startDials, targetDials, scale = 1) {
  const start = compileLayered(recipe, startDials); const camera = cameraRecord(start, view); const cam = strokeCamera({ view, camera }, start);
  const target = compileLayered(recipe, targetDials); const q = projectVertices(target.vertices, cam).map(([x, y]) => [x / cam.size, y / cam.size]);
  let pts = hull(q);
  if (scale !== 1) { const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]); pts = pts.map((p) => [c[0] + (p[0] - c[0]) * scale, c[1] + (p[1] - c[1]) * scale]); }
  return { stroke: { id: 't', view, intent: 'silhouette', closed: true, points: pts.map((p) => [...p, 0.5]), camera }, start };
}

describe('silhouette-solve — a drawn outline becomes a dial solve', () => {
  it('the solvable dials are the continuous shape dials; posing dials move only when named', () => {
    expect(solvableDials(recipe)).toEqual(['width', 'lift']);
    expect(solvableDials(recipe, ['tilt'])).toEqual(['tilt']);
    expect(() => solvableDials(recipe, ['wings'])).toThrow(/unknown dial 'wings'/);
  });

  it('strokeMask fills a closed polygon by even-odd scanlines; residualOf measures where two masks disagree', () => {
    const m = strokeMask({ points: [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]] }, 16); let n = 0; for (const v of m) n += v;
    expect(n).toBe(64); expect(m[8 * 16 + 8]).toBe(1); expect(m[0]).toBe(0);
    const r = residualOf(m, new Uint8Array(256), 16); expect(r.pixels).toBe(64); expect(r.share).toBe(1); expect(r.bbox).toEqual([0.25, 0.25, 0.75, 0.75]);
    expect(residualOf(m, m, 16).pixels).toBe(0);
  });

  it('self-trace: the outline of the body at (width 1.6, lift 0.5) solves those dials back from rest, IoU ≥ 0.97', () => {
    const { stroke, start } = traced('three-quarter', {}, { width: 1.6, lift: 0.5 });
    const fit = fitSilhouetteDials(recipe, {}, stroke, { mesh: start, budget: 80 });
    expect(fit.iou).toBeGreaterThanOrEqual(0.97); expect(fit.iou).toBeGreaterThan(fit.before);
    expect(Math.abs(fit.dials.width - 1.6)).toBeLessThan(0.08); expect(Math.abs(fit.dials.lift - 0.5)).toBeLessThan(0.08);
    expect(fit.dials.tilt).toBe(0); expect(Object.keys(fit.moved).sort()).toEqual(['lift', 'width']); expect(fit.bounds).toEqual([]);
    expect(fit.compiles).toBeLessThanOrEqual(80);
    const rec = solvedRecord(fit); expect(rec.iou).toBe(fit.iou); expect(rec.residual.share).toBe(fit.residual.share); expect(rec.residual.mask).toBeUndefined();
  });

  it('out of span: an outline wider than the widest body stops on the bound, reports a residual, and never oscillates', () => {
    const { stroke, start } = traced('frontal', {}, { width: 2 }, 1.3);
    const fit = fitSilhouetteDials(recipe, {}, stroke, { mesh: start, budget: 60 });
    expect(fit.dials.width).toBe(2); expect(fit.bounds).toContain('width=2 (max)');
    expect(fit.residual.share).toBeGreaterThan(0); expect(fit.residual.bbox).not.toBeNull();
    for (let i = 1; i < fit.trace.length; i++) expect(fit.trace[i]).toBeLessThanOrEqual(fit.trace[i - 1]);
  });

  it('deterministic: the same inputs give the same bytes; a named list restricts what moves', () => {
    const { stroke, start } = traced('three-quarter', {}, { width: 1.6, lift: 0.5 });
    const a = fitSilhouetteDials(recipe, {}, stroke, { mesh: start }), b = fitSilhouetteDials(recipe, {}, stroke);
    expect(JSON.stringify({ ...a, residual: { ...a.residual, mask: [...a.residual.mask] } })).toBe(JSON.stringify({ ...b, residual: { ...b.residual, mask: [...b.residual.mask] } }));
    const only = fitSilhouetteDials(recipe, {}, stroke, { names: ['width'] }); expect(only.dials.lift).toBe(0); expect(Object.keys(only.moved)).toEqual(['width']);
  });

  it('refuses a stroke that is not a silhouette, or one that encloses nothing', () => {
    const { stroke } = traced('frontal', {}, {});
    expect(() => fitSilhouetteDials(recipe, {}, { ...stroke, intent: 'contour' })).toThrow(/not a silhouette/);
    expect(() => fitSilhouetteDials(recipe, {}, { ...stroke, points: [[0.5, 0.5], [0.5, 0.5], [0.5, 0.5]] })).toThrow(/encloses no area/);
  });
});
