/**
 * roll.js — THE ROLL: what a level's seed picks on it. A level stays a pure function of (recipe, seed): the recipe and
 * the page never change, and the seed its shell sends with game-init (a run's number and step, a session's count)
 * picks which of its things are there this time. Seed 1 is the reference roll: what a page with no shell, a capture
 * and the level played in Node show.
 *
 *   spec.roll: { cover: [{ of: ['<id>', …], stand: [min, max] }], things: { <id>: { min, max } } }
 *     cover    groups of alternatives: the seed picks how many of a group stand (inside its band), then which
 *     things   each rolled thing's box. A rolled thing is a collider like any wall while it stands (it blocks the
 *              walk, the sight and the shot; the nav grid is cut round it) and is gone whole when it does not: it
 *              never stood, so nothing breaks, falls or is said on the bus.
 *
 *   E.rollOf(roll, seed)      → { stand: [id], gone: [id] }   the picks, pure, ids sorted
 *   E.applyRoll(state, seed)  → { seed, stand, gone } | null  once a world: the gone things leave its colliders. A
 *                               second call answers what the first rolled; null on a world with no roll.
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
    const below = dice(Number.isFinite(seed) ? seed : 1), stand = [], gone = [];
    for (const g of (roll && roll.cover) || []) {
      const lo = g.stand[0], hi = g.stand[1], n = lo + below(hi - lo + 1), ids = g.of.slice();
      for (let i = ids.length - 1; i > 0; i--) { const j = below(i + 1), x = ids[i]; ids[i] = ids[j]; ids[j] = x; }
      for (let k = 0; k < ids.length; k++) (k < n ? stand : gone).push(ids[k]);
    }
    return { stand: stand.sort(), gone: gone.sort() };
  };

  E.registerStateInit((state, spec) => {
    if (!spec || !spec.roll || !spec.roll.things) return;
    if (!state.colliders) state.colliders = [];
    state.roll = spec.roll;
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
    for (let k = state.colliders.length - 1; k >= 0; k--) if (state.colliders[k].roll != null && gone[state.colliders[k].roll]) state.colliders.splice(k, 1);
    state.rolled = { seed: Number.isFinite(seed) ? seed : 1, stand: R.stand, gone: R.gone };
    return state.rolled;
  };
}
