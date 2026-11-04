import { describe, it, expect } from 'vitest';
import { SHUTTER_LEAVES, SHUTTER_LEAF_IDS, LEAF, leafKey, leafRelief, leafPage, layLeaf } from './shutter-leaves.js';
import { shutterDress } from './out-openings.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { emitThreeWorld } from '../scene/scene-three.js';

// a wall frame along x, its face toward −y (out-openings' W)
const W = { at: (u, z, d) => [u, -d, z], n: [0, -1, 0] };
const face = { corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], fill: '#808080', cornerFills: ['#808080', '#808080', '#808080', '#808080'] };

describe('the shutter leaves: a form as relief on one box, not as geometry', () => {
  it('a leaf of the library is its box alone, its front named for the relief; the first forms keep their lines', () => {
    const leaf = [], boards = [];
    shutterDress(leaf, W, 0, 0.5, 0, 1.5, SHUTTER_LEAF_IDS[0], 0.55, {});
    shutterDress(boards, W, 0, 0.5, 0, 1.5, 'boards', 0.55, {});
    expect(leaf).toHaveLength(5); // its face, top, foot and two ends
    expect(leaf[0].leaf).toBe(SHUTTER_LEAF_IDS[0]);
    expect(leaf.slice(1).some((f) => f.leaf)).toBe(false);
    expect(boards.length).toBeGreaterThan(5);
    expect(boards.some((f) => f.leaf)).toBe(false);
  });

  it('each form stands within its depth, has hollows and crests, and paints the same bytes twice', () => {
    for (const id of SHUTTER_LEAF_IDS) {
      const S = SHUTTER_LEAVES[id], hs = [];
      for (let v = 0.01; v < LEAF.h; v += 0.013) for (let u = 0.01; u < LEAF.w; u += 0.013) hs.push(S.height(u, v));
      expect(Math.min(...hs), id).toBe(0);
      expect(Math.max(...hs), id).toBeCloseTo(S.depth, 6);
      expect(surfaceTexture(leafKey(id))).toMatch(/^data:image\/png;base64,/);
      expect(leafRelief(id).height).toBe(leafRelief(id).height);
    }
  });

  it('a leaf laid wears its tile across it, mirrored with its corners; a page with no leaf carries none', () => {
    const id = SHUTTER_LEAF_IDS[0], F = layLeaf(face, id), M = layLeaf(face, id, true);
    expect(F.texture).toBe(leafKey(id));
    expect(F.textureLit).toBe(true);
    expect(F.uv).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]]);
    expect(M.uv).toEqual([[0, 1], [1, 1], [1, 0], [0, 0]]);
    expect(F.fill > face.fill).toBe(true); // lifted, as a detail's
    expect(layLeaf(face, 'flat')).toBe(face);
    expect(leafPage(['detail:x', undefined])).toBeNull();
    expect(Object.keys(leafPage([leafKey(id), 'detail:x']).maps)).toEqual([leafKey(id)]);
  });

  it('the page marches the leaves only when a scene laid one: absent, not a byte of it', () => {
    const id = SHUTTER_LEAF_IDS[0], F = layLeaf(face, id), textures = { [leafKey(id)]: surfaceTexture(leafKey(id)) };
    const without = emitThreeWorld({ faces: [F], textures }), withIt = emitThreeWorld({ faces: [F], textures, leaves: leafPage([leafKey(id)]) });
    expect(without).not.toContain('__mojLeaf');
    expect(without).not.toContain('tm.userData.key');
    expect(withIt).toContain('__mojLeaf');
    expect(withIt).toContain('tm.userData.key = t.key');
  });
});
