/**
 * cab-surface — the surface compiler of a cab car (cab-odm.js solves it), on the vehicle ODM's pattern
 * (car-designer/vehicle-odm-surface.js): named quads in metres at a level of detail, each with its part, its material,
 * its outward normal and its corners' crease-aware normals, the colour it is painted and the colour it is lit.
 *
 * Its body's sides are the section extruded from the gangway end back of the nose's root; its front is the design's
 * field gridded over the section on the SAME rows, so where the front meets the sides every corner is shared. The rows
 * and columns are snapped to every boundary a part has (the screen's, the mask's, the sign's, the waist's band, the
 * windows', the doors'), so each part's edge is a grid line and each quad is one part, read off its middle:
 *
 *   front   glass.screen (a mullion's pillar between two panes), glass.frame round it, body.mask round that, the lit
 *           sign over it, the livery band, the skirt
 *   sides   glass.cab (the driver's side window), glass.side (a window band, bays, or a locomotive's louvres), door and
 *           glass.door and the seams round each door, the livery band, the roof, the skirt
 *   fittings headlamps and tail lamps on the front's own surface, a high lamp, wipers, the coupler (automatic, under a
 *           cover, or a buffer beam's buffers and hook), the anticlimber, the pilot (a plough), the roof's units, the
 *           gangway at the far end, and the bogies: wheels, axles, side frames, axle boxes, springs, bolster
 *
 *   compileCabSurface(brief, { quality, livery }) → { design, quality, livery, faces: { body, front, fittings, bogies },
 *                                                     materials, census }
 *
 * Coordinates: +y forward (the nose's tip at y = L/2), +x right, z up from the rail. Pure and deterministic.
 */
import { solveCabDesign, halfWidthAt, frontAt, frontNormal } from './cab-odm.js';
import { VEHICLE_MATERIALS } from '../car-designer/vehicle-surface-finish.js';

export const CAB_LODS = Object.freeze({
  game: Object.freeze({ rows: 18, cols: 14, step: 1.2, wheel: 12 }),
  studio: Object.freeze({ rows: 28, cols: 22, step: 0.7, wheel: 18 }),
  hero: Object.freeze({ rows: 44, cols: 34, step: 0.4, wheel: 28 }),
});
export const RAIL_MATERIALS = Object.freeze({ ...VEHICLE_MATERIALS, sign: Object.freeze({ metalness: 0, roughness: 0.35, emissive: '#ffb23e', emissiveIntensity: 0.9 }) });
// the colours a cab is painted in, by role (generic schemes: no operator's livery)
export const CAB_LIVERIES = Object.freeze({
  silver: Object.freeze({ body: '#c4cacf', band: '#2f6fb0', roof: '#8d9398', skirt: '#3b3f43', mask: '#121416', door: '#c4cacf', beam: '#b3261e' }),
  crimson: Object.freeze({ body: '#b5262a', band: '#f2efe6', roof: '#7b8085', skirt: '#2d2f31', mask: '#121416', door: '#b5262a', beam: '#2d2f31' }),
  white: Object.freeze({ body: '#eceeee', band: '#1f5aa6', roof: '#a7adb2', skirt: '#4a4f54', mask: '#121416', door: '#eceeee', beam: '#b3261e' }),
  green: Object.freeze({ body: '#2f6b45', band: '#e6c34a', roof: '#6e7377', skirt: '#2a2c2e', mask: '#121416', door: '#2f6b45', beam: '#b3261e' }),
});
const DARK = '#1c1e20', GLASS = '#22313c', STEEL = '#7d8287', LAMP = '#f4f1e2', TAIL = '#b8242c', SIGN = '#ffb23e', RUBBER = '#1a1b1c';
const r4 = (x) => Math.round(x * 10000) / 10000 + 0;
const P3 = (p) => p.map(r4);
const sub = (a, b) => a.map((v, i) => v - b[i]), add = (a, b) => a.map((v, i) => v + b[i]), mul = (a, k) => a.map((v) => v * k);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const newell = (c) => { const n = [0, 0, 0]; for (let i = 0; i < c.length; i += 1) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } return n; };
// (a face, its repeated corners dropped, its normal turned out from `from`: a point inside the thing it is part of)
function face(corners, part, from, normal) {
  const c = corners.map(P3).filter((p, i, a) => i === 0 || p.some((v, k) => v !== a[i - 1][k]));
  if (c.length > 2 && c[0].every((v, k) => v === c.at(-1)[k])) c.pop();
  if (c.length < 3) return null;
  let n = normal ? unit(normal) : unit(newell(c));
  if (!normal && Math.hypot(...newell(c)) < 1e-9) return null;
  const mid = [0, 1, 2].map((k) => c.reduce((t, p) => t + p[k], 0) / c.length);
  if (!normal && dot(n, sub(mid, from)) < 0) n = mul(n, -1);
  // (corners wound to the normal: counter-clockwise seen from outside)
  if (dot(unit(newell(c)), n) < 0) c.reverse();
  return { corners: c, part, outNormal: n.map(r4) };
}
// (a box: its six faces turned out from its centre)
function box(out, [x0, x1], [y0, y1], [z0, z1], part) {
  const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const v = (i, j, k) => [[x0, x1][i], [y0, y1][j], [z0, z1][k]];
  for (const q of [[v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)], [v(0, 0, 0), v(0, 0, 1), v(0, 1, 1), v(0, 1, 0)], [v(0, 1, 0), v(0, 1, 1), v(1, 1, 1), v(1, 1, 0)],
    [v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)], [v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)], [v(0, 0, 0), v(0, 1, 0), v(1, 1, 0), v(1, 0, 0)]]) {
    const f = face(q, part, c); if (f) out.push(f);
  }
}
// (a prism along an axis: its n-gon ends and its sides, turned out from its axis)
function cylinder(out, a, b, r, n, part, { caps = true } = {}) {
  const ax = unit(sub(b, a)), t1 = unit(Math.abs(ax[2]) < 0.9 ? cross(ax, [0, 0, 1]) : cross(ax, [1, 0, 0])), t2 = cross(ax, t1);
  const ring = (c) => Array.from({ length: n }, (_, i) => { const q = (2 * Math.PI * i) / n; return add(c, add(mul(t1, r * Math.cos(q)), mul(t2, r * Math.sin(q)))); });
  const A = ring(a), B = ring(b), mid = mul(add(a, b), 0.5);
  for (let i = 0; i < n; i += 1) { const j = (i + 1) % n, f = face([A[i], A[j], B[j], B[i]], part, mid); if (f) out.push(f); }
  if (caps) { const fa = face(A, part, mid), fb = face(B, part, mid); if (fa) out.push(fa); if (fb) out.push(fb); }
}
// (a disc lying on a surface at p, its normal n, `off` proud of it)
function disc(out, p, n, r, part, off, k = 12) {
  const t1 = unit(cross(n, [0, 0, 1])), t2 = cross(t1, n), c = add(p, mul(n, off));
  const f = face(Array.from({ length: k }, (_, i) => { const q = (2 * Math.PI * i) / k; return add(c, add(mul(t1, r * Math.cos(q)), mul(t2, r * Math.sin(q)))); }), part, null, n);
  if (f) out.push(f);
}

// a part's material (the vehicle ODM's where it names one, the rail shelf's own over it)
const OWN = { sign: 'sign', coupler: 'alloy', buffer: 'alloy', anticlimber: 'alloy', pilot: 'carbon', wiper: 'carbon', 'body.mask': 'carbon', 'glass.frame': 'seal', pillar: 'carbon',
  wheel: 'alloy', axle: 'alloy', gangway: 'rubber', underframe: 'seal', grille: 'carbon', seam: 'seal', 'lamp.bezel': 'carbon', headlamp: 'lamp', taillamp: 'tail' };
export function railMaterial(part) {
  if (OWN[part]) return OWN[part];
  if (/^bogie\./.test(part)) return 'seal';
  if (/^glass\./.test(part)) return 'glass';
  return 'paint';
}
function shade(hex, n) {
  const k = 0.64 + 0.42 * Math.max(0, dot(n, [0.35, 0.25, 0.902]));
  return '#' + hex.slice(1).match(/../g).map((h) => Math.min(255, Math.round(parseInt(h, 16) * k)).toString(16).padStart(2, '0')).join('');
}
/** Crease-aware corner normals within a material, its baked fallback colour; the paint it is given kept as `albedo`. */
export function finishRailFaces(faces) {
  const mats = faces.map((f) => railMaterial(f.part)), verts = new Map(), key = (i, p) => `${mats[i]}:${p.join(',')}`;
  faces.forEach((f, i) => { for (const p of f.corners) { const k = key(i, p); if (!verts.has(k)) verts.set(k, []); verts.get(k).push(i); } });
  const crease = Math.cos((40 * Math.PI) / 180);
  return faces.map((f, i) => {
    const cn = f.corners.map((p) => unit(verts.get(key(i, p)).filter((j) => dot(faces[i].outNormal, faces[j].outNormal) > crease).reduce((s, j) => add(s, faces[j].outNormal), [0, 0, 0])).map(r4));
    const lit = ['lamp', 'tail', 'sign'].includes(mats[i]);
    return { ...f, albedo: f.fill, material: mats[i], cornerNormals: cn, fill: lit ? f.fill : shade(f.fill, f.outNormal), cornerFills: cn.map((n) => (lit ? f.fill : shade(f.fill, n))) };
  });
}

// sorted, deduped samples: the base spacing and every boundary a part needs
const samples = (base, snaps, lo, hi, gap) => [...base, ...snaps].filter((v) => v >= lo - 1e-9 && v <= hi + 1e-9).map((v) => Math.min(hi, Math.max(lo, v))).sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > gap);

export function compileCabSurface(brief = {}, { quality = 'studio', livery } = {}) {
  const LOD = CAB_LODS[quality];
  if (!LOD) throw new Error(`rail-cab: quality is ${Object.keys(CAB_LODS).join(', ')}`);
  const d = brief.frame && brief.front ? brief : solveCabDesign(brief);
  if (!d.valid) throw new Error(`rail-cab: the design fails its laws (${d.laws.filter((l) => !l.pass).map((l) => l.id).join(', ')})`);
  const C = typeof livery === 'object' && livery ? { ...CAB_LIVERIES.silver, ...livery } : CAB_LIVERIES[livery ?? { metro: 'silver', tram: 'crimson', regional: 'white', highSpeed: 'white', boxCab: 'green' }[d.archetype]];
  if (!C) throw new Error(`rail-cab: livery is one of ${Object.keys(CAB_LIVERIES).join(', ')} or an object of roles`);
  const { length: L, width: W, height: H, floor } = d.frame, S = d.section, F = d.front, SC = d.screen, A = d.anchors;
  const root = F.root, yTail = -L / 2, hw = (z) => halfWidthAt(d, z), zr = S.zc + S.radius;
  const band = [r4(S.zw - 0.05), r4(S.zw + 0.12)], win = [r4(floor + 0.85), r4(floor + 1.92)], doorTop = floor + d.doors.height;
  const signZ = SC.sign ? [r4(SC.z1 + 0.08), r4(SC.z1 + 0.08 + SC.sign)] : null, maskZ = [r4(SC.z0 - 0.25), r4((signZ ? signZ[1] : SC.z1) + 0.1)];
  // the rows: up the side to the cant rail, round it by angle, over the roof by angle; snapped to every band
  const R = LOD.rows, n1 = Math.round(R * 0.55), n2 = Math.round(R * 0.2), n3 = R - n1 - n2;
  const base = [
    ...Array.from({ length: n1 + 1 }, (_, k) => S.z0 + ((S.zc - S.z0) * k) / n1),
    ...Array.from({ length: n2 }, (_, k) => S.zc + S.radius * Math.sin(((k + 1) / n2) * (Math.PI / 2))),
    ...Array.from({ length: n3 }, (_, k) => zr + (H - zr) * Math.sin(((k + 1) / n3) * (Math.PI / 2))),
  ];
  const zSnap = [floor, S.zw, ...band, ...win, doorTop, SC.z0, SC.z1, SC.z0 - 0.05, SC.z1 + 0.05, ...maskZ, ...(signZ || []), floor - 0.05, zr];
  const Z = samples(base, zSnap, S.z0, H, 0.012);
  // the front's columns across (u, −1 … 1 of the half-width at each row), snapped to the screen's, the frame's, the mask's
  const U0 = Array.from({ length: LOD.cols + 1 }, (_, j) => -1 + (2 * j) / LOD.cols);
  const uSnap = [SC.half, SC.half + 0.05, SC.half + 0.14, 0.45, ...(SC.mullion ? [0.025] : []), 0];
  const U = samples(U0, uSnap.flatMap((u) => [u, -u]), -1, 1, 0.01);
  // the sides' stations: back from the nose's root, snapped to the doors, the windows, the cab window
  const gapD = 0.02, cabW = d.cabWindow ? [r4(root - 0.6 - d.cabWindow), r4(root - 0.6)] : null;
  const doors = d.doors.at.map((y) => [r4(y - d.doors.width / 2), r4(y + d.doors.width / 2)]);
  const lights = [];
  if (d.windows !== 'louvres') {
    const runs = [], edges = [yTail + 1.0, ...doors.flat(), (cabW ? cabW[0] : root) - 0.5].sort((a, b) => a - b);
    for (let i = 0; i + 1 < edges.length; i += 2) runs.push([edges[i] + 0.35, edges[i + 1] - 0.35]);
    for (const [a, b] of runs) {
      if (b - a < 0.8) continue;
      const bay = d.windows === 'bays' ? 1.5 : 1.7, n = Math.max(1, Math.round((b - a) / bay)), step = (b - a) / n;
      for (let k = 0; k < n; k += 1) lights.push([r4(a + k * step + (k ? 0.06 : 0)), r4(a + (k + 1) * step - (k < n - 1 ? 0.06 : 0))]);
    }
  } else for (let k = 0; k < 5; k += 1) { const y = root - 3.2 - k * 2.4; if (y > yTail + 1.5) lights.push([r4(y - 0.9), r4(y)]); }
  const ySnap = [...doors.flatMap(([a, b]) => [a, a + gapD, b - gapD, b]), ...lights.flat(), ...(cabW || [])];
  const Ybase = Array.from({ length: Math.ceil((root - yTail) / LOD.step) + 1 }, (_, i) => Math.min(root, yTail + i * LOD.step));
  const Y = samples(Ybase, ySnap, yTail, root, 0.008);
  const inAny = (v, R2) => R2.some(([a, b]) => v > a && v < b);

  // what a quad is, read off its middle
  const common = (z) => (z > band[0] && z < band[1] ? 'livery.band' : z > zr - 0.02 ? 'body.roof' : z < floor - 0.05 ? 'body.skirt' : 'body.paint');
  const sidePart = (y, z) => {
    for (const [a, b] of doors) if (y > a && y < b && z > floor + 0.02 && z < doorTop) return y < a + gapD || y > b - gapD ? 'seam' : z > win[0] && z < win[1] - 0.1 ? 'glass.door' : 'door';
    if (cabW && y > cabW[0] && y < cabW[1] && z > SC.z0 && z < SC.z1 - 0.12) return 'glass.cab';
    if (z > win[0] && z < win[1] && inAny(y, lights)) return d.windows === 'louvres' ? 'grille' : 'glass.side';
    return common(z);
  };
  const frontPart = (u, z) => {
    const au = Math.abs(u);
    if (au < SC.half && z > SC.z0 && z < SC.z1) return SC.mullion && au < 0.025 ? 'pillar' : 'glass.screen';
    if (au < SC.half + 0.05 && z > SC.z0 - 0.05 && z < SC.z1 + 0.05) return 'glass.frame';
    if (signZ && au < 0.45 && z > signZ[0] && z < signZ[1]) return 'sign';
    if (SC.mask && au < SC.half + 0.14 && z > maskZ[0] && z < maskZ[1]) return 'body.mask';
    return common(z);
  };
  const colour = (part) => ({ 'livery.band': C.band, 'body.roof': C.roof, 'body.skirt': C.skirt, 'body.mask': C.mask, door: C.door, seam: DARK, 'glass.frame': DARK, pillar: C.mask,
    sign: SIGN, grille: DARK, underframe: DARK, coupler: STEEL, buffer: STEEL, anticlimber: STEEL, wheel: STEEL, axle: STEEL, 'buffer.beam': C.beam,
    pilot: DARK, 'lamp.bezel': DARK, wiper: DARK, headlamp: LAMP, taillamp: TAIL, gangway: RUBBER, 'roof.unit': C.roof }[part]
    ?? (/^glass\./.test(part) ? GLASS : /^bogie\./.test(part) ? DARK : C.body));
  const inside = (p) => [0, Math.min(root - 0.5, Math.max(yTail + 0.5, p[1])), (S.z0 + H) / 2];
  const push = (out, f) => { if (f) out.push({ ...f, fill: f.fill ?? colour(f.part) }); };
  const body = [], front = [], fittings = [], bogies = [];

  // the sides: the section extruded, both sides, each quad its part
  for (const sx of [1, -1]) for (let i = 0; i + 1 < Y.length; i += 1) for (let k = 0; k + 1 < Z.length; k += 1) {
    const [y0, y1, z0, z1] = [Y[i], Y[i + 1], Z[k], Z[k + 1]], q = [[sx * hw(z0), y0, z0], [sx * hw(z0), y1, z0], [sx * hw(z1), y1, z1], [sx * hw(z1), y0, z1]];
    push(body, face(q, sidePart((y0 + y1) / 2, (z0 + z1) / 2), inside([0, (y0 + y1) / 2, 0])));
  }
  // its underside, its end at the gangway (strips across between the rows' pairs)
  push(body, face([[hw(S.z0), yTail, S.z0], [hw(S.z0), root, S.z0], [-hw(S.z0), root, S.z0], [-hw(S.z0), yTail, S.z0]], 'underframe', [0, 0, S.z0 + 1]));
  for (let k = 0; k + 1 < Z.length; k += 1) push(body, face([[-hw(Z[k]), yTail, Z[k]], [hw(Z[k]), yTail, Z[k]], [hw(Z[k + 1]), yTail, Z[k + 1]], [-hw(Z[k + 1]), yTail, Z[k + 1]]], common((Z[k] + Z[k + 1]) / 2), [0, yTail + 1, (S.z0 + H) / 2]));
  // the front: the field gridded on the same rows, its columns across each row's half-width
  const G = Z.map((z) => U.map((u) => { const x = u * hw(z); return [x, frontAt(d, x, z), z]; }));
  for (let k = 0; k + 1 < Z.length; k += 1) for (let j = 0; j + 1 < U.length; j += 1) {
    const q = [G[k][j], G[k][j + 1], G[k + 1][j + 1], G[k + 1][j]];
    push(front, face(q, frontPart((U[j] + U[j + 1]) / 2, (Z[k] + Z[k + 1]) / 2), [0, root - 0.5, (S.z0 + H) / 2]));
  }
  // (its underside: the bottom row's curve closed along the root)
  push(front, face(G[0], 'underframe', [0, root - 0.5, S.z0 + 1]));

  // the fittings: lamps on the front's own surface, a high lamp, wipers
  const surf = (u, z) => { const x = u * hw(z); return { p: [x, frontAt(d, x, z), z], n: frontNormal(d, x, z) }; };
  const lampR = d.archetype === 'boxCab' ? 0.12 : 0.1;
  for (const sx of [1, -1]) {
    const a = surf(sx * A.lamps.u, A.lamps.z), t = surf(sx * (A.lamps.u + 2.6 * lampR / hw(A.lamps.z)), A.lamps.z);
    disc(fittings, a.p, a.n, lampR * 1.4, 'lamp.bezel', 0.012); disc(fittings, a.p, a.n, lampR, 'headlamp', 0.024);
    disc(fittings, t.p, t.n, lampR * 0.95, 'lamp.bezel', 0.012); disc(fittings, t.p, t.n, lampR * 0.65, 'taillamp', 0.024);
  }
  if (A.lamps.high) { const zH = signZ ? signZ[1] + 0.16 : SC.z1 + 0.22, h = surf(0, Math.min(zH, zr - 0.05)); disc(fittings, h.p, h.n, 0.12, 'lamp.bezel', 0.012); disc(fittings, h.p, h.n, 0.085, 'headlamp', 0.024); }
  for (const uc of SC.mullion ? [-0.42, 0.42] : [0]) {
    const a = surf(uc + 0.1, SC.z0 + 0.05), b = surf(uc - 0.22, SC.z0 + Math.min(0.7, 0.55 * (SC.z1 - SC.z0))), w = mul(unit(cross(a.n, sub(b.p, a.p))), 0.018);
    push(fittings, face([add(a.p, add(mul(a.n, 0.03), w)), add(b.p, add(mul(b.n, 0.03), w)), add(b.p, sub(mul(b.n, 0.03), w)), add(a.p, sub(mul(a.n, 0.03), w))], 'wiper', null, a.n));
  }
  // the coupler: an automatic coupler's shank and head out of the nose, a buffer beam's buffers and hook, or none showing
  const CP = A.coupler;
  if (CP.kind === 'automatic') {
    const y0 = frontAt(d, 0, Math.max(S.z0, CP.z));
    box(fittings, [-0.09, 0.09], [y0 - 0.3, y0 + 0.36], [CP.z - 0.08, CP.z + 0.08], 'coupler');
    box(fittings, [-0.23, 0.23], [y0 + 0.36, y0 + 0.6], [CP.z - 0.2, CP.z + 0.16], 'coupler');
  } else if (CP.kind === 'buffers') {
    const y0 = frontAt(d, 0, Math.max(S.z0, CP.z)), beam = [CP.z - 0.3, CP.z + 0.24];
    box(fittings, [-W / 2 + 0.05, W / 2 - 0.05], [y0 - 0.1, y0 + 0.16], beam, 'buffer.beam');
    for (const sx of [1, -1]) {
      cylinder(fittings, [sx * 0.875, y0 + 0.16, CP.z], [sx * 0.875, y0 + 0.56, CP.z], 0.12, 10, 'buffer');
      cylinder(fittings, [sx * 0.875, y0 + 0.56, CP.z], [sx * 0.875, y0 + 0.62, CP.z], 0.24, 14, 'buffer');
    }
    box(fittings, [-0.05, 0.05], [y0 + 0.16, y0 + 0.46], [CP.z - 0.06, CP.z + 0.06], 'coupler');
  }
  // the anticlimber: a ribbed bar across the front at the floor
  if (A.anticlimber) {
    const za = [floor - 0.24, floor - 0.04], y0 = Math.min(frontAt(d, 0, za[0]), frontAt(d, 0, za[1]));
    box(fittings, [-0.8, 0.8], [y0 - 0.06, y0 + 0.1], za, 'anticlimber');
    for (const zk of [0.2, 0.5, 0.8]) box(fittings, [-0.78, 0.78], [y0 + 0.1, y0 + 0.14], [za[0] + (za[1] - za[0]) * zk - 0.015, za[0] + (za[1] - za[0]) * zk + 0.015], 'anticlimber');
  }
  // the pilot: a plough's V under the front, its point forward, from the skirt down to a hand above the rail
  if (A.pilot === 'plough') {
    const zb = 0.16, zt = S.z0 + 0.04, apex = [0, frontAt(d, 0, S.z0) + 0.18], wing = (sx) => [sx * (hw(S.z0) - 0.1), frontAt(d, sx * (hw(S.z0) - 0.1), S.z0) - 0.35];
    for (const sx of [1, -1]) { const w = wing(sx); push(fittings, face([[apex[0], apex[1], zb], [w[0], w[1], zb], [w[0], w[1], zt], [apex[0], apex[1], zt]], 'pilot', [0, root - 1, zb])); }
  }
  // the roof's units: a long box on the crown (the cooling units of a car that carries people)
  if (d.archetype !== 'boxCab' && d.archetype !== 'highSpeed') box(fittings, [-0.7, 0.7], [yTail + 2.4, root - 2.6], [H - 0.04, H + 0.26], 'roof.unit');
  // the gangway's bellows at the far end
  box(fittings, [-0.55, 0.55], [yTail - 0.28, yTail], [floor, floor + 2.05], 'gangway');

  // the bogies: two wheelsets each on the gauge, their axles, side frames outside the wheels, axle boxes and springs,
  // the bolster under the body
  const D = d.frame.wheel, r = D / 2, g = d.frame.gauge / 2, ax = d.frame.axle;
  for (const yB of d.frame.bogies) {
    for (const ya of [yB - ax / 2, yB + ax / 2]) {
      for (const sx of [1, -1]) cylinder(bogies, [sx * (g - 0.02), ya, r], [sx * (g + 0.115), ya, r], r, LOD.wheel, 'wheel');
      cylinder(bogies, [-(g - 0.02), ya, r], [g - 0.02, ya, r], 0.08, 8, 'axle', { caps: false });
      for (const sx of [1, -1]) {
        box(bogies, [sx > 0 ? g + 0.13 : -(g + 0.33), sx > 0 ? g + 0.33 : -(g + 0.13)], [ya - 0.17, ya + 0.17], [r - 0.14, r + 0.14], 'bogie.box');
        box(bogies, [sx > 0 ? g + 0.16 : -(g + 0.3), sx > 0 ? g + 0.3 : -(g + 0.16)], [ya - 0.1, ya + 0.1], [r + 0.14, r + 0.34], 'bogie.spring');
      }
    }
    for (const sx of [1, -1]) box(bogies, [sx > 0 ? g + 0.12 : -(g + 0.36), sx > 0 ? g + 0.36 : -(g + 0.12)], [yB - ax / 2 - 0.5, yB + ax / 2 + 0.5], [r + 0.3, r + 0.52], 'bogie.frame');
    box(bogies, [-(g + 0.36), g + 0.36], [yB - 0.3, yB + 0.3], [r + 0.3, Math.max(r + 0.55, Math.min(S.z0, floor) - 0.02)], 'bogie.frame');
  }
  for (const f of [...fittings, ...bogies]) f.fill = f.fill ?? colour(f.part);
  const faces = { body: finishRailFaces(body), front: finishRailFaces(front), fittings: finishRailFaces(fittings), bogies: finishRailFaces(bogies) };
  const all = Object.values(faces).flat(), parts = {};
  for (const f of all) parts[f.part] = (parts[f.part] || 0) + 1;
  const census = { faces: all.length, triangles: all.reduce((t, f) => t + f.corners.length - 2, 0), rows: Z.length, columns: U.length, stations: Y.length,
    materialGroups: new Set(all.map((f) => f.material)).size, parts };
  const { P: _p, ...frontNumbers } = d.front;
  void _p;
  return { design: { ...d, front: frontNumbers }, quality, livery: C, faces, materials: RAIL_MATERIALS, census };
}
