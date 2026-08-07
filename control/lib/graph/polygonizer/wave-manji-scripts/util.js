/**
 * Shared utilities for wave manji scripts.
 *
 * Math constants tied to the Spin framing in waveform-physics-design.md
 * Section 4 (golden ratio, golden angle), the named-angle resolver that
 * lets any spinning archetype opt into `phaseStep: 'golden'`, and the
 * Rodrigues rotation helper used by scripts that tilt the loop basis
 * per pass (rasengan-sphere, tusk).
 */

// φ ≈ 1.618033988749895 — the Golden Ratio.
export const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

// The Golden Angle: 2π × (1 − 1/φ) ≈ 2.399963229728653 rad ≈ 137.50776°.
// Maximally-non-repeating angular distribution — what plants use for
// phyllotaxis and what Steel Ball Run's "Golden Spin" abstracts to.
export const GOLDEN_ANGLE = 2 * Math.PI * (1 - 1 / GOLDEN_RATIO);

/**
 * Resolve an angle value that may be a number or a named constant.
 * Recognized names: 'golden' → the Golden Angle. Anything else falls
 * back to the provided default.
 */
export function resolveAngle(value, fallback) {
  if (value === 'golden') return GOLDEN_ANGLE;
  if (Number.isFinite(value)) return value;
  return fallback;
}

/**
 * Rodrigues' rotation formula. Rotate vector `v` around unit axis `k`
 * by angle `theta`:
 *   v_rot = v·cos θ + (k × v)·sin θ + k·(k · v)·(1 − cos θ)
 */
export function rodrigues(v, k, theta) {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const dot = k.x * v.x + k.y * v.y + k.z * v.z;
  const crossX = k.y * v.z - k.z * v.y;
  const crossY = k.z * v.x - k.x * v.z;
  const crossZ = k.x * v.y - k.y * v.x;
  const oneMinusCos = 1 - cosT;
  return {
    x: v.x * cosT + crossX * sinT + k.x * dot * oneMinusCos,
    y: v.y * cosT + crossY * sinT + k.y * dot * oneMinusCos,
    z: v.z * cosT + crossZ * sinT + k.z * dot * oneMinusCos,
  };
}

/**
 * Stable vector normalize. Returns a unit-z fallback when the input has
 * near-zero magnitude, so downstream math doesn't NaN.
 */
export function normalize3(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-12) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/**
 * Resolve a tilt-axis spec used by precessing archetypes
 * (rasengan-sphere, tusk). Accepts 'uHat', 'vHat', or an explicit
 * {x,y,z} unit vector. Falls back to ctx.uHat — the in-plane axis that
 * tilts vHat into the planeNormal direction (the classic disc-to-lens
 * precession).
 */
export function resolveTiltAxis(declared, ctx) {
  if (declared === 'vHat') return ctx.vHat;
  if (declared && typeof declared === 'object'
    && Number.isFinite(declared.x) && Number.isFinite(declared.y) && Number.isFinite(declared.z)) {
    return normalize3(declared);
  }
  return ctx.uHat;
}
