/**
 * cayley-graph — the PURE group→graph→plan step (math-worlds.plan.md, Phase 1).
 *
 * Turns a built group (group-presentation.js) into a laid-out Cayley graph: a plaza position for
 * every element and a typed street for every (element, generator) edge. This is where a group
 * BECOMES a place, still with zero geometry — positions are abstract [x,y] in group space; the
 * assembler (math-structure.js) is what scales them into a walkable city.
 *
 * Layout = COSET RINGS. Pick the first generator as the "rotation" p; its cyclic subgroup ⟨p⟩ is
 * one ring, and the right cosets of ⟨p⟩ are concentric rings around it. This one rule renders
 * every target group the way a mathematician draws it:
 *   ℤ/n  → one ring of n plazas (the modular clock)
 *   Dₙ   → two rings: rotations inside, reflections outside (s is the spoke between them)
 *   Q₈   → two rings of 4 (⟨i⟩ and the j-coset)
 *   S₃   → two rings of 3 (the 3-cycles and the transposition coset)
 * Angle within a ring is the power of p, so walking p is always "next plaza around this ring" and
 * walking the flip generator is always "jump to the plaza on the other ring" — the streets teach
 * the group before a word is read.
 */

// Each generator gets a visually distinct street TYPE so "why are the streets different?" has a
// felt answer (plan's dead-end-clue failure mode). Cycled by generator index.
const STREET_STYLES = [
  { width: 2.2, tint: '#c9b85a', treeLine: true, twoLane: true },   // gen 0 (rotation) — the grand boulevard
  { width: 1.4, tint: '#a86f4b', treeLine: false, twoLane: false },  // gen 1 (flip) — the narrow spoke
  { width: 1.1, tint: '#5f8f7a', treeLine: false, twoLane: false },
  { width: 1.1, tint: '#8a6fb0', treeLine: false, twoLane: false },
];

/**
 * planCayleyGraph(group, opts) → { vertices, edges, generators, group, radius }
 *
 * vertices: { index, label, ring, angle, pos:[x,y], identity:boolean }
 * edges:    { from, to, gen, style, ring, undirected } — one per (element, generator); an
 *           involution generator (g² = e) is flagged undirected so the assembler draws the
 *           to↔from street once instead of twice.
 */
export function planCayleyGraph(group, { ringGap = 6, innerRadius = 6, ringTwist = true } = {}) {
  const { order, generators } = group;
  // The ring axis is the HIGHEST-ORDER generator — its cyclic subgroup is the biggest ring, which
  // is the picture a mathematician draws (Dₙ around r, S₃ around the 3-cycle, not the transposition).
  const genOrder = (name) => { let o = 1, c = group.step(0, name); while (c !== 0) { c = group.step(c, name); o++; } return o; };
  const primary = generators.map((g) => ({ name: g.name, o: genOrder(g.name) })).sort((a, b) => b.o - a.o)[0].name;

  // ⟨p⟩ orbit from the identity: e, p, p², … — the index list defines the angular slots.
  const orbit = [0];
  let cur = 0;
  for (;;) {
    const nxt = group.step(cur, primary);
    if (nxt === 0) break;
    orbit.push(nxt);
    cur = nxt;
    if (orbit.length > order) break;                       // guard: p must have finite order (it does)
  }
  const ord = orbit.length;                                // |⟨p⟩| = plazas per ring
  const slotOf = new Map(orbit.map((el, t) => [el, t]));   // element → angular slot within its coset

  // Partition into right cosets of ⟨p⟩ in element-index order (identity's coset is ring 0).
  const ringOf = new Array(order).fill(-1);
  const slot = new Array(order).fill(0);
  let ring = 0;
  for (let e = 0; e < order; e++) {
    if (ringOf[e] !== -1) continue;
    for (let t = 0; t < ord; t++) {
      const member = group.mul(e, orbit[t]);               // e · pᵗ  → the right coset e⟨p⟩
      if (ringOf[member] === -1) { ringOf[member] = ring; slot[member] = t; }
    }
    ring++;
  }
  const rings = ring;

  const vertices = group.elements.map((el) => {
    const rg = ringOf[el.index];
    const radius = innerRadius + rg * ringGap;
    // twist odd rings by half a slot so an outer plaza sits BETWEEN its inner neighbours (reads
    // as a real town, not stacked spokes) — purely visual, deterministic.
    const twist = ringTwist && rg % 2 ? Math.PI / ord : 0;
    const angle = (2 * Math.PI * slot[el.index]) / ord + twist;
    return {
      index: el.index,
      label: el.label,
      ring: rg,
      angle,
      pos: [radius * Math.cos(angle), radius * Math.sin(angle)],
      identity: el.index === group.identity,
    };
  });

  // Edges: one per (element, generator). Detect involution generators (g applied twice = identity
  // for every element) so the mutual street is drawn once.
  const genInfo = generators.map((g, gi) => {
    let involution = true;
    for (let e = 0; e < order && involution; e++) if (group.step(group.step(e, g.name), g.name) !== e) involution = false;
    return { ...g, gi, involution, style: STREET_STYLES[gi % STREET_STYLES.length] };
  });

  const edges = [];
  const seen = new Set();
  for (const g of genInfo) {
    for (let e = 0; e < order; e++) {
      const to = group.step(e, g.name);
      if (to === e) continue;                              // a fixed point draws no street
      if (g.involution) {
        const key = `${g.name}:${Math.min(e, to)}-${Math.max(e, to)}`;
        if (seen.has(key)) continue;
        seen.add(key);
      }
      edges.push({
        from: e, to, gen: g.name, style: g.style,
        ring: ringOf[e] === ringOf[to] ? ringOf[e] : -1,   // -1 = a spoke crossing rings
        undirected: g.involution,
      });
    }
  }

  return {
    vertices, edges,
    generators: genInfo.map((g) => ({ name: g.name, symbol: g.symbol, involution: g.involution, style: g.style })),
    group: { family: group.family, title: group.title, order, relations: group.relations },
    rings,
    radius: innerRadius + (rings - 1) * ringGap,
  };
}

/**
 * spellWalk(plan, group, word) → { targets, elements, arrivedElement, closed }
 *
 * Replays a generator word from the identity plaza, returning the sequence of plaza world-positions
 * to visit (the waypoint route) and whether the word closes the loop (ends back at identity). This
 * is the bridge to compileWorldWaypoints in the Phase-1 spike: a relation like 's r s r' produces a
 * route that provably returns to its start plaza iff the relation holds in the group.
 */
export function spellWalk(plan, group, word) {
  const posByElement = new Map(plan.vertices.map((v) => [v.index, v.pos]));
  const targets = [];
  const elements = [];
  let cur = group.identity;
  for (const gen of word) {
    cur = group.step(cur, gen);
    elements.push(cur);
    targets.push(posByElement.get(cur));
  }
  return { targets, elements, arrivedElement: cur, closed: cur === group.identity };
}
