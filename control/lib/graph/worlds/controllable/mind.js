/**
 * mind.js — the engine's MIND: what a non-player body decides, every frame, through the same rules the player's body
 * plays by. The read-time matrix (lib/graph/mind/) says which strategy a character uses in each situation; this is
 * the runtime that carries them out. Lifted whole from the arena's hunter brain (mobile-suit/ms-ai.js, retired), so
 * every arena bout steps byte-identically.
 *
 * The rule is `ai` (the name minted worlds carry). One frame, in the order the situations are met:
 *   commitments  an in-flight roll, charge or swing owns the body and finishes (parity: the player's do too)
 *   idle         the world switch is off, or nothing to target: stand down
 *   notice       pickTarget: the pilot, the nearest live body, or the nearest enemy
 *   pressed      reflexes on edges, consumed once: roll off the line after a stagger, roll back off a clash
 *   strike       the counter (charge beats swing), the blade commit with its timeout and give-up, the trigger
 *   engage       spacing by the tool in hand (rush · skirmish · siege) and the juke cadence
 *   lost         the give-up: no blade landed in time, guns a while
 * A `rule.mind` temperament gates the whole engagement: passive never engages, defensive only once hurt.
 * then the detune: aim wobble after every decision.
 *
 * TUNING is two tables, the matrix's own (held equal to lib/graph/mind/vocab.js by mind.test.js):
 *   MIND_SKILL           accuracy and latency: how well it carries out what it decided
 *   MIND_AGGRESSIVENESS  spacing, juke uptime, escape-roll laziness, knockdowns, the opportunist's counter read
 * A world's `aiDifficulty` names a tier, (skill × aggressiveness), for the whole class of minds (AI_DIFFICULTY). A
 * character tunes its own on top with `rule.mind: { skill?, aggressiveness?, tune? }` (a boss fine-tuned). Without
 * `rule.mind` it reads the world's tier untouched.
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function. `armSwitchReady` (the loadout switch's ready time)
 * belongs to the suit maneuvers pack, so it is read through E at call time; without the pack, a switch is ready at once.
 * Field ownership: the e.ai- family (aiFire, aiClock, the wobble/juke/boost clocks, ranged rotation picks, the combo
 * chain), the melee commit and give-up clocks, the tackle fields shared with the platform tackle (so stepTackle
 * adjudicates a mind's charge identically), state.aiTuning / aiEnabled.
 */

export function buildMind(E) {
  const {
    clamp, fwdXY, rightXY, fwd3, TAU, sightBlocked, resolveBlocking, RULES,
    meleeSwingSpec, breakGuards, registerPreStep, registerStateInit,
  } = E;
  const armSwitchReady = (e, r, sc) => (E.armSwitchReady ? E.armSwitchReady(e, r, sc) : undefined);

  // ── TUNING ────────────────────────────────────────────────────────────────────────────
  const MIND_SKILL = {
    novice:  { aimWobble: 0.09, wobbleHz: 1.7, reactDelay: 1.2,  burstMul: 0.5,  pauseMul: 2.2 },
    regular: { aimWobble: 0.04, wobbleHz: 1.4, reactDelay: 0.55, burstMul: 0.75, pauseMul: 1.5 },
    veteran: { aimWobble: 0.02, wobbleHz: 1.2, reactDelay: 0.25, burstMul: 0.9,  pauseMul: 1.2 },
    ace:     { aimWobble: 0,    wobbleHz: 0,   reactDelay: 0,    burstMul: 1,    pauseMul: 1 },
  };
  const MIND_AGGRESSIVENESS = {
    passive:     null,
    defensive:   { dodgeCdMul: 3,   standoffMul: 1.3,  closeMul: 0.55, boostBurstMul: 0.5,  boostRestMul: 1.8, noTopple: true },
    wary:        { dodgeCdMul: 3,   standoffMul: 1.3,  closeMul: 0.55, boostBurstMul: 0.5,  boostRestMul: 1.8, noTopple: true },
    bold:        { dodgeCdMul: 1.6, standoffMul: 1.12, closeMul: 0.8,  boostBurstMul: 0.75, boostRestMul: 1.3 },
    opportunist: { dodgeCdMul: 1,   standoffMul: 1,    closeMul: 1,    boostBurstMul: 1,    boostRestMul: 1,   tackleGuard: true },
    relentless:  { dodgeCdMul: 0.8, standoffMul: 0.85, closeMul: 1.2,  boostBurstMul: 1.2,  boostRestMul: 0.8 },
  };
  // A world tier is one (skill × aggressiveness) pair. ABSENT aiDifficulty stays null: the untuned brain, which `max`
  // reproduces exactly (every multiplier neutral) while adding the opportunist's counter read.
  const tier = (skill, aggr) => ({ ...MIND_SKILL[skill], ...MIND_AGGRESSIVENESS[aggr] });
  const AI_DIFFICULTY = { easy: tier('novice', 'wary'), medium: tier('regular', 'bold'), max: tier('ace', 'opportunist') };
  const NEUTRAL_AGGRESSION = { dodgeCdMul: 1, standoffMul: 1, closeMul: 1, boostBurstMul: 1, boostRestMul: 1 };

  // the tuning a body plays by: the world's tier for its class, then its own `rule.mind` on top
  function tuningOf(e, world) {
    const base = (world && world.aiTuning) || null;
    const m = e.rule.mind;
    if (!m) return base;
    // start from the NEUTRAL brain (every multiplier 1, no delay, no wobble: what a null tuning plays), so a partial
    // tuning never leaves a knob undefined
    const t = { ...MIND_SKILL.ace, ...NEUTRAL_AGGRESSION, ...(base || {}) };
    if (m.skill && MIND_SKILL[m.skill]) Object.assign(t, MIND_SKILL[m.skill]);
    if (m.aggressiveness && m.aggressiveness in MIND_AGGRESSIVENESS) {
      for (const k of ['dodgeCdMul', 'standoffMul', 'closeMul', 'boostBurstMul', 'boostRestMul', 'noTopple', 'tackleGuard']) delete t[k];
      Object.assign(t, MIND_AGGRESSIVENESS[m.aggressiveness] || {});
    }
    if (m.tune) Object.assign(t, m.tune);
    return t;
  }

  // ── STRIKE: the blade ──────────────────────────────────────────────────────────────────
  // beginSwingDir(e, sc, r, dir, isCombo, noTopple) — throw ONE melee swing in a given direction. Stashes the swing's
  // duration + cooldown on the entity so the swing playback advances it without the config in hand. stepMelee
  // (stepWorld) adjudicates the hit during the contact window. A combo FINISHER (`isCombo`) forces the TOPPLE (the
  // downswing floors on connect — the string's payoff); `noTopple` strips the knockdown off whatever verb was thrown.
  function beginSwingDir(e, sc, r, dir, isCombo, noTopple) {
    const spec = meleeSwingSpec(sc, r, dir, isCombo);
    if (isCombo) spec.params.topple = true;   // the downswing finisher knocks down
    if (noTopple) spec.params.topple = false;   // pulled blows: the cut lands (damage + stagger), never floors
    e.swingT = 0; e.swingClip = spec.clip; e.strikeParams = spec.params;
    e.struckThisSwing = {}; e.swingCount = (e.swingCount || 0) + 1; e.swingCombo = isCombo;
    e.lastSwingDir = dir;       // combo-string memory stays coherent if the pilot takes this body over
    e.swingDur = sc.strikeDur ?? r.strikeDur ?? 0.9;
    e.swingCd = sc.strikeCooldown ?? r.strikeCooldown ?? 0;
    breakGuards(e);   // attacking spends any protection (spawn shield / wake guard / dodge i-frames)
  }
  // beginSwing(e, sc, r, dif) — the mind opens a melee attack. By default a TWO-HIT string: an OPENER (a neutral or
  // alternating side cut) then, chained on completion in the swing playback, a DOWNSWING finisher that topples.
  // `r.meleeCombo:false` keeps the classic single `back` great-cleave. A `noTopple` tuning still melees but never
  // throws the knockdown: the chain is skipped (its finisher IS the topple) and the opener pays the string's pacing.
  function beginSwing(e, sc, r, dif) {
    const noTopple = !!(dif && dif.noTopple);
    if (r.meleeCombo !== false || noTopple) {
      e.aiSwingAlt = (e.aiSwingAlt || 0) + 1;
      const opener = (e.aiSwingAlt % 3 === 0) ? 'neutral' : (e.aiSwingAlt % 3 === 1 ? 'left' : 'right');   // neutral / side, varied
      beginSwingDir(e, sc, r, opener, false, noTopple);
      if (noTopple) {
        // the lone opener still PAYS the combo-string pacing: without this, a slot that skips `strikeCooldown`
        // would let a pulled-blow tuning chain cuts back-to-back and out-swing the full one.
        e.swingCd = Math.max(e.swingCd || 0, (sc && sc.comboCooldown) ?? r.comboCooldown ?? 2.5);
        e.aiComboWant = false;
        return;
      }
      e.aiComboWant = true; e.aiComboCfg = sc; e.aiComboRule = r;   // chain the downswing when the opener completes
      e.aiComboCooldown = (sc && sc.comboCooldown) ?? r.comboCooldown ?? 2.5;
    } else {
      beginSwingDir(e, sc, r, 'back', false);   // single hit: the classic toppling great-cleave
      e.aiComboWant = false;
    }
  }

  // ── PRESSED: the roll ──────────────────────────────────────────────────────────────────
  // dodgeExhaust(e, r) — POST-ROLL THRUSTER LOCKOUT (parity). The pilot's roll dumps the boost gauge and latches the
  // overheat (beginDodge, combat-hit.js); a mind self-authors its roll, so it pays the same as a wall-clock it already
  // speaks, sized to the pilot's overheat recovery. Free-roll (`dodgeBoostCost:0`) and heat-sink (`dodgeOverheat:false`)
  // bodies pay nothing, as the pilot doesn't. It must NOT gate on `boostMax`: a mind's rule usually carries none.
  // Tunable per rule via `dodgeExhaust` (seconds).
  function dodgeExhaust(e, r) {
    if ((r.dodgeBoostCost ?? 2) <= 0 || !(r.dodgeOverheat ?? true)) return;
    const bm = r.boostMax ?? 0;
    const win = bm > 0 ? bm / (r.overheatRegen ?? bm / 7.5) : 7.5;
    e.aiBoostRestT = r.dodgeExhaust ?? win;
  }
  // rollOff(e, r, dif, dir, rt) — commit a side roll along `dir` from THIS frame: i-frames, the roll clip, the same
  // dodge cooldown the pilot pays, sides alternating (set by the caller before `dir` is built).
  function rollOff(e, r, dif, dir, rt) {
    e.dodgeDir = dir;
    const sd = e.dodgeDir[0] * rt[0] + e.dodgeDir[1] * rt[1];   // body-frame side (the tumble sign)
    e.dodgeT = 0; e.dodgeClip = 'dodge_sideroll'; e.dodgeKind = 'side'; e.dodgeSign = sd < 0 ? -1 : 1;
    e.dodgeSpent = false; e.dodgeCdT = (r.dodgeCooldown ?? 8) * (dif ? dif.dodgeCdMul : 1);
    e.dodgeCount = (e.dodgeCount || 0) + 1;
    dodgeExhaust(e, r);   // the roll spends the thruster — no instant tackle/boost follow-up
  }

  // ── NOTICE: who ────────────────────────────────────────────────────────────────────────
  // pickTarget(e, world, policy) — the default hunts the PILOT. `'all'`: the nearest live hittable body that isn't
  // itself (a free-for-all: the pilot is one more contender). `'enemy'`: the same, skipping its own team. Nearest by
  // flat distance, ties by entity order; downed wrecks and i-frame bodies are skipped, so a fresh respawn keeps its
  // protection window.
  function pickTarget(e, world, policy) {
    let target = null;
    if (world && world.byId) {
      if (policy === 'all' || policy === 'enemy') {
        const t = e.transform;
        const teamAware = policy === 'enemy' && e.team;
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
    return target;
  }

  // ── shared moves ──────────────────────────────────────────────────────────────────────
  // block(t, r, eye, world) — slide along colliders, like every other move (ground only)
  const block = (t, r, eye, world) => resolveBlocking(t.pos, t.pos[2] - eye, r.collideHeight ?? 24, r.collideRadius ?? 0, world.colliders, r.step ?? 0.35);
  // standOnGround(t, r, eye, world) — the HEAD-HEIGHT ground snap: cast from foot + body height, so a mind with no
  // gravity finds the surface under its body and climbs onto risen ground instead of sinking through a slope. A
  // roof higher than the body (walk-under clearance) still sits above the head and is not grabbed.
  function standOnGround(t, r, eye, world) {
    const g = world && world.ground ? world.ground([t.pos[0], t.pos[1], (t.pos[2] - eye) + (r.collideHeight ?? 24)]) : null;
    if (g != null) t.pos[2] = g + eye;
  }
  // turnToward(t, want, r, dt) — the shortest way, capped at `turn` rad/s; returns the residual off-aim
  function turnToward(t, want, r, dt) {
    let dh = ((want - t.heading + Math.PI) % TAU + TAU) % TAU - Math.PI;
    const maxTurn = (r.turn ?? 1.8) * dt;
    t.heading += clamp(dh, -maxTurn, maxTurn);
    return ((want - t.heading + Math.PI) % TAU + TAU) % TAU - Math.PI;
  }
  // nextJuke(e, r, dt) — the strafe side, flipped every `jukePeriod`
  function nextJuke(e, r, dt) {
    const jp = r.jukePeriod ?? 0.9;
    e.aiJukeClock = (e.aiJukeClock || 0) + dt;
    if (e.aiJukeClock >= jp) { e.aiJukeClock = 0; e.aiJukeSide = e.aiJukeSide === 1 ? -1 : 1; }
    return e.aiJukeSide || 1;
  }
  // SPACING by the tool in hand: [standoffMul, close, weave]. Rush drives in and weaves little, siege holds back and
  // weaves wide, skirmish holds the base. Rotating tools makes the mind press in and fall back in turns.
  const SPACING = { rush: [0.48, 1.0, 0.45], skirmish: [1.0, 0.7, 1.0], siege: [1.55, 0.6, 1.15] };
  const spacingOf = (w, slotOverride) => (slotOverride && slotOverride.style) || (!w ? 'skirmish' : w.fireClass === 'lob' ? 'siege' : w.fireClass === 'area' ? 'rush' : 'skirmish');

  // ── the rule ─────────────────────────────────────────────────────────────────────────
  // ai — on the ground it TURNS toward its target and CLOSES to a standoff on the XY plane; in SPACE (`rule.space`) it
  // seeks in 3D (the full vector, closing altitude too) and gates its trigger on the full 3D aim. Each frame it AIMS
  // (heading + pitch at the target's egg centre) and works its own trigger on a burst/pause cadence. `e.aiFire` is
  // this entity's PRIVATE fire input: stepWorld routes it (never the global input) into stepWeapon for an ai-ruled
  // entity, so the pilot's trigger can't fire a mind's gun and a mind can't drain the pilot's magazine. Pure: same
  // state + dt → same decisions.
  function ai(e, input, dt, world) {
    const r = e.rule;
    const t = e.transform;
    const speed = r.speed ?? 6, strideLen = r.stride ?? 2.4, eye = r.eye ?? 0;
    const dif = tuningOf(e, world);
    e.aiFire = 0;
    e.thrust = 0; e.thrustYaw = 0; e.boosting = false;   // reset per frame; a boost burst (opt-in r.boost) re-arms them
    if (e.aiBoostRestT > 0) e.aiBoostRestT = Math.max(0, e.aiBoostRestT - dt);   // post-roll boost/tackle lockout
    const f = fwdXY(t.heading), rt = rightXY(t.heading);

    // COMMITMENTS. An in-flight roll OWNS the body (i-frames, no re-aim; the renderer tumbles the rig).
    if (e.dodgeT != null) {
      e.dodgeT += dt / (r.dodgeDur ?? 0.55);
      if (e.dodgeT >= 1) { e.dodgeT = null; e.tumble = null; e.invincible = false; e.dodgeDir = null; }
      else {
        const env = Math.sin(Math.min(1, e.dodgeT) * Math.PI);
        const dsp = (r.dodgeSpeed ?? speed * 2.6) * env * dt;
        if (e.dodgeDir) { t.pos[0] += e.dodgeDir[0] * dsp; t.pos[1] += e.dodgeDir[1] * dsp; }
        if (!r.space && world && world.colliders) block(t, r, eye, world);   // the roll is solid (no tunnelling)
        // a ground roll hugs the terrain; a SPACE roll holds its altitude
        const gd = !r.space && world && world.ground ? world.ground(t.pos) : null;
        if (gd != null) t.pos[2] = gd + eye;
        e.locomotion = e.dodgeClip || 'dodge_sideroll'; e.moving = true; e.invincible = !e.dodgeSpent; e.gaitPhase = 0;
        const ang = Math.min(1, e.dodgeT) * (r.dodgeTurns ?? 1) * TAU;
        e.tumble = { axis: [f[0] * (e.dodgeSign || 1), f[1] * (e.dodgeSign || 1), 0], angle: ang };   // barrel-roll about forward
        return;
      }
    }
    // A committed charge along `e.tackleDir` owns the body like the platform tackle: invincible, no re-aim. stepTackle
    // (an entity action, after the rule) adjudicates the ram and the counter, and stops the charge on the first body
    // it rams, so this block yields the frame it connects.
    if (e.tackleT != null) {
      e.tackleT += dt / (r.tackleDur ?? 2);
      if (e.tackleT >= 1) { e.tackleT = null; e.tackleDir = null; if (e.cineT == null) e.invincible = false; }
      else {
        const tsp = (r.tackleSpeed ?? r.boostSpeed ?? speed * 3.5) * dt;
        if (e.tackleDir) { t.pos[0] += e.tackleDir[0] * tsp; t.pos[1] += e.tackleDir[1] * tsp; if (r.space && e.tackleDir[2]) t.pos[2] += e.tackleDir[2] * tsp; }
        if (!r.space && world && world.colliders) block(t, r, eye, world);   // the charge is solid: it slides along a wall
        if (!r.space) standOnGround(t, r, eye, world);
        e.locomotion = 'boost'; e.moving = true; e.invincible = true; e.tumble = null;
        e.gaitPhase = (e.gaitPhase || 0) + tsp / strideLen; e.boosting = true; e.thrust = 1;
        return;
      }
    }
    // A swing owns the body: advance its phase, hold the clip, stay rooted. Runs before the stand-down so an in-flight
    // swing always finishes. On completion the opener chains into the downswing, or the string ends and arms its cooldown.
    if (e.swingT != null) {
      e.swingT += dt / (e.swingDur || 0.9);
      e.locomotion = e.swingClip || 'swing_neutral'; e.moving = true; e.gaitPhase = Math.min(1, e.swingT); e.aiFire = 0;
      if (!r.space) standOnGround(t, r, r.eye ?? 0, world);
      if (e.swingT >= 1) {
        if (e.aiComboWant && !e.swingCombo && e.aiComboCfg) {
          e.aiComboWant = false;
          beginSwingDir(e, e.aiComboCfg, e.aiComboRule || r, 'back', true);   // `back` = the overhead downswing, topples
        } else {
          const wasCombo = e.swingCombo;
          e.swingT = null; e.locomotion = 'forward'; e.moving = false; e.aiComboWant = false;
          e.strikeCdT = wasCombo ? (e.aiComboCooldown ?? e.swingCd ?? 0) : (e.swingCd > 0 ? e.swingCd : (e.strikeCdT || 0));
        }
      }
      return;
    }

    // IDLE. The world switch (`aiEnabled`, flipped by input.aiToggle / seeded by manifest `ai:'off'`): off, the mind
    // stands down where it is, trigger cold, and drops a recovery edge so a stagger taken while passive doesn't fire
    // a stale roll when the switch comes back on.
    if (world && world.aiEnabled === false) { e.moving = false; e.reactionEnded = false; return; }
    // Temperament (`rule.mind.aggressiveness`): a passive mind never engages; a defensive one only once it has been
    // hurt (its hp under the max it spawned with). Without `rule.mind` this never applies.
    const temper = r.mind && r.mind.aggressiveness;
    if (temper === 'passive' || (temper === 'defensive' && !(e.hpMax > 0 && e.body && e.body.hp < e.hpMax))) { e.moving = false; e.reactionEnded = false; return; }
    // NOTICE.
    const target = pickTarget(e, world, r.target);
    if (!target || target === e) { e.moving = false; e.reactionEnded = false; return; }
    const dx = target.transform.pos[0] - t.pos[0], dy = target.transform.pos[1] - t.pos[1];
    const dist2d = Math.hypot(dx, dy) || 1e-6;

    // PRESSED. Just recovered from a stagger (stepReaction stamps `reactionEnded`): roll PERPENDICULAR to the threat,
    // sides alternating. A spent dodge cooldown lets the edge pass and the hunt resumes.
    if (e.reactionEnded) {
      e.reactionEnded = false;
      if (r.dodge !== false && (e.dodgeCdT || 0) <= 0) {
        e.aiDodgeSide = e.aiDodgeSide === 1 ? -1 : 1;
        const ux = dx / dist2d, uy = dy / dist2d;
        rollOff(e, r, dif, [-uy * e.aiDodgeSide, ux * e.aiDodgeSide], rt);
        e.locomotion = 'dodge_sideroll'; e.invincible = true; e.gaitPhase = 0; e.moving = true;
        return;
      }
    }
    // Blades crossed (stepClash armed `clashRetreat`): roll BACK off the clash line, blended with a sidestep, and hand
    // the fight to shooting (the give-up is already armed), so duels don't relock into an endless clash.
    if (e.clashRetreat) {
      e.clashRetreat = false;
      if (r.dodge !== false && (e.dodgeCdT || 0) <= 0) {
        e.aiDodgeSide = e.aiDodgeSide === 1 ? -1 : 1;
        const ux = dx / dist2d, uy = dy / dist2d;
        rollOff(e, r, dif, [(-ux - uy * e.aiDodgeSide) * 0.7071, (-uy + ux * e.aiDodgeSide) * 0.7071], rt);
        e.locomotion = 'dodge_sideroll'; e.invincible = true; e.gaitPhase = 0; e.moving = true;
        return;
      }
    }

    // STRIKE: the counter (the opportunist's `tackleGuard`). The target throws a RAW swing it can SEE (inside its
    // front cone, `tackleGuardCone`, default 1.1 rad) and in a charge's reach: square up and body-check down the line;
    // stepTackle stuffs the swing (charge beats swing). A spent thruster can't charge; a short cooldown stops a whiff
    // re-charging every frame. Rolling the swing beats it for free (i-frames), which is why the blade is restrained below.
    if (dif && dif.tackleGuard && (e.tackleCdT || 0) <= 0 && !(e.aiBoostRestT > 0)
        && target.swingT != null && target.strikeParams && target.staggerT == null && !target.downed
        && (f[0] * dx + f[1] * dy) / dist2d >= Math.cos(r.tackleGuardCone ?? 1.1)) {
      const tspeed = r.tackleSpeed ?? r.boostSpeed ?? speed * 3.5;
      const mdz0 = target.transform.pos[2] - t.pos[2];
      const tdist = r.space ? Math.hypot(dx, dy, mdz0) : dist2d;
      if (tdist < (r.tackleReach ?? 8) + tspeed * (r.tackleDur ?? 2) * 0.6) {
        const ux = dx / dist2d, uy = dy / dist2d;
        e.tackleDir = r.space ? (() => { const n = Math.hypot(dx, dy, mdz0) || 1e-6; return [dx / n, dy / n, mdz0 / n]; })() : [ux, uy];
        t.heading = Math.atan2(dy, dx);   // square up so stepTackle's front cone catches the swinger
        e.tackleT = 0; e.tackleHits = {};
        e.tackleCount = (e.tackleCount || 0) + 1;   // audio WHOOMPH edge (like the platform tackle)
        e.tackleCdT = r.aiTackleCooldown ?? 1.5;
        e.invincible = true; e.tumble = null; e.locomotion = 'boost'; e.moving = true; e.gaitPhase = 0;
        return;
      }
    }
    // A seat with no pilotRule (an arena opponent) carries its loadout on its own rule.
    const lo = e.pilotRule && Array.isArray(e.pilotRule.loadout) ? e.pilotRule.loadout
      : (e.rule && Array.isArray(e.rule.loadout) ? e.rule.loadout : null);
    // STRIKE: the blade (opt-in `r.meleeSeek`, ground and space). A body carrying a melee slot COMMITS to close and
    // topple when the target is in reach, and sprints in on a target already reeling (the free opening).
    // LOST: the give-up. Committed but no swing landed within `meleeTimeout` (5 s) → guns only for `meleeGiveUp` (4 s),
    // so it never loops chasing an evasive or unreachable target.
    if (e.meleeGiveUpT > 0) e.meleeGiveUpT = Math.max(0, e.meleeGiveUpT - dt);
    const meleeCfg = (r.meleeSeek && lo && (e.strikeCdT || 0) <= 0 && !(e.meleeGiveUpT > 0))
      ? lo.find((c) => c && c.strike === 'melee') : null;
    const meleeReach = meleeCfg ? (meleeCfg.strikeReach ?? r.strikeReach ?? speed) : 0;
    const targetReeling = !!target.staggerT && !target.downed;   // mid-stagger / toppling, still a live body
    // On the ground a blade can't reach a target perched beyond `meleeVReach` above: it stays a shooter. In space there
    // is no perch, and melee range is 3D.
    const meleeVReach = r.meleeVReach ?? (r.collideHeight ?? 24) * 1.5;
    const mdz = target.transform.pos[2] - t.pos[2];
    const targetHigh = !r.space && Math.abs(mdz) > meleeVReach;
    const meleeDist = r.space ? Math.hypot(dx, dy, mdz) : dist2d;
    // The opportunist's RESTRAINT: it fears the mirror, so it draws the blade only when the target can't charge back
    // (mid-roll, or reeling). Every other tuning commits as before.
    const targetSafeMelee = !(dif && dif.tackleGuard) || target.dodgeT != null || targetReeling;
    const meleeCommit = !!meleeCfg && !target.downed && !targetHigh && targetSafeMelee
      && (meleeDist < meleeReach * 3 || (targetReeling && meleeDist < meleeReach * 9));
    if (meleeCommit) {
      e.meleeCommitT = (e.meleeCommitT || 0) + dt;
      if (e.meleeCommitT >= (r.meleeTimeout ?? 5)) { e.meleeGiveUpT = r.meleeGiveUp ?? 4; e.meleeCommitT = 0; }
    } else e.meleeCommitT = 0;
    if (meleeCommit) {
      const idx = lo.indexOf(meleeCfg);   // switch to the melee slot (weaponless → the fire route falls to the strike)
      if ((e.loadoutIdx || 0) !== idx) {
        e.loadoutIdx = idx; e.weapon = e.loadoutWeapons ? e.loadoutWeapons[idx] : null;
        if (e.body && meleeCfg.figure) e.body.figure = meleeCfg.figure;
        armSwitchReady(e, r, meleeCfg);   // a mind pays the switch ready-time too (it draws the blade, then swings)
      }
    } else if (e.loadoutWeapons && lo) {
      // ENGAGE: the RANGED ROTATION (a duelist's repertoire): with two or more trigger guns (throw slots skipped) it
      // advances the pick every `weaponRotate` s (6), so its spacing shifts with the tool in hand. One gun: it just
      // selects it.
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
          armSwitchReady(e, r, lo[want]);   // hold fire for the ready-time (a slot's switchReady wins)
        }
      }
    }
    // aim: turn toward the target, pitch at its egg centre
    const rem = turnToward(t, Math.atan2(dy, dx), r, dt);
    const w = e.weapon;
    const tb = target.body || {};
    const tcz = tb.egg ? (Number.isFinite(tb.egg.cz) ? tb.egg.cz : tb.egg.c) : (tb.radius || 0);
    t.pitch = clamp(Math.atan2((target.transform.pos[2] + tcz) - (t.pos[2] + (w ? w.eye || 0 : 0)), dist2d), -1.2, 1.2);

    // ENGAGE: move to attack. Close to `standoff` while facing, then hold. With opt-in BOOST (`r.boost`) it juke-boosts
    // in bursts: `boostBurst` s weaving (boost armour live, a single bolt doesn't stun) then `boostRest` s grounded and
    // stunnable, so the same enemy shows both reads. In SPACE it seeks along the full 3D vector.
    const isSpace = !!r.space;
    const dz = target.transform.pos[2] - t.pos[2];
    const dist3d = Math.hypot(dx, dy, dz) || 1e-6;
    const rangeD = isSpace ? dist3d : dist2d;
    // spacing over a BASE standoff (the rule's `standoff`, else 0.42 of the weapon's range); a slot's
    // `approach:{style,standoff,close,weave}` wins; the tuning's aggressiveness scales it.
    const aSlot = lo ? lo[e.loadoutIdx || 0] : null;
    const aOv = (aSlot && aSlot.approach) || null;
    const aProf = SPACING[spacingOf(w, aOv)] || [1.0, 0.7, 1.0];
    const baseStandoff = r.standoff != null ? r.standoff : (w ? (w.range || 400) * 0.42 : speed * 8);
    const standoff = (w ? (Number.isFinite(aOv && aOv.standoff) ? aOv.standoff : baseStandoff * aProf[0]) : baseStandoff) * (dif ? dif.standoffMul : 1);
    const closeBias = (Number.isFinite(aOv && aOv.close) ? aOv.close : aProf[1]) * (dif ? dif.closeMul : 1);
    const weaveMul = Number.isFinite(aOv && aOv.weave) ? aOv.weave : aProf[2];
    const f2 = fwdXY(t.heading), rt2 = rightXY(t.heading), facing = Math.abs(rem) < 1.1;
    let boostBurst = false;
    if (r.boost && !(e.aiBoostRestT > 0)) {   // a spent thruster (post-roll) grounds the juke
      const bb = (r.boostBurst ?? 2.5) * (dif ? dif.boostBurstMul : 1), brest = (r.boostRest ?? 1.6) * (dif ? dif.boostRestMul : 1), cyc = Math.max(0.1, bb + brest);
      e.aiBoostClock = (e.aiBoostClock || 0) + dt;
      boostBurst = (e.aiBoostClock % cyc) < bb;
    }
    let moveMag = 0, clip = 'forward';
    if (meleeCommit) {
      // close the gap, then strike: beyond reach charge in (boosting the whole close, unless the thruster is spent);
      // within reach, on line and past the switch ready-time, swing.
      if (meleeDist > meleeReach * 0.85) {
        const canBoost = !!(r.boost || r.boostSpeed) && !(e.aiBoostRestT > 0);
        const spd = (canBoost ? (r.boostSpeed ?? speed * 3.5) : speed) * dt;
        if (facing) {
          if (r.space) {
            const ux = dx / meleeDist, uy = dy / meleeDist, uz = mdz / meleeDist;
            t.pos[0] += ux * spd; t.pos[1] += uy * spd; t.pos[2] += uz * spd; moveMag = spd;
            clip = 'boost'; if (canBoost) { e.boosting = true; e.thrust = 1; } else e.thrust = Math.max(e.thrust, 0.5);
          } else {
            t.pos[0] += f2[0] * spd; t.pos[1] += f2[1] * spd; moveMag = spd;
            if (canBoost) { clip = 'boost'; e.boosting = true; e.thrust = 1; } else clip = 'forward';
          }
        }
      } else if (facing && (e.readyT || 0) <= 0) {
        beginSwing(e, meleeCfg, r, dif);
        e.meleeCommitT = 0;             // a swing landed the commit: restart the give-up clock for the next approach
      }
    } else if (isSpace) {
      const ux = dx / dist3d, uy = dy / dist3d, uz = dz / dist3d;
      if (boostBurst) {
        const side = nextJuke(e, r, dt);
        const bias = dist3d > standoff ? closeBias : dist3d < standoff * 0.55 ? -closeBias : 0;
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
      const side = nextJuke(e, r, dt);
      const bias = dist2d > standoff ? closeBias : dist2d < standoff * 0.55 ? -closeBias : 0;
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
    if (!isSpace && world && world.colliders) block(t, r, eye, world);
    if (!isSpace) standOnGround(t, r, eye, world);
    if (moveMag > 0) { e.locomotion = clip; e.gaitPhase = (e.gaitPhase || 0) + moveMag / strideLen; e.moving = true; }
    else e.moving = false;

    // STRIKE: the trigger. Engaged = on aim within `fireArc`°, in range, sightline clear; space gates on the full 3D
    // aim. Burst/pause cadence; the tuning's latency shortens bursts, lengthens gaps, and holds a fresh sighting for
    // `reactDelay` (the clock is armed negative on disengage).
    const fireArc = (r.fireArc ?? 6) * Math.PI / 180;
    const origin = [t.pos[0], t.pos[1], t.pos[2] + (w ? w.eye || 0 : 0)];
    let onAim;
    if (isSpace) {
      const a = fwd3(t.heading, t.pitch || 0);
      onAim = (a[0] * (dx / dist3d) + a[1] * (dy / dist3d) + a[2] * (dz / dist3d)) >= Math.cos(fireArc);
    } else onAim = Math.abs(rem) <= fireArc;
    const engaged = !!w && onAim && rangeD <= (w.range || 400)
      && !sightBlocked(origin, target.transform.pos, world && world.colliders);
    if (engaged) {
      const burstOn = (r.burst ?? 1.1) * (dif ? dif.burstMul : 1);
      const cycle = burstOn + (r.pause ?? 0.9) * (dif ? dif.pauseMul : 1);
      e.aiClock = (e.aiClock || 0) + dt;
      e.aiFire = e.aiClock >= 0 && (e.aiClock % cycle) <= burstOn ? 1 : 0;
    } else e.aiClock = dif && dif.reactDelay ? -dif.reactDelay : 0;
    // DETUNE: the tuning's accuracy, a deterministic sinusoidal wobble applied AFTER every decision, so the mind fires
    // believing it is locked while the shot ray (stepWeapon → fwd3(heading, pitch)) inherits the error and misses real
    // geometry. Heading is integrated, so last frame's offset is swapped out; pitch is absolute, so a plain add decays.
    if (dif && dif.aimWobble) {
      e.aiWobT = (e.aiWobT || 0) + dt;
      const wobY = Math.sin(e.aiWobT * dif.wobbleHz * TAU) * dif.aimWobble;
      t.heading += wobY - (e.aiWobPrev || 0);
      e.aiWobPrev = wobY;
      t.pitch = clamp((t.pitch || 0) + Math.sin(e.aiWobT * dif.wobbleHz * 0.77 * TAU + 1.3) * dif.aimWobble * 0.6, -1.2, 1.2);
    }
  }
  Object.assign(RULES, { ai });

  // AI ATTACK TOGGLE: the G press edge flips the world switch every mind gates on.
  registerPreStep('ai-toggle', (state, input) => {
    if (input.aiToggle) state.aiEnabled = state.aiEnabled === false;
  }, 20);
  // the class tier (createWorld): seed state.aiTuning from spec.aiDifficulty
  registerStateInit((state, spec) => {
    state.aiTuning = AI_DIFFICULTY[spec.aiDifficulty] || null;
  });

  Object.assign(E, { AI_DIFFICULTY, MIND_SKILL, MIND_AGGRESSIVENESS, mindTuning: tuningOf });
}
