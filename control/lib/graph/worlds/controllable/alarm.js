/**
 * alarm.js — THE ALARM: a garrison's state of alert, as an organisation holds it, where a watcher alone (alert.js) only
 * knows what it saw. Read from the stealth games' phases (Metal Gear's infiltration, caution, evasion and alert): a guard
 * that glimpses something is not yet sure; one that is sure radios the rest, and the radio takes seconds, so a guard put
 * down before the call is through never makes it; once the call is made the whole team knows where the intruder is and
 * backup is sent; and the alarm dies down only while the intruder is out of every watcher's sight, so the way out of it
 * is to hide. Opt-in on the watchers' rule (one team's, read from the first watcher that carries it):
 *
 *   rule.alarm: {
 *     confirm?: 0.6,    seconds a watcher must keep the intruder in sight to be sure: a shorter glimpse is a threat detected
 *     radio?: 2.5,      seconds its call to the rest takes; the caller downed before then, no call is made; a caller inside
 *                       a chaff cloud (state.jams) gets nothing through while it is jammed
 *     found?: 30,       THREAT FOUND (red) lasts this long once no watcher sees the intruder, and starts over each time one does
 *     detected?: 40,    THREAT DETECTED (orange) lasts this long with nothing new, then the team stands down (clear)
 *     vigilant?: 1.25,  orange or red, every watcher's sight reaches this many times as far (alert.js reads it)
 *     sweep?: 4,        metres round the last known place the searchers spread over while the intruder is not in sight
 *     every?: 6,        seconds between the searchers' new places in the sweep
 *     backup?: [ids],   the team's bodies minted asleep (`dormant`), sent at the call from `from` and gone again at clear
 *     from?: [x, y, z]  where backup comes from (the first backup's own place when not said)
 *   }
 *
 * What raises it (THREAT DETECTED): a glimpse (a fresh sighting, before it is sure); a sound or a blow from what a
 * watcher did not see (startle.js: it turns to look); a downed teammate in a watcher's sight, a clear line to it (a body
 * found: one behind a wall or in tall grass is not). A sure
 * sighting starts the call. What a raised alarm does: every watcher of the team is VIGILANT (wider and longer sight);
 * at THREAT FOUND every watcher has the last known place and searches round it, spread over the sweep, and backup comes.
 *
 * State: state.alarm[team] = { phase: 'clear' | 'detected' | 'found', left (s), full (s), at ([x, y, z] the last known
 * place), cause ('glimpse' | 'sound' | 'body' | 'seen'), call: { by, t, of } | null, backup (sent), calls (made),
 * downs (calls cut), sweeps (the searchers spread), jammed (seconds a call waited in chaff) }. The bus hears its turns (castFacts, wrapped: alarm:<phase>,
 * alarm:spotted, alarm:call, alarm:cut, alarm:sweep, alarm:backup). A page draws it (scene/channels/controllable/alarm-view.js). Per watcher: e.alarmSee (seconds it
 * has kept the intruder in sight), e.alarmGain (its sight's gain), e.alarmSt (its startle last step).
 *
 * Wraps stepWorld (after alert.js in compose.js, so its before runs first and its after last). Import-free (the page runs
 * this source via toString(), compose.js); emitted only into a page whose world has a rule with `alarm`, so every other
 * page keeps every byte.
 */
export function buildAlarm(E) {
  const step = E.stepWorld;
  const live = (e) => !(e.downed || e.gone || e.dormant || (e.body && Number.isFinite(e.body.hp) && e.body.hp <= 0));
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  E.stepWorld = function stepWithAlarm(state, input, dt, hooks) {
    const watchers = state.entities.filter((e) => e.rule && e.rule.alarm);
    if (!watchers.length) return step(state, input, dt, hooks);
    const teams = {};
    for (const e of watchers) (teams[e.team || '_'] = teams[e.team || '_'] || []).push(e);
    const A = state.alarm || (state.alarm = {});
    // BEFORE: a raised alarm makes every watcher of its team vigilant
    for (const team of Object.keys(teams)) {
      const C = teams[team][0].rule.alarm, S = A[team] || (A[team] = { phase: 'clear', left: 0, full: 0, at: null, cause: null, call: null, backup: false, calls: 0, downs: 0 });
      if (!S.init) {
        S.init = true;
        // (backup is minted asleep and out of the world until it is sent)
        for (const id of C.backup || []) { const b = state.byId[id]; if (b) { b.dormant = true; b.gone = true; if (b.body) b.body.hittable = false; } }
      }
      for (const e of teams[team]) e.alarmGain = S.phase === 'clear' ? 1 : (C.vigilant ?? 1.25);
    }
    const sights = watchers.map((e) => e.sightings || 0);
    const out = step(state, input, dt, hooks), now = state.time || 0;
    const pilot = state.pilotId ? state.byId[state.pilotId] : null;
    for (const team of Object.keys(teams)) {
      const list = teams[team], C = list[0].rule.alarm, S = A[team];
      const raise = (cause, at) => {
        if (S.phase === 'clear') { S.phase = 'detected'; S.full = C.detected ?? 40; S.left = S.full; S.cause = cause; S.at = at ? at.slice() : S.at; }
        else if (S.phase === 'detected') { S.left = S.full; S.cause = cause; if (at) S.at = at.slice(); }
      };
      let anySees = false;
      list.forEach((e) => {
        const i = watchers.indexOf(e);
        if (!live(e)) { e.alarmSee = 0; return; }
        const ls = e.lastSeen, sees = !!(ls && now - ls.t <= dt * 1.5 + 1e-9);
        // A GLIMPSE, then sure: in sight long enough, it starts the call (one call at a time; at red, the rest already know)
        e.alarmSee = sees ? (e.alarmSee || 0) + dt : 0;
        if (sees) {
          anySees = true;
          if ((e.sightings || 0) > sights[i]) raise('glimpse', ls.pos);
          if (e.alarmSee >= (C.confirm ?? 0.6)) {
            if (S.phase === 'found') { S.left = S.full; S.at = ls.pos.slice(); S.cause = 'seen'; }
            else if (!S.call) S.call = { by: e.id, t: 0, of: C.radio ?? 2.5 };
          }
        }
        // a sound or a blow it did not see coming: it turns to look (startle.js), and the team is told something is up
        if (e.st && !e.alarmSt) raise('sound', Array.isArray(e.st.at) ? [e.st.at[0], e.st.at[1], e.transform.pos[2]] : null);
        e.alarmSt = !!e.st;
        // a body found: a downed teammate (not one it saw fall) in its cone and reach, and a clear line to it lying there
        // (past the colliders and the tall grass, veil.js: a body hidden is not found)
        for (const o of list) {
          if (o === e || live(o) || o.alarmFound || o.gone) continue;
          const dx = o.transform.pos[0] - e.transform.pos[0], dy = o.transform.pos[1] - e.transform.pos[1];
          if (Math.hypot(dx, dy) > (e.rule.sightRange ?? 14) || Math.abs(wrap(Math.atan2(dy, dx) - e.transform.heading)) > (e.rule.sightCone ?? 0.6)) continue;
          const eye = [e.transform.pos[0], e.transform.pos[1], e.transform.pos[2] + (e.rule.collideHeight ?? 1.8) * 0.75 - (e.rule.eye || 0)], lying = [o.transform.pos[0], o.transform.pos[1], o.transform.pos[2] + 0.35];
          if (state.colliders && E.sightBlocked && E.sightBlocked(eye, lying, state.colliders)) continue;
          if (state.veils && E.veilBlocked && E.veilBlocked(eye, lying, state.veils)) continue;
          o.alarmFound = true; raise('body', o.transform.pos);
        }
      });
      // THE CALL: it takes its seconds; the caller downed first, it is never made (it stays a threat detected)
      if (S.call) {
        const by = state.byId[S.call.by];
        if (!by || !live(by)) { S.call = null; S.downs++; }
        // (a caller inside a chaff cloud gets nothing through: its call waits while it is jammed, combat-ranged.js jammedAt)
        else if (E.jammedAt && E.jammedAt(state, by.transform.pos)) S.jammed = (S.jammed || 0) + dt;
        else if ((S.call.t += dt) >= S.call.of) {
          S.call = null; S.calls++; S.phase = 'found'; S.full = C.found ?? 30; S.left = S.full; S.cause = 'seen';
          S.at = by.lastSeen ? by.lastSeen.pos.slice() : pilot ? pilot.transform.pos.slice() : S.at;
          // (the call through: every watcher of the team has the place at once, and comes to it)
          for (const e of list) if (live(e) && e !== by && !(e.lastSeen && now - e.lastSeen.t < 1)) { e.lastSeen = { pos: S.at.slice(), t: now - 0.5, id: pilot ? pilot.id : null }; if (e.alert && e.alert.level === 'calm') { e.alert.level = 'search'; e.alert.t = 0; } }
          S.sweptAt = now;
          // BACKUP: sent from where it comes from, every body of it at once, toward the last known place
          if (!S.backup && (C.backup || []).length) {
            S.backup = true;
            const from = C.from || (state.byId[C.backup[0]] && state.byId[C.backup[0]].transform.pos);
            C.backup.forEach((id, k) => {
              const b = state.byId[id]; if (!b || !from) return;
              const at = [from[0] + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 1.2, from[1], from[2] ?? b.transform.pos[2]];
              if (E.castOps) E.castOps(state, [{ op: 'spawn', who: id, at, face: (Math.atan2(S.at[1] - at[1], S.at[0] - at[0]) * 180) / Math.PI }]);
              else { b.dormant = false; b.gone = false; b.transform.pos = at; }
              if (b.body) b.body.hittable = true;
              if (b.alarmFrom == null) b.alarmFrom = at.slice();
            });
          }
        }
      }
      if (S.phase === 'found') {
        if (anySees) S.left = S.full;
        else {
          // the intruder out of sight: the clock runs, and the searchers spread round the last known place
          S.left -= dt;
          if (now - (S.sweptAt ?? -1e9) >= (C.every ?? 6) && S.at) {
            S.sweptAt = now; S.sweeps = (S.sweeps || 0) + 1;
            const R = C.sweep ?? 4, n = list.length, turn = Math.floor(now / (C.every ?? 6));
            list.forEach((e, k) => {
              if (!live(e) || (e.lastSeen && now - e.lastSeen.t < 1)) return;
              const a = ((k + turn) / Math.max(1, n)) * Math.PI * 2;
              e.lastSeen = { pos: [S.at[0] + Math.cos(a) * R, S.at[1] + Math.sin(a) * R, S.at[2]], t: now - 0.5, id: pilot ? pilot.id : null };
              e.searchT = null;
              if (e.alert && e.alert.level === 'calm') { e.alert.level = 'search'; e.alert.t = 0; }
            });
          }
          if (S.left <= 0) { S.phase = 'detected'; S.full = C.detected ?? 40; S.left = S.full; S.cause = 'lost'; }
        }
      } else if (S.phase === 'detected' && !S.call) {
        if (!anySees) S.left -= dt;
        if (S.left <= 0) {
          // CLEAR: the team stands down, and backup goes back where it came from
          S.phase = 'clear'; S.left = 0; S.cause = null; S.at = null;
          if (S.backup) {
            S.backup = false;
            for (const id of C.backup || []) { const b = state.byId[id]; if (b && live(b)) { b.dormant = true; b.gone = true; b.moving = false; if (b.body) b.body.hittable = false; if (b.alarmFrom) b.transform.pos = b.alarmFrom.slice(); } }
          }
        }
      }
    }
    return out;
  };
  // THE BUS HEARS IT (the castFacts the events channel reads, wrapped): `alarm:detected`, `alarm:found` and `alarm:clear`
  // as the phase turns (its team, the phase it left, its cause), `alarm:spotted` once as calm is broken by a sighting,
  // `alarm:call` as a call starts (its caller), `alarm:cut`
  // as a caller is downed first, `alarm:sweep` each time the searchers spread again, `alarm:backup` as backup is sent: a
  // page's sound and music take them (the alert sting, the radio, the siren; the score's tension)
  const baseFacts = E.castFacts;
  if (baseFacts) E.castFacts = function castFactsWithAlarm(state, prev) {
    const out = baseFacts(state, prev);
    if (!state.alarm) return out;
    // (a bus already running that has not yet heard this alarm hears it from rest: its first turn is heard)
    const was = prev ? prev.__alarm || {} : null, cur = {}, REST = { phase: 'clear', call: false, downs: 0, sweeps: 0, backup: false };
    for (const team of Object.keys(state.alarm)) {
      const S = state.alarm[team], c = cur[team] = { phase: S.phase, call: !!S.call, downs: S.downs || 0, sweeps: S.sweeps || 0, backup: !!S.backup };
      const w = was && (was[team] || REST);
      if (!w) continue;
      if (c.phase !== w.phase) out.events.push({ type: 'alarm:' + c.phase, team, from: w.phase, ...(S.cause ? { cause: S.cause } : {}) });
      // (and `alarm:spotted` once, as the garrison leaves calm because a watcher saw the intruder: the first sighting, a
      // sting a page plays once an alarm, never at each glimpse after it)
      if (w.phase === 'clear' && c.phase !== 'clear' && (S.cause === 'glimpse' || S.cause === 'seen')) out.events.push({ type: 'alarm:spotted', team, ...(S.call ? { entity: S.call.by } : {}) });
      if (c.call && !w.call) out.events.push({ type: 'alarm:call', team, entity: S.call.by });
      if (c.downs > w.downs) out.events.push({ type: 'alarm:cut', team });
      if (c.sweeps > w.sweeps) out.events.push({ type: 'alarm:sweep', team });
      if (c.backup && !w.backup) out.events.push({ type: 'alarm:backup', team });
    }
    out.prev.__alarm = cur;
    return out;
  };
}
