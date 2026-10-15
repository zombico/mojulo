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
 * A `rule.mind` temperament gates the whole engagement: passive never engages, defensive only once hurt. Its motivation
 * shapes it: a guard engages only near its post and walks back to it; prey flees a threat inside its fear radius.
 * then the detune: aim wobble after every decision.
 *
 * TUNING is two tables, the matrix's own (held equal to lib/graph/mind/vocab.js by mind.test.js):
 *   MIND_SKILL           accuracy and latency: how well it carries out what it decided
 *   MIND_AGGRESSIVENESS  spacing, juke uptime, escape-roll laziness, knockdowns, the opportunist's counter read
 * A world's `aiDifficulty` names a tier, (skill × aggressiveness), for the whole class of minds (AI_DIFFICULTY). A
 * character tunes its own on top with `rule.mind: { skill?, aggressiveness?, tune? }` (a boss fine-tuned). Without
 * `rule.mind` it reads the world's tier untouched.
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; maneuvers.js precedes it (`armSwitchReady`, the
 * loadout switch's ready time), and nav.js (`navPath`, `navClear`).
 * Field ownership: the e.ai- family (aiFire, aiClock, the wobble/juke/boost clocks, ranged rotation picks, the combo
 * chain), the melee commit and give-up clocks, the tackle fields shared with the platform tackle (so stepTackle
 * adjudicates a mind's charge identically), state.aiTuning / aiEnabled.
 */

export function buildMind(E) {
  const {
    clamp, fwdXY, rightXY, fwd3, TAU, sightBlocked, resolveBlocking, RULES,
    meleeSwingSpec, breakGuards, registerPreStep, registerStateInit, registerNormalize, armSwitchReady, navPath, navClear,
    muzzleAt, bodyExposure,
  } = E;

  // entity dressing: a body tagged `food: true` is what a forager grazes (absent → no field: every other world is
  // byte-identical)
  registerNormalize((ent, raw) => { if (raw.food === true) ent.food = true; });

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
    // a crossed health phase layers on top (its skill, aggressiveness and tune), for the rest of this life
    const ph = e.mindPhase != null ? phasesOf(m)[e.mindPhase] : null;
    if (ph) {
      if (ph.skill && MIND_SKILL[ph.skill]) Object.assign(t, MIND_SKILL[ph.skill]);
      if (ph.aggressiveness && ph.aggressiveness in MIND_AGGRESSIVENESS) {
        for (const k of ['dodgeCdMul', 'standoffMul', 'closeMul', 'boostBurstMul', 'boostRestMul', 'noTopple', 'tackleGuard']) delete t[k];
        Object.assign(t, MIND_AGGRESSIVENESS[ph.aggressiveness] || {});
      }
      if (ph.tune) Object.assign(t, ph.tune);
    }
    return t;
  }

  // ── PHASES and ADAPTING: a duelist's ways of switching (rank miniboss / boss) ─────────────────
  // phasesOf(mind) — `mind.phases` ([{ below, aggressiveness?, skill?, tune?, rule?, shift? }], health fractions), else
  // a boss's default: under 2/3 one step bolder, under 1/3 relentless and closing to the blade when it holds one.
  const TEMPERS = ['passive', 'defensive', 'wary', 'bold', 'opportunist', 'relentless'];
  function phasesOf(m) {
    if (!m) return [];
    if (Array.isArray(m.phases)) return m.phases;
    if (m.rank !== 'boss') return [];
    const at = Math.max(TEMPERS.indexOf(m.aggressiveness || 'bold'), 1);
    return [
      { below: 2 / 3, aggressiveness: TEMPERS[Math.min(at + 1, TEMPERS.length - 1)], shift: 1 },
      { below: 1 / 3, aggressiveness: 'relentless', rule: { meleeSeek: true }, shift: 1.2 },
    ];
  }
  // stepPhase(e, r, dt) — cross every phase whose threshold the health has fallen under (once per life: a heal never
  // un-phases), patch the rule, and hold the SHIFT beat: planted and invincible so the change reads. True while the
  // shift owns the body.
  function stepPhase(e, r, dt) {
    if (e.phaseShiftT != null) {
      e.phaseShiftT -= dt;
      if (e.phaseShiftT > 0) { e.moving = false; e.invincible = true; e.locomotion = 'phase_shift'; return true; }
      e.phaseShiftT = null; e.locomotion = 'forward'; if (e.cineT == null) e.invincible = false;
    }
    const ps = phasesOf(r.mind);
    if (!ps.length || !(e.hpMax > 0) || !e.body || e.downed) return false;
    const frac = e.body.hp / e.hpMax;
    let next = e.mindPhase != null ? e.mindPhase + 1 : 0, crossed = false;
    while (next < ps.length && frac < ps[next].below) {
      e.mindPhase = next; crossed = true;
      if (ps[next].rule) Object.assign(r, ps[next].rule);
      next++;
    }
    if (crossed && ps[e.mindPhase].shift > 0) {
      e.phaseShiftT = ps[e.mindPhase].shift; e.phaseShifts = (e.phaseShifts || 0) + 1;
      e.aiFire = 0; e.moving = false; e.invincible = true; e.locomotion = 'phase_shift';
      return true;
    }
    return false;
  }
  // stepAdapt(e, r, dt, world) — book the hp it took and dealt to the mode it was in (melee while committed or
  // swinging, else ranged); every `adaptEvery` s (6) a mode that lost the trade by `adaptMargin` (8) is benched for
  // the next window: melee benched → guns only; ranged benched → it closes to the blade (when it holds one).
  // Deterministic (hp deltas only). On for a boss; a miniboss opts in with `mind.adapt: true`.
  function adapts(m) { return !!m && (m.adapt === true || (m.rank === 'boss' && m.adapt !== false)); }
  function stepAdapt(e, r, dt, world) {
    const a = e.adapt || (e.adapt = { clock: 0, melee: [0, 0], ranged: [0, 0], foeId: null, foeHp: null, hp: e.body ? e.body.hp : 0, benched: null, benchT: 0, log: [] });
    const mode = (e.swingT != null || (e.meleeCommitT || 0) > 0) ? 'melee' : 'ranged';
    if (e.body) { if (e.body.hp < a.hp) a[mode][1] += a.hp - e.body.hp; a.hp = e.body.hp; }
    const foe = a.foeId && world && world.byId ? world.byId[a.foeId] : null;
    if (foe && foe.body && a.foeHp != null && foe.body.hp < a.foeHp) a[mode][0] += a.foeHp - foe.body.hp;
    a.foeHp = foe && foe.body ? foe.body.hp : null;
    if (a.benchT > 0) { a.benchT -= dt; if (a.benchT <= 0) a.benched = null; }
    a.clock += dt;
    if (a.clock >= (r.adaptEvery ?? 6)) {
      const margin = r.adaptMargin ?? 8, net = (k) => a[k][0] - a[k][1];
      const loser = net('melee') < -margin && net('melee') < net('ranged') ? 'melee'
        : net('ranged') < -margin && net('ranged') < net('melee') ? 'ranged' : null;
      if (loser) { a.benched = loser; a.benchT = r.adaptEvery ?? 6; a.log.push(loser); }
      a.clock = 0; a.melee = [0, 0]; a.ranged = [0, 0];
    }
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
    // a LUNGE (opt-in `strikeLunge`, units/s): the strike carries the body forward until its contact window closes,
    // so a bite reaches a fleeing target. Absent: the swing is planted, as every arena cut is.
    const lunge = sc.strikeLunge ?? r.strikeLunge;
    if (lunge) e.swingLunge = lunge; else if (e.swingLunge) e.swingLunge = 0;
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
  // `skip` is one body never to target (an escort's ward).
  function pickTarget(e, world, policy, skip) {
    let target = null;
    if (world && world.byId) {
      if (policy === 'all' || policy === 'enemy') {
        const t = e.transform;
        const teamAware = policy === 'enemy' && e.team;
        let bd = Infinity;
        for (const id in world.byId) {
          const o = world.byId[id];
          if (o === e || o === skip || o.isCamera || o.downed || o.invincible || !(o.body && o.body.hittable)) continue;
          if (teamAware && o.team && o.team === e.team) continue;   // TEAM: never hunt an ally
          const ddx = o.transform.pos[0] - t.pos[0], ddy = o.transform.pos[1] - t.pos[1];
          const dd = ddx * ddx + ddy * ddy;
          if (dd < bd) { bd = dd; target = o; }
        }
      } else if (world.pilotId && world.byId[world.pilotId] !== skip) target = world.byId[world.pilotId];
    }
    return target;
  }

  // threatOf(e, world) — what PREY runs from: the nearest of the pilot and every hunting mind (`motivation: 'hunt'`)
  // not on its own team. Without hunting minds in the world this is the pilot, as before.
  function threatOf(e, world) {
    if (!world || !world.byId) return null;
    let best = world.pilotId && world.byId[world.pilotId] !== e ? world.byId[world.pilotId] : null;
    let bd = best ? Math.hypot(best.transform.pos[0] - e.transform.pos[0], best.transform.pos[1] - e.transform.pos[1]) : Infinity;
    for (const id in world.byId) {
      const o = world.byId[id];
      if (o === e || o.downed || !o.rule || !o.rule.mind || o.rule.mind.motivation !== 'hunt') continue;
      if (e.team && o.team === e.team) continue;
      const d = Math.hypot(o.transform.pos[0] - e.transform.pos[0], o.transform.pos[1] - e.transform.pos[1]);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
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
  // walkToward(e, r, want, dt, world, speed) — turn toward heading `want` and walk on when roughly facing it, solid and
  // on the ground, with the walk gait. Returns the distance moved.
  function walkToward(e, r, want, dt, world, speed) {
    const t = e.transform, eye = r.eye ?? 0;
    const rem = turnToward(t, want, r, dt);
    let step = 0;
    if (Math.abs(rem) < 1.1) {
      const f = fwdXY(t.heading);
      step = speed * dt;
      t.pos[0] += f[0] * step; t.pos[1] += f[1] * step;
    }
    if (world && world.colliders) block(t, r, eye, world);
    standOnGround(t, r, eye, world);
    if (step > 0) { e.locomotion = 'forward'; e.gaitPhase = (e.gaitPhase || 0) + step / (r.stride ?? 2.4); e.moving = true; }
    else e.moving = false;
    return step;
  }
  // navTo(e, r, dt, world, goal, speed) — PATHING `navmesh` (`rule.mind.pathing`): when the grid line to the goal is
  // blocked it walks the path's next corner (replanned every `navReplan` s, 0.5, or when the goal moves a cell) and
  // returns true; with a clear line, no colliders or no path at all it returns false and the caller goes direct.
  function navTo(e, r, dt, world, goal, speed) {
    if (!(r.mind && r.mind.pathing === 'navmesh') || !world || !world.colliders || !navPath) return false;
    const t = e.transform, eye = r.eye ?? 0;
    // `navCell`: the grid's cell (a person among walls wants finer than the default, a metre or its radius)
    const opts = { radius: r.collideRadius || 0.5, height: r.collideHeight ?? 24, footZ: t.pos[2] - eye, step: r.step ?? 0.35, ...(r.navCell > 0 ? { cell: r.navCell } : {}) };
    if (navClear(world, t.pos, goal, opts)) { e.navPath = null; return false; }
    const cell = opts.cell || world.navCell || Math.max(1, opts.radius);
    e.navT = (e.navT || 0) - dt;
    const moved = !e.navGoal || Math.hypot(goal[0] - e.navGoal[0], goal[1] - e.navGoal[1]) > cell;
    if (!e.navPath || e.navT <= 0 || moved) {
      e.navPath = navPath(world, t.pos, goal, opts); e.navGoal = [goal[0], goal[1]]; e.navT = r.navReplan ?? 0.5;
    }
    const path = e.navPath;
    if (!path || !path.length) return false;
    // a corner is reached within a metre (or its radius); on a finer grid, within most of a cell
    const reach = opts.cell ? Math.max(opts.radius, opts.cell * 0.6) : Math.max(1, opts.radius);
    while (path.length > 1 && Math.hypot(path[0][0] - t.pos[0], path[0][1] - t.pos[1]) < reach) path.shift();
    const wp = path[0];
    walkToward(e, r, Math.atan2(wp[1] - t.pos[1], wp[0] - t.pos[0]), dt, world, speed);
    e.aiFire = 0;
    return true;
  }
  // ── PERCEPTION (`rule.mind.perception`): 'sight' knows a target only while it sees it; 'memory' also keeps where it
  // last saw it, goes there and searches. Without the setting a mind knows where its target is (the arena's brain).
  // perceive(e, r, target, world) — in `sightRange` (120), in the facing cone `sightCone` (half-angle 1.2 rad; skipped
  // while it saw the target in the last half second), and a clear line past the colliders, eye to eye. A sighting is
  // recorded on `e.lastSeen` { pos, t, id }; a fresh one counts `e.sightings` (the bus's `seen`).
  function perceive(e, r, target, world) {
    const t = e.transform, q = target.transform.pos, now = (world && world.time) || 0;
    const dx = q[0] - t.pos[0], dy = q[1] - t.pos[1];
    if (Math.hypot(dx, dy) > (r.sightRange ?? 120)) return false;
    const recent = e.lastSeen && e.lastSeen.id === target.id && now - e.lastSeen.t < 0.5;
    if (!recent) {
      const off = Math.atan2(dy, dx) - t.heading;
      if (Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > (r.sightCone ?? 1.2)) return false;
    }
    const eyeH = (b) => (b.rule && b.rule.collideHeight != null ? b.rule.collideHeight : 24) * 0.75 - ((b.rule && b.rule.eye) || 0);
    if (world && world.colliders && sightBlocked([t.pos[0], t.pos[1], t.pos[2] + eyeH(e)], [q[0], q[1], q[2] + eyeH(target)], world.colliders)) return false;
    // a FRESH sighting (not seen in the last half second) is counted: castFacts says it on the bus (`seen`)
    if (!recent) { e.sightings = (e.sightings || 0) + 1; e.seenId = target.id; }
    e.lastSeen = { pos: [q[0], q[1], q[2]], t: now, id: target.id };
    if (e.searchT != null && e.locomotion === 'search') e.locomotion = 'forward';
    e.searchT = null;
    return true;
  }
  // takeCover(e, r, dt, world, target) — COVER (opt-in `rule.cover`: true | { radius, hold }). Hurt (a hit in the last
  // `hold` s, 2.5) or reloading, it breaks for the nearest spot within `radius` (8) that the colliders hide from its
  // target's eye: its own eye, the top of its head (a wall lower than it is no cover) and its flanks (a shoulder past a
  // wall's end is no cover), and holds there facing the target, trigger cold; whole again and loaded, it steps back into the
  // fight (with memory, out after the one it fights: a hit tells it where the fire came from). Cover is taken from the
  // one it fights whether it sees it or not. A spot that stops hiding it (the target moved round) is dropped for a new
  // one. Returns true while it owns the body; false with nothing to fear, no colliders or no spot that hides.
  function takeCover(e, r, dt, world, target) {
    const cfg = r.cover === true ? {} : r.cover, t = e.transform, now = (world && world.time) || 0;
    // a hit tells it where the fire came from: its memory of the one it fights is fresh (so, the hold over, a mind with
    // memory goes back out after it, and sees it)
    if ((e.hits || 0) > (e.coverHits || 0)) {
      e.coverHits = e.hits; e.coverUntil = now + (cfg.hold ?? 2.5);
      e.lastSeen = { pos: target.transform.pos.slice(), t: now, id: target.id };
    }
    const fear = (e.weapon && e.weapon.reloading) || (e.coverUntil != null && now < e.coverUntil);
    if (!fear || !world || !world.colliders) { e.coverAt = null; return false; }
    const eyeH = (b) => (b.rule && b.rule.collideHeight != null ? b.rule.collideHeight : 24) * 0.75 - ((b.rule && b.rule.eye) || 0);
    const q = target.transform.pos, from = [q[0], q[1], q[2] + eyeH(target)], eye = r.eye ?? 0, up = eyeH(e), top = (r.collideHeight ?? 24) - eye;
    const flank = (r.collideRadius || 0.5) + 0.2;
    const hides = (p) => {
      const dx = p[0] - q[0], dy = p[1] - q[1], dn = Math.hypot(dx, dy) || 1, sx = (-dy / dn) * flank, sy = (dx / dn) * flank;
      for (const [x, y, z] of [[p[0], p[1], up], [p[0], p[1], top], [p[0] + sx, p[1] + sy, up], [p[0] - sx, p[1] - sy, up]]) {
        if (!sightBlocked(from, [x, y, p[2] + z], world.colliders)) return false;
      }
      return true;
    };
    if (!e.coverAt || !hides(e.coverAt)) {
      e.coverAt = null;
      const R = cfg.radius ?? 8, rad = (r.collideRadius || 0.5) + 0.35;   // clear of the box, room to stand and to path
      for (let ring = 1; ring <= 4 && !e.coverAt; ring++) {
        let best = null, bd = Infinity;
        for (let k = 0; k < 12; k++) {
          const a = (k * TAU) / 12 + ring * 0.26, d = (R * ring) / 4, x = t.pos[0] + Math.cos(a) * d, y = t.pos[1] + Math.sin(a) * d;
          const g = world.ground ? world.ground([x, y, t.pos[2] + 2]) : null, p = [x, y, g != null ? g + eye : t.pos[2]];
          // not inside a box, and hidden from the target; the nearest to the threat's side wins a tie
          if (world.colliders.some((c) => x > c.min[0] - rad && x < c.max[0] + rad && y > c.min[1] - rad && y < c.max[1] + rad && c.max[2] > p[2] - eye + 0.3)) continue;
          if (!hides(p)) continue;
          const dd = Math.hypot(x - q[0], y - q[1]);
          if (dd < bd) { bd = dd; best = p; }
        }
        e.coverAt = best;
      }
    }
    if (!e.coverAt) return false;
    const c = e.coverAt;
    if (Math.hypot(c[0] - t.pos[0], c[1] - t.pos[1]) > 0.4) goTo(e, r, dt, world, c, (r.speed ?? 6) * 1.2);
    else { e.moving = false; turnToward(t, Math.atan2(q[1] - t.pos[1], q[0] - t.pos[0]), r, dt); }
    e.aiFire = 0;
    return true;
  }
  // recall(e, r, dt, world) — MEMORY: walk to the last-seen spot (pathing when it paths), then SEARCH there, sweeping
  // its gaze for `searchTime` (3 s). Past `memorySpan` (8 s) since the sighting, or once the search is done, it forgets.
  // True while memory owns the body.
  function recall(e, r, dt, world) {
    const ls = e.lastSeen, now = (world && world.time) || 0;
    if (!ls || now - ls.t > (r.memorySpan ?? 8)) { e.lastSeen = null; e.searchT = null; return false; }
    const t = e.transform, dx = ls.pos[0] - t.pos[0], dy = ls.pos[1] - t.pos[1];
    e.aiFire = 0;
    if (e.searchT == null && Math.hypot(dx, dy) > Math.max(1.5, r.collideRadius || 0)) {
      if (!navTo(e, r, dt, world, ls.pos, r.speed ?? 6)) walkToward(e, r, Math.atan2(dy, dx), dt, world, r.speed ?? 6);
      e.searchFrom = t.heading;
      return true;
    }
    e.searchT = (e.searchT || 0) + dt;
    if (e.searchT > (r.searchTime ?? 3)) { e.lastSeen = null; e.searchT = null; e.locomotion = 'forward'; return false; }
    turnToward(t, (e.searchFrom ?? t.heading) + Math.sin(e.searchT * 2.1) * 1.4, r, dt);
    e.moving = false; e.locomotion = 'search';
    return true;
  }
  // a guard's post: `rule.post`, else where it was placed
  // An ESCORT's post is its ward: `rule.escort` (an id), else the nearest ally on its team, else the pilot.
  function wardOf(e, r, world) {
    if (!world || !world.byId) return null;
    if (r.escort && world.byId[r.escort]) return world.byId[r.escort];
    if (e.team) {
      let best = null, bd = Infinity;
      for (const id in world.byId) {
        const o = world.byId[id];
        if (o === e || o.isCamera || o.team !== e.team) continue;
        const d = Math.hypot(o.transform.pos[0] - e.transform.pos[0], o.transform.pos[1] - e.transform.pos[1]);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) return best;
    }
    const p = world.pilotId ? world.byId[world.pilotId] : null;
    return p && p !== e ? p : null;
  }
  // home: `rule.post`, else where it was placed (kept the first time it is asked)
  const homeOf = (e, r) => (Array.isArray(r.post) ? r.post : (e.home || (e.home = (e.spawn ? e.spawn.pos : e.transform.pos).slice())));
  const postOf = (e, r, world) => {
    if (r.mind && r.mind.motivation === 'escort') { const w = wardOf(e, r, world); if (w) return w.transform.pos; }
    return Array.isArray(r.post) ? r.post : e.spawn ? e.spawn.pos : e.transform.pos;
  };
  // returnToPost(e, r, dt, world) — walk back to the post and stand there (LOST, for a guard; for an escort, back to
  // within `followDist` (6) of its ward)
  function returnToPost(e, r, dt, world) {
    const t = e.transform, p = postOf(e, r, world);
    const dx = p[0] - t.pos[0], dy = p[1] - t.pos[1];
    const arrive = r.mind && r.mind.motivation === 'escort' ? (r.followDist ?? 6) : (r.arrive ?? 1.5);
    if (Math.hypot(dx, dy) <= arrive) {
      e.moving = false;
      // a LOOKOUT (`rule.scan`, radians): at its post it sweeps its gaze either side of the heading it was placed with,
      // over `scanPeriod` (6 s), so a sneak can time it
      if (r.scan > 0) {
        const base = e.scanFrom ?? (e.scanFrom = t.heading), now = (world && world.time) || 0;
        turnToward(t, base + Math.sin((now * TAU) / (r.scanPeriod ?? 6)) * r.scan, r, dt);
      }
      return;
    }
    if (!navTo(e, r, dt, world, p, r.speed ?? 6)) walkToward(e, r, Math.atan2(dy, dx), dt, world, r.speed ?? 6);
  }

  // ── IDLE MOTION: what a mind does with no one to fight, by motivation ─────────────────────
  // seeded per body (its id and a counter through an FNV-style hash): the same world wanders the same way every run
  function hash01(id, n) {
    const s = String(id) + ':' + n;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function goTo(e, r, dt, world, goal, speed) {
    const t = e.transform;
    // FLOORS (opt-in `rule.floors`): a goal on another floor is reached by a flight (floorWay); on the flight itself it
    // walks straight up or down the steps
    if (Array.isArray(r.floors) && r.floors.length) {
      goal = floorWay(e, r, goal);
      if (e.flight) { walkToward(e, r, Math.atan2(goal[1] - t.pos[1], goal[0] - t.pos[0]), dt, world, speed); return; }
    }
    if (!navTo(e, r, dt, world, goal, speed)) walkToward(e, r, Math.atan2(goal[1] - t.pos[1], goal[0] - t.pos[0]), dt, world, speed);
  }
  // FLOORS: `rule.floors` [{ area: [x0, y0, x1, y1], z, flights: [{ bottom: [x, y], top: [x, y] }] }], each a floor over
  // the ground (a tower's top, gameworld/lay-concerns.js towerFloor) and the stair up to it. A point is on a floor when it
  // stands over its area within 0.6 m of its height (a body's feet, or its eye on the ground below the floor's height).
  const floorAt = (F, p, footZ) => F.findIndex((f) => p[0] >= f.area[0] && p[0] <= f.area[2] && p[1] >= f.area[1] && p[1] <= f.area[3] && footZ >= f.z - 0.6);
  // floorWay(e, r, goal) — where to walk now for a goal: the goal itself on the same floor; else, from the ground, the
  // foot of the goal floor's nearest flight and then up it to its top; from a floor, its nearest flight's top and then
  // down it to its foot (a floor to another goes down and up). `e.flight` is the flight being walked ({ to, k, f }).
  function floorWay(e, r, goal) {
    const F = r.floors, t = e.transform, me = floorAt(F, t.pos, t.pos[2] - (r.eye ?? 0)), there = floorAt(F, goal, Number.isFinite(goal[2]) ? goal[2] : 0);
    const d = (p) => Math.hypot(p[0] - t.pos[0], p[1] - t.pos[1]);
    if (e.flight) {
      const fl = F[e.flight.f].flights[e.flight.k], to = e.flight.to === 'up' ? fl.top : fl.bottom;
      if (d(to) > 0.5) return [to[0], to[1], goal[2]];
      e.flight = null;
    }
    if (me === there) return goal;
    const f = me >= 0 ? me : there, near = (p) => F[f].flights.reduce((b, x, k) => (Math.hypot(x[p][0] - t.pos[0], x[p][1] - t.pos[1]) < Math.hypot(F[f].flights[b][p][0] - t.pos[0], F[f].flights[b][p][1] - t.pos[1]) ? k : b), 0);
    if (me < 0) {   // on the ground: to the foot, then up
      const k = near('bottom'), fl = F[f].flights[k];
      if (d(fl.bottom) <= 0.8) { e.flight = { f, k, to: 'up' }; return [fl.top[0], fl.top[1], goal[2]]; }
      return [fl.bottom[0], fl.bottom[1], 0];
    }
    const k = near('top'), fl = F[f].flights[k];   // on a floor: to its stair's top, then down
    if (d(fl.top) <= 0.8) { e.flight = { f, k, to: 'down' }; return [fl.bottom[0], fl.bottom[1], goal[2]]; }
    return [fl.top[0], fl.top[1], F[f].z];
  }
  // wanderStep — WANDER: legs to seeded points within `wanderRadius` (12) of home at `wanderSpeedMul` (0.5) of its
  // speed, a pause between legs (`pause` [lo, hi] s); during a pause it holds `pauseLoco` when one is given.
  function wanderStep(e, r, dt, world, o) {
    const t = e.transform, home = homeOf(e, r);
    if (e.wanderPauseT > 0) {
      e.wanderPauseT -= dt; e.moving = false;
      if (o.pauseLoco) e.locomotion = e.wanderPauseT > 0 ? o.pauseLoco : 'forward';
      return;
    }
    if (!e.wanderGoal) {
      const n = e.wanderN = (e.wanderN || 0) + 1;
      const a = hash01(e.id, 2 * n) * TAU, d = Math.sqrt(hash01(e.id, 2 * n + 1)) * (r.wanderRadius ?? 12);
      e.wanderGoal = [home[0] + Math.cos(a) * d, home[1] + Math.sin(a) * d, home[2] || 0]; e.wanderLegT = 0;
    }
    const g = e.wanderGoal;
    e.wanderLegT += dt;
    if (Math.hypot(g[0] - t.pos[0], g[1] - t.pos[1]) < 1 || e.wanderLegT > 20) {
      e.wanderGoal = null;
      e.wanderPauseT = o.pause[0] + hash01(e.id, -e.wanderN) * (o.pause[1] - o.pause[0]);
      e.moving = false; return;
    }
    goTo(e, r, dt, world, g, (r.speed ?? 6) * o.speedMul);
  }
  // grazeStep — FORAGE: the nearest food (a body with `food: true`) within `forageRadius` (20) of home it has not
  // grazed in `regrow` s (30): walk there and graze (`locomotion: 'graze'`) for `grazeTime` (4 s). No food: drift
  // slowly and graze in place between legs.
  function grazeStep(e, r, dt, world) {
    const t = e.transform, now = (world && world.time) || 0;
    if (e.grazeT > 0) {
      e.grazeT -= dt; e.moving = false; e.locomotion = 'graze';
      if (e.grazeT <= 0) { e.locomotion = 'forward'; if (e.grazeFood) { (e.grazed || (e.grazed = {}))[e.grazeFood] = now; e.grazeFood = null; } }
      return;
    }
    const home = homeOf(e, r);
    let food = null, bd = Infinity;
    if (world && world.byId) {
      for (const id in world.byId) {
        const o = world.byId[id];
        if (o === e || !o.food || !o.transform) continue;
        if (e.grazed && e.grazed[o.id] != null && now - e.grazed[o.id] < (r.regrow ?? 30)) continue;
        const q = o.transform.pos;
        if (Math.hypot(q[0] - home[0], q[1] - home[1]) > (r.forageRadius ?? 20)) continue;
        const d = Math.hypot(q[0] - t.pos[0], q[1] - t.pos[1]);
        if (d < bd) { bd = d; food = o; }
      }
    }
    if (food) {
      if (bd < 2) { e.grazeT = r.grazeTime ?? 4; e.grazeFood = food.id; e.moving = false; e.locomotion = 'graze'; return; }
      goTo(e, r, dt, world, food.transform.pos, (r.speed ?? 6) * 0.6);
      return;
    }
    wanderStep(e, r, dt, world, { speedMul: 0.35, pause: [4, 7], pauseLoco: 'graze' });
  }
  // ── PEEK (opt-in `rule.peek`: true | { reach, hold }): a mind that knows where its foe was but cannot see it does not
  // walk out into its line: it sidesteps, to the nearest spot within `reach` (2 m) either side from which its eye sees
  // that place and its muzzle clears the edge, the one with the least of its body in the foe's sight (a tie to its gun's
  // side); it holds there `hold` (2.5) s, firing when it sees, and steps back to where it stood when nothing shows. With
  // a gun in hand (`weapon.hand`) the muzzle is off its eye's line, so past an edge on the gun's side it is ready to fire
  // with less of itself out: the right-hand peeker's advantage falls out of where the gun is, not out of a rule.
  // peekSpot(e, r, world, at) — the spot to peek from, toward a foe last seen at `at` → { at, side, exposure } | null
  function peekSpot(e, r, world, at) {
    const t = e.transform, w = e.weapon, cs = world.colliders, reach = (r.peek && r.peek.reach) || 2;
    const eyeH = (b) => (b.rule && b.rule.collideHeight != null ? b.rule.collideHeight : 24) * 0.75 - ((b.rule && b.rule.eye) || 0);
    const foeEye = [at[0], at[1], at[2] + 1.6], foeChest = [at[0], at[1], at[2] + 1.2];
    const face = Math.atan2(at[1] - t.pos[1], at[0] - t.pos[0]), hr = rightXY(face), hand = w && w.hand === 'left' ? -1 : 1;
    const probe = { ...e, transform: { ...t, heading: face } };
    let best = null;
    for (let k = 0.1; k <= reach + 1e-9; k = Math.round((k + 0.1) * 10) / 10) {
      for (const side of [hand, -hand]) {
        const p = [t.pos[0] + hr[0] * k * side, t.pos[1] + hr[1] * k * side, t.pos[2]];
        // room to stand there: no box at its body
        if (cs.some((c) => p[0] > c.min[0] - 0.3 && p[0] < c.max[0] + 0.3 && p[1] > c.min[1] - 0.3 && p[1] < c.max[1] + 0.3 && c.max[2] > p[2] - (r.eye ?? 0) + 0.3)) continue;
        probe.transform = { ...t, pos: p, heading: face };
        const eye = [p[0], p[1], p[2] + eyeH(e)];
        if (sightBlocked(eye, foeChest, cs) || sightBlocked(muzzleAt(probe, w), foeChest, cs)) continue;
        const exposure = bodyExposure(probe, [p[0], p[1], p[2] - (r.eye ?? 0)], foeEye, cs);
        if (!best || exposure < best.exposure - 1e-9) best = { at: p, side, exposure, k };
      }
      if (best) return best;   // the nearest step that clears: the least out, its gun's side first
    }
    return null;
  }
  // peekStep(e, r, dt, world) — the peek, while it owns the body: true
  function peekStep(e, r, dt, world) {
    const ls = e.lastSeen, now = (world && world.time) || 0, t = e.transform;
    if (!ls || !world || !world.colliders || !e.weapon || now - ls.t > (r.memorySpan ?? 8)) { e.peek = null; return false; }
    if (!e.peek || e.peek.seenT !== ls.t) {
      const P = peekSpot(e, r, world, ls.pos);
      if (!P) { e.peek = null; return false; }
      e.peek = { ...P, from: t.pos.slice(), seenT: ls.t, t: now };
    }
    const P = e.peek, face = Math.atan2(ls.pos[1] - t.pos[1], ls.pos[0] - t.pos[0]);
    turnToward(t, face, r, dt); e.aiFire = 0;
    const back = now - P.t > ((r.peek && r.peek.hold) || 2.5), goal = back ? P.from : P.at;
    const dx = goal[0] - t.pos[0], dy = goal[1] - t.pos[1], d = Math.hypot(dx, dy);
    if (d > 0.01) {
      // a sidestep, facing the foe the while
      const step = Math.min(d, (r.speed ?? 6) * 0.8 * dt);
      t.pos[0] += (dx / d) * step; t.pos[1] += (dy / d) * step;
      if (world.colliders) block(t, r, r.eye ?? 0, world);
      standOnGround(t, r, r.eye ?? 0, world);
      e.moving = true; e.locomotion = 'forward'; e.gaitPhase = (e.gaitPhase || 0) + step / (r.stride ?? 2.4);
    } else e.moving = false;
    if (back && d <= 0.01) { e.peek = null; e.lastSeen = null; return false; }   // back behind it, nothing seen: let it go
    e.peekHolding = !back;
    return true;
  }

  // ── FRAG (`rule.mind.motivation: 'frag'`): a match player. Everyone not on its team is its foe (`rule.target`, else
  // 'enemy' on a team, 'all' without one). It fights whom it can SEE, never the nearest body behind a wall; seen, the
  // one that shot it last (for `fragGrudge`, 3 s) and the one it already fights count closer. Seeing no one it never
  // stands: it follows its freshest LEAD, the place the shot that hit it came from, a gunshot it heard (within
  // `hearRange`, 35, in the last half second) or where it last saw a foe, for `leadSpan` (6 s); with none, a HUNCH:
  // every `hunchEvery` (8) s a rival picked by its seeded dice, walked toward. While it shoots it strafes, side to side
  // on its juke clock (`strafe`, 0.6 of its speed; 0 stands).
  const fragPolicy = (e, r) => r.target ?? (e.team ? 'enemy' : 'all');
  const fragFoe = (e, o, policy) => o !== e && !o.isCamera && !o.downed && !o.gone && !o.invincible && o.body && o.body.hittable && !(policy === 'enemy' && e.team && o.team === e.team);
  // canSee(e, r, o, world, wide) — in sight range, in its facing cone (unless wide: the one it fights, the one that shot
  // it), and a clear line eye to eye; no side effects (perceive records the sighting)
  function canSee(e, r, o, world, wide) {
    const t = e.transform, q = o.transform.pos, dx = q[0] - t.pos[0], dy = q[1] - t.pos[1];
    if (Math.hypot(dx, dy) > (r.sightRange ?? 120)) return false;
    if (!wide) { const off = Math.atan2(dy, dx) - t.heading; if (Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) > (r.sightCone ?? 1.2)) return false; }
    const eyeH = (b) => (b.rule && b.rule.collideHeight != null ? b.rule.collideHeight : 24) * 0.75 - ((b.rule && b.rule.eye) || 0);
    return !(world.colliders && sightBlocked([t.pos[0], t.pos[1], t.pos[2] + eyeH(e)], [q[0], q[1], q[2] + eyeH(o)], world.colliders));
  }
  function fragNotice(e, r, world) {
    if (!world || !world.byId) return null;
    const now = world.time || 0, t = e.transform, policy = fragPolicy(e, r);
    // a hit says who and where from: a grudge, and a lead to the shooter
    if ((e.hits || 0) > (e.fragHits || 0)) {
      e.fragHits = e.hits;
      const by = e.lastHitBy && world.byId[e.lastHitBy];
      if (by && by !== e) { e.fragGrudge = { id: by.id, t: now }; e.fragLead = { pos: by.transform.pos.slice(), t: now }; }
    }
    const grudge = e.fragGrudge && now - e.fragGrudge.t < (r.fragGrudge ?? 3) ? e.fragGrudge.id : null;
    let best = null, bc = Infinity;
    for (const id in world.byId) {
      const o = world.byId[id];
      if (!fragFoe(e, o, policy)) continue;
      const mine = o.id === e.fragTarget || o.id === grudge;
      if (!canSee(e, r, o, world, mine)) continue;
      let c = Math.hypot(o.transform.pos[0] - t.pos[0], o.transform.pos[1] - t.pos[1]);
      if (o.id === e.fragTarget) c *= 0.6;
      if (o.id === grudge) c *= 0.3;   // being shot turns it, unless the one it fights is much closer
      if (c < bc) { bc = c; best = o; }
    }
    e.fragTarget = best ? best.id : null;
    return best;
  }
  // ITEMS (opt-in `rule.items`: [{ at, gives, back }], the arena's supplies as the mind knows them): hurt (under
  // `itemsBelow`, 0.6, of its hp) it goes for the nearest health or armor, short of rounds (fewer than a magazine left)
  // for ammo, and an overdrive within 12 m it takes on the way. It remembers when it took each (it stood on it) and
  // does not go back before its `back`: item timing, a match's map knowledge. → the item's place, or null
  // rangeNeed(e, lo) — the distance a carried gun wants (a held slot whose band starts 12 m or more out, with rounds: the
  // long gun): halfway from its band's near edge to its sweet spot, and half a metre; 0 when it carries none
  function rangeNeed(e, lo) {
    let need = 0;
    if (!lo || !e.loadoutWeapons) return 0;
    for (let i = 0; i < lo.length; i++) {
      const b = lo[i] && lo[i].band, g = e.loadoutWeapons[i];
      if (!Array.isArray(b) || b[0] < 12 || !g || (e.loadoutHeld && !e.loadoutHeld[i]) || (g.ammo <= 0 && g.reserve === 0)) continue;
      const sw = lo[i].approach && Number.isFinite(lo[i].approach.standoff) ? lo[i].approach.standoff : b[0] + 1;
      need = Math.max(need, (b[0] + Math.max(b[0] + 1, sw)) / 2 + 0.5);
    }
    return need;
  }
  // allyOnLine(e, from, target, world) — a standing body of its own side within a body's width of the line from `from`
  // to the target, before it (opt-in `rule.clearLine`: it holds its fire rather than shoot through a teammate)
  function allyOnLine(e, from, target, world) {
    const q = target.transform.pos, lx = q[0] - from[0], ly = q[1] - from[1], L = Math.hypot(lx, ly) || 1e-6;
    for (const id in (world && world.byId) || {}) {
      const o = world.byId[id];
      if (o === e || o === target || o.team !== e.team || o.downed || o.gone || !(o.body && o.body.hittable)) continue;
      const ox = o.transform.pos[0] - from[0], oy = o.transform.pos[1] - from[1], along = (ox * lx + oy * ly) / L;
      if (along > 0 && along < L && Math.abs(ox * ly - oy * lx) / L < 0.8) return true;
    }
    return false;
  }
  function itemGoal(e, r, world) {
    const items = r.items, now = (world && world.time) || 0, t = e.transform;
    if (!Array.isArray(items) || !items.length || !e.body) return null;
    const took = e.itemTook || (e.itemTook = {});
    items.forEach((it, k) => { if (Math.hypot(it.at[0] - t.pos[0], it.at[1] - t.pos[1]) < 1.2) took[k] = now; });
    const hurt = e.hpMax > 0 && Number.isFinite(e.body.hp) && e.body.hp < (r.itemsBelow ?? 0.6) * e.hpMax;
    const w = e.weapon, dry = !!w && w.reserve != null && w.ammo + w.reserve < w.magazine;
    // a weapon (`gives: 'weapon'`, its loadout `slot`): wanted while not yet carried, or carried and nearly dry, within
    // `gunReach` (18 m): farther, the hunt comes first
    const lo = e.pilotRule && Array.isArray(e.pilotRule.loadout) ? e.pilotRule.loadout : Array.isArray(r.loadout) ? r.loadout : null;
    const gun = (it) => {
      const i = !lo || !e.loadoutWeapons ? -1 : Number.isInteger(it.slot) ? it.slot : lo.findIndex((c) => c && c.name === it.slot), g = i >= 0 ? e.loadoutWeapons[i] : null;
      return !!g && ((e.loadoutHeld && !e.loadoutHeld[i]) || (g.reserve != null && g.ammo + g.reserve < g.magazine));
    };
    let best = null, bd = Infinity;
    items.forEach((it, k) => {
      if (took[k] != null && now - took[k] < (it.back ?? Infinity)) return;
      const d = Math.hypot(it.at[0] - t.pos[0], it.at[1] - t.pos[1]);
      const want = ((it.gives === 'health' || it.gives === 'armor') && hurt) || (it.gives === 'ammo' && dry) || (it.gives === 'overdrive' && d < 12) || (it.gives === 'weapon' && d < (r.gunReach ?? 18) && gun(it));
      if (want && d < bd) { bd = d; best = it; }
    });
    return best ? best.at : null;
  }
  // fragRoam(e, r, dt, world) — no foe in sight: an item it wants first, then hear, then follow the freshest lead, else
  // a hunch
  function fragRoam(e, r, dt, world) {
    const t = e.transform, now = (world && world.time) || 0, span = r.leadSpan ?? 6;
    const item = itemGoal(e, r, world);
    if (item) { e.aiFire = 0; e.seekingItem = true; goTo(e, r, dt, world, item, r.speed ?? 6); return; }
    e.seekingItem = false;
    // a PERCH (opt-in `rule.perches: [[x, y, z?], …]`, spots where long lines meet): carrying a gun that wants distance
    // (`keepRange`), no foe in sight and nothing it wants, it holds the nearest perch and watches, turning slowly, rather
    // than hunt into a close fight
    const lo = e.pilotRule && Array.isArray(e.pilotRule.loadout) ? e.pilotRule.loadout : Array.isArray(r.loadout) ? r.loadout : null;
    if (r.keepRange && Array.isArray(r.perches) && r.perches.length && rangeNeed(e, lo)) {
      const pk = r.perches.reduce((p, q) => (Math.hypot(q[0] - t.pos[0], q[1] - t.pos[1]) < Math.hypot(p[0] - t.pos[0], p[1] - t.pos[1]) ? q : p));
      e.aiFire = 0; e.perched = Math.hypot(pk[0] - t.pos[0], pk[1] - t.pos[1]) <= 1;
      if (!e.perched) { goTo(e, r, dt, world, pk, r.speed ?? 6); return; }
      e.moving = false; t.heading += (r.turn ?? 3) * 0.25 * dt; return;
    }
    e.perched = false;
    // an OBJECTIVE (opt-in `rule.objective: { at, radius? }`, a point its side holds): no foe in sight and nothing it
    // wants, it goes there and stands on it (within `radius`, 2 m), turning to look round
    const O = r.objective;
    if (O && Array.isArray(O.at)) {
      e.aiFire = 0;
      if (Math.hypot(O.at[0] - t.pos[0], O.at[1] - t.pos[1]) > (O.radius ?? 2)) { goTo(e, r, dt, world, O.at, r.speed ?? 6); return; }
      e.moving = false; t.heading += (r.turn ?? 3) * 0.3 * dt; return;
    }
    if (world && world.byId) {
      let heard = null, hd = r.hearRange ?? 35;
      for (const id in world.byId) {
        const o = world.byId[id], s = o.lastShot;
        if (o === e || !s || now - s.t > 0.5 || !s.from) continue;
        const d = Math.hypot(s.from[0] - t.pos[0], s.from[1] - t.pos[1]);
        if (d < hd) { hd = d; heard = s.from; }
      }
      if (heard && !(e.fragLead && now - e.fragLead.t < 0.5)) e.fragLead = { pos: heard.slice(), t: now };
    }
    // where it last saw a foe is a lead too, as old as the sighting
    if (e.lastSeen && (!e.fragLead || e.lastSeen.t > e.fragLead.t)) e.fragLead = { pos: e.lastSeen.pos.slice(), t: e.lastSeen.t };
    let goal = e.fragLead && now - e.fragLead.t < span ? e.fragLead.pos : null;
    if (goal && Math.hypot(goal[0] - t.pos[0], goal[1] - t.pos[1]) < 2) { e.fragLead = null; e.lastSeen = null; goal = null; }
    if (!goal) {
      if (!e.fragHunch || now >= e.fragHunch.until) {
        const foes = [];
        for (const id in (world && world.byId) || {}) { const o = world.byId[id]; if (fragFoe(e, o, fragPolicy(e, r))) foes.push(o); }
        const n = e.fragHunchN = (e.fragHunchN || 0) + 1;
        e.fragHunch = foes.length ? { id: foes[Math.floor(hash01(e.id, 7919 + n) * foes.length)].id, until: now + (r.hunchEvery ?? 8) } : null;
      }
      const h = e.fragHunch && world.byId[e.fragHunch.id];
      if (h && !h.downed && !h.gone) goal = h.transform.pos;
    }
    if (!goal) { e.moving = false; return; }
    e.aiFire = 0;
    goTo(e, r, dt, world, goal, r.speed ?? 6);
  }
  // idle(e, r, dt, world, motive) — IDLE by motivation; a mind without one stands
  function idle(e, r, dt, world, motive) {
    // GROUP (group.js): a member out of the fight keeps its formation slot behind the leader
    if (e.groupId && e.groupSlot) {
      const gs = e.groupSlot, d = Math.hypot(gs[0] - e.transform.pos[0], gs[1] - e.transform.pos[1]);
      if (d > 1.5) goTo(e, r, dt, world, [gs[0], gs[1], e.transform.pos[2]], r.speed ?? 6); else e.moving = false;
      return;
    }
    if (motive === 'guard' || motive === 'escort') return returnToPost(e, r, dt, world);
    if (motive === 'wander' || motive === 'territorial') return wanderStep(e, r, dt, world, { speedMul: r.wanderSpeedMul ?? 0.5, pause: [r.wanderPause ?? 2, (r.wanderPause ?? 2) * 2] });
    if (motive === 'forage') return grazeStep(e, r, dt, world);
    if (motive === 'frag') return fragRoam(e, r, dt, world);
    e.moving = false;
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
    // a duelist's switching: health phases (a crossing may hold the shift beat) and the adapting ledger
    if (r.mind && (r.mind.phases || r.mind.rank === 'boss') && stepPhase(e, r, dt)) { e.aiFire = 0; return; }
    if (r.mind && adapts(r.mind)) stepAdapt(e, r, dt, world);
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
      const lungeTo = e.lungeTo && world && world.byId ? world.byId[e.lungeTo] : null;
      const lungeRoom = !lungeTo || Math.hypot(lungeTo.transform.pos[0] - t.pos[0], lungeTo.transform.pos[1] - t.pos[1]) > (e.strikeParams ? e.strikeParams.reach : 1) * 0.5;
      if (e.swingLunge && e.strikeParams && e.swingT < e.strikeParams.to && lungeRoom) {   // it stops at half its reach
        const lf = fwdXY(t.heading), ls = e.swingLunge * dt;
        t.pos[0] += lf[0] * ls; t.pos[1] += lf[1] * ls;
        if (!r.space && world && world.colliders) block(t, r, eye, world);
      }
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
    // Motivation (`rule.mind.motivation`). FLEE: inside `fearRadius` (18) of the threat it turns and runs, faster than
    // it walks (`fleeSpeed`, else 1.6× its speed), whatever its temperament; outside it, it stands. Prey never fights.
    const motive = r.mind && r.mind.motivation;
    if (motive === 'flee') {
      e.reactionEnded = false;
      // a HERD's alarm (group.js) sets every member running along its scatter bearing, near the threat or not
      if (e.groupAlarm && e.groupSlot) {
        const gs = e.groupSlot;
        walkToward(e, r, Math.atan2(gs[1] - t.pos[1], gs[0] - t.pos[0]), dt, world, r.fleeSpeed ?? speed * 1.6);
        return;
      }
      const threat = r.target ? pickTarget(e, world, r.target) : threatOf(e, world);
      if (!threat || threat === e) { if (e.groupId && e.groupSlot) idle(e, r, dt, world, motive); else e.moving = false; return; }
      const fx = t.pos[0] - threat.transform.pos[0], fy = t.pos[1] - threat.transform.pos[1];
      if (Math.hypot(fx, fy) < (r.fearRadius ?? 18)) walkToward(e, r, Math.atan2(fy, fx), dt, world, r.fleeSpeed ?? speed * 1.6);
      else if (e.groupId && e.groupSlot) idle(e, r, dt, world, motive);   // a herd member out of reach keeps to the herd
      else e.moving = false;
      return;
    }
    // Temperament (`rule.mind.aggressiveness`): a passive mind never engages; a defensive one only once it has been
    // hurt (its hp under the max it spawned with). Without `rule.mind` this never applies.
    const livePh = r.mind && e.mindPhase != null ? phasesOf(r.mind)[e.mindPhase] : null;
    const temper = r.mind && ((livePh && livePh.aggressiveness) || r.mind.aggressiveness);
    if (temper === 'passive' || (temper === 'defensive' && !(e.hpMax > 0 && e.body && e.body.hp < e.hpMax))) { e.reactionEnded = false; idle(e, r, dt, world, motive); return; }
    // SENTRY: a body that never moves (a tower, a turret). The nearest live, hittable body on the team `rule.foes`
    // (any team but its own, without one) inside `range` (else its weapon's, else 16) is turned to and fired on with its
    // weapon; with nothing in range it stands, holding its fire.
    if (motive === 'sentry') {
      e.moving = false;
      let best = null, bd = r.range ?? (e.weapon && e.weapon.range < 400 ? e.weapon.range : 16);
      for (const id in (world && world.byId) || {}) {
        const o = world.byId[id];
        if (o === e || o.isCamera || o.downed || o.gone || !(o.body && o.body.hittable)) continue;
        if (r.foes ? o.team !== r.foes : (e.team && o.team === e.team)) continue;
        const d = Math.hypot(o.transform.pos[0] - t.pos[0], o.transform.pos[1] - t.pos[1]);
        if (d < bd) { bd = d; best = o; }
      }
      if (!best) { e.aiFire = 0; e.sentryPull = false; return; }
      const q = best.transform.pos, rem = turnToward(t, Math.atan2(q[1] - t.pos[1], q[0] - t.pos[0]), r, dt);
      const tb = best.body || {}, tcz = tb.egg ? (Number.isFinite(tb.egg.cz) ? tb.egg.cz : tb.egg.c) : (tb.radius || 1);
      t.pitch = clamp(Math.atan2((q[2] + tcz) - (t.pos[2] + (e.weapon ? e.weapon.eye || 0 : 0)), bd || 1e-6), -1.2, 1.2);
      // on aim it works the trigger, pulled and let go on alternate frames (a semi weapon fires on the pull), its
      // cooldown the pace
      const onAim = !!e.weapon && Math.abs(rem) <= ((r.fireArc ?? 6) * Math.PI) / 180;
      e.sentryPull = onAim && !e.sentryPull;
      e.aiFire = e.sentryPull ? 1 : 0;
      return;
    }
    // NOTICE.
    const ward = motive === 'escort' ? wardOf(e, r, world) : null;
    let target = motive === 'frag' ? fragNotice(e, r, world) : pickTarget(e, world, r.target ?? (motive === 'escort' ? (e.team ? 'enemy' : 'all') : undefined), ward);
    // COVER: hurt or reloading, it takes cover (opt-in `rule.cover`) from the one it fights, seen or not (it knows where
    // the fire came from)
    if (r.cover && target && target !== e && takeCover(e, r, dt, world, target)) { e.reactionEnded = false; return; }
    const percept = r.mind && r.mind.perception;
    if (percept && target && target !== e && !perceive(e, r, target, world) && e.groupFocus !== target.id) {
      target = null;
      if (r.peek && peekStep(e, r, dt, world)) { e.reactionEnded = false; return; }
      if (percept === 'memory' && motive !== 'frag' && recall(e, r, dt, world)) { e.reactionEnded = false; return; }
    }
    // a match player that sees no one peeks where it last saw a foe before it goes looking
    if (!target && motive === 'frag' && r.peek && peekStep(e, r, dt, world)) { e.reactionEnded = false; return; }
    if (!target || target === e) { e.reactionEnded = false; idle(e, r, dt, world, motive); return; }
    // GUARD: it holds its post. A target farther than `guardRadius` (20) from the post is not its business: it goes
    // back to the post (LOST: return-to-post) and stands there (IDLE: post).
    if (motive === 'guard' || motive === 'escort') {
      const p = postOf(e, r, world);
      if (Math.hypot(target.transform.pos[0] - p[0], target.transform.pos[1] - p[1]) > (r.guardRadius ?? 20)) {
        e.reactionEnded = false; e.aiClock = dif && dif.reactDelay ? -dif.reactDelay : 0;   // disengaged, like any mind
        returnToPost(e, r, dt, world);
        return;
      }
    }
    // TERRITORIAL: an intruder inside `territory` (16) of home is WARNED first (it faces them, `locomotion: 'warn'`,
    // for `warnTime` 1.2 s), then attacked; outside the territory it is left alone and the mind idles.
    if (motive === 'territorial') {
      const home = homeOf(e, r), q = target.transform.pos;
      if (Math.hypot(q[0] - home[0], q[1] - home[1]) > (r.territory ?? 16)) { e.warnFor = null; e.reactionEnded = false; idle(e, r, dt, world, motive); return; }
      if (e.warnFor !== target.id) { e.warnFor = target.id; e.warnT = 0; }
      if (e.warnT < (r.warnTime ?? 1.2)) {
        e.warnT += dt; turnToward(t, Math.atan2(q[1] - t.pos[1], q[0] - t.pos[0]), r, dt);
        e.moving = false; e.locomotion = 'warn'; e.aiFire = 0; e.reactionEnded = false;
        return;
      }
      if (e.locomotion === 'warn') e.locomotion = 'forward';   // the warning is over: back to the fighting clips
    }
    if (e.adapt && e.adapt.foeId !== target.id) { e.adapt.foeId = target.id; e.adapt.foeHp = target.body ? target.body.hp : null; }
    // PATHING: no line to the target → walk the path round what is in the way, trigger cold
    if (navTo(e, r, dt, world, target.transform.pos, speed)) { e.reactionEnded = false; return; }
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
    const bench = e.adapt && e.adapt.benched;   // adapting: melee benched → guns only; ranged benched → the blade
    const meleeCfg = ((r.meleeSeek || bench === 'ranged') && bench !== 'melee' && lo && (e.strikeCdT || 0) <= 0 && !(e.meleeGiveUpT > 0))
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
    const meleeCommit = !!meleeCfg && !target.downed && !targetHigh && targetSafeMelee && (!e.groupId || e.groupToken)
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
      // (a slot not yet picked up, `held: false`, is not in its hands)
      const ranged = [];
      for (let i = 0; i < e.loadoutWeapons.length; i++) if (e.loadoutWeapons[i] && !lo[i].throw && (!e.loadoutHeld || e.loadoutHeld[i])) ranged.push(i);
      if (ranged.length) {
        let want;
        if (ranged.some((i) => Array.isArray(lo[i].band))) {
          // BANDS (opt-in, a slot's `band: [near, far]` metres, gameworld/weapon-roles.js): the gun for the range, not a
          // rotation. Of the held guns with rounds whose band holds the distance, the one whose SWEET SPOT (its slot's
          // `approach.standoff`, else its band's middle) is nearest it; the gun in hand is kept while the distance stays
          // within 2 m of its band, unless another in band is nearer its sweet spot by 2 m (a switch costs its ready time).
          const band = (i) => (Array.isArray(lo[i].band) ? lo[i].band : [0, Infinity]);
          const sweet = (i) => (lo[i].approach && Number.isFinite(lo[i].approach.standoff) ? lo[i].approach.standoff : (band(i)[0] + Math.min(band(i)[1], band(i)[0] + 40)) / 2);
          const dry = (i) => { const w = e.loadoutWeapons[i]; return w.ammo <= 0 && w.reserve === 0; };
          const off = (i) => { const [a, b] = band(i); return dist2d < a ? a - dist2d : dist2d > b ? dist2d - b : 0; };
          const fit = (i) => off(i) * 10 + Math.abs(dist2d - sweet(i));
          const cur = e.loadoutIdx || 0;
          if (ranged.includes(cur) && !dry(cur) && off(cur) <= 2 && !ranged.some((i) => i !== cur && !dry(i) && off(i) === 0 && fit(i) < fit(cur) - 2)) want = cur;
          else want = ranged.reduce((p, q) => ((dry(q) ? 1 : 0) < (dry(p) ? 1 : 0) || ((dry(q) ? 1 : 0) === (dry(p) ? 1 : 0) && fit(q) < fit(p) - 1e-9) ? q : p));
        } else {
          if (e.aiRangedPick == null) { const cur = ranged.indexOf(e.loadoutIdx || 0); e.aiRangedPick = cur >= 0 ? cur : 0; }
          if (ranged.length > 1) {
            e.aiWeaponT = (e.aiWeaponT || 0) + dt;
            if (e.aiWeaponT >= (r.weaponRotate ?? 6)) { e.aiWeaponT = 0; e.aiRangedPick = (e.aiRangedPick + 1) % ranged.length; }
          }
          want = ranged[e.aiRangedPick % ranged.length];
        }
        if (!e.weapon || (e.loadoutIdx || 0) !== want) {
          e.loadoutIdx = want; e.weapon = e.loadoutWeapons[want];
          if (e.body && lo[want].figure) e.body.figure = lo[want].figure;
          armSwitchReady(e, r, lo[want]);   // hold fire for the ready-time (a slot's switchReady wins)
        }
      }
    }
    // aim: turn toward the target, pitch at its egg centre. A travelling round (a lob: a launcher, a grenade) is LED: aimed
    // where the target will be when it gets there, its flight time ahead along the target's pace (its steps, smoothed;
    // a jump of more than 5 m in a frame, a respawn, starts it over). A hitscan round needs no lead.
    const w = e.weapon;
    let ax = dx, ay = dy;
    if (w && w.fireClass === 'lob' && w.projectileSpeed > 0 && !r.space) {
      const q = target.transform.pos, lp = e.leadPrev;
      if (lp && lp.id === target.id && dt > 0 && Math.hypot(q[0] - lp.at[0], q[1] - lp.at[1]) < 5) {
        const vx = (q[0] - lp.at[0]) / dt, vy = (q[1] - lp.at[1]) / dt, v = e.leadVel || [vx, vy];
        e.leadVel = [v[0] * 0.7 + vx * 0.3, v[1] * 0.7 + vy * 0.3];
      } else e.leadVel = null;
      e.leadPrev = { id: target.id, at: [q[0], q[1]] };
      if (e.leadVel) { const tf = dist2d / w.projectileSpeed; ax = dx + e.leadVel[0] * tf; ay = dy + e.leadVel[1] * tf; }
    }
    const rem = turnToward(t, Math.atan2(ay, ax), r, dt);
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
    // `approach:{style,standoff,close,weave}` wins, else the rule's own (a commander's posture); the tuning's
    // aggressiveness scales it.
    const aSlot = lo ? lo[e.loadoutIdx || 0] : null;
    const aOv = (aSlot && aSlot.approach) || r.approach || null;
    const aProf = SPACING[spacingOf(w, aOv)] || [1.0, 0.7, 1.0];
    // a body that holds only blades (a predator's bite) has nothing to shoot from range: it closes to its reach
    const bladeOnly = !w && !!lo && lo.length > 0 && lo.every((c) => !c || c.strike === 'melee');
    const bladeReach = bladeOnly ? ((lo.find((c) => c && c.strike === 'melee') || {}).strikeReach ?? r.strikeReach ?? speed) : 0;
    const baseStandoff = r.standoff != null ? r.standoff : (w ? (w.range || 400) * 0.42 : bladeOnly ? bladeReach * 0.8 : speed * 8);
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
        e.lungeTo = target.id;          // a lunge carries in toward this body and stops short of it
        e.meleeCommitT = 0;             // a swing landed the commit: restart the give-up clock for the next approach
      }
    } else if (e.groupId && e.groupSlot && !isSpace && !(e.groupToken && bladeOnly)) {
      // GROUP: hold the slot the plan gives it (facing the target, firing if it can), kept apart from its mates; a
      // blade holding an attack token leaves its slot to press in
      const gx = e.groupSlot[0] - t.pos[0], gy = e.groupSlot[1] - t.pos[1], gd = Math.hypot(gx, gy);
      const sp = e.groupSpacing ?? 3;
      let sx = 0, sy = 0;
      if (world && world.byId) {
        for (const id in world.byId) {
          const o = world.byId[id];
          if (o === e || o.groupId !== e.groupId) continue;
          const ox = t.pos[0] - o.transform.pos[0], oy = t.pos[1] - o.transform.pos[1], od = Math.hypot(ox, oy);
          if (od > 1e-6 && od < sp) { sx += (ox / od) * (sp - od) / sp; sy += (oy / od) * (sp - od) / sp; }
        }
      }
      if (gd > 0.6 || sx || sy) {
        const mx = (gd > 0.6 ? gx / gd : 0) + sx * 1.5, my = (gd > 0.6 ? gy / gd : 0) + sy * 1.5, mn = Math.hypot(mx, my) || 1;
        const step = Math.min(speed * dt, gd + 0.5);
        t.pos[0] += (mx / mn) * step; t.pos[1] += (my / mn) * step; moveMag = step; clip = 'forward';
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
      // a peek holds its spot while it fights from it (it does not walk out of the edge it peeked)
      const holding = r.peek && e.peek && ((world && world.time) || 0) - e.peek.t < ((r.peek && r.peek.hold) || 2.5);
      if (dist2d > standoff && facing && !holding) moveF = speed * dt;
      // KEEP RANGE (opt-in `rule.keepRange`): carrying a gun that wants distance (a held slot whose band starts 12 m or
      // more out, with rounds: the long gun), closer than its band it backs off, still fighting with the gun for the
      // range, until it is there and the gun for the range is that one. Backed into a wall (under half a metre in a
      // second) it gives it up for 3 s.
      if (r.keepRange && lo && e.loadoutWeapons && facing && !holding) {
        if (e.backOffT > 0) e.backOffT -= dt;
        const need = rangeNeed(e, lo);
        if (need && dist2d < need && !(e.backOffT > 0)) {
          const B = e.backing || (e.backing = { from: [t.pos[0], t.pos[1]], t: 0 });
          B.t += dt;
          if (B.t >= 1) { if (Math.hypot(t.pos[0] - B.from[0], t.pos[1] - B.from[1]) < 0.5) e.backOffT = 3; e.backing = null; }
          moveF = -speed * 0.8 * dt;
        } else e.backing = null;
      }
      if (moveF) { t.pos[0] += f2[0] * moveF; t.pos[1] += f2[1] * moveF; }
      moveMag = Math.abs(moveF);
      if (moveF < 0) e.backStep = true;   // the walk clip run backwards (gait.js wraps a negative phase)
      // FRAG: it strafes as it shoots, side to side on its juke clock; not with a slot that `plant`s (a gun a run throws
      // wide: it stands to shoot)
      const planted = !!(aSlot && aSlot.plant);
      if (motive === 'frag' && facing && w && (r.strafe ?? 0.6) > 0 && !holding && !planted) {
        const side = nextJuke(e, r, dt), ss = speed * (r.strafe ?? 0.6) * dt;
        t.pos[0] += rt2[0] * side * ss; t.pos[1] += rt2[1] * side * ss;
        moveMag = Math.max(moveMag, ss);
      }
    }
    if (!isSpace && world && world.colliders) block(t, r, eye, world);
    if (!isSpace) standOnGround(t, r, eye, world);
    if (moveMag > 0) { e.locomotion = clip; e.gaitPhase = (e.gaitPhase || 0) + (e.backStep ? -moveMag : moveMag) / strideLen; e.moving = true; }
    else e.moving = false;
    e.backStep = false;

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
    // a gun in hand (`weapon.hand`) fires from its muzzle, at the target's chest: what clears the edge is the gun
    const tchest = w && w.hand ? [target.transform.pos[0], target.transform.pos[1], target.transform.pos[2] + tcz] : null;
    const engaged = !!w && onAim && rangeD <= (w.range || 400)
      && !(tchest ? sightBlocked(muzzleAt(e, w), tchest, world && world.colliders) : sightBlocked(origin, target.transform.pos, world && world.colliders))
      && !(r.clearLine && e.team && allyOnLine(e, origin, target, world));
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
  // ── KIT (opt-in `rule.kit`): what a stylized shooter's mind does with its body and its abilities, after it decides
  // each frame. All on the world clock, no dice:
  //   hop       (true | a jump speed) under fire (hit in the last second), a jump, `hopEvery` (1.4) s apart
  //   dash      ({ cooldown }) a fresh hit rolls it off the line, square to whoever shot it (no invincibility: a dash
  //             is a move, not a shield)
  //   heal      ({ amount, cooldown, below }) under `below` (0.4) of its hp, `amount` back
  //   ultimate  ({ per, for }) charged `per` (to 100) by every hit it lands (combat-ranged.js), spent on a foe it sees:
  //             overdrive (its rounds hit harder) for `for` s, and its hp full
  const KIT_GRAVITY = 20;
  function kitStep(e, r, dt, world) {
    const K = r.kit, t = e.transform, now = (world && world.time) || 0;
    if (e.downed || e.gone) { e.hopZ = 0; e.hopVz = 0; return; }
    const fresh = (e.hits || 0) > (e.kitHits || 0);
    if (fresh) { e.kitHits = e.hits; e.kitHitT = now; }
    const underFire = e.kitHitT != null && now - e.kitHitT < 1;
    for (const k of ['kitHopCd', 'kitDashCd', 'kitHealCd']) if (e[k] > 0) e[k] = Math.max(0, e[k] - dt);
    if (K.dash && fresh && !(e.kitDashCd > 0) && e.dodgeT == null) {
      const by = e.lastHitBy && world.byId && world.byId[e.lastHitBy], from = by ? by.transform.pos : null;
      const away = from ? Math.atan2(t.pos[1] - from[1], t.pos[0] - from[0]) : t.heading, side = (e.kitDashes || 0) % 2 ? 1 : -1;
      rollOff(e, r, null, [Math.cos(away + side * Math.PI / 2), Math.sin(away + side * Math.PI / 2)], rightXY(t.heading));
      e.dodgeSpent = true; e.kitDashCd = (K.dash && K.dash.cooldown) || 3; e.kitDashes = (e.kitDashes || 0) + 1;
    }
    if (K.heal && e.body && Number.isFinite(e.body.hp) && e.hpMax > 0 && !(e.kitHealCd > 0) && e.body.hp < (K.heal.below ?? 0.4) * e.hpMax) {
      e.body.hp = Math.min(e.hpMax, e.body.hp + (K.heal.amount ?? 50)); e.kitHealCd = K.heal.cooldown ?? 10; e.kitHeals = (e.kitHeals || 0) + 1;
    }
    if (K.ultimate && (e.kitCharge || 0) >= 100 && e.fragTarget) {
      (e.statuses || (e.statuses = {})).overdrive = { t0: now, until: now + (K.ultimate.for ?? 6) };
      e.kitCharge = 0; e.kitUlts = (e.kitUlts || 0) + 1;
      if (e.hpMax > 0 && e.body) e.body.hp = e.hpMax;
    }
    // the hop: a jump off the ground it stands on, its height kept over the ground under it (the height it added last
    // frame taken off first, so it never stacks, ground or no ground)
    if (K.hop) {
      if (e.hopApplied) { t.pos[2] -= e.hopApplied; e.hopApplied = 0; }
      if (!(e.hopZ > 0) && underFire && !(e.kitHopCd > 0) && e.dodgeT == null) { e.hopVz = K.hop === true ? 6.5 : K.hop; e.hopZ = 1e-3; e.kitHopCd = r.hopEvery ?? 1.4; e.kitHops = (e.kitHops || 0) + 1; }
      if (e.hopZ > 0) {
        e.hopZ += e.hopVz * dt; e.hopVz -= KIT_GRAVITY * dt;
        if (e.hopZ <= 0) { e.hopZ = 0; e.hopVz = 0; }
        standOnGround(t, r, r.eye ?? 0, world);
        t.pos[2] += e.hopZ; e.hopApplied = e.hopZ;
        // the mind aimed from the ground: aim again from where the hop has it (its foe's egg centre)
        const tg = e.fragTarget && world.byId ? world.byId[e.fragTarget] : null;
        if (tg && e.weapon) {
          const q = tg.transform.pos, tb = tg.body || {}, cz = tb.egg ? (Number.isFinite(tb.egg.cz) ? tb.egg.cz : tb.egg.c) : (tb.radius || 0);
          t.pitch = clamp(Math.atan2((q[2] + cz) - (t.pos[2] + (e.weapon.eye || 0)), Math.hypot(q[0] - t.pos[0], q[1] - t.pos[1]) || 1e-6), -1.2, 1.2);
        }
      }
    }
  }
  function aiWithKit(e, input, dt, world) {
    ai(e, input, dt, world);
    if (e.rule && e.rule.kit) kitStep(e, e.rule, dt, world);
  }
  Object.assign(RULES, { ai: aiWithKit });

  // AI ATTACK TOGGLE: the G press edge flips the world switch every mind gates on.
  registerPreStep('ai-toggle', (state, input) => {
    if (input.aiToggle) state.aiEnabled = state.aiEnabled === false;
  }, 20);
  // the class tier (createWorld): seed state.aiTuning from spec.aiDifficulty
  registerStateInit((state, spec) => {
    state.aiTuning = AI_DIFFICULTY[spec.aiDifficulty] || null;
  });

  Object.assign(E, { AI_DIFFICULTY, MIND_SKILL, MIND_AGGRESSIVENESS, mindTuning: tuningOf, mindPickTarget: pickTarget, mindThreatOf: threatOf, mindPeekSpot: peekSpot });
}
