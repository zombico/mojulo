/**
 * Foggy city — effects-layer P3: the fog over a REAL generated `fractal-city` (not the procedural
 * stand-in of P2). Proves the adapter on real substrate data: planFractalCity → filter to the
 * structural masses → boxFromFootprint (z-up {x,y,w,d,z1} → y-up center form) → bakeBoxField →
 * the same grid-culled scene-SDF occluder + volumetric fog through emitRaymarchWorld.
 *
 *   cd control && node scripts/render-foggy-city.mjs
 *     → ../lite-template/integration/0629/spike-output/foggy-city/foggy-city.png
 *   cd control && DBG=1 node scripts/render-foggy-city.mjs   # fog off: raw grid-culled massing
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

import { buildVolumeFrag } from '../lib/graph/effects/volume-raymarch.js';
import { SDF_GLSL } from '../lib/graph/effects/sdf-glsl.js';
import { bakeBoxField, boxFieldGLSL, boxFromFootprint } from '../lib/graph/effects/effects-occluder.js';
import { planFractalCity } from '../lib/graph/city/fractal-city.js';
import { emitRaymarchWorld } from '../lib/graph/scene/scene-three.js';
import { resolveChromium, CHROMIUM_WEBGL_ARGS } from '../lib/graph/scene/chromium.js';

// ---- a real generated city -------------------------------------------------------------------
const region = { x: 0, y: 0, w: 80, d: 52 };
const plan = planFractalCity({ region, depth: 4, seed: 5, anchor: 'tower', density: 0.9, profile: 'city', elements: { townhouses: true } });

// only the masses that actually rise + occlude fog — skip flat/decoration kinds (roads, parks,
// fences, lamps, trees, signs). Landmarks arrive as kind:'anchor'.
const STRUCT = new Set(['building', 'anchor', 'house', 'townhouse', 'midtower', 'garage']);
const cx0 = region.x + region.w / 2, cz0 = region.y + region.d / 2;   // center the city on the origin
const boxes = plan.boxes
  .filter((b) => STRUCT.has(b.kind) && b.z1 > (b.z0 || 0) && b.w > 0 && b.d > 0)
  .map((b) => boxFromFootprint(b))
  .map((b) => ({ ...b, cx: b.cx - cx0, cz: b.cz - cz0 }));

if (!boxes.length) throw new Error('no structural boxes from planFractalCity — check kind filter');

const baked = bakeBoxField(boxes, { cell: 5, margin: 3, K: 12 });
console.log(`city: ${plan.boxes.length} plan boxes → ${baked.count} structural masses · grid ${baked.grid.cols}×${baked.grid.rows} · overflow ${baked.overflow}`);
if (baked.overflow > 0) console.log(`  (overflow ${baked.overflow} box-cell writes dropped past K=${baked.grid.K} — raise K or cell if fog clips wrong in dense blocks)`);

// ---- the EFFECT side: ground-hugging volumetric fog ------------------------------------------
const FOG_GLSL = `
float fbm(vec3 p){
  float v = 0.0, a = 0.55;
  for (int i = 0; i < 4; i++){ v += a * vrHash13(floor(p) + 0.5); p = p * 2.02; a *= 0.5; }
  return v;
}
vec3 sky(vec3 d){
  float t = clamp(d.y * 0.6 + 0.45, 0.0, 1.0);
  return mix(vec3(0.66, 0.71, 0.78), vec3(0.82, 0.87, 0.93), t);
}
void volSample(vec3 p, vec3 rd, out vec3 emis, out vec3 ext){
  float h = clamp(1.0 - p.y / 7.0, 0.0, 1.0);
  float layer = h * h;
  float drift = 0.5 + 0.7 * fbm(p * 0.20 + vec3(uTime * 0.10, 0.0, uTime * 0.07));
  float dens = layer * drift * 0.42 * ${process.env.DBG ? '0.0' : '1.0'};
  vec3 fogCol = vec3(0.85, 0.88, 0.93);
  emis = fogCol * dens;
  ext  = vec3(dens * 0.9);
}
vec3 groundDbg(vec3 p, vec3 rd){
  vec3 n = sceneNormal(p);
  float diff = clamp(dot(n, normalize(vec3(0.45,0.8,0.35))), 0.0, 1.0);
  bool g = p.y < 0.12;
  return (g ? vec3(0.15,0.16,0.2) : vec3(0.5,0.42,0.38)) * (0.25 + 0.8*diff);
}
`;

const frag = buildVolumeFrag({
  globals: `${SDF_GLSL}\n${boxFieldGLSL({ K: 12 })}\n${FOG_GLSL}`,
  uniforms: ['uniform float uRmax;'],
  rayDirArg: true,
  boundsRadius: 'uRmax',
  steps: 200,
  occluder: { sdfFn: 'sdfScene', groundFn: process.env.DBG ? 'groundDbg' : 'ground', traceSteps: 130, surfEps: '0.02', minStep: '0.05' },
  background: 'sky',
});

const W = 1100, H = 720;
const html = emitRaymarchWorld({
  frag,
  customUniforms: {
    uRmax: 58,
    uBoxCount: baked.count,
    uGridO: [baked.grid.ox, baked.grid.oz, baked.grid.cell],
    uGridN: [baked.grid.cols, baked.grid.rows, baked.grid.tpc],
  },
  dataTextures: { uBoxTex: baked.boxData, uCellTex: baked.cellData },
  cameraStart: [27, 9, 31],
  target: [-2, 6, -2],
  fov: 52,
  readout: ['foggy city — effects layer (P3)', `real fractal-city · ${baked.count} masses · grid-culled scene SDF`],
  viewBox: { width: W, height: H },
  title: 'foggy-city',
  bg: '#9fb0bf',
  inline: true,
});

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../lite-template/integration/0629/spike-output/foggy-city');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'foggy-city.html'), html);   // open in a browser: live, interactive, offline
console.log('wrote', path.join(outDir, 'foggy-city.html'));

const exe = await resolveChromium();
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 4000));
  const el = await page.$('#wrap');
  const shot = el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' });
  const outPng = path.join(outDir, 'foggy-city.png');
  writeFileSync(outPng, Buffer.from(shot));
  console.log('wrote', outPng);
} finally {
  await browser.close().catch(() => {});
}
