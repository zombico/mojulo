/**
 * Measurements read off a classical run's samples (kernel.js `run`): the numbers the closed-form gates compare and
 * the `observe` readouts report. Each reads only the recorded samples, interpolating between them, so what is measured
 * is what the page plays.
 */

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const at = (run, k, i) => [run.x[k][3 * i], run.x[k][3 * i + 1], run.x[k][3 * i + 2]];
export const vel = (run, k, i) => [run.v[k][3 * i], run.v[k][3 * i + 1], run.v[k][3 * i + 2]];

/** A body's position (or velocity) projected on an axis, sampled: [value per sample]. */
export const along = (run, i, axis, { velocity = false } = {}) => run.t.map((t, k) => dot(velocity ? vel(run, k, i) : at(run, k, i), axis));

/**
 * The period of an oscillating series: the mean spacing of its upward crossings of the midline, each crossing time
 * interpolated linearly between samples. Null with fewer than two crossings.
 */
export function period(series, t) {
  let lo = Infinity, hi = -Infinity;
  for (const s of series) { if (s < lo) lo = s; if (s > hi) hi = s; }
  if (!(hi > lo)) return null;
  const mid = (lo + hi) / 2, ups = [];
  for (let k = 1; k < series.length; k++) {
    const a = series[k - 1] - mid, b = series[k] - mid;
    if (a < 0 && b >= 0) ups.push(t[k - 1] + (t[k] - t[k - 1]) * (a / (a - b)));
  }
  return ups.length < 2 ? null : (ups[ups.length - 1] - ups[0]) / (ups.length - 1);
}

/** The highest value of a series, refined by a parabola through the peak sample and its neighbours. */
export function peak(series) {
  let k = 0;
  for (let j = 1; j < series.length; j++) if (series[j] > series[k]) k = j;
  if (k === 0 || k === series.length - 1) return series[k];
  const a = series[k - 1], b = series[k], c = series[k + 1], den = a - 2 * b + c;
  return den < 0 ? b - ((a - c) * (a - c)) / (8 * den) : b;
}

/**
 * Where a launched body comes back down to its launch height: the horizontal distance from the start, the crossing
 * interpolated between samples. Null if it never comes back down within the run.
 */
export function returnRange(run, i, up) {
  const h = along(run, i, up), h0 = h[0];
  let top = 0;
  for (let k = 1; k < h.length; k++) if (h[k] > h[top]) top = k;
  for (let k = Math.max(top, 1); k < h.length; k++) {
    if (h[k - 1] > h0 && h[k] <= h0) {
      const f = (h[k - 1] - h0) / (h[k - 1] - h[k]);
      const p = [0, 1, 2].map((c) => at(run, k - 1, i)[c] + f * (at(run, k, i)[c] - at(run, k - 1, i)[c]));
      const d = [0, 1, 2].map((c) => p[c] - at(run, 0, i)[c]);
      const dv = dot(d, up);
      return Math.hypot(d[0] - dv * up[0], d[1] - dv * up[1], d[2] - dv * up[2]);
    }
  }
  return null;
}

export const speed = (run, k, i) => Math.hypot(...vel(run, k, i));
