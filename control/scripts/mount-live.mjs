#!/usr/bin/env node
/**
 * mount-live.mjs — the mount's GLB in a live viewer (three.js, its GLTFLoader: what an engine-like renderer makes of the
 * file): every clip by family, play and scrub, the playback speed, the corrective shapes on or off (the folds as linear
 * blend leaves them), the skeleton, the wireframe, the ground passing at the clip's own speed. The eyes gate of the
 * export: the operator plays it.
 *
 *   node scripts/mount-live.mjs <mount.glb> <out-dir> [--local]   → <out-dir>/index.html and mount.json (the GLB, gzipped)
 *
 * The page loads three from its pinned CDN build (lib/graph/scene/emit-util.js CDN_THREE_VERSION), so it runs where an
 * artifact host serves it; `--local` copies the control plane's own three beside it instead (it runs with no network,
 * served from the folder). mount.json is fetched beside it.
 */
import path from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const argv = process.argv.slice(2), local = argv.includes('--local'), [glbPath, out] = argv.filter((a) => a !== '--local');
if (!glbPath || !out) { console.error('usage: node scripts/mount-live.mjs <mount.glb> <out-dir>'); process.exit(1); }
mkdirSync(out, { recursive: true });
const glb = readFileSync(glbPath);
// (gzipped, base64, in parts under an artifact host's file limit: a ridden horse's GLB carries two figures)
const b64 = gzipSync(glb).toString('base64'), PART = 12e6, parts = [];
for (let i = 0; i * PART < b64.length; i++) { const f = `mount-${i}.json`; writeFileSync(path.join(out, f), JSON.stringify({ b64: b64.slice(i * PART, (i + 1) * PART) })); parts.push(f); }
writeFileSync(path.join(out, 'mount.json'), JSON.stringify({ gz: true, parts }));
const THREE_CDN = '0.184.0';
const importmap = local
  ? { imports: { three: './vendor/three/three.module.min.js', 'three/addons/': './vendor/three/addons/' } }
  : { imports: { three: `https://cdn.jsdelivr.net/npm/three@${THREE_CDN}/build/three.module.min.js`, 'three/addons/': `https://cdn.jsdelivr.net/npm/three@${THREE_CDN}/examples/jsm/` } };
if (local) for (const f of ['three.core.min.js', 'three.module.min.js', 'addons/loaders/GLTFLoader.js', 'addons/controls/OrbitControls.js', 'addons/utils/BufferGeometryUtils.js', 'addons/utils/SkeletonUtils.js']) {
  mkdirSync(path.dirname(path.join(out, 'vendor/three', f)), { recursive: true }); copyFileSync(path.join('public/vendor/three', f), path.join(out, 'vendor/three', f));
}
const meta = (() => { try { return JSON.parse(readFileSync(glbPath.replace(/\.glb$/, '.json'), 'utf8')); } catch { return {}; } })();

const page = `<title>Mount Live</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400&display=swap">
<style>
/* layout: one screen, the stage beside a tack-room board of clips and switches (stacked under the stage on a phone) */
:root {
  --bg: #e9eeeb; --panel: #f7f9f8; --fg: #1b2420; --muted: #5d6a64; --line: #cfd8d3; --accent: #8c6a1c; --accent-ink: #ffffff; --stage: #dfe6e2;
  --display: "Barlow Condensed", "Arial Narrow", sans-serif; --body: "IBM Plex Sans", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #101513; --panel: #171e1b; --fg: #e2e8e5; --muted: #93a29b; --line: #2b3632; --accent: #d4ad52; --accent-ink: #1a1408; --stage: #141a17; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #101513; --panel: #171e1b; --fg: #e2e8e5; --muted: #93a29b; --line: #2b3632; --accent: #d4ad52; --accent-ink: #1a1408; --stage: #141a17; color-scheme: dark }
html, body { height: 100%; }
body { background: var(--bg); color: var(--fg); font-family: var(--body); }
.app { height: 100%; display: grid; grid-template-columns: minmax(0, 1fr) 300px; }
#stage { position: relative; min-height: 0; background: var(--stage); }
#stage canvas { display: block; width: 100%; height: 100%; }
#status { position: absolute; left: max(16px, env(safe-area-inset-left, 0px)); bottom: 14px; font: 12px var(--mono); color: var(--muted); }
aside { border-left: 1px solid var(--line); background: var(--panel); overflow-y: auto; display: flex; flex-direction: column; gap: 18px;
  padding-block: 18px; padding-left: 16px; padding-right: max(16px, env(safe-area-inset-right, 0px)); }
h1 { margin: 0; font: 600 26px/1 var(--display); letter-spacing: 0.02em; text-transform: uppercase; text-wrap: balance; }
.sub { margin: 4px 0 0; color: var(--muted); font-size: 12.5px; line-height: 1.45; }
h2 { margin: 0 0 6px; font: 500 13px var(--display); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.clips { display: flex; flex-wrap: wrap; gap: 6px; }
.clips button { font: 13px var(--body); padding: 5px 9px; border: 1px solid var(--line); background: transparent; color: var(--fg); border-radius: 4px; cursor: pointer; }
.clips button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.clips button:focus-visible, .row button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.row button { font: 600 14px var(--display); letter-spacing: 0.06em; text-transform: uppercase; padding: 6px 14px; border-radius: 4px; border: 1px solid var(--accent); background: var(--accent); color: var(--accent-ink); cursor: pointer; }
input[type="range"] { flex: 1; min-width: 0; accent-color: var(--accent); }
.num { font: 12px var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
label { display: flex; align-items: center; gap: 8px; font-size: 13.5px; cursor: pointer; }
input[type="checkbox"] { accent-color: var(--accent); }
select { font: 13px var(--body); padding: 4px 6px; border: 1px solid var(--line); border-radius: 4px; background: var(--panel); color: var(--fg); }
dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 0; font-size: 12.5px; }
dt { color: var(--muted); } dd { margin: 0; font-family: var(--mono); font-variant-numeric: tabular-nums; }
@media (max-width: 760px) { .app { grid-template-columns: 1fr; grid-template-rows: 56vh auto; height: auto; } aside { border-left: 0; border-top: 1px solid var(--line); } }
@media (prefers-reduced-motion: reduce) { .clips button { transition: none; } }
</style>
<div class="app">
  <div id="stage"><div id="status">loading the horse&hellip;</div></div>
  <aside>
    <div>
      <h1>The mount</h1>
      <p class="sub">A horse as an engine gets it: one skinned GLB, its clips, its corrective shapes, and whoever rides it on the same clips. In place; the ground passes at each gait's own speed.</p>
    </div>
    <section id="families"></section>
    <section>
      <h2>Playback</h2>
      <div class="row"><button id="play" type="button">Pause</button><input id="scrub" type="range" min="0" max="1000" value="0" aria-label="Time in the clip"><span class="num" id="time">0.00 s</span></div>
      <div class="row" style="margin-top:8px"><label for="speed">Speed</label><select id="speed"><option value="0.1">0.1&times;</option><option value="0.25">0.25&times;</option><option value="0.5">0.5&times;</option><option value="1" selected>1&times;</option></select></div>
    </section>
    <section>
      <h2>Show</h2>
      <div style="display:grid;gap:6px">
        <label><input type="checkbox" id="corr" checked> Corrective shapes at the folds</label>
        <label><input type="checkbox" id="travel" checked> Ground passing at the clip's speed</label>
        <label><input type="checkbox" id="bones"> Skeleton</label>
        <label><input type="checkbox" id="wire"> Wireframe</label>
      </div>
      <div class="row" style="margin-top:10px"><label for="view">View</label><select id="view"><option value="side">Side</option><option value="three">Front three-quarter</option><option value="front">Front</option><option value="rear">Rear three-quarter</option><option value="low">Low</option></select></div>
    </section>
    <section>
      <h2>This clip</h2>
      <dl id="facts"></dl>
    </section>
    <section>
      <h2>The file</h2>
      <dl id="file"></dl>
    </section>
  </aside>
</div>
<script type="importmap">${JSON.stringify(importmap)}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const META = ${JSON.stringify(meta).replace(/</g, '\\u003c')};
const FAMILIES = [['Gaits', /^(walk|trot|canter|gallop|reinBack)$/], ['Transitions', /^[a-zA-Z]+-[a-zA-Z]+$/], ['The jump', /^jump$/], ['At rest', /^(idle|graze|idle-.*)$/]];
const NAMES = { reinBack: 'rein-back', 'stand-walk': 'stand \\u2192 walk', 'walk-stand': 'walk \\u2192 halt', graze: 'grazing', idle: 'idle' };
const nice = (n) => NAMES[n] ?? n.replace(/^idle-/, 'idle: ').replace(/-/g, ' \\u2192 ');
const stage = document.getElementById('stage'), status = document.getElementById('status');
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true; renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.prepend(renderer.domElement);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
const controls = new OrbitControls(camera, renderer.domElement); controls.target.set(0, 1.1, 0); controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xeef3ff, 0x5b5040, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-3, 6, 4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 }); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.22 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const grid = new THREE.GridHelper(40, 40); grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);
const themeColours = () => { scene.background = new THREE.Color(css('--stage')); grid.material.color = new THREE.Color(css('--muted')); };
themeColours(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeColours); new MutationObserver(themeColours).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
const resize = () => { const r = stage.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); };
new ResizeObserver(resize).observe(stage);
const VIEWS = { side: [5.6, 1.6, 0], three: [3.9, 1.9, 4.1], front: [0, 1.6, 5.8], rear: [-3.4, 2.1, -4.3], low: [4.1, 0.45, 2.9] };
const setView = (v) => { camera.position.set(...VIEWS[v]); controls.target.set(0, 1.25, 0); controls.update(); };
setView('side');

const raw = await (await fetch('mount.json')).json();
let b64 = raw.glb ?? '';
for (const f of raw.parts ?? []) b64 += (await (await fetch(f)).json()).b64;
const bytes = await new Response(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
const gltf = await new GLTFLoader().parseAsync(bytes, '');
const root = gltf.scene; scene.add(root);
const meshes = []; root.traverse((o) => { if (o.isSkinnedMesh) { o.castShadow = true; o.frustumCulled = false; meshes.push(o); } });
const helper = new THREE.SkeletonHelper(root); helper.visible = false; scene.add(helper);
const mixer = new THREE.AnimationMixer(root);
// (the horse's clips name the list; a rider's of the same name play with them: rider:trot with mount:trot)
const clips = Object.fromEntries(gltf.animations.filter((a) => /^mount:/.test(a.name)).map((a) => [a.name.replace(/^mount:/, ''), a]));
const partners = (n) => gltf.animations.filter((a) => a.name !== 'mount:' + n && a.name.endsWith(':' + n));
const extras = Object.fromEntries((gltf.parser.json.animations || []).filter((a) => /^mount:/.test(a.name)).map((a) => [a.name.replace(/^mount:/, ''), a.extras || {}]));
let others = [];
let action = null, current = null, playing = true;
const fam = document.getElementById('families');
for (const [label, re] of FAMILIES) {
  const names = Object.keys(clips).filter((n) => re.test(n) && !(label === 'Transitions' && /^idle-/.test(n)));
  if (!names.length) continue;
  const s = document.createElement('div'); s.innerHTML = '<h2></h2><div class="clips"></div>'; s.querySelector('h2').textContent = label; s.style.marginBottom = '12px';
  for (const n of names) { const b = document.createElement('button'); b.type = 'button'; b.textContent = nice(n); b.dataset.clip = n; b.setAttribute('aria-pressed', 'false'); b.onclick = () => choose(n); s.querySelector('.clips').append(b); }
  fam.append(s);
}
const once = (n) => META.clips?.[n]?.once ?? !/^(walk|trot|canter|gallop|reinBack|idle-.*)$/.test(n);
function choose(n) {
  if (action) action.stop();
  for (const o of others) o.stop();
  current = n; action = mixer.clipAction(clips[n]); action.setLoop(THREE.LoopRepeat); action.clampWhenFinished = false; action.play();
  others = partners(n).map((a) => { const o = mixer.clipAction(a); o.setLoop(THREE.LoopRepeat); o.play(); return o; });
  for (const b of fam.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.clip === n));
  const d = clips[n].duration, sp = extras[n]['moj:speed'];
  document.getElementById('facts').innerHTML = '';
  for (const [k, v] of [['Clip', nice(n)], ['Length', d.toFixed(2) + ' s'], ['Plays', once(n) ? 'once (looped here)' : 'loops'], ['Ground speed', sp ? sp.toFixed(2) + ' m/s' : 'in place'], ['Keys', String(META.clips?.[n]?.keys ?? '')]]) {
    const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; document.getElementById('facts').append(dt, dd);
  }
}
const fileFacts = [['Vertices', (META.vertices ?? meshes[0]?.geometry.attributes.position.count)?.toLocaleString()], ['Triangles', META.triangles?.toLocaleString()], ['Bones', String(meshes[0]?.skeleton.bones.length ?? '')], ['Shapes', String(meshes[0]?.morphTargetInfluences?.length ?? 0)], ['Clips', String(gltf.animations.length)], ['Size', (bytes.byteLength / 1e6).toFixed(1) + ' MB']];
for (const [k, v] of fileFacts) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v ?? ''; document.getElementById('file').append(dt, dd); }
choose(clips.trot ? 'trot' : Object.keys(clips)[0]);
status.textContent = 'drag to orbit \\u00b7 scroll to zoom';

const $ = (id) => document.getElementById(id);
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; };
$('scrub').oninput = () => { if (!action) return; playing = false; $('play').textContent = 'Play'; action.time = clips[current].duration * $('scrub').value / 1000; for (const o of others) o.time = action.time; mixer.update(0); };
$('bones').onchange = () => { helper.visible = $('bones').checked; };
$('wire').onchange = () => { for (const m of meshes) for (const mat of [].concat(m.material)) mat.wireframe = $('wire').checked; };
$('view').onchange = () => setView($('view').value);
let groundAt = 0;
let last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000) * Number($('speed').value); last = now;
  if (playing) mixer.update(dt);
  // (the shapes off: the folds as linear blend skinning leaves them)
  if (!$('corr').checked) for (const m of meshes) if (m.morphTargetInfluences) m.morphTargetInfluences.fill(0);
  const sp = extras[current]?.['moj:speed'] ?? 0;
  if (playing && $('travel').checked) groundAt = (groundAt + sp * dt) % 1;
  grid.position.z = -groundAt;
  if (action) { const d = clips[current].duration; $('scrub').value = String(Math.round(1000 * (action.time % d) / d)); $('time').textContent = (action.time % d).toFixed(2) + ' s'; }
  controls.update(); renderer.render(scene, camera);
});
</script>
`;
writeFileSync(path.join(out, 'index.html'), page);
console.log(`wrote ${path.join(out, 'index.html')}, mount.json and ${parts.length} part(s) (${(glb.length / 1e6).toFixed(1)} MB GLB)`);
console.log(`publish with files ${JSON.stringify(Object.fromEntries(['mount.json', ...parts].map((f) => [f, path.join(out, f)])))}`);
