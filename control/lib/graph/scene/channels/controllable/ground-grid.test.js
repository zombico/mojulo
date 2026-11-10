import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gridIndex, gridFit, gridRayDown, gridRayCast, groundGridScript } from './ground-grid.js';

// THE GROUND BY GRID: a straight-down ray finds the same heights under a point as testing every triangle does.

// a bumpy ground of 40 by 40 metres in 1 m quads (two triangles each), and a wall standing on it (vertical: no height)
function patch() {
  const pos = [], idx = [], h = (x, y) => Math.sin(x * 0.7) * 0.5 + Math.cos(y * 0.4) * 0.3;
  for (let j = 0; j <= 40; j++) for (let i = 0; i <= 40; i++) pos.push(i - 20, j - 20, h(i - 20, j - 20));
  for (let j = 0; j < 40; j++) for (let i = 0; i < 40; i++) { const a = j * 41 + i, b = a + 1, c = a + 41, d = c + 1; idx.push(a, b, d, a, d, c); }
  const w = pos.length / 3; pos.push(0, 0, 0, 5, 0, 0, 5, 0, 3, 0, 0, 3); idx.push(w, w + 1, w + 2, w, w + 2, w + 3);
  return { pos: Float32Array.from(pos), idx: Uint32Array.from(idx) };
}
// the brute force: every triangle tested
function every(pos, idx, x, y, z) {
  const out = [], G = { x0: -1e9, y0: -1e9, cell: 2e9, nx: 1, ny: 1, cells: [Array.from({ length: idx.length / 3 }, (_, t) => t)] };
  return gridRayDown(G, pos, idx, x, y, z).map((h) => +h.z.toFixed(6)).concat(out);
}

describe('the ground by grid', () => {
  it('finds under each point the heights every triangle finds, nearest first, and no wall', () => {
    const { pos, idx } = patch(), G = gridIndex(pos, idx, 2);
    for (const [x, y] of [[0.3, 0.7], [-12.4, 9.1], [19.5, -19.5], [2.5, 0.0001], [7.77, -3.21]]) {
      const got = gridRayDown(G, pos, idx, x, y, 10).map((h) => +h.z.toFixed(6));
      expect(got).toEqual(every(pos, idx, x, y, 10));
      expect(got.length).toBeGreaterThan(0);
    }
    // (nothing above the ray's origin, nothing off the patch)
    expect(gridRayDown(G, pos, idx, 0.3, 0.7, -5)).toEqual([]);
    expect(gridRayDown(G, pos, idx, 50, 50, 10)).toEqual([]);
    // and it tests a cell's few triangles, not the patch's 3,200
    expect(Math.max(...G.cells.filter(Boolean).map((c) => c.length))).toBeLessThan(40);
    // a fitted grid halves its cells till its fullest is light, and finds the same heights
    const fullest = (g) => Math.max(...g.cells.filter(Boolean).map((c) => c.length));
    const F = gridFit(pos, idx, 12);
    expect(F.cell).toBeLessThan(2);
    expect(fullest(F)).toBeLessThanOrEqual(12);
    expect(fullest(F)).toBeLessThan(fullest(G));
    // (never finer than a quarter metre, however crowded)
    expect(gridFit(pos, idx, 1).cell).toBe(0.25);
    expect(gridRayDown(F, pos, idx, -12.4, 9.1, 10).map((h) => +h.z.toFixed(6))).toEqual(every(pos, idx, -12.4, 9.1, 10));
  });

  it('a slanting ray meets what three\'s own raycast meets, nearest first, each face as its material shows it', async () => {
    const THREE = await import(pathToFileURL(path.join(process.cwd(), 'public/vendor/three/three.module.min.js')).href);
    const { pos, idx } = patch(), G = gridFit(pos, idx, 12), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    // (the camera's rays: from a head height, slanting down past the wall, along it, level, from off the patch, straight up)
    const rays = [[[1, -4, 1.6], [0.2, 1, -0.1], 12], [[-3, -0.5, 1.5], [1, 0.02, 0.05], 20], [[-30, 2.37, 2], [1, 0, -0.03], 80],
      [[2.5, 3, 1], [0, 0, 1], 10], [[6, 6, 2], [-1, -1, -0.4], 15], [[2, 4, 1.7], [0.05, -1, 0.02], 0.5]];
    for (const [side, S] of [[0, THREE.FrontSide], [1, THREE.BackSide], [2, THREE.DoubleSide]]) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: S })); mesh.updateMatrixWorld(true);
      for (const [o, dd, far] of rays) {
        const d = new THREE.Vector3(...dd).normalize(), rc = new THREE.Raycaster(new THREE.Vector3(...o), d, 0, far), want = [];
        mesh.raycast(rc, want);
        want.sort((p, q) => p.distance - q.distance);
        const got = gridRayCast(G, pos, idx, { x: o[0], y: o[1], z: o[2] }, d, 0, far, side);
        expect(got.map((h) => [h.f, +h.t.toFixed(4)])).toEqual(want.map((h) => [h.faceIndex, +h.distance.toFixed(4)]));
      }
    }
    // (the wall seen from either face: its front alone, its back alone, both)
    const at = (side) => gridRayCast(G, pos, idx, { x: 2.5, y: -3, z: 1 }, { x: 0, y: 1, z: 0 }, 0, 6, side).length;
    expect(at(0) + at(1)).toBe(at(2));
    expect(at(2)).toBe(1);
  });

  it('the page script parses, its index and test the module\'s own', () => {
    const src = groundGridScript();
    expect(src).toContain('const __gridIndex = function gridIndex(');
    expect(src).toContain('__gridIndex(pos, idx, 2)');
    // (every call the fitter makes is the page's own index, none to a name the page lacks)
    const fit = src.slice(src.indexOf('const __gridFit'), src.indexOf('const __gridSlow'));
    expect(fit).not.toMatch(/[^_]gridIndex\(/);
    expect(() => new Function('THREE', 'scene', `${src}\nreturn __gridRaycast;`)({ Mesh: { prototype: { raycast() {} } }, Matrix4: function () {} }, {})).not.toThrow();
  });
});
