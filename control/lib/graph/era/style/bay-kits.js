/**
 * The BAY KITS (era/bay.js, the bay shell): one shell, three REGISTERS, each the same parts laid in its own materials,
 * colours and light. A register is what a modern interior says it is for:
 *
 *   military   a hangar, an armoury, a bunker: steel plate on a dark kick band, corrugated crowns, a dark epoxy floor
 *              with grating at the walls, hazard yellow rationed to the edges and the doorways' heads; cool strips
 *   utility    a warehouse, a plant room, a depot: concrete block over a painted block base, a sealed concrete floor,
 *              corrugated crowns and soffits; warm white lamps
 *   science    a lab, a clean corridor, a control room: white sheet panels, a pale poured floor, a teal accent band at
 *              the base; cold white strips
 *
 * Each card is the stage's kit card (era/stage.js STAGE_KITS) with `shell: 'bay'`: the tiles (the made class's dressed
 * cuts, matte-paint/dressed.js, at the metres they are laid at), the tints (each surface's value band), the cells, and
 * `B`, the shell's numbers (era/bay.js). `reference` is the sixth-gen look the stage defaults to for the kit's light.
 */
import { tileFamilyOf } from '../tile-specs.js';

const dressed = (spec, metres) => ({ family: tileFamilyOf({ gen: 'dressed', ...spec, scale: metres }, 'bay kit'), scale: metres, variants: 2 });

// the shell's numbers, the same in every register but for its light
const SHELL = Object.freeze({
  base: { h: 1.2, out: 0.08 },
  crown: { h: 0.9, out: 0.14 },
  pilaster: { w: 0.6, out: 0.42, strip: { w: 0.09, z0: 0.9, len: 3.2, every: 1 } },
  door: { frame: 0.32, out: 0.16 },
  floor: { minSpan: 6, band: 0.8, hazard: 0.16 },
  inset: { w: 0.14, l: 0.36 },
  pad: { minSpan: 10, share: 0.42, line: 0.3 },
  beam: { perSpan: 0.065, min: 0.6, max: 1.3, w: 0.42, web: 0.07, flange: 0.07 },
  duct: { at: [0.2], r: 0.36, sides: 10, gap: 0.15 },
  highbay: { min: 6.5, twoRows: 9, drop: 1.4, r: 0.36, h: 0.45 },
  ceilingStrip: { share: 0.55, w: 0.11, h: 0.08 },
  pipes: { off: 0.45, gap: 0.26, drop: 0.35, r: [0.09, 0.06] },
  crane: { min: 9, minSpan: 9, below: 1.2, rail: { w: 0.32, h: 0.42 }, girder: { w: 0.9, h: 1.0 }, hook: { least: 3.4, share: 0.42, h: 0.5 } },
  catwalk: { min: 7.5, z: 4.2, d: 1.4, fascia: 0.22, rise: 0.19, going: 0.27, post: 1.5, rail: 1.1 },
});

const REGISTERS = {
  military: {
    tiles: {
      floor: dressed({ cut: 'epoxy', face: 'floor', stone: [70, 78, 86], mortar: [28, 30, 33], cols: 1, grit: 0.55 }, 6),
      band: dressed({ cut: 'grating', face: 'floor', stone: [122, 126, 128], mortar: [20, 21, 23], grit: 0.5 }, 1),
      hazard: { key: 'lab:hazard', scale: 0.6 },
      base: dressed({ cut: 'plate', stone: [46, 52, 58], mortar: [150, 152, 150], cols: 2, rows: 1, grit: 0.7 }, 3),
      wall: dressed({ cut: 'plate', stone: [72, 82, 92], mortar: [150, 152, 150], cols: 2, rows: 2, grit: 0.5 }, 4),
      crown: dressed({ cut: 'corrugated', stone: [58, 64, 70], mortar: [80, 80, 80], cols: 12, grit: 0.5 }, 2.4),
      column: dressed({ cut: 'plate', stone: [60, 68, 76], mortar: [150, 152, 150], cols: 1, rows: 3, grit: 0.6 }, 3),
      trim: { key: 'steel-strut', scale: 1.2 },
      ceiling: dressed({ cut: 'corrugated', stone: [40, 44, 50], mortar: [60, 60, 60], cols: 12, grit: 0.4 }, 3),
      soffit: dressed({ cut: 'panel', stone: [58, 64, 70], mortar: [22, 24, 26], cols: 2, rows: 2, grit: 0.4 }, 2.4),
      beam: dressed({ cut: 'plate', stone: [66, 72, 78], mortar: [150, 152, 150], cols: 4, rows: 1, grit: 0.6 }, 4),
      duct: { key: 'hull-plate', scale: 1.5 },
      grate: dressed({ cut: 'grating', face: 'floor', stone: [128, 132, 134], mortar: [20, 21, 23], grit: 0.4 }, 1),
    },
    light: { strip: { color: '#cfe4ff', fill: '#eef6ff', intensity: 0.9, radius: 6.5 }, highbay: { color: '#e4ecff', fill: '#f4f8ff', intensity: 1.5, radius: 15 },
      ceilingStrip: { color: '#d8e8ff', fill: '#f2f8ff', intensity: 1.0, radius: 6 }, inset: { color: '#8fc8ff', fill: '#cfe8ff', intensity: 0.35, radius: 2.6 }, door: { lamp: '#ffb040', intensity: 0.45, radius: 3.5 } },
  },
  utility: {
    tiles: {
      floor: dressed({ cut: 'epoxy', face: 'floor', stone: [128, 126, 120], mortar: [60, 58, 54], cols: 1, grit: 0.6 }, 6),
      band: dressed({ cut: 'tread', face: 'floor', stone: [122, 124, 124], mortar: [60, 60, 62], cols: 1, grit: 0.6 }, 1),
      hazard: { key: 'lab:hazard', scale: 0.6 },
      base: dressed({ cut: 'block', stone: [96, 104, 98], mortar: [84, 90, 86], cols: 5, rows: 10, grit: 0.5 }, 2),
      wall: dressed({ cut: 'block', stone: [168, 164, 154], mortar: [140, 136, 128], cols: 5, rows: 10, grit: 0.5 }, 2),
      crown: dressed({ cut: 'corrugated', stone: [150, 152, 148], mortar: [100, 100, 100], cols: 12, grit: 0.5 }, 2.4),
      column: dressed({ cut: 'plate', stone: [186, 150, 52], mortar: [150, 152, 150], cols: 1, rows: 3, grit: 0.6 }, 3),
      trim: { key: 'steel-strut', scale: 1.2 },
      ceiling: dressed({ cut: 'corrugated', stone: [120, 122, 120], mortar: [80, 80, 80], cols: 12, grit: 0.4 }, 3),
      soffit: dressed({ cut: 'panel', stone: [176, 176, 170], mortar: [60, 60, 60], cols: 2, rows: 2, grit: 0.4 }, 2.4),
      beam: dressed({ cut: 'plate', stone: [110, 114, 116], mortar: [150, 152, 150], cols: 4, rows: 1, grit: 0.5 }, 4),
      duct: { key: 'hull-plate', scale: 1.5 },
      grate: dressed({ cut: 'grating', face: 'floor', stone: [150, 152, 150], mortar: [24, 24, 26], grit: 0.4 }, 1),
    },
    light: { strip: { color: '#fff0d8', fill: '#fff8ec', intensity: 0.8, radius: 6 }, highbay: { color: '#fff2dc', fill: '#fffaf0', intensity: 1.6, radius: 16 },
      ceilingStrip: { color: '#fff0dc', fill: '#fff8f0', intensity: 1.0, radius: 6 }, inset: { color: '#ffd890', fill: '#fff0c8', intensity: 0.3, radius: 2.4 }, door: { lamp: '#ff9a30', intensity: 0.45, radius: 3.5 } },
  },
  science: {
    tiles: {
      floor: dressed({ cut: 'epoxy', face: 'floor', stone: [196, 202, 204], mortar: [120, 126, 130], cols: 1, grit: 0.3 }, 6),
      band: dressed({ cut: 'grating', face: 'floor', stone: [170, 176, 180], mortar: [36, 40, 44], grit: 0.3 }, 1),
      hazard: { key: 'lab:hazard', scale: 0.6 },
      base: dressed({ cut: 'panel', stone: [52, 120, 128], mortar: [24, 30, 32], cols: 2, rows: 1, grit: 0.3 }, 2.4),
      wall: dressed({ cut: 'panel', stone: [216, 222, 224], mortar: [40, 44, 48], cols: 2, rows: 1, grit: 0.25 }, 2.4),
      crown: dressed({ cut: 'panel', stone: [176, 184, 188], mortar: [40, 44, 48], cols: 3, rows: 1, grit: 0.25 }, 2.4),
      column: dressed({ cut: 'panel', stone: [190, 196, 200], mortar: [40, 44, 48], cols: 1, rows: 2, grit: 0.25 }, 2.4),
      trim: { key: 'steel-strut', scale: 1.2 },
      ceiling: dressed({ cut: 'panel', stone: [180, 186, 190], mortar: [70, 74, 78], cols: 4, rows: 4, grit: 0.2 }, 2.4),
      soffit: dressed({ cut: 'panel', stone: [210, 214, 216], mortar: [80, 84, 88], cols: 4, rows: 4, grit: 0.2 }, 2.4),
      beam: dressed({ cut: 'panel', stone: [196, 202, 206], mortar: [40, 44, 48], cols: 3, rows: 1, grit: 0.2 }, 2.4),
      duct: { key: 'hull-plate', scale: 1.5 },
      grate: dressed({ cut: 'grating', face: 'floor', stone: [176, 180, 184], mortar: [36, 40, 44], grit: 0.3 }, 1),
    },
    light: { strip: { color: '#e8f8ff', fill: '#f6fcff', intensity: 0.9, radius: 6.5 }, highbay: { color: '#eef8ff', fill: '#fafdff', intensity: 1.5, radius: 15 },
      ceilingStrip: { color: '#eef8ff', fill: '#fafdff', intensity: 1.1, radius: 6.5 }, inset: { color: '#7fe8e0', fill: '#c8fff8', intensity: 0.3, radius: 2.4 }, door: { lamp: '#40d0c0', intensity: 0.4, radius: 3.2 } },
  },
};
export const BAY_REGISTERS = Object.freeze(Object.keys(REGISTERS));

/** The stage kit card for a register. */
export function bayKit(register) {
  const R = REGISTERS[register];
  if (!R) throw new Error(`bay: '${register}' is not a register (${BAY_REGISTERS.join(', ')})`);
  const L = R.light, white = [1, 1, 1];
  return Object.freeze({
    shell: 'bay', grid: 1, bay: 6, wall: 0.5, reference: 'lab-dark',
    door: { width: 2.4, height: 3.4, frame: 0.32, out: 0.16 },
    // (no torch is seated: every light is the shell's own; this is the default a recipe's own `lights` take)
    torch: { color: L.strip.color, intensity: L.strip.intensity, radius: L.strip.radius },
    rubble: null,
    cells: { floor: 1.5, band: 1, hazard: 1, base: 1, wall: 1.2, crown: 1, column: 1, trim: 1, ceiling: 2, soffit: 1.2, beam: 1.5, duct: 1.2, grate: 1 },
    tiles: R.tiles,
    // (the dressed cuts carry their own colour: a white band leaves it as painted)
    tint: Object.fromEntries(Object.keys(R.tiles).map((k) => [k, white])),
    B: { ...SHELL, pilaster: { ...SHELL.pilaster, strip: { ...SHELL.pilaster.strip, ...L.strip } }, highbay: { ...SHELL.highbay, ...L.highbay }, ceilingStrip: { ...SHELL.ceilingStrip, ...L.ceilingStrip },
      inset: { ...SHELL.inset, ...L.inset }, door: { ...SHELL.door, ...L.door } },
  });
}
