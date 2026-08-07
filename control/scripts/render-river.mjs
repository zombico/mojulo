/**
 * River + waterfall — a stylized raymarch scene (effects-layer spine, opaque path).
 * Volumized elevation (terrain SDF with a carved channel + a cliff), water flowing down it (a second
 * SDF surface that ramps down the cliff), and a VOLUMETRIC spray puff at the plunge-pool base —
 * the spray is the same emission/absorption march as the fog, here over the terrain/water surface.
 *
 *   cd control && node scripts/render-river.mjs
 *     → ../lite-template/integration/0630/spike-output/river/river.{html,png}
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

import { buildVolumeFrag } from '../lib/graph/effects/volume-raymarch.js';
import { emitRaymarchWorld } from '../lib/graph/scene/scene-three.js';
import { resolveChromium, CHROMIUM_WEBGL_ARGS } from '../lib/graph/scene/chromium.js';

// the scene lives in GLSL globals: noise → terrain/water fields → surface shading → spray volume.
const GLOBALS = `
// ---------- noise ----------
float h21(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float vn2(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = h21(i), b = h21(i + vec2(1,0)), c = h21(i + vec2(0,1)), d = h21(i + vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float fbm2(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ v += a * vn2(p); p *= 2.02; a *= 0.5; } return v; }
float vn3(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n = mix(
    mix(mix(vrHash13(i+vec3(0,0,0)), vrHash13(i+vec3(1,0,0)), f.x), mix(vrHash13(i+vec3(0,1,0)), vrHash13(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(vrHash13(i+vec3(0,0,1)), vrHash13(i+vec3(1,0,1)), f.x), mix(vrHash13(i+vec3(0,1,1)), vrHash13(i+vec3(1,1,1)), f.x), f.y), f.z);
  return n;
}
float fbm3(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ v += a * vn3(p); p *= 2.03; a *= 0.5; } return v; }

// ---------- the canyon: downhill +X, a cliff (the fall) near X=0, a channel along Z=0 ----------
const float LIP0 = -0.5, LIP1 = 1.6;      // x-range of the waterfall lip
const float W_UP = -0.3, W_DOWN = -3.4;   // water level upstream / in the plunge pool
const float HALFW = 1.35;                 // channel half-width

float terrainH(vec2 xz){
  float x = xz.x, z = xz.y;
  float hills = fbm2((xz + 20.0) * 0.16) * 1.6;
  float base = 0.6 + hills - 0.05 * x;                       // banks, gentle downhill
  float cliff = -3.6 * smoothstep(LIP0, LIP1, x);            // the drop
  float trench = exp(-z * z / (2.0 * 1.0 * 1.0)) * 2.2;      // carved riverbed
  return base + cliff - trench;
}
float terrainField(vec3 p){ return p.y - terrainH(p.xz); }
float waterLevel(float x){ return mix(W_UP, W_DOWN, smoothstep(LIP0, LIP1, x)); }   // ramps down the cliff
float waterField(vec3 p){
  if (abs(p.z) > HALFW) return 1e4;                          // no water on the banks
  float wl = waterLevel(p.x);
  if (wl < terrainH(p.xz) + 0.03) return 1e4;                // dry: bed sits above the water line
  return p.y - wl;
}
// scaled (Lipschitz < 1) union so the heightfield sphere-trace doesn't overshoot thin ridges.
// 0.7 (vs a safer 0.55) takes bigger steps ⇒ fewer trace iters ⇒ cheaper, at a little edge softness.
float sdfScene(vec3 p){ return 0.70 * min(terrainField(p), waterField(p)); }

vec3 terrainNormal(vec3 p){ vec2 e = vec2(0.05, 0.0); return normalize(vec3(
  terrainField(p+e.xyy)-terrainField(p-e.xyy), terrainField(p+e.yxy)-terrainField(p-e.yxy), terrainField(p+e.yyx)-terrainField(p-e.yyx))); }
vec3 waterNormal(vec3 p){
  float e = 0.06;
  vec2 q = vec2(p.x * 1.4 - uTime * 1.3, p.z * 2.6);         // scroll the surface downhill (+X)
  float n = fbm2(q), nx = fbm2(q + vec2(e,0)) - n, nz = fbm2(q + vec2(0,e)) - n;
  return normalize(vec3(-nx * 2.4, 1.0, -nz * 2.4));
}

vec3 skyCol(vec3 d){
  float t = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 sky = mix(vec3(0.62, 0.74, 0.86), vec3(0.24, 0.45, 0.78), t);
  float sun = pow(max(dot(d, normalize(vec3(-0.4, 0.5, -0.6))), 0.0), 64.0);
  return sky + vec3(1.0, 0.95, 0.8) * sun * 0.8;
}

// surface shading — the occluder groundFn. Picks water vs rock at the hit, stylized.
vec3 shadeSurface(vec3 p, vec3 rd){
  bool isWater = waterField(p) < terrainField(p);
  if (isWater){
    vec3 n = waterNormal(p);
    float fres = 0.04 + 0.5 * pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
    vec3 deep = vec3(0.05, 0.20, 0.27), shallow = vec3(0.10, 0.42, 0.46);
    float depth = clamp((waterLevel(p.x) - terrainH(p.xz)) * 0.5, 0.0, 1.0);
    vec3 body = mix(shallow, deep, depth);
    vec3 refl = skyCol(reflect(rd, n));
    vec3 col = mix(body, refl, fres);
    // whitewater: foam on the steep fall + flowing streaks
    float steep = smoothstep(0.55, 0.9, 1.0 - n.y);
    float onFall = smoothstep(LIP0, LIP0 + 0.4, p.x) * (1.0 - smoothstep(LIP1, LIP1 + 0.6, p.x));
    float streak = smoothstep(0.55, 0.85, fbm2(vec2(p.x * 3.0 - uTime * 3.0, p.z * 5.0)));
    float foam = clamp(steep + onFall * 0.8 + streak * onFall, 0.0, 1.0);
    col = mix(col, vec3(0.92, 0.95, 0.97), foam);
    float spec = pow(max(dot(reflect(rd, n), normalize(vec3(-0.4, 0.5, -0.6))), 0.0), 80.0);
    return col + spec * 0.6;
  }
  vec3 n = terrainNormal(p);
  float diff = clamp(dot(n, normalize(vec3(0.45, 0.8, 0.35))), 0.0, 1.0);
  vec3 rock = vec3(0.30, 0.26, 0.22), grass = vec3(0.20, 0.32, 0.15), wet = vec3(0.18, 0.17, 0.16);
  vec3 alb = mix(rock, grass, smoothstep(0.62, 0.86, n.y));
  alb = mix(alb, wet, smoothstep(0.0, 0.6, 1.0 - n.y) * smoothstep(-3.6, -3.0, terrainH(p.xz) * 0.0 + p.y) * 0.0 + step(p.y, W_DOWN + 0.5) * 0.4);
  return alb * (0.32 + 0.85 * diff) + vec3(0.04, 0.06, 0.09);   // + sky ambient
}

// volumetric spray puff at the plunge-pool base (the same emission/absorption march as fog)
void volSample(vec3 p, vec3 rd, out vec3 emis, out vec3 ext){
  vec3 c = vec3(LIP1 + 0.1, W_DOWN + 0.45, 0.0);
  vec3 q = (p - c) * vec3(1.0, 0.85, 1.15);
  float puff = exp(-dot(q, q) * 1.15);                       // tighter, hugs the base
  float turb = 0.5 + 0.75 * fbm3(p * 1.0 + vec3(0.0, -uTime * 0.9, uTime * 0.2));
  float dens = puff * turb * 0.65;
  // a faint low mist drifting down the plunge channel
  float mist = exp(-(p.y - (W_DOWN + 0.25)) * (p.y - (W_DOWN + 0.25)) * 1.6) * smoothstep(LIP1, LIP1 + 5.0, p.x) * 0.10;
  dens += mist * (0.6 + 0.6 * fbm3(p * 0.5 + vec3(-uTime * 0.5, 0.0, 0.0)));
  vec3 sprayCol = vec3(0.92, 0.95, 0.98);
  emis = sprayCol * dens * 0.6;     // sky-lit spray, accent not blowout
  ext  = vec3(dens * 0.9);
}
`;

const frag = buildVolumeFrag({
  globals: GLOBALS,
  uniforms: ['uniform float uRmax;'],
  rayDirArg: true,
  boundsRadius: 'uRmax',
  steps: 56,                                                 // volume (spray) march — spray is localized
  occluder: { sdfFn: 'sdfScene', groundFn: 'shadeSurface', traceSteps: 130, surfEps: '0.006', minStep: '0.02' },
  background: 'skyCol',
});

const W = 1100, H = 720;
const html = emitRaymarchWorld({
  frag,
  customUniforms: { uRmax: 28 },
  cameraStart: [10, 1.2, 6.5],
  target: [0.5, -1.6, 0],
  fov: 52,
  pixelRatioCap: 0.8,                                        // render at ~0.8× — the big perf lever (upscaled)
  readout: ['river + waterfall — raymarch spike (perf-tuned)', 'terrain + water SDF · volumetric spray at the plunge pool'],
  viewBox: { width: W, height: H },
  title: 'river-waterfall',
  bg: '#9fb6c8',
  inline: true,
});

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../lite-template/integration/0630/spike-output/river');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'river.html'), html);

const exe = await resolveChromium();
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.goto('file://' + path.join(outDir, 'river.html'), { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 3500));
  const el = await page.$('#wrap');
  const shot = el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' });
  writeFileSync(path.join(outDir, 'river.png'), Buffer.from(shot));
  console.log('wrote', path.join(outDir, 'river.png'), '+ river.html');
} finally {
  await browser.close().catch(() => {});
}
