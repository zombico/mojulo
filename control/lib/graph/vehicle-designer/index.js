/**
 * vehicle-designer — the veh-* part shelf as ONE shelf (vehicle-designer.plan.md,
 * archived at lite-template/integration/plan-archive/).
 *
 * The registry is the orchestration seam: `VEH_ARCHETYPES` BOM rows are keyed by
 * exactly these part kinds ('veh-wheel': 4, 'veh-engine': 1, …), so an archetype
 * row is resolvable DATA — walk the bom through `resolveVehPart` and every part
 * of a build minted from one import. Future layers (VB display assembly, the VD
 * vehicle-designer catalyst) consume this surface, not the eleven files.
 */

import { resolveVehWheelRecipe, generateVehWheelVariants, listVehWheelLanguage } from './veh-wheel.js';
import { resolveVehChassisRecipe, generateVehChassisVariants, listVehChassisLanguage } from './veh-chassis.js';
import { resolveVehEngineRecipe, generateVehEngineVariants, listVehEngineLanguage } from './veh-engine.js';
import { resolveVehCabinRecipe, generateVehCabinVariants, listVehCabinLanguage } from './veh-cabin.js';
import { resolveVehSteeringRecipe, generateVehSteeringVariants, listVehSteeringLanguage } from './veh-steering.js';
import { resolveVehDashRecipe, generateVehDashVariants, listVehDashLanguage } from './veh-dash.js';
import { resolveVehBodyRecipe, generateVehBodyVariants, listVehBodyLanguage } from './veh-body.js';
import { resolveVehLightsRecipe, generateVehLightsVariants, listVehLightsLanguage } from './veh-lights.js';
import { resolveVehPayloadRecipe, generateVehPayloadVariants, listVehPayloadLanguage } from './veh-payload.js';

// kind → the proven trio. Keys match `garage.kind` and the VEH_ARCHETYPES bom rows.
export const VEH_PARTS = {
  'veh-wheel': { resolve: resolveVehWheelRecipe, variants: generateVehWheelVariants, language: listVehWheelLanguage },
  'veh-chassis': { resolve: resolveVehChassisRecipe, variants: generateVehChassisVariants, language: listVehChassisLanguage },
  'veh-engine': { resolve: resolveVehEngineRecipe, variants: generateVehEngineVariants, language: listVehEngineLanguage },
  'veh-cabin': { resolve: resolveVehCabinRecipe, variants: generateVehCabinVariants, language: listVehCabinLanguage },
  'veh-steering': { resolve: resolveVehSteeringRecipe, variants: generateVehSteeringVariants, language: listVehSteeringLanguage },
  'veh-dash': { resolve: resolveVehDashRecipe, variants: generateVehDashVariants, language: listVehDashLanguage },
  'veh-body': { resolve: resolveVehBodyRecipe, variants: generateVehBodyVariants, language: listVehBodyLanguage },
  'veh-lights': { resolve: resolveVehLightsRecipe, variants: generateVehLightsVariants, language: listVehLightsLanguage },
  'veh-payload': { resolve: resolveVehPayloadRecipe, variants: generateVehPayloadVariants, language: listVehPayloadLanguage },
};

export function resolveVehPart(kind, opts = {}) {
  const part = VEH_PARTS[kind];
  if (!part) {
    throw new Error(`Unknown veh part kind '${kind}'; expected one of: ${Object.keys(VEH_PARTS).join(', ')}`);
  }
  return part.resolve(opts);
}

export function listVehShelf() {
  return Object.fromEntries(Object.entries(VEH_PARTS).map(([kind, part]) => [kind, part.language()]));
}

// The attach contract: chassis derives sockets, parts carry hardpoints.
export { deriveAxleSockets, deriveBaySockets, planComponentFit } from './veh-garage.js';

// The archetype table + advisory BOM audit (VA layer).
export { VEH_ARCHETYPES, mapChassisStations, planAssemblyBom, planVehicleBuild } from './assembly-bom.js';

// The shared kit: six color roles, shelf-wide palettes, seeded determinism.
export { VEH_COLOR_ROLES, VEH_PALETTES } from './veh-common.js';
