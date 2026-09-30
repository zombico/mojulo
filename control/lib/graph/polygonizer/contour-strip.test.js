import { describe, expect, it } from 'vitest';

import { compileLayered, auditLayered } from './station-loft.js';
import { frameAt } from './station-loft-detail.js';
import { resolveStroke, cameraRecord, strokeCamera } from './stroke-resolve.js';
import { contourStripParts, contourRun, partsFrom, STRIP_PREFIX } from './contour-strip.js';
import { layeredExposure } from './station-loft-exposure.js';
import { projectVertices } from '../scene/wire-svg.js';

const body = {
  layer: 1, closure: 'closed', slots: ['top', 'sideR', 'bottom', 'sideL'], group: 'Body',
  stations: [
    { id: 'st0', points: { top: [0, 0, 1], sideR: [1, 0, 0.5], bottom: [0, 0, 0], sideL: [-1, 0, 0.5] } },
    { id: 'st1', points: { top: [0, 1, 1], sideR: [1, 1, 0.5], bottom: [0, 1, 0], sideL: [-1, 1, 0.5] } },
    { id: 'st2', points: { top: [0, 2, 1], sideR: [1, 2, 0.5], bottom: [0, 2, 0], sideL: [-1, 2, 0.5] } },
  ],
  caps: { back: [0, -0.5, 0.5], tip: [0, 2.5, 0.5] },
};
const recipe = { frame: { up: '+z', front: '+y' }, dials: { width: { min: 0.5, max: 2, rest: 1, op: 'scale', axis: 'x', pivot: 0, parts: ['body'], blend: { st0: 1, st1: 1, st2: 1 } } }, parts: { body } };

/** a contour through body addresses `ats` on `side`, drawn in `view` on the mesh at `dials` */
function contour(dials, view, ats, side = 'R', extra = {}) {
  const mesh = compileLayered(recipe, dials); const camera = cameraRecord(mesh, view); const cam = strokeCamera({ view, camera }, mesh);
  const pts = projectVertices(ats.map((at) => frameAt(mesh.parts, 'body', at, side).origin), cam).map(([x, y]) => [x / cam.size, y / cam.size, 0.8]);
  const stroke = { id: 'c1', view, intent: 'contour', points: pts, camera, ...extra };
  return { mesh, stroke, resolved: resolveStroke(mesh, stroke) };
}
const ATS = [[0.2, 0.5], [0.6, 0.5], [1.0, 0.5], [1.4, 0.5], [1.8, 0.5]];

describe('contour-strip — a contour stroke becomes a surface strip', () => {
  it('contourRun: the majority carrier, its side, the de-duplicated (s, t) run; nothing under the stroke refuses by name', () => {
    const { resolved } = contour({}, 'lateral', ATS);
    const run = contourRun(resolved, 'c1'); expect(run.carrier).toBe('body'); expect(run.side).toBe('R'); expect(run.run.length).toBe(5);
    expect(() => contourRun({ addresses: [{ x: 0, y: 0, hit: null }] }, 'c1')).toThrow(/no-surface-under-stroke: stroke 'c1' touches no part/);
  });

  it('builds a closed layer-2 strip pinned to the carrier, riding it under a dial (follow); mirror adds the twin by name', () => {
    const { mesh, stroke, resolved } = contour({}, 'lateral', ATS);
    const made = contourStripParts(mesh, stroke, resolved);
    expect(made.names).toEqual([`${STRIP_PREFIX}c1R`]); const P = made.parts[`${STRIP_PREFIX}c1R`];
    expect(P).toMatchObject({ layer: 2, closure: 'closed', from: 'c1', follow: true }); expect(P.pin.parent).toBe('body'); expect(Object.keys(P.faces).length).toBeGreaterThan(8);
    const withStrip = { ...recipe, parts: { ...recipe.parts, ...made.parts } };
    const m = compileLayered(withStrip); const audit = auditLayered(m); expect(audit[`${STRIP_PREFIX}c1R`].pass).toBe(true);
    // the strip sits on the surface: its points are within a few centimetres of the body's right flank (x ≈ 0.5..1)
    for (const p of Object.values(m.parts[`${STRIP_PREFIX}c1R`].points)) { expect(p[0]).toBeGreaterThan(0.3); expect(p[0]).toBeLessThan(1.1); }
    expect(partsFrom(withStrip, 'c1')).toEqual([`${STRIP_PREFIX}c1R`]);
    // follow: widening the body (x scaled about 0) carries the strip outward with the flank
    const restX = Math.max(...Object.values(m.parts[`${STRIP_PREFIX}c1R`].points).map((p) => p[0]));
    const wide = compileLayered(withStrip, { width: 1.8 }); const wideX = Math.max(...Object.values(wide.parts[`${STRIP_PREFIX}c1R`].points).map((p) => p[0]));
    expect(wideX / restX).toBeGreaterThan(1.5); expect(wideX / restX).toBeLessThan(1.9);
    const twin = contourStripParts(mesh, { ...stroke, mirror: true }, resolved);
    expect(twin.names).toEqual([`${STRIP_PREFIX}c1R`, `${STRIP_PREFIX}c1L`]);
    const both = compileLayered({ ...recipe, parts: { ...recipe.parts, ...twin.parts } });
    const l = Object.values(both.parts[`${STRIP_PREFIX}c1L`].points), r = Object.values(both.parts[`${STRIP_PREFIX}c1R`].points);
    expect(l.length).toBe(r.length); for (const p of l) expect(p[0]).toBeLessThan(-0.3);
  });

  it('the strip reads from the view it was drawn in; height follows the ask and the pressure', () => {
    const { mesh, stroke, resolved } = contour({}, 'lateral', ATS);
    const tall = contourStripParts(mesh, stroke, resolved, { height: 0.08 }); const low = contourStripParts(mesh, stroke, resolved, { height: 0.02 });
    expect(tall.height).toBe(0.08); expect(low.height).toBe(0.02);
    const m = compileLayered({ ...recipe, parts: { ...recipe.parts, ...tall.parts } });
    const E = layeredExposure(m, { views: ['lateral'], res: 256 }); expect(E.parts[`${STRIP_PREFIX}c1R`].flag).toBe('reads');
    const zTall = Math.max(...Object.values(m.parts[`${STRIP_PREFIX}c1R`].points).map((p) => p[0]));
    const m2 = compileLayered({ ...recipe, parts: { ...recipe.parts, ...low.parts } }); const zLow = Math.max(...Object.values(m2.parts[`${STRIP_PREFIX}c1R`].points).map((p) => p[0]));
    expect(zTall).toBeGreaterThan(zLow);
    const a = contourStripParts(mesh, stroke, resolved), b = contourStripParts(mesh, stroke, resolved); expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
