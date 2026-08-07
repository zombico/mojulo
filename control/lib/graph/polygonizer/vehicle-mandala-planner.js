import {
  findVehicleGlyphConceptsForPrompt,
  getVehicleGlyphConcept,
  instantiateVehicleGlyphPlan,
} from './vehicle-glyph-registry.js';

export const VEHICLE_MANDALA_PLANNER_VERSION = '0.1.0';

export function createDefaultVehicleSurfaces() {
  return [
    surface('road.main', 'roadPlane', 'road.axis', [0.05, 0.55, 0.90, 0.18], 0.90, 'main road transport surface'),
    surface('road.service', 'roadPlane', 'road.service', [0.08, 0.74, 0.84, 0.10], 0.82, 'service road or depot lane'),
    surface('rail.main', 'railPlane', 'rail.axis', [0.06, 0.45, 0.88, 0.12], 0.90, 'main track support'),
    surface('rail.yard', 'railPlane', 'rail.yard', [0.08, 0.33, 0.84, 0.09], 0.78, 'yard track support'),
    surface('platform.edge', 'platformEdge', 'rail.platform', [0.06, 0.58, 0.42, 0.08], 0.70, 'platform-edge support for station vehicles'),
    surface('yard.pad', 'yardPad', 'yard.pad', [0.52, 0.62, 0.40, 0.18], 0.75, 'yard/depot parking allocation'),
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

const CONCEPT_ALLOCATION_OVERRIDES = {
  'vehicle.chassis.grounded-manji': {
    kinds: ['roadPlane', 'railPlane', 'yardPad'],
    size: [0.34, 0.24],
    priority: 55,
  },
  'vehicle.rectangular-wheeled.payload': {
    kinds: ['roadPlane', 'railPlane', 'platformEdge'],
    size: [0.44, 0.28],
    priority: 72,
  },
  'vehicle.bus.side-slab': {
    kinds: ['roadPlane', 'yardPad'],
    size: [0.48, 0.32],
    priority: 80,
  },
  'vehicle.truck.long-haul': {
    kinds: ['roadPlane', 'yardPad'],
    size: [0.58, 0.34],
    priority: 84,
  },
};

const FAMILY_ALLOCATION_DEFAULTS = {
  chassis: { kinds: ['roadPlane', 'railPlane'], size: [0.30, 0.22], priority: 48 },
  'rectangular-vehicle': { kinds: ['roadPlane', 'railPlane', 'platformEdge'], size: [0.42, 0.26], priority: 68 },
  bus: { kinds: ['roadPlane'], size: [0.44, 0.30], priority: 74 },
  truck: { kinds: ['roadPlane', 'yardPad'], size: [0.54, 0.32], priority: 78 },
};

export function allocationRequestForVehicleConcept(conceptOrId) {
  const concept = typeof conceptOrId === 'string' ? getVehicleGlyphConcept(conceptOrId) : conceptOrId;
  if (!concept) return null;
  const override = CONCEPT_ALLOCATION_OVERRIDES[concept.id];
  const defaults = FAMILY_ALLOCATION_DEFAULTS[concept.family] || {
    kinds: ['roadPlane'],
    size: [0.30, 0.22],
    priority: 40,
  };

  return {
    conceptId: concept.id,
    family: concept.family,
    label: concept.label,
    surfaceKinds: override?.kinds || defaults.kinds,
    size: override?.size || defaults.size,
    priority: override?.priority || defaults.priority,
    parts: concept.parts,
  };
}

function clampSize([w, h]) {
  return [Math.max(0.05, Math.min(0.98, w)), Math.max(0.05, Math.min(0.98, h))];
}

function rectArea(rect) {
  return rect.w * rect.h;
}

function overlaps(a, b, padding = 0) {
  return !(
    a.u + a.w + padding <= b.u
    || b.u + b.w + padding <= a.u
    || a.v + a.h + padding <= b.v
    || b.v + b.h + padding <= a.v
  );
}

function usedCoverage(surface, allocations) {
  return allocations
    .filter((allocation) => allocation.surfaceId === surface.id)
    .reduce((sum, allocation) => sum + rectArea(allocation.slot), 0);
}

function findSlot(surface, request, allocations, { step = 0.025, padding = 0.012 } = {}) {
  const [targetW, targetH] = clampSize(request.size);
  const w = Math.min(targetW, 0.96);
  const h = Math.min(targetH, 0.96);
  const existing = allocations.filter((allocation) => allocation.surfaceId === surface.id);
  const used = usedCoverage(surface, allocations);
  if (used + w * h > surface.maxCoverage) return null;

  const candidates = [];
  for (let v = 0; v <= 1 - h + 1e-9; v += step) {
    for (let u = 0; u <= 1 - w + 1e-9; u += step) {
      candidates.push({ u: Number(u.toFixed(4)), v: Number(v.toFixed(4)) });
    }
  }
  for (const pos of candidates) {
    const slot = { u: pos.u, v: pos.v, w, h };
    if (existing.every((allocation) => !overlaps(slot, allocation.slot, padding))) {
      return slot;
    }
  }
  return null;
}

function selectSurface(request, surfaces, allocations) {
  const compatible = surfaces.filter((surfaceDef) => request.surfaceKinds.includes(surfaceDef.kind));
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

export function planVehicleMandala({
  prompt,
  conceptIds,
  seed = prompt || 'vehicle-mandala',
  surfaces = createDefaultVehicleSurfaces(),
  minReadableCoverage = 0.12,
  maxConcepts = 6,
} = {}) {
  const selectedIds = uniqueConceptIds(
    conceptIds || findVehicleGlyphConceptsForPrompt(prompt || '', { limit: maxConcepts }).map((entry) => entry.id),
  );
  const plans = selectedIds
    .map((id, index) => instantiateVehicleGlyphPlan(id, { seed, variant: index }))
    .filter(Boolean);
  const requests = plans
    .map((plan) => ({ plan, request: allocationRequestForVehicleConcept(plan.conceptId) }))
    .filter(({ request }) => request)
    .sort((a, b) => b.request.priority - a.request.priority);

  const allocations = [];
  const unplaced = [];
  for (const { plan, request } of requests) {
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
        parameters: plan.parameters,
        placement: plan.placement,
        renderHints: plan.renderHints,
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

  const diagnostics = diagnoseVehicleMandala({ surfaces, allocations, unplaced, minReadableCoverage });
  return {
    plannerVersion: VEHICLE_MANDALA_PLANNER_VERSION,
    seed,
    concepts: selectedIds,
    surfaces,
    allocations,
    unplaced,
    diagnostics,
  };
}

export function diagnoseVehicleMandala({ surfaces, allocations, unplaced = [], minReadableCoverage = 0.12 }) {
  const surfaceDiagnostics = surfaces.map((surfaceDef) => {
    const surfaceAllocations = allocations.filter((allocation) => allocation.surfaceId === surfaceDef.id);
    const coverage = Number(usedCoverage(surfaceDef, allocations).toFixed(4));
    const collisions = [];
    for (let i = 0; i < surfaceAllocations.length; i += 1) {
      for (let j = i + 1; j < surfaceAllocations.length; j += 1) {
        if (overlaps(surfaceAllocations[i].slot, surfaceAllocations[j].slot, 0)) {
          collisions.push([surfaceAllocations[i].id, surfaceAllocations[j].id]);
        }
      }
    }
    return {
      surfaceId: surfaceDef.id,
      kind: surfaceDef.kind,
      coverage,
      maxCoverage: surfaceDef.maxCoverage,
      allocationCount: surfaceAllocations.length,
      underfilled: surfaceAllocations.length > 0 && coverage < minReadableCoverage,
      overBudget: coverage > surfaceDef.maxCoverage,
      collisions,
    };
  });
  const collisions = surfaceDiagnostics.flatMap((surfaceDef) =>
    surfaceDef.collisions.map(([a, b]) => ({ surfaceId: surfaceDef.surfaceId, a, b })),
  );
  const activeSurfaces = surfaceDiagnostics.filter((surfaceDef) => surfaceDef.allocationCount > 0);
  const averageActiveCoverage = activeSurfaces.length
    ? Number((activeSurfaces.reduce((sum, surfaceDef) => sum + surfaceDef.coverage, 0) / activeSurfaces.length).toFixed(4))
    : 0;
  return {
    allocationCount: allocations.length,
    unplacedCount: unplaced.length,
    collisionCount: collisions.length,
    averageActiveCoverage,
    activeSurfaceCount: activeSurfaces.length,
    underfilledSurfaces: surfaceDiagnostics.filter((surfaceDef) => surfaceDef.underfilled).map((surfaceDef) => surfaceDef.surfaceId),
    overBudgetSurfaces: surfaceDiagnostics.filter((surfaceDef) => surfaceDef.overBudget).map((surfaceDef) => surfaceDef.surfaceId),
    collisions,
    surfaces: surfaceDiagnostics,
    readable: allocations.length > 0 && unplaced.length === 0 && collisions.length === 0,
  };
}
