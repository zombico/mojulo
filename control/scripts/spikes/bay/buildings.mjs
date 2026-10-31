// BUILDINGS FROM A BRIEF (era/program-core.js on the bay kits): each building use planned, its storeys drawn as plates,
// read in gen-6 and gen-7 and written as walkable World pages, each page held to the budget a page is hosted under,
// and captured from inside: the lobby from its door, the ground floor's first corridor, up the core's stair, the top
// storey's corridor. The machine gate: no page errors, every page under the budget. The look is the operator's.
//
//   node scripts/spikes/bay/buildings.mjs [--out <dir>] [--only office,warehouse] [--no-capture]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { planStage } = await import('@/lib/graph/era/stage');
const { withProgram, planProgram, programPlanSvg, PROGRAMS, PROGRAM_IDS } = await import('@/lib/graph/era/programs');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'bay-buildings')), only = arg('--only', null)?.split(','), capture = !process.argv.includes('--no-capture');
// the budget a page is hosted under (an artifact's), both eras
const BUDGET = 16e6, W = 1120, H = 700, EYE = 1.6;
fs.mkdirSync(out, { recursive: true });
const pages = [], report = [];
for (const use of PROGRAM_IDS.filter((u) => PROGRAMS[u].shape === 'core' && (!only || only.includes(u)))) {
  const manifest = { kind: 'stage', program: { use } }, m = withProgram(manifest), plan = planStage(m);
  fs.writeFileSync(path.join(out, `${use}-plan.svg`), programPlanSvg(planProgram({ use }, m.kit), 1800));
  // the cameras, from the plan: the lobby from its door, a corridor along its length, the core's stair, the top storey's
  const room = (id) => plan.rooms.find((r) => r.id === id), z0 = (r) => (plan.storeys ? plan.storeys[r.storey ?? 0].z0 : 0);
  const lobby = room('lobby'), cor = (s) => plan.rooms.find((r) => r.id.startsWith(`corridor-${s}`)), top = Math.max(...plan.rooms.map((r) => r.storey ?? 0)) + 1;
  const along = (r, z) => { const X = r.x1 - r.x0 > r.y1 - r.y0, c = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2]; return X ? { pos: [r.x0 + 0.6, c[1], z + EYE], target: [r.x1, c[1], z + EYE - 0.1], vfov: 66 } : { pos: [c[0], r.y0 + 0.6, z + EYE], target: [c[0], r.y1, z + EYE - 0.1], vfov: 66 }; };
  const st = (plan.stairs || [])[0];
  const cams = {
    lobby: { pos: [(lobby.x0 + lobby.x1) / 2, lobby.y0 + 0.5, EYE], target: [(lobby.x0 + lobby.x1) / 2, lobby.y1 + 4, EYE + 0.4], vfov: 70 },
    corridor: along(cor(1), 0),
    // (the stair from behind its foot, looking up the flight to its head)
    ...(st ? { stair: { pos: [st.approach[0] + (st.axis === 'y' ? 0 : -st.dir * 2.5), st.approach[1] + (st.axis === 'y' ? -st.dir * 2.5 : 0), EYE + 0.3], target: [(st.approach[0] + st.arrival[0]) / 2, (st.approach[1] + st.arrival[1]) / 2, (st.z0 + st.z1) / 2 + EYE], vfov: 72 } } : {}),
    ...(top > 1 ? { top: along(cor(top), z0(cor(top))) } : {}),
  };
  for (const era of ['gen-6', 'gen-7']) {
    const t0 = Date.now(), { payload } = await resolveWorldScene({ ref: `bld-${use}`, title: `${use} · ${era}`, manifest }, { era, live: true });
    const html = emitThreeWorld({ ...payload, title: `${use} · ${era}`, walk: payload.walk ?? true, inline: true });
    fs.writeFileSync(path.join(out, `${use}-${era}.html`), html);
    const under = html.length <= BUDGET;
    report.push({ use, era, rooms: plan.rooms.length, faces: payload.faces.length, bytes: html.length, under, ms: Date.now() - t0, ...(payload.form?.room?.reliefSize ? { relief: payload.form.room.reliefSize } : {}) });
    console.log(`${under ? 'ok ' : 'NO '} ${use} ${era}: ${plan.rooms.length} rooms, ${payload.faces.length} faces, page ${(html.length / 1e6).toFixed(2)} MB (budget ${BUDGET / 1e6})${payload.form?.room?.reliefSize ? `, relief at ${payload.form.room.reliefSize}` : ''}, ${Date.now() - t0} ms`);
    pages.push({ use, era, payload, cams });
  }
}
if (capture) {
  const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
  for (const p of pages) {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setViewport({ width: W, height: H });
    await page.setContent(emitThreeWorld({ ...p.payload, viewBox: { width: W, height: H }, inline: true, capture: true, hud: false, walk: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 300000 });
    for (const [shot, cam] of Object.entries(p.cams)) {
      await page.evaluate(async (cam) => { window.__mojCapture.frame(cam); await new Promise((r) => setTimeout(r, 400)); window.__mojCapture.frame(cam); }, cam);
      await (await page.$('#wrap')).screenshot({ path: path.join(out, `${p.use}-${p.era}-${shot}.png`) });
    }
    report.find((r) => r.use === p.use && r.era === p.era).errors = errors.slice(0, 3);
    console.log(p.use, p.era, errors.length ? `errors: ${errors.slice(0, 2).join(' | ')}` : 'no page errors');
    await page.close();
  }
  await browser.close();
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
const bad = report.filter((r) => !r.under || (r.errors && r.errors.length));
console.log(bad.length ? `${bad.length} page(s) over budget or erring` : 'every page under budget, no page errors');
process.exit(bad.length ? 1 : 0);
