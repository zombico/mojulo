/**
 * wind-chime — angular partition into N sub-loops arranged radially.
 *
 * Each pass draws a small loop whose center sits on a circle of radius
 * `centerRadius` around the singularity, at angle 2πi/N. All sub-loops
 * share the wave manji's plane (a "flower" arrangement rather than the
 * literal hanging-bell geometry — true vertical hangers would need
 * per-pass plane changes which is what smoke-ring uses).
 *
 * Params (all optional):
 *   - N            (default 8)   — number of hanging slots
 *   - centerRadius (default 1.0) — distance from singularity to each slot center
 *   - subRadius    (default 0.2) — radius of each small loop
 *   - phase        (default 0)   — angular offset of the slot ring
 */
export function* windChime(spec, ctx) {
  const params = spec.params || {};
  const N = Math.max(2, Math.floor(params.N ?? 8));
  const centerRadius = Number.isFinite(params.centerRadius) ? params.centerRadius : 1.0;
  const subRadius = Number.isFinite(params.subRadius) ? params.subRadius : 0.2;
  const basePhase = Number.isFinite(params.phase) ? params.phase : 0;
  for (let i = 0; i < N; i += 1) {
    const theta = basePhase + (2 * Math.PI * i) / N;
    const cx = Math.cos(theta) * centerRadius;
    const cy = Math.sin(theta) * centerRadius;
    const centerOffset = {
      x: cx * ctx.uHat.x + cy * ctx.vHat.x,
      y: cx * ctx.uHat.y + cy * ctx.vHat.y,
      z: cx * ctx.uHat.z + cy * ctx.vHat.z,
    };
    yield ctx.traceLoop({ radius: subRadius, centerOffset });
  }
}
