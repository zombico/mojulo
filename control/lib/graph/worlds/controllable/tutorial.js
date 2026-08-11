/**
 * tutorial.js — the TUTORIAL DIRECTOR + its two teaching affordances (tutorial-mode.plan.md, T1).
 * The opt-in scripted layer (spec.tutorial): an ordered list of steps, each a prompt + a goal the
 * player must perform ("hold F to boost", "land the 2-hit combo"). The director OBSERVES the sim
 * by edge-detecting entity state each frame — it adds no emissions to the combat systems and a
 * world without `tutorial` steps byte-identically (state.tutorial null). The channel renders the
 * active prompt (objective HUD) and, when the script completes, emits the one outcome envelope —
 * the director is the level TERMINAL the way the match layer is for scored bouts.
 *
 * Also here, because only teaching levels want them (both opt-in, both inert absent):
 *   • the `patrol` rule — the passive walker: a deterministic waypoint march that never targets
 *     and never fires, but stays hittable/staggerable/downable (the practice dummy).
 *   • DORMANT seats (`dormant: true` on an entity) — minted into the roster but absent from play
 *     (hidden, unhittable, rule suppressed) until a step's `activate` wakes them: the deterministic
 *     mid-level reinforcement (no runtime spawn system; the roster stays fixed at build).
 *
 * STEP SHAPE (normalized at state init):
 *   { id, prompt, goal: { fact, count?, of?, dir?, slot? }, activate?: [ids], heal?: [ids|'pilot'],
 *     set?: { aiDifficulty }, optional?: true }
 * Steps advance strictly in order; `activate`/`heal`/`set` run once on step ENTRY (`heal` restores a
 * body to full hull + shield — the between-phases repair). An `optional` step is a BONUS phase: the
 * script's clear is already earned when it enters, so the pilot going down during it ends the level
 * with SUCCESS, not fail — the step merely confirms (win the bonus, or go down swinging). FACTS
 * (all edge-detected off live entity state, pilot-owned unless `of` names another entity;
 * `of:'*'` = any non-pilot, `of:[ids]` = a named set — e.g. destroy all three raiders):
 *   move (planar units traveled) · ascend / descend (vertical units traveled up / down — the space
 *   thrust lessons) · boost (seconds thrusting) · boost-steer (mid-boost direction
 *   changes) · jump (ground launches) · hit (of's hit-counter ticks) · clip-empty (active weapon
 *   auto-reload edge) · switch (loadout switch, optional `slot` index) · swing (swing starts,
 *   optional `dir`: left/right/back/neutral/forward) · combo (a combo follow-up CONNECTS) ·
 *   tackle (a shoulder-charge commits) · dodge (an acrobatic dodge commits) · stagger (of reels) ·
 *   destroy (of goes down). The maneuver facts read the engine-owned commit counters
 *   (e.tackleCount / e.dodgeCount — bumped by beginDodge and the pack's tackle start), so the
 *   detectors stay pack-agnostic: a composition without the maneuvers simply never ticks them.
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; core precedes this in EMISSION
 * (registration hooks + math destructured at build time); applySpawnProtect (combat-match) and
 * AI_DIFFICULTY (the ms pack, later in EMISSION) are reached late-bound via E.* at wake/set time.
 * Field ownership: state.tutorial, e.dormant, e.patrolIdx.
 * SELF-QUARANTINING like the match layer: a director bug disables the script for the session
 * (state.tutorial.dead), never the sim.
 */

export function buildTutorial(E) {
  const {
    RULES, TAU, clamp, fwdXY, resolveBlocking,
    registerNormalize, registerStateInit, registerBodyOwner, registerWorldPass,
  } = E;

  // ── the `patrol` rule — the passive walker ────────────────────────────────────────────────────
  // A deterministic march between `waypoints` ([[x,y], …], looped): turn toward the current point
  // (capped `turn` rad/s), walk when roughly facing, advance within the `arrive` radius. Without
  // waypoints it walks a slow constant arc (`turn` · `turnDir`) — a circling dummy. No targeting,
  // no trigger, no dice. Ground snap + collider ejection ride the same head-height idiom as the ai
  // brain (a down-cast from the current z sinks through rising terrain). Reactions/downs are body
  // OWNERS, so a staggered/toppled patroller reels exactly like any suit — the rule simply resumes
  // when the body is handed back; a downed one stays down (the walk never restarts a wreck).
  function patrol(e, input, dt, world) {
    const r = e.rule, t = e.transform;
    if (e.downed) { e.moving = false; return; }
    const speed = r.speed ?? 6, strideLen = r.stride ?? 2.4, eye = r.eye ?? 0;
    const wps = Array.isArray(r.waypoints) && r.waypoints.length ? r.waypoints : null;
    let moveMag = 0;
    if (wps) {
      const wp = wps[(e.patrolIdx || 0) % wps.length];
      const dx = wp[0] - t.pos[0], dy = wp[1] - t.pos[1];
      if (Math.hypot(dx, dy) < (r.arrive ?? Math.max(4, speed * 0.6))) {
        e.patrolIdx = ((e.patrolIdx || 0) + 1) % wps.length;
      } else {
        const want = Math.atan2(dy, dx);
        const dh = ((want - t.heading + Math.PI) % TAU + TAU) % TAU - Math.PI;
        t.heading += clamp(dh, -(r.turn ?? 1.2) * dt, (r.turn ?? 1.2) * dt);
        if (Math.abs(dh) < 1.0) {
          const f = fwdXY(t.heading), stp = speed * dt;
          t.pos[0] += f[0] * stp; t.pos[1] += f[1] * stp; moveMag = stp;
        }
      }
    } else {
      t.heading += (r.turn ?? 0.25) * (r.turnDir ?? 1) * dt;
      const f = fwdXY(t.heading), stp = speed * dt;
      t.pos[0] += f[0] * stp; t.pos[1] += f[1] * stp; moveMag = stp;
    }
    if (world && world.colliders) resolveBlocking(t.pos, t.pos[2] - eye, r.collideHeight ?? 24, r.collideRadius ?? 0, world.colliders, r.step ?? 0.35);
    // ground snap from HEAD height (the ai idiom): the walker has no gravity, and a cast from the
    // current z loses rising terrain — from head height it climbs slopes and never sinks.
    if (world && world.ground) {
      const g = world.ground([t.pos[0], t.pos[1], (t.pos[2] - eye) + (r.collideHeight ?? 24)]);
      if (g != null) t.pos[2] = g + eye;
    }
    if (moveMag > 0) { e.locomotion = 'forward'; e.gaitPhase = (e.gaitPhase || 0) + moveMag / strideLen; e.moving = true; }
    else e.moving = false;
  }
  Object.assign(RULES, { patrol });

  // ── DORMANT seats — the deterministic reinforcement ───────────────────────────────────────────
  // `dormant: true` on an entity mints it into the roster ABSENT from play: hidden (`gone` — the
  // renderer's wreck-vanish read), unhittable (ai targeting + radar + melee/ranged adjudication all
  // skip non-hittable bodies), rule suppressed (the body owner below). The match layer never enrolls
  // it (hittable is false before state inits run). wakeDormant returns it: visible, hittable, and —
  // on ground worlds — dropping in from the sky with brief wake i-frames, the arena's own entrance.
  registerNormalize((ent, raw) => {
    ent.dormant = raw.dormant === true;
    if (ent.dormant) { ent.gone = true; if (ent.body) ent.body.hittable = false; }
  });
  registerBodyOwner('dormant', (e) => !!e.dormant, 1);
  function wakeDormant(state, id) {
    const e = state.byId[id];
    if (!e || !e.dormant) return;
    e.dormant = false; e.gone = false;
    if (e.body) e.body.hittable = true;
    // the entrance: a sky drop-in + timed protection on ground worlds (space has no ground to hit).
    // applySpawnProtect lives in combat-match (earlier in EMISSION) — late-bound via E for the
    // engine-only composition where it always exists.
    const r = e.pilotRule || e.rule || {};
    if (E.applySpawnProtect && !r.space) E.applySpawnProtect(e, { dropHeight: 260, dropSpeed: 0, fireGuard: false, iFrames: 2 });
  }

  // ── the DIRECTOR — spec.tutorial → state.tutorial at createWorld ──────────────────────────────
  registerStateInit((state, spec) => {
    let tut = null;
    if (spec.tutorial && Array.isArray(spec.tutorial.steps) && spec.tutorial.steps.length) {
      const steps = spec.tutorial.steps.map((s, i) => ({
        id: typeof s.id === 'string' && s.id ? s.id : 'step-' + i,
        prompt: typeof s.prompt === 'string' ? s.prompt : '',
        goal: {
          fact: s.goal && typeof s.goal.fact === 'string' ? s.goal.fact : 'move',
          count: s.goal && Number.isFinite(s.goal.count) && s.goal.count > 0 ? s.goal.count : 1,
          of: s.goal && typeof s.goal.of === 'string' ? s.goal.of
            : s.goal && Array.isArray(s.goal.of) ? s.goal.of.filter((x) => typeof x === 'string')
              : null,
          dir: s.goal && typeof s.goal.dir === 'string' ? s.goal.dir : null,
          slot: s.goal && Number.isFinite(s.goal.slot) ? s.goal.slot : null,
        },
        activate: Array.isArray(s.activate) ? s.activate.filter((x) => typeof x === 'string') : null,
        heal: Array.isArray(s.heal) ? s.heal.filter((x) => typeof x === 'string') : null,
        optional: s.optional === true,
        set: s.set && typeof s.set === 'object' ? { ...s.set } : null,
      }));
      // idx −1 = pre-entry: the first world pass ENTERS step 0 (running its activate/set), so entry
      // actions live in one place instead of a createWorld special case.
      tut = { steps, idx: -1, count: 0, over: false, result: null, endedAt: 0, flash: -1, dead: false, prev: {} };
    }
    state.tutorial = tut;
  });

  // enterStep — advance to step i, run its one-shot entry actions (reinforcement wakes, difficulty
  // sets). `set.aiDifficulty` retunes the world brain by tier name (E.AI_DIFFICULTY — the ms pack's
  // table, late-bound; an engine-only composition simply has no table and the set is a no-op).
  function enterStep(state, i) {
    const T = state.tutorial;
    T.idx = i; T.count = 0; T.flash = state.time;
    for (const k in T) if (k.indexOf('__pos_') === 0 || k.indexOf('__z_') === 0) delete T[k];   // a fresh move/climb step never diffs a stale stash
    const s = T.steps[i];
    if (!s) return;
    if (s.activate) for (const id of s.activate) wakeDormant(state, id);
    // heal — the between-phases repair: full hull + shield back up ('pilot' resolves to the
    // piloted seat). hpMax/shieldMax are the normalize-hoisted starting values, so a heal is
    // exactly "as minted", never a buff.
    if (s.heal) for (const id of s.heal) {
      const e = state.byId[id === 'pilot' ? state.pilotId : id];
      if (!e || !e.body) continue;
      if (Number.isFinite(e.hpMax)) e.body.hp = e.hpMax;
      if (Number.isFinite(e.shieldMax)) e.shieldHp = e.shieldMax;
    }
    if (s.set && typeof s.set.aiDifficulty === 'string' && E.AI_DIFFICULTY) {
      state.aiTuning = E.AI_DIFFICULTY[s.set.aiDifficulty] || null;
    }
  }

  // the per-entity edge snapshot the fact detectors diff against. Taken AFTER the frame's facts are
  // read, for every non-camera entity — plain data on state.tutorial, so replay stays exact.
  function snapshot(T, state) {
    for (const e of state.entities) {
      if (e.isCamera) continue;
      const w = e.weapon;
      T.prev[e.id] = {
        grounded: e.grounded !== false, boosting: !!e.boosting, boostDir: e.boostDir || null,
        swingCount: e.swingCount || 0, meleeHitCount: e.meleeHitCount || 0,
        tackleCount: e.tackleCount || 0, dodgeCount: e.dodgeCount || 0,
        hits: e.hits || 0, staggered: e.staggerT != null, downed: !!e.downed,
        reloading: !!(w && w.reloading),
      };
    }
  }

  // measure(state, T, s) — this frame's progress increment for the active step's goal. Edge
  // detectors diff against T.prev (last frame); continuous facts (move/boost) integrate dt.
  function measure(state, T, s, dt) {
    const g = s.goal;
    const pilot = state.pilotId ? state.byId[state.pilotId] : null;
    const pv = pilot ? T.prev[pilot.id] : null;
    // `of` targets: a named entity, '*' = every non-pilot non-camera body, or a named id SET.
    const targets = (g.of == null) ? null
      : g.of === '*' ? state.entities.filter((e) => !e.isCamera && e !== pilot)
        : Array.isArray(g.of) ? g.of.map((id) => state.byId[id]).filter(Boolean)
          : (state.byId[g.of] ? [state.byId[g.of]] : []);
    const edge = (list, f) => {
      let n = 0;
      for (const e of list) { const p = T.prev[e.id]; if (p && f(e, p)) n++; }
      return n;
    };
    switch (g.fact) {
      case 'move': {
        if (!pilot || !pv) return 0;
        // planar distance this frame — read off the velocity-free transforms via a stashed pos.
        const k = '__pos_' + pilot.id;
        const last = T[k];
        const cur = [pilot.transform.pos[0], pilot.transform.pos[1]];
        T[k] = cur;
        return last ? Math.hypot(cur[0] - last[0], cur[1] - last[1]) : 0;
      }
      case 'ascend':
      case 'descend': {
        // vertical distance this frame, signed by the fact — the space ascend/descend lessons
        // (SPACE / X thrust). Same stashed-position idiom as 'move'.
        if (!pilot) return 0;
        const k = '__z_' + pilot.id;
        const last = T[k];
        const cur = pilot.transform.pos[2];
        T[k] = cur;
        if (last == null) return 0;
        const dz = cur - last;
        return g.fact === 'ascend' ? Math.max(0, dz) : Math.max(0, -dz);
      }
      case 'boost': return pilot && pilot.boosting ? dt : 0;
      case 'boost-steer':
        return pilot && pv && pilot.boosting && pv.boosting && pilot.boostDir && pv.boostDir
          && pilot.boostDir !== pv.boostDir ? 1 : 0;
      case 'jump':
        return pilot && pv && pv.grounded && pilot.grounded === false && pilot.vel[2] > 0.5 && !pilot.boosting ? 1 : 0;
      case 'hit': return targets ? edge(targets, (e, p) => (e.hits || 0) > p.hits) : 0;
      case 'clip-empty': {
        if (!pilot || !pv) return 0;
        const w = pilot.weapon;
        return w && w.reloading && !pv.reloading ? 1 : 0;
      }
      case 'switch':
        return pilot && pilot.switched && (g.slot == null || (pilot.loadoutIdx || 0) === g.slot) ? 1 : 0;
      case 'swing':
        return pilot && pv && (pilot.swingCount || 0) > pv.swingCount
          && (g.dir == null || pilot.lastSwingDir === g.dir) ? 1 : 0;
      case 'combo':
        // the follow-up CONNECTED: a melee hit landed by a swing flagged as the combo step.
        return pilot && pv && (pilot.meleeHitCount || 0) > pv.meleeHitCount && pilot.swingCombo ? 1 : 0;
      case 'tackle':
        return pilot && pv && (pilot.tackleCount || 0) > pv.tackleCount ? 1 : 0;
      case 'dodge':
        return pilot && pv && (pilot.dodgeCount || 0) > pv.dodgeCount ? 1 : 0;
      case 'stagger': return targets ? edge(targets, (e, p) => e.staggerT != null && !p.staggered) : 0;
      case 'destroy': return targets ? edge(targets, (e, p) => e.downed && !p.downed) : 0;
      default: return 0;
    }
  }

  // the world pass — after ALL of the frame's adjudication (rules, weapons, melee, match at 50), so
  // every edge the detectors read is this frame's settled truth.
  function stepTutorial(state, input, dt) {
    const T = state.tutorial;
    if (!T || T.dead) return;
    try {
      if (T.idx < 0) enterStep(state, 0);
      if (!T.over) {
        // the pilot going down ends the script (no match layer, no respawn — death is final here):
        // FAIL on a required step, SUCCESS on an `optional` one — the clear was already earned
        // when the optional phase entered; going down there merely confirms it.
        const s0 = T.steps[T.idx];
        const pilot = state.pilotId ? state.byId[state.pilotId] : null;
        if (pilot && pilot.downed) { T.over = true; T.result = s0 && s0.optional ? 'success' : 'fail'; T.endedAt = state.time; }
      }
      if (!T.over) {
        const s = T.steps[T.idx];
        if (!s) { T.over = true; T.result = 'success'; T.endedAt = state.time; }
        else {
          // SOFTLOCK GUARD: a step whose named target(s) are already down (or missing) can no
          // longer teach — it self-completes instead of stranding the script (e.g. the enemy
          // destroyed while the stagger lesson was still open; its downed edge would never fire
          // again). An id-set `of` self-completes only when EVERY named body is down/missing.
          const ofIds = s.goal.of && s.goal.of !== '*' ? (Array.isArray(s.goal.of) ? s.goal.of : [s.goal.of]) : null;
          if (ofIds && ofIds.length && ofIds.every((id) => { const n = state.byId[id]; return !n || n.downed; })) T.count = s.goal.count;
          else T.count += measure(state, T, s, dt);
          if (T.count >= s.goal.count) {
            if (T.idx + 1 >= T.steps.length) { T.over = true; T.result = 'success'; T.endedAt = state.time; }
            else enterStep(state, T.idx + 1);
          }
        }
      }
      snapshot(T, state);
    } catch (err) {
      if (!T.dead) { T.dead = true; console.error('tutorial director disabled after error:', err); }
    }
  }
  registerWorldPass('tutorial', (state, input, dt) => stepTutorial(state, input, dt), 60);

  Object.assign(E, { wakeDormant, stepTutorial });
}
