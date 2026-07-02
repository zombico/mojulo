import { describe, expect, it } from 'vitest';

import { planDnaScene, assembleDnaScene } from './dna-view.js';
import { classifyBucket, sketchRenderMode } from '../../sketch/sketch-manifest.js';

const finite3 = (c) => Array.isArray(c) && c.length === 3 && c.every((v) => Number.isFinite(v));

describe('planDnaScene', () => {
  it('builds a lit solid helix from a base sequence', () => {
    const plan = planDnaScene({ kind: 'dna-view', sequence: 'GATTACA' });
    expect(plan.basePairs).toBe(7);
    expect(plan.faces.length).toBeGreaterThan(0);
    // every face is a 3- or 4-corner polygon of finite points with a hex fill.
    for (const f of plan.faces) {
      expect(f.corners.length === 3 || f.corners.length === 4).toBe(true);
      expect(f.corners.every(finite3)).toBe(true);
      expect(f.fill).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    // one pick per base pair + the two backbone strands.
    const bp = plan.picks.filter((p) => p.kind === 'base-pair');
    const strands = plan.picks.filter((p) => p.kind === 'strand');
    expect(bp.length).toBe(7);
    expect(strands.length).toBe(2);
    // base pairs carry the Watson–Crick complement (G·C at index 0).
    expect(bp[0].label).toContain('G·C');
  });

  it('counts base pairs by `basePairs` when no sequence is given', () => {
    const plan = planDnaScene({ kind: 'dna-view', basePairs: 16 });
    expect(plan.basePairs).toBe(16);
    expect(plan.picks.filter((p) => p.kind === 'base-pair').length).toBe(16);
  });

  it('encodes handedness as the sign of the taiji twist', () => {
    expect(planDnaScene({ basePairs: 21, handedness: 'right' }).turns).toBeGreaterThan(0);
    expect(planDnaScene({ basePairs: 21, handedness: 'left' }).turns).toBeLessThan(0);
  });

  it('clamps a degenerate base-pair count up to the minimum', () => {
    expect(planDnaScene({ basePairs: 1 }).basePairs).toBe(2);
  });
});

describe('assembleDnaScene', () => {
  it('returns an emitThreeWorld payload with framing cameras', () => {
    const payload = assembleDnaScene({ kind: 'dna-view', sequence: 'ACGTACGT' }, { title: 'test helix' });
    expect(payload.faces.length).toBeGreaterThan(0);
    expect(payload.cameras.length).toBe(3);
    expect(payload.cameras.map((c) => c.name)).toEqual(['angle', 'broadside', 'end-on']);
    expect(payload.title).toBe('test helix');
    expect(payload.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('dna-view classification', () => {
  it('is a world-render kind (walkable/orbital gallery, not a flat sketch)', () => {
    const manifest = { kind: 'dna-view', sequence: 'GATTACA' };
    expect(classifyBucket(manifest)).toBe('world');
    expect(sketchRenderMode(manifest)).toBe('world');
  });
});
