#!/usr/bin/env node
/**
 * SPIKE: a micro-town's first house up close — its door at four metres, a window obliquely, the street from the door,
 * its front light square on — for the openings and the street furniture, per style.
 *
 *   cd control && node scripts/spikes/geotown/close.mjs [name] [cube|style …]
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
const [name = 'close', ...sets] = process.argv.slice(2);
const SETS = (sets.length ? sets : ['limestone-crags|']).map((s) => s.split('|'));
const W = 520, H = 400, rows = [], r3 = (v) => Math.round(v * 1000) / 1000;
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
  for (const [cube, style] of SETS) {
    const { payload: P } = await resolveWorldScene({ title: 'close', manifest: { kind: 'geocube', cube, show: 'town', walk: false, seed: 3, ...(style ? { style: style.startsWith('{') ? JSON.parse(style) : style } : {}) } });
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false }));
    const h = P.anchors.find((a) => a.kind === 'house'), N = h.N, T = [-N[1], N[0]], at = (n, t, z) => [h.at[0] + N[0] * n + T[0] * t, h.at[1] + N[1] * n + T[1] * t, h.floor + z].map(r3);
    // (the light nearest the door on its front, square on, whole in the frame)
    const lightCam = () => {
      const mid = (f) => f.corners.reduce((a, c) => a.map((v, k) => v + c[k] / f.corners.length), [0, 0, 0]);
      const front = P.faces.filter((f) => f.group === 'town:opening' && Math.abs(f.normal[0] * N[0] + f.normal[1] * N[1] - 1) < 0.05).map((f) => ({ f, m: mid(f) })).sort((a, b) => Math.hypot(a.m[0] - h.at[0], a.m[1] - h.at[1]) - Math.hypot(b.m[0] - h.at[0], b.m[1] - h.at[1]))[0];
      if (!front) return cam('the light', at(3.4, 2.2, 1.8), at(0, 2.2, 1.8), 50);
      const zs = front.f.corners.map((c) => c[2]), tall = Math.max(...zs) - Math.min(...zs), back = Math.max(2.2, (tall * 0.75) / Math.tan((25 * Math.PI) / 180));
      return cam('the light', [front.m[0] + N[0] * back, front.m[1] + N[1] * back, front.m[2]].map(r3), front.m.map(r3), 50);
    };
    const cam = (nm, from, to, fov) => ({ name: nm, worldFraming: { cameraPosition: from, lookAt: to, horizontalFov: fov } });
    const cams = [cam('door', at(4.2, 0.4, 1.6), at(0, 0, 1.3), 60), cam('window', at(2.2, 3.4, 1.6), at(0, 2.2, 1.6), 55), cam('from the door', at(1.6, 0, 1.7), at(14, -6, 1.2), 80), lightCam()];
    const cells = [];
    for (const c of cams) cells.push({ cap: c.name, src: await shoot(P, c) });
    rows.push({ cap: `${cube}${style ? ` · ${style.slice(0, 50)}` : ''}`, cells });
    console.log(rows[rows.length - 1].cap);
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(4,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 4 * W + 60, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
