import { describe, expect, it } from 'vitest';

import { compareUsdGate } from './usd-gate.js';

describe('compareUsdGate', () => {
  const exported = { triangles: 230, meters_per_unit: 0.01, size_units: [60.2, 60.2, 104], nodes: 3, cameras: 1 };

  it('passes when Blender built the same triangles, box, colours, and cameras', () => {
    const r = compareUsdGate({ exported, blender: { triangles: 230, size: [0.602, 0.602, 1.04], vertex_colour_meshes: 1, cameras: 1 } });
    expect(r.ok).toBe(true);
    expect(r.checks.size_m.expected).toEqual([0.602, 0.602, 1.04]);
  });

  it('fails loudly on a unit slip or a triangle mismatch, naming both numbers', () => {
    const slip = compareUsdGate({ exported, blender: { triangles: 230, size: [60.2, 60.2, 104], vertex_colour_meshes: 1, cameras: 1 } });
    expect(slip.ok).toBe(false);
    expect(slip.checks.size_m.ok).toBe(false);
    const tri = compareUsdGate({ exported, blender: { triangles: 229, size: [0.602, 0.602, 1.04], vertex_colour_meshes: 1, cameras: 1 } });
    expect(tri.checks.triangles).toEqual({ expected: 230, got: 229, ok: false });
  });

  it('checks the humanoid bones when the export declared them', () => {
    const r = compareUsdGate({ exported: { ...exported, humanoid_figures: ['figure'] }, blender: { triangles: 230, size: [0.602, 0.602, 1.04], vertex_colour_meshes: 1, cameras: 1, bones: ['figure:hips', 'figure:spine'] } });
    expect(r.ok).toBe(false);
    expect(r.checks.humanoid_bones.missing).toContain('head');
  });

  it('with no reader report every check is null and the gate is not ok', () => {
    const r = compareUsdGate({ exported });
    expect(r.ok).toBe(false);
    expect(r.checks.triangles.ok).toBeNull();
  });
});
