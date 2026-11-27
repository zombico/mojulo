/**
 * THE ASSAULT FRAME — a mech that boosts, quick-boosts, climbs on its thrusters and fights with a gun in each hand and a
 * weapon on each shoulder (opt-in: composed into a page only when an entity's rule is `frame`; assault-frame/ builds it).
 * Not a flight: the frame stands on its legs, skates on its booster, and is in the air because it put itself there.
 *
 *   • THE LOOK: the mouse turns the frame (its heading) and lifts its aim (`aimPitch`, ±`aimMax`); the chase camera
 *     pitches with it (rules-basic.js follow reads `transform.pitch`, the aim's share `camPitch`).
 *   • ON ITS FEET: W / S / A / D walk it, forward, back and across its own heading, at `move.walk`.
 *   • BOOST (held): a skate on the booster at `move.boost` toward where the keys point (forward when none), eased in
 *     hard; in the air the same push across, and the fall held to a glide (`glide`: the share of gravity left).
 *   • QUICK BOOST (an edge): a burst at `move.qb` for `move.qbTime` s toward where the keys point (back when none: the
 *     dodge), costing `en.cost.qb`, then `move.qbCool` s before the next; it carries into the boost's speed after.
 *   • JUMP AND ASCEND: Space off the ground jumps at `move.jump`; held in the air it climbs, the booster lifting at
 *     `move.lift` m/s² over the world's gravity (`gravity`, m/s²: Mars 3.71), costing `en.cost.ascend` a second.
 *   • LANDING: a fall onto the ground faster than `hardLand` m/s takes `move.land` s on its knees, slowed.
 *   • EN: the generator's charge (`en.max`), drawn by the boost, the quick boost, the climb and an energy weapon's shot;
 *     it comes back at `en.regen` a second `en.delay` s after the last draw (half that in the air). Emptied, the frame
 *     is OUT for `en.out` s: no boost, no quick boost, no climb, until it is back over a third.
 *   • THE FCS (`fcs` { lock, range, cone }): the foe nearest the aim within the cone and the range is held, locked after
 *     `lock` s on it (`lockOn`, `lockT`, `locked`); locked, the frame's rounds are aimed at where it will be (led by its
 *     velocity), and a missile homes on it. Unlocked, they go down the aim.
 *   • THE WEAPONS (`slots` { armR?, armL?, backR?, backL? }, assault-frame/parts.js rows read by frame-pilot.js): each its
 *     own trigger (armR the fire, armL the alt, backR and backL their keys), its rounds, its magazine, its reload, its
 *     cooldown, an energy weapon's draw on EN and a charge weapon's charge (held, let go to fire). Fired from its mount
 *     (`mounts`, frame space: +y forward, +x right, +z up). Its rounds are the world's projectiles (combat-ranged.js):
 *     they hit bodies, burst with their splash, and here also burst on the terrain (`world.ground`), a missile homing.
 *   • ASSAULT BOOST (an edge, a toggle): a charge along the aim at `move.ab`, built up over a breath, held at its height
 *     (it climbs or dives with the aim), lit for `en.cost.abStart` and burning `en.cost.ab` a second; ended by its key
 *     again, a quick boost, a kick, the generator emptied or a stagger. How a frame closes on another.
 *   • HANDLING (a weapon's `handling`): 'free' fires on the move at full speed, an assault boost too; 'drag' holds the
 *     boost and the charge to its `drag` of their speed while it fires (its recoil, sustained); 'brace' stops the frame
 *     as it fires, a boost and an assault boost cut: it STICKS where it is for `brace` s (in the air too, no gravity, its
 *     drift checked hard), then WINDS DOWN over `wind` s, its gravity and its control coming back (the legs' `steady`
 *     scales both). A quick boost in the wind-down cancels it: the skilled way out; the stick itself cannot be.
 *   • A FLIER'S FLIGHT (an ai's `rule.flight` { mode: 'strafe' | 'perch' | 'circuit' | 'orbit', … }, `frame-flight`): the AI aims and
 *     fires it, the pass flies it: a strafe dives on a mark beside the pilot, rakes past low and pulls out to come round;
 *     a perch holds a point high and far, drifting to a new one; a circuit orbits the pilot, tighter as it is hurt, and
 *     hangs every so often to barrage (`hanging`); an orbit (a quad drone's) drifts round the pilot at height, nose on
 *     it, never stopping, tighter and lower as it is hurt; its guns cannot bear past `under` degrees down
 *     (`frame-broadside`, `blind`), and its rotors spin at `spin` turns a second (its figure's `roll` clip).
 *   • A SHIELD (the engine's frontal shield, `body.shield`): a lunge knocks it aside and staggers its bearer; broken, it is
 *     raised again `rule.shieldRaise` s on (`frame-shields`).
 *   • THE LUNGE (the boost KICK on its key, `rule.kick`, and a BLADE, an arm weapon of fire 'melee'): onto the locked foe
 *     within its reach (straight ahead when none), at its speed for as long as its reach takes; meeting it, the blow lands
 *     (`frame-weapons`: its damage, its impact on the foe's bar). A kick out of an assault boost is the classic opener.
 *   • AN ACE (`mind.phases`, assault-frame/aces.js): the mind fights in the phase its armour's share is in: its reach,
 *     press and dodge; a duel keeps its reach, a rush assault-boosts in and lunges after a TELL (`tell` s, its optics
 *     flared: `tell` the fact) and rests after, a desperate one charges and looses its braced cannon. Crossing into a phase
 *     wakes its reserve (`adds`: a group's bodies) or steadies its bar (`regen`).
 *   • STABILITY AND THE STAGGER (`body.poise` its stability in standard bars, `rule.stab` { stagger, bonus }): every
 *     round's impact (its weapon's `stagger`) chips the bar, which comes back on its own (`poiseRegen`); broken, the frame
 *     REELS for `stab.stagger` s: no boost, no quick boost, no climb, no guns, carried on by what it was doing and
 *     pulled down, and every hit on it lands `stab.bonus` times as hard. The engine's hit reaction would freeze it where
 *     it stood (a rooted clip that suppresses the rule); a frame reels on its own physics, so the break is taken here.
 *     Pressure it until it breaks, then punish it: the fight's loop.
 *   • A MIND (`mind` { range?, aggression?, dodge? }): an enemy frame's own keys: it keeps its range to the pilot,
 *     strafing round it and boosting, quick-boosting out of the way of a shot it sees coming or as it is hit, climbing at
 *     times, firing what is in range while it holds its lock. Not the pilot's input: its own.
 *   • A MIND'S ROUNDS are fired at where its target is as they leave the gun (no lead: a round seen coming can be dodged,
 *     a step or a quick boost aside); `mind.leadShots` leads them as the pilot's lock does. Missiles home as before.
 *   • HELD: while the pilot's input is held (`input.held`: a scene playing, a menu up, the page's freeze) every mind
 *     stands down with it, its keys idle (a scene's cast still moves it: a walk, a glide), and takes up again after.
 *   • AN ALLY THAT HOLDS (`mind.hold`): it stands its ground turned to the pilot, fighting only a foe that comes to it,
 *     until the cast's `unhold` op lets it go (a level's task begun: game/objectives.js `ops`), and from then it fights
 *     and keeps by the pilot as any ally does (e.unheld).
 *
 * Facts: speed, airborne, agl, en, enMax, enOut, boosting, qbT, ascending, landT, lockOn, locked, lockT, aimPitch, thrust (the
 * burn the page's thrusters draw, 0..1), stab (its stability left, 0..1 of its bar), stagger (seconds left reeling, 0 when not),
 * ab (assault boosting), lunge ({ by, T, to, hit } while lunging), kickCd, braced ('stick' | 'wind' | null), dragT,
 * acePhase (an ace's phase index), tell ({ T, then } while it is told),
 * slotState { <slot>: { ammo, mag, reloading, cd, charge } }, locomotion (the body's clip: idle, forward, boost,
 * boost_left, boost_right, boost_back, hover, fall, land), gaitPhase, moving.
 *
 * Pure + deterministic: reads the input snapshot, world.ground and the bodies; its dice are its own (seeded by its id).
 * BUILDER CONTRACT (compose.js): import-free inside the function.
 */

export function buildRulesFrame(E) {
  const { clamp, RULES } = E;
  const GRAV = 9.81;
  // (the cast's `unhold`: an ally that holds its ground let go, the cast's own ops run as they were)
  const castOps = E.castOps;
  if (castOps) E.castOps = function (state, ops) {
    for (const o of ops || []) if (o && o.op === 'unhold' && state.byId && state.byId[o.who]) state.byId[o.who].unheld = true;
    return castOps(state, (ops || []).filter((o) => !(o && o.op === 'unhold')));
  };

  // a seeded die per body (its id's hash, stepped): a mind's choices, never the browser's
  function dice(e) {
    if (e.frDie == null) { let h = 2166136261; for (const c of String(e.id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); e.frDie = h >>> 0; }
    e.frDie = (e.frDie + 0x6d2b79f5) | 0;
    let t = Math.imul(e.frDie ^ (e.frDie >>> 15), 1 | e.frDie); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const foesOf = (e, world) => {
    const out = [];
    for (const id in world.byId) {
      const tg = world.byId[id];
      if (tg === e || tg.isCamera || tg.gone || tg.downed || tg.dormant || !(tg.body && tg.body.hittable)) continue;
      if (e.team ? tg.team === e.team : !tg.team) continue;
      out.push(tg);
    }
    return out;
  };
  const aimDir = (h, p) => [Math.cos(h) * Math.cos(p), Math.sin(h) * Math.cos(p), Math.sin(p)];
  // (how far the pilot may drop behind a leading ally before it waits for it, metres)
  const ALLY_WAIT = 600;

  // ── an ally's: the nearest foe awake within its reach of it, else none ──
  function allyFoe(e, world, reach) {
    const p = e.transform.pos;
    let best = null, bd = reach;
    for (const f of foesOf(e, world)) { if (f.team !== 'foes') continue; const d = Math.hypot(f.transform.pos[0] - p[0], f.transform.pos[1] - p[1], f.transform.pos[2] - p[2]); if (d < bd) { bd = d; best = f; } }
    return best;
  }
  // ── an ally with no foe near: to the next of its places the pilot has not reached, waiting there (and waiting for the
  // pilot if it has dropped far behind), else at the pilot's side ──
  function escortKeys(e, dt, M, P, out) {
    const t = e.transform, q = P.transform.pos, L = M.lead || [];
    // (holding its ground, an instructor on the range: where it stands, turned to the pilot)
    if (M.hold && !e.unheld) { e.mindFace = Math.atan2(q[1] - t.pos[1], q[0] - t.pos[0]); e.mindPitch = 0; return out; }
    let i = e.leadI || 0;
    while (i < L.length && Math.hypot(q[0] - L[i].at[0], q[1] - L[i].at[1]) < (L[i].r || 40)) i++;
    e.leadI = i;
    const lead = i < L.length, behind = Math.hypot(q[0] - t.pos[0], q[1] - t.pos[1]);
    // (leading: the place, unless the pilot has dropped far behind; else beside the pilot, a little off)
    const g = lead && behind < ALLY_WAIT ? L[i].at : [q[0] + Math.cos((P.transform.heading || 0) + Math.PI / 2) * 30, q[1] + Math.sin((P.transform.heading || 0) + Math.PI / 2) * 30, q[2]];
    const dx = g[0] - t.pos[0], dy = g[1] - t.pos[1], d = Math.hypot(dx, dy);
    e.mindFace = d > 1 ? Math.atan2(dy, dx) : (P.transform.heading || 0); e.mindPitch = 0;
    const stop = lead && behind < ALLY_WAIT ? 12 : 25;
    out.forward = d > stop ? 1 : 0;
    out.boost = d > 90 ? 1 : 0;
    return out;
  }

  // ── a mind's keys: an enemy frame's own input, read off the pilot ──
  function mindInput(e, dt, world) {
    const M = e.rule.mind, P0 = world.pilotId && world.byId[world.pilotId];
    const out = { forward: 0, strafe: 0, boost: 0, qb: 0, jump: 0, jumpHeld: 0, fire: 0, alt: 0, backR: 0, backL: 0, ab: 0, kick: 0, lookDX: 0, lookDY: 0 };
    if (!P0 || P0.gone || P0.downed || world.aiEnabled === false || e.dormant || P0.frHeld) return out;
    // (an ALLY, a wingman on the pilot's side: it fights the nearest foe awake near it; with none, it leads the pilot)
    let P = P0;
    if (M.ally) { const F = allyFoe(e, world, M.engage ?? 500); if (!F) return escortKeys(e, dt, M, P0, out); P = F; }
    const t = e.transform, q = P.transform.pos, dx = q[0] - t.pos[0], dy = q[1] - t.pos[1], dz = q[2] - t.pos[2], d = Math.hypot(dx, dy);
    e.mindFace = Math.atan2(dy, dx); e.mindPitch = Math.atan2(dz, d || 1);
    // (an ace's phase, by its armour's share: its reach, its press and its dodge; crossing into one calls its reserve in
    // or steadies it, assault-frame/aces.js)
    const PH = M.phases ? phaseOf(e, M.phases, world) : null;
    const range = PH ? PH.range : M.range ?? 120;
    // (round the pilot: in toward its range, out from it, across it the way it is going, the way turned now and then)
    if (e.mindDir == null || (e.mindTurnT = (e.mindTurnT ?? 0) - dt) <= 0) { e.mindDir = dice(e) < 0.5 ? -1 : 1; e.mindTurnT = 2.5 + 3 * dice(e); }
    out.forward = d > range * 1.25 ? 1 : d < range * 0.7 ? -1 : 0;
    out.strafe = e.mindDir;
    out.boost = ((PH ? PH.aggression : M.aggression) ?? 0.6) > 0.3 || d > range * 1.5 ? 1 : 0;
    // (a quick boost out of the way: as it is hit, or now and then when it is in the pilot's sights)
    const hitNow = e.hitFlash != null && e.hitFlash !== e.mindHitSeen;
    if (hitNow) e.mindHitSeen = e.hitFlash;
    if ((hitNow && dice(e) < ((PH ? PH.dodge : M.dodge) ?? 0.5)) || dice(e) < dt * 0.25) { out.qb = 1; out.strafe = dice(e) < 0.5 ? -1 : 1; out.forward = 0; }
    // (up at times, and down again)
    if ((e.mindClimbT = (e.mindClimbT ?? 1 + 4 * dice(e)) - dt) <= 0) { e.mindClimbFor = 0.8 + 1.2 * dice(e); e.mindClimbT = 4 + 6 * dice(e); }
    if (e.mindClimbFor > 0) { e.mindClimbFor -= dt; out.jump = out.jumpHeld = 1; }
    // (its guns: those in range, while it holds its lock)
    // (a blade in the left hand: in to its reach and cut, an assault boost to close from far off)
    const blade = e.rule.slots && e.rule.slots.armL && e.rule.slots.armL.fire === 'melee' ? e.rule.slots.armL : null;
    if (e.locked) { out.fire = d < 420 ? 1 : 0; out.alt = blade ? (d < blade.range * 0.9 ? 1 : 0) : d < 320 && dice(e) < 0.5 ? 1 : 0; out.backR = dice(e) < dt * 0.6 ? 1 : 0; out.backL = dice(e) < dt * 0.3 ? 1 : 0; }
    if (!PH && blade && e.locked && d > blade.range && d < range * 2.2 && (M.aggression ?? 0.6) > 0.5) { out.forward = 1; out.strafe = 0; if (!e.ab && dice(e) < dt * 0.8) out.ab = 1; }
    if (PH) aceKeys(e, PH, out, d, dt, blade);
    // (the pilot reeling: the moment to punish it, everything it has, in close)
    if (e.locked && P.stagger > 0) { out.fire = out.alt = 1; out.backR = out.backL = 1; out.forward = d > range * 0.6 ? 1 : 0; out.qb = 0; out.kick = d < ((e.rule.kick && e.rule.kick.range) ?? 80) ? 1 : 0; }
    return out;
  }

  // a lunge begun: onto the locked foe if it is within the reach, else straight ahead; `by` the kick or the slot
  function lungeFrom(e, world, K) {
    const tg = e.locked && e.lockOn && world.byId[e.lockOn], p = e.transform.pos;
    const near = tg && Math.hypot(tg.transform.pos[0] - p[0], tg.transform.pos[1] - p[1], tg.transform.pos[2] - p[2]) <= (K.range ?? 80);
    // (its time: enough to cross its whole reach at its speed, a breath more, so a foe at the edge of it is met; a whiff a
    // short one)
    e.lunge = { by: K.by, to: near ? tg.id : null, damage: K.damage || 0, impact: K.impact || 0, speed: K.speed ?? 110, T: near ? (K.range ?? 80) / (K.speed ?? 110) + 0.2 : 0.25, hit: false };
  }

  // ── an ace's phases: the one it fights in by its armour's share; crossing into one, its reserve woken, its bar steadied ──
  function phaseOf(e, phases, world) {
    const share = e.body && e.body.hpMax > 0 ? e.body.hp / e.body.hpMax : 1;
    let i = 0;
    for (let k = 0; k < phases.length; k++) if (share <= phases[k].below) i = k;
    if (e.acePhase !== i) {
      e.acePhase = i; e.phaseAt = e.frTime || 0;
      const P = phases[i];
      if (P.regen && Number.isFinite(e.poiseRegen)) { if (e.poiseRegen0 == null) e.poiseRegen0 = e.poiseRegen; e.poiseRegen = e.poiseRegen0 * P.regen; }
      // (its reserve: every body of the group it names, woken where it stood)
      if (P.adds) for (const id in world.byId) { const b = world.byId[id]; if (b.dormant && (id === P.adds || id.indexOf(P.adds + '-') === 0)) b.dormant = false; }
    }
    return phases[i];
  }
  // ── an ace's keys by its phase's style: the rush told and its rest after, the desperate cannon charged and loosed ──
  function aceKeys(e, PH, out, d, dt, blade) {
    out.alt = 0; out.backL = 0;
    if (!e.locked) { e.tell = null; return; }
    if (PH.style === 'rush') {
      e.rushCd = Math.max(0, (e.rushCd || 0) - dt);
      const reach = Math.min(blade ? blade.range : 999, (e.rule.kick && e.rule.kick.range) || 80);
      if (e.tell) {
        // (told: its optics flare while it squares up, then the lunge; the blade if it is ready, else the kick)
        e.tell.T -= dt; out.forward = 1; out.strafe = 0; out.qb = 0; out.fire = 0;
        if (e.tell.T <= 0) { out[e.tell.then] = 1; e.tell = null; e.rushCd = PH.rest ?? 2; }
      } else if (e.rushCd <= 0) {
        if (d > reach * 0.85) { out.forward = 1; out.strafe = 0; out.qb = 0; if (!e.ab) out.ab = 1; }
        else {
          const ready = blade && !(blade.st && blade.st.cd > 0);
          e.tell = { T: PH.tell ?? 0.5, then: ready ? 'alt' : 'kick' };
          if (e.ab) out.ab = 1;   // (the charge cut as it squares up: the tell is seen, not run through)
        }
      }
    } else e.tell = null;
    if (PH.style === 'desperate') {
      // (its cannon held to charge, then loosed: a braced shot, the frame hung where it fired, every few seconds)
      const W = e.rule.slots && e.rule.slots.backL;
      if (W && W.fire === 'charge') {
        e.mChargeCd = Math.max(0, (e.mChargeCd ?? 1.5) - dt);
        if (e.mHold > 0) { e.mHold -= dt; out.backL = e.mHold > 0 ? 1 : 0; if (!(e.mHold > 0)) e.mChargeCd = 4; }
        else if (e.mChargeCd <= 0 && d < W.range) e.mHold = (W.chargeTime ?? 0.8) + 0.15;
      }
    }
  }

  function frame(e, input, dt, world) {
    const r = e.rule, t = e.transform, M = r.move || {}, EN = r.en || {}, C = EN.cost || {};
    const mine = !r.mind;
    // (the pilot's input held, a scene playing or a menu up: every mind stands down with it, the input's `held`)
    if (mine) e.frHeld = !!(input && input.held);
    // (reeling: the stagger takes every key from it; it is carried on by what it was doing, and comes down)
    const reeling = e.stagger > 0;
    const inp = reeling ? REEL : mine ? input : mindInput(e, dt, world);
    e.frInput = inp;
    // (a braced shot: stuck for its time, then winding down, its control and its gravity coming back by `ctl`)
    let ctl = 1, stuck = false;
    if (e.brace) {
      if (e.brace.T > 0) { e.brace.T -= dt; stuck = true; ctl = 0; }
      else if (e.brace.W > 0) { e.brace.W = Math.max(0, e.brace.W - dt); ctl = 1 - e.brace.W / (e.brace.Wmax || 1); }
      if (!(e.brace.T > 0) && !(e.brace.W > 0)) e.brace = null;
    }
    e.dragT = Math.max(0, (e.dragT || 0) - dt);
    const dragK = e.dragT > 0 ? (e.dragK ?? 1) : 1;
    if (e.en == null) { e.en = EN.max ?? 3000; e.enLast = -1e9; e.v = [0, 0, 0]; e.qbCd = 0; e.qbT = 0; e.landT = 0; e.aimPitch = 0; e.frTime = 0; }
    e.frTime += dt;
    const g = r.gravity ?? GRAV;

    // ── the look: the mouse turns it and lifts its aim; a mind faces its pilot ──
    if (mine) {
      t.heading = (t.heading || 0) + (inp.lookDX || 0) * (r.look ?? 0.0028) - (inp.turn || 0) * (r.turnRate ?? 2.2) * dt;
      e.aimPitch = clamp(e.aimPitch + (inp.lookDY || 0) * (r.look ?? 0.0028), -(r.aimMax ?? 0.7), r.aimMax ?? 0.7);
    } else {
      const want = e.mindFace ?? t.heading, dh = Math.atan2(Math.sin(want - t.heading), Math.cos(want - t.heading));
      t.heading += clamp(dh, -(r.turnRate ?? 2.6) * dt, (r.turnRate ?? 2.6) * dt);
      e.aimPitch = clamp(e.mindPitch ?? 0, -(r.aimMax ?? 0.7), r.aimMax ?? 0.7);
    }
    // (the camera's share of the aim: the chase looks up and down with it)
    t.pitch = e.aimPitch * (r.camPitch ?? 0.6);

    // ── the ground under it ──
    const probe = r.probe ?? 60;
    const groundAt = (x, y, z) => (world && world.ground ? world.ground([x, y, z + probe]) : 0);
    const gz = groundAt(t.pos[0], t.pos[1], t.pos[2]) ?? 0;
    const onGround = t.pos[2] <= gz + 0.05 && e.v[2] <= 0.01;

    // ── EN: drawn, then back after its delay; out when emptied ──
    if (e.enOut > 0) { e.enOut = Math.max(0, e.enOut - dt); }
    const enOk = !(e.enOut > 0) && !(e.enShut && e.en < (EN.max ?? 3000) / 3);
    if (e.enShut && e.en >= (EN.max ?? 3000) / 3) e.enShut = false;
    const draw = (n) => { if (n <= 0) return true; if (e.en <= 0) return false; e.en = Math.max(0, e.en - n); e.enLast = e.frTime; if (e.en <= 0) { e.enOut = EN.out ?? 1.8; e.enShut = true; } return true; };

    // ── where the keys point, in the frame's own heading ──
    const h = t.heading, fx = Math.cos(h), fy = Math.sin(h), rx = Math.sin(h), ry = -Math.cos(h);
    const kf = clamp(inp.forward || 0, -1, 1), ks = clamp(inp.strafe || 0, -1, 1), kl = Math.hypot(kf, ks);
    const dir = kl > 1e-3 ? [(fx * kf + rx * ks) / kl, (fy * kf + ry * ks) / kl] : null;

    // ── the quick boost: a burst toward the keys (back when none) ──
    e.qbCd = Math.max(0, e.qbCd - dt);
    const qbEdge = !!inp.qb && !e.qbPrev;
    e.qbPrev = !!inp.qb;
    if (qbEdge && !stuck && e.qbCd <= 0 && enOk && !(e.landT > 0) && draw(C.qb ?? 600)) {
      e.brace = null; ctl = 1;
      const d = dir || [-fx, -fy];
      e.qbDir = d; e.qbT = M.qbTime ?? 0.24; e.qbCd = (M.qbTime ?? 0.24) + (M.qbCool ?? 0.42);
      e.v[0] = d[0] * (M.qb ?? 96); e.v[1] = d[1] * (M.qb ?? 96);
      if (!onGround && e.v[2] < 0) e.v[2] *= 0.3;
    }
    const inQb = e.qbT > 0;
    if (inQb) e.qbT = Math.max(0, e.qbT - dt);

    // ── the assault boost: toggled, a charge along the aim, ended by a quick boost, a kick, the generator or a reel ──
    const abEdge = !!inp.ab && !e.abPrev;
    e.abPrev = !!inp.ab;
    if (abEdge) { if (e.ab) e.ab = false; else if (enOk && !(e.landT > 0) && !reeling && !stuck && draw(C.abStart ?? 380)) e.ab = true; }
    if (e.ab && (reeling || stuck || (qbEdge && inQb) || !enOk || !draw((C.ab ?? 440) * dt))) e.ab = false;

    // ── the kick: a lunge onto the locked foe within its reach (straight ahead when none) ──
    e.kickCd = Math.max(0, (e.kickCd || 0) - dt);
    const kickEdge = !!inp.kick && !e.kickPrev;
    e.kickPrev = !!inp.kick;
    if (kickEdge && r.kick && e.kickCd <= 0 && !reeling && !(e.landT > 0) && !e.lunge && enOk && draw(r.kick.en ?? 300)) {
      lungeFrom(e, world, { by: 'kick', damage: r.kick.damage, impact: r.kick.impact, range: r.kick.range, speed: r.kick.speed });
      e.kickCd = r.kick.cool ?? 2.2;
    }
    if (e.lunge && (reeling || e.lunge.T <= 0)) e.lunge = null;
    const lunging = !!e.lunge;
    if (lunging) e.ab = false;

    // ── the boost: held, a skate (or a push across the air), drawing a little ──
    e.boosting = !e.ab && !lunging && !stuck && !!inp.boost && enOk && !(e.landT > 0) && draw((C.boost ?? 260) * dt);
    // ── jump and climb ──
    const jumpEdge = !!inp.jump && !e.jumpPrev;
    e.jumpPrev = !!inp.jump;
    if (onGround && jumpEdge && !stuck && !(e.landT > 0)) { e.v[2] = M.jump ?? 13; e.jumpedAt = e.frTime; }
    e.ascending = !onGround && !stuck && !!(inp.jumpHeld || inp.jump) && enOk && e.frTime - (e.jumpedAt ?? -9) > 0.12 && draw((C.ascend ?? 520) * dt);

    // ── the horizontal: eased toward what it wants, hard on the booster, soft on its feet, carried on in the air ──
    if (lunging) {
      // (the lunge: straight at the foe's middle, or along the aim, at its speed; its time runs down)
      const L = e.lunge, tg = L.to && world.byId[L.to];
      let d = aimDir(t.heading, e.aimPitch * 0.5);
      if (tg && !tg.gone && !tg.downed) {
        const q = tg.transform.pos, v = [q[0] - t.pos[0], q[1] - t.pos[1], q[2] + ((tg.body && tg.body.aimH) ?? 2) - (t.pos[2] + (r.eyeH ?? 7) * 0.6)], n = Math.hypot(v[0], v[1], v[2]) || 1;
        d = [v[0] / n, v[1] / n, v[2] / n];
        t.heading = Math.atan2(v[1], v[0]);
      }
      e.v[0] = d[0] * L.speed; e.v[1] = d[1] * L.speed; e.v[2] = d[2] * L.speed;
      L.T -= dt;
    } else if (e.ab && !inQb) {
      // (the charge: built up toward its speed along the aim, a little of the aim's pitch in it, held at its height)
      // (its height settles fast, its speed builds: a charge takes its line at once and gathers along it)
      const a = aimDir(t.heading, e.aimPitch * 0.6), k = Math.min(1, 2.4 * dt), kz = Math.min(1, 6 * dt), sp = (M.ab ?? 76) * dragK;
      e.v[0] += (a[0] * sp - e.v[0]) * k; e.v[1] += (a[1] * sp - e.v[1]) * k; e.v[2] += (a[2] * sp - e.v[2]) * kz;
      if (onGround && e.v[2] < 0) e.v[2] = 0;
    } else if (stuck) {
      // (stuck: its drift checked hard, where it fired from)
      const k = Math.min(1, 8 * dt);
      e.v[0] -= e.v[0] * k; e.v[1] -= e.v[1] * k;
    } else if (inQb) {
      // (a quick boost steered: its burst turned toward the keys held, at its own speed, as quick as `qbTurn` rad/s)
      if (dir) {
        const sp = Math.hypot(e.v[0], e.v[1]), a = Math.atan2(e.v[1], e.v[0]), b = Math.atan2(dir[1], dir[0]);
        const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)), turn = clamp(d, -(r.qbTurn ?? 9) * dt, (r.qbTurn ?? 9) * dt), n = a + turn;
        e.v[0] = Math.cos(n) * sp; e.v[1] = Math.sin(n) * sp; e.qbDir = [Math.cos(n), Math.sin(n)];
      }
    } else {
      // (its speed by the wind-down's share of its control, and a dragging weapon's recoil on the boost)
      // (in the air off the booster it keeps its way on: what it carries, and at least its walk, steered by the keys)
      const sp = (e.boosting ? (M.boost ?? 46) * dragK : onGround ? (M.walk ?? 11) * (e.landT > 0 ? 0.25 : 1) : Math.max((M.walk ?? 11) * (r.airWalk ?? 1), Math.hypot(e.v[0], e.v[1]))) * (0.25 + 0.75 * ctl);
      const want = e.boosting ? (dir || [fx, fy]) : dir;
      const tx = want ? want[0] * sp : (onGround ? 0 : e.v[0]), ty = want ? want[1] * sp : (onGround ? 0 : e.v[1]);
      const k = Math.min(1, (e.boosting ? (onGround ? 5 : 3) : onGround ? 7 : r.airSteer ?? 1.5) * dt);
      e.v[0] += (tx - e.v[0]) * k; e.v[1] += (ty - e.v[1]) * k;
    }
    // ── the vertical: gravity, the climb over it, the boost's glide ──
    if (lunging || e.ab) { /* (the charge and the lunge hold their own height) */ }
    else if (stuck && !onGround) e.v[2] -= e.v[2] * Math.min(1, 10 * dt);
    else if (onGround && e.v[2] <= 0) e.v[2] = 0;
    else {
      // (winding down, gravity comes back with its control)
      let az = -g * (e.brace ? Math.max(0.1, ctl) : 1);
      if (e.ascending) az += g + (M.lift ?? 9);
      else if ((e.boosting || inQb) && e.v[2] < 0) az = -g * (r.glide ?? 0.35);
      e.v[2] += az * dt;
      if (e.ascending) e.v[2] = Math.min(e.v[2], r.climbMax ?? 16);
      // (the climb let go: the thrusters cut, the rise checked hard, so the frame hangs a breath and comes down)
      else if (e.v[2] > 0 && !onGround) e.v[2] *= Math.max(0, 1 - (r.checkRise ?? 3.5) * dt);
    }
    // ── EN back: after its delay, on the ground at its rate, in the air at half ──
    if (e.frTime - e.enLast > (EN.delay ?? 0.55) && !(e.enOut > 0)) e.en = Math.min(EN.max ?? 3000, e.en + (EN.regen ?? 1100) * (onGround ? 1 : 0.5) * dt);

    // ── move, and meet the ground ──
    const lastZ = t.pos[2];
    t.pos[0] += e.v[0] * dt; t.pos[1] += e.v[1] * dt; t.pos[2] += e.v[2] * dt;
    const g2 = groundAt(t.pos[0], t.pos[1], t.pos[2]) ?? 0;
    // (STICKY FEET: a frame on its feet that has not jumped or climbed stays on the ground over a crest or a dip, held
    // down to it by as much as `stick` metres a step, or its pace over the ground, so a bumpy field is walked, not
    // floated over; a drop deeper than that is a ledge, and it goes over it into the air)
    if (onGround && !e.ascending && e.v[2] <= 0.01 && !lunging && !e.ab && t.pos[2] > g2 && t.pos[2] - g2 <= Math.max(r.stick ?? 1.2, Math.hypot(e.v[0], e.v[1]) * dt)) { t.pos[2] = g2; e.v[2] = 0; }
    if (t.pos[2] <= g2) {
      const fall = -e.v[2];
      t.pos[2] = g2;
      if (fall > (r.hardLand ?? 18)) { e.landT = M.land ?? 0.35; e.landed = e.frTime; }
      e.v[2] = 0;
    }
    // (a bound to the field: the level's arena, where it says one)
    if (r.bound) { const B = r.bound; t.pos[0] = clamp(t.pos[0], B[0], B[2]); t.pos[1] = clamp(t.pos[1], B[1], B[3]); }
    // (and what stands in its way, a works' walls and machines: where its rule names a body to stop, the world's colliders
    // push it out, a deck's slab walked under or stood on by its step)
    if (r.collideRadius > 0 && world && world.colliders) E.resolveBlocking(t.pos, t.pos[2], r.collideHeight ?? 9, r.collideRadius, world.colliders, r.step ?? 2);
    e.landT = Math.max(0, e.landT - dt);

    // ── the FCS: the foe nearest the aim, held to lock ──
    // (the pilot's lock looks where the reticle does: along the page's sight, `inp.aim`, from the frame's eye)
    const ray = mine && Array.isArray(inp.aim) && inp.aim.length === 6 && inp.aim.every(Number.isFinite) ? inp.aim : null, rl = ray ? Math.hypot(ray[3], ray[4], ray[5]) || 1 : 1;
    const F = r.fcs || {}, aim = ray ? [ray[3] / rl, ray[4] / rl, ray[5] / rl] : aimDir(t.heading, e.aimPitch), eye = [t.pos[0], t.pos[1], t.pos[2] + (r.eyeH ?? 7)];
    let best = null, bestA = ((F.cone ?? 26) * Math.PI) / 180;
    {
      for (const tg of foesOf(e, world)) {
        const q = tg.transform.pos, v = [q[0] - eye[0], q[1] - eye[1], q[2] + (tg.body.aimH ?? 2) - eye[2]], d = Math.hypot(v[0], v[1], v[2]);
        if (d < 1 || d > (F.range ?? 420)) continue;
        const a = Math.acos(clamp((v[0] * aim[0] + v[1] * aim[1] + v[2] * aim[2]) / d, -1, 1));
        if (a < bestA) { bestA = a; best = tg; }
      }
    }
    if (best && e.lockOn === best.id) e.lockT += dt; else { e.lockOn = best ? best.id : null; e.lockT = 0; }
    e.locked = !!best && e.lockT >= (F.lock ?? 0.45);

    // ── the facts ──
    const hs = Math.hypot(e.v[0], e.v[1]);
    e.speed = Math.round(hs * 10) / 10;
    e.airborne = !(t.pos[2] <= g2 + 0.05);
    e.agl = t.pos[2] - g2;
    e.climbRate = dt > 0 ? (t.pos[2] - lastZ) / dt : 0;
    e.enMax = EN.max ?? 3000;
    e.moving = hs > 0.8 || e.airborne || e.landT > 0;
    // (the body's clip: on its feet a walk or a skate by which way it goes, in the air a hover or a fall)
    const lf = hs > 0.5 ? (e.v[0] * fx + e.v[1] * fy) / hs : 1, ls = hs > 0.5 ? (e.v[0] * rx + e.v[1] * ry) / hs : 0;
    const way = ls > 0.6 ? 'boost_right' : ls < -0.6 ? 'boost_left' : lf < -0.5 ? 'boost_back' : 'boost';
    e.locomotion = e.landT > 0 ? 'land'
      : e.airborne ? (e.ascending || e.v[2] > 0.5 || e.boosting || inQb ? (inQb || e.boosting ? way === 'boost' ? 'hover' : way : 'hover') : 'fall')
      : (e.boosting || inQb) ? way : hs > 0.8 ? 'forward' : 'idle';
    // (the walk's phase on by the ground gone over this step: a cycle a stride)
    e.gaitPhase = (e.gaitPhase || 0) + (e.locomotion === 'forward' ? (hs * dt) / (r.stride ?? 9) : e.boosting ? 1.2 * dt : 0.4 * dt);
    // (the burn the page's thrusters draw: full in a quick boost, hard climbing, then boosting in the air and on the ground; off)
    e.thrust = inQb || e.ab || lunging ? 1 : e.ascending ? 0.85 : e.boosting ? (e.airborne ? 0.75 : 0.6) : 0;
    if (e.ab || lunging) e.locomotion = e.airborne ? 'hover' : 'boost';
    else if (stuck) e.locomotion = e.airborne ? 'hover' : 'idle';
    e.braced = stuck ? 'stick' : e.brace ? 'wind' : null;
    e.moving = e.moving || e.ab || lunging;

    // ── the stagger: a hit that lands on a reeling frame lands harder; the reel runs out ──
    const hp = e.body && Number.isFinite(e.body.hp) ? e.body.hp : null;
    if (hp != null) {
      // (what it lost since last frame, lost again by the bonus's share over one; taken to nothing, it is floored)
      if (reeling && e.frHp != null && hp < e.frHp) {
        e.body.hp = Math.max(0, hp - (e.frHp - hp) * (((r.stab && r.stab.bonus) ?? 1.5) - 1));
        if (e.body.hp <= 0 && !e.noDestroy) { e.downed = true; e.moving = false; }
      }
      e.frHp = e.body.hp;
    }
    // (the bar held empty while it reels: it comes back from nothing once the reel is over)
    if (reeling) { e.stagger = Math.max(0, e.stagger - dt); e.locomotion = e.airborne ? 'fall' : 'land'; e.thrust = 0; if (Number.isFinite(e.poise)) e.poise = 0; }
    e.stab = Number.isFinite(e.poise) && e.poiseMax > 0 ? Math.round((e.poise / e.poiseMax) * 100) / 100 : 1;
  }
  // (what a reeling frame's keys are: none)
  const REEL = Object.freeze({ forward: 0, strafe: 0, boost: 0, qb: 0, jump: 0, jumpHeld: 0, fire: 0, alt: 0, backR: 0, backL: 0, ab: 0, kick: 0, lookDX: 0, lookDY: 0 });

  // ── an ace's name, carried onto the body (the HUD's bar reads it): the world keeps only the fields it is told of ──
  E.registerNormalize((ent, raw) => { if (raw.ace && typeof raw.ace === 'object') ent.ace = { id: String(raw.ace.id), name: String(raw.ace.name) }; });

  // ── the break: the engine's hit reaction arms a stagger on a broken bar; a frame takes it as its own reel, before the
  // reaction could root it (a timer, run ahead of the bodies' owners), and a killing blow is left to floor it ──
  E.registerEntityTimer('frame-stagger', (e) => {
    if (!(e.rule && e.rule.type === 'frame') || e.staggerT == null || e.downed) return;
    // (a break while it already reels is no new reel: never a lock it cannot leave)
    if (!(e.stagger > 0)) { e.stagger = (e.rule.stab && e.rule.stab.stagger) ?? 1.6; e.staggers = (e.staggers || 0) + 1; }
    e.staggerT = null; e.reactDur = null; e.reactClip = 'stagger'; e.locomotion = e.staggerReturn || e.locomotion;
    // (the bar refilled by the break, as the engine's is: empty to the eye a breath, then back from nothing)
    e.poise = 0;
  }, 40);

  // ── the weapons: four triggers, four guns, after the rule (the aim settled) ──
  function lead(from, tg, speed) {
    const q = tg.transform.pos, v = tg.v || [0, 0, 0], aimH = (tg.body && tg.body.aimH) ?? 2;
    let at = [q[0], q[1], q[2] + aimH];
    for (let i = 0; i < 2; i++) {
      const d = Math.hypot(at[0] - from[0], at[1] - from[1], at[2] - from[2]), tt = d / Math.max(1, speed);
      at = [q[0] + v[0] * tt, q[1] + v[1] * tt, q[2] + aimH + v[2] * tt];
    }
    return at;
  }
  // WHERE THE SIGHT LOOKS (the pilot's: the page's camera through the reticle, `inp.aim` [ox, oy, oz, dx, dy, dz]): along
  // its ray from past the frame's own body, the first foe's body it passes within, else the ground it meets (stepped and
  // halved down onto it), else `R` out. Every gun fires at it from its own mount, so the rounds meet where the reticle is.
  function sightPoint(e, world, ray, R) {
    const t = e.transform, o = [ray[0], ray[1], ray[2]], dl = Math.hypot(ray[3], ray[4], ray[5]) || 1, d = [ray[3] / dl, ray[4] / dl, ray[5] / dl];
    const at = (s) => [o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s];
    const s0 = Math.max(0, (t.pos[0] - o[0]) * d[0] + (t.pos[1] - o[1]) * d[1] + (t.pos[2] + (e.rule.eyeH ?? 7) - o[2]) * d[2]) + 6, s1 = s0 + R;
    let best = s1;
    for (const tg of foesOf(e, world)) {
      const q = tg.transform.pos, c = [q[0], q[1], q[2] + ((tg.body && tg.body.aimH) ?? 2)];
      const s = (c[0] - o[0]) * d[0] + (c[1] - o[1]) * d[1] + (c[2] - o[2]) * d[2];
      if (s < s0 || s >= best) continue;
      const p = at(s), miss = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
      if (miss <= ((tg.body && tg.body.radius) || 3) * 1.2) best = s;
    }
    const under = (s) => { const p = at(s), g = world && world.ground ? world.ground([p[0], p[1], p[2] + 1]) : 0; return g != null && p[2] <= g; };
    const STEP = 15;
    for (let s = s0; s < best; s += STEP) {
      if (!under(Math.min(best, s + STEP))) continue;
      let a = s, b = Math.min(best, s + STEP);
      for (let k = 0; k < 6; k++) { const m = (a + b) / 2; if (under(m)) b = m; else a = m; }
      best = b; break;
    }
    return at(best);
  }
  function mountAt(e, m) {
    const t = e.transform, h = t.heading, c = Math.cos(h), s = Math.sin(h);
    // (frame space: +y forward, +x right, +z up; the world's heading-forward is +x at heading 0)
    return [t.pos[0] + c * m[1] + s * m[0], t.pos[1] + s * m[1] - c * m[0], t.pos[2] + m[2]];
  }
  const TRIGGER = { armR: 'fire', armL: 'alt', backR: 'backR', backL: 'backL' };
  function fireSlot(e, slot, W, state, world, inp, dt) {
    if (!W.st) W.st = { ammo: W.mag ?? 9999, cd: 0, rl: 0, charge: 0 };
    const S = W.st;
    S.cd = Math.max(0, S.cd - dt);
    if (S.rl > 0) { S.rl = Math.max(0, S.rl - dt); if (S.rl === 0) S.ammo = W.mag ?? 9999; }
    const held = !!inp[TRIGGER[slot]], edge = held && !S.prev;
    S.prev = held;
    if (S.rl > 0 || S.ammo <= 0) { if (S.ammo <= 0 && !(S.rl > 0) && (W.reload ?? 0) > 0) S.rl = W.reload; return; }
    // (a blade: its trigger lunges onto the foe; the cut is landed as the lunge meets it)
    if (W.fire === 'melee') {
      if (edge && S.cd <= 0 && !e.lunge && !(e.stagger > 0) && (!W.energy || e.en >= W.energy)) {
        if (W.energy) { e.en -= W.energy; e.enLast = e.frTime; }
        lungeFrom(e, world, { by: slot, damage: W.damage, impact: W.stagger, range: W.range, speed: W.speed });
        S.cd = W.cooldown ?? 1.6; S.shots = (S.shots || 0) + 1; e.lastShot = { slot, t: state.time };
      }
      return;
    }
    let go = false, mul = 1;
    if (W.fire === 'auto') go = held && S.cd <= 0;
    else if (W.fire === 'charge') {
      if (held) { S.charge = Math.min(1, S.charge + dt / (W.chargeTime ?? 0.8)); return; }
      if (!held && S.charge > 0) { go = S.cd <= 0; mul = 0.4 + 0.6 * S.charge; S.charge = 0; }
    } else go = edge && S.cd <= 0;
    if (!go) return;
    const EN = e.rule.en || {};
    if (W.energy) {
      if (e.en < W.energy * mul) return;
      e.en -= W.energy * mul; e.enLast = e.frTime;
    }
    const t = e.transform, m = (e.rule.mounts && e.rule.mounts[slot]) || [slot.endsWith('R') ? 2.4 : -2.4, 3, slot.startsWith('back') ? 8.6 : 6.2];
    const from = mountAt(e, m), tg = e.locked && world.byId[e.lockOn];
    const n = W.salvo || 1;
    // (unlocked, the pilot's guns meet at what the reticle covers: sightPoint; a mind's, along its aim)
    const sight = !tg && Array.isArray(inp.aim) && inp.aim.length === 6 && inp.aim.every(Number.isFinite) ? sightPoint(e, world, inp.aim, W.range ?? 400) : null;
    for (let k = 0; k < n; k++) {
      // (a mind's guns fire at where the target is as they fire, not where it will be, so a round can be dodged: its
      // mind's `leadShots` leads them; the pilot's lock leads)
      let to = tg ? (e.rule.mind && !e.rule.mind.leadShots ? lead(from, tg, Infinity) : lead(from, tg, W.speed)) : sight;
      if (!to) { const a = aimDir(t.heading, e.aimPitch), R = W.range ?? 400; to = [from[0] + a[0] * R, from[1] + a[1] * R, from[2] + a[2] * R]; }
      const pellets = W.pellets || 1;
      for (let p = 0; p < pellets; p++) {
        const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]], L = Math.hypot(d[0], d[1], d[2]) || 1;
        // (a shotgun's pellets and a salvo's missiles fan by their own dice; a gun's rounds by a little)
        const spread = W.pellets ? 0.06 : W.salvo ? 0.18 : W.spread ?? 0.008, a1 = (dice(e) - 0.5) * 2 * spread, a2 = (dice(e) - 0.5) * 2 * spread;
        const u = [d[0] / L + a1 * Math.sin(t.heading), d[1] / L - a1 * Math.cos(t.heading), d[2] / L + a2], ul = Math.hypot(u[0], u[1], u[2]) || 1;
        const lob = W.kind === 'grenade' || W.kind === 'bazooka';
        const vel = [(u[0] / ul) * W.speed, (u[1] / ul) * W.speed, (u[2] / ul) * W.speed];
        // (a lobbed round aimed over its fall: the time to its mark, and up by half its drop)
        const grav = lob ? (e.rule.gravity ?? GRAV) * 0.5 : 0;
        if (grav) vel[2] += 0.5 * grav * (L / W.speed);
        state.projectiles.push({
          id: 'proj-' + (state.projSeq++), owner: e.id, pos: from.slice(), vel, gravity: grav,
          splashRadius: W.splash || 0, projRadius: W.radius ?? (W.splash ? 1.2 : 0.8), prox: W.kind === 'missiles' ? 3 : 0,
          damage: (W.damage || 0) * mul, impact: W.stagger || 0, born: state.time, age: 0, armTime: 0.05, fuse: (W.range ?? 400) / Math.max(1, W.speed) * 1.6,
          noGround: true, frameRound: true, hitsAs: 1, passTeam: true, foeRound: !!e.rule.mind,
          homing: W.homing && tg ? { target: tg.id, turn: W.homing } : null, missile: W.kind === 'missiles',
          smokeTrail: W.kind === 'missiles' || W.kind === 'bazooka', fxColor: W.color ?? null, fxScale: W.fxScale ?? null,
        });
      }
    }
    // (its handling: a braced shot sticks the frame and winds it down, a dragging one holds its boost back)
    const steadyK = e.rule.steady ?? 1;
    if (W.handling === 'brace') {
      const T = (W.brace ?? 0.5) * steadyK, Wd = (W.wind ?? 0.6) * steadyK;
      e.brace = { T: Math.max(T, (e.brace && e.brace.T) || 0), W: Wd, Wmax: Wd, of: slot };
      e.ab = false; e.boosting = false;
    } else if (W.handling === 'drag') { e.dragT = 0.3; e.dragK = W.drag ?? 0.7; }
    S.ammo -= 1; S.shots = (S.shots || 0) + 1;
    S.cd = W.fire === 'auto' ? 1 / (W.rof || 6) : (W.cooldown ?? 0.6);
    e.lastShot = { slot, t: state.time };
  }
  // the lunge's blow: met (its foe's egg within reach of the frame's front), its damage and its impact on the foe's bar,
  // a break or a kill armed as a round's is (the engine's reaction; a frame takes it as its reel), a spark where it struck
  function landLunge(e, state) {
    const L = e.lunge;
    if (!L || L.hit || !L.to) return;
    const tg = state.byId[L.to];
    if (!tg || tg.gone || tg.downed || !(tg.body && tg.body.hittable)) { e.lunge = null; return; }
    const p = e.transform.pos, q = tg.transform.pos, h = (tg.body.aimH ?? 2), reach = (tg.body.radius || 3) + 4.5;
    const at = [q[0], q[1], q[2] + h], me = [p[0], p[1], p[2] + (e.rule.eyeH ?? 7) * 0.6];
    if (Math.hypot(at[0] - me[0], at[1] - me[1], at[2] - me[2]) > reach + h * 0.5) return;
    L.hit = true; L.T = Math.min(L.T, 0.08);
    // (a frontal shield is no guard against a lunge: the blow knocks it aside, its break the engine's, a stagger)
    if (tg.shieldHp > 0 && !tg.shieldBroken) { tg.shieldHp = 0; tg.shieldBroken = true; tg.shieldBreakAt = state.time; state.shieldBreaks = (state.shieldBreaks || 0) + 1; E.armReaction(tg, 'stagger'); }
    if (Number.isFinite(tg.body.hp)) tg.body.hp = Math.max(0, tg.body.hp - L.damage);
    tg.hitFlash = state.time; tg.hits = (tg.hits || 0) + 1; tg.lastHitBy = e.id; tg.lastHitDmg = L.damage;
    if (Number.isFinite(tg.poise) && tg.staggerT == null && !(tg.stagger > 0)) tg.poise -= L.impact;
    if ((Number.isFinite(tg.poise) && tg.poise <= 0) || (Number.isFinite(tg.body.hp) && tg.body.hp <= 0)) E.armReaction(tg, 'stagger');
    // (and the blow's spark: the world's burst at the point it struck, the frame carried back off it)
    if (!state.bursts) { state.bursts = []; state.burstSeq = 0; }
    state.bursts.push({ seq: state.burstSeq++, pos: [(at[0] + me[0]) / 2, (at[1] + me[1]) / 2, (at[2] + me[2]) / 2], t: state.time, radius: 3, fxColor: L.by === 'kick' ? 0xffd9a0 : 0xfff0d0, fxScale: 0.8 });
    if (e.v) { e.v[0] *= -0.15; e.v[1] *= -0.15; e.v[2] = Math.max(e.v[2] * 0.2, 2); }
    e.lastHit = { by: L.by, to: tg.id, t: state.time };
  }
  E.registerEntityAction('frame-weapons', (e, input, dt, state, world, owns) => {
    if (!(e.rule && e.rule.type === 'frame') || !e.rule.slots || owns.reaction || owns.drop || owns.cine || e.downed || e.gone) return;
    // (reeling: its triggers are dead, but its guns' timers still run, a reload finished in the reel)
    if (e.stagger > 0) { for (const slot of ['armR', 'armL', 'backR', 'backL']) { const W = e.rule.slots[slot]; if (W && W.st) { W.st.cd = Math.max(0, W.st.cd - dt); if (W.st.rl > 0) { W.st.rl = Math.max(0, W.st.rl - dt); if (W.st.rl === 0) W.st.ammo = W.mag ?? 9999; } W.st.prev = false; } } return; }
    if (!state.projectiles) { state.projectiles = []; state.bursts = []; state.projSeq = 0; state.burstSeq = 0; }
    landLunge(e, state);
    const mine = !e.rule.mind && (state.pilotId === e.id || E.seated(state, e));
    const inp = e.rule.mind ? (e.frInput || {}) : mine ? input : {};
    const slots = e.rule.slots, st = {};
    for (const slot of ['armR', 'armL', 'backR', 'backL']) {
      const W = slots[slot];
      if (!W) continue;
      fireSlot(e, slot, W, state, world, inp, dt);
      st[slot] = { ammo: W.st.ammo, mag: W.mag ?? 9999, reloading: W.st.rl > 0, cd: Math.round(W.st.cd * 100) / 100, charge: Math.round((W.st.charge || 0) * 100) / 100 };
    }
    e.slotState = st;
  }, 12);
  // ── a launcher's missiles on a frame's field (an ai's `rule.missiles` with an `impact`, a Hammer's): each launched round
  // carries its launcher's impact before any burst is judged, so it chips a frame's bar as a round does; the engine's
  // launcher fires them with none, and a burst with none breaks a bar outright (combat-ranged.js burstProjectile) ──
  E.registerWorldPass('frame-missiles', (state) => {
    const ps = state.projectiles;
    if (!ps || !ps.length) return;
    for (const p of ps) {
      if (!p.missile || p.frameImpact) continue;
      p.frameImpact = true;
      const o = state.byId && state.byId[p.owner], m = o && o.rule && o.rule.missiles;
      if (m && m.impact > 0 && !(p.impact > 0)) p.impact = m.impact;
    }
  }, 20);
  // ── a shield raised again (a body's `rule.shieldRaise` s after it was broken, a Bastion's): the punish window shuts ──
  E.registerWorldPass('frame-shields', (state) => {
    for (const e of state.entities) {
      if (!e.shieldBroken || !(e.rule && e.rule.shieldRaise > 0) || e.gone || e.downed) continue;
      if (state.time - (e.shieldBreakAt || 0) >= e.rule.shieldRaise) { e.shieldBroken = false; e.shieldHp = e.shieldMax; }
    }
  }, 21);
  // ── a flier's flight over a frame's field (an ai in the air with a `flight`, a Wasp's, a Kite's, a gunship's): the AI aims
  // it and fires it; this flies it, its rule's own speed nothing. A STRAFE dives from its height at a point beside the
  // pilot, rakes past it low, pulls up and out, and comes round again; a PERCH holds a point high and far off the pilot,
  // drifting to a new one now and then; a CIRCUIT orbits the pilot at its radius and height, tighter as it is hurt, and
  // every so often stops and hangs to barrage. Each steers its own velocity toward where it wants to be, at its speed and
  // turn, and faces its flight where it is running, not the pilot ──
  const FLIGHT = { strafe: flyStrafe, perch: flyPerch, circuit: flyCircuit, orbit: flyOrbit };
  function flyStrafe(e, F, P, ground) {
    const S = e.flight, p = e.transform.pos, q = P.transform.pos;
    if (!S.phase || S.phase === 'in' && !S.at) {
      // (a run's mark: beside the pilot by a share of its own dice, low over the land there)
      const side = dice(e) < 0.5 ? -1 : 1, d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, ux = (q[0] - p[0]) / d, uy = (q[1] - p[1]) / d;
      const x = q[0] - uy * side * (12 + 18 * dice(e)), y = q[1] + ux * side * (12 + 18 * dice(e));
      S.phase = 'in'; S.at = [x, y, (ground(x, y) ?? 0) + (F.low ?? 12)]; S.dir = [ux, uy];
    }
    if (S.phase === 'in') {
      const d = Math.hypot(S.at[0] - p[0], S.at[1] - p[1]);
      if (d < 18 || (p[0] - S.at[0]) * S.dir[0] + (p[1] - S.at[1]) * S.dir[1] > 0) {
        // (past its mark: out along the run and up, to come round)
        const o = F.out ?? 250, x = S.at[0] + S.dir[0] * o, y = S.at[1] + S.dir[1] * o;
        S.phase = 'out'; S.at = [x, y, (ground(x, y) ?? 0) + (F.alt ?? 45)];
      }
    } else if (Math.hypot(S.at[0] - p[0], S.at[1] - p[1]) < 30) { S.phase = 'in'; S.at = null; return null; }
    return { at: S.at, speed: F.speed ?? 60, face: S.phase === 'out' };
  }
  function flyPerch(e, F, P, ground, dt) {
    const S = e.flight, q = P.transform.pos;
    S.T = (S.T ?? 0) - dt;
    if (!S.at || S.T <= 0) {
      const a = (S.a ?? dice(e) * Math.PI * 2) + (dice(e) - 0.5) * 1.6, R = (F.range ?? 300) * (0.85 + 0.3 * dice(e));
      const x = q[0] + Math.cos(a) * R, y = q[1] + Math.sin(a) * R;
      S.a = a; S.T = F.every ?? 9; S.at = [x, y, (ground(x, y) ?? 0) + (F.alt ?? 70)];
    }
    return { at: S.at, speed: F.speed ?? 18, face: false };
  }
  function flyCircuit(e, F, P, ground, dt) {
    const S = e.flight, q = P.transform.pos, share = e.body && e.body.hpMax > 0 ? Math.max(0, e.body.hp / e.body.hpMax) : 1;
    // (hurt, its circuit tightens and it hangs to barrage more often)
    const H = F.hover || [3.5, 11], R = (F.radius ?? 170) * (0.55 + 0.45 * share), every = H[1] * (0.55 + 0.45 * share);
    S.T = (S.T ?? every) - dt;
    if (S.hang > 0) { S.hang -= dt; if (S.hang <= 0) S.T = every; return { at: null, speed: 0, face: false }; }
    if (S.T <= 0) { S.hang = H[0]; e.hanging = true; return { at: null, speed: 0, face: false }; }
    e.hanging = false;
    S.th = (S.th ?? Math.atan2(e.transform.pos[1] - q[1], e.transform.pos[0] - q[0])) + ((F.speed ?? 24) / R) * dt * (S.dirn ?? 1);
    const x = q[0] + Math.cos(S.th) * R, y = q[1] + Math.sin(S.th) * R;
    return { at: [x, y, (ground(x, y) ?? 0) + (F.alt ?? 42)], speed: (F.speed ?? 24) * 1.4, face: false };
  }
  function flyOrbit(e, F, P, ground, dt) {
    // (an orbit: a quad drone drifting round the pilot at height, its nose (the AI's aim) on it, never stopping; hurt, it
    // tightens and comes down)
    const S = e.flight, q = P.transform.pos, share = e.body && e.body.hpMax > 0 ? Math.max(0, e.body.hp / e.body.hpMax) : 1;
    const R = (F.radius ?? 260) * (0.6 + 0.4 * share), sp = F.speed ?? 44;
    S.th = (S.th ?? Math.atan2(e.transform.pos[1] - q[1], e.transform.pos[0] - q[0])) + (sp / R) * dt;
    const x = q[0] + Math.cos(S.th) * R, y = q[1] + Math.sin(S.th) * R;
    return { at: [x, y, (ground(x, y) ?? 0) + (F.alt ?? 115) * (0.6 + 0.4 * share)], speed: sp * 1.4, face: false };
  }
  E.registerWorldPass('frame-flight', (state, input, dt, world) => {
    if (!world || !world.ground || !(dt > 0)) return;
    const P = state.byId && state.byId[state.pilotId];
    if (!P || P.gone || P.downed) return;
    const ground = (x, y) => world.ground([x, y, 2000]);
    for (const e of state.entities) {
      const r = e.rule, F = r && r.flight;
      if (!F || r.type !== 'ai' || e.gone || e.downed || e.dormant || e.staggerT != null || !FLIGHT[F.mode]) continue;
      if (!e.flight) e.flight = { v: [0, 0, 0] };
      const W = FLIGHT[F.mode](e, F, P, ground, dt), v = e.flight.v, p = e.transform.pos;
      if (!W) continue;
      // (its velocity steered toward its mark at its speed, as fast as its turn lets it; none: it brakes and hangs)
      const want = W.at ? (() => { const d = [W.at[0] - p[0], W.at[1] - p[1], W.at[2] - p[2]], n = Math.hypot(d[0], d[1], d[2]) || 1, sp = Math.min(W.speed, n / Math.max(dt, 0.05)); return [d[0] / n * sp, d[1] / n * sp, d[2] / n * sp]; })() : [0, 0, 0];
      const k = Math.min(1, (F.turn ?? 1.6) * dt);
      for (let i = 0; i < 3; i++) v[i] += (want[i] - v[i]) * k;
      p[0] += v[0] * dt; p[1] += v[1] * dt; p[2] += v[2] * dt;
      if (W.face && Math.hypot(v[0], v[1]) > 2) e.transform.heading = Math.atan2(v[1], v[0]);
      e.moving = true;
      // (its rotors: the figure's spin clip, `roll`, at `spin` turns a second)
      if (F.spin > 0) { e.locomotion = 'roll'; e.gaitPhase = (state.time * F.spin) % 1; }
    }
  }, 29);
  // ── guns slung forward (a flight's `under`): they cannot bear more than `under` degrees below it, so a pilot right
  // under the gunship is not fired on while it stays there (`blind`); before the weapons, so the trigger it gives is held ──
  E.registerEntityAction('frame-broadside', (e, input, dt, state) => {
    const F = e.rule && e.rule.flight;
    if (!F || !(F.under > 0) || e.rule.type !== 'ai') return;
    const P = state.byId && state.byId[state.pilotId];
    if (!P) return;
    const p = e.transform.pos, q = P.transform.pos, d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    e.blind = (Math.atan2(p[2] - q[2], d) * 180) / Math.PI > F.under;
    if (e.blind) { e.aiFire = 0; if (e.missileCd != null) e.missileCd = Math.max(e.missileCd, 0.5); }
  }, 9);
  // ── a flier over a frame's field (an ai in the air with a `floor`, a Gnat's): held that many metres over the land under
  // it, so a swarm closing on a frame on its feet weaves over it and never through a hill ──
  E.registerWorldPass('frame-fliers', (state, input, dt, world) => {
    if (!world || !world.ground) return;
    for (const e of state.entities) {
      const r = e.rule;
      if (!r || r.type !== 'ai' || !r.space || !(r.floor > 0) || e.gone || e.downed) continue;
      const p = e.transform.pos, g = world.ground([p[0], p[1], p[2] + 60]);
      if (g != null && p[2] < g + r.floor) p[2] = g + r.floor;
    }
  }, 30);
  // ── a frame's rounds meet the terrain: burst where they cross it (the world's z = 0 is not its ground) ──
  E.registerWorldPass('frame-rounds', (state, input, dt, world) => {
    const ps = state.projectiles;
    if (!ps || !ps.length || !world || !world.ground) return;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      if (!p.frameRound || p.age < 0.05) continue;
      const g = world.ground([p.pos[0], p.pos[1], p.pos[2] + 40]);
      if (g != null && p.pos[2] <= g) { p.pos[2] = g; E.burstProjectile(state, p); ps.splice(i, 1); }
    }
  }, 31);

  Object.assign(RULES, { frame });
}
