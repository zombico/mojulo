/**
 * style.js — THE STYLE METER: how well the pilot is fighting, read off the world each step. A stylish action game's own
 * measure: not whether a foe falls but how. It rises on blows landed, more for a move not just used, for a blow in the
 * air, a launch, a weapon switched mid-string, a parry, a foe felled; it falls with time once nothing is landing, and
 * drops a whole tier on a hit taken. Its tiers are letters unless the game says its own words.
 *
 *   spec.styleMeter: {   (a world's own `style` is how it is drawn: the meter keeps its own word)
 *     tiers?    the tiers' names, lowest first (D, C, B, A, S)
 *     step?     the points a tier is (100)
 *     gain?     { hit: 12, air: 1.5 (× a blow landed off the ground), launch: 18 (a blow that launches), switch: 20 (a
 *               switch cancel), parry: 30, down: 15 (a foe felled by the pilot), shot: 3 (a round that lands) }
 *     repeat?   × a blow's gain for each time its move stands in the last `memory` moves (0.5): one string repeated
 *               earns less each time, a varied one its whole worth
 *     memory?   how many of the last moves are remembered (6)
 *     grace?    seconds after a gain before the meter starts to fall (2)
 *     decay?    points a second it falls after that (14)
 *   }
 *
 *     halo?    THE HALO METER, the power a stylish hero builds by fighting, in stocks, and the TRANSFORMATION it buys:
 *               { stocks: 3, per: 100 (the points a stock holds), hit: 6 (a blow landed, × air off the ground), hurt: 10
 *               (a hit taken), at: 3 (the stocks it takes to transform), drain: 0.4 (stocks a second while transformed),
 *               might: 1.5 (× the blows' damage), swift: 1.2 (× the run), heal: 4 (a body's own hp a second) }.
 *               It fills by fighting and does not fall; the transform press (`input.transform`, B / L3) with `at` stocks
 *               full transforms the hero until it runs dry or is pressed again; transformed, it fills no further.
 *               Absent: no meter, and the press is a form's (forms.js) or nothing.
 *
 * `state.style` says where it is: { points, tier, name, fill (0 … 1 through the tier), combo (blows landed since the last
 * hit taken or the last fall to nothing), peak (the highest tier reached), earned (every point gained), hurt (hits
 * taken), best (the longest combo), halo? }. `E.styleOf(state)` the same as a plain record, for a HUD and for a level's results.
 *
 * Read after the step (as the hitstop reads a connect): combat-melee.js stamps `lastStrike` with the step's time, the
 * moveset says the move in hand and each press's verdict, the guard counts its parries. On the world's own clock: a held
 * moment (world-clock.js) holds the meter with it. Import-free (the page runs this source via toString(), compose.js);
 * emitted only into a page whose world has a `styleMeter`, and a world without one gets no state key: every other page and
 * world keeps every byte.
 */
export function buildStyle(E) {
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const TIERS = ['D', 'C', 'B', 'A', 'S'];
  const GAIN = { hit: 12, air: 1.5, launch: 18, switch: 20, parry: 30, down: 15, shot: 3 };

  E.registerStateInit((state, spec) => {
    const S = spec && spec.styleMeter;
    if (!S || typeof S !== 'object') return;
    const tiers = Array.isArray(S.tiers) && S.tiers.length > 1 && S.tiers.every((t) => typeof t === 'string' && t) ? S.tiers.slice() : TIERS.slice();
    const g = S.gain && typeof S.gain === 'object' ? S.gain : {}, gain = {};
    for (const k in GAIN) gain[k] = Math.max(0, num(g[k], GAIN[k]));
    const p = who(state);
    const downed = {};
    for (const e of state.entities) if (e.downed) downed[e.id] = true;
    state.style = {
      cfg: { tiers, step: Math.max(1, num(S.step, 100)), gain, repeat: Math.max(0, Math.min(1, num(S.repeat, 0.5))), memory: Math.max(1, Math.round(num(S.memory, 6))), grace: Math.max(0, num(S.grace, 2)), decay: Math.max(0, num(S.decay, 14)) },
      points: 0, tier: 0, name: tiers[0], fill: 0, combo: 0, peak: 0, earned: 0, hurt: 0, best: 0, last: -1e9, recent: [],
      ...(S.halo && typeof S.halo === 'object' ? { halo: haloOf(S.halo) } : {}),
      seen: { hits: (p && p.hits) || 0, parries: (p && p.parries) || 0, weapon: (p && p.weaponIdx) || 0, shot: (p && p.lastShot) || null, downed },
    };
  });

  function haloOf(h) {
    const stocks = Math.max(1, Math.min(20, Math.round(num(h.stocks, 3))));
    return { stocks, per: Math.max(1, num(h.per, 100)), hit: Math.max(0, num(h.hit, 6)), hurt: Math.max(0, num(h.hurt, 10)), at: Math.max(0.25, Math.min(stocks, num(h.at, Math.min(3, stocks)))),
      drain: Math.max(0.01, num(h.drain, 0.4)), might: Math.max(1, num(h.might, 1.5)), swift: Math.max(1, num(h.swift, 1.2)), heal: Math.max(0, num(h.heal, 4)), points: 0, on: false, held: false, since: 0, count: 0, was: null, mend: 0, mended: 0, readies: 0, wasReady: false };
  }
  // THE TRANSFORMATION: the hero's blows and run raised while it lasts, what they were kept to be given back
  function begin(state, H, p) {
    const r = p.rule || (p.rule = {});
    H.was = { strikeDamage: r.strikeDamage, speed: r.speed };
    if (r.strikeDamage != null) r.strikeDamage *= H.might;
    r.speed = (r.speed != null ? r.speed : 6) * H.swift;
    H.on = true; H.since = state.time; H.count++; p.halo = true;
  }
  function end(H, p) {
    const r = p.rule || {}, W = H.was || {};
    if (W.strikeDamage === undefined) delete r.strikeDamage; else r.strikeDamage = W.strikeDamage;
    if (W.speed === undefined) delete r.speed; else r.speed = W.speed;
    H.on = false; H.was = null; p.halo = false;
  }
  function halo(state, input, dt) {
    const H = state.style.halo, p = who(state);
    if (!p) return;
    const press = !!(input && input.transform);
    if (press && !H.held) { if (H.on) end(H, p); else if (H.points >= H.at * H.per - 1e-6) begin(state, H, p); }
    H.held = press;
    if (!H.on) return;
    H.points -= H.drain * H.per * dt;
    if (H.heal > 0 && p.body && p.hpMax > 0 && p.body.hp > 0) p.body.hp = Math.min(p.hpMax, p.body.hp + H.heal * dt);
    // (and the level's own health, where it keeps one: the bus hears it in whole points, `halo:heal`)
    if (H.heal > 0) { H.mend += H.heal * dt; const n = Math.floor(H.mend); if (n > 0) { H.mend -= n; H.mended += n; } }
    if (H.points <= 0) { H.points = 0; end(H, p); }
  }
  // the gauge's ready moment: counted on the edge it comes full enough to transform
  function readyEdge(H) {
    const ready = !H.on && H.points >= H.at * H.per - 1e-6;
    if (ready && !H.wasReady) H.readies++;
    H.wasReady = ready;
  }

  // whose fighting it is: the pilot's; a world nobody pilots (a sim, a test), the first body that plays a moveset
  function who(state) { return (state.pilotId && state.byId[state.pilotId]) || state.entities.find((e) => e && e.rule && (e.rule.moveset || e.rule.weapons) && e.team !== 'foes') || null; }
  function settle(T) {
    const C = T.cfg, top = C.tiers.length * C.step - 1e-6;
    T.points = Math.max(0, Math.min(top, T.points));
    T.tier = Math.min(C.tiers.length - 1, Math.floor(T.points / C.step));
    T.name = C.tiers[T.tier];
    T.fill = Math.round(((T.points - T.tier * C.step) / C.step) * 1e4) / 1e4;
    if (T.tier > T.peak) T.peak = T.tier;
  }
  function add(T, pts, now) { if (!(pts > 0)) return; T.points += pts; T.earned += pts; T.last = now; }

  // what the step just run did, read off the pilot and the bodies it fights
  function read(state, t0, dt) {
    const T = state.style, C = T.cfg, G = C.gain, p = who(state), seen = T.seen, now = state.time;
    if (!p) return;
    // A BLOW LANDED: its move's worth, less for a move just used, more off the ground, and a launch's own
    const S = p.lastStrike;
    if (S && S.t === t0) {
      const M = p.rule && p.rule.moveset, id = p.mvMove || (p.strikeParams && p.strikeParams.move) || p.swingClip || 'blow', key = (p.mvWeapon || '') + ':' + id;
      let k = 0; for (const r of T.recent) if (r === key) k++;
      const mv = M && M.moves && p.mvMove ? M.moves[p.mvMove] : null, air = p.grounded === false || (mv && mv.air);
      add(T, G.hit * Math.pow(C.repeat, k) * (air ? G.air : 1) + (mv && mv.launch > 0 ? G.launch : 0), now);
      T.recent.push(key); if (T.recent.length > C.memory) T.recent.shift();
      T.combo++; if (T.combo > T.best) T.best = T.combo;
      if (T.halo && !T.halo.on) T.halo.points += T.halo.hit * (air ? G.air : 1);
    }
    // A ROUND LANDED (the sidearm's: combat-ranged.js stamps `lastShot` with what it struck)
    const Sh = p.lastShot;
    if (Sh && Sh !== seen.shot) { seen.shot = Sh; if (Sh.targetId != null) add(T, G.shot, now); }
    // A SWITCH CANCEL (combat-melee.js: the weapon changed on the step a live move was cut for it, its `mv.endT` that
    // step's time) and a PARRY (the guard's count)
    const wi = p.weaponIdx || 0;
    if (wi !== seen.weapon && p.mv && p.mv.endT === t0 && p.mv.carry != null) add(T, G.switch, now);
    seen.weapon = wi;
    if ((p.parries || 0) > seen.parries) { add(T, G.parry * ((p.parries || 0) - seen.parries), now); }
    seen.parries = p.parries || 0;
    // A FOE FELLED by the pilot
    for (const e of state.entities) {
      if (e === p || e.isCamera) continue;
      if (e.downed && !seen.downed[e.id]) { seen.downed[e.id] = true; if (e.lastHitBy === p.id || (S && S.targetId === e.id)) add(T, G.down, now); }
      else if (!e.downed && seen.downed[e.id]) delete seen.downed[e.id];
    }
    // A HIT TAKEN: a whole tier lost, the combo gone
    if ((p.hits || 0) > seen.hits && T.halo && !T.halo.on) T.halo.points += T.halo.hurt * ((p.hits || 0) - seen.hits);
    if ((p.hits || 0) > seen.hits) { T.points -= C.step; T.hurt += (p.hits || 0) - seen.hits; T.combo = 0; T.recent.length = 0; }
    seen.hits = p.hits || 0;
    // TIME: past the grace, it falls; fallen to nothing, the combo is over
    if (now - T.last > C.grace && T.points > 0) { T.points -= C.decay * dt; if (T.points <= 0) { T.combo = 0; T.recent.length = 0; } }
    if (T.halo) T.halo.points = Math.min(T.halo.points, T.halo.stocks * T.halo.per);
    settle(T);
  }

  const step = E.stepWorld;
  E.stepWorld = function stepWithStyle(state, input, dt, hooks) {
    if (!state.style) return step(state, input, dt, hooks);
    if (state.style.halo) halo(state, input, dt);
    const t0 = state.time;
    const out = step(state, input, dt, hooks);
    read(state, t0, state.time - t0);
    if (state.style.halo) readyEdge(state.style.halo);
    return out;
  };
  // the bus hears the Halo Meter (castFacts, wrapped): `halo:ready` the moment it can transform, `halo:on` / `halo:off`,
  // `halo:heal` { by } the whole points a transformation mends (a level that keeps its own health gains them,
  // game/level-synth.js)
  const baseFacts = E.castFacts;
  if (baseFacts) E.castFacts = function castFacts(state, prev) {
    const out = baseFacts(state, prev), H = state.style && state.style.halo;
    if (!H) return out;
    const was = (prev && prev.__halo) || null, cur = { r: H.readies, c: H.count, on: H.on, m: H.mended };
    out.prev.__halo = cur;
    if (!was) return out;
    const who = state.pilotId;
    if (cur.r > was.r) out.events.push({ type: 'halo:ready', entity: who });
    if (cur.c > was.c) out.events.push({ type: 'halo:on', entity: who });
    if (was.on && !cur.on) out.events.push({ type: 'halo:off', entity: who });
    if (cur.m > was.m) out.events.push({ type: 'halo:heal', entity: who, by: cur.m - was.m });
    return out;
  };
  E.styleOf = (state) => { const T = state && state.style; return T ? { tier: T.tier, name: T.name, fill: T.fill, points: Math.round(T.points * 10) / 10, combo: T.combo, peak: T.peak, peakName: T.cfg.tiers[T.peak], earned: Math.round(T.earned * 10) / 10, hurt: T.hurt, best: T.best, tiers: T.cfg.tiers.slice(), ...(T.halo ? { halo: { fill: Math.round((T.halo.points / T.halo.per) * 1000) / 1000, stocks: T.halo.stocks, at: T.halo.at, on: T.halo.on, ready: !T.halo.on && T.halo.points >= T.halo.at * T.halo.per - 1e-6, count: T.halo.count } } : {}) } : null; };
}
