// Runnability: what a World page asks of Chrome, measured the same on any machine (docs/runnability.md). It opens the
// page in headless Chrome, hooks WebGL2 and counts what one frame asks for (draw calls, triangles over every pass) and
// what the page holds (shader programs, texture and buffer bytes, JS heap), with its size and its time to first frame.
// The counts are exact anywhere; the times are only comparable between runs on one machine (here, often software GL).
//
//   node scripts/runnability.mjs <page.html> [--cams cams.json] [--view pov|aerial] [--json]
//
// --cams: [{ name, pos:[x,y,z], target:[x,y,z], vfov }] driven through the page's capture bridge (a page emitted with
// `capture: true`); without it, the page's own view is counted over its live loop. --view sets the form grass's camera
// mode (window.__formGrassView) before counting.
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('./mcp-stdio-loader.mjs', import.meta.url);
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!file) { console.error('usage: node scripts/runnability.mjs <page.html> [--cams cams.json] [--view pov|aerial] [--json]'); process.exit(2); }
const page0 = path.resolve(process.env.INIT_CWD || process.cwd(), file), cams = flag('--cams') ? JSON.parse(readFileSync(path.resolve(process.env.INIT_CWD || process.cwd(), flag('--cams')), 'utf8')) : null;

const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

// (the hooks: every draw counted with its triangles, every program linked, every byte uploaded to a texture or a buffer)
function hooks() {
  const S = (window.__run = { tri: 0, draws: 0, programs: 0, tex: 0, buf: 0, ticks: 0 }), P = WebGL2RenderingContext.prototype;
  const wrap = (n, f) => { const o = P[n]; P[n] = function (...a) { f(a); return o.apply(this, a); }; };
  wrap('drawElementsInstanced', (a) => { S.draws++; if (a[0] === 4) S.tri += (a[1] / 3) * a[4]; });
  wrap('drawArraysInstanced', (a) => { S.draws++; if (a[0] === 4) S.tri += (a[2] / 3) * a[3]; });
  wrap('drawElements', (a) => { S.draws++; if (a[0] === 4) S.tri += a[1] / 3; });
  wrap('drawArrays', (a) => { S.draws++; if (a[0] === 4) S.tri += a[2] / 3; });
  wrap('linkProgram', () => { S.programs++; });
  wrap('bufferData', (a) => { const d = a[1]; S.buf += typeof d === 'number' ? d : d && d.byteLength ? d.byteLength : 0; });
  const bytes = (d) => (d && d.byteLength ? d.byteLength : 0);
  // (a texture's bytes: its data's, else its size at four bytes a texel, an upper bound for a render target)
  wrap('texImage2D', (a) => { S.tex += a.length >= 9 ? bytes(a[8]) || a[3] * a[4] * 4 : a[5] && a[5].width ? a[5].width * a[5].height * 4 : 0; });
  wrap('texImage3D', (a) => { S.tex += bytes(a[9]) || a[3] * a[4] * a[5] * 4; });
  wrap('texStorage2D', (a) => { S.tex += a[3] * a[4] * 4; });
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f) => raf((t) => { S.ticks++; f(t); });
}

const browser = await launchChromium({ executablePath: await resolveChromium(), headless: true, args: [...CHROMIUM_WEBGL_ARGS, '--enable-precise-memory-info'], protocolTimeout: 600000 });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.evaluateOnNewDocument(hooks);
  const t0 = Date.now();
  await page.goto('file://' + page0, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await page.waitForFunction(() => window.__mojCapture ? window.__mojCapture.ready : window.__run.ticks > 2, { timeout: 600000 });
  await page.waitForFunction(() => window.__formReady, { timeout: 60000 }).catch(() => {});
  const readyS = (Date.now() - t0) / 1000;
  if (flag('--view')) await page.evaluate((v) => window.__formGrassView && window.__formGrassView(v), flag('--view'));
  const frames = [];
  if (cams) {
    for (const c of cams) frames.push(await page.evaluate(async (cam) => {
      window.__mojCapture.frame(cam); await new Promise((r) => setTimeout(r, 1500));
      const S = window.__run; S.tri = 0; S.draws = 0; window.__mojCapture.frame(cam);
      return { cam: cam.name, draws: S.draws, tri: Math.round(S.tri) };
    }, c));
  } else {
    frames.push(await page.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 1500));
      const S = window.__run; S.tri = 0; S.draws = 0; S.ticks = 0; await new Promise((r) => setTimeout(r, 2000));
      const n = Math.max(1, S.ticks); return { cam: 'live', draws: Math.round(S.draws / n), tri: Math.round(S.tri / n) };
    }));
  }
  const held = await page.evaluate(() => ({ programs: window.__run.programs, texMB: +(window.__run.tex / 1e6).toFixed(1), bufMB: +(window.__run.buf / 1e6).toFixed(1),
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(1) : null }));
  const R = { page: path.basename(page0), view: flag('--view') || 'default', pageMB: +(statSync(page0).size / 1e6).toFixed(1), readyS, ...held, frames,
    worst: { tri: Math.max(...frames.map((f) => f.tri)), draws: Math.max(...frames.map((f) => f.draws)) } };
  if (args.includes('--json')) console.log(JSON.stringify(R));
  else {
    console.log(`${R.page} (${R.view}): ${R.pageMB} MB, first frame ${R.readyS.toFixed(1)} s, ${R.programs} programs, textures ≤ ${R.texMB} MB, buffers ${R.bufMB} MB, heap ${R.heapMB} MB`);
    for (const f of frames) console.log(`  ${f.cam.padEnd(12)} ${(f.tri / 1e6).toFixed(2)}M triangles  ${f.draws} draws`);
    if (!cams && !frames[0].draws) console.log('  (the page drew nothing while idle: emit it with capture and pass --cams)');
  }
} finally {
  await browser.close();
}
