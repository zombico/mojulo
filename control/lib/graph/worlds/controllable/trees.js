/**
 * THE HERO'S TREES (an opt-in builder; gameworld/trees/tree.js): the skill tree on how it moves and the tech tree on its
 * spells and attacks, learned as it plays. One purse of points for both, earned by what it holds; a node learned is
 * the hero's from then on.
 *
 *   spec.trees: { target, points: { boss?, power?, key?, prize? }, trees: [{ id, name }], nodes: [NODE] }
 *     NODE = { id, tree, name, about, requires: [id], cost, found?: token, patch?: { <path>: value }, combos?: [id] }
 *     SOULS     each foe's fall (`team: 'foes'`, downed) its rank's souls (`souls`: { minion, elite, per }), a point for
 *               every `per` of them
 *     POINTS    each held token of a kind (the held gates' `held`: `boss:` a boss felled, `gate:` a power found, `key:`,
 *               `prize:` a pocket's prize) gives its kind's points; spent points are gone
 *     LEARNED   a node whose requirements are learned, bought with its cost (`learn(id)`), or, `found`, given the moment
 *               its token is held; a node of cost 0 that requires nothing is the hero's from the start
 *     a MOVE    its `patch` laid on the target's rule (each key a path in it, `dash.air.count`: two skills that turn the
 *               same part both hold)
 *     a TECH    its `combos` opened in the target's moveset: the moveset the level lays holds every string, its
 *               `gated` ones held shut; the target plays a copy with each shut string's beats cut from its trees (a beat
 *               the hero's own string shares stays), cut again as a tech is learned (combat-melee.js plays what it is
 *               given, never told)
 *   state.trees: { spec, learned: { <id>: time }, spent, open: { <string>: true }, points(), states(), learn(id) → { ok,
 *               why? }, grant(n), log }
 *
 * Import-free (the page runs this source, compose.js); emitted only into a page whose world has trees. Wraps createWorld
 * and stepWorld, after the held gates it reads what is held from.
 */
export function buildTrees(E) {
  const make = E.createWorld, step = E.stepWorld;
  const PREFIX = { boss: 'boss:', power: 'gate:', key: 'key:', prize: 'prize:' };
  const setIn = (o, ks, v) => {
    if (ks.length === 1) { o[ks[0]] = v; return; }
    const c = o[ks[0]] && typeof o[ks[0]] === 'object' ? { ...o[ks[0]] } : {};
    setIn(c, ks.slice(1), v);
    o[ks[0]] = c;
  };
  const target = (s) => s.byId ? s.byId[s.trees.spec.target] : (s.entities || []).find((e) => e.id === s.trees.spec.target);
  function earned(s) {
    const P = s.trees.spec.points || {}, held = (s.heldGates && s.heldGates.held) || {};
    let n = 0;
    for (const k in held) for (const kind in P) if (PREFIX[kind] && k.indexOf(PREFIX[kind]) === 0) n += P[kind];
    // (and each foe's fall, its souls by its rank, a point for every `per` of them: counted as it falls)
    const S = s.trees.spec.souls;
    if (S) n += Math.floor(s.trees.souls / S.per);
    return n + (s.trees.granted || 0);
  }
  function apply(s, N) {
    const T = target(s);
    if (!T) return;
    if (N.patch) for (const path in N.patch) {
      const ks = path.split('.');
      if (T.rule) setIn(T.rule, ks, N.patch[path]);
      if (T.pilotRule && T.pilotRule !== T.rule) setIn(T.pilotRule, ks, N.patch[path]);
    }
    if (N.combos) { s.trees.open = { ...s.trees.open }; for (const c of N.combos) s.trees.open[c] = true; cut(s); }
  }
  // the moveset played: the full one's trees with every beat that runs only shut strings cut away
  function prune(level, shut) {
    if (!level) return level;
    const out = {};
    for (const b in level) {
      const n = level[b];
      if (n.combos && n.combos.length && n.combos.every((c) => shut[c])) continue;
      out[b] = { ...n, ...(n.next ? { next: prune(n.next, shut) } : {}), ...(n.pause ? { pause: prune(n.pause, shut) } : {}) };
    }
    return out;
  }
  function cut(s) {
    const Tr = s.trees, T = target(s);
    if (!T || !Tr.full) return;
    const shut = {};
    for (const c in Tr.full.gated || {}) if (!Tr.open[c]) shut[c] = true;
    const M = { ...Tr.full, tree: prune(Tr.full.tree, shut), ...(Tr.full.airTree ? { airTree: prune(Tr.full.airTree, shut) } : {}) };
    if (Tr.full.specials) { M.specials = {}; for (const b in Tr.full.specials) if (M.tree[b]) M.specials[b] = Tr.full.specials[b]; }
    if (T.rule) T.rule.moveset = M;
    if (T.pilotRule && T.pilotRule !== T.rule) T.pilotRule.moveset = M;
  }
  function give(s, N, how) {
    const Tr = s.trees;
    Tr.learned[N.id] = s.time || 0;
    Tr.log.push({ id: N.id, name: N.name, how, t: s.time || 0 });
    apply(s, N);
  }
  function learn(s, id) {
    const Tr = s.trees, N = Tr.spec.nodes.find((n) => n.id === id);
    if (!N) return { ok: false, why: 'no such node' };
    if (Tr.learned[id] != null) return { ok: false, why: 'learned already' };
    if (N.found) return { ok: false, why: 'given by a power found' };
    const need = N.requires.filter((r) => Tr.learned[r] == null);
    if (need.length) return { ok: false, why: `needs ${need.join(', ')}` };
    if (N.cost > earned(s) - Tr.spent) return { ok: false, why: `costs ${N.cost} of ${earned(s) - Tr.spent}` };
    Tr.spent += N.cost;
    give(s, N, 'bought');
    return { ok: true };
  }
  function states(s) {
    const Tr = s.trees, left = earned(s) - Tr.spent;
    return Tr.spec.nodes.map((n) => ({ id: n.id, tree: n.tree, name: n.name, about: n.about, cost: n.cost, requires: n.requires.slice(),
      state: Tr.learned[n.id] != null ? 'learned' : n.found ? 'found' : n.requires.every((r) => Tr.learned[r] != null) && n.cost <= left ? 'available' : 'locked' }));
  }
  E.createWorld = function createWithTrees(spec) {
    const s = make(spec), T = spec && spec.trees;
    if (!T || typeof T !== 'object') return s;
    s.trees = { spec: T, learned: {}, spent: 0, granted: 0, log: [], open: {}, souls: 0, fallen: {}, soulsOf: {} };
    // (the target's moveset in full, its shut strings cut from what it plays)
    const H = target(s);
    if (H && H.rule && H.rule.moveset && H.rule.moveset.gated) { s.trees.full = H.rule.moveset; cut(s); }
    s.trees.learn = (id) => learn(s, id);
    s.trees.points = () => earned(s) - s.trees.spent;
    s.trees.states = () => states(s);
    s.trees.grant = (n) => { s.trees.granted += n; };
    // (a node learned in another segment of the castle, carried in: learned again as it was, paid for as it was;
    // held-gates.js carryIn)
    s.trees.carry = (id) => {
      const N = T.nodes.find((n) => n.id === id);
      if (!N || s.trees.learned[id] != null) return false;
      if (!N.found) s.trees.spent += N.cost || 0;
      give(s, N, 'carried');
      return true;
    };
    // (what the hero starts with: a node that costs nothing and needs nothing)
    for (const N of T.nodes) if (!N.found && !N.cost && !N.requires.length) give(s, N, 'start');
    return s;
  };
  E.stepWorld = function stepWithTrees(state, input, dt, hooks) {
    const out = step(state, input, dt, hooks), Tr = state.trees;
    if (!Tr) return out;
    // (a found node given the moment its power is held, once its requirements are)
    const held = (state.heldGates && state.heldGates.held) || {};
    // (the foes fallen since: each its souls, once)
    if (Tr.spec.souls) for (const e of state.entities || []) {
      if (e.team !== 'foes' || !e.downed || Tr.fallen[e.id]) continue;
      Tr.fallen[e.id] = state.time || 0;
      const n = Tr.spec.souls[(e.rule && e.rule.mind && e.rule.mind.rank) === 'elite' ? 'elite' : 'minion'] || 0;
      Tr.souls += n; Tr.soulsOf[e.id] = n;
    }
    for (const N of Tr.spec.nodes) if (N.found && Tr.learned[N.id] == null && held[N.found] != null && N.requires.every((r) => Tr.learned[r] != null)) give(state, N, 'found');
    return out;
  };
}
