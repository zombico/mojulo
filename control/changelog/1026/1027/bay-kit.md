### The bay kit: modern interiors from the hangar's principles

A modern interior kit for the stage, read from the mobile-suit Depot's elements (a structural grid, a divide, a big
door, pads, a runway of lights, a gantry, racks, a stair) and the principles that made the crypt and the temple
striking: structure as the ornament, a wall's base, field and crown, the floor as the map, light as composition, two
scales side by side, something hanging, depth through openings, wear that shows use, an accent rationed. Lit by the
gen-7 room bake; the same recipe read in gen-6 is drawn as paint. Built so far:

- **Modern materials** (`matte-paint/dressed.js`): new dressed cuts, each a relief, so the form render reads its
  normal, occlusion and height (the parallax) from it: steel `plate` (seams, welds, rivet rows, paint wear), diamond
  `tread`, concrete `block`, sheet `panel`, poured `epoxy`, bar `grating` and `corrugated` sheet. A recipe names them as
  any dressed cut (`gen: 'dressed', cut`).
- **The bay shell** (`era/bay.js`, `shell: 'bay'`): every part placed from the room's bays. Pilasters at the bay lines,
  each with a light strip down its face; every solid wall a base (a kick band standing proud), a field and a crown,
  broken round each doorway, which is framed with jambs and a head in hazard paint and a lamp over it. The floor is
  zoned: an epoxy field, a band of grating at the walls' feet, a hazard line between them, lamps inset at the band's edge
  on the bay lines, and a pad marked in a big room's middle. A tall room (6.5 m and over) has a corrugated deck, I-beams
  across the short span on the bay lines, a duct, and lamps hung between the beams. A taller one (9 m) adds a bridge
  crane: rails on corbels, a girder, a trolley, cables to a hook block. From 7.5 m there is a catwalk on the long wall
  with the fewest doorways, with a grating deck, brackets, a railing, a toe board and a stair up to it. A low room has a
  soffit with strips across it and two services along it. Each stage carries the shell's readout and laws
  (`payload.bay`: each room's roof, surfaces and walkways; layers, overhead, two scales, walkway entries, banisters,
  two ways in, the accent's share).
- **Three registers** (`style/bay-kits.js`), each kit `bay-<register>` on the same shell: `bay-military` (steel plate on
  a dark kick band, corrugated crowns, a dark epoxy floor, cool strips), `bay-utility` (concrete block over a painted
  block base, yellow steel pilasters, a sealed concrete floor, warm lamps), `bay-science` (white panels over a teal base
  band, a pale poured floor, cold strips). A kit may name the sixth-gen look it defaults to (`reference`); the bay kits
  take the lab's (`lab-dark`). The fixtures are seats with a word (`strip`, `highbay`, `inset`, `lamp`), never a torch's
  flame; a lamp inset in the floor is held by the bake alone (the page's near lamps are the strong ones).
- **More materials, alternates per room**: punched `perforated` metal, `terrazzo`, `glazed` ceramic tile, `studded`
  rubber, standing-`seam` cladding and fissured `acoustic` ceiling tile join the made class. A register offers alternates
  for its surfaces and each room takes one by its dice: a building's rooms differ and still speak one language.
- **Roof systems**: a tall room's roof is one of `beams`, `truss` (open-web, a Warren web), `vault` (arched ribs, a
  corrugated barrel, tie rods), `sawtooth` (glazed north lights, daylight seats) or `coffer` (a concrete waffle, a lamp
  in each coffer), from its register's list by the room's dice; a braced register crosses its end bays with X-bracing.
- **Walkways are entered and their banisters block**: a catwalk is railed on every edge over a drop but its entries; it
  always has a stair head to enter by, and a long one a stair at each end; an entry is at least a door wide; every
  railing carries a perforated infill from the deck to its top rail, so it stops a walker at any height the walk's rays
  cast (the page walks on the real geometry); a stair carries a banister up its open side along its pitch, the floor
  under the flight left open (where a walker may go is a game's pathing, not the stair's), and its foot opens onto a
  clear landing. Walked by the page's own walk (its eye and shin rays, its step and its body's radius on three's
  raycaster over the stage's faces: `scripts/spikes/bay/walkways.mjs`): up the near stair onto the deck, along it,
  stopped by the front and the far railings, held on the treads by the stair's banister, up the second stair through its
  gap, in every register. The first walk found the near stair's foot 0.6 m off the end wall behind a pilaster, out of a
  walker's reach: hence the landing.
- **A secondary colour and secondary light**: each register paints a secondary colour on its door frames, railings, the
  crane's girder, the pilasters' foot band and its colour-coded services, and lights in secondary colours (a cove washing
  up the wall from the crown, the doorway's signal lamp, a downlight under a catwalk), whose hue the bake carries. The
  hazard stripe is rationed to what lies flat: floor edges, step nosings, the pad, a girder's ends.
- **Services**: an electrical box every few bays on a long wall with its conduit up to the crown, a breaker panel by each
  doorway (its door, handle and breaker lamps, three conduits up), cables slung from hooks under a tall room's crown and
  bundled under a catwalk's deck, and in a low room one soffit panel out, hanging from its hinge with the plenum's dark
  over it and the wiring drooping through.
- **Matte and carbon fibre**: `matte` (a powder-coated sheet: rolled folds, a fine orange peel, burnished where a hand
  rubs) and `carbon` (a 2×2 twill of tows, warp and weft catching the light apart, under a clear coat) join the made
  class. The military register takes a matte wall and matte cabinets, the utility matte cabinets, the science a carbon
  kick band and carbon or matte white cabinets.
- **Everyday materials and the `everyday` register**: `drywall` (taped joints feathered under the paint, filled screw
  dimples, a patched ding), `carpet` (loop-pile tiles quarter-turned, a tweed fleck), `vinyl` (composition tile marbled
  and quarter-turned, heel marks), `laminate` (printed planks whose print comes round every third, bevelled joints),
  `porcelain` (large rectified tiles, each crowned or cupped a hair) and `veneer` (book-matched leaves of flat-cut
  figure). `bay-everyday` lays them for an office, a school, a clinic or a big-box store on the shell turned down (a
  register's `shell` overrides part of the shell's numbers): a rubber base, a slim pilaster, a bulkhead crown, a hollow
  metal door frame 1.8 × 2.7 m, no grating band, no pad, no crane (`craned`), no bracing; neutral air over the lab look
  (a kit's `ambient`, used when the recipe names no look), an exit sign's green over each door, aluminium nosings for a
  hazard stripe.
- **Ducts and vents** (`era/bay-air.js`): the duct in each tall roof's own zone, round spiral or rectangular by register
  (through a truss's web, a sleeve where it passes a beam's, over a vault's ties, a header across each sawtooth), its
  couplings or flanges, hanger rods up to the roof (a trapeze under a rectangular one), and a terminal each bay: a drum
  louvre on a drop from a round duct, a grille in each side of a rectangular one, the bay under the crane's girder left
  clear; a coffered roof's diffusers in its unlit coffers; in a low room square 4-way diffusers in the soffit, a return
  grille in it and one low on a long wall. Built as relief (stepped cones, angled blades, the dark behind). A tall
  room's first outside end wall breathes through a weather louvre in its middle bay, in place of that bay's window.
- **Glass** (`era/bay-glass.js`): windows where a wall faces out (no room against it): a ribbon of clerestory a bay at a
  time under a tall room's crown (kept clear of the catwalk's rail on its wall), punched windows or a high slot in a low
  room by register, each in the wall's reveal with mullions, head and sill rails and a sill board, the daylight beyond
  as a sky gradient at the wall's outer face, a daylight seat inside, and each pane's light laid on the floor as a sun
  patch along the register's sun. A glazed booth in a tall room's corner off the catwalk's wall (a control room, a site
  office, a meeting pod): storefront mullions over a solid dado, or full-height glass with a three-row frit band at
  walking height, a glazed door standing open (it walks in; its glass stops a walker), a transom, a roof with a
  downlight, a desk with its screens lit toward the glass. Clear, wired or frosted, frit, glint, sky and sun patch are
  each their own group (a group's opacity is its own), all out of the shadow occluders (`stage.js`). In gen-7 a pane
  reflects the room by Fresnel (`channels/form.js`: Schlick from F0 0.04, the floor's dark below its horizon, the lamps'
  light above) and the glints are hidden; in gen-6 it is a flat alpha with two glints. A law, `glass-marked`: every pane
  whose foot a walker reaches carries its band.
- **The construction catalog grows, and the bay reads it**: HVAC (spiral and rectangular ducts, a square diffuser, a drum
  louvre, a return grille, a weather louvre, a hanger rod), glass (float, low-iron, laminated, wired, acid-etched:
  thickness, transmittance, reflectance, edge tint, haze; `construction/glazing.js` `glassLook` reads one as a pane) and
  floor finishes (carpet tile, VCT, porcelain, laminate, oak veneer) join `construction/catalog.js`. The bay registers lay
  their block from masonry's `UNITS.cmu`, their drywall from the gypsum sheet, their lay-in tile, floors and veneer from
  their catalog units, their ducts and terminals from the HVAC entries, their panes from the glass, so a house and a bay
  agree on what a block, a board or a pane is.
- **Rooms to walk** (`scripts/spikes/bay/bays.mjs`): a corridor opening into a tall bay in each register, in gen-6 and
  gen-7, captured from the corridor, inside the bay and up at its roof; no page errors. The materials' sheet is
  `scripts/spikes/bay/cuts.mjs`.
