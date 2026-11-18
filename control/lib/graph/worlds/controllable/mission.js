/**
 * mission.js — A MISSION IN ONE LEVEL: things found, clues read, ways that open on them, objectives and one result. The
 * walled-core dungeon's gates played inside a level (wcd/wcd.js: "a gate does not hold a passage shut inside a level"
 * was not built). Opt-in on the pilot's rule:
 *
 *   rule.mission: {
 *     items:   [{ id, at: [x, y, z], radius?: 1.1, name?, look?, gives? }]
 *                                                                found by walking onto them: held from then on
 *                                                                (`look`: how the page draws it, mission-view.js: 'keycard'
 *                                                                | 'document' | 'ration' | 'ammo' | 'case', the default)
 *                                                                A SUPPLY (`gives: { hp?, rounds? }`) is used as it is
 *                                                                found: health back to the body (to its most), rounds into
 *                                                                the reserve of the gun in hand (else the first gun carried
 *                                                                that keeps one). One that would give nothing (health full,
 *                                                                no such gun) is left where it lies, and the player told
 *     clues:   [{ id, at, radius?: 1.6, name? }]                 read with the action pressed beside them
 *     reveal?: { needs, of: [clue ids], flag, says? }            that many of them read sets the flag
 *     ways:    [{ id, kind: 'lift' | 'stair', a: [x, y, z], b: [x, y, z], radius?: 1.8, secs?: 3,
 *                 needs?: { items?: [ids], flags?: [ids] }, name?, deck?: '<entity id>', at?: 'a' | 'b',
 *                 face?: <heading>, shot?: { a?: '<cue>', b?: '<cue>' } }]
 *                                                                a way between two floors, ridden with the action pressed
 *                                                                on either end once what it needs is held and set: the
 *                                                                body is held for `secs` and stands at the other end
 *                                                                A way with a `deck` is RIDDEN FOR REAL: the deck (an entity,
 *                                                                a slab the body stands on) travels from the end it is at
 *                                                                (`at`, 'a' unless said) to the other over `secs`, eased,
 *                                                                the body carried on it; pressed at the end the deck is not
 *                                                                at, it is called and comes alone
 *                                                                (`face`: the way the carried body is turned; `shot`: the
 *                                                                cue of the page's shoot plan a ride TO that end plays,
 *                                                                the view the plan's through it: mission-view.js)
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
 *     hints?: [{ at: [x, y, z?], radius?: 3.5, says }]           a thing the player is told where it stands: state.ms.hint is
 *                                                                the one the body is in (its index), or null. Height is not read
 *                                                                where a hint gives none
 *   state.msCarry   { held?, read?, flags?, hp?, door? }: what came in from another segment's page, taken at the next step
 *   }
 *   input.act      an edge: reads a clue, or rides a way, where the body stands on one (else whatever the action is)
 *
 * State (state.ms): { held: { id: true }, read: { id: true }, flags: { id: true }, exit: { id, to, door } | null, ride: { way, t, secs, to } | { way, deck, rides, t, secs, z0, z1, end } | null, decks: { way id: the end its deck is at },
 * open: { barrier id: true }, done: false, said: { text, t } (the last thing to tell the player), near: the id of the
 * clue or way in reach, and `locked` what it still needs }. The page draws it (scene/channels/controllable/mission-view.js).
 * The bus hears its moments (castFacts, wrapped): mission:item, mission:clue, mission:reveal, mission:ride, mission:hint,
 * mission:exit, mission:done.
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
    // A DECK IS GROUND: the page's ground is the world's own meshes, never a body's, so a deck (an entity) is stood on
    // through this: over its slab, at or above its top, the ground is its top
    if (hooks && hooks.ground && (M.ways || []).some((w) => w.deck)) {
      const g0 = hooks.ground, decks = M.ways.filter((w) => w.deck).map((w) => state.byId[w.deck]).filter((D) => D && D.body && Array.isArray(D.body.size));
      hooks = { ...hooks, ground: (pos) => {
        const g = g0(pos);
        for (const D of decks) {
          const q = D.transform.pos, hx = D.body.size[0] / 2, hy = D.body.size[1] / 2, top = q[2] + D.body.size[2] / 2;
          if (Math.abs(pos[0] - q[0]) <= hx && Math.abs(pos[1] - q[1]) <= hy && pos[2] >= top - 0.6 && (g == null || top > g)) return top;
        }
        return g;
      } };
    }
    let S = state.ms;
    if (!S) {
      S = state.ms = { held: {}, read: {}, flags: {}, decks: {}, exit: null, ride: null, open: {}, done: false, said: null, near: null, locked: null, prev: false };
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
    if (S.ride && S.ride.deck) {
      // a deck's ride: it travels its shaft, eased; the body on it is carried (held still, its feet on the deck's top)
      const R = S.ride, D = state.byId[R.deck];
      R.t += dt;
      const u = Math.min(1, R.t / R.secs), e = u * u * (3 - 2 * u), top = R.z0 + (R.z1 - R.z0) * e;
      if (D) D.transform.pos[2] = top - R.half;
      const out = step(state, R.rides ? { ...input, forward: 0, back: 0, left: 0, right: 0, moveX: 0, moveY: 0, fire: 0, jump: 0, jumpHeld: 0, dive: 0, act: 0, crouch: 0, aim: 0 } : input, dt, hooks);
      if (R.rides) { p.transform.pos[2] = top + (p.rule.eye || 0); p.vz = 0; if (p.vel) p.vel[2] = 0; p.grounded = true; }
      if (u >= 1) { S.decks[R.way] = R.end; S.ride = null; }
      return out;
    }
    if (S.ride) {
      S.ride.t += dt;
      const out = step(state, { ...input, forward: 0, back: 0, left: 0, right: 0, moveX: 0, moveY: 0, fire: 0, jump: 0, jumpHeld: 0, dive: 0, act: 0, crouch: 0, aim: 0 }, dt, hooks);
      if (!S.ride.moved && S.ride.t >= S.ride.secs / 2) { S.ride.moved = true; p.transform.pos = S.ride.to.slice(); p.vz = 0; if (p.vel) p.vel = [0, 0, 0]; }
      if (S.ride.t >= S.ride.secs) S.ride = null;
      return out;
    }
    const q = p.transform.pos, edge = !!input.act && !S.prev; S.prev = !!input.act;
    // what is found
    let full = null;
    for (const it of M.items || []) {
      if (S.held[it.id] || !near(q, it.at, it.radius || 1.1)) continue;
      const g = it.gives;
      if (!g) { S.held[it.id] = true; say('Found: ' + (it.name || it.id)); continue; }
      // a supply: what it gives, used as it is found
      const hpMax = Number.isFinite(p.hpMax) ? p.hpMax : null, hp = p.body && Number.isFinite(p.body.hp) ? p.body.hp : null;
      const heal = Number.isFinite(g.hp) && g.hp > 0 && hp != null && hpMax != null ? Math.min(g.hp, Math.max(0, hpMax - hp)) : 0;
      const gun = Number.isFinite(g.rounds) && g.rounds > 0 ? [p.weapon, ...(p.loadoutWeapons || [])].find((w) => w && w.reserve != null) : null;
      if (!(heal > 0) && !gun) { full = it.id; if (S.full !== it.id) say((it.name || it.id) + ' · ' + (Number.isFinite(g.hp) ? 'health full' : 'no gun takes it')); continue; }
      if (heal > 0) p.body.hp = hp + heal;
      if (gun) gun.reserve += Math.round(g.rounds);
      S.held[it.id] = true;
      say((it.name || it.id) + (heal > 0 ? ' · +' + Math.round(heal) + ' health' : '') + (gun ? ' · +' + Math.round(g.rounds) + ' rounds' : ''));
    }
    S.full = full;
    // (the hint the body stands in: the nearest whose round it is inside)
    S.hint = null;
    if (M.hints) { let best = Infinity; for (let k = 0; k < M.hints.length; k++) { const h = M.hints[k], d = Math.hypot(q[0] - h.at[0], q[1] - h.at[1]); if (d <= (h.radius || 3.5) && d < best && (h.at[2] == null || Math.abs(q[2] - h.at[2]) < 2.5)) { best = d; S.hint = k; } } }
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
      else if (edge && w.deck) {
        // (the deck where the body stands: ridden to the other end; the deck at the other end: called here, alone)
        const here = atA ? 'a' : 'b', at = S.decks[w.id] || (S.decks[w.id] = w.at || 'a'), D = state.byId[w.deck], half = D && D.body && Array.isArray(D.body.size) ? D.body.size[2] / 2 : 0.15;
        const end = at === 'a' ? 'b' : 'a';
        used = true; S.ride = { way: w.id, kind: 'lift', deck: w.deck, rides: at === here, t: 0, secs: w.secs || 8, z0: w[at][2], z1: w[end][2], end, half };
        // (carried, the body faces where the way says: what the ride is there to show)
        if (at === here && Number.isFinite(w.face)) { p.transform.heading = w.face; if (state.camera) state.camera.camYaw = w.face; }
      }
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
  // THE BUS HEARS IT (the castFacts the events channel reads, wrapped): `mission:item` as a thing is taken, `mission:clue`
  // as one is read, `mission:reveal` as a flag is raised, `mission:ride` as a way is taken, `mission:hint` as the player
  // steps to a new one, `mission:exit` as an exit is taken, `mission:done` once: a page's sound takes them (a pickup, a
  // page turned, the lift, a hint's ping)
  const baseFacts = E.castFacts;
  if (baseFacts) E.castFacts = function castFactsWithMission(state, prev) {
    const out = baseFacts(state, prev), S = state.ms;
    if (!S) return out;
    const keys = (o) => Object.keys(o || {}).filter((k) => o[k]);
    // (a bus already running that has not yet heard this mission hears it from rest)
    const was = prev ? prev.__mission || { held: [], read: [], flags: [], ride: null, hint: null, exit: null, done: false } : null, cur = { held: keys(S.held), read: keys(S.read), flags: keys(S.flags), ride: S.ride ? S.ride.way : null, hint: S.hint ?? null, exit: S.exit ? S.exit.id : null, done: !!S.done };
    out.prev.__mission = cur;
    if (!was) return out;
    const who = state.pilotId;
    for (const id of cur.held) if (!was.held.includes(id)) out.events.push({ type: 'mission:item', entity: who, id });
    for (const id of cur.read) if (!was.read.includes(id)) out.events.push({ type: 'mission:clue', entity: who, id });
    for (const id of cur.flags) if (!was.flags.includes(id)) out.events.push({ type: 'mission:reveal', entity: who, id });
    if (cur.ride && cur.ride !== was.ride) out.events.push({ type: 'mission:ride', entity: who, id: cur.ride });
    if (cur.hint !== null && cur.hint !== was.hint) out.events.push({ type: 'mission:hint', entity: who, at: cur.hint });
    if (cur.exit && cur.exit !== was.exit) out.events.push({ type: 'mission:exit', entity: who, id: cur.exit });
    if (cur.done && !was.done) out.events.push({ type: 'mission:done', entity: who });
    return out;
  };
}
