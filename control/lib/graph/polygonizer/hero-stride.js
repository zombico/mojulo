/**
 * hero-stride — THE LEGS PASS EACH OTHER: the swing leg's clearance of the stance leg through a gait, and the solve that
 * keeps it. A walk set on a narrow base (figure-posing.js WALK_MINT `stepWidth`: the feet a few centimetres apart, on
 * nearly one line) brings the swing leg's knee and foot through the planted leg's as they pass, the more so on a figure
 * whose thighs and calves are full. People do not trip on that line because the swing leg goes AROUND the stance leg:
 *   • the foot leaves its line and swings out (circumduction: the hip abducts a little) as it lifts off, behind the body;
 *   • it passes the planted leg wide at mid-swing, the knee bent (the foot lifted) and the thigh already ahead of the
 *     upright stance thigh, so the knees pass fore and aft of each other rather than through;
 *   • and it comes back onto the line only in the last part of the swing, once it is past the planted foot (the
 *     medial travel is LATE: before that it would cross the stance ankle), so it lands on the line in front of it.
 * The weight is over the stance foot as the other passes (the gait's own weight shift), which is what frees the swing
 * hip to move out.
 *
 *   legGirths(recipe, R)            → { [side]: { thigh: [[t, r]…], shank: [[t, r]…] } } the leg's radii by its bone's share
 *   legClearance(R, nodes, girths)  → { clear, at }: the least gap (m) between the two legs' surfaces (capsules of the
 *                                     girths), the inner thighs' own contact under the groin left out (THIGH_TOUCH)
 *   swingBump(s)                    → the swing's lateral excursion by its place in the swing, 0 … 1 (0 at lift-off and
 *                                     at landing; out early, held through the pass, in late)
 *
 * Pure and deterministic; heroLocomotion (hero-motion.js) solves the excursion's size on the rig.
 */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** the top share of each thigh whose surfaces meet the other's at rest (the inner thighs under the groin): soft tissue in
 * contact, never a collision, so a clearance leaves it out */
export const THIGH_TOUCH = 0.4;
/** samples along a bone */
const ALONG = 12;

/** a station ring's centre and mean radius */
function ringOf(st) {
  const P = Object.values(st.points), c = [0, 1, 2].map((a) => P.reduce((t, p) => t + p[a], 0) / P.length);
  return { c, r: P.reduce((t, p) => t + len(sub(p, c)), 0) / P.length };
}

/** a leg's radii by the share of its bone: each ring of the segment's part projected on the bone at rest */
export function legGirths(recipe, R) {
  const out = {};
  for (const [S, L] of Object.entries(R.legs || {})) {
    const take = (part, a, b) => {
      const P = recipe.parts?.[`${part}${S}`]; if (!P?.stations?.length) return null;
      const A = R.joints[a], B = R.joints[b], d = sub(B, A), dd = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
      const rows = P.stations.map(ringOf).map(({ c, r }) => { const v = sub(c, A); return [(v[0] * d[0] + v[1] * d[1] + v[2] * d[2]) / dd, r]; }).filter(([t]) => t > -0.2 && t < 1.2).sort((x, y) => x[0] - y[0]);
      return rows.length ? rows.map(([t, r]) => [Math.round(t * 1e4) / 1e4, Math.round(r * 1e5) / 1e5]) : null;
    };
    const thigh = take('thigh', L.hip, L.knee), shank = take('shank', L.knee, L.hock);
    if (thigh && shank) out[S] = { thigh, shank };
  }
  return Object.keys(out).length ? out : null;
}

/** a girth table's radius at a share t (clamped to its ends) */
function radiusAt(rows, t) {
  if (t <= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++) if (t <= rows[i][0]) { const [t0, r0] = rows[i - 1], [t1, r1] = rows[i]; return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0 || 1); }
  return rows[rows.length - 1][1];
}

/** a leg's surface samples on a posed node map: [point, radius, bone, share] along the thigh and the shank */
function samplesOf(R, nodes, S, G) {
  const L = R.legs[S], hip = nodes[L.hip], knee = nodes[L.knee], hock = nodes[L.hock], out = [];
  for (let k = 0; k <= ALONG; k++) { const t = k / ALONG; out.push([lerp(hip, knee, t), radiusAt(G.thigh, t), 'thigh', t]); }
  for (let k = 1; k <= ALONG; k++) { const t = k / ALONG; out.push([lerp(knee, hock, t), radiusAt(G.shank, t), 'shank', t]); }
  return out;
}

/** the least gap between the two legs' surfaces on a posed node map (negative: they pass through each other) */
export function legClearance(R, nodes, girths) {
  const sides = Object.keys(girths || {}); if (sides.length < 2) return { clear: Infinity, at: null };
  const A = samplesOf(R, nodes, sides[0], girths[sides[0]]), B = samplesOf(R, nodes, sides[1], girths[sides[1]]);
  let clear = Infinity, at = null;
  for (const [p, r, bp, tp] of A) for (const [q, s, bq, tq] of B) {
    if (bp === 'thigh' && bq === 'thigh' && tp < THIGH_TOUCH && tq < THIGH_TOUCH) continue;
    const g = len(sub(p, q)) - r - s;
    if (g < clear) { clear = g; at = `${bp} ${tp.toFixed(2)} · ${bq} ${tq.toFixed(2)}`; }
  }
  return { clear, at };
}

/** the swing's lateral excursion by its place in the swing (0 at lift-off … 1 at landing): out over the first third, held
 * through the pass, back onto the line over the last third (late, past the planted foot) */
export const swingBump = (s) => smooth(0, 0.3, s) * (1 - smooth(0.68, 1, s));
