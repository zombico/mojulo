/** render-lineup.mjs — a CHARACTER ROLLS contact sheet for the eyes gate (docs/egocube.md, The setting): one row per game
 * scenario, the same seeds rolled in that game's setting (gameworld/cast-setting.js), so a row shows what the dice give
 * that game (a race's field drawn seated in its machines); the last row is the same seeds with no setting, the roll as it was. Front views, flat-lit and diagnostic:
 * the World page's character light is the look; nothing here is a recipe change. Run from control:
 *   MOJULO_SPIKE_OUT=/absolute/path node ../docs/examples/character-rolls/render-lineup.mjs [--n 4]
 * Writes lineup.png and lineup.json (each cell's facets and reads). */
import { register } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
const CONTROL = resolve(dirname(fileURLToPath(import.meta.url)), '../../../control');
register(pathToFileURL(join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);

const lib = (p) => import(pathToFileURL(join(CONTROL, p)).href);
const { settingOfGame, quickFigure } = await lib('lib/graph/gameworld/cast-setting.js');
const { rollEgocube } = await lib('lib/graph/egocube/egocube.js');
const { planFromSheet } = await lib('lib/graph/egocube/plan.js');
const { rollMascot } = await lib('lib/graph/egocube/mascot.js');
const { mascotPlanFromSheet } = await lib('lib/graph/egocube/mascot-form.js');
const { expandLayeredManifest, heroRecord } = await lib('lib/mcp/tools/layered.js');
const { expandPlan } = await lib('lib/graph/polygonizer/station-loft-plan.js');
const { compileLayered } = await lib('lib/graph/polygonizer/station-loft.js');
const { viewCamera, rasterDepth } = await lib('lib/graph/scene/depth-raster.js');
const { encodePng } = await lib('lib/graph/landscape/surface-textures.js');
const { vec } = await lib('lib/graph/polygonizer/station-loft-detail.js');
const { solveRoster } = await lib('lib/graph/car-designer/roster.js');
const { unit, cross, sub, dot } = vec;

const OUT = resolve(process.env.MOJULO_SPIKE_OUT || 'lineup-out');
mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2), N = args.includes('--n') ? Number(args[args.indexOf('--n') + 1]) : 4;
const BG = [247, 245, 239], key = unit([-0.5, 0.7, 0.85]), fill = unit([0.8, 0.2, 0.35]), UNLIT = new Set(['Sclera', 'Pupil']);
const FRAME = { size: 240, focalPixels: 360, elevationDegrees: 6 };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function cell(mesh, palette) {
  const camera = viewCamera(mesh, 'frontal', FRAME), raster = rasterDepth(mesh, camera, FRAME.size * 2);
  const vn = mesh.vertices.map(() => [0, 0, 0]);
  for (const f of mesh.faces) { const [a, b, c] = f.map((k) => mesh.vertices[k]), fn = cross(sub(b, a), sub(c, a)); for (const k of f) for (let d = 0; d < 3; d++) vn[k][d] += fn[d]; }
  const colours = mesh.faces.map((f, i) => {
    const s3 = f.reduce((t, k) => [t[0] + vn[k][0], t[1] + vn[k][1], t[2] + vn[k][2]], [0, 0, 0]), n = Math.hypot(...s3) > 1e-12 ? unit(s3) : [0, 0, 1];
    const light = UNLIT.has(mesh.groups[i]) ? 1 : 0.5 + 0.42 * Math.max(0, dot(n, key)) + 0.13 * Math.max(0, dot(n, fill));
    return hex(palette[mesh.groups[i]] || '#ff00ff').map((c) => Math.min(255, Math.round(c * light)));
  });
  const size = FRAME.size, rgb = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sum = [0, 0, 0];
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const face = raster.face[(y * 2 + dy) * size * 2 + x * 2 + dx], col = face < 0 ? BG : colours[face]; for (let k = 0; k < 3; k++) sum[k] += col[k]; }
    rgb.set(sum.map((c) => Math.round(c / 4)), (y * size + x) * 3);
  }
  return rgb;
}

/** a person's hero spec as the door builds it, flat-lit */
function personCell(spec) {
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord(spec) });
  return cell(compileLayered(m.recipe), { ...(m.plan?.palette ?? {}), ...m.recipe.palette });
}
/** a racer's machine and its seated driver, three-quarter: its faces carry their own fills (racer.js paints them) */
function kartCell(S) {
  const fs = [...S.faces.root, ...S.faces.wheels.flatMap((w) => w.faces), ...S.faces.bones.flatMap((b) => b.faces)];
  const vertices = [], faces = [], groups = [], palette = {};
  fs.forEach((f, i) => { const base = vertices.length; vertices.push(...f.corners); faces.push(f.corners.map((_, k) => base + k)); groups.push(`f${i}`); palette[`f${i}`] = f.fill; });
  const mesh = { vertices, faces, groups }, camera = viewCamera(mesh, 'three-quarter', { ...FRAME, elevationDegrees: 14 }), raster = rasterDepth(mesh, camera, FRAME.size * 2);
  const size = FRAME.size, rgb = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sum = [0, 0, 0];
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const face = raster.face[(y * 2 + dy) * size * 2 + x * 2 + dx], col = face < 0 ? BG : hex(palette[groups[face]]); for (let k = 0; k < 3; k++) sum[k] += col[k]; }
    rgb.set(sum.map((c) => Math.round(c / 4)), (y * size + x) * 3);
  }
  return rgb;
}
function mascotCell(sheet) {
  const plan = mascotPlanFromSheet(sheet).create.spec.plan;
  return cell(compileLayered(expandPlan(plan)), plan.palette);
}

// the scenarios: a game (its kit and its quick goal) and the figure it stands up; the mascot row is the race's field
const SCENARIOS = [
  { row: 'farm · sakura valley', kit: 'isekai-sakura', goal: 'farm', figure: 'farmhand' },
  { row: 'defend · meadow', kit: 'isekai-meadow', goal: 'defend', figure: 'foe' },
  { row: 'sneak · gothic stone', kit: 'gothic-stone', goal: 'sneak', figure: 'guard' },
  { row: 'deathmatch · the moon', kit: 'airless-plain', goal: 'deathmatch', figure: 'gunner' },
  { row: 'race · mascots', kit: 'isekai-meadow', goal: 'race', mascot: true },
  { row: 'race · the field, seated', kit: 'isekai-meadow', goal: 'race', karts: true },
  { row: 'no setting (as before)', none: true },
];

const cells = [], table = [];
for (const S of SCENARIOS) {
  if (S.karts) {
    const setting = settingOfGame({ style: { kit: S.kit } }, { goal: S.goal });
    for (const r of solveRoster(N, { seed: 1, setting }).racers) {
      cells.push(kartCell(r.S));
      table.push({ row: S.row, archetype: r.archetype, tuning: r.spec.tuning ?? 'person', laws: r.S.laws });
      process.stdout.write('.');
    }
    continue;
  }
  for (let seed = 1; seed <= N; seed++) {
  if (S.none) {
    const sheet = rollEgocube({ seed, path: 'quick/foe' }), spec = planFromSheet(sheet).create.spec;
    cells.push(personCell(spec));
    table.push({ row: S.row, seed, facets: sheet.facets, reads: sheet.reads.slice(0, 3) });
  } else if (S.mascot) {
    const setting = settingOfGame({ style: { kit: S.kit } }, { goal: S.goal });
    const sheet = rollMascot({ seed, path: 'racer', setting });
    cells.push(mascotCell(sheet));
    table.push({ row: S.row, seed, setting: { tradition: setting.tradition, era: setting.era, genre: setting.genre }, facets: sheet.facets, reads: sheet.reads.slice(0, 2) });
  } else {
    const G = { seed, style: { kit: S.kit } }, Q = { goal: S.goal }, F = quickFigure(G, Q, S.figure);
    cells.push(personCell(F.spec));
    const setting = settingOfGame(G, Q);
    table.push({ row: S.row, seed, setting: { tradition: setting.tradition, era: setting.era, genre: setting.genre }, reads: F.sheet.reads.slice(0, 3), pending: F.pending });
  }
  process.stdout.write('.');
  }
}
const size = FRAME.size, COLUMNS = N, rows = Math.ceil(cells.length / COLUMNS), rgb = new Uint8Array(COLUMNS * size * rows * size * 3);
for (let i = 0; i < rgb.length; i += 3) rgb.set(BG, i);
cells.forEach((c, i) => { for (let y = 0; y < size; y++) rgb.set(c.subarray(y * size * 3, (y + 1) * size * 3), ((Math.floor(i / COLUMNS) * size + y) * COLUMNS * size + (i % COLUMNS) * size) * 3); });
writeFileSync(`${OUT}/lineup.png`, encodePng(Buffer.from(rgb), COLUMNS * size, rows * size));
writeFileSync(`${OUT}/lineup.json`, JSON.stringify(table, null, 1) + '\n');
console.log(`\n${OUT}/lineup.png: ${SCENARIOS.length} rows × ${N} seeds (${SCENARIOS.map((s) => s.row).join(' / ')})`);
