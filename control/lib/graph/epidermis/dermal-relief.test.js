// dermal-relief.test.js — the realistic head's relief, baked from its own field and carried to an engine, on one hero
// minted under realistic laws 5 at the L0 rung (the cheapest skin and map; the map holds most where the mesh spent
// least): the field the bake reads is the one the skin was netted on (the light mesh lies on it); the map bends where the
// skin folds (the lids, the lips, the nostrils' wings) and lies flat on the cheek; it is the same bytes on a rebuild;
// a hero minted before laws 5 (no column on its fit) bakes none; the rig pack carries each corner's tangent and the map,
// and without the relief is the pack before it; the lit skinned GLB writes normalTexture and TANGENT (the engine
// skeleton's too, re-rested), the reader carries the map back, and the unlit export writes neither.
// (Beside the module, not in the critical tier: a realistic mint takes seconds.)
import { describe, it, expect, beforeAll } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { layeredShadingNormals } from '../polygonizer/station-loft-shade.js';
import { validateRig, bindLayered, packLayeredRig } from '../polygonizer/station-loft-rig.js';
import { oneSkinFields } from '../polygonizer/hero-relational-head.js';
import { texelNormal, FLAT } from '../polygonizer/normal-bake.js';
import { tposeRig } from '../figures/rig-tpose.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { glbToScene } from '../scene/scene-gltf-read.js';
import { heroSkinPaint } from './dermal-hero.js';
import { heroRelief, reliefRung, RELIEF_SIZE } from './dermal-relief.js';

const PAGES = { page: 256, headPage: 256 };
let m, mesh, paint, normals, R;
beforeAll(() => {
  m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'female', form: 'realistic', target: { resolution: '1080p', framing: 'third-person' } }) });
  mesh = compileLayered(m.recipe, m.dials);
  paint = heroSkinPaint(mesh, m.recipe, PAGES);
  normals = layeredShadingNormals(mesh, m.recipe, { proxy: false });
  R = heroRelief(mesh, m.recipe, paint, normals, { trace: true });
}, 600_000);

const glbJson = (bytes) => { const jl = bytes.readUInt32LE(12); return { json: JSON.parse(bytes.subarray(20, 20 + jl).toString('utf8')), bin: bytes.subarray(28 + jl) }; };
const floats = (G, i) => { const a = G.json.accessors[i], bv = G.json.bufferViews[a.bufferView], n = a.count * { VEC3: 3, VEC4: 4, VEC2: 2 }[a.type], o = (bv.byteOffset || 0) + (a.byteOffset || 0); return Float32Array.from({ length: n }, (_, k) => G.bin.readFloatLE(o + k * 4)); };

describe('the realistic head\'s relief', () => {
  it('reads the field the skin was netted on: the light mesh lies on it, at the skin\'s rung', () => {
    expect(m.hero.physique.laws).toBeGreaterThanOrEqual(5);
    expect(m.recipe.headFit.column.length).toBeGreaterThan(0);
    expect(reliefRung(m.recipe)).toBe('L0');
    const F = oneSkinFields(m.recipe), pts = Object.values(m.recipe.parts.headSkin.mesh.points);
    // (the most of the skin within a millimetre of its field; the simplification's own error the rest)
    const off = pts.map((p) => Math.abs(F.skin(p))).sort((a, b) => a - b);
    expect(off[Math.floor(off.length * 0.95)]).toBeLessThan(0.001);
    expect(off.at(-1)).toBeLessThan(0.008);
    expect(R.stats.size).toBe(RELIEF_SIZE.L0);
    expect(R.stats.texels).toBeGreaterThan(2000);
    expect(R.stats.lost).toBe(0);
  });

  it('bends where the skin folds and lies flat on the cheek', () => {
    const L = R.fields.landmark, B = R.map, { V, F } = R.light, eyes = ['eyeR', 'eyeL'].map(L), ch = [L('chR'), L('chL')];
    const lips = [L('sto'), ...ch], wings = [L('alR'), L('alL')];
    const cheek = [0, 1].map((s) => { const c = eyes[s].map((x, k) => (x + ch[s][k]) / 2); return [c[0] + Math.sign(c[0]) * 0.02, c[1] - 0.01, c[2]]; });
    const near = (p, cs, r) => cs.some((c) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) < r);
    const acc = { fold: [], cheek: [] };
    for (let i = 0; i < B.width * B.height; i++) {
      const fi = B.where[i]; if (fi < 0) continue;
      const t = F[fi], b0 = B.bary[i * 2], b1 = B.bary[i * 2 + 1], b2 = 1 - b0 - b1, p = [0, 1, 2].map((k) => b0 * V[t[0]][k] + b1 * V[t[1]][k] + b2 * V[t[2]][k]);
      const d = (Math.acos(Math.min(1, texelNormal(B, i % B.width, Math.floor(i / B.width))[2])) * 180) / Math.PI;
      if (near(p, eyes, 0.016) || near(p, lips, 0.008) || near(p, wings, 0.007)) acc.fold.push(d);
      else if (near(p, cheek, 0.012)) acc.cheek.push(d);
    }
    const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    expect(acc.fold.length).toBeGreaterThan(40); expect(acc.cheek.length).toBeGreaterThan(5);
    expect(mean(acc.fold)).toBeGreaterThan(4 * mean(acc.cheek));
    // (flat on the cheek: well under a degree; the even face's cheek, realistic laws 14, is rounder where it is read)
    expect(mean(acc.cheek)).toBeLessThan(0.8);
  });

  it('is the same bytes on a rebuild; the atlas off the head flat; a hero minted before laws 5 bakes none', () => {
    const again = heroRelief(mesh, m.recipe, paint, normals);
    expect(again.atlas.url).toBe(R.atlas.url);
    // (the body's page, the atlas's top, is flat: nothing there is baked)
    const B = R.map, top = Math.floor(B.height * (paint.pages.body[1] / paint.pages.H)) - 8;
    for (let y = 0; y < top; y += 7) for (let x = 0; x < B.width; x += 7) expect([...B.rgb.subarray((y * B.width + x) * 3, (y * B.width + x) * 3 + 3)]).toEqual([...FLAT]);
    const { column, ...fit } = m.recipe.headFit;
    expect(column).toBeTruthy();
    expect(heroRelief(mesh, { ...m.recipe, headFit: fit }, paint, normals)).toBeNull();
  });

  it('rides the pack and the lit skinned GLB: normalTexture and TANGENT, the engine skeleton\'s too; the unlit export neither', () => {
    const Rg = validateRig(m.recipe.rig), skin = bindLayered(mesh, m.recipe, Rg), clips = { stand: [{}] };
    const lit = packLayeredRig(mesh, skin, Rg, { clips, engineLit: true, normals, paint, relief: R });
    const plain = packLayeredRig(mesh, skin, Rg, { clips, engineLit: true, normals, paint });
    // without the relief, the pack before it: the same less the tangents and the map
    const strip = (p) => ({ ...p, normalTex: undefined, parts: p.parts.map((x) => (x ? { ...x, tan: undefined } : x)) });
    expect(JSON.stringify(strip(lit))).toBe(JSON.stringify(plain));
    expect(JSON.stringify(plain)).not.toMatch(/"tan"|normalTex/);
    for (const P of lit.parts.filter(Boolean)) expect(Buffer.from(P.tan, 'base64').length / 16).toBe(Buffer.from(P.pos, 'base64').length / 12);
    const fig = { ...lit, weld: true }, out = facesToGlb({ faces: [], figures: { body: fig } }, { clips: '_all', skinned: true, lit: true });
    const G = glbJson(out.bytes), prim = G.json.meshes.find((x) => x.name === 'body:skinned').primitives[0], mat = G.json.materials[prim.material];
    expect(mat.normalTexture).toBeTruthy();
    expect(G.json.images[G.json.textures[mat.normalTexture.index].source].mimeType).toBe('image/png');
    const T = floats(G, prim.attributes.TANGENT), N = floats(G, prim.attributes.NORMAL);
    expect(T.length / 4).toBe(G.json.accessors[prim.attributes.POSITION].count);
    for (let v = 0; v < T.length / 4; v += 13) {
      expect(Math.abs(Math.hypot(T[v * 4], T[v * 4 + 1], T[v * 4 + 2]) - 1)).toBeLessThan(1e-4);
      expect(Math.abs(T[v * 4] * N[v * 3] + T[v * 4 + 1] * N[v * 3 + 1] + T[v * 4 + 2] * N[v * 3 + 2])).toBeLessThan(2e-3);
      expect(Math.abs(T[v * 4 + 3])).toBe(1);
    }
    // the reader carries it back: kept, not dropped
    const back = glbToScene(out.bytes);
    expect(back.ledger.maps_dropped.normal).toBe(0);
    expect(back.ledger.maps_carried.normal[0]).toMatchObject({ key: 'body:normal', mime: 'image/png', tangents: T.length / 4 });
    expect(Object.keys(back.normalMaps)).toEqual(['body:normal']);
    // the engine skeleton (the T-pose, VRM space): its normals and tangents re-rested with the mesh, still square
    const eng = facesToGlb({ faces: [], figures: { body: tposeRig(fig) } }, { clips: '_all', skinned: true, lit: true, humanoid: true });
    const E = glbJson(eng.bytes), ep = E.json.meshes.find((x) => x.name === 'body:skinned').primitives[0], ET = floats(E, ep.attributes.TANGENT), EN = floats(E, ep.attributes.NORMAL);
    expect(E.json.materials[ep.material].normalTexture).toBeTruthy();
    for (let v = 0; v < ET.length / 4; v += 17) expect(Math.abs(ET[v * 4] * EN[v * 3] + ET[v * 4 + 1] * EN[v * 3 + 1] + ET[v * 4 + 2] * EN[v * 3 + 2])).toBeLessThan(2e-3);
    // the unlit export: the mojulo look, no map and no tangents
    const U = glbJson(facesToGlb({ faces: [], figures: { body: fig } }, { clips: '_all', skinned: true }).bytes);
    expect(JSON.stringify(U.json)).not.toMatch(/TANGENT|normalTexture/);
  }, 240_000);
});
