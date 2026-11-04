/**
 * mecha-egg — the brood walker's egg foot by its numbers: the shell over its bay, closed, and its blunt end cut into four
 * petals, the hinges they swing on, how far they open to reach the ground with the egg hung from its hub, and the foot
 * that makes.
 * The parts (mecha-brood-parts.js), the inventory (mecha-odm.js) and the frame (mecha-archetypes.js) read it, so the
 * shell drawn, the joints and the soles the laws read agree. Pure: no clock, no dice.
 *
 * Authored in the bay's own build frame: the core's roof centre the origin, +y its nose (the egg's narrow end), +z its
 * roof, +x outboard; the bay's body frame is that moved to its hub (`hubAt`), on the egg's axis near its narrow end.
 *
 *   EGG_BW                        the egg's numbers (its section, its axis, its stations, its hub and ring, its petals)
 *   eggPoint(E, s, deg)           → [x, z] a point of its section at scale `s`, `deg` round from +x toward its roof
 *   petalSpan(E, q, y)            → [deg0, deg1] the arc a quarter of the shell covers at `y` (its body's lower quarters
 *                                 notched over the wheels)
 *   bodyStations(E)               → [y, …] the closed body's stations, its ring to its cut (and each wheel arch's edges)
 *   petalStations(E)              → [y, …] a petal's stations, the cut to the blunt end's tip
 *   EGG_PETALS                    { uo, ui, li, lo: { mid, hinge, axis, open, low } }: each petal's mid angle, its hinge (on
 *                                 the cut), its hinge's axis (+ opens it), how far it opens (degrees: each its own, so all
 *                                 four reach one ground), its lowest point opened (in its own frame)
 *   EGG_FOOT                      { stand, lie, half, pad, contact }: the hub's height
 *                                 over the ground hung (`stand`) and lying on its wheels (`lie`), the square of its petals'
 *                                 pads round it (`half`), a pad's radius and the four pads' area
 */
const r3 = (v) => Math.round(v * 1000) / 1000;
const DEG = Math.PI / 180;

export const EGG_BW = Object.freeze({
  // (its section a superellipse, squarer than a circle so it holds the core's corners: `a` across, `up` over its roof,
  // `dn` under it, round its axis at `zc`; its shell `t` thick)
  n: 4, a: 1.02, up: 1.0, dn: 0.95, zc: -0.6, t: 0.06,
  // (its scale along its length: the blunt end behind (its core's open end in it), the narrow end ahead over its nose)
  stations: Object.freeze([
    [2.45, 0.04], [2.4, 0.16], [2.3, 0.3], [2.15, 0.46], [2.0, 0.6], [1.85, 0.72], [1.7, 0.83], [1.62, 0.88], [1.55, 0.92],
    [1.42, 0.97], [1.35, 1.0], [1.0, 1.02], [0.3, 1.04], [-0.6, 1.05], [-1.3, 1.04], [-1.6, 1.0], [-1.85, 0.92],
    [-2.05, 0.78], [-2.2, 0.6], [-2.3, 0.4], [-2.38, 0.18], [-2.42, 0.04],
  ].map((p) => Object.freeze(p))),
  // (its hub, the leg's pivot through its narrow end; the ring behind it where its fixed nose cap meets its closed body;
  // the cut round its blunt end, past its core's open end, where its petals hinge; the seam between quarters)
  hub: 1.62, ring: 1.42, cut: -1.74, seam: 2,
  // (its wheels' arches in its body's lower quarters: each wheel at `at`, the arch `half` either side of it, its arc)
  arches: Object.freeze({ at: Object.freeze([0.85, -0.85]), half: 0.55, edge: 0.08, lo: 297, li: 243 }),
  // (how far its petals open, hung: a lander's feet, out and down, their pads on the ground)
  open: 125, pad: 0.24, padT: 0.06,
  // (its petals built heavier than its shell: a foot's plates, `petalT` thick, a rib down each one's spine)
  petalT: 0.2, rib: Object.freeze([0.2, 0.1]),
  // (the bay's wheels' bottoms under its roof: its depth less its wheels' lift, and their radius (the bay's row's))
  wheelLow: -1.7,
});

const scaleAt = (E, y) => {
  const S = E.stations;
  if (y >= S[0][0]) return S[0][1];
  for (let i = 0; i + 1 < S.length; i++) {
    const [y0, s0] = S[i], [y1, s1] = S[i + 1];
    if (y <= y0 && y >= y1) return s0 + ((s1 - s0) * (y0 - y)) / (y0 - y1);
  }
  return S[S.length - 1][1];
};

/** A point of the egg's section at scale `s`, `deg` round from +x (outboard) toward +z (its roof): [x, z]. */
export function eggPoint(E, s, deg) {
  const c = Math.cos(deg * DEG), sn = Math.sin(deg * DEG), e = 2 / E.n;
  return [E.a * s * Math.sign(c) * Math.abs(c) ** e, E.zc + (sn >= 0 ? E.up : E.dn) * s * Math.sign(sn) * Math.abs(sn) ** e];
}

const QUADS = Object.freeze({ uo: [0, 90], ui: [90, 180], li: [180, 270], lo: [270, 360] });
const inArch = (E, y, w = 0) => E.arches.at.some((c) => Math.abs(y - c) <= E.arches.half - w);

/** The arc a quarter of the shell covers at `y`: its quarter less its seams; its lower quarters notched round the wheels. */
export function petalSpan(E, q, y) {
  const [d0, d1] = QUADS[q], g = E.seam;
  if (q === 'lo' && inArch(E, y, E.arches.edge)) return [d0 + g, E.arches.lo];
  if (q === 'li' && inArch(E, y, E.arches.edge)) return [E.arches.li, d1 - g];
  return [d0 + g, d1 - g];
}

/** The closed body's stations, its ring to its cut: the egg's own between, and each wheel arch's edges. */
export function bodyStations(E) {
  const ys = new Set(E.stations.map(([y]) => y).filter((y) => y < E.ring && y > E.cut));
  ys.add(E.ring); ys.add(E.cut);
  for (const c of E.arches.at) for (const d of [E.arches.half, E.arches.half - E.arches.edge]) for (const s of [1, -1]) { const y = r3(c + s * d); if (y < E.ring && y > E.cut) ys.add(y); }
  return [...ys].sort((p, q) => q - p);
}
/** A petal's stations: the cut to the blunt end's tip. */
export function petalStations(E) {
  return [E.cut, ...E.stations.map(([y]) => y).filter((y) => y < E.cut)];
}
export const eggScale = scaleAt;

/** Rotate `v` about the unit axis `k` by `deg` (Rodrigues). */
const rot = (v, k, deg) => {
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const x = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return [0, 1, 2].map((i) => v[i] * c + x[i] * s + k[i] * d * (1 - c));
};
export const rotAbout = rot;

/** A petal's hinge on the cut at its mid angle, and its axis (the cut's tangent there, + opening it). */
function hingeOf(E, q) {
  const [d0, d1] = QUADS[q], mid = (d0 + d1) / 2, sC = scaleAt(E, E.cut), [hx, hz] = eggPoint(E, sC, mid);
  const [ax, az] = eggPoint(E, sC, mid + 0.5), [bx, bz] = eggPoint(E, sC, mid - 0.5), L = Math.hypot(ax - bx, az - bz);
  return { mid, hinge: [hx, E.cut, hz], axis: [(ax - bx) / L, 0, (az - bz) / L].map((v) => Math.round(v * 1e6) / 1e6) };
}
/** A petal opened `deg`, hung (the egg's +y up): its outer shell's lowest point, in its own frame, and how far below
 *  its hinge it is. */
function lowestOf(E, q, deg) {
  const { hinge: h, axis } = hingeOf(E, q);
  let low = null, lowY = Infinity;
  for (const y of petalStations(E)) {
    const [p0, p1] = petalSpan(E, q, y), s = scaleAt(E, y);
    for (let k = 0; k <= 8; k++) {
      const [x, z] = eggPoint(E, s, p0 + ((p1 - p0) * k) / 8), v = rot([x - h[0], y - E.cut, z - h[2]], axis, deg);
      if (v[1] < lowY) { lowY = v[1]; low = [x - h[0], y - E.cut, z - h[2]]; }
    }
  }
  return { low, lowY };
}
// (every petal down to one ground: the lowest of them at the egg's `open`, each other opened the more to reach it)
const target = Math.min(...Object.keys(QUADS).map((q) => lowestOf(EGG_BW, q, EGG_BW.open).lowY));
function petalOf(E, q) {
  let lo = E.open - 25, hi = E.open + 25;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (lowestOf(E, q, m).lowY < target) lo = m; else hi = m; }
  const open = Math.round(((lo + hi) / 2) * 100) / 100, { mid, hinge, axis } = hingeOf(E, q), { low } = lowestOf(E, q, open);
  return Object.freeze({ mid, hinge: Object.freeze(hinge.map(r3)), axis: Object.freeze(axis), open, low: Object.freeze(low.map(r3)) });
}
export const EGG_PETALS = Object.freeze(Object.fromEntries(Object.keys(QUADS).map((q) => [q, petalOf(EGG_BW, q)])));

// (hung, its hub this far over the ground: its petals' lowest point, their pads under it; lying, its wheels' bottoms)
const opened = Object.values(EGG_PETALS).map((p) => { const v = rot(p.low, p.axis, p.open); return [p.hinge[0] + v[0], p.hinge[2] + v[2] - EGG_BW.zc]; });
export const EGG_FOOT = Object.freeze({
  stand: r3(EGG_BW.hub - EGG_BW.cut - target + EGG_BW.padT),
  lie: r3(EGG_BW.zc - EGG_BW.wheelLow),
  // (its pads square round its axis, each this far out along both ways: its soles' outline)
  half: r3(Math.min(...opened.flatMap(([x, z]) => [Math.abs(x), Math.abs(z)]))),
  pad: EGG_BW.pad,
  contact: r3(4 * Math.PI * EGG_BW.pad ** 2),
});
/** The egg's hub in its build frame: the bay's body frame's origin. */
export const hubAt = Object.freeze([0, EGG_BW.hub, EGG_BW.zc]);
