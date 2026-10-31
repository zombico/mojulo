/**
 * The far structures (scene/channels/far-structures.js): what stands on a form page is drawn as batches of tiles, each
 * tile its own card past the view cone's reach by the screen's rule; the land and what stands over the tallest stay
 * live; a pass with a material of its own draws the merged mesh, and the cards sit it out. The block parses.
 */
import { describe, expect, it } from 'vitest';

import { FAR_STRUCTURES, farStructuresScript } from './far-structures.js';
import { formLandScript } from './form-land.js';

describe('the far structures', () => {
  it('splits what stands into tiles in one batch a material, and leaves the land and the sky live', () => {
    const src = farStructuresScript();
    expect(() => new Function('THREE', 'scene', 'POS', '__formMeshes', src)).not.toThrow();
    expect(src).toContain('new THREE.BatchedMesh(');
    expect(src).toContain('if (!(h > FS.ground && h < FS.tall)) { keyOf[f] = null; continue; }');
    expect(FAR_STRUCTURES.ground).toBeGreaterThan(0);
    expect(FAR_STRUCTURES.tall).toBeGreaterThan(FAR_STRUCTURES.ground);
  });

  it('cards a tile only past the reach and where its texel is under a pixel; the aerial camera draws it live', () => {
    const src = farStructuresScript();
    expect(src).toContain('card = pov && d > CO.reach && t.texel / (CO.px * Math.max(d, 0.1)) < FS.px');
    expect(FAR_STRUCTURES.px).toBeLessThanOrEqual(1);
  });

  it('stands the merged mesh in for a pass with its own material, and keeps the cards out of it', () => {
    const src = farStructuresScript();
    expect(src).toContain('if (P[1].material !== P[2] && P[1].visible)');
    expect(src).toContain('cards.userData.ink = true');
    expect(formLandScript({ light: { sun: [1, 1, 1], ambient: [0.2, 0.2, 0.2] } })).toContain('the far structures: what stands');
  });
});
