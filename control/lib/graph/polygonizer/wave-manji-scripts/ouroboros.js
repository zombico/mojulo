/**
 * ouroboros — single closed loop, zero modulation.
 *
 * The base case for wave manji. One full revolution at the chosen radius,
 * in the chosen plane, around the singularity. Bending intensity is
 * irrelevant here — the loop is the loop; there is no equilibrium math
 * because there is no expansion to balance against.
 *
 * Params (all optional):
 *   - radius (default 1.0) — orbit radius in world units
 *   - phase  (default 0)   — angular offset of the start point
 */
export function* ouroboros(spec, ctx) {
  const params = spec.params || {};
  const radius = Number.isFinite(params.radius) ? params.radius : 1.0;
  const phase = Number.isFinite(params.phase) ? params.phase : 0;
  yield ctx.traceLoop({ radius, phase });
}
