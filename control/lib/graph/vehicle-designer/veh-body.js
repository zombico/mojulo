/**
 * veh-body — composable, seeded body-shell recipes for the vehicle designer
 * (vehicle-designer.plan.md V5, the display-mode workhorse).
 *
 * The shell is composed from CONVEX x-axis extrudes: nose/mid/tail clips
 * below the beltline, chamfer-cornered fender bands over the wheel arches,
 * a glass greenhouse prism, a roof cap, and chrome bumpers. Convexity is a
 * shelf rule proven by probe: a concave profile (a notched silhouette)
 * renders its arch walls but DROPS its end-cap faces — the transparent-side
 * failure. Arches are therefore rectangular openings with 45° chamfered
 * tops between convex pieces.
 *
 * Local frame: +y forward, +z up. The shell SUPERPOSES at [0,0,0] over a
 * matching-wheelbase chassis (it bridges over the internals like the
 * chariot bed); it has no mountFamily. Arch centers sit at ±wheelbase/2 so
 * seated wheels land in the openings; the sill (z=1.45) clears the deck and
 * the beltline (z=2.95) clears a dressed engine (top ≈2.9).
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

export const VEH_BODY_FAMILIES = {
  sedanThree: { boxCount: 'three', wheelbase: 'standard', roofline: 'standard', bumpers: 'chrome', glasshouse: 'glassy' },
  coupeThree: { boxCount: 'three', wheelbase: 'short', roofline: 'low', bumpers: 'chrome', glasshouse: 'glassy' },
  wagonTwo: { boxCount: 'two', wheelbase: 'standard', roofline: 'standard', bumpers: 'chrome', glasshouse: 'glassy' },
  vanOne: { boxCount: 'one', wheelbase: 'long', roofline: 'standard', bumpers: 'none', glasshouse: 'panel' },
  truckCab: { boxCount: 'cab', wheelbase: 'long', roofline: 'standard', bumpers: 'chrome', glasshouse: 'glassy' },
  // the modern register: raked pentagon nose + body-color fascia (bumpers:'body')
  fastbackEV: { boxCount: 'fastback', wheelbase: 'standard', roofline: 'standard', bumpers: 'body', glasshouse: 'glassy', surface: 'slab' },
  crossoverTwo: { boxCount: 'two', wheelbase: 'standard', roofline: 'standard', bumpers: 'body', glasshouse: 'glassy', surface: 'slab' },
  // the curved register — the old vehicle-swept-net superellipse skin,
  // rebuilt from workbench monomers: harmonic lathes over the convex slabs
  sleekEV: { boxCount: 'fastback', wheelbase: 'standard', roofline: 'standard', bumpers: 'body', glasshouse: 'glassy', surface: 'sculpted' },
};

export const VEH_BODY_MODULES = {
  boxCount: ['three', 'two', 'one', 'cab', 'fastback'],
  wheelbase: ['short', 'standard', 'long'],
  roofline: ['standard', 'low'],
  bumpers: ['chrome', 'body', 'none'],
  glasshouse: ['glassy', 'panel'],
  surface: ['slab', 'sculpted'],
};

const FAMILY_IDS = Object.keys(VEH_BODY_FAMILIES);
const PALETTE_IDS = Object.keys(VEH_PALETTES);
const WHEELBASES = { short: 6.5, standard: 8.0, long: 9.5 };

const SILL_Z = 1.45;
const BELT_Z = 2.95;
const ARCH_TOP_Z = 2.2;
const ARCH_HW = 1.25; // arch half-width along y
const BODY_HW = 2.7; // half-width across x
const GH_HW = 2.35;

function randomModules(base, rng, opts = {}) {
  const modules = { ...base };
  if (!opts.family) modules.boxCount = pick(rng, VEH_BODY_MODULES.boxCount);
  modules.wheelbase = pick(rng, VEH_BODY_MODULES.wheelbase);
  modules.roofline = pick(rng, VEH_BODY_MODULES.roofline);
  modules.bumpers = pick(rng, VEH_BODY_MODULES.bumpers);
  modules.glasshouse = pick(rng, VEH_BODY_MODULES.glasshouse);
  return modules;
}

function extrudeX(id, x0, x1, points, tint) {
  return {
    id,
    axisFrom: { x: round3(x0), y: 0, z: 0 },
    axisTo: { x: round3(x1), y: 0, z: 0 },
    profile: { points: points.map(([y, z]) => [round3(y), round3(z)]) },
    tint,
  };
}

function extrudeZ(id, z0, z1, points, tint) {
  return {
    id,
    axisFrom: { x: 0, y: 0, z: round3(z0) },
    axisTo: { x: 0, y: 0, z: round3(z1) },
    profile: { points: points.map(([x, y]) => [round3(x), round3(y)]) },
    tint,
  };
}

const rectYZ = (y0, y1, z0, z1) => [[y0, z0], [y1, z0], [y1, z1], [y0, z1]];

// The fender band over an arch: a convex hexagon — rectangle with its two
// bottom corners chamfered, so the arch opening below gets a 45° top.
function fenderBand(y0, y1) {
  const cham = 0.45;
  return [
    [y0, BELT_Z], [y0, ARCH_TOP_Z + cham], [y0 + cham, ARCH_TOP_Z],
    [y1 - cham, ARCH_TOP_Z], [y1, ARCH_TOP_Z + cham], [y1, BELT_Z],
  ].reverse(); // keep winding consistent with rectYZ
}

/**
 * Resolve a seeded body-shell recipe. Options mirror the veh-* shelf:
 * `family` (sedanThree, coupeThree, wagonTwo, vanOne, truckCab), `palette`,
 * `colors`, `seed`, `overrides`, `randomize`, `title`.
 */
export function resolveVehBodyRecipe({ family, palette, colors = {}, seed = 1, overrides = {}, randomize = false, title } = {}) {
  const seedInt = hashSeed(seed, 'veh-body');
  const rng = mulberry32(seedInt);
  const pickedFamily = family || pick(rng, FAMILY_IDS);
  const base = VEH_BODY_FAMILIES[pickedFamily];
  if (!base) throw new Error(`Unknown veh-body family '${pickedFamily}' - expected one of: ${FAMILY_IDS.join(', ')}`);
  const defaultPaletteId = pick(rng, PALETTE_IDS);
  const { id: paletteId, colors: C } = resolvePalette(palette, colors, defaultPaletteId, 'veh-body');
  const modules = { surface: 'slab', ...(randomize ? randomModules(base, rng, { family }) : base), ...overrides };
  const wb = WHEELBASES[modules.wheelbase];
  const cab = modules.boxCount === 'cab';
  const frontArch = [wb / 2 - ARCH_HW, wb / 2 + ARCH_HW];
  const rearArch = [-wb / 2 - ARCH_HW, -wb / 2 + ARCH_HW];
  const noseY = wb / 2 + ARCH_HW + 0.65;
  const tailY = cab ? -0.7 : -(wb / 2 + ARCH_HW + 0.65);
  const roofZ = modules.roofline === 'low' ? 3.9 : 4.2;
  const ghTint = modules.glasshouse === 'panel' ? C.paint : C.glass;

  // bumpers:'body' is the modern register: raked pentagon nose (hood rises
  // into the windshield, fascia is body color) instead of a flat face + chrome
  const modern = modules.bumpers === 'body';
  const noseProfile = modern
    ? [[frontArch[1], SILL_Z], [noseY, SILL_Z], [noseY, 2.5], [noseY - 0.55, BELT_Z], [frontArch[1], BELT_Z]]
    : rectYZ(frontArch[1], noseY, SILL_Z, BELT_Z);
  const extrudes = [
    extrudeX('nose_clip', -BODY_HW, BODY_HW, noseProfile, C.paint),
    extrudeX('fender_band_front', -BODY_HW, BODY_HW, fenderBand(frontArch[0], frontArch[1]), C.paint),
    extrudeX('mid_clip', -BODY_HW, BODY_HW, rectYZ(cab ? tailY : rearArch[1], frontArch[0], SILL_Z, BELT_Z), C.paint),
  ];
  if (!cab) {
    extrudes.push(
      extrudeX('fender_band_rear', -BODY_HW, BODY_HW, fenderBand(rearArch[0], rearArch[1]), C.paint),
      extrudeX('tail_clip', -BODY_HW, BODY_HW, rectYZ(tailY, rearArch[0], SILL_Z, BELT_Z), C.paint),
    );
  }
  // greenhouse span by box count; fastback trades roof length for one long
  // rear rake flowing almost to the tail — the modern silhouette
  const ghRoofZ = modules.boxCount === 'fastback' ? roofZ - 0.15 : roofZ;
  const gh = {
    three: { rear: -wb * 0.36, front: wb * 0.32, rakeF: 1.0, rakeR: 0.5 },
    two: { rear: tailY + 0.3, front: wb * 0.32, rakeF: 1.0, rakeR: 0.2 },
    one: { rear: tailY + 0.3, front: noseY - 0.1, rakeF: 1.1, rakeR: 0.2 },
    cab: { rear: tailY + 0.15, front: wb * 0.32, rakeF: 0.9, rakeR: 0.1 },
    fastback: { rear: tailY + 0.9, front: wb * 0.32, rakeF: 1.16, rakeR: wb * 0.245 },
  }[modules.boxCount];
  const lathes = [];
  const sculpted = modules.surface === 'sculpted';
  if (sculpted) {
    // The curved register: a self-closing y-axis lathe with 2-fold harmonics
    // is the workbench-native superellipse sweep (the old swept-net skin).
    // Canopy replaces the greenhouse prism + roof cap; nose dome and fender
    // blisters layer curvature over the convex slabs (the overlap idiom).
    const sweptLathe = (id, y0, y1, z, profile, amp, tint) => ({
      id,
      axisFrom: { x: 0, y: round3(y0), z: round3(z) },
      axisTo: { x: 0, y: round3(y1), z: round3(z) },
      profile: profile.map(({ t, radius }) => ({ t: round3(t), radius: round3(radius) })),
      // the lathe's angular origin points up (+z), so phase π puts the
      // 2-fold bulge horizontal: wide-and-low superellipse-ish sections
      harmonics: [{ n: 2, amplitude: round3(amp), phase: round3(Math.PI) }],
      tint,
    });
    lathes.push(sweptLathe('canopy', gh.rear, gh.front, BELT_Z, [
      { t: 0, radius: 0.05 }, { t: 0.18, radius: 1.0 }, { t: 0.55, radius: 1.25 }, { t: 0.85, radius: 1.0 }, { t: 1, radius: 0.05 },
    ], 0.42, ghTint));
    // nose = a plain x-axis BULLNOSE bar (no harmonics — a harmonic tip
    // self-closes into a pinched rosette head-on); rounded at both ends
    lathes.push({
      id: 'nose_bullnose',
      axisFrom: { x: -(BODY_HW - 0.55), y: round3(noseY - 0.05), z: 2.6 },
      axisTo: { x: BODY_HW - 0.55, y: round3(noseY - 0.05), z: 2.6 },
      profile: [
        { t: 0, radius: 0.05 }, { t: 0.06, radius: 0.38 }, { t: 0.94, radius: 0.38 }, { t: 1, radius: 0.05 },
      ],
      tint: C.paint,
    });
    // Harmonics are ADDITIVE: at a tapered end 0.05±amp goes negative and
    // tears the tip open (the validator's open-shell warning on these two
    // is cosmetic once plugged). Plain round PLUGS close the ends — the
    // overlap idiom, not caps.
    const plug = (id, yc, z, r, tint) => ({
      id,
      axisFrom: { x: 0, y: round3(yc - 0.3), z: round3(z) },
      axisTo: { x: 0, y: round3(yc + 0.3), z: round3(z) },
      profile: [{ t: 0, radius: 0.05 }, { t: 0.5, radius: r }, { t: 1, radius: 0.05 }],
      tint,
    });
    lathes.push(plug('canopy_plug_rear', gh.rear + 0.3, BELT_Z, 0.78, ghTint));
    lathes.push(plug('canopy_plug_front', gh.front - 0.3, BELT_Z, 0.78, ghTint));
    const blister = (id, y0, y1, sideSign) => ({
      id,
      // half-buried in the belt corner so it reads as a fender bulge, not a pod
      axisFrom: { x: round3(sideSign * (BODY_HW - 0.18)), y: round3(y0), z: 2.62 },
      axisTo: { x: round3(sideSign * (BODY_HW - 0.18)), y: round3(y1), z: 2.62 },
      profile: [{ t: 0, radius: 0.05 }, { t: 0.25, radius: 0.42 }, { t: 0.75, radius: 0.42 }, { t: 1, radius: 0.05 }],
      tint: C.paint,
    });
    lathes.push(blister('fender_blister_fa', frontArch[0], frontArch[1], -1));
    lathes.push(blister('fender_blister_fb', frontArch[0], frontArch[1], 1));
    if (!cab) {
      lathes.push(blister('fender_blister_ra', rearArch[0], rearArch[1], -1));
      lathes.push(blister('fender_blister_rb', rearArch[0], rearArch[1], 1));
    }
  } else {
    extrudes.push(extrudeX('greenhouse', -GH_HW, GH_HW, [
      [gh.rear, BELT_Z], [gh.front, BELT_Z], [gh.front - gh.rakeF, ghRoofZ], [gh.rear + gh.rakeR, ghRoofZ],
    ], ghTint));
    extrudes.push(extrudeZ('roof_cap', ghRoofZ, ghRoofZ + 0.12, [
      [-GH_HW + 0.1, gh.rear + gh.rakeR], [GH_HW - 0.1, gh.rear + gh.rakeR],
      [GH_HW - 0.1, gh.front - gh.rakeF], [-GH_HW + 0.1, gh.front - gh.rakeF],
    ], C.paint));
  }
  if (modules.bumpers === 'chrome') {
    extrudes.push(extrudeX('bumper_front', -BODY_HW + 0.25, BODY_HW - 0.25, rectYZ(noseY, noseY + 0.22, 1.7, 2.05), C.chrome));
    if (!cab) extrudes.push(extrudeX('bumper_rear', -BODY_HW + 0.25, BODY_HW - 0.25, rectYZ(tailY - 0.22, tailY, 1.7, 2.05), C.chrome));
  } else if (modern) {
    extrudes.push(extrudeX('fascia_front', -BODY_HW + 0.1, BODY_HW - 0.1, rectYZ(noseY, noseY + 0.16, 1.55, 2.35), C.paint));
    if (!cab) extrudes.push(extrudeX('fascia_rear', -BODY_HW + 0.1, BODY_HW - 0.1, rectYZ(tailY - 0.16, tailY, 1.55, 2.35), C.paint));
  }
  return {
    kind: 'workbench',
    title: title || `veh-body ${pickedFamily} ${paletteId} seed ${seed}`,
    units: 'cm',
    ...(lathes.length ? { lathes } : {}),
    extrudes,
    garage: {
      kind: 'veh-body',
      family: pickedFamily,
      palette: paletteId,
      colors: clone(C),
      seed: seedInt,
      randomize: Boolean(randomize),
      modules: clone(modules),
      dims: {
        length: round3(noseY - tailY),
        width: BODY_HW * 2,
        beltZ: BELT_Z,
        roofZ: round3(roofZ),
        sillZ: SILL_Z,
        fitsWheelbase: modules.wheelbase,
        archCenters: [round3(wb / 2), cab ? null : round3(-wb / 2)],
      },
      localFrame: { forward: '+y', up: '+z' },
      mountFamily: null, // the shell SUPERPOSES at [0,0,0] over a matching chassis
      hardpoints: {
        // modern fascias are proud of the nose/tail; lamps sit on the fascia face
        headlightMount: [0, round3(noseY + (modern ? 0.18 : 0.02)), modern ? 2.42 : 2.5],
        taillightMount: [0, round3(tailY - (modern ? 0.18 : 0.02)), modern ? 2.42 : 2.5],
      },
    },
  };
}

export function generateVehBodyVariants({ count = 4, seed = 'veh-body', family, palette, colors, overrides = {}, randomize = true } = {}) {
  const n = Math.max(1, Math.floor(count));
  return Array.from({ length: n }, (_, i) => resolveVehBodyRecipe({
    family, palette, colors, overrides, randomize, seed: `${seed}:${i}`,
  }));
}

export function listVehBodyLanguage() {
  return {
    families: clone(VEH_BODY_FAMILIES),
    palettes: clone(VEH_PALETTES),
    colorRoles: [...VEH_COLOR_ROLES],
    modules: clone(VEH_BODY_MODULES),
  };
}
