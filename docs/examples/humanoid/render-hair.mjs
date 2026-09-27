/** render-hair.mjs — the HAIR contact sheet: the hairstyle lab's baseline-beside-variant, on the landmark head. Rows per
 * head: every style in the library at its defaults; columns: front, three-quarter, profile, back, through ONE camera per
 * head (so a long fall reads long, not re-framed). A measurements table (top above the crown, hem below the chin, reach
 * behind the occiput) goes beside it as JSON and Markdown. Diagnostic renders for the eyes gate; nothing here is a recipe
 * change. Run from control:
 *   MOJULO_SPIKE_OUT=/absolute/path node ../docs/examples/humanoid/render-hair.mjs [--hair '<json>'] */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { humanoidHead } from './head.mjs';
import { HAIR_STYLE_NAMES, resolveHair, describeHair } from '../../../control/lib/graph/polygonizer/humanoid-hair.js';
import { compileLayered } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { viewCamera, rasterDepth } from '../../../control/lib/graph/scene/depth-raster.js';
import { encodePng } from '../../../control/lib/graph/landscape/surface-textures.js';
import { vec } from '../../../control/lib/graph/polygonizer/station-loft-detail.js';
const { unit, cross, sub, dot } = vec;

const OUT = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/0926/spike-output/hair-library', import.meta.url)));
mkdirSync(OUT, { recursive: true });
const extra = process.argv.includes('--hair') ? JSON.parse(process.argv[process.argv.indexOf('--hair') + 1]) : null;
const BG = [247, 245, 239], key = unit([-0.5, 0.7, 0.85]), fill = unit([0.8, 0.2, 0.35]);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const FRAME = { size: 260, focalPixels: 330, elevationDegrees: 4 };
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

const VIEWS = ['frontal', 'three-quarter', 'lateral', 'back'];
const rows = [...HAIR_STYLE_NAMES.filter((s) => s !== 'none'), ...(extra ? [extra] : [])];
const table = [];
for (const preset of ['male', 'female']) {
  // the frame fits the longest fall, so every style shares it
  shared = compileLayered(humanoidHead({ preset, hair: ['long', { length: 1.5 }] }));
  const cells = [];
  for (const spec of rows) {
    const head = humanoidHead({ preset, hair: spec }), mesh = compileLayered(head), H = resolveHair(spec);
    table.push({ preset, hair: describeHair(H), parts: Object.keys(head.parts).filter((k) => k.startsWith('hair')).join('+'), ...head.hairMeasures });
    for (const view of VIEWS) cells.push(render(mesh, head.palette, view));
  }
  sheet(`hair-${preset}`, cells, VIEWS.length);
}
writeFileSync(`${OUT}/measurements.json`, JSON.stringify(table, null, 1) + '\n');
const cols = ['preset', 'hair', 'parts', 'top_m', 'hem_m', 'back_m'];
writeFileSync(`${OUT}/measurements.md`, [`| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, ...table.map((r) => `| ${cols.map((c) => r[c]).join(' | ')} |`)].join('\n') + '\n');
console.log(`${OUT}/hair-male.png, hair-female.png (${rows.length} rows × ${VIEWS.length} views)`);
console.table(table);
