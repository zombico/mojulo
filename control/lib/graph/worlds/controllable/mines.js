/**
 * LAND MINES — a charge laid on the ground and left: a loadout slot whose weapon says `place` (gameworld/arms-kit.js
 * `mine`) is not fired when its trigger is pressed but laid at the pilot's feet, armed after `arm` seconds, and it goes
 * off when a body of another team comes over it: a person within `trip` metres, a vehicle whose footprint (its boss's
 * `size`, turned with it) stands over it. Its burst hurts every body of another team within `splash` (its `dmg`, less
 * with distance), and a vehicle it went off under is told (state.mineBlasts: { at, by, t }) for the boss director to
 * break the part over it (boss.js: a track takes a mine).
 *
 *   weapon.place: { arm, trip, splash, dmg }
 *   input.fire    an edge: a mine laid (the slot's round taken, the slot reloads as a magazine does; the trigger never
 *                 fires the slot's own round)
 *
 * state.mines [{ id, at, armAt, trip, splash, dmg, owner, team }] (the page draws them), state.mineBlasts (this step's).
 * Field ownership: e.minePrev. Import-free; emitted only into a page whose world carries a placed weapon or a boss.
 */
export function buildMines(E) {
  const step = E.stepWorld;
  const foot = (e) => { const B = e.rule && e.rule.boss; return B && B.kind === 'vehicle' && Array.isArray(B.size) ? B.size : null; };
  E.stepWorld = function stepWithMines(state, input, dt, hooks) {
    // (the slot in hand's own words: the engine's weapon in hand keeps the fields it knows, the loadout's slot all of them)
    const p = state.pilotId ? state.byId[state.pilotId] : null, w = p && p.weapon, slot = p && p.rule && Array.isArray(p.rule.loadout) ? p.rule.loadout[p.loadoutIdx || 0] : null;
    const P = (w && w.place) || (slot && slot.weapon && slot.weapon.place) || null;
    if (!P && !(state.mines && state.mines.length) && !state.mineBlasts) return step(state, input, dt, hooks);
    let inp = input;
    if (P && input) {
      const edge = !!input.fire && !p.minePrev;
      p.minePrev = !!input.fire;
      if (edge && w.ammo > 0 && !w.reloading && !((w.cooldownT || 0) > 0) && !p.downed && !p.gone) {
        state.mines = state.mines || []; state.mineSeq = (state.mineSeq || 0) + 1;
        const q = p.transform.pos;
        state.mines.push({ id: `mine-${state.mineSeq}`, at: [q[0], q[1], q[2] - ((p.rule && p.rule.eye) || 0)], armAt: state.time + (P.arm ?? 1.5), trip: P.trip ?? 1.4, splash: P.splash ?? 3.5, dmg: P.dmg ?? 40, owner: p.id, team: p.team || null });
        w.ammo -= 1; w.cooldownT = w.cooldown || 0.4;
      }
      inp = { ...input, fire: 0 };
    }
    const out = step(state, inp, dt, hooks);
    const t0 = state.time - dt;
    state.mineBlasts = [];
    for (const m of state.mines || []) {
      if (m.gone || state.time < m.armAt) continue;
      let by = null;
      for (const e of state.entities) {
        if (e.isCamera || e.gone || e.downed || e.id === m.owner || !e.body || (m.team && e.team === m.team)) continue;
        const q = e.transform.pos, F = foot(e);
        if (F) { const h = e.transform.heading || 0, dx = m.at[0] - q[0], dy = m.at[1] - q[1], lx = dx * Math.cos(h) + dy * Math.sin(h), ly = -dx * Math.sin(h) + dy * Math.cos(h); if (Math.abs(lx) <= F[0] / 2 + 0.3 && Math.abs(ly) <= F[1] / 2 + 0.3 && Math.abs(q[2] - m.at[2]) < 3) { by = e; break; } }
        else if (e.body.hittable && Math.hypot(q[0] - m.at[0], q[1] - m.at[1]) <= m.trip && Math.abs(q[2] - m.at[2]) < 2.2) { by = e; break; }
      }
      if (!by) continue;
      m.gone = true;
      if (foot(by)) state.mineBlasts.push({ at: [m.at[0], m.at[1], m.at[2] + 0.3], by: by.id, t: t0 });
      for (const e of state.entities) {
        if (e.isCamera || e.gone || e.downed || !e.body || !e.body.hittable || foot(e) || e.invincible || (m.team && e.team === m.team && e.id !== m.owner)) continue;
        const d = Math.hypot(e.transform.pos[0] - m.at[0], e.transform.pos[1] - m.at[1]);
        if (d > m.splash || !Number.isFinite(e.body.hp)) continue;
        const dmg = m.dmg * (1 - 0.6 * (d / m.splash));
        e.body.hp = Math.max(0, e.body.hp - dmg); e.hitFlash = state.time; e.lastHitBy = m.owner; e.lastHitDmg = dmg;
      }
      if (state.bursts) state.bursts.push({ seq: state.burstSeq++, pos: [m.at[0], m.at[1], m.at[2] + 0.3], t: state.time, radius: m.splash });
    }
    if (state.mines) state.mines = state.mines.filter((m) => !m.gone);
    return out;
  };
}
