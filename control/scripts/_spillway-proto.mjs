// PROTOTYPE — pressure-test: a night SPILLWAY DAM in the three.js World, from the photo:
// a gravity dam with N gate bays, a white veil of water falling through EACH bay, warm crest
// lights, snow-capped ridge behind. The water mixes two existing surface-channel modes:
//   • tailrace  — the double-slit WAVEFIELD: each gate is a coherent point source, the churn
//                 downstream IS their interference fan (the "split experiment" move);
//   • reservoir — a calm Gerstner sheet behind the wall (ocean/river's machinery, near-still).
//   node scripts/_spillway-proto.mjs [/tmp/spillway.png]
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register(pathToFileURL('/Users/fombico/Documents/mojulo/control/scripts/mcp-stdio-loader.mjs').href);
import { writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const { emitThreeWorld } = await import('/Users/fombico/Documents/mojulo/control/lib/graph/scene/scene-three.js');
const { resolveChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('/Users/fombico/Documents/mojulo/control/lib/graph/scene/chromium.js');

const OUT = process.argv[2] || '/tmp/spillway.png';
const hex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('');
const norm3 = (v) => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// deterministic value noise (seeded) for the ridge
function hash2(ix, iy) { let h = (ix * 374761393 + iy * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}
function fbm(x, y) { let s = 0, a = 0.5, f = 0.03; for (let o = 0; o < 4; o++) { s += a * vnoise(x * f + 7, y * f + 3); f *= 2.1; a *= 0.5; } return s; }

const MOON = norm3([-24, 30, 60]);
const faces = [];
const lambert = (n, base, amb = 0.30) => {
  const d = Math.max(0, n[0] * MOON[0] + n[1] * MOON[1] + n[2] * MOON[2]);
  return hex([base[0] * (amb + (1 - amb) * d), base[1] * (amb + (1 - amb) * d), base[2] * (amb + (1 - amb) * d)]);
};
const quad = (p00, p10, p11, p01, base, opts = {}) => {
  const n = norm3(cross3(sub3(p10, p00), sub3(p01, p00)));
  faces.push({ corners: [p00, p10, p11, p01], fill: opts.lit ? hex(base) : lambert(n, base, opts.amb) });
};
// axis-aligned box: [x0,x1]×[y0,y1]×[z0,z1]
function box(x0, x1, y0, y1, z0, z1, base, opts = {}) {
  quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], base, opts);           // downstream (+y)
  quad([x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1], base, opts);           // upstream (−y)
  quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], base, opts);           // top
  quad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], base, opts);           // −x
  quad([x1, y1, z0], [x1, y0, z0], [x1, y0, z1], [x1, y1, z1], base, opts);           // +x
}

// ── the dam ──────────────────────────────────────────────────────────────────────────────────
const GATES = 8, GATE_W = 4.6, PIER_W = 1.3;
const SPAN = GATES * GATE_W + (GATES + 1) * PIER_W;            // 47.6
const X0 = -SPAN / 2;
const SILL = 6.6, DECK = 10.8, DECK_TOP = 11.6;
const CONCRETE = [0.30, 0.34, 0.43], CONCRETE_LIT = [0.55, 0.52, 0.44];

// main wall below the sills — a battered downstream face (top at y=0.4, base flares to y=2.2)
const WSEG = 24;
for (let i = 0; i < WSEG; i++) {
  const xa = X0 + (SPAN * i) / WSEG, xb = X0 + (SPAN * (i + 1)) / WSEG;
  const sh = 0.9 + 0.1 * Math.sin(i * 2.1);
  quad([xa, 0.4, SILL], [xb, 0.4, SILL], [xb, 2.2, 0], [xa, 2.2, 0], mix(CONCRETE, [0, 0, 0], 0).map((v, j) => CONCRETE[j] * sh));
}
box(X0, X0 + SPAN, -3.2, 0.4, 0, SILL, [0.26, 0.29, 0.37]);     // wall body behind the face
// piers between the gates, up to the deck; their tips catch the warm crest light
for (let g = 0; g <= GATES; g++) {
  const px = X0 + g * (GATE_W + PIER_W);
  box(px, px + PIER_W, -2.6, 1.6, SILL, DECK, CONCRETE);
  quad([px, 1.6, DECK - 1.1], [px + PIER_W, 1.6, DECK - 1.1], [px + PIER_W, 1.6, DECK], [px, 1.6, DECK], CONCRETE_LIT, { lit: true });
  // raised gate leaf (dark steel) parked above each opening
  if (g < GATES) box(px + PIER_W, px + PIER_W + GATE_W, -1.2, -0.4, SILL + 1.1, DECK - 0.6, [0.10, 0.12, 0.15]);
}
// deck slab + parapet + warm lamps along the crest (the photo's string of lights)
box(X0 - 0.6, X0 + SPAN + 0.6, -2.8, 1.9, DECK, DECK_TOP, [0.34, 0.37, 0.45]);
quad([X0 - 0.6, 1.9, DECK], [X0 + SPAN + 0.6, 1.9, DECK], [X0 + SPAN + 0.6, 1.9, DECK_TOP], [X0 - 0.6, 1.9, DECK_TOP], [0.62, 0.56, 0.42], { lit: true });
for (let g = 0; g <= GATES; g++) {
  const px = X0 + g * (GATE_W + PIER_W) + PIER_W / 2;
  box(px - 0.10, px + 0.10, 1.2, 1.4, DECK_TOP, DECK_TOP + 1.2, [0.18, 0.20, 0.24]);
  box(px - 0.28, px + 0.28, 1.05, 1.55, DECK_TOP + 1.2, DECK_TOP + 1.62, [1.0, 0.87, 0.55], { lit: true });
}
// gatehouse on the left abutment, windows lit
box(X0 - 7.8, X0 + 1.2, -2.4, 1.4, DECK_TOP, DECK_TOP + 3.4, [0.22, 0.25, 0.32]);
for (let wI = 0; wI < 4; wI++) {
  const wx = X0 - 6.6 + wI * 2.0;
  quad([wx, 1.41, DECK_TOP + 1.0], [wx + 1.1, 1.41, DECK_TOP + 1.0], [wx + 1.1, 1.41, DECK_TOP + 2.2], [wx, 1.41, DECK_TOP + 2.2], [1.0, 0.9, 0.62], { lit: true });
}
// rock banks tying the wall into the valley sides — they contain the raised reservoir
box(X0 - 40, X0, -14, 2.2, 0, DECK_TOP + 0.8, [0.10, 0.12, 0.16]);
box(X0 + SPAN, X0 + SPAN + 40, -14, 2.2, 0, DECK_TOP + 0.8, [0.10, 0.12, 0.16]);

// ── the veils: white water through EACH gate (streaked, brightening as it falls) ─────────────
// each veil follows a parabola from the sill lip out to the stilling basin.
const VSEG = 9, STRIPS = 7;
const veilPath = (t) => ({ y: 0.5 + 4.6 * t * t + 0.6 * t, z: SILL * (1 - t * t) - 0.25 * t });
for (let g = 0; g < GATES; g++) {
  const gx0 = X0 + PIER_W + g * (GATE_W + PIER_W) + 0.12, gw = GATE_W - 0.24;
  for (let s = 0; s < STRIPS; s++) {
    const xa = gx0 + (gw * s) / STRIPS, xb = gx0 + (gw * (s + 1)) / STRIPS;
    const streak = 0.82 + 0.18 * hash2(g * 17 + s, s * 7 + 1);           // per-strip streak brightness
    for (let i = 0; i < VSEG; i++) {
      const a = veilPath(i / VSEG), b = veilPath((i + 1) / VSEG);
      const t = (i + 0.5) / VSEG;
      const c = mix([0.62, 0.72, 0.86], [0.97, 0.99, 1.0], Math.pow(t, 0.8)).map((v) => v * streak);
      quad([xa, a.y, a.z], [xb, a.y, a.z], [xb, b.y, b.z], [xa, b.y, b.z], c, { lit: true });
    }
  }
}
// the churn at the base — a bright foam apron the veils plunge into
for (let i = 0; i < WSEG; i++) {
  const xa = X0 + (SPAN * i) / WSEG, xb = X0 + (SPAN * (i + 1)) / WSEG;
  const f = 0.85 + 0.15 * hash2(i, 3);
  quad([xa, 4.6, 0.5], [xb, 4.6, 0.5], [xb, 7.6, 0.32], [xa, 7.6, 0.32], [0.88 * f, 0.93 * f, 0.99 * f], { lit: true });
  quad([xa, 7.6, 0.32], [xb, 7.6, 0.32], [xb, 9.6, 0.22], [xa, 9.6, 0.22], [0.55 * f, 0.64 * f, 0.78 * f], { lit: true });
}

// ── the ridge + treeline behind (night, snow above the shoulder) ─────────────────────────────
const RX0 = -120, RX1 = 120, RY0 = -100, RY1 = -34, RNX = 56, RNY = 18;
const ridgeZ = (x, y) => {
  const depth = (RY1 - y) / (RY1 - RY0);                                  // 0 near lake → 1 far
  const h = fbm(x * 1.6, y * 1.2) * (18 + 58 * depth) - 3;
  return Math.max(0, h);
};
const ROCK = [0.11, 0.13, 0.20], SNOW = [0.80, 0.85, 0.94];
for (let j = 0; j < RNY; j++) for (let i = 0; i < RNX; i++) {
  const xa = RX0 + ((RX1 - RX0) * i) / RNX, xb = RX0 + ((RX1 - RX0) * (i + 1)) / RNX;
  const ya = RY0 + ((RY1 - RY0) * j) / RNY, yb = RY0 + ((RY1 - RY0) * (j + 1)) / RNY;
  const p00 = [xa, ya, ridgeZ(xa, ya)], p10 = [xb, ya, ridgeZ(xb, ya)], p11 = [xb, yb, ridgeZ(xb, yb)], p01 = [xa, yb, ridgeZ(xa, yb)];
  const zc = (p00[2] + p10[2] + p11[2] + p01[2]) / 4;
  const snow = Math.max(0, Math.min(1, (zc - 11) / 10));
  const n = norm3(cross3(sub3(p10, p00), sub3(p01, p00)));
  faces.push({ corners: [p00, p10, p11, p01], fill: lambert(n, mix(ROCK, SNOW, snow), 0.22) });
}
// dark conifer band at the far shore
for (let i = 0; i < 40; i++) {
  const xa = RX0 + ((RX1 - RX0) * i) / 40, xb = RX0 + ((RX1 - RX0) * (i + 1)) / 40;
  const h = 2.2 + 2.4 * hash2(i, 9);
  quad([xa, -34, 0], [xb, -34, 0], [xb, -33.4, h], [xa, -33.4, h], [0.03, 0.07, 0.06]);
}

// ── the water ────────────────────────────────────────────────────────────────────────────────
// reservoir behind the wall: high, calm, near-black (Gerstner, tiny amplitude)
const reservoir = {
  grid: { w: 130, d: 32.5, nx: 160, ny: 44, cx: 0, cy: -16.9, cz: 8.2 },
  // the walls, mapped: the sheet sinks inside these footprints (dam strip + both banks),
  // so the high water stands AGAINST the wall instead of passing through the solids.
  masks: [
    [X0 - 0.9, X0 + SPAN + 0.9, -3.6, 2.4],
    [-90, X0, -14.5, 2.4],
    [X0 + SPAN, 90, -14.5, 2.4],
  ],
  waves: [
    { dx: 0.94, dy: 0.34, A: 0.10, k: 0.55, om: 0.7, ph: 0.4, Q: 0.3 },
    { dx: -0.71, dy: 0.71, A: 0.06, k: 0.9, om: 1.0, ph: 2.6, Q: 0.3 },
  ],
  amax: 0.16, sun: [-24, 30, 60],
  deep: [0.012, 0.03, 0.08], surf: [0.03, 0.07, 0.15], crest: [0.30, 0.38, 0.55],
};
// tailrace: the split-experiment mix — every gate mouth is a coherent point source and the
// downstream churn is their interference fan, fading with distance (wavefield mode).
const gateCenters = Array.from({ length: GATES }, (_, g) => X0 + PIER_W + g * (GATE_W + PIER_W) + GATE_W / 2);
const tailrace = {
  grid: { w: 130, d: 58, nx: 150, ny: 80, cx: 0, cy: 9.6 + 58 / 2 - 0.5 },
  waves: [],
  sources: gateCenters.map((x) => [x, 8.4]),
  k: 1.5, om: 2.4, A: 0.18, decay: 0.05, barrierY: -100, amax: 0.22,
  sun: [-24, 30, 60],
  deep: [0.04, 0.09, 0.18], surf: [0.10, 0.19, 0.32], crest: [0.72, 0.80, 0.92],
};
// reservoir sits HIGH behind the dam (waterline near the sill) — lift it via faces? The surface
// grid deforms around z=0, so raise it with a static pedestal of dark faces just below the rim…
// simplest honest trick: emit the reservoir as its own surface and RAISE the whole payload's
// reservoir grid by drawing it at z≈SILL-1 — the channel has no z-offset, so instead the wall
// hides the tailwater level difference; the reservoir stays at z=0 and reads as the lake beyond.

const payload = {
  title: 'mojulo spillway — night',
  bg: '#0d1b36',
  faces,
  surfaces: [reservoir, tailrace],
  bounds: { minX: -120, maxX: 120, minY: -100, maxY: 70, minZ: 0, maxZ: 40 },
  cameras: [
    { name: 'photo', worldFraming: { cameraPosition: [12, 54, 13], lookAt: [0, -30, 11], horizontalFov: 58 } },
    { name: 'aerial', worldFraming: { cameraPosition: [0, 66, 42], lookAt: [0, -8, 4], horizontalFov: 64 } },
    { name: 'side', worldFraming: { cameraPosition: [-58, 26, 9], lookAt: [0, 2, 6], horizontalFov: 62 } },
  ],
};

const html = emitThreeWorld({ ...payload, inline: true });
const htmlPath = OUT.replace(/\.png$/, '.html');
writeFileSync(htmlPath, html);
console.log('wrote', htmlPath);

const browser = await puppeteer.launch({ executablePath: await resolveChromium(), headless: true, args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const page = await browser.newPage();
await page.setViewport({ width: 1120, height: 700, deviceScaleFactor: 2 });
await page.goto('file://' + htmlPath, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3200));
await page.evaluate(() => { for (const s of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(s)) e.style.display = 'none'; });
writeFileSync(OUT, Buffer.from(await page.screenshot({ type: 'png' })));
// second angle: aerial
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'aerial'); b?.click(); });
await new Promise((r) => setTimeout(r, 1600));
await page.evaluate(() => { for (const s of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(s)) e.style.display = 'none'; });
writeFileSync(OUT.replace(/\.png$/, '-aerial.png'), Buffer.from(await page.screenshot({ type: 'png' })));
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'side'); b?.click(); });
await new Promise((r) => setTimeout(r, 1600));
await page.evaluate(() => { for (const s of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(s)) e.style.display = 'none'; });
writeFileSync(OUT.replace(/\.png$/, '-side.png'), Buffer.from(await page.screenshot({ type: 'png' })));
await browser.close();
console.log('wrote', OUT);
