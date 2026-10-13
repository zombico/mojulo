/**
 * LANDMARKS: what stands on a city's sites. A landmark site may name one of the landmark library's (landmarks/: the
 * Eiffel Tower, the Colosseum, the Taj…), a civic site one of its sacred and civic buildings (a church, a mosque, a
 * temple, a rotunda), and either may stand a building of the operator's own, minted with mint_solid({ kind:
 * 'edifice' }) and named by its ref.
 *
 *   sites: [{ at, use: 'landmark', landmark: '<id>' }]                 one of LANDMARK_IDS, at its real size
 *   sites: [{ at, use: 'civic', building: 'church', variant? }]         one of SACRED's, its variant by name or by its id
 *   sites: [{ at, use: 'landmark' | 'civic', from: '<edifice ref>' }]   the operator's own, at its true scale
 *
 * The contract every one keeps (the library's own, landmarks/refacade.js): it stands inside its site, the forecourt a
 * ring around it, and rolls no dice. A library landmark is laid at its real size (fractal-city LANDMARK_REAL) along the
 * site's long side; one too big for its site is scaled down to fit, and the `landmark-fits` law says by how much. An
 * edifice is seated the same way at its true scale (feet to metres).
 */
import { LANDMARK_SHAPES, LANDMARK_HEIGHTS } from '../../landmarks/index.js';
import { LANDMARK_FOOTPRINT, LANDMARK_REAL, LANDMARK_REAL_ALIAS, CITY_METERS_PER_UNIT as U } from '../fractal-city.js';
import { planEdifice, buildEdificeFaces } from '../../architecture/edifice.js';
import { strHash } from './dice.js';

const r2 = (v) => Math.round(v * 100) / 100;
const FT = 0.3048;
/** The library's landmarks a site may name: each at its real size (its aliases read as it). */
export const LANDMARK_IDS = Object.freeze([...LANDMARK_SHAPES].filter((k) => LANDMARK_REAL[k] && LANDMARK_FOOTPRINT[k]));
export const LANDMARK_ALIASES = Object.freeze(Object.fromEntries(Object.entries(LANDMARK_REAL_ALIAS)));
/** The sacred and civic buildings a civic site may name, and the variants each is built in. */
export const SACRED = Object.freeze({
  church: { class: 'religious', key: 'churchVariant', variants: ['basilica', 'orthodox', 'chapel'] },
  mosque: { class: 'religious', key: 'mosqueVariant', variants: ['ottoman', 'persian', 'sahelian', 'nusantara'] },
  temple: { class: 'religious', key: 'templeVariant', variants: ['pagoda', 'stupa', 'tibetan'] },
  rotunda: { class: 'civic', key: 'domeForm', variants: ['hemispheric', 'onion', 'bulbous'] },
});
export const REF = /^[A-Za-z0-9_-]{1,64}$/;
// the forecourt round a landmark: a fifth of its site's short side, no more than the legacy metro plaza (≈ 22 m)
const ringOf = (w, d) => Math.min(Math.min(w, d) * 0.2, 22);

/** A landmark's real size in metres: { short, long, h } (along its long side, across it, its height). */
export function landmarkSize(id) {
  const key = LANDMARK_ALIASES[id] || id, real = LANDMARK_REAL[key], F = LANDMARK_FOOTPRINT[id] ?? LANDMARK_FOOTPRINT[key];
  const ratio = LANDMARK_HEIGHTS[id] ?? LANDMARK_HEIGHTS[key] ?? 1, aspect = F?.aspect ?? 1;
  // the legacy metro city's fit (fractal-city metroLandmarkBase): the height fit, or with a real plan the mean of both
  const byHeight = real.h / ratio, short = real.long ? Math.sqrt(byHeight * (real.long / aspect)) : byHeight;
  return { short: r2(short), long: r2(short * aspect), h: r2(short * ratio) };
}

/** Seat a footprint (fx along x, fy along y, metres) in a site rect, inside its forecourt ring: centred, a quarter turn
 *  when that fits it larger, scaled down only when it must be. */
function seat(rect, fx, fy) {
  const w = rect.x1 - rect.x0, d = rect.y1 - rect.y0, ring = ringOf(w, d), aw = w - 2 * ring, ad = d - 2 * ring;
  const fit = (a, b) => Math.min(1, aw / a, ad / b), turn = fit(fy, fx) > fit(fx, fy) + 1e-9;
  const gw = turn ? fy : fx, gd = turn ? fx : fy, scale = fit(gw, gd), cx = (rect.x0 + rect.x1) / 2, cy = (rect.y0 + rect.y1) / 2;
  return { x0: r2(cx - gw * scale / 2), y0: r2(cy - gd * scale / 2), x1: r2(cx + gw * scale / 2), y1: r2(cy + gd * scale / 2), scale: r2(scale), turn };
}

/** A library landmark's mass on its site: { x0, y0, x1, y1, h, landmark, scale }. */
export function landmarkMass(id, rect) {
  const S = landmarkSize(id), m = seat(rect, S.long, S.short);
  return { x0: m.x0, y0: m.y0, x1: m.x1, y1: m.y1, h: r2(S.h * m.scale), landmark: id, scale: m.scale, real: S };
}

/** A sacred or civic building's mass on its site (inset as a civic site is), its variant named or hashed off its id. */
export function sacredMass(kind, rect, variant, siteId, height) {
  const S = SACRED[kind], w = rect.x1 - rect.x0, d = rect.y1 - rect.y0;
  const v = variant ?? S.variants[strHash(siteId) % S.variants.length];
  const m = { x0: rect.x0 + w * 0.15, y0: rect.y0 + d * 0.15, x1: rect.x1 - w * 0.15, y1: rect.y1 - d * 0.15 };
  // its height the library's own read off its short side (fractal-city seedReligiousPlace / seedCivicDomes), unless named
  const cl = Math.min(m.x1 - m.x0, m.y1 - m.y0);
  const h = height ?? sacredHeight(kind, v, cl);
  return { ...Object.fromEntries(Object.entries(m).map(([k, x]) => [k, r2(x)])), h: r2(h), building: kind, variant: v };
}
// the library's heights (fractal-city.js seedReligiousPlace, seedCivicDomes), in its units, back to metres
function sacredHeight(kind, v, clm) {
  const cl = clm / U;
  const h = kind === 'church' ? (v === 'basilica' ? Math.max(4.2, cl * 1.5) + Math.max(0.34, cl * 0.18) + cl * 0.28 : v === 'orthodox' ? cl * 1.05 + cl * 0.78 + cl * 1.0 + cl * 0.42 : cl * 0.95 + cl * 0.6 + cl * 0.55 + cl * 0.62 * 1.7)
    : kind === 'mosque' ? (v === 'persian' ? Math.max(4.5, cl * 2.1) + cl * 0.34 + cl * 0.2 : v === 'sahelian' ? Math.max(4, cl * 1.8) + cl * 0.18 + cl * 0.27 : v === 'nusantara' ? cl * 0.82 + cl * 1.2 * 1.15 + cl * 0.18 + cl * 0.24 : Math.max(4, cl * 1.95) + cl * 0.4 + cl * 0.2)
      : kind === 'temple' ? (v === 'stupa' ? cl * 0.36 + cl * 0.82 + cl * 0.12 + cl * 0.7 + cl * 0.4 : v === 'tibetan' ? Math.max(2.6, cl * 1.0) + cl * 0.42 + cl * 0.14 : cl * 0.16 + cl * 1.4 + cl * 0.9 * 0.9)
        : (() => { const rDrum = cl * 0.4, domeH = v === 'onion' ? rDrum * 1.5 : v === 'bulbous' ? rDrum * 1.2 : rDrum * 0.92; return cl * 0.1 + cl * 0.85 + domeH + cl * 0.3; })();
  return h * U;
}

/** An edifice's mass on its site at its true scale (planEdifice bounds, feet → metres): { x0…, h, from, scale, turn }. */
export function edificeMass(manifest, rect, ref) {
  const P = planEdifice(manifest), b = P.bounds, w = (b.x1 - b.x0) * FT, d = (b.y1 - b.y0) * FT, top = Math.max(...P.envelopes.map((e) => e.top)) * FT;
  const m = seat(rect, w, d);
  return { x0: m.x0, y0: m.y0, x1: m.x1, y1: m.y1, h: r2(top * m.scale), from: ref, scale: m.scale, turn: m.turn };
}

/** The edifice's faces seated on its mass, in the world's units (the inverse of edificeMass's fit). */
export function edificeFaces(manifest, mass, light) {
  const P = planEdifice(manifest), b = P.bounds, { faces, textures } = buildEdificeFaces(P, { light });
  const k = FT * mass.scale / U, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, mx = (mass.x0 + mass.x1) / 2 / U, my = (mass.y0 + mass.y1) / 2 / U;
  // a quarter turn when the edifice's long side runs across the site's
  const at = ([x, y, z]) => { const u = (x - cx) * k, v = (y - cy) * k; return mass.turn ? [mx - v, my + u, z * k] : [mx + u, my + v, z * k]; };
  const rot = (n) => (mass.turn ? [-n[1], n[0], n[2]] : n);
  return { faces: faces.map((f) => ({ ...f, corners: f.corners.map(at), ...(f.normal ? { normal: rot(f.normal) } : {}), inset: mass.from })), textures };
}
