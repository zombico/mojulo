// The realistic face EVEN (realistic laws 13, head-relational.js EVEN_FACE): held by its principles, not its bytes. On
// one realistic hero, from the front the face narrows from the temple to the jaw and nothing ahead of the ear stands
// wider than the vault behind it; the even face is offsets over the face's own relations, kept in the head's fit.
import { describe, it, expect } from 'vitest';
import { expandLayeredManifest, heroRecord } from '../../mcp/tools/layered.js';
import { EVEN_FACE, evenFace, RELATIONS, RELATION_POLES } from './head-relational.js';

const SPEC = { cast: 'female', form: 'realistic', face: { seed: 11, ethnicity: 'western' } };

describe('the realistic face even (laws 13)', () => {
  const recipe = expandLayeredManifest({ kind: 'layered', hero: heroRecord(SPEC) }).recipe;
  it('narrows from the temple to the jaw, and stands no wider than its vault', () => {
    const P = Object.values(recipe.parts.headSkin.mesh.points), G = Object.values(recipe.parts.globeR.mesh.points);
    const eyeZ = G.reduce((m, p) => m + p[2], 0) / G.length;
    // (the face: ahead of the ear canal's plane; the vault: behind it)
    const vault = Math.max(...P.filter((p) => p[1] < -0.01).map((p) => Math.abs(p[0])));
    const half = (dz) => Math.max(...P.filter((p) => Math.abs(p[2] - (eyeZ + dz)) < 0.004 && p[1] > 0.015).map((p) => Math.abs(p[0])));
    const bands = [0.04, 0.015, 0, -0.02, -0.04, -0.07].map(half);
    for (let i = 1; i < bands.length; i++) expect(bands[i]).toBeLessThan(bands[i - 1] + 0.0005);
    expect(Math.max(...P.filter((p) => p[1] > 0.015).map((p) => Math.abs(p[0])))).toBeLessThanOrEqual(vault);
  });
  it('is the even face\'s offsets over the face\'s own relations, kept in the head\'s fit', () => {
    // (over a face's relations, else its pole's, else the canon's; the rest of the face untouched)
    const R = evenFace({ cheeks: 0.4, nose: 1 }, 'female');
    expect(R.cheeks).toBeCloseTo(0.4 + EVEN_FACE.female.cheeks, 9); expect(R.nose).toBe(1);
    expect(evenFace(null, 'male').jaw).toBeCloseTo(RELATION_POLES.male.jaw + EVEN_FACE.male.jaw, 9);
    expect(evenFace(null, 'male').cheekBack).toBeCloseTo(RELATIONS.cheekBack + EVEN_FACE.male.cheekBack, 9);
    expect(recipe.headFit.relations.cheekBack).toBeCloseTo(EVEN_FACE.female.cheekBack, 9);
  });
});
