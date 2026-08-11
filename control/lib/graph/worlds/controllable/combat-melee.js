/**
 * combat-melee.js — melee adjudication + the paired set pieces (controllable-split.plan.md, S2).
 * meleeSwingSpec (the shared swing spec — player strike and ai melee-seek stamp IDENTICAL
 * numbers), stepMelee (contact-window connects, team stagger, the clash trigger), the CLASH
 * event (blade-lock + shove-apart), stepTackle (the invincible body-check), the TACKLE COUNTER
 * (charge beats swing → topple + boost refund), and the shove-down CINEMATIC (a two-suit owned-
 * body lock the follow camera frames from the side).
 *
 * BUILDER CONTRACT (compose.js): import-free inside the function; combat-hit + combat-match
 * precede this in EMISSION (armReaction / matchStat / latR / hullZ destructured at build time).
 * Field ownership: e.strikeParams/swingT/swingClip/struckThisSwing/lastStrike/meleeHitCount,
 * e.clash*, e.tackleHits/tackleHitCount/tackleCounterHit, e.cine*, state.clashes/clashSeq,
 * state.cinematic.
 */

export function buildCombatMelee(E) {
  const { sub, fwdXY, armReaction, matchStat, latR, hullZ, registerBodyOwner, breakGuards } = E;

  const SIDE_STRIKE_YAW = 50 * Math.PI / 180;   // a left/right melee cut yaws its hitbox this far to its side
  // meleeSwingSpec(sc, r, swingDir, comboEquipped) — the swing CLIP name + the `strikeParams` block that
  // stepMelee reads to adjudicate a connect (reach / cone / contact window / damage / topple). Extracted
  // so the PLATFORM strike (player) and the AI melee-seek stamp IDENTICAL numbers from a melee config
  // (`sc` = the active loadout slot or the rule). Pure — same inputs, same block.
  function meleeSwingSpec(sc, r, swingDir, comboEquipped) {
    const sv = (sc.strikeVerbs && sc.strikeVerbs[swingDir]) || {};
    const contact = sv.strikeContact || sc.strikeContact || r.strikeContact;
    return {
      // a verb may claim its OWN clip set (operator 2026-08-10, geof heat rod): the whip's side
      // sweeps ride the standard `swing` set (the saber side cut) while forward/down keep the
      // `whip` clips. Absent per-verb swingSet → the slot set → 'swing', byte-identical.
      clip: `${sv.swingSet || sc.swingSet || 'swing'}_${swingDir}`,
      params: {
        reach: sv.strikeReach ?? sc.strikeReach ?? r.strikeReach ?? (r.speed ?? 6),
        damage: sv.strikeDamage ?? sc.strikeDamage ?? r.strikeDamage ?? 0,
        impact: sv.strikeImpact ?? sc.strikeImpact ?? r.strikeImpact ?? 0,
        eye: sc.strikeEye ?? r.eye ?? 0,
        cosCone: Math.cos((sv.strikeCone ?? sc.strikeCone ?? r.strikeCone ?? 70) * Math.PI / 180),
        combo: comboEquipped,
        from: contact && contact[0] != null ? contact[0] : 0.28,
        to: contact && contact[1] != null ? contact[1] : 0.62,
        topple: sv.topple === true || (sv.topple !== false && swingDir === 'back'),
        aimYaw: sv.strikeYaw != null ? sv.strikeYaw * Math.PI / 180
          : swingDir === 'left' ? SIDE_STRIKE_YAW : swingDir === 'right' ? -SIDE_STRIKE_YAW : 0,
        // spark tint/size for the renderer's clash channel — the melee analog of a ranged
        // weapon's fxColor/fxScale ({ color, scale }); null → the renderer's default clash read.
        fx: sv.strikeFx ?? sc.strikeFx ?? r.strikeFx ?? null,
      },
    };
  }

  // stepMelee — the melee analog of stepWeapon (the swing analog the ranged targeting computer
  // never had). While a swing is inside its CONTACT window (a fraction of the clip — the
  // downstroke, not the wind-up or recovery), the blade adjudicates against every hittable target
  // that is IN FRONT and within reach, ONCE per target per swing. A connect flashes the target,
  // chips hp/poise exactly like a shot (so a saber can stagger the same enemy a rifle can), and
  // increments meleeHitCount — the audio channel reads that edge and plays the impact clash. Reach
  // and the numbers ride e.strikeParams, stamped from the active strike config at swing start.
  // Pure + deterministic like stepWeapon (fixed input+dt → identical connects).
  // beginClash(a, b, state) — the CLASH EVENT (2026-07-28): two units melee'd into each other
  // at the same time and the blades MET. The exchange trades damage for THEATER: the pair is
  // repositioned face-to-face at a blade-lock gap (proportional to their combined reach), both
  // hold the forward-thrust swing INVINCIBLE for ~0.9s while sparks pulse off the cross, then
  // stepClash SHOVES them apart and hands both bodies back to their rules — no damage, no
  // stagger, no cooldown ("separated and free to move again"; an immediate re-engage can clash
  // again, which is the fantasy). Deterministic — pure geometry of the pair; the initiator
  // carries `clashLead` so the spark pulses emit exactly once per pair.
  function beginClash(a, b, state) {
    const Pa = a.strikeParams, Pb = b.strikeParams;
    const gap = (((Pa && Pa.reach) || 6) + ((Pb && Pb.reach) || 6)) * 0.45;
    const pa = a.transform.pos, pb = b.transform.pos;
    const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
    let ux = pb[0] - pa[0], uy = pb[1] - pa[1];
    const ul = Math.hypot(ux, uy) || 1e-6; ux /= ul; uy /= ul;
    pa[0] = mx - ux * gap / 2; pa[1] = my - uy * gap / 2;
    pb[0] = mx + ux * gap / 2; pb[1] = my + uy * gap / 2;
    a.transform.heading = Math.atan2(uy, ux);   // square up: each faces the other across the lock
    b.transform.heading = Math.atan2(-uy, -ux);
    const cz = (hullZ(a) + hullZ(b)) / 2;
    for (const u of [a, b]) {
      u.clashT = 0; u.clashDur = 0.9; u.clashGap = gap;
      u.clashSpark = [mx, my, cz];
      u.swingT = null; u.swingCombo = false; u.comboT = 0;   // the lock consumes both swings
      u.vel[0] = 0; u.vel[1] = 0;
    }
    a.clashLead = true; b.clashLead = false;
    // the opening burst: a BIG shower at the blade cross (`n` = renderer spark count)
    state.clashes.push({ seq: state.clashSeq++, pos: [mx, my, cz], dir: null, t: state.time, fxColor: null, fxScale: 4, n: 40 });
  }

  // stepClash(e, dt, state) — advance a clash lock (run beside stepReaction in the entity loop;
  // returns true while it OWNS the body — rule + weapon suppressed, like a stagger). The suit
  // thrusts into the cross and HOLDS it (swing_forward, phase frozen at the lunge peak),
  // invincible; the lead side pulses a fresh spark record every ~0.22s at the fixed lock point
  // (both suits are rooted, so it stays true). At the end each is shoved HALF A GAP straight
  // back — the separation — and freed.
  function stepClash(e, dt, state) {
    if (e.clashT == null) return false;
    const dur = e.clashDur || 0.9;
    const t0 = e.clashT * dur;
    e.clashT += dt / dur;
    e.invincible = true;
    e.locomotion = 'swing_forward'; e.moving = true;
    e.gaitPhase = Math.min(0.45, e.clashT * 1.6);   // thrust IN, then hold the crossed-blades frame
    if (e.clashLead && e.clashSpark && Math.floor((e.clashT * dur) / 0.22) > Math.floor(t0 / 0.22)) {
      state.clashes.push({ seq: state.clashSeq++, pos: e.clashSpark.slice(), dir: null, t: state.time, fxColor: null, fxScale: 3, n: 18 });
    }
    if (e.clashT >= 1) {
      const back = (e.clashGap || 6) * 0.5;
      e.transform.pos[0] -= Math.cos(e.transform.heading) * back;
      e.transform.pos[1] -= Math.sin(e.transform.heading) * back;
      e.clashT = null; e.clashLead = false; e.invincible = false;
      e.locomotion = 'forward'; e.moving = false; e.gaitPhase = 0;
      // POST-CLASH BREAK (ai, opt-out `r.clashRetreat === false`): crossing blades ENDS the
      // melee exchange — instead of instantly re-clashing, the suit DISENGAGES: it reverts to shooting
      // (reuses the melee give-up window → ranged rotation) and flags a dash-away the brain fires next
      // frame. Turns a clash into a reset-and-reposition beat rather than a lock. Space too
      // (2026-08-04): without it, space melee-seek re-clashed forever — the roll-out-and-reengage
      // beat is exactly the anti-loop.
      const er = e.rule;
      if (er && er.type === 'ai' && er.clashRetreat !== false) {
        e.meleeGiveUpT = er.meleeGiveUp ?? 4;
        e.clashRetreat = true;
      }
    }
    return true;
  }

  function stepMelee(e, dt, state) {
    const P = e.strikeParams;
    if (e.swingT == null || !P) return;
    if (e.swingT < P.from || e.swingT > P.to) return;
    // aim = forward, YAWED toward the swing side for left/right cuts (P.aimYaw) so
    // the hitbox lands where the blade travels, not straight ahead.
    const t = e.transform, aim = fwdXY(t.heading + (P.aimYaw || 0));
    const origin = [t.pos[0], t.pos[1], t.pos[2] + P.eye];
    for (const tg of state.entities) {
      if (tg === e || tg.invincible || !(tg.body && tg.body.hittable)) continue;   // i-frames (dodge / getup) take no hits
      if (e.struckThisSwing[tg.id]) continue;
      const v = sub(tg.transform.pos, origin);
      const d = Math.hypot(v[0], v[1], v[2]);
      if (d < 1e-3 || d > P.reach + latR(tg)) continue;   // R19: egg width (melee BYPASSES the shield)
      const flat = Math.hypot(v[0], v[1]) || 1e-6;
      if ((v[0] * aim[0] + v[1] * aim[1]) / flat < P.cosCone) continue;   // the swing lands in FRONT of the suit
      // TEAM friendly stagger: a swing that catches an ally rocks them (no damage, no clash, no
      // attribution) — friendly fire is off, but a wild blade still staggers a teammate in the arc.
      if (e.team && tg.team && tg.team === e.team) {
        e.struckThisSwing[tg.id] = true;
        if (Number.isFinite(tg.poise) && tg.staggerT == null) armReaction(tg, 'stagger');
        continue;
      }
      // CLASH EVENT (2026-07-28): the struck target is ITSELF mid-melee — a live swing carrying
      // strike params (a throw's swing carries none) and not already reeling. The blades MEET
      // instead of landing: no damage either way — beginClash locks the pair, and the lock
      // consumes THIS swing outright (no further targets this swing).
      if (tg.swingT != null && tg.strikeParams && tg.staggerT == null) {
        e.struckThisSwing[tg.id] = true;
        beginClash(e, tg, state);
        break;
      }
      e.struckThisSwing[tg.id] = true;
      e.meleeHitCount = (e.meleeHitCount || 0) + 1;
      e.lastStrike = { targetId: tg.id, t: state.time };
      tg.hitFlash = state.time; tg.hits = (tg.hits || 0) + 1;
      tg.lastHitBy = e.id;   // match-layer attribution
      // CLASH fx record (melee-clash-fx) — the spark seam: seq-keyed like state.bursts so the
      // renderer edge-detects it. The contact point sits on the target's hull FACING the attacker
      // (its egg's lateral radius back along the strike line), at the strike plane's height when
      // the config declares one (strikeEye > 0) — else at the target's hull CENTER (egg c, or the
      // legacy sphere radius): the suits adjudicate melee from a feet-height plane (P.eye 0), and
      // sparks at the feet would lie about where the blade meets the armor. `dir` is the hull
      // facing (unit XY, target → attacker) so the spray can shear back toward the swing;
      // tint/size ride the strike config's strikeFx (P.fx).
      const lr = Math.min(latR(tg), flat);
      const clashZ = P.eye > 0 ? origin[2] : hullZ(tg);
      state.clashes.push({
        seq: state.clashSeq++,
        pos: [tg.transform.pos[0] - (v[0] / flat) * lr, tg.transform.pos[1] - (v[1] / flat) * lr, clashZ],
        dir: [-v[0] / flat, -v[1] / flat],
        t: state.time,
        fxColor: P.fx && P.fx.color != null ? P.fx.color : null,
        fxScale: P.fx && P.fx.scale != null ? P.fx.scale : null,
      });
      const mst = matchStat(state, e.id);
      if (tg.body && Number.isFinite(tg.body.hp)) {
        const hp0 = tg.body.hp;
        tg.body.hp = Math.max(0, tg.body.hp - P.damage);
        if (mst) mst.dmg += hp0 - tg.body.hp;   // melee hull damage counts toward the score; accuracy stays ranged-only
      }
      // melee ALWAYS breaks poise on connect (operator: a melee hit is a
      // guaranteed poise-break, not a threshold chip like ranged fire). WHICH
      // reaction it arms: only a TOPPLE-flagged verb knocks down (P.topple,
      // stamped at swing start — defaults to the `back` great-cleave, and a
      // strikeVerbs table can claim it for other verbs, e.g. the whip's
      // downswing). On a COMBO-equipped slot (R20.4 refined) only as the TIMED
      // FOLLOW-UP (e.swingCombo): land a hit, then S+click inside the window.
      // A plain back cleave on a combo slot staggers like any other swing; a
      // combo-less slot (the z heat axe) keeps the R15 always-topple cleave.
      // Topples pass force so they UPGRADE a target still reeling from the
      // opener — the combo's payoff. A killing blow floors it either way
      // (armReaction's kill override).
      const topples = (P.topple != null ? !!P.topple : e.swingClip === 'swing_back') && (P.combo ? !!e.swingCombo : true);
      armReaction(tg, topples ? 'topple' : 'stagger', topples);
    }
  }

  // stepTackle — the hit adjudicator for the TACKLE dash (the platform rule's `r.tackle` maneuver;
  // run in stepWorld beside stepMelee while `e.tackleT != null`). A moving CONTACT box carried by
  // the charging suit: any hittable IN FRONT and within `tackleReach` (egg-inclusive) that is not
  // invincible / not an ally takes a SMALL chip (`tackleDamage`, default 15) and an UNCONDITIONAL
  // stagger (armReaction 'stagger' — never a topple; the operator's "staggers on hit"), ONCE per
  // target per tackle (`e.tackleHits`), and the tackle PLOWS ON (it does not stop on a connect, so
  // a charge through a knot of suits staggers each). An impact spark rides the shared clash channel
  // (the renderer + audio edge-detect it). Pure + deterministic like stepMelee. The tackler is NOT
  // spent on the hit — it stays invincible for the whole dash (that stays owned by the rule).
  function stepTackle(e, dt, state) {
    if (e.tackleT == null) return;
    const r = e.rule;
    const reach = r.tackleReach ?? 8;
    const dmg = r.tackleDamage ?? 15;
    const cosCone = Math.cos((r.tackleCone ?? 70) * Math.PI / 180);
    const t = e.transform, aim = fwdXY(t.heading);
    const origin = [t.pos[0], t.pos[1], t.pos[2] + (r.eye ?? 0)];
    if (!e.tackleHits) e.tackleHits = {};
    // STOP-ON-CONTACT: the charge HALTS on the first suit it rams — the dash ends, control returns to
    // the pilot, and the tackle i-frames drop (invincibility ends when the user gets control again).
    // The one exception is the counter CINEMATIC: if beginTackleCounter kicked off the shove-down set
    // piece (e.cineT set), that owns the body and manages its OWN invincibility, so we leave it be.
    const endTackle = () => { e.tackleT = null; e.tackleDir = null; if (e.cineT == null) e.invincible = false; };
    for (const tg of state.entities) {
      if (tg === e || tg.invincible || !(tg.body && tg.body.hittable)) continue;   // i-frames / non-hittable skip
      if (e.tackleHits[tg.id]) continue;                                            // once per target per tackle
      const v = sub(tg.transform.pos, origin);
      const d = Math.hypot(v[0], v[1], v[2]);
      if (d < 1e-3 || d > reach + latR(tg)) continue;                               // egg-inclusive contact range
      const flat = Math.hypot(v[0], v[1]) || 1e-6;
      if ((v[0] * aim[0] + v[1] * aim[1]) / flat < cosCone) continue;               // in FRONT of the charge
      // TEAM friendly fire (matches melee / ranged / splash): ramming a teammate ROCKS them — a plain
      // STAGGER, never damage, never the COUNTER (topple + boost reset) and never attribution. Gated
      // BEFORE the counter + the damage path, so allies only ever get the harmless rock ("no friendly
      // fire, but stagger applies"). Non-team modes (solo / FFA — no `team` tags) have no allies to skip.
      if (e.team && tg.team && tg.team === e.team) {
        e.tackleHits[tg.id] = true;
        if (Number.isFinite(tg.poise) && tg.staggerT == null) armReaction(tg, 'stagger');
        endTackle(); return;   // STOP on the ally it bumped (rocked, unhurt)
      }
      // TACKLE COUNTER: the rammed target is MID-MELEE — a live swing carrying strike params (a
      // throw carries none), not already reeling. The CHARGE BEATS the swing: beginTackleCounter
      // TOPPLES the caught melee suit (→ the usual getup) and REWARDS the tackler with a boost reset
      // (and, for the pilot, kicks off the shove-down cinematic). The tackle STOPS on this contact.
      if (tg.swingT != null && tg.strikeParams && tg.staggerT == null) {
        e.tackleHits[tg.id] = true;
        beginTackleCounter(e, tg, state);
        endTackle(); return;   // STOP on the countered suit (a cinematic, if it began, keeps its own i-frames)
      }
      e.tackleHits[tg.id] = true;
      e.tackleHitCount = (e.tackleHitCount || 0) + 1;   // audio/impact edge (the body-check thud)
      tg.hitFlash = state.time; tg.hits = (tg.hits || 0) + 1; tg.lastHitBy = e.id;
      // impact spark on the target's hull facing the charge (reuse the melee-clash-fx seam)
      const lr = Math.min(latR(tg), flat);
      const cz = hullZ(tg);
      state.clashes.push({
        seq: state.clashSeq++,
        pos: [tg.transform.pos[0] - (v[0] / flat) * lr, tg.transform.pos[1] - (v[1] / flat) * lr, cz],
        dir: [-v[0] / flat, -v[1] / flat], t: state.time, fxColor: null, fxScale: null,
      });
      const mst = matchStat(state, e.id);
      if (Number.isFinite(tg.body.hp)) {
        const hp0 = tg.body.hp;
        tg.body.hp = Math.max(0, tg.body.hp - dmg);
        if (mst) mst.dmg += hp0 - tg.body.hp;
      }
      armReaction(tg, 'stagger');   // staggers on hit (a kill still floors it — armReaction's kill override)
      endTackle(); return;   // STOP on the suit it rammed — the charge doesn't plow on
    }
  }

  // beginTackleCounter(tackler, victim, state) — the TACKLE COUNTER (the special event when a tackle
  // rams a suit MID-MELEE). Rock-paper-scissors: a CHARGE BEATS a swing. The tackle catches the melee
  // suit committed to its wind-up and STUFFS it — asymmetric, the TACKLER wins outright:
  //   • the VICTIM (the one swinging) is TOPPLED (armReaction 'topple', forced) — its swing cancelled,
  //     knocked flat, then the shared getup primitive stands it back up (the usual knockdown → get-up
  //     chain, run invincible by stepReaction). "the attacker gets stuffed by the tackle."
  //   • the TACKLER is REWARDED with a BOOST RESET — the gauge refilled to full and the overheat lock
  //     cleared, refunding the whole tackle cost — but ONLY on a landed counter ("only if tackle counter
  //     connects"). Its dash CONTINUES (it plowed through and won). A normal tackle (into a non-melee
  //     target) still just staggers and keeps the gauge dumped — the refund is the read's payoff.
  // No damage by default (so the topple → getup plays out); opt-in `counterDamage` on the TACKLER's rule
  // chips the victim if a world wants the stuff to bite. A big spark pours off the contact (the shared
  // clash-fx seam). Deterministic — pure geometry + the reaction primitives.
  function beginTackleCounter(tackler, victim, state) {
    armReaction(victim, 'topple', true);   // the swinging suit is STUFFED → topple → the usual getup logic
    victim.swingT = null; victim.swingCombo = false; victim.comboT = 0; victim.struckThisSwing = {};   // consume its swing
    victim.lastHitBy = tackler.id;
    victim.hitFlash = state.time; victim.hits = (victim.hits || 0) + 1;
    const dmg = (tackler.rule && tackler.rule.counterDamage) || 0;
    if (dmg > 0 && victim.body && Number.isFinite(victim.body.hp)) {
      const hp0 = victim.body.hp;
      victim.body.hp = Math.max(0, victim.body.hp - dmg);
      const mst = matchStat(state, tackler.id); if (mst) mst.dmg += hp0 - victim.body.hp;
      if (victim.body.hp <= 0) { if (victim.noDestroy && Number.isFinite(victim.hpMax)) victim.body.hp = victim.hpMax; else victim.downed = true; }   // a lethal stuff still floors it (getup skipped by stepReaction); practice refills instead
    }
    // the TACKLER wins: BOOST RESET — refill the gauge + clear the overheat, refunding the tackle cost.
    const boostMax = (tackler.rule && tackler.rule.boostMax > 0) ? tackler.rule.boostMax : 0;
    if (boostMax > 0) { tackler.boost = boostMax; tackler.boostLock = false; }
    tackler.tackleCounterHit = (tackler.tackleCounterHit || 0) + 1;   // audio/fx edge (the stuffing + gauge chime)
    // CINEMATIC (tackle-cinematic.plan.md): when the PLAYER is in the counter and a camera exists, the
    // shove-down set piece takes over the positioning + animation — skip the classic fling. Otherwise fling.
    if (state.pilotId && (tackler.id === state.pilotId || victim.id === state.pilotId) && state.camera && state.cinematic == null) {
      beginTackleCinematic(tackler, victim, state);
      return;
    }
    const pv = victim.transform.pos, pt = tackler.transform.pos;
    let ux = pv[0] - pt[0], uy = pv[1] - pt[1]; const ul = Math.hypot(ux, uy) || 1e-6; ux /= ul; uy /= ul;
    victim.transform.heading = Math.atan2(-uy, -ux);   // the stuffed suit is flung facing back up the charge line
    const cz = hullZ(victim);
    state.clashes.push({ seq: state.clashSeq++, pos: [pv[0], pv[1], cz], dir: [ux, uy], t: state.time, fxColor: null, fxScale: 4, n: 40 });
  }

  // ── TACKLE-COUNTER CINEMATIC (tackle-cinematic.plan.md) — the shove-down set piece ─────────────
  // Modeled on beginClash/stepClash: a two-suit, timed, INVINCIBLE, rooted-pose lock. stepTackleCine
  // OWNS the body (rule/weapon/ai suppressed) while it runs; the follow rule reads world.cinematic to
  // swing to a SIDE view of the pair. Engine-only — poses are locomotion/gaitPhase, the camera is
  // engine-driven. The rest of the battle keeps stepping.
  const CINE_DUR = 4.5;
  function beginTackleCinematic(tackler, victim, state) {
    for (const u of [tackler, victim]) {   // the cinematic owns both suits — clear every transient combat state
      u.tackleT = null; u.tackleDir = null; u.tackleHits = {};
      u.swingT = null; u.swingCombo = false; u.comboT = 0; u.struckThisSwing = {};
      u.dodgeT = null; u.tumble = null; u.dodgeDir = null;
      u.staggerT = null; u.downPauseT = null; u.downed = false;   // the shove drives the descent, not a reaction
      u.vel[0] = 0; u.vel[1] = 0; if (u.vel.length > 2) u.vel[2] = 0;
    }
    // square up: the tackler grabs from the FRONT — pull it to grab distance facing the victim, which holds ground.
    const pv = victim.transform.pos, pt = tackler.transform.pos;
    let ux = pv[0] - pt[0], uy = pv[1] - pt[1]; const ul = Math.hypot(ux, uy) || 1e-6; ux /= ul; uy /= ul;
    const gap = (((tackler.collideVol && tackler.collideVol.a) || 2) + ((victim.collideVol && victim.collideVol.a) || 2)) * 1.05;
    pt[0] = pv[0] - ux * gap; pt[1] = pv[1] - uy * gap;
    tackler.transform.heading = Math.atan2(uy, ux);        // tackler faces the victim
    victim.transform.heading = Math.atan2(-uy, -ux);       // victim faces the tackler
    tackler.cineT = 0; tackler.cineDur = CINE_DUR; tackler.cineRole = 'shover'; tackler.cineLead = true; tackler.invincible = true;
    victim.cineT = 0; victim.cineDur = CINE_DUR; victim.cineRole = 'shoved'; victim.cineLead = false; victim.invincible = true;
    // pick the camera side so the view never swings across the axis (perp = (-uy, ux))
    let side = 1;
    if (state.camera) {
      const cp = state.camera.transform.pos, mx = (pt[0] + pv[0]) / 2, my = (pt[1] + pv[1]) / 2;
      side = ((cp[0] - mx) * (-uy) + (cp[1] - my) * ux) >= 0 ? 1 : -1;
    }
    state.cinematic = { a: tackler.id, b: victim.id, side };
    const cz = hullZ(victim);
    state.clashes.push({ seq: state.clashSeq++, pos: [pv[0], pv[1], cz], dir: [ux, uy], t: state.time, fxColor: null, fxScale: 3, n: 24 });
  }

  function stepTackleCine(e, dt, state) {
    if (e.cineT == null) return false;
    e.cineT += dt / (e.cineDur || CINE_DUR);
    e.invincible = true;
    const t = Math.min(1, e.cineT);
    if (e.cineRole === 'shover') {
      // hold the two-handed rifle-hold arms forward (the grab) — a static clip, no walk cycle — and
      // CREEP forward to stay at grab distance as the victim sinks (reads as leaning into the shove).
      e.locomotion = 'forward'; e.moving = false; e.gaitPhase = 0;
      const B = state.cinematic && state.byId[state.cinematic.b];
      if (B) {
        const dx = B.transform.pos[0] - e.transform.pos[0], dy = B.transform.pos[1] - e.transform.pos[1], dl = Math.hypot(dx, dy) || 1e-6;
        const gap = (((e.collideVol && e.collideVol.a) || 2) + ((B.collideVol && B.collideVol.a) || 2)) * 1.05;
        const over = dl - gap; if (over > 0.15) { e.transform.pos[0] += (dx / dl) * over * 0.12; e.transform.pos[1] += (dy / dl) * over * 0.12; }
      }
    } else {
      // the shoved suit stands idle for the first ~20% (the grab), then is SHOVED DOWN — the topple
      // clip driven 0→1 over the rest, held flat at the bottom.
      if (t < 0.2) { e.locomotion = 'forward'; e.moving = false; e.gaitPhase = 0; }
      else { e.locomotion = 'topple'; e.moving = true; e.gaitPhase = Math.min(1, (t - 0.2) / 0.7); }
    }
    if (e.cineT >= 1) {
      const wasShoved = e.cineRole === 'shoved';
      e.cineT = null; e.cineRole = null;
      if (e.cineLead) { e.cineLead = false; state.cinematic = null; }   // the lead clears the shared flag (camera eases back)
      if (wasShoved && Number.isFinite(e.poise)) {
        // RISE: hand the shoved suit to the shared getup primitive (invincible rise → back on its feet, rule resumes).
        e.staggerReturn = 'forward'; e.reactClip = 'getup'; e.reactDur = e.getupDur || (e.staggerDur || 1.3) * 1.4;
        e.staggerT = 0; e.downPauseT = null; e.locomotion = 'getup'; e.moving = true; e.gaitPhase = 0; e.invincible = true;
      } else {
        e.invincible = false; e.locomotion = 'forward'; e.moving = false; e.gaitPhase = 0;   // the tackler returns to control
      }
    }
    return true;
  }

  // melee connect adjudication (the saber swing) — note: NOT gated on a clash (beginClash
  // consumes the swings, so the gate never mattered; kept verbatim from the inline sequence).
  E.registerEntityAction('melee', (e, input, dt, state, world, owns) => {
    if (e.swingT != null && !owns.reaction && !owns.drop && !owns.cine) stepMelee(e, dt, state);
  }, 20);

  // TACKLE body-check adjudication (the shift dash)
  E.registerEntityAction('tackle', (e, input, dt, state, world, owns) => {
    if (e.tackleT != null && !owns.reaction && !owns.drop && !owns.clash && !owns.cine) stepTackle(e, dt, state);
  }, 30);

  // ── S4: the platform ACT phase — melee strike + throw ride the maneuver seam (the blocks that
  // were woven inline in the platform rule; ctx carries the frame locals they shared).
  E.registerPlatformManeuver('act', 'strike', (e, input, dt, world, ctx) => {
    const { space, probe, eye, f, sideIn, activeCfg, charging, kneeling, dodging, tackling } = ctx;
    let boosting = ctx.boosting;
    let swinging = ctx.swinging;
    const r = e.rule, t = e.transform;
    // MELEE STRIKE (opt-in `strike:'melee'` on the rule; fire = left mouse —
    // the SAME input the ranged weapon subsystem reads, so "click acts the
    // active weapon" holds across every armed unit: a unit carries either a
    // ranged `weapon` or melee swing clips, never both). The fire press EDGE
    // roots the entity and plays the swing clip ONCE — phase driven by TIME
    // (0→1 over `strikeDur` sec), not distance — then control returns to the
    // gait through the normal mix crossfade. Boost or losing footing cancels
    // mid-swing. Direction variants (forward/left/right from held WASD at
    // press time) arrive with their clips; until then every press swings
    // 'neutral' — the overhead cross.
    // With a loadout, the strike mode comes from the ACTIVE config (a melee slot carries
    // `strike:'melee'`), so the click routes to whatever is currently in the fist.
    const strikeOn = activeCfg ? activeCfg.strike === 'melee' || activeCfg.strike === true
      : r.strike === 'melee' || r.strike === true;
    if (strikeOn && !tackling) {
      const fireEdge = !!input.fire && !e.strikePrev;
      e.strikePrev = !!input.fire;
      // COMBO 1 + MELEE ENFORCEMENT (2026-07-28, supersedes the unbounded 2026-07-27 strings;
      // opt-in `combo:1` on the slot): a combo-1 slot allows a TWO-HIT string — the opener plus
      // exactly ONE follow-up. The opener (whiff or hit) opens the follow-up window
      // (`comboWindow` sec); a timed click inside it is a COMBO step only if it swings a
      // DIFFERENT direction than the opener (a repeat-direction click stays governed by the
      // cooldown). The follow-up aims by the LIVE heading at click time (the camera-honored
      // cut), and a back-cleave step still KNOCKS DOWN on connect. The follow-up does NOT open
      // another window — the string is CAPPED at 2 — and after it the fist is spent for the
      // longer `comboCooldown` (below) before the same weapon can melee again.
      const comboDepth = (activeCfg && activeCfg.combo) || (!activeCfg && r.combo) || 0;
      // MELEE COOLDOWN (R20.5, opt-in `strikeCooldown` sec on the slot/rule): after a swing ends
      // the fist is SPENT for that long — a fresh opener is refused. The one exception is a
      // COMBO click (inside the window): the follow-up bypasses the cooldown by design, or the
      // 0.8s window could never beat a 2s lockout. The timer ticks world-side (stepWorld), so it
      // keeps draining through staggers and pilot transfers like every other weapon timer.
      const strikeCd = (activeCfg && activeCfg.strikeCooldown) ?? r.strikeCooldown ?? 0;
      // COMBO COOLDOWN (2026-07-28): the ENFORCED lockout after a combo FOLLOW-UP lands — 2.5s
      // by default, longer than the base per-swing `strikeCooldown`, so the 2-hit burst is paid
      // for. Only a completed follow-up arms it; a lone opener keeps the base cooldown.
      const comboCooldown = (activeCfg && activeCfg.comboCooldown) ?? r.comboCooldown ?? 2.5;
      // DIRECTIONAL pick, resolved BEFORE the combo gate (the string rule reads it): the held
      // WASD at press time picks which strike plays (dominant planar axis, same read as the
      // boost/dodge direction pick). sideIn > 0 = right; forward > 0 = W (thrust) / < 0 = S
      // (the great cleave → the topple swing). No direction held = the standing overhead cross.
      // Missing clips degrade to swing_neutral in the renderer (__clipLookup).
      const swingDir = Math.abs(sideIn) > Math.abs(input.forward)
        ? (sideIn > 0 ? 'right' : 'left')
        : (input.forward < -1e-3 ? 'back' : input.forward > 1e-3 ? 'forward' : 'neutral');
      const comboClick = comboDepth > 0 && (e.comboT || 0) > 0 && swingDir !== e.lastSwingDir;
      if (e.swingT == null && fireEdge && (((e.strikeCdT || 0) > 0 && !comboClick) || (e.readyT || 0) > 0)) {
        // spent — the click is eaten: the melee cooldown (combo click excepted), OR the
        // post-switch READY-TIME (which nothing bypasses — a fresh saber can't insta-swing).
      } else if (e.swingT == null && fireEdge && !charging && !kneeling && !dodging
          // BOOST-CANCEL MELEE (R22): activating melee mid-boost CUTS the thrust and swings
          // like you are standing — allowed only on a cooldown-paced slot (strikeCooldown > 0;
          // a free-swing slot would make the cancel a spammable brake) and only with footing
          // under the jets (a grounded dash or the hover cushion — an airborne boost-jump arc
          // still refuses). Not boosting → the classic grounded/space gate, unchanged.
          && (boosting ? strikeCd > 0 && (e.grounded || e.hovering || space) : (e.grounded || space))) {
        if (boosting) {
          e.boostCut = true; boosting = false;   // cut the thrust; `halt` roots the swing below
          // the hover cushion COLLAPSES under the strike — plant the feet and swing standing
          // (waiting out a tall clearance's fall would eat the swing; over a probe-null void
          // there is nothing to plant on and the ordinary fall + grace rules apply)
          if (e.hovering) {
            const gz = probe(t.pos[2] - eye);
            if (gz != null) { t.pos[2] = gz + eye; e.vel[2] = 0; e.grounded = true; e.hovering = false; }
          }
        }
        const sc = activeCfg || r;
        // NAMED SWING SET (geof heat rod): a melee slot may name its own clip set
        // (`swingSet:'whip'` → whip_<dir> clips), so two melee slots on ONE figure
        // don't collide on the shared swing_<dir> clip names. Default 'swing' —
        // every existing melee slot picks the same clips as before.
        // the swing CLIP + `strikeParams` (reach/cone/contact-window/damage/topple) — the shared
        // meleeSwingSpec, so the ai melee-seek lands the exact same numbers. `strikeVerbs` per-direction
        // overrides + the back-cleave topple default all live inside it.
        const spec = meleeSwingSpec(sc, r, swingDir, comboDepth > 0);
        e.swingT = 0; e.swingClip = spec.clip;
        // COMMITTED STEP (opt-in `r.cleaveStep`, world units): the great-cleave (back) LUNGES the
        // whole body a real step forward in world space so the sword-side leg's plant lands ground,
        // not air. Direction commits to the current facing at the swing start (like tackle/dodge).
        // Absent `r.cleaveStep` → null, byte-identical.
        e.cleaveStepDir = (swingDir === 'back' && (r.cleaveStep || 0) > 0) ? [f[0], f[1]] : null;
        e.cleaveStepProg = 0;
        breakGuards(e);   // attacking spends any protection (spawn shield / wake guard / dodge i-frames)
        e.swingCombo = comboClick;   // clicked inside the window → this is the knockdown-capable swing
        e.comboT = 0;                // one chance — the window is spent
        // a fresh swing: bump the count (the audio channel plays the crackling-ozone whoosh
        // on this edge), reset the once-per-target melee gate, and stamp the strike numbers.
        // `lastSwingDir` is the combo-string memory — the NEXT window's different-direction gate.
        e.swingCount = (e.swingCount || 0) + 1;
        e.struckThisSwing = {};
        e.strikeParams = spec.params;
        e.lastSwingDir = swingDir;
      } else if (e.swingT != null) {
        const wasCombo = !!e.swingCombo;   // was THIS swing the combo follow-up? (captured before the reset)
        e.swingT += dt / ((activeCfg && activeCfg.strikeDur) ?? r.strikeDur ?? 0.9);
        // boost or losing footing cancels mid-swing — but the hover-coyote grace covers the
        // short cushion drop after a BOOST-CANCEL opener (the ≤ankle-height fall to standing
        // must not kill the swing it paid for; a genuine ledge fall outlives the grace and
        // still cancels).
        if (e.swingT >= 1 || boosting || (!space && !e.grounded && (e.hoverGrace || 0) <= 0)) {
          // COMBO CAP (2026-07-28): the OPENER (not itself a combo step) opens the one follow-up
          // window; the combo FOLLOW-UP opens NOTHING — the string is capped at 2 hits (combo 1).
          if (e.swingT >= 1 && comboDepth > 0 && !wasCombo) {
            e.comboT = (activeCfg && activeCfg.comboWindow) ?? r.comboWindow ?? 0.8;
          }
          // every swing's end (completed or cancelled — the arm was spent either way) arms the
          // melee cooldown; the combo click bypasses it to land inside the window. A naturally-
          // completed FOLLOW-UP arms the longer enforced `comboCooldown`; everything else the base.
          const cd = (e.swingT >= 1 && wasCombo) ? comboCooldown : strikeCd;
          if (cd > 0) { e.strikeCdT = cd; e.strikeCdMax = cd; }   // strikeCdMax → the HUD ring drains over the right span
          e.swingT = null; e.swingCombo = false; e.cleaveStepDir = null;
        }
      }
      swinging = e.swingT != null;
    }
    // the combo follow-up window decays in real time while no swing runs (miss it and the next
    // swing is an ordinary opener again)
    if (e.swingT == null && e.comboT > 0) e.comboT = Math.max(0, e.comboT - dt);
    ctx.boosting = boosting; ctx.swinging = swinging;
  }, 10);
  E.registerPlatformManeuver('act', 'throw', (e, input, dt, world, ctx) => {
    const { space, activeCfg, charging, kneeling, dodging } = ctx;
    const boosting = ctx.boosting;
    let swinging = ctx.swinging;
    const r = e.rule;
    // strikeOn recomputed exactly as the strike hook derived it (the two blocks shared the local):
    const strikeOn = activeCfg ? activeCfg.strike === 'melee' || activeCfg.strike === true
      : r.strike === 'melee' || r.strike === true;
    // THROW (a `throw` slot — the hand-tossed grenade): the SAME fire edge that launches the lob
    // projectile (stepWeapon, after this rule) also plays a quick `swing_throw` arm clip. It rides the
    // swing playback (e.swingT/e.swingClip) but carries NO strikeParams, so stepMelee no-ops — it is a
    // pure animation. A slot is strike OR throw OR plain-ranged, so it shares the fire-edge tracker.
    const throwOn = !strikeOn && activeCfg && activeCfg.throw && e.weapon;
    if (throwOn) {
      const w = e.weapon;
      const fireEdge = !!input.fire && !e.strikePrev;
      e.strikePrev = !!input.fire;
      if (e.swingT == null && fireEdge && (e.grounded || space) && !boosting && !charging && !kneeling && !dodging
          && w.ammo > 0 && w.cooldownT <= 0 && !w.reloading) {
        e.swingT = 0; e.swingClip = 'swing_throw'; e.strikeParams = null;   // visual only — the round is stepWeapon's job
        breakGuards(e);   // throwing spends any protection (spawn shield / wake guard / dodge i-frames)
        e.swingCount = (e.swingCount || 0) + 1;
      } else if (e.swingT != null) {
        e.swingT += dt / (activeCfg.throwDur ?? 0.5);
        if (e.swingT >= 1 || boosting || (!space && !e.grounded)) e.swingT = null;
      }
      swinging = e.swingT != null;
    }
    ctx.swinging = swinging;
  }, 20);
  // the committed cleave step advances the body during the great-cleave's downswing.
  E.registerPlatformManeuver('dash', 'cleave-step', (e, input, dt, world, ctx) => {
    const swinging = ctx.swinging, r = e.rule, t = e.transform;
    // committed cleave step: advance the body forward by the step envelope — ramps in over the
    // step/downswing (commits by ~38% phase) then HOLDS (dprog 0), so the suit ENDS the swing
    // advanced (not a lunge-and-return). Incremental delta so world.colliders eject it like any
    // other horizontal write (the block below), and the ground snap keeps the plant on the floor.
    if (swinging && e.cleaveStepDir) {
      const prog = (r.cleaveStep || 0) * Math.min(1, (e.swingT || 0) / 0.38);
      const dprog = prog - (e.cleaveStepProg || 0);
      if (dprog > 0) { t.pos[0] += e.cleaveStepDir[0] * dprog; t.pos[1] += e.cleaveStepDir[1] * dprog; }
      e.cleaveStepProg = prog;
    }

  }, 40);

  // CLASH lock (2026-07-28) owns the body like a stagger — invincible blade-lock, then the shove;
  // the TACKLE-COUNTER CINEMATIC owns it the same way (the shove-down set piece).
  registerBodyOwner('clash', (e, input, dt, state) => stepClash(e, dt, state), 20);
  registerBodyOwner('cine', (e, input, dt, state) => stepTackleCine(e, dt, state), 30);

  Object.assign(E, { meleeSwingSpec, beginClash, stepClash, stepMelee, stepTackle, beginTackleCounter, stepTackleCine });
}
