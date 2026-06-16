import { describe, expect, it } from 'vitest';

import {
  buildAircraftSpineManji,
  buildBlockOnChassisManji,
  buildBusFacadeDecorators,
  buildLongHaulTruckOnWheels,
  buildRailHeadCarMandalaPlan,
  buildRectangularVehicleOnWheels,
  buildRoadAxisChassisManji,
  buildWheelStickerPrimitive,
  vehicleManjiPoint,
  VEHICLE_MANJI_VERSION,
  wheelRenderPolicyForRoadAxis,
} from './vehicle-manji.js';

const identityProject = ([x, y, z]) => [x * 10, y * 10 - z * 2];

function faceRectsOverlap(a, b, margin = 0) {
  const alongOverlap = a.meta.alongStart < b.meta.alongEnd + margin && b.meta.alongStart < a.meta.alongEnd + margin;
  const zOverlap = a.meta.zStart < b.meta.zEnd + margin && b.meta.zStart < a.meta.zEnd + margin;
  return alongOverlap && zOverlap;
}

function shapeOverlapsAnyWheelKeepOut(shape, ranges, margin = 0) {
  return ranges.some(([start, end]) => shape.meta.alongStart < end + margin && start < shape.meta.alongEnd + margin);
}

describe('vehicle manji primitives', () => {
  it('exposes a versioned reusable primitive module', () => {
    expect(VEHICLE_MANJI_VERSION).toMatch(/^vehicle-manji-/);
  });

  it('maps along/across coordinates by road axis', () => {
    expect(vehicleManjiPoint([10, 20], 'x', 3, 1, 0.5)).toEqual([13, 21, 0.5]);
    expect(vehicleManjiPoint([10, 20], 'y', 3, 1, 0.5)).toEqual([11, 23, 0.5]);
  });

  it('selects wheel cap plane and depth side by road axis', () => {
    expect(wheelRenderPolicyForRoadAxis('x')).toEqual({
      wheelAxis: 'y',
      depthSign: 1,
      farAcrossSide: 'horizon',
      nearAcrossSide: 'screen',
    });
    expect(wheelRenderPolicyForRoadAxis('y')).toEqual({
      wheelAxis: 'x',
      depthSign: -1,
      farAcrossSide: 'right',
      nearAcrossSide: 'left',
    });
  });

  it('builds a sticker wheel with body stickers followed by the hubcap', () => {
    const wheel = buildWheelStickerPrimitive({
      project: identityProject,
      center: [2, 3, 0.5],
      radius: 0.25,
      stickerCount: 3,
      pixelStep: 1,
      wheelAxis: 'x',
      depthSign: -1,
      role: 'test-wheel',
    });
    expect(wheel.shapes).toHaveLength(4);
    expect(wheel.shapes[0].role).toBe('test-wheel:body-sticker:0');
    expect(wheel.shapes[2].role).toBe('test-wheel:body-sticker:2');
    expect(wheel.shapes[3].role).toBe('test-wheel:outer-hubcap');
    expect(wheel.shapes[3].meta.wheelAxis).toBe('x');
    expect(wheel.shapes[3].meta.depthSign).toBe(-1);
  });

  it('builds an x-axis chassis in far wheels, axles, center bar, near wheels paint order', () => {
    const chassis = buildRoadAxisChassisManji({
      project: identityProject,
      origin: [10, 12],
      axis: 'x',
      length: 6,
      width: 1.4,
      wheelRadius: 0.25,
      role: 'x-chassis',
    });
    expect(chassis.axis).toBe('x');
    expect(chassis.wheelPolicy.wheelAxis).toBe('y');
    expect(chassis.axleAlong).toEqual([1.08, 4.92]);
    expect(chassis.shapes[0].role).toContain('far-wheel');
    expect(chassis.shapes.some((shape) => shape.role === 'x-chassis:center-road-axis-bar:axis-x:mandala-projected')).toBe(true);
    expect(chassis.shapes.at(-1).role).toContain('near-wheel');
  });

  it('builds a y-axis chassis with flipped sticker policy for the screen-facing left side', () => {
    const chassis = buildRoadAxisChassisManji({
      project: identityProject,
      origin: [17.8, 6.2],
      axis: 'y',
      length: 5.8,
      width: 1.2,
      wheelRadius: 0.27,
      role: 'y-chassis',
    });
    expect(chassis.axis).toBe('y');
    expect(chassis.wheelPolicy.wheelAxis).toBe('x');
    expect(chassis.wheelPolicy.depthSign).toBe(-1);
    expect(chassis.wheelCenters[0]).toMatchObject({ index: 0, side: 'far' });
    expect(chassis.wheelCenters[0].center[0]).toBeGreaterThan(chassis.origin[0]);
    expect(chassis.shapes.some((shape) => shape.role === 'y-chassis:center-road-axis-bar:axis-y:mandala-projected')).toBe(true);
    expect(chassis.shapes.at(-1).meta.depthSign).toBe(-1);
  });

  it('builds an aircraft spine manji with wing crossbar but no axles or wheels', () => {
    const aircraft = buildAircraftSpineManji({
      project: identityProject,
      origin: [4, 8],
      axis: 'x',
      length: 10,
      width: 6,
      spineZ: 1.1,
      role: 'jet-manji',
    });
    expect(aircraft.kind).toBe('aircraftSpineManji');
    expect(aircraft.axis).toBe('x');
    expect(aircraft.shapes.map((shape) => shape.role)).toEqual([
      'jet-manji:center-fuselage-spine:axis-x:mandala-projected',
      'jet-manji:main-wing-crossbar:axis-x:mandala-projected',
      'jet-manji:tailplane-crossbar:axis-x:mandala-projected',
    ]);
    expect(aircraft.shapes.some((shape) => /axle|wheel/.test(shape.role))).toBe(false);
    expect(aircraft.supportSlots.fuselage.from).toEqual([4.4, 11, 1.1]);
    expect(aircraft.supportSlots.fuselage.to).toEqual([14, 11, 1.1]);
    expect(aircraft.supportSlots.wing.from[0]).toBeCloseTo(8.6);
    expect(aircraft.supportSlots.wing.from.slice(1)).toEqual([8, 1.1]);
    expect(aircraft.supportSlots.wing.to[0]).toBeCloseTo(8.6);
    expect(aircraft.supportSlots.wing.to.slice(1)).toEqual([14, 1.1]);
  });

  it('can reverse aircraft along-direction while keeping wing roots in the same local grammar', () => {
    const aircraft = buildAircraftSpineManji({
      project: identityProject,
      origin: [2, 3],
      axis: 'y',
      length: 10,
      width: 4,
      spineZ: 1,
      alongDirection: -1,
      role: 'approach-manji',
    });
    expect(aircraft.alongDirection).toBe(-1);
    expect(aircraft.supportSlots.fuselage.from).toEqual([4, 12.6, 1]);
    expect(aircraft.supportSlots.fuselage.to).toEqual([4, 3, 1]);
    expect(aircraft.supportSlots.wing.from[0]).toBe(2);
    expect(aircraft.supportSlots.wing.from[1]).toBeCloseTo(8.4);
    expect(aircraft.supportSlots.wing.from[2]).toBe(1);
    expect(aircraft.supportSlots.wing.to[0]).toBe(6);
    expect(aircraft.supportSlots.wing.to[1]).toBeCloseTo(8.4);
    expect(aircraft.supportSlots.wing.to[2]).toBe(1);
  });

  it('mounts an x-axis rectangular body block over the chassis with overlay wheel grouping', () => {
    const block = buildBlockOnChassisManji({
      project: identityProject,
      origin: [10, 12],
      axis: 'x',
      length: 6,
      width: 1.2,
      wheelRadius: 0.25,
      bodyLength: 6.8,
      bodyWidth: 1.6,
      bodyHeight: 1.4,
      role: 'x-block',
    });
    expect(block.kind).toBe('blockOnChassisManji');
    expect(block.axis).toBe('x');
    expect(block.bodyBox.width).toBeCloseTo(6.8);
    expect(block.bodyBox.length).toBeCloseTo(1.6);
    expect(block.bodyBox.z).toBeCloseTo(0.1 + 0.5 + 0.02);
    expect(block.paintGroups.underBodyChassisShapes.some((shape) => shape.role.includes(':near-wheel:'))).toBe(false);
    expect(block.paintGroups.overlayWheelShapes.every((shape) => shape.role.includes(':near-wheel:'))).toBe(true);
  });

  it('establishes a generic rectangular vehicle on wheels primitive with reusable slots', () => {
    const vehicle = buildRectangularVehicleOnWheels({
      project: identityProject,
      origin: [10, 12],
      axis: 'x',
      length: 7.5,
      width: 1.5,
      wheelRadius: 0.3,
      bodyLength: 8.2,
      bodyWidth: 1.9,
      bodyHeight: 1.45,
      vehicleClass: 'train-segment-compatible',
      payloadKind: 'rectangular-cabin',
      role: 'generic-rectangular-vehicle',
    });
    expect(vehicle.kind).toBe('rectangularVehicleOnWheels');
    expect(vehicle.vehicleClass).toBe('train-segment-compatible');
    expect(vehicle.payloadKind).toBe('rectangular-cabin');
    expect(vehicle.chassis.kind).toBe('roadAxisChassisManji');
    expect(vehicle.slots.alongSpan).toBeCloseTo(vehicle.bodyBox.width);
    expect(vehicle.slots.acrossSpan).toBeCloseTo(vehicle.bodyBox.length);
    expect(vehicle.slots.wheelKeepOutRanges).toHaveLength(2);
    expect(vehicle.paintGroups.underBodyChassisShapes.some((shape) => shape.role.includes(':near-wheel:'))).toBe(false);
    expect(vehicle.paintGroups.overlayWheelShapes.every((shape) => shape.role.includes(':near-wheel:'))).toBe(true);
  });

  it('plans rail head cars in mandala space before rendering visible nose envelopes', () => {
    const toward = buildRailHeadCarMandalaPlan({
      origin: [10, 12],
      length: 6.5,
      bodyLength: 6.8,
      noseStartFraction: 0.52,
      noseExtension: 1.2,
      role: 'toward-bullet-plan',
    });
    const away = buildRailHeadCarMandalaPlan({
      origin: [10, 12],
      length: 6.5,
      bodyLength: 6.8,
      noseStartFraction: 0.52,
      noseExtension: 1.2,
      noseDirection: 'away-from-horizon',
      role: 'away-bullet-plan',
    });
    expect(toward.kind).toBe('railHeadCarMandalaPlan');
    expect(toward.bodyBudget.area).toBeGreaterThan(0);
    expect(toward.noseBudget.area).toBeGreaterThan(0);
    expect(toward.totalFootprint.area).toBeGreaterThan(toward.bodyBudget.area);
    expect(toward.noseBudget.joinAlong).toBeGreaterThan(toward.bodyBudget.alongStart);
    expect(toward.noseBudget.tipAlong).toBeGreaterThan(toward.bodyBudget.alongEnd);
    expect(toward.cabinBudget.alongStart).toBe(toward.bodyBudget.alongStart);
    expect(away.noseBudget.tipAlong).toBeLessThan(away.bodyBudget.alongStart);
    expect(away.cabinBudget.alongEnd).toBe(away.bodyBudget.alongEnd);
    expect(away.slots.totalAlongBand[0]).toBeLessThan(away.bodyBudget.alongStart);
    expect(toward.vehicleOptions.payloadKind).toBe('rail-head-car-curved-nose');
  });

  it('mounts a y-axis rectangular body block by swapping body length and width', () => {
    const block = buildBlockOnChassisManji({
      project: identityProject,
      origin: [17.8, 6.2],
      axis: 'y',
      length: 5.8,
      width: 1.2,
      wheelRadius: 0.27,
      bodyLength: 7.1,
      bodyWidth: 1.75,
      bodyHeight: 1.35,
      role: 'y-block',
    });
    expect(block.axis).toBe('y');
    expect(block.bodyBox.width).toBeCloseTo(1.75);
    expect(block.bodyBox.length).toBeCloseTo(7.1);
    expect(block.chassis.wheelPolicy.wheelAxis).toBe('x');
    expect(block.paintGroups.overlayWheelShapes.at(-1).meta.depthSign).toBe(-1);
  });

  it('builds bus facade decorators for a mounted x-axis block', () => {
    const block = buildBlockOnChassisManji({
      project: identityProject,
      origin: [10, 12],
      axis: 'x',
      length: 6,
      width: 1.2,
      wheelRadius: 0.25,
      role: 'decorated-x-block',
    });
    const facade = buildBusFacadeDecorators({
      project: identityProject,
      block,
      role: 'decorated-x-bus',
      windowCount: 4,
      doorPlacement: 'front-and-middle',
    });
    expect(facade.kind).toBe('busFacadeDecorators');
    expect(facade.axis).toBe('x');
    expect(facade.shapes.filter((shape) => shape.role.includes(':window-repeat:'))).toHaveLength(4);
    expect(facade.shapes.filter((shape) => shape.role.includes(':door:'))).toHaveLength(2);
    expect(facade.shapes.some((shape) => shape.role.endsWith(':side-ad-panel'))).toBe(true);
    expect(facade.shapes.some((shape) => shape.role.endsWith(':driver-window'))).toBe(true);
    expect(facade.shapes.some((shape) => shape.role.endsWith(':route-number-sign'))).toBe(true);
    expect(facade.shapes.some((shape) => shape.role.endsWith(':front-windshield-wrap'))).toBe(true);
    expect(facade.shapes.some((shape) => shape.role.endsWith(':front-side-driver-window'))).toBe(true);
    expect(facade.shapes.filter((shape) => shape.role.includes(':front-grille-bar:'))).toHaveLength(4);
    expect(facade.shapes.filter((shape) => shape.role.includes(':headlight:'))).toHaveLength(2);
    expect(facade.shapes.some((shape) => shape.role.endsWith(':rear-view-mirror'))).toBe(true);
    expect(facade.shapes.some((shape) => shape.role.endsWith(':roof-battery-box'))).toBe(true);

    const sideWindow = facade.shapes.find((shape) => shape.role.includes(':window-repeat:'));
    const frontWindshield = facade.shapes.find((shape) => shape.role.endsWith(':driver-window'));
    expect(sideWindow.meta.zEnd).toBeLessThanOrEqual(frontWindshield.meta.zEnd);
  });

  it('allocates bus doors, ads, grille, and headlights into the skirt band when present', () => {
    const block = buildBlockOnChassisManji({
      project: identityProject,
      origin: [10, 12],
      axis: 'x',
      length: 6,
      width: 1.2,
      wheelRadius: 0.25,
      role: 'skirted-x-block',
    });
    const facade = buildBusFacadeDecorators({
      project: identityProject,
      block,
      role: 'skirted-x-bus',
      windowCount: 4,
      doorPlacement: 'front-and-middle',
      skirtDepth: 0.28,
    });
    const sideAd = facade.shapes.find((shape) => shape.role.endsWith(':side-ad-panel'));
    const door = facade.shapes.find((shape) => shape.role.endsWith(':door:0'));
    const grille = facade.shapes.find((shape) => shape.role.endsWith(':front-grille-bar:0'));
    const headlight = facade.shapes.find((shape) => shape.role.endsWith(':headlight:0'));

    expect(facade.skirtDepth).toBeCloseTo(0.28);
    expect(sideAd.meta.usesSkirtArea).toBe(true);
    expect(door.meta.usesSkirtArea).toBe(true);
    expect(grille.meta.skirtSection).toBe(true);
    expect(headlight.meta.skirtSection).toBe(true);

    const doorShapes = facade.shapes.filter((shape) => shape.meta.decoratorClass === 'door');
    for (const doorShape of doorShapes) {
      expect(shapeOverlapsAnyWheelKeepOut(doorShape, facade.wheelKeepOutRanges)).toBe(false);
    }
  });

  it('keeps side facade decorators out of each other and low decorators out of wheel zones', () => {
    const block = buildBlockOnChassisManji({
      project: identityProject,
      origin: [10.7, 14.2],
      axis: 'x',
      length: 6.8,
      width: 1.5,
      wheelRadius: 0.36,
      bodyLength: 7.5,
      bodyWidth: 1.75,
      bodyHeight: 1.35,
      bodyAlongInset: -0.35,
      bodyAcrossInset: -0.25,
      role: 'collision-aware-bus',
    });
    const skirtBottom = block.wheelZ + block.wheelRadius * 0.24;
    const facade = buildBusFacadeDecorators({
      project: identityProject,
      block,
      role: 'collision-aware-bus-facade',
      windowCount: 5,
      doorPlacement: 'front-and-middle',
      skirtDepth: block.bodyBox.z - skirtBottom,
    });
    const sideDecorators = facade.shapes.filter((shape) => [
      'side-ad',
      'window',
      'door',
      'front-windshield-wrap',
      'front-side-driver-window',
      'rear-view-mirror',
    ].includes(shape.meta.decoratorClass));
    for (let i = 0; i < sideDecorators.length; i += 1) {
      for (let j = i + 1; j < sideDecorators.length; j += 1) {
        expect(faceRectsOverlap(sideDecorators[i], sideDecorators[j])).toBe(false);
      }
    }

    const lowDecorators = sideDecorators.filter((shape) => shape.meta.zStart < block.wheelRadius * 2);
    for (const shape of lowDecorators) {
      expect(shapeOverlapsAnyWheelKeepOut(shape, facade.wheelKeepOutRanges)).toBe(false);
    }
  });

  it('builds bus facade decorators on the y-axis side face', () => {
    const block = buildBlockOnChassisManji({
      project: identityProject,
      origin: [17.8, 6.2],
      axis: 'y',
      length: 5.8,
      width: 1.2,
      wheelRadius: 0.27,
      bodyLength: 7.1,
      bodyWidth: 1.75,
      bodyHeight: 1.35,
      role: 'decorated-y-block',
    });
    const facade = buildBusFacadeDecorators({
      project: identityProject,
      block,
      role: 'decorated-y-bus',
      windowCount: 3,
      doorPlacement: 'front',
    });
    expect(facade.axis).toBe('y');
    expect(facade.shapes.filter((shape) => shape.role.includes(':window-repeat:'))).toHaveLength(3);
    expect(facade.shapes.filter((shape) => shape.role.includes(':door:'))).toHaveLength(1);
    expect(facade.shapes[0].points[0].x).toBeCloseTo(facade.shapes[0].points[3].x);
  });

  it('builds a long-haul truck primitive with distinct cab and trailer profiles', () => {
    const truck = buildLongHaulTruckOnWheels({
      project: identityProject,
      origin: [8.4, 10.6],
      axis: 'x',
      role: 'long-haul-x',
    });
    expect(truck.kind).toBe('longHaulTruckOnWheels');
    expect(truck.vehicleClass).toBe('long-haul-truck');
    expect(truck.payloadKind).toBe('cab-and-trailer');
    expect(truck.cabBox.width).toBeLessThan(truck.trailerBox.width);
    expect(truck.cabBox.height).toBeLessThan(truck.trailerBox.height);
    expect(truck.slots.cabAlongBand[1]).toBeLessThan(truck.slots.trailerAlongBand[0]);
    expect(truck.slots.cabAlongBand[1] - truck.slots.cabAlongBand[0]).toBeLessThan((truck.slots.trailerAlongBand[1] - truck.slots.trailerAlongBand[0]) * 0.28);
    expect(truck.slots.skirtParts.length).toBeGreaterThan(0);
    expect(truck.slots.skirtParts.every((part) => part.section === 'cab-face-skirt')).toBe(true);
    expect(truck.slots.skirtParts.every((part) => part.alongEnd <= truck.slots.cabAlongBand[1])).toBe(true);
    expect(truck.slots.squareFaceParts.map((part) => part.part)).toEqual(expect.arrayContaining([
      'windshield',
      'grille',
      'bumper',
    ]));
    expect(truck.paintGroups.hullShapes.filter((shape) => shape.meta.decoratorClass === 'truck-hull')).toHaveLength(8);
    expect(truck.shapes.some((shape) => shape.meta.decoratorClass === 'truck-cab-window')).toBe(true);
    expect(truck.shapes.some((shape) => shape.meta.decoratorClass === 'truck-coupler-gap')).toBe(true);
    expect(truck.shapes.some((shape) => shape.meta.decoratorClass === 'truck-skirt')).toBe(true);
  });

  it('establishes a square truck face with windshield, grille, bumper, and headlights', () => {
    const truck = buildLongHaulTruckOnWheels({
      project: identityProject,
      origin: [8.4, 10.6],
      axis: 'x',
      role: 'square-face-long-haul-x',
    });
    const faceShapes = truck.shapes.filter((shape) => String(shape.meta.decoratorClass || '').startsWith('truck-face-'));

    expect(truck.slots.squareFaceParts).toHaveLength(4);
    expect(faceShapes.some((shape) => shape.meta.decoratorClass === 'truck-face-windshield')).toBe(true);
    expect(faceShapes.some((shape) => shape.meta.decoratorClass === 'truck-face-grille')).toBe(true);
    expect(faceShapes.some((shape) => shape.meta.decoratorClass === 'truck-face-bumper')).toBe(true);
    expect(faceShapes.filter((shape) => shape.meta.decoratorClass === 'truck-face-grille-slat')).toHaveLength(4);
    expect(faceShapes.filter((shape) => shape.meta.decoratorClass === 'truck-face-headlight')).toHaveLength(2);
    expect(faceShapes.every((shape) => shape.meta.faceStyle === 'square-cabover')).toBe(true);

    const windshield = faceShapes.find((shape) => shape.meta.decoratorClass === 'truck-face-windshield');
    const grille = faceShapes.find((shape) => shape.meta.decoratorClass === 'truck-face-grille');
    const bumper = faceShapes.find((shape) => shape.meta.decoratorClass === 'truck-face-bumper');
    expect(windshield.meta.zStart).toBeGreaterThan(grille.meta.zEnd);
    expect(grille.meta.zStart).toBeGreaterThan(bumper.meta.zStart);
  });

  it('draws vertical exhaust stacks as flush capped cylinder primitives without door slivers', () => {
    const truck = buildLongHaulTruckOnWheels({
      project: identityProject,
      origin: [8.4, 10.6],
      axis: 'x',
      role: 'cylinder-face-long-haul-x',
    });
    const doorCylinders = truck.shapes.filter((shape) => shape.meta.decoratorClass === 'truck-door-cylinder');
    const exhaustCylinders = truck.shapes.filter((shape) => shape.meta.decoratorClass === 'truck-exhaust-cylinder');

    expect(doorCylinders).toHaveLength(0);
    expect(exhaustCylinders.filter((shape) => shape.meta.cylinderPart === 'wall')).toHaveLength(2);
    expect(exhaustCylinders.filter((shape) => shape.meta.cylinderPart === 'top-cap')).toHaveLength(2);
    expect(exhaustCylinders.every((shape) => shape.kind === 'polygon')).toBe(true);
    expect(exhaustCylinders.every((shape) => shape.meta.zEnd > truck.bodyBox.height)).toBe(true);
    expect(exhaustCylinders.every((shape) => shape.meta.cylinderUse === 'vertical-exhaust-stack')).toBe(true);
    const horizonStack = exhaustCylinders.find((shape) => shape.meta.side === 'horizon' && shape.meta.cylinderPart === 'wall');
    const screenStack = exhaustCylinders.find((shape) => shape.meta.side === 'screen' && shape.meta.cylinderPart === 'wall');
    expect(horizonStack.meta.along).toBeGreaterThan(truck.slots.cabAlongBand[1]);
    expect(horizonStack.meta.along).toBeGreaterThan(screenStack.meta.along);
    expect(horizonStack.meta.behindCab).toBe(true);
    expect(horizonStack.meta.across - horizonStack.meta.radius).toBeCloseTo(0);
    expect(screenStack.meta.across + screenStack.meta.radius).toBeCloseTo(truck.slots.acrossSpan);
  });

  it('keeps truck skirt parts on the front cab segment and leaves trailer wheels exposed', () => {
    const truck = buildLongHaulTruckOnWheels({
      project: identityProject,
      origin: [8.4, 10.6],
      axis: 'x',
      role: 'skirted-long-haul-x',
    });
    const skirtShapes = truck.shapes.filter((shape) => shape.meta.decoratorClass === 'truck-skirt');
    const trailerPanel = truck.shapes.find((shape) => shape.meta.decoratorClass === 'truck-trailer-panel');

    expect(skirtShapes.length).toBe(truck.slots.skirtParts.length);
    expect(skirtShapes.every((shape) => shape.meta.zStart < 0)).toBe(true);
    expect(skirtShapes.every((shape) => shape.meta.zEnd < trailerPanel.meta.zEnd)).toBe(true);
    expect(skirtShapes.every((shape) => shape.meta.unifiedBand)).toBe(true);
    expect(skirtShapes.every((shape) => shape.meta.frameIntegrated)).toBe(true);
    expect(skirtShapes.every((shape) => shape.meta.zEnd - shape.meta.zStart > truck.bodyBox.height * 0.32)).toBe(true);
    expect(truck.shapes.some((shape) => shape.meta.decoratorClass === 'truck-skirt-door-blend')).toBe(false);
    for (const part of truck.slots.skirtParts) {
      expect(part.zStart).toBeLessThan(0);
      expect(part.alongEnd).toBeGreaterThan(part.alongStart);
      expect(part.alongEnd).toBeLessThanOrEqual(truck.slots.cabAlongBand[1]);
      expect(part.alongEnd).toBeLessThan(truck.slots.trailerAlongBand[0]);
    }
    for (let index = 1; index < truck.slots.skirtParts.length; index += 1) {
      expect(truck.slots.skirtParts[index].zStart).toBeCloseTo(truck.slots.skirtParts[0].zStart);
      expect(truck.slots.skirtParts[index].zEnd).toBeCloseTo(truck.slots.skirtParts[0].zEnd);
    }
  });

  it('reifies opaque cab and trailer hulls and makes the two-seat cab door readable', () => {
    const truck = buildLongHaulTruckOnWheels({
      project: identityProject,
      origin: [8.4, 10.6],
      axis: 'x',
      role: 'readable-hull-long-haul-x',
    });
    const hullShapes = truck.paintGroups.hullShapes;
    const door = truck.shapes.find((shape) => shape.meta.decoratorClass === 'truck-cab-door');
    const handle = truck.shapes.find((shape) => shape.meta.decoratorClass === 'truck-cab-door-handle');

    expect(hullShapes.map((shape) => shape.meta.hullPart)).toEqual(expect.arrayContaining([
      'square-cab-face',
      'square-cab-side-cheek',
      'cab-door-side-panel',
      'cab-rear-side-frame',
      'cab-top',
      'trailer-front',
      'trailer-side',
      'trailer-top',
    ]));
    expect(hullShapes.every((shape) => !/opacity/i.test(shape.fill || ''))).toBe(true);
    expect(door.meta.seatClass).toBe('two-seat-cab');
    expect(door.meta.zEnd - door.meta.zStart).toBeGreaterThan(truck.bodyBox.height * 0.6);
    expect(handle).toBeDefined();
    expect(handle.meta.seatClass).toBe('two-seat-cab');
  });

  it('adds train-cart compatible cargo slots to long-haul truck trailer decks', () => {
    const truck = buildLongHaulTruckOnWheels({
      project: identityProject,
      origin: [15.2, 6.8],
      axis: 'y',
      role: 'long-haul-y',
      cargoHybrid: 'train-cart-compatible',
    });
    expect(truck.axis).toBe('y');
    expect(truck.cargoHybrid).toBe('train-cart-compatible');
    expect(truck.slots.cargoCartSlots).toHaveLength(3);
    for (const slot of truck.slots.cargoCartSlots) {
      expect(slot.compatibility).toContain('train-cart');
      expect(slot.alongEnd).toBeGreaterThan(slot.alongStart);
      expect(slot.zEnd).toBeGreaterThan(slot.zStart);
    }
    const door = truck.shapes.find((shape) => shape.meta.decoratorClass === 'truck-cab-door');
    expect(shapeOverlapsAnyWheelKeepOut(door, truck.wheelKeepOutRanges)).toBe(false);
  });
});
