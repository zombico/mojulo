/**
 * The pieces' bodies for a page: each kind with a `shape` (tabletop-shapes.js) as panels placed in its own frame for the
 * CSS 3D table (a matrix, a size, a clip, and how much light it catches, so the page shades it in the owner's colour),
 * and its side silhouette for the plan. A kind with no shape keeps its flat token.
 *
 *   pieceBodies(G, { cell, unit }) → { bodies: { <kind>: [{ w, h, t, clip?, k }] }, icons: { <kind>: [[x, z]…][] } }
 *     cell the board's cell in metres (a shape is written in cells), unit the page's pixels a metre
 */

import { planeMatrix } from '../scene/scene-css3d.js';
import { makeLight, litFactor } from '../polygonizer/vexar.js';
import { shapeFaces, shapeIcon } from './tabletop-shapes.js';

const LIGHT = makeLight({ direction: [0.35, 0.55, -0.76], ambient: 0.5, diffuse: 0.6 });
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const scale = (a, k) => a.map((x) => x * k);

export function pieceBodies(G, { cell, unit }) {
  const bodies = {}, icons = {};
  for (const [kind, P] of Object.entries(G.pieces || {})) {
    if (P.shape === undefined) continue;
    bodies[kind] = shapeFaces(P.shape).map((f) => ({
      w: r2(Math.hypot(...f.u) * cell * unit),
      h: r2(Math.hypot(...f.v) * cell * unit),
      t: planeMatrix(scale(f.c0, cell), scale(f.u, cell), scale(f.v, cell), unit),
      ...(f.clip ? { clip: f.clip } : {}),
      k: r3(litFactor(f.normal, LIGHT)),
    }));
    // a flat piece (a stone, a coin) reads from above as a disc: the plan keeps its round token
    const icon = shapeIcon(P.shape), xs = icon.flat().map((q) => q[0]), zs = icon.flat().map((q) => q[1]);
    if (Math.max(...zs) - Math.min(...zs) >= 0.5 * (Math.max(...xs) - Math.min(...xs))) icons[kind] = icon;
  }
  return { bodies, icons };
}
