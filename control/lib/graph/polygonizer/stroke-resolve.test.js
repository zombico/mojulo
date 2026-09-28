import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileLayered } from './station-loft.js';
import { frameAt } from './station-loft-detail.js';
import { validateStrokes, resolveStroke, cameraRecord, strokeCamera, viewOf, STROKE_INTENTS } from './stroke-resolve.js';
import { projectVertices } from '../scene/wire-svg.js';

// The two-part recipe station-loft.test.js uses: a 4-slot body over two stations, a spike pinned to a body face.
const body = {
  layer: 1, closure: 'closed', slots: ['top', 'sideR', 'bottom', 'sideL'], group: 'Body',
  stations: [
    { id: 'st0', points: { top: [0, 0, 1], sideR: [1, 0, 0.5], bottom: [0, 0, 0], sideL: [-1, 0, 0.5] } },
    { id: 'st1', points: { top: [0, 1, 1], sideR: [1, 1, 0.5], bottom: [0, 1, 0], sideL: [-1, 1, 0.5] } },
  ],
  caps: { back: [0, -0.5, 0.5], tip: [0, 1.5, 0.5] },
};
const spike = {
  layer: 2, closure: 'closed', group: 'Spike',
  pin: { parent: 'body', face: 'body/st0-st1.k0.a', weights: [1 / 3, 1 / 3, 1 / 3], tangentEdge: ['body/st0.top', 'body/st0.sideR'], handedness: 1 },
  offsets: { b0: [0.1, 0, 0], b1: [0, 0.1, 0], b2: [-0.1, 0, 0], apex: [0, 0, 0.5] },
  faces: { base: ['b0', 'b2', 'b1'], s0: ['b0', 'b1', 'apex'], s1: ['b1', 'b2', 'apex'], s2: ['b2', 'b0', 'apex'] },
};
const recipe = { frame: { up: '+z', front: '+y' }, dials: { width: { min: 0.5, max: 2, rest: 1, op: 'scale', axis: 'x', pivot: 0, parts: ['body'], blend: { st0: 1, st1: 1 } } }, parts: { body, spike } };
const DRAGON = path.resolve(process.cwd(), '../docs/examples/dragon-layered/recipe.json');

/** a stroke through the world points `pts` as seen from `view`, in the camera the stroke records */
const strokeThrough = (mesh, view, pts, extra = {}) => {
  const camera = cameraRecord(mesh, view); const cam = strokeCamera({ view, camera }, mesh);
  const points = projectVertices(pts, cam).map(([x, y]) => [x / cam.size, y / cam.size, 0.7]);
  return { id: 's', view, intent: 'contour', points, camera, ...extra };
};
const dist = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));

describe('stroke-resolve — the stroke as data', () => {
  it('validates the form: ids, views, intents, points in [0, 1]², a closed silhouette of three or more points', () => {
    expect(validateStrokes(undefined)).toEqual([]);
    expect(validateStrokes([{ id: 's1', view: 'frontal', intent: 'contour', points: [[0.1, 0.2], [0.3, 0.4, 0.5]] }])).toEqual([]);
    expect(validateStrokes([{ id: 's1', view: { azimuth: 120 }, intent: 'brush', points: [[0.1, 0.2], [0.3, 0.4]], mirror: true }])).toEqual([]);
    const errs = validateStrokes([
      { id: 'bad id!', view: 'sideways', intent: 'scribble', points: [[1.2, 0]] },
      { id: 's2', view: 'frontal', intent: 'silhouette', points: [[0, 0], [1, 1]] },
      { id: 's2', view: 'frontal', intent: 'contour', points: [[0, 0], [0.5, 0.5, 2]], mirror: 'yes' },
    ]);
    expect(errs.join('\n')).toMatch(/strokes\[0\]\.id/); expect(errs.join('\n')).toMatch(/strokes\[0\]\.view/); expect(errs.join('\n')).toMatch(new RegExp(STROKE_INTENTS.join(', ')));
    expect(errs.join('\n')).toMatch(/at least two/); expect(errs.join('\n')).toMatch(/silhouette needs at least three/); expect(errs.join('\n')).toMatch(/carried twice/);
    expect(errs.join('\n')).toMatch(/pressure in \[0, 1\]/); expect(errs.join('\n')).toMatch(/mirror: true or false/);
    expect(validateStrokes('no')).toHaveLength(1);
    expect(viewOf('lateral').azimuth).toBe(90); expect(() => viewOf('up')).toThrow(/one of/);
  });

  it('round trip: a point drawn where an address projects resolves back to that address and its world point (≤ 1 cm on a metre body)', () => {
    const mesh = compileLayered(recipe, {}, { details: false });
    for (const [at, side, view] of [[[0.4, 0.6], 'R', 'lateral'], [[0.7, 1.3], 'R', 'lateral'], [[0.4, 0.6], 'L', 'left'], [[0.5, 0.2], 'R', 'three-quarter']]) {
      const origin = frameAt(mesh.parts, 'body', at, side).origin;
      const r = resolveStroke(mesh, strokeThrough(mesh, view, [origin]));
      const h = r.addresses[0].hit;
      expect(h, `${view} ${side} ${at}`).toBeTruthy(); expect(h.part).toBe('body'); expect(h.layer).toBe(1); expect(h.side).toBe(side);
      expect(dist(h.world, origin)).toBeLessThan(0.01);
      expect(Math.abs(h.s - at[0])).toBeLessThan(0.02); expect(Math.abs(h.t - at[1])).toBeLessThan(0.02);
    }
  });

  it('mirror lands by name: the twin address is the same (s, t) on the other side, its world point x-negated', () => {
    const mesh = compileLayered(recipe, {}, { details: false }); const origin = frameAt(mesh.parts, 'body', [0.4, 0.6], 'R').origin;
    const r = resolveStroke(mesh, strokeThrough(mesh, 'lateral', [origin], { mirror: true }));
    const twin = r.mirrored[0].hit; expect(twin.side).toBe('L'); expect(twin.s).toBe(r.addresses[0].hit.s); expect(twin.t).toBe(r.addresses[0].hit.t);
    expect(dist(twin.world, frameAt(mesh.parts, 'body', [0.4, 0.6], 'L').origin)).toBeLessThan(0.01);
  });

  it('a point off the solid is a miss and stays in view space; a hit on a pinned detail names the detail and its carrier address', () => {
    const mesh = compileLayered(recipe);
    // a point on the spike's axis, halfway up: inside its silhouette from any side (an edge midpoint would sit ON the outline)
    const P = mesh.parts.spike.points; const base = ['b0', 'b1', 'b2'].map((k) => P[k]).reduce((a, p) => a.map((v, i) => v + p[i] / 3), [0, 0, 0]);
    const mid = P.apex.map((v, i) => (v + base[i]) / 2);
    const s = strokeThrough(mesh, 'lateral', [mid]); s.points.push([0.01, 0.01, 0.5]);
    const r = resolveStroke(mesh, s);
    expect(r.hits).toBe(1); expect(r.misses).toBe(1); expect(r.addresses[1].hit).toBeNull(); expect(r.addresses[1].x).toBe(0.01);
    const h = r.addresses[0].hit; expect(h.via).toBe('spike'); expect(h.part).toBe('body'); expect(h.layer).toBe(2); expect(h.side).toBe('R');
    expect(Number.isFinite(h.s) && Number.isFinite(h.t)).toBe(true);
  });

  it('the recorded camera keeps a stroke where it was drawn after the form changes', () => {
    const mesh = compileLayered(recipe, {}, { details: false }); const origin = frameAt(mesh.parts, 'body', [0.4, 0.6], 'R').origin;
    const s = strokeThrough(mesh, 'lateral', [origin]);
    const wide = compileLayered(recipe, { width: 1.8 }, { details: false });
    // the same stroke on the widened body: the camera is the recorded one, so its image point is unchanged and it
    // lands where that ray now meets the wider surface — a different (s, t), the same view
    const r = resolveStroke(wide, s); expect(r.camera.target).toEqual(s.camera.target); expect(r.camera.distance).toBe(s.camera.distance);
    const fresh = resolveStroke(wide, { ...s, camera: undefined }); expect(fresh.camera.distance).not.toBe(s.camera.distance);
  });

  const dragon = existsSync(DRAGON) ? it : it.skip;
  dragon('the dragon head: a cranium address round-trips within 2 mm at 512, and the resolve is deterministic', () => {
    const R = JSON.parse(readFileSync(DRAGON, 'utf8')); const mesh = compileLayered(R, {}, { details: false });
    const part = mesh.parts.cranium; const U = part.stations.map((st, i) => st.u ?? i); const sMid = (U[0] + U[U.length - 1]) / 2;
    const half = part.slots.length / 2; const tMid = half / 2;
    const origin = frameAt(mesh.parts, 'cranium', [sMid, tMid], 'R').origin;
    const s = strokeThrough(mesh, 'three-quarter', [origin]);
    const a = resolveStroke(mesh, s), b = resolveStroke(mesh, s);
    expect(a.addresses[0].hit?.part).toBe('cranium'); expect(dist(a.addresses[0].hit.world, origin)).toBeLessThan(0.002);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
