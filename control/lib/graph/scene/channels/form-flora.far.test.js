/**
 * The far trees (scene/channels/form-flora.js FLORA_FAR): a plant is whole, then its card where the card's texel is under
 * the cone's grain past its reach, with no far form between (a crown of fewer clumps grown read as a bubble); the card is
 * itself, its own leaves point-sampled and its wood baked from a few bearings, one draw for every far plant, casting its
 * shadow.
 */
import { describe, expect, it } from 'vitest';

import { FLORA_FAR, formFloraScript } from './form-flora.js';

const page = () => formFloraScript({ templates: [], n: 0, trees: '', lod: { detail: [6, 16], mid: 25, sprayed: 6 }, leafRef: [0.1, 0.2, 0.1], barks: {} });

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

  it('is whole, then its card: past the cone\'s reach where its texel is under the cone\'s grain, no far form between', () => {
    const src = page();
    expect(src).toContain('const mid = pov ? CO.reach : LOD.mid;');
    expect(src).toContain('cardAt = impOf[ti] && CO ? (tpl[ti].w) / ((CO.grain || FF0.px) * CO.px) : Infinity');
    expect(src).toContain('const card = d >= Math.max(mid, cardAt * sc), isNear = !card && (impOf[ti] || d < mid)');
    // (no crown of clumps kept and grown: the bubble)
    expect(src).not.toContain('LOD.keep');
    expect(src).not.toContain('farGeo');
    // (a needled crown and a culm keep their own far form)
    expect(src).toContain('!t.sleeve && !t.culm && t.nClumps > 0');
    // (with the page's air, a plant whose top it has taken is not drawn at all, whole or as its card)
    expect(src).toContain('const AIR = window.__mojAir && window.__mojAir.taken ? window.__mojAir : null;');
    expect(src).toContain('{ taken++; continue; }');
  });

  it('samples the leaves as the screen does: a leaf grown by nothing, so the card is no thicker than the crown', () => {
    expect(FLORA_FAR.leaf).toBe(0);
    expect(FLORA_FAR.wood).toBe(0);
    // (finer than a pixel at the cone's grain where it turns: a mark no wider than the leaves it stands for)
    expect(FLORA_FAR.texels[0]).toBeGreaterThanOrEqual(128);
  });

  it('leaves a skirt\'s tree out of the litter and the brushing', () => {
    const src = page();
    expect(src).toContain("t.kind !== 'tree' || !t.litter || P[b + 12] > 1.5");
    expect(src).toContain('P[i * STRIDE + 12] > 0.5 && P[i * STRIDE + 12] < 1.5');
  });
});
