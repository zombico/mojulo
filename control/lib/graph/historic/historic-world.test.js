import { describe, it, expect } from 'vitest';
import { withWorldTextures, renderAssetSheetToWorld, triangulateFace } from './historic-world.js';
import { assembleAssetSheetScene } from './historic-city.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { QIN_ASSETS } from './assets/qin.js';

describe('historic World (three.js) export', () => {
  const scene = assembleAssetSheetScene({ asset: 'qn-hall', culture: 'qin', kit: QIN_ASSETS });

  it('resolves every texture a face names (skins and ground tiles), so no textured face draws blank', () => {
    const W = withWorldTextures(scene), named = new Set(scene.faces.map((f) => f.texture).filter(Boolean));
    expect([...named].some((k) => k.startsWith('hskin-tile-roof'))).toBe(true);
    for (const k of named) expect(W.textures[k], k).toMatch(/^data:image\/png;base64,/);
  });

  it('splits a polygon face into triangles inside its outline, concave edges included', () => {
    const f = { corners: [[0, 0, 0], [10, 0, 0], [10, 10, 0], [5, 4, 0], [0, 10, 0]], fill: '#fff' };
    const tris = triangulateFace(f);
    expect(tris.length).toBe(3);
    const area = (c) => Math.abs((c[1][0] - c[0][0]) * (c[2][1] - c[0][1]) - (c[1][1] - c[0][1]) * (c[2][0] - c[0][0])) / 2;
    expect(tris.reduce((a, t) => a + area(t.corners), 0)).toBeCloseTo(70, 6);   // 100 less the 30 notch
    expect(triangulateFace({ corners: f.corners.slice(0, 4), fill: '#fff' })).toHaveLength(1);   // a quad stays whole
  });

  it('emits a rotatable page and a GLB carrying the same faces', () => {
    const html = renderAssetSheetToWorld({ asset: 'qn-hall', culture: 'qin', kit: QIN_ASSETS });
    expect(html).toContain('OrbitControls');
    expect(html).toContain('hskin-hangtu');
    const g = facesToGlb(withWorldTextures(scene));
    expect(g.triangleCount).toBeGreaterThan(scene.faces.length);
  });
});
