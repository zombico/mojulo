// THE JOBS' MOTION — the timings a city job's moments are played to on the page, shared by the bodies that move
// (scene/channels/cab-pool.js `gate`: a garbage truck's bin lifter and tailgate) and the things at a job's stops
// (scene/channels/job-stops.js: the bins, a passenger, a parcel), so a bin and the lifter that tips it keep time.
// Each moment runs `s` seconds from when it is started (the page's clock, performance.now() / 1000); `env(u)` its shape
// over u in [0, 1]: rising over `up`, held, falling over `down`, eased. Pure and import-free (the page runs its source).
//
//   lift     the bin lifter at a stop: the bin rolled to the truck's back, swung up the tailgate and tipped in, shaken,
//            set down and rolled back to its kerb; `a` the lifter's swing (radians about its pivot, the comb up and over)
//   tip      the tailgate swung up at the depot as a round is paid: the load let out
//   fare     a passenger walking to the car's door and in (`in`), or out and away (`out`), at `walk` m/s
//   parcel   a parcel's arc from the hero to the door it is handed in at, `h` metres high at its top
export const JOB_MOTION = Object.freeze({
  lift: Object.freeze({ s: 3.6, a: -2.3, roll: 0.22, up: Object.freeze([0.25, 0.48]), down: Object.freeze([0.62, 0.78]), shake: 0.06 }),
  tip: Object.freeze({ s: 4.5, up: Object.freeze([0, 0.3]), down: Object.freeze([0.72, 1]) }),
  fare: Object.freeze({ walk: 1.5, fade: 0.4 }),
  parcel: Object.freeze({ s: 0.9, h: 1.6 }),
});

/** A moment's shape at u: 0 before `up`, rising over it, 1 held, falling over `down`, 0 after; eased in and out. */
export function jobEnv(u, up, down) {
  const ease = (t) => t * t * (3 - 2 * t), at = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a || 1)));
  if (u <= up[0] || u >= down[1]) return 0;
  return u < up[1] ? ease(at(u, up[0], up[1])) : u > down[0] ? 1 - ease(at(u, down[0], down[1])) : 1;
}
