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
import { CATALOG } from '../../construction/catalog.js';
import { UNITS } from '../../construction/masonry.js';
import { glassLook } from '../../construction/glazing.js';

const CABLE = [0.07, 0.07, 0.08];
// the air, from the catalog (mm → m): a register's duct round or rectangular, the terminals and the hanger rod, the
// duct's line `at` across the span
const mm = (v) => v / 1000;
const ductOf = (name) => { const e = CATALOG[name]; return e.dia ? { shape: 'round', r: mm(e.dia) / 2, length: mm(e.length), joint: mm(e.joint), name } : { shape: 'rect', w: mm(e.size[0]), h: mm(e.size[1]), length: mm(e.length), flange: mm(e.flange), name }; };
const airOf = (duct) => {
  const C = (k) => CATALOG[k], dr = C('diffuser:drum-300'), sq = C('diffuser:square-600'), gr = C('grille:return-600x300'), lv = C('louvre:wall-1200x900'), rd = C('hanger:rod-10');
  return { at: 0.2, duct: ductOf(duct), drum: { r: mm(dr.dia) / 2, length: mm(dr.length), pitch: mm(dr.pitch) }, diffuser: { size: mm(sq.size[0]), rings: sq.rings },
    grille: { w: mm(gr.size[0]), h: mm(gr.size[1]), pitch: mm(gr.pitch), angle: gr.angle, depth: 0.025 }, louvre: { w: mm(lv.size[0]), h: mm(lv.size[1]), pitch: mm(lv.pitch), angle: lv.angle, depth: mm(lv.depth) },
    rod: { r: mm(rd.dia) / 2, every: mm(rd.every) } };
};
// what the air is made of in every register: the terminals' white powder coat and the louvre's grey, the catalog's
const AIR_TILES = {
  vent: { family: tileFamilyOf({ gen: 'dressed', cut: 'matte', stone: CATALOG['diffuser:square-600'].rgb, mortar: CATALOG['diffuser:square-600'].rgb, cols: 1, rows: 1, grit: 0.3, scale: 0.6 }, 'bay kit'), scale: 0.6, variants: 2 },
  louvre: { family: tileFamilyOf({ gen: 'dressed', cut: 'matte', stone: CATALOG['louvre:wall-1200x900'].rgb, mortar: CATALOG['louvre:wall-1200x900'].rgb, cols: 1, rows: 1, grit: 0.5, scale: 1.2 }, 'bay kit'), scale: 1.2, variants: 2 },
};
const FIELDS = /^(floor|wall|base|ceiling|soffit|crown|concrete)\d?$/;
// a dressed tile laid in a catalog unit (construction/catalog.js; the block's masonry UNITS.cmu with its joint): `n` of
// them across a repeat, the repeat's metres and its courses the unit's own, its colour the catalog's unless painted
const unitOf = (name) => (name === 'block:cmu' ? [UNITS.cmu.l + UNITS.cmu.j, UNITS.cmu.h + UNITS.cmu.j] : CATALOG[name].sheet);
const laid = (name, n, spec) => { const [w, h] = unitOf(name), metres = (n * w) / 1000; return dressed({ stone: CATALOG[name].rgb, cols: n, rows: Math.max(1, Math.round((metres * 1000) / h)), ...spec }, metres); };
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
  // in a share (`open`) of the low rooms; the boxes and breaker panels and the ceiling's pipes only in a room `long`
  // enough to run services along, a return in the ceiling of a room `ceilingReturn` wide, low on a narrower one's wall
  services: { every: 2, box: { w: 0.4, h: 0.5, d: 0.16, z: 1.5, inset: 0.35 }, conduit: { r: 0.025, off: 0.06 }, panel: { w: 0.7, h: 1.1, d: 0.22, z: 0.9, gap: 0.4 },
    open: 0.35, long: 10, ceilingReturn: 5, hook: { drop: 0.25 }, cables: [0.022, 0.018, 0.026], sag: 0.28, indicator: '#40ff80', plenum: [0.06, 0.06, 0.07],
    hole: { l: 1.2, w: 0.6, plenum: 0.5, hang: 1.1, droop: 0.6 } },
  // the glass (era/bay-glass.js): windows where a wall faces out (a tall room's ribbon under its crown, `over` clear of
  // the catwalk's rail; a low room's punched windows or a slot under its soffit, by register), framed at `line` behind
  // the wall's face, mullions at most `every` apart; the sky beyond, the sun's patches on the floor (`sun.toward` where
  // its light travels); and a tall room's booth (a dado under its glass, or none and a frit band at `frit`)
  glass: { line: 0.1, every: 1.5, mullion: 0.06, ribbon: { h: 1.6, below: 0.35, margin: 0.3, over: 1.2 }, punched: { w: 1.5, sill: 0.9, head: 2.2 }, slot: { h: 0.5, below: 0.2, margin: 0.4 },
    sky: { zenith: '#9fbde6', horizon: '#eef1ee' }, sun: { el: 48, toward: [-0.6, 0.8], color: '#fff2d8', alpha: 0.3 } },
  booth: { w: 4.8, d: 3.2, h: 2.8, m: 0.06, head: 0.12, every: 1.2, door: 0.9, swing: 75, frit: 1.0, markBelow: 0.8, dado: 0, screen: '#9fe0ff' },
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
      base2: laid('block:cmu', 5, { cut: 'block', stone: [62, 66, 70], mortar: [44, 46, 48], grit: 0.6 }),
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
    roofs: ['beams', 'truss', 'vault'], braced: true, duct: 'duct:spiral-450', glass: { clear: 'glass:float-6', other: 'glass:wired-6', low: 'slot' }, booth: { dado: 0.9, screen: '#ffb060' },
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
      base: laid('block:cmu', 5, { cut: 'block', stone: [96, 104, 98], mortar: [84, 90, 86], grit: 0.5 }),
      base2: dressed({ cut: 'plate', stone: [58, 82, 70], mortar: [150, 152, 150], cols: 2, rows: 1, grit: 0.6 }, 3),
      wall: laid('block:cmu', 5, { cut: 'block', stone: [168, 164, 154], mortar: [140, 136, 128], grit: 0.5 }),
      wall2: dressed({ cut: 'seam', stone: [104, 118, 128], mortar: [80, 80, 80], cols: 4, grit: 0.5 }, 3),
      crown: dressed({ cut: 'corrugated', stone: [150, 152, 148], mortar: [100, 100, 100], cols: 12, grit: 0.5 }, 2.4),
      column: dressed({ cut: 'plate', stone: [186, 150, 52], mortar: [150, 152, 150], cols: 1, rows: 3, grit: 0.6 }, 3),
      paint: dressed({ cut: 'plate', stone: [46, 122, 84], mortar: [150, 152, 150], cols: 1, rows: 2, grit: 0.6 }, 2),
      services: dressed({ cut: 'plate', stone: [52, 92, 150], mortar: [150, 152, 150], cols: 1, rows: 1, grit: 0.5 }, 2),
      trim: { key: 'steel-strut', scale: 1.2 },
      ceiling: dressed({ cut: 'corrugated', stone: [120, 122, 120], mortar: [80, 80, 80], cols: 12, grit: 0.4 }, 3),
      ceiling2: dressed({ cut: 'seam', stone: [130, 132, 128], mortar: [80, 80, 80], cols: 4, grit: 0.4 }, 3),
      soffit: dressed({ cut: 'panel', stone: [176, 176, 170], mortar: [60, 60, 60], cols: 2, rows: 2, grit: 0.4 }, 2.4),
      soffit2: laid('board:acoustic-tile-600', 4, { cut: 'acoustic', stone: [212, 210, 202], mortar: [190, 190, 186], grit: 0.5 }),
      concrete: dressed({ cut: 'concrete', stone: [150, 148, 142], mortar: [110, 108, 104], cols: 2, rows: 2, grit: 0.5 }, 3),
      beam: dressed({ cut: 'plate', stone: [110, 114, 116], mortar: [150, 152, 150], cols: 4, rows: 1, grit: 0.5 }, 4),
      duct: { key: 'hull-plate', scale: 1.5 },
      grate: dressed({ cut: 'grating', face: 'floor', stone: [150, 152, 150], mortar: [24, 24, 26], grit: 0.4 }, 1),
      infill: dressed({ cut: 'perforated', stone: [150, 154, 150], mortar: [24, 24, 26], cols: 2, rows: 1, grit: 0.5 }, 1),
      cabinet: dressed({ cut: 'matte', stone: [150, 152, 146], cols: 1, rows: 2, grit: 0.6 }, 1),
      cable: { key: null, scale: 1 },
    },
    options: { floor: ['floor', 'floor2'], base: ['base', 'base2'], wall: ['wall', 'wall2'], ceiling: ['ceiling', 'ceiling2'], soffit: ['soffit', 'soffit2'] },
    roofs: ['truss', 'sawtooth', 'beams'], braced: true, duct: 'duct:rect-600x400', glass: { clear: 'glass:float-6', other: 'glass:wired-6', low: 'slot' }, booth: { dado: 1.0, screen: '#a0f0b0' },
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
      ceiling2: laid('board:acoustic-tile-600', 4, { cut: 'acoustic', stone: [222, 224, 222], mortar: [200, 204, 206], grit: 0.2 }),
      soffit: dressed({ cut: 'panel', stone: [210, 214, 216], mortar: [80, 84, 88], cols: 4, rows: 4, grit: 0.2 }, 2.4),
      soffit2: laid('board:acoustic-tile-600', 4, { cut: 'acoustic', stone: [224, 226, 224], mortar: [204, 208, 210], grit: 0.2 }),
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
    roofs: ['coffer', 'beams', 'sawtooth'], braced: false, duct: 'duct:rect-600x400', glass: { clear: 'glass:low-iron-10', other: 'glass:acid-etched-6', low: 'punched' }, booth: { dado: 0 },
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
      floor: laid('floor:carpet-tile-500', 2, { cut: 'carpet', face: 'floor', mortar: [150, 140, 120], grit: 0.4 }),
      floor2: laid('floor:vct-305', 4, { cut: 'vinyl', face: 'floor', mortar: [150, 140, 124], grit: 0.4 }),
      floor3: laid('floor:porcelain-600', 2, { cut: 'porcelain', face: 'floor', mortar: [120, 118, 112], grit: 0.3 }),
      floor4: laid('floor:laminate-193', 6, { cut: 'laminate', face: 'floor', mortar: [110, 78, 50], grit: 0.4 }),
      band: laid('floor:vct-305', 4, { cut: 'vinyl', face: 'floor', stone: [120, 118, 112], mortar: [90, 88, 84], grit: 0.4 }),
      // (no hazard: a threshold strip and the stair's nosings in brushed aluminium, a contrast to find a step by)
      hazard: dressed({ cut: 'tread', face: 'floor', stone: [176, 178, 178], mortar: [80, 80, 82], cols: 1, grit: 0.3 }, 0.6),
      base: dressed({ cut: 'matte', stone: [52, 52, 54], cols: 1, rows: 1, grit: 0.4 }, 1),
      base2: dressed({ cut: 'matte', stone: [84, 72, 60], cols: 1, rows: 1, grit: 0.4 }, 1),
      wall: laid('board:gypsum-12.7', 2, { cut: 'drywall', stone: [214, 208, 196], mortar: [200, 196, 186], grit: 0.4 }),
      wall2: laid('veneer:oak-crown', 2, { cut: 'veneer', mortar: [40, 30, 24], grit: 0.2 }),
      wall3: laid('block:cmu', 5, { cut: 'block', stone: [204, 202, 194], mortar: [186, 184, 176], grit: 0.3 }),
      crown: laid('board:gypsum-12.7', 2, { cut: 'drywall', stone: [226, 222, 212], mortar: [210, 206, 196], grit: 0.3 }),
      column: laid('board:gypsum-12.7', 1, { cut: 'drywall', stone: [222, 218, 208], mortar: [206, 202, 192], grit: 0.4 }),
      paint: dressed({ cut: 'matte', stone: [56, 92, 110], cols: 1, rows: 2, grit: 0.4 }, 2),
      services: dressed({ cut: 'matte', stone: [150, 154, 156], cols: 1, rows: 1, grit: 0.4 }, 2),
      cabinet: dressed({ cut: 'matte', stone: [206, 202, 192], cols: 1, rows: 2, grit: 0.3 }, 1),
      cable: { key: null, scale: 1 },
      trim: { key: 'steel-strut', scale: 1.2 },
      ceiling: dressed({ cut: 'corrugated', stone: [210, 212, 210], mortar: [160, 160, 160], cols: 12, grit: 0.3 }, 3),
      ceiling2: laid('board:acoustic-tile-600', 4, { cut: 'acoustic', stone: [226, 226, 220], mortar: [210, 210, 206], grit: 0.3 }),
      soffit: laid('board:acoustic-tile-600', 4, { cut: 'acoustic', stone: [228, 226, 220], mortar: [212, 212, 208], grit: 0.3 }),
      soffit2: laid('board:gypsum-12.7', 2, { cut: 'drywall', stone: [232, 230, 224], mortar: [220, 218, 212], grit: 0.3 }),
      concrete: dressed({ cut: 'concrete', stone: [180, 178, 172], mortar: [140, 138, 134], cols: 2, rows: 2, grit: 0.4 }, 3),
      beam: dressed({ cut: 'matte', stone: [200, 202, 204], cols: 4, rows: 1, grit: 0.3 }, 4),
      duct: { key: 'hull-plate', scale: 1.5 },
      grate: dressed({ cut: 'grating', face: 'floor', stone: [170, 172, 172], mortar: [30, 30, 32], grit: 0.3 }, 1),
      infill: dressed({ cut: 'perforated', stone: [210, 212, 212], mortar: [40, 42, 44], cols: 2, rows: 1, grit: 0.3 }, 1),
    },
    options: { floor: ['floor', 'floor2', 'floor3', 'floor4'], base: ['base', 'base2'], wall: ['wall', 'wall2', 'wall3'], ceiling: ['ceiling', 'ceiling2'], soffit: ['soffit', 'soffit2'] },
    roofs: ['beams', 'truss', 'coffer'], braced: false, craned: false, duct: 'duct:spiral-450', glass: { clear: 'glass:float-6', other: 'glass:acid-etched-6', low: 'punched' }, booth: { dado: 0, screen: '#d0e8ff' },
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
    // (a bake's cells: a metre on a wall's field, a metre and a half on a floor and a ceiling, two along a thin band)
    cells: Object.fromEntries(Object.keys({ ...R.tiles, ...AIR_TILES }).map((k) => [k, ['ceiling', 'ceiling2', 'concrete', 'floor', 'floor2', 'floor3', 'floor4', 'beam'].includes(k) ? 1.5 : /^(base|crown|column|paint|services|cabinet)\d?$/.test(k) ? 2 : 1])),
    // (two variants only where a field's repeat would show, the floors, walls, bands and ceilings; a trim, a cabinet, a
    // vent carries one: each variant is three maps on a gen-7 page)
    tiles: Object.fromEntries(Object.entries({ ...R.tiles, ...AIR_TILES }).map(([k, t]) => [k, t.family && !FIELDS.test(k) ? { ...t, variants: 1 } : t])),
    // (the dressed cuts carry their own colour: a white band leaves it as painted)
    // (an untextured cable takes its colour here: rubber's near black)
    tint: Object.fromEntries(Object.keys({ ...R.tiles, ...AIR_TILES }).map((k) => [k, k === 'cable' ? CABLE : white])),
    B: { ...SHELL, ...shell, light: L, options: R.options, roofs: R.roofs, braced: R.braced, craned: R.craned !== false, air: airOf(R.duct),
      glass: { ...SHELL.glass, low: R.glass.low, look: glassLook(R.glass.clear), other: glassLook(R.glass.other), names: { clear: R.glass.clear, other: R.glass.other } }, booth: { ...SHELL.booth, ...R.booth }, highbay: { ...(shell.highbay || SHELL.highbay) } },
  });
}
