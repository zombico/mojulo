/**
 * vegetation — the scene layer: what a pooled plant wears and how bamboo stands. Claims under test: a tree's near levels
 * wear its species' bark tile on the thick axes (textured quads with a plain colour beside them) and its far levels do
 * not; a palm's near trunk wears its own unrolled surface, mapped over its length; a bamboo item becomes a grove (a
 * clump of a clumping bamboo, a patch of a running one) standing on the ground and out of the water; a culm leaning out
 * of its clump picks the variant leaning its way; the World page draws textured template faces instanced, and a page
 * without them carries none of that code; exports that cannot texture an instance draw those faces in their plain
 * colour instead of dropping them.
 */
import { describe, expect, it } from 'vitest';

import { plantPool, plantRepeats, groveItems } from './pool.js';
import { barkTile } from './tiles.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { printableShells } from '../scene/scene-stl.js';

const textured = (faces) => faces.filter((f) => f.texture);

describe('what a pooled plant wears', () => {
  it('a bark tile is deterministic, a PNG, and knows its mean colour', () => {
    const a = barkTile('oak'); expect(a.url).toMatch(/^data:image\/png;base64,/); expect(a.key).toBe('bark-oak'); expect(a.metres).toBe(0.6);
    expect(a.mean.every((v) => v > 20 && v < 200)).toBe(true);
    expect(() => barkTile('baobab')).toThrow(/unknown bark/);
  });
  it("a tree's near levels wear its bark on the thick axes; its far levels are plain", () => {
    const pool = plantPool({ species: 'beech', variants: 1, seed: 's', maxLevel: 'L2' }); const v = pool.variants[0];
    expect(pool.textures['bark-beech']).toBe(barkTile('beech').url);
    const bark = textured(v.levels.L2); expect(bark.length).toBeGreaterThan(20);
    for (const f of bark) { expect(f.texture).toBe('bark-beech'); expect(f.textureLit).toBe(true); expect(f.uv).toHaveLength(4); expect(f.corners).toHaveLength(4); expect(f.plainFill).toBeTruthy(); }
    expect(textured(v.levels.L1)).toEqual([]); expect(textured(v.levels.L0)).toEqual([]);
  });
  it("a palm's near trunk wears its own surface, mapped once over its length", () => {
    const pool = plantPool({ species: 'date', variants: 1, seed: 's', maxLevel: 'L2' }); const v = pool.variants[0];
    const trunk = textured(v.levels.L2); const key = trunk[0].texture;
    expect(key).toMatch(/^trunk-date-/); expect(pool.textures[key]).toMatch(/^data:image\/png;base64,/);
    const vs = trunk.flatMap((f) => f.uv.map((q) => q[1])); expect(Math.min(...vs)).toBeCloseTo(0, 6); expect(Math.max(...vs)).toBeGreaterThan(0.9); expect(Math.max(...vs)).toBeLessThanOrEqual(1.0001);
    expect(textured(v.levels.L1)).toEqual([]);
  });
});

describe('bamboo stands as a grove', () => {
  const item = { x: 3, y: -2, z0: 0.5, height: 1.3, width: 0.7 };
  it('a clumping bamboo becomes one clump of tens of culms, leaning out; a running one a patch; others stay as they are', () => {
    const clump = groveItems('vulgaris', item, { seed: 'g' });
    expect(clump.length).toBeGreaterThan(30); expect(clump.length).toBeLessThanOrEqual(90);
    expect(clump.filter((c) => c.lean > 9).length).toBeGreaterThan(clump.length / 3);
    const patch = groveItems('moso', item, { seed: 'g' }); expect(patch.length).toBeGreaterThan(20);
    for (const c of patch) expect(Number.isFinite(c.age)).toBe(true);
    expect(groveItems('oak', item)).toEqual([item]);
    expect(groveItems('vulgaris', item, { seed: 'g' })).toEqual(clump);
  });
  it('each culm stands on the ground where it lands, and none stands in the water', () => {
    const groundAt = (x, y) => 0.1 * x - 0.05 * y; const water = groundAt(item.x, item.y);   // the water stands at the item: half the patch floods
    const culms = groveItems('moso', item, { seed: 'g', groundAt, water });
    for (const c of culms) { expect(c.z0).toBeCloseTo(groundAt(c.x, c.y), 12); expect(c.z0).toBeGreaterThanOrEqual(water); }
    expect(culms.length).toBeLessThan(groveItems('moso', item, { seed: 'g', groundAt }).length);
  });
  it('a culm leaning out of its clump wears the variant leaning its way', () => {
    const pool = plantPool({ species: 'vulgaris', variants: 1, seed: 's', maxLevel: 'L1' });
    const leaners = pool.variants.filter((v) => v.lean); expect(leaners.length).toBe(12);
    for (const az of [0, 120, 240]) {
      const { repeats } = plantRepeats(pool, [{ x: 0, y: 0, z0: 0, height: 13, age: 3, lean: 22, az: az + 8 }], { level: 'L1' });
      const tpl = repeats.find((r) => /culm/.test(r.group)).template; const want = pool.variants.find((v) => v.lean === 24 && v.az === az);
      expect(tpl).toBe(want.parts.culm.L1);
    }
  });
});

describe('the World page and the exports', () => {
  const pool = plantPool({ species: 'beech', variants: 1, seed: 's', maxLevel: 'L2' });
  const { repeats } = plantRepeats(pool, [{ x: 0, y: 0, z0: 0, height: 12 }, { x: 9, y: 4, z0: 0, height: 10 }], { level: 'L2' });
  const payload = { faces: [], repeats, textures: pool.textures, cameras: [{ name: 'a', worldFraming: { cameraPosition: [0, -30, 6], lookAt: [0, 0, 6], horizontalFov: 60 } }] };
  it('draws textured template faces instanced; a page without them carries none of that', () => {
    const html = emitThreeWorld(payload);
    expect(html).toContain('const REP_TEX = {};'); expect(html).toContain('"bark-beech"');
    const plain = emitThreeWorld({ ...payload, repeats: plantRepeats(pool, [{ x: 0, y: 0, z0: 0, height: 12 }], { level: 'L1' }).repeats, textures: {} });
    expect(plain).not.toContain('REP_TEX'); expect(plain).not.toContain('"tex":');
  });
  it('an export that cannot texture an instance draws its bark in the plain colour instead of dropping it', () => {
    const glb = facesToGlb(payload); const stripped = facesToGlb({ ...payload, repeats: repeats.map((r) => ({ ...r, template: r.template.filter((f) => !f.texture) })) });
    expect(glb.triangleCount).toBeGreaterThan(stripped.triangleCount);
    const shells = printableShells(payload); const tpl = shells.repeats.find((r) => r.transforms.length);
    expect(tpl.positions.length).toBeGreaterThan(0);
  });
});
