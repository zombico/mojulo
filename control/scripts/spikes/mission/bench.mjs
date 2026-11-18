/**
 * BENCH — what a played page costs a frame, compared page against page on one machine: each page opened in headless
 * Chromium at the same window, left to settle (its pixel budget finds its density), then its frames timed over a
 * stretch and one frame's work counted (triangles, draws). Every page's pixel budget is held at a density of 1. The software renderer (SwiftShader) is far slower than a
 * GPU, so the milliseconds are a RELATIVE yardstick: a page twice another's here is about twice it on a laptop's GPU
 * too, where the pixels and the triangles are what costs. The person's own frame readout is the absolute one.
 *
 *   node scripts/spikes/mission/bench.mjs <page.html> [<page.html> …] [--size 1120x780] [--settle 20] [--for 20] [--dpr 1 | page]
 *
 * `--dpr page` leaves each page its own density cap (its `density`), so what a page's cap saves is measured; else 1.
 *
 * Prints, per page: frame ms (mean over the stretch), the density it settled at, triangles and draws a frame.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'));
const args = process.argv.slice(2), flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const pages = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const [W, H] = flag('--size', '1120x780').split('x').map(Number), settle = +flag('--settle', 20), span = +flag('--for', 20), dprPin = flag('--dpr', '1');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

const hooks = (dprPin) => {
  // (the page's pixel budget held at one density, so every page is timed at the same pixels: its slow frames would
  // otherwise lower one page's and not another's)
  if (dprPin !== 'page') Object.defineProperty(window, '__mojBudget', { configurable: true, get() { return this.__benchB; }, set(v) { Object.defineProperty(v, 'dpr', { get: () => +dprPin, set() {} }); this.__benchB = v; } });
  // (the draws are counted by wrapping WebGL's own calls only after the frames are timed: wrapped, every frame is slower)
  const S = (window.__bench = { tri: 0, draws: 0, on: false, frames: [] });
  S.count = () => { const P = WebGL2RenderingContext.prototype, tri = (m, c, n) => (m === 4 ? c / 3 : m === 5 || m === 6 ? c - 2 : 0) * (n || 1);
    for (const [k, f] of [['drawElements', (a) => tri(a[0], a[1])], ['drawArrays', (a) => tri(a[0], a[2])], ['drawElementsInstanced', (a) => tri(a[0], a[1], a[4])], ['drawArraysInstanced', (a) => tri(a[0], a[2], a[3])]]) {
      const o = P[k]; P[k] = function (...a) { if (S.on) { S.tri += f(a); S.draws++; } return o.apply(this, a); };
    } };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (fn) => raf((t) => { S.frames.push(t); fn(t); });
};

// (each page in a browser of its own: one opened after another in the same browser runs slower for what the first left)
for (const file of pages) {
  const browser = await launchChromium({ executablePath: await resolveChromium(), headless: true, args: [...CHROMIUM_WEBGL_ARGS], protocolTimeout: 1800000 });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H });
    await page.evaluateOnNewDocument(hooks, dprPin);
    await page.goto('file://' + path.resolve(process.env.INIT_CWD || process.cwd(), file), { timeout: 1800000 });
    await page.waitForFunction(() => window.__mojCtrl && window.__bench.frames.length > 2, { timeout: 1800000 });
    await new Promise((r) => setTimeout(r, settle * 1000));
    const R = await page.evaluate(async (span) => {
      const S = window.__bench, n0 = S.frames.length;
      await new Promise((r) => setTimeout(r, span * 1000));
      // (a frame once: a page runs several animation loops, the game's, its HUD's, its readouts', each called with the
      // frame's own timestamp, so the callbacks are counted by their distinct timestamps; counted each, a page with more
      // loops read faster than it ran)
      const F = [...new Set(S.frames.slice(n0))], ms = F.length > 1 ? (F[F.length - 1] - F[0]) / (F.length - 1) : NaN;
      // (one frame's work: counted between two frames)
      S.count();
      await new Promise((r) => requestAnimationFrame(() => { S.tri = 0; S.draws = 0; S.on = true; requestAnimationFrame(() => { S.on = false; r(); }); }));
      return { ms, frames: F.length, dpr: window.__mojBudget ? window.__mojBudget.dpr : null, tri: S.tri, draws: S.draws };
    }, span);
    console.log(`${path.basename(path.dirname(file))}/${path.basename(file)}: ${R.ms.toFixed(0)} ms a frame (${R.frames} frames) · dpr ${R.dpr ?? '—'} · ${(R.tri / 1e6).toFixed(2)}M triangles · ${R.draws} draws`);
    await page.close();
  } finally { await browser.close(); }
}
