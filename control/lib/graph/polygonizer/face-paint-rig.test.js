// face-paint-rig — the painted face in motion: every drawing the hero's words, authored face and clip keys need, a tile of
// one atlas; the painted face's triangles over each region a shell per drawing; one target per drawing, 0 or 1; the pack
// carries the atlas and the UVs, the GLB a textured figure; absent `painterly`, nothing.
import { describe, it, expect } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from './station-loft.js';
import { validateRig, bindLayered, packLayeredRig } from './station-loft-rig.js';
import { resolveCharacterLight } from './station-loft-shade.js';
import { facePaintOf, faceAtlas } from './face-paint.js';
import { paintFaceRig, paintFaceBase } from './face-paint-rig.js';
import { faceWeights, faceState } from './anime-face-rig.js';
import { heroFaceTracks } from './anime-face-tracks.js';
import { ANIME_POSES, resolveAnimeExpression } from './anime-head.js';

const built = (spec) => { const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ head: 'anime', hair: 'none', ...spec }) }); return { m, mesh: compileLayered(m.recipe, m.dials || {}, m.channels || {}) }; };
const female = built({ cast: 'female', painterly: true, expression: 'smile' });
const paint = facePaintOf(female.mesh, female.m.recipe.palette);
const rig = paintFaceRig(female.m, female.mesh, paint);
const groupOf = (t) => (t.startsWith('blink') ? `eye${t.at(-1)}` : t.startsWith('brow') ? `brow${t.at(-1)}` : 'mouth');

describe('the painted face in motion', () => {
  it('a target per drawing: each eye at every knot past open, each brow and the mouth at every drawing a word or the face draws', () => {
    expect(new Set(rig.targets).size).toBe(rig.targets.length);
    for (const s of ['L', 'R']) expect(rig.targets.filter((t) => t.startsWith('blinkDrawn') && t.endsWith(s))).toEqual(['10', '12', '18', '20', '50', '100'].map((k) => `blinkDrawn${k}${s}`));
    expect(rig.targets.some((t) => t.startsWith('mouthDrawn'))).toBe(true);
    expect(rig.targets.some((t) => t.startsWith('browDrawn'))).toBe(true);
    expect(rig.meta.pairs.every((p) => /^eye(L|R)\+brow\1$/.test(p))).toBe(true);   // a face under two regions: an eye and its brow
  }, 300000);

  it('every word is drawings: weights 0 or 1, one drawing a region at most; the authored face its word\'s', () => {
    const words = rig.meta.words;
    expect(Object.keys(words)).toEqual([...Object.keys(ANIME_POSES), 'authored']);
    for (const w of Object.values(words)) {
      expect(w.every((x) => x === 0 || x === 1)).toBe(true);
      const per = {}; w.forEach((x, i) => { if (x) per[groupOf(rig.targets[i])] = (per[groupOf(rig.targets[i])] || 0) + 1; });
      expect(Object.values(per).every((n) => n === 1)).toBe(true);
    }
    expect(words.authored).toEqual(words.smile);
    expect(words.neutral.every((x) => x === 0)).toBe(true);
    const on = (w) => rig.targets.filter((_, i) => words[w][i]);
    expect(on('blink')).toEqual(['blinkDrawn100L', 'blinkDrawn100R']);
    expect(on('deadpan')).toEqual(['blinkDrawn50L', 'blinkDrawn50R']);
    expect(on('open').some((t) => t.startsWith('mouthDrawn'))).toBe(true);
    // the tracks draw through the same weights (faceWeights delegates to the rig's own)
    expect(faceWeights(faceState(resolveAnimeExpression('happy')), rig.K)).toEqual(words.happy);
    const T = heroFaceTracks(female.m.hero, female.m.recipe.clips, null, rig.authored, rig.K);
    expect(T.ambient.w.every((w) => w.length === rig.targets.length && w.every((x) => x === 0 || x === 1))).toBe(true);
    expect(T.ambient.w.some((w) => w[rig.targets.indexOf('blinkDrawn100L')] === 1)).toBe(true);
  }, 300000);

  it('the pack: UVs on every corner, the atlas on the figure, the shells\' rows; the World page\'s the authored face alone', () => {
    const R = validateRig(female.m.recipe.rig), skin = bindLayered(female.mesh, female.m.recipe, R), light = resolveCharacterLight(female.m);
    const P = packLayeredRig(female.mesh, skin, R, { character: { light, palette: female.m.recipe.palette }, paint: rig.pack });
    expect(P.paintTex.url.startsWith('data:image/png;base64,')).toBe(true);
    let morphs = 0;
    for (const part of P.parts.filter(Boolean)) {
      const n = Buffer.from(part.pos, 'base64').length / 12;
      expect(Buffer.from(part.uv, 'base64').length / 8).toBe(n);
      if (part.morph) { const i = Buffer.from(part.morph.i, 'base64').length / 4, d = Buffer.from(part.morph.d, 'base64').length / 4; expect(d).toBe(i * (1 + rig.targets.length) * 3); morphs += i; }
    }
    expect(morphs).toBeGreaterThan(1000);
    // the page: no drawings, no morphs; without paint, no UVs and no texture
    const page = packLayeredRig(female.mesh, skin, R, { character: { light, palette: female.m.recipe.palette }, paint: paintFaceBase(female.m, paint) });
    expect(page.parts.filter(Boolean).some((p) => p.morph)).toBe(false);
    expect(page.paintTex.w).toBe(1024);
    const plain = packLayeredRig(female.mesh, skin, R, { character: { light, palette: female.m.recipe.palette } });
    expect(plain.paintTex).toBeUndefined();
    expect(plain.parts.filter(Boolean).some((p) => p.uv)).toBe(false);
  }, 300000);

  it('the atlas is deterministic, and the rig refuses a row whose face it no longer paints', () => {
    const L = female.m.recipe.parts.face.paint.layers;
    expect(faceAtlas({ layers: L }, [], female.m.recipe.palette).key).toBe(faceAtlas({ layers: structuredClone(L) }, [], { ...female.m.recipe.palette }).key);
    const stale = structuredClone(female.m); stale.recipe.parts.face.paint.layers = L.filter((l) => l.kind !== 'mouth');
    expect(paintFaceRig(stale, female.mesh, paint).skipped).toMatch(/regenerate the row/);
    const slab = built({ cast: 'female' });
    expect(paintFaceRig(slab.m, slab.mesh, facePaintOf(slab.mesh, slab.m.recipe.palette))).toBeNull();
  }, 300000);
});

describe('under a level\'s cast light (the plain path)', () => {
  it('the moving figure wears its palette, not the grey fallback, and its painted face with its drawings', async () => {
    const { heroCastLight } = await import('../era/cast-light.js');
    const cube = built({ cast: 'female', painterly: true, geocube: 'gothic-night' }), cast = heroCastLight(cube.m.hero);
    const R = validateRig(cube.m.recipe.rig), skin = bindLayered(cube.mesh, cube.m.recipe, R), paint = facePaintOf(cube.mesh, cube.m.recipe.palette);
    const r = paintFaceRig(cube.m, cube.mesh, paint);
    const colours = (P) => { const s = new Set(); for (const part of P.parts.filter(Boolean)) { const c = Buffer.from(part.col, 'base64'); for (let i = 0; i < c.length; i += 3) s.add(`${c[i]},${c[i + 1]},${c[i + 2]}`); } return s; };
    const grey = packLayeredRig(cube.mesh, skin, R, { cast }), coloured = packLayeredRig(cube.mesh, skin, R, { cast, palette: cube.m.recipe.palette, paint: r.pack });
    expect(colours(coloured).size).toBeGreaterThan(colours(grey).size);
    let morphs = 0;
    for (const part of coloured.parts.filter(Boolean)) {
      expect(Buffer.from(part.uv, 'base64').length / 8).toBe(Buffer.from(part.pos, 'base64').length / 12);
      if (part.morph) morphs += Buffer.from(part.morph.i, 'base64').length / 4;
    }
    expect(morphs).toBeGreaterThan(1000);
    expect(grey.parts.filter(Boolean).some((p) => p.uv || p.morph)).toBe(false);
  }, 300000);
});
