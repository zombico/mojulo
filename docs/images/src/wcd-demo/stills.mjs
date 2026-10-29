// The demo's stills (run.mjs makes the world first): the book's dungeon page and a level's plan, in the world's own
// book skin; then each level from inside, in the seventh generation, from cameras laid off its own plan (a corridor
// looked down, and the room its use is about).
//
//   node docs/images/src/wcd-demo/stills.mjs <workDir>     (reads <workDir>/made.json)
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CONTROL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../control');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href, pathToFileURL(`${CONTROL}/`).href);
const at = (p) => import(pathToFileURL(path.join(CONTROL, p)).href);
// (the data dir MOJULO_DATA_DIR names, as the bins resolve it)
(await at('scripts/mojulo-paths.mjs')).resolveMojuloPaths();
const { SketchRepository } = await at('lib/db/repositories/sketches.js');
const { resolveWorldScene } = await at('lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await at('lib/graph/scene/scene-three.js');
const { planStage } = await at('lib/graph/era/stage.js');
const { withProgram, PROGRAMS } = await at('lib/graph/era/programs.js');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await at('lib/graph/scene/chromium.js');

const work = path.resolve(process.argv[2]);
const made = JSON.parse(readFileSync(path.join(work, 'made.json'), 'utf8'));
// the levels, in the world's order, off its own record of what its runs made
const worldRow = SketchRepository.getByRef(made.world), record = worldRow.manifest.made ?? {};
made.levels ??= Object.fromEntries(Object.keys(worldRow.manifest.levels ?? {}).map((id) => [id, record[Object.keys(record).find((k) => k.startsWith(`level-${id}-`))]?.ref]).filter(([, ref]) => ref));
const W = 1280, H = 720;
const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── the book: its dungeon page and a level's plan, in the world's skin (book.mjs) ──
const bookLevel = made.bookLevel ?? Object.keys(made.levels)[1] ?? Object.keys(made.levels)[0];
const b = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), 'book.mjs'), work, made.world, 'book', bookLevel], { stdio: 'inherit' });
if (b.status !== 0) throw new Error('book.mjs failed');

// ── the levels: a corridor looked down, and the room the use is about, from its middle toward a far corner; framed
// landscape whatever screen the game is for (a still shows the place, not the phone) ──
// (the room a use is about: its annex, the hangar or the hall, else the room its corridors repeat)
const roomOf = (use) => { const P = PROGRAMS[use]; return P?.annex?.role ?? P?.roles?.room; };
for (const [level, ref] of Object.entries(made.levels)) {
  const row = SketchRepository.getByRef(ref), plan = planStage(withProgram(row.manifest));
  const cor = plan.rooms.find((r) => r.id === 'corridor-1a'), room = plan.rooms.find((r) => r.id.startsWith(roomOf(row.manifest.program?.use) ?? '~'));
  const cams = {};
  if (cor) {
    const along = cor.x1 - cor.x0 >= cor.y1 - cor.y0;
    cams.corridor = along ? { pos: [cor.x0 + 0.6, (cor.y0 + cor.y1) / 2, 1.6], target: [cor.x1, (cor.y0 + cor.y1) / 2, 1.4], vfov: 72 }
      : { pos: [(cor.x0 + cor.x1) / 2, cor.y0 + 0.6, 1.6], target: [(cor.x0 + cor.x1) / 2, cor.y1, 1.4], vfov: 72 };
  }
  if (room) {
    const tall = room.h > 6, c = [(room.x0 + room.x1) / 2, (room.y0 + room.y1) / 2];
    cams.room = tall ? { pos: [room.x0 + 1.2, room.y0 + 1.2, 4.5], target: [c[0] + (room.x1 - c[0]) * 0.6, c[1] + (room.y1 - c[1]) * 0.6, 1.2], vfov: 70 }
      : { pos: [c[0], c[1], 2.3], target: [room.x1 - 0.4, room.y1 - 0.4, 0.5], vfov: 84 };
  }
  const { payload } = await resolveWorldScene({ ref, title: row.title, manifest: row.manifest }, { era: 'gen-7', live: true });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: W, height: H });
  await page.setContent(emitThreeWorld({ ...payload, screen: null, viewBox: { width: W, height: H }, inline: true, capture: true, hud: false, walk: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 300000 });
  for (const [shot, cam] of Object.entries(cams)) {
    await page.evaluate(async (c) => { window.__mojCapture.frame(c); await new Promise((r) => setTimeout(r, 400)); window.__mojCapture.frame(c); }, cam);
    await page.screenshot({ path: path.join(work, `${level}-${shot}.png`) });
    console.log('still', `${level}-${shot}`, errors.length ? `(page errors: ${errors.slice(0, 1).join('')})` : '');
  }
  await page.close();
}
await browser.close();
process.exit(0);
