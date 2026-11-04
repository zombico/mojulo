/**
 * catenary — the overhead line a pantograph reaches: a stretch of contact wire over a track, hung from its messenger by
 * droppers, the messenger carried on cantilevers from masts beside the track, the contact wire staggered side to side
 * from mast to mast (so it wears a pantograph's strips across their width). A tramway's is a single wire on its spans.
 * Named quads (rail-geom.js). Pure and deterministic. Generic.
 *
 *   compileCatenary({ length, height, kind: 'simple' | 'tram', span, stagger, side, quality }) → { faces: { masts, wires },
 *                                                                        hardpoints: { wire: [z], masts: [[x, y]…] }, census }
 *     height   the contact wire over the rail (m); span the masts' spacing; stagger the wire's swing either side of the
 *              track's centre; side the masts' side (+1 right, −1 left)
 *   wireAt(catenary, y) → the contact wire's x at y (its stagger), for a pantograph to read where on its strips it bears
 *
 * Track space: +y along it, x across from its centre, z up from the rail.
 */
import { r4, box, cylinder, revolve, finishRailFaces } from './rail-geom.js';

const COLOURS = Object.freeze({ mast: '#8b9095', arm: '#9aa0a5', wire: '#b77a4a', messenger: '#7b7f82', insulator: '#c9c3b6' });

export function wireAt(c, y) {
  const s = c.span, k = ((y - c.y0) / s) % 2, t = k < 0 ? k + 2 : k;
  return r4(c.stagger * (t < 1 ? 1 - 2 * t : 2 * t - 3));
}

export function compileCatenary({ length = 60, height = 5.2, kind = 'simple', span = 30, stagger = 0.2, side = 1, quality = 'studio', y0 } = {}) {
  if (!['simple', 'tram'].includes(kind)) throw new Error('rail-catenary: kind is simple or tram');
  if (!(height > 3.5 && height < 7.5)) throw new Error('rail-catenary: height must be in (3.5, 7.5)');
  const n = quality === 'game' ? 6 : quality === 'hero' ? 12 : 8, start = y0 ?? -length / 2, masts = [], wires = [], spans = Math.max(1, Math.round(length / span));
  const c = { span, stagger, y0: start, kind, height };
  const xm = side * 3.1, sys = kind === 'simple' ? 1.1 : 0;
  const ys = Array.from({ length: spans + 1 }, (_, i) => start + i * span);
  for (const y of ys) {
    // (the mast, its cantilever out over the track, its insulators)
    box(masts, [xm - 0.12, xm + 0.12], [y - 0.12, y + 0.12], [-0.3, height + sys + 0.8], 'catenary.mast');
    const xw = wireAt(c, y);
    cylinder(masts, [xm, y, height + sys + 0.35], [xw, y, height + sys + 0.05], 0.035, n, 'catenary.arm');
    cylinder(masts, [xm, y, height + 0.3], [xw, y, height + 0.04], 0.03, n, 'catenary.arm');
    revolve(masts, [[height + sys + 0.42, 0], [height + sys + 0.42, 0.05], [height + sys + 0.5, 0.08], [height + sys + 0.58, 0.05], [height + sys + 0.66, 0.08], [height + sys + 0.74, 0.05], [height + sys + 0.74, 0]], { axis: 'z', at: [xm - side * 0.35, y], n, partOf: () => 'catenary.insulator' });
  }
  // the contact wire, straight between its staggered points; its messenger sagging over it; droppers between them
  for (let i = 0; i + 1 < ys.length; i += 1) {
    const a = ys[i], b = ys[i + 1];
    cylinder(wires, [wireAt(c, a), a, height], [wireAt(c, b), b, height], 0.008, 6, 'catenary.wire', { caps: false });
    if (kind === 'simple') {
      const m = 6, sag = (t) => height + sys - 0.9 * 4 * t * (1 - t);
      for (let k = 0; k < m; k += 1) {
        const t0 = k / m, t1 = (k + 1) / m, x0 = wireAt(c, a + t0 * (b - a)), x1 = wireAt(c, a + t1 * (b - a));
        cylinder(wires, [x0, a + t0 * (b - a), sag(t0)], [x1, a + t1 * (b - a), sag(t1)], 0.007, 5, 'catenary.messenger', { caps: false });
        if (k) cylinder(wires, [x0, a + t0 * (b - a), sag(t0)], [x0, a + t0 * (b - a), height], 0.004, 4, 'catenary.messenger', { caps: false });
      }
    }
  }
  const colour = (p) => ({ 'catenary.mast': COLOURS.mast, 'catenary.arm': COLOURS.arm, 'catenary.wire': COLOURS.wire, 'catenary.messenger': COLOURS.messenger, 'catenary.insulator': COLOURS.insulator }[p]);
  const faces = { masts: finishRailFaces(masts.map((f) => ({ ...f, fill: colour(f.part) }))), wires: finishRailFaces(wires.map((f) => ({ ...f, fill: colour(f.part) }))) };
  const all = [...faces.masts, ...faces.wires];
  return { ...c, faces, hardpoints: { wire: height, masts: ys.map((y) => [xm, r4(y)]) }, census: { faces: all.length, triangles: all.reduce((t, f) => t + f.corners.length - 2, 0) } };
}
