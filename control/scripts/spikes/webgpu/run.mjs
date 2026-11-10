// THE WEBGPU SPIKE, the run: today's gen-7 page and its renderer-swapped twin (to-webgpu.mjs), drawn in headless Chromium
// on SwiftShader (WebGL through ANGLE, WebGPU through Dawn's SwiftShader adapter), every camera of the page shot at the
// visual gate's size and scored by the visual gate's own arithmetic (compareImages: SSIM, ΔE2000), with each page's
// time to its first frame and its time a frame (the camera's frame() and the GPU's finish, over a run). SwiftShader is
// a CPU rasterizer: its times compare the two renderers on one machine, never say what a real GPU does (that is the
// hardware gate, the operator's Chrome: `--serve` keeps the server up and prints the two pages' URLs).
//
//   node scripts/spikes/webgpu/run.mjs [--page <today's page.html>] [--out <dir>] [--frames 20] [--shader stub|raw] [--ports sea]
//     [--legs webgl,webgpu] [--tag <name>] [--serve]
// A leg already shot (its PNGs in the out dir) is not shot again when it is left out of --legs; --tag names the WebGPU
// leg's files (webgpu-<tag>-<cam>.png) so a port's run sits beside the swap's.
// The page is emit.mjs's (`--era gen-7`); three's r184 WebGPU build is fetched once by `npm pack three@0.184.0` into the
// out dir (it is not vendored: the spike changes nothing in the tree).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href, pathToFileURL(`${CONTROL}/`).href);
const { toWebgpu, shimSource } = await import('./to-webgpu.mjs');
const { compareImages, decodeImage, GATE_SIZE, shotLine } = await import('../../../lib/graph/scene/visual-gate.js');
const { CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');
const puppeteer = (await import('puppeteer-core')).default;

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const outDir = path.resolve(arg('--out', 'spike-output/webgpu')), page = path.resolve(arg('--page', path.join(outDir, 'island-gen-7.html')));
const frames = Number(arg('--frames', 20)), shader = arg('--shader', 'stub'), serve = process.argv.includes('--serve');
const ports = (arg('--ports', '') || '').split(',').filter(Boolean), legsArg = (arg('--legs', 'webgl,webgpu')).split(','), tag = arg('--tag', ports.length ? `ported-${ports.join('+')}` : '');
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
const THREE_VERSION = '0.184.0', VENDOR = path.join(CONTROL, 'public/vendor/three');

// three's WebGPU build, the vendored release's
const pkg = path.join(outDir, `three-${THREE_VERSION}`), build = path.join(pkg, 'package/build');
if (!fs.existsSync(path.join(build, 'three.webgpu.min.js'))) {
  fs.mkdirSync(pkg, { recursive: true });
  execFileSync('npm', ['pack', `three@${THREE_VERSION}`, '--silent'], { cwd: pkg });
  execFileSync('tar', ['xzf', `three-${THREE_VERSION}.tgz`], { cwd: pkg });
}
for (const f of ['three.core.min.js']) if (!fs.readFileSync(path.join(build, f)).equals(fs.readFileSync(path.join(VENDOR, f)))) throw new Error(`${f} differs from the vendored tree: not the vendored release`);

const today = fs.readFileSync(page, 'utf8'), swapped = toWebgpu(today, { shader, ports });
const PAGES = { webgl: today, webgpu: swapped }, SHIM = shimSource({ shader });
const type = (f) => (f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream');
const server = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  const send = (body, t) => { r.writeHead(200, { 'content-type': t, 'cache-control': 'no-store' }); r.end(body); };
  if (u === '/webgl.html') return send(PAGES.webgl, 'text/html');
  if (u === '/webgpu.html') return send(PAGES.webgpu, 'text/html');
  if (u === '/vendor-gpu/shim.js') return send(SHIM, 'text/javascript');
  const file = u.startsWith('/vendor-gpu/') ? path.join(build, u.slice(12)) : u.startsWith('/vendor/three/') ? path.join(VENDOR, u.slice(14)) : null;
  if (!file || !fs.existsSync(file)) { r.writeHead(404); return r.end(); }
  send(fs.readFileSync(file), type(file));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const origin = `http://localhost:${server.address().port}`;
if (serve) { console.log(`today's page  ${origin}/webgl.html\nthe swapped   ${origin}/webgpu.html\n(ctrl-c to stop)`); await new Promise(() => {}); }

const exe = process.env.MOJULO_CHROMIUM || '/opt/pw-browsers/chromium';
const LEGS = { webgl: [...CHROMIUM_WEBGL_ARGS], webgpu: [...CHROMIUM_WEBGL_ARGS, '--enable-unsafe-webgpu'] };
const results = {};
const fileOf = (leg, cam) => path.join(outDir, `${leg === 'webgpu' && tag ? `webgpu-${tag}` : leg}-${cam}.png`);
const prior = fs.existsSync(path.join(outDir, 'report.json')) ? JSON.parse(fs.readFileSync(path.join(outDir, 'report.json'), 'utf8')) : null;
for (const leg of ['webgl', 'webgpu']) {
  if (!legsArg.includes(leg)) { if (prior && prior.results && prior.results[leg]) { results[leg] = prior.results[leg]; log(leg, 'from the prior report'); continue; } throw new Error(`no prior ${leg} leg to reuse`); }
  log(leg, 'launch');
  const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', ...LEGS[leg]], protocolTimeout: 900000 });
  const tab = await browser.newPage();
  await tab.setViewport({ width: GATE_SIZE.width, height: GATE_SIZE.height });
  const logs = [];
  tab.on('console', (m) => { if (['error', 'warn', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
  tab.on('pageerror', (e) => logs.push(`pageerror: ${String(e.message || e).slice(0, 300)}`));
  const t0 = Date.now();
  await tab.goto(`${origin}/${leg}.html`, { waitUntil: 'load', timeout: 600000 });
  let ready = true;
  // ready, or the first page error (a page that throws during its module never becomes ready: no use waiting it out)
  const failed = new Promise((ok) => tab.once('pageerror', () => ok('error')));
  try { ready = (await Promise.race([tab.waitForFunction('window.__mojCapture && window.__mojCapture.ready', { timeout: 600000, polling: 200 }).then(() => 'ready'), failed])) === 'ready'; } catch { ready = false; }
  const firstFrameMs = Date.now() - t0;
  log(leg, ready ? `ready in ${firstFrameMs} ms` : 'never ready', logs.slice(0, 5));
  const res = { leg, ready, firstFrameMs, logs, shots: {}, info: null };
  if (ready) {
    const cams = await tab.evaluate(() => (typeof CAMS === 'undefined' ? null : CAMS));
    // (the page's CAMS are module-scoped: read them off the page source instead)
    const C = cams || JSON.parse(today.match(/const CAMS = (\[.*?\]);\n/)[1]);
    for (const c of C) {
      await tab.evaluate((s) => window.__mojCapture.frame(s), { pos: c.pos, target: c.target, vfov: c.vfov, t: 0 });
      await tab.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
      const png = await (await tab.$('canvas')).screenshot({ type: 'png' });
      fs.writeFileSync(fileOf(leg, c.name), png);
      res.shots[c.name] = fileOf(leg, c.name); log(leg, 'shot', c.name);
    }
    // time a frame: the first camera, `frames` frames, each waited to the GPU's finish (WebGL: a pixel read; WebGPU: the
    // queue's submitted work done)
    res.frame = await tab.evaluate(async ({ c, n }) => {
      const cv = document.querySelector('canvas');
      const gl = cv.getContext('webgl2'), dev = window.__mojDevice;
      const finish = async () => { if (gl) { const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); } else if (dev) await dev.queue.onSubmittedWorkDone(); };
      const ts = [];
      for (let i = 0; i < n; i++) { const a = performance.now(); window.__mojCapture.frame({ pos: c.pos, target: c.target, vfov: c.vfov, t: i / 24 }); await finish(); ts.push(performance.now() - a); }
      ts.sort((x, y) => x - y);
      return { n, medianMs: ts[Math.floor(n / 2)], minMs: ts[0], maxMs: ts[n - 1], synced: gl ? 'readPixels' : dev ? 'onSubmittedWorkDone' : 'none' };
    }, { c: C[0], n: frames });
    log(leg, 'frame', JSON.stringify(res.frame));
    res.info = await tab.evaluate(() => ({ renderer: window.__mojRenderer || { drew: 'webgl' }, gaps: window.__mojGaps || null, ported: window.__mojPorted || [] }));
  }
  results[leg] = res;
  await browser.close();
}
server.close();

// score the swapped page's shots against today's
const scores = {};
for (const name of Object.keys(results.webgl.shots)) {
  if (!results.webgpu.shots[name]) continue;
  const a = decodeImage(fs.readFileSync(results.webgl.shots[name])), b = decodeImage(fs.readFileSync(results.webgpu.shots[name]));
  const s = compareImages(a, b);
  scores[name] = { ssim: s.ssim, deltaE: s.deltaE, blank: s.blank, worst: s.worst && { cell: s.worst.cell, deltaE: s.worst.deltaE }, line: shotLine({ name }, s) };
}
const report = { page, bytes: { today: today.length, swapped: swapped.length }, shader, ports, tag, results, scores };
fs.writeFileSync(path.join(outDir, tag ? `report-${tag}.json` : 'report.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ...report, results: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { ...v, shots: Object.keys(v.shots) }])) }, null, 1));
