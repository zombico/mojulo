// The dermal skin on the realistic body (dermal-body.js), on one minted body at a small page: the islands are the parts'
// own grids cut where an artist cuts them (the trunk down the back, the limbs inside), every skin face lands in its own
// island, the left limb reads as the right's mirror, the palms and soles are glabrous, the neck eases toward the head's
// tone, the seams unweld for an engine, and the maps are the same twice. (Beside the module, not in the critical tier:
// a realistic mint takes seconds.)
import { describe, it, expect, beforeAll } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { bodyDermis, bodyChart, unweldSeams, BODY_DERMIS } from './dermal-body.js';
import { dermisAt, readDermis } from './dermal-map.js';

let mesh, recipe, B;
const PAGE = 256;
beforeAll(() => {
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: 'male', form: 'realistic' }) });
  recipe = m.recipe; mesh = compileLayered(m.recipe, m.dials);
  B = bodyDermis(mesh, recipe, { sex: 'male', page: PAGE });
}, 120_000);
const vOf = (id) => mesh.pointIds.indexOf(id);
const turn = (a, b) => { const d = (((b - a) % 1) + 1) % 1; return d > 0.5 ? d - 1 : d; };

describe('the body\'s islands', () => {
  it('are the re-sampled parts\' grids, cut down the back and inside the limbs', () => {
    const I = B.chart.islands;
    for (const k of ['torso', 'neck', 'pelvis', 'upperArmR', 'foreArmL', 'thighR', 'shankL', 'handR', 'footL']) expect(I[k], k).toBeTruthy();
    expect(Object.keys(I).some((k) => /^(cranium|jaw|eye)/.test(k))).toBe(false);   // the head carries its own atlas
    expect(recipe.parts.torso.slots[I.torso.s]).toBe('back');
    expect(Math.abs(turn(I.upperArmR.seamAround, 0.75))).toBeLessThan(0.03);   // medial: inside the arm
    expect(Math.abs(turn(I.thighL.seamAround, 0.75))).toBeLessThan(0.03);
    // 'front' is anterior on every re-sampled part
    for (const k of ['torso', 'upperArmL', 'shankR']) expect(B.chart.samples[vOf(`${k}/${recipe.parts[k].stations[2].id}.front`)].around, k).toBeCloseTo(0, 6);
  });
  it('read the left limb as the right\'s mirror, slot for slot', () => {
    for (const st of recipe.parts.foreArmR.stations.slice(0, 3)) for (const sl of ['s03R', 's09R', 'back']) {
      const r = B.chart.samples[vOf(`foreArmR/${st.id}.${sl}`)], l = B.chart.samples[vOf(`foreArmL/${st.id}.${sl.replace(/R$/, 'L')}`)];
      expect(l.around).toBeCloseTo(r.around, 6); expect(l.along).toBeCloseTo(r.along, 6);
    }
  });
  it('land every skin face inside its own island, and no two islands overlap', () => {
    const { page, pageH, rects } = B.layout, byKey = new Map(rects.map((r) => [r.key, r]));
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y, `${a.key} ${b.key}`).toBe(true);
    }
    let seamFaces = 0;
    mesh.faces.forEach((tri, fi) => {
      const w = B.chart.where[tri[0]]; if (!w) return;
      const r = byKey.get(w.key), uv = B.uv.faceUV(fi);
      for (const [u, v] of uv) {
        expect(u * page).toBeGreaterThanOrEqual(r.x - 1e-6); expect(u * page).toBeLessThanOrEqual(r.x + r.w + 1e-6);
        expect((1 - v) * pageH).toBeGreaterThanOrEqual(r.y - 1e-6); expect((1 - v) * pageH).toBeLessThanOrEqual(r.y + r.h + 1e-6);
      }
      // no face spans the island: a face across the seam takes the far edge's copy
      const us = uv.map((p) => p[0] * page);
      expect(Math.max(...us) - Math.min(...us)).toBeLessThan(r.w / 3);
      if (tri.some((v) => B.chart.where[v]?.j === B.chart.islands[w.key].s)) seamFaces++;
    });
    expect(seamFaces).toBeGreaterThan(0);
  });
  it('unweld at the seams for an engine: one UV a vertex, the faces\' own', () => {
    const U = unweldSeams(mesh.faces, B.uv.corners);
    expect(U.source.length).toBeGreaterThan(mesh.vertices.length);
    for (let fi = 0; fi < mesh.faces.length; fi += 97) for (let q = 0; q < 3; q++) {
      const n = U.faces[fi * 3 + q];
      expect(U.source[n]).toBe(mesh.faces[fi][q]);
      expect(U.uv[n * 2]).toBe(B.uv.corners[fi * 6 + q * 2]);
    }
  });
});

describe('the body\'s maps', () => {
  it('lay the palms and the soles glabrous, and the forearm\'s hair over the back\'s', () => {
    const D = B.dermis, kinds = (re) => B.chart.samples.filter((s) => s && re.test(s.key)).map((s) => dermisAt(s, D, { detail: false }));
    const hand = kinds(/^handR$/), foot = kinds(/^footL$/);
    expect(hand.some((r) => r.kind === 'palm' && r.hair.kind === 'none')).toBe(true);
    expect(foot.some((r) => r.kind === 'sole' && r.hair.kind === 'none')).toBe(true);
    const dens = (re) => { const k = kinds(re).map((r) => (r.hair.kind === 'terminal' ? r.hair.density : 0)); return k.reduce((a, b) => a + b, 0) / k.length; };
    expect(dens(/^foreArmR$/)).toBeGreaterThan(dens(/^torso$/));
    expect(D.body).toBe(BODY_DERMIS.male.body);   // sparse by default
  });
  it('ease the neck\'s top toward the head\'s tone, its root untouched', () => {
    const r = B.layout.rects.find((q) => q.key === 'neck'), N = B.layout.page;
    const D = readDermis({ from: 'male', ...BODY_DERMIS.male }), chart = bodyChart(mesh, recipe);
    const toned = bodyDermis(mesh, recipe, { dermis: D, page: PAGE, neck: [0.6, 0.2, 0.1] }).maps.albedo;
    const row = (A, py) => { const s = [0, 0, 0]; for (let x = r.x + 2; x < r.x + r.w - 2; x++) for (let k = 0; k < 3; k++) s[k] += A[((r.y + py) * N + x) * 4 + k]; return s; };
    const top = r.h - 2 - Math.round((chart.islands.neck.capT * 1000) / B.layout.mmPerTexel);
    expect(row(toned, top)[0] - row(toned, top)[2]).toBeGreaterThan(row(B.maps.albedo, top)[0] - row(B.maps.albedo, top)[2]);
    expect(row(toned, 1)).toEqual(row(B.maps.albedo, 1));
  });
  it('are the same twice, byte for byte', () => {
    const again = bodyDermis(mesh, recipe, { sex: 'male', page: PAGE });
    for (const k of ['albedo', 'roughness', 'translucency', 'hair', 'fuzz', 'detail', 'ao']) expect(Buffer.from(again.maps[k]).equals(Buffer.from(B.maps[k])), k).toBe(true);
    expect(Buffer.from(again.uv.corners.buffer).equals(Buffer.from(B.uv.corners.buffer))).toBe(true);
  });
});
