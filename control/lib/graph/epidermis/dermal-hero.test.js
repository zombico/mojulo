// The realistic hero's skin as an export and the World page wear it (dermal-hero.js), on one dressed hero at a small page: what it wears
// covers its skin (rays out along the normal, a garment on the same bone or one near it; never a hand by the trousers),
// the body's islands keep only the rings that show, each kept ring's address the whole part's, and a covered face takes
// no texel; the bake's occlusion (polygonizer/surface-bake.js) cast by what is seen alone, on the field's normals.
// (Beside the module, not in the critical tier: a realistic mint takes seconds.)
import { describe, it, expect, beforeAll } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { coveredSkin, heroDermis, heroHidden, heroSkinPaint, GLOBE } from './dermal-hero.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { bakeChannels } from '../polygonizer/surface-bake.js';
import { layeredShadingNormals } from '../polygonizer/station-loft-shade.js';
import { bodyChart } from './dermal-body.js';

let mesh, recipe, cov;
beforeAll(() => {
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic', outfit: ['fittedShirt', 'trousers'] }) });
  recipe = m.recipe; mesh = compileLayered(m.recipe, m.dials); cov = coveredSkin(mesh, recipe);
}, 240_000);
const share = (part) => { let n = 0, c = 0; mesh.provenance.forEach((p, v) => { if (p.part === part) { n++; c += cov[v]; } }); return c / n; };

describe('the skin under what the hero wears', () => {
  it('is covered where the cloth lies over it, and a hand by the trousers is not', () => {
    for (const p of ['torso', 'pelvis', 'upperArmR', 'thighL']) expect(share(p), p).toBeGreaterThan(0.85);
    expect(share('handR')).toBe(0);
    expect(coveredSkin(compileLayered(expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic' }) }).recipe), recipe)).toBeNull();
  });

  it('keeps off the atlas: the islands are the runs of rings that show, each ring addressed on its whole part', () => {
    const full = bodyChart(mesh, recipe), cut = bodyChart(mesh, recipe, { shown: (v) => !cov[v] });
    const rings = (C, k) => Object.values(C.islands).filter((I) => I.key === k).reduce((s, I) => s + I.b - I.a + 1, 0);
    expect(rings(cut, 'torso')).toBeLessThan(full.islands.torso.M / 4);
    expect(rings(cut, 'thighR')).toBeLessThan(full.islands.thighR.M / 4);
    expect(rings(cut, 'handR')).toBe(full.islands.handR.M);
    cut.where.forEach((w, v) => { if (w && w.pole === undefined) expect(cut.samples[v].along).toBe(full.samples[v].along); });
    expect(cut.where.filter(Boolean).length).toBeLessThan(full.where.filter(Boolean).length / 2);
  });

  it('wears a texel only where it shows: a covered face, and the suit\'s shoes, keep their colour', () => {
    const H = heroDermis(mesh, recipe, { dermis: recipe.dermis, page: 256, headPage: 128 });
    // (a covered face in a run that shows, a ring beside the collar, keeps its texel: most take none)
    let covered = 0, bare = 0, hands = 0, shoes = 0;
    mesh.faces.forEach((t, fi) => {
      const part = mesh.provenance[t[0]].part, f = H.faceOf(fi);
      if (part === 'torso' && t.every((v) => cov[v])) { covered++; if (!f) bare++; }
      if (part === 'handR') { hands++; expect(f?.page).toBe('body'); }
      if (part === 'footR') { shoes++; expect(f).toBeNull(); }
    });
    expect(covered).toBeGreaterThan(1000); expect(bare / covered).toBeGreaterThan(0.85); expect(hands).toBeGreaterThan(0); expect(shoes).toBeGreaterThan(0);
  });

  it('casts the bake\'s shadow from what is seen: the head\'s layers under one another and the eyes\' globes cast none', () => {
    const hid = heroHidden(mesh, recipe), part = (v) => mesh.provenance[v].part;
    mesh.faces.forEach((t, fi) => { if (GLOBE.test(mesh.groups[fi])) for (const v of t) expect(hid[v]).toBe(1); });
    const count = (k) => mesh.provenance.reduce((n, p, v) => n + (p.part === k && hid[v] ? 1 : 0), 0);
    expect(count('cranium')).toBeGreaterThan(50);   // under the face
    expect(count('torso') + count('handR')).toBe(0);
    // the seen corners: the lids buried less once the globes and the layers under them cast nothing; the jaw over the
    // neck's seam no longer read as a fold once its normals are the field's
    const before = bakeChannels(mesh), after = bakeChannels(mesh, { hidden: hid, normals: layeredShadingNormals(mesh, recipe, { proxy: false }) });
    const read = (ch, k, f) => { let s = 0, n = 0; mesh.provenance.forEach((p, v) => { if (p.part === k && !hid[v]) { s += f(ch.occlusion[v]); n++; } }); return s / n; };
    // (the lids: the face's skin about the globes, one skin with them)
    const lid = new Set(); mesh.faces.forEach((t, fi) => { if (GLOBE.test(mesh.groups[fi])) for (const v of t) lid.add(v); });
    const lids = new Set(); mesh.faces.forEach((t, fi) => { if (!GLOBE.test(mesh.groups[fi]) && t.some((v) => lid.has(v))) for (const v of t) if (!lid.has(v)) lids.add(v); });
    const readLids = (ch) => { let s = 0, n = 0; for (const v of lids) if (!hid[v]) { s += ch.occlusion[v]; n++; } return s / n; };
    expect(lids.size).toBeGreaterThan(20);
    expect(readLids(after)).toBeLessThan(readLids(before) * 0.85);
    expect(read(after, 'jaw', (o) => o > 0.5)).toBeLessThan(read(before, 'jaw', (o) => o > 0.5) / 2);
  }, 240_000);
  it('is on the World page: its skin faces textured by the atlas, lit by their fill over the skin\'s colour', async () => {
    const P = heroSkinPaint(mesh, recipe, { page: 512, headPage: 512 });
    expect(P.light(recipe.palette.Skin)).toBe('#ffffff');
    // (a face lit to half the skin's colour is half lit, its texel carrying the colour)
    const half = '#' + [1, 3, 5].map((i) => parseInt(recipe.palette.Skin.slice(i, i + 2), 16)).map((c) => Math.round(255 * ((((c / 255 + 0.055) / 1.055) ** 2.4 * 0.5) ** (1 / 2.4) * 1.055 - 0.055))).map((c) => c.toString(16).padStart(2, '0')).join('');
    expect(Math.abs(parseInt(P.light(half).slice(1, 3), 16) - 186)).toBeLessThan(4);
    const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic', outfit: ['fittedShirt', 'trousers'] }) });
    const { payload } = await resolveWorldScene({ ref: 'skin-page', title: 'skin', manifest: m });
    expect(Object.keys(payload.textures)).toContain('heroSkin');
    const lit = payload.faces.filter((f) => f.texture === 'heroSkin');
    expect(lit.length).toBeGreaterThan(1000);
    expect(lit.every((f) => f.textureLit && f.uv.length === 3)).toBe(true);
    // (the page's atlas: the body's page a size down from an export's, the head's twice it, the atlas as wide as it)
    expect(payload.figures.body.paintTex.w).toBe(2048);
  }, 600_000);
  it('lays a head page wider than the body\'s beside white: the atlas the head\'s width, the body\'s corners in its left', () => {
    const P = heroSkinPaint(mesh, recipe, { page: 256, headPage: 512 });
    expect(P.atlas.w).toBe(512);
    let body = 0;
    mesh.faces.forEach((t, fi) => { if (P.painted(fi) && !/^(cranium|jaw|visage|nose|eye[RL]|ear[RL])$/.test(mesh.provenance[t[0]].part)) { body++; for (const vi of t) expect(P.uvAt({ vi })[0]).toBeLessThanOrEqual(0.5); } });
    expect(body).toBeGreaterThan(100);
  }, 240_000);
});

