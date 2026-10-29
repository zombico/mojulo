// A world's book as stills, in its own skin: its dungeon page ("To the core") and, once the levels are made, a level's
// plan. run.mjs and session.mjs call it (the session between its asks, so the GIF shows the plan as the agent had it
// when it asked for approval).
//
//   node docs/images/src/wcd-demo/book.mjs <workDir> <worldRef> <prefix> [level]
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

const [work, ref, prefix, level] = process.argv.slice(2).map((a, i) => (i === 0 ? path.resolve(a) : a));
const row = SketchRepository.getByRef(ref);
if (!row) throw new Error(`book: no world ${ref}`);
const html = path.join(work, `${prefix}.html`);
writeFileSync(html, gameworldBibleHtml(gameworldOf(row.manifest)));

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
} finally { await browser.close(); }
process.exit(0);
