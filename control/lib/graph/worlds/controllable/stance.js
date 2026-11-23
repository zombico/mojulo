/**
 * stance.js — THE CROUCH AND THE PRONE: a body lowered on a press, slower and smaller, and laid flat on a hold, slower
 * and smaller again. Opt-in on the pilot's rule:
 *
 *   rule.stance: { crouch: { speed?: 2.2, height?: 1.1 }, prone?: { speed?: 0.9, height?: 0.45, view?: 'eye', eye?: 0.32 }, hold?: 0.4 }
 *       view     lying, the crawl SEEN FROM THE EYE (`'eye'`): the camera rides the body's eye `eye` metres over the ground
 *                (the page hides the body, as the aim's eye does: aim-view.js) and the body turns and pitches with the look,
 *                so the crawl goes where it looks; up again, the camera's own rule and the body's own way of turning are
 *                given back, the camera looking where the eye left it. While the aim is held the aim's own camera has it
 *       speed    its pace crouched (m/s)
 *       height   its height crouched (metres: its `collideHeight`). A watcher's sight is eye to eye (mind.js perceive, the
 *                eye three quarters up a body's height), so a body crouched is seen over nothing its lowered eye is
 *                under: behind a wall a metre high it is not seen, where standing it is
 *
 *   HEADROOM      a body rises only where nothing hangs lower than it would stand: under a vent's lid, a truck's
 *                  chassis or through a hole in a wall it stays lying (or crouched), whatever the key says
 *   input.crouch   TAPPED (let go before `hold` seconds): standing to crouched, crouched to standing, lying to crouched.
 *                  HELD for `hold` seconds (where the rule has `prone`): to lying, from standing or crouched; lying, to
 *                  standing. It stands for a dive, a vault and a climb (they are taken standing).
 *
 * The page plays `crouch_idle` still and `crouch_walk` moving, and lying `prone_idle` and `prone_crawl` (a figure without the clips plays its fallback,
 * playscape/player.js TRAVERSAL_FALLBACK).
 * Field ownership: e.crouched, e.prone (one of them at most), e.crPrev, e.crHold (the press's seconds), e.crFired (its
 * hold taken), e.crT (its still phase), e.crLay and, lying, e.tumble, e.crEye ({ cam, rule }: the camera's rule and the body's own,
 * while the crawl is seen from the eye), e.crBase ({ speed, collideHeight }: the rule's own, kept once); the pilot's
 * `rule.speed` and `rule.collideHeight` while it is down. The two are set each step on whichever rule the body is read by
 * (the aim and what is in hand keep copies of it: aim-view.js, carry.js), so a copy taken while down is put right too.
 *
 * Wraps stepWorld, so the pinned pipeline order is untouched. Import-free (the page runs this source via toString(),
 * compose.js); emitted only into a page whose world has a rule with `stance`, so every other page keeps every byte.
 */
export function buildStance(E) {
  const step = E.stepWorld;
  E.stepWorld = function stepWithStance(state, input, dt, hooks) {
    const p = state.pilotId ? state.byId[state.pilotId] : null, T = p && p.rule && p.rule.stance, S = T && T.crouch;
    if (!S || !input) return step(state, input, dt, hooks);
    if (!p.crBase) p.crBase = { speed: p.rule.speed, collideHeight: p.rule.collideHeight };
    const P = T.prone || null, down = !!input.crouch, busy = p.downed || p.fr || p.dodgeT != null;
    // HEADROOM: a body does not rise into what hangs over it (a vent's lid, a truck's chassis, a hole through a wall):
    // to rise to `h` metres, nothing whose underside stands between its head now and `h` over its feet is over it
    const room = (h) => {
      const C = state.colliders; if (!C) return true;
      const t = p.transform.pos, r = p.rule, foot = t[2] - (r.eye || 0), top = foot + (r.collideHeight ?? 1.8), R = r.collideRadius ?? 0.3;
      for (const b of C) if (b.min[2] >= top - 0.02 && b.min[2] < foot + h && t[0] + R > b.min[0] && t[0] - R < b.max[0] && t[1] + R > b.min[1] && t[1] - R < b.max[1]) return false;
      return true;
    };
    const standH = p.crBase.collideHeight ?? 1.8, crouchH = S.height ?? 1.1;
    if (down && !p.crPrev) { p.crHold = 0; p.crFired = false; }
    if (down) {
      p.crHold = (p.crHold || 0) + dt;
      // the hold: to lying, or from lying to standing
      if (P && !p.crFired && p.crHold >= (T.hold ?? 0.4) && !busy) { p.crFired = true; if (p.prone) { if (room(standH)) { p.prone = false; p.crouched = false; } else if (room(crouchH)) { p.prone = false; p.crouched = true; } } else { p.prone = true; p.crouched = false; } }
    } else if (p.crPrev && !p.crFired && !busy) {
      // the tap, as it is let go (rising only where it has the headroom)
      if (p.prone) { if (room(crouchH)) { p.prone = false; p.crouched = true; } } else if (!p.crouched || room(standH)) p.crouched = !p.crouched;
    }
    p.crPrev = down;
    // (a dive, a vault or a climb is taken standing; so is going down; never under something low)
    if ((p.crouched || p.prone) && busy && room(standH)) { p.crouched = false; p.prone = false; }
    // THE CRAWL SEEN FROM THE EYE: lying, the camera to the body's eye and the body turned by the look; up, both given back
    const C0 = state.camera;
    if (P && P.view === 'eye' && C0 && !(p.av && p.av.on)) {
      if (p.prone && !p.crEye) {
        p.crEye = { cam: C0.rule, rule: p.rule };
        if (C0.camYaw != null) p.transform.heading = C0.camYaw;
        p.transform.pitch = 0;
        const { move: _m, ...own } = p.rule;
        p.rule = { ...own, turnMode: 'look', lookPitch: true };
        C0.rule = { type: 'eye', target: p.id, height: P.eye ?? 0.32, hideTarget: true };
      } else if (!p.prone && p.crEye) {
        C0.rule = p.crEye.cam; p.rule = p.crEye.rule; p.crEye = null;
        C0.camYaw = p.transform.heading; C0.camPitch = 0; p.transform.pitch = 0;
      }
    }
    const want = p.prone ? { speed: P.speed ?? 0.9, collideHeight: P.height ?? 0.45 } : p.crouched ? { speed: S.speed ?? 2.2, collideHeight: S.height ?? 1.1 } : p.crBase;
    for (const r of [p.rule, p.av && p.av.rule, p.carry && p.carry.rule, p.crEye && p.crEye.rule]) if (r && (r.speed !== want.speed || r.collideHeight !== want.collideHeight)) { r.speed = want.speed; r.collideHeight = want.collideHeight; }
    const out = step(state, input, dt, hooks);
    if ((p.crouched || p.prone) && p.dodgeT == null && !p.fr && p.swingT == null && p.grounded !== false) {
      // (the gait's own states, still or moving: the body's stand and its turn on the spot are the still ones)
      if (['idle', 'turn', 'forward', 'strafe', 'walk'].includes(p.locomotion)) {
        const still = !p.moving || p.locomotion === 'idle' || p.locomotion === 'turn';
        p.locomotion = p.prone ? (still ? 'prone_idle' : 'prone_crawl') : still ? 'crouch_idle' : 'crouch_walk';
        // (still, it holds its pose: a body the page reads as standing still would be shown its stand, so it is told
        // it plays, a slow breath the phase)
        if (still) { p.moving = true; p.crT = ((p.crT || 0) + dt / 3) % 1; p.gaitPhase = p.crT; }
      }
    }
    // lying, the whole body is turned onto its front about its middle, which rests a body's depth over the floor (the
    // page's whole-body turn, the dodge's own: `at` the pivot's share of the body's height, `rise` where it rests)
    if (p.prone && p.dodgeT == null && !p.fr) { const h = p.transform.heading; p.tumble = { axis: [-Math.sin(h), Math.cos(h), 0], angle: Math.PI / 2, at: 0.5, rise: P.rise ?? 0.16 }; p.crLay = true; }
    else if (p.crLay) { p.crLay = false; if (p.dodgeT == null) p.tumble = null; }
    // (the eye's camera rides the lowered eye)
    const C = state.camera, A = p.rule.aimView;
    if (C && C.rule && C.rule.type === 'eye' && C.rule.target === p.id && (A || p.crEye)) C.rule.height = p.crEye ? (P.eye ?? 0.32) : (A.eye ?? 1.6) * (p.prone ? 0.2 : p.crouched ? 0.62 : 1);
    return out;
  };
}
