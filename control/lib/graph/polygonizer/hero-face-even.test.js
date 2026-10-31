// The realistic face EVEN (realistic laws 14, head-relational.js EVEN_FACE): held by its principles, not its bytes. On
// one realistic hero, from the front the face narrows from the temple to the jaw and nothing ahead of the ear stands
// wider than the vault behind it; the even face is offsets over the face's own relations, kept in the head's fit.
import { describe, it, expect } from 'vitest';
import { expandLayeredManifest, heroRecord } from '../../mcp/tools/layered.js';
import { EVEN_FACE, evenFace, RELATIONS, RELATION_POLES, relationalHead, raisedEar } from './head-relational.js';
import { compileLayered } from './station-loft.js';

const SPEC = { cast: 'female', form: 'realistic', face: { seed: 11, ethnicity: 'western' } };

describe('the realistic face even (laws 14)', () => {
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

describe('the globe covered (laws 14, head-relational-eye.js `cover`)', () => {
  // (the skin all round the eye's globe but through the opening, whatever the face and the sex: every point of the globe's
  // surface below it, out past its outer corner and in toward the nose lies under the skin; the field read, nothing minted)
  for (const sex of ['female', 'male']) it(`${sex}: the globe's flank never bare`, () => {
    const H = relationalHead({ sex, seat: 2, relations: evenFace(raisedEar(null, sex), sex), globes: false }), G = H.globes.find((g) => g.side === 'R');
    const c = [G.centre.x, G.centre.y, G.centre.z], at = (q) => H.field({ x: q[0], y: q[1], z: q[2] }), out = Math.sign(c[0]) || 1;
    // (the globe's surface along a direction: its own field's zero, by halving)
    const surface = (d) => { let lo = 0, hi = 1; while (G.field({ x: c[0] + d[0] * hi, y: c[1] + d[1] * hi, z: c[2] + d[2] * hi }) < 0) hi *= 2; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (G.field({ x: c[0] + d[0] * m, y: c[1] + d[1] * m, z: c[2] + d[2] * m }) < 0) lo = m; else hi = m; } return c.map((x, k) => x + d[k] * lo); };
    const dir = (az, el) => { const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180; return [out * Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)]; };
    const bare = [];
    for (const [az, el] of [[0, -60], [20, -65], [-20, -65], [0, -75], [80, 0], [80, -20], [80, 20], [-75, 0], [-75, -20]]) if (at(surface(dir(az, el))) > 0) bare.push([az, el]);
    expect(bare).toEqual([]);
  });
});
