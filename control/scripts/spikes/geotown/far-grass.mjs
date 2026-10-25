#!/usr/bin/env node
/**
 * SPIKE: the far grass (scene/channels/stage-grass.js `far`) — the same meadow with the far grass off and on, the camera
 * walking in on one stretch of it (from 60 m, 35 m, 18 m and 6 m), so the handover from the far clumps to the field
 * shows; the page's console errors and the far clumps' count with each row.
 *
 *   cd control && node scripts/spikes/geotown/far-grass.mjs [name] [biocube]
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
const { ISEKAI_STYLES } = await import('../../../lib/graph/era/isekai.js');
const { outTrailSite } = await import('../../../lib/graph/era/out-trail.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1021/spike-output/geotown');
mkdirSync(outDir, { recursive: true });
const [name = 'far-grass', bio = 'meadow'] = process.argv.slice(2);
const W = 480, H = 320, r3 = (v) => Math.round(v * 1000) / 1000;
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const shoot = async (P, cam) => {
  const html = emitThreeWorld({ ...P, cameras: [{ ...cam, worldFraming: { ...cam.worldFraming, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H }, inline: true });
  const page = await browser.newPage(), errs = []; page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); }); page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.setViewport({ width: W, height: H });
  await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 5000));
  await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
  const el = await page.$('#wrap'), png = Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' }));
  await page.close();
  return { src: `data:image/png;base64,${png.toString('base64')}`, errs };
};
const cam = (from, to, fov = 62) => ({ name: 'v', worldFraming: { cameraPosition: from.map(r3), lookAt: to.map(r3), horizontalFov: fov } });
const site = outTrailSite(ISEKAI_STYLES['isekai-meadow'], {}, 1);
// a stretch of meadow off the trail, the camera coming in on it along the trail's side
const ty = site.D * 0.62, tx = Math.min(site.W - 4, site.trailX(ty) + 9), tz = site.ground(tx, ty);
const from = (d) => { const y = ty - d, x = site.trailX(y) + 2; return cam([x, y, site.ground(x, y) + 1.7], [tx, ty, tz + 0.3], 62); };
const rows = [];
try {
  for (const far of [false, true]) {
    const { payload: P } = await resolveWorldScene({ title: 'far grass', manifest: { kind: 'stage', kit: 'isekai-meadow', trail: {}, shading: { grit: 0.7 }, biocube: bio, grass: { far } } });
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false }));
    const cells = [];
    for (const d of [60, 35, 18, 6]) { const r = await shoot(P, from(d)); cells.push({ cap: `${d} m${r.errs.length ? ' — ERRORS: ' + r.errs.join(' | ') : ''}`, src: r.src }); }
    rows.push({ cap: far ? 'far grass on' : 'far grass off (as it was)', cells }); console.log(rows.at(-1).cap, cells.map((c) => c.cap).join(' · '));
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(4,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}figcaption{font-size:11px}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 4 * W + 60, height: 600 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
