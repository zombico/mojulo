/**
 * combat-match.js — the MATCH layer + spawn lifecycle (controllable-split.plan.md, S2). The
 * opt-in scored bout (spec.match): kill attribution + feed, the corpse window, respawns at the
 * farthest declared spawn, team mode, practice (noDestroy), the score-screen stats row
 * (matchStat), spawn protection (drop-in + fire-gated guard), the drop descent (stepDrop), and
 * the death burst (explodeUnit — every downed unit's blast, wreck finisher included).
 *
 * Registers a STATE INIT (registerStateInit): builds state.match + state.wreckExplodes from the
 * spec at createWorld time — a matchless world stays byte-identical (state.match null). The
 * layer is SELF-QUARANTINING at step time (stepMatch): a scoring bug disables scoring for the
 * session, never the sim.
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; combat-hit precedes this in
 * EMISSION (armReaction / absorbShield / boostStunFactor / pointInEgg destructured at build
 * time); cancelWeaponCharge lives in combat-ranged (LATER in EMISSION) and is reached late-bound
 * via E.* at respawn time. Field ownership: state.match/wreckExplodes, e.deadAt/gone/settledAt/
 * deathBurstDone, e.dropping/dropTargetZ/dropSpeed, e.spawnGuard/spawnGuardT.
 */

export function buildCombatMatch(E) {
  const {
    vcopy, sub, pointInEgg, absorbShield, boostStunFactor, armReaction, registerStateInit,
    readInput, registerPreStep, registerBodyOwner, registerEntityAssert, registerWorldPass,
  } = E;

  // matchStat(state, id) — the contender's score-screen accumulator row ({ deaths, dmg, shots,
  // hits }), or null when the world runs no match layer / the id is not enrolled. Guarded at
  // every adjudication site so a matchless world stays byte-identical in behavior.
  function matchStat(state, id) {
    const m = state.match;
    return m && !m.dead && m.stats && m.stats[id] ? m.stats[id] : null;
  }

  // applySpawnProtect(e, m) — arm a fresh spawn (R24): the DROP-IN (lift into the sky, fall under
  // stepDrop, control back on landing — ground only) + the spawn INVINCIBILITY. When `m.fireGuard`
  // the protection is FIRE-GATED (invincible until the suit shoots, cleared in stepWeapon / on a
  // melee swing); else it falls back to the time-based `iFrames` wake-guard. Called at match start
  // (createWorld) and on every respawn.
  function applySpawnProtect(e, m) {
    if (!m) return;
    const t = e.transform;
    const r = e.pilotRule || e.rule || {};
    const isSpace = !!r.space;
    if (m.dropHeight > 0 && !isSpace) {
      e.dropTargetZ = t.pos[2];                 // the current pos IS the resting spawn point
      t.pos[2] = e.dropTargetZ + m.dropHeight;  // lift into the sky; stepDrop falls it back
      e.vel = [0, 0, 0];
      e.dropping = true; e.grounded = false;
      e.dropSpeed = m.dropSpeed > 0 ? m.dropSpeed : Math.max(1, m.dropHeight) * 0.6;   // ~1.7s default
      e.locomotion = 'leap'; e.moving = true; e.thrust = 1; e.gaitPhase = 0;
    } else {
      e.dropping = false;
    }
    if (m.fireGuard) { e.spawnGuard = true; e.invincible = true; e.spawnGuardT = m.fireGuardMax ?? 5; }   // R26: armed with the anti-camp cap
    else if (m.iFrames > 0) { e.wakeGuardT = m.iFrames; e.invincible = true; }
  }

  // stepDrop(e, dt) — the SPAWN DROP-IN descent (R24). While `e.dropping`, the suit falls straight
  // down toward `e.dropTargetZ` at `e.dropSpeed`, posed in the airborne `leap` with thrusters lit,
  // its rule + weapon SUPPRESSED (no control mid-air). On the frame it lands it clears `dropping` and
  // returns false, so the rule runs that same frame — control is back "as soon as it hits ground".
  // Invincibility (spawnGuard) rides through the drop and past the landing until the first shot.
  function stepDrop(e, dt, world) {
    if (!e.dropping) return false;
    const t = e.transform;
    const target = Number.isFinite(e.dropTargetZ) ? e.dropTargetZ : 0;
    t.pos[2] = Math.max(target, t.pos[2] - (e.dropSpeed || 0) * dt);
    e.grounded = false; e.locomotion = 'leap'; e.moving = true; e.thrust = 1; e.gaitPhase = 0; e.vel = [0, 0, 0];
    if (t.pos[2] <= target + 1e-6) {
      // Land on the ACTUAL surface under the feet via the live ground raycast, not the precomputed
      // dropTargetZ. The target is a mint-time point sample that rarely equals the wavy drape, so trusting
      // it lands the suit a few units ABOVE the real surface — then the rule free-falls that gap, which at
      // a low framerate can tunnel (see the platform touchdown sweep). Probing the live ground here lands
      // the suit truly grounded, flush on the surface, every drop. No hook / a void → keep the raw target.
      const eye = (e.pilotRule || e.rule || {}).eye ?? 0;
      const step = (e.rule && Number.isFinite(e.rule.step)) ? e.rule.step : 0.35;
      const gz = world && world.ground ? world.ground([t.pos[0], t.pos[1], target + step]) : null;
      t.pos[2] = gz != null ? gz + eye : target;
      e.dropping = false; e.grounded = true;
      e.locomotion = 'forward'; e.moving = false; e.thrust = 0;
      return false;   // landed this frame → the rule runs, control returns
    }
    return true;       // still falling → suppress the rule
  }

  // respawnEntity(e, state) — a fresh life in a MATCH world: full hp/poise/ammo/gauge/shield, spawn
  // protection riding the existing wake-guard machinery, all volatile maneuver state cleared. The
  // spawn point is the declared spawn FARTHEST from any living contender (deterministic; ties break
  // by index) so nobody respawns into the muzzle that just killed them; no declared spawns → the
  // entity's authored start pose.
  function respawnEntity(e, state) {
    const m = state.match;
    let at = e.spawn ? e.spawn.pos : e.transform.pos;
    const heading = e.spawn ? e.spawn.heading : e.transform.heading;
    if (m.spawns) {
      let best = -1, bestD = -1;
      for (let i = 0; i < m.spawns.length; i++) {
        const s = m.spawns[i];
        let dmin = Infinity;
        for (const o of state.entities) {
          if (o === e || o.isCamera || o.downed || !(o.body && o.body.hittable)) continue;
          const dx = o.transform.pos[0] - s[0], dy = o.transform.pos[1] - s[1];
          const d = dx * dx + dy * dy;
          if (d < dmin) dmin = d;
        }
        if (dmin > bestD) { bestD = dmin; best = i; }
      }
      if (best >= 0) at = m.spawns[best];
    }
    e.transform.pos = [at[0], at[1], at[2] || 0];
    e.transform.heading = heading; e.transform.pitch = 0;
    e.vel = [0, 0, 0];
    if (Number.isFinite(e.hpMax)) e.body.hp = e.hpMax;
    if (Number.isFinite(e.poiseMax)) e.poise = e.poiseMax;
    e.body.hittable = true;                // the corpse window (stepMatch) made it untargetable
    e.staggerT = null; e.downPauseT = null; e.downed = false; e.deadAt = null; e.lastHitBy = null; e.reactionEnded = false; e.deathBurstDone = false;
    e.gone = false; e.settledAt = null;    // wreck finisher: clear the vanish so the respawned body renders + retargets again
    e.locomotion = 'forward'; e.moving = false; e.gaitPhase = 0;
    e.swingT = null; e.dodgeT = null; e.tumble = null; e.dashVel = null;
    e.comboT = 0; e.swingCombo = false; e.strikeCdT = 0; e.readyT = 0; e.aiFire = 0;
    e.boostCut = false; e.boosting = false; e.hovering = false; e.spawnGuard = false; e.dropping = false;
    // full kit: every carried magazine refilled, cooldowns cold, the shield reforged (a new life
    // gets the whole loadout — the no-regen shield rule is per-life, not per-match).
    const rearm = (w) => { if (w) { w.ammo = w.magazine; w.cooldownT = 0; w.reloading = false; w.reloadT = 0; w.burstLeft = 0; E.cancelWeaponCharge(w); if (w.energyMax > 0) { w.energy = w.energyMax; w.energyLock = false; } } };
    if (e.loadoutWeapons) e.loadoutWeapons.forEach(rearm); else rearm(e.weapon);
    if (Number.isFinite(e.shieldMax)) { e.shieldHp = e.shieldMax; e.shieldBroken = false; }
    const bm = (e.pilotRule && e.pilotRule.boostMax) || (e.rule && e.rule.boostMax);
    if (Number.isFinite(bm) && bm > 0) { e.boost = bm; e.boostLock = false; }   // a fresh life's full bar = boost + dodge ready
    applySpawnProtect(e, m);   // R24: drop-in from the sky (ground) + fire-gated / timed spawn protection
  }

  // stepMatch(state) — the MATCH layer (opt-in `spec.match`): scan for entities that FELL this
  // frame (downed edge), credit the kill to the last hitter (feed line kept short for the HUD),
  // open the corpse window (unhittable while down — no farming the wreck), end the match when a
  // contender reaches killTarget, and respawn the fallen after respawnDelay while the match runs.
  // Runs after all of the frame's damage adjudication (rules + weapons + melee + projectiles).
  //
  // SELF-QUARANTINE (fault containment): the match layer is ADDITIVE game logic over the sim —
  // if it ever throws, the error is reported ONCE and the layer disables itself for the session
  // (state.match.dead), so a scoring bug degrades to "the bout stops being scored" while the
  // world keeps stepping. The core sim stays loud; only this opt-in layer eats its own faults.
  function stepMatch(state) {
    try { stepMatchInner(state); } catch (err) {
      if (state.match && !state.match.dead) { state.match.dead = true; console.error('match layer disabled after error:', err); }
    }
  }
  function stepMatchInner(state) {
    const m = state.match;
    if (!m || m.dead) return;
    for (const e of state.entities) {
      if (e.isCamera || m.kills[e.id] == null) continue;   // contenders only
      if (e.downed && e.deadAt == null) {
        e.deadAt = state.time;
        e.body.hittable = false;   // the corpse window: a wreck takes no further hits
        if (m.stats && m.stats[e.id]) m.stats[e.id].deaths += 1;   // score screen: the fall is counted even when unattributed
        const killer = e.lastHitBy && e.lastHitBy !== e.id ? e.lastHitBy : null;
        if (killer != null) {
          m.kills[killer] = (m.kills[killer] || 0) + 1;
          m.feed.push({ killer, victim: e.id, t: state.time });
          if (m.feed.length > 6) m.feed.shift();
          if (m.teamMode) {
            // TEAM win: credit the killer's team (friendly fire is off, so every credited kill is an
            // enemy kill), first team to killTarget takes the bout. `winner` still holds the finishing
            // pilot for the kill-feed; `winnerTeam` is the victor the banner/score screen read.
            const kt = m.teamOf[killer];
            if (kt) {
              m.teamKills[kt] = (m.teamKills[kt] || 0) + 1;
              if (!m.over && m.teamKills[kt] >= m.killTarget) { m.over = true; m.winner = killer; m.winnerTeam = kt; m.endedAt = state.time; }
            }
          } else if (!m.over && m.kills[killer] >= m.killTarget) { m.over = true; m.winner = killer; m.endedAt = state.time; }
        }
      }
      if (!m.over && e.deadAt != null && state.time - e.deadAt >= m.respawnDelay) respawnEntity(e, state);
    }
  }

  // DEATH BURST (R34): the frame a unit goes DOWN it EXPLODES. NO damage — the wreck is the loss
  // already, and a damaging blast would chain kills — but an UNCONDITIONAL bazooka-class splash
  // STAGGER (radius 0.54 x the dying unit's own height, +15% over the old 0.47: a bigger suit
  // makes a bigger blast, all of them bazooka-family). Same semantics as a shell splash: the egg
  // inclusion test, a frontal shield eats the concussion (R19), boost armor halves it (R23).
  // Deliberately NO attribution (no hitFlash / lastHitBy / match stats — nobody fired it), the
  // WRECKS are excluded (no re-toppling a downed frame), and the killer eats it too if they were
  // standing over the kill — the point-blank melee execution has a cost. The bursts record rides
  // the same channel as a shell burst, so the renderer's fireball (and the R31 smoke cloud, where
  // the world opts in) come for free.
  function explodeUnit(state, e) {
    const egg = e.body && e.body.egg;
    const hgt = egg ? (Number.isFinite(egg.cz) ? egg.cz : egg.c) + egg.c : 24;
    const R = Math.round(hgt * 0.54 * 10) / 10;   // +15% suit-explosion splash (was 0.47)
    const cz = egg ? (Number.isFinite(egg.cz) ? egg.cz : egg.c) : hgt * 0.5;
    const pos = [e.transform.pos[0], e.transform.pos[1], e.transform.pos[2] + cz];
    for (const tg of state.entities) {
      if (tg === e || tg.downed || tg.invincible || !(tg.body && tg.body.hittable)) continue;
      if (tg.body.egg) { if (!pointInEgg(pos, tg, R)) continue; }
      else { const v = sub(tg.transform.pos, pos); if (Math.hypot(v[0], v[1], v[2]) > R + (tg.body.radius || 0.5)) continue; }
      if (absorbShield(tg, pos, 0, state)) continue;   // a frontal shield eats the concussion (no damage to drain)
      const f = boostStunFactor(tg);
      if (f >= 1 || !(Number.isFinite(tg.poise) && tg.staggerT == null)) {
        armReaction(tg, 'stagger');
      } else {
        tg.poise -= tg.poiseMax * f;
        if (tg.poise <= 0) armReaction(tg, 'stagger');
      }
    }
    // the SPECTACLE outsizes the shove (operator): fxRadius drives the fireball + smoke at 2x the
    // stagger radius — the blast is adjudicated the same frame it spawns, so the bigger shell is
    // pure theater and never overstates a dodgeable circle. `radius` stays the honest mechanic.
    state.bursts.push({ seq: state.burstSeq++, pos, t: state.time, radius: R, fxRadius: Math.round(R * 2 * 10) / 10, fxColor: 0xffa03c, fxScale: Math.round(hgt * 0.85 * 10) / 10 });
  }

  // the createWorld STATE INIT — verbatim from the pre-split inline block: build the bout (or
  // null), arm the opening drop-in/fire-guard, and parse the wreck finisher.
  registerStateInit((state, spec) => {
    const entities = state.entities;
    // MATCH (opt-in `spec.match`, mobile-suit-arena.plan.md M1): the world becomes a scored bout —
    // kills are credited (lastHitBy attribution), the fallen RESPAWN, and the first CONTENDER to
    // `killTarget` ends it. A contender is any hittable entity with hp + poise (it can die AND be
    // credited); worlds without `match` keep death-is-final, byte-identical.
    let match = null;
    if (spec.match && typeof spec.match === 'object') {
      match = {
        // PRACTICE (opt-in): a bout that never ends and never destroys — every contender gets
        // `noDestroy` below, so a killing blow topples the suit and refills its bar instead of
        // downing it (armReaction / beginTackleCounter). Kills never credit, m.over never sets.
        practice: !!spec.match.practice,
        killTarget: Math.max(1, Math.round(spec.match.killTarget ?? 5)),
        respawnDelay: Number.isFinite(spec.match.respawnDelay) ? spec.match.respawnDelay : 3,
        iFrames: Number.isFinite(spec.match.iFrames) ? spec.match.iFrames : 2,   // spawn protection (sec) — time-based, superseded by fireGuard
        // SPAWN DROP-IN (R24, opt-in): units fall from the sky onto their spawn instead of popping in.
        // `dropHeight` = units above the spawn point to lift them; `dropSpeed` = descent u/s. Ground
        // only (a space spawn has no ground to hit → instant). Control is suppressed until the suit
        // lands; the drop pose is `leap` with the thrusters lit.
        dropHeight: Number.isFinite(spec.match.dropHeight) ? Math.max(0, spec.match.dropHeight) : 0,
        dropSpeed: Number.isFinite(spec.match.dropSpeed) && spec.match.dropSpeed > 0 ? spec.match.dropSpeed : 0,
        // FIRE-GATED SPAWN GUARD (R24, opt-in): the fresh suit is INVINCIBLE from spawn (through the
        // drop and after landing) until it FIRES its weapon — then protection drops. Replaces the
        // time-based `iFrames` when set. Works in space too (no drop, but the fire-gated shield holds).
        fireGuard: !!spec.match.fireGuard,
        // R26: the fire-guard is also CAPPED (anti-camp) — if the fresh suit never shoots, the shield
        // still expires after `fireGuardMax` sec (default 5). The cap counts down only once the suit can
        // ACT (not while it's still dropping in), so the drop never eats the usable protection window.
        fireGuardMax: Number.isFinite(spec.match.fireGuardMax) && spec.match.fireGuardMax > 0 ? spec.match.fireGuardMax : 5,
        spawns: Array.isArray(spec.match.spawns) && spec.match.spawns.length ? spec.match.spawns.map((s) => vcopy(s)) : null,
        names: spec.match.names && typeof spec.match.names === 'object' ? { ...spec.match.names } : null,   // id → display name (HUD)
        teamNames: spec.match.teamNames && typeof spec.match.teamNames === 'object' ? { ...spec.match.teamNames } : null,   // team id → display name (HUD banner)
        kills: {}, stats: {}, feed: [], over: false, winner: null, endedAt: 0,
        // TEAM MODE (derived below, never counted): set when the contenders span ≥2 teams.
        teamMode: false, teamOf: null, teamKills: null, winnerTeam: null,
      };
      for (const e of entities) {
        if (!e.isCamera && e.body && e.body.hittable && Number.isFinite(e.hpMax) && Number.isFinite(e.poiseMax)) {
          match.kills[e.id] = 0;
          // the SCORE-SCREEN row (deaths / hull damage dealt / ranged rounds fired / rounds on
          // target) — accumulated at the adjudication sites, reported once in the outcome envelope.
          match.stats[e.id] = { deaths: 0, dmg: 0, shots: 0, hits: 0 };
        }
      }
      // TEAM MODE: if the contenders span two-or-more `team` tags, the bout is won by TEAM — a kill
      // credits the killer's team and the first TEAM to killTarget ends it (stepMatchInner). One team
      // (or none) keeps the per-individual win, byte-identical. Derived from the tags, never counted.
      // PRACTICE: mark every contender indestructible — the flag rides the entity because the
      // adjudication sites (armReaction, beginTackleCounter) don't receive world state.
      if (match.practice) { for (const e of entities) if (!e.isCamera && match.kills[e.id] != null) e.noDestroy = true; }
      const teamSet = new Set();
      for (const e of entities) { if (!e.isCamera && match.kills[e.id] != null && e.team) teamSet.add(e.team); }
      if (teamSet.size >= 2) {
        match.teamMode = true;
        match.teamOf = {};
        match.teamKills = {};
        for (const tm of teamSet) match.teamKills[tm] = 0;
        for (const e of entities) { if (!e.isCamera && match.kills[e.id] != null && e.team) match.teamOf[e.id] = e.team; }
      }
    }
    // SPAWN DROP-IN / FIRE-GUARD at match start: lift every contender into the sky (ground) and arm
    // the fire-gated invincibility, so the bout OPENS with everyone dropping in (respawns reuse the
    // same helper). Applied here so createWorld's returned state is already mid-drop on frame 0.
    if (match && (match.dropHeight > 0 || match.fireGuard)) {
      for (const e of entities) if (!e.isCamera && match.kills[e.id] != null) applySpawnProtect(e, match);
    }
    // WRECK FINISHER (opt-in `spec.wreckExplodes`): the death burst is DEFERRED until the topple
    // FALL settles (+ a `delay` linger), then the wreck DETONATES and VANISHES — the finisher reads
    // fall → boom → gone, instead of the default instant blast that leaves the wreck lying where it
    // fell. In a NON-MATCH world the vanish is terminal (death is final). In a MATCH world it rides
    // ALONGSIDE the corpse-window → respawn lifecycle: the kill still credits at the downed edge
    // (stepMatch, unchanged), the fall + linger + blast play out during the corpse window, the wreck
    // vanishes, and respawnEntity then clears `gone` and returns the suit — so an arena death reads
    // topple → detonate → gone → respawn (tune `delay` under the match's respawnDelay).
    const wreckExplodes = spec.wreckExplodes
      ? { delay: Number.isFinite(spec.wreckExplodes.delay) ? Math.max(0, spec.wreckExplodes.delay) : 0.5 }
      : null;
    state.match = match;
    state.wreckExplodes = wreckExplodes;
  });

  // MATCH OVER: the bout is decided — controls go dead and the ai stands down, so the world
  // settles into the result tableau instead of fighting on. Deterministic: a zeroed input is
  // just another input.
  registerPreStep('match-over-zero', (state) => (state.match && state.match.over ? readInput(null) : null), 10);
  // SPAWN DROP-IN (R24): falling from the sky suppresses control until it lands.
  registerBodyOwner('drop', (e, input, dt, state, world) => stepDrop(e, dt, world), 40);
  // fire-gated spawn protection holds until the suit shoots (cleared on fire, in stepWeapon).
  registerEntityAssert('spawn-guard', (e, dt, owns) => {
    if (e.spawnGuard) {
      e.invincible = true;
      // R26: capped — decay only once it can act (not mid-drop), so an un-fired shield still expires.
      if (!owns.drop) { e.spawnGuardT -= dt; if (e.spawnGuardT <= 0) { e.spawnGuard = false; e.invincible = false; } }
    }
  }, 20);
  // DEATH BURST (R34): a downed unit explodes — after every damage adjudicator has run, before
  // the match layer credits the kill. Edge-latched per death; the match respawn clears the latch
  // with `downed`, so every life ends in its own blast. DEFAULT: instant on the downed edge (the
  // wreck then lies where it fell). WRECK FINISHER (`state.wreckExplodes`): the blast is HELD until
  // the topple FALL has settled (the wreck lies flat) + a `delay` linger, then it detonates AND the
  // wreck VANISHES (`gone` — hidden by the renderer, untargetable in the sim; a match respawn later
  // clears `gone`). The kill still credits at the downed edge (stepMatch), so deferring is visual.
  registerWorldPass('death-burst', (state) => {
    const wreckFin = state.wreckExplodes;
    for (const e of state.entities) {
      if (e.gone || !e.downed || e.deathBurstDone) continue;
      if (wreckFin) {
        if (!(e.reactClip === 'topple' && e.staggerT >= 1)) continue;   // topple fall not settled yet
        if (e.settledAt == null) e.settledAt = state.time;
        if (state.time - e.settledAt < wreckFin.delay) continue;        // lingering before the blow
      }
      e.deathBurstDone = true;
      explodeUnit(state, e);
      if (wreckFin) { e.gone = true; if (e.body) e.body.hittable = false; }   // removed the frame it detonates
    }
  }, 40);
  registerWorldPass('match', (state) => stepMatch(state), 50);   // after ALL damage adjudication this frame

  Object.assign(E, { matchStat, applySpawnProtect, stepDrop, respawnEntity, stepMatch, explodeUnit });
}
