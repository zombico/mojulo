/**
 * rasengan-sphere — rasengan with per-pass plane precession.
 *
 * Same radial expansion + phase rotation as the flat rasengan, plus an
 * incremental tilt of the loop basis around an in-plane axis. The
 * singularity stays fixed; only the (uHat, vHat) basis rotates per pass,
 * so successive loops sit in progressively tilted planes that all share
 * the same center.
 *
 * Default `tiltAxis = uHat` and `totalTilt = π` sweep the loop plane
 * through a half-revolution, producing a lens / lemon-shaped fill that
 * reads as a 3D rasengan ball. Set `totalTilt = 2π` for a full sweep
 * (loops return to original orientation), or any value in between for a
 * partial-cap form.
 *
 * Mechanism: each pass i derives a rotation angle θ_i = i × (totalTilt /
 * passes) and rotates (uHat, vHat) around `tiltAxis` by θ_i using
 * Rodrigues' formula. The rotated basis is passed to traceLoop via the
 * `axes` override.
 *
 * Params (all optional):
 *   - initialRadius (default 0.1)        — starting orbit
 *   - maxRadius     (default 1.0)        — outer bound (scaled by 1/bending)
 *   - phaseStep     (default 0.45 rad)   — phase increment per pass; accepts
 *                                          'golden' for the Golden Angle
 *   - totalTilt     (default π rad)      — total plane sweep across all passes
 *   - tiltAxis      (default 'uHat')     — 'uHat', 'vHat', or {x,y,z} unit vector
 *   - passes        (default 40)         — count, overridden by spec.density
 *   - harmonics     (default [])         — optional lobed character
 */
import { resolveAngle, rodrigues, resolveTiltAxis } from './util.js';

export function* rasenganSphere(spec, ctx) {
  const params = spec.params || {};
  const initialRadius = Number.isFinite(params.initialRadius) ? params.initialRadius : 0.1;
  const declaredMax = Number.isFinite(params.maxRadius) ? params.maxRadius : 1.0;
  const maxRadius = declaredMax / Math.max(0.1, ctx.bending);
  const phaseStep = resolveAngle(params.phaseStep, 0.45);
  const totalTilt = Number.isFinite(params.totalTilt) ? params.totalTilt : Math.PI;
  const harmonics = Array.isArray(params.harmonics) ? params.harmonics : [];
  const passes = Math.max(2, Math.floor(ctx.density ?? params.passes ?? 40));
  const tiltAxis = resolveTiltAxis(params.tiltAxis, ctx);

  for (let i = 0; i < passes; i += 1) {
    const t = passes <= 1 ? 1 : i / (passes - 1);
    const radius = initialRadius + (maxRadius - initialRadius) * t;
    const phase = i * phaseStep;
    const tiltAngle = (totalTilt * i) / passes;
    const uRot = rodrigues(ctx.uHat, tiltAxis, tiltAngle);
    const vRot = rodrigues(ctx.vHat, tiltAxis, tiltAngle);
    yield ctx.traceLoop({
      radius,
      phase,
      harmonics,
      axes: { uHat: uRot, vHat: vRot },
    });
  }
}
