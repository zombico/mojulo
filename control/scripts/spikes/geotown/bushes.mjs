#!/usr/bin/env node
/**
 * SPIKE: bushes and shrubs composed in sections (era/thickets.js through the biocube's `flora.bushes`) — a hedge that
 * blocks, low brush walked through, a mixed section, and the hedge on a quiet land: the section nearest the middle of
 * the trail from the trail, close, and the level from above; each row's faces, sections, colliders and soft groups.
 *
 *   cd control && node scripts/spikes/geotown/bushes.mjs [name]
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
const [name = 'bushes'] = process.argv.slice(2);
const HEDGE = { kinds: [{ form: 'spray', height: [1.2, 1.8], spread: 0.55, leaf: 1, walk: 'block' }], sections: { count: 7, radius: [2, 4], fill: 0.6 } };
const ROWS = [
  ['a hedge that blocks (spray, 1.2–1.8 m, deep leaf)', HEDGE, { grit: 0.7 }],
  ['low brush walked through (tuft, 0.4–0.8 m, seven stems, young leaf)', { kinds: [{ form: 'tuft', height: [0.4, 0.8], spread: 0.8, stems: 7, leaf: 2, walk: 'through' }], sections: { count: 8, radius: [2, 4.5], fill: 0.8 } }, { grit: 0.7 }],
  ['mixed: turned whorls walked through, birch-barked weeping shrubs that block', { kinds: [{ form: 'whorl', height: [0.6, 1.0], leaf: 3, walk: 'through', share: 2 }, { form: 'weep', height: [1.0, 1.6], bark: 4, barkForm: 'banded', walk: 'block' }], sections: { count: 8 } }, { grit: 0.7 }],
  ['the hedge on a quiet land (its lobes the crown\'s masses)', HEDGE, true],
];
const W = 440, H = 330, r3 = (v) => Math.round(v * 1000) / 1000;
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
const cam = (from, to, fov = 60) => ({ name: 'v', worldFraming: { cameraPosition: from.map(r3), lookAt: to.map(r3), horizontalFov: fov } });
const site = outTrailSite(ISEKAI_STYLES['isekai-meadow'], {}, 1), mid = site.D / 2;
const rows = [];
try {
  for (const [cap, bushes, shading] of ROWS) {
    const { payload: P } = await resolveWorldScene({ title: 'bushes', manifest: { kind: 'stage', kit: 'isekai-meadow', trail: {}, shading, biocube: { from: 'forest', flora: { bushes } } } });
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false }));
    const S = P.anchors.filter((a) => a.kind === 'thicket'), A = S.sort((a, b) => Math.abs(a.at[1] - mid) - Math.abs(b.at[1] - mid))[0];
    const ty = A.at[1] - 7, tx = site.trailX(ty), side = Math.sign(A.at[0] - tx) || 1;
    const views = [
      ['the section from the trail', cam([tx, ty, site.ground(tx, ty) + 1.7], [A.at[0], A.at[1], A.at[2] + 0.6], 62)],
      ['close', cam([A.at[0] - side * (A.radius + 2.5), A.at[1] - 2, A.at[2] + 2.1], [A.at[0], A.at[1], A.at[2] + 0.4], 66)],
      ['from above', cam([site.W * 0.5, -14, 46], [site.W * 0.5, site.D * 0.5, 0], 70)],
    ];
    const cells = [];
    for (const [c, v] of views) cells.push({ cap: c, src: await shoot(P, v) });
    const cols = P.colliders.filter((c) => /^thicket/.test(c.of)).length;
    rows.push({ cap: `${cap} — ${P.faces.length} faces, ${S.length} sections (${S.reduce((a, s) => a + s.bushes, 0)} bushes), ${cols} colliders, soft: ${(P.soft || []).filter((g) => g.startsWith('flora:brush')).length ? 'yes' : 'no'}`, cells });
    console.log(rows.at(-1).cap);
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(3,${W}px);gap:8px;margin-bottom:14px}img{display:block;width:${W}px}figure{margin:0}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 3 * W + 60, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, `${name}.png`));
