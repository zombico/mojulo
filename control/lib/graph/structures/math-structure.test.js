import { describe, expect, it } from 'vitest';

import { planMathStructure, assembleMathStructureScene, spellWalk, buildGroup, planCayleyGraph } from './math-structure.js';

describe('planMathStructure — geometry from a group', () => {
  it('is deterministic — same structure yields byte-identical geometry', () => {
    const m = { structure: { family: 'dihedral', n: 4 } };
    expect(JSON.stringify(planMathStructure(m))).toBe(JSON.stringify(planMathStructure(m)));
  });

  it('emits one plaza box per group element', () => {
    const built = planMathStructure({ structure: { family: 'dihedral', n: 4 } });
    const plazas = built.boxes.filter((b) => b.kind === 'plaza');
    expect(plazas).toHaveLength(8);                            // |D₄| = 8
    expect(built.group.title).toBe('D₄');
  });

  it('the home plaza (identity) is the tallest, gold block', () => {
    const built = planMathStructure({ structure: { family: 'quaternion' } });
    const plazas = built.boxes.filter((b) => b.kind === 'plaza');
    const tallest = plazas.reduce((a, b) => (b.z1 > a.z1 ? b : a));
    expect(tallest.tint).toBe('#c9b25c');
  });

  it('defaults to D₄ on an unknown family (mirrors the view builders)', () => {
    const built = planMathStructure({ structure: { family: 'wormhole' } });
    expect(built.group.title).toBe('D₄');
  });
});

describe('assembleMathStructureScene — payload + walkable sidecar', () => {
  it('returns a face payload with a walk spawn and a mathPlan sidecar', () => {
    const scene = assembleMathStructureScene({ structure: { family: 'dihedral', n: 4 } }, { title: 'test town' });
    expect(Array.isArray(scene.faces)).toBe(true);
    expect(scene.faces.length).toBeGreaterThan(0);
    expect(scene.walk.enabled).toBe(true);
    expect(scene.mathPlan.plazas).toHaveLength(8);
    expect(scene.mathPlan.group.title).toBe('D₄');
  });
});

describe('spellWalk over the assembled plan — a relation returns home', () => {
  it('D₄: walking srsr from the identity plaza returns to the identity plaza', () => {
    const g = buildGroup({ family: 'dihedral', n: 4 });
    const plan = planCayleyGraph(g);
    const walk = spellWalk(plan, g, ['s', 'r', 's', 'r']);
    expect(walk.closed).toBe(true);
    // the last waypoint equals the identity plaza position (return-to-start, in world coords)
    const home = plan.vertices.find((v) => v.identity).pos;
    expect(walk.targets[walk.targets.length - 1]).toEqual(home);
  });
});
