/**
 * Architecture mandala allocation planner.
 *
 * Converts architecture glyph concepts into a zero-vector surface allocation
 * plan before rendering. It reserves normalized rectangles on support surfaces
 * so buildings, balconies, roads, bus stops, towers, fields, docks, etc. have
 * explicit area budget and collisions/readability can be diagnosed upstream.
 */

import {
  findArchitectureGlyphConceptsForPrompt,
  getArchitectureGlyphConcept,
  instantiateArchitectureGlyphPlan,
} from './architecture-glyph-registry.js';

export const ARCHITECTURE_MANDALA_PLANNER_VERSION = '0.1.0';

export function createDefaultArchitectureSurfaces() {
  return [
    surface('scene.ground', 'groundPlane', 'scene', [0.00, 0.00, 1.00, 1.00], 0.92, 'primary scene support'),
    surface('street.main', 'roadPlane', 'street', [0.05, 0.55, 0.90, 0.18], 0.92, 'road and crosswalk support'),
    surface('sidewalk.near', 'sidewalk', 'curb', [0.05, 0.73, 0.90, 0.09], 0.82, 'near curbside street furniture support'),
    surface('sidewalk.far', 'sidewalk', 'curb', [0.05, 0.45, 0.90, 0.08], 0.82, 'far curbside street furniture support'),
    surface('building.a.mass', 'buildingMass', 'building.mass', [0.08, 0.10, 0.28, 0.38], 0.86, 'primary tower mass and wrap-net support'),
    surface('building.b.mass', 'buildingMass', 'building.mass', [0.42, 0.09, 0.24, 0.34], 0.86, 'secondary tower mass and wrap-net support'),
    surface('building.radial.node', 'radialBuildingMass', 'building.radialMass', [0.70, 0.10, 0.18, 0.34], 0.82, 'cylindrical/radial tower mass support'),
    surface('building.a.front', 'facadeFace', 'building.frontFace', [0.08, 0.12, 0.36, 0.32], 0.86, 'primary facade budget'),
    surface('building.b.front', 'facadeFace', 'building.frontFace', [0.48, 0.13, 0.32, 0.28], 0.86, 'secondary facade budget'),
    surface('building.a.roof', 'roofTop', 'building.top', [0.10, 0.07, 0.32, 0.08], 0.76, 'roof cap and rooftop fixtures'),
    surface('lot.service', 'lotPad', 'lot.pad', [0.64, 0.20, 0.28, 0.24], 0.82, 'gas station, house, or service lot support'),
    surface('utility.edge', 'utilityEasement', 'utility.easement', [0.82, 0.10, 0.12, 0.36], 0.74, 'tower and utility equipment support'),
    surface('plaza.node', 'plaza', 'publicRealm.node', [0.12, 0.83, 0.32, 0.14], 0.78, 'public realm node support'),
    surface('yard.grid', 'yard', 'yard.grid', [0.54, 0.82, 0.38, 0.14], 0.80, 'industrial, farmyard, or construction support'),
    surface('field.main', 'field', 'field.edge', [0.05, 0.82, 0.45, 0.16], 0.86, 'field/court/farm support'),
    surface('dock.edge', 'dock', 'dock.edge', [0.56, 0.72, 0.36, 0.10], 0.78, 'dock and harbor support'),
    surface('venue.bowl', 'venue', 'venue.bowl', [0.28, 0.76, 0.42, 0.20], 0.88, 'stadium or venue perimeter support'),
    surface('terminal.apron', 'transportApron', 'terminal.apron', [0.52, 0.50, 0.42, 0.20], 0.86, 'airport terminal and runway support'),
    surface('rail.platform', 'railPlatform', 'rail.platform', [0.08, 0.50, 0.48, 0.15], 0.86, 'train station platform and track support'),
  ];
}

function surface(id, kind, contract, rect, maxCoverage, note) {
  const [u, v, w, h] = rect;
  return {
    id,
    kind,
    contract,
    rect: { u, v, w, h },
    maxCoverage,
    note,
  };
}

const CONTRACT_TO_KIND = {
  'building.mass': ['buildingMass', 'facadeFace'],
  'building.radialMass': ['radialBuildingMass', 'buildingMass'],
  'building.frontFace': ['facadeFace'],
  'building.sideFace': ['facadeFace'],
  'podium.face': ['facadeFace'],
  'building.top': ['roofTop'],
  'gate.cap': ['roofTop', 'plaza'],
  'pavilion.top': ['roofTop', 'plaza'],
  'lot.pad': ['lotPad'],
  'street.edge': ['sidewalk', 'roadPlane'],
  'compound.innerCourt': ['plaza', 'yard'],
  'sidewalk.edge': ['sidewalk'],
  'curb.line': ['sidewalk'],
  'street.corner': ['sidewalk', 'roadPlane'],
  'plaza.edge': ['plaza', 'sidewalk'],
  'utility.easement': ['utilityEasement'],
  'roof.mount': ['roofTop'],
  'field.edge': ['field', 'utilityEasement'],
  'street.serviceZone': ['sidewalk', 'utilityEasement'],
  'plaza.center': ['plaza'],
  'park.path': ['plaza', 'field'],
  'publicRealm.node': ['plaza'],
  'yard.grid': ['yard'],
  'dock.edge': ['dock'],
  'refinery.pipeRack': ['yard'],
  'construction.site': ['yard'],
  'field.perimeter': ['field', 'venue'],
  'venue.bowl': ['venue'],
  'court.edge': ['field', 'venue'],
  'terminal.apron': ['transportApron', 'lotPad'],
  'rail.platform': ['railPlatform', 'sidewalk'],
  'farmyard.cluster': ['yard', 'field'],
  'rural.lot': ['field', 'lotPad'],
};

const CONCEPT_ALLOCATION_OVERRIDES = {
  'urban.sidewalk-road': {
    kinds: ['roadPlane'],
    size: [0.86, 0.78],
    priority: 10,
    anchor: 'base',
    axisFrame: { roadAxis: 'u', crossAxis: 'v' },
    crosswalkPolicy: { crossingAxis: 'v', stripeLongAxis: 'u', crossingPerpendicularToRoadAxis: true },
  },
  'building.facade-wrap-tower': {
    kinds: ['buildingMass', 'facadeFace'],
    size: [0.62, 0.82],
    priority: 96,
    massingKind: 'facadeWrap',
    wrapNet: { kind: 'facadeWrap', addressSpace: 'face + bay + floor' },
  },
  'building.radial-wrap-tower': {
    kinds: ['radialBuildingMass', 'buildingMass'],
    size: [0.54, 0.82],
    priority: 97,
    massingKind: 'radialWrap',
    wrapNet: { kind: 'radialWrap', addressSpace: 'theta segment + floor' },
  },
  'facade.condo-grid': { kinds: ['facadeFace'], size: [0.86, 0.82], priority: 90 },
  'facade.storefront-podium': { kinds: ['facadeFace'], size: [0.48, 0.28], priority: 75 },
  'facade.allocated-balcony': { kinds: ['facadeFace'], size: [0.18, 0.16], priority: 95, repeatAxis: 'facade-cell' },
  'residential.low-rise-house': { kinds: ['lotPad', 'field'], size: [0.58, 0.62], priority: 70 },
  'entry.arch-gate-door': { kinds: ['facadeFace', 'plaza'], size: [0.18, 0.28], priority: 82 },
  'roof.curved-asian-tier': { kinds: ['roofTop', 'facadeFace'], size: [0.70, 0.58], priority: 78 },
  'roof.top-triangle-repeat': { kinds: ['roofTop'], size: [0.70, 0.28], priority: 86 },
  'roof.western-rafter-truss': { kinds: ['roofTop', 'yard'], size: [0.62, 0.34], priority: 76 },
  'civic.torii-gate': { kinds: ['plaza', 'field'], size: [0.22, 0.48], priority: 66 },
  'civic.public-realm-kit': { kinds: ['plaza', 'sidewalk'], size: [0.22, 0.30], priority: 44 },
  'path.sined-pasta': { kinds: ['plaza', 'field', 'sidewalk'], size: [0.72, 0.26], priority: 35 },
  'urban.traffic-signals': { kinds: ['sidewalk'], size: [0.10, 0.34], priority: 58 },
  'urban.billboard-signage': { kinds: ['sidewalk', 'lotPad'], size: [0.24, 0.44], priority: 48 },
  'urban.bus-stop-shelter': { kinds: ['sidewalk'], size: [0.32, 0.42], priority: 62 },
  'urban.newsstand-vendor': { kinds: ['sidewalk', 'plaza'], size: [0.24, 0.38], priority: 55 },
  'urban.phone-booth': { kinds: ['sidewalk', 'plaza'], size: [0.12, 0.32], priority: 50 },
  'urban.hydrant-utility': { kinds: ['sidewalk', 'utilityEasement'], size: [0.11, 0.24], priority: 52 },
  'urban.gas-station': { kinds: ['lotPad'], size: [0.68, 0.68], priority: 72 },
  'infrastructure.cell-tower': { kinds: ['utilityEasement', 'roofTop'], size: [0.34, 0.72], priority: 68 },
  'infrastructure.power-tower': { kinds: ['utilityEasement', 'field'], size: [0.42, 0.72], priority: 69 },
  'industrial.under-construction-frame': { kinds: ['yard', 'lotPad'], size: [0.56, 0.70], priority: 70 },
  'industrial.site-structures': { kinds: ['yard'], size: [0.54, 0.54], priority: 56 },
  'industrial.harbor-shipyard': { kinds: ['dock', 'yard'], size: [0.72, 0.74], priority: 74 },
  'industrial.pipe-refinery': { kinds: ['yard', 'utilityEasement'], size: [0.64, 0.66], priority: 73 },
  'sport.volumized-stadium': { kinds: ['venue'], size: [0.82, 0.84], priority: 80 },
  'sport.field-court-kit': { kinds: ['field', 'venue'], size: [0.72, 0.74], priority: 64 },
  'sport.bleacher-terraces': { kinds: ['venue', 'field'], size: [0.64, 0.36], priority: 67 },
  'transport.airport-terminal': { kinds: ['transportApron', 'lotPad'], size: [0.82, 0.74], priority: 74 },
  'transport.train-station': { kinds: ['railPlatform', 'sidewalk'], size: [0.82, 0.70], priority: 73 },
  'civic.event-stage-podium': { kinds: ['plaza', 'venue'], size: [0.36, 0.42], priority: 54 },
  'farm.farmyard-core': { kinds: ['yard', 'field'], size: [0.58, 0.70], priority: 70 },
  'farm.tracted-field': { kinds: ['field'], size: [0.78, 0.74], priority: 52 },
};

const FAMILY_ALLOCATION_DEFAULTS = {
  building: { kinds: ['buildingMass', 'radialBuildingMass', 'facadeFace'], size: [0.48, 0.66], priority: 72 },
  facade: { kinds: ['facadeFace'], size: [0.36, 0.36], priority: 60 },
  residential: { kinds: ['lotPad', 'field'], size: [0.46, 0.46], priority: 55 },
  roof: { kinds: ['roofTop', 'facadeFace'], size: [0.42, 0.28], priority: 52 },
  urban: { kinds: ['sidewalk', 'roadPlane'], size: [0.18, 0.24], priority: 42 },
  infrastructure: { kinds: ['utilityEasement', 'field'], size: [0.28, 0.48], priority: 48 },
  civic: { kinds: ['plaza', 'field'], size: [0.24, 0.28], priority: 38 },
  industrial: { kinds: ['yard'], size: [0.42, 0.48], priority: 46 },
  sport: { kinds: ['venue', 'field'], size: [0.56, 0.56], priority: 50 },
  transport: { kinds: ['transportApron', 'railPlatform', 'lotPad'], size: [0.56, 0.50], priority: 50 },
  farm: { kinds: ['field', 'yard'], size: [0.44, 0.48], priority: 45 },
};

export function allocationRequestForConcept(conceptOrId) {
  const concept = typeof conceptOrId === 'string' ? getArchitectureGlyphConcept(conceptOrId) : conceptOrId;
  if (!concept) return null;
  const override = CONCEPT_ALLOCATION_OVERRIDES[concept.id];
  const defaults = FAMILY_ALLOCATION_DEFAULTS[concept.family] || { kinds: ['groundPlane'], size: [0.25, 0.25], priority: 10 };
  const placementKinds = concept.placement.flatMap((contract) => CONTRACT_TO_KIND[contract] || []);
  const kinds = override?.kinds || [...new Set([...placementKinds, ...defaults.kinds])];
  return {
    conceptId: concept.id,
    family: concept.family,
    label: concept.label,
    surfaceKinds: kinds,
    size: override?.size || defaults.size,
    priority: override?.priority || defaults.priority,
    anchor: override?.anchor || null,
    repeatAxis: override?.repeatAxis || null,
    axisFrame: override?.axisFrame || null,
    crosswalkPolicy: override?.crosswalkPolicy || null,
    massingKind: override?.massingKind || concept.wrapNet?.kind || null,
    wrapNet: override?.wrapNet || concept.wrapNet || null,
    parts: concept.parts,
    placementContracts: concept.placement,
  };
}

function rectArea(rect) {
  return rect.w * rect.h;
}

function overlaps(a, b, padding = 0) {
  return !(
    a.u + a.w + padding <= b.u ||
    b.u + b.w + padding <= a.u ||
    a.v + a.h + padding <= b.v ||
    b.v + b.h + padding <= a.v
  );
}

function clampSize([w, h]) {
  return [Math.max(0.04, Math.min(0.98, w)), Math.max(0.04, Math.min(0.98, h))];
}

function usedCoverage(surface, allocations) {
  const used = allocations
    .filter((allocation) => allocation.surfaceId === surface.id)
    .reduce((sum, allocation) => sum + rectArea(allocation.slot), 0);
  return used;
}

function findSlot(surface, request, allocations, { step = 0.025, padding = 0.012 } = {}) {
  const [targetW, targetH] = clampSize(request.size);
  const w = Math.min(targetW, 0.96);
  const h = Math.min(targetH, 0.96);
  const existing = allocations.filter((allocation) => allocation.surfaceId === surface.id);
  const used = usedCoverage(surface, allocations);
  if (used + w * h > surface.maxCoverage) return null;

  const anchors = request.anchor === 'base'
    ? [{ u: (1 - w) * 0.5, v: (1 - h) * 0.5 }]
    : [];
  const candidates = [];
  for (let v = 0; v <= 1 - h + 1e-9; v += step) {
    for (let u = 0; u <= 1 - w + 1e-9; u += step) {
      candidates.push({ u: Number(u.toFixed(4)), v: Number(v.toFixed(4)) });
    }
  }
  for (const pos of [...anchors, ...candidates]) {
    const slot = { u: pos.u, v: pos.v, w, h };
    if (existing.every((allocation) => !overlaps(slot, allocation.slot, padding))) {
      return slot;
    }
  }
  return null;
}

function selectSurface(request, surfaces, allocations) {
  const compatible = surfaces.filter((surface) => request.surfaceKinds.includes(surface.kind));
  compatible.sort((a, b) => {
    const ai = request.surfaceKinds.indexOf(a.kind);
    const bi = request.surfaceKinds.indexOf(b.kind);
    if (ai !== bi) return ai - bi;
    return usedCoverage(a, allocations) - usedCoverage(b, allocations);
  });
  return compatible;
}

function uniqueConceptIds(ids) {
  const seen = new Set();
  const out = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function planArchitectureMandala({
  prompt,
  conceptIds,
  seed = prompt || 'architecture-mandala',
  surfaces = createDefaultArchitectureSurfaces(),
  minReadableCoverage = 0.18,
  maxConcepts = 12,
} = {}) {
  const selectedIds = uniqueConceptIds(
    conceptIds || findArchitectureGlyphConceptsForPrompt(prompt || '', { limit: maxConcepts }).map((entry) => entry.id),
  );
  const conceptPlan = instantiateArchitectureGlyphPlan(selectedIds, { seed, limit: maxConcepts });
  const requests = conceptPlan.atoms
    .map((atom) => ({ atom, request: allocationRequestForConcept(atom.id) }))
    .filter(({ request }) => request)
    .sort((a, b) => b.request.priority - a.request.priority);

  const allocations = [];
  const unplaced = [];
  for (const { atom, request } of requests) {
    let placed = null;
    for (const surfaceCandidate of selectSurface(request, surfaces, allocations)) {
      const slot = findSlot(surfaceCandidate, request, allocations);
      if (!slot) continue;
      placed = {
        id: `${surfaceCandidate.id}/${request.conceptId}/${allocations.length}`,
        conceptId: request.conceptId,
        family: request.family,
        label: request.label,
        surfaceId: surfaceCandidate.id,
        surfaceKind: surfaceCandidate.kind,
        contract: surfaceCandidate.contract,
        slot,
        area: Number(rectArea(slot).toFixed(4)),
        priority: request.priority,
        parts: request.parts,
        parameters: atom.parameters,
        placement: atom.placement,
        axisFrame: request.axisFrame,
        crosswalkPolicy: request.crosswalkPolicy,
        massingKind: request.massingKind,
        wrapNet: request.wrapNet,
        renderHints: atom.renderHints,
      };
      allocations.push(placed);
      break;
    }
    if (!placed) {
      unplaced.push({
        conceptId: request.conceptId,
        label: request.label,
        wantedSurfaceKinds: request.surfaceKinds,
        wantedSize: { w: request.size[0], h: request.size[1] },
        reason: 'no compatible surface had enough free budget',
      });
    }
  }

  const diagnostics = diagnoseArchitectureMandala({ surfaces, allocations, unplaced, minReadableCoverage });
  return {
    plannerVersion: ARCHITECTURE_MANDALA_PLANNER_VERSION,
    seed,
    concepts: selectedIds,
    surfaces,
    allocations,
    unplaced,
    diagnostics,
  };
}

export function diagnoseArchitectureMandala({ surfaces, allocations, unplaced = [], minReadableCoverage = 0.18 }) {
  const surfaceDiagnostics = surfaces.map((surface) => {
    const surfaceAllocations = allocations.filter((allocation) => allocation.surfaceId === surface.id);
    const coverage = Number(usedCoverage(surface, allocations).toFixed(4));
    const collisions = [];
    for (let i = 0; i < surfaceAllocations.length; i += 1) {
      for (let j = i + 1; j < surfaceAllocations.length; j += 1) {
        if (overlaps(surfaceAllocations[i].slot, surfaceAllocations[j].slot, 0)) {
          collisions.push([surfaceAllocations[i].id, surfaceAllocations[j].id]);
        }
      }
    }
    return {
      surfaceId: surface.id,
      kind: surface.kind,
      coverage,
      maxCoverage: surface.maxCoverage,
      allocationCount: surfaceAllocations.length,
      underfilled: surface.kind !== 'groundPlane' && surfaceAllocations.length > 0 && coverage < minReadableCoverage,
      overBudget: coverage > surface.maxCoverage,
      collisions,
    };
  });
  const collisions = surfaceDiagnostics.flatMap((surface) =>
    surface.collisions.map(([a, b]) => ({ surfaceId: surface.surfaceId, a, b })),
  );
  const activeSurfaces = surfaceDiagnostics.filter((surface) => surface.allocationCount > 0);
  const averageActiveCoverage = activeSurfaces.length
    ? Number((activeSurfaces.reduce((sum, surface) => sum + surface.coverage, 0) / activeSurfaces.length).toFixed(4))
    : 0;
  return {
    allocationCount: allocations.length,
    unplacedCount: unplaced.length,
    collisionCount: collisions.length,
    averageActiveCoverage,
    activeSurfaceCount: activeSurfaces.length,
    underfilledSurfaces: surfaceDiagnostics.filter((surface) => surface.underfilled).map((surface) => surface.surfaceId),
    overBudgetSurfaces: surfaceDiagnostics.filter((surface) => surface.overBudget).map((surface) => surface.surfaceId),
    collisions,
    surfaces: surfaceDiagnostics,
    readable: allocations.length > 0 && unplaced.length === 0 && collisions.length === 0,
  };
}
