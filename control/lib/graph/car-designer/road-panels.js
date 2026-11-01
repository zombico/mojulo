/**
 * THE PANELS in the form render (road-form.js): a realistic loft's body parted into the panels a car is built from, and
 * the fittings that sit on them. Read from the faces themselves (the glasshouse already set, road-glass.js), so it holds
 * for any loft:
 *
 *   shut lines   the gaps between panels, cut into the paint by planes (each a strip of the body's own surface, so it
 *                lies on it exactly and nothing is added over it): a door's front and rear edge down each side at the
 *                glass's own joints, the bonnet's gap at the cowl and along each fender, the boot lid's at the rear
 *                glass and along each quarter
 *   handles      a pull on each door, below the belt at its rear edge: a dark pocket (a classic three-box's in chrome)
 *   mirrors      a housing on each front door at the screen's foot, in the body's paint, its glass facing back
 *   plates       a number plate on each end, low and centred
 *   patch        a battered car's patched panel: a whole door in primer (no clearcoat), one side, by its seed
 *
 *   panels(faces, { body, chrome?, battered?, seed?, W }) → the faces cut at their shut lines, with the fittings added
 *
 * Vehicle space (+y forward, x across, z up), metres. Pure and deterministic.
 */
import { cutPlane, paneJoints } from './road-glass.js';

export const PANELS = Object.freeze({
  gap: 0.01,          // a shut line's width (m)
  handle: [0.14, 0.032],   // a door pull's length along the door and its height (m)
  mirror: [0.16, 0.12, 0.09],   // a mirror housing: out from the door, along it, its height (m)
  plate: [0.52, 0.11],      // a number plate's width and height (m)
});
const SEAM = '#0f1012', POCKET = '#16181b', CHROME = '#c9ccd0', PLATE = '#e7e5dc', PRIMER = '#a39a86', MIRROR = '#aab4bc';

const centroid = (c) => c.reduce((s, p) => [s[0] + p[0] / c.length, s[1] + p[1] / c.length, s[2] + p[2] / c.length], [0, 0, 0]);
const like = (f, corners, extra) => ({ ...f, corners, ...extra });
const isBody = (f) => f.material === 'paint' && ['body', 'roof', 'patch'].includes(f.part);

/** Cut every face `pick` takes at the strip between planes axis = c ± gap/2: the strip a shut line, the rest as it was. */
function cutStrip(faces, pick, axis, c, gap = PANELS.gap) {
  return faces.flatMap((f) => {
    if (!pick(f)) return [f];
    const [below, rest] = cutPlane(f.corners, axis, c - gap / 2);
    const [mid, above] = rest ? cutPlane(rest, axis, c + gap / 2) : [null, null];
    return [below && like(f, below), mid && like(f, mid, { part: 'seam', material: 'seal', albedo: SEAM }), above && like(f, above)].filter(Boolean);
  });
}

// the point on a side's paint at (y, z): the face whose outline (seen from the side) holds it, its plane solved for x
function sideAt(faces, sx, y, z) {
  for (const f of faces) {
    if (!isBody(f) || Math.sign(f.outNormal[0]) !== sx || Math.abs(f.outNormal[0]) < 0.5) continue;
    const c = f.corners;
    let inside = false;
    for (let i = 0, j = c.length - 1; i < c.length; j = i++) {
      if ((c[i][2] > z) !== (c[j][2] > z) && y < ((c[j][1] - c[i][1]) * (z - c[i][2])) / (c[j][2] - c[i][2]) + c[i][1]) inside = !inside;
    }
    if (!inside) continue;
    const n = f.outNormal, p = c[0];
    return { x: p[0] - (n[1] * (y - p[1]) + n[2] * (z - p[2])) / n[0], n };
  }
  return null;
}
// the end's face at (x = 0, z): the frontmost (sy +1) or rearmost (sy −1) point of the faces facing that way there
function endAt(faces, sy, z) {
  let best = null;
  for (const f of faces) {
    if (Math.sign(f.outNormal[1]) !== sy || Math.abs(f.outNormal[1]) < 0.5 || f.material === 'glass') continue;
    const zs = f.corners.map((p) => p[2]), xs = f.corners.map((p) => p[0]);
    if (z < Math.min(...zs) || z > Math.max(...zs) || Math.min(...xs) > 0 || Math.max(...xs) < 0) continue;
    const n = f.outNormal, p = f.corners[0], y = p[1] - (n[0] * (0 - p[0]) + n[2] * (z - p[2])) / n[1];
    if (best === null || y * sy > best * sy) best = y;
  }
  return best;
}
// a box from its eight corners' extents in a frame: centre, unit axes u (along), v (out), w (up), half sizes
function box(at, u, v, w, [hu, hv, hw], make) {
  const P = (a, b, c) => [at[0] + u[0] * a + v[0] * b + w[0] * c, at[1] + u[1] * a + v[1] * b + w[1] * c, at[2] + u[2] * a + v[2] * b + w[2] * c];
  const sides = [
    ['out', [P(-hu, hv, -hw), P(hu, hv, -hw), P(hu, hv, hw), P(-hu, hv, hw)], v],
    ['top', [P(-hu, -hv, hw), P(-hu, hv, hw), P(hu, hv, hw), P(hu, -hv, hw)], w],
    ['bottom', [P(-hu, -hv, -hw), P(hu, -hv, -hw), P(hu, hv, -hw), P(-hu, hv, -hw)], w.map((x) => -x)],
    ['front', [P(hu, -hv, -hw), P(hu, -hv, hw), P(hu, hv, hw), P(hu, hv, -hw)], u],
    ['back', [P(-hu, -hv, -hw), P(-hu, hv, -hw), P(-hu, hv, hw), P(-hu, -hv, hw)], u.map((x) => -x)],
  ];
  return sides.map(([side, corners, n]) => make(side, corners, n));
}

/** The panels: shut lines cut into the body's paint, the fittings set on it, a battered car's door in primer. */
export function panels(faces, { body = '#8a8f96', chrome = false, battered = false, seed = 1, W = 1.8 } = {}) {
  let F = faces;
  const glass = F.filter((f) => f.material === 'glass');
  const added = [];
  // ── each side: its doors' shut lines at the glass's own joints and ends, a pull on each door, a mirror on the front
  const doorsBy = {};
  for (const sx of [-1, 1]) {
    // (the side's glass as the glasshouse parted it: its panes, their frames and pillars; a cargo van's is its cab's)
    const side = F.filter((f) => (f.material === 'glass' || f.part === 'pillar' || f.part === 'glass.frame') && Math.sign(f.outNormal[0]) === sx && Math.abs(f.outNormal[0]) > 0.6);
    if (!side.length) continue;
    const ys = side.flatMap((f) => f.corners.map((p) => p[1])), zs = side.flatMap((f) => f.corners.map((p) => p[2]));
    const y0 = Math.min(...ys), y1 = Math.max(...ys), belt = Math.min(...zs);
    // (the doors' joints are the glasshouse's own: road-glass.js paneJoints)
    const edges = [y1, ...paneJoints(y0, y1), y0];
    doorsBy[sx] = { edges, belt };
    for (const y of edges) F = cutStrip(F, (f) => isBody(f) && Math.sign(f.outNormal[0]) === sx && Math.abs(f.outNormal[0]) > 0.5 && centroid(f.corners)[2] < belt && centroid(f.corners)[2] > 0.18, 1, y);
    // a pull on each door, at its rear edge below the belt
    for (let i = 0; i + 1 < edges.length; i++) {
      const y = edges[i + 1] + 0.16, z = belt - 0.1, at = sideAt(F, sx, y, z);
      if (!at) continue;
      const [hl, hh] = PANELS.handle.map((v) => v / 2), x = at.x + sx * 0.006;
      added.push({ corners: [[x, y - hl, z - hh], [x, y + hl, z - hh], [x, y + hl, z + hh], [x, y - hl, z + hh]], part: 'door.handle', material: chrome ? 'alloy' : 'carbon', albedo: chrome ? CHROME : POCKET, outNormal: [sx, 0, 0] });
    }
    // a mirror on the front door, at the screen's foot
    const my = y1 - 0.08, mz = belt + 0.07, at = sideAt(F, sx, my, belt - 0.03);
    if (at) {
      const [mo, ml, mh] = PANELS.mirror, centre = [at.x + sx * (mo / 2), my, mz];
      added.push(...box(centre, [0, 1, 0], [sx, 0, 0], [0, 0, 1], [ml / 2, mo / 2, mh / 2], (s, corners, n) => (s === 'back'
        ? { corners, part: 'mirror.glass', material: 'alloy', albedo: MIRROR, outNormal: n }
        : { corners, part: 'mirror', material: 'paint', albedo: body, outNormal: n })));
    }
  }
  // ── the bonnet and the boot lid: a gap across at the screen's foot and the rear glass's, and along each fender
  const top = (f) => isBody(f) && f.outNormal[2] > 0.45;
  const screen = glass.filter((f) => f.outNormal[1] > 0.25 && f.outNormal[2] > 0.25), rear = glass.filter((f) => f.outNormal[1] < -0.25 && f.outNormal[2] > 0.25);
  const tops = F.filter(top), front = tops.length ? Math.max(...tops.flatMap((f) => f.corners.map((p) => p[1]))) : null, back = tops.length ? Math.min(...tops.flatMap((f) => f.corners.map((p) => p[1]))) : null;
  const lid = (from, to) => (f) => { const y = centroid(f.corners)[1]; return top(f) && y > Math.min(from, to) && y < Math.max(from, to); };
  if (screen.length && front !== null) {
    const cowl = Math.max(...screen.flatMap((f) => f.corners.map((p) => p[1]))) + 0.04;
    if (front - cowl > 0.4) {
      F = cutStrip(F, top, 1, cowl);
      for (const sx of [-1, 1]) F = cutStrip(F, lid(cowl, front), 0, sx * W * 0.39);
    }
  }
  if (rear.length && back !== null) {
    const sill = Math.min(...rear.flatMap((f) => f.corners.map((p) => p[1]))) - 0.04;
    if (sill - back > 0.3) {
      F = cutStrip(F, top, 1, sill);
      for (const sx of [-1, 1]) F = cutStrip(F, lid(sill, back), 0, sx * W * 0.4);
    }
  }
  // ── a plate on each end, low and centred, just proud of it
  for (const sy of [1, -1]) {
    const z = sy > 0 ? 0.36 : 0.52, y = endAt(F, sy, z);
    if (y === null) continue;
    const [pw, ph] = PANELS.plate.map((v) => v / 2), yy = y + sy * 0.012;
    added.push({ corners: [[-pw, yy, z - ph], [pw, yy, z - ph], [pw, yy, z + ph], [-pw, yy, z + ph]], part: 'plate', material: 'plate', albedo: PLATE, outNormal: [0, sy, 0] });
  }
  // ── a battered car's patched panel: one front door in primer, the side its seed's
  if (battered) {
    const sx = seed % 2 ? 1 : -1, D = doorsBy[sx];
    if (D && D.edges.length > 1) {
      const [ya, yb] = [D.edges[1], D.edges[0]];
      F = F.map((f) => {
        if (!isBody(f) || Math.sign(f.outNormal[0]) !== sx || Math.abs(f.outNormal[0]) < 0.5) return f;
        const c = centroid(f.corners);
        return c[1] > ya + PANELS.gap && c[1] < yb - PANELS.gap && c[2] < D.belt && c[2] > 0.18 ? like(f, f.corners, { part: 'patch', material: 'primer', albedo: PRIMER }) : f;
      });
    }
  }
  return [...F, ...added];
}
