/**
 * dive.js — THE DIVE ON A BUTTON: the platform rule's dodge (maneuvers.js: a committed burst along the way the body
 * moves, invulnerable through it) taken on one press, where the rule itself asks for a double tap of the boost. Opt-in
 * on the pilot's rule, beside its `dodge`:
 *
 *   rule.dive: { jump?: false }      `jump: false`: the body has no jump (its button is the dive's: the page sends it)
 *   rule.dodge, dodgeDur, dodgeSpeed, dodgeCooldown    the dive itself: how long, how fast at its middle (it covers
 *                                    dodgeSpeed × dodgeDur × 2/π metres), and the seconds before another
 *
 *   input.dive    an edge: the dive, where the rule's dodge would be let (on the ground, off its cooldown, not mid-move)
 *
 * The boost is the dodge's own trigger, so this module owns `input.boost` on such a body: it is the press's one frame
 * and nothing else (a body that dives this way has no boost to hold).
 * Field ownership: e.divePrev; it sets the dodge's own `e.fTapWin` on the press.
 *
 * Wraps stepWorld, so the pinned pipeline order is untouched. Import-free (the page runs this source via toString(),
 * compose.js); emitted only into a page whose world has a rule with `dive`, so every other page keeps every byte.
 */
export function buildDive(E) {
  const step = E.stepWorld;
  E.stepWorld = function stepWithDive(state, input, dt, hooks) {
    const p = state.pilotId ? state.byId[state.pilotId] : null, R = p && p.rule && p.rule.dive;
    if (!R || !input) return step(state, input, dt, hooks);
    const edge = !!input.dive && !p.divePrev; p.divePrev = !!input.dive;
    const go = edge && p.dodgeT == null && !p.fr && !p.downed;
    if (go) p.fTapWin = 1;
    return step(state, { ...input, boost: go ? 1 : 0, ...(R.jump === false ? { jump: 0, jumpHeld: 0 } : {}) }, dt, hooks);
  };
}
