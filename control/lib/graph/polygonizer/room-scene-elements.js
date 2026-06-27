/**
 * Room scene elements - normalized surface budgets for interior perspective.
 *
 * A model can author "window on back wall" or "rug on floor" in mandala-space
 * percentages. This planner resolves those requests into stable room-surface
 * bands, world-space quads, and optional pixel projection through the shared
 * two-point camera.
 */

import { projectTwoPoint } from './pure-mandala.js';
import { planKitchenRun } from '../kitchen-run.js';

const DEFAULT_PRESETS = {
  rug: { surface: 'floor', aspect: 1.55, areaShare: 0.18, motif: 'woven-rug', height: 0.02, supportPattern: 'none', planeRole: 'floor-skin' },
  runner: { surface: 'floor', aspect: 3.2, areaShare: 0.12, motif: 'floor-runner', height: 0.02, supportPattern: 'none', planeRole: 'floor-skin' },
  table: { surface: 'floor', aspect: 1.25, areaShare: 0.055, motif: 'low-table', height: 0.76, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'table-plane' },
  'standing-desk': { surface: 'floor', aspect: 1.9, areaShare: 0.065, motif: 'standing-desk', height: 1.18, supportPattern: 'two-side', supportKind: 'block', planeRole: 'table-plane' },
  standingDesk: { surface: 'floor', aspect: 1.9, areaShare: 0.065, motif: 'standing-desk', height: 1.18, supportPattern: 'two-side', supportKind: 'block', planeRole: 'table-plane' },
  bed: { surface: 'floor', aspect: 1.45, areaShare: 0.16, motif: 'bed-block', height: 0.55, supportPattern: 'block-corners', supportKind: 'block', planeRole: 'table-plane' },
  sofa: { surface: 'floor', aspect: 2.4, areaShare: 0.09, motif: 'sofa-block', height: 0.48, supportPattern: 'block-corners', supportKind: 'block', planeRole: 'table-plane' },
  'modern-couch': { surface: 'floor', aspect: 2.55, areaShare: 0.10, motif: 'modern-couch', height: 0.74, supportPattern: 'none', planeRole: 'seat-plane' },
  modernCouch: { surface: 'floor', aspect: 2.55, areaShare: 0.10, motif: 'modern-couch', height: 0.74, supportPattern: 'none', planeRole: 'seat-plane' },
  bench: { surface: 'floor', aspect: 2.6, areaShare: 0.045, motif: 'bench-plank', height: 0.48, supportPattern: 'two-side', supportKind: 'block', planeRole: 'seat-plane' },
  stool: { surface: 'floor', aspect: 1.0, areaShare: 0.022, motif: 'stool-seat', height: 0.55, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'seat-plane' },
  chair: { surface: 'floor', aspect: 0.9, areaShare: 0.028, motif: 'chair-block', height: 0.92, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'seat-plane' },
  'yoke-chair': { surface: 'floor', aspect: 0.9, areaShare: 0.028, motif: 'yoke-back-chair', height: 0.94, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'seat-plane' },
  yokeChair: { surface: 'floor', aspect: 0.9, areaShare: 0.028, motif: 'yoke-back-chair', height: 0.94, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'seat-plane' },
  'ladder-chair': { surface: 'floor', aspect: 0.9, areaShare: 0.028, motif: 'ladder-back-chair', height: 0.96, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'seat-plane' },
  ladderChair: { surface: 'floor', aspect: 0.9, areaShare: 0.028, motif: 'ladder-back-chair', height: 0.96, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'seat-plane' },
  'dining-table': { surface: 'floor', aspect: 1.7, areaShare: 0.11, motif: 'dining-table', height: 0.74, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'table-plane' },
  diningTable: { surface: 'floor', aspect: 1.7, areaShare: 0.11, motif: 'dining-table', height: 0.74, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'table-plane' },
  'computer-chair': { surface: 'floor', aspect: 0.95, areaShare: 0.03, motif: 'computer-chair', height: 0.72, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'seat-plane' },
  computerChair: { surface: 'floor', aspect: 0.95, areaShare: 0.03, motif: 'computer-chair', height: 0.72, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'seat-plane' },
  armchair: { surface: 'floor', aspect: 1.05, areaShare: 0.04, motif: 'armchair-block', height: 0.58, supportPattern: 'block-corners', supportKind: 'block', planeRole: 'seat-plane' },
  'club-chair': { surface: 'floor', aspect: 1.1, areaShare: 0.05, motif: 'club-chair', height: 0.84, supportPattern: 'none', planeRole: 'seat-plane' },
  clubChair: { surface: 'floor', aspect: 1.1, areaShare: 0.05, motif: 'club-chair', height: 0.84, supportPattern: 'none', planeRole: 'seat-plane' },
  'single-sofa': { surface: 'floor', aspect: 1.1, areaShare: 0.05, motif: 'club-chair', height: 0.84, supportPattern: 'none', planeRole: 'seat-plane' },
  singleSofa: { surface: 'floor', aspect: 1.1, areaShare: 0.05, motif: 'club-chair', height: 0.84, supportPattern: 'none', planeRole: 'seat-plane' },
  'lounge-chair': { surface: 'floor', aspect: 1.1, areaShare: 0.05, motif: 'lounge-chair', height: 0.78, supportPattern: 'none', planeRole: 'seat-plane' },
  loungeChair: { surface: 'floor', aspect: 1.1, areaShare: 0.05, motif: 'lounge-chair', height: 0.78, supportPattern: 'none', planeRole: 'seat-plane' },
  'tub-chair': { surface: 'floor', aspect: 1.1, areaShare: 0.05, motif: 'lounge-chair', height: 0.78, supportPattern: 'none', planeRole: 'seat-plane' },
  tubChair: { surface: 'floor', aspect: 1.1, areaShare: 0.05, motif: 'lounge-chair', height: 0.78, supportPattern: 'none', planeRole: 'seat-plane' },
  cabinet: { surface: 'floor', aspect: 1.8, areaShare: 0.08, motif: 'cabinet-face', height: 1.1, supportPattern: 'none', planeRole: 'storage-plane' },
  bar: { surface: 'floor', aspect: 3.0, areaShare: 0.1, motif: 'bar-counter', height: 1.12, supportPattern: 'none', planeRole: 'storage-plane' },
  bookshelf: { surface: 'floor', aspect: 0.78, areaShare: 0.09, motif: 'bookcase-grid', height: 1.8, supportPattern: 'none', planeRole: 'storage-plane' },
  'rack-shelf': { surface: 'floor', aspect: 1.35, areaShare: 0.075, motif: 'rack-shelf-repeat', height: 1.6, supportPattern: 'none', planeRole: 'storage-plane' },
  rackShelf: { surface: 'floor', aspect: 1.35, areaShare: 0.075, motif: 'rack-shelf-repeat', height: 1.6, supportPattern: 'none', planeRole: 'storage-plane' },
  rackShelves: { surface: 'floor', aspect: 1.35, areaShare: 0.075, motif: 'rack-shelf-repeat', height: 1.6, supportPattern: 'none', planeRole: 'storage-plane' },
  dresser: { surface: 'floor', aspect: 1.45, areaShare: 0.065, motif: 'drawer-stack', height: 0.9, supportPattern: 'none', planeRole: 'storage-plane' },
  nightstand: { surface: 'floor', aspect: 0.95, areaShare: 0.025, motif: 'small-drawer', height: 0.62, supportPattern: 'none', planeRole: 'storage-plane' },
  sideboard: { surface: 'floor', aspect: 2.4, areaShare: 0.075, motif: 'sideboard-doors', height: 0.9, supportPattern: 'none', planeRole: 'storage-plane' },
  'media-unit': { surface: 'floor', aspect: 2.8, areaShare: 0.075, motif: 'media-unit', height: 1.12, supportPattern: 'none', planeRole: 'storage-plane' },
  mediaUnit: { surface: 'floor', aspect: 2.8, areaShare: 0.075, motif: 'media-unit', height: 1.12, supportPattern: 'none', planeRole: 'storage-plane' },
  'tv-stand': { surface: 'floor', aspect: 2.8, areaShare: 0.075, motif: 'media-unit', height: 1.12, supportPattern: 'none', planeRole: 'storage-plane' },
  tvStand: { surface: 'floor', aspect: 2.8, areaShare: 0.075, motif: 'media-unit', height: 1.12, supportPattern: 'none', planeRole: 'storage-plane' },
  monitor: { surface: 'floor', aspect: 3.4, areaShare: 0.012, motif: 'monitor', height: 0.52, supportPattern: 'none', planeRole: 'table-plane' },
  display: { surface: 'floor', aspect: 3.4, areaShare: 0.012, motif: 'monitor', height: 0.52, supportPattern: 'none', planeRole: 'table-plane' },
  laptop: { surface: 'floor', aspect: 1.4, areaShare: 0.012, motif: 'laptop', height: 0.04, supportPattern: 'none', planeRole: 'table-plane' },
  keyboard: { surface: 'floor', aspect: 2.7, areaShare: 0.012, motif: 'keyboard', height: 0.025, supportPattern: 'none', planeRole: 'table-plane' },
  toilet: { surface: 'floor', aspect: 0.62, areaShare: 0.03, motif: 'toilet', height: 0.78, supportPattern: 'none', planeRole: 'storage-plane' },
  drawers: { surface: 'floor', aspect: 0.8, areaShare: 0.05, motif: 'drawer-tower', height: 1.15, supportPattern: 'none', planeRole: 'storage-plane' },
  tallboy: { surface: 'floor', aspect: 0.8, areaShare: 0.05, motif: 'drawer-tower', height: 1.15, supportPattern: 'none', planeRole: 'storage-plane' },
  tv: { surface: 'backWall', aspect: 1.78, areaShare: 0.10, motif: 'tv-screen', height: 0.06, supportPattern: 'none', planeRole: 'wall-plane' },
  television: { surface: 'backWall', aspect: 1.78, areaShare: 0.10, motif: 'tv-screen', height: 0.06, supportPattern: 'none', planeRole: 'wall-plane' },
  window: { surface: 'backWall', aspect: 1.45, areaShare: 0.13, motif: 'window-light', height: 0.08, supportPattern: 'none', planeRole: 'wall-plane' },
  door: { surface: 'backWall', aspect: 0.46, areaShare: 0.16, motif: 'door-panel', height: 0.08, supportPattern: 'none', planeRole: 'wall-plane' },
  picture: { surface: 'backWall', aspect: 1.25, areaShare: 0.035, motif: 'wall-picture', height: 0.06, supportPattern: 'none', planeRole: 'wall-shelf' },
  sconce: { surface: 'backWall', aspect: 0.42, areaShare: 0.012, motif: 'wall-sconce', height: 0.08, supportPattern: 'none', planeRole: 'wall-shelf' },
};

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finiteOr(Number(value), min)));
}

function asArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function add3(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale3(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function orderedRange(range, fallback) {
  const raw = Array.isArray(range) && range.length >= 2 ? range : fallback;
  const a = finiteOr(Number(raw[0]), fallback[0]);
  const b = finiteOr(Number(raw[1]), fallback[1]);
  return a <= b ? [a, b] : [b, a];
}

function roomRanges(roomBasis = {}) {
  const extent = roomBasis.worldExtent || {};
  const width = Math.max(finiteOr(Number(extent.width), 16), 0.1);
  const depth = Math.max(finiteOr(Number(extent.depth), 12), 0.1);
  const height = Math.max(finiteOr(Number(extent.height), 8), 0.1);
  const xRange = orderedRange(roomBasis.xRange, [0, width]);
  const yRange = orderedRange(roomBasis.yRange, [0, depth]);
  const zRange = orderedRange(roomBasis.zRange, [0, height]);
  return { xRange, yRange, zRange };
}

function surface(name, origin, uVector, vVector, width, height, aliases = []) {
  return {
    id: name,
    aliases,
    origin,
    uVector,
    vVector,
    width,
    height,
    area: width * height,
  };
}

export function resolveRoomSurfaces(roomBasis = {}) {
  const { xRange, yRange, zRange } = roomRanges(roomBasis);
  const [x0, x1] = xRange;
  const [y0, y1] = yRange;
  const [z0, z1] = zRange;
  const width = x1 - x0;
  const depth = y1 - y0;
  const height = z1 - z0;
  const list = [
    surface('floor', [x0, y0, z0], [width, 0, 0], [0, depth, 0], width, depth, ['ground']),
    surface('ceiling', [x0, y0, z1], [width, 0, 0], [0, depth, 0], width, depth),
    surface('backWall', [x0, y0, z0], [width, 0, 0], [0, 0, height], width, height, ['back', 'rearWall']),
    surface('frontWall', [x0, y1, z0], [width, 0, 0], [0, 0, height], width, height, ['front']),
    surface('leftWall', [x0, y0, z0], [0, depth, 0], [0, 0, height], depth, height, ['left']),
    surface('rightWall', [x1, y0, z0], [0, depth, 0], [0, 0, height], depth, height, ['right']),
  ];
  const byId = new Map();
  for (const item of list) {
    byId.set(item.id, item);
    for (const alias of item.aliases) byId.set(alias, item);
  }
  return { list, byId, ranges: { xRange, yRange, zRange } };
}

function surfacePoint(surfaceDef, u, v) {
  return add3(
    surfaceDef.origin,
    add3(scale3(surfaceDef.uVector, u), scale3(surfaceDef.vVector, v)),
  );
}

function offsetZ(point, z) {
  return [point[0], point[1], point[2] + z];
}

function bilerp(corners, u, v) {
  const [a, b, c, d] = corners;
  return [
    a[0] * (1 - u) * (1 - v) + b[0] * u * (1 - v) + c[0] * u * v + d[0] * (1 - u) * v,
    a[1] * (1 - u) * (1 - v) + b[1] * u * (1 - v) + c[1] * u * v + d[1] * (1 - u) * v,
    a[2] * (1 - u) * (1 - v) + b[2] * u * (1 - v) + c[2] * u * v + d[2] * (1 - u) * v,
  ];
}

function normalizeAnchor(value, fallback = 0.5) {
  if (Array.isArray(value)) {
    const u = Number.isFinite(Number(value[0])) ? value[0] : fallback;
    const v = Number.isFinite(Number(value[1])) ? value[1] : fallback;
    return [clamp(u, 0, 1), clamp(v, 0, 1)];
  }
  if (value && typeof value === 'object') {
    const u = Number.isFinite(Number(value.u ?? value.x)) ? (value.u ?? value.x) : fallback;
    const v = Number.isFinite(Number(value.v ?? value.y)) ? (value.v ?? value.y) : fallback;
    return [clamp(u, 0, 1), clamp(v, 0, 1)];
  }
  return [fallback, fallback];
}

function normalizeElementSize(element, preset, surfaceDef) {
  const aspect = Math.max(finiteOr(Number(element.aspect ?? preset.aspect), 1), 0.05);
  const explicitW = Number(element.w ?? element.width ?? element.uSize);
  const explicitH = Number(element.h ?? element.height ?? element.vSize);
  if (Number.isFinite(explicitW) || Number.isFinite(explicitH)) {
    const h = Number.isFinite(explicitH)
      ? clamp(explicitH, 0.005, 1)
      : clamp((explicitW * surfaceDef.width) / (aspect * surfaceDef.height), 0.005, 1);
    const w = Number.isFinite(explicitW)
      ? clamp(explicitW, 0.005, 1)
      : clamp((h * aspect * surfaceDef.height) / surfaceDef.width, 0.005, 1);
    return { w, h, aspect, areaShare: w * h };
  }
  const areaShare = clamp(element.areaShare ?? element.areaBudget ?? preset.areaShare ?? 0.06, 0.0005, 1);
  const h = Math.sqrt((areaShare * surfaceDef.area) / (aspect * surfaceDef.height * surfaceDef.height));
  const w = (h * aspect * surfaceDef.height) / surfaceDef.width;
  const scale = Math.min(1, 0.98 / Math.max(w, h));
  return { w: clamp(w * scale, 0.005, 1), h: clamp(h * scale, 0.005, 1), aspect, areaShare };
}

function normalizeHeight(element, preset) {
  return Math.max(0, finiteOr(Number(
    element.heightWorld ??
    element.elevation ??
    element.height ??
    preset.height,
  ), 0));
}

function bandFromAnchor(anchor, size) {
  const [u, v] = anchor;
  let u0 = u - size.w * 0.5;
  let u1 = u + size.w * 0.5;
  let v0 = v - size.h * 0.5;
  let v1 = v + size.h * 0.5;
  if (u0 < 0) { u1 -= u0; u0 = 0; }
  if (u1 > 1) { u0 -= u1 - 1; u1 = 1; }
  if (v0 < 0) { v1 -= v0; v0 = 0; }
  if (v1 > 1) { v0 -= v1 - 1; v1 = 1; }
  return [clamp(u0, 0, 1), clamp(u1, 0, 1), clamp(v0, 0, 1), clamp(v1, 0, 1)];
}

function supportPatternPoints(pattern) {
  switch (pattern) {
    case 'center':
      return [[0.5, 0.5]];
    case 'two-side':
      return [[0.18, 0.5], [0.82, 0.5]];
    case 'block-corners':
    case 'four-corner':
      return [[0.14, 0.14], [0.86, 0.14], [0.86, 0.86], [0.14, 0.86]];
    case 'none':
    default:
      return [];
  }
}

function buildHeightManji(element, surfaceDef, preset, source) {
  const height = normalizeHeight(source, preset);
  const planeRole = String(source.planeRole || preset.planeRole || (surfaceDef.id === 'floor' ? 'table-plane' : 'wall-plane'));
  const supportPattern = String(source.supportPattern || preset.supportPattern || 'none');
  const supportKind = String(source.supportKind || preset.supportKind || 'cylinder');
  const canElevate = surfaceDef.id === 'floor' && height > 0;
  const topCorners = canElevate
    ? element.worldCorners.map((corner) => offsetZ(corner, height))
    : [...element.worldCorners];
  const supportPoints = canElevate ? supportPatternPoints(supportPattern) : [];
  const supports = supportPoints.map(([u, v], index) => {
    const bottom = bilerp(element.worldCorners, u, v);
    const top = offsetZ(bottom, height);
    return {
      id: `${element.id}-support-${index + 1}`,
      kind: supportKind,
      u,
      v,
      radius: clamp(source.supportRadius ?? preset.supportRadius ?? 0.045, 0.005, 0.5),
      bottom,
      top,
      role: `${element.id}:${supportKind}:elevation-support`,
    };
  });
  return {
    kind: 'heightManji',
    id: `${element.id}:height-manji`,
    elementId: element.id,
    planeRole,
    supportPattern,
    heightWorld: height,
    basePlane: {
      id: `${element.id}:base-plane`,
      role: `${element.id}:base:${planeRole}`,
      surface: surfaceDef.id,
      corners: element.worldCorners,
    },
    topPlane: {
      id: `${element.id}:top-plane`,
      role: `${element.id}:top:${planeRole}`,
      surface: surfaceDef.id,
      corners: topCorners,
    },
    supports,
  };
}

// Optional `facing` rotates which physical edge becomes the box-net FRONT (the
// face card with a backrest / working side). The 4 corners are the same rectangle,
// cyclically shifted: spin 0 → front −y, 1 → +x, 2 → +y, 3 → −x. Lets a chair point
// AT a table or a desk face into the room without any geometry change.
const FACING_SPIN = {
  S: 0, '-y': 0, N: 2, '+y': 2, E: 1, '+x': 1, W: 3, '-x': 3,
  s: 0, n: 2, e: 1, w: 3,
};
function rotateCorners(corners, spin) {
  return spin ? corners.map((_, i) => corners[(i + spin) % 4]) : corners;
}

// Directive elements expand into 1..N concrete elements before normalization. A
// `kitchen-run` directive auto-packs the kitchen units edge-to-edge along the walls
// for the given room basis (see kitchen-run.js); the units it emits are pre-baked
// world-space elements that normalizeElement passes straight through. The directive
// element itself carries its options inline (gap, uppers) — or under `.opts`.
function expandSceneElementDirectives(elements, roomBasis) {
  return asArray(elements).flatMap((el) => {
    const kind = el && String(el.type || el.kind || '');
    if (kind === 'kitchen-run') {
      const opts = el.opts && typeof el.opts === 'object' ? el.opts : el;
      return planKitchenRun(roomBasis, opts).elements;
    }
    return [el];
  });
}

// Inverse of surfacePoint: project world corners back onto a surface's (u, v) basis
// and return their bounding band. Works for any planar surface (floor or wall), so a
// pre-baked element keeps a sane uBand/vBand for the SVG glyph walkers.
function surfaceBandFromWorld(surfaceDef, corners) {
  const { origin, uVector, vVector } = surfaceDef;
  const uLen2 = uVector[0] ** 2 + uVector[1] ** 2 + uVector[2] ** 2 || 1;
  const vLen2 = vVector[0] ** 2 + vVector[1] ** 2 + vVector[2] ** 2 || 1;
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const c of corners) {
    const r = [c[0] - origin[0], c[1] - origin[1], c[2] - origin[2]];
    const u = (r[0] * uVector[0] + r[1] * uVector[1] + r[2] * uVector[2]) / uLen2;
    const v = (r[0] * vVector[0] + r[1] * vVector[1] + r[2] * vVector[2]) / vLen2;
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
  }
  return [clamp(u0, 0, 1), clamp(u1, 0, 1), clamp(v0, 0, 1), clamp(v1, 0, 1)];
}

function normalizeElement(source, index, surfaces, presetMap) {
  const type = String(source.type || source.kind || source.role || 'room-element');
  const preset = presetMap[type] || {};
  const surfaceId = String(source.surface || source.plane || preset.surface || 'floor');
  const surfaceDef = surfaces.byId.get(surfaceId) || surfaces.byId.get('floor');

  // Pre-baked element: its footprint is ALREADY in world coordinates (e.g. a kitchen
  // unit packed against a wall by planKitchenRun). There is no anchor/size to resolve —
  // re-deriving from a default anchor would collapse every unit onto the room centre.
  // Take the world corners as-is and let buildHeightManji raise the matching topPlane.
  const baked = source.worldCorners || source.heightManji?.basePlane?.corners;
  if (Array.isArray(baked) && baked.length === 4 && baked.every((c) => Array.isArray(c) && c.length === 3)) {
    const [u0, u1, v0, v1] = surfaceBandFromWorld(surfaceDef, baked);
    const id = String(source.id || `${type}-${index + 1}`);
    const motif = String(source.motif || preset.motif || type);
    const element = {
      index,
      id,
      type,
      surface: surfaceDef.id,
      motif,
      uBand: [u0, u1],
      vBand: [v0, v1],
      areaShare: (u1 - u0) * (v1 - v0),
      worldArea: (u1 - u0) * (v1 - v0) * surfaceDef.area,
      worldCorners: baked,
      anchor: [(u0 + u1) * 0.5, (v0 + v1) * 0.5],
      zBias: finiteOr(Number(source.zBias), 0),
      tabletop: source.tabletop,
      provenance: { kind: 'roomSceneElement', id, type, surface: surfaceDef.id, motif, prebaked: true },
    };
    element.heightManji = buildHeightManji(element, surfaceDef, preset, {
      ...source,
      heightWorld: source.heightWorld ?? source.heightManji?.heightWorld ?? preset.height,
    });
    return element;
  }

  const anchor = normalizeAnchor(source.anchor ?? source.center ?? [source.u, source.v]);
  const size = normalizeElementSize(source, preset, surfaceDef);
  const [u0, u1, v0, v1] = bandFromAnchor(anchor, size);
  const areaShare = (u1 - u0) * (v1 - v0);
  const worldArea = areaShare * surfaceDef.area;
  let spin = source.facing != null ? (FACING_SPIN[source.facing] ?? 0) : 0;
  // local library assets model their front as +y but box-net cards as −y; flip the
  // asset 180° so a given `facing` is the SAME physical direction either render path.
  if (source.facing != null && (source.asset || source.assetRef)) spin = (spin + 2) % 4;
  const element = {
    index,
    id: String(source.id || `${type}-${index + 1}`),
    type,
    surface: surfaceDef.id,
    motif: String(source.motif || preset.motif || type),
    uBand: [u0, u1],
    vBand: [v0, v1],
    areaShare,
    worldArea,
    worldCorners: rotateCorners([
      surfacePoint(surfaceDef, u0, v0),
      surfacePoint(surfaceDef, u1, v0),
      surfacePoint(surfaceDef, u1, v1),
      surfacePoint(surfaceDef, u0, v1),
    ], spin),
    anchor: [(u0 + u1) * 0.5, (v0 + v1) * 0.5],
    zBias: finiteOr(Number(source.zBias), 0),
    tabletop: source.tabletop,
    provenance: {
      kind: 'roomSceneElement',
      id: String(source.id || `${type}-${index + 1}`),
      type,
      surface: surfaceDef.id,
      motif: String(source.motif || preset.motif || type),
    },
  };
  element.heightManji = buildHeightManji(element, surfaceDef, preset, source);
  return element;
}

const TABLE_HOST_TYPES = new Set([
  'table', 'dining-table', 'diningTable', 'standing-desk', 'standingDesk',
  'study-table', 'study-desk', 'computer-table', 'computer-desk',
  'l-table', 'l-desk', 'corner-desk',
]);

const TABLETOP_HEIGHTS = {
  'place-setting': 0.18,
  plate: 0.035,
  bowl: 0.13,
  cup: 0.11,
  vase: 0.36,
  napkin: 0.018,
  cutlery: 0.024,
  notebook: 0.035,
  laptop: 0.20,
  keyboard: 0.030,
  'pencil-holder': 0.22,
  mouse: 0.038,
  'desk-setup': 0.24,
  'desktop-tower': 0.48,
  eyeglasses: 0.026,
  sunglasses: 0.026,
  'water-bottle': 0.28,
  'wine-glass': 0.20,
  'paper-stack': 0.05,
  'mail-stack': 0.055,
};

const TABLETOP_RECIPES = {
  dining: {
    reason: 'dining surface: meal service plus drinkware',
    items: [
      { type: 'place-setting', anchor: [0.50, 0.54], size: [0.44, 0.58] },
      { type: 'water-bottle', anchor: [0.22, 0.24], size: [0.10, 0.13] },
      { type: 'wine-glass', anchor: [0.75, 0.25], size: [0.09, 0.12], minDensity: 0.65 },
    ],
  },
  study: {
    reason: 'study surface: active reading and writing tools',
    items: [
      { type: 'notebook', anchor: [0.42, 0.55], size: [0.34, 0.36] },
      { type: 'pencil-holder', anchor: [0.78, 0.30], size: [0.12, 0.16] },
      { type: 'paper-stack', anchor: [0.68, 0.66], size: [0.22, 0.24], minDensity: 0.55 },
      { type: 'eyeglasses', anchor: [0.24, 0.28], size: [0.16, 0.11], minDensity: 0.70 },
    ],
  },
  computer: {
    reason: 'computer surface: workstation inputs and supporting paper',
    items: [
      { type: 'keyboard', anchor: [0.46, 0.66], size: [0.34, 0.17] },
      { type: 'mouse', anchor: [0.72, 0.66], size: [0.12, 0.12] },
      { type: 'paper-stack', anchor: [0.22, 0.34], size: [0.22, 0.24] },
      { type: 'water-bottle', anchor: [0.84, 0.30], size: [0.09, 0.13], minDensity: 0.55 },
    ],
  },
  standing: {
    reason: 'standing desk surface: sparse active workstation setup',
    items: [
      { type: 'laptop', anchor: [0.45, 0.44], size: [0.38, 0.38] },
      { type: 'mouse', anchor: [0.72, 0.58], size: [0.11, 0.12] },
      { type: 'water-bottle', anchor: [0.84, 0.28], size: [0.08, 0.12], minDensity: 0.60 },
    ],
  },
  side: {
    reason: 'side table surface: decorative object with one casual-use item',
    items: [
      { type: 'vase', anchor: [0.48, 0.42], size: [0.18, 0.24] },
      { type: 'mail-stack', anchor: [0.66, 0.66], size: [0.26, 0.20], minDensity: 0.55 },
      { type: 'cup', anchor: [0.30, 0.66], size: [0.11, 0.14], minDensity: 0.70 },
    ],
  },
};

function tabletopKind(element, opts = {}) {
  const explicit = typeof element.tabletop === 'string' ? element.tabletop
    : element.tabletop && typeof element.tabletop === 'object' ? element.tabletop.kind || element.tabletop.reason
      : null;
  if (explicit && TABLETOP_RECIPES[explicit]) return explicit;
  const t = String(element.type || '').toLowerCase();
  const room = String(opts.roomKind || opts.room || opts.context || '').toLowerCase();
  if (t.includes('dining') || room.includes('dining')) return 'dining';
  if (t.includes('computer')) return 'computer';
  if (t.includes('standing')) return 'standing';
  if (t.includes('study') || t.includes('desk') || room.includes('study') || room.includes('office') || room.includes('classroom')) return 'study';
  return 'side';
}

function childTabletopCorners(topCorners, anchor, size) {
  const [u, v] = anchor;
  const [sw, sh] = size;
  const band = bandFromAnchor([u, v], { w: sw, h: sh });
  const [u0, u1, v0, v1] = band;
  return [
    bilerp(topCorners, u0, v0),
    bilerp(topCorners, u1, v0),
    bilerp(topCorners, u1, v1),
    bilerp(topCorners, u0, v1),
  ];
}

function densityValue(value) {
  if (value === 'none' || value === false) return 0;
  if (value === 'low') return 0.38;
  if (value === 'high') return 0.88;
  if (Number.isFinite(Number(value))) return clamp(Number(value), 0, 1);
  return 0.62;
}

function tableSurfaceEligible(element) {
  if (element.tabletop === false) return false;
  const manji = element.heightManji;
  if (!manji || element.surface !== 'floor' || manji.heightWorld <= 0) return false;
  if (manji.planeRole !== 'table-plane') return false;
  return TABLE_HOST_TYPES.has(element.type) || String(element.type || '').toLowerCase().includes('table') || String(element.type || '').toLowerCase().includes('desk');
}

export function planTabletopSurfaceElements(planOrInput, options = {}) {
  const plan = planOrInput?.kind === 'roomSceneElements'
    ? planOrInput
    : resolveRoomSceneElementPlan(planOrInput, options.roomBasis || planOrInput?.roomBasis || {});
  const opts = options && typeof options === 'object' ? options : {};
  if (opts.enabled === false || opts.density === 'none') {
    return { kind: 'tabletopSurfacePlan', elements: [], placements: [], diagnostics: { tables: 0, placed: 0, areaShare: 0, reasons: [] } };
  }
  const density = densityValue(opts.density ?? opts.amount);
  const budget = clamp(opts.areaBudget ?? (0.10 + density * 0.24), 0.04, 0.42);
  const elements = [];
  const placements = [];
  for (const table of plan.elements.filter(tableSurfaceEligible)) {
    const kind = tabletopKind(table, opts);
    const recipe = TABLETOP_RECIPES[kind] || TABLETOP_RECIPES.side;
    let used = 0;
    for (const item of recipe.items) {
      if (density < (item.minDensity ?? 0)) continue;
      const area = item.size[0] * item.size[1];
      if (used + area > budget) continue;
      used += area;
      const id = `${table.id}:${item.type}:${placements.length + 1}`;
      const child = {
        index: plan.elements.length + elements.length,
        id,
        type: item.type,
        asset: item.type,
        surface: 'tabletop',
        motif: item.type,
        zBias: 1,
        anchor: [item.anchor[0], item.anchor[1]],
        uBand: [item.anchor[0] - item.size[0] / 2, item.anchor[0] + item.size[0] / 2],
        vBand: [item.anchor[1] - item.size[1] / 2, item.anchor[1] + item.size[1] / 2],
        areaShare: Number(area.toFixed(4)),
        worldArea: table.worldArea * area,
        parentId: table.id,
        tabletopReason: recipe.reason,
        tabletopKind: kind,
        provenance: { kind: 'tabletopSurfaceElement', parentId: table.id, reason: recipe.reason },
      };
      const baseCorners = childTabletopCorners(table.heightManji.topPlane.corners, item.anchor, item.size);
      child.worldCorners = baseCorners;
      child.heightManji = {
        kind: 'heightManji',
        id: `${id}:height-manji`,
        elementId: id,
        planeRole: 'tabletop-prop',
        supportPattern: 'none',
        heightWorld: item.height ?? TABLETOP_HEIGHTS[item.type] ?? 0.08,
        basePlane: { id: `${id}:base-plane`, role: `${id}:base:tabletop-prop`, surface: 'tabletop', corners: baseCorners },
        topPlane: { id: `${id}:top-plane`, role: `${id}:top:tabletop-prop`, surface: 'tabletop', corners: baseCorners.map((corner) => offsetZ(corner, item.height ?? TABLETOP_HEIGHTS[item.type] ?? 0.08)) },
        supports: [],
      };
      elements.push(child);
      placements.push({ parentId: table.id, childId: id, type: item.type, reason: recipe.reason, areaShare: child.areaShare });
    }
  }
  const reasons = [...new Set(placements.map((placement) => placement.reason))];
  return {
    kind: 'tabletopSurfacePlan',
    elements,
    placements,
    diagnostics: {
      tables: plan.elements.filter(tableSurfaceEligible).length,
      placed: elements.length,
      areaShare: Number(placements.reduce((sum, placement) => sum + placement.areaShare, 0).toFixed(4)),
      reasons,
    },
  };
}

export function resolveRoomSceneElementPlan(input = {}, roomBasis = input.roomBasis || {}) {
  const surfaces = resolveRoomSurfaces(roomBasis);
  const presetMap = {
    ...DEFAULT_PRESETS,
    ...(input.presets && typeof input.presets === 'object' ? input.presets : {}),
  };
  const elements = expandSceneElementDirectives(asArray(input.elements), roomBasis).map((element, index) => (
    normalizeElement(element, index, surfaces, presetMap)
  ));
  const tabletopPlan = planTabletopSurfaceElements({ kind: 'roomSceneElements', elements }, input.tabletop && typeof input.tabletop === 'object' ? input.tabletop : { enabled: input.tabletop !== false });
  return {
    kind: 'roomSceneElements',
    role: input.role || 'room-scene-elements',
    roomBasis,
    surfaces: surfaces.list,
    elements,
    tabletopPlan,
    diagnostics: roomSceneElementDiagnostics({ elements, tabletopPlan }),
    source: input,
  };
}

/**
 * Render-facing element list: the authored elements followed by the tabletop
 * props the placement planner anchored onto eligible table surfaces. The 3D
 * room renderer (scene-css3d) iterates this so tabletop placements actually
 * reach the scene. The SVG walkers below stay on `plan.elements` alone, so the
 * two-point projection path is unaffected.
 */
export function roomSceneRenderElements(planOrInput, options = {}) {
  const plan = planOrInput?.kind === 'roomSceneElements'
    ? planOrInput
    : resolveRoomSceneElementPlan(planOrInput, options.roomBasis || planOrInput?.roomBasis || {});
  const tabletop = plan.tabletopPlan && Array.isArray(plan.tabletopPlan.elements) ? plan.tabletopPlan.elements : [];
  return tabletop.length ? [...plan.elements, ...tabletop] : plan.elements;
}

export function walkRoomSceneElements(planOrInput, options = {}) {
  const plan = planOrInput?.kind === 'roomSceneElements'
    ? planOrInput
    : resolveRoomSceneElementPlan(planOrInput, options.roomBasis || planOrInput?.roomBasis || {});
  return [...plan.elements].sort((a, b) => {
    if (a.surface !== b.surface) return a.surface.localeCompare(b.surface);
    if (a.zBias !== b.zBias) return a.zBias - b.zBias;
    return a.index - b.index;
  });
}

export function projectRoomSceneElements(planOrInput, cameraPrimitive = {}, roomBasis = null) {
  const plan = planOrInput?.kind === 'roomSceneElements'
    ? planOrInput
    : resolveRoomSceneElementPlan(planOrInput, roomBasis || planOrInput?.roomBasis || {});
  const basis = roomBasis || plan.roomBasis || {};
  return walkRoomSceneElements(plan).map((element) => {
    const projectedCorners = element.worldCorners.map((corner) => {
      const [x, y, depthT, verticalScale] = projectTwoPoint(corner, cameraPrimitive, basis);
      return { x, y, depthT, verticalScale };
    });
    const depth = projectedCorners.reduce((sum, point) => sum + point.depthT, 0) / Math.max(1, projectedCorners.length);
    return { ...element, projectedCorners, depth };
  });
}

export function projectRoomHeightManjis(planOrInput, cameraPrimitive = {}, roomBasis = null) {
  const plan = planOrInput?.kind === 'roomSceneElements'
    ? planOrInput
    : resolveRoomSceneElementPlan(planOrInput, roomBasis || planOrInput?.roomBasis || {});
  const basis = roomBasis || plan.roomBasis || {};
  return walkRoomSceneElements(plan).map((element) => {
    const manji = element.heightManji;
    const project = (point) => {
      const [x, y, depthT, verticalScale] = projectTwoPoint(point, cameraPrimitive, basis);
      return { x, y, depthT, verticalScale };
    };
    const projectedBasePlane = manji.basePlane.corners.map(project);
    const projectedTopPlane = manji.topPlane.corners.map(project);
    const projectedSupports = manji.supports.map((support) => ({
      ...support,
      projectedBottom: project(support.bottom),
      projectedTop: project(support.top),
    }));
    const depthPoints = [...projectedBasePlane, ...projectedTopPlane];
    const depth = depthPoints.reduce((sum, point) => sum + point.depthT, 0) / Math.max(1, depthPoints.length);
    return {
      ...manji,
      element,
      projectedBasePlane,
      projectedTopPlane,
      projectedSupports,
      depth,
    };
  });
}

export function roomSceneElementDiagnostics(planOrCells) {
  const elements = Array.isArray(planOrCells)
    ? planOrCells
    : asArray(planOrCells?.elements);
  const tabletopPlan = !Array.isArray(planOrCells) && planOrCells?.tabletopPlan ? planOrCells.tabletopPlan : null;
  const bySurface = {};
  for (const element of elements) {
    bySurface[element.surface] = bySurface[element.surface] || { count: 0, areaShare: 0, worldArea: 0 };
    bySurface[element.surface].count += 1;
    bySurface[element.surface].areaShare += element.areaShare;
    bySurface[element.surface].worldArea += element.worldArea;
  }
  return {
    elementsPlanned: elements.length,
    surfaceBudgets: Object.fromEntries(Object.entries(bySurface).map(([key, value]) => [key, {
      count: value.count,
      areaShare: Number(value.areaShare.toFixed(4)),
      worldArea: Number(value.worldArea.toFixed(4)),
    }])),
    warnings: Object.entries(bySurface)
      .filter(([, value]) => value.areaShare > 1)
      .map(([key]) => `${key} surface area budget exceeds 1.0`),
    ...(tabletopPlan ? { tabletop: tabletopPlan.diagnostics } : {}),
  };
}

export const ROOM_SCENE_ELEMENT_PRESETS = { ...DEFAULT_PRESETS };
