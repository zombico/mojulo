#!/usr/bin/env node
// bout shot — frames of the bout page (bout.mjs's out dir) in headless Chromium, tiled into one labelled sheet, and the
// page's read of every exchange printed (what each punch lands on, the range, the glove off his head's height, its speed).
//
//   node control/scripts/spikes/fighter/bout-shot.mjs [--out dir] [--at '[-0.12,0,0.12,0.3]'] [--views side] [--cols 4]
//
//   --at     moments of each exchange, seconds from its contact (default: before, at, and two after)
//   --views  the views to shoot each moment in (side, three, behind, over, close)
//   --push   off: the frames without the pushbox (the knockback alone), to see what it keeps apart
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire, register } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
const sharp = createRequire(path.join(CONTROL, 'package.json'))('sharp');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import(pathToFileURL(path.join(CONTROL, 'lib/graph/scene/chromium.js')).href);
const { values: opt } = parseArgs({ options: { out: { type: 'string' }, at: { type: 'string', default: '[-0.12,0,0.12,0.3]' }, views: { type: 'string', default: 'side' }, cols: { type: 'string', default: '4' }, only: { type: 'string' }, push: { type: 'string', default: 'on' } } });
const out = path.resolve(opt.out ?? path.join(os.tmpdir(), 'bout')), moments = JSON.parse(opt.at), views = opt.views.split(','), cols = Number(opt.cols);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.glb': 'model/gltf-binary' };
const server = createServer((rq, rs) => {
  const rel = decodeURIComponent(new URL(rq.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html', file = path.resolve(out, rel);
  if (!file.startsWith(out + path.sep) || !existsSync(file) || !statSync(file).isFile()) { rs.writeHead(404).end(); return; }
  rs.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }); createReadStream(file).pipe(rs);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_WEBGL_ARGS });
const logs = [];
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', (e) => logs.push(e.message));
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.bout, { timeout: 120000 }).catch(() => { throw new Error(`bout shot: the page never started: ${logs.join(' | ') || 'no console errors'}`); });
  const ex = await page.evaluate(() => window.bout.exchanges);
  for (const X of ex) console.log(`${X.label.padEnd(14)} ${X.miss ? 'miss' : `lands on ${X.part.padEnd(14)} range ${(X.range * 100).toFixed(0)} cm  glove ${(X.headUp * 100).toFixed(0)} cm off his head's height  ${X.speed.toFixed(1)} m/s  → ${X.react}${X.blocked ? ' (blocked)' : ''}  bodies ${X.overlapRaw > 0 ? `${(X.overlapRaw * 100).toFixed(0)} cm into each other unpushed, pushed ${(X.pushed * 100).toFixed(0)} cm` : 'never meet'}${X.laws === false ? '  (its own checks failed on this body)' : ''}`}`);
  if (opt.push === 'off') await page.evaluate(() => window.bout.pushbox(false));
  mkdirSync(path.join(out, 'shots'), { recursive: true });
  const tiles = [], only = opt.only ? opt.only.split(',') : null;
  for (const [i, X] of ex.entries()) {
    if (only && !only.includes(X.label) && !only.includes(X.attack)) continue;
    for (const v of views) for (const m of moments) {
      await page.evaluate(({ i, v, m }) => { window.bout.exchange(i); window.bout.view(v); window.bout.seek(window.bout.contact() + m); }, { i, v, m });
      await new Promise((r) => setTimeout(r, 300));
      const png = await (await page.$('#stage')).screenshot({ type: 'png' }), label = `${X.label} · ${v} · ${m === 0 ? 'contact' : `${m > 0 ? '+' : ''}${m.toFixed(2)} s`}${opt.push === 'off' ? ' · no pushbox' : ''}`;
      writeFileSync(path.join(out, 'shots', `${tiles.length.toString().padStart(2, '0')}-${label.replace(/[^a-z0-9.+-]+/gi, '-')}.png`), png); tiles.push({ png, label });
    }
  }
  const W = 480, H = 300, cap = 26, rows = Math.ceil(tiles.length / cols), comps = [];
  for (const [i, T] of tiles.entries()) {
    const x = (i % cols) * W, y = Math.floor(i / cols) * (H + cap);
    comps.push({ input: await sharp(T.png).resize(W, H, { fit: 'contain', background: '#d9d7d1' }).toBuffer(), left: x, top: y });
    comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${cap}"><text x="8" y="18" font-family="monospace" font-size="14" fill="#1d1f22">${T.label.replace(/[&<>]/g, '')}</text></svg>`), left: x, top: y + H });
  }
  const sheet = path.join(out, 'shots', 'sheet.png');
  await sharp({ create: { width: W * Math.min(cols, tiles.length), height: rows * (H + cap), channels: 3, background: '#ecebe7' } }).composite(comps).png().toFile(sheet);
  console.log(sheet);
  if (logs.length) console.error(`console errors: ${logs.slice(0, 5).join(' | ')}`);
} finally { await browser.close(); server.close(); }
