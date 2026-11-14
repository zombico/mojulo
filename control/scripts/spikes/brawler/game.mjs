#!/usr/bin/env node
// brawler game — A WORLD THAT IS A BRAWLER, through the agent's own doors and then Chrome. A quick brawl is designed
// (design_game `quick: { goal: 'brawl' }`): its players made as characters, its street a level, the game in the play
// shell; it is exported (export_game) and opened in headless Chrome through its shell. What it answers: does the door
// make a brawler end to end, does the shell start the street, and does the street's end reach the shell.
//   node control/scripts/spikes/brawler/game.mjs [--out dir] [--roster 1] [--light] [--fell]
import { register as registerLoader } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
const { values: opt } = parseArgs({ options: { out: { type: 'string', default: path.join(os.tmpdir(), 'brawler-game') }, roster: { type: 'string', default: '1' }, light: { type: 'boolean', default: false }, fell: { type: 'boolean', default: false }, secs: { type: 'string', default: '150' } } });
const out = path.resolve(opt.out); await fs.mkdir(out, { recursive: true });
process.chdir(CONTROL);
registerLoader(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
process.env.SQLITE_PATH = ':memory:'; process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1'; process.env.MOJULO_OUTCOMES_DIR = out; process.env.MOJULO_DATA_DIR = out;
const { designGameHandler } = await import('@/lib/mcp/tools/design-game.js');
const { exportGameHandler } = await import('@/lib/mcp/tools/export-game.js');
const { SketchRepository } = await import('@/lib/db/repositories/sketches.js');
const { launchChromium, resolveChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium.js');
const body = (r) => r?.structuredContent ?? r, t0 = Date.now(), at = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`;
const say = (k, v) => console.log(JSON.stringify([k, at(), v]).slice(0, 700));
// (a roster of its own keeps the run short: one all-rounder; --light a street a masher finishes)
const roster = Array.from({ length: Number(opt.roster) }, (_, k) => ({ archetype: ['hero', 'explorer', 'rebel', 'sage'][k % 4], style: ['all-rounder', 'rushdown', 'grappler', 'zoner'][k % 4] }));
const streets = opt.light ? [{ id: 'street', name: 'The street', waves: [{ screen: 1, crowd: [{ type: 'thug', n: 2 }] }, { screen: 2, crowd: [{ type: 'thug', n: 2 }] }, { screen: 3, crowd: [{ type: 'thug', n: 1 }] }] }] : undefined;
const D = body(await designGameHandler({ quick: { goal: 'brawl', roster, ...(streets ? { streets } : {}), world: { id: 'brawl', name: 'Brawl' } }, ref: 'b' }));
say('design_game', { ok: D.ok, error: D.error, next: (D.next ?? []).map((n) => n.step), made: Object.keys(D.made ?? {}) });
const refs = SketchRepository.list({ limit: 80 }).map((x) => x.ref);
say('sketches', refs);
const gameRef = refs.find((r) => /game$/.test(r)), G = gameRef ? SketchRepository.getByRef(gameRef).manifest : null;
say('game', G && { shell: G.shell, levels: G.levels, ui: !!G.ui, engine: G.engine });
if (!G) process.exit(1);
const ex = body(await exportGameHandler({ ref: gameRef }));
const dir = path.join(out, gameRef);
say('export_game', { ok: ex.ok, error: ex.error, files: (await fs.readdir(dir).catch(() => [])).join(' ') });
const types = { '.html': 'text/html', '.json': 'application/json', '.wav': 'audio/wav', '.png': 'image/png', '.js': 'text/javascript', '.glb': 'model/gltf-binary' };
const server = http.createServer(async (req, res) => { try { const f = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname)); const b = await fs.readFile(f); res.writeHead(200, { 'content-type': types[path.extname(f)] ?? 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); } });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await launchChromium({ executablePath: await resolveChromium(), headless: true, args: CHROMIUM_WEBGL_ARGS });
const page = await browser.newPage(); await page.setViewport({ width: 1120, height: 630 });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 300))); page.on('console', (m) => { if (m.type() === 'error' && !/AudioContext|404/.test(m.text())) errs.push(m.text().slice(0, 300)); });
await page.goto(`http://127.0.0.1:${server.address().port}/game.html`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`) });
const words = async () => (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200)));
await wait(2500); await shot('title'); say('title', await words());
// (start: enter, as a player would; then the level's frame)
for (let k = 0; k < 4; k++) { await page.keyboard.press('Enter'); await wait(1200); }
const frameOf = () => page.frames().find((f) => f !== page.mainFrame());
let F = null;
for (let t = 0; t < 60 && !F; t++) { const f = frameOf(); if (f && await f.evaluate(() => !!window.__mojBrawl).catch(() => false)) F = f; else await wait(1000); }
say('level', { frame: !!F, shell: await words() });
if (F) {
  await wait(1500); await shot('street');
  // the bot, in the level's frame: at the nearest body on the street, attack when lined up
  const t1 = Date.now(); let over = null, last = null;
  while ((Date.now() - t1) / 1000 < Number(opt.secs) && !over) {
    const s = await F.evaluate(() => { const B = window.__mojBrawl; if (!B || !B.room) return null; const me = B.room.s.bodies[0]; const on = B.room.s.bodies.filter((b) => b.side === 'crowd' && !b.gone && !b.ko).sort((a, b) => Math.abs(a.x - me.x) + Math.abs(a.z - me.z) - Math.abs(b.x - me.x) - Math.abs(b.z - me.z))[0]; return { me: [me.x, me.z], near: on ? [on.x, on.z] : null, R: B.read, over: B.over }; }).catch(() => null);
    if (!s) { await wait(300); continue; }
    last = s; over = s.over;
    // (--fell: the spike's shortcut to the street's end, every body on the street felled as it comes, to see the shell's win)
    if (opt.fell) await F.evaluate(() => { for (const b of window.__mojBrawl.room.s.bodies) if (b.side === 'crowd' && !b.gone && !b.ko) { b.ko = 1; b.hp = 0; b.st = 'ko'; b.sf = 0; } });
    const want = new Set();
    if (s.near) { const dx = s.near[0] - s.me[0], dz = s.near[1] - s.me[1]; if (Math.abs(dx) > 700) want.add(dx > 0 ? 'KeyD' : 'KeyA'); if (Math.abs(dz) > 150) want.add(dz > 0 ? 'KeyW' : 'KeyS'); if (Math.abs(dx) < 1000 && Math.abs(dz) < 300) { await page.keyboard.press('KeyK'); } } else want.add('KeyD');
    for (const k of ['KeyD', 'KeyA', 'KeyW', 'KeyS']) { if (want.has(k)) await page.keyboard.down(k); else await page.keyboard.up(k); }
    await wait(60);
  }
  for (const k of ['KeyD', 'KeyA', 'KeyW', 'KeyS']) await page.keyboard.up(k);
  say('street end', { over, read: last && { cleared: last.R.cleared, of: last.R.of, hp: last.R.hp } });
  await wait(4000); await shot('after'); say('shell after', await words());
  // (the result's first row fights it again: the street back at its start, in the shell)
  await page.keyboard.press('Enter'); await wait(5000);
  const again = frameOf() ? await frameOf().evaluate(() => { const B = window.__mojBrawl; return B && B.room ? { over: B.over, cleared: B.read.cleared, hp: B.read.hp, f: B.room.s.f } : null; }).catch(() => null) : null;
  await shot('again'); say('again', { street: again, shell: await words() });
}
say('errors', errs.slice(0, 6));
await browser.close(); server.close(); process.exit(0);
