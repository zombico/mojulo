process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect } from 'vitest';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintWorkbench } from './workbench.js';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';

// The shell monomer end to end through the MINT path. mintWorkbench destructures an explicit key
// list, so a monomer that is not named there is silently dropped before it ever reaches
// planWorkbench — these guard that seam, which is exactly where `shells` first went missing.

const DOME = {
  solid: 'geodesic',
  frequency: 2,
  radius: 10,
  center: { x: 0, y: 0, z: 8 },
  tint: '#c8ccd2',
  open: { ring: 'bottom', band: 0.35 },
};

describe('mintWorkbench — shells', () => {
  it('carries `shells` into the stored manifest', () => {
    const res = mintWorkbench({ title: 'geodesic dome', shells: [DOME] });
    const stored = SketchRepository.getByRef(res.ref);
    expect(stored.manifest.kind).toBe('workbench');
    expect(stored.manifest.shells).toHaveLength(1);
    expect(stored.manifest.shells[0].solid).toBe('geodesic');
  });

  it('a shell alone satisfies the at-least-one-monomer gate', () => {
    expect(() => mintWorkbench({ title: 'd20', shells: [{ solid: 'icosahedron', radius: 3 }] })).not.toThrow();
    expect(() => mintWorkbench({ title: 'empty' })).toThrow(/at least one monomer/);
  });

  it('the mint refusal names shells among the monomer arrays', () => {
    expect(() => mintWorkbench({ title: 'empty' })).toThrow(/`shells`/);
  });

  it('reports the shell in the stats readout', () => {
    const res = mintWorkbench({ title: 'geodesic dome', shells: [DOME] });
    expect(res.stats.shells).toBe(1);
    expect(res.stats.faces).toBeGreaterThan(0);
    expect(res.stats.faces).toBeLessThan(80);      // freq 2 = 80 faces, minus the cut base band
  });

  it('a bad shell spec is refused at mint, not at view time', () => {
    expect(() => mintWorkbench({ title: 'bad', shells: [{ solid: 'soccerball', radius: 1 }] })).toThrow(/shells\[0\]\.solid/);
    expect(() => mintWorkbench({ title: 'bad', shells: [{ solid: 'cube', radius: 1, ops: [{ op: 'bevel', select: {} }] }] })).toThrow(/shells\[0\]\.ops\[0\]\.op/);
  });

  it('the stored recipe re-renders through the world-scene path', async () => {
    const res = mintWorkbench({ title: 'faceted housing', shells: [{
      solid: 'truncated_icosahedron',
      radius: 10,
      center: { x: 0, y: 0, z: 9 },
      tint: '#e8e6e0',
      ops: [
        { op: 'inset', select: { sides: 6 }, ratio: 0.22 },
        { op: 'extrude', select: { group: 'inset' }, by: 0.6, material: 'steel' },
        { op: 'port', select: { group: 'panel', near: [0, 0, 1], count: 1 }, radius: 1, depth: 1.4 },
      ],
    }] });
    const stored = SketchRepository.getByRef(res.ref);
    const scene = await resolveWorldScene(stored);   // takes the sketch row, not the manifest
    expect(scene).toBeTruthy();
    expect(res.stats.faces).toBeGreaterThan(32);   // the ops added panels, rims, walls and a port
  });
});
