/**
 * The BAY AXES (the scene composer's tables for the bay shell, era/style/bay-kits.js): what a modern interior is, as four
 * choices made apart, where a register (a hangar, a warehouse, a lab, an office) made them all at once.
 *
 *   CONSTRUCTIONS  what it is built of: each surface role's materials (its variants, in order: a room takes one by its
 *                  dice, era/bay.js `options`), no colour in them; the roof systems it builds, whether it braces, the
 *                  duct, the glass, the doors and the shell's proportions
 *   PALETTES       the colour each role is painted (every role any construction paints, so any palette goes on any): its swatches (`stone`, the face; `mortar`, the joints; a swatch with
 *                  no `stone` leaves a catalog material its own colour), the i-th variant taking the i-th swatch (round
 *                  again when there are fewer); `ambient` the register's own air
 *   PLOTS          the light: the key, the fill and the SECONDARY by fixture (strip, highbay, ceilingStrip, inset, door,
 *                  cove, down, daylight, coffer), the booth's screen, the pilasters' strips
 *   DRESSINGS      what is laid over the room: the grating band and the pad (their least span), the services' rhythm, the crane
 *   REGISTER_PRESETS  each register a value on every axis, the starting point a recipe's own choices override
 *
 * Pure data: era/style/bay-kits.js composes a kit card from a choice on each axis.
 */

// a material: a dressed cut painted at `metres`, a catalog unit `laid` n to a repeat, or a library tile by its key
const d = (cut, metres, o = {}) => ({ dressed: { cut, ...o }, metres });
const l = (name, n, cut, o = {}) => ({ laid: name, n, spec: { cut, ...o } });
const k = (key, scale) => ({ key, scale });
// a swatch: the face and the joints; `m` the joints only (the material keeps its own face)
const s = (stone, mortar) => (mortar ? { stone, mortar } : { stone });
const m = (mortar) => ({ mortar });
const F = { face: 'floor' };

export const CONSTRUCTIONS = Object.freeze({
  // steel plate and board-formed concrete over a dark kick band, corrugated crowns, epoxy and grating; beams, trusses or a vault
  military: {
    surfaces: {
      floor: [d('epoxy', 6, { ...F, cols: 1, grit: 0.55 }), d('epoxy', 6, { ...F, cols: 1, grit: 0.7 })],
      band: [d('grating', 1, { ...F, grit: 0.5 })],
      hazard: [k('lab:hazard', 0.6)],
      base: [d('plate', 3, { cols: 2, rows: 1, grit: 0.7 }), l('block:cmu', 5, 'block', { grit: 0.6 })],
      wall: [d('plate', 4, { cols: 2, rows: 2, grit: 0.5 }), d('concrete', 4, { cols: 2, rows: 2, grit: 0.6 }), d('matte', 3, { cols: 2, rows: 2, grit: 0.5 })],
      crown: [d('corrugated', 2.4, { cols: 12, grit: 0.5 })],
      column: [d('plate', 3, { cols: 1, rows: 3, grit: 0.6 })],
      paint: [d('plate', 2, { cols: 1, rows: 2, grit: 0.6 })],
      services: [d('plate', 2, { cols: 1, rows: 1, grit: 0.5 })],
      trim: [k('steel-strut', 1.2)],
      ceiling: [d('corrugated', 3, { cols: 12, grit: 0.4 }), d('seam', 3, { cols: 4, grit: 0.4 })],
      soffit: [d('panel', 2.4, { cols: 2, rows: 2, grit: 0.4 }), d('perforated', 1, { cols: 2, rows: 1, grit: 0.4 })],
      concrete: [d('concrete', 3, { cols: 2, rows: 2, grit: 0.5 })],
      beam: [d('plate', 4, { cols: 4, rows: 1, grit: 0.6 })],
      duct: [k('hull-plate', 1.5)],
      grate: [d('grating', 1, { ...F, grit: 0.4 })],
      infill: [d('perforated', 1, { cols: 2, rows: 1, grit: 0.5 })],
      cabinet: [d('matte', 1, { cols: 1, rows: 2, grit: 0.5 })],
      cable: [k(null, 1)],
    },
    roofs: ['beams', 'truss', 'vault'], braced: true, duct: 'duct:spiral-450', glass: { clear: 'glass:float-6', other: 'glass:wired-6', low: 'slot' }, booth: { dado: 0.9 },
  },
  // concrete block or standing-seam cladding, a sealed floor or scored slabs; trusses, a sawtooth or beams
  utility: {
    surfaces: {
      floor: [d('epoxy', 6, { ...F, cols: 1, grit: 0.6 }), d('pavement', 6, { ...F, cols: 3, grit: 0.6 })],
      band: [d('tread', 1, { ...F, cols: 1, grit: 0.6 })],
      hazard: [k('lab:hazard', 0.6)],
      base: [l('block:cmu', 5, 'block', { grit: 0.5 }), d('plate', 3, { cols: 2, rows: 1, grit: 0.6 })],
      wall: [l('block:cmu', 5, 'block', { grit: 0.5 }), d('seam', 3, { cols: 4, grit: 0.5 })],
      crown: [d('corrugated', 2.4, { cols: 12, grit: 0.5 })],
      column: [d('plate', 3, { cols: 1, rows: 3, grit: 0.6 })],
      paint: [d('plate', 2, { cols: 1, rows: 2, grit: 0.6 })],
      services: [d('plate', 2, { cols: 1, rows: 1, grit: 0.5 })],
      trim: [k('steel-strut', 1.2)],
      ceiling: [d('corrugated', 3, { cols: 12, grit: 0.4 }), d('seam', 3, { cols: 4, grit: 0.4 })],
      soffit: [d('panel', 2.4, { cols: 2, rows: 2, grit: 0.4 }), l('board:acoustic-tile-600', 4, 'acoustic', { grit: 0.5 })],
      concrete: [d('concrete', 3, { cols: 2, rows: 2, grit: 0.5 })],
      beam: [d('plate', 4, { cols: 4, rows: 1, grit: 0.5 })],
      duct: [k('hull-plate', 1.5)],
      grate: [d('grating', 1, { ...F, grit: 0.4 })],
      infill: [d('perforated', 1, { cols: 2, rows: 1, grit: 0.5 })],
      cabinet: [d('matte', 1, { cols: 1, rows: 2, grit: 0.6 })],
      cable: [k(null, 1)],
    },
    roofs: ['truss', 'sawtooth', 'beams'], braced: true, duct: 'duct:rect-600x400', glass: { clear: 'glass:float-6', other: 'glass:wired-6', low: 'slot' }, booth: { dado: 1.0 },
  },
  // panels or glazed tile over a base band (or carbon fibre), a poured floor, terrazzo or studded rubber; a coffered
  // ceiling, beams or north lights
  science: {
    surfaces: {
      floor: [d('epoxy', 6, { ...F, cols: 1, grit: 0.3 }), d('terrazzo', 3, { ...F, cols: 2, rows: 2, grit: 0.3 }), d('studded', 1, { ...F, cols: 1, grit: 0.4 })],
      band: [d('grating', 1, { ...F, grit: 0.3 })],
      hazard: [k('lab:hazard', 0.6)],
      base: [d('panel', 2.4, { cols: 2, rows: 1, grit: 0.3 }), d('glazed', 1.2, { cols: 8, rows: 8, grit: 0.3 }), d('carbon', 0.5, { cols: 1, rows: 1, grit: 0.2 })],
      wall: [d('panel', 2.4, { cols: 2, rows: 1, grit: 0.25 }), d('glazed', 1.2, { cols: 8, rows: 16, grit: 0.25 })],
      crown: [d('panel', 2.4, { cols: 3, rows: 1, grit: 0.25 })],
      column: [d('panel', 2.4, { cols: 1, rows: 2, grit: 0.25 })],
      paint: [d('panel', 2, { cols: 1, rows: 2, grit: 0.3 })],
      services: [d('panel', 2, { cols: 1, rows: 1, grit: 0.3 })],
      trim: [k('steel-strut', 1.2)],
      ceiling: [d('panel', 2.4, { cols: 4, rows: 4, grit: 0.2 }), l('board:acoustic-tile-600', 4, 'acoustic', { grit: 0.2 })],
      soffit: [d('panel', 2.4, { cols: 4, rows: 4, grit: 0.2 }), l('board:acoustic-tile-600', 4, 'acoustic', { grit: 0.2 })],
      concrete: [d('concrete', 3, { cols: 2, rows: 2, grit: 0.3 })],
      beam: [d('panel', 2.4, { cols: 3, rows: 1, grit: 0.2 })],
      duct: [k('hull-plate', 1.5)],
      grate: [d('grating', 1, { ...F, grit: 0.3 })],
      infill: [d('perforated', 1, { cols: 2, rows: 1, grit: 0.3 })],
      cabinet: [d('carbon', 0.5, { cols: 1, rows: 1, grit: 0.2 }), d('matte', 1, { cols: 1, rows: 2, grit: 0.3 })],
      cable: [k(null, 1)],
    },
    roofs: ['coffer', 'beams', 'sawtooth'], braced: false, duct: 'duct:rect-600x400', glass: { clear: 'glass:low-iron-10', other: 'glass:acid-etched-6', low: 'punched' }, booth: { dado: 0 },
  },
  // drywall, veneer or painted block over a rubber base; carpet, vinyl, porcelain or laminate; a lay-in or drywall ceiling;
  // the shell turned down (a slim base and pilaster, a bulkhead crown, a hollow metal door frame)
  everyday: {
    surfaces: {
      floor: [l('floor:carpet-tile-500', 2, 'carpet', { ...F, grit: 0.4 }), l('floor:vct-305', 4, 'vinyl', { ...F, grit: 0.4 }), l('floor:porcelain-600', 2, 'porcelain', { ...F, grit: 0.3 }), l('floor:laminate-193', 6, 'laminate', { ...F, grit: 0.4 })],
      band: [l('floor:vct-305', 4, 'vinyl', { ...F, grit: 0.4 })],
      // (no hazard: a threshold strip and the stair's nosings in brushed aluminium, a contrast to find a step by)
      hazard: [d('tread', 0.6, { ...F, cols: 1, grit: 0.3 })],
      base: [d('matte', 1, { cols: 1, rows: 1, grit: 0.4 }), d('matte', 1, { cols: 1, rows: 1, grit: 0.4 })],
      wall: [l('board:gypsum-12.7', 2, 'drywall', { grit: 0.4 }), l('veneer:oak-crown', 2, 'veneer', { grit: 0.2 }), l('block:cmu', 5, 'block', { grit: 0.3 })],
      crown: [l('board:gypsum-12.7', 2, 'drywall', { grit: 0.3 })],
      column: [l('board:gypsum-12.7', 1, 'drywall', { grit: 0.4 })],
      paint: [d('matte', 2, { cols: 1, rows: 2, grit: 0.4 })],
      services: [d('matte', 2, { cols: 1, rows: 1, grit: 0.4 })],
      cabinet: [d('matte', 1, { cols: 1, rows: 2, grit: 0.3 })],
      cable: [k(null, 1)],
      trim: [k('steel-strut', 1.2)],
      ceiling: [d('corrugated', 3, { cols: 12, grit: 0.3 }), l('board:acoustic-tile-600', 4, 'acoustic', { grit: 0.3 })],
      soffit: [l('board:acoustic-tile-600', 4, 'acoustic', { grit: 0.3 }), l('board:gypsum-12.7', 2, 'drywall', { grit: 0.3 })],
      concrete: [d('concrete', 3, { cols: 2, rows: 2, grit: 0.4 })],
      beam: [d('matte', 4, { cols: 4, rows: 1, grit: 0.3 })],
      duct: [k('hull-plate', 1.5)],
      grate: [d('grating', 1, { ...F, grit: 0.3 })],
      infill: [d('perforated', 1, { cols: 2, rows: 1, grit: 0.3 })],
    },
    roofs: ['beams', 'truss', 'coffer'], braced: false, duct: 'duct:spiral-450', glass: { clear: 'glass:float-6', other: 'glass:acid-etched-6', low: 'punched' }, booth: { dado: 0 },
    door: { width: 1.8, height: 2.7, frame: 0.1, out: 0.03 },
    shell: { base: { h: 0.12, out: 0.015 }, crown: { h: 0.5, out: 0.06 }, pilaster: { w: 0.4, out: 0.1, foot: 0.12 }, door: { frame: 0.1, out: 0.03, sill: 0.12 } },
  },
});

export const PALETTES = Object.freeze({
  // cool steel greys, signal orange the secondary paint, olive services
  military: {
    floor: [s([70, 78, 86], [28, 30, 33]), s([64, 72, 64], [28, 30, 28])],
    band: [s([122, 126, 128], [20, 21, 23])],
    // (a construction that lays its hazard as a tread, not the library's stripe, paints it here)
    hazard: [s([150, 154, 156], [60, 62, 64])],
    base: [s([46, 52, 58], [150, 152, 150]), s([62, 66, 70], [44, 46, 48])],
    wall: [s([72, 82, 92], [150, 152, 150]), s([104, 108, 112], [80, 82, 84]), s([62, 70, 76])],
    crown: [s([58, 64, 70], [80, 80, 80])],
    column: [s([60, 68, 76], [150, 152, 150])],
    paint: [s([182, 88, 40], [150, 152, 150])],
    services: [s([86, 98, 64], [150, 152, 150])],
    ceiling: [s([40, 44, 50], [60, 60, 60]), s([48, 52, 58], [60, 60, 60])],
    soffit: [s([58, 64, 70], [22, 24, 26]), s([70, 76, 82], [16, 17, 19])],
    concrete: [s([110, 114, 118], [80, 82, 84])],
    beam: [s([66, 72, 78], [150, 152, 150])],
    grate: [s([128, 132, 134], [20, 21, 23])],
    infill: [s([112, 118, 124], [18, 19, 21])],
    cabinet: [s([72, 80, 62])],
  },
  // warm greys and pale block, yellow steel, safety green the secondary paint, blue services
  utility: {
    floor: [s([128, 126, 120], [60, 58, 54]), s([132, 128, 120], [80, 78, 72])],
    band: [s([122, 124, 124], [60, 60, 62])],
    hazard: [s([176, 178, 178], [80, 80, 82])],
    base: [s([96, 104, 98], [84, 90, 86]), s([58, 82, 70], [150, 152, 150])],
    wall: [s([168, 164, 154], [140, 136, 128]), s([104, 118, 128], [80, 80, 80])],
    crown: [s([150, 152, 148], [100, 100, 100])],
    column: [s([186, 150, 52], [150, 152, 150])],
    paint: [s([46, 122, 84], [150, 152, 150])],
    services: [s([52, 92, 150], [150, 152, 150])],
    ceiling: [s([120, 122, 120], [80, 80, 80]), s([130, 132, 128], [80, 80, 80])],
    soffit: [s([176, 176, 170], [60, 60, 60]), s([212, 210, 202], [190, 190, 186])],
    concrete: [s([150, 148, 142], [110, 108, 104])],
    beam: [s([110, 114, 116], [150, 152, 150])],
    grate: [s([150, 152, 150], [24, 24, 26])],
    infill: [s([150, 154, 150], [24, 24, 26])],
    cabinet: [s([150, 152, 146])],
  },
  // whites and pale greys over a teal base band, deep blue the secondary paint, violet services
  science: {
    floor: [s([196, 202, 204], [120, 126, 130]), s([206, 204, 198], [80, 110, 130]), s([56, 92, 96], [40, 40, 40])],
    band: [s([170, 176, 180], [36, 40, 44])],
    hazard: [s([200, 204, 206], [90, 94, 96])],
    base: [s([52, 120, 128], [24, 30, 32]), s([60, 132, 138], [150, 170, 170]), s([44, 46, 50], [40, 42, 46])],
    wall: [s([216, 222, 224], [40, 44, 48]), s([222, 232, 230], [176, 186, 186])],
    crown: [s([176, 184, 188], [40, 44, 48])],
    column: [s([190, 196, 200], [40, 44, 48])],
    paint: [s([44, 74, 150], [24, 28, 40])],
    services: [s([118, 72, 150], [40, 30, 50])],
    ceiling: [s([180, 186, 190], [70, 74, 78]), s([222, 224, 222], [200, 204, 206])],
    soffit: [s([210, 214, 216], [80, 84, 88]), s([224, 226, 224], [204, 208, 210])],
    concrete: [s([196, 198, 196], [150, 152, 150])],
    beam: [s([196, 202, 206], [40, 44, 48])],
    grate: [s([176, 180, 184], [36, 40, 44])],
    infill: [s([206, 210, 212], [40, 44, 48])],
    cabinet: [s([44, 46, 50], [40, 42, 46]), s([214, 218, 220])],
  },
  // warm whites and neutral greys, the catalog's carpet, vinyl, porcelain, laminate and oak their own, a muted teal the
  // secondary paint; the air neutral (an everyday room is lit white, not blue)
  everyday: {
    ambient: '#45443f',
    floor: [m([150, 140, 120]), m([150, 140, 124]), m([120, 118, 112]), m([110, 78, 50])],
    band: [s([120, 118, 112], [90, 88, 84])],
    hazard: [s([176, 178, 178], [80, 80, 82])],
    base: [s([52, 52, 54]), s([84, 72, 60])],
    wall: [s([214, 208, 196], [200, 196, 186]), m([40, 30, 24]), s([204, 202, 194], [186, 184, 176])],
    crown: [s([226, 222, 212], [210, 206, 196])],
    column: [s([222, 218, 208], [206, 202, 192])],
    paint: [s([56, 92, 110])],
    services: [s([150, 154, 156])],
    cabinet: [s([206, 202, 192])],
    ceiling: [s([210, 212, 210], [160, 160, 160]), s([226, 226, 220], [210, 210, 206])],
    soffit: [s([228, 226, 220], [212, 212, 208]), s([232, 230, 224], [220, 218, 212])],
    concrete: [s([180, 178, 172], [140, 138, 134])],
    beam: [s([200, 202, 204])],
    grate: [s([170, 172, 172], [30, 30, 32])],
    infill: [s([210, 212, 212], [40, 42, 44])],
  },
});

export const PLOTS = Object.freeze({
  // cool strips and white lamps, the secondary a warm signal against the cool key: a red-orange cove, amber at the doors
  military: {
    light: { strip: { color: '#cfe4ff', fill: '#eef6ff', intensity: 0.9, radius: 6.5 }, highbay: { color: '#e4ecff', fill: '#f4f8ff', intensity: 1.5, radius: 15, twoRows: 9, drop: 1.4, r: 0.36, h: 0.45 },
      ceilingStrip: { color: '#d8e8ff', fill: '#f2f8ff', intensity: 1.0, radius: 6 }, inset: { color: '#8fc8ff', fill: '#cfe8ff', intensity: 0.35, radius: 2.6 },
      door: { color: '#ffa030', fill: '#ffc070', intensity: 0.5, radius: 3.8 }, cove: { color: '#ff5a28', fill: '#ff9a70', intensity: 0.6, radius: 7 },
      down: { color: '#ffb060', fill: '#ffd8a0', intensity: 0.45, radius: 4.2 }, daylight: { color: '#cfe0ff', fill: '#e8f0ff', intensity: 0.9, radius: 12 }, coffer: { color: '#e8f0ff', fill: '#f8fbff', intensity: 1.0, radius: 8 } },
    booth: { screen: '#ffb060' },
  },
  // white lamps, the secondary sodium amber among them
  utility: {
    light: { strip: { color: '#fff0d8', fill: '#fff8ec', intensity: 0.8, radius: 6 }, highbay: { color: '#f4f6ff', fill: '#fbfcff', intensity: 1.6, radius: 16, twoRows: 9, drop: 1.4, r: 0.36, h: 0.45 },
      ceilingStrip: { color: '#fff0dc', fill: '#fff8f0', intensity: 1.0, radius: 6 }, inset: { color: '#ffd890', fill: '#fff0c8', intensity: 0.3, radius: 2.4 },
      door: { color: '#ff9a30', fill: '#ffc070', intensity: 0.5, radius: 3.8 }, cove: { color: '#ffa848', fill: '#ffd090', intensity: 0.6, radius: 7 },
      down: { color: '#ffc070', fill: '#ffe0b0', intensity: 0.45, radius: 4.2 }, daylight: { color: '#e8f0ff', fill: '#f4f8ff', intensity: 1.0, radius: 14 }, coffer: { color: '#fff4e0', fill: '#fffaf0', intensity: 1.0, radius: 8 } },
    booth: { screen: '#a0f0b0' },
  },
  // cold white, the secondary teal and blue in it
  science: {
    light: { strip: { color: '#e8f8ff', fill: '#f6fcff', intensity: 0.9, radius: 6.5 }, highbay: { color: '#eef8ff', fill: '#fafdff', intensity: 1.5, radius: 15, twoRows: 9, drop: 1.4, r: 0.36, h: 0.45 },
      ceilingStrip: { color: '#eef8ff', fill: '#fafdff', intensity: 1.1, radius: 6.5 }, inset: { color: '#7fe8e0', fill: '#c8fff8', intensity: 0.3, radius: 2.4 },
      door: { color: '#40d0c0', fill: '#a0fff0', intensity: 0.45, radius: 3.6 }, cove: { color: '#30d8e0', fill: '#a8f8ff', intensity: 0.55, radius: 7 },
      down: { color: '#80b8ff', fill: '#d0e4ff', intensity: 0.4, radius: 4 }, daylight: { color: '#f0f8ff', fill: '#fafdff', intensity: 1.0, radius: 13 }, coffer: { color: '#f4fbff', fill: '#ffffff', intensity: 1.0, radius: 8 } },
  },
  // neutral white, warm downlights and coves, the exit sign's green over each door; no strip on the pilasters
  everyday: {
    light: { strip: { color: '#fff4e8', fill: '#fffaf4', intensity: 0.8, radius: 6 }, highbay: { color: '#fff8f0', fill: '#fffcf8', intensity: 1.4, radius: 15, twoRows: 9, drop: 1.4, r: 0.36, h: 0.45 },
      ceilingStrip: { color: '#fff6ec', fill: '#fffbf6', intensity: 1.0, radius: 6 }, inset: { color: '#ffe8c8', fill: '#fff4e4', intensity: 0.3, radius: 2.4 },
      door: { color: '#30e070', fill: '#a0ffc0', intensity: 0.35, radius: 3 }, cove: { color: '#ffc890', fill: '#ffe4c4', intensity: 0.55, radius: 7 },
      down: { color: '#ffd0a0', fill: '#ffe8cc', intensity: 0.45, radius: 4.2 }, daylight: { color: '#eef4ff', fill: '#f8faff', intensity: 1.0, radius: 13 }, coffer: { color: '#fff4e4', fill: '#fffaf2', intensity: 1.0, radius: 8 } },
    booth: { screen: '#d0e8ff' },
    shell: { pilaster: { strip: { w: 0.09, z0: 0.9, len: 0, every: 1 } } },
  },
});

export const DRESSINGS = Object.freeze({
  // the shell as it stands: the grating band and a pad on a wide floor, services every other bay, a crane in a tall room
  military: {},
  utility: {},
  science: {},
  // turned down: no grating band, no pad, services every third bay, no crane
  everyday: { shell: { floor: { minSpan: 1e9 }, pad: { minSpan: 1e9 }, services: { every: 3 } }, craned: false },
});

export const REGISTER_PRESETS = Object.freeze(Object.fromEntries(Object.keys(CONSTRUCTIONS).map((r) => [r, Object.freeze({ construction: r, palette: r, plot: r, dressing: r })])));
