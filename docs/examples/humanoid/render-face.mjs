/** render-face.mjs — the FACE contact sheet: the face proportion lab's baseline-beside-variant, on the fitted landmark head.
 * Rows per head: as fit, then each move (FACE_MOVES), then both combined extremes (every control at its low / high range);
 * columns: front, three-quarter, profile, through ONE camera per head (so a longer face reads longer, not re-framed). A
 * measurements table (crown to chin, across the cheekbones, across the jaw, between the pupils) goes beside it as JSON
 * and Markdown. Diagnostic renders for the eyes gate; nothing here is a recipe change. Run from control:
 *   MOJULO_SPIKE_OUT=/absolute/path node ../docs/examples/humanoid/render-face.mjs [--face '<json>'] */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { humanoidHead, humanoidAnchors, HEAD_SHAPE_DEFAULTS, FACE, FACE_KEYS, FACE_RANGES, FACE_MOVE_NAMES, resolveFace } from './head.mjs';
import { compileLayered } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { viewCamera, rasterDepth } from '../../../control/lib/graph/scene/depth-raster.js';
import { encodePng } from '../../../control/lib/graph/landscape/surface-textures.js';
import { vec } from '../../../control/lib/graph/polygonizer/station-loft-detail.js';
const { unit, cross, sub, dot } = vec;

const OUT = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/0926/spike-output/face-tune', import.meta.url)));
mkdirSync(OUT, { recursive: true });
const extra = process.argv.includes('--face') ? JSON.parse(process.argv[process.argv.indexOf('--face') + 1]) : null;
const BG = [247, 245, 239], key = unit([-0.5, 0.7, 0.85]), fill = unit([0.8, 0.2, 0.35]);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const FRAME = { size: 320, focalPixels: 480, elevationDegrees: 4 };
let shared = null;
function render(mesh, palette, view) {
  const camera = viewCamera(shared, view, FRAME);
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
function measure(preset, shape) {
  const a = humanoidAnchors(preset, { ...HEAD_SHAPE_DEFAULTS, ...shape });
  return { head_m: r3(a.crown[2] - a.menton[2]), cheekbones_m: r3(2 * a.zygionR[0]), jaw_m: r3(2 * a.gonionR[0]), pupils_m: r3(2 * a.eyeR[0]), chin_fwd_m: r3(a.chinFront[1]) };
}

const VIEWS = ['frontal', 'three-quarter', 'lateral'];
const lo = Object.fromEntries(FACE_KEYS.map((k) => [k, FACE_RANGES[k][0]])), hi = Object.fromEntries(FACE_KEYS.map((k) => [k, FACE_RANGES[k][1]]));
const rows = [['as fit', {}], ...FACE_MOVE_NAMES.map((m) => [m, m]), ['all low', lo], ['all high', hi], ...(extra ? [['--face', extra]] : [])];
const table = [], cells = [];
for (const preset of ['male', 'female']) {
  shared = compileLayered(humanoidHead({ preset, hair: 'swept' }));
  for (const [label, face] of rows) {
    const { from: _f, ...shape } = resolveFace(face);
    const head = humanoidHead({ preset, shape, hair: 'swept' }), mesh = compileLayered(head);
    table.push({ preset, face: label, moved: FACE.describe(resolveFace(face)).replace(/^face /, '') || '—', ...measure(preset, shape) });
    for (const view of VIEWS) cells.push(render(mesh, head.palette, view));
  }
}
sheet('face-sheet', cells, VIEWS.length);
writeFileSync(`${OUT}/measurements.json`, JSON.stringify(table, null, 1) + '\n');
const cols = ['preset', 'face', 'moved', 'head_m', 'cheekbones_m', 'jaw_m', 'pupils_m', 'chin_fwd_m'];
writeFileSync(`${OUT}/measurements.md`, [`| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, ...table.map((r) => `| ${cols.map((c) => r[c]).join(' | ')} |`)].join('\n') + '\n');
console.log(`${OUT}/face-sheet.png (${rows.length} rows × ${VIEWS.length} views per head)`);
console.table(table.map(({ moved, ...r }) => ({ ...r, moved: moved.length > 60 ? moved.slice(0, 57) + '…' : moved })));
