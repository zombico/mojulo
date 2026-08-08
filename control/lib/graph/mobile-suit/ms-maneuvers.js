/**
 * ms-maneuvers.js — the mobile-suit MANEUVER pack (controllable-split.plan.md, S4). The arena
 * verbs that ride the platform rule's maneuver seam: the ACROBATIC DODGE (double-tap F, i-frame
 * tumble, thruster overheat), the TACKLE (invincible shoulder-charge), LOADOUT weapon cycling
 * (R / 1–N, per-slot figures + switch ready-time), their committed dashes and locomotion claims —
 * plus the arena entity dressing (seat / liveries / loadout hoists). A composition without this
 * pack runs the base platformer + combat unchanged: every hook here is opt-in per rule, and the
 * phases are simply empty.
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; engine builders precede this
 * in EMISSION. Field ownership: the e.dodge- and e.tackle- families (fTapWin, tacklePrev,
 * tackleT, tackleDir), e.loadoutIdx/loadoutWeapons/switched/readyT/readyMax, e.seat/liveries.
 */

export function buildMsManeuvers(E) {
  const { fwdXY, rightXY, TAU, beginDodge, initWeapon, registerPlatformManeuver, registerNormalize } = E;

  // armSwitchReady(e, r, sc) — SWITCH READY-TIME (2026-07-28): every weapon SWITCH (loadout cycle /
  // slot-select, ranged AND melee, player AND ai) makes the newly-drawn weapon un-act-able for
  // `switchReady` sec (default 1) — you can't rapid-fire by flicking between slots whose own
  // cooldowns have refreshed. Distinct from reload (which is per-magazine and gates on its own)
  // and from the per-slot fire cooldown: it is a floor imposed by the ACT of switching. Re-armed
  // in full on every switch (A→B→A costs a second each way). Ticks world-side in stepWorld.
  // A slot-level `switchReady` on the INCOMING config wins over the rule's (a grenade takes
  // longer to ready than a rifle) — absent, the rule default holds.
  function armSwitchReady(e, r, sc) {
    e.readyMax = (sc && Number.isFinite(sc.switchReady)) ? sc.switchReady : (r.switchReady ?? 1);
    e.readyT = e.readyMax;
  }

  registerPlatformManeuver('maneuver', 'dodge', (e, input, dt, world, ctx) => {
    const r = ctx.r, space = ctx.space, hasGauge = ctx.hasGauge;
    // ACROBATIC DODGE (opt-in `dodge:true` on the rule): a DOUBLE-TAP of F while
    // grounded, pushed toward a held WASD direction, fires an invincible tumble.
    // F is boost when HELD; a second press EDGE within `doubleTapWindow` after a
    // first is the dodge — so hold-F still boosts, tap-tap-F dodges. The held
    // direction at fire picks the shape + the tumble axis (W roll / S backflip /
    // A·D barrel-roll / none spin), matching the DODGE_POSES shelf. Time-driven
    // one-shot (phase 0→1 over `dodgeDur`): steering is committed (no re-aim),
    // the body dashes along the fired direction on a 0→1→0 speed envelope, and
    // the renderer reads `e.tumble` to spin the whole body a full turn about the
    // maneuver axis. i-frames = the whole duration (`e.invincible`). Losing
    // footing does NOT cancel — an air dodge finishes its arc.
    // `dodge:true` = the acrobatic set (roll/backflip/sideroll/spin by direction);
    // `dodge:'twirl'` = the BULKY read — every direction is a grounded vertical
    // TWIRL (both feet stay down, nothing tumbles), the dash still carried by the
    // held stick. Suits too heavy to leave the ground opt into twirl.
    const dodgeOn = r.dodge === true || r.dodge === 'twirl';
    if (dodgeOn) {
      const dodgeDur = r.dodgeDur ?? 0.55;
      const boostEdge = !!input.boost && !e.boostPrev;
      e.boostPrev = !!input.boost;
      // an acrobatic dodge OVERHEATS the thruster (the gauge mechanic): a roll is a hard vector
      // burn, so committing one DUMPS the whole gauge and latches the empty-lock — the overheat
      // cooldown, during which thrust is dead until it cools past `boostUnlockFrac`. Two modifiers
      // exempt the overheat: `dodgeOverheat:false` (a heat sink — the roll just spends
      // `dodgeBoostCost` and can chain) and `dodgeBoostCost:0` (free rolls, no gauge at all). A
      // dodge is REFUSED unless the thruster is LIVE — not already overheated, and holding at least
      // `dodgeBoostCost` charge (you cannot vector-roll on a dead thruster).
      const dodgeCost = r.dodgeBoostCost ?? 2;
      const dodgeOverheats = hasGauge && dodgeCost > 0 && (r.dodgeOverheat ?? true);
      // ALIGNED RECOVERY (rev3): on an overheat rule the roll is gated by the OVERHEAT itself —
      // `canDodge` below (cost + not locked) — so dodging stays USABLE through ordinary
      // partial-bar recovery. Only a drained, overheat-locked bar (a dodge dump, or thrusting
      // the gauge dry) kills boost AND dodge together, and that outage holds until the bar
      // recovers FULL (~7.5s — the overheat regen regime + full-bar unlock, below). The
      // wall-clock `dodgeCdT` gates only the gaugeless / heat-sink / free-roll shapes
      // (dodgeCooldown ?? 8; a world that wants the old free chaining sets dodgeCooldown: 0).
      const dodgeReady = dodgeOverheats || (e.dodgeCdT || 0) <= 0;
      const canDodge = !hasGauge || dodgeCost <= 0 || (e.boost >= dodgeCost && !e.boostLock);
      if (e.dodgeT == null) {
        // space: the dash starts in mid-float (no ground needed); hoverGrace: a boost-hovering
        // suit (or one whose cushion just vanished with the F release) keeps its ground read.
        if (boostEdge && (e.fTapWin ?? 0) > 0 && (e.grounded || space || (e.hoverGrace || 0) > 0) && canDodge && dodgeReady && e.tackleT == null) {
          beginDodge(e, input, r);   // second tap inside the window → commit the roll (clip + dir + gauge cost)
        } else if (boostEdge) {
          e.fTapWin = r.doubleTapWindow ?? 0.28;   // first tap — open the window
        }
        if ((e.fTapWin ?? 0) > 0) e.fTapWin = Math.max(0, e.fTapWin - dt);
      }
      if (e.dodgeT != null) {
        e.dodgeT += dt / dodgeDur;
        if (e.dodgeT >= 1) { e.dodgeT = null; e.tumble = null; e.invincible = false; e.dodgeDir = null; }
      }
      ctx.dodging = e.dodgeT != null;
    }

  }, 10);
  registerPlatformManeuver('maneuver', 'tackle', (e, input, dt, world, ctx) => {
    const r = ctx.r, space = ctx.space, hasGauge = ctx.hasGauge, f = ctx.f;
    // TACKLE (opt-in `r.tackle:true` on the rule; the SHIFT key → `input.tackle`): an INVINCIBLE
    // offensive DASH — a committed straight-ahead shoulder-charge (default 2s) that STAGGERS and
    // chips anything it rams (hit adjudication is stepTackle, run in stepWorld beside stepMelee).
    // It is a body-check, not a shot: it stays invincible for the whole dash and OWNS the body
    // (fire / weapon-switch / dodge / another tackle all refused mid-tackle). THRUSTER COST: it is
    // usable as long as the boost gauge holds ANY charge (a sliver, `e.boost > 0` — no full bar
    // needed, even a locked/recovering bar with a sliver qualifies); committing INSTANTLY DUMPS the
    // whole gauge and latches the overheat lock (like an acrobatic dodge), then the dash runs its
    // full fixed clock regardless. On a gaugeless suit (no `boostMax`) there is no cost and no gate.
    // Absent `r.tackle` → the whole block is skipped, byte-identical.
    const tackleOn = r.tackle === true;
    if (tackleOn) {
      const tackleDur = r.tackleDur ?? 2;
      const tackleEdge = !!input.tackle && !e.tacklePrev;
      e.tacklePrev = !!input.tackle;
      // START GATE: a sliver of thruster (any charge > 0 — the literal "usable as long as there's a
      // sliver"; gaugeless suits are always free), grounded (or floating in space), and not already
      // committed to a tackle / swing / dodge / reaction / charge.
      const hasSliver = !hasGauge || e.boost > 1e-6;
      const tackleBusy = e.tackleT != null || e.swingT != null || e.dodgeT != null || e.staggerT != null || e.jumpCharge >= 0;
      if (e.tackleT == null && tackleEdge && hasSliver && !tackleBusy && (e.grounded || space)) {
        e.tackleT = 0; e.tackleHits = {};
        e.tackleCount = (e.tackleCount || 0) + 1;   // edge for the audio channel (the charge WHOOMPH), like e.dodgeCount
        if (hasGauge) { e.boost = 0; e.boostLock = true; }   // instant full dump + overheat (the thruster cost)
        e.tackleDir = [f[0], f[1]];   // commit straight ahead — steering is locked for the maneuver, like the dodge
      }
      if (e.tackleT != null) {
        e.tackleT += dt / tackleDur;
        if (e.tackleT >= 1) { e.tackleT = null; e.tackleDir = null; e.invincible = false; }
      }
      ctx.tackling = e.tackleT != null;
    }

  }, 20);
  registerPlatformManeuver('equip', 'loadout', (e, input, dt, world, ctx) => {
    const r = ctx.r;
    // WEAPON CYCLING (opt-in `loadout` on the rule — mobile-suit weapon switching): the rule
    // carries an ordered list of weapon configs `{ figure, name?, weapon?, strike?, strikeDur? }`,
    // one ACTIVE at a time (the R5.6 doctrine made runtime: a config is ranged `weapon` OR melee
    // `strike`, never both). R (`input.cycle`) steps the list, 1–N (`input.slot`) direct-selects.
    // Switching swaps the rendered body (`e.body.figure` — each config points at its own baked
    // figure, active weapon in the fist + the other racked) and the fire route (`e.weapon` from
    // the per-slot pool, so ammo/reload state survives a switch; melee slots carry no weapon and
    // left mouse falls through to the strike below). Blocked ONLY mid-swing / mid-dodge — those
    // own the body; boost/air/kneel/charge all allow the swap (the arms are aim-locked anyway).
    const lo = Array.isArray(r.loadout) && r.loadout.length ? r.loadout : null;
    if (lo) {
      let want = null;
      if (input.cycle) want = ((e.loadoutIdx || 0) + 1) % lo.length;
      else if (input.slot >= 1 && input.slot <= lo.length) want = input.slot - 1;
      e.switched = false;
      if (want != null && want !== (e.loadoutIdx || 0) && e.swingT == null && e.dodgeT == null && e.tackleT == null) {
        e.loadoutIdx = want;
        if (lo[want].figure) e.body.figure = lo[want].figure;
        e.weapon = e.loadoutWeapons ? e.loadoutWeapons[want] : null;
        e.switched = true;
        armSwitchReady(e, r, lo[want]);   // SWITCH READY-TIME (2026-07-28): a fresh weapon is not act-ready for ~1s (slot switchReady wins)
      }
    }
    ctx.activeCfg = lo ? lo[e.loadoutIdx || 0] : null;
  }, 10);
  registerPlatformManeuver('dash', 'dodge-dash', (e, input, dt, world, ctx) => {
    const r = ctx.r, t = ctx.t, speed = ctx.speed;
    // dodge dash: a committed burst along the fired direction (0→1→0 envelope,
    // world-space — steering is locked for the maneuver). Planar in both modes.
    if (ctx.dodging && e.dodgeDir) {
      const env = Math.sin(Math.min(1, e.dodgeT) * Math.PI);
      const dsp = (r.dodgeSpeed ?? speed * 2.6) * env * dt;
      t.pos[0] += e.dodgeDir[0] * dsp; t.pos[1] += e.dodgeDir[1] * dsp;
    }
  }, 10);
  registerPlatformManeuver('dash', 'tackle-dash', (e, input, dt, world, ctx) => {
    const r = ctx.r, t = ctx.t, boostSpeed = ctx.boostSpeed;
    // tackle dash: a committed CONSTANT-speed charge straight ahead (planar in both modes, like the
    // dodge dash) for the whole tackle clock — the offensive gap-closer. `tackleSpeed` defaults to
    // the boost speed (a fast lunge, not the slower dodge envelope).
    if (ctx.tackling && e.tackleDir) {
      const tsp = (r.tackleSpeed ?? boostSpeed) * dt;
      t.pos[0] += e.tackleDir[0] * tsp; t.pos[1] += e.tackleDir[1] * tsp;
    }
  }, 20);
  registerPlatformManeuver('claim', 'tackle', (e, input, dt, world, ctx) => {
    if (!ctx.tackling) return false;
    const r = ctx.r, boostSpeed = ctx.boostSpeed, strideLen = ctx.strideLen;
      // the tackle OWNS the body: it reads as a forward thrust CHARGE — reuse the 'boost' pose (the
      // suit leans into the dash with its thrusters lit) so no new clip needs baking, and it stays
      // INVINCIBLE for the whole dash (a body-check, not a spent-on-fire dodge). No tumble.
      e.locomotion = 'boost'; e.moving = true; e.invincible = true; e.tumble = null;
      e.gaitPhase = (e.gaitPhase || 0) + (r.tackleSpeed ?? boostSpeed) * dt / strideLen;
    return true;
  }, 10);
  registerPlatformManeuver('claim', 'dodge', (e, input, dt, world, ctx) => {
    if (!ctx.dodging) return false;
    const r = ctx.r, f = ctx.f, rt = ctx.rt;
      // the dodge OWNS the body: hold the static tuck/pike/spin shape while the
      // renderer tumbles the whole rig a full turn about the maneuver axis.
      e.locomotion = e.dodgeClip; e.moving = true; e.invincible = !e.dodgeSpent; e.gaitPhase = 0;
      const ang = Math.min(1, e.dodgeT) * (r.dodgeTurns ?? 1) * TAU;
      let ax;
      if (e.dodgeKind === 'fwd') ax = [-rt[0], -rt[1], 0];          // roll FORWARD (pitch over the front) about the lateral axis
      else if (e.dodgeKind === 'back') ax = [rt[0], rt[1], 0];      // flip BACKWARD (pitch over the back)
      else if (e.dodgeKind === 'side') ax = [f[0] * e.dodgeSign, f[1] * e.dodgeSign, 0];  // barrel-roll about forward
      else ax = [0, 0, 1];                                          // spin about vertical
      e.tumble = { axis: ax, angle: ang };
    return true;
  }, 20);

  // arena entity dressing — the pack's normalize extension (runs after combat-hit's hoists):
  registerNormalize((ent, raw) => {
    // arena M3: an optional SEAT tag ('player' | 'opponent') the game-params seam reads — a level
    // world authors its FULL roster and the launcher's picks despawn the unpicked opponent seats.
    ent.seat = typeof raw.seat === 'string' ? raw.seat : null;
    // paint-in-match LIVERIES (livery-ingame.plan.md): the setup pick swaps the piloted suit to the
    // chosen livery's baked figure. Preserve the authored list [{id,name,color,figure}] — __makeBody
    // pre-builds each figure as a hidden variant, __applyMatchParams swaps on the launcher pick.
    ent.liveries = Array.isArray(raw.liveries) ? raw.liveries.map((l) => ({ ...l })) : null;
    // LOADOUT init (weapon cycling): one weapon-state slot per config, pre-built so ammo/reload
    // persist across switches; slot 0 starts active (its figure wins over any body.figure typo).
    const lo = ent.rule && Array.isArray(ent.rule.loadout) && ent.rule.loadout.length ? ent.rule.loadout : null;
    if (lo) {
      ent.loadoutIdx = 0;
      ent.loadoutWeapons = lo.map((c) => initWeapon(c && c.weapon ? c.weapon : null));
      ent.weapon = ent.loadoutWeapons[0];
      if (ent.body && lo[0].figure) ent.body.figure = lo[0].figure;
    }
  });

  Object.assign(E, { armSwitchReady });
}
