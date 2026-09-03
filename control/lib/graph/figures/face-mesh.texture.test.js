/**
 * Texture-channel edge cases in faceListToMesh (skin-over-mesh.plan.md phase
 * 0b): the `texture` + `uv` + `textureLit` face contract that phase 1's
 * recipe-emitted UVs will lean on. Pins the split rules BEFORE any skin work
 * so regressions land here, not in a spike PNG.
 */
import { describe, expect, it } from 'vitest';

import { faceListToMesh } from './face-mesh.js';

const quad = (extra = {}) => ({
  corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
  fill: '#ffffff',
  ...extra,
});
const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];

describe('faceListToMesh — texture group split', () => {
  it('a texture+uv face lands in its textureGroups key, not the plain buffers', () => {
    const m = faceListToMesh([quad({ texture: 'marble', uv: UV })]);
    expect(m.positions.length).toBe(0);
    const grp = m.textureGroups.marble;
    expect(grp).toBeDefined();
    expect(grp.positions.length).toBe(18); // 2 tris × 3 verts × xyz
    expect(grp.uvs.length).toBe(12);       // 6 verts × (u,v)
    expect(grp.colors.length).toBe(18);
  });

  it('the split needs BOTH keys — `texture` without `uv` stays on the plain path', () => {
    const m = faceListToMesh([quad({ texture: 'marble' })]);
    expect(Object.keys(m.textureGroups)).toEqual([]);
    expect(m.positions.length).toBe(18);
  });

  it('distinct texture keys split into distinct groups; untextured faces stay plain', () => {
    const m = faceListToMesh([
      quad({ texture: 'marble', uv: UV }),
      quad({ texture: 'asphalt', uv: UV }),
      quad(),
    ]);
    expect(Object.keys(m.textureGroups).sort()).toEqual(['asphalt', 'marble']);
    expect(m.positions.length).toBe(18);
  });

  it('textureLit is per-group sticky: one lit face flips the whole group', () => {
    const unlit = faceListToMesh([quad({ texture: 't', uv: UV })]);
    expect(unlit.textureGroups.t.lit).toBe(false);
    const lit = faceListToMesh([
      quad({ texture: 't', uv: UV }),
      quad({ texture: 't', uv: UV, textureLit: true }),
    ]);
    expect(lit.textureGroups.t.lit).toBe(true);
  });

  it('vao (baked AO) multiplies texture-group colours per corner', () => {
    const m = faceListToMesh([quad({ texture: 't', uv: UV, textureLit: true, vao: [0.5, 1, 1, 1] })]);
    const cols = m.textureGroups.t.colors;
    // white fill → linear 1; TRIS = [0,1,2],[0,2,3] so vertices 0 and 3 carry corner 0's 0.5
    expect(cols[0]).toBeCloseTo(0.5);
    expect(cols[3]).toBeCloseTo(1);
    expect(cols[9]).toBeCloseTo(0.5); // second tri starts at corner 0 again
  });

  it('cornerFills ride into the texture group per corner (gradient × texel)', () => {
    const m = faceListToMesh([quad({ texture: 't', uv: UV, cornerFills: ['#000000', '#ffffff', '#ffffff', '#ffffff'] })]);
    const cols = m.textureGroups.t.colors;
    expect(Array.from(cols.slice(0, 3))).toEqual([0, 0, 0]);   // corner 0 black
    expect(Array.from(cols.slice(3, 6))).toEqual([1, 1, 1]);   // corner 1 white
  });

  it('specs pack per texture group ONLY when a spec face touches that group', () => {
    const m = faceListToMesh([
      quad({ texture: 'shiny', uv: UV, spec: [0.5, 20] }),
      quad({ texture: 'matte', uv: UV }),
    ]);
    expect(m.textureGroups.shiny.specs).not.toBeNull();
    expect(Array.from(m.textureGroups.shiny.specs.slice(0, 2))).toEqual([0.5, 20]);
    expect(m.textureGroups.matte.specs).toBeNull();
  });

  it('textured faces never contribute NORMAL data (withNormals skips them)', () => {
    const m = faceListToMesh(
      [quad({ texture: 't', uv: UV, outNormal: [0, 0, 1] })],
      { withNormals: true },
    );
    expect(m.normals).toBeNull();
  });

  it('textured faces still count into center/radius bounds', () => {
    const m = faceListToMesh([quad({ texture: 't', uv: UV })]);
    expect(m.center).toEqual([0.5, 0.5, 0]);
    expect(m.radius).toBeGreaterThan(0);
  });
});
