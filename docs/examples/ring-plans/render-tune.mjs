/** render-tune.mjs — the TUNE contact sheet: the body proportion lab's baseline-beside-variant, on the hero form.
 * Rows: male / female × as cast, then each move (HERO_MOVES); columns: front, three-quarter, profile. A measurements table
 * (height, across the shoulders, across the hips, leg length, head share) goes beside it as JSON and Markdown. Diagnostic
 * renders for the eyes gate; nothing here is a recipe change. Run from control:
 *   MOJULO_SPIKE_OUT=/absolute/path node ../docs/examples/ring-plans/render-tune.mjs [--tune '<json>'] */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { heroPlan, HERO_CASTS, HERO_MOVE_NAMES, resolveTune, TUNE_KEYS } from './hero.plan.mjs';
import { expandPlan } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';
import { compileLayered } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { viewCamera, rasterDepth } from '../../../control/lib/graph/scene/depth-raster.js';
import { encodePng } from '../../../control/lib/graph/landscape/surface-textures.js';
import { vec } from '../../../control/lib/graph/polygonizer/station-loft-detail.js';
const { unit, cross, sub, dot } = vec;

const OUT = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/0926/spike-output/hero-tune', import.meta.url)));
mkdirSync(OUT, { recursive: true });
const extra = process.argv.includes('--tune') ? JSON.parse(process.argv[process.argv.indexOf('--tune') + 1]) : null;
const BG = [247, 245, 239], key = unit([-0.5, 0.7, 0.85]), fill = unit([0.8, 0.2, 0.35]);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// one camera for every cell, so a longer leg reads as a taller figure and not as a re-framed one
const FRAME = { size: 320, focalPixels: 480, elevationDegrees: 4 };
let sharedCamera = null;
function render(mesh, palette, view) {
  const camera = viewCamera(sharedCamera.mesh, view, FRAME);
  const raster = rasterDepth(mesh, camera, FRAME.size * 2);
  const colours = mesh.faces.map((f, i) => {
    const [a, b, c] = f.map((k) => mesh.vertices[k]), n = unit(cross(sub(b, a), sub(c, a)));
    const light = 0.48 + 0.42 * Math.max(0, dot(n, key)) + 0.13 * Math.max(0, dot(n, fill));
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
function sheet(name, cells, columns) {
  const size = FRAME.size, rows = Math.ceil(cells.length / columns), rgb = new Uint8Array(columns * size * rows * size * 3);
  for (let i = 0; i < rgb.length; i += 3) rgb.set(BG, i);
  cells.forEach((cell, i) => { for (let y = 0; y < size; y++) rgb.set(cell.subarray(y * size * 3, (y + 1) * size * 3), ((Math.floor(i / columns) * size + y) * columns * size + (i % columns) * size) * 3); });
  writeFileSync(`${OUT}/${name}.png`, encodePng(Buffer.from(rgb), columns * size, rows * size));
}
const r3 = (x) => Math.round(x * 1000) / 1000;
function measure(plan, mesh) {
  const zs = mesh.vertices.map((v) => v[2]), height = Math.max(...zs) - Math.min(...zs);
  const torso = plan.segments.find((s) => s.name === 'torso'), thigh = plan.segments.find((s) => s.name === 'thighR'), head = plan.segments.find((s) => s.name === 'head');
  const leg = plan.joints.hip[2] - plan.joints.ankle[2];
  const headH = head ? head.caps.tip[2] - head.caps.back[2] : plan.joints.headBase[2] ? Math.max(...zs) - plan.joints.headBase[2] : 0;
  return { height_m: r3(height), shoulder_m: r3(2 * torso.stations[3].r[0]), hip_m: r3(2 * (thigh.stations[1].at[0] + thigh.stations[1].r[0])), leg_m: r3(leg), heads_tall: r3(height / headH) };
}

const VIEWS = ['frontal', 'three-quarter', 'lateral'];
const rows = [['as cast', undefined], ...HERO_MOVE_NAMES.map((m) => [m, m]), ...(extra ? [['--tune', extra]] : [])];
const table = [], cells = [];
for (const cast of Object.keys(HERO_CASTS)) {
  const base = heroPlan({ cast }); sharedCamera = { mesh: compileLayered(expandPlan(base)) };
  for (const [label, tune] of rows) {
    const plan = heroPlan({ cast, tune }), mesh = compileLayered(expandPlan(plan));
    const T = resolveTune(tune), moved = TUNE_KEYS.filter((k) => T[k] !== 1).map((k) => `${k} ${Math.round(T[k] * 100)}%`).join(', ');
    table.push({ cast, tune: label, moved: moved || '—', ...measure(plan, mesh) });
    for (const view of VIEWS) cells.push(render(mesh, plan.palette, view));
  }
}
sheet('tune-sheet', cells, VIEWS.length);
writeFileSync(`${OUT}/measurements.json`, JSON.stringify(table, null, 1) + '\n');
const cols = ['cast', 'tune', 'moved', 'height_m', 'shoulder_m', 'hip_m', 'leg_m', 'heads_tall'];
writeFileSync(`${OUT}/measurements.md`, [`| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, ...table.map((r) => `| ${cols.map((c) => r[c]).join(' | ')} |`)].join('\n') + '\n');
console.log(`${OUT}/tune-sheet.png (${rows.length} rows × ${VIEWS.length} views per cast, ${Object.keys(HERO_CASTS).length} casts)`);
console.table(table);
