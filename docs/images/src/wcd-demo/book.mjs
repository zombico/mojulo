// A world's book as stills, in its own skin: its dungeon page ("To the core") and, once the levels are made, a level's
// plan. run.mjs and session.mjs call it (the session between its asks, so the GIF shows the plan as the agent had it
// when it asked for approval).
//
//   node docs/images/src/wcd-demo/book.mjs <workDir> <worldRef> <prefix> [level] [--draft] [--skin <preset>]
//
// --draft draws the book as the draft had it, from the stored world without its run's record (`made`) and its verdicts
// (`review`); --skin puts a book skin on it (gameworld/book-skin.js) in memory, the world untouched.
//
// Reads the data dir MOJULO_DATA_DIR names; writes <workDir>/<prefix>.html, <prefix>-dungeon.png and, with a level that
// is made, <prefix>-<level>.png.
import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../control');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href, pathToFileURL(`${CONTROL}/`).href);
const at = (p) => import(pathToFileURL(path.join(CONTROL, p)).href);
// (the data dir MOJULO_DATA_DIR names, as the bins resolve it)
(await at('scripts/mojulo-paths.mjs')).resolveMojuloPaths();
const { SketchRepository } = await at('lib/db/repositories/sketches.js');
const { gameworldOf, gameworldBibleHtml } = await at('lib/graph/gameworld/index.js');
const { resolveChromium, launchChromium } = await at('lib/graph/scene/chromium.js');

const argv = process.argv.slice(2), flag = (k) => { const i = argv.indexOf(k); return i < 0 ? null : argv.splice(i, k === '--draft' ? 1 : 2).slice(1)[0] ?? true; };
const draft = flag('--draft'), skin = flag('--skin');
const [work, ref, prefix, level] = argv.map((a, i) => (i === 0 ? path.resolve(a) : a));
const row = SketchRepository.getByRef(ref);
if (!row) throw new Error(`book: no world ${ref}`);
const html = path.join(work, `${prefix}.html`);
const { made, review, ...rest } = row.manifest;
const manifest = { ...(draft ? rest : row.manifest), ...(skin ? { book: { skin } } : {}) };
writeFileSync(html, gameworldBibleHtml(gameworldOf(manifest)));

const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1240, height: 900, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.evaluate(() => { for (const n of document.querySelectorAll('nav.tabs')) n.style.display = 'none'; });
  await new Promise((r) => setTimeout(r, 800));
  for (const [name, sel] of [['dungeon', '#wcd'], ...(level ? [[level, `#level-${level} .level-grid`]] : [])]) {
    const el = await page.$(sel);
    if (!el) { console.log(`book: no ${sel}`); continue; }
    await el.screenshot({ path: path.join(work, `${prefix}-${name}.png`) });
    console.log('still', `${prefix}-${name}`);
  }
  // the level's finishes alone, on a narrow page so its tiles wrap into a board
  if (level) {
    await page.setViewport({ width: 520, height: 900, deviceScaleFactor: 2 });
    await new Promise((r) => setTimeout(r, 400));
    const el = await page.$(`#level-${level} .finishes`);
    if (el) { await el.screenshot({ path: path.join(work, `${prefix}-${level}-finishes.png`) }); console.log('still', `${prefix}-${level}-finishes`); }
  }
} finally { await browser.close(); }
process.exit(0);
