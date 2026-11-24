/**
 * alert.js — ONCE SEEN, IT KEEPS YOU: a watcher that sees the pilot is alerted, and an alerted watcher does not let go
 * the moment the pilot steps out of its beam. Opt-in on the watcher's rule:
 *
 *   rule.alert: {
 *     cone?: 1.4,     its sight's half-angle while alerted (rad), where a patrol's calm beam is narrow
 *     range?: 1.6,    its sight's reach while alerted, times its calm reach
 *     hold?: 10,      how long it remembers where it last saw the pilot (s): it goes there when the line is broken
 *     search?: 5,     how long it then looks round that spot before it lets go (s)
 *     pace?: 1.8,     how much faster it moves while alerted, times its calm speed
 *     leash?: 2,      how much farther from its post it follows, times its calm `guardRadius`
 *     raise?: 0.45,   how long the weapon takes to come up (s): no round before it is up
 *     call?: 12,      on a fresh sighting it calls the watchers of its team within this many metres (0: it calls no one);
 *                     they have where it saw the pilot and come to look there
 *   }
 *
 * A watcher is CALM (its rule as written), in COMBAT (it sees the pilot, or saw it under a second ago: the weapon up,
 * on it) or SEARCHING (the line broken, a call heard, or a blow from what it has not seen: startle.js; the weapon at a
 * high ready while it goes to where the pilot was and looks round). While it is alerted its rule reads the alerted
 * values: the mind's own perception becomes `memory` (mind.js recall: it goes to the last-seen spot and searches), its
 * cone, reach, pace and leash widen, and a patrol's calm (foe.js) waits out the search; calm again, the rule is as it was
 * written. It only changes what the rule says and holds the trigger until the weapon is up: what is seen, chased and
 * shot is the mind's own (mind.js perceive, recall, the strike), so a pilot behind cover is still not seen.
 * Field ownership: e.alert ({ level, t, seen, up, calls, way }), read by the page (the gun's carry, the fan's colour);
 * e.alertK (the rule's two sets of values); while alerted, the rule's sightCone, sightRange, memorySpan, searchTime,
 * speed, guardRadius, mind and foe.
 *
 * Wraps stepWorld, so the pinned pipeline order is untouched. Import-free (the page runs this source via toString(),
 * compose.js); emitted only into a page whose world has a rule with `alert`, so every other page keeps every byte.
 */
export function buildAlert(E) {
  const step = E.stepWorld;
  const FIELDS = ['sightCone', 'sightRange', 'memorySpan', 'searchTime', 'speed', 'guardRadius', 'mind', 'foe'];
  // the rule's two sets of values, read once from the rule as written (an absent field stays absent when calm)
  function keysOf(e) {
    if (e.alertK) return e.alertK;
    const r = e.rule, A = r.alert === true ? {} : r.alert, calm = {};
    for (const k of FIELDS) calm[k] = r[k];
    const hot = {
      sightCone: Math.max(r.sightCone ?? 1.2, A.cone ?? 1.4),
      sightRange: (r.sightRange ?? 120) * (A.range ?? 1.6),
      memorySpan: A.hold ?? 10, searchTime: A.search ?? 5,
      speed: (r.speed ?? 6) * (A.pace ?? 1.8),
      guardRadius: (r.guardRadius ?? 20) * (A.leash ?? 2),
      mind: { ...(r.mind || {}), perception: 'memory' },
      // (a patrol's round waits out the memory: foe.js patrol hands the body to the mind while it remembers)
      foe: r.foe && r.foe.patrol ? { ...r.foe, patrol: { ...r.foe.patrol, calm: (A.hold ?? 10) + (A.search ?? 5) } } : r.foe,
    };
    return (e.alertK = { A, calm, hot });
  }
  // (a team's raised alarm, alarm.js, makes its sight reach farther: `e.alarmGain`, 1 when calm or absent)
  function wear(e, set) { for (const k of FIELDS) { if (set[k] === undefined) delete e.rule[k]; else e.rule[k] = set[k]; } if (e.alarmGain > 1 && e.rule.sightRange != null) e.rule.sightRange *= e.alarmGain; }
  const live = (e) => !(e.downed || e.gone || e.dormant || (e.body && Number.isFinite(e.body.hp) && e.body.hp <= 0));
  E.stepWorld = function stepWithAlert(state, input, dt, hooks) {
    const now = state.time || 0, list = state.entities.filter((e) => e.rule && e.rule.alert);
    if (!list.length) return step(state, input, dt, hooks);
    // BEFORE: each watcher wears the values of its level; one in combat whose weapon is not yet up holds its trigger
    for (const e of list) {
      const K = keysOf(e), S = e.alert || (e.alert = { level: 'calm', t: 0, seen: -1e9, up: 0, calls: 0 });
      wear(e, S.level === 'calm' ? K.calm : K.hot);
      if (S.up < 1) e.aiClock = Math.min(e.aiClock || 0, -(1 - S.up) * (K.A.raise ?? 0.45));
    }
    const sights = list.map((e) => e.sightings || 0);
    const out = step(state, input, dt, hooks), t1 = state.time || now;
    // AFTER: what it saw this step says its level
    list.forEach((e, i) => {
      const S = e.alert, K = e.alertK, A = K.A;
      if (!live(e)) { S.level = 'calm'; S.up = 0; S.t = 0; wear(e, K.calm); return; }
      const ls = e.lastSeen, seeing = !!(ls && t1 - ls.t <= dt * 1.5 + 1e-9);
      if (seeing) S.seen = t1;
      const was = S.level;
      S.level = seeing || t1 - S.seen < 1 ? 'combat' : ls || e.st ? 'search' : 'calm';
      S.t = S.level === was ? S.t + dt : 0;
      // (on its way to where it lost the pilot and getting no nearer, a wall in the way and no path round it: it looks
      // round from where it stands: mind.js recall searches once its clock runs)
      if (S.level === 'search' && ls && e.searchT == null) {
        const d = Math.hypot(ls.pos[0] - e.transform.pos[0], ls.pos[1] - e.transform.pos[1]);
        if (!S.way || d < S.way.d - 0.3) S.way = { d, t: t1 };
        else if (t1 - S.way.t > 1.2) { e.searchT = 0; S.way = null; }
      } else S.way = null;
      // the weapon: up over `raise` in combat, at a high ready while it searches, down when calm (down at half the pace)
      const want = S.level === 'combat' ? 1 : S.level === 'search' ? 0.6 : 0, rate = dt / Math.max(0.05, A.raise ?? 0.45);
      S.up = want > S.up ? Math.min(want, S.up + rate) : Math.max(want, S.up - rate * 0.5);
      // A CALL: a fresh sighting tells the watchers of its team near enough where the pilot is; one that sees no one has
      // it as a memory, half a second old (no sighting of its own, so its cone still says what it sees: mind.js perceive
      // skips the cone for a target seen in the last half second) and comes to look
      const R = A.call ?? 12;
      if (R > 0 && (e.sightings || 0) > sights[i] && ls) {
        S.calls++;
        for (const o of list) {
          if (o === e || !live(o) || (e.team && o.team !== e.team) || (o.alert && o.alert.level === 'combat')) continue;
          if (Math.hypot(o.transform.pos[0] - e.transform.pos[0], o.transform.pos[1] - e.transform.pos[1]) > R) continue;
          o.lastSeen = { pos: ls.pos.slice(), t: t1 - 0.5, id: ls.id };
          if (o.alert && o.alert.level === 'calm') { o.alert.level = 'search'; o.alert.t = 0; }
        }
      }
    });
    return out;
  };
}
