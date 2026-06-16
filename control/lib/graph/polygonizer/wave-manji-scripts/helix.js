/**
 * helix — N-fold ring stacked along an axis, with optional per-pass phase
 * advance so the trail spirals.
 *
 * Each pass emits one closed loop. The loop's CENTER translates along an
 * axis by `pitch` between passes; the loop's STARTING PHASE advances by
 * `phaseStep`. With both, the printed trail reads as a helical mandala —
 * a 6-lobed (or N-lobed) ring climbing through space while slowly rotating,
 * so consecutive lobes don't stack directly atop one another.
 *
 * The two-axis design rule from waveform-physics-design.md §5 applies in
 * a slight variant: one modulation axis is in-plane rotation (phase), the
 * other is translation along an out-of-plane axis (pitch). Two
 * independent per-pass modulations escape flatness without needing a
 * second plane rotation.
 *
 * Params (all optional):
 *   - N           (default 6)            — symmetry order (cosine harmonic)
 *   - radius      (default 1.0)          — loop radius
 *   - lobeDepth   (default 0.15)         — N-cosine harmonic amplitude
 *   - pitch       (default 0.1)          — center translation per pass
 *                                          (world units; scaled by 1/bending)
 *   - phaseStep   (default 0)            — per-pass phase advance in radians;
 *                                          accepts 'golden' for the Golden Angle
 *   - axis        (default ctx.planeNormal) — translation direction;
 *                                          accepts 'normal' | 'uHat' | 'vHat'
 *                                          | {x,y,z} unit vector
 *   - passes      (default 24)           — count; overridden by spec.density
 *
 * Composition examples this enables (no kernel changes needed, just
 * different params):
 *   - Spring / coil  → N=0 or lobeDepth=0 (smooth circle, no lobes)
 *   - Drill bit      → growing radius (use harmonics with mixed orders)
 *   - DNA strand     → two helix wave-manji on the same singularity with
 *                      opposite phaseStep signs
 */
import { resolveAngle } from './util.js';

export function* helix(spec, ctx) {
  const params = spec.params || {};
  const N = Math.max(0, Math.floor(params.N ?? 6));
  const radius = Number.isFinite(params.radius) ? params.radius : 1.0;
  const lobeDepth = Number.isFinite(params.lobeDepth) ? params.lobeDepth : 0.15;
  const declaredPitch = Number.isFinite(params.pitch) ? params.pitch : 0.1;
  // Bending damps pitch: tighter bending = more compressed coil, looser
  // bending = stretched-out helix. Mirrors how bending caps radial growth
  // in rasengan/tusk.
  const pitch = declaredPitch / Math.max(0.1, ctx.bending);
  const phaseStep = resolveAngle(params.phaseStep, 0);
  const passes = Math.max(2, Math.floor(ctx.density ?? params.passes ?? 24));

  const axis = resolveAxis(params.axis, ctx);

  // Build harmonics only when both N > 0 and lobeDepth > 0; an N=0 helix
  // with no lobes is a smooth spring/coil.
  const harmonics = N > 0 && lobeDepth !== 0
    ? [{ n: N, amplitude: lobeDepth }]
    : [];

  // Center the stack on the singularity: first pass at -extent/2, last at
  // +extent/2 along `axis`. Same convention rasengan-sphere uses for its
  // tilt sweep — the singularity is the midpoint of the run, not the start.
  const extent = pitch * (passes - 1);
  const start = -extent / 2;

  for (let i = 0; i < passes; i += 1) {
    const dist = start + i * pitch;
    const centerOffset = {
      x: axis.x * dist,
      y: axis.y * dist,
      z: axis.z * dist,
    };
    yield ctx.traceLoop({
      radius,
      phase: i * phaseStep,
      harmonics,
      centerOffset,
    });
  }
}

function resolveAxis(declared, ctx) {
  if (declared === 'uHat') return ctx.uHat;
  if (declared === 'vHat') return ctx.vHat;
  if (declared === 'normal') return ctx.planeNormal;
  if (declared && typeof declared === 'object'
    && Number.isFinite(declared.x) && Number.isFinite(declared.y) && Number.isFinite(declared.z)) {
    const len = Math.hypot(declared.x, declared.y, declared.z);
    if (len < 1e-12) return ctx.planeNormal;
    return { x: declared.x / len, y: declared.y / len, z: declared.z / len };
  }
  return ctx.planeNormal;
}
