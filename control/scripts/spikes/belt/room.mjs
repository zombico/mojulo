// SPIKE belt: THE BELT in Chrome. A world that fights hand to hand has its belt laid (gameworld/belt-room.js) and its
// page emitted; a bot walks the way and swings (left click) at whatever stands, as a player mashing would. What it
// answers: does the hold keep the hero and the frame in the screen, do the waves wake, fall and open the way on, and
// does the last screen's clear win. Shots at the start, at each screen begun and at the end.
//   node scripts/spikes/belt/room.mjs --out /abs/dir [--feel <pole>] [--screens 2] [--secs 90]
process.env.SQLITE_PATH = ':memory:'; process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import fs from 'node:fs/promises';
import path from 'node:path';
import { register } from 'node:module';
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const out = path.resolve(opt('--out', 'belt-spike')), screens = Number(opt('--screens', 2)), secs = Number(opt('--secs', 90));
await fs.mkdir(out, { recursive: true });
process.env.MOJULO_OUTCOMES_DIR = out; process.env.MOJULO_DATA_DIR = out;
register(new URL('../../mcp-stdio-loader.mjs', import.meta.url));
const at = (p) => new URL(`../../../${p}`, import.meta.url).href;
const { beltRoom } = await import(at('lib/graph/gameworld/belt-room.js'));
const { POLES } = await import(at('lib/graph/gameworld/feel/cards.js'));
const { resolveWorldScene } = await import(at('lib/graph/worlds/world-scene.js'));
const { emitThreeWorld } = await import(at('lib/graph/scene/scene-three.js'));
const { launchChromium, resolveChromium, CHROMIUM_WEBGL_ARGS } = await import(at('lib/graph/scene/chromium.js'));
const feel = opt('--feel', Object.keys(POLES).find((p) => POLES[p].demo.includes('attack')));
const R = beltRoom({ id: 'belt', name: 'Belt', feel }, { screens });
console.error('belt', feel, JSON.stringify({ length: R.belt.length, screens: R.belt.screens.map((s) => s.waves.map((w) => w.length)), props: R.belt.props.length, hero: R.hero }));
const { payload } = await resolveWorldScene({ ref: 'belt-room', title: 'Belt', manifest: R.manifest });
const html = emitThreeWorld({ ...payload, inline: true });
await fs.writeFile(path.join(out, 'belt.html'), html);
const browser = await launchChromium({ executablePath: await resolveChromium(), headless: true, args: CHROMIUM_WEBGL_ARGS });
const page = await browser.newPage(); await page.setViewport({ width: 960, height: 540 });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 300))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await page.goto('file://' + path.join(out, 'belt.html'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const read = () => page.evaluate(() => { const W = window.__mojCtrl && window.__mojCtrl.world, me = W && W.byId[W.pilotId], V = window.__mojBus && window.__mojBus.state.vars, L = window.__mojBus ? window.__mojBus.state.log.map((r) => r.type) : [];
  const foes = W ? W.entities.filter((e) => e.team === 'foes').map((e) => ({ id: e.id, y: +e.transform.pos[1].toFixed(1), x: +e.transform.pos[0].toFixed(1), hp: e.body && e.body.hp, dormant: !!e.dormant, down: !!e.downed })) : [];
  return { t: W && +W.time.toFixed(1), hero: me && me.transform.pos.map((v) => +v.toFixed(1)), hold: W && W.hold && [W.hold.lo, W.hold.hi], cam: W && W.camera.lookAt && +W.camera.lookAt[1].toFixed(1), hp: V && V.hp, screen: V && V.belt_screen, left: V && V.belt_left, won: L.includes('belt:won'), go: L.filter((x) => x === 'belt:go').length, foes: foes.filter((f) => !f.dormant) }; });
await wait(4000);
await page.screenshot({ path: path.join(out, 'start.png') });
const report = { first: await read(), ticks: [] };
// the bot: toward the nearest foe standing (along the way, then across it), a swing when near; none standing, on along the way
const keys = new Set(), hold = async (k, on) => { if (on && !keys.has(k)) { keys.add(k); await page.keyboard.down(k); } else if (!on && keys.has(k)) { keys.delete(k); await page.keyboard.up(k); } };
await page.mouse.move(480, 300);
const t0 = Date.now(); let shot = 1, lastScreen = 1;
while ((Date.now() - t0) / 1000 < secs) {
  const s = await read();
  if (!s.hero) { await wait(300); continue; }
  const live = s.foes.filter((f) => !f.down && (f.hp == null || f.hp > 0)), near = live.sort((a, b) => Math.hypot(a.y - s.hero[1], a.x - s.hero[0]) - Math.hypot(b.y - s.hero[1], b.x - s.hero[0]))[0];
  const dy = near ? near.y - s.hero[1] : 1e3, dx = near ? near.x - s.hero[0] : 0;
  await hold('KeyD', dy > 0.9); await hold('KeyA', dy < -0.9);
  await hold('KeyW', near && dx < -0.5); await hold('KeyS', near && dx > 0.5);       // W: up the screen, away from the camera (-x)
  if (near && Math.hypot(dy, dx) < 1.8) { await page.mouse.down(); await wait(40); await page.mouse.up(); }
  if (s.screen !== lastScreen) { lastScreen = s.screen; await wait(1500); await page.screenshot({ path: path.join(out, `screen-${s.screen}.png`) }); }
  if (report.ticks.length < 60 && (Date.now() - t0) / 1000 > report.ticks.length * 3) { report.ticks.push({ ...s, foes: s.foes.length, live: live.length }); if (shot <= 3 && live.length) { await page.screenshot({ path: path.join(out, `fight-${shot++}.png`) }); } }
  if (s.won) break;
  await wait(120);
}
for (const k of [...keys]) await page.keyboard.up(k);
await wait(1200);
await page.screenshot({ path: path.join(out, 'end.png') });
report.last = await read(); report.errs = errs.slice(0, 6);
console.log(JSON.stringify(report, null, 1));
await browser.close(); process.exit(0);
