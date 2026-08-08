/**
 * ms-ai.js — the mobile-suit AI pack (controllable-split.plan.md, S4). The fire-back hunter rule
 * (ground standoff + boost juke + melee-seek + 6DoF space seek), its two-hit melee strings, the
 * named DIFFICULTY tiers (accuracy / latency / aggression detunes), the world-level AI-attack
 * toggle, and the difficulty resolve at createWorld. Pack-absent: `ai` is simply not a known
 * rule, and state.aiTuning stays null.
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; ms-maneuvers precedes this
 * (armSwitchReady). Field ownership: the e.ai- family (aiFire, aiClock, the wobble/juke/boost
 * clocks, ranged rotation picks, melee commit/give-up timers, combo chain), the NEWTYPE tackle-guard
 * (e.tackleT/tackleDir/tackleHits/tackleCount + the e.tackleCdT re-charge, shared with the platform
 * tackle fields so stepTackle adjudicates an ai charge identically), state.aiTuning/aiEnabled.
 */

export function buildMsAi(E) {
  const {
    clamp, fwdXY, rightXY, fwd3, TAU, sightBlocked, resolveBlocking, RULES,
    armSwitchReady, meleeSwingSpec, breakGuards, registerPreStep, registerStateInit,
  } = E;

  // beginAiSwingDir(e, sc, r, dir, isCombo, noTopple) — throw ONE melee swing in a given direction.
  // Stashes the swing's duration + cooldown on the entity so the ai rule's swing-playback advances it
  // without the config in hand. stepMelee (stepWorld) adjudicates the hit during the contact window.
  // A combo FINISHER (`isCombo`) forces the TOPPLE (the downswing floors on connect — the string's
  // payoff); `noTopple` (the easy difficulty tier) strips the knockdown off whatever verb was thrown.
  function beginAiSwingDir(e, sc, r, dir, isCombo, noTopple) {
    const spec = meleeSwingSpec(sc, r, dir, isCombo);
    if (isCombo) spec.params.topple = true;   // the downswing finisher knocks down
    if (noTopple) spec.params.topple = false;   // easy tier: the cut lands (damage + stagger), never floors
    e.swingT = 0; e.swingClip = spec.clip; e.strikeParams = spec.params;
    e.struckThisSwing = {}; e.swingCount = (e.swingCount || 0) + 1; e.swingCombo = isCombo;
    e.lastSwingDir = dir;       // combo-string memory stays coherent if the pilot takes this suit over
    e.swingDur = sc.strikeDur ?? r.strikeDur ?? 0.9;
    e.swingCd = sc.strikeCooldown ?? r.strikeCooldown ?? 0;
    breakGuards(e);   // attacking spends any protection (spawn shield / wake guard / dodge i-frames)
  }
  // beginAiSwing(e, sc, r, dif) — the AI opens a melee attack. On a COMBO slot (`combo:1`) it throws a
  // TWO-HIT string: an OPENER (a neutral or alternating side cut — a setup hit) then, chained on
  // completion in the swing playback, a DOWNSWING finisher that topples. A single-hit slot (no combo)
  // keeps the classic `back` great-cleave → a topple on connect. `aiComboWant` flags the pending chain.
  // A `noTopple` difficulty tier (easy) still MELEES but never throws the knockdown: the combo chain
  // is skipped (its finisher IS the topple) and the single-hit path swaps the toppling back-cleave
  // for the opener cuts — damage and stagger land, the suit stays on its feet.
  function beginAiSwing(e, sc, r, dif) {
    const noTopple = !!(dif && dif.noTopple);
    // the 2-hit string is DEFAULT-ON for the ai melee-seek (opt out with `r.meleeCombo:false` → the
    // single classic great-cleave). It needs the neutral/left/right + back swing clips, which the suit
    // roster all bake; a suit missing them degrades to swing_neutral in the renderer (still lands).
    if (r.meleeCombo !== false || noTopple) {
      e.aiSwingAlt = (e.aiSwingAlt || 0) + 1;
      const opener = (e.aiSwingAlt % 3 === 0) ? 'neutral' : (e.aiSwingAlt % 3 === 1 ? 'left' : 'right');   // neutral / side, varied
      beginAiSwingDir(e, sc, r, opener, false, noTopple);
      if (noTopple) {
        // the lone opener still PAYS the combo-string pacing: without this, a slot that skips
        // `strikeCooldown` would let the easy tier chain cuts back-to-back and out-swing max.
        e.swingCd = Math.max(e.swingCd || 0, (sc && sc.comboCooldown) ?? r.comboCooldown ?? 2.5);
        e.aiComboWant = false;
        return;
      }
      e.aiComboWant = true; e.aiComboCfg = sc; e.aiComboRule = r;   // chain the downswing when the opener completes
      e.aiComboCooldown = (sc && sc.comboCooldown) ?? r.comboCooldown ?? 2.5;
    } else {
      beginAiSwingDir(e, sc, r, 'back', false);   // single hit: the classic toppling great-cleave
      e.aiComboWant = false;
    }
  }

  // ai — the fire-back hunter (mobile-suit R20; R25 6DoF space seek): the AMBIENT brain of a vacated
  // pilotable suit. On the ground it TURNS toward the current pilot, CLOSES to a standoff range on the
  // XY plane; in SPACE (`rule.space`) it SEEKS IN 3D — flying the full vector to the target (closing
  // altitude too) and juking in 3D — and gates its trigger on the full 3D aim. Each frame it
  // AIMS (heading + pitch at the target's egg center — the shot ray follows both), and works its
  // own trigger on a burst/pause cadence. `e.aiFire` is this entity's PRIVATE fire input: stepWorld
  // routes it (never the global input) into stepWeapon for an ai-ruled entity, so the pilot's
  // trigger can't fire an AI suit and an AI suit can't drain the pilot's magazine — the R9
  // no-ghost-fire invariant, kept both ways. On recovering from a stagger it DODGE-ROLLS out of
  // the line of fire, sides alternating (deterministic, no dice). Vacated on a weaponless (melee)
  // slot it self-switches to its first trigger slot — the ai is ranged-only v1. Pure: same
  // state + dt → same decisions.
  function ai(e, input, dt, world) {
    const r = e.rule;
    const t = e.transform;
    const speed = r.speed ?? 6, strideLen = r.stride ?? 2.4, eye = r.eye ?? 0;
    // difficulty tier (world.aiTuning, see AI_DIFFICULTY below ai()) — null is the max brain.
    const dif = (world && world.aiTuning) || null;
    e.aiFire = 0;
    e.thrust = 0; e.thrustYaw = 0; e.boosting = false;   // reset per frame; a boost burst (R23, opt-in r.boost) re-arms them
    const f = fwdXY(t.heading), rt = rightXY(t.heading);
    // an in-flight dodge OWNS the body (same commitment as the platform dodge: no re-aim, i-frames,
    // the renderer tumbles the rig about the maneuver axis).
    if (e.dodgeT != null) {
      e.dodgeT += dt / (r.dodgeDur ?? 0.55);
      if (e.dodgeT >= 1) { e.dodgeT = null; e.tumble = null; e.invincible = false; e.dodgeDir = null; }
      else {
        const env = Math.sin(Math.min(1, e.dodgeT) * Math.PI);
        const dsp = (r.dodgeSpeed ?? speed * 2.6) * env * dt;
        if (e.dodgeDir) { t.pos[0] += e.dodgeDir[0] * dsp; t.pos[1] += e.dodgeDir[1] * dsp; }
        // ground roll hugs the terrain; a SPACE roll holds its altitude — the probe would
        // otherwise glue the suit onto whatever hull happens to lie below the maneuver.
        const gd = !r.space && world && world.ground ? world.ground(t.pos) : null;
        if (gd != null) t.pos[2] = gd + eye;
        e.locomotion = e.dodgeClip || 'dodge_sideroll'; e.moving = true; e.invincible = !e.dodgeSpent; e.gaitPhase = 0;
        const ang = Math.min(1, e.dodgeT) * (r.dodgeTurns ?? 1) * TAU;
        e.tumble = { axis: [f[0] * (e.dodgeSign || 1), f[1] * (e.dodgeSign || 1), 0], angle: ang };   // barrel-roll about forward (the side roll)
        return;
      }
    }
    // AI TACKLE PLAYBACK (NEWTYPE body-check): a committed charge along `e.tackleDir` that OWNS the
    // body exactly like the platform tackle — invincible, no re-aim, the boost pose — for the whole
    // clock. The ai rule owns the START + this advance (the platform tackle-dash maneuver is
    // platform-only); stepTackle (an entity action, run for EVERY entity after the rule) adjudicates
    // the ram and the COUNTER (charge beats a live swing → stuff the melee, boost refund, and, when the
    // pilot is caught, the shove-down cinematic — all already built). stepTackle also STOPS the charge
    // on the first suit it rams (nulls tackleT), so this block naturally yields the frame it connects.
    if (e.tackleT != null) {
      e.tackleT += dt / (r.tackleDur ?? 2);
      if (e.tackleT >= 1) { e.tackleT = null; e.tackleDir = null; if (e.cineT == null) e.invincible = false; }
      else {
        const tsp = (r.tackleSpeed ?? r.boostSpeed ?? speed * 3.5) * dt;
        if (e.tackleDir) { t.pos[0] += e.tackleDir[0] * tsp; t.pos[1] += e.tackleDir[1] * tsp; if (r.space && e.tackleDir[2]) t.pos[2] += e.tackleDir[2] * tsp; }
        if (!r.space && world && world.ground) { const g = world.ground([t.pos[0], t.pos[1], (t.pos[2] - eye) + (r.collideHeight ?? 24)]); if (g != null) t.pos[2] = g + eye; }
        e.locomotion = 'boost'; e.moving = true; e.invincible = true; e.tumble = null;
        e.gaitPhase = (e.gaitPhase || 0) + tsp / strideLen; e.boosting = true; e.thrust = 1;
        return;
      }
    }
    // MELEE SWING PLAYBACK (melee-seek): a swing OWNS the body — advance its phase, hold the swing clip,
    // stay rooted (stepMelee in stepWorld reads swingT + strikeParams and lands the connect during the
    // contact window). On completion, arm the cooldown. Runs BEFORE the stand-down gate so an in-flight
    // swing always finishes. Keeps footing via the same head-height cast the seek uses.
    if (e.swingT != null) {
      e.swingT += dt / (e.swingDur || 0.9);
      e.locomotion = e.swingClip || 'swing_neutral'; e.moving = true; e.gaitPhase = Math.min(1, e.swingT); e.aiFire = 0;
      if (!r.space && world && world.ground) { const g = world.ground([t.pos[0], t.pos[1], (t.pos[2] - (r.eye ?? 0)) + (r.collideHeight ?? 24)]); if (g != null) t.pos[2] = g + (r.eye ?? 0); }
      if (e.swingT >= 1) {
        // 2-HIT COMBO: the OPENER (neutral/side) chains straight into the DOWNSWING finisher instead of
        // returning to idle; the finisher then arms the longer combo cooldown. A non-combo swing (or the
        // finisher itself) ends the string and arms the base cooldown.
        if (e.aiComboWant && !e.swingCombo && e.aiComboCfg) {
          e.aiComboWant = false;
          beginAiSwingDir(e, e.aiComboCfg, e.aiComboRule || r, 'back', true);   // `back` = the committed overhead straight-DOWN cleave (the downswing), topples
        } else {
          const wasCombo = e.swingCombo;
          e.swingT = null; e.locomotion = 'forward'; e.moving = false; e.aiComboWant = false;
          e.strikeCdT = wasCombo ? (e.aiComboCooldown ?? e.swingCd ?? 0) : (e.swingCd > 0 ? e.swingCd : (e.strikeCdT || 0));
        }
      }
      return;
    }
    // AI ATTACK TOGGLE (world-level `aiEnabled`, flipped by input.aiToggle / seeded by manifest
    // `ai:'off'`): switched off, the brain STANDS DOWN — holds the armed idle where it is, trigger
    // cold. An in-flight dodge (above) still completes; the recovery edge is dropped so a stagger
    // taken while passive doesn't fire a stale dodge when the switch comes back on.
    if (world && world.aiEnabled === false) { e.moving = false; e.reactionEnded = false; return; }
    // TARGET SELECTION (arena M2): the default hunts the PILOT (the R20 behavior, byte-identical).
    // `target:'all'` on the rule makes this a FREE-FOR-ALL brain: it hunts the nearest live
    // hittable body that isn't itself — AI suits fight each other, and the pilot is just one more
    // contender (an AI can win the match). `target:'enemy'` is the same nearest-hunt but TEAM-AWARE:
    // a suit with a `team` skips same-team bodies, so allies never become the target (the team-battle
    // brain). Deterministic: nearest by flat distance, ties broken by entity order. Downed wrecks and
    // i-frame bodies are skipped, so a fresh respawn keeps its protection window while the brain swings
    // to the next threat.
    let target = null;
    if (world && world.byId) {
      if (r.target === 'all' || r.target === 'enemy') {
        const teamAware = r.target === 'enemy' && e.team;
        let bd = Infinity;
        for (const id in world.byId) {
          const o = world.byId[id];
          if (o === e || o.isCamera || o.downed || o.invincible || !(o.body && o.body.hittable)) continue;
          if (teamAware && o.team && o.team === e.team) continue;   // TEAM: never hunt an ally
          const ddx = o.transform.pos[0] - t.pos[0], ddy = o.transform.pos[1] - t.pos[1];
          const dd = ddx * ddx + ddy * ddy;
          if (dd < bd) { bd = dd; target = o; }
        }
      } else if (world.pilotId) target = world.byId[world.pilotId];
    }
    if (!target || target === e) { e.moving = false; e.reactionEnded = false; return; }
    const dx = target.transform.pos[0] - t.pos[0], dy = target.transform.pos[1] - t.pos[1];
    const dist2d = Math.hypot(dx, dy) || 1e-6;
    // DODGE-OUT on stagger recovery: stepReaction stamps `reactionEnded` when a reaction completes;
    // the ai consumes the edge as "I just got tagged — get off the firing line": a committed side
    // roll PERPENDICULAR to the threat direction, alternating sides each time.
    if (e.reactionEnded) {
      e.reactionEnded = false;
      // the ai roll pays the same dodge cooldown as the pilot (2026-07-27) — a freshly-spent
      // dodge means the recovery edge passes and the hunt resumes without the escape roll.
      if (r.dodge !== false && (e.dodgeCdT || 0) <= 0) {
        e.aiDodgeSide = e.aiDodgeSide === 1 ? -1 : 1;
        const ux = dx / dist2d, uy = dy / dist2d;
        e.dodgeDir = [-uy * e.aiDodgeSide, ux * e.aiDodgeSide];
        const sd = e.dodgeDir[0] * rt[0] + e.dodgeDir[1] * rt[1];   // body-frame side (the tumble sign)
        e.dodgeT = 0; e.dodgeClip = 'dodge_sideroll'; e.dodgeKind = 'side'; e.dodgeSign = sd < 0 ? -1 : 1;
        e.dodgeSpent = false; e.dodgeCdT = (r.dodgeCooldown ?? 8) * (dif ? dif.dodgeCdMul : 1);
        e.dodgeCount = (e.dodgeCount || 0) + 1;
        // committed from THIS frame (i-frames + the roll clip), like the platform dodge
        e.locomotion = 'dodge_sideroll'; e.invincible = true; e.gaitPhase = 0; e.moving = true;
        return;
      }
    }
    // POST-CLASH DASH-AWAY (stepClash armed `clashRetreat` on a ground clash break): throw a committed
    // roll BACK off the clash line and hand the fight to shooting (meleeGiveUp is already armed) — the
    // "cross blades, break, reposition" beat, so duels don't relock into an endless clash.
    if (e.clashRetreat) {
      e.clashRetreat = false;
      if (r.dodge !== false && (e.dodgeCdT || 0) <= 0) {
        e.aiDodgeSide = e.aiDodgeSide === 1 ? -1 : 1;
        const ux = dx / dist2d, uy = dy / dist2d;
        // backward off the line, blended with a perpendicular sidestep (each orthogonal, ~unit length)
        e.dodgeDir = [(-ux - uy * e.aiDodgeSide) * 0.7071, (-uy + ux * e.aiDodgeSide) * 0.7071];
        const sd = e.dodgeDir[0] * rt[0] + e.dodgeDir[1] * rt[1];
        e.dodgeT = 0; e.dodgeClip = 'dodge_sideroll'; e.dodgeKind = 'side'; e.dodgeSign = sd < 0 ? -1 : 1;
        e.dodgeSpent = false; e.dodgeCdT = (r.dodgeCooldown ?? 8) * (dif ? dif.dodgeCdMul : 1);
        e.dodgeCount = (e.dodgeCount || 0) + 1;
        e.locomotion = 'dodge_sideroll'; e.invincible = true; e.gaitPhase = 0; e.moving = true;
        return;
      }
    }
    // AUTO-TACKLE THE RAW MELEE (NEWTYPE `tackleGuard`): the target is committing a RAW melee — a live
    // swing carrying strike params (a throw carries none), not already reeling — and the brain is FREE
    // (guaranteed here: a stagger/clash/cine OWNS the body and ai() never runs; an in-flight dodge/swing/
    // tackle already returned above). The counter reads charge-beats-swing, so the brain answers a raw
    // swing with a body-check straight down the target line: it squares up + fires a tackle, and
    // stepTackle STUFFS the swing (topple + boost refund; the pilot gets the shove-down cinematic). A
    // brief cooldown (`aiTackleCooldown`) keeps a whiff from re-charging every frame. Rolling the swing
    // instead beats it for free — a dodge's i-frames make the target un-hittable, so the tackle passes
    // through (stepTackle skips `invincible`); which is exactly why the brain restrains its OWN melee
    // below. Gated on `tackleGuard` → only NEWTYPE; every other tier is byte-identical.
    if (dif && dif.tackleGuard && (e.tackleCdT || 0) <= 0
        && target.swingT != null && target.strikeParams && target.staggerT == null && !target.downed) {
      const tspeed = r.tackleSpeed ?? r.boostSpeed ?? speed * 3.5;
      const mdz0 = target.transform.pos[2] - t.pos[2];
      const tdist = r.space ? Math.hypot(dx, dy, mdz0) : dist2d;
      // within a charge's reach for the swing's window (~0.6 of the dash) → commit the body-check
      if (tdist < (r.tackleReach ?? 8) + tspeed * (r.tackleDur ?? 2) * 0.6) {
        const ux = dx / dist2d, uy = dy / dist2d;
        e.tackleDir = r.space ? (() => { const n = Math.hypot(dx, dy, mdz0) || 1e-6; return [dx / n, dy / n, mdz0 / n]; })() : [ux, uy];
        t.heading = Math.atan2(dy, dx);   // square up so stepTackle's front-cone catches the swinger
        e.tackleT = 0; e.tackleHits = {};
        e.tackleCount = (e.tackleCount || 0) + 1;   // audio WHOOMPH edge (like the platform tackle)
        e.tackleCdT = r.aiTackleCooldown ?? 1.5;
        e.invincible = true; e.tumble = null; e.locomotion = 'boost'; e.moving = true; e.gaitPhase = 0;
        return;
      }
    }
    // vacated on a weaponless (melee) slot → self-switch to the first TRIGGER slot (`throw` slots
    // skipped: the toss rides a swing clip the ai doesn't play). Same fields the platform switch
    // writes. A non-pilotable ai seat (arena opponents) has no pilotRule — its own rule carries the
    // loadout, so fall through to it.
    const lo = e.pilotRule && Array.isArray(e.pilotRule.loadout) ? e.pilotRule.loadout
      : (e.rule && Array.isArray(e.rule.loadout) ? e.rule.loadout : null);
    // MELEE-SEEK (opt-in `r.meleeSeek`, ground AND space since 2026-08-04 — the operator asked for
    // space blades; the 3D charge below + stepMelee's 3D contact were already built): a suit that
    // carries a melee slot commits to a
    // CLOSE-AND-TOPPLE when the target is in reach — and SPRINTS in (boost) on a target that's already
    // reeling (staggered/knocked), the free opening. Purely additive: a rule without `meleeSeek`, or a
    // suit with no `strike:'melee'` slot (a pure shooter), never enters this and stays byte-identical.
    // The commit is re-evaluated each frame; while committed it holds the melee slot instead of the
    // auto-switch back to a trigger weapon below.
    // MELEE GIVE-UP (opt-in `r.meleeTimeout` / `r.meleeGiveUp`, default 5s / 4s): a hunter that
    // commits to melee but can't LAND it within meleeTimeout seconds abandons the blade and goes
    // back to SHOOTING for meleeGiveUp seconds — so it never loops chasing an evasive or UNREACHABLE
    // (e.g. perched/elevated) target forever. The give-up window decays each frame; while it runs the
    // melee slot is off the table (meleeCfg null → the ranged auto-switch + trigger below take over).
    if (e.meleeGiveUpT > 0) e.meleeGiveUpT = Math.max(0, e.meleeGiveUpT - dt);
    const meleeCfg = (r.meleeSeek && lo && (e.strikeCdT || 0) <= 0 && !(e.meleeGiveUpT > 0))
      ? lo.find((c) => c && c.strike === 'melee') : null;
    const meleeReach = meleeCfg ? (meleeCfg.strikeReach ?? r.strikeReach ?? speed) : 0;
    const targetReeling = !!target.staggerT && !target.downed;   // mid-stagger / toppling, still a live body
    // ELEVATION GATE (GROUND ONLY): a blade can't reach a target perched well ABOVE the hunter — beyond
    // `meleeVReach` vertically it stays a SHOOTER (it aims its pitch up and fires uphill via the trigger)
    // instead of chasing a melee it can never complete. In SPACE there is no unreachable perch — the
    // hunter flies to the target's altitude — so the gate is off and melee RANGE is measured in 3D (the
    // close-in below flies the full vector, closing altitude too).
    const meleeVReach = r.meleeVReach ?? (r.collideHeight ?? 24) * 1.5;
    const mdz = target.transform.pos[2] - t.pos[2];
    const targetHigh = !r.space && Math.abs(mdz) > meleeVReach;
    const meleeDist = r.space ? Math.hypot(dx, dy, mdz) : dist2d;
    // MELEE RESTRAINT (NEWTYPE `tackleGuard`): the brain FEARS the tackle mirror — a raw swing at a
    // free target invites the same charge-beats-swing stuff it dishes out — so it only draws the blade
    // when the target CAN'T tackle back: mid-roll (`dodgeT` — dodge i-frames own the body, no tackle
    // possible) or already reeling. A standing player is left to the guns; roll (or eat a stagger) and
    // the blade comes out to punish the recovery. Other tiers: always true (unchanged commit).
    const targetSafeMelee = !(dif && dif.tackleGuard) || target.dodgeT != null || targetReeling;
    // commit when within melee range, or sprint in on a reeling target inside a wider punish band.
    const meleeCommit = !!meleeCfg && !target.downed && !targetHigh && targetSafeMelee
      && (meleeDist < meleeReach * 3 || (targetReeling && meleeDist < meleeReach * 9));
    // MELEE COMMIT CLOCK: tick while committed; past meleeTimeout without a swing landing (a swing
    // resets it, at beginAiSwing) → arm the give-up window so the following frames revert to shooting.
    if (meleeCommit) {
      e.meleeCommitT = (e.meleeCommitT || 0) + dt;
      if (e.meleeCommitT >= (r.meleeTimeout ?? 5)) { e.meleeGiveUpT = r.meleeGiveUp ?? 4; e.meleeCommitT = 0; }
    } else e.meleeCommitT = 0;
    if (meleeCommit) {
      const idx = lo.indexOf(meleeCfg);   // switch to the melee slot (weaponless → fire route falls to the strike)
      if ((e.loadoutIdx || 0) !== idx) {
        e.loadoutIdx = idx; e.weapon = e.loadoutWeapons ? e.loadoutWeapons[idx] : null;
        if (e.body && meleeCfg.figure) e.body.figure = meleeCfg.figure;
        armSwitchReady(e, r, meleeCfg);   // the ai pays the switch ready-time too (it draws the blade, then swings)
      }
    } else if (e.loadoutWeapons && lo) {
      // RANGED WEAPON ROTATION: instead of camping slot 0, the ai CYCLES its trigger guns (rifle →
      // bazooka → beam …) so it varies fire. The ranged slots are the ones carrying a weapon that
      // isn't a THROW (grenade lobs ride a swing clip the ai can't play) — melee is handled above.
      // With ≥2 ranged slots it advances the pick every `weaponRotate` sec (default 6, comfortably
      // longer than the switch ready-time so it isn't perpetually holding fire); a single-gun loadout
      // just selects its one slot when unarmed, byte-identical to the old behavior.
      const ranged = [];
      for (let i = 0; i < e.loadoutWeapons.length; i++) if (e.loadoutWeapons[i] && !lo[i].throw) ranged.push(i);
      if (ranged.length) {
        if (e.aiRangedPick == null) { const cur = ranged.indexOf(e.loadoutIdx || 0); e.aiRangedPick = cur >= 0 ? cur : 0; }
        if (ranged.length > 1) {
          e.aiWeaponT = (e.aiWeaponT || 0) + dt;
          if (e.aiWeaponT >= (r.weaponRotate ?? 6)) { e.aiWeaponT = 0; e.aiRangedPick = (e.aiRangedPick + 1) % ranged.length; }
        }
        const want = ranged[e.aiRangedPick % ranged.length];
        if (!e.weapon || (e.loadoutIdx || 0) !== want) {
          e.loadoutIdx = want; e.weapon = e.loadoutWeapons[want];
          if (e.body && lo[want].figure) e.body.figure = lo[want].figure;
          armSwitchReady(e, r, lo[want]);   // switching to a ranged slot: hold fire for the ready-time (slot switchReady wins)
        }
      }
    }
    // turn toward the target (shortest way), capped at `turn` rad/s; pitch the aim at the egg center.
    const want = Math.atan2(dy, dx);
    let dh = ((want - t.heading + Math.PI) % TAU + TAU) % TAU - Math.PI;
    const maxTurn = (r.turn ?? 1.8) * dt;
    t.heading += clamp(dh, -maxTurn, maxTurn);
    const rem = ((want - t.heading + Math.PI) % TAU + TAU) % TAU - Math.PI;   // residual off-aim after the turn
    const w = e.weapon;
    const tb = target.body || {};
    const tcz = tb.egg ? (Number.isFinite(tb.egg.cz) ? tb.egg.cz : tb.egg.c) : (tb.radius || 0);
    t.pitch = clamp(Math.atan2((target.transform.pos[2] + tcz) - (t.pos[2] + (w ? w.eye || 0 : 0)), dist2d), -1.2, 1.2);
    // MOVE TO ATTACK. Baseline: close to `standoff` while facing, then HOLD (the armed ready idle
    // plays when moving is false). With opt-in BOOST (`r.boost`, R23) the hunter instead JUKE-BOOSTS
    // in bursts — `boostBurst` sec of evasive lateral boosting (it weaves side to side AND, because
    // it is thrusting, its `body.boostArmor` is LIVE, so a single beam bolt / bazooka shell no longer
    // stuns it) then `boostRest` sec grounded and stunnable. So the same enemy shows BOTH reads: shoot
    // it mid-boost and the stun is shrugged; catch it on the rest beat and it staggers. `e.boosting`
    // drives the boost-armor mitigation + the backpack flame; the walk fallback is byte-identical.
    // R25: in SPACE the hunter seeks in 3D — the FULL vector to the target (climb/dive to its
    // altitude), gated on the 3D distance. On the ground it's the XY-plane read, byte-identical.
    const isSpace = !!r.space;
    const dz = target.transform.pos[2] - t.pos[2];
    const dist3d = Math.hypot(dx, dy, dz) || 1e-6;
    const rangeD = isSpace ? dist3d : dist2d;
    // CLOSING-IN STRATEGY (per active weapon): tie the hunter's SPACING to the gun it holds so
    // weapon rotation makes it press in and fall back in turns — a spray gun RUSHES to short range,
    // a rifle/beam SKIRMISHES at mid, a bazooka/lob SIEGES from afar. That shifting spacing is what
    // turns two circling suits into a real engagement (emergent duels in AI battle). Style comes from
    // the weapon's fireClass; a per-slot `approach:{style,standoff,close,weave}` override wins; an
    // explicitly tuned `r.standoff` still pins the distance. `close` = inward bias when out of
    // position (higher → charges harder), `weave` = how much lateral strafe rides the boost juke
    // (rush weaves little and drives in; siege weaves wide and holds). Skirmish ≈ the old behavior.
    // The profile is [standoffMul, close, weave] applied over a BASE standoff (the world's tuned
    // `r.standoff`, else 0.42·weapon-range) so an explicitly-tuned arena still gets per-weapon
    // variety AROUND its distance: rush pulls the hold in to ~half, siege pushes it out ~1.5×,
    // skirmish ≈ the base (old behavior). A per-slot `approach.standoff` pins an absolute distance.
    const aSlot = lo ? lo[e.loadoutIdx || 0] : null;
    const aOv = (aSlot && aSlot.approach) || null;
    const aStyle = (aOv && aOv.style) || (!w ? 'skirmish' : w.fireClass === 'lob' ? 'siege' : w.fireClass === 'area' ? 'rush' : 'skirmish');
    const aProf = ({ rush: [0.48, 1.0, 0.45], skirmish: [1.0, 0.7, 1.0], siege: [1.55, 0.6, 1.15] })[aStyle] || [1.0, 0.7, 1.0];
    const baseStandoff = r.standoff != null ? r.standoff : (w ? (w.range || 400) * 0.42 : speed * 8);
    // difficulty AGGRESSION detune: a lower tier holds farther out and presses in less.
    const standoff = (w ? (Number.isFinite(aOv && aOv.standoff) ? aOv.standoff : baseStandoff * aProf[0]) : baseStandoff) * (dif ? dif.standoffMul : 1);
    const closeBias = (Number.isFinite(aOv && aOv.close) ? aOv.close : aProf[1]) * (dif ? dif.closeMul : 1);
    const weaveMul = Number.isFinite(aOv && aOv.weave) ? aOv.weave : aProf[2];
    const f2 = fwdXY(t.heading), rt2 = rightXY(t.heading), facing = Math.abs(rem) < 1.1;
    let boostBurst = false;
    if (r.boost) {
      // difficulty AGGRESSION detune: less boost-juke uptime, longer stunnable rest beats.
      const bb = (r.boostBurst ?? 2.5) * (dif ? dif.boostBurstMul : 1), brest = (r.boostRest ?? 1.6) * (dif ? dif.boostRestMul : 1), cyc = Math.max(0.1, bb + brest);
      e.aiBoostClock = (e.aiBoostClock || 0) + dt;
      boostBurst = (e.aiBoostClock % cyc) < bb;
    }
    let moveMag = 0, clip = 'forward';
    if (meleeCommit) {
      // CLOSE THE GAP, then STRIKE. Beyond reach: charge in — BOOST if the target is reeling (punish the
      // opening) or still a way off, otherwise march (walk-seek). Within reach + on-aim: throw the
      // back-cleave → a TOPPLE on connect. Firing is naturally off here (the melee slot carries no weapon).
      if (meleeDist > meleeReach * 0.85) {
        const canBoost = !!(r.boost || r.boostSpeed);   // AGGRESSIVE: boost the WHOLE close (was: only a reeling/far target)
        const spd = (canBoost ? (r.boostSpeed ?? speed * 3.5) : speed) * dt;
        if (facing) {
          if (r.space) {
            // 3D CHARGE: fly the full vector to the target (close the altitude gap too), no ground snap.
            const ux = dx / meleeDist, uy = dy / meleeDist, uz = mdz / meleeDist;
            t.pos[0] += ux * spd; t.pos[1] += uy * spd; t.pos[2] += uz * spd; moveMag = spd;
            clip = 'boost'; if (canBoost) { e.boosting = true; e.thrust = 1; } else e.thrust = Math.max(e.thrust, 0.5);
          } else {
            t.pos[0] += f2[0] * spd; t.pos[1] += f2[1] * spd; moveMag = spd;
            if (canBoost) { clip = 'boost'; e.boosting = true; e.thrust = 1; } else clip = 'forward';
          }
        }
      } else if (facing && (e.readyT || 0) <= 0) {
        beginAiSwing(e, meleeCfg, r, dif);   // in reach + on line + past the switch ready-time → the toppling great-cleave (or a noTopple cut on easy)
        e.meleeCommitT = 0;             // a swing landed the commit — restart the give-up clock for the next approach
      }
    } else if (isSpace) {
      // R25 — 6DoF SEEK: fly along the full 3D vector to the target (closing altitude AND plane). During
      // a boost burst juke in 3D (horizontal strafe + a vertical weave); otherwise thrust toward standoff.
      // No gait/ground — the flight clips carry it. Station colliders aren't blocked for the ai v1 (open
      // void; the seek keeps it near the fight — stated in the plan).
      const ux = dx / dist3d, uy = dy / dist3d, uz = dz / dist3d;
      if (boostBurst) {
        const jp = r.jukePeriod ?? 0.9;
        e.aiJukeClock = (e.aiJukeClock || 0) + dt;
        if (e.aiJukeClock >= jp) { e.aiJukeClock = 0; e.aiJukeSide = e.aiJukeSide === 1 ? -1 : 1; }
        const side = e.aiJukeSide || 1;
        const bias = dist3d > standoff ? closeBias : dist3d < standoff * 0.55 ? -closeBias : 0;   // per-weapon: rush drives in, siege holds
        const vWeave = Math.sin((e.aiBoostClock || 0) * 2.4) * 0.5;                    // gentle up/down evasion
        let mvx = rt2[0] * side * weaveMul + ux * bias, mvy = rt2[1] * side * weaveMul + uy * bias, mvz = vWeave + uz * bias;
        const mn = Math.hypot(mvx, mvy, mvz) || 1; mvx /= mn; mvy /= mn; mvz /= mn;
        const bstep = (r.boostSpeed ?? speed * 3.5) * dt;
        t.pos[0] += mvx * bstep; t.pos[1] += mvy * bstep; t.pos[2] += mvz * bstep;
        moveMag = bstep;
        clip = Math.abs(mvx * rt2[0] + mvy * rt2[1]) > 0.4 ? (side > 0 ? 'boost_right' : 'boost_left') : 'boost';
        e.boosting = true; e.thrust = 1;
      } else if (dist3d > standoff && facing) {
        const step = speed * dt;
        t.pos[0] += ux * step; t.pos[1] += uy * step; t.pos[2] += uz * step;
        moveMag = step; clip = 'boost'; e.thrust = Math.max(e.thrust, 0.5);
      }
    } else if (boostBurst) {
      // weave: flip the strafe side every `jukePeriod`, biased in/out to hold the standoff band
      const jp = r.jukePeriod ?? 0.9;
      e.aiJukeClock = (e.aiJukeClock || 0) + dt;
      if (e.aiJukeClock >= jp) { e.aiJukeClock = 0; e.aiJukeSide = e.aiJukeSide === 1 ? -1 : 1; }
      const side = e.aiJukeSide || 1;
      const bias = dist2d > standoff ? closeBias : dist2d < standoff * 0.55 ? -closeBias : 0;   // per-weapon: rush drives in, siege holds
      let mvx = rt2[0] * side * weaveMul + f2[0] * bias, mvy = rt2[1] * side * weaveMul + f2[1] * bias;
      const mn = Math.hypot(mvx, mvy) || 1; mvx /= mn; mvy /= mn;
      const bstep = (r.boostSpeed ?? speed * 3.5) * dt;
      t.pos[0] += mvx * bstep; t.pos[1] += mvy * bstep;
      moveMag = bstep;
      clip = Math.abs(mvx * rt2[0] + mvy * rt2[1]) > 0.5 ? (side > 0 ? 'boost_right' : 'boost_left') : 'boost';
      e.boosting = true; e.thrust = 1;
    } else {
      let moveF = 0;
      if (dist2d > standoff && facing) moveF = speed * dt;
      if (moveF) { t.pos[0] += f2[0] * moveF; t.pos[1] += f2[1] * moveF; }
      moveMag = moveF;
    }
    if (!isSpace && world && world.colliders) resolveBlocking(t.pos, t.pos[2] - eye, r.collideHeight ?? 24, r.collideRadius ?? 0, world.colliders, r.step ?? 0.35);
    if (!isSpace) {
      // GROUND SNAP — cast from HEAD height (foot + body height), not from the current z, so the hunter
      // finds the surface UNDER ITS BODY. The ai has no gravity: a plain down-cast from the current z
      // can only find surfaces BELOW it, so the instant it walks/boosts onto RISING terrain (a slope,
      // a ramp) — or a drop-in seats it a hair under the wavy surface — the real floor is now ABOVE its
      // feet, the down-ray sails past it, and the suit reads the sky/void far below and sinks through the
      // map. From head height the ray always catches the floor it's standing on and climbs onto risen
      // ground. A roof higher than the body (walk-under clearance) still sits above the head → not grabbed.
      const climbUp = r.collideHeight ?? 24;
      const g2 = world && world.ground ? world.ground([t.pos[0], t.pos[1], (t.pos[2] - eye) + climbUp]) : null;
      if (g2 != null) t.pos[2] = g2 + eye;
    }
    if (moveMag > 0) { e.locomotion = clip; e.gaitPhase = (e.gaitPhase || 0) + moveMag / strideLen; e.moving = true; }
    else e.moving = false;
    // TRIGGER: engaged = on-aim within `fireArc`°, in weapon range, sightline clear of cover. The
    // cadence is burst/pause (`burst` sec held, `pause` sec released): an auto weapon streams the
    // burst; a semi/lob weapon fires its rising edge each cycle and its own cooldown gates the rest.
    // The clock resets when disengaged, so a fresh sighting opens with fire.
    const fireArc = (r.fireArc ?? 6) * Math.PI / 180;
    const origin = [t.pos[0], t.pos[1], t.pos[2] + (w ? w.eye || 0 : 0)];
    // R25: space gates the trigger on the FULL 3D aim error (heading+pitch vs the target vector), so a
    // suit above/below still fires when its nose is on line; the ground path keeps the yaw-only check.
    let onAim;
    if (isSpace) {
      const a = fwd3(t.heading, t.pitch || 0);
      onAim = (a[0] * (dx / dist3d) + a[1] * (dy / dist3d) + a[2] * (dz / dist3d)) >= Math.cos(fireArc);
    } else onAim = Math.abs(rem) <= fireArc;
    const engaged = !!w && onAim && rangeD <= (w.range || 400)
      && !sightBlocked(origin, target.transform.pos, world && world.colliders);
    if (engaged) {
      // difficulty LATENCY detune: shorter bursts, longer gaps between them; a clock still
      // climbing out of the reactDelay hold (armed negative on disengage below) keeps the
      // trigger cold — a fresh sighting no longer opens with instant fire on a lower tier.
      const burstOn = (r.burst ?? 1.1) * (dif ? dif.burstMul : 1);
      const cycle = burstOn + (r.pause ?? 0.9) * (dif ? dif.pauseMul : 1);
      e.aiClock = (e.aiClock || 0) + dt;
      e.aiFire = e.aiClock >= 0 && (e.aiClock % cycle) <= burstOn ? 1 : 0;
    } else e.aiClock = dif && dif.reactDelay ? -dif.reactDelay : 0;
    // difficulty ACCURACY detune: a deterministic sinusoidal aim wobble applied AFTER every
    // intent read above (rem / onAim / engaged all saw the true aim), so the brain fires
    // believing it is locked while the shot ray built later this frame (stepWeapon →
    // fwd3(t.heading, t.pitch)) inherits the error and MISSES real geometry. Heading is
    // integrated (the turn-toward is capped), so the previous frame's offset is swapped out
    // for this frame's; pitch is recomputed absolutely each frame, so a plain add decays.
    if (dif && dif.aimWobble) {
      e.aiWobT = (e.aiWobT || 0) + dt;
      const wobY = Math.sin(e.aiWobT * dif.wobbleHz * TAU) * dif.aimWobble;
      t.heading += wobY - (e.aiWobPrev || 0);
      e.aiWobPrev = wobY;
      t.pitch = clamp((t.pitch || 0) + Math.sin(e.aiWobT * dif.wobbleHz * 0.77 * TAU + 1.3) * dif.aimWobble * 0.6, -1.2, 1.2);
    }
  }

  // ── AI DIFFICULTY (arena difficulty select) ─────────────────────────────────────────────
  // Named tuning tiers the ai brain reads via `world.aiTuning` — seeded from `spec.aiDifficulty`
  // at createWorld, or set at runtime (the game-params seam assigns state.aiTuning). ABSENT
  // aiDifficulty stays null — the untuned MAX brain, byte-identical to the pre-difficulty
  // behavior. The named `max` (NEWTYPE) is that same brain — every detune multiplier at its
  // NEUTRAL value (1× / 0-delay / no wobble / no noTopple), so it reproduces the null path
  // EXACTLY — but it additionally carries `tackleGuard`, the NEWTYPE body-check read (below).
  // Lower tiers detune three axes (each applied at its site in ai(), tagged "difficulty ... detune"):
  //   ACCURACY   — aimWobble (rad) / wobbleHz: the post-gate aim error → real misses.
  //   LATENCY    — reactDelay (sec) before the first burst; burstMul / pauseMul cadence.
  //   AGGRESSION — standoffMul / closeMul spacing; boostBurstMul / boostRestMul juke uptime;
  //                dodgeCdMul lazier escape rolls; noTopple: still melees, never knocks down
  //                (beginAiSwing throws opener cuts only — no combo finisher, no back-cleave).
  //   TACKLEGUARD (NEWTYPE only) — the rock-paper-scissors read the tackle counter enables. Two halves,
  //     both in ai(): (1) DEFENSE — a raw player melee (a live swing) while the brain is free is
  //     AUTO-TACKLED (charge beats swing → stepTackle's counter STUFFS it: topple the swinger, boost
  //     refund). (2) RESTRAINT — the brain fears the mirror, so it only COMMITS its own melee when the
  //     target can't tackle back: mid-roll (dodge i-frames, no tackle) or already reeling. So a standing
  //     player is never raw-melee'd; roll (or get staggered) and the NEWTYPE blade comes out.
  const AI_DIFFICULTY = {
    easy:   { aimWobble: 0.09, wobbleHz: 1.7, reactDelay: 1.2,  burstMul: 0.5,  pauseMul: 2.2, dodgeCdMul: 3,   standoffMul: 1.3,  closeMul: 0.55, boostBurstMul: 0.5,  boostRestMul: 1.8, noTopple: true },
    medium: { aimWobble: 0.04, wobbleHz: 1.4, reactDelay: 0.55, burstMul: 0.75, pauseMul: 1.5, dodgeCdMul: 1.6, standoffMul: 1.12, closeMul: 0.8,  boostBurstMul: 0.75, boostRestMul: 1.3 },
    max:    { aimWobble: 0,    wobbleHz: 0,   reactDelay: 0,    burstMul: 1,    pauseMul: 1,   dodgeCdMul: 1,   standoffMul: 1,    closeMul: 1,    boostBurstMul: 1,    boostRestMul: 1,   tackleGuard: true },
  };
  Object.assign(RULES, { ai });

  // AI ATTACK TOGGLE: G press edge flips the world-level switch the ai ambients gate on.
  registerPreStep('ai-toggle', (state, input) => {
    if (input.aiToggle) state.aiEnabled = state.aiEnabled === false;
  }, 20);
  // difficulty resolve (createWorld): seed state.aiTuning from spec.aiDifficulty.
  registerStateInit((state, spec) => {
    state.aiTuning = AI_DIFFICULTY[spec.aiDifficulty] || null;
  });

  Object.assign(E, { AI_DIFFICULTY });
}
