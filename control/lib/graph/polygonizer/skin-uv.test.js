/**
 * Recipe-emitted UVs, ring-stack family (skin-over-mesh.plan.md phase 1).
 *
 * Two producers, one contract: a lathe `wrap` widened to a full surface skin
 * (`lit` + `repeat`), and a figure `manifest.skin` that stamps every flesh
 * ring-stack with its own cylindrical parameterization through litFaces.
 * Absent the opt-ins, output is byte-identical — the phase-0 char net pins
 * the world; these tests pin the seam itself.
 */
import { describe, expect, it } from 'vitest';

import { latheToFaces } from './lathe-faces.js';
import { figureRigSamples } from './figure-render.js';
import { collectFaceTextures, SURFACE_TEXTURE_KEYS } from '../landscape/surface-textures.js';

const cylinder = {
  axisFrom: { x: 0, y: 0, z: 0 },
  axisTo: { x: 0, y: 0, z: 4 },
  profile: [{ t: 0, radius: 1 }, { t: 1, radius: 1 }],
  crossSections: 6,
  samples: 12,
};

describe('lathe wrap — full-surface skin (lit + repeat)', () => {
  it('wrap without band covers every wall face; caps stay untextured', () => {
    const faces = latheToFaces({ ...cylinder, wrap: { texture: 'marble-carrara' } });
    const walls = faces.filter((f) => f.texture);
    expect(walls.length).toBe(6 * 12);                       // all wall quads
    expect(faces.length - walls.length).toBe(2 * 12);        // both cap fans untextured
  });

  it('`lit: true` stamps textureLit on band faces; absent it, the sticker stays unlit', () => {
    const lit = latheToFaces({ ...cylinder, wrap: { texture: 't', lit: true } });
    expect(lit.filter((f) => f.texture).every((f) => f.textureLit === true)).toBe(true);
    const sticker = latheToFaces({ ...cylinder, wrap: { texture: 't' } });
    expect(sticker.some((f) => f.textureLit)).toBe(false);
  });

  it('`repeat` multiplies the cylindrical uv; default output is byte-identical to no-repeat', () => {
    const plain = latheToFaces({ ...cylinder, wrap: { texture: 't' } });
    const one = latheToFaces({ ...cylinder, wrap: { texture: 't', repeat: { u: 1, v: 1 } } });
    expect(one).toEqual(plain);                              // ×1 is exact in IEEE — same bytes
    const tiled = latheToFaces({ ...cylinder, wrap: { texture: 't', repeat: { u: 3, v: 2 } } });
    const p = plain.find((f) => f.uv), q = tiled.find((f) => f.uv);
    expect(q.uv.map(([u]) => u)).toEqual(p.uv.map(([u]) => u * 3));
    expect(q.uv.map(([, v]) => v)).toEqual(p.uv.map(([, v]) => v * 2));
  });

  it('u stays monotonic around the ring (RepeatWrapping owns the seam — never a mirror)', () => {
    const faces = latheToFaces({ ...cylinder, wrap: { texture: 't' }, samples: 8 }, { caps: false });
    for (const f of faces) {
      expect(f.uv[1][0]).toBeGreaterThan(f.uv[0][0]);        // u1 > u0 on every cell
    }
  });
});

describe('figure manifest.skin — flesh ring-stacks carry their own UVs', () => {
  it('absent skin: no face carries texture/uv keys (the byte-identical guard)', () => {
    const { restFaces } = figureRigSamples({});
    expect(restFaces.some((f) => 'texture' in f || 'uv' in f || 'textureLit' in f)).toBe(false);
  });

  it('with skin: flesh faces carry texture + 4-corner uv, multiply-lit by default', () => {
    const { restFaces } = figureRigSamples({ skin: { texture: 'marble-carrara' } });
    const skinned = restFaces.filter((f) => f.texture);
    expect(skinned.length).toBeGreaterThan(0);
    for (const f of skinned.slice(0, 50)) {
      expect(f.texture).toBe('marble-carrara');
      expect(f.uv).toHaveLength(4);
      expect(f.uv.flat().every(Number.isFinite)).toBe(true);
      expect(f.textureLit).toBe(true);
    }
  });

  it('`lit: false` opts back to the unlit sticker', () => {
    const { restFaces } = figureRigSamples({ skin: { texture: 't', lit: false } });
    const skinned = restFaces.filter((f) => f.texture);
    expect(skinned.length).toBeGreaterThan(0);
    expect(skinned.some((f) => f.textureLit)).toBe(false);
  });

  it('garment faces keep their own paint — a dressed figure has both skinned and plain faces', () => {
    const { restFaces } = figureRigSamples({ skin: { texture: 't' }, garment: 'tee' });
    expect(restFaces.some((f) => f.texture)).toBe(true);
    expect(restFaces.some((f) => !f.texture)).toBe(true);
  });

  it('uv is a normalized cylindrical grid: v spans 0→1 along each stack, u wraps 0→1', () => {
    const { restFaces } = figureRigSamples({ skin: { texture: 't' } });
    const uvs = restFaces.filter((f) => f.uv).flatMap((f) => f.uv);
    for (const [u, v] of uvs) {
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1 + 1e-9);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('`repeat` scales the grid for the repeat texture family', () => {
    const { restFaces } = figureRigSamples({ skin: { texture: 't', repeat: { u: 4, v: 4 } } });
    const us = restFaces.filter((f) => f.uv).flatMap((f) => f.uv).map(([u]) => u);
    expect(Math.max(...us)).toBeGreaterThan(3.9);            // grid scaled up, wrap resolves it
  });

  it('the World texture collector resolves the skin key to a data URL (the transport seam)', () => {
    expect(SURFACE_TEXTURE_KEYS).toContain('marble-carrara');
    const { restFaces } = figureRigSamples({ skin: { texture: 'marble-carrara' } });
    const textures = collectFaceTextures(restFaces, {});
    expect(textures['marble-carrara']).toMatch(/^data:image\/png;base64,/);
  });
});
