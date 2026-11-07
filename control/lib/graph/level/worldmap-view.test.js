import { describe, it, expect } from 'vitest';
import { worldmapView, worldmapHtml } from './worldmap-view.js';
import { WORLDMAP_SAMPLE } from '../gameworld/worldmap-bed.js';

// THE WORLD MAP IN MINIATURE: a zoned map drawn from its recipe alone, the world, a zone, a tile, each a view drilled into
// by its address; a zone's gates lead sideways to the zone across, as the player crosses them.
const { zoned: _z, ...glyphs } = WORLDMAP_SAMPLE.levels.overworld.glyphs;
const level = { seed: 5, grid: { tile: glyphs.tile, plan: glyphs.plan, segments: glyphs.segments } };

describe('the world map in miniature', () => {
  it('reads the world whole: its zones, their roles and gates, its tiles and the land under them', () => {
    const V = worldmapView(level, { title: 'Four' });
    expect(V.zones.map((Z) => [Z.id, Z.role, Z.holdsGoal])).toEqual([['A', 'arrival', false], ['B', 'passage', false], ['C', 'pocket', false], ['D', 'climax', true]]);
    expect(V.gates.map((g) => `${g.from}${g.side}${g.to}${g.join ? '*' : ''}`)).toEqual(['AeB', 'BsD', 'AsC*', 'CeD*']);
    expect(V.cells).toHaveLength(36);
    expect(V.land.z).toHaveLength(36 * V.land.k * V.land.k);
    // (the town's written house, its door toward the street)
    expect(V.cells.find((x) => x.r === 1 && x.c === 0)).toMatchObject({ kind: 'place', door: { side: 'e' } });
    expect(() => worldmapView({ grid: { rows: ['# #'] } })).toThrow(/planned map/);
  });

  it('draws a view a depth, each address a link down, a zone\'s gates links sideways', () => {
    const V = worldmapView(level), H = worldmapHtml(V, { play: { B: 'levels/b.html' } });
    for (const id of ['world', 'zone-A', 'zone-B', 'zone-C', 'zone-D', 'tile-0-0', 'tile-5-5']) expect(H).toContain(`id="${id}"`);
    // (B's gates: west to the town, south to the keep)
    const B = H.slice(H.indexOf('id="zone-B"'), H.indexOf('id="zone-C"'));
    expect(B).toContain('href="#zone-A"'); expect(B).toContain('href="#zone-D"'); expect(B).toContain('href="levels/b.html"');
    expect(B).toContain('href="#tile-0-3"');
    // (nothing runs: HTML and CSS alone, the same page every time)
    expect(H).not.toMatch(/<script/);
    expect(worldmapHtml(worldmapView(level), { play: { B: 'levels/b.html' } })).toBe(H);
  });
});
