// CCA = Cardinal Construction Axes. Each major element's local coordinate
// authority: a cardinal-named frame (lengthAxis 'E-W', heightAxis
// 'Zenith-Nadir', depthAxis toward the vanishing point) centered on the
// element, used to solve its block — anchors, bounds, cuboid hit points,
// child regions — before any visible skin is accepted. The constellation
// grid ('cca-constellation-grid') holds one CCA node per element so children
// attach to parent-local axes instead of guessing in screen space.

import { resolveMeruUnitScale } from './pure-mandala.js';

const DEPTH_ORDER = {
  background: 10,
  midground: 30,
  foreground: 50,
};

const CHILD_ROLE_RULES = [
  { pattern: /roof|cap|top/, region: 'upper-attachment' },
  { pattern: /door|entry|gate/, region: 'lower-front' },
  { pattern: /window|facade|panel|band/, region: 'facade-band' },
  { pattern: /rail|post|picket|suspender|book|shelf/, region: 'contained-detail' },
];

export function withConstellationGrid(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return manifest;
  if (manifest.polygonizer?.constellation) {
    return withResolvedChildRegionsWorld(withNormalizedConstellationGrid(manifest));
  }
  const constellation = buildConstellationGrid(manifest);
  if (!constellation) return manifest;
  return withResolvedChildRegionsWorld({
    ...manifest,
    polygonizer: {
      ...(manifest.polygonizer || {}),
      constellation,
    },
  });
}

/**
 * Resolve any constellation node carrying `childRegionWorld` into a pixel
 * `childRegion` via the meru-owned unitScale. This closes the loop for
 * parents that want to carve out child sub-mandala space in shared world
 * units instead of pixel arithmetic.
 *
 * The world declaration shape:
 *
 *   childRegionWorld: {
 *     width:   number,     // world-unit width
 *     length:  number,     // world-unit length
 *     offsetX: number?,    // optional center offset from the node's bounds center, in world units
 *     offsetY: number?,    // optional center offset, in world units
 *   }
 *
 * The world declaration wins when both `childRegionWorld` and a legacy
 * pixel `childRegion` are present on the same node — that's the
 * substrate's "shared ruler wins over hand-tuned pixel" rule. The
 * pre-existing pixel childRegion is preserved on the node as
 * `childRegionPixelDeclared` for audit.
 */
export function withResolvedChildRegionsWorld(manifest) {
  const constellation = manifest?.polygonizer?.constellation;
  const nodes = Array.isArray(constellation?.nodes) ? constellation.nodes : [];
  if (!nodes.length) return manifest;
  const unitScale = resolveMeruUnitScale(manifest);
  let changed = false;
  const resolved = nodes.map((node) => {
    const world = node?.childRegionWorld;
    if (!world || typeof world !== 'object' || Array.isArray(world)) return node;
    const width = Number(world.width);
    const length = Number(world.length);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(length) || length <= 0) return node;
    if (!validBounds(node.bounds)) return node;
    const offsetX = Number.isFinite(Number(world.offsetX)) ? Number(world.offsetX) : 0;
    const offsetY = Number.isFinite(Number(world.offsetY)) ? Number(world.offsetY) : 0;
    const pixelWidth = width * unitScale;
    const pixelHeight = length * unitScale;
    const centerX = node.bounds.x + node.bounds.width / 2 + offsetX * unitScale;
    const centerY = node.bounds.y + node.bounds.height / 2 + offsetY * unitScale;
    const childRegion = roundBounds({
      x: centerX - pixelWidth / 2,
      y: centerY - pixelHeight / 2,
      width: pixelWidth,
      height: pixelHeight,
    });
    changed = true;
    const next = {
      ...node,
      childRegion,
      childRegionSource: 'meru-world',
    };
    if (node.childRegion && !node.childRegionPixelDeclared) {
      next.childRegionPixelDeclared = node.childRegion;
    }
    return next;
  });
  if (!changed) return manifest;
  return {
    ...manifest,
    polygonizer: {
      ...manifest.polygonizer,
      constellation: {
        ...constellation,
        nodes: resolved,
      },
    },
  };
}

export function buildConstellationGrid(manifest) {
  const polygonizer = manifest?.polygonizer;
  const elements = Array.isArray(polygonizer?.elements) ? polygonizer.elements : [];
  if (!polygonizer || elements.length === 0) return null;

  const viewBox = manifest.viewBox || {};
  const width = finiteOr(viewBox.width, 800);
  const height = finiteOr(viewBox.height, 520);
  const impactPoint = validPoint(polygonizer.impactPoint) || [width / 2, height * 0.58];
  const draftingTable = polygonizer.draftingTable || {};
  const vanishingPoint = validPoint(draftingTable.vanishingPoint) ||
    validPoint(manifest.scene?.perspective?.vanishingPoint) ||
    [width / 2, finiteOr(draftingTable.horizonY, height * 0.38)];
  const depthBands = normalizeDepthBands(draftingTable.depthBands, height);
  const relationships = inferRelationships(elements, polygonizer.blockingReality);
  const layout = normalizeRelativeGridLayout(
    polygonizer.constellation?.layout || polygonizer.placementGrid,
    width,
    height,
  );
  const nodes = [];
  const nodeByRole = new Map();

  elements.forEach((element, index) => {
    const role = String(element?.role || `element-${index + 1}`);
    const parent = relationships.get(role) || null;
    const parentNode = parent ? nodeByRole.get(parent) : null;
    const node = layout && element?.cell
      ? gridCellNode({ element, index, role, layout, depthBands, vanishingPoint, parent })
      : parentNode
      ? childNode({ element, index, parentNode, role, width, height, vanishingPoint })
      : rootNode({ element, index, role, width, height, impactPoint, depthBands, vanishingPoint });
    nodes.push(node);
    nodeByRole.set(role, node);
  });

  return {
    kind: 'cca-constellation-grid',
    generated: true,
    source: 'deterministic',
    axisMundi: buildAxisMundi(impactPoint, width, height),
    horizonY: finiteOr(draftingTable.horizonY, manifest.scene?.perspective?.horizonY),
    vanishingPoint: roundPointTuple(vanishingPoint),
    baselineY: finiteOr(draftingTable.baselineY, height * 0.78),
    depthBands,
    ...(layout ? { layout: layout.source } : {}),
    nodes,
  };
}

export function withNormalizedConstellationGrid(manifest) {
  const constellation = manifest?.polygonizer?.constellation;
  if (!constellation || typeof constellation !== 'object' || Array.isArray(constellation)) return manifest;
  const viewBox = manifest.viewBox || {};
  const width = finiteOr(viewBox.width, 800);
  const height = finiteOr(viewBox.height, 520);
  const layout = normalizeRelativeGridLayout(constellation.layout, width, height);
  if (!layout || !Array.isArray(constellation.nodes)) return manifest;

  const depthBands = normalizeDepthBands(
    constellation.depthBands || manifest.polygonizer?.draftingTable?.depthBands,
    height,
  );
  const vanishingPoint = validPoint(constellation.vanishingPoint) ||
    validPoint(manifest.polygonizer?.draftingTable?.vanishingPoint) ||
    validPoint(manifest.scene?.perspective?.vanishingPoint) ||
    [width / 2, height * 0.38];
  let changed = false;
  const nodes = constellation.nodes.map((node, index) => {
    if (!node?.cell) return node;
    const complete = gridCellNode({
      element: node,
      index,
      role: String(node.role || `element-${index + 1}`),
      layout,
      depthBands,
      vanishingPoint,
      parent: node.parent || null,
    });
    changed = true;
    return {
      ...complete,
      ...node,
      bounds: node.bounds && validBounds(node.bounds) ? node.bounds : complete.bounds,
      anchor: validPoint(node.anchor) || complete.anchor,
      cca: {
        ...complete.cca,
        ...(node.cca || {}),
      },
      childRegion: node.childRegion && validBounds(node.childRegion) ? node.childRegion : complete.childRegion,
      renderOrder: Number.isFinite(Number(node.renderOrder)) ? Number(node.renderOrder) : complete.renderOrder,
      depthBand: node.depthBand || complete.depthBand,
      gridCellResolved: true,
    };
  });
  if (!changed) return manifest;

  return {
    ...manifest,
    polygonizer: {
      ...manifest.polygonizer,
      constellation: {
        ...constellation,
        layout: layout.source,
        nodes,
      },
    },
  };
}

export function validateConstellationGrid(manifest) {
  const errors = [];
  const constellation = manifest?.polygonizer?.constellation;
  const elements = Array.isArray(manifest?.polygonizer?.elements) ? manifest.polygonizer.elements : [];
  if (!constellation) return errors;
  if (constellation.kind !== 'cca-constellation-grid') {
    errors.push('polygonizer.constellation.kind must be cca-constellation-grid');
  }
  const nodes = Array.isArray(constellation.nodes) ? constellation.nodes : [];
  const roles = new Set(nodes.map((node) => node?.role).filter(Boolean));
  for (const element of elements) {
    const role = element?.role;
    if (role && !roles.has(role)) {
      errors.push(`polygonizer.constellation missing node for element '${role}'`);
    }
  }
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const label = node.role || '(anonymous)';
    if (!validPoint(node.anchor)) errors.push(`polygonizer.constellation node '${label}' requires finite anchor`);
    if (!validBounds(node.bounds)) errors.push(`polygonizer.constellation node '${label}' requires finite bounds`);
    if (!validAxis(node.cca?.lengthAxis) || !validAxis(node.cca?.heightAxis)) {
      errors.push(`polygonizer.constellation node '${label}' requires CCA axes`);
    }
    if (node.parent && !roles.has(node.parent)) {
      errors.push(`polygonizer.constellation node '${label}' parent '${node.parent}' was not found`);
    }
    if (node.childRegionWorld !== undefined && node.childRegionWorld !== null) {
      const world = node.childRegionWorld;
      if (typeof world !== 'object' || Array.isArray(world)) {
        errors.push(`polygonizer.constellation node '${label}' childRegionWorld must be an object`);
      } else {
        const width = Number(world.width);
        const length = Number(world.length);
        if (!Number.isFinite(width) || width <= 0) {
          errors.push(`polygonizer.constellation node '${label}' childRegionWorld.width must be a positive number (world units)`);
        }
        if (!Number.isFinite(length) || length <= 0) {
          errors.push(`polygonizer.constellation node '${label}' childRegionWorld.length must be a positive number (world units)`);
        }
        if (world.offsetX !== undefined && world.offsetX !== null && !Number.isFinite(Number(world.offsetX))) {
          errors.push(`polygonizer.constellation node '${label}' childRegionWorld.offsetX must be a finite number`);
        }
        if (world.offsetY !== undefined && world.offsetY !== null && !Number.isFinite(Number(world.offsetY))) {
          errors.push(`polygonizer.constellation node '${label}' childRegionWorld.offsetY must be a finite number`);
        }
      }
    }
  }
  const sceneVp = validPoint(manifest?.scene?.perspective?.vanishingPoint);
  const gridVp = validPoint(constellation.vanishingPoint);
  if (sceneVp && gridVp && Math.hypot(sceneVp[0] - gridVp[0], sceneVp[1] - gridVp[1]) > 0.01) {
    errors.push('polygonizer.constellation.vanishingPoint must match scene.perspective.vanishingPoint');
  }
  return errors;
}

export function annotateMarksWithConstellation(marks, constellation) {
  if (!Array.isArray(marks) || !Array.isArray(constellation?.nodes) || constellation.nodes.length === 0) {
    return marks;
  }
  return marks.map((mark) => {
    const node = findNodeForMark(mark, constellation.nodes);
    if (!node) return mark;
    const fit = markFitStatus(mark, node);
    return {
      ...mark,
      constellationRole: node.role,
      constellationParent: node.parent,
      constellationRenderOrder: node.renderOrder,
      constellationBounds: node.bounds,
      constellationFit: fit,
      ...(node.region ? { constellationRegion: node.region } : {}),
    };
  });
}

export function constellationDebugMarks(constellation) {
  if (!constellation?.debugVisible || !Array.isArray(constellation.nodes)) return [];
  const nodes = constellation.nodes;
  const byRole = new Map(nodes.map((node) => [node.role, node]));
  const out = [];
  for (const node of nodes) {
    if (!node || !node.role || !validPoint(node.anchor) || !validBounds(node.bounds)) continue;
    const common = debugCommon(node);
    const center = validPoint(node.cca?.center) || node.anchor;
    const depthSamples = triSectionDepthSamples(node, constellation);
    out.push(
      debugCircle(`${node.role}:anchor-dot`, node.anchor, 4.2, '#bff7ff', 0.78, common),
      debugCircle(`${node.role}:center-pulse`, center, 2.6, '#fff3ce', 0.72, common),
      debugPolyline(`${node.role}:bounds`, boundsPolyline(node.bounds), '#8ee7ff', 0.34, common, { strokeWidth: 1 }),
      debugPolyline(`${node.role}:length-axis`, node.cca?.lengthAxis, '#f1a06b', 0.58, common),
      debugPolyline(`${node.role}:height-axis`, node.cca?.heightAxis, '#9fe2a6', 0.58, common),
      debugPolyline(`${node.role}:depth-axis`, [depthSamples.near, depthSamples.far], '#d6b8ff', 0.56, common),
      debugCircle(`${node.role}:z-near-dot`, depthSamples.near, 3.2, '#fff3ce', 0.72, common, { depthSample: 'near' }),
      debugCircle(`${node.role}:z-center-dot`, depthSamples.center, 2.8, '#d6b8ff', 0.74, common, { depthSample: 'center' }),
      debugCircle(`${node.role}:z-far-dot`, depthSamples.far, 2.4, '#8ee7ff', 0.7, common, { depthSample: 'far' }),
      {
        ...common,
        kind: 'text',
        role: `constellation:${node.role}:label`,
        x: round(node.anchor[0] + 7),
        y: round(node.anchor[1] - 7),
        value: node.role,
        size: 10,
        anchor: 'start',
        color: '#d8f8ff',
        opacity: 0.66,
        z: debugZ(node) + 0.08,
      },
    );
    const parent = node.parent ? byRole.get(node.parent) : null;
    if (parent && validPoint(parent.anchor)) {
      out.push(debugPolyline(`${node.role}:parent-link`, [parent.anchor, node.anchor], '#bff7ff', 0.28, common, {
        dash: '3 5',
        parentRole: parent.role,
      }));
    }
  }
  return out.filter(Boolean);
}

function debugCommon(node) {
  return {
    debugKind: 'constellation-grid',
    constellationDebug: true,
    constellationRole: node.role,
    constellationParent: node.parent,
    constellationRenderOrder: node.renderOrder,
    constellationBounds: node.bounds,
    source: true,
  };
}

function debugCircle(suffix, point, r, fill, opacity, common, extra = {}) {
  if (!validPoint(point)) return null;
  return {
    ...common,
    ...extra,
    kind: 'circle',
    role: `constellation:${suffix}`,
    cx: round(point[0]),
    cy: round(point[1]),
    r,
    fill,
    stroke: '#ffffff',
    strokeWidth: 0.6,
    opacity,
    z: debugZ(common) + 0.1,
  };
}

function debugPolyline(suffix, points, stroke, opacity, common, extra = {}) {
  if (!Array.isArray(points) || points.length < 2 || points.some((point) => !validPoint(point))) return null;
  return {
    ...common,
    ...extra,
    kind: 'polyline',
    role: `constellation:${suffix}`,
    points: points.map(roundPointTuple),
    stroke,
    strokeWidth: extra.strokeWidth ?? 1.35,
    fill: 'none',
    opacity,
    z: debugZ(common),
  };
}

function debugZ(nodeOrCommon) {
  return 900 + finiteOr(nodeOrCommon?.constellationRenderOrder ?? nodeOrCommon?.renderOrder, 0) * 0.01;
}

function boundsPolyline(bounds) {
  return [
    [bounds.x, bounds.y],
    [bounds.x + bounds.width, bounds.y],
    [bounds.x + bounds.width, bounds.y + bounds.height],
    [bounds.x, bounds.y + bounds.height],
    [bounds.x, bounds.y],
  ];
}

function triSectionDepthSamples(node, constellation) {
  const center = validPoint(node.cca?.center) || node.anchor;
  const vp = validPoint(node.cca?.depthAxis?.toward) || validPoint(constellation?.vanishingPoint) || center;
  const toVp = normalize2([vp[0] - center[0], vp[1] - center[1]]);
  const radius = Math.max(Math.min(finiteOr(node.bounds?.width, 40), finiteOr(node.bounds?.height, 40)) * 0.24, 10);
  return {
    near: roundPointTuple([center[0] - toVp[0] * radius, center[1] - toVp[1] * radius]),
    center: roundPointTuple(center),
    far: roundPointTuple([center[0] + toVp[0] * radius, center[1] + toVp[1] * radius]),
  };
}

function normalize2(vector) {
  const x = finiteOr(vector?.[0], 0);
  const y = finiteOr(vector?.[1], 0);
  const length = Math.hypot(x, y);
  if (length <= 1e-9) return [0, -1];
  return [x / length, y / length];
}

function findNodeForMark(mark, nodes) {
  const texts = [
    mark?.role,
    mark?.constructionRole,
    mark?.sourceRole,
    mark?.solidPresetRole,
    mark?.vectorRole,
    mark?.blobRole,
    mark?.volumeRole,
    mark?.elementMandalaRole,
    mark?.mandalaPinRole,
  ].filter(Boolean).map((value) => String(value).toLowerCase());
  if (!texts.length) return null;

  let best = null;
  let bestScore = 0;
  for (const node of nodes) {
    const score = nodeMatchScore(node, texts);
    if (score > bestScore) {
      best = node;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

function nodeMatchScore(node, texts) {
  const role = String(node?.role || '').toLowerCase();
  if (!role) return 0;
  let score = 0;
  for (const text of texts) {
    if (text === role) score = Math.max(score, 100 + role.length);
    if (text.startsWith(`${role}-`) || text.startsWith(`${role}:`)) score = Math.max(score, 90 + role.length);
    if (text.includes(role)) score = Math.max(score, 70 + role.length);
    const terms = roleTerms(role);
    const termHits = terms.filter((term) => text.includes(term)).length;
    if (termHits) score = Math.max(score, termHits * 15 + role.length);
  }
  return score;
}

function markFitStatus(mark, node) {
  const bounds = markBounds(mark);
  if (!bounds || !validBounds(node?.bounds)) return 'unknown';
  if (boundsInside(bounds, node.bounds)) return 'inside';
  if (node.overflow === 'attachment' && boundsIntersects(bounds, node.bounds)) return 'attachment-overflow';
  return 'outside';
}

function markBounds(mark) {
  if (Array.isArray(mark?.points) && mark.points.length > 0) {
    return boundsFromPoints(mark.points);
  }
  const points = [];
  for (const pair of [['x1', 'y1'], ['x2', 'y2']]) {
    if (Number.isFinite(Number(mark?.[pair[0]])) && Number.isFinite(Number(mark?.[pair[1]]))) {
      points.push([Number(mark[pair[0]]), Number(mark[pair[1]])]);
    }
  }
  if (Number.isFinite(Number(mark?.cx)) && Number.isFinite(Number(mark?.cy))) {
    const r = Math.max(finiteOr(mark.r, finiteOr(mark.rx, 0)), finiteOr(mark.ry, 0), 1);
    return { x: mark.cx - r, y: mark.cy - r, width: r * 2, height: r * 2 };
  }
  if (points.length) return boundsFromPoints(points);
  return null;
}

function boundsFromPoints(points) {
  const clean = points.filter((point) => validPoint(point));
  if (!clean.length) return null;
  const xs = clean.map((point) => point[0]);
  const ys = clean.map((point) => point[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function boundsInside(inner, outer) {
  return inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
}

function boundsIntersects(a, b) {
  return a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y;
}

function inferRelationships(elements, blocks) {
  const relationships = new Map();
  const roles = elements.map((element) => String(element?.role || '')).filter(Boolean);
  const rootRole = roles.find((role, index) => isPrimary(elements[index])) || roles[0];
  const blockTextByRelation = new Map();

  if (Array.isArray(blocks)) {
    for (const block of blocks) {
      const relation = block?.attachesTo || block?.contains || block?.repeats;
      if (!relation) continue;
      const terms = roleTerms([block.role, block.footprint, block.purpose].filter(Boolean).join(' '));
      for (const role of roles) {
        if (terms.some((term) => role.toLowerCase().includes(term))) {
          blockTextByRelation.set(role, relation);
        }
      }
    }
  }

  for (const role of roles) {
    if (role === rootRole) continue;
    const explicit = blockTextByRelation.get(role);
    const explicitParent = explicit ? bestRoleMatch(explicit, roles.filter((candidate) => candidate !== role)) : null;
    relationships.set(role, explicitParent || inferParentByRole(role, roles, rootRole));
  }
  return relationships;
}

function rootNode({ element, index, role, width, height, impactPoint, depthBands, vanishingPoint }) {
  const bandName = depthBandName(element?.depthBand);
  const band = depthBands[bandName];
  const share = importanceShare(element?.importance, index);
  const nodeWidth = width * share.width;
  const nodeHeight = height * share.height;
  const anchor = index === 0
    ? impactPoint
    : [
        impactPoint[0] + (index % 2 === 0 ? 1 : -1) * width * 0.16,
        band ? (band[0] + band[1]) / 2 : impactPoint[1] + index * height * 0.04,
      ];
  const bounds = clampBounds({
    x: anchor[0] - nodeWidth / 2,
    y: anchor[1] - nodeHeight / 2,
    width: nodeWidth,
    height: nodeHeight,
  }, width, height);
  return completeNode({
    role,
    parent: null,
    depthBand: bandName,
    anchor,
    bounds,
    renderOrder: DEPTH_ORDER[bandName] + index,
    childRegion: insetBounds(bounds, 0.12, 0.14),
    vanishingPoint,
    importance: element?.importance,
  });
}

function childNode({ element, index, parentNode, role, width, height, vanishingPoint }) {
  const region = childRegionKind(role);
  const parent = parentNode.bounds;
  let bounds;
  let overflow = null;
  if (region === 'upper-attachment') {
    bounds = {
      x: parent.x - parent.width * 0.04,
      y: parent.y - parent.height * 0.22,
      width: parent.width * 1.08,
      height: parent.height * 0.32,
    };
    overflow = 'attachment';
  } else if (region === 'lower-front') {
    bounds = {
      x: parent.x + parent.width * 0.39,
      y: parent.y + parent.height * 0.5,
      width: parent.width * 0.22,
      height: parent.height * 0.46,
    };
  } else if (region === 'facade-band') {
    bounds = {
      x: parent.x + parent.width * 0.14,
      y: parent.y + parent.height * 0.2,
      width: parent.width * 0.72,
      height: parent.height * 0.24,
    };
  } else {
    bounds = {
      x: parent.x + parent.width * 0.16,
      y: parent.y + parent.height * 0.16,
      width: parent.width * 0.68,
      height: parent.height * 0.68,
    };
  }
  bounds = overflow ? clampBounds(bounds, width, height) : containBounds(bounds, parent);
  return completeNode({
    role,
    parent: parentNode.role,
    depthBand: depthBandName(element?.depthBand) || parentNode.depthBand,
    anchor: [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2],
    bounds,
    renderOrder: parentNode.renderOrder + 10 + index,
    childRegion: insetBounds(bounds, 0.12, 0.14),
    vanishingPoint,
    importance: element?.importance,
    overflow,
    region,
  });
}

function completeNode({ role, parent, depthBand, anchor, bounds, renderOrder, childRegion, vanishingPoint, importance, overflow, region }) {
  const roundedBounds = roundBounds(bounds);
  const center = [roundedBounds.x + roundedBounds.width / 2, roundedBounds.y + roundedBounds.height / 2];
  return {
    role,
    renderOrder,
    parent,
    depthBand,
    anchor: roundPointTuple(anchor),
    bounds: roundedBounds,
    cca: {
      center: roundPointTuple(center),
      lengthAxis: [
        [roundedBounds.x, round(center[1])],
        [round(roundedBounds.x + roundedBounds.width), round(center[1])],
      ],
      heightAxis: [
        [round(center[0]), round(roundedBounds.y + roundedBounds.height)],
        [round(center[0]), roundedBounds.y],
      ],
      depthAxis: { toward: roundPointTuple(vanishingPoint) },
    },
    scale: {
      pictureShare: round((roundedBounds.width * roundedBounds.height) / 1000000),
      childBudget: importance && /primary/.test(String(importance)) ? 0.62 : 0.44,
    },
    childRegion: roundBounds(childRegion),
    ...(overflow ? { overflow } : {}),
    ...(region ? { region } : {}),
  };
}

function gridCellNode({ element, index, role, layout, depthBands, vanishingPoint, parent }) {
  const bounds = boundsFromGridCell(element.cell, layout);
  const bandName = depthBandName(element?.depthBand || layoutDepthBand(element.cell, layout, depthBands));
  return completeNode({
    role,
    parent: parent || element.parent || null,
    depthBand: bandName,
    anchor: [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2],
    bounds,
    renderOrder: finiteOr(element.renderOrder, DEPTH_ORDER[bandName] + index),
    childRegion: insetBounds(bounds, 0.12, 0.14),
    vanishingPoint,
    importance: element?.importance,
    region: element.region,
    overflow: element.overflow,
  });
}

function normalizeRelativeGridLayout(layout, width, height) {
  if (!layout || typeof layout !== 'object' || Array.isArray(layout)) return null;
  const kind = String(layout.kind || layout.type || '').toLowerCase();
  if (!['relative-grid', 'placement-grid', 'constellation-relative-grid'].includes(kind)) return null;
  const cols = Math.max(Math.round(finiteOr(layout.cols ?? layout.columns, 12)), 1);
  const rows = Math.max(Math.round(finiteOr(layout.rows, 8)), 1);
  const padX = layout.padX ?? layout.pad ?? 0;
  const padY = layout.padY ?? layout.pad ?? 0;
  const gapX = layout.gapX ?? layout.gap ?? 0;
  const gapY = layout.gapY ?? layout.gap ?? 0;
  const normalized = {
    kind: 'relative-grid',
    cols,
    rows,
    padX: gridSpacing(padX, width),
    padY: gridSpacing(padY, height),
    gapX: gridSpacing(gapX, width),
    gapY: gridSpacing(gapY, height),
    depthBands: layout.depthBands,
  };
  return {
    ...normalized,
    source: {
      ...layout,
      kind: 'relative-grid',
      cols,
      rows,
      padX: round(normalized.padX),
      padY: round(normalized.padY),
      gapX: round(normalized.gapX),
      gapY: round(normalized.gapY),
    },
    width,
    height,
  };
}

function gridSpacing(value, span) {
  const n = Math.max(finiteOr(value, 0), 0);
  return n > 0 && n < 1 ? n * span : n;
}

function boundsFromGridCell(cell, layout) {
  const col = clamp(Math.floor(finiteOr(cell?.col ?? cell?.x, 0)), 0, layout.cols - 1);
  const row = clamp(Math.floor(finiteOr(cell?.row ?? cell?.y, 0)), 0, layout.rows - 1);
  const colSpan = clamp(Math.max(Math.round(finiteOr(cell?.colSpan ?? cell?.w, 1)), 1), 1, layout.cols - col);
  const rowSpan = clamp(Math.max(Math.round(finiteOr(cell?.rowSpan ?? cell?.h, 1)), 1), 1, layout.rows - row);
  const usableWidth = Math.max(layout.width - layout.padX * 2 - layout.gapX * (layout.cols - 1), 1);
  const usableHeight = Math.max(layout.height - layout.padY * 2 - layout.gapY * (layout.rows - 1), 1);
  const cellWidth = usableWidth / layout.cols;
  const cellHeight = usableHeight / layout.rows;
  return {
    x: layout.padX + col * (cellWidth + layout.gapX),
    y: layout.padY + row * (cellHeight + layout.gapY),
    width: cellWidth * colSpan + layout.gapX * (colSpan - 1),
    height: cellHeight * rowSpan + layout.gapY * (rowSpan - 1),
  };
}

function layoutDepthBand(cell, layout, depthBands) {
  const row = Math.floor(finiteOr(cell?.row ?? cell?.y, 0));
  const configured = layout.depthBands && typeof layout.depthBands === 'object' && !Array.isArray(layout.depthBands)
    ? layout.depthBands
    : null;
  if (configured) {
    for (const [name, range] of Object.entries(configured)) {
      if (Array.isArray(range) && row >= finiteOr(range[0], 0) && row < finiteOr(range[1], layout.rows)) {
        return name;
      }
    }
  }
  const centerY = boundsFromGridCell(cell, layout).y + boundsFromGridCell(cell, layout).height / 2;
  for (const [name, range] of Object.entries(depthBands || {})) {
    if (centerY >= range[0] && centerY <= range[1]) return name;
  }
  return row >= layout.rows * 0.62 ? 'foreground' : row <= layout.rows * 0.34 ? 'background' : 'midground';
}

function buildAxisMundi(anchor, width, height) {
  const x = round(anchor[0]);
  const y = round(anchor[1]);
  return {
    anchor: [x, y],
    vertical: [[x, round(height * 0.12)], [x, round(height * 0.88)]],
    horizontal: [[round(width * 0.12), y], [round(width * 0.88), y]],
  };
}

function normalizeDepthBands(depthBands, height) {
  const fallback = {
    foreground: [height * 0.62, height * 0.92],
    midground: [height * 0.34, height * 0.62],
    background: [height * 0.14, height * 0.34],
  };
  const out = {};
  for (const key of Object.keys(fallback)) {
    const source = Array.isArray(depthBands?.[key]) ? depthBands[key] : fallback[key];
    out[key] = [round(finiteOr(source[0], fallback[key][0])), round(finiteOr(source[1], fallback[key][1]))];
  }
  return out;
}

function depthBandName(value) {
  const lower = String(value || '').toLowerCase();
  if (lower.includes('foreground')) return 'foreground';
  if (lower.includes('background')) return 'background';
  return 'midground';
}

function importanceShare(importance, index) {
  const lower = String(importance || '').toLowerCase();
  if (lower.includes('primary')) return { width: 0.38, height: 0.46 };
  if (lower.includes('secondary')) return { width: 0.24, height: 0.26 };
  return index === 0 ? { width: 0.34, height: 0.4 } : { width: 0.2, height: 0.22 };
}

function isPrimary(element) {
  return /primary/.test(String(element?.importance || '').toLowerCase());
}

function inferParentByRole(role, roles, rootRole) {
  const lower = role.toLowerCase();
  if (/roof|window|door|facade/.test(lower)) {
    return roles.find((candidate) => /house|body|building|cabinet|property|facade/.test(candidate.toLowerCase())) || rootRole;
  }
  return rootRole;
}

function bestRoleMatch(value, roles) {
  const terms = roleTerms(value);
  return roles.find((role) => {
    const lower = role.toLowerCase();
    return terms.some((term) => lower.includes(term) || term.includes(lower));
  });
}

function childRegionKind(role) {
  const lower = String(role || '').toLowerCase();
  return CHILD_ROLE_RULES.find((rule) => rule.pattern.test(lower))?.region || 'contained-detail';
}

function roleTerms(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term && term.length > 2 && !['block', 'item', 'main', 'body'].includes(term));
}

function insetBounds(bounds, xRatio, yRatio) {
  const dx = bounds.width * xRatio;
  const dy = bounds.height * yRatio;
  return {
    x: bounds.x + dx,
    y: bounds.y + dy,
    width: Math.max(bounds.width - dx * 2, 1),
    height: Math.max(bounds.height - dy * 2, 1),
  };
}

function containBounds(bounds, parent) {
  const x = clamp(bounds.x, parent.x, parent.x + parent.width - 1);
  const y = clamp(bounds.y, parent.y, parent.y + parent.height - 1);
  return {
    x,
    y,
    width: Math.max(Math.min(bounds.width, parent.x + parent.width - x), 1),
    height: Math.max(Math.min(bounds.height, parent.y + parent.height - y), 1),
  };
}

function clampBounds(bounds, width, height) {
  const x = clamp(bounds.x, 0, width - 1);
  const y = clamp(bounds.y, 0, height - 1);
  return {
    x,
    y,
    width: Math.max(Math.min(bounds.width, width - x), 1),
    height: Math.max(Math.min(bounds.height, height - y), 1),
  };
}

function roundBounds(bounds) {
  return {
    x: round(bounds.x),
    y: round(bounds.y),
    width: round(bounds.width),
    height: round(bounds.height),
  };
}

function validBounds(bounds) {
  return bounds &&
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0;
}

function validAxis(axis) {
  return Array.isArray(axis) && axis.length === 2 && validPoint(axis[0]) && validPoint(axis[1]);
}

function validPoint(point) {
  return Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])
    ? point
    : null;
}

function roundPointTuple(point) {
  return [round(point[0]), round(point[1])];
}

function finiteOr(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
