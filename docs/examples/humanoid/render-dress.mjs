/** The hero's BUILD-UP sheet: form → body detail → adornment, the dragon's passes with the hero's parameters
 * (control/lib/graph/polygonizer/hero-dress.js). Rows: male round, female lowpoly; columns: the stages at four views,
 * then the adorned figure at 128 / 256 / 512 px, mid-walk and mid-wave, and a bust. Diagnostic, gitignored output.
 * Run from control: node ../docs/examples/humanoid/render-dress.mjs  (MOJULO_SPIKE_OUT to redirect) */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { humanoidPlan } from './humanoid.plan.mjs';
import { expandPlan } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';
import { compileLayered } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { validateRig, bindLayered, boneFrames, rigNodesAt, skinLayered, layeredClip } from '../../../control/lib/graph/polygonizer/station-loft-rig.js';
import { justify } from '../../../control/lib/graph/polygonizer/station-loft-adorn.js';
import { viewCamera, rasterDepth } from '../../../control/lib/graph/scene/depth-raster.js';
import { encodePng } from '../../../control/lib/graph/landscape/surface-textures.js';
import { vec } from '../../../control/lib/graph/polygonizer/station-loft-detail.js';
const { unit, cross, sub, dot } = vec;
const OUT = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/0926/spike-output/hero-dress', import.meta.url)));
mkdirSync(OUT, { recursive: true });
const BG = [247, 245, 239], key = unit([-0.5, 0.7, 0.85]), fill = unit([0.8, 0.2, 0.35]);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function render(mesh, palette, view = 'three-quarter', size = 600, frameMesh = mesh) {
  const camera = viewCamera(frameMesh, view, { size, focalPixels: size * 1.5, elevationDegrees: 4 });
  const ss = size <= 128 ? 1 : 2, raster = rasterDepth(mesh, camera, size * ss);
  const colours = mesh.faces.map((f, i) => { const [a, b, c] = f.map((k) => mesh.vertices[k]), n = unit(cross(sub(b, a), sub(c, a)));
    const light = 0.48 + 0.42 * Math.max(0, dot(n, key)) + 0.13 * Math.max(0, dot(n, fill)); return hex(palette[mesh.groups[i]] || '#ff00ff').map((c) => Math.min(255, Math.round(c * light))); });
  const rgb = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const sum = [0, 0, 0];
    for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) { const face = raster.face[(y * ss + dy) * size * ss + x * ss + dx], col = face < 0 ? BG : colours[face]; for (let k = 0; k < 3; k++) sum[k] += col[k]; }
    rgb.set(sum.map((c) => Math.round(c / (ss * ss))), (y * size + x) * 3); }
  return { rgb, size };
}
function sheet(name, cells, columns, size) {
  const rows = Math.ceil(cells.length / columns), rgb = new Uint8Array(columns * size * rows * size * 3); for (let i = 0; i < rgb.length; i += 3) rgb.set(BG, i);
  cells.forEach((cell, i) => { if (!cell) return; for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const src = (Math.floor(y * cell.size / size) * cell.size + Math.floor(x * cell.size / size)) * 3;
    const dst = ((Math.floor(i / columns) * size + y) * columns * size + (i % columns) * size + x) * 3; rgb.set(cell.rgb.subarray(src, src + 3), dst); } });
  writeFileSync(`${OUT}/${name}.png`, encodePng(Buffer.from(rgb), columns * size, rows * size));
}
/** a crop of a mesh above z, for the bust */
function above(mesh, z) { const ids = mesh.faces.map((f, i) => (f.every((v) => mesh.vertices[v][2] >= z) ? i : -1)).filter((i) => i >= 0);
  const used = [...new Set(ids.flatMap((i) => mesh.faces[i]))], remap = new Map(used.map((v, i) => [v, i]));
  return { vertices: used.map((v) => mesh.vertices[v]), faces: ids.map((i) => mesh.faces[i].map((v) => remap.get(v))), groups: ids.map((i) => mesh.groups[i]) }; }

const VIEWS = ['frontal', 'three-quarter', 'lateral', 'back'];
const report = {};
const rows = [];
for (const [label, opts] of [['male-round', { preset: 'male', register: 'round', hair: 'crop' }], ['female-lowpoly', { preset: 'female', register: 'lowpoly', hair: 'ponytail' }]]) {
  const stages = [{}, { detail: 'clothed' }, { detail: 'clothed', adorn: 'ranger' }].map((d) => { const plan = humanoidPlan({ ...opts, ...d }); const recipe = expandPlan(plan); return { plan, recipe, mesh: compileLayered(recipe) }; });
  const done = stages[2]; const palette = done.recipe.palette;
  for (const view of VIEWS) { const cells = stages.map((s) => render(s.mesh, palette, view, 520, done.mesh)); sheet(`${label}-${view}`, cells, 3, 520); rows.push(...cells); }
  sheet(`${label}-sizes`, [128, 256, 512].map((px) => render(done.mesh, palette, 'three-quarter', px)), 3, 512);
  const R = validateRig(done.recipe.rig), skin = bindLayered(done.mesh, done.recipe, R); const motion = [];
  for (const [clip, phase] of [['walk', 0.125], ['walk', 0.625], ['wave', 0.25]]) { const { nodes } = rigNodesAt(R, layeredClip(done.recipe.clips[clip], R)(phase));
    const posed = { ...done.mesh, vertices: skinLayered(done.mesh, skin, boneFrames(R, R.joints, nodes)) }; motion.push(render(posed, palette, 'three-quarter', 520, done.mesh)); }
  sheet(`${label}-motion`, motion, 3, 520);
  const bust = above(done.mesh, done.plan.segments.find((s) => s.name === 'torso').stations[1].z - 0.05);
  sheet(`${label}-bust`, ['frontal', 'three-quarter', 'back'].map((v) => render(bust, palette, v, 700)), 3, 700);
  report[label] = { faces: stages.map((s) => s.mesh.faces.length), recipeKB: stages.map((s) => Math.round(Buffer.byteLength(JSON.stringify(s.recipe)) / 1024)),
    adornments: justify(done.mesh, done.plan.adorn.map((A) => ({ id: A.id, signature: A.signature.kind }))).map((r) => `${r.id} ${r.verdict} (exposed ${r.sigExposed}, share ${r.sigShare})`) };
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify(report, null, 1)); console.log(OUT);
