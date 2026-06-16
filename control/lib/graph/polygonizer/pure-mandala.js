export const MERU_UNIT_SCALE_DEFAULT_WORLD_SPAN = 36;
export const MERU_BOUNDARY_POLICY_DEFAULT = 'allow';
const MERU_BOUNDARY_POLICIES = new Set(['allow', 'attribute', 'reject']);

export function findMandalaBlock(manifestOrMandala, role) {
  const mandala = manifestOrMandala?.polygonizer?.pureMandala || manifestOrMandala;
  if (!mandala || !Array.isArray(mandala.blocks) || !role) return null;
  return mandala.blocks.find((block) => block?.role === role) || null;
}

/**
 * Resolve the meru-owned, scene-wide pixels-per-world-unit. Every element
 * mandala reads from this so a "size N" mark renders at the same pixel
 * size regardless of which element mandala it lives in, and an overflow
 * past an element's bounds is a definite, world-unit quantity instead of
 * an ambiguity across two incompatible local frames.
 *
 * Priority:
 *   1. `polygonizer.metamandala.unitScale` (or `meru.unitScale`) when
 *      explicitly declared.
 *   2. `viewBox.width / metamandala.sceneExtent.width` when both are
 *      declared (the scene-extent path).
 *   3. `viewBox.width / MERU_UNIT_SCALE_DEFAULT_WORLD_SPAN` — the
 *      back-compat default. The 36-unit span matches the existing
 *      `roomBasis.xRange = [-18, 18]` used by `projectTwoPoint`, so the
 *      room camera and element mandalas agree on what "one world unit"
 *      means without a separate calibration step.
 */
export function resolveMeruUnitScale(manifest) {
  const viewBox = manifest?.viewBox || {};
  const viewBoxWidth = Math.max(finiteOr(viewBox.width, 800), 1);
  const polygonizer = manifest?.polygonizer || {};
  const meru = polygonizer.metamandala || polygonizer.meru || {};
  const declared = finiteOr(meru.unitScale, NaN);
  if (Number.isFinite(declared) && declared > 0) return declared;
  const extentWidth = finiteOr(meru.sceneExtent?.width, NaN);
  if (Number.isFinite(extentWidth) && extentWidth > 0) {
    return viewBoxWidth / extentWidth;
  }
  return viewBoxWidth / MERU_UNIT_SCALE_DEFAULT_WORLD_SPAN;
}

export function resolveMeruBoundaryPolicy(manifest) {
  const polygonizer = manifest?.polygonizer || {};
  const meru = polygonizer.metamandala || polygonizer.meru || {};
  const declared = typeof meru.boundaryPolicy === 'string' ? meru.boundaryPolicy : '';
  return MERU_BOUNDARY_POLICIES.has(declared) ? declared : MERU_BOUNDARY_POLICY_DEFAULT;
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
  const meruUnitScale = resolveMeruUnitScale(manifest);
  const nodeByRole = new Map(nodes.map((node) => [node?.role, node]).filter(([role]) => role));
  const generatedElements = [];
  const cameraOverrides = [];
  elements.forEach((element, index) => {
    const role = String(element?.role || `element-${index + 1}`);
    const node = nodeByRole.get(role);
    if (!node || !validBounds(node.bounds)) return;
    const built = generatedElementMandala({
      element, index, role, node, width, height, meruUnitScale,
    });
    generatedElements.push(built.space);
    if (built.cameraOverrideIgnored) {
      cameraOverrides.push({ role, declared: built.declaredCameraUnitScale });
    }
  });
  return {
    kind: 'generated-element-mandala',
    generated: true,
    source: 'constellation-node-local-top-down',
    principle:
      'each generated element owns a local top-down math space bound to its overall constellation bounds; ' +
      'every element shares the meru-owned unitScale so overflows across mandala boundaries are measurable in world units',
    unitScale: round(meruUnitScale),
    unitScaleSource: 'meru',
    inventoryAtoms: generatedElements.map((element) => ({
      role: element.role,
      index: element.index,
      boundTo: element.boundTo,
      verticalMap: element.verticalMap,
    })),
    elements: generatedElements,
    ...(cameraOverrides.length ? { ignoredCameraUnitScales: cameraOverrides } : {}),
  };
}

function generatedElementMandala({ element, index, role, node, width, height, meruUnitScale }) {
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
  const cameraScreenOrigin = validPoint(cameraOverride.screenOrigin) || validPoint(mandala.screenOrigin) || screenOrigin;
  const cameraEast = validPoint(cameraOverride.east) || validPoint(mandala.east) || [1, 0];
  const cameraNorth = validPoint(cameraOverride.north) || validPoint(mandala.north) || [0, 1];
  const cameraZenith = validPoint(cameraOverride.zenith) || validPoint(mandala.zenith) || [0, -1];
  const declaredCameraUnitScale = finiteOr(cameraOverride.unitScale ?? mandala.unitScale, NaN);
  const cameraOverrideIgnored = Number.isFinite(declaredCameraUnitScale) && declaredCameraUnitScale > 0;
  const worldBudget = {
    width: round(bounds.width / meruUnitScale),
    length: round(bounds.height / meruUnitScale),
  };
  const claim = { width: round(localWidth), length: round(localLength) };
  const overflow = {
    widthUnits: round(Math.max(claim.width - worldBudget.width, 0)),
    lengthUnits: round(Math.max(claim.length - worldBudget.length, 0)),
  };
  return {
    cameraOverrideIgnored,
    declaredCameraUnitScale: cameraOverrideIgnored ? round(declaredCameraUnitScale) : null,
    space: {
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
      worldBudget,
      claim,
      claimOverflow: overflow.widthUnits > 0 || overflow.lengthUnits > 0
        ? { ...overflow, axis: overflow.widthUnits >= overflow.lengthUnits ? 'width' : 'length' }
        : null,
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
          // Unrounded — downstream cuboid corner / guide-line math compounds
          // unitScale across sizeXYZ × perspectiveScale and is sensitive to
          // sub-milli precision (one polygonizer test pins corners onto a
          // guide line at tolerance 0.005). The elementMandala summary
          // unitScale (which IS rounded) is the human-readable view.
          unitScale: meruUnitScale,
          unitScaleSource: 'meru',
          depthScale: clamp(finiteOr(cameraOverride.depthScale, mandala.depthScale ?? 1), 0.2, 1),
        },
      },
      projection: {
        overallSpace: 'constellation',
        localToOverall: 'shared-meru-unit-scale',
        nodeRole: node.role,
      },
    },
  };
}

/**
 * Validate the meru-owned scene-wide unitScale + sceneExtent declarations.
 * Returns an array of error strings (empty when valid). The validator is
 * lenient on absence — the resolver supplies a viewBox-derived default —
 * but strict on inconsistency.
 */
export function validateMetamandalaUnitScale(manifest) {
  const errors = [];
  const polygonizer = manifest?.polygonizer || {};
  const meru = polygonizer.metamandala || polygonizer.meru;
  if (!meru || typeof meru !== 'object' || Array.isArray(meru)) return errors;
  if (meru.unitScale !== undefined && meru.unitScale !== null) {
    if (!Number.isFinite(Number(meru.unitScale)) || Number(meru.unitScale) <= 0) {
      errors.push('polygonizer.metamandala.unitScale must be a positive number (pixels per world unit)');
    }
  }
  if (meru.sceneExtent !== undefined && meru.sceneExtent !== null) {
    if (typeof meru.sceneExtent !== 'object' || Array.isArray(meru.sceneExtent)) {
      errors.push('polygonizer.metamandala.sceneExtent must be an object');
    } else {
      const extentWidth = finiteOr(meru.sceneExtent.width, NaN);
      if (!Number.isFinite(extentWidth) || extentWidth <= 0) {
        errors.push('polygonizer.metamandala.sceneExtent.width must be a positive number');
      }
      const declaredUnit = finiteOr(meru.unitScale, NaN);
      const viewBoxWidth = finiteOr(manifest?.viewBox?.width, NaN);
      if (
        Number.isFinite(declaredUnit) && Number.isFinite(extentWidth) && Number.isFinite(viewBoxWidth)
      ) {
        const expected = viewBoxWidth / extentWidth;
        if (Math.abs(expected - declaredUnit) / Math.max(expected, 1e-6) > 0.02) {
          errors.push(
            'polygonizer.metamandala.unitScale must equal viewBox.width / sceneExtent.width when both are declared',
          );
        }
      }
    }
  }
  if (meru.boundaryPolicy !== undefined && meru.boundaryPolicy !== null) {
    if (!MERU_BOUNDARY_POLICIES.has(meru.boundaryPolicy)) {
      errors.push(
        `polygonizer.metamandala.boundaryPolicy must be one of: ${Array.from(MERU_BOUNDARY_POLICIES).join(', ')}`,
      );
    }
  }
  return errors;
}

/**
 * Scan every mark bound to an element mandala (via mandalaRole /
 * elementMandalaRole / elementRole) and detect overflow past that
 * element's world-unit budget. Returns one record per overflowing mark:
 *
 *   { role, elementRole, axis: 'x' | 'y' | 'z',
 *     overflowUnits, intoBudget: { width, length } }
 *
 * The records carry world-unit deltas, not pixels. They are intended for
 * the validator and for downstream meru consumers (gravity, relaxation)
 * that need to attribute cross-element contact regions.
 */
export function collectElementMandalaOverflows(manifest) {
  const overflows = [];
  const elementMandala = manifest?.polygonizer?.elementMandala;
  const spaces = Array.isArray(elementMandala?.elements) ? elementMandala.elements : [];
  if (!spaces.length) return overflows;
  const spaceByRole = new Map(spaces.map((space) => [space?.role, space]).filter(([role]) => role));
  for (const space of spaces) {
    if (space?.claimOverflow) {
      const axis = space.claimOverflow.axis === 'length' ? 'y' : 'x';
      const overflowUnits = axis === 'y' ? space.claimOverflow.lengthUnits : space.claimOverflow.widthUnits;
      overflows.push({
        role: space.role,
        elementRole: space.role,
        kind: 'declared-mandala-claim',
        axis,
        overflowUnits,
        intoBudget: { ...space.worldBudget },
      });
    }
  }
  const marks = Array.isArray(manifest?.marks) ? manifest.marks : [];
  for (const mark of marks) {
    const role = mark?.mandalaRole || mark?.elementMandalaRole || mark?.elementRole;
    if (!role) continue;
    const space = spaceByRole.get(role);
    if (!space?.worldBudget) continue;
    const xyz = validXYZ(mark.xyz || mark.worldXYZ || mark.localXYZ);
    const sizeXYZ = validXYZ(mark.sizeXYZ || mark.unitsXYZ || mark.unitSize || mark.sizeU);
    if (!xyz || !sizeXYZ) continue;
    const budget = space.worldBudget;
    const halfWidth = budget.width / 2;
    const halfLength = budget.length / 2;
    const xMax = Math.abs(xyz[0]) + Math.abs(sizeXYZ[0]) / 2;
    const yMax = Math.abs(xyz[1]) + Math.abs(sizeXYZ[1]) / 2;
    if (xMax > halfWidth) {
      overflows.push({
        role: mark?.role || space.role,
        elementRole: space.role,
        kind: 'mark-overflow',
        axis: 'x',
        overflowUnits: round(xMax - halfWidth),
        intoBudget: { ...budget },
      });
    }
    if (yMax > halfLength) {
      overflows.push({
        role: mark?.role || space.role,
        elementRole: space.role,
        kind: 'mark-overflow',
        axis: 'y',
        overflowUnits: round(yMax - halfLength),
        intoBudget: { ...budget },
      });
    }
  }
  return overflows;
}

/**
 * Validate marks + declared element mandala claims against per-element
 * world-unit budgets. Behavior is gated by
 * `polygonizer.metamandala.boundaryPolicy`:
 *
 *   - 'allow' (default): no errors; overflows are still attached to the
 *     manifest by `withGeneratedElementMandala` for downstream consumers.
 *   - 'attribute': no errors; overflow records are surfaced for meru.
 *   - 'reject': overflows become mint-time errors.
 *
 * Returns { errors, overflows } so callers can decide whether to log,
 * attach, or fail.
 */
export function validateElementMandalaOverflows(manifest) {
  const overflows = collectElementMandalaOverflows(manifest);
  const policy = resolveMeruBoundaryPolicy(manifest);
  const errors = [];
  if (policy === 'reject') {
    for (const overflow of overflows) {
      errors.push(
        `polygonizer.metamandala overflow: ${overflow.kind} on element '${overflow.elementRole}' ` +
        `exceeds budget by ${overflow.overflowUnits} world units on axis '${overflow.axis}'`,
      );
    }
  }
  return { errors, overflows, policy };
}

function validXYZ(value) {
  if (!Array.isArray(value) || value.length < 3) return null;
  const x = Number(value[0]);
  const y = Number(value[1]);
  const z = Number(value[2]);
  if (![x, y, z].every((v) => Number.isFinite(v))) return null;
  return [x, y, z];
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

/**
 * Resolve `roomBasis.worldExtent: { width, depth, height }` into the
 * pixel-denominated xRange / yRange / verticalUnit that `projectTwoPoint`
 * consumes. The world declaration wins; legacy pixel fields that aren't
 * overridden pass through.
 *
 * Conventions:
 *   - x axis runs left → right (room width).
 *   - y axis runs back → front (camera-relative depth); frontY = depth, backY = 0.
 *   - z axis runs floor → ceiling (height); verticalUnit = meruUnitScale.
 *
 * Anything the author explicitly declares on roomBasis (legacy pixel
 * fields like frontLeft, depthReach, vanishing-point hints) wins over the
 * world-derived defaults — this lets a decorator declare "16 × 12 × 8 ft
 * room" and still tune the front-corner pixel positions for composition.
 */
export function resolveRoomBasisWorld(manifest, roomBasis = {}) {
  if (!roomBasis || typeof roomBasis !== 'object' || Array.isArray(roomBasis)) {
    return roomBasis;
  }
  const polygonizer = manifest?.polygonizer || {};
  const meru = polygonizer.metamandala || polygonizer.meru || {};
  const worldExtent = roomBasis.worldExtent || meru.roomExtent;
  if (!worldExtent || typeof worldExtent !== 'object' || Array.isArray(worldExtent)) {
    return roomBasis;
  }
  const width = Number(worldExtent.width);
  const depth = Number(worldExtent.depth ?? worldExtent.length);
  const height = Number(worldExtent.height);
  if (!Number.isFinite(width) || width <= 0) return roomBasis;
  if (!Number.isFinite(depth) || depth <= 0) return roomBasis;
  const unitScale = resolveMeruUnitScale(manifest);
  const derived = {
    xRange: [0, width],
    yRange: [0, depth],
    frontY: depth,
    backY: 0,
    verticalUnit: unitScale,
    worldExtent: {
      width,
      depth,
      ...(Number.isFinite(height) && height > 0 ? { height } : {}),
    },
    worldExtentSource: 'meru',
  };
  // Legacy/explicit pixel fields take precedence over the world-derived
  // defaults: the resolver provides defaults, not overrides.
  return { ...derived, ...roomBasis, worldExtent: derived.worldExtent };
}

/**
 * Resolve `cameraPrimitive.worldFraming: { cameraPosition, lookAt, horizontalFov? }`
 * into screen-space `vanishingPoints` + `horizonY`. The camera position
 * and lookAt target are in meru world units; the resolver projects the
 * world x-axis and y-axis through a simple pinhole camera and returns
 * the picture-plane intersections as the two-point vanishing points.
 *
 * The result preserves any explicitly declared `vanishingPoints` /
 * `horizonY` — explicit pixel authoring wins. The intent is to let a
 * decorator say "camera at the front-right corner looking diagonally"
 * in feet and get a sensible perspective without computing VP pixels.
 */
export function resolveCameraPrimitiveWorld(manifest, cameraPrimitive = {}) {
  if (!cameraPrimitive || typeof cameraPrimitive !== 'object' || Array.isArray(cameraPrimitive)) {
    return cameraPrimitive;
  }
  const worldFraming = cameraPrimitive.worldFraming;
  if (!worldFraming || typeof worldFraming !== 'object' || Array.isArray(worldFraming)) {
    return cameraPrimitive;
  }
  const cameraPosition = validXYZ(worldFraming.cameraPosition);
  const lookAt = validXYZ(worldFraming.lookAt);
  if (!cameraPosition || !lookAt) return cameraPrimitive;

  const viewBox = manifest?.viewBox || {};
  const vbWidth = Math.max(finiteOr(viewBox.width, 800), 1);
  const vbHeight = Math.max(finiteOr(viewBox.height, 600), 1);
  const horizontalFov = clamp(finiteOr(worldFraming.horizontalFov, 60), 20, 120);
  const fovRad = (horizontalFov * Math.PI) / 180;
  const f = vbWidth / (2 * Math.tan(fovRad / 2));

  // Horizontal view direction (project view onto xy plane). Assume the
  // camera looks roughly horizontally; vertical look-up/down is handled
  // by horizonY offset at the end.
  const viewX = lookAt[0] - cameraPosition[0];
  const viewY = lookAt[1] - cameraPosition[1];
  const horizontalMag = Math.hypot(viewX, viewY);
  if (horizontalMag < 1e-9) return cameraPrimitive;
  const forward = [viewX / horizontalMag, viewY / horizontalMag];
  // Right vector in the xy plane: world east when the camera faces world
  // north. Equivalent to world_up × forward in 3D (with world_up = +z).
  // Earlier this was the opposite sign, which silently swapped the two
  // vanishing points (left/right) — the test fixtures only checked
  // ordering, not which world axis recedes to which screen side.
  const right = [-forward[1], forward[0]];

  const screenCenterX = vbWidth / 2;
  // Horizon Y in screen space: midpoint by default; if the camera looks
  // up or down vertically, shift horizon proportionally.
  const verticalView = lookAt[2] - cameraPosition[2];
  const verticalPitch = Math.atan2(verticalView, horizontalMag);
  const horizonY = vbHeight / 2 + Math.tan(verticalPitch) * f;

  const vpForDirection = ([dx, dy]) => {
    const dForward = dx * forward[0] + dy * forward[1];
    const dRight = dx * right[0] + dy * right[1];
    if (Math.abs(dForward) < 1e-6) {
      // Direction parallel to picture plane — VP at infinity. Push it
      // far off-screen on the appropriate side.
      const sign = dRight >= 0 ? 1 : -1;
      return [screenCenterX + sign * vbWidth * 6, horizonY];
    }
    return [screenCenterX + (dRight / dForward) * f, horizonY];
  };

  const vpX = vpForDirection([1, 0]);
  const vpY = vpForDirection([0, 1]);
  const [vpLeft, vpRight] = vpX[0] <= vpY[0] ? [vpX, vpY] : [vpY, vpX];

  const declared = cameraPrimitive.vanishingPoints || {};
  const resolved = {
    ...cameraPrimitive,
    viewBox: {
      width: vbWidth,
      height: vbHeight,
    },
    vanishingPoints: {
      left: validPoint(declared.left) || [round(vpLeft[0]), round(vpLeft[1])],
      right: validPoint(declared.right) || [round(vpRight[0]), round(vpRight[1])],
    },
    horizonY: Number.isFinite(Number(cameraPrimitive.horizonY))
      ? Number(cameraPrimitive.horizonY)
      : round(horizonY),
    worldFramingResolved: true,
  };
  return resolved;
}

/**
 * Resolve a manifest's `cameraPrimitive.worldFraming` and
 * `cameraPrimitive.roomBasis.worldExtent` (or `meru.roomExtent`) into the
 * pixel-denominated fields that `projectTwoPoint` and downstream
 * neo-rembrandt expansion consume. Idempotent: re-running on an already-
 * resolved manifest is a no-op.
 *
 * This is the meru analogue of the camera step — same pattern as
 * `withGeneratedElementMandala`, just on the camera side of the manifest.
 */
export function withResolvedWorldCamera(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return manifest;
  const cameraPrimitive = manifest.cameraPrimitive || manifest.scene?.cameraPrimitive;
  if (!cameraPrimitive || typeof cameraPrimitive !== 'object' || Array.isArray(cameraPrimitive)) {
    return manifest;
  }
  const hasWorldFraming = cameraPrimitive.worldFraming && !cameraPrimitive.worldFramingResolved;
  const meru = manifest.polygonizer?.metamandala || manifest.polygonizer?.meru || {};
  const declaredRoomBasis = cameraPrimitive.roomBasis || {};
  const hasWorldRoom = (declaredRoomBasis.worldExtent || meru.roomExtent)
    && declaredRoomBasis.worldExtentSource !== 'meru';
  if (!hasWorldFraming && !hasWorldRoom) return manifest;
  const resolvedRoomBasis = hasWorldRoom
    ? resolveRoomBasisWorld(manifest, declaredRoomBasis)
    : declaredRoomBasis;
  const cameraWithRoom = resolvedRoomBasis === declaredRoomBasis
    ? cameraPrimitive
    : { ...cameraPrimitive, roomBasis: resolvedRoomBasis };
  const resolvedCamera = hasWorldFraming
    ? resolveCameraPrimitiveWorld(manifest, cameraWithRoom)
    : cameraWithRoom;
  if (hasWorldFraming && resolvedCamera !== cameraWithRoom) {
    resolvedCamera.roomBasis = withPinholeFrontEdgeAnchors(resolvedCamera, resolvedCamera.roomBasis || {});
  }
  if (resolvedCamera === cameraPrimitive) return manifest;
  const next = { ...manifest, cameraPrimitive: resolvedCamera };
  if (manifest.scene?.cameraPrimitive) {
    next.scene = { ...manifest.scene, cameraPrimitive: resolvedCamera };
  }
  return next;
}

function withPinholeFrontEdgeAnchors(cameraPrimitive, roomBasis = {}) {
  if (!hasWorldFraming(cameraPrimitive)) return roomBasis;
  const xRange = orderedRange(roomBasis.xRange || [-18, 18]);
  const yRange = orderedRange(roomBasis.yRange || [-28, 8]);
  const frontY = finiteOr(roomBasis.frontY, Math.max(yRange[0], yRange[1]));
  const next = { ...roomBasis };
  if (!validPoint(next.frontLeft)) {
    next.frontLeft = projectTwoPointPinhole([xRange[0], frontY, 0], cameraPrimitive, roomBasis).slice(0, 2);
  }
  if (!validPoint(next.frontRight)) {
    next.frontRight = projectTwoPointPinhole([xRange[1], frontY, 0], cameraPrimitive, roomBasis).slice(0, 2);
  }
  return next;
}

/**
 * Validate that meru.sceneExtent agrees with roomBasis.worldExtent when
 * both are declared, and that worldFraming positions sit inside the
 * declared room extent (a camera 50 ft outside a 16 ft room is almost
 * certainly an authoring mistake). Returns an array of error strings.
 */
export function validateCameraWorldFraming(manifest) {
  const errors = [];
  const polygonizer = manifest?.polygonizer || {};
  const meru = polygonizer.metamandala || polygonizer.meru || {};
  const cameraPrimitive = manifest?.cameraPrimitive || manifest?.scene?.cameraPrimitive || polygonizer.cameraPrimitive;
  const roomBasis = cameraPrimitive?.roomBasis || polygonizer.roomBasis;
  const roomExtent = roomBasis?.worldExtent || meru.roomExtent;
  if (roomExtent && typeof roomExtent === 'object' && !Array.isArray(roomExtent)) {
    const width = Number(roomExtent.width);
    const depth = Number(roomExtent.depth ?? roomExtent.length);
    if (!Number.isFinite(width) || width <= 0) {
      errors.push('roomBasis.worldExtent.width must be a positive number (world units)');
    }
    if (!Number.isFinite(depth) || depth <= 0) {
      errors.push('roomBasis.worldExtent.depth must be a positive number (world units)');
    }
    const sceneExtent = meru.sceneExtent;
    if (sceneExtent && Number.isFinite(Number(sceneExtent.width)) && Number.isFinite(width)) {
      if (Math.abs(Number(sceneExtent.width) - width) / Math.max(width, 1e-6) > 0.02) {
        errors.push(
          'polygonizer.metamandala.sceneExtent.width must agree with roomBasis.worldExtent.width when both are declared',
        );
      }
    }
  }
  const worldFraming = cameraPrimitive?.worldFraming;
  if (worldFraming && typeof worldFraming === 'object' && !Array.isArray(worldFraming)) {
    const cameraPosition = validXYZ(worldFraming.cameraPosition);
    const lookAt = validXYZ(worldFraming.lookAt);
    if (!cameraPosition) errors.push('cameraPrimitive.worldFraming.cameraPosition must be [x, y, z] in world units');
    if (!lookAt) errors.push('cameraPrimitive.worldFraming.lookAt must be [x, y, z] in world units');
    if (worldFraming.horizontalFov !== undefined && worldFraming.horizontalFov !== null) {
      const fov = Number(worldFraming.horizontalFov);
      if (!Number.isFinite(fov) || fov < 20 || fov > 120) {
        errors.push('cameraPrimitive.worldFraming.horizontalFov must be a finite number between 20 and 120 (degrees)');
      }
    }
    if (cameraPosition && lookAt) {
      errors.push(...validateProjectTwoPointPinhole(cameraPrimitive, roomBasis || {}));
    }
  }
  return errors;
}

export function validateProjectTwoPointPinhole(cameraPrimitive = {}, roomBasis = {}) {
  const errors = [];
  if (!hasWorldFraming(cameraPrimitive)) return errors;
  const basis = resolveCameraBasis(cameraPrimitive, roomBasis);
  if (!basis) {
    errors.push('cameraPrimitive.worldFraming.lookAt must differ from cameraPosition');
    return errors;
  }
  const finiteVec = (v) => Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(n));
  const len = (v) => Math.hypot(v[0], v[1], v[2]);
  for (const key of ['position', 'forward', 'right', 'up']) {
    if (!finiteVec(basis[key])) {
      errors.push(`cameraPrimitive.worldFraming resolved ${key} must be a finite 3D vector`);
    }
  }
  for (const key of ['forward', 'right', 'up']) {
    if (finiteVec(basis[key]) && Math.abs(len(basis[key]) - 1) > 1e-4) {
      errors.push(`cameraPrimitive.worldFraming resolved ${key} must be unit length`);
    }
  }
  const [cx, cy] = basis.pictureCenter;
  if (cx < 0 || cx > basis.viewBox.width || cy < 0 || cy > basis.viewBox.height) {
    errors.push('cameraPrimitive.worldFraming pictureCenter must land inside the viewBox');
  }
  return errors;
}

export function projectTwoPoint(worldXYZ, cameraPrimitive = {}, roomBasis = {}) {
  if (hasWorldFraming(cameraPrimitive)) {
    return projectTwoPointPinhole(worldXYZ, cameraPrimitive, roomBasis);
  }
  return projectTwoPointLerpBlend(worldXYZ, cameraPrimitive, roomBasis);
}

function hasWorldFraming(cameraPrimitive) {
  const worldFraming = cameraPrimitive?.worldFraming;
  return !!(
    worldFraming &&
    typeof worldFraming === 'object' &&
    !Array.isArray(worldFraming) &&
    validXYZ(worldFraming.cameraPosition) &&
    validXYZ(worldFraming.lookAt)
  );
}

export function projectTwoPointLerpBlend(worldXYZ, cameraPrimitive = {}, roomBasis = {}) {
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

export function resolveCameraBasis(cameraPrimitive = {}, roomBasis = {}) {
  const worldFraming = cameraPrimitive?.worldFraming || {};
  const position = validXYZ(worldFraming.cameraPosition);
  const lookAt = validXYZ(worldFraming.lookAt);
  if (!position || !lookAt) return null;

  const viewBox = cameraPrimitive.viewBox || {};
  const width = Math.max(finiteOr(viewBox.width, 800), 1);
  const height = Math.max(finiteOr(viewBox.height, 600), 1);
  const horizontalFov = clamp(finiteOr(worldFraming.horizontalFov, 60), 20, 120);
  const f = width / (2 * Math.tan((horizontalFov * Math.PI / 180) / 2));
  const forward = normalize3(sub3(lookAt, position));
  if (length3(forward) < 1e-9) return null;

  const worldUp = [0, 0, 1];
  let right = normalize3(cross3(worldUp, forward));
  if (length3(right) < 1e-9) {
    right = [1, 0, 0];
  }
  const up = normalize3(cross3(forward, right));
  const pictureCenter = validPoint(worldFraming.pictureCenter)
    || validPoint(cameraPrimitive.pictureCenter)
    || [width / 2, height / 2];
  const depthSpan = resolveCameraDepthSpan(position, forward, roomBasis);
  const referenceForward = Math.max(dot3(sub3(lookAt, position), forward), 1e-3);

  return {
    position,
    forward,
    right,
    up,
    f,
    pictureCenter,
    depthSpan,
    referenceForward,
    viewBox: { width, height },
  };
}

export function projectTwoPointPinhole(worldXYZ, cameraPrimitive = {}, roomBasis = {}) {
  const camera = resolveCameraBasis(cameraPrimitive, roomBasis);
  if (!camera) return projectTwoPointLerpBlend(worldXYZ, cameraPrimitive, roomBasis);
  const point = Array.isArray(worldXYZ)
    ? worldXYZ
    : [worldXYZ?.x, worldXYZ?.y, worldXYZ?.z ?? worldXYZ?.altitude];
  const P = [
    finiteOr(point[0], 0),
    finiteOr(point[1], 0),
    finiteOr(point[2], 0),
  ];
  const V = sub3(P, camera.position);
  const vForward = dot3(V, camera.forward);
  const vRight = dot3(V, camera.right);
  const vUp = dot3(V, camera.up);
  const forward = vForward < 1e-3 ? 1e-3 : vForward;
  const picX = (vRight / forward) * camera.f;
  const picY = -(vUp / forward) * camera.f;
  const depthT = clamp(forward / camera.depthSpan, 0, 1.18);
  const verticalScale = clamp(camera.referenceForward / forward, 0.34, 1.18);
  return [
    round(camera.pictureCenter[0] + picX),
    round(camera.pictureCenter[1] + picY),
    round(depthT),
    round(verticalScale),
  ];
}

function resolveCameraDepthSpan(position, forward, roomBasis = {}) {
  const corners = roomCorners(roomBasis);
  let maxForward = 0;
  for (const corner of corners) {
    maxForward = Math.max(maxForward, dot3(sub3(corner, position), forward));
  }
  return Math.max(maxForward, 1);
}

function roomCorners(roomBasis = {}) {
  const xRange = orderedRange(roomBasis.xRange || [-18, 18]);
  const yRange = orderedRange(roomBasis.yRange || [-28, 8]);
  const zMax = finiteOr(roomBasis.worldExtent?.height, finiteOr(roomBasis.height, 8));
  const corners = [];
  for (const x of xRange) {
    for (const y of yRange) {
      corners.push([x, y, 0], [x, y, zMax]);
    }
  }
  return corners;
}

function sub3(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function length3(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalize3(v) {
  const length = length3(v);
  if (length <= 1e-9) return [0, 0, 0];
  return [v[0] / length, v[1] / length, v[2] / length];
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
