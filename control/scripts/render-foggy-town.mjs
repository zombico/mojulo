/**
 * Foggy town — effects-layer P2 integration render.
 *
 * Builds a procedural town (a grid of buildings with street gaps + a few towers), bakes it into the
 * effects-occluder's uniform-grid box field (bakeBoxField), and renders a ground-hugging volumetric
 * fog over it through the production raymarch path (emitRaymarchWorld + the new data-texture seam).
 * The fog clips against the grid-culled scene SDF — fog pools in the streets, thins with height, and
 * stops at building walls — with the SDF testing only the boxes in each ray-point's grid cell.
 *
 *   cd control && node scripts/render-foggy-town.mjs
 *     → ../lite-template/integration/0629/spike-output/foggy-town/foggy-town.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

import { buildVolumeFrag } from '../lib/graph/effects/volume-raymarch.js';
import { SDF_GLSL } from '../lib/graph/effects/sdf-glsl.js';
import { bakeBoxField, boxFieldGLSL } from '../lib/graph/effects/effects-occluder.js';
import { emitRaymarchWorld } from '../lib/graph/scene/scene-three.js';
import { resolveChromium, CHROMIUM_WEBGL_ARGS } from '../lib/graph/scene/chromium.js';

// ---- a procedural town (deterministic: seeded LCG so the committed render reproduces) ----------
let _s = 1337;
const rnd = () => (_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const boxes = [];
const PITCH = 8;            // block spacing
const SPAN = 3;             // blocks from center → 7×7 grid of blocks
for (let gx = -SPAN; gx <= SPAN; gx++) {
  for (let gz = -SPAN; gz <= SPAN; gz++) {
    if (gx === 0 && gz === 0) continue;            // central plaza (a gap the fog pools into)
    if (rnd() < 0.12) continue;                    // scattered empty lots
    const cx = gx * PITCH + (rnd() - 0.5) * 1.5;
    const cz = gz * PITCH + (rnd() - 0.5) * 1.5;
    const hx = 2.0 + rnd() * 1.1;
    const hz = 2.0 + rnd() * 1.1;
    const ring = Math.max(Math.abs(gx), Math.abs(gz));
    const tall = rnd() < 0.18;                      // occasional tower
    const H = tall ? 11 + rnd() * 6 : 3 + (3 - ring) * 1.2 + rnd() * 3;
    boxes.push({ cx, cy: H / 2, cz, hx, hy: H / 2, hz });
  }
}

const baked = bakeBoxField(boxes, { cell: 6, margin: 3, K: 8 });
console.log(`town: ${baked.count} buildings · grid ${baked.grid.cols}×${baked.grid.rows} cells · overflow ${baked.overflow}`);

// ---- the EFFECT side: a ground-hugging volumetric fog (its own visual nomenclature) -----------
const FOG_GLSL = `
float fbm(vec3 p){
  float v = 0.0, a = 0.55;
  for (int i = 0; i < 4; i++){ v += a * vrHash13(floor(p) + 0.5); p = p * 2.02; a *= 0.5; }
  return v;
}
vec3 sky(vec3 d){
  float t = clamp(d.y * 0.6 + 0.45, 0.0, 1.0);
  return mix(vec3(0.66, 0.71, 0.78), vec3(0.82, 0.87, 0.93), t);   // overcast dome
}
void volSample(vec3 p, vec3 rd, out vec3 emis, out vec3 ext){
  float h = clamp(1.0 - p.y / 8.0, 0.0, 1.0);                       // dense at ground, gone by y=8
  float layer = h * h;
  float drift = 0.5 + 0.7 * fbm(p * 0.22 + vec3(uTime * 0.10, 0.0, uTime * 0.07));
  float dens = layer * drift * 0.5 * ${process.env.DBG ? '0.0' : '1.0'};
  vec3 fogCol = vec3(0.85, 0.88, 0.93);
  emis = fogCol * dens;        // in-scattered airlight (pale, lit by sky)
  ext  = vec3(dens * 0.9);     // grey extinction
}
// debug: plain lambert on the scene SDF (no fog, no facade bands) to inspect raw geometry
vec3 groundDbg(vec3 p, vec3 rd){
  vec3 n = sceneNormal(p);
  float diff = clamp(dot(n, normalize(vec3(0.45,0.8,0.35))), 0.0, 1.0);
  bool g = p.y < 0.12;
  return (g ? vec3(0.15,0.16,0.2) : vec3(0.55,0.45,0.4)) * (0.25 + 0.8*diff);
}
`;

const frag = buildVolumeFrag({
  globals: `${SDF_GLSL}\n${boxFieldGLSL({ K: 8 })}\n${FOG_GLSL}`,
  uniforms: ['uniform float uRmax;'],
  rayDirArg: true,
  boundsRadius: 'uRmax',
  steps: 200,
  occluder: { sdfFn: 'sdfScene', groundFn: process.env.DBG ? 'groundDbg' : 'ground', traceSteps: 120, surfEps: '0.02', minStep: '0.05' },
  background: 'sky',
});

const W = 1100, H = 720;
const html = emitRaymarchWorld({
  frag,
  customUniforms: {
    uRmax: 44,
    uBoxCount: baked.count,
    uGridO: [baked.grid.ox, baked.grid.oz, baked.grid.cell],
    uGridN: [baked.grid.cols, baked.grid.rows, baked.grid.tpc],
  },
  dataTextures: { uBoxTex: baked.boxData, uCellTex: baked.cellData },
  cameraStart: [30, 19, 34],
  target: [0, 3.5, 0],
  fov: 46,
  readout: ['foggy town — effects layer (P2)', `${baked.count} buildings · grid-culled scene SDF · fog clips against the solids`],
  viewBox: { width: W, height: H },
  title: 'foggy-town',
  bg: '#9fb0bf',
  inline: true,
});

// ---- render headless → commit into the integration spike-output dir ----------------------------
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../lite-template/integration/0629/spike-output/foggy-town');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'foggy-town.html'), html);   // open in a browser: live, interactive, offline
console.log('wrote', path.join(outDir, 'foggy-town.html'));

const exe = await resolveChromium();
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 4000));   // WebGL init + a few fog-drift frames
  const el = await page.$('#wrap');
  const shot = el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' });
  const outPng = path.join(outDir, 'foggy-town.png');
  writeFileSync(outPng, Buffer.from(shot));
  console.log('wrote', outPng);
} finally {
  await browser.close().catch(() => {});
}
