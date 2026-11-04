/**
 * bogie-surface — the surface compiler of a bogie (bogie-odm.js solves it): named quads at a level of detail, each with
 * its part, its material, its outward normal and its crease-aware corner normals (rail-geom.js).
 *
 *   wheelsets   each wheel revolved from its profile on the gauge (its flange inboard, its tread tapered: part
 *               `wheel.tread` where it meets the rail, `wheel` the rest of it, a mark on its web to read its turn),
 *               the axle between them, the axle boxes outboard with their covers
 *   frame       an H-frame's two side beams over the axle boxes, dipping between the axles to the secondary's seat, its
 *               transoms across; or a three-piece truck's cast side frames (their top and tension members, their
 *               columns, their pedestal jaws round the boxes) and the bolster through them with its centre bowl
 *   suspension  the primaries over the boxes (coil springs as helices, a tram's rubber chevrons), the secondaries
 *               (air springs revolved from their bellows, coil pairs, a locomotive's flexicoils, a freight truck's
 *               spring nests under its bolster), the pivot block the body sits on, the dampers (vertical, lateral, yaw)
 *   drive       motors on the transoms with their gearboxes on the axles (frame-mounted), or nose-suspended motors
 *               hung between the axle and the transom
 *   brakes      discs on the axles with their calipers, blocks on the wheels' treads, a tram's track brake shoes over
 *               the rails, sand pipes, and on a leading bogie the lifeguards before its first wheels
 *
 *   compileBogieSurface(brief, { quality, pose: { spin, yaw }, lead }) → { design, quality, faces, hardpoints, joints,
 *                                                                          census }
 *     spin  degrees the wheelsets have turned (their mark and their discs turn with them)
 *     yaw   degrees the bogie has swung about its pivot (a curve's): every face and every hardpoint turned with it
 *
 * Bogie space: the origin on its centre at the top of the rail, +y forward, +x right, z up. Pure and deterministic.
 */
import { solveBogieDesign, axlesOf } from './bogie-odm.js';
import { r4, add, mul, face, box, cylinder, revolve, finishRailFaces } from './rail-geom.js';

export const BOGIE_LODS = Object.freeze({
  game: Object.freeze({ wheel: 14, coil: 6, turns: 4, round: 10 }),
  studio: Object.freeze({ wheel: 24, coil: 8, turns: 5, round: 14 }),
  hero: Object.freeze({ wheel: 40, coil: 10, turns: 6, round: 20 }),
});
const COLOURS = Object.freeze({ frame: '#2b2d2f', wheel: '#4a4541', tread: '#b8bcbf', mark: '#d9d4c7', box: '#36393c', spring: '#3c3f42', rubber: '#1d1e1f',
  motor: '#33363a', disc: '#8d8f91', damper: '#c9a227', shoe: '#3d3f41', steel: '#7d8287' });
const DEG = Math.PI / 180;

// (a coil spring: a helix of n turns from z0 to z1 about (x, y), its wire a chain of prisms)
function coil(out, [x, y], z0, z1, R, wire, turns, sides, part) {
  const steps = turns * sides, pt = (k) => { const a = (2 * Math.PI * k) / sides; return [x + R * Math.cos(a), y + R * Math.sin(a), z0 + wire + ((z1 - z0 - 2 * wire) * k) / steps]; };
  for (let k = 0; k < steps; k += 1) cylinder(out, pt(k), pt(k + 1), wire, 5, part, { caps: false });
  for (const z of [z0 + wire * 0.5, z1 - wire * 0.5]) cylinder(out, [x, y, z - wire * 0.5], [x, y, z + wire * 0.5], R + wire, sides, part);
}
// (a beam along y through stations [y, zBottom, zTop] at x0…x1: its sides, its top and bottom, its ends capped)
function beam(out, x0, x1, st, part) {
  for (let i = 0; i + 1 < st.length; i += 1) {
    const [ya, ba, ta] = st[i], [yb, bb, tb] = st[i + 1], c = [(x0 + x1) / 2, (ya + yb) / 2, (ba + ta + bb + tb) / 4];
    for (const q of [[[x1, ya, ba], [x1, yb, bb], [x1, yb, tb], [x1, ya, ta]], [[x0, ya, ba], [x0, ya, ta], [x0, yb, tb], [x0, yb, bb]],
      [[x0, ya, ta], [x1, ya, ta], [x1, yb, tb], [x0, yb, tb]], [[x0, ya, ba], [x0, yb, bb], [x1, yb, bb], [x1, ya, ba]]]) { const f = face(q, part, c); if (f) out.push(f); }
  }
  for (const [[y, b, t], s] of [[st[0], -1], [st.at(-1), 1]]) { const f = face([[x0, y, b], [x1, y, b], [x1, y, t], [x0, y, t]], part, [(x0 + x1) / 2, y - s, (b + t) / 2]); if (f) out.push(f); }
}

export function compileBogieSurface(brief = {}, { quality = 'studio', pose = {}, lead = false } = {}) {
  const LOD = BOGIE_LODS[quality];
  if (!LOD) throw new Error(`rail-bogie: quality is ${Object.keys(BOGIE_LODS).join(', ')}`);
  const d = brief.profile && brief.frame ? brief : solveBogieDesign(brief);
  if (!d.valid) throw new Error(`rail-bogie: the design fails its laws (${d.laws.filter((l) => !l.pass).map((l) => l.id).join(', ')})`);
  const spin = (Number(pose.spin) || 0) * DEG, yaw = (Number(pose.yaw) || 0) * DEG;
  const r = d.wheel / 2, PR = d.profile, BX = d.box, FR = d.frame, ys = axlesOf(d), g = d.gauge / 2, heavy = d.archetype.startsWith('loco');
  const wheelsets = [], frame = [], suspension = [], drive = [], brakes = [];

  // ── the wheelsets: each wheel revolved from its profile (flange inboard, tapered tread), the axle, the boxes ──
  const xi = PR.inner, xo = PR.outer, ft = PR.flangeThickness, fh = PR.flange, rb = 0.095, rh = Math.max(0.15, 0.36 * r), xt = xi + 0.07;
  const tread = (x) => r - (x - xt) * PR.taper;
  // (the profile in (x, r), round from the bore: the hub's inner face, the web's, the rim, the flange, the tread, the
  // rim's outer face, the web's, the hub's outer face)
  const prof = [[xi - 0.045, rb], [xo + 0.02, rb], [xo + 0.02, rh], [xi + 0.085, rh + 0.03], [xi + 0.085, r - 0.07], [xo, r - 0.06], [xo, tread(xo)],
    [xi + ft + 0.008, tread(xi + ft + 0.008)], [xi + ft, r + 0.008], [xi + 0.02, r + fh], [xi + 0.006, r + fh - 0.004], [xi, r + fh - 0.012], [xi, r - 0.06],
    [xi + 0.045, r - 0.07], [xi + 0.045, rh + 0.03], [xi - 0.045, rh]];
  const treadEdges = new Set([6, 7, 8, 9, 10]);
  for (const ya of ys) {
    for (const sx of [1, -1]) {
      revolve(wheelsets, prof, { y0: ya, z0: r, sx, n: LOD.wheel, a0: spin, partOf: (i) => (treadEdges.has(i) ? 'wheel.tread' : 'wheel') });
      // (a mark on the web, turned with the wheel)
      const a = spin + Math.PI / 4, m = [sx * (xi + 0.088), ya + (r - 0.16) * Math.cos(a), r + (r - 0.16) * Math.sin(a)];
      box(wheelsets, [m[0] - 0.006 + (sx > 0 ? 0 : -0.004), m[0] + 0.006 + (sx > 0 ? 0.004 : 0)], [m[1] - 0.04, m[1] + 0.04], [m[2] - 0.04, m[2] + 0.04], 'wheel.mark');
      // (the axle box outboard, its cover)
      cylinder(wheelsets, [sx * BX.inner, ya, r], [sx * BX.outer, ya, r], BX.half, LOD.round, 'bogie.box');
      cylinder(wheelsets, [sx * BX.outer, ya, r], [sx * (BX.outer + 0.025), ya, r], BX.half * 0.8, LOD.round, 'bogie.box');
    }
    cylinder(wheelsets, [-(BX.inner + 0.01), ya, r], [BX.inner + 0.01, ya, r], heavy ? 0.11 : 0.085, 10, 'axle', { caps: false });
  }
  const yEnd = FR.length / 2;

  if (FR.kind === 'h') {
    // ── an H-frame: side beams over the boxes, dipping between the axles to the secondary's seat; transoms across ──
    const top = FR.z0 + FR.depth, dipAt = (y) => { let w = 0; for (let i = 0; i + 1 < ys.length; i += 1) { const m = (ys[i] + ys[i + 1]) / 2, h = (ys[i + 1] - ys[i]) / 2 - BX.half - 0.12; if (Math.abs(y - m) < h) w = Math.max(w, 0.5 + 0.5 * Math.cos((Math.PI * (y - m)) / h)); } return w * FR.dip; };
    const st = Array.from({ length: 25 }, (_, k) => { const y = -yEnd + (2 * yEnd * k) / 24, dz = dipAt(y), end = Math.max(0, (Math.abs(y) - (yEnd - 0.35)) / 0.35); return [r4(y), r4(FR.z0 - dz + end * FR.depth * 0.3), r4(top - dz)]; });
    for (const sx of [1, -1]) beam(frame, Math.min(sx * (FR.x - FR.width / 2), sx * (FR.x + FR.width / 2)), Math.max(sx * (FR.x - FR.width / 2), sx * (FR.x + FR.width / 2)), st, 'bogie.frame');
    const seat = top - FR.dip, tr = ys.length === 3 ? [(ys[0] + ys[1]) / 2, (ys[1] + ys[2]) / 2] : [-0.2 * d.base, 0.2 * d.base];
    for (const yt of tr) box(frame, [-(FR.x - FR.width / 2), FR.x - FR.width / 2], [yt - 0.14, yt + 0.14], [seat - FR.depth * 0.85, seat - 0.04], 'bogie.frame');
    // ── the primaries over the boxes: two coils fore and aft of each box, or a tram's rubber chevrons ──
    for (const ya of ys) for (const sx of [1, -1]) {
      const zb = r + BX.half, zt = FR.z0, x = sx * FR.x;
      if (d.primary.kind === 'coil') for (const s of [-1, 1]) coil(suspension, [x, ya + s * (BX.half + 0.07)], zb - 0.02, zt, heavy ? 0.085 : 0.07, heavy ? 0.022 : 0.016, LOD.turns, LOD.coil, 'bogie.spring');
      else if (d.primary.kind === 'chevron') for (const s of [-1, 1]) for (let k = 0; k < 3; k += 1) {
        const z0 = zb + ((zt - zb) * k) / 3, z1 = zb + ((zt - zb) * (k + 1)) / 3 - 0.008;
        box(suspension, [x - FR.width / 2, x + FR.width / 2], [ya + s * (BX.half - 0.02) - 0.05, ya + s * (BX.half - 0.02) + 0.05], [z0, z1], k === 1 ? 'bogie.box' : 'bogie.chevron');
      }
      // (the box's seat under the spring)
      box(suspension, [x - FR.width / 2 - 0.02, x + FR.width / 2 + 0.02], [ya - BX.half - 0.15, ya + BX.half + 0.15], [zb - 0.03, zb], 'bogie.box');
    }
    // ── the secondaries on the beams' dip: air springs, coil pairs, flexicoils; the pivot block between them ──
    const H = d.secondary.height;
    for (const sx of [1, -1]) {
      const x = sx * FR.x;
      if (d.secondary.kind === 'air') {
        const R = Math.min(0.3, 0.26 * (d.gauge / 1.435));
        revolve(suspension, [[seat, 0], [seat, R * 0.7], [seat + H * 0.25, R], [seat + H * 0.55, R * 1.05], [seat + H - 0.03, R * 0.85], [seat + H, R * 0.6], [seat + H, 0]],
          { axis: 'z', at: [x, 0], n: LOD.round, partOf: () => 'bogie.air' });
      } else {
        const R = d.secondary.kind === 'flexicoil' ? 0.13 : 0.08, w = d.secondary.kind === 'flexicoil' ? 0.032 : 0.02;
        for (const s of [-1, 1]) coil(suspension, [x, s * 0.32], seat, seat + H, R, w, LOD.turns, LOD.coil, 'bogie.spring');
      }
    }
    box(suspension, [-0.26, 0.26], [-0.2, 0.2], [seat - 0.06, d.pivot.z], 'bogie.pivot');
    // ── the drive: frame-mounted motors on the transoms and their gearboxes on the axles; or nose-suspended motors ──
    for (const [k, ya] of ys.entries()) {
      if (k >= d.drive.motors) break;
      const s = ya === 0 ? 1 : -Math.sign(ya);
      if (d.drive.kind === 'frame') {
        const ym = ya + s * 0.62, Rm = 0.2 * Math.sqrt(d.wheel / 0.84);
        cylinder(drive, [-0.42, ym, r + 0.04], [0.36, ym, r + 0.04], Rm, LOD.round, 'drive.motor');
        box(drive, [0.4, 0.6], [ya - 0.24, ya + 0.24], [r - 0.2, r + 0.2], 'drive.gear');
        cylinder(drive, [0.36, ym, r + 0.04], [0.42, ya + s * 0.22, r + 0.02], 0.06, 8, 'drive.gear');
      } else if (d.drive.kind === 'nose') {
        const ym = ya + s * (r * 0.62), Rm = 0.3 * Math.sqrt(d.wheel / 1.25);
        cylinder(drive, [-0.5, ym, r + 0.02], [0.44, ym, r + 0.02], Rm, LOD.round, 'drive.motor');
        box(drive, [0.46, 0.64], [ya - 0.3, ya + 0.3], [r - 0.32, r + 0.26], 'drive.gear');
        box(drive, [-0.18, 0.18], [ym + s * Rm * 0.8, ym + s * (Rm + 0.25)], [r + 0.1, seat - 0.05], 'drive.motor');
      }
    }
  } else {
    // ── a three-piece truck: cast side frames round the boxes, the bolster through them on its spring nests ──
    const zTop0 = r + 0.16, zTop1 = r + 0.3, zLow = r - 0.24, cols = 0.36, x = FR.x, hw = Math.max(0.1, FR.width / 2);
    for (const sx of [1, -1]) {
      const X = [Math.min(sx * (x - hw), sx * (x + hw)), Math.max(sx * (x - hw), sx * (x + hw))];
      beam(frame, X[0], X[1], [[-yEnd + 0.05, zTop0 + 0.04, zTop1], [yEnd - 0.05, zTop0 + 0.04, zTop1]], 'bogie.frame');
      beam(frame, X[0], X[1], [[ys[0] + BX.half + 0.08, r - 0.06, r + 0.06], [-cols, zLow, zLow + 0.12], [cols, zLow, zLow + 0.12], [ys.at(-1) - BX.half - 0.08, r - 0.06, r + 0.06]], 'bogie.frame');
      for (const yc of [-cols, cols]) box(frame, X, [yc - 0.06, yc + 0.06], [zLow + 0.06, zTop0 + 0.06], 'bogie.frame');
      for (const ya of ys) for (const s of [-1, 1]) box(frame, X, [ya + s * (BX.half + 0.02) - 0.04, ya + s * (BX.half + 0.02) + 0.04], [r - 0.12, zTop1], 'bogie.frame');
      // (the spring nest under the bolster's end, in the frame's window)
      for (const yk of [-0.18, 0, 0.18]) coil(suspension, [sx * x, yk], zLow + 0.12, r - 0.02, 0.05, 0.014, LOD.turns, LOD.coil, 'bogie.spring');
      // (the friction wedges beside the bolster's end)
      for (const s of [-1, 1]) box(suspension, X, [s * 0.2 - 0.04, s * 0.2 + 0.04], [r - 0.02, r + 0.12], 'bogie.frame');
    }
    box(frame, [-(x + hw + 0.06), x + hw + 0.06], [-0.17, 0.17], [r - 0.02, r + 0.2], 'bogie.frame');
    cylinder(frame, [0, 0, r + 0.2], [0, 0, d.pivot.z], 0.18, LOD.round, 'bogie.pivot');
  }

  // ── the brakes: discs on the axles and their calipers, blocks on the treads, track brake shoes, sand ──
  const seatZ = FR.kind === 'h' ? FR.z0 + FR.depth - FR.dip : r + 0.2;
  for (const ya of ys) {
    if (d.brakes.kind === 'disc') {
      const n = d.brakes.discs, xs = n === 1 ? [-0.3] : n === 2 ? [-0.3, 0.3] : [-0.34, 0, 0.34], Ro = Math.min(0.32, r - 0.12), Ri = 0.13;
      for (const x of xs) {
        revolve(brakes, [[x - 0.055, Ri], [x + 0.055, Ri], [x + 0.055, Ro], [x - 0.055, Ro]], { y0: ya, z0: r, n: LOD.round, a0: spin, partOf: () => 'brake.disc' });
        const s = ya >= 0 ? -1 : 1;
        box(brakes, [x - 0.09, x + 0.09], [ya + s * (Ro - 0.08), ya + s * (Ro + 0.06)], [r - 0.12, r + 0.12], 'bogie.caliper');
      }
    } else if (d.brakes.kind === 'tread') {
      for (const sx of [1, -1]) {
        const s = ya >= 0 ? -1 : 1, yb = ya + s * (r + 0.035), x0 = sx * (xi + ft + 0.01), x1 = sx * xo;
        box(brakes, [Math.min(x0, x1), Math.max(x0, x1)], [yb - 0.04, yb + 0.04], [r - 0.16, r + 0.16], 'bogie.shoe');
        box(brakes, [sx * (xi + 0.04) - 0.03, sx * (xi + 0.04) + 0.03], [yb + s * 0.04, yb + s * 0.1], [r - 0.05, Math.min(seatZ, r + 0.32)], 'bogie.frame');
      }
    }
  }
  if (d.brakes.track) for (const sx of [1, -1]) {
    const y1 = ys[1] - r - 0.1, y0 = ys[0] + r + 0.1;
    box(brakes, [sx * g - 0.04, sx * g + 0.04], [y0, y1], [0.01, 0.1], 'bogie.trackbrake');
    for (const y of [y0 + 0.12, y1 - 0.12]) box(brakes, [sx * g - 0.02, sx * g + 0.02], [y - 0.02, y + 0.02], [0.1, FR.z0 - FR.dip], 'bogie.frame');
  }
  if (d.sand) for (const sx of [1, -1]) {
    const y = ys.at(-1) + r + 0.12;
    box(brakes, [sx * FR.x - 0.1, sx * FR.x + 0.1], [y - 0.02, y + 0.22], [FR.z0, FR.z0 + FR.depth + 0.1], 'bogie.sandbox');
    cylinder(brakes, [sx * g, y + 0.04, FR.z0], [sx * g, y - 0.04, 0.08], 0.018, 6, 'bogie.sandbox', { caps: false });
  }
  if (lead) for (const sx of [1, -1]) box(brakes, [sx * g - 0.06, sx * g + 0.06], [ys.at(-1) + r + 0.22, ys.at(-1) + r + 0.3], [0.06, FR.z0 - FR.dip + 0.05], 'bogie.lifeguard');

  // ── the dampers: vertical beside the boxes, lateral across to the pivot, yaw along the frame's outside ──
  const damper = (a, b) => { cylinder(suspension, a, mul(add(a, b), 0.5), 0.034, 8, 'damper'); cylinder(suspension, mul(add(a, b), 0.5), b, 0.018, 6, 'damper'); };
  let yawN = 0;
  for (const kind of d.dampers) {
    if (kind === 'vertical') for (const ya of ys) for (const sx of [1, -1]) damper([sx * (BX.outer - 0.02), ya + 0.24, r + 0.02], [sx * (BX.outer - 0.02), ya + 0.24, FR.z0 + 0.05]);
    if (kind === 'lateral') damper([0.2, 0.16, seatZ + 0.04], [FR.x - FR.width / 2 - 0.05, 0.16, seatZ + 0.04]);
    if (kind === 'yaw') { const x = FR.x + FR.width / 2 + 0.07 + 0.11 * yawN++; for (const sx of [1, -1]) damper([sx * x, 0.25, seatZ + 0.12], [sx * x, yEnd - 0.25, seatZ + 0.12]); }
  }

  // ── the pose's yaw about the pivot; its colours; its finish ──
  const c = Math.cos(yaw), s = Math.sin(yaw), Z = (p) => [r4(p[0] * c - p[1] * s), r4(p[0] * s + p[1] * c), p[2]];
  const colourOf = (part) => ({ wheel: COLOURS.wheel, 'wheel.tread': COLOURS.tread, 'wheel.mark': COLOURS.mark, axle: COLOURS.steel, 'bogie.box': COLOURS.box, 'bogie.spring': COLOURS.spring,
    'bogie.chevron': COLOURS.rubber, 'bogie.air': COLOURS.rubber, 'drive.motor': COLOURS.motor, 'drive.gear': COLOURS.motor, 'brake.disc': COLOURS.disc, damper: COLOURS.damper,
    'bogie.trackbrake': COLOURS.shoe, 'bogie.shoe': COLOURS.shoe }[part] ?? COLOURS.frame);
  const groups = { wheelsets, frame, suspension, drive, brakes }, faces = {};
  for (const [k, list] of Object.entries(groups)) faces[k] = finishRailFaces(list.map((f) => ({ ...f, corners: f.corners.map(Z), outNormal: Z(f.outNormal), fill: colourOf(f.part) })));
  const all = Object.values(faces).flat(), parts = {};
  for (const f of all) parts[f.part] = (parts[f.part] || 0) + 1;
  const hardpoints = { pivot: [0, 0, d.pivot.z], axles: ys.map((y) => Z([0, y, r])), contacts: ys.flatMap((y) => [Z([g, y, 0]), Z([-g, y, 0])]) };
  const joints = [
    { name: 'spin', control: 'spin', kind: 'hinge', axis: 'x', axles: ys.length, angle: r4((spin / DEG) % 360) },
    { name: 'yaw', control: 'yaw', kind: 'hinge', at: [0, 0, d.pivot.z], dir: [0, 0, 1], angle: r4(yaw / DEG) },
  ];
  return { design: d, quality, faces, hardpoints, joints, census: { faces: all.length, triangles: all.reduce((t, f) => t + f.corners.length - 2, 0), materialGroups: new Set(all.map((f) => f.material)).size, parts } };
}
