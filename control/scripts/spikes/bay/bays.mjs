// THE BAY KITS (era/bay.js, style/bay-kits.js): a corridor opening into a tall bay, in each register, read in gen-6 and
// gen-7, written as walkable World pages and captured from the corridor, inside the bay and up at its roof. The machine
// gate: no page errors, the shell's structure (beams, lamps, crane, catwalk, layers) and each frame's mean beside its
// gen-6 twin. The look is the operator's.
//
//   node scripts/spikes/bay/bays.mjs [--out <dir>] [--only military,utility] [--no-capture] [--cdn]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { assembleStageScene } = await import('@/lib/graph/era/stage');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'bay-kits')), only = arg('--only', null)?.split(','), capture = !process.argv.includes('--no-capture'), cdn = process.argv.includes('--cdn');
// a corridor (a squeeze) into a tall bay (the reveal)
// a corridor (a squeeze) into a tall bay (the reveal), on into a second bay (its roof by its own dice)
const SUITE = { rooms: [{ id: 'corridor', x: 0, y: 0, w: 6, d: 12, h: 3.5 }, { id: 'bay', x: -6, y: 12, w: 18, d: 30, h: 12 }, { id: 'bay-2', x: -4, y: 42, w: 14, d: 24, h: 9 }], links: [{ from: 'corridor', to: 'bay' }, { from: 'bay', to: 'bay-2' }] };
// and a hall on the kit, to walk (the in-hall grammar: a squeeze, a reveal, the landmark, a squeeze, a rest)
const HALL = { seed: 4, hall: { beats: ['squeeze', 'reveal', 'landmark', 'squeeze', 'rest'], height: 7, heartbeat: 0.9, run: 16, mouth: 'door' } };
const CAMS = {
  corridor: { pos: [3, 1.2, 1.7], target: [3, 20, 2.6], vfov: 62 },
  bay: { pos: [-4.2, 14, 1.7], target: [8, 36, 4.5], vfov: 66 },
  roof: { pos: [8, 38, 1.8], target: [0, 20, 9], vfov: 70 },
  catwalk: { pos: [2, 30, 5.9], target: [10, 18, 4.5], vfov: 70 },
  'bay-2': { pos: [3, 44.5, 1.7], target: [3, 64, 5], vfov: 66 },
  // (the services up close: a breaker panel by the doorway, the soffit with its panel out over the corridor)
  services: { pos: [1.2, 7.5, 1.6], target: [4.6, 12, 1.2], vfov: 60 },
  soffit: { pos: [3, 10.5, 1.5], target: [3, 3, 3.7], vfov: 70 },
  // (the air: up at the duct's line in the bay)
  air: { pos: [1, 19, 1.7], target: [-2.2, 30, 9.5], vfov: 66 },
  // (the glass: the booth in its corner, a ribbon of windows up a long wall)
  booth: { pos: [5, 24, 1.7], target: [-4, 15.5, 1.3], vfov: 62 },
  window: { pos: [7, 27, 1.7], target: [-6, 34, 7.5], vfov: 66 },
  louvre: { pos: [3, 30, 2], target: [3, 12, 7.5], vfov: 70 },
};
const W = 1120, H = 700;
fs.mkdirSync(out, { recursive: true });
const pages = [];
for (const reg of ['military', 'utility', 'science', 'everyday']) {
  if (only && !only.includes(reg)) continue;
  const manifest = { kind: 'stage', kit: `bay-${reg}`, ...SUITE };
  const B = assembleStageScene(manifest, {}).bay;
  console.log(`${reg}: ${B.rooms.map((r) => `${r.id} ${r.roof}`).join(', ')}; laws ${B.laws.map((l) => `${l.law} ${l.ok ? 'ok' : 'NO'}`).join(', ')}`);
  for (const era of ['gen-6', 'gen-7']) {
    const hall = { kind: 'stage', kit: `bay-${reg}`, ...HALL }, { payload } = await resolveWorldScene({ ref: `bay-hall-${reg}`, title: `Bay hall · ${reg} · ${era}`, manifest: hall }, { era, live: true });
    fs.writeFileSync(path.join(out, `hall-${reg}-${era}.html`), emitThreeWorld({ ...payload, title: `Bay hall · ${reg} · ${era}`, walk: payload.walk ?? true, inline: !cdn, cdn }));
  }
  for (const era of ['gen-6', 'gen-7']) {
    const t0 = Date.now();
    const { payload } = await resolveWorldScene({ ref: `bay-${reg}`, title: `Bay · ${reg} · ${era}`, manifest }, { era, live: true });
    const ms = Date.now() - t0, html = emitThreeWorld({ ...payload, title: `Bay · ${reg} · ${era}`, walk: payload.walk ?? true, inline: !cdn, cdn });
    const file = path.join(out, `${reg}-${era}.html`);
    fs.writeFileSync(file, html);
    pages.push({ reg, era, payload });
    console.log(`${reg} ${era}: ${ms} ms, ${payload.faces.length} faces, page ${(html.length / 1e6).toFixed(2)} MB${payload.form?.room ? `, ${payload.form.room.lights.length} lamps` : ''}`);
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
    await page.setContent(emitThreeWorld({ ...p.payload, viewBox: { width: W, height: H }, inline: true, capture: true, hud: false, walk: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 180000 });
    const res = {};
    for (const [shot, cam] of Object.entries(CAMS)) {
      res[shot] = await page.evaluate(async (cam) => {
        window.__mojCapture.frame(cam); await new Promise((r) => setTimeout(r, 400)); window.__mojCapture.frame(cam);
        const cv = document.querySelector('canvas'), c2 = document.createElement('canvas'); c2.width = cv.width; c2.height = cv.height;
        const g = c2.getContext('2d'); g.drawImage(cv, 0, 0); const d = g.getImageData(0, 0, c2.width, c2.height).data;
        let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        return +(s / (d.length / 4)).toFixed(1);
      }, cam);
      await (await page.$('#wrap')).screenshot({ path: path.join(out, `${p.reg}-${p.era}-${shot}.png`) });
    }
    report.push({ register: p.reg, era: p.era, means: res, errors: errors.slice(0, 3) });
    console.log(p.reg, p.era, JSON.stringify(res), errors.length ? `errors: ${errors.slice(0, 2).join(' | ')}` : 'no page errors');
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
}
