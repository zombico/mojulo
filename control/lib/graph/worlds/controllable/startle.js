/**
 * startle.js — HURT, IT LOOKS ROUND: a watcher that takes damage from what it has not seen stops, turns to where the
 * blow came from and sweeps its gaze there; if it sees who struck it, its mind has them (it attacks as it would on any
 * sighting); if it sees no one, it takes up what it was doing. Opt-in on the watcher's rule:
 *
 *   rule.startle: {
 *     secs?: 3.5,     how long it looks before giving up
 *     turn?: 3,       how fast it turns to where the blow came from (rad/s)
 *     sweep?: 1.1,    how far either side of that it then sweeps its gaze (rad), over `period` seconds (2.4) a pass
 *   }
 *
 * It only turns the body and holds it where it stands: what it sees is the mind's own to say (mind.js perceive, its
 * cone, its range and its line of sight), so a striker that has got behind cover before the watcher has turned is not
 * seen. A watcher already seeing someone is not startled: it is already at them.
 * Field ownership: e.st ({ t, secs, at, base, pos }) while it looks, e.stHp (its health last step), e.startled (how
 * many times).
 *
 * Wraps stepWorld, so the pinned pipeline order is untouched. Import-free (the page runs this source via toString(),
 * compose.js); emitted only into a page whose world has a rule with `startle`, so every other page keeps every byte.
 */
export function buildStartle(E) {
  const step = E.stepWorld, TAU = Math.PI * 2;
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  E.stepWorld = function stepWithStartle(state, input, dt, hooks) {
    const out = step(state, input, dt, hooks), now = state.time || 0;
    for (const e of state.entities) {
      const R = e.rule && e.rule.startle;
      if (!R || !e.body || !Number.isFinite(e.body.hp)) continue;
      const hp = e.body.hp, seeing = !!(e.lastSeen && now - e.lastSeen.t < 0.3);
      if (e.downed || e.gone || e.dormant) { e.st = null; e.stHp = hp; continue; }
      if (e.stHp != null && hp < e.stHp - 1e-9 && !seeing) {
        const by = e.lastHitBy != null ? state.byId[e.lastHitBy] : null;
        e.st = { t: 0, secs: R.secs ?? 3.5, at: by ? [by.transform.pos[0], by.transform.pos[1]] : null, base: null, pos: [e.transform.pos[0], e.transform.pos[1]] };
        e.startled = (e.startled || 0) + 1;
      }
      e.stHp = hp;
      const S = e.st; if (!S) continue;
      // (it has seen someone: the mind has them from here)
      if (seeing) { e.st = null; continue; }
      S.t += dt;
      const t = e.transform; t.pos[0] = S.pos[0]; t.pos[1] = S.pos[1];
      if (S.base == null) {
        const want = S.at ? Math.atan2(S.at[1] - t.pos[1], S.at[0] - t.pos[0]) : t.heading + Math.PI, d = wrap(want - (S.h ?? t.heading)), k = (R.turn ?? 3) * dt;
        S.h = (S.h ?? t.heading) + (Math.abs(d) <= k ? d : Math.sign(d) * k);
        if (Math.abs(d) <= k) { S.base = want; S.t0 = S.t; }
      } else S.h = S.base + Math.sin(((S.t - S.t0) * TAU) / (R.period ?? 2.4)) * (R.sweep ?? 1.1);
      t.heading = S.h; e.moving = false; e.locomotion = 'idle';
      if (S.t >= S.secs) e.st = null;
    }
    return out;
  };
}
