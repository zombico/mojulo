### Side-scroll action starter: the beat 'em up

A beat 'em up as a game, on the brawl library's own kit (`lib/graph/brawl`, over the fighting game's fighters: the
chain and its finisher, the strong blows, grabs and throws, the running blow, the desperation, weapon arts, thugs
from the fight's archetypes). The library's street (screens held by a gate until their wave is beaten, a boss's
screen) is now played on a page; before, only its practice yard was.

- A street fought down on the World page. A brawl level's `street` (`{ players?, roster?, waves: [{ screen, crowd,
  boss? }], things? }`, `brawlLevel(level, { street })`) is played by the brawl channel in the yard's place: the room
  a street (`brawl-crowd.js` streetOf / stepStreet), the players' buttons read by the brawler's own reader, the camera
  scrolled on and held at each uncleared gate by the belt. A level is a yard or a street, not both.
- Its screen (`brawl-street.js`, on mana-ui in the brawler's look): the player's name and health, the held screens as
  pips, the crowd left on this one or the boss's bar while it stands, GO as a screen is beaten and the boss's name as
  it comes in, and the two ends (the street cleared, the player down) with the time, the health left and a button
  that fights it again. What it reads is `brawl-street-read.js` streetRead, pure off the street's state.
- Measured with no page: `scripts/spikes/brawler/street-sim.mjs` plays a street on the brawl's sim with a bot on the
  native kit. On the page: `scripts/spikes/brawler/street.mjs` (a virtual clock, the keyboard): a lighter street is
  cleared through its boss to its end screen, a full one beats a button-masher on its second screen; fight it again
  returns to the start; no page errors.
- Its sound, from the SFX shelf by word (`brawl-sfx.js` BRAWL_SOUNDS, brawlAudio): the brawler's sound sheet. The
  cues a blow already played (a fist by its weight, a foot, a blade, a grab, a throw, a body landing, a knockout) are
  voiced by shelf word in the sheet's style, the newest voices first (`mouth`, falling back to realistic where the
  mouth voices none; `brawl.sound.style` says another), over the fight's family cues. And what a brawl never
  sounded: a blow thrown (a fist's swing, a strong blow's whoosh, a blade's), a jump, a thug's shout as it attacks
  (one in three, so a crowd is not a chorus), its grunt on a heavy blow and its cry as it goes down. The practice
  yard hears the same sheet. A probe reads what was asked for (`window.__mojBrawl.heard`): on a street played
  through, every cue asked for has a sound on the page.
- `brawl` re-pinned: the one fixture whose page inlines the brawl's client.
- A world that is a brawler: the quick goal `brawl` (`design_game({ quick: { goal: 'brawl', roster?, streets?, register? } })`).
  Its players are made as a fight's are (each a character through the character loop; the first plays), its streets
  are its levels (`quick.js` brawlStreets: a brawl level with its waves, and the hosted level's contract), and the
  game runs them in the play shell, its screens the game UI runtime's in the brawler's look unless the world says
  its own. Unsaid, one greybox street: a crowd a held screen, each a body more than the last, a knife among them from
  the second, a boss on the boss's screen. The agent's card for the goal says its levers; the character roll has a
  `brawl` genre (street fighters, never a bystander).
- A street in a game's shell: it says it is ready, takes the keyboard's focus as it starts, and sends its end up the
  level wire (cleared or down, the seconds and the health kept) in place of its own end screen, so the shell shows
  the result and what comes next. The greybox kind takes the level's contract (`game`).
- Through the doors and Chrome (`scripts/spikes/brawler/game.mjs`): design_game makes the player's character, the
  street and the game; export_game writes it; in the shell the title starts the street, the keyboard plays it, a
  masher beaten on its second screen is shown the shell's FAILED with try again, and a street cleared its CLEARED
  with the time and the health; no page errors.
- A street's rank: S, A, B or C by the health it is cleared with (three quarters, a half, a quarter), sent with its
  end and stamped on the shell's result; a result with no rank shows no rank row (the results idiom drew an empty
  one). The boss's bar runs along the foot, clear of the corners' readouts. The keys go back to the shell as a street
  ends, so its result is driven from the keyboard, and "play again" fights the street from its start.
- The crowd has faces: a street's `cast` (`{ <crowd type> | boss | *: a roster index }`) draws its crowd and its boss
  as the roster's characters, their fight still their type's. A quick brawl makes two beside its players (a thug,
  the boss: `quick.js` BRAWL_CROWD), so its street is fought against made characters, not stick figures.
- A street of the GEOTOWN (`brawl-levels.js` the `town` kind): a block of the town's pattern with its main street along
  one side and the belt down it between its cross streets. The shops stand on the far side, the town's bare margin is
  open to the camera, and the road, the kerbs, the walks, the lamps and the fronts are the town's own. A quick brawl
  is fought down it unless it names another level (a stage kit's rooms, the greybox street). A street longer than
  the block is refused, saying how long the block is.
- The brawler's look: a brawl's one register is the western (lit) unless it names another, and every body it makes is
  one of the anime frame's muscular bodies in its muscular form (the muscle shirt) under the WESTERN head (`quick.js`
  brawlBody): the base pair for the players and the crowd, the hulking pair for the heavies and the boss. Never the
  anime head, never the realistic one.
- The crowd is a crew of the comic pack's: a brawl's `crowd` is a faction (`cosmos/packs/comic-hero/grunts.js`: the
  street gang, the crime family, the shadow clan, the motorcycle club, the private military, the cult, the punks,
  corporate security) or `{ faction, colourway?, size? }`, the street gang when none is said. `quick.js` brawlCrowd
  casts a grunt of each of the faction's kinds in ONE colourway and its boss (its heaviest kind, on the hulking body),
  each minted by the hero door as a dressed foe is, out of the pack's own light, on the brawler's body under the
  western head. A grunt fights as what it carries (crowdTypeOf: a drawn knife the knife, a machete or a katana the
  sword, a staff or a sceptre the staff, a pistol the gunner, a long gun the rifleman; bare-handed, a big body the
  heavy and any other the thug); a blade is the street's to draw, so only a gun stays in the hand. A street that names
  no waves draws them from those types, no more than two of a wave shooting. A cast's kind may name several
  characters, taken in turn body by body.
- The street is dressed (`brawl/brawl-dress.js`): what stands along a belt beside the band, laid on the belt and never
  on the level under it. Three shelves, each a table: the PIECES (a crate, stacked crates, barrels, a pallet, sacks, a
  market stall under its striped canopy, a cafe table under its parasol, a sandwich board, a planter, a pot, a bench, a
  paper box, a skip, tyres, a hand cart, a bollard; on the wall posters, the crew's tag and its banner), the SETS (a
  screen's theme: market, cafe, yard, turf, plain: what its far side draws from and how close, what its wall carries)
  and the seeded layout (a piece and a gap at a time against the fronts, the wall's marks at their stride). A town
  street is dressed unless its level says `dress: false`; `dress: { sets, colour, seed }` says a set a screen and the
  crew's colour (its tags, its banners, the boss's corner). A quick brawl's street wears its crowd's colourway. The
  dress collides with nothing: it stands outside the band.
- The street's angle: a belt angle `street` (further back, looking over the bodies' heads: the band in the frame's
  lower half, the fronts, their awnings and the first floor over it), the town street's own unless it names another.
  An angle carries the height it looks at (`look`; a body's chest for the others, as before).
- The street spike tours: `scripts/spikes/brawler/street.mjs --tour` walks the camera down an empty street and takes a
  still every 12 m, so a dress is seen in a couple of minutes without a fight.
- The street's fronts broken up: a geotown's `fronts: 'broken'` (opt-in; unsaid, a shop row as it was) gives each shop
  of a row its own house over the shop, from the row's `broken` table (`geotown/pattern.js`; the old town's: nine
  fronts): its render and its shutters' paint, each at its own lightness, its height (two to four storeys, so the eaves
  step), its shutters' form or none, its roof (the tiled hip, a steep slate one, a flat parapet), and on some narrow
  balconies from the second floor up (a front's `balconies` may now say its own size, and may hang over a shop's door).
  The brawl's town street asks for it.
- Alleys and setbacks: a shop row broken up (`fronts`) now breaks in plan too, by the row's `breaks`
  (`geotown/pattern.js`): an alley beside some buildings (as wide as its plot can spare, never two running, never on a
  corner) and some set back from the walk behind a paved forecourt, on their own dice, so a row not broken up is laid
  as it was.
- A rough quarter: `fronts: 'rough'` is the same row gone to a working street (the row's `rough` table): red, brown,
  yellow and dark brick tenements and walk-ups on the main street's brick with sash lights and flat roofs, between
  renders gone grey and grimy, shutters missing, a concrete front. The brawl's town street is rough unless its level
  says `fronts: 'broken'`.
- The dress gone urban (`brawl/brawl-dress.js`): new pieces (rubbish bags, dumped cardboard, a vending machine, a fire
  in an oil drum, litter and a stain on the walk; on the wall a steel shutter rolled down and sprayed, a big sprayed
  piece, a boarded window, an air conditioner, a drainpipe, a lit blade sign, a fire escape with its landings and
  ladders), a new set `strip` (a shuttered strip), rubbish and marks in the other sets, and the turn a street takes
  unsaid: the way in a strip, the held screens a market, a strip, a yard, the boss's the crew's corner (a cafe terrace
  is said, never fallen to). A dress may be told its `fronts` (the buildings' own lines along the belt): a wall's mark
  then stands on one building, at that building's line, and a gap between two is an alley with something left in it.
  A town street says them from its shops.
- The rough quarter's ground: under `fronts: 'rough'` the old town's setts are tarred over and its flags replaced in
  poured concrete (the pattern's `grounds.rough`: the road, lanes, drives and yards asphalt; the walks, the furnishing
  strip, paths and steps pavement).
- Skandart on the street (`era/skandart.js`'s shelves, used as they are). Its VESSELS (`era/skandart-vessels.js`) are
  the dress's crates, barrels and kegs (the old look) and its steel drums, steel crates and footlockers (the
  industrial look, a new piece `drums`), standing in groups, some tipped, some already broken, by how far gone the set
  is. Its DEBRIS SHELF (`era/debris-shelf.js`) is the street's debris: `rubble` at a wall's foot (bricks, spall,
  flakes of render, concrete), `wreckage` (broken concrete, bricks, planks, a roof sheet), `shards` (glass and
  papers), in the rough sets and in the alleys; a piece too small to be read from the street's camera is left out.
- The street's breakables: a street that names no `things` now has two boxes on each held screen (a barrel, a crate,
  a steel drum in turn: `quick.js` defaultThings; a new box `drum`), every other one holding food. A box is drawn as
  its skandart vessel (`brawl-dress.js` boxModels, carried by the page only when a box is laid) and, broken, leaves its
  wreck where it stood (its form's planks and splinters, a drum's sheet).
- The side-scroll map, for any contemporary place (`brawl/brawl-dress.js`,
  [docs/side-scroll-map-principles.md](../../../../docs/side-scroll-map-principles.md), the agent's card
  `gameworld-side-scroll`). What made the street work is said as principles and measured as laws (`dressLaws`, which
  advise): the band low and the backdrop over it, nothing tall between the camera and the fight, the dress outside
  the band, a screen a place of its own, the boss's screen held, things on the floor AND marks on the wall, no long
  bare run, variety inside a set. A map now has a SETTING, the kind of place it is, a row each with its sets, the turn
  it takes unsaid and what stands in its band to be broken:
  - `street` (as before), `facility` (a dock, a store of racking, a process hall, its heart), `base` (a gate, a depot,
    a motor pool, the command post), `office` (a lobby, an open floor, a break room, the corner suite);
  - their pieces: pallet racking, a tank, a cable reel, cones, a barrier, a forklift, a generator, lockers; sandbags,
    footlockers (skandart's vessels), jerry cans, a radio table, a floodlight; a desk, cabinets, a cooler, a copier, a
    sofa, a cubicle screen, a reception counter; on the wall pipes, a cabinet, a hazard board, an extinguisher, a duct,
    a stencilled unit number, a map board, a gun rack, a camouflage net, a whiteboard, a clock, pictures, glazing, an
    exit sign.
  A map's `sets` may name a set, leave a screen bare, or say A SET OF THE AGENT'S OWN from the pieces
  (`{ far, wall, gap, marks, near }`), read against them and held to the same laws.
- A building's bays are brawl levels: the stage kind takes the contemporary bays (`bay-military`, `bay-utility`,
  `bay-science`, `bay-everyday`) beside the arena kits, a kit with a setting of its own is dressed as it unsaid (its
  `dress` an object: `{ setting, sets, colour, seed, kit }`; true or false is still the kit's own dressing), and a
  dressed stage is framed by the belt's `street` angle. A quick brawl's boxes are its setting's.
- Vertical motion: a belt may RISE (`brawl-belt.js` `rise`: the floor's height along it, `[[s, z], …]`, no steeper
  than a stair between two points; `beltFloor`). The map still scrolls side-on: the camera rises with the floor it
  looks at, and the simulation is untouched (it plays on a level floor; the page draws every body, shadow, round,
  thing and wreck that much higher, its shadow catcher a ribbon along the floor). Across the belt the floor stays
  level. A town street CLIMBS by a word (`{ kind: 'town', climb: 0.06 }`, rise over run to 0.1, under 0 it falls): the
  town's own slope, its main street on a profile and its buildings stepping up beside it, the belt's rise read off its
  ground. A greybox street that rises is terraced (a ramp cut into steps, the road grown down to the ground). The
  dress stands on the floor under each piece. Three principles join the doc (the ground).
- The road turns: a belt may TURN (`brawl-belt.js` `turn`: `[[s, degrees], …]`, how far the camera is turned down the
  street at each point, to 55° either way, eased between points, no faster than 12° a metre; `beltTurn`). The walk is
  still along the belt and the band still across it, so the map scrolls sideways and heads up the screen (or down it),
  as an arcade brawler's diagonal stretch does; the camera swings round the point it looks at, and the simulation and
  the controls are untouched. A town street and a building's bays take it by word (`turn`), a greybox street on its
  belt. Three principles join the doc (the turn).
- The band drifts: a belt's band may slide ACROSS its line as it is walked (`brawl-belt.js` `drift`: `[[s, n], …]`, m
  across, north of the line over 0, no faster than 1.2 m a metre walked; `beltDrift`). The camera stays square to the
  street and follows the band up or down the screen, so the walkway runs on a diagonal, as an arcade street does where
  it leaves the straight line; the simulation is untouched (it plays a straight band; the page draws everything that
  much across). A greybox street moves whole with it, smooth: each block cut at the drift's own points
  and the piece on a diagonal TURNED onto it (its length the diagonal's, a little past each end so a bend closes),
  road, kerbs and fronts along the band's line. A town's street runs on it too (`{ kind: 'town', drift: […] }`,
  `brawl/brawl-warp.js`): the finished town is sheared across its belt by the band's drift where its page is made, a
  face that crosses a bend cut there first (so a wall and its windows stay together), its instanced things (lamps,
  trees) moved whole; its dress follows its ground (`follows`: a thing on the floor moved across, a mark on the wall
  sheared with it). Where a dress's ground stands still, what would be left in the drifted band is left out. Three principles join the doc (the drift).
- Not yet (sound): footsteps, a street's bed, the score and its stingers (the cue sheet), the screen's own sounds.
- Not yet: a crowd of its own per street, a boss with a fight of its faction's own, a street of more than one
  block, the town's page under a host's size limit (a town street's page is about 18 MB and slow where a box draws in
  software), the realistic jacked body's wrist (its forearm ends wider than its hand), lives and continues, a rank on the result, two players checked on a page, a brawler from a composed
  (non-quick) world.
