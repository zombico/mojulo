/**
 * figure-animal-faceplate — a PLATED SNOUT: a projecting, tapered muzzle built from four
 * plates, off a SMALL cranium. The plate doesn't sit flat on the head as a decal — it IS
 * the snout: it projects forward from the cranium front and tapers to the nose, the way a
 * real muzzle does, so the head reads as one clean form in profile (a sloped brow flowing
 * into a pointed muzzle + a defined jaw — the operator's reference sketch).
 *
 * The four pieces (each a separate render part, own colour):
 *   - topL / topR — the two TOP planes of the snout, left & right of the dorsal RIDGE (the
 *     nasal bridge). They run from the brow (root, high + wide) forward to the nose (low +
 *     narrow), tenting down-and-out to the cheeks. The ridge SLOPES down brow→nose.
 *   - nose        — the front cap at the muzzle tip (the rhinarium).
 *   - jaw         — the bottom plane (the lower muzzle / chin), root→nose.
 *
 * The muzzle is a TAPERED swept box: at each station root→nose the cross-section shrinks
 * (width, ridge height, jaw depth all lerp down) and the axis DROPS (`drop`), so the snout
 * narrows and dips to the nose. Each plate is one face of that box, built as a thin
 * extruded slab (a cross-section edge swept root→nose, given thickness) so it meshes + lights
 * like every other part. Compose with a SMALL cranium (short skull, modest dome) — the plate
 * carries the whole muzzle.
 *
 * Seated from a head frame: `base` = the muzzle ROOT (front of the cranium), `dir` = the
 * muzzle heading (forward), `up`/`side` = the head's vertical / lateral. Returns STAND-space
 * parts `{polylines, stroke}`.
 */
import { normalize3, sub3, cross3 } from './figure-vajra.js';

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => add(mul(a, 1 - t), mul(b, t));
const vlen = (a) => Math.hypot(a.x, a.y, a.z);

export const PLATE_MUZZLE_DEFAULT = {
  len: 0.13,        // muzzle forward length off the cranium (the projection)
  drop: 0.05,       // how far the nose end drops below the root axis (the muzzle dips down)
  rootW: 0.06,      // half-width at the ROOT (base of the snout, at the cheeks)
  noseW: 0.03,      // half-width at the NOSE (tapers in)
  rootTop: 0.045,   // ridge height above the axis at the root (the BROW — high)
  noseTop: 0.012,   // ridge height at the nose (low → the ridge SLOPES down brow→nose)
  rootBot: 0.03,    // jaw depth below the axis at the root
  noseBot: 0.016,   // jaw depth at the nose
  cheekDrop: 0.55,  // where the cheek (top-plate outer edge) sits between ridge and jaw (0 ridge…1 jaw)
  thick: 0.012,     // plate thickness (slab extrusion)
  seg: 5,           // stations swept root→nose (≥2; more = smoother taper)
  topHex: '#c8a06a', noseHex: '#241811', jawHex: '#b8945f',
};

// One plate = a cross-section EDGE (inner→outer) swept root→nose, given `thick` depth along
// −(face normal), so it's a thin solid strip the mesher skins. `edge(t)` returns { inner, outer }
// at station t∈[0,1]. Returns a `{polylines, stroke}` ring-stack.
function sweepPlate(edge, thick, stroke, seg) {
  const e0 = edge(0), e1 = edge(Math.min(1, 1e-3));
  let nrm = cross3(sub3(e0.outer, e0.inner), sub3(e1.inner, e0.inner));
  if (vlen(nrm) < 1e-9) nrm = { x: 0, y: 0, z: 1 };
  nrm = mul(normalize3(nrm), -Math.abs(thick));
  const rings = [];
  for (let i = 0; i < seg; i++) {
    const t = seg === 1 ? 0 : i / (seg - 1);
    const { inner, outer } = edge(t);
    rings.push([inner, outer, add(outer, nrm), add(inner, nrm), inner]);
  }
  return { polylines: rings, stroke };
}

// A flat quad (A,B,C,D) as a thin slab — for the nose cap.
function quadSlab(A, B, C, D, thick, stroke) {
  let nrm = cross3(sub3(B, A), sub3(D, A));
  if (vlen(nrm) < 1e-9) return null;
  nrm = mul(normalize3(nrm), -Math.abs(thick));
  return { polylines: [[A, B, C, D, A], [add(A, nrm), add(B, nrm), add(C, nrm), add(D, nrm), add(A, nrm)]], stroke };
}

/**
 * Build a 4-piece projecting plated muzzle.
 * @param {{x,y,z}} base  the muzzle ROOT (front-centre of the cranium)
 * @param {{x,y,z}} dir   muzzle heading (forward)
 * @param {{x,y,z}} up    head vertical
 * @param {{x,y,z}} side  head lateral (points to the animal's RIGHT)
 * @param {object} [cfg]  PLATE_MUZZLE_DEFAULT
 * @returns {{polylines:{x,y,z}[][], stroke:string}[]}  four parts: [topL, topR, nose, jaw]
 */
export function plateMuzzle(base, dir, up, side, cfg = {}) {
  const c = { ...PLATE_MUZZLE_DEFAULT, ...cfg };
  const D = normalize3(dir), U = normalize3(up), S = normalize3(side);

  // cross-section landmarks at station t (0 root → 1 nose): the axis walks forward + DROPS,
  // and width / ridge-height / jaw-depth all taper down.
  const axis = (t) => add(add(base, mul(D, c.len * t)), mul(U, -c.drop * t));
  const w = (t) => lerp(c.rootW, c.noseW, t);
  const top = (t) => lerp(c.rootTop, c.noseTop, t);
  const bot = (t) => lerp(c.rootBot, c.noseBot, t);
  const ridge = (t) => add(axis(t), mul(U, top(t)));                         // dorsal ridge (top centreline)
  const cheek = (t, sgn) => add(add(axis(t), mul(S, sgn * w(t))), mul(U, -(top(t) + bot(t)) * (c.cheekDrop - 0.5)));   // side, between ridge and jaw
  const jaw = (t) => add(axis(t), mul(U, -bot(t)));                          // lower keel (bottom centreline)

  // TOP plates: ridge (inner) → cheek (outer), swept root→nose. Right = +S, left = −S.
  const topR = sweepPlate((t) => ({ inner: ridge(t), outer: cheek(t, 1) }), c.thick, c.topHex, c.seg);
  const topL = sweepPlate((t) => ({ inner: ridge(t), outer: cheek(t, -1) }), c.thick, c.topHex, c.seg);
  // JAW plate — the bottom, a shallow V (left cheek → keel → right cheek) swept root→nose, given
  // thickness downward. Built directly: each ring is the V cross-section + its −U offset copy.
  const jawKeel = (() => {
    const rings = [];
    for (let i = 0; i < c.seg; i++) {
      const t = i / (c.seg - 1), o = mul(U, -c.thick);
      const L = cheek(t, -1), R = cheek(t, 1), J = jaw(t);
      rings.push([L, J, R, add(R, o), add(J, o), add(L, o), L]);
    }
    return { polylines: rings, stroke: c.jawHex };
  })();
  // NOSE cap — the front face at the tip (t=1): ridge → right cheek → jaw → left cheek, facing forward.
  const nose = quadSlab(ridge(1), cheek(1, 1), jaw(1), cheek(1, -1), c.thick, c.noseHex);

  return [topL, topR, nose, jawKeel].filter(Boolean);
}
