// THE BRICK WALL THREE WAYS (the gen-7 form render's first measurement): one dressed brick tile shown side by side
// under one sun you can move. (a) the paint (matte-paint/dressed.js: the light baked in, drawn unlit, as gen-6 draws
// it); (b) the material (form/relief-material.js: base colour without light, normal, occlusion and roughness, lit by
// the renderer); (c) the bond as polygons (form/bond.js: each brick proud of its mortar, casting into the joint) with the
// material's fine relief. `window.measure()` reads the mortar under a brick's lower edge against the brick's face in
// (b) and (c): the machine gate. The look is the operator's.
//
//   node scripts/spikes/form/brick-three-ways.mjs [--out <file.html>] [--cdn] [--size 1024]
import fs from 'node:fs';
import path from 'node:path';
import { dressedTile, dressedMaterial } from '../../../lib/graph/matte-paint/dressed.js';
import { brickBond, brickFaces } from '../../../lib/graph/form/bond.js';
import { encodePng } from '../../../lib/graph/landscape/surface-textures.js';
import { CDN_IMPORTMAP, inlineImportmap } from '../../../lib/graph/scene/emit-util.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('--out', 'brick-three-ways.html'), cdn = process.argv.includes('--cdn'), size = Number(arg('--size', 1024));
const CFG = { cut: 'brick', stone: [158, 74, 52], mortar: [196, 188, 172], rows: 26, cols: 9, metres: 2, grit: 0.3, vary: 26 };
const WALL = { width: 1.2, height: 1.6 };

const png = (rgb) => `data:image/png;base64,${encodePng(rgb, size, size).toString('base64')}`;
const painted = dressedTile(CFG, { size, seed: 7 }), mat = dressedMaterial(CFG, { size, seed: 7, rough: 0.82 });
const bond = brickBond(CFG, WALL), faces = brickFaces(bond);
const data = {
  wall: WALL, metres: CFG.metres, joint: bond.joint, mortar: bond.mortar,
  tex: { painted: png(painted.rgb), base: png(mat.baseColor), normal: png(mat.normal), orm: png(mat.orm) },
  faces: faces.map((f) => ({ c: f.corners.flat(), n: f.n, m: f.part === 'mortar' ? 1 : 0 })),
  probes: bond.bricks.filter((b) => b.z0 > 0.2 && b.x1 - b.x0 > 0.15).slice(0, 24).map((b) => ({ x: (b.x0 + b.x1) / 2, face: (b.z0 + b.z1) / 2, joint: b.z0 - bond.joint / 2 })),
};
const importmap = cdn ? CDN_IMPORTMAP : inlineImportmap();

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Brick Wall Three Ways</title>
<style>
  :root { --bg: #15171c; --panel: #1d2028; --line: #2c313c; --fg: #e8eaee; --muted: #9aa1ae; --accent: #f0b35a; color-scheme: dark; }
  html, body { height: 100%; margin: 0; } body { background: var(--bg); color: var(--fg); font: 13px/1.4 system-ui, sans-serif; display: flex; flex-direction: column; }
  header { display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: center; padding: 10px max(16px, env(safe-area-inset-left, 0px)); background: var(--panel); border-bottom: 1px solid var(--line); }
  h1 { font-size: 15px; margin: 0; } label { display: flex; gap: 8px; align-items: center; color: var(--muted); } input[type=range] { width: 140px; accent-color: var(--accent); }
  #wrap { flex: 1; position: relative; min-height: 0; } canvas { display: block; width: 100%; height: 100%; }
  .tags { position: absolute; left: 0; right: 0; bottom: 12px; display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; pointer-events: none; }
  .tags b { display: block; color: var(--fg); } .tags span { color: var(--muted); font-size: 12px; }
</style></head><body>
<header><h1>Brick Wall Three Ways</h1>
  <label for="az">sun from the side <input id="az" type="range" min="-80" max="80" value="-35"></label>
  <label for="el">sun height <input id="el" type="range" min="5" max="85" value="35"></label>
</header>
<div id="wrap"><canvas id="c"></canvas>
  <div class="tags"><div><b>(a) paint</b><span>light baked in, drawn unlit (gen-6)</span></div><div><b>(b) material</b><span>colour, normal, occlusion, roughness: lit live</span></div><div><b>(c) polygons</b><span>each brick proud of its mortar, + fine relief</span></div></div>
</div>
<script type="importmap">${importmap}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const D = ${JSON.stringify(data)};
const cv = document.getElementById('c'), renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x15171c);
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50); camera.position.set(1.95, -4.6, 0.95); 
const controls = new OrbitControls(camera, cv); controls.target.set(1.95, 0, 0.8); controls.update();
scene.add(new THREE.HemisphereLight(0xcfd8ea, 0x4a4036, 0.55));
const sun = new THREE.DirectionalLight(0xfff3e0, 2.6); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.1, far: 20 }); sun.shadow.bias = -0.00002; sun.shadow.normalBias = 0.0005;
scene.add(sun, sun.target); sun.target.position.set(1.95, 0, 0.8);
const loader = new THREE.TextureLoader(), load = (u, srgb) => new Promise((r) => loader.load(u, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; r(t); }));
const [painted, base, normal, orm] = await Promise.all([load(D.tex.painted, true), load(D.tex.base, true), load(D.tex.normal), load(D.tex.orm)]);
const W = D.wall.width, H = D.wall.height, M = D.metres, GAP = 0.15;
// a flat wall's plane, its uv the tile's (u along, v so the wall's top is the tile's row 0)
const plane = () => { const g = new THREE.PlaneGeometry(W, H); const uv = g.attributes.uv; const p = g.attributes.position; for (let i = 0; i < uv.count; i++) { const x = p.getX(i) + W / 2, z = p.getY(i) + H / 2; uv.setXY(i, x / M, 1 - (H - z) / M); } return g; };
const place = (o, k) => { o.rotation.x = Math.PI / 2; o.position.set(k * (W + GAP) + W / 2, 0, H / 2); return o; };
const A = place(new THREE.Mesh(plane(), new THREE.MeshBasicMaterial({ map: painted })), 0); A.receiveShadow = true;
const mB = new THREE.MeshStandardMaterial({ map: base, normalMap: normal, aoMap: orm, roughnessMap: orm, metalnessMap: orm, metalness: 1, roughness: 1 });
const B = place(new THREE.Mesh(plane(), mB), 1); B.receiveShadow = true; B.castShadow = true;
// (c): the bond's faces, uv from their position on the wall (the same mapping)
const pos = [], nor = [], uvs = [], idx = [];
for (const f of D.faces) { const c = f.c, base0 = pos.length / 3; for (let i = 0; i < 4; i++) { const x = c[i * 3], y = c[i * 3 + 1], z = c[i * 3 + 2]; pos.push(x, y, z); nor.push(...f.n); uvs.push(x / M, 1 - (H - z) / M); } const e1 = [c[3] - c[0], c[4] - c[1], c[5] - c[2]], e2 = [c[6] - c[0], c[7] - c[1], c[8] - c[2]], gn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; if (gn[0] * f.n[0] + gn[1] * f.n[1] + gn[2] * f.n[2] >= 0) idx.push(base0, base0 + 1, base0 + 2, base0, base0 + 2, base0 + 3); else idx.push(base0, base0 + 2, base0 + 1, base0, base0 + 3, base0 + 2); }
const gC = new THREE.BufferGeometry(); gC.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gC.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); gC.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); gC.setIndex(idx);
gC.computeTangents?.();
const C = new THREE.Mesh(gC, new THREE.MeshStandardMaterial({ map: base, normalMap: normal, aoMap: orm, roughnessMap: orm, metalnessMap: orm, metalness: 1, roughness: 1 }));
C.position.set(2 * (W + GAP), 0, 0); C.castShadow = true; C.receiveShadow = true;
scene.add(A, B, C);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ color: 0x3a3f3a, roughness: 1 })); ground.position.set(1.95, -1.2, 0); ground.receiveShadow = true; scene.add(ground);
const setSun = (az, el) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; sun.position.set(1.95 + 6 * Math.cos(e) * Math.sin(a), -6 * Math.cos(e) * Math.cos(a), 0.8 + 6 * Math.sin(e)); };
const azI = document.getElementById('az'), elI = document.getElementById('el');
const sync = () => setSun(+azI.value, +elI.value); azI.oninput = elI.oninput = sync; sync();
const size = () => { const w = cv.clientWidth, h = cv.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
addEventListener('resize', size); size();
const frame = () => { controls.update(); renderer.render(scene, camera); };
renderer.setAnimationLoop(frame);
// THE MACHINE GATE: under the sun as set, each probe brick's face against the mortar just under its lower edge, in (b)
// and (c), read off the canvas square on (an orthographic eye on the wall)
window.measure = (az = 0, el = 35) => {
  setSun(az, el); const eye = new THREE.OrthographicCamera(-0.6, 0.6, 0.8, -0.8, 0.1, 20), pr = Math.min(2, devicePixelRatio || 1);
  const read = (k) => {
    eye.position.set(k * (W + GAP) + W / 2, -5, H / 2); eye.lookAt(k * (W + GAP) + W / 2, 0, H / 2); eye.updateProjectionMatrix(); renderer.render(scene, eye);
    const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4);
    const lum = (x, z) => { const v = new THREE.Vector3(k * (W + GAP) + x, 0, z).project(eye); gl.readPixels(Math.round((v.x + 1) / 2 * w), Math.round((v.y + 1) / 2 * h), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]; };
    const r = D.probes.map((p) => lum(p.x, p.joint) / Math.max(1, lum(p.x, p.face)));
    return +(r.reduce((s, v) => s + v, 0) / r.length).toFixed(3);
  };
  const m = { material: read(1), polygons: read(2), sun: { az, el } }; sync(); return m;
};
window.__ready = true;
</script></body></html>`;
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, html);
console.log(`wrote ${out}: ${(html.length / 1e6).toFixed(2)} MB, ${bond.bricks.length} bricks, ${faces.length} faces`);
