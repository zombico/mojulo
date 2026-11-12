### Skandart: debris that has a cause, laid where it would come to rest

A room gathers what has happened to it. Skandart asks a room what falls, wears off, is dropped or grows there and where
it comes to rest, and lays the answer as clumps: each built once in its own frame, stamped where the room's structure
puts it, and lit where it lies. What is too small to be read where it is seen is left out; the rest is built at the
size it would be.

- A recipe's `skandart` (`true`, a number from 0 to 1, or `{ amount }`) asks for it on a kit that answers the question
  on its card. The ashlar crypt (`gothic-ashlar`) is the first: at each wall's foot a heap a bay long, its render's
  flakes, the ashlar's spall and a fallen block, filling the gutter and spilling over its lip, the bays in the wall's
  rhythm (the full heap and the lesser one, the same heap lower with less on it); a deeper heap in each corner against
  the pilasters' feet, a block or two at its toe; the tomb's candles' wax poured on the dais and pooled at its foot; the
  webs within reach swept, those over it left. A kit that answers no debris question says so. Without the key every
  room is as it was, byte for byte.
- A heap is a body and the pieces on it. The body is the fall's fines standing at their angle of repose (rupa's `phi`:
  sand's for the fines, gravel's for loose stone), a wedge along a bay with a hip at each end or a quarter cone in a
  corner, clipped where it meets the ground so its toe runs as a contour. The pieces lie on its face, square to it and
  part buried, sorted as a fall sorts them: the bigger, the farther down, so blocks come to rest at the toe and chips up
  the face. The amount raises the body and deals the next of the same pieces: more is always the same heap with more on
  it.
- The debris shelf (`era/debris-shelf.js`): the things that pile up, one row each under the words people say, with its
  matter, its sizes, its shape and how it comes to rest (it rolls, or it lies): spall, a fallen block, brick, render
  flakes, slate, roof tile, sherd, plank, beam, splinter. Its shapes are a broken chip, a dressed block with a broken
  arris (never a box), a plate flat or bent, a length of timber broken off on the slant. A kit's card names a heap's
  pieces off the shelf; a new thing that piles is a row.
- Asked for, it replaces the crypt's gutter rubble and the fallen stone among its corner things (stones, a boulder,
  debris); every other corner thing stands where it stood (`cornerThings`' `leave`: a kind placed by the dice and not
  built).
- A new law, `too-small-to-read` (`era/laws.js`, the builder's in both eras): what is too small to be read where it is
  seen is not made, neither built nor painted in. A thing under the eye spot (12 pixels of the frame its era reads at)
  at the distance the player meets it is left out; `eyeSpot(distance, screenPx)` beside `EYE_SPOT_PX` in
  `playscape/objects/laws.js` measures it. The debris is its first reader, as filler (met at six metres): in the sixth
  generation's 640×448 a piece under about 19 cm goes, in the form render on its target's lines (1080 by default) one
  under about 8 cm. The dice fall for every piece first, so the coarser frame keeps the same heap with fewer of its
  small pieces; a flake that lay on a stone left out lies on the ground instead.
- The debris rides to the page as instanced repeats, one geometry a clump and one transform a stamp: a two-room crypt
  in the form render lays 39 heaps from 8 clumps, about 13,500 triangles in all (35 from 7, about 6,500, in the paint),
  its worst view 61,387 triangles against the room's 53,235 without it, the page no larger. Each stamp takes
  the room's light at the middle of its mass and a share of the grime of the ground it lies on (a fresh fall has not lain
  there as long as the floor), in the paint and in the form
  render; a clump is shaded only by how its faces turn up, so a stamp may turn and still be lit where it lies.
- The form render lights instanced repeats in a room under no sun when they carry their light (until now only under a
  sun). A page without them is as it was.
- The form render's bake answers the light at points that are no face of the room and the base a paint takes in it,
  when asked; asked nothing, it is as it was.
- A room's condition (`condition`, `era/condition.js`): one word for its state of repair sets its debris, its grime and
  whether anyone still sweeps, together, on a ladder: `kept`, `worn`, `neglected`, `derelict`, `ruined`, or a word for
  one ("abandoned" is derelict, "crumbling" is ruined). From neglected up nobody sweeps, so the webs within reach stay.
  A kept room is one where nothing has come down: it lays no heap and keeps none of its kit's fallen stone. A recipe's
  own `skandart` or `grime` stands over the word's. On a kit that answers no debris question the word sets the grime
  and the room says what it could not (`condition.unanswered`); every room asked in a condition says it (`condition`:
  its step, the dials it set). A room kit's card lists the word among its options, and a kit that answers the debris
  question lists `skandart` too.
- The cavern answers the debris question too (`era/skandart-land.js`), asked by the same keys (`skandart`, or a
  `condition` word): talus heaped against each wall's foot, a heap a stretch of wall in the walls' rhythm, and
  breakdown, the slabs a ceiling lets go, standing free on its floor off the walk and its rocks. A land's floor rises
  and falls, so each heap is laid on the land where it lies (its body draped over the ground, each piece on the ground
  under its own middle) and joins the cavern's boulders: its rock banded and tiled as every rock of it is. A ruined
  cavern lays 32 heaps, about 18,000 triangles. The shelf gains the breakdown slab; the heaps a cone, standing free.
  Asked nothing, or kept, a cavern is as it was; open ground asked for debris says it has none to give yet.
- Every heap's face holds its fines' repose however tall it stands: a long heap's crest waves stretch with its height,
  a round heap's slope varies only gentler than its repose, and where a bay's face meets its hip the two round into one
  another (a soft minimum), never a crease steeper than either; and no heap stands taller than its reach lets its face
  fall to the ground.
- The research lab answers the debris question in its own things: a lab sheds no stone, so at each wall's foot, in the
  bays it lays between its columns, its upper boards lie fallen and the draughts' papers and broken glass are carried
  past a skin of dust; deeper in its corners; and where its roof came down (its `decay`'s collapse), the slab in pieces
  heaped under the hole on a low bed of dust, the deck's sheets across it, chunks rolled out over the floor. The old
  pile there keeps only the bay's fallen troffers. A card may size its own heaps (`heights`), carry what lies past the
  body (`spread`) and paint its own matters (`matters`). The shelf gains what a lab drops: slab chunk, concrete chunk,
  deck sheet, board, paper, glass shard (the word "board" is the lab's wall board now; a plank is "plank").
- A room's condition reaches a kit's own story of decay: on a kit whose style card tells one (the lab's abandonment,
  blackout, leak, broken set piece and fallen roof), neglected abandons it, derelict abandons it in the dark with a
  leak, and ruined brings its roof down too, so its debris has a hole to lie under. A recipe's own `decay` stands over
  the word's.
- Fixed: a wall without pilasters split into strips read a length `Array.from` never passes (it threw).
- Any room answers the debris question, not only the kits with a card: what it sheds is read from what it is made of
  (`era/skandart-derive.js`). Each wall, upper wall and ceiling tile names its matter by its generator's settings, its
  key or its family's name (a recipe's own tiles included); each matter sheds its own (stone its spall and a block,
  render its flakes, brick its bricks, concrete its chunks, boards their boards, timber its planks and splinters, metal
  its sheets, glass its shards; a ceiling's under a hole in it), heavy things heaped at their repose and light ones
  drifted; a room's use leaves its own (an office its papers, a store its sherds, a workshop its splinters). A kit's card
  is the art direction over that answer, and a recipe may give its own over both (`skandart: { foot | corner |
  collapse: { pieces: { <shelf row>: n } } | false, heights, spread, reach, matters }`, each piece checked against the
  shelf). The room says whose answer it laid (`skandart.from`: recipe, card or derived) and what it read. Only a room
  made of nothing that sheds, asked for debris with no answer of its own, is refused, and is told how to give one; a
  `condition` on it sets the grime and says the debris was unanswered.
- A room's bays are read the same way for every room: between the pilasters it lists, else between its own bays (a
  lab's columns, a bay kit's pilasters), else the wall cut in stretches a heap fits in; the bay kits' wall feet were
  getting none.
- Weathering is one scale (`weathering`, `era/weathering.js`): how far the causes have worked on a room's surfaces, an
  axis apart from its debris (`skandart`: how much of what came off still lies). A room can stand weathered and swept,
  or fresh with a fall in it. The scale is 0 (fresh) to 1, the kit as drawn at its middle; each cause is a weight on it
  (`{ amount, damp, water, fire, time }`) and acts where it acts: damp loses a render wall's coat low and brings the
  damp band, moss and fungus; water from above loses its coat over the string course and streaks it; fire soots over
  the lamps; time ages the dirt, wears the stone and cracks the floor. It fills the dials it tells (`grime`, `dirt`,
  `cracks`, `growth`, the coat's loss on the kit) wherever the recipe set none; the room says what it set. A
  `condition` sets weathering and debris together (its old grime dial is weathering now), and either turns on its own:
  `condition: "derelict", skandart: 0` is a derelict room swept clean.
- `skandart: 0` is a room where nothing lies, the kit's own fallen stone gone too; only an absent key or `false` leaves a
  kit as it was drawn.
- Weathering reaches every made surface by the cause that acts on it: a dressed tile's wear (`grit`: paint off the
  arrises and rivets, dents, scuffs, stains) by `use` on a floor and by time elsewhere, a corrugated roof's rust by
  water, a render's coat as before; and its baked dirt reaches a bay's own surfaces (its base band, columns and crown as
  walls, its floor band and hazard paint as the floor), asked by weathering only. A new cause, `use` (traffic), wears
  the floor and the walk. A hangar weathered and kept (`kit: "bay-military", weathering: 1, skandart: 0`) shows its
  roof rusted through, its floor stained and scuffed and nothing lying on it.
- Snow answers the debris question on open ground: a stage's or a geocube path's `skandart` under its snow lays drifts
  (`era/skandart-snow.js`), the wind's piles in the lee of each rock and trunk, the wind the recipe's (`wind.dir`) or the
  default's. A drift leans on what slowed the wind, highest at it, its tail running out downwind to a tongue, its back
  and sides no steeper than snow stands (rupa's `snow` repose) and easing out onto the ground; it rises with the amount
  and with the snow's depth, never past what it leans on, is cut where the snow ends or the walk begins, and is not made
  lower than the eye spot. It is the cover's snow: painted in its colour, and in the form render the ground the snow's
  map covers, the map filling the hollows the cover's patches opened under it. Walked over, never a collider. The level
  says what it laid (`skandart.drifts`) and any law it broke. Debris words on open ground without snow are still refused.
- The fall heaps its leaves (`era/leaf-piles.js`): a level whose biocube is in the fall (`flora.autumn`) gives each
  tree that turns its own leaf piles, drawn by the form render (gen-7) as heaps of that tree's turned colour, not as
  single leaves. Blown along the ground, leaves bank against the windward face of what stops them: one against the
  tree's own trunk, one against the nearest rock downwind within its reach, and on some trees a loose heap blown out past
  the crown. A pile is laid in SHEETS, as wind lays leaves: each a little smaller than the one under it, sharing its
  wobble, with a matted edge; the page draws the lower sheets browner, each edge a shade darker and the crease under it
  darker still, so it reads in layers, with a leaf-sized grain near and a heap's colour far. The pile as a whole stands
  no steeper than dry leaves (34°), a matted edge no steeper than 55°; it rises the further into the fall, a bank never
  past three fifths of what it leans on; none on the walk, in a rock or lower than the eye spot, and the grass keeps off
  it. A needled or a far tree lays none, nor a level in snow, nor a painted (gen-6) page. The level says what it laid
  (`leafPiles`: each pile's role, place and height); a page with none carries none of the code. A dozen piles add about
  a megabyte to a page, most of it the grid their edges need.
- Open ground answers the debris question (`skandart` on a stage's trail or a geocube path, no snow): its rockfall
  (`era/skandart-land.js trailSkandart`). What a cliff lets go comes to rest by its size, so cones of fallen rock lie
  past its talus apron's toe, and the biggest blocks of each, rolled farthest, lie alone at the walk's edge on the cliff's
  side, sunk where they stopped; every big stone beside the walk sheds a ring of spalls round its own foot. A new shelf
  row, `talus-block` (a cliff's own rock, broken, no face squared). More falls the more is asked; nothing lies on the
  walk, and the grass keeps off each heap and block. Read at the form render's frame (1080 lines) when it reads them, so
  its spalls are made. The level says what it laid (`skandart`: its cones, runners and rings). A `condition` on open
  ground is still refused, now saying why: a condition word is a room's or a cave's.
- A trail's debris takes in its trees and its rain. DEADFALL (`era/deadfall.js`): each tree near the walk lets fall its
  dead branches and now and then a limb, lying under its crown where they fell, mostly pointing out from the trunk, each a
  curved, tapered stem with its forks, one propped up off the ground as a fallen branch lies; never across the walk's
  middle, never in a rock, none too thin to be read where it is seen. Drawn as its own wood (`isekai:deadwood`, a new land
  class: the cube's floor, weathered paler than a standing trunk's bark, so the form render's own trees do not hide it; listed in a land's
  payload only where its faces stand, so a land without deadfall is byte for byte as it was), on a polygon land. WASH (`era/wash-fans.js`): where rain running down a trail slows (its dips and the foot of each
  descent) it drops its load: a fan of washed sand opening off the trail on the side lower at its toe, or, where the
  trail is sunk in its banks and the water stays in it, a lobe of sand across its tread run on down it; centimetres deep,
  so drawn by its colour (the land cut as sand, as a shore's is, no grass on it), and it never climbs. Both with the
  trail's rockfall under the same `skandart`; the level says what each laid (`skandart.deadfall`, `skandart.wash`).
