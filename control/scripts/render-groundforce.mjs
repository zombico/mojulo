/**
 * Visual review of the ground force's units (lib/graph/groundforce/index.js): each card drawn as it is lit, from the front
 * quarter, the side and above the back quarter, beside a frame's height for scale (an assault frame stands some 8 m).
 * Drawn as SVG (the cards' faces are already lit), shot in headless Chromium. No database writes.
 *
 * From control/:
 *   node scripts/render-groundforce.mjs [--units gnat,turret] [--out <dir>]
 * Writes groundforce-<units>.png.
 */
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { GROUND_UNITS, GROUND_UNIT_IDS, unitFaces } = await import('../lib/graph/groundforce/index.js');
const { resolveChromium, launchChromium } = await import('../lib/graph/scene/chromium.js');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('out', path.join(os.tmpdir(), 'groundforce-renders')));
const units = arg('units', GROUND_UNIT_IDS.join(',')).split(',');
for (const u of units) if (!GROUND_UNITS[u]) throw new Error(`no unit '${u}' (${GROUND_UNIT_IDS.join(', ')})`);
mkdirSync(OUT, { recursive: true });

// (the views: the camera's bearing round the unit, from its front at 0, and its elevation)
const VIEWS = [{ name: 'front quarter', az: 35, el: 22 }, { name: 'side', az: 90, el: 6 }, { name: 'rear quarter, above', az: 215, el: 48 }];
const FRAME_H = 8;
function view(faces, az, el, W, H) {
  const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  // (screen right, screen up, and depth from the eye: the eye out along the bearing, raised by the elevation)
  const P = (c) => { const right = c[0] * ca - c[1] * sa, toward = c[0] * sa + c[1] * ca; return [right, c[2] * Math.cos(e) - toward * Math.sin(e), -(toward * Math.cos(e) + c[2] * Math.sin(e))]; };
  const proj = faces.map((f) => ({ f, pts: f.corners.map(P) }));
  let lo = [1e9, 1e9], hi = [-1e9, -1e9];
  for (const p of proj) for (const q of p.pts) { lo = [Math.min(lo[0], q[0]), Math.min(lo[1], q[1])]; hi = [Math.max(hi[0], q[0]), Math.max(hi[1], q[1])]; }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], FRAME_H * 1.15), k = (Math.min(W, H) * 0.8) / span, cx = (lo[0] + hi[0]) / 2, base = lo[1];
  const sx = (x) => W / 2 + (x - cx) * k, sy = (y) => H * 0.88 - (y - base) * k;
  proj.sort((A, B) => B.pts.reduce((s, q) => s + q[2], 0) / B.pts.length - A.pts.reduce((s, q) => s + q[2], 0) / A.pts.length);
  const polys = proj.map(({ f, pts }) => `<polygon points="${pts.map((q) => `${sx(q[0]).toFixed(1)},${sy(q[1]).toFixed(1)}`).join(' ')}" fill="${f.fill}" stroke="${f.fill}" stroke-width="0.6"/>`).join('');
  // (a frame's height beside it, at its foot)
  const rx = sx(hi[0]) + 24, ruler = `<line x1="${rx}" y1="${sy(base)}" x2="${rx}" y2="${sy(base + FRAME_H)}" stroke="#ffd060" stroke-width="2"/><text x="${rx + 6}" y="${sy(base + FRAME_H) + 12}" fill="#ffd060" font-size="11">8 m frame</text>`;
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1d2025"/><line x1="0" y1="${sy(base)}" x2="${W}" y2="${sy(base)}" stroke="#3a3f46"/>${polys}${ruler}</svg>`;
}

const W = 380, H = 300;
const rows = units.map((u) => {
  const U = GROUND_UNITS[u], faces = unitFaces(u);
  const cells = VIEWS.map((v) => `<figure>${view(faces, v.az, v.el, W, H)}<figcaption>${v.name}</figcaption></figure>`).join('');
  return `<section><h2>${U.label} <small>${u} · ${faces.length} faces · hit radius ${(U.size * 2.5).toFixed(1)} m${U.flies ? ' · flies' : ''}</small></h2><p>${U.reads}</p><div class="row">${cells}</div></section>`;
}).join('');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:18px;background:#121418;color:#dfe5ea;font:13px system-ui,sans-serif}h2{margin:6px 0 2px;font-size:16px}h2 small{color:#8c96a0;font-weight:400;font-size:12px}p{margin:0 0 8px;color:#aab4bd}.row{display:flex;gap:10px}figure{margin:0}figcaption{color:#8c96a0;font-size:11px;text-align:center}</style></head><body>${rows}</body></html>`;

const exe = await resolveChromium({ allowFetch: false });
const browser = await launchChromium({ executablePath: exe, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: W * 3 + 70, height: 80 + units.length * (H + 80), deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'load' });
const file = path.join(OUT, `groundforce-${units.join('-')}.png`);
await page.screenshot({ path: file, fullPage: true });
await browser.close();
console.log(file);
