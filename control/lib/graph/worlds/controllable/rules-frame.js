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
 *   • A MIND (`mind` { range?, aggression?, dodge? }): an enemy frame's own keys: it keeps its range to the pilot,
 *     strafing round it and boosting, quick-boosting out of the way of a shot it sees coming or as it is hit, climbing at
 *     times, firing what is in range while it holds its lock. Not the pilot's input: its own.
 *
 * Facts: speed, airborne, agl, en, enMax, enOut, boosting, qbT, ascending, landT, lockOn, locked, lockT, aimPitch,
 * slotState { <slot>: { ammo, mag, reloading, cd, charge } }, locomotion (the body's clip: idle, forward, boost,
 * boost_left, boost_right, boost_back, hover, fall, land), gaitPhase, moving.
 *
 * Pure + deterministic: reads the input snapshot, world.ground and the bodies; its dice are its own (seeded by its id).
 * BUILDER CONTRACT (compose.js): import-free inside the function.
 */

export function buildRulesFrame(E) {
  const { clamp, RULES } = E;
  const GRAV = 9.81;

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

  // ── a mind's keys: an enemy frame's own input, read off the pilot ──
  function mindInput(e, dt, world) {
    const M = e.rule.mind, P = world.pilotId && world.byId[world.pilotId];
    const out = { forward: 0, strafe: 0, boost: 0, qb: 0, jump: 0, jumpHeld: 0, fire: 0, alt: 0, backR: 0, backL: 0, lookDX: 0, lookDY: 0 };
    if (!P || P.gone || P.downed || world.aiEnabled === false || e.dormant) return out;
    const t = e.transform, q = P.transform.pos, dx = q[0] - t.pos[0], dy = q[1] - t.pos[1], dz = q[2] - t.pos[2], d = Math.hypot(dx, dy);
    e.mindFace = Math.atan2(dy, dx); e.mindPitch = Math.atan2(dz, d || 1);
    const range = M.range ?? 120;
    // (round the pilot: in toward its range, out from it, across it the way it is going, the way turned now and then)
    if (e.mindDir == null || (e.mindTurnT = (e.mindTurnT ?? 0) - dt) <= 0) { e.mindDir = dice(e) < 0.5 ? -1 : 1; e.mindTurnT = 2.5 + 3 * dice(e); }
    out.forward = d > range * 1.25 ? 1 : d < range * 0.7 ? -1 : 0;
    out.strafe = e.mindDir;
    out.boost = (M.aggression ?? 0.6) > 0.3 || d > range * 1.5 ? 1 : 0;
    // (a quick boost out of the way: as it is hit, or now and then when it is in the pilot's sights)
    const hitNow = e.hitFlash != null && e.hitFlash !== e.mindHitSeen;
    if (hitNow) e.mindHitSeen = e.hitFlash;
    if ((hitNow && dice(e) < (M.dodge ?? 0.5)) || dice(e) < dt * 0.25) { out.qb = 1; out.strafe = dice(e) < 0.5 ? -1 : 1; out.forward = 0; }
    // (up at times, and down again)
    if ((e.mindClimbT = (e.mindClimbT ?? 1 + 4 * dice(e)) - dt) <= 0) { e.mindClimbFor = 0.8 + 1.2 * dice(e); e.mindClimbT = 4 + 6 * dice(e); }
    if (e.mindClimbFor > 0) { e.mindClimbFor -= dt; out.jump = out.jumpHeld = 1; }
    // (its guns: those in range, while it holds its lock)
    if (e.locked) { out.fire = d < 420 ? 1 : 0; out.alt = d < 320 && dice(e) < 0.5 ? 1 : 0; out.backR = dice(e) < dt * 0.6 ? 1 : 0; out.backL = dice(e) < dt * 0.3 ? 1 : 0; }
    return out;
  }

  function frame(e, input, dt, world) {
    const r = e.rule, t = e.transform, M = r.move || {}, EN = r.en || {}, C = EN.cost || {};
    const mine = !r.mind;
    const inp = mine ? input : mindInput(e, dt, world);
    e.frInput = inp;
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
    if (qbEdge && e.qbCd <= 0 && enOk && !(e.landT > 0) && draw(C.qb ?? 600)) {
      const d = dir || [-fx, -fy];
      e.qbDir = d; e.qbT = M.qbTime ?? 0.24; e.qbCd = (M.qbTime ?? 0.24) + (M.qbCool ?? 0.42);
      e.v[0] = d[0] * (M.qb ?? 96); e.v[1] = d[1] * (M.qb ?? 96);
      if (!onGround && e.v[2] < 0) e.v[2] *= 0.3;
    }
    const inQb = e.qbT > 0;
    if (inQb) e.qbT = Math.max(0, e.qbT - dt);

    // ── the boost: held, a skate (or a push across the air), drawing a little ──
    e.boosting = !!inp.boost && enOk && !(e.landT > 0) && draw((C.boost ?? 260) * dt);
    // ── jump and climb ──
    const jumpEdge = !!inp.jump && !e.jumpPrev;
    e.jumpPrev = !!inp.jump;
    if (onGround && jumpEdge && !(e.landT > 0)) { e.v[2] = M.jump ?? 13; e.jumpedAt = e.frTime; }
    e.ascending = !onGround && !!(inp.jumpHeld || inp.jump) && enOk && e.frTime - (e.jumpedAt ?? -9) > 0.12 && draw((C.ascend ?? 520) * dt);

    // ── the horizontal: eased toward what it wants, hard on the booster, soft on its feet, little in the air ──
    if (!inQb) {
      const sp = e.boosting ? (M.boost ?? 46) : onGround ? (M.walk ?? 11) * (e.landT > 0 ? 0.25 : 1) : 0;
      const want = e.boosting ? (dir || [fx, fy]) : dir;
      const tx = want ? want[0] * sp : (onGround ? 0 : e.v[0]), ty = want ? want[1] * sp : (onGround ? 0 : e.v[1]);
      const k = Math.min(1, (e.boosting ? (onGround ? 5 : 3) : onGround ? 7 : 0.6) * dt);
      e.v[0] += (tx - e.v[0]) * k; e.v[1] += (ty - e.v[1]) * k;
    }
    // ── the vertical: gravity, the climb over it, the boost's glide ──
    if (onGround && e.v[2] <= 0) e.v[2] = 0;
    else {
      let az = -g;
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
    if (t.pos[2] <= g2) {
      const fall = -e.v[2];
      t.pos[2] = g2;
      if (fall > (r.hardLand ?? 18)) { e.landT = M.land ?? 0.35; e.landed = e.frTime; }
      e.v[2] = 0;
    }
    // (a bound to the field: the level's arena, where it says one)
    if (r.bound) { const B = r.bound; t.pos[0] = clamp(t.pos[0], B[0], B[2]); t.pos[1] = clamp(t.pos[1], B[1], B[3]); }
    e.landT = Math.max(0, e.landT - dt);

    // ── the FCS: the foe nearest the aim, held to lock ──
    const F = r.fcs || {}, aim = aimDir(t.heading, e.aimPitch), eye = [t.pos[0], t.pos[1], t.pos[2] + (r.eyeH ?? 7)];
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
    e.gaitPhase = (e.gaitPhase || 0) + (e.locomotion === 'forward' ? hs / (r.stride ?? 9) : e.boosting ? 1.2 * dt : 0.4 * dt);
  }

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
    for (let k = 0; k < n; k++) {
      let to = tg ? lead(from, tg, W.speed) : null;
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
    S.ammo -= 1; S.shots = (S.shots || 0) + 1;
    S.cd = W.fire === 'auto' ? 1 / (W.rof || 6) : (W.cooldown ?? 0.6);
    e.lastShot = { slot, t: state.time };
  }
  E.registerEntityAction('frame-weapons', (e, input, dt, state, world, owns) => {
    if (!(e.rule && e.rule.type === 'frame') || !e.rule.slots || owns.reaction || owns.drop || owns.cine || e.downed || e.gone) return;
    if (!state.projectiles) { state.projectiles = []; state.bursts = []; state.projSeq = 0; state.burstSeq = 0; }
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
