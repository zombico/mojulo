#!/usr/bin/env node
/**
 * SPIKE: one cube's island at the hours of a day (era/geocube-hours.js), each through the island camera, as a sheet.
 *
 *   cd control && node scripts/spikes/sky/hours.mjs [cube …] → ../lite-template/integration/1020/spike-output/sky/hours.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1020/spike-output/sky');
mkdirSync(outDir, { recursive: true });
const args = process.argv.slice(2), cubes = args.filter((a) => !/^\d|^[a-z]+=/.test(a) && !a.startsWith('--')), name = (args.find((a) => a.startsWith('--name=')) || '--name=hours').slice(7);
const HOURS = [undefined, 'dawn', 'morning', 'noon', 'golden', 'dusk', 'night'];
const W = 520, H = 340, rows = [];
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
try {
  for (const cube of cubes.length ? cubes : ['limestone-crags']) {
    const cells = [];
    for (const hour of HOURS) {
      const t0 = Date.now(), { payload: P } = await resolveWorldScene({ title: 'hours', manifest: { kind: 'geocube', cube: cube.includes('{') ? JSON.parse(cube) : cube, show: 'land', walk: false, ...(hour ? { hour } : {}) } });
      const cam = P.cameras[0], html = emitThreeWorld({ ...P, cameras: [{ ...cam, worldFraming: { ...cam.worldFraming, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H }, inline: true });
      const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
      await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 3500));
      await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
      const el = await page.$('#wrap'), png = Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' }));
      await page.close();
      cells.push({ cap: `${hour ?? 'as it was'} · ${Date.now() - t0} ms`, src: `data:image/png;base64,${png.toString('base64')}` });
      console.log(cube, hour ?? '-', Date.now() - t0, 'ms');
    }
    rows.push({ cube: cube.length > 40 ? cube.slice(0, 40) + '…' : cube, cells });
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(4,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cube}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 4 * W + 50, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
