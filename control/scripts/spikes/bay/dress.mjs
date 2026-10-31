// THE DRESSING SEEN (era/compose-dress.js): a composed building per register laid with its default things, read in gen-7
// and captured from across its landmark's room toward the set piece at its focus, and in a room off a corridor where the
// clusters stand; with the laid count, the dressing's laws and what each degree of destruction would let break. The
// machine gate: no page errors, the laws hold; the look is the operator's.
//
//   node scripts/spikes/bay/dress.mjs [--out <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { resolveCompose } = await import('@/lib/graph/era/compose');
const { resolveProps } = await import('@/lib/graph/era/compose-lay');
const { planStage, assembleStageScene } = await import('@/lib/graph/era/stage');
const { withProgram } = await import('@/lib/graph/era/programs');
const { breakablesOf } = await import('@/lib/graph/playscape/destruct/breakability');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'bay-dress')), W = 1120, H = 700;
fs.mkdirSync(out, { recursive: true });
const CASES = [
  ['hangar', { kind: 'stage', kit: 'bay-military', compose: 'a hangar', rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 12, h: 3.5 }, { id: 'tall', x: -6, y: 12, w: 18, d: 30, h: 12 }], links: [{ from: 'low', to: 'tall' }] }],
  ['warehouse', { kind: 'stage', program: { use: 'warehouse', storeys: 1, bays: 2 }, compose: 'a warehouse' }],
  ['lab', { kind: 'stage', program: { use: 'lab-building', storeys: 1, bays: 2 }, compose: 'a lab' }],
  ['office', { kind: 'stage', program: { use: 'office', storeys: 1, bays: 2 }, compose: 'an office' }],
];
const pages = [];
for (const [name, m0] of CASES) {
  const manifest = resolveProps(resolveCompose(m0)), lowered = manifest.program ? withProgram(manifest) : manifest, plan = planStage(lowered);
  const S = assembleStageScene(lowered, {}), D = S.compose.dress;
  const breaks = Object.fromEntries(['objects', 'cover', 'world'].map((d) => [d, breakablesOf(S, d)?.things.length ?? 0]));
  console.log(name.padEnd(9), `${manifest.props.length} things |`, D.map((l) => `${l.ok ? '' : 'NOT '}${l.id}`).join(' '), '| breaks', JSON.stringify(breaks));
  // (across the landmark's room, else the climax's, toward its focus; and a room off a corridor with clusters)
  const R = plan.compose.roles.find((x) => x.role === 'landmark') ?? plan.compose.roles.find((x) => x.role === 'climax'), r = plan.rooms.find((x) => x.id === R.room);
  const c = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2], back = [2 * c[0] - R.focus[0], 2 * c[1] - R.focus[1]];
  const clamp = (p) => [Math.min(r.x1 - 0.8, Math.max(r.x0 + 0.8, p[0])), Math.min(r.y1 - 0.8, Math.max(r.y0 + 0.8, p[1]))];
  const at = clamp(back), z = (r.z0 ?? 0) + 1.7;
  const cams = { focus: { pos: [at[0], at[1], z], target: [R.focus[0], R.focus[1], z - 0.3], vfov: 70 } };
  const busy = plan.rooms.filter((x) => x.id !== r.id).map((x) => [x, manifest.props.filter((p) => p.room === x.id && !p.set).length]).sort((a, b) => b[1] - a[1])[0];
  if (busy && busy[1]) {
    const q = busy[0], qc = [(q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2], first = manifest.props.find((p) => p.room === q.id && !p.set);
    cams.room = { pos: [2 * qc[0] - first.at[0] * 0.9 - qc[0] * 0.1, 2 * qc[1] - first.at[1] * 0.9 - qc[1] * 0.1, (q.z0 ?? 0) + 1.7], target: [first.at[0], first.at[1], (q.z0 ?? 0) + 0.8], vfov: 72 };
    cams.room.pos = [Math.min(q.x1 - 0.6, Math.max(q.x0 + 0.6, cams.room.pos[0])), Math.min(q.y1 - 0.6, Math.max(q.y0 + 0.6, cams.room.pos[1])), cams.room.pos[2]];
  }
  const { payload } = await resolveWorldScene({ ref: `dress-${name}`, title: `${name} dressed`, manifest }, { era: 'gen-7', live: true });
  pages.push({ name, payload, cams });
}
const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
for (const p of pages) {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: W, height: H });
  await page.setContent(emitThreeWorld({ ...p.payload, viewBox: { width: W, height: H }, inline: true, capture: true, hud: false, walk: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 300000 });
  for (const [shot, cam] of Object.entries(p.cams)) {
    await page.evaluate(async (c) => { window.__mojCapture.frame(c); await new Promise((r) => setTimeout(r, 400)); window.__mojCapture.frame(c); }, cam);
    await (await page.$('#wrap')).screenshot({ path: path.join(out, `${p.name}-${shot}.png`) });
  }
  console.log(p.name, errors.length ? `errors: ${errors.slice(0, 2).join(' | ')}` : 'no page errors');
  await page.close();
}
await browser.close();
process.exit(0);
