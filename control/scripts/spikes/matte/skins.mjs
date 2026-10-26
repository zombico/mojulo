#!/usr/bin/env node
/**
 * SPIKE: rock SKINS from one field, Voronoi regions warped by Perlin noise. A skin is a parameter set of that field:
 * the cells are the rock's chunks (anisotropic: tall for fluted and sculpted faces, wide and flat for slabs and beds),
 * their outlines warped so none is a polygon; each chunk stands proud or sits back by its own dice, its edge rounded into
 * the dark gap between chunks; inside, Perlin unevenness, and for some skins vertical flutes or bedded ledges. Lit and
 * painted like the stone block (matte-paint light.js, a ramp picked by the value). Four skins, after four references:
 * fluted, sculpted, stacked slabs, bedded sandstone.
 *
 *   cd control && node scripts/spikes/matte/skins.mjs → ../lite-template/integration/1020/spike-output/matte/skins.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { fractal2, gnoise2, smoothstep } = await import('../../../lib/graph/noise/noise.js');
const { hash01 } = await import('../../../lib/graph/matte-paint/relief.js');
const { lightRelief } = await import('../../../lib/graph/matte-paint/light.js');
const { rampAt } = await import('../../../lib/graph/matte-paint/paint.js');
const { encodePngRgba } = await import('../../../lib/graph/landscape/surface-textures.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1020/spike-output/matte');
mkdirSync(outDir, { recursive: true });
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Voronoi on an anisotropic, warped plane: F1, F2 (in cell units) and the nearest cell's id. */
function voronoi(x, y, S, seed) {
  const [wx, wy] = [fractal2(x / S.warpScale, y / S.warpScale, { seed: seed + 3, octaves: 3 })[0], fractal2(x / S.warpScale + 5.2, y / S.warpScale - 1.3, { seed: seed + 5, octaves: 3 })[0]];
  const qx = (x + S.warp * wx) / S.cell[0], qy = (y + S.warp * wy) / S.cell[1];
  const ci = Math.floor(qx), cj = Math.floor(qy);
  let f1 = Infinity, f2 = Infinity, id = [0, 0];
  for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
    const px = i + 0.15 + 0.7 * hash01(i, j, seed), py = j + 0.15 + 0.7 * hash01(i, j, seed + 1), d = Math.sqrt((qx - px) ** 2 + (qy - py) ** 2);
    if (d < f1) { f2 = f1; f1 = d; id = [i, j]; } else if (d < f2) f2 = d;
  }
  return { f1, f2, id };
}

const SKINS = {
  fluted: { title: 'fluted (tall columns, soft vertical flutes)', cell: [0.7, 2.4], warp: 0.25, warpScale: 1.2, bevel: 0.1, gap: 0.03, gapDepth: 0.14, proud: 0.14, rough: 0.01, flute: 0.014, fluteScale: [0.16, 1.4], beds: null,
    ramp: ['#3e2c1e', '#6b4e33', '#9a7450', '#c4a07a', '#e8d2b0'] },
  sculpted: { title: 'sculpted (tall chunks, deep recesses)', cell: [0.9, 1.6], warp: 0.3, warpScale: 1.0, bevel: 0.14, gap: 0.05, gapDepth: 0.22, proud: 0.2, rough: 0.016, flute: 0.008, fluteScale: [0.12, 1.0], beds: null,
    ramp: ['#33261a', '#5c4630', '#8a6c4c', '#b3946e', '#d9c19c'] },
  slabs: { title: 'stacked slabs (wide flat chunks, strong bevels)', cell: [1.1, 0.42], warp: 0.25, warpScale: 1.2, bevel: 0.12, gap: 0.035, gapDepth: 0.16, proud: 0.2, rough: 0.006, flute: 0, beds: null,
    ramp: ['#3a3a3c', '#646466', '#8e8c88', '#b6b2aa', '#dcd6cc'] },
  bedded: { title: 'bedded sandstone (rounded ledges, weak breaks)', cell: [1.4, 0.3], warp: 0.15, warpScale: 1.5, bevel: 0.08, gap: 0.015, gapDepth: 0.05, proud: 0.06, rough: 0.01, flute: 0, beds: { h: 0.32, ledge: 0.09 },
    ramp: ['#4a1f14', '#7a3622', '#a8553a', '#c97c5c', '#e3a888'], tone: ['#5a2a1c', '#8a4a30', '#b8704e', '#d69a78', '#efc4a6'] },
};

function skin(S, { w = 4, h = 3, ppm = 64, seed = 7 } = {}) {
  const W = Math.round(w * ppm), H = Math.round(h * ppm), px = 1 / ppm;
  const height = new Float32Array(W * H), inside = new Float32Array(W * H).fill(1), cellTone = new Float32Array(W * H), bedOf = new Int32Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = (i + 0.5) * px, y = (j + 0.5) * px, k = j * W + i;
    const { f1, f2, id } = voronoi(x, y, S, seed), edge = (f2 - f1) * Math.min(...S.cell) * 0.5;   // ≈ metres to the cell's border
    const own = hash01(id[0], id[1], seed + 9);
    // the chunk: its own height, its edge rounded down into the gap
    let z = (own - 0.5) * S.proud;
    z -= S.bevel * (1 - smoothstep(0, S.bevel * 1.5, edge));
    if (edge < S.gap) z -= S.gapDepth * (1 - edge / S.gap);
    // its tilt: a plane of its own
    z += ((hash01(id[0], id[1], seed + 11) - 0.5) * (x - (id[0] + 0.5) * S.cell[0]) + (hash01(id[0], id[1], seed + 13) - 0.5) * (y - (id[1] + 0.5) * S.cell[1])) * 0.08;
    // inside: Perlin unevenness, and the flutes (ridged, long in y)
    z += fractal2(x / 0.25, y / 0.25, { seed: seed + 15, octaves: 4 })[0] * S.rough;
    if (S.flute) z += fractal2(x / S.fluteScale[0], y / S.fluteScale[1], { seed: seed + 17, octaves: 3, flavour: 'ridged' })[0] * S.flute;
    // beds: courses of ledges, each stepping back a little under the one above, its lip rounded
    if (S.beds) {
      const b = (y + 0.04 * gnoise2(x / 0.6, 0, seed + 19)) / S.beds.h, bi = Math.floor(b), t = b - bi;
      z -= S.beds.ledge * smoothstep(0.55, 1, t) - S.beds.ledge * 0.4 * (hash01(bi, 0, seed + 21) - 0.5);
      bedOf[k] = bi;
    }
    height[k] = z; cellTone[k] = own;
  }
  // a gap is a recess, not an ink line: lit on its sunward wall, in cast shadow on the other, the hollow darkening light
  const lit = lightRelief({ W, H, px, height, inside }, { az: 130, el: 34, ambient: 0.34, wrap: 0.25, reach: 0.6, soft: 0.03, floor: 0.32, radius: 0.08, cavity: 0.15, edge: 0.2 });
  const ramp = S.ramp.map(hex), tone = S.tone ? S.tone.map(hex) : null, out = Buffer.alloc(W * H * 4);
  for (let k = 0; k < W * H; k++) {
    const t = 0.5 + (lit.value[k] - 1) * 0.95 + (cellTone[k] - 0.5) * 0.12;
    let c = rampAt(ramp, t);
    if (tone && hash01(bedOf[k], 3, 41) < 0.5) c = c.map((v, q) => v * 0.5 + rampAt(tone, t)[q] * 0.5);   // a bed of another colour
    out[k * 4] = clamp(Math.round(c[0]), 0, 255); out[k * 4 + 1] = clamp(Math.round(c[1]), 0, 255); out[k * 4 + 2] = clamp(Math.round(c[2]), 0, 255); out[k * 4 + 3] = 255;
  }
  return `data:image/png;base64,${encodePngRgba(out, W, H).toString('base64')}`;
}

const cells = Object.entries(SKINS).map(([id, S]) => { const t0 = Date.now(), url = skin(S); return { id, title: S.title, url, ms: Date.now() - t0 }; });
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.g{display:grid;grid-template-columns:repeat(2,512px);gap:12px}img{width:512px;display:block}</style>
<div style="margin-bottom:8px">rock skins: one Voronoi field warped by Perlin, four parameter sets · a 4 × 3 m face at 64 px/m · light from the upper left</div>
<div class=g>${cells.map((c) => `<figure style="margin:0"><img src="${c.url}"><figcaption>${c.id}: ${c.title} · ${c.ms} ms</figcaption></figure>`).join('')}</div>`;
writeFileSync(path.join(outDir, 'skins.html'), page);
const browser = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await browser.newPage(); await p.setViewport({ width: 1060, height: 860 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, 'skins.png'), await p.screenshot({ type: 'png', fullPage: true })); } finally { await browser.close(); }
console.log(cells.map((c) => `${c.id} ${c.ms} ms`).join(' · '));
