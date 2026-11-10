// game-items.jpg: a sheet of game items, each built from a sentence's worth of words by the equipment library,
// drawn on the World page from the front three-quarter and fitted to its tile.
//
//   node docs/images/src/game-items/run.mjs [workDir]
//
// No database writes. MOJULO_CHROMIUM names the browser when none is found on its own; ffmpeg on PATH (or FFMPEG)
// tiles the sheet.
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const control = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../control');
const work = path.resolve(process.argv[2] || path.join(tmpdir(), 'mj-game-items'));
mkdirSync(work, { recursive: true });
process.chdir(control);
register(pathToFileURL(path.join(control, 'scripts/mcp-stdio-loader.mjs')).href);
const { stampArms } = await import(pathToFileURL(path.join(control, 'lib/graph/equipment/expand.js')).href);
const { resolveWorldScene } = await import(pathToFileURL(path.join(control, 'lib/graph/worlds/world-scene.js')).href);
const { emitThreeWorld } = await import(pathToFileURL(path.join(control, 'lib/graph/scene/scene-three.js')).href);
const { renderWorldToPng } = await import(pathToFileURL(path.join(control, 'lib/graph/scene/scene-png.js')).href);

// two rows: the fantasy shelf, then the modern and future one
const ITEMS = [
  ['longsword', { item: 'sword' }],
  ['staff', { item: 'staff', style: 'elven' }],
  ['shield', { item: 'shield' }],
  ['bow', { item: 'bow', parts: { limb: 'recurve' } }],
  ['revolver', { item: 'pistol', model: 'revolver', style: 'walnut', parts: { barrel: 'long' } }],
  ['pulse-rifle', { item: 'rifle', style: 'white' }],
  ['railgun', { item: 'rifle', model: 'marksman', style: 'titan' }],
  ['vibroblade', { item: 'knife', line: 'future', style: 'white' }],
];
const W = 600, H = 460, BG = '#1b2331', FLOOR = '#222c3c';
const tiles = [];
for (const [name, b] of ITEMS) {
  const build = stampArms({ type: 'equipment', ...b });
  const { payload } = await resolveWorldScene({ ref: name, kind: 'workbench', manifest: { kind: 'workbench', units: 'cm', build } });
  const faces = payload.faces.filter((f) => !f.studio);
  // the item's frame is +z along it, +y up; the World is z-up. A blade lies flat to the camera, a shield stands.
  const blade = ['knife', 'dagger', 'sword', 'greatsword', 'staff', 'bow'].includes(b.item);
  const turn = b.item === 'shield' ? ([x, y, z]) => [x, y, z] : blade ? ([x, y, z]) => [z, y, -x] : ([x, y, z]) => [z, x, y];
  const turned = faces.map((f) => ({ ...f, corners: f.corners.map(turn), ...(f.outNormal ? { outNormal: turn(f.outNormal) } : {}) }));
  const pts = turned.flatMap((f) => f.corners);
  const lo = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i]))), hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])));
  const mid = lo.map((v, i) => (v + hi[i]) / 2);
  const r = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2;
  const F = r * 400; // a floor far past the frame, so no edge shows
  turned.push({ corners: [[mid[0] - F, mid[1] - F, lo[2] - r * 0.25], [mid[0] + F, mid[1] - F, lo[2] - r * 0.25], [mid[0] + F, mid[1] + F, lo[2] - r * 0.25], [mid[0] - F, mid[1] + F, lo[2] - r * 0.25]], fill: FLOOR });
  // the front three-quarter, far enough that the item's sphere fits the tile's height
  const dir = [0.62, -0.72, 0.32], n = Math.hypot(...dir), hfov = 34;
  const vfov = 2 * Math.atan(Math.tan((hfov / 2) * Math.PI / 180) * (H / W)); // the tile is wider than tall: fit its height
  const d = (r / Math.tan(vfov / 2)) * 0.9;
  const cam = mid.map((v, i) => v + (dir[i] / n) * d);
  const html = emitThreeWorld({ faces: turned, textures: payload.textures ?? {}, inline: true, hud: false, title: name, bg: BG, metersPerUnit: payload.metersPerUnit ?? 0.01, cameras: [{ name: 'hero', worldFraming: { cameraPosition: cam, lookAt: mid, horizontalFov: hfov, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H } });
  const png = path.join(work, `${name}.png`);
  writeFileSync(png, await renderWorldToPng(html, { width: W, height: H, deviceScaleFactor: 2 }));
  tiles.push(png);
  console.log(`drew ${name}`);
}
const out = path.join(work, 'game-items.jpg');
const inputs = tiles.flatMap((t) => ['-i', t]);
const half = tiles.length / 2;
const row = (k) => tiles.slice(k * half, (k + 1) * half).map((_, i) => `[${k * half + i}]`).join('') + `hstack=${half}[r${k}]`;
const ff = spawnSync(process.env.FFMPEG || 'ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', `${row(0)};${row(1)};[r0][r1]vstack,scale=1600:-2`, '-q:v', '3', out], { stdio: 'inherit' });
if (ff.status !== 0) throw new Error('ffmpeg could not tile the sheet');
console.log(out);
