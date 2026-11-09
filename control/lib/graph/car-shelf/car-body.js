/**
 * car-body — a composed car's BODY in the form render: a loft at its class's true numbers, shaped by its body style and
 * its design language (car-bodies.js, car-languages.js), every face named for the glasshouse and the panels that read it
 * after (car-designer/road-glass.js, road-panels.js), as the heavy classes' bodies are (road-heavy.js).
 *
 *   section   round the half from the floor to the roof's crown: the sill tucked under, the cladding's line, the side
 *             at its widest, the shoulder, the belt, the glass leaning in, the roof's edge, the crown
 *   plan      the ends rounded (an elliptical inset over the end's length), bowed (the corners falling back from the
 *             nose's middle) and raked (the face's upper part set back from its foot), the side swelling over each wheel and drawn in between them (the haunches and the waist)
 *   profile   a monotone cubic through the style's stations: the screen raked, the roof arcing, the deck, the ends
 *             dropping and rising to the bumpers
 *   arches    cut out of the side over each wheel, round or square (the language's `archPow`)
 *   open      an open body (a convertible, a roadster) has no roof: its cockpit a tub between the screen and the deck
 *
 *   carBody(design) → { faces, hubs, axles, stations } (design: car-library.js composeCar); the faces are form faces
 *                     { corners, part, material, albedo, outNormal }, the body with its parts (car-parts.js) on it
 *
 * Vehicle space (+y forward, x across, +x the right side, z up), metres, the wheels' contact at z = 0; the body lifted
 * (or dropped) over its wheels by its ride. Pure and deterministic.
 */
import { carParts } from './car-parts.js';
import { CAR_HEX, FLARE, face } from './car-common.js';

export { CAR_HEX, face };

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
const ellipse = (t) => 1 - Math.sqrt(Math.max(0, 1 - t * t));

/** What each run of the section loop is, from its point to the next (17 runs: the floor, up the right, over the roof,
 *  down the left). */
const RUNS = Object.freeze(['floor', 'clad', 'side', 'side', 'shoulder', 'glass', 'glass', 'roof', 'roof', 'roof', 'roof', 'glass', 'glass', 'shoulder', 'side', 'side', 'clad']);

/** The body's shape: its sections, its plan and its profile, as functions of the share of its length from the nose. */
export function bodyShape(D) {
  const { style: St, lang: Lg, parts: Pt, frame: Fr } = D;
  const { L, H, wb, r, lift } = Fr, r0 = Fr.r0 ?? r;
  // (the flares round the arches stand proud of the body: inside the class's width, as its bumpers are inside its length)
  const W = Fr.W - (Pt.flares ? 2 * FLARE : 0);
  const u = St.upright, open = Pt.roof === 'open';
  // the language bent by how upright the body stands
  const g = {
    rake: Lg.rake * (1 - 0.7 * u), rakeRear: Lg.rakeRear * (1 - 0.8 * u), arc: Lg.arc * (1 - u), crown: Lg.crown * (1 - 0.6 * u),
    roofW: Lg.roofW + (0.9 - Lg.roofW) * u, tuck: Lg.tuck * (1 - 0.6 * u), widest: Lg.widest, shoulder: Lg.shoulder * (1 - 0.5 * u),
    beltRise: Lg.beltRise * (1 - u), haunch: Lg.haunch * (1 - 0.5 * u),
  };
  // the bars that stand proud of the ends (chrome or steel bumpers, a spare wheel) are inside the class's length
  const bar = ['chrome', 'steel'].includes(Pt.bumpers) ? 0.06 : 0;
  const padF = bar, padR = Math.max(bar, Pt.spare ? 0.26 : 0);
  const yF = L / 2 - padF, yR = -L / 2 + padR, Lb = yF - yR, y = (f) => yF - f * Lb;
  const end = (E, k) => ({ len: E.len * (1 - k * u), inset: E.inset * (1 - 0.5 * u), drop: E.drop, rise: E.rise, bow: 0 });
  const N = end(Lg.nose, 0.4), T = end(Lg.tail, 0.5), nl = N.len, tl = T.len;
  // (the bow kept within what the end's rounding can carry: the corners never fold past the station behind them)
  N.bow = Math.min(Lg.nose.bow * (1 - 0.6 * u), 0.35 * nl * Lb); T.bow = Math.min(Lg.tail.bow * (1 - 0.6 * u), 0.35 * tl * Lb);
  // (and the face raked: the end's upper part set back from its foot, metres a metre of height, kept inside the same)
  N.lean = Math.min((Lg.nose.lean ?? 0) * (1 - u), (0.3 * nl * Lb) / H); T.lean = Math.min((Lg.tail.lean ?? 0) * (1 - u), (0.3 * tl * Lb) / H);
  const axles = [wb / 2, -wb / 2], fAx = axles.map((a) => (yF - a) / Lb);
  // the profile's stations (body heights; the ride lifts the whole body after)
  const zHood = St.zHood * H, zDeck = St.zDeck * H, zBelt = St.zBelt * H;
  const A = St.roofA + g.rake, B = Math.max(A + 0.08, St.roofB - g.rakeRear), arcE = g.arc * H, peak = A + (B - A) * 0.4;
  const raw = open
    ? [[0, zHood - N.drop], [nl, zHood - 0.01], [St.hood, zHood + 0.02], [St.hood + 0.04, zBelt], [St.deck, zDeck]]
    : [[0, zHood - N.drop], [nl, zHood - 0.01], [St.hood, zHood + 0.03], [A, H - arcE], [peak, H], [B, B >= 0.999 ? H : H - arcE * 1.4]];
  if (!open && St.deck < 0.999) raw.push([St.deck, zDeck]);
  if (St.deck < 1 - tl - 0.01) raw.push([1 - tl, zDeck - 0.01]);
  raw.push([1, (St.deck < 0.999 ? zDeck : H) - T.drop]);
  const pts = [];
  for (const q of raw) if (!pts.length || q[0] > pts[pts.length - 1][0] + 0.005) pts.push(q);
  const topAt = monotone(pts);
  const insetAt = (f) => (f < nl ? N.inset * ellipse(1 - f / nl) : f > 1 - tl ? T.inset * ellipse(1 - (1 - f) / tl) : 0);
  // the corners falling back from the end's middle, and the face raked back over its height: metres at the very end,
  // gone at the end's length
  const zR0 = (Fr.r0 ?? r) * 0.68;
  const bowAt = (f, x, z = zR0) => {
    const q = (x / (W / 2)) ** 2, up = Math.max(0, z - zR0);
    if (f < nl) return -(N.bow * q + N.lean * up) * (1 - f / nl) ** 2;
    if (f > 1 - tl) return (T.bow * q + T.lean * up) * (1 - (1 - f) / tl) ** 2;
    return 0;
  };
  // the arches (the hub in body heights: the ride lifts the body, not the wheels)
  const archR = r * Lg.arch + 0.02, p = Lg.archPow, hubZ = r - lift;
  const zR = r0 * 0.68;
  const sillAt = (f) => zR + (f < nl ? N.rise * ellipse(1 - f / nl) ** 0.5 : 0) + (f > 1 - tl ? T.rise * ellipse(1 - (1 - f) / tl) ** 0.5 : 0);
  const bottomAt = (f) => {
    let z = sillAt(f);
    for (const ax of axles) { const dd = Math.abs(y(f) - ax); if (dd < archR) z = Math.max(z, hubZ + archR * (1 - (dd / archR) ** p) ** (1 / p) * 0.95); }
    return z;
  };
  // the haunches: the side at full width over each wheel, drawn in by the waist between
  const bumpAt = (f) => Math.max(0, ...axles.map((ax) => { const d = Math.abs(y(f) - ax) / (archR * 2.6); return d < 1 ? Math.cos((Math.PI / 2) * d) ** 2 : 0; }));
  const crownZ = g.crown * H;
  // an open body's cockpit: a tub from just behind the screen's foot to the cabin's end
  const cockA = St.hood + 0.035, cockB = St.roofB, zTub = Math.min(zBelt - 0.3, hubZ + 0.03);
  const inTub = (f) => open && f > cockA + 0.005 && f < cockB - 0.005;
  const section = (f) => {
    const zt = topAt(f), zs = sillAt(f), zArch = bottomAt(f), k = 1 - insetAt(f), bump = bumpAt(f);
    const hwLow = (W / 2) * k * (1 - g.haunch * (1 - bump)), hwBelt = (W / 2) * k * (1 - g.haunch * 0.55 * (1 - bump));
    const beltF = zBelt + g.beltRise * H * (f - 0.35), fender = zArch > zs + 1e-6 ? zArch + 0.05 : 0;
    const belt = Math.max(Math.min(beltF, zt - crownZ), fender), top = Math.max(zt - crownZ, belt), gl = top - belt;
    const sg = Math.min(1, gl / Math.max(0.05, H - crownZ - beltF));
    const yb = hwBelt - g.shoulder * W, yt = yb + ((g.roofW * W) / 2 * k - yb) * sg;
    const sill = [hwLow - g.tuck * W, zs], wide = [hwLow, zs + (belt - zs) * g.widest];
    const zc = Math.min(wide[1] - 0.01, Math.max(zs + 0.17, zArch > zs + 1e-6 ? zArch + 0.06 : 0));
    const tc = (zc - sill[1]) / (wide[1] - sill[1] || 1);
    const zSh = Math.max(wide[1] + 0.02, belt - 0.07);
    const side = [sill, [sill[0] + (wide[0] - sill[0]) * tc, zc], wide, [hwBelt - g.shoulder * W * 0.35, Math.min(zSh, belt - 0.005)], [yb, belt]];
    const z0 = Math.min(zArch, top - 0.03), xAt = (z) => {
      for (let i = 0; i < side.length - 1; i++) if (z <= side[i + 1][1]) { const t = Math.max(0, (z - side[i][1]) / (side[i + 1][1] - side[i][1] || 1)); return side[i][0] + (side[i + 1][0] - side[i][0]) * t; }
      return side[side.length - 1][0];
    };
    const tub = inTub(f);
    const upper = tub
      ? [[yb - 0.05, belt + 0.004], [yb - 0.085, zTub], [yb * 0.45, zTub], [0, zTub]]
      : [[yb - (yb - yt) * 0.8, belt + gl * 0.86], [yt, top], [yt * 0.52, top + crownZ * 0.75], [0, zt]];
    const right = [...side.map(([x, z]) => (z < z0 ? [xAt(z0), z0] : [x, z])), ...upper.slice(0, 3)];
    const centre = upper[3];
    // the loop: the left sill, the right side up, the centre of the top, the left side down
    const loop = [[-right[0][0], right[0][1]], ...right, centre, ...right.slice(1).reverse().map(([x, z]) => [-x, z])];
    return { f, y: y(f), z0, zs, belt, zt, top, g: gl, tub, right, loop, xAt: (z) => xAt(Math.max(z0, z)) };
  };
  return { D, g, N, T, nl, tl, yF, yR, Lb, y, axles, fAx, A, B, peak, archR, hubZ, topAt, bowAt, sillAt, bottomAt, section, cockA, cockB, zTub, open, zBelt, crownZ };
}

/** The stations the loft is drawn through: an even run, dense at the ends and round each arch, the profile's own. */
function stationsOf(S) {
  const { D, nl, tl, Lb, yF, axles, archR } = S, St = D.style;
  const fs = new Set();
  for (let i = 0; i <= 32; i++) fs.add(i / 32);
  for (const t of [0.04, 0.12, 0.25, 0.45, 0.7, 1]) { fs.add(nl * t); fs.add(1 - tl * t); }
  for (const ax of axles) for (let i = 0; i <= 10; i++) { const f = (yF - (ax - archR * Math.cos((i / 10) * Math.PI))) / Lb; if (f > 0.003 && f < 0.997) fs.add(f); }
  for (const f of [St.hood, S.A, S.peak, S.B, St.deck]) if (f > 0.003 && f < 0.997) fs.add(f);
  if (S.open) for (const f of [S.cockA, S.cockA + 0.012, S.cockB - 0.012, S.cockB]) fs.add(f);
  const sorted = [...fs].map((f) => Math.round(f * 1e4) / 1e4).sort((a, b) => a - b), out = [];
  for (const f of sorted) if (!out.length || f - out[out.length - 1] > 0.003 || f === 1) out.push(f);
  if (out[out.length - 2] > 0.997) out.splice(out.length - 2, 1);
  return out;
}

/** The body and its parts. */
export function carBody(D) {
  const S = bodyShape(D), { parts: Pt, paint: Pa, frame: Fr } = D, lift = Fr.lift;
  const stations = stationsOf(S).map(S.section);
  const P = (sec, [x, z]) => [x, sec.y + S.bowAt(sec.f, x, z), z + lift];
  const body = Pa.body, second = Pa.second ?? body;
  const faces = [], push = (f) => { if (f) faces.push(f); };
  const inside = [0, 0, Fr.H * 0.5 + lift];
  const cockMid = [0, S.y((S.cockA + S.cockB) / 2), S.zTub + 0.6 + lift];
  const away = (c, from) => [c[0] - from[0], c[1] - from[1], c[2] - from[2]];
  const centroid = (q) => q.reduce((a, p) => [a[0] + p[0] / q.length, a[1] + p[1] / q.length, a[2] + p[2] / q.length], [0, 0, 0]);
  const look = (k, a, b) => {
    const run = RUNS[k], upperSeg = k >= 4 && k <= 13;
    const paint = (part = 'body') => ({ part, material: 'paint', albedo: Pa.scheme === 'split' && upperSeg ? second : body });
    if (run === 'floor') return { part: 'floor', material: 'seal', albedo: CAR_HEX.seal };
    if (run === 'clad') return Pt.clad || Pt.skirts ? { part: 'clad', material: 'carbon', albedo: CAR_HEX.plastic } : paint();
    if (run === 'side' || run === 'shoulder') return paint();
    const tub = a.tub || b.tub, interior = { part: 'interior', material: 'interior', albedo: CAR_HEX.interior };
    if (run === 'glass') {
      if (tub) return k === 5 || k === 12 ? paint() : interior;
      return a.g > 0.05 && b.g > 0.05 ? { part: 'glass', material: 'glass', albedo: CAR_HEX.glass } : paint();
    }
    // the roof's runs: the tub's floor, the screen and the rear glass where the top slopes, else the roof (or a deck)
    if (tub) return interior;
    const slope = Math.abs(a.zt - b.zt) / Math.abs(a.y - b.y);
    if (slope > 0.35 && Math.min(a.zt, b.zt) > S.zBelt - 0.02 && a.g > 0.02 && b.g > 0.02) return { part: 'glass', material: 'glass', albedo: CAR_HEX.glass };
    if (a.g > 0.05 && b.g > 0.05) {
      if (Pt.roof === 'soft') return { part: 'softtop', material: 'fabric', albedo: CAR_HEX.fabric };
      if (Pt.roof === 'glass' && (k === 8 || k === 9) && a.f > S.A + 0.03 && b.f < S.B - 0.03) return { part: 'glass', material: 'glass', albedo: CAR_HEX.glass };
      return { part: 'roof', material: 'paint', albedo: Pa.scheme === 'mono' ? body : second };
    }
    return paint();
  };
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i], b = stations[i + 1], n = a.loop.length;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n, q = [P(a, a.loop[k]), P(a, a.loop[k2]), P(b, b.loop[k2]), P(b, b.loop[k])], m = look(k, a, b);
      push(face(q, m.part, m.material, m.albedo, m.material === 'interior' ? away(cockMid, centroid(q)) : away(centroid(q), inside)));
    }
  }
  // the end caps, strips between each point and its mirror
  for (const [sec, sgn] of [[stations[0], 1], [stations[stations.length - 1], -1]]) {
    const R = [[0, sec.loop[0][1]], ...sec.right, sec.loop[sec.right.length + 1]];
    for (let j = 0; j < R.length - 1; j++) {
      const a = R[j], b = R[j + 1];
      push(face([P(sec, [-a[0], a[1]]), P(sec, a), P(sec, b), P(sec, [-b[0], b[1]])], 'body', 'paint', body, [0, sgn, 0]));
    }
  }
  const hubs = S.axles.flatMap((ay) => [1, -1].map((side) => [-side * Fr.track / 2, ay, Fr.r]));
  const parts = carParts(S, stations, { P, lift, hubs });
  return { faces: [...faces, ...parts], hubs, axles: S.axles, stations, shape: S };
}
