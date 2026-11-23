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
    expect(() => new Function('THREE', 'scene', `${src}\nreturn __gridRaycast;`)({ Mesh: { prototype: { raycast() {} } }, Matrix4: function () {}, Sphere: function () {}, Ray: function () {}, Vector3: function () {} }, {})).not.toThrow();
  });
});

// THE GRID FOR EVERY BIG MESH: one placed by a transform (moved, turned, scaled, even mirrored) and one of several
// materials take the grid, the ray carried into the mesh's own frame and each face its own group's side; what a ray finds
// is what three's own raycast finds.
describe('the grid for every big mesh', () => {
  it('a placed, a mirrored and a two-material mesh: the grid finds what three finds, down rays and slanting ones', async () => {
    const path = await import('node:path'), { pathToFileURL } = await import('node:url');
    const THREE = await import(pathToFileURL(path.join(process.cwd(), 'public/vendor/three/three.module.min.js')).href);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
    const lumpy = () => { const g = new THREE.PlaneGeometry(20, 20, 50, 50), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 0.7) * Math.cos(p.getY(i) * 0.5)); g.computeVertexNormals(); return g; };
    const placed = new THREE.Mesh(lumpy(), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    placed.position.set(5, -3, 2); placed.rotation.set(0.3, -0.2, 0.9); placed.scale.set(1.2, 0.8, 1.5);
    const mirrored = new THREE.Mesh(lumpy(), new THREE.MeshBasicMaterial());
    mirrored.position.set(-20, 0, 1); mirrored.scale.set(-1, 1, 1);
    const g2 = lumpy(); g2.clearGroups(); const half = g2.index.count / 2; g2.addGroup(0, half, 0); g2.addGroup(half, g2.index.count - half, 1);
    const two = new THREE.Mesh(g2, [new THREE.MeshBasicMaterial({ side: THREE.FrontSide }), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })]);
    two.position.set(0, 25, 0);
    scene.add(placed, mirrored, two); scene.updateMatrixWorld(true);
    const page = new Function('THREE', 'scene', `${groundGridScript()}\n__gridMeshes();\nreturn __gridRaycast;`)(THREE, scene);
    expect([placed, mirrored, two].every((m) => m.raycast === page)).toBe(true);
    const R = new THREE.Raycaster();
    let rnd = 7; const r = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
    let met = 0;
    for (const m of [placed, mirrored, two]) {
      const c = new THREE.Vector3().setFromMatrixPosition(m.matrixWorld);
      for (let k = 0; k < 60; k++) {
        const o = new THREE.Vector3(c.x + (r() - 0.5) * 16, c.y + (r() - 0.5) * 16, c.z + 8);
        const d = k % 3 === 0 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(r() - 0.5, r() - 0.5, -1 - r()).normalize();
        if (k % 5 === 4) { o.z = c.z - 8; d.z = -d.z; }                       // (from below: a face's back)
        R.set(o, d); R.camera = camera;
        const grid = []; page.call(m, R, grid); grid.sort((a, b) => a.distance - b.distance);
        const own = []; THREE.Mesh.prototype.raycast.call(m, R, own); own.sort((a, b) => a.distance - b.distance);
        expect(grid.length, `${k}`).toBe(own.length);
        for (let i = 0; i < own.length; i++) { expect(grid[i].distance).toBeCloseTo(own[i].distance, 4); expect(grid[i].point.distanceTo(own[i].point)).toBeLessThan(1e-3); }
        met += own.length;
      }
    }
    expect(met).toBeGreaterThan(60);
  });
});

// THE GRID SIZED TO ITS MESH: a flight's land 16 km across and a race's backdrop 12 km, made of few big triangles, were
// gridded at 2 m (36 to 67 million cells, each triangle listed in tens of thousands): the page died before its first
// frame. A grid now stays within sixteen cells and thirty-two listings a triangle, coarsening as it must, and finds what three
// finds; a small mesh keeps the grid it had.
describe('the grid sized to its mesh', () => {
  // a land of `q` by `q` quads, `size` metres across, gently rolling
  function land(size, q) {
    const pos = [], idx = [], s = size / q, h = (x, y) => 40 * Math.sin(x / 900) * Math.cos(y / 700);
    for (let j = 0; j <= q; j++) for (let i = 0; i <= q; i++) { const x = i * s - size / 2, y = j * s - size / 2; pos.push(x, y, h(x, y)); }
    for (let j = 0; j < q; j++) for (let i = 0; i < q; i++) { const a = j * (q + 1) + i, b = a + 1, c = a + q + 1, d = c + 1; idx.push(a, b, d, a, d, c); }
    return { pos: Float32Array.from(pos), idx: Uint32Array.from(idx) };
  }
  const listed = (g) => g.cells.reduce((m, c) => m + (c ? c.length : 0), 0);

  it('a flight\'s land and a race\'s backdrop stay within the limits, and a small ground keeps its 2 m grid', () => {
    for (const [size, q] of [[16384, 48], [12000, 103]]) {
      const { pos, idx } = land(size, q), G = gridFit(pos, idx);
      expect(G.nx * G.ny).toBeLessThanOrEqual(Math.max(1 << 14, idx.length / 3 * 16));
      expect(listed(G)).toBeLessThanOrEqual(Math.max(1 << 16, idx.length / 3 * 32));
      expect(G.cell).toBeGreaterThan(2);
      // (and a down ray still finds the land under it)
      expect(gridRayDown(G, pos, idx, 1234.5, -987.6, 1000).length).toBe(1);
    }
    // a crowded corner on a big land: the halving stops at the limits, not at a quarter metre over 16 km
    const big = land(16384, 48), pile = [], pi = [], base = big.pos.length / 3;
    for (let k = 0; k < 3000; k++) { pile.push(10, 10, k * 0.01, 10.5, 10, k * 0.01, 10, 10.5, k * 0.01); pi.push(base + k * 3, base + k * 3 + 1, base + k * 3 + 2); }
    const pos = Float32Array.from([...big.pos, ...pile]), idx = Uint32Array.from([...big.idx, ...pi]), C = gridFit(pos, idx);
    expect(C.nx * C.ny).toBeLessThanOrEqual(Math.max(1 << 14, idx.length / 3 * 16));
    expect(listed(C)).toBeLessThanOrEqual(Math.max(1 << 16, idx.length / 3 * 32));
    // a 300 by 200 m track ground in 2 m quads keeps the 2 m grid it always had
    const track = land(300, 150);
    expect(gridFit(track.pos, track.idx).cell).toBe(2);
  });

  it('on the coarse grid a ray meets what three\'s own raycast meets', async () => {
    const THREE = await import(pathToFileURL(path.join(process.cwd(), 'public/vendor/three/three.module.min.js')).href);
    const { pos, idx } = land(16384, 48), G = gridFit(pos, idx), geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); mesh.updateMatrixWorld(true);
    // (a plane's view: down from altitude, a long shallow look over the land, a climb that meets nothing)
    for (const [o, dd, far] of [[[300, -200, 800], [0, 0, -1], 2000], [[-5013.7, -3987.2, 600], [1, 0.8, -0.12], 9000], [[0, 0, 300], [0.3, 0.1, 1], 5000], [[7000, 6100, 120], [-1, -0.83, -0.02], 20000]]) {
      const d = new THREE.Vector3(...dd).normalize(), rc = new THREE.Raycaster(new THREE.Vector3(...o), d, 0, far), want = [];
      mesh.raycast(rc, want); want.sort((p, q) => p.distance - q.distance);
      const got = gridRayCast(G, pos, idx, { x: o[0], y: o[1], z: o[2] }, d, 0, far, 2);
      expect(got.map((h) => [h.f, +h.t.toFixed(2)])).toEqual(want.map((h) => [h.faceIndex, +h.distance.toFixed(2)]));
    }
  });
});
