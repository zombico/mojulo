import { describe, it, expect } from 'vitest';
import { terrainMesh, terraced } from './terrain.js';
import { bakeShade } from './light.js';
import { SCENE_LIGHT } from './historic-city.js';

// a round rock 40 m high and 30 m across, sheer, standing out of a sea 3 m deep; land to the west terraced in 3 m steps
const rock = (x, y) => Math.hypot(x - 60, y - 50) < 15;
const hAt = (x, y) => (rock(x, y) ? 40 : x < 25 ? terraced(2 + (25 - x) * 0.6, 3) : -3);
const frame = { w: 100, d: 100 };
const mesh = () => terrainMesh({ hAt, frame, surfaceAt: (x, y, z) => ({ fill: z > 30 ? '#c8b896' : '#b8a888', surface: 'rubble' }), riserTint: () => '#a89878', water: { z: -0.4, fill: '#3f7f9a' } });

describe('historic terrain', () => {
  it('stands a sheer rock as cliff faces on its contour, upright, from the sea bed to its top', () => {
    const { boxes, stats } = mesh();
    const all = boxes.filter((b) => b.kind === 'cliff'), cliffs = all.filter((b) => b.x > 30);   // the low shore cliff where the terraces meet the sea is one too
    expect(stats.cliffs).toBe(all.length);
    expect(all.filter((b) => b.x <= 30).every((b) => b.z1 - b.z0 < 7)).toBe(true);
    expect(cliffs.length).toBeGreaterThan(8);
    for (const f of cliffs) {
      expect(f.out[2]).toBe(0);
      const zs = f.pts.map((p) => p[2]);
      expect(Math.max(...zs)).toBeCloseTo(40, 3);
      expect(Math.min(...zs)).toBeLessThan(-2.9);
      // its foot runs along the rock's edge, found by bisection (not the grid's staircase)
      for (const [x, y] of f.pts) expect(Math.abs(Math.hypot(x - 60, y - 50) - 15)).toBeLessThan(0.05);
      // and faces out of the rock
      const mx = (f.pts[0][0] + f.pts[1][0]) / 2, my = (f.pts[0][1] + f.pts[1][1]) / 2;
      expect((mx - 60) * f.out[0] + (my - 50) * f.out[1]).toBeGreaterThan(0);
    }
    // the faces close round the rock: their run adds up to its circumference (chords, a little short)
    const run = cliffs.reduce((s, f) => s + Math.hypot(f.pts[1][0] - f.pts[0][0], f.pts[1][1] - f.pts[0][1]), 0);
    expect(run).toBeGreaterThan(2 * Math.PI * 15 * 0.95);
    expect(run).toBeLessThan(2 * Math.PI * 15 * 1.01);
  });

  it('builds the terraced hillside in low dry-stone walls, and lays its steps as flat ground at their own level', () => {
    const { boxes, grounds } = mesh();
    const walls = boxes.filter((b) => b.kind === 'terrace-wall');
    expect(walls.length).toBeGreaterThan(5);
    for (const f of walls) { const zs = f.pts.map((p) => p[2]); expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(4); }
    const land = grounds.filter((g) => g.kind === 'ground');
    for (const g of land.filter((q) => q.x + q.w < 20)) expect(Math.abs(g.z - hAt(g.x + g.w / 2, g.y + g.d / 2))).toBeLessThan(0.1);
    expect(grounds.filter((g) => g.kind === 'water').reduce((a, g) => a + g.w * g.d, 0)).toBeGreaterThan(3000);
    expect(grounds.filter((g) => g.kind === 'water').every((g) => g.z < 0)).toBe(true);
  });

  it('a flat height function gives plain ground and nothing else', () => {
    const { boxes, grounds } = terrainMesh({ hAt: () => 2, frame, surfaceAt: () => ({ fill: '#c0a080' }), riserTint: () => '#000000' });
    expect(boxes).toEqual([]);
    expect(grounds.every((g) => g.kind === 'ground' && Math.abs(g.z - 2) < 0.1)).toBe(true);
    expect(grounds.reduce((s, g) => s + g.w * g.d, 0)).toBeGreaterThanOrEqual(100 * 100);
  });

  it('with the land in the bake, the rock throws its shadow onto the sea, away from the sun', () => {
    const { grounds } = mesh();
    const d = SCENE_LIGHT.dir, h = Math.hypot(d[0], d[1]), away = [d[0] / h, d[1] / h], len = 40 / (-d[2] / h);
    const at = (t) => [60 + away[0] * (15 + t), 50 + away[1] * (15 + t)];
    const lit = bakeShade({ frame, masses: [], grounds }, SCENE_LIGHT);
    const cast = bakeShade({ frame, masses: [], grounds, terrain: hAt }, SCENE_LIGHT);
    const p = at(Math.min(20, len * 0.5));
    expect(lit.sun(...p)).toBeLessThan(0.05);
    expect(cast.sun(...p)).toBeGreaterThan(0.9);
    // sunward of the rock the sea is lit
    expect(cast.sun(60 - away[0] * 22, 50 - away[1] * 22)).toBeLessThan(0.05);
  });
});
