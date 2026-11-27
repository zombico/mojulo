/**
 * keying.js — KEYING IN PLAY: a live world's bodies drawn on twos or threes (limited animation), the world, their places
 * and the camera on ones. The live sibling of a shot's grain (shoot/time.js), which a rendered film steps ahead of time:
 * here each animated body (a rig, a baked figure) is posed on its layer's key and holds that pose between keys.
 *
 *   manifest.keying: 'ones' | 'twos' | 'threes' | 1 | 2 | 3                       every layer on that grain
 *                  | { hero?, cast?, fps?, root? }                                a layer each
 *     hero    the body the player pilots                                         ones | twos | threes (absent: cast's)
 *     cast    every other animated body                                          ones | twos | threes (absent: ones)
 *     fps     the drawings a second the grain counts in (12 … 60, 24: film's)
 *     root    'held': a body's place and heading stepped with its pose (the old cartoon's stride); absent, they run on
 *             ones and only the pose holds
 *
 *   readKeying(raw)  → { hero, cast, fps, root? } (grains 1 | 2 | 3), or null where every layer is on ones; throws
 *                      naming what it takes
 *   keyClock(K)      → { step(dt) → { hero: bool, cast: bool } }   the page's clock: is each layer on its key this
 *                      frame. Steps on the screen's clock (the real dt), so a world slowed by the world clock is still
 *                      drawn at the grain's pace; the remainder carried, so 60 frames a second on twos keys 12 times.
 *
 * Presentation, not simulation: the world steps as it did. Import-free (the page runs keyClock's source via toString(),
 * scene/channels/controllable/index.js); emitted only into a page whose world says `keying`.
 */
export const KEY_GRAINS = Object.freeze({ ones: 1, twos: 2, threes: 3, 1: 1, 2: 2, 3: 3 });
export const KEY_FPS = Object.freeze({ min: 12, max: 60, rest: 24 });
export const KEY_LAYERS = Object.freeze(['hero', 'cast']);

const grainOf = (v, at) => {
  const g = KEY_GRAINS[String(v).toLowerCase()];
  if (!g) throw new Error(`keying: ${at} is ones, twos or threes (1, 2, 3); '${v}' is none`);
  return g;
};

/** A world's keying read (see the header): null where nothing is keyed. */
export function readKeying(raw) {
  if (raw === undefined || raw === null || raw === false) return null;
  if (typeof raw === 'string' || typeof raw === 'number') {
    const g = grainOf(raw, 'keying');
    return g > 1 ? { hero: g, cast: g, fps: KEY_FPS.rest } : null;
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('keying: a grain (ones | twos | threes) or { hero?, cast?, fps?, root? }');
  const extra = Object.keys(raw).filter((k) => !['hero', 'cast', 'fps', 'root'].includes(k));
  if (extra.length) throw new Error(`keying: ${extra.join(', ')} is not a key (hero, cast, fps, root)`);
  const cast = raw.cast == null ? 1 : grainOf(raw.cast, 'cast');
  const hero = raw.hero == null ? cast : grainOf(raw.hero, 'hero');
  let fps = KEY_FPS.rest;
  if (raw.fps != null) {
    if (!(typeof raw.fps === 'number' && Number.isFinite(raw.fps) && raw.fps >= KEY_FPS.min && raw.fps <= KEY_FPS.max)) throw new Error(`keying: fps is a number ${KEY_FPS.min}–${KEY_FPS.max}`);
    fps = raw.fps;
  }
  if (raw.root != null && raw.root !== 'held' && raw.root !== 'ones') throw new Error(`keying: root is 'held' or 'ones'; '${raw.root}' is none`);
  if (hero === 1 && cast === 1) return null;
  return { hero, cast, fps, ...(raw.root === 'held' ? { root: 'held' } : {}) };
}

/** The page's key clock for a read keying K (see the header). Import-free. */
export function keyClock(K) {
  const steps = { hero: K.hero / K.fps, cast: K.cast / K.fps };
  const acc = { hero: steps.hero, cast: steps.cast };   // (the first frame is a key: a body is posed as the page opens)
  return {
    step(dt) {
      const due = { hero: true, cast: true };
      for (const L of ['hero', 'cast']) {
        if (K[L] <= 1) continue;
        acc[L] += dt > 0 ? dt : 0;
        if (acc[L] + 1e-9 < steps[L]) { due[L] = false; continue; }
        acc[L] -= steps[L];
        if (acc[L] >= steps[L]) acc[L] %= steps[L];   // (a long frame keys once and drops the backlog)
      }
      return due;
    },
  };
}
