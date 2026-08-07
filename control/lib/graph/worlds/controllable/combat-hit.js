/**
 * combat-hit.js — hit volumes + the reaction chain (controllable-split.plan.md, S2). The egg
 * hitbox family (ray/point vs the boost-lean-tilted spheroid), destructible frontal shields,
 * guard-spending (breakGuards), boost armor (boostStunFactor), armReaction (stagger / topple /
 * the kill override), the acrobatic dodge commit (beginDodge — shared by the platform rule, the
 * stagger dodge-cancel, and the ai escape roll), and stepReaction (the per-entity reaction pass:
 * poise regen, the stagger→topple→downpause→getup sequence, wake-guard i-frames).
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; core helpers destructured at
 * build time. Field ownership: e.poise/poiseMax/poiseRegen, e.staggerT/reactClip/reactDur/
 * downPauseT/downed, e.shieldHp/shieldBroken, e.invincible/wakeGuardT/spawnGuard(clear),
 * e.dodge* (with the platform rule), e.collideVol/hpMax (normalize hoists).
 */

export function buildCombatHit(E) {
  const { sub, scl, clamp, fwdXY, rightXY, registerNormalize, registerBodyOwner } = E;

  // ── R19: the EGG hitbox — a tall narrow spheroid (lateral radius `a`, semi-length `c`)
  // about a long axis that TILTS with the boost lean. Replaces the old fat isotropic
  // sphere: a shot lands only when the aim ray actually passes THROUGH the silhouette,
  // so you must aim at the body (no distance-growing generosity cone). Pure geometry.
  const isFlatToppled = (tg) => tg && tg.reactClip === 'topple' && tg.staggerT >= 1;
  // `latR(tg)` is the target's lateral reach. Upright eggs use width `a`; a flat toppled suit
  // presents its body length along the floor, so melee/tackle reach against the heap uses `c`.
  const latR = (tg) => (tg.body && tg.body.egg ? (isFlatToppled(tg) ? tg.body.egg.c : tg.body.egg.a) : (tg.body && tg.body.radius) || 0.5);
  // The signed boost lean (radians) for a locomotion state; 0 (upright) for walk/idle. A
  // negative lean tips the top AWAY from the base direction (boost_back arches back).
  function eggLean(tg) {
    const lm = tg.locomotion || '';
    const base = (tg.body.egg && Number.isFinite(tg.body.egg.lean)) ? tg.body.egg.lean : 0.6;
    if (lm === 'boost') return base;
    if (lm === 'boost_back') return -base * 0.7;
    if (lm === 'boost_left' || lm === 'boost_right') return base * 0.8;
    return 0;   // boost_side (symmetric), leap, gait, idle → upright
  }
  // The egg's world-space long-axis unit vector: world +z tilted toward the lean direction.
  function eggAxis(tg) {
    if (isFlatToppled(tg)) {
      const h = tg.transform.heading || 0;
      return [Math.cos(h), Math.sin(h), 0];   // the toppled body lies along the floor
    }
    const th = eggLean(tg);
    if (!th) return [0, 0, 1];
    const h = tg.transform.heading, lm = tg.locomotion || '';
    const dir = lm === 'boost_left' ? scl(rightXY(h), -1) : lm === 'boost_right' ? rightXY(h) : fwdXY(h);
    const s = Math.sin(th), c = Math.cos(th);   // signed th tips toward -dir when negative
    return [s * dir[0], s * dir[1], c];          // unit: (s·dir)²+c² = s²+c² = 1
  }
  // Ray-vs-egg: scale the ray into the spheroid's unit-sphere frame (perp part /a, along-axis
  // part /c) and solve the quadratic. Returns the nearest positive entry distance along the
  // UNIT dir (parameter preserved by the linear scale) or null. Center rides `tg.pos` + the
  // egg's `cz` height (feet-anchored default: cz = c, so the egg spans foot→head).
  function hitEgg(origin, dir, tg) {
    const egg = tg.body.egg, a = egg.a, cc = egg.c;
    const flat = isFlatToppled(tg);
    const cz = flat ? a : (Number.isFinite(egg.cz) ? egg.cz : cc);
    const C = [tg.transform.pos[0], tg.transform.pos[1], tg.transform.pos[2] + cz];
    const ez = eggAxis(tg);
    const S = (u) => {
      const par = u[0] * ez[0] + u[1] * ez[1] + u[2] * ez[2];
      const f = (1 / cc - 1 / a) * par;
      return [u[0] / a + f * ez[0], u[1] / a + f * ez[1], u[2] / a + f * ez[2]];
    };
    const O = S(sub(origin, C)), D = S(dir);
    const A = D[0] * D[0] + D[1] * D[1] + D[2] * D[2];
    if (A <= 1e-12) return null;
    const B = 2 * (O[0] * D[0] + O[1] * D[1] + O[2] * D[2]);
    const K = O[0] * O[0] + O[1] * O[1] + O[2] * O[2] - 1;
    const disc = B * B - 4 * A * K;
    if (disc < 0) return null;
    const sq = Math.sqrt(disc), t0 = (-B - sq) / (2 * A), t1 = (-B + sq) / (2 * A);
    return t0 > 1e-4 ? t0 : (t1 > 1e-4 ? t1 : null);   // nearest entry ahead (or exit if fired from inside)
  }
  // Is a POINT inside the target's (tilted) egg, inflated by `pad`? The membership test behind projectile
  // CONTACT (a lob shell must burst on the tall BODY column, not sail over the feet-point) and SPLASH
  // inclusion (a burst within `pad` of the egg catches it). Inflating the semi-axes by pad is the
  // conservative ellipsoid⊕sphere approximation — exact enough for gameplay, and a direct hit (point
  // inside the egg) is trivially inside the pad-inflated egg, so a shell that lands on a suit always
  // catches that suit in its own splash.
  function pointInEgg(pt, tg, pad) {
    const egg = tg.body.egg, a = egg.a + pad, cc = egg.c + pad;
    const cz = isFlatToppled(tg) ? a : (Number.isFinite(egg.cz) ? egg.cz : egg.c);
    const ez = eggAxis(tg);
    const u = [pt[0] - tg.transform.pos[0], pt[1] - tg.transform.pos[1], pt[2] - (tg.transform.pos[2] + cz)];
    const par = u[0] * ez[0] + u[1] * ez[1] + u[2] * ez[2];
    const perp2 = Math.max(0, (u[0] * u[0] + u[1] * u[1] + u[2] * u[2]) - par * par);
    return perp2 / (a * a) + (par * par) / (cc * cc) <= 1;
  }
  const hullZ = (u) => u.transform.pos[2] + (u.body && u.body.egg ? (isFlatToppled(u) ? u.body.egg.a : u.body.egg.c) : (u.body && u.body.radius) || 0.5);

  // ── R19: destructible shields. A frontal, FLANKABLE damage buffer. A ranged/splash hit
  // whose SOURCE lies within the shield's front arc is EATEN (drains shieldHp, no hp/poise);
  // a flank/rear shot bypasses it. Breaking it (hp≤0) shatters the shield and STAGGERS the
  // suit (the punish window). Melee bypasses the shield entirely (handled in stepMelee).
  function shieldCovers(tg, src) {
    if (!tg.shieldHp || tg.shieldBroken) return false;
    const front = fwdXY(tg.transform.heading);
    const ix = src[0] - tg.transform.pos[0], iy = src[1] - tg.transform.pos[1];
    const m = Math.hypot(ix, iy) || 1e-6;
    return (ix * front[0] + iy * front[1]) / m >= Math.cos((tg.shieldArc || Math.PI * 0.6) / 2);
  }
  // Try to absorb `drain` off tg's shield from a shot originating at `src`. Returns true when
  // the shield ate the hit (so the caller skips hp/poise). Arms the break-stagger on depletion.
  function absorbShield(tg, src, drain, state) {
    if (!shieldCovers(tg, src)) return false;
    tg.shieldHp -= drain;
    if (tg.shieldHp <= 0) {
      tg.shieldHp = 0; tg.shieldBroken = true; tg.shieldBreakAt = state.time;
      state.shieldBreaks = (state.shieldBreaks || 0) + 1;
      armReaction(tg, 'stagger');   // the shatter IS the opening — reuse the R8 reaction
    }
    return true;
  }

  // breakGuards(e) — acting a weapon SPENDS any protection (2026-07-27): the spawn shield always
  // dropped on the first act (R24/R26); now the post-knockdown wake guard and a mid-dodge
  // tumble's i-frames drop the same way — firing (or swinging/throwing) while untouchable is
  // over. The dodge's per-frame i-frame assert respects `dodgeSpent`, so the tumble finishes
  // its arc hittable. The getup rise keeps its i-frames only because a reacting unit cannot
  // act at all (stepReaction suppresses its rule + weapon).
  function breakGuards(e) {
    if (e.spawnGuard) e.spawnGuard = false;
    if (e.wakeGuardT > 0) e.wakeGuardT = 0;
    if (e.dodgeT != null) e.dodgeSpent = true;
    e.downPauseT = null;
    e.invincible = false;
  }

  // boostStunFactor(tg) — BOOST ARMOR (R23): the multiplier applied to any STUN a target takes
  // while it is BOOSTING. Opt-in `body.boostArmor` (a level ≥ 1) hoisted to `tg.boostArmor`;
  // active only while `tg.boosting` (the platform rule surfaces it — so an idle/walking suit is
  // unarmored, and a boost that was melee-cancelled is too). Each level HALVES the stun: lv1 → 0.5
  // (a 100%-stun hit — a beam bolt or a bazooka splash, both worth a full poise bar — no longer
  // breaks in one; it takes two), lv2 → 0.25, etc. No armor / not boosting → 1 (unchanged). The
  // factor scales the poise CHIP a stun deals; an unconditional stagger (splash/melee) is treated
  // as a full-bar (poiseMax) stun so the same factor turns it into a survivable chip.
  function boostStunFactor(tg) {
    if (!(tg.boostArmor > 0) || !tg.boosting) return 1;
    return Math.pow(0.5, tg.boostArmor);
  }

  // armReaction(tg, kind, force) — arm a hit-reaction on a poise-bearing target. Refill
  // poise (the break is a THRESHOLD, not a drain) and start the reaction timer
  // with the clip + duration for this KIND: 'stagger' is the light lurch every
  // connect gives; 'topple' is the heavy KNOCKDOWN (the `back` great-cleave, or a
  // landed MELEE COMBO follow-up) — a longer clip that FLOORS the unit.
  // The KILLING BLOW overrides: a hit that leaves hp at 0 always topples AND
  // marks the unit downed (stepReaction then holds the collapse — it never rises).
  // A target already mid-reaction is left alone unless this is the kill — or `force`
  // (R20.4): a toppling melee connect UPGRADES a mid-STAGGER target into the knockdown
  // (the combo's whole point — hit 2 lands while hit 1's lurch still runs). A force
  // never interrupts an in-progress fall/getup (you can't re-floor the floored).
  function armReaction(tg, kind, force) {
    if (!Number.isFinite(tg.poise)) return;
    const dead = tg.body && Number.isFinite(tg.body.hp) && tg.body.hp <= 0;
    if (dead) kind = 'topple';
    const inKnockdown = tg.staggerT != null && (tg.reactClip === 'topple' || tg.reactClip === 'downpause' || tg.reactClip === 'getup');
    if (tg.staggerT != null && !dead && !(force && !inKnockdown)) return;   // mid-reaction: kill or a forced knockdown overrides a stagger
    if (tg.staggerT == null) tg.staggerReturn = tg.locomotion;   // an upgrade keeps the ORIGINAL return locomotion (never 'stagger')
    tg.poise = tg.poiseMax; tg.staggerT = 0; tg.downPauseT = null;
    tg.reactClip = kind === 'topple' ? 'topple' : 'stagger';
    // topple's reactDur is the FALL only (stepReaction then chains getupDur for the rise);
    // stagger is a single segment.
    tg.reactDur = kind === 'topple' ? (tg.toppleDur || (tg.staggerDur || 1.3) * 1.3) : (tg.staggerDur || 1.3);
    // PRACTICE (match.practice → e.noDestroy): the killing blow still plays its knockdown, but
    // the suit rises with a FULL bar instead of dying — destruction is off, the drill continues.
    if (dead) { if (tg.noDestroy && Number.isFinite(tg.hpMax)) tg.body.hp = tg.hpMax; else tg.downed = true; }
  }

  // stepReaction(e, input, dt) — the hit-reaction pass, run for EVERY entity before its rule so it
  // gates any rule uniformly (the ambient clock enemy AND a piloted platform unit react the same
  // way). Jobs: regenerate poise while upright, advance the active reaction, and hold the terminal
  // DOWNED state. A reaction is a SEQUENCE of clips advanced by staggerT (0→1 per segment): stagger
  // is one segment (the lurch); a TOPPLE is three beats — the `topple` FALL, a flat vulnerable
  // toppled hold, then the `getup` RISE every suit stands back up with. While reacting it OVERRIDES locomotion
  // to the current clip and returns true to SUPPRESS the entity's rule + weapon — "they can't act
  // while reeling." The stagger-cancel seam (e.staggerCancel — heavy-armor poise-through / boost
  // break-out) ends a stagger early; it does NOT interrupt a topple fall/getup (you're committed to
  // going down and getting up) or a downed unit (death is final).
  // beginDodge(e, input, r) — commit an acrobatic dodge NOW: the same roll the platform rule fires on
  // a double-tap of F (identical clip selection + gauge cost / overheat). Extracted so a STAGGER can be
  // dodge-cancelled (stepReaction) with the exact same maneuver. Direction reads the held WASD at the
  // commit frame; `dodge:'twirl'` bodies roll the single grounded twirl.
  function beginDodge(e, input, r) {
    const hasGauge = r.boostMax > 0;
    const dodgeCost = r.dodgeBoostCost ?? 2;
    const dodgeOverheats = hasGauge && dodgeCost > 0 && (r.dodgeOverheat ?? true);
    const t = e.transform, f = fwdXY(t.heading), rt = rightXY(t.heading);
    const lookMode = r.space === true || (r.turnMode ?? 'tank') !== 'tank';
    const sideIn = clamp(input.strafe + (lookMode ? input.turn : 0), -1, 1);
    const fwdH = input.forward, sdH = sideIn;
    e.dodgeT = 0; e.fTapWin = 0; e.dodgeSpent = false;
    if (!dodgeOverheats) e.dodgeCdT = r.dodgeCooldown ?? 8;
    e.dodgeCount = (e.dodgeCount || 0) + 1;
    if (dodgeOverheats) { e.boost = 0; e.boostLock = true; }
    else if (hasGauge && dodgeCost > 0) e.boost = Math.max(0, e.boost - dodgeCost);
    if (r.dodge === 'twirl') { e.dodgeClip = 'dodge_twirl'; e.dodgeKind = 'spin'; e.dodgeSign = 1; }   // bulky/hover suits: one grounded twirl, any direction
    else if (Math.abs(sdH) > Math.abs(fwdH) && Math.abs(sdH) > 0.3) { e.dodgeClip = 'dodge_sideroll'; e.dodgeKind = 'side'; e.dodgeSign = sdH < 0 ? -1 : 1; }
    else if (fwdH < -0.3) { e.dodgeClip = 'dodge_backflip'; e.dodgeKind = 'back'; e.dodgeSign = 1; }
    else { e.dodgeClip = 'dodge_roll'; e.dodgeKind = 'fwd'; e.dodgeSign = 1; }   // forward, NEUTRAL, and diagonal-forward → forward roll (the neutral spin/twirl is gone)
    // the DASH goes the true (diagonal-capable) input direction; a neutral roll (no stick) rolls forward.
    const dx = f[0] * fwdH + rt[0] * sdH, dy = f[1] * fwdH + rt[1] * sdH;
    const dl = Math.hypot(dx, dy);
    e.dodgeDir = dl > 1e-3 ? [dx / dl, dy / dl] : [f[0], f[1]];
  }

  function stepReaction(e, input, dt) {
    if (e.poise == null) return false;                 // opt-in: only poise-bearing suits react
    // WAKE GUARD (R20.4, opt-in body.wakeGuard sec): fresh off a KNOCKDOWN the suit is
    // UNTOUCHABLE while the timer runs — the anti-juggle window that pays for the longer getup.
    // Asserted per frame (a dodge ending mid-guard can't strip it); every hit adjudicator
    // already skips invincible targets.
    if (e.wakeGuardT > 0) {
      e.wakeGuardT = Math.max(0, e.wakeGuardT - dt);
      e.invincible = e.wakeGuardT > 0;
    }
    if (e.staggerT == null) {
      if (e.poise < e.poiseMax) e.poise = Math.min(e.poiseMax, e.poise + (e.poiseRegen || 0) * dt);
      return false;
    }
    const inKnockdown = e.reactClip === 'topple' || e.reactClip === 'downpause' || e.reactClip === 'getup';
    // DODGE-CANCEL (operator): a dodge roll BREAKS OUT of a plain stagger. The PILOT (a platform rule
    // with dodge) double-tapping F while staggering — IF the thruster can pay for a roll — cancels the
    // reaction and commits the roll THIS frame (via the staggerCancel seam just below). All the normal
    // dodge rules apply: the double-tap, the boost cost, the overheat dump. Only a PLAIN stagger (never
    // a topple / getup knockdown or a downed frame), and only if you have the boost to spend — a dead
    // bar means you eat the stagger. The F-tap window is tracked here (the rule is suppressed mid-
    // stagger, so it hands the tracking off to this block and back, sharing e.fTapWin / e.boostPrev).
    if (!inKnockdown && !e.downed && e.reactClip === 'stagger' && e.dodgeT == null
        && e.rule && e.rule.type === 'platform' && (e.rule.dodge === true || e.rule.dodge === 'twirl')
        && (e.grounded || e.rule.space === true)) {
      const rr = e.rule;
      const boostEdge = !!input.boost && !e.boostPrev;
      e.boostPrev = !!input.boost;
      const hasGauge = rr.boostMax > 0, dodgeCost = rr.dodgeBoostCost ?? 2;
      const canDodge = !hasGauge || dodgeCost <= 0 || (e.boost >= dodgeCost && !e.boostLock);
      if (boostEdge && (e.fTapWin ?? 0) > 0 && canDodge) { e.staggerCancel = true; beginDodge(e, input, rr); }
      else if (boostEdge) { e.fTapWin = rr.doubleTapWindow ?? 0.28; }
      if ((e.fTapWin ?? 0) > 0) e.fTapWin = Math.max(0, e.fTapWin - dt);
    }
    if (e.staggerCancel && !e.downed && !inKnockdown) { e.staggerT = null; e.staggerCancel = false; e.locomotion = e.staggerReturn || 'forward'; e.invincible = false; return false; }
    if (e.reactClip === 'downpause') {   // backward-compatible old state: fold into the toppled flat hold.
      const hold = e.downPause ?? 2;
      e.reactClip = 'topple'; e.downPauseT = e.downPauseT ?? Math.min(hold, (e.staggerT || 0) * hold); e.staggerT = 1;
    }
    if (e.reactClip === 'topple' && e.downPauseT != null) {
      e.downPauseT += dt;
      if (e.downPauseT >= (e.downPause ?? 2)) {
        // the toppled punish window finished → chain into the `getup` rise, the shared recovery primitive.
        // The i-frames trigger HERE, as the rise begins, not while flat on the ground.
        e.reactClip = 'getup'; e.reactDur = e.getupDur || (e.staggerDur || 1.3) * 1.4; e.staggerT = 0; e.downPauseT = null;
        e.locomotion = 'getup'; e.moving = true; e.gaitPhase = 0; e.invincible = true; return true;
      }
      e.staggerT = 1; e.locomotion = 'topple'; e.moving = true; e.gaitPhase = 1; e.invincible = false; return true;
    }
    e.staggerT += dt / (e.reactDur || e.staggerDur || 1.3);
    if (e.staggerT >= 1) {
      if (e.reactClip === 'topple') {
        // the topple FALL finished — the unit is now FLAT on the ground (topple ends
        // at TOPPLE_FLAT, so gaitPhase 1 IS the felled frame). A DOWNED (hp≤0) unit
        // HOLDS it forever — the wreck lies where it fell.
        if (e.downed) { e.staggerT = 1; e.locomotion = 'topple'; e.moving = true; e.gaitPhase = 1; e.invincible = false; return true; }
        // an alive unit stays TOPPLED + VULNERABLE for `downPause` sec before the rise — the
        // i-frames start on the getup, NOT here, so a floored suit can be punished for two beats.
        e.downPauseT = 0; e.staggerT = 1;
        e.locomotion = 'topple'; e.moving = true; e.gaitPhase = 1; e.invincible = false; return true;
      }
      // stagger or getup finished → back on its feet, rule resumes.
      // `reactionEnded` is the recovery EDGE a brain rule consumes (the ai dodge-rolls out on it);
      // rules that don't read it just leave it set until the next reaction overwrites it.
      // Rising from a KNOCKDOWN (getup, not a plain stagger) arms the wake guard: `wakeGuard`
      // seconds of invincibility so the floored suit can't be chain-juggled off the ground.
      const rose = e.reactClip === 'getup';
      e.staggerT = null; e.downPauseT = null; e.locomotion = e.staggerReturn || 'forward'; e.reactionEnded = true;
      if (rose && e.wakeGuard > 0) { e.wakeGuardT = e.wakeGuard; e.invincible = true; }
      else e.invincible = false;
      return false;
    }
    e.locomotion = e.reactClip || 'stagger'; e.moving = true; e.gaitPhase = e.staggerT;   // the rooted reaction clip
    e.invincible = (e.reactClip === 'getup');   // i-frames only while getting up (not the fall, the pause, or a stagger)
    return true;
  }

  // combat field hoists off the body onto entity runtime — the S2 normalize extension (called by
  // normalizeEntity in all.js via runNormalizers). Order preserved from the pre-split inline code:
  // poise → collide egg → hpMax → shield.
  registerNormalize((ent) => {
    // hoist poise config off the body onto entity runtime (mirrors hitFlash/hits living on the ent).
    if (ent.body && Number.isFinite(ent.body.poise)) {
      ent.poiseMax = ent.body.poise;
      ent.poise = ent.body.poise;
      ent.poiseRegen = Number.isFinite(ent.body.poiseRegen) ? ent.body.poiseRegen : ent.body.poise * 0.35;   // poise/sec recovered when not reacting
      ent.staggerDur = Number.isFinite(ent.body.staggerDur) ? ent.body.staggerDur : 1.3;                     // sec: hit->buckle->slow-standup (the stagger lurch)
      ent.toppleDur = Number.isFinite(ent.body.toppleDur) ? ent.body.toppleDur : ent.staggerDur * 1.3;       // sec: the topple FALL (hit -> the heap)
      ent.getupDur = Number.isFinite(ent.body.getupDur) ? ent.body.getupDur : ent.staggerDur * 1.4;          // sec: the getup RISE (heap -> back on its feet)
      ent.wakeGuard = Number.isFinite(ent.body.wakeGuard) ? ent.body.wakeGuard : 0;                          // sec of post-knockdown invincibility (R20.4; 0 = none)
      ent.downPause = Number.isFinite(ent.body.downPause) ? ent.body.downPause : 2;                           // sec lying TOPPLED + vulnerable before the getup (i-frames start on the RISE)
      // R23 BOOST ARMOR: stun-resist LEVEL while boosting (each level halves incoming stun; lv1 →
      // a full-stun hit no longer breaks poise in one). Read by boostStunFactor at hit time, gated
      // on the live `e.boosting` the platform rule surfaces. Absent / 0 → no armor (unchanged).
      ent.boostArmor = Number.isFinite(ent.body.boostArmor) && ent.body.boostArmor > 0 ? ent.body.boostArmor : 0;
    }
    // SUIT-vs-SUIT collision volume (opt-in `body.collide`) — the hitbox-EGG principle reused for
    // MOVEMENT: an axis-aligned ellipsoid `{ a (lateral), c (vertical), cz? }`, feet-anchored (center =
    // pos + cz·up, cz default c) so a tall suit collides like a suit, not a fat sphere. A plain number
    // is an isotropic sphere (cz 0, centered at pos). Absent → the body is non-solid to other bodies
    // (byte-identical to pre-collision worlds). Consumed by stepBodyCollisions.
    const cv = ent.body && ent.body.collide;
    if (cv && typeof cv === 'object' && Number.isFinite(cv.a) && cv.a > 0 && Number.isFinite(cv.c) && cv.c > 0) {
      ent.collideVol = { a: cv.a, c: cv.c, cz: Number.isFinite(cv.cz) ? cv.cz : cv.c };
    } else if (Number.isFinite(cv) && cv > 0) {
      ent.collideVol = { a: cv, c: cv, cz: 0 };
    }
    // HP MAX: capture the body's starting hp once (weapons/melee/projectiles chip `body.hp` in place,
    // floored at 0, never healed), so the health-bar HUD has a denominator. Current hp stays on
    // `body.hp`; this is the max. Absent hp → no bar (byte-identical).
    if (ent.body && Number.isFinite(ent.body.hp) && ent.body.hp > 0) ent.hpMax = ent.body.hp;
    // R19 SHIELD: a frontal, flankable, DESTRUCTIBLE damage buffer (body.shield = { hp, arc? }).
    // Runtime state rides the entity (like poise); no regen — once broken it stays destroyed.
    const sh = ent.body && ent.body.shield;
    if (sh && Number.isFinite(sh.hp)) {
      ent.shieldMax = sh.hp; ent.shieldHp = sh.hp;
      ent.shieldArc = Number.isFinite(sh.arc) ? sh.arc * Math.PI / 180 : Math.PI * 0.6;   // covered arc (deg→rad; default 108°)
      ent.shieldBroken = false; ent.shieldBreakAt = -1;
    }
  });

  // hit reaction FIRST among the body owners: a staggered unit's rule + weapon are suppressed.
  registerBodyOwner('reaction', (e, input, dt) => stepReaction(e, input, dt), 10);

  Object.assign(E, {
    isFlatToppled, latR, eggLean, eggAxis, hitEgg, pointInEgg, hullZ,
    shieldCovers, absorbShield, breakGuards, boostStunFactor, armReaction, beginDodge, stepReaction,
  });
}
