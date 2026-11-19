/**
 * knockout.js — TWO WAYS DOWN: a body is KILLED by what kills (a gun's round: it falls and goes, vanish.js) or KNOCKED
 * OUT by stun (the pilot's blows, its takedown, a sleep dart): asleep where it lies, for good, until a teammate finds it
 * and wakes it. A sleeper the pilot drags out of every watcher's sight is never found. Opt-in on the pilot's rule:
 *
 *   rule.knockout: true | {
 *     melee?: 30,       the stun a blow of the pilot's deals, per point of what it would have hurt (a fist's jab 1: 30;
 *                       a body's most, its hpMax, knocks it out: three blows of a combo). `false`: its blows hurt
 *     drowse?: 3,       seconds a dart in the body takes to put it to sleep (it looks round meanwhile: startle.js)
 *     head?: 0.5,       … a dart in the head
 *     recover?: 10,     the stun a body shakes off a second, once `calm` seconds (4) have passed since the last
 *     lay?: 0.7,        seconds it takes to go down onto its back
 *     wake?: 2.5,       seconds a teammate kneels over it to wake it; `rise` (0.9) to stand again
 *     drag?: { reach?: 1.6, speed?: 1.4, back?: 1.1 }   the action within `reach` m of a sleeper takes hold of it (where
 *                       no takedown is to be had); it trails `back` m behind, the pilot slowed to `speed` m/s and
 *                       holding its fire; the action again lets go
 *   }
 *
 * What stuns: a blow of the pilot's (melee: a fist, a knife, a kick) and a round from a loadout slot whose weapon says
 * `stun: true` (the sleep dart, gameworld/arms-kit.js `dart`): what it hurt is given back, and stun taken in its place.
 * The pilot's takedown (takedown.js) knocks out at once. Every other round hurts as it always did.
 *
 * A SLEEPER (e.ko { t0, by, how }) is downed (no mind steps it, no gun aims at it), held (its rule never runs), laid on its
 * back (e.tumble, over `lay`), and kept: its disposal (body.vanish) is put by until it wakes, and the alarm (alarm.js)
 * never counts it as a body found. A live teammate (a body with a mind, its team's) that sees it (its reach, its cone,
 * a clear line to the body lying there, colliders and tall grass: veil.js) goes to where it saw it (e.koWake), kneels
 * over it for `wake` s and wakes it: both search round there, and the team's alarm is raised (a body). A sleeper gone
 * from where it was seen when the waker gets there is searched for there instead; a waker that sees the pilot drops it.
 *
 *   E.knockOut(state, body, by, how)   knock a body out now (the takedown's)
 *   E.koDragTarget(state, pilot)       the sleeper the action would take hold of now, or null (the page's prompt)
 *
 * Field ownership: on a target e.ko, e.koStun, e.koHitT, e.koDrowse ({ t, of }), e.koLay, e.koRise, e.koVanish,
 * e.koWaker, e.koDragged; on a waker e.koWake ({ id, at, phase, t }); on the pilot p.koDrag (the sleeper's id),
 * p.koActPrev, p.kos, p.kills. It sets `held` on the bodies it moves itself (cast.js's hold: their rule is not run).
 *
 * Wraps stepWorld, outermost (compose.js lists it last): its before runs first and its after last, so it sees every hurt
 * the step dealt. Import-free (the page runs this source via toString(), compose.js); emitted only into a page whose
 * world has a rule with `knockout`, so every other page keeps every byte.
 */
export function buildKnockout(E) {
  const step = E.stepWorld;
  const D = { melee: 30, drowse: 3, head: 0.5, recover: 10, calm: 4, lay: 0.7, wake: 2.5, rise: 0.9, drag: { reach: 1.6, speed: 1.4, back: 1.1 } };
  const cfgOf = (p) => { const K = p && p.rule && p.rule.knockout; if (!K) return null; const k = K === true ? {} : K; return { ...D, ...k, drag: { ...D.drag, ...(k.drag || {}) } }; };
  const pilotOf = (state) => (state.pilotId ? state.byId[state.pilotId] : null);
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const ease = (u) => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };
  const eyeH = (b) => (b.rule && b.rule.collideHeight != null ? b.rule.collideHeight : 1.8) * 0.75 - ((b.rule && b.rule.eye) || 0);
  const isMind = (e) => !!(e.rule && e.rule.type === 'ai');
  const awake = (e) => !(e.downed || e.gone || e.dormant || e.ko || (e.body && Number.isFinite(e.body.hp) && e.body.hp <= 0));
  // (a body lying there: the point a watcher's line is drawn to, a little over its ground)
  const LYING = 0.35;

  // the team's alarm raised, a body found (alarm.js's own state, as its raise sets it)
  function raise(state, team, at) {
    const S = state.alarm && state.alarm[team || '_']; if (!S) return;
    const W = state.entities.find((e) => e.rule && e.rule.alarm && (e.team || '_') === (team || '_')), C = (W && W.rule.alarm) || {};
    if (S.phase === 'clear') { S.phase = 'detected'; S.full = C.detected ?? 40; S.left = S.full; S.cause = 'body'; S.at = at.slice(); }
    else if (S.phase === 'detected') { S.left = S.full; S.cause = 'body'; S.at = at.slice(); }
  }
  // a watcher sent to search round a place (alert.js's search, mind.js's memory)
  function search(state, e, at) {
    const p = pilotOf(state);
    e.lastSeen = { pos: at.slice(), t: (state.time || 0) - 0.5, id: p ? p.id : null }; e.searchT = null;
    if (e.alert && e.alert.level === 'calm') { e.alert.level = 'search'; e.alert.t = 0; }
  }
  function release(state, w) {
    const s = w.koWake && state.byId[w.koWake.id];
    if (s && s.koWaker === w.id) s.koWaker = null;
    w.koWake = null; w.held = false; w.moving = false; w.locomotion = 'forward';
  }

  E.knockOut = function knockOut(state, tg, by, how) {
    if (!tg || tg.ko || tg.gone) return;
    tg.ko = { t0: state.time || 0, by: by ? by.id : null, how: how || 'stun' };
    tg.koDrowse = null; tg.downed = true; tg.deadAt = null; tg.moving = false; tg.route = null; tg.aiFire = 0;
    tg.staggerT = null; tg.reactClip = null; tg.downPauseT = null; tg.juggle = null; tg.locomotion = 'idle';
    tg.alarmFound = true; tg.koLay = 0; tg.koRise = null; tg.held = true; tg.vanishT = 0;
    if (tg.body && tg.body.vanish) { tg.koVanish = tg.body.vanish; tg.body.vanish = null; }
    if (by) { tg.lastHitBy = by.id; by.kos = (by.kos || 0) + 1; }
    if (tg.koWake) release(state, tg);
  };
  function wakeUp(state, s, w) {
    const at = s.transform.pos.slice();
    s.ko = null; s.downed = false; s.deadAt = null; s.koStun = 0; s.koDrowse = null; s.alarmFound = false; s.vanishT = 0;
    if (s.koVanish) { s.body.vanish = s.koVanish; s.koVanish = null; }
    s.koRise = { t: 0 }; s.koWaker = null;
    search(state, s, at); if (w) search(state, w, at);
    raise(state, s.team, at);
  }
  // can a watcher see a body lying at q? its reach and cone (widened as alarm.js widens them), a clear line
  function seesLying(e, q, state) {
    const t = e.transform, r = e.rule, g = e.alarmGain || 1, dx = q[0] - t.pos[0], dy = q[1] - t.pos[1], d = Math.hypot(dx, dy);
    if (d > (r.sightRange ?? 14) * g) return false;
    if (d > 1.2 && Math.abs(wrap(Math.atan2(dy, dx) - t.heading)) > (r.sightCone ?? 0.6)) return false;
    const a = [t.pos[0], t.pos[1], t.pos[2] + eyeH(e)], b = [q[0], q[1], q[2] + LYING];
    if (state.colliders && E.sightBlocked && E.sightBlocked(a, b, state.colliders)) return false;
    if (state.veils && E.veilBlocked && E.veilBlocked(a, b, state.veils)) return false;
    return true;
  }
  E.koDragTarget = (state, p) => {
    const K = cfgOf(p); if (!K || !p || p.downed || p.gone || p.koDrag) return null;
    const q = p.transform.pos; let best = null, bd = K.drag.reach;
    for (const e of state.entities) {
      if (!e.ko || e.gone || e.koDragged || e.koRise) continue;
      const d = Math.hypot(e.transform.pos[0] - q[0], e.transform.pos[1] - q[1]);
      if (d <= bd && Math.abs(e.transform.pos[2] - q[2]) < 1.2) { bd = d; best = e; }
    }
    return best;
  };

  // a waker's walk to where it saw the sleeper: straight on, turning as it goes, held off the colliders, on the ground
  function walk(e, goal, dt, state, hooks) {
    const t = e.transform, r = e.rule, sp = (r.speed > 0 ? r.speed : 1.6) * 1.4;
    const want = Math.atan2(goal[1] - t.pos[1], goal[0] - t.pos[0]), off = wrap(want - t.heading), turn = 4 * dt;
    t.heading = wrap(t.heading + Math.max(-turn, Math.min(turn, off)));
    let s = 0;
    if (Math.abs(off) < 1.1) { s = Math.min(sp * dt, Math.hypot(goal[0] - t.pos[0], goal[1] - t.pos[1])); t.pos[0] += Math.cos(t.heading) * s; t.pos[1] += Math.sin(t.heading) * s; }
    const eye = r.eye || 0;
    if (state.colliders && E.resolveBlocking) E.resolveBlocking(t.pos, t.pos[2] - eye, r.collideHeight ?? 1.8, r.collideRadius ?? 0.3, state.colliders, 0.35);
    const g = hooks && hooks.ground ? hooks.ground([t.pos[0], t.pos[1], t.pos[2] - eye + 0.6]) : null;
    if (g != null) t.pos[2] = g + eye;
    e.moving = s > 0; e.locomotion = 'forward'; e.gaitPhase = (e.gaitPhase || 0) + s / (r.stride ?? 1.6);
  }

  E.stepWorld = function stepWithKnockout(state, input, dt, hooks) {
    const p = pilotOf(state), K = cfgOf(p);
    if (!K) return step(state, input, dt, hooks);
    dt = dt || 1 / 60;
    const t0 = state.time || 0;
    // BEFORE: what each body's health is (what a blow of the pilot's took is given back after), the bodies it holds
    const hp0 = new Map();
    for (const e of state.entities) if (e !== p && e.body && Number.isFinite(e.body.hp)) hp0.set(e.id, { hp: e.body.hp, downed: !!e.downed });
    for (const e of state.entities) if (e.ko || e.koWake || e.koRise) e.held = true;
    // (the slot in hand: a dart is quiet, startle.js's hearing reads it off the live weapon)
    const slots = Array.isArray(p.rule.loadout) ? p.rule.loadout : null, slot = slots ? slots[p.loadoutIdx || 0] : null, SW = slot && slot.weapon;
    if (p.weapon && SW) p.weapon.quiet = !!SW.quiet;
    // THE HOLD: the action takes hold of a sleeper (no takedown to be had) or lets go of the one held; while it drags, the
    // pilot holds its fire
    let inp = input || {};
    const act = !!inp.act, edge = act && !p.koActPrev; p.koActPrev = act;
    if (edge && !p.downed && !p.gone) {
      if (p.koDrag) { const s = state.byId[p.koDrag]; if (s) s.koDragged = null; p.koDrag = null; inp = { ...inp, act: 0 }; }
      else if (!(E.takedownTarget && E.takedownTarget(state, p))) {
        const s = E.koDragTarget(state, p);
        if (s) { p.koDrag = s.id; s.koDragged = p.id; if (s.koWaker) { const w = state.byId[s.koWaker]; if (w) release(state, w); } inp = { ...inp, act: 0 }; }
      }
    }
    if (p.koDrag) inp = { ...inp, fire: 0, aim: 0, jump: 0, act: 0 };
    const from = p.transform.pos.slice();

    const out = step(state, inp, dt, hooks);
    const now = state.time || 0;

    // THE DRAG: the pilot no faster than it drags, the sleeper trailing behind it on the ground
    if (p.koDrag) {
      const s = state.byId[p.koDrag];
      if (!s || !s.ko || p.downed || p.gone) { if (s) s.koDragged = null; p.koDrag = null; }
      else {
        const q = p.transform.pos, dx = q[0] - from[0], dy = q[1] - from[1], d = Math.hypot(dx, dy), most = K.drag.speed * dt;
        if (d > most) { q[0] = from[0] + (dx / d) * most; q[1] = from[1] + (dy / d) * most; }
        const h = p.transform.heading, b = K.drag.back;
        s.transform.pos[0] = q[0] - Math.cos(h) * b; s.transform.pos[1] = q[1] - Math.sin(h) * b;
        const g = hooks && hooks.ground ? hooks.ground([s.transform.pos[0], s.transform.pos[1], q[2] + 1]) : null;
        s.transform.pos[2] = g != null ? g : q[2];
        s.transform.heading = h + Math.PI;   // (its head toward the hands that hold it)
      }
    }

    // STUN: a blow of the pilot's, or its dart, gives back what it hurt and stuns in its place
    for (const [id, was] of hp0) {
      const tg = state.byId[id]; if (!tg || tg.ko || !tg.body) continue;
      const lost = was.hp - tg.body.hp;
      if (!(lost > 1e-9) || tg.lastHitBy !== p.id) continue;
      const shot = p.lastShot && p.lastShot.t === t0 && p.lastShot.targetId === id;
      let stun = 0, drowse = 0;
      if (shot) { if (!(SW && SW.stun)) continue; stun = Number.isFinite(tg.lastHitDmg) ? tg.lastHitDmg : lost; drowse = tg.lastHitHead ? K.head : (SW.drowse ?? K.drowse); }
      else { if (K.melee === false) continue; stun = lost * K.melee; }
      tg.body.hp = was.hp;
      // (a blow that would have killed: not killed; its knockdown a reel)
      if (tg.downed && !was.downed) { tg.downed = false; tg.deadAt = null; tg.vanishT = 0; if (tg.reactClip === 'topple') { tg.reactClip = 'stagger'; tg.staggerT = 0; tg.reactDur = tg.staggerDur || 1.3; } }
      tg.koStun = (tg.koStun || 0) + stun; tg.koHitT = now;
      if (tg.koStun + 1e-9 >= (tg.hpMax || was.hp || 100)) {
        if (drowse > 0) { if (!tg.koDrowse || tg.koDrowse.of - tg.koDrowse.t > drowse) tg.koDrowse = { t: 0, of: drowse, by: p.id }; }
        else E.knockOut(state, tg, p, shot ? 'dart' : 'blow');
      }
    }
    // (what the pilot killed, counted)
    for (const [id, was] of hp0) { const tg = state.byId[id]; if (tg && tg.downed && !was.downed && !tg.ko && tg.lastHitBy === p.id) p.kills = (p.kills || 0) + 1; }

    for (const e of state.entities) {
      // a dart's sleep coming on; a stun shaken off
      if (e.koDrowse && !e.ko) { if (e.downed || e.gone) e.koDrowse = null; else if ((e.koDrowse.t += dt) >= e.koDrowse.of) E.knockOut(state, e, state.byId[e.koDrowse.by] || null, 'dart'); }
      if (!e.ko && e.koStun > 0 && !e.koDrowse && now - (e.koHitT ?? -1e9) > K.calm) e.koStun = Math.max(0, e.koStun - K.recover * dt);
      // A SLEEPER: still, on its back
      if (e.ko) {
        e.held = true; e.moving = false; e.locomotion = 'idle'; e.staggerT = null; e.aiFire = 0; e.downed = true;
        e.koLay = Math.min(1, (e.koLay || 0) + dt / Math.max(0.05, K.lay));
        const h = e.transform.heading;
        e.tumble = { axis: [-Math.sin(h), Math.cos(h), 0], angle: -(Math.PI / 2) * ease(e.koLay), at: 0.5, rise: 0.12 * ease(e.koLay) };
      } else if (e.koRise) {
        // RISING: off its back and on its feet, then its rule again
        e.koRise.t += dt; const u = 1 - ease(e.koRise.t / K.rise), h = e.transform.heading;
        e.moving = false; e.locomotion = 'idle';
        if (u <= 0) { e.koRise = null; e.tumble = null; e.held = false; }
        else e.tumble = { axis: [-Math.sin(h), Math.cos(h), 0], angle: -(Math.PI / 2) * u, at: 0.5, rise: 0.12 * u };
      }
    }

    // FOUND: a live teammate that sees a sleeper lying where it lies goes to wake it
    const sleepers = state.entities.filter((e) => e.ko && !e.gone && !e.koWaker && !e.koDragged);
    if (sleepers.length) {
      for (const w of state.entities) {
        if (!isMind(w) || !awake(w) || w.koWake || w.koRise || w.koDrowse || w === p) continue;
        if (w.lastSeen && p && w.lastSeen.id === p.id && now - w.lastSeen.t < 1) continue;   // (at the pilot: no time for it)
        for (const s of sleepers) {
          if (s.koWaker || (w.team || null) !== (s.team || null)) continue;
          if (!seesLying(w, s.transform.pos, state)) continue;
          w.koWake = { id: s.id, at: s.transform.pos.slice(), phase: 'go', t: 0 }; s.koWaker = w.id; w.held = true; w.route = null;
          raise(state, w.team, s.transform.pos);
          break;
        }
      }
    }
    // THE WAKER: to where it saw it, then over it for `wake` s
    for (const w of state.entities) {
      const W = w.koWake; if (!W) continue;
      const s = state.byId[W.id];
      if (!awake(w)) { release(state, w); continue; }
      if (p && w.lastSeen && w.lastSeen.id === p.id && now - w.lastSeen.t < 0.3) { release(state, w); continue; }   // (the pilot seen: the mind has it)
      W.t += dt;
      const there = s && s.ko && !s.koDragged && Math.hypot(s.transform.pos[0] - W.at[0], s.transform.pos[1] - W.at[1]) < 1.5;
      if (W.phase === 'go') {
        const goal = there ? s.transform.pos : W.at, d = Math.hypot(goal[0] - w.transform.pos[0], goal[1] - w.transform.pos[1]);
        if (d > 0.95 && W.t < 20) { walk(w, goal, dt, state, hooks); continue; }
        if (!there) { const at = W.at; release(state, w); search(state, w, at); continue; }   // (gone from where it lay: searched for)
        W.phase = 'wake'; W.t = 0;
      }
      if (!there) { const at = W.at; release(state, w); search(state, w, at); continue; }
      // (over it, turned to it: its own hands' gesture is the shake)
      w.transform.heading = Math.atan2(s.transform.pos[1] - w.transform.pos[1], s.transform.pos[0] - w.transform.pos[0]);
      w.moving = true; w.locomotion = 'gesture'; w.gaitPhase = W.t / K.wake;
      if (W.t >= K.wake) { release(state, w); wakeUp(state, s, w); }
    }
    return out;
  };
}
