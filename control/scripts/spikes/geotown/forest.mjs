#!/usr/bin/env node
/**
 * SPIKE: a stage's trees (era/isekai.js treeFaces: the hollowed crowns, the clumps, the bands) — along the trail, near
 * on the clump closest to it, close on a crown, and from above over the whole level — per set, with its face counts.
 *
 *   cd control && node scripts/spikes/geotown/forest.mjs [name] [stage-json|caption …]
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
const [name = 'forest', ...sets] = process.argv.slice(2);
const SETS = (sets.length ? sets : [`${JSON.stringify({ kind: 'stage', kit: 'isekai-meadow', trail: {}, shading: { grit: 0.7 }, biocube: 'grove' })}|grove, gritty`]).map((s) => s.split('|'));
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
const mean = (cs) => [0, 1, 2].map((k) => cs.reduce((a, c) => a + c[k], 0) / cs.length);
try {
  for (const [json, caption] of SETS) {
    const t0 = Date.now(), { payload: P } = await resolveWorldScene({ title: 'forest', manifest: JSON.parse(json) });
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false }));
    const g = {}; for (const f of P.faces) g[f.group] = (g[f.group] ?? 0) + 1;
    const inst = (P.repeats ?? []).reduce((a, r) => a + r.transforms.length, 0), tpl = (P.repeats ?? []).reduce((a, r) => a + r.template.length, 0);
    // (the trail's line from its own faces; the crowns' centres)
    const trail = P.faces.filter((f) => f.group === 'isekai:trail').map((f) => mean(f.corners)), along = (y) => { const q = trail.filter((c) => Math.abs(c[1] - y) < 0.6); return mean(q.length ? q : trail); };
    const crowns = P.faces.filter((f) => f.group === 'isekai:crown').map((f) => mean(f.corners));
    const A = along(4), Bp = along(26), eye = [A[0], A[1], A[2] + 1.7];
    // the crown nearest the trail between y 8 and 30
    const near = crowns.filter((c) => c[1] > 8 && c[1] < 30).sort((a, b) => Math.abs(a[0] - along(a[1])[0]) - Math.abs(b[0] - along(b[1])[0]))[0] ?? Bp;
    const tn = along(near[1]), side = Math.sign(near[0] - tn[0]) || 1;
    const cam = (nm, from, to, fov) => ({ name: nm, worldFraming: { cameraPosition: from.map(r3), lookAt: to.map(r3), horizontalFov: fov } });
    const cams = [cam('along', eye, [Bp[0], Bp[1], Bp[2] + 2], 75), cam('near', [tn[0] - side * 1.5, near[1] - 6, tn[2] + 1.7], [near[0], near[1], near[2] - 1], 70),
      cam('crown', [near[0] - side * 4, near[1] - 4, near[2] + 0.5], near, 55), cam('above', [A[0] + 20, A[1] - 22, A[2] + 38], [A[0] + 4, A[1] + 34, A[2]], 70)];
    const cells = [];
    for (const c of cams) cells.push({ cap: c.name, src: await shoot(P, c) });
    rows.push({ cap: `${caption} — ${P.faces.length} faces (crown ${g['isekai:crown'] ?? 0}, leaves ${g['isekai:leaves'] ?? 0}, wood ${g['isekai:wood'] ?? 0}; repeats ${tpl} template faces × ${inst} instances), ${((Date.now() - t0) / 1000).toFixed(1)} s`, cells });
    console.log(rows[rows.length - 1].cap);
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(4,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 4 * W + 60, height: 500 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
