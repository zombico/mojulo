import { describe, expect, it } from 'vitest';

import { assembleFractalCityScene } from './fractal-city.js';
import {
  assembleCityTile, cityBase, cityStreamPayload, cityStreamRecipe, cityTileBytes, clearCityTileMemo,
  parseTileId, streamDropped, streamStandDown, tileCity, tileGrid, tileIdOf, unpackTile,
} from './city-tiles.js';
import { emitThreeWorld } from '../scene/scene-three.js';

// the spike's city family: region 30k × 18k, seed 7, frontage, depth 2 + log2 k
const city = (k) => cityStreamRecipe({
  kind: 'fractal-city', region: { x: 2, y: 2, w: 30 * k, d: 18 * k }, seed: 7, depth: 2 + Math.log2(k), elements: { frontage: true },
});

// face multiset difference between the whole-city assembly and the union of the tiles + base
function splitDiff(recipe, tile) {
  const counts = new Map();
  const whole = assembleFractalCityScene(recipe).faces;
  for (const f of whole) { const k = JSON.stringify(f); counts.set(k, (counts.get(k) || 0) + 1); }
  const union = [...cityBase(recipe, { tile }).faces];
  for (const id of tileCity(recipe, { tile }).tiles.keys()) union.push(...assembleCityTile(recipe, id, { tile }).faces);
  let extra = 0;
  for (const f of union) { const k = JSON.stringify(f); const c = counts.get(k); if (!c) extra++; else counts.set(k, c - 1); }
  let missing = 0;
  for (const v of counts.values()) missing += v;
  return { whole: whole.length, union: union.length, missing, extra };
}

describe('city-tiles — the exact split', () => {
  it('k=1: the tiles + base are the whole-city face multiset', () => {
    const d = splitDiff(city(1), 16);
    expect(d.whole).toBeGreaterThan(1000);
    expect(d).toMatchObject({ union: d.whole, missing: 0, extra: 0 });
  });

  it('k=4: exact at a tile size that cuts through blocks', () => {
    const recipe = city(4);
    expect(tileCity(recipe, { tile: 15 }).tiles.size).toBeGreaterThan(20);
    const d = splitDiff(recipe, 15);
    expect(d.whole).toBeGreaterThan(50000);
    expect(d).toMatchObject({ union: d.whole, missing: 0, extra: 0 });
  });

  it('a box lands whole in the tile of its footprint centre', () => {
    const recipe = city(2);
    const tc = tileCity(recipe, { tile: 16 });
    let n = 0;
    for (const [id, part] of tc.tiles) {
      for (const b of part.boxes) { expect(tileIdOf(tc.grid, b.x + b.w / 2, b.y + b.d / 2)).toBe(id); n++; }
    }
    expect(n).toBe(tc.stats.boxes);
  });

  it('the massing horizon is the same city pruned (fewer faces per tile, same tiles covered)', () => {
    const recipe = city(2);
    const full = tileCity(recipe, { tile: 16 });
    const mass = tileCity(recipe, { tile: 16, lod: 'massing' });
    expect(mass.stats.boxes).toBeLessThan(full.stats.boxes);
    for (const id of mass.tiles.keys()) expect(full.tiles.has(id)).toBe(true);
  });
});

describe('city-tiles — grid + ids', () => {
  it('clamps points into the grid and parses only on-grid ids', () => {
    const g = tileGrid({ x: 2, y: 2, w: 60, d: 36 }, 16);
    expect(g).toMatchObject({ cols: 4, rows: 3 });
    expect(tileIdOf(g, -50, -50)).toBe('0,0');
    expect(tileIdOf(g, 999, 999)).toBe('3,2');
    expect(parseTileId(g, '3,2')).toBe('3,2');
    expect(parseTileId(g, '4,0')).toBeNull();
    expect(parseTileId(g, '1;2')).toBeNull();
    expect(parseTileId(g, null)).toBeNull();
  });
});

describe('city-tiles — packing', () => {
  it('is deterministic across a cold memo', () => {
    const recipe = city(2);
    const id = [...tileCity(recipe).tiles.keys()][0];
    const a = cityTileBytes(recipe, id);
    clearCityTileMemo();
    const b = cityTileBytes(recipe, id);
    expect(Buffer.compare(a, b)).toBe(0);
  });

  it('round-trips: header, float parts, vertex counts that match the faces', () => {
    const recipe = city(2);
    const tc = tileCity(recipe);
    const id = [...tc.tiles.keys()].sort((x, y) => tc.tiles.get(y).boxes.length - tc.tiles.get(x).boxes.length)[0];
    const { header, parts } = unpackTile(cityTileBytes(recipe, id));
    expect(header).toMatchObject({ v: 1, t: id, lod: 'full' });
    expect(header.faces).toBe(assembleCityTile(recipe, id).faces.length);
    const mesh = parts.find((p) => !p.key);
    expect(mesh.pos.length % 9).toBe(0);
    expect(mesh.col.length).toBe(mesh.pos.length);
    for (const p of parts.filter((q) => q.key)) expect(p.uv.length / 2).toBe(p.pos.length / 3);
    for (const lod of ['massing', 'base']) expect(unpackTile(cityTileBytes(recipe, id, { lod })).header.lod).toBe(lod);
  });

  it('does not resend a texture the streamed page already inlines', () => {
    const recipe = city(2);
    const page = cityStreamPayload(recipe, { url: '/t' });
    const held = new Set(Object.keys(page.textures));
    expect(held.has('asphalt')).toBe(true);
    for (const id of tileCity(recipe).tiles.keys()) {
      const { header } = unpackTile(cityTileBytes(recipe, id, { lod: 'base' }));
      for (const k of Object.keys(header.textures)) expect(held.has(k)).toBe(false);
    }
  });
});

describe('city-tiles — stand-down', () => {
  it('plain cities stream; lit modes and foreign channels stand down with a reason', () => {
    expect(streamStandDown({ kind: 'fractal-city', seed: 3 })).toBeNull();
    expect(streamStandDown({ kind: 'transportation-hub' })).toMatch(/fractal-city only/);
    expect(streamStandDown({ kind: 'fractal-city', time: 'night' })).toMatch(/time: night/);
    expect(streamStandDown({ kind: 'fractal-city', scene: { time: 'day' } })).toMatch(/time: day/);
    expect(streamStandDown({ kind: 'fractal-city', groundShadows: true })).toMatch(/groundShadows/);
    expect(streamStandDown({ kind: 'fractal-city', scene: { groundShadows: { max: 4 } } })).toMatch(/groundShadows/);
    expect(streamStandDown({ kind: 'fractal-city', moonlight: true })).toMatch(/moonlight/);
    expect(streamStandDown({ kind: 'fractal-city', figures: { a: {} } })).toMatch(/figures/);
    expect(streamStandDown({ kind: 'fractal-city', signage: [] })).toBeNull();
    expect(streamStandDown({ kind: 'fractal-city' }, { download: true })).toMatch(/self-contained/);
  });

  it('records the dressing a streamed page leaves out', () => {
    expect(streamDropped({ walkers: true, traffic: { lanes: 2 }, fog: true, instancing: true })).toEqual(['walkers', 'traffic', 'fog', 'instancing']);
    expect(streamDropped({ seed: 1 })).toEqual([]);
  });
});

describe('city-tiles — the streamed page', () => {
  it('inlines base + per-tile massing groups and emits the stream block; absent stream ⇒ no block', () => {
    const recipe = city(2);
    const payload = cityStreamPayload(recipe, { url: '/api/sketches/sk_x/world/tile' });
    const tc = tileCity(recipe);
    expect(payload.stream.tiles).toHaveLength(tc.tiles.size);
    const groups = new Set(payload.faces.map((f) => f.group).filter(Boolean));
    expect([...groups].every((g) => g.startsWith('massing:'))).toBe(true);
    expect(groups.size).toBeGreaterThan(0);
    const html = emitThreeWorld(payload);
    expect(html).toContain('window.__mojStream');
    expect(html).toContain('"massing:');
    expect(html).toContain('/api/sketches/sk_x/world/tile');
    const { stream, ...plain } = payload;
    expect(stream).toBeTruthy();
    expect(emitThreeWorld(plain)).not.toContain('__mojStream');
  });
});
