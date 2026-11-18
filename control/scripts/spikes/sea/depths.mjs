// THE SEA AT ITS DEPTHS (scene/channels/sea.js): one geocube land, put under each zone's water by its light alone, shot
// from the walk (level, up at the surface, down the trail) so the zones can be read side by side. The machine gate: no
// page errors, the fog chunk patched, each zone's mean luminance under the one above it; the look is the operator's.
//
//   node scripts/spikes/sea/depths.mjs [--out <dir>] [--cube island-noon] [--show path] [--zones shallows,reef,…]
//     [--water ocean] [--sea '{"torch":true}'] [--lamps] [--hour noon] [--biocube <id>] [--with '{"trail":{"ground":{"dunes":true}}}'] [--dry]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { SEA } = await import('@/lib/graph/scene/channels/sea');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'sea')), W = 960, H = 600;
const cube = arg('--cube', 'island-noon'), show = arg('--show', 'path'), water = arg('--water', 'ocean'), over = JSON.parse(arg('--sea', '{}'));
const zones = arg('--zones', Object.keys(SEA.zones).join(',')).split(','), hour = arg('--hour'), biocube = arg('--biocube'), lamps = process.argv.includes('--lamps'), more = JSON.parse(arg('--with', '{}'));
fs.mkdirSync(out, { recursive: true });

const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
const rows = [];
for (const zone of [...(process.argv.includes('--dry') ? [null] : []), ...zones]) {
  const base = { kind: 'geocube', cube, show, ...(hour ? { hour: /^[\d.]+$/.test(hour) ? Number(hour) : hour } : {}), ...(biocube ? { biocube } : {}), ...more };
  // (the lamps hang where the walk goes: read off the dry payload's spawn, so a zone's page carries them as its recipe would)
  let sea = zone ? { zone, water, ...over } : undefined;
  const { payload: P0 } = await resolveWorldScene({ ref: 'sea-0', title: 'sea', manifest: base }, { era: 'gen-7', live: true });
  const sp0 = P0.walk?.spawn ?? [0, 0, 1.7], sp = [sp0[0], sp0[1], sp0[2] - (P0.walk?.minEye ?? 0)], beats = (P0.anchors || []).filter((a) => a.kind === 'beat');
  const fwd = beats.length > 1 ? ((d) => { const m = Math.hypot(d[0], d[1]) || 1; return [d[0] / m, d[1] / m]; })([beats[1].at[0] - sp[0], beats[1].at[1] - sp[1]]) : [0, 1];
  if (zone && lamps) sea = { ...sea, lamps: [
    { at: [sp[0] + fwd[0] * 9 - fwd[1] * 3, sp[1] + fwd[1] * 9 + fwd[0] * 3, sp[2] + 3.2], colour: '#ffd9a0', power: 30 },
    { at: [sp[0] + fwd[0] * 20 + fwd[1] * 4, sp[1] + fwd[1] * 20 - fwd[0] * 4, sp[2] + 5], aim: [sp[0] + fwd[0] * 24, sp[1] + fwd[1] * 24, sp[2]], cone: 60, colour: '#cfe8ff', power: 90 },
  ] };
  const t = Date.now(), { payload } = zone ? await resolveWorldScene({ ref: `sea-${zone}`, title: `the sea, ${zone}`, manifest: { ...base, sea } }, { era: 'gen-7', live: true }) : { payload: P0 };
  const eye = [sp[0], sp[1], sp[2] + 1.7], cams = {
    level: { pos: eye, target: [eye[0] + fwd[0] * 20, eye[1] + fwd[1] * 20, eye[2] + 1], vfov: 70 },
    up: { pos: eye, target: [eye[0] + fwd[0] * 10, eye[1] + fwd[1] * 10, eye[2] + 14], vfov: 80 },
    back: { pos: [eye[0] + fwd[0] * 26, eye[1] + fwd[1] * 26, eye[2] + 2.5], target: [eye[0], eye[1], eye[2] - 0.5], vfov: 70 },
  };
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { // (a gen-7 land page logs a draw-buffer warning with or without the sea: `--dry` shows it; not this channel's)
    if ((m.type() === 'error' || /shader|GLSL|ERROR/i.test(m.text())) && !/missing fragment shader outputs/.test(m.text())) errors.push(m.text().slice(0, 600)); });
  await page.setViewport({ width: W, height: H });
  await page.setContent(emitThreeWorld({ ...payload, viewBox: { width: W, height: H }, inline: true, capture: true, hud: false, walk: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 300000 });
  const lum = {};
  for (const [shot, cam] of Object.entries(cams)) {
    await page.evaluate(async (c) => { window.__mojClock = 2500; window.__mojCapture.frame(c); await new Promise((r) => setTimeout(r, 500)); window.__mojCapture.frame(c); }, cam);
    const file = path.join(out, `${zone ?? 'dry'}-${shot}.png`);
    await (await page.$('#wrap')).screenshot({ path: file });
    // (the shot's mean luminance, read off the PNG itself: the page's canvas keeps no drawing buffer to read back)
    lum[shot] = await page.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const x = document.createElement('canvas'); x.width = 96; x.height = 60; const g = x.getContext('2d'); g.drawImage(im, 0, 0, 96, 60); const d = g.getImageData(0, 0, 96, 60).data; let a = 0; for (let i = 0; i < d.length; i += 4) a += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return Math.round((a / (d.length / 4)) * 10) / 10; }, fs.readFileSync(file).toString('base64'));
  }
  const probe = await page.evaluate(() => (window.__mojSea ? { chunk: window.__mojSea.chunk(), snow: window.__mojSea.snow, surface: window.__mojSea.surface } : null));
  rows.push({ zone: zone ?? 'dry', lum: lum.level });
  console.log(`${(zone ?? 'dry').padEnd(9)} ${Date.now() - t} ms  lum ${JSON.stringify(lum)}  ${JSON.stringify(probe)}  ${errors.length ? `ERRORS: ${[...new Set(errors)].slice(0, 3).join(' | ')}` : 'no page errors'}`);
  await page.close();
}
await browser.close();
const wet = rows.filter((r) => r.zone !== 'dry');
console.log(wet.every((r, i) => !i || r.lum <= wet[i - 1].lum) ? 'gate: each zone darker than the one above it' : 'GATE FAILED: a deeper zone reads lighter');
process.exit(0);
