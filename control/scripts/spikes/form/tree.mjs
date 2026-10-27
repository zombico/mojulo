// ONE TREE AS FORM (gen-7's trees, first look): a grown tree (vegetation/grow.js) drawn as a renderer lights it, no light
// baked in. Its wood the grower's axes as tubes with smooth normals (form/tree-form.js), its bark the fracture model's
// relief read as material and marched by parallax near (form/bark-material.js); its foliage CLUMPS everywhere, rosettes of
// a few oversized leaves of its species' outline (vegetation/sprays.js), and near the eye its SPRAYS (the species'
// phyllotaxis and leaf, a twig each) coming in inside them as the clumps draw in: the grass's carpet and blades, nothing
// from nothing. A clump and the sprays of its cell hold the same leaf area; every leaf's normal bent toward the crown's
// outside so the crown takes the sun as one volume, the light through a leaf a little fill in its shade, its tone the
// crown's own shade (the grower's shadow grid) as occlusion. Far off the crown keeps fewer clumps, each grown to hold the
// cover: never a ball, never a swap. `window.measure()` reads what is drawn. The look is the operator's.
// The BUSHES (form/bush-form.js: a bush kind's habit, its stems and its clumps laid over its outline) on the same page,
// by their leaf form (`--bushes`).
//
//   node scripts/spikes/form/tree.mjs [--out <file.html>] [--cdn] [--species oak,beech,cherry] [--bushes spray,plate,…] [--seed 1234]
import fs from 'node:fs';
import { treeForm } from '../../../lib/graph/form/tree-form.js';
import { bushForm, bushBlossom, bushBerries, BUSH_HABITS, ADORN } from '../../../lib/graph/form/bush-form.js';
import { barkMaterial } from '../../../lib/graph/form/bark-material.js';
import { leafSpray, leafClump } from '../../../lib/graph/vegetation/sprays.js';
import { encodePng } from '../../../lib/graph/landscape/surface-textures.js';
import { CDN_IMPORTMAP, inlineImportmap } from '../../../lib/graph/scene/emit-util.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('--out', 'tree.html'), cdn = process.argv.includes('--cdn'), seed = Number(arg('--seed', 1234));
const species = arg('--species', 'oak,beech,cherry,spruce,silverfir,pine,fir,schefflera').split(',').filter(Boolean);
const bushes = arg('--bushes', Object.keys(BUSH_HABITS).join(',')).split(',').filter(Boolean);
const SPRAYS = 3, CLUMPS = 3;
/** Far off: the share of clumps kept at a distance (m), the kept ones grown to hold the cover; near: where the sprays come
 *  in (m: whole within the first, none past the second), the clumps drawn in to `draw` where they are whole. */
const LOD = { near: 25, far: 90, keep: 0.35, grow: 1.7, detail: [6, 16], draw: 1 };

const lin = (c) => c.map((v) => { v /= 255; return Math.round((v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4) * 1e4) / 1e4; });
const png = (rgb, W, H) => `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
const trees = [...species, ...bushes.map((f) => `bush:${f}`)].map((sp) => {
  const bush = sp.startsWith('bush:'), T = bush ? bushForm(sp.slice(5), { seed }) : treeForm(sp, { seed }), B = barkMaterial(T.bark), lf = bush ? T.leaf : sp;
  const geo = (S) => ({ p: S.tris.flatMap((t) => t.p.flat().map((v) => Math.round(v * 1e4) / 1e4)), c: S.tris.flatMap((t) => { const c = lin(t.c); return [...c, ...c, ...c]; }), tris: S.tris.length });
  const sprays = Array.from({ length: SPRAYS }, (_, k) => geo(leafSpray(lf, { seed: seed * 31 + k })));
  const clumps = Array.from({ length: CLUMPS }, (_, k) => geo(leafClump(lf, { seed: seed * 17 + k })));
  // (a bush's seasons: its blossoms, facing out, and its berry clusters, one geometry a cluster size)
  const season = !bush ? null : Object.fromEntries(['bloom', 'fruit'].map((a) => {
    const A = bushForm(sp.slice(5), { seed, adorn: a });
    return [a, a === 'bloom' ? { list: A.blooms, geos: [geo({ tris: bushBlossom(A.look) })] }
      : { list: A.berries, geos: Array.from({ length: ADORN.berries[1] - ADORN.berries[0] + 1 }, (_, k) => geo({ tris: bushBerries(A.look, ADORN.berries[0] + k, seed + k) })) }];
  }));
  return { species: sp, height: T.height, ...(T.detail ? { detail: T.detail, draw: T.draw } : {}), ...(season ? { season } : {}), wood: T.wood, sites: T.sites, clumps: T.clumps, sprays, clumpGeo: clumps, pad: !!T.pad,
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
  <div class="group" id="season"><button data-a="green" aria-pressed="true">Green</button><button data-a="bloom">In flower</button><button data-a="fruit">In fruit</button></div>
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
const tl = new THREE.TextureLoader(), POM = { on: { value: 1 } }, FAR = { value: 0 };
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
  // the crown: clumps everywhere (far off, fewer, grown), and its sprays coming in near the eye inside them as they draw
  // in; every leaf's normal bent out of the crown, its tone the crown's own shade
  const C = T.clumps.reduce((a, s) => [a[0] + s.p[0], a[1] + s.p[1], a[2] + s.p[2]], [0, 0, 0]).map((v) => v / T.clumps.length);
  const leaves = [], sprays = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), roll = new THREE.Quaternion();
  const AX = { clump: new THREE.Vector3(0, 0, 1), spray: new THREE.Vector3(1, 0, 0) };
  function crownMesh(G, list, kind) {
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(G.p, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(G.c, 3)); sg.computeVertexNormals();
    const out = new Float32Array(list.length * 3), draw = new Float32Array(list.length);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
    const U = { uGrow: { value: 1 }, uEye: { value: new THREE.Vector3() }, uDetail: { value: new THREE.Vector3((T.detail || LOD.detail)[0], (T.detail || LOD.detail)[1], LOD.draw) }, uSpray: { value: kind === 'spray' ? 1 : 0 }, uFar: FAR };
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = 'attribute vec3 aOut;\\nattribute float aDraw;\\nuniform float uGrow, uSpray, uFar;\\nuniform vec3 uEye, uDetail;\\nvarying float vFade;\\n' + sh.vertexShader
        .replace('#include <begin_vertex>', [
          // (near the eye: each spray comes in whole at its own distance, growing from a third of its size inside its clump;
          // a clump draws in as its sprays come)
          'vec3 ipos = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;',
          'float nearF = ( 1.0 - smoothstep( uDetail.x, uDetail.y, distance( ipos, uEye ) ) ) * ( 1.0 - uFar );',
          'float hI = fract( sin( dot( ipos.xy, vec2( 12.9898, 78.233 ) ) + ipos.z * 4.13 ) * 43758.5453 ) * 0.7, inF = smoothstep( hI, hI + 0.3, nearF );',
          'float k = uSpray > 0.5 ? mix( 0.35, 1.0, inF ) * step( 0.001, inF ) : uGrow * mix( 1.0, aDraw, nearF );',
          'vFade = 1.0;',
          'vec3 transformed = position * k;'].join('\\n'))
        // (a leaf's normal bent toward the crown's outside: the crown takes the sun as one volume)
        .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\\n  transformedNormal = normalize( mix( transformedNormal, normalMatrix * aOut, 0.65 ) );');
      sh.fragmentShader = 'varying float vFade;\\n' + sh.fragmentShader
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\\n  if ( fract( sin( dot( floor( gl_FragCoord.xy ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) > vFade ) discard;')
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\\n  normal *= faceDirection;')
        // (a leaf is thin: some of the sun comes through it, a fill in the crown's shade)
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\\n  reflectedLight.indirectDiffuse += diffuseColor.rgb * 0.22;');
    };
    mat.customProgramCacheKey = () => 'crown';
    const im = new THREE.InstancedMesh(sg, mat, list.length);
    list.forEach((s, i) => {
      if (kind === 'clump' && T.pad) {
        // (a needle pad lies along its branch: its length the branch's run, level, its face to the sky)
        const x = new THREE.Vector3(s.d[0], s.d[1], 0); if (x.lengthSq() < 1e-6) x.set(s.o[0], s.o[1], 0); if (x.lengthSq() < 1e-6) x.set(1, 0, 0); x.normalize();
        const z = new THREE.Vector3(0, 0, 1), y = z.clone().cross(x); q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      } else { const f = new THREE.Vector3(...(kind === 'clump' ? s.o : s.d)); q.setFromUnitVectors(AX[kind], f); roll.setFromAxisAngle(f, s.r * 40); q.premultiply(roll); }
      m4.compose(new THREE.Vector3(...s.p), q, new THREE.Vector3(s.s, s.s, s.s)); im.setMatrixAt(i, m4);
      const tone = 0.62 + 0.38 * s.e; im.setColorAt(i, new THREE.Color(tone, tone, tone));
      out.set(s.o, i * 3);
      // (how far a clump draws in as its sprays come: the plant's own, or the page's; a clump the envelope added, with no
      // sprays of its own to take its place, not at all: the outline holds)
      draw[i] = s.f ? 1 : (T.draw ?? LOD.draw);
    });
    sg.setAttribute('aOut', new THREE.InstancedBufferAttribute(out, 3)); sg.setAttribute('aDraw', new THREE.InstancedBufferAttribute(draw, 1));
    // (the clumps cast the crown's shadow; the sprays, near only, do not)
    im.castShadow = kind === 'clump'; im.receiveShadow = true; g.add(im);
    return { im, n: list.length, U, tris: G.tris, list };
  }
  T.clumpGeo.forEach((G, k) => leaves.push(crownMesh(G, T.clumps.filter((_, i) => i % T.clumpGeo.length === k), 'clump')));
  T.sprays.forEach((G, k) => sprays.push(crownMesh(G, T.sites.filter((_, i) => i % T.sprays.length === k), 'spray')));
  // its seasons (a bush's): blossoms facing out, berry clusters hanging, glossy; shown by the season buttons
  const seasons = {};
  if (T.season) for (const [a, S] of Object.entries(T.season)) {
    const sg = new THREE.Group(); seasons[a] = { group: sg, tris: 0 };
    S.geos.forEach((G, k) => {
      const list = a === 'bloom' ? S.list : S.list.filter((b) => b.n - ${ADORN.berries[0]} === k); if (!list.length) return;
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(G.p, 3)); bg.setAttribute('color', new THREE.Float32BufferAttribute(G.c, 3)); bg.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: a === 'fruit' ? 0.3 : 0.7, metalness: 0, side: THREE.DoubleSide });
      const im = new THREE.InstancedMesh(bg, mat, list.length);
      list.forEach((b, i) => { if (a === 'bloom') q.setFromUnitVectors(AX.clump, new THREE.Vector3(...b.o)); else q.identity(); m4.compose(new THREE.Vector3(...b.p), q, new THREE.Vector3(b.s, b.s, b.s)); im.setMatrixAt(i, m4); });
      im.castShadow = false; im.receiveShadow = true; sg.add(im); seasons[a].tris += list.length * G.tris;
    });
    sg.visible = false; g.add(sg);
  }
  return { group: g, leaves, sprays, seasons, woodTris: T.wood.idx.length / 3, T, centre: C };
}

const built = {};
function show(sp) {
  if (current) scene.remove(current.group);
  current = built[sp] || (built[sp] = build(TREES.find((t) => t.species === sp))); scene.add(current.group);
  const H = Math.max(2, current.T.height); sun.shadow.camera.left = sun.shadow.camera.bottom = -H; sun.shadow.camera.right = sun.shadow.camera.top = H; sun.shadow.camera.far = H * 6; sun.shadow.camera.updateProjectionMatrix();
  for (const b of document.querySelectorAll('#sp button')) b.setAttribute('aria-pressed', String(b.dataset.s === sp));
  aimSun(); view(lastView); setSeason(season);
}
let lastView = 'near', season = 'green';
function setSeason(a) {
  season = a; for (const b of document.querySelectorAll('#season button')) b.setAttribute('aria-pressed', String(b.dataset.a === a));
  for (const t of Object.values(built)) for (const [k, S] of Object.entries(t.seasons)) S.group.visible = k === a;
}
for (const b of document.querySelectorAll('#season button')) b.onclick = () => setSeason(b.dataset.a);
function view(c) {
  lastView = c; const H = current.T.height, C = current.centre;
  // (a bush: near at a walker's arm, mid a few steps off, far across a glade; its stems' bark at its foot)
  if (c === 'close') { const R = Math.max(2, H * 0.3); camera.position.set(C[0] + R + 5, C[1] - 4, C[2] * 0.8); controls.target.set(...C); controls.update(); return; }
  const B = H < 4, at = B ? { near: [H * 1.3, -H * 0.9, 1.5], mid: [H * 3.2, -H * 2.2, 1.6], far: [24, -16, 2.5], bark: [0.5, -0.4, 0.35] }[c] : { near: [H * 0.9, -H * 0.55, 1.7], mid: [H * 2.2, -H * 1.3, H * 0.4], far: [70, -45, 6], bark: [1.1, -0.9, 1.4] }[c];
  const look = c === 'bark' ? [0, 0, B ? 0.15 : 1.3] : c === 'near' ? [C[0], C[1], H * 0.45] : [C[0], C[1], H * 0.5];
  camera.position.set(...at); controls.target.set(...look); controls.update();
  for (const b of document.querySelectorAll('#cam button')) b.setAttribute('aria-pressed', String(b.dataset.c === c));
}
function aimSun() {
  const a = (+document.getElementById('sun').value * Math.PI) / 180, H = current ? current.T.height : 10;
  const D = Math.max(H, 4); sun.position.set(Math.cos(a) * D * 2.5, Math.sin(a) * D * 2.5, D * 2.2); sun.target.position.set(0, 0, H * 0.4);
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
  let tris = 0; for (const L of current.leaves) { L.im.count = Math.max(1, Math.round(L.n * keep)); L.U.uGrow.value = Math.min(LOD.grow, 1 / Math.sqrt(keep)); L.U.uEye.value.copy(camera.position); tris += L.im.count * L.tris; }
  // (the sprays drawn: those near enough to have come in)
  let near = 0; for (const S of current.sprays) { S.U.uEye.value.copy(camera.position); for (const s of S.list) if (camera.position.distanceTo(new THREE.Vector3(...s.p)) < (current.T.detail || LOD.detail)[1]) { near++; tris += S.tris; } }
  const S = current.seasons[season]; if (S) tris += S.tris;
  return { keep, leafTris: tris, sprays: near, season };
}
// THE SILHOUETTE GATE: the plant from this camera twice, clumps alone (as from afar: no sprays, no draw-in) and as drawn
// (the sprays in, the clumps drawn in), each its outline against white with no light; their overlap over their union
// (1: the switch keeps the outline) and how much of the far outline the near one keeps
window.silhouette = () => {
  const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, keepBg = scene.background, keepFog = scene.fog, keepTone = renderer.toneMapping;
  const lights = []; scene.traverse((o) => { if (o.isLight) { lights.push([o, o.intensity]); o.intensity = 0; } });
  scene.background = new THREE.Color(1, 1, 1); scene.fog = null; ground.visible = false; renderer.toneMapping = THREE.NoToneMapping;
  const mask = (far) => { FAR.value = far; lod(); renderer.render(scene, camera); const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); const m = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) m[i] = px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2] < 600 ? 1 : 0; return m; };
  // (the outline, not the leaves' gaps: each mask closed, grown and shrunk again by a sliver of the view)
  const r = Math.max(2, Math.round(w / 120)), grow = (m, on) => { const o = new Uint8Array(m.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = on ? 0 : 1; for (let dy = -r; dy <= r && (on ? !v : v); dy += r) for (let dx = -r; dx <= r; dx += r) { const yy = y + dy, xx = x + dx; const q = yy < 0 || yy >= h || xx < 0 || xx >= w ? 0 : m[yy * w + xx]; if (on && q) { v = 1; break; } if (!on && !q) { v = 0; break; } } o[y * w + x] = v; } return o; };
  const close = (m) => grow(grow(m, true), false);
  const score = (F, N) => { let both = 0, any = 0, f = 0, n = 0; for (let i = 0; i < F.length; i++) { both += F[i] & N[i]; any += F[i] | N[i]; f += F[i]; n += N[i]; } return { both, any, f, n }; };
  const F0 = mask(1), N0 = mask(0), { both, any, f, n } = score(F0, N0), S = score(close(F0), close(N0));
  FAR.value = 0; scene.background = keepBg; scene.fog = keepFog; ground.visible = true; renderer.toneMapping = keepTone; for (const [o, v] of lights) o.intensity = v;
  const k3 = (v) => Math.round(v * 1000) / 1000;
  return { outline: k3(S.both / Math.max(1, S.any)), outlineArea: k3(S.n / Math.max(1, S.f)), iou: k3(both / Math.max(1, any)), kept: k3(both / Math.max(1, f)), area: k3(n / Math.max(1, f)) };
};
let stat = {};
window.view = view;
window.measure = () => ({ species: current.T.species, height: current.T.height, clumps: current.T.clumps.length, sites: current.T.sites.length, woodTris: current.woodTris, ...stat });
renderer.setAnimationLoop(() => {
  stat = lod(); controls.update(); renderer.render(scene, camera);
  document.getElementById('stats').textContent = current.T.species + ' · ' + current.T.height.toFixed(1) + ' m · wood ' + current.woodTris + ' tris · leaves ' + stat.leafTris + ' tris (' + Math.round(stat.keep * 100) + '% of clumps, ' + stat.sprays + ' sprays near)';
});
show(TREES[0].species);
window.__treeReady = true;
</script></body></html>`;
fs.writeFileSync(out, html);
console.log(out, (html.length / 1e6).toFixed(1), 'MB', trees.map((t) => `${t.species}: ${t.height.toFixed(1)} m, wood ${t.wood.idx.length / 3} tris, ${t.sites.length} sites`).join('; '));
