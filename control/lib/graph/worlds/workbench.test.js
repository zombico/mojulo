import { describe, expect, it } from 'vitest';

import { lowerObjectFaces, planWorkbench } from './workbench.js';
import { lowerAssembly } from '../polygonizer/workbench-assembly.js';

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

  it('counts and reads out drapes like any other monomer', () => {
    const drape = { anchor: [[-4, 0, 10], [4, 0, 10]], hang: 8 };
    const { stats } = planWorkbench({ kind: 'workbench', lathes: [lathe()], drapes: [drape] });
    expect(stats.monomers).toBe(2);
    expect(stats.drapes).toBe(1);
    const drapePart = stats.parts.find((p) => p.kind === 'drape');
    expect(drapePart).toBeDefined();
    expect(drapePart.size.w).toBeGreaterThan(0);
    expect(drapePart.open).toBeUndefined(); // a sheet is open by intent — no closure warning
  });

  it('passes caps:false through to lathe face lowering', () => {
    const capped = lowerObjectFaces({ kind: 'workbench', lathes: [lathe({ crossSections: 4, samples: 8 })] });
    const open = lowerObjectFaces({ kind: 'workbench', lathes: [lathe({ crossSections: 4, samples: 8, caps: false })] });
    expect(open.length).toBeLessThan(capped.length);
    expect(() => planWorkbench({ kind: 'workbench', lathes: [lathe({ caps: false })] })).not.toThrow();
  });

  it('rejects a drape material typo loudly instead of silently falling back', () => {
    const drape = { anchor: [[-4, 0, 10], [4, 0, 10]], material: 'golden' };
    expect(() => planWorkbench({ kind: 'workbench', drapes: [drape] })).toThrow(/drapes\[0\]\.material/);
  });
});
