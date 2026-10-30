// A beast-kin's cover as a material (lib/graph/beast/cover.js): each kind a tileable relief read into glTF's maps, its
// flat patch for the faces it does not reach; mapped on the coat by each part's own rings, a whole number of tiles round,
// each corner's tangent square to its normal; carried by the rig pack only when asked (absent, byte for byte).
import { describe, it, expect } from 'vitest';
import { COVERS, coverTile, coverMap, beastCoverOf, FLAT_PATCH, TILE_PX } from './cover.js';
import { BEAST_KINS } from './cards.js';
import { beastWords } from './tiered.js';
import { heroRecord, heroPlanOf, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { withDefaultForm, withDefaultWalk } from '../polygonizer/motion-stamp.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { validateRig, bindLayered, packLayeredRig } from '../polygonizer/station-loft-rig.js';
import { layeredShadingNormals } from '../polygonizer/station-loft-shade.js';

const png = (url) => Buffer.from(url.split(',')[1], 'base64');
const KIN = Object.keys(BEAST_KINS).find((k) => beastCoverOf({ beast: { kin: k } }) === 'fur');
const mint = (spec) => heroRecord(withDefaultWalk(beastWords(withDefaultForm(spec))));
const built = (hero) => { const { recipe, dials } = expandLayeredManifest({ kind: 'layered', hero }), mesh = compileLayered(recipe, dials); return { recipe, mesh }; };

describe('a beast-kin\'s cover as a material', () => {
  it('each kind is a tileable relief: its opposite edges meet as its neighbouring columns do; deterministic; the flat patch level', () => {
    for (const kind of Object.keys(COVERS)) {
      const T = coverTile(kind), W = T.W, h = T.height, col = (x) => Array.from({ length: W }, (_, y) => h[y * W + x]);
      const step = (a, b) => a.reduce((s, z, i) => s + Math.abs(z - b[i]), 0) / W;
      const inner = (step(col(W / 2), col(W / 2 + 1)) + step(col(W / 4), col(W / 4 + 1))) / 2;
      expect(step(col(W - 1), col(0)), kind).toBeLessThan(Math.max(4 * inner, 0.05 * COVERS[kind].depth));
      expect(Math.max(...h)).toBeLessThanOrEqual(COVERS[kind].depth * (1 + 1e-6));   // (float32)
      expect(coverTile(kind).maps.normal).toBe(T.maps.normal);
      for (let k = 0; k < FLAT_PATCH * FLAT_PATCH; k++) { const y = Math.floor(k / FLAT_PATCH), x = k % FLAT_PATCH, i = (y * W + x) * 3;
        expect([T.normal[i], T.normal[i + 1], T.normal[i + 2]]).toEqual([128, 128, 255]); expect(T.orm[i]).toBe(255); }
      for (const m of ['base', 'normal', 'orm', 'height']) expect(png(T.maps[m]).subarray(1, 4).toString()).toBe('PNG');
    }
    expect(coverTile('fur').maps.normal).not.toBe(coverTile('scales').maps.normal);
    expect(TILE_PX).toBe(coverTile('fur').W);
  });

  it('a hollow is occluded and darker, a crest is not: the relief read into the maps', () => {
    const T = coverTile('scales'), W = T.W; let hi = 0, lo = 0;
    for (let k = FLAT_PATCH * W; k < W * W; k++) { if (T.cavity[k] > T.cavity[hi]) hi = k; if (T.convex[k] > T.convex[lo]) lo = k; }
    expect(T.orm[hi * 3]).toBeLessThan(T.orm[lo * 3]);                   // occlusion
    expect(T.cavity[hi]).toBeGreaterThan(0.2); expect(T.convex[lo]).toBeGreaterThan(0.2);
  });

  it('it maps the coat by each part\'s own rings, a whole number of tiles round; the head and the claws on the flat patch', () => {
    const H = mint({ cast: 'male', beast: { kin: KIN } }), { recipe, mesh } = built(H), N = layeredShadingNormals(mesh, recipe, {});
    const C = coverMap(mesh, recipe, N, 'fur');
    expect(C.stats.faces / C.stats.of).toBeGreaterThan(0.4);
    const flat = [(FLAT_PATCH / 2) / TILE_PX, (FLAT_PATCH / 2) / TILE_PX], part = (fi) => mesh.provenance[mesh.faces[fi][0]].part;
    let headFaces = 0, covered = 0, stretched = 0;
    mesh.faces.forEach((_, fi) => {
      const uv = [0, 1, 2].map((k) => C.uvAt(fi, k)), onFlat = uv.every((x) => x[0] === flat[0] && x[1] === flat[1]);
      if (/^(cranium|jaw|eye)|Claw/.test(part(fi))) { headFaces++; expect(onFlat, part(fi)).toBe(true); }
      // (a face across the wrap taken the short way round: its span of tiles never more than its own size in tiles, where the
      // long way round would be the part's whole round)
      if (!onFlat) { covered++; const us = uv.map((x) => x[0]), P = mesh.faces[fi].map((vi) => mesh.vertices[vi]);
        const size = Math.max(...[0, 1, 2].map((k) => Math.hypot(...P[k].map((x, q) => x - P[(k + 1) % 3][q])))) / COVERS.fur.tile;
        if (Math.max(...us) - Math.min(...us) > size + 0.5) stretched++;
        for (let k = 0; k < 3; k++) { const t = C.tangentAt(fi, k), n = N[fi][k], l = Math.hypot(...n);
          expect(Math.abs(Math.hypot(t[0], t[1], t[2]) - 1)).toBeLessThan(1e-6); expect(Math.abs((t[0] * n[0] + t[1] * n[1] + t[2] * n[2]) / l)).toBeLessThan(1e-3); expect(Math.abs(t[3])).toBe(1); } }
    });
    expect(headFaces).toBeGreaterThan(0); expect(covered).toBe(C.stats.faces);
    expect(stretched / covered).toBeLessThan(0.02);   // (only a cap's fan near its point is stretched round its axis)
  }, 60_000);

  it('the rig pack carries it only when asked: its tile\'s uv and tangent per corner and the maps; absent, byte for byte', () => {
    const H = mint({ cast: 'male', beast: { kin: KIN } }), { recipe, mesh } = built(H), R = validateRig(recipe.rig), skin = bindLayered(mesh, recipe, R), N = layeredShadingNormals(mesh, recipe, {});
    const plain = packLayeredRig(mesh, skin, R, { engineLit: true, normals: N }), none = packLayeredRig(mesh, skin, R, { engineLit: true, normals: N, cover: null });
    expect(JSON.stringify(none)).toBe(JSON.stringify(plain));
    const P = packLayeredRig(mesh, skin, R, { engineLit: true, normals: N, cover: coverMap(mesh, recipe, N, 'fur') });
    expect(P.coverTex).toMatchObject({ size: COVERS.fur.tile, depth: COVERS.fur.depth });
    for (const p of P.parts.filter(Boolean)) { expect(typeof p.uv).toBe('string'); expect(typeof p.tan).toBe('string'); }
    expect(plain.coverTex).toBeUndefined();
    // (unlit, no cover is carried: it rides the engine's light only)
    expect(packLayeredRig(mesh, skin, R, { normals: N, cover: coverMap(mesh, recipe, N, 'fur') }).coverTex).toBeUndefined();
  }, 60_000);

  it('the kin\'s cover by default, the operator\'s word over it; under it the head\'s short tufts are the material\'s', () => {
    expect(beastCoverOf({ beast: { kin: KIN } })).toBe('fur');
    expect(beastCoverOf({ beast: { kin: KIN, cover: 'none' } })).toBe(null);
    expect(beastCoverOf({ beast: { kin: KIN, cover: 'scales' } })).toBe('scales');
    const tiles = (h) => heroPlanOf(h).heads[0].plan.regions?.tiles?.length ?? 0;
    expect(tiles(mint({ cast: 'male', beast: { kin: KIN } }))).toBeLessThan(tiles(mint({ cast: 'male', beast: { kin: KIN, cover: 'none' } })));
  });
});
