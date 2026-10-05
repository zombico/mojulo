// Smooth shading under the studio light: a hero off the anime head carries the key at each face's corners
// (`cornerFills`, from the welded normals at STUDIO_SMOOTH_CREASE), its one-colour `fill` as before; the anime hero, a
// non-hero layered row and the unshaded export keep one shade per face.
import { describe, expect, it } from 'vitest';

import { layeredShadingNormals, STUDIO_SMOOTH_CREASE } from './station-loft-shade.js';
import { layeredFaces } from './station-loft-faces.js';
import { compileLayered } from './station-loft.js';
import { validateRig, bindLayered, packLayeredRig } from './station-loft-rig.js';
import { heroRecord, expandLayeredManifest } from '../../mcp/tools/layered.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { WORKBENCH_LIGHT } from '../worlds/workbench.js';

const hero = (spec) => expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });
const meshOf = (m) => compileLayered(m.recipe, m.dials || {}, m.channels || {});
const world = async (manifest, opts = {}) => (await resolveWorldScene({ ref: 'x', title: 't', manifest }, opts)).payload.faces.filter((f) => !f.studio);
const key = (p) => p.map((x) => Math.round(x * 1e6)).join();

describe('smooth shading under the studio light', () => {
  const m = hero({ cast: 'female', detail: 'swimsuit' }), mesh = meshOf(m);

  it('the crease per group: a number is every group\'s; the skin at 70° welds more corners than at 35°', () => {
    const at = (crease) => layeredShadingNormals(mesh, m.recipe, { crease, proxy: false });
    expect(at({ default: 35 })).toEqual(at(35));
    const distinct = (N) => { const s = new Set(); mesh.faces.forEach((t, fi) => { if (mesh.groups[fi] === 'Skin') t.forEach((vi, k) => s.add(`${key(mesh.vertices[vi])}|${key(N[fi][k])}`)); }); return s.size; };
    expect(distinct(at(STUDIO_SMOOTH_CREASE))).toBeLessThan(distinct(at(35)));
    // the other groups weld as at 35°
    const A = at(STUDIO_SMOOTH_CREASE), B = at(35);
    mesh.faces.forEach((_, fi) => { if (mesh.groups[fi] !== 'Skin') expect(A[fi]).toEqual(B[fi]); });
  });

  it('layeredFaces with normals: every face keeps its fill and gains its corners\' key; the swimsuit\'s cells too', () => {
    const N = layeredShadingNormals(mesh, m.recipe, { crease: STUDIO_SMOOTH_CREASE, proxy: false });
    const flat = layeredFaces(mesh, m.recipe, { light: WORKBENCH_LIGHT }), smooth = layeredFaces(mesh, m.recipe, { light: WORKBENCH_LIGHT, normals: N });
    expect(smooth.length).toBe(flat.length);
    smooth.forEach((f, i) => {
      expect(f.fill).toBe(flat[i].fill); expect(f.corners).toEqual(flat[i].corners);
      expect(f.cornerFills).toHaveLength(4); expect(f.cornerFills[3]).toBe(f.cornerFills[2]);
    });
    expect(flat.some((f) => f.cornerFills)).toBe(false);
    expect(smooth.length).toBeGreaterThan(mesh.faces.length);   // the swimsuit's cells are among them
  });

  it('one colour at a corner the skin shares across a smooth edge', () => {
    const N = layeredShadingNormals(mesh, m.recipe, { crease: STUDIO_SMOOTH_CREASE, proxy: false });
    const faces = layeredFaces({ ...mesh }, m.recipe, { light: WORKBENCH_LIGHT, normals: N, seat: false });
    // the cranium's skin: corners at one position whose normals agree carry one colour
    const at = new Map(); let shared = 0;
    mesh.faces.forEach((t, fi) => {
      if (mesh.provenance[t[0]].part !== 'cranium' || mesh.groups[fi] !== 'Skin') return;
      const f = faces.find((x) => x.corners.every((c, k) => key(c) === key(mesh.vertices[t[k]])));
      t.forEach((vi, k) => { const id = `${key(mesh.vertices[vi])}|${key(N[fi][k])}`; const c = f.cornerFills[k]; if (at.has(id)) { shared++; expect(at.get(id)).toBe(c); } else at.set(id, c); });
    });
    expect(shared).toBeGreaterThan(200);
  });

  it('the World payload: landmark and head-none heroes carry corner fills; the anime hero, a non-hero row and the unshaded export none', async () => {
    for (const spec of [{ cast: 'male' }, { cast: 'female', head: 'none' }]) {
      const faces = await world(hero(spec));
      expect(faces.filter((f) => f.cornerFills).length).toBeGreaterThan(faces.length * 0.99);
      expect((await world(hero(spec), { unshaded: true })).some((f) => f.cornerFills)).toBe(false);
    }
    expect((await world(hero({ cast: 'male', head: 'anime' }))).some((f) => f.cornerFills)).toBe(false);
    expect((await world({ ...hero({ cast: 'male', head: 'anime' }), toon: { light: false } })).some((f) => f.cornerFills)).toBe(false);
    const { hero: _hero, ...plain } = hero({ cast: 'male' });
    expect((await world(plain)).some((f) => f.cornerFills)).toBe(false);
  });

  it('the rig pack shades its corners from the normals; without them it is as before', () => {
    const R = validateRig(m.recipe.rig), skin = bindLayered(mesh, m.recipe, R), N = layeredShadingNormals(mesh, m.recipe, { crease: STUDIO_SMOOTH_CREASE, proxy: false });
    const flat = packLayeredRig(mesh, skin, R, { clips: {} }), smooth = packLayeredRig(mesh, skin, R, { clips: {}, normals: N });
    expect(packLayeredRig(mesh, skin, R, { clips: {} })).toEqual(flat);
    expect(smooth.parts.map((p) => p?.pos)).toEqual(flat.parts.map((p) => p?.pos));
    expect(smooth.parts.some((p, i) => p && p.col !== flat.parts[i].col)).toBe(true);
  });
});
