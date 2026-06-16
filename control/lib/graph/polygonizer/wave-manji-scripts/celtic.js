/**
 * celtic — (p, q) torus knot, one continuous closed curve.
 *
 * Standard torus-knot parameterization:
 *   ρ(t) = R + r·cos(p·t)
 *   x(t) = ρ·cos(q·t)
 *   y(t) = ρ·sin(q·t)
 *   z(t) = r·sin(p·t)
 *
 * For coprime p, q the curve closes after one full t ∈ [0, 2π], winding
 * q times around the central axis (the singularity-plane-normal) and p
 * times around the tube. Different (p, q) pairs are the endless / Celtic
 * / Tibetan-knot family.
 *
 * Unlike the iterative archetypes, celtic emits a single polyline at
 * high sample density — the knot is one curve, not a stream of loops.
 *
 * Params (all optional):
 *   - p       (default 2)   — windings around the tube
 *   - q       (default 3)   — windings around the central axis
 *   - R       (default 0.7) — main radius (in spec's plane)
 *   - r       (default 0.3) — tube radius (scales by 1/bending)
 *   - samples (default 256) — polyline resolution
 */
export function* celtic(spec, ctx) {
  const params = spec.params || {};
  const p = Math.max(1, Math.floor(params.p ?? 2));
  const q = Math.max(1, Math.floor(params.q ?? 3));
  const R = Number.isFinite(params.R) ? params.R : 0.7;
  const declaredR = Number.isFinite(params.r) ? params.r : 0.3;
  const r = declaredR / Math.max(0.1, ctx.bending);
  const N = Math.max(64, Math.floor(params.samples ?? 256));
  const out = new Array(N + 1);
  for (let i = 0; i <= N; i += 1) {
    const t = (i / N) * Math.PI * 2;
    const rho = R + r * Math.cos(p * t);
    const localU = rho * Math.cos(q * t);
    const localV = rho * Math.sin(q * t);
    const localN = r * Math.sin(p * t);
    out[i] = {
      x: ctx.singularity.x + localU * ctx.uHat.x + localV * ctx.vHat.x + localN * ctx.planeNormal.x,
      y: ctx.singularity.y + localU * ctx.uHat.y + localV * ctx.vHat.y + localN * ctx.planeNormal.y,
      z: ctx.singularity.z + localU * ctx.uHat.z + localV * ctx.vHat.z + localN * ctx.planeNormal.z,
    };
  }
  yield out;
}
