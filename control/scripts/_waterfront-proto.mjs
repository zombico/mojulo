// PROTOTYPE — pressure-test: does the composition handle a cityfront-with-water?
// fractal city payload  +  a city-scaled SHORE surface at the seaward edge  +  a chosen EDGE
// (seawall quay OR a sloped sand beach), all merged into ONE emitThreeWorld call.
//   node scripts/_waterfront-proto.mjs <out.png> [seawall|beach]
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register(pathToFileURL('/Users/fombico/Documents/mojulo/control/scripts/mcp-stdio-loader.mjs').href);
import { writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const { assembleFractalCityScene } = await import('/Users/fombico/Documents/mojulo/control/lib/graph/city/fractal-city.js');
const { emitThreeWorld } = await import('/Users/fombico/Documents/mojulo/control/lib/graph/scene/scene-three.js');
const { resolveChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('/Users/fombico/Documents/mojulo/control/lib/graph/scene/chromium.js');

const OUT = process.argv[2] || '/tmp/waterfront.png';
const EDGE_KIND = process.argv[3] || 'seawall';           // 'seawall' | 'beach'
const CITY_LIFT = 1;                                       // just slightly higher than the water (a low raised grade)
const TAU = Math.PI * 2, GOLDEN = 2.399963229728653, G_EFF = 1.4;
const hex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('');
const norm3 = (v) => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// ── 1) the city (a compact fractal block, day lighting) ──────────────────────────────────────
// region widened to w:44 so the city spans x∈[-11,35] — the SAME width as the water grid (1:1 land↔sea).
const city = assembleFractalCityScene({ region: { x: -10, y: 2, w: 44, d: 14 }, depth: 2, seed: 3, day: true, density: 0.62 });
// city faces now span x∈[-11,35] y∈[1,17] z∈[0,~9] (z up, ground at 0). Sea goes on the y<edge side.

// ── 2) a city-scaled onshore wave spectrum (small amplitude, short wavelength) ───────────────
function buildSpectrum() {
  const base = Math.PI / 2;   // +y = toward the city
  const specs = [{ lam: 9.5, A: 0.5 }, { lam: 6, A: 0.34 }, { lam: 3.8, A: 0.22 }, { lam: 2.4, A: 0.14 }];
  const waves = specs.map((s, i) => {
    const k = TAU / s.lam, ang = base + 0.4 * (i / (specs.length - 1) - 0.5);
    return { dx: Math.cos(ang), dy: Math.sin(ang), A: s.A, k, om: Math.sqrt(G_EFF * k), ph: (i * GOLDEN) % TAU, Q: 0.5 };
  });
  const sum = waves.reduce((a, w) => a + w.Q * w.k * w.A, 0);
  if (sum > 0.9) for (const w of waves) w.Q *= 0.9 / sum;
  return waves;
}
const waves = buildSpectrum();
const amax = waves.reduce((a, w) => a + w.A, 0);

// ── 3) the EDGE — either a hard seawall quay OR a sloped sand beach the water laps onto ───────
const SUN = [18, -26, 46];
let edgeFaces = [], WATERLINE;
if (EDGE_KIND === 'beach') {
  // a sand wedge: submerged toe → waterline (z=0) → rising all the way up to the raised city grade.
  WATERLINE = -9;
  const cityEdge = 1.6, toeY = -21, toeDepth = 4.2;
  const bedZ = (y) => y >= WATERLINE
    ? CITY_LIFT * (y - WATERLINE) / (cityEdge - WATERLINE)   // 0 at the waterline → up to the city grade
    : -toeDepth * (WATERLINE - y) / (WATERLINE - toeY);
  const sun = norm3(SUN), DRY = [0.86, 0.77, 0.58], WET = [0.5, 0.42, 0.31];
  const ripple = (x, y) => 0.13 * Math.sin(x * 0.7 + y * 0.3) + 0.09 * Math.sin(y * 1.1 + 0.6);
  const zAt = (x, y) => bedZ(y) + ripple(x, y);
  const sx0 = -11, sx1 = 35, sy0 = toeY, sy1 = cityEdge, SXN = 60, SYN = 40;   // sand spans the full water width
  for (let j = 0; j < SYN; j++) for (let i = 0; i < SXN; i++) {
    const xa = sx0 + (sx1 - sx0) * i / SXN, xb = sx0 + (sx1 - sx0) * (i + 1) / SXN;
    const ya = sy0 + (sy1 - sy0) * j / SYN, yb = sy0 + (sy1 - sy0) * (j + 1) / SYN;
    const p00 = [xa, ya, zAt(xa, ya)], p10 = [xb, ya, zAt(xb, ya)], p11 = [xb, yb, zAt(xb, yb)], p01 = [xa, yb, zAt(xa, yb)];
    const n = norm3(cross3(sub3(p10, p00), sub3(p01, p00)));
    const shade = 0.36 + 0.64 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
    const zc = (p00[2] + p10[2] + p11[2] + p01[2]) / 4, wet = zc < 0 ? 1 : Math.max(0, 1 - zc / 1.1);
    const base = [WET[0] + (DRY[0] - WET[0]) * (1 - wet), WET[1] + (DRY[1] - WET[1]) * (1 - wet), WET[2] + (DRY[2] - WET[2]) * (1 - wet)];
    edgeFaces.push({ corners: [p00, p10, p11, p01], fill: hex([base[0] * shade, base[1] * shade, base[2] * shade]) });
  }
} else {
  // a seawall quay: a vertical wall + capstone lip along the waterline (the hard urban edge).
  WATERLINE = 1.4;
  const x0 = -11, x1 = 35, segs = 22, top = CITY_LIFT, bot = -3.2;   // wall spans the full water width, rises to grade
  for (let i = 0; i < segs; i++) {
    const xa = x0 + (x1 - x0) * i / segs, xb = x0 + (x1 - x0) * (i + 1) / segs, sh = 0.5 + 0.08 * Math.sin(i * 1.7);
    edgeFaces.push({ corners: [[xa, WATERLINE, bot], [xb, WATERLINE, bot], [xb, WATERLINE, top], [xa, WATERLINE, top]], fill: hex([0.40 * sh, 0.42 * sh, 0.45 * sh]) });
    edgeFaces.push({ corners: [[xa, WATERLINE, top], [xb, WATERLINE, top], [xb, WATERLINE + 1.1, top], [xa, WATERLINE + 1.1, top]], fill: hex([0.60 * sh, 0.62 * sh, 0.64 * sh]) });
  }
}

// ── 4) the SHORE surface, placed so its landward edge sits at the waterline (via grid cx/cy) ──
const CX = 12, W = 46, D = 54, NX = 128, NY = 148;
const CY = WATERLINE - D / 2;
const water = {
  grid: { w: W, d: D, nx: NX, ny: NY, cx: CX, cy: CY },
  waves, amax,
  deep: [0.09, 0.36, 0.48], surf: [0.16, 0.54, 0.62], crest: [0.95, 0.98, 0.99],
  sun: SUN,
  // buoys riding the swell out in the deeper water — they trace the circular orbital motion of the waves.
  floaters: [{ x: 14, y: WATERLINE - 15, r: 1.0, color: 0xff5a4a }, { x: 5, y: WATERLINE - 22, r: 0.9, color: 0xffd24a }],
  shore: { edgeY: WATERLINE, surfW: 22, swashRange: 2.4, omSwash: 0.7, foamW: 2.6, sink: 0.4, shallow: [0.42, 0.74, 0.70] },
};

// ── 5) merge into ONE payload + a waterfront camera looking from the sea at the skyline ───────
// lift the whole city onto an elevated grade (z += CITY_LIFT) so the beach/wall rises to meet it and
// there is a raised platform to "build on top of" — the water still waves around sea level (z≈0).
const cityFaces = city.faces.map((f) => ({ ...f, corners: f.corners.map((c) => [c[0], c[1], c[2] + CITY_LIFT]) }));
const payload = {
  ...city,
  bg: '#bfe0ee',
  faces: [...cityFaces, ...edgeFaces],
  surfaces: [water],
  cameras: [
    { name: 'waterfront', worldFraming: { cameraPosition: [12, -52, 20], lookAt: [12, 5, 4], horizontalFov: 72 } },
    ...city.cameras,
  ],
};

const html = emitThreeWorld({ ...payload, inline: true });
const htmlPath = OUT.replace(/\.png$/, '.html');
writeFileSync(htmlPath, html);
console.log('wrote', htmlPath, '(', EDGE_KIND, 'edge )');

const browser = await puppeteer.launch({ executablePath: await resolveChromium(), headless: true, args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const page = await browser.newPage();
await page.setViewport({ width: 1120, height: 780, deviceScaleFactor: 2 });
await page.goto('file://' + htmlPath, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3200));
await page.evaluate(() => { for (const s of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(s)) e.style.display = 'none'; });
writeFileSync(OUT, Buffer.from(await page.screenshot({ type: 'png' })));
await browser.close();
console.log('wrote', OUT);
