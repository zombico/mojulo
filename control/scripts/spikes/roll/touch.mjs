// SPIKE roll, in the hand: the exported course level played by TOUCH alone. The level page is opened as a phone holds
// it (`?touch=1`), and a bot plays it with the gestures a thumb makes on the touch layer: a swipe left or right to take
// the next track over, a tap to jump. It never presses a key and never holds forward: the hero runs by itself.
//   MOJULO_CHROMIUM=/path/to/chrome node scripts/spikes/roll/touch.mjs --game /abs/dir/dash-run [--seeds 101,102,103]
process.env.SQLITE_PATH = ':memory:'; process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { register } from 'node:module';
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const dir = path.resolve(opt('--game', 'dash-run')), seeds = String(opt('--seeds', '101,102,103')).split(',').map(Number);
register(new URL('../../mcp-stdio-loader.mjs', import.meta.url));
const at = (p) => new URL(`../../../${p}`, import.meta.url).href;
const { courseOfLevel, courseObstacles } = await import(at('lib/graph/gameworld/roll-course.js'));
const { launchChromium, resolveChromium, CHROMIUM_WEBGL_ARGS } = await import(at('lib/graph/scene/chromium.js'));
const lv = (await fs.readdir(path.join(dir, 'levels')))[0], ref = lv.replace(/\.html$/, '');
let M = JSON.parse(await fs.readFile(path.join(dir, 'recipe', `${ref}.json`), 'utf8')); M = M.manifest ?? M;
const course = courseOfLevel(M), P = course.pace;
const server = http.createServer(async (req, res) => { try { const f = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname)); const b = await fs.readFile(f); res.writeHead(200, { 'content-type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); } });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// THE THUMB, in the page: the reaction bot's policy, its hands the touch layer's own pointer events
const thumb = (C) => {
  const w = window.__mojCtrl.world, me = w.byId[w.pilotId], zone = document.querySelector('#moj-touch .z');
  const ev = (type, x, y) => zone.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true }));
  zone.setPointerCapture = () => {}; zone.releasePointerCapture = () => {};
  const cx = innerWidth / 2, cy = innerHeight * 0.7;
  const swipe = (d) => { ev('pointerdown', cx, cy); ev('pointermove', cx + d * 70, cy); ev('pointerup', cx + d * 70, cy); };
  const tap = () => { ev('pointerdown', cx, cy); ev('pointerup', cx, cy); };
  const S = window.__thumb = { done: false, hits: 0, swipes: 0, taps: 0, t0: w.time || 0 }, seen = {}, pressed = {};
  let prev = me.transform.pos[1], last = w.time || 0, fast = false, lastSwipe = -1;
  const tick = () => {
    const now = w.time || 0, dt = now - last; last = now;
    if (!(dt > 0)) { requestAnimationFrame(tick); return; }
    const [x, y] = me.transform.pos, t = now - S.t0, v = (y - prev) / dt; prev = y;
    S.y = y; S.x = x; S.seconds = t; S.lane = window.__mojTouch.lane();
    if (y > C.exit) { S.done = true; return; }
    let next = null;
    for (const o of C.obs) {
      if (y > o.y1 + 0.4) continue;
      if (seen[o.k] === undefined && o.y0 - y <= C.sight) seen[o.k] = t;
      if (seen[o.k] === undefined || t < seen[o.k] + C.react) continue;
      if (!next) next = o;
    }
    if (next && next.ask === 'steer') { const want = C.lanes.indexOf(next.open), have = window.__mojTouch.lane(); if (want !== have && t - lastSwipe > 0.12) { swipe(Math.sign(want - have)); S.swipes++; lastSwipe = t; } }
    if (next && next.ask === 'jump' && !pressed[next.k] && next.y0 - y <= C.lead[next.id] * Math.max(v, 3) && me.grounded !== false) { pressed[next.k] = true; tap(); S.taps++; }
    if (v > 0.7 * C.top) fast = true;
    if (fast && v < 0.5 * C.top) { const o = C.obs.find((q) => y > q.y0 - 1.5 && y < q.y1 + 1); if (o) { S.hits++; fast = false; } }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const out = [];
for (const seed of seeds) {
  const browser = await launchChromium({ executablePath: await resolveChromium(), headless: true, args: CHROMIUM_WEBGL_ARGS });
  const page = await browser.newPage(); await page.setViewport({ width: 450, height: 800, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`http://127.0.0.1:${server.address().port}/levels/${lv}?seed=${seed}&touch=1`);
  await page.waitForFunction(() => window.__mojRoll && window.__mojCtrl && window.__mojHud && window.__mojTouch, { timeout: 120000 });
  const layer = await page.evaluate(() => ({ on: window.__mojTouch.on(), layout: window.__mojTouch.layout, hint: window.__mojTouch.hint, keys: Object.keys(window).filter((k) => k === '__held').length }));
  for (let i = 0; i < 80 && await page.evaluate(() => !!window.__mojMenuOpen || !window.__mojHud.state.moments.length); i++) await wait(100);
  const obs = courseObstacles(course, seed);
  await page.evaluate(thumb, { obs, exit: course.exit[1], sight: course.sight, react: course.react, top: P.top, lanes: [-2, 0, 2], lead: Object.fromEntries(Object.entries(P.lead).map(([id, l]) => [id, l.mid])) });
  let S = null, shot = false;
  for (let i = 0; i < 900; i++) { await wait(200); S = await page.evaluate(() => ({ ...window.__thumb, coins: window.__mojHud.state.coins.count })); if (S.done) break; if (!shot && S.y > obs[1].y0 - 12 && opt('--out', null)) { shot = true; await page.screenshot({ path: path.join(path.resolve(opt('--out')), `touch-${seed}.png`) }); } }
  out.push({ seed, layer: layer.layout.course ? 'course' : JSON.stringify(layer.layout), on: layer.on, hint: layer.hint, finished: !!S?.done, reached: S?.y && +S.y.toFixed(1), of: course.exit[1], seconds: S?.seconds && +S.seconds.toFixed(1), hits: S?.hits, swipes: S?.swipes, taps: S?.taps, coins: S?.coins, errors });
  await browser.close();
}
server.close();
for (const o of out) console.log(JSON.stringify(o));
process.exit(0);
