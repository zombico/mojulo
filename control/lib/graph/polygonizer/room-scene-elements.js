/**
 * Room scene elements - normalized surface budgets for interior perspective.
 *
 * A model can author "window on back wall" or "rug on floor" in mandala-space
 * percentages. This planner resolves those requests into stable room-surface
 * bands, world-space quads, and optional pixel projection through the shared
 * two-point camera.
 */

import { projectTwoPoint } from './pure-mandala.js';

const DEFAULT_PRESETS = {
  rug: { surface: 'floor', aspect: 1.55, areaShare: 0.18, motif: 'woven-rug', height: 0.02, supportPattern: 'none', planeRole: 'floor-skin' },
  runner: { surface: 'floor', aspect: 3.2, areaShare: 0.12, motif: 'floor-runner', height: 0.02, supportPattern: 'none', planeRole: 'floor-skin' },
  table: { surface: 'floor', aspect: 1.25, areaShare: 0.055, motif: 'low-table', height: 0.76, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'table-plane' },
  'standing-desk': { surface: 'floor', aspect: 1.9, areaShare: 0.065, motif: 'standing-desk', height: 1.18, supportPattern: 'two-side', supportKind: 'block', planeRole: 'table-plane' },
  standingDesk: { surface: 'floor', aspect: 1.9, areaShare: 0.065, motif: 'standing-desk', height: 1.18, supportPattern: 'two-side', supportKind: 'block', planeRole: 'table-plane' },
  bed: { surface: 'floor', aspect: 1.45, areaShare: 0.16, motif: 'bed-block', height: 0.55, supportPattern: 'block-corners', supportKind: 'block', planeRole: 'table-plane' },
  sofa: { surface: 'floor', aspect: 2.4, areaShare: 0.09, motif: 'sofa-block', height: 0.48, supportPattern: 'block-corners', supportKind: 'block', planeRole: 'table-plane' },
  bench: { surface: 'floor', aspect: 2.6, areaShare: 0.045, motif: 'bench-plank', height: 0.48, supportPattern: 'two-side', supportKind: 'block', planeRole: 'seat-plane' },
  stool: { surface: 'floor', aspect: 1.0, areaShare: 0.022, motif: 'stool-seat', height: 0.55, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'seat-plane' },
  chair: { surface: 'floor', aspect: 0.9, areaShare: 0.028, motif: 'chair-block', height: 0.46, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'seat-plane' },
  'computer-chair': { surface: 'floor', aspect: 0.95, areaShare: 0.03, motif: 'computer-chair', height: 0.72, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'seat-plane' },
  computerChair: { surface: 'floor', aspect: 0.95, areaShare: 0.03, motif: 'computer-chair', height: 0.72, supportPattern: 'four-corner', supportKind: 'cylinder', planeRole: 'seat-plane' },
  armchair: { surface: 'floor', aspect: 1.05, areaShare: 0.04, motif: 'armchair-block', height: 0.58, supportPattern: 'block-corners', supportKind: 'block', planeRole: 'seat-plane' },
  cabinet: { surface: 'floor', aspect: 1.8, areaShare: 0.08, motif: 'cabinet-face', height: 1.1, supportPattern: 'none', planeRole: 'storage-plane' },
  bar: { surface: 'floor', aspect: 3.0, areaShare: 0.1, motif: 'bar-counter', height: 1.12, supportPattern: 'none', planeRole: 'storage-plane' },
  bookshelf: { surface: 'floor', aspect: 0.78, areaShare: 0.09, motif: 'bookcase-grid', height: 1.8, supportPattern: 'none', planeRole: 'storage-plane' },
  'rack-shelf': { surface: 'floor', aspect: 1.35, areaShare: 0.075, motif: 'rack-shelf-repeat', height: 1.6, supportPattern: 'none', planeRole: 'storage-plane' },
  rackShelf: { surface: 'floor', aspect: 1.35, areaShare: 0.075, motif: 'rack-shelf-repeat', height: 1.6, supportPattern: 'none', planeRole: 'storage-plane' },
  rackShelves: { surface: 'floor', aspect: 1.35, areaShare: 0.075, motif: 'rack-shelf-repeat', height: 1.6, supportPattern: 'none', planeRole: 'storage-plane' },
  dresser: { surface: 'floor', aspect: 1.45, areaShare: 0.065, motif: 'drawer-stack', height: 0.9, supportPattern: 'none', planeRole: 'storage-plane' },
  nightstand: { surface: 'floor', aspect: 0.95, areaShare: 0.025, motif: 'small-drawer', height: 0.62, supportPattern: 'none', planeRole: 'storage-plane' },
  sideboard: { surface: 'floor', aspect: 2.4, areaShare: 0.075, motif: 'sideboard-doors', height: 0.9, supportPattern: 'none', planeRole: 'storage-plane' },
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

function normalizeElement(source, index, surfaces, presetMap) {
  const type = String(source.type || source.kind || source.role || 'room-element');
  const preset = presetMap[type] || {};
  const surfaceId = String(source.surface || source.plane || preset.surface || 'floor');
  const surfaceDef = surfaces.byId.get(surfaceId) || surfaces.byId.get('floor');
  const anchor = normalizeAnchor(source.anchor ?? source.center ?? [source.u, source.v]);
  const size = normalizeElementSize(source, preset, surfaceDef);
  const [u0, u1, v0, v1] = bandFromAnchor(anchor, size);
  const areaShare = (u1 - u0) * (v1 - v0);
  const worldArea = areaShare * surfaceDef.area;
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
    worldCorners: [
      surfacePoint(surfaceDef, u0, v0),
      surfacePoint(surfaceDef, u1, v0),
      surfacePoint(surfaceDef, u1, v1),
      surfacePoint(surfaceDef, u0, v1),
    ],
    anchor: [(u0 + u1) * 0.5, (v0 + v1) * 0.5],
    zBias: finiteOr(Number(source.zBias), 0),
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

export function resolveRoomSceneElementPlan(input = {}, roomBasis = input.roomBasis || {}) {
  const surfaces = resolveRoomSurfaces(roomBasis);
  const presetMap = {
    ...DEFAULT_PRESETS,
    ...(input.presets && typeof input.presets === 'object' ? input.presets : {}),
  };
  const elements = asArray(input.elements).map((element, index) => (
    normalizeElement(element, index, surfaces, presetMap)
  ));
  return {
    kind: 'roomSceneElements',
    role: input.role || 'room-scene-elements',
    roomBasis,
    surfaces: surfaces.list,
    elements,
    diagnostics: roomSceneElementDiagnostics({ elements }),
    source: input,
  };
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
  };
}

export const ROOM_SCENE_ELEMENT_PRESETS = { ...DEFAULT_PRESETS };
