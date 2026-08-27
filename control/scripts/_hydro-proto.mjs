// Verify the hydro-view arcs: assemble each scenario, emit the three.js world, screenshot it.
//   node capture-hydro.mjs <outDir>
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register(pathToFileURL('/Users/fombico/Documents/mojulo/control/scripts/mcp-stdio-loader.mjs').href);
import { writeFileSync, mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const { assembleHydroScene, HYDRO_SCENARIOS } = await import('/Users/fombico/Documents/mojulo/control/lib/graph/views/science/hydro-view.js');
const { emitThreeWorld } = await import('/Users/fombico/Documents/mojulo/control/lib/graph/scene/scene-three.js');
const { resolveChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('/Users/fombico/Documents/mojulo/control/lib/graph/scene/chromium.js');

const OUT_DIR = process.argv[2] || '/tmp/hydro-shots';
mkdirSync(OUT_DIR, { recursive: true });

const browser = await puppeteer.launch({ executablePath: await resolveChromium(), headless: true, args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const page = await browser.newPage();
await page.setViewport({ width: 1120, height: 780, deviceScaleFactor: 2 });

for (const scenario of HYDRO_SCENARIOS) {
  const payload = assembleHydroScene({ kind: 'hydro-view', scenario }, { title: `hydro — ${scenario}` });
  const html = emitThreeWorld({ ...payload, inline: true });
  const htmlPath = `${OUT_DIR}/${scenario}.html`;
  writeFileSync(htmlPath, html);
  await page.goto('file://' + htmlPath, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3000));
  writeFileSync(`${OUT_DIR}/${scenario}.png`, Buffer.from(await page.screenshot({ type: 'png' })));
  // a second frame later in time proves the movers/tracers animate.
  await new Promise((r) => setTimeout(r, 1400));
  writeFileSync(`${OUT_DIR}/${scenario}-b.png`, Buffer.from(await page.screenshot({ type: 'png' })));
  console.log('wrote', `${OUT_DIR}/${scenario}.png`);
}
await browser.close();
