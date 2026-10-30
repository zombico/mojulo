// The realistic face EVEN (realistic laws 13, head-relational.js EVEN_FACE): held by its principles, not its bytes. On
// one realistic hero, from the front the face narrows from the temple to the jaw and nothing ahead of the ear stands
// wider than the vault behind it; the even face is offsets over the face's own relations, kept in the head's fit.
import { describe, it, expect } from 'vitest';
import { expandLayeredManifest, heroRecord } from '../../mcp/tools/layered.js';
import { EVEN_FACE, evenFace, RELATIONS, RELATION_POLES } from './head-relational.js';
import { compileLayered } from './station-loft.js';

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
  it('runs the throat in one slope from under the chin to the chest (body-relational-builds.js THROAT_LINE)', () => {
    // (the midline's front, the skin's furthest forward at each height: from 40 mm under the chin to 200 mm, nothing more
    // than 2.5 mm ahead of the straight line between them, where the neck's base had tented 9 mm past it)
    const M = compileLayered(recipe), V = M.vertices, part = (i) => M.provenance[i].part;
    const mid = V.map((_, i) => i).filter((i) => Math.abs(V[i][0]) < 0.008 && !/^(hair|hairCards|globe|mouth|teeth|tongue|ear)/.test(part(i)));
    const chinZ = Math.min(...mid.filter((i) => part(i) === 'headSkin' && V[i][1] > 0.06).map((i) => V[i][2]));
    const front = (dz) => Math.max(...mid.filter((i) => Math.abs(V[i][2] - (chinZ - dz)) < 0.004).map((i) => V[i][1]));
    const a = front(0.04), b = front(0.2);
    for (let dz = 0.06; dz < 0.2; dz += 0.02) expect(front(dz)).toBeLessThan(a + ((b - a) * (dz - 0.04)) / 0.16 + 0.0025);
  });
});
