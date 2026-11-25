#!/usr/bin/env node
// street-people — the people of a city's pavements, assembled for review before they walk one: a SIX of realistic people
// (gameworld/street-cast.js streetSix: the hero door's form-field body and relational face, dressed for an ordinary day),
// each minted through the door and exported as the skinned GLB an engine (and the World page) gets, then stood in a row
// on a pavement under one sun and photographed: the row from the front and the front ¾, at a moment of a clip (walk,
// idle, or the bind), each face, each right hand. The machine read beside it: each person's stature and hand length and
// breadth against the stature's own (the anthropometric hand: about 0.108 of the stature long, 0.047 broad).
//
//   node scripts/street-people.mjs [--seed 7] [--locale los-angeles] [--set 0] [--out dir] [--jobs 2] [--reuse]
//                                  [--only p1,p3] [--clip walk|idle|bind] [--phase 0.3] [--spec '{…}' (merged over each)]
//
// Writes <out>/sheet.png (the row, front and ¾), <out>/close.png (faces and hands), <out>/read.json, and per person
// <id>.glb and <id>.read.json (the mint's own read). A mint is a few minutes; --reuse keeps those already in --out.
import { spawn } from 'node:child_process';
import { copyFileSync, createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire, register } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SELF = fileURLToPath(import.meta.url), CONTROL = path.resolve(path.dirname(SELF), '..');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);

// ─── the worker: one person minted and exported (a process of its own, so people mint side by side) ────────────────
if (process.argv[2] === '--worker') {
  const { spec, id, out } = JSON.parse(process.argv[3]);
  process.chdir(CONTROL);
  process.env.SQLITE_PATH = ':memory:'; process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
  process.env.MOJULO_OUTCOMES_DIR = path.join(out, '.outcomes', id);
  process.env.MOJULO_FACE_RIG_DIR ??= path.join(os.tmpdir(), 'street-people', 'face-rig');
  const { createCharacterHandler } = await import('@/lib/mcp/tools/create-character.js');
  const { exportModelHandler } = await import('@/lib/mcp/tools/sketch-model-export.js');
  const t0 = Date.now();
  const minted = await createCharacterHandler({ as: 'hero', spec });
  if (!minted.ok) { console.error(`${id}: the door refused: ${JSON.stringify(minted.error ?? minted).slice(0, 1200)}`); process.exit(1); }
  const glb = await exportModelHandler({ ref: minted.ref, format: 'glb', clips: '_all', skinned: true, lit: true });
  if (!glb.ok) { console.error(`${id}: the export refused: ${JSON.stringify(glb.error ?? glb).slice(0, 1200)}`); process.exit(1); }
  copyFileSync(glb.path, path.join(out, `${id}.glb`));
  const H = minted.hero ?? {};
  writeFileSync(path.join(out, `${id}.read.json`), JSON.stringify({ ref: minted.ref, seconds: Math.round((Date.now() - t0) / 1000), warnings: H.warnings ?? [], outline: H.dress?.outline ?? null }, null, 1));
  process.exit(0);
}

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) {
  const k = argv[i].replace(/^--/, '');
  if (k === 'reuse') opt.reuse = true; else opt[k] = argv[++i];
}
const seed = Number(opt.seed ?? 7), set = Number(opt.set ?? 0), locale = opt.locale ?? 'los-angeles';
const out = path.resolve(opt.out ?? path.join(os.tmpdir(), 'street-people')), jobs = Math.max(1, Number(opt.jobs ?? 2));
const clip = opt.clip ?? 'walk', phase = Number(opt.phase ?? 0.3), extra = opt.spec ? JSON.parse(opt.spec) : null;
mkdirSync(out, { recursive: true });

const { streetSix } = await import(pathToFileURL(path.join(CONTROL, 'lib/graph/gameworld/street-cast.js')).href);
let people = streetSix(seed, { locale, set });
if (opt.only) { const keep = new Set(opt.only.split(',')); people = people.filter((p) => keep.has(p.id)); }
if (extra) people = people.map((p) => ({ ...p, spec: { ...p.spec, ...extra } }));

// ─── mint ───────────────────────────────────────────────────────────────────
const todo = people.filter((p) => !(opt.reuse && existsSync(path.join(out, `${p.id}.glb`))));
const failed = [];
const runOne = (p) => new Promise((resolve) => {
  console.log(`minting ${p.id}: ${p.label} …`);
  const c = spawn(process.execPath, [SELF, '--worker', JSON.stringify({ spec: p.spec, id: p.id, out })], { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = ''; c.stderr.on('data', (d) => { err += d; });
  c.on('close', (code) => { if (code) { failed.push(p.id); console.error(err.trim().split('\n').filter((l) => !/ExperimentalWarning|--trace-warnings|Running as root/.test(l)).slice(-6).join('\n')); } resolve(); });
});
for (let i = 0; i < todo.length; i += jobs) await Promise.all(todo.slice(i, i + jobs).map(runOne));
const made = people.filter((p) => !failed.includes(p.id) && existsSync(path.join(out, `${p.id}.glb`)));
if (!made.length) { console.error('street-people: no one minted'); process.exit(1); }

// ─── the row: a page that stands them on a pavement, measures them and frames each shot ─────────────────────────────
const V = path.join(CONTROL, 'public/vendor/three');
for (const f of ['three.core.min.js', 'three.module.min.js', 'addons/loaders/GLTFLoader.js', 'addons/utils/SkeletonUtils.js']) {
  mkdirSync(path.dirname(path.join(out, 'vendor/three', f)), { recursive: true }); copyFileSync(path.join(V, f), path.join(out, 'vendor/three', f));
}
const manifest = { clip, phase, people: made.map((p) => ({ id: p.id, label: p.label })) };
writeFileSync(path.join(out, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>Street People</title>
<style>html,body{margin:0;background:#cfd3d6}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"./vendor/three/three.module.min.js","three/addons/":"./vendor/three/addons/"}}</script></head>
<body><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const M = ${JSON.stringify(manifest)};
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setPixelRatio(1); r.setSize(1600, 900); r.outputColorSpace = THREE.SRGBColorSpace; r.shadowMap.enabled = true;
document.body.appendChild(r.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#bcc8d2');
scene.add(new THREE.HemisphereLight('#dfe9f3', '#6b6560', 1.1));
const sun = new THREE.DirectionalLight('#fff2dc', 2.6); sun.position.set(4, 8, 6); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 4, bottom: -4 }); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), new THREE.MeshStandardMaterial({ color: '#9b9790', roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 100);
const loader = new GLTFLoader(), GAP = 1.15, figures = [];
const HAND = /^body:(hand|thumb|index|middle|ring|pinky)\\d?R$/;
for (const [i, P] of M.people.entries()) {
  const g = await loader.loadAsync('./' + P.id + '.glb'), root = g.scene;
  root.position.x = (i - (M.people.length - 1) / 2) * GAP; scene.add(root);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(root), A = g.animations.find((a) => a.name === 'body:' + M.clip);
  if (A) { const act = mixer.clipAction(A); act.play(); mixer.setTime(A.duration * M.phase); } else mixer.update(0);
  root.updateMatrixWorld(true);
  figures.push({ P, root, mixer });
}
// (the read, on the posed skin: the stature off the bind's box; the right hand, wrist to the farthest point its bones carry,
// and its breadth across the knuckles)
const v = new THREE.Vector3(), reads = [];
for (const F of figures) {
  let skinned = null; F.root.traverse((o) => { if (o.isSkinnedMesh && !skinned) skinned = o; });
  const box = new THREE.Box3().setFromObject(F.root, true);
  const read = { id: F.P.id, label: F.P.label, stature: +(box.max.y - box.min.y).toFixed(3) };
  if (skinned) {
    const S = skinned.skeleton, names = S.bones.map((b) => b.name), wristI = names.indexOf('body:handR');
    const handBones = new Set(names.map((n, k) => (HAND.test(n) ? k : -1)).filter((k) => k >= 0));
    const geo = skinned.geometry, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    const wrist = new THREE.Vector3().setFromMatrixPosition(S.bones[wristI].matrixWorld);
    const idx = (n) => S.bones[names.indexOf('body:' + n)];
    const knuckle = (n) => new THREE.Vector3().setFromMatrixPosition(idx(n).matrixWorld);
    let far = 0, pts = [];
    for (let k = 0; k < si.count; k++) {
      let best = 0, bi = -1; for (let c = 0; c < 4; c++) { const w = sw.getComponent(k, c); if (w > best) { best = w; bi = si.getComponent(k, c); } }
      if (!handBones.has(bi)) continue;
      skinned.getVertexPosition(k, v); v.applyMatrix4(skinned.matrixWorld); pts.push(v.clone());
      far = Math.max(far, v.distanceTo(wrist));
    }
    // (the breadth: the hand's points near the knuckles' line, across it)
    const a = knuckle('index1R'), b = knuckle('middle1R'), across = a.clone().sub(b).normalize(), mid = a.clone().add(b).multiplyScalar(0.5);
    const along = mid.clone().sub(wrist).normalize();
    let lo = Infinity, hi = -Infinity;
    for (const p of pts) { const d = p.clone().sub(mid); if (Math.abs(d.dot(along)) > 0.012) continue; const s = d.dot(across); lo = Math.min(lo, s); hi = Math.max(hi, s); }
    Object.assign(read, { hand: +far.toFixed(3), handBreadth: +(hi - lo).toFixed(3), handShare: +(far / read.stature).toFixed(3), breadthShare: +((hi - lo) / read.stature).toFixed(3) });
    F.wrist = wrist; F.tip = mid.clone().add(along.clone().multiplyScalar(0.05));
  }
  F.box = box; reads.push(read);
}
const frame = (pos, at, fov = 30) => { cam.fov = fov; cam.updateProjectionMatrix(); cam.position.set(...pos); cam.lookAt(...at); r.render(scene, cam); };
const W = (M.people.length - 1) * GAP;
window.street = {
  reads,
  count: figures.length,
  row(view) {
    const d = 3.2 + W * 1.05;
    if (view === 'front') frame([0, 1.0, d], [0, 0.88, 0]);
    else frame([d * 0.62, 1.15, d * 0.8], [0, 0.85, 0]);
  },
  face(i) { const F = figures[i], h = F.box.max.y; frame([F.root.position.x + 0.08, h - 0.1, 0.75], [F.root.position.x, h - 0.12, 0], 22); },
  hand(i) { const F = figures[i]; if (!F.wrist) return; const c = F.wrist.clone().lerp(F.tip, 0.5); frame([c.x - 0.25, c.y + 0.05, c.z + 0.42], [c.x, c.y, c.z], 26); },
  ready: true,
};
</script></body></html>`);

// ─── shoot ──────────────────────────────────────────────────────────────────
const req = createRequire(path.join(CONTROL, 'package.json')), sharp = req('sharp');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import(pathToFileURL(path.join(CONTROL, 'lib/graph/scene/chromium.js')).href);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary' };
const server = createServer((rq, rs) => {
  const rel = decodeURIComponent(new URL(rq.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html', file = path.resolve(out, rel);
  if (!file.startsWith(out + path.sep) || !existsSync(file) || !statSync(file).isFile()) { rs.writeHead(404).end(); return; }
  rs.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }); createReadStream(file).pipe(rs);
});
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const browser = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_WEBGL_ARGS });
const logs = [];
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', (e) => logs.push(e.message));
  await page.setViewport({ width: 1600, height: 900 });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.street?.ready, { timeout: 300000 }).catch(() => { throw new Error(`street-people: the page never stood them up: ${logs.join(' | ') || 'no console errors'}`); });
  const shot = async (js) => { await page.evaluate(js); return page.screenshot({ type: 'png' }); };
  const label = (text, w) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="26"><text x="8" y="18" font-family="monospace" font-size="14" fill="#1d1f22">${text.replace(/[&<>]/g, '')}</text></svg>`);
  // the row, front over ¾
  const front = await shot('street.row("front")'), quarter = await shot('street.row("quarter")');
  await sharp({ create: { width: 1600, height: 1852, channels: 3, background: '#ecebe7' } })
    .composite([{ input: front, left: 0, top: 0 }, { input: label(`front · ${clip} @ ${phase}`, 1600), left: 0, top: 900 }, { input: quarter, left: 0, top: 926 }, { input: label(`front 3/4 · ${made.map((p) => p.id).join(' ')}`, 1600), left: 0, top: 1826 }])
    .png().toFile(path.join(out, 'sheet.png'));
  // the faces over the hands, one column a person
  const reads = await page.evaluate(() => window.street.reads), T = 400, Hh = 300, comps = [];
  for (const [i, R] of reads.entries()) {
    const face = await shot(`street.face(${i})`), hand = await shot(`street.hand(${i})`);
    comps.push({ input: await sharp(face).extract({ left: 400, top: 112, width: 800, height: 600 }).resize(T, Hh).toBuffer(), left: i * T, top: 0 });
    comps.push({ input: label(`${R.id} ${R.label}`.slice(0, 44), T), left: i * T, top: Hh });
    comps.push({ input: await sharp(hand).extract({ left: 400, top: 112, width: 800, height: 600 }).resize(T, Hh).toBuffer(), left: i * T, top: Hh + 26 });
    comps.push({ input: label(`hand ${R.handShare ?? '?'} of ${R.stature} m`, T), left: i * T, top: 2 * Hh + 26 });
  }
  await sharp({ create: { width: T * reads.length, height: 2 * Hh + 52, channels: 3, background: '#ecebe7' } }).composite(comps).png().toFile(path.join(out, 'close.png'));
  writeFileSync(path.join(out, 'read.json'), JSON.stringify({ seed, locale, set, clip, phase, people: reads.map((R) => ({ ...R, spec: made.find((p) => p.id === R.id).spec })) }, null, 1));
  console.log('\nid   stature  hand (share)     breadth (share)   who');
  for (const R of reads) console.log(`${R.id.padEnd(4)} ${String(R.stature).padEnd(8)} ${String(R.hand).padEnd(6)} (${R.handShare})  ${String(R.handBreadth).padEnd(6)} (${R.breadthShare})    ${R.label}`);
  console.log('the anthropometric hand: about 0.108 of the stature long, 0.047 broad');
  console.log(`\n${path.join(out, 'sheet.png')}\n${path.join(out, 'close.png')}`);
  if (logs.length) console.error(`console errors: ${logs.slice(0, 5).join(' | ')}`);
} finally { await browser.close(); server.close(); }
