// THE JOBS' MOTION — the timings a city job's moments are played to on the page (scene/channels/cab-pool.js `gate`: a
// garbage truck's tailgate swung up as its load is emptied, started by scene/channels/job-stops.js). Each moment runs `s`
// seconds from when it is started (the page's clock, performance.now() / 1000); `jobEnv(u)` its shape over u in [0, 1]:
// rising over `up`, held, falling over `down`, eased. Pure and import-free (the page runs its source).
//
//   tip      the tailgate swung up as a load is emptied at the dump
export const JOB_MOTION = Object.freeze({
  tip: Object.freeze({ s: 4.5, up: Object.freeze([0, 0.3]), down: Object.freeze([0.72, 1]) }),
});

/** A moment's shape at u: 0 before `up`, rising over it, 1 held, falling over `down`, 0 after; eased in and out. */
export function jobEnv(u, up, down) {
  const ease = (t) => t * t * (3 - 2 * t), at = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a || 1)));
  if (u <= up[0] || u >= down[1]) return 0;
  return u < up[1] ? ease(at(u, up[0], up[1])) : u > down[0] ? 1 - ease(at(u, down[0], down[1])) : 1;
}
