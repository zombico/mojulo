/**
 * scene-three — the World renderer: emit a self-contained, TRAVERSABLE HTML page
 * that draws a baked scene with three.js (WebGL) and lets the operator move
 * through it (OrbitControls). Sibling to `emitPreserve3dScene` in scene-css3d.js;
 * both consume the SAME engine-agnostic payload from `assembleBoxCityScene`:
 *
 *   { faces, cameras, viewBox, unitScale, title, bg, sky }
 *
 * The CSS-3D emitter is the "looked at / preset-shot" Scene tier; this is the
 * "moved through" World tier (see docs split: Scene→SVG/PNG, World→live canvas).
 *
 * three.js is vendored under /public/vendor/three. Two delivery modes:
 *   • default — importmap points at the control server's /vendor/three (small page,
 *     offline-safe on the self-hosted control plane). This is how the live /world
 *     route serves it. NOT openable as a bare file:// — ES modules need an origin.
 *   • inline:true — three.module + core + OrbitControls are read off disk and
 *     embedded as data:-URL modules in the importmap, so the page is a SELF-CONTAINED
 *     artifact that runs anywhere (file://, emailed, dropped in a spike folder) with
 *     no server. Bigger (three is ~0.9MB base64), but portable. Use for minted /
 *     downloadable World artifacts.
 *
 * Lighting is already baked into the face colours, so the mesh renders UNLIT
 * (MeshBasicMaterial + vertexColors). World coords are z-up; we set camera.up=+Z
 * and feed `worldFraming` straight through with no remapping. unitScale is a
 * CSS-projection artifact and is intentionally unused here (world units are used
 * directly).
 */

import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { faceListToMesh, faceColorLinear } from './face-mesh.js';
import { expandSurfaceCards } from './facade-card.js';

const VENDOR_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/vendor/three');

// Server-served importmap (default): three loads from the control plane's /vendor.
const VENDOR_IMPORTMAP = JSON.stringify({
  imports: {
    three: '/vendor/three/three.module.min.js',
    'three/addons/': '/vendor/three/addons/',
  },
});

const dataModule = (src) => `data:text/javascript;base64,${Buffer.from(src, 'utf8').toString('base64')}`;

// Self-contained importmap: read the vendored three off disk and embed each module
// as a data: URL. three.module.min.js imports './three.core.min.js' relatively — we
// rewrite that to a bare specifier the map also resolves, so the whole module graph
// (three → three-core, OrbitControls → three) lives entirely in data: URLs and runs
// with no server / no file:// CORS fetch.
function inlineImportmap() {
  const core = readFileSync(path.join(VENDOR_DIR, 'three.core.min.js'), 'utf8');
  const mod = readFileSync(path.join(VENDOR_DIR, 'three.module.min.js'), 'utf8')
    .split('./three.core.min.js').join('three-core');
  const orbit = readFileSync(path.join(VENDOR_DIR, 'addons/controls/OrbitControls.js'), 'utf8');
  return JSON.stringify({
    imports: {
      'three-core': dataModule(core),
      three: dataModule(mod),
      'three/addons/controls/OrbitControls.js': dataModule(orbit),
    },
  });
}

function b64(typedArray) {
  return Buffer.from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength).toString('base64');
}

// horizontal fov (deg) + aspect → vertical fov (deg) for THREE.PerspectiveCamera
function verticalFov(hFovDeg, aspect) {
  const h = (hFovDeg || 60) * Math.PI / 180;
  const v = 2 * Math.atan(Math.tan(h / 2) / (aspect || 1));
  return v * 180 / Math.PI;
}

/**
 * Emit a traversable three.js World page.
 * @param {object} payload  { faces, cameras, viewBox, title, bg, sky }
 */
export function emitThreeWorld({ faces = [], cameras = [], viewBox = { width: 1120, height: 780 }, title = 'mojulo world', bg = '#0e1014', inline = false } = {}) {
  const W = viewBox.width, H = viewBox.height;
  const aspect = W / H;
  const importmap = inline ? inlineImportmap() : VENDOR_IMPORTMAP;
  const mesh = faceListToMesh(expandSurfaceCards(faces));

  // Cameras → traversal bookmarks. Fall back to a 3/4 orbit framing of the
  // geometry's bounding sphere when a world ships no worldFraming camera.
  const cams = (cameras.length ? cameras : [null]).map((cam, i) => {
    const wf = cam && cam.worldFraming;
    if (wf && Array.isArray(wf.cameraPosition) && Array.isArray(wf.lookAt)) {
      return { name: cam.name || `view ${i}`, pos: wf.cameraPosition, target: wf.lookAt, vfov: verticalFov(wf.horizontalFov, aspect) };
    }
    const [cx, cy, cz] = mesh.center;
    const r = mesh.radius || 20;
    return { name: 'orbit', pos: [cx + r * 1.1, cy - r * 1.1, cz + r * 0.8], target: [cx, cy, cz], vfov: verticalFov(55, aspect) };
  });

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0b1220;color:#cfe3ff;font:13px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center}
  #wrap{position:relative;width:${W}px;height:${H}px;max-width:100%;aspect-ratio:${W} / ${H};overflow:hidden}
  canvas{display:block;width:100%;height:100%}
  .hud{position:absolute;left:8px;top:8px;display:flex;gap:6px;flex-wrap:wrap}
  .hud button{color:#9cc4ff;background:rgba(11,18,32,.6);border:1px solid #24324a;border-radius:5px;padding:4px 10px;cursor:pointer;font:inherit}
  .hud button.on{background:#1b2740;color:#fff}
  .hint{position:absolute;right:8px;bottom:8px;color:#6f86ad;font-size:11px;user-select:none}
</style></head><body>
  <div id="wrap"><canvas id="c"></canvas>
    <div class="hud" id="hud"></div>
    <div class="hint">drag to orbit · scroll to zoom · right-drag to pan</div>
  </div>
<script type="importmap">${importmap}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const POS = decodeF32("${b64(mesh.positions)}");
const COL = decodeF32("${b64(mesh.colors)}");
const CAMS = ${JSON.stringify(cams)};
const BG = ${JSON.stringify(bg)};
function decodeF32(s){ const bin=atob(s); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return new Float32Array(u.buffer); }

const wrap = document.getElementById('wrap'), canvas = document.getElementById('c'), hud = document.getElementById('hud');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(POS, 3));
geo.setAttribute('color', new THREE.BufferAttribute(COL, 3));
geo.computeBoundingSphere();
const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
scene.add(new THREE.Mesh(geo, mat));

const camera = new THREE.PerspectiveCamera(CAMS[0].vfov, wrap.clientWidth / wrap.clientHeight, 0.05, 8000);
camera.up.set(0, 0, 1); // world is z-up
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

function applyCam(i){
  const c = CAMS[i];
  camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
  controls.target.set(c.target[0], c.target[1], c.target[2]);
  camera.fov = c.vfov; camera.updateProjectionMatrix();
  controls.update();
  [...hud.children].forEach((b, k) => b.classList.toggle('on', k === i));
}
CAMS.forEach((c, i) => { const b = document.createElement('button'); b.textContent = c.name; b.onclick = () => applyCam(i); hud.appendChild(b); });

function resize(){
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
applyCam(0);
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
</script>
</body></html>
`;
}

// Pack one frame's faces into a COMPACT payload: 4 quantised corners per face
// (Uint16 over a shared bound) + ONE linear colour per face (Uint8). This exploits
// the figure's flat shading + fixed topology — the naive triangle-soup encoding
// (6 Float32 verts/face, colour duplicated per vertex) is ~5× larger and, at the
// figure's real density (~17k faces), blows a 24-frame loop past 75MB (proven in
// figure-world.spike.test.js). The browser re-expands corners → two tris and
// fans the per-face colour onto all 6 verts. See figure-world.plan.md.
function packFigureFrames(frames) {
  const all = frames.map((fr) => expandSurfaceCards(fr.faces || []).filter((f) => f && f.corners && f.corners.length >= 4));
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const ff of all) for (const f of ff) for (const c of f.corners) for (let k = 0; k < 3; k++) {
    if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k];
  }
  if (!Number.isFinite(mn[0])) { mn[0] = mn[1] = mn[2] = 0; mx[0] = mx[1] = mx[2] = 1; }
  const ext = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1;
  const scale = 65000 / ext;                 // Uint16 fixed-point over the shared bound
  const pos = [], col = [];
  for (const ff of all) {
    const p = new Uint16Array(ff.length * 4 * 3);
    const c = new Uint8Array(ff.length * 3);
    let pi = 0, ci = 0;
    for (const f of ff) {
      for (const corner of f.corners) for (let k = 0; k < 3; k++) p[pi++] = Math.round((corner[k] - mn[k]) * scale);
      const [lr, lg, lb] = faceColorLinear(f);
      c[ci++] = Math.round(lr * 255); c[ci++] = Math.round(lg * 255); c[ci++] = Math.round(lb * 255);
    }
    pos.push(b64(p)); col.push(b64(c));
  }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  const radius = 0.5 * Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1;
  return { pos, col, origin: mn, invScale: 1 / scale, center, radius };
}

/**
 * Emit a live three.js page that PLAYS a posed-figure motion: one BufferGeometry
 * per frame, hard-swapped on a clock, with play/pause + a scrub slider, over the
 * same OrbitControls camera as emitThreeWorld. Sibling to emitThreeWorld — that
 * renders one static World; this renders a frame sequence (figure-world.plan.md).
 *
 * The figure is z-up and faces +y, so the default camera sits on +y (the front)
 * slightly above mid-body and the operator orbits from there. Frames use the
 * compact per-face encoding (packFigureFrames) and the browser re-expands them.
 *
 * @param {object} payload { frames:[{faces}], viewBox, title, bg, fps, inline }
 */
export function emitFigureWorld({ frames = [], viewBox = { width: 720, height: 960 }, title = 'figure world', bg = '#0e1014', fps = 24, inline = false } = {}) {
  const W = viewBox.width, H = viewBox.height;
  const aspect = W / H;
  const importmap = inline ? inlineImportmap() : VENDOR_IMPORTMAP;
  const packed = packFigureFrames(frames);
  const { center: [cx, cy, cz], radius: r } = packed;
  const cam = { pos: [cx, cy + r * 2.0, cz + r * 0.12], target: [cx, cy, cz], vfov: verticalFov(40, aspect) };
  const POS = JSON.stringify(packed.pos);
  const COL = JSON.stringify(packed.col);
  const ORIGIN = JSON.stringify(packed.origin);
  const INV = packed.invScale;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0b1220;color:#cfe3ff;font:13px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center}
  #wrap{position:relative;width:${W}px;height:${H}px;max-width:100%;aspect-ratio:${W} / ${H};overflow:hidden}
  canvas{display:block;width:100%;height:100%}
  .hud{position:absolute;left:8px;top:8px;right:8px;display:flex;gap:8px;align-items:center}
  .hud button{color:#9cc4ff;background:rgba(11,18,32,.6);border:1px solid #24324a;border-radius:5px;padding:4px 10px;cursor:pointer;font:inherit}
  .hud input[type=range]{flex:1;accent-color:#9cc4ff}
  .hud .lbl{color:#6f86ad;font-size:11px;min-width:54px;text-align:right;font-variant-numeric:tabular-nums}
  .hint{position:absolute;right:8px;bottom:8px;color:#6f86ad;font-size:11px;user-select:none}
</style></head><body>
  <div id="wrap"><canvas id="c"></canvas>
    <div class="hud">
      <button id="play">⏸</button>
      <input id="scrub" type="range" min="0" max="${Math.max(0, packed.pos.length - 1)}" value="0" step="1">
      <span class="lbl" id="lbl">1 / ${packed.pos.length}</span>
    </div>
    <div class="hint">drag to orbit · scroll to zoom · right-drag to pan</div>
  </div>
<script type="importmap">${importmap}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const FRAMES_POS = ${POS};   // base64 Uint16, 4 corners/face (quantised)
const FRAMES_COL = ${COL};   // base64 Uint8, one linear rgb/face
const ORIGIN = ${ORIGIN}, INV = ${INV};
const CAM = ${JSON.stringify(cam)};
const BG = ${JSON.stringify(bg)};
const FPS = ${fps};
const N = FRAMES_POS.length;
function bytes(s){ const bin=atob(s); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u; }
const TRI = [0,1,2,0,2,3];

const wrap = document.getElementById('wrap'), canvas = document.getElementById('c');
const playBtn = document.getElementById('play'), scrub = document.getElementById('scrub'), lbl = document.getElementById('lbl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);

// Re-expand a packed frame: dequantise corners, fan the per-face colour over the
// two triangles (6 verts/face). Topology is fixed, so each frame is a clean swap.
function buildGeo(posB64, colB64){
  const q = new Uint16Array(bytes(posB64).buffer);
  const col8 = bytes(colB64);
  const nFace = col8.length / 3;
  const pos = new Float32Array(nFace * 6 * 3);
  const col = new Float32Array(nFace * 6 * 3);
  let o = 0;
  for (let f = 0; f < nFace; f++){
    const cb = f * 4 * 3;
    const r = col8[f*3]/255, g = col8[f*3+1]/255, b = col8[f*3+2]/255;
    for (let t = 0; t < 6; t++){
      const k = TRI[t] * 3;
      pos[o]   = ORIGIN[0] + q[cb + k]     * INV;
      pos[o+1] = ORIGIN[1] + q[cb + k + 1] * INV;
      pos[o+2] = ORIGIN[2] + q[cb + k + 2] * INV;
      col[o] = r; col[o+1] = g; col[o+2] = b;
      o += 3;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}
const geos = FRAMES_POS.map((p, i) => buildGeo(p, FRAMES_COL[i]));
const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
const mesh = new THREE.Mesh(geos[0], mat);
scene.add(mesh);

const camera = new THREE.PerspectiveCamera(CAM.vfov, wrap.clientWidth / wrap.clientHeight, 0.05, 8000);
camera.up.set(0, 0, 1); // world is z-up
camera.position.set(CAM.pos[0], CAM.pos[1], CAM.pos[2]);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(CAM.target[0], CAM.target[1], CAM.target[2]);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.update();

let frame = 0, playing = N > 1, acc = 0, last = 0;
function show(i){
  frame = ((i % N) + N) % N;
  mesh.geometry = geos[frame];
  scrub.value = String(frame);
  lbl.textContent = (frame + 1) + ' / ' + N;
}
playBtn.textContent = playing ? '⏸' : '▶';
playBtn.onclick = () => { playing = !playing; playBtn.textContent = playing ? '⏸' : '▶'; };
scrub.oninput = () => { playing = false; playBtn.textContent = '▶'; show(Number(scrub.value)); };

function resize(){
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
renderer.setAnimationLoop((t) => {
  if (playing && N > 1) {
    if (last) { acc += (t - last) / 1000; const adv = Math.floor(acc * FPS); if (adv) { acc -= adv / FPS; show(frame + adv); } }
    last = t;
  } else { last = t; }
  controls.update();
  renderer.render(scene, camera);
});
</script>
</body></html>
`;
}
