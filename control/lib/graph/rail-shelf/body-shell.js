/**
 * body-shell — a railway car's body as its section extruded: shared by the cab car (cab-surface.js) and the cars behind
 * it (car-surface.js), so a train's cars are drawn the same way and their sides meet at the same heights. Pure.
 *
 *   sectionRows(d, LOD, snaps)       the rows up the section (the side to the cant rail, round it by angle, over the roof
 *                                    by angle), snapped to every height a part needs (the design's frame and section)
 *   windowLights(d, { ends, doors, louvres })  the window lights along a side: runs between the ends and the doors,
 *                                    each run parted into lights a bay long (a band's longer, `bays` shorter); a
 *                                    locomotive's louvres instead, `louvres` (their places)
 *   sideParts({ … })                 what a side's quad is, read off its middle: a door, its window and its seams; the
 *                                    driver's side window; a window light (or a louvre); the livery band, the roof, the
 *                                    skirt, the paint; and `common(z)`, the band, roof, skirt or paint alone
 *   extrudeSides(push, d, Y, Z, part, inside)   both sides' quads between the stations Y and the rows Z
 *   endWall(push, d, Z, y, part, from)          a flat end across the section at y, in strips between the rows' pairs
 *   articulationRing(push, d, y, s, depth)      a streetcar's articulation bellows at a body's end
 *   samples(base, snaps, lo, hi, gap)            sorted, deduped samples: the base spacing and every boundary
 *   openings(d)                      a passenger body's openings, read off its design: its livery band, its window
 *                                    band, its doors' tops and places, its window lights, a cab car's side window
 *                                    (the body's sides and its interior's lining are cut by the same openings)
 *   endsOf(d)                        what a body's ends carry: a car's its kind at both; a cab car's at its rear (buffers
 *                                    on a locomotive, a streetcar's articulation, a unit's gangway)
 *
 * Coordinates: +y forward, +x right, z up from the rail.
 */
import { halfWidthAt } from './cab-odm.js';
import { r4, face } from './rail-geom.js';

export const samples = (base, snaps, lo, hi, gap) => [...base, ...snaps].filter((v) => v >= lo - 1e-9 && v <= hi + 1e-9).map((v) => Math.min(hi, Math.max(lo, v))).sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > gap);

export function sectionRows(d, LOD, snaps) {
  const S = d.section, H = d.frame.height, zr = S.zc + S.radius;
  const R = LOD.rows, n1 = Math.round(R * 0.55), n2 = Math.round(R * 0.2), n3 = R - n1 - n2;
  const base = [
    ...Array.from({ length: n1 + 1 }, (_, k) => S.z0 + ((S.zc - S.z0) * k) / n1),
    ...Array.from({ length: n2 }, (_, k) => S.zc + S.radius * Math.sin(((k + 1) / n2) * (Math.PI / 2))),
    ...Array.from({ length: n3 }, (_, k) => zr + (H - zr) * Math.sin(((k + 1) / n3) * (Math.PI / 2))),
  ];
  return samples(base, snaps, S.z0, H, 0.012);
}

export function windowLights(d, { ends: [e0, e1], doors, louvres = null }) {
  const lights = [];
  if (louvres) { for (const [a, b] of louvres) lights.push([r4(a), r4(b)]); return lights; }
  const runs = [], edges = [e0, ...doors.flat(), e1].sort((a, b) => a - b);
  for (let i = 0; i + 1 < edges.length; i += 2) runs.push([edges[i] + 0.35, edges[i + 1] - 0.35]);
  for (const [a, b] of runs) {
    if (b - a < 0.8) continue;
    const bay = d.windows === 'bays' ? 1.5 : 1.7, n = Math.max(1, Math.round((b - a) / bay)), step = (b - a) / n;
    for (let k = 0; k < n; k += 1) lights.push([r4(a + k * step + (k ? 0.06 : 0)), r4(a + (k + 1) * step - (k < n - 1 ? 0.06 : 0))]);
  }
  return lights;
}

export function openings(d) {
  const { length: L, floor } = d.frame, S = d.section, y0 = -L / 2;
  const band = [r4(S.zw - 0.05), r4(S.zw + 0.12)], win = [r4(floor + 0.85), r4(floor + 1.92)], doorTop = floor + d.doors.height;
  const doors = d.doors.at.map((y) => [r4(y - d.doors.width / 2), r4(y + d.doors.width / 2)]);
  if (!d.front) return { band, win, doorTop, doors, cabW: null, lights: windowLights(d, { ends: [y0 + 1.0, L / 2 - 1.0], doors }) };
  const root = d.front.root, cabW = d.cabWindow ? [r4(root - 0.6 - d.cabWindow), r4(root - 0.6)] : null;
  const lights = windowLights(d, { ends: [y0 + 1.0, (cabW ? cabW[0] : root) - 0.5], doors,
    louvres: d.windows === 'louvres' ? Array.from({ length: 5 }, (_, k) => root - 3.2 - k * 2.4).filter((y) => y > y0 + 1.5).map((y) => [y - 0.9, y]) : null });
  return { band, win, doorTop, doors, cabW, lights };
}

export function endsOf(d) {
  if (!d.front) return { front: d.ends, rear: d.ends };
  return { front: null, rear: d.anchors.coupler.kind === 'buffers' ? 'buffers' : d.archetype === 'tram' ? 'articulated' : 'gangway' };
}

export function sideParts({ floor, doorTop, win, band, zr, doors, lights, gap = 0.02, cabW = null, screen = null, louvres = false }) {
  const inAny = (v, R2) => R2.some(([a, b]) => v > a && v < b);
  const common = (z) => (z > band[0] && z < band[1] ? 'livery.band' : z > zr - 0.02 ? 'body.roof' : z < floor - 0.05 ? 'body.skirt' : 'body.paint');
  const part = (y, z) => {
    for (const [a, b] of doors) if (y > a && y < b && z > floor + 0.02 && z < doorTop) return y < a + gap || y > b - gap ? 'seam' : z > win[0] && z < win[1] - 0.1 ? 'glass.door' : 'door';
    if (cabW && y > cabW[0] && y < cabW[1] && z > screen.z0 && z < screen.z1 - 0.12) return 'glass.cab';
    if (z > win[0] && z < win[1] && inAny(y, lights)) return louvres ? 'grille' : 'glass.side';
    return common(z);
  };
  return { common, part };
}

export function extrudeSides(push, d, Y, Z, part, inside) {
  const hw = (z) => halfWidthAt(d, z);
  for (const sx of [1, -1]) for (let i = 0; i + 1 < Y.length; i += 1) for (let k = 0; k + 1 < Z.length; k += 1) {
    const [y0, y1, z0, z1] = [Y[i], Y[i + 1], Z[k], Z[k + 1]], q = [[sx * hw(z0), y0, z0], [sx * hw(z0), y1, z0], [sx * hw(z1), y1, z1], [sx * hw(z1), y0, z1]];
    push(face(q, part((y0 + y1) / 2, (z0 + z1) / 2), inside([0, (y0 + y1) / 2, 0])));
  }
}

export function endWall(push, d, Z, y, part, from) {
  const hw = (z) => halfWidthAt(d, z);
  for (let k = 0; k + 1 < Z.length; k += 1) push(face([[-hw(Z[k]), y, Z[k]], [hw(Z[k]), y, Z[k]], [hw(Z[k + 1]), y, Z[k + 1]], [-hw(Z[k + 1]), y, Z[k + 1]]], part((Z[k] + Z[k + 1]) / 2), from));
}

/** An articulation's bellows at a body's end y (s its way out, +1 or −1): the section a little in from the body, `depth`
 *  off its end, a ring of strips from the skirt over the roof. */
export function articulationRing(push, d, y, s, depth) {
  const hw = (z) => halfWidthAt(d, z) * 0.94, Z = sectionRows(d, { rows: 10 }, [d.frame.floor]), S = d.section, H = d.frame.height;
  for (let k = 0; k + 1 < Z.length; k += 1) for (const sx of [1, -1]) {
    const [za, zb] = [Z[k], Z[k + 1]], ya = y, yb = y + s * depth;
    push(face([[sx * hw(za), ya, za], [sx * hw(za), yb, za], [sx * hw(zb), yb, zb], [sx * hw(zb), ya, zb]], 'gangway', [0, y - s, (S.z0 + H) / 2]));
  }
}
