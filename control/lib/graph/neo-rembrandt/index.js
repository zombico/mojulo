import {
  bbox,
  bottomPoint,
  centroid,
  clipBand,
  clipHalfPlane,
  dot,
  normalize,
} from './geometry.js';
import { annotateMarksWithConstellation, constellationDebugMarks } from '../polygonizer/constellation.js';
import { findMandalaBlock, projectMandalaBlock, projectMandalaPoint, projectTwoPoint, withGeneratedElementMandala } from '../polygonizer/pure-mandala.js';

const PALETTES = {
  'warm-low-key': {
    base: '#c8a978',
    shadow: '#372819',
    core: '#21170f',
    deepest: '#120c08',
    cast: '#24190f',
    highlight: '#fff3ce',
  },
};

export function expandNeoRembrandt(manifest, { includeHighlights = true } = {}) {
  if (!manifest || typeof manifest !== 'object') return manifest;
  const cameraResolvedManifest = withGeneratedElementMandala(ensureFormConstellation(resolveTwoPointCameraPrimitive(manifest)));
  const sourceMarks = Array.isArray(cameraResolvedManifest.marks) ? cameraResolvedManifest.marks : null;
  if (!sourceMarks) return cameraResolvedManifest;

  const scene = cameraResolvedManifest.scene || {};
  const palette = PALETTES[scene.palette] || PALETTES['warm-low-key'];
  const skeletonResolvedSourceMarks = synthesizeDynamicSkeletonMarks(sourceMarks, cameraResolvedManifest.gesture, scene);
  const constructionResolvedMarks = resolveConstructionMarks(skeletonResolvedSourceMarks, scene, cameraResolvedManifest);
  const gestureResolvedMarks = resolveGestureMarks(constructionResolvedMarks, cameraResolvedManifest.gesture);
  const preFacePatternSourceMarks = assignViewDepthZ(
    gestureResolvedMarks.flatMap((mark, index) => expandCompactSourceMarks(mark, index, scene, cameraResolvedManifest)),
    scene,
  );
  const expandedSourceMarks = resolveFacePatternMarks(preFacePatternSourceMarks, scene);
  const marks = [];

  for (const mark of expandedSourceMarks) {
    marks.push(materializeSourceMark(mark, palette));
    if (isShadowAlgorithm(mark?.shade?.algorithm)) {
      marks.push(...convexValueStack(mark, scene, palette));
    }
  }

  marks.push(...interBlobCastShadows(expandedSourceMarks, scene, palette));

  if (includeHighlights) {
    for (const mark of expandedSourceMarks) {
      if (isHighlightAlgorithm(mark?.highlights?.algorithm)) {
        marks.push(...simpleHighlight(mark, scene, palette));
      }
    }
  }
  const annotatedMarks = annotateMarksWithConstellation(marks, cameraResolvedManifest.polygonizer?.constellation);
  const debugMarks = constellationDebugMarks(cameraResolvedManifest.polygonizer?.constellation);
  const depthOrderedMarks = applyConstellationBackToFrontPaintOrder(
    annotatedMarks.concat(debugMarks),
    cameraResolvedManifest,
  );
  const finalMarks = applyGridRenderStyleContract(
    depthOrderedMarks,
    cameraResolvedManifest,
  );
  const contactAnnotatedMarks = annotateContactRegions(finalMarks);
  const metamandala = resolveMetamandalaSurfaces(contactAnnotatedMarks, cameraResolvedManifest);
  const relaxation = applyMetamandalaRelaxation(contactAnnotatedMarks, metamandala.surfaces, cameraResolvedManifest);
  const relaxedContactMarks = relaxation.applied
    ? annotateContactRegions(relaxation.marks)
    : contactAnnotatedMarks;
  const relaxedMetamandala = relaxation.applied
    ? resolveMetamandalaSurfaces(relaxedContactMarks, cameraResolvedManifest)
    : metamandala;
  const marksWithMetamandala = relaxedContactMarks.concat(relaxedMetamandala.debugMarks);
  const contactReport = validateContactChecks(marksWithMetamandala, cameraResolvedManifest, relaxedMetamandala.surfaces);

  return {
    ...cameraResolvedManifest,
    marks: marksWithMetamandala.sort((a, b) => (a.z ?? 0) - (b.z ?? 0)),
    neoRembrandt: {
      expanded: true,
      includeHighlights,
      sourceMarkCount: sourceMarks.length,
      dynamicSkeletonGenerated: skeletonResolvedSourceMarks.length !== sourceMarks.length,
      dynamicSkeletonMarkCount: skeletonResolvedSourceMarks.filter((mark) => mark?.dynamicSkeleton).length,
      constructionMarkCount: sourceMarks.filter((mark) => isConstructionMark(mark)).length,
      constructionResolvedMarkCount: constructionResolvedMarks.length,
      polygonizerSubject: cameraResolvedManifest.polygonizer?.subject,
      gestureResolved: gestureResolvedMarks.some((mark) => mark?.gestureResolved),
      expandedSourceMarkCount: expandedSourceMarks.length,
      expandedMarkCount: marksWithMetamandala.length,
      constellationAnnotatedMarkCount: annotatedMarks.filter((mark) => mark?.constellationRole).length,
      constellationDebugMarkCount: debugMarks.length,
      metamandalaSurfaceCount: relaxedMetamandala.surfaces.length,
      metamandalaSurfaces: relaxedMetamandala.surfaces,
      metamandalaDebugMarkCount: relaxedMetamandala.debugMarks.length,
      metamandalaRelaxationApplied: relaxation.applied,
      metamandalaRelaxationAdjustments: relaxation.adjustments,
      contactCheckCount: contactReport.checks.length,
      contactCheckPassedCount: contactReport.checks.filter((check) => check.ok).length,
      contactChecks: contactReport.checks,
      formConstellationAuthored: Boolean(cameraResolvedManifest.polygonizer?.formConstellationAuthored),
      formConstellationNodeCount: cameraResolvedManifest.polygonizer?.formConstellationNodeCount || 0,
      elementMandalaGenerated: Boolean(cameraResolvedManifest.polygonizer?.elementMandala?.generated),
      elementMandalaCount: cameraResolvedManifest.polygonizer?.elementMandala?.elements?.length || 0,
    },
  };
}

function ensureFormConstellation(manifest) {
  const marks = Array.isArray(manifest?.marks) ? manifest.marks : [];
  const forms = marks
    .map((mark, index) => ({ mark, index }))
    .filter(({ mark }) => mark?.kind === 'form');
  if (!forms.length) return manifest;

  const viewBox = manifest.viewBox || {};
  const width = Math.max(finiteOr(viewBox.width, 800), 1);
  const height = Math.max(finiteOr(viewBox.height, 520), 1);
  const existing = manifest.polygonizer?.constellation;
  const base = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? existing
    : flatEyeLevelConstellation(width, height);
  const nodes = Array.isArray(base.nodes) ? [...base.nodes] : [];
  const roles = new Set(nodes.map((node) => node?.role).filter(Boolean));
  const vp = validPoint(base.vanishingPoint) ||
    validPoint(manifest.scene?.perspective?.vanishingPoint) ||
    [width / 2, height * 0.5];
  let added = 0;

  forms.forEach(({ mark, index }) => {
    const role = formConstellationRole(mark, index);
    if (roles.has(role)) return;
    const node = formConstellationNode({
      mark,
      index,
      role,
      width,
      height,
      vanishingPoint: vp,
      renderOrder: formRenderOrder(nodes, index),
      mode: existing ? 'world-grid' : 'flat-eye-level',
    });
    nodes.push(node);
    roles.add(role);
    added += 1;
  });

  if (!added) return manifest;
  return {
    ...manifest,
    polygonizer: {
      ...(manifest.polygonizer || {}),
      constellation: {
        ...base,
        kind: 'cca-constellation-grid',
        generated: base.generated !== false,
        source: existing ? base.source || 'supplied-plus-form-authorship' : 'form-flat-eye-level',
        formConstellationAuthored: true,
        flatEyeLevel: existing ? Boolean(base.flatEyeLevel) : true,
        nodes,
      },
      formConstellationAuthored: true,
      formConstellationNodeCount: nodes.filter((node) => node?.formConstellation).length,
    },
  };
}

function flatEyeLevelConstellation(width, height) {
  const horizonY = roundPoint(height * 0.5);
  const anchor = [roundPoint(width / 2), horizonY];
  return {
    kind: 'cca-constellation-grid',
    generated: true,
    source: 'form-flat-eye-level',
    flatEyeLevel: true,
    axisMundi: {
      anchor,
      vertical: [[anchor[0], roundPoint(height * 0.1)], [anchor[0], roundPoint(height * 0.9)]],
      horizontal: [[roundPoint(width * 0.1), anchor[1]], [roundPoint(width * 0.9), anchor[1]]],
    },
    horizonY,
    vanishingPoint: anchor,
    baselineY: roundPoint(height * 0.82),
    depthBands: {
      foreground: [roundPoint(height * 0.62), roundPoint(height * 0.92)],
      midground: [roundPoint(height * 0.18), roundPoint(height * 0.82)],
      background: [roundPoint(height * 0.08), roundPoint(height * 0.32)],
    },
    nodes: [],
  };
}

function formConstellationRole(mark, index) {
  return String(mark.constellationRole || mark.gridRole || mark.role || `form-${index + 1}`);
}

function formRenderOrder(nodes, index) {
  const max = nodes.reduce((best, node) => Math.max(best, finiteOr(node?.renderOrder, 0)), 0);
  return max + 10 + index;
}

function formConstellationNode({ mark, index, role, width, height, vanishingPoint, renderOrder, mode }) {
  const bounds = formAuthoringBounds(mark, { width, height });
  const center = [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2];
  return {
    role,
    renderOrder,
    parent: mark.constellationParent || null,
    depthBand: mark.depthBand || 'midground',
    anchor: roundPointTuple(validPoint(mark.anchor) || center),
    bounds,
    cca: {
      center: roundPointTuple(center),
      lengthAxis: [
        [bounds.x, roundPoint(center[1])],
        [roundPoint(bounds.x + bounds.width), roundPoint(center[1])],
      ],
      heightAxis: [
        [roundPoint(center[0]), roundPoint(bounds.y + bounds.height)],
        [roundPoint(center[0]), bounds.y],
      ],
      depthAxis: {
        toward: roundPointTuple(vanishingPoint),
        mode,
      },
    },
    scale: {
      pictureShare: round((bounds.width * bounds.height) / 1000000),
      childBudget: 0.62,
    },
    childRegion: insetLocalBounds(bounds, 0.12, 0.12),
    formConstellation: true,
    formConstellationStock: mark.stock || mark.bodyStock || 'abstract-combo',
    formConstellationMode: mode,
    authoredFrom: 'form',
    sourceMarkIndex: index,
  };
}

function formAuthoringBounds(mark, viewBox) {
  if (mark.bounds && typeof mark.bounds === 'object' && !Array.isArray(mark.bounds)) {
    return clampLocalBounds(normalizeLocalBounds(mark.bounds), viewBox);
  }
  if (Number.isFinite(Number(mark.x)) && Number.isFinite(Number(mark.y))) {
    return clampLocalBounds(normalizeLocalBounds({
      x: mark.x,
      y: mark.y,
      width: mark.width ?? mark.w ?? 160,
      height: mark.height ?? mark.h ?? 200,
    }), viewBox);
  }
  const gestureBounds = formGestureBounds(mark);
  if (gestureBounds) return clampLocalBounds(gestureBounds, viewBox);

  const anchor = validPoint(mark.anchor) || [finiteOr(mark.cx, viewBox.width / 2), finiteOr(mark.cy, viewBox.height / 2)];
  const scale = Math.max(finiteOr(mark.scale, 1), 0.1);
  const stock = String(mark.stock || mark.bodyStock || '').toLowerCase();
  let w = 160 * scale;
  let h = 220 * scale;
  if (isLowerBodyDummyStock(stock)) {
    w = Math.max((finiteOr(mark.hipSpread, 34 * scale) * 2) + 72 * scale, 110 * scale);
    h = finiteOr(mark.upperLegLength, 74 * scale) + finiteOr(mark.lowerLegLength, 78 * scale) + 80 * scale;
  } else if (isFullBodyDummyStock(stock) || stock === 'bipedal') {
    w = Math.max((finiteOr(mark.shoulderSpread, 42 * scale) * 2) + 96 * scale, 150 * scale);
    h = finiteOr(mark.upperLegLength, 68 * scale) + finiteOr(mark.lowerLegLength, 72 * scale) + 280 * scale;
  } else if (stock === 'plane-object') {
    w = finiteOr(mark.width, finiteOr(mark.w, 150 * scale));
    h = finiteOr(mark.height, finiteOr(mark.h, 92 * scale));
  }
  return clampLocalBounds({
    x: anchor[0] - w / 2,
    y: anchor[1] - h / 2,
    width: w,
    height: h,
  }, viewBox);
}

function formGestureBounds(mark) {
  const points = [];
  collectGesturePoints(mark.gesture, points);
  collectGesturePoints(mark.leftArmGesture, points);
  collectGesturePoints(mark.rightArmGesture, points);
  if (!points.length) return null;
  const scale = Math.max(finiteOr(mark.scale, 1), 0.1);
  const pad = 80 * scale;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad + finiteOr(mark.upperLegLength, 68 * scale) + finiteOr(mark.lowerLegLength, 72 * scale) * 0.5;
  return {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
}

function collectGesturePoints(gesture, out) {
  if (!gesture || typeof gesture !== 'object' || Array.isArray(gesture)) return;
  if (Array.isArray(gesture.points)) {
    out.push(...gesture.points.filter((point) => validPoint(point)));
  }
  collectGesturePoints(gesture.crossGesture || gesture.cross, out);
  collectGesturePoints(gesture.leftArm, out);
  collectGesturePoints(gesture.rightArm, out);
}

function normalizeLocalBounds(bounds) {
  return {
    x: finiteOr(bounds.x, 0),
    y: finiteOr(bounds.y, 0),
    width: Math.max(finiteOr(bounds.width ?? bounds.w, 1), 1),
    height: Math.max(finiteOr(bounds.height ?? bounds.h, 1), 1),
  };
}

function clampLocalBounds(bounds, viewBox) {
  const x = Math.min(Math.max(bounds.x, 0), Math.max(viewBox.width - 1, 0));
  const y = Math.min(Math.max(bounds.y, 0), Math.max(viewBox.height - 1, 0));
  return {
    x: roundPoint(x),
    y: roundPoint(y),
    width: roundPoint(Math.max(Math.min(bounds.width, viewBox.width - x), 1)),
    height: roundPoint(Math.max(Math.min(bounds.height, viewBox.height - y), 1)),
  };
}

function insetLocalBounds(bounds, xRatio, yRatio) {
  const dx = bounds.width * xRatio;
  const dy = bounds.height * yRatio;
  return {
    x: roundPoint(bounds.x + dx),
    y: roundPoint(bounds.y + dy),
    width: roundPoint(Math.max(bounds.width - dx * 2, 1)),
    height: roundPoint(Math.max(bounds.height - dy * 2, 1)),
  };
}

function roundPointTuple(point) {
  return [roundPoint(point[0]), roundPoint(point[1])];
}

function resolveTwoPointCameraPrimitive(manifest) {
  const cameraPrimitive = manifest.cameraPrimitive || manifest.scene?.cameraPrimitive;
  const pureMandala = manifest.polygonizer?.pureMandala || manifest.pureMandala;
  if (cameraPrimitive?.kind !== 'two-point' || !pureMandala?.room) return manifest;

  const generated = generateTwoPointRoomMarks(pureMandala, cameraPrimitive);
  const crop = cameraPrimitive.showFullMandala === false && cameraPrimitive.cropBox
    ? cameraPrimitive.cropBox
    : null;
  const marks = [
    ...generated.marks,
    ...(Array.isArray(manifest.marks) ? manifest.marks : []),
  ];

  return {
    ...manifest,
    viewBox: crop
      ? { width: crop.width, height: crop.height }
      : manifest.viewBox || generated.viewBox,
    marks: crop ? marks.map((mark) => offsetMark(mark, -crop.x, -crop.y)) : marks,
    scene: {
      ...(manifest.scene || {}),
      perspective: {
        ...(manifest.scene?.perspective || {}),
        mode: 'two-point',
        horizonY: cameraPrimitive.horizonY,
        vanishingPoints: cameraPrimitive.vanishingPoints,
      },
    },
    polygonizer: {
      ...(manifest.polygonizer || {}),
      twoPointCamera: {
        generated: true,
        floorGridCount: generated.floorGridCount,
        ceilingGridCount: generated.ceilingGridCount,
        projectedPins: generated.projectedPins,
        cameraGrammar: generated.cameraGrammar,
        cropApplied: Boolean(crop),
        cropBox: crop || undefined,
      },
    },
  };
}

function applyGridRenderStyleContract(marks, manifest) {
  if (!Array.isArray(marks) || !usesGridRenderStyle(manifest)) return marks;
  return marks.map((mark) => {
    if (!mark || typeof mark !== 'object') return mark;
    if (isWireframeOrGridMark(mark)) {
      return {
        ...mark,
        strokeWidth: 1,
      };
    }
    if (isBorderSuppressedElement(mark)) {
      return {
        ...mark,
        stroke: 'none',
        strokeWidth: 0,
      };
    }
    return mark;
  });
}

function applyConstellationBackToFrontPaintOrder(marks, manifest) {
  if (!Array.isArray(marks)) return marks;
  const constellation = manifest?.polygonizer?.constellation;
  const mode = constellation?.paintOrder || constellation?.depthPaintOrder || manifest?.scene?.constellationPaintOrder;
  if (mode !== 'back-to-front' && mode !== 'depth-back-to-front') return marks;
  const nodes = Array.isArray(constellation?.nodes) ? constellation.nodes : [];
  if (!nodes.length) return marks;
  const ranked = [...nodes]
    .filter((node) => node?.role)
    .sort((a, b) => depthBandRank(a.depthBand) - depthBandRank(b.depthBand) ||
      finiteOr(a.anchor?.[1], a.bounds?.y ?? 0) - finiteOr(b.anchor?.[1], b.bounds?.y ?? 0) ||
      finiteOr(a.renderOrder, 0) - finiteOr(b.renderOrder, 0));
  const rankByRole = new Map(ranked.map((node, index) => [node.role, index]));
  return marks.map((mark) => {
    if (!mark || mark.constellationDebug || !rankByRole.has(mark.constellationRole)) return mark;
    const rank = rankByRole.get(mark.constellationRole);
    const originalZ = finiteOr(mark.z, 0);
    const localBias = originalZ - Math.floor(originalZ);
    return {
      ...mark,
      z: round(100 + rank * 10 + localBias),
      constellationPaintOrder: 'back-to-front',
      constellationPaintRank: rank,
    };
  });
}

function depthBandRank(value) {
  const lower = String(value || '').toLowerCase();
  if (lower.includes('background')) return 0;
  if (lower.includes('foreground')) return 2;
  return 1;
}

function usesGridRenderStyle(manifest) {
  const polygonizer = manifest?.polygonizer || {};
  const cameraPrimitive = polygonizer.cameraPrimitive || manifest?.cameraPrimitive || manifest?.scene?.cameraPrimitive;
  const renderMode = polygonizer.renderMode || manifest?.scene?.renderMode || manifest?.renderMode;
  return Boolean(
    renderMode === 'grid' ||
      renderMode === 'grid-render' ||
      polygonizer.pureMandala ||
      polygonizer.constellation ||
      polygonizer.twoPointCamera ||
      cameraPrimitive,
  );
}

function isWireframeOrGridMark(mark) {
  const tokens = [
    mark.role,
    mark.constellationRole,
    mark.constructionKind,
    mark.sourceShape,
    mark.objectRef,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /\b(grid|wireframe|mandala|constellation|debug)\b/.test(tokens);
}

function isBorderSuppressedElement(mark) {
  if (!['polygon', 'circle', 'oval', 'egg', 'blob', 'sphere', 'wedge'].includes(mark.kind)) return false;
  if (mark.algorithmic || mark.algorithm === 'pastamaker' || mark.pastamaker || mark.stickerFieldRole) return false;
  if (mark.pass === 'shadow' || mark.pass === 'highlight' || mark.pass === 'sticker-field') return false;
  if (isWireframeOrGridMark(mark)) return false;
  return mark.fill !== 'none';
}

function generateTwoPointRoomMarks(pureMandala, cameraPrimitive) {
  if (
    cameraPrimitive.cameraPoint?.kind === 'doorway-straight-eye' ||
    cameraPrimitive.canonicalAngle === 'doorway-straight-room'
  ) {
    return generateStraightDoorwayRoomMarks(pureMandala, cameraPrimitive);
  }

  const room = pureMandala.room || {};
  const floor = room.floor || {};
  const xRange = orderedRange(floor.x || [room.walls?.leftX ?? -18, room.walls?.rightX ?? 18]);
  const yRange = orderedRange(floor.y || [-28, 8]);
  const frontY = Math.max(yRange[0], yRange[1]);
  const backY = Math.min(yRange[0], yRange[1]);
  const ceilingZ = finiteOr(room.ceilingZ, 11);
  const roomBasis = {
    xRange,
    yRange,
    frontY,
    backY,
    ...(cameraPrimitive.roomBasis || {}),
  };
  const project = (xyz) => projectTwoPoint(xyz, cameraPrimitive, roomBasis);
  const point = (xyz) => {
    const p = project(xyz);
    return [p[0], p[1]];
  };
  const vpLeft = validPoint(cameraPrimitive.vanishingPoints?.left) || [-220, 245];
  const vpRight = validPoint(cameraPrimitive.vanishingPoints?.right) || [1180, 245];
  const ceilingXPoint = (x, y) => {
    const floorStart = point([xRange[0], y, 0]);
    const floorTarget = point([x, y, 0]);
    const ceilingStart = point([xRange[0], y, ceilingZ]);
    return lerpPoint(ceilingStart, vpRight, lineParameter(floorStart, vpRight, floorTarget));
  };
  const ceilingYPoint = (x, y) => {
    const floorStart = point([x, frontY, 0]);
    const floorTarget = point([x, y, 0]);
    const ceilingStart = point([x, frontY, ceilingZ]);
    return lerpPoint(ceilingStart, vpLeft, lineParameter(floorStart, vpLeft, floorTarget));
  };
  const zBase = finiteOr(cameraPrimitive.zBase, 8);
  const marks = [];
  const cameraGrammar = buildTwoPointCameraGrammar({
    cameraPrimitive,
    pureMandala,
    roomBasis,
    ceilingZ,
    project: point,
  });
  const floorCorners = {
    frontLeft: point([xRange[0], frontY, 0]),
    frontRight: point([xRange[1], frontY, 0]),
    backRight: point([xRange[1], backY, 0]),
    backLeft: point([xRange[0], backY, 0]),
  };
  const ceilingCorners = {
    frontLeft: ceilingXPoint(xRange[0], frontY),
    frontRight: ceilingXPoint(xRange[1], frontY),
    backRight: ceilingXPoint(xRange[1], backY),
    backLeft: ceilingXPoint(xRange[0], backY),
  };

  marks.push(
    polygonMark('room:floor-plane', [floorCorners.frontLeft, floorCorners.frontRight, floorCorners.backRight, floorCorners.backLeft], '#7f684b', '#3c2b1d', 0.34, zBase),
    polygonMark('room:ceiling-plane', [ceilingCorners.frontLeft, ceilingCorners.frontRight, ceilingCorners.backRight, ceilingCorners.backLeft], '#4d4033', '#8a7357', 0.24, zBase + 0.2),
    polygonMark('room:left-wall-plane', [floorCorners.frontLeft, floorCorners.backLeft, ceilingCorners.backLeft, ceilingCorners.frontLeft], '#6d5841', '#302319', 0.34, zBase + 0.4),
    polygonMark('room:right-wall-plane', [floorCorners.frontRight, floorCorners.backRight, ceilingCorners.backRight, ceilingCorners.frontRight], '#725f48', '#302319', 0.32, zBase + 0.42),
    polygonMark('room:back-wall-plane', [floorCorners.backLeft, floorCorners.backRight, ceilingCorners.backRight, ceilingCorners.backLeft], '#5e4e3d', '#302319', 0.38, zBase + 0.36),
  );

  const xSteps = rangeSteps(xRange[0], xRange[1], finiteOr(cameraPrimitive.gridStepX, 6));
  const ySteps = rangeSteps(backY, frontY, finiteOr(cameraPrimitive.gridStepY, 6));
  for (const y of ySteps) {
    marks.push(lineMark(`floor:grid-x-y${round(y)}`, point([xRange[0], y, 0]), point([xRange[1], y, 0]), '#d0b98d', 0.28, 0.8, zBase + 1));
    marks.push(lineMark(`ceiling:grid-x-y${round(y)}`, ceilingXPoint(xRange[0], y), ceilingXPoint(xRange[1], y), '#d8c79d', 0.2, 0.75, zBase + 1.1));
  }
  for (const x of xSteps) {
    marks.push(lineMark(`floor:grid-y-x${round(x)}`, point([x, frontY, 0]), point([x, backY, 0]), '#d0b98d', 0.28, 0.8, zBase + 1.01));
    marks.push(lineMark(`ceiling:grid-y-x${round(x)}`, ceilingYPoint(x, frontY), ceilingYPoint(x, backY), '#d8c79d', 0.2, 0.75, zBase + 1.11));
  }

  const pins = [];
  for (const el of pureMandala.pinnedElements || []) {
    const elementRole = el.id || el.role;
    if ((el.role === 'door' || el.role === 'hallway') && el.wall === 'back') {
      const xs = orderedRange(el.x || [5, 10]);
      const zs = orderedRange(el.z || [0, el.role === 'hallway' ? ceilingZ : 7]);
      const opening = [
        point([xs[0], backY, zs[0]]),
        point([xs[1], backY, zs[0]]),
        point([xs[1], backY, zs[1]]),
        point([xs[0], backY, zs[1]]),
      ];
      const openingRole = el.role === 'hallway'
        ? el.id ? `room:${elementRole}-opening` : 'room:back-hallway-opening'
        : 'room:back-door';
      marks.push(polygonMark(openingRole, opening, '#211811', '#c9985c', 0.84, zBase + 3));
      if (el.role === 'hallway') {
        marks.push(...hallwayMarks({
          role: elementRole,
          xs,
          y0: backY,
          y1: finiteOr(el.toY, backY - 16),
          ceilingZ,
          project: point,
          z: zBase + 2.8,
        }));
      }
      pins.push({ role: elementRole, screen: opening[0], wall: 'back', spawnDirection: spawnDirectionForElement(el) });
      continue;
    }
    if (el.role === 'hallway' && (el.wall === 'left' || el.wall === 'right')) {
      const ys = orderedRange(el.y || [backY + 6, backY + 13]);
      const zs = orderedRange(el.z || [0, ceilingZ]);
      const x = el.wall === 'left' ? xRange[0] : xRange[1];
      const direction = el.wall === 'left' ? -1 : 1;
      const toX = finiteOr(el.toX, x + direction * 14);
      const opening = [
        point([x, ys[1], zs[0]]),
        point([x, ys[0], zs[0]]),
        point([x, ys[0], zs[1]]),
        point([x, ys[1], zs[1]]),
      ];
      marks.push(polygonMark(`room:${elementRole}-opening`, opening, '#211811', '#c9985c', 0.84, zBase + 3));
      marks.push(...sideHallwayMarks({
        role: elementRole,
        wallX: x,
        toX,
        ys,
        ceilingZ,
        project: point,
        z: zBase + 2.8,
      }));
      pins.push({ role: elementRole, screen: opening[0], wall: el.wall, spawnDirection: spawnDirectionForElement(el) });
      continue;
    }
    const world = Array.isArray(el.worldXYZ) ? el.worldXYZ : [0, 0, 0];
    const screen = point(world);
    pins.push({ role: elementRole, screen, worldXYZ: world, spawnDirection: spawnDirectionForElement(el) });
    if (el.role === 'ceiling-light' || el.role === 'ceiling-fan') {
      const hang = point([world[0], world[1], Math.max(world[2] - 1.1, 0)]);
      marks.push(lineMark(`${el.role}:hanger`, screen, hang, '#e8dcc0', 0.72, 1.1, zBase + 5));
      marks.push({ kind: 'circle', role: el.role, cx: hang[0], cy: hang[1], r: 10, fill: '#f1d28b', stroke: '#5d4428', strokeWidth: 1, opacity: 0.9, z: zBase + 5.1 });
      continue;
    }
    if (el.role === 'figure') {
      if (el.visible === false || el.camera === true || el.cameraAnchor === true) {
        continue;
      }
      marks.push(...figureMarks({ role: elementRole, base: screen, top: point([world[0], world[1], finiteOr(el.height, 6.2)]), z: zBase + 6 }));
      continue;
    }
    if (isRoomCuboidRole(el.role)) {
      marks.push(...roomCuboidMarks({
        role: elementRole,
        center: world,
        size: Array.isArray(el.sizeXYZ) ? el.sizeXYZ : defaultRoomObjectSize(el.role),
        project: point,
        fill: el.fill,
        stroke: el.stroke,
        z: zBase + finiteOr(el.zOrder, roomObjectDefaultZ(el.role)),
      }));
    }
  }

  if (cameraPrimitive.debugDots !== false) {
    for (const y of ySteps) {
      for (const x of xSteps) {
        const p = point([x, y, 0]);
        marks.push({ kind: 'circle', role: `debug:floor-dot:${round(x)}:${round(y)}`, cx: p[0], cy: p[1], r: 1.8, fill: '#f6e7bd', opacity: 0.25, z: zBase + 2 });
      }
    }
  }

  return {
    viewBox: { width: 980, height: 620 },
    marks,
    floorGridCount: xSteps.length + ySteps.length,
    ceilingGridCount: xSteps.length + ySteps.length,
    projectedPins: pins,
    cameraGrammar,
  };
}

function buildTwoPointCameraGrammar({ cameraPrimitive, pureMandala, roomBasis, ceilingZ, project }) {
  const crop = cameraPrimitive.cropBox;
  const frameCenter = crop
    ? [roundPoint(crop.x + crop.width / 2), roundPoint(crop.y + crop.height / 2)]
    : validPoint(cameraPrimitive.axisMundi?.screen) || [490, 310];
  const cameraPoint = cameraPrimitive.cameraPoint && typeof cameraPrimitive.cameraPoint === 'object'
    ? cameraPrimitive.cameraPoint
    : null;
  const lookAt = Array.isArray(cameraPoint?.lookAt)
    ? cameraPoint.lookAt
    : [
        (roomBasis.xRange[0] + roomBasis.xRange[1]) / 2,
        (roomBasis.frontY + roomBasis.backY) / 2,
        ceilingZ * 0.42,
      ];
  const axisWorld = [
    finiteOr(cameraPrimitive.axisMundi?.worldXYZ?.[0], finiteOr(lookAt[0], 0)),
    finiteOr(cameraPrimitive.axisMundi?.worldXYZ?.[1], finiteOr(lookAt[1], (roomBasis.frontY + roomBasis.backY) / 2)),
    finiteOr(cameraPrimitive.axisMundi?.worldXYZ?.[2], finiteOr(lookAt[2], ceilingZ * 0.42)),
  ];
  const axisScreen = validPoint(cameraPrimitive.axisMundi?.screen) || project(axisWorld);
  const eye = Array.isArray(cameraPrimitive.eyeWorldXYZ)
    ? cameraPrimitive.eyeWorldXYZ
    : Array.isArray(cameraPoint?.doorCenter)
      ? cameraPoint.doorCenter
      : [axisWorld[0], roomBasis.frontY, ceilingZ * 0.56];
  const eyeHeight = finiteOr(eye[2], ceilingZ * 0.56);
  const bottomT = clamp(eyeHeight / Math.max(ceilingZ, 0.001), 0, 1);
  const topVisibilityT = clamp((ceilingZ - eyeHeight) / Math.max(ceilingZ, 0.001), 0, 1);
  const floorAxis = project([axisWorld[0], axisWorld[1], 0]);
  const ceilingAxis = project([axisWorld[0], axisWorld[1], ceilingZ]);

  return {
    kind: 'axis-mundi-eye-line',
    source: 'camera-point-before-mandala',
    frameCenter,
    axisMundi: {
      worldXYZ: axisWorld.map(round),
      screen: axisScreen.map(roundPoint),
      directEyeLine: true,
    },
    cameraPoint: cameraPoint
      ? {
          kind: cameraPoint.kind,
          doorWall: cameraPoint.doorWall,
          doorCenter: Array.isArray(cameraPoint.doorCenter) ? cameraPoint.doorCenter.map(round) : undefined,
          lookAt: Array.isArray(cameraPoint.lookAt) ? cameraPoint.lookAt.map(round) : undefined,
        }
      : undefined,
    topPlane: {
      spawnDirection: 'ceiling-down',
      basis: 'ceiling-visible-from-eye',
      axisPoint: ceilingAxis.map(roundPoint),
      visibleFractionFromEye: round(topVisibilityT),
      inwardRays: [
        ['top-left', frameCenter],
        ['top-right', frameCenter],
      ],
    },
    bottomPlane: {
      spawnDirection: 'floor-up',
      basis: 'floor-arced-by-eye-height',
      axisPoint: floorAxis.map(roundPoint),
      eyeHeightFraction: round(bottomT),
      arcTension: round(0.18 + bottomT * 0.42),
      inwardRays: [
        ['bottom-left', frameCenter],
        ['bottom-right', frameCenter],
      ],
    },
    mandalaFlow: [
      'establish shot from prompt',
      'choose frame center as axis mundi / direct eye line',
      'derive top and bottom planes at that axis point',
      'map room and objects in 2d pure mandala',
      'spawn floor objects upward and ceiling/sky objects downward',
      'render through camera projection and crop',
    ],
    spawnRules: {
      default: 'floor-up',
      ceilingRoles: ['ceiling-light', 'ceiling-fan', 'sky', 'cloud', 'sun', 'moon', 'hanging-light'],
      ceilingAndSky: 'ceiling-down',
    },
  };
}

function spawnDirectionForElement(el) {
  if (typeof el.spawnDirection === 'string') return el.spawnDirection;
  if (el.fromCeiling === true || el.ceilingMounted === true) return 'ceiling-down';
  const role = String(el.role || '').toLowerCase();
  if (role.includes('ceiling') || role.includes('sky') || role.includes('cloud') || role.includes('sun') || role.includes('moon')) {
    return 'ceiling-down';
  }
  return 'floor-up';
}

function generateStraightDoorwayRoomMarks(pureMandala, cameraPrimitive) {
  const room = pureMandala.room || {};
  const floor = room.floor || {};
  const xRange = orderedRange(floor.x || [room.walls?.leftX ?? -16, room.walls?.rightX ?? 16]);
  const yRange = orderedRange(floor.y || [-24, 8]);
  const frontY = Math.max(yRange[0], yRange[1]);
  const backY = Math.min(yRange[0], yRange[1]);
  const ceilingZ = finiteOr(room.ceilingZ, 10);
  const frame = cameraPrimitive.straightFrame || {};
  const backWall = {
    left: finiteOr(frame.backWall?.left, 360),
    right: finiteOr(frame.backWall?.right, 620),
    top: finiteOr(frame.backWall?.top, 180),
    bottom: finiteOr(frame.backWall?.bottom, 360),
  };
  const floorFront = {
    left: validPoint(frame.floorFront?.left) || [160, 585],
    right: validPoint(frame.floorFront?.right) || [820, 585],
  };
  const ceilingFront = {
    left: validPoint(frame.ceilingFront?.left) || [220, 90],
    right: validPoint(frame.ceilingFront?.right) || [760, 90],
  };
  const roomBasis = {
    xRange,
    yRange,
    frontY,
    backY,
    ...(cameraPrimitive.roomBasis || {}),
  };
  const project = ([xRaw, yRaw, zRaw]) => {
    const x = finiteOr(xRaw, 0);
    const y = finiteOr(yRaw, 0);
    const z = finiteOr(zRaw, 0);
    const depthT = clamp((frontY - y) / Math.max(frontY - backY, 0.001), 0, 1);
    const widthT = clamp((x - xRange[0]) / Math.max(xRange[1] - xRange[0], 0.001), -0.4, 1.4);
    const floorLeft = lerpPoint(floorFront.left, [backWall.left, backWall.bottom], depthT);
    const floorRight = lerpPoint(floorFront.right, [backWall.right, backWall.bottom], depthT);
    const ceilingLeft = lerpPoint(ceilingFront.left, [backWall.left, backWall.top], depthT);
    const ceilingRight = lerpPoint(ceilingFront.right, [backWall.right, backWall.top], depthT);
    const floorPoint = lerpPoint(floorLeft, floorRight, widthT);
    const ceilingPoint = lerpPoint(ceilingLeft, ceilingRight, widthT);
    return lerpPoint(floorPoint, ceilingPoint, clamp(z / Math.max(ceilingZ, 0.001), -0.2, 1.2)).map(roundPoint);
  };

  const zBase = finiteOr(cameraPrimitive.zBase, 8);
  const marks = [
    polygonMark('room:floor-plane', [floorFront.left, floorFront.right, [backWall.right, backWall.bottom], [backWall.left, backWall.bottom]], '#7f684b', '#3c2b1d', 0.38, zBase),
    polygonMark('room:ceiling-plane', [ceilingFront.left, ceilingFront.right, [backWall.right, backWall.top], [backWall.left, backWall.top]], '#4d4033', '#8a7357', 0.26, zBase + 0.2),
    polygonMark('room:left-wall-plane', [floorFront.left, [backWall.left, backWall.bottom], [backWall.left, backWall.top], ceilingFront.left], '#6d5841', '#302319', 0.36, zBase + 0.4),
    polygonMark('room:right-wall-plane', [floorFront.right, [backWall.right, backWall.bottom], [backWall.right, backWall.top], ceilingFront.right], '#725f48', '#302319', 0.34, zBase + 0.42),
    polygonMark('room:back-wall-plane', [[backWall.left, backWall.bottom], [backWall.right, backWall.bottom], [backWall.right, backWall.top], [backWall.left, backWall.top]], '#5e4e3d', '#302319', 0.42, zBase + 0.36),
  ];

  const xSteps = rangeSteps(xRange[0], xRange[1], finiteOr(cameraPrimitive.gridStepX, 8));
  const ySteps = rangeSteps(backY, frontY, finiteOr(cameraPrimitive.gridStepY, 8));
  for (const y of ySteps) {
    marks.push(lineMark(`floor:grid-x-y${round(y)}`, project([xRange[0], y, 0]), project([xRange[1], y, 0]), '#d0b98d', 0.22, 0.8, zBase + 1));
    marks.push(lineMark(`ceiling:grid-x-y${round(y)}`, project([xRange[0], y, ceilingZ]), project([xRange[1], y, ceilingZ]), '#d8c79d', 0.16, 0.75, zBase + 1.1));
  }
  for (const x of xSteps) {
    marks.push(lineMark(`floor:grid-y-x${round(x)}`, project([x, frontY, 0]), project([x, backY, 0]), '#d0b98d', 0.22, 0.8, zBase + 1.01));
    marks.push(lineMark(`ceiling:grid-y-x${round(x)}`, project([x, frontY, ceilingZ]), project([x, backY, ceilingZ]), '#d8c79d', 0.16, 0.75, zBase + 1.11));
  }

  const projectedPins = [];
  for (const el of pureMandala.pinnedElements || []) {
    const elementRole = el.id || el.role;
    const world = Array.isArray(el.worldXYZ) ? el.worldXYZ : [0, 0, 0];
    const screen = project(world);
    projectedPins.push({ role: elementRole, screen, worldXYZ: world, spawnDirection: spawnDirectionForElement(el) });
    if (el.role === 'figure' && (el.visible === false || el.camera === true || el.cameraAnchor === true)) continue;
    if (el.role === 'figure') {
      marks.push(...figureMarks({
        role: elementRole,
        base: screen,
        top: project([world[0], world[1], finiteOr(el.height, 6.2)]),
        z: zBase + finiteOr(el.zOrder, 6),
      }));
      continue;
    }
    if (el.role === 'rug') {
      marks.push(rugMark(el, project, zBase + 2.2));
      continue;
    }
    if (el.role === 'ceiling-light' || el.role === 'ceiling-fan') {
      const hang = project([world[0], world[1], Math.max(world[2] - finiteOr(el.drop, 1.1), 0)]);
      marks.push(lineMark(`${elementRole}:hanger`, screen, hang, '#e8dcc0', 0.72, 1.1, zBase + 5));
      marks.push({ kind: 'circle', role: elementRole, cx: hang[0], cy: hang[1], r: 10, fill: '#f1d28b', stroke: '#5d4428', strokeWidth: 1, opacity: 0.9, z: zBase + 5.1 });
      continue;
    }
    if (isRoomCuboidRole(el.role)) {
      marks.push(...roomCuboidMarks({
        role: elementRole,
        center: world,
        size: Array.isArray(el.sizeXYZ) ? el.sizeXYZ : defaultRoomObjectSize(el.role),
        project,
        fill: el.fill,
        stroke: el.stroke,
        z: zBase + finiteOr(el.zOrder, roomObjectDefaultZ(el.role)),
      }));
    }
  }

  return {
    viewBox: { width: 980, height: 620 },
    marks,
    floorGridCount: xSteps.length + ySteps.length,
    ceilingGridCount: xSteps.length + ySteps.length,
    projectedPins,
    cameraGrammar: buildTwoPointCameraGrammar({
      cameraPrimitive,
      pureMandala,
      roomBasis,
      ceilingZ,
      project,
    }),
  };
}

function rugMark(el, project, z) {
  const world = Array.isArray(el.worldXYZ) ? el.worldXYZ : [0, 0, 0];
  const size = Array.isArray(el.sizeXYZ) ? el.sizeXYZ : [7, 5, 0];
  const sx = Math.max(finiteOr(size[0], 7), 0.2);
  const sy = Math.max(finiteOr(size[1], 5), 0.2);
  const cx = finiteOr(world[0], 0);
  const cy = finiteOr(world[1], 0);
  const points = [
    project([cx - sx / 2, cy + sy / 2, 0.02]),
    project([cx + sx / 2, cy + sy / 2, 0.02]),
    project([cx + sx / 2, cy - sy / 2, 0.02]),
    project([cx - sx / 2, cy - sy / 2, 0.02]),
  ];
  return polygonMark(el.id || 'rug', points, el.fill || '#855f4a', el.stroke || '#2e2117', 0.72, z);
}

function hallwayMarks({ role, xs, y0, y1, ceilingZ, project, z }) {
  const nearLeftFloor = project([xs[0], y0, 0]);
  const nearRightFloor = project([xs[1], y0, 0]);
  const farLeftFloor = project([xs[0], y1, 0]);
  const farRightFloor = project([xs[1], y1, 0]);
  const nearLeftCeiling = project([xs[0], y0, ceilingZ]);
  const nearRightCeiling = project([xs[1], y0, ceilingZ]);
  const farLeftCeiling = project([xs[0], y1, ceilingZ]);
  const farRightCeiling = project([xs[1], y1, ceilingZ]);
  return [
    polygonMark(`${role}:floor-run`, [nearLeftFloor, nearRightFloor, farRightFloor, farLeftFloor], '#473728', '#211811', 0.44, z),
    polygonMark(`${role}:ceiling-run`, [nearLeftCeiling, nearRightCeiling, farRightCeiling, farLeftCeiling], '#30251d', '#6f5b42', 0.42, z + 0.05),
    lineMark(`${role}:left-edge`, nearLeftFloor, farLeftFloor, '#d0b98d', 0.5, 1.2, z + 0.2),
    lineMark(`${role}:right-edge`, nearRightFloor, farRightFloor, '#d0b98d', 0.5, 1.2, z + 0.21),
    lineMark(`${role}:left-ceiling-edge`, nearLeftCeiling, farLeftCeiling, '#d8c79d', 0.38, 1, z + 0.22),
    lineMark(`${role}:right-ceiling-edge`, nearRightCeiling, farRightCeiling, '#d8c79d', 0.38, 1, z + 0.23),
  ];
}

function sideHallwayMarks({ role, wallX, toX, ys, ceilingZ, project, z }) {
  const nearA = project([wallX, ys[0], 0]);
  const nearB = project([wallX, ys[1], 0]);
  const farA = project([toX, ys[0], 0]);
  const farB = project([toX, ys[1], 0]);
  const nearACeiling = project([wallX, ys[0], ceilingZ]);
  const nearBCeiling = project([wallX, ys[1], ceilingZ]);
  const farACeiling = project([toX, ys[0], ceilingZ]);
  const farBCeiling = project([toX, ys[1], ceilingZ]);
  return [
    polygonMark(`${role}:floor-run`, [nearA, nearB, farB, farA], '#473728', '#211811', 0.44, z),
    polygonMark(`${role}:ceiling-run`, [nearACeiling, nearBCeiling, farBCeiling, farACeiling], '#30251d', '#6f5b42', 0.42, z + 0.05),
    lineMark(`${role}:near-edge`, nearA, nearB, '#d0b98d', 0.44, 1.2, z + 0.18),
    lineMark(`${role}:far-edge`, farA, farB, '#d0b98d', 0.36, 1, z + 0.19),
    lineMark(`${role}:left-run-edge`, nearA, farA, '#d0b98d', 0.5, 1.2, z + 0.2),
    lineMark(`${role}:right-run-edge`, nearB, farB, '#d0b98d', 0.5, 1.2, z + 0.21),
    lineMark(`${role}:left-ceiling-edge`, nearACeiling, farACeiling, '#d8c79d', 0.38, 1, z + 0.22),
    lineMark(`${role}:right-ceiling-edge`, nearBCeiling, farBCeiling, '#d8c79d', 0.38, 1, z + 0.23),
  ];
}

function roomCuboidMarks({ role, center, size, project, fill, stroke, z }) {
  const sx = Math.max(finiteOr(size?.[0], 4), 0.2);
  const sy = Math.max(finiteOr(size?.[1], 3), 0.2);
  const sz = Math.max(finiteOr(size?.[2], 3), 0.2);
  const cx = finiteOr(center?.[0], 0);
  const cy = finiteOr(center?.[1], 0);
  const z0 = finiteOr(center?.[2], 0);
  const x0 = cx - sx / 2;
  const x1 = cx + sx / 2;
  const y0 = cy - sy / 2;
  const y1 = cy + sy / 2;
  const bottom = {
    fl: project([x0, y1, z0]),
    fr: project([x1, y1, z0]),
    br: project([x1, y0, z0]),
    bl: project([x0, y0, z0]),
  };
  const top = {
    fl: project([x0, y1, z0 + sz]),
    fr: project([x1, y1, z0 + sz]),
    br: project([x1, y0, z0 + sz]),
    bl: project([x0, y0, z0 + sz]),
  };
  const baseFill = fill || roomObjectDefaultFill(role);
  const line = stroke || '#2e2117';
  const marks = [
    polygonMark(`${role}:front-face`, [bottom.fl, bottom.fr, top.fr, top.fl], shadeHex(baseFill, 0.92), line, 0.88, z + 0.2),
    polygonMark(`${role}:right-face`, [bottom.fr, bottom.br, top.br, top.fr], shadeHex(baseFill, 0.74), line, 0.82, z + 0.1),
    polygonMark(`${role}:top-face`, [top.fl, top.fr, top.br, top.bl], shadeHex(baseFill, 1.1), line, 0.82, z + 0.3),
    lineMark(`${role}:floor-contact`, bottom.fl, bottom.fr, '#e8dcc0', 0.32, 1.2, z + 0.35),
  ];

  if (role === 'shelf' || role === 'shelves' || role === 'bookcase') {
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const a = lerpPoint(bottom.fl, top.fl, t);
      const b = lerpPoint(bottom.fr, top.fr, t);
      marks.push(lineMark(`${role}:shelf-line-${i}`, a, b, '#d9b37b', 0.68, 1.4, z + 0.45 + i * 0.01));
    }
  }

  return marks;
}

function defaultRoomObjectSize(role) {
  if (role === 'shelf' || role === 'shelves' || role === 'bookcase') return [3.2, 9, 7.2];
  if (role === 'bar' || role === 'counter') return [9, 3.4, 3.3];
  if (role === 'sofa') return [8.5, 3.2, 2.6];
  if (role === 'coffee-table') return [4.8, 2.6, 1.35];
  if (role === 'media-console' || role === 'tv-console') return [7.2, 1.6, 2.1];
  if (role === 'side-table' || role === 'ottoman') return [2.2, 2.2, 1.8];
  if (role === 'table') return [5.8, 3.8, 2.7];
  return [4, 3, 3];
}

function isRoomCuboidRole(role) {
  return [
    'shelf',
    'shelves',
    'bookcase',
    'table',
    'bar',
    'counter',
    'cabinet',
    'sofa',
    'coffee-table',
    'media-console',
    'tv-console',
    'side-table',
    'ottoman',
  ].includes(role);
}

function roomObjectDefaultFill(role) {
  if (role === 'shelf' || role === 'shelves' || role === 'bookcase' || role === 'media-console' || role === 'tv-console') {
    return '#8b6642';
  }
  if (role === 'sofa' || role === 'ottoman') return '#6d6f59';
  if (role === 'coffee-table' || role === 'side-table') return '#7a5538';
  return '#6f4d32';
}

function roomObjectDefaultZ(role) {
  if (role === 'sofa' || role === 'coffee-table' || role === 'side-table' || role === 'ottoman') return 4.8;
  if (role === 'table' || role === 'bar' || role === 'counter') return 4.4;
  return 3.6;
}

function figureMarks({ role, base, top, z }) {
  const height = Math.max(base[1] - top[1], 60);
  const midY = top[1] + height * 0.54;
  const headR = clamp(height * 0.085, 8, 16);
  const shoulder = height * 0.14;
  const hip = height * 0.09;
  return [
    { kind: 'oval', role: `${role}:torso`, anchor: [base[0] - height * 0.02, midY], rx: shoulder, ry: height * 0.23, rotation: -0.05, fill: '#9f704e', stroke: '#3e2a1d', strokeWidth: 1, z },
    { kind: 'circle', role: `${role}:head`, cx: top[0], cy: top[1] + headR * 1.1, r: headR, fill: '#c3956d', stroke: '#3e2a1d', strokeWidth: 1, z: z + 0.2 },
    lineMark(`${role}:left-leg`, [base[0] - hip, midY + height * 0.2], [base[0] - hip * 1.45, base[1]], '#3e2a1d', 0.9, 4, z + 0.1),
    lineMark(`${role}:right-leg`, [base[0] + hip, midY + height * 0.2], [base[0] + hip * 1.2, base[1]], '#3e2a1d', 0.9, 4, z + 0.11),
    lineMark(`${role}:floor-pin`, [base[0] - hip * 1.8, base[1]], [base[0] + hip * 1.6, base[1]], '#e8dcc0', 0.55, 2, z + 0.12),
  ];
}

function polygonMark(role, points, fill, stroke, opacity, z) {
  return { kind: 'polygon', role, points, fill, stroke, strokeWidth: 1, opacity, z, closed: true };
}

function lineMark(role, a, b, stroke, opacity, strokeWidth, z) {
  return { kind: 'line', role, x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke, opacity, strokeWidth, z };
}

function lineParameter(a, b, p) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const denom = dx * dx + dy * dy;
  if (denom < 1e-9) return 0;
  return clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / denom, -0.2, 1.2);
}

function rangeSteps(min, max, step) {
  const out = [];
  const s = Math.max(Math.abs(step), 0.001);
  for (let v = min; v <= max + s * 0.25; v += s) out.push(round(v));
  if (!out.some((v) => Math.abs(v - max) < 1e-6)) out.push(round(max));
  return out;
}

function orderedRange(range) {
  const a = finiteOr(range?.[0], 0);
  const b = finiteOr(range?.[1], 1);
  return a <= b ? [a, b] : [b, a];
}

function average(values) {
  const clean = values.map((value) => Number(value)).filter(Number.isFinite);
  if (!clean.length) return 0;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function offsetMark(mark, dx, dy) {
  if (!mark || typeof mark !== 'object') return mark;
  if (mark.kind === 'line') return { ...mark, x1: mark.x1 + dx, y1: mark.y1 + dy, x2: mark.x2 + dx, y2: mark.y2 + dy };
  if (mark.kind === 'polygon' || mark.kind === 'polyline') {
    return { ...mark, points: mark.points.map((p) => [roundPoint(p[0] + dx), roundPoint(p[1] + dy)]) };
  }
  if (mark.kind === 'rect') return { ...mark, x: mark.x + dx, y: mark.y + dy };
  if (mark.kind === 'circle' || mark.kind === 'wedge') return { ...mark, cx: mark.cx + dx, cy: mark.cy + dy };
  if (mark.kind === 'oval' || mark.kind === 'egg' || mark.kind === 'blob' || mark.kind === 'sphere' || mark.kind === 'volume') {
    return Array.isArray(mark.anchor)
      ? { ...mark, anchor: [roundPoint(mark.anchor[0] + dx), roundPoint(mark.anchor[1] + dy)] }
      : { ...mark, cx: mark.cx + dx, cy: mark.cy + dy };
  }
  if (mark.kind === 'text') return { ...mark, x: mark.x + dx, y: mark.y + dy };
  return mark;
}

function isConstructionMark(mark) {
  return mark?.kind === 'partition' ||
    mark?.kind === 'array' ||
    mark?.kind === 'mandalaField' ||
    mark?.kind === 'stickerField' ||
    mark?.kind === 'cubieLattice' ||
    mark?.kind === 'form';
}

function resolveConstructionMarks(marks, scene = {}, manifest = {}) {
  if (!Array.isArray(marks) || !marks.some(isConstructionMark)) return marks;
  const resolved = [];
  const byRole = new Map();
  for (const mark of marks) {
    if (mark?.kind === 'partition') {
      const next = expandPartitionMark(mark, byRole);
      resolved.push(...next);
      next.forEach((item) => rememberRole(item, byRole));
      continue;
    }
    if (mark?.kind === 'array') {
      const next = expandArrayMark(mark);
      resolved.push(...next);
      next.forEach((item) => rememberRole(item, byRole));
      continue;
    }
    if (mark?.kind === 'mandalaField') {
      const next = expandMandalaFieldMark(mark, manifest);
      resolved.push(...next);
      next.forEach((item) => rememberRole(item, byRole));
      continue;
    }
    if (mark?.kind === 'stickerField') {
      const next = expandStickerFieldMark(mark, byRole);
      resolved.push(...next);
      next.forEach((item) => rememberRole(item, byRole));
      continue;
    }
    if (mark?.kind === 'cubieLattice') {
      const next = expandCubieLatticeMark(mark, scene, manifest);
      resolved.push(...next);
      next.forEach((item) => rememberRole(item, byRole));
      continue;
    }
    if (mark?.kind === 'form') {
      const next = expandFormMark(mark);
      resolved.push(...next);
      next.forEach((item) => rememberRole(item, byRole));
      continue;
    }
    resolved.push(mark);
    rememberRole(mark, byRole);
  }
  return resolved;
}

function expandFormMark(mark) {
  const mode = mark.mode || 'abstract';
  const stock = mark.stock || mark.bodyStock || 'abstract-combo';
  if (mode === 'animated' && stock === 'bipedal') return expandAnimatedBipedForm(mark);
  if (isLowerBodyDummyStock(stock)) return expandLowerBodyDummyForm(mark);
  if (isFullBodyDummyStock(stock)) return expandFullBodyDummyForm(mark);
  if (stock === 'plane-object') return expandPlaneObjectForm(mark);
  throw new Error(`form '${mark.role || '(anonymous)'}' unsupported mode/stock '${mode}/${stock}'`);
}

function expandAnimatedBipedForm(mark) {
  const role = mark.role || 'figure';
  const anchor = validPoint(mark.anchor) || [finiteOr(mark.cx, 220), finiteOr(mark.cy, 250)];
  const scale = Math.max(finiteOr(mark.scale, 1), 0.1);
  const mass = formMassProfile(mark.massTuning);
  const fill = mark.fill || '#b1845e';
  const stroke = mark.stroke || '#4f3928';
  const z = finiteOr(mark.z, 20);
  const common = formPrimitiveCommon(mark, role, 'animated', 'bipedal');
  const cx = anchor[0];
  const cy = anchor[1];
  const torsoHeight = 118 * scale;
  const torsoWidth = mass.torsoWidth * scale;
  const hipWidth = mass.hipWidth * scale;
  const headRy = 25 * scale;
  const headRx = 22 * scale * mass.headScale;
  const shoulderY = cy - 52 * scale;
  const hipY = cy + 42 * scale;
  const headY = cy - 104 * scale;

  return [
    {
      ...common,
      kind: 'volume',
      primitive: 'cup',
      role: `${role}:torso`,
      anchor: [roundPoint(cx), roundPoint(cy - 4 * scale)],
      height: torsoHeight,
      rimWidth: torsoWidth,
      footWidth: hipWidth,
      wallThickness: Math.max(5 * scale, 1),
      rings: Math.round(finiteOr(mark.rings, 10)),
      openTop: false,
      fill,
      stroke,
      z,
      formPart: 'torso',
    },
    {
      ...common,
      kind: 'egg',
      role: `${role}:head`,
      anchor: [roundPoint(cx), roundPoint(headY)],
      rx: headRx,
      ry: headRy,
      fill: mark.headFill || fill,
      stroke,
      z: z + 0.7,
      formPart: 'head',
    },
    formLimbBlob(common, `${role}:left-arm`, cx - torsoWidth * 0.54, shoulderY + 30 * scale, 13 * scale, 50 * scale, -0.35, fill, stroke, z + 0.2, 'limb'),
    formLimbBlob(common, `${role}:right-arm`, cx + torsoWidth * 0.54, shoulderY + 30 * scale, 13 * scale, 50 * scale, 0.35, fill, stroke, z + 0.21, 'limb'),
    formLimbBlob(common, `${role}:left-leg`, cx - hipWidth * 0.22, hipY + 44 * scale, 15 * scale, 58 * scale, 0.08, fill, stroke, z + 0.1, 'limb'),
    formLimbBlob(common, `${role}:right-leg`, cx + hipWidth * 0.22, hipY + 44 * scale, 15 * scale, 58 * scale, -0.08, fill, stroke, z + 0.11, 'limb'),
    formJointSphere(common, `${role}:neck-joint`, cx, cy - 70 * scale, 12 * scale, fill, stroke, z + 0.62),
    formJointSphere(common, `${role}:left-shoulder-joint`, cx - torsoWidth * 0.5, shoulderY, 13 * scale, fill, stroke, z + 0.5),
    formJointSphere(common, `${role}:right-shoulder-joint`, cx + torsoWidth * 0.5, shoulderY, 13 * scale, fill, stroke, z + 0.51),
    formJointSphere(common, `${role}:left-hip-joint`, cx - hipWidth * 0.24, hipY, 13 * scale, fill, stroke, z + 0.42),
    formJointSphere(common, `${role}:right-hip-joint`, cx + hipWidth * 0.24, hipY, 13 * scale, fill, stroke, z + 0.43),
  ];
}

function expandPlaneObjectForm(mark) {
  const role = mark.role || 'plane-object';
  const anchor = validPoint(mark.anchor) || [finiteOr(mark.cx, 240), finiteOr(mark.cy, 180)];
  const scale = Math.max(finiteOr(mark.scale, 1), 0.1);
  const width = Math.max(finiteOr(mark.width, finiteOr(mark.w, 150 * scale)), 10);
  const height = Math.max(finiteOr(mark.height, finiteOr(mark.h, 92 * scale)), 10);
  const depth = Math.max(finiteOr(mark.depth, 16 * scale), 1);
  const x = roundPoint(anchor[0] - width / 2);
  const y = roundPoint(anchor[1] - height / 2);
  const fill = mark.fill || '#b1845e';
  const stroke = mark.stroke || '#4f3928';
  const common = formPrimitiveCommon(mark, role, mark.mode || 'animated', 'plane-object');

  return [
    {
      ...common,
      kind: 'solid',
      role: `${role}:cca-body`,
      x,
      y,
      width,
      height,
      depth,
      fill,
      stroke,
      z: finiteOr(mark.z, 14),
      formPart: 'cca-body',
    },
    {
      ...common,
      kind: 'plane',
      role: `${role}:front-plane`,
      anchor,
      length: width * 0.82,
      width: height * 0.72,
      axis: [1, 0],
      fill: mark.planeFill || shadeHex(fill, 1.06),
      stroke,
      z: finiteOr(mark.z, 14) + 0.5,
      formPart: 'front-plane',
    },
  ];
}

function isLowerBodyDummyStock(stock) {
  return ['lower-body-dummy', 'pelvis-leg-dummy', 'pelvis-legs-dummy', 'form-dummy-lower-body'].includes(String(stock || '').toLowerCase());
}

function isFullBodyDummyStock(stock) {
  return ['full-body-dummy', 'figure-dummy', 'form-dummy-full-body', 'mannequin-dummy'].includes(String(stock || '').toLowerCase());
}

function expandLowerBodyDummyForm(mark) {
  const role = mark.role || 'lower-body-dummy';
  const anchor = validPoint(mark.anchor) || [finiteOr(mark.cx, 220), finiteOr(mark.cy, 280)];
  const scale = Math.max(finiteOr(mark.scale, 1), 0.1);
  const fill = mark.fill || '#b1845e';
  const stroke = mark.stroke || '#4f3928';
  const z = finiteOr(mark.z, 20);
  const common = {
    ...formPrimitiveCommon(mark, role, mark.mode || 'dummy', mark.stock || 'lower-body-dummy'),
    formDummyPrimitive: true,
    constructionBasis: 'cca-joint-chain',
  };
  const cx = anchor[0];
  const pelvisY = anchor[1];
  const hipSpread = finiteOr(mark.hipSpread, 34 * scale);
  const kneeSpread = finiteOr(mark.kneeSpread, 28 * scale);
  const ankleSpread = finiteOr(mark.ankleSpread, 25 * scale);
  const kneeY = pelvisY + finiteOr(mark.upperLegLength, 74 * scale);
  const ankleY = kneeY + finiteOr(mark.lowerLegLength, 78 * scale);
  const footY = ankleY + finiteOr(mark.footDrop, 15 * scale);
  const footOut = finiteOr(mark.footOut, 18 * scale);
  const pelvis = [cx, pelvisY];
  const leftHip = [cx - hipSpread, pelvisY + 9 * scale];
  const rightHip = [cx + hipSpread, pelvisY + 9 * scale];
  const leftKnee = [cx - kneeSpread, kneeY];
  const rightKnee = [cx + kneeSpread, kneeY];
  const leftAnkle = [cx - ankleSpread, ankleY];
  const rightAnkle = [cx + ankleSpread, ankleY];
  const leftFoot = [leftAnkle[0] - footOut, footY];
  const rightFoot = [rightAnkle[0] + footOut, footY];
  const points = { pelvis, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle, leftFoot, rightFoot };
  return [
    formDummyCore(common, `${role}:pelvis`, pelvis, 42 * scale, 30 * scale, -0.04, fill, stroke, z + 0.2, 'pelvis'),
    formDummyJoint(common, `${role}:left-hip-joint`, leftHip, 12 * scale, fill, stroke, z + 0.42, ['pelvis', 'left-upper-leg']),
    formDummyJoint(common, `${role}:right-hip-joint`, rightHip, 12 * scale, fill, stroke, z + 0.43, ['pelvis', 'right-upper-leg']),
    formDummyLimb(common, `${role}:left-upper-leg`, leftHip, leftKnee, 14 * scale, fill, stroke, z + 0.24),
    formDummyLimb(common, `${role}:right-upper-leg`, rightHip, rightKnee, 14 * scale, fill, stroke, z + 0.25),
    formDummyJoint(common, `${role}:left-knee-joint`, leftKnee, 11 * scale, fill, stroke, z + 0.5, ['left-upper-leg', 'left-lower-leg']),
    formDummyJoint(common, `${role}:right-knee-joint`, rightKnee, 11 * scale, fill, stroke, z + 0.51, ['right-upper-leg', 'right-lower-leg']),
    formDummyLimb(common, `${role}:left-lower-leg`, leftKnee, leftAnkle, 12 * scale, fill, stroke, z + 0.2),
    formDummyLimb(common, `${role}:right-lower-leg`, rightKnee, rightAnkle, 12 * scale, fill, stroke, z + 0.21),
    formDummyJoint(common, `${role}:left-ankle-joint`, leftAnkle, 9 * scale, fill, stroke, z + 0.55, ['left-lower-leg', 'left-foot']),
    formDummyJoint(common, `${role}:right-ankle-joint`, rightAnkle, 9 * scale, fill, stroke, z + 0.56, ['right-lower-leg', 'right-foot']),
    formDummyLimb(common, `${role}:left-foot`, leftAnkle, leftFoot, 9 * scale, fill, stroke, z + 0.18, 'foot'),
    formDummyLimb(common, `${role}:right-foot`, rightAnkle, rightFoot, 9 * scale, fill, stroke, z + 0.19, 'foot'),
  ].map((item) => ({
    ...item,
    formDummyJointsStick: true,
    formDummyAnchorMap: Object.fromEntries(Object.entries(points).map(([key, point]) => [key, [roundPoint(point[0]), roundPoint(point[1])]])),
  }));
}

function expandFullBodyDummyForm(mark) {
  const role = mark.role || 'full-body-dummy';
  const scale = Math.max(finiteOr(mark.scale, 1), 0.1);
  const fill = mark.fill || '#b1845e';
  const stroke = mark.stroke || '#4f3928';
  const z = finiteOr(mark.z, 20);
  const common = {
    ...formPrimitiveCommon(mark, role, mark.mode || 'dummy', mark.stock || 'full-body-dummy'),
    formDummyPrimitive: true,
    constructionBasis: mark.gesture ? 'gesture-cca-joint-chain' : 'cca-joint-chain',
  };
  const points = fullBodyDummyPoints(mark, scale);
  return [
    formDummyHead(common, `${role}:head`, points.head, 21 * scale, 26 * scale, fill, stroke, z + 0.78),
    formDummyJoint(common, `${role}:neck-joint`, points.neck, 10 * scale, fill, stroke, z + 0.7, ['head', 'torso']),
    formDummyCore(common, `${role}:torso`, points.torso, 36 * scale, 52 * scale, dummyRotation(points.neck, points.pelvis), fill, stroke, z + 0.38, 'torso'),
    formDummyCore(common, `${role}:pelvis`, points.pelvis, 38 * scale, 28 * scale, dummyRotation(points.leftHip, points.rightHip) + Math.PI / 2, fill, stroke, z + 0.24, 'pelvis'),
    formDummyLimb(common, `${role}:torso-carry`, points.torso, points.pelvis, 20 * scale, fill, stroke, z + 0.28, 'core-span'),
    formDummyJoint(common, `${role}:left-shoulder-joint`, points.leftShoulder, 11 * scale, fill, stroke, z + 0.56, ['torso', 'left-upper-arm']),
    formDummyJoint(common, `${role}:right-shoulder-joint`, points.rightShoulder, 11 * scale, fill, stroke, z + 0.57, ['torso', 'right-upper-arm']),
    formDummyLimb(common, `${role}:left-upper-arm`, points.leftShoulder, points.leftElbow, 10 * scale, fill, stroke, z + 0.32),
    formDummyLimb(common, `${role}:right-upper-arm`, points.rightShoulder, points.rightElbow, 10 * scale, fill, stroke, z + 0.33),
    formDummyJoint(common, `${role}:left-elbow-joint`, points.leftElbow, 9 * scale, fill, stroke, z + 0.58, ['left-upper-arm', 'left-forearm']),
    formDummyJoint(common, `${role}:right-elbow-joint`, points.rightElbow, 9 * scale, fill, stroke, z + 0.59, ['right-upper-arm', 'right-forearm']),
    formDummyLimb(common, `${role}:left-forearm`, points.leftElbow, points.leftWrist, 9 * scale, fill, stroke, z + 0.34),
    formDummyLimb(common, `${role}:right-forearm`, points.rightElbow, points.rightWrist, 9 * scale, fill, stroke, z + 0.35),
    formDummyJoint(common, `${role}:left-wrist-joint`, points.leftWrist, 7 * scale, fill, stroke, z + 0.6, ['left-forearm']),
    formDummyJoint(common, `${role}:right-wrist-joint`, points.rightWrist, 7 * scale, fill, stroke, z + 0.61, ['right-forearm']),
    formDummyJoint(common, `${role}:left-hip-joint`, points.leftHip, 12 * scale, fill, stroke, z + 0.42, ['pelvis', 'left-upper-leg']),
    formDummyJoint(common, `${role}:right-hip-joint`, points.rightHip, 12 * scale, fill, stroke, z + 0.43, ['pelvis', 'right-upper-leg']),
    formDummyLimb(common, `${role}:left-upper-leg`, points.leftHip, points.leftKnee, 13 * scale, fill, stroke, z + 0.24),
    formDummyLimb(common, `${role}:right-upper-leg`, points.rightHip, points.rightKnee, 13 * scale, fill, stroke, z + 0.25),
    formDummyJoint(common, `${role}:left-knee-joint`, points.leftKnee, 10 * scale, fill, stroke, z + 0.5, ['left-upper-leg', 'left-lower-leg']),
    formDummyJoint(common, `${role}:right-knee-joint`, points.rightKnee, 10 * scale, fill, stroke, z + 0.51, ['right-upper-leg', 'right-lower-leg']),
    formDummyLimb(common, `${role}:left-lower-leg`, points.leftKnee, points.leftAnkle, 11 * scale, fill, stroke, z + 0.2),
    formDummyLimb(common, `${role}:right-lower-leg`, points.rightKnee, points.rightAnkle, 11 * scale, fill, stroke, z + 0.21),
    formDummyJoint(common, `${role}:left-ankle-joint`, points.leftAnkle, 8 * scale, fill, stroke, z + 0.55, ['left-lower-leg', 'left-foot']),
    formDummyJoint(common, `${role}:right-ankle-joint`, points.rightAnkle, 8 * scale, fill, stroke, z + 0.56, ['right-lower-leg', 'right-foot']),
    formDummyLimb(common, `${role}:left-foot`, points.leftAnkle, points.leftFoot, 8 * scale, fill, stroke, z + 0.18, 'foot'),
    formDummyLimb(common, `${role}:right-foot`, points.rightAnkle, points.rightFoot, 8 * scale, fill, stroke, z + 0.19, 'foot'),
  ].map((item) => ({
    ...item,
    formDummyJointsStick: true,
    gestureBasedDummy: Boolean(mark.gesture),
    formDummyAnchorMap: Object.fromEntries(Object.entries(points).map(([key, point]) => [key, [roundPoint(point[0]), roundPoint(point[1])]])),
  }));
}

function fullBodyDummyPoints(mark, scale) {
  const gesture = mark.gesture && typeof mark.gesture === 'object' && !Array.isArray(mark.gesture)
    ? mark.gesture
    : null;
  if (gesture && Array.isArray(gesture.points) && gesture.points.length >= 2) {
    return gestureFullBodyDummyPoints(mark, gesture, scale);
  }
  const anchor = validPoint(mark.anchor) || [finiteOr(mark.cx, 220), finiteOr(mark.cy, 250)];
  const cx = anchor[0];
  const cy = anchor[1];
  const shoulderSpread = finiteOr(mark.shoulderSpread, 42 * scale);
  const hipSpread = finiteOr(mark.hipSpread, 30 * scale);
  const kneeSpread = finiteOr(mark.kneeSpread, 24 * scale);
  const ankleSpread = finiteOr(mark.ankleSpread, 22 * scale);
  const shoulderY = cy - 54 * scale;
  const pelvisY = cy + 44 * scale;
  const elbowY = cy - 8 * scale;
  const wristY = cy + 38 * scale;
  const kneeY = pelvisY + finiteOr(mark.upperLegLength, 68 * scale);
  const ankleY = kneeY + finiteOr(mark.lowerLegLength, 72 * scale);
  const footDrop = finiteOr(mark.footDrop, 13 * scale);
  const footOut = finiteOr(mark.footOut, 17 * scale);
  return {
    head: [cx, cy - 106 * scale],
    neck: [cx, cy - 74 * scale],
    torso: [cx, cy - 20 * scale],
    pelvis: [cx, pelvisY],
    leftShoulder: [cx - shoulderSpread, shoulderY],
    rightShoulder: [cx + shoulderSpread, shoulderY],
    leftElbow: [cx - shoulderSpread - 18 * scale, elbowY],
    rightElbow: [cx + shoulderSpread + 18 * scale, elbowY],
    leftWrist: [cx - shoulderSpread - 8 * scale, wristY],
    rightWrist: [cx + shoulderSpread + 8 * scale, wristY],
    leftHip: [cx - hipSpread, pelvisY + 8 * scale],
    rightHip: [cx + hipSpread, pelvisY + 8 * scale],
    leftKnee: [cx - kneeSpread, kneeY],
    rightKnee: [cx + kneeSpread, kneeY],
    leftAnkle: [cx - ankleSpread, ankleY],
    rightAnkle: [cx + ankleSpread, ankleY],
    leftFoot: [cx - ankleSpread - footOut, ankleY + footDrop],
    rightFoot: [cx + ankleSpread + footOut, ankleY + footDrop],
  };
}

function gestureFullBodyDummyPoints(mark, gesture, scale) {
  const side = String(gesture.activeSide || mark.activeSide || 'right').toLowerCase();
  const shoulderSpread = finiteOr(mark.shoulderSpread, 38 * scale);
  const hipSpread = finiteOr(mark.hipSpread, 28 * scale);
  const kneeSpread = finiteOr(mark.kneeSpread, 22 * scale);
  const ankleSpread = finiteOr(mark.ankleSpread, 20 * scale);
  const upperLegLength = finiteOr(mark.upperLegLength, 68 * scale);
  const lowerLegLength = finiteOr(mark.lowerLegLength, 72 * scale);
  const footDrop = finiteOr(mark.footDrop, 12 * scale);
  const footOut = finiteOr(mark.footOut, 15 * scale);
  const body = (t, offset = [0, 0]) => offsetGestureSample(sampleGesture(gesture.points, t), { offset }).point;
  const pelvisSample = sampleGesture(gesture.points, 0.74);
  const legTangent = normalize(pelvisSample.tangent || [0, 1]);
  const legNormal = [-legTangent[1], legTangent[0]];
  const legPoint = (along, lateral) => [
    pelvisSample.point[0] + legTangent[0] * along + legNormal[0] * lateral,
    pelvisSample.point[1] + legTangent[1] * along + legNormal[1] * lateral,
  ];
  const points = {
    head: body(0.04),
    neck: body(0.18),
    torso: body(0.42),
    pelvis: body(0.72),
    leftShoulder: body(0.31, [-shoulderSpread, 0]),
    rightShoulder: body(0.31, [shoulderSpread, 0]),
    leftHip: legPoint(4 * scale, -hipSpread),
    rightHip: legPoint(4 * scale, hipSpread),
    leftKnee: legPoint(upperLegLength, -kneeSpread),
    rightKnee: legPoint(upperLegLength, kneeSpread),
    leftAnkle: legPoint(upperLegLength + lowerLegLength, -ankleSpread),
    rightAnkle: legPoint(upperLegLength + lowerLegLength, ankleSpread),
    leftFoot: legPoint(upperLegLength + lowerLegLength + footDrop, -ankleSpread - footOut),
    rightFoot: legPoint(upperLegLength + lowerLegLength + footDrop, ankleSpread + footOut),
  };
  const leftAxis = mark.leftArmGesture || gesture.leftArm || (side === 'left' ? gesture.crossGesture || gesture.cross : null);
  const rightAxis = mark.rightArmGesture || gesture.rightArm || (side !== 'left' ? gesture.crossGesture || gesture.cross : null);
  assignArmGesturePoints(points, 'left', leftAxis, points.leftShoulder, scale, -1);
  assignArmGesturePoints(points, 'right', rightAxis, points.rightShoulder, scale, 1);
  return points;
}

function assignArmGesturePoints(points, side, axis, shoulder, scale, direction) {
  const elbowKey = `${side}Elbow`;
  const wristKey = `${side}Wrist`;
  if (axis && Array.isArray(axis.points) && axis.points.length >= 2) {
    if (axis.attachShoulder === true) {
      points[`${side}Shoulder`] = sampleGesture(axis.points, 0.05).point;
    }
    points[elbowKey] = sampleGesture(axis.points, 0.52).point;
    points[wristKey] = sampleGesture(axis.points, 0.94).point;
    return;
  }
  points[elbowKey] = [shoulder[0] + direction * 18 * scale, shoulder[1] + 48 * scale];
  points[wristKey] = [shoulder[0] + direction * 10 * scale, shoulder[1] + 94 * scale];
}

function dummyRotation(from, to) {
  return rotationFromTangent(normalize([to[0] - from[0], to[1] - from[1]]));
}

function formDummyHead(common, role, point, rx, ry, fill, stroke, z) {
  return {
    ...common,
    kind: 'egg',
    role,
    anchor: [roundPoint(point[0]), roundPoint(point[1])],
    rx,
    ry,
    fill,
    stroke,
    z,
    formPart: 'head',
  };
}

function formDummyCore(common, role, point, rx, ry, rotation, fill, stroke, z, part) {
  return {
    ...common,
    kind: 'blob',
    role,
    anchor: [roundPoint(point[0]), roundPoint(point[1])],
    rx,
    ry,
    rotation,
    fill,
    stroke,
    z,
    formPart: part || 'core',
  };
}

function formDummyJoint(common, role, point, r, fill, stroke, z, connects) {
  return {
    ...common,
    kind: 'sphere',
    role,
    anchor: [roundPoint(point[0]), roundPoint(point[1])],
    r,
    fill: shadeHex(fill, 1.04),
    stroke,
    z,
    formPart: 'joint',
    jointVisible: true,
    jointPlacement: 'between-segments',
    terminatesIntoJoints: true,
    jointMediated: true,
    jointConnects: connects,
  };
}

function formDummyLimb(common, role, from, to, thickness, fill, stroke, z, part = 'limb') {
  const midpoint = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const length = Math.max(Math.hypot(to[0] - from[0], to[1] - from[1]), 1);
  const tangent = normalize([to[0] - from[0], to[1] - from[1]]);
  return {
    ...common,
    kind: 'blob',
    role,
    anchor: [roundPoint(midpoint[0]), roundPoint(midpoint[1])],
    rx: thickness,
    ry: length / 2,
    rotation: rotationFromTangent(tangent),
    fill,
    stroke,
    z,
    formPart: part,
    terminatesIntoJoints: true,
    jointMediated: true,
  };
}

function formPrimitiveCommon(mark, role, mode, stock) {
  return {
    constructionKind: 'form',
    constructionRole: role,
    formPrimitiveRole: role,
    formPrimitiveMode: mode,
    formPrimitiveStock: stock,
    formMassTuning: mark.massTuning,
    speciesStock: mark.speciesStock,
  };
}

function formMassProfile(value) {
  const key = String(value || 'fit').toLowerCase();
  const profiles = {
    lean: { torsoWidth: 54, hipWidth: 42, headScale: 0.95 },
    fit: { torsoWidth: 66, hipWidth: 50, headScale: 1 },
    stocky: { torsoWidth: 82, hipWidth: 66, headScale: 1.04 },
    soft: { torsoWidth: 88, hipWidth: 74, headScale: 1.05 },
    'slightly-obese': { torsoWidth: 98, hipWidth: 86, headScale: 1.06 },
  };
  return profiles[key] || profiles.fit;
}

function formLimbBlob(common, role, cx, cy, rx, ry, rotation, fill, stroke, z, part) {
  return {
    ...common,
    kind: 'blob',
    role,
    anchor: [roundPoint(cx), roundPoint(cy)],
    rx,
    ry,
    rotation,
    fill,
    stroke,
    z,
    formPart: part,
  };
}

function formJointSphere(common, role, cx, cy, r, fill, stroke, z) {
  return {
    ...common,
    kind: 'sphere',
    role,
    anchor: [roundPoint(cx), roundPoint(cy)],
    r,
    fill: shadeHex(fill, 1.04),
    stroke,
    z,
    formPart: 'joint',
    jointVisible: true,
  };
}

function expandCubieLatticeMark(mark, scene = {}, manifest = {}) {
  const cols = Math.max(1, Math.min(9, Math.round(finiteOr(mark.cols, 3))));
  const rows = Math.max(1, Math.min(9, Math.round(finiteOr(mark.rows, 3))));
  const layers = Math.max(1, Math.min(9, Math.round(finiteOr(mark.layers, finiteOr(mark.depthCount, 3)))));
  const cellSize = Math.max(finiteOr(mark.cellSize, finiteOr(mark.size, 48)), 2);
  const gap = Math.max(finiteOr(mark.gap, cellSize * 0.18), 0);
  const role = mark.role || 'cubie-lattice';
  const mandala = manifest?.polygonizer?.pureMandala;
  const mandalaBlock = findMandalaBlock(mandala, mark.mandalaRole || mark.role);
  const projectedBlock = mandalaBlock ? projectMandalaBlock(mandala, mandalaBlock) : null;
  const anchor = projectedBlock?.anchor || validPoint(mark.anchor) || [finiteOr(mark.x, 0), finiteOr(mark.y, 0)];
  const step = cellSize + gap;
  const depthStep = Math.max(finiteOr(mark.depthStep, step * 0.62), 1);
  const pureMandalaMode = Boolean(projectedBlock);
  const floorMode = mark.depthMode === 'floor-plane' || pureMandalaMode;
  const layerLift = finiteOr(mark.layerLift, -step * 0.42);
  const layerShift = finiteOr(mark.layerShift, step * 0.56);
  const startX = anchor[0] - ((cols - 1) * step) / 2;
  const startY = anchor[1] - ((rows - 1) * step) / 2;
  const count = cols * rows * layers;
  const palette = Array.isArray(mark.palette) && mark.palette.length ? mark.palette : null;
  const out = [];
  let index = 0;

  for (let layer = layers - 1; layer >= 0; layer--) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        index += 1;
        const basis = pureMandalaMode
          ? pureMandalaCubieBasis({ mark, mandala, mandalaBlock, col, row, layer, cols, rows, layers, cellSize, gap })
          : floorMode
          ? floorCubieBasis({ mark, scene, anchor, layer, layers, step, cellSize })
          : {
              layerOffsetX: layerShift * layer,
              layerOffsetY: layerLift * layer,
              scale: 1,
              floorT: layers <= 1 ? 0 : layer / (layers - 1),
            };
        const scaledCell = Math.max(cellSize * basis.scale, 1);
        const x = pureMandalaMode ? basis.x : startX + col * step * basis.scale + basis.layerOffsetX;
        const y = pureMandalaMode ? basis.y : startY + row * step * basis.scale + basis.layerOffsetY;
        const depth = Math.max(finiteOr(mark.depth, cellSize * 0.78) * basis.scale, 1);
        const cubieRole = `${role}-cubie-c${col + 1}r${row + 1}l${layer + 1}`;
        out.push({
          kind: 'solid',
          role: cubieRole,
          x: roundPoint(x),
          y: roundPoint(y),
          width: scaledCell,
          height: scaledCell,
          depth,
          fill: palette ? palette[(col + row + layer) % palette.length] : mark.fill || '#b1845e',
          stroke: mark.stroke || '#4f3928',
          strokeWidth: finiteOr(mark.strokeWidth, 0.8),
          z: finiteOr(mark.z, 20) + layer * 0.7 + row * 0.08 + col * 0.02,
          constructionKind: 'cubieLattice',
          constructionRole: role,
          cubieLatticeRole: role,
          cubieIndex: index - 1,
          cubieCol: col,
          cubieRow: row,
          cubieLayer: layer,
          cubieCount: count,
          cubieCols: cols,
          cubieRows: rows,
          cubieLayers: layers,
          cubieGap: gap,
          cubieCellSize: scaledCell,
          cubieDepthMode: pureMandalaMode ? 'pure-mandala' : floorMode ? 'floor-plane' : 'offset',
          cubieFloorT: round(basis.floorT),
          cubiePerspectiveScale: round(basis.scale),
          cubieWorldXYZ: basis.worldXYZ,
        });
      }
    }
  }
  return out;
}

function pureMandalaCubieBasis({ mark, mandala, mandalaBlock, col, row, layer, cols, rows, layers, cellSize, gap }) {
  const worldXY = validPoint(mandalaBlock.worldXY) || [0, 0];
  const altitude = finiteOr(mandalaBlock.altitude, 0);
  const unitCellSize = Math.max(finiteOr(mark.unitCellSize, 1), 0.001);
  const unitGap = Math.max(finiteOr(mark.unitGap, 0), 0);
  const worldPitch = unitCellSize + unitGap;
  const worldStepX = finiteOr(mark.unitStepX, worldPitch);
  const worldStepY = finiteOr(mark.unitStepY, worldPitch);
  const worldStepZ = finiteOr(mark.unitStepZ, worldPitch);
  const x = worldXY[0] + (col - (cols - 1) / 2) * worldStepX;
  const y = worldXY[1] + ((rows - 1) / 2 - row) * worldStepY;
  const z = altitude + unitCellSize / 2 + layer * worldStepZ;
  const screen = projectMandalaPoint(mandala, { x, y, altitude: z });
  const floorT = layers <= 1 ? 0 : layer / (layers - 1);
  const depthScale = clamp(finiteOr(mandala.camera?.depthScale, 0.84), 0.2, 1);
  const scale = Math.pow(depthScale, Math.max(0, -y));
  return {
    x: screen[0] - (cellSize * scale) / 2,
    y: screen[1] - (cellSize * scale) / 2,
    scale,
    floorT,
    worldXYZ: [round(x), round(y), round(z)],
  };
}

function floorCubieBasis({ mark, scene, anchor, layer, layers, step, cellSize }) {
  const vp = validPoint(mark.vanishingPoint) ||
    validPoint(scene.perspective?.vanishingPoint) ||
    [anchor[0], finiteOr(scene.perspective?.horizonY, anchor[1] - step * 3)];
  const floorT = layers <= 1 ? 0 : layer / (layers - 1);
  const maxDepth = finiteOr(mark.floorDepth, step * 2.35);
  const toVp = normalize([vp[0] - anchor[0], vp[1] - anchor[1]]);
  const distance = maxDepth * floorT;
  const perspectiveDepth = Math.max(finiteOr(scene.perspective?.depthScale, 260), 1);
  const scale = perspectiveDepth / (perspectiveDepth + distance * 0.8);
  const lateralCompensation = ((1 - scale) * (cellSize + step)) / 2;
  return {
    layerOffsetX: toVp[0] * distance + lateralCompensation,
    layerOffsetY: toVp[1] * distance,
    scale,
    floorT,
  };
}

function rememberRole(mark, byRole) {
  if (mark && typeof mark.role === 'string' && mark.role) {
    byRole.set(mark.role, mark);
  }
}

function expandPartitionMark(mark, byRole) {
  const target = byRole.get(mark.target);
  if (!target) {
    throw new Error(`partition '${mark.role || '(anonymous)'}' target '${mark.target || '(missing)'}' was not found`);
  }
  if (mark.axis !== undefined && mark.axis !== 'y') {
    throw new Error(`partition '${mark.role || '(anonymous)'}' only supports axis:'y' in this spike`);
  }
  const count = Math.max(1, Math.min(12, Math.round(finiteOr(mark.count, 1))));
  const x = finiteOr(target.x, finiteOr(target.anchor?.[0], 0));
  const y = finiteOr(target.y, finiteOr(target.anchor?.[1], 0));
  const width = Math.max(finiteOr(target.width, finiteOr(target.w, 80)), 1);
  const height = Math.max(finiteOr(target.height, finiteOr(target.h, 80)), 1);
  const depth = Math.max(finiteOr(target.depth, finiteOr(target.d, 40)), 1);
  const thickness = Math.max(finiteOr(mark.thickness, finiteOr(target.boardThickness, height * 0.045)), 3);
  const role = mark.role || 'partition';
  const fill = mark.fill || target.partitionFill || target.fill || '#b1845e';
  const stroke = mark.stroke || target.stroke || '#4f3928';
  const out = [];

  for (let i = 0; i <= count; i++) {
    const rawY = y + (height * i) / count;
    const boardY = i === count ? rawY - thickness : rawY;
    out.push({
      kind: 'solid',
      role: `${role}-board-${i + 1}`,
      x,
      y: boardY,
      width,
      height: thickness,
      depth,
      fill,
      stroke,
      strokeWidth: mark.strokeWidth ?? target.strokeWidth,
      z: finiteOr(mark.z, finiteOr(target.z, 10) + 0.04 + i * 0.01),
      constructionKind: 'partition',
      constructionRole: role,
      partitionTarget: mark.target,
      partitionAxis: 'y',
      partitionCount: count,
      partitionBoardIndex: i,
      partitionBoundary: i === 0 ? 'start' : i === count ? 'end' : 'internal',
    });
  }
  return out;
}

function expandArrayMark(mark) {
  const from = validPoint(mark.from);
  const to = validPoint(mark.to);
  if (!from || !to) {
    throw new Error(`array '${mark.role || '(anonymous)'}' requires from:[x,y] and to:[x,y]`);
  }
  const item = mark.item && typeof mark.item === 'object' ? mark.item : {};
  const count = Math.max(1, Math.min(120, Math.round(finiteOr(mark.count, 1))));
  const role = mark.role || 'array';
  const out = [];
  const upperFrom = validPoint(mark.upperFrom || item.upperFrom);
  const upperTo = validPoint(mark.upperTo || item.upperTo);

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const p = lerpPoint(from, to, t);
    const scale = lerp(
      finiteOr(mark.scaleFrom, finiteOr(item.scaleFrom, 1)),
      finiteOr(mark.scaleTo, finiteOr(item.scaleTo, 1)),
      t,
    );
    if (item.kind === 'solid') {
      out.push({
        ...item,
        kind: 'solid',
        role: `${role}-${i + 1}`,
        x: roundPoint(p[0] - finiteOr(item.width, finiteOr(item.w, 12)) / 2),
        y: roundPoint(p[1] - finiteOr(item.height, finiteOr(item.h, 40))),
        width: Math.max(finiteOr(item.width, finiteOr(item.w, 12)) * scale, 1),
        height: Math.max(finiteOr(item.height, finiteOr(item.h, 40)) * scale, 1),
        depth: Math.max(finiteOr(item.depth, finiteOr(item.d, 10)) * scale, 1),
        constructionKind: 'array',
        constructionRole: role,
        arrayIndex: i,
        arrayCount: count,
      });
      continue;
    }

    const q = upperFrom && upperTo
      ? lerpPoint(upperFrom, upperTo, t)
      : [p[0], p[1] - Math.max(finiteOr(item.length, 40) * scale, 1)];
    out.push({
      ...item,
      kind: 'line',
      role: `${role}-${i + 1}`,
      x1: roundPoint(q[0]),
      y1: roundPoint(q[1]),
      x2: roundPoint(p[0]),
      y2: roundPoint(p[1]),
      stroke: item.stroke || mark.stroke || '#d46f42',
      strokeWidth: finiteOr(item.strokeWidth, finiteOr(mark.strokeWidth, 2)),
      opacity: item.opacity ?? mark.opacity,
      z: finiteOr(item.z, finiteOr(mark.z, 20) + i * 0.001),
      constructionKind: 'array',
      constructionRole: role,
      arrayIndex: i,
      arrayCount: count,
      arrayT: round(t),
    });
  }
  return out;
}

function expandMandalaFieldMark(mark, manifest = {}) {
  const field = mark.field && typeof mark.field === 'object' && !Array.isArray(mark.field)
    ? mark.field
    : mark;
  const paths = Array.isArray(field.paths)
    ? field.paths
    : Array.isArray(mark.paths) ? mark.paths : [];
  if (!paths.length) {
    throw new Error(`mandalaField '${mark.role || '(anonymous)'}' requires paths`);
  }
  const role = mark.role || 'mandala-field';
  const viewBox = mark.viewBox && typeof mark.viewBox === 'object'
    ? mark.viewBox
    : manifest.viewBox && typeof manifest.viewBox === 'object' ? manifest.viewBox : {};
  const camera = {
    screenOrigin: validPoint(field.screenOrigin || mark.screenOrigin) || [finiteOr(viewBox.width, 800) / 2, finiteOr(viewBox.height, 520) * 0.74],
    east: validPoint(field.east || mark.east) || [1, 0],
    north: validPoint(field.north || mark.north) || [0, -1],
    zenith: validPoint(field.zenith || mark.zenith) || [0, -1],
    unitScale: finiteOr(field.unitScale ?? mark.unitScale, 24),
    depthScale: clamp(finiteOr(field.depthScale ?? mark.depthScale, 0.94), 0.2, 1),
  };
  const out = [];
  paths.forEach((path, pathIndex) => {
    const samples = mandalaPathSamples(path, pathIndex, manifest, mark);
    out.push(...mandalaDebugInsetMarks({ mark, field, path, pathIndex, role, samples }));
    samples.forEach((sample, sampleIndex) => {
      out.push(...mandalaSpawnMarks({
        mark,
        path,
        role,
        pathIndex,
        sample,
        sampleIndex,
        camera,
        manifest,
      }));
    });
  });
  return out;
}

function mandalaDebugInsetMarks({ mark, field, path, pathIndex, role, samples }) {
  const inset = path.debugInset || field.debugInset || mark.debugInset;
  if (!inset || inset.visible === false || !Array.isArray(samples) || samples.length === 0) return [];
  const origin = validPoint(inset.origin) || [70, 64 + pathIndex * 74];
  const scale = finiteOr(inset.scale, 5);
  const stroke = inset.stroke || '#6d5945';
  const fill = inset.fill || '#c94f32';
  const opacity = inset.opacity ?? 0.72;
  const z = finiteOr(inset.z, 940 + pathIndex * 0.1);
  const points = samples.map((sample) => [
    roundPoint(origin[0] + finiteOr(sample.point?.[0], 0) * scale),
    roundPoint(origin[1] + finiteOr(sample.point?.[1], 0) * scale),
  ]);
  const out = [{
    kind: 'polyline',
    role: `mandala-debug:${role}:${path.role || pathIndex + 1}:path`,
    points,
    stroke,
    strokeWidth: finiteOr(inset.strokeWidth, 1),
    fill: 'none',
    opacity,
    z,
    constructionKind: 'mandalaField',
    constructionRole: role,
    mandalaDebugInset: true,
    mandalaFieldRole: role,
    mandalaPathRole: path.role || `path-${pathIndex + 1}`,
  }];
  samples.forEach((sample, index) => {
    out.push({
      kind: 'circle',
      role: `mandala-debug:${role}:${path.role || pathIndex + 1}:sample-${index + 1}`,
      cx: points[index][0],
      cy: points[index][1],
      r: finiteOr(inset.r, 2.5),
      fill,
      stroke: inset.pointStroke || '#ffffff',
      strokeWidth: 0.5,
      opacity,
      z: z + 0.01 + index * 0.001,
      constructionKind: 'mandalaField',
      constructionRole: role,
      mandalaDebugInset: true,
      mandalaFieldRole: role,
      mandalaPathRole: path.role || `path-${pathIndex + 1}`,
      mandalaSampleIndex: index,
      mandalaWorldXY: sample.point.map(roundPoint),
    });
  });
  if (inset.label !== false) {
    out.push({
      kind: 'text',
      role: `mandala-debug:${role}:${path.role || pathIndex + 1}:label`,
      x: origin[0],
      y: origin[1] - 9,
      value: inset.label || `${path.role || role} z=0`,
      size: finiteOr(inset.labelSize, 10),
      anchor: 'start',
      color: inset.labelColor || '#4a3d31',
      opacity: inset.labelOpacity ?? 0.82,
      z: z + 0.04,
      mandalaDebugInset: true,
      mandalaFieldRole: role,
      mandalaPathRole: path.role || `path-${pathIndex + 1}`,
    });
  }
  return out;
}

function mandalaPathSamples(path = {}, pathIndex = 0, manifest = {}, mark = {}) {
  const basis = path.basis || path.kind || 'ray';
  const pinTargets = mandalaPinTargets(path, manifest, mark);
  const count = Math.max(1, Math.min(240, Math.round(finiteOr(path.samples ?? path.count, pinTargets.length || 8))));
  if (basis === 'lattice' || basis === 'grid') return mandalaLatticeSamples(path, count);
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    let point;
    let tangent;
    if (basis === 'arc') {
      const center = validPoint(path.center) || [0, 0];
      const radius = Math.max(finiteOr(path.radius, 5), 0.001);
      const start = finiteOr(path.startAngle, finiteOr(path.start, 0));
      const end = finiteOr(path.endAngle, finiteOr(path.end, Math.PI));
      const a = start + (end - start) * t;
      point = [center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius];
      tangent = normalize([-Math.sin(a), Math.cos(a)]);
    } else if (basis === 'spiral') {
      const center = validPoint(path.center) || [0, 0];
      const turns = finiteOr(path.turns, 1.5);
      const radius0 = finiteOr(path.radiusStart ?? path.innerRadius, 1);
      const radius1 = finiteOr(path.radiusEnd ?? path.outerRadius, 8);
      const a = finiteOr(path.startAngle, 0) + turns * Math.PI * 2 * t;
      const r = lerp(radius0, radius1, t);
      point = [center[0] + Math.cos(a) * r, center[1] + Math.sin(a) * r];
      tangent = normalize([-Math.sin(a), Math.cos(a)]);
    } else {
      const from = validPoint(path.from) || [0, 0];
      const to = validPoint(path.to) || [0, -8];
      point = lerpPoint(from, to, t);
      tangent = normalize([to[0] - from[0], to[1] - from[1]]);
    }
    const normal = [-tangent[1], tangent[0]];
    out.push(mandalaSampleWithSpread({ path, point, tangent, normal, t, index: i, count, pathIndex, pinTarget: pinTargets[i] }));
  }
  return out;
}

function mandalaLatticeSamples(path, countFallback) {
  const cols = Math.max(1, Math.min(40, Math.round(finiteOr(path.cols ?? path.columns, Math.sqrt(countFallback)))));
  const rows = Math.max(1, Math.min(40, Math.round(finiteOr(path.rows, Math.ceil(countFallback / cols)))));
  const origin = validPoint(path.origin || path.from) || [0, 0];
  const step = validPoint(path.step) || [finiteOr(path.stepX, 2), finiteOr(path.stepY, -2)];
  const rowStep = validPoint(path.rowStep) || [finiteOr(path.rowStepX, 0), finiteOr(path.rowStepY, -2)];
  const out = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const point = [
        origin[0] + step[0] * col + rowStep[0] * row,
        origin[1] + step[1] * col + rowStep[1] * row,
      ];
      const t = rows <= 1 ? 0.5 : row / (rows - 1);
      out.push({
        point,
        tangent: normalize(step),
        normal: normalize([-step[1], step[0]]),
        t,
        index,
        count: cols * rows,
        col,
        row,
        scale: mandalaScaleAt(path, t, index),
        variation: mandalaVariation(path, t, index),
      });
    }
  }
  return out;
}

function mandalaSampleWithSpread({ path, point, tangent, normal, t, index, count, pathIndex, pinTarget = null }) {
  let next = point;
  const spread = path.spread;
  if (spread && typeof spread === 'object' && !Array.isArray(spread)) {
    const span = Array.isArray(spread.x) ? spread.x : [-finiteOr(spread.amount, 0), finiteOr(spread.amount, 0)];
    const lanes = Math.max(1, Math.round(finiteOr(spread.lanes, count)));
    const laneT = lanes <= 1 ? 0.5 : (index % lanes) / (lanes - 1);
    const offset = spread.mode === 'paired'
      ? (index % 2 === 0 ? finiteOr(span[0], 0) : finiteOr(span[1], 0))
      : lerp(finiteOr(span[0], 0), finiteOr(span[1], 0), laneT);
    next = [point[0] + normal[0] * offset, point[1] + normal[1] * offset];
  }
  return {
    point: next,
    tangent,
    normal,
    t,
    index,
    count,
    pinTarget,
    scale: mandalaScaleAt(path, t, index),
    variation: mandalaVariation(path, t, index + pathIndex * 97),
  };
}

function mandalaScaleAt(path, t, index) {
  const from = finiteOr(path.scaleFrom, finiteOr(path.scale, 1));
  const to = finiteOr(path.scaleTo, from);
  const base = lerp(from, to, t);
  const wobble = finiteOr(path.scaleWobble, 0);
  return Math.max(base + Math.sin(index * 2.399) * wobble, 0.05);
}

function mandalaVariation(path, t, index) {
  const heightRange = Array.isArray(path.heightRange) ? path.heightRange : null;
  const widthRange = Array.isArray(path.widthRange) ? path.widthRange : null;
  const depthRange = Array.isArray(path.depthRange) ? path.depthRange : null;
  return {
    height: heightRange ? lerp(finiteOr(heightRange[0], 1), finiteOr(heightRange[1], 1), pseudoWave(t, index)) : undefined,
    width: widthRange ? lerp(finiteOr(widthRange[0], 1), finiteOr(widthRange[1], 1), pseudoWave(t, index + 11)) : undefined,
    depth: depthRange ? lerp(finiteOr(depthRange[0], 1), finiteOr(depthRange[1], 1), pseudoWave(t, index + 23)) : undefined,
  };
}

function pseudoWave(t, index) {
  return clamp(0.5 + Math.sin(t * Math.PI * 2 + index * 1.618) * 0.5, 0, 1);
}

function mandalaSpawnMarks({ mark, path, role, pathIndex, sample, sampleIndex, camera, manifest = {} }) {
  const template = path.spawn || mark.spawn || {};
  const kind = template.kind || 'solid';
  const pin = resolveMandalaPin({ mark, path, sample, sampleIndex, manifest });
  const screen = pin?.screen || projectMandalaScreen(camera, sample.point, finiteOr(template.altitude ?? template.z, 0));
  const scale = sample.scale;
  const spawnRole = `${path.role || `${role}-path-${pathIndex + 1}`}-${sampleIndex + 1}`;
  const common = {
    ...template,
    role: template.role ? `${template.role}-${sampleIndex + 1}` : spawnRole,
    mandalaFieldRole: role,
    mandalaPathRole: path.role || `path-${pathIndex + 1}`,
    mandalaSampleIndex: sampleIndex,
    mandalaSampleCount: sample.count,
    mandalaWorldXY: sample.point.map(roundPoint),
    mandalaT: round(sample.t),
    mandalaScale: round(scale),
    mandalaPinned: Boolean(pin),
    mandalaPinRole: pin?.role,
    mandalaPinBounds: pin?.bounds,
    mandalaPinAnchor: pin?.anchor,
    mandalaPinMode: pin?.mode,
    z: finiteOr(template.z, finiteOr(mark.z, 20) + pathIndex + sampleIndex * 0.01),
  };
  if (kind === 'solid') {
    const boundSize = mandalaPinnedSolidSize(pin, template);
    const w = finiteOr(boundSize?.width, finiteOr(sample.variation.width, finiteOr(template.width ?? template.w, 18)) * scale);
    const h = finiteOr(boundSize?.height, finiteOr(sample.variation.height, finiteOr(template.height ?? template.h, 52)) * scale);
    const d = finiteOr(boundSize?.depth, finiteOr(sample.variation.depth, finiteOr(template.depth ?? template.d, 18)) * scale);
    return [{
      ...common,
      kind: 'solid',
      x: roundPoint(screen[0] - w / 2),
      y: roundPoint(screen[1] - h),
      width: Math.max(roundPoint(w), 1),
      height: Math.max(roundPoint(h), 1),
      depth: Math.max(roundPoint(d), 1),
      constructionKind: 'mandalaField',
      constructionRole: role,
    }];
  }
  if (kind === 'blob' || kind === 'sphere' || kind === 'oval') {
    return [{
      ...common,
      kind,
      anchor: screen.map(roundPoint),
      rx: Math.max(finiteOr(template.rx, finiteOr(template.r, 14)) * scale, 1),
      ry: Math.max(finiteOr(template.ry, finiteOr(template.r, 14)) * scale, 1),
      constructionKind: 'mandalaField',
      constructionRole: role,
    }];
  }
  if (kind === 'line') {
    const length = finiteOr(template.length, 40) * scale;
    const tangent = sample.tangent || [0, -1];
    return [{
      ...common,
      kind: 'line',
      x1: roundPoint(screen[0] - tangent[0] * length / 2),
      y1: roundPoint(screen[1] - tangent[1] * length / 2),
      x2: roundPoint(screen[0] + tangent[0] * length / 2),
      y2: roundPoint(screen[1] + tangent[1] * length / 2),
      constructionKind: 'mandalaField',
      constructionRole: role,
    }];
  }
  throw new Error(`mandalaField '${role}' unsupported spawn kind '${kind}'`);
}

function mandalaPinTargets(path = {}, manifest = {}, mark = {}) {
  const pin = path.pinTo || path.bindTo || mark.pinTo || mark.bindTo;
  if (!pin || typeof pin !== 'object' || Array.isArray(pin)) return [];
  const constellation = manifest?.polygonizer?.constellation;
  const nodes = Array.isArray(constellation?.nodes) ? constellation.nodes : [];
  if (!nodes.length) return [];
  const roles = Array.isArray(pin.roles) ? pin.roles.map(String) : [];
  if (roles.length) {
    const byRole = new Map(nodes.map((node) => [node?.role, node]));
    return roles.map((role) => byRole.get(role)).filter(Boolean);
  }
  const prefix = typeof pin.rolePrefix === 'string' ? pin.rolePrefix : null;
  const pattern = typeof pin.rolePattern === 'string' ? new RegExp(pin.rolePattern) : null;
  const depthBands = Array.isArray(pin.depthBands) ? new Set(pin.depthBands.map(String)) : null;
  return nodes.filter((node) => {
    if (!node?.role) return false;
    if (prefix && !String(node.role).startsWith(prefix)) return false;
    if (pattern && !pattern.test(String(node.role))) return false;
    if (depthBands && !depthBands.has(String(node.depthBand))) return false;
    return prefix || pattern || depthBands;
  });
}

function resolveMandalaPin({ mark, path, sample, sampleIndex, manifest }) {
  const pin = path.pinTo || path.bindTo || mark.pinTo || mark.bindTo;
  if (!pin || typeof pin !== 'object' || Array.isArray(pin)) return null;
  const targets = sample.pinTarget ? [sample.pinTarget] : mandalaPinTargets(path, manifest, mark);
  const node = targets[sample.pinTarget ? 0 : sampleIndex % Math.max(targets.length, 1)];
  if (!node) return null;
  const bounds = node.bounds && typeof node.bounds === 'object' ? node.bounds : null;
  const anchor = mandalaNodePinAnchor(node, pin.anchor || pin.anchorMode || 'bottom-center');
  if (!anchor) return null;
  return {
    role: node.role,
    bounds: bounds ? roundMandalaBounds(bounds) : undefined,
    anchor: anchor.map(roundPoint),
    screen: anchor.map(roundPoint),
    mode: pin.kind || pin.mode || 'constellation-node',
    node,
    pin,
  };
}

function mandalaNodePinAnchor(node, mode) {
  const bounds = node?.bounds;
  if (!bounds || !Number.isFinite(Number(bounds.x)) || !Number.isFinite(Number(bounds.y))) {
    return validPoint(node?.anchor) || validPoint(node?.cca?.center);
  }
  const x = finiteOr(bounds.x, 0);
  const y = finiteOr(bounds.y, 0);
  const w = finiteOr(bounds.width, 0);
  const h = finiteOr(bounds.height, 0);
  if (mode === 'center') return [x + w / 2, y + h / 2];
  if (mode === 'top-center') return [x + w / 2, y];
  if (mode === 'anchor') return validPoint(node.anchor) || [x + w / 2, y + h];
  return [x + w / 2, y + h];
}

function roundMandalaBounds(bounds) {
  return {
    x: roundPoint(bounds.x),
    y: roundPoint(bounds.y),
    width: roundPoint(bounds.width),
    height: roundPoint(bounds.height),
  };
}

function mandalaPinnedSolidSize(pin, template) {
  const bounds = pin?.bounds;
  const mode = pin?.pin?.fit || pin?.pin?.sizeMode || template.fit || template.sizeMode;
  if (!bounds || (mode !== 'bounds' && mode !== 'constellation-bounds' && mode !== 'cell')) return null;
  const widthRatio = finiteOr(template.widthRatio ?? pin.pin?.widthRatio, 0.72);
  const heightRatio = finiteOr(template.heightRatio ?? pin.pin?.heightRatio, 0.78);
  const depthRatio = finiteOr(template.depthRatio ?? pin.pin?.depthRatio, 0.34);
  return {
    width: Math.max(roundPoint(bounds.width * widthRatio), 1),
    height: Math.max(roundPoint(bounds.height * heightRatio), 1),
    depth: Math.max(roundPoint(Math.min(bounds.width, bounds.height) * depthRatio), 1),
  };
}

function projectMandalaScreen(camera, point, altitude = 0) {
  const east = normalize(validPoint(camera.east) || [1, 0]);
  const north = normalize(validPoint(camera.north) || [0, -1]);
  const zenith = normalize(validPoint(camera.zenith) || [0, -1]);
  const unitScale = finiteOr(camera.unitScale, 24);
  const depthScale = clamp(finiteOr(camera.depthScale, 0.94), 0.2, 1);
  const x = finiteOr(point?.[0], 0);
  const y = finiteOr(point?.[1], 0);
  const compression = Math.pow(depthScale, Math.max(0, -y));
  return [
    roundPoint(camera.screenOrigin[0] + east[0] * x * unitScale + north[0] * y * unitScale * compression + zenith[0] * altitude * unitScale),
    roundPoint(camera.screenOrigin[1] + east[1] * x * unitScale + north[1] * y * unitScale * compression + zenith[1] * altitude * unitScale),
  ];
}

function expandStickerFieldMark(mark, byRole) {
  const field = mark.field && typeof mark.field === 'object' ? mark.field : {};
  const die = mark.die && typeof mark.die === 'object' ? mark.die : {};
  const family = die.family || die.kind;
  if (
    (field.kind !== 'aroundRing' || (family !== 'arcPatch' && family !== 'line' && family !== 'spikeBanana' && family !== 'fuzzyPeach')) &&
    (field.kind !== 'alongPath' || family !== 'line')
  ) {
    throw new Error(
      `stickerField '${mark.role || '(anonymous)'}' only supports aroundRing/arcPatch, aroundRing/line, aroundRing/spikeBanana, aroundRing/fuzzyPeach, or alongPath/line in this spike`,
    );
  }
  if (field.kind === 'alongPath') {
    return expandAlongPathLineField(mark, field, die);
  }
  if (family === 'fuzzyPeach') {
    return expandAroundRingFuzzyPeachField(mark, field, die, byRole);
  }
  if (family === 'spikeBanana') {
    return expandAroundRingSpikeBananaField(mark, field, die, byRole);
  }
  return family === 'line'
    ? expandAroundRingLineField(mark, field, die, byRole)
    : expandAroundRingArcPatchField(mark, field, die, byRole);
}

function expandAroundRingArcPatchField(mark, field, die, byRole) {
  const basis = aroundRingBasis(mark, field, byRole);
  const { center, innerRadius, outerRadius, count } = basis;
  const arcRange = normalizeRange(die.arc, 0.03, 0.1);
  const thicknessRange = normalizeRange(die.thickness, 6, Math.max(8, (outerRadius - innerRadius) * 0.45));
  const wobble = clamp(finiteOr(die.wobble, 0), 0, 0.8);
  const pointCount = Math.max(3, Math.min(18, Math.round(finiteOr(die.points, 6))));
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.72),
    expectedOverlapCount: Math.max(1, Math.min(count, Math.round(count / 6))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const seed = hashString(`${mark.role || 'stickerField'}:${count}:${center.join(',')}`);
  const out = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : (i + 0.5) / count;
    const wave = deterministicWave(seed, i, t);
    const angleFraction = wrap01(t + wave * wobble * 0.018);
    const angle = -Math.PI / 2 + angleFraction * Math.PI * 2;
    const bias = fieldBiasAt(field.bias, angleFraction);
    const arcFraction = lerp(arcRange[0], arcRange[1], wrap01(t * 1.618 + wave * 0.07));
    const arc = arcFraction * Math.PI * 2 * lerp(0.85, 1.15, bias.strength);
    const thickness = Math.min(
      outerRadius - innerRadius,
      lerp(thicknessRange[0], thicknessRange[1], wrap01(t * 2.414 - wave * 0.05)) * lerp(1, 1.28, bias.strength),
    );
    const midRadius = clamp(
      lerp(innerRadius + thickness / 2, outerRadius - thickness / 2, wrap01(t * 1.31 + wave * 0.11)),
      innerRadius + thickness / 2,
      outerRadius - thickness / 2,
    );
    const patchInner = Math.max(innerRadius, midRadius - thickness / 2);
    const patchOuter = Math.min(outerRadius, midRadius + thickness / 2);
    const start = angle - arc / 2;
    const end = angle + arc / 2;
    const fill = choosePaletteValue(mark.style?.palette || field.palette || die.palette, i) ||
      mark.fill ||
      die.fill ||
      '#f49a34';
    out.push({
      kind: 'polygon',
      closed: true,
      role: `${mark.role || 'sticker-field'}:${String(i + 1).padStart(2, '0')}`,
      points: annularPatchPoints(center, patchInner, patchOuter, start, end, pointCount),
      fill,
      stroke: mark.stroke || die.stroke || 'none',
      strokeWidth: finiteOr(mark.strokeWidth, finiteOr(die.strokeWidth, 0)),
      opacity,
      z: finiteOr(mark.z, 20) + i * 0.002,
      algorithmic: true,
      algorithm: 'pastamaker',
      pass: mark.pass || 'sticker-field',
      pastamaker: {
        dieFamily: 'arcPatch',
        fieldKind: 'aroundRing',
        budgetMode: budget.mode,
        targetOpacity: budget.targetOpacity,
        expectedOverlapCount: budget.expectedOverlapCount,
      },
      stickerFieldRole: mark.role,
      stickerFieldIndex: i,
      stickerFieldCount: count,
      stickerFieldT: round(t),
    });
  }

  return out;
}

function expandAroundRingLineField(mark, field, die, byRole) {
  const basis = aroundRingBasis(mark, field, byRole);
  const { center, innerRadius, outerRadius, count } = basis;
  const lengthRange = normalizeRange(die.length, 14, 44);
  const radialJitter = clamp(finiteOr(die.radialJitter, 0.18), 0, 1);
  const wobble = clamp(finiteOr(die.wobble, 0), 0, 0.8);
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.58),
    expectedOverlapCount: Math.max(1, Math.min(count, Math.round(count / 10))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const seed = hashString(`${mark.role || 'stickerField'}:line:${count}:${center.join(',')}`);
  const out = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : (i + 0.5) / count;
    const wave = deterministicWave(seed, i, t);
    const angleFraction = wrap01(t + wave * wobble * 0.018);
    const angle = -Math.PI / 2 + angleFraction * Math.PI * 2;
    const bias = fieldBiasAt(field.bias, angleFraction);
    const radiusT = wrap01(t * 1.79 + wave * radialJitter * 0.1);
    const radius = lerp(innerRadius, outerRadius, radiusT);
    const length = lerp(lengthRange[0], lengthRange[1], wrap01(t * 2.07 + wave * 0.05)) *
      lerp(1, 1.22, bias.strength);
    const tangent = normalize([-Math.sin(angle), Math.cos(angle)]);
    const radial = normalize([Math.cos(angle), Math.sin(angle)]);
    const mode = die.orientation || field.rotation || 'tangent';
    const dir = mode === 'radial' ? radial : tangent;
    const cx = center[0] + Math.cos(angle) * radius;
    const cy = center[1] + Math.sin(angle) * radius;
    out.push({
      kind: 'line',
      role: `${mark.role || 'sticker-field'}:${String(i + 1).padStart(2, '0')}`,
      x1: roundPoint(cx - dir[0] * length / 2),
      y1: roundPoint(cy - dir[1] * length / 2),
      x2: roundPoint(cx + dir[0] * length / 2),
      y2: roundPoint(cy + dir[1] * length / 2),
      stroke: choosePaletteValue(mark.style?.palette || field.palette || die.palette, i) ||
        mark.stroke ||
        die.stroke ||
        '#ffe3b8',
      strokeWidth: finiteOr(mark.strokeWidth, finiteOr(die.strokeWidth, 2)),
      opacity,
      z: finiteOr(mark.z, 40) + i * 0.002,
      algorithmic: true,
      algorithm: 'pastamaker',
      pass: mark.pass || 'highlight-stroke',
      pastamaker: {
        dieFamily: 'line',
        fieldKind: 'aroundRing',
        budgetMode: budget.mode,
        targetOpacity: budget.targetOpacity,
        expectedOverlapCount: budget.expectedOverlapCount,
      },
      stickerFieldRole: mark.role,
      stickerFieldIndex: i,
      stickerFieldCount: count,
      stickerFieldT: round(t),
    });
  }

  return out;
}

function expandAroundRingSpikeBananaField(mark, field, die, byRole) {
  const basis = aroundRingBasis(mark, field, byRole);
  const { center, innerRadius, outerRadius, count } = basis;
  const arcRange = normalizeRange(die.arc, 0.018, 0.08);
  const thicknessRange = normalizeRange(die.thickness, 8, Math.max(10, (outerRadius - innerRadius) * 0.36));
  const wobble = clamp(finiteOr(die.wobble, 0.2), 0, 0.8);
  const spike = clamp(finiteOr(die.spike, 0.22), 0, 0.9);
  const spikeJitter = clamp(finiteOr(die.spikeJitter, 0.28), 0, 1);
  const rotationJitter = clamp(finiteOr(die.rotationJitter, finiteOr(field.rotationJitter, 0)), 0, Math.PI);
  const taper = die.taper || 'even';
  const pointCount = Math.max(4, Math.min(24, Math.round(finiteOr(die.points, 8))));
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.62),
    expectedOverlapCount: Math.max(1, Math.min(count, Math.round(count / 8))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const seed = hashString(`${mark.role || 'stickerField'}:spikeBanana:${count}:${center.join(',')}`);
  const out = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : (i + 0.5) / count;
    const wave = deterministicWave(seed, i, t);
    const angleFraction = wrap01(t + wave * wobble * 0.018);
    const angle = -Math.PI / 2 + angleFraction * Math.PI * 2 + wave * rotationJitter;
    const bias = fieldBiasAt(field.bias, angleFraction);
    const spikeForSticker = clamp(spike * lerp(1 - spikeJitter * 0.45, 1 + spikeJitter * 0.55, wrap01(t * 1.91 + wave * 0.13)), 0, 0.95);
    const arcFraction = lerp(arcRange[0], arcRange[1], wrap01(t * 1.47 + wave * 0.07));
    const arc = arcFraction * Math.PI * 2 * lerp(0.9, 1.22, bias.strength);
    const thickness = Math.min(
      outerRadius - innerRadius,
      lerp(thicknessRange[0], thicknessRange[1], wrap01(t * 2.21 - wave * 0.06)) * lerp(1, 1.25, bias.strength),
    );
    const midRadius = clamp(
      lerp(innerRadius + thickness / 2, outerRadius - thickness / 2, wrap01(t * 1.23 + wave * 0.1)),
      innerRadius + thickness / 2,
      outerRadius - thickness / 2,
    );
    const start = angle - arc / 2;
    const end = angle + arc / 2;
    const fill = choosePaletteValue(mark.style?.palette || field.palette || die.palette, i) ||
      mark.fill ||
      die.fill ||
      '#ff9f39';
    out.push({
      kind: 'polygon',
      closed: true,
      role: `${mark.role || 'sticker-field'}:${String(i + 1).padStart(2, '0')}`,
      points: spikeBananaPoints({
        center,
        radius: midRadius,
        thickness,
        start,
        end,
        pointCount,
        spike: spikeForSticker,
        taper,
        seed,
        index: i,
      }),
      fill,
      stroke: mark.stroke || die.stroke || 'none',
      strokeWidth: finiteOr(mark.strokeWidth, finiteOr(die.strokeWidth, 0)),
      blur: die.blur ?? mark.blur,
      opacity,
      z: finiteOr(mark.z, 20) + i * 0.002,
      algorithmic: true,
      algorithm: 'pastamaker',
      pass: mark.pass || 'sticker-field',
      pastamaker: {
        dieFamily: 'spikeBanana',
        fieldKind: 'aroundRing',
        budgetMode: budget.mode,
        targetOpacity: budget.targetOpacity,
        expectedOverlapCount: budget.expectedOverlapCount,
      },
      stickerFieldRole: mark.role,
      stickerFieldIndex: i,
      stickerFieldCount: count,
      stickerFieldT: round(t),
    });
  }

  return out;
}

function expandAroundRingFuzzyPeachField(mark, field, die, byRole) {
  const basis = aroundRingBasis(mark, field, byRole);
  const { center, innerRadius, outerRadius, count } = basis;
  const radiusRange = normalizeRange(die.radius, 5, 18);
  const aspectRange = normalizeRange(die.aspect, 0.78, 1.22);
  const fuzz = clamp(finiteOr(die.fuzz, 0.18), 0, 0.8);
  const radialJitter = clamp(finiteOr(die.radialJitter, 0.18), 0, 1);
  const rotationJitter = clamp(finiteOr(die.rotationJitter, finiteOr(field.rotationJitter, 0.35)), 0, Math.PI);
  const pointCount = Math.max(10, Math.min(48, Math.round(finiteOr(die.points, 20))));
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.44),
    expectedOverlapCount: Math.max(1, Math.min(count, Math.round(count / 10))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const seed = hashString(`${mark.role || 'stickerField'}:fuzzyPeach:${count}:${center.join(',')}`);
  const out = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : (i + 0.5) / count;
    const wave = deterministicWave(seed, i, t);
    const angleFraction = wrap01(t + wave * fuzz * 0.018);
    const angle = -Math.PI / 2 + angleFraction * Math.PI * 2;
    const bias = fieldBiasAt(field.bias, angleFraction);
    const radiusT = wrap01(t * 1.53 + wave * radialJitter * 0.1);
    const bandRadius = lerp(innerRadius, outerRadius, radiusT);
    const peachR = lerp(radiusRange[0], radiusRange[1], wrap01(t * 2.11 + wave * 0.06)) *
      lerp(1, 1.2, bias.strength);
    const aspect = lerp(aspectRange[0], aspectRange[1], wrap01(t * 1.37 - wave * 0.08));
    const anchor = [
      center[0] + Math.cos(angle) * bandRadius,
      center[1] + Math.sin(angle) * bandRadius,
    ];
    const rotation = angle + Math.PI / 2 + wave * rotationJitter;
    const fill = choosePaletteValue(mark.style?.palette || field.palette || die.palette, i) ||
      mark.fill ||
      die.fill ||
      '#ffd071';
    out.push({
      kind: 'polygon',
      closed: true,
      role: `${mark.role || 'sticker-field'}:${String(i + 1).padStart(2, '0')}`,
      points: fuzzyPeachPoints({
        anchor,
        rx: peachR * aspect,
        ry: peachR / Math.max(aspect, 0.001),
        rotation,
        fuzz,
        pointCount,
        seed,
        index: i,
      }),
      fill,
      stroke: mark.stroke || die.stroke || 'none',
      strokeWidth: finiteOr(mark.strokeWidth, finiteOr(die.strokeWidth, 0)),
      blur: die.blur ?? mark.blur,
      opacity,
      z: finiteOr(mark.z, 20) + i * 0.002,
      algorithmic: true,
      algorithm: 'pastamaker',
      pass: mark.pass || 'sticker-field',
      pastamaker: {
        dieFamily: 'fuzzyPeach',
        fieldKind: 'aroundRing',
        budgetMode: budget.mode,
        targetOpacity: budget.targetOpacity,
        expectedOverlapCount: budget.expectedOverlapCount,
      },
      stickerFieldRole: mark.role,
      stickerFieldIndex: i,
      stickerFieldCount: count,
      stickerFieldT: round(t),
    });
  }

  return out;
}

function fuzzyPeachPoints({ anchor, rx, ry, rotation, fuzz, pointCount, seed, index }) {
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const out = [];
  for (let i = 0; i < pointCount; i++) {
    const t = i / pointCount;
    const a = t * Math.PI * 2;
    const noise = deterministicWave(seed + index * 173, i, t) * fuzz;
    const localRx = Math.max(1, rx * (1 + noise * 0.3));
    const localRy = Math.max(1, ry * (1 + noise * 0.22));
    const x = Math.cos(a) * localRx;
    const y = Math.sin(a) * localRy;
    out.push([
      roundPoint(anchor[0] + x * cosR - y * sinR),
      roundPoint(anchor[1] + x * sinR + y * cosR),
    ]);
  }
  return out;
}

function spikeBananaPoints({ center, radius, thickness, start, end, pointCount, spike, taper, seed, index }) {
  const outer = [];
  const inner = [];
  for (let i = 0; i <= pointCount; i++) {
    const t = i / pointCount;
    const a = start + (end - start) * t;
    const width = spikeBananaWidth(t, thickness, taper);
    const noise = deterministicWave(seed + index * 131, i, t) * spike * thickness * 0.42;
    const outerR = Math.max(1, radius + width / 2 + Math.max(0, noise));
    outer.push([roundPoint(center[0] + Math.cos(a) * outerR), roundPoint(center[1] + Math.sin(a) * outerR)]);
  }
  for (let i = pointCount; i >= 0; i--) {
    const t = i / pointCount;
    const a = start + (end - start) * t;
    const width = spikeBananaWidth(t, thickness, taper);
    const noise = deterministicWave(seed + index * 197, i, t) * spike * thickness * 0.16;
    const innerR = Math.max(1, radius - width / 2 + Math.min(0, noise));
    inner.push([roundPoint(center[0] + Math.cos(a) * innerR), roundPoint(center[1] + Math.sin(a) * innerR)]);
  }
  return outer.concat(inner);
}

function spikeBananaWidth(t, thickness, taper) {
  const endTaper = Math.sin(Math.PI * clamp(t, 0, 1));
  if (taper === 'fat-head-tail' || taper === 'fatHeadTail') {
    const headBias = 1 - Math.pow(clamp(t, 0, 1), 1.35) * 0.42;
    return Math.max(thickness * 0.12, thickness * (0.22 + 0.58 * endTaper) * headBias);
  }
  return Math.max(thickness * 0.16, thickness * (0.34 + 0.54 * endTaper));
}

function expandAlongPathLineField(mark, field, die) {
  const points = pathPointsFor(field);
  if (points.length < 2) {
    throw new Error(`stickerField '${mark.role || '(anonymous)'}' field.points must contain at least two [x,y] points`);
  }
  const count = Math.max(1, Math.min(220, Math.round(finiteOr(field.count, 24))));
  const lengthRange = normalizeRange(die.length, 12, 42);
  const lateralRange = normalizeRange(field.lateralJitter, 0, 0);
  const alongJitter = clamp(finiteOr(field.alongJitter, 0.12), 0, 1);
  const wobble = clamp(finiteOr(die.wobble, 0), 0, 0.8);
  const budget = resolveValueBudget(mark.valueBudget, {
    targetOpacity: finiteOr(mark.opacity, 0.46),
    expectedOverlapCount: Math.max(1, Math.min(count, Math.round(count / 10))),
    mode: 'inverse-count',
  });
  const opacity = opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
  const seed = hashString(`${mark.role || 'stickerField'}:path:${count}:${points.map((p) => p.join(',')).join('|')}`);
  const out = [];

  for (let i = 0; i < count; i++) {
    const baseT = count === 1 ? 0.5 : (i + 0.5) / count;
    const wave = deterministicWave(seed, i, baseT);
    const sample = sampleGesture(points, wrap01(baseT + wave * alongJitter * 0.035));
    if (!sample) continue;
    const tangent = sample.tangent;
    const normal = normalize([-tangent[1], tangent[0]]);
    const lateral = lerp(lateralRange[0], lateralRange[1], wrap01(baseT * 1.73 + wave * wobble * 0.11));
    const length = lerp(lengthRange[0], lengthRange[1], wrap01(baseT * 2.19 - wave * 0.04));
    const mode = die.orientation || field.rotation || 'tangent';
    const dir = mode === 'normal' ? normal : tangent;
    const cx = sample.point[0] + normal[0] * lateral;
    const cy = sample.point[1] + normal[1] * lateral;
    out.push({
      kind: 'line',
      role: `${mark.role || 'sticker-field'}:${String(i + 1).padStart(2, '0')}`,
      x1: roundPoint(cx - dir[0] * length / 2),
      y1: roundPoint(cy - dir[1] * length / 2),
      x2: roundPoint(cx + dir[0] * length / 2),
      y2: roundPoint(cy + dir[1] * length / 2),
      stroke: choosePaletteValue(mark.style?.palette || field.palette || die.palette, i) ||
        mark.stroke ||
        die.stroke ||
        '#cfa586',
      strokeWidth: finiteOr(mark.strokeWidth, finiteOr(die.strokeWidth, 1.8)),
      opacity,
      z: finiteOr(mark.z, 30) + i * 0.002,
      algorithmic: true,
      algorithm: 'pastamaker',
      pass: mark.pass || 'path-stroke',
      pastamaker: {
        dieFamily: 'line',
        fieldKind: 'alongPath',
        budgetMode: budget.mode,
        targetOpacity: budget.targetOpacity,
        expectedOverlapCount: budget.expectedOverlapCount,
      },
      stickerFieldRole: mark.role,
      stickerFieldIndex: i,
      stickerFieldCount: count,
      stickerFieldT: round(baseT),
    });
  }

  return out;
}

function pathPointsFor(field) {
  if (Array.isArray(field.points)) {
    return field.points.filter(validPoint);
  }
  const from = validPoint(field.from);
  const to = validPoint(field.to);
  return from && to ? [from, to] : [];
}

function aroundRingBasis(mark, field, byRole) {
  const center = validPoint(field.center);
  if (!center) {
    throw new Error(`stickerField '${mark.role || '(anonymous)'}' field.center must be [x,y]`);
  }
  const radius = normalizeRange(field.radius, 40, 120);
  let innerRadius = Math.max(1, radius[0]);
  const outerRadius = Math.max(innerRadius + 1, radius[1]);
  const occluder = mark.constraints?.occludeBy ? byRole.get(mark.constraints.occludeBy) : null;
  if (mark.constraints?.preserveVoid && occluder?.kind === 'circle') {
    innerRadius = Math.max(innerRadius, finiteOr(occluder.r, 0) + 2);
  }
  const count = Math.max(1, Math.min(220, Math.round(finiteOr(field.count, 24))));
  return { center, innerRadius, outerRadius, count };
}

function annularPatchPoints(center, innerRadius, outerRadius, start, end, pointCount) {
  const outer = ellipseArcPoints(center[0], center[1], outerRadius, outerRadius, pointCount, start, end);
  const inner = ellipseArcPoints(center[0], center[1], innerRadius, innerRadius, pointCount, end, start);
  return outer.concat(inner);
}

function normalizeRange(value, fallbackMin, fallbackMax) {
  if (Array.isArray(value) && value.length >= 2) {
    const a = finiteOr(value[0], fallbackMin);
    const b = finiteOr(value[1], fallbackMax);
    return [Math.min(a, b), Math.max(a, b)];
  }
  if (Number.isFinite(value)) return [value, value];
  return [fallbackMin, fallbackMax];
}

function fieldBiasAt(biases, angleFraction) {
  if (!Array.isArray(biases)) return { strength: 0 };
  let strength = 0;
  for (const bias of biases) {
    if (!bias || typeof bias !== 'object') continue;
    const from = wrap01(finiteOr(bias.from, 0));
    const to = wrap01(finiteOr(bias.to, 1));
    const inside = from <= to
      ? angleFraction >= from && angleFraction <= to
      : angleFraction >= from || angleFraction <= to;
    if (inside) {
      strength = Math.max(strength, clamp((finiteOr(bias.weight, 1) - 1) / 4, 0, 1));
    }
  }
  return { strength };
}

function choosePaletteValue(palette, index) {
  if (!Array.isArray(palette) || palette.length === 0) return null;
  return palette[index % palette.length];
}

function wrap01(value) {
  const n = value % 1;
  return n < 0 ? n + 1 : n;
}

function validPoint(point) {
  return Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1])
    ? point
    : null;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPoint(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

function isShadowAlgorithm(value) {
  return value === 'convex-value-stack' || value === 'form-light-stack';
}

function isHighlightAlgorithm(value) {
  return value === 'simple-highlight' || value === 'form-light-stack';
}

function hasFormLighting(mark) {
  return isShadowAlgorithm(mark?.shade?.algorithm) || isHighlightAlgorithm(mark?.highlights?.algorithm);
}

function resolveGestureMarks(marks, gesture) {
  if (!gesture || typeof gesture !== 'object' || !Array.isArray(gesture.points) || gesture.points.length < 2) {
    return marks;
  }
  return marks.map((mark) => resolveGestureMark(mark, gesture));
}

function synthesizeDynamicSkeletonMarks(marks, gesture, scene = {}) {
  const skeleton = gesture?.dynamicSkeleton;
  const crossGesture = gesture?.crossGesture || gesture?.cross || skeleton?.crossGesture;
  if (!skeleton || typeof skeleton !== 'object' || !Array.isArray(gesture?.points) || gesture.points.length < 2) {
    return marks;
  }
  const axes = {
    main: gesture,
    body: gesture,
    gesture,
    cross: crossGesture,
    crossGesture,
    activeArm: crossGesture,
  };
  const anchors = dynamicSkeletonAnchors(skeleton);
  const sampled = [];
  for (const spec of anchors) {
    const axis = axes[spec.axis || spec.gesture || 'main'];
    const sample = axis?.points ? sampleGesture(axis.points, finiteOr(spec.gestureT, spec.t ?? 0.5)) : null;
    if (!sample) continue;
    sampled.push({ ...spec, sample: offsetGestureSample(sample, spec), axisKind: axis.kind || spec.axis || 'gesture' });
  }
  if (!sampled.length) return marks;
  const byRole = new Map(sampled.map((item) => [item.role, item]));
  const generated = [
    ...sampled.map((item, index) => dynamicSkeletonAnchorMark(item, index, skeleton, scene)),
    ...dynamicSkeletonConnectionMarks(dynamicSkeletonConnections(skeleton), byRole, skeleton, scene),
  ];
  return [...marks, ...generated];
}

function dynamicSkeletonAnchors(skeleton) {
  if (Array.isArray(skeleton.anchors) && skeleton.anchors.length) return skeleton.anchors;
  return [
    { role: 'head', axis: 'main', gestureT: 0.08, kind: 'core', radius: 22, zRole: 'head' },
    { role: 'torso-center', axis: 'main', gestureT: 0.42, kind: 'core', rx: 38, ry: 54, zRole: 'torso' },
    { role: 'pelvis', axis: 'main', gestureT: 0.72, kind: 'core', rx: 34, ry: 40, zRole: 'pelvis' },
    { role: 'left-hip', axis: 'main', gestureT: 0.74, offset: [-24, 0], kind: 'joint', radius: 12, zRole: 'hip', connects: ['pelvis', 'left-knee'] },
    { role: 'right-hip', axis: 'main', gestureT: 0.74, offset: [24, 0], kind: 'joint', radius: 12, zRole: 'hip', connects: ['pelvis', 'right-knee'] },
    { role: 'left-knee', axis: 'main', gestureT: 0.86, offset: [-20, 6], kind: 'joint', radius: 11, zRole: 'knee', connects: ['left-hip', 'left-ankle'] },
    { role: 'right-knee', axis: 'main', gestureT: 0.86, offset: [20, 6], kind: 'joint', radius: 11, zRole: 'knee', connects: ['right-hip', 'right-ankle'] },
    { role: 'left-ankle', axis: 'main', gestureT: 0.98, offset: [-18, 4], kind: 'joint', radius: 9, zRole: 'foot', connects: ['left-knee', 'left-foot'] },
    { role: 'right-ankle', axis: 'main', gestureT: 0.98, offset: [18, 4], kind: 'joint', radius: 9, zRole: 'foot', connects: ['right-knee', 'right-foot'] },
    { role: 'left-foot', axis: 'main', gestureT: 1, offset: [-32, 8], kind: 'joint', radius: 9, zRole: 'foot', connects: ['left-ankle'] },
    { role: 'right-foot', axis: 'main', gestureT: 1, offset: [32, 8], kind: 'joint', radius: 9, zRole: 'foot', connects: ['right-ankle'] },
    { role: 'active-shoulder', axis: 'cross', gestureT: 0.12, kind: 'joint', radius: 13, zRole: 'shoulder' },
    { role: 'active-elbow', axis: 'cross', gestureT: 0.55, kind: 'joint', radius: 12, zRole: 'elbow' },
    { role: 'active-hand', axis: 'cross', gestureT: 0.92, kind: 'joint', radius: 11, zRole: 'hand' },
  ];
}

function dynamicSkeletonConnections(skeleton) {
  if (Array.isArray(skeleton.connections) && skeleton.connections.length) return skeleton.connections;
  return [
    { from: 'active-shoulder', to: 'active-elbow', role: 'active-upper-arm', kind: 'limb' },
    { from: 'active-elbow', to: 'active-hand', role: 'active-forearm', kind: 'limb' },
    { from: 'torso-center', to: 'pelvis', role: 'torso-carry', kind: 'core-span' },
    { from: 'pelvis', to: 'left-hip', role: 'left-hip-carry', kind: 'joint-span', thickness: 10 },
    { from: 'pelvis', to: 'right-hip', role: 'right-hip-carry', kind: 'joint-span', thickness: 10 },
    { from: 'left-hip', to: 'left-knee', role: 'left-upper-leg', kind: 'limb' },
    { from: 'right-hip', to: 'right-knee', role: 'right-upper-leg', kind: 'limb' },
    { from: 'left-knee', to: 'left-ankle', role: 'left-lower-leg', kind: 'limb' },
    { from: 'right-knee', to: 'right-ankle', role: 'right-lower-leg', kind: 'limb' },
    { from: 'left-ankle', to: 'left-foot', role: 'left-foot-carry', kind: 'foot', thickness: 9 },
    { from: 'right-ankle', to: 'right-foot', role: 'right-foot-carry', kind: 'foot', thickness: 9 },
  ];
}

function offsetGestureSample(sample, spec) {
  const offset = Array.isArray(spec.offset) ? spec.offset : null;
  if (!offset || (!Number.isFinite(offset[0]) && !Number.isFinite(offset[1]))) return sample;
  const tangent = normalize(sample.tangent || [0, 1]);
  const normal = [-tangent[1], tangent[0]];
  const lateral = finiteOr(offset[0], 0);
  const along = finiteOr(offset[1], 0);
  return {
    ...sample,
    point: [
      sample.point[0] + normal[0] * lateral + tangent[0] * along,
      sample.point[1] + normal[1] * lateral + tangent[1] * along,
    ],
  };
}

function dynamicSkeletonAnchorMark(item, index, skeleton, scene) {
  const point = item.sample.point;
  const tangent = item.sample.tangent;
  const fill = item.fill || skeleton.fill || '#b1845e';
  const stroke = item.stroke || skeleton.stroke || '#4f3928';
  const role = item.role || `dynamic-skeleton-anchor-${index + 1}`;
  const z = dynamicSkeletonZ(item, skeleton, scene, index);
  const common = {
    role,
    anchor: [roundPoint(point[0]), roundPoint(point[1])],
    fill,
    stroke,
    z,
    dynamicSkeleton: true,
    dynamicSkeletonRole: role,
    dynamicSkeletonPart: item.kind || 'joint',
    dynamicSkeletonAxis: item.axis || item.gesture || 'main',
    dynamicSkeletonAxisKind: item.axisKind,
    dynamicSkeletonGestureT: finiteOr(item.gestureT, item.t ?? 0.5),
    dynamicSkeletonTangent: [roundPoint(tangent[0]), roundPoint(tangent[1])],
    jointConnects: item.connects,
    jointPlacement: item.placement || skeleton.jointPlacement || 'between-segments',
    eyeRelation: item.eyeRelation || skeleton.eyeRelation || 'top-closer',
  };
  if ((item.kind || '').includes('core') && role !== 'head') {
    return {
      ...common,
      kind: 'blob',
      rx: Math.max(finiteOr(item.rx, finiteOr(item.radius, 24)), 1),
      ry: Math.max(finiteOr(item.ry, finiteOr(item.radius, 34)), 1),
      rotation: Number.isFinite(item.rotation) ? item.rotation : rotationFromTangent(tangent),
      formPart: item.formPart || 'core',
    };
  }
  if (role === 'head') {
    return {
      ...common,
      kind: 'egg',
      rx: Math.max(finiteOr(item.rx, finiteOr(item.radius, 20)), 1),
      ry: Math.max(finiteOr(item.ry, finiteOr(item.radius, 24)), 1),
      rotation: Number.isFinite(item.rotation) ? item.rotation : rotationFromTangent(tangent),
      formPart: 'head',
    };
  }
  return {
    ...common,
    kind: 'sphere',
    r: Math.max(finiteOr(item.r, finiteOr(item.radius, 12)), 1),
    formPart: 'joint',
    jointVisible: item.visible !== false,
  };
}

function dynamicSkeletonConnectionMarks(connections, byRole, skeleton, scene) {
  return connections.flatMap((connection, index) => {
    const from = byRole.get(connection.from);
    const to = byRole.get(connection.to);
    if (!from || !to) return [];
    const a = from.sample.point;
    const b = to.sample.point;
    const midpoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const length = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), 1);
    const tangent = normalize([b[0] - a[0], b[1] - a[1]]);
    const role = connection.role || `${connection.from}-to-${connection.to}`;
    return [{
      kind: 'blob',
      role,
      anchor: [roundPoint(midpoint[0]), roundPoint(midpoint[1])],
      rx: Math.max(finiteOr(connection.thickness, skeleton.limbThickness ?? 13), 1),
      ry: Math.max(finiteOr(connection.length, length / 2), 1),
      rotation: rotationFromTangent(tangent),
      fill: connection.fill || skeleton.fill || '#b1845e',
      stroke: connection.stroke || skeleton.stroke || '#4f3928',
      z: dynamicSkeletonConnectionZ(from, to, skeleton, scene, index),
      dynamicSkeleton: true,
      dynamicSkeletonRole: role,
      dynamicSkeletonPart: connection.kind || 'limb',
      dynamicSkeletonConnection: true,
      connects: [connection.from, connection.to],
      terminatesIntoJoints: true,
      jointMediated: true,
      formPart: connection.kind || 'limb',
    }];
  });
}

function dynamicSkeletonZ(item, skeleton, scene, index) {
  const base = finiteOr(skeleton.z, finiteOr(scene.view?.baseZ, 18));
  const rank = {
    pelvis: 0.1,
    torso: 0.3,
    shoulder: 0.55,
    elbow: 0.75,
    hand: 1,
    head: 0.9,
  }[item.zRole || item.role] ?? index * 0.04;
  const activeBoost = (item.axis || item.gesture) === 'cross' || (item.axis || item.gesture) === 'activeArm' ? 0.5 : 0;
  return round(base + rank + activeBoost);
}

function dynamicSkeletonConnectionZ(from, to, skeleton, scene, index) {
  const fromZ = dynamicSkeletonZ(from, skeleton, scene, index);
  const toZ = dynamicSkeletonZ(to, skeleton, scene, index + 1);
  return round((fromZ + toZ) / 2 - 0.03);
}

function resolveGestureMark(mark, gesture) {
  if (!mark || typeof mark !== 'object' || !Number.isFinite(mark.gestureT)) return mark;
  const sample = sampleGesture(gesture.points, mark.gestureT);
  if (!sample) return mark;

  const tangent = sample.tangent;
  const normal = normalize([-tangent[1], tangent[0]]);
  const offset = Array.isArray(mark.offset) ? mark.offset : [0, 0];
  const lateral = finiteOr(offset[0], 0);
  const along = finiteOr(offset[1], 0);
  const anchor = [
    roundPoint(sample.point[0] + normal[0] * lateral + tangent[0] * along),
    roundPoint(sample.point[1] + normal[1] * lateral + tangent[1] * along),
  ];
  const hasExplicitRotation = Number.isFinite(mark.rotation);
  const gestureRotation = rotationFromTangent(tangent);

  return {
    ...mark,
    anchor,
    rotation: hasExplicitRotation ? mark.rotation : gestureRotation,
    gestureResolved: true,
    gestureKind: gesture.kind || 'polyline',
    gesturePoint: [roundPoint(sample.point[0]), roundPoint(sample.point[1])],
    gestureTangent: [roundPoint(tangent[0]), roundPoint(tangent[1])],
    gestureRotation: round(gestureRotation),
    gestureRotationSource: hasExplicitRotation ? 'explicit' : 'tangent',
  };
}

function sampleGesture(points, t) {
  const clean = points.filter(
    (p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),
  );
  if (clean.length < 2) return null;
  const clampedT = clamp(t, 0, 1);
  const segments = [];
  let total = 0;
  for (let i = 0; i < clean.length - 1; i++) {
    const a = clean[i];
    const b = clean[i + 1];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length <= 1e-9) continue;
    segments.push({ a, b, length });
    total += length;
  }
  if (!segments.length) return null;

  let remaining = clampedT * total;
  for (const segment of segments) {
    if (remaining > segment.length) {
      remaining -= segment.length;
      continue;
    }
    const localT = segment.length <= 1e-9 ? 0 : remaining / segment.length;
    return {
      point: [
        segment.a[0] + (segment.b[0] - segment.a[0]) * localT,
        segment.a[1] + (segment.b[1] - segment.a[1]) * localT,
      ],
      tangent: normalize([segment.b[0] - segment.a[0], segment.b[1] - segment.a[1]]),
    };
  }

  const last = segments[segments.length - 1];
  return {
    point: last.b,
    tangent: normalize([last.b[0] - last.a[0], last.b[1] - last.a[1]]),
  };
}

function rotationFromTangent(tangent) {
  return round(Math.atan2(tangent[1], tangent[0]) - Math.PI / 2);
}

function expandCompactSourceMarks(mark, index, scene, manifest = {}) {
  if (!mark || typeof mark !== 'object') return [mark];
  if (mark.kind === 'facePattern') {
    return [{ ...mark, sourceIndex: mark.sourceIndex ?? index }];
  }
  if (mark.kind === 'solidPreset') {
    return expandSolidPresetMark(mark, index, scene);
  }
  if (mark.kind === 'solid') {
    return expandSolidMark(mark, index, scene, manifest);
  }
  if (mark.kind === 'cylinder') {
    return expandCylinderMark(mark, index, scene);
  }
  if (mark.kind === 'volume') {
    return expandVolumeMark(mark, index, scene);
  }
  if (mark.kind === 'planePreset') {
    return expandPlanePresetMark(mark, index, scene);
  }
  if (mark.kind === 'plane') {
    return [expandPlaneMark(mark, index, scene)];
  }
  if (mark.kind === 'object') {
    return expandLibraryObjectMark(mark, index, scene);
  }
  if (mark.kind === 'sphere' || mark.kind === 'oval') {
    return [expandRoundPrimitiveMark(mark, index)];
  }
  if (mark.kind === 'egg') {
    return [expandEggMark(mark, index)];
  }
  if (mark.kind === 'blob' || mark.kind === 'ellipse') {
    return [expandBlobMark(mark, index)];
  }
  return [{ ...mark, sourceIndex: mark.sourceIndex ?? index }];
}

function resolveFacePatternMarks(marks, scene = {}) {
  if (!Array.isArray(marks) || !marks.some((mark) => mark?.kind === 'facePattern')) return marks;
  const sourceFaces = marks.filter((mark) => mark?.kind !== 'facePattern');
  const out = [...sourceFaces];
  for (const pattern of marks.filter((mark) => mark?.kind === 'facePattern')) {
    out.push(...expandFacePatternMark(pattern, sourceFaces, scene));
  }
  return out;
}

function expandFacePatternMark(mark, sourceFaces, scene = {}) {
  const target = mark.target && typeof mark.target === 'object' && !Array.isArray(mark.target) ? mark.target : {};
  const solidRole = target.solidRole || target.role || mark.targetSolidRole || mark.solidRole;
  const faceName = target.face || mark.targetFace || mark.face || 'front';
  const face = sourceFaces.find((candidate) => (
    candidate?.sourceShape === 'plane' &&
    candidate?.solidRole === solidRole &&
    candidate?.face === faceName &&
    Array.isArray(candidate.points) &&
    candidate.points.length >= 4
  ));
  if (!face) return [];

  const boxes = facadeBayPatternBoxes(mark.pattern);
  const motifs = mark.motifs && typeof mark.motifs === 'object' && !Array.isArray(mark.motifs) ? mark.motifs : {};
  const fill = mark.fill || '#d8c3a2';
  const stroke = mark.stroke || '#2f241b';
  const accent = mark.accent || '#f2dfb8';
  const shadow = mark.shadow || '#473322';
  const baseZ = finiteOr(mark.z, finiteOr(face.z, finiteOr(scene.view?.baseZ, 10)) + 0.34);
  const common = {
    sourceIndex: mark.sourceIndex,
    sourceShape: 'face-detail',
    formFamily: 'vector',
    vectorKind: 'face-detail',
    facePatternRole: mark.role,
    facePatternBasis: mark.pattern?.basis || mark.pattern?.kind || 'facade-bays',
    architecturalMiniature: mark.language || 'architectural-miniature',
  };
  const out = [];

  boxes.cells.forEach((box, index) => {
    const motif = motifForCell(motifs.cell, box, index);
    if (!motif || motif === 'none') return;
    out.push(...miniatureMotifMarks({
      motif,
      box,
      face,
      role: `${face.solidRole}:${face.face}:${motif}-${box.row + 1}-${box.col + 1}`,
      fill,
      stroke,
      accent,
      shadow,
      baseZ: baseZ + index * 0.002,
      common,
    }));
  });

  if (motifs.lowerBand && boxes.lowerBand) {
    out.push(...miniatureMotifMarks({
      motif: motifs.lowerBand,
      box: boxes.lowerBand,
      face,
      role: `${face.solidRole}:${face.face}:${motifs.lowerBand}-band`,
      fill,
      stroke,
      accent,
      shadow,
      baseZ: baseZ + 0.12,
      common,
    }));
  }
  if (motifs.topBand && boxes.topBand) {
    out.push(...miniatureMotifMarks({
      motif: motifs.topBand,
      box: boxes.topBand,
      face,
      role: `${face.solidRole}:${face.face}:${motifs.topBand}`,
      fill,
      stroke,
      accent,
      shadow,
      baseZ: baseZ + 0.14,
      common,
    }));
  }
  if (motifs.verticalAccent && boxes.verticalAccent) {
    out.push(...miniatureMotifMarks({
      motif: motifs.verticalAccent,
      box: boxes.verticalAccent,
      face,
      role: `${face.solidRole}:${face.face}:${motifs.verticalAccent}`,
      fill,
      stroke,
      accent,
      shadow,
      baseZ: baseZ + 0.18,
      common,
    }));
  }

  return out;
}

function facadeBayPatternBoxes(pattern = {}) {
  const subdivide = pattern.subdivide && typeof pattern.subdivide === 'object' && !Array.isArray(pattern.subdivide)
    ? pattern.subdivide
    : {};
  const cols = clamp(Math.round(finiteOr(subdivide.cols ?? pattern.cols, 5)), 1, 16);
  const rows = clamp(Math.round(finiteOr(subdivide.rows ?? pattern.rows, 6)), 1, 20);
  const margin = clamp(finiteOr(pattern.margin, 0.08), 0, 0.28);
  const gap = clamp(finiteOr(pattern.gap, 0.025), 0, 0.14);
  const topBandHeight = clamp(finiteOr(pattern.topBandHeight, 0.08), 0.02, 0.22);
  const lowerBandHeight = clamp(finiteOr(pattern.lowerBandHeight, 0.12), 0.04, 0.28);
  const usableU = 1 - margin * 2;
  const usableV = Math.max(0.1, 1 - margin * 2 - topBandHeight - lowerBandHeight);
  const cellW = (usableU - gap * (cols - 1)) / cols;
  const cellH = (usableV - gap * (rows - 1)) / rows;
  const skip = new Set((Array.isArray(pattern.skip) ? pattern.skip : [])
    .map((item) => `${Math.floor(finiteOr(item.col, -1))}:${Math.floor(finiteOr(item.row, -1))}`));
  const voids = Array.isArray(pattern.voids) ? pattern.voids : [];
  for (const item of voids) {
    skip.add(`${Math.floor(finiteOr(item.col, -1))}:${Math.floor(finiteOr(item.row, -1))}`);
  }
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (skip.has(`${col}:${row}`)) continue;
      cells.push({
        role: 'cell',
        col,
        row,
        cols,
        rows,
        u: margin + col * (cellW + gap),
        v: margin + topBandHeight + row * (cellH + gap),
        w: Math.max(cellW, 0.001),
        h: Math.max(cellH, 0.001),
      });
    }
  }
  const verticalAccent = pattern.verticalAccent && typeof pattern.verticalAccent === 'object' && !Array.isArray(pattern.verticalAccent)
    ? pattern.verticalAccent
    : null;
  const accentCol = verticalAccent ? clamp(Math.floor(finiteOr(verticalAccent.col, cols - 1)), 0, cols - 1) : cols - 1;
  return {
    cells,
    topBand: {
      role: 'topBand',
      u: margin,
      v: margin * 0.52,
      w: usableU,
      h: topBandHeight * 0.58,
    },
    lowerBand: {
      role: 'lowerBand',
      u: margin,
      v: 1 - margin - lowerBandHeight * 0.72,
      w: usableU,
      h: lowerBandHeight * 0.42,
    },
    verticalAccent: {
      role: verticalAccent?.role || 'verticalAccent',
      u: margin + accentCol * (cellW + gap),
      v: margin + topBandHeight,
      w: Math.max(cellW, 0.001),
      h: usableV,
      col: accentCol,
    },
  };
}

function motifForCell(motif, box, index) {
  if (Array.isArray(motif)) return motif[index % motif.length];
  if (motif && typeof motif === 'object') {
    if (Array.isArray(motif.alternate)) return motif.alternate[index % motif.alternate.length];
    if (motif.kind) return motif.kind;
  }
  return motif || (box.role === 'cell' ? 'french-window' : null);
}

function miniatureMotifMarks({ motif, box, face, role, fill, stroke, accent, shadow, baseZ, common }) {
  const normalized = String(motif || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (normalized === 'french-window' || normalized === 'window' || normalized === 'frenchwindow') {
    return frenchWindowMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common });
  }
  if (normalized === 'balcony' || normalized === 'balcony-band') {
    return balconyMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common });
  }
  if (normalized === 'stairwell' || normalized === 'stairwell-strip') {
    return stairwellMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common });
  }
  if (normalized === 'cornice' || normalized === 'cap-band') {
    return corniceMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common });
  }
  return [];
}

function frenchWindowMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common }) {
  const frame = insetUvBox(box, 0.12, 0.1);
  const leftMid = faceUvPoint(face.points, frame.u + frame.w * 0.5, frame.v);
  const rightMid = faceUvPoint(face.points, frame.u + frame.w * 0.5, frame.v + frame.h);
  const horizA = faceUvPoint(face.points, frame.u, frame.v + frame.h * 0.48);
  const horizB = faceUvPoint(face.points, frame.u + frame.w, frame.v + frame.h * 0.48);
  return [
    facePolygonMark(`${role}:dark-glass`, face, frame, shadow, 'none', 0.58, baseZ, common, 'french-window'),
    facePolylineMark(`${role}:frame`, face, closedUvBoxPolyline(frame), stroke, 0.92, 1.15, baseZ + 0.01, common, 'french-window'),
    faceLineMark(`${role}:center-mullion`, leftMid, rightMid, accent, 0.82, 0.85, baseZ + 0.02, common, face, frame, 'french-window'),
    faceLineMark(`${role}:cross-mullion`, horizA, horizB, accent, 0.72, 0.75, baseZ + 0.021, common, face, frame, 'french-window'),
  ];
}

function balconyMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common }) {
  const slab = {
    u: box.u + box.w * 0.08,
    v: box.v + box.h * 0.64,
    w: box.w * 0.84,
    h: box.h * 0.14,
  };
  const railY = slab.v + slab.h * 0.25;
  const railA = faceUvPoint(face.points, slab.u, railY);
  const railB = faceUvPoint(face.points, slab.u + slab.w, railY);
  const out = [
    facePolygonMark(`${role}:slab`, face, slab, shadeHex(fill, 0.86), stroke, 0.82, baseZ, common, 'balcony', { projectsFromFace: true }),
    faceLineMark(`${role}:rail`, railA, railB, accent, 0.94, 1.15, baseZ + 0.02, common, face, slab, 'balcony'),
  ];
  const posts = Math.max(3, Math.round(finiteOr(box.cols, 5)));
  for (let i = 0; i < posts; i++) {
    const t = posts === 1 ? 0.5 : i / (posts - 1);
    const u = slab.u + slab.w * t;
    out.push(faceLineMark(
      `${role}:baluster-${i + 1}`,
      faceUvPoint(face.points, u, railY),
      faceUvPoint(face.points, u, slab.v + slab.h),
      stroke,
      0.72,
      0.55,
      baseZ + 0.025 + i * 0.001,
      common,
      face,
      slab,
      'balcony',
    ));
  }
  return out;
}

function stairwellMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common }) {
  const strip = insetUvBox(box, 0.18, 0.02);
  const out = [
    facePolygonMark(`${role}:strip`, face, strip, shadeHex(fill, 0.72), stroke, 0.42, baseZ, common, 'stairwell'),
  ];
  const steps = Math.max(4, Math.min(18, Math.round(finiteOr(box.rows, 8))));
  for (let i = 0; i < steps; i++) {
    const v0 = strip.v + (strip.h * i) / steps;
    const v1 = strip.v + (strip.h * (i + 0.72)) / steps;
    const flip = i % 2 === 1;
    const a = faceUvPoint(face.points, flip ? strip.u + strip.w : strip.u, v0);
    const b = faceUvPoint(face.points, flip ? strip.u : strip.u + strip.w, v1);
    out.push(faceLineMark(`${role}:switchback-${i + 1}`, a, b, accent, 0.78, 0.75, baseZ + 0.02 + i * 0.002, common, face, strip, 'stairwell'));
  }
  return out;
}

function corniceMarks({ box, face, role, fill, stroke, accent, shadow, baseZ, common }) {
  const band = insetUvBox(box, 0, 0.08);
  const shadowLineY = band.v + band.h;
  return [
    facePolygonMark(`${role}:cap`, face, band, shadeHex(fill, 1.12), stroke, 0.86, baseZ, common, 'cornice'),
    faceLineMark(
      `${role}:undershadow`,
      faceUvPoint(face.points, band.u, shadowLineY),
      faceUvPoint(face.points, band.u + band.w, shadowLineY),
      shadow,
      0.72,
      1.05,
      baseZ + 0.018,
      common,
      face,
      band,
      'cornice',
    ),
  ];
}

function facePolygonMark(role, face, uvBox, fill, stroke, opacity, z, common, motif, extra = {}) {
  return {
    ...common,
    ...extra,
    kind: 'polygon',
    role,
    points: faceUvQuad(face.points, uvBox),
    fill,
    stroke,
    strokeWidth: stroke === 'none' ? 0 : 0.75,
    opacity,
    z,
    faceAttachment: faceAttachment(face, uvBox, motif, common.facePatternRole),
  };
}

function facePolylineMark(role, face, uvPoints, stroke, opacity, strokeWidth, z, common, motif) {
  return {
    ...common,
    kind: 'polyline',
    role,
    points: uvPoints.map(([u, v]) => faceUvPoint(face.points, u, v)),
    stroke,
    strokeWidth,
    opacity,
    z,
    faceAttachment: faceAttachment(face, uvBounds(uvPoints), motif, common.facePatternRole),
  };
}

function faceLineMark(role, a, b, stroke, opacity, strokeWidth, z, common, face, uvBox, motif) {
  return {
    ...common,
    kind: 'line',
    role,
    x1: roundPoint(a[0]),
    y1: roundPoint(a[1]),
    x2: roundPoint(b[0]),
    y2: roundPoint(b[1]),
    stroke,
    strokeWidth,
    opacity,
    z,
    faceAttachment: faceAttachment(face, uvBox, motif, common.facePatternRole),
  };
}

function faceAttachment(face, uvBox, motif, patternRole) {
  return {
    solidRole: face.solidRole,
    face: face.face,
    patternRole,
    motif,
    uvBox: {
      u: round(clamp(finiteOr(uvBox.u, 0), 0, 1)),
      v: round(clamp(finiteOr(uvBox.v, 0), 0, 1)),
      w: round(clamp(finiteOr(uvBox.w, 0), 0, 1)),
      h: round(clamp(finiteOr(uvBox.h, 0), 0, 1)),
    },
  };
}

function faceUvQuad(points, box) {
  return [
    faceUvPoint(points, box.u, box.v),
    faceUvPoint(points, box.u + box.w, box.v),
    faceUvPoint(points, box.u + box.w, box.v + box.h),
    faceUvPoint(points, box.u, box.v + box.h),
  ];
}

function faceUvPoint(points, uRaw, vRaw) {
  const { topLeft, topRight, bottomRight, bottomLeft } = faceCorners(points);
  const u = clamp(finiteOr(uRaw, 0), -0.5, 1.5);
  const v = clamp(finiteOr(vRaw, 0), -0.5, 1.5);
  const top = lerpPoint(topLeft, topRight, u);
  const bottom = lerpPoint(bottomLeft, bottomRight, u);
  return lerpPoint(top, bottom, v).map(roundPoint);
}

function faceCorners(points) {
  const valid = Array.isArray(points) ? points.filter(validPoint) : [];
  if (valid.length < 4) {
    const fallback = valid[0] || [0, 0];
    return { topLeft: fallback, topRight: fallback, bottomRight: fallback, bottomLeft: fallback };
  }
  const sorted = [...valid].sort((a, b) => a[1] - b[1]);
  const top = sorted.slice(0, 2).sort((a, b) => a[0] - b[0]);
  const bottom = sorted.slice(-2).sort((a, b) => a[0] - b[0]);
  return {
    topLeft: top[0],
    topRight: top[1],
    bottomRight: bottom[1],
    bottomLeft: bottom[0],
  };
}

function insetUvBox(box, insetX = 0, insetY = insetX) {
  return {
    ...box,
    u: box.u + box.w * insetX,
    v: box.v + box.h * insetY,
    w: Math.max(box.w * (1 - insetX * 2), 0.001),
    h: Math.max(box.h * (1 - insetY * 2), 0.001),
  };
}

function closedUvBoxPolyline(box) {
  return [
    [box.u, box.v],
    [box.u + box.w, box.v],
    [box.u + box.w, box.v + box.h],
    [box.u, box.v + box.h],
    [box.u, box.v],
  ];
}

function uvBounds(points) {
  const xs = points.map((point) => finiteOr(point[0], 0));
  const ys = points.map((point) => finiteOr(point[1], 0));
  const minU = Math.min(...xs);
  const minV = Math.min(...ys);
  return {
    u: minU,
    v: minV,
    w: Math.max(...xs) - minU,
    h: Math.max(...ys) - minV,
  };
}

function expandSolidPresetMark(mark, index, scene) {
  const ref = mark.ref || mark.preset;
  if (ref === 'bookshelf') {
    return expandBookshelfSolidPreset(mark, index, scene);
  }
  throw new Error(`unknown solid preset '${ref || '(missing ref)'}'`);
}

function expandSolidMark(mark, index, scene, manifest = {}) {
  const ccaBox = resolveCcaSolidBox(mark, manifest);
  const origin = ccaBox?.origin || [
    finiteOr(mark.x, finiteOr(mark.anchor?.[0], 0)),
    finiteOr(mark.y, finiteOr(mark.anchor?.[1], 0)),
  ];
  const w = Math.max(finiteOr(ccaBox?.w, finiteOr(mark.width, finiteOr(mark.w, Array.isArray(mark.size) ? mark.size[0] : 80))), 1);
  const h = Math.max(finiteOr(ccaBox?.h, finiteOr(mark.height, finiteOr(mark.h, Array.isArray(mark.size) ? mark.size[1] : 80))), 1);
  const d = Math.max(finiteOr(ccaBox?.d, finiteOr(mark.depth, finiteOr(mark.d, Array.isArray(mark.size) ? mark.size[2] : 40))), 1);
  const z = finiteOr(mark.depthOffset, finiteOr(mark.z3, 0));
  const faceFilter = Array.isArray(mark.faces) ? new Set(mark.faces) : undefined;
  const facePolicy = resolveSolidFacePolicy(mark, faceFilter);
  if (ccaBox?.cornerProjection) {
    return expandCcaCornerCuboidPlanes({
      role: mark.role || `solid-${index + 1}`,
      projection: ccaBox.cornerProjection,
      fill: mark.fill || '#b1845e',
      stroke: mark.stroke || '#4f3928',
      strokeWidth: finiteOr(mark.strokeWidth, 0.9),
      sourceIndex: mark.sourceIndex ?? index,
      baseZ: finiteOr(mark.z, finiteOr(scene.view?.baseZ, 10)),
      vectorRole: mark.vectorRole || mark.role || `solid-${index + 1}`,
      faceFilter: facePolicy.filter,
    }).map((plane) => ({
      ...plane,
      ...facePolicyMetadata(facePolicy),
      constructionKind: mark.constructionKind,
      constructionRole: mark.constructionRole,
      formPrimitiveRole: mark.formPrimitiveRole,
      formPrimitiveMode: mark.formPrimitiveMode,
      formPrimitiveStock: mark.formPrimitiveStock,
      formMassTuning: mark.formMassTuning,
      speciesStock: mark.speciesStock,
      formPart: mark.formPart,
      partitionTarget: mark.partitionTarget,
      partitionAxis: mark.partitionAxis,
      partitionCount: mark.partitionCount,
      partitionBoardIndex: mark.partitionBoardIndex,
      partitionBoundary: mark.partitionBoundary,
      arrayIndex: mark.arrayIndex,
      arrayCount: mark.arrayCount,
      cubieLatticeRole: mark.cubieLatticeRole,
      cubieIndex: mark.cubieIndex,
      cubieCol: mark.cubieCol,
      cubieRow: mark.cubieRow,
      cubieLayer: mark.cubieLayer,
      cubieCount: mark.cubieCount,
      cubieCols: mark.cubieCols,
      cubieRows: mark.cubieRows,
      cubieLayers: mark.cubieLayers,
      cubieGap: mark.cubieGap,
      cubieCellSize: mark.cubieCellSize,
      cubieDepthMode: mark.cubieDepthMode,
      cubieFloorT: mark.cubieFloorT,
      cubiePerspectiveScale: mark.cubiePerspectiveScale,
      cubieWorldXYZ: mark.cubieWorldXYZ,
      mandalaFieldRole: mark.mandalaFieldRole,
      mandalaPathRole: mark.mandalaPathRole,
      mandalaSampleIndex: mark.mandalaSampleIndex,
      mandalaSampleCount: mark.mandalaSampleCount,
      mandalaWorldXY: mark.mandalaWorldXY,
      mandalaT: mark.mandalaT,
      mandalaScale: mark.mandalaScale,
      mandalaPinned: mark.mandalaPinned,
      mandalaPinRole: mark.mandalaPinRole,
      mandalaPinBounds: mark.mandalaPinBounds,
      mandalaPinAnchor: mark.mandalaPinAnchor,
      mandalaPinMode: mark.mandalaPinMode,
      solidKind: 'solid',
      ccaBlock: mark.ccaBlock || ccaBox?.ccaBlock,
      ccaSkinDefault: mark.ccaSkinDefault ?? Boolean(ccaBox),
      ccaSkinSource: ccaBox?.source,
      ccaWorldXYZ: ccaBox?.worldXYZ,
      ccaSizeXYZ: ccaBox?.sizeXYZ,
      solidDepthAnchor: ccaBox?.solidDepthAnchor,
      solidDepthProjection: ccaBox?.solidDepthProjection,
      solidProjectionMode: ccaBox?.solidProjectionMode,
      elementMandalaRole: ccaBox?.elementMandalaRole,
      elementMandalaPerspectiveScale: ccaBox?.elementMandalaPerspectiveScale,
      elementMandalaProjected: Boolean(ccaBox),
    }));
  }
  const camera = solidCamera(scene, Math.max(d + z, d), origin, {
    ...mark,
    solidDepthProjection: ccaBox?.solidDepthProjection || mark.solidDepthProjection,
  });
  const planes = expandCuboidPlanes({
    role: mark.role || `solid-${index + 1}`,
    box: {
      x: 0,
      y: 0,
      z,
      w,
      h,
      d,
      shearX: finiteOr(mark.shearX, 0),
    },
    fill: mark.fill || '#b1845e',
    stroke: mark.stroke || '#4f3928',
    strokeWidth: finiteOr(mark.strokeWidth, 0.9),
    sourceIndex: mark.sourceIndex ?? index,
    baseZ: finiteOr(mark.z, finiteOr(scene.view?.baseZ, 10)),
    camera,
    solidPresetRef: undefined,
    solidPresetRole: undefined,
    vectorRole: mark.vectorRole || mark.role || `solid-${index + 1}`,
    faceFilter: facePolicy.filter,
  });

  return planes.map((plane) => ({
    ...plane,
    ...facePolicyMetadata(facePolicy),
    constructionKind: mark.constructionKind,
    constructionRole: mark.constructionRole,
    formPrimitiveRole: mark.formPrimitiveRole,
    formPrimitiveMode: mark.formPrimitiveMode,
    formPrimitiveStock: mark.formPrimitiveStock,
    formMassTuning: mark.formMassTuning,
    speciesStock: mark.speciesStock,
    formPart: mark.formPart,
    partitionTarget: mark.partitionTarget,
    partitionAxis: mark.partitionAxis,
    partitionCount: mark.partitionCount,
    partitionBoardIndex: mark.partitionBoardIndex,
    partitionBoundary: mark.partitionBoundary,
    arrayIndex: mark.arrayIndex,
    arrayCount: mark.arrayCount,
    cubieLatticeRole: mark.cubieLatticeRole,
    cubieIndex: mark.cubieIndex,
    cubieCol: mark.cubieCol,
    cubieRow: mark.cubieRow,
    cubieLayer: mark.cubieLayer,
    cubieCount: mark.cubieCount,
    cubieCols: mark.cubieCols,
    cubieRows: mark.cubieRows,
    cubieLayers: mark.cubieLayers,
    cubieGap: mark.cubieGap,
    cubieCellSize: mark.cubieCellSize,
    cubieDepthMode: mark.cubieDepthMode,
    cubieFloorT: mark.cubieFloorT,
    cubiePerspectiveScale: mark.cubiePerspectiveScale,
    cubieWorldXYZ: mark.cubieWorldXYZ,
    mandalaFieldRole: mark.mandalaFieldRole,
    mandalaPathRole: mark.mandalaPathRole,
    mandalaSampleIndex: mark.mandalaSampleIndex,
    mandalaSampleCount: mark.mandalaSampleCount,
    mandalaWorldXY: mark.mandalaWorldXY,
    mandalaT: mark.mandalaT,
    mandalaScale: mark.mandalaScale,
    mandalaPinned: mark.mandalaPinned,
    mandalaPinRole: mark.mandalaPinRole,
    mandalaPinBounds: mark.mandalaPinBounds,
    mandalaPinAnchor: mark.mandalaPinAnchor,
    mandalaPinMode: mark.mandalaPinMode,
    solidKind: 'solid',
    points: plane.points.map(([px, py]) => [roundPoint(px + origin[0]), roundPoint(py + origin[1])]),
    depthAnchor: [roundPoint(plane.depthAnchor[0] + origin[0]), roundPoint(plane.depthAnchor[1] + origin[1])],
    vanishingPoint: Array.isArray(plane.vanishingPoint)
      ? [roundPoint(plane.vanishingPoint[0] + origin[0]), roundPoint(plane.vanishingPoint[1] + origin[1])]
      : plane.vanishingPoint,
    ccaBlock: mark.ccaBlock || ccaBox?.ccaBlock,
    ccaSkinDefault: mark.ccaSkinDefault ?? Boolean(ccaBox),
    ccaSkinSource: ccaBox?.source,
    ccaWorldXYZ: ccaBox?.worldXYZ,
    ccaSizeXYZ: ccaBox?.sizeXYZ,
    solidDepthAnchor: ccaBox?.solidDepthAnchor,
    solidDepthProjection: ccaBox?.solidDepthProjection,
    elementMandalaRole: ccaBox?.elementMandalaRole,
    elementMandalaPerspectiveScale: ccaBox?.elementMandalaPerspectiveScale,
    elementMandalaProjected: Boolean(ccaBox),
  }));
}

function resolveSolidFacePolicy(mark, explicitFilter) {
  if (explicitFilter) {
    return { filter: explicitFilter, mode: 'explicit-faces', hiddenFaces: hiddenCuboidFaces(explicitFilter) };
  }
  const cullMode = mark.faceCull || mark.cullFace || mark.hiddenFaceMode || mark.solidFaceCull;
  if (cullMode === 'vanishing-facing' || cullMode === 'hide-vanishing-face' || cullMode === 'hide-back') {
    const filter = new Set(['front', 'left', 'right', 'top', 'bottom']);
    return { filter, mode: 'hide-back', hiddenFaces: ['back'] };
  }
  return { filter: undefined, mode: null, hiddenFaces: [] };
}

function facePolicyMetadata(policy) {
  if (!policy?.mode) return {};
  return {
    vectorFacePolicy: 'solve-complete-render-visible',
    faceCull: policy.mode,
    hiddenConstructionFaces: policy.hiddenFaces,
  };
}

function annotateContactRegions(marks) {
  if (!Array.isArray(marks)) return marks;
  return marks.map((mark) => {
    if (mark?.kind !== 'polygon' || !Array.isArray(mark.points) || mark.points.length < 3) return mark;
    return {
      ...mark,
      contactRegions: polygonContactRegions(mark.points),
    };
  });
}

function polygonContactRegions(points) {
  const bounds = bbox(points);
  const bottom = polygonEdgeAtY(points, Math.max, bounds.maxY);
  const top = polygonEdgeAtY(points, Math.min, bounds.minY);
  const left = polygonEdgeAtX(points, Math.min, bounds.minX);
  const right = polygonEdgeAtX(points, Math.max, bounds.maxX);
  return {
    bounds: {
      x: roundPoint(bounds.minX),
      y: roundPoint(bounds.minY),
      width: roundPoint(bounds.w),
      height: roundPoint(bounds.h),
    },
    polygon: points.map((point) => point.map(roundPoint)),
    baseContact: bottom,
    bottomContact: bottom,
    topContact: top,
    leftContact: left,
    rightContact: right,
    center: [roundPoint(bounds.minX + bounds.w / 2), roundPoint(bounds.minY + bounds.h / 2)],
  };
}

function polygonEdgeAtY(points, reducer, fallbackY) {
  const y = points.map((point) => point[1]).reduce(reducer);
  const candidates = points.filter((point) => Math.abs(point[1] - y) < 0.01);
  const edge = candidates.length >= 2
    ? candidates.sort((a, b) => a[0] - b[0]).slice(0, 2)
    : [
        [Math.min(...points.map((point) => point[0])), fallbackY],
        [Math.max(...points.map((point) => point[0])), fallbackY],
      ];
  return edge.map((point) => point.map(roundPoint));
}

function polygonEdgeAtX(points, reducer, fallbackX) {
  const x = points.map((point) => point[0]).reduce(reducer);
  const candidates = points.filter((point) => Math.abs(point[0] - x) < 0.01);
  const edge = candidates.length >= 2
    ? candidates.sort((a, b) => a[1] - b[1]).slice(0, 2)
    : [
        [fallbackX, Math.min(...points.map((point) => point[1]))],
        [fallbackX, Math.max(...points.map((point) => point[1]))],
      ];
  return edge.map((point) => point.map(roundPoint));
}

function validateContactChecks(marks, manifest, surfaces = []) {
  const raw = manifest?.polygonizer?.contactChecks || manifest?.scene?.contactChecks || [];
  const checks = Array.isArray(raw) ? raw : [];
  return {
    checks: checks.map((check, index) => validateContactCheck(check, index, marks, surfaces)),
  };
}

function resolveMetamandalaSurfaces(marks, manifest) {
  const meta = manifest?.polygonizer?.metamandala
    ? { ...manifest.polygonizer.metamandala, constellation: manifest.polygonizer?.constellation }
    : null;
  const raw = Array.isArray(meta?.surfaces) ? meta.surfaces : [];
  if (!raw.length) return { surfaces: [], debugMarks: [] };
  const surfaces = raw
    .map((surface, index) => resolveMetamandalaSurface(surface, index, marks, meta))
    .filter(Boolean);
  const debugMarks = (meta.debugVisible || surfaces.some((surface) => surface.debugLaser))
    ? surfaces.flatMap((surface) => metamandalaDebugMarks(surface, meta))
    : [];
  return { surfaces, debugMarks };
}

function resolveMetamandalaSurface(surface, index, marks, meta = {}) {
  const role = surface?.role || `metamandala-surface-${index + 1}`;
  if (surface?.kind === 'fromHitbox' || surface?.hitboxRole) {
    const hitbox = findConstellationHitbox(surface, meta);
    if (!hitbox) return null;
    const bounds = hitbox.bounds;
    const rail = resolveHitboxSupportRail(surface, hitbox);
    const y = finiteOr(surface.y, rail.y);
    const pad = finiteOr(surface.pad, 0);
    const x1 = finiteOr(surface.x1, rail.x1 - pad);
    const x2 = finiteOr(surface.x2, rail.x2 + pad);
    const origin = validPoint(surface.origin) || [x1, y];
    const yTop = finiteOr(surface.yTop, y - Math.max(finiteOr(surface.height, 70), 20));
    return {
      role,
      kind: 'fromHitbox',
      source: 'constellation-hitbox',
      nodeRole: hitbox.nodeRole,
      hitboxRole: hitbox.role,
      origin: origin.map(roundPoint),
      xAxis: [[roundPoint(x1), roundPoint(y)], [roundPoint(x2), roundPoint(y)]],
      yAxis: [[roundPoint(origin[0]), roundPoint(y)], [roundPoint(origin[0]), roundPoint(yTop)]],
      supportBounds: roundMandalaBounds(bounds),
      supportRail: {
        mode: rail.mode,
        t: round(rail.t),
        y: roundPoint(y),
      },
      z: finiteOr(surface.z, finiteOr(hitbox.z, 0)),
      debugLaser: surface.debugLaser ?? meta.debugVisible ?? false,
      sampleCount: 1,
    };
  }
  if (surface?.kind === 'fromContact' || surface?.fromRole) {
    const contacts = contactCandidates(marks, surface.fromRole, surface.fromRegion || 'topContact')
      .filter((item) => !surface.face || item.mark.face === surface.face);
    const points = contacts.flatMap((item) => regionPoints(item.region));
    if (!points.length) return null;
    const b = bbox(points);
    const y = surface.y !== undefined ? finiteOr(surface.y, (b.minY + b.maxY) / 2) : (b.minY + b.maxY) / 2;
    const pad = finiteOr(surface.pad, 18);
    const x1 = finiteOr(surface.x1, b.minX - pad);
    const x2 = finiteOr(surface.x2, b.maxX + pad);
    const origin = validPoint(surface.origin) || [x1, y];
    const yTop = finiteOr(surface.yTop, y - Math.max(finiteOr(surface.height, 70), 20));
    return {
      role,
      kind: 'fromContact',
      source: 'contact-region',
      fromRole: surface.fromRole,
      fromRegion: surface.fromRegion || 'topContact',
      origin: origin.map(roundPoint),
      xAxis: [[roundPoint(x1), roundPoint(y)], [roundPoint(x2), roundPoint(y)]],
      yAxis: [[roundPoint(origin[0]), roundPoint(y)], [roundPoint(origin[0]), roundPoint(yTop)]],
      z: finiteOr(surface.z, 0),
      debugLaser: surface.debugLaser ?? meta.debugVisible ?? false,
      sampleCount: contacts.length,
    };
  }
  const origin = validPoint(surface?.origin) || [0, 0];
  const xAxis = validLine(surface?.xAxis) || [[origin[0] - 40, origin[1]], [origin[0] + 120, origin[1]]];
  const yAxis = validLine(surface?.yAxis) || [[origin[0], origin[1]], [origin[0], origin[1] - 80]];
  return {
    role,
    kind: surface?.kind || 'explicit',
    source: 'explicit',
    origin: origin.map(roundPoint),
    xAxis: xAxis.map((point) => point.map(roundPoint)),
    yAxis: yAxis.map((point) => point.map(roundPoint)),
    z: finiteOr(surface?.z, 0),
    debugLaser: surface?.debugLaser ?? meta.debugVisible ?? false,
  };
}

function findConstellationHitbox(surface, meta = {}) {
  const nodes = Array.isArray(meta?.constellation?.nodes) ? meta.constellation.nodes : [];
  const nodeRole = surface.nodeRole || surface.fromNodeRole;
  const hitboxRole = surface.hitboxRole || surface.fromHitboxRole || surface.role;
  for (const node of nodes) {
    if (nodeRole && node?.role !== nodeRole) continue;
    const hitboxes = Array.isArray(node?.hitboxes) ? node.hitboxes : [];
    for (const hitbox of hitboxes) {
      if (hitboxRole && hitbox?.role !== hitboxRole) continue;
      const bounds = normalizeHitboxBounds(hitbox, node);
      if (!bounds) continue;
      return {
        ...hitbox,
        bounds,
        nodeRole: node.role,
      };
    }
  }
  return null;
}

function resolveHitboxSupportRail(surface, hitbox) {
  const bounds = hitbox.bounds;
  const mode = surface.rail || surface.supportRail || hitbox.rail || hitbox.supportRail || 'back';
  const explicitT = surface.railT ?? surface.supportT ?? hitbox.railT ?? hitbox.supportT;
  let t;
  if (explicitT !== undefined) {
    t = finiteOr(explicitT, 0);
  } else if (mode === 'front' || mode === 'front-safe' || mode === 'near') {
    t = 1;
  } else if (mode === 'center' || mode === 'middle') {
    t = 0.5;
  } else if (mode === 'safe' || mode === 'standing' || mode === 'safe-standing') {
    t = 0.72;
  } else {
    t = 0;
  }
  t = clamp(t, 0, 1);
  return {
    mode,
    t,
    x1: bounds.x,
    x2: bounds.x + bounds.width,
    y: bounds.y + bounds.height * t,
  };
}

function normalizeHitboxBounds(hitbox, node) {
  const raw = hitbox?.bounds || hitbox;
  if (!raw || typeof raw !== 'object') return null;
  const nodeBounds = node?.bounds;
  const relative = hitbox.relative === true || hitbox.units === 'node' || hitbox.space === 'node';
  const baseX = relative ? finiteOr(nodeBounds?.x, 0) : 0;
  const baseY = relative ? finiteOr(nodeBounds?.y, 0) : 0;
  const baseW = relative ? finiteOr(nodeBounds?.width, 1) : 1;
  const baseH = relative ? finiteOr(nodeBounds?.height, 1) : 1;
  const x = relative ? baseX + finiteOr(raw.x, 0) * baseW : finiteOr(raw.x, 0);
  const y = relative ? baseY + finiteOr(raw.y, 0) * baseH : finiteOr(raw.y, 0);
  const width = Math.max(relative ? finiteOr(raw.width, 1) * baseW : finiteOr(raw.width, 0), 0.001);
  const height = Math.max(relative ? finiteOr(raw.height, 1) * baseH : finiteOr(raw.height, 0), 0.001);
  return { x, y, width, height };
}

function applyMetamandalaRelaxation(marks, surfaces, manifest) {
  const config = manifest?.polygonizer?.metamandala?.relaxation;
  const rules = Array.isArray(config?.rules) ? config.rules : [];
  if (!config?.enabled || !rules.length || !Array.isArray(marks)) {
    return { marks, applied: false, adjustments: [] };
  }
  let current = marks;
  const adjustments = [];
  for (const rule of rules) {
    const surface = surfaces.find((item) => item.role === rule.surfaceRole);
    if (!surface?.xAxis) continue;
    const targetRole = rule.targetRole || rule.fromRole || rule.role;
    if (!targetRole) continue;
    const targetRegion = rule.region || rule.targetRegion || 'baseContact';
    const candidates = contactCandidates(current, targetRole, targetRegion);
    const candidatePoints = candidates.flatMap((item) => regionPoints(item.region));
    if (!candidatePoints.length) continue;
    const candidateBounds = bbox(candidatePoints);
    const currentY = Math.max(...candidatePoints.map((point) => point[1]));
    const surfaceY = average(surface.xAxis.flatMap((point) => [point[1]]));
    if (!shouldApplyMetamandalaRelaxation(rule, config, candidateBounds, currentY, surface, surfaceY)) continue;
    const clearance = finiteOr(rule.clearance, finiteOr(config.clearance, 0));
    const desiredY = surfaceY - clearance;
    const maxDelta = Math.abs(finiteOr(rule.maxDelta, finiteOr(config.maxDelta, 120)));
    const dy = roundPoint(clamp(desiredY - currentY, -maxDelta, maxDelta));
    const alignX = rule.alignX || rule.align === 'center' || rule.align === 'center-on-surface';
    const surfaceCenterX = surface.supportBounds
      ? surface.supportBounds.x + surface.supportBounds.width / 2
      : average(surface.xAxis.map((point) => point[0]));
    const currentCenterX = candidateBounds.minX + candidateBounds.w / 2;
    const dxRaw = alignX ? surfaceCenterX - currentCenterX : finiteOr(rule.dx, 0);
    const maxDeltaX = Math.abs(finiteOr(rule.maxDeltaX, finiteOr(rule.maxDelta, finiteOr(config.maxDelta, 120))));
    const dx = roundPoint(clamp(dxRaw, -maxDeltaX, maxDeltaX));
    const roles = [targetRole, ...(Array.isArray(rule.includeRoles) ? rule.includeRoles : [])];
    const paintZ = resolveRelaxedPaintZ(current, rule, surface);
    if (Math.abs(dy) < 0.01 && Math.abs(dx) < 0.01 && paintZ === null) continue;
    current = current.map((mark) => {
      if (!roles.some((role) => markMatchesContactRole(mark, role))) return mark;
      const nextZ = paintZ === null ? mark.z : paintZ;
      return {
        ...offsetMark(mark, dx, dy),
        z: nextZ,
        metamandalaRelaxed: true,
        metamandalaRelaxationRole: rule.role || targetRole,
        metamandalaRelaxationSurface: surface.role,
        metamandalaRelaxationDelta: [dx, dy],
      };
    });
    current = annotateContactRegions(current);
    adjustments.push({
      role: rule.role || targetRole,
      targetRole,
      surfaceRole: surface.role,
      reason: rule.reason || 'support-clearance',
      delta: [dx, dy],
      currentY: roundPoint(currentY),
      desiredY: roundPoint(desiredY),
      currentCenterX: roundPoint(currentCenterX),
      desiredCenterX: roundPoint(surfaceCenterX),
      paintZ,
    });
  }
  return { marks: current, applied: adjustments.length > 0, adjustments };
}

function shouldApplyMetamandalaRelaxation(rule, config, candidateBounds, currentY, surface, surfaceY) {
  if (rule.force === true || rule.forceRelaxation === true) return true;
  const requireOverlap = rule.requireMandalaOverlap ?? config.requireMandalaOverlap ?? true;
  if (requireOverlap && !boundsOverlapMetamandalaSupport(candidateBounds, surface)) return false;
  const clearance = finiteOr(rule.clearance, finiteOr(config.clearance, 0));
  const targetAlreadyBehindRail = currentY < surfaceY - clearance - 0.01;
  if (targetAlreadyBehindRail && rule.allowPullForward !== true && config.allowPullForward !== true) {
    return false;
  }
  return true;
}

function boundsOverlapMetamandalaSupport(bounds, surface) {
  if (!bounds || !surface?.xAxis) return true;
  const supportBounds = surface.supportBounds;
  const supportMinX = supportBounds
    ? supportBounds.x
    : Math.min(...surface.xAxis.map((point) => point[0]));
  const supportMaxX = supportBounds
    ? supportBounds.x + supportBounds.width
    : Math.max(...surface.xAxis.map((point) => point[0]));
  return rangesOverlap(bounds.minX, bounds.maxX, supportMinX, supportMaxX);
}

function rangesOverlap(aMin, aMax, bMin, bMax) {
  return aMin <= bMax && aMax >= bMin;
}

function resolveRelaxedPaintZ(marks, rule, surface) {
  if (rule.paintZ !== undefined) return finiteOr(rule.paintZ, null);
  const supportRole = rule.paintAboveRole || rule.supportRole || surface.fromRole || surface.nodeRole || surface.hitboxRole;
  const supportMarks = supportRole
    ? marks.filter((mark) => markMatchesContactRole(mark, supportRole))
    : [];
  const paintByAdjacency = rule.paintByAdjacency !== false &&
    (rule.paintAboveSupport || rule.paintAboveRole || rule.surfaceRole || surface.role);
  if (!paintByAdjacency && !rule.paintAboveSupport && !rule.paintAboveRole) return null;
  const supportMax = supportMarks.length
    ? Math.max(...supportMarks.map((mark) => finiteOr(mark.z, 0)))
    : finiteOr(surface.z, 0);
  const offset = rule.paintOffset !== undefined
    ? finiteOr(rule.paintOffset, 1)
    : rule.paintAboveSupport || rule.paintAboveRole ? 0.25 : 1;
  return roundPoint(supportMax + offset);
}

function metamandalaDebugMarks(surface, meta = {}) {
  const color = surface.color || meta.color || '#45d6ff';
  const origin = surface.origin;
  const z = finiteOr(meta.z, 960) + finiteOr(surface.z, 0) * 0.001;
  return [
    {
      kind: 'polyline',
      role: `metamandala:${surface.role}:x-laser`,
      points: surface.xAxis,
      stroke: color,
      strokeWidth: finiteOr(meta.strokeWidth, 1.2),
      fill: 'none',
      opacity: meta.opacity ?? 0.62,
      dash: meta.dash || '5 5',
      z,
      source: true,
      metamandalaDebug: true,
      metamandalaSurfaceRole: surface.role,
      constructionKind: 'metamandala',
    },
    {
      kind: 'polyline',
      role: `metamandala:${surface.role}:y-laser`,
      points: surface.yAxis,
      stroke: surface.yColor || meta.yColor || '#ffcf5a',
      strokeWidth: finiteOr(meta.strokeWidth, 1.2),
      fill: 'none',
      opacity: meta.opacity ?? 0.56,
      dash: meta.dash || '4 4',
      z: z + 0.01,
      source: true,
      metamandalaDebug: true,
      metamandalaSurfaceRole: surface.role,
      constructionKind: 'metamandala',
    },
    {
      kind: 'circle',
      role: `metamandala:${surface.role}:origin`,
      cx: roundPoint(origin[0]),
      cy: roundPoint(origin[1]),
      r: finiteOr(meta.originRadius, 3.2),
      fill: color,
      stroke: '#ffffff',
      strokeWidth: 0.6,
      opacity: meta.opacity ?? 0.7,
      z: z + 0.02,
      source: true,
      metamandalaDebug: true,
      metamandalaSurfaceRole: surface.role,
      constructionKind: 'metamandala',
    },
    {
      kind: 'text',
      role: `metamandala:${surface.role}:label`,
      x: roundPoint(origin[0] + 6),
      y: roundPoint(origin[1] - 6),
      value: surface.label || surface.role,
      size: finiteOr(meta.labelSize, 10),
      anchor: 'start',
      color,
      opacity: meta.labelOpacity ?? 0.82,
      z: z + 0.03,
      source: true,
      metamandalaDebug: true,
      metamandalaSurfaceRole: surface.role,
      constructionKind: 'metamandala',
    },
  ];
}

function validateContactCheck(check, index, marks, surfaces = []) {
  const tolerance = Math.max(finiteOr(check?.tolerance, 3), 0);
  const from = check?.fromSurfaceRole
    ? surfaceContactCandidates(surfaces, check.fromSurfaceRole)
    : contactCandidates(marks, check?.fromRole, check?.fromRegion || 'baseContact');
  const to = check?.toSurfaceRole
    ? surfaceContactCandidates(surfaces, check.toSurfaceRole)
    : contactCandidates(marks, check?.toRole, check?.toRegion || 'polygon');
  const mode = check?.mode || 'touches';
  let ok = false;
  for (const a of from) {
    for (const b of to) {
      if (contactRegionsMatch(a.region, b.region, mode, tolerance)) ok = true;
    }
  }
  return {
    role: check?.role || `contact-${index + 1}`,
    mode,
    fromRole: check?.fromRole,
    fromSurfaceRole: check?.fromSurfaceRole,
    fromRegion: check?.fromRegion || 'baseContact',
    toRole: check?.toRole,
    toSurfaceRole: check?.toSurfaceRole,
    toRegion: check?.toRegion || 'polygon',
    tolerance,
    ok,
    fromCandidates: from.length,
    toCandidates: to.length,
  };
}

function surfaceContactCandidates(surfaces, role) {
  const surface = surfaces.find((item) => item.role === role);
  if (!surface?.xAxis) return [];
  return [{
    surface,
    region: surface.xAxis,
  }];
}

function contactCandidates(marks, role, regionName) {
  if (!role) return [];
  return marks
    .filter((mark) => mark?.contactRegions && markMatchesContactRole(mark, role))
    .map((mark) => ({ mark, region: mark.contactRegions?.[regionName] }))
    .filter((item) => item.region);
}

function markMatchesContactRole(mark, role) {
  const target = String(role);
  return [mark.role, mark.solidRole, mark.vectorRole]
    .filter(Boolean)
    .some((value) => {
      const text = String(value);
      return text === target || text.startsWith(`${target}-`) || text.startsWith(`${target}:`);
    });
}

function contactRegionsMatch(a, b, mode, tolerance) {
  if (mode === 'inside') return regionInsidePolygon(a, b, tolerance);
  if (mode === 'intersects') return regionsIntersect(a, b, tolerance);
  return regionDistance(a, b) <= tolerance;
}

function regionsIntersect(a, b, tolerance = 0) {
  const ab = regionBounds(a);
  const bb = regionBounds(b);
  if (!ab || !bb) return false;
  return ab.minX <= bb.maxX + tolerance &&
    ab.maxX + tolerance >= bb.minX &&
    ab.minY <= bb.maxY + tolerance &&
    ab.maxY + tolerance >= bb.minY;
}

function regionInsidePolygon(region, polygon, tolerance = 0) {
  const points = regionPoints(region);
  const poly = regionPoints(polygon);
  if (!points.length || poly.length < 3) return false;
  return points.every((point) => pointInPolygon(point, poly) || distancePointToRegion(point, poly) <= tolerance);
}

function regionDistance(a, b) {
  const ap = regionPoints(a);
  const bp = regionPoints(b);
  if (!ap.length || !bp.length) return Infinity;
  let best = Infinity;
  for (const p of ap) {
    best = Math.min(best, distancePointToRegion(p, bp));
  }
  for (const p of bp) {
    best = Math.min(best, distancePointToRegion(p, ap));
  }
  return best;
}

function distancePointToRegion(point, regionPoints) {
  if (!regionPoints.length) return Infinity;
  let best = Infinity;
  for (let i = 0; i < regionPoints.length; i++) {
    const a = regionPoints[i];
    const b = regionPoints[(i + 1) % regionPoints.length];
    best = Math.min(best, distancePointToSegment(point, a, b));
  }
  return best;
}

function distancePointToSegment(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1]];
  const denom = dot(ab, ab);
  if (denom <= 1e-9) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = clamp(dot([p[0] - a[0], p[1] - a[1]], ab) / denom, 0, 1);
  return Math.hypot(p[0] - (a[0] + ab[0] * t), p[1] - (a[1] + ab[1] * t));
}

function regionBounds(region) {
  const points = regionPoints(region);
  if (!points.length) return null;
  return bbox(points);
}

function regionPoints(region) {
  if (!region) return [];
  if (Array.isArray(region) && region.length === 2 && Number.isFinite(Number(region[0])) && Number.isFinite(Number(region[1]))) {
    return [[Number(region[0]), Number(region[1])]];
  }
  if (Array.isArray(region)) {
    return region.filter((point) => validPoint(point)).map((point) => [Number(point[0]), Number(point[1])]);
  }
  if (region && typeof region === 'object' && Number.isFinite(Number(region.x))) {
    return [
      [region.x, region.y],
      [region.x + region.width, region.y],
      [region.x + region.width, region.y + region.height],
      [region.x, region.y + region.height],
    ];
  }
  return [];
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersects = ((yi > point[1]) !== (yj > point[1])) &&
      (point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function hiddenCuboidFaces(filter) {
  return ['back', 'front', 'left', 'right', 'top', 'bottom'].filter((face) => !filter.has(face));
}

function resolveCcaSolidBox(mark, manifest) {
  const xyz = validXYZ(mark.xyz || mark.worldXYZ || mark.localXYZ);
  const sizeXYZ = validXYZ(mark.sizeXYZ || mark.unitsXYZ || mark.unitSize || mark.sizeU);
  if (!xyz || !sizeXYZ) return null;
  const role = mark.mandalaRole || mark.elementMandalaRole || mark.elementRole || mark.role;
  const elementSpace = findElementMandalaSpace(manifest, role);
  if (!elementSpace?.topDown?.camera) return null;
  const unitScale = Math.max(finiteOr(elementSpace.topDown.camera.unitScale, 1), 1);
  const bottom = projectMandalaPoint({ camera: elementSpace.topDown.camera }, { x: xyz[0], y: xyz[1], z: xyz[2] });
  const depthScale = clamp(finiteOr(elementSpace.topDown.camera.depthScale, 1), 0.2, 1);
  const perspectiveScale = Math.pow(depthScale, Math.max(0, -xyz[1]));
  const faceWidth = Math.max(sizeXYZ[0] * unitScale * perspectiveScale, 1);
  const depthLength = Math.max(sizeXYZ[1] * unitScale * perspectiveScale, 1);
  const h = Math.max(sizeXYZ[2] * unitScale * perspectiveScale, 1);
  const widthMode = mark.solidFaceWidthMode || mark.faceWidthMode || mark.ccaFaceWidthMode;
  const w = Math.max((widthMode === 'length' ? depthLength : faceWidth), 1);
  const d = Math.max((widthMode === 'length' ? faceWidth : depthLength) * 0.48, 1);
  const depthProjection = resolveSolidDepthProjection(mark, elementSpace);
  const depthAnchorMode = mark.solidDepthAnchor || mark.depthAnchorMode || (mark.frontAnchored ? 'front' : 'back');
  const depthAnchorOffset =
    depthAnchorMode === 'front' && depthProjection
      ? [depthProjection[0] * d, depthProjection[1] * d]
      : [0, 0];
  return {
    origin: [
      roundPoint(bottom[0] - w / 2 - depthAnchorOffset[0]),
      roundPoint(bottom[1] - h - depthAnchorOffset[1]),
    ],
    w,
    h,
    d,
    worldXYZ: xyz.map(round),
    sizeXYZ: sizeXYZ.map(round),
    elementMandalaRole: elementSpace.role,
    elementMandalaPerspectiveScale: round(perspectiveScale),
    source: 'xyz-element-mandala',
    ccaBlock: true,
    solidDepthAnchor: depthAnchorMode,
    solidDepthProjection: depthProjection?.map(roundClean),
    solidProjectionMode: mark.solidProjectionMode || mark.ccaProjectionMode || mark.projectionMode,
    cornerProjection: shouldUseCcaCornerProjection(mark)
      ? buildCcaCornerProjection({
          anchor: bottom,
          w,
          h,
          d,
          depthProjection,
          camera: elementSpace.topDown.camera,
          elementSpace,
          mark,
          depthAnchorMode,
          projectionMode: mark.solidProjectionMode || mark.ccaProjectionMode || mark.projectionMode,
          perspectiveStrength: finiteOr(mark.solidPerspectiveStrength ?? mark.perspectiveStrength, 0.16),
        })
      : null,
  };
}

function findElementMandalaSpace(manifest, role) {
  const spaces = manifest?.polygonizer?.elementMandala?.elements;
  if (!Array.isArray(spaces) || !role) return null;
  return spaces.find((space) => space?.role === role) || null;
}

function resolveSolidDepthProjection(mark, elementSpace) {
  const requested = mark.solidDepthProjection || mark.depthProjection || mark.genesisDepthProjection;
  const explicit = validPoint(requested);
  if (explicit) return explicit;
  if (requested === 'constellation-guide-line' || requested === 'structural-guide-line' || requested === 'guide-line') {
    return constellationStructuralGuideProjection(elementSpace);
  }
  if (requested === 'constellation-grid-line' || requested === 'constellationGenesisLine' || requested === 'grid-line') {
    return constellationGridLineProjection(elementSpace);
  }
  return null;
}

function shouldUseCcaCornerProjection(mark) {
  const mode = mark.solidProjectionMode || mark.ccaProjectionMode || mark.projectionMode;
  return mode === 'corner' ||
    mode === 'projected-corners' ||
    mode === 'room-cuboid' ||
    mode === 'perspective-corner' ||
    mode === 'constellation-hit-cuboid';
}

function buildCcaCornerProjection({ anchor, w, h, d, depthProjection, camera, elementSpace, mark, depthAnchorMode, projectionMode, perspectiveStrength }) {
  const widthAxis = [1, 0];
  const depthAxis = normalize(depthProjection || validPoint(camera?.north) || [0, 1]);
  const heightAxis = normalize(validPoint(camera?.zenith) || [0, -1]);
  const guideLine = resolveStructuralGuideLine(elementSpace);
  const guideEdge = mark.solidGuideEdge || mark.guideEdge || elementSpace?.boundTo?.cca?.guideEdge || null;
  const upperGuideLine = resolveUpperStructuralGuideLine({ elementSpace, guideLine, heightAxis, height: h, guideEdge });
  const verticalMode = mark.solidVerticalMode ||
    mark.verticalMode ||
    mark.ccaVerticalMode ||
    elementSpace?.boundTo?.cca?.verticalMode ||
    elementSpace?.boundTo?.cca?.solidVerticalMode ||
    null;
  return {
    anchor: anchor.map(roundPoint),
    widthAxis: widthAxis.map(roundClean),
    depthAxis: depthAxis.map(roundClean),
    heightAxis: heightAxis.map(roundClean),
    width: round(w),
    depth: round(d),
    height: round(h),
    depthAnchorMode,
    perspective: projectionMode === 'perspective-corner',
    hitPointMode: projectionMode === 'constellation-hit-cuboid',
    perspectiveStrength: clamp(finiteOr(perspectiveStrength, 0.16), 0, 0.45),
    guideLine,
    upperGuideLine,
    guideEdge,
    verticalMode,
  };
}

function constellationGridLineProjection(elementSpace) {
  const cca = elementSpace?.boundTo?.cca || {};
  const axis =
    validLine(cca.genesisAxis) ||
    validLine(cca.generationAxis) ||
    validLine(cca.gridLine) ||
    validLine(cca.lengthAxis) ||
    validLine(cca.depthAxis?.line);
  if (!axis) return null;
  const mode = cca.genesisAxisMode || cca.generationAxisMode || 'front-to-back';
  const direction = normalize([
    axis[1][0] - axis[0][0],
    axis[1][1] - axis[0][1],
  ]);
  if (mode === 'back-to-front' || mode === 'toward-camera' || mode === 'projection') return direction;
  return [-direction[0], -direction[1]];
}

function constellationStructuralGuideProjection(elementSpace) {
  const cca = elementSpace?.boundTo?.cca || {};
  const axis = resolveStructuralGuideLine(elementSpace);
  if (!axis) return constellationGridLineProjection(elementSpace);
  const mode = cca.guideLineMode || cca.structuralGuideLineMode || 'projection';
  const direction = normalize([
    axis[1][0] - axis[0][0],
    axis[1][1] - axis[0][1],
  ]);
  if (mode === 'back-to-front' || mode === 'toward-camera' || mode === 'projection') return direction;
  return [-direction[0], -direction[1]];
}

function resolveStructuralGuideLine(elementSpace) {
  const cca = elementSpace?.boundTo?.cca || {};
  return validLine(cca.guideLine) ||
    validLine(cca.structuralGuideLine) ||
    validLine(cca.aisleGuideLine) ||
    validLine(cca.roadGuideLine) ||
    validLine(cca.depthAxis?.guideLine);
}

function resolveUpperStructuralGuideLine({ elementSpace, guideLine, heightAxis, height, guideEdge }) {
  const cca = elementSpace?.boundTo?.cca || {};
  const explicit =
    validLine(cca.upperGuideLine) ||
    validLine(cca.wallGuideLine) ||
    validLine(cca.ceilingGuideLine) ||
    validLine(cca.heightGuideLine);
  if (explicit) return explicit;
  const line = validLine(guideLine);
  if (!line) return null;
  const mode = cca.upperGuideMode || cca.guideUpperMode || cca.heightGuideMode;
  if (mode !== 'height-layer') return null;
  const direction = structuralGuideDirection({ cca, line });
  const length = finiteOr(cca.upperGuideLength ?? cca.guideUpperLength, Math.hypot(line[1][0] - line[0][0], line[1][1] - line[0][1]));
  const start = [
    line[0][0] + heightAxis[0] * height,
    line[0][1] + heightAxis[1] * height,
  ];
  return [
    [roundPoint(start[0]), roundPoint(start[1])],
    [roundPoint(start[0] + direction[0] * length), roundPoint(start[1] + direction[1] * length)],
  ];
}

function structuralGuideDirection({ cca, line }) {
  const direction = normalize([
    line[1][0] - line[0][0],
    line[1][1] - line[0][1],
  ]);
  const mode = cca.guideLineMode || cca.structuralGuideLineMode || 'projection';
  if (mode === 'front-to-back' || mode === 'away-from-camera') return [-direction[0], -direction[1]];
  return direction;
}

function validLine(value) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const a = validPoint(value[0]);
  const b = validPoint(value[1]);
  return a && b ? [a, b] : null;
}

function roundClean(value) {
  const rounded = round(value);
  return Object.is(rounded, -0) ? 0 : rounded;
}

function validXYZ(value) {
  if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every((item) => Number.isFinite(Number(item)))) {
    return value.slice(0, 3).map(Number);
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const x = value.x ?? value.width;
    const y = value.y ?? value.length ?? value.depth;
    const z = value.z ?? value.height ?? value.altitude;
    if ([x, y, z].every((item) => Number.isFinite(Number(item)))) return [Number(x), Number(y), Number(z)];
  }
  return null;
}

function expandCylinderMark(mark, index, scene) {
  const anchor = Array.isArray(mark.anchor) ? mark.anchor : [mark.cx, mark.cy];
  const cx = finiteOr(anchor[0], finiteOr(mark.x, 0) + finiteOr(mark.width, finiteOr(mark.w, 64)) / 2);
  const cy = finiteOr(anchor[1], finiteOr(mark.y, 0) + finiteOr(mark.height, finiteOr(mark.h, 120)) / 2);
  const rx = Math.max(finiteOr(mark.rx, finiteOr(mark.r, finiteOr(mark.width, finiteOr(mark.w, 64)) / 2)), 1);
  const height = Math.max(finiteOr(mark.height, finiteOr(mark.h, 120)), 1);
  const capRy = Math.max(finiteOr(mark.ry, finiteOr(mark.depth, rx * 0.34)), 1);
  const topCy = cy - height / 2;
  const bottomCy = cy + height / 2;
  const pointCount = Math.max(12, Math.min(96, Math.round(finiteOr(mark.points, 32))));
  const role = mark.role || `cylinder-${index + 1}`;
  const baseZ = finiteOr(mark.z, finiteOr(scene.view?.baseZ, 10));
  const fill = mark.fill || '#b1845e';
  const stroke = mark.stroke || '#4f3928';
  const strokeWidth = finiteOr(mark.strokeWidth, 0.9);
  const topPoints = ellipsePoints(cx, topCy, rx, capRy, pointCount);
  const bodyPoints = cylinderSidePoints(cx, topCy, bottomCy, rx, capRy, pointCount);
  const common = {
    sourceIndex: mark.sourceIndex ?? index,
    sourceShape: 'cylinder',
    formFamily: 'vector',
    vectorKind: 'curved-solid',
    cylinderRole: role,
    cylinderTopClosed: mark.openTop === true ? false : true,
  };
  const body = {
    ...markWithoutGeometry(mark),
    ...common,
    kind: 'polygon',
    closed: true,
    role: `${role}:body`,
    points: bodyPoints,
    fill: shadeHex(fill, 0.78),
    stroke,
    strokeWidth,
    z: baseZ,
    depthAnchor: [roundPoint(cx), roundPoint(cy)],
    cylinderPart: 'body',
  };
  if (mark.openTop === true) return [body];

  return [
    body,
    {
      ...markWithoutGeometry(mark),
      ...common,
      kind: 'polygon',
      closed: true,
      role: `${role}:top-cap`,
      points: topPoints,
      fill: shadeHex(fill, 0.98),
      stroke,
      strokeWidth,
      z: baseZ + 0.22,
      depthAnchor: [roundPoint(cx), roundPoint(topCy)],
      cylinderPart: 'top-cap',
      coherenceRole: 'top-closure',
    },
  ];
}

function expandVolumeMark(mark, index, scene) {
  const primitive = mark.primitive || 'cup';
  if (primitive !== 'cup') {
    throw new Error(`unknown volume primitive '${primitive}'`);
  }
  return expandCupVolumeMark(mark, index, scene);
}

function expandCupVolumeMark(mark, index, scene) {
  const anchor = validPoint(mark.anchor) || [mark.cx, mark.cy];
  const cx = finiteOr(anchor[0], finiteOr(mark.x, 0) + finiteOr(mark.rimWidth, finiteOr(mark.width, 120)) / 2);
  const cy = finiteOr(anchor[1], finiteOr(mark.y, 0) + finiteOr(mark.height, 160) / 2);
  const height = Math.max(finiteOr(mark.height, finiteOr(mark.h, 160)), 12);
  const rimWidth = Math.max(finiteOr(mark.rimWidth, finiteOr(mark.width, finiteOr(mark.w, 124))), 4);
  const footWidth = Math.max(finiteOr(mark.footWidth, rimWidth * 0.56), 4);
  const wallThickness = Math.max(finiteOr(mark.wallThickness, rimWidth * 0.075), 1);
  const ringCount = Math.max(2, Math.min(80, Math.round(finiteOr(mark.rings, 12))));
  const role = mark.role || `volume-${index + 1}`;
  const topY = cy - height / 2;
  const bottomY = cy + height / 2;
  const fill = mark.fill || '#b1845e';
  const stroke = mark.stroke || '#4f3928';
  const baseZ = finiteOr(mark.z, finiteOr(scene.view?.baseZ, 10));
  const pointCount = Math.max(12, Math.min(96, Math.round(finiteOr(mark.points, 32))));
  const out = [];

  for (let i = 0; i < ringCount; i++) {
    const t = ringCount === 1 ? 0 : i / (ringCount - 1);
    const eased = cupProfileEase(t);
    const outerRx = lerp(rimWidth / 2, footWidth / 2, eased);
    const innerRx = Math.max(outerRx - wallThickness, 1);
    const y = lerp(topY, bottomY, t);
    const ry = Math.max(outerRx * lerp(0.16, 0.09, t), 2);
    const opacity = round(lerp(0.68, 0.26, t));
    const ringMeta = {
      center: [roundPoint(cx), roundPoint(y)],
      outerRx: roundPoint(outerRx),
      innerRx: roundPoint(innerRx),
      ry: roundPoint(ry),
      wallThickness: roundPoint(outerRx - innerRx),
    };
    out.push({
      ...volumeCommon(mark, index, role, ringCount, i, t, ringMeta),
      kind: 'polyline',
      role: `${role}:ring-${String(i + 1).padStart(2, '0')}:outer`,
      points: ellipseArcPoints(cx, y, outerRx, ry, pointCount, 0, Math.PI),
      stroke: shadeHex(stroke, lerp(1.12, 0.82, t)),
      strokeWidth: finiteOr(mark.strokeWidth, 1.4),
      fill: 'none',
      opacity,
      z: baseZ + t * 0.08,
      volumeSurface: 'outer-ring',
    });
    if (mark.openTop !== false) {
      out.push({
        ...volumeCommon(mark, index, role, ringCount, i, t, ringMeta),
        kind: 'polyline',
        role: `${role}:ring-${String(i + 1).padStart(2, '0')}:inner`,
        points: ellipseArcPoints(cx, y, innerRx, ry * 0.72, pointCount, 0, Math.PI),
        stroke: shadeHex(stroke, lerp(0.72, 0.54, t)),
        strokeWidth: Math.max(finiteOr(mark.strokeWidth, 1.4) * 0.72, 0.6),
        fill: 'none',
        opacity: round(opacity * lerp(0.7, 0.28, t)),
        z: baseZ + 0.04 + t * 0.08,
        volumeSurface: 'inner-ring',
      });
    }
  }

  const rimOuterRx = rimWidth / 2;
  const rimInnerRx = Math.max(rimOuterRx - wallThickness, 1);
  const rimRy = Math.max(rimOuterRx * 0.16, 2);
  const footRx = footWidth / 2;
  const footRy = Math.max(footRx * 0.09, 2);
  out.push({
    ...volumeCommon(mark, index, role, ringCount, 0, 0, {
      center: [roundPoint(cx), roundPoint(topY)],
      outerRx: roundPoint(rimOuterRx),
      innerRx: roundPoint(rimInnerRx),
      ry: roundPoint(rimRy),
      wallThickness: roundPoint(rimOuterRx - rimInnerRx),
    }),
    kind: 'polyline',
    role: `${role}:rim-band`,
    points: ellipseArcPoints(cx, topY, rimOuterRx, rimRy, pointCount, 0, Math.PI * 2),
    stroke: shadeHex(fill, 1.08),
    strokeWidth: Math.max(wallThickness * 0.28, 2),
    fill: 'none',
    opacity: 0.88,
    z: baseZ + 0.32,
    volumeSurface: 'rim',
  });
  out.push({
    ...volumeCommon(mark, index, role, ringCount, ringCount - 1, 1, {
      center: [roundPoint(cx), roundPoint(bottomY)],
      outerRx: roundPoint(footRx),
      innerRx: 0,
      ry: roundPoint(footRy),
      wallThickness: roundPoint(wallThickness),
    }),
    kind: 'polyline',
    role: `${role}:foot-band`,
    points: ellipseArcPoints(cx, bottomY, footRx, footRy, pointCount, 0, Math.PI),
    stroke: shadeHex(stroke, 0.86),
    strokeWidth: Math.max(finiteOr(mark.strokeWidth, 1.4) * 1.15, 1),
    fill: 'none',
    opacity: 0.72,
    z: baseZ + 0.18,
    volumeSurface: 'foot',
  });
  out.push(
    cupContourLine(mark, index, role, ringCount, cx - rimOuterRx, topY, cx - footRx, bottomY, 'left', stroke, baseZ),
    cupContourLine(mark, index, role, ringCount, cx + rimOuterRx, topY, cx + footRx, bottomY, 'right', stroke, baseZ),
  );
  return out;
}

function volumeCommon(mark, index, role, ringCount, ringIndex, t, ring) {
  return {
    sourceIndex: mark.sourceIndex ?? index,
    sourceShape: 'volume',
    formFamily: 'volume',
    volumeRole: role,
    volumePrimitive: 'cup',
    volumeRingIndex: ringIndex,
    volumeRingCount: ringCount,
    volumeT: round(t),
    ring,
  };
}

function cupContourLine(mark, index, role, ringCount, x1, y1, x2, y2, side, stroke, baseZ) {
  return {
    sourceIndex: mark.sourceIndex ?? index,
    sourceShape: 'volume',
    formFamily: 'volume',
    kind: 'line',
    role: `${role}:${side}-contour`,
    x1: roundPoint(x1),
    y1: roundPoint(y1),
    x2: roundPoint(x2),
    y2: roundPoint(y2),
    stroke: shadeHex(stroke, side === 'left' ? 0.86 : 1.04),
    strokeWidth: Math.max(finiteOr(mark.strokeWidth, 1.4), 1),
    opacity: 0.82,
    z: baseZ + 0.24,
    volumeRole: role,
    volumePrimitive: 'cup',
    volumeRingIndex: side === 'left' ? 0 : ringCount - 1,
    volumeRingCount: ringCount,
    volumeT: side === 'left' ? 0 : 1,
    volumeSurface: 'contour',
  };
}

function cupProfileEase(t) {
  return Math.pow(clamp(t, 0, 1), 0.82);
}

function ellipseArcPoints(cx, cy, rx, ry, pointCount, start, end) {
  const count = Math.max(2, pointCount);
  const points = [];
  for (let i = 0; i <= count; i++) {
    const a = start + ((end - start) * i) / count;
    points.push([roundPoint(cx + Math.cos(a) * rx), roundPoint(cy + Math.sin(a) * ry)]);
  }
  return points;
}

function expandRoundPrimitiveMark(mark, index) {
  const kind = mark.kind === 'sphere' ? 'sphere' : 'oval';
  const r = finiteOr(mark.r, 28);
  const expanded = expandBlobMark({
    ...mark,
    kind: mark.kind === 'sphere' ? 'ellipse' : 'ellipse',
    rx: finiteOr(mark.rx, r),
    ry: finiteOr(mark.ry, mark.kind === 'sphere' ? finiteOr(mark.rx, r) : r * 0.72),
    wobble: 0,
  }, index);
  return {
    ...expanded,
    sourceShape: kind,
    formPrimitive: kind,
    formFamily: 'organic',
  };
}

function expandEggMark(mark, index) {
  const hasAnchor =
    Array.isArray(mark.anchor) &&
    mark.anchor.length === 2 &&
    Number.isFinite(mark.anchor[0]) &&
    Number.isFinite(mark.anchor[1]);
  const anchor = hasAnchor ? mark.anchor : [mark.cx, mark.cy];
  const cx = finiteOr(anchor[0], 0);
  const cy = finiteOr(anchor[1], 0);
  const rx = Math.max(finiteOr(mark.rx, finiteOr(mark.r, 32)), 1);
  const ry = Math.max(finiteOr(mark.ry, finiteOr(mark.r, 46)), 1);
  const rotation = finiteOr(mark.rotation, 0);
  const pointCount = Math.max(12, Math.min(96, Math.round(finiteOr(mark.points, 36))));
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const points = [];
  for (let i = 0; i < pointCount; i++) {
    const t = (i / pointCount) * Math.PI * 2;
    const yUnit = Math.sin(t);
    const topNarrowing = yUnit < 0 ? 1 + yUnit * 0.18 : 1 + yUnit * 0.08;
    const localX = Math.cos(t) * rx * topNarrowing;
    const localY = yUnit * ry;
    points.push([
      roundPoint(cx + localX * cosR - localY * sinR),
      roundPoint(cy + localX * sinR + localY * cosR),
    ]);
  }
  return {
    ...markWithoutGeometry(mark),
    kind: 'polygon',
    closed: true,
    role: mark.role || `egg-${index + 1}`,
    points,
    sourceShape: 'egg',
    formPrimitive: 'egg',
    formFamily: 'organic',
    sourceIndex: mark.sourceIndex ?? index,
    blobIndex: mark.blobIndex ?? index,
    blobRole: mark.blobRole || mark.role,
    depthAnchor: mark.depthAnchor || [cx, cy],
  };
}

function expandBookshelfSolidPreset(mark, index, scene) {
  const x = finiteOr(mark.x, finiteOr(mark.anchor?.[0], 260) - finiteOr(mark.width, mark.w ?? 280) / 2);
  const y = finiteOr(mark.y, finiteOr(mark.anchor?.[1], 220) - finiteOr(mark.height, mark.h ?? 330) / 2);
  const w = Math.max(finiteOr(mark.width, finiteOr(mark.w, 280)), 40);
  const h = Math.max(finiteOr(mark.height, finiteOr(mark.h, 330)), 60);
  const depth = Math.max(finiteOr(mark.depth, Math.min(w, h) * 0.2), 10);
  const shelves = Math.max(1, Math.min(8, Math.round(finiteOr(mark.shelves, 4))));
  const role = mark.role || 'bookshelf';
  const board = Math.max(finiteOr(mark.boardThickness, h * 0.045), 5);
  const sideWidth = Math.max(finiteOr(mark.sideWidth, w * 0.07), 7);
  const backThickness = Math.max(finiteOr(mark.backThickness, board * 0.45), 2);
  const baseZ = finiteOr(mark.z, finiteOr(scene.view?.baseZ, 10));
  const stroke = mark.stroke || '#4f3928';
  const strokeWidth = finiteOr(mark.strokeWidth, 0.9);
  const woodFill = mark.fill || '#b1845e';
  const backFill = mark.backFill || '#7c5a42';
  const bookPalette = mark.bookPalette || ['#8f5f45', '#b1845e', '#6d7c74', '#7a5b80', '#c8a978'];
  const camera = solidCamera(scene, depth, [x, y]);
  const planes = [];

  const addCuboid = (name, box, options = {}) => {
    planes.push(...expandCuboidPlanes({
      role: `${role}:${name}`,
      box,
      fill: options.fill || woodFill,
      stroke,
      strokeWidth: options.strokeWidth ?? strokeWidth,
      sourceIndex: mark.sourceIndex ?? index,
      baseZ: baseZ + finiteOr(options.zOffset, 0),
      camera,
      solidPresetRef: 'bookshelf',
      solidPresetRole: role,
      vectorRole: options.vectorRole || name,
      faceFilter: options.faceFilter,
    }));
  };

  addCuboid('back-panel', { x: 0, y: 0, z: 0, w, h, d: backThickness }, {
    fill: backFill,
    zOffset: -1.2,
    vectorRole: 'panel',
    faceFilter: new Set(['front', 'left', 'right', 'top', 'bottom']),
  });
  addCuboid('left-wall', { x: 0, y: 0, z: 0, w: sideWidth, h, d: depth }, { vectorRole: 'wall' });
  addCuboid('right-wall', { x: w - sideWidth, y: 0, z: 0, w: sideWidth, h, d: depth }, { vectorRole: 'wall' });

  for (let i = 0; i <= shelves; i++) {
    const sy = i === shelves ? h - board : Math.max(0, (h * i) / shelves);
    addCuboid(`shelf-${i + 1}`, { x: 0, y: sy, z: 0, w, h: board, d: depth }, {
      vectorRole: 'shelf',
      zOffset: i * 0.03,
    });
  }

  const bookRows = Math.min(shelves, 5);
  for (let row = 0; row < bookRows; row++) {
    const cellTop = (h * row) / shelves + board * 1.25;
    const cellBottom = (h * (row + 1)) / shelves - board * 0.45;
    let cursor = sideWidth + w * 0.025;
    const rightLimit = w - sideWidth - w * 0.025;
    for (let b = 0; b < 9; b++) {
      const bw = w * (0.035 + ((b + row) % 4) * 0.009);
      if (cursor + bw > rightLimit) break;
      const bookHeight = Math.max(cellBottom - cellTop - ((b + row) % 4) * h * 0.01, board * 1.8);
      const lean = (((b + row) % 5) - 2) * 0.018;
      const bookDepth = depth * (0.45 + ((b + 2 * row) % 4) * 0.055);
      addCuboid(`book-${row + 1}-${b + 1}`, {
        x: cursor,
        y: cellBottom - bookHeight,
        z: depth - bookDepth - depth * 0.06,
        w: bw,
        h: bookHeight,
        d: bookDepth,
        shearX: lean * bookHeight,
      }, {
        fill: mark.bookFill || bookPalette[(b + row) % bookPalette.length],
        strokeWidth: Math.max(0.45, strokeWidth * 0.65),
        vectorRole: 'book',
        faceFilter: new Set(['front', 'right', 'top']),
        zOffset: 0.8 + row * 0.04 + b * 0.004,
      });
      cursor += bw + w * 0.012;
    }
  }

  return planes.map((plane) => ({
    ...plane,
    points: plane.points.map(([px, py]) => [roundPoint(px + x), roundPoint(py + y)]),
    depthAnchor: [roundPoint(plane.depthAnchor[0] + x), roundPoint(plane.depthAnchor[1] + y)],
    vanishingPoint: Array.isArray(plane.vanishingPoint)
      ? [roundPoint(plane.vanishingPoint[0] + x), roundPoint(plane.vanishingPoint[1] + y)]
      : plane.vanishingPoint,
  }));
}

function solidCamera(scene, maxDepth = 1, origin = [0, 0], mark = {}) {
  const view2d = normalize(scene.view?.direction || [-0.45, -0.35]);
  const depthVector = normalize([-view2d[0], -view2d[1]]);
  const depthProjection = validPoint(mark.solidDepthProjection || mark.depthProjection || mark.genesisDepthProjection);
  const light2d = normalize(scene.light?.direction || [-0.58, -0.82]);
  const perspective = scene.perspective || {};
  const rawVp = Array.isArray(perspective.vanishingPoint)
    ? perspective.vanishingPoint
    : perspective.vanishingPoints?.center;
  const vanishingPoint =
    perspective.mode === 'one-point' &&
    Array.isArray(rawVp) &&
    Number.isFinite(rawVp[0]) &&
    Number.isFinite(rawVp[1])
      ? [rawVp[0] - finiteOr(origin[0], 0), rawVp[1] - finiteOr(origin[1], 0)]
      : null;
  return {
    view2d,
    depthVector,
    depthProjection,
    light3d: normalize3([light2d[0], light2d[1], finiteOr(scene.light?.z, 0.72)]),
    zScale: finiteOr(scene.view?.solidZScale, 0.045),
    eyeScale: finiteOr(scene.view?.solidEyeScale, 0.006),
    perspectiveMode: vanishingPoint ? 'one-point' : 'parallel',
    vanishingPoint,
    maxDepth: Math.max(finiteOr(maxDepth, 1), 1),
    perspectiveDepth: Math.max(finiteOr(perspective.depthScale, 240), 1),
  };
}

function expandCuboidPlanes({ role, box, fill, stroke, strokeWidth, sourceIndex, baseZ, camera, solidPresetRef, solidPresetRole, vectorRole, faceFilter }) {
  return cuboidFaces(box)
    .filter((face) => !faceFilter || faceFilter.has(face.name))
    .map((face) => {
      const projected = face.points.map((point) => projectSolidPoint(point, camera));
      const c2 = centroid(projected);
      const c3 = averagePoint3(face.points);
      const lightAmount = clamp(dot3(face.normal, camera.light3d), -1, 1);
      const faceTone = 0.72 + Math.max(lightAmount, 0) * 0.24 + Math.min(lightAmount, 0) * 0.22;
      return expandPlanePolygon({
        role: `${role}:${face.name}`,
        points: projected,
        fill: shadeHex(fill, faceTone),
        stroke: shadeHex(stroke, face.name === 'front' ? 1.08 : 0.84),
        strokeWidth,
        sourceIndex,
        sourceShape: 'plane',
        formFamily: 'vector',
        vectorKind: 'solid-face',
        vectorRole,
        solidPresetRef,
        solidPresetRole,
        solidRole: role,
        face: face.name,
        faceNormal: face.normal.map(round),
        faceLight: round(lightAmount),
        perspectiveMode: camera.perspectiveMode,
        vanishingPoint: camera.vanishingPoint
          ? [roundPoint(camera.vanishingPoint[0]), roundPoint(camera.vanishingPoint[1])]
          : undefined,
        planeDepth: round(c3[2]),
        depthAnchor: [roundPoint(c2[0]), roundPoint(c2[1])],
        z: round(baseZ + c3[2] * camera.zScale - dot(camera.view2d, c2) * camera.eyeScale + face.zBias),
      });
    });
}

function expandCcaCornerCuboidPlanes({ role, projection, fill, stroke, strokeWidth, sourceIndex, baseZ, vectorRole, faceFilter }) {
  const hitPoints = resolveCcaCuboidHitPoints(projection);
  const { bottom, top } = hitPoints;
  const depth = Math.max(finiteOr(projection?.depth, 1), 1);
  const perspectiveStrength = projection?.perspective ? clamp(finiteOr(projection.perspectiveStrength, 0.16), 0, 0.45) : 0;
  const faces = [
    { name: 'back', points: [bottom.bl, bottom.br, top.br, top.bl], tone: 0.72, zBias: -0.04 },
    { name: 'front', points: [bottom.fl, bottom.fr, top.fr, top.fl], tone: 0.92, zBias: 0.22 },
    { name: 'left', points: [bottom.bl, bottom.fl, top.fl, top.bl], tone: 0.76, zBias: 0.08 },
    { name: 'right', points: [bottom.br, bottom.fr, top.fr, top.br], tone: 0.78, zBias: 0.1 },
    { name: 'top', points: [top.bl, top.br, top.fr, top.fl], tone: 1.08, zBias: 0.16 },
    { name: 'bottom', points: [bottom.bl, bottom.br, bottom.fr, bottom.fl], tone: 0.66, zBias: 0.02 },
  ];
  return faces
    .filter((face) => !faceFilter || faceFilter.has(face.name))
    .map((face) => expandPlanePolygon({
      role: `${role}:${face.name}`,
      points: face.points,
      fill: shadeHex(fill, face.tone),
      stroke: shadeHex(stroke, face.name === 'front' ? 1.08 : 0.84),
      strokeWidth,
      sourceIndex,
      sourceShape: 'plane',
      formFamily: 'vector',
      vectorKind: 'solid-face',
      vectorRole,
      solidRole: role,
      face: face.name,
      solidGuideEdge: projection?.guideEdge || undefined,
      solidGuideLine: projection?.guideLine || undefined,
      solidUpperGuideLine: projection?.upperGuideLine || undefined,
      ccaHitPointMode: projection?.hitPointMode || undefined,
      ccaHitPoints: projection?.hitPointMode ? flattenCcaHitPoints(hitPoints) : undefined,
      perspectiveMode: projection?.hitPointMode
        ? 'constellation-hit-cuboid'
        : projection?.perspective ? 'perspective-corner-projection' : 'corner-projection',
      cornerPerspectiveStrength: perspectiveStrength,
      planeDepth: face.name === 'front' ? depth : 0,
      depthAnchor: centroid(face.points).map(roundPoint),
      z: round(baseZ + face.zBias),
    }));
}

function resolveCcaCuboidHitPoints(projection) {
  const anchor = validPoint(projection?.anchor) || [0, 0];
  const widthAxis = normalize(validPoint(projection?.widthAxis) || [1, 0]);
  const depthAxis = normalize(validPoint(projection?.depthAxis) || [0, 1]);
  const heightAxis = normalize(validPoint(projection?.heightAxis) || [0, -1]);
  const halfW = Math.max(finiteOr(projection?.width, 1), 1) / 2;
  const depth = Math.max(finiteOr(projection?.depth, 1), 1);
  const height = Math.max(finiteOr(projection?.height, 1), 1);
  const perspectiveStrength = projection?.perspective ? clamp(finiteOr(projection.perspectiveStrength, 0.16), 0, 0.45) : 0;
  const center = projection?.depthAnchorMode === 'front'
    ? [anchor[0] - depthAxis[0] * depth, anchor[1] - depthAxis[1] * depth]
    : anchor;
  const add3 = (w, d, z) => {
    const depthT = clamp(d / Math.max(depth, 0.001), 0, 1);
    const scale = 1 + depthT * perspectiveStrength;
    return [
      center[0] + widthAxis[0] * w * scale + depthAxis[0] * d + heightAxis[0] * z,
      center[1] + widthAxis[1] * w * scale + depthAxis[1] * d + heightAxis[1] * z,
    ];
  };
  const bottom = {
    fl: add3(-halfW, depth, 0),
    fr: add3(halfW, depth, 0),
    br: add3(halfW, 0, 0),
    bl: add3(-halfW, 0, 0),
  };
  const top = {
    fl: add3(-halfW, depth, height),
    fr: add3(halfW, depth, height),
    br: add3(halfW, 0, height),
    bl: add3(-halfW, 0, height),
  };
  applyGuideEdgeConstraint({
    bottom,
    top,
    guideLine: projection?.guideLine,
    upperGuideLine: projection?.upperGuideLine,
    guideEdge: projection?.guideEdge,
  });
  if (projection?.verticalMode === 'absolute-90' || projection?.verticalMode === 'screen-vertical') {
    enforceAbsoluteVerticalHitPoints({ bottom, top });
  }
  if (projection?.verticalMode === 'absolute-90-top-guide' || projection?.verticalMode === 'screen-vertical-top-guide') {
    enforceAbsoluteVerticalHitPoints({ bottom, top });
    alignVerticalHitPointsToUpperGuide({
      bottom,
      top,
      upperGuideLine: projection?.upperGuideLine,
      guideEdge: projection?.guideEdge,
    });
  }
  return { bottom, top };
}

function enforceAbsoluteVerticalHitPoints({ bottom, top }) {
  for (const key of ['fl', 'fr', 'br', 'bl']) {
    if (!bottom[key] || !top[key]) continue;
    top[key] = [roundPoint(bottom[key][0]), top[key][1]];
  }
}

function alignVerticalHitPointsToUpperGuide({ bottom, top, upperGuideLine, guideEdge }) {
  const topLine = validLine(upperGuideLine);
  if (!topLine || (guideEdge !== 'left' && guideEdge !== 'right')) return;
  const pairs = guideEdge === 'right'
    ? [['br', 'bl'], ['fr', 'fl']]
    : [['bl', 'br'], ['fl', 'fr']];
  for (const [guideKey, oppositeKey] of pairs) {
    const y = lineYAtX(topLine, top[guideKey]?.[0]);
    if (!Number.isFinite(y)) continue;
    const dy = roundPoint(y - top[guideKey][1]);
    top[guideKey] = [top[guideKey][0], roundPoint(top[guideKey][1] + dy)];
    top[oppositeKey] = [top[oppositeKey][0], roundPoint(top[oppositeKey][1] + dy)];
  }
}

function flattenCcaHitPoints({ bottom, top }) {
  return {
    floorBackLeft: bottom.bl.map(roundPoint),
    floorBackRight: bottom.br.map(roundPoint),
    floorFrontLeft: bottom.fl.map(roundPoint),
    floorFrontRight: bottom.fr.map(roundPoint),
    topBackLeft: top.bl.map(roundPoint),
    topBackRight: top.br.map(roundPoint),
    topFrontLeft: top.fl.map(roundPoint),
    topFrontRight: top.fr.map(roundPoint),
  };
}

function applyGuideEdgeConstraint({ bottom, top, guideLine, upperGuideLine, guideEdge }) {
  const line = validLine(guideLine);
  if (!line || (guideEdge !== 'left' && guideEdge !== 'right')) return;
  const topLine = validLine(upperGuideLine) || null;
  const pairs = guideEdge === 'right'
    ? [['br', 'bl', 'br', 'bl'], ['fr', 'fl', 'fr', 'fl']]
    : [['bl', 'br', 'bl', 'br'], ['fl', 'fr', 'fl', 'fr']];
  for (const [bottomKey, oppositeBottomKey, topKey, oppositeTopKey] of pairs) {
    const point = bottom[bottomKey];
    const x = lineXAtY(line, point?.[1]);
    if (!Number.isFinite(x)) continue;
    const dx = roundPoint(x - point[0]);
    bottom[bottomKey] = [roundPoint(point[0] + dx), point[1]];
    bottom[oppositeBottomKey] = [
      roundPoint(bottom[oppositeBottomKey][0] + dx),
      bottom[oppositeBottomKey][1],
    ];
    const topX = topLine ? lineXAtY(topLine, top[topKey]?.[1]) : NaN;
    const originalTopX = top[topKey][0];
    const nextTopX = roundPoint(Number.isFinite(topX) ? topX : top[topKey][0] + dx);
    top[topKey] = [
      nextTopX,
      top[topKey][1],
    ];
    const topDx = roundPoint(nextTopX - originalTopX);
    top[oppositeTopKey] = [
      roundPoint(top[oppositeTopKey][0] + topDx),
      top[oppositeTopKey][1],
    ];
  }
}

function lineXAtY(line, yRaw) {
  const y = finiteOr(yRaw, NaN);
  if (!Number.isFinite(y)) return NaN;
  const [a, b] = line;
  const dy = b[1] - a[1];
  if (Math.abs(dy) < 1e-9) return a[0];
  const t = (y - a[1]) / dy;
  return a[0] + (b[0] - a[0]) * t;
}

function lineYAtX(line, xRaw) {
  const x = finiteOr(xRaw, NaN);
  if (!Number.isFinite(x)) return NaN;
  const [a, b] = line;
  const dx = b[0] - a[0];
  if (Math.abs(dx) < 1e-9) return a[1];
  const t = (x - a[0]) / dx;
  return a[1] + (b[1] - a[1]) * t;
}

function cuboidFaces(box) {
  const x0 = box.x;
  const x1 = box.x + box.w;
  const y0 = box.y;
  const y1 = box.y + box.h;
  const z0 = box.z;
  const z1 = box.z + box.d;
  const s = finiteOr(box.shearX, 0);
  const p = (xPoint, yPoint, zPoint) => [
    xPoint + (yPoint - y0) * (s / Math.max(box.h, 1)),
    yPoint,
    zPoint,
  ];
  return [
    { name: 'back', normal: [0, 0, -1], zBias: -0.04, points: [p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0)] },
    { name: 'front', normal: [0, 0, 1], zBias: 0.22, points: [p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)] },
    { name: 'left', normal: [-1, 0, 0], zBias: 0.08, points: [p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0)] },
    { name: 'right', normal: [1, 0, 0], zBias: 0.1, points: [p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1), p(x1, y1, z0)] },
    { name: 'top', normal: [0, -1, 0], zBias: 0.16, points: [p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1)] },
    { name: 'bottom', normal: [0, 1, 0], zBias: 0.02, points: [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)] },
  ];
}

function projectSolidPoint([x, y, z], camera) {
  if (camera.perspectiveMode === 'one-point' && camera.vanishingPoint) {
    const recede = Math.max(camera.maxDepth - z, 0);
    const scale = camera.perspectiveDepth / (camera.perspectiveDepth + recede);
    return [
      camera.vanishingPoint[0] + (x - camera.vanishingPoint[0]) * scale,
      camera.vanishingPoint[1] + (y - camera.vanishingPoint[1]) * scale,
    ];
  }
  return [
    x + (camera.depthProjection?.[0] ?? -camera.depthVector[0]) * z,
    y + (camera.depthProjection?.[1] ?? -camera.depthVector[1]) * z,
  ];
}

function averagePoint3(points) {
  const sum = points.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
}

function ellipsePoints(cx, cy, rx, ry, pointCount, start = 0, end = Math.PI * 2) {
  const points = [];
  for (let i = 0; i < pointCount; i++) {
    const t = start + ((end - start) * i) / pointCount;
    points.push([roundPoint(cx + Math.cos(t) * rx), roundPoint(cy + Math.sin(t) * ry)]);
  }
  return points;
}

function cylinderSidePoints(cx, topCy, bottomCy, rx, ry, pointCount) {
  const half = Math.max(6, Math.round(pointCount / 2));
  const topFront = [];
  const bottomFront = [];
  for (let i = 0; i <= half; i++) {
    const t = Math.PI + (Math.PI * i) / half;
    topFront.push([roundPoint(cx + Math.cos(t) * rx), roundPoint(topCy + Math.sin(t) * ry)]);
  }
  for (let i = half; i >= 0; i--) {
    const t = Math.PI + (Math.PI * i) / half;
    bottomFront.push([roundPoint(cx + Math.cos(t) * rx), roundPoint(bottomCy + Math.sin(t) * ry)]);
  }
  return topFront.concat(bottomFront);
}

function markWithoutGeometry(mark) {
  const {
    anchor: _anchor,
    cx: _cx,
    cy: _cy,
    x: _x,
    y: _y,
    width: _width,
    height: _height,
    w: _w,
    h: _h,
    depth: _depth,
    rx: _rx,
    ry: _ry,
    r: _r,
    rotation: _rotation,
    wobble: _wobble,
    points: _points,
    kind: _kind,
    openTop: _openTop,
    ...rest
  } = mark;
  return rest;
}

function expandPlanePresetMark(mark, index, scene) {
  const ref = mark.ref || mark.preset;
  if (ref === 'bookshelf') {
    return expandBookshelfPlanePreset(mark, index, scene);
  }
  throw new Error(`unknown plane preset '${ref || '(missing ref)'}'`);
}

function expandBookshelfPlanePreset(mark, index, scene) {
  const x = finiteOr(mark.x, finiteOr(mark.anchor?.[0], 260) - finiteOr(mark.width, mark.w ?? 280) / 2);
  const y = finiteOr(mark.y, finiteOr(mark.anchor?.[1], 220) - finiteOr(mark.height, mark.h ?? 330) / 2);
  const w = Math.max(finiteOr(mark.width, finiteOr(mark.w, 280)), 20);
  const h = Math.max(finiteOr(mark.height, finiteOr(mark.h, 330)), 20);
  const depth = Math.max(finiteOr(mark.depth, Math.min(w, h) * 0.14), 1);
  const shelves = Math.max(1, Math.min(8, Math.round(finiteOr(mark.shelves, 5))));
  const role = mark.role || 'bookshelf';
  const baseZ = finiteOr(mark.z, finiteOr(scene.view?.baseZ, 10));
  const board = Math.max(finiteOr(mark.boardThickness, h * 0.045), 4);
  const sideWidth = Math.max(finiteOr(mark.sideWidth, w * 0.07), 6);
  const stroke = mark.stroke || '#4f3928';
  const strokeWidth = finiteOr(mark.strokeWidth, 1.25);
  const planeFill = mark.fill || '#b1845e';
  const sideFill = mark.sideFill || '#966b4e';
  const topFill = mark.topFill || '#c8a978';
  const frontFill = mark.frontFill || '#a97852';
  const backFill = mark.backFill || '#7c5a42';
  const bookPalette = mark.bookPalette || ['#8f5f45', '#b1845e', '#6d7c74', '#7a5b80', '#c8a978'];
  const view = normalize(scene.view?.direction || [-0.45, -0.35]);
  const depthVector = normalize([-view[0], -view[1]]);
  const dx = roundPoint(depthVector[0] * depth);
  const dy = roundPoint(depthVector[1] * depth);
  const planes = [];
  const addPlane = (name, points, extra = {}) => {
    planes.push(expandPlanePolygon({
      role: `${role}:${name}`,
      points,
      fill: planeFill,
      stroke,
      strokeWidth,
      sourceIndex: mark.sourceIndex ?? index,
      planePresetRef: 'bookshelf',
      planePresetRole: role,
      z: baseZ + finiteOr(extra.planeDepth, 0),
      ...extra,
    }));
  };

  addPlane('back-plane', [[x + dx, y + dy], [x + w + dx, y + dy], [x + w + dx, y + h + dy], [x + dx, y + h + dy]], {
    fill: backFill,
    planeDepth: -1,
  });
  addPlane('left-wall-front', [[x, y], [x + sideWidth, y], [x + sideWidth, y + h], [x, y + h]], {
    fill: sideFill,
    planeDepth: 2.2,
  });
  addPlane('left-wall-depth', [[x, y], [x + dx, y + dy], [x + dx, y + h + dy], [x, y + h]], {
    fill: sideFill,
    planeDepth: 1.6,
  });
  addPlane('right-wall-front', [[x + w - sideWidth, y], [x + w, y], [x + w, y + h], [x + w - sideWidth, y + h]], {
    fill: sideFill,
    planeDepth: 2.2,
  });
  addPlane('right-wall-depth', [[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + h + dy], [x + w, y + h]], {
    fill: sideFill,
    planeDepth: 1.6,
  });

  for (let i = 0; i <= shelves; i++) {
    const sy = y + (h * i) / shelves;
    addPlane(`shelf-${i + 1}-top`, [[x, sy], [x + w, sy], [x + w + dx, sy + dy], [x + dx, sy + dy]], {
      fill: topFill,
      planeDepth: 1.2 + i * 0.02,
    });
    addPlane(`shelf-${i + 1}-front`, [[x, sy], [x + w, sy], [x + w, sy + board], [x, sy + board]], {
      fill: frontFill,
      planeDepth: 2.4 + i * 0.02,
    });
  }

  const bookRows = Math.min(shelves, 5);
  for (let row = 0; row < bookRows; row++) {
    const rowTop = y + (h * row) / shelves + board * 1.25;
    const rowBottom = y + (h * (row + 1)) / shelves - board * 0.35;
    let cursor = x + sideWidth + w * 0.025;
    const rightLimit = x + w - sideWidth - w * 0.025;
    for (let b = 0; b < 9; b++) {
      const bw = w * (0.035 + ((b + row) % 4) * 0.009);
      if (cursor + bw > rightLimit) break;
      const lean = ((b + row) % 5) - 2;
      addPlane(`book-${row + 1}-${b + 1}-spine`, [
        [cursor + lean * 0.7, rowTop + Math.max(0, lean) * 1.5],
        [cursor + bw + lean * 0.7, rowTop],
        [cursor + bw - lean * 0.4, rowBottom],
        [cursor - lean * 0.35, rowBottom],
      ], {
        fill: mark.bookFill || bookPalette[(b + row) % bookPalette.length],
        strokeWidth: Math.max(0.6, strokeWidth * 0.55),
        planeDepth: 2.8 + row * 0.04 + b * 0.002,
      });
      cursor += bw + w * 0.012;
    }
  }

  return planes;
}

function expandPlaneMark(mark, index) {
  if (Array.isArray(mark.points) && mark.points.length >= 3) {
    return expandPlanePolygon({ ...mark, sourceIndex: mark.sourceIndex ?? index });
  }
  const anchor = Array.isArray(mark.anchor) ? mark.anchor : [mark.cx, mark.cy];
  const cx = finiteOr(anchor[0], 0);
  const cy = finiteOr(anchor[1], 0);
  const length = Math.max(finiteOr(mark.length, finiteOr(mark.h, 80)), 1);
  const width = Math.max(finiteOr(mark.width, finiteOr(mark.w, 20)), 1);
  const axis = normalize(mark.axis || [0, 1]);
  const normal = normalize([-axis[1], axis[0]]);
  const halfL = length / 2;
  const halfW = width / 2;
  return expandPlanePolygon({
    ...mark,
    points: [
      [cx - axis[0] * halfL - normal[0] * halfW, cy - axis[1] * halfL - normal[1] * halfW],
      [cx + axis[0] * halfL - normal[0] * halfW, cy + axis[1] * halfL - normal[1] * halfW],
      [cx + axis[0] * halfL + normal[0] * halfW, cy + axis[1] * halfL + normal[1] * halfW],
      [cx - axis[0] * halfL + normal[0] * halfW, cy - axis[1] * halfL + normal[1] * halfW],
    ],
    sourceIndex: mark.sourceIndex ?? index,
  });
}

function expandPlanePolygon(mark) {
  const points = (mark.points || []).map(([x, y]) => [roundPoint(x), roundPoint(y)]);
  const c = centroid(points);
  const {
    kind: _kind,
    anchor: _anchor,
    cx: _cx,
    cy: _cy,
    length: _length,
    width: _width,
    axis: _axis,
    ...rest
  } = mark;
  return {
    ...rest,
    kind: 'polygon',
    closed: true,
    role: mark.role || 'plane',
    points,
    fill: mark.fill || '#b1845e',
    stroke: mark.stroke || '#4f3928',
    strokeWidth: mark.strokeWidth ?? 1,
    sourceShape: mark.sourceShape || 'plane',
    formFamily: mark.formFamily || 'vector',
    planeRole: mark.planeRole || mark.role,
    planeDepth: finiteOr(mark.planeDepth, 0),
    depthAnchor: mark.depthAnchor || [roundPoint(c[0]), roundPoint(c[1])],
  };
}

function expandLibraryObjectMark(mark, index, scene) {
  const ref = mark.ref || mark.asset || mark.object;
  if (ref === 'bookshelf-wireframe' || ref === 'bookshelf') {
    return expandBookshelfWireframe(mark, index, scene);
  }
  throw new Error(`unknown vector object asset '${ref || '(missing ref)'}'`);
}

function expandBookshelfWireframe(mark, index, scene) {
  const x = finiteOr(mark.x, 80);
  const y = finiteOr(mark.y, 80);
  const w = Math.max(finiteOr(mark.w, 240), 20);
  const h = Math.max(finiteOr(mark.h, 320), 20);
  const depth = Math.max(finiteOr(mark.depth, Math.min(w, h) * 0.14), 0);
  const shelves = Math.max(1, Math.min(8, Math.round(finiteOr(mark.shelves, 4))));
  const columns = Math.max(1, Math.min(6, Math.round(finiteOr(mark.columns, 2))));
  const baseZ = finiteOr(mark.z, 10);
  const role = mark.role || 'bookshelf';
  const stroke = mark.stroke || '#5f4632';
  const faintStroke = mark.faintStroke || '#8a6b4e';
  const strokeWidth = finiteOr(mark.strokeWidth, 2);
  const perspective = normalize(mark.perspective || scene.view?.direction || [-0.45, -0.35]);
  const dx = roundPoint(-perspective[0] * depth);
  const dy = roundPoint(-perspective[1] * depth);
  const p = {
    flt: [x, y],
    frt: [x + w, y],
    flb: [x, y + h],
    frb: [x + w, y + h],
    blt: [x + dx, y + dy],
    brt: [x + w + dx, y + dy],
    blb: [x + dx, y + h + dy],
    brb: [x + w + dx, y + h + dy],
  };
  const common = {
    source: true,
    sourceShape: 'object',
    objectRef: 'bookshelf-wireframe',
    objectRole: role,
    sourceIndex: mark.sourceIndex ?? index,
  };
  const marks = [];
  const addLine = (name, a, b, extra = {}) => {
    marks.push({
      kind: 'line',
      role: `${role}:${name}`,
      x1: roundPoint(a[0]),
      y1: roundPoint(a[1]),
      x2: roundPoint(b[0]),
      y2: roundPoint(b[1]),
      stroke,
      strokeWidth,
      z: baseZ + 0.02,
      ...common,
      ...extra,
    });
  };
  const addPoly = (name, points, extra = {}) => {
    marks.push({
      kind: 'polygon',
      role: `${role}:${name}`,
      points: points.map(([px, py]) => [roundPoint(px), roundPoint(py)]),
      fill: 'none',
      stroke,
      strokeWidth,
      z: baseZ,
      ...common,
      ...extra,
    });
  };

  addPoly('front-frame', [p.flt, p.frt, p.frb, p.flb], { z: baseZ + 0.1 });
  addPoly('back-frame', [p.blt, p.brt, p.brb, p.blb], {
    stroke: faintStroke,
    strokeWidth: Math.max(1, strokeWidth * 0.75),
    z: baseZ - 0.1,
  });
  addLine('depth-top-left', p.flt, p.blt, { stroke: faintStroke, z: baseZ - 0.05 });
  addLine('depth-top-right', p.frt, p.brt, { stroke: faintStroke, z: baseZ - 0.05 });
  addLine('depth-bottom-left', p.flb, p.blb, { stroke: faintStroke, z: baseZ - 0.05 });
  addLine('depth-bottom-right', p.frb, p.brb, { stroke: faintStroke, z: baseZ - 0.05 });

  for (let i = 1; i < shelves; i++) {
    const t = i / shelves;
    const left = [x, y + h * t];
    const right = [x + w, y + h * t];
    const backLeft = [left[0] + dx, left[1] + dy];
    const backRight = [right[0] + dx, right[1] + dy];
    addLine(`shelf-front-${i}`, left, right, { z: baseZ + 0.12 });
    addLine(`shelf-depth-left-${i}`, left, backLeft, { stroke: faintStroke, z: baseZ - 0.02 });
    addLine(`shelf-depth-right-${i}`, right, backRight, { stroke: faintStroke, z: baseZ - 0.02 });
    addLine(`shelf-back-${i}`, backLeft, backRight, { stroke: faintStroke, z: baseZ - 0.08 });
  }

  for (let i = 1; i < columns; i++) {
    const t = i / columns;
    const top = [x + w * t, y];
    const bottom = [x + w * t, y + h];
    addLine(`divider-${i}`, top, bottom, { z: baseZ + 0.11 });
  }

  const bookRows = Math.min(shelves, 4);
  const palette = mark.bookPalette || ['#8f5f45', '#b1845e', '#6d7c74', '#7a5b80', '#c8a978'];
  for (let row = 0; row < bookRows; row++) {
    const rowTop = y + (h * row) / shelves + h * 0.035;
    const rowHeight = h / shelves - h * 0.075;
    const rowBottom = rowTop + rowHeight;
    const bookCount = Math.max(3, columns * 3 + (row % 2));
    let cursor = x + w * 0.045;
    for (let b = 0; b < bookCount; b++) {
      const bw = w * (0.045 + ((b + row) % 3) * 0.012);
      if (cursor + bw > x + w * 0.94) break;
      const inset = ((b + row) % 4) * h * 0.012;
      marks.push({
        kind: 'polygon',
        role: `${role}:book-${row + 1}-${b + 1}`,
        points: [
          [roundPoint(cursor), roundPoint(rowTop + inset)],
          [roundPoint(cursor + bw), roundPoint(rowTop + inset * 0.45)],
          [roundPoint(cursor + bw), roundPoint(rowBottom)],
          [roundPoint(cursor), roundPoint(rowBottom)],
        ],
        fill: mark.bookFill || palette[(b + row) % palette.length],
        stroke,
        strokeWidth: Math.max(0.75, strokeWidth * 0.45),
        z: baseZ + 0.2 + row * 0.01 + b * 0.001,
        ...common,
      });
      cursor += bw + w * 0.016;
    }
  }

  return marks;
}

function expandBlobMark(mark, index) {
  const hasAnchor =
    Array.isArray(mark.anchor) &&
    mark.anchor.length === 2 &&
    Number.isFinite(mark.anchor[0]) &&
    Number.isFinite(mark.anchor[1]);
  const hasCenter = Number.isFinite(mark.cx) && Number.isFinite(mark.cy);
  if (!hasAnchor && !hasCenter) {
    throw new Error(
      `blob '${mark.role || index}' requires anchor [x,y], cx/cy, or a valid top-level gesture with gestureT`,
    );
  }
  const anchor = hasAnchor ? mark.anchor : [mark.cx, mark.cy];
  const cx = finiteOr(anchor[0], 0);
  const cy = finiteOr(anchor[1], 0);
  const rx = Math.max(finiteOr(mark.rx, finiteOr(mark.r, 24)), 1);
  const ry = Math.max(finiteOr(mark.ry, finiteOr(mark.r, rx)), 1);
  const rotation = finiteOr(mark.rotation, 0);
  const pointCount = Math.max(8, Math.min(96, Math.round(finiteOr(mark.points, 32))));
  const wobble = mark.kind === 'ellipse' ? 0 : clamp(finiteOr(mark.wobble, 0.04), 0, 0.22);
  const seed = hashString(`${mark.role || mark.id || 'blob'}:${index}`);
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const points = [];

  for (let i = 0; i < pointCount; i++) {
    const t = (i / pointCount) * Math.PI * 2;
    const radial = 1 + wobble * deterministicWave(seed, i, t);
    const localX = Math.cos(t) * rx * radial;
    const localY = Math.sin(t) * ry * radial;
    points.push([
      roundPoint(cx + localX * cosR - localY * sinR),
      roundPoint(cy + localX * sinR + localY * cosR),
    ]);
  }

  const {
    anchor: _anchor,
    cx: _cx,
    cy: _cy,
    rx: _rx,
    ry: _ry,
    r: _r,
    rotation: _rotation,
    wobble: _wobble,
    points: _points,
    kind: _kind,
    ...rest
  } = mark;

  return {
    ...rest,
    kind: 'polygon',
    closed: true,
    role: mark.role || `${mark.kind}-${index + 1}`,
    points,
    sourceShape: mark.kind,
    sourceIndex: mark.sourceIndex ?? index,
    blobIndex: mark.blobIndex ?? index,
    blobRole: mark.blobRole || mark.role,
    depthAnchor: mark.depthAnchor || [cx, cy],
  };
}

function assignViewDepthZ(marks, scene) {
  const viewDirection = normalize(scene.view?.direction || [0, 1]);
  const baseZ = finiteOr(scene.view?.baseZ, 10);
  const step = finiteOr(scene.view?.blobZStep, 1);
  const forms = marks
    .map((mark, index) => ({ mark, index }))
    .filter(({ mark }) => mark?.z === undefined && mark?.kind === 'polygon' && hasFormLighting(mark));

  forms.sort((a, b) => {
    const depthA = blobDepthFor(a.mark, viewDirection);
    const depthB = blobDepthFor(b.mark, viewDirection);
    return depthA - depthB || a.index - b.index;
  });

  const zByIndex = new Map();
  for (let rank = 0; rank < forms.length; rank++) {
    zByIndex.set(forms[rank].index, round(baseZ + rank * step));
  }

  return marks.map((mark, index) => {
    if (!zByIndex.has(index)) return mark;
    return { ...mark, z: zByIndex.get(index), autoZ: true };
  });
}

function blobDepthFor(mark, viewDirection) {
  return dot(viewDirection, depthPointFor(mark));
}

function depthPointFor(mark) {
  if (Array.isArray(mark.depthAnchor) && mark.depthAnchor.length === 2) {
    return mark.depthAnchor;
  }
  if (Array.isArray(mark.anchor) && mark.anchor.length === 2) {
    return mark.anchor;
  }
  if (Array.isArray(mark.points) && mark.points.length >= 3) {
    return centroid(mark.points);
  }
  return [0, 0];
}

function materializeSourceMark(mark, palette) {
  if (mark.kind === 'polygon') {
    const shaded = hasFormLighting(mark);
    return {
      ...mark,
      fill: mark.fill || palette.base,
      stroke: shaded ? 'none' : mark.stroke || 'none',
      strokeWidth: shaded ? 0 : mark.strokeWidth ?? 0,
      opacity: mark.opacity ?? 1,
      source: true,
    };
  }
  return { ...mark, source: true };
}

function convexValueStack(shape, scene, palette) {
  if (shape.kind !== 'polygon' || !Array.isArray(shape.points) || shape.points.length < 3) {
    return [];
  }
  const points = shape.points;
  const light = normalize(scene.light?.direction || [-0.6, -0.8]);
  const intensity = clamp(shape.shade?.intensity ?? 1, 0, 1);
  const bb = bbox(points);
  const baseZ = shape.z ?? 0;
  const stickers = [];
  const projection = projectionRange(points, light);
  const defaultExpectedOverlap = 6;
  const bands = [
    { reach: 0.98, opacity: 0.026, fill: palette.shadow },
    { reach: 0.84, opacity: 0.046, fill: palette.shadow },
    { reach: 0.68, opacity: 0.076, fill: palette.shadow },
    { reach: 0.5, opacity: 0.118, fill: palette.core },
    { reach: 0.32, opacity: 0.18, fill: palette.core },
    { reach: 0.17, opacity: 0.275, fill: palette.deepest },
  ];
  const budget = resolveValueBudget(shape.shade?.valueBudget, {
    targetOpacity: bands.reduce((sum, band) => sum + band.opacity, 0),
    expectedOverlapCount: defaultExpectedOverlap,
    mode: 'legacy-band',
  });

  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    const shadowCap = contourCap(points, light, projection, band.reach);
    if (shadowCap.length >= 3) {
      const opacity = budget.mode === 'legacy-band'
        ? band.opacity
        : opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
      stickers.push({
        kind: 'polygon',
        role: `${shape.role || 'shape'}:edge-shadow-${i + 1}`,
        points: shadowCap,
        fill: band.fill,
        opacity: round(opacity * intensity),
        z: baseZ + 0.08 + i * 0.012,
        algorithmic: true,
        algorithm: 'convex-value-stack',
        pass: 'shadow',
        pastamaker: {
          dieFamily: 'softPatch',
          fieldKind: 'formContour',
          budgetMode: budget.mode,
          targetOpacity: round(budget.targetOpacity),
          expectedOverlapCount: budget.expectedOverlapCount,
        },
        blobIndex: shape.blobIndex,
        blobRole: shape.blobRole || shape.role,
      });
    }
  }

  const groundY = scene.ground?.y;
  if (Number.isFinite(groundY)) {
    const contact = bottomPoint(points);
    const width = Math.max(bb.w * 0.86, 1);
    const dx = -light[0] * bb.h * 0.55;
    stickers.push({
      kind: 'polygon',
      role: `${shape.role || 'shape'}:cast-shadow`,
      points: [
        [contact[0] - width * 0.45, groundY - 4],
        [contact[0] + width * 0.45, groundY - 4],
        [contact[0] + width * 0.62 + dx, groundY + bb.h * 0.12],
        [contact[0] - width * 0.48 + dx, groundY + bb.h * 0.1],
      ],
      fill: palette.cast,
      opacity: round(0.22 * intensity),
      z: baseZ - 0.6,
      algorithmic: true,
      algorithm: 'convex-value-stack',
      pass: 'cast-shadow',
      pastamaker: {
        dieFamily: 'softPatch',
        fieldKind: 'groundCast',
        budgetMode: 'single-layer',
        targetOpacity: round(0.22 * intensity),
        expectedOverlapCount: 1,
      },
      blobIndex: shape.blobIndex,
      blobRole: shape.blobRole || shape.role,
    });
  }

  return stickers;
}

function interBlobCastShadows(sourceMarks, scene, palette) {
  if (scene.interBlobShadows === false) return [];
  const forms = sourceMarks.filter(
    (mark) => mark?.kind === 'polygon' && Array.isArray(mark.points) && mark.points.length >= 3 && hasFormLighting(mark),
  );
  if (forms.length < 2) return [];

  const light = normalize(scene.light?.direction || [-0.6, -0.8]);
  const baseOpacity = clamp(finiteOr(scene.interBlobShadows?.opacity, 0.12), 0, 0.5);
  const reach = clamp(finiteOr(scene.interBlobShadows?.reach, 0.54), 0.1, 0.9);
  const maxGapScale = clamp(finiteOr(scene.interBlobShadows?.maxGapScale, 0.42), 0.05, 1.5);
  const candidatesByReceiver = new Map();

  for (const caster of forms) {
    const casterCenter = depthPointFor(caster);
    const casterBox = bbox(caster.points);
    const casterLightDepth = dot(light, casterCenter);
    const casterZ = caster.z ?? 0;

    for (const receiver of forms) {
      if (receiver === caster) continue;
      const receiverZ = receiver.z ?? 0;
      if (casterZ <= receiverZ) continue;

      const receiverCenter = depthPointFor(receiver);
      if (casterLightDepth <= dot(light, receiverCenter)) continue;

      const receiverBox = bbox(receiver.points);
      const gap = bboxGap(casterBox, receiverBox);
      const adjacencyLimit = Math.max(casterBox.w, casterBox.h, receiverBox.w, receiverBox.h) * maxGapScale;
      if (gap > adjacencyLimit) continue;

      const patch = interBlobShadowPatch({
        receiver,
        receiverCenter,
        receiverBox,
        casterCenter,
        casterBox,
        light,
        reach,
      });
      if (patch.length < 3) continue;

      const adjacency = 1 - clamp(gap / Math.max(adjacencyLimit, 1), 0, 1);
      const lightSeparation = clamp((casterLightDepth - dot(light, receiverCenter)) / 160, 0.35, 1);
      const opacity = round(baseOpacity * adjacency * lightSeparation);
      if (opacity < 0.035) continue;

      const zGap = Math.max(casterZ - receiverZ, 0.1);
      const score = (adjacency * lightSeparation) / zGap;
      const candidate = {
        kind: 'polygon',
        role: `${caster.role || 'shape'}:casts-on:${receiver.role || 'shape'}`,
        points: patch,
        fill: palette.core,
        opacity,
        z: receiverZ + 0.29,
        algorithmic: true,
        algorithm: 'inter-blob-cast-shadow',
        pass: 'inter-blob-shadow',
        casterBlobIndex: caster.blobIndex,
        casterBlobRole: caster.blobRole || caster.role,
        receiverBlobIndex: receiver.blobIndex,
        receiverBlobRole: receiver.blobRole || receiver.role,
        interBlobScore: round(score),
      };
      const key = receiver.sourceIndex ?? receiver.blobIndex ?? receiver.role;
      const previous = candidatesByReceiver.get(key);
      if (!previous || candidate.interBlobScore > previous.interBlobScore) {
        candidatesByReceiver.set(key, candidate);
      }
    }
  }

  return Array.from(candidatesByReceiver.values());
}

function interBlobShadowPatch({ receiver, receiverCenter, receiverBox, casterCenter, casterBox, light, reach }) {
  const shadowDir = normalize([-light[0], -light[1]]);
  const stripNormal = normalize([-shadowDir[1], shadowDir[0]]);
  const towardCaster = normalize([
    casterCenter[0] - receiverCenter[0],
    casterCenter[1] - receiverCenter[1],
  ]);
  const contactCenter = [
    receiverCenter[0] + (casterCenter[0] - receiverCenter[0]) * 0.32,
    receiverCenter[1] + (casterCenter[1] - receiverCenter[1]) * 0.32,
  ];
  const halfWidth = Math.max(
    4,
    Math.min(Math.max(casterBox.w, casterBox.h) * 0.34, Math.max(receiverBox.w, receiverBox.h) * 0.42),
  );
  const strip = clipBand(receiver.points, stripNormal, contactCenter, halfWidth);
  if (strip.length < 3) return [];

  const projection = projectionRange(receiver.points, towardCaster);
  const threshold = projection.max - Math.max(projection.max - projection.min, 1) * reach;
  return clipHalfPlane(strip, towardCaster, threshold, true);
}

function bboxGap(a, b) {
  const dx = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX));
  const dy = Math.max(0, Math.max(a.minY - b.maxY, b.minY - a.maxY));
  return Math.hypot(dx, dy);
}

function simpleHighlight(shape, scene, palette) {
  if (shape.kind !== 'polygon' || !Array.isArray(shape.points) || shape.points.length < 3) {
    return [];
  }
  const points = shape.points;
  const c = centroid(points);
  const light = normalize(scene.light?.direction || [-0.6, -0.8]);
  const intensity = clamp(shape.highlights?.intensity ?? 0.35, 0, 1);
  const rimHold = clamp(finiteOr(shape.highlights?.rimHold, 0.08), 0, 0.35);
  const baseZ = shape.z ?? 0;
  const projection = projectionRange(points, light);
  const stickers = [];
  const defaultExpectedOverlap = 4;
  const bands = [
    { reach: 0.32, sag: 0.22, pinch: 0.42, opacity: 0.16, rimHold },
    { reach: 0.23, sag: 0.18, pinch: 0.34, opacity: 0.24, rimHold: rimHold * 0.82 },
    { reach: 0.15, sag: 0.14, pinch: 0.27, opacity: 0.34, rimHold: rimHold * 0.68 },
    { reach: 0.09, sag: 0.1, pinch: 0.2, opacity: 0.46, rimHold: rimHold * 0.52 },
  ];
  const budget = resolveValueBudget(shape.highlights?.valueBudget, {
    targetOpacity: bands.reduce((sum, band) => sum + band.opacity, 0),
    expectedOverlapCount: defaultExpectedOverlap,
    mode: 'legacy-band',
  });

  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    const litPatch = highlightPatch(points, c, light, projection, band);
    if (litPatch.length >= 3) {
      const opacity = budget.mode === 'legacy-band'
        ? band.opacity
        : opacityForBudget(budget.targetOpacity, budget.expectedOverlapCount, budget.mode);
      stickers.push({
        kind: 'polygon',
        role: `${shape.role || 'shape'}:highlight-stack-${i + 1}`,
        points: litPatch,
        fill: palette.highlight,
        opacity: round(opacity * intensity),
        z: baseZ + 0.38 + i * 0.015,
        algorithmic: true,
        algorithm: 'simple-highlight',
        pass: 'highlight',
        pastamaker: {
          dieFamily: 'softPatch',
          fieldKind: 'formContour',
          budgetMode: budget.mode,
          targetOpacity: round(budget.targetOpacity),
          expectedOverlapCount: budget.expectedOverlapCount,
        },
        blobIndex: shape.blobIndex,
        blobRole: shape.blobRole || shape.role,
      });
    }
  }

  return stickers;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function resolveValueBudget(input, defaults = {}) {
  const budget = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const targetOpacity = clamp(
    finiteOr(budget.targetOpacity, finiteOr(defaults.targetOpacity, 0.75)),
    0,
    1,
  );
  const expectedOverlapCount = Math.max(
    1,
    Math.min(500, Math.round(finiteOr(budget.expectedOverlapCount, finiteOr(defaults.expectedOverlapCount, 1)))),
  );
  const mode = typeof budget.mode === 'string' ? budget.mode : defaults.mode || 'inverse-count';
  return { targetOpacity, expectedOverlapCount, mode };
}

function opacityForBudget(targetOpacity, expectedOverlapCount, mode = 'inverse-count') {
  const target = clamp(finiteOr(targetOpacity, 0.75), 0, 1);
  const count = Math.max(1, Math.round(finiteOr(expectedOverlapCount, 1)));
  if (mode === 'composited') {
    return round(clamp(1 - Math.pow(1 - target, 1 / count), 0, 1));
  }
  return round(clamp(target / count, 0, 1));
}

function finiteOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalize3([x, y, z]) {
  const len = Math.hypot(x, y, z);
  if (len < 1e-9) return [0, 0, 1];
  return [x / len, y / len, z / len];
}

function dot3([ax, ay, az], [bx, by, bz]) {
  return ax * bx + ay * by + az * bz;
}

function shadeHex(hex, factor) {
  const parsed = parseHexColor(hex);
  if (!parsed) return hex;
  const channels = parsed.map((channel) => clamp(Math.round(channel * factor), 0, 255));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function parseHexColor(hex) {
  if (typeof hex !== 'string') return null;
  const clean = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return clean.split('').map((c) => parseInt(`${c}${c}`, 16));
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
  }
  return null;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicWave(seed, index, t) {
  const a = ((seed % 17) + 3) * 0.017;
  const b = ((seed % 29) + 5) * 0.013;
  const c = ((seed % 37) + 7) * 0.011;
  return (
    Math.sin(t * 3 + seed * a + index * 0.13) * 0.48 +
    Math.sin(t * 5 + seed * b) * 0.32 +
    Math.cos(t * 2 + seed * c) * 0.2
  );
}

function roundPoint(n) {
  return Math.round(n * 100) / 100;
}

function projectionRange(points, axis) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    const v = dot(axis, p);
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  return { min, max };
}

function contourCap(points, axis, projection, reach) {
  const span = Math.max(projection.max - projection.min, 1);
  const tOf = (p) => (dot(axis, p) - projection.min) / span;
  let minIdx = 0;
  let minT = Infinity;
  for (let i = 0; i < points.length; i++) {
    const t = tOf(points[i]);
    if (t < minT) {
      minT = t;
      minIdx = i;
    }
  }

  const forward = walkContourToThreshold(points, tOf, minIdx, 1, reach);
  const backward = walkContourToThreshold(points, tOf, minIdx, -1, reach);
  const outerArc = backward.slice().reverse().concat(forward.slice(1));
  if (outerArc.length < 2) return [];

  const innerArc = outerArc.map(([x, y]) => {
    const localDepth = clamp(reach - tOf([x, y]), 0, reach);
    const inset = span * localDepth * 0.24;
    return [x + axis[0] * inset, y + axis[1] * inset];
  });
  return outerArc.concat(innerArc.reverse());
}

function highlightPatch(points, center, axis, projection, band) {
  const span = Math.max(projection.max - projection.min, 1);
  const tOf = (p) => (dot(axis, p) - projection.min) / span;
  let maxIdx = 0;
  let maxT = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const t = tOf(points[i]);
    if (t > maxT) {
      maxT = t;
      maxIdx = i;
    }
  }

  const threshold = 1 - band.reach;
  const forward = walkContourToThresholdHigh(points, tOf, maxIdx, 1, threshold);
  const backward = walkContourToThresholdHigh(points, tOf, maxIdx, -1, threshold);
  const contourArc = backward.slice().reverse().concat(forward.slice(1));
  if (contourArc.length < 2) return [];
  const rimInset = span * clamp(band.rimHold ?? 0, 0, 0.35);
  const topArc = contourArc.map((p) => [
    p[0] - axis[0] * rimInset + (center[0] - p[0]) * 0.018,
    p[1] - axis[1] * rimInset + (center[1] - p[1]) * 0.018,
  ]);

  const left = topArc[0];
  const right = topArc[topArc.length - 1];
  const normal = normalize([-axis[1], axis[0]]);
  const bottom = [];
  const steps = Math.max(4, Math.min(10, topArc.length));
  for (let i = 0; i < steps; i++) {
    const u = i / (steps - 1);
    const edgeMix = [
      right[0] + (left[0] - right[0]) * u,
      right[1] + (left[1] - right[1]) * u,
    ];
    const bulge = Math.sin(Math.PI * u);
    const towardCenter = [
      edgeMix[0] + (center[0] - edgeMix[0]) * band.pinch,
      edgeMix[1] + (center[1] - edgeMix[1]) * band.pinch,
    ];
    const sag = span * band.sag * bulge;
    const candidate = [
      towardCenter[0] - axis[0] * sag + normal[0] * sag * 0.12 * (u - 0.5),
      towardCenter[1] - axis[1] * sag + normal[1] * sag * 0.12 * (u - 0.5),
    ];
    bottom.push(candidate);
  }

  return topArc.concat(bottom);
}

function walkContourToThresholdHigh(points, tOf, startIdx, dir, threshold) {
  const n = points.length;
  const out = [points[startIdx]];
  let idx = startIdx;
  for (let guard = 0; guard < n; guard++) {
    const nextIdx = (idx + dir + n) % n;
    const current = points[idx];
    const next = points[nextIdx];
    const currentT = tOf(current);
    const nextT = tOf(next);
    if (nextT >= threshold) {
      out.push(next);
      idx = nextIdx;
      continue;
    }
    const denom = nextT - currentT;
    const f = Math.abs(denom) < 1e-9 ? 0 : (threshold - currentT) / denom;
    out.push([
      current[0] + (next[0] - current[0]) * clamp(f, 0, 1),
      current[1] + (next[1] - current[1]) * clamp(f, 0, 1),
    ]);
    break;
  }
  return out;
}

function walkContourToThreshold(points, tOf, startIdx, dir, reach) {
  const n = points.length;
  const out = [points[startIdx]];
  let idx = startIdx;
  for (let guard = 0; guard < n; guard++) {
    const nextIdx = (idx + dir + n) % n;
    const current = points[idx];
    const next = points[nextIdx];
    const currentT = tOf(current);
    const nextT = tOf(next);
    if (nextT <= reach) {
      out.push(next);
      idx = nextIdx;
      continue;
    }
    const denom = nextT - currentT;
    const f = Math.abs(denom) < 1e-9 ? 0 : (reach - currentT) / denom;
    out.push([
      current[0] + (next[0] - current[0]) * clamp(f, 0, 1),
      current[1] + (next[1] - current[1]) * clamp(f, 0, 1),
    ]);
    break;
  }
  return out;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}
