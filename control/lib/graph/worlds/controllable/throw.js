/**
 * throw.js — A GRENADE THROWN: a loadout slot whose weapon says `throw` (gameworld/arms-kit.js the grenades) is not fired
 * the moment its trigger is pressed but thrown: the press starts the body's throw, and its round (a travelling one: the
 * lob, combat-ranged.js) leaves the hand at the throw's release, launched as any converging lob is (on the arc through
 * the point under the crosshair: lobAim), so the arc and the ring drawn before the press are where it goes.
 *
 *   weapon.throw: { dur: seconds, release: share, clip?: true }
 *     dur        the throw's seconds, press to follow-through
 *     release    the share of it at which the round leaves the hand
 *     clip       the body plays its `throw` state for it (its locomotion and phase: the figure's throw clip, the hero's own
 *                solved overhand, hero-throw.js); absent, the round still leaves at the release, nothing is played
 *
 *   input.fire   an edge: the throw (as a gun's trigger is: over the shoulder, while aiming, aim-view.js). Held off from
 *                the weapon itself (it fires only at the release, the edge passed through then); a switch, a reel or a
 *                fall before the release, nothing is thrown.
 *
 * Field ownership: on the pilot e.throwT (0 to 1 through the throw, null between), e.throwOf (the throw's numbers),
 * e.throwW (the weapon thrown), e.throwGo (its round gone), e.throwPrev; while it throws, e.locomotion, e.gaitPhase and
 * e.moving (as free-run.js's vault does), where the throw says `clip`.
 *
 * Wraps stepWorld inside the aim (compose.js lists it after gunplay and before aim-view), so the trigger it reads is the
 * aim's. Import-free (the page runs this source via toString(), compose.js); emitted only into a page whose world carries
 * a thrown weapon, so every other page keeps every byte.
 */
export function buildThrow(E) {
  const step = E.stepWorld;
  E.stepWorld = function stepWithThrow(state, input, dt, hooks) {
    const p = state.pilotId ? state.byId[state.pilotId] : null, w = p && p.weapon, T = w && w.throw;
    // (a pilot with nothing to throw is left as it is: its step the engine's own, byte for byte)
    if (!input || !p || (!T && p.throwT == null)) return step(state, input, dt, hooks);
    const edge = !!input.fire && !p.throwPrev;
    p.throwPrev = !!input.fire;
    let fire = 0;
    if (p.throwT == null) {
      // the press, with a round to throw and nothing in the way of it: the throw begins
      if (T && edge && !w.reloading && !((p.readyT || 0) > 0) && w.ammo > 0 && !((w.cooldownT || 0) > 0) && !p.downed && !p.gone && p.staggerT == null) {
        p.throwT = 0; p.throwGo = false; p.throwOf = T; p.throwW = w;
      }
    } else {
      p.throwT += dt / Math.max(0.05, p.throwOf.dur);
      // a switch, a reel or a fall before the release: nothing is thrown
      if (!p.throwGo && (p.weapon !== p.throwW || p.downed || p.gone || p.staggerT != null)) p.throwT = 1;
      else if (!p.throwGo && p.throwT >= p.throwOf.release) { p.throwGo = true; p.throwW.prevFire = false; fire = 1; }
    }
    const out = step(state, { ...input, fire }, dt, hooks);
    if (p.throwT != null) {
      if (p.throwT >= 1) { p.throwT = null; p.throwOf = null; p.throwW = null; }
      else if (p.throwOf.clip) { p.locomotion = 'throw'; p.gaitPhase = Math.min(p.throwT, 0.999); p.moving = true; }
    }
    return out;
  };
}
