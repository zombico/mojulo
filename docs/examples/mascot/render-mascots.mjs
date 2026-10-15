/** render-mascots.mjs — a MASCOT contact sheet for the eyes gate (docs/mascot.md): one row per brief, the front, the
 * three-quarter and the side at rest, then the clips' telling keys (idle, cheer, the hop's top, the wave). Flat-lit and
 * diagnostic: the World page's character light is the look; nothing here is a recipe change. Run from control:
 *   MOJULO_SPIKE_OUT=/absolute/path node ../docs/examples/mascot/render-mascots.mjs ['sonic-like|kirby-like|…'] [--seed n] [--faces]
 * `--faces`: the faces instead, close up and from the front, one row per brief: the rest face, then every expression clip's
 * held key (mascots-faces.png). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollMascot } from '../../../control/lib/graph/egocube/mascot.js';
import { mascotPlanFromSheet } from '../../../control/lib/graph/egocube/mascot-form.js';
import { EXPRESSION_IDS } from '../../../control/lib/graph/egocube/mascot-face.js';
import { expandPlan } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';
import { compileLayered } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { poseLayered } from '../../../control/lib/graph/polygonizer/hero-gesture.js';
import { viewCamera, rasterDepth } from '../../../control/lib/graph/scene/depth-raster.js';
import { encodePng } from '../../../control/lib/graph/landscape/surface-textures.js';
import { vec } from '../../../control/lib/graph/polygonizer/station-loft-detail.js';
const { unit, cross, sub, dot } = vec;

const OUT = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/1014/spike-output/mascots', import.meta.url)));
mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2), seed = args.includes('--seed') ? Number(args[args.indexOf('--seed') + 1]) : 1;
const briefs = (args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--seed') || 'sonic-like|kirby-like|mario-like|yoshi-like|pikachu-like|a mighty team mascot').split('|');
const BG = [247, 245, 239], key = unit([-0.5, 0.7, 0.85]), fill = unit([0.8, 0.2, 0.35]), UNLIT = new Set(['Sclera', 'Pupil']);
const FRAME = { size: 280, focalPixels: 420, elevationDegrees: 6 };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function cell(mesh, palette, view, framing) {
  const camera = viewCamera(framing, view, FRAME), raster = rasterDepth(mesh, camera, FRAME.size * 2);
  const colours = mesh.faces.map((f, i) => {
    const [a, b, c] = f.map((k) => mesh.vertices[k]), n = unit(cross(sub(b, a), sub(c, a)));
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

const FACES = args.includes('--faces'), COLUMNS = FACES ? 1 + EXPRESSION_IDS.length : 7;
const cells = [], table = [];
for (const brief of briefs) if (FACES) {
  const sheet = rollMascot({ brief, seed }), P = mascotPlanFromSheet(sheet), plan = P.create.spec.plan;
  const recipe = expandPlan(plan), mesh = compileLayered(recipe), head = plan.segments.find((x) => x.name === 'head');
  const [z0, z1] = [head.caps.back[2], head.caps.tip[2]], pad = (z1 - z0) * 0.15;
  const near = (m) => ({ ...m, vertices: m.vertices.filter((v) => v[2] > z0 - pad && v[2] < z1 + pad) });
  const framing = near(mesh);
  cells.push(cell(mesh, plan.palette, 'frontal', framing));
  for (const e of EXPRESSION_IDS) cells.push(cell(poseLayered(mesh, recipe, plan.clips[e][1]).mesh, plan.palette, 'frontal', framing));
  table.push({ brief, thesis: `${P.thesis} · rests ${sheet.facets.expression}`, ...sheet.facets });
} else {
  const sheet = rollMascot({ brief, seed }), P = mascotPlanFromSheet(sheet), plan = P.create.spec.plan;
  const recipe = expandPlan(plan), mesh = compileLayered(recipe);
  const posed = [plan.clips.idle[1], plan.clips.cheer[1], plan.clips.hop[2], plan.clips.wave[1]].map((k) => poseLayered(mesh, recipe, k).mesh);
  const framing = { ...mesh, vertices: [mesh, ...posed].flatMap((m) => m.vertices) };   // one frame holds every key, the hop's top too
  for (const view of ['frontal', 'three-quarter', 'lateral']) cells.push(cell(mesh, plan.palette, view, framing));
  for (const m of posed) cells.push(cell(m, plan.palette, 'three-quarter', framing));
  table.push({ brief, thesis: P.thesis, ...sheet.facets });
}
const size = FRAME.size, rows = Math.ceil(cells.length / COLUMNS), rgb = new Uint8Array(COLUMNS * size * rows * size * 3);
for (let i = 0; i < rgb.length; i += 3) rgb.set(BG, i);
cells.forEach((c, i) => { for (let y = 0; y < size; y++) rgb.set(c.subarray(y * size * 3, (y + 1) * size * 3), ((Math.floor(i / COLUMNS) * size + y) * COLUMNS * size + (i % COLUMNS) * size) * 3); });
const name = FACES ? 'mascots-faces' : 'mascots';
writeFileSync(`${OUT}/${name}.png`, encodePng(Buffer.from(rgb), COLUMNS * size, rows * size));
writeFileSync(`${OUT}/${name}.json`, JSON.stringify(table, null, 1) + '\n');
console.log(`${OUT}/${name}.png: ${briefs.length} rows (${FACES ? `rest, ${EXPRESSION_IDS.join(', ')}` : 'front, three-quarter, side; idle, cheer, hop, wave'})`);
console.table(table.map(({ brief, thesis }) => ({ brief, thesis })));
