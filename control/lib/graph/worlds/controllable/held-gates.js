/**
 * HELD GATES (an opt-in builder; docs/metroidvania-map.md "Played"): what stands in a metroidvania's way until the hero
 * holds what opens it, and what the hero picks up to hold it. The gates and the bosses are the world's BREAKABLES
 * (rules-basic.js: colliders that break, their page group `break:<id>` hidden as they go), so they block the walk, stand
 * on and under as any wall does, and a blow strikes them; this builder decides when each may go.
 *
 *   spec.heldGates: { target, gates: [{ id, opens, kind, near?, hp? }], relics: [{ id, at, r?, gives, name?, rule? }],
 *                     bosses: [{ id, gives: [token], name?, rule? }] }
 *     a GATE      its breakable `id`, shut until `opens` (a token) is held: a `wall-break` is then struck down (its hp
 *                 `hp`, the swing's or a shot's blows; before, no blow tells), any other breaks as the target comes within
 *                 `near` metres of it (a grate the small form slips, a lock its key turns); a `boss` seal breaks wherever
 *                 the target stands, as its boss falls
 *     a RELIC     a thing picked up where the target comes within `r` (1.2) of `at`: the token it `gives`, and a `rule`
 *                 laid over the target's own (a power's move: the double jump's `airJumps`); its page group
 *                 `break:<id>` hidden as it is taken
 *     a BOSS      a breakable struck down by the hero (a stand-in until the foes join): its fall gives its tokens and its
 *                 `rule`
 *   state.heldGates: { held: { <token>: time }, got: [{ id, name, t }], open: { <gate id>: time } }   what the page
 *                 reads (the got list its toasts)
 *
 * Nothing in a box falls: a gate in a floor's hole stands where it is built (the world's `breakFloor` lifted). What is
 * gone is no ground: the ground probe looks on down past a gate opened, a boss felled and a relic taken.
 *
 * Import-free (the page runs this source, compose.js); emitted only into a page whose world has held gates, so every
 * other page keeps every byte. Wraps createWorld and stepWorld.
 */
export function buildHeldGates(E) {
  const make = E.createWorld, step = E.stepWorld;
  const near = (b, p, r) => {
    let d = 0;
    for (let k = 0; k < 3; k++) { const v = Math.max(b.min[k] - p[k], 0, p[k] - b.max[k]); d += v * v; }
    return Math.sqrt(d) <= r;
  };
  E.createWorld = function createWithHeldGates(spec) {
    const s = make(spec), H = spec && spec.heldGates;
    if (!H || typeof H !== 'object') return s;
    s.heldGates = { spec: H, held: {}, got: [], open: {}, taken: {}, felled: {}, armed: {} };
    // (nothing in a box falls: its gates stand in the holes they are built in)
    s.breakFloor = Infinity;
    if (!s.breaks) { s.breaks = []; s.breakSeq = 0; }
    // (every gate and boss stand-in unbreakable until what opens it is held)
    for (const b of s.breakables || []) if ((H.gates || []).some((g) => g.id === b.id)) b.hp = Infinity;
    return s;
  };
  const give = (state, G, T, tokens, rule, id, name) => {
    for (const k of tokens) if (k && G.held[k] == null) G.held[k] = state.time;
    if (rule && T && T.rule) { Object.assign(T.rule, rule); if (T.pilotRule && T.pilotRule !== T.rule) Object.assign(T.pilotRule, rule); }
    G.got.push({ id, name: name || id, t: state.time });
  };
  // what is gone is no ground: a probe that meets the top of a gate opened, a boss felled or a relic taken looks on down
  // past it (the page's and a headless run's ground alike, whatever either keeps of its faces)
  const RELIC_HALF = 0.3;
  function groundPast(state, g0) {
    const G = state.heldGates, gone = [];
    for (const b of state.breakables || []) if (b.broken) gone.push(b);
    for (const R of G.spec.relics || []) if (G.taken[R.id] != null) gone.push({ min: [0, R.at[1] - RELIC_HALF, R.at[2] - RELIC_HALF], max: [0, R.at[1] + RELIC_HALF, R.at[2] + RELIC_HALF] });
    if (!gone.length) return g0;
    return (q) => {
      let g = g0(q);
      for (let k = 0; k < 6 && typeof g === 'number'; k++) {
        const b = gone.find((o) => q[1] >= o.min[1] - 0.05 && q[1] <= o.max[1] + 0.05 && Math.abs(g - o.max[2]) < 0.03);
        if (!b) break;
        g = g0([q[0], q[1], b.min[2] - 0.01]);
      }
      return g;
    };
  }
  E.stepWorld = function stepWithHeldGates(state, input, dt, hooks) {
    const G0 = state.heldGates, g0 = hooks && hooks.ground, ground = G0 && g0 ? groundPast(state, g0) : g0;
    const out = step(state, input, dt, ground !== g0 ? { ...hooks, ground } : hooks), G = state.heldGates;
    if (!G) return out;
    const H = G.spec, T = state.byId ? state.byId[H.target || 'hero'] : null, p0 = T && T.transform ? T.transform.pos : null;
    // (the body's middle: its feet, the eye under the pos, and most of a stride up)
    const p = p0 ? [p0[0], p0[1], p0[2] - ((T.rule && T.rule.eye) || 0) + 0.9] : null;
    const blk = (id) => (state.breakables || []).find((b) => b.id === id);
    // RELICS: picked up where the target comes near
    if (p) for (const R of H.relics || []) {
      if (G.taken[R.id] != null) continue;
      const d = Math.hypot(p[0] - R.at[0], p[1] - R.at[1], p[2] - R.at[2]);
      if (d > (R.r || 1.2)) continue;
      G.taken[R.id] = state.time;
      give(state, G, T, [R.gives], R.rule, R.id, R.name);
      state.breaks.push({ seq: state.breakSeq++, id: R.id, t: state.time, at: R.at.slice(), by: T.id, how: 'restore' });
    }
    // BOSSES: struck down, they give
    for (const B of H.bosses || []) {
      const b = blk(B.id);
      if (!b || !b.broken || G.felled[B.id] != null) continue;
      G.felled[B.id] = state.time;
      give(state, G, T, B.gives || [], B.rule, B.id, B.name);
    }
    // GATES: open as what opens them is held
    for (const g of H.gates || []) {
      const b = blk(g.id);
      if (!b || b.broken) { if (b && b.broken && G.open[g.id] == null) G.open[g.id] = state.time; continue; }
      if (G.held[g.opens] == null) { b.hp = Infinity; continue; }
      if (g.kind === 'wall-break') { if (!G.armed[g.id]) { G.armed[g.id] = true; b.hp = g.hp || 2; } continue; }
      if (g.kind === 'boss' || (p && near(b, p, g.near || 1.5))) { E.breakBlock(state, g.id, Infinity, T ? T.id : null); G.open[g.id] = state.time; }
    }
    return out;
  };
}
