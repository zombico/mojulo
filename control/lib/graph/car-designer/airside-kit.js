/**
 * THE AIRSIDE KIT: what the airfield's ground crew share (road-airside.js, road-airside-haul.js), in the hull kit's
 * language (mil-hull.js): their colours and looks (the livery's paint token, so a livery cuts them as it cuts the field's),
 * a beam, a mudguard, hazard stripes, a beacon, a lamp, and the cab-over cab most of them drive from.
 *
 *   AIRSIDE_REACH, AIRSIDE_LIVERY            how high each reaches, the plain livery (road-airside.js says how)
 *   airsideWords(words), reachOf(kind, …)     a brief's `raised`; the height a kind reaches, clamped to its range
 *   C, M, paint, dark, alu                     the colours and the looks
 *   rect, xs, X, Y, Z, neg                     the profile and the axes
 *   beam(a, b, x0, x1, t, look)                → a straight beam in a plane of constant x ([y, z] ends)
 *   guard(yc, zc, R, a0, a1, x0, x1, look)     → a mudguard bent round a wheel
 *   hazard({ o, u, v, w, h, n, pitch? })       → yellow and black bands at 45° on a face
 *   beacon(at)                                 → an amber beacon on a roof
 *   lamp(c, n, w, h, lens, part)               → a lamp's bezel and lens on a face looking along n
 *   cabOver(out, { yb, yf, yN, hw, z0, z1 })   → a cab-over cab pushed into out; its anchors
 *
 * Vehicle space (+y forward, x across, z up), metres. Pure and deterministic.
 */
import { plate, tube, bend, face } from './mil-hull.js';

// (the stowed height of each, what `raised` gives (a single-aisle airliner's door sill, or its hold's for the belt), and
// the range its lift travels)
export const AIRSIDE_REACH = Object.freeze({
  catering: Object.freeze({ stowed: 1.55, raised: 3.4, range: Object.freeze([1.55, 5.6]) }),
  beltLoader: Object.freeze({ stowed: 1.45, raised: 2.1, range: Object.freeze([1.0, 3.8]) }),
  stairs: Object.freeze({ stowed: 2.65, raised: 3.4, range: Object.freeze([2.65, 5.4]) }),
  // (a pushback tug's cradle: down to take a nose wheel, lifted to carry it)
  pushbackTug: Object.freeze({ stowed: 0.32, raised: 0.62, range: Object.freeze([0.32, 0.7]) }),
});

/** The airside's plain livery: white, its fleet number stencilled, no emblem. */
export const AIRSIDE_LIVERY = Object.freeze({ pattern: 'mono', colours: Object.freeze(['#e7e6e0']), marks: Object.freeze({ emblem: false }) });

/** An airside vehicle's words from its brief: `raised` (raised, lifted, up, docked, serving) sets it to a door. */
export function airsideWords(words = []) {
  const W = words.map((w) => String(w).toLowerCase());
  return { raised: W.some((w) => ['raised', 'lifted', 'up', 'docked', 'serving', 'extended', 'deployed'].includes(w)) };
}

/** How high a kind reaches: `pose.reach` clamped to its range, else raised or stowed by its words. */
export function reachOf(kind, { words = [], pose = {} } = {}) {
  const R = AIRSIDE_REACH[kind];
  if (!R) throw new Error(`car-designer: '${kind}' is not an airside body (${Object.keys(AIRSIDE_REACH).join(', ')})`);
  const want = Number.isFinite(pose?.reach) ? pose.reach : airsideWords(words).raised ? R.raised : R.stowed;
  return Math.min(R.range[1], Math.max(R.range[0], want));
}


// the colours, unlit: the livery's paint token (the field's olive, which the livery replaces) and its frame's; what is
// its own
export const C = Object.freeze({
  base: '#4b5320', frame: '#363b1a', black: '#1b1c19', rubber: '#1a1b1d', glass: '#24302f', lamp: '#e9edf0', tail: '#9a1a17',
  amber: '#d48a1c', steel: '#4a4c47', alu: '#a9aeb2', belt: '#1e1f20', seat: '#2a2b2d', hazard: '#e0ad17', hazardDark: '#161719',
});
export const M = (part, material, albedo) => ({ part, material, albedo });
export const paint = (part) => M(part, 'milPaint', C.base);
export const dark = (part) => M(part, 'milPaint', C.frame);
export const alu = (part) => M(part, 'steel', C.alu);
export const rect = (u0, u1, v0, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
export const xs = (s, a, b) => (s > 0 ? [a, b] : [-b, -a]);
export const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1], neg = (q) => q.map((c) => -c);

// a straight beam in a plane of constant x: from a to b ([y, z]), `t` deep across its line, from x0 to x1
export function beam(a, b, x0, x1, t, look) {
  const d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(d[0], d[1]) || 1, n = [(-d[1] / l) * (t / 2), (d[0] / l) * (t / 2)];
  return plate({ axis: 'x', profile: [[a[0] + n[0], a[1] + n[1]], [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]], [a[0] - n[0], a[1] - n[1]]], from: x0, to: x1, r: Math.min(0.01, t / 4), seg: 1, look });
}

// a mudguard: a bent plate round a wheel (its hub at [y, z]), radius R, from angle a0 to a1 (radians, 0 ahead), x0 to x1
export function guard(yc, zc, R, a0, a1, x0, x1, look, n = 8) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const t0 = a0 + ((a1 - a0) * k) / n, t1 = a0 + ((a1 - a0) * (k + 1)) / n;
    const p = (t, rr) => [yc + rr * Math.cos(t), zc + rr * Math.sin(t)];
    out.push(...plate({ axis: 'x', profile: [p(t0, R), p(t1, R), p(t1, R + 0.025), p(t0, R + 0.025)], from: x0, to: x1, look }));
  }
  return out;
}

// the band of a rectangle (s across [0, w], t up [0, h]) where k·p ≤ s + t ≤ (k+1)·p: the rectangle clipped by two lines
function band(w, h, lo, hi) {
  let P = rect(0, w, 0, h);
  for (const [sg, c] of [[1, lo], [-1, -hi]]) {
    const inside = (q) => sg * (q[0] + q[1]) >= c - 1e-9, out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) { const fa = sg * (a[0] + a[1]) - c, fb = sg * (b[0] + b[1]) - c, t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    P = out;
    if (P.length < 3) return null;
  }
  return P;
}
/** Hazard stripes on a face: from `o`, `w` along `u` and `h` along `v` (units), standing out along `n`: yellow and
 *  black bands at 45°, `pitch` apart. */
export function hazard({ o, u, v, w, h, n, pitch = 0.12 }) {
  const out = [], at = ([s, t]) => [0, 1, 2].map((k) => o[k] + u[k] * s + v[k] * t + n[k] * 0.003);
  for (let k = 0; k * pitch < w + h; k++) {
    const B = band(w, h, k * pitch, (k + 1) * pitch);
    if (B) out.push(face(B.map(at), k % 2 ? M('hazard', 'plate', C.hazardDark) : M('hazard', 'plate', C.hazard), n));
  }
  return out.filter(Boolean);
}

// an amber beacon on a roof: its base and its dome
export function beacon(at) {
  return [
    ...tube([at, [at[0], at[1], at[2] + 0.05]], 0.075, { sides: 12, look: M('beacon.base', 'carbon', C.black) }),
    ...tube([[at[0], at[1], at[2] + 0.05], [at[0], at[1], at[2] + 0.16]], 0.065, { sides: 12, look: (role) => (role === 'cap' ? M('beacon', 'marker', C.amber) : M('beacon', 'marker', C.amber)) }),
  ];
}

// a lamp: a rectangle on a face looking along `n` (its bezel and its lens)
export function lamp(c, n, w, h, lens, part) {
  const ax = Math.abs(n[0]) > 0.5 ? 'x' : Math.abs(n[1]) > 0.5 ? 'y' : 'z', s = Math.sign(n[0] + n[1] + n[2]);
  const k = ax === 'x' ? 0 : ax === 'y' ? 1 : 2, from = c[k], to = c[k] + s * 0.02;
  const prof = ax === 'x' ? rect(c[1] - w / 2, c[1] + w / 2, c[2] - h / 2, c[2] + h / 2) : ax === 'y' ? rect(c[0] - w / 2, c[0] + w / 2, c[2] - h / 2, c[2] + h / 2) : rect(c[0] - w / 2, c[0] + w / 2, c[1] - h / 2, c[1] + h / 2);
  return plate({ axis: ax, profile: prof, from, to, r: 0.004, seg: 1, look: (role) => (role === 'cap' ? M(part, lens, lens === 'lamp' ? C.lamp : lens === 'tail' ? C.tail : C.amber) : M(`${part}.bezel`, 'carbon', C.black)) });
}

/** A cab-over cab: its shell raked at the top of its face, its screen, its door glass, shut lines and handles, the
 *  valance and its lamps, the bumper and its stripes, the wipers, the beacon; its anchors. yb its back, yf its face, hw
 *  its half width, z0 its floor (over the front wheel), z1 its roof; yN the bumper's face. */
export function cabOver(out, { yb, yf, yN, hw, z0, z1 }) {
  const P = (o) => out.push(...plate(o));
  const zw = z0 + 0.42;
  P({ axis: 'x', profile: [[yb, z0], [yf, z0], [yf, z1 - 0.2], [yf - 0.15, z1], [yb, z1]], from: -hw, to: hw, r: 0.05, seg: 2, look: paint('cab') });
  // (the screen, two panes on the face, its centre post; the wipers parked at its foot)
  for (const s of [-1, 1]) {
    const [a, b] = xs(s, 0.035, hw - 0.1);
    out.push(face([[a, yf + 0.004, zw], [b, yf + 0.004, zw], [b, yf + 0.004, z1 - 0.26], [a, yf + 0.004, z1 - 0.26]], M('glass', 'glass', C.glass), Y));
    out.push(...tube([[s * 0.15, yf + 0.03, zw + 0.03], [s * 0.15 + s * 0.6, yf + 0.03, zw + 0.06]], 0.008, { sides: 6, look: M('wiper', 'carbon', C.black) }));
  }
  // (the doors: their glass, their shut lines, a handle under the glass, a hinge pair forward)
  const yd0 = yf - 0.1, yd1 = Math.max(yb + 0.15, yf - 1.0), seam = M('seam', 'seal', '#151614');
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.003), n = [s, 0, 0];
    out.push(face([[x, yd1 + 0.08, zw], [x, yd0 - 0.08, zw], [x, yd0 - 0.08, z1 - 0.18], [x, yd1 + 0.08, z1 - 0.18]], M('glass', 'glass', C.glass), n));
    const strip = (ya, yb2, za, zb) => out.push(face([[x, ya, za], [x, yb2, za], [x, yb2, zb], [x, ya, zb]], seam, n));
    strip(yd1, yd0, z0 + 0.05, z0 + 0.062); strip(yd1, yd1 + 0.012, z0 + 0.05, z1 - 0.1); strip(yd0 - 0.012, yd0, z0 + 0.05, z1 - 0.1); strip(yd1, yd0, z1 - 0.112, z1 - 0.1);
    out.push(...tube(bend([[x, yd1 + 0.1, zw - 0.12], [x + s * 0.03, yd1 + 0.1, zw - 0.12], [x + s * 0.03, yd1 + 0.26, zw - 0.12], [x, yd1 + 0.26, zw - 0.12]], 0.012, 2), 0.01, { sides: 6, look: paint('door.handle') }));
    // (a rear quarter's glass behind the door)
    if (yd1 - yb > 0.35) out.push(face([[x, yb + 0.12, zw], [x, yd1 - 0.06, zw], [x, yd1 - 0.06, z1 - 0.18], [x, yb + 0.12, z1 - 0.18]], M('glass', 'glass', C.glass), n));
  }
  // (the valance under the cab's face: its grille slots and its lamps; the bumper ahead of it, striped)
  P({ axis: 'y', profile: rect(-hw + 0.03, hw - 0.03, 0.5, z0 + 0.03), from: yf - 0.22, to: yf, r: 0.02, seg: 1, look: paint('valance') });
  for (let i = 0; i < 7; i++) { const z = z0 - 0.08 - i * 0.045; if (z < 0.72) break; P({ axis: 'y', profile: rect(-0.42, 0.42, z - 0.012, z + 0.012), from: yf - 0.004, to: yf + 0.004, look: M('grille', 'carbon', C.black) }); }
  for (const s of [-1, 1]) {
    out.push(...lamp([s * (hw - 0.26), yf, 0.66], Y, 0.26, 0.13, 'lamp', 'headlamp'));
    out.push(...lamp([s * (hw - 0.07), yf, 0.66], Y, 0.07, 0.11, 'marker', 'indicator'));
  }
  P({ axis: 'x', profile: rect(yf - 0.06, yN, 0.32, 0.5), from: -hw + 0.02, to: hw - 0.02, r: 0.015, seg: 1, look: paint('bumper') });
  out.push(...hazard({ o: [-hw + 0.04, yN, 0.33], u: X, v: Z, w: 2 * hw - 0.08, h: 0.16, n: Y }));
  out.push(...beacon([0, yb + 0.35, z1]));
  // the anchors: its mirrors' posts, its steps under the doors (ahead of the wheel), a grab bar behind each door, its number
  return [-1, 1].flatMap((s) => {
    const L = s < 0 ? 'L' : 'R', sd = s < 0 ? neg(X) : X;
    return [
      { id: `post.${L}`, kind: 'post', at: [s * hw, yf - 0.06, z1 - 0.42], out: sd, up: Z },
      { id: `sill.${L}`, kind: 'sill', at: [s * (hw - 0.12), yf - 0.42, 0.46], out: sd, up: Z },
      { id: `grab.${L}`, kind: 'flank', at: [s * hw, yd1 - 0.06, zw - 0.05], out: sd, up: Z },
      { id: `mark.cab.${L}`, kind: 'mark', role: 'number', at: [s * (hw + 0.004), (yd0 + yd1) / 2, z0 + 0.22], out: sd, up: Z, h: 0.13 },
    ];
  });
}
