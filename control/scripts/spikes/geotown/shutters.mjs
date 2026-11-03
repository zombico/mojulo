#!/usr/bin/env node
/**
 * SPIKE: an old town's shutter leaves up close (era/shutter-leaves.js, marched by channels/leaf-relief.js) — on three
 * houses far apart, the leaf nearest the door square on at 2.5 m, from the walk below it, and the front at 12 m; and the
 * page's probe (the maps, the materials patched).
 *
 *   cd control && node scripts/spikes/geotown/shutters.mjs [name] [segment]
 *     → ../lite-template/integration/1102/spike-output/<name>.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1102/spike-output');
mkdirSync(outDir, { recursive: true });
const [name = 'shutters', segment = 'main-street'] = process.argv.slice(2);
const W = 520, H = 400, r3 = (v) => Math.round(v * 1000) / 1000;
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const shoot = async (P, cam) => {
  const html = emitThreeWorld({ ...P, cameras: [{ ...cam, worldFraming: { ...cam.worldFraming, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H }, inline: true });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 5000));
  await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
  const probe = await page.evaluate(() => window.__mojLeaf ?? null);
  const el = await page.$('#wrap'), png = Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' }));
  await page.close();
  if (errs.length || !probe) console.log('page', JSON.stringify(probe), errs.slice(0, 3));
  return `data:image/png;base64,${png.toString('base64')}`;
};
const cells = [];
try {
  const { payload: P } = await resolveWorldScene({ title: 'shutters', manifest: { kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 3, geotown: { pattern: 'old-town', streetscape: 'old-centre', segment } } });
  P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false }));
  console.log('leaves', Object.keys(P.leaves?.maps ?? {}), 'faces', P.faces.length, 'leaf faces', P.faces.filter((f) => String(f.texture).startsWith('leaf:')).length);
  const mid = (f) => f.corners.reduce((a, c) => a.map((v, k) => v + c[k] / f.corners.length), [0, 0, 0]);
  const cam = (nm, from, to, fov) => ({ name: nm, worldFraming: { cameraPosition: from.map(r3), lookAt: to.map(r3), horizontalFov: fov } });
  const houses = P.anchors.filter((a) => a.kind === 'house'), picks = [];
  const leafOf = (h, form) => P.faces.filter((f) => f.texture === `leaf:${form}`).map((f) => ({ f, m: mid(f) })).filter((s) => s.m[2] - h.floor > 2.5).sort((a, b) => Math.hypot(a.m[0] - h.at[0], a.m[1] - h.at[1]) - Math.hypot(b.m[0] - h.at[0], b.m[1] - h.at[1]))[0];
  for (const form of ['persiana', 'panelled', 'ledged']) {
    const h = houses.map((h) => ({ h, s: leafOf(h, form) })).filter((x) => x.s && Math.hypot(x.s.m[0] - x.h.at[0], x.s.m[1] - x.h.at[1]) < 8)[0];
    if (h) picks.push({ form, ...h });
  }
  for (const { form, h, s } of picks) {
    const N = s.f.normal, T = [-N[1], N[0], 0], z = h.floor + 1.7;
    cells.push({ cap: `${form} · square on, 1.6 m`, src: await shoot(P, cam('sq', [s.m[0] + N[0] * 1.6, s.m[1] + N[1] * 1.6, s.m[2]], s.m, 50)) });
    cells.push({ cap: `${form} · oblique, 2 m`, src: await shoot(P, cam('ob', [s.m[0] + N[0] * 1.4 + T[0] * 1.4, s.m[1] + N[1] * 1.4 + T[1] * 1.4, s.m[2] - 0.4], s.m, 50)) });
    cells.push({ cap: `${form} · the front, 12 m`, src: await shoot(P, cam('fr', [s.m[0] + N[0] * 12, s.m[1] + N[1] * 12, z], [s.m[0], s.m[1], s.m[2]], 60)) });
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(3,${W}px);gap:8px}img{display:block;width:${W}px}figure{margin:0}</style><div class=r>${cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 3 * W + 50, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
