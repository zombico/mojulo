/**
 * math-rules-kernel — the axioms-as-physics reducer for playable theorems (math-worlds.plan.md,
 * Phase 2). Where the physics kernel (physics-sim.js) enforces Newton and the event bus assigns
 * meaning to contacts, THIS kernel enforces a MATH structure's own rules: the world's interaction
 * law IS the theorem, and the theorem is what you discover by failing to violate it.
 *
 * SINGLE SOURCE OF TRUTH, same discipline as buildBus / buildSim: the whole reducer lives inside
 * `buildMathRules()`, a self-contained closure referencing nothing outside itself, so the browser
 * `/world` can run the SAME code by emitting `buildMathRules.toString()` into the page, while Node
 * imports the live instance below (tested in math-rules-kernel.test.js). One definition,
 * byte-for-byte, on both sides. Determinism is the oracle: it makes "the world won't let you
 * finish" a checkable property (replay a path → get the same stuck-point every time).
 *
 * The first rule is the CONSUMABLE EDGE (Königsberg's retracting bridges): every edge may be
 * crossed at most once; a crossed edge retracts and is thereafter impassable. On that one rule the
 * Eulerian-trail theorem becomes the SHAPE OF THE FRUSTRATION — a graph with more than two
 * odd-degree nodes strands every attempt, and `{ stuck: true }` from a traversal is not a failure
 * but a COUNTEREXAMPLE CERTIFICATE the agent can verify.
 */

export function buildMathRules() {
  // ── consumable-edge trail reducer ──────────────────────────────────────────────────────────
  // edges: [{ id, a, b }] undirected; nodes are whatever ids appear on a/b. Pure & order-stable.

  const makeTrail = (startNode) => ({ at: startNode ?? null, used: {}, crossings: [] });

  // bridges from `node` not yet retracted, in stable id order (determinism).
  const openEdgesFrom = (edges, node, trail) =>
    edges
      .filter((e) => !trail.used[e.id] && (e.a === node || e.b === node))
      .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

  // attempt to cross `edgeId`. Returns { ok, ... } and MUTATES trail on success. A retracted or
  // non-adjacent bridge is refused — the world simply will not let you cross it.
  const cross = (edges, trail, edgeId) => {
    const e = edges.find((x) => x.id === edgeId);
    if (!e) return { ok: false, reason: 'no-such-bridge', edge: edgeId };
    if (trail.used[e.id]) return { ok: false, reason: 'bridge-retracted', edge: e.id };
    const from = trail.at == null ? e.a : trail.at;
    if (e.a !== from && e.b !== from) return { ok: false, reason: 'not-adjacent', edge: e.id, at: trail.at };
    const to = e.a === from ? e.b : e.a;
    trail.used[e.id] = true;
    trail.at = to;
    trail.crossings.push(e.id);
    return { ok: true, from, to, edge: e.id, remaining: edges.length - trail.crossings.length };
  };

  // is the trail COMPLETE (every bridge crossed exactly once = an Eulerian trail)?
  const complete = (edges, trail) => trail.crossings.length === edges.length;

  // is the trail STUCK (not complete, and no open bridge from the current node)?
  const stuck = (edges, trail) => !complete(edges, trail) && openEdgesFrom(edges, trail.at, trail).length === 0;

  return { makeTrail, openEdgesFrom, cross, complete, stuck };
}

// Node-side live instance (the browser gets buildMathRules.toString()).
export const MATH_RULES = buildMathRules();
