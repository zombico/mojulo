/** Review renders for the fitted humanoid heads. Each head is seen through the cameras it was fitted with, beside
 * its reference, the landmark cage, the raw fitted sampling and the built head (cheek planes, jaw to ear), then an
 * overlay; hair off, then worn. The male has no front reference: his front row is a 0° projection, marked inferred.
 * The references are the operator's images and never enter the repo; point MOJULO_FIT_REFS at a folder holding
 * `<preset>/<view>.png` (600 px). Without them the renders are drawn on paper.
 * Run from control: MOJULO_SPIKE_OUT=/absolute/path node ../docs/examples/humanoid/render-head-fit.mjs */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { humanoidHead, HEAD_SOURCES } from './head.mjs';
import { fitCameraSource, fitSilhouetteAgreement, fitViews, FIT_CHEEK, FIT_PRESETS } from './head-fit.mjs';
import { compileLayered } from '../../../control/lib/graph/polygonizer/station-loft.js';
import { rasterDepth } from '../../../control/lib/graph/scene/depth-raster.js';
import { vec } from '../../../control/lib/graph/polygonizer/station-loft-detail.js';

const { unit, cross, sub, dot } = vec;
// sharp is control's image dependency; resolve it from there.
const sharp = createRequire(new URL('../../../control/package.json', import.meta.url))('sharp');
const spike = (p) => fileURLToPath(new URL(`../../../lite-template/integration/0925/spike-output/${p}`, import.meta.url));
const OUT = resolve(process.env.MOJULO_SPIKE_OUT || spike('head-fit'));
const REFS = resolve(process.env.MOJULO_FIT_REFS || spike('head-fit-refs'));
mkdirSync(OUT, { recursive: true });
const SIZE = 600, SS = 2, BG = [247, 245, 239], key = unit([-0.5, 0.7, 0.85]), fill = unit([0.8, 0.2, 0.35]);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

async function reference(preset, view) {
  const file = `${REFS}/${preset}/${view}.png`;
  if (!existsSync(file)) return null;
  return sharp(readFileSync(file)).resize(SIZE, SIZE, { fit: 'fill' }).removeAlpha().raw().toBuffer();
}
/** A camera: a fitted one, or (for a head with no front reference) the three-quarter camera turned to 0°. */
function camera(preset, mesh, view) {
  if (fitViews(preset).includes(view)) return fitCameraSource(preset, mesh, view, SIZE);
  return fitCameraSource(preset, mesh, 'three-quarter', SIZE, { yawDegrees: 0 });
}
/** Shaded facets through a camera; `mix` blends them over the reference, 0 draws the head alone. */
function shade(preset, mesh, view, ref, mix) {
  const { source, cam } = camera(preset, mesh, view), raster = rasterDepth(source, cam, SIZE * SS);
  const colours = mesh.faces.map((f, i) => {
    const [a, b, c] = f.map((k) => mesh.vertices[k]), n = unit(cross(sub(b, a), sub(c, a)));
    const light = 0.48 + 0.42 * Math.max(0, dot(n, key)) + 0.13 * Math.max(0, dot(n, fill));
    return hex(mesh.palette?.[mesh.groups[i]] || '#d9a77e').map((v) => Math.min(255, Math.round(v * light)));
  });
  const rgb = Buffer.alloc(SIZE * SIZE * 3);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const under = ref ? [...ref.subarray((y * SIZE + x) * 3, (y * SIZE + x) * 3 + 3)] : BG, sum = [0, 0, 0];
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) {
      const face = raster.face[(y * SS + dy) * SIZE * SS + x * SS + dx];
      const col = face < 0 ? under : colours[face].map((v, k) => Math.round(v * (1 - mix) + under[k] * mix));
      for (let k = 0; k < 3; k++) sum[k] += col[k];
    }
    rgb.set(sum.map((v) => Math.round(v / (SS * SS))), (y * SIZE + x) * 3);
  }
  return rgb;
}
/** A head from the landmark cage, the raw fitted sampling, or the built fitted head. */
function headMesh(preset, stage, hair) {
  const was = [HEAD_SOURCES[preset], FIT_CHEEK.on];
  HEAD_SOURCES[preset] = stage === 'landmarks' ? 'landmarks' : 'fit'; FIT_CHEEK.on = stage === 'built';
  try { const head = humanoidHead({ preset, register: 'round', hair }); return { ...compileLayered(head), palette: head.palette }; }
  finally { [HEAD_SOURCES[preset], FIT_CHEEK.on] = was; }
}
const png = (rgb, w = SIZE, h = SIZE) => sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).png();
const crop = { left: 130, top: 90, width: 340, height: 360 }, agreement = {};
for (const preset of FIT_PRESETS) {
  const views = [...new Set(['front', ...fitViews(preset)])], rows = [];
  for (const hair of ['none', 'swept']) {
    const stages = ['landmarks', 'sampled', 'built'].map((stage) => headMesh(preset, stage, hair)), built = stages.at(-1);
    for (const view of views) {
      const ref = fitViews(preset).includes(view) ? await reference(preset, view) : null;
      const cells = [ref ?? Buffer.alloc(SIZE * SIZE * 3, 247), ...stages.map((m) => shade(preset, m, view, null, 0)), shade(preset, built, view, ref, ref ? 0.45 : 0)];
      rows.push(cells);
      if (hair === 'none') await png(cells.at(-1)).toFile(`${OUT}/${preset}-${view}-overlay.png`);
    }
  }
  // Rows: views (hair off, then on); columns reference · landmark cage · fitted sampling · built · overlay.
  const cols = rows[0].length, cw = crop.width, ch = crop.height, sheet = Buffer.alloc(cw * cols * ch * rows.length * 3, 247);
  for (const [r, cells] of rows.entries()) for (const [c, rgb] of cells.entries()) for (let y = 0; y < ch; y++) {
    const src = ((crop.top + y) * SIZE + crop.left) * 3;
    rgb.copy(sheet, ((r * ch + y) * cw * cols + c * cw) * 3, src, src + cw * 3);
  }
  await png(sheet, cw * cols, ch * rows.length).toFile(`${OUT}/${preset}-sheet.png`);
  agreement[preset] = fitSilhouetteAgreement(preset, compileLayered(humanoidHead({ preset, hair: 'none' })));
}
writeFileSync(`${OUT}/agreement.json`, JSON.stringify(agreement, null, 2));
console.log(OUT, JSON.stringify(agreement));
