/**
 * pose-env — the piecewise-linear envelope helper for phase-scripted pose clips.
 *
 * env(p, pts) — envelope over keyframes [phase, value]; the authoring idiom
 * shared by unit-rig's clip shelf (stagger/topple/getup, the gaits) AND the
 * mobile-suit pack's swing shelf (mobile-suit/unit-swings.js). A LEAF module on
 * purpose: unit-rig loads the pack shelf through a guarded top-level await, and
 * the shelf importing anything back out of unit-rig would deadlock that await
 * (circular TLA — both modules waiting on each other to finish evaluating).
 * Both sides import env from here instead. pts must be phase-sorted; p clamps
 * to the endpoints.
 */
export const env = (p, pts) => {
  if (p <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i += 1) {
    if (p <= pts[i][0]) {
      const [t0, v0] = pts[i - 1], [t1, v1] = pts[i];
      return v0 + (v1 - v0) * ((p - t0) / ((t1 - t0) || 1));
    }
  }
  return pts[pts.length - 1][1];
};
