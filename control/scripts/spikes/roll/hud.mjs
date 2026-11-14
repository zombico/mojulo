// SPIKE: THE ONE HUD HOST on a level that is not a course. A quick collectathon whose world says a `ui` is designed
// in memory; its level's own HUD rows (events.hud) are drawn by the page's host on the game UI runtime. Chrome plays
// the page for a few seconds; what the host's state reads off the bus is printed, and the frame is shot.
//   node scripts/spikes/roll/hud.mjs --out /abs/dir [--ui toybox]
process.env.SQLITE_PATH = ':memory:'; process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import fs from 'node:fs/promises';
import path from 'node:path';
import { register } from 'node:module';
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const out = path.resolve(opt('--out', 'hud-spike')), ui = opt('--ui', null);
await fs.mkdir(out, { recursive: true });
process.env.MOJULO_OUTCOMES_DIR = out; process.env.MOJULO_DATA_DIR = out;
register(new URL('../../mcp-stdio-loader.mjs', import.meta.url));
const at = (p) => new URL(`../../../${p}`, import.meta.url).href;
const { designGameHandler } = await import(at('lib/mcp/tools/design-game.js'));
const { SketchRepository } = await import(at('lib/db/repositories/sketches.js'));
const { resolveWorldScene } = await import(at('lib/graph/worlds/world-scene.js'));
const { emitThreeWorld } = await import(at('lib/graph/scene/scene-three.js'));
const { launchChromium, resolveChromium, CHROMIUM_WEBGL_ARGS } = await import(at('lib/graph/scene/chromium.js'));
const body = (r) => r?.structuredContent ?? r;
const D = body(await designGameHandler({ quick: { goal: 'collect', world: { id: 'hd', ui: ui ? { theme: ui } : {} } }, ref: 'h' }));
const refs = SketchRepository.list({ limit: 80 }).map((x) => x.ref);
const row = SketchRepository.getByRef(refs.find((r) => /level/.test(r)));
console.error('design', D.ok, D.error ?? '', 'level', row?.ref, 'manaHud', JSON.stringify(row?.manifest.manaHud ?? null).slice(0, 160), 'hud rows', JSON.stringify(row?.manifest.events?.hud ?? null).slice(0, 400));
const { payload } = await resolveWorldScene(row);
const html = emitThreeWorld({ ...payload, inline: true });
await fs.writeFile(path.join(out, 'level.html'), html);
const browser = await launchChromium({ executablePath: await resolveChromium(), headless: true, args: CHROMIUM_WEBGL_ARGS });
const page = await browser.newPage(); await page.setViewport({ width: 960, height: 540 });
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
await page.goto('file://' + path.join(out, 'level.html'));
await new Promise((r) => setTimeout(r, 6000));
const seen = await page.evaluate(() => ({ hud: !!window.__mojHud, state: window.__mojHud && { v: window.__mojHud.state.v, on: window.__mojHud.state.on, hero: window.__mojHud.state.hero, moments: window.__mojHud.state.moments.length }, vars: window.__mojBus && window.__mojBus.state.vars, old: [...document.querySelectorAll('.moj-hud-col')].map((e) => getComputedStyle(e).display), text: document.getElementById('moj-mana-hud') && document.getElementById('moj-mana-hud').innerText }));
await page.screenshot({ path: path.join(out, 'hud.png') });
console.log(JSON.stringify({ seen, errs }, null, 1));
await browser.close(); process.exit(0);
