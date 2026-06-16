/**
 * Render the L-shaped studio demo through the polygonizer's actual camera
 * resolution + projection — same code the substrate uses end-to-end. This
 * is the "main flow" version of the L-shaped room SVG: every wall corner
 * and every furniture cuboid corner runs through
 *   withResolvedWorldCamera → projectTwoPoint
 * and the SVG is emitted from those projected coords.
 *
 * Run from the control dir:
 *   node scripts/render-l-shape-room.mjs > ../lite-template/integration/0606/spike-output/meru-unit-scale/l-shape-substrate.svg
 */

import {
  projectTwoPoint,
  withResolvedWorldCamera,
} from '../lib/graph/polygonizer/pure-mandala.js';

// ----- the manifest fragment a decorator would author --------------------

const manifest = {
  viewBox: { width: 1080, height: 560 },
  polygonizer: {
    metamandala: { sceneExtent: { width: 20 } },
  },
  cameraPrimitive: {
    kind: 'two-point',
    roomBasis: {
      worldExtent: { width: 20, depth: 10, height: 8 },
    },
    worldFraming: {
      cameraPosition: [10, 18, 5.5],
      lookAt:         [10, 5,  4],
      horizontalFov:  110,
    },
  },
};

// ----- resolve through the substrate --------------------------------------

const resolved = withResolvedWorldCamera(manifest);
const camera = resolved.cameraPrimitive;
const roomBasis = camera.roomBasis;

console.error('# resolved camera vanishingPoints:', JSON.stringify(camera.vanishingPoints));
console.error('# resolved horizonY:', camera.horizonY);
console.error('# resolved roomBasis xRange:', roomBasis.xRange, 'yRange:', roomBasis.yRange, 'verticalUnit:', roomBasis.verticalUnit);

// projectTwoPoint expects world coords as [x, y, z]. Return [screenX, screenY].
function project(x, y, z) {
  const [sx, sy] = projectTwoPoint([x, y, z], camera, roomBasis);
  return [sx, sy];
}

// ----- room corners (L-shape) --------------------------------------------

const ROOM_FLOOR = [
  { id: 'A', xyz: [ 0,  0, 0], label: 'NW living' },
  { id: 'B', xyz: [14,  0, 0], label: 'NE living' },
  { id: 'C', xyz: [14,  4, 0], label: 'inside L-fold' },
  { id: 'D', xyz: [20,  4, 0], label: 'NE kitchen' },
  { id: 'E', xyz: [20, 10, 0], label: 'SE kitchen' },
  { id: 'F', xyz: [ 0, 10, 0], label: 'SW living' },
];

const ROOM_CEILING = ROOM_FLOOR.map((c) => ({ ...c, id: `${c.id}'`, xyz: [c.xyz[0], c.xyz[1], 8] }));

const floor = ROOM_FLOOR.map((c) => ({ ...c, screen: project(...c.xyz) }));
const ceiling = ROOM_CEILING.map((c) => ({ ...c, screen: project(...c.xyz) }));

console.error('# floor corners (substrate-projected):');
floor.forEach((c) => console.error(`#   ${c.id} ${c.label}: world ${JSON.stringify(c.xyz)} → screen ${JSON.stringify(c.screen)}`));
console.error('# ceiling corners (substrate-projected):');
ceiling.forEach((c) => console.error(`#   ${c.id}: world ${JSON.stringify(c.xyz)} → screen ${JSON.stringify(c.screen)}`));

// ----- furniture (each is a cuboid with 8 corners) ------------------------

const FURNITURE = [
  { role: 'sofa',          xyz: [ 0, 2, 0], size: [3, 7, 2.5], fill: '#a86640', stroke: '#5e3618', faceFill: '#c47950' },
  { role: 'coffee-table',  xyz: [ 5, 5, 0], size: [4, 2, 1.5], fill: '#5d6b75', stroke: '#202b33', faceFill: '#7c8a94' },
  { role: 'armchair',      xyz: [10, 5, 0], size: [3, 3, 2.5], fill: '#a86640', stroke: '#5e3618', faceFill: '#c47950' },
  { role: 'tv-stand',      xyz: [13, 0, 0], size: [1, 4, 2  ], fill: '#7a5c3a', stroke: '#221608', faceFill: '#9d7a4c' },
  { role: 'kitchen-counter', xyz: [14, 4, 0], size: [6, 2, 3], fill: '#7a5c3a', stroke: '#221608', faceFill: '#9d7a4c' },
  { role: 'fridge',        xyz: [17, 7, 0], size: [3, 3, 6  ], fill: '#3a5a6e', stroke: '#10202c', faceFill: '#527588' },
];

function cuboidCorners(xyz, size) {
  const [x, y, z] = xyz;
  const [w, l, h] = size;
  return {
    // floor corners (lowercase) and ceiling corners (uppercase)
    fbl: project(x,     y,     z    ),  // back-left-floor
    fbr: project(x + w, y,     z    ),  // back-right-floor
    ffr: project(x + w, y + l, z    ),  // front-right-floor
    ffl: project(x,     y + l, z    ),  // front-left-floor
    cbl: project(x,     y,     z + h),  // back-left-ceiling
    cbr: project(x + w, y,     z + h),  // back-right-ceiling
    cfr: project(x + w, y + l, z + h),  // front-right-ceiling
    cfl: project(x,     y + l, z + h),  // front-left-ceiling
  };
}

const furnitureCorners = FURNITURE.map((piece) => ({
  ...piece,
  corners: cuboidCorners(piece.xyz, piece.size),
}));

// ----- emit SVG ----------------------------------------------------------

function poly(points, fill, stroke, strokeWidth = 0.7) {
  const pts = points.map((p) => `${p[0]},${p[1]}`).join(' ');
  return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

function visibleFaces(piece) {
  // Camera at x=10. Pieces west of x=10 show east face; east show west face.
  const cx = piece.xyz[0] + piece.size[0] / 2;
  const showEast = cx < 10;
  const showWest = cx > 10;
  const c = piece.corners;
  const faces = [];
  // Always the south (front) face — camera at y=18 looking north.
  faces.push(poly([c.ffl, c.ffr, c.cfr, c.cfl], piece.fill, piece.stroke));
  // Side face
  if (showEast) {
    faces.push(poly([c.fbr, c.ffr, c.cfr, c.cbr], piece.stroke, '#1a1a1a'));
  } else if (showWest) {
    faces.push(poly([c.fbl, c.ffl, c.cfl, c.cbl], piece.stroke, '#1a1a1a'));
  }
  // Top face (visible from camera above eye level on pieces at eye level or below)
  faces.push(poly([c.cbl, c.cbr, c.cfr, c.cfl], piece.faceFill, piece.stroke));
  return faces.join('\n  ');
}

const floorPoly = poly(floor.map((c) => c.screen), '#ead7b4', '#a89773', 1);
const ceilingPoly = poly(ceiling.map((c) => c.screen), '#efe3c5', '#bdb190', 0.6);

// Back walls — 5 polygons (N living, E stub, N kitchen, E kitchen, W living).
const wallSpec = [
  { name: 'n-living',  floorA: floor[0], floorB: floor[1], ceilA: ceiling[0], ceilB: ceiling[1], fill: '#e9ddc1' },
  { name: 'e-stub',    floorA: floor[1], floorB: floor[2], ceilA: ceiling[1], ceilB: ceiling[2], fill: '#dec890' },
  { name: 'n-kitchen', floorA: floor[2], floorB: floor[3], ceilA: ceiling[2], ceilB: ceiling[3], fill: '#e9ddc1' },
  { name: 'e-kitchen', floorA: floor[3], floorB: floor[4], ceilA: ceiling[3], ceilB: ceiling[4], fill: '#ddd0b0' },
  { name: 'w-living',  floorA: floor[5], floorB: floor[0], ceilA: ceiling[5], ceilB: ceiling[0], fill: '#e0d2af' },
];

const walls = wallSpec.map((w) => poly(
  [w.floorA.screen, w.floorB.screen, w.ceilB.screen, w.ceilA.screen],
  w.fill, '#a89773', 0.8,
)).join('\n  ');

// Painters' order: ceiling first, walls, floor, furniture (deepest first).
const furnitureSorted = [...furnitureCorners].sort((a, b) => a.xyz[1] - b.xyz[1]);
const furnitureSvg = furnitureSorted.map(visibleFaces).join('\n  ');

const svg = `<svg viewBox="0 0 1080 560" xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace, Menlo, Consolas, monospace">
  <rect width="100%" height="100%" fill="#fbfaf6"/>

  <text x="540" y="22" text-anchor="middle" font-size="15" font-weight="600" fill="#0a0a0a">
    L-shaped studio — projected through projectTwoPoint (main flow)
  </text>
  <text x="540" y="38" text-anchor="middle" font-size="10" fill="#555">
    every corner ran through withResolvedWorldCamera → projectTwoPoint · resolved vpLeft = [${camera.vanishingPoints.left.map((n) => Math.round(n)).join(', ')}], vpRight = [${camera.vanishingPoints.right.map((n) => Math.round(n)).join(', ')}], horizonY = ${Math.round(camera.horizonY)}
  </text>

  <!-- ceiling -->
  ${ceilingPoly}

  <!-- walls -->
  ${walls}

  <!-- floor -->
  ${floorPoly}

  <!-- furniture -->
  ${furnitureSvg}

  <!-- horizon -->
  <line x1="30" y1="${camera.horizonY}" x2="1050" y2="${camera.horizonY}" stroke="#aaa" stroke-width="0.4" stroke-dasharray="6,4" opacity="0.5"/>
  <text x="42" y="${camera.horizonY - 4}" font-size="8" fill="#888" font-style="italic">horizon</text>

  <text x="540" y="548" text-anchor="middle" font-size="9" fill="#888">
    camera at (10, 18, 5.5) ft · lookAt (10, 5, 4) ft · FOV 110° · roomBasis.worldExtent { 20, 10, 8 } · meru ruler = ${(roomBasis.verticalUnit).toFixed(1)} px/ft
  </text>
</svg>`;

console.log(svg);
