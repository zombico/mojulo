/**
 * The BAY KITS (era/bay.js, the bay shell): one shell, three REGISTERS, each the same parts laid in its own materials,
 * colours and light. A register is what a modern interior says it is for:
 *
 *   military   a hangar, an armoury, a bunker: steel plate or board-formed concrete over a dark kick band, corrugated
 *              crowns, a dark epoxy floor with grating at the walls; signal orange the secondary paint; cool strips and
 *              white lamps, a warm red-orange cove and amber signals; I-beams, trusses or a vault; braced
 *   utility    a warehouse, a plant room, a depot: concrete block or standing-seam cladding, yellow steel pilasters,
 *              a sealed concrete floor or scored slabs; safety green the secondary paint, blue the services; white lamps
 *              with sodium amber; trusses, a sawtooth of north lights or beams; braced
 *   science    a lab, a clean corridor, a control room: white panels or glazed tile over a teal base band (or carbon
 *              fibre), a pale poured floor, terrazzo or studded rubber, carbon or matte white cabinets; deep blue the
 *              secondary paint; cold white with teal coves; a coffered ceiling, beams or north lights
 *   everyday   an office, a school, a clinic, a shop floor, a big-box store: painted drywall, wood veneer or painted
 *              block over a rubber base, carpet tile, vinyl tile, porcelain or laminate underfoot, a lay-in acoustic
 *              ceiling or a drywall one; a muted teal the secondary paint on the frames and rails; neutral white light,
 *              warm downlights and coves, a green exit sign over each door. The shell turned down (its `shell`): a slim
 *              base and pilaster, no grating band, no pad, no crane, no bracing
 *
 * Each card is the stage's kit card (era/stage.js STAGE_KITS) with `shell: 'bay'`: the tiles (the made class's dressed
 * cuts, matte-paint/dressed.js, at the metres they are laid at), the tints (each surface's value band), the cells, and
 * `B`, the shell's numbers (era/bay.js; a register's `shell` overrides a part of them), its lights (the key and the SECONDARY: a register's signal colour), the
 * alternates a room may take for a surface (`options`, by its dice), the roof systems it builds (`roofs`), whether it
 * braces and whether a tall room takes a crane (`craned`). The made cuts include the coats (matte powder coat, carbon
 * fibre) and the everyday (drywall, carpet, vinyl, laminate, porcelain, veneer). `reference` is the sixth-gen look the
 * stage defaults to for the kit's light, `ambient` a register's own air over it.
 */
import { tileFamilyOf } from '../tile-specs.js';

const CABLE = [0.07, 0.07, 0.08];
// (a coat with nothing showing through it, matte or carbon, takes its own colour for `mortar`)
const dressed = (spec, metres) => ({ family: tileFamilyOf({ gen: 'dressed', mortar: spec.stone, ...spec, scale: metres }, 'bay kit'), scale: metres, variants: 2 });

// the shell's numbers, the same in every register
const SHELL = Object.freeze({
  base: { h: 1.2, out: 0.08 },
  crown: { h: 0.9, out: 0.14 },
  pilaster: { w: 0.6, out: 0.42, foot: 0.9, strip: { w: 0.09, z0: 0.9, len: 3.2, every: 1 } },
  door: { frame: 0.32, out: 0.16, sill: 0.35 },
  floor: { minSpan: 6, band: 0.8, hazard: 0.16 },
  inset: { w: 0.14, l: 0.36 },
  pad: { minSpan: 10, share: 0.42, line: 0.3 },
  beam: { perSpan: 0.065, min: 0.6, max: 1.3, w: 0.42, web: 0.07, flange: 0.07 },
  truss: { perSpan: 0.09, min: 1.1, max: 2.2, w: 0.3, chord: 0.18, r: 0.06 },
  vault: { rise: 0.24, least: 7, seg: 14, rib: 0.16, tie: 0.03 },
  sawtooth: { h: 2.6, beam: 0.5 },
  coffer: { cell: 3, rib: 0.6, w: 0.28, lamp: 0.7 },
  duct: { at: [0.2], r: 0.36, sides: 10, gap: 0.15 },
  highbay: { min: 6.5 },
  ceilingStrip: { share: 0.55, w: 0.11, h: 0.08 },
  pipes: { off: 0.45, gap: 0.26, drop: 0.35, r: [0.09, 0.06] },
  brace: { off: 0.12, r: 0.045 },
  cove: { every: 1 },
  crane: { min: 9, minSpan: 9, below: 1.2, rail: { w: 0.32, h: 0.42 }, girder: { w: 0.9, h: 1.0 }, hook: { least: 3.4, share: 0.42, h: 0.5 } },
  // (the walkway's rules: an entry at least `entry` wide, a stair at each end from `twoStairs` long where `clear` is left
  // in the room past the second stair, the infill from just over the deck to the top rail, covering at least `shin`)
  catwalk: { min: 7.5, z: 4.2, d: 1.4, fascia: 0.22, rise: 0.19, going: 0.27, post: 1.5, rail: 1.1, infill: [0.06, 1.04], shin: [0.3, 0.9],
    nosing: 0.05, entry: 0.9, width: 1.2, twoStairs: 14, clear: 3, downEvery: 3, landing: 1.8 },
  // the services (era/bay.js): an electrical box every `every` bays on a long wall, its conduit up to the crown; a breaker
  // panel by each doorway; cables slung `sag` under hooks `hook.drop` below the crown; a low room's one panel out of the
  // soffit (`hole`: its size, the plenum's depth over it, the panel hung `hang` radians off its hinge, the wiring's droop)
  services: { every: 2, box: { w: 0.4, h: 0.5, d: 0.16, z: 1.5, inset: 0.35 }, conduit: { r: 0.025, off: 0.06 }, panel: { w: 0.7, h: 1.1, d: 0.22, z: 0.9, gap: 0.4 },
    hook: { drop: 0.25 }, cables: [0.022, 0.018, 0.026], sag: 0.28, indicator: '#40ff80', plenum: [0.06, 0.06, 0.07],
    hole: { l: 1.2, w: 0.6, plenum: 0.5, hang: 1.1, droop: 0.6 } },
  // the hazard stripe's most share of the floor and walls (bayLaws `accent`)
  accent: 0.12,
});

const REGISTERS = {
  military: {
    tiles: {
      floor: dressed({ cut: 'epoxy', face: 'floor', stone: [70, 78, 86], mortar: [28, 30, 33], cols: 1, grit: 0.55 }, 6),
      floor2: dressed({ cut: 'epoxy', face: 'floor', stone: [64, 72, 64], mortar: [28, 30, 28], cols: 1, grit: 0.7 }, 6),
      band: dressed({ cut: 'grating', face: 'floor', stone: [122, 126, 128], mortar: [20, 21, 23], grit: 0.5 }, 1),
      hazard: { key: 'lab:hazard', scale: 0.6 },
      base: dressed({ cut: 'plate', stone: [46, 52, 58], mortar: [150, 152, 150], cols: 2, rows: 1, grit: 0.7 }, 3),
      base2: dressed({ cut: 'block', stone: [62, 66, 70], mortar: [44, 46, 48], cols: 5, rows: 10, grit: 0.6 }, 2),
      wall: dressed({ cut: 'plate', stone: [72, 82, 92], mortar: [150, 152, 150], cols: 2, rows: 2, grit: 0.5 }, 4),
      wall2: dressed({ cut: 'concrete', stone: [104, 108, 112], mortar: [80, 82, 84], cols: 2, rows: 2, grit: 0.6 }, 4),
      wall3: dressed({ cut: 'matte', stone: [62, 70, 76], cols: 2, rows: 2, grit: 0.5 }, 3),
      crown: dressed({ cut: 'corrugated', stone: [58, 64, 70], mortar: [80, 80, 80], cols: 12, grit: 0.5 }, 2.4),
      column: dressed({ cut: 'plate', stone: [60, 68, 76], mortar: [150, 152, 150], cols: 1, rows: 3, grit: 0.6 }, 3),
      paint: dressed({ cut: 'plate', stone: [182, 88, 40], mortar: [150, 152, 150], cols: 1, rows: 2, grit: 0.6 }, 2),
      services: dressed({ cut: 'plate', stone: [86, 98, 64], mortar: [150, 152, 150], cols: 1, rows: 1, grit: 0.5 }, 2),
      trim: { key: 'steel-strut', scale: 1.2 },
      ceiling: dressed({ cut: 'corrugated', stone: [40, 44, 50], mortar: [60, 60, 60], cols: 12, grit: 0.4 }, 3),
      ceiling2: dressed({ cut: 'seam', stone: [48, 52, 58], mortar: [60, 60, 60], cols: 4, grit: 0.4 }, 3),
      soffit: dressed({ cut: 'panel', stone: [58, 64, 70], mortar: [22, 24, 26], cols: 2, rows: 2, grit: 0.4 }, 2.4),
      soffit2: dressed({ cut: 'perforated', stone: [70, 76, 82], mortar: [16, 17, 19], cols: 2, rows: 1, grit: 0.4 }, 1),
      concrete: dressed({ cut: 'concrete', stone: [110, 114, 118], mortar: [80, 82, 84], cols: 2, rows: 2, grit: 0.5 }, 3),
      beam: dressed({ cut: 'plate', stone: [66, 72, 78], mortar: [150, 152, 150], cols: 4, rows: 1, grit: 0.6 }, 4),
      duct: { key: 'hull-plate', scale: 1.5 },
      grate: dressed({ cut: 'grating', face: 'floor', stone: [128, 132, 134], mortar: [20, 21, 23], grit: 0.4 }, 1),
      infill: dressed({ cut: 'perforated', stone: [112, 118, 124], mortar: [18, 19, 21], cols: 2, rows: 1, grit: 0.5 }, 1),
      cabinet: dressed({ cut: 'matte', stone: [72, 80, 62], cols: 1, rows: 2, grit: 0.5 }, 1),
      cable: { key: null, scale: 1 },
    },
    options: { floor: ['floor', 'floor2'], base: ['base', 'base2'], wall: ['wall', 'wall2', 'wall3'], ceiling: ['ceiling', 'ceiling2'], soffit: ['soffit', 'soffit2'] },
    roofs: ['beams', 'truss', 'vault'], braced: true,
    light: { strip: { color: '#cfe4ff', fill: '#eef6ff', intensity: 0.9, radius: 6.5 }, highbay: { color: '#e4ecff', fill: '#f4f8ff', intensity: 1.5, radius: 15, twoRows: 9, drop: 1.4, r: 0.36, h: 0.45 },
      ceilingStrip: { color: '#d8e8ff', fill: '#f2f8ff', intensity: 1.0, radius: 6 }, inset: { color: '#8fc8ff', fill: '#cfe8ff', intensity: 0.35, radius: 2.6 },
      // the secondary light: a warm signal against the cool key
      door: { color: '#ffa030', fill: '#ffc070', intensity: 0.5, radius: 3.8 }, cove: { color: '#ff5a28', fill: '#ff9a70', intensity: 0.6, radius: 7 },
      down: { color: '#ffb060', fill: '#ffd8a0', intensity: 0.45, radius: 4.2 }, daylight: { color: '#cfe0ff', fill: '#e8f0ff', intensity: 0.9, radius: 12 }, coffer: { color: '#e8f0ff', fill: '#f8fbff', intensity: 1.0, radius: 8 } },
  },
  utility: {
    tiles: {
      floor: dressed({ cut: 'epoxy', face: 'floor', stone: [128, 126, 120], mortar: [60, 58, 54], cols: 1, grit: 0.6 }, 6),
      floor2: dressed({ cut: 'pavement', face: 'floor', stone: [132, 128, 120], mortar: [80, 78, 72], cols: 3, grit: 0.6 }, 6),
      band: dressed({ cut: 'tread', face: 'floor', stone: [122, 124, 124], mortar: [60, 60, 62], cols: 1, grit: 0.6 }, 1),
      hazard: { key: 'lab:hazard', scale: 0.6 },
      base: dressed({ cut: 'block', stone: [96, 104, 98], mortar: [84, 90, 86], cols: 5, rows: 10, grit: 0.5 }, 2),
      base2: dressed({ cut: 'plate', stone: [58, 82, 70], mortar: [150, 152, 150], cols: 2, rows: 1, grit: 0.6 }, 3),
      wall: dressed({ cut: 'block', stone: [168, 164, 154], mortar: [140, 136, 128], cols: 5, rows: 10, grit: 0.5 }, 2),
      wall2: dressed({ cut: 'seam', stone: [104, 118, 128], mortar: [80, 80, 80], cols: 4, grit: 0.5 }, 3),
      crown: dressed({ cut: 'corrugated', stone: [150, 152, 148], mortar: [100, 100, 100], cols: 12, grit: 0.5 }, 2.4),
      column: dressed({ cut: 'plate', stone: [186, 150, 52], mortar: [150, 152, 150], cols: 1, rows: 3, grit: 0.6 }, 3),
      paint: dressed({ cut: 'plate', stone: [46, 122, 84], mortar: [150, 152, 150], cols: 1, rows: 2, grit: 0.6 }, 2),
      services: dressed({ cut: 'plate', stone: [52, 92, 150], mortar: [150, 152, 150], cols: 1, rows: 1, grit: 0.5 }, 2),
      trim: { key: 'steel-strut', scale: 1.2 },
      ceiling: dressed({ cut: 'corrugated', stone: [120, 122, 120], mortar: [80, 80, 80], cols: 12, grit: 0.4 }, 3),
      ceiling2: dressed({ cut: 'seam', stone: [130, 132, 128], mortar: [80, 80, 80], cols: 4, grit: 0.4 }, 3),
      soffit: dressed({ cut: 'panel', stone: [176, 176, 170], mortar: [60, 60, 60], cols: 2, rows: 2, grit: 0.4 }, 2.4),
      soffit2: dressed({ cut: 'acoustic', stone: [212, 210, 202], mortar: [190, 190, 186], cols: 4, rows: 4, grit: 0.5 }, 2.4),
      concrete: dressed({ cut: 'concrete', stone: [150, 148, 142], mortar: [110, 108, 104], cols: 2, rows: 2, grit: 0.5 }, 3),
      beam: dressed({ cut: 'plate', stone: [110, 114, 116], mortar: [150, 152, 150], cols: 4, rows: 1, grit: 0.5 }, 4),
      duct: { key: 'hull-plate', scale: 1.5 },
      grate: dressed({ cut: 'grating', face: 'floor', stone: [150, 152, 150], mortar: [24, 24, 26], grit: 0.4 }, 1),
      infill: dressed({ cut: 'perforated', stone: [150, 154, 150], mortar: [24, 24, 26], cols: 2, rows: 1, grit: 0.5 }, 1),
      cabinet: dressed({ cut: 'matte', stone: [150, 152, 146], cols: 1, rows: 2, grit: 0.6 }, 1),
      cable: { key: null, scale: 1 },
    },
    options: { floor: ['floor', 'floor2'], base: ['base', 'base2'], wall: ['wall', 'wall2'], ceiling: ['ceiling', 'ceiling2'], soffit: ['soffit', 'soffit2'] },
    roofs: ['truss', 'sawtooth', 'beams'], braced: true,
    light: { strip: { color: '#fff0d8', fill: '#fff8ec', intensity: 0.8, radius: 6 }, highbay: { color: '#f4f6ff', fill: '#fbfcff', intensity: 1.6, radius: 16, twoRows: 9, drop: 1.4, r: 0.36, h: 0.45 },
      ceilingStrip: { color: '#fff0dc', fill: '#fff8f0', intensity: 1.0, radius: 6 }, inset: { color: '#ffd890', fill: '#fff0c8', intensity: 0.3, radius: 2.4 },
      // the secondary light: sodium amber among the white
      door: { color: '#ff9a30', fill: '#ffc070', intensity: 0.5, radius: 3.8 }, cove: { color: '#ffa848', fill: '#ffd090', intensity: 0.6, radius: 7 },
      down: { color: '#ffc070', fill: '#ffe0b0', intensity: 0.45, radius: 4.2 }, daylight: { color: '#e8f0ff', fill: '#f4f8ff', intensity: 1.0, radius: 14 }, coffer: { color: '#fff4e0', fill: '#fffaf0', intensity: 1.0, radius: 8 } },
  },
  science: {
    tiles: {
      floor: dressed({ cut: 'epoxy', face: 'floor', stone: [196, 202, 204], mortar: [120, 126, 130], cols: 1, grit: 0.3 }, 6),
      floor2: dressed({ cut: 'terrazzo', face: 'floor', stone: [206, 204, 198], mortar: [80, 110, 130], cols: 2, rows: 2, grit: 0.3 }, 3),
      floor3: dressed({ cut: 'studded', face: 'floor', stone: [56, 92, 96], mortar: [40, 40, 40], cols: 1, grit: 0.4 }, 1),
      band: dressed({ cut: 'grating', face: 'floor', stone: [170, 176, 180], mortar: [36, 40, 44], grit: 0.3 }, 1),
      hazard: { key: 'lab:hazard', scale: 0.6 },
      base: dressed({ cut: 'panel', stone: [52, 120, 128], mortar: [24, 30, 32], cols: 2, rows: 1, grit: 0.3 }, 2.4),
      base2: dressed({ cut: 'glazed', stone: [60, 132, 138], mortar: [150, 170, 170], cols: 8, rows: 8, grit: 0.3 }, 1.2),
      base3: dressed({ cut: 'carbon', stone: [44, 46, 50], mortar: [40, 42, 46], cols: 1, rows: 1, grit: 0.2 }, 0.5),
      wall: dressed({ cut: 'panel', stone: [216, 222, 224], mortar: [40, 44, 48], cols: 2, rows: 1, grit: 0.25 }, 2.4),
      wall2: dressed({ cut: 'glazed', stone: [222, 232, 230], mortar: [176, 186, 186], cols: 8, rows: 16, grit: 0.25 }, 1.2),
      crown: dressed({ cut: 'panel', stone: [176, 184, 188], mortar: [40, 44, 48], cols: 3, rows: 1, grit: 0.25 }, 2.4),
      column: dressed({ cut: 'panel', stone: [190, 196, 200], mortar: [40, 44, 48], cols: 1, rows: 2, grit: 0.25 }, 2.4),
      paint: dressed({ cut: 'panel', stone: [44, 74, 150], mortar: [24, 28, 40], cols: 1, rows: 2, grit: 0.3 }, 2),
      services: dressed({ cut: 'panel', stone: [118, 72, 150], mortar: [40, 30, 50], cols: 1, rows: 1, grit: 0.3 }, 2),
      trim: { key: 'steel-strut', scale: 1.2 },
      ceiling: dressed({ cut: 'panel', stone: [180, 186, 190], mortar: [70, 74, 78], cols: 4, rows: 4, grit: 0.2 }, 2.4),
      ceiling2: dressed({ cut: 'acoustic', stone: [222, 224, 222], mortar: [200, 204, 206], cols: 4, rows: 4, grit: 0.2 }, 2.4),
      soffit: dressed({ cut: 'panel', stone: [210, 214, 216], mortar: [80, 84, 88], cols: 4, rows: 4, grit: 0.2 }, 2.4),
      soffit2: dressed({ cut: 'acoustic', stone: [224, 226, 224], mortar: [204, 208, 210], cols: 4, rows: 4, grit: 0.2 }, 2.4),
      concrete: dressed({ cut: 'concrete', stone: [196, 198, 196], mortar: [150, 152, 150], cols: 2, rows: 2, grit: 0.3 }, 3),
      beam: dressed({ cut: 'panel', stone: [196, 202, 206], mortar: [40, 44, 48], cols: 3, rows: 1, grit: 0.2 }, 2.4),
      duct: { key: 'hull-plate', scale: 1.5 },
      grate: dressed({ cut: 'grating', face: 'floor', stone: [176, 180, 184], mortar: [36, 40, 44], grit: 0.3 }, 1),
      infill: dressed({ cut: 'perforated', stone: [206, 210, 212], mortar: [40, 44, 48], cols: 2, rows: 1, grit: 0.3 }, 1),
      cabinet: dressed({ cut: 'carbon', stone: [44, 46, 50], mortar: [40, 42, 46], cols: 1, rows: 1, grit: 0.2 }, 0.5),
      cabinet2: dressed({ cut: 'matte', stone: [214, 218, 220], cols: 1, rows: 2, grit: 0.3 }, 1),
      cable: { key: null, scale: 1 },
    },
    options: { floor: ['floor', 'floor2', 'floor3'], base: ['base', 'base2', 'base3'], wall: ['wall', 'wall2'], ceiling: ['ceiling', 'ceiling2'], soffit: ['soffit', 'soffit2'], cabinet: ['cabinet', 'cabinet2'] },
    roofs: ['coffer', 'beams', 'sawtooth'], braced: false,
    light: { strip: { color: '#e8f8ff', fill: '#f6fcff', intensity: 0.9, radius: 6.5 }, highbay: { color: '#eef8ff', fill: '#fafdff', intensity: 1.5, radius: 15, twoRows: 9, drop: 1.4, r: 0.36, h: 0.45 },
      ceilingStrip: { color: '#eef8ff', fill: '#fafdff', intensity: 1.1, radius: 6.5 }, inset: { color: '#7fe8e0', fill: '#c8fff8', intensity: 0.3, radius: 2.4 },
      // the secondary light: teal and blue in the white
      door: { color: '#40d0c0', fill: '#a0fff0', intensity: 0.45, radius: 3.6 }, cove: { color: '#30d8e0', fill: '#a8f8ff', intensity: 0.55, radius: 7 },
      down: { color: '#80b8ff', fill: '#d0e4ff', intensity: 0.4, radius: 4 }, daylight: { color: '#f0f8ff', fill: '#fafdff', intensity: 1.0, radius: 13 }, coffer: { color: '#f4fbff', fill: '#ffffff', intensity: 1.0, radius: 8 } },
  },
  everyday: {
    // (the shell turned down: a rubber base and a slim drywall pilaster, a bulkhead for a crown, a hollow metal door frame,
    // no grating band, no pad, no inset lamps, no strip on the pilasters)
    shell: { base: { h: 0.12, out: 0.015 }, crown: { h: 0.5, out: 0.06 }, pilaster: { w: 0.4, out: 0.1, foot: 0.12, strip: { w: 0.09, z0: 0.9, len: 0, every: 1 } },
      door: { frame: 0.1, out: 0.03, sill: 0.12 }, floor: { minSpan: 1e9 }, pad: { minSpan: 1e9 }, services: { every: 3 } },
    door: { width: 1.8, height: 2.7, frame: 0.1, out: 0.03 },
    // (the lab look's light, its air neutral: an everyday room is lit white, not blue)
    ambient: '#45443f',
    tiles: {
      floor: dressed({ cut: 'carpet', face: 'floor', stone: [86, 92, 104], mortar: [150, 140, 120], cols: 2, grit: 0.4 }, 1),
      floor2: dressed({ cut: 'vinyl', face: 'floor', stone: [200, 194, 180], mortar: [150, 140, 124], cols: 4, grit: 0.4 }, 1.2),
      floor3: dressed({ cut: 'porcelain', face: 'floor', stone: [168, 166, 160], mortar: [120, 118, 112], cols: 2, rows: 2, grit: 0.3 }, 1.2),
      floor4: dressed({ cut: 'laminate', face: 'floor', stone: [176, 140, 100], mortar: [110, 78, 50], cols: 6, grit: 0.4 }, 1.2),
      band: dressed({ cut: 'vinyl', face: 'floor', stone: [120, 118, 112], mortar: [90, 88, 84], cols: 4, grit: 0.4 }, 1.2),
      // (no hazard: a threshold strip and the stair's nosings in brushed aluminium, a contrast to find a step by)
      hazard: dressed({ cut: 'tread', face: 'floor', stone: [176, 178, 178], mortar: [80, 80, 82], cols: 1, grit: 0.3 }, 0.6),
      base: dressed({ cut: 'matte', stone: [52, 52, 54], cols: 1, rows: 1, grit: 0.4 }, 1),
      base2: dressed({ cut: 'matte', stone: [84, 72, 60], cols: 1, rows: 1, grit: 0.4 }, 1),
      wall: dressed({ cut: 'drywall', stone: [214, 208, 196], mortar: [200, 196, 186], cols: 2, rows: 1, grit: 0.4 }, 2.4),
      wall2: dressed({ cut: 'veneer', stone: [168, 120, 80], mortar: [40, 30, 24], cols: 2, rows: 1, grit: 0.2 }, 1.2),
      wall3: dressed({ cut: 'block', stone: [204, 202, 194], mortar: [186, 184, 176], cols: 5, rows: 10, grit: 0.3 }, 2),
      crown: dressed({ cut: 'drywall', stone: [226, 222, 212], mortar: [210, 206, 196], cols: 2, rows: 1, grit: 0.3 }, 2.4),
      column: dressed({ cut: 'drywall', stone: [222, 218, 208], mortar: [206, 202, 192], cols: 1, rows: 1, grit: 0.4 }, 2.4),
      paint: dressed({ cut: 'matte', stone: [56, 92, 110], cols: 1, rows: 2, grit: 0.4 }, 2),
      services: dressed({ cut: 'matte', stone: [150, 154, 156], cols: 1, rows: 1, grit: 0.4 }, 2),
      cabinet: dressed({ cut: 'matte', stone: [206, 202, 192], cols: 1, rows: 2, grit: 0.3 }, 1),
      cable: { key: null, scale: 1 },
      trim: { key: 'steel-strut', scale: 1.2 },
      ceiling: dressed({ cut: 'corrugated', stone: [210, 212, 210], mortar: [160, 160, 160], cols: 12, grit: 0.3 }, 3),
      ceiling2: dressed({ cut: 'acoustic', stone: [226, 226, 220], mortar: [210, 210, 206], cols: 4, rows: 4, grit: 0.3 }, 2.4),
      soffit: dressed({ cut: 'acoustic', stone: [228, 226, 220], mortar: [212, 212, 208], cols: 4, rows: 4, grit: 0.3 }, 2.4),
      soffit2: dressed({ cut: 'drywall', stone: [232, 230, 224], mortar: [220, 218, 212], cols: 2, rows: 2, grit: 0.3 }, 2.4),
      concrete: dressed({ cut: 'concrete', stone: [180, 178, 172], mortar: [140, 138, 134], cols: 2, rows: 2, grit: 0.4 }, 3),
      beam: dressed({ cut: 'matte', stone: [200, 202, 204], cols: 4, rows: 1, grit: 0.3 }, 4),
      duct: { key: 'hull-plate', scale: 1.5 },
      grate: dressed({ cut: 'grating', face: 'floor', stone: [170, 172, 172], mortar: [30, 30, 32], grit: 0.3 }, 1),
      infill: dressed({ cut: 'perforated', stone: [210, 212, 212], mortar: [40, 42, 44], cols: 2, rows: 1, grit: 0.3 }, 1),
    },
    options: { floor: ['floor', 'floor2', 'floor3', 'floor4'], base: ['base', 'base2'], wall: ['wall', 'wall2', 'wall3'], ceiling: ['ceiling', 'ceiling2'], soffit: ['soffit', 'soffit2'] },
    roofs: ['beams', 'truss', 'coffer'], braced: false, craned: false,
    light: { strip: { color: '#fff4e8', fill: '#fffaf4', intensity: 0.8, radius: 6 }, highbay: { color: '#fff8f0', fill: '#fffcf8', intensity: 1.4, radius: 15, twoRows: 9, drop: 1.4, r: 0.36, h: 0.45 },
      ceilingStrip: { color: '#fff6ec', fill: '#fffbf6', intensity: 1.0, radius: 6 }, inset: { color: '#ffe8c8', fill: '#fff4e4', intensity: 0.3, radius: 2.4 },
      // the secondary light: the exit sign's green over each door, warm downlights and coves in the neutral
      door: { color: '#30e070', fill: '#a0ffc0', intensity: 0.35, radius: 3 }, cove: { color: '#ffc890', fill: '#ffe4c4', intensity: 0.55, radius: 7 },
      down: { color: '#ffd0a0', fill: '#ffe8cc', intensity: 0.45, radius: 4.2 }, daylight: { color: '#eef4ff', fill: '#f8faff', intensity: 1.0, radius: 13 }, coffer: { color: '#fff4e4', fill: '#fffaf2', intensity: 1.0, radius: 8 } },
  },
};
export const BAY_REGISTERS = Object.freeze(Object.keys(REGISTERS));

/** The stage kit card for a register. */
export function bayKit(register) {
  const R = REGISTERS[register];
  if (!R) throw new Error(`bay: '${register}' is not a register (${BAY_REGISTERS.join(', ')})`);
  const L = R.light, white = [1, 1, 1];
  // (a register's shell parts each laid over the shell's own)
  const shell = Object.fromEntries(Object.entries(R.shell || {}).map(([k, v]) => [k, { ...SHELL[k], ...v }]));
  return Object.freeze({
    shell: 'bay', grid: 1, bay: 6, wall: 0.5, reference: 'lab-dark', ...(R.ambient ? { ambient: R.ambient } : {}),
    door: R.door || { width: 2.4, height: 3.4, frame: 0.32, out: 0.16 },
    // (no torch is seated: every light is the shell's own; this is the default a recipe's own `lights` take)
    torch: { color: L.strip.color, intensity: L.strip.intensity, radius: L.strip.radius },
    rubble: null,
    cells: Object.fromEntries(Object.keys(R.tiles).map((k) => [k, ['ceiling', 'ceiling2', 'concrete', 'floor', 'floor2', 'floor3', 'floor4', 'beam'].includes(k) ? 1.5 : 1])),
    tiles: R.tiles,
    // (the dressed cuts carry their own colour: a white band leaves it as painted)
    // (an untextured cable takes its colour here: rubber's near black)
    tint: Object.fromEntries(Object.keys(R.tiles).map((k) => [k, k === 'cable' ? CABLE : white])),
    B: { ...SHELL, ...shell, light: L, options: R.options, roofs: R.roofs, braced: R.braced, craned: R.craned !== false, highbay: { ...(shell.highbay || SHELL.highbay) } },
  });
}
