// export-model.beast.test.js — a beast-kin's whole loop: minted by the character door on the tiered body (`beast`, its
// kin's head and cover), exported as the lit skinned GLB an engine takes, read back by glTF-Transform: one skinned mesh
// carrying its cover's tile (TEXCOORD_0), its corners' normals and tangents, and a material with the cover's base,
// normal, occlusion and roughness and its height in the extras. Without a cover, none of them. (On the E2E list: a
// hero minted whole.)
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { NodeIO } from '@gltf-transform/core';

process.env.MOJULO_OUTCOMES_DIR = mkdtempSync(path.join(os.tmpdir(), 'mojulo-beast-outcomes-'));

import { createCharacterHandler } from './create-character.js';
import { exportModelHandler } from './sketch-model-export.js';
import { COVERS } from '../../graph/beast/cover.js';

const exported = async (beast) => {
  const minted = await createCharacterHandler({ as: 'hero', spec: { cast: 'male', beast } });
  expect(minted.ok).toBe(true);
  const out = await exportModelHandler({ ref: minted.ref, format: 'glb', clips: '_all', skinned: true, lit: true });
  expect(out.ok).toBe(true);
  const root = (await new NodeIO().readBinary(new Uint8Array(readFileSync(out.path)))).getRoot();
  return { root, prim: root.listMeshes().flatMap((m) => m.listPrimitives()).find((p) => p.getAttribute('JOINTS_0')) };
};

describe('a beast-kin, minted and exported', () => {
  it('its lit skinned GLB carries its cover: the tile, the tangents, the maps an engine lights', async () => {
    const { root, prim } = await exported({ kin: 'lupine', legs: 'digitigrade' });
    for (const a of ['POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']) expect(prim.getAttribute(a), a).toBeTruthy();
    const mat = prim.getMaterial();
    expect(mat.getBaseColorTexture()).toBeTruthy(); expect(mat.getNormalTexture()).toBeTruthy();
    expect(mat.getOcclusionTexture()).toBeTruthy(); expect(mat.getMetallicRoughnessTexture()).toBeTruthy();
    expect(mat.getMetallicFactor()).toBe(0);
    expect(mat.getExtras()?.mojulo).toMatchObject({ cover: true, tile: COVERS.fur.tile, depth: COVERS.fur.depth });
    // (the tile repeats round the body: its u runs past one)
    const uv = prim.getAttribute('TEXCOORD_0').getArray(); let max = 0; for (let i = 0; i < uv.length; i += 2) max = Math.max(max, uv[i]);
    expect(max).toBeGreaterThan(2);
    expect(root.listAnimations().map((a) => a.getName())).toEqual(expect.arrayContaining(['body:walk']));
  }, 300_000);

  it('without a cover it carries none of them', async () => {
    const { prim } = await exported({ kin: 'lupine', cover: 'none' });
    expect(prim.getAttribute('TEXCOORD_0')).toBeNull(); expect(prim.getAttribute('TANGENT')).toBeNull();
    expect(prim.getMaterial().getNormalTexture()).toBeNull();
  }, 300_000);
});
