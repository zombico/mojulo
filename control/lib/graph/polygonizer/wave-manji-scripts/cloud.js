/**
 * cloud — stochastic outward expansion with growing harmonic content.
 *
 * Each pass enlarges the radius slightly, deepens the per-sample
 * perturbation, and intensifies a small set of high-order harmonics.
 * Bending damps the perturbation (stronger bending = tighter, less
 * dispersed cloud).
 *
 * The harmonic phases are drawn from the wave manji's seeded PRNG, so
 * the same seed reproduces the same cloud across renders while differing
 * seeds (or no seed) give distinct cloud instances.
 *
 * Params (all optional):
 *   - initialRadius     (default 0.2)
 *   - maxRadius         (default 1.5)
 *   - perturbAmplitude  (default 0.08)
 *   - harmonicStrength  (default 0.05)
 *   - passes            (default 24)  — overridden by spec.density if set
 */
export function* cloud(spec, ctx) {
  const params = spec.params || {};
  const initialRadius = Number.isFinite(params.initialRadius) ? params.initialRadius : 0.2;
  const maxRadius = Number.isFinite(params.maxRadius) ? params.maxRadius : 1.5;
  const perturbAmplitude = Number.isFinite(params.perturbAmplitude) ? params.perturbAmplitude : 0.08;
  const harmonicStrength = Number.isFinite(params.harmonicStrength) ? params.harmonicStrength : 0.05;
  const passes = Math.max(2, Math.floor(ctx.density ?? params.passes ?? 24));
  const damp = Math.max(0.1, ctx.bending);
  for (let i = 0; i < passes; i += 1) {
    const t = i / (passes - 1);
    const radius = initialRadius + (maxRadius - initialRadius) * t;
    const perturb = (perturbAmplitude * t) / damp;
    const harmonics = [
      { n: 3,  amplitude: harmonicStrength * t,        phase: ctx.rand() * Math.PI * 2 },
      { n: 5,  amplitude: harmonicStrength * t * 0.5,  phase: ctx.rand() * Math.PI * 2 },
      { n: 11, amplitude: harmonicStrength * t * 0.25, phase: ctx.rand() * Math.PI * 2 },
    ];
    yield ctx.traceLoop({ radius, harmonics, perturb });
  }
}
