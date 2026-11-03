/**
 * car-surface — the surface compiler of the cars behind the cab (car-odm.js solves them): named quads at a level of
 * detail (rail-geom.js), a passenger car's body the same shell as its cab car's (body-shell.js).
 *
 *   passenger  its section extruded end to end, its doors, window lights, livery band, roof and skirt; its roof unit;
 *              its ends: a gangway's bellows and the coupling bar under it, or a coach's buffer beam, buffers, screw
 *              coupler and its longer bellows, or a streetcar module's articulation ring; its bogies (bogie-surface.js)
 *              under it, the second turned end for end, a streetcar's centre module on one under its middle
 *   box        a box wagon's underframe, its sides between ribs, its sliding door on its rails, its roof
 *   hopper     a covered hopper's upper body, its bays falling in to their discharge gates, its roof hatch
 *   tank       a tank wagon's barrel on its cradles over its centre sill, its dished ends, its dome, its walkway
 *   flat       a flat wagon's deck on its sills, its stanchions, a container on it
 *   freight    every wagon's buffer beams and buffers and hook at its ends, its three-piece trucks
 *
 *   compileCarSurface(brief, { quality, livery, pose: { spin } }) → { design, quality, livery, faces, materials,
 *                                                                    census, ends }
 *     ends   what each end carries and how far it stands off the body ({ kind, depth }), for consist.js to couple by
 *
 * Coordinates: +y forward, x right, z up from the rail; the car's middle at y = 0.
 */
import { solveCarDesign } from './car-odm.js';
import { halfWidthAt } from './cab-odm.js';
import { compileBogieSurface } from './bogie-surface.js';
import { CAB_LIVERIES, RAIL_MATERIALS } from './cab-surface.js';
import { samples, sectionRows, windowLights, sideParts, extrudeSides, endWall, articulationRing } from './body-shell.js';
import { r4, face, box, cylinder, finishRailFaces } from './rail-geom.js';
import { mulberry32, hashSeed } from '../vehicle-designer/veh-common.js';

export const CAR_LODS = Object.freeze({
  game: Object.freeze({ rows: 16, step: 1.4, bogie: 'game', round: 12 }),
  studio: Object.freeze({ rows: 24, step: 0.8, bogie: 'studio', round: 18 }),
  hero: Object.freeze({ rows: 38, step: 0.45, bogie: 'hero', round: 28 }),
});
// how far each end's gear stands off the body (two cars' ends coupled: the gap between their bodies is the sum)
export const END_DEPTH = Object.freeze({ gangway: 0.15, articulated: 0.15, buffers: 0.62 });
const WAGON_COLOURS = Object.freeze({ box: '#7a4a32', hopper: '#9aa0a3', tank: '#232526', flat: '#3a3d40' });
const CONTAINERS = Object.freeze(['#2f5f8f', '#a8322b', '#3f7a47', '#c8792a', '#6b4f8a']);
const DARK = '#1c1e20', GLASS = '#22313c', STEEL = '#7d8287', RUBBER = '#1a1b1c';

export function compileCarSurface(brief = {}, { quality = 'studio', livery, pose = {} } = {}) {
  const LOD = CAR_LODS[quality];
  if (!LOD) throw new Error(`rail-car: quality is ${Object.keys(CAR_LODS).join(', ')}`);
  const d = brief.frame && brief.doors ? brief : solveCarDesign(brief);
  if (!d.valid) throw new Error(`rail-car: the design fails its laws (${d.laws.filter((l) => !l.pass).map((l) => l.id).join(', ')})`);
  const { length: L, width: W, height: H, floor } = d.frame, S = d.section, hw = (z) => halfWidthAt(d, z), zr = S.zc + S.radius;
  const fam = { metro: 'silver', tram: 'crimson', regional: 'white', highSpeed: 'white', coach: 'green', freight: 'silver' }[d.family];
  const C = typeof livery === 'object' && livery ? { ...CAB_LIVERIES.silver, ...livery } : CAB_LIVERIES[livery ?? fam];
  if (!C) throw new Error(`rail-car: livery is one of ${Object.keys(CAB_LIVERIES).join(', ')} or an object of roles`);
  const y0 = -L / 2, y1 = L / 2, body = [], fittings = [], bogies = [];
  const freight = d.kind === 'freight', paint = freight ? WAGON_COLOURS[d.body] : C.body;
  const colour = (part) => ({ 'livery.band': C.band, 'body.roof': freight ? paint : C.roof, 'body.skirt': freight ? DARK : C.skirt, door: freight ? paint : C.door, seam: DARK, grille: DARK,
    underframe: DARK, coupler: STEEL, buffer: STEEL, 'buffer.beam': freight ? DARK : C.beam, gangway: RUBBER, 'roof.unit': C.roof, 'body.rib': paint, 'body.frame': DARK }[part]
    ?? (/^glass\./.test(part) ? GLASS : /^bogie\./.test(part) ? DARK : paint));
  const push = (out) => (f) => { if (f) out.push({ ...f, fill: f.fill ?? colour(f.part) }); };
  const inside = (p) => [0, Math.min(y1 - 0.5, Math.max(y0 + 0.5, p[1])), (S.z0 + H) / 2];

  if (!freight) {
    // ── a passenger car: the same shell as its cab car's, its doors and windows between its ends ──
    const band = [r4(S.zw - 0.05), r4(S.zw + 0.12)], win = [r4(floor + 0.85), r4(floor + 1.92)], doorTop = floor + d.doors.height, gap = 0.02;
    const Z = sectionRows(d, LOD, [floor, S.zw, ...band, ...win, doorTop, floor - 0.05, zr]);
    const doors = d.doors.at.map((y) => [r4(y - d.doors.width / 2), r4(y + d.doors.width / 2)]);
    const lights = windowLights(d, { ends: [y0 + 1.0, y1 - 1.0], doors });
    const Yb = Array.from({ length: Math.ceil(L / LOD.step) + 1 }, (_, i) => Math.min(y1, y0 + i * LOD.step));
    const Y = samples(Yb, [...doors.flatMap(([a, b]) => [a, a + gap, b - gap, b]), ...lights.flat()], y0, y1, 0.008);
    const { common, part } = sideParts({ floor, doorTop, win, band, zr, doors, lights, gap });
    extrudeSides(push(body), d, Y, Z, part, inside);
    push(body)(face([[hw(S.z0), y0, S.z0], [hw(S.z0), y1, S.z0], [-hw(S.z0), y1, S.z0], [-hw(S.z0), y0, S.z0]], 'underframe', [0, 0, S.z0 + 1]));
    for (const [y, s] of [[y0, -1], [y1, 1]]) endWall(push(body), d, Z, y, common, [0, y - s, (S.z0 + H) / 2]);
    if (d.roofUnit) box(fittings, [-0.7, 0.7], [y0 + 2.2, y1 - 2.2], [H - 0.04, H + 0.24], 'roof.unit');
  } else {
    freightBody(d, { body, fittings, push, inside, LOD, paint, seed: d.seed });
  }

  // ── its ends: a gangway's bellows and its bar, a coach's or a wagon's buffers, a module's articulation ring ──
  const depth = END_DEPTH[d.ends];
  for (const s of [1, -1]) {
    const y = s * L / 2;
    if (d.ends === 'gangway' || (d.ends === 'buffers' && !freight)) {
      box(fittings, [-0.55, 0.55], s > 0 ? [y, y + depth] : [y - depth, y], [floor, floor + 2.05], 'gangway');
    }
    if (d.ends === 'gangway') box(fittings, [-0.08, 0.08], s > 0 ? [y, y + depth] : [y - depth, y], [floor - 0.42, floor - 0.26], 'coupler');
    if (d.ends === 'buffers') {
      const zc = 1.06;
      box(fittings, [-W / 2 + 0.08, W / 2 - 0.08], s > 0 ? [y - 0.06, y + 0.12] : [y - 0.12, y + 0.06], [zc - 0.3, zc + 0.24], 'buffer.beam');
      for (const sx of [1, -1]) {
        cylinder(fittings, [sx * 0.875, y + s * 0.12, zc], [sx * 0.875, y + s * (depth - 0.06), zc], 0.12, 10, 'buffer');
        cylinder(fittings, [sx * 0.875, y + s * (depth - 0.06), zc], [sx * 0.875, y + s * depth, zc], 0.22, 14, 'buffer');
      }
      box(fittings, [-0.05, 0.05], s > 0 ? [y + 0.12, y + 0.42] : [y - 0.42, y - 0.12], [zc - 0.06, zc + 0.06], 'coupler');
    }
    if (d.ends === 'articulated') articulationRing(push(fittings), d, y, s, depth);
  }
  // ── its bogies: two at its overhangs (the second turned end for end), or one under its middle, or none ──
  for (const [k, yB] of d.frame.bogies.entries()) {
    const B = compileBogieSurface({ seed: d.seed, archetype: d.frame.bogieKinds[k] }, { quality: LOD.bogie, pose: { spin: pose.spin, yaw: k === 1 ? 180 : 0 } });
    for (const f of Object.values(B.faces).flat()) bogies.push({ ...f, corners: f.corners.map(([x, y, z]) => [x, r4(y + yB), z]) });
  }
  for (const f of [...body, ...fittings]) f.fill = f.fill ?? colour(f.part);
  const faces = { body: finishRailFaces(body), fittings: finishRailFaces(fittings), bogies };
  const all = Object.values(faces).flat(), parts = {};
  for (const f of all) parts[f.part] = (parts[f.part] || 0) + 1;
  return { design: d, quality, livery: C, faces, materials: RAIL_MATERIALS, ends: { front: { kind: d.ends, depth }, rear: { kind: d.ends, depth } },
    census: { faces: all.length, triangles: all.reduce((t, f) => t + f.corners.length - 2, 0), materialGroups: new Set(all.map((f) => f.material)).size, parts } };
}

// a wagon's body by its kind: box, hopper, tank or flat
function freightBody(d, { body, fittings, push, inside, LOD, paint, seed }) {
  const { length: L, width: W, height: H, floor } = d.frame, S = d.section, y0 = -L / 2, y1 = L / 2, hw = (z) => halfWidthAt(d, z), zr = S.zc + S.radius;
  // (the underframe every wagon stands on: its sole bars and headstocks, its centre sill)
  box(body, [-W / 2 + 0.05, W / 2 - 0.05], [y0, y1], [floor - 0.3, floor - 0.02], 'body.frame');
  box(body, [-0.2, 0.2], [y0 + 0.2, y1 - 0.2], [floor - 0.5, floor - 0.3], 'body.frame');
  if (d.body === 'box') {
    const Z = sectionRows(d, LOD, [floor, floor + 0.05, zr]), Y = samples(Array.from({ length: Math.ceil(L / LOD.step) + 1 }, (_, i) => Math.min(y1, y0 + i * LOD.step)), [], y0, y1, 0.008);
    const part = (y, z) => (z > zr - 0.02 ? 'body.roof' : 'body.paint');
    extrudeSides(push(body), { ...d, section: { ...S, z0: floor } }, Y, Z.filter((z) => z >= floor), part, inside);
    for (const [y, s] of [[y0, -1], [y1, 1]]) endWall(push(body), { ...d, section: { ...S, z0: floor } }, Z.filter((z) => z >= floor), y, () => 'body.paint', [0, y - s, (floor + H) / 2]);
    // (ribs every metre along its sides, the sliding door proud of its side on its rails)
    for (let y = y0 + 0.5; y < y1 - 0.3; y += 1.0) for (const sx of [1, -1]) if (Math.abs(y) > d.doors.width / 2 + 0.2) box(body, sx > 0 ? [W / 2, W / 2 + 0.04] : [-W / 2 - 0.04, -W / 2], [y - 0.04, y + 0.04], [floor + 0.05, zr - 0.15], 'body.rib');
    for (const sx of [1, -1]) {
      const X = sx > 0 ? [W / 2 + 0.02, W / 2 + 0.07] : [-W / 2 - 0.07, -W / 2 - 0.02];
      box(fittings, X, [-d.doors.width / 2, d.doors.width / 2], [floor + 0.08, floor + d.doors.height], 'door');
      for (const z of [floor + 0.05, floor + d.doors.height + 0.04]) box(fittings, sx > 0 ? [W / 2, W / 2 + 0.08] : [-W / 2 - 0.08, -W / 2], [-d.doors.width, d.doors.width], [z - 0.03, z + 0.03], 'body.frame');
    }
  } else if (d.body === 'hopper') {
    // (its upper body: the section above the bays' tops; the bays below, each falling in to its gate)
    const zt = floor + 0.75, up = { ...d, section: { ...S, z0: zt } };
    const Z = sectionRows(up, LOD, [zt, zr]).filter((z) => z >= zt), Y = samples(Array.from({ length: Math.ceil(L / LOD.step) + 1 }, (_, i) => Math.min(y1 - 0.4, y0 + 0.4 + i * LOD.step)), [], y0 + 0.4, y1 - 0.4, 0.008);
    extrudeSides(push(body), up, Y, Z, (y, z) => (z > zr - 0.02 ? 'body.roof' : 'body.paint'), inside);
    for (const [y, s] of [[y0 + 0.4, -1], [y1 - 0.4, 1]]) endWall(push(body), up, Z, y, () => 'body.paint', [0, y - s, (zt + H) / 2]);
    const n = d.bays, span = (L - 0.8) / n, w = W / 2 - 0.04, zg = 0.72;
    for (let k = 0; k < n; k += 1) {
      const a = y0 + 0.4 + k * span, b = a + span, m = (a + b) / 2, g = 0.35;
      const T = [[w, a, zt], [w, b, zt], [-w, b, zt], [-w, a, zt]], G = [[0.3, m - g, zg], [0.3, m + g, zg], [-0.3, m + g, zg], [-0.3, m - g, zg]];
      for (let i = 0; i < 4; i += 1) push(body)(face([T[i], T[(i + 1) % 4], G[(i + 1) % 4], G[i]], 'body.paint', [0, m, zt + 0.5]));
      box(fittings, [-0.34, 0.34], [m - g - 0.04, m + g + 0.04], [zg - 0.14, zg], 'body.frame');
    }
    box(fittings, [-0.35, 0.35], [y0 + 1.0, y1 - 1.0], [H - 0.02, H + 0.08], 'body.frame');
  } else if (d.body === 'tank') {
    // (its barrel on cradles over the centre sill, its ends dished, its dome, its walkway along it)
    const R = d.barrel / 2, zc = floor + R + 0.12, n = LOD.round, ya = y0 + 0.7, yb = y1 - 0.7;
    cylinder(body, [0, ya, zc], [0, yb, zc], R, n, 'body.paint', { caps: false });
    for (const [y, s] of [[ya, -1], [yb, 1]]) {
      cylinder(body, [0, y, zc], [0, y + s * 0.22, zc], R * 0.92, n, 'body.paint', { caps: false });
      cylinder(body, [0, y + s * 0.22, zc], [0, y + s * 0.32, zc], R * 0.6, n, 'body.paint');
    }
    cylinder(fittings, [0, 0, zc + R - 0.05], [0, 0, zc + R + 0.32], 0.4, n, 'body.paint');
    for (const yk of [y0 + 2.2, y1 - 2.2]) box(body, [-R * 0.85, R * 0.85], [yk - 0.25, yk + 0.25], [floor - 0.02, zc - R * 0.6], 'body.frame');
    box(fittings, [-0.3, 0.3], [-L * 0.3, L * 0.3], [zc + R + 0.02, zc + R + 0.06], 'body.frame');
  } else {
    // (a flat wagon: its deck, its stanchions, a container on its twist locks)
    box(body, [-W / 2 + 0.02, W / 2 - 0.02], [y0, y1], [floor - 0.02, floor + 0.08], 'body.frame');
    for (let y = y0 + 0.8; y < y1 - 0.5; y += 2.4) for (const sx of [1, -1]) box(fittings, sx > 0 ? [W / 2 - 0.1, W / 2 - 0.02] : [-W / 2 + 0.02, -W / 2 + 0.1], [y - 0.05, y + 0.05], [floor + 0.08, floor + 0.45], 'body.frame');
    if (d.load === 'container') {
      const rnd = mulberry32(hashSeed(`flat:${seed}`)), col = CONTAINERS[Math.floor(rnd() * CONTAINERS.length)], cl = Math.min(12.19, L - 1.2), cw = 2.44, ch = 2.59;
      const cz = floor + 0.1, cb = [];
      box(cb, [-cw / 2, cw / 2], [-cl / 2, cl / 2], [cz, cz + ch], 'load.container');
      for (let y = -cl / 2 + 0.3; y < cl / 2 - 0.2; y += 0.3) for (const sx of [1, -1]) box(cb, sx > 0 ? [cw / 2, cw / 2 + 0.02] : [-cw / 2 - 0.02, -cw / 2], [y - 0.04, y + 0.04], [cz + 0.08, cz + ch - 0.08], 'load.container');
      for (const f of cb) fittings.push({ ...f, fill: col });
    }
  }
}
