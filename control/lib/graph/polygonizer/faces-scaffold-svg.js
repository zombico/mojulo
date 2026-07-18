/**
 * faces-scaffold-svg — a generic baked-face-list → filled control scaffold SVG.
 *
 * The workbench/assembler analogue of `renderManjiTreeToSvg(m, { control:true })`:
 * any `lowerObjectFaces`-shaped face list becomes the FILLED lit-solid still a
 * diffusion skin is painted over. Every face projects through the SAME
 * `projectTwoPoint(camera, roomBasis)` call the world skin bake uses
 * (`bakeSkinOntoFaces`), so the painter's scaffold and the 3D bake share one
 * camera — the shared camera IS the registration, no UV unwrap.
 *
 * The polygon emit matches the exact contract skin-projection's `reskinManjiSvg`
 * parses (points / fill / stroke / stroke-width / stroke-linejoin / data-shade),
 * with `data-shade` carrying the face's deterministic Lambert factor so the
 * reskin can multiply skin ALBEDO × recipe FORM.
 *
 * Pure: no DB, no IO. Callers supply faces (already lit) + the light they were
 * lowered with.
 */

import { projectTwoPoint } from './pure-mandala.js';
import { litFactor, newellNormal, orientOutward } from './vexar.js';
import { objectCenter } from './skin-projection.js';

const PAD = 26;

const faceCentroid = (corners) => {
  const c = [0, 0, 0];
  for (const p of corners) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
  return [c[0] / corners.length, c[1] / corners.length, c[2] / corners.length];
};

function projectFaces(faces, camera, roomBasis) {
  return faces.map((f) => {
    const proj = f.corners.map((c) => projectTwoPoint({ x: c[0], y: c[1], z: c[2] }, camera, roomBasis));
    let depth = 0;
    for (const p of proj) depth += p[2] || 0;
    return { face: f, proj, depth: depth / proj.length };
  });
}

/**
 * The viewBox the scaffold render will emit for these faces under this camera —
 * exported separately so the world skin bake can reproduce it WITHOUT
 * re-rendering the SVG (`bakeSkinOntoFaces({ viewBox })` must match the
 * scaffold the skin was painted over).
 * @returns {{ x, y, w, h }}
 */
export function scaffoldViewBox(faces, { camera = {}, roomBasis = {}, pad = PAD } = {}) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const { proj } of projectFaces(faces, camera, roomBasis)) {
    for (const [x, y] of proj) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 100, h: 100 };
  return { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad };
}

/**
 * Render the filled control scaffold: faces painted far-to-near with their lit
 * fills, each polygon carrying `data-shade` (its Lambert factor under `light`).
 * @param {Array} faces  lowerObjectFaces / lowerAssemblerFaces output
 * @param {object} opts  { camera, roomBasis, light, background, pad }
 */
export function renderFacesScaffoldSvg(faces, { camera = {}, roomBasis = {}, light, background = '#10141a', pad = PAD } = {}) {
  if (!light) throw new Error('faces-scaffold-svg: renderFacesScaffoldSvg requires the light the faces were lowered with');
  const vb = scaffoldViewBox(faces, { camera, roomBasis, pad });
  const center = objectCenter(faces);
  const polys = projectFaces(faces, camera, roomBasis)
    .map(({ face, proj, depth }) => {
      const cen = faceCentroid(face.corners);
      const normal = orientOutward(newellNormal(face.corners), cen, center);
      return {
        depth,
        pts: proj.map(([x, y]) => `${x},${y}`).join(' '),
        fill: face.fill || '#3a3a40',
        shade: litFactor(normal, light),
      };
    })
    .sort((a, b) => b.depth - a.depth); // painter's algorithm: far first
  const body = polys
    .map((p) => `<polygon points="${p.pts}" fill="${p.fill}" stroke="${p.fill}" stroke-width="0.5" stroke-linejoin="round" data-shade="${p.shade.toFixed(3)}"/>`)
    .join('\n');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}">`,
    `<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="${background}"/>`,
    body,
    '</svg>',
  ].join('\n');
}
