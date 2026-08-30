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

describe('planWorkbench — shell monomers', () => {
  const dome = (extra = {}) => ({ solid: 'icosahedron', radius: 5, center: { x: 0, y: 0, z: 5 }, ...extra });

  it('a shell alone is a valid workbench and is counted in the stats', () => {
    const { stats } = planWorkbench({ kind: 'workbench', shells: [dome()] });
    expect(stats.monomers).toBe(1);
    expect(stats.shells).toBe(1);
    expect(stats.faces).toBe(20);
    expect(stats.parts[0].kind).toBe('shell');
  });

  it('measures the shell at literal scale — `radius` is the CIRCUMradius, not half the bbox', () => {
    // An icosahedron's vertices reach the circumsphere but its faces do not: the widest extent is
    // 2·(phi/sqrt(1+phi^2))·r = 1.701·r, not 2·r. So `center.z = radius` does NOT seat one on the
    // grid, and the existing float lint says so — which is exactly the advisory it is there for.
    const { stats } = planWorkbench({ kind: 'workbench', shells: [dome()] });
    expect(stats.size.w).toBeCloseTo(8.5, 1);
    expect(stats.size.h).toBeCloseTo(8.5, 1);
    expect(stats.parts[0].base).toBe(0.7);      // 5 - 4.2533, at the readout's 1-decimal rounding
    expect(stats.warnings.some((w) => /floats/.test(w))).toBe(true);
  });

  it('a sphere-like shell seated by its own bbox draws no grid warning', () => {
    const { stats } = planWorkbench({ kind: 'workbench', shells: [dome({ center: { x: 0, y: 0, z: 5 * 0.85065 } })] });
    expect(stats.parts[0].base).toBeCloseTo(0, 1);
    expect(stats.warnings).toBeUndefined();
  });

  it('composes with the other monomer kinds in one object', () => {
    const { stats } = planWorkbench({ kind: 'workbench', lathes: [lathe()], shells: [dome({ radius: 1, center: { x: 0, y: 0, z: 3 } })] });
    expect(stats.monomers).toBe(2);
    expect(stats.parts.map((p) => p.kind)).toEqual(['lathe', 'shell']);
  });

  it('an `open` cutaway is intentional, so it is not flagged as a dropped cap', () => {
    const { stats } = planWorkbench({ kind: 'workbench', shells: [dome({ open: { ring: 'bottom', band: 0.4 } })] });
    expect(stats.faces).toBeLessThan(20);
    expect((stats.warnings || []).some((w) => /open shell/.test(w))).toBe(false);
  });

  it('rejects a bad shell spec at mint with a teaching error', () => {
    expect(() => planWorkbench({ kind: 'workbench', shells: [{ solid: 'soccerball', radius: 1 }] })).toThrow(/shells\[0\]\.solid/);
    expect(() => planWorkbench({ kind: 'workbench', shells: [{ solid: 'cube' }] })).toThrow(/shells\[0\]\.radius/);
  });

  it('rejects a shell material typo loudly instead of silently falling back', () => {
    expect(() => planWorkbench({ kind: 'workbench', shells: [dome({ material: 'golden' })] })).toThrow(/shells\[0\]\.material/);
  });

  it('faceIds are unique across several shells in one manifest', () => {
    const faces = lowerObjectFaces({ shells: [dome({ solid: 'cube' }), dome({ solid: 'cube', center: { x: 20, y: 0, z: 5 } })] }, undefined);
    expect(faces).toHaveLength(12);
    expect(new Set(faces.map((f) => f.faceId)).size).toBe(12);
  });
});

describe('planWorkbench — the shells vocab-card worked example', () => {
  // Kept honest on purpose: solid-vocab/workbench.md ships this recipe, so it must mint.
  const CARD_EXAMPLE = {
    kind: 'workbench',
    shells: [{
      solid: 'truncated_icosahedron',
      radius: 12,
      center: { x: 0, y: 0, z: 12 },
      tint: '#e8e6e0',
      material: 'plaster',
      ops: [
        { op: 'inset', select: { sides: 6 }, ratio: 0.2 },
        { op: 'extrude', select: { group: 'inset' }, by: 0.8, material: 'steel' },
        { op: 'recolor', select: { sides: 5, every: 3 }, tint: '#39c2d7', material: 'glass' },
        { op: 'port', select: { group: 'panel', near: [0, 0, 1], count: 1 }, radius: 1.2, depth: 1.6, material: 'gunmetal' },
      ],
    }],
    units: 'cm',
  };

  it('mints without throwing', () => {
    expect(() => planWorkbench(CARD_EXAMPLE)).not.toThrow();
  });

  it('produces the object the card describes', () => {
    const faces = lowerObjectFaces(CARD_EXAMPLE, undefined);
    const of = (g) => faces.filter((f) => f.group === g).length;
    expect(of('panel')).toBe(20);            // one raised panel per hexagon
    expect(of('rim')).toBe(20 * 6);
    expect(of('wall')).toBe(20 * 6);
    expect(faces.filter((f) => f.tint === '#39c2d7')).toHaveLength(4);
    expect(of('port')).toBeGreaterThan(0);
  });
});
