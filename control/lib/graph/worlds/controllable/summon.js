/**
 * summon.js — A SUMMONER'S SUMMONS (lib/graph/foes/classes/summoner.js; a bestiary entry's `summons`, gameworld/foes.js):
 * the foes it calls into the fight, minted with it asleep (`dormant`), and what its own fate does to them.
 *
 *   rule.summon    { ids, at, every, wind, radius, ring, with? }   on the summoner: its summons' ids in calling order, how
 *                  many may be up at once, the seconds between calls, its wind-up (the telegraph), the hero's distance that
 *                  starts the calling, how far round it they arrive, and the transit they arrive by
 *   rule.summoned  { by, bound }   on each summons: its summoner, and whether its fate is bound to it
 *
 *   THE CALL     a summoner standing (not down, not reeling) with a hero inside `radius`, fewer than `at` of its summons
 *                up, one still asleep and its last call `every` s ago (none yet: at once) winds up for `wind` s (held, facing the hero), then
 *                wakes the next `ring` m round it toward the hero (the cast's spawn: it arrives by `with`); awake, a summons
 *                joins its summoner's pack (group.js: `<summoner>-summons`, their sight shared, `at` pressing in at a time)
 *   THE STRINGS  the summoner down: its bound summons that are up are CUT (destroyed where they stand, every joint letting
 *                go: vanish.js's wreck, `e.wreck`), those never called are dropped (down and never seen); an unbound one
 *                fights on, and its uncalled kin are dropped all the same
 *   SLACK        the summoner reeling (a stagger, a knockdown: `staggerT`), its bound summons stand slack, held, until it
 *                recovers
 *
 * Opt-in (compose.js EMISSION_OPT_IN): emitted only into a page whose world has a summoner, so every other page keeps every
 * byte; on the live instance a world without one steps exactly as before. Wraps the `ai` rule and stepWorld, as foe.js
 * does, so the pinned pipeline order is untouched. Import-free (the page runs this source via toString()). Field
 * ownership: e.summonT (seconds since its last call), e.summonWind (a wind-up's seconds left), e.summonSlack, e.summonCut, e.summonDone (its strings already cut).
 */

export function buildSummon(E) {
  const { RULES, pilotsOf } = E;
  const ai = RULES.ai;
  const flat = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const up = (x) => x && !x.dormant && !x.downed && !x.gone;
  const nearestPilot = (e, state) => {
    let best = null, bd = Infinity;
    for (const p of pilotsOf(state)) { if (!p || p.downed || p.gone) continue; const d = flat(e.transform.pos, p.transform.pos); if (d < bd) { bd = d; best = p; } }
    return best ? { p: best, d: bd } : null;
  };
  // a summoner winding up, and a slack summons, are held: no step and no blow
  RULES.ai = function summonAi(e, input, dt, world) {
    if (e.summonWind != null || e.summonSlack) { e.moving = false; e.aiFire = 0; e.locomotion = 'idle'; return; }
    return ai(e, input, dt, world);
  };
  // the strings cut: destroyed where it stands, its every joint letting go, thrown from its summoner
  function cut(state, s, by) {
    const V = s.body && s.body.vanish;
    if (s.body) { s.body.vanish = { ...(V || { is: 'motes', linger: 2.4 }), die: 'dismantle', sever: 'all' }; if (Number.isFinite(s.body.hp)) s.body.hp = 0; }
    s.downed = true; s.moving = false; s.route = null; s.lastHitBy = by.id; s.summonCut = true; s.summonSlack = false;
  }
  const step = E.stepWorld;
  E.stepWorld = function stepWithSummons(state, input, dt, hooks) {
    const masters = state.entities.filter((e) => e.rule && e.rule.summon);
    if (!masters.length) return step(state, input, dt, hooks);
    dt = dt || 1 / 60;
    for (const m of masters) {
      const S = m.rule.summon, kin = S.ids.map((id) => state.byId[id]).filter(Boolean), reeling = !m.downed && m.staggerT != null;
      for (const s of kin) s.summonSlack = !!(s.rule.summoned && s.rule.summoned.bound && up(s) && reeling);
      if (m.downed || m.gone) continue;
      m.summonT = (m.summonT ?? S.every) + dt;   // (its first call on sight, then every `every` s)
      if (m.summonWind != null) {
        const near = nearestPilot(m, state);
        if (near) m.transform.heading = Math.atan2(near.p.transform.pos[1] - m.transform.pos[1], near.p.transform.pos[0] - m.transform.pos[0]);
        m.summonWind -= dt;
        if (reeling) { m.summonWind = null; continue; }   // (a blow breaks the call)
        if (m.summonWind > 0) continue;
        m.summonWind = null; m.summonT = 0;
        const s = kin.find((x) => x.dormant && !x.summonCut);
        if (!s) continue;
        const a = m.transform.heading, at = [m.transform.pos[0] + Math.cos(a) * S.ring, m.transform.pos[1] + Math.sin(a) * S.ring, m.transform.pos[2]];
        // (the k-th up stands off the line, so two calls do not stack: alternately left and right of it)
        const k = kin.filter(up).length, side = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.9;
        at[0] += -Math.sin(a) * side; at[1] += Math.cos(a) * side;
        E.castOps(state, [{ op: 'spawn', who: s.id, at, face: (a * 180) / Math.PI, ...(S.with ? { with: S.with } : {}) }]);
        // (awake, it joins its summoner's pack: group.js, their sight shared and a few pressing in at a time, on its own
        // move's plan when it has one; asleep, it is no member)
        if (s.rule && s.rule.mind) {
          const own = s.rule.mind.group;
          s.rule.mind = { ...s.rule.mind, group: { id: `${m.id}-summons`, plan: (own && typeof own === 'object' && own.plan) || 'pack-hunt', attackers: S.at } };
        }
        continue;
      }
      if (reeling || (state.aiEnabled === false)) continue;
      const near = nearestPilot(m, state);
      if (!near || near.d > S.radius || m.summonT < S.every || kin.filter(up).length >= S.at || !kin.some((x) => x.dormant && !x.summonCut)) continue;
      m.summonWind = S.wind;
    }
    step(state, input, dt, hooks);
    // the summoner down: the strings cut
    for (const m of masters) {
      if (!m.downed || m.summonDone) continue;
      m.summonDone = true; m.summonWind = null;
      for (const id of m.rule.summon.ids) {
        const s = state.byId[id];
        if (!s || s.downed || s.gone && !s.dormant) continue;
        if (s.dormant) { s.downed = true; s.summonCut = true; if (s.body && Number.isFinite(s.body.hp)) s.body.hp = 0; continue; }
        if (s.rule.summoned && s.rule.summoned.bound) cut(state, s, m);
      }
    }
    return state;
  };
}
