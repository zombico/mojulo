/**
 * Room legged things - deterministic chair/table families.
 *
 * Consumes room-scene heightManji data and expands it into named support
 * planes, elevation supports, and blobPla-style joinery adapters. The output
 * is renderer-neutral: SVG spikes can draw it, and later renderers can lower
 * the same parts into solids, cylinders, or blobPla marks.
 */

import { projectTwoPoint } from './pure-mandala.js';

const VARIANTS = {
  table: {
    'four-leg': { supportPattern: 'four-corner', supportKind: 'cylinder', apron: true, shelf: false },
    pedestal: { supportPattern: 'center', supportKind: 'cylinder', apron: false, foot: true },
    trestle: { supportPattern: 'two-side', supportKind: 'block', apron: true, shelf: false },
    'shelf-table': { supportPattern: 'four-corner', supportKind: 'cylinder', apron: true, shelf: true },
  },
  chair: {
    stool: { supportPattern: 'four-corner', supportKind: 'cylinder', back: false, arms: false },
    'side-chair': { supportPattern: 'four-corner', supportKind: 'cylinder', back: true, arms: false },
    armchair: { supportPattern: 'block-corners', supportKind: 'block', back: true, arms: true },
    bench: { supportPattern: 'two-side', supportKind: 'block', back: false, arms: false },
  },
};

function clamp(value, min, max) {
  const n = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
}

function addZ(point, z) {
  return [point[0], point[1], point[2] + z];
}

function lerp3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function plane(id, role, corners, partKind = 'plane', orientation = 'horizontal') {
  return { id, role, kind: partKind, orientation, corners };
}

function supportPatternPoints(pattern) {
  switch (pattern) {
    case 'center':
      return [[0.5, 0.5]];
    case 'two-side':
      return [[0.2, 0.5], [0.8, 0.5]];
    case 'block-corners':
    case 'four-corner':
    default:
      return [[0.14, 0.14], [0.86, 0.14], [0.86, 0.86], [0.14, 0.86]];
  }
}

function bilerp(corners, u, v) {
  const [a, b, c, d] = corners;
  return [
    a[0] * (1 - u) * (1 - v) + b[0] * u * (1 - v) + c[0] * u * v + d[0] * (1 - u) * v,
    a[1] * (1 - u) * (1 - v) + b[1] * u * (1 - v) + c[1] * u * v + d[1] * (1 - u) * v,
    a[2] * (1 - u) * (1 - v) + b[2] * u * (1 - v) + c[2] * u * v + d[2] * (1 - u) * v,
  ];
}

function variantFor(type, variant) {
  const family = VARIANTS[type] || VARIANTS.table;
  return family[variant] ? variant : Object.keys(family)[0];
}

function elementHeightManji(elementOrManji) {
  if (elementOrManji?.kind === 'heightManji') return elementOrManji;
  return elementOrManji?.heightManji || null;
}

function elementType(elementOrManji) {
  return elementOrManji?.type || elementOrManji?.element?.type || 'table';
}

function elementId(elementOrManji) {
  return elementOrManji?.id || elementOrManji?.elementId || 'legged-thing';
}

function remapSupports(heightManji, spec, thingId) {
  const base = heightManji.basePlane.corners;
  const height = Math.max(0, heightManji.heightWorld || 0);
  return supportPatternPoints(spec.supportPattern).map(([u, v], index) => {
    const bottom = bilerp(base, u, v);
    const top = addZ(bottom, height);
    return {
      id: `${thingId}-leg-${index + 1}`,
      role: `${thingId}:${spec.supportKind}:leg-${index + 1}`,
      kind: spec.supportKind,
      u,
      v,
      radius: spec.supportKind === 'block' ? 0.08 : 0.045,
      bottom,
      top,
    };
  });
}

function tableParts(thingId, heightManji, spec) {
  const top = plane(`${thingId}:tabletop`, `${thingId}:top:table-plane`, heightManji.topPlane.corners, 'top-plane', 'horizontal');
  const parts = [top];
  if (spec.apron) {
    const drop = Math.min(0.18, heightManji.heightWorld * 0.24);
    parts.push(plane(
      `${thingId}:front-apron`,
      `${thingId}:front-apron:vertical-plane`,
      [top.corners[0], top.corners[1], addZ(top.corners[1], -drop), addZ(top.corners[0], -drop)],
      'apron-plane',
      'vertical',
    ));
    parts.push(plane(
      `${thingId}:back-apron`,
      `${thingId}:back-apron:vertical-plane`,
      [top.corners[3], top.corners[2], addZ(top.corners[2], -drop), addZ(top.corners[3], -drop)],
      'apron-plane',
      'vertical',
    ));
  }
  if (spec.supportPattern === 'two-side') {
    const leftTopA = bilerp(top.corners, 0.2, 0.18);
    const leftTopB = bilerp(top.corners, 0.2, 0.82);
    const rightTopA = bilerp(top.corners, 0.8, 0.18);
    const rightTopB = bilerp(top.corners, 0.8, 0.82);
    parts.push(plane(
      `${thingId}:left-trestle-plane`,
      `${thingId}:left-trestle:vertical-plane`,
      [leftTopA, leftTopB, addZ(leftTopB, -heightManji.heightWorld), addZ(leftTopA, -heightManji.heightWorld)],
      'trestle-plane',
      'vertical',
    ));
    parts.push(plane(
      `${thingId}:right-trestle-plane`,
      `${thingId}:right-trestle:vertical-plane`,
      [rightTopA, rightTopB, addZ(rightTopB, -heightManji.heightWorld), addZ(rightTopA, -heightManji.heightWorld)],
      'trestle-plane',
      'vertical',
    ));
  }
  if (spec.shelf) {
    parts.push(plane(
      `${thingId}:under-shelf`,
      `${thingId}:under-shelf:table-plane`,
      heightManji.basePlane.corners.map((corner) => addZ(corner, heightManji.heightWorld * 0.42)),
      'shelf-plane',
      'horizontal',
    ));
  }
  if (spec.foot) {
    const center = bilerp(heightManji.basePlane.corners, 0.5, 0.5);
    const footRadius = 0.18;
    parts.push({
      id: `${thingId}:pedestal-foot`,
      role: `${thingId}:pedestal-foot`,
      kind: 'round-foot',
      orientation: 'round',
      center,
      radius: footRadius,
    });
  }
  return parts;
}

function chairParts(thingId, heightManji, spec) {
  const seat = plane(`${thingId}:seat`, `${thingId}:top:seat-plane`, heightManji.topPlane.corners, 'seat-plane', 'horizontal');
  const parts = [seat];
  const top = heightManji.topPlane.corners;
  if (spec.back) {
    parts.push(plane(
      `${thingId}:back`,
      `${thingId}:back:shelf-plane`,
      [top[3], top[2], addZ(top[2], 0.92), addZ(top[3], 0.92)],
      'back-plane',
      'vertical',
    ));
  }
  if (spec.arms) {
    parts.push(plane(
      `${thingId}:left-arm`,
      `${thingId}:left-arm:shelf-plane`,
      [top[0], top[3], addZ(top[3], 0.28), addZ(top[0], 0.28)],
      'arm-plane',
      'vertical',
    ));
    parts.push(plane(
      `${thingId}:right-arm`,
      `${thingId}:right-arm:shelf-plane`,
      [top[1], top[2], addZ(top[2], 0.28), addZ(top[1], 0.28)],
      'arm-plane',
      'vertical',
    ));
  }
  return parts;
}

function blobPlaAdapters(thingId, supports, topRole) {
  return supports.map((support) => ({
    kind: 'blobPla',
    id: `${support.id}:blobpla`,
    role: `${support.id}:quiet-joinery`,
    sourceRole: support.role,
    receiverRole: topRole,
    sourcePoint: support.top,
    receiverPoint: support.top,
    stem: { enabled: true, radius: support.radius },
    socket: { center: support.top, radius: support.radius * 1.8 },
    joint: { center: support.top, radius: support.radius * 1.25 },
    blobPlaAdapter: true,
  }));
}

export function resolveLeggedThing(elementOrManji, options = {}) {
  const heightManji = elementHeightManji(elementOrManji);
  if (!heightManji) throw new Error('resolveLeggedThing requires an element with heightManji or a heightManji');
  const type = options.type || elementType(elementOrManji);
  const family = type === 'chair' ? 'chair' : 'table';
  const variant = variantFor(family, options.variant || elementOrManji.variant);
  const spec = VARIANTS[family][variant];
  const id = options.id || elementId(elementOrManji);
  const supports = remapSupports(heightManji, spec, id);
  const parts = family === 'chair'
    ? chairParts(id, heightManji, spec)
    : tableParts(id, heightManji, spec);
  const topRole = parts[0].role;
  return {
    kind: 'roomLeggedThing',
    id,
    family,
    variant,
    heightManjiId: heightManji.id,
    parts,
    supports,
    adapters: blobPlaAdapters(id, supports, topRole),
    diagnostics: {
      partCount: parts.length,
      supportCount: supports.length,
      adapterCount: supports.length,
    },
  };
}

export function resolveLeggedThingLibrary(entries = []) {
  return entries.map((entry, index) => resolveLeggedThing(entry.element, {
    id: entry.id || `${entry.type || 'thing'}-${index + 1}`,
    type: entry.type,
    variant: entry.variant,
  }));
}

export function projectLeggedThing(thing, cameraPrimitive = {}, roomBasis = {}) {
  const project = (point) => {
    const [x, y, depthT, verticalScale] = projectTwoPoint(point, cameraPrimitive, roomBasis);
    return { x, y, depthT, verticalScale };
  };
  const projectedParts = thing.parts.map((part) => {
    if (part.corners) {
      const projected = part.corners.map(project);
      const depth = projected.reduce((sum, point) => sum + point.depthT, 0) / projected.length;
      return { ...part, projected, depth };
    }
    const projectedCenter = project(part.center);
    return { ...part, projectedCenter, depth: projectedCenter.depthT };
  });
  const projectedSupports = thing.supports.map((support) => ({
    ...support,
    projectedBottom: project(support.bottom),
    projectedTop: project(support.top),
  }));
  return {
    ...thing,
    projectedParts,
    projectedSupports,
    depth: projectedParts.reduce((sum, part) => sum + part.depth, 0) / Math.max(1, projectedParts.length),
  };
}

export const ROOM_LEGGED_THING_VARIANTS = JSON.parse(JSON.stringify(VARIANTS));
