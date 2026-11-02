/**
 * THE FIELD'S RUNNING GEAR: what a tracked vehicle runs on, one side at a time, in the hard-surface manner of the hull
 * kit (mil-hull.js). A track is links, not a band: each link a shoe with its grouser, its end connectors over the pins
 * and its guide horn between the road wheels' tyres, the links laid as chords between pins evenly pitched along the
 * track's path, so a track polygonizes round its sprocket and its idler as a real one does.
 *
 *   sprocket       the drive sprocket at the rear: two toothed rings on a hub, its bolts, on its final drive
 *   idler          the idler at the front: a dual steel wheel on its tensioner arm
 *   road wheels    dual and rubber-tyred, a dished steel disc each side, its hub cap and its bolts; each on a trailing
 *                  arm from its torsion bar's housing on the hull, a bump stop over the arm
 *   return rollers small and rubber-tyred on their brackets, carrying the upper run
 *   the track      its path the lower hull of the sprocket, the road wheels and the idler (flat on the ground under the
 *                  road wheels, straight up to the idler and down from the sprocket), and over the top from the idler to
 *                  the sprocket resting on the return rollers and sagging between them
 *
 *   linkFaces(W, P)                    one link in its own frame (x across, y along, z out): the spares a hull carries
 *   TRACK_DEPTH                        the track's thickness under a road wheel: its shoe and its grouser (a road wheel's
 *                                      centre stands its radius and this above the ground)
 *   runningGear({ side, x, width, hullX, sprocket, idler, wheels, rollers, pitch?, sag?, paint? })
 *     → { faces, spinners: [{ id, kind, hub, r, faces }], path, pins }
 *     side         −1 the left, +1 the right; x the track's centre line across (a magnitude), width the track's
 *     hullX        the hull's side (a magnitude): where the arms, the housings and the brackets are fixed
 *     sprocket     { y, z, r }; idler { y, z, r }; wheels [{ y, r }] (their height from the ground, TRACK_DEPTH);
 *                  rollers [{ y, z, r }]
 *     faces        what stands still with the hull: the track's links, the arms, housings, stops and brackets
 *     spinners     what turns about its axle (x): each road wheel, the sprocket, the idler and each roller, its hub and
 *                  its radius (a bone each, turning by its own radius)
 *     path         the track's inner line, a closed loop in [y, z], anticlockwise seen from +x; pins its pins on it
 *
 * Vehicle space (+y forward, x across, z up), metres. Pure and deterministic.
 */
import { plate, tube, bolts, place } from './mil-hull.js';

export const TRACK_DEPTH = 0.055;
const SHOE = 0.03;
const C = Object.freeze({ link: '#3e3c37', pin: '#2f2e2a', rubber: '#1b1c1e', steel: '#45463f' });
const M = (part, material, albedo) => ({ part, material, albedo });
const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;

// ── the path ────────────────────────────────────────────────────────────────────
const cross2 = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
// the convex hull of points [y, z], anticlockwise (Andrew's chain)
function hull2(pts) {
  const P = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), lo = [], hi = [];
  for (const p of P) { while (lo.length >= 2 && cross2(lo[lo.length - 2], lo[lo.length - 1], p) <= 1e-12) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (hi.length >= 2 && cross2(hi[hi.length - 2], hi[hi.length - 1], p) <= 1e-12) hi.pop(); hi.push(p); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
const ring = (c, k = 48) => Array.from({ length: k }, (_, i) => [c.y + c.r * Math.cos((2 * Math.PI * i) / k), c.z + c.r * Math.sin((2 * Math.PI * i) / k)]);

/** The track's inner line: the lower hull of its wheels from the sprocket's top round to the idler's, then back over
 *  the return rollers, sagging between each support. A closed loop [y, z], anticlockwise seen from +x. */
export function trackPath({ sprocket, idler, wheels, rollers = [], sag = 0.03 }) {
  const H = hull2([sprocket, idler, ...wheels].flatMap((c) => ring(c)));
  const near = (q) => H.reduce((b, p, i) => (Math.hypot(p[0] - q[0], p[1] - q[1]) < Math.hypot(H[b][0] - q[0], H[b][1] - q[1]) ? i : b), 0);
  const s = near([sprocket.y, sprocket.z + sprocket.r]), e = near([idler.y, idler.z + idler.r]);
  // (the chain from the sprocket's top, anticlockwise: down its back, along the ground, up the front to the idler's top)
  const chain = [];
  for (let i = s; ; i = (i + 1) % H.length) { chain.push(H[i]); if (i === e) break; }
  // the top run: from the idler's top back over the rollers to the sprocket's, a sag between each pair of supports
  const supports = [H[e], ...rollers.filter((c) => c.y < H[e][0] && c.y > H[s][0]).sort((a, b) => b.y - a.y).map((c) => [c.y, c.z + c.r]), H[s]];
  const top = [];
  for (let k = 0; k + 1 < supports.length; k++) {
    const [a, b] = [supports[k], supports[k + 1]], span = Math.abs(a[0] - b[0]), dip = sag * Math.min(1, span / 1.2), n = 8;
    for (let j = 1; j < n; j++) { const t = j / n; top.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 4 * dip * t * (1 - t)]); }
    if (k + 2 < supports.length) top.push(b);
  }
  return [...chain, ...top].map((p) => p.map(r6));
}

/** Pins along a closed path, `n` of them evenly spaced by its length (so the links are evenly pitched and close). */
export function pinsAlong(path, pitch) {
  const seg = path.map((p, i) => { const q = path[(i + 1) % path.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]); });
  const L = seg.reduce((a, b) => a + b, 0), n = Math.max(8, Math.round(L / pitch)), out = [];
  let i = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const s = (k * L) / n;
    while (acc + seg[i] < s) { acc += seg[i]; i++; }
    const t = (s - acc) / seg[i], p = path[i], q = path[(i + 1) % path.length];
    out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
  }
  return out;
}

// ── a link, in its own frame: x across, y along its chord, z out from the track's inner face ───────────────────
/** One track link `W` across and `P` long, in its own frame (x across, y along, z out of the track's inner face): what
 *  a track is laid of, and the spares a hull carries bolted on. */
export function linkFaces(W, P) {
  const shoe = M('track.shoe', 'steel', C.link), dark = M('track.pin', 'steel', C.pin), out = [];
  const h = (P - 0.014) / 2;
  out.push(...plate({ axis: 'z', profile: [[-W / 2, -h], [W / 2, -h], [W / 2, h], [-W / 2, h]], from: 0, to: SHOE, look: shoe }));
  // the grouser across the shoe's outer face (what bites the ground), two pads' gap down its middle
  for (const [a, b] of [[-W / 2 + 0.01, -0.035], [0.035, W / 2 - 0.01]]) out.push(...plate({ axis: 'x', profile: [[-0.03, SHOE], [0.03, SHOE], [0.018, TRACK_DEPTH], [-0.018, TRACK_DEPTH]], from: a, to: b, look: shoe }));
  // the end connectors over the pin at the link's fore end, each side
  for (const s of [-1, 1]) out.push(...plate({ axis: 'x', profile: [[h - 0.03, 0.004], [h + 0.03, 0.004], [h + 0.03, SHOE - 0.004], [h - 0.03, SHOE - 0.004]], from: s * (W / 2), to: s * (W / 2 + 0.024), look: dark }));
  // the guide horn, inward between the road wheels' tyres
  out.push(...plate({ axis: 'x', profile: [[-0.04, 0], [0.04, 0], [0.024, -0.075], [-0.024, -0.075]], from: -0.021, to: 0.021, look: shoe }));
  return out;
}

// ── what turns ──────────────────────────────────────────────────────────────────
// a dual wheel about an axle along x at `hub`, its two halves either side of a gap for the guide horns; `outer` the
// side its face looks to (+1: +x)
function dualWheel({ hub, r, width, gap, tyre, paint, outer, bolted = 8 }) {
  const [x, y, z] = hub, half = (width - gap) / 2, out = [], disc = M('wheel.disc', 'milPaint', paint), sides = r < 0.15 ? 12 : 20;
  for (const s of [-1, 1]) {
    const x0 = x + s * gap / 2, x1 = x + s * (gap / 2 + half);
    // (the tyre, rubber, or the idler's steel rim; then the disc proud of it, dished in to its hub)
    out.push(...tube([[x0, y, z], [x1, y, z]], r, { sides, look: tyre ? M('wheel.tyre', 'rubber', C.rubber) : M('wheel.rim', 'steel', C.steel) }));
    const face = x1 + s * 0.006, rim = r - (tyre ? 0.045 : 0.02);
    out.push(...tube([[x1, y, z], [face, y, z]], rim, { sides, look: disc }));
    // (its hub cap and its bolts on the face that looks out; the inner half's face is seen only past the gap)
    if (s === outer) {
      out.push(...tube([[face, y, z], [face + s * 0.035, y, z]], 0.075, { sides: 12, look: disc }));
      out.push(...tube([[face + s * 0.035, y, z], [face + s * 0.045, y, z]], 0.05, { sides: 10, look: M('wheel.cap', 'steel', C.steel) }));
      out.push(...bolts(Array.from({ length: bolted }, (_, k) => { const a = (2 * Math.PI * k) / bolted; return [face, y + 0.11 * Math.cos(a), z + 0.11 * Math.sin(a)]; }), [s, 0, 0], { r: 0.012, h: 0.012, look: M('wheel.bolt', 'steel', C.steel) }));
    }
  }
  return out;
}

// the sprocket: two toothed rings either side of the track's horns, on a hub
function sprocketFaces({ hub, r, width, paint, outer }) {
  const [x, y, z] = hub, out = [], teeth = 13, steel = M('sprocket.tooth', 'steel', C.steel), disc = M('sprocket', 'milPaint', paint);
  const root = r - 0.045;
  for (const s of [-1, 1]) {
    const x0 = x + s * 0.035, x1 = x + s * 0.035 + s * 0.04;
    out.push(...tube([[x0, y, z], [x1, y, z]], root, { sides: 26, look: disc }));
    for (let k = 0; k < teeth; k++) {
      const a = (2 * Math.PI * k) / teeth, c = Math.cos(a), sn = Math.sin(a);
      // (a tooth: a trapezoid standing out of the ring, its flanks worn bright)
      const prof = [[-0.032, root - 0.01], [0.032, root - 0.01], [0.016, r], [-0.016, r]].map(([u, v]) => [y + v * c - u * sn, z + v * sn + u * c]);
      out.push(...plate({ axis: 'x', profile: prof, from: x0, to: x1, look: steel }));
    }
  }
  // the hub between the rings and out past the outer one, its bolts
  out.push(...tube([[x - 0.04, y, z], [x + outer * 0.12, y, z]], 0.12, { sides: 16, look: disc }));
  out.push(...bolts(Array.from({ length: 10 }, (_, k) => { const a = (2 * Math.PI * k) / 10; return [x + outer * 0.12, y + 0.085 * Math.cos(a), z + 0.085 * Math.sin(a)]; }), [outer, 0, 0], { r: 0.011, h: 0.012, look: M('sprocket.bolt', 'steel', C.steel) }));
  void width;
  return out;
}

/** One side's running gear (see the head of this file). */
export function runningGear({ side = 1, x, width, hullX, sprocket, idler, wheels, rollers = [], pitch = 0.15, sag = 0.03, paint = '#4b5320' }) {
  const s = side < 0 ? -1 : 1, X = s * x, W = width, gap = 0.075;
  const road = wheels.map((w) => ({ y: w.y, r: w.r, z: w.r + TRACK_DEPTH }));
  const path = trackPath({ sprocket, idler, wheels: road, rollers, sag }), pins = pinsAlong(path, pitch);
  const faces = [], spinners = [];
  // ── the track: each link a chord between two pins, its frame's z out of the loop (anticlockwise: out is (dz, −dy))
  const link = linkFaces(W, pitch);
  pins.forEach((p, k) => {
    const q = pins[(k + 1) % pins.length], d = Math.hypot(q[0] - p[0], q[1] - p[1]), t = [(q[0] - p[0]) / d, (q[1] - p[1]) / d];
    const ey = [0, -t[0], -t[1]], ez = [0, t[1], -t[0]];
    // (a link built `pitch` long laid on its chord: the chords are all one length, the pitch the path's own)
    const sc = d / pitch, local = sc === 1 ? link : link.map((f) => ({ ...f, corners: f.corners.map((c) => [c[0], c[1] * sc, c[2]]) }));
    faces.push(...place(local, { origin: [X, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2], ex: [1, 0, 0], ey, ez }));
  });
  // ── the road wheels on their arms, from the torsion bars' housings on the hull, a bump stop over each
  const arm = M('suspension.arm', 'milPaint', paint), xin = s * (x - W / 2 - 0.03);
  road.forEach((w, k) => {
    const hub = [X, w.y, w.z];
    spinners.push({ id: `road${k + 1}`, kind: 'road', hub, r: w.r, faces: dualWheel({ hub, r: w.r, width: W - 0.04, gap, tyre: true, paint, outer: s }) });
    const piv = [s * hullX, w.y + 0.36, w.z + 0.1];
    faces.push(...tube([[s * (hullX - 0.02), piv[1], piv[2]], [s * (hullX + 0.07), piv[1], piv[2]]], 0.055, { sides: 12, look: arm }));
    faces.push(...tube([[s * (hullX + 0.05), piv[1], piv[2]], [xin, w.y, w.z]], 0.034, { sides: 8, look: arm }));
    faces.push(...tube([[xin, w.y, w.z], [s * (x - gap / 2), w.y, w.z]], 0.05, { sides: 10, look: M('suspension.axle', 'steel', C.steel) }));
    faces.push(...plate({ axis: 'x', profile: [[w.y + 0.12, w.z + 0.2], [w.y + 0.26, w.z + 0.2], [w.y + 0.24, w.z + 0.29], [w.y + 0.14, w.z + 0.29]], from: s * (hullX - 0.01), to: s * (hullX + 0.08), r: 0.01, seg: 1, look: M('suspension.stop', 'milPaint', paint) }));
  });
  // ── the sprocket on its final drive, the idler on its tensioner, the rollers on their brackets
  const sh = [X, sprocket.y, sprocket.z];
  spinners.push({ id: 'sprocket', kind: 'sprocket', hub: sh, r: sprocket.r, faces: sprocketFaces({ hub: sh, r: sprocket.r, width: W, paint, outer: s }) });
  faces.push(...tube([[s * (hullX - 0.02), sh[1], sh[2]], [s * (x - 0.04), sh[1], sh[2]]], 0.16, { sides: 16, look: M('final.drive', 'milPaint', paint) }));
  const ih = [X, idler.y, idler.z];
  spinners.push({ id: 'idler', kind: 'idler', hub: ih, r: idler.r, faces: dualWheel({ hub: ih, r: idler.r, width: W - 0.04, gap, tyre: false, paint, outer: s, bolted: 6 }) });
  faces.push(...tube([[s * hullX, idler.y - 0.32, idler.z - 0.05], [xin, idler.y, idler.z]], 0.045, { sides: 8, look: arm }));
  faces.push(...tube([[s * (hullX - 0.02), idler.y - 0.32, idler.z - 0.05], [s * (hullX + 0.08), idler.y - 0.32, idler.z - 0.05]], 0.06, { sides: 12, look: arm }));
  rollers.forEach((c, k) => {
    const hub = [X, c.y, c.z];
    spinners.push({ id: `roller${k + 1}`, kind: 'roller', hub, r: c.r, faces: dualWheel({ hub, r: c.r, width: W * 0.7, gap, tyre: true, paint, outer: s, bolted: 0 }) });
    faces.push(...tube([[s * (hullX - 0.02), c.y, c.z], [s * (x - gap / 2), c.y, c.z]], 0.03, { sides: 8, look: M('roller.bracket', 'milPaint', paint) }));
  });
  return { faces, spinners, path, pins };
}
