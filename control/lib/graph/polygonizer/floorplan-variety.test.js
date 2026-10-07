process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach } from 'vitest';
import { closeDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { mintSketch } from '@/lib/mcp/tools/sketch-mint';
import { mintBuilding } from '@/lib/mcp/tools/building';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { furnishElements, mirrorLayout, transposeLayout } from './floorplan-glyphs.js';
import { structurizeFloorplan } from './floorplan-structure.js';

beforeEach(() => { closeDb(); });

const floor = (els) => els.filter((e) => !(e.surface && e.surface !== 'floor') && Array.isArray(e.anchor) && e.w != null);
// a layout's shape: what stands where, to a tenth of the room
const signature = (els) => floor(els).map((e) => `${e.type}@${e.anchor.map((x) => x.toFixed(1)).join(',')}:${e.facing || ''}`).sort().join('|');
const varied = (glyph, seed, w, h) => furnishElements(glyph, seed, { w, h, scale: 'share', varied: true });

describe("layout: 'varied' — the arrangers", () => {
  it('draws many layouts of one room across seeds, every piece inside the room', () => {
    for (const [glyph, w, h] of [['L', 16, 15], ['B', 13, 12], ['D', 12, 16], ['O', 11, 11]]) {
      const seen = new Set();
      for (let seed = 1; seed <= 40; seed += 1) {
        const els = varied(glyph, seed, w, h);
        seen.add(signature(els));
        for (const e of floor(els)) {
          expect(e.anchor[0] - e.w / 2, `${glyph}#${seed} ${e.type}`).toBeGreaterThanOrEqual(-1e-6);
          expect(e.anchor[0] + e.w / 2, `${glyph}#${seed} ${e.type}`).toBeLessThanOrEqual(1 + 1e-6);
          expect(e.anchor[1] - e.h / 2, `${glyph}#${seed} ${e.type}`).toBeGreaterThanOrEqual(-1e-6);
          expect(e.anchor[1] + e.h / 2, `${glyph}#${seed} ${e.type}`).toBeLessThanOrEqual(1 + 1e-6);
        }
      }
      expect(seen.size, glyph).toBeGreaterThanOrEqual(glyph === 'D' ? 2 : 4);
    }
  });

  it('reaches every variant: facing sofas, one armchair, a bed between two nightstands', () => {
    const living = Array.from({ length: 40 }, (_, i) => varied('L', i + 1, 16, 15));
    expect(living.some((els) => els.filter((e) => e.type === 'sofa').length === 2)).toBe(true);
    expect(living.some((els) => els.filter((e) => e.type === 'armchair').length === 1)).toBe(true);
    const pair = living.find((els) => els.filter((e) => e.type === 'sofa').length === 2);
    const sofas = pair.filter((e) => e.type === 'sofa');
    expect(new Set(sofas.map((e) => e.instance)).size).toBe(2);              // two groups, not one named twice
    expect(sofas[0].facing).not.toBe(sofas[1].facing);
    const beds = Array.from({ length: 40 }, (_, i) => varied('B', i + 1, 14, 12));
    expect(beds.some((els) => els.filter((e) => e.type === 'nightstand').length === 2)).toBe(true);
  });

  it('runs a deep dining table the long way', () => {
    const els = varied('D', 3, 12, 18);
    const table = els.find((e) => e.type === 'dining-table');
    expect(table.h * 18).toBeGreaterThan(table.w * 12);
  });

  it('mirror and transpose are their own inverses', () => {
    const els = furnishElements('B', 9, { w: 14, h: 13, scale: 'share' });
    const round = (x) => JSON.stringify(x, (_, v) => (typeof v === 'number' ? Number(v.toFixed(9)) : v));
    expect(round(mirrorLayout(mirrorLayout(els)))).toBe(round(els));
    expect(round(transposeLayout(transposeLayout(els)))).toBe(round(els));
    expect(round(mirrorLayout(els))).not.toBe(round(els));
  });

  it('draws nothing new without the knob', () => {
    expect(furnishElements('L', 5, { w: 16, h: 15, scale: 'share' })).toEqual(furnishElements('L', 5, { w: 16, h: 15, scale: 'share', varied: false }));
  });
});

describe("layout: 'varied' — a house", () => {
  const room = { width: 22, height: 20, rooms: [{ x: 1, y: 1, w: 20, h: 18, glyph: 'L' }], furnish: true, furnishScale: 'share', style: 'modern' };
  const furniture = (m) => structurizeFloorplan(m, m).faces.filter((f) => /^(asset|item):|furniture/.test(f.group || '') || f.asset).length;
  const groups = (m) => [...new Set(structurizeFloorplan(m, m).faces.map((f) => f.group).filter(Boolean))].sort().join('|');

  it('one room, re-seeded, rearranges; the same seed draws the same room', () => {
    const plans = [1, 2, 3, 4, 5, 6].map((seed) => groups({ ...room, seed, layout: 'varied' }));
    expect(new Set(plans).size).toBeGreaterThan(1);
    expect(groups({ ...room, seed: 4, layout: 'varied' })).toBe(plans[3]);
  }, 120_000);

  it('a house without the knob is the house it was', () => {
    const a = structurizeFloorplan({ ...room, seed: 4 }, { ...room, seed: 4 }).faces;
    const b = structurizeFloorplan({ ...room, seed: 4, layout: null }, { ...room, seed: 4, layout: null }).faces;
    expect(b).toEqual(a);
    expect(furniture({ ...room, seed: 4 })).toBeGreaterThan(0);
  }, 120_000);
});

describe('a new house at mint', () => {
  it('draws its own seed and is stamped varied and composed; what is given wins', () => {
    const a = SketchRepository.getByRef(mintSketch({ title: 'a', manifest: { kind: 'floorplan', title: 'a', width: 30, height: 24 } }).ref).manifest;
    const b = SketchRepository.getByRef(mintSketch({ title: 'b', manifest: { kind: 'floorplan', title: 'b', width: 30, height: 24 } }).ref).manifest;
    expect(Number.isInteger(a.seed) && a.seed > 0).toBe(true);
    expect(a.seed).not.toBe(b.seed);
    expect(a).toMatchObject({ style: 'auto', layout: 'varied', furnishing: 'composed' });
    // (an explicit plan: the grader may step a generated plan's defective seed forward)
    const c = SketchRepository.getByRef(mintSketch({ title: 'c', manifest: { kind: 'floorplan', title: 'c', seed: 7, width: 22, height: 20, rooms: [{ x: 1, y: 1, w: 20, h: 18, glyph: 'L' }], layout: null, furnishing: null } }).ref).manifest;
    expect(c.seed).toBe(7);
    expect(c.layout).toBeNull();
    expect(c.furnishing).toBeNull();
  });

  const HOUSE = { width: 30, height: 20, rooms: [{ x: 1, y: 1, w: 16, h: 18, glyph: 'L' }, { x: 17, y: 1, w: 12, h: 18, glyph: 'D' }], furnish: true, view: 'cutaway' };
  it('a named ref draws its seed from the ref, and the stored recipe renders the same twice', async () => {
    const r = mintBuilding({ title: 'v', ref: 'house_variety_a', manifest: HOUSE });
    const m = SketchRepository.getByRef(r.ref).manifest;
    expect(Number.isInteger(m.seed)).toBe(true);
    const one = (await resolveWorldScene({ manifest: m, title: null, ref: r.ref })).payload.faces;
    const two = (await resolveWorldScene({ manifest: SketchRepository.getByRef(r.ref).manifest, title: null, ref: r.ref })).payload.faces;
    expect(two.length).toBe(one.length);
    expect(JSON.stringify(two)).toBe(JSON.stringify(one));
    expect(one.some((f) => /^asset:composed-furniture/.test(f.group || ''))).toBe(true);   // composed reached the World
    closeDb();
    const again = mintBuilding({ title: 'v', ref: 'house_variety_a', manifest: HOUSE });
    expect(SketchRepository.getByRef(again.ref).manifest.seed).toBe(m.seed);
  }, 240_000);
});
