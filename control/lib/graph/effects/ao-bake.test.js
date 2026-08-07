import { describe, expect, it } from 'vitest';

import { bakeAmbientOcclusion, instanceOccluderFaces, sampleAmbientAt } from './ao-bake.js';
import { faceListToMesh } from '../figures/face-mesh.js';
import { resolveWorldScene } from '../worlds/world-scene.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { facesToGlb } from '../scene/scene-gltf.js';

// ── fixtures ─────────────────────────────────────────────────────────────────
// A 10×10 floor (winding normal +z, up) with a wall standing along its x=10 edge,
// open side facing the floor (-x). The junction corners — floor (10,0,0)/(10,10,0)
// and the wall's base — are the classic AO case: contact darkening on both sides.

const floor = () => ({ corners: [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]], fill: '#808080' });
const wall = () => ({ corners: [[10, 0, 0], [10, 0, 3], [10, 10, 3], [10, 10, 0]], fill: '#808080' }); // normal -x

const AO_OPTS = { radius: 2, strength: 0.65 };

describe('ao-bake — corner/contact darkening', () => {
  it('darkens the floor corners at the wall base, not the far corners', () => {
    const out = bakeAmbientOcclusion([floor(), wall()], AO_OPTS);
    const f = out[0];
    expect(f.vao).toBeDefined();
    const [c0, c1, c2, c3] = f.vao; // corners: (0,0) (10,0) (10,10) (0,10)
    expect(c1).toBeLessThan(0.9);   // at wall base
    expect(c2).toBeLessThan(0.9);   // at wall base
    expect(c0).toBeGreaterThan(0.99); // 10 units from the wall — out of tap reach
    expect(c3).toBeGreaterThan(0.99);
  });

  it('darkens the wall base corners, not its top corners', () => {
    const out = bakeAmbientOcclusion([floor(), wall()], AO_OPTS);
    const w = out[1];
    expect(w.vao).toBeDefined();
    const [b0, t0, t1, b1] = w.vao; // corner order: base, top, top, base
    expect(b0).toBeLessThan(0.9);
    expect(b1).toBeLessThan(0.9);
    expect(t0).toBeGreaterThan(b0);
    expect(t1).toBeGreaterThan(b1);
  });

  it('leaves a flat tessellated floor untouched (coplanar neighbours self-cancel)', () => {
    const tiles = [
      { corners: [[0, 0, 0], [5, 0, 0], [5, 5, 0], [0, 5, 0]], fill: '#888' },
      { corners: [[5, 0, 0], [10, 0, 0], [10, 5, 0], [5, 5, 0]], fill: '#888' },
      { corners: [[0, 5, 0], [5, 5, 0], [5, 10, 0], [0, 10, 0]], fill: '#888' },
      { corners: [[5, 5, 0], [10, 5, 0], [10, 10, 0], [5, 10, 0]], fill: '#888' },
    ];
    const out = bakeAmbientOcclusion(tiles, AO_OPTS);
    for (let i = 0; i < 4; i++) {
      expect(out[i].vao).toBeUndefined();
      expect(out[i]).toBe(tiles[i]); // untouched faces keep their reference (decollideFaces convention)
    }
  });

  it('is deterministic: same faces + same options → identical vao arrays', () => {
    const a = bakeAmbientOcclusion([floor(), wall()], AO_OPTS);
    const b = bakeAmbientOcclusion([floor(), wall()], AO_OPTS);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('respects the minAo floor even in a fully-crowded corner', () => {
    // box interior corner: three mutually perpendicular quads meeting at the origin
    const fs = [
      { corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], fill: '#888' },                    // floor (+z)
      { corners: [[0, 0, 0], [0, 0, 4], [0, 4, 4], [0, 4, 0]], fill: '#888' },                    // wall (+x open)
      { corners: [[0, 0, 0], [4, 0, 0], [4, 0, 4], [0, 0, 4]], fill: '#888', normal: [0, 1, 0] }, // wall (+y open)
    ];
    const out = bakeAmbientOcclusion(fs, { radius: 2, strength: 1, minAo: 0.3 });
    for (const f of out) {
      if (!f.vao) continue;
      for (const a of f.vao) expect(a).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('ignores decal/water/translucent faces as occluders and receivers', () => {
    const fs = [
      floor(),
      { ...wall(), decal: 'shadow' },                 // a shadow decal must not darken the floor
      { ...wall(), corners: wall().corners.map((c) => [c[0] - 10, c[1], c[2]]), water: true },
    ];
    const out = bakeAmbientOcclusion(fs, AO_OPTS);
    expect(out[0].vao).toBeUndefined(); // no solid occluder present
    expect(out[1].vao).toBeUndefined(); // decals never receive
    expect(out[2].vao).toBeUndefined(); // water never receives
  });

  it('prefers an explicit face `normal` (shell faces: authored toward the open side)', () => {
    // wall wound so its winding normal points +x (into the void), but `normal` says -x (the room):
    const flipped = { corners: [[10, 10, 0], [10, 10, 3], [10, 0, 3], [10, 0, 0]], fill: '#888', normal: [-1, 0, 0] };
    const out = bakeAmbientOcclusion([floor(), flipped], AO_OPTS);
    expect(out[1].vao).toBeDefined(); // base corners darkened → the -x side was sampled
  });
});

describe('ao-bake — faceListToMesh consumption', () => {
  it('multiplies per-corner vao into the vertex colours', () => {
    const f = { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#ffffff', vao: [0.5, 1, 1, 1] };
    const mesh = faceListToMesh([f]);
    // triangle soup order: [c0,c1,c2, c0,c2,c3] — vertices 0 and 3 are corner 0
    expect(mesh.colors[0]).toBeCloseTo(0.5, 5);      // corner 0: white × 0.5
    expect(mesh.colors[3]).toBeCloseTo(1, 5);        // corner 1: untouched
  });

  it('leaves faces without vao byte-identical (the pre-AO path)', () => {
    const f = () => ({ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#a0b0c0' });
    const withField = faceListToMesh([f()]);
    const plain = faceListToMesh([{ ...f(), vao: undefined }]);
    expect(Array.from(withField.colors)).toEqual(Array.from(plain.colors));
  });
});

describe('world-scene — generic opt-in AO channel', () => {
  const sketch = (manifest) => ({ manifest, title: 'test' });
  const stage = (extra = {}) => ({
    kind: 'controllable',
    faces: [floor(), wall()],
    entities: [{ id: 'drone', rule: { type: 'glide' }, body: { type: 'mesh', shape: 'box' } }],
    ...extra,
  });

  it('leaves the payload untouched when the manifest carries no `ao`', async () => {
    const out = await resolveWorldScene(sketch(stage()));
    expect(out.payload.ao).toBeUndefined();
  });

  it('normalizes `ao: true` to a settings object on the payload', async () => {
    const out = await resolveWorldScene(sketch(stage({ ao: true })));
    expect(out.payload.ao).toEqual({});
  });

  it('passes a tuning object through verbatim', async () => {
    const out = await resolveWorldScene(sketch(stage({ ao: { radius: 2, strength: 0.8 } })));
    expect(out.payload.ao).toEqual({ radius: 2, strength: 0.8 });
  });
});

describe('emitters — AO applied after surface-card expansion', () => {
  it('emitThreeWorld({ ao }) darkens the packed group colours', () => {
    const base = { faces: [floor(), wall()], viewBox: { width: 200, height: 160 } };
    const plain = emitThreeWorld(base);
    const withAo = emitThreeWorld({ ...base, ao: { radius: 2 } });
    expect(withAo).not.toBe(plain);
    expect(withAo.length).toBeGreaterThan(0);
    // the b64-packed vertex-colour payload must differ once AO multiplies the corners
    expect(withAo).not.toEqual(plain);
  });

  it('facesToGlb({ ao }) produces different COLOR_0 bytes, same geometry size class', () => {
    const plain = facesToGlb({ faces: [floor(), wall()] });
    const withAo = facesToGlb({ faces: [floor(), wall()], ao: { radius: 2 } });
    expect(Buffer.compare(plain.bytes, withAo.bytes)).not.toBe(0);
    expect(withAo.vertexCount).toBe(plain.vertexCount); // colours change, geometry doesn't
  });
});

describe('ao-bake — AO × instancing (renderer-convergence 1a)', () => {
  // one instanced "crate": a 2×2 solid box lid hovering 0.4 above the floor centre —
  // close enough that the floor face's corners are NOT in reach, but a subdivided/near
  // vertex would be. For corner-level cast we instead park the instance ON a floor corner.
  const lid = () => ({ corners: [[-1, -1, 0.4], [1, -1, 0.4], [1, 1, 0.4], [-1, 1, 0.4]], fill: '#888' });

  it('instanceOccluderFaces applies translate + yaw + uniform scale like the emitters', () => {
    const [f] = instanceOccluderFaces([lid()], [{ pos: [10, 0, 0], rotZ: Math.PI / 2, scale: 2 }]);
    // corner (-1,-1) → scaled (-2,-2) → yawed 90° (2,-2) → translated (12,-2)
    expect(f.corners[0][0]).toBeCloseTo(12, 6);
    expect(f.corners[0][1]).toBeCloseTo(-2, 6);
    expect(f.corners[0][2]).toBeCloseTo(0.8, 6); // z scales, no yaw effect
  });

  it('CAST: phantom instances darken world faces via extraOccluders', () => {
    // instance parked over the floor corner (0,0): that corner darkens, far corners stay open
    const phantoms = instanceOccluderFaces([lid()], [{ pos: [0, 0, 0.0] }]);
    const out = bakeAmbientOcclusion([floor()], { ...AO_OPTS, extraOccluders: phantoms });
    expect(out[0].vao).toBeDefined();
    expect(out[0].vao[0]).toBeLessThan(0.9);      // corner (0,0) under the lid
    expect(out[0].vao[2]).toBeGreaterThan(0.99);  // corner (10,10) untouched
    expect(out.aoStats.extraOccluders).toBe(1);
  });

  it('CAST: extraOccluders are never returned or darkened themselves', () => {
    const phantoms = instanceOccluderFaces([lid()], [{ pos: [0, 0, 0] }]);
    const out = bakeAmbientOcclusion([floor()], { ...AO_OPTS, extraOccluders: phantoms });
    expect(out.length).toBe(1);
    expect(phantoms[0].vao).toBeUndefined();
  });

  it('RECEIVE: sampleAmbientAt reads dimmer between walls than in the open', () => {
    // two parallel walls 2 apart; a point between them vs one far away
    const walls = [
      { corners: [[-1, -5, 0], [-1, -5, 4], [-1, 5, 4], [-1, 5, 0]], fill: '#888' },
      { corners: [[1, -5, 0], [1, -5, 4], [1, 5, 4], [1, 5, 0]], fill: '#888' },
    ];
    const [inside, open] = sampleAmbientAt(walls, [[0, 0, 1], [50, 0, 1]], { radius: 2 });
    expect(inside).toBeLessThan(0.9);
    expect(open).toBeGreaterThan(0.99);
  });

  it('RECEIVE: sampleAmbientAt is deterministic and floors at minAo', () => {
    const walls = [
      { corners: [[-0.2, -5, 0], [-0.2, -5, 4], [-0.2, 5, 4], [-0.2, 5, 0]], fill: '#888' },
      { corners: [[0.2, -5, 0], [0.2, -5, 4], [0.2, 5, 4], [0.2, 5, 0]], fill: '#888' },
    ];
    const a = sampleAmbientAt(walls, [[0, 0, 1]], { radius: 2, strength: 1, minAo: 0.3 });
    const b = sampleAmbientAt(walls, [[0, 0, 1]], { radius: 2, strength: 1, minAo: 0.3 });
    expect(a).toEqual(b);
    expect(a[0]).toBeGreaterThanOrEqual(0.3);
  });

  it('bake with empty extraOccluders is byte-identical to the plain bake', () => {
    const a = bakeAmbientOcclusion([floor(), wall()], AO_OPTS);
    const b = bakeAmbientOcclusion([floor(), wall()], { ...AO_OPTS, extraOccluders: [] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('end-to-end: emitThreeWorld({ ao, repeats }) differs from ao-only and repeats-only pages', () => {
    const base = {
      faces: [floor(), wall()],
      repeats: [{ template: [lid()], transforms: [{ pos: [0, 0, 0] }, { pos: [5, 5, 0] }], group: 'crates' }],
      viewBox: { width: 200, height: 160 },
    };
    const aoRepeats = emitThreeWorld({ ...base, ao: { radius: 2 } });
    const repeatsOnly = emitThreeWorld(base);
    expect(aoRepeats).not.toEqual(repeatsOnly); // cast/receive changed packed colours or tints
    expect(aoRepeats).toContain('crates');
  });

  it('end-to-end: facesToGlb({ ao, repeats }) exports and differs from repeats-only', () => {
    const base = {
      faces: [floor(), wall()],
      repeats: [{ template: [lid()], transforms: [{ pos: [0, 0, 0] }] }],
    };
    const plain = facesToGlb(base);
    const withAo = facesToGlb({ ...base, ao: { radius: 2 } });
    expect(plain).toBeTruthy();
    expect(withAo).toBeTruthy();
    expect(Buffer.compare(plain.bytes, withAo.bytes)).not.toBe(0);
    expect(withAo.vertexCount).toBe(plain.vertexCount);
  });
});

describe('ao-bake — subdivide contact pools (renderer-convergence 1c)', () => {
  // a crate mid-floor: 4 walls + lid standing on a 20×20 SINGLE-QUAD floor. Corner-sampled AO
  // cannot pool under it (the floor's corners are 8+ units away); subdivide gives it vertices.
  const bigFloor = () => ({ corners: [[-10, -10, 0], [10, -10, 0], [10, 10, 0], [-10, 10, 0]], fill: '#909090' });
  const crate = () => {
    const s = 1, h = 1.2;
    return [
      { corners: [[-s, -s, 0], [-s, -s, h], [s, -s, h], [s, -s, 0]], fill: '#777' },
      { corners: [[s, -s, 0], [s, -s, h], [s, s, h], [s, s, 0]], fill: '#777' },
      { corners: [[s, s, 0], [s, s, h], [-s, s, h], [-s, s, 0]], fill: '#777' },
      { corners: [[-s, s, 0], [-s, s, h], [-s, -s, h], [-s, -s, 0]], fill: '#777' },
      { corners: [[-s, -s, h], [s, -s, h], [s, s, h], [-s, s, h]], fill: '#7f7f7f' },
    ];
  };

  it('without subdivide: the crate darkens itself but casts NO pool on the single-quad floor', () => {
    const out = bakeAmbientOcclusion([bigFloor(), ...crate()], { radius: 2 });
    expect(out[0].vao).toBeUndefined();
    expect(out.length).toBe(6);
  });

  it('with subdivide: the floor tessellates and darkened vertices appear near the crate', () => {
    const out = bakeAmbientOcclusion([bigFloor(), ...crate()], { radius: 2, subdivide: true });
    expect(out.length).toBeGreaterThan(6);                       // floor split into sub-quads
    expect(out.aoStats.subdivided).toBe(1);
    const floorPieces = out.filter((f) => f.fill === '#909090');
    const dark = floorPieces.filter((f) => f.vao);
    expect(dark.length).toBeGreaterThan(0);
    // pooled darkening is LOCAL: every darkened sub-quad touches the crate's reach, and far
    // corners of the floor stay open
    for (const f of dark) {
      const near = f.corners.some((c) => Math.hypot(c[0], c[1]) < 2 + 2 * Math.SQRT2);
      expect(near).toBe(true);
    }
  });

  it('an open floor with nothing on it keeps its single quad (tessellate only where it pays)', () => {
    // occluder far outside the pool radius of the floor's interior
    const wallFar = { corners: [[30, -5, 0], [30, -5, 3], [30, 5, 3], [30, 5, 0]], fill: '#888' };
    const out = bakeAmbientOcclusion([bigFloor(), wallFar], { radius: 2, subdivide: true });
    expect(out.filter((f) => f.fill === '#909090').length).toBe(1);
  });

  it('respects the sub-face cap and counts overflow (never silent)', () => {
    const out = bakeAmbientOcclusion([bigFloor(), ...crate()], { radius: 2, subdivide: { cap: 4 } });
    expect(out.aoStats.subOverflow).toBeGreaterThan(0);
    expect(out.filter((f) => f.fill === '#909090').length).toBe(1);   // fell back to the single quad
  });

  it('is deterministic with subdivide on', () => {
    const a = bakeAmbientOcclusion([bigFloor(), ...crate()], { radius: 2, subdivide: true });
    const b = bakeAmbientOcclusion([bigFloor(), ...crate()], { radius: 2, subdivide: true });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('world-scene — per-kind AO defaults (renderer-convergence 1c)', () => {
  const sk = (manifest) => ({ manifest, title: 'test' });

  it('interior kinds carry ao by default; a manifest ao:false disables; opt-in kinds stay off', async () => {
    const floorplan = await resolveWorldScene(sk({ kind: 'floorplan' }));
    expect(floorplan.payload.ao).toEqual({});
    const disabled = await resolveWorldScene(sk({ kind: 'floorplan', ao: false }));
    expect(disabled.payload.ao).toBeUndefined();
    const condo = await resolveWorldScene(sk({ kind: 'condo-complex' }));
    expect(condo.payload.ao).toBeUndefined();                    // deliberately not defaulted (692ms/74k faces)
    const city = await resolveWorldScene(sk({ kind: 'fractal-city' }));
    expect(city.payload.ao).toBeUndefined();                     // open landscape family: off
  });
});

describe('emitPreserve3dScene — face-average vao fallback (renderer-convergence 1d)', () => {
  it('an `ao` option darkens flat fills; scenes without it stay byte-identical', async () => {
    const { emitPreserve3dScene } = await import('../scene/scene-css3d.js');
    const base = { faces: [floor(), wall()], cameras: [{ name: 'v', worldFraming: { cameraPosition: [-7, 31, 9], lookAt: [5, 5, 1], horizontalFov: 80, pictureCenter: [400, 300] } }], viewBox: { width: 800, height: 600 } };
    const plain = emitPreserve3dScene(base);
    const plainAgain = emitPreserve3dScene({ ...base });
    expect(plainAgain).toBe(plain);                              // no-ao path untouched
    const withAo = emitPreserve3dScene({ ...base, ao: { radius: 2 } });
    expect(withAo).not.toBe(plain);                              // fills darkened by face-average vao
  });

  it('faces already carrying `vao` darken without re-baking', async () => {
    const { emitPreserve3dScene } = await import('../scene/scene-css3d.js');
    const cams = [{ name: 'v', worldFraming: { cameraPosition: [-7, 31, 9], lookAt: [5, 5, 1], horizontalFov: 80, pictureCenter: [400, 300] } }];
    const f = { corners: [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]], fill: '#808080' };
    const plain = emitPreserve3dScene({ faces: [f], cameras: cams });
    const pre = emitPreserve3dScene({ faces: [{ ...f, vao: [0.5, 0.5, 0.5, 0.5] }], cameras: cams });
    expect(pre).not.toBe(plain);
    expect(pre).toContain('#404040');                            // #808080 × 0.5 face-average
  });
});

describe('AO memoization (renderer-emitter.plan.md E6)', () => {
  const grid = (n, fill = '#888888') => {
    const faces = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        faces.push({ corners: [[i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0]], fill });
      }
    }
    // one crate above the grid so there is real occlusion to bake
    faces.push({ corners: [[2, 2, 0.02], [3, 2, 0.02], [3, 3, 0.02], [2, 3, 0.02]], fill: '#663311' });
    faces.push({ corners: [[2, 2, 1], [3, 2, 1], [3, 3, 1], [2, 3, 1]], fill: '#663311' });
    return faces;
  };

  it('second identical bake hits the cache and reproduces vao exactly', () => {
    const a = bakeAmbientOcclusion(grid(8), { strength: 0.7 });
    const b = bakeAmbientOcclusion(grid(8), { strength: 0.7 });
    expect(b.aoStats.cached).toBe(true);
    expect(a.aoStats.cached).toBeUndefined();
    expect(b.map((f) => f.vao || null)).toEqual(a.map((f) => f.vao || null));
  });

  it('a recolored world with identical geometry still hits — and keeps its fresh colors', () => {
    bakeAmbientOcclusion(grid(7, '#101010'), {});
    const recolored = bakeAmbientOcclusion(grid(7, '#f0f0f0'), {});
    expect(recolored.aoStats.cached).toBe(true);
    expect(recolored[0].fill).toBe('#f0f0f0'); // fresh face objects, cached vao only
  });

  it('different opts or geometry miss; subdivide bypasses entirely', () => {
    const g = grid(6);
    bakeAmbientOcclusion(g, { strength: 0.5 });
    expect(bakeAmbientOcclusion(g, { strength: 0.9 }).aoStats.cached).toBeUndefined();
    const sub = bakeAmbientOcclusion(grid(6), { strength: 0.5, subdivide: true });
    expect(sub.aoStats.cached).toBeUndefined();
  });
});
