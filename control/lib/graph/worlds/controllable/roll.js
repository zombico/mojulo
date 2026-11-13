/**
 * roll.js — THE ROLL: what a level's seed picks on it. A level stays a pure function of (recipe, seed): the recipe and
 * the page never change, and the seed its shell sends with game-init (a run's number and step, a session's count)
 * picks which of its things are there this time. Seed 1 is the reference roll: what a page with no shell, a capture
 * and the level played in Node show.
 *
 *   spec.roll: { cover?: [{ of: ['<id>', …], stand: [min, max] }], things?: { <id>: { min, max } },
 *                items?: [{ of: ['<zone>', …], lay: [min, max] }], start?: [{ pos, heading? }, …] }
 *     cover    groups of alternatives: the seed picks how many of a group stand (inside its band), then which
 *     things   each rolled thing's box. A rolled thing is a collider like any wall while it stands (it blocks the
 *              walk, the sight and the shot; the nav grid is cut round it) and is gone whole when it does not: it
 *              never stood, so nothing breaks, falls or is said on the bus.
 *     items    groups of the level's pickups, each by its zone on the bus: the seed lays some and leaves the rest
 *              out. The world holds no pickup (they are the bus's), so the picks are answered for the level's host
 *              to act on: the page and the level played in Node take an unlaid one's zone and marker away.
 *              The glyph the level drew for it (a body in the world, `dec_<zone>`) is sent away here.
 *     at       { <zone>: [x, y, z] } where each rolled pickup lies (read by the page, to put out what it drew there)
 *     start    places the pilot may set out from: the seed picks one, and the pilot stands there, still.
 *     pattern  [{ slots: [[id, …], …], kinds: { <id>: kind }, forms: { <id>: form }, never: [[form, form], …],
 *              ramp: { <form>: [first, last] }, run, beat }]: a LINE of slots, one thing standing in each, picked
 *              one after another so the line is PACED, where a group's picks know nothing of each other: never
 *              more than `run` of one kind running, never a pair of kinds repeated (ABAB) when `beat`, never two
 *              forms side by side that `never` names, and each form weighed by its place in the line (`ramp`: its
 *              weight at the first slot and at the last, whole numbers). Where the rules leave a slot nothing, they
 *              are let go for that slot: a line is always filled.
 *
 *   E.rollOf(roll, seed)      → { stand, gone, lay, unlaid, start }   the picks, pure: ids sorted, `start` an index
 *                               into the roll's starts (null: the level's own)
 *   E.applyRoll(state, seed)  → { seed, stand, gone, lay, unlaid, start } | null   once a world: the gone things
 *                               leave its colliders, the pilot stands at its start. A second call answers what the
 *                               first rolled; null on a world with no roll.
 *
 * THE DICE'S ORDER is a promise too: the cover's groups in their order, then the items', then the start, then the
 * patterns' lines slot by slot. A roll that gains a kind keeps every pick of the kinds it had.
 *
 * Until applyRoll every rolled thing stands. EXACT: the dice are integers only (imul, shifts, a remainder), so every
 * runtime rolls the same from the same seed, and a roll checked in Node is the roll the page plays. No float
 * reaches a pick. Import-free (the page runs this source via toString(), compose.js); emitted only into a page whose
 * world has a roll, so every other page keeps every byte.
 */
export function buildRoll(E) {
  // mulberry32 as whole numbers: below(n) → 0 … n-1 (the seed mixed, so neighbouring seeds roll unlike from the first)
  const dice = (seed) => {
    let a = (Math.imul(seed | 0, 0x9e3779b1) ^ 0x85ebca6b) >>> 0;
    return (n) => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) % n;
    };
  };

  E.rollOf = (roll, seed) => {
    const below = dice(Number.isFinite(seed) ? seed : 1), stand = [], gone = [], lay = [], unlaid = [];
    // a group: how many of it, inside its band, then which (a shuffle, the first n kept)
    const pick = (g, band, kept, left) => {
      const n = band[0] + below(band[1] - band[0] + 1), ids = g.of.slice();
      for (let i = ids.length - 1; i > 0; i--) { const j = below(i + 1), x = ids[i]; ids[i] = ids[j]; ids[j] = x; }
      for (let k = 0; k < ids.length; k++) (k < n ? kept : left).push(ids[k]);
    };
    for (const g of (roll && roll.cover) || []) pick(g, g.stand, stand, gone);
    for (const g of (roll && roll.items) || []) pick(g, g.lay, lay, unlaid);
    const start = roll && roll.start && roll.start.length ? below(roll.start.length) : null;
    // a pattern: its line filled slot by slot, each pick weighed by its place and held to what stands before it
    for (const p of (roll && roll.pattern) || []) {
      const n = p.slots.length, fam = [], form = [];
      for (let k = 0; k < n; k++) {
        const ids = p.slots[k];
        const weigh = (id) => { const r = p.ramp[p.forms[id]]; return r ? (n > 1 ? r[0] + ((((r[1] - r[0]) * k) / (n - 1)) | 0) : r[0]) : 1; };
        const keeps = (id) => {
          const f = p.kinds[id];
          let r = 0;
          for (let i = k - 1; i >= 0 && fam[i] === f; i--) r++;
          if (r >= p.run) return false;
          if (p.beat && k >= 3 && fam[k - 3] !== fam[k - 2] && fam[k - 3] === fam[k - 1] && fam[k - 2] === f) return false;
          if (k >= 1) for (let q = 0; q < p.never.length; q++) if (p.never[q][0] === form[k - 1] && p.never[q][1] === p.forms[id]) return false;
          return true;
        };
        let can = ids.filter((id) => weigh(id) > 0 && keeps(id));
        if (!can.length) can = ids.filter((id) => weigh(id) > 0);
        if (!can.length) can = ids.slice();
        let total = 0;
        for (let i = 0; i < can.length; i++) total += Math.max(1, weigh(can[i]));
        let r = below(total), pickd = can[can.length - 1];
        for (let i = 0; i < can.length; i++) { r -= Math.max(1, weigh(can[i])); if (r < 0) { pickd = can[i]; break; } }
        fam.push(p.kinds[pickd]); form.push(p.forms[pickd]);
        for (let i = 0; i < ids.length; i++) (ids[i] === pickd ? stand : gone).push(ids[i]);
      }
    }
    return { stand: stand.sort(), gone: gone.sort(), lay: lay.sort(), unlaid: unlaid.sort(), start };
  };

  E.registerStateInit((state, spec) => {
    if (!spec || !spec.roll) return;
    state.roll = spec.roll;
    if (!spec.roll.things) return;
    if (!state.colliders) state.colliders = [];
    for (const id of Object.keys(spec.roll.things)) {
      const b = spec.roll.things[id];
      state.colliders.push({ min: [b.min[0], b.min[1], b.min[2]], max: [b.max[0], b.max[1], b.max[2]], of: 'roll:' + id, roll: id });
    }
  });

  E.applyRoll = (state, seed) => {
    if (!state || !state.roll) return null;
    if (state.rolled) return state.rolled;
    const R = E.rollOf(state.roll, seed), gone = {};
    for (const id of R.gone) gone[id] = true;
    if (state.colliders) for (let k = state.colliders.length - 1; k >= 0; k--) if (state.colliders[k].roll != null && gone[state.colliders[k].roll]) state.colliders.splice(k, 1);
    // the start: the pilot stands where the seed says, still, facing as the place says (its own heading, unsaid)
    const at = R.start != null ? state.roll.start[R.start] : null, me = state.byId && state.pilotId ? state.byId[state.pilotId] : null;
    if (at && me && me.transform) {
      me.transform.pos = [at.pos[0], at.pos[1], at.pos[2]];
      if (typeof at.heading === 'number') me.transform.heading = at.heading;
      if (Array.isArray(me.vel)) me.vel = [0, 0, 0];
    }
    // an item left out: the body the level drew for it (its pickup's glyph, game/mechanic-decor.js `dec_<zone>`) is sent
    // away, as the cast sends one away: not drawn, in no zone
    for (const z of R.unlaid) { const d = state.byId ? state.byId['dec_' + z] : null; if (d) { d.gone = true; d.dormant = true; } }
    state.rolled = { seed: Number.isFinite(seed) ? seed : 1, stand: R.stand, gone: R.gone, lay: R.lay, unlaid: R.unlaid, start: R.start };
    return state.rolled;
  };
}
