// SPIKE roll, the Chrome half: the level page in a stand-in shell that answers game-ready after a delay. Is the level
// seen before its seed arrives; does a wall rolled away leave the scene with no shatter; does Chrome roll as Node does?
//   MOJULO_CHROMIUM=/path/to/chrome node scripts/spikes/roll/chrome.mjs --out /abs/dir [--seeds 3]
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { spikeLevel, buildRoll } from './level.mjs';
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { launchChromium, resolveChromium, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const out = path.resolve(opt('--out', 'roll-spike')), nSeeds = Number(opt('--seeds', 3));
const L = await spikeLevel(), { rollOf } = buildRoll();
const html = emitThreeWorld({ ...L.payload, wireframe: false, walk: true, spin: false, decollide: true, hud: false, inline: true, cdn: false });
// the roll, applied where a level's start is heard: the same kernel source, the runtime's own restore
const inject = `<script>(function () {
  var R = (${buildRoll.toString()})(), ROLL = ${JSON.stringify(L.roll)}, WALLS = ${JSON.stringify(Object.fromEntries(L.asks.map((a) => [a.id, a.blocks])))};
  window.__spikeRollOf = function (seed) { return R.rollOf(ROLL, seed); };

  (function hook() {
    if (!window.__mojGame || !window.__mojCtrl) return setTimeout(hook, 0);
    window.__mojGame.onStart(function (p, seed) {
      var r = R.rollOf(ROLL, seed);
      r.gone.forEach(function (w) { WALLS[w].forEach(function (id) { window.__mojCtrl.restore(id); }); });
      window.__spikeRoll = { seed: seed, stand: r.stand, at: performance.now(), by: /fallback/.test(new Error().stack) ? 'fallback' : 'init' };
    });
  })();
})();</script>`;
const host = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style>
<iframe id="f" src="level.html"></iframe><script>
const q = new URLSearchParams(location.search), delay = Number(q.get('delay') || 0), seed = Number(q.get('seed') || 1);
window.__t = { t0: performance.now() };
addEventListener('message', (e) => {
  const d = e.data; if (!d || !d.moj) return;
  if (d.moj === 'game-ready') { __t.ready = performance.now() - __t.t0; setTimeout(() => { __t.init = performance.now() - __t.t0; f.contentWindow.postMessage({ moj: 'game-init', contractVersion: d.contractVersion, params: {}, seed }, '*'); }, delay); }
  if (d.moj === 'game-shown') { __t.shown = performance.now() - __t.t0; __t.rolledAtShown = !!f.contentWindow.__spikeRoll; }
});
</script>`;
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, 'level.html'), html.replace('</body>', inject + '</body>'));
await fs.writeFile(path.join(out, 'host.html'), host);
if (!html.includes('</body>')) throw new Error('spike: the page has no </body> to inject before');

const server = http.createServer(async (req, res) => { try { const f = path.join(out, decodeURIComponent(new URL(req.url, 'http://x').pathname)); const body = await fs.readFile(f); res.writeHead(200, { 'content-type': 'text/html' }); res.end(body); } catch { if (!res.headersSent) res.writeHead(404); res.end(); } });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const report = { page: { mb: +(html.length / 1e6).toFixed(1) }, runs: [] };
for (const [seed, delay] of [[1, 0], [1, 1000], ...Array.from({ length: nSeeds - 1 }, (_, k) => [k + 2, 0])]) {
  // (a browser a run: a page's build time, and so the race below, changes once its files are cached)
  const browser = await launchChromium({ executablePath: await resolveChromium(), headless: true, args: CHROMIUM_WEBGL_ARGS });
  const page = await browser.newPage(); await page.setViewport({ width: 960, height: 540 });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`${base}/host.html?seed=${seed}&delay=${delay}`);
  await page.waitForFunction(() => window.__t && window.__t.shown !== undefined, { timeout: 120000 });
  const fr = page.frames().find((f) => f.url().endsWith('level.html'));
  await fr.waitForFunction(() => !!window.__spikeRoll, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: path.join(out, `seed${seed}-delay${delay}-rolled.png`) });
  const st = await fr.evaluate(() => { const w = window.__mojCtrl.world; return { roll: window.__spikeRoll, standing: w.breakables.filter((b) => !b.broken).length, hows: Array.from(new Set(w.breaks.map((b) => b.how))), breaks: w.breaks.length }; });
  const node = rollOf(L.roll, seed), T = await page.evaluate(() => window.__t);
  report.runs.push({ seed, delay, t: Object.fromEntries(['ready', 'init', 'shown'].map((k) => [k, Math.round(T[k])])), standingAfter: st.standing, breaks: st.breaks, hows: st.hows, rolledSeed: st.roll.seed, startedBy: st.roll.by, seedLost: st.roll.seed !== seed, rolledWhenShown: T.rolledAtShown, stand: st.roll.stand, sameAsNode: JSON.stringify(st.roll.stand) === JSON.stringify(node.stand), errors });
  if (seed === 1 && !delay) {
    // exactness: Chrome's roll against Node's over many seeds, small and large
    const seeds = [...Array.from({ length: 300 }, (_, k) => k + 1), 65535, 65536, 2147483647, 4294967295, 12345678901];
    const got = await fr.evaluate((ss) => ss.map((s) => window.__spikeRollOf(s).stand.join(',')), seeds);
    report.exact = { seeds: seeds.length, unequal: seeds.filter((s, k) => rollOf(L.roll, s).stand.join(',') !== got[k]).length };
  }
  await browser.close();
}
server.close();
console.log(JSON.stringify(report, null, 1));
process.exit(0);
