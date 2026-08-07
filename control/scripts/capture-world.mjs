// Screenshot the live three.js /world for a sketch (authoritative renderer).
//   node scripts/capture-world.mjs <ref> <outPath> [settleMs]
//   ORBIT="dx,dy" env drags the orbit camera before the shot (dy<0 = look from above)
import { writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer-core';
import { resolveChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } from '../lib/graph/scene/chromium.js';

const [ref, outPath = `/tmp/${ref}-world.png`, settle = '2600'] = process.argv.slice(2);
const url = `http://localhost:3001/api/sketches/${ref}/world`;
const browser = await puppeteer.launch({ executablePath: await resolveChromium(), headless: true, args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const page = await browser.newPage();
await page.setViewport({ width: 1000, height: 1000, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await new Promise((r) => setTimeout(r, Number(settle)));
const [dx, dy] = (process.env.ORBIT || '').split(',').map(Number);
if (Number.isFinite(dx)) {
  const vw = 1000, cx = vw / 2, cy = vw / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const steps = 24;
  for (let i = 1; i <= steps; i++) await page.mouse.move(cx + (dx * i) / steps, cy + ((dy || 0) * i) / steps);
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 600));
}
await page.evaluate(() => { for (const s of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(s)) e.style.display = 'none'; });
await writeFile(outPath, await page.screenshot({ type: 'png' }));
await browser.close();
console.log(`world -> ${outPath}`);
