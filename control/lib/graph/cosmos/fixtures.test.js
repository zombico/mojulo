// The fixtures are game types said as cubes. The anchors are games the tree makes today, so each must dry-run
// makeable: a failure here means the registry or a facet file is wrong, not the builder.
import { describe, it, expect } from 'vitest';
import { FIXTURES, fixture } from './fixtures.js';
import { validateCube, dryRun, facetDepth } from './cosmos.js';

describe('cosmos fixtures', () => {
  it('are valid cubes with unique ids, each with a why', () => {
    expect(new Set(FIXTURES.map((f) => f.id)).size).toBe(FIXTURES.length);
    for (const f of FIXTURES) {
      expect(() => validateCube(f.cube), f.id).not.toThrow();
      expect(f.why, f.id).toBeTruthy();
    }
  });

  it('hold the anchors makeable and Godot-safe', () => {
    const anchors = FIXTURES.filter((f) => f.anchor);
    expect(anchors.map((f) => f.id)).toEqual(['dungeon-crawler', 'collectathon']);
    for (const f of anchors) {
      const r = dryRun(f.cube);
      expect({ id: f.id, verdict: r.verdict, blocked: r.blocked, gaps: r.gaps }).toEqual({ id: f.id, verdict: 'makeable', blocked: [], gaps: [] });
      expect(r.godot.ok, f.id).toBe(true);
    }
  });

  it('stay at depth 0–1: a fixture is a seed, not a sample', () => {
    for (const f of FIXTURES) for (const spec of Object.values(f.cube)) expect(facetDepth(spec), f.id).toBeLessThanOrEqual(1);
  });

  it('name the known ids when one is missing', () => {
    expect(fixture('jrpg').name).toBe('Party role-playing game');
    expect(() => fixture('mmo')).toThrow(/no fixture 'mmo' \(known: dungeon-crawler, collectathon/);
  });
});
