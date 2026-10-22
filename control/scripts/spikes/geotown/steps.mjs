#!/usr/bin/env node
/**
 * SPIKE: a gen-7 cube's texture-map layer with and without its relief steps (scene/channels/relief-steps.js), the same
 * cameras side by side: its town, its room, its land near the rock.
 *
 *   cd control && node scripts/spikes/geotown/steps.mjs [name] [cube|show …]
 *     → ../lite-template/integration/1022/spike-output/<name>.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');
const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1022/spike-output');
mkdirSync(outDir, { recursive: true });
const [name = 'steps', ...sets] = process.argv.slice(2);
const SETS = (sets.length ? sets : ['limestone-crags|town', 'limestone-crags|room', 'limestone-crags|land']).map((s) => s.split('|'));
const W = 560, H = 380, rows = [];
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const shoot = async (P, cam) => {
  const html = emitThreeWorld({ ...P, cameras: [{ ...cam, worldFraming: { ...cam.worldFraming, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H }, inline: true });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 4500));
  await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
  const el = await page.$('#wrap'), png = Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' }));
  await page.close();
  if (errs.length) console.log('  page errors:', errs.slice(0, 3).join(' | ').slice(0, 400));
  return `data:image/png;base64,${png.toString('base64')}`;
};
try {
  for (const [cube, show] of SETS) {
    const { payload: P } = await resolveWorldScene({ title: 'steps', manifest: { kind: 'geocube', cube, show, walk: false, ...(show === 'town' || show === 'trail' ? { seed: 3 } : {}) } });
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false }));
    const { reliefSteps: _s, ...flat } = P;
    console.log(cube, show, 'steps', JSON.stringify(P.reliefSteps));
    for (const c of P.cameras.slice(0, 2)) rows.push({ cap: `${cube} · ${show} · ${c.name}`, cells: [{ cap: 'unstepped', src: await shoot(flat, c) }, { cap: 'in the relief steps', src: await shoot(P, c) }] });
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(2,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 2 * W + 40, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
