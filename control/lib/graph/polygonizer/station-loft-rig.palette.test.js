import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { compileLayered } from './station-loft.js';
import { validateRig, bindLayered, packLayeredRig } from './station-loft-rig.js';
import { faceColorLinear } from '../figures/face-mesh.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';

// The rig pack's plain path colours a face as the static solid does (station-loft-faces.js layeredFaces): its group in
// the recipe palette, else its part's tint, else neutral grey. Before, the pack read the tint alone, so every group the
// palette colours by itself (a detailed head's cranium, horns, a pinned tile, an adornment) played its clips in grey.

const h = (x) => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex').slice(0, 16);
const u8 = (s) => new Uint8Array(Buffer.from(s, 'base64'));
const f32 = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
const lin8 = (hex) => faceColorLinear({ fill: hex }).map((v) => { const x = v * 255; return x <= 0 ? 0 : x >= 255 ? 255 : (x + 0.5) | 0; }).join(',');
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const GREY = '#8a8f96';
const LIGHT = [0.35, -0.55, 0.75];   // packLayeredRig's default
const count = (xs) => { const m = new Map(); for (const x of xs) m.set(x, (m.get(x) || 0) + 1); return m; };
const quatToMat = ([x, y, z, w]) => [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]];

/** one key of a packed clip as the clip player draws it: every part's corners skinned by the key's bone frames
 * (M = T(head)·R(q)·T(−restHead), weighted), each carrying its packed colour */
function posedFrame(pack, clip, k) {
  const C = pack.clips[clip], B = pack.bones.length, at = (bi) => { const o = (k * B + bi) * 7; return { m: quatToMat(C.b.slice(o, o + 4)), head: C.b.slice(o + 4, o + 7) }; };
  const F = pack.bones.map((_, bi) => at(bi)), out = { pos: [], col: [] };
  pack.parts.forEach((P) => {
    if (!P) return; const p = f32(P.pos), c = u8(P.col), j = u8(P.jnt), w = f32(P.wgt);
    for (let i = 0; i < p.length / 3; i++) {
      const q = [0, 0, 0];
      for (let s = 0; s < 4; s++) { const ww = w[4 * i + s]; if (!ww) continue; const bi = j[4 * i + s], f = F[bi], r = pack.bones[bi].head, d = [p[3 * i] - r[0], p[3 * i + 1] - r[1], p[3 * i + 2] - r[2]];
        for (let a = 0; a < 3; a++) q[a] += ww * (f.head[a] + f.m[a][0] * d[0] + f.m[a][1] * d[1] + f.m[a][2] * d[2]); }
      out.pos.push(q); out.col.push(`${c[3 * i]},${c[3 * i + 1]},${c[3 * i + 2]}`);
    }
  });
  return out;
}

describe('packLayeredRig — the recipe palette on the plain path', () => {
  // the streamlined landmark hero: every part untinted, every group coloured by the palette alone
  const recipe = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', core: 'streamlined' }) }).recipe;
  const mesh = compileLayered(recipe), R = validateRig(recipe.rig), skin = bindLayered(mesh, recipe, R);
  // every corner's shading normal on the light ⇒ shade 1 exactly, so a corner's colour IS its face's base colour
  const flat = mesh.faces.map((t) => t.map(() => unit(LIGHT)));
  const clip = recipe.clips.wave ? 'wave' : Object.keys(recipe.clips)[0];
  const expected = (palette) => count(mesh.faces.flatMap((t, fi) => { const c = lin8((palette || {})[mesh.groups[fi]] || mesh.parts[mesh.provenance[t[0]].part].tint || GREY); return [c, c, c]; }));

  it('the fixture is palette-only: no part carries a tint, every group is in the palette', () => {
    expect(Object.values(mesh.parts).some((p) => p.tint)).toBe(false);
    expect(new Set(mesh.groups).size).toBeGreaterThan(5);
    for (const g of new Set(mesh.groups)) expect(recipe.palette[g], g).toBeTruthy();
  });

  it('a palette-only group keeps its colour in a posed clip frame', () => {
    const pack = packLayeredRig(mesh, skin, R, { clips: { [clip]: recipe.clips[clip] }, normals: flat, palette: recipe.palette });
    const K = pack.clips[clip].k, frame = posedFrame(pack, clip, K >> 1), rest = posedFrame(pack, clip, 0);
    expect(Math.max(...frame.pos.map((p, i) => Math.hypot(p[0] - rest.pos[i][0], p[1] - rest.pos[i][1], p[2] - rest.pos[i][2])))).toBeGreaterThan(0.01);   // the key is posed
    expect(count(frame.col)).toEqual(expected(recipe.palette));   // every corner its group's palette colour …
    expect(frame.col).not.toContain(lin8(GREY));                    // … none grey
    expect(frame.col).toContain(lin8(recipe.palette.Skin));
    expect(frame.col).toContain(lin8(recipe.palette.Hair));
    // without the palette the same frame is the grey it used to play
    expect(new Set(posedFrame(packLayeredRig(mesh, skin, R, { clips: { [clip]: recipe.clips[clip] }, normals: flat }), clip, K >> 1).col)).toEqual(new Set([lin8(GREY)]));
  });

  it('tinted parts and no palette: absent, null, {} and a palette naming no group are one pack, the tint per face', () => {
    const tints = ['#7a5c44', '#4d6b6e', '#9a8a6a', '#5a6a4f'];
    const parts = Object.fromEntries(Object.entries(recipe.parts).map(([n, p], i) => [n, { ...p, tint: tints[i % tints.length] }]));
    const m2 = compileLayered({ ...recipe, parts, palette: undefined });
    const base = packLayeredRig(m2, skin, R, { normals: flat });
    for (const palette of [null, {}, { NoSuchGroup: '#ff0000' }]) expect(packLayeredRig(m2, skin, R, { normals: flat, palette })).toEqual(base);
    const cols = base.parts.flatMap((P) => { if (!P) return []; const c = u8(P.col); return Array.from({ length: c.length / 3 }, (_, i) => `${c[3 * i]},${c[3 * i + 1]},${c[3 * i + 2]}`); });
    expect(count(cols)).toEqual(count(m2.faces.flatMap((t) => { const c = lin8(m2.parts[m2.provenance[t[0]].part].tint); return [c, c, c]; })));
  });
});

describe('the World page and the skinned GLB carry the palette into the clips', () => {
  const world = async (manifest) => (await resolveWorldScene({ ref: 'x', title: 't', manifest }, {})).payload;
  const hero = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', core: 'streamlined' }) });

  // tinted, no palette: the figure and its skinned GLB byte for byte as before the palette reached the pack (pins recorded
  // on the tint-only pack)
  it('a tinted recipe without a palette: the figure and the skinned GLB unchanged', async () => {
    const tints = ['#7a5c44', '#4d6b6e', '#9a8a6a', '#5a6a4f'];
    const { palette: _p, ...bare } = hero.recipe;
    const recipe = { ...bare, parts: Object.fromEntries(Object.entries(bare.parts).map(([n, p], i) => [n, { ...p, tint: tints[i % tints.length] }])) };
    const f = await world({ kind: 'layered', recipe });
    expect(h(f.figures)).toBe('04ea828c3d54b03a');
    expect(createHash('sha256').update(facesToGlb(f, { generator: 't', clips: '_all', skinned: true }).bytes).digest('hex').slice(0, 16)).toBe('e2228b9cdd3106c5');
  });

  it('the skinned GLB: COLOR_0 carries the palette, not grey', async () => {
    const f = await world(hero);
    const glb = facesToGlb(f, { generator: 't', clips: '_all', skinned: true }).bytes, buf = Buffer.from(glb);
    const jl = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + jl).toString('utf8')), bin = buf.subarray(20 + jl + 8);
    const skinned = json.meshes.filter((m) => /:skinned$/.test(m.name));
    expect(skinned.length).toBe(1);
    const hues = [];
    for (const prim of skinned[0].primitives) {
      if (prim.attributes.COLOR_0 == null) continue;
      const a = json.accessors[prim.attributes.COLOR_0], v = json.bufferViews[a.bufferView], n = a.type === 'VEC4' ? 4 : 3;
      expect(a.componentType).toBe(5126);
      const stride = v.byteStride || n * 4, o = (v.byteOffset || 0) + (a.byteOffset || 0);
      for (let i = 0; i < a.count; i++) { const c = [0, 1, 2].map((k) => bin.readFloatLE(o + i * stride + k * 4)); const l = Math.hypot(...c); if (l > 0.05) hues.push(c.map((x) => x / l)); }
    }
    expect(hues.length).toBeGreaterThan(1000);
    const hueOf = (hex) => unit(faceColorLinear({ fill: hex })), near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.02;
    expect(hues.filter((c) => near(c, hueOf(GREY))).length).toBe(0);
    expect(hues.filter((c) => near(c, hueOf(hero.recipe.palette.Skin))).length).toBeGreaterThan(hues.length / 5);
  });
});
