#!/usr/bin/env node
/**
 * SPIKE: a stage's trail on a cube (`{ kind: 'stage', geocube, trail }`), dressed as asked — one stretch of it, along it
 * at a person's eye, close on it, at its edge, and down onto it — for the trail's surface, rubble and patches
 * (era/trail-dress.js), per set.
 *
 *   cd control && node scripts/spikes/geotown/trail.mjs [name] [cube|trail-json|caption …]
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
const [name = 'trail', ...sets] = process.argv.slice(2);
const SETS = (sets.length ? sets : ['limestone-crags|{}']).map((s) => s.split('|'));
const W = 480, H = 360, rows = [], r3 = (v) => Math.round(v * 1000) / 1000;
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const shoot = async (P, cam) => {
  const html = emitThreeWorld({ ...P, cameras: [{ ...cam, worldFraming: { ...cam.worldFraming, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H }, inline: true });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
  await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 4000));
  await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
  const el = await page.$('#wrap'), png = Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' }));
  await page.close();
  return `data:image/png;base64,${png.toString('base64')}`;
};
try {
  for (const [cube, dress = '{}', caption] of SETS) {
    const t0 = Date.now(), { payload: P } = await resolveWorldScene({ title: 'trail', manifest: { kind: 'stage', geocube: cube, trail: JSON.parse(dress), seed: 3 } });
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false }));
    // (the stretch from y 20 to 28, its line read off the trail's own faces: the same stretch every set)
    const mid = (y) => { const fs = P.faces.filter((f) => f.group === 'isekai:trail' && !f.patch && Math.abs(f.corners.reduce((a, c) => a + c[1], 0) / f.corners.length - y) < 0.5); return [0, 1, 2].map((k) => fs.reduce((a, f) => a + f.corners.reduce((b, c) => b + c[k], 0) / f.corners.length, 0) / fs.length); };
    const A = mid(20), B = mid(28), d = [B[0] - A[0], B[1] - A[1]], l = Math.hypot(...d), u = [d[0] / l, d[1] / l], n = [-u[1], u[0]], gz = A[2];
    const e = [A[0], A[1], gz + 1.7], k = [B[0], B[1], B[2] + 0.4];
    const at = (a, s, z) => [e[0] + u[0] * a + n[0] * s, e[1] + u[1] * a + n[1] * s, gz + z].map(r3);
    const cam = (nm, from, to, fov) => ({ name: nm, worldFraming: { cameraPosition: from, lookAt: to, horizontalFov: fov } });
    const cams = [cam('along', e, k, 75), cam('close', at(2, 0.3, 1.1), at(5.5, 0, 0), 60), cam('edge', at(4, -2.6, 0.9), at(5, 1.2, 0), 60), cam('down', at(3, 0, 2.6), at(4.6, 0, 0), 70)];
    const cells = [];
    for (const c of cams) cells.push({ cap: c.name, src: await shoot(P, c) });
    rows.push({ cap: `${caption ?? `${cube} · ${dress}`} (${P.faces.length} faces, ${((Date.now() - t0) / 1000).toFixed(1)} s)`, cells });
    console.log(rows[rows.length - 1].cap);
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(4,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 4 * W + 60, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
