/**
 * veil.js — WHAT SIGHT DOES NOT GO THROUGH, THOUGH A BODY DOES: a column of tall grass (a geocube's `tallGrass`,
 * form/tall-grass.js). A wall stops a line of sight wherever it crosses it (core.js sightBlocked); grass is thinner: a
 * line is lost in it only after running `through` metres of it under its top, so a body crouched or lying a stride into a
 * patch, or low behind one, is unseen, where one standing has its eye over the grass, and one at the patch's edge is seen.
 * A watcher within `near` metres of the body sees it whatever (it would step on it). A watcher high up (a lookout on a
 * tower) looks down into the grass: its line runs under the top for less of its length, so it sees a crouch where it
 * would not see a body lying flat.
 *
 *   spec.veils: [{ at: [x, y, z], r, h, through?: 1.2, near?: 2 }]   a patch: its middle on the ground, its radius, its
 *                                                                    grass's height over the ground (metres)
 *               [{ under: true, min, max, near?: 1.5 }]              a CRAWL SPACE: the room under something a body lies
 *                                                                    flat under (a truck's chassis: vehicle-registry/parked.js
 *                                                                    `crawl`), `max[2]` its ceiling. A body in it, under its
 *                                                                    ceiling, is hidden from an eye over that ceiling outside
 *                                                                    it beyond `near` (a guard standing over a truck does not
 *                                                                    see who lies under it; one lying, or beside it, does)
 *   E.veilThrough(a, b, veils) → the metres of the line a → b that run through grass under its top
 *   E.veilBlocked(a, b, veils) → is a body's eye at b hidden from an eye at a by the grass? (the thickest patch's
 *                                `through` and the nearest `near` decide)
 *
 * The world carries them (state.veils, read by mind.js perceive through `world.veils`). Import-free (the page runs this
 * source via toString(), compose.js); emitted only into a page whose world has veils, so every other page keeps every
 * byte. The route search (gameworld/stealth-routes.js) builds it on a plain object to read the same lines.
 */
export function buildVeil(E) {
  const THROUGH = 1.2, NEAR = 2, UNDER_NEAR = 1.5;
  // the share of a → b (0..1) inside a patch's column: its circle in plan, under its top in height
  function span(a, b, v) {
    const dx = b[0] - a[0], dy = b[1] - a[1], fx = a[0] - v.at[0], fy = a[1] - v.at[1];
    const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - v.r * v.r;
    let t0, t1;
    if (A < 1e-12) { if (C > 0) return 0; t0 = 0; t1 = 1; }
    else { const D = B * B - 4 * A * C; if (D <= 0) return 0; const s = Math.sqrt(D); t0 = Math.max(0, (-B - s) / (2 * A)); t1 = Math.min(1, (-B + s) / (2 * A)); }
    if (t1 <= t0) return 0;
    // (under the top: the line's height is straight in t, so the part under it is one interval)
    const top = (v.at[2] || 0) + v.h, za = a[2] - top, dz = b[2] - a[2];
    if (Math.abs(dz) < 1e-12) return za < 0 ? t1 - t0 : 0;
    const tc = -za / dz;   // where the line meets the top
    if (dz > 0) t1 = Math.min(t1, tc); else t0 = Math.max(t0, tc);
    return Math.max(0, t1 - t0);
  }
  function veilThrough(a, b, veils) {
    if (!veils || !veils.length) return 0;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    let m = 0;
    for (const v of veils) if (!v.under) m += span(a, b, v) * L;
    return m;
  }
  const inUnder = (p, v) => p[0] > v.min[0] && p[0] < v.max[0] && p[1] > v.min[1] && p[1] < v.max[1] && p[2] < v.max[2];
  function veilBlocked(a, b, veils) {
    if (!veils || !veils.length) return false;
    // (a body under a crawl space's ceiling, seen from over it, outside it, beyond its near reach: hidden)
    for (const v of veils) if (v.under && inUnder(b, v) && !inUnder(a, v) && a[2] > v.max[2] && Math.hypot(b[0] - a[0], b[1] - a[1]) >= (v.near ?? UNDER_NEAR)) return true;
    let through = Infinity, near = 0, any = false;
    for (const v of veils) if (!v.under && span(a, b, v) > 0) { any = true; through = Math.min(through, v.through ?? THROUGH); near = Math.max(near, v.near ?? NEAR); }
    if (!any || Math.hypot(b[0] - a[0], b[1] - a[1]) < near) return false;
    return veilThrough(a, b, veils) >= through;
  }
  // the world's veils, from its spec: each a plain record, the malformed left out
  if (E.registerStateInit) E.registerStateInit((state, spec) => {
    const box3 = (q) => Array.isArray(q) && q.length === 3 && q.every(Number.isFinite);
    const V = Array.isArray(spec && spec.veils) ? spec.veils.filter((v) => v && (v.under ? box3(v.min) && box3(v.max) : Array.isArray(v.at) && v.at.length >= 2 && v.r > 0 && v.h > 0)) : [];
    if (V.length) state.veils = V.map((v) => (v.under ? { under: true, min: v.min.slice(), max: v.max.slice(), ...(v.near != null ? { near: v.near } : {}) }
      : { at: [v.at[0], v.at[1], v.at[2] || 0], r: v.r, h: v.h, ...(v.through != null ? { through: v.through } : {}), ...(v.near != null ? { near: v.near } : {}) }));
  });
  Object.assign(E, { veilThrough, veilBlocked });
}
