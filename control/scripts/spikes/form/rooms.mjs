// ROOMS IN THE FORM RENDER (gen-7 indoors: form/room-form.js, era/stage.js, scene/channels/form.js): a handful of rooms,
// each read in gen-6 (the light painted into the tiles and baked into the corners) and gen-7 (the tiles read as
// material, the placed lights live, the nearest casting), written as walkable World pages, and captured side by side
// from each room's own eye. The machine gate: the page's form probe (lights, casters, materials made, each map's read)
// and each frame's mean luminance against its gen-6 twin. The look is the operator's.
//
//   node scripts/spikes/form/rooms.mjs [--out <dir>] [--only crypt,brick] [--no-capture] [--cdn]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'rooms-form')), only = arg('--only', null)?.split(','), capture = !process.argv.includes('--no-capture'), cdn = process.argv.includes('--cdn');

const stone = [176, 168, 150], mortar = [104, 98, 90];
// two rooms through a doorway, so a walk passes from one light to the next
const SUITE = [{ id: 'a', x: 0, y: 0, w: 10, d: 14, h: 6 }, { id: 'b', x: 0, y: 14, w: 10, d: 10, h: 5 }];
const LINK = [{ from: 'a', to: 'b' }];
export const ROOMS = {
  // the walls coursed brick, the pilasters fluted, the baseboard a course of long blocks, the floor worn slabs
  brick: { title: 'Brick hall', manifest: { kind: 'stage', kit: 'gothic-stone', rooms: SUITE, links: LINK, tiles: {
    wall: { gen: 'dressed', cut: 'brick', stone: [150, 78, 58], mortar: [188, 180, 166], rows: 13, cols: 4, grit: 0.35, scale: 1 },
    pillar: { gen: 'dressed', cut: 'fluted', stone, mortar, flutes: 14, grit: 0.4 },
    plinth: { gen: 'dressed', cut: 'ashlar', stone: [150, 144, 130], mortar, rows: 2, cols: 3, grit: 0.5 },
    floor: { gen: 'dressed', cut: 'ashlar', face: 'floor', stone: [160, 154, 140], mortar: [84, 80, 74], rows: 4, cols: 4, grit: 0.45 } } } },
  // ashlar under a lime render fallen away to it, fluted shafts, flagged floor
  render: { title: 'Rendered vault', manifest: { kind: 'stage', kit: 'gothic-stone', rooms: SUITE, links: LINK, tiles: {
    wall: { gen: 'dressed', cut: 'render', stone, mortar, rows: 4, cols: 2, grit: 0.6, loss: 0.45 },
    pillar: { gen: 'dressed', cut: 'shaft', stone, mortar, grit: 0.5 },
    floor: { gen: 'dressed', cut: 'ashlar', face: 'floor', stone: [140, 132, 120], mortar: [70, 66, 60], rows: 3, cols: 3, grit: 0.6 } } } },
  // the crypt as its kit builds it: stock tiles, read as material from their light
  crypt: { title: 'Crypt', manifest: { kind: 'stage', kit: 'gothic-stone', rooms: SUITE, links: LINK } },
  // a gritty cube's room: dressed as its outside's rock is drawn near, in its ramps' colours
  crags: { title: 'Limestone crags room', manifest: { kind: 'geocube', cube: 'limestone-crags', domain: { interior: 'room' } } },
  // the nave: arcades, columns, a vault, the shafts' pools of light
  nave: { title: 'Nave', manifest: { kind: 'stage', kit: 'gothic-nave', rooms: [{ id: 'a', x: 0, y: 0, w: 12, d: 24, h: 10 }] } },
};

const W = 1120, H = 700;
fs.mkdirSync(out, { recursive: true });
const pages = [];
for (const [name, R] of Object.entries(ROOMS)) {
  if (only && !only.includes(name)) continue;
  for (const era of ['gen-6', 'gen-7']) {
    const t0 = Date.now();
    const { payload } = await resolveWorldScene({ ref: `rooms-${name}`, title: `${R.title} · ${era}`, manifest: R.manifest }, { era, live: true });
    const ms = Date.now() - t0;
    const html = emitThreeWorld({ ...payload, title: `${R.title} · ${era}`, walk: payload.walk ?? true, inline: !cdn, cdn });
    const file = path.join(out, `${name}-${era}.html`);
    fs.writeFileSync(file, html);
    pages.push({ name, era, file, payload, ms });
    console.log(`${name} ${era}: ${ms} ms, ${payload.faces.length} faces, page ${(html.length / 1e6).toFixed(2)} MB${payload.form?.room ? `, ${payload.form.room.lights.length} lights, ${Object.keys(payload.form.room.maps).length} maps (${Object.values(payload.form.room.maps).filter((m) => m.read === 'relief').length} from relief)` : ''}`);
  }
}

if (capture) {
  const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
  const report = [];
  for (const p of pages) {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewport({ width: W, height: H });
    const html = emitThreeWorld({ ...p.payload, viewBox: { width: W, height: H }, inline: true, capture: true, hud: false, walk: false });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 180000 });
    const F = p.payload.cameras[0].worldFraming, cams = { wide: { pos: F.cameraPosition, target: F.lookAt, vfov: 60 } };
    // close: by the first torch, an arm's length off its wall, looking along it so the light rakes the relief
    const T = (p.payload.anchors || []).find((a) => a.kind === 'torch');
    if (T) { const n = T.N, t = [-n[1], n[0], 0]; cams.close = { pos: [T.at[0] + n[0] * 1.1 - t[0] * 1.8, T.at[1] + n[1] * 1.1 - t[1] * 1.8, 1.5], target: [T.at[0] + t[0] * 1.6, T.at[1] + t[1] * 1.6, 1.0], vfov: 55 }; }
    // two frames each: the first lays the casters on the nearest lights and draws their maps
    const res = {};
    for (const [shot, cam] of Object.entries(cams)) {
      res[shot] = await page.evaluate(async (cam) => {
        window.__mojCapture.frame(cam); await new Promise((r) => setTimeout(r, 400)); window.__mojCapture.frame(cam);
        const cv = document.querySelector('canvas'), c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
        const g = c2.getContext('2d'); g.drawImage(cv, 0, 0); const d = g.getImageData(0, 0, c2.width, c2.height).data;
        let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        const f = window.__mojForm;
        return { mean: +(s / (d.length / 4)).toFixed(1), form: f ? { lights: f.lights, casters: f.casters, on: f.on(), made: f.made, moves: f.moves } : null };
      }, cam);
      await (await page.$('#wrap')).screenshot({ path: path.join(out, `${p.name}-${p.era}${shot === 'wide' ? '' : `-${shot}`}.png`) });
    }
    report.push({ room: p.name, era: p.era, ...res, errors: errors.slice(0, 3) });
    console.log(p.name, p.era, JSON.stringify(res), errors.length ? `errors: ${errors.slice(0, 2).join(' | ')}` : '');
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
}
