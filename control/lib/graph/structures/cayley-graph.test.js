import { describe, expect, it } from 'vitest';

import { buildGroup } from './group-presentation.js';
import { planCayleyGraph, spellWalk } from './cayley-graph.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('planCayleyGraph — determinism & layout invariants', () => {
  it('is deterministic — same group yields byte-identical plan', () => {
    const g = buildGroup({ family: 'dihedral', n: 4 });
    expect(JSON.stringify(planCayleyGraph(g))).toBe(JSON.stringify(planCayleyGraph(g)));
  });

  it('renders each family with the canonical ring count (the mathematician\'s picture)', () => {
    const rings = (spec) => planCayleyGraph(buildGroup(spec)).rings;
    expect(rings({ family: 'cyclic', n: 6 })).toBe(1);          // one modular clock
    expect(rings({ family: 'dihedral', n: 4 })).toBe(2);        // rotations inside, reflections outside
    expect(rings({ family: 'quaternion' })).toBe(2);            // ⟨i⟩ + the j-coset
    expect(rings({ family: 'symmetric', n: 3 })).toBe(2);       // two triangles (ring axis = the 3-cycle)
  });

  it('every plaza sits at a distinct position', () => {
    const p = planCayleyGraph(buildGroup({ family: 'dihedral', n: 4 }));
    for (let i = 0; i < p.vertices.length; i++) {
      for (let j = i + 1; j < p.vertices.length; j++) {
        expect(dist(p.vertices[i].pos, p.vertices[j].pos)).toBeGreaterThan(0.5);
      }
    }
  });

  it('one street per (element, generator), with involution generators drawn once', () => {
    // D₄: r (order 4) → 8 directed rotation streets; s (involution) → 4 shared spokes = 12.
    const p = planCayleyGraph(buildGroup({ family: 'dihedral', n: 4 }));
    expect(p.edges.length).toBe(12);
    expect(p.generators.find((x) => x.name === 's').involution).toBe(true);
    expect(p.generators.find((x) => x.name === 'r').involution).toBe(false);
  });
});

describe('spellWalk — words that close are relations', () => {
  it('D₄: the relation srsr returns to the start plaza; a non-relation does not', () => {
    const g = buildGroup({ family: 'dihedral', n: 4 });
    const p = planCayleyGraph(g);
    const relation = spellWalk(p, g, ['s', 'r', 's', 'r']);
    expect(relation.closed).toBe(true);
    expect(relation.arrivedElement).toBe(g.identity);
    expect(relation.targets).toHaveLength(4);

    const open = spellWalk(p, g, ['r', 's']);                  // rs ≠ e
    expect(open.closed).toBe(false);
  });

  it('the waypoint targets are the actual plaza positions along the path', () => {
    const g = buildGroup({ family: 'cyclic', n: 6 });
    const p = planCayleyGraph(g);
    const walk = spellWalk(p, g, ['a', 'a', 'a', 'a', 'a', 'a']);   // a⁶ = e
    expect(walk.closed).toBe(true);
    const posByIndex = new Map(p.vertices.map((v) => [v.index, v.pos]));
    walk.elements.forEach((el, k) => expect(walk.targets[k]).toEqual(posByIndex.get(el)));
  });
});
