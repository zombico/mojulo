/**
 * combat-ranged.js — the ranged weapon subsystem (controllable-split.plan.md, S2). initWeapon's
 * normalized config (hitscan sight/area cones, lob projectiles, magazines/reload, burst, energy
 * heat, charge shots, dual-wield muzzles), tickWeapon (the autoloader — passive timers tick for
 * every carried weapon, stowed or not), stepWeapon (fire gates + the shot ray vs the egg /
 * legacy-sphere cone, cover occlusion, shields, damage + poise chip), stepProjectiles (swept
 * lob rounds, proximity fuzes, walls), and burstProjectile (the AoE poise-break).
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; combat-hit + combat-match
 * precede this in EMISSION (armReaction / absorbShield / boostStunFactor / breakGuards /
 * matchStat destructured at build time). Field ownership: the weapon-state records themselves
 * (w.*), state.projectiles/bursts + seqs, e.lastShot.
 */

export function buildCombatRanged(E) {
  const {
    sub, clamp, lerp3, fwdXY, rightXY, fwd3,
    sightBlocked, nearestWallT, hitEgg, pointInEgg, latR,
    armReaction, absorbShield, boostStunFactor, breakGuards, matchStat,
    registerEntityAssert, registerWorldPass,
  } = E;

  // ── the WEAPON subsystem: fire, ammo, cooldown/ROF, auto-reload, hit resolution ──
  // A controlled entity can carry a `weapon`; each frame stepWeapon reads input.fire
  // and adjudicates a shot against the world's HITTABLE entities (a target is just an
  // entity with body.hittable). This is the targeting computer (mobile-suit R6-C): a
  // two-ring reticle (coreAngle / assistAngle, degrees) about the aim axis, gated by
  // the weapon's fireClass — 'sight' weapons land only in the core, 'area' weapons
  // (machine guns) also land the outer assist ring (area auto-aim). Pure + deterministic
  // (fixed input+dt → identical shots), so it tests in Node and replays byte-identical.
  //
  // Ammo model: a magazine of `magazine` rounds; auto weapons fire at `rof` rounds/sec,
  // semi weapons every `cooldown` sec; hitting 0 AUTO-RELOADS over `reload` sec (the HUD
  // shows the circular wait). All numbers are weapon-tunable.
  function initWeapon(w) {
    if (!w || typeof w !== 'object') return null;
    const area = w.fireClass === 'area';
    const lob = w.fireClass === 'lob';   // R14: a TRAVELLING round (grenade/bazooka) that bursts later — not a hitscan cone
    const magazine = w.magazine ?? w.clip ?? w.pack ?? 30;
    return {
      fireClass: lob ? 'lob' : area ? 'area' : 'sight',
      auto: w.auto ?? (area && !lob),     // machine guns hold-to-fire; beams + launchers are per-click
      rof: w.rof ?? 10,                   // rounds/sec when auto
      cooldown: w.cooldown ?? 0.5,        // sec between shots when semi
      // BURST (semi only): one trigger pull fires `burst` rounds at `burstRof` rounds/sec,
      // then the full `cooldown` gates the next pull. burst 1 (the default) is the plain
      // semi shot — byte-identical behavior for every existing weapon. The burst COMMITS:
      // releasing the trigger mid-burst does not stop it (that is what a burst is), and a
      // reload cancels whatever remained.
      burst: Math.max(1, Math.round(w.burst ?? 1)),
      burstRof: w.burstRof ?? 8,          // in-burst rounds/sec (burst > 1 only)
      magazine,
      reload: w.reload ?? 2,              // sec to refill on empty
      coreAngle: w.coreAngle ?? 1.5,      // precise center half-angle (deg) — every weapon lands here
      assistAngle: w.assistAngle ?? (area ? 7 : (w.coreAngle ?? 1.5)),   // outer ring (deg) — area only
      range: w.range ?? 400,
      damage: w.damage ?? 0,              // hp subtracted from a hittable per landed shot / burst (the "numbers")
      impact: w.impact ?? 0,             // poise chipped per landed shot; a hittable's poise breaks -> it STAGGERS
      chargedImpact: Number.isFinite(w.chargedImpact) ? w.chargedImpact : null,
      // charged-shot AMMO COST (taisa charge): a charged bolt spends this many rounds, CLAMPED to
      // what's left — one bullet in the magazine still fires the charge (it just empties it).
      chargedAmmoCost: Number.isFinite(w.chargedAmmoCost) && w.chargedAmmoCost > 0 ? Math.round(w.chargedAmmoCost) : null,
      // charged-shot DAMAGE (operator 2026-08-10, taisa): the charged bolt's own hp chip —
      // taisa's stun bolt lands 3.5 bullets' worth (42 vs 12/round). null → the base damage,
      // byte-identical (the mk2 V78 charge keeps its plain-round numbers).
      chargedDamage: Number.isFinite(w.chargedDamage) ? w.chargedDamage : null,
      // charged-shot RANGE (operator 2026-08-10, mk2 + taisa beam rifles): a FULL charge carries
      // 20% further than the base sight range — the held bolt rewards the commit with reach.
      // A property of the charge mechanic itself (the only charging weapons are the two beam
      // rifles), so 1.2 is the default; a weapon opts out / retunes via `chargedRangeMul`.
      // Uncharged shots always fire at plain `range` — a chargeTime:0 weapon never reads this.
      chargedRangeMul: Number.isFinite(w.chargedRangeMul) && w.chargedRangeMul > 0 ? w.chargedRangeMul : 1.2,
      eye: w.eye ?? 0,                    // fire-origin height above the entity's pos
      muzzleOffset: w.muzzleOffset || null,   // { f, r, u } body-frame gun tip (tracer/flash/launch origin; renderer)
      muzzleAlt: w.muzzleAlt || false,        // DUAL WIELD (alternate): flip the lateral muzzle each shot (two guns take turns)
      muzzleDual: w.muzzleDual || false,      // DUAL WIELD (simultaneous): fire BOTH guns each shot — the renderer mirrors the muzzle flash
      // NO-FIRE-WHILE-BOOSTING (operator): heavy launchers (lob) + precise semi beams (the beam-rifle
      // class) can't be fired mid-thrust; auto suppression weapons (MG/vulcan) still stream. null →
      // the class default (w.auto — true for area autos, false for lob + semi beams); set explicitly
      // to override a single weapon either way.
      boostFire: w.boostFire ?? null,
      fxColor: w.fxColor ?? null,         // tracer/flash tint (renderer)
      fxScale: w.fxScale ?? null,         // effect base size (renderer)
      smokeTrail: w.smokeTrail ?? true,    // lob projectile smoke trail toggle (grenades opt out; bazookas keep it)
      reticleDist: w.reticleDist ?? null, // how far ahead the crosshair marks the aim point (renderer)
      sfx: w.sfx && typeof w.sfx === 'object' ? w.sfx : null,   // per-weapon SFX cues { shot?, hit?, reload? } — the audio channel prefers these over the world-level ones (a beam rifle and a machine gun sound different)
      // ENERGY weapons (V78 beam-rifle spike): an ammo-like heat budget that passively recovers. A
      // shot spends energyCost; if that spend empties the pool the weapon overheat-locks until the
      // pool refills to energyUnlockFrac (default full). This rides tickWeapon so it cools while stowed.
      energyMax: Number.isFinite(w.energyMax ?? w.energy) && (w.energyMax ?? w.energy) > 0 ? (w.energyMax ?? w.energy) : 0,
      energyCost: Number.isFinite(w.energyCost) ? w.energyCost : 0,
      energyRegen: Number.isFinite(w.energyRegen) ? w.energyRegen : 0,
      energyOverheatRegen: Number.isFinite(w.energyOverheatRegen) ? w.energyOverheatRegen : null,
      energyUnlockFrac: Number.isFinite(w.energyUnlockFrac) ? w.energyUnlockFrac : 1,
      chargeTime: Number.isFinite(w.chargeTime) && w.chargeTime > 0 ? w.chargeTime : 0,
      chargedEnergyCost: Number.isFinite(w.chargedEnergyCost) ? w.chargedEnergyCost : null,
      // R14 projectile params (lob only): a round spawned into state.projectiles, integrated + burst
      // by stepProjectiles. A grenade is a high lobAngle + high gravity arc; a bazooka is lobAngle 0 +
      // low gravity + high speed (fast, nearly flat). splashRadius drives the burst's poise-break reach.
      projectileSpeed: w.projectileSpeed ?? 60,   // launch speed along the (lob-tilted) aim, world u/s
      projectileGravity: w.projectileGravity ?? 30,   // downward accel, u/s^2 (high = arcs; low = flat)
      lobAngle: w.lobAngle ?? 0,          // deg the launch aim tilts UP from the look direction (the lob)
      splashRadius: w.splashRadius ?? 0,  // burst poise-break/damage reach; the direct hit is the d~0 case
      projRadius: w.projRadius ?? 0.5,    // the round's own collision radius (added to a target's radius)
      armTime: w.armTime ?? 0.06,         // sec before the round can burst (so it clears the muzzle/owner)
      fuse: w.fuse ?? 4,                  // sec max flight before it bursts wherever it is
      // PROXIMITY FUZE (bazooka QoL, 2026-08-06): the round DETONATES when it passes within this
      // distance of a hittable body — a near-miss bursts beside the target and the splash catches
      // it, instead of sailing past. 0 (default) = contact-only, byte-identical.
      proximity: Number.isFinite(w.proximityRadius) && w.proximityRadius > 0 ? w.proximityRadius : 0,
      ammo: magazine, cooldownT: 0, reloading: false, reloadT: 0, prevFire: false, shots: 0,
      burstLeft: 0,                       // rounds still owed to the current trigger pull
      energy: Number.isFinite(w.energyMax ?? w.energy) && (w.energyMax ?? w.energy) > 0 ? (w.energyMax ?? w.energy) : 0,
      energyLock: false,
      charging: false, chargeT: 0, chargeFrac: 0, chargeReady: false, chargeCount: 0, chargedShots: 0,
    };
  }

  function cancelWeaponCharge(w) {
    if (!w || !w.charging) return;
    w.charging = false; w.chargeT = 0; w.chargeFrac = 0; w.chargeReady = false;
  }

  // tickWeapon(w, dt) — advance a weapon's PASSIVE timers: the shot cooldown and the reload.
  // R20.3 (operator: "reloading is ongoing even if the weapon is not being used"): stepWorld runs
  // this for EVERY weapon an entity carries — all loadout slots, not just the active fist — every
  // frame, staggered or not. The autoloader is machinery, not attention: a magazine keeps
  // refilling and a bazooka's 5s cooldown keeps draining while the weapon is stowed on a switch,
  // while a melee slot has the fist, and while the suit is reeling. (Supersedes the R7 "mid-reload
  // state freezes while switched away" behavior.) Also arms the auto-reload on an empty stowed
  // magazine, so a weapon emptied and immediately switched away still refills.
  function tickWeapon(w, dt) {
    if (!w) return;
    if (w.cooldownT > 0) w.cooldownT = Math.max(0, w.cooldownT - dt);
    if (w.energyMax > 0) {
      const rr = w.energyLock ? (w.energyOverheatRegen ?? w.energyRegen) : w.energyRegen;
      if (rr > 0) w.energy = Math.min(w.energyMax, (w.energy ?? w.energyMax) + rr * dt);
      if (w.energyLock && w.energy >= w.energyMax * Math.max(0, Math.min(1, w.energyUnlockFrac))) {
        w.energy = Math.min(w.energyMax, w.energy);
        w.energyLock = false;
      }
    }
    if (w.ammo <= 0 && !w.reloading) { w.reloading = true; w.reloadT = w.reload; w.burstLeft = 0; }
    if (w.reloading) {
      w.reloadT -= dt;
      if (w.reloadT <= 0) { w.ammo = w.magazine; w.reloading = false; w.reloadT = 0; }
    }
  }

  // Resolve one shot: ray from the eye along heading/pitch, cone test against every
  // hittable target (nearest wins). A target's own angular radius widens the ring, so
  // "the reticle sits on the target" reads as a hit. Returns 'core' | 'assist' | 'miss'.
  // Passive timers (cooldownT / reload) tick in tickWeapon, world-side — this only READS them.
  function stepWeapon(e, input, dt, state) {
    const w = e.weapon;
    if (!w) return;
    if (w.reloading) {
      cancelWeaponCharge(w);
      w.prevFire = !!input.fire;
      return;                              // no firing mid-reload
    }
    if (w.energyMax > 0 && w.energyLock) {
      cancelWeaponCharge(w);
      w.prevFire = !!input.fire;
      return;                              // overheat lock: no firing until the energy pool refills
    }
    // SWITCH READY-TIME (2026-07-28): a freshly-switched weapon holds fire for ~1s (armSwitchReady).
    // Checked AFTER the reload guard, so it "doesn't count when reloading" — a reload already blocks,
    // and the two windows just overlap; it's the ACT of switching, not the reload, that arms this.
    if ((e.readyT || 0) > 0) {
      cancelWeaponCharge(w);
      w.prevFire = !!input.fire;
      return;
    }
    // NO-FIRE-WHILE-BOOSTING (operator): a thrusting suit can't line up a bazooka or beam-rifle shot.
    // `e.boosting` is settled by the movement rule earlier this frame (pilot + ai). Auto suppression
    // weapons (MG / vulcan, fireClass 'area') keep streaming; lob + semi beams hold fire until the
    // thrust ends. A committed burst simply pauses and resumes off-boost (cooldownT still ticks).
    const fireHeld = !!input.fire;
    const edge = fireHeld && !w.prevFire;
    const release = !fireHeld && !!w.prevFire;
    const energyReady = !(w.energyMax > 0) || w.energy > 0;
    const canBoostFire = w.boostFire != null ? w.boostFire : w.auto;
    if (e.boosting && !canBoostFire) {
      // CHARGE-THROUGH-BOOST (operator 2026-08-06, taisa + mk2 rifles): thrust no longer wipes a
      // charge. While boosting, a held charge keeps ACCUMULATING and a fresh press still STARTS
      // one — both flows fall to the charge block below, whose hold/start branches return before
      // any round leaves. A COMPLETED charge released mid-boost fires its stun bolt — that one
      // deliberate shot is exempt from the doctrine. Anything else (an uncharged release, a
      // plain semi/lob pull, a paused burst) still can't fire while thrusting; the uncharged
      // mid-boost release drops its partial charge like any interrupted tap.
      const chargeFlow = w.chargeTime > 0 && !w.auto
        && ((w.charging && fireHeld)
          || (edge && w.cooldownT <= 0 && w.burstLeft <= 0 && w.ammo > 0 && energyReady)
          || (w.charging && release && w.chargeReady));
      if (!chargeFlow) {
        cancelWeaponCharge(w);
        w.prevFire = fireHeld;
        return;
      }
    }
    let forcedShot = false, chargedShot = false;
    if (w.chargeTime > 0 && !w.auto) {
      if (w.charging && fireHeld) {
        w.chargeT = Math.min(w.chargeTime, (w.chargeT || 0) + dt);
        w.chargeFrac = Math.max(0, Math.min(1, w.chargeT / w.chargeTime));
        w.chargeReady = w.chargeFrac >= 1;
        w.prevFire = true;
        return;
      }
      if (w.charging && release) {
        chargedShot = !!w.chargeReady;
        cancelWeaponCharge(w);
        // A COMPLETED charge fires the single charged bolt (forced). An UNCHARGED release is an
        // ordinary trigger pull: open the volley below, so a tap on a BURST rifle (taisa 3-burst)
        // still rips its full string — charge only rides a full hold. Burst-1 weapons behave
        // exactly as the old forced single (same gates, one round, same cooldown arm).
        if (chargedShot) forcedShot = true;
        else if (w.cooldownT <= 0 && w.burstLeft <= 0 && w.ammo > 0 && energyReady) w.burstLeft = w.burst;
      } else if (edge && w.cooldownT <= 0 && w.burstLeft <= 0 && w.ammo > 0 && energyReady) {
        w.charging = true; w.chargeT = 0; w.chargeFrac = 0; w.chargeReady = false; w.chargeCount = (w.chargeCount || 0) + 1;
        w.prevFire = true;
        return;
      } else if (w.burstLeft <= 0) {
        // idle (not charging, no pending rounds) → nothing to do. A LIVE volley falls through
        // instead: the burst a tap opened keeps self-firing on the frames after the release.
        w.prevFire = fireHeld;
        return;
      }
    }
    w.prevFire = fireHeld;
    const shotImpact = chargedShot ? (w.chargedImpact ?? w.impact ?? 0) : (w.impact || 0);
    const shotRange = chargedShot ? w.range * (w.chargedRangeMul || 1) : w.range;   // the charged bolt reaches further
    const shotDamage = chargedShot ? (w.chargedDamage ?? w.damage ?? 0) : (w.damage || 0);
    // a semi trigger pull OPENS a burst of `burst` rounds; the pending rounds then fire
    // themselves at burstRof regardless of the trigger (a burst commits — see initWeapon).
    if (!w.auto && !forcedShot && edge && w.cooldownT <= 0 && w.burstLeft <= 0 && w.ammo > 0) w.burstLeft = w.burst;
    const want = energyReady && w.ammo > 0 && w.cooldownT <= 0 && (forcedShot || (w.auto ? !!input.fire : w.burstLeft > 0));
    if (want) {
      w.ammo -= (chargedShot && w.chargedAmmoCost) ? Math.min(w.chargedAmmoCost, w.ammo) : 1;
      w.shots += 1;
      if (w.energyMax > 0) {
        const ec = chargedShot ? (w.chargedEnergyCost ?? w.energyCost ?? 0) : (w.energyCost || 0);
        w.energy = Math.max(0, (w.energy ?? w.energyMax) - ec);
        if (w.energy <= 0) { w.energy = 0; w.energyLock = true; w.burstLeft = 0; }
      }
      if (chargedShot) w.chargedShots = (w.chargedShots || 0) + 1;
      const mst = matchStat(state, e.id);
      if (mst) mst.shots += 1;   // score screen: every ranged round fired (accuracy denominator)
      breakGuards(e);   // a round leaving spends any protection (spawn shield / wake guard / dodge i-frames)
      if (!w.auto && !forcedShot) w.burstLeft -= 1;
      w.cooldownT = w.auto ? 1 / (w.rof || 10)
        : (w.burstLeft > 0 ? 1 / (w.burstRof || 8) : (w.cooldown || 0.5));
      const t = e.transform;
      const origin = [t.pos[0], t.pos[1], t.pos[2] + w.eye];
      const aim = fwd3(t.heading, t.pitch || 0);
      // muzzle world point: the gun tip (body-frame offset), else the eye — the launch/tracer origin.
      // DUAL WIELD (muzzleAlt): a two-pistol slot shares one magazine but the two guns TAKE TURNS —
      // the lateral (right) offset flips sign each shot, so the tracer/flash alternates left↔right hand.
      const mo = w.muzzleOffset, hf = fwdXY(t.heading), hr = rightXY(t.heading);
      const rMul = (mo && w.muzzleAlt && (w.shots % 2 === 0)) ? -1 : 1;
      const from = mo
        ? [t.pos[0] + hf[0] * (mo.f || 0) + hr[0] * (mo.r || 0) * rMul, t.pos[1] + hf[1] * (mo.f || 0) + hr[1] * (mo.r || 0) * rMul, t.pos[2] + (mo.u != null ? mo.u : w.eye)]
        : origin.slice();
      if (w.fireClass === 'lob') {
        // LAUNCH a travelling round (R14) instead of resolving a hitscan cone. The launch aim tilts
        // UP by lobAngle° (the arc); velocity = that direction · projectileSpeed. stepProjectiles
        // integrates it under gravity and adjudicates the burst. lastShot carries to:null so the
        // hitscan fx channel draws nothing — the projectile channel owns lob visuals.
        const la = (w.lobAngle || 0) * Math.PI / 180;
        const dir = fwd3(t.heading, (t.pitch || 0) + la);
        const sp = w.projectileSpeed || 60;
        state.projectiles.push({
          id: 'proj-' + (state.projSeq++), owner: e.id,
          pos: from.slice(), vel: [dir[0] * sp, dir[1] * sp, dir[2] * sp],
          gravity: w.projectileGravity || 0, splashRadius: w.splashRadius || 0, projRadius: w.projRadius || 0.5, prox: w.proximity || 0,
          damage: w.damage || 0, impact: shotImpact, born: state.time, age: 0, armTime: w.armTime || 0, fuse: w.fuse || 4,
          fxColor: w.fxColor ?? null, fxScale: w.fxScale ?? null, smokeTrail: w.smokeTrail !== false,
        });
        e.lastShot = { mode: 'launch', t: state.time, from, to: null, charged: chargedShot };
      } else {
        const coreR = w.coreAngle * Math.PI / 180, assistR = w.assistAngle * Math.PI / 180;
        let best = null, friendHit = null;   // friendHit = nearest ALLY the ray passes through (staggered, never a damage target)
        for (const tg of state.entities) {
          if (tg === e || tg.invincible || !(tg.body && tg.body.hittable)) continue;   // i-frames (dodge / getup) take no hits
          const friendly = e.team && tg.team && tg.team === e.team;   // TEAM: friendly fire off — allies pass through, but stagger
          const v = sub(tg.transform.pos, origin);
          const d = Math.hypot(v[0], v[1], v[2]);
          if (d < 1e-3 || d > shotRange) continue;
          let mode = null, hd = d;
          if (tg.body.egg) {
            // R19 CORE = the aim ray actually passing THROUGH the tilted egg (fair — aim at the body).
            const te = hitEgg(origin, aim, tg);
            if (te != null && te <= shotRange) { mode = 'core'; hd = te; }
            else if (w.fireClass === 'area') {
              // the MG assist ring stays ITS OWN thing: the outer angular ring, sized off the egg's width.
              const ang = Math.acos(clamp((v[0] * aim[0] + v[1] * aim[1] + v[2] * aim[2]) / d, -1, 1));
              if (ang <= assistR + Math.atan(tg.body.egg.a / d)) mode = 'assist';
            }
          } else {
            // legacy isotropic sphere (unchanged for any body without an egg → byte-identical).
            const ang = Math.acos(clamp((v[0] * aim[0] + v[1] * aim[1] + v[2] * aim[2]) / d, -1, 1));
            const subtend = Math.atan((tg.body.radius || 0.5) / d);   // the target's angular size widens the ring
            if (ang <= coreR + subtend) mode = 'core';
            else if (w.fireClass === 'area' && ang <= assistR + subtend) mode = 'assist';
          }
          if (friendly) {
            // an ally is never a damage candidate, but the beam PASSES THROUGH it — record the nearest
            // ally on the ray (clear of cover) so it can be STAGGERED after the scan (no block, no hurt).
            if (mode && !sightBlocked(from, tg.transform.pos, state.colliders) && (!friendHit || hd < friendHit.d)) friendHit = { d: hd, tg };
            continue;
          }
          // COVER: a solid box on the muzzle→target sightline eats the shot (the same colliders that
          // block movement). Checked only for a would-be hit, so it costs nothing on a clean lane.
          if (mode && sightBlocked(from, tg.transform.pos, state.colliders)) mode = null;
          if (mode && (!best || hd < best.d)) best = { mode, d: hd, id: tg.id, tg };
        }
        // TEAM friendly stagger: rock the nearest ally the beam passed through (no damage), provided the
        // beam reached them before whatever it actually hit — a strong round staggers, a light one chips.
        if (friendHit && (!best || friendHit.d <= best.d) && shotImpact > 0 && Number.isFinite(friendHit.tg.poise) && friendHit.tg.staggerT == null) {
          friendHit.tg.poise -= shotImpact * boostStunFactor(friendHit.tg);
          if (friendHit.tg.poise <= 0) armReaction(friendHit.tg, 'stagger');
        }
        if (best) {
          const tg = best.tg;
          // ANATOMICAL impact point (2026-08-13): the hit lands where the aim ray meets the target,
          // `best.d` along the ray — the egg-entry point for a core hit (chest/torso for center-mass),
          // NOT the target's FEET origin (`transform.pos`, z≈0), which made every impact fx + beam bolt
          // terminate at the legs. Purely the visual/impact anchor (damage/poise are unchanged below).
          const hitPt = [origin[0] + aim[0] * best.d, origin[1] + aim[1] * best.d, origin[2] + aim[2] * best.d];
          e.lastShot = { mode: best.mode, targetId: best.id, t: state.time, from, to: hitPt, charged: chargedShot };
          tg.hitFlash = state.time; tg.hits = (tg.hits || 0) + 1;
          tg.lastHitBy = e.id;   // match-layer attribution: the most recent hitter takes the kill credit
          if (mst) mst.hits += 1;   // score screen: the round connected (a shield catch still counts on-target)
          // R19: a frontal shield EATS the shot (drains its HP by the shot's damage, no hp/poise; a
          // break staggers). Shield HP is in hp points, so a 100-hp shield takes ~5 damage-20 rifle hits.
          if (absorbShield(tg, origin, shotDamage, state)) {
            /* absorbed by the shield */
          } else {
          // damage is just numbers: chip hp (floored at 0; the target survives at 0 for this spike).
          if (tg.body && Number.isFinite(tg.body.hp)) {
            const hp0 = tg.body.hp;
            tg.body.hp = Math.max(0, tg.body.hp - shotDamage);
            if (mst) mst.dmg += hp0 - tg.body.hp;   // hull damage actually dealt (overkill clamped away)
          }
          // poise is the mechanic: chip it, and when it BREAKS (<=0) the target STAGGERS — a rooted
          // lurch (stepReaction plays the `stagger` clip and blocks its verbs until it recovers). Poise
          // refills to max on the break so it is a threshold, not a drain; hits mid-stagger don't re-trigger.
          // A killing shot (hp floored) floors it regardless (armReaction's kill override → downed)
          // — checked SEPARATELY from the poise chip (arena M1 fix): a low-impact round can kill
          // without breaking poise, and the old else-if left such a target standing at 0 hp.
          if (Number.isFinite(tg.poise) && tg.staggerT == null && shotImpact > 0) {
            tg.poise -= shotImpact * boostStunFactor(tg);   // R23 boost armor halves the chip while boosting
            if (tg.poise <= 0) armReaction(tg, 'stagger');
          }
          if (tg.body && Number.isFinite(tg.body.hp) && tg.body.hp <= 0) {
            armReaction(tg, 'stagger');   // kill → downed even without a poise break
          }
          }
        } else {
          // miss (or blocked by cover): stop the tracer AT the wall if the aim ray hits one, else fly to range.
          const far = [origin[0] + aim[0] * shotRange, origin[1] + aim[1] * shotRange, origin[2] + aim[2] * shotRange];
          const wt = nearestWallT(from, far, state.colliders);
          e.lastShot = { mode: 'miss', t: state.time, from, to: wt != null ? lerp3(from, far, wt) : far, charged: chargedShot };
        }
      }
    }
    if (w.ammo <= 0 && !w.reloading) { w.reloading = true; w.reloadT = w.reload; }   // auto-reload on empty
  }

  // stepProjectiles(state, dt) — advance every in-flight round (R14) and adjudicate its BURST. A round
  // is a plain record in state.projectiles (spawned by stepWeapon's lob branch); this integrates it
  // under gravity and bursts it on the FIRST of: a hittable contact (after armTime, so it clears the
  // owner's own muzzle), the ground plane (z<=0), or its fuse. A burst is an UNCONDITIONAL poise-break
  // on every hittable within splashRadius (owner excluded) — the direct hit is just the d~0 splash case,
  // so "staggers on hit AND on splash" is one path. Pure + deterministic (fixed dt Euler → identical
  // arcs/bursts), so it replays byte-identical and tests headless. Bursts push an fx record the renderer
  // reads; the list is trimmed to the last ~1s so it never grows unbounded.
  function stepProjectiles(state, dt) {
    const ps = state.projectiles;
    if (ps && ps.length) {
      for (let i = ps.length - 1; i >= 0; i -= 1) {
        const p = ps[i];
        p.age += dt;
        const prev = [p.pos[0], p.pos[1], p.pos[2]];   // travel segment start (for the wall-hit test)
        p.vel[2] -= (p.gravity || 0) * dt;
        p.pos[0] += p.vel[0] * dt; p.pos[1] += p.vel[1] * dt; p.pos[2] += p.vel[2] * dt;
        let hitId = null;
        if (p.age >= (p.armTime || 0)) {
          // CONTACT vs the tall EGG column (not a feet-point ball — a flat shell flies at body
          // height), SWEPT along this tick's whole travel segment: a fast bazooka round crosses a
          // suit's egg width in ONE fixed step, so a single end-point sample can tunnel straight
          // through a target that walked onto the line (real since the R20 ai hunters move).
          // Deterministic sub-sampling at half the target's lateral radius, capped; the burst
          // centers on the CONTACT sample, not the overshot step end.
          // PROXIMITY FUZE (p.prox > 0): the detection radius is padded by the fuze distance, so
          // the round bursts as it PASSES a body — the burst point is the near-miss sample and
          // the (larger) splash reaches the target. Contact rounds keep the bare radius.
          const segLen = Math.hypot(p.pos[0] - prev[0], p.pos[1] - prev[1], p.pos[2] - prev[2]);
          const detR = (p.projRadius || 0) + (p.prox || 0);
          for (const tg of state.entities) {
            if (tg.id === p.owner || tg.invincible || !(tg.body && tg.body.hittable)) continue;   // i-frames take no hits
            const stepLen = Math.max(latR(tg) * 0.5, 1e-3);
            const n = Math.min(24, Math.max(1, Math.ceil(segLen / stepLen)));
            let hitPt = null;
            for (let k2 = 1; k2 <= n && !hitPt; k2++) {
              const pt = lerp3(prev, p.pos, k2 / n);
              let hit;
              if (tg.body.egg) hit = pointInEgg(pt, tg, detR);
              else { const v = sub(tg.transform.pos, pt); hit = Math.hypot(v[0], v[1], v[2]) <= (tg.body.radius || 0.5) + detR; }
              if (hit) hitPt = pt;
            }
            if (hitPt) { hitId = tg.id; p.pos[0] = hitPt[0]; p.pos[1] = hitPt[1]; p.pos[2] = hitPt[2]; break; }
          }
        }
        // COVER: the round bursts where its travel segment first crosses a solid box (a shell into a
        // wall detonates on the wall — its splash still catches anything hugging the far side within range).
        let wall = false;
        if (p.age >= (p.armTime || 0) && state.colliders) {
          const wt = nearestWallT(prev, p.pos, state.colliders);
          if (wt != null) { const hp = lerp3(prev, p.pos, wt); p.pos[0] = hp[0]; p.pos[1] = hp[1]; p.pos[2] = hp[2]; wall = true; }
        }
        const ground = p.pos[2] <= 0;
        if (hitId != null || ground || wall || p.age >= (p.fuse || 4)) {
          if (ground) p.pos[2] = 0;
          burstProjectile(state, p);
          ps.splice(i, 1);
        }
      }
    }
    // trim spent burst fx records (renderer reads new ones each frame; they live ~1s)
    const bs = state.bursts;
    if (bs && bs.length) {
      for (let i = bs.length - 1; i >= 0; i -= 1) if (state.time - bs[i].t > 1) bs.splice(i, 1);
    }
    // melee clash records (the spark seam) trim on the same clock
    const cl = state.clashes;
    if (cl && cl.length) {
      for (let i = cl.length - 1; i >= 0; i -= 1) if (state.time - cl[i].t > 1) cl.splice(i, 1);
    }
  }

  // burstProjectile(state, p) — the AoE poise-break. Every hittable within splashRadius (owner excluded)
  // takes an unconditional stagger (refill poise + arm the lurch, like a melee connect) and `damage` off
  // hp. Emits a burst fx record for the renderer.
  function burstProjectile(state, p) {
    const R = Math.max(p.splashRadius || 0, p.projRadius || 0);
    const ownerTeam = state.byId && p.owner ? (state.byId[p.owner] && state.byId[p.owner].team) : null;   // TEAM: friendly-fire read
    for (const tg of state.entities) {
      if (tg.id === p.owner || tg.invincible || !(tg.body && tg.body.hittable)) continue;   // i-frames take no hits
      // SPLASH catches a target whose EGG is within R of the burst (a direct hit is trivially inside).
      if (tg.body.egg) { if (!pointInEgg(p.pos, tg, R)) continue; }
      else { const v = sub(tg.transform.pos, p.pos); if (Math.hypot(v[0], v[1], v[2]) > R + (tg.body.radius || 0.5)) continue; }
      // TEAM friendly stagger: an ally caught in the blast is ROCKED, not hurt — no hp/shield/attribution,
      // just the poise break (if not already reacting). Careless explosives cost tempo, never a team-kill.
      if (ownerTeam && tg.team && tg.team === ownerTeam) {
        if (Number.isFinite(tg.poise) && tg.staggerT == null) armReaction(tg, 'stagger');
        continue;
      }
      tg.hitFlash = state.time; tg.hits = (tg.hits || 0) + 1;
      tg.lastHitBy = p.owner;   // match-layer attribution (the round remembers its shooter)
      const mst = matchStat(state, p.owner);
      if (mst && !p.statHit) { p.statHit = true; mst.hits += 1; }   // one on-target credit per round, however wide the splash (accuracy stays ≤ 100%)
      // R19: a frontal shield eats the burst too (drains + a break staggers); a flank/rear burst bypasses.
      if (absorbShield(tg, p.pos, p.damage || 0, state)) continue;
      if (tg.body && Number.isFinite(tg.body.hp)) {
        const hp0 = tg.body.hp;
        tg.body.hp = Math.max(0, tg.body.hp - (p.damage || 0));
        if (mst) mst.dmg += hp0 - tg.body.hp;   // splash hull damage per caught target
      }
      // R23 BOOST ARMOR: a splash is a 100%-stun (worth a full poise bar) — normally an
      // UNCONDITIONAL stagger. Against a boosting suit with boost armor it becomes a scaled poise
      // CHIP instead (poiseMax × factor), so one bazooka shell no longer floors a boosting suit in
      // a single hit; a killing burst still floors (armReaction's kill override), and a suit with
      // no armor / not boosting keeps the classic unconditional break.
      // IMPACT-BURST (opt-in `weapon.impact` on a lob — the grenade): the burst is a poise CHIP of
      // `impact` (still scaled by boost armor), NOT a guaranteed break — so a lone grenade no longer
      // staggers; it softens poise and only floors an already-hit target. Bazookas carry no impact →
      // the classic unconditional break. A killing burst floors either way.
      const f = boostStunFactor(tg);
      const killed = tg.body && Number.isFinite(tg.body.hp) && tg.body.hp <= 0;
      if (killed) {
        armReaction(tg, 'stagger');
      } else if (p.impact > 0) {
        if (Number.isFinite(tg.poise) && tg.staggerT == null) {
          tg.poise -= p.impact * f;
          if (tg.poise <= 0) armReaction(tg, 'stagger');
        }
      } else if (f >= 1 || !(Number.isFinite(tg.poise) && tg.staggerT == null)) {
        armReaction(tg, 'stagger');   // ranged/splash always STAGGERS; only the back cleave topples
      } else {
        tg.poise -= tg.poiseMax * f;
        if (tg.poise <= 0) armReaction(tg, 'stagger');
      }
    }
    state.bursts.push({ seq: state.burstSeq++, pos: p.pos.slice(), t: state.time, radius: R, fxColor: p.fxColor, fxScale: p.fxScale });
  }

  // R20.3: passive weapon timers tick for EVERY carried weapon, every frame — stowed loadout
  // slots keep reloading / cooling down, and a stagger doesn't pause the autoloader. (With a
  // loadout, e.weapon aliases a loadoutWeapons entry, so only one of the two paths runs.)
  // R20.5: the melee swing cooldown is the same kind of machinery — drains between swings,
  // through staggers, stows, and pilot transfers alike; so are the dodge recovery (2026-07-27)
  // and the switch ready-time (2026-07-28 — ticks even mid-reload, the windows overlap).
  E.registerEntityTimer('weapon-and-cooldowns', (e, dt) => {
    if (e.loadoutWeapons) { for (const lw of e.loadoutWeapons) tickWeapon(lw, dt); }
    else if (e.weapon) tickWeapon(e.weapon, dt);
    if (e.swingT == null && e.strikeCdT > 0) e.strikeCdT = Math.max(0, e.strikeCdT - dt);
    if (e.dodgeT == null && e.dodgeCdT > 0) e.dodgeCdT = Math.max(0, e.dodgeCdT - dt);
    if (e.tackleT == null && e.tackleCdT > 0) e.tackleCdT = Math.max(0, e.tackleCdT - dt);   // ai NEWTYPE tackle-guard re-charge
    if (e.readyT > 0) e.readyT = Math.max(0, e.readyT - dt);
  }, 10);

  // fire AFTER the rule (aim reads the updated heading/pitch). Input is GLOBAL, so an armed
  // pilotable suit only consumes the trigger while it IS the pilot — the vacated suit must
  // not drain its magazine (or land hits) every time the piloted one fires. An AI-ruled
  // entity fires from its OWN trigger (`e.aiFire`, the ai rule's decision) and NEVER from
  // the global input — the no-ghost-fire invariant kept in both directions. A DROPPING suit
  // can't fire (control is suppressed mid-air), so its spawn guard can't break until it lands.
  E.registerEntityAction('weapon', (e, input, dt, state, world, owns) => {
    const suppressed = owns.reaction || owns.drop || owns.clash || owns.cine;
    const firesForPilot = !e.pilotable || state.pilotId === e.id;
    if (e.weapon && !suppressed && e.rule && e.rule.type === 'ai') stepWeapon(e, { fire: e.aiFire ? 1 : 0 }, dt, state);
    else if (e.weapon && !suppressed && e.tackleT == null && firesForPilot) stepWeapon(e, input, dt, state);   // a tackle owns the body — no firing mid-charge
  }, 10);
  // a body owner (reaction / drop / clash / cine) interrupts a held weapon charge.
  registerEntityAssert('charge-cancel', (e, dt, owns) => {
    if (e.weapon && (owns.reaction || owns.drop || owns.clash || owns.cine)) cancelWeaponCharge(e.weapon);
  }, 10);
  // R14: advance in-flight projectiles + adjudicate bursts (after all entities move, before cameras).
  // Also lazily seeds the fx pools on legacy states (projectiles/bursts here, clashes for melee).
  registerWorldPass('projectiles', (state, input, dt) => {
    if (!state.projectiles) { state.projectiles = []; state.bursts = []; state.projSeq = 0; state.burstSeq = 0; }
    if (!state.clashes) { state.clashes = []; state.clashSeq = 0; }   // melee-clash-fx pool (legacy states)
    if (state.shieldBreaks == null) state.shieldBreaks = 0;
    stepProjectiles(state, dt);
  }, 30);

  Object.assign(E, { initWeapon, cancelWeaponCharge, tickWeapon, stepWeapon, stepProjectiles, burstProjectile });
}
