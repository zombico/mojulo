/**
 * The animal World form (skin-over-mesh's phase-1 open item, closed): a
 * buildAnimal recipe resolves to a traversable World payload — faces, camera,
 * skin textures, atlas wearing — through the same litFaces solve the SVG
 * study uses. Covers /world, export_model, and the engine packs for free.
 */
import { describe, expect, it } from 'vitest';

import { assembleAnimalScene } from './figure-world.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { collectFaceTextures } from '../landscape/surface-textures.js';

const finiteVec = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);

describe('assembleAnimalScene', () => {
  it('meshes a canine into world faces with a self-framing camera, feet at z≈0', () => {
    const payload = assembleAnimalScene({ kind: 'animal', archetype: 'canine' }, { title: 'dog' });
    expect(payload.faces.length).toBeGreaterThan(200);
    let minZ = Infinity;
    for (const f of payload.faces) {
      expect(f.corners).toHaveLength(4);
      expect(f.corners.every(finiteVec)).toBe(true);
      for (const c of f.corners) if (c[2] < minZ) minZ = c[2];
    }
    expect(Math.abs(minZ)).toBeLessThan(0.05);
    expect(payload.cameras[0].worldFraming.cameraPosition.every(Number.isFinite)).toBe(true);
  });

  it('is deterministic — same recipe, same faces', () => {
    const a = assembleAnimalScene({ kind: 'animal', archetype: 'feline' }, {});
    const b = assembleAnimalScene({ kind: 'animal', archetype: 'feline' }, {});
    expect(JSON.stringify(a.faces)).toBe(JSON.stringify(b.faces));
  });

  it('manifest.skin gives the whole coat recipe-emitted UVs + islands', () => {
    const { faces } = assembleAnimalScene(
      { kind: 'animal', archetype: 'canine', skin: { texture: 'marble-carrara' } }, {});
    const skinned = faces.filter((f) => f.texture === 'marble-carrara');
    expect(skinned.length).toBeGreaterThan(100);
    for (const f of skinned.slice(0, 30)) {
      expect(f.uv).toHaveLength(4);
      expect(f.textureLit).toBe(true);
      expect(f.island).toBeDefined();
    }
    // the transport seam resolves the tile
    expect(collectFaceTextures(faces, {})['marble-carrara']).toMatch(/^data:image\/png/);
  });

  it('resolves through the WORLD_KINDS registry with the texture collected', async () => {
    const { payload, kind } = await resolveWorldScene({
      ref: 'sk_animal_reg', title: 'reg dog',
      manifest: { kind: 'animal', archetype: 'canine', skin: { texture: 'marble-carrara' } },
    });
    expect(kind).toBe('animal');
    expect(payload.faces.length).toBeGreaterThan(0);
    expect(payload.textures['marble-carrara']).toMatch(/^data:image\/png/);
  });

  it('exports to GLB — the animal is now a portable asset', async () => {
    const { payload } = await resolveWorldScene({
      ref: 'sk_animal_glb', title: 'glb dog', manifest: { kind: 'animal', archetype: 'canine' },
    });
    const out = facesToGlb(payload, { generator: 'test' });
    expect(out).not.toBeNull();
    expect(out.triangleCount).toBeGreaterThan(200);
  });

  it('normal-rule countershading survives into the world (belly ≠ coat)', () => {
    const coat = assembleAnimalScene({
      kind: 'animal', archetype: 'canine',
      opts: { coat: { color: '#8a6f4d' }, underHex: '#e8e2d4' },
    }, {});
    const fills = new Set(coat.faces.map((f) => f.fill));
    expect(fills.size).toBeGreaterThan(2);   // coat + belly + skull zones at least
  });
});
