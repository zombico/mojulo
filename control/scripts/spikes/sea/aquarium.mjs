// A SEABED LAID AS AN AQUARIUM (marine/, scene/channels/marine.js) under the sea (scene/channels/sea.js): a scene from
// words, or a cube with the `seabed` biocube on low dunes, shot along its walk, at a rock, down on the bed and across a
// stand. The machine gate: no page errors, the flora on the page as the placer laid it; the look is the operator's.
//
//   node scripts/spikes/sea/aquarium.mjs [--out <dir>] [--words 'an underwater coral reef'] [--zones shallows,reef,…]
//     [--mix reef|kelp|meadow|wall|deep|vents] [--density 1] [--seed 1] [--sea '{"torch":true}'] [--sheet]
//     [--fauna 'sharks and rays' | --fauna '{"cast":{"seaTurtle":2}}' | --no-fauna]   who lives there (marine/fauna.js); [--near 2.2] how many lengths off each is shot from
//   --sheet   every kind of the roster stood in rows on bare sand, in its colours (no sea: the forms themselves)
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { sceneOfWords } = await import('@/lib/graph/gameworld/scene-words');
const { MARINE_KINDS, MARINE_KIND_IDS } = await import('@/lib/graph/marine/roster');
const { templateOf } = await import('@/lib/graph/marine/place');
const { marineInput } = await import('@/lib/graph/scene/channels/marine');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'aquarium')), W = 1120, H = 700, seed = Number(arg('--seed', 1));
const words = arg('--words'), zones = arg('--zones', 'reef').split(','), mix = arg('--mix'), density = Number(arg('--density', 1)), over = JSON.parse(arg('--sea', '{}')), sheet = process.argv.includes('--sheet');
const faunaArg = arg('--fauna'), fauna = process.argv.includes('--no-fauna') ? null : faunaArg === undefined ? true : faunaArg.trim().startsWith('{') ? JSON.parse(faunaArg) : faunaArg;
fs.mkdirSync(out, { recursive: true });

const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
const shoot = async (name, payload, cams) => {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // (a gen-7 land page logs a draw-buffer warning with or without this: not these channels')
  page.on('console', (m) => { if ((m.type() === 'error' || /shader|GLSL|ERROR/i.test(m.text())) && !/missing fragment shader outputs/.test(m.text())) errors.push(m.text().slice(0, 600)); });
  await page.setViewport({ width: W, height: H });
  await page.setContent(emitThreeWorld({ ...payload, viewBox: { width: W, height: H }, inline: true, capture: true, hud: false, walk: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 300000 });
  for (const [shot, cam] of Object.entries(cams)) {
    await page.evaluate(async (c) => { window.__mojClock = 2500; window.__mojCapture.frame(c); await new Promise((r) => setTimeout(r, 500)); window.__mojCapture.frame(c); }, cam);
    await (await page.$('#wrap')).screenshot({ path: path.join(out, `${name}-${shot}.png`) });
  }
  const probe = await page.evaluate(() => (window.__mojMarine ? { count: window.__mojMarine.count, tris: window.__mojMarine.tris, templates: window.__mojMarine.templates } : null));
  console.log(`${name.padEnd(14)} page ${JSON.stringify(probe)}  ${errors.length ? `ERRORS: ${[...new Set(errors)].slice(0, 3).join(' | ')}` : 'no page errors'}`);
  await page.close();
  return { probe, errors };
};

let fail = false;
if (sheet) {
  // every kind in its colours, in rows on the bare bed by the walk's start, dry (the forms as the light finds them)
  const { payload } = await resolveWorldScene({ ref: 'marine-sheet', title: 'marine sheet', manifest: { kind: 'geocube', cube: { from: 'island-noon', outside: { cliff: false, dunes: { supply: 0.5 }, land: { skin: 'sandstone' } } }, show: 'path', biocube: 'seabed' } }, { era: 'gen-7', live: true });
  const { seabedGrid } = await import('@/lib/graph/marine/place');
  const G = seabedGrid(payload.faces), sp = payload.walk.spawn, beats = (payload.anchors || []).filter((a) => a.kind === 'beat');
  const fwd = ((d) => { const m = Math.hypot(d[0], d[1]) || 1; return [d[0] / m, d[1] / m]; })([beats[1].at[0] - sp[0], beats[1].at[1] - sp[1]]), right = [fwd[1], -fwd[0]];
  // (a line of kinds along the walk, 7 m off it on the open bed, each kind's colours stepping away from the camera)
  const groups = [], at = (i, c) => { const x = sp[0] + fwd[0] * (2 + i * 2.6) + right[0] * (7 + c * 1.5), y = sp[1] + fwd[1] * (2 + i * 2.6) + right[1] * (7 + c * 1.5); return [x, y, G.z(x, y) ?? sp[2] - 1.7]; };
  MARINE_KIND_IDS.forEach((kind, ki) => MARINE_KINDS[kind].colours.forEach((_, c) => groups.push({ ...templateOf(kind, c % 3, c), items: [...at(ki, c), 0.6 * c, 1, 0, 0] })));
  payload.marine = marineInput({ groups, count: groups.length }, { sun: payload.sky?.sun?.dir, light: payload.form?.land?.light });
  const cams = Object.fromEntries([0, 1, 2].map((r) => { const m = at(r * 5 + 2, 0.5), e = [m[0] - right[0] * 6.2, m[1] - right[1] * 6.2, m[2] + 1.9]; return [`row${r}`, { pos: e, target: [m[0] + right[0] * 2, m[1] + right[1] * 2, m[2] + 0.5], vfov: 66 }]; }));
  fail = (await shoot('sheet', payload, cams)).errors.length > 0;
} else {
  for (const zone of zones) {
    const marine = mix || density !== 1 ? { ...(mix ? { mix } : {}), density } : true;
    const base = words ? sceneOfWords(words, { seed }) : { cube: { from: 'island-noon', outside: { cliff: false, dunes: { supply: 0.5 }, land: { skin: 'sandstone' } } }, show: 'path' };
    const manifest = { kind: 'geocube', ...base, seed, biocube: { from: 'seabed', flora: { marine }, ...(fauna ? { fauna: { sea: fauna } } : {}) }, sea: { zone, ...over } };
    delete manifest.brief;
    const t = Date.now(), { payload } = await resolveWorldScene({ ref: `aquarium-${zone}`, title: `a seabed, ${zone}`, manifest }, { era: 'gen-7', live: true });
    const R = payload.geocube?.marine, sp = payload.walk.spawn, eye = sp, beats = (payload.anchors || []).filter((a) => a.kind === 'beat');
    console.log(`${zone.padEnd(9)} ${Date.now() - t} ms  ${R ? `${R.mix}: ${payload.marine.count} copies in ${payload.marine.groups.length} templates, ${R.rocks} rocks of ${R.patches} patches on ${R.ground} m²  ${JSON.stringify(R.kinds)}${R.left ? `  left out: ${R.left.map((l) => l.kind).join(', ')}` : ''}${R.thinned ? `  thinned to ${R.thinned}` : ''}` : 'NO MARINE'}`);
    const FA = R?.fauna;
    if (FA) console.log(`          who lives there: ${FA.cast.map((c) => `${c.species}×${c.count} (${c.lives})`).join(', ')}; ${FA.bodies} bodies, ${FA.bones} bones${FA.left ? `; left out: ${FA.left.map((l) => `${l.species} (${l.why})`).join('; ')}` : ''}${FA.offered ? `; also lives here: ${FA.offered.join(', ')}` : ''}${FA.rigid ? `; in rigid parts (its skin does not hold the blend): ${FA.rigid.map((r) => `${r.species} ${r.stretch}`).join(', ')}` : ''}`);
    const fwd = beats.length > 1 ? ((d) => { const m = Math.hypot(d[0], d[1]) || 1; return [d[0] / m, d[1] / m]; })([beats[1].at[0] - sp[0], beats[1].at[1] - sp[1]]) : [0, 1];
    // (the nearest rock ahead of the walk's start, seen from the trail's side of it; and the bed from over it)
    const rocks = (payload.marine?.groups ?? []).filter((g) => g.kind === 'bommie').flatMap((g) => Array.from({ length: g.items.length / 7 }, (_, i) => g.items.slice(i * 7, i * 7 + 3)));
    const ahead = rocks.filter((r) => (r[0] - sp[0]) * fwd[0] + (r[1] - sp[1]) * fwd[1] > 4).sort((a, b) => Math.hypot(a[0] - sp[0], a[1] - sp[1]) - Math.hypot(b[0] - sp[0], b[1] - sp[1]))[0] ?? [sp[0] + fwd[0] * 10, sp[1] + fwd[1] * 10, sp[2] - 1.7];
    const from = ((d) => { const m = Math.hypot(d[0], d[1]) || 1; return [d[0] / m, d[1] / m]; })([sp[0] - ahead[0], sp[1] - ahead[1]]);
    const cams = {
      walk: { pos: eye, target: [eye[0] + fwd[0] * 20, eye[1] + fwd[1] * 20, eye[2] - 0.3], vfov: 72 },
      rock: { pos: [ahead[0] + from[0] * 5.2, ahead[1] + from[1] * 5.2, ahead[2] + 1.5], target: [ahead[0], ahead[1], ahead[2] + 0.7], vfov: 58 },
      close: { pos: [ahead[0] + from[0] * 2.6 - from[1] * 1.2, ahead[1] + from[1] * 2.6 + from[0] * 1.2, ahead[2] + 1.0], target: [ahead[0], ahead[1], ahead[2] + 0.8], vfov: 55 },
      over: { pos: [ahead[0] + from[0] * 9, ahead[1] + from[1] * 9, ahead[2] + 9], target: [ahead[0] - from[0] * 4, ahead[1] - from[1] * 4, ahead[2]], vfov: 62 },
    };
    // (one of each habit met where its loop begins, from a few lengths off)
    for (const h of ['reef', 'school', 'cruise', 'bed', 'anemone']) { const w = (payload.walkers || []).find((x) => x.style === `sea:${h}`); if (!w) continue; const p = w.path[0], q = w.path[2], L = Math.max(1.2, w.stride * Number(arg('--near', 2.2))), d = ((v) => { const m = Math.hypot(v[0], v[1]) || 1; return [v[0] / m, v[1] / m]; })([q[0] - p[0], q[1] - p[1]]); cams[`fauna-${h}`] = { pos: [p[0] + d[1] * L + d[0] * L * 0.4, p[1] - d[0] * L + d[1] * L * 0.4, p[2] + L * 0.25], target: p, vfov: 50 }; }
    const r = await shoot(`${zone}${mix ? `-${mix}` : ''}`, payload, cams);
    if (r.errors.length || !r.probe || r.probe.count !== payload.marine.count) fail = true;
  }
}
await browser.close();
console.log(fail ? 'GATE FAILED' : 'gate: no page errors, the flora on the page as it was laid');
process.exit(0);
