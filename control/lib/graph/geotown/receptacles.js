/**
 * THE RECEPTACLES — a study shelf of the street's and the yard's rubbish containers, each built true to its kind at its
 * real size (the REALISTIC register: proportions as they are made), and the same kinds in the ASKEW register (a toon
 * cube's: each part sized by its own dice and knocked off its body's line, doodads.js `proportions`), so a style can be
 * judged against the thing it draws. A new kind is a row: { group, read, w, d, h (its plain footprint and height, m), build }.
 *
 *   RECEPTACLES                  the shelf, by id
 *   receptacleOf(id, D, R)       → faces [{ corners, out, hex }] about (0, 0), on z 0: its plain footprint in
 *                                  RECEPTACLES[id] (an askew one may overreach it: it is a drawing)
 *
 * Groups (RECEPTACLE_GROUPS): the LITTER bins (a wire-mesh corner basket; a steel drum under a dome; a liner bin on its
 * post; a 240-litre wheelie bin; a three-stream recycling station; a fluted cast-iron heritage bin; a solar compactor
 * kiosk; a bin under an ashtray dish; a bin in its concrete surround), the DUMPSTERS (front-load, rear-load, a roll-off
 * container, a builder's skip, a four-wheeled 1100-litre container, a bulk bag skip) and the DONATION bins (a clothing
 * drop with its chute, a book drop, a bottle bank igloo, a textile and shoe bank, a drop shed). Generic: no maker's
 * product is drawn.
 *
 * Metres, z up, the front toward −y. Pure; the dice are the caller's.
 */
import { tube, lathe, tilted, extrude } from './doodads.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P = (p) => p.map(r5);
const paint = (fs, hex) => fs.map((f) => ({ ...f, hex: f.hex ?? hex }));
// the colours a receptacle is made in
const C = Object.freeze({
  galv: '#9ea4a6', steel: '#5a6066', green: '#2f5a3e', black: '#1f2124', liner: '#2a2c2e', lid: '#3a3f44', wheel: '#151618',
  blue: '#2b5fa8', yellowBand: '#e8c02a', grey: '#6d7377', concrete: '#b9b4a8', panel: '#1d3a66', iron: '#20302a', gold: '#b8943a', sand: '#d8c9a0',
  dump: '#2f6b3f', rust: '#7a4a2e',
});

/** A box's faces (no floor) from x0..x1, y0..y1, z0..z1, its top `top` × as wide (a taper), its out the box's. */
function box(x0, y0, x1, y1, z0, z1, hex, top = 1) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, T = (x, y) => [cx + (x - cx) * top, cy + (y - cy) * top];
  const b = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], t = b.map(([x, y]) => T(x, y)), out = [];
  out.push({ corners: t.map(([x, y]) => P([x, y, z1])), out: [0, 0, 1], hex });
  const N = [[0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0]];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; out.push({ corners: [P([...b[i], z0]), P([...b[j], z0]), P([...t[j], z1]), P([...t[i], z1])], out: N[i], hex }); }
  return out;
}
/** A disc facing `n` at c, radius r, in triangles. */
function disc(c, r, n, hex, k = 14) {
  const A = n, ref = Math.abs(A[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], U = [A[1] * ref[2] - A[2] * ref[1], A[2] * ref[0] - A[0] * ref[2], A[0] * ref[1] - A[1] * ref[0]], l = Math.hypot(...U) || 1, u = U.map((v) => v / l), v = [A[1] * u[2] - A[2] * u[1], A[2] * u[0] - A[0] * u[2], A[0] * u[1] - A[1] * u[0]];
  const pt = (t) => P([c[0] + r * (Math.cos(t) * u[0] + Math.sin(t) * v[0]), c[1] + r * (Math.cos(t) * u[1] + Math.sin(t) * v[1]), c[2] + r * (Math.cos(t) * u[2] + Math.sin(t) * v[2])]);
  return Array.from({ length: k }, (_, i) => ({ corners: [P(c), pt((2 * Math.PI * i) / k), pt((2 * Math.PI * (i + 1)) / k)], out: n, hex }));
}
/** Faces sheared: x moved by `k` a metre up (an askew lean), about z 0. */
const shear = (fs, kx, ky = 0) => (kx || ky ? fs.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => P([x + kx * z, y + ky * z, z])) })) : fs);
/** Faces turned about z by `a` radians. */
const turn = (fs, a) => (a ? fs.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => P([x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z])), out: [f.out[0] * Math.cos(a) - f.out[1] * Math.sin(a), f.out[0] * Math.sin(a) + f.out[1] * Math.cos(a), f.out[2]] })) : fs);

const u = (R) => (lo, hi) => lo + (hi - lo) * R();

export const RECEPTACLES = Object.freeze({
  'mesh-basket': {
    group: 'litter', read: 'a wire-mesh corner basket: upright rods between three hoops, open at the top, on three short feet', w: 0.6, d: 0.6, h: 0.8,
    build(D, R) {
      const r = 0.3 * D.body, h = 0.8 * D.height, n = 18, tw = D.toon ? u(R)(-0.9, 0.9) : 0, flare = D.toon ? D.taper : 1, out = [];
      // (an askew one's rods twisted round it, its mouth flared or pinched)
      for (let i = 0; i < n; i++) {
        const a0 = (2 * Math.PI * i) / n, k = 5;
        out.push(...tube(Array.from({ length: k + 1 }, (_, j) => { const f = j / k, a = a0 + tw * f, rr = r * (1 + (flare - 1) * f) * (D.toon ? 1 + (D.bulge - 1) * Math.sin(Math.PI * f) * 0.6 : 1); return { c: [rr * Math.cos(a), rr * Math.sin(a), 0.08 + (h - 0.08) * f], r: 0.006 }; }), 4, 'rod', [false, false]));
      }
      for (const f of [0, 0.5, 1]) {
        const rr = r * (1 + (flare - 1) * f) * (D.toon ? 1 + (D.bulge - 1) * Math.sin(Math.PI * f) * 0.6 : 1) + 0.004, z = 0.08 + (h - 0.08) * f, k = 24;
        out.push(...tube(Array.from({ length: k + 1 }, (_, j) => { const a = (2 * Math.PI * j) / k + tw * f; return { c: [rr * Math.cos(a), rr * Math.sin(a), z], r: f === 1 ? 0.014 : 0.009, a: [-Math.sin(a), Math.cos(a), 0] }; }), 5, 'hoop', [false, false]));
      }
      // its floor: a disc of mesh (a plate here) and three feet
      out.push(...disc([0, 0, 0.08], r * 0.98, [0, 0, 1], C.galv));
      for (let i = 0; i < 3; i++) { const a = (2 * Math.PI * i) / 3; out.push(...tube([{ c: [r * 0.8 * Math.cos(a), r * 0.8 * Math.sin(a), 0], r: 0.015 }, { c: [r * 0.8 * Math.cos(a), r * 0.8 * Math.sin(a), 0.08], r: 0.015 }], 6, 'foot')); }
      return paint(out, C.galv);
    },
  },
  'dome-drum': {
    group: 'litter', read: 'a steel drum litter bin under a dome, its mouth an opening in the dome\'s side, a liner inside', w: 0.6, d: 0.6, h: 1.05,
    build(D, R) {
      const r = 0.28 * D.body, h = 0.78 * D.height, dome = r * 1.04 * (D.toon ? D.head * 0.7 : 1), lean = D.toon ? D.tilt : 0;
      const body = paint(lathe(0, 0, 0, [[r * 1.04, 0], [r * 1.04, 0.04], [r, 0.06], [r * D.bulge, h * 0.5], [r, h]], 20, 'body', () => [0, 0], [false, false]), C.green);
      const domeF = paint(tilted(0, 0, h, [[dome, 0], [dome, 0.04], [dome * 0.92, dome * 0.3], [dome * 0.6, dome * 0.62], [0, dome * 0.75]], 20, 'dome', lean, 0.7, 0.7), C.green);
      // its mouth: a dark opening in the dome's front, and the bands round the drum
      const mouth = disc([0, -dome * 0.86, h + dome * 0.28], dome * 0.32, [0, -1, 0.35], C.black);
      // (each band hugging the drum where it is: the profile's radius at that height, between its bulge at half and its ends)
      const rAt = (f) => (f < 0.5 ? r + (r * D.bulge - r) * Math.max(0, (f * 0.78 - 0.06) / (0.39 - 0.06)) : r * D.bulge + (r - r * D.bulge) * ((f - 0.5) / 0.5));
      const bands = [0.18, 0.62].flatMap((f) => { const rr = rAt(f) + 0.008; return paint(lathe(0, 0, h * f, [[rr, 0], [rr, 0.04]], 20, 'band', () => [0, 0], [false, false]), C.gold); });
      return [...body, ...domeF, ...mouth, ...bands];
    },
  },
  'post-liner': {
    group: 'litter', read: 'a liner bin on its post: a steel bin a little over knee high, its front a door, a post to the ground', w: 0.45, d: 0.4, h: 1.15,
    build(D, R) {
      const w = 0.42 * D.body, d = 0.34, h = 0.55 * D.height, z0 = 0.55 * (D.toon ? D.reach * 0.8 : 1), out = [];
      out.push(...paint(tube([{ c: [0, d / 2 + 0.03, 0], r: 0.035 }, { c: [0, d / 2 + 0.03, z0 + h * 0.9], r: 0.035 }], 10, 'post'), C.steel));
      const bin = [...box(-w / 2, -d / 2, w / 2, d / 2, z0, z0 + h, C.steel, D.taper), ...box(-w / 2 - 0.02, -d / 2 - 0.02, w / 2 + 0.02, d / 2 + 0.02, z0 + h, z0 + h + 0.04, C.lid)];
      bin.push(...box(-w / 2 + 0.06, -d / 2 - 0.006, w / 2 - 0.06, -d / 2, z0 + h * 0.62, z0 + h * 0.85, C.black));
      out.push(...(D.toon ? shear(bin.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x, y, z - z0]) })), D.tilt * 0.6).map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => P([x, y, z + z0])) })) : bin));
      return out;
    },
  },
  'wheelie-240': {
    group: 'litter', read: 'a 240-litre wheelie bin: a tapered body under a hinged lid that overhangs its front, two wheels and an axle at the back, a handle', w: 0.58, d: 0.74, h: 1.07,
    build(D, R) {
      const w = 0.58 * D.body, d = 0.72, h = 0.98 * D.height, top = D.toon ? D.taper : 1.12, wr = 0.1 * (D.toon ? (D.lid < 1 ? 0.7 : 1.9) : 1);
      const bot = 0.86, out = [...box(-w / 2 * bot, -d / 2 * bot, w / 2 * bot, d / 2 * bot, wr * 0.6, h, C.green, top / bot)];
      // its lid: a slab over the top's overhang, its front lip; an askew one flung a little open on its hinge at the back
      const lw = w * top / 2 + 0.03, ld = d * top / 2 + 0.05, open = D.toon ? u(R)(0.05, 0.4) : 0, hinge = [0, ld, h];
      const lid = [...box(-lw, -ld, lw, ld, h, h + 0.05, C.green), ...box(-lw, -ld - 0.02, lw, -ld, h - 0.06, h + 0.05, C.green)].map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => { const dy = y - hinge[1], dz = z - hinge[2]; return P([x, hinge[1] + dy * Math.cos(open) - dz * Math.sin(open), hinge[2] + dy * Math.sin(open) + dz * Math.cos(open)]); }) }));
      out.push(...lid);
      // its handle across the back, its axle and its two wheels
      out.push(...paint(tube([{ c: [-w * 0.42, d * top / 2 + 0.06, h - 0.06], r: 0.018, a: [1, 0, 0] }, { c: [w * 0.42, d * top / 2 + 0.06, h - 0.06], r: 0.018, a: [1, 0, 0] }], 8, 'handle'), C.black));
      out.push(...paint(tube([{ c: [-w / 2 - 0.05, d * 0.42, wr], r: 0.012, a: [1, 0, 0] }, { c: [w / 2 + 0.05, d * 0.42, wr], r: 0.012, a: [1, 0, 0] }], 6, 'axle'), C.steel));
      for (const s of [-1, 1]) out.push(...paint(tube([{ c: [s * (w / 2 + 0.005), d * 0.42, wr], r: wr, a: [1, 0, 0] }, { c: [s * (w / 2 + 0.055), d * 0.42, wr], r: wr, a: [1, 0, 0] }], 14, 'wheel', [true, true]), C.wheel));
      return D.toon ? shear(out, D.tilt * 0.3, 0) : out;
    },
  },
  'recycling-three': {
    group: 'litter', read: 'a three-stream recycling station: one long steel cabinet, three mouths in its sloped top, each stream a coloured band', w: 1.5, d: 0.5, h: 1.05,
    build(D, R) {
      const w = 1.5 * (D.toon ? 0.8 + 0.2 * D.body : 1), d = 0.48, h = 0.92, out = [], U = u(R);
      // (an askew one's three each its own height: no two streams one height)
      const hs = [0, 1, 2].map(() => h * (D.toon ? U(0.7, 1.35) : 1)), cw = w / 3;
      [C.blue, C.green, C.grey].forEach((band, i) => {
        const x0 = -w / 2 + i * cw, x1 = x0 + cw - 0.02, hh = hs[i];
        out.push(...box(x0, -d / 2, x1, d / 2, 0, hh, C.steel));
        // its sloped top, falling to the front, and its mouth in it
        const sl = 0.12;
        out.push({ corners: [P([x0, -d / 2, hh]), P([x1, -d / 2, hh]), P([x1, d / 2, hh + sl]), P([x0, d / 2, hh + sl])], out: [0, -0.24, 0.97], hex: C.steel });
        for (const [x, s] of [[x0, -1], [x1, 1]]) out.push({ corners: [P([x, -d / 2, hh]), P([x, d / 2, hh]), P([x, d / 2, hh + sl])], out: [s, 0, 0], hex: C.steel });
        out.push({ corners: [P([x0, d / 2, hh]), P([x1, d / 2, hh]), P([x1, d / 2, hh + sl]), P([x0, d / 2, hh + sl])], out: [0, 1, 0], hex: C.steel });
        const mr = (i === 0 ? 0.08 : i === 1 ? 0.1 : 0.13) * (D.toon ? D.head * 0.7 : 1);
        out.push(...disc([(x0 + x1) / 2, -0.02, hh + sl / 2 + 0.002], mr, [0, -0.24, 0.97], C.black));
        out.push(...box(x0 + 0.005, -d / 2 - 0.005, x1 - 0.005, -d / 2, hh * 0.78, hh * 0.9, band));
      });
      return out;
    },
  },
  'front-load': {
    group: 'dumpster', read: 'a front-load dumpster: a steel box its front sloped in, two plastic lids, fork pockets on its sides, on skids', w: 1.85, d: 1.3, h: 1.25,
    build(D, R) {
      const w = 1.85 * (D.toon ? 0.75 + 0.15 * D.body : 1), d = 1.3, h = 1.2 * D.height, U = u(R);
      // its side profile (y, z): its front sloping in to its base, its back square
      const prof = [[-d / 2 + 0.35, 0.1], [d / 2, 0.1], [d / 2, h], [-d / 2, h], [-d / 2, h * 0.62]];
      const out = paint(extrude(prof, () => w, 'v', 'body').map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [x, y, z]) })), C.dump);
      for (const s of [-1, 1]) out.push(...box(s > 0 ? w / 2 : -w / 2 - 0.14, -0.2, s > 0 ? w / 2 + 0.14 : -w / 2, 0.2, h * 0.5, h * 0.62, C.steel));
      out.push(...box(-w / 2 + 0.05, -d / 2 + 0.3, w / 2 - 0.05, -d / 2 + 0.45, 0, 0.1, C.steel), ...box(-w / 2 + 0.05, d / 2 - 0.2, w / 2 - 0.05, d / 2 - 0.05, 0, 0.1, C.steel));
      // its two lids, hinged at the back; an askew one's each at its own angle
      for (const [x0, x1] of [[-w / 2, -0.01], [0.01, w / 2]]) {
        const open = D.toon ? U(0, 0.7) : 0, hz = h + 0.02;
        out.push(...box(x0, -d / 2 - 0.04, x1, d / 2, hz, hz + 0.05, C.black).map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => { const dy = y - d / 2, dz = z - hz; return P([x, d / 2 + dy * Math.cos(open) - dz * Math.sin(open), hz + dy * Math.sin(open) + dz * Math.cos(open)]); }) })));
      }
      return D.toon ? shear(out, D.tilt * 0.25, 0) : out;
    },
  },
  'heritage-fluted': {
    group: 'litter', read: 'a cast-iron heritage bin: a fluted drum on a moulded base, a domed cap with a finial, a band of gold at its neck', w: 0.62, d: 0.62, h: 1.1,
    build(D, R) {
      const r = 0.27 * D.body, h = 0.82 * D.height, n = 24, out = [];
      // its fluted drum: rings of alternately deep and shallow points
      const ring = (rr, z) => Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n, q = rr * (i % 2 ? 0.94 : 1); return [q * Math.cos(a), q * Math.sin(a), z]; });
      const k = 5, rings = Array.from({ length: k + 1 }, (_, j) => { const f = j / k; return ring(r * (D.toon ? 1 + (D.bulge - 1) * Math.sin(Math.PI * f) : 1), 0.12 + (h - 0.12) * f); });
      for (let j = 0; j < k; j++) for (let i = 0; i < n; i++) { const a = rings[j][i], b = rings[j][(i + 1) % n], c = rings[j + 1][(i + 1) % n], e = rings[j + 1][i], m = (2 * Math.PI * (i + 0.5)) / n; out.push({ corners: [P(a), P(b), P(c), P(e)], out: [Math.cos(m), Math.sin(m), 0], hex: C.iron }); }
      out.push(...paint(lathe(0, 0, 0, [[r * 1.25, 0], [r * 1.25, 0.05], [r * 1.12, 0.08], [r * 1.05, 0.12]], 24, 'base', () => [0, 0], [false, true]), C.iron));
      out.push(...paint(lathe(0, 0, h, [[r * 1.06, 0], [r * 1.06, 0.05]], 24, 'band', () => [0, 0], [false, false]), C.gold));
      const cap = r * 1.12 * (D.toon ? D.head * 0.65 : 1);
      out.push(...paint(tilted(0, 0, h + 0.05, [[cap, 0], [cap * 0.95, cap * 0.2], [cap * 0.7, cap * 0.5], [cap * 0.25, cap * 0.68], [0.03, cap * 0.72], [0.045, cap * 0.85], [0, cap * 0.95]], 24, 'cap', D.toon ? D.tilt : 0, 0.6, -0.8), C.iron));
      out.push(...disc([0, -r * 1.0, h - 0.12], 0.09, [0, -1, 0], C.black));
      return out;
    },
  },
  'solar-compactor': {
    group: 'litter', read: 'a solar compactor kiosk: a square cabinet, its hopper door on the front, a solar panel tilted on its roof', w: 0.66, d: 0.66, h: 1.3,
    build(D, R) {
      const w = 0.64 * D.body, h = 1.12 * D.height, out = [...box(-w / 2, -w / 2, w / 2, w / 2, 0, h, C.grey)];
      // its hopper: a darker door with its handle bar; its panel, tilted to the sky (an askew one's too big, tipped further)
      out.push(...box(-w * 0.36, -w / 2 - 0.01, w * 0.36, -w / 2, h * 0.55, h * 0.85, C.black), ...box(-w * 0.25, -w / 2 - 0.04, w * 0.25, -w / 2 - 0.01, h * 0.84, h * 0.87, C.steel));
      const pw = (w / 2 + 0.04) * (D.toon ? D.head * 0.6 : 1), tilt = 0.32 + (D.toon ? D.tilt * 1.5 : 0), rise = pw * 2 * Math.sin(tilt);
      out.push({ corners: [P([-pw, -pw, h + 0.04]), P([pw, -pw, h + 0.04]), P([pw, pw, h + 0.04 + rise]), P([-pw, pw, h + 0.04 + rise])], out: [0, -Math.sin(tilt), Math.cos(tilt)], hex: C.panel });
      for (let i = 1; i < 4; i++) { const f = i / 4, y = -pw + 2 * pw * f, z = h + 0.045 + rise * f; out.push({ corners: [P([-pw, y - 0.006, z]), P([pw, y - 0.006, z]), P([pw, y + 0.006, z + 0.002]), P([-pw, y + 0.006, z + 0.002])], out: [0, 0, 1], hex: C.galv }); }
      out.push(...box(-w / 2, -w / 2, w / 2, w / 2, h, h + 0.04, C.steel));
      return out;
    },
  },
  'ashtray-top': {
    group: 'litter', read: 'a bin under an ashtray: a slim drum, a dish of sand on its top, its mouth a slot below the dish', w: 0.42, d: 0.42, h: 0.95,
    build(D, R) {
      const r = 0.2 * D.body, h = 0.82 * D.height, dish = r * 1.2 * (D.toon ? D.head * 0.75 : 1), out = [];
      out.push(...paint(lathe(0, 0, 0, [[r * 1.08, 0], [r * 1.08, 0.03], [r, 0.05], [r * D.bulge, h * 0.5], [r, h]], 18, 'body', () => [0, 0], [false, false]), C.steel));
      out.push(...paint(tilted(0, 0, h, [[r * 0.6, 0], [dish, 0.06], [dish, 0.1], [dish * 0.9, 0.1]], 18, 'dish', D.toon ? D.tilt : 0, 1, 0, [false, false]), C.steel));
      // (its sand in its dish, tipped with it)
      { const tl = D.toon ? D.tilt : 0, a = [Math.sin(tl), 0, Math.cos(tl)]; out.push(...disc([a[0] * 0.085, 0, h + a[2] * 0.085], dish * 0.88, a, C.sand)); }
      out.push(...box(-r * 0.6, -r - 0.01, r * 0.6, -r + 0.02, h * 0.72, h * 0.82, C.black));
      return out;
    },
  },
  'concrete-surround': {
    group: 'litter', read: 'a bin in its concrete surround: a square of cast concrete, a round mouth in its top, a dark liner inside', w: 0.62, d: 0.62, h: 0.85,
    build(D, R) {
      const w = 0.62 * D.body, h = 0.85 * D.height, mr = 0.21 * (D.toon ? D.head * 0.6 : 1), out = [], n = 16;
      // its sides, and its top a square round a round mouth
      for (const f of box(-w / 2, -w / 2, w / 2, w / 2, 0, h, C.concrete, D.toon ? D.taper : 0.96).slice(1)) out.push(f);
      const tw = (w / 2) * (D.toon ? D.taper : 0.96), sq = (t) => { const c = Math.cos(t), s = Math.sin(t), m = Math.max(Math.abs(c), Math.abs(s)); return [(tw * c) / m, (tw * s) / m]; };
      for (let i = 0; i < n; i++) {
        const t0 = (2 * Math.PI * i) / n, t1 = (2 * Math.PI * (i + 1)) / n, a = sq(t0), b = sq(t1);
        out.push({ corners: [P([mr * Math.cos(t0), mr * Math.sin(t0), h]), P([mr * Math.cos(t1), mr * Math.sin(t1), h]), P([b[0], b[1], h]), P([a[0], a[1], h])], out: [0, 0, 1], hex: C.concrete });
      }
      out.push(...paint(lathe(0, 0, h - 0.4, [[mr, 0], [mr, 0.4]], 16, 'liner', () => [0, 0], [true, false]), C.liner));
      return D.toon ? turn(shear(out, D.tilt * 0.4, 0), D.tilt) : out;
    },
  },
  // ── the dumpsters ──
  'rear-load': {
    group: 'dumpster', read: 'a rear-load dumpster: its back sloped up for the truck\'s blade, a lid on top, lifting bars on its sides', w: 1.85, d: 1.4, h: 1.3,
    build(D, R) {
      const w = 1.85 * (D.toon ? 0.75 + 0.15 * D.body : 1), d = 1.4, h = 1.25 * D.height, U = u(R);
      const prof = [[-d / 2, 0.1], [d / 2 - 0.45, 0.1], [d / 2, h * 0.5], [d / 2, h], [-d / 2, h]];
      const out = paint(extrude(prof, () => w, 'v', 'body'), C.blue);
      for (const s of [-1, 1]) out.push(...paint(tube([{ c: [s * (w / 2 + 0.06), -d * 0.3, h * 0.7], r: 0.035, a: [0, 1, 0] }, { c: [s * (w / 2 + 0.06), d * 0.3, h * 0.7], r: 0.035, a: [0, 1, 0] }], 8, 'bar'), C.steel));
      const open = D.toon ? U(0.05, 0.6) : 0, hz = h + 0.02;
      out.push(...box(-w / 2, -d / 2, w / 2, d / 2 + 0.04, hz, hz + 0.05, C.black).map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => { const dy = y + d / 2, dz = z - hz; return P([x, -d / 2 + dy * Math.cos(open) - dz * Math.sin(open), hz + dy * Math.sin(open) + dz * Math.cos(open)]); }) })));
      out.push(...box(-w / 2 + 0.05, -d / 2 + 0.1, w / 2 - 0.05, -d / 2 + 0.25, 0, 0.1, C.steel), ...box(-w / 2 + 0.05, d / 2 - 0.6, w / 2 - 0.05, d / 2 - 0.45, 0, 0.1, C.steel));
      return D.toon ? shear(out, -D.tilt * 0.3, 0) : out;
    },
  },
  'roll-off': {
    group: 'dumpster', read: 'a roll-off container: a long open-top steel box ribbed along its sides, a swing door at its back, on its rails', w: 2.4, d: 6, h: 1.4,
    build(D, R) {
      const w = 2.3, d = 6 * (D.toon ? 0.55 + 0.2 * D.reach : 1), h = 1.35 * D.height, U = u(R), out = [];
      // its walls (open at the top: a thin skin each, inside and out)
      for (const [x0, y0, x1, y1] of [[-w / 2, -d / 2, w / 2, -d / 2 + 0.06], [-w / 2, d / 2 - 0.06, w / 2, d / 2], [-w / 2, -d / 2, -w / 2 + 0.06, d / 2], [w / 2 - 0.06, -d / 2, w / 2, d / 2]]) out.push(...box(x0, y0, x1, y1, 0.15, 0.15 + h, C.rust));
      out.push(...box(-w / 2, -d / 2, w / 2, d / 2, 0.12, 0.15, C.rust));
      // its ribs, each its own height in the askew register, and its rails
      const n = 7;
      for (let i = 0; i < n; i++) for (const s of [-1, 1]) { const y = -d / 2 + 0.3 + (d - 0.6) * (i / (n - 1)), hh = h * (D.toon ? U(0.75, 1.15) : 1); out.push(...box(s > 0 ? w / 2 : -w / 2 - 0.08, y - 0.05, s > 0 ? w / 2 + 0.08 : -w / 2, y + 0.05, 0.15, 0.15 + hh, C.rust)); }
      for (const x of [-0.5, 0.5]) out.push(...box(x - 0.08, -d / 2, x + 0.08, d / 2, 0, 0.12, C.steel));
      out.push(...box(-w / 2 + 0.1, d / 2, w / 2 - 0.1, d / 2 + 0.04, 0.25, 0.1 + h, C.rust));
      return D.toon ? turn(shear(out, D.tilt * 0.2, 0), D.tilt * 0.5) : out;
    },
  },
  'skip': {
    group: 'dumpster', read: 'a builder\'s skip: an open steel tub, its ends sloped out, a lifting lug at each corner, painted and dented', w: 1.8, d: 3.4, h: 1.2,
    build(D, R) {
      const w = 1.7 * D.body, d0 = 2.4, d1 = 3.4 * (D.toon ? D.taper : 1), h = 1.15 * D.height, out = [];
      // its ends sloped out from its base to its rim; its sides upright
      const sideP = [[-d0 / 2, 0.08], [d0 / 2, 0.08], [d1 / 2, h], [-d1 / 2, h]];
      out.push(...paint(extrude(sideP, () => w, 'v', 'tub'), C.yellowBand));
      out.push(...paint(extrude([[-d1 / 2 + 0.06, h - 0.02], [d1 / 2 - 0.06, h - 0.02], [d1 / 2 - 0.06, h], [-d1 / 2 + 0.06, h]], () => w - 0.1, 'v', 'rim'), C.black));
      // its lugs: a round boss at each corner, just under the rim
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const y = sy * (d0 / 2 + (d1 - d0) / 2 * 0.7), z = h * 0.72, lr = 0.07 * (D.toon ? D.head * 0.8 : 1); out.push(...paint(tube([{ c: [sx * w / 2, y, z], r: lr, a: [sx, 0, 0] }, { c: [sx * (w / 2 + 0.1), y, z], r: lr, a: [sx, 0, 0] }], 10, 'lug'), C.steel)); }
      return D.toon ? shear(out, 0, D.tilt * 0.35) : out;
    },
  },
  'eurobin-1100': {
    group: 'dumpster', read: 'a 1100-litre four-wheeled container: a tall plastic body, its domed lid in two halves, four castors, push handles at its ends', w: 1.37, d: 1.08, h: 1.45,
    build(D, R) {
      const w = 1.3 * D.body, d = 1.0, h = 1.15 * D.height, wr = 0.1 * (D.toon ? (D.lid < 1 ? 0.7 : 1.8) : 1), U = u(R), out = [...box(-w / 2 * 0.92, -d / 2 * 0.92, w / 2 * 0.92, d / 2 * 0.92, wr * 1.9, h, C.grey, 1.08)];
      // its dome: two halves, each its own angle in the askew register
      for (const [y0, y1] of [[-d * 0.54, 0], [0, d * 0.54]]) {
        const open = D.toon ? U(0, 0.35) : 0, hz = h, rise = 0.18 * (D.toon ? D.head * 0.7 : 1), k = 5;
        for (let i = 0; i < k; i++) {
          const f0 = i / k, f1 = (i + 1) / k, z = (f) => hz + rise * Math.sin(Math.PI * (y0 < 0 ? (1 - f) / 2 : f / 2 + 0.5) ), y = (f) => y0 + (y1 - y0) * f;
          out.push({ corners: [P([-w * 0.54, y(f0), z(f0) + open * (y(f0) - (y0 < 0 ? y0 : y1)) * -0.5]), P([w * 0.54, y(f0), z(f0) + open * (y(f0) - (y0 < 0 ? y0 : y1)) * -0.5]), P([w * 0.54, y(f1), z(f1) + open * (y(f1) - (y0 < 0 ? y0 : y1)) * -0.5]), P([-w * 0.54, y(f1), z(f1) + open * (y(f1) - (y0 < 0 ? y0 : y1)) * -0.5])], out: [0, 0, 1], hex: C.green });
        }
      }
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) out.push(...paint(tube([{ c: [sx * w * 0.38, sy * d * 0.36, wr], r: wr, a: [0, 1, 0] }, { c: [sx * w * 0.38, sy * d * 0.36 + 0.06, wr], r: wr, a: [0, 1, 0] }], 10, 'castor', [true, true]), C.wheel), ...paint(tube([{ c: [sx * w * 0.38, sy * d * 0.36, wr], r: 0.025 }, { c: [sx * w * 0.38, sy * d * 0.36, wr * 1.9], r: 0.025 }], 6, 'fork'), C.steel));
      for (const sx of [-1, 1]) out.push(...paint(tube([{ c: [sx * (w / 2 + 0.06), -d * 0.3, h * 0.85], r: 0.02, a: [0, 1, 0] }, { c: [sx * (w / 2 + 0.06), d * 0.3, h * 0.85], r: 0.02, a: [0, 1, 0] }], 8, 'handle'), C.black));
      return D.toon ? shear(out, D.tilt * 0.25, 0) : out;
    },
  },
  'bag-skip': {
    group: 'dumpster', read: 'a bulk bag skip: a white woven bag a metre each way, its four lifting loops, its sides slumped, its mouth open', w: 1.2, d: 1.2, h: 0.95,
    build(D, R) {
      const s = 0.55 * D.body, h = 0.9 * D.height, U = u(R), k = 4, out = [];
      // its sides: each a sheet slumping in at its middle, its mouth's rim a ring of the same white
      const sag = 0.08 * (D.toon ? 1.2 + D.bulge * 0.6 : 1), corners = [[-s, -s], [s, -s], [s, s], [-s, s]];
      for (let i = 0; i < 4; i++) {
        const a = corners[i], b = corners[(i + 1) % 4], n = [(a[1] - b[1]) / (2 * s) || 0, (b[0] - a[0]) / (2 * s) || 0];
        for (let j = 0; j < k; j++) for (let m = 0; m < 2; m++) {
          const P2 = (fu, fz) => { const x = a[0] + (b[0] - a[0]) * fu, y = a[1] + (b[1] - a[1]) * fu, sl = sag * Math.sin(Math.PI * fu) * Math.sin(Math.PI * fz) * (D.toon ? U(0.6, 1.4) : 1); return P([x - n[0] * sl, y - n[1] * sl, h * fz]); };
          const u0 = j / k, u1 = (j + 1) / k, z0 = m / 2, z1 = (m + 1) / 2;
          out.push({ corners: [P2(u0, z0), P2(u1, z0), P2(u1, z1), P2(u0, z1)], out: [-n[0], -n[1], 0], hex: '#ecebe4' });
        }
      }
      out.push(...box(-s, -s, s, s, 0, 0.03, '#d9d8cf'));
      // its loops: a strap up from each corner and over
      for (const [x, y] of corners) out.push(...paint(tube([{ c: [x, y, h - 0.15], r: 0.02 }, { c: [x * 0.9, y * 0.9, h + 0.15 * (D.toon ? D.head : 1)], r: 0.02 }, { c: [x * 0.75, y * 0.75, h - 0.05], r: 0.02 }], 5, 'loop', [false, false]), C.blue));
      return out;
    },
  },
  // ── the donation bins ──
  'clothing-drop': {
    group: 'donation', read: 'a clothing donation bin: a tall steel cabinet under a pitched roof, its pull-down chute in the front, a sign band', w: 1.25, d: 1.05, h: 2.05,
    build(D, R) {
      const w = 1.2 * D.body, d = 1.0, h = 1.7 * D.height, roof = 0.32 * (D.toon ? D.head * 0.8 : 1), out = [...box(-w / 2, -d / 2, w / 2, d / 2, 0, h, '#2f6fa8')];
      // its roof: a gable along its width, overhanging; an askew one's ridge off its middle
      const off = D.toon ? D.tilt * 0.6 : 0, ov = 0.06;
      out.push(...paint(extrude([[-d / 2 - ov, h], [d / 2 + ov, h], [d * off, h + roof]], () => w + 2 * ov, 'v', 'roof').map((f) => ({ ...f })), '#e8e6de'));
      // its chute: a box proud of the front, its mouth dark, a handle bar
      const cz = h * 0.55, cw = w * 0.62 * (D.toon ? D.head * 0.55 : 1), open = D.toon ? D.tilt * 1.2 : 0;
      out.push(...box(-cw / 2, -d / 2 - 0.22, cw / 2, -d / 2, cz, cz + 0.42, '#24578a').map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => { const dy = y + d / 2, dz = z - cz; return P([x, -d / 2 + dy * Math.cos(open) - dz * Math.sin(open), cz + dy * Math.sin(open) + dz * Math.cos(open)]); }) })));
      out.push(...box(-cw / 2 + 0.05, -d / 2 - 0.226, cw / 2 - 0.05, -d / 2 - 0.22, cz + 0.12, cz + 0.36, C.black));
      out.push(...paint(tube([{ c: [-cw * 0.3, -d / 2 - 0.26, cz + 0.38], r: 0.016, a: [1, 0, 0] }, { c: [cw * 0.3, -d / 2 - 0.26, cz + 0.38], r: 0.016, a: [1, 0, 0] }], 6, 'handle'), C.steel));
      out.push(...box(-w / 2 + 0.05, -d / 2 - 0.006, w / 2 - 0.05, -d / 2, h * 0.78, h * 0.92, '#f2efe6'));
      return D.toon ? shear(out, D.tilt * 0.2, 0) : out;
    },
  },
  'book-drop': {
    group: 'donation', read: 'a book drop: a steel box on short legs, its top a half-round like a mailbox\'s, its slot under a hood', w: 0.95, d: 0.7, h: 1.3,
    build(D, R) {
      const w = 0.9 * D.body, d = 0.65, h = 0.95 * D.height, legs = 0.15 * (D.toon ? D.reach : 1), out = [...box(-w / 2, -d / 2, w / 2, d / 2, legs, legs + h, '#7a2e2e')];
      // its half-round top along its width (an askew one's too tall a dome)
      const rr = d / 2, k = 8, tall = D.toon ? D.head * 0.6 : 1;
      const arc = Array.from({ length: k + 1 }, (_, i) => { const a = (Math.PI * i) / k; return [-rr * Math.cos(a), legs + h + rr * tall * Math.sin(a)]; });
      out.push(...paint(extrude(arc, () => w, 'v', 'top'), '#7a2e2e'));
      out.push(...box(-w * 0.32, -d / 2 - 0.12, w * 0.32, -d / 2, legs + h * 0.68, legs + h * 0.72, '#5a2020'), ...box(-w * 0.3, -d / 2 - 0.005, w * 0.3, -d / 2, legs + h * 0.6, legs + h * 0.67, C.black));
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) out.push(...box(sx * w * 0.42 - 0.03, sy * d * 0.38 - 0.03, sx * w * 0.42 + 0.03, sy * d * 0.38 + 0.03, 0, legs, C.steel));
      return D.toon ? shear(out, -D.tilt * 0.3, D.tilt * 0.2) : out;
    },
  },
  'bottle-igloo': {
    group: 'donation', read: 'a bottle bank igloo: a fibreglass dome on its plinth, round mouths in its sides each with its rubber flaps, a lifting knob on top', w: 1.5, d: 1.5, h: 1.6,
    build(D, R) {
      const r = 0.72 * D.body, h = 1.35 * D.height, k = 7, out = [];
      out.push(...paint(lathe(0, 0, 0, [[r, 0], [r, 0.12], ...Array.from({ length: k }, (_, i) => { const a = (Math.PI / 2) * ((i + 1) / k); return [r * Math.cos(a) * (D.toon ? 1 + (D.bulge - 1) * Math.sin(2 * a) * 0.5 : 1) + 0.001, 0.12 + (h - 0.12) * Math.sin(a)]; })], 24, 'dome', () => [0, 0], [false, false]), '#3e8a4a'));
      out.push(...paint(lathe(0, 0, h - 0.02, [[0.08, 0], [0.08, 0.12 * (D.toon ? D.head : 1)], [0.04, 0.16 * (D.toon ? D.head : 1)]], 10, 'knob'), C.steel));
      // its mouths: each a dark disc set in its side, an askew one's each its own size
      const U = u(R);
      for (const a of [-0.6, 0.6, Math.PI]) {
        // (set in the dome's own side there: its profile's radius at that height, its bulge with it)
        const mr = 0.11 * (D.toon ? U(0.7, 1.8) : 1), z = h * 0.55, th = Math.asin(Math.min(0.99, (z - 0.12) / (h - 0.12))), rr = r * Math.cos(th) * (D.toon ? 1 + (D.bulge - 1) * Math.sin(2 * th) * 0.5 : 1) + 0.012;
        out.push(...disc([rr * Math.sin(a), -rr * Math.cos(a), z], mr, [Math.sin(a), -Math.cos(a), 0.3], C.black));
      }
      return out;
    },
  },
  'textile-bank': {
    group: 'donation', read: 'a textile and shoe bank: a tall slim steel box, two hoppers in its front side by side, its roof sloped to the back', w: 1.3, d: 0.85, h: 1.95,
    build(D, R) {
      const w = 1.25 * D.body, d = 0.8, h = 1.75 * D.height, U = u(R), out = [...box(-w / 2, -d / 2, w / 2, d / 2, 0, h, '#5a3a7a')];
      out.push({ corners: [P([-w / 2 - 0.04, -d / 2 - 0.04, h + 0.12]), P([w / 2 + 0.04, -d / 2 - 0.04, h + 0.12]), P([w / 2 + 0.04, d / 2 + 0.04, h]), P([-w / 2 - 0.04, d / 2 + 0.04, h])], out: [0, -0.15, 1], hex: '#e8e6de' });
      // its two hoppers: each a box proud of the front and its handle (an askew pair each its own size and height)
      for (const s of [-1, 1]) {
        const hw = w * 0.36 * (D.toon ? U(0.7, 1.25) : 1), cz = h * (D.toon ? U(0.45, 0.62) : 0.52), x = s * w * 0.24;
        out.push(...box(x - hw / 2, -d / 2 - 0.18, x + hw / 2, -d / 2, cz, cz + 0.36, '#4a2e66'), ...box(x - hw / 2 + 0.04, -d / 2 - 0.186, x + hw / 2 - 0.04, -d / 2 - 0.18, cz + 0.1, cz + 0.3, C.black));
        out.push(...paint(tube([{ c: [x - hw * 0.3, -d / 2 - 0.22, cz + 0.33], r: 0.014, a: [1, 0, 0] }, { c: [x + hw * 0.3, -d / 2 - 0.22, cz + 0.33], r: 0.014, a: [1, 0, 0] }], 6, 'handle'), C.steel));
      }
      out.push(...box(-w / 2 + 0.05, -d / 2 - 0.006, w / 2 - 0.05, -d / 2, h * 0.8, h * 0.93, '#f2efe6'));
      return D.toon ? shear(out, D.tilt * 0.25, -D.tilt * 0.1) : out;
    },
  },
  'drop-shed': {
    group: 'donation', read: 'a donation drop shed: a small timber shed on a pad, its door with a hatch, a sloped roof, a sign over the door', w: 2, d: 1.6, h: 2.3,
    build(D, R) {
      const w = 1.9 * D.body, d = 1.5, h = 2 * D.height, out = [...box(-w / 2, -d / 2, w / 2, d / 2, 0.08, h, '#a8743e')];
      out.push(...box(-w / 2 - 0.1, -d / 2 - 0.1, w / 2 + 0.1, d / 2 + 0.1, 0, 0.08, C.concrete));
      const pitch = 0.35 * (D.toon ? D.head * 0.9 : 1);
      out.push({ corners: [P([-w / 2 - 0.15, -d / 2 - 0.2, h + pitch]), P([w / 2 + 0.15, -d / 2 - 0.2, h + pitch]), P([w / 2 + 0.15, d / 2 + 0.15, h]), P([-w / 2 - 0.15, d / 2 + 0.15, h])], out: [0, -0.3, 1], hex: '#3a3f44' });
      for (const s of [-1, 1]) out.push({ corners: [P([s * w / 2, -d / 2, h]), P([s * w / 2, d / 2, h]), P([s * w / 2, -d / 2, h + pitch])], out: [s, 0, 0], hex: '#a8743e' });
      out.push(...box(-0.45, -d / 2 - 0.01, 0.45, -d / 2, 0.1, 1.95, '#7a5228'), ...box(-0.3, -d / 2 - 0.03, 0.3, -d / 2 - 0.01, 1.0, 1.3, C.black), ...box(-0.6, -d / 2 - 0.04, 0.6, -d / 2, h - 0.3, h - 0.05, '#f2efe6'));
      return D.toon ? shear(out, D.tilt * 0.3, 0) : out;
    },
  },
});
export const RECEPTACLE_IDS = Object.freeze(Object.keys(RECEPTACLES));
/** The shelf's groups: the street's litter bins, the dumpsters, the donation bins. */
export const RECEPTACLE_GROUPS = Object.freeze(['litter', 'dumpster', 'donation']);

/** A receptacle of the shelf, drawn by its dials (doodads.js proportions: 1 for the realistic register). */
export function receptacleOf(id, D, R) {
  const K = RECEPTACLES[id];
  if (!K) throw new Error(`receptacles: '${id}' is not a kind (${RECEPTACLE_IDS.join(', ')})`);
  return K.build(D, R);
}
