/** Render actual recipe geometry. Rows: male/female; columns documented in index.html.
 * Run from control: MOJULO_SPIKE_OUT=/absolute/path node ../docs/examples/humanoid/render.mjs */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { humanoidPlan } from './humanoid.plan.mjs';
import { humanoidHead, EXPRESSIONS } from './head.mjs';
import { expandPlan } from '../../../control/lib/graph/polygonizer/station-loft-plan.js';
import { compileLayered, auditLayered } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { validateRig, bindLayered, boneFrames, rigNodesAt, skinLayered, layeredClip } from '../../../control/lib/graph/polygonizer/station-loft-rig.js';
import { viewCamera, rasterDepth } from '../../../control/lib/graph/scene/depth-raster.js';
import { encodePng } from '../../../control/lib/graph/landscape/surface-textures.js';
import { vec } from '../../../control/lib/graph/polygonizer/station-loft-detail.js';
const { unit, cross, sub, dot } = vec;
const OUT = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/0925/spike-output/humanoid', import.meta.url)));
mkdirSync(OUT, { recursive: true });
const BG = [247, 245, 239], key = unit([-0.5, 0.7, 0.85]), fill = unit([0.8, 0.2, 0.35]);
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function render(mesh, palette, view = 'three-quarter', size = 600, silhouette = false) {
  const camera = viewCamera(mesh, view, { size, focalPixels: size * 1.5, elevationDegrees: 4 });
  const ss = size <= 128 ? 1 : 2, raster = rasterDepth(mesh, camera, size * ss);
  const colours = mesh.faces.map((f, i) => {
    const [a, b, c] = f.map(k => mesh.vertices[k]), n = unit(cross(sub(b, a), sub(c, a)));
    const light = 0.48 + 0.42 * Math.max(0, dot(n, key)) + 0.13 * Math.max(0, dot(n, fill));
    return silhouette ? [35, 37, 39] : hex(palette[mesh.groups[i]] || '#ff00ff').map(c => Math.min(255, Math.round(c * light)));
  });
  const rgb = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sum = [0, 0, 0];
    for (let dy = 0; dy < ss; dy++) for (let dx = 0; dx < ss; dx++) {
      const face = raster.face[(y * ss + dy) * size * ss + x * ss + dx], col = face < 0 ? BG : colours[face];
      for (let k = 0; k < 3; k++) sum[k] += col[k];
    }
    rgb.set(sum.map(c => Math.round(c / (ss * ss))), (y * size + x) * 3);
  }
  return { rgb, size };
}
const save = (name, img) => writeFileSync(`${OUT}/${name}.png`, encodePng(Buffer.from(img.rgb), img.size, img.size));
function sheet(name, cells, columns, size) {
  const rows = Math.ceil(cells.length / columns), rgb = new Uint8Array(columns * size * rows * size * 3);
  for (let i = 0; i < rgb.length; i += 3) rgb.set(BG, i);
  cells.forEach((cell, i) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const src = (Math.floor(y * cell.size / size) * cell.size + Math.floor(x * cell.size / size)) * 3;
      const dst = ((Math.floor(i / columns) * size + y) * columns * size + (i % columns) * size + x) * 3;
      rgb.set(cell.rgb.subarray(src, src + 3), dst);
    }
  });
  writeFileSync(`${OUT}/${name}.png`, encodePng(Buffer.from(rgb), columns * size, rows * size));
}
const cells = [], expressions = [], silhouettes = [], stats = {}, previews = [];
for (const preset of ['male', 'female']) {
  const opts = { preset, hair: 'swept' }, plan = humanoidPlan(opts), recipe = expandPlan(plan), mesh = compileLayered(recipe);
  const R = validateRig(recipe.rig), skin = bindLayered(mesh, recipe, R);
  for (const view of ['frontal', 'three-quarter', 'lateral', 'back']) {
    const img = render(mesh, recipe.palette, view); save(`${preset}-${view}`, img); cells.push(img);
    if (view === 'three-quarter') previews.push(img);
    const thumb = render(mesh, recipe.palette, view, 64, true); save(`${preset}-${view}-64`, thumb); silhouettes.push(thumb);
  }
  const head = humanoidHead(opts), face = render(compileLayered(head), head.palette); save(`${preset}-head`, face); cells.push(face);
  for (const [clip, phase] of [['wave', 0.25], ['walk', 0.125]]) {
    const { nodes } = rigNodesAt(R, layeredClip(recipe.clips[clip], R)(phase));
    const posed = { ...mesh, vertices: skinLayered(mesh, skin, boneFrames(R, R.joints, nodes)) };
    const img = render(posed, recipe.palette); save(`${preset}-${clip}`, img); cells.push(img);
  }
  for (const expression of Object.keys(EXPRESSIONS)) {
    const h = humanoidHead({ ...opts, expression }), img = render(compileLayered(h), h.palette, 'frontal');
    save(`${preset}-${expression}`, img); expressions.push(img);
  }
  stats[preset] = { vertices: mesh.vertices.length, faces: mesh.faces.length, audit: auditLayered(mesh) };
  writeFileSync(`${OUT}/${preset}.plan.json`, JSON.stringify(plan, null, 2) + '\n');
}
sheet('review', cells, 7, 360); sheet('expressions', expressions, 4, 420);
sheet('silhouettes-64', silhouettes, 4, 64); sheet('male-female', previews, 2, 700);
writeFileSync(`${OUT}/stats.json`, JSON.stringify(stats, null, 2) + '\n');
writeFileSync(`${OUT}/index.html`, `<!doctype html><html lang="en"><meta charset="utf-8"><title>Planar humanoid review</title><style>body{background:#f7f5ef;color:#302b26;font:16px system-ui;max-width:1500px;margin:40px auto;padding:20px}img{max-width:100%}p{max-width:900px}</style><h1>Planar humanoid · actual geometry</h1><p>Male and female starting presets. Same hair and palette to isolate proportion changes. No image generation. Human visual acceptance pending.</p><img src="male-female.png"><h2>Construction and poses</h2><p>Rows: male, female. Columns: front, three-quarter, side, back, head, wave, walk.</p><img src="review.png"><h2>Expressions</h2><p>Neutral · smile · determined · surprised. Rows: male, female.</p><img src="expressions.png"><h2>64 px silhouettes</h2><img src="silhouettes-64.png"></html>`);
console.log(OUT);
