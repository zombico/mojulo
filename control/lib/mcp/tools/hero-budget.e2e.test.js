// THE GAME COST of the default heroes (the operator's: "the goal is always exporting to game speed"): each minted and
// exported as an engine takes it (the skinned GLB with its clips), held under its BUDGET: triangles, vertices (the GPU
// skins each one every frame), the atlas's size, its materials (the body drawn OPAQUE, only the alpha cards masked), and
// its morph targets stored sparse. A change that grows one past its ceiling fails here, by name, before a picture shows it.
// (Two whole mints and exports: the E2E tier, vitest.config.js E2E.)
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { createCharacterHandler } from './create-character.js';
import { exportModelHandler } from './sketch-model-export.js';

/** the budgets: the default woman and man, as the hero-live viewer mints them (a western face, seed 11, framed close at
 * 1080p); ceilings a few per cent over what they measure (2026-11-23: 82,212 and 61,671 triangles, 52,972 and 36,765
 * vertices, both atlases 2048 x 3104) */
export const HERO_BUDGET = Object.freeze({
  female: { spec: { form: 'realistic', cast: 'female', face: { seed: 11, ethnicity: 'western' }, target: { resolution: '1080p', framing: 'close' } }, tris: 84000, verts: 54500, atlas: [2048, 3200] },
  male: { spec: { form: 'realistic', cast: 'male', face: { seed: 11, ethnicity: 'western' }, target: { resolution: '1080p', framing: 'close' } }, tris: 63500, verts: 38000, atlas: [2048, 3200] },
});

/** a GLB's game cost: its triangles and vertices, its materials' alpha modes, its first image's size, its morph targets */
export function glbCost(buf) {
  const jl = buf.readUInt32LE(12), J = JSON.parse(buf.subarray(20, 20 + jl).toString()), bin = buf.subarray(20 + jl + 8);
  let tris = 0, verts = 0, morphs = 0, sparse = 0;
  // (primitives sharing a mesh's vertices, the cards' and the body's, count them once)
  const seen = new Set();
  for (const m of J.meshes) for (const p of m.primitives) { tris += J.accessors[p.indices].count / 3; if (seen.has(p.attributes.POSITION)) continue; seen.add(p.attributes.POSITION); verts += J.accessors[p.attributes.POSITION].count; for (const t of p.targets ?? []) { morphs++; if (J.accessors[t.POSITION]?.sparse) sparse++; } }
  const v = J.bufferViews[J.images[0].bufferView], png = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  return { tris, verts, materials: J.materials.map((m) => m.alphaMode ?? 'OPAQUE'), atlas: [png.readUInt32BE(16), png.readUInt32BE(20)], morphs, sparse, mb: buf.length / 1e6 };
}

describe('the default heroes\' game cost', () => {
  for (const [sex, B] of Object.entries(HERO_BUDGET)) {
    it(`the ${sex} stays under its budget`, async () => {
      const minted = await createCharacterHandler({ as: 'hero', spec: B.spec });
      const glb = await exportModelHandler({ ref: minted.ref, format: 'glb', clips: '_all', skinned: true, lit: true });
      const C = glbCost(fs.readFileSync(glb.path));
      if (process.env.HERO_BUDGET_PRINT) fs.writeFileSync(`${process.env.HERO_BUDGET_PRINT}-${sex}.json`, JSON.stringify(C));
      expect(C.tris).toBeLessThanOrEqual(B.tris);
      expect(C.verts).toBeLessThanOrEqual(B.verts);
      expect(C.atlas[0] * C.atlas[1]).toBeLessThanOrEqual(B.atlas[0] * B.atlas[1]);
      expect(C.morphs).toBe(C.sparse);
      // (the body OPAQUE, the static mesh's too; the alpha cards, the lashes and the strands, alone masked)
      expect(C.materials.filter((m) => m === 'MASK').length).toBeLessThanOrEqual(1);
      expect(C.materials.filter((m) => m === 'OPAQUE').length).toBeGreaterThanOrEqual(2);
    }, 900_000);
  }
});
