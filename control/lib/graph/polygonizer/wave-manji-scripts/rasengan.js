/**
 * rasengan — outward spiral expansion with phase rotation per pass.
 *
 * Radius grows linearly from initialRadius to a bending-limited
 * maxRadius across `passes` revolutions; phase advances by phaseStep
 * each pass so the spiral arms read as rotating around the singularity.
 *
 * Bending intensity caps the spiral's outer reach: tighter bending →
 * smaller equilibrium radius. The benevolent default places the wave
 * in a stable basin where the spiral is visible without dispersing.
 *
 * Params (all optional):
 *   - initialRadius (default 0.1)        — starting orbit
 *   - maxRadius     (default 1.0)        — outer bound (scaled by 1/bending)
 *   - phaseStep     (default 0.45 rad)   — phase increment per pass; accepts
 *                                          the string 'golden' for the Golden
 *                                          Angle (~2.4 rad), which gives a
 *                                          non-repeating angular distribution
 *   - passes        (default 30)         — count, overridden by spec.density if set
 *   - harmonics     (default [])         — optional lobed character
 */
import { resolveAngle } from './util.js';

export function* rasengan(spec, ctx) {
  const params = spec.params || {};
  const initialRadius = Number.isFinite(params.initialRadius) ? params.initialRadius : 0.1;
  const declaredMax = Number.isFinite(params.maxRadius) ? params.maxRadius : 1.0;
  const maxRadius = declaredMax / Math.max(0.1, ctx.bending);
  const phaseStep = resolveAngle(params.phaseStep, 0.45);
  const harmonics = Array.isArray(params.harmonics) ? params.harmonics : [];
  const passes = Math.max(2, Math.floor(ctx.density ?? params.passes ?? 30));
  for (let i = 0; i < passes; i += 1) {
    const t = passes <= 1 ? 1 : i / (passes - 1);
    const radius = initialRadius + (maxRadius - initialRadius) * t;
    const phase = i * phaseStep;
    yield ctx.traceLoop({ radius, phase, harmonics });
  }
}
