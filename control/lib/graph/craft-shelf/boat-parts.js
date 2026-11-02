/**
 * boat-parts — the builders of the craft shelf's boat kinds (boat-odm.js), merged into CRAFT_BUILDERS, and the hull's
 * hydrostatics: each builder a pure function of its row, its palette's colours and the pose, returning the shelf's own
 * monomers (lofts, lathes, sweeps, extrudes in metres) and its hardpoints, as craft-parts.js's builders do.
 *
 *   boat-hull      vee        a hull from its lines (`hullLines`): the outer skin and the inner liner lofted as one
 *                             U-shaped wall each, clipped by the transom's raked planes (its aft face, the skin's inside,
 *                             the motor board's inside) and the liner by the deck's plane; the benches lofted to the liner
 *                             they sit in, the ribs along its floor, the strakes along its bottom, the gunwale rails, the
 *                             transom's cap and motor pad, the keel strip up the stem, the fittings
 *   boat-outboard  tiller     the clamp bracket and the tilt tube (they stay with the boat), the swivel bracket (it tilts),
 *                             the cowl and its pan, the midsection, the anti-ventilation plate, the gearcase's strut,
 *                             torpedo and skeg, the propeller's hub and blades (each a section at its radius pitched to the
 *                             helix its pitch draws, raked aft), the tiller and its grip (they steer and tilt, and fold
 *                             up about the tiller's bracket by the craft's `fold`)
 *   boat-tank      moulded    a portable tank's body, its handle, cap, gauge and fitting
 *
 * The hydrostatics read the same lines the builder lofts, so what floats is what is drawn:
 *   hullLines(row)                 → { L, at(s), plane(d), zT, tanR } the lines at s, and the transom's planes
 *   hullSection(row, s)            → the outer skin's section at s, [x, z] from the starboard sheer round the keel to the
 *                                    port sheer, clipped by the transom's face
 *   hullVolume(row, z)             → m³ displaced with the waterline at height z above the keel
 *   hullFloat(row, kg, { rho })    → { draft, volume, freeboard, swamped } the waterline that displaces kg (fresh water
 *                                    by default), the least freeboard along the sheer (at the transom, on a skiff)
 *
 * Hull space: +y the bow, +z up, +x starboard, the keel's lowest point at z = 0, amidships at y = 0, metres. Pure.
 */
import { DEG, lathe, loftWorld, sweep, extrudeWorld, section, planeUV, round3, tone } from './craft-common.js';
import { HELM_BUILDERS } from './boat-helm.js';

const r3v = (v) => v.map(round3);
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : 0));
const lerp = (a, b, t) => a + (b - a) * t;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
// an extrude's ring wound the way the kernel wants it (counter-clockwise in its own plane), from its offsets
const ccw = (from, to, ring) => { const uv = planeUV(from, to, ring), a = uv.reduce((t, p, i) => { const q = uv[(i + 1) % uv.length]; return t + p[0] * q[1] - q[0] * p[1]; }, 0); return a < 0 ? ring.slice().reverse() : ring; };
// a flat rectangle's offsets square to an extrude's axis: w along u, h along v
const rect = (u, v, w, h) => [[0, 1], [1, 1], [1, 0], [0, 0]].map(([a, b]) => [0, 1, 2].map((k) => u[k] * (a - 0.5) * w + v[k] * (b - 0.5) * h));
// a box from its centre: l along y (the extrude's axis), w across x, h up z
const boxY = (id, c, l, w, h, tint, extra) => { const f = [c[0], c[1] + l / 2, c[2]], t = [c[0], c[1] - l / 2, c[2]]; return extrudeWorld(id, f, t, ccw(f, t, rect([1, 0, 0], [0, 0, 1], w, h)), tint, extra); };
const boxX = (id, c, l, w, h, tint, extra) => { const f = [c[0] - l / 2, c[1], c[2]], t = [c[0] + l / 2, c[1], c[2]]; return extrudeWorld(id, f, t, ccw(f, t, rect([0, 1, 0], [0, 0, 1], w, h)), tint, extra); };

// ---- the lines ------------------------------------------------------------------------------

/** A curve through [s, v] knots: Hermite with tangents from the neighbouring knots on their own spacing, held at its ends. */
export function curveAt(knots, s) {
  const n = knots.length;
  if (s <= knots[0][0]) return knots[0][1];
  if (s >= knots[n - 1][0]) return knots[n - 1][1];
  let i = 0;
  while (s > knots[i + 1][0]) i += 1;
  const slope = (k) => {
    const a = knots[Math.max(0, k - 1)], b = knots[Math.min(n - 1, k + 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  };
  const [t0, p0] = knots[i], [t1, p1] = knots[i + 1], h = t1 - t0, u = (s - t0) / h, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * h * slope(i) + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * h * slope(i + 1);
}

/** The hull's lines read at s (0 the transom … 1 the stem), and the transom's planes: `plane(d)(y)` the height its face
 *  stands at, at y, moved d forward (d = 0 its aft face). */
export function hullLines(row) {
  const L = row.dims.length, K = row.build.lines, T = row.build.transom || { rake: 0 };
  const tanR = Math.tan(clamp(T.rake, 0, 30) * DEG) || 1e-6, zT = curveAt(K.sheer, 0);
  const at = (s) => ({
    s, y: -L / 2 + s * L,
    keel: curveAt(K.keel, s), sheer: curveAt(K.sheer, s), chine: curveAt(K.chine, s),
    sheerHalf: Math.max(0, curveAt(K.sheerHalf, s)), chineHalf: Math.max(0, curveAt(K.chineHalf, s)),
  });
  const plane = (d) => (y) => zT - (y + L / 2 - d) / tanR;
  return { L, at, plane, zT, tanR };
}

// the outer skin's section at a station: the starboard sheer, the side (bulged by the flare), the chine, two points down
// the bottom, the keel, and the port side back up (11 points, x from the centreline, z above the keel)
function outerLine(st, flare = 0) {
  const { keel: zK, sheer: zS, sheerHalf: hS, chine: zC, chineHalf: hC } = st;
  const bulge = flare * Math.min(1, hS / 0.3);
  const stbd = [[hS, zS], [(hS + hC) / 2 + bulge, (zS + zC) / 2], [hC, zC], [(2 * hC) / 3, zK + ((zC - zK) * 2) / 3], [hC / 3, zK + (zC - zK) / 3]];
  return [...stbd, [0, zK], ...stbd.slice().reverse().map(([x, z]) => [-x, z])];
}

// a polyline moved t inward (its right-hand normal: up from the keel, in from the sides), mitred at its corners, its
// halves kept apart by at least `gap` from the centreline (the stem, where the breadths run out)
function offsetLine(P, t, gap) {
  const n = P.length, mid = (n - 1) / 2;
  const nrm = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [dz / l, -dx / l]; };
  return P.map((p, i) => {
    const n0 = i > 0 ? nrm(P[i - 1], p) : null, n1 = i < n - 1 ? nrm(p, P[i + 1]) : null;
    let m = n0 && n1 ? [n0[0] + n1[0], n0[1] + n1[1]] : (n0 || n1);
    const ml = Math.hypot(m[0], m[1]) || 1;
    m = [m[0] / ml, m[1] / ml];
    const c = n0 && n1 ? Math.max(0.5, m[0] * n0[0] + m[1] * n0[1]) : 1;
    const x = p[0] + (m[0] * t) / c, z = p[1] + (m[1] * t) / c;
    return [i < mid ? Math.max(x, gap) : i > mid ? Math.min(x, -gap) : 0, z];
  });
}

// a polyline with everything under the height zc raised onto it, spread evenly between the two places it crosses zc (a
// clipping plane's line across the section: a transom's face, a deck); all of it laid along its sheer's height when the
// sheer is under zc
function clipUp(P, zc) {
  const n = P.length, mid = (n - 1) / 2;
  if (!(zc > Math.min(...P.map((p) => p[1])))) return P;
  let i = -1, x = P[0][0], z = P[0][1];
  if (P[0][1] > zc) {
    i = 0;
    while (i < mid && P[i + 1][1] >= zc) i += 1;
    const k = (P[i][1] - zc) / (P[i][1] - P[i + 1][1]);
    x = lerp(P[i][0], P[i + 1][0], k);
    z = zc;
  }
  const m = n - 2 * (i + 1);
  const spread = Array.from({ length: m }, (_, j) => [m > 1 ? x - (2 * x * j) / (m - 1) : 0, z]);
  return [...P.slice(0, i + 1), ...spread, ...P.slice(n - 1 - i)];
}

// the part of a section under the height zc, closed across it: [the starboard crossing, the points under it, the port one]
function clipDown(P, zc) {
  const n = P.length, mid = (n - 1) / 2;
  let i = 0;
  while (i < mid && P[i + 1][1] >= zc) i += 1;
  if (i >= mid) return null;
  const k = (P[i][1] - zc) / (P[i][1] - P[i + 1][1] || 1), x = P[i][1] < zc ? P[i][0] : lerp(P[i][0], P[i + 1][0], k);
  return [[x, zc], ...P.slice(i + 1, n - 1 - i), [-x, zc]];
}

// the height of a section's bottom at x (its starboard bottom, the chine to the keel)
function bottomAt(P, x) {
  const mid = (P.length - 1) / 2;
  for (let i = 2; i < mid; i += 1) {
    const [a, b] = [P[i], P[i + 1]];
    if (x <= a[0] && x >= b[0]) return lerp(a[1], b[1], (a[0] - x) / (a[0] - b[0] || 1));
  }
  return x > P[2][0] ? P[2][1] : P[mid][1];
}

/** The outer skin's section at s, clipped by the transom's face: [x, z] pairs, starboard sheer → keel → port sheer. */
export function hullSection(row, s) {
  const H = hullLines(row), st = H.at(s);
  return clipUp(outerLine(st, row.build.flare), H.plane(0)(st.y));
}

// the area of a closed section under the height z (Sutherland–Hodgman against z ≤ zw, then the shoelace)
function areaUnder(P, zw) {
  const out = [];
  for (let i = 0; i < P.length; i += 1) {
    const a = P[i], b = P[(i + 1) % P.length], ina = a[1] <= zw, inb = b[1] <= zw;
    if (ina) out.push(a);
    if (ina !== inb) { const k = (zw - a[1]) / (b[1] - a[1]); out.push([lerp(a[0], b[0], k), zw]); }
  }
  let A = 0;
  for (let i = 0; i < out.length; i += 1) { const p = out[i], q = out[(i + 1) % out.length]; A += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(A) / 2;
}

// the area of a circle of radius r centred at height zc under the height z (a collar's tube in the water)
function segmentUnder(r, zc, z) {
  const h = clamp(z - (zc - r), 0, 2 * r);
  return r * r * Math.acos((r - h) / r) - (r - h) * Math.sqrt(Math.max(0, 2 * r * h - h * h));
}

/** The volume the hull displaces, m³, with its waterline z above the keel (the trapezoid rule over its sections); a
 *  collar's tubes along its sides count too (its bow's arc and its cones left out, and where a tube's inboard edge meets
 *  the hull's side counted twice: a few litres, under the sheer, only when it is that deep). */
export function hullVolume(row, z, { samples = 160 } = {}) {
  const L = row.dims.length, K = row.build.collar, H = K ? hullLines(row) : null;
  const tubes = (s) => (K && s <= (K.nose ?? 0.94) ? 2 * segmentUnder(K.radius, H.at(s).sheer + K.radius * (K.up ?? 0.15), z) : 0);
  const area = (s) => areaUnder(hullSection(row, s), z) + tubes(s);
  let V = 0, prev = area(0);
  for (let k = 1; k <= samples; k += 1) {
    const a = area(k / samples);
    V += ((prev + a) / 2) * (L / samples);
    prev = a;
  }
  return V;
}

/** The waterline a hull floats at carrying kg in all (its own mass included): bisected on its displaced volume. `rho`
 *  the water's density (1000 fresh, 1025 the sea). Freeboard is the least height of the sheer over the waterline. */
export function hullFloat(row, kg, { rho = 1000 } = {}) {
  const H = hullLines(row), need = kg / rho;
  const sheerMin = Math.min(...Array.from({ length: 41 }, (_, k) => H.at(k / 40).sheer));
  if (hullVolume(row, sheerMin) < need) return { draft: round3(sheerMin), volume: round3(hullVolume(row, sheerMin)), freeboard: 0, swamped: true };
  let lo = 0, hi = sheerMin;
  for (let k = 0; k < 40; k += 1) { const m = (lo + hi) / 2; if (hullVolume(row, m) < need) lo = m; else hi = m; }
  const draft = (lo + hi) / 2;
  return { draft: round3(draft), volume: round3(hullVolume(row, draft)), freeboard: round3(sheerMin - draft), swamped: false };
}

// ---- the hull ---------------------------------------------------------------------------------

function buildHull(row, C) {
  const b = row.build;
  if (b.family !== 'vee') throw new Error(`Unknown boat-hull family '${b.family}'`);
  // (a moulded gunwale cap, `cap` wide: the liner's top pulled inboard, level with the sheer, never past half the breadth)
  const capped = (I, st) => {
    if (!b.cap) return I;
    const n = I.length, c = Math.min(b.cap, st.sheerHalf * 0.45), z = I[0][1];
    const out = I.slice();
    out[0] = [Math.max(I[0][0] - c, 0.002), z];
    out[n - 1] = [Math.min(I[n - 1][0] + c, -0.002), z];
    return out;
  };
  const H = hullLines(row), { L } = H, Tt = b.transom.thickness, T1 = b.skin, T2 = b.skin + b.liner;
  const P0 = H.plane(0), P1 = H.plane(T1), P2 = H.plane(Tt);
  const deckZ = (st) => (b.deck && st.s >= b.deck.from ? st.sheer - b.deck.thickness : -Infinity);
  const lines = (s) => {
    const st = H.at(s), O = outerLine(st, b.flare);
    const M = offsetLine(O, T1, 0.004), I = capped(offsetLine(O, T2, 0.002), st);
    // (a sole: the floor laid flat across the bottom at its height, the liner clipped to it the length of the boat)
    const Ic = clipUp(I, P2(st.y)), Is = Number.isFinite(b.sole) ? clipUp(Ic, b.sole) : Ic;
    return { st, O: clipUp(O, P0(st.y)), M: clipUp(M, P1(st.y)), I: clipUp(Is, deckZ(st)), Iopen: I };
  };
  const ring = (A, B) => [...A, ...B.slice().reverse()].map(([x, z]) => [x, 0, z]);
  const r4 = (s) => Math.round(s * 1e4) / 1e4;
  // the stations: close through the transom (its face, the skin, the motor board), every 3.5 % to the deck, a bulkhead's
  // pair where the deck begins, every 2.5 % to the stem; each wall starts a hair forward of where its plane leaves the sheer
  const startOf = (d) => (d + 0.003 * H.tanR) / L;
  const run = (H.zT * H.tanR + Tt) / L + 0.012, sD = b.deck ? b.deck.from : 1;
  const stations = (s0) => {
    const S = [s0];
    for (let k = 1; k <= 10; k += 1) S.push(r4(s0 + ((run - s0) * k) / 10));
    // (`stations`: a longer or more flared hull's spacing, so a curved quad's twist stays under its skin)
    const step = b.stations ?? { mid: 0.035, bow: 0.025 };
    for (let s = run + step.mid; s < sD - 0.006; s += step.mid) S.push(r4(s));
    if (b.deck) S.push(r4(sD - 0.003), sD);
    for (let s = sD + step.bow; s < 0.999; s += step.bow) S.push(r4(s));
    S.push(1);
    return S;
  };
  const axis = [[0, -L / 2, 0], [0, L / 2, 0]];
  const wall = (id, S, pick, tint) => loftWorld(id, axis[0], axis[1], S.map((s) => { const l = lines(s); return { t: s, points: ring(...pick(l)) }; }), tint);
  const lofts = [
    wall('skin', stations(startOf(0)), (l) => [l.O, l.M], C.paint),
    wall('liner', stations(startOf(T1)), (l) => [l.M, l.I], C[b.tint?.liner ?? 'chrome']),
  ];
  const extrudes = [], sweeps = [], lathes = [];
  const alu = tone(C.chrome, -0.1), seatTop = tone(C.chrome, -0.22);
  const hardpoints = { mount: [0, 0, 0] };
  // the benches: each lofted to the liner it sits in (its fore and aft ends each the liner's section under its top), its
  // seat a plank across it
  for (const bn of b.benches || []) {
    const s0 = bn.at, s1 = bn.at + bn.depth / L, ends = [s0, s1].map((s) => clipDown(lines(s).Iopen, bn.top));
    if (ends.some((e) => !e)) continue;
    const inset = (P) => P.map(([x, z]) => [x * 0.985, z + 0.004]);
    const [y0, y1] = [s0, s1].map((s) => H.at(s).y);
    lofts.push(loftWorld(`bench_${bn.name}`, [0, y0, 0], [0, y1, 0], ends.map((e, k) => ({ t: k, points: inset(e).map(([x, z]) => [x, 0, z]) })), alu));
    const w = 2 * Math.min(ends[0][0][0], ends[1][0][0]) * 0.97;
    extrudes.push(boxY(`bench_${bn.name}_top`, [0, (y0 + y1) / 2, bn.top + 0.011], y1 - y0 + 0.02, w, 0.022, seatTop));
    hardpoints[bn.name] = r3v([0, (y0 + y1) / 2, bn.top + 0.022]);
  }
  // the ribs across the floor, chine to chine, standing on the liner
  for (const [k, s] of (b.ribs || []).entries()) {
    const I = lines(s).Iopen, y = H.at(s).y, mid = (I.length - 1) / 2;
    sweeps.push(sweep(`rib_${k}`, I.slice(2, I.length - 2).map(([x, z]) => [x, y, z + 0.005]), 0.009, alu, { sides: 6 }));
    void mid;
  }
  // the gunwale rails along the sheer, the transom's cap across its top, the motor pad on it
  // (a collared hull, a RIB's, has its tube where the rails would be: no rails)
  const g = b.gunwale || 0, s0 = startOf(0) + 0.002, rail = [], square = b.bow === 'square';
  for (let s = s0; s < 0.985; s += 0.03) rail.push(s);
  rail.push(0.985, square ? 1 : 0.997);
  const railAt = (sx, s) => { const st = H.at(s); return [sx * Math.max(st.sheerHalf - g * 0.35, 0.004), st.y, st.sheer + g * 0.25]; };
  if (g) for (const sx of [1, -1]) sweeps.push(sweep(`gunwale_${sx > 0 ? 'r' : 'l'}`, rail.map((s) => railAt(sx, s)), g, C.chrome, { sides: 8 }));
  // (a square bow, a jon boat's: its rail across the bow's top)
  if (g && square) sweeps.push(sweep('bow_cap', [railAt(1, 1), railAt(-1, 1)], g, C.chrome, { sides: 8 }));
  if (b.collar) collarOf(b.collar, H, C, { sweeps, lathes });
  const st0 = H.at(0), cap = 0.012;
  extrudes.push(boxX('transom_cap', [0, -L / 2 + Tt / 2, H.zT + cap / 2], 2 * st0.sheerHalf - 0.01, Tt + 0.012, cap, C.chrome));
  const F = b.fittings || {}, pad = F.pad || 0;
  if (pad) extrudes.push(boxX('motor_pad', [0, -L / 2 + Tt / 2, H.zT + cap + 0.006], pad, Tt + 0.02, 0.012, C.rubber));
  hardpoints.motor = r3v([0, -L / 2, H.zT + cap + (pad ? 0.012 : 0)]);
  // the keel strip along the bottom from the transom's foot, round the forefoot and up the stem
  const kr = b.keelStrip, keel = [];
  for (let s = (H.zT * H.tanR) / L + 0.004; s < 0.995; s += 0.03) { const st = H.at(s); keel.push([0, st.y, st.keel - kr * 0.4]); }
  const stem = H.at(1);
  // (a stem's strip runs up it; a square bow's ends at its foot)
  if (square) keel.push([0, L / 2 - 0.004, stem.keel - kr * 0.4]);
  else for (const f of [0, 0.4, 0.8]) keel.push([0, L / 2 + kr * 0.4, lerp(stem.keel, stem.sheer - 0.05, f)]);
  // (a moulded hull has none)
  if (kr) sweeps.push(sweep('keel_strip', keel, kr, C.chrome, { sides: 6 }));
  // the strakes along the bottom, a fraction of the way from the keel to the chine
  const K = b.strakes;
  if (K) for (const [k, f] of K.at.entries()) for (const sx of [1, -1]) {
    const path = [];
    for (let s = K.from; s <= K.to + 1e-9; s += 0.04) { const st = H.at(s); path.push([sx * (f * st.chineHalf + K.radius * 0.2), st.y, lerp(st.keel, st.chine, f) - K.radius * 0.35]); }
    sweeps.push(sweep(`strake_${k}_${sx > 0 ? 'r' : 'l'}`, path, K.radius, C.paint, { sides: 6 }));
  }
  // the fittings: the bow eye in the stem, the bow handle on the deck, the stern cleats and the oarlocks on the gunwales,
  // the drain plug and the transom's eyes in its face
  if (F.bowEye) {
    const z = F.bowEye, y = L / 2;
    sweeps.push(sweep('bow_eye', [[0, y - 0.01, z - 0.028], [0, y + 0.03, z - 0.022], [0, y + 0.047, z], [0, y + 0.03, z + 0.022], [0, y - 0.01, z + 0.028]], 0.0065, C.chrome, { sides: 6 }));
  }
  if (F.bowHandle && b.deck) {
    const st = H.at(0.93), zd = st.sheer - b.deck.thickness;
    sweeps.push(sweep('bow_handle', [[0, st.y - 0.09, zd - 0.004], [0, st.y - 0.08, zd + 0.05], [0, st.y + 0.06, zd + 0.05], [0, st.y + 0.07, zd - 0.004]], 0.008, C.chrome, { sides: 6 }));
  }
  if (F.cleats) for (const sx of [1, -1]) {
    const st = H.at(F.cleats), x = sx * (st.sheerHalf - (g ? g * 0.6 : Math.min(b.cap || 0.02, st.sheerHalf * 0.45) / 2)), z = st.sheer + (g ? g * 1.1 : 0.004), y = st.y;
    lathes.push(lathe(`cleat_post_${sx > 0 ? 'r' : 'l'}`, [x, y, z - 0.01], [x, y, z + 0.022], [[0, 0.012], [1, 0.009]], C.chrome, { samples: 10, crossSections: 2 }));
    sweeps.push(sweep(`cleat_${sx > 0 ? 'r' : 'l'}`, [[x, y - 0.075, z + 0.02], [x, y - 0.05, z + 0.032], [x, y + 0.05, z + 0.032], [x, y + 0.075, z + 0.02]], 0.0075, C.chrome, { sides: 6 }));
  }
  if (F.oarlocks) for (const sx of [1, -1]) {
    const st = H.at(F.oarlocks), x = sx * (st.sheerHalf - g * 0.4), z = st.sheer + g * 1.2, y = st.y;
    lathes.push(lathe(`oarlock_socket_${sx > 0 ? 'r' : 'l'}`, [x, y, z - 0.035], [x, y, z + 0.012], [[0, 0.013], [1, 0.013]], C.chrome, { samples: 10, crossSections: 2 }));
    sweeps.push(sweep(`oarlock_${sx > 0 ? 'r' : 'l'}`, [[x, y - 0.045, z + 0.075], [x, y - 0.04, z + 0.03], [x, y, z + 0.018], [x, y + 0.04, z + 0.03], [x, y + 0.045, z + 0.075]], 0.0055, C.chrome, { sides: 6 }));
  }
  // (the transom's aft face at the height z: raked, its top aft)
  const faceY = (z) => -L / 2 + (H.zT - z) * H.tanR;
  const nAft = [0, -Math.cos(b.transom.rake * DEG), -Math.sin(b.transom.rake * DEG)];
  if (F.drain) {
    const z = 0.045, c = [0, faceY(z) + 0.004, z];
    lathes.push(lathe('drain_plug', c, add(c, scale(nAft, 0.024)), [[0, 0.019], [0.5, 0.017], [0.55, 0.012], [1, 0.011]], C.rubber, { samples: 12, crossSections: 3 }));
  }
  if (F.transomEyes) for (const sx of [1, -1]) {
    const z = 0.2, x = sx * (F.transomEyes === true ? 0.42 : F.transomEyes), y = faceY(z) + 0.004;
    sweeps.push(sweep(`transom_eye_${sx > 0 ? 'r' : 'l'}`, [[x - 0.028, y, z], [x - 0.026, y - 0.034, z], [x + 0.026, y - 0.034, z], [x + 0.028, y, z]], 0.0055, C.chrome, { sides: 6 }));
  }
  // (the gunwale's top: the cap's, or the rail's)
  const top = (st) => st.sheer + (g ? g * 1.1 : 0.004);
  const NAVC = { r: '#2fd36b', l: '#e23b3b', c: '#f4f6f8' };
  // the bow rail: stanchions up from the gunwale either side, the rail along their tops and round ahead of the stem
  if (F.bowRail) {
    const R = F.bowRail, h = R.height, inset = (st) => Math.max(st.sheerHalf - (b.cap ? Math.min(b.cap, st.sheerHalf * 0.45) / 2 : g), 0.01);
    const posts = Array.from({ length: R.posts }, (_, k) => R.from + ((R.to - R.from) * k) / Math.max(1, R.posts - 1));
    const side = (sx) => posts.map((s) => { const st = H.at(s); return [sx * inset(st), st.y, top(st) + h]; });
    for (const sx of [1, -1]) for (const [k, s] of posts.entries()) {
      const st = H.at(s), x = sx * inset(st);
      lathes.push(lathe(`stanchion_${sx > 0 ? 'r' : 'l'}${k}`, [x, st.y, top(st) - 0.01], [x, st.y, top(st) + h], [[0, 0.02], [0.04, 0.012], [1, 0.012]], C.chrome, { samples: 10, crossSections: 3 }));
    }
    const tip = H.at(1), nose = [0, tip.y - 0.03, top(tip) + h];
    const st = side(1), last = st[st.length - 1];
    const round = [[last[0] * 0.55, (last[1] + nose[1]) / 2 + 0.02, (last[2] + nose[2]) / 2], nose, [-last[0] * 0.55, (last[1] + nose[1]) / 2 + 0.02, (last[2] + nose[2]) / 2]];
    sweeps.push(sweep('bow_rail', [...st, ...round, ...side(-1).reverse()], 0.013, C.chrome, { sides: 8 }));
  }
  // the nav lights: a sidelight pair on the bow (green to starboard, red to port), the all-round white light aft on a pole
  if (F.navLights) {
    const st = H.at(0.965), z = b.deck ? st.sheer - b.deck.thickness : top(st);
    for (const sx of [1, -1]) {
      const c = [sx * 0.035, st.y, z];
      lathes.push(lathe(`sidelight_${sx > 0 ? 'r' : 'l'}`, c, add(c, [0, 0, 0.05]), [[0, 0.028], [0.4, 0.026], [0.6, 0.024], [1, 0.01]], NAVC[sx > 0 ? 'r' : 'l'], { material: 'neon', samples: 12, crossSections: 4 }));
    }
    const sa = H.at(0.05), x = -(sa.sheerHalf - (b.cap ? Math.min(b.cap, sa.sheerHalf * 0.45) / 2 : g)), zp = top(sa);
    lathes.push(lathe('light_pole', [x, sa.y, zp - 0.01], [x, sa.y, zp + 0.95], [[0, 0.016], [0.03, 0.011], [1, 0.011]], C.chrome, { samples: 10, crossSections: 3 }));
    lathes.push(lathe('all_round_light', [x, sa.y, zp + 0.95], [x, sa.y, zp + 1.01], [[0, 0.02], [0.5, 0.022], [1, 0.012]], NAVC.c, { material: 'neon', samples: 12, crossSections: 3 }));
  }
  // rod holders flush in the gunwale's top, raked aft and outboard
  for (const [k, s] of (F.rodHolders || []).entries()) for (const sx of [1, -1]) {
    const st = H.at(s), x = sx * (st.sheerHalf - (b.cap ? Math.min(b.cap, st.sheerHalf * 0.45) / 2 : g)), z = top(st);
    lathes.push(lathe(`rod_holder_${sx > 0 ? 'r' : 'l'}${k}`, [x, st.y, z + 0.008], [x + sx * 0.03, st.y - 0.06, z - 0.2], [[0, 0.025], [0.04, 0.021], [1, 0.019]], C.chrome, { samples: 10, crossSections: 3 }));
  }
  // a stripe along the topsides, `at` of the way from the chine to the sheer
  if (b.stripe) for (const sx of [1, -1]) {
    const K = b.stripe, path = [];
    for (let s = startOf(0) + 0.004; s < 0.97; s += 0.03) {
      const st = H.at(s), bulge = (b.flare || 0) * Math.min(1, st.sheerHalf / 0.3) * (1 - Math.abs(2 * K.at - 1));
      path.push([sx * (lerp(st.chineHalf, st.sheerHalf, K.at) + bulge + K.radius * 0.2), st.y, lerp(st.chine, st.sheer, K.at)]);
    }
    sweeps.push(sweep(`stripe_${sx > 0 ? 'r' : 'l'}`, path, K.radius, C[K.tint ?? 'trim'], { sides: 6 }));
  }
  // named points on the sole (or the floor) along the boat: where a console or a seat stands, on the centreline
  for (const [name, s] of Object.entries(b.points || {})) {
    const I = lines(s).I, mid = (I.length - 1) / 2;
    hardpoints[name] = r3v([0, H.at(s).y, Number.isFinite(b.sole) ? b.sole : I[mid][1]]);
  }
  // where a tank stands on the floor (its outboard edge on the bottom, the V falling away under its inboard one)
  if (b.tank) {
    const t = b.tank, I = lines(t.at).Iopen;
    hardpoints.tank = r3v([t.x, H.at(t.at).y, Math.max(bottomAt(I, t.x + t.width / 2), Number.isFinite(b.sole) ? b.sole : -Infinity)]);
  }
  return { lofts, extrudes, sweeps, lathes, hardpoints };
}

// a RIB's collar: one tube from the transom along the starboard sheer, round the bow (rising), back along the port sheer,
// its cones run aft past the transom; its rubbing strake along its side and its lifeline along its top. Centred outboard
// of the sheer by `out` of its radius and above it by `up`, so it sits on the hull's edge
function collarOf(K, H, C, { sweeps, lathes }) {
  const r = K.radius, tint = C[K.tint ?? 'trim'], { L } = H, out = K.out ?? 0.45, up = K.up ?? 0.15, nose = K.nose ?? 0.94;
  const at = (sx, s, dx = 0, dz = 0) => { const st = H.at(s); return [sx * (st.sheerHalf + r * out + dx), st.y, st.sheer + r * up + dz]; };
  // (round the bow: two quadratic arcs from either side to the nose, ahead of the stem and lifted by `rise`, each leaving
  // the side the way the side runs, so nothing along the tube kinks where they meet)
  const bow = (dx, dz) => {
    const a = at(1, nose, dx, dz), p = at(1, nose - 0.03, dx, dz), N = [0, a[1] + Math.abs(a[0]) * 1.05, a[2] + (K.rise ?? 0.1)];
    const d = [a[0] - p[0], a[1] - p[1]], k = (N[1] - a[1]) / (d[1] || 1);
    const Q = [Math.max(a[0] + d[0] * k, a[0] * 0.6), N[1], (a[2] + N[2]) / 2];
    const quad = (p, q, n, t) => [0, 1, 2].map((k) => (1 - t) ** 2 * p[k] + 2 * (1 - t) * t * q[k] + t * t * n[k]);
    const half = [0.2, 0.4, 0.6, 0.8].map((t) => quad(a, Q, N, t));
    return [...half, N, ...half.slice().reverse().map(([x, y, z]) => [-x, y, z])];
  };
  const S = [];
  for (let s = 0; s < nose - 1e-9; s += 0.04) S.push(s);
  S.push(nose);
  const P = [...S.map((s) => at(1, s)), ...bow(0, 0), ...S.slice().reverse().map((s) => at(-1, s))];
  // (what runs along the tube is its path moved out along its own level normal: concentric with it all the way round)
  const along = (dx, dz) => P.map((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    return [p[0] + (ty / l) * dx, p[1] - (tx / l) * dx, p[2] + dz];
  });
  sweeps.push(sweep('collar', P, r, tint, { sides: 16 }));
  sweeps.push(sweep('rubbing_strake', along(r * 0.92, -r * 0.1), r * 0.16, C.rubber, { sides: 8 }));
  if (K.lifeline) sweeps.push(sweep('lifeline', along(-r * 0.1, r * 0.98), 0.0055, C.rubber, { sides: 6 }));
  // the cones aft of the transom, each tapering to its end cap
  for (const sx of [1, -1]) {
    const c = at(sx, 0);
    lathes.push(lathe(`cone_${sx > 0 ? 'r' : 'l'}`, [c[0], c[1] + 0.03, c[2]], [c[0], c[1] - (K.aft ?? 0.3), c[2] + r * 0.12], [[0, r], [0.45, r * 0.97], [0.8, r * 0.78], [0.95, r * 0.5], [1, r * 0.22]], tint, { samples: 18, crossSections: 6 }));
  }
}

// ---- the outboard -------------------------------------------------------------------------------

// a symmetric foil's section in the x-y plane (its leading edge at y = 0, its chord running aft to −chord), CCW seen from
// above: a NACA four-digit thickness of `thick` (a fraction of the chord), its trailing edge a hair thick
function foilXY(chord, thick, k = 9) {
  const xs = Array.from({ length: k }, (_, i) => (1 - Math.cos((Math.PI * i) / (k - 1))) / 2);
  const yt = (x) => 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4) + 0.002 * x;
  const stbd = xs.map((x) => [yt(x) * chord, -x * chord]);
  const port = xs.slice(1, -1).reverse().map((x) => [-yt(x) * chord, -x * chord]);
  return [...stbd, ...port];
}

function buildOutboard(row, C, opts = {}) {
  const b = row.build;
  if (b.family !== 'tiller' && b.family !== 'remote') throw new Error(`Unknown boat-outboard family '${b.family}'`);
  // (a remote motor is steered and shifted from a helm: no tiller, no shift lever, no starter's cord; bolted through the
  // transom, no clamp screws; its rigging into the boat and its steering ram along its tilt tube)
  const remote = b.family === 'remote';
  const pose = opts.pose || {}, S = b.shaft, Tt = b.transom, rk = b.rake * DEG, tanR = Math.tan(rk);
  // its pose: tilted up about the tilt tube (0 … 1 of its travel), steered about the swivel (−1 … 1 of its lock: + the
  // tiller to port, the boat to starboard), its propeller turned (degrees)
  const tiltA = clamp(pose.tilt, 0, 1) * b.tilt * DEG, steerA = clamp(pose.yaw, -1, 1) * b.steer * DEG;
  // (its brackets, its leg and its gearcase at `leg` of the 20 hp class's size)
  const TILT = [0, -0.06, -0.045], SWIVEL = [0, -0.115], G = b.leg ?? 1;
  const rotX = (a, v) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
  const rotZ = (a, v) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
  const tiltD = (v) => rotX(-tiltA, v), tiltP = (p) => add(TILT, tiltD([p[0] - TILT[0], p[1] - TILT[1], p[2] - TILT[2]]));
  const steerD = (v) => rotZ(steerA, v), steerP = (p) => { const q = rotZ(steerA, [p[0], p[1] - SWIVEL[1], p[2]]); return [q[0], q[1] + SWIVEL[1], q[2]]; };
  // three frames: what stays with the boat, what tilts (the swivel bracket), what tilts and steers (the motor)
  const FR = {
    fixed: { P: (p) => p, D: (v) => v },
    tilt: { P: tiltP, D: tiltD },
    motor: { P: (p) => tiltP(steerP(p)), D: (v) => tiltD(steerD(v)) },
  };
  const out = { lathes: [], extrudes: [], sweeps: [], lofts: [] };
  const L_ = (f, id, from, to, pairs, tint, extra) => out.lathes.push(lathe(id, FR[f].P(from), FR[f].P(to), pairs, tint, extra));
  const E_ = (f, id, from, to, offsets, tint, extra) => { const a = FR[f].P(from), z = FR[f].P(to), o = offsets.map(FR[f].D); out.extrudes.push(extrudeWorld(id, a, z, ccw(a, z, o), tint, extra)); };
  const W_ = (f, id, path, r, tint, extra) => out.sweeps.push(sweep(id, path.map(FR[f].P), r, tint, extra));
  const F_ = (f, id, from, to, stations, tint, extra) => out.lofts.push(loftWorld(id, FR[f].P(from), FR[f].P(to), stations.map((st) => ({ t: st.t, points: st.points.map(FR[f].D) })), tint, extra));
  // (its cowl in its colour role, `tint.cowl`: the palette's trim unless it says otherwise; its leg that colour, its pan darker)
  const body = C[b.tint?.cowl ?? 'trim'], metal = tone(body, -0.12), dark = tone(body, -0.42);

  // -- with the boat: the clamp bracket over the transom (its back plate down the aft face, its top on the transom, its
  // lip down the inside), its two clamp screws and their handles, the tilt tube
  const down = [0, tanR, -1], d = Math.hypot(...down), dn = scale(down, 1 / d), nAft = [0, -Math.cos(rk), -Math.sin(rk)];
  const back = add([0, 0, 0.022], scale(nAft, 0.011)), backTo = add(back, scale(dn, 0.27));
  E_('fixed', 'clamp_back', back, backTo, rect([1, 0, 0], nAft, 0.17 * G, 0.022), C.chrome);
  E_('fixed', 'clamp_top', [0, -0.022, 0.013], [0, Tt + 0.022, 0.013], rect([1, 0, 0], [0, 0, 1], 0.17 * G, 0.026), C.chrome);
  const lip = [0, Tt + 0.01, 0.022], lipTo = add(lip, scale(dn, 0.15));
  E_('fixed', 'clamp_lip', lip, lipTo, rect([1, 0, 0], [0, Math.cos(rk), Math.sin(rk)], 0.17 * G, 0.02), C.chrome);
  if (!remote) for (const sx of [1, -1]) {
    const z = -0.09, y0 = Tt + 0.09 * tanR, x = sx * 0.055;
    L_('fixed', `clamp_screw_${sx > 0 ? 'r' : 'l'}`, [x, y0 - 0.004, z], [x, y0 + 0.07, z], [[0, 0.03], [0.12, 0.03], [0.16, 0.008], [1, 0.008]], C.chrome, { samples: 10, crossSections: 4 });
    W_('fixed', `clamp_handle_${sx > 0 ? 'r' : 'l'}`, [[x - 0.045, y0 + 0.07, z], [x + 0.045, y0 + 0.07, z]], 0.008, C.rubber, { sides: 6 });
  }
  // the stern bracket's cheeks, from the back plate aft to the tilt tube (they carry it clear of the transom, so the motor
  // tilts up outside the boat)
  for (const sx of [1, -1]) E_('fixed', `stern_bracket_${sx > 0 ? 'r' : 'l'}`, [sx * 0.062 * G, 0, 0], [sx * 0.084 * G, 0, 0], [[0, -0.012, 0.01], [0, TILT[1] - 0.028, TILT[2] + 0.03], [0, TILT[1] - 0.028, TILT[2] - 0.035], [0, -0.012 + 0.16 * tanR, -0.16]], C.chrome);
  L_('fixed', 'tilt_tube', [-0.11 * G, TILT[1], TILT[2]], [0.11 * G, TILT[1], TILT[2]], [[0, 0.017], [1, 0.017]], C.chrome, { samples: 12, crossSections: 2 });
  // (a remote motor's bolts through the transom; its steering ram along the tilt tube, its rods out either end)
  if (remote) {
    for (const [i, [x, z]] of [[0.05, -0.05], [-0.05, -0.05], [0.05, -0.17], [-0.05, -0.17]].entries()) {
      const c = [x * G, Tt + 0.006 + (0.022 - z) * tanR, z];
      L_('fixed', `transom_bolt_${i}`, c, add(c, [0, 0.025, 0]), [[0, 0.016], [0.4, 0.016], [0.45, 0.008], [1, 0.008]], C.chrome, { samples: 8, crossSections: 3 });
    }
    const zr = TILT[2] + 0.05;
    L_('fixed', 'steering_ram', [-0.17 * G, TILT[1], zr], [0.17 * G, TILT[1], zr], [[0, 0.024], [0.06, 0.028], [0.94, 0.028], [1, 0.024]], C.rubber, { samples: 14, crossSections: 4 });
    for (const sx of [1, -1]) L_('fixed', `ram_rod_${sx > 0 ? 'r' : 'l'}`, [sx * 0.165 * G, TILT[1], zr], [sx * 0.22 * G, TILT[1], zr], [[0, 0.01], [1, 0.01]], C.chrome, { samples: 8, crossSections: 2 });
  }
  // -- tilting: the swivel bracket, its arms to the tilt tube, the swivel's tube down the steering axis
  // (the pan stands `cowl.lift` over the clamp's top: a bigger motor's powerhead higher)
  const zPan = b.cowl.lift ?? 0.13;
  E_('tilt', 'swivel_arm', [0, TILT[1] + 0.01, TILT[2]], [0, SWIVEL[1] + 0.02, TILT[2]], rect([1, 0, 0], [0, 0, 1], 0.12 * G, 0.05), metal);
  L_('tilt', 'swivel', [0, SWIVEL[1], -0.25], [0, SWIVEL[1], zPan - 0.005], [[0, 0.031 * G], [1, 0.031 * G]], metal, { samples: 14, crossSections: 2 });
  // -- the motor: its powerhead's pan and cowl, lofted front (over the transom) to back
  const cw = b.cowl, yF = 0, yB = yF - cw.length, panH = 0.15 * (cw.pan ?? 1);
  const ax = [[0, yF, 0], [0, yB, 0]];
  const sect = (a, hb, n, belly, zc) => section(a, hb, n, belly).map(([x, z]) => [x, 0, zc + z]);
  F_('motor', 'pan', ...ax, [[0, 0.7, 0.62], [0.1, 0.96, 0.9], [0.55, 1, 1], [0.9, 0.95, 0.92], [1, 0.72, 0.66]].map(([t, w, h]) => ({ t, points: sect((cw.width / 2) * w * 1.02, (panH / 2) * h, 4, 1, zPan + panH / 2) })), dark);
  const zTop = zPan + cw.height, zc = zPan + panH * 0.75;
  F_('motor', 'cowl', ...ax, [[0, 0.5, 0.55], [0.12, 0.9, 0.85], [0.5, 1, 1], [0.86, 0.96, 0.96], [1, 0.66, 0.7]].map(([t, w, h]) => ({ t, points: sect((cw.width / 2) * w, (zTop - zc) * h, 2.6, 0.35, zc) })), body, { interp: 'smooth', segments: 3 });
  // the cowl's intake on its top aft, its latch at the back, the starter's handle in front, the tell-tale at the back
  E_('motor', 'intake', [0, yB + cw.length * 0.36, zTop - 0.012], [0, yB + cw.length * 0.14, zTop - 0.012], rect([1, 0, 0], [0, 0, 1], 0.13, 0.03), dark);
  E_('motor', 'latch', [0, yB - 0.004, zPan + panH + 0.01], [0, yB + 0.02, zPan + panH + 0.01], rect([1, 0, 0], [0, 0, 1], 0.07, 0.03), dark);
  if (!remote) E_('motor', 'starter', [0.07, yF + 0.012, zc + 0.12], [0.07, yF - 0.02, zc + 0.12], rect([1, 0, 0], [0, 0, 1], 0.075, 0.024), C.rubber);
  L_('motor', 'telltale', [0.06, yB + 0.02, zPan + 0.05], [0.06, yB - 0.008, zPan + 0.05], [[0, 0.007], [1, 0.005]], C.chrome, { samples: 8, crossSections: 2 });
  // the shift lever on the starboard side of the pan, its knob
  if (!remote) W_('motor', 'shift', [[0.16, yF - 0.08, zPan + 0.08], [0.205, yF - 0.04, zPan + 0.12], [0.215, yF - 0.0, zPan + 0.16]], 0.008, C.rubber, { sides: 6 });
  if (!remote) L_('motor', 'shift_knob', [0.215, yF - 0.0, zPan + 0.15], [0.215, yF + 0.005, zPan + 0.185], [[0, 0.014], [0.6, 0.014], [1, 0.006]], C.rubber, { samples: 10, crossSections: 3 });
  // the midsection from under the pan to the anti-ventilation plate: a foil, its chord along the boat
  // (the leg and the gearcase drawn at `leg` of the 20 hp class's size: a smaller motor's are slimmer)
  const yLE = SWIVEL[1] - 0.024, mid = (chord, thick) => foilXY(chord * G, thick).map(([x, y]) => [x, y, 0]);
  F_('motor', 'midsection', [0, yLE, zPan + 0.02], [0, yLE, -S], [[0, 0.24, 0.42], [0.25, 0.22, 0.4], [1, 0.2, 0.36]].map(([t, c, k]) => ({ t, points: mid(c, k) })), metal, { interp: 'smooth', segments: 3 });
  // the anti-ventilation plate, wrapping the leg and running aft over the propeller
  const plate = [[0.045, -0.02], [0.1, -0.08], [0.105, -0.22], [0.075, -0.29], [-0.075, -0.29], [-0.105, -0.22], [-0.1, -0.08], [-0.045, -0.02]];
  E_('motor', 'av_plate', [0, yLE, -S - 0.006], [0, yLE, -S + 0.004], plate.map(([x, y]) => [x * G, y * G, 0]), metal);
  // the gearcase: its strut, the torpedo round the gears, the skeg under it; the water intake's grille on the strut
  const zG = -S - 0.105 * G;
  F_('motor', 'strut', [0, yLE, -S + 0.01], [0, yLE, zG + 0.02], [[0, 0.2, 0.34], [1, 0.19, 0.3]].map(([t, c, k]) => ({ t, points: mid(c, k) })), metal);
  const yN = yLE + 0.01, yA = yLE - 0.215 * G;
  L_('motor', 'torpedo', [0, yN, zG], [0, yA, zG], [[0, 0.01], [0.07, 0.03], [0.25, 0.044], [0.7, 0.043], [1, 0.037]].map(([t, r]) => [t, r * G]), metal, { samples: 18, crossSections: 6 });
  E_('motor', 'skeg', [-0.0065, 0, 0], [0.0065, 0, 0], [[0, yLE - 0.03 * G, zG - 0.03 * G], [0, yLE - 0.2 * G, zG - 0.035 * G], [0, yLE - 0.17 * G, zG - 0.13 * G], [0, yLE - 0.1 * G, zG - 0.135 * G]], metal);
  for (const sx of [1, -1]) E_('motor', `intake_grille_${sx > 0 ? 'r' : 'l'}`, [sx * 0.022 * G, yLE - 0.06 * G, zG + 0.055 * G], [sx * 0.032 * G, yLE - 0.06 * G, zG + 0.055 * G], rect([0, 1, 0], [0, 0, 1], 0.05 * G, 0.022 * G), dark);
  // the propeller: its hub on the shaft aft of the torpedo, its blades each a foil section at its radius pitched to the
  // helix its pitch draws (steep at the root, flat at the tip), raked aft; it turns about the shaft the way its hand does
  const P = b.prop, R = P.diameter / 2, r0 = 0.03 * G, hand = P.hand === 'lh' ? -1 : 1;
  const hubFrom = [0, yA + 0.004, zG], hubTo = [0, yA - 0.085 * G, zG];
  L_('motor', 'prop_hub', hubFrom, hubTo, [[0, 0.036], [0.55, 0.034], [1, 0.025]].map(([t, r]) => [t, r * G]), C.chrome, { samples: 18, crossSections: 3 });
  const spin = ((Number(pose.prop) || 0) % 360) * DEG * hand, yb = yA - 0.04 * G, rake = Math.tan(12 * DEG);
  const chordAt = (f) => G * (f < 0.5 ? lerp(0.07, 0.112, f / 0.5) : lerp(0.112, 0.035, ((f - 0.5) / 0.5) ** 1.8));
  for (let k = 0; k < P.blades; k += 1) {
    const phi = Math.PI / 2 + (2 * Math.PI * k) / P.blades + spin, rhat = [Math.cos(phi), 0, Math.sin(phi)];
    // (seen from astern a right-hand propeller turns clockwise: its blades move along +y × r)
    const t = scale([Math.sin(phi), 0, -Math.cos(phi)], hand);
    const station = (f) => {
      const r = r0 + f * (R - r0), beta = Math.atan(P.pitch / (2 * Math.PI * r)), c = chordAt(f), th = c * (0.11 - 0.07 * f);
      const cd = add(scale(t, Math.cos(beta)), [0, Math.sin(beta), 0]), nd = add(scale(t, -Math.sin(beta)), [0, Math.cos(beta), 0]);
      const back = [0, -(r - r0) * rake, 0];
      return Array.from({ length: 10 }, (_, i) => { const a = (2 * Math.PI * i) / 10; return add(back, add(scale(cd, (c / 2) * Math.cos(a)), scale(nd, (th / 2) * Math.sin(a)))); });
    };
    const from = add([0, yb, zG], scale(rhat, r0)), to = add([0, yb, zG], scale(rhat, R));
    F_('motor', `blade_${k}`, from, to, [0, 0.35, 0.75, 1].map((f) => ({ t: f, points: station(f) })), C.chrome, { interp: 'smooth', segments: 3 });
  }
  // the tiller from its bracket at the pan's front, forward over the transom into the boat; its twist grip. It folds up
  // about its bracket (the craft's `fold`, 0 out … 1 up): how a tilted motor's tiller is kept out of the boat
  const tl = b.tiller, zt = zPan + 0.06, TP = [0, yF - 0.01, zt], foldA = clamp(opts.fold, 0, 1) * (b.fold?.angle ?? 0) * DEG;
  if (!remote) {
    FR.tiller = { P: (p) => FR.motor.P(add(TP, rotX(foldA, [p[0] - TP[0], p[1] - TP[1], p[2] - TP[2]]))), D: (v) => FR.motor.D(rotX(foldA, v)) };
    L_('motor', 'tiller_bracket', [-0.055, TP[1], zt], [0.055, TP[1], zt], [[0, 0.026], [1, 0.026]], dark, { samples: 12, crossSections: 2 });
    W_('tiller', 'tiller', [TP, [0, yF + tl * 0.35, zt + 0.02], [0, yF + tl * 0.72, zt + 0.045]], 0.021, dark, { sides: 8 });
    L_('tiller', 'grip', [0, yF + tl * 0.7, zt + 0.044], [0, yF + tl, zt + 0.06], [[0, 0.025], [0.1, 0.028], [0.9, 0.028], [1, 0.022]], C.rubber, { samples: 14, crossSections: 4 });
  } else {
    // the rigging's boot in the pan's front, its hose forward and down over the transom into the boat
    const rb = [0, yF + 0.004, zPan + 0.06];
    L_('motor', 'rigging_boot', add(rb, [0, -0.03, 0]), add(rb, [0, 0.05, 0]), [[0, 0.045], [0.5, 0.04], [1, 0.034]], C.rubber, { samples: 14, crossSections: 3 });
    W_('motor', 'rigging', [add(rb, [0, 0.04, 0]), [0, Tt + 0.12, rb[2] - 0.02], [0, Tt + 0.3, -0.06], [0, Tt + 0.36, -0.2]], 0.026, C.rubber, { sides: 8 });
  }
  const hub = FR.motor.P([0, (hubFrom[1] + hubTo[1]) / 2, zG]);
  const joints = [
    { name: 'tilt', control: 'tilt', kind: 'hinge', at: r3v(TILT), dir: [-1, 0, 0], range: [0, b.tilt], angle: round3(tiltA / DEG) || 0 },
    { name: 'steer', control: 'yaw', kind: 'hinge', at: r3v(tiltP([0, SWIVEL[1], 0])), dir: r3v(tiltD([0, 0, 1])), range: [-b.steer, b.steer], angle: round3(steerA / DEG) || 0 },
    { name: 'prop', control: 'prop', kind: 'spin', at: r3v(hub), dir: r3v(FR.motor.D([0, hand, 0])), range: [0, 360], angle: round3((Number(pose.prop) || 0) % 360) || 0 },
    ...(b.fold ? [{ name: 'tiller', control: 'fold', kind: 'hinge', at: r3v(FR.motor.P(TP)), dir: r3v(FR.motor.D([1, 0, 0])), range: [0, b.fold.angle], angle: round3(foldA / DEG) || 0 }] : []),
  ];
  return { ...out, hardpoints: { mount: [0, 0, 0], prop: r3v(hub), plate: r3v(FR.motor.P([0, yLE, -S])) }, joints, ...(b.fold ? { fold: round3(foldA / DEG) || 0 } : {}) };
}

// ---- the tank ---------------------------------------------------------------------------------

function buildTank(row, C) {
  const b = row.build;
  if (b.family !== 'moulded') throw new Error(`Unknown boat-tank family '${b.family}'`);
  const { length: l, width: w, height: h } = row.dims, body = b.color || C.paint;
  const sect = (k, kh) => section((w / 2) * k, (h / 2) * kh, 5, 1).map(([x, z]) => [x, 0, h / 2 + z * 1]);
  const lofts = [loftWorld('body', [0, l / 2, 0], [0, -l / 2, 0], [[0, 0.9, 0.88], [0.06, 1, 1], [0.94, 1, 1], [1, 0.9, 0.88]].map(([t, k, kh]) => ({ t, points: sect(k, kh) })), body)];
  const sweeps = [sweep('handle', [[0, -l * 0.3, h - 0.01], [0, -l * 0.26, h + 0.045], [0, l * 0.08, h + 0.045], [0, l * 0.12, h - 0.01]], 0.013, body, { sides: 8 })];
  const lathes = [
    lathe('cap', [0, l * 0.3, h - 0.01], [0, l * 0.3, h + 0.03], [[0, 0.04], [0.7, 0.04], [1, 0.036]], C.rubber, { samples: 16, crossSections: 3 }),
    lathe('gauge', [w * 0.22, -l * 0.36, h - 0.01], [w * 0.22, -l * 0.36, h + 0.012], [[0, 0.03], [1, 0.028]], C.rubber, { samples: 14, crossSections: 2 }),
    lathe('gauge_glass', [w * 0.22, -l * 0.36, h + 0.012], [w * 0.22, -l * 0.36, h + 0.016], [[0, 0.022], [1, 0.022]], C.glass, { samples: 14, crossSections: 2, material: 'glass' }),
    lathe('fitting', [w * 0.2, -l / 2 + 0.01, h * 0.75], [w * 0.2, -l / 2 - 0.03, h * 0.75], [[0, 0.018], [0.4, 0.018], [0.5, 0.012], [1, 0.012]], C.chrome, { samples: 12, crossSections: 3 }),
  ];
  return { lofts, sweeps, lathes, hardpoints: { mount: [0, 0, 0] } };
}

export const BOAT_BUILDERS = {
  'boat-hull': buildHull,
  'boat-outboard': buildOutboard,
  'boat-tank': buildTank,
  // (the console and the seat: boat-helm.js)
  ...HELM_BUILDERS,
};
