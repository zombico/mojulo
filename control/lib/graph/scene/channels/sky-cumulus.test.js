import { describe, it, expect } from 'vitest';
import { cumulusPuffs } from './cumulus-puffs.js';
import { skyCumulusScript } from './sky-cumulus.js';
import { formSkyScript } from './form-sky.js';
import { groundCumulus } from '../../skyscape/sky.js';

// THE CUMULUS' PUFFS (cumulus-puffs.js), shared by the flight sky and the ground worlds' sky; A GROUND WORLD'S CUMULUS
// (sky-cumulus.js) drawn in sky space inside the form sky, emitted only when its land carries them.
const G = groundCumulus({ kind: 'fair', seed: 2 }), sun = { x: -0.3, y: -0.5, z: 0.8 };

describe('the cumulus\' puffs', () => {
  it('lays each cloud\'s puffs over its flat base, under its top, the same clouds the same puffs', () => {
    const { P, I } = cumulusPuffs(G.data, G.n, G.wind, sun);
    expect(P.length).toBe(I.length);
    expect(P.length / 4).toBeGreaterThan(G.n * 10);
    for (let k = 0; k < P.length / 4; k++) {
      expect(P[k * 4 + 2]).toBeGreaterThan(I[k * 4 + 2]);
      expect(P[k * 4 + 2]).toBeLessThanOrEqual(I[k * 4 + 3] + P[k * 4 + 3]);
      expect(P[k * 4 + 3]).toBeGreaterThan(0);
    }
    expect(JSON.stringify(cumulusPuffs(G.data, G.n, G.wind, sun))).toBe(JSON.stringify({ P, I }));
    // (a thunderhead's puffs marked round by their sign; a fair cloud's not)
    const tower = cumulusPuffs([0, 0, 650, 1500, 5000, 7], 1, [1, 0], sun);
    expect(tower.I.filter((_, i) => i % 4 === 0).every((v) => v < 0)).toBe(true);
    expect(I.filter((_, i) => i % 4 === 0).every((v) => v >= 0)).toBe(true);
  });
});

describe('a ground world\'s cumulus', () => {
  it('is drawn in the form sky only when its land carries them; the sheet then a thin high layer over them', () => {
    const plain = formSkyScript(), withC = formSkyScript({ cumulus: true });
    expect(plain).not.toContain('sky-cumulus');
    expect(plain).not.toContain('KH');
    expect(withC).toContain("a ground world's cumulus (channels/sky-cumulus.js)");
    expect(withC).toContain('uAlt: { value: KH.alt');
    expect(() => new Function('THREE', 'scene', 'D', 'meshes', withC)).not.toThrow();
    // (drawn after the dome and before the land, the canvas kept opaque under its rims)
    const js = skyCumulusScript({ puffs: cumulusPuffs.toString() });
    expect(js).toContain('cmesh.renderOrder = -1.8');
    expect(js).toContain('depthTest: false');
    expect(js).toContain('blendSrcAlpha: THREE.OneFactor');
    expect(js).not.toMatch(/Math\.random/);
  });
});
