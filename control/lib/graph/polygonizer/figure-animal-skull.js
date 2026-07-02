/**
 * figure-animal-skull — ONE parametric proto-skull, presets per family.
 *
 * The head is the family tell (rodent vs horse vs hawk), so it gets the same shared
 * treatment as the flesh: one primitive, a small knob set, a preset per family — not
 * eleven bespoke heads. `protoSkull(anchor, dir, cfg)` builds a skull along a head
 * axis (`dir` = the muzzle direction, off the neck/chain tip): a domed CRANIUM at the
 * back tapering through a brow/stop into a MUZZLE that drops to the nose, a lower JAW
 * slung beneath, and an optional BEAK cone (avian). Returns render parts
 * `{polylines, stroke}` in STAND space — the same shape the flesh emits.
 *
 * Knobs (SKULL_DEFAULT): length (back→snout), width (cranium breadth), dome (cranium
 * height), muzzle (snout fraction of length), snout (nose radius ÷ width), muzzleDrop
 * (how the snout dips below the cranium line), jaw (lower-jaw depth, 0 = none), beak
 * (beak length × length, 0 = none). The presets read straight off the silhouettes:
 * long-faced equine, short-faced feline, beaked avian, deep-jawed theropod, etc.
 */
import { normalize3, sub3, cross3 } from './figure-vajra.js';

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const vlen = (a) => Math.hypot(a.x, a.y, a.z);

export const SKULL_DEFAULT = {
  length: 0.17,     // STAND, back-of-cranium → snout tip
  width: 0.05,      // cranium radius (braincase breadth)
  dome: 1.0,        // cranium height (>1 tall/rounded forehead)
  muzzle: 0.55,     // fraction of length that is muzzle (vs cranium)
  snout: 0.35,      // nose-tip radius as a fraction of width (thin↔blunt)
  muzzleDrop: 0.18, // how far the snout dips below the cranium line (× length)
  jaw: 0.6,         // lower-jaw depth (0 = none)
  beak: 0,          // beak length (× length) past the snout (0 = none)
  boxy: 0,          // muzzle boxiness: 0 = conical/round, →1 = a broad squared-off block
  N: 14, M: 20, stroke: '#c8836a',
};

function frameFrom(dir) {
  let up = { x: 0, y: 0, z: 1 }, side = cross3(up, dir);
  if (vlen(side) < 1e-6) { up = { x: 1, y: 0, z: 0 }; side = cross3(up, dir); }
  side = normalize3(side);
  return { side, up: normalize3(cross3(dir, side)) };
}

// Interpolate a station list (sorted by s∈[0,1]) at q.
function interp(st, q) {
  for (let i = 1; i < st.length; i++) {
    if (q <= st[i].s || i === st.length - 1) {
      const a = st[i - 1], b = st[i], t = Math.max(0, Math.min(1, (q - a.s) / ((b.s - a.s) || 1)));
      return { rh: a.rh + (b.rh - a.rh) * t, rv: a.rv + (b.rv - a.rv) * t, dz: a.dz + (b.dz - a.dz) * t };
    }
  }
  return st[st.length - 1];
}

// Sweep an elliptical cross-section (side radius rh, up radius rv — fractions of
// `width`) along `dir` for `L`, dipping by dz (× dropL) below the axis.
function sweep(stations, anchor, dir, side, up, L, width, dropL, c) {
  const rings = [], bx = c.boxy || 0;
  for (let i = 0; i < c.N; i++) {
    const s = i / (c.N - 1), st = interp(stations, s);
    const center = add(anchor, add(mul(dir, s * L), mul(up, -st.dz * dropL)));
    const rh = width * st.rh, rv = width * st.rv, poly = [];
    // square the cross-section toward the FRONT (a boxy muzzle); the cranium back stays
    // round. A superellipse: exponent 1 = circle, <1 fills the corners toward a block.
    const sq = bx * Math.min(1, Math.max(0, (s - 0.35) / 0.65)), pexp = 1 - 0.6 * sq;
    for (let j = 0; j <= c.M; j++) {
      const ang = (j / c.M) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      const ux = sq > 0 ? Math.sign(ca) * Math.abs(ca) ** pexp : ca;
      const uy = sq > 0 ? Math.sign(sa) * Math.abs(sa) ** pexp : sa;
      poly.push(add(center, add(mul(side, rh * ux), mul(up, rv * uy))));
    }
    rings.push(poly);
  }
  return { polylines: rings, stroke: c.stroke };
}

/**
 * Build a proto-skull at `anchor` (back of the skull) pointing along `dir` (muzzle
 * direction). Returns STAND-space render parts.
 */
export function protoSkull(anchor, dirIn, cfg = {}) {
  const c = { ...SKULL_DEFAULT, ...cfg };
  const dir = normalize3(dirIn), { side, up } = frameFrom(dir);
  const cranEnd = 1 - c.muzzle, bx = c.boxy || 0;
  // boxy muzzle keeps its breadth/depth to a BLUNT end; conical tapers to the nose.
  const frontRh = (1 - bx) * Math.max(c.snout, 0.5) + bx * 0.82;
  const tipRh = (1 - bx) * c.snout + bx * Math.max(c.snout, 0.66);
  const tipRv = (1 - bx) * (c.snout * 0.85) + bx * 0.5;
  // cranium (back, domed up) → brow/stop → muzzle → nose tip (dropped)
  const main = [
    { s: 0.0, rh: 0.55, rv: 0.55, dz: -0.02 },
    { s: cranEnd * 0.5, rh: 1.0, rv: 1.0 * c.dome, dz: -0.05 },
    { s: cranEnd, rh: 0.72, rv: 0.74 * c.dome, dz: 0.02 },
    { s: 1 - c.muzzle * 0.4, rh: frontRh, rv: 0.52, dz: c.muzzleDrop * 0.55 },
    { s: 1.0, rh: tipRh, rv: tipRv, dz: c.muzzleDrop },
  ];
  const parts = [sweep(main, anchor, dir, side, up, c.length, c.width, c.length, c)];
  // lower jaw — a shorter, slimmer tube slung below the muzzle line
  if (c.jaw > 0) {
    const jaw = [
      { s: 0.0, rh: 0.42, rv: 0.30, dz: 0.0 },
      { s: 0.5, rh: 0.50, rv: 0.34, dz: 0.0 },
      { s: 0.94, rh: Math.max(c.snout * 0.8, 0.2), rv: 0.24, dz: 0.0 },
    ];
    const drop = c.width * (0.45 + 0.55 * c.jaw) + c.muzzleDrop * c.length * 0.5;
    const jawAnchor = add(anchor, add(mul(dir, c.length * 0.16), mul(up, -drop)));
    parts.push(sweep(jaw, jawAnchor, dir, side, up, c.length * 0.8, c.width * Math.max(c.jaw, 0.4), c.length, c));
  }
  // beak (avian) — a cone from the snout tip narrowing to a point, with a slight hook
  if (c.beak > 0) {
    const tip = add(anchor, mul(dir, c.length));
    const beak = [
      { s: 0.0, rh: c.snout, rv: c.snout * 0.95, dz: 0.0 },
      { s: 0.55, rh: c.snout * 0.6, rv: c.snout * 0.66, dz: 0.10 },
      { s: 1.0, rh: 0.07, rv: 0.07, dz: 0.22 },
    ];
    parts.push(sweep(beak, tip, dir, side, up, c.length * c.beak, c.width, c.length, c));
  }
  return parts;
}

// ─── Per-family proto-skulls (read off the silhouettes) ─────────────────
export const SKULL_PRESETS = {
  // big rounded cranium, short blunt snout, big cheeks — rodents carry a BIG head for the body
  rodent: { length: 0.155, width: 0.062, dome: 1.15, muzzle: 0.45, snout: 0.42, muzzleDrop: 0.14, jaw: 0.45, boxy: 0.5 },
  // defined elongated muzzle, moderate cranium
  canine: { length: 0.18, width: 0.044, dome: 0.95, muzzle: 0.6, snout: 0.28, muzzleDrop: 0.2, jaw: 0.7, boxy: 0.7 },
  // short rounded muzzle, broad domed cranium (flat face) — bumped up; read small on the body
  feline: { length: 0.145, width: 0.056, dome: 1.08, muzzle: 0.36, snout: 0.42, muzzleDrop: 0.12, jaw: 0.55, boxy: 0.6 },
  // big blocky heavy head, broad blunt muzzle
  stumpy: { length: 0.21, width: 0.085, dome: 0.92, muzzle: 0.5, snout: 0.6, muzzleDrop: 0.1, jaw: 0.7, boxy: 0.8 },
  // long deep head, long muzzle (horse) — widened so the long head reads beefier, not a stick
  equine: { length: 0.25, width: 0.054, dome: 0.85, muzzle: 0.68, snout: 0.34, muzzleDrop: 0.16, jaw: 0.72, boxy: 0.45 },
  // small delicate tapered head
  gazelle: { length: 0.15, width: 0.034, dome: 0.98, muzzle: 0.64, snout: 0.24, muzzleDrop: 0.18, jaw: 0.5, boxy: 0.35 },
  // tiny short boxy head (small relative to body)
  sauropod: { length: 0.12, width: 0.04, dome: 0.82, muzzle: 0.5, snout: 0.5, muzzleDrop: 0.08, jaw: 0.5 },
  // huge deep tall skull, powerful jaw (T. rex) — enlarged; the massive head is the tell
  theropod: { length: 0.31, width: 0.086, dome: 0.98, muzzle: 0.6, snout: 0.42, muzzleDrop: 0.12, jaw: 1.1 },
  // smaller, low, elongated pointed predator skull
  raptor: { length: 0.18, width: 0.04, dome: 0.85, muzzle: 0.66, snout: 0.26, muzzleDrop: 0.12, jaw: 0.7 },
  // small cranium + a long BEAK, no jaw teeth
  avian: { length: 0.09, width: 0.04, dome: 1.12, muzzle: 0.32, snout: 0.34, muzzleDrop: 0.0, jaw: 0, beak: 1.0 },
  // broad heavy domed skull, medium muzzle (bear) — the boxiest snout; bigger + broader head
  ursine: { length: 0.195, width: 0.079, dome: 1.06, muzzle: 0.5, snout: 0.44, muzzleDrop: 0.14, jaw: 0.75, boxy: 0.85 },
  // small carnivoran skull, a LONGER POINTY muzzle tapering to a fine nose (raccoon) —
  // conical, not boxed: low boxy + a long muzzle fraction + a thin snout tip.
  raccoon: { length: 0.14, width: 0.048, dome: 1.05, muzzle: 0.64, snout: 0.22, muzzleDrop: 0.16, jaw: 0.55, boxy: 0.15 },
};
