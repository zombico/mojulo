/**
 * veh-payload — composable, seeded payload-module recipes for the vehicle
 * designer (vehicle-designer.plan.md V5). THE module that turns one
 * cab+ladder build into the whole truck family: bed, flatbed, box, or tow
 * boom behind the same cab.
 *
 * The pickup bed is a single shell extrude (wallThickness + open top);
 * the flatbed is a deck + headboard; the box is a tall solid; the tow rig
 * is a raked boom sweep with a winch drum.
 *
 * Local frame: +y forward, +z up. The MOUNT is the origin — the point that
 * lands on the chassis `rearDeck` socket (the rear axle at deck height).
 * Geometry spans forward and back of the mount to fill cab-to-tail.
 */

import {
  VEH_COLOR_ROLES,
  VEH_PALETTES,
  clone,
  hashSeed,
  mulberry32,
  pick,
  resolvePalette,
  round3,
} from './veh-common.js';

export const VEH_PAYLOAD_FAMILIES = {
  pickupBed: { form: 'bed', length: 'standard' },
  flatbedDeck: { form: 'flat', length: 'long' },
  boxVan: { form: 'box', length: 'long' },
  towBoom: { form: 'boom', length: 'standard' },
};

export const VEH_PAYLOAD_MODULES = {
  form: ['bed', 'flat', 'box', 'boom'],
  length: ['standard', 'long'],
};

const FAMILY_IDS = Object.keys(VEH_PAYLOAD_FAMILIES);
const PALETTE_IDS = Object.keys(VEH_PALETTES);
const LENGTHS = { standard: 4.2, long: 5.0 };

function randomModules(base, rng, opts = {}) {
  const modules = { ...base };
  if (!opts.family) modules.form = pick(rng, VEH_PAYLOAD_MODULES.form);
  modules.length = pick(rng, VEH_PAYLOAD_MODULES.length);
  return modules;
}

const xyRect = (hw, y0, y1) => ({ points: [[-hw, y0], [hw, y0], [hw, y1], [-hw, y1]].map(([x, y]) => [round3(x), round3(y)]) });

/**
 * Resolve a seeded payload recipe. Options mirror the veh-* shelf:
 * `family` (pickupBed, flatbedDeck, boxVan, towBoom), `palette`, `colors`,
 * `seed`, `overrides`, `randomize`, `title`.
 */
export function resolveVehPayloadRecipe({ family, palette, colors = {}, seed = 1, overrides = {}, randomize = false, title } = {}) {
  const seedInt = hashSeed(seed, 'veh-payload');
  const rng = mulberry32(seedInt);
  const pickedFamily = family || pick(rng, FAMILY_IDS);
  const base = VEH_PAYLOAD_FAMILIES[pickedFamily];
  if (!base) throw new Error(`Unknown veh-payload family '${pickedFamily}' - expected one of: ${FAMILY_IDS.join(', ')}`);
  const defaultPaletteId = pick(rng, PALETTE_IDS);
  const { id: paletteId, colors: C } = resolvePalette(palette, colors, defaultPaletteId, 'veh-payload');
  const modules = { ...(randomize ? randomModules(base, rng, { family }) : base), ...overrides };
  const L = LENGTHS[modules.length];
  const yFront = L * 0.55; // forward of the rear axle, toward the cab
  const yRear = yFront - L;
  const hw = 2.3;
  const extrudes = [];
  const lathes = [];
  const sweeps = [];
  if (modules.form === 'bed') {
    // shell extrudes take rect profiles only — center the axis on the bed
    extrudes.push({
      id: 'bed_shell',
      axisFrom: { x: 0, y: round3((yFront + yRear) / 2), z: 0 },
      axisTo: { x: 0, y: round3((yFront + yRear) / 2), z: 1.15 },
      profile: { rect: { w: round3(hw * 2), h: round3(L), r: 0.06 } },
      wallThickness: 0.15,
      innerTint: C.trim,
      openFace: 'to',
      tint: C.paint,
    });
  } else if (modules.form === 'flat') {
    extrudes.push({ id: 'flat_deck', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 0.22 }, profile: xyRect(hw + 0.1, yRear, yFront), tint: C.trim });
    extrudes.push({ id: 'headboard', axisFrom: { x: 0, y: 0, z: 0.22 }, axisTo: { x: 0, y: 0, z: 1.4 }, profile: xyRect(hw + 0.1, yFront - 0.18, yFront), tint: C.trim });
  } else if (modules.form === 'box') {
    extrudes.push({ id: 'cargo_box', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 2.9 }, profile: xyRect(hw + 0.15, yRear, yFront), tint: C.paint });
  } else {
    extrudes.push({ id: 'boom_base', axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 0.5 }, profile: xyRect(hw - 0.6, yRear + 0.5, yFront), tint: C.trim });
    sweeps.push({ id: 'tow_boom', path: [[0, yFront - 0.6, 0.5], [0, yRear + 0.2, 1.9], [0, yRear - 0.7, 1.6]].map((p) => p.map(round3)), radius: 0.16, tint: C.paint, sides: 10 });
    lathes.push({
      id: 'winch_drum',
      axisFrom: { x: -0.45, y: round3(yRear + 0.5), z: 1.75 },
      axisTo: { x: 0.45, y: round3(yRear + 0.5), z: 1.75 },
      profile: [
        { t: 0, radius: 0.05 }, { t: 0.15, radius: 0.24 }, { t: 0.85, radius: 0.24 }, { t: 1, radius: 0.05 },
      ],
      tint: C.chrome,
    });
  }
  return {
    kind: 'workbench',
    title: title || `veh-payload ${pickedFamily} ${paletteId} seed ${seed}`,
    units: 'cm',
    ...(lathes.length ? { lathes } : {}),
    extrudes,
    ...(sweeps.length ? { sweeps } : {}),
    garage: {
      kind: 'veh-payload',
      family: pickedFamily,
      palette: paletteId,
      colors: clone(C),
      seed: seedInt,
      randomize: Boolean(randomize),
      modules: clone(modules),
      dims: { length: round3(L), width: round3(hw * 2), height: modules.form === 'box' ? 2.9 : modules.form === 'boom' ? 1.9 : 1.4 },
      localFrame: { forward: '+y', up: '+z' },
      mountFamily: 'rear-mount',
      hardpoints: { mount: [0, 0, 0] },
    },
  };
}

export function generateVehPayloadVariants({ count = 4, seed = 'veh-payload', family, palette, colors, overrides = {}, randomize = true } = {}) {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => resolveVehPayloadRecipe({
    family, palette, colors, overrides, randomize, seed: `${seed}:${i}`,
  }));
}

export function listVehPayloadLanguage() {
  return {
    families: clone(VEH_PAYLOAD_FAMILIES),
    palettes: clone(VEH_PALETTES),
    colorRoles: [...VEH_COLOR_ROLES],
    modules: clone(VEH_PAYLOAD_MODULES),
  };
}
