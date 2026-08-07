/**
 * Motion — easing + interpolation primitives.
 *
 * Consolidates the curve helpers that were copy-pasted across the 0609 motion
 * spikes (turntable, flythrough, bullet-time, walk, drag, idle): smootherstep,
 * Catmull-Rom, channel interpolation, vector lerp. Pure functions, no deps —
 * the reusable channel-math the model shouldn't re-derive per shot.
 */

export const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** smoothstep — ease in/out, C1. The spikes' `smooth`. */
export const smooth = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** smootherstep — ease in/out, C2 (zero velocity AND acceleration at ends). */
export const smoother = (t) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/** Scalar linear interpolation. */
export const lerp = (a, b, t) => a + (b - a) * t;

/** 3-vector ([x,y,z]) linear interpolation. */
export const lerp3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/**
 * Catmull-Rom interpolation of a single segment given the 4 control values
 * (a = before, b = start, c = end, d = after) and local t in [0,1]. C1-continuous
 * through the keys — no stall at each key, unlike piecewise-smoothstep.
 */
export const catmullRom = (a, b, c, d, t) => {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * b +
      (-a + c) * t +
      (2 * a - 5 * b + 4 * c - d) * t2 +
      (-a + 3 * b - 3 * c + d) * t3)
  );
};

/**
 * Sample a Catmull-Rom spline through `arr` at global parameter `u` in
 * [0, arr.length - 1]. Endpoints are clamped (duplicated) so the curve starts
 * and ends at the first/last key.
 */
export const crChannel = (arr, u) => {
  if (arr.length === 1) return arr[0];
  const seg = Math.min(Math.floor(u), arr.length - 2);
  const t = u - seg;
  const i0 = Math.max(0, seg - 1);
  const i3 = Math.min(arr.length - 1, seg + 2);
  return catmullRom(arr[i0], arr[seg], arr[seg + 1], arr[i3], t);
};

/**
 * `drag` — a damped-spring follow over a time series (the 0609 drag-chain
 * primitive). A massless point chases each sample of `series`; underdamped
 * (`c < 2√k`) it overshoots and settles — the math of follow-through / overlapping
 * action. Run it down a chain (each output drives the next) for a propagating
 * whip. Pure; returns a new array.
 * @param {number[]} series  the driver channel, one value per frame
 * @param {number} k  stiffness (how hard it's pulled toward the driver)
 * @param {number} c  damping (how fast the overshoot settles)
 */
export const drag = (series, k, c) => {
  const out = [];
  let x = series[0] ?? 0;
  let v = 0;
  for (const target of series) {
    v += k * (target - x) - c * v;
    x += v;
    out.push(x);
  }
  return out;
};

/**
 * Cyclic `drag` for looping motion: runs the spring over `reps` repeats of the
 * series and returns the last (steady-state) cycle, so the lag is periodic and
 * the loop seam is clean. Falls back to plain `drag` when `reps <= 1`.
 */
export const dragCyclic = (series, k, c, reps = 3) => {
  if (reps <= 1) return drag(series, k, c);
  const n = series.length;
  const repeated = [];
  for (let r = 0; r < reps; r++) repeated.push(...series);
  return drag(repeated, k, c).slice((reps - 1) * n);
};
