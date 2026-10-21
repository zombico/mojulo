// The realistic hero's skin as an export wears it (dermal-hero.js), on one dressed hero at a small page: what it wears
// covers its skin (rays out along the normal, a garment on the same bone or one near it; never a hand by the trousers),
// the body's islands keep only the rings that show, each kept ring's address the whole part's, and a covered face takes
// no texel; the bake's occlusion (polygonizer/surface-bake.js) cast by what is seen alone, on the field's normals.
// (Beside the module, not in the critical tier: a realistic mint takes seconds.)
import { describe, it, expect, beforeAll } from 'vitest';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { compileLayered } from '../polygonizer/station-loft.js';
import { coveredSkin, heroDermis, heroHidden, GLOBE } from './dermal-hero.js';
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
    expect(read(after, 'eyeR', (o) => o)).toBeLessThan(read(before, 'eyeR', (o) => o) * 0.85);
    expect(read(after, 'jaw', (o) => o > 0.5)).toBeLessThan(read(before, 'jaw', (o) => o > 0.5) / 2);
  }, 240_000);
});
