/**
 * smoke-ring — toroidal: cross-section loops swept around a main ring.
 *
 * Each pass emits one cross-section loop. Pass i sits at angle θ_i =
 * 2πi/N on the main ring (radius `mainRadius` in the spec's plane),
 * with its own (radial, planeNormal) basis perpendicular to the main
 * ring's tangent at θ_i. The cross-section radius is `tubeRadius`.
 *
 * Bending compresses the tube: stronger bending → smaller tubeRadius
 * relative to mainRadius, so the ring reads as a tighter band.
 *
 * Params (all optional):
 *   - N           (default 24)  — cross-section count around the ring
 *   - mainRadius  (default 1.0) — main ring radius
 *   - tubeRadius  (default 0.2) — cross-section radius (scaled by 1/bending)
 *   - phase       (default 0)   — angular offset around the main ring
 */
export function* smokeRing(spec, ctx) {
  const params = spec.params || {};
  const N = Math.max(4, Math.floor(params.N ?? 24));
  const mainRadius = Number.isFinite(params.mainRadius) ? params.mainRadius : 1.0;
  const declaredTube = Number.isFinite(params.tubeRadius) ? params.tubeRadius : 0.2;
  const tubeRadius = declaredTube / Math.max(0.1, ctx.bending);
  const basePhase = Number.isFinite(params.phase) ? params.phase : 0;
  for (let i = 0; i < N; i += 1) {
    const theta = basePhase + (2 * Math.PI * i) / N;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    // Center of this cross-section: on the main ring in the spec's plane.
    const centerOffset = {
      x: mainRadius * (cosT * ctx.uHat.x + sinT * ctx.vHat.x),
      y: mainRadius * (cosT * ctx.uHat.y + sinT * ctx.vHat.y),
      z: mainRadius * (cosT * ctx.uHat.z + sinT * ctx.vHat.z),
    };
    // Cross-section basis: radial outward × the spec's plane normal.
    // (Tangent to the main ring is -sin·u + cos·v; the cross-section
    // plane is perpendicular to that, so its basis is the radial and
    // the spec's plane normal.)
    const radial = {
      x: cosT * ctx.uHat.x + sinT * ctx.vHat.x,
      y: cosT * ctx.uHat.y + sinT * ctx.vHat.y,
      z: cosT * ctx.uHat.z + sinT * ctx.vHat.z,
    };
    yield ctx.traceLoop({
      radius: tubeRadius,
      centerOffset,
      axes: { uHat: radial, vHat: ctx.planeNormal },
    });
  }
}
