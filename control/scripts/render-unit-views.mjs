/**
 * Render an assembler unit sketch to front / three-quarter / side SVG stills,
 * auto-framed to its bounds. Run from control/.
 *   node scripts/render-unit-views.mjs <ref> <outPrefix>
 */
import { writeFileSync } from 'node:fs';
import { SketchRepository } from '../lib/db/repositories/sketches.js';
import { lowerAssemblerFaces } from '../lib/graph/worlds/workbench-assembler.js';
import { WORKBENCH_LIGHT } from '../lib/graph/worlds/workbench.js';
import { renderFacesScaffoldSvg } from '../lib/graph/polygonizer/faces-scaffold-svg.js';

const [, , ref, outPrefix] = process.argv;
const rec = SketchRepository.getByRef(ref);
if (!rec?.manifest) { console.error(`no sketch '${ref}'`); process.exit(1); }
const faces = lowerAssemblerFaces(rec.manifest);

const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k += 1) {
  if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k];
}
const ctr = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
const span = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
const D = span * 2.2;
const look = ctr;
// suit faces −y (front toward −y): the FRONT camera sits on the −y side.
const views = {
  front: [ctr[0], ctr[1] - D, ctr[2]],
  'three-quarter': [ctr[0] - D * 0.72, ctr[1] - D * 0.72, ctr[2] + D * 0.18],
  side: [ctr[0] - D, ctr[1], ctr[2]],
};
for (const [name, pos] of Object.entries(views)) {
  const camera = {
    worldFraming: { cameraPosition: pos, lookAt: look, horizontalFov: 30 },
    viewBox: { width: 760, height: 900 },
  };
  writeFileSync(`${outPrefix}-${name}.svg`,
    renderFacesScaffoldSvg(faces, { camera, roomBasis: {}, light: WORKBENCH_LIGHT }));
}
console.log(`${ref}: bounds x[${mn[0].toFixed(1)},${mx[0].toFixed(1)}] y[${mn[1].toFixed(1)},${mx[1].toFixed(1)}] z[${mn[2].toFixed(1)},${mx[2].toFixed(1)}] → ${outPrefix}-{front,three-quarter,side}.svg`);
