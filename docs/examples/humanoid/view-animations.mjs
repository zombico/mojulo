/** view-animations.mjs — a self-contained page that plays any skinned GLB's clips as the file carries them: real skinning
 * and morph targets (what an engine plays, not the World page's rigid clip preview), at the clips' own lengths, the baked
 * vertex colours on unlit materials (the file's base colour where it bakes none). three.js 0.170.0 from jsdelivr; the
 * GLBs inline as base64. The controls: a model picker, a button per clip, pause, speed, a 1/30 s frame-step, orbit
 * (drag, scroll), and the cameras 'full' (the figure framed over all its clips, a raised fist included) and, with a
 * face, 'face' (a three-quarter close-up that follows the head).
 *   THE FACE PANEL, when the file carries the anime face (`mesh.extras.face`, export_model { clips: '_all', skinned: true }
 * on an anime hero): every word of `extras.face.words` (eased over 0.1 s on the face's channels, then held); 'clip drives
 * the face' (on: each clip's own STEP weights track; off: the chosen word holds); 'ambient blink' (the GLB's own face-only
 * clip, `extras.face.ambientClip`, sampled on the face clock over the clips in `extras.face.ambientOver` or while a word is
 * held, combined with the face by max per eye, so it never reopens a shut eye); 'wink' (the right eye, mesh +x: the half
 * lid, shut seven frames, the half lid, 0.20). Eye closure is always drawn at the file's knots (`extras.face.eyeKnots`,
 * each with its corrective), never tweened between them. Test hook: `window.__view`.
 *   node ../docs/examples/humanoid/view-animations.mjs <a.glb> [<b.glb> …] [--out <file.html>] [--title <t>]
 * from control/ (paths are the shell's); the page lands beside the first GLB as <name>.animations.html unless --out
 * names it. A skinned GLB: export_model { format: 'glb', clips: '_all', skinned: true } on a rigged solid. */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The anime face a GLB carries: the first mesh's `extras.face` with its `targetNames` (the morph targets in order), or
 * null when the file has none. `bytes` is the GLB (a Buffer or any Uint8Array). */
export function glbFaceExtras(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (u8.byteLength < 20 || dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const json = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + dv.getUint32(12, true))));
  const mesh = (json.meshes || []).find((m) => m?.extras?.face && Array.isArray(m.extras.targetNames));
  return mesh ? { ...mesh.extras.face, targetNames: mesh.extras.targetNames } : null;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const b64 = (bytes) => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');

/** The page: { title, models: [{ name, bytes }] } → HTML text. Each model's face (glbFaceExtras) rides beside its bytes;
 * the face panel and the 'face' camera appear only for a model that carries one. */
export function animationsPage({ title = 'Animations', models = [] } = {}) {
  if (!models.length) throw new Error('animationsPage: no models');
  const MODELS = models.map(({ name, bytes }) => ({ name, glb: b64(bytes), face: glbFaceExtras(bytes) }));
  const faced = MODELS.some((m) => m.face);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
html,body{margin:0;height:100%;background:#0e1117;color:#e8e4dc;font:14px/1.4 -apple-system,system-ui,sans-serif;overflow:hidden}
#ui{position:absolute;left:16px;top:16px;right:16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#face{position:absolute;right:16px;top:112px;width:236px;display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:rgba(20,25,35,.82);border:1px solid #2c3446;border-radius:8px}
#face[hidden]{display:none}
#face h4{margin:0 0 2px;width:100%;font-size:12px;font-weight:600;color:#9aa3b5;letter-spacing:.04em;text-transform:uppercase}
#ui label{display:flex;gap:6px;align-items:center}
#face label{width:100%;display:flex;gap:6px;align-items:center;font-size:13px}
select,button,input{font:inherit;background:#1d2330;color:#e8e4dc;border:1px solid #3a4356;border-radius:6px;padding:6px 10px}
#face button{padding:4px 8px;font-size:13px}
#clips,#words,#cams{display:flex;flex-wrap:wrap;gap:6px}
#words,#cams{width:100%}
#clips button.on,#words button.on,#cams button.on{background:#d9573f;border-color:#d9573f;color:#fff}
#note{position:absolute;left:16px;bottom:12px;right:16px;color:#9aa3b5;font-size:12px}
@media (max-width:640px){#face{left:16px;right:16px;top:auto;bottom:12px;width:auto}#note{display:none}}
canvas{display:block}
</style>
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script>
</head><body>
<div id="ui"><select id="model"></select><div id="clips"></div>
<button id="pause">pause</button><label>speed <input id="speed" type="range" min="0.1" max="2" step="0.05" value="1"></label>
<button id="step">frame-step ▸</button><span id="cams"><button id="camfull" class="on">full</button>${faced ? '<button id="camface">face</button>' : ''}</span></div>
${faced ? `<div id="face" hidden><h4>Face</h4><div id="words"></div>
<label><input type="checkbox" id="clipface" checked> clip drives the face</label>
<label><input type="checkbox" id="ambient" checked> ambient blink</label>
<button id="wink">wink</button></div>` : ''}
<div id="note">The skinned GLB as exported: real skinning${faced ? ' and morph targets' : ''}, the baked vertex colours unlit.${faced ? ' The eyes are drawn at the closures the file names, never tweened.' : ''} Drag to orbit, scroll to zoom.</div>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const MODELS = ${JSON.stringify(MODELS).replace(/</g, '\\u003c')};
const $ = (id) => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(devicePixelRatio); renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#0e1117');
scene.add(new THREE.GridHelper(6, 12, 0x3d6b4f, 0x232a36));
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.01, 100);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
const clock = new THREE.Clock(), loader = new GLTFLoader();
let mixer = null, current = null, root = null, clips = [], paused = false, FACE = null;
for (const [i, m] of MODELS.entries()) $('model').add(new Option(m.name, String(i)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer;

// ── the face contract (mesh.extras.face): the targets by name, the eyes drawn at the knots ──
let TI = {};
const near = (a, b) => Math.abs(a - b) < 1e-9;
const drawEye = (e) => FACE.eyeKnots.reduce((b, k) => (Math.abs(k - e) < Math.abs(b - e) ? k : b), 0);
// a corrective's name: the closure's decimals, two at least (0.1 → blinkFix10, 0.35 → blinkFix35, 0.125 → blinkFix125)
const fixName = (k, s) => 'blinkFix' + String(Math.round(k * 1e4)).padStart(4, '0').replace(/0+$/, '').padEnd(2, '0') + s;
const put = (w, name, v) => { if (TI[name] !== undefined) w[TI[name]] = v; };
const get = (w, name) => (TI[name] !== undefined ? w[TI[name]] : 0);
/** a face state { eyeL, eyeR, smile, open, brow } → the weights, each eye at its nearest knot with its corrective */
function weightsOf(F) {
  const eL = drawEye(F.eyeL), eR = drawEye(F.eyeR), b = Math.min(eL, eR), w = new Array(FACE.targetNames.length).fill(0);
  put(w, 'blink', b); put(w, 'blinkLeft', eL - b); put(w, 'blinkRight', eR - b); put(w, 'smile', F.smile); put(w, 'mouthOpen', F.open);
  put(w, 'browInnerRaise', Math.max(0, -F.brow)); put(w, 'browInnerLower', Math.max(0, F.brow));
  for (const k of FACE.fixKnots) { if (near(eL, k)) put(w, fixName(k, 'L'), 1); if (near(eR, k)) put(w, fixName(k, 'R'), 1); }
  return w;
}
const stateOf = (w) => ({ eyeL: get(w, 'blink') + get(w, 'blinkLeft'), eyeR: get(w, 'blink') + get(w, 'blinkRight'), smile: get(w, 'smile'), open: get(w, 'mouthOpen'), brow: get(w, 'browInnerLower') - get(w, 'browInnerRaise') });
const CH = ['eyeL', 'eyeR', 'smile', 'open', 'brow'];
const mix = (a, b, t) => Object.fromEntries(CH.map((k) => [k, a[k] + (b[k] - a[k]) * t]));
const WINK = [0.5, 1, 1, 1, 1, 1, 1, 1, 0.5, 0.2];

// ── the face controller: the clip's track or a held word, eased; the ambient blink and the wink by max per eye ──
const face = { meshes: [], tracks: new Map(), ambient: null, clipDrives: true, blink: true, word: 'authored', held: null, shown: null, tween: null, clock: 0, wink: null, anchor: null, last: null };
const words = () => Object.keys(FACE?.words || {});
function clipFace() {
  const tr = current && face.tracks.get(current.getClip().name);
  return tr ? stateOf(Array.from(tr.evaluate(current.time))) : null;
}
function retarget() { if (face.shown) face.tween = { from: { ...face.shown }, t0: face.clock }; }
function markWords() { for (const b of $('words').children) b.classList.toggle('on', !face.clipDrives && b.textContent === face.word); }
function setWord(w) { face.word = w; face.held = stateOf(FACE.words[w]); face.clipDrives = false; $('clipface').checked = false; retarget(); markWords(); }
function setClipDrives(on) { face.clipDrives = on; $('clipface').checked = on; retarget(); markWords(); }
// the ambient clip holds the authored face between its blinks: an eye counts only where it closes past that rest, so a
// held word keeps its own eyes between blinks
function ambientEyes() {
  if (!face.blink || !face.ambient || !(!face.clipDrives || (current && (FACE.ambientOver || []).includes(current.getClip().name)))) return null;
  const s = stateOf(Array.from(face.ambient.evaluate(face.clock % face.ambient.duration))), rest = stateOf(FACE.words.authored);
  return { eyeL: s.eyeL > rest.eyeL + 1e-9 ? s.eyeL : 0, eyeR: s.eyeR > rest.eyeR + 1e-9 ? s.eyeR : 0 };
}
function updateFace(dt) {
  if (!FACE || !face.meshes.length) return;
  face.clock += dt;
  const src = (face.clipDrives && clipFace()) || face.held;
  let F = src;
  if (face.tween) { const p = (face.clock - face.tween.t0) / 0.1; if (p >= 1 || p < 0) face.tween = null; else F = mix(face.tween.from, src, p * p * (3 - 2 * p)); }
  face.shown = { ...F };
  const amb = ambientEyes(), wk = face.wink !== null ? WINK[Math.floor((face.clock - face.wink) * FACE.fps + 1e-6)] ?? (face.wink = null, 0) : 0;
  const eyes = { ...F, eyeL: Math.max(F.eyeL, amb ? amb.eyeL : 0), eyeR: Math.max(F.eyeR, amb ? amb.eyeR : 0, wk || 0) };
  const w = weightsOf(eyes);
  for (const m of face.meshes) for (let i = 0; i < w.length; i++) m.morphTargetInfluences[i] = w[i];
  face.last = { F: eyes, w };
}

// ── cameras: 'full' frames the figure over all its clips, 'face' follows the head ──
let cam = 'full', extent = null, lastAnchor = null;
/** the figure's extent over all its clips (a raised fist, a crouch), not the world's floor: each bone's box of the
 * vertices it carries most, in its bind frame, carried by that bone at rest and every 1/15 s of every clip; the scene's
 * box when nothing is skinned */
function extentOver(skinned) {
  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), parts = [];
  for (const sm of skinned) {
    const pos = sm.geometry.attributes.position, J = sm.geometry.attributes.skinIndex, W = sm.geometry.attributes.skinWeight, boxes = new Map();
    for (let i = 0; i < pos.count; i++) {
      let c = 0; for (let k = 1; k < 4; k++) if (W.getComponent(i, k) > W.getComponent(i, c)) c = k;
      const j = J.getComponent(i, c);
      if (!boxes.has(j)) boxes.set(j, new THREE.Box3());
      boxes.get(j).expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(sm.bindMatrix).applyMatrix4(sm.skeleton.boneInverses[j]));
    }
    for (const [j, b] of boxes) parts.push({ sm, bone: sm.skeleton.bones[j], b });
  }
  const take = () => {
    root.updateMatrixWorld(true);
    for (const { sm, bone, b } of parts) {
      m.multiplyMatrices(sm.matrixWorld, sm.bindMatrixInverse).multiply(bone.matrixWorld);
      for (let k = 0; k < 8; k++) box.expandByPoint(v.set(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z).applyMatrix4(m));
    }
  };
  take();
  for (const clip of clips) { const a = mixer.clipAction(clip); a.reset().play(); for (let t = 0; t <= clip.duration + 1e-9; t += 1 / 15) { a.time = t; mixer.update(0); take(); } a.stop(); }
  mixer.stopAllAction(); for (const sm of skinned) sm.skeleton.pose();
  if (box.isEmpty()) box.setFromObject(root);
  return box;
}
/** 'full': the extent's centre seen from a fixed three-quarter direction, backed off until every corner of the extent lies
 * inside the frustum at the window's aspect, a tenth to spare */
function fullView() {
  const c = extent.getCenter(new THREE.Vector3()), dir = new THREE.Vector3(1.1, 0.15, -1.6).normalize();
  const r = new THREE.Vector3().crossVectors(dir, camera.up).negate().normalize(), u = new THREE.Vector3().crossVectors(r, dir).negate();
  const ty = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / 1.1, tx = ty * camera.aspect; let D = 0;
  for (let k = 0; k < 8; k++) {
    const q = new THREE.Vector3(k & 1 ? extent.max.x : extent.min.x, k & 2 ? extent.max.y : extent.min.y, k & 4 ? extent.max.z : extent.min.z).sub(c), z = q.dot(dir);
    D = Math.max(D, z + Math.abs(q.dot(r)) / tx, z + Math.abs(q.dot(u)) / ty);
  }
  return { pos: c.clone().addScaledVector(dir, D), target: c };
}
function anchorWorld() {
  if (!face.anchor) return null;
  const { mesh, index } = face.anchor, v = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, index);
  mesh.applyBoneTransform(index, v); return v.applyMatrix4(mesh.matrixWorld);
}
function setCam(which) {
  cam = which === 'face' && face.anchor ? 'face' : 'full';
  $('camfull').classList.toggle('on', cam === 'full'); if ($('camface')) $('camface').classList.toggle('on', cam === 'face');
  if (cam === 'full' && extent) { const f = fullView(); camera.position.copy(f.pos); controls.target.copy(f.target); lastAnchor = null; }
  if (cam === 'face') { root.updateMatrixWorld(true); const a = anchorWorld(); const az = THREE.MathUtils.degToRad(35); camera.position.set(a.x + Math.sin(az) * 0.8, a.y + 0.05, a.z - Math.cos(az) * 0.8); controls.target.copy(a); lastAnchor = a.clone(); }
  controls.update();
}
$('camfull').onclick = () => setCam('full'); if ($('camface')) $('camface').onclick = () => setCam('face');

function play(clip) {
  if (!mixer) return;
  mixer.stopAllAction(); current = mixer.clipAction(clip); current.reset().play();
  for (const b of $('clips').children) b.classList.toggle('on', b.dataset.clip === clip.name);
}
function load(i) {
  window.__view.ready = false;
  const M = MODELS[i];
  loader.parse(fromB64(M.glb), '', (gltf) => {
    if (root) scene.remove(root);
    root = gltf.scene; FACE = M.face; TI = FACE ? Object.fromEntries(FACE.targetNames.map((n, k) => [n, k])) : {};
    Object.assign(face, { meshes: [], tracks: new Map(), ambient: null, anchor: null, tween: null, wink: null, clock: 0, clipDrives: true, word: 'authored' });
    const skinned = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      // unlit: the baked vertex colours, else the file's own base colour and texture
      const baked = !!o.geometry.attributes.color, was = o.material;
      o.material = new THREE.MeshBasicMaterial({ vertexColors: baked, color: baked ? 0xffffff : (was.color ?? 0xffffff), map: baked ? null : (was.map ?? null), side: THREE.DoubleSide });
      if (o.isSkinnedMesh) skinned.push(o);
      if (FACE && o.isSkinnedMesh && o.morphTargetInfluences && o.morphTargetInfluences.length === FACE.targetNames.length) face.meshes.push(o);
    });
    scene.add(root);
    mixer = new THREE.AnimationMixer(root); clips = [];
    for (const clip of gltf.animations) {
      // with the face, the controller samples each clip's weights track (so the clip, a held word, the ambient blink and
      // the wink combine per eye); the mixer drives the bones only
      const tr = FACE ? clip.tracks.find((t) => t.name.endsWith('.morphTargetInfluences')) : null;
      if (tr) { const interp = tr.createInterpolant(); face.tracks.set(clip.name, interp); clip.tracks = clip.tracks.filter((t) => !t.name.endsWith('.morphTargetInfluences')); }
      if (FACE && clip.name === FACE.ambientClip) { if (face.tracks.has(clip.name)) { face.ambient = face.tracks.get(clip.name); face.ambient.duration = clip.duration; } continue; }
      clips.push(clip);
    }
    extent = extentOver(skinned);
    if (face.meshes.length) {
      // the face anchor: the vertex nearest the middle of the lids (the blink target's movers)
      const sm = face.meshes[0], mp = sm.geometry.morphAttributes.position[TI.blink], pos = sm.geometry.attributes.position, mid = new THREE.Vector3(); let n = 0;
      for (let k = 0; k < mp.count; k++) if (mp.getX(k) || mp.getY(k) || mp.getZ(k)) { mid.x += pos.getX(k); mid.y += pos.getY(k); mid.z += pos.getZ(k); n++; }
      mid.divideScalar(Math.max(1, n)); let best = 0, bd = Infinity; const v = new THREE.Vector3();
      for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k); const d = v.distanceToSquared(mid); if (d < bd) { bd = d; best = k; } }
      face.anchor = { mesh: sm, index: best };
      face.held = stateOf(FACE.words.authored || FACE.words[words()[0]]); face.shown = { ...face.held };
      $('words').innerHTML = '';
      for (const w of words()) { const b = document.createElement('button'); b.textContent = w; b.onclick = () => setWord(w); $('words').appendChild(b); }
      $('clipface').checked = true; $('ambient').checked = face.blink;
    } else if ($('words')) $('words').innerHTML = '';
    if ($('face')) $('face').hidden = !face.meshes.length;
    if ($('camface')) $('camface').hidden = !face.anchor;
    $('clips').innerHTML = '';
    for (const clip of clips) {
      const b = document.createElement('button'); b.dataset.clip = clip.name; b.textContent = clip.name.replace(/^[^:]*:/, '');
      b.onclick = () => { play(clip); if (face.meshes.length && !face.clipDrives) setClipDrives(true); };
      $('clips').appendChild(b);
    }
    const first = clips.find((c) => /:idle$/.test(c.name)) || clips.find((c) => c.tracks.length) || clips[0];
    if (first) play(first); else current = null;
    setCam(cam);
    window.__view.ready = true;
  }, (e) => { $('note').textContent = 'load failed: ' + e; });
}
$('model').onchange = () => load(Number($('model').value));
if ($('clipface')) {
  $('clipface').onchange = (e) => setClipDrives(e.target.checked);
  $('ambient').onchange = (e) => { face.blink = e.target.checked; };
  $('wink').onclick = () => { face.wink = face.clock; };
}
$('pause').onclick = (e) => { paused = !paused; e.target.textContent = paused ? 'play' : 'pause'; };
$('step').onclick = () => { paused = true; $('pause').textContent = 'play'; if (mixer) mixer.update(1 / 30); updateFace(1 / 30); };
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
renderer.setAnimationLoop(() => {
  const dt = clock.getDelta() * Number($('speed').value);
  if (mixer && !paused) mixer.update(dt);
  if (!paused) updateFace(dt); else updateFace(0);
  if (cam === 'face' && lastAnchor) { root.updateMatrixWorld(true); const a = anchorWorld(); if (a) { const d = a.clone().sub(lastAnchor); camera.position.add(d); controls.target.add(d); lastAnchor = a; } }
  controls.update(); renderer.render(scene, camera);
});
// the test hook: deterministic stills (a held time on the body and the face clock together, an explicit camera)
window.__view = {
  ready: false, models: MODELS.map((m) => m.name), face, weightsOf, stateOf,
  words: () => words(), wordWeights: (w) => weightsOf(stateOf(FACE.words[w])),
  clips: () => clips.map((c) => c.name), select: (i) => { $('model').value = String(i); load(i); },
  durations: () => [...clips.map((c) => [c.name, c.duration]), ...(face.ambient ? [[FACE.ambientClip, face.ambient.duration]] : [])],
  time: () => (current ? current.time : null), resume: () => { paused = false; $('pause').textContent = 'pause'; }, root: () => root,
  play: (n) => { const c = clips.find((x) => x.name === n || x.name.endsWith(':' + n)); if (c) play(c); return !!c; },
  hold: (t) => { paused = true; $('pause').textContent = 'play'; if (current) { const d = current.getClip().duration; current.time = d > 0 ? t % d : t; mixer.update(0); } face.clock = t; face.tween = null; updateFace(0); },
  rest: () => { paused = true; $('pause').textContent = 'play'; if (mixer) mixer.stopAllAction(); current = null; root.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.pose(); }); face.tween = null; updateFace(0); },
  setWord: (w) => { setWord(w); face.tween = null; updateFace(0); }, setClipDrives, setAmbient: (on) => { face.blink = on; if ($('ambient')) $('ambient').checked = on; },
  wink: (frame = 0) => { face.wink = face.clock - frame / FACE.fps; updateFace(0); },
  setCam, camera: ({ pos, target, fov }) => { cam = 'fixed'; lastAnchor = null; camera.position.set(...pos); controls.target.set(...target); if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); } controls.update(); },
  weights: () => face.last,
};
load(0);
</script></body></html>`;
}

// CLI: the page for the GLBs named, beside the first unless --out names it
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), files = [], opt = {};
  for (let i = 0; i < argv.length; i++) { if (argv[i] === '--out' || argv[i] === '--title') opt[argv[i].slice(2)] = argv[++i]; else files.push(argv[i]); }
  if (!files.length) { console.error('usage: node view-animations.mjs <a.glb> [<b.glb> …] [--out <file.html>] [--title <t>]'); process.exit(1); }
  const models = files.map((f) => ({ name: basename(f).replace(/\.glb$/i, ''), bytes: readFileSync(f) }));
  const out = opt.out ?? join(dirname(resolve(files[0])), `${models[0].name}.animations.html`);
  const html = animationsPage({ title: opt.title ?? models.map((m) => m.name).join(', '), models });
  writeFileSync(out, html);
  console.log(`wrote ${out} (${(html.length / 1e6).toFixed(1)} MB; ${models.map((m) => `${m.name}${glbFaceExtras(m.bytes) ? ' with its face' : ''}`).join(', ')})`);
}
