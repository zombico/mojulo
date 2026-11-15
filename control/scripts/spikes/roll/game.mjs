// SPIKE roll, end to end: ONE ROLLED GAME through the agent's own doors and then through Chrome. A world whose one
// level is an obstacle course is designed (design_game), approved and run; a game is made over that level as a run that
// draws it again and again (create_game `run: { length, repeat: true }`); it is exported (export_game) and played in
// headless Chrome through its shell by a reaction bot that sees what the page rolled and presses the keys a player
// would. What it answers: does every map of the run differ, does each one play to its exit on the page's own runtime,
// and does the shell carry the run from its first screen to its result.
//   MOJULO_CHROMIUM=/path/to/chrome node scripts/spikes/roll/game.mjs --out /abs/dir [--maps 3] [--slots 8] [--screen phone]
process.env.SQLITE_PATH = ':memory:'; process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { register } from 'node:module';
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const out = path.resolve(opt('--out', 'roll-game')), maps = Number(opt('--maps', 3)), slots = Number(opt('--slots', 8)), screen = opt('--screen', null);
await fs.mkdir(out, { recursive: true });
process.env.MOJULO_OUTCOMES_DIR = out; process.env.MOJULO_DATA_DIR = out;
register(new URL('../../mcp-stdio-loader.mjs', import.meta.url));
const at = (p) => new URL(`../../../${p}`, import.meta.url).href;
const { designGameHandler } = await import(at('lib/mcp/tools/design-game.js'));
const { createGameHandler } = await import(at('lib/mcp/tools/create-game.js'));
const { exportGameHandler } = await import(at('lib/mcp/tools/export-game.js'));
const { SketchRepository } = await import(at('lib/db/repositories/sketches.js'));
const { courseOfLevel, courseObstacles } = await import(at('lib/graph/gameworld/roll-course.js'));
const { launchChromium, resolveChromium, CHROMIUM_WEBGL_ARGS } = await import(at('lib/graph/scene/chromium.js'));
const body = (r) => r?.structuredContent ?? r;
const clock = () => Number(process.hrtime.bigint() / 1000000n), t0 = clock(), report = { steps: [] };
const step = (name, more) => { report.steps.push({ step: name, at: `${((clock() - t0) / 1000).toFixed(1)} s`, ...more }); console.error(name, JSON.stringify(more ?? {}).slice(0, 300)); };

// 1. THE DESIGN: a world, a hero in the body its game reads, one level that is a course
// (its juice asked for: the effects' floor and the hero's movement juice for its game type. No grade: the daylight
// dress is as vivid as its gate lets it be, and a vivid grade over a pale way burns it white)
const world = { id: 'dash', name: 'Dash', feel: 'commuter-rail-runner', roll: true, juice: 'auto', ...(screen ? { screen } : {}),
  // (the hero's back is the first thing seen: a colour none of the asks wear, dark enough to stand on a pale way)
  characters: { direction: { tradition: 'anime', primary: 'speed', secondary: 'steel', body: 'game' }, hero: { looks: { colour: { palette: { Top: '#7b3fe4', Bottom: '#23283b', Shoes: '#ffffff', Trim: '#ffd23f' } } } } },
  levels: { one: { name: 'The Lane', obstacles: { slots } } }, start: 'one' };
const D = body(await designGameHandler({ world, ref: 'dash' }));
step('design_game', { ok: D.ok, error: D.error, next: (D.next ?? []).map((n) => n.step), roll: D.practice?.measured?.roll && { layout: D.practice.measured.roll.layout, says: D.practice.measured.roll.says } });
const waiting = [...new Set((body(await designGameHandler({ ref: 'dash', run: true })).ran ?? []).flatMap((r) => r.waiting ?? []).map((w) => w.replace(/ \(.*\)$/, '')))];
await designGameHandler({ ref: 'dash', approve: waiting });
const R = body(await designGameHandler({ ref: 'dash', run: true }));
step('run', { approved: waiting, ran: (R.ran ?? []).map((r) => `${r.key}:${r.action}`), error: R.error });
const levelRef = SketchRepository.list({ limit: 80 }).map((x) => x.ref).find((r) => /^dash-level-one/.test(r));
const M = SketchRepository.getByRef(levelRef).manifest, G = SketchRepository.getByRef('dash-game')?.manifest;

// 2. THE GAME: a run that draws the one level `maps` times
const made = body(await createGameHandler({ title: 'Dash', ref: 'dash-run', shell: 'play', ...(G?.store ? { store: G.store } : {}), ...(G?.ui ? { ui: G.ui } : {}), ...(M.screen ? { screen: M.screen } : {}), levels: [{ ref: levelRef, title: 'The Lane' }], run: { length: maps, repeat: true }, allow_unaudited: true }));
step('create_game', { ok: made.ok, error: made.error, run_note: made.run_note, rolls: (made.rolls ?? []).map((r) => ({ ref: r.ref, seeds: r.seeds, ok: r.ok, laws: r.laws.map((l) => `${l.law}: ${l.holds ? 'holds' : 'LOST'}: ${l.says}`) })) });
const ex = body(await exportGameHandler({ ref: 'dash-run' }));
const dir = path.join(out, 'dash-run');
step('export_game', { ok: ex.ok, error: ex.error, files: (await fs.readdir(dir)).join(' ') });

// 3. THE PLAY: the shell in Chrome, each map run by the bot
const course = courseOfLevel(M), P = course.pace;
const types = { '.html': 'text/html', '.json': 'application/json', '.wav': 'audio/wav', '.png': 'image/png', '.js': 'text/javascript', '.glb': 'model/gltf-binary' };
const server = http.createServer(async (req, res) => { try { const f = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname)); const b = await fs.readFile(f); res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); } });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await launchChromium({ executablePath: await resolveChromium(), headless: true, args: CHROMIUM_WEBGL_ARGS });
const page = await browser.newPage();
const portrait = !!M.screen && (M.screen === 'phone' || M.screen.pole === 'phone');
// (a small frame: this box draws in software, and the bot plays the better for every frame it gets)
const small = argv.includes('--small');
await page.setViewport(portrait ? (small ? { width: 270, height: 480 } : { width: 450, height: 800 }) : small ? { width: 560, height: 390 } : { width: 1120, height: 780 });
await page.evaluateOnNewDocument(() => { if (window.top === window) { window.__msgs = []; addEventListener('message', (e) => { if (e.data && e.data.moj) window.__msgs.push(e.data.moj + (e.data.result ? ':' + e.data.result : '')); }); } });
const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
await page.goto(`http://127.0.0.1:${server.address().port}/game.html`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 240));
const click = (re) => page.evaluate((src) => { const b = Array.from(document.querySelectorAll('button')).find((x) => new RegExp(src, 'i').test(x.textContent.trim())); if (b) b.click(); return b ? b.textContent.trim() : null; }, re);
const level = () => page.frames().find((f) => /levels\//.test(f.url()));
const seedNow = async () => { const f = level(); if (!f) return null; try { return await f.evaluate(() => (window.__mojRoll && window.__mojCtrl ? window.__mojRoll.seed : null)); } catch { return null; } };

// THE BOT, in the page: the reaction bot's own policy (roll-course.js playCourse) on the page's frames, its hands the
// keyboard. It sees a thing `sight` m off and acts `react` s after; it reads the pilot, never the scene.
const bot = (C) => {
  const w = window.__mojCtrl.world, me = w.byId[w.pilotId], key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
  const S = window.__bot = { done: false, hits: 0, frames: 0, wall0: performance.now(), t0: w.time || 0 }, seen = {}, pressed = {}, down = {};
  const hold = (code, on) => { if (!!down[code] !== !!on) { down[code] = !!on; key(code, !!on); } };
  let prev = me.transform.pos[1], prevX = me.transform.pos[0], last = w.time || 0, held = false, flown = false, heldFor = 0, wantX = 0, fast = false, still = 0, backing = 0;
  const tick = () => {
    // (the game's own clock: a page drawn slowly runs slowly, and the bot's reaction is in the game's seconds)
    const now = w.time || 0, dt = now - last; last = now;
    if (!(dt > 0)) { requestAnimationFrame(tick); return; }
    const [x, y] = me.transform.pos, t = now - S.t0, v = (y - prev) / dt, vx = (x - prevX) / dt; prev = y; prevX = x; S.frames++;
    S.y = y; S.x = x; S.seconds = t; S.wall = (performance.now() - S.wall0) / 1000;
    if (y > C.exit || (window.__mojGame && window.__mojGame.ended)) { for (const c of Object.keys(down)) hold(c, false); S.done = true; return; }
    let next = null;
    for (const o of C.obs) {
      if (y > o.y1 + 0.4) continue;
      if (seen[o.k] === undefined && o.y0 - y <= C.sight) seen[o.k] = t;
      if (seen[o.k] === undefined || t < seen[o.k] + C.react) continue;
      if (!next) next = o;
    }
    if (next && next.ask === 'steer') wantX = next.open;
    const grounded = me.grounded !== false;
    if (!backing && next && next.ask === 'jump' && !pressed[next.k] && next.y0 - y <= C.lead[next.id] * Math.max(v, 3) && grounded) { pressed[next.k] = true; held = true; flown = false; heldFor = 0; }
    if (backing > 0) { backing -= dt; if (backing <= 0) { backing = 0; if (next) pressed[next.k] = false; } }
    else if (Math.abs(v) < 1 && t > 0.5) { if ((still += dt) > 0.42) { backing = 0.75; still = 0; S.retries = (S.retries || 0) + 1; } } else still = 0;
    hold('KeyW', !backing); hold('KeyS', !!backing);
    if (held) { heldFor += dt; if (!grounded) flown = true; if ((flown && grounded) || heldFor > 1.5) held = false; }
    hold('Space', held);
    // (D is the camera's right, and the camera stands behind the lane: +x)
    const slide = (vx * Math.abs(vx)) / (2 * C.accel), e = wantX - (x + slide), s = Math.abs(e) > 0.12 ? Math.sign(e) : 0;
    hold('KeyD', s > 0); hold('KeyA', s < 0);
    if (v > 0.7 * C.top) fast = true;
    if (fast && v < 0.5 * C.top) { const o = C.obs.find((q) => y > q.y0 - 1.5 && y < q.y1 + 1); if (o) { S.hits++; fast = false; } }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

await wait(1500);
report.title = await text();
await page.screenshot({ path: path.join(out, 'title.png') });
// (a game whose screens are mana-ui's is driven as a pad would: accept on the title's first row; else the shell's button)
report.mana = await page.evaluate(() => !!window.__mojManaUi);
report.started = report.mana ? await page.evaluate(() => { window.__mojManaUi.press('accept'); return 'accept'; }) : await click('run|start|play');
const plays = []; let lastSeed = null;
for (let k = 0; k < maps; k++) {
  let seed = null;
  for (let i = 0; i < 480 && (seed === null || seed === lastSeed); i++) { await wait(250); seed = await seedNow(); }
  if (seed === null || seed === lastSeed) { plays.push({ map: k + 1, error: 'no new map', screen: await text() }); break; }
  lastSeed = seed;
  const obs = courseObstacles(course, seed), f = level();
  const same = await f.evaluate(() => window.__mojRoll.stand.slice().sort().join(' '));
  // (the start cue holds the hero: a shot of it, then the bot waits for GO as a player does)
  await wait(700);
  const cueUp = await f.evaluate(() => !!(window.__mojHud && window.__mojHud.rt.state().screen));
  if (cueUp) await page.screenshot({ path: path.join(out, `map-${seed}-cue.png`) });
  for (let i = 0; i < 60 && await f.evaluate(() => !!window.__mojMenuOpen); i++) await wait(100);
  // (on the first map: the pause, shot, and resumed by its first row)
  if (k === 0) {
    await page.evaluate(() => document.getElementById('pauseBtn').click());
    await wait(900);
    await page.screenshot({ path: path.join(out, 'pause.png') });
    report.pause = await text();
    if (report.mana) await page.evaluate(() => window.__mojManaUi.press('accept')); else await click('resume');
    await wait(500);
  }
  await f.evaluate(bot, { obs, exit: course.exit[1], sight: course.sight, react: course.react, top: P.top, accel: course.rule.accel || 7, lead: Object.fromEntries(Object.entries(P.lead).map(([id, l]) => [id, l.mid])) });
  let S = null, shot = false;
  for (let i = 0; i < 1500; i++) {
    await wait(200);
    try { S = await level()?.evaluate(() => ({ ...window.__bot })); } catch { break; }
    if (!S || S.done) break;
    if (!shot && S.y > obs[1].y0 - 12) { shot = true; await page.screenshot({ path: path.join(out, `map-${seed}.png`) }); }
    if (shot && !S.endShot && S.y > course.exit[1] - 26) { await page.screenshot({ path: path.join(out, `map-${seed}-end.png`) }); await level()?.evaluate(() => { window.__bot.endShot = true; }); }
  }
  // (what moves beside the way: where the train's group stands now, read twice)
  const train = await (async () => { try { const at = () => level()?.evaluate(() => { const st = window.__mojMoverState && window.__mojMoverState(); const m = typeof meshes !== 'undefined' && meshes['scenery:train']; return m ? +m.position.y.toFixed(1) : null; }); const a = await at(); await wait(400); return [a, await at()]; } catch { return null; } })();
  const hud = await (async () => { try { return await level()?.evaluate(() => (window.__mojHud ? { coins: window.__mojHud.state.coins.count, run: window.__mojHud.state.run, course: window.__mojHud.state.course, stamina: +window.__mojHud.state.hero.stamina.toFixed(1), hint: window.__mojHud.state.hint.show, moments: window.__mojHud.state.moments.map((m) => m.text) } : null)); } catch { return null; } })();
  plays.push({ map: k + 1, seed, cue: cueUp, train, hud, asks: obs.map((o) => o.id).join(' '), stands: same.split(' ').length, finished: !!S?.done, reached: S?.y && +S.y.toFixed(1), x: S?.x !== undefined ? +S.x.toFixed(2) : null, of: course.exit[1], seconds: S?.seconds && +S.seconds.toFixed(1), hits: S?.hits, retries: S?.retries ?? 0, wall: S?.wall && +S.wall.toFixed(1), fps: S?.wall ? Math.round(S.frames / S.wall) : null });
  await wait(1200);
  if (k === 0) await page.screenshot({ path: path.join(out, 'cleared.png') });
  await wait(1300);
  plays[plays.length - 1].after = await text(); plays[plays.length - 1].said = await page.evaluate(() => window.__msgs.splice(0).join(' '));
  if (k < maps - 1) plays[plays.length - 1].clicked = await click('next|continue|on');
}
await wait(3000);
await page.screenshot({ path: path.join(out, 'result.png') });
report.plays = plays; report.result = await text(); report.errors = errors;
report.different = `${new Set(plays.map((p) => p.asks)).size} of ${plays.length}`;
console.log(JSON.stringify(report, null, 1));
await browser.close(); server.close(); process.exit(0);
