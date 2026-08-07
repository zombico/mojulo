import { describe, expect, it } from 'vitest';

import { collectGlowSprites, collectShadowDecals, collectWaterMesh, decollideFaces, faceColorLinear, faceListToMesh } from './face-mesh.js';

describe('faceColorLinear', () => {
  it('parses a 6-digit fill hex to linear rgb', () => {
    // #ffffff (sRGB white) → linear white
    expect(faceColorLinear({ fill: '#ffffff' })).toEqual([1, 1, 1]);
    // #000000 → linear black
    expect(faceColorLinear({ fill: '#000000' })).toEqual([0, 0, 0]);
  });

  it('expands a 3-digit hex', () => {
    expect(faceColorLinear({ fill: '#fff' })).toEqual([1, 1, 1]);
  });

  it('applies the sRGB→linear transfer (mid-grey is darkened)', () => {
    const [r] = faceColorLinear({ fill: '#808080' });
    expect(r).toBeGreaterThan(0.21);
    expect(r).toBeLessThan(0.22); // ~0.2158, not the naive 0.502
  });

  it('parses an rgb()/rgba() fill (painted-landscape terrain bakes rgb strings)', () => {
    // rgb(255,255,255) must resolve identically to #ffffff, not the grey fallback
    expect(faceColorLinear({ fill: 'rgb(255,255,255)' })).toEqual([1, 1, 1]);
    expect(faceColorLinear({ fill: 'rgb(0, 0, 0)' })).toEqual([0, 0, 0]);
    expect(faceColorLinear({ fill: 'rgb(128,128,128)' })).toEqual(faceColorLinear({ fill: '#808080' }));
    expect(faceColorLinear({ fill: 'rgba(255,255,255,0.5)' })).toEqual([1, 1, 1]);
  });

  it('falls back to the first hex inside a CSS gradient bg', () => {
    const c = faceColorLinear({ bg: 'linear-gradient(150deg,#3a4350,#1d232b 72%)' });
    const expected = faceColorLinear({ fill: '#3a4350' });
    expect(c).toEqual(expected);
  });

  it('returns the neutral fallback when no colour is resolvable', () => {
    expect(faceColorLinear({})).toEqual([0.5, 0.5, 0.5]);
    expect(faceColorLinear({ bg: 'none' })).toEqual([0.5, 0.5, 0.5]);
  });
});

describe('collectWaterMesh', () => {
  const waterQuad = { corners: [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]], fill: 'rgba(40,90,130,0.7)', water: true };

  it('builds a 2-triangle quad with a 4-component (RGBA) colour buffer', () => {
    const wm = collectWaterMesh([waterQuad]);
    expect(wm.vertexCount).toBe(6);          // quad → 2 tris
    expect(wm.positions.length).toBe(18);    // 6 verts × xyz
    expect(wm.colors.length).toBe(24);       // 6 verts × rgba
  });

  it('carries the rgba() alpha as the per-vertex alpha channel', () => {
    const { colors } = collectWaterMesh([waterQuad]);
    for (let i = 3; i < colors.length; i += 4) expect(colors[i]).toBeCloseTo(0.7, 5);
  });

  it('returns null when no water faces are present', () => {
    expect(collectWaterMesh([{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#3366aa' }].filter((f) => f.water))).toBeNull();
    expect(collectWaterMesh([])).toBeNull();
  });
});

describe('faceListToMesh', () => {
  const quad = {
    corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]],
    fill: '#ffffff',
  };

  it('emits two triangles (6 verts) per quad face', () => {
    const mesh = faceListToMesh([quad]);
    expect(mesh.faceCount).toBe(1);
    expect(mesh.vertexCount).toBe(6);
    expect(mesh.positions.length).toBe(18);
    expect(mesh.colors.length).toBe(18);
  });

  it('shares the face colour across all 6 verts', () => {
    const { colors } = faceListToMesh([quad]);
    for (let i = 0; i < colors.length; i++) expect(colors[i]).toBe(1);
  });

  it('skips degenerate faces with fewer than 4 corners', () => {
    const mesh = faceListToMesh([{ corners: [[0, 0, 0], [1, 0, 0]], fill: '#fff' }, quad]);
    expect(mesh.vertexCount).toBe(6); // only the valid quad contributed
  });

  it('computes a center and bounding radius from corner coords', () => {
    const mesh = faceListToMesh([quad]);
    expect(mesh.center).toEqual([1, 0, 1]);
    expect(mesh.radius).toBeCloseTo(Math.SQRT2, 5); // corner at (0,0,0) is √2 from center (1,0,1)
  });

  it('returns empty arrays and origin for no faces', () => {
    const mesh = faceListToMesh([]);
    expect(mesh.vertexCount).toBe(0);
    expect(mesh.center).toEqual([0, 0, 0]);
    expect(mesh.radius).toBe(0);
  });

  it('triangulates a tri() clip face to a single triangle with the apex mapped back', () => {
    // scene-css3d's tri() emits a quad [A, B, B+Vw, A+Vw] + a 3-point clip whose third
    // vertex (X% 100%) is the original apex. Here A=(0,0,0) B=(4,0,0) Vw=(0,0,2), and the
    // clip apex sits at u=0.25 → world apex (1, 0, 2).
    const triFace = {
      corners: [[0, 0, 0], [4, 0, 0], [4, 0, 2], [0, 0, 2]],
      fill: '#ffffff',
      clip: 'polygon(0% 0%, 100% 0%, 25.0% 100%)',
    };
    const mesh = faceListToMesh([triFace]);
    expect(mesh.vertexCount).toBe(3); // one triangle, not a 6-vert quad
    // verts: A, B, apex
    expect(Array.from(mesh.positions.slice(0, 3))).toEqual([0, 0, 0]);
    expect(Array.from(mesh.positions.slice(3, 6))).toEqual([4, 0, 0]);
    expect(Array.from(mesh.positions.slice(6, 9))).toEqual([1, 0, 2]);
  });

  it('fan-triangulates a clip polygon with N>3 vertices into N-2 triangles', () => {
    const pentaClip = {
      corners: [[0, 0, 0], [10, 0, 0], [10, 0, 10], [0, 0, 10]],
      fill: '#fff',
      clip: 'polygon(0% 0%, 100% 0%, 100% 50%, 50% 100%, 0% 50%)', // 5 verts → 3 tris
    };
    const mesh = faceListToMesh([pentaClip]);
    expect(mesh.vertexCount).toBe(9); // 3 triangles
  });

  it('falls back to the plain quad when the clip is not a mappable polygon', () => {
    const px = { corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#fff', clip: 'polygon(0px 0px, 10px 0px, 5px 10px)' };
    const ellipse = { corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#fff', clip: 'ellipse(50% 50% at 50% 50%)' };
    expect(faceListToMesh([px]).vertexCount).toBe(6);
    expect(faceListToMesh([ellipse]).vertexCount).toBe(6);
  });

  describe('coplanar depth stagger (z-fight de-collision)', () => {
    const plane = () => ({ corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#888' });

    it('leaves a lone face on its plane exactly where it was authored', () => {
      const { positions } = faceListToMesh([plane()]);
      for (let i = 1; i < positions.length; i += 3) expect(positions[i]).toBe(0); // y untouched
    });

    it('lifts the second of two coincident coplanar faces off the shared plane', () => {
      const { positions, vertexCount } = faceListToMesh([plane(), plane()]);
      expect(vertexCount).toBe(12);
      for (let i = 1; i < 18; i += 3) expect(positions[i]).toBe(0);   // face A stays on y=0
      const bY = [];
      for (let i = 18 + 1; i < positions.length; i += 3) bY.push(positions[i]);
      expect(Math.min(...bY)).toBeGreaterThan(0);                     // face B separated → no shared depth
      expect(Math.max(...bY)).toBeLessThan(0.01);                     // but sub-pixel (mean edge 2 → 1e-3)
      expect(positions[18]).toBe(0); expect(positions[20]).toBe(0);   // pure depth shift: x/z untouched
    });

    it('staggers a stack of three monotonically (0, ε, 2ε)', () => {
      const { positions } = faceListToMesh([plane(), plane(), plane()]);
      const y = (face, vert) => positions[(face * 6 + vert) * 3 + 1];
      expect(y(0, 0)).toBe(0);
      expect(y(1, 0)).toBeGreaterThan(0);
      expect(y(2, 0)).toBeCloseTo(2 * y(1, 0), 9);                    // third lifted twice the second
    });

    it('does NOT move faces that share a normal but lie on different planes', () => {
      const a = { corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#888' }; // y=0
      const b = { corners: [[0, 5, 0], [2, 5, 0], [2, 5, 2], [0, 5, 2]], fill: '#888' }; // y=5
      const { positions } = faceListToMesh([a, b]);
      for (let i = 1; i < 18; i += 3) expect(positions[i]).toBe(0);   // first stays at y=0
      for (let i = 18 + 1; i < positions.length; i += 3) expect(positions[i]).toBe(5); // second stays at y=5
    });
  });

  describe('decollideFaces (cross-group depth stagger)', () => {
    const plane = () => ({ corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#888' });
    const zOf = (f) => f.corners[0][1]; // these quads live on the y=0 plane; lift is in +y

    it('returns the first face on a plane unchanged (same reference)', () => {
      const a = plane();
      const out = decollideFaces([a]);
      expect(out[0]).toBe(a);                                 // untouched, not even copied
    });

    it('lifts each later coincident face a sub-pixel step along the normal', () => {
      const out = decollideFaces([plane(), plane(), plane()]);
      expect(zOf(out[0])).toBe(0);
      expect(zOf(out[1])).toBeGreaterThan(0);
      expect(zOf(out[1])).toBeLessThan(0.01);                 // sub-pixel (mean edge 2 → 1e-3)
      expect(zOf(out[2])).toBeCloseTo(2 * zOf(out[1]), 9);    // monotonic stack
    });

    it('separates coincident faces that belong to DIFFERENT render groups', () => {
      // the per-group-bake gap this exists to close: two groups, one coincident face each
      const out = decollideFaces([{ ...plane(), group: 'base' }, { ...plane(), group: 'trim' }]);
      expect(zOf(out[0])).toBe(0);
      expect(zOf(out[1])).toBeGreaterThan(0);                 // lifted despite the differing group
    });

    it('does NOT stagger coplanar tiles that only touch (tessellation must stay flat)', () => {
      // a flat surface split into two adjacent tiles sharing the x=2 edge — the regression a
      // plane-only bucket got wrong (it terraced tessellated tops into a staircase)
      const t1 = { corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#888' };
      const t2 = { corners: [[2, 0, 0], [4, 0, 0], [4, 0, 2], [2, 0, 2]], fill: '#888' };
      const out = decollideFaces([t1, t2]);
      expect(out[0]).toBe(t1); expect(out[1]).toBe(t2); // both untouched → surface stays flat
    });

    it('lifts a face only one step above the tiles it actually overlaps', () => {
      // two flat tiles (no overlap) + an inlay covering part of both → inlay is ord 1, not ord 2
      const t1 = { corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#888' };
      const t2 = { corners: [[2, 0, 0], [4, 0, 0], [4, 0, 2], [2, 0, 2]], fill: '#888' };
      const inlay = { corners: [[1, 0, 0.5], [3, 0, 0.5], [3, 0, 1.5], [1, 0, 1.5]], fill: '#ccc' };
      const out = decollideFaces([t1, t2, inlay]);
      expect(out[0]).toBe(t1); expect(out[1]).toBe(t2);   // base tiles untouched
      const lift = out[2].corners[0][1];                  // inlay lifted in +y
      expect(lift).toBeGreaterThan(0);
      const inlayScale = (2 + 1 + 2 + 1) / 4;             // mean edge of the 2×1 inlay
      expect(lift).toBeCloseTo(1 * inlayScale * 5e-4, 9); // exactly ONE step, not two
    });

    it('leaves faces on distinct parallel planes alone', () => {
      const a = { corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill: '#888' }; // y=0
      const b = { corners: [[0, 5, 0], [2, 5, 0], [2, 5, 2], [0, 5, 2]], fill: '#888' }; // y=5
      const out = decollideFaces([a, b]);
      expect(out[0]).toBe(a); expect(out[1]).toBe(b);         // both first-on-plane → untouched
    });

    it('is idempotent — a second pass moves nothing further', () => {
      const once = decollideFaces([plane(), plane()]);
      const twice = decollideFaces(once);
      expect(zOf(twice[1])).toBeCloseTo(zOf(once[1]), 9);
    });
  });

  describe('border-radius tessellation', () => {
    // A wall-plane quad in z (corner0=bottom-left zlo, corner3=top-left zTop) — the frame
    // scene-css3d's arch()/archF() author windows in.
    const archWin = (radius) => ({ corners: [[0, 0, 0], [2, 0, 0], [2, 0, 4], [0, 0, 4]], fill: '#ffffff', radius });

    it('outlines an arched window (rounded world-top corners) as a fan, not a 6-vert quad', () => {
      // BR + BL rounded (the v=1 / world-top edge); TL + TR sharp.
      const mesh = faceListToMesh([archWin('0 0 50% 50% / 0 0 38% 38%')]);
      expect(mesh.faceCount).toBe(1);
      expect(mesh.vertexCount).toBeGreaterThan(6);   // fan-triangulated, not a flat quad
      expect(mesh.vertexCount % 3).toBe(0);
    });

    it('keeps every tessellated vertex inside the face bounds and on its plane', () => {
      const mesh = faceListToMesh([archWin('0 0 50% 50% / 0 0 38% 38%')]);
      for (let i = 0; i < mesh.positions.length; i += 3) {
        const x = mesh.positions[i], y = mesh.positions[i + 1], z = mesh.positions[i + 2];
        expect(y).toBeCloseTo(0, 6);                 // stays on the wall plane (y=0)
        expect(x).toBeGreaterThanOrEqual(-1e-6);
        expect(x).toBeLessThanOrEqual(2 + 1e-6);
        expect(z).toBeGreaterThanOrEqual(-1e-6);
        expect(z).toBeLessThanOrEqual(4 + 1e-6);
      }
    });

    it('rounds the world-TOP corners (the arch curves at zTop, base stays square)', () => {
      const mesh = faceListToMesh([archWin('0 0 50% 50% / 0 0 38% 38%')]);
      const zs = [];
      for (let i = 0; i < mesh.positions.length; i += 3) zs.push(mesh.positions[i + 2]);
      // the two sharp base corners (z=0) are present; nothing pokes above zTop=4
      expect(Math.min(...zs)).toBeCloseTo(0, 6);
      expect(Math.max(...zs)).toBeLessThanOrEqual(4 + 1e-6);
      // the curve lifts geometry into the upper half (an apex near zTop)
      expect(Math.max(...zs)).toBeGreaterThan(3);
    });

    it("treats a full '50%' radius as a disc (dharma wheel)", () => {
      const mesh = faceListToMesh([archWin('50%')]);
      expect(mesh.vertexCount).toBeGreaterThan(12);  // a ring of segments around the centre
      // bounded by the face — an inscribed ellipse touches but never exceeds the edges
      for (let i = 0; i < mesh.positions.length; i += 3) {
        expect(mesh.positions[i]).toBeLessThanOrEqual(2 + 1e-6);
        expect(mesh.positions[i + 2]).toBeLessThanOrEqual(4 + 1e-6);
      }
    });

    it('falls back to the plain quad for px-unit radii and all-zero radius', () => {
      expect(faceListToMesh([archWin('8px')]).vertexCount).toBe(6);
      expect(faceListToMesh([archWin('0 0 0 0')]).vertexCount).toBe(6);
      expect(faceListToMesh([archWin('0')]).vertexCount).toBe(6);
    });

    it('lets a clip polygon win when a face carries both clip and radius', () => {
      const both = { corners: [[0, 0, 0], [4, 0, 0], [4, 0, 2], [0, 0, 2]], fill: '#fff', clip: 'polygon(0% 0%, 100% 0%, 25.0% 100%)', radius: '50%' };
      expect(faceListToMesh([both]).vertexCount).toBe(3); // the clip triangle, not the disc
    });
  });
});

describe('collectGlowSprites', () => {
  // an emissiveFixture-shaped face: warm hex fill + a box-shadow glow marker
  const fixture = {
    corners: [[0, 0, 4], [2, 0, 4], [2, 0, 4], [0, 0, 4]], // centroid (1,0,4)
    fill: '#ff8040',
    glow: '0 0 22px 10px rgba(255,128,64,0.55)',
    clip: 'ellipse(50% 50%)',
  };

  it('emits one sprite per glow-tagged face, ignoring plain faces', () => {
    const plain = { corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], fill: '#222' };
    const sprites = collectGlowSprites([fixture, plain]);
    expect(sprites).toHaveLength(1);
  });

  it('places the sprite at the face centroid with the fill colour (sRGB 0..1)', () => {
    const [s] = collectGlowSprites([fixture]);
    expect(s.pos).toEqual([1, 0, 4]);
    expect(s.color[0]).toBeCloseTo(1, 5);       // ff
    expect(s.color[1]).toBeCloseTo(128 / 255, 5); // 80
    expect(s.color[2]).toBeCloseTo(64 / 255, 5);  // 40
  });

  it('derives size from the glow blur+spread and applies the scale multiplier', () => {
    const base = collectGlowSprites([fixture])[0].size;        // 2.5 + (22+10)/11
    expect(base).toBeCloseTo(2.5 + 32 / 11, 5);
    expect(collectGlowSprites([fixture], { scale: 2 })[0].size).toBeCloseTo(base * 2, 5);
  });

  it('ignores a glow face without a usable hex fill', () => {
    expect(collectGlowSprites([{ ...fixture, fill: undefined }])).toHaveLength(0);
    expect(collectGlowSprites([{ ...fixture, fill: 'rgba(1,2,3,1)' }])).toHaveLength(0);
  });
});

describe('collectShadowDecals', () => {
  it('uses a contact decal face (decal:"shadow") quad verbatim, with its alpha', () => {
    const floorQuad = [[0, 0, 0.02], [2, 0, 0.02], [2, 2, 0.02], [0, 2, 0.02]];
    const out = collectShadowDecals([{ corners: floorQuad, decal: 'shadow', shadowAlpha: 0.42 }]);
    expect(out).toHaveLength(1);
    expect(out[0].quad).toEqual(floorQuad);
    expect(out[0].alpha).toBeCloseTo(0.42, 5);
  });

  it('builds a cast-shadow sub-quad centred on the hit uv, sized by spread', () => {
    // a 10×10 floor face; shadow hit at centre (uv 0.5,0.5), spread small
    const floor = { corners: [[0, 0, 0], [10, 0, 0], [10, 10, 0], [0, 10, 0]], fill: '#777',
      shadowDecal: { uv: [0.5, 0.5], spread: 0.1, alpha: 0.5 } };
    const [d] = collectShadowDecals([floor]);
    expect(d).toBeTruthy();
    // centroid of the built quad sits at the hit point (5,5)
    const cx = d.quad.reduce((s, p) => s + p[0], 0) / 4, cy = d.quad.reduce((s, p) => s + p[1], 0) / 4;
    expect(cx).toBeCloseTo(5, 5);
    expect(cy).toBeCloseTo(5, 5);
    // sized to ~r = spread*2.2+0.16 = 0.38 of the 10-unit face → ~3.8 wide
    const w = Math.max(...d.quad.map((p) => p[0])) - Math.min(...d.quad.map((p) => p[0]));
    expect(w).toBeCloseTo((0.1 * 2.2 + 0.16) * 10, 4);
  });

  it('ignores faces with neither marker', () => {
    expect(collectShadowDecals([{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#777' }])).toHaveLength(0);
  });
});
