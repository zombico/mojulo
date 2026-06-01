export function findMandalaBlock(manifestOrMandala, role) {
  const mandala = manifestOrMandala?.polygonizer?.pureMandala || manifestOrMandala;
  if (!mandala || !Array.isArray(mandala.blocks) || !role) return null;
  return mandala.blocks.find((block) => block?.role === role) || null;
}

export function withGeneratedElementMandala(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return manifest;
  const polygonizer = manifest.polygonizer || {};
  const elements = Array.isArray(polygonizer.elements) ? polygonizer.elements : [];
  if (!elements.length) return manifest;
  const constellation = polygonizer.constellation;
  const nodes = Array.isArray(constellation?.nodes) ? constellation.nodes : [];
  if (!nodes.length) return manifest;
  const existing = polygonizer.elementMandala;
  if (existing && existing.generated === false) return manifest;
  const generated = buildGeneratedElementMandala(manifest, elements, nodes);
  if (!generated.elements.length) return manifest;
  return {
    ...manifest,
    polygonizer: {
      ...polygonizer,
      elementMandala: {
        ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}),
        ...generated,
      },
    },
  };
}

export function buildGeneratedElementMandala(manifest, elements, nodes) {
  const viewBox = manifest?.viewBox || {};
  const width = Math.max(finiteOr(viewBox.width, 800), 1);
  const height = Math.max(finiteOr(viewBox.height, 520), 1);
  const nodeByRole = new Map(nodes.map((node) => [node?.role, node]).filter(([role]) => role));
  const generatedElements = [];
  elements.forEach((element, index) => {
    const role = String(element?.role || `element-${index + 1}`);
    const node = nodeByRole.get(role);
    if (!node || !validBounds(node.bounds)) return;
    generatedElements.push(generatedElementMandala({ element, index, role, node, width, height }));
  });
  return {
    kind: 'generated-element-mandala',
    generated: true,
    source: 'constellation-node-local-top-down',
    principle: 'each generated element owns a local top-down math space bound to its overall constellation bounds',
    inventoryAtoms: generatedElements.map((element) => ({
      role: element.role,
      index: element.index,
      boundTo: element.boundTo,
      verticalMap: element.verticalMap,
    })),
    elements: generatedElements,
  };
}

function generatedElementMandala({ element, index, role, node, width, height }) {
  const bounds = node.bounds;
  const mandala = element?.mandala && typeof element.mandala === 'object' && !Array.isArray(element.mandala)
    ? element.mandala
    : {};
  const cameraOverride = mandala.camera && typeof mandala.camera === 'object' && !Array.isArray(mandala.camera)
    ? mandala.camera
    : {};
  const localWidth = Math.max(finiteOr(element?.mandala?.width, finiteOr(element?.units?.width, 10)), 1);
  const localLength = Math.max(finiteOr(element?.mandala?.length, finiteOr(element?.units?.length, 10)), 1);
  const worldXY = [
    round((bounds.x + bounds.width / 2 - width / 2) / Math.max(width, 1) * 20),
    round((bounds.y + bounds.height / 2 - height / 2) / Math.max(height, 1) * -20),
  ];
  const screenOrigin = [bounds.x + bounds.width / 2, bounds.y + bounds.height / 2];
  const unitScale = Math.max(Math.min(bounds.width / localWidth, bounds.height / localLength), 1);
  const cameraScreenOrigin = validPoint(cameraOverride.screenOrigin) || validPoint(mandala.screenOrigin) || screenOrigin;
  const cameraEast = validPoint(cameraOverride.east) || validPoint(mandala.east) || [1, 0];
  const cameraNorth = validPoint(cameraOverride.north) || validPoint(mandala.north) || [0, 1];
  const cameraZenith = validPoint(cameraOverride.zenith) || validPoint(mandala.zenith) || [0, -1];
  return {
    role,
    index,
    parent: node.parent || null,
    inventoryAtom: {
      role,
      index,
      kind: 'one-atom-per-inventory-element',
      constellationRole: node.role,
    },
    verticalMap: {
      kind: 'constellation-node-vertical-mapping',
      anchorY: round(finiteOr(node.anchor?.[1], screenOrigin[1])),
      centerY: round(screenOrigin[1]),
      boundsTop: round(bounds.y),
      boundsBottom: round(bounds.y + bounds.height),
      order: index,
    },
    boundTo: {
      kind: 'constellation-node',
      role: node.role,
      bounds: node.bounds,
      anchor: node.anchor,
      cca: node.cca,
    },
    topDown: {
      kind: 'local-top-down-math-space',
      origin: 'element-center',
      worldXY,
      sizeXY: [round(localWidth), round(localLength)],
      axes: {
        east: [1, 0],
        north: [0, -1],
        up: [0, 0, 1],
      },
      camera: {
        screenOrigin: cameraScreenOrigin.map(round),
        east: cameraEast.map(round),
        north: cameraNorth.map(round),
        zenith: cameraZenith.map(round),
        unitScale: round(finiteOr(cameraOverride.unitScale, mandala.unitScale ?? unitScale)),
        depthScale: clamp(finiteOr(cameraOverride.depthScale, mandala.depthScale ?? 1), 0.2, 1),
      },
    },
    projection: {
      overallSpace: 'constellation',
      localToOverall: 'fit-local-mandala-to-node-bounds',
      nodeRole: node.role,
    },
  };
}

export function projectMandalaPoint(mandala, point = {}) {
  const camera = mandala?.camera || {};
  const origin = validPoint(camera.screenOrigin) || [0, 0];
  const east = normalize2(validPoint(camera.east) || [1, 0]);
  const north = normalize2(validPoint(camera.north) || [0.55, -0.72]);
  const zenith = normalize2(validPoint(camera.zenith) || [0, -1]);
  const unitScale = finiteOr(camera.unitScale, 48);
  const depthScale = clamp(finiteOr(camera.depthScale, 0.84), 0.2, 1);
  const x = finiteOr(point.x ?? point.worldX, 0);
  const y = finiteOr(point.y ?? point.worldY, 0);
  const altitude = finiteOr(point.z ?? point.altitude, 0);
  const compression = Math.pow(depthScale, Math.max(0, -y));
  return [
    round(origin[0] + east[0] * x * unitScale + north[0] * y * unitScale * compression + zenith[0] * altitude * unitScale),
    round(origin[1] + east[1] * x * unitScale + north[1] * y * unitScale * compression + zenith[1] * altitude * unitScale),
  ];
}

export function projectMandalaBlock(mandala, block) {
  if (!mandala || !block) return null;
  const worldXY = validPoint(block.worldXY) || [0, 0];
  const altitude = finiteOr(block.altitude, 0);
  const anchor = projectMandalaPoint(mandala, { x: worldXY[0], y: worldXY[1], altitude });
  const floorAnchor = projectMandalaPoint(mandala, { x: worldXY[0], y: worldXY[1], altitude: 0 });
  const unitScale = finiteOr(mandala.camera?.unitScale, 48);
  const sizeXY = Array.isArray(block.sizeXY) ? block.sizeXY : [1, 1];
  const height = finiteOr(block.height, 1);
  return {
    role: block.role,
    anchor,
    floorAnchor,
    worldXY,
    altitude,
    height,
    screenCellSize: Math.max(unitScale * Math.max(finiteOr(sizeXY[0], 1), finiteOr(sizeXY[1], 1)) / 3, 1),
  };
}

export function projectTwoPoint(worldXYZ, cameraPrimitive = {}, roomBasis = {}) {
  const point = Array.isArray(worldXYZ)
    ? worldXYZ
    : [worldXYZ?.x, worldXYZ?.y, worldXYZ?.z ?? worldXYZ?.altitude];
  const x = finiteOr(point[0], 0);
  const y = finiteOr(point[1], 0);
  const z = finiteOr(point[2], 0);
  const vpLeft = validPoint(cameraPrimitive.vanishingPoints?.left) || [-220, 245];
  const vpRight = validPoint(cameraPrimitive.vanishingPoints?.right) || [1180, vpLeft[1]];
  const xRange = orderedRange(roomBasis.xRange || [-18, 18]);
  const yRange = orderedRange(roomBasis.yRange || [-28, 8]);
  const frontY = finiteOr(roomBasis.frontY, Math.max(yRange[0], yRange[1]));
  const backY = finiteOr(roomBasis.backY, Math.min(yRange[0], yRange[1]));
  const depthSpan = Math.max(Math.abs(frontY - backY), 0.001);
  const depthT = clamp((frontY - y) / depthSpan, 0, 1.18);
  const widthT = clamp((x - xRange[0]) / Math.max(xRange[1] - xRange[0], 0.001), -0.18, 1.18);
  const frontLeft = validPoint(roomBasis.frontLeft) || [210, 510];
  const frontRight = validPoint(roomBasis.frontRight) || lerpPoint(frontLeft, vpRight, 0.52);
  const depthReach = clamp(finiteOr(roomBasis.depthReach, 0.46), 0.08, 0.88);
  const depthCurve = 1 - Math.pow(1 - clamp(depthT, 0, 1), 1.18);
  const leftDepthPoint = lerpPoint(frontLeft, vpLeft, depthCurve * depthReach);
  const frontPoint = lerpPoint(frontLeft, frontRight, widthT);
  const floor = intersectLines(leftDepthPoint, vpRight, frontPoint, vpLeft) ||
    lerpPoint(frontPoint, vpLeft, depthCurve * depthReach);
  const verticalAxis = normalize2(validPoint(cameraPrimitive.verticalAxis) || [0, -1]);
  const verticalUnit = Math.max(finiteOr(roomBasis.verticalUnit, 26), 1);
  const verticalScale = clamp(1 - depthT * finiteOr(roomBasis.verticalDepthShrink, 0.42), 0.34, 1.16);
  return [
    round(floor[0] + verticalAxis[0] * z * verticalUnit * verticalScale),
    round(floor[1] + verticalAxis[1] * z * verticalUnit * verticalScale),
    round(depthT),
    round(verticalScale),
  ];
}

function intersectLines(a, b, c, d) {
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const dcx = d[0] - c[0];
  const dcy = d[1] - c[1];
  const denom = bax * dcy - bay * dcx;
  if (Math.abs(denom) < 1e-9) return null;
  const cax = c[0] - a[0];
  const cay = c[1] - a[1];
  const t = (cax * dcy - cay * dcx) / denom;
  return [a[0] + bax * t, a[1] + bay * t];
}

function orderedRange(range) {
  const a = finiteOr(range?.[0], 0);
  const b = finiteOr(range?.[1], 1);
  return a <= b ? [a, b] : [b, a];
}

function lerpPoint(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function validPoint(point) {
  return Array.isArray(point) && point.length === 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))
    ? [Number(point[0]), Number(point[1])]
    : null;
}

function validBounds(bounds) {
  return bounds &&
    Number.isFinite(Number(bounds.x)) &&
    Number.isFinite(Number(bounds.y)) &&
    Number.isFinite(Number(bounds.width)) &&
    Number.isFinite(Number(bounds.height)) &&
    Number(bounds.width) > 0 &&
    Number(bounds.height) > 0;
}

function normalize2(vector) {
  const x = finiteOr(vector?.[0], 0);
  const y = finiteOr(vector?.[1], 0);
  const length = Math.hypot(x, y);
  if (length <= 1e-9) return [0, -1];
  return [x / length, y / length];
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
