// The bug builder's one geometric primitive: a closed RING PART (a ring plan `rings` segment) along explicit stations,
// each ring perpendicular to the local axis with its `front` slot along a STABLE up vector the caller gives (never +y
// projected, which flips a ring as a chord tips past level). Every part of a bug (a section, a leg bar, an antenna, a
// wing blade, an eye) is one of these. Pure, deterministic, no I/O.
import { SLOT_FAMILIES } from '../polygonizer/station-loft-plan.js';
import * as dmath from '../../util/dmath.js';

export const sub = (a, b) => a.map((x, i) => x - b[i]);
export const add = (a, b) => a.map((x, i) => x + b[i]);
export const mul = (a, m) => a.map((x) => x * m);
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a) => Math.sqrt(dot(a, a));
export const unit = (a) => { const l = norm(a); if (!(l > 1e-15)) throw new Error('bug builder: degenerate direction'); return mul(a, 1 / l); };
export const rad = (d) => (d * Math.PI) / 180;
export const cosd = (d) => dmath.cos(rad(d));
export const sind = (d) => dmath.sin(rad(d));
/** rotate v about the unit axis k by deg (Rodrigues) */
export const rotate = (v, k, deg) => { const c = cosd(deg), s = sind(deg); return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c))); };

/** THE PROFILE every lofted part shares: a radius share over u ∈ [0, 1], rising from `r0` at u = 0 to 1 at `peak`
 * (sine ease, exponent `p`) and falling to `r1` at u = 1 (cosine ease, exponent `q`). A section, a wing's chord, an
 * antenna's club are all this curve with different numbers. */
export function profile(u, { r0 = 0.6, peak = 0.5, r1 = 0.3, p = 1, q = 1 } = {}) {
  if (u <= peak) return peak <= 0 ? 1 : r0 + (1 - r0) * dmath.pow(Math.max(0, dmath.sin((Math.PI / 2) * (u / peak))), p);
  return peak >= 1 ? 1 : r1 + (1 - r1) * dmath.pow(Math.max(0, dmath.cos((Math.PI / 2) * ((u - peak) / (1 - peak)))), q);
}

/** A ring of `slots` at centre c, axis d, front along `up` projected off d, radii r = [side, front] (or one number).
 * The side axis is d × front, the convention that winds a level trunk's ring outward; the left half (slots past the
 * back) is the right's mirror through the ring's front plane. */
function ring(c, d, up, r, slots, e) {
  let f = sub(up, mul(d, dot(up, d)));
  if (norm(f) < 1e-9) { f = sub([0, 0, 1], mul(d, d[2])); if (norm(f) < 1e-9) f = sub([0, 1, 0], mul(d, d[1])); }
  f = unit(f); const s = unit(cross(d, f));
  // r: one radius, [side, front], or [side, front, back] (the back half's own depth: a flat belly)
  const [rs, rf, rb = rf] = Array.isArray(r) ? r : [r, r], n = slots.length, pts = {};
  const pw = (x) => (x < 0 ? -1 : 1) * dmath.pow(Math.abs(x), 2 / e);
  for (let k = 0; k <= n / 2; k++) {
    const t = (2 * Math.PI * k) / n, ct = dmath.cos(t), F = mul(f, (ct < 0 ? rb : rf) * pw(ct)), S = mul(s, rs * pw(dmath.sin(t)));
    pts[slots[k]] = add(c, add(F, S)); if (k && k < n / 2) pts[slots[n - k]] = add(c, sub(F, S));
  }
  return pts;
}

/** A closed ring part (`tipAt`: an explicit tip cap point, a pointed piece's end). stations: [{ c: [x, y, z], r, up?, d? }] (d defaults to the chord through the neighbours, up to
 * the part's `up`); caps sit `cap` × the end radius beyond the end rings. `mirror: 'name'` for a right-side part (name
 * ending R; the compiler makes its L), null for a midline part (its rings are symmetric by construction). */
export function ringPart(name, stations, { group, slots = 'ring8', e = 2, up = [0, 0, 1], mirror = null, cap = [0.45, 0.45], capGroups, tipAt } = {}) {
  const fam = SLOT_FAMILIES[slots], m = stations.length, C = stations.map((s) => s.c);
  if (m < 2) throw new Error(`bug builder: part '${name}' needs two stations`);
  const dirAt = (i) => stations[i].d ? unit(stations[i].d) : unit(sub(C[Math.min(i + 1, m - 1)], C[Math.max(i - 1, 0)]));
  const big = (r) => (Array.isArray(r) ? Math.max(...r) : r);
  const out = {
    name, kind: 'rings', slots, group, mirror,
    stations: stations.map((s, i) => ({ id: `st${i}`, points: ring(s.c, dirAt(i), s.up || up, s.r, fam, s.e ?? e) })),
    caps: { back: sub(C[0], mul(dirAt(0), cap[0] * big(stations[0].r))), tip: tipAt || add(C[m - 1], mul(dirAt(m - 1), cap[1] * big(stations[m - 1].r))) },
  };
  if (capGroups) out.capGroups = capGroups;
  return out;
}

/** stations along a straight bar A → B, overshooting each end by `over` × its radius (so joints overlap), with an
 * optional mid radius; `up` is the ring front (a leg bar's in-plane normal, so a flattened femur keeps its faces) */
export function barStations(A, B, rA, rB, { rMid, mid = 0.5, over = [0.5, 0.5], up } = {}) {
  const d = unit(sub(B, A)), L = norm(sub(B, A)), big = (r) => (Array.isArray(r) ? Math.max(...r) : r);
  const lerp = (a, b, t) => (Array.isArray(a) || Array.isArray(b) ? [0, 1].map((i) => { const x = Array.isArray(a) ? a[i] : a, y = Array.isArray(b) ? b[i] : b; return x + (y - x) * t; }) : a + (b - a) * t);
  const at = (t) => add(A, mul(d, t));
  return [
    { c: at(-over[0] * big(rA)), r: rA, up, d },
    { c: at(mid * L), r: rMid ?? lerp(rA, rB, 0.5), up, d },
    { c: at(L + over[1] * big(rB)), r: rB, up, d },
  ];
}
