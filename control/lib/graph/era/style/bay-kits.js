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
 * A register is a preset on four axes (bay-axes.js: construction, palette, plot, dressing), composed here
 * (`composeRegister`, `bayKitOf`); a recipe's composer may choose each apart. Each card is the stage's kit card (era/stage.js STAGE_KITS) with `shell: 'bay'`: the tiles (the made class's dressed
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
import { CONSTRUCTIONS, PALETTES, PLOTS, DRESSINGS, REGISTER_PRESETS } from './bay-axes.js';

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

// a material (bay-axes.js) painted by its swatch: a library tile as it is, a catalog unit laid, a dressed cut
// (a swatch's `own` is the face a dressed cut takes where the swatch leaves a catalog material its own)
const faceOf = ({ own, ...sw }, cut) => (cut && sw.stone === undefined && own ? { ...sw, stone: own } : sw);
const tileOf = (mat, sw) => (mat.key !== undefined ? { key: mat.key, scale: mat.scale } : mat.laid ? laid(mat.laid, mat.n, { ...mat.spec, ...faceOf(sw, false) }) : dressed({ ...mat.dressed, ...faceOf(sw, true) }, mat.metres));
const AXES = { construction: CONSTRUCTIONS, palette: PALETTES, plot: PLOTS, dressing: DRESSINGS };

/**
 * A register's card from a choice on each axis (bay-axes.js): each surface role's materials painted by the palette's
 * swatches (the i-th variant the i-th, round again), the variants a room may take, the plot's light, the dressing over
 * the shell. Every axis named, each a value its table holds.
 */
export function composeRegister(axes) {
  for (const [axis, table] of Object.entries(AXES)) if (!table[axes?.[axis]]) throw new Error(`bay: ${axis} '${axes?.[axis]}' is not one (${Object.keys(table).join(', ')})`);
  const C = CONSTRUCTIONS[axes.construction], P = PALETTES[axes.palette], L = PLOTS[axes.plot], D = DRESSINGS[axes.dressing];
  const tiles = {}, options = {}, keyOf = (role, i) => (i ? `${role}${i + 1}` : role);
  for (const [role, mats] of Object.entries(C.surfaces)) {
    const sw = P[role] || [];
    mats.forEach((mat, i) => { tiles[keyOf(role, i)] = tileOf(mat, sw.length ? sw[i % sw.length] : {}); });
    if (mats.length > 1) options[role] = mats.map((_, i) => keyOf(role, i));
  }
  // (the shell's parts, each laid from what the construction, the dressing and the plot say of it)
  const parts = [...new Set([C.shell, D.shell, L.shell].flatMap((x) => Object.keys(x || {})))];
  const shell = Object.fromEntries(parts.map((part) => [part, { ...C.shell?.[part], ...D.shell?.[part], ...L.shell?.[part] }]));
  return { tiles, options, roofs: C.roofs, braced: C.braced, ...(D.craned === false ? { craned: false } : {}), duct: C.duct, glass: C.glass,
    booth: { ...C.booth, ...L.booth }, light: L.light, ...(parts.length ? { shell } : {}), ...(C.door ? { door: C.door } : {}), ...(P.ambient ? { ambient: P.ambient } : {}) };
}
export const BAY_REGISTERS = Object.freeze(Object.keys(REGISTER_PRESETS));

/** The stage kit card for a register (its preset on every axis). */
export function bayKit(register) {
  if (!REGISTER_PRESETS[register]) throw new Error(`bay: '${register}' is not a register (${BAY_REGISTERS.join(', ')})`);
  return bayKitOf(REGISTER_PRESETS[register]);
}

/** The stage kit card for a choice on each axis: { construction, palette, plot, dressing }. */
export function bayKitOf(axes) {
  const R = composeRegister(axes);
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
