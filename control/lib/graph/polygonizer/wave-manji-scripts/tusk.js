/**
 * tusk — golden-spin archetype.
 *
 * Combines three independent non-repeating choices so that within a
 * finite run no two passes share an (angle, radius, plane) triple:
 *   1. phaseStep = Golden Angle (≈ 2.4 rad ≈ 137.5°) — angular position
 *      never repeats; the rotation that plants use for phyllotaxis.
 *   2. Radial growth = φ per full revolution — the literal Golden
 *      Rectangle's logarithmic spiral; each revolution multiplies the
 *      radius by φ ≈ 1.618.
 *   3. Per-pass plane precession at an irrational ratio of phaseStep —
 *      the loop plane sweeps gently through space without ever returning
 *      to a prior orientation.
 *
 * This is the printable, finite-pass analog of Araki's "infinite
 * rotation" in Steel Ball Run: every sample lands in a genuinely-new
 * configuration because no two passes share angle, radius, AND plane.
 * The bending intensity dampens the exponential radial growth, so a
 * tighter benevolent value gives a slower, more contained spiral while
 * a looser value lets the form diverge.
 *
 * Mechanism: each pass i computes
 *   radius_i = initialRadius × (growthFactor^(1/bending))^(i × phaseStep / 2π)
 *   phase_i  = i × phaseStep
 *   tilt_i   = i × phaseStep × precessionRatio
 * The basis is rotated by tilt_i around the tiltAxis (default uHat) and
 * passed to traceLoop via the `axes` override.
 *
 * Params (all optional):
 *   - initialRadius   (default 0.15)        — starting orbit
 *   - growthFactor    (default φ ≈ 1.618)   — radius multiplier per full revolution
 *   - phaseStep       (default 'golden')    — angular advance per pass; 'golden' →
 *                                             the Golden Angle (~2.4 rad), or any
 *                                             numeric override
 *   - precess         (default true)        — apply per-pass plane tilt
 *   - precessionRatio (default 1/8)         — precessionStep = phaseStep × ratio
 *   - tiltAxis        (default 'uHat')      — 'uHat', 'vHat', or {x,y,z}
 *   - passes          (default 16)          — count; overridden by spec.density
 *   - harmonics       (default [])          — optional lobed character
 */
import { GOLDEN_RATIO, GOLDEN_ANGLE, resolveAngle, rodrigues, resolveTiltAxis } from './util.js';

export function* tusk(spec, ctx) {
  const params = spec.params || {};
  const initialRadius = Number.isFinite(params.initialRadius) ? params.initialRadius : 0.15;
  const growthFactor = Number.isFinite(params.growthFactor) ? params.growthFactor : GOLDEN_RATIO;
  const phaseStep = resolveAngle(params.phaseStep, GOLDEN_ANGLE);
  const precess = params.precess === false ? false : true;
  const precessionRatio = Number.isFinite(params.precessionRatio) ? params.precessionRatio : 1 / 8;
  const precessionStep = phaseStep * precessionRatio;
  const harmonics = Array.isArray(params.harmonics) ? params.harmonics : [];
  const passes = Math.max(2, Math.floor(ctx.density ?? params.passes ?? 16));

  // Bending dampens the exponential growth. effectiveGrowth = g^(1/bending):
  // bending = 1 gives raw φ-per-revolution; bending = 2 halves the exponent
  // (slower); bending = 0.5 doubles it (wild divergence).
  const effectiveGrowth = Math.pow(Math.max(1e-9, growthFactor), 1 / Math.max(0.1, ctx.bending));
  const growthExponent = phaseStep / (2 * Math.PI);

  const tiltAxis = resolveTiltAxis(params.tiltAxis, ctx);

  for (let i = 0; i < passes; i += 1) {
    const radius = initialRadius * Math.pow(effectiveGrowth, i * growthExponent);
    const phase = i * phaseStep;
    if (precess) {
      const tiltAngle = i * precessionStep;
      const uRot = rodrigues(ctx.uHat, tiltAxis, tiltAngle);
      const vRot = rodrigues(ctx.vHat, tiltAxis, tiltAngle);
      yield ctx.traceLoop({
        radius,
        phase,
        harmonics,
        axes: { uHat: uRot, vHat: vRot },
      });
    } else {
      yield ctx.traceLoop({ radius, phase, harmonics });
    }
  }
}
