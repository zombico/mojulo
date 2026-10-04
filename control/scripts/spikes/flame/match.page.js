// SPIKE flame: the lit match, the page. windField, matchKernel and breathAt are inlined above this by match.mjs.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const D = JSON.parse(document.getElementById('match-data').textContent);
const DEG = Math.PI / 180, M = D.match;
let a32 = D.seed | 0;
const rnd = () => { a32 |= 0; a32 = (a32 + 0x6d2b79f5) | 0; let t = Math.imul(a32 ^ (a32 >>> 15), 1 | a32); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// a point light's falloff is 1/d², capped by three at 10 cm; the flame is a source a centimetre across, so near it the
// light falls off as an extended source does: 1/(d² + r²), r ≈ 3.5 cm (the stick sits inside the flame's glow).
// Balanced on a match's numbers: about a candela, the stick a centimetre off, the table twelve: the stick lit nearly
// as bright as the flame's own orange edge, the table a hundred times dimmer, the eye opened wide to see it. Only the flame is a point light.
{
  const src = THREE.ShaderChunk.lights_pars_begin, re = /float distanceFalloff = 1\.0 \/ max\( pow\( lightDistance, decayExponent \), 0\.01 \);/;
  if (re.test(src)) THREE.ShaderChunk.lights_pars_begin = src.replace(re, 'float distanceFalloff = 1.0 / ( lightDistance * lightDistance + 0.0012 );');
  else console.warn('flame: falloff patch did not apply');
}

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);
const NIGHT = new THREE.Color().setRGB(0.0016, 0.0012, 0.0010);
const scene = new THREE.Scene(); scene.background = NIGHT; scene.fog = new THREE.FogExp2(NIGHT, 1.3);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.004, 30); camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 0.03; controls.maxDistance = 2;
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ── light: the flame, the moon through a window, a little bounce ─────────────────────────────────────────────────────
const FLAME_COL = new THREE.Color(1.0, 0.56, 0.24);
const flameLight = new THREE.PointLight(FLAME_COL, 0, 0, 2); flameLight.castShadow = true;
flameLight.shadow.mapSize.set(1024, 1024); flameLight.shadow.camera.near = 0.004; flameLight.shadow.camera.far = 1.5; flameLight.shadow.bias = -0.002; flameLight.shadow.normalBias = 0.0004; flameLight.shadow.radius = 3;
scene.add(flameLight);
const MOON = new THREE.Vector3(...D.moon).normalize();
const moon = new THREE.DirectionalLight(new THREE.Color(0.55, 0.66, 1.0), 0.22); moon.position.copy(MOON).multiplyScalar(2); moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048); Object.assign(moon.shadow.camera, { left: -0.3, right: 0.3, top: 0.3, bottom: -0.3, near: 0.5, far: 4 }); moon.shadow.bias = -0.0003; moon.shadow.normalBias = 0.0005; moon.shadow.radius = 2;
scene.add(moon, moon.target);
scene.add(new THREE.HemisphereLight(new THREE.Color(0.10, 0.11, 0.15), new THREE.Color(0.06, 0.035, 0.02), 0.06));

// ── canvas textures, drawn from the seed ───────────────────────────────────────────────────────────────────────────
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// walnut: long wavy grain, darker figure, pores
const walnut = canvasTex(2048, 512, (g, W, H) => {
  const img = g.createImageData(W, H), row = new Float32Array(H); for (let y = 0; y < H; y++) row[y] = rnd();
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const warp = 14 * Math.sin(x * 0.0021 + ph[0]) + 6 * Math.sin(x * 0.0093 + y * 0.013 + ph[1]) + 2.5 * Math.sin(x * 0.031 + ph[2]);
    const ring = 0.5 + 0.5 * Math.sin((y + warp) * 0.19), fig = Math.pow(ring, 3), pore = row[Math.min(H - 1, Math.max(0, Math.round(y + warp * 0.2)))];
    const k = 0.62 + 0.38 * fig + 0.12 * (pore - 0.5), i = 4 * (y * W + x);
    img.data[i] = 104 * k; img.data[i + 1] = 68 * k; img.data[i + 2] = 44 * k; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
});
walnut.repeat.set(1.2, 1.6);
// the box's label: a red field, a cream border and a drawn flame (no maker's name)
const label = canvasTex(512, 352, (g, W, H) => {
  g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, W, H); g.fillStyle = '#8e2216'; g.fillRect(18, 18, W - 36, H - 36);
  g.strokeStyle = '#1b0f0b'; g.lineWidth = 3; g.strokeRect(30, 30, W - 60, H - 60);
  g.fillStyle = '#e9dcc0'; for (let i = 0; i < 9; i++) { g.fillRect(48 + i * 46, H - 70, 26, 14); }
  const fl = (s, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(W / 2, H / 2 - 100 * s); g.bezierCurveTo(W / 2 + 70 * s, H / 2 - 20 * s, W / 2 + 60 * s, H / 2 + 60 * s, W / 2, H / 2 + 70 * s); g.bezierCurveTo(W / 2 - 60 * s, H / 2 + 60 * s, W / 2 - 70 * s, H / 2 - 20 * s, W / 2, H / 2 - 100 * s); g.fill(); };
  fl(1, '#f0a23a'); fl(0.62, '#f7d36a'); fl(0.3, '#fff3cf');
});
const striker = canvasTex(256, 64, (g, W, H) => {
  g.fillStyle = '#3a2620'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { const v = 30 + 50 * rnd(); g.fillStyle = `rgb(${v + 12},${v * 0.7},${v * 0.55})`; g.fillRect(rnd() * W, rnd() * H, 1, 1); }
  g.strokeStyle = 'rgba(15,8,6,.6)'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const y = H * (0.2 + 0.6 * rnd()); g.beginPath(); g.moveTo(W * rnd() * 0.3, y); g.lineTo(W * (0.6 + 0.4 * rnd()), y + 4 * (rnd() - 0.5)); g.stroke(); }
});

// ── the table ──────────────────────────────────────────────────────────────────────────────────────────────────────
const table = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshPhysicalMaterial({ map: walnut, roughness: 0.5, clearcoat: 0.55, clearcoatRoughness: 0.22 }));
table.receiveShadow = true; scene.add(table);

// ── the match: a square aspen splint with eased corners, a lathed head, built along local x = s ────────────────────────
function matchGeometry() {
  const pos = [], nrm = [], part = [], idx = [];
  const half = M.side / 2, rc = 0.00028, ring = [];
  for (let c = 0; c < 4; c++) {
    const a0 = (c * Math.PI) / 2, cx = (c === 0 || c === 3 ? 1 : -1) * (half - rc), cy = (c < 2 ? 1 : -1) * (half - rc);
    for (let j = 0; j < 4; j++) { const q = a0 + (j / 3) * (Math.PI / 2); ring.push([cx + rc * Math.cos(q), cy + rc * Math.sin(q), Math.cos(q), Math.sin(q)]); }
  }
  const R = ring.length, s0 = 0.0018, ds = 0.0003, ns = Math.round((M.length - s0) / ds);
  for (let i = 0; i <= ns; i++) { const s = s0 + i * ds; for (const [y, z, ny, nz] of ring) { pos.push(s, y, z); nrm.push(0, ny, nz); part.push(0); } }
  for (let i = 0; i < ns; i++) for (let j = 0; j < R; j++) { const a = i * R + j, b = i * R + ((j + 1) % R), c = a + R, d = b + R; idx.push(a, c, b, b, c, d); }
  // the cut end
  const cap = pos.length / 3; pos.push(M.length, 0, 0); nrm.push(1, 0, 0); part.push(0);
  for (const [y, z] of ring) { pos.push(M.length, y, z); nrm.push(1, 0, 0); part.push(0); }
  for (let j = 0; j < R; j++) idx.push(cap, cap + 1 + j, cap + 1 + ((j + 1) % R));
  // the head: a rounded bulb a little flattened, thinning where the dip ran down the splint
  const HS = 44, HQ = 32, hEnd = 0.0062, base = pos.length / 3;
  const rOf = (s) => (s < 0.0024 ? 0.00205 * Math.sqrt(Math.max(0, 1 - ((s - 0.0024) / 0.0024) ** 2)) : 0.00205 - 0.0005 * ((t) => t * t * (3 - 2 * t))(Math.min(1, (s - 0.0024) / (hEnd - 0.0024))));
  for (let i = 0; i <= HS; i++) {
    const s = (hEnd * i) / HS, r = rOf(s), dr = (rOf(Math.min(hEnd, s + 1e-5)) - rOf(Math.max(0, s - 1e-5))) / (Math.min(hEnd, s + 1e-5) - Math.max(0, s - 1e-5));
    for (let j = 0; j < HQ; j++) {
      const q = (2 * Math.PI * j) / HQ, y = 0.94 * r * Math.cos(q), z = r * Math.sin(q);
      const n = i === 0 ? [-1, 0, 0] : [-dr, Math.cos(q) / 0.94, Math.sin(q)], l = Math.hypot(...n);
      pos.push(s, y, z); nrm.push(n[0] / l, n[1] / l, n[2] / l); part.push(1);
    }
  }
  for (let i = 0; i < HS; i++) for (let j = 0; j < HQ; j++) { const a = base + i * HQ + j, b = base + i * HQ + ((j + 1) % HQ), c = a + HQ, d = b + HQ; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setIndex(idx); g.computeBoundingSphere(); g.boundingSphere.radius += 0.03;
  return g;
}

// the burn on the stick, in its vertex shader: behind the front the char shrinks (wood loses most of its mass) and
// curls (it shrinks most on the side the flame heats, so it bows up toward the flame), the head swells a little
const MATCH_VERT = /* glsl */ `
uniform float uFront, uCurl; attribute float aPart; varying float vS, vPart; varying vec2 vXs;
float curlAngle(float d) { return d < 0.008 ? uCurl * d * d / 0.016 : uCurl * (d - 0.004); }
void matchBend(inout vec3 p, inout vec3 n) {
  vS = p.x; vPart = aPart; vXs = p.yz;
  float d = uFront - p.x; if (d <= 0.0) return;
  float sh = aPart > 0.5 ? mix(1.0, 1.06, smoothstep(0.0, 0.002, d)) : mix(1.0, 0.74, smoothstep(0.0, 0.0012, d)) * mix(1.0, 0.9, smoothstep(0.004, 0.02, d));
  vec2 o = p.yz * sh; float a = curlAngle(d), cx = 0.0, cz = 0.0;
  for (int i = 0; i < 6; i++) { float au = curlAngle((float(i) + 0.5) / 6.0 * d); cx += cos(au); cz += sin(au); }
  cx *= d / 6.0; cz *= d / 6.0; float ca = cos(a), sa = sin(a);
  p = vec3(uFront - cx + o.y * sa, o.x, cz + o.y * ca);
  n = vec3(n.x * ca + n.z * sa, n.y, -n.x * sa + n.z * ca);
}`;
const MATCH_FRAG = /* glsl */ `
uniform float uFront, uEmber, uTime, uBurnt; varying float vS, vPart; varying vec2 vXs;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float cells(vec2 p) { vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(x, y), o = vec2(h21(i + g), h21(i + g + 17.3)); float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return d2 - d1; }
vec3 mCol; float mRough; vec3 mEmis; float mChar;
void matchSurface() {
  float u = atan(vXs.y, vXs.x) * 0.0012, d = uFront - vS;
  // aspen: pale, a fine straight grain; the waxed zone under the head darker and glossier
  float grain = 0.6 * vn2(vec2(u * 5200.0, vS * 90.0)) + 0.4 * vn2(vec2(u * 16000.0, vS * 420.0));
  vec3 wood = vec3(0.60, 0.42, 0.22) * (0.84 + 0.24 * grain);
  float wax = (1.0 - smoothstep(0.011, 0.016, vS)) * (1.0 - vPart);
  wood = mix(wood, wood * vec3(0.9, 0.8, 0.62), 0.55 * wax);
  vec3 head = vec3(0.30, 0.025, 0.018) * (0.75 + 0.5 * vn2(vec2(u * 9000.0, vS * 9000.0)));
  vec3 c = mix(wood, head, vPart); float rough = mix(mix(0.8, 0.5, wax), 0.55, vPart);
  // ahead of the front the wood browns as it pyrolyses
  float ahead = vS - uFront, scorch = (1.0 - smoothstep(0.0, 0.0035, ahead)) * step(1e-5, uFront);
  c = mix(c, mix(vec3(0.05, 0.028, 0.016), vec3(0.32, 0.16, 0.06), smoothstep(0.0, 0.0028, ahead)), scorch * (1.0 - vPart * 0.6));
  // behind it, char: black, a faint sheen, crazed into cells that glow near the front; old char greys with ash
  float cr = cells(vec2(vS * 2300.0, u * 2300.0)), crack = 1.0 - smoothstep(0.03, 0.11, cr);
  vec3 ch = vec3(0.012, 0.011, 0.010) * (0.75 + 0.5 * vn2(vec2(vS * 3000.0, u * 3000.0)));
  float ash = smoothstep(0.006, 0.03, d) * smoothstep(0.6, 0.85, vn2(vec2(vS * 1400.0, u * 1800.0)));   // flecks, not a coat
  ch = mix(ch, vec3(0.08, 0.077, 0.075), 0.35 * ash + 0.25 * vPart * smoothstep(0.6, 0.9, vn2(vec2(vS * 6000.0, u * 6000.0))));
  float isChar = smoothstep(-0.0002, 0.0004, d);
  mCol = mix(c, ch, isChar); mChar = isChar; mRough = mix(rough, mix(0.7, 0.9, ash), isChar);   // char keeps only a faint sheen
  // the ember: a band just behind the front, its cracks glowing further back; it flickers with the air
  float band = exp(-pow((d - 0.0006) / 0.0011, 2.0)), cg = crack * exp(-max(d, 0.0) / 0.0016) * isChar;
  float flick = 0.7 + 0.3 * vn2(vec2(vS * 900.0 + u * 2000.0, uTime * 7.0));
  mEmis = vec3(1.0, 0.2, 0.025) * uEmber * (1.4 * band + 2.2 * cg) * flick;
}`;
function matchMaterial(U) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + MATCH_VERT)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(normal); vec3 mPos = vec3(position); matchBend(mPos, objectNormal);')
      .replace('#include <begin_vertex>', 'vec3 transformed = mPos;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + MATCH_FRAG)
      .replace('#include <color_fragment>', '#include <color_fragment>\nmatchSurface(); diffuseColor.rgb = mCol;')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mRough;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += mEmis;')
      // char is porous: it scatters little at grazing angles, so it does not mirror the flame as a smooth surface would
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\nmaterial.specularColor *= mix(1.0, 0.25, mChar); material.specularColorBlended *= mix(1.0, 0.25, mChar); material.specularF90 = mix(1.0, 0.15, mChar);');
  };
  const dist = new THREE.MeshDistanceMaterial();
  dist.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + MATCH_VERT).replace('#include <begin_vertex>', 'vec3 transformed = vec3(position); vec3 _n = vec3(0.0, 0.0, 1.0); matchBend(transformed, _n);');
  };
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = dist.onBeforeCompile;
  return { mat, dist, depth };
}
const MG = matchGeometry();
const mU = { uFront: { value: 0 }, uCurl: { value: 22 + 14 * rnd() }, uEmber: { value: 0 }, uTime: { value: 0 }, uBurnt: { value: 0 } };
const mm = matchMaterial(mU), match = new THREE.Mesh(MG, mm.mat);
match.customDistanceMaterial = mm.dist; match.customDepthMaterial = mm.depth; match.castShadow = true; match.receiveShadow = true;
scene.add(match);

// the clip and its stand: a small steel alligator clip on a ball joint, a rod down to a heavy base
const steel = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.55, 0.57), metalness: 1, roughness: 0.32 });
const brass = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.75, 0.55, 0.28), metalness: 1, roughness: 0.38 });
const clip = new THREE.Group(); match.add(clip);
for (const sgn of [1, -1]) {
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.0042, 0.0011), steel); jaw.position.set(0.042, 0, sgn * (M.side / 2 + 0.00055)); jaw.rotation.y = sgn * 0.05; clip.add(jaw);
  const lever = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.0042, 0.0011), steel); lever.position.set(0.055, 0, sgn * 0.0028); lever.rotation.y = -sgn * 0.32; clip.add(lever);
}
const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.0048, 16), steel); spring.position.set(0.049, 0, 0); clip.add(spring);
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 24, 16), brass); scene.add(ball);
const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 1, 12), steel); scene.add(arm);
const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 1, 16), brass); rod.rotation.x = Math.PI / 2; scene.add(rod);
const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.008, 48), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.03, 0.03, 0.032), metalness: 0.4, roughness: 0.45 })); foot.rotation.x = Math.PI / 2; scene.add(foot);
for (const o of [...clip.children, ball, arm, rod, foot]) { o.castShadow = true; o.receiveShadow = true; }

// the box of matches, its drawer half out; and a spent match on the table
const box = new THREE.Group(); scene.add(box); box.position.set(-0.075, 0.07, 0); box.rotation.z = 0.35;
{
  const BX = 0.053, BY = 0.036, BZ = 0.016, th = 0.0006;
  const top = new THREE.MeshStandardMaterial({ map: label, roughness: 0.75 }), side = new THREE.MeshStandardMaterial({ map: striker, roughness: 0.95 }), card = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.42, 0.26), roughness: 0.85 });
  const plate = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; box.add(m); return m; };
  plate(BX, BY, th, top, 0, 0, BZ - th / 2); plate(BX, BY, th, card, 0, 0, th / 2);
  plate(BX, th, BZ, side, 0, BY / 2 - th / 2, BZ / 2); plate(BX, th, BZ, side, 0, -BY / 2 + th / 2, BZ / 2);
  const ox = 0.024, iy = BY - 2 * th - 0.0004, iz = BZ - 2 * th - 0.0004;
  plate(BX - 0.002, iy, th, card, ox, 0, th + th / 2); plate(th, iy, iz, card, ox + BX / 2 - 0.001, 0, th + iz / 2); plate(th, iy, iz, card, ox - BX / 2 + 0.001, 0, th + iz / 2);
  plate(BX - 0.002, th, iz, card, ox, iy / 2, th + iz / 2); plate(BX - 0.002, th, iz, card, ox, -iy / 2, th + iz / 2);
  const stickG = new THREE.BoxGeometry(0.047, M.side, M.side), headG = new THREE.SphereGeometry(0.0017, 16, 12);
  const woodM = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.6, 0.42, 0.22), roughness: 0.8 }), headM = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.3, 0.025, 0.018), roughness: 0.55 });
  for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) {
    const y = -iy / 2 + 0.0035 + i * 0.0043 + 0.0006 * (rnd() - 0.5), z = th * 2 + M.side / 2 + r * M.side * 0.9, flip = (i + r) % 2 ? 1 : -1;
    const s = new THREE.Mesh(stickG, woodM); s.position.set(ox, y, z); s.rotation.z = 0.02 * (rnd() - 0.5); s.castShadow = s.receiveShadow = true; box.add(s);
    const h = new THREE.Mesh(headG, headM); h.scale.set(1.35, 0.9, 1); h.position.set(ox + flip * 0.0222, y, z + 0.0003); h.castShadow = true; box.add(h);
  }
}
const sU = { uFront: { value: 0.026 }, uCurl: { value: 30 }, uEmber: { value: 0 }, uTime: { value: 0 }, uBurnt: { value: 1 } };
const sm = matchMaterial(sU), spent = new THREE.Mesh(MG, sm.mat); spent.customDistanceMaterial = sm.dist; spent.customDepthMaterial = sm.depth; spent.castShadow = spent.receiveShadow = true;
spent.position.set(-0.03, 0.115, M.side / 2); spent.rotation.set(Math.PI / 2, 0, -2.6); scene.add(spent);

// ── the air and the burn ───────────────────────────────────────────────────────────────────────────────────────────
const W = { ...D.wind }; let WF = windField(W);
const breaths = [];
const air = (x, y, z, t) => { const u = WF.at(x, y, 2, t); for (const B of breaths) { const b = breathAt(B, x, y, z, t); u[0] += b[0]; u[1] += b[1]; u[2] += b[2]; } return u; };
const K = matchKernel({ seed: D.seed, ...M }, air);

// ── the flame: emission marched through a box around the spine, stopped by the scene's depth ─────────────────────────
const NS = K.N;
const flameU = {
  uSpine: { value: Array.from({ length: NS }, () => new THREE.Vector3()) }, uRad: { value: new Array(NS).fill(0) },
  uBoxMin: { value: new THREE.Vector3() }, uBoxMax: { value: new THREE.Vector3() }, uCamFwd: { value: new THREE.Vector3() },
  tDepth: { value: null }, uRes: { value: new THREE.Vector2() }, uNear: { value: camera.near }, uFar: { value: camera.far }, uTime: { value: 0 },
  uGain: { value: 1 }, uBlue: { value: 0 }, uSoot: { value: 1 }, uFlare: { value: 0 }, uEdge: { value: 0.1 }, uWhite: { value: 0 },
};
const flameMat = new THREE.ShaderMaterial({
  uniforms: flameU, side: THREE.BackSide, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
  vertexShader: 'varying vec3 vWorld; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: /* glsl */ `
#include <packing>
uniform vec3 uSpine[${NS}]; uniform float uRad[${NS}];
uniform vec3 uBoxMin, uBoxMax, uCamFwd; uniform sampler2D tDepth; uniform vec2 uRes; uniform float uNear, uFar, uTime;
uniform float uGain, uBlue, uSoot, uFlare, uEdge, uWhite;
varying vec3 vWorld;
float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
// soot glows as a body near 1300–2000 K: deep orange where it cools at the tip, yellow, nearly white at the hottest
vec3 sootColor(float T) { vec3 a = vec3(1.0, 0.13, 0.015), b = vec3(1.0, 0.40, 0.07), c = vec3(1.0, 0.74, 0.40); return T < 0.5 ? mix(a, b, 2.0 * T) : mix(b, c, 2.0 * T - 1.0); }
void main() {
  vec3 ro = cameraPosition, rd = normalize(vWorld - ro);
  vec3 inv = 1.0 / rd, t0 = (uBoxMin - ro) * inv, t1 = (uBoxMax - ro) * inv, a3 = min(t0, t1), b3 = max(t0, t1);
  float tn = max(max(a3.x, a3.y), max(a3.z, 0.0)), tf = min(min(b3.x, b3.y), b3.z);
  float viewZ = perspectiveDepthToViewZ(texture2D(tDepth, gl_FragCoord.xy / uRes).x, uNear, uFar);
  tf = min(tf, -viewZ / dot(rd, uCamFwd));
  if (tf <= tn) discard;
  const int STEPS = 56; float dt = (tf - tn) / float(STEPS);
  float j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))) + 0.618034 * fract(uTime * 60.0));
  vec3 acc = vec3(0.0);
  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * (tn + (float(i) + j) * dt);
    float best = 1e9, bs = 0.0;
    for (int k = 0; k < ${NS - 1}; k++) {
      vec3 a = uSpine[k], ab = uSpine[k + 1] - a;
      float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-14), 0.0, 1.0); vec3 q = p - a - ab * h; float d2 = dot(q, q);
      if (d2 < best) { best = d2; bs = (float(k) + h) / ${(NS - 1).toFixed(1)}; }
    }
    float fi = bs * ${(NS - 1).toFixed(1)}; int i0 = int(min(floor(fi), ${(NS - 2).toFixed(1)}));
    float R = max(mix(uRad[i0], uRad[i0 + 1], fi - float(i0)), 2e-4), r = sqrt(best) / R;
    if (r > 1.7) continue;
    // the surface wrinkles: eddies a millimetre or two across, rising with the gas
    vec3 np = p * vec3(1150.0, 1150.0, 560.0) - vec3(0.0, 0.0, uTime * 300.0);
    float n = 0.62 * noise3(np) + 0.38 * noise3(np * 2.07 + 7.1);
    float dd = r + uEdge * (n - 0.5) * (0.35 + 1.3 * bs);
    // the yellow: soot glowing in the upper flame, a dark core low in the middle where the fuel has not met the air
    float inside = 1.0 - smoothstep(0.6, 1.0, dd);
    float zone = smoothstep(0.05, 0.32, bs) * (1.0 - smoothstep(0.82, 1.0, bs + 0.14 * (n - 0.5)));
    float core = (1.0 - smoothstep(0.0, 0.62, dd)) * (1.0 - smoothstep(0.12, 0.5, bs));
    float soot = inside * zone * (1.0 - 0.85 * core) * uSoot;
    float T = clamp(1.05 - 0.8 * smoothstep(0.42, 1.0, bs) - 0.35 * dd * dd, 0.0, 1.0);
    vec3 sc = sootColor(T) * (0.25 + 0.75 * T * T);
    sc = mix(sc, vec3(1.0, 0.85, 0.65) * 1.8, uWhite * (1.0 - smoothstep(0.0, 0.9, dd)));
    // the blue: the reaction sheet where air meets fuel, plain at the base, hidden by the soot's glow above
    float sheet = exp(-pow((dd - 0.9) / 0.1, 2.0));
    float blue = sheet * (1.0 - smoothstep(0.04, 0.3 + 0.5 * uBlue, bs)) * (0.4 + uBlue) + 0.12 * sheet * uBlue;
    acc += (soot * sc + blue * vec3(0.08, 0.18, 1.0) * 0.28) * dt;
  }
  gl_FragColor = vec4(acc * uGain, 1.0);
}`,
});
const flameBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), flameMat); flameBox.frustumCulled = false;
const flameScene = new THREE.Scene(); flameScene.add(flameBox);

// sparks: hot streaks, drawn into the flame's layer, hidden behind the scene by its depth
const SPK = 64, spkGeo = new THREE.BufferGeometry();
{
  const idx = []; for (let i = 0; i < SPK; i++) idx.push(4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 2, 4 * i + 1, 4 * i + 3);
  spkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPK * 12), 3)); spkGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SPK * 12), 3)); spkGeo.setAttribute('aV', new THREE.BufferAttribute(new Float32Array(SPK * 4), 1)); spkGeo.setIndex(idx);
}
const spkMat = new THREE.ShaderMaterial({
  uniforms: { tDepth: flameU.tDepth, uRes: flameU.uRes }, side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending, vertexColors: true,
  vertexShader: 'attribute float aV; varying float vV; varying vec3 vC; varying float vZ; void main() { vV = aV; vC = color; vec4 v = modelViewMatrix * vec4(position, 1.0); vZ = v.z; gl_Position = projectionMatrix * v; }',
  fragmentShader: `#include <packing>
uniform sampler2D tDepth; uniform vec2 uRes; varying float vV; varying vec3 vC; varying float vZ;
void main() { float sz = perspectiveDepthToViewZ(texture2D(tDepth, gl_FragCoord.xy / uRes).x, ${camera.near.toFixed(4)}, ${camera.far.toFixed(1)}); if (vZ < sz - 0.0005) discard; float e = 1.0 - abs(vV); gl_FragColor = vec4(vC * e * e, 1.0); }`,
});
const sparks = new THREE.Mesh(spkGeo, spkMat); sparks.frustumCulled = false; flameScene.add(sparks);

// smoke: threads through the kernel's strands, a ribbon facing the eye, widening and thinning as it mixes
const SC = K.smoke.alive.length, smGeo = new THREE.BufferGeometry();
{
  const idx = new Uint32Array(SC * 6); for (let i = 0; i < SC; i++) idx.set([4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 2, 4 * i + 1, 4 * i + 3], 6 * i);
  smGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SC * 12), 3)); smGeo.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(SC * 16), 4)); smGeo.setAttribute('aUv', new THREE.BufferAttribute(new Float32Array(SC * 8), 2)); smGeo.setIndex(new THREE.BufferAttribute(idx, 1));
}
const smMat = new THREE.ShaderMaterial({
  uniforms: { uTime: flameU.uTime }, transparent: true, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide,
  vertexShader: 'attribute vec4 aCol; attribute vec2 aUv; varying vec4 vC; varying vec2 vUv; void main() { vC = aCol; vUv = aUv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform float uTime; varying vec4 vC; varying vec2 vUv;
float h(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float n1(float x) { float i = floor(x), f = fract(x); return mix(h(i), h(i + 1.0), f * f * (3.0 - 2.0 * f)); }
void main() { float a = 1.0 - vUv.x * vUv.x; a *= a; float fil = 0.75 + 0.5 * n1(vUv.y * 0.4 + vUv.x * 2.0); gl_FragColor = vec4(vC.rgb, vC.a * a * fil); }`,
});
const smoke = new THREE.Mesh(smGeo, smMat); smoke.frustumCulled = false; smoke.renderOrder = 5; scene.add(smoke);

// ── the frame: scene (with depth) → flame layer → shimmer and combine → bloom → ACES ─────────────────────────────────
const POST = (() => {
  const mk = (w, h, depth) => { const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: !!depth }); if (depth) { rt.depthTexture = new THREE.DepthTexture(w, h); rt.depthTexture.type = THREE.UnsignedIntType; } return rt; };
  const qs = new THREE.Scene(), qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; qs.add(quad);
  const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const sm = (fs, u, extra) => new THREE.ShaderMaterial(Object.assign({ uniforms: u, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false }, extra || {}));
  const NOISE = 'float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); } float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }';
  // the plume over the flame bends light: the scene behind it wavers, carried up with the hot gas
  const combine = sm(`uniform sampler2D tScene, tFlame; uniform vec2 uTip, uTop; uniform float uR, uHaze, uTime, uAspect; varying vec2 vUv; ${NOISE}
    void main() {
      vec2 asp = vec2(uAspect, 1.0), p = vUv * asp, a = uTip * asp, b = uTop * asp, ab = b - a; float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
      float d = length(p - a - ab * h), m = uHaze * exp(-pow(d / (uR * (0.6 + 2.2 * h)), 2.0)) * smoothstep(-0.05, 0.12, h) * (1.0 - h);
      vec2 q = p / max(uR, 1e-4) * 0.9 - vec2(0.0, uTime * 9.0);
      vec2 off = (vec2(vn(q), vn(q + 31.7)) - 0.5) * m * uR * 0.5 / asp;
      gl_FragColor = vec4(texture2D(tScene, vUv + off).rgb + texture2D(tFlame, vUv + 0.25 * off).rgb, 1.0); }`,
  { tScene: { value: null }, tFlame: { value: null }, uTip: { value: new THREE.Vector2() }, uTop: { value: new THREE.Vector2() }, uR: { value: 0.01 }, uHaze: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 } });
  const bright = sm('uniform sampler2D tSrc; uniform float uThr; varying vec2 vUv; void main() { vec3 c = texture2D(tSrc, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(uThr, uThr + 1.5, l), 1.0); }', { tSrc: { value: null }, uThr: { value: 1.6 } });
  const down = sm('uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv; void main() { vec2 t = uTexel; vec3 c = 0.5 * texture2D(tSrc, vUv).rgb + 0.125 * (texture2D(tSrc, vUv - t).rgb + texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb + texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb + texture2D(tSrc, vUv + t).rgb); gl_FragColor = vec4(c, 1.0); }', { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const up = sm(`uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv; void main() { vec2 t = uTexel; vec3 c = 4.0 * texture2D(tSrc, vUv).rgb;
    c += 2.0 * (texture2D(tSrc, vUv + vec2(t.x, 0.0)).rgb + texture2D(tSrc, vUv - vec2(t.x, 0.0)).rgb + texture2D(tSrc, vUv + vec2(0.0, t.y)).rgb + texture2D(tSrc, vUv - vec2(0.0, t.y)).rgb);
    c += texture2D(tSrc, vUv + t).rgb + texture2D(tSrc, vUv - t).rgb + texture2D(tSrc, vUv + vec2(t.x, -t.y)).rgb + texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb; gl_FragColor = vec4(c / 16.0, 1.0); }`,
  { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } }, { blending: THREE.AdditiveBlending, transparent: true });
  const comp = sm(`uniform sampler2D tSrc, tBloom; uniform float uExposure, uBloom, uAspect, uTime; varying vec2 vUv; ${NOISE}
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    void main() {
      vec3 c = texture2D(tSrc, vUv).rgb + uBloom * texture2D(tBloom, vUv).rgb;
      c = aces(c * uExposure);
      c *= mix(0.62, 1.0, smoothstep(1.3, 0.3, length((vUv - 0.5) * vec2(uAspect, 1.0))));
      c = mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      c += (h21(vUv * 1000.0 + fract(uTime) * 91.0) - 0.5) / 255.0;
      gl_FragColor = vec4(c, 1.0); }`, { tSrc: { value: null }, tBloom: { value: null }, uExposure: { value: 1 }, uBloom: { value: 0.3 }, uAspect: { value: 1 }, uTime: { value: 0 } });
  let Wd = 0, Hd = 0, rtS = null, rtF = null, rtC = null, mips = []; const size = new THREE.Vector2();
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qs, qc); };
  return {
    combine, comp,
    render() {
      renderer.getDrawingBufferSize(size); if (size.x < 32 || size.y < 32) return;   // a hidden pane can shrink the canvas to nothing
      if (size.x !== Wd || size.y !== Hd) {
        // the flame is soft, so it is marched at half resolution and upsampled where it is combined
        Wd = size.x; Hd = size.y; [rtS, rtF, rtC, ...mips].forEach((r) => r && r.dispose());
        rtS = mk(Wd, Hd, true); rtF = mk(Wd >> 1, Hd >> 1); rtC = mk(Wd, Hd); mips = []; let mw = Wd >> 1, mh = Hd >> 1; for (let i = 0; i < 5 && mw > 8 && mh > 8; i++) { mips.push(mk(mw, mh)); mw >>= 1; mh >>= 1; }
      }
      renderer.setRenderTarget(rtS); renderer.render(scene, camera);
      flameU.tDepth.value = rtS.depthTexture; flameU.uRes.value.set(Wd >> 1, Hd >> 1);
      renderer.setRenderTarget(rtF); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(flameScene, camera);
      combine.uniforms.tScene.value = rtS.texture; combine.uniforms.tFlame.value = rtF.texture; combine.uniforms.uAspect.value = Wd / Hd; pass(combine, rtC);
      bright.uniforms.tSrc.value = rtC.texture; pass(bright, mips[0]);
      for (let i = 1; i < mips.length; i++) { down.uniforms.tSrc.value = mips[i - 1].texture; down.uniforms.uTexel.value.set(1 / mips[i - 1].width, 1 / mips[i - 1].height); pass(down, mips[i]); }
      for (let i = mips.length - 1; i > 0; i--) { up.uniforms.tSrc.value = mips[i].texture; up.uniforms.uTexel.value.set(1 / mips[i].width, 1 / mips[i].height); pass(up, mips[i - 1]); }
      comp.uniforms.tSrc.value = rtC.texture; comp.uniforms.tBloom.value = mips[0].texture; comp.uniforms.uAspect.value = Wd / Hd; pass(comp, null);
    },
  };
})();

// ── per frame: place the stick, draw the flame, the sparks and the smoke ──────────────────────────────────────────────
const X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3(), UP = new THREE.Vector3(0, 0, 1), basis = new THREE.Matrix4();
function placeStick() {
  const d = K.dir(), tip = K.at(0);
  X.set(-d[0], -d[1], -d[2]);                                     // local x: from the head's tip toward the clip
  Z.copy(UP).addScaledVector(X, -UP.dot(X)); if (Z.lengthSq() < 1e-8) Z.set(1, 0, 0); Z.normalize(); Y.crossVectors(Z, X);
  basis.makeBasis(X, Y, Z); match.quaternion.setFromRotationMatrix(basis); match.position.set(tip[0], tip[1], tip[2]); match.updateMatrixWorld();
  const b = new THREE.Vector3(0.062, 0, 0).applyMatrix4(match.matrixWorld); ball.position.copy(b);
  const c = new THREE.Vector3(0.052, 0, 0).applyMatrix4(match.matrixWorld), mid = c.clone().add(b).multiplyScalar(0.5);
  arm.position.copy(mid); arm.scale.set(1, c.distanceTo(b), 1); arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(b).normalize());
  rod.position.set(b.x, b.y, b.z / 2); rod.scale.set(1, b.z, 1); foot.position.set(b.x, b.y, 0.004);
}
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), side = new THREE.Vector3();
let lightNow = 0, exposure = 2, haze = 0, lastFlame = null;
function drawFlame(t) {
  const f = K.flameAt(t); lastFlame = f;
  flameBox.visible = !!f;
  const target = f ? 0.016 * f.heat : 0; lightNow = target;                  // the gas glows only while it burns
  flameLight.intensity = lightNow;
  if (!f) return;
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let k = 0; k < NS; k++) {
    const r = 1.7 * f.rad[k] + 0.0012; flameU.uSpine.value[k].set(f.pts[3 * k], f.pts[3 * k + 1], f.pts[3 * k + 2]); flameU.uRad.value[k] = f.rad[k];
    for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], f.pts[3 * k + c] - r); mx[c] = Math.max(mx[c], f.pts[3 * k + c] + r); }
  }
  flameU.uBoxMin.value.set(...mn); flameU.uBoxMax.value.set(...mx);
  flameBox.position.set((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2); flameBox.scale.set(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
  flameU.uGain.value = 460 * (0.7 + 0.3 * Math.min(1.5, f.heat)); flameU.uBlue.value = f.blue; flameU.uSoot.value = f.soot; flameU.uWhite.value = f.flare; flameU.uEdge.value = f.edge;
  const h = Math.min(NS - 1, 5); flameLight.position.set(f.pts[3 * h], f.pts[3 * h + 1], f.pts[3 * h + 2]);
}
function drawSparks(t) {
  const list = K.sparksAt(t), P = spkGeo.attributes.position.array, C = spkGeo.attributes.color.array, V = spkGeo.attributes.aV.array;
  P.fill(0); C.fill(0);
  for (let i = 0; i < Math.min(SPK, list.length); i++) {
    const s = list[i]; tmp.set(s[0], s[1], s[2]); tmp2.set(s[3], s[4], s[5]);
    side.subVectors(tmp, tmp2).cross(tmp.clone().sub(camera.position)); if (side.lengthSq() < 1e-16) side.set(0, 0, 1e-4); side.setLength(0.00016);
    const q = [tmp2.x - side.x, tmp2.y - side.y, tmp2.z - side.z, tmp2.x + side.x, tmp2.y + side.y, tmp2.z + side.z, tmp.x - side.x, tmp.y - side.y, tmp.z - side.z, tmp.x + side.x, tmp.y + side.y, tmp.z + side.z];
    P.set(q, 12 * i); const k = s[6], c = [1, 0.25 + 0.55 * k, 0.04 + 0.35 * k * k].map((v) => 30 * k * v);
    for (let j = 0; j < 4; j++) { C.set(c, 12 * i + 3 * j); V[4 * i + j] = j % 2 ? 1 : -1; }
  }
  spkGeo.attributes.position.needsUpdate = spkGeo.attributes.color.needsUpdate = spkGeo.attributes.aV.needsUpdate = true;
}
// a thin smoke lights by scattering, mostly forward: bright against a light behind it, faint with the light behind you
const hg = (g, c) => (1 - g * g) / (4 * Math.PI * Math.pow(1 + g * g - 2 * g * c, 1.5));
function drawSmoke() {
  const S = K.smoke, P = smGeo.attributes.position.array, C = smGeo.attributes.aCol.array, U = smGeo.attributes.aUv.array;
  const cam = camera.position, fl = lastFlame ? flameLight.position : null, I = flameLight.intensity;
  let n = 0;
  const shade = (i, out) => {
    const age = S.age[i], kind = S.kind[i];
    tmp.set(S.x[i], S.y[i], S.z[i]); const toCam = tmp2.copy(cam).sub(tmp).normalize();
    const ph = (g, c) => 0.35 / (4 * Math.PI) + 0.65 * hg(g, c);   // a share scattered more than once: some light any way round
    let L = 0.22 * ph(0.6, -MOON.dot(toCam)) * 4 + 0.02;
    if (fl) { side.copy(tmp).sub(fl); const d2 = side.lengthSq(); side.normalize(); L += (I / (d2 + 0.0012)) * 0.15 * ph(0.5, side.dot(toCam)) * 4; }
    const alb = kind === 1 ? 0.18 : kind === 0 ? 0.95 : 0.8, a = Math.pow(S.dens[i], 0.7) * (kind === 2 ? 0.8 : kind === 0 ? 0.06 : 0.16) * Math.exp(-age / (kind === 2 ? 3.2 : 0.7)) * Math.min(1, 4 * age + 0.5) / (1 + 0.6 * age);
    const Lm = 0.22 * ph(0.6, -MOON.dot(toCam)) * 4 + 0.02, Lf = L - Lm;   // moonlight is cool, the flame's light warm
    out[0] = alb * (0.85 * Lm + 1.0 * Lf); out[1] = alb * (0.92 * Lm + 0.56 * Lf); out[2] = alb * (1.0 * Lm + 0.24 * Lf); out[3] = Math.min(1, a);
  };
  const ca = [0, 0, 0, 0], cb = [0, 0, 0, 0];
  for (let i = 0; i < S.alive.length && n < SC; i++) {
    if (!S.alive[i] || !K.linked(i)) continue;
    const j = S.prev[i];
    // the wisp is a thread; the strike's puff and shed soot are clouds that spread at once
    const wOf = (k) => (S.kind[k] === 2 ? 0.00035 + 0.0013 * S.age[k] : 0.003 + 0.03 * S.age[k]);
    const pa = [S.x[j], S.y[j], S.z[j]], pb = [S.x[i], S.y[i], S.z[i]];
    tmp.set(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]); tmp2.set(pa[0] - cam.x, pa[1] - cam.y, pa[2] - cam.z); side.crossVectors(tmp, tmp2);
    const seg = tmp.length(); if (side.lengthSq() < 1e-18 || seg > 0.03) continue; side.normalize();   // a thread torn apart (a breath) is not stitched
    // a thread thinner than a pixel is drawn a pixel wide and fainter by as much, so its coverage holds
    const px = (k) => 0.8 * (2 * Math.tan((camera.fov * DEG) / 2) / renderer.domElement.height) * Math.hypot(S.x[k] - cam.x, S.y[k] - cam.y, S.z[k] - cam.z);
    const wa = Math.max(wOf(j), px(j)), wb = Math.max(wOf(i), px(i));
    P.set([pa[0] - side.x * wa, pa[1] - side.y * wa, pa[2] - side.z * wa, pa[0] + side.x * wa, pa[1] + side.y * wa, pa[2] + side.z * wa, pb[0] - side.x * wb, pb[1] - side.y * wb, pb[2] - side.z * wb, pb[0] + side.x * wb, pb[1] + side.y * wb, pb[2] + side.z * wb], 12 * n);
    shade(j, ca); shade(i, cb); const tear = 1 - Math.min(1, Math.max(0, (seg - 0.007) / 0.01)); ca[3] *= (tear * wOf(j)) / wa; cb[3] *= (tear * wOf(i)) / wb;
    C.set(ca, 16 * n); C.set(ca, 16 * n + 4); C.set(cb, 16 * n + 8); C.set(cb, 16 * n + 12);
    const sa = S.seq[j] * 0.37 + S.strand[j] * 13.1, sb = S.seq[i] * 0.37 + S.strand[i] * 13.1;
    U.set([-1, sa, 1, sa, -1, sb, 1, sb], 8 * n);
    n++;
  }
  smGeo.setDrawRange(0, n * 6);
  smGeo.attributes.position.needsUpdate = smGeo.attributes.aCol.needsUpdate = smGeo.attributes.aUv.needsUpdate = true;
}
const sp = new THREE.Vector3();
function shimmer(t) {
  const f = lastFlame, cu = POST.combine.uniforms;
  haze += ((f ? Math.min(1.4, f.heat) : 0) - haze) * 0.15; cu.uHaze.value = haze; cu.uTime.value = t;
  if (!f) return;
  const tip = new THREE.Vector3(f.pts[3 * (NS - 1)], f.pts[3 * (NS - 1) + 1], f.pts[3 * (NS - 1) + 2]), mid = new THREE.Vector3(f.pts[3 * 8], f.pts[3 * 8 + 1], f.pts[3 * 8 + 2]);
  const top = tip.clone().addScaledVector(tip.clone().sub(mid).normalize(), 0.06).add(new THREE.Vector3(0, 0, 0.02));
  sp.copy(tip).project(camera); cu.uTip.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
  const R = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(0.005).add(tip).project(camera);
  cu.uR.value = Math.abs(R.x - sp.x) * 0.5 * (innerWidth / innerHeight) + 1e-4;
  sp.copy(top).project(camera); cu.uTop.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);
}

// ── views and controls ─────────────────────────────────────────────────────────────────────────────────────────────
const H = new THREE.Vector3(...M.hold);
const VIEWS = {
  hero: () => { const c = H.clone().add(new THREE.Vector3(0.036, 0, 0.012)); return [c.clone().add(new THREE.Vector3(0.02, -0.16, 0.025)), c]; },
  close: () => { const b = K.base(), c = new THREE.Vector3(b[0], b[1], b[2] + 0.012); return [c.clone().add(new THREE.Vector3(0.012, -0.075, 0.006)), c]; },
  'down the wind': () => { const c = H.clone().add(new THREE.Vector3(0.036, 0, 0.014)); return [c.clone().add(new THREE.Vector3(-0.17, -0.02, 0.02)), c]; },
  table: () => { const c = new THREE.Vector3(-0.02, 0.03, 0.05); return [c.clone().add(new THREE.Vector3(0.12, -0.3, 0.2)), c]; },
};
const goView = (k) => { const [p, c] = VIEWS[k](); camera.position.copy(p); controls.target.copy(c); controls.update(); };
goView('hero');
let speed = 1, paused = false, struckOnce = false;
const ui = document.getElementById('ui');
const btn = (t, fn) => { const b = document.createElement('button'); b.textContent = t; b.onclick = fn; ui.appendChild(b); return b; };
const slider = (t, min, max, step, val, fn, fmt) => { const l = document.createElement('label'), s = document.createElement('input'), o = document.createElement('span'); Object.assign(s, { type: 'range', min, max, step, value: val }); l.append(t, s, o); const set = () => { o.textContent = fmt(+s.value); fn(+s.value); }; s.oninput = set; set(); ui.appendChild(l); return s; };
const strike = () => { K.strike(); struckOnce = true; };
const blow = () => { const b = K.base(); breaths.push({ t0: K.t, from: camera.position.toArray(), to: b, U: 8, dur: 0.45 }); while (breaths.length > 4) breaths.shift(); };
btn('Strike', strike); btn('Blow', blow);
const slowBtn = btn('Speed 1×', () => { speed = speed === 1 ? 0.25 : speed === 0.25 ? 0.0625 : 1; slowBtn.textContent = `Speed ${speed === 1 ? '1' : speed === 0.25 ? '¼' : '1/16'}×`; });
const pauseBtn = btn('Pause', () => { paused = !paused; pauseBtn.textContent = paused ? 'Play' : 'Pause'; });
for (const k of Object.keys(VIEWS)) btn(k, () => goView(k));
slider('breeze', 0, 4, 0.05, W.speed, (v) => { W.speed = v; WF = windField(W); }, (v) => `${v.toFixed(2)} m/s`);
slider('gusts', 0, 1, 0.05, W.gust, (v) => { W.gust = v; WF = windField(W); }, (v) => v.toFixed(2));
slider('from', 0, 360, 5, 0, (v) => { W.dir = v * DEG; WF = windField(W); }, (v) => `${v}°`);
slider('angle', -85, 70, 1, Math.round(M.theta / DEG), (v) => { K.aim(v * DEG, M.psi); placeStick(); }, (v) => `${v}° ${v < -5 ? 'head down' : v > 5 ? 'head up' : 'level'}`);
slider('flame φ', 0, 1, 0.05, 1, (v) => { K.P.phi.flame = v; K.P.phi.sparks = v; K.P.phi.smoke = v; }, (v) => v.toFixed(2));
addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; if (e.key === 's') strike(); if (e.key === 'b') blow(); if (e.key === ' ') { paused = !paused; pauseBtn.textContent = paused ? 'Play' : 'Pause'; } });
const hud = document.getElementById('hud');

placeStick();
let last = performance.now(), frames = 0, fpsT = last, fps = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000) * speed; last = now;
  if (!paused) K.advanceTo(K.t + dt);
  if (!struckOnce && K.t > 0.8) strike();
  const t = K.t;
  mU.uFront.value = K.front; mU.uEmber.value = K.emberAt(t) * (K.struck >= 0 ? 1 : 0); mU.uTime.value = t; sU.uTime.value = t;
  drawFlame(t); drawSparks(t); drawSmoke(); shimmer(t);
  flameU.uTime.value = t; flameU.uCamFwd.value.set(0, 0, -1).applyQuaternion(camera.quaternion);
  // the eye adapts: wide open in the dark after the flame goes out, closing down in its light
  const want = Math.min(3.2, Math.max(0.9, 1.35 / Math.sqrt(0.18 + 0.82 * lightNow / 0.016)));
  exposure += (want - exposure) * (1 - Math.exp(-(Math.min(0.05, (now - fpsT) / 1000 + 0.016)) / 0.9)); POST.comp.uniforms.uExposure.value = exposure; POST.comp.uniforms.uTime.value = t;
  controls.update();
  POST.render();
  frames++; if (now - fpsT > 500) { fps = (frames * 1000) / (now - fpsT); frames = 0; fpsT = now; }
  const b = K.base(), u = air(b[0], b[1], b[2], t), f = lastFlame;
  hud.textContent = `${K.stage()}   t ${(K.struck >= 0 ? t - K.struck : 0).toFixed(1)} s\nfront ${(K.front * 1000).toFixed(1)} mm  ·  ${(K.rate * 1000).toFixed(2)} mm/s\nflame ${f ? (f.L * 1000).toFixed(0) : 0} mm  ·  air ${Math.hypot(...u).toFixed(2)} m/s  ·  blow-off ${(K.lift * 100).toFixed(0)}%\n${fps.toFixed(0)} fps`;
}
requestAnimationFrame(frame);
// headless timing: draw n frames back to back and wait for the GPU, → ms a frame
const timing = (n = 20) => { const gl = renderer.getContext(), px = new Uint8Array(4), t0 = performance.now(); for (let i = 0; i < n; i++) { drawFlame(K.t); drawSparks(K.t); drawSmoke(); shimmer(K.t); POST.render(); } gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return (performance.now() - t0) / n; };
// headless capture: pause, advance the burn by `sec` of simulated time, let the eye settle, draw one frame
const advance = (sec) => { paused = true; pauseBtn.textContent = 'Play'; if (!struckOnce) { K.advanceTo(0.8); strike(); } K.advanceTo(K.t + sec); drawFlame(K.t); const want = Math.min(3.2, Math.max(0.9, 1.35 / Math.sqrt(0.18 + 0.82 * lightNow / 0.016))); exposure = want; POST.comp.uniforms.uExposure.value = exposure; mU.uFront.value = K.front; mU.uEmber.value = K.emberAt(K.t); mU.uTime.value = K.t; placeStick(); drawSparks(K.t); drawSmoke(); for (let i = 0; i < 8; i++) shimmer(K.t); flameU.uTime.value = K.t; flameU.uCamFwd.value.set(0, 0, -1).applyQuaternion(camera.quaternion); controls.update(); POST.render(); return K.stage(); };
window.__match = { K, scene, flameScene, sparks, spkGeo, advance, camera, controls, renderer, match, flameLight, POST, goView, strike, blow, timing, set speed(v) { speed = v; }, get exposure() { return exposure; } };
