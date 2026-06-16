/**
 * Vehicle glyph registry.
 *
 * Keeps moving vehicles separate from architecture/public-realm structures while
 * giving the model a reusable structural basis for transport objects.
 */

export const VEHICLE_GLYPH_VERSION = 'vehicle-glyphs-v0.1.0';

export const VEHICLE_GLYPH_CONCEPTS = [
  {
    id: 'vehicle.chassis.grounded-manji',
    family: 'chassis',
    label: 'Grounded vehicle chassis manji',
    aliases: ['vehicle chassis', 'grounded chassis', 'axle frame', 'two axle vehicle base', 'top down chassis'],
    basis: {
      planView: 'top-down mandala footprint on the road plane',
      wheelPair: 'left and right side wheel marks joined by a lateral axle bar',
      frame: 'two axle rows connected by centered stacked frame blocks',
      payloadMount: 'body footprint sits over the chassis without changing axle spacing',
    },
    parts: [
      'front wheel pair',
      'rear wheel pair',
      'front axle',
      'rear axle',
      'center frame block stack',
      'payload footprint',
      'road-plane contact footprint',
    ],
    variationAxes: {
      axleCount: [2, 3],
      wheelScale: ['small', 'medium', 'large'],
      frameHeight: ['low', 'standard', 'high'],
      wheelbase: ['short', 'standard', 'long'],
    },
    placement: {
      surfaceKind: 'roadPlane',
      side: 'top-down',
      support: 'all wheel marks and axles are coplanar on the road-plane footprint',
      occlusionRule: 'payload body may be translucent or drawn below chassis marks so the axle manji stays legible',
    },
    renderHints: [
      'resolve chassis in top-down mandala space before camera projection',
      'draw left and right wheel marks as vertical side rectangles',
      'connect each wheel pair with a lateral axle bar',
      'place centered stacked frame blocks between the axle rows',
      'draw the bus body footprint as a payload over/under the chassis without hiding the axle manji',
    ],
  },
  {
    id: 'vehicle.rectangular-wheeled.payload',
    family: 'rectangular-vehicle',
    label: 'Rectangular wheeled payload vehicle',
    aliases: [
      'rectangular vehicle',
      'rectangular shaped vehicle',
      'box vehicle on wheels',
      'wheeled rectangle',
      'train segment',
      'rail car segment',
      'tram segment',
      'van body',
    ],
    basis: {
      chassis: 'vehicle.chassis.grounded-manji',
      payload: 'rectangular body mass mounted over a grounded wheel/axle manji',
      wheels: 'wheel cells reserve structural surface area; visible wheels render as axis-aware cylinders',
      facadeSlots: 'side/front/roof decorator bands are allocated around wheel keep-outs',
      groundContact: 'all wheel cells remain coplanar with the road or rail plane',
    },
    parts: [
      'rectangular payload mass',
      'grounded chassis manji',
      'wheel keep-out slots',
      'side decorator band',
      'front decorator band',
      'roof decorator band',
      'near-wheel overlay group',
    ],
    composeWith: ['vehicle.chassis.grounded-manji'],
    variationAxes: {
      segmentClass: ['bus-like', 'train-car', 'tram-car', 'box-van'],
      axleCount: [2, 3, 4],
      bodyProportion: ['short-box', 'standard-rectangle', 'long-segment'],
      facadeDensity: ['plain', 'sparse', 'dense'],
      roofPayload: ['none', 'battery', 'hvac', 'pantograph-base'],
    },
    placement: {
      surfaceKind: 'roadPlaneOrRailPlane',
      side: 'road-axis projected',
      support: 'rectangular payload follows the chassis road axis and lane/track budget',
      occlusionRule: 'body mass may cover axles, but near wheels repaint above skirts/body and decorators avoid wheel keep-outs',
    },
    renderHints: [
      'resolve footprint and wheel slots in mandala space before drawing any facade detail',
      'mount one rectangular body mass over the chassis; do not resize the chassis to fit decorations',
      'allocate windows, doors, ad bands, vents, panels, and rail-car seams into non-overlapping side/front/roof slots',
      'use axis-specific wheel cylinder sticker order for x-road and y-road variants',
      'specialize into bus, train segment, tram, or van by changing facade slots rather than changing the grounding grammar',
    ],
  },
  {
    id: 'vehicle.bus.side-slab',
    family: 'bus',
    label: 'Side-view bus slab',
    aliases: ['bus', 'city bus', 'transit bus', 'coach side view'],
    basis: {
      parent: 'vehicle.rectangular-wheeled.payload',
      chassis: 'vehicle.chassis.grounded-manji',
      body: 'long rectangle footprint mounted over the chassis mandala',
      wheels: 'inherited from top-down grounded chassis manji',
      groundContact: 'chassis footprint is coplanar with the road plane',
    },
    parts: [
      'body slab',
      'window rhythm',
      'front windshield block',
      'side door block',
      'wheel wells',
      'wheels',
      'bumper caps',
      'route sign',
    ],
    composeWith: ['vehicle.rectangular-wheeled.payload', 'vehicle.chassis.grounded-manji'],
    variationAxes: {
      wheelCount: [2, 3],
      windowCount: [3, 8],
      doorPlacement: ['front', 'middle', 'front-and-middle'],
      roofLine: ['flat', 'rounded-cap', 'coach-arch'],
      liveryBand: ['none', 'single stripe', 'two tone'],
      stance: ['level', 'slight nose down', 'slight nose up'],
    },
    placement: {
      surfaceKind: 'roadPlane',
      side: 'top-down or projected top-down',
      support: 'road-plane chassis footprint',
      occlusionRule: 'body footprint must not erase the axle manji; draw chassis on top or body translucent',
    },
    renderHints: [
      'draw the body as the primary rectangle first',
      'reserve wheel slots below the body before adding decorative details',
      'align all wheel bottoms to the same ground line',
      'clip or overpaint upper wheel arcs with the bus body to imply wheel wells',
      'repeat windows as bounded rectangles inside the body slab',
    ],
  },
  {
    id: 'vehicle.truck.long-haul',
    family: 'truck',
    label: 'Long-haul cargo truck',
    aliases: [
      'long haul truck',
      'semi truck',
      'tractor trailer',
      'cargo truck',
      'freight truck',
      'truck',
    ],
    basis: {
      parent: 'vehicle.rectangular-wheeled.payload',
      chassis: 'vehicle.chassis.grounded-manji',
      body: 'split cab plus trailer volumes linked by a coupling gap',
      wheels: 'multi-axle grounded wheel cells with trailer-biased axle budget',
      cargoHybrid: 'trailer deck may host train-cart-compatible cargo slots',
      groundContact: 'all wheel marks remain coplanar with road or freight-plane support',
    },
    parts: [
      'tractor cab volume',
      'trailer volume',
      'coupling gap / fifth-wheel zone',
      'cab door and window panel',
      'cargo ribs / panel seams',
      'cargo cart slots',
      'grounded chassis manji',
    ],
    composeWith: ['vehicle.rectangular-wheeled.payload', 'vehicle.chassis.grounded-manji'],
    variationAxes: {
      axleCount: [3, 4, 5],
      trailerProfile: ['box-trailer', 'reefer-trailer', 'flatbed-trailer'],
      cabType: ['day-cab', 'sleeper-cab'],
      cargoHybrid: ['none', 'train-cart-compatible'],
      cargoDensity: ['light', 'standard', 'dense'],
    },
    placement: {
      surfaceKind: 'roadPlaneOrFreightPlane',
      side: 'road-axis projected',
      support: 'cab and trailer follow one grounding chassis while preserving coupler separation',
      occlusionRule: 'near wheels repaint above lower cab/trailer skirts and cargo slots avoid wheel keep-outs',
    },
    renderHints: [
      'resolve the full truck wheel/chassis budget before splitting body into cab and trailer',
      'treat the coupling gap as reserved non-cargo space',
      'keep cab shorter and slightly lower than trailer volume to preserve silhouette readability',
      'allocate cargo ribs and cart-compatible slots only within trailer bands',
      'hybridize with train-cart semantics by mapping trailer slots to cart-compatible cells',
    ],
  },
];

export function listVehicleGlyphConcepts({ family = null } = {}) {
  return VEHICLE_GLYPH_CONCEPTS.filter((concept) => !family || concept.family === family);
}

export function getVehicleGlyphConcept(idOrAlias) {
  const normalized = String(idOrAlias || '').trim().toLowerCase();
  return VEHICLE_GLYPH_CONCEPTS.find((concept) => (
    concept.id.toLowerCase() === normalized
    || concept.aliases.some((alias) => alias.toLowerCase() === normalized)
  )) || null;
}

function tokenizePrompt(prompt) {
  return String(prompt || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function conceptMatchScore(concept, tokens, promptText) {
  let score = 0;
  for (const token of tokens) {
    if (concept.id.includes(token)) score += 2;
    if (concept.family.includes(token)) score += 1;
    if (concept.aliases.some((alias) => alias.toLowerCase().includes(token))) score += 3;
    if (concept.parts.some((part) => part.toLowerCase().includes(token))) score += 1;
  }
  if (promptText.includes('bus') && concept.id === 'vehicle.bus.side-slab') score += 5;
  if ((promptText.includes('train') || promptText.includes('rail') || promptText.includes('tram')) && concept.id === 'vehicle.rectangular-wheeled.payload') score += 5;
  if (promptText.includes('chassis') && concept.id === 'vehicle.chassis.grounded-manji') score += 4;
  if ((promptText.includes('truck') || promptText.includes('cargo') || promptText.includes('semi')) && concept.id === 'vehicle.truck.long-haul') score += 6;
  if (promptText.includes('long haul') && concept.id === 'vehicle.truck.long-haul') score += 4;
  return score;
}

export function findVehicleGlyphConceptsForPrompt(prompt, { limit = 6 } = {}) {
  const normalizedPrompt = String(prompt || '').toLowerCase();
  const tokens = tokenizePrompt(prompt);
  const scored = VEHICLE_GLYPH_CONCEPTS.map((concept) => ({
    id: concept.id,
    family: concept.family,
    score: conceptMatchScore(concept, tokens, normalizedPrompt),
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return VEHICLE_GLYPH_CONCEPTS.slice(0, limit).map((concept) => ({
      id: concept.id,
      family: concept.family,
      score: 0,
    }));
  }

  return scored.slice(0, limit);
}

export function instantiateVehicleGlyphPlan(idOrAlias, { seed = 'vehicle-default', variant = 0 } = {}) {
  const concept = getVehicleGlyphConcept(idOrAlias);
  if (!concept) return null;
  if (concept.id === 'vehicle.chassis.grounded-manji') {
    const axleCount = variant % 3 === 2 ? 3 : 2;
    return {
      conceptId: concept.id,
      seed,
      variant,
      structuralBasis: concept.basis,
      parts: concept.parts,
      parameters: {
        axleCount,
        wheelCount: axleCount,
        wheelScale: concept.variationAxes.wheelScale[(seed.length + variant) % concept.variationAxes.wheelScale.length],
        frameHeight: concept.variationAxes.frameHeight[variant % concept.variationAxes.frameHeight.length],
        wheelbase: concept.variationAxes.wheelbase[(seed.length + variant * 2) % concept.variationAxes.wheelbase.length],
      },
      placement: concept.placement,
      renderHints: concept.renderHints,
    };
  }
  if (concept.id === 'vehicle.rectangular-wheeled.payload') {
    const axleOptions = concept.variationAxes.axleCount;
    const segmentOptions = concept.variationAxes.segmentClass;
    const bodyOptions = concept.variationAxes.bodyProportion;
    const facadeOptions = concept.variationAxes.facadeDensity;
    const roofOptions = concept.variationAxes.roofPayload;
    const axleCount = axleOptions[(seed.length + variant) % axleOptions.length];
    return {
      conceptId: concept.id,
      seed,
      variant,
      chassis: instantiateVehicleGlyphPlan('vehicle.chassis.grounded-manji', { seed, variant: axleCount === 3 ? 2 : variant }),
      structuralBasis: concept.basis,
      parts: concept.parts,
      parameters: {
        segmentClass: segmentOptions[variant % segmentOptions.length],
        axleCount,
        bodyProportion: bodyOptions[(seed.length + variant) % bodyOptions.length],
        facadeDensity: facadeOptions[(seed.length + variant * 2) % facadeOptions.length],
        roofPayload: roofOptions[(seed.length + variant * 3) % roofOptions.length],
      },
      placement: concept.placement,
      renderHints: concept.renderHints,
    };
  }
  if (concept.id === 'vehicle.truck.long-haul') {
    const axleOptions = concept.variationAxes.axleCount;
    const trailerOptions = concept.variationAxes.trailerProfile;
    const cabOptions = concept.variationAxes.cabType;
    const hybridOptions = concept.variationAxes.cargoHybrid;
    const densityOptions = concept.variationAxes.cargoDensity;
    const axleCount = axleOptions[(seed.length + variant) % axleOptions.length];
    return {
      conceptId: concept.id,
      seed,
      variant,
      parent: instantiateVehicleGlyphPlan('vehicle.rectangular-wheeled.payload', { seed, variant }),
      chassis: instantiateVehicleGlyphPlan('vehicle.chassis.grounded-manji', { seed, variant: axleCount > 3 ? 2 : variant }),
      structuralBasis: concept.basis,
      parts: concept.parts,
      parameters: {
        axleCount,
        trailerProfile: trailerOptions[variant % trailerOptions.length],
        cabType: cabOptions[(seed.length + variant) % cabOptions.length],
        cargoHybrid: hybridOptions[(seed.length + variant * 2) % hybridOptions.length],
        cargoDensity: densityOptions[(seed.length + variant * 3) % densityOptions.length],
      },
      placement: concept.placement,
      renderHints: concept.renderHints,
    };
  }
  const windowMin = concept.variationAxes.windowCount[0];
  const windowMax = concept.variationAxes.windowCount[1];
  const wheelCount = variant % 3 === 2 ? 3 : 2;
  const windowCount = windowMin + ((seed.length + variant) % (windowMax - windowMin + 1));
  const doorOptions = concept.variationAxes.doorPlacement;
  const roofOptions = concept.variationAxes.roofLine;
  const liveryOptions = concept.variationAxes.liveryBand;
  return {
    conceptId: concept.id,
    seed,
    variant,
    parent: instantiateVehicleGlyphPlan('vehicle.rectangular-wheeled.payload', { seed, variant }),
    chassis: instantiateVehicleGlyphPlan('vehicle.chassis.grounded-manji', { seed, variant }),
    structuralBasis: concept.basis,
    parts: concept.parts,
    parameters: {
      wheelCount,
      windowCount,
      doorPlacement: doorOptions[variant % doorOptions.length],
      roofLine: roofOptions[(seed.length + variant) % roofOptions.length],
      liveryBand: liveryOptions[(seed.length + variant * 2) % liveryOptions.length],
    },
    placement: concept.placement,
    renderHints: concept.renderHints,
  };
}

export function rigVehicleFootprint(plan, {
  origin = [0, 0, 0],
  length = 6,
  width = 2.4,
  bodyHeight = 1.6,
  wheelCellSize = 0.68,
  wheelRoadLength = wheelCellSize,
  wheelHeight = wheelCellSize,
  orientation = 'road-parallel',
  roadAxis = 'x',
} = {}) {
  if (!plan) return null;
  const chassisPlan = plan.conceptId === 'vehicle.chassis.grounded-manji' ? plan : plan.chassis;
  if (!chassisPlan) return null;
  const [x, y, z] = origin;
  const wheelCenterHeight = wheelHeight / 2;
  const axleCount = chassisPlan.parameters.axleCount || chassisPlan.parameters.wheelCount || 2;
  const axleFractions = axleCount === 3 ? [0.20, 0.52, 0.80] : [0.24, 0.76];
  const footprintWidth = roadAxis === 'x' ? length : width;
  const footprintLength = roadAxis === 'x' ? width : length;
  const payloadInsetX = footprintWidth * 0.06;
  const payloadInsetY = footprintLength * 0.16;
  const bodyBox = {
    x: x + payloadInsetX,
    y: y + payloadInsetY,
    z: z + wheelCenterHeight * 1.45,
    width: footprintWidth - payloadInsetX * 2,
    length: footprintLength - payloadInsetY * 2,
    height: bodyHeight,
  };
  const wheelPairs = axleFractions.map((fraction, index) => {
    const cx = x + footprintWidth * fraction;
    const left = {
      x: cx - wheelRoadLength / 2,
      y,
      z,
      width: wheelRoadLength,
      depth: wheelCellSize,
      height: wheelHeight,
      radius: wheelCenterHeight,
      helperKind: 'square-wheel-cell',
      visibleKind: 'square-wheel-box',
      center: [cx, y + wheelCellSize / 2, z + wheelCenterHeight],
    };
    left.faceCenters = {
      roadNear: [left.x + wheelRoadLength * 0.30, left.center[1], left.center[2]],
      roadFar: [left.x + wheelRoadLength * 0.70, left.center[1], left.center[2]],
    };
    left.contactCenters = {
      roadNear: [left.x + wheelRoadLength * 0.30, left.center[1], z],
      roadFar: [left.x + wheelRoadLength * 0.70, left.center[1], z],
    };
    const right = {
      x: cx - wheelRoadLength / 2,
      y: y + footprintLength - wheelCellSize,
      z,
      width: wheelRoadLength,
      depth: wheelCellSize,
      height: wheelHeight,
      radius: wheelCenterHeight,
      helperKind: 'square-wheel-cell',
      visibleKind: 'square-wheel-box',
      center: [cx, y + footprintLength - wheelCellSize / 2, z + wheelCenterHeight],
    };
    right.faceCenters = {
      roadNear: [right.x + wheelRoadLength * 0.30, right.center[1], right.center[2]],
      roadFar: [right.x + wheelRoadLength * 0.70, right.center[1], right.center[2]],
    };
    right.contactCenters = {
      roadNear: [right.x + wheelRoadLength * 0.30, right.center[1], z],
      roadFar: [right.x + wheelRoadLength * 0.70, right.center[1], z],
    };
    return {
      index,
      fraction,
      left,
      right,
      axle: {
        from: left.center,
        to: right.center,
        z: z + wheelCenterHeight,
      },
    };
  });
  return {
    planId: plan.conceptId,
    chassisId: chassisPlan.conceptId,
    origin,
    orientation,
    orientationPolicy: {
      default: 'road-parallel',
      roadAxis,
      mayOverride: orientation !== 'road-parallel',
    },
    footprint: { x, y, z, width: footprintWidth, length: footprintLength },
    payloadFootprint: {
      x: bodyBox.x,
      y: bodyBox.y,
      z,
      width: bodyBox.width,
      length: bodyBox.length,
    },
    bodyBox,
    wheelPairs,
    frameBlocks: [0.42, 0.54].map((fraction, index) => ({
      index,
      x: x + footprintWidth * fraction,
      y: y + footprintLength * 0.43,
      z,
      width: footprintWidth * 0.08,
      length: footprintLength * 0.14,
      height: wheelCenterHeight * 0.55,
    })),
  };
}
