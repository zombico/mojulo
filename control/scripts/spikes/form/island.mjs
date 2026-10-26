// THE PATHLESS ISLAND, READ IN THE FORM RENDER (gen-7's first composed scene): the geocube island's land, one recipe,
// drawn twice from the same camera. Left, gen-6: each face's fill, the light baked in, drawn unlit (as the World page
// draws it). Right, gen-7: each face's material (form/land-form.js: the cube's colour for its class, no light), lit by
// one sun at the cube's hour and the sky, its shadow map drawn once; the sea a glossy surface with the sky in it, the sand
// under its line wet. The sun can be moved to show the right side is lit (never to animate the hour).
// `window.measure()` is the machine gate: cliff faces turned to the hour's sun against those turned away, wet sand
// against dry, in both halves, and the shadow passes drawn. The look is the operator's.
//
//   node scripts/spikes/form/island.mjs [--out <file.html>] [--cube island-noon] [--cdn]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href, pathToFileURL(`${CONTROL}/`).href);
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { readGeocube } = await import('../../../lib/graph/era/geocube.js');
const { landForm, LAND_CLASSES, DEEP_FADE } = await import('../../../lib/graph/form/land-form.js');
const { b64, safeJson, CDN_IMPORTMAP, inlineImportmap } = await import('../../../lib/graph/scene/emit-util.js');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'island.html')), cube = arg('--cube', 'island-noon'), cdn = process.argv.includes('--cdn');

const { payload: P } = await resolveWorldScene({ title: 'island', manifest: { kind: 'geocube', cube, show: 'land' } }, {});
const colour = readGeocube(cube).colour, sun = P.sky.sun.dir;
const L = landForm(P.faces, colour, { seed: 1 });

// faces ordered by their material (a class, wet or dry), triangulated as fans, each corner carrying both halves' colours
// and the gate's bucket: 1 a cliff turned to the hour's sun, 2 one turned away, 3 wet sand, 4 dry sand
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const keyOf = (i) => { const F = L.faces[i]; return F.cls ? `${F.cls}${F.under ? ':under' : F.wet ? ':wet' : ''}` : 'unread'; };
const order = P.faces.map((_, i) => i).sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : a - b));
const dot = (n) => n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2];
const pos = [], c6 = [], c7 = [], bk = [], ranges = [];
for (const i of order) {
  const f = P.faces[i], F = L.faces[i], key = keyOf(i), n = f.normal || [0, 0, 1];
  const bucket = F.cls === 'cliff' ? (dot(n) >= 0.5 ? 1 : dot(n) <= 0.05 ? 2 : 0) : F.cls === 'sand' && !F.under ? (F.wet ? 3 : 4) : 0;
  const fills = f.cornerFills || f.corners.map(() => f.fill), alpha = f.cornerAlpha || f.corners.map(() => 1);
  const base = F.cls ? F.base : hexRgb(f.fill);
  let R = ranges[ranges.length - 1];
  if (!R || R.key !== key) ranges.push(R = { key, start: pos.length / 3, count: 0, rough: F.cls ? F.rough : 0.9 });
  for (let k = 1; k + 1 < f.corners.length; k++) for (const j of [0, k, k + 1]) {
    pos.push(...f.corners[j]); c6.push(...hexRgb(fills[j]), Math.round(alpha[j] * 255)); c7.push(...base, Math.round(alpha[j] * 255)); bk.push(bucket); R.count += 1;
  }
}
// the shadow's frame: what stands above the water, not the sea's floor or the sea to the horizon
const land = P.faces.filter((f, i) => L.faces[i].cls && L.faces[i].cls !== 'water' && !L.faces[i].under).flatMap((f) => f.corners);
const sea = P.faces.filter((f, i) => L.faces[i].cls === 'water').flatMap((f) => f.corners), seaX = sea.map((c) => c[0]), seaY = sea.map((c) => c[1]);
const box = [0, 1, 2].map((k) => [Math.min(...land.map((c) => c[k])), Math.max(...land.map((c) => c[k]))]);
// the SHORE: a camera standing on the wet line looking along the beach, and a low sun ahead along it (where a glint shows
// and the island, to one side, shades nothing); the beach chosen in code, the wet face furthest out on the island
// camera's side
const isle = P.cameras.find((c) => c.name === 'island')?.worldFraming.lookAt || [0, 0, 0];
const wetMids = P.faces.flatMap((f, i) => (L.faces[i].wet && !L.faces[i].under ? [[0, 1, 2].map((k) => f.corners.reduce((a, c) => a + c[k], 0) / f.corners.length)] : []));
const shoreAt = wetMids.reduce((a, m) => (m[0] > a[0] ? m : a), wetMids[0]);
const out2 = [shoreAt[0] - isle[0], shoreAt[1] - isle[1]], ol = Math.hypot(...out2), d2 = out2.map((v) => v / ol);
const along = [-d2[1], d2[0]];
const shore = { name: 'shore', cameraPosition: [shoreAt[0] + d2[0], shoreAt[1] + d2[1], shoreAt[2] + 1.7], lookAt: [shoreAt[0] + along[0] * 25, shoreAt[1] + along[1] * 25, L.waterZ], horizontalFov: 70 };
const shoreSun = [Math.round((Math.atan2(along[1], along[0]) - Math.atan2(sun[1], sun[0])) * 180 / Math.PI), 10];
const data = {
  cube, sun, sky: { zenith: P.sky.zenith, horizon: P.sky.horizon }, haze: P.haze, box, waterZ: L.waterZ, unread: L.unread, deep: L.deep,
  seabed: { x: [Math.min(...seaX), Math.max(...seaX)], y: [Math.min(...seaY), Math.max(...seaY)], z: L.waterZ - DEEP_FADE - 1 },
  water: colour.water, classes: Object.fromEntries(Object.entries(LAND_CLASSES).map(([k, C]) => [k, C.rough])),
  cameras: [...P.cameras.map((c) => ({ name: c.name, ...c.worldFraming })), shore], shoreSun, ranges,
  pos: b64(Float32Array.from(pos)), c6: b64(Uint8Array.from(c6)), c7: b64(Uint8Array.from(c7)), bk: b64(Uint8Array.from(bk)),
};
const importmap = cdn ? CDN_IMPORTMAP : inlineImportmap();

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Island in Gen 7</title>
<style>
  :root { --bg: #15171c; --panel: #1d2028; --line: #2c313c; --fg: #e8eaee; --muted: #9aa1ae; --accent: #f0b35a; color-scheme: dark; }
  html, body { height: 100%; margin: 0; } body { background: var(--bg); color: var(--fg); font: 13px/1.4 system-ui, sans-serif; display: flex; flex-direction: column; }
  header { display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: center; padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--line); }
  h1 { font-size: 15px; margin: 0; } label { display: flex; gap: 8px; align-items: center; color: var(--muted); }
  input[type=range] { width: 130px; accent-color: var(--accent); } select, button { background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; font: inherit; }
  #wrap { flex: 1; position: relative; min-height: 0; } canvas { display: block; width: 100%; height: 100%; }
  .tags { position: absolute; left: 0; right: 0; top: 10px; display: grid; grid-template-columns: 1fr 1fr; text-align: center; pointer-events: none; }
  .tags b { display: block; } .tags span { color: var(--muted); font-size: 12px; } .tags div { text-shadow: 0 1px 3px #000a; }
</style></head><body>
<header><h1>Island in Gen 7</h1>
  <label for="cam">camera <select id="cam"></select></label>
  <label for="az">sun turned <input id="az" type="range" min="-180" max="180" value="0"></label>
  <label for="el">sun height <input id="el" type="range" min="4" max="88" value="0"></label>
  <button id="hour" type="button">the hour's sun</button>
</header>
<div id="wrap"><canvas id="c"></canvas>
  <div class="tags"><div><b>gen-6</b><span>the fills: light baked in, drawn unlit</span></div><div><b>gen-7</b><span>the cube's colours, lit by the sun and the sky</span></div></div>
</div>
<script type="importmap">${importmap}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const D = ${safeJson(data)};
const bytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
// (the fills and colours are sRGB bytes; three's vertex colours are linear)
const LIN = Float32Array.from({ length: 256 }, (_, v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
const linear = (b) => Float32Array.from(b, (v, i) => (i % 4 === 3 ? v / 255 : LIN[v]));
const POS = new Float32Array(bytes(D.pos).buffer), C6 = linear(bytes(D.c6)), C7 = linear(bytes(D.c7)), BK = bytes(D.bk);
const cv = document.getElementById('c'), renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
const rgb = (a) => new THREE.Color().setRGB(a[0] / 255, a[1] / 255, a[2] / 255, THREE.SRGBColorSpace);

// the sky: a dome from the horizon's colour to the zenith's, behind both halves and the gen-7 side's light and reflections
function skyDome() {
  const g = new THREE.SphereGeometry(4000, 48, 24), p = g.attributes.position, col = new Float32Array(p.count * 3), z = rgb(D.sky.zenith), h = rgb(D.sky.horizon);
  for (let i = 0; i < p.count; i++) { const t = Math.pow(Math.max(0, p.getZ(i) / 4000), 0.6), c = h.clone().lerp(z, t); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.rotateX(0);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
}
function part(R, colours, extra = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(POS.subarray(R.start * 3, (R.start + R.count) * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(colours.subarray(R.start * 4, (R.start + R.count) * 4), 4));
  if (extra.bucket) g.setAttribute('bucket', new THREE.BufferAttribute(BK.subarray(R.start, R.start + R.count), 1));
  return g;
}
const fog = () => new THREE.FogExp2(new THREE.Color(D.haze.color), D.haze.density);

// gen-6: the fills as they are, unlit and untouched by the tone curve
const six = new THREE.Scene(); six.fog = fog(); six.add(skyDome());
for (const R of D.ranges) {
  const water = R.key === 'water';
  six.add(new THREE.Mesh(part(R, C6), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: water, depthWrite: !water, side: THREE.DoubleSide, toneMapped: false })));
}
// gen-7: the material, lit
const seven = new THREE.Scene(); seven.fog = fog(); seven.add(skyDome());
const pm = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(); envScene.add(skyDome());
seven.environment = pm.fromScene(envScene, 0, 1, 6000).texture; seven.environmentIntensity = 0.8;
let wetMat = null;
// (three's sun: a face square to it shows its colour × intensity / π, so near π shows the material as it is)
const sunLight = new THREE.DirectionalLight(0xfff4e2, 3.4); sunLight.castShadow = true;
const [bx, by, bz] = D.box, mid = new THREE.Vector3((bx[0] + bx[1]) / 2, (by[0] + by[1]) / 2, (bz[0] + bz[1]) / 2), rad = Math.hypot(bx[1] - bx[0], by[1] - by[0], bz[1] - bz[0]) / 2;
Object.assign(sunLight.shadow.camera, { left: -rad, right: rad, top: rad, bottom: -rad, near: 0.5, far: rad * 4 });
sunLight.shadow.mapSize.set(4096, 4096); sunLight.shadow.bias = -0.0004; sunLight.shadow.normalBias = 0.04;
sunLight.target.position.copy(mid); seven.add(sunLight, sunLight.target);
for (const R of D.ranges) {
  const water = R.key === 'water';
  const m = water
    ? new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: R.rough, metalness: 0, transparent: true, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2 })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: R.rough, metalness: 0, flatShading: true, side: THREE.DoubleSide });
  const g = part(R, C7); if (water) g.computeVertexNormals();   // (the land is shaded flat, its normals the faces'; the sea's are its own)
  const mesh = new THREE.Mesh(g, m); mesh.castShadow = !water; mesh.receiveShadow = true; seven.add(mesh);
  if (R.key === 'sand:wet') wetMat = m;
}
// open sea: deep water's colour under it, where the recipe lays no floor (the shallows' floor fades into the same colour)
{ const B = D.seabed, g = new THREE.PlaneGeometry(B.x[1] - B.x[0], B.y[1] - B.y[0]); g.translate((B.x[0] + B.x[1]) / 2, (B.y[0] + B.y[1]) / 2, B.z);
  seven.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: rgb(D.deep), roughness: 1, metalness: 0 }))); }
// the gate's buckets: a flat pass, each face in its bucket's colour, the sea hiding what is under it
const ids = new THREE.Scene(); ids.background = new THREE.Color(0);
const idMat = new THREE.ShaderMaterial({ vertexShader: 'attribute float bucket; varying float b; void main() { b = bucket; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'varying float b; void main() { gl_FragColor = vec4(b / 255.0, 0.0, 0.0, 1.0); }', side: THREE.DoubleSide });
for (const R of D.ranges) ids.add(new THREE.Mesh(part(R, C7, { bucket: true }), idMat));

// the sun: the hour's, turned and raised from it by the sliders
const hourAz = Math.atan2(D.sun[1], D.sun[0]), hourEl = Math.asin(D.sun[2]);
const az = document.getElementById('az'), el = document.getElementById('el');
el.value = Math.round(hourEl * 180 / Math.PI);
// (the shadow passes counted where three draws them: once per placing of the sun, never per frame)
let shadowPasses = 0, frames = 0;
const SM = renderer.shadowMap, drawShadow = SM.render;
SM.render = function (lights, ...rest) { if (SM.needsUpdate && lights.length) shadowPasses += 1; return drawShadow.call(this, lights, ...rest); };
function setSun(azDeg, elDeg) {
  const a = hourAz + azDeg * Math.PI / 180, e = elDeg * Math.PI / 180, d = new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e));
  sunLight.position.copy(mid).addScaledVector(d, rad * 2); sunLight.target.updateMatrixWorld();
  renderer.shadowMap.needsUpdate = true;
  return d;
}
const sunNow = () => setSun(Number(az.value), Number(el.value));
az.oninput = el.oninput = () => { sunNow(); draw(); };
document.getElementById('hour').onclick = () => { az.value = 0; el.value = Math.round(hourEl * 180 / Math.PI); sunNow(); draw(); };

// the camera: the cube's own framings, z up
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 9000); camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, cv); controls.addEventListener('change', () => draw());
const sel = document.getElementById('cam'); for (const c of D.cameras) sel.add(new Option(c.name, c.name));
let hfov = 58;
function frame(name) {
  const c = D.cameras.find((k) => k.name === name) || D.cameras[0]; hfov = c.horizontalFov;
  camera.position.set(...c.cameraPosition); controls.target.set(...c.lookAt); controls.update(); draw();
}
sel.onchange = () => frame(sel.value);

function size() { const w = cv.clientWidth, h = cv.clientHeight; renderer.setSize(w, h, false); return [w, h]; }
function fit(w, h) { camera.aspect = w / h; camera.fov = 2 * Math.atan(Math.tan(hfov * Math.PI / 360) / camera.aspect) * 180 / Math.PI; camera.updateProjectionMatrix(); }
function draw() {
  const [w, h] = size(), half = Math.floor(w / 2); fit(half, h); renderer.setScissorTest(true);
  renderer.setViewport(0, 0, half, h); renderer.setScissor(0, 0, half, h); renderer.render(six, camera);
  renderer.setViewport(half, 0, w - half, h); renderer.setScissor(half, 0, w - half, h); renderer.render(seven, camera);
  renderer.setScissorTest(false); frames += 1;
}
addEventListener('resize', draw);

// the machine gate: each half drawn to a target the size of one half, the bucket pass beside it, each bucket's mean
// luminance (and the wet and dry sand's brightest twentieth, where a glint shows)
function readScene(scene, w, h, linear) {
  const rt = new THREE.WebGLRenderTarget(w, h, { colorSpace: linear ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace });
  renderer.setRenderTarget(rt); renderer.render(scene, camera); const px = new Uint8Array(w * h * 4); renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
  renderer.setRenderTarget(null); rt.dispose(); return px;
}
function buckets(px, id) {
  const S = {}; for (let i = 0; i < id.length; i += 4) { const b = id[i]; if (!b) continue; const y = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; (S[b] ??= []).push(y); }
  const name = { 1: 'cliffToSun', 2: 'cliffAway', 3: 'wetSand', 4: 'drySand' }, out = {};
  for (const [b, ys] of Object.entries(S)) { ys.sort((a, c) => a - c); out[name[b]] = { px: ys.length, mean: +(ys.reduce((a, c) => a + c, 0) / ys.length).toFixed(1), top: +ys[Math.floor(ys.length * 0.95)].toFixed(1), peak: +ys[Math.floor(ys.length * 0.99)].toFixed(1) }; }
  return out;
}
window.measure = ({ camera: name, sun } = {}) => {
  if (name) frame(name);
  const before = [Number(az.value), Number(el.value)];
  sun ??= [0, Math.round(hourEl * 180 / Math.PI)]; az.value = sun[0]; el.value = sun[1];
  sunNow(); const w = 640, h = 480; fit(w, h);
  const id = readScene(ids, w, h, true), g6 = buckets(readScene(six, w, h), id), g7 = buckets(readScene(seven, w, h), id);
  // the wet band's sheen: the same view with its roughness the dry sand's, so what remains is what the wet's gloss adds
  let sheen = null;
  if (wetMat && g7.wetSand) { const r = wetMat.roughness; wetMat.roughness = D.classes.sand; const matte = buckets(readScene(seven, w, h), id).wetSand; wetMat.roughness = r; sheen = { glossy: g7.wetSand, matte }; }
  az.value = before[0]; el.value = before[1]; sunNow(); draw();
  return { camera: name || sel.value, sun, gen6: g6, gen7: g7, sheen, shadowPasses, frames, unread: D.unread };
};
window.shoreSun = D.shoreSun; window.ready = true;
setSun(0, hourEl * 180 / Math.PI); frame(D.cameras[0].name);
</script></body></html>`;
fs.writeFileSync(out, html);
console.log(`${out}: ${(html.length / 1e6).toFixed(1)} MB, ${P.faces.length} faces, ${data.ranges.map((r) => `${r.key} ${r.count / 3}`).join(', ')}; unread ${L.unread}; water at ${L.waterZ}`);
