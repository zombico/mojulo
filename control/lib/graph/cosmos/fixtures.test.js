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

  // Godot (scene/godot-marks.js, kernel 0.20.0): the crawler's melee travels (kernel/combat.gd), its set pieces the
  // web's; the collectathon's glide is the controllable runtime's, which does not travel yet; everything else in them
  // does, some of it simpler (a moving platform stands at rest, the look's sky stays the web's)
  const GODOT_LOST = { 'dungeon-crawler': [], collectathon: ['power.rules=glide'] };
  it('hold the anchors makeable, and name what a Godot export loses', () => {
    const anchors = FIXTURES.filter((f) => f.anchor);
    expect(anchors.map((f) => f.id)).toEqual(['dungeon-crawler', 'collectathon']);
    for (const f of anchors) {
      const r = dryRun(f.cube);
      expect({ id: f.id, verdict: r.verdict, blocked: r.blocked, gaps: r.gaps }).toEqual({ id: f.id, verdict: 'makeable', blocked: [], gaps: [] });
      expect(r.godot.lost.map((l) => `${l.facet}.${l.setting}=${l.value}`), f.id).toEqual(GODOT_LOST[f.id]);
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
