import { describe, expect, it } from 'vitest';

import { planRiverScene, assembleRiverScene, RIVER_SCENARIOS } from './river-view.js';
import { sketchRenderMode, classifyBucket } from '../sketch/sketch-manifest.js';

describe('planRiverScene — determinism & structure', () => {
  it('is deterministic — same recipe yields byte-identical output', () => {
    const a = planRiverScene({ kind: 'river-view', scenario: 'gorge', seed: 7 });
    const b = planRiverScene({ kind: 'river-view', scenario: 'gorge', seed: 7 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('a different seed shifts the valley (not byte-identical)', () => {
    const a = planRiverScene({ kind: 'river-view', seed: 1 });
    const b = planRiverScene({ kind: 'river-view', seed: 2 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('falls back to river on an unknown kind', () => {
    expect(planRiverScene({ kind: 'river-view', scenario: 'nope' }).stats.scenario).toBe('river');
  });

  it('emits terrain faces + one river surface carrying a winding centreline', () => {
    const plan = planRiverScene({ kind: 'river-view' });
    expect(plan.faces.length).toBeGreaterThan(1000);
    for (const f of plan.faces) expect(f.fill).toMatch(/^#[0-9a-f]{6}$/);
    expect(plan.surfaces.length).toBe(1);
    const sf = plan.surfaces[0];
    expect(sf.river).toBeTruthy();
    expect(sf.river.pts.length).toBeGreaterThan(8);
    expect(sf.river.bank).toBeGreaterThan(sf.river.half);   // fills past the waterline to the banks
  });

  it('the river flows DOWNHILL — the centreline level descends from source to mouth', () => {
    const pts = planRiverScene({ kind: 'river-view' }).surfaces[0].river.pts;
    expect(pts[0][2]).toBeGreaterThan(pts[pts.length - 1][2]);
  });
});

describe('river-view — the six kinds', () => {
  it('exposes creek / river / gorge / canal / lazy / lava', () => {
    expect(RIVER_SCENARIOS).toEqual(['creek', 'river', 'gorge', 'canal', 'lazy', 'lava']);
  });

  it('gorge carves deeper than a creek (bed sits further below the water)', () => {
    const depth = (s) => { const p = planRiverScene({ kind: 'river-view', scenario: s }); const zs = p.faces.flatMap((f) => f.corners.map((c) => c[2])); return Math.max(...zs) - Math.min(...zs); };
    expect(depth('gorge')).toBeGreaterThan(depth('creek'));
  });

  it('lava is self-emissive; water kinds are not', () => {
    expect(planRiverScene({ kind: 'river-view', scenario: 'lava' }).surfaces[0].emissive).toBeTruthy();
    expect(planRiverScene({ kind: 'river-view', scenario: 'river' }).surfaces[0].emissive).toBeUndefined();
  });

  it('lava carries no floating leaves; a river does', () => {
    expect(planRiverScene({ kind: 'river-view', scenario: 'lava' }).surfaces[0].floaters.length).toBe(0);
    expect(planRiverScene({ kind: 'river-view', scenario: 'river' }).surfaces[0].floaters.length).toBeGreaterThan(0);
  });
});

describe('river-view registration', () => {
  it('routes to the world renderer and the object concern bucket', () => {
    const m = { kind: 'river-view' };
    expect(sketchRenderMode(m)).toBe('world');
    expect(classifyBucket(m)).toBe('object');
  });

  it('assemble threads terrain faces + the river surface with a valley camera', () => {
    const scene = assembleRiverScene({ kind: 'river-view' }, {});
    expect(scene.faces.length).toBeGreaterThan(1000);
    expect(scene.surfaces.length).toBe(1);
    expect(scene.cameras[0].name).toBe('valley');
  });
});
