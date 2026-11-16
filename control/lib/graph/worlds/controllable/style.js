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
 * `state.style` says where it is: { points, tier, name, fill (0 … 1 through the tier), combo (blows landed since the last
 * hit taken or the last fall to nothing), peak (the highest tier reached), earned (every point gained), hurt (hits
 * taken), best (the longest combo) }. `E.styleOf(state)` the same as a plain record, for a HUD and for a level's results.
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
      seen: { hits: (p && p.hits) || 0, parries: (p && p.parries) || 0, weapon: (p && p.weaponIdx) || 0, shot: (p && p.lastShot) || null, downed },
    };
  });

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
    if ((p.hits || 0) > seen.hits) { T.points -= C.step; T.hurt += (p.hits || 0) - seen.hits; T.combo = 0; T.recent.length = 0; }
    seen.hits = p.hits || 0;
    // TIME: past the grace, it falls; fallen to nothing, the combo is over
    if (now - T.last > C.grace && T.points > 0) { T.points -= C.decay * dt; if (T.points <= 0) { T.combo = 0; T.recent.length = 0; } }
    settle(T);
  }

  const step = E.stepWorld;
  E.stepWorld = function stepWithStyle(state, input, dt, hooks) {
    if (!state.style) return step(state, input, dt, hooks);
    const t0 = state.time;
    const out = step(state, input, dt, hooks);
    read(state, t0, state.time - t0);
    return out;
  };
  E.styleOf = (state) => { const T = state && state.style; return T ? { tier: T.tier, name: T.name, fill: T.fill, points: Math.round(T.points * 10) / 10, combo: T.combo, peak: T.peak, peakName: T.cfg.tiers[T.peak], earned: Math.round(T.earned * 10) / 10, hurt: T.hurt, best: T.best, tiers: T.cfg.tiers.slice() } : null; };
}
