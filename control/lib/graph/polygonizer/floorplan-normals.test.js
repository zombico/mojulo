/**
 * Furniture normals + contact shadows (room-realism.plan.md, phase 3).
 *
 * Every face a furnished cell emits carries a unit `outNormal` consistent with its
 * geometry (the GLB NORMAL attribute and the Blender bake's facing read it; mojulo's
 * own shading never does). Local assets turn their authored normals with the piece.
 * `contactShadows` lays an AO decal on the footprint's own floor under each piece;
 * off by default, on for a one-cell furnished plan.
 */
import assert from 'node:assert';
import { test } from 'vitest';
import { structurizeFloorplan } from './floorplan-structure.js';
import { roomFurnitureAssetFaces } from '../architecture/room-assets.js';

const ONE_CELL = { width: 24, height: 28, rooms: [{ x: 2, y: 2, w: 20, h: 24, glyph: 'L' }], doors: [{ x: 12, y: 26, room: 0, edge: 'S' }] };
const newell = (c) => { let x = 0, y = 0, z = 0; for (let i = 0; i < c.length; i += 1) { const a = c[i], b = c[(i + 1) % c.length]; x += (a[1] - b[1]) * (a[2] + b[2]); y += (a[2] - b[2]) * (a[0] + b[0]); z += (a[0] - b[0]) * (a[1] + b[1]); } const L = Math.hypot(x, y, z); return L ? [x / L, y / L, z / L] : null; };
const furniture = (s) => s.faces.filter((f) => !f.group || f.group.startsWith('asset:'));

test('every furnished-cell face carries a unit outNormal that agrees with its plane', () => {
  for (const scale of ['feet', 'share']) {
    const s = structurizeFloorplan(ONE_CELL, { furnish: true, furnishScale: scale, contactShadows: false });
    const furn = furniture(s);
    assert.ok(furn.length > 100, `${scale}: furniture faces present`);
    let checked = 0;
    for (const f of s.faces) {
      if (f.water) continue;                                // translucent panes never enter the bake / opaque mesh
      assert.ok(Array.isArray(f.outNormal) && f.outNormal.length === 3, `${scale}: face missing outNormal (group ${f.group})`);
      const L = Math.hypot(...f.outNormal);
      assert.ok(Math.abs(L - 1) < 1e-6, `${scale}: unit normal (got ${L})`);
      const g = newell(f.corners);
      if (!g) continue;                                     // degenerate (cap) faces have no plane
      const dot = Math.abs(f.outNormal[0] * g[0] + f.outNormal[1] * g[1] + f.outNormal[2] * g[2]);
      if (dot > 1e-6) { assert.ok(dot > 0.85, `${scale}: normal off-plane (|dot| ${dot.toFixed(3)}, group ${f.group})`); checked += 1; }
    }
    assert.ok(checked > 100, `${scale}: planes checked`);
  }
});

test('a local asset turns its authored normals with the footprint', () => {
  const quad = (spin) => {
    const c = [[0, 0, 0], [2, 0, 0], [2, 3, 0], [0, 3, 0]];
    return c.map((_, i) => c[(i + spin) % 4]);
  };
  const el = (spin) => ({ asset: 'club-armchair', heightManji: { basePlane: { corners: quad(spin) }, heightWorld: 2.6 } });
  const a = roomFurnitureAssetFaces(el(0)).faces, b = roomFurnitureAssetFaces(el(1)).faces;
  // the same part, spun a quarter turn: its normal spins too (x ↔ y), and stays consistent with its plane
  const back = (faces) => faces.find((f) => f.corners.every((p) => Math.abs(p[2] - f.corners[0][2]) > -1) && Math.abs(f.outNormal[2]) < 0.01 && f.outNormal[1] < -0.9);
  const ab = back(a);
  assert.ok(ab, 'unspun piece has a −y-facing side');
  assert.ok(b.some((f) => Math.abs(f.outNormal[2]) < 0.01 && Math.abs(f.outNormal[0]) > 0.9), 'spun piece has that side facing ±x');
  for (const f of b) {
    const g = newell(f.corners);
    if (!g) continue;
    const dot = Math.abs(f.outNormal[0] * g[0] + f.outNormal[1] * g[1] + f.outNormal[2] * g[2]);
    if (dot > 1e-6) assert.ok(dot > 0.85, 'spun normal still lies on its face plane');
  }
});

test('contactShadows: decals on the footprint floor under each piece; off by default; one-cell default on', () => {
  const on = structurizeFloorplan(ONE_CELL, { furnish: true });
  const decals = on.faces.filter((f) => f.decal === 'shadow');
  assert.ok(decals.length >= 5, `one decal per grounded piece (got ${decals.length})`);
  for (const d of decals) {
    assert.ok(d.corners.every((p) => Math.abs(p[2] - 0.09) < 1e-9), 'decal sits 0.09 above the cell floor (over the boards and the rug)');
    assert.ok(d.shadowAlpha > 0 && d.shadowAlpha <= 0.6);
  }
  const off = structurizeFloorplan(ONE_CELL, { furnish: true, contactShadows: false });
  assert.equal(off.faces.filter((f) => f.decal === 'shadow').length, 0, 'explicit off');
  const legacy = structurizeFloorplan({ seed: 7, width: 46, height: 34 }, { furnish: true });
  assert.equal(legacy.faces.filter((f) => f.decal === 'shadow').length, 0, 'generated plans stay decal-free by default');
  const upstairs = structurizeFloorplan(ONE_CELL, { furnish: true, baseZ: 9 });
  assert.ok(upstairs.faces.filter((f) => f.decal === 'shadow').every((d) => d.corners.every((p) => Math.abs(p[2] - 9.09) < 1e-9)), 'an upper storey keeps its decals upstairs');
  assert.equal(on.faces.filter((f) => f.decal === 'shadow' && f.corners.some((p) => p[2] > 1)).length, 0);
});

import { contactShadowDecals } from '../scene/scene-css3d.js';
import { collectShadowDecals } from '../figures/face-mesh.js';

test('contact decals: the one-cell room asks for the rim profile; the default pool profile is byte-identical', () => {
  const fp = [{ corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], height: 2 }];
  const pool = contactShadowDecals(fp, { strength: 0.5 })[0];
  assert.equal(pool.shadowProfile, undefined);
  assert.ok(pool.bg.includes('42%') && pool.bg.includes('80%'), 'legacy gradient stops');
  const rim = contactShadowDecals(fp, { strength: 0.5, profile: 'rim' })[0];
  assert.equal(rim.shadowProfile, 'rim');
  assert.ok(rim.bg.includes('58%') && rim.bg.includes('74%'), 'rim holds alpha to the footprint edge');
  assert.equal(collectShadowDecals([rim])[0].profile, 'rim');
  assert.equal(collectShadowDecals([pool])[0].profile, undefined);
  const s = structurizeFloorplan(ONE_CELL, { furnish: true });
  assert.ok(s.faces.filter((f) => f.decal === 'shadow').every((f) => f.shadowProfile === 'rim'), 'the room grounds with rims');
});
