#!/usr/bin/env node
/**
 * SPIKE: a cube's micro-town and micro-city (the geocube kind's `show: 'town'` / `'city'`) through their own cameras, as a
 * sheet: the baseline the architecture's materials are read against.
 *
 *   cd control && node scripts/spikes/geotown/micro.mjs [name] [cube|show[|hour[|clouds[|materials[|style]]]] …]
 *     → ../lite-template/integration/1021/spike-output/geotown/<name>.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1021/spike-output/geotown');
mkdirSync(outDir, { recursive: true });
const [name = 'micro', ...sets] = process.argv.slice(2);
const SETS = (sets.length ? sets : ['limestone-crags|town', 'limestone-crags|city', 'valley-morning|town', 'valley-morning|city']).map((s) => s.split('|'));
const W = 560, H = 360, rows = [];
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const shoot = async (P, cam) => {
  const html = emitThreeWorld({ ...P, cameras: [{ ...cam, worldFraming: { ...cam.worldFraming, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H }, inline: true });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 4000));
  await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
  const el = await page.$('#wrap'), png = Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' }));
  await page.close();
  if (errs.length) console.log('  page errors:', errs.slice(0, 2).join(' | '));
  return `data:image/png;base64,${png.toString('base64')}`;
};
try {
  for (const [cube, show, hour, clouds, materials, style] of SETS) {
    const t0 = Date.now(), { payload: P } = await resolveWorldScene({ title: 'micro', manifest: { kind: 'geocube', cube: cube.startsWith('{') ? JSON.parse(cube) : cube, show, walk: false, seed: 3, ...(hour ? { hour } : {}), ...(clouds ? { clouds } : {}), ...(materials ? { materials } : {}), ...(style ? { style: style.startsWith('{') ? JSON.parse(style) : style } : {}) } });
    const ms = Date.now() - t0, tex = Object.keys(P.textures || {}).length, bytes = JSON.stringify(P).length;
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false }));   // (a still keeps its own camera)
    const cams = P.cameras.slice(0, 3), cells = [];
    for (const c of cams) cells.push({ cap: c.name, src: await shoot(P, c) });
    rows.push({ cap: `${cube} · ${show}${hour ? ` · ${hour}` : ''}${clouds ? ` · ${clouds}` : ''}${materials ? ` · ${materials}` : ''}${style ? ` · ${style.slice(0, 40)}` : ''} · ${ms} ms · ${P.faces.length} faces · ${tex} textures · payload ${(bytes / 1e6).toFixed(2)} MB`, cells });
    console.log(rows[rows.length - 1].cap, '·', cams.map((c) => c.name).join(', '));
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(3,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 3 * W + 50, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
