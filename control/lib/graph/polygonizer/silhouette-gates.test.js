import { describe, it, expect } from 'vitest';
import { figureMask, keepsSilhouette, distinctSilhouettes, heightFrame } from './silhouette-gates.js';

// a closed box [x0, x1] × [y0, y1] × [z0, z1] as twelve triangles
function box([x0, x1], [y0, y1], [z0, z1]) {
  const vertices = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
  const faces = [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]];
  return { vertices, faces };
}
const join = (...ms) => { const vertices = [], faces = []; for (const m of ms) { const b = vertices.length; vertices.push(...m.vertices); faces.push(...m.faces.map((f) => f.map((i) => i + b))); } return { vertices, faces }; };
// a standing figure: two legs, a trunk, a head; `lean` pushes the trunk and head forward (+y), `broad` widens the trunk
const figure = ({ lean = 0, broad = 1, tall = 1 } = {}) => join(
  box([-0.2, -0.05], [-0.08, 0.08], [0, 0.9 * tall]), box([0.05, 0.2], [-0.08, 0.08], [0, 0.9 * tall]),
  box([-0.25 * broad, 0.25 * broad], [-0.12 + lean, 0.12 + lean], [0.9 * tall, 1.5 * tall]), box([-0.1, 0.1], [-0.1 + 1.6 * lean, 0.12 + 1.6 * lean], [1.5 * tall, 1.75 * tall]));

describe('silhouette gates', () => {
  it('draws the outline from each view: the front shows the width, the side the depth', () => {
    const f = figure(), front = figureMask(f, 180, { res: 64 }), side = figureMask(f, 90, { res: 64 });
    const sum = (m) => m.reduce((t, v) => t + v, 0);
    expect(sum(front)).toBeGreaterThan(sum(side));
    // the feet sit on the bottom row of the figure's own frame
    expect([...front.slice(0, 64)].some((v) => v)).toBe(true);
    expect(heightFrame(f, 180).height).toBeCloseTo(1.75, 6);
  });

  it('the TEST gate: the same figure keeps its outline exactly; a lean or a change of size breaks it, the worst view named', () => {
    const f = figure();
    expect(keepsSilhouette(f, f)).toEqual({ ok: true, min: 0.95, views: { front: 1, 'three-quarter': 1, side: 1 }, worst: { view: 'front', iou: 1 } });
    const leant = keepsSilhouette(f, figure({ lean: 0.15 }));
    expect(leant.ok).toBe(false);
    expect(leant.worst.view).toBe('side');
    // drawn in the reference's metres: the same shape 20 % taller is a different outline
    expect(keepsSilhouette(f, figure({ tall: 1.2 })).ok).toBe(false);
  });

  it('the PRODUCTION gate: composed figures must differ; two of one body fail it, the most alike pair named', () => {
    const same = distinctSilhouettes({ a: figure(), b: figure(), c: figure({ broad: 1.6, lean: 0.1 }) });
    expect(same.ok).toBe(false);
    expect(same.mostAlike).toMatchObject({ a: 'a', b: 'b', iou: 1 });
    // read by shape: the same figure scaled whole is still the same outline; stretched only in height it is not
    const scaled = (m, s) => ({ ...m, vertices: m.vertices.map((p) => p.map((x) => x * s)) });
    expect(distinctSilhouettes({ a: figure(), b: scaled(figure(), 1.3) }).pairs[0].iou).toBeGreaterThan(0.95);
    expect(distinctSilhouettes({ a: figure(), b: figure({ tall: 1.3 }) }).pairs[0].iou).toBeLessThan(0.9);
    const varied = distinctSilhouettes({ a: figure(), c: figure({ broad: 1.6, lean: 0.1 }) }, { ceiling: 0.8 });
    expect(varied.ok).toBe(true);
    expect(varied.heights.a).toBeCloseTo(1.75, 6);
  });
});
