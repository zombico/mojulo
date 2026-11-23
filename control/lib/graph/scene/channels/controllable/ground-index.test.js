// The ground's index (ground-index.js): the ground probe reads the surfaces over its cell and finds what the full-scene ray
// found: on a big floor (its own grid), a deck placed by a transform, instanced steps, under a decoration that is no
// footing, past a body, over a far plane wider than the index; and a deck that moves is found where it now stands.
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { indexBuckets, bucketsAt, groundIndexScript } from './ground-index.js';
import { groundGridScript } from './ground-grid.js';

describe('the ground\'s index', () => {
  it('buckets each box by the cells it meets, a box wider than the index in every cell', () => {
    const B = indexBuckets([{ id: 0, box: [0, 0, 3, 3] }, { id: 1, box: [5, 5, 9, 9] }, { id: 2, box: [-5000, -5000, 5000, 5000] }], 4);
    expect(bucketsAt(B, 1, 1).sort()).toEqual([0, 2]);
    expect(bucketsAt(B, 7, 7).sort()).toEqual([1, 2]);
    expect(bucketsAt(B, 900, 900)).toEqual([2]);                          // (off the index: the wide ones alone)
  });

  it('finds the ground the full-scene ray finds, and a surface that moves where it now stands', async () => {
    const THREE = await import(pathToFileURL(path.join(process.cwd(), 'public/vendor/three/three.module.min.js')).href);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), mat = new THREE.MeshBasicMaterial();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40, 60, 60), mat); scene.add(floor);   // (7200 triangles: the grid's)
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.4), mat); deck.position.set(8, 0, 2); scene.add(deck);
    const steps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, 3); [0, 1, 2].forEach((k) => steps.setMatrixAt(k, new THREE.Matrix4().makeTranslation(-6, k * 1.2, 0.5 + k * 0.5))); scene.add(steps);
    const veil = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), mat); veil.position.set(0, 0, 3); veil.raycast = () => {}; scene.add(veil);   // (a decoration: no footing)
    const body = new THREE.Group(); const bm = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 2), mat); bm.position.z = 1; body.add(bm); body.position.set(2, 2, 0); scene.add(body);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), mat); far.position.z = -3; scene.add(far);
    scene.updateMatrixWorld(true);
    const world = { time: 0 }, own = [body];
    const page = new Function('THREE', 'scene', 'camera', '__world', `${groundGridScript()}
const __rayRoots = (own) => scene.children.filter((c) => !own.includes(c));
${groundIndexScript()}
__gridMeshes();
return { ground: __giGround, bake: __giBake };`)(THREE, scene, camera, world);
    // (the full-scene ray: what the probe was)
    const R = new THREE.Raycaster();
    const ref = (p) => { R.set(new THREE.Vector3(p[0], p[1], p[2] + 0.05), new THREE.Vector3(0, 0, -1)); R.camera = camera; for (const h of R.intersectObjects(scene.children.filter((c) => !own.includes(c)), true)) { if (!h.object.isMesh) continue; return h.point.z; } return null; };
    const pts = [];
    for (let x = -12; x <= 12; x += 1.7) for (let y = -12; y <= 12; y += 1.9) pts.push([x, y, 6]);
    pts.push([2, 2, 6], [8, 0, 6], [-6, 2.4, 6], [-6, 1.2, 1.3], [900, 900, 6]);
    page.bake(own);
    for (const p of pts) expect(page.ground(p, own), String(p)).toBeCloseTo(ref(p), 6);
    expect(page.ground([8, 0, 6], own)).toBeCloseTo(2.2, 6);                 // (the deck's top)
    expect(page.ground([0, 0, 6], own)).toBeCloseTo(0, 6);                   // (the floor, under the decoration)
    expect(page.ground([900, 900, 6], own)).toBeCloseTo(-3, 6);              // (the far plane, off the index)
    // the deck moves: found where it now stands, gone from where it was
    deck.position.set(-10, -8, 1); deck.updateMatrixWorld(true); world.time = 1;
    expect(page.ground([-10, -8, 6], own)).toBeCloseTo(1.2, 6);
    expect(page.ground([8, 0, 6], own)).toBeCloseTo(ref([8, 0, 6]), 6);
    for (const p of pts) expect(page.ground(p, own), String(p)).toBeCloseTo(ref(p), 6);
  });
});
