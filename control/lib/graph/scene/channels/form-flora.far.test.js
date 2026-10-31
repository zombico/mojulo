/**
 * The far trees (scene/channels/form-flora.js FLORA_FAR): past the view cone's reach a plant climbs a ladder by the
 * screen's own rule (whole, its own far form, its card where the card's texel is under a pixel); the card is itself,
 * its own leaves and wood baked from a few bearings, one draw for every far plant, casting its shadow.
 */
import { describe, expect, it } from 'vitest';

import { FLORA_FAR, formFloraScript } from './form-flora.js';

const page = () => formFloraScript({ templates: [], n: 0, trees: '', lod: { detail: [6, 16], mid: 25, keep: 0.4, grow: 1.5, sprayed: 6, half: 0.5 }, leafRef: [0.1, 0.2, 0.1], barks: {} });

describe('the far trees', () => {
  it('bakes each template from a few bearings: its own leaves as its clusters lie, and its wood, a texel a pixel', () => {
    expect(FLORA_FAR.bearings).toBeGreaterThanOrEqual(4);
    expect(FLORA_FAR.px).toBeLessThanOrEqual(1);
    const src = page();
    expect(() => new Function('THREE', 'scene', 'D', 'bytes', 'camera', src)).not.toThrow();
    expect(src).toContain("customProgramCacheKey = () => 'form-flora-far'");
    expect(src).toContain('impMesh.customDepthMaterial = idm');
    // (the leaves are the near crown's own triangles, not spheres)
    expect(src).toContain("const CG = T[ti].parts.crown.im.geometry");
    expect(src).not.toContain('Math.sqrt(rr - dd)');
  });

  it('climbs the ladder: whole inside the cone\'s reach, its own far form past it, its card where its texel is under a pixel', () => {
    const src = page();
    expect(src).toContain('const mid = pov ? CO.reach : LOD.mid;');
    expect(src).toContain('card = pov && impOf[ti] && d >= Math.max(mid, (tpl[ti].w * sc) / (FF0.px * CO.px))');
    // (a needled crown and a culm keep their own far form)
    expect(src).toContain('!t.sleeve && !t.culm && t.nClumps > 0');
  });
});
