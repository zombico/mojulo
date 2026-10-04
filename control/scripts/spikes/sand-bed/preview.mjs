// Walkable soft ground (sand, snow, mud): footprints from gait edges, a pushable crate that plows. Self-contained page (three.js inlined
// through the World page's own importmap helper), same kernel closure Node verifies.
import { buildSandBed, SOFT_GROUNDS } from './kernel.mjs';
import { inlineImportmap } from '../../../lib/graph/scene/emit-util.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const output = resolve(process.argv[2] || 'scripts/spikes/sand-bed/preview.html');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Soft ground walk</title>
<style>:root{color-scheme:light}*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;background:#d9e2ea;font:14px system-ui;color:#1d2228}
canvas{display:block;width:100vw;height:100vh;touch-action:none}
#hud{position:fixed;top:12px;left:12px;width:min(330px,calc(100vw - 24px));background:rgba(255,255,255,.86);backdrop-filter:blur(6px);border-radius:12px;padding:12px 14px;box-shadow:0 4px 18px rgba(0,0,0,.12)}
#hud h1{font-size:17px;margin:0 0 2px}#hud p{margin:4px 0;color:#4a5560;line-height:1.4;font-size:12.5px}
#hud label{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:7px 0 0;font-size:13px}
select,button{font:inherit;font-size:13px;padding:5px 8px;border-radius:7px;border:1px solid #b9c3cc;background:#fff;color:#1d2228;cursor:pointer}
input[type=range]{width:120px;accent-color:#b88a3e}.row{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;margin-top:10px;font:12px ui-monospace,monospace;color:#5b4520}
#keys{position:fixed;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(29,34,40,.78);color:#f3efe6;padding:7px 14px;border-radius:999px;font-size:13px;white-space:nowrap}
@media(max-width:600px){#keys{white-space:normal;width:calc(100vw - 24px);text-align:center;border-radius:12px}}</style>
<script type="importmap">${inlineImportmap()}</script></head><body>
<div id="hud"><h1>Soft ground</h1><p id="blurb"></p>
<label>Ground <select id="kind"><option value="dry-sand">Dry sand</option><option value="damp-sand" selected>Damp sand</option><option value="fresh-snow">Fresh snow</option><option value="mud">Mud</option></select></label>
<label>Foot sink <input id="sink" type="range" min="0.01" max="0.16" step="0.005" value="0.03"><span id="sinkV"></span></label>
<div class="row"><button id="auto">Auto-walk: off</button><button id="reset">Smooth the bed</button></div>
<div class="stats"><span>prints <b id="prints">0</b></span><span>awake <b id="awake">0</b></span><span>sand <b id="vol">0</b></span><span>ms/tick <b id="cost">0</b></span></div></div>
<div id="keys">WASD / arrows walk · Shift run · drag to orbit · walk into the crate to push it</div>
<script type="module">
import * as THREE from 'three';
const buildSandBed = ${buildSandBed.toString()}, GROUNDS = ${JSON.stringify(SOFT_GROUNDS)};
const COLS = 400, ROWS = 400, CELL = 0.025, ORIGIN = [-5, -5], DEPTH = 0.3;
const $ = id => document.getElementById(id);
// Gentle hard-ground swell under the sand, faded to flat at the edges so the bed meets the surround plane.
function makeBase() {
  const b = new Float64Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = ORIGIN[0] + c * CELL, y = ORIGIN[1] + r * CELL;
    const edge = Math.min(c, r, COLS - 1 - c, ROWS - 1 - r) * CELL, w = Math.min(1, edge / 1.6), s = w * w * (3 - 2 * w);
    b[r * COLS + c] = s * (0.11 * Math.sin(x * 0.62 + 0.4) + 0.07 * Math.cos(y * 0.47 + 0.25 * x));
  }
  return b;
}
const BASE = makeBase();
// How each ground looks; the physics is all in GROUNDS. Churned material darkens; packed snow goes faintly blue.
const LOOK = {
  'dry-sand': { color: [0.86, 0.74, 0.54], churn: 0.9, rough: 1, surround: '#d8bf91',
    blurb: 'Dry sand: no cohesion, so print walls slump to the sliding angle and leave soft dimples. Every grain pushed out of a print lands in its rim.' },
  'damp-sand': { color: [0.68, 0.57, 0.41], churn: 0.88, rough: 0.95, surround: '#ad946c',
    blurb: 'Damp sand: the same friction plus a little capillary cohesion, so print walls stand and the rim keeps its crest. Switch to dry and the prints slump.' },
  'fresh-snow': { color: [0.95, 0.97, 1.0], churn: 0.94, packed: [0.78, 0.86, 0.98], rough: 0.9, surround: '#eef2f7',
    blurb: 'Fresh snow compacts instead of displacing: each boot crushes powder into a packed layer, the hole keeps vertical walls and the rim is small. Walk the same line again and it firms into a trail.' },
  mud: { color: [0.34, 0.26, 0.19], churn: 0.82, rough: 0.42, surround: '#4f3d2c',
    blurb: 'Mud is incompressible and viscous: every print squeezes up a thick rim, then the over-steep walls ooze back over a second or so, leaving a softened dent.' },
};
const ground = () => $('kind').value;
const newBed = () => buildSandBed({ cols: COLS, rows: ROWS, cell: CELL, origin: ORIGIN, base: BASE, depth: DEPTH, ...GROUNDS[ground()] });
let bed = newBed(), bedKind = ground();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#d9e2ea');
scene.fog = new THREE.Fog('#d9e2ea', 9, 26);
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 80);
camera.up.set(0, 0, 1);
scene.add(new THREE.HemisphereLight('#eef4fb', '#b59a6e', 0.85));
const sun = new THREE.DirectionalLight('#fff1d6', 2.1);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 });
sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);
const SUN = new THREE.Vector3(-0.62, -0.42, 0.34).normalize();   // low sun: grazing light reads shallow prints

// Sand mesh: one vertex per bed point; only the dirty rows re-upload.
const N = COLS * ROWS, pos = new Float32Array(N * 3), nrm = new Float32Array(N * 3), col = new Float32Array(N * 3);
const idx = new Uint32Array((COLS - 1) * (ROWS - 1) * 6);
for (let r = 0, k = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS - 1; c++) {
  const i = r * COLS + c; idx.set([i, i + 1, i + COLS + 1, i, i + COLS + 1, i + COLS], k); k += 6;
}
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3).setUsage(THREE.DynamicDrawUsage));
geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
geo.setIndex(new THREE.BufferAttribute(idx, 1));
const sandMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
sandMesh.receiveShadow = true;
scene.add(sandMesh);
const surround = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: LOOK[ground()].surround, roughness: 1 }));
surround.position.z = DEPTH - 0.002; surround.receiveShadow = true; scene.add(surround);
const grain = i => { let h = Math.imul(i ^ (i >>> 13), 0x5bd1e995); h ^= h >>> 15; return ((h >>> 0) % 1000) / 1000; };
function writeRect(c0, r0, c1, r1) {
  const q = bed.quantum, H = i => bed.baseF[i] + bed.sand[i] * q;
  c0 = Math.max(0, c0 - 1); r0 = Math.max(0, r0 - 1); c1 = Math.min(COLS - 1, c1 + 1); r1 = Math.min(ROWS - 1, r1 + 1);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const i = r * COLS + c, j = i * 3;
    pos[j] = ORIGIN[0] + c * CELL; pos[j + 1] = ORIGIN[1] + r * CELL; pos[j + 2] = H(i);
    const dx = (H(r * COLS + Math.min(COLS - 1, c + 1)) - H(r * COLS + Math.max(0, c - 1))) / (2 * CELL);
    const dy = (H(Math.min(ROWS - 1, r + 1) * COLS + c) - H(Math.max(0, r - 1) * COLS + c)) / (2 * CELL);
    const l = Math.hypot(dx, dy, 1); nrm[j] = -dx / l; nrm[j + 1] = -dy / l; nrm[j + 2] = 1 / l;
    const look = LOOK[bedKind], g = (0.965 + 0.07 * grain(i)) * (bed.disturbed[i] ? look.churn : 1);
    const pk = look.packed ? Math.min(1, bed.packed[i] / 30) : 0, base = look.color, tint = look.packed || base;
    for (let k = 0; k < 3; k++) col[j + k] = (base[k] + (tint[k] - base[k]) * pk) * g;
  }
  for (const name of ['position', 'normal', 'color']) {
    const a = geo.attributes[name]; a.addUpdateRange(r0 * COLS * 3, (r1 - r0 + 1) * COLS * 3); a.needsUpdate = true;
  }
}
function writeAll() { writeRect(0, 0, COLS - 1, ROWS - 1); geo.computeBoundingSphere(); }
writeAll();

// Walker: capsule body, head, two feet that swing between plants. Gait edges (half-cycle crossings) plant a foot.
const walker = new THREE.Group(); scene.add(walker);
const skin = new THREE.MeshStandardMaterial({ color: '#3e6a8a', roughness: 0.7 });
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.7, 6, 12), skin); body.rotation.x = Math.PI / 2; body.position.z = 1.0;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshStandardMaterial({ color: '#e0b48a', roughness: 0.8 })); head.position.z = 1.62;
const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.04), head.material); nose.position.set(0.13, 0, 1.62);
for (const m of [body, head, nose]) { m.castShadow = true; walker.add(m); }
const shoe = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.8 });
const feet = [0, 1].map(() => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.07), shoe); f.castShadow = true; scene.add(f); return f; });
const legs = [0, 1].map(() => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), skin); l.castShadow = true; scene.add(l); return l; });

const crateGeo = 0.7, crate = new THREE.Mesh(new THREE.BoxGeometry(crateGeo, crateGeo, crateGeo), new THREE.MeshStandardMaterial({ color: '#8a6136', roughness: 0.85 }));
crate.castShadow = true; scene.add(crate);
let state;
function resetWalker() {
  state = { x: 0, y: -1.6, heading: Math.PI / 2, gait: 0, half: 0, moving: false, prints: 0,
    plant: [[-0.11, -1.6], [0.11, -1.6]], prev: [[-0.11, -1.6], [0.11, -1.6]], crate: [0, 0.6], autoT: 0 };
}
resetWalker();

const keys = new Set();
addEventListener('keydown', e => { keys.add(e.key.toLowerCase()); if (e.key.startsWith('Arrow')) e.preventDefault(); });
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
let yaw = -Math.PI / 2 - 0.5, pitch = 0.42, drag = null;
renderer.domElement.addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove', e => { if (!drag) return; yaw -= (e.clientX - drag[0]) * 0.006; pitch = Math.max(0.12, Math.min(1.35, pitch + (e.clientY - drag[1]) * 0.005)); drag = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', () => drag = null);
let auto = false;
$('auto').onclick = () => { auto = !auto; $('auto').textContent = 'Auto-walk: ' + (auto ? 'on' : 'off'); };
// Wetting or drying sand re-tunes the live bed, so existing prints slump or hold; any other change is fresh ground.
function applyGround(rebuild) {
  const k = ground(), look = LOOK[k];
  $('blurb').textContent = look.blurb; $('sink').value = GROUNDS[k].sink; sinkLabel();
  sandMesh.material.roughness = look.rough; surround.material.color.set(look.surround);
  if (!rebuild && k.endsWith('-sand') && bedKind.endsWith('-sand')) { bed.tune(GROUNDS[k]); bedKind = k; writeAll(); return; }
  bed = newBed(); bedKind = k; writeAll(); resetWalker();
}
$('kind').onchange = () => applyGround(false);
const sinkLabel = () => $('sinkV').textContent = Math.round(+$('sink').value * 1000) + ' mm';
$('sink').oninput = sinkLabel; sinkLabel();
$('reset').onclick = () => applyGround(true);
$('blurb').textContent = LOOK[ground()].blurb; sandMesh.material.roughness = LOOK[ground()].rough;

const HALF = 0.11, LIMIT = 4.6;
function crateBlock(px, py) {           // closest point of the crate square to (px, py), axis-aligned
  const h = crateGeo / 2, cx = Math.max(state.crate[0] - h, Math.min(state.crate[0] + h, px)), cy = Math.max(state.crate[1] - h, Math.min(state.crate[1] + h, py));
  return [cx, cy];
}
function move(dt) {
  let fx = 0, fy = 0;
  if (auto) {                            // a slow figure-eight so the bed fills with a trackway without a keyboard
    state.autoT += dt * 0.16;
    const t = state.autoT, tx = 2.6 * Math.sin(t), ty = 1.7 * Math.sin(2 * t) - 0.4;
    fx = tx - state.x; fy = ty - state.y;
  } else {
    const f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
    const s = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const cf = [-Math.cos(yaw), -Math.sin(yaw)], cr = [Math.sin(yaw) * -1, Math.cos(yaw)];
    fx = cf[0] * f + cr[0] * s; fy = cf[1] * f + cr[1] * s;
  }
  const len = Math.hypot(fx, fy);
  const run = keys.has('shift');
  state.moving = len > 0.02;
  if (!state.moving) return;
  const want = Math.atan2(fy, fx);
  let dh = want - state.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  state.heading += dh * Math.min(1, dt * 9);
  let speed = (run ? 3.2 : 1.45) * Math.min(1, len / 0.3);
  const ux = Math.cos(state.heading), uy = Math.sin(state.heading);
  let nx = state.x + ux * speed * dt, ny = state.y + uy * speed * dt;
  // Pushing: the walker's circle shoves the crate out along the contact normal; plowing sand is slow going.
  const [bx, by] = crateBlock(nx, ny), d = Math.hypot(nx - bx, ny - by), R = 0.26;
  if (d < R) {
    const n = d > 1e-6 ? [(bx - nx) / d, (by - ny) / d] : [ux, uy], pen = R - d;
    const old = state.crate.slice(), h = crateGeo / 2;
    state.crate[0] = Math.max(-LIMIT + h, Math.min(LIMIT - h, state.crate[0] + n[0] * pen * 0.55));
    state.crate[1] = Math.max(-LIMIT + h, Math.min(LIMIT - h, state.crate[1] + n[1] * pen * 0.55));
    const [qx, qy] = crateBlock(nx, ny), q = Math.hypot(nx - qx, ny - qy);
    if (q < R && q > 1e-6) { nx = qx - (qx - nx) / q * R; ny = qy - (qy - ny) / q * R; }
    pendingPlow.push({ from: old, to: state.crate.slice() });
  }
  nx = Math.max(-LIMIT, Math.min(LIMIT, nx)); ny = Math.max(-LIMIT, Math.min(LIMIT, ny));
  const moved = Math.hypot(nx - state.x, ny - state.y);
  state.x = nx; state.y = ny;
  const stride = run ? 0.62 : 0.4;       // distance per foot plant
  state.gait += moved / stride;
  const half = Math.floor(state.gait);
  if (half !== state.half) {
    state.half = half;
    const side = half % 2, sgn = side ? -1 : 1;
    const lx = -Math.sin(state.heading) * HALF * sgn, ly = Math.cos(state.heading) * HALF * sgn;
    const target = [state.x + ux * stride * 0.5 + lx, state.y + uy * stride * 0.5 + ly];
    state.prev[side] = state.plant[side]; state.plant[side] = target;
    pendingPress.push({ x: target[0], y: target[1], heading: state.heading, sink: +$('sink').value * (run ? 1.4 : 1),
      push: [ux * (run ? 2.5 : 1.2), uy * (run ? 2.5 : 1.2)] });
    state.prints++;
  }
}
const pendingPress = [], pendingPlow = [];
const EMBED = 0.1;   // the crate rides 10 cm into the undisturbed surface: a groove and a bow wave, not a trench to bedrock
const crateBottom = () => bed.baseAt(state.crate[0], state.crate[1]) + DEPTH - EMBED;
// Fixed 60 Hz sand tick: the bed advances by ticks, never by frame dt.
let acc = 0, last = null, cost = 0;
function frame(now) {
  const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000); last = now;
  move(dt);
  acc += dt * 60;
  let n = 0;
  while (acc >= 1 && n < 4) {
    const t0 = performance.now();
    for (const p of pendingPress.splice(0)) bed.press(p);
    for (const p of pendingPlow.splice(0)) bed.plow({ x: p.to[0], y: p.to[1], hl: crateGeo / 2, hw: crateGeo / 2, bottom: crateBottom(), dx: p.to[0] - p.from[0], dy: p.to[1] - p.from[1] });
    const m = bed.step();
    const el = performance.now() - t0; cost = m.checked ? 0.85 * cost + 0.15 * el : cost * 0.95;
    acc--; n++;
  }
  if (n === 4) acc = Math.min(acc, 1);
  const d = bed.takeDirty(); if (d) writeRect(...d);
  // pose
  const ground = bed.heightAt(state.x, state.y), frac = state.gait - state.half, sw = (state.half + 1) % 2;
  walker.position.set(state.x, state.y, ground - 0.04 + (state.moving ? 0.03 * Math.abs(Math.sin(Math.PI * frac)) : 0));
  walker.rotation.z = state.heading;
  for (let s = 0; s < 2; s++) {
    let [px, py] = state.plant[s], lift = 0;
    if (state.moving && s === sw) {         // swinging foot: arc from its last plant toward where it will land next
      const ux = Math.cos(state.heading), uy = Math.sin(state.heading), sgn = s ? -1 : 1, st = keys.has('shift') ? 0.62 : 0.4;
      const tx = state.x + ux * st * 0.5 - Math.sin(state.heading) * HALF * sgn, ty = state.y + uy * st * 0.5 + Math.cos(state.heading) * HALF * sgn;
      px = state.plant[s][0] + (tx - state.plant[s][0]) * frac; py = state.plant[s][1] + (ty - state.plant[s][1]) * frac;
      lift = 0.12 * Math.sin(Math.PI * frac);
    }
    const fz = bed.heightAt(px, py) + 0.035 + lift;
    feet[s].position.set(px, py, fz); feet[s].rotation.z = state.heading;
    const hip = new THREE.Vector3(state.x - Math.sin(state.heading) * HALF * (s ? -1 : 1) * 0.8, state.y + Math.cos(state.heading) * HALF * (s ? -1 : 1) * 0.8, walker.position.z + 0.72);
    const foot = new THREE.Vector3(px, py, fz + 0.03), mid = hip.clone().add(foot).multiplyScalar(0.5);
    legs[s].position.copy(mid); legs[s].scale.set(1, hip.distanceTo(foot), 1);
    legs[s].quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hip.clone().sub(foot).normalize());
  }
  crate.position.set(state.crate[0], state.crate[1], crateBottom() + crateGeo / 2);
  // camera
  const target = new THREE.Vector3(state.x, state.y, walker.position.z + 1.1);
  const dist = 4.2;
  camera.position.set(target.x + Math.cos(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(yaw) * Math.cos(pitch) * dist, target.z + Math.sin(pitch) * dist);
  camera.lookAt(target);
  sun.position.copy(target).addScaledVector(SUN, 12); sun.target.position.copy(target);
  $('prints').textContent = state.prints; $('awake').textContent = bed.stats().active.toLocaleString();
  $('vol').textContent = (bed.mass() * bed.quantum * CELL * CELL).toFixed(3) + ' m³'; $('cost').textContent = cost.toFixed(2);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
window.__sandBed = { state: () => state, bed: () => bed, setYaw: v => { yaw = v; } };   // capture/debug handle
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
requestAnimationFrame(frame);
</script></body></html>`;
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, html);
console.log(output);
