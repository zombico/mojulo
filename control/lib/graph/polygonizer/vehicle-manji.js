/**
 * Vehicle manji primitives.
 *
 * Grounded vehicle bases are resolved in mandala/world space first, then
 * projected. The exported builders return lightweight render primitives so
 * callers can paint them as SVG, canvas, or another vector layer.
 */

export const VEHICLE_MANJI_VERSION = 'vehicle-manji-v0.1.0';

function normalizeAxis(axis) {
  return axis === 'y' ? 'y' : 'x';
}

function requireProject(project) {
  if (typeof project !== 'function') {
    throw new TypeError('vehicle manji builders require a project([x, y, z]) function');
  }
  return project;
}

function p(project, point) {
  const projected = project(point);
  return { x: projected[0], y: projected[1] };
}

export function vehicleManjiPoint(origin, axis, along, across, z = 0) {
  const resolvedAxis = normalizeAxis(axis);
  if (resolvedAxis === 'y') return [origin[0] + across, origin[1] + along, z];
  return [origin[0] + along, origin[1] + across, z];
}

export function translatedScreenPoints(points, dx, dy) {
  return points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
}

export function buildWheelStickerPrimitive({
  project,
  center,
  radius,
  stickerCount = 4,
  pixelStep = 1,
  hubcapScale = 0.42,
  wheelAxis = 'y',
  depthSign = 1,
  role = 'vehicle-wheel',
  capSegments = 32,
} = {}) {
  const projectPoint = requireProject(project);
  const resolvedWheelAxis = wheelAxis === 'x' ? 'x' : 'y';
  const resolvedDepthSign = depthSign < 0 ? -1 : 1;
  const [cx, cy, cz] = center;
  const projectedCenter = p(projectPoint, [cx, cy, cz]);
  const directionTarget = resolvedWheelAxis === 'x'
    ? p(projectPoint, [cx + 0.32 * resolvedDepthSign, cy, cz])
    : p(projectPoint, [cx, cy + 0.32 * resolvedDepthSign, cz]);
  const vx = directionTarget.x - projectedCenter.x;
  const vy = directionTarget.y - projectedCenter.y;
  const length = Math.max(0.001, Math.hypot(vx, vy));
  const ux = vx / length;
  const uy = vy / length;
  const capPoints = [];
  const hubcapPoints = [];
  for (let i = 0; i < capSegments; i += 1) {
    const theta = (Math.PI * 2 * i) / capSegments;
    if (resolvedWheelAxis === 'x') {
      capPoints.push(p(projectPoint, [cx, cy + Math.cos(theta) * radius, cz + Math.sin(theta) * radius]));
      hubcapPoints.push(p(projectPoint, [
        cx,
        cy + Math.cos(theta) * radius * hubcapScale,
        cz + Math.sin(theta) * radius * hubcapScale,
      ]));
    } else {
      capPoints.push(p(projectPoint, [cx + Math.cos(theta) * radius, cy, cz + Math.sin(theta) * radius]));
      hubcapPoints.push(p(projectPoint, [
        cx + Math.cos(theta) * radius * hubcapScale,
        cy,
        cz + Math.sin(theta) * radius * hubcapScale,
      ]));
    }
  }
  const steps = Math.max(1, stickerCount);
  const shapes = [];
  for (let i = 0; i < steps; i += 1) {
    shapes.push({
      kind: 'polygon',
      role: `${role}:body-sticker:${i}`,
      points: translatedScreenPoints(capPoints, ux * pixelStep * i, uy * pixelStep * i),
      fill: '#111827',
      stroke: 'none',
      strokeWidth: 0,
      meta: {
        pixelStep,
        wheelAxis: resolvedWheelAxis,
        depthSign: resolvedDepthSign,
        stickerIndex: i,
      },
    });
  }
  shapes.push({
    kind: 'polygon',
    role: `${role}:outer-hubcap`,
    points: translatedScreenPoints(hubcapPoints, ux * pixelStep * (steps - 1), uy * pixelStep * (steps - 1)),
    fill: '#f8fafc',
    stroke: '#475569',
    strokeWidth: 0.75,
    meta: {
      pixelStep,
      wheelAxis: resolvedWheelAxis,
      depthSign: resolvedDepthSign,
      hubcapScale,
    },
  });
  return {
    kind: 'wheelStickerPrimitive',
    role,
    center,
    radius,
    stickerCount: steps,
    pixelStep,
    wheelAxis: resolvedWheelAxis,
    depthSign: resolvedDepthSign,
    shapes,
  };
}

export function wheelRenderPolicyForRoadAxis(axis) {
  const resolvedAxis = normalizeAxis(axis);
  if (resolvedAxis === 'y') {
    return {
      wheelAxis: 'x',
      depthSign: -1,
      farAcrossSide: 'right',
      nearAcrossSide: 'left',
    };
  }
  return {
    wheelAxis: 'y',
    depthSign: 1,
    farAcrossSide: 'horizon',
    nearAcrossSide: 'screen',
  };
}

export function buildRoadAxisChassisManji({
  project,
  origin,
  axis = 'x',
  length = 5,
  width = 1.2,
  wheelRadius = 0.26,
  wheelZ = 0.1,
  stickerCount = 4,
  pixelStep = 1,
  role = 'vehicle-chassis-manji',
  axleFractions = [0.18, 0.82],
} = {}) {
  const projectPoint = requireProject(project);
  const resolvedAxis = normalizeAxis(axis);
  const policy = wheelRenderPolicyForRoadAxis(resolvedAxis);
  const axleZ = wheelZ + wheelRadius;
  const farAcross = resolvedAxis === 'y' ? width : 0;
  const nearAcross = resolvedAxis === 'y' ? 0 : width;
  const centerAcross = width / 2;
  const axleAlong = axleFractions.map((fraction) => length * fraction);
  const shapes = [];
  const wheelCenters = [];

  for (const [index, along] of axleAlong.entries()) {
    const center = vehicleManjiPoint(origin, resolvedAxis, along, farAcross, wheelZ + wheelRadius);
    wheelCenters.push({ index, side: 'far', center });
    shapes.push(...buildWheelStickerPrimitive({
      project: projectPoint,
      center,
      radius: wheelRadius,
      stickerCount,
      pixelStep,
      role: `${role}:axle:${index}:far-wheel:axis-${resolvedAxis}:mandala-projected`,
      wheelAxis: policy.wheelAxis,
      depthSign: policy.depthSign,
    }).shapes);
  }

  for (const [index, along] of axleAlong.entries()) {
    shapes.push({
      kind: 'line',
      role: `${role}:axle:${index}:axis-${resolvedAxis}:mandala-projected`,
      from: p(projectPoint, vehicleManjiPoint(origin, resolvedAxis, along, farAcross, axleZ)),
      to: p(projectPoint, vehicleManjiPoint(origin, resolvedAxis, along, nearAcross, axleZ)),
      stroke: '#0f172a',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
    });
  }

  shapes.push({
    kind: 'line',
    role: `${role}:center-road-axis-bar:axis-${resolvedAxis}:mandala-projected`,
    from: p(projectPoint, vehicleManjiPoint(origin, resolvedAxis, axleAlong[0], centerAcross, axleZ)),
    to: p(projectPoint, vehicleManjiPoint(origin, resolvedAxis, axleAlong[axleAlong.length - 1], centerAcross, axleZ)),
    stroke: '#0f172a',
    strokeWidth: 2.2,
    strokeLinecap: 'round',
  });

  for (const [index, along] of axleAlong.entries()) {
    const center = vehicleManjiPoint(origin, resolvedAxis, along, nearAcross, wheelZ + wheelRadius);
    wheelCenters.push({ index, side: 'near', center });
    shapes.push(...buildWheelStickerPrimitive({
      project: projectPoint,
      center,
      radius: wheelRadius,
      stickerCount,
      pixelStep,
      role: `${role}:axle:${index}:near-wheel:axis-${resolvedAxis}:mandala-projected`,
      wheelAxis: policy.wheelAxis,
      depthSign: policy.depthSign,
    }).shapes);
  }

  return {
    kind: 'roadAxisChassisManji',
    role,
    axis: resolvedAxis,
    origin,
    length,
    width,
    wheelRadius,
    wheelZ,
    axleZ,
    stickerCount,
    wheelPolicy: policy,
    axleAlong,
    wheelCenters,
    shapes,
  };
}

export function buildAircraftSpineManji({
  project,
  origin,
  axis = 'x',
  length = 8,
  width = 5,
  spineZ = 0.75,
  wingFraction = 0.46,
  tailFraction = 0.84,
  noseFraction = 0.04,
  tailplaneWidthScale = 0.34,
  alongDirection = 1,
  role = 'aircraft-spine-manji',
} = {}) {
  const projectPoint = requireProject(project);
  const resolvedAxis = normalizeAxis(axis);
  const direction = alongDirection < 0 ? -1 : 1;
  const aircraftPoint = (along, across, z = spineZ) => {
    const resolvedAlong = direction < 0 ? length - along : along;
    return vehicleManjiPoint(origin, resolvedAxis, resolvedAlong, across, z);
  };
  const centerAcross = width / 2;
  const noseAlong = length * noseFraction;
  const tailAlong = length;
  const wingAlong = length * wingFraction;
  const tailplaneAlong = length * tailFraction;
  const tailplaneInset = (width * (1 - tailplaneWidthScale)) / 2;
  const shapes = [
    {
      kind: 'line',
      role: `${role}:center-fuselage-spine:axis-${resolvedAxis}:mandala-projected`,
      from: p(projectPoint, aircraftPoint(noseAlong, centerAcross, spineZ)),
      to: p(projectPoint, aircraftPoint(tailAlong, centerAcross, spineZ)),
      stroke: '#0f172a',
      strokeWidth: 2.4,
      strokeLinecap: 'round',
    },
    {
      kind: 'line',
      role: `${role}:main-wing-crossbar:axis-${resolvedAxis}:mandala-projected`,
      from: p(projectPoint, aircraftPoint(wingAlong, 0, spineZ)),
      to: p(projectPoint, aircraftPoint(wingAlong, width, spineZ)),
      stroke: '#0f172a',
      strokeWidth: 2.1,
      strokeLinecap: 'round',
    },
    {
      kind: 'line',
      role: `${role}:tailplane-crossbar:axis-${resolvedAxis}:mandala-projected`,
      from: p(projectPoint, aircraftPoint(tailplaneAlong, tailplaneInset, spineZ)),
      to: p(projectPoint, aircraftPoint(tailplaneAlong, width - tailplaneInset, spineZ)),
      stroke: '#334155',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
    },
  ];

  return {
    kind: 'aircraftSpineManji',
    role,
    axis: resolvedAxis,
    origin,
    length,
    width,
    spineZ,
    alongDirection: direction,
    spineAlong: [noseAlong, tailAlong],
    wingAlong,
    tailplaneAlong,
    shapes,
    supportSlots: {
      fuselage: {
        from: aircraftPoint(noseAlong, centerAcross, spineZ),
        to: aircraftPoint(tailAlong, centerAcross, spineZ),
      },
      wing: {
        from: aircraftPoint(wingAlong, 0, spineZ),
        to: aircraftPoint(wingAlong, width, spineZ),
      },
      tailplane: {
        from: aircraftPoint(tailplaneAlong, tailplaneInset, spineZ),
        to: aircraftPoint(tailplaneAlong, width - tailplaneInset, spineZ),
      },
    },
  };
}

export function buildBlockOnChassisManji({
  project,
  origin,
  axis = 'x',
  length = 6,
  width = 1.2,
  wheelRadius = 0.26,
  wheelZ = 0.1,
  stickerCount = 4,
  bodyLength = length + 0.6,
  bodyWidth = width + 0.5,
  bodyHeight = 1.3,
  bodyAlongInset = -0.3,
  bodyAcrossInset = -0.25,
  bodyBottomClearance = 0.02,
  role = 'vehicle-block-on-chassis',
} = {}) {
  const resolvedAxis = normalizeAxis(axis);
  const chassis = buildRoadAxisChassisManji({
    project,
    origin,
    axis: resolvedAxis,
    length,
    width,
    wheelRadius,
    wheelZ,
    stickerCount,
    role: `${role}:grounded-chassis-manji`,
  });
  const bodyBottomZ = wheelZ + wheelRadius * 2 + bodyBottomClearance;
  const bodyStart = vehicleManjiPoint(origin, resolvedAxis, bodyAlongInset, bodyAcrossInset, bodyBottomZ);
  const bodyBox = resolvedAxis === 'y'
    ? {
      x: bodyStart[0],
      y: bodyStart[1],
      z: bodyBottomZ,
      width: bodyWidth,
      length: bodyLength,
      height: bodyHeight,
    }
    : {
      x: bodyStart[0],
      y: bodyStart[1],
      z: bodyBottomZ,
      width: bodyLength,
      length: bodyWidth,
      height: bodyHeight,
    };
  const overlayWheelSelector = ':near-wheel:';
  const overlayWheelShapes = chassis.shapes.filter((shape) => shape.role.includes(overlayWheelSelector));
  const underBodyChassisShapes = chassis.shapes.filter((shape) => !shape.role.includes(overlayWheelSelector));
  return {
    kind: 'blockOnChassisManji',
    role,
    axis: resolvedAxis,
    origin,
    length,
    width,
    wheelRadius,
    wheelZ,
    bodyBox,
    bodyFootprint: {
      x: bodyBox.x,
      y: bodyBox.y,
      z: 0.01,
      width: bodyBox.width,
      length: bodyBox.length,
    },
    chassis,
    paintGroups: {
      underBodyChassisShapes,
      overlayWheelShapes,
    },
  };
}

export function buildRectangularVehicleOnWheels({
  project,
  origin,
  axis = 'x',
  length = 6,
  width = 1.2,
  wheelRadius = 0.26,
  wheelZ = 0.1,
  stickerCount = 4,
  bodyLength = length + 0.6,
  bodyWidth = width + 0.5,
  bodyHeight = 1.3,
  bodyAlongInset = -0.3,
  bodyAcrossInset = -0.25,
  bodyBottomClearance = 0.02,
  role = 'rectangular-vehicle-on-wheels',
  vehicleClass = 'rectangular-payload',
  payloadKind = 'box',
  facadePolicy = 'slot-allocated',
  axleFractions = null,
} = {}) {
  const resolvedAxis = normalizeAxis(axis);
  const chassisArgs = {
    project,
    origin,
    axis: resolvedAxis,
    length,
    width,
    wheelRadius,
    wheelZ,
    stickerCount,
    role: `${role}:grounded-chassis-manji`,
  };
  if (Array.isArray(axleFractions)) chassisArgs.axleFractions = axleFractions;
  const chassis = buildRoadAxisChassisManji(chassisArgs);
  const bodyBottomZ = wheelZ + wheelRadius * 2 + bodyBottomClearance;
  const bodyStart = vehicleManjiPoint(origin, resolvedAxis, bodyAlongInset, bodyAcrossInset, bodyBottomZ);
  const bodyBox = resolvedAxis === 'y'
    ? {
      x: bodyStart[0],
      y: bodyStart[1],
      z: bodyBottomZ,
      width: bodyWidth,
      length: bodyLength,
      height: bodyHeight,
    }
    : {
      x: bodyStart[0],
      y: bodyStart[1],
      z: bodyBottomZ,
      width: bodyLength,
      length: bodyWidth,
      height: bodyHeight,
    };
  const overlayWheelSelector = ':near-wheel:';
  const overlayWheelShapes = chassis.shapes.filter((shape) => shape.role.includes(overlayWheelSelector));
  const underBodyChassisShapes = chassis.shapes.filter((shape) => !shape.role.includes(overlayWheelSelector));
  const alongSpan = resolvedAxis === 'y' ? bodyBox.length : bodyBox.width;
  const acrossSpan = resolvedAxis === 'y' ? bodyBox.width : bodyBox.length;
  return {
    kind: 'rectangularVehicleOnWheels',
    role,
    vehicleClass,
    payloadKind,
    facadePolicy,
    axis: resolvedAxis,
    origin,
    length,
    width,
    wheelRadius,
    wheelZ,
    bodyBox,
    bodyFootprint: {
      x: bodyBox.x,
      y: bodyBox.y,
      z: 0.01,
      width: bodyBox.width,
      length: bodyBox.length,
    },
    slots: {
      alongSpan,
      acrossSpan,
      wheelKeepOutRanges: wheelKeepOutRanges({ axis: resolvedAxis, bodyBox, chassis, wheelRadius }),
      sideDecoratorBand: [0, alongSpan],
      frontDecoratorBand: [0, acrossSpan],
      roofBand: [bodyHeight, bodyHeight * 1.16],
    },
    chassis,
    paintGroups: {
      underBodyChassisShapes,
      overlayWheelShapes,
    },
  };
}

export function buildRailHeadCarMandalaPlan({
  origin,
  axis = 'x',
  railGauge = 1.18,
  length = 6,
  bodyLength = length + 0.35,
  bodyWidth = railGauge + 0.36,
  bodyHeight = 0.92,
  bodyAlongInset = -0.35,
  bodyAcrossInset = -0.18,
  bodyBottomZ = null,
  wheelRadius = 0.18,
  wheelZ = 0.1,
  bodyBottomClearance = -0.09,
  axleFractions = [0.18, 0.82],
  noseStartFraction = 0.62,
  noseExtension = 1.05,
  noseDirection = 'toward-vp',
  role = 'rail-head-car-mandala-plan',
  vehicleClass = 'rail-head-car',
  payloadKind = 'rail-head-car-curved-nose',
} = {}) {
  const resolvedAxis = normalizeAxis(axis);
  const resolvedBodyBottomZ = bodyBottomZ ?? wheelZ + wheelRadius * 2 + bodyBottomClearance;
  const facesTowardVp = noseDirection !== 'away-from-horizon';
  const bodyAlongStart = bodyAlongInset;
  const bodyAlongEnd = bodyAlongInset + bodyLength;
  const bodyAcrossStart = bodyAcrossInset;
  const bodyAcrossEnd = bodyAcrossInset + bodyWidth;
  const noseJoinAlong = facesTowardVp
    ? bodyAlongStart + bodyLength * noseStartFraction
    : bodyAlongStart + bodyLength * (1 - noseStartFraction);
  const noseTipAlong = facesTowardVp
    ? bodyAlongEnd + noseExtension
    : bodyAlongStart - noseExtension;
  const cabinAlongStart = facesTowardVp ? bodyAlongStart : noseJoinAlong;
  const cabinAlongEnd = facesTowardVp ? noseJoinAlong : bodyAlongEnd;
  const totalAlongStart = Math.min(bodyAlongStart, noseJoinAlong, noseTipAlong);
  const totalAlongEnd = Math.max(bodyAlongEnd, noseJoinAlong, noseTipAlong);
  const bodyStart = vehicleManjiPoint(origin, resolvedAxis, bodyAlongStart, bodyAcrossStart, resolvedBodyBottomZ);
  const cabinStart = vehicleManjiPoint(origin, resolvedAxis, cabinAlongStart, bodyAcrossStart, resolvedBodyBottomZ);
  const bodyBox = resolvedAxis === 'y'
    ? {
      x: bodyStart[0],
      y: bodyStart[1],
      z: resolvedBodyBottomZ,
      width: bodyWidth,
      length: bodyLength,
      height: bodyHeight,
    }
    : {
      x: bodyStart[0],
      y: bodyStart[1],
      z: resolvedBodyBottomZ,
      width: bodyLength,
      length: bodyWidth,
      height: bodyHeight,
    };
  const cabinBox = resolvedAxis === 'y'
    ? {
      x: cabinStart[0],
      y: cabinStart[1],
      z: resolvedBodyBottomZ,
      width: bodyWidth,
      length: cabinAlongEnd - cabinAlongStart,
      height: bodyHeight,
    }
    : {
      x: cabinStart[0],
      y: cabinStart[1],
      z: resolvedBodyBottomZ,
      width: cabinAlongEnd - cabinAlongStart,
      length: bodyWidth,
      height: bodyHeight,
    };
  const totalFootprint = {
    alongStart: totalAlongStart,
    alongEnd: totalAlongEnd,
    acrossStart: bodyAcrossStart,
    acrossEnd: bodyAcrossEnd,
    width: bodyAcrossEnd - bodyAcrossStart,
    length: totalAlongEnd - totalAlongStart,
    area: (totalAlongEnd - totalAlongStart) * (bodyAcrossEnd - bodyAcrossStart),
  };
  return {
    kind: 'railHeadCarMandalaPlan',
    role,
    axis: resolvedAxis,
    origin,
    railGauge,
    length,
    bodyBox,
    cabinBox,
    bodyBudget: {
      alongStart: bodyAlongStart,
      alongEnd: bodyAlongEnd,
      acrossStart: bodyAcrossStart,
      acrossEnd: bodyAcrossEnd,
      width: bodyAcrossEnd - bodyAcrossStart,
      length: bodyAlongEnd - bodyAlongStart,
      area: (bodyAlongEnd - bodyAlongStart) * (bodyAcrossEnd - bodyAcrossStart),
    },
    cabinBudget: {
      alongStart: cabinAlongStart,
      alongEnd: cabinAlongEnd,
      acrossStart: bodyAcrossStart,
      acrossEnd: bodyAcrossEnd,
      width: bodyAcrossEnd - bodyAcrossStart,
      length: cabinAlongEnd - cabinAlongStart,
      area: (cabinAlongEnd - cabinAlongStart) * (bodyAcrossEnd - bodyAcrossStart),
    },
    noseBudget: {
      direction: noseDirection,
      facesTowardVp,
      joinAlong: noseJoinAlong,
      tipAlong: noseTipAlong,
      alongStart: Math.min(noseJoinAlong, noseTipAlong),
      alongEnd: Math.max(noseJoinAlong, noseTipAlong),
      acrossStart: bodyAcrossStart,
      acrossEnd: bodyAcrossEnd,
      width: bodyAcrossEnd - bodyAcrossStart,
      length: Math.abs(noseTipAlong - noseJoinAlong),
      area: Math.abs(noseTipAlong - noseJoinAlong) * (bodyAcrossEnd - bodyAcrossStart),
    },
    totalFootprint,
    slots: {
      railGauge,
      bodyAcrossBand: [bodyAcrossStart, bodyAcrossEnd],
      cabinAlongBand: [cabinAlongStart, cabinAlongEnd],
      noseAlongBand: [Math.min(noseJoinAlong, noseTipAlong), Math.max(noseJoinAlong, noseTipAlong)],
      totalAlongBand: [totalAlongStart, totalAlongEnd],
    },
    vehicleOptions: {
      origin,
      axis: resolvedAxis,
      length,
      width: railGauge,
      wheelRadius,
      wheelZ,
      bodyLength,
      bodyWidth,
      bodyHeight,
      bodyAlongInset,
      bodyAcrossInset,
      bodyBottomClearance,
      axleFractions,
      role,
      vehicleClass,
      payloadKind,
    },
  };
}

function sideFaceRect(projectPoint, bodyBox, axis, alongStart, alongLength, zStart, zHeight) {
  const resolvedAxis = normalizeAxis(axis);
  if (resolvedAxis === 'y') {
    const x = bodyBox.x - 0.004;
    const y0 = bodyBox.y + alongStart;
    const y1 = y0 + alongLength;
    const z0 = bodyBox.z + zStart;
    const z1 = z0 + zHeight;
    return [
      p(projectPoint, [x, y0, z0]),
      p(projectPoint, [x, y1, z0]),
      p(projectPoint, [x, y1, z1]),
      p(projectPoint, [x, y0, z1]),
    ];
  }
  const y = bodyBox.y + bodyBox.length + 0.004;
  const x0 = bodyBox.x + alongStart;
  const x1 = x0 + alongLength;
  const z0 = bodyBox.z + zStart;
  const z1 = z0 + zHeight;
  return [
    p(projectPoint, [x0, y, z0]),
    p(projectPoint, [x1, y, z0]),
    p(projectPoint, [x1, y, z1]),
    p(projectPoint, [x0, y, z1]),
  ];
}

function frontFaceRect(projectPoint, bodyBox, axis, acrossStart, acrossLength, zStart, zHeight) {
  const resolvedAxis = normalizeAxis(axis);
  if (resolvedAxis === 'y') {
    const y = bodyBox.y + bodyBox.length + 0.004;
    const x0 = bodyBox.x + acrossStart;
    const x1 = x0 + acrossLength;
    const z0 = bodyBox.z + zStart;
    const z1 = z0 + zHeight;
    return [
      p(projectPoint, [x0, y, z0]),
      p(projectPoint, [x1, y, z0]),
      p(projectPoint, [x1, y, z1]),
      p(projectPoint, [x0, y, z1]),
    ];
  }
  const x = bodyBox.x - 0.004;
  const y0 = bodyBox.y + acrossStart;
  const y1 = y0 + acrossLength;
  const z0 = bodyBox.z + zStart;
  const z1 = z0 + zHeight;
  return [
    p(projectPoint, [x, y0, z0]),
    p(projectPoint, [x, y1, z0]),
    p(projectPoint, [x, y1, z1]),
    p(projectPoint, [x, y0, z1]),
  ];
}

function boxFacePolygon(projectPoint, box, face, role, {
  fill,
  stroke = '#334155',
  strokeWidth = 0.7,
  meta = {},
} = {}) {
  const p0 = p(projectPoint, [box.x, box.y, box.z]);
  const p1 = p(projectPoint, [box.x + box.width, box.y, box.z]);
  const p2 = p(projectPoint, [box.x + box.width, box.y + box.length, box.z]);
  const p3 = p(projectPoint, [box.x, box.y + box.length, box.z]);
  const t0 = p(projectPoint, [box.x, box.y, box.z + box.height]);
  const t1 = p(projectPoint, [box.x + box.width, box.y, box.z + box.height]);
  const t2 = p(projectPoint, [box.x + box.width, box.y + box.length, box.z + box.height]);
  const t3 = p(projectPoint, [box.x, box.y + box.length, box.z + box.height]);
  const pointsByFace = {
    front: [p3, p2, t2, t3],
    right: [p2, p1, t1, t2],
    top: [t3, t2, t1, t0],
  };
  return {
    kind: 'polygon',
    role,
    points: pointsByFace[face] || pointsByFace.right,
    fill,
    stroke,
    strokeWidth,
    meta,
  };
}

function faceRectAtAlong(projectPoint, bodyBox, axis, along, acrossStart, acrossLength, zStart, zHeight) {
  const resolvedAxis = normalizeAxis(axis);
  if (resolvedAxis === 'y') {
    const y = bodyBox.y + along - 0.004;
    const x0 = bodyBox.x + acrossStart;
    const x1 = x0 + acrossLength;
    const z0 = bodyBox.z + zStart;
    const z1 = z0 + zHeight;
    return [
      p(projectPoint, [x0, y, z0]),
      p(projectPoint, [x1, y, z0]),
      p(projectPoint, [x1, y, z1]),
      p(projectPoint, [x0, y, z1]),
    ];
  }
  const x = bodyBox.x + along - 0.004;
  const y0 = bodyBox.y + acrossStart;
  const y1 = y0 + acrossLength;
  const z0 = bodyBox.z + zStart;
  const z1 = z0 + zHeight;
  return [
    p(projectPoint, [x, y0, z0]),
    p(projectPoint, [x, y1, z0]),
    p(projectPoint, [x, y1, z1]),
    p(projectPoint, [x, y0, z1]),
  ];
}

function decoratorPolygon(projectPoint, block, {
  role,
  alongStart,
  alongLength,
  zStart,
  zHeight,
  fill,
  stroke = '#334155',
  strokeWidth = 0.45,
  meta = {},
}) {
  return {
    kind: 'polygon',
    role,
    points: sideFaceRect(projectPoint, block.bodyBox, block.axis, alongStart, alongLength, zStart, zHeight),
    fill,
    stroke,
    strokeWidth,
    meta: {
      ...meta,
      alongStart,
      alongEnd: alongStart + alongLength,
      zStart,
      zEnd: zStart + zHeight,
    },
  };
}

function alongFaceDecoratorPolygon(projectPoint, block, {
  role,
  along,
  acrossStart,
  acrossLength,
  zStart,
  zHeight,
  fill,
  stroke = '#334155',
  strokeWidth = 0.45,
  meta = {},
}) {
  return {
    kind: 'polygon',
    role,
    points: faceRectAtAlong(projectPoint, block.bodyBox, block.axis, along, acrossStart, acrossLength, zStart, zHeight),
    fill,
    stroke,
    strokeWidth,
    meta: {
      ...meta,
      along,
      acrossStart,
      acrossEnd: acrossStart + acrossLength,
      zStart,
      zEnd: zStart + zHeight,
    },
  };
}

function frontDecoratorPolygon(projectPoint, block, {
  role,
  acrossStart,
  acrossLength,
  zStart,
  zHeight,
  fill,
  stroke = '#334155',
  strokeWidth = 0.45,
  meta = {},
}) {
  return {
    kind: 'polygon',
    role,
    points: frontFaceRect(projectPoint, block.bodyBox, block.axis, acrossStart, acrossLength, zStart, zHeight),
    fill,
    stroke,
    strokeWidth,
    meta: {
      ...meta,
      acrossStart,
      acrossEnd: acrossStart + acrossLength,
      zStart,
      zEnd: zStart + zHeight,
    },
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rangesOverlap(a, b, margin = 0) {
  return a[0] < b[1] + margin && b[0] < a[1] + margin;
}

function normalizeRanges(ranges, span) {
  return ranges
    .map(([start, end]) => [clamp(start, 0, span), clamp(end, 0, span)])
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0]);
}

function allowedGaps(span, forbidden, margin = 0) {
  const ranges = normalizeRanges(forbidden.map(([start, end]) => [start - margin, end + margin]), span);
  const gaps = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start > cursor) gaps.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < span) gaps.push([cursor, span]);
  return gaps;
}

function findRangeNear(preferredStart, length, span, forbidden, margin = 0) {
  const requestedLength = Math.max(0.001, Math.min(length, span));
  const candidates = allowedGaps(span, forbidden, margin)
    .map(([start, end]) => {
      const gapLength = end - start;
      if (gapLength <= 0) return null;
      const resolvedLength = Math.min(requestedLength, gapLength);
      const candidateStart = clamp(preferredStart, start, end - resolvedLength);
      return {
        range: [candidateStart, candidateStart + resolvedLength],
        distance: Math.abs(candidateStart - preferredStart),
        length: resolvedLength,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance || b.length - a.length);
  return candidates[0]?.range ?? [clamp(preferredStart, 0, span - requestedLength), clamp(preferredStart, 0, span - requestedLength) + requestedLength];
}

function findRangeNearStrict(preferredStart, length, span, forbidden, margin = 0) {
  const requestedLength = Math.max(0.001, Math.min(length, span));
  const candidates = allowedGaps(span, forbidden, margin)
    .map(([start, end]) => {
      const gapLength = end - start;
      if (gapLength <= 0) return null;
      const resolvedLength = Math.min(requestedLength, gapLength);
      const candidateStart = clamp(preferredStart, start, end - resolvedLength);
      return {
        range: [candidateStart, candidateStart + resolvedLength],
        distance: Math.abs(candidateStart - preferredStart),
        length: resolvedLength,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance || b.length - a.length);
  return candidates[0]?.range || null;
}

function wheelKeepOutRanges(block) {
  const nearWheels = block.chassis.wheelCenters.filter((wheel) => wheel.side === 'near');
  return nearWheels.map((wheel) => {
    const along = block.axis === 'y'
      ? wheel.center[1] - block.bodyBox.y
      : wheel.center[0] - block.bodyBox.x;
    const radius = block.wheelRadius * 1.20;
    return [along - radius, along + radius];
  });
}

function subBodyBox(bodyBox, axis, {
  alongStart,
  alongLength,
  acrossStart = 0,
  acrossLength = null,
  zStart = 0,
  zHeight = null,
}) {
  const resolvedAxis = normalizeAxis(axis);
  const resolvedAcrossLength = acrossLength ?? (resolvedAxis === 'y' ? bodyBox.width : bodyBox.length);
  const resolvedZHeight = zHeight ?? Math.max(0.001, bodyBox.height - zStart);
  if (resolvedAxis === 'y') {
    return {
      x: bodyBox.x + acrossStart,
      y: bodyBox.y + alongStart,
      z: bodyBox.z + zStart,
      width: resolvedAcrossLength,
      length: alongLength,
      height: resolvedZHeight,
    };
  }
  return {
    x: bodyBox.x + alongStart,
    y: bodyBox.y + acrossStart,
    z: bodyBox.z + zStart,
    width: alongLength,
    length: resolvedAcrossLength,
    height: resolvedZHeight,
  };
}

function distributeWindowRanges(count, span, forbidden, gap, minWidth) {
  const gaps = allowedGaps(span, forbidden, gap);
  const totalGapSpan = gaps.reduce((sum, [start, end]) => sum + Math.max(0, end - start), 0);
  const windowWidth = Math.max(minWidth, (totalGapSpan - gap * Math.max(0, count - 1)) / Math.max(1, count));
  const ranges = [];
  for (const [start, end] of gaps) {
    let cursor = start;
    while (ranges.length < count && cursor + windowWidth <= end + 0.0001) {
      ranges.push([cursor, cursor + windowWidth]);
      cursor += windowWidth + gap;
    }
  }
  while (ranges.length < count) {
    const fallbackStart = clamp(span * 0.12 + ranges.length * (minWidth + gap), 0, Math.max(0, span - minWidth));
    ranges.push(findRangeNear(fallbackStart, minWidth, span, [...forbidden, ...ranges], gap));
  }
  return ranges.slice(0, count);
}

function verticalCylinderPrimitive(projectPoint, block, {
  role,
  along,
  across,
  radius,
  zStart,
  zHeight,
  fill = '#94a3b8',
  stroke = '#334155',
  strokeWidth = 0.55,
  highlight = false,
  cap = true,
  meta = {},
}) {
  const resolvedAxis = normalizeAxis(block.axis);
  const center = vehicleManjiPoint(
    [block.bodyBox.x, block.bodyBox.y],
    resolvedAxis,
    along,
    across,
    block.bodyBox.z + zStart,
  );
  const topCenter = vehicleManjiPoint(
    [block.bodyBox.x, block.bodyBox.y],
    resolvedAxis,
    along,
    across,
    block.bodyBox.z + zStart + zHeight,
  );
  const sideA = vehicleManjiPoint(
    [block.bodyBox.x, block.bodyBox.y],
    resolvedAxis,
    along,
    across - radius,
    block.bodyBox.z + zStart,
  );
  const sideB = vehicleManjiPoint(
    [block.bodyBox.x, block.bodyBox.y],
    resolvedAxis,
    along,
    across + radius,
    block.bodyBox.z + zStart,
  );
  const topA = vehicleManjiPoint(
    [block.bodyBox.x, block.bodyBox.y],
    resolvedAxis,
    along,
    across - radius,
    block.bodyBox.z + zStart + zHeight,
  );
  const topB = vehicleManjiPoint(
    [block.bodyBox.x, block.bodyBox.y],
    resolvedAxis,
    along,
    across + radius,
    block.bodyBox.z + zStart + zHeight,
  );
  const wall = {
    kind: 'polygon',
    role: `${role}:cylinder-wall`,
    points: [p(projectPoint, sideA), p(projectPoint, sideB), p(projectPoint, topB), p(projectPoint, topA)],
    fill,
    stroke,
    strokeWidth,
    meta: {
      ...meta,
      decoratorClass: meta.decoratorClass || 'truck-cylinder',
      cylinderPart: 'wall',
      along,
      across,
      radius,
      zStart,
      zEnd: zStart + zHeight,
    },
  };
  const shapes = [wall];
  if (cap) {
    const capLift = radius * 0.34;
    const topCenterRaised = vehicleManjiPoint(
      [block.bodyBox.x, block.bodyBox.y],
      resolvedAxis,
      along,
      across,
      block.bodyBox.z + zStart + zHeight + capLift,
    );
    shapes.push({
      kind: 'polygon',
      role: `${role}:cylinder-top-cap`,
      points: [p(projectPoint, topA), p(projectPoint, topCenterRaised), p(projectPoint, topB), p(projectPoint, topCenter)],
      fill: '#dbe4ee',
      stroke,
      strokeWidth: strokeWidth * 0.85,
      meta: {
        ...meta,
        decoratorClass: meta.decoratorClass || 'truck-cylinder',
        cylinderPart: 'top-cap',
        along,
        across,
        radius,
        zStart: zStart + zHeight,
        zEnd: zStart + zHeight + capLift,
      },
    });
  }
  if (highlight) {
    shapes.push(
    {
      kind: 'line',
      role: `${role}:cylinder-center-highlight`,
      from: p(projectPoint, center),
      to: p(projectPoint, topCenter),
      stroke: '#e2e8f0',
      strokeWidth: 0.75,
      strokeLinecap: 'round',
      meta: {
        ...meta,
        decoratorClass: meta.decoratorClass || 'truck-cylinder',
        cylinderPart: 'highlight',
        along,
        across,
        radius,
        zStart,
        zEnd: zStart + zHeight,
      },
    });
  }
  return shapes;
}

function skirtPartDescriptors({
  role,
  section,
  preferredRange,
  span,
  forbidden,
  margin,
  zStart,
  zHeight,
  fill,
  stroke,
}) {
  const [start, end] = preferredRange;
  const candidates = allowedGaps(span, forbidden, margin)
    .map(([gapStart, gapEnd], gapIndex) => {
      const partStart = Math.max(start, gapStart);
      const partEnd = Math.min(end, gapEnd);
      if (partEnd - partStart <= 0.001) return null;
      return {
        role: `${role}:skirt:${section}:${gapIndex}:${Math.round(partStart * 1000)}`,
        section,
        alongStart: partStart,
        alongEnd: partEnd,
        zStart,
        zEnd: zStart + zHeight,
        fill,
        stroke,
      };
    })
    .filter(Boolean);
  return candidates;
}

export function buildBusFacadeDecorators({
  project,
  block,
  role = 'bus-facade',
  windowCount = 5,
  doorPlacement = 'front',
  includeMirror = true,
  includeSideAd = true,
  skirtDepth = 0,
} = {}) {
  const projectPoint = requireProject(project);
  const alongSpan = block.axis === 'y' ? block.bodyBox.length : block.bodyBox.width;
  const frontSpan = block.axis === 'y' ? block.bodyBox.width : block.bodyBox.length;
  const bodyHeight = block.bodyBox.height;
  const lowerSkirtDepth = Math.max(0, skirtDepth);
  const hasSkirtAllocation = lowerSkirtDepth > 0;
  const shapes = [];
  const wheelForbidden = wheelKeepOutRanges(block);
  const doorWheelForbidden = wheelForbidden.map(([start, end]) => [start - alongSpan * 0.04, end + alongSpan * 0.04]);
  const facadeGap = alongSpan * 0.025;
  const doorWidth = alongSpan * 0.085;
  const doorRanges = [];
  if (doorPlacement === 'front' || doorPlacement === 'front-and-middle') {
    const frontDoor = findRangeNearStrict(alongSpan * 0.72, doorWidth, alongSpan, doorWheelForbidden, facadeGap);
    if (frontDoor) doorRanges.push(frontDoor);
  }
  if (doorPlacement === 'middle' || doorPlacement === 'front-and-middle') {
    const midDoor = findRangeNearStrict(
      alongSpan * 0.46,
      doorWidth,
      alongSpan,
      [...doorWheelForbidden, ...doorRanges],
      facadeGap,
    );
    if (midDoor) doorRanges.push(midDoor);
  }

  if (includeSideAd) {
    const adWidth = alongSpan * 0.36;
    const adRange = findRangeNear(alongSpan * 0.18, adWidth, alongSpan, [...wheelForbidden, ...doorRanges], facadeGap);
    shapes.push(decoratorPolygon(projectPoint, block, {
      role: `${role}:side-ad-panel`,
      alongStart: adRange[0],
      alongLength: adRange[1] - adRange[0],
      zStart: hasSkirtAllocation ? -lowerSkirtDepth * 0.30 : bodyHeight * 0.18,
      zHeight: hasSkirtAllocation ? bodyHeight * 0.24 + lowerSkirtDepth * 0.30 : bodyHeight * 0.18,
      fill: '#f5d0a6',
      stroke: '#8a5a2b',
      meta: { decoratorClass: 'side-ad', usesSkirtArea: hasSkirtAllocation },
    }));
  }

  const windowGap = alongSpan * 0.025;
  const windowRanges = distributeWindowRanges(
    windowCount,
    alongSpan,
    [...doorRanges, [alongSpan * 0.84, alongSpan]],
    windowGap,
    alongSpan * 0.055,
  );
  for (const [index, [alongStart, alongEnd]] of windowRanges.entries()) {
    shapes.push(decoratorPolygon(projectPoint, block, {
      role: `${role}:window-repeat:${index}`,
      alongStart,
      alongLength: alongEnd - alongStart,
      zStart: bodyHeight * 0.55,
      zHeight: bodyHeight * 0.25,
      fill: '#9bd0df',
      stroke: '#315969',
      meta: { decoratorClass: 'window', repeatIndex: index },
    }));
  }

  for (const [index, [alongStart, alongEnd]] of doorRanges.entries()) {
    shapes.push(decoratorPolygon(projectPoint, block, {
      role: `${role}:door:${index}`,
      alongStart,
      alongLength: alongEnd - alongStart,
      zStart: hasSkirtAllocation ? -lowerSkirtDepth * 0.96 : bodyHeight * 0.04,
      zHeight: hasSkirtAllocation ? bodyHeight * 0.64 + lowerSkirtDepth * 0.96 : bodyHeight * 0.54,
      fill: '#d8eef4',
      stroke: '#315969',
      meta: { decoratorClass: 'door', repeatIndex: index, usesSkirtArea: hasSkirtAllocation },
    }));
  }

  shapes.push(frontDecoratorPolygon(projectPoint, block, {
    role: `${role}:driver-window`,
    acrossStart: frontSpan * 0.05,
    acrossLength: frontSpan * 0.90,
    zStart: bodyHeight * 0.28,
    zHeight: bodyHeight * 0.57,
    fill: '#8fc7d8',
    stroke: '#315969',
    meta: { decoratorClass: 'driver-window' },
  }));

  shapes.push(frontDecoratorPolygon(projectPoint, block, {
    role: `${role}:route-number-sign`,
    acrossStart: frontSpan * 0.22,
    acrossLength: frontSpan * 0.56,
    zStart: bodyHeight * 0.78,
    zHeight: bodyHeight * 0.14,
    fill: '#f8fafc',
    stroke: '#334155',
    strokeWidth: 0.5,
    meta: { decoratorClass: 'route-number-sign' },
  }));

  const frontWrapRange = findRangeNearStrict(
    alongSpan * 0.86,
    alongSpan * 0.04,
    alongSpan,
    [...doorWheelForbidden, ...doorRanges],
    facadeGap * 0.5,
  );
  if (frontWrapRange) {
    shapes.push(decoratorPolygon(projectPoint, block, {
      role: `${role}:front-windshield-wrap`,
      alongStart: frontWrapRange[0],
      alongLength: frontWrapRange[1] - frontWrapRange[0],
      zStart: bodyHeight * 0.28,
      zHeight: bodyHeight * 0.57,
      fill: '#78b8cb',
      stroke: '#315969',
      meta: { decoratorClass: 'front-windshield-wrap' },
    }));
  }

  const frontSideWindowRange = findRangeNearStrict(
    alongSpan * 0.93,
    alongSpan * 0.06,
    alongSpan,
    [...doorWheelForbidden, ...doorRanges, ...(frontWrapRange ? [frontWrapRange] : [])],
    facadeGap * 0.5,
  );
  if (frontSideWindowRange) {
    shapes.push(decoratorPolygon(projectPoint, block, {
      role: `${role}:front-side-driver-window`,
      alongStart: frontSideWindowRange[0],
      alongLength: frontSideWindowRange[1] - frontSideWindowRange[0],
      zStart: bodyHeight * 0.31,
      zHeight: bodyHeight * 0.49,
      fill: '#6eabbe',
      stroke: '#315969',
      meta: { decoratorClass: 'front-side-driver-window' },
    }));
  }

  const grilleBaseZ = hasSkirtAllocation ? -lowerSkirtDepth * 0.72 : bodyHeight * 0.12;
  const grilleStepZ = hasSkirtAllocation ? Math.max(lowerSkirtDepth * 0.16, bodyHeight * 0.030) : bodyHeight * 0.045;
  for (let index = 0; index < 4; index += 1) {
    shapes.push(frontDecoratorPolygon(projectPoint, block, {
      role: `${role}:front-grille-bar:${index}`,
      acrossStart: frontSpan * 0.18,
      acrossLength: frontSpan * 0.64,
      zStart: grilleBaseZ + index * grilleStepZ,
      zHeight: bodyHeight * 0.018,
      fill: '#334155',
      stroke: '#1f2937',
      strokeWidth: 0.32,
      meta: { decoratorClass: 'front-grille', repeatIndex: index, skirtSection: hasSkirtAllocation },
    }));
  }

  for (const [index, acrossStart] of [frontSpan * 0.10, frontSpan * 0.78].entries()) {
    shapes.push(frontDecoratorPolygon(projectPoint, block, {
      role: `${role}:headlight:${index}`,
      acrossStart,
      acrossLength: frontSpan * 0.14,
      zStart: hasSkirtAllocation ? -lowerSkirtDepth * 0.62 : bodyHeight * 0.08,
      zHeight: bodyHeight * 0.11,
      fill: '#fde68a',
      stroke: '#92400e',
      strokeWidth: 0.62,
      meta: { decoratorClass: 'headlight', repeatIndex: index, skirtSection: hasSkirtAllocation },
    }));
  }

  if (includeMirror) {
    shapes.push(decoratorPolygon(projectPoint, block, {
      role: `${role}:rear-view-mirror`,
      alongStart: alongSpan * 0.982,
      alongLength: alongSpan * 0.018,
      zStart: bodyHeight * 0.82,
      zHeight: bodyHeight * 0.08,
      fill: '#111827',
      stroke: '#020617',
      meta: { decoratorClass: 'rear-view-mirror' },
    }));
  }

  shapes.push(decoratorPolygon(projectPoint, block, {
    role: `${role}:roof-battery-box`,
    alongStart: alongSpan * 0.32,
    alongLength: alongSpan * 0.34,
    zStart: bodyHeight * 1.01,
    zHeight: bodyHeight * 0.11,
    fill: '#475569',
    stroke: '#334155',
    meta: { decoratorClass: 'roof-battery-box' },
  }));

  return {
    kind: 'busFacadeDecorators',
    role,
    axis: block.axis,
    windowCount,
    doorPlacement,
    skirtDepth: lowerSkirtDepth,
    wheelKeepOutRanges: wheelForbidden,
    shapes,
  };
}

export function buildLongHaulTruckOnWheels({
  project,
  origin,
  axis = 'x',
  length = 10.8,
  width = 1.55,
  wheelRadius = 0.28,
  wheelZ = 0.1,
  stickerCount = 4,
  bodyLength = length + 0.9,
  bodyWidth = width + 0.5,
  bodyHeight = 1.55,
  bodyAlongInset = -0.46,
  bodyAcrossInset = -0.25,
  bodyBottomClearance = 0.03,
  role = 'long-haul-truck-on-wheels',
  trailerProfile = 'box-trailer',
  cargoHybrid = 'train-cart-compatible',
  axleFractions = [0.12, 0.42, 0.70, 0.90],
} = {}) {
  const projectPoint = requireProject(project);
  const base = buildRectangularVehicleOnWheels({
    project: projectPoint,
    origin,
    axis,
    length,
    width,
    wheelRadius,
    wheelZ,
    stickerCount,
    bodyLength,
    bodyWidth,
    bodyHeight,
    bodyAlongInset,
    bodyAcrossInset,
    bodyBottomClearance,
    role,
    vehicleClass: 'long-haul-truck',
    payloadKind: 'cab-and-trailer',
    facadePolicy: 'cab-trailer-slots',
    axleFractions,
  });

  const alongSpan = base.slots.alongSpan;
  const frontInset = alongSpan * 0.03;
  const cabLength = clamp(alongSpan * 0.16, alongSpan * 0.13, alongSpan * 0.20);
  const couplingGap = clamp(alongSpan * 0.06, alongSpan * 0.04, alongSpan * 0.10);
  const cabStart = frontInset;
  const cabEnd = cabStart + cabLength;
  const trailerStart = cabEnd + couplingGap;
  const trailerEnd = alongSpan - frontInset;
  const trailerLength = Math.max(alongSpan * 0.30, trailerEnd - trailerStart);

  const cabBox = subBodyBox(base.bodyBox, base.axis, {
    alongStart: cabStart,
    alongLength: cabLength,
    zHeight: base.bodyBox.height * 0.82,
  });
  const trailerBox = subBodyBox(base.bodyBox, base.axis, {
    alongStart: trailerStart,
    alongLength: trailerLength,
    zStart: base.bodyBox.height * 0.05,
    zHeight: base.bodyBox.height * 0.95,
  });
  const cargoDeckBox = subBodyBox(base.bodyBox, base.axis, {
    alongStart: trailerStart + trailerLength * 0.04,
    alongLength: trailerLength * 0.92,
    zStart: base.bodyBox.height * 0.10,
    zHeight: base.bodyBox.height * 0.78,
  });

  const block = { axis: base.axis, bodyBox: base.bodyBox, wheelRadius: base.wheelRadius, wheelZ: base.wheelZ, chassis: base.chassis };
  const wheelForbidden = wheelKeepOutRanges(block);
  const facadeGap = alongSpan * 0.02;
  const skirtDepth = Math.max(0.16, base.bodyBox.z - (base.wheelZ + base.wheelRadius * 0.18));
  const skirtZStart = -skirtDepth;
  const skirtZHeight = skirtDepth + base.bodyBox.height * 0.30;
  const skirtParts = skirtPartDescriptors({
    role,
    section: 'cab-face-skirt',
    preferredRange: [cabStart, cabEnd],
    span: alongSpan,
    forbidden: wheelForbidden,
    margin: 0,
    zStart: skirtZStart,
    zHeight: skirtZHeight,
    fill: '#b7c8d5',
    stroke: '#315969',
  });
  const doorRange = findRangeNearStrict(
    cabStart + cabLength * 0.42,
    cabLength * 0.42,
    alongSpan,
    wheelForbidden,
    facadeGap * 0.35,
  ) ?? [
    cabStart + cabLength * 0.40,
    cabStart + cabLength * 0.82,
  ];
  const windowRange = [
    cabStart + cabLength * 0.08,
    cabStart + cabLength * 0.56,
  ];
  const frontSpan = base.slots.acrossSpan;
  const faceAlong = cabStart;
  const faceParts = [
    {
      id: `${role}:square-face:windshield:left`,
      part: 'windshield',
      acrossStart: frontSpan * 0.10,
      acrossEnd: frontSpan * 0.47,
      zStart: base.bodyBox.height * 0.50,
      zEnd: base.bodyBox.height * 0.80,
    },
    {
      id: `${role}:square-face:windshield:right`,
      part: 'windshield',
      acrossStart: frontSpan * 0.53,
      acrossEnd: frontSpan * 0.90,
      zStart: base.bodyBox.height * 0.50,
      zEnd: base.bodyBox.height * 0.80,
    },
    {
      id: `${role}:square-face:grille`,
      part: 'grille',
      acrossStart: frontSpan * 0.26,
      acrossEnd: frontSpan * 0.74,
      zStart: base.bodyBox.height * 0.16,
      zEnd: base.bodyBox.height * 0.42,
    },
    {
      id: `${role}:square-face:bumper`,
      part: 'bumper',
      acrossStart: frontSpan * 0.06,
      acrossEnd: frontSpan * 0.94,
      zStart: -skirtDepth * 0.54,
      zEnd: base.bodyBox.height * 0.10,
    },
  ];

  const shapes = [];
  const hullShapes = [
    alongFaceDecoratorPolygon(projectPoint, block, {
      role: `${role}:hull:square-cab-face`,
      along: faceAlong,
      acrossStart: 0,
      acrossLength: frontSpan,
      zStart: 0,
      zHeight: cabBox.height,
      fill: '#c7e0e8',
      stroke: '#315969',
      strokeWidth: 1.0,
      meta: {
        decoratorClass: 'truck-hull',
        hullPart: 'square-cab-face',
        seatClass: 'two-seat-cab',
        faceStyle: 'square-cabover',
      },
    }),
    decoratorPolygon(projectPoint, block, {
      role: `${role}:hull:square-cab-side-cheek`,
      alongStart: cabStart,
      alongLength: cabLength * 0.34,
      zStart: 0,
      zHeight: cabBox.height,
      fill: '#b9d6df',
      stroke: '#315969',
      strokeWidth: 0.85,
      meta: {
        decoratorClass: 'truck-hull',
        hullPart: 'square-cab-side-cheek',
        seatClass: 'two-seat-cab',
        faceStyle: 'square-cabover',
      },
    }),
    decoratorPolygon(projectPoint, block, {
      role: `${role}:hull:cab-door-side-panel`,
      alongStart: doorRange[0],
      alongLength: doorRange[1] - doorRange[0],
      zStart: 0,
      zHeight: cabBox.height * 0.94,
      fill: '#cde4eb',
      stroke: '#315969',
      strokeWidth: 0.85,
      meta: {
        decoratorClass: 'truck-hull',
        hullPart: 'cab-door-side-panel',
        seatClass: 'two-seat-cab',
        faceStyle: 'square-cabover',
      },
    }),
    decoratorPolygon(projectPoint, block, {
      role: `${role}:hull:cab-rear-side-frame`,
      alongStart: cabEnd - cabLength * 0.12,
      alongLength: cabLength * 0.12,
      zStart: 0,
      zHeight: cabBox.height,
      fill: '#9db9c5',
      stroke: '#315969',
      strokeWidth: 0.9,
      meta: {
        decoratorClass: 'truck-hull',
        hullPart: 'cab-rear-side-frame',
        seatClass: 'two-seat-cab',
        faceStyle: 'square-cabover',
      },
    }),
    boxFacePolygon(projectPoint, trailerBox, 'front', `${role}:hull:trailer-front`, {
      fill: '#e2e8f0',
      stroke: '#475569',
      strokeWidth: 0.9,
      meta: { decoratorClass: 'truck-hull', hullPart: 'trailer-front' },
    }),
    boxFacePolygon(projectPoint, trailerBox, 'right', `${role}:hull:trailer-side`, {
      fill: '#d0d9e4',
      stroke: '#475569',
      strokeWidth: 0.9,
      meta: { decoratorClass: 'truck-hull', hullPart: 'trailer-side' },
    }),
    boxFacePolygon(projectPoint, trailerBox, 'top', `${role}:hull:trailer-top`, {
      fill: '#eef3f8',
      stroke: '#94a3b8',
      strokeWidth: 0.65,
      meta: { decoratorClass: 'truck-hull', hullPart: 'trailer-top' },
    }),
    boxFacePolygon(projectPoint, cabBox, 'top', `${role}:hull:cab-top`, {
      fill: '#e4f1f5',
      stroke: '#5b8796',
      strokeWidth: 0.65,
      meta: { decoratorClass: 'truck-hull', hullPart: 'cab-top', seatClass: 'two-seat-cab' },
    }),
  ];
  shapes.push(...hullShapes);
  for (const [index, part] of faceParts.entries()) {
    const fill = part.part === 'windshield'
      ? '#8fc7d8'
      : part.part === 'grille'
        ? '#334155'
        : '#64748b';
    const stroke = part.part === 'windshield'
      ? '#315969'
      : '#0f172a';
    shapes.push(alongFaceDecoratorPolygon(projectPoint, block, {
      role: part.id,
      along: faceAlong,
      acrossStart: part.acrossStart,
      acrossLength: part.acrossEnd - part.acrossStart,
      zStart: part.zStart,
      zHeight: part.zEnd - part.zStart,
      fill,
      stroke,
      strokeWidth: part.part === 'bumper' ? 0.75 : 0.55,
      meta: {
        decoratorClass: `truck-face-${part.part}`,
        faceStyle: 'square-cabover',
        facePart: part.part,
        faceIndex: index,
      },
    }));
  }
  for (let index = 0; index < 4; index += 1) {
    shapes.push(alongFaceDecoratorPolygon(projectPoint, block, {
      role: `${role}:square-face:grille-slat:${index}`,
      along: faceAlong,
      acrossStart: frontSpan * 0.30,
      acrossLength: frontSpan * 0.40,
      zStart: base.bodyBox.height * (0.20 + index * 0.048),
      zHeight: base.bodyBox.height * 0.018,
      fill: '#cbd5e1',
      stroke: '#94a3b8',
      strokeWidth: 0.3,
      meta: {
        decoratorClass: 'truck-face-grille-slat',
        faceStyle: 'square-cabover',
        facePart: 'grille-slat',
        repeatIndex: index,
      },
    }));
  }
  for (const [index, acrossStart] of [frontSpan * 0.10, frontSpan * 0.78].entries()) {
    shapes.push(alongFaceDecoratorPolygon(projectPoint, block, {
      role: `${role}:square-face:headlight:${index}`,
      along: faceAlong,
      acrossStart,
      acrossLength: frontSpan * 0.12,
      zStart: base.bodyBox.height * 0.16,
      zHeight: base.bodyBox.height * 0.09,
      fill: '#fde68a',
      stroke: '#92400e',
      strokeWidth: 0.45,
      meta: {
        decoratorClass: 'truck-face-headlight',
        faceStyle: 'square-cabover',
        facePart: 'headlight',
        repeatIndex: index,
      },
    }));
  }
  const exhaustRadius = frontSpan * 0.055;
  const exhaustPlacements = [
    { side: 'horizon', across: exhaustRadius, along: cabEnd + couplingGap * 0.72 },
    { side: 'screen', across: frontSpan - exhaustRadius, along: cabEnd + couplingGap * 0.24 },
  ];
  for (const [index, placement] of exhaustPlacements.entries()) {
    shapes.push(...verticalCylinderPrimitive(projectPoint, block, {
      role: `${role}:vertical-exhaust:${index}`,
      along: placement.along,
      across: placement.across,
      radius: exhaustRadius,
      zStart: base.bodyBox.height * 0.10,
      zHeight: base.bodyBox.height * 1.16,
      fill: '#7f94a3',
      stroke: '#263747',
      strokeWidth: 0.9,
      meta: {
        decoratorClass: 'truck-exhaust-cylinder',
        faceStyle: 'square-cabover',
        cylinderUse: 'vertical-exhaust-stack',
        side: placement.side,
        behindCab: placement.along > cabEnd,
      },
    }));
  }
  for (const [index, part] of skirtParts.entries()) {
    shapes.push(decoratorPolygon(projectPoint, block, {
      role: part.role,
      alongStart: part.alongStart,
      alongLength: part.alongEnd - part.alongStart,
      zStart: part.zStart,
      zHeight: part.zEnd - part.zStart,
      fill: part.fill,
      stroke: part.stroke,
      strokeWidth: 0.5,
      meta: {
        decoratorClass: 'truck-skirt',
        skirtSection: part.section,
        skirtIndex: index,
        unifiedBand: true,
        frameIntegrated: true,
      },
    }));
  }
  shapes.push(decoratorPolygon(projectPoint, block, {
    role: `${role}:cab-window`,
    alongStart: windowRange[0],
    alongLength: windowRange[1] - windowRange[0],
    zStart: base.bodyBox.height * 0.44,
    zHeight: base.bodyBox.height * 0.28,
    fill: '#9cc9d6',
    stroke: '#315969',
    meta: { decoratorClass: 'truck-cab-window' },
  }));
  shapes.push(decoratorPolygon(projectPoint, block, {
    role: `${role}:cab-door`,
    alongStart: doorRange[0],
    alongLength: doorRange[1] - doorRange[0],
    zStart: base.bodyBox.height * 0.08,
    zHeight: base.bodyBox.height * 0.68,
    fill: '#e6f2f6',
    stroke: '#315969',
    strokeWidth: 0.75,
    meta: {
      decoratorClass: 'truck-cab-door',
      seatClass: 'two-seat-cab',
      handleBand: [doorRange[0] + cabLength * 0.34, doorRange[0] + cabLength * 0.42],
    },
  }));
  shapes.push(decoratorPolygon(projectPoint, block, {
    role: `${role}:cab-door-handle`,
    alongStart: doorRange[0] + cabLength * 0.34,
    alongLength: cabLength * 0.10,
    zStart: base.bodyBox.height * 0.38,
    zHeight: base.bodyBox.height * 0.035,
    fill: '#0f172a',
    stroke: '#020617',
    strokeWidth: 0.25,
    meta: { decoratorClass: 'truck-cab-door-handle', seatClass: 'two-seat-cab' },
  }));
  shapes.push(decoratorPolygon(projectPoint, block, {
    role: `${role}:trailer-panel`,
    alongStart: trailerStart,
    alongLength: trailerLength,
    zStart: base.bodyBox.height * 0.20,
    zHeight: base.bodyBox.height * 0.68,
    fill: '#e2e8f0',
    stroke: '#64748b',
    meta: { decoratorClass: 'truck-trailer-panel', trailerProfile },
  }));
  shapes.push(decoratorPolygon(projectPoint, block, {
    role: `${role}:fifth-wheel-gap`,
    alongStart: cabEnd,
    alongLength: couplingGap,
    zStart: base.bodyBox.height * 0.06,
    zHeight: base.bodyBox.height * 0.12,
    fill: '#1f2937',
    stroke: '#0f172a',
    meta: { decoratorClass: 'truck-coupler-gap' },
  }));

  const ribCount = 4;
  for (let i = 0; i < ribCount; i += 1) {
    const start = trailerStart + trailerLength * (0.12 + i * 0.20);
    shapes.push(decoratorPolygon(projectPoint, block, {
      role: `${role}:cargo-rib:${i}`,
      alongStart: start,
      alongLength: trailerLength * 0.03,
      zStart: base.bodyBox.height * 0.24,
      zHeight: base.bodyBox.height * 0.60,
      fill: '#cbd5e1',
      stroke: '#94a3b8',
      strokeWidth: 0.35,
      meta: { decoratorClass: 'truck-cargo-rib', ribIndex: i },
    }));
  }

  const cartSlotCount = 3;
  const cartSlots = Array.from({ length: cartSlotCount }, (_, index) => {
    const slotStart = trailerStart + trailerLength * (0.06 + index * 0.30);
    const slotLength = trailerLength * 0.24;
    return {
      id: `${role}:cargo-cart-slot:${index}`,
      alongStart: slotStart,
      alongEnd: slotStart + slotLength,
      acrossStart: base.slots.acrossSpan * 0.10,
      acrossEnd: base.slots.acrossSpan * 0.90,
      zStart: base.bodyBox.height * 0.14,
      zEnd: base.bodyBox.height * 0.86,
      compatibility: ['train-cart', 'rail-freight-cart', 'container-cart'],
    };
  });

  return {
    kind: 'longHaulTruckOnWheels',
    role,
    axis: base.axis,
    vehicleClass: 'long-haul-truck',
    payloadKind: 'cab-and-trailer',
    trailerProfile,
    cargoHybrid,
    chassis: base.chassis,
    bodyBox: base.bodyBox,
    bodyFootprint: base.bodyFootprint,
    hullShapes,
    slots: {
      ...base.slots,
      cabAlongBand: [cabStart, cabEnd],
      trailerAlongBand: [trailerStart, trailerStart + trailerLength],
      couplingBand: [cabEnd, trailerStart],
      squareFaceParts: faceParts,
      skirtParts: skirtParts.map((part, index) => ({
        id: part.role,
        index,
        section: part.section,
        alongStart: part.alongStart,
        alongEnd: part.alongEnd,
        zStart: part.zStart,
        zEnd: part.zEnd,
      })),
      cargoCartSlots: cartSlots,
    },
    cabBox,
    trailerBox,
    cargoDeckBox,
    paintGroups: {
      ...base.paintGroups,
      hullShapes,
    },
    wheelKeepOutRanges: base.slots.wheelKeepOutRanges,
    shapes,
  };
}
