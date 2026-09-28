/**
 * crystal-print — the light a crystal throws, beam-traced exactly (crystal-shine S2).
 *
 * A convex polytope under a directional light needs no photons: every lit facet refracts a PARALLEL beam (one
 * direction per wavelength band and per ray), so a beam is a polygon travelling in a straight line. Its cross-section is
 * clipped by the exit facets (their projections along the beam tile the stone, because it is convex), each piece
 * refracts out or reflects (total internal reflection), and every piece that leaves downward lands on the receiver
 * plane as a polygon whose irradiance conserves flux. The crystal-light study measured the same prints with a
 * spectral photon tracer; this is the closed form of its first bounces.
 *
 * What each piece carries:
 *   - dispersion: each band refracts with its own index (fire is where the bands part);
 *   - birefringence: a uniaxial stone splits the transmitted light into an ordinary and an extraordinary beam, the
 *     e beam's energy walking off its wave normal on the index ellipsoid (calcite's double image);
 *   - absorption along its own path, integrated over its band (a thin ruby path is pink, a long one red);
 *   - Fresnel at every face (unpolarized: the mean of s and p).
 * Internal reflection keeps a ray's mode (o stays o) — the approximation the study's tracer did not need.
 *
 * Output: `{ polygons: [{ corners, rgb, band, mode, dir, via }], shadow: corners, stats }` (`via`: the facets crossed).
 *
 * Two halves: `printOptics(gem)` folds the spectra into a small JSON block (per band: the two indices, and the band's
 * colour after a path, tabled over path length for each ray), and `printKernel()` is the tracer, self-contained with no
 * free variables, so a page embeds `(${printKernel})()` verbatim and traces exactly what the server traces. `rgb` is the piece's irradiance in linear sRGB,
 * relative to the light's irradiance on a surface facing it (white = [1, 1, 1]). The shadow is the stone's silhouette
 * on the receiver: the renderer removes the direct light there and adds the polygons. Pure and deterministic.
 */

import { crystalIndex, crystalOptics, cie, xyzToLinearSrgb, crystalAbsorption } from './crystal-optics.js';

// ─── bands: a partition of the visible, so the bands' colours sum to white ────────────────────────────────
const D65 = [49.98, 54.65, 82.75, 91.49, 93.43, 86.68, 104.86, 117.01, 117.81, 114.86, 115.92, 108.81, 109.35, 107.8, 104.79, 107.69, 104.41,
  104.05, 100, 96.33, 95.79, 88.69, 90.01, 89.6, 87.7, 83.29, 83.7, 80.03, 80.21, 82.28, 78.28, 69.72, 71.61, 74.35, 61.6, 69.89, 75.09, 63.59, 46.42, 66.81, 63.38];
const d65 = (nm) => { const x = (nm - 380) / 10, i = Math.max(0, Math.min(39, Math.floor(x))), f = Math.max(0, Math.min(1, x - i)); return D65[i] * (1 - f) + D65[i + 1] * f; };
export const PRINT_BANDS = Object.freeze({
  3: [[380, 490], [490, 590], [590, 780]],
  6: [[380, 450], [450, 495], [495, 540], [540, 585], [585, 630], [630, 780]],
});
let WHITE = null;
function whiteRef() { if (!WHITE) { const X = [0, 0, 0]; for (let nm = 380; nm <= 780; nm += 2) { const c = cie(nm), w = d65(nm); for (let k = 0; k < 3; k++) X[k] += w * c[k]; } WHITE = xyzToLinearSrgb(X); } return WHITE; }
/** A band's colour after `pathCm` of absorption, linear sRGB; the bands of the whole visible with no path sum to white.
 *  `eShare`: the share of the wave's E along c (0 for the o ray; sin² of k's angle to c for the e ray). */
function bandColour(gem, [lo, hi], pathCm, eShare = 0) {
  const X = [0, 0, 0]; const W = whiteRef();
  for (let nm = lo + 1; nm < hi; nm += 2) {
    const a = pathCm > 0 ? (1 - eShare) * crystalAbsorption(gem, 'o', nm) + eShare * crystalAbsorption(gem, 'e', nm) : 0;
    const c = cie(nm), w = d65(nm) * Math.exp(-a * pathCm); for (let k = 0; k < 3; k++) X[k] += w * c[k];
  }
  return xyzToLinearSrgb(X).map((v, k) => Math.max(0, v / W[k]));
}
export const PRINT_PATHS_CM = Object.freeze([0, 0.01, 0.03, 0.1, 0.3, 1, 3, 10]);
/** What the kernel needs from a gem, folded from its spectra: JSON-serializable. */
export function printOptics(gem, bands = 6) {
  const list = PRINT_BANDS[bands] || PRINT_BANDS[6]; const uniaxial = crystalOptics(gem).opticalClass === 'uniaxial'; const r = (c) => c.map((v) => +v.toPrecision(6));
  // opal: a black-backed cabochon swallows what enters; its print is its shadow
  return { gem, uniaxial, opaque: !!crystalOptics(gem).photonic, paths: [...PRINT_PATHS_CM], bands: list.map(([lo, hi]) => { const nm = (lo + hi) / 2;
    return { lo, hi, no: +crystalIndex(gem, 'o', nm).toFixed(6), ne: +crystalIndex(gem, 'e', nm).toFixed(6), o: PRINT_PATHS_CM.map((p) => r(bandColour(gem, [lo, hi], p, 0))), e: PRINT_PATHS_CM.map((p) => r(bandColour(gem, [lo, hi], p, 1))) }; }) };
}

/** The tracer, self-contained: no free variables, so `(${printKernel})()` runs the same code in a page. */
export function printKernel() {
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const apply = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
  const perpTo = (v) => unit(cross(v, Math.abs(v[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
  const lumOf = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  /** A band's colour after `pathCm` (a ray's E-along-c share `eShare`): geometric interpolation of the tabled colours. */
  function colourAt(band, paths, pathCm, eShare) {
    const one = (tab) => { const x = Math.max(0, pathCm); let i = 0; while (i < paths.length - 2 && x > paths[i + 1]) i++;
      const t = (x - paths[i]) / (paths[i + 1] - paths[i]); return tab[i].map((a, k) => { const b = tab[i + 1][k]; return a <= 0 || b <= 0 ? a + (b - a) * Math.min(1, t) : a * Math.pow(b / a, t); }); };
    const o = one(band.o); if (!eShare) return o; const e = one(band.e); return o.map((v, k) => v * (1 - eShare) + e[k] * eShare);
  }
  // ─── the index ellipsoid: modes on the far side of a face (tangential k continuous) ───────────────────────
  /**
   * Waves in medium `med` ({ n } isotropic, or { no, ne, a } uniaxial with unit optic axis a) propagating to the −N side
   * of a face with unit normal N, for tangential wave vector kt: [{ mode, k, s }] (s = the ray, the energy direction).
   */
  function modesInto(med, kt, N) {
    const kt2 = dot(kt, kt); const out = [];
    if (!med.a) { const x2 = med.n * med.n - kt2; if (x2 >= 0) { const k = sub(kt, scale(N, Math.sqrt(x2))); out.push({ mode: 'o', k, s: unit(k) }); } return out; }
    const { no, ne, a } = med; const x2 = no * no - kt2;
    if (x2 >= 0) { const k = sub(kt, scale(N, Math.sqrt(x2))); out.push({ mode: 'o', k, s: unit(k) }); }
    const dl = 1 / (no * no) - 1 / (ne * ne), Na = dot(N, a), ka = dot(kt, a);
    const A = Na * Na * dl + 1 / (ne * ne), B = 2 * ka * Na * dl, C = ka * ka * dl + kt2 / (ne * ne) - 1, disc = B * B - 4 * A * C;
    if (disc >= 0) for (const x of [(-B - Math.sqrt(disc)) / (2 * A), (-B + Math.sqrt(disc)) / (2 * A)]) {
      const k = add(kt, scale(N, x)); const s = unit(add(scale(k, 1 / (ne * ne)), scale(a, dot(k, a) * dl)));
      if (dot(s, N) < 0) { out.push({ mode: 'e', k, s }); break; }
    }
    return out;
  }
  const fresnelT = (n1, n2, ci, ct) => { const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct), rp = (n2 * ci - n1 * ct) / (n2 * ci + n1 * ct); return 1 - 0.5 * (rs * rs + rp * rp); };

  // ─── 2D convex clipping in the plane ⟂ a beam ─────────────────────────────────────────────────────────────
  const area2 = (P) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - a[1] * b[0]; } return s / 2; };
  const ccw = (P) => (area2(P) < 0 ? P.slice().reverse() : P);
  function clipConvex(subject, clipper) {                                         // Sutherland–Hodgman; both CCW
    let out = subject;
    for (let i = 0; i < clipper.length && out.length; i++) {
      const a = clipper[i], b = clipper[(i + 1) % clipper.length]; const inside = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-15;
      const src = out; out = [];
      for (let j = 0; j < src.length; j++) {
        const p = src[j], q = src[(j + 1) % src.length]; const pi = inside(p), qi = inside(q);
        if (pi) out.push(p);
        if (pi !== qi) { const d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]), d2 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]); const t = d1 / (d1 - d2); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
      }
    }
    return out.length >= 3 && Math.abs(area2(out)) > 1e-18 ? out : null;
  }
  /** The convex hull of 2D points (monotone chain), CCW. */
  function hull2(pts) {
    const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = []; for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function tracePrint({ optics, poly, pose = {}, light, receiver = { z: 0 }, depth = 2, maxPolygons = 1200, unit: upm = 100, minFace = 0 }) {
    // minFace: skip lit facets whose area seen by the light is under this share of the largest (a live page's budget)
    const R = pose.R || [[1, 0, 0], [0, 1, 0], [0, 0, 1]], at = pose.at || [0, 0, 0];
    const L = unit(light.dir); const uniaxial = optics.uniaxial; const paths = optics.paths;
    const V = poly.vertices.map((v) => add(apply(R, v), at));
    const faces = poly.faces.map((ix, i) => ({ P: ix.map((k) => V[k]), n: apply(R, poly.normals[i]) }));
    const axis = apply(R, [0, 0, 1]);
    const Z = receiver.z;
    const stats = { incident: 0, toReceiver: 0, escaped: 0, absorbed: 0, truncated: 0, reflectedAtEntry: 0 };
    const pieces = [];
    const toCm = 100 / upm;                                                         // world units → cm (absorption is per cm)
    // the shadow: the silhouette projected along L onto the receiver
    const proj = (p, d) => { const t = (Z - p[2]) / d[2]; return [p[0] + d[0] * t, p[1] + d[1] * t]; };
    const shadow = L[2] < -1e-9 ? hull2(V.map((p) => proj(p, L))).map(([x, y]) => [x, y, Z]) : [];
    if (optics.opaque) return { polygons: [], shadow, stats: { ...stats, polygons: 0 } };
    const seen = faces.map((f) => Math.max(0, -dot(L, f.n)) * polyArea3(f.P)); const seenMax = Math.max(...seen);

    /** Follow a parallel beam inside the stone: polygon `P` (on a face, world), ray s, wave vector k, mode, flux per unit ⟂ area. */
    function inside(P, Pn, s, k, mode, med, band, flux, pathCm, gen, via) {   // Pn: the unit normal of the face P lies on
      const u = perpTo(s), v = cross(s, u); const to2 = (p) => [dot(p, u), dot(p, v)];
      const src = ccw(P.map(to2));
      for (const [fi, f] of faces.entries()) {
        if (dot(f.n, s) <= 1e-12) continue;
        const piece = clipConvex(src, ccw(f.P.map(to2))); if (!piece) continue;
        // lift the piece onto the exit face: the point on the line (u,v)+t·s that lies on the face's plane
        const d0 = dot(f.n, f.P[0]); const lift = ([x, y]) => { const q = add(scale(u, x), scale(v, y)); return add(q, scale(s, (d0 - dot(f.n, q)) / dot(f.n, s))); };
        const Q = piece.map(lift); const perpArea = Math.abs(area2(piece)); const F = flux * perpArea;
        // the path from the entry polygon to this piece, at the piece's centroid
        const c2 = piece.reduce((a, p) => [a[0] + p[0] / piece.length, a[1] + p[1] / piece.length], [0, 0]);
        const cEntry = (() => { const q = add(scale(u, c2[0]), scale(v, c2[1])); return add(q, scale(s, (dot(Pn, P[0]) - dot(Pn, q)) / dot(Pn, s))); })();
        const path = pathCm + len(sub(lift(c2), cEntry)) * toCm;
        // exit: tangential k continuous into air (n = 1)
        const kt = sub(k, scale(f.n, dot(k, f.n))); const x2 = 1 - dot(kt, kt);
        const ci = Math.abs(dot(unit(k), f.n)); const nIn = len(k);
        let T = 0, out = null;
        if (x2 >= 0) { out = add(kt, scale(f.n, Math.sqrt(x2))); T = fresnelT(nIn, 1, ci, Math.sqrt(x2)); }
        // F is geometric (area × transmittances); the band's colour after the path carries its share of white and its loss
        const eShare = mode === 'e' ? 1 - dot(unit(k), med.a) ** 2 : 0; const col = colourAt(band, paths, path, eShare); const Yc = lumOf(col), Y0 = lumOf(band.o[0]);
        const Ft = F * T, Fr = F * (1 - T);
        if (Ft > 0) {
          stats.absorbed += Ft * (Y0 - Yc);
          if (out[2] < -1e-9) {
            const G = Q.map((p) => { const t = (Z - p[2]) / out[2]; return [p[0] + out[0] * t, p[1] + out[1] * t]; }); const Ga = Math.abs(area2(G));
            if (Ga > 1e-18) { pieces.push({ corners: G.map(([x, y]) => [x, y, Z]), flux: Ft * Yc, rgb: col.map((c) => (Ft * c) / Ga), band: optics.bands.indexOf(band), mode, dir: unit(out), via: [...via, fi] }); stats.toReceiver += Ft * Yc; } else stats.escaped += Ft * Yc;
          } else stats.escaped += Ft * Yc;
        }
        if (Fr > 0) {
          if (gen >= depth) { stats.truncated += Fr * Yc; stats.absorbed += Fr * (Y0 - Yc); continue; }
          const kr = sub(k, scale(f.n, 2 * dot(k, f.n)));                           // same mode: reflect the wave vector
          const ms = modesInto(med, sub(kr, scale(f.n, dot(kr, f.n))), f.n).filter((m) => m.mode === mode);   // back into the stone (−n)
          if (!ms.length) { stats.truncated += Fr * Yc; stats.absorbed += Fr * (Y0 - Yc); continue; }
          const m = ms[0]; const mu = perpTo(m.s); const A = Math.abs(area2(Q.map((p) => [dot(p, mu), dot(p, cross(m.s, mu))])));
          if (!(A > 1e-14)) { stats.truncated += Fr * Yc; stats.absorbed += Fr * (Y0 - Yc); continue; }   // a grazing sliver
          inside(Q, f.n, m.s, m.k, mode, med, band, Fr / A, path, gen + 1, [...via, fi]);
        }
      }
    }

    for (const band of optics.bands) {
      const Y0 = lumOf(band.o[0]);                                               // this band's share of white's luminance
      const med = uniaxial ? { no: band.no, ne: band.ne, a: axis } : { n: band.no };
      for (const [fi, f] of faces.entries()) {
        const cosI = -dot(L, f.n); if (cosI <= 1e-9 || seen[fi] < minFace * seenMax) continue;
        const G = polyArea3(f.P) * cosI; stats.incident += G * Y0;                  // geometric: the face's area seen by the light
        const kt = sub(L, scale(f.n, dot(L, f.n)));
        const modes = modesInto(med, kt, f.n);
        for (const m of modes) {
          const share = uniaxial ? 0.5 : 1;                                       // unpolarized light: half to each ray
          const T = fresnelT(1, len(m.k), cosI, Math.abs(dot(unit(m.k), f.n)));
          stats.reflectedAtEntry += G * share * (1 - T) * Y0;
          const u = perpTo(m.s); const perp = Math.abs(area2(f.P.map((p) => [dot(p, u), dot(p, cross(m.s, u))])));
          inside(f.P, f.n, m.s, m.k, m.mode, med, band, (G * share * T) / perp, 0, 0, [fi]);
        }
        if (!modes.length) stats.reflectedAtEntry += G * Y0;
      }
    }
    // the budget: keep the brightest pieces by flux
    let polygons = pieces;
    if (polygons.length > maxPolygons) { polygons = polygons.slice().sort((a, b) => b.flux - a.flux); const dropped = polygons.slice(maxPolygons); polygons = polygons.slice(0, maxPolygons); stats.dropped = dropped.length; stats.droppedFlux = dropped.reduce((s, p) => s + p.flux, 0); }
    return { polygons: polygons.map(({ flux, ...p }) => p), shadow, stats: { ...stats, polygons: polygons.length } };
  }
  function polyArea3(P) { let n = [0, 0, 0]; for (let i = 1; i < P.length - 1; i++) n = add(n, cross(sub(P[i], P[0]), sub(P[i + 1], P[0]))); return len(n) / 2; }
  return { tracePrint };
}
export const { tracePrint } = printKernel();
/** The print of one crystal: `printOptics(gem, bands)` traced by the kernel (see `tracePrint` for the options). */
export function crystalPrint({ gem, bands = 6, ...rest }) { return tracePrint({ optics: printOptics(gem, bands), ...rest }); }
