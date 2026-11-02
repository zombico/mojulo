#!/usr/bin/env node
/**
 * SPIKE: a geocity plumb and under each hand (a name, or JSON terms), from its own cameras (its skyline, over it, its
 * core, its street) and two near its first block: one row a hand.
 *
 *   LOOK='[[name, [x, y, z], [x, y, z], fov], …]' cameras of its own (metres) in place of the two near its houses; HOUR=<hour>
 *   CAMS=<name,…> which of its own cameras (an evoked metro's: evoked, street, crossing); GEOCITY='{…}' another metro
 *   cd control && node scripts/spikes/geocity/loud.mjs <out-dir> [hand …]   → <out-dir>/loud.png and .html
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('../../../lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const [outArg, ...hands0] = process.argv.slice(2);
if (!outArg) { console.error('usage: loud.mjs <out-dir> [hand …]'); process.exit(1); }
const outDir = path.resolve(outArg), hands = ['plumb', ...(hands0.length ? hands0 : ['street'])], W = 600, H = 420;
mkdirSync(outDir, { recursive: true });
const GEOCITY = process.env.GEOCITY ? JSON.parse(process.env.GEOCITY) : { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const shoot = async (P, cam) => {
  const html = emitThreeWorld({ ...P, cameras: [{ ...cam, worldFraming: { ...cam.worldFraming, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H }, inline: true });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
  await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 6000));
  await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
  const el = await page.$('#wrap'), png = Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' }));
  await page.close();
  return `data:image/png;base64,${png.toString('base64')}`;
};
const rows = [];
let cams = null;
try {
  for (const hand of hands) {
    const [h0, reg] = hand.split('@'), cube = h0 === 'plumb' ? 'valley-morning' : { from: 'valley-morning', exaggerate: h0.startsWith('{') ? JSON.parse(h0) : h0, ...(reg ? { register: reg } : {}) };
    const { payload: P } = await resolveWorldScene({ title: 'metro', manifest: { kind: 'geocube', cube, show: 'geocity', seed: 2, hour: process.env.HOUR || 'afternoon', walk: false, geocity: GEOCITY } });
    P.walkers = (P.walkers || []).map((w) => ({ ...w, follow: false })); delete P.walk; delete P.route;
    if (!cams) {
      // (its own cameras, and two near a house of its outskirts: a corner of houses and the walk before them)
      const own = (P.cameras || []).filter((c) => (process.env.CAMS ? process.env.CAMS.split(',') : ['over', 'core', 'street']).includes(c.name));
      const mid = (f) => f.corners.reduce((a, c) => a.map((v, k) => v + c[k] / f.corners.length), [0, 0, 0]);
      const hs = P.faces.filter((f) => f.group === 'geocity:house').map(mid), q = hs[Math.floor(hs.length / 3)];
      // (LOOK='[[name, [x, y, z], [x, y, z], fov], …]': cameras of its own, in metres, after its named ones)
      const look = process.env.LOOK ? JSON.parse(process.env.LOOK).map(([name, from, to, fov]) => ({ name, worldFraming: { cameraPosition: from, lookAt: to, horizontalFov: fov } })) : [];
      if (look.length) { cams = [...own, ...look]; } else
      cams = [...own, ...(q ? [{ name: 'its houses', worldFraming: { cameraPosition: [q[0] + 40, q[1] - 35, q[2] + 22], lookAt: q, horizontalFov: 60 } }, { name: 'a row of them', worldFraming: { cameraPosition: [q[0] + 14, q[1] - 22, q[2] + 2], lookAt: [q[0] - 10, q[1] + 20, q[2]], horizontalFov: 68 } }] : [])];
    }
    const cells = [];
    for (const c of cams) cells.push({ cap: c.name, src: await shoot(P, c) });
    rows.push({ cap: hand.length > 60 ? `${hand.slice(0, 60)}…` : hand, cells });
    console.log(rows[rows.length - 1].cap, P.faces.length, 'faces');
  }
} finally { await browser.close(); }
const n = cams.length;
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:14px system-ui}.r{display:grid;grid-template-columns:repeat(${n},${W}px);gap:8px;margin-bottom:16px}img{display:block;width:${W}px}figure{margin:0}figcaption{opacity:.7;margin-top:3px}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cap}</h3><div class=r>${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(outDir, 'loud.html'), page);
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: n * W + 20 + n * 8, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, 'loud.png'), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, 'loud.png'));
