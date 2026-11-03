// hero-throw-words — the words a throw's or a catch's keys are written in (a leaf: hero-throw.js and hero-catch.js read
// them at load, and the gear's import chain comes back round through the hero's motions to both)
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const unit = (a) => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
/** a hand's place: [landmark, [right, toward, up] m] */
export const at = (lm, d) => ({ lm, d });
// fingers' way and palm's, in the thrower's frame (+x right, +y the target, +z up)
export const UP = [0, 0, 1], FWD = [0, 1, 0], BACK = [0, -1, 0], DOWN = [0, 0, -1], RIGHT = [1, 0, 0], LEFT = [-1, 0, 0];
/** directions summed and made a unit */
export const mix = (...v) => unit(v.reduce((a, b) => add(a, b), [0, 0, 0]));
