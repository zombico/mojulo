/**
 * THE FLOORPLAN'S WORLD DEFAULTS — the house concern's numbers, in a module that reads no other, so any module of the
 * floorplan's import cycle (floorplan-structure → scene → … → structure/programs → floorplan-building → back) can read
 * them as it loads. floorplan-structure.js re-exports them: import from there, unless you are inside that cycle and
 * read them at load (floorplan-building's BUILDING_DEFAULTS).
 */
// ── world defaults — MODERN HOUSE, one world unit = one FOOT ──────────────────
// Proportions tuned to contemporary residential construction: a generous 9 ft
// main floor, exterior walls thicker than interior partitions, and a single
// shared HEAD LINE (6 ft 10 in) that every door and window top aligns to — the
// real design discipline that makes openings read as built rather than punched.
export const FLOORPLAN_DEFAULTS = {
  wallHeight: 10,           // ~10 ft main-floor ceiling — realistic house, a touch generous
  upperHeight: 8,          // upper storeys at a standard 8 ft, lower than the main floor
  basementHeight: 7.5,     // basements run lower still
  wallThickness: 0.42,     // interior partition ~5 in (2×4 stud + drywall both sides)
  exteriorThickness: 0.67, // exterior wall ~8 in (2×6 stud + sheathing + finish)
  floorDrop: 1.1,          // floor/joist assembly ~13 in
  floorStyle: null,        // floor finish over the slab: null/'plain' | 'floorboards' | 'marble' | 'auto' (wet rooms marble, else floorboards)
  floorboardTint: '#8f7d64', // wood plank floor: a muted oak, half way to a warm grey of its lightness
  marbleTint: '#e2ded5',   // marble / stone tile floor
  doorWidth: 3,            // 36 in leaf — generous/accessible, reads right under 9 ft ceilings
  doorClearance: 3,        // approach depth kept furniture-free each side of a doorway (open-plan walkability) — 0.91 m (was 2.5: 0.76 m)
  doorHeight: 6.83,        // 6 ft 10 in — the shared head line
  headHeight: 6.83,        // door + window tops align here
  windowWidth: 3,          // 36 in
  windowSill: 3,           // sill 3 ft off the floor
  windowTop: 6.83,         // head aligned with the door head line
  windowMullionAt: 4.5,    // windows wider than this get a centre mullion (reads as 2 sashes)
  windowStyle: null,       // divided-light pattern: null = per-facade default; or 'picture'|'casement'|'double-hung'|'colonial'|'transom'|'french'|'german'
  doubleEntry: false,      // opt-in: a paired double-leaf front door (wider opening + centre mullion)
  windows: false,          // opt-in perimeter windows on room cells
  ceilings: false,         // opt-in ceiling planes (default: open-roof doll-house)
  xrayWalls: false,        // opt-in: render the outer envelope as a see-through wireframe cage
  furnish: false,          // opt-in: populate each registered room with its archetype furniture
  furnishScale: 'feet',    // 'feet' (legacy: arrangers size pieces in fixed feet) | 'share' (preset share of the floor, banded + budgeted)
  furnishing: null,        // opt-in: 'constructed' — the pieces built on the workbench (construction/facades.js) in place of the simpler ones;
                           // 'composed' — each piece a style in the house's furniture language (furnishings/languages.js)
  furnitureLanguage: null, // composed: a language (furnishings/languages.js) over the house style's
  furniture: null,         // composed: { <role>: { like?, forms?, finish? } | 'omit' } for every room (a room's own `furniture` wins)
  layout: null,            // 'varied': each room's arrangement keyed on the house seed, with a seeded variant, mirror and turn (floorplan-glyphs variedLayout)
  contactShadows: false,   // opt-in: a soft ambient-occlusion decal on the floor under each piece of furniture (the unbaked tier's grounding)
  wallMaterial: null,      // opt-in: a procedural-material preset the interior paint swath carries into the World tier ('plaster'); needs wallDecor
  floorTexture: null,      // opt-in: a surface-textures tile on the floor finish — 'auto' (oak boards / carrara marble by style) | a tile key | null. World + exports; the CSS still keeps its fill
  floorTextureTile: 10,    // feet per wood-tile repeat ALONG the boards (3 ft across — the ring width)
  potLights: null,         // opt-in recessed ceiling downlights: true | { spacing, inset, candela, color, innerCone, outerCone, pool, k } — cans in the ceiling, pools on the floor + furniture (the unlit World bakes them), a KHR_lights_punctual spot per can in the GLB (Blender / Godot / Unreal light them for real)
  wallDecor: false,        // opt-in: dress interior wall faces (paint / wood wainscot / wallpaper)
  facadeDecor: false,      // opt-in: dress exterior wall faces (siding / corner boards / water table)
  entryDoor: false,        // opt-in: cut a perimeter front door + threshold into the envelope
  casingWidth: 0.12,       // ~1.5 in door/window trim
  doorLeafThickness: 0.16, // ~2 in door slab
  trimTint: '#e7e2d4',     // painted casing / frame
  doorLeafTint: '#7d5a36', // stained-wood leaf
  entryDoorTint: '#355f74', // painted exterior front door
  facadeStyle: 'siding',    // 'siding' (clapboard, default) | 'brick' (running bond) | 'tofu' (modern block) | 'metal' (sheet cladding)
                            // | 'stone' (ashlar: a brownstone's) | 'render' (smooth stucco, any storey) | 'boards' (vertical timber)
  stoneBodyTint: '#7a5a46', stoneJointTint: '#5e4536', stoneUnit: [2.6, 1.15],   // a brownstone's coursed ashlar
  renderBodyTint: '#ece8df', renderRevealTint: '#cfcac0',                         // a stucco's body and its reveals
  boardTint: '#2b2826', boardJointTint: '#161412', boardWidth: 0.5,               // vertical boards (charred cedar by default)
  facadeMetal: null,        // metal cladding's surface (metal-surfaces S5): a { metal, finish?, … } spec; default by cladding
  cladding: 'standing-seam', // metal cladding: 'standing-seam' | 'corrugated' | 'panel'
  roofMetal: null,          // a metal-surface spec for the roof sheet (same as roof: { style, metal })
  facadeTrimTint: '#e8e0d2',
  facadeSidingTint: '#9fb4ad',
  facadeWaterTableTint: '#6f776e',
  brickBodyTint: '#9c5a44',   // brick body + pale mortar (from building-facade BRICK_FAMILIES)
  brickMortarTint: '#d8c6b0',
  brickUnit: [1.9, 0.5],      // [brick length, course height] in ft — stylized ~2× so the bond reads at house scale without a per-brick face explosion
  tofuBodyTint: '#e0dbcf',    // modern stucco/concrete block — clean pale body
  tofuRevealTint: '#8f8a7d',  // crisp shadow line at floor reveals / corners / under the parapet
  copingTint: '#d6cfbf',      // a masonry gable's coping and a loft window's head (Portland stone)
  porch: false,               // opt-in: a covered front porch (deck + posts + roof) off the entry
  stoop: false,               // opt-in: a raised entry stoop (landing + steps), no roof
  deck: false,                // opt-in: a railed wood deck off the terrace slider (needs terrace:true)
  balcony: false,             // opt-in: a projecting upper-floor balcony (cuts a balcony door + builds the platform)
  stoopTint: '#a59c8a',       // stone/concrete stoop + steps
  porchDeckTint: '#8a7355',   // wood porch deck
  porchPostTint: '#e7e0d0',   // painted porch posts + roof fascia
  porchRoofTint: '#6b6256',   // porch roof
  deckTint: '#90785a',        // wood deck boards
  railTint: '#e3dccc',        // deck/balcony railing (posts, balusters, top rail)
  balconySlabTint: '#bdb4a4',  // cantilevered balcony slab + corbels
  terraceTint: '#9a958c',      // set-back terrace deck (the upper slab continued over the storey below)
  terraceRailTint: '#4a4a4a',  // balustrade along a terrace's open edges
  terraceRailHeight: 3.3,
  thresholdTint: '#9a8b72',
  glassTint: 'rgba(176,206,225,0.32)', // tinted, translucent (renders via the water pass)
  ceilingTint: '#d8d2c4',  // off-white ceiling plane
  // VIEW + ROOF — the doll-house is one view; `exterior` is its roofed companion.
  view: 'cutaway',         // 'cutaway' = open-top doll-house (see interior) | 'exterior' = roofed solid massing, basement hidden, on the ground
  roof: false,             // opt-in roof over the envelope: true | <ROOF_STYLES name> | { style, form, material, pitch, covering, ... }. See roof.js.
  groundTint: '#3a4632',   // exterior-view ground plane (grass/earth)
  groundMargin: 30,        // how far the ground plane extends past the footprint (ft)
  perimeter: false,        // opt-in LOT around the house (exterior view only): property line,
                           // yards, fence, driveway, carport, shed, path, patio. true | {…overrides}.
                           // Replaces the bare ground quad. See floorplan-perimeter.js.
};
