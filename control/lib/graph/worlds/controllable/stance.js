/**
 * stance.js — THE CROUCH: a body lowered on a press, slower and smaller, until it is pressed again. Opt-in on the
 * pilot's rule:
 *
 *   rule.stance: { crouch: { speed?: 2.2, height?: 1.1 } }
 *       speed    its pace crouched (m/s)
 *       height   its height crouched (metres: its `collideHeight`). A watcher's sight is eye to eye (mind.js perceive, the
 *                eye three quarters up a body's height), so a body crouched is seen over nothing its lowered eye is
 *                under: behind a wall a metre high it is not seen, where standing it is
 *
 *   input.crouch   an edge: down, or up again. It stands for a dive, a vault and a climb (they are taken standing).
 *
 * The page plays `crouch_idle` standing still and `crouch_walk` moving (a figure without the clips plays its fallback,
 * playscape/player.js TRAVERSAL_FALLBACK).
 * Field ownership: e.crouched, e.crPrev, e.crT (its still crouch's phase), e.crBase ({ speed, collideHeight }: the rule's own, kept once); the pilot's
 * `rule.speed` and `rule.collideHeight` while it is down. The two are set each step on whichever rule the body is read by
 * (the aim and what is in hand keep copies of it: aim-view.js, carry.js), so a copy taken while down is put right too.
 *
 * Wraps stepWorld, so the pinned pipeline order is untouched. Import-free (the page runs this source via toString(),
 * compose.js); emitted only into a page whose world has a rule with `stance`, so every other page keeps every byte.
 */
export function buildStance(E) {
  const step = E.stepWorld;
  E.stepWorld = function stepWithStance(state, input, dt, hooks) {
    const p = state.pilotId ? state.byId[state.pilotId] : null, S = p && p.rule && p.rule.stance && p.rule.stance.crouch;
    if (!S || !input) return step(state, input, dt, hooks);
    if (!p.crBase) p.crBase = { speed: p.rule.speed, collideHeight: p.rule.collideHeight };
    const edge = !!input.crouch && !p.crPrev; p.crPrev = !!input.crouch;
    if (edge && !p.downed && !p.fr && p.dodgeT == null) p.crouched = !p.crouched;
    // (a dive, a vault or a climb is taken standing; so is going down)
    if (p.crouched && (p.dodgeT != null || p.fr || p.downed)) p.crouched = false;
    const want = p.crouched ? { speed: S.speed ?? 2.2, collideHeight: S.height ?? 1.1 } : p.crBase;
    for (const r of [p.rule, p.av && p.av.rule, p.carry && p.carry.rule]) if (r && (r.speed !== want.speed || r.collideHeight !== want.collideHeight)) { r.speed = want.speed; r.collideHeight = want.collideHeight; }
    const out = step(state, input, dt, hooks);
    if (p.crouched && p.dodgeT == null && !p.fr && p.swingT == null && p.grounded !== false) {
      // (the gait's own states, still or moving: the body's stand and its turn on the spot are the still ones)
      if (['idle', 'turn', 'forward', 'strafe', 'walk'].includes(p.locomotion)) {
        const still = !p.moving || p.locomotion === 'idle' || p.locomotion === 'turn';
        p.locomotion = still ? 'crouch_idle' : 'crouch_walk';
        // (still, it holds its crouch: a body the page reads as standing still would be shown its stand, so it is told
        // it plays, its crouch's own slow breath the phase)
        if (still) { p.moving = true; p.crT = ((p.crT || 0) + dt / 3) % 1; p.gaitPhase = p.crT; }
      }
    }
    return out;
  };
}
