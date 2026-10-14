/**
 * BODYWORK — a body LANGUAGE for the fleet's loft (fleet.js): how an era draws a car at its true numbers. The fleet's
 * own loft is one language, the three-box of the 70s and 80s (a six-point section: slab sides, a flat roof; a flat cap
 * at each end; upright glass; rectangular lamps). This one draws the road today, or further:
 *
 *   plan      the nose and tail rounded (an elliptical inset over the end's length), not squared at the last 2 %
 *   section   the sill tucked under, the widest line at the fenders, a shoulder stepping in at the belt, the glass
 *             leaning in (tumblehome), the roof crowned across; the bonnet crowned too
 *   profile   a monotone cubic through the body family's stations: raked glass, a roof arcing along its length (its
 *             peak the class's height, never above it), a belt rising to the tail, the bumper lifted at the ends
 *   face      slim lamps wrapping the corners (or a bar across), an upper grille and a lower intake (or a closed nose)
 *   wheels    an arch hugging the tyre, a rounder tyre, spoked rims (the hub style's)
 *
 *   loftLanguage(paint, trim, R, spec, T)   spec: the fleet's (L, W, H, wb, r, profile, kind) + `language`, and the
 *                                           style's `lamps` ('round' | 'rect' | 'bar') and `clad` (lower cladding)
 *
 * A kind takes the language in part (SOFT: a van's and a pickup's panels flatter, their ends blunter); a faceted motif
 * (`spec.crisp`) crisper. Template frame: +x forward, +y left, z up, centred, wheels on z = 0; R the yaw. Pure.
 */
import { face, faceOut } from './road-faces.js';

export const BODY_LANGUAGES = Object.freeze({
  current: Object.freeze({
    reads: 'the road today: taut sides under a high shoulder, a flat bonnet to a blunt face, raked glass, slim lamps wrapping the corners',
    rake: 0.05,       // the windscreen's top set back, share of L
    rakeRear: 0.035,  // the rear glass's top brought forward, share of L
    arc: 0.03,        // the roof's arc along its length: its ends below its peak, share of H
    crown: 0.012,     // the roof's and the bonnet's crown across, share of H
    roofW: 0.72,      // the roof's width, share of W (the tumblehome)
    tuck: 0.05,       // the sill tucked under, share of W
    widest: 0.7,      // where the side is widest, share of the way from the sill to the belt (a high shoulder)
    shoulder: 0.035,  // the shoulder's step in at the belt, share of W
    beltRise: 0.03,   // the belt rising toward the tail, share of H (the wedge)
    nose: Object.freeze({ len: 0.075, inset: 0.13, drop: 0.05, rise: 0.05 }),   // len share of L, inset share of the half width, drop and rise in m
    tail: Object.freeze({ len: 0.05, inset: 0.08, drop: 0.03, rise: 0.05 }),
    arch: 1.04,       // the arch's radius over the tyre's (plus 2 cm)
    lamps: 'rect', grille: 'open', wheelN: 16,
  }),
  future: Object.freeze({
    reads: 'sculpted and lit: a fast roof, a closed nose, a light bar across each end',
    rake: 0.07, rakeRear: 0.06, arc: 0.055, crown: 0.025, roofW: 0.68, tuck: 0.05, widest: 0.55, shoulder: 0.03, beltRise: 0.03,
    nose: Object.freeze({ len: 0.1, inset: 0.18, drop: 0.12, rise: 0.07 }),
    tail: Object.freeze({ len: 0.07, inset: 0.1, drop: 0.05, rise: 0.06 }),
    arch: 1.03,
    lamps: 'bar', grille: 'closed', wheelN: 16,
  }),
});
/** How much of the language a kind takes. */
const SOFT = Object.freeze({ car: 1, box: 0.55, pickup: 0.45 });

/** Monotone cubic (Fritsch–Carlson) through [[x, y]…], x increasing: no overshoot, so a peak stays the peak. */
function monotone(P) {
  const n = P.length, h = [], d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) { h[i] = P[i + 1][0] - P[i][0]; d[i] = (P[i + 1][1] - P[i][1]) / h[i]; }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
    const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  return (x) => {
    let i = 0;
    while (i < n - 2 && x > P[i + 1][0]) i++;
    const t = Math.min(1, Math.max(0, (x - P[i][0]) / h[i])), t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * P[i][1] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * P[i + 1][1] + (t3 - t2) * h[i] * m[i + 1];
  };
}
// an elliptical end: 0 at the end's length, 1 at the very end
const ellipse = (t) => 1 - Math.sqrt(Math.max(0, 1 - t * t));

/** A face from a quad, turned away from `inside`; null when it has no area (a greenhouse closing to the bonnet). */
function quad(q, hex, inside) {
  const c = q.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
  let n = [0, 0, 0];
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])];
  }
  if (Math.hypot(...n) < 1e-5) return null;
  const flip = n[0] * (c[0] - inside[0]) + n[1] * (c[1] - inside[1]) + n[2] * (c[2] - inside[2]) < 0;
  return face(flip ? q.slice().reverse() : q, hex, { keepWinding: true });
}

/** The body's top along its centre line and its plan inset, at a fraction of the length from the nose; the section
 *  there. Exposed for the livery (a stripe follows the roof). */
export function bodyShape(spec) {
  const { L, W, H, wb, r, profile: p, kind } = spec;
  const lang = BODY_LANGUAGES[spec.language];
  if (!lang) throw new Error(`bodywork: unknown language ${spec.language}`);
  const s = (SOFT[kind] ?? 1) * (spec.crisp ? 0.7 : 1);
  const N = lang.nose, Tl = lang.tail, nl = N.len * (0.5 + 0.5 * s), tl = Tl.len * (0.5 + 0.5 * s);
  // the profile's stations: the nose rounding down, the cowl, the screen's top set back, the roof's peak, the rear
  // glass's top brought forward, the deck, the tail rounding down
  const A = p.roofA + lang.rake * s, B = Math.max(A + 0.08, p.roofB - lang.rakeRear * s), arcE = lang.arc * H * s;
  const peak = A + (B - A) * 0.4;
  const raw = [[0, p.zHood - N.drop * s], [nl, p.zHood - 0.01], [p.hood, p.zHood + 0.03], [A, H - arcE], [peak, H], [B, B >= 0.999 ? H : H - arcE * 1.4]];
  if (p.deck < 0.999) raw.push([p.deck, p.zDeck]);
  if (p.deck < 1 - tl - 0.01) raw.push([1 - tl, p.zDeck - 0.01]);
  raw.push([1, (p.deck < 0.999 ? p.zDeck : H) - Tl.drop * s]);
  const pts = [];
  for (const q of raw) if (!pts.length || q[0] > pts[pts.length - 1][0] + 0.005) pts.push(q);
  const topAt = monotone(pts);
  const insetAt = (f) => f < nl ? N.inset * s * ellipse(1 - f / nl) : f > 1 - tl ? Tl.inset * s * ellipse(1 - (1 - f) / tl) : 0;
  const zR = r * 0.68, archR = r * lang.arch + 0.02, archX = [wb / 2, -wb / 2];
  const x = (f) => L / 2 - f * L;
  // the sill's line (lifted at the ends: the bumpers), and the arch cut out of the side over each wheel
  const sillAt = (f) => zR + (f < nl ? N.rise * ellipse(1 - f / nl) ** 0.5 : 0) + (f > 1 - tl ? Tl.rise * ellipse(1 - (1 - f) / tl) ** 0.5 : 0);
  const bottomAt = (f) => {
    let z = sillAt(f);
    for (const ax of archX) { const dd = Math.abs(x(f) - ax); if (dd < archR) z = Math.max(z, r + Math.sqrt(archR * archR - dd * dd) * 0.95); }
    return z;
  };
  const crownZ = lang.crown * H * s, CLAD = 0.17;
  /** The section at f: { f, xx, z0, belt, zt, g, pts: [[y, z] × 17] } (the floor, the right side up, the roof, the
   *  left side down; SEGMENTS names each run). */
  const section = (f) => {
    const zt = topAt(f), zs = sillAt(f), zArch = bottomAt(f), k = 1 - insetAt(f);
    const hw = (W / 2) * k, beltF = p.zBelt + lang.beltRise * H * s * (f - 0.35);
    // a low body's fenders rise over its wheels: the belt (and the bonnet's edge) lifted to clear the arch
    const fender = zArch > zs + 1e-6 ? zArch + 0.05 : 0;
    const belt = Math.max(Math.min(beltF, zt - crownZ), fender), top = Math.max(zt - crownZ, belt), g = top - belt;
    const sg = Math.min(1, g / Math.max(0.05, H - crownZ - beltF));
    const yb = hw - lang.shoulder * W * s, yt = yb + ((lang.roofW * W) / 2 * k - yb) * sg;
    const sill = [hw - lang.tuck * W * s, zs], wide = [hw, zs + (belt - zs) * lang.widest];
    // the cladding's line: a band over the sill, carried round the arch
    const zc = Math.min(wide[1] - 0.01, Math.max(zs + CLAD, zArch > zs + 1e-6 ? zArch + 0.06 : 0));
    const tc = (zc - sill[1]) / (wide[1] - sill[1] || 1);
    // the side's lines run from the sill, never the arch: the arch is cut out of them (a point below it moved up to it)
    const side = [
      sill,                                                 // the sill, tucked under
      [sill[0] + (wide[0] - sill[0]) * tc, zc],             // the cladding's line
      wide,                                                 // the side at its widest (the shoulder's line)
      [hw - lang.shoulder * W * s * 0.35, belt - 0.07],     // the shoulder
      [yb, belt],                                           // the belt: the glass starts
    ];
    const z0 = Math.min(zArch, top - 0.03), yAt = (z) => {
      for (let i = 0; i < side.length - 1; i++) if (z <= side[i + 1][1]) { const t = Math.max(0, (z - side[i][1]) / (side[i + 1][1] - side[i][1] || 1)); return side[i][0] + (side[i + 1][0] - side[i][0]) * t; }
      return side[side.length - 1][0];
    };
    const right = [
      ...side.map(([y, z]) => (z < z0 ? [yAt(z0), z0] : [y, z])),
      [yb - (yb - yt) * 0.8, belt + g * 0.86],              // the side glass, leaning in
      [yt, top],                                            // the roof's edge
      [yt * 0.52, top + crownZ * 0.75],                     // the crown
    ];
    const left = right.map(([y, z]) => [-y, z]);
    return { f, xx: x(f), z0, belt, zt, g, pts: [left[0], ...right, [0, zt], ...left.slice(1).reverse()] };
  };
  return { lang, s, nl, tl, topAt, insetAt, bottomAt, section, archX, archR, A, B, peak, x };
}
/** What each run of a section is, from its first point to the next. */
const SEGMENTS = Object.freeze(['floor', 'clad', 'side', 'side', 'side', 'glass', 'glass', 'roof', 'roof', 'roof', 'roof', 'glass', 'glass', 'side', 'side', 'side', 'clad']);
const SMOKE = '#2b3036';   // a lamp's housing: smoked, its light a line along it

/** Loft the body in its language: paint (tinted) and trim (glass, plastics, lamps) face lists. */
export function loftLanguage(paint, trim, R, spec, T) {
  const { L, H, profile: p } = spec;
  const B = bodyShape(spec), { lang, nl, tl } = B;
  // the stations: an even run, dense at the ends (their rounding) and round each arch, and the profile's own
  const fs = new Set();
  for (let i = 0; i <= 25; i++) fs.add(i / 25);
  for (const t of [0.04, 0.12, 0.25, 0.45, 0.7, 1]) { fs.add(nl * t); fs.add(1 - tl * t); }
  for (const ax of B.archX) for (let i = 0; i <= 8; i++) { const f = (L / 2 - (ax - B.archR * Math.cos((i / 8) * Math.PI))) / L; if (f > 0.003 && f < 0.997) fs.add(f); }
  for (const f of [p.hood, B.A, B.peak, B.B, p.deck]) if (f > 0.003 && f < 0.997) fs.add(f);
  const sorted = [...fs].map((f) => Math.round(f * 1e4) / 1e4).sort((a, b) => a - b), stations = [];
  for (const f of sorted) if (!stations.length || f - stations[stations.length - 1] > 0.003 || f === 1) stations.push(f);
  if (stations[stations.length - 2] > 0.997) stations.splice(stations.length - 2, 1);
  const S = stations.map(B.section), inside = R(0, 0, H * 0.5);
  const lampsWord = spec.lamps ?? lang.lamps;
  for (let i = 0; i < S.length - 1; i++) {
    const a = S[i], b = S[i + 1], n = a.pts.length;
    const slope = Math.abs(a.zt - b.zt) / Math.abs(a.xx - b.xx);
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n, role = SEGMENTS[k];
      const q = [R(a.xx, a.pts[k][0], a.pts[k][1]), R(a.xx, a.pts[k2][0], a.pts[k2][1]), R(b.xx, b.pts[k2][0], b.pts[k2][1]), R(b.xx, b.pts[k][0], b.pts[k][1])];
      let hex = T.paint, to = paint;
      if (role === 'floor' || (role === 'clad' && spec.clad)) { hex = T.plastic; to = trim; }
      else if (role === 'glass' && a.g > 0.05 && b.g > 0.05) { hex = T.glass; to = trim; }
      else if (role === 'roof' && slope > 0.35 && Math.min(a.zt, b.zt) > p.zBelt - 0.02) { hex = T.glass; to = trim; }   // the screen, the rear glass
      const fc = quad(q, hex, inside);
      if (fc) to.push(fc);
    }
  }
  // the end caps, and the face each wears
  const yOnSide = (sec, z) => {   // the right side's y at height z (between the sill and the belt)
    const P = sec.pts.slice(1, 6);
    for (let i = 0; i < P.length - 1; i++) if (z >= P[i][1] && z <= P[i + 1][1]) { const t = (z - P[i][1]) / (P[i + 1][1] - P[i][1] || 1); return P[i][0] + (P[i + 1][0] - P[i][0]) * t; }
    return z < P[0][1] ? P[0][0] : P[P.length - 1][0];
  };
  const proud = 0.008;
  const onCap = (sgn, yz, hex, lift = 0) => {   // a polygon on an end cap, just proud of it ([[y, z]…])
    const sec = sgn > 0 ? S[0] : S[S.length - 1], xo = sec.xx + sgn * (proud + lift);
    trim.push(faceOut(yz.map(([y, z]) => R(xo, y, z)), hex, R(sec.xx - sgn, 0, yz[0][1])));
  };
  const band = (sgn, y0, y1, z0, z1, rise, hex, lift = 0) => onCap(sgn, [[y0, z0], [y1, z0 + rise], [y1, z1 + rise], [y0, z1]], hex, lift);
  const wrap = (sgn, z0, z1, side, reach, hex, lift = 0) => {   // carried round the corner onto the side, `reach` of the end's length
    const run = S.filter((sec) => (sgn > 0 ? sec.f <= nl * reach + 1e-9 : sec.f >= 1 - tl * reach - 1e-9));
    for (let i = 0; i < run.length - 1; i++) {
      const a = run[i], b = run[i + 1];
      const pa = (z) => R(a.xx, side * (yOnSide(a, z) + proud + lift), z), pb = (z) => R(b.xx, side * (yOnSide(b, z) + proud + lift), z);
      const fc = quad([pa(z0), pb(z0), pb(z1), pa(z1)], hex, R(0, 0, z0));
      if (fc) trim.push(fc);
    }
  };
  for (const [sec, sgn] of [[S[0], 1], [S[S.length - 1], -1]]) {
    const poly = sec.pts.map(([y, z]) => R(sec.xx, y, z));
    paint.push(faceOut(sgn > 0 ? poly : poly.slice().reverse(), T.paint, inside));
    const hw = yOnSide(sec, (sec.z0 + sec.belt) / 2), front = sgn > 0;
    const zl1 = Math.min(sec.zt - 0.05 - (front ? 0 : 0.03), sec.belt - 0.01), zl0 = zl1 - (lampsWord === 'bar' ? 0.035 : 0.07), sweep = front ? 0.025 : 0.012;
    const lit = front ? T.lamp : T.tail, line = 0.02;
    if (lampsWord === 'bar') {
      // a light bar across the end, carried round both corners
      const ye = yOnSide(sec, zl0) - 0.01;
      band(sgn, -ye, ye, zl0, zl1, 0, lit);
      for (const side of [-1, 1]) wrap(sgn, zl0, zl1, side, 0.5, lit);
    } else if (lampsWord === 'round') {
      for (const sy of [-1, 1]) {
        const cy = sy * hw * 0.68, cz = zl1 - 0.06, rr = 0.075;
        onCap(sgn, Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) / 8) * 2 * Math.PI; return [cy + rr * Math.cos(a), cz + rr * Math.sin(a)]; }), lit);
      }
    } else for (const sy of [-1, 1]) {
      // a slim lamp sweeping up to the corner and round it: a smoked housing, its light a line along the top (the tail's
      // all lit)
      const ye = sy * (yOnSide(sec, zl0) - 0.01), yi = sy * hw * (front ? 0.4 : 0.5);
      band(sgn, yi, ye, zl0, zl1, sweep, front ? SMOKE : lit);
      wrap(sgn, zl0 + sweep, zl1 + sweep, sy, 0.45, front ? SMOKE : lit);
      if (front) { band(sgn, yi, ye, zl1 - line, zl1, sweep, lit, 0.003); wrap(sgn, zl1 + sweep - line, zl1 + sweep, sy, 0.45, lit, 0.003); }
    }
    if (front) {
      // the face: a grille between the lamps flaring to the bumper's line, and a lower intake; or a closed nose, its
      // intake alone
      const mid = sec.z0 + (sec.belt - sec.z0) * 0.42;
      if ((spec.grille ?? lang.grille) === 'open') onCap(1, [[-hw * 0.46, mid + 0.03], [hw * 0.46, mid + 0.03], [hw * 0.38, zl1 - 0.005], [-hw * 0.38, zl1 - 0.005]], T.plastic);
      band(1, -hw * 0.68, hw * 0.68, sec.z0 + 0.05, mid - 0.03, 0, T.plastic);
    } else band(-1, -hw * 0.8, hw * 0.8, sec.z0 + 0.02, sec.z0 + 0.1, 0, T.plastic);   // the diffuser
  }
}
