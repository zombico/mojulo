import { describe, it, expect } from 'vitest';
import { worldmapModel, MODEL } from './worldmap-model.js';
import { WORLDMAP_SAMPLE } from '../gameworld/worldmap-bed.js';

// THE WORLD MAP AS A MODEL: a zoned map as a greybox diorama on a plinth, from its recipe alone.
const { zoned: _z, ...glyphs } = WORLDMAP_SAMPLE.levels.overworld.glyphs;
const level = { seed: 5, grid: { tile: glyphs.tile, plan: glyphs.plan, segments: glyphs.segments } };

describe('the world map as a model', () => {
  it('lays the land, its plinth, paths, places, a post either side of each gate, a bookmark and a name a zone', () => {
    const M = worldmapModel(level, { title: 'Four' }), by = (g) => M.faces.filter((f) => f.group === `worldmap:${g}`);
    expect(by('land')).toHaveLength(36 * MODEL.k * MODEL.k);
    expect(by('plinth').length).toBeGreaterThan(0);
    expect(by('trail').length).toBeGreaterThan(0);
    // (the town's house and the keep's temple: a block each, five faces)
    expect(by('place')).toHaveLength(10);
    // (four gates, two posts each)
    expect(by('gate')).toHaveLength(4 * 2 * 5);
    expect(M.cameras.map((c) => c.name)).toEqual(['the whole map', 'the town', 'the fields', 'the woods', 'the keep']);
    expect(M.signs.map((s) => s.text)).toEqual(['the town', 'the fields', 'the woods', 'the keep']);
    // (the plinth's base under the lowest land)
    const lowLand = Math.min(...by('land').flatMap((f) => f.corners.map((c) => c[2]))), base = Math.min(...by('plinth').flatMap((f) => f.corners.map((c) => c[2])));
    expect(base).toBeCloseTo(lowLand - MODEL.plinth, 2);
    // (the same model every time)
    expect(JSON.stringify(worldmapModel(level, { title: 'Four' }))).toBe(JSON.stringify(M));
  });
});
