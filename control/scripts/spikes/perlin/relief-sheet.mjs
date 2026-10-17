#!/usr/bin/env node
/**
 * The relief contact sheet: one geocube's land under each relief card, through the path /world serves
 * (resolveWorldScene → emitThreeWorld), shot in headless Chromium from the cube's island camera.
 *
 *   cd control && node scripts/spikes/perlin/relief-sheet.mjs [cube=valley-morning] [card ...]
 *     → ../lite-template/integration/1016/spike-output/relief/<cube>-<card>.png and index.html
 *
 * `none` is the cube as it ships. RELIEF_JSON='{"from":"eroded","height":3}' adds an own relief as `own`.
 * CAMERA=seam|wide|top shoots from that payload camera instead of the island's.
 * VARIANTS='{"name":{"land":{"facet":3},"ground":{…}}}' renders named changes to the cube's outside instead of the
 * cards (`land` merges over the cube's own land).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { readGeocube } = await import('../../../lib/graph/era/geocube.js');
const { RELIEF_CARDS } = await import('../../../lib/graph/noise/relief.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const [cubeId = 'valley-morning', ...asked] = process.argv.slice(2);
const camera = process.env.CAMERA || null;
const variants = process.env.VARIANTS ? JSON.parse(process.env.VARIANTS) : null;
const cards = variants ? Object.keys(variants) : asked.length ? asked : ['none', ...Object.keys(RELIEF_CARDS)];
const own = process.env.RELIEF_JSON ? JSON.parse(process.env.RELIEF_JSON) : null;
if (own) cards.push('own');

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../../../lite-template/integration/1016/spike-output/relief');
mkdirSync(outDir, { recursive: true });

const base = readGeocube(cubeId).outside;
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const shots = [];
try {
  for (const card of cards) {
    const relief = variants || card === 'none' ? undefined : card === 'own' ? own : card;
    const V = variants ? variants[card] : null;
    const cube = { from: cubeId, outside: { ...base, ...(relief ? { relief } : {}), ...(V ? { ...V, ...(V.land ? { land: { ...base.land, ...V.land } } : {}) } : {}) } };
    const t0 = Date.now();
    const { payload } = await resolveWorldScene({ title: `${cubeId} · ${card}`, manifest: { kind: 'geocube', cube, show: 'land', walk: false } });
    if (camera) { const k = payload.cameras.findIndex((c) => c.name === camera); if (k < 0) throw new Error(`no camera '${camera}' (${payload.cameras.map((c) => c.name).join(', ')})`); payload.cameras = [payload.cameras[k], ...payload.cameras.filter((_, i) => i !== k)]; }
    const W = 1120, H = 780, html = emitThreeWorld({ ...payload, viewBox: { width: W, height: H }, inline: true });
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 4000));
    await page.evaluate(() => { for (const s of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(s)) e.style.display = 'none'; });
    const el = await page.$('#wrap'), file = `${cubeId}-${card}${camera ? `-${camera}` : ''}.png`;
    writeFileSync(path.join(outDir, file), Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' })));
    await page.close();
    const reads = V ? JSON.stringify(V) : card === 'none' ? 'the cube as it ships' : card === 'own' ? JSON.stringify(own) : RELIEF_CARDS[card].reads;
    shots.push({ card, file, reads, faces: payload.faces.length, ms: Date.now() - t0 });
    console.log(`${card.padEnd(9)} ${String(payload.faces.length).padStart(6)} faces  ${Date.now() - t0} ms  → ${file}`);
  }
} finally { await browser.close().catch(() => {}); }

const cell = (s) => `<figure><img src="${s.file}" alt="${s.card}"><figcaption><b>${s.card}</b> · ${s.reads} · ${s.faces} faces · ${s.ms} ms</figcaption></figure>`;
writeFileSync(path.join(outDir, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Relief sheet · ${cubeId}</title>
<style>body{margin:16px;font:14px system-ui;background:#f4f2ee;color:#222}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(520px,1fr));gap:14px}
figure{margin:0;background:#fff;padding:8px;border-radius:6px}img{width:100%;display:block}figcaption{padding-top:6px}</style>
<h1>Relief · ${cubeId}</h1><main>${shots.map(cell).join('')}</main>`);
console.log('sheet →', path.join(outDir, 'index.html'));
