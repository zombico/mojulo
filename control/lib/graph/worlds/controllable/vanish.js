/**
 * vanish.js — DISPOSAL: how a downed body leaves the world. A body carrying `body.vanish: { is, linger, rgb? }` (a
 * gameworld's foe, gameworld/vanish.js) lies where it fell for `linger` seconds, then goes: `gone` (out of the step,
 * the solids and every mind's sight) and handed to the page's transit `out` (`e.transit`, status-channel.js) with its
 * kind and colour, which plays the fade on a ghost of its meshes. No carcass is kept.
 *
 * Wraps stepWorld, as hitstop.js does, so the pinned pipeline order is untouched. Import-free (the page runs this source
 * via toString(), compose.js); emitted only into a page whose world has a body that vanishes, so every other page keeps
 * every byte. Field ownership: e.vanishT (how long it has lain).
 */

export function buildVanish(E) {
  const step = E.stepWorld;
  E.stepWorld = function stepWithVanish(state, input, dt, hooks) {
    step(state, input, dt, hooks);
    dt = dt || 1 / 60;
    for (const e of state.entities) {
      const V = e.body && e.body.vanish;
      if (!V || !e.downed || e.gone) continue;
      e.vanishT = (e.vanishT || 0) + dt;
      if (e.vanishT + 1e-9 < (V.linger || 0)) continue;
      e.gone = true; e.moving = false; e.route = null;
      e.transit = { is: V.is, dir: 'out', t0: state.time || 0, ...(V.rgb ? { rgb: V.rgb } : {}) };
    }
    return state;
  };
}
