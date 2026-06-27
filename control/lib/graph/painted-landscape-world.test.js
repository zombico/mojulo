import { describe, it, expect } from 'vitest';

import { assemblePaintedLandscapeScene, renderPaintedLandscapeToHtml } from './scene-css3d.js';
import { emitThreeWorld } from './scene-three.js';

// painted-landscape gained a traversable three.js World by riding the shared
// assemble*Scene → emitThreeWorld seam (the terrain heightfield is already a
// world-space face list). These guard that seam + the CSS-3D regression.
const TERRAIN = { kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio', seed: 's' };

describe('assemblePaintedLandscapeScene', () => {
  it('returns a world payload of faces + pinhole cameras', () => {
    const payload = assemblePaintedLandscapeScene(TERRAIN, {});
    expect(payload.faces.length).toBeGreaterThan(0);
    // emitThreeWorld needs worldFraming pinhole cameras (cameraPosition + lookAt)
    expect(payload.cameras.length).toBeGreaterThan(0);
    for (const cam of payload.cameras) {
      expect(Array.isArray(cam.worldFraming.cameraPosition)).toBe(true);
      expect(Array.isArray(cam.worldFraming.lookAt)).toBe(true);
    }
  });

  it('exposes a SOLID bg colour (three.js cannot parse a CSS gradient)', () => {
    const { bg } = assemblePaintedLandscapeScene(TERRAIN, {});
    expect(bg).toMatch(/^(#|rgb\()/);
    expect(bg).not.toContain('gradient');
  });

  it('returns null for a non-painted-landscape manifest', () => {
    expect(assemblePaintedLandscapeScene({ kind: 'fractal-city' }, {})).toBeNull();
  });
});

describe('emitThreeWorld over terrain', () => {
  it('renders the terrain payload to a three.js World page without throwing', () => {
    const html = emitThreeWorld(assemblePaintedLandscapeScene(TERRAIN, {}));
    expect(html).toContain('OrbitControls'); // free orbit/zoom/pan wired
    expect(html).toContain('"name":"static"'); // ungrouped terrain → one static mesh
  });
});

describe('scene scatter → real plant geometry in the World', () => {
  const base = { kind: 'painted-landscape', heartbeat: 'gentle-roughness', splatch: 'meadow-trio', seed: 'forest' };

  it('bakes branched tree geometry when a forest scene is set (not in the bare terrain)', () => {
    const bare = assemblePaintedLandscapeScene(base, {});
    const forest = assemblePaintedLandscapeScene({ ...base, scene: 'pine-forest' }, {});
    // a pine-forest adds hundreds of plant faces (trunks + canopy tiers) over the bare terrain
    expect(forest.faces.length).toBeGreaterThan(bare.faces.length + 500);
  });
});

describe('sky dome + night stars in the World', () => {
  const night = {
    kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'glacier-trio',
    sky: 'starry-night', light: { x: 0.3, y: 0.2, z: -0.4 }, seed: 'night',
  };

  it('threads a night sky (day≈0, stars>0) through the seam', () => {
    const { sky } = assemblePaintedLandscapeScene(night, {});
    expect(sky.day).toBeLessThan(0.5);
    expect(sky.stars).toBeGreaterThan(0);
    expect(typeof sky.seed).toBe('number'); // the World LCG needs a number, not the string seed
  });

  it('emits a world-fixed sky dome + star points for a night terrain', () => {
    const html = emitThreeWorld(assemblePaintedLandscapeScene(night, {}));
    expect(html).toContain('world-fixed sky dome');
    expect(html).toContain('THREE.SphereGeometry'); // gradient dome
    expect(html).toContain('THREE.Points');         // star-field code path
    // the threaded SKY carries a night day-factor + a non-zero star density (the runtime gate)
    expect(html).toMatch(/"day":0\b|"day":0\./);
    expect(html).toContain('"stars":0.75');
  });

  it('draws the gradient dome and threads zero stars for a day terrain', () => {
    const day = assemblePaintedLandscapeScene({ kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio', sky: 'golden-sun', seed: 'd' }, {});
    expect(day.sky.day).toBeGreaterThanOrEqual(0.5);
    const html = emitThreeWorld(day);
    expect(html).toContain('world-fixed sky dome'); // dome still drawn by day
    expect(html).toContain('"stars":0');            // golden-sun → no star field at runtime
  });

  it('skips the dome entirely when no sky / a non-terrain (preset-shaped) sky is given', () => {
    expect(emitThreeWorld({ faces: [{ corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], fill: '#888' }] }))
      .not.toContain('world-fixed sky dome');
    // box-world preset sky shape ({ preset, stars, moon }) has no zenith array → guarded out
    expect(emitThreeWorld({ faces: [{ corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], fill: '#888' }], sky: { preset: 'night', stars: true } }))
      .not.toContain('world-fixed sky dome');
  });
});

describe('moon + translucent water in the World', () => {
  const elevation = {
    fields: {
      bowl: { kind: 'terrain-region', center: { x: 0, y: -10, z: 0 }, radius: 9, peak: -3, waves: [] },
      elevation: { kind: 'sum', components: [{ field: 'bowl' }] },
    },
    field: 'elevation', waterLevel: -0.5, samples: { u: 16, v: 16 },
  };
  const moonlit = {
    kind: 'painted-landscape', splatch: 'glacier-trio', sky: 'harvest-moon',
    light: { x: 0.3, y: 0.2, z: -0.4 }, elevation, seed: 'moonlit',
  };

  it('threads a gibbous moon (phase, position) through the seam at night', () => {
    const { sky } = assemblePaintedLandscapeScene(moonlit, {});
    expect(sky.moon).toBeTruthy();
    expect(sky.moon.phase).toBeCloseTo(0.82, 2); // harvest-moon card
    expect(sky.moon.u).toBeGreaterThanOrEqual(0);
  });

  it('emits the water sheet as a 4-component (alpha) mesh, separate from the opaque groups', () => {
    const payload = assemblePaintedLandscapeScene(moonlit, {});
    expect(payload.faces.some((f) => f.water)).toBe(true);       // water faces are tagged
    const html = emitThreeWorld(payload);
    expect(html).toContain('translucent water sheet');
    expect(html).toContain('BufferAttribute(col, 4)');           // per-vertex RGBA alpha
  });

  it('threads moon=null for a starless/moonless or daytime sky', () => {
    const day = assemblePaintedLandscapeScene({ kind: 'painted-landscape', heartbeat: 'gentle-pulse', splatch: 'meadow-trio', sky: 'golden-sun', seed: 'd' }, {});
    expect(day.sky.moon).toBeNull();
    expect(emitThreeWorld(day)).toContain('"moon":null');
  });
});

describe('renderPaintedLandscapeToHtml — CSS-3D regression', () => {
  it('still paints the zenith→horizon gradient backdrop (not the solid World bg)', () => {
    const html = renderPaintedLandscapeToHtml(TERRAIN, {});
    expect(html).toContain('linear-gradient(');
  });
});
