#!/usr/bin/env node
// actor scene film — a blocked scene played as the camera cuts it: the baseline's two-hander (lib/graph/actor/baseline.js
// BASELINE.blocked) in a style, both actors on the minted hero at once, each its body (act-sidecar.mjs: its act, its
// blocking carried) and its face (face.mjs's clips), shot by its coverage (lib/graph/actor/coverage.js coverScene: the
// wide, the overs, the closes, the cuts). The eyes gate for a whole scene: does it read as two people talking.
//
//   node scripts/spikes/actor/scene-film.mjs --hero <hero-live out dir> [--style thespian]
//
//   run the dailies with --hero first (dailies.mjs writes each blocked take's body and face beside the hero); this writes
//   scene.html beside them (the hero's own vendored three), with window.sceneFilm.seek(t) for a script to shoot
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { BASELINE } from '../../../lib/graph/actor/baseline.js';
import { actScene } from '../../../lib/graph/actor/scene.js';
import { coverScene } from '../../../lib/graph/actor/coverage.js';

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) { const k = argv[i].replace(/^--/, ''); if (!['hero', 'style'].includes(k) || argv[i + 1] === undefined) throw new Error(`scene-film: --hero dir [--style name] (not ${argv[i]})`); opt[k] = argv[++i]; }
if (!opt.hero) throw new Error('scene-film: --hero <hero-live out dir>');
const dir = path.resolve(opt.hero), style = opt.style ?? 'thespian', variant = 'bare';
for (const f of [`${variant}.glb`, `${variant}.act.json`, `${variant}.face.json`]) if (!existsSync(path.join(dir, f))) throw new Error(`scene-film: no ${f} in ${dir} (live.mjs, then dailies.mjs --hero)`);

const B = BASELINE.blocked, S = actScene({ ...B, cast: Object.fromEntries(Object.entries(B.cast).map(([w, C]) => [w, { ...C, style }])) }), plan = coverScene(S);
const takes = Object.fromEntries(Object.keys(S.actors).map((w) => [w, `face:blocked-${style}-${w}`]));
const acts = JSON.parse(readFileSync(path.join(dir, `${variant}.act.json`), 'utf8')).acts, faces = JSON.parse(readFileSync(path.join(dir, `${variant}.face.json`), 'utf8')).clips;
for (const [w, k] of Object.entries(takes)) { if (!acts.some((a) => a.of === k)) throw new Error(`scene-film: no body take ${k} (dailies.mjs --hero)`); if (!faces.some((c) => c.name === k)) throw new Error(`scene-film: no face take ${k}`); void w; }
const data = { seconds: S.seconds, style, takes, plan, marks: S.marks, turns: S.turns.map((T) => ({ who: T.who, at: T.at, end: T.end, text: T.text })) };

writeFileSync(path.join(dir, 'scene.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scene film</title>
<style>:root{--bg:#d9d6d0;--ink:#1d1c1a;--dim:#5b5852}@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#1b1a19;--ink:#ecebe8;--dim:#a19d96}}:root[data-theme=dark]{--bg:#1b1a19;--ink:#ecebe8;--dim:#a19d96}
html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font:13px/1.4 system-ui,sans-serif;overflow:hidden}canvas{display:block}
#hud{position:fixed;left:0;right:0;bottom:0;padding:8px 12px;display:flex;gap:10px;align-items:center;background:rgba(0,0,0,.35);color:#fff;flex-wrap:wrap}
#hud input[type=range]{flex:1;min-width:160px}#cap{position:fixed;left:0;right:0;bottom:48px;text-align:center;color:#fff;text-shadow:0 1px 3px #000;font-size:18px}#shot{font-variant-numeric:tabular-nums}button{font:inherit}</style>
<script type="importmap">{"imports":{"three":"./vendor/three/three.module.min.js","three/addons/":"./vendor/three/addons/"}}</script></head><body>
<div id="cap"></div><div id="hud"><button id="pp">Pause</button><input id="scrub" type="range" min="0" max="1000" value="0"><span id="shot"></span></div>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
const D = ${JSON.stringify(data)};
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace; document.body.prepend(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#d9d6d0');
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 200);
scene.add(new THREE.HemisphereLight(0xdfe6ee, 0x3a332e, 0.7));
const key = new THREE.DirectionalLight(0xfff1e0, 2.2); key.position.set(3, 6, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); scene.add(key);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0xb9b2a6, roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
// (the marks on the floor: a small ring each)
for (const p of Object.values(D.marks)) { const r = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.15, 32), new THREE.MeshBasicMaterial({ color: 0x7a7266 })); r.rotation.x = -Math.PI / 2; r.position.set(p[0], 0.002, -p[1]); scene.add(r); }
// the native frame is z up (the GLB's root turns it): a point [x, y, z] stands at (x, z, −y) here
const v3 = (p) => new THREE.Vector3(p[0], p[2], -p[1]);
const [glb, actsJ, facesJ] = await Promise.all([new GLTFLoader().loadAsync('${variant}.glb'), fetch('${variant}.act.json').then((r) => r.json()), fetch('${variant}.face.json').then((r) => r.json())]);
const players = [];
for (const [who, take] of Object.entries(D.takes)) {
  const root = SkeletonUtils.clone(glb.scene); root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; if (o.morphTargetInfluences) o.morphTargetInfluences = [...o.morphTargetInfluences]; } }); scene.add(root);
  const mixer = new THREE.AnimationMixer(root), A = actsJ.acts.find((a) => a.of === take), F = facesJ.clips.find((c) => c.name === take), tracks = [];
  for (const J of A.joints) { const o = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(J.node)); if (!o) continue; tracks.push(new THREE.QuaternionKeyframeTrack(o.name + '.quaternion', A.t, J.r), new THREE.VectorKeyframeTrack(o.name + '.position', A.t, J.p)); }
  root.traverse((o) => { if (!o.isMesh || !o.morphTargetDictionary) return; const idx = F.names.map((n) => o.morphTargetDictionary[n]); if (!idx.some((x) => x !== undefined)) return; const m = o.morphTargetInfluences.length, base = [...o.morphTargetInfluences], vals = new Float32Array(F.t.length * m); F.w.forEach((row, k) => { vals.set(base, k * m); idx.forEach((x, j) => { if (x !== undefined) vals[k * m + x] = row[j]; }); }); tracks.push(new THREE.NumberKeyframeTrack(o.uuid + '.morphTargetInfluences', F.t, vals)); });
  const action = mixer.clipAction(new THREE.AnimationClip(take, D.seconds, tracks)); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
  players.push({ who, mixer, action });
}
// the coverage: the shot at t, its camera's two keys eased linearly; the field of view horizontal as the plan gives it
const shotAt = (t) => D.plan.shots.find((s) => t >= s.span[0] && t < s.span[1]) ?? D.plan.shots.at(-1);
function frame(t) {
  const s = shotAt(t), cam = D.plan.cameras.find((c) => c.id === s.camera), ks = cam.keys.filter((k) => k.t >= s.span[0] - 1e-3 && k.t <= s.span[1] + 1e-3);
  const a = ks[0], b = ks.at(-1), u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
  const pos = v3(a.pos).lerp(v3(b.pos), u), poi = v3(a.poi).lerp(v3(b.poi), u), f = a.focal_mm + (b.focal_mm - a.focal_mm) * u, hfov = 2 * Math.atan(36 / (2 * f));
  camera.position.copy(pos); camera.lookAt(poi); camera.fov = (2 * Math.atan(Math.tan(hfov / 2) / camera.aspect) * 180) / Math.PI; camera.updateProjectionMatrix();
  for (const P of players) { P.action.time = Math.min(t, D.seconds - 1e-3); P.mixer.update(0); }
  const T = D.turns.find((x) => t >= x.at && t <= x.end + 0.2);
  document.getElementById('cap').textContent = T ? T.who.toUpperCase() + ': ' + T.text.replace(/\\[pause[^\\]]*\\]\\s*/g, '').replace(/[*]/g, '') : '';
  document.getElementById('shot').textContent = t.toFixed(2) + ' s · ' + s.name;
  document.getElementById('scrub').value = Math.round((t / D.seconds) * 1000);
  renderer.render(scene, camera);
}
let t = 0, playing = true, last = performance.now();
// (rendered while it plays, and once on a seek: two figures under shadows are dear to draw for nothing)
function loop(now) { if (playing) { t += (now - last) / 1000; if (t > D.seconds) t = 0; frame(t); } last = now; requestAnimationFrame(loop); }
frame(0); requestAnimationFrame(loop);
document.getElementById('pp').onclick = () => { playing = !playing; document.getElementById('pp').textContent = playing ? 'Pause' : 'Play'; };
document.getElementById('scrub').oninput = (e) => { playing = false; document.getElementById('pp').textContent = 'Play'; t = (e.target.value / 1000) * D.seconds; frame(t); };
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; });
window.sceneFilm = { seek(s) { playing = false; t = s; frame(t); }, shots: D.plan.shots, seconds: D.seconds, ready: true };
</script></body></html>`);
console.log(`${path.join(dir, 'scene.html')}: ${style}, ${plan.shots.length} shots on ${plan.cameras.length} cameras, ${S.seconds} s`);
for (const s of plan.shots) console.log(`  ${s.span[0].toFixed(2).padStart(6)}–${s.span[1].toFixed(2).padStart(6)}  ${s.name}`);
