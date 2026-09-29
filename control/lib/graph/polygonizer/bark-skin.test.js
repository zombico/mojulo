// bark-skin — the trees' bark on a lathe or loft: identity when absent, textured quads with uv when present, the tile
// served by key, a typo named.
import { describe, expect, it } from 'vitest';
import { barkLathe, barkLoft, validateBark, BARK_KEYS } from './bark-skin.js';
import { latheToFaces } from './lathe-faces.js';
import { loftToFaces } from './loft-faces.js';
import { surfaceTexture } from '../landscape/surface-textures.js';
import { lowerObjectFaces, WORKBENCH_LIGHT } from '../worlds/workbench.js';

const SHAFT = { axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 40 }, profile: [{ t: 0, radius: 1.6 }, { t: 1, radius: 1.4 }] };
const BRANCH = { path: [[0, 0, 0], [1, 0, 4], [3, 1, 8], [4, 3, 11]], stations: [0, 1 / 3, 2 / 3, 1].map((t) => ({ t, profile: { radius: 1 - 0.6 * t, sides: 8 } })) };

describe('bark-skin', () => {
  it('absent `bark` → the same faces, untouched', () => {
    const f = latheToFaces(SHAFT, { light: WORKBENCH_LIGHT });
    expect(barkLathe(f, SHAFT, WORKBENCH_LIGHT)).toBe(f);
    expect(lowerObjectFaces({ lathes: [SHAFT] }, WORKBENCH_LIGHT).some((x) => x.texture)).toBe(false);
  });
  it('a barked lathe: every side quad carries the key, uv and a lit white fill; caps stay plain', () => {
    const spec = { ...SHAFT, tint: '#6e5238', bark: { species: 'oak', tile: 12 } };
    const f = barkLathe(latheToFaces(spec, { light: WORKBENCH_LIGHT }), spec, WORKBENCH_LIGHT);
    const tex = f.filter((x) => x.texture);
    expect(tex.length).toBeGreaterThan(20);
    expect(tex.every((x) => x.texture === 'bark-oak' && x.textureLit && x.uv.length === 4 && x.plainFill)).toBe(true);
    const vs = tex.flatMap((x) => x.uv.map((u) => u[1]));
    expect(Math.max(...vs)).toBeCloseTo(40 / 12, 1);   // v runs the shaft's height in tiles
  });
  it('a barked curved loft is mapped ring-major: v is arc length, u round the stem', () => {
    const spec = { ...BRANCH, bark: 'beech' };
    const f = barkLoft(loftToFaces(spec, { light: WORKBENCH_LIGHT }), spec, WORKBENCH_LIGHT);
    const tex = f.filter((x) => x.texture);
    expect(tex.length).toBe(3 * 8);
    expect(tex[0].uv[0]).toEqual([0, 0]);
  });
  it('the key resolves to the grown tile; a typo is named', () => {
    expect(surfaceTexture('bark-oak')).toMatch(/^data:image\/png;base64,/);
    expect(surfaceTexture('bark-nope')).toBeNull();
    expect(validateBark('oak')).toBeNull();
    expect(validateBark('mahogany')).toContain(BARK_KEYS.join(', '));
    expect(validateBark({ species: 'oak', tile: -1 })).toContain('tile');
  });
});
