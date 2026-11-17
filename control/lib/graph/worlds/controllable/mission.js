/**
 * mission.js — A MISSION IN ONE LEVEL: things found, clues read, ways that open on them, objectives and one result. The
 * walled-core dungeon's gates played inside a level (wcd/wcd.js: "a gate does not hold a passage shut inside a level"
 * was not built). Opt-in on the pilot's rule:
 *
 *   rule.mission: {
 *     items:   [{ id, at: [x, y, z], radius?: 1.1, name? }]      found by walking onto them: held from then on
 *     clues:   [{ id, at, radius?: 1.6, name? }]                 read with the action pressed beside them
 *     reveal?: { needs, of: [clue ids], flag, says? }            that many of them read sets the flag
 *     ways:    [{ id, kind: 'lift' | 'stair', a: [x, y, z], b: [x, y, z], radius?: 1.8, secs?: 3,
 *                 needs?: { items?: [ids], flags?: [ids] }, name? }]
 *                                                                a way between two floors, ridden with the action pressed
 *                                                                on either end once what it needs is held and set: the
 *                                                                body is held for `secs` and stands at the other end
 *     barriers?: [{ id, min, max, needs?: { items?, flags? } }]  a box that holds a passage shut until what it needs is
 *                                                                held and set and the body comes within 2.5 m of it
 *     objectives: [{ id, says, done: <item id>, after?: <flag> }] in order; the current one is the first not done
 *     unsure?: '<words>'                                         said while none stands and the result's things are not all held
 *     result?: { at: [x, y, z], radius?: 3, when: [item ids] }   holding them all there ends the mission
 *     exits?: [{ id, at, radius?: 1.8, needs?, to: '<page>', door: '<the arrival there>', name? }]
 *                                                                a way out of this page into another segment's, taken with
 *                                                                the action once what it needs is held: state.ms.exit says
 *                                                                where, and the page goes (mission-view.js), carrying what
 *                                                                is held, read and set and the body's health
 *     arrivals?: { <door id>: { at, heading? } }                 where a body that came in by that door stands
 *     leave?: [item ids]                                         (a page with no result: what the mission's result asks for)
 *   state.msCarry   { held?, read?, flags?, hp?, door? }: what came in from another segment's page, taken at the next step
 *   }
 *   input.act      an edge: reads a clue, or rides a way, where the body stands on one (else whatever the action is)
 *
 * State (state.ms): { held: { id: true }, read: { id: true }, flags: { id: true }, exit: { id, to, door } | null, ride: { way, t, secs, to } | null,
 * open: { barrier id: true }, done: false, said: { text, t } (the last thing to tell the player), near: the id of the
 * clue or way in reach, and `locked` what it still needs }. The page draws it (scene/channels/controllable/mission-view.js).
 *
 * Wraps stepWorld, so the pinned pipeline order is untouched. Import-free (the page runs this source via toString(),
 * compose.js); emitted only into a page whose world has a rule with `mission`, so every other page keeps every byte.
 */
export function buildMission(E) {
  const step = E.stepWorld;
  const near = (p, at, r) => Math.hypot(p[0] - at[0], p[1] - at[1]) <= r && Math.abs(p[2] - at[2]) < 2.2;
  const lacks = (S, n) => (!n ? [] : [...(n.items || []).filter((i) => !S.held[i]), ...(n.flags || []).filter((f) => !S.flags[f])]);
  E.stepWorld = function stepWithMission(state, input, dt, hooks) {
    const p = state.pilotId ? state.byId[state.pilotId] : null, M = p && p.rule && p.rule.mission;
    if (!M || !input) return step(state, input, dt, hooks);
    const now = state.time || 0;
    let S = state.ms;
    if (!S) {
      S = state.ms = { held: {}, read: {}, flags: {}, exit: null, ride: null, open: {}, done: false, said: null, near: null, locked: null, prev: false };
      // (the barriers stand as colliders from the first step)
      if (M.barriers && M.barriers.length) state.colliders = [...(state.colliders || []), ...M.barriers.map((b) => ({ min: b.min.slice(), max: b.max.slice(), of: 'mission:' + b.id }))];
    }
    const say = (text) => { S.said = { text, t: now }; };
    // what came in from another segment's page: held, read and set there; the body's health; the door it came by
    if (state.msCarry) {
      const C = state.msCarry; state.msCarry = null;
      for (const k of ['held', 'read', 'flags']) for (const id of Object.keys(C[k] || {})) S[k][id] = true;
      if (Number.isFinite(C.hp) && p.body && Number.isFinite(p.body.hp)) p.body.hp = Math.max(1, Math.min(p.body.hpMax || p.body.hp, C.hp));
      const A = C.door && M.arrivals && M.arrivals[C.door];
      if (A) { p.transform.pos = A.at.slice(); if (A.heading != null) { p.transform.heading = A.heading; if (state.camera) state.camera.camYaw = A.heading; } p.vz = 0; }
    }
    // (leaving: the body is held where it stands until the page goes)
    if (S.exit) return step(state, { ...input, forward: 0, back: 0, left: 0, right: 0, moveX: 0, moveY: 0, fire: 0, jump: 0, jumpHeld: 0, dive: 0, act: 0, crouch: 0, aim: 0 }, dt, hooks);
    // a ride: the body held, and stood at the other end when it is over
    if (S.ride) {
      S.ride.t += dt;
      const out = step(state, { ...input, forward: 0, back: 0, left: 0, right: 0, moveX: 0, moveY: 0, fire: 0, jump: 0, jumpHeld: 0, dive: 0, act: 0, crouch: 0, aim: 0 }, dt, hooks);
      if (!S.ride.moved && S.ride.t >= S.ride.secs / 2) { S.ride.moved = true; p.transform.pos = S.ride.to.slice(); p.vz = 0; if (p.vel) p.vel = [0, 0, 0]; }
      if (S.ride.t >= S.ride.secs) S.ride = null;
      return out;
    }
    const q = p.transform.pos, edge = !!input.act && !S.prev; S.prev = !!input.act;
    // what is found
    for (const it of M.items || []) if (!S.held[it.id] && near(q, it.at, it.radius || 1.1)) { S.held[it.id] = true; say('Found: ' + (it.name || it.id)); }
    // what is in reach of the action: a clue not yet read, or a way
    S.near = null; S.locked = null;
    let used = false;
    for (const c of M.clues || []) {
      if (S.read[c.id] || !near(q, c.at, c.radius || 1.6)) continue;
      S.near = c.id;
      if (edge) {
        S.read[c.id] = true; used = true; say(c.name || c.id);
        const R = M.reveal;
        if (R && !S.flags[R.flag] && R.of.filter((id) => S.read[id]).length >= R.needs) { S.flags[R.flag] = true; say(R.says || R.flag); }
      }
      break;
    }
    if (!S.near) for (const w of M.ways || []) {
      const atA = near(q, w.a, w.radius || 1.8), atB = !atA && near(q, w.b, w.radius || 1.8);
      if (!atA && !atB) continue;
      S.near = w.id;
      const need = lacks(S, w.needs);
      if (need.length) { S.locked = need; if (edge) { used = true; say((w.name || w.id) + ': locked'); } }
      else if (edge) { used = true; S.ride = { way: w.id, kind: w.kind || 'lift', t: 0, secs: w.secs || 3, to: atA ? w.b : w.a, moved: false }; }
      break;
    }
    if (!S.near) for (const x of M.exits || []) {
      if (!near(q, x.at, x.radius || 1.8)) continue;
      S.near = x.id;
      const need = lacks(S, x.needs);
      if (need.length) { S.locked = need; if (edge) { used = true; say((x.name || x.id) + ': locked'); } }
      else if (edge) { used = true; S.exit = { id: x.id, to: x.to, door: x.door, t: now }; }
      break;
    }
    // a barrier gives way to a body that holds what it needs and comes up to it
    for (const b of M.barriers || []) {
      if (S.open[b.id] || lacks(S, b.needs).length) continue;
      const cx = Math.max(b.min[0], Math.min(b.max[0], q[0])), cy = Math.max(b.min[1], Math.min(b.max[1], q[1]));
      if (Math.hypot(q[0] - cx, q[1] - cy) <= 2.5 && q[2] < b.max[2] && q[2] + 2 > b.min[2]) { S.open[b.id] = true; state.colliders = (state.colliders || []).filter((c) => c.of !== 'mission:' + b.id); say('Unlocked'); }
    }
    // the result
    const Rz = M.result;
    if (Rz && !S.done && Rz.when.every((id) => S.held[id]) && near(q, Rz.at, Rz.radius || 3)) { S.done = true; say('Mission complete'); }
    // (the action spent on a clue or a way is not also a takedown or a climb)
    return step(state, used ? { ...input, act: 0 } : input, dt, hooks);
  };
  /** The objective a mission's state stands at: the first not done whose `after` is set, or null. */
  E.missionObjective = function missionObjective(state) {
    const p = state.pilotId ? state.byId[state.pilotId] : null, M = p && p.rule && p.rule.mission, S = state.ms;
    if (!M) return null;
    return (M.objectives || []).find((o) => !(S && S.held[o.done]) && (!o.after || (S && S.flags[o.after]))) || null;
  };
}
