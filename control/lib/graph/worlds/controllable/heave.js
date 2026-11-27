/**
 * heave.js — WHAT A MOVER LIFTS (an OPT-IN builder, compose.js EMISSION_OPT_IN.heave: emitted only into a page whose world
 * carries `heave`, so every other page keeps its bytes): any piece of a room (a couch, a fridge, a box) lifted whole by the
 * pilot and carried in its hands. While a piece is held it is no thing in the world: its box is out of the colliders, so
 * nothing it would hit stops it (a door's frame, a stairwell, a hall's corner): it fits through almost any door, up and
 * down any stair, because the one who carries it does. Set down, it stands where it was put, its box back.
 *
 *   world spec `heave`: {
 *     pieces: [{ id, min, max, name? }]   what may be lifted, each its box at rest (a stage's prop, its collider's box)
 *     drop?:  { at: [x, y, z], half: [hx, hy] }   where a piece carried in is LOADED (the truck at the door): gone for good
 *     reach?: 1.6      m from the pilot's feet to a piece's nearest side, for the action to take hold of it
 *     hold?:  { up: 0.95, ahead: 0.25 }   the held piece's underside over the pilot's feet, its near side ahead of it
 *     slow?:  0.8      the pilot's pace while it carries (a share of what it would have gone)
 *   }
 *
 * The action (`input.act`, an edge) takes hold of the nearest piece within reach that the pilot faces (or stands by),
 * when nothing is held; held, the action sets it down on the ground before the pilot. While it carries the pilot does not
 * jump or fire. Walked into the drop zone, what is held is loaded.
 *
 *   state.heave { pieces: [{ id, name, min, max, rest, at, held, loaded }], held, drop, loaded }
 *   E.heaveTarget(state, pilot)   the piece the action would take hold of now, or null (the page's prompt)
 *   bus: `heave:lift` { piece }, `heave:set` { piece }, `heave:load` { piece, n } (castFacts, wrapped)
 *
 * Wraps stepWorld (its before reads the action, its after carries the piece). Import-free (the page runs this source via
 * toString(), compose.js).
 */
export function buildHeave(E) {
  const step = E.stepWorld;
  const D = { reach: 1.6, hold: { up: 0.95, ahead: 0.25 }, slow: 0.8 };
  const EPS = 1e-3;
  const same = (a, b) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS && Math.abs(a[2] - b[2]) < EPS;
  // (the nearest point of a box's footprint to a point, and the distance to it in plan)
  const planDist = (P, q) => Math.hypot(Math.max(P.min[0] - q[0], 0, q[0] - P.max[0]), Math.max(P.min[1] - q[1], 0, q[1] - P.max[1]));
  const mid = (P) => [(P.min[0] + P.max[0]) / 2, (P.min[1] + P.max[1]) / 2, P.min[2]];
  // (where the pilot stands: its feet, under its eye where its rule carries one, a stage's first-person walker)
  const feetOf = (p) => p.transform.pos[2] - ((p.rule && p.rule.eye) || 0);

  E.registerStateInit((state, spec) => {
    const H = spec.heave;
    if (!H || !Array.isArray(H.pieces) || !H.pieces.length) return;
    state.heave = {
      pieces: H.pieces.map((p) => ({ id: p.id, name: p.name || p.id, min: [...p.min], max: [...p.max], rest: [...p.min], held: false, loaded: false, box: null })),
      held: null, loaded: 0,
      drop: H.drop && Array.isArray(H.drop.at) ? { at: [...H.drop.at], half: [...(H.drop.half || [1.5, 1.5])] } : null,
      reach: H.reach ?? D.reach, hold: { ...D.hold, ...(H.hold || {}) }, slow: H.slow ?? D.slow, seq: 0, log: [],
    };
    // (each piece's own box among the world's colliders, found by its rest box: what is taken out while it is held)
    for (const P of state.heave.pieces) P.box = (state.colliders || []).find((c) => same(c.min, P.min) && same(c.max, P.max)) || null;
  });

  E.heaveTarget = (state, p) => {
    const S = state.heave;
    if (!S || S.held || !p || p.downed || p.gone) return null;
    const q = p.transform.pos, h = p.transform.heading, f = [Math.cos(h), Math.sin(h)], z = feetOf(p);
    let best = null, bd = Infinity;
    for (const P of S.pieces) {
      if (P.held || P.loaded) continue;
      // (on its floor: a piece a storey up or down is not in reach)
      if (P.min[2] > z + 1.2 || P.max[2] < z + 0.05) continue;
      const d = planDist(P, q);
      if (d > S.reach) continue;
      // (the one faced first: a piece behind the pilot counts as farther)
      const m = mid(P), ux = m[0] - q[0], uy = m[1] - q[1], ul = Math.hypot(ux, uy) || 1, facing = (ux * f[0] + uy * f[1]) / ul;
      const score = d + (facing < 0 ? 1 : 0) + (1 - facing) * 0.2;
      if (score < bd) { bd = score; best = P; }
    }
    return best;
  };

  function log(S, type, P) { S.log.push({ seq: S.seq++, type, piece: P.id, ...(type === 'load' ? { n: S.loaded } : {}) }); }
  const unblock = (state, P) => { if (P.box && state.colliders) { const k = state.colliders.indexOf(P.box); if (k >= 0) state.colliders.splice(k, 1); } };
  const block = (state, P) => {
    if (!P.box) return;
    P.box.min = [...P.min]; P.box.max = [...P.max];
    if (!state.colliders) state.colliders = [];
    if (!state.colliders.includes(P.box)) state.colliders.push(P.box);
  };
  // the piece placed by its underside's corner at `at` (its min), its size kept
  const moveTo = (P, at) => { const s = [0, 1, 2].map((k) => P.max[k] - P.min[k]); P.min = [...at]; P.max = at.map((v, k) => v + s[k]); };

  E.stepWorld = function stepWorld(state, input, dt, hooks) {
    const S = state.heave, p = S && state.pilotId ? state.byId[state.pilotId] : null;
    if (!S || !p) return step(state, input, dt, hooks);
    let inp = input || {};
    const act = !!inp.act, edge = act && !S.actPrev; S.actPrev = act;
    // THE ACTION: take hold of the piece faced, or set down the one held
    if (edge && !p.downed && !p.gone) {
      if (S.held) {
        const P = S.pieces.find((x) => x.id === S.held);
        const q = p.transform.pos, h = p.transform.heading, s = [0, 1, 2].map((k) => P.max[k] - P.min[k]), far = S.hold.ahead + Math.max(s[0], s[1]) / 2 + 0.3;
        const c = [q[0] + Math.cos(h) * far, q[1] + Math.sin(h) * far];
        const z = feetOf(p), g = hooks && hooks.ground ? hooks.ground([c[0], c[1], z + 1]) : null;
        moveTo(P, [c[0] - s[0] / 2, c[1] - s[1] / 2, g != null && Math.abs(g - z) < 1 ? g : z]);
        P.held = false; S.held = null; block(state, P); log(S, 'set', P);
      } else {
        const P = E.heaveTarget(state, p);
        if (P) { P.held = true; S.held = P.id; unblock(state, P); log(S, 'lift', P); }
      }
      inp = { ...inp, act: 0 };
    }
    if (S.held) inp = { ...inp, fire: 0, aim: 0, jump: 0 };
    const from = p.transform.pos.slice();
    const out = step(state, inp, dt, hooks);
    if (S.held) {
      const P = S.pieces.find((x) => x.id === S.held), q = p.transform.pos;
      // (the pilot slowed by what it carries)
      const dx = q[0] - from[0], dy = q[1] - from[1];
      q[0] = from[0] + dx * S.slow; q[1] = from[1] + dy * S.slow;
      // CARRIED: in the hands, its near side just ahead of the pilot, its underside at the hands' height
      const h = p.transform.heading, s = [0, 1, 2].map((k) => P.max[k] - P.min[k]), far = S.hold.ahead + Math.max(s[0], s[1]) / 2;
      const c = [q[0] + Math.cos(h) * far, q[1] + Math.sin(h) * far];
      const z = feetOf(p);
      moveTo(P, [c[0] - s[0] / 2, c[1] - s[1] / 2, z + S.hold.up]);
      // LOADED: carried into the drop zone (the truck at the door), it is gone for good
      const Z = S.drop;
      if (Z && Math.abs(q[0] - Z.at[0]) <= Z.half[0] && Math.abs(q[1] - Z.at[1]) <= Z.half[1] && Math.abs(z - Z.at[2]) < 1) {
        P.held = false; P.loaded = true; S.held = null; S.loaded++; log(S, 'load', P);
      }
    }
    return out;
  };

  // the bus hears what is lifted, set down and loaded (the castFacts the events channel reads, wrapped)
  const baseFacts = E.castFacts;
  E.castFacts = function castFacts(state, prev) {
    const out = baseFacts(state, prev), S = state.heave;
    if (!S) return out;
    const was = prev && prev.__heave != null ? prev.__heave : null;
    out.prev.__heave = S.seq;
    if (was === null) return out;
    for (const r of S.log) if (r.seq >= was) out.events.push({ type: `heave:${r.type}`, entity: state.pilotId, piece: r.piece, ...(r.n !== undefined ? { n: r.n } : {}) });
    S.log = S.log.filter((r) => r.seq >= S.seq - 32);
    return out;
  };
}
