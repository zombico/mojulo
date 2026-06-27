import { describe, expect, it } from 'vitest';

import { planWorkbench } from './workbench.js';
import { lowerAssembly } from './polygonizer/workbench-assembly.js';

const lathe = (extra = {}) => ({ axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2 }, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }], ...extra });

describe('planWorkbench — per-part readout', () => {
  it('reports each monomer with its size + base/top z', () => {
    const lowered = lowerAssembly({ parts: [
      { kind: 'lathe', height: 2, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }] },
      { kind: 'lathe', height: 3, profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }] },
    ] });
    const { stats } = planWorkbench({ kind: 'workbench', ...lowered });
    expect(stats.monomers).toBe(2);
    expect(stats.parts).toHaveLength(2);
    expect(stats.parts[0].base).toBe(0);
    expect(stats.parts[0].top).toBeCloseTo(2, 1);
    expect(stats.parts[1].base).toBeCloseTo(2, 1);
    expect(stats.parts[1].top).toBeCloseTo(5, 1);
  });

  it('a replicated assembly (radial stool: 4 legs + seat) bakes end-to-end', () => {
    const lowered = lowerAssembly({ parts: [
      { id: 'legs', kind: 'lathe', height: 40, profile: [{ t: 0, radius: 1.5 }, { t: 1, radius: 1.5 }], radial: { count: 4, radius: 15 } },
      { kind: 'lathe', height: 3, profile: [{ t: 0, radius: 18 }, { t: 1, radius: 18 }], on: 'legs' },
    ] });
    const { stats } = planWorkbench({ kind: 'workbench', ...lowered });
    expect(stats.monomers).toBe(5);          // 4 legs + seat lowered to flat monomers
    expect(stats.faces).toBeGreaterThan(0);  // real geometry baked
    expect(stats.parts).toHaveLength(5);
    expect(stats.warnings).toBeUndefined();  // seated on the grid
    expect(stats.size.h).toBeCloseTo(43, 0); // 40 legs + 3 seat
  });

  it('seated-on-the-grid object emits no warning', () => {
    const { stats } = planWorkbench({ kind: 'workbench', lathes: [lathe()] });
    expect(stats.warnings).toBeUndefined();
  });

  it('warns when the object floats above the measured grid', () => {
    const { stats } = planWorkbench({ kind: 'workbench', lathes: [lathe({ axisFrom: { x: 0, y: 0, z: 5 }, axisTo: { x: 0, y: 0, z: 7 } })] });
    expect(stats.warnings).toBeDefined();
    expect(stats.warnings[0]).toMatch(/floats/);
  });
});
