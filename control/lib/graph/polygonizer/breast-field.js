/** breast-field.js — the BREAST as a field: how far its surface stands proud of the chest, as a function of the chest
 * coordinate z = u + iv about the apex (u out from the midline, v up; both in bust radii). The science page's way of
 * reading a function as a landscape (its features and the phase winding round them) turned on one anatomical form:
 *
 *   h(z) = P · (1 − τ^m(θ))^q(θ)     t = |z| / ρ(θ),  θ = arg z,  τ = t rounded at the apex,  h = 0 for t ≥ 1
 *
 * ρ(θ), the FOOTPRINT, is a low Fourier series fitted through four reaches (up, down, out to the axillary tail, in to the
 * cleft); m(θ) and q(θ), the PROFILE, are the pole's character through the same four directions: m 2 leaves the apex as
 * a dome, m 1 as a straight line (a cone, rounded at the apex itself); q under 1 meets the chest steeply (the lower pole
 * and its fold), q over 1 lands on it concave (the upper pole's slope).
 * Every parameter is an anatomy word; the GATES measure what an artist checks, on the field itself.
 * Pure and deterministic (dmath). */
import * as dmath from '../../util/dmath.js';

/** reaches of the footprint from the apex (bust radii): up, down, out (lateral), in (medial); the profile's `shape` (m)
 * and exponent (`profile`, q) in the same four directions; `round` the apex's rounding (of the reach); `proj` the apex's
 * projection (bust radii) */
export const BREAST_FIELD = Object.freeze({ reach: Object.freeze({ up: 1.4, down: 1.05, out: 1.25, in: 1.15 }), shape: Object.freeze({ up: 1, down: 2, out: 1.8, in: 1.8 }), profile: Object.freeze({ up: 3, down: 0.55, out: 2.8, in: 2.8 }), round: 0.35, proj: 0.95 });

/** a four-direction value round the apex as a smooth function of θ (the Fourier series through up / down / out / in) */
function around({ up, down, out, in: inn }, th) {
  const a0 = (up + down + out + inn) / 4, a1 = (up - down) / 2, b1 = (out - inn) / 2, a2 = (out + inn - up - down) / 4;
  return a0 + a1 * dmath.sin(th) + b1 * dmath.cos(th) + a2 * dmath.cos(2 * th);
}
/** the field's height at (u, v), bust radii */
export function breastHeight(u, v, F = BREAST_FIELD) {
  const r = dmath.hypot(u, v); if (r < 1e-12) return F.proj;
  const th = dmath.atan2(v, u), t = r / around(F.reach, th); if (t >= 1) return 0;
  const c = F.round ?? 0, tau = c > 0 ? (Math.sqrt(t * t + c * c) - c) / (Math.sqrt(1 + c * c) - c) : t;
  return F.proj * dmath.pow(Math.max(0, 1 - dmath.pow(tau, around(F.shape ?? { up: 2, down: 2, out: 2, in: 2 }, th))), around(F.profile, th));
}
/** the footprint's reach along θ (bust radii) */
export const breastReach = (th, F = BREAST_FIELD) => around(F.reach, th);
/** the footprint's span across the chest at height v: [u in, u out] or null where it does not reach */
export function breastSpan(v, F = BREAST_FIELD, n = 720) {
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < n; k++) { const th = (2 * Math.PI * k) / n, rr = around(F.reach, th), y = rr * dmath.sin(th); if (Math.abs(y - v) > rr * (Math.PI / n) * 2 + 1e-9) continue; const x = rr * dmath.cos(th); lo = Math.min(lo, x); hi = Math.max(hi, x); }
  return lo <= hi ? [lo, hi] : null;
}

/** THE GATES, measured on the field (bust radii; angles in degrees), each { value, band, pass }:
 *   poles      the upper pole's share of the breast's height over the apex (Mallucci's 45 : 55), the height counted
 *              where the breast stands at least 5 % of its projection;
 *   projection the apex's projection;
 *   fold       the wall angle under the lower pole where it meets the chest (steep: the inframammary fold);
 *   upperLine  the upper pole's bend through its middle (≥ 0: straight or concave, never a dome);
 *   lowerPole  the lower pole's bend through its middle (< 0: convex, full);
 *   fullness   the lower pole's share of the volume (under the apex's level): the weight a breast carries low;
 *   meridian   how far the apex sits off the footprint's centroid across (of the width): on the mound's middle, the
 *              axillary tail notwithstanding (its turn outward is the placement's);
 *   margins    the steepest wall where the upper, medial and lateral margins meet the chest (shallow: they melt into it;
 *              only the fold is a crease — steep all round reads as a ball laid on the chest);
 *   winding    the turns the slope's phase makes round the apex on a loop halfway out (the argument principle the
 *              science page counts on its landscapes): exactly 1, one clean peak, no second bump or dimple */
export const BREAST_BANDS = Object.freeze({ poles: [0.42, 0.5], projection: [0.85, 1.05], fold: [60, 90], upperLine: [-0.02, Infinity], lowerPole: [-Infinity, -0.05], fullness: [0.53, 0.65], meridian: [-0.06, 0.06], margins: [0, 25], winding: [1, 1] });
export function breastGates(F = BREAST_FIELD) {
  const h = (u, v) => breastHeight(u, v, F), P = F.proj, edge = (dir) => { let s = 0; while (s < 3 && h(0, dir * s) >= 0.05 * P) s += 0.001; return s; };
  const U = edge(1), D = edge(-1);
  // the fold's wall: the steepest descent of the centre line in the last tenth of the lower reach
  const Rd = around(F.reach, -Math.PI / 2); let fold = 0; for (let v = -0.9 * Rd; v > -Rd + 0.002; v -= 0.002) fold = Math.max(fold, (h(0, v + 0.001) - h(0, v - 0.001)) / 0.002);
  const bend = (v0, v1) => { const n = 8; let s = 0; for (let k = 0; k <= n; k++) { const v = v0 + (k / n) * (v1 - v0), e = 0.01; s += (h(0, v + e) - 2 * h(0, v) + h(0, v - e)) / (e * e); } return s / (n + 1); };
  // the footprint's centroid (area) in v and u
  let A = 0, cu = 0, cv = 0; const N = 360;
  for (let k = 0; k < N; k++) { const t0 = (2 * Math.PI * k) / N, t1 = (2 * Math.PI * (k + 1)) / N, r0 = around(F.reach, t0), r1 = around(F.reach, t1);
    const p = [r0 * dmath.cos(t0), r0 * dmath.sin(t0)], q = [r1 * dmath.cos(t1), r1 * dmath.sin(t1)], a = (p[0] * q[1] - q[0] * p[1]) / 2; A += a; cu += a * (p[0] + q[0]) / 3; cv += a * (p[1] + q[1]) / 3; }
  cu /= A; cv /= A;
  const width = around(F.reach, 0) + around(F.reach, Math.PI);
  let vLo = 0, vAll = 0; for (let i = -150; i <= 150; i++) for (let j = -150; j <= 150; j++) { const x = h(i / 100, j / 100); vAll += x; if (j < 0) vLo += x; else if (j === 0) vLo += x / 2; }
  // the margins' walls: the steepest slope over the outer tenth of the reach, from the lateral through the upper to the
  // medial direction (the lower half is the fold's, gated above, and its ends turning up the sides)
  let margin = 0; for (let k = 0; k <= 24; k++) { const th = (k / 24) * Math.PI, dir = [dmath.cos(th), dmath.sin(th)], R = around(F.reach, th);
    for (let r = 0.9 * R; r < R - 0.002; r += 0.002) margin = Math.max(margin, (h((r - 0.001) * dir[0], (r - 0.001) * dir[1]) - h((r + 0.001) * dir[0], (r + 0.001) * dir[1])) / 0.002); }
  // the slope's phase round the apex: its turns over a loop halfway out
  let turn = 0, prev = null; for (let k = 0; k <= 720; k++) { const th = (2 * Math.PI * k) / 720, R = 0.5 * around(F.reach, th), u = R * dmath.cos(th), v = R * dmath.sin(th), e = 1e-4;
    const ph = dmath.atan2(h(u, v + e) - h(u, v - e), h(u + e, v) - h(u - e, v)); if (prev !== null) { let d = ph - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; turn += d; } prev = ph; }
  const value = { poles: U / (U + D), projection: P, fold: dmath.atan(fold) * 180 / Math.PI, upperLine: bend(0.3 * U, 0.7 * U), lowerPole: bend(-0.7 * D, -0.3 * D), fullness: vLo / vAll, meridian: -cu / width, margins: dmath.atan(margin) * 180 / Math.PI, winding: Math.round(turn / (2 * Math.PI)) };
  return Object.fromEntries(Object.entries(value).map(([k, x]) => { const [lo, hi] = BREAST_BANDS[k]; return [k, { value: Math.round(x * 1e4) / 1e4, band: BREAST_BANDS[k], pass: x >= lo && x <= hi }]; }));
}
