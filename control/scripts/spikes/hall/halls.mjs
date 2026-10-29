// HALLS (era/in-hall.js): rooms strung on a walk, the interior trail. A few halls, rolled from limestone-crags' interiors
// and one written on the crypt kit, each written as a walkable World page in gen-6 and gen-7, its plan drawn as a plate
// (the rooms by beat, the doorways, the mouth and the exit, the sightline from the mouth to the landmark, each room's
// ceiling), its laws listed, and captured from the mouth and from the squeeze into its reveal. The machine gate is the
// laws; the look is the operator's.
//
//   node scripts/spikes/hall/halls.mjs [--out <dir>] [--only crags-room,…] [--no-capture] [--cdn]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'halls')), only = arg('--only', null)?.split(','), capture = !process.argv.includes('--no-capture'), cdn = process.argv.includes('--cdn');

export const HALLS = {
  // the cube's own room (the crypt's bones, its stone dressed by grit) walked as a hall, its beats drawn by the seed
  'crags-room': { title: 'Crags crypt hall', manifest: { kind: 'geocube', cube: 'limestone-crags', show: 'hall', seed: 2 } },
  // the cube's temple hall (the nave's bones), a harder heartbeat and a longer walk
  'crags-temple': { title: 'Crags temple hall', manifest: { kind: 'geocube', cube: 'limestone-crags', domain: 'temple-hall', show: 'hall', seed: 5, hall: { heartbeat: 0.9, run: 15 } } },
  // written: the beats named, a door for a mouth, the crypt kit's own dressing
  'crypt-written': { title: 'Crypt hall, written', manifest: { kind: 'stage', kit: 'gothic-stone', seed: 3, hall: { beats: ['squeeze', 'pocket', 'landmark', 'squeeze', 'reveal', 'rest'], heartbeat: 1, run: 16, mouth: 'door' } } },
};

const BEAT_COLOUR = { squeeze: '#8a7f73', reveal: '#d6a24e', landmark: '#c2603e', pocket: '#6f8f6a', rest: '#6f86a6' };
/** The plan plate: rooms by beat, doorways, ports, the sightline, each room's ceiling. */
export function hallPlate(P) {
  const rooms = new Map((P.rooms || []).map((r) => [r.id, r])), beats = P.hall.beats, pad = 3;
  const xs = [...rooms.values()].flatMap((r) => [r.box.min[0], r.box.max[0]]), ys = [...rooms.values()].flatMap((r) => [r.box.min[1], r.box.max[1]]);
  const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad - 2, y1 = Math.max(...ys) + pad + 2, s = 10;
  // (the plan drawn with the walk going up the sheet: +y up)
  const X = (x) => ((x - x0) * s).toFixed(1), Y = (y) => ((y1 - y) * s).toFixed(1), W = ((x1 - x0) * s).toFixed(0), H = ((y1 - y0) * s).toFixed(0);
  const parts = [];
  for (const b of beats) {
    const r = rooms.get(b.room); if (!r) continue;
    const [a, c] = [r.box.min, r.box.max];
    parts.push(`<rect x="${X(a[0])}" y="${Y(c[1])}" width="${((c[0] - a[0]) * s).toFixed(1)}" height="${((c[1] - a[1]) * s).toFixed(1)}" fill="${BEAT_COLOUR[b.kind]}" fill-opacity="0.28" stroke="${BEAT_COLOUR[b.kind]}" stroke-width="2"/>`);
    parts.push(`<text x="${X((a[0] + c[0]) / 2)}" y="${Y((a[1] + c[1]) / 2)}" text-anchor="middle" font-size="12" fill="currentColor">${b.kind}</text>`);
    parts.push(`<text x="${X((a[0] + c[0]) / 2)}" y="${(+Y((a[1] + c[1]) / 2) + 14).toFixed(1)}" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.7">${r.h} m</text>`);
  }
  for (const d of (P.anchors || []).filter((a) => a.kind === 'doorway')) parts.push(`<circle cx="${X(d.at[0])}" cy="${Y(d.at[1])}" r="3.5" fill="currentColor"/>`);
  for (const p of P.hall.ports) {
    const tip = [p.at[0] + p.N[0] * 2.4, p.at[1] + p.N[1] * 2.4];
    parts.push(`<line x1="${X(p.at[0])}" y1="${Y(p.at[1])}" x2="${X(tip[0])}" y2="${Y(tip[1])}" stroke="currentColor" stroke-width="2"/><text x="${X(tip[0] + 0.6)}" y="${Y(tip[1])}" font-size="11" fill="currentColor">${p.id} (${p.as})</text>`);
  }
  const mouth = P.hall.ports.find((p) => p.id === 'mouth'), lm = beats.find((b) => b.kind === 'landmark'), L = lm && rooms.get(lm.room);
  if (mouth && L) parts.push(`<line x1="${X(mouth.at[0])}" y1="${Y(mouth.at[1] + 1.5)}" x2="${X((L.box.min[0] + L.box.max[0]) / 2)}" y2="${Y((L.box.min[1] + L.box.max[1]) / 2)}" stroke="#c2603e" stroke-width="1.5" stroke-dasharray="5 4"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, sans-serif">${parts.join('')}</svg>`;
}

const Wd = 1120, Ht = 700;
fs.mkdirSync(out, { recursive: true });
const pages = [];
for (const [name, R] of Object.entries(HALLS)) {
  if (only && !only.includes(name)) continue;
  for (const era of ['gen-6', 'gen-7']) {
    const t0 = Date.now(), { payload } = await resolveWorldScene({ ref: `hall-${name}`, title: `${R.title} · ${era}`, manifest: R.manifest }, { era, live: true });
    const html = emitThreeWorld({ ...payload, title: `${R.title} · ${era}`, walk: payload.walk ?? true, inline: !cdn, cdn });
    fs.writeFileSync(path.join(out, `${name}-${era}.html`), html);
    if (era === 'gen-6') {
      fs.writeFileSync(path.join(out, `${name}-plan.svg`), hallPlate(payload));
      fs.writeFileSync(path.join(out, `${name}-hall.json`), JSON.stringify({ title: R.title, manifest: R.manifest, beats: payload.hall.beats, ports: payload.hall.ports, laws: payload.hall.laws,
        rooms: payload.rooms.map((r) => ({ id: r.id, h: r.h, w: +(r.box.max[0] - r.box.min[0]).toFixed(2), d: +(r.box.max[1] - r.box.min[1]).toFixed(2) })) }, null, 2));
    }
    pages.push({ name, era, payload });
    const bad = payload.hall.laws.filter((l) => !l.ok);
    console.log(`${name} ${era}: ${Date.now() - t0} ms, ${payload.faces.length} faces, page ${(html.length / 1e6).toFixed(2)} MB, beats ${payload.hall.beats.map((b) => b.kind).join(' → ')}, laws ${bad.length ? `FAILING ${bad.map((l) => `${l.law} (${l.value})`).join(', ')}` : 'all hold'}`);
  }
}

if (capture) {
  const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
  for (const p of pages) {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewport({ width: Wd, height: Ht });
    await page.setContent(emitThreeWorld({ ...p.payload, viewBox: { width: Wd, height: Ht }, inline: true, capture: true, hud: false, walk: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 180000 });
    // the mouth: a step inside, looking down the walk; the reveal: from the squeeze before it, into it
    const A = p.payload.anchors, beat = (k) => A.find((a) => a.kind === 'beat' && a.beat === k), mouth = A.find((a) => a.kind === 'port' && a.port === 'mouth');
    const cams = { mouth: { pos: [mouth.at[0], mouth.at[1] + 1.2, 1.7], target: [mouth.at[0], mouth.at[1] + 20, 2.4], vfov: 62 } };
    const spine = p.payload.hall.beats.filter((b) => b.spine), ri = spine.findIndex((b) => b.kind === 'reveal');
    if (ri > 0) {
      const from = A.find((a) => a.id === `beat-${spine[ri - 1].id}`), to = beat('reveal'), room = p.payload.rooms.find((r) => r.id === to.room);
      cams.reveal = { pos: [from.at[0], from.at[1], 1.6], target: [to.at[0], to.at[1], room.h * 0.55], vfov: 66 };
    }
    for (const [shot, cam] of Object.entries(cams)) {
      await page.evaluate(async (cam) => { window.__mojCapture.frame(cam); await new Promise((r) => setTimeout(r, 400)); window.__mojCapture.frame(cam); }, cam);
      await (await page.$('#wrap')).screenshot({ path: path.join(out, `${p.name}-${p.era}-${shot}.png`) });
    }
    console.log(p.name, p.era, Object.keys(cams).join(', '), errors.length ? `errors: ${errors.slice(0, 2).join(' | ')}` : 'no page errors');
    await page.close();
  }
  await browser.close();
}
