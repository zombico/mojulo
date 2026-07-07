/**
 * figure-animal-antler — the branched cranial appendage: ANTLERS and HORNS.
 *
 * The Phase-2 primitive the zoo roadmap anticipated ("hornChain, a branched tailChain
 * at the skull"). Where `chainAppendage` (figure-animal.js) is ONE tapering tube that
 * can bow once, an antler is a TREE: a main BEAM sweeping up-back-out off the crown,
 * with TINES branching off it. So this is built as a small set of tapered tubes — the
 * beam as connected segments, each tine as one segment — mirrored L/R. A single spike
 * (no tines) is a HORN; a curled ram/bovid horn is the same beam with a high `curl`.
 *
 * Frame: antlers are GRAVITY-oriented, not head-tilt-oriented — they rise along world
 * +z regardless of how the muzzle is pitched — so the frame is {worldUp, horizontal
 * head-forward, lateral}, NOT the skull's own dir frame. Seated on the crown from the
 * head anchor + skull length/width. Returns STAND-space parts `{polylines, stroke}`,
 * the same currency buildAnimal plants and the renderer meshes.
 */
import { normalize3, sub3, cross3 } from './figure-vajra.js';

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const vlen = (a) => Math.hypot(a.x, a.y, a.z);
const smooth = (t) => t * t * (3 - 2 * t);

export const ANTLER_DEFAULT = {
  beamLen: 0.3,       // total beam reach off the crown (STAND)
  segs: 6,            // beam control points (→ segs-1 tube segments)
  rise: 1.0,          // upward fraction of the sweep (× beamLen)
  back: 0.34,         // rearward sweep low on the beam (× beamLen)
  out: 0.32,          // lateral spread, max near the top (× beamLen)
  curl: 0.42,         // forward curl high on the beam (× beamLen) — the beam tips forward over the brow
  rootR: 0.02,        // beam radius at the pedicle
  tipR: 0.005,        // beam radius at the tip
  spread: 0.028,      // lateral offset of each pedicle from the midline
  pedRise: 1.05,      // pedicle seat height up the crown (× skull width)
  pedFwd: 0.16,       // pedicle seat forward along the skull (× skull length) — on the crown, behind the eyes
  // TINES — each branches off the beam: `at` = station 0..1 along the beam, `len` = ×beamLen,
  // `aim` = [side, fwd, up] in the antler frame (side is signed outward per antler), `r` = ×rootR.
  tines: [
    { at: 0.14, len: 0.34, aim: [0.15, 0.9, 0.5], r: 0.7 },   // brow tine — forward & up, low
    { at: 0.44, len: 0.4, aim: [0.35, 0.35, 1.0], r: 0.72 },  // mid tine — up & a little forward/out
    { at: 0.72, len: 0.36, aim: [0.4, 0.15, 1.0], r: 0.66 },  // upper tine — up & out
  ],
  N: 6, M: 10, stroke: '#b8a884',   // pale bone-tan antler
};

// A tapered round tube a→b (ra→rb), a stack of rings. Same maker the feet use.
function tube(a, b, ra, rb, N, M) {
  const ax = sub3(b, a), L = vlen(ax);
  if (L < 1e-6) return null;
  const axis = mul(ax, 1 / L);
  let up = { x: 0, y: 0, z: 1 }, side = cross3(up, axis);
  if (vlen(side) < 1e-6) side = cross3({ x: 1, y: 0, z: 0 }, axis);
  side = normalize3(side); up = normalize3(cross3(axis, side));
  const rings = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1), ctr = add(a, mul(ax, t)), r = ra + (rb - ra) * t, poly = [];
    for (let j = 0; j <= M; j++) { const an = (j / M) * Math.PI * 2; poly.push(add(ctr, add(mul(side, r * Math.cos(an)), mul(up, r * Math.sin(an))))); }
    rings.push(poly);
  }
  return { polylines: rings, stroke: '#b8a884' };
}

// The beam control points for one side (sgn = -1 left / +1 right), in the antler frame.
function beamPoints(base, frame, c, sgn) {
  const { side, fwdH, up } = frame, pts = [];
  for (let i = 0; i < c.segs; i++) {
    const t = i / (c.segs - 1);
    const climb = mul(up, c.beamLen * c.rise * t);
    const drift = mul(fwdH, -c.beamLen * c.back * t * (1 - t));         // sweep back low, ease off high
    const flare = mul(side, sgn * c.beamLen * c.out * Math.sin(t * Math.PI / 2));
    const curl = mul(fwdH, c.beamLen * c.curl * smooth(t) * t);         // curl forward, concentrated near the top
    pts.push(add(base, add(climb, add(drift, add(flare, curl)))));
  }
  return pts;
}

// Sample a polyline at u∈[0,1] (piecewise-linear over the control points).
function sampleLine(pts, u) {
  const n = pts.length - 1, x = Math.max(0, Math.min(1, u)) * n, i = Math.min(n - 1, Math.floor(x)), f = x - i;
  return add(mul(pts[i], 1 - f), mul(pts[i + 1], f));
}

/**
 * Build a pair of antlers seated on the crown of a head.
 * @param {{x,y,z}} anchor  the skull anchor (base of the skull, as buildAnimal's head.anchor)
 * @param {{x,y,z}} dir     the muzzle direction (head.dir)
 * @param {object} [cfg]    ANTLER_DEFAULT dials + { headLen, headW } to seat the pedicle
 * @returns {{polylines:{x,y,z}[][], stroke:string}[]}
 */
export function antlers(anchor, dir, cfg = {}) {
  const c = { ...ANTLER_DEFAULT, ...cfg };
  const D = normalize3(dir);
  const up = { x: 0, y: 0, z: 1 };
  let side = normalize3(cross3(up, D));
  if (vlen(side) < 1e-6) side = { x: 1, y: 0, z: 0 };
  const fwdHlen = Math.hypot(D.x, D.y) || 1;
  const fwdH = { x: D.x / fwdHlen, y: D.y / fwdHlen, z: 0 };            // horizontal muzzle heading
  const frame = { side, fwdH, up };
  const headLen = c.headLen ?? 0.16, headW = c.headW ?? 0.045;
  // crown seat: up off the skull top, forward over the brow (behind the eyes)
  const crown = add(anchor, add(mul(fwdH, headLen * c.pedFwd), mul(up, headW * c.pedRise)));
  const parts = [];
  for (const sgn of [-1, 1]) {
    const base = add(crown, mul(side, sgn * c.spread));
    const pts = beamPoints(base, frame, c, sgn);
    // beam as connected tapered segments
    for (let i = 0; i < pts.length - 1; i++) {
      const ra = c.rootR + (c.tipR - c.rootR) * (i / (pts.length - 1));
      const rb = c.rootR + (c.tipR - c.rootR) * ((i + 1) / (pts.length - 1));
      const seg = tube(pts[i], pts[i + 1], ra, rb, c.N, c.M);
      if (seg) parts.push({ ...seg, stroke: c.stroke });
    }
    // tines off the beam
    for (const tn of c.tines) {
      const p = sampleLine(pts, tn.at);
      const aim = normalize3(add(mul(side, sgn * tn.aim[0]), add(mul(fwdH, tn.aim[1]), mul(up, tn.aim[2]))));
      const tip = add(p, mul(aim, c.beamLen * tn.len));
      const seg = tube(p, tip, c.rootR * (tn.r ?? 0.7), c.tipR, c.N, c.M);
      if (seg) parts.push({ ...seg, stroke: c.stroke });
    }
  }
  return parts;
}
