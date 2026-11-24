/**
 * HELD GATES (an opt-in builder; docs/metroidvania-map.md "Played"): what stands in a metroidvania's way until the hero
 * holds what opens it, and what the hero picks up to hold it. The gates and the bosses are the world's BREAKABLES
 * (rules-basic.js: colliders that break, their page group `break:<id>` hidden as they go), so they block the walk, stand
 * on and under as any wall does, and a blow strikes them; this builder decides when each may go.
 *
 *   spec.heldGates: { target, gates: [{ id, opens, kind, near?, hp? }], relics: [{ id, at, r?, gives, name?, rule? }],
 *                     bosses: [{ id, entity?, gives: [token], name?, rule?, title?, room?, shut? }], saves?: [SAVE] }
 *     a GATE      its breakable `id`, shut until `opens` (a token) is held: a `wall-break` is then struck down (its hp
 *                 `hp`, the swing's or a shot's blows; before, no blow tells), any other breaks as the target comes within
 *                 `near` metres of it (a grate the small form slips, a lock its key turns); a `boss` seal breaks wherever
 *                 the target stands, as its boss falls
 *     a RELIC     a thing picked up where the target comes within `r` (1.2) of `at`: the token it `gives`, and a `rule`
 *                 laid over the target's own (a power's move: the double jump's `airJumps`); its page group
 *                 `break:<id>` hidden as it is taken
 *     a BOSS      a breakable struck down by the hero (a stand-in block), or a body of the world (`entity`: a foe stood at
 *                 the boss's rank) felled: its fall gives its tokens and its `rule`; `title` and `room` ([s0, s1, z0, z1])
 *                 its name and where its bar is shown (held-gates-view.js). Its room SHUTS (`shut`: boxes, a bar across
 *                 each doorway and a grate over each hole) once the target is IN metres inside it while it stands: walls
 *                 (colliders, `of` boss-shut:<id>) until it falls; `fight` the boss being fought
 *     a FIGHT     lost (the target's health spent in it): the room opens, and the boss is back where it first stood,
 *                 whole: the fight from its start when she comes back
 *     a SAVE      a save room, `{ id, name, rect: [s0, s1, z0, z1], at: [s, z] }`: walked into, it fills the target's
 *                 health (its body's `hpMax`) and its MP (its moveset's `mp.max`, the arsenal's pool) and becomes where it
 *                 wakes; the first named is where it wakes before it has stood in any
 *     DEATH       the target's health spent (its body's hp at 0, or downed): it wakes in the last save room it stood in,
 *                 full, KEEPING everything held and taken (an action RPG's death, never a life lost); `deaths` counts them
 *   state.heldGates: { held: { <token>: time }, got: [{ id, name, t }], open: { <gate id>: time }, fight, save, deaths }   what
 *                 the page reads (the got list its toasts, the target's hp and mp its bars)
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
    s.heldGates = { spec: H, held: {}, got: [], open: {}, taken: {}, felled: {}, armed: {}, fight: null, whole: {}, save: (H.saves && H.saves[0] && H.saves[0].id) || null, inSave: null, deaths: 0 };
    // (nothing in a box falls: its gates stand in the holes they are built in)
    s.breakFloor = Infinity;
    if (!s.breaks) { s.breaks = []; s.breakSeq = 0; }
    // (each boss that is a body of the world as it first stands: where a fight lost puts it back, whole)
    for (const B of H.bosses || []) {
      const e = B.entity && s.byId ? s.byId[B.entity] : null;
      if (e && e.transform) s.heldGates.whole[B.id] = { pos: e.transform.pos.slice(), heading: e.transform.heading, hp: e.body && Number.isFinite(e.body.hp) ? e.body.hp : null };
    }
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
  // A BOSS'S ROOM SHUT: its walls laid (colliders `of` boss-shut:<id>); opened, the walls lifted and (a fight lost) the
  // boss put back where it first stood, whole
  const IN = 1.5;
  function shut(state, G, B, e) {
    G.fight = B.id;
    if (!state.colliders) state.colliders = [];
    for (const b of B.shut || []) state.colliders.push({ min: b.min.slice(), max: b.max.slice(), of: 'boss-shut:' + B.id });
  }
  function open(state, G, lost) {
    const id = G.fight, B = (G.spec.bosses || []).find((x) => x.id === id), e = B && B.entity && state.byId[B.entity], o = G.whole[id];
    state.colliders = (state.colliders || []).filter((c) => c.of !== 'boss-shut:' + id);
    if (lost && e && o && !e.gone) {
      e.transform.pos = o.pos.slice(); e.transform.heading = o.heading; if (e.body && o.hp != null) e.body.hp = o.hp;
      e.vel = [0, 0, 0]; e.downed = false; e.foeRock = null; e.foeRockT = 0; e.foeT = 0; e.hits = 0; e.staggerT = 0;
    }
    G.fight = null;
  }
  E.stepWorld = function stepWithHeldGates(state, input, dt, hooks) {
    const G0 = state.heldGates, g0 = hooks && hooks.ground, ground = G0 && g0 ? groundPast(state, g0) : g0;
    const out = step(state, input, dt, ground !== g0 ? { ...hooks, ground } : hooks), G = state.heldGates;
    if (!G) return out;
    const H = G.spec, T = state.byId ? state.byId[H.target || 'hero'] : null, p0 = T && T.transform ? T.transform.pos : null;
    // (the body's middle: its feet, the eye under the pos, and most of a stride up)
    const p = p0 ? [p0[0], p0[1], p0[2] - ((T.rule && T.rule.eye) || 0) + 0.9] : null;
    const full = () => {
      if (T.body && Number.isFinite(T.hpMax || T.body.hpMax)) T.body.hp = T.hpMax || T.body.hpMax;
      const mp = T.rule && T.rule.moveset && T.rule.moveset.mp;
      if (mp) T.mp = mp.max;
    };
    // SAVE ROOMS: walked into, the target is full and wakes here from now on
    if (p && T) {
      const foot = p0[2] - ((T.rule && T.rule.eye) || 0), S = (H.saves || []).find((q) => p[1] >= q.rect[0] && p[1] <= q.rect[1] && foot >= q.rect[2] && foot <= q.rect[3]);
      if (S && G.inSave !== S.id) { G.inSave = S.id; G.save = S.id; full(); G.got.push({ id: 'save:' + S.id, name: 'Saved · ' + (S.name || S.id), t: state.time, kind: 'save' }); }
      if (!S) G.inSave = null;
    }
    // DEATH: health spent, it wakes in its last save room, full, keeping all it holds
    if (T && T.body && (T.downed || (Number.isFinite(T.body.hp) && T.body.hp <= 0))) {
      const S = (H.saves || []).find((q) => q.id === G.save) || (H.saves || [])[0];
      if (S) {
        // (a fight lost: its room opens and its boss is back as it stood)
        if (G.fight) open(state, G, true);
        const eye = (T.rule && T.rule.eye) || 0;
        T.transform.pos = [0, S.at[0], S.at[1] + eye + 0.05];
        T.vel = [0, 0, 0]; T.dashVel = null; T.climbing = null; T.grounded = false;
        T.downed = false; T.deadAt = null; T.dropping = false; T.deathBurstDone = false; T.staggerT = 0; T.hits = 0; T.downPauseT = 0;
        full();
        G.deaths++; G.inSave = S.id;
        G.got.push({ id: 'wake:' + G.deaths, name: 'Woken in ' + (S.name || S.id), t: state.time, kind: 'wake' });
        if (state.camera) { state.camera._cut = true; state.camera._zoneAt = null; state.camera._fell = null; }
      }
    }
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
      // (a stand-in block struck down, or a boss that is a body of the world, `entity`, felled)
      const b = B.entity ? null : blk(B.id), e = B.entity && state.byId ? state.byId[B.entity] : null;
      if (B.entity ? !(e && (e.downed || e.gone)) : !(b && b.broken)) continue;
      if (G.felled[B.id] != null) continue;
      G.felled[B.id] = state.time;
      if (G.fight === B.id) open(state, G, false);
      give(state, G, T, B.gives || [], B.rule, B.id, B.name);
    }
    // a BOSS'S ROOM shut behind the target once it is IN metres inside, while its boss stands
    if (p && T && !G.fight) for (const B of H.bosses || []) {
      const q = B.room, e = B.entity && state.byId ? state.byId[B.entity] : null;
      if (!q || !e || !(B.shut && B.shut.length) || e.downed || e.gone || G.felled[B.id] != null) continue;
      const foot = p0[2] - ((T.rule && T.rule.eye) || 0), st = (T.rule && T.rule.collideHeight) || 1.7;
      // (wholly in the room, and clear of every bar and grate it lays: never shut on her, jumping up through a hole)
      const rad = (T.rule && T.rule.collideRadius) || 0.3, clear = B.shut.every((b) => p[1] + rad < b.min[1] || p[1] - rad > b.max[1] || foot + st < b.min[2] || foot > b.max[2] - 0.05);
      if (p[1] >= q[0] + IN && p[1] <= q[1] - IN && foot >= q[2] - 0.05 && foot + st <= q[3] - 0.3 && clear) { shut(state, G, B, e); break; }
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
