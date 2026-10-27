// ONE TREE AS FORM (gen-7's trees, first look): a grown tree (vegetation/grow.js) drawn as a renderer lights it, no light
// baked in. Its wood the grower's axes as tubes with smooth normals (form/tree-form.js), its bark the fracture model's
// relief read as material and marched by parallax near (form/bark-material.js); its foliage a few seeded sprays per
// species (vegetation/sprays.js: the species' phyllotaxis and leaf outline) cloned on the crown's sites, each grown to
// hold its cell's leaf area, its normal bent toward the crown's outside so the crown takes the sun as one volume, the
// light through a leaf a little fill in its shade, its
// tone the crown's own shade (the grower's shadow grid) as occlusion. Far off the crown keeps fewer sites, each grown to
// hold the cover: never a ball, never a swap. `window.measure()` reads what is drawn. The look is the operator's.
//
//   node scripts/spikes/form/tree.mjs [--out <file.html>] [--cdn] [--species oak,beech,cherry] [--seed 1234]
import fs from 'node:fs';
import { treeForm } from '../../../lib/graph/form/tree-form.js';
import { barkMaterial } from '../../../lib/graph/form/bark-material.js';
import { leafSpray } from '../../../lib/graph/vegetation/sprays.js';
import { encodePng } from '../../../lib/graph/landscape/surface-textures.js';
import { CDN_IMPORTMAP, inlineImportmap } from '../../../lib/graph/scene/emit-util.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('--out', 'tree.html'), cdn = process.argv.includes('--cdn'), seed = Number(arg('--seed', 1234));
const species = arg('--species', 'oak,beech,cherry').split(',');
const SPRAYS = 3;
/** Far off: the share of sites kept at a distance (m), the kept ones grown to hold the cover. */
const LOD = { near: 25, far: 90, keep: 0.35, grow: 1.7 };

const lin = (c) => c.map((v) => { v /= 255; return Math.round((v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) * 1e4) / 1e4; });
const png = (rgb, W, H) => `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
const trees = species.map((sp) => {
  const T = treeForm(sp, { seed }), B = barkMaterial(T.bark);
  const sprays = Array.from({ length: SPRAYS }, (_, k) => {
    const S = leafSpray(sp, { seed: seed * 31 + k });
    return { p: S.tris.flatMap((t) => t.p.flat().map((v) => Math.round(v * 1e4) / 1e4)), c: S.tris.flatMap((t) => { const c = lin(t.c); return [...c, ...c, ...c]; }), tris: S.tris.length };
  });
  return { species: sp, height: T.height, wood: T.wood, sites: T.sites, sprays,
    bark: { metres: B.metres, depth: B.depth, base: png(B.baseColor, B.W, B.H), normal: png(B.normal, B.W, B.H), orm: png(B.orm, B.W, B.H), height: png(B.height, B.W, B.H) } };
});
const importmap = cdn ? CDN_IMPORTMAP : inlineImportmap();

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>One Tree as Form</title>
<style>
  :root { --bg: #15171c; --panel: #1d2028; --line: #2c313c; --fg: #e8eaee; --muted: #9aa1ae; --accent: #8fc46a; color-scheme: dark; }
  html, body { height: 100%; margin: 0; } body { background: var(--bg); color: var(--fg); font: 13px/1.4 system-ui, sans-serif; display: flex; flex-direction: column; }
  header { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; padding: 10px max(16px, env(safe-area-inset-left, 0px)); background: var(--panel); border-bottom: 1px solid var(--line); }
  h1 { font-size: 15px; margin: 0 8px 0 0; } .group { display: flex; gap: 4px; flex-wrap: wrap; }
  button { background: #262a34; color: var(--fg); border: 1px solid var(--line); border-radius: 6px; padding: 4px 10px; font: inherit; cursor: pointer; }
  button[aria-pressed=true] { border-color: var(--accent); color: var(--accent); }
  label { display: flex; gap: 8px; align-items: center; color: var(--muted); } input[type=range] { width: 120px; accent-color: var(--accent); }
  #stats { color: var(--muted); font-variant-numeric: tabular-nums; }
  #wrap { flex: 1; position: relative; min-height: 0; } canvas { display: block; width: 100%; height: 100%; }
</style></head><body>
<header><h1>One tree as form</h1>
  <div class="group" id="sp"></div>
  <div class="group" id="cam"><button data-c="near">Near</button><button data-c="mid">Mid</button><button data-c="far">Far</button><button data-c="bark">Bark</button></div>
  <label>Sun <input id="sun" type="range" min="0" max="360" value="130"></label>
  <button id="pom" aria-pressed="true">Bark parallax</button>
  <span id="stats"></span>
</header>
<div id="wrap"></div>
<script type="importmap">${importmap}</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const TREES = ${JSON.stringify(trees)}, LOD = ${JSON.stringify(LOD)};
const wrap = document.getElementById('wrap'), renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; wrap.appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9cc4e8); scene.fog = new THREE.Fog(0x9cc4e8, 80, 260);
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 600); camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement);
scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x4a5a34, 1.3));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; scene.add(sun, sun.target);
const ground = new THREE.Mesh(new THREE.CircleGeometry(220, 64), new THREE.MeshStandardMaterial({ color: 0x5f8a3c, roughness: 1 })); ground.receiveShadow = true; scene.add(ground);
const tl = new THREE.TextureLoader(), POM = { on: { value: 1 } };
let current = null;

// the bark: its own colour, its relief's normal, the fissures' occlusion and its roughness, and the relief marched by
// parallax near (the material's own samplers re-routed through the marched coordinate)
function barkMat(B) {
  const tex = (u, srgb) => { const t = tl.load(u); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const orm = tex(B.orm), m = new THREE.MeshStandardMaterial({ map: tex(B.base, true), normalMap: tex(B.normal), roughnessMap: orm, aoMap: orm, roughness: 1, metalness: 0 });
  const U = { tBarkH: { value: tex(B.height) }, uPomDepth: { value: B.depth / B.metres }, uPomOn: POM.on };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    const via = (chunk, v) => THREE.ShaderChunk[chunk].split(v).join('pomUv');
    sh.fragmentShader = 'uniform sampler2D tBarkH;\\nuniform float uPomDepth, uPomOn;\\n' + sh.fragmentShader
      .replace('void main() {', ['void main() {',
        '  vec2 pomUv = vMapUv;',
        '  if ( uPomOn > 0.5 ) {',
        '    vec3 Vv = normalize( vViewPosition ), Nn = normalize( vNormal ), q1 = dFdx( -vViewPosition ), q2 = dFdy( -vViewPosition );',
        '    vec2 s1 = dFdx( vMapUv ), s2 = dFdy( vMapUv ); vec3 a2 = cross( q2, Nn ), a1 = cross( Nn, q1 );',
        '    vec3 Tt = normalize( a2 * s1.x + a1 * s2.x ), Bt = normalize( a2 * s1.y + a1 * s2.y ), Vt = vec3( dot( Vv, Tt ), dot( Vv, Bt ), dot( Vv, Nn ) );',
        '    float fade = 1.0 - smoothstep( 6.0, 14.0, length( vViewPosition ) );',
        '    if ( fade > 0.0 && Vt.z > 0.05 ) {',
        '      vec2 dir = -Vt.xy / Vt.z * uPomDepth * fade; float cur = 1.0, h = texture( tBarkH, pomUv ).r;',
        '      for ( int i = 0; i < 12; i++ ) { if ( h >= cur ) break; cur -= 1.0 / 12.0; pomUv += dir / 12.0; h = texture( tBarkH, pomUv ).r; }',
        '    }',
        '  }'].join('\\n'))
      .replace('#include <map_fragment>', via('map_fragment', 'vMapUv'))
      .replace('#include <normal_fragment_maps>', via('normal_fragment_maps', 'vNormalMapUv'))
      .replace('#include <roughnessmap_fragment>', via('roughnessmap_fragment', 'vRoughnessMapUv'))
      .replace('#include <aomap_fragment>', via('aomap_fragment', 'vAoMapUv'));
  };
  m.customProgramCacheKey = () => 'bark-pom';
  return m;
}

function build(T) {
  const g = new THREE.Group();
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(T.wood.pos, 3)); wg.setAttribute('normal', new THREE.Float32BufferAttribute(T.wood.nrm, 3));
  wg.setAttribute('uv', new THREE.Float32BufferAttribute(T.wood.uv, 2)); wg.setIndex(T.wood.idx);
  const wood = new THREE.Mesh(wg, barkMat(T.bark)); wood.castShadow = wood.receiveShadow = true; g.add(wood);
  // the crown: its sites, the centre they stand round (their normals bent out from it)
  const C = T.sites.reduce((a, s) => [a[0] + s.p[0], a[1] + s.p[1], a[2] + s.p[2]], [0, 0, 0]).map((v) => v / T.sites.length);
  const leaves = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0), roll = new THREE.Quaternion();
  T.sprays.forEach((S, k) => {
    const mine = T.sites.filter((_, i) => i % T.sprays.length === k);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(S.p, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(S.c, 3)); sg.computeVertexNormals();
    const out = new Float32Array(mine.length * 3);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
    const U = { uGrow: { value: 1 } };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'attribute vec3 aOut;\\nuniform float uGrow;\\n' + sh.vertexShader
        .replace('#include <begin_vertex>', 'vec3 transformed = position * uGrow;')
        // (a leaf's normal bent toward the crown's outside: the crown takes the sun as one volume)
        .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\\n  transformedNormal = normalize( mix( transformedNormal, normalMatrix * aOut, 0.65 ) );');
      sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\\n  normal *= faceDirection;')
        // (a leaf is thin: some of the sun comes through it, a fill in the crown's shade)
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\\n  reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.22;');
    };
    mat.customProgramCacheKey = () => 'spray';
    const im = new THREE.InstancedMesh(sg, mat, mine.length);
    mine.forEach((s, i) => {
      const d = new THREE.Vector3(...s.d); q.setFromUnitVectors(X, d); roll.setFromAxisAngle(d, s.r * 40); q.premultiply(roll);
      m4.compose(new THREE.Vector3(...s.p), q, new THREE.Vector3(s.s, s.s, s.s)); im.setMatrixAt(i, m4);
      // (the crown's own shade there, as occlusion: the grower's shadow grid)
      const tone = 0.62 + 0.38 * s.e; im.setColorAt(i, new THREE.Color(tone, tone, tone));
      const o = new THREE.Vector3(s.p[0] - C[0], s.p[1] - C[1], (s.p[2] - C[2]) * 0.8 + 0.4).normalize(); out.set([o.x, o.y, o.z], i * 3);
    });
    sg.setAttribute('aOut', new THREE.InstancedBufferAttribute(out, 3));
    im.castShadow = im.receiveShadow = true; g.add(im); leaves.push({ im, n: mine.length, U, tris: S.tris });
  });
  return { group: g, leaves, woodTris: T.wood.idx.length / 3, T, centre: C };
}

const built = {};
function show(sp) {
  if (current) scene.remove(current.group);
  current = built[sp] || (built[sp] = build(TREES.find((t) => t.species === sp))); scene.add(current.group);
  const H = current.T.height; sun.shadow.camera.left = sun.shadow.camera.bottom = -H; sun.shadow.camera.right = sun.shadow.camera.top = H; sun.shadow.camera.far = H * 6; sun.shadow.camera.updateProjectionMatrix();
  for (const b of document.querySelectorAll('#sp button')) b.setAttribute('aria-pressed', String(b.dataset.s === sp));
  aimSun(); view(lastView);
}
let lastView = 'near';
function view(c) {
  lastView = c; const H = current.T.height, C = current.centre;
  const at = { near: [H * 0.9, -H * 0.55, 1.7], mid: [H * 2.2, -H * 1.3, H * 0.4], far: [70, -45, 6], bark: [1.1, -0.9, 1.4] }[c];
  const look = c === 'bark' ? [0, 0, 1.3] : c === 'near' ? [C[0], C[1], H * 0.45] : [C[0], C[1], H * 0.5];
  camera.position.set(...at); controls.target.set(...look); controls.update();
  for (const b of document.querySelectorAll('#cam button')) b.setAttribute('aria-pressed', String(b.dataset.c === c));
}
function aimSun() {
  const a = (+document.getElementById('sun').value * Math.PI) / 180, H = current ? current.T.height : 10;
  sun.position.set(Math.cos(a) * H * 2.5, Math.sin(a) * H * 2.5, H * 2.2); sun.target.position.set(0, 0, H * 0.4);
}
for (const t of TREES) { const b = document.createElement('button'); b.textContent = t.species; b.dataset.s = t.species; b.onclick = () => show(t.species); document.getElementById('sp').appendChild(b); }
for (const b of document.querySelectorAll('#cam button')) b.onclick = () => view(b.dataset.c);
document.getElementById('sun').oninput = aimSun;
const pomB = document.getElementById('pom'); pomB.onclick = () => { POM.on.value = 1 - POM.on.value; pomB.setAttribute('aria-pressed', String(POM.on.value > 0.5)); };
function resize() { const w = wrap.clientWidth, h = wrap.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
// far off, fewer sites, the kept ones grown to hold the cover (sites are in rank order: the first ones kept)
function lod() {
  const d = camera.position.distanceTo(new THREE.Vector3(current.centre[0], current.centre[1], current.centre[2]));
  const keep = d <= LOD.near ? 1 : Math.max(LOD.keep, 1 - (1 - LOD.keep) * Math.min(1, (d - LOD.near) / (LOD.far - LOD.near)));
  let tris = 0; for (const L of current.leaves) { L.im.count = Math.max(1, Math.round(L.n * keep)); L.U.uGrow.value = Math.min(LOD.grow, 1 / Math.sqrt(keep)); tris += L.im.count * L.tris; }
  return { keep, leafTris: tris };
}
let stat = {};
window.measure = () => ({ species: current.T.species, height: current.T.height, sites: current.T.sites.length, woodTris: current.woodTris, ...stat });
renderer.setAnimationLoop(() => {
  stat = lod(); controls.update(); renderer.render(scene, camera);
  document.getElementById('stats').textContent = current.T.species + ' · ' + current.T.height.toFixed(1) + ' m · wood ' + current.woodTris + ' tris · leaves ' + stat.leafTris + ' tris (' + Math.round(stat.keep * 100) + '% of sites)';
});
show(TREES[0].species);
window.__treeReady = true;
</script></body></html>`;
fs.writeFileSync(out, html);
console.log(out, (html.length / 1e6).toFixed(1), 'MB', trees.map((t) => `${t.species}: ${t.height.toFixed(1)} m, wood ${t.wood.idx.length / 3} tris, ${t.sites.length} sites`).join('; '));
