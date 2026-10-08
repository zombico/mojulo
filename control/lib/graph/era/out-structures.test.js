import { describe, it, expect } from 'vitest';
import { STRUCTURE_USE_IDS, STRUCTURE_LAWS, STRUCTURE_RAILS, STRUCTURE_KITS, STRUCTURE_RING_IDS, CRAFT_TOKENS, COVERINGS, eyeSpot, ringOf, structureStyle, readTown } from './out-structures.js';
import { outStructuresHtml } from './out-structures-html.js';
import { LAWS } from './laws.js';
import { SWATCHES } from './style/swatches.js';
import { ANCHOR_IDS } from './out-anchor-structure.js';
import { structurePaint, paintLaws, paintStop, SURFACE_GROUP_IDS } from './out-structures-paint.js';

// what every town answers to, whatever its anchor: uses, rings, the eye spot, the laws of scale and street, a kit's
// craft (era/out-structures.js), and the paint that colours its values (era/out-structures-paint.js)
describe('out-structures', () => {
  it('every kit has its craft and its anchor; every law names the sixth-gen or object law it carries', () => {
    for (const k of STRUCTURE_KITS) {
      expect(k in SWATCHES).toBe(true);
      expect(Object.keys(STRUCTURE_RAILS[k]).sort()).toEqual([...CRAFT_TOKENS, 'anchor'].sort());
      expect(ANCHOR_IDS).toContain(STRUCTURE_RAILS[k].anchor);
      expect(structureStyle(k, 3).anchor).toBe(STRUCTURE_RAILS[k].anchor);
    }
    for (const l of STRUCTURE_LAWS) if (l.era && !['scale', 'thirty-three'].includes(l.era)) expect(LAWS[l.era], l.id).toBeTruthy();
  });

  it('the eye spot grows with the ring, and the rings are bands off the walk', () => {
    const spots = STRUCTURE_RING_IDS.map(eyeSpot);
    expect(spots[0]).toBeLessThan(spots[1]);
    expect(spots[1]).toBeLessThan(spots[2]);
    expect([ringOf(3), ringOf(20), ringOf(60)]).toEqual(['near', 'mid', 'far']);
  });

  it('a town narrows only its craft; a building\'s style is its anchor\'s, its colour the paint\'s', () => {
    expect(readTown({ tokens: { chunk: [1.2, 1.3] } }, 'isekai-meadow').tokens.chunk).toEqual([1.2, 1.3]);
    expect(() => readTown({ tokens: { covering: 'thatch' } }, 'isekai-meadow')).toThrow(/not a craft token .* anchor's language/);
    expect(() => readTown({ swatches: {} }, 'isekai-meadow')).toThrow(/values only; colour is the paint's/);
    expect(() => readTown({ laws: {} }, 'isekai-meadow')).toThrow(/cannot loosen a law/);
    expect(() => readTown({ tokens: { chunk: 3 } }, 'isekai-meadow')).toThrow(/allows chunk 1.15–1.35/);
    expect(() => structureStyle('gothic-stone', 1)).toThrow(/indexed for the outdoor kits/);
  });

  it('every kit has its paint, and its paint keeps its anchor\'s value order', () => {
    for (const k of STRUCTURE_KITS) {
      const P = structurePaint(k);
      for (const g of SURFACE_GROUP_IDS) expect(P.ramps[g].length).toBeGreaterThanOrEqual(3);
      expect(paintLaws(P).filter((l) => !l.ok), k).toEqual([]);
      for (const c of Object.keys(COVERINGS)) if (P.ramps[`str:${c}`] === P.ramps['str:paint']) expect(paintStop(P, 'str:paint', 0.55)).not.toEqual(paintStop(P, `str:${c}`, COVERINGS[c].value));
      expect(paintStop(P, 'str:accent', 0.3)).toEqual(P.accent);
    }
    const [r, , b] = paintStop(structurePaint('alien-night'), 'str:lens', 0.5);
    expect(b).toBeGreaterThan(r + 60);
    expect(() => structurePaint('isekai-meadow', { swatches: { 'str:tile': 'neon' } })).toThrow(/no ramp 'neon'/);
    expect(() => structurePaint('isekai-meadow', { swatches: { 'str:glow': 'paint' } })).toThrow(/not a surface group/);
  });

  it('the sheet leads with the elements and the anchor\'s slice, speaks every use, draws the town and the gallery, and is the same page every time', () => {
    const h = outStructuresHtml();
    expect(h).toBe(outStructuresHtml());
    expect(h).toContain('<title>Outdoor Structures Index</title>');
    for (const t of ['The elements', 'The slice', 'The anchor structure: timber-hall', 'black and white, in pieces', 'The language, spoken on every use', 'One frontage, six households', 'The town, in miniature', 'Heartbeats', 'burgh', 'One anchor, one town', 'seeded-2']) expect(h).toContain(t);
    for (const k of STRUCTURE_KITS) expect(h).toContain(`<h3>${k}</h3>`);
    expect(h).not.toContain('NaN');
    expect(STRUCTURE_USE_IDS.length).toBeGreaterThan(0);
  });
});
