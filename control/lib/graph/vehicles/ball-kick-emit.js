/**
 * ball-kick-emit — the standalone "kick from behind the ball" page emitter, evicted
 * from scene-three.js (renderer-emitter.plan.md E7): it is a self-contained demo page
 * over the ball-flight integrator, not a World channel. Lives beside ball-flight.js —
 * whose source it inlines — so the relative read below cannot go stale again (the
 * scene-three copy still pointed at ../ball-flight.js after folderization moved the
 * integrator into vehicles/, which is how we know it had no callers).
 */

import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { safeJson, escapeHtml, VENDOR_IMPORTMAP, CDN_IMPORTMAP, inlineImportmap } from '../scene/emit-util.js';
import { verticalFov } from '../scene/scene-three.js';

/**
 * Emit a self-contained "kick from behind the ball" page: a FIRST-PERSON camera planted
 * just behind the ball at the spot, watching it get struck and fly down-range — the curve
 * and dip read against the pitch lines + goal as the ball recedes. Angle / force / spin are
 * LIVE dials: the SAME ball-flight.js integrator the server test validates is inlined and
 * re-run in the browser on every slider move (one model, two consumers). See ball-flight.plan.md.
 */
export function emitBallKickView({ launch = {}, opts = {}, viewBox = { width: 1120, height: 720 }, title = 'kick — first person (behind the ball)', bg = '#8ec3ea', goalDist = 20, inline = true, cdn = false } = {}) {
  const W = viewBox.width, H = viewBox.height;
  const aspect = W / H;
  const importmap = cdn ? CDN_IMPORTMAP : inline ? inlineImportmap() : VENDOR_IMPORTMAP;
  // Single source of truth: inline the validated integrator (exports stripped) so the
  // browser's live dials run byte-for-byte the same physics as ball-flight.test.js.
  const physicsSrc = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), './ball-flight.js'), 'utf8')
    .replace(/^export\s+/gm, '');
  const INIT = safeJson({
    speed: launch.speed ?? 27,
    elevationDeg: launch.elevationDeg ?? 15,
    curlRev: launch.curlRev ?? 6,   // sidespin rev/s, + curls left (+y)
    spinRev: launch.spinRev ?? 3,   // + backspin (float) · − topspin (dip)
  });

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0a0f16;color:#eaf2ff;font:13px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center}
  #wrap{position:relative;width:${W}px;height:${H}px;max-width:100%;aspect-ratio:${W} / ${H};overflow:hidden}
  canvas{display:block;width:100%;height:100%;cursor:grab}
  .readout{position:absolute;left:10px;top:9px;font-variant-numeric:tabular-nums;color:#0a1a0e;background:rgba(255,255,255,.7);padding:4px 9px;border-radius:5px;font-weight:600}
  .panel{position:absolute;left:10px;bottom:10px;display:flex;flex-direction:column;gap:5px;background:rgba(8,14,22,.62);padding:9px 11px;border-radius:7px}
  .panel label{display:flex;align-items:center;gap:8px;font-size:12px;color:#bcd3f2}
  .panel label span{min-width:74px;color:#7f9bc4;text-align:right;font-variant-numeric:tabular-nums}
  .panel input[type=range]{width:150px;accent-color:#ffe04a}
  .panel .row{display:flex;gap:7px;margin-top:2px}
  .panel button{flex:1;color:#cfe0ff;background:rgba(20,30,46,.9);border:1px solid #2b3a54;border-radius:5px;padding:4px 8px;cursor:pointer;font:inherit}
  .panel button.on{background:#2b4a74;color:#fff}
  .hint{position:absolute;right:10px;bottom:10px;color:#0a1a0e;background:rgba(255,255,255,.55);padding:3px 8px;border-radius:5px;font-size:11px;user-select:none}
</style></head><body>
  <div id="wrap"><canvas id="c"></canvas>
    <div class="readout" id="readout"></div>
    <div class="panel">
      <label>angle <input id="angle" type="range" min="3" max="45" step="1"><span id="angleV"></span></label>
      <label>force <input id="force" type="range" min="14" max="36" step="1"><span id="forceV"></span></label>
      <label>curl <input id="curl" type="range" min="-12" max="12" step="1"><span id="curlV"></span></label>
      <label>lift <input id="spin" type="range" min="-12" max="12" step="1"><span id="spinV"></span></label>
      <div class="row"><button id="replay">replay &#8635;</button><button id="slow">slow-mo</button></div>
    </div>
    <div class="hint">first person · behind the ball · drag to look</div>
  </div>
<script type="importmap">${importmap}</script>
<script type="module">
import * as THREE from 'three';

/* ---- inlined ball-flight integrator: the SAME source ball-flight.test.js validates ---- */
${physicsSrc}
/* ---- end integrator ---- */

const INIT = ${INIT};
const BG = ${safeJson(bg)};
const GOAL = ${goalDist};
const R = BALL.radius;

const wrap = document.getElementById('wrap'), canvas = document.getElementById('c');
const readoutEl = document.getElementById('readout');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const bgCol = new THREE.Color(BG);
scene.background = bgCol;
scene.fog = new THREE.Fog(bgCol, 45, 230);

// --- pitch: green ground + distance lines (across) + center stripe + side lines ---
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshBasicMaterial({ color: 0x3f8a44 })));
const FH = 16, linePts = [];
for (let x = 0; x <= 80; x += 5) linePts.push(x, -FH, 0.02, x, FH, 0.02);   // mowing lines, every 5 m
linePts.push(-6, 0, 0.02, 80, 0, 0.02, -6, -FH, 0.02, 80, -FH, 0.02, -6, FH, 0.02, 80, FH, 0.02);
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
scene.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x69b06f })));

// --- goal at x = GOAL (regulation 7.32 × 2.44), z-up ---
const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.44, 10);
for (const y of [-3.66, 3.66]) { const p = new THREE.Mesh(postGeo, white); p.rotation.x = Math.PI / 2; p.position.set(GOAL, y, 1.22); scene.add(p); }
const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.32, 10), white);   // cylinder axis is +y → spans the mouth
bar.position.set(GOAL, 0, 2.44); scene.add(bar);
const netPts = [];   // sparse net hint on the goal mouth
for (let y = -3.66; y <= 3.66; y += 0.61) netPts.push(GOAL, y, 0, GOAL, y, 2.44);
for (let z = 0; z <= 2.44; z += 0.61) netPts.push(GOAL, -3.66, z, GOAL, 3.66, z);
const netGeo = new THREE.BufferGeometry(); netGeo.setAttribute('position', new THREE.Float32BufferAttribute(netPts, 3));
scene.add(new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })));

// --- ball: white sphere + 3 orthogonal seam rings + a marker dot, so spin is unmistakable ---
const ballGroup = new THREE.Group();
ballGroup.add(new THREE.Mesh(new THREE.SphereGeometry(R, 28, 20), new THREE.MeshBasicMaterial({ color: 0xf6f6f2 })));
const seam = new THREE.MeshBasicMaterial({ color: 0x1b1b24 });
const ring = new THREE.TorusGeometry(R * 0.99, R * 0.05, 8, 44);
const r1 = new THREE.Mesh(ring, seam); ballGroup.add(r1);
const r2 = new THREE.Mesh(ring, seam); r2.rotation.x = Math.PI / 2; ballGroup.add(r2);
const r3 = new THREE.Mesh(ring, seam); r3.rotation.y = Math.PI / 2; ballGroup.add(r3);
const dot = new THREE.Mesh(new THREE.SphereGeometry(R * 0.22, 12, 10), new THREE.MeshBasicMaterial({ color: 0xd03b2e }));
dot.position.set(0, 0, R * 0.92); ballGroup.add(dot);
scene.add(ballGroup);

// --- ground shadow (depth cue from behind) + growing flight trail ---
const shadow = new THREE.Mesh(new THREE.CircleGeometry(R * 1.5, 22), new THREE.MeshBasicMaterial({ color: 0x10300f, transparent: true, opacity: 0.5 }));
shadow.position.z = 0.025; scene.add(shadow);
const TRAIL_MAX = 9000;
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffe04a }));
scene.add(trail);

// --- the boot: swings in during pre-roll and contacts at launch ---
const boot = new THREE.Mesh(new THREE.BoxGeometry(R * 2.8, R * 1.25, R * 1.7), new THREE.MeshBasicMaterial({ color: 0x20262f }));
scene.add(boot);
function placeBoot(u){
  const e = u * u * (3 - 2 * u);   // smoothstep
  boot.position.set(-R * 9 + (-R * 1.3 + R * 9) * e, 0, R * 0.3 + (R - R * 0.3) * e);
  boot.rotation.y = (1 - e) * 0.55;
}

// --- first-person camera: fixed eye just behind the ball, drag to look ---
const EYE = new THREE.Vector3(-3.2, 0.55, 1.45);
const camera = new THREE.PerspectiveCamera(${verticalFov(62, aspect)}, wrap.clientWidth / wrap.clientHeight, 0.05, 700);
camera.up.set(0, 0, 1);
camera.position.copy(EYE);
const baseDir = new THREE.Vector3(18, 0, 2.2).sub(EYE).normalize();
let baseYaw = Math.atan2(baseDir.y, baseDir.x), basePitch = Math.asin(baseDir.z);
let dYaw = 0, dPitch = 0, dragging = false, lx = 0, ly = 0;
canvas.addEventListener('mousedown', (e) => { dragging = true; lx = e.clientX; ly = e.clientY; canvas.style.cursor = 'grabbing'; });
addEventListener('mouseup', () => { dragging = false; canvas.style.cursor = 'grab'; });
addEventListener('mousemove', (e) => { if (!dragging) return; dYaw -= (e.clientX - lx) * 0.0026; dPitch -= (e.clientY - ly) * 0.0026; lx = e.clientX; ly = e.clientY; dPitch = Math.max(-0.5, Math.min(0.75, dPitch)); });
function aim(){ const yaw = baseYaw + dYaw, pit = basePitch + dPitch; camera.lookAt(EYE.x + Math.cos(pit) * Math.cos(yaw), EYE.y + Math.cos(pit) * Math.sin(yaw), EYE.z + Math.sin(pit)); }

// --- physics state + recompute on any dial change ---
const launch = { speed: INIT.speed, elevationDeg: INIT.elevationDeg, azimuthDeg: 0, spin: { x: 0, y: 0, z: 0 } };
let curlDial = INIT.curlRev, spinDial = INIT.spinRev;
let traj = null, flightT = 0, renderPts = null;
function recompute(){
  launch.spin = { x: 0, y: -rps(spinDial), z: rps(curlDial) };   // +lift=backspin → ω_y<0; +curl → ω_z>0 → +y
  traj = kickBall(launch);
  flightT = traj.summary.flightTime;
  const S = traj.samples, n = S.length;
  renderPts = new Float32Array(Math.min(n, TRAIL_MAX) * 3);
  const pos = trailGeo.attributes.position.array;
  for (let i = 0; i < n && i < TRAIL_MAX; i++) { const p = S[i].p; pos[i*3] = p.x; pos[i*3+1] = p.y; pos[i*3+2] = p.z + R; }
  trailGeo.attributes.position.needsUpdate = true;
  const s = traj.summary;
  readoutEl.textContent = 'range ' + s.range.toFixed(1) + ' m    apex ' + s.apex.toFixed(1) + ' m    curl ' + s.peakLateral.toFixed(2) + ' m    hang ' + s.flightTime.toFixed(2) + ' s';
  resetPlayback();
}
function idxAtTime(tp){   // last sample with t <= tp (binary search; samples' t is increasing)
  const S = traj.samples; let lo = 0, hi = S.length - 1;
  if (tp <= 0) return 0; if (tp >= flightT) return hi;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (S[m].t <= tp) lo = m; else hi = m - 1; }
  return lo;
}
function ballAt(tp){
  const S = traj.samples, i = idxAtTime(tp), a = S[i], b = S[Math.min(i + 1, S.length - 1)];
  const span = (b.t - a.t) || 1, f = Math.max(0, Math.min(1, (tp - a.t) / span));
  return {
    x: a.p.x + (b.p.x - a.p.x) * f, y: a.p.y + (b.p.y - a.p.y) * f, z: a.p.z + (b.p.z - a.p.z) * f,
    omega: a.omega, idx: i,
  };
}
function updateShadow(){
  const h = Math.max(0, ballGroup.position.z - R);
  shadow.position.set(ballGroup.position.x, ballGroup.position.y, 0.025);
  const sc = 1 + h * 0.22; shadow.scale.set(sc, sc, 1);
  shadow.material.opacity = Math.max(0.07, 0.5 - h * 0.028);
}

// --- playback: PRE (boot swing) → FLIGHT → POST hold → loop ---
const PRE = 0.55, POST = 1.2;
let clock = 0, slow = false;
function resetPlayback(){ clock = 0; ballGroup.quaternion.identity(); trailGeo.setDrawRange(0, 1); }
function step(dt){
  const total = PRE + flightT + POST, c = clock % total;
  if (c < PRE) {                       // pre-roll: ball at rest on the spot, boot swings in
    ballGroup.position.set(0, 0, R); ballGroup.quaternion.identity();
    boot.visible = true; placeBoot(c / PRE);
    trailGeo.setDrawRange(0, 1); updateShadow();
    return;
  }
  boot.visible = false;
  const ft = Math.min(c - PRE, flightT);
  const s = ballAt(ft);
  ballGroup.position.set(s.x, s.y, s.z + R);
  const w = Math.hypot(s.omega.x, s.omega.y, s.omega.z);
  if (w > 1e-6 && c - PRE <= flightT) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(s.omega.x / w, s.omega.y / w, s.omega.z / w), w * dt);
    ballGroup.quaternion.premultiply(q);
  }
  trailGeo.setDrawRange(0, Math.max(2, s.idx + 1));
  updateShadow();
}

// --- dials ---
const angleEl = document.getElementById('angle'), forceEl = document.getElementById('force');
const curlEl = document.getElementById('curl'), spinEl = document.getElementById('spin');
const angleV = document.getElementById('angleV'), forceV = document.getElementById('forceV');
const curlV = document.getElementById('curlV'), spinV = document.getElementById('spinV');
angleEl.value = INIT.elevationDeg; forceEl.value = INIT.speed; curlEl.value = INIT.curlRev; spinEl.value = INIT.spinRev;
function labels(){
  angleV.textContent = angleEl.value + '°';
  forceV.textContent = forceEl.value + ' m/s';
  const cv = +curlEl.value, sv = +spinEl.value;
  curlV.textContent = cv === 0 ? 'straight' : Math.abs(cv) + ' rev/s ' + (cv > 0 ? 'left' : 'right');
  spinV.textContent = sv === 0 ? 'none' : Math.abs(sv) + ' rev/s ' + (sv > 0 ? 'back' : 'top');
}
function readDials(){ launch.elevationDeg = +angleEl.value; launch.speed = +forceEl.value; curlDial = +curlEl.value; spinDial = +spinEl.value; labels(); recompute(); }
[angleEl, forceEl, curlEl, spinEl].forEach((el) => el.addEventListener('input', readDials));
document.getElementById('replay').onclick = () => resetPlayback();
const slowBtn = document.getElementById('slow');
slowBtn.onclick = () => { slow = !slow; slowBtn.classList.toggle('on', slow); };

function resize(){ const w = wrap.clientWidth, h = wrap.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();
labels(); recompute();

let last = 0;
renderer.setAnimationLoop((t) => {
  const realDt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
  const rate = slow ? 0.35 : 1;
  clock += realDt * rate;
  step(realDt * rate);
  aim();
  renderer.render(scene, camera);
});
</script>
</body></html>
`;
}
