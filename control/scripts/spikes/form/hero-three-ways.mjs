// THE HERO THREE WAYS (the gen-7 form render on a character): one comic hero pack member, minted through the door with
// its look's geocube, shown side by side. (a) the paint (gen-6: the cube's cast light baked into the vertex colour,
// drawn unlit, as the World page and the default GLB draw it); (b) the form with one response (the `lit` export today:
// the albedo under no light, one matte material for the whole figure); (c) the form by response (the same albedo, each
// group's material from its palette group, dress-materials.js, as the static export buckets it). (b) and (c) are lit by
// the colour theorist's rig (color-theorist/hero-light.js heroFormLight: the cube's key, its sky's fill and its floor's
// bounce as a hemisphere, the horizon as a rim from behind), and the page prints the theorist's reads beside them: the
// machine gate. How it looks is the operator's.
//
//   node scripts/spikes/form/hero-three-ways.mjs [--member hero] [--look dcau-golden] [--era silver] [--out <file.html>] [--cdn]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
process.chdir(CONTROL);
process.env.SQLITE_PATH = ':memory:'; process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
process.env.MOJULO_OUTCOMES_DIR ??= path.join(os.tmpdir(), 'hero-three-ways');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const member = arg('--member', 'hero'), lookId = arg('--look', 'dcau-golden'), era = arg('--era', undefined);
const out = path.resolve(arg('--out', 'hero-three-ways.html')), cdn = process.argv.includes('--cdn');

const { memberOrders } = await import('@/lib/graph/cosmos/packs/comic-hero/characters.js');
const { LOOKS } = await import('@/lib/graph/cosmos/packs/comic-hero/looks.js');
const { readGeocube } = await import('@/lib/graph/era/geocube.js');
const { dressSurfaces } = await import('@/lib/graph/materials/dress-materials.js');
const { armorFamily, armorMaterials } = await import('@/lib/graph/armor/expand.js');
const { heroFormLight } = await import('@/lib/graph/color-theorist/hero-light.js');
const { createCharacterHandler } = await import('@/lib/mcp/tools/create-character.js');
const { exportModelHandler } = await import('@/lib/mcp/tools/sketch-model-export.js');
const { CDN_IMPORTMAP, inlineImportmap } = await import('@/lib/graph/scene/emit-util.js');

// the hero wears its look's cube (its cast light baked in at gen-6) with materials named, so its groups take responses
const L = LOOKS[lookId];
if (!L) throw new Error(`hero-three-ways: no look '${lookId}' (known: ${Object.keys(LOOKS).join(', ')})`);
const geocube = { ...L.geocube, materials: L.geocube.materials ?? { age: 'new' } };
const spec = { ...memberOrders(member, lookId, era ? { era } : {}).mint.args.spec, geocube };
const minted = await createCharacterHandler({ as: 'hero', spec });
if (!minted.ok) throw new Error(`hero-three-ways: the door refused: ${JSON.stringify(minted.error ?? minted).slice(0, 600)}`);

// a static GLB read back into plain arrays: each primitive's positions, colours, indices and its material's pbr
function glbMeshes(file) {
  const b = fs.readFileSync(file), jl = b.readUInt32LE(12), J = JSON.parse(b.subarray(20, 20 + jl).toString());
  const bin = b.subarray(20 + jl + 8), N = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array, 5121: Uint8Array };
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const read = (i) => { const A = J.accessors[i], V = J.bufferViews[A.bufferView], T = N[A.componentType], n = A.count * width[A.type];
    const raw = new T(bin.buffer.slice(bin.byteOffset + (V.byteOffset ?? 0) + (A.byteOffset ?? 0), bin.byteOffset + (V.byteOffset ?? 0) + (A.byteOffset ?? 0) + n * T.BYTES_PER_ELEMENT));
    const k = width[A.type], arr = Array.from(raw, (v) => (A.normalized ? v / (T === Uint8Array ? 255 : 65535) : v));
    return k === 4 ? arr.filter((_, j) => j % 4 !== 3) : arr; };
  // (the figure alone: the export's `static` mesh is the stage it stands on)
  return J.meshes.flatMap((m) => m.primitives.map((p) => { const M = J.materials?.[p.material] ?? {}, P = M.pbrMetallicRoughness ?? {};
    return { name: M.name ?? 'body', pos: read(p.attributes.POSITION).map((v) => Math.round(v * 1e4) / 1e4), col: read(p.attributes.COLOR_0).map((v) => Math.round(v * 1e3) / 1e3), idx: p.indices !== undefined ? read(p.indices) : null,
      metal: P.metallicFactor ?? 0, rough: P.roughnessFactor ?? 1 }; })).filter((m) => m.name !== 'static');
}
const glbOf = async (args) => { const g = await exportModelHandler({ ref: minted.ref, format: 'glb', ...args }); if (!g.ok) throw new Error(`hero-three-ways: export refused: ${JSON.stringify(g).slice(0, 400)}`); return glbMeshes(g.path); };
const paint = await glbOf({}), form = await glbOf({ lit: true });

const cube = readGeocube({ ...geocube, era: 'gen-7' });
const groupsRecipe = spec.palette;
const surfaces = dressSurfaces({ palette: groupsRecipe, family: armorFamily(spec.adorn), card: armorMaterials(spec.adorn), overrides: geocube.materials === true ? null : geocube.materials }) || {};
const light = heroFormLight(cube, { palette: groupsRecipe, surfaces });
const data = { paint, form, rig: light.rig, reads: light.reads, why: light.why, title: `${member} · ${lookId}` };
const importmap = cdn ? CDN_IMPORTMAP : inlineImportmap();

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hero Three Ways</title>
<style>
  :root { --bg: #15171c; --panel: #1d2028; --line: #2c313c; --fg: #e8eaee; --muted: #9aa1ae; --ok: #7bc47f; --no: #f08a5a; color-scheme: dark; }
  html, body { height: 100%; margin: 0; } body { background: var(--bg); color: var(--fg); font: 13px/1.4 system-ui, sans-serif; display: flex; flex-direction: column; }
  header { display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: center; padding: 10px 16px; background: var(--panel); border-bottom: 1px solid var(--line); }
  h1 { font-size: 15px; margin: 0; } label { display: flex; gap: 8px; align-items: center; color: var(--muted); } input[type=range] { width: 120px; }
  main { flex: 1; display: grid; grid-template-columns: 1fr 320px; min-height: 0; }
  #wrap { position: relative; min-height: 0; } canvas { display: block; width: 100%; height: 100%; }
  .tags { position: absolute; left: 0; right: 0; bottom: 10px; display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; pointer-events: none; }
  .tags b { display: block; } .tags span { color: var(--muted); font-size: 12px; }
  aside { border-left: 1px solid var(--line); padding: 12px 16px; overflow: auto; background: var(--panel); } aside h2 { font-size: 13px; margin: 12px 0 6px; }
  .r { margin: 0 0 8px; } .ok { color: var(--ok); } .no { color: var(--no); } .sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; vertical-align: middle; margin-right: 4px; border: 1px solid var(--line); }
  @media (max-width: 760px) { main { grid-template-columns: 1fr; grid-template-rows: 60vh auto; } aside { border-left: 0; border-top: 1px solid var(--line); } }
</style></head><body>
<header><h1>Hero Three Ways: ${data.title}</h1>
  <label for="az">key azimuth <input id="az" type="range" min="-180" max="180" value="0"></label>
  <label for="rim">rim <input id="rim" type="range" min="0" max="100" value="${Math.round(light.rig.rim.strength * 100)}"></label>
</header>
<main><div id="wrap"><canvas id="c"></canvas>
  <div class="tags"><div><b>(a) paint</b><span>the cube's light baked in (gen-6)</span></div><div><b>(b) form, one response</b><span>albedo, one matte material, the rig</span></div><div><b>(c) form by response</b><span>albedo, each group's material, the rig</span></div></div></div>
<aside id="side"></aside></main>
<script type="importmap">${importmap}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const D = ${JSON.stringify(data)};
const cv = document.getElementById('c'), renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = D.rig.exposure;
const scene = new THREE.Scene(); scene.background = new THREE.Color(D.rig.rim.color);
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100); camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, cv);
const build = (meshes, mode) => { const g = new THREE.Group();
  for (const m of meshes) { const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(m.col, 3));
    if (m.idx) geo.setIndex(m.idx); geo.computeVertexNormals();
    const mat = mode === 'paint' ? new THREE.MeshBasicMaterial({ vertexColors: true })
      : new THREE.MeshStandardMaterial({ vertexColors: true, metalness: mode === 'response' ? m.metal : 0, roughness: mode === 'response' ? m.rough : 0.85 });
    g.add(new THREE.Mesh(geo, mat)); }
  return g; };
// the albedo in a lit export is display colour: three.js wants it linear
for (const m of D.form) m.col = m.col.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
const a = build(D.paint, 'paint'), b = build(D.form, 'one'), c = build(D.form, 'response');
const box = new THREE.Box3().setFromObject(b), H = box.max.z - box.min.z, GAP = H * 0.55;
[a, b, c].forEach((g, i) => { g.position.x = (i - 1) * GAP; scene.add(g); });
// the paint ignores the lights (it carries its own); the rig lights (b) and (c)
const key = new THREE.DirectionalLight(D.rig.key.color, D.rig.key.intensity * Math.PI);
const hemi = new THREE.HemisphereLight(D.rig.fill.sky, D.rig.fill.ground, D.rig.fill.intensity * Math.PI); hemi.up.set(0, 0, 1);
const rim = new THREE.DirectionalLight(D.rig.rim.color, 0);
scene.add(key, key.target, hemi, rim, rim.target);
const place = () => { const az = Number(document.getElementById('az').value) * Math.PI / 180, t = D.rig.key.toLight, c0 = Math.cos(az), s0 = Math.sin(az);
  const dir = new THREE.Vector3(t[0] * c0 - t[1] * s0, t[0] * s0 + t[1] * c0, t[2]);
  key.position.copy(dir.clone().multiplyScalar(10)); rim.position.set(-dir.x * 10, -dir.y * 10, 4);
  rim.intensity = (Number(document.getElementById('rim').value) / 100) * Math.PI * 1.5; };
document.getElementById('az').oninput = place; document.getElementById('rim').oninput = place; place();
const mid = (box.min.z + box.max.z) / 2;
camera.position.set(0, H * 4.2, mid + H * 0.15); controls.target.set(0, 0, mid);
const size = () => { const w = cv.clientWidth, h = cv.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
addEventListener('resize', size); size();
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
const esc = (s) => String(s).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
const sw = (hex) => '<span class="sw" style="background:' + hex + '"></span>';
document.getElementById('side').innerHTML = '<h2>The rig</h2><p class="r">' + sw(D.rig.key.color) + 'key ' + D.rig.key.intensity + ' · ' + sw(D.rig.fill.sky) + sw(D.rig.fill.ground) + 'fill ' + D.rig.fill.intensity + ' · ' + sw(D.rig.rim.color) + 'rim ' + D.rig.rim.strength + ' · exposure ' + D.rig.exposure + '</p>'
  + '<h2>The theorist\\'s reads (machine gate)</h2>' + D.reads.map((r) => '<p class="r"><b class="' + (r.ok ? 'ok' : 'no') + '">' + (r.ok ? 'holds' : 'fails') + '</b> ' + esc(r.law) + ': ' + esc(r.note) + '</p>').join('')
  + '<h2>Why</h2>' + D.why.map((w) => '<p class="r">' + esc(w) + '</p>').join('') + '<p class="r" style="color:var(--muted)">The look is the eyes gate\\'s: the reads are a proxy, not this render.</p>';
</script></body></html>`;
fs.writeFileSync(out, html);
console.log(`hero-three-ways: ${out} (${Math.round(html.length / 1024)} KB): ${light.reads.map((r) => `${r.law} ${r.ok ? 'holds' : 'fails'}`).join(', ')}`);
process.exit(0);
