import { describe, it, expect } from 'vitest';
import { validateCube, facetDepth, dryRun } from './cosmos.js';

// today's dungeon crawler, said as a cube: every value is one the tree builds
const CRAWLER = {
  reality: { era: 'gen-6', kit: 'gothic-stone', medium: '3d' },
  space: { camera: 'third-person', topology: 'linear', levelForm: 'rooms', links: 'door' },
  power: { kit: 'dungeon-crawler', mechanics: ['reach-exit', 'hp-pool'], combat: ['melee'] },
  soul: { hero: 'hero', cast: 'heroic' },
  mind: { motivation: 'ambient', aggressiveness: 'passive' },
  time: { progression: 'linear' },
};

describe('validateCube', () => {
  it('accepts a cube of known values', () => {
    expect(validateCube(CRAWLER)).toBe(CRAWLER);
  });
  it('names the known facets, settings and values when one is unknown', () => {
    expect(() => validateCube({ lore: {} })).toThrow(/unknown facet 'lore' \(known: reality, space/);
    expect(() => validateCube({ space: { gravity: 'low' } })).toThrow(/space has no setting 'gravity' \(known: camera/);
    expect(() => validateCube({ space: { camera: 'drone' } })).toThrow(/no value 'drone' \(known: third-person/);
  });
  it('takes a list only where a setting is multi', () => {
    expect(() => validateCube({ space: { camera: ['side'] } })).toThrow(/takes one value/);
    expect(() => validateCube({ power: { combat: ['melee', 'ranged'] } })).not.toThrow();
  });
});

describe('facetDepth', () => {
  it('is found from what the facet holds', () => {
    expect(facetDepth(undefined)).toBe(0);
    expect(facetDepth({ extends: 'gen-6' })).toBe(0);
    expect(facetDepth({ extends: 'gen-6', look: 'gothic-night' })).toBe(1);
    expect(facetDepth({ look: 'gothic-night', samples: [{ ref: 'a' }, { ref: 'b', approved: true }] })).toBe(2);
    expect(facetDepth({ samples: [{ ref: 'a', approved: true }] })).toBe(3);
  });
});

describe('dryRun', () => {
  it('finds the dungeon crawler makeable, facet by facet', () => {
    const r = dryRun(CRAWLER);
    expect(r.verdict).toBe('makeable');
    expect(r.blocked).toEqual([]);
    expect(r.gaps).toEqual([]);
    expect(r.facets.power.rows.find((x) => x.value === 'dungeon-crawler').lowers).toBe('lib/graph/game/kits.js#KITS');
    expect(r.facets.reality.depth).toBe(1);
  });
  it('names the facet and setting that block', () => {
    const r = dryRun({ ...CRAWLER, time: { ...CRAWLER.time, passage: 'eras' } });
    expect(r.verdict).toBe('blocked');
    expect(r.blocked).toEqual([{ facet: 'time', setting: 'passage', value: 'eras', status: 'absent', note: expect.any(String) }]);
  });
  it('counts a mind that fights, and its built-in commander, as built; an untried transport as a gap', () => {
    expect(dryRun({ ...CRAWLER, mind: { motivation: 'hunt', aggressiveness: 'bold' } }).verdict).toBe('makeable');
    expect(dryRun({ ...CRAWLER, mind: { motivation: 'hunt', aggressiveness: 'bold', commander: 'builtin' } }).verdict).toBe('makeable');
    const r = dryRun({ ...CRAWLER, mind: { motivation: 'hunt', aggressiveness: 'bold', commander: 'agent' } });
    expect(r.verdict).toBe('gaps');
    expect(r.gaps.map((g) => `${g.facet}.${g.setting}=${g.status}`)).toEqual(['mind.commander=partial']);
  });
  it('says what would not survive a Godot export', () => {
    // win-when travels since the Godot kernel runs the bus, defeat-all with the fight whose hits it counts (kernel
    // 0.17.0), the systems with their keys and a cue's beams and blasts (0.18.0); a glide stays on the web
    expect(dryRun({ ...CRAWLER, power: { ...CRAWLER.power, combat: ['melee', 'ranged'], systems: ['stamina'], beams: ['orb'], explosions: ['chain'], mechanics: ['reach-exit', 'win-when', 'defeat-all'] } }).godot).toEqual({ ok: true, lost: [] });
    const r = dryRun({ ...CRAWLER, power: { ...CRAWLER.power, rules: ['walk', 'glide'] } });
    expect(r.godot.ok).toBe(false);
    expect(r.godot.lost).toEqual([{ facet: 'power', setting: 'rules', value: 'glide' }]);
  });
  it('checks only what is set: an empty cube is makeable at depth 0', () => {
    const r = dryRun({});
    expect(r.verdict).toBe('makeable');
    expect(Object.values(r.facets).every((f) => f.depth === 0 && f.rows.length === 0)).toBe(true);
  });
  it('is deterministic', () => {
    expect(JSON.stringify(dryRun(CRAWLER))).toBe(JSON.stringify(dryRun(CRAWLER)));
  });
});
