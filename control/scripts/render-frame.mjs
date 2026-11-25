/**
 * Visual review of the assault frame's body (lib/graph/assault-frame/body.js): each stock frame drawn as a contact
 * sheet, a turntable at rest (front, three-quarter, side, back) over a row of its clips posed (idle, boost, hover, a
 * walk's stride), and a detail sheet (the upper body from the front quarter, the legs and the booster from behind).
 * Drawn on a small standalone page in headless Chromium with the vendored three.js (public/vendor/three): physical
 * materials by slot (body.js FRAME_SLOTS, figure.js frameMaterials), a sun and a sky over the ground, a studio's
 * environment the chrome reflects. No database writes.
 *
 * From control/:
 *   node scripts/render-frame.mjs [--out <dir>] [--frames vanguard,raptor,citadel] [--palette federation|mars|ash]
 *                                 [--wear factory|used|battered] [--build '<json build>']
 * Writes <frame>-sheet.png and <frame>-detail.png.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
const { frameBody, FRAME_PALETTES } = await import('../lib/graph/assault-frame/body.js');
const { frameClips } = await import('../lib/graph/assault-frame/clips.js');
const { STOCK } = await import('../lib/graph/assault-frame/parts.js');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('out', path.join(os.tmpdir(), 'frame-renders')));
const palette = arg('palette', 'federation'), wear = arg('wear', 'used');
const custom = arg('build', null);
const frames = custom ? [['custom', JSON.parse(custom)]] : arg('frames', Object.keys(STOCK).join(',')).split(',').map((n) => [n, n]);
mkdirSync(OUT, { recursive: true });

// (the slots' response, as figure.js gives the page; kept here so this script needs no loader for the page's imports)
const MATERIALS = {
  paint: { metalness: 0.22, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.25 },
  chrome: { metalness: 1, roughness: 0.08 },
  gunmetal: { metalness: 0.7, roughness: 0.36 },
  seal: { metalness: 0, roughness: 0.86 },
  lens: { metalness: 0.25, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 },
  glow: { metalness: 0, roughness: 0.45, emissiveIntensity: 1.6 },
  stencil: { metalness: 0.05, roughness: 0.6 },
};
const lin = (h) => [1, 3, 5].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

/** A body's bones as the page draws them: per bone and slot, its triangles (positions, normals, linear colours). */
function meshesOf(body) {
  return body.bones.map(({ id, head }) => {
    const mats = {};
    for (const fc of body.faces.get(id)) {
      const M = (mats[fc.material] ??= { pos: [], nrm: [], col: [] }), c = lin(fc.albedo);
      const ns = fc.cornerNormals ?? fc.corners.map(() => fc.outNormal);
      for (let j = 1; j + 1 < fc.corners.length; j++) for (const k of [0, j, j + 1]) { M.pos.push(...fc.corners[k]); M.nrm.push(...ns[k]); M.col.push(...c); }
    }
    return { id, rest: head, mats };
  });
}
const keyOf = (body, clip, k) => { const n = body.bones.length; return Object.fromEntries(body.bones.map((b, i) => [b.id, clip.b.slice((k * n + i) * 7, (k * n + i) * 7 + 7)])); };

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#1d2126;font:600 14px system-ui,sans-serif;color:#dfe5ea}
#wrap{position:relative;display:inline-block}#lab{position:absolute;inset:0;pointer-events:none}
.l{position:absolute;padding:4px 8px;background:rgba(0,0,0,.45);border-radius:3px}
</style><script type="importmap">{"imports":{"three":"/three/three.module.min.js"}}</script></head>
<body><div id="wrap"><canvas id="c"></canvas><div id="lab"></div></div>
<script type="module">
import * as THREE from 'three';
window.draw = async (D) => {
  const W = D.W, H = D.H, cv = document.getElementById('c');
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(W, H); r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.92;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.setScissorTest(true);
  // the studio the chrome reflects: a sky over a dark floor, softboxes overhead and to the sides
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide,
    vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec3 d; void main(){ float e = d.z; vec3 sky = mix(vec3(.55,.62,.72), vec3(.22,.34,.55), clamp(e,0.,1.)); vec3 gr = mix(vec3(.3,.29,.27), vec3(.07,.07,.08), clamp(-e*3.,0.,1.)); gl_FragColor = vec4(e > 0. ? sky : gr, 1.); }' })));
  const box = (p, s, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s[0], s[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(0, 0, 0); env.add(m); };
  box([0, 0, 40], [30, 10], 3.2); box([30, 20, 10], [8, 20], 2.2); box([-30, 10, 8], [6, 16], 1.6); box([0, -35, 15], [20, 6], 1.4);
  const pm = new THREE.PMREMGenerator(r), envTex = pm.fromScene(env, 0.02).texture;
  const scene = new THREE.Scene(); scene.environment = envTex;
  scene.add(new THREE.HemisphereLight(0x9fb4cc, 0x3a3631, 0.45));
  const sun = new THREE.DirectionalLight(0xfff3e4, 2.6); sun.position.set(-9, 14, 22); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 60 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshStandardMaterial({ color: 0x55595d, roughness: 0.92 }));
  ground.receiveShadow = true; scene.add(ground);
  const grid = new THREE.GridHelper(28, 28, 0x6c7176, 0x63686d); grid.rotation.x = Math.PI / 2; grid.position.z = 0.003; scene.add(grid);
  const mats = Object.fromEntries(Object.entries(D.materials).map(([k, v]) => [k, new THREE.MeshPhysicalMaterial({ ...v, vertexColors: true, side: THREE.DoubleSide, ...(k === 'glow' ? { emissive: new THREE.Color(D.glow) } : {}), envMapIntensity: k === 'chrome' ? 1.4 : 1 })]));
  const bones = D.bones.map((b) => {
    const g = new THREE.Group(); g.matrixAutoUpdate = false; scene.add(g);
    for (const [slot, m] of Object.entries(b.mats)) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(m.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(m.nrm, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(m.col, 3));
      const mesh = new THREE.Mesh(geo, mats[slot]); mesh.castShadow = slot !== 'glow'; mesh.receiveShadow = true; g.add(mesh);
    }
    return { ...b, g };
  });
  const plumes = new THREE.Group(); scene.add(plumes);
  const lab = document.getElementById('lab'); lab.innerHTML = '';
  for (const cell of D.cells) {
    for (const b of bones) {
      const k = cell.pose && cell.pose[b.id];
      const m = new THREE.Matrix4();
      if (k) {
        const q = new THREE.Quaternion(k[0], k[1], k[2], k[3]);
        m.compose(new THREE.Vector3(k[4], k[5], k[6]), q, new THREE.Vector3(1, 1, 1)).multiply(new THREE.Matrix4().makeTranslation(-b.rest[0], -b.rest[1], -b.rest[2]));
      }
      b.g.matrix.copy(m); b.g.matrixWorldNeedsUpdate = true;
    }
    plumes.clear();
    for (const p of cell.plumes || []) {
      const L = p.len, cone = new THREE.Mesh(new THREE.ConeGeometry(p.r, L, 14, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(D.exhaust), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      cone.geometry.translate(0, -L / 2, 0); cone.geometry.rotateX(Math.PI);
      cone.position.set(...p.at); cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0).negate(), new THREE.Vector3(...p.dir)); plumes.add(cone);
    }
    const [x, y, w, h] = cell.rect, cam = new THREE.PerspectiveCamera(cell.fov || 28, w / h, 0.1, 200);
    const t = cell.target, az = cell.az * Math.PI / 180, el = cell.el * Math.PI / 180;
    cam.up.set(0, 0, 1); cam.position.set(t[0] + cell.dist * Math.cos(el) * Math.sin(az), t[1] + cell.dist * Math.cos(el) * Math.cos(az), t[2] + cell.dist * Math.sin(el)); cam.lookAt(...t);
    r.setViewport(x, H - y - h, w, h); r.setScissor(x, H - y - h, w, h);
    r.setClearColor(new THREE.Color(cell.bg || '#2a3036')); r.clear();
    r.render(scene, cam);
    const d = document.createElement('div'); d.className = 'l'; d.style.left = (x + 8) + 'px'; d.style.top = (y + 8) + 'px'; d.textContent = cell.title; lab.appendChild(d);
  }
  return true;
};
window.ready = true;
</script></body></html>`;

// a server for the page and the vendored three.js
const vendor = path.join(control, 'public/vendor/three');
const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url.startsWith('/?')) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  if (req.url.startsWith('/three/')) {
    try { const b = readFileSync(path.join(vendor, req.url.slice(7).split('?')[0])); res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(b); } catch { /* fall through */ }
  }
  res.writeHead(404); res.end();
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const port = server.address().port;
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const plumesOf = (body, pose, kinds) => body.thrusters.filter((t) => kinds.includes(t.kind)).map((t) => {
  // (each plume where its bone's key puts its mouth)
  const b = body.bones.find((x) => x.id === t.bone), k = pose?.[t.bone];
  const r = Math.max(...t.half), len = r * (t.kind === 'main' ? 7 : 4.5);
  if (!k) return { at: t.at, dir: t.dir, r, len };
  const q = k.slice(0, 4), rot = (v) => { const u = q.slice(0, 3), w = q[3], c1 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]].map((x) => x * 2); const c2 = [u[1] * c1[2] - u[2] * c1[1], u[2] * c1[0] - u[0] * c1[2], u[0] * c1[1] - u[1] * c1[0]]; return v.map((x, i) => x + w * c1[i] + c2[i]); };
  const at = rot(t.at.map((v, i) => v - b.head[i])).map((v, i) => v + k[4 + i]);
  return { at, dir: rot(t.dir), r, len };
});

for (const [name, build] of frames) {
  const body = frameBody(build, { palette, wear }), clips = frameClips(body), C = FRAME_PALETTES[body.palette];
  const nf = [...body.faces.values()].reduce((a, fs) => a + fs.length, 0);
  const Hh = body.height, mid = [0, 0, Hh * 0.5], dist = Hh * 2.75;
  const page = await browser.newPage({ viewport: { width: 1640, height: 1160 } });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => window.ready === true);
  const base = { bones: meshesOf(body), materials: MATERIALS, glow: C.glow, exhaust: C.exhaust };
  const W = 400, Hc = 560;
  const turn = [['front', 0], ['three-quarter', 38], ['side', 90], ['back', 180]].map(([t, az], i) => ({ title: `${name} · ${t}`, rect: [i * W, 0, W, Hc], az, el: 8, dist, target: mid }));
  const posed = [['idle', 'idle', 0, 32], ['boost', 'boost', 1, 60], ['hover', 'hover', 0, 70], ['forward (stride)', 'forward', 2, 50]].map(([t, c, k, az], i) => {
    const pose = keyOf(body, clips[c], k);
    return { title: `${t}`, rect: [i * W, Hc, W, Hc], az, el: 10, dist, target: [0, 0, Hh * 0.5 + (c === 'hover' ? 0.3 : 0)], pose, plumes: c === 'boost' || c === 'hover' ? plumesOf(body, pose, c === 'boost' ? ['main'] : ['main', 'vernier']) : [] };
  });
  await page.evaluate((D) => window.draw(D), { ...base, W: 4 * W, H: 2 * Hc, cells: [...turn, ...posed] });
  await (await page.$('#wrap')).screenshot({ path: path.join(OUT, `${name}-sheet.png`) });
  const DW = 800, DH = 820;
  const detail = [
    { title: `${name} · upper body (${nf} faces)`, rect: [0, 0, DW, DH], az: 30, el: 6, dist: Hh * 1.05, target: [0, 0.3, body.hips + 1.9], fov: 30 },
    { title: 'legs and booster, from behind', rect: [DW, 0, DW, DH], az: 215, el: 14, dist: Hh * 1.25, target: [0, -0.2, body.hips * 0.62], fov: 30 },
  ];
  await page.setViewportSize({ width: 2 * DW + 20, height: DH + 20 });
  await page.evaluate((D) => window.draw(D), { ...base, W: 2 * DW, H: DH, cells: detail });
  await (await page.$('#wrap')).screenshot({ path: path.join(OUT, `${name}-detail.png`) });
  await page.close();
  console.log(`${name}: ${nf} faces, ${body.height} m tall, hips ${body.hips} m → ${path.join(OUT, `${name}-sheet.png`)}`);
}
await browser.close();
server.close();
