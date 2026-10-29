// cloth-relief.test.js — the realistic hero's clothes as material (realistic laws 12), on one hero in a leather flight
// jacket minted at the L0 rung (the cheapest skin and map): a hero minted now carries it, one minted before does not; a
// face's cloth is its part's word, else the outfit's language by its layer, else its group's; every garment tube's face
// lies on its island and the hard goods on their cloth's swatch, never a skin face; the atlas without a chart is the one
// before; the creases bend the map at the elbow's crook and nowhere far from a bend; the ORM is each cloth's (the
// leather satin, the buckle metal, the skin the export's own); the same bytes on a rebuild; the lit skinned GLB writes the
// ORM as metallicRoughness and occlusion beside the normal map and the parallax's depth map in its extras, and the unlit
// export neither; a knit lies under its surface, column by column; a pattern is woven as it is made (a houndstooth's
// repeat, a stripe's share of its period), its words the module's and refused when unknown; a stripe runs straight down
// a tube (each slot's share of the turn eased ring to ring).
// (Beside the module, not in the critical tier: a realistic mint takes seconds.)
import { describe, it, expect, beforeAll } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { layeredShadingNormals } from '../polygonizer/station-loft-shade.js';
import { validateRig, bindLayered, packLayeredRig } from '../polygonizer/station-loft-rig.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { outfitLanguage } from '../outfit/expand.js';
import { heroSkinPaint } from './dermal-hero.js';
import { heroRelief } from './dermal-relief.js';
import { clothOnRecord, clothOf, clothChart, clothBake, CLOTHS, SKIN_ROUGH, CLOTH_LAWS, PATTERNS, patternOf, patternAt, knitAt } from './cloth-relief.js';
import { PATTERN_WORDS, CLOTH_WORDS, validateOutfitCard, SEEDED_OUTFITS } from '../outfit/styles.js';
import { emitUnrealAsset } from '../scene/unreal-project.js';

const PAGES = { page: 256, headPage: 256 };
const FLIGHT = { type: 'outfit', style: 'flight' };
let m, mesh, chart, paint, normals, R;
beforeAll(() => {
  m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic', outfit: FLIGHT, target: { resolution: '1080p', framing: 'third-person' } }) });
  mesh = compileLayered(m.recipe, m.dials);
  chart = clothChart(mesh, m.recipe, { language: outfitLanguage(FLIGHT) });
  paint = heroSkinPaint(mesh, m.recipe, { ...PAGES, cloth: chart });
  normals = layeredShadingNormals(mesh, m.recipe, { proxy: false });
  R = heroRelief(mesh, m.recipe, paint, normals);
}, 600_000);

const glbJson = (bytes) => { const jl = bytes.readUInt32LE(12); return JSON.parse(bytes.subarray(20, 20 + jl).toString('utf8')); };
const partOf = (fi) => mesh.provenance[mesh.faces[fi][0]].part;

describe('the realistic hero\'s cloth relief', () => {
  it('rides a hero minted under laws 12; one minted before carries none', () => {
    expect(m.hero.physique.laws).toBeGreaterThanOrEqual(CLOTH_LAWS);
    expect(clothOnRecord(m.hero)).toBe(true);
    expect(clothOnRecord({ ...m.hero, physique: { ...m.hero.physique, laws: CLOTH_LAWS - 1 } })).toBe(false);
    expect(clothOnRecord({ ...m.hero, form: 'tiered' })).toBe(false);
  });

  it('a face\'s cloth: its part\'s word, else the outfit\'s language by its layer, else its group\'s', () => {
    expect(clothOf('Outer', { cloth: 'leather' })).toBe('leather');
    expect(clothOf('Outer', {}, { outer: { family: 'woven' } })).toBe('wool');
    expect(clothOf('Top', {}, { top: { family: 'knit' } })).toBe('jersey');
    expect(clothOf('Top', {}, { top: { family: 'woven' } })).toBe('cotton');
    expect(clothOf('Bottom', {}, { bottom: { kind: 'skirt' } })).toBe('wool');
    expect(clothOf('Bottom', {}, { bottom: { family: 'woven' } })).toBe('twill');
    expect(clothOf('Brass')).toBe('brass');
    expect(CLOTHS[clothOf('Buckle')].metal).toBe(1);
  });

  it('charts every garment tube\'s face on its island, the hard goods on a swatch, never the skin\'s', () => {
    expect(chart.islands.map((I) => I.part)).toContain('outer_armR');
    expect(chart.islands.find((I) => I.part === 'outer_armR').cloth).toBe('leather');
    let onIsland = 0, onSwatch = 0;
    mesh.faces.forEach((_, fi) => {
      const f = chart.faceOf(fi), part = partOf(fi);
      if (mesh.groups[fi] === 'Skin') { expect(f, part).toBeNull(); return; }
      if (!f) return;
      if (f.island !== undefined) {
        onIsland++; const I = chart.islands[f.island];
        expect(I.part).toBe(part);
        for (const [u, s] of f.uv) { expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThanOrEqual(I.width); expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(I.length + 1e-9); }
      } else onSwatch++;
    });
    expect(onIsland).toBeGreaterThan(1000); expect(onSwatch).toBeGreaterThan(0);
    // (the swatches hold the hard goods: the buckle's metal among them)
    expect(chart.swatches.map((s) => s.cloth)).toContain('steel');
  });

  it('lays the cloth faces on the atlas\'s cloth page, under the strands; without a chart, the atlas as before', () => {
    const row = paint.cloth.row / paint.pages.H;
    let n = 0;
    mesh.faces.forEach((_, fi) => { const c = paint.clothUV(fi); if (!c) return; n++; for (const [s, t] of c) { expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThanOrEqual(1); expect(1 - t).toBeGreaterThanOrEqual(row - 1e-6); expect(t).toBeGreaterThanOrEqual(0); } });
    expect(n).toBeGreaterThan(1000);
    const before = heroSkinPaint(mesh, m.recipe, PAGES);
    expect(before.clothUV).toBeUndefined(); expect(before.pages.cloth).toBeUndefined();
    expect(before.pages.H).toBe(paint.pages.H - paint.pages.cloth[1]);
  });

  it('creases where the body bends: the trousers\' map turns most behind the knee, on the side that folds', () => {
    // (the twill: no wear of its own, so what turns the map off a seam is the bend's)
    const page = paint.cloth.page, B = clothBake(chart, page, m.recipe), I = chart.islands.findIndex((x) => x.part === 'bottom_legR'), isl = chart.islands[I], p = page.place[I], P = m.recipe.parts.bottom_legR;
    const t = page.texel * p.k, knee = m.recipe.rig.joints.kneeR.at, d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const near = isl.C.reduce((b, c, i) => (d3(c, knee) < d3(isl.C[b], knee) ? i : b), 0), sK = isl.along[near];
    // (the fold's side: the slot nearest a point behind the knee, as the bake aims it)
    const aim = [knee[0], knee[1] - 0.3, knee[2]], k = P.slots.reduce((b, sl, j) => (d3(P.stations[near].points[sl], aim) < d3(P.stations[near].points[P.slots[b]], aim) ? j : b), 0);
    const fK = isl.around[near][k] / isl.turn[near];
    const slope = (x, y) => { const h = (a, b) => B.height[(p.y + b) * page.W + p.x + a]; return Math.hypot(h(x + 1, y) - h(x - 1, y), h(x, y + 1) - h(x, y - 1)) / (2 * t); };
    const band = (lo, hi) => { let sum = 0, n = 0; for (let y = page.gutter + 1; y < p.h - page.gutter - 1; y++) { const s = (y - page.gutter + 0.5) * t; if (Math.abs(s - sK) < lo || Math.abs(s - sK) > hi) continue; const T = isl.turn[near], x0 = page.gutter + Math.round(((fK - 0.08) * T) / t), x1 = page.gutter + Math.round(((fK + 0.08) * T) / t); for (let x = Math.max(page.gutter + 1, x0); x <= Math.min(p.w - page.gutter - 2, x1); x++) { sum += slope(x, y); n++; } } return sum / Math.max(1, n); };
    expect(band(0, 0.06)).toBeGreaterThan(3 * band(0.16, 0.3));
  });

  it('its ORM: each cloth\'s roughness and metalness, the skin the export\'s own; the same bytes on a rebuild', () => {
    const page = paint.cloth.page, B = clothBake(chart, page, m.recipe), I = chart.islands.findIndex((x) => x.part === 'outer_armR'), p = page.place[I];
    const mid = (p.y + Math.floor(p.h / 2)) * page.W + p.x + Math.floor(p.w / 2);
    expect(Math.abs(B.rough[mid] - CLOTHS.leather.rough)).toBeLessThan(0.2);
    const j = chart.swatches.findIndex((s) => s.cloth === 'steel'), at = page.swatches[j];
    expect(B.metal[(at.y + 2) * page.W + at.x + 2]).toBe(255);
    expect(R.orm).toBeTruthy(); expect(R.stats.cloth.islands).toBe(chart.islands.length);
    const again = heroRelief(mesh, m.recipe, paint, normals);
    expect(again.atlas.url).toBe(R.atlas.url); expect(again.orm.url).toBe(R.orm.url);
    expect(SKIN_ROUGH).toBe(0.85);
  });

  it('unrolls each tube from its back, each slot\'s share of the turn easing ring to ring (a stripe runs straight down it)', () => {
    // (the trunk's and the limbs' clothes: a shoe's toe closes to its tip, where a slot's share swings as it should)
    for (const I of chart.islands.filter((x) => !x.ribbon && /_(body|torso|pelvis|arm[RL]|upperArm[RL]|foreArm[RL]|leg[RL]|thigh[RL]|shank[RL])$/.test(x.part))) for (let i = 1; i < I.around.length; i++) for (let k = 0; k < I.around[i].length; k += 3) {
      const d = I.around[i][k] / I.turn[i] - I.around[i - 1][k] / I.turn[i - 1];
      expect(Math.abs(d - Math.round(d)), `${I.part} ring ${i} slot ${k}`).toBeLessThan(0.05);
    }
  });

  it('a knit lies under its surface, its stitches in columns a wale apart', () => {
    const K = CLOTHS.knit.knit;
    let min = 0;
    for (let u = 0; u < 0.03; u += 0.0005) for (let s = 0; s < 0.03; s += 0.0005) {
      const h = knitAt(K, u, s); expect(h).toBeLessThanOrEqual(1e-12); min = Math.min(min, h);
      expect(knitAt(K, u + K.wale, s)).toBeCloseTo(h, 9); expect(knitAt(K, u, s + K.course)).toBeCloseTo(h, 9);
    }
    expect(min).toBeLessThan(-0.8 * K.yarn);
  });

  it('a pattern is woven as it is made; its words are the module\'s, a layer\'s reaching its groups, an unknown refused', () => {
    expect([...PATTERN_WORDS].sort()).toEqual(Object.keys(PATTERNS).sort());
    for (const w of ['knit', 'cable', 'jersey']) expect(CLOTH_WORDS).toContain(w);
    const L = { outer: { pattern: 'herringbone' }, bottom: { pattern: { kind: 'houndstooth', scale: 2 } }, top: { pattern: 'gingham' } };
    expect(patternOf('Outer', L).kind).toBe('herringbone'); expect(patternOf('Lapel', L).kind).toBe('herringbone'); expect(patternOf('Waistcoat', L).kind).toBe('herringbone');
    expect(patternOf('Bottom', L)).toEqual({ kind: 'houndstooth', scale: 2, contrast: 1 }); expect(patternOf('Collar', L).kind).toBe('gingham'); expect(patternOf('Shoes', L)).toBeNull();
    const card = (language) => validateOutfitCard({ ...SEEDED_OUTFITS.business, language: { ...SEEDED_OUTFITS.business.language, ...language } });
    expect(card({ outer: { ...SEEDED_OUTFITS.business.language.outer, pattern: 'pinstripe' }, bottom: { ...SEEDED_OUTFITS.business.language.bottom, pattern: { kind: 'houndstooth', scale: 1.5 } } })).toEqual([]);
    expect(card({ top: { ...SEEDED_OUTFITS.business.language.top, pattern: 'paisley' } }).join()).toMatch(/top\.pattern\.kind/);
    expect(card({ top: { ...SEEDED_OUTFITS.business.language.top, cloth: 'chainmail' } }).join()).toMatch(/top\.cloth/);
    // (a houndstooth's repeat: eight threads both ways, half of it dark)
    const H = { kind: 'houndstooth', scale: 1, contrast: 1 }, rep = PATTERNS.houndstooth.check * 2, n = 64;
    let dark = 0;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const u = ((a + 0.5) / n) * rep, s = ((b + 0.5) / n) * rep, c = patternAt(H, u, s).a;
      expect(patternAt(H, u + rep, s).a).toBe(c); expect(patternAt(H, u, s + rep).a).toBe(c);
      if (c < 1) dark++;
    }
    expect(dark / (n * n)).toBeCloseTo(0.5, 2);
    // (a pinstripe: its ground darker by its share, the stripe drawn by what it covers of a pixel)
    const P = PATTERNS.pinstripe, pin = { kind: 'pinstripe', scale: 1, contrast: 1 }, pw = 0.0005;
    let sum = 0; const m = 2000;
    for (let i = 0; i < m; i++) sum += patternAt(pin, ((i + 0.5) / m) * P.every, 0, 0, pw).a;
    const line = Math.max(P.line, 1.2 * pw);
    expect(sum / m).toBeCloseTo(1 - P.ground * (1 - line / P.every), 2);
  });

  it('rides the lit skinned GLB as metallicRoughness and occlusion beside the normal map; the unlit export neither', () => {
    const Rg = validateRig(m.recipe.rig), skin = bindLayered(mesh, m.recipe, Rg), clips = { stand: [{}] };
    const pack = packLayeredRig(mesh, skin, Rg, { clips, engineLit: true, normals, paint, relief: R });
    expect(pack.ormTex).toBeTruthy();
    const fig = { ...pack, weld: true }, J = glbJson(facesToGlb({ faces: [], figures: { body: fig } }, { clips: '_all', skinned: true, lit: true }).bytes);
    const prim = J.meshes.find((x) => x.name === 'body:skinned').primitives[0], mat = J.materials[prim.material];
    expect(mat.normalTexture).toBeTruthy();
    expect(mat.pbrMetallicRoughness.metallicRoughnessTexture).toBeTruthy();
    expect(mat.occlusionTexture.index).toBe(mat.pbrMetallicRoughness.metallicRoughnessTexture.index);
    expect(mat.pbrMetallicRoughness.metallicFactor).toBe(1); expect(mat.pbrMetallicRoughness.roughnessFactor).toBe(1);
    // (the parallax's depth map: a texture the material's extras name, its depth and its metre's UVs)
    const rel = mat.extras?.mojulo?.relief;
    expect(rel).toBeTruthy(); expect(J.textures[rel.height]).toBeTruthy(); expect(rel.depth).toBeGreaterThan(0); expect(rel.perM.every((v) => v > 0)).toBe(true);
    // (the Unreal importer marches it when the pack writes it, and names none when it does not)
    const imp = (parallax) => emitUnrealAsset({ ref: 'sk_cloth', lit: true, relief: true, manifestHash: 'x', figure: { name: 'body', clip: 'stand', clips: ['stand'] }, ...(parallax ? { parallax } : {}) }).files.find((f) => f.file === 'import_mojulo.py').text;
    expect(imp({ file: 'figure_depth.png', depth: rel.depth, perM: rel.perM })).toMatch(/PARALLAX = \{"file":"figure_depth\.png"/);
    expect(imp(null)).toMatch(/PARALLAX = None/);
    const U = glbJson(facesToGlb({ faces: [], figures: { body: fig } }, { clips: '_all', skinned: true }).bytes);
    expect(JSON.stringify(U)).not.toMatch(/metallicRoughnessTexture|occlusionTexture/);
  }, 240_000);
});
