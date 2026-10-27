/**
 * vanish.js — DISPOSAL: how a downed body leaves the world. A body carrying `body.vanish: { is, linger, die?, rgb? }` (a
 * gameworld's foe, gameworld/vanish.js) dies in its game's register, lies where it fell for `linger` seconds, then goes:
 * `gone` (out of the step, the solids and every mind's sight) and handed to the page's transit `out` (`e.transit`,
 * status-channel.js) with its kind and colour, which plays the fade on a ghost of its meshes. No carcass is kept.
 *
 *   die   fall     (default) it falls where it was struck (its own fall clip) and lies
 *         launch   the blow is the verb (an action game's): thrown back along the blow, off the ground, and lies where it
 *                  lands; its linger counts from the landing
 *
 * A platformer's squash and a pinball's pop are kinds of going (`is`), played by the page at once.
 *
 * Wraps stepWorld, as hitstop.js does, so the pinned pipeline order is untouched. Import-free (the page runs this source
 * via toString(), compose.js); emitted only into a page whose world has a body that vanishes, so every other page keeps
 * every byte. Field ownership: e.vanishT (how long it has lain), e.vanishThrow (a launch in flight); it sets
 * combat-match.js's e.deathBurstDone on its bodies so they never explode.
 */

export function buildVanish(E) {
  const LAUNCH = { speed: 4.5, up: 3, g: 20 };
  const step = E.stepWorld;
  // a launch's flight: along the blow (from whoever struck it, else back from its heading), up, and down onto the ground
  function fly(state, e, dt, hooks) {
    const t = e.transform, eye = (e.rule && e.rule.eye) || 0;
    if (!e.vanishThrow) {
      const by = e.lastHitBy && state.byId[e.lastHitBy];
      const a = by ? Math.atan2(t.pos[1] - by.transform.pos[1], t.pos[0] - by.transform.pos[0]) : t.heading + Math.PI;
      e.vanishThrow = { v: [Math.cos(a) * LAUNCH.speed, Math.sin(a) * LAUNCH.speed], vz: LAUNCH.up, landed: false };
    }
    const T = e.vanishThrow;
    if (T.landed) return true;
    t.pos[0] += T.v[0] * dt; t.pos[1] += T.v[1] * dt;
    T.vz -= LAUNCH.g * dt; t.pos[2] += T.vz * dt;
    const g = hooks && hooks.ground ? hooks.ground([t.pos[0], t.pos[1], t.pos[2] - eye + 1]) : null;
    if (T.vz < 0 && g != null && t.pos[2] - eye <= g) { t.pos[2] = g + eye; T.landed = true; }
    else if (T.vz < 0 && g == null && T.vz < -LAUNCH.up * 2) T.landed = true;   // (nothing under it: it stops falling)
    return T.landed;
  }
  E.stepWorld = function stepWithVanish(state, input, dt, hooks) {
    // (a body that vanishes dies its own way: never the suit's death burst, combat-match.js, whose fireball and splash
    // stagger are a mecha's; its latch is set before the pass can fire it)
    for (const e of state.entities) if (e.body && e.body.vanish && !e.deathBurstDone) e.deathBurstDone = true;
    step(state, input, dt, hooks);
    dt = dt || 1 / 60;
    for (const e of state.entities) {
      const V = e.body && e.body.vanish;
      if (!V || !e.downed || e.gone) continue;
      if (V.die === 'launch' && !fly(state, e, dt, hooks)) continue;
      e.vanishT = (e.vanishT || 0) + dt;
      if (e.vanishT + 1e-9 < (V.linger || 0)) continue;
      e.gone = true; e.moving = false; e.route = null;
      e.transit = { is: V.is, dir: 'out', t0: state.time || 0, ...(V.rgb ? { rgb: V.rgb } : {}) };
    }
    return state;
  };
}
