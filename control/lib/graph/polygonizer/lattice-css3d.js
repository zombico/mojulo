/**
 * The lattice in CSS 3D: the board as world quads for the preserve-3d backend (scene-css3d.js), a page with a movable
 * camera and no runtime. Each cell's top stands at its height on the meru; a side drops wherever a cell stands above
 * its neighbour, and round the rim down to the base slab, so a raised board reads as an object. Lit by a vexar light
 * baked per face (camera-independent).
 *
 *   latticeFaces(L, { base?, fills?, types?, palette?, light? }) → faces   base the slab under the board (cell / 6)
 *   latticeCameras(L) → [{ name, worldFraming }]                          'table' (a seat at the south edge), 'over'
 *   latticeSceneHtml(L, opts) → html                                      one self-contained page
 *
 * A square top is one panel. A hex top is its bounding rectangle clipped to the hexagon: a mask on a 3D layer leaves
 * the compositor's fast path, fine at a board's few dozen cells.
 */

import { emitPreserve3dScene } from '../scene/scene-css3d.js';
import { makeLight, shadeHex } from './vexar.js';
import { latticeColour, SQUARE_PALETTE, HEX_PALETTE } from './lattice-svg.js';

const SLAB = '#5b4632';
const BOARD_LIGHT = makeLight({ direction: [0.35, 0.55, -0.76], ambient: 0.55, diffuse: 0.5 });
const SQ3 = Math.sqrt(3);
const r6 = (x) => (Math.round(x * 1e6) / 1e6) || 0;

const POINTY_CLIP = 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)';
const FLAT_CLIP = 'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)';

export function latticeFaces(L, opts = {}) {
  const base = opts.base ?? L.cell / 6;
  const palette = opts.palette ?? (L.shape === 'square' ? SQUARE_PALETTE : HEX_PALETTE);
  const fills = opts.fills ?? {}, types = opts.types ?? {}, light = opts.light ?? BOARD_LIGHT;
  const faces = [];
  L.cells.forEach((cl, i) => {
    const [x, y, z] = cl.at;
    const fill = shadeHex(fills[cl.name] ?? types[cl.type] ?? palette[latticeColour(L, i) % palette.length], [0, 0, 1], light);
    // The panel: corner 0 its top-left seen from above (north-west), corner 1 along +x, corner 3 along -y.
    let hw, hh, clip;
    if (L.shape === 'square') { hw = L.cell / 2; hh = L.cell / 2; }
    else if (L.orient === 'pointy') { hw = L.cell / 2; hh = L.cell / SQ3; clip = POINTY_CLIP; }
    else { hw = L.cell / SQ3; hh = L.cell / 2; clip = FLAT_CLIP; }
    const P = (dx, dy) => [r6(x + dx), r6(y + dy), z];
    faces.push({ corners: [P(-hw, hh), P(hw, hh), P(hw, -hh), P(-hw, -hh)], fill, doubleSided: true, normal: [0, 0, 1],
      ...(clip ? { clip } : {}), group: `cell:${cl.name}` });
  });
  // Sides: down from a cell's top to its lower neighbour's, or to the slab's underside on the rim.
  L.cells.forEach((cl, i) => {
    cl.e.forEach((id, k) => {
      const j = cl.n[k], low = j < 0 ? -base : L.cells[j].at[2], hi = cl.at[2];
      if (hi <= low + 1e-9) return;
      const ed = L.edges[id], [a, b] = ed.ends.map((c) => L.corners[c].at);
      const ang = (L.dirs[k].angle * Math.PI) / 180, normal = [r6(Math.cos(ang)), r6(Math.sin(ang)), 0];
      const fill = shadeHex(j < 0 && cl.h === 0 ? SLAB : (fills[cl.name] ?? types[cl.type] ?? palette[latticeColour(L, i) % palette.length]), normal, light);
      faces.push({ corners: [[a[0], a[1], hi], [b[0], b[1], hi], [b[0], b[1], low], [a[0], a[1], low]], fill, doubleSided: true, normal, group: `side:${ed.name}` });
    });
  });
  return faces;
}

export function latticeCameras(L) {
  // far enough back for the board's diagonal, and for its width when it is much wider than deep (a rhombus of hexes)
  const reach = Math.max(Math.hypot(L.size[0], L.size[1]) / 2, L.size[0] * 0.68);
  return [
    { name: 'table', worldFraming: { cameraPosition: [0, r6(-reach * 1.55), r6(reach * 1.35)], lookAt: [0, r6(-reach * 0.08), 0], horizontalFov: 52 } },
    { name: 'over', worldFraming: { cameraPosition: [0, r6(-reach * 0.3), r6(reach * 2.3)], lookAt: [0, 0, 0], horizontalFov: 52 } },
  ];
}

export function latticeSceneHtml(L, opts = {}) {
  return emitPreserve3dScene({
    faces: latticeFaces(L, opts),
    cameras: opts.cameras ?? latticeCameras(L),
    viewBox: opts.viewBox ?? { width: 960, height: 680 },
    unitScale: opts.unitScale ?? 60,
    title: opts.title ?? 'mojulo board',
    bg: opts.bg ?? '#1d2026',
  });
}
