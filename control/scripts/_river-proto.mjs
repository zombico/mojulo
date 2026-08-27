// PROTOTYPE — fluid capability for the landscape painter: a winding RIVER that flows one way, with the
// terrain naturally CARVED into a valley underneath it. Rolling fBm terrain (Lambert-shaded) + a carved
// channel following a winding centreline + the new surface-channel `river` mode (downstream flow).
//   node scripts/_river-proto.mjs <out.png>
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register(pathToFileURL('/Users/fombico/Documents/mojulo/control/scripts/mcp-stdio-loader.mjs').href);
import { writeFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const { emitThreeWorld } = await import('/Users/fombico/Documents/mojulo/control/lib/graph/scene/scene-three.js');
const { resolveChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('/Users/fombico/Documents/mojulo/control/lib/graph/scene/chromium.js');

const OUT = process.argv[2] || '/tmp/river.png';
const hex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('');
const norm3 = (v) => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const SUN = norm3([40, -70, 95]);

// ── deterministic value-noise fBm (rolling hills) ────────────────────────────────────────────
function hash2(ix, iy) { let h = (ix * 374761393 + iy * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}
function fbm(x, y) { let s = 0, a = 0.5, f = 0.035; for (let o = 0; o < 4; o++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }

// ── terrain + river geometry ─────────────────────────────────────────────────────────────────
const W = 160, H = 184;
const baseElev = (y) => 8 + (y / (H / 2)) * 10;                    // overall downhill: source +18 → mouth −2
const natural = (x, y) => baseElev(y) + (fbm(x + 120, y + 60) - 0.5) * 16;   // rolling ±8
const waterLevelAt = (y) => baseElev(y) - 5;                        // water sits 5 below the surrounding land

// winding centreline: source at +y (far/high) → mouth at −y (near/low); pts carry [x, y, waterLevel].
const NPTS = 64;
const riverX = (t) => 34 * Math.sin(6.283 * 1.15 * t + 0.4) + 15 * Math.sin(6.283 * 2.7 * t + 1.2);
const centre = Array.from({ length: NPTS }, (_, i) => { const t = i / (NPTS - 1), y = (H / 2) - t * H; return [riverX(t), y, waterLevelAt(y)]; });
function nearestC(x, y) {
  let best = 1e9, bl = 0;
  for (let i = 1; i < centre.length; i++) {
    const a = centre[i - 1], b = centre[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-6;
    let tt = ((x - a[0]) * dx + (y - a[1]) * dy) / L2; tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
    const px = a[0] + dx * tt, py = a[1] + dy * tt, dd = Math.hypot(x - px, y - py);
    if (dd < best) { best = dd; bl = a[2] + (b[2] - a[2]) * tt; }
  }
  return { dl: best, level: bl };
}
const CHAN = 11, VALLEY = 30, WDEPTH = 6;   // flat bed half-width, valley half-width, bed depth below water
function terrainZ(x, y) {
  const nat = natural(x, y), { dl, level } = nearestC(x, y), bed = level - WDEPTH;
  if (dl <= CHAN) return bed;                                       // flat river bed
  if (dl >= VALLEY) return nat;                                     // untouched land
  const u = (dl - CHAN) / (VALLEY - CHAN), s = u * u * (3 - 2 * u);
  const bankTarget = Math.max(nat, level + 2.5);                    // banks always rise above the water (no spill)
  return bed + (bankTarget - bed) * s;
}

// ── terrain faces (flat-shaded quads; grass / rock / sandy bank, Lambert-lit) ────────────────
const TX = 74, TY = 84, faces = [];
const GRASS = [0.30, 0.44, 0.19], ROCK = [0.44, 0.37, 0.28], SAND = [0.74, 0.66, 0.46];
for (let j = 0; j < TY; j++) for (let i = 0; i < TX; i++) {
  const xa = -W / 2 + W * i / TX, xb = -W / 2 + W * (i + 1) / TX, ya = -H / 2 + H * j / TY, yb = -H / 2 + H * (j + 1) / TY;
  const p00 = [xa, ya, terrainZ(xa, ya)], p10 = [xb, ya, terrainZ(xb, ya)], p11 = [xb, yb, terrainZ(xb, yb)], p01 = [xa, yb, terrainZ(xa, yb)];
  const n = norm3(cross3(sub3(p10, p00), sub3(p01, p00)));
  const shade = 0.4 + 0.6 * Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]);
  const xc = (xa + xb) / 2, yc = (ya + yb) / 2, zc = (p00[2] + p10[2] + p11[2] + p01[2]) / 4;
  const above = zc - waterLevelAt(yc), steep = 1 - n[2], dlc = nearestC(xc, yc).dl;
  // a narrow sandy strip right along the waterline; steep slopes are rock; everything else is grass.
  const base = (dlc < VALLEY - 5 && above < 2.2) ? SAND : (steep > 0.42 ? ROCK : GRASS);
  faces.push({ corners: [p00, p10, p11, p01], fill: hex([base[0] * shade, base[1] * shade, base[2] * shade]) });
}

// ── the river water — the new `river` surface mode over the terrain footprint ────────────────
const water = {
  grid: { w: W, d: H, nx: 104, ny: 118, cx: 0, cy: 0 },
  deep: [0.07, 0.30, 0.38], surf: [0.16, 0.50, 0.54], crest: [0.92, 0.97, 0.96],
  sun: [40, -70, 95], amax: 1,
  // leaves drifting downstream (drift = start fraction along the path; driftSpeed = units/s downstream).
  floaters: [{ x: 0, y: 0, r: 0.55, color: 0x6f8a38, drift: 0.05, driftSpeed: 8 }, { x: 0, y: 0, r: 0.5, color: 0x86a24a, drift: 0.4, driftSpeed: 8 }, { x: 0, y: 0, r: 0.5, color: 0x577a2e, drift: 0.72, driftSpeed: 8 }],
  // widened so the water fills the channel out to the rising banks (no "held-up" dry gap); the extra
  // width past the true waterline tucks under the terrain, so the banks themselves define the edge.
  river: { pts: centre, half: 17, bank: 30, flow: 8, amp: 0.5, lam: 11 },
};

const payload = {
  faces, surfaces: [water], bg: '#cfe6f2', glow: false,
  viewBox: { width: 1120, height: 780 },
  cameras: [{ name: 'valley', worldFraming: { cameraPosition: [40, -108, 66], lookAt: [-6, 8, 2], horizontalFov: 60 } }],
  title: 'mojulo river valley',
};

const html = emitThreeWorld({ ...payload, inline: true });
const htmlPath = OUT.replace(/\.png$/, '.html');
writeFileSync(htmlPath, html);
console.log('wrote', htmlPath, '(', faces.length, 'terrain faces )');

const browser = await puppeteer.launch({ executablePath: await resolveChromium(), headless: true, args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const page = await browser.newPage();
await page.setViewport({ width: 1120, height: 780, deviceScaleFactor: 2 });
await page.goto('file://' + htmlPath, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3200));
await page.evaluate(() => { for (const s of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(s)) e.style.display = 'none'; });
writeFileSync(OUT, Buffer.from(await page.screenshot({ type: 'png' })));
await browser.close();
console.log('wrote', OUT);
