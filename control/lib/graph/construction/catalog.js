// construction/catalog — every building material by one name, and the assemblies built of them.
//
// A name is `<kind>:<which>`: `timber:hinoki`, `finish:urushi`, `brick:red`, `stone:marble-carrara`, `steel:HEA200`,
// `concrete:grey`, `board:gypsum-12.7`, `insulation:glass-wool`, `plaster:jura`, `clay:arakabe`, `paper:washi`,
// `cable:nm-b-14-2`, `box:nm-single`. The tables the construction modules already hold (timbers, finishes, brick bodies,
// stones, steel sections and finishes) are named here as they are; the rest (boards, insulation, plasters, clays,
// papers, cables, boxes, panels, roof coverings) are added. Each entry carries its kind, a colour, and what a takeoff or
// a check reads (thickness, density, conductor size, ampacity, R-value). An entry may carry its MAP, the surface it
// draws with: `{ texture, tileM }` (a surface-texture key and the metres one tile spans) or, for a roof covering laid as
// tiles, `{ covering }` (the covering whose map roofing.js bakes in the entry's colour).
//
// An ASSEMBLY is a wall, floor or ceiling type as ordered layers from the outside (or the underside) in — the IFC
// material-layer set — `{ use, tradition, layers: [{ material, mm, role }] }`. A TRADITION names the assemblies it
// builds with and the wiring rules it follows. A generator names an assembly or a tradition; nothing that names none
// changes.
import { TIMBERS, FINISHES } from './timber.js';
import { BODIES, STONES, MORTARS } from './masonry.js';
import { SECTIONS } from './sections.js';
import { STEEL_FINISHES, CONCRETE_FINISHES, REBAR_FINISHES } from './finishes.js';

const E = (kind, rgb, extra = {}) => Object.freeze({ kind, rgb, ...extra });

const ADDED = {
  // boards: gypsum (North American ½ in and ⅝ in type X; British 12.5 mm), sheathing and subfloor
  'board:gypsum-12.7': E('board', [233, 230, 222], { mm: 12.7, sheet: [1219, 2438], density: 680, label: '½ in gypsum board' }),
  'board:gypsum-15.9-x': E('board', [228, 224, 218], { mm: 15.9, sheet: [1219, 2438], density: 720, label: '⅝ in type X gypsum board' }),
  'board:plasterboard-12.5': E('board', [226, 224, 218], { mm: 12.5, sheet: [1200, 2400], density: 680, label: '12.5 mm plasterboard' }),
  'board:osb-11': E('board', [201, 164, 106], { mm: 11.1, sheet: [1219, 2438], density: 620, label: '7/16 in OSB sheathing' }),
  'board:osb-19': E('board', [201, 164, 106], { mm: 19, sheet: [1219, 2438], density: 620, label: '¾ in OSB subfloor' }),
  'board:sip-165': E('board', [206, 170, 110], { mm: 165, sheet: [1219, 2438], density: 90, rsi: 4.2, label: '6½ in structural insulated panel' }),
  'board:sugi-floor': E('board', [206, 164, 118], { mm: 15, sheet: [180, 3640], density: 380, label: 'sugi floorboard' }),
  'board:sugi-ceiling': E('board', [214, 176, 132], { mm: 9, sheet: [300, 1820], density: 380, label: 'sugi ceiling board' }),
  // insulation
  'insulation:glass-wool': E('insulation', [232, 168, 176], { density: 12, rsiPerMm: 0.0245, label: 'glass-wool batt' }),
  'insulation:mineral-wool': E('insulation', [196, 162, 102], { density: 40, rsiPerMm: 0.027, label: 'mineral-wool batt' }),
  // plasters and renders
  'plaster:gypsum-two-coat': E('plaster', [222, 190, 172], { mm: 13, density: 1000, label: 'browning and skim (fresh)' }),
  'plaster:lime': E('plaster', [236, 230, 216], { mm: 20, density: 1600, label: 'lime plaster' }),
  'plaster:render': E('plaster', [214, 208, 196], { mm: 15, density: 1800, label: 'cement render' }),
  'plaster:shikkui': E('plaster', [244, 242, 236], { mm: 3, density: 1400, label: 'shikkui (slaked lime)' }),
  'plaster:jura': E('plaster', [204, 172, 124], { mm: 3, density: 1500, label: 'jūraku finish' }),
  // Japanese clay wall: bamboo lath, rough coat, middle coat
  'bamboo:komai': E('bamboo', [198, 176, 118], { mm: 20, spacingMm: 45, label: 'komai bamboo lath' }),
  'clay:arakabe': E('clay', [122, 98, 66], { mm: 50, density: 1500, label: 'arakabe (rough clay coat)' }),
  'clay:nakanuri': E('clay', [150, 124, 88], { mm: 10, density: 1600, label: 'nakanuri (middle coat)' }),
  // papers
  'paper:washi': E('paper', [244, 240, 228], { label: 'washi (shoji paper)' }),
  'paper:karakami': E('paper', [228, 218, 192], { label: 'karakami (fusuma paper)' }),
  // blocks
  'block:cmu': E('block', [168, 166, 160], { mm: 190, density: 2000, label: 'concrete block' }),
  // cables: conductor size, ampacity (A), the outer size to draw (mm), per-metre mass
  'cable:nm-b-14-2': E('cable', [236, 234, 226], { conductor: '14 AWG', mm2: 2.08, amps: 15, dia: 9, kgPerM: 0.09, label: 'NM-B 14/2 with ground' }),
  'cable:nm-b-12-2': E('cable', [228, 196, 60], { conductor: '12 AWG', mm2: 3.31, amps: 20, dia: 10, kgPerM: 0.13, label: 'NM-B 12/2 with ground' }),
  'cable:nm-b-10-2': E('cable', [222, 124, 50], { conductor: '10 AWG', mm2: 5.26, amps: 30, dia: 12, kgPerM: 0.19, label: 'NM-B 10/2 with ground' }),
  'cable:te-1.5': E('cable', [150, 150, 152], { conductor: '1.5 mm²', mm2: 1.5, amps: 6, dia: 8, kgPerM: 0.07, label: '1.5 mm² twin and earth' }),
  'cable:te-2.5': E('cable', [140, 140, 144], { conductor: '2.5 mm²', mm2: 2.5, amps: 32, dia: 9, kgPerM: 0.1, label: '2.5 mm² twin and earth (ring)' }),
  'cable:vvf-1.6': E('cable', [214, 214, 210], { conductor: '1.6 mm', mm2: 2.0, amps: 15, dia: 10, kgPerM: 0.1, label: 'VVF 1.6-2C' }),
  'cable:vvf-2.0': E('cable', [204, 204, 200], { conductor: '2.0 mm', mm2: 3.14, amps: 20, dia: 11, kgPerM: 0.13, label: 'VVF 2.0-2C' }),
  'cable:conduit-20': E('cable', [150, 154, 158], { conductor: '2.5 mm² in 20 mm conduit', mm2: 2.5, amps: 16, dia: 20, kgPerM: 0.18, label: '20 mm PVC conduit' }),
  'raceway:moulding': E('raceway', [238, 232, 216], { dia: 18, label: 'surface moulding' }),
  // boxes, devices, panels (size in mm: width, height, depth)
  'box:nm-single': E('box', [46, 96, 176], { size: [57, 92, 76], label: 'single-gang nail-on box' }),
  'box:uk-metal': E('box', [168, 170, 174], { size: [86, 86, 35], label: 'single metal back box' }),
  'box:jp-switch': E('box', [230, 226, 214], { size: [56, 104, 36], label: 'switch box' }),
  'box:ceiling': E('box', [46, 96, 176], { size: [102, 102, 54], label: 'ceiling box' }),
  'plate:white': E('plate', [246, 246, 242], { size: [70, 115, 6], label: 'cover plate' }),
  'panel:loadcenter': E('panel', [148, 150, 156], { size: [368, 762, 100], label: 'load center' }),
  'panel:consumer-unit': E('panel', [238, 238, 234], { size: [400, 250, 110], label: 'consumer unit' }),
  'panel:bunden-ban': E('panel', [236, 236, 232], { size: [520, 330, 100], label: 'bunden-ban (distribution board)' }),
  // roof coverings. The library's roof textures are named as they are (their map is that texture, one tile a yard
  // across); the rest are laid as tiles (construction/roofing.js), their map baked from the covering in their colour.
  'roofing:shingle-weathered': E('roofing', [86, 90, 92], { map: { texture: 'shingle-weathered', tileM: 0.9144 }, density: 1100, label: 'asphalt shingle, weathered grey' }),
  'roofing:shingle-brown': E('roofing', [96, 78, 58], { map: { texture: 'shingle-brown', tileM: 0.9144 }, density: 1100, label: 'asphalt shingle, brown' }),
  'roofing:shingle-green': E('roofing', [68, 82, 66], { map: { texture: 'shingle-green', tileM: 0.9144 }, density: 1100, label: 'asphalt shingle, green' }),
  'roofing:clay-terracotta': E('roofing', [172, 88, 56], { map: { texture: 'clay-terracotta', tileM: 0.9144 }, density: 1900, label: 'clay barrel tile, terracotta' }),
  'roofing:clay-sand': E('roofing', [188, 140, 94], { map: { texture: 'clay-sand', tileM: 0.9144 }, density: 1900, label: 'clay barrel tile, sand' }),
  'roofing:clay-slate': E('roofing', [96, 102, 108], { map: { texture: 'clay-slate', tileM: 0.9144 }, density: 1900, label: 'clay barrel tile, slate grey' }),
  'roofing:shake-cedar': E('roofing', [150, 112, 78], { map: { covering: 'cedar-shake' }, density: 380, label: 'split cedar shake' }),
  'roofing:slate-blue': E('roofing', [84, 92, 104], { map: { covering: 'slate' }, density: 2800, label: 'natural slate, blue-grey (Welsh)' }),
  'roofing:slate-grey': E('roofing', [104, 106, 108], { map: { covering: 'slate' }, density: 2800, label: 'natural slate, grey' }),
  'roofing:plain-tile-red': E('roofing', [150, 70, 48], { map: { covering: 'plain-tile' }, density: 1900, label: 'clay plain tile' }),
  'roofing:pantile-red': E('roofing', [168, 82, 52], { map: { covering: 'pantile' }, density: 1900, label: 'clay pantile' }),
  'roofing:kawara-ibushi': E('roofing', [92, 96, 102], { map: { covering: 'kawara' }, density: 1900, label: 'ibushi kawara (smoked silver-grey)' }),
  'roofing:standing-seam-zinc': E('roofing', [150, 156, 160], { map: { covering: 'standing-seam' }, density: 7140, label: 'standing-seam zinc' }),
  'roofing:standing-seam-charcoal': E('roofing', [62, 66, 70], { map: { covering: 'standing-seam' }, density: 7850, label: 'standing-seam steel, charcoal' }),
  'roofing:felt': E('roofing', [58, 56, 54], { label: 'roofing underlay' }),
  'roofing:membrane': E('roofing', [52, 54, 56], { label: 'single-ply roof membrane' }),
  // lay-in ceiling tiles: the tile and its T-bar grid are the map, two tiles a side
  'board:acoustic-tile-2x2': E('board', [236, 234, 228], { mm: 16, sheet: [610, 610], density: 250, map: { texture: 'ceiling:lay-in', tileM: 1.2192 }, label: '2 × 2 ft lay-in acoustic tile' }),
  'board:acoustic-tile-600': E('board', [236, 234, 228], { mm: 15, sheet: [600, 600], density: 250, map: { texture: 'ceiling:lay-in', tileM: 1.2 }, label: '600 mm lay-in acoustic tile' }),
  // rainwater: gutters, downpipes and chains, what they stand in at grade, and the drain below
  'gutter:k-style-aluminium': E('gutter', [236, 236, 230], { mm: 127, density: 2700, label: '5 in K-style aluminium gutter' }),
  'gutter:half-round-112': E('gutter', [44, 44, 46], { mm: 112, density: 1400, label: '112 mm half-round uPVC gutter' }),
  'gutter:nokidoi-copper-105': E('gutter', [176, 104, 64], { mm: 105, density: 8900, label: '105 mm half-round copper nokidoi' }),
  'gutter:box-zinc-125': E('gutter', [150, 156, 160], { mm: 125, density: 7140, label: '125 mm zinc box gutter' }),
  'pipe:downspout-3x4': E('pipe', [236, 236, 230], { size: [76, 102], density: 2700, label: '3 × 4 in aluminium downspout' }),
  'pipe:downpipe-68': E('pipe', [44, 44, 46], { size: [68], density: 1400, label: '68 mm round uPVC downpipe' }),
  'pipe:tatedoi-copper-60': E('pipe', [176, 104, 64], { size: [60], density: 8900, label: '60 mm copper tatedoi' }),
  'pipe:downpipe-80-zinc': E('pipe', [150, 156, 160], { size: [80], density: 7140, label: '80 mm zinc downpipe' }),
  'pipe:drain-110': E('pipe', [196, 112, 58], { size: [110], density: 1400, label: '110 mm uPVC below-ground drain' }),
  'chain:kusari-copper': E('chain', [176, 104, 64], { size: [60], density: 8900, label: 'kusari-doi (copper rain chain)' }),
  'precast:splash-block': E('precast', [176, 174, 168], { density: 2400, label: 'concrete splash block' }),
  'fitting:gully': E('fitting', [70, 72, 74], { label: 'back-inlet gully' }),
  'fitting:masu': E('fitting', [150, 150, 146], { label: 'masu (rainwater pit)' }),
  'chamber:inspection': E('chamber', [96, 98, 100], { label: 'inspection chamber' }),
  'stone:amaochi': E('stone', [112, 110, 104], { density: 2600, label: 'amaochi-ishi (drip stone)' }),
  'board:nojiita': E('board', [196, 160, 112], { mm: 12, sheet: [180, 3640], density: 380, label: 'nojiita (sugi roof boards)' }),
};

/** Every material, by name. */
export const CATALOG = Object.freeze({
  ...Object.fromEntries(Object.entries(TIMBERS).map(([k, t]) => [`timber:${k}`, E('timber', t.base, { density: t.density, label: k })])),
  ...Object.fromEntries(Object.keys(FINISHES).map((k) => [`finish:${k}`, E('finish', null, { label: k })])),
  ...Object.fromEntries(Object.entries(BODIES).map(([k, rgb]) => [`brick:${k}`, E('brick', rgb, { density: 1900, label: `${k} brick` })])),
  ...Object.fromEntries(Object.entries(MORTARS).map(([k, rgb]) => [`mortar:${k}`, E('mortar', rgb, { label: `${k} mortar` })])),
  ...Object.fromEntries(Object.keys(STONES).map((k) => [`stone:${k}`, E('stone', null, { density: 2600, label: k })])),
  ...Object.fromEntries(Object.keys(SECTIONS).map((k) => [`steel:${k}`, E('steel', STEEL_FINISHES.mill, { density: 7850, label: k })])),
  ...Object.fromEntries(Object.entries(STEEL_FINISHES).map(([k, rgb]) => [`steel-finish:${k}`, E('finish', rgb, { label: k })])),
  ...Object.fromEntries(Object.entries(CONCRETE_FINISHES).map(([k, rgb]) => [`concrete:${k}`, E('concrete', rgb, { density: 2400, label: `${k} concrete` })])),
  ...Object.fromEntries(Object.entries(REBAR_FINISHES).map(([k, rgb]) => [`rebar:${k}`, E('rebar', rgb, { density: 7850, label: `${k} rebar` })])),
  ...ADDED,
});

/** The entry for a name, or null. */
export const material = (name) => CATALOG[name] || null;
/** Why a name is not in the catalog, or null. */
export const materialError = (name) => (CATALOG[name] ? null : `'${name}' is not in the catalog (kinds: ${[...new Set(Object.values(CATALOG).map((e) => e.kind))].join(', ')})`);

const L = (material, mm, role) => ({ material, mm, role });
/** Wall, floor and ceiling types, layers from the outside (or underside) in. */
export const ASSEMBLIES = Object.freeze({
  'na-2x6-exterior': { use: 'wall-exterior', tradition: 'north-american', layers: [L('board:osb-11', 11.1, 'sheathing'), L('timber:douglas-fir', 140, 'structure'), L('insulation:glass-wool', 140, 'cavity'), L('board:gypsum-12.7', 12.7, 'lining')] },
  'na-2x4-partition': { use: 'wall-interior', tradition: 'north-american', layers: [L('board:gypsum-12.7', 12.7, 'lining'), L('timber:douglas-fir', 89, 'structure'), L('board:gypsum-12.7', 12.7, 'lining')] },
  'na-sip-enclosure': { use: 'wall-exterior', tradition: 'north-american', layers: [L('board:sip-165', 165, 'enclosure')] },
  'na-ceiling': { use: 'ceiling', tradition: 'north-american', layers: [L('board:gypsum-12.7', 12.7, 'lining')] },
  'uk-solid-brick': { use: 'wall-exterior', tradition: 'british', layers: [L('brick:red', 215, 'structure'), L('plaster:gypsum-two-coat', 13, 'lining')] },
  'uk-stud-partition': { use: 'wall-interior', tradition: 'british', layers: [L('board:plasterboard-12.5', 12.5, 'lining'), L('timber:spruce', 89, 'structure'), L('board:plasterboard-12.5', 12.5, 'lining')] },
  'uk-ceiling': { use: 'ceiling', tradition: 'british', layers: [L('board:plasterboard-12.5', 12.5, 'lining')] },
  'jp-shinkabe': { use: 'wall', tradition: 'japanese', layers: [L('plaster:jura', 3, 'finish'), L('clay:nakanuri', 10, 'coat'), L('clay:arakabe', 50, 'coat'), L('bamboo:komai', 20, 'lath'), L('clay:nakanuri', 10, 'coat'), L('plaster:jura', 3, 'finish')] },
  'jp-shinkabe-exterior': { use: 'wall-exterior', tradition: 'japanese', layers: [L('plaster:shikkui', 3, 'finish'), L('clay:nakanuri', 10, 'coat'), L('clay:arakabe', 50, 'coat'), L('bamboo:komai', 20, 'lath'), L('clay:nakanuri', 10, 'coat'), L('plaster:jura', 3, 'finish')] },
  'jp-saobuchi-ceiling': { use: 'ceiling', tradition: 'japanese', layers: [L('board:sugi-ceiling', 9, 'lining')] },
  'rc-block-infill': { use: 'wall-exterior', tradition: 'metric', layers: [L('plaster:render', 15, 'finish'), L('block:cmu', 190, 'infill'), L('plaster:gypsum-two-coat', 13, 'lining')] },
  'na-suspended-ceiling': { use: 'ceiling', tradition: 'north-american', layers: [L('board:acoustic-tile-2x2', 16, 'lining')] },
  'metric-suspended-ceiling': { use: 'ceiling', tradition: 'metric', layers: [L('board:plasterboard-12.5', 12.5, 'lining')] },
  'metric-stud-partition': { use: 'wall-interior', tradition: 'metric', layers: [L('board:plasterboard-12.5', 12.5, 'lining'), L('timber:spruce', 89, 'structure'), L('board:plasterboard-12.5', 12.5, 'lining')] },
});

/** How a tradition builds: its assemblies (`suspended` the ceiling hung under a steel or concrete floor), its wiring rules. */
export const TRADITIONS = Object.freeze({
  'north-american': { exterior: 'na-2x6-exterior', partition: 'na-2x4-partition', ceiling: 'na-ceiling', suspended: 'na-suspended-ceiling', wiring: 'nec' },
  british: { exterior: 'uk-solid-brick', partition: 'uk-stud-partition', ceiling: 'uk-ceiling', suspended: 'metric-suspended-ceiling', wiring: 'bs' },
  japanese: { exterior: 'jp-shinkabe-exterior', partition: 'jp-shinkabe', ceiling: 'jp-saobuchi-ceiling', suspended: 'metric-suspended-ceiling', wiring: 'jp' },
  metric: { exterior: 'rc-block-infill', partition: 'metric-stud-partition', ceiling: null, suspended: 'metric-suspended-ceiling', wiring: 'iec' },
});
export const TRADITION_KEYS = Object.freeze(Object.keys(TRADITIONS));
/** The tradition a structural system is built in when the recipe names none. */
export const TRADITION_OF = Object.freeze({ platform: 'north-american', 'post-and-beam': 'north-american', steel: 'north-american', masonry: 'british', kigumi: 'japanese', concrete: 'metric' });

/** The overall thickness (mm) and thermal resistance (m²K/W, where known) of an assembly. */
export function assemblyProps(name) {
  const a = ASSEMBLIES[name];
  if (!a) return null;
  let mm = 0, rsi = 0;
  for (const l of a.layers) {
    const m = CATALOG[l.material];
    if (l.role !== 'cavity') mm += l.mm;
    if (m && m.rsiPerMm) rsi += m.rsiPerMm * l.mm; else if (m && m.rsi) rsi += m.rsi;
  }
  return { mm: Math.round(mm * 10) / 10, rsi: Math.round(rsi * 100) / 100 };
}
