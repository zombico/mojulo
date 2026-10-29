#!/usr/bin/env node
// hero-live shot — frames of the live page (live.mjs's out dir) in headless Chromium, tiled into one labelled sheet an
// agent can Read: each frame a variant, a take, a view and a moment of the take (paused there, so a frame is repeatable),
// optionally with morphs held by hand or the wireframe and the bones on. The page is served from the out dir on loopback.
//
//   node .claude/skills/hero-live/shot.mjs [--out dir] [--shots '<json>'] [--cols n]
//
//   --out    live.mjs's out dir (default <tmp>/hero-live); writes shots/sheet.png and one PNG per frame
//   --shots  a list of { variant?, label?, take?, view?: 'vFace'|'vBust'|'vBody'|'vSide'|'vBodySide'|'vBack'|'vMouth', phase?: 0 … 1,
//            hold?: { morph: w }, look?: { bone, from?: [x, y, z], dist?, fov?, off?: [x, y, z] } (a closeup on a bone's head
//            as posed, `off` metres from it in the world: foreArmR the elbow) | { az, el, dist, at, fov } (a free camera: az
//            degrees round from the front, el up), wire?: bool, bones?: bool }; default, per variant, the first take at
//            mid-phase, face and full body
//   --cols   frames per row of the sheet (default 4)
//
// Needs a Chromium (lib/graph/scene/chromium.js resolves and launches it; MOJULO_CHROMIUM names one it does not find); a
// page that never loads names its console errors.
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire, register } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../control');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
const req = createRequire(path.join(CONTROL, 'package.json'));
const sharp = req('sharp');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import(pathToFileURL(path.join(CONTROL, 'lib/graph/scene/chromium.js')).href);

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i += 2) opt[argv[i].replace(/^--/, '')] = argv[i + 1];
const out = path.resolve(opt.out ?? path.join(os.tmpdir(), 'hero-live')), cols = Number(opt.cols ?? 4);
if (!existsSync(path.join(out, 'index.html'))) throw new Error(`hero-live shot: no index.html in ${out} (run live.mjs first)`);

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const server = createServer((rq, rs) => {
  const rel = decodeURIComponent(new URL(rq.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html', file = path.resolve(out, rel);
  if (!file.startsWith(out + path.sep) || !existsSync(file) || !statSync(file).isFile()) { rs.writeHead(404).end(); return; }
  rs.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }); createReadStream(file).pipe(rs);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_WEBGL_ARGS });
const logs = [];
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); }); page.on('pageerror', (e) => logs.push(e.message));
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction(() => window.heroLive, { timeout: 60000 }).catch(() => { throw new Error(`hero-live shot: the page never started: ${logs.join(' | ') || 'no console errors'}`); });
  await page.evaluate(() => window.heroLive.ready);
  const M = await page.evaluate(() => window.heroLive.manifest);
  const shots = opt.shots ? JSON.parse(opt.shots) : M.variants.flatMap((v) => [{ variant: v.id, view: 'vFace', phase: 0.5 }, { variant: v.id, view: 'vBody', phase: 0.5 }]);
  mkdirSync(path.join(out, 'shots'), { recursive: true });
  const tiles = [];
  for (const [i, S] of shots.entries()) {
    const label = await page.evaluate(async (S) => {
      const H = window.heroLive;
      if (S.variant) await H.variant(S.variant);
      H.set({ wire: !!S.wire, bones: !!S.bones });
      if (S.take) H.take(S.take);
      if (S.look && !S.look.bone) H.look(S.look); else H.view(S.view ?? 'vFace');
      H.seek(S.phase ?? 0.5);
      if (S.hold) H.hold(S.hold);
      // (a bone's closeup once the pose is set: it frames the bone as posed)
      if (S.look?.bone) H.look(S.look);
      const s = H.state(); return `${S.label ? `${S.label} · ` : ''}${s.variant} · ${s.take} · ${s.view.startsWith('v') ? s.view.slice(1) : s.view} · ${s.phase.toFixed(2)}${S.hold ? ' · held' : ''}`;
    }, S);
    await new Promise((r) => setTimeout(r, 400));
    const stage = await page.$('#stage'), png = await stage.screenshot({ type: 'png' });
    const file = path.join(out, 'shots', `${String(i).padStart(2, '0')}-${label.replace(/[^a-z0-9.]+/gi, '-')}.png`);
    writeFileSync(file, png); tiles.push({ png, label }); console.log(file);
  }
  // the sheet: the frames at half size, a caption under each
  const W = 480, Hh = 360, cap = 26, rows = Math.ceil(tiles.length / cols);
  const comps = [];
  for (const [i, T] of tiles.entries()) {
    const x = (i % cols) * W, y = Math.floor(i / cols) * (Hh + cap);
    comps.push({ input: await sharp(T.png).resize(W, Hh, { fit: 'contain', background: '#d9d7d1' }).toBuffer(), left: x, top: y });
    const esc = T.label.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
    comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${cap}"><text x="8" y="18" font-family="monospace" font-size="14" fill="#1d1f22">${esc}</text></svg>`), left: x, top: y + Hh });
  }
  const sheet = path.join(out, 'shots', 'sheet.png');
  await sharp({ create: { width: W * Math.min(cols, tiles.length), height: rows * (Hh + cap), channels: 3, background: '#ecebe7' } }).composite(comps).png().toFile(sheet);
  console.log(sheet);
  if (logs.length) console.error(`console errors: ${logs.slice(0, 5).join(' | ')}`);
} finally { await browser.close(); server.close(); }
