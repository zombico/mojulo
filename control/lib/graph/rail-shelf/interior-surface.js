/**
 * interior-surface — the surface compiler of a railway car's inside (interior-odm.js solves it): named quads at a level of
 * detail (rail-geom.js), drawn inside the body the cab car's or the car's surface compiler draws (they call it).
 *
 *   lining      the side walls in from the skin, the body's own section, a dado below; cut where the body is cut, its
 *               window lights, its doors and a cab's side window, each opening's reveals back to the skin
 *   floor       the floor, its door zones and their thresholds, a wheelchair bay's marking; a low floor's podiums over
 *               its bogies and the steps up to them and to a raised cab
 *   ceiling     the ceiling over the lining (in two halves, so a cutaway takes one), its lamps in strips along it
 *   partitions  the walls across: the ends' (their gangway's opening), the vestibules', the cab's, a compartment's; a
 *               corridor's wall along, glazed, a door into each compartment; each doorway framed
 *   (the parts a cutaway opens with the wall: the lining, the ceiling, its lamps, the displays and racks on it)
 *   seats       benches along the walls, benches and rows across (a place each: its cushion, its back reclined, a
 *               headrest, armrests at a unit's ends, its frame), perches, tables at the windows, racks over the seats
 *   holding     poles from floor to ceiling, rails along the aisle on hangers, draft screens at the doors, displays
 *   machine     a machine room's cabinets and their panels, a washroom's module and its door
 *   cab         the driver's raised floor, the desk sloping to the screen, its displays and its controller, the seats
 *
 *   compileInteriorSurface(design, interior, { quality, trim }) → { faces, census }   (faces unfinished, each its fill)
 *   cutAway(compiled, { side, above, lid }) → the compiled thing with its near half opened: every face of its shell
 *        wholly on that side (+1 right, −1 left) above `above` dropped (and all wholly over `lid`), and its interior's
 *        lining and ceiling on that side, so its inside reads from outside (a review's or a game's doll-house view); an
 *        interior's faces carry `inside: true`
 *   INTERIOR_TRIMS   plan → its colours by role
 *
 * Coordinates: the car's own (+y forward, x right, z up from the rail). Pure and deterministic.
 */
import { halfWidthAt } from './cab-odm.js';
import { openings, samples } from './body-shell.js';
import { insideHalfWidth } from './interior-odm.js';
import { r4, face, box, cylinder } from './rail-geom.js';

export const INTERIOR_LODS = Object.freeze({
  game: Object.freeze({ step: 1.4, rows: 8, round: 8 }),
  studio: Object.freeze({ step: 0.8, rows: 12, round: 10 }),
  hero: Object.freeze({ step: 0.45, rows: 18, round: 14 }),
});
const BASE = { floor: '#4c5156', doorFloor: '#6a6f74', threshold: '#e3be2b', zone: '#2f6fb0', lining: '#e7e5df', dado: '#c3c6ca', ceiling: '#f0efea', lamp: '#f6f4ea',
  seat: '#2f5f8f', back: '#2a5480', headrest: '#d9d6cf', frame: '#8d9296', armrest: '#3a3d40', grab: '#c7cbcf', glass: '#a9c0cb', partition: '#d8d6cf', frameDoor: '#9aa0a5',
  door: '#c9c6bd', display: '#ffb23e', table: '#b9b3a7', rack: '#a4a9ae', equipment: '#8a9a8f', panel: '#a7b4aa', module: '#d3d0c8', desk: '#34373b', screen: '#7fc4ff', controller: '#1d1f21', cabFloor: '#3d4246' };
export const INTERIOR_TRIMS = Object.freeze({
  longitudinal: Object.freeze({ ...BASE }),
  tram: Object.freeze({ ...BASE, seat: '#8f2a2f', back: '#7c2429', floor: '#5a5650' }),
  bays: Object.freeze({ ...BASE, seat: '#3f6d5a', back: '#365e4e', floor: '#545a5e' }),
  airline: Object.freeze({ ...BASE, seat: '#3b4a6b', back: '#34425f', floor: '#5a5f6e', doorFloor: '#6c6f74', lining: '#ecebe6' }),
  compartments: Object.freeze({ ...BASE, seat: '#7a2f2a', back: '#6a2824', lining: '#d9cdb6', dado: '#8d6a45', partition: '#9a7348', door: '#8d6a45', floor: '#4f4a45', table: '#7d5a3a' }),
  machine: Object.freeze({ ...BASE, lining: '#b7bdb8', dado: '#9aa19c', ceiling: '#c9cec9', floor: '#5d6157', partition: '#aab1ac' }),
});
const ROLE = { 'trim.floor': 'floor', 'trim.step': 'doorFloor', 'trim.floor.door': 'doorFloor', 'trim.threshold': 'threshold', 'trim.floor.zone': 'zone', 'trim.lining': 'lining', 'trim.dado': 'dado', 'trim.ceiling': 'ceiling',
  'trim.lamp': 'lamp', 'seat.cushion': 'seat', 'seat.back': 'back', 'seat.headrest': 'headrest', 'seat.frame': 'frame', 'seat.armrest': 'armrest', 'rail.grab': 'grab', 'glass.draft': 'glass',
  partition: 'partition', 'partition.frame': 'frameDoor', 'partition.door': 'door', 'sign.display': 'display', table: 'table', rack: 'rack', equipment: 'equipment', 'equipment.panel': 'panel',
  module: 'module', 'cab.desk': 'desk', 'cab.display': 'screen', 'cab.controller': 'controller', 'cab.floor': 'cabFloor' };
// the parts a cutaway opens on its side (the shell's are every part outside the interior)
const LINING_PARTS = new Set(['trim.lining', 'trim.dado', 'trim.ceiling', 'trim.lamp', 'sign.display', 'rack']);

// (an eight-cornered solid: its bottom four then its top four, each in the order x0y0, x1y0, x1y1, x0y1)
function hexa(out, c, part) {
  const m = [0, 1, 2].map((k) => c.reduce((t, p) => t + p[k], 0) / 8);
  for (const q of [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]]) { const f = face(q.map((i) => c[i]), part, m); if (f) out.push(f); }
}

export function compileInteriorSurface(d, I, { quality = 'studio', trim } = {}) {
  const LOD = INTERIOR_LODS[quality];
  if (!LOD) throw new Error(`rail-interior: quality is ${Object.keys(INTERIOR_LODS).join(', ')}`);
  const T = { ...INTERIOR_TRIMS[I.plan], ...(trim || {}) }, N = I.numbers;
  const out = [], push = (f) => { if (f) out.push(f); };
  const { floor } = d.frame, zC = I.lining.ceiling, t = I.lining.thickness, [yR, yE] = I.span, cab = I.cab, O = openings(d);
  const hwIn = (z) => Math.max(0, halfWidthAt(d, z) - t), hw = (z) => halfWidthAt(d, z), saloonEnd = cab ? cab.partition : yE;
  const louvres = d.windows === 'louvres';
  // the openings the lining is cut by: the window lights, the doors, a cab's side window (a locomotive's louvres are not)
  const holes = [...(louvres ? [] : O.lights.map(([a, b]) => ({ y: [a, b], z: O.win, sill: true }))), ...O.doors.map(([a, b]) => ({ y: [a, b], z: [floor, O.doorTop], sill: false })),
    ...(O.cabW ? [{ y: O.cabW, z: [d.screen.z0, r4(d.screen.z1 - 0.12)], sill: true }] : [])];
  const holeAt = (y, z) => holes.some((h) => y > h.y[0] && y < h.y[1] && z > h.z[0] && z < h.z[1]);
  const zones = I.zones.filter((z) => z.kind === 'door' || z.kind === 'vestibule');
  const Zl = samples(Array.from({ length: LOD.rows + 1 }, (_, k) => floor + ((zC - floor) * k) / LOD.rows), [...holes.flatMap((h) => h.z), floor + 0.75], floor, zC, 0.01);
  const Yl = samples(Array.from({ length: Math.ceil((yE - yR) / LOD.step) + 1 }, (_, i) => Math.min(yE, yR + i * LOD.step)), [...holes.flatMap((h) => h.y), ...zones.flatMap((z) => z.y), ...I.partitions.map((p) => p.y)], yR, yE, 0.008);

  // ── the lining: both walls, a quad per station and row, cut at the openings; their reveals back to the skin ──
  for (const sx of [1, -1]) {
    for (let i = 0; i + 1 < Yl.length; i += 1) for (let k = 0; k + 1 < Zl.length; k += 1) {
      const [y0, y1, z0, z1] = [Yl[i], Yl[i + 1], Zl[k], Zl[k + 1]], ym = (y0 + y1) / 2, zm = (z0 + z1) / 2;
      if (holeAt(ym, zm)) continue;
      push(face([[sx * hwIn(z0), y0, z0], [sx * hwIn(z0), y1, z0], [sx * hwIn(z1), y1, z1], [sx * hwIn(z1), y0, z1]], zm < floor + 0.75 ? 'trim.dado' : 'trim.lining', [sx * 10, ym, zm]));
    }
    for (const h of holes) {
      if (h.y[1] < yR || h.y[0] > yE) continue;
      const Zh = Zl.filter((z) => z >= h.z[0] - 1e-9 && z <= h.z[1] + 1e-9);
      for (const [y, s] of [[h.y[0], 1], [h.y[1], -1]]) for (let k = 0; k + 1 < Zh.length; k += 1) {
        const [za, zb] = [Zh[k], Zh[k + 1]];
        push(face([[sx * hwIn(za), y, za], [sx * hw(za), y, za], [sx * hw(zb), y, zb], [sx * hwIn(zb), y, zb]], 'trim.lining', [sx * hw(za), y - s, (za + zb) / 2]));
      }
      for (const [z, s] of [...(h.sill ? [[h.z[0], 1]] : []), [h.z[1], -1]]) push(face([[sx * hwIn(z), h.y[0], z], [sx * hw(z), h.y[0], z], [sx * hw(z), h.y[1], z], [sx * hwIn(z), h.y[1], z]], 'trim.lining', [sx * hw(z), (h.y[0] + h.y[1]) / 2, z - s]));
    }
  }
  // ── the floor: across, its door zones in their own colour, a threshold at each door's leaves ──
  const wf = hwIn(floor + 0.02);
  for (let i = 0; i + 1 < Yl.length; i += 1) {
    const [y0, y1] = [Yl[i], Yl[i + 1]], ym = (y0 + y1) / 2;
    if (cab && y0 >= cab.partition - 1e-9) continue;
    push(face([[-wf, y0, floor], [wf, y0, floor], [wf, y1, floor], [-wf, y1, floor]], zones.some((z) => ym > z.y[0] && ym < z.y[1] && (z.kind === 'door' || (ym > z.door[0] - 0.3 && ym < z.door[1] + 0.3))) ? 'trim.floor.door' : 'trim.floor', [0, ym, floor - 1]));
  }
  for (const [a, b] of O.doors) for (const s of [1, -1]) push(face([[s * (wf - 0.14), a, floor + 0.004], [s * wf, a, floor + 0.004], [s * wf, b, floor + 0.004], [s * (wf - 0.14), b, floor + 0.004]], 'trim.threshold', [0, (a + b) / 2, floor - 1]));
  // ── the ceiling: two halves at its height, its lamps in strips broken at the partitions ──
  const wc = hwIn(zC), breaks = [yR, ...I.partitions.map((p) => p.y).filter((y) => y > yR + 0.3 && y < yE - 0.3), yE].sort((a, b) => a - b);
  for (let i = 0; i + 1 < Yl.length; i += 1) for (const s of [1, -1]) {
    const [y0, y1] = [Yl[i], Yl[i + 1]];
    push(face([[0, y0, zC], [s * wc, y0, zC], [s * wc, y1, zC], [0, y1, zC]], 'trim.ceiling', [0, (y0 + y1) / 2, zC + 1]));
  }
  for (let i = 0; i + 1 < breaks.length; i += 1) {
    const [a, b] = [breaks[i] + 0.25, breaks[i + 1] - 0.25];
    if (b - a > 0.4) for (const s of [1, -1]) box(out, s > 0 ? [wc - 0.46, wc - 0.26] : [-wc + 0.26, -wc + 0.46], [a, b], [zC - 0.035, zC], 'trim.lamp');
  }

  // ── the partitions across: a wall between two edges (the lining's, or a compartment's), its opening and its frame ──
  const across = (y, lo, hi, op, part) => {
    const Zp = samples(Zl, op ? [op.z[1]] : [], floor, zC, 0.008);
    for (let k = 0; k + 1 < Zp.length; k += 1) {
      const [za, zb] = [Zp[k], Zp[k + 1]], from = [0, y - 1, (za + zb) / 2];
      const piece = (xa, xb) => push(face([[xa(za), y, za], [xb(za), y, za], [xb(zb), y, zb], [xa(zb), y, zb]], part, from));
      if (op && zb <= op.z[1] + 1e-9) { if (op.x[0] > lo(za) + 0.01) piece(lo, () => op.x[0]); if (op.x[1] < hi(za) - 0.01) piece(() => op.x[1], hi); }
      else piece(lo, hi);
    }
    if (op) {
      for (const x of op.x) box(out, [x - 0.03, x + 0.03], [y - 0.04, y + 0.04], [floor, op.z[1]], 'partition.frame');
      box(out, [op.x[0] - 0.03, op.x[1] + 0.03], [y - 0.04, y + 0.04], [op.z[1], op.z[1] + 0.06], 'partition.frame');
    }
  };
  for (const p of I.partitions) {
    if (p.kind === 'compartment') { across(p.y, () => p.x[0], (z) => Math.min(p.x[1], hwIn(z)), null, 'partition'); continue; }
    across(p.y, (z) => -hwIn(z), (z) => hwIn(z), p.opening, 'partition');
  }
  // (a corridor's wall along: panelled below, glazed above, a doorway into each compartment)
  for (const w of I.walls) {
    const Ys = samples([w.y[0], w.y[1]], w.doors.flat(), w.y[0], w.y[1], 0.005), Zs = [floor, w.glazed[0], w.glazed[1], zC];
    for (let i = 0; i + 1 < Ys.length; i += 1) for (let k = 0; k + 1 < Zs.length; k += 1) {
      const [y0, y1, z0, z1] = [Ys[i], Ys[i + 1], Zs[k], Zs[k + 1]], ym = (y0 + y1) / 2;
      const door = w.doors.some(([a, b]) => ym > a && ym < b);
      if (door && z1 <= w.glazed[1] + 1e-9) continue;
      push(face([[w.x, y0, z0], [w.x, y1, z0], [w.x, y1, z1], [w.x, y0, z1]], k === 1 && !door ? 'glass.draft' : 'partition', [w.x - 1, ym, (z0 + z1) / 2]));
    }
    for (const [a, b] of w.doors) {
      for (const y of [a, b]) box(out, [w.x - 0.04, w.x + 0.04], [y - 0.03, y + 0.03], [floor, w.glazed[1]], 'partition.frame');
      box(out, [w.x - 0.04, w.x + 0.04], [a - 0.03, b + 0.03], [w.glazed[1], w.glazed[1] + 0.06], 'partition.frame');
    }
  }

  // ── a low floor's podiums over its bogies, their tops at their level, and the steps up to them and to a raised cab ──
  for (const q of I.podiums) {
    if (cab && q.y[0] >= cab.partition - 1e-6) continue;
    const y1 = cab ? Math.min(q.y[1], cab.partition) : q.y[1], w = hwIn(q.z) - 0.005;
    box(out, [-w, w], [q.y[0], y1], [floor, q.z], 'trim.floor');
  }
  for (const z of I.zones.filter((q) => q.kind === 'step')) { const w = hwIn(floor + z.rise / 2) - 0.005; box(out, [-w, w], z.y, [floor, floor + z.rise / 2], 'trim.step'); }
  // ── the seats, each on its level ──
  const rec = 0.1, BK = 0.08;
  const backSlab = (x, yb, f, z0, z1) => {
    // (a back reclined: its foot at the cushion's rear, its top leaning away from the way it faces)
    const ya = [yb, yb + f * BK].sort((p, q) => p - q), yt = ya.map((v) => v - f * rec);
    hexa(out, [[x[0], ya[0], z0], [x[1], ya[0], z0], [x[1], ya[1], z0], [x[0], ya[1], z0], [x[0], yt[0], z1], [x[1], yt[0], z1], [x[1], yt[1], z1], [x[0], yt[1], z1]], 'seat.back');
  };
  for (const s of I.seats) {
    const fl = s.floor ?? floor, zs = fl + 0.46, zcu = fl + 0.38;
    if (s.kind === 'perch') {
      box(out, s.x, [s.y[0] + 0.1, s.y[1] - 0.1], [fl + 0.68, fl + 0.78], 'seat.cushion');
      const xr = s.side > 0 ? s.x[0] - 0.05 : s.x[1] + 0.05;
      cylinder(out, [xr, s.y[0] + 0.1, fl + 0.95], [xr, s.y[1] - 0.1, fl + 0.95], 0.016, LOD.round, 'rail.grab');
      const xz = s.side > 0 ? [s.x[1] - 1.0, s.x[1] - 0.05] : [s.x[0] + 0.05, s.x[0] + 1.0];
      push(face([[xz[0], s.y[0], fl + 0.004], [xz[1], s.y[0], fl + 0.004], [xz[1], s.y[1], fl + 0.004], [xz[0], s.y[1], fl + 0.004]], 'trim.floor.zone', [0, s.y[0], fl - 1]));
      continue;
    }
    if (s.kind === 'bench' && !s.across) {
      // (a bench along the wall: a cushion a place, its back against the lining, its plinth set back under it)
      const outer = s.side > 0 ? s.x[1] : s.x[0], inner = s.side > 0 ? s.x[0] : s.x[1], n = Math.max(1, s.places), step = (s.y[1] - s.y[0]) / n;
      box(out, [Math.min(outer, inner + s.side * 0.14), Math.max(outer, inner + s.side * 0.14)], s.y, [fl, zcu], 'seat.frame');
      for (let k = 0; k < n; k += 1) {
        const y = [s.y[0] + k * step + 0.005, s.y[0] + (k + 1) * step - 0.005];
        box(out, [s.x[0], s.x[1]], y, [zcu, zs], 'seat.cushion');
        const xb = s.side > 0 ? [outer - 0.1, outer] : [outer, outer + 0.1];
        box(out, xb, y, [zs, fl + N.back], 'seat.back');
      }
      continue;
    }
    // (a unit across: its places side by side, each a cushion, a reclined back and perhaps a headrest; armrests at its
    //  ends; its frame under it)
    const f = s.facing, yb = s.back, n = Math.max(1, s.places), dep = N.depth, w = (s.x[1] - s.x[0] - (s.kind === 'row' ? 0.05 : 0)) / n, x0 = s.x[0] + (s.kind === 'row' ? 0.025 : 0);
    const yc = [yb + f * BK, yb + f * (BK + dep)].sort((p, q) => p - q);
    box(out, [s.x[0] + 0.08, s.x[1] - 0.08], [Math.min(yc[0], yc[1]) + 0.08, Math.max(yc[0], yc[1]) - 0.08], [fl, zcu], 'seat.frame');
    for (let k = 0; k < n; k += 1) {
      const x = [x0 + k * w + 0.008, x0 + (k + 1) * w - 0.008];
      box(out, x, yc, [zcu, zs], 'seat.cushion');
      backSlab(x, yb, f, zs - 0.04, fl + N.back);
      if (N.headrests) { const yh = [yb, yb + f * BK].map((v) => v - f * (rec + 0.01)).sort((p, q) => p - q); box(out, [x[0] + 0.05, x[1] - 0.05], yh, [fl + N.back, fl + N.back + 0.2], 'seat.headrest'); }
    }
    if (s.kind === 'row') for (const xa of [s.x[0], s.x[1] - 0.04]) box(out, [xa, xa + 0.04], [yc[0] + 0.06, yc[1] - 0.04], [zs + 0.15, zs + 0.2], 'seat.armrest');
  }
  for (const tb of I.tables) {
    box(out, tb.x, tb.y, [tb.z - 0.03, tb.z], 'table');
    const xl = tb.side > 0 ? tb.x[0] + 0.06 : tb.x[1] - 0.06, ym = (tb.y[0] + tb.y[1]) / 2;
    box(out, [xl - 0.03, xl + 0.03], [ym - 0.03, ym + 0.03], [tb.floor ?? floor, tb.z - 0.03], 'seat.frame');
  }
  for (const r of I.racks) {
    const [xa, xb] = r.x, inner = r.side > 0 ? xa : xb, outer = r.side > 0 ? xb : xa;
    box(out, r.x, r.y, [r.z, r.z + 0.025], 'rack');
    box(out, [inner - 0.012, inner + 0.012], r.y, [r.z, r.z + 0.08], 'rack');
    for (let y = r.y[0] + 0.1; y < r.y[1]; y += 1.6) box(out, [Math.min(outer, inner + r.side * 0.06), Math.max(outer, inner + r.side * 0.06)], [y - 0.015, y + 0.015], [r.z - 0.14, r.z], 'rack');
  }
  // ── holding: poles, rails on their hangers, draft screens, displays ──
  for (const p of I.poles) cylinder(out, [p.x, p.y, floor], [p.x, p.y, zC], 0.019, LOD.round, 'rail.grab');
  for (const r of I.rails) {
    cylinder(out, [r.x, r.y[0] + 0.1, r.z], [r.x, r.y[1] - 0.1, r.z], 0.016, LOD.round, 'rail.grab');
    const n = Math.max(1, Math.round((r.y[1] - r.y[0]) / 2));
    for (let k = 0; k <= n; k += 1) { const y = r.y[0] + 0.15 + ((r.y[1] - r.y[0] - 0.3) * k) / n; cylinder(out, [r.x, y, r.z], [r.x, y, zC], 0.012, LOD.round, 'rail.grab'); }
  }
  for (const sc of I.screens) {
    box(out, sc.x, [sc.y - 0.012, sc.y + 0.012], sc.z, 'glass.draft');
    cylinder(out, [sc.x[0], sc.y, sc.z[1]], [sc.x[1], sc.y, sc.z[1]], 0.018, LOD.round, 'rail.grab');
  }
  for (const ds of I.displays) { const z = Math.min(ds.z, zC - 0.18), x = hwIn(z + 0.14); box(out, ds.side > 0 ? [x - 0.05, x] : [-x, -x + 0.05], [ds.y - 0.35, ds.y + 0.35], [z, z + 0.14], 'sign.display'); }
  // ── a machine room's cabinets and their panels; a washroom's module and its door ──
  for (const e of I.equipment) {
    box(out, e.x, e.y, e.z, 'equipment');
    for (const [xa, s] of [[e.x[0], -1], [e.x[1], 1]]) box(out, s > 0 ? [xa, xa + 0.012] : [xa - 0.012, xa], [e.y[0] + 0.08, e.y[1] - 0.08], [e.z[0] + 0.12, e.z[1] - 0.1], 'equipment.panel');
  }
  for (const w of I.washrooms) {
    box(out, w.x, w.y, [floor, floor + 2.1], 'module');
    const xa = w.side > 0 ? w.x[0] : w.x[1], ym = (w.y[0] + w.y[1]) / 2;
    box(out, w.side > 0 ? [xa - 0.015, xa] : [xa, xa + 0.015], [ym - 0.36, ym + 0.36], [floor + 0.02, floor + 1.95], 'partition.door');
  }
  // ── the cab: its raised floor in slices as far as the nose lets it, the desk, its displays and controller, the seats ──
  if (cab) {
    const [db, df] = cab.desk.y, h = cab.desk.half, [zt0, zt1] = cab.desk.z, cf = cab.floor;
    for (let y = cab.partition; y < df - 1e-6; y += 0.2) {
      const y1 = Math.min(df, y + 0.2), w = Math.max(0.2, insideHalfWidth(d, y1, cf) - 0.01);
      box(out, [-w, w], [y, y1], [floor, cf], 'cab.floor');
    }
    hexa(out, [[-h, db, cf], [h, db, cf], [h, df, cf], [-h, df, cf], [-h, db, zt0], [h, db, zt0], [h, df, zt1], [-h, df, zt1]], 'cab.desk');
    const zAt = (y) => zt0 + ((zt1 - zt0) * (y - db)) / (df - db), xd = cab.driver;
    for (const xa of [xd - 0.42, xd + 0.06]) box(out, [xa, xa + 0.36], [df - 0.22, df - 0.18], [zAt(df - 0.2), zAt(df - 0.2) + 0.24], 'cab.display');
    box(out, [xd - 0.5, xd - 0.4], [db + 0.12, db + 0.26], [zAt(db + 0.19), zAt(db + 0.19) + 0.1], 'cab.controller');
    cylinder(out, [xd - 0.45, db + 0.19, zAt(db + 0.19) + 0.1], [xd - 0.45, db + 0.19, zAt(db + 0.19) + 0.22], 0.014, LOD.round, 'cab.controller');
    for (const st of cab.seats) {
      const x = [st.x - 0.25, st.x + 0.25], [sb, sf] = st.y;
      cylinder(out, [st.x, (sb + sf) / 2, cf], [st.x, (sb + sf) / 2, st.z - 0.08], 0.06, LOD.round, 'seat.frame');
      box(out, x, [sb + 0.1, sf], [st.z - 0.08, st.z], 'seat.cushion');
      hexa(out, [[x[0], sb, st.z], [x[1], sb, st.z], [x[1], sb + 0.1, st.z], [x[0], sb + 0.1, st.z], [x[0], sb - 0.1, st.z + 0.62], [x[1], sb - 0.1, st.z + 0.62], [x[1], sb, st.z + 0.62], [x[0], sb, st.z + 0.62]], 'seat.back');
      box(out, [x[0] + 0.07, x[1] - 0.07], [sb - 0.12, sb - 0.03], [st.z + 0.62, st.z + 0.8], 'seat.headrest');
    }
  }
  const faces = out.map((f) => ({ ...f, fill: T[ROLE[f.part]] ?? T.lining, inside: true }));
  const parts = {};
  for (const f of faces) parts[f.part] = (parts[f.part] || 0) + 1;
  return { faces, census: { faces: faces.length, triangles: faces.reduce((n, f) => n + f.corners.length - 2, 0), parts } };
}

/** The compiled thing (a car, a cab car, a train) with its near half opened, so its inside reads from that side: its
 *  shell's faces wholly on that side above `above` dropped, and whatever stands wholly over `lid` (its roof's units and
 *  pantographs); its inside's lining, ceiling, lamps and displays on that side. */
export function cutAway(compiled, { side = 1, above = 0, lid = Infinity } = {}) {
  const near = (f) => f.corners.every((p) => p[0] * side >= -0.02), over = (z) => (f) => f.corners.every((p) => p[2] >= z - 1e-6);
  const faces = {};
  for (const [k, list] of Object.entries(compiled.faces)) {
    faces[k] = list.filter((f) => (f.inside ? !(LINING_PARTS.has(f.part) && near(f)) : !((near(f) && over(above)(f)) || over(lid)(f))));
  }
  return { ...compiled, faces };
}
