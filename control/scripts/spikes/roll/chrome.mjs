// SPIKE roll, the Chrome half: the level page in a stand-in shell that answers game-ready after a delay. Does the seed
// arrive; is the level shown only once it is rolled; are the walls rolled away out of the scene; does Chrome roll as
// Node does?
//   MOJULO_CHROMIUM=/path/to/chrome node scripts/spikes/roll/chrome.mjs --out /abs/dir [--seeds 3]
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { spikeLevel } from './level.mjs';
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { rollOf } = await import('../../../lib/graph/game/level-sim.js');
const { launchChromium, resolveChromium, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const out = path.resolve(opt('--out', 'roll-spike')), nSeeds = Number(opt('--seeds', 3));
const L = await spikeLevel(), ROLL = L.payload.roll;
const html = emitThreeWorld({ ...L.payload, wireframe: false, walk: true, spin: false, decollide: true, hud: false, inline: true, cdn: false });
const host = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style>
<iframe id="f" src="level.html"></iframe><script>
const q = new URLSearchParams(location.search), delay = Number(q.get('delay') || 0), seed = Number(q.get('seed') || 1);
window.__t = { t0: performance.now() };
addEventListener('message', (e) => {
  const d = e.data; if (!d || !d.moj) return;
  if (d.moj === 'game-ready') { __t.ready = performance.now() - __t.t0; setTimeout(() => { __t.init = performance.now() - __t.t0; f.contentWindow.postMessage({ moj: 'game-init', contractVersion: d.contractVersion, params: {}, seed }, '*'); }, delay); }
  if (d.moj === 'game-shown') { __t.shown = performance.now() - __t.t0; __t.rolledAtShown = !!f.contentWindow.__mojRoll; }
});
</script>`;
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, 'level.html'), html);
await fs.writeFile(path.join(out, 'host.html'), host);

const server = http.createServer(async (req, res) => { try { const body = await fs.readFile(path.join(out, decodeURIComponent(new URL(req.url, 'http://x').pathname))); res.writeHead(200, { 'content-type': 'text/html' }); res.end(body); } catch { if (!res.headersSent) res.writeHead(404); res.end(); } });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const report = { page: { mb: +(html.length / 1e6).toFixed(1) }, runs: [] };
for (const [seed, delay] of [[1, 0], [1, 1000], ...Array.from({ length: nSeeds - 1 }, (_, k) => [k + 2, 0])]) {
  // (a browser a run: a page's build time changes once its files are cached)
  const browser = await launchChromium({ executablePath: await resolveChromium(), headless: true, args: CHROMIUM_WEBGL_ARGS });
  const page = await browser.newPage(); await page.setViewport({ width: 960, height: 540 });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`${base}/host.html?seed=${seed}&delay=${delay}`);
  await page.waitForFunction(() => window.__t && window.__t.shown !== undefined, { timeout: 120000 });
  const fr = page.frames().find((f) => f.url().endsWith('level.html'));
  // (turned to face the exit, so the shot looks down the line the walls stand across)
  const st = await fr.evaluate((exit) => { const w = window.__mojCtrl.world, p = w.byId[w.pilotId]; p.transform.heading = Math.atan2(exit[1] - p.transform.pos[1], exit[0] - p.transform.pos[0]); return { seed: window.__mojRoll.seed, stand: window.__mojRoll.stand, lay: window.__mojRoll.lay, start: window.__mojRoll.start, at: p.transform.pos.map((v) => Math.round(v * 10) / 10), standing: w.colliders.filter((c) => c.roll != null).length }; }, L.exit);
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(out, `seed${seed}-delay${delay}.png`) });
  const T = await page.evaluate(() => window.__t), node = rollOf(ROLL, seed);
  report.runs.push({ seed, delay, t: Object.fromEntries(['ready', 'init', 'shown'].map((k) => [k, Math.round(T[k])])), rolledSeed: st.seed, seedLost: st.seed !== seed, rolledWhenShown: T.rolledAtShown, stand: st.stand, standing: st.standing, lay: st.lay, start: st.start, at: st.at, sameAsNode: JSON.stringify([st.stand, st.lay, st.start]) === JSON.stringify([node.stand, node.lay, node.start]), errors });
  if (seed === 1 && !delay) {
    // exactness: the page's own dice against Node's over many seeds, small and large
    const seeds = [...Array.from({ length: 300 }, (_, k) => k + 1), 65535, 65536, 2147483647, 4294967295, 12345678901];
    const key = (r) => [r.stand.join(','), r.lay.join(','), r.start].join('|');
    const got = await fr.evaluate((ss) => ss.map((s) => { const r = window.__mojRoll.of(s); return [r.stand.join(','), r.lay.join(','), r.start].join('|'); }), seeds);
    report.exact = { seeds: seeds.length, unequal: seeds.filter((s, k) => key(rollOf(ROLL, s)) !== got[k]).length };
  }
  await browser.close();
}
server.close();
console.log(JSON.stringify(report, null, 1));
process.exit(0);
