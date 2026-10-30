// face-paint — the anime hero's painted face: the features as layers on the face's front plane, painted to a texture on
// read; the face a smooth skin with no slab; the World faces textured where the texture covers the face; absent, nothing.
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest, validateHeroSpec } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';
import { characterLitFaces, characterLitPieces, layeredShadingNormals, resolveCharacterLight, derivedShade, PAINTERLY_SOFT } from './station-loft-shade.js';
import { toonLightErrors } from './vexar.js';
import { faceTexture, facePaintOf, texOf, FACE_PAINT_WINDOW, PAINT_KINDS } from './face-paint.js';
import { faceListToMesh } from '../figures/face-mesh.js';

const SLABS = /^(iris|pupil|lid|brow|lashLow|catch)[RL]$|^noseLine$/;
const built = (spec) => { const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ head: 'anime', ...spec }) }); return { m, mesh: compileLayered(m.recipe, m.dials || {}, m.channels || {}) }; };
const female = built({ cast: 'female', painterly: true }), slab = built({ cast: 'female' });

describe('the painted face', () => {
  it('is the anime head\'s, and only true', () => {
    expect(validateHeroSpec({ cast: 'female', painterly: true })[0]).toMatch(/painterly: the painterly look is the anime head's/);
    expect(validateHeroSpec({ cast: 'female', head: 'anime', painterly: 'yes' })[0]).toMatch(/painterly: true is the painterly toon look/);
    expect(heroRecord({ cast: 'female', head: 'anime', painterly: true }).painterly).toBe(true);
    expect('painterly' in heroRecord({ cast: 'female', head: 'anime' })).toBe(false);
  });

  it('a smooth face, no slab: the white and the mouth leave the face part, every feature part is gone but the brow block', () => {
    const P = female.m.recipe.parts;
    // (the brow block over the painted brow, drawn through the fringe in the brow's colour, unlit)
    expect(Object.keys(P).filter((n) => SLABS.test(n)).sort()).toEqual(['browL', 'browR']);
    for (const n of ['browL', 'browR']) { expect(P[n].through).toBe('fringe'); expect(P[n].group).toBe('Brow'); }
    expect(female.m.recipe.palette.Brow).toMatch(/^#[0-9a-f]{6}$/);
    expect(Object.keys(slab.m.recipe.parts).filter((n) => SLABS.test(n)).length).toBeGreaterThan(8);
    expect(new Set(Object.values(P.face.groups ?? {}))).not.toContain('Sclera');
    expect(female.mesh.faces.length).toBeLessThan(slab.mesh.faces.length - 4000);
  }, 120000);

  it('the face\'s lattice by tier: thinned below a close-up, whole at one; the texture the same either way', () => {
    const dense = built({ cast: 'female', painterly: true, target: { resolution: '1080p', framing: 'close' } });
    const n = (x) => x.mesh.faces.filter((t) => x.mesh.provenance[t[0]].part === 'face').length;
    expect(n(female)).toBeLessThan(n(dense) * 0.6);   // (the nose dials' own rows and columns kept in both)
    expect(faceTexture(female.m.recipe.parts.face.paint, female.m.recipe.palette).key).toBe(faceTexture(dense.m.recipe.parts.face.paint, dense.m.recipe.palette).key);
  }, 120000);

  it('the layers: every feature projected, in painting order, inside the window', () => {
    const { layers, faces, uv } = female.m.recipe.parts.face.paint;
    expect(layers.map((l) => l.kind)).toEqual(PAINT_KINDS.filter((k) => layers.some((l) => l.kind === k)));
    for (const k of ['sclera', 'iris', 'pupil', 'lid', 'brow', 'mouth']) expect(layers.some((l) => l.kind === k), k).toBe(true);
    for (const l of layers) for (const q of l.tris) expect(q >= 0 && q <= 4096, l.kind).toBe(true);
    expect(faces.length).toBeGreaterThan(500);
    for (const t of Object.values(uv)) expect(t[0] >= 0 && t[0] <= 1 && t[1] >= 0 && t[1] <= 1).toBe(true);
    expect(texOf([FACE_PAINT_WINDOW.x[0], FACE_PAINT_WINDOW.y[1]])).toEqual([0, 1]);
  }, 120000);

  it('the features sit where the slab face puts them: the eyes, the mouth\'s width and the head the same (the nose dials move only the depth and the jaw)', () => {
    const fm = (x) => x.m.plan.include.find((i) => i.name === 'head').faceMeasures, a = fm(female), b = fm(slab);
    // (to the millimetre, as the readout rounds them: under hero laws 19 the female's shorter chin moves her rows, so the
    // painted face's thinned lattice may round a width a millimetre off the slab face's, 0.215 m to 0.216 m)
    for (const k of ['crown_z', 'face_m', 'pupils_m', 'eye_m', 'eyeWidth_m']) expect(Math.abs(a[k] - b[k]), k).toBeLessThanOrEqual(0.001 + 1e-9);
    // (the head is registered as before the jaw lifts its underside, so the crown stands where it stood; the head's height
    // is now to the chin itself, the studio's flat keel no longer hanging below it)
    expect(a.head_m).toBeLessThan(b.head_m); expect(a.head_m).toBeGreaterThan(b.head_m - 0.015);
    for (const k of ['eyeLevel', 'eyeWidth', 'mouthWidth']) expect(a.features[k], k).toBeCloseTo(b.features[k], 2);   // (ratios of the face's height, which the chin moves a hair; the brow and the lid are measured in depth, which the stop moves)
    const eye = female.m.recipe.parts.face.paint.layers.find((l) => l.kind === 'iris').tris;
    const s = eye.filter((_, i) => i % 2 === 0).map((q) => q / 4096);
    expect(Math.min(...s)).toBeLessThan(0.5); expect(Math.max(...s)).toBeGreaterThan(0.5);   // an iris either side of the middle
  }, 120000);

  it('the texture is deterministic: the same layers and palette, the same key and bytes; a palette change, a new key', () => {
    const P = female.m.recipe.parts.face.paint, pal = female.m.recipe.palette;
    const a = faceTexture(P, pal), b = faceTexture(structuredClone(P), { ...pal });
    expect(a.key).toBe(b.key); expect(a.url).toBe(b.url);
    expect(a.url.startsWith('data:image/png;base64,')).toBe(true);
    expect(faceTexture(P, { ...pal, Iris: '#7a3b2a' }).key).not.toBe(a.key);
  }, 120000);

  it('on the World faces: the painted pieces carry the texture, three corners\' uv and the light alone; the rest of the skin as before', () => {
    const { m, mesh } = female, paint = facePaintOf(mesh, m.recipe.palette);
    const normals = layeredShadingNormals(mesh, m.recipe), pieces = characterLitPieces(mesh, { normals, palette: m.recipe.palette });
    const plain = characterLitFaces(mesh, m.recipe, { pieces }), faces = characterLitFaces(mesh, m.recipe, { pieces, paint });
    const tex = faces.filter((f) => f.texture === paint.key);
    expect(tex.length).toBeGreaterThan(1000);
    for (const f of tex) { expect(f.uv).toHaveLength(3); expect(f.textureLit).toBe(true); }
    // a lit piece's light is white: texel × white is the texel, the skin's own colour where the texture is its base
    expect(new Set(tex.map((f) => f.fill))).toContain('#ffffff');
    faces.forEach((f, i) => { if (!f.texture) expect(f).toEqual(plain[i]); });
    // the page's mesh takes textured triangles into the texture's group
    expect(faceListToMesh(tex.slice(0, 10), { decollide: false }).textureGroups[paint.key].uvs.length).toBe(10 * 3 * 2);
    expect(facePaintOf(slab.mesh, slab.m.recipe.palette)).toBeNull();
  }, 120000);
});

describe('the soft edge (light.soft)', () => {
  const area = (P) => { const [a, b, c] = P; const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2; };
  const { m, mesh } = slab;
  const normals = layeredShadingNormals(mesh, m.recipe);
  const light = resolveCharacterLight({ hero: { head: 'anime', cast: 'female' } });

  it('the painterly hero steps over the soft edge; a light that names its own soft keeps it; 0 is the hard step', () => {
    expect(light.soft).toBeUndefined();
    expect(resolveCharacterLight({ hero: { head: 'anime', cast: 'female', painterly: true } }).soft).toBe(PAINTERLY_SOFT);
    expect(resolveCharacterLight({ hero: { head: 'anime', cast: 'female', painterly: true }, toon: { light: { soft: 0.1 } } }).soft).toBe(0.1);
    expect(toonLightErrors({ soft: 2 })[0]).toMatch(/toon.light.soft/);
    const hard = characterLitPieces(mesh, { light, normals, palette: m.recipe.palette });
    expect(characterLitPieces(mesh, { light: { ...light, soft: 0 }, normals, palette: m.recipe.palette })).toEqual(hard);
  }, 120000);

  it('the band: graded corners between the shade and the base, every face\'s pieces covering it exactly; hair keeps its step', () => {
    const soft = characterLitPieces(mesh, { light: { ...light, soft: PAINTERLY_SOFT }, normals, palette: m.recipe.palette });
    const banded = soft.filter((p) => p.soft);
    expect(banded.length).toBeGreaterThan(200);
    for (const p of banded) expect(p.soft).toHaveLength(3);
    expect(banded.every((p) => mesh.groups[p.fi] !== 'Hair')).toBe(true);
    // a band piece's corners run between its group's shade and its base, channel by channel
    const skin = m.recipe.palette.Skin, sh = derivedShade('Skin', skin), ch = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    for (const p of banded.filter((q) => mesh.groups[q.fi] === 'Skin')) for (const c of p.soft) ch(c).forEach((x, i) => { expect(x).toBeGreaterThanOrEqual(Math.min(ch(sh)[i], ch(skin)[i]) - 1); expect(x).toBeLessThanOrEqual(Math.max(ch(sh)[i], ch(skin)[i]) + 1); });
    // the pieces of each face cover it: the same area as the face
    const byFace = new Map(); for (const p of soft) byFace.set(p.fi, (byFace.get(p.fi) || 0) + area(p.refs.map((r) => r.p)));
    let worst = 0; for (const [fi, a] of byFace) { const A = area(mesh.faces[fi].map((v) => mesh.vertices[v])); worst = Math.max(worst, Math.abs(a - A) / A); }
    expect(worst).toBeLessThan(1e-6);
    // and on the page's faces, the band carries its corners' colours
    const faces = characterLitFaces(mesh, m.recipe, { pieces: soft });
    expect(faces.filter((f) => f.cornerFills?.length === 3).length).toBe(banded.length);
  }, 120000);
});

describe('the painterly look as data', () => {
  it('the readout names its built conventions and the planned ones, never claiming one', async () => {
    const { LOOKS, lookReadout } = await import('../era/looks.js');
    const r = lookReadout('painterly-toon');
    expect(r.built).toEqual(expect.arrayContaining(['painted-face', 'soft-edge', 'rim-from-the-air']));
    expect(r.planned).toEqual(expect.arrayContaining(['painted-albedo', 'ribbon-hair']));
    expect(r.built).toContain('painted-face-in-motion');
    expect([...r.built, ...r.planned].length).toBe(LOOKS['painterly-toon'].conventions.length);
  });
});

describe('the nose dials (painterly.nose)', () => {
  const side = (spec) => {   // the face's most forward point at a height (hero metres), per dial
    const { mesh } = built({ cast: 'female', ...spec }), V = mesh.vertices, T = mesh.faces.filter((t) => mesh.provenance[t[0]].part === 'face');
    return (z) => { let y = -Infinity; for (const t of T) { const P = t.map((v) => V[v]); for (let k = 0; k < 3; k++) { const p = P[k], q = P[(k + 1) % 3]; if ((p[2] - z) * (q[2] - z) > 0 || p[2] === q[2]) continue; y = Math.max(y, p[1] + (q[1] - p[1]) * (z - p[2]) / (q[2] - p[2])); } } return y; };
  };
  it('checked by name and range; stored on the record', () => {
    expect(validateHeroSpec({ cast: 'female', head: 'anime', painterly: { nose: { profile: 2 } } })[0]).toMatch(/painterly.nose.profile: a number in 0..1/);
    expect(validateHeroSpec({ cast: 'female', head: 'anime', painterly: { ears: 1 } })[0]).toMatch(/painterly.ears: not a painterly dial/);
    expect(heroRecord({ cast: 'female', head: 'anime', painterly: { nose: { width: 1 } } }).painterly).toEqual({ nose: { width: 1 } });
  });
  it('profile: the cat edge recedes the lower face behind the Zelda-like edge, the nose\'s tip held', () => {
    const cat = side({ painterly: { nose: { profile: 0 } } }), zel = side({ painterly: { nose: { profile: 1 } } }), slabSide = side({});
    const { mesh } = slab, zs = mesh.vertices.map((v) => v[2]), faceZ = mesh.faces.filter((t) => mesh.provenance[t[0]].part === 'face').flatMap((t) => t.map((v) => mesh.vertices[v][2]));
    const bot = Math.min(...faceZ);
    // the mouth's height (about a third of the way up from the chin to the eyes) and the tip's (the slab's most forward point below the eyes)
    expect(cat(bot + 0.03)).toBeLessThan(zel(bot + 0.03) - 0.008);
    let tipZ = bot, tipY = -Infinity; for (let z = bot + 0.04; z < bot + 0.12; z += 0.001) { const y = slabSide(z); if (y > tipY) { tipY = y; tipZ = z; } }
    expect(Math.abs(cat(tipZ) - tipY)).toBeLessThan(0.004); expect(Math.abs(zel(tipZ) - tipY)).toBeLessThan(0.004);
    expect(zs.length).toBeGreaterThan(0);
  }, 240000);
  it('width: the underside painted darker as it widens; its faces carry the texture', () => {
    const lum = (x) => { const P = x.m.recipe.parts.face.paint, L = P.layers.find((l) => l.kind === 'noseUnder'); return L.width; };
    const thin = built({ cast: 'female', painterly: { nose: { width: 0 } } }), wide = built({ cast: 'female', painterly: { nose: { width: 1 } } });
    expect(lum(thin)).toBe(0); expect(lum(wide)).toBe(1);
    expect(faceTexture(thin.m.recipe.parts.face.paint, thin.m.recipe.palette).key).not.toBe(faceTexture(wide.m.recipe.parts.face.paint, wide.m.recipe.palette).key);
    const spread = (x) => { const t = x.m.recipe.parts.face.paint.layers.find((l) => l.kind === 'noseUnder').tris.filter((_, i) => i % 2 === 0); return Math.max(...t) - Math.min(...t); };
    expect(spread(wide)).toBeGreaterThan(2.5 * spread(thin));   // the trapezoid's back edge against the pointer's
  }, 240000);
});

describe('the painted face under a level\'s cast light', () => {
  it('the studio-lit faces carry the texture as the character-lit ones do; without paint, the same faces as before', async () => {
    const { layeredFaces } = await import('./station-loft-faces.js');
    const { heroCastLight } = await import('../era/cast-light.js');
    const lit = built({ cast: 'female', painterly: true, geocube: 'gothic-night' }), light = heroCastLight(lit.m.hero);
    const paint = facePaintOf(lit.mesh, lit.m.recipe.palette);
    const F = layeredFaces(lit.mesh, lit.m.recipe, { light, paint }), tex = F.filter((f) => f.texture);
    expect(tex.length).toBeGreaterThan(500);
    expect(tex.every((f) => f.texture === paint.key && f.uv.length === 3 && f.textureLit)).toBe(true);
    const plain = layeredFaces(lit.mesh, lit.m.recipe, { light });
    expect(plain.length).toBe(F.length);
    expect(plain.some((f) => f.texture)).toBe(false);
  }, 300000);
});
