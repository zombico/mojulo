// SPIKE: THE HIGHLIGHT (game/highlight.js) on a real level. A quick collectathon is designed in memory; its level is
// emitted twice, as it is and with `game.highlight`, and Chrome shoots both from beside its first gem. What it answers:
// does the fresnel shell draw on the glyphs the mechanics lay, and is the page without it untouched.
//   node scripts/spikes/highlight/level.mjs --out /abs/dir [--color '#77ddff'] [--juice isekai|cel|material]
process.env.SQLITE_PATH = ':memory:'; process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
import fs from 'node:fs/promises';
import path from 'node:path';
import { register } from 'node:module';
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const out = path.resolve(opt('--out', 'highlight-spike')), color = opt('--color', null), juice = opt('--juice', null);
await fs.mkdir(out, { recursive: true });
process.env.MOJULO_OUTCOMES_DIR = out; process.env.MOJULO_DATA_DIR = out;
register(new URL('../../mcp-stdio-loader.mjs', import.meta.url));
const at = (p) => new URL(`../../../${p}`, import.meta.url).href;
const { designGameHandler } = await import(at('lib/mcp/tools/design-game.js'));
const { SketchRepository } = await import(at('lib/db/repositories/sketches.js'));
const { resolveWorldScene } = await import(at('lib/graph/worlds/world-scene.js'));
const { emitThreeWorld } = await import(at('lib/graph/scene/scene-three.js'));
const { launchChromium, resolveChromium, CHROMIUM_WEBGL_ARGS } = await import(at('lib/graph/scene/chromium.js'));
await designGameHandler({ quick: { goal: 'collect', world: { id: 'hl' } }, ref: 'h' });
const row = SketchRepository.getByRef(SketchRepository.list({ limit: 80 }).map((x) => x.ref).find((r) => /level/.test(r))), M = row.manifest;
const gem = M.game.mechanics.find((m) => m.kind === 'collect').pickups[0].at;
// (the hero stood three metres short of the first gem, facing it)
const browser = await launchChromium({ executablePath: await resolveChromium(), headless: true, args: CHROMIUM_WEBGL_ARGS });
const report = {};
for (const [name, game] of [['plain', M.game], ['lit', { ...M.game, highlight: color ? { color } : true }]]) {
  const { payload } = await resolveWorldScene({ ...row, manifest: { ...M, game, ...(juice ? { fxStyle: { look: juice, flavor: 'action' } } : {}) } });
  const html = emitThreeWorld({ ...payload, inline: true });
  await fs.writeFile(path.join(out, `${name}.html`), html);
  const page = await browser.newPage(); await page.setViewport({ width: 900, height: 560 });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 300))); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 600)); });
  await page.goto('file://' + path.join(out, `${name}.html`));
  await new Promise((r) => setTimeout(r, 5000));
  report[name] = { bytes: html.length, shell: html.includes('__fxHlShell'), states: JSON.stringify(payload.fx?.states ?? {}).slice(0, 200), errs,
    shells: await page.evaluate(() => { let n = 0, lit = 0; const B = window.__mojCtrl && window.__mojCtrl.bodies; if (B) for (const id in B) B[id].traverse((o) => { if (o.userData && o.userData.__hl) { n++; if (o.visible) lit++; } }); return { n, lit }; }) };
  // the walker stood three metres from its first gem, turned each way in turn: one of the four faces it
  for (const q of [0, 1, 2, 3]) {
    await page.evaluate((q) => { const W = window.__mojCtrl.world, me = W.byId[W.pilotId], g = window.__mojCtrl.bodies['dec_pk_0_0'].position, h = q * Math.PI / 2; me.transform.pos = [g.x - 3 * Math.sin(h), g.y - 3 * Math.cos(h), me.transform.pos[2]]; me.transform.heading = h; if (me.vel) me.vel = [0, 0, 0]; }, q);
    await new Promise((r) => setTimeout(r, 900));
    await page.screenshot({ path: path.join(out, `${name}-${q}.png`) });
  }
  await page.close();
}
console.log(JSON.stringify(report, null, 1));
await browser.close(); process.exit(0);
