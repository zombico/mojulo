/**
 * mandala — N-fold rotational symmetry of a harmonic-shaped loop.
 *
 * Same radius across all passes; each pass rotates the start phase by
 * 2π/N. The visual N-fold symmetry comes from harmonic content baked
 * into the loop — without harmonics every pass overlaps perfectly, so
 * the spec defaults to a single n=N cosine harmonic which carves the
 * loop into N evenly-spaced lobes that align across passes.
 *
 * Params (all optional):
 *   - N           (default 6)    — fold symmetry
 *   - radius      (default 1.0)  — orbit radius
 *   - lobeDepth   (default 0.15) — depth of the harmonic lobes
 *   - phase       (default 0)    — angular offset of the whole figure
 */
export function* mandala(spec, ctx) {
  const params = spec.params || {};
  const N = Math.max(2, Math.floor(params.N ?? 6));
  const radius = Number.isFinite(params.radius) ? params.radius : 1.0;
  const lobeDepth = Number.isFinite(params.lobeDepth) ? params.lobeDepth : 0.15;
  const basePhase = Number.isFinite(params.phase) ? params.phase : 0;
  const harmonics = [{ n: N, amplitude: lobeDepth, phase: 0 }];
  for (let i = 0; i < N; i += 1) {
    const phase = basePhase + (2 * Math.PI * i) / N;
    yield ctx.traceLoop({ radius, phase, harmonics });
  }
}
