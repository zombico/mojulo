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
- The walk bends, in any place: the three bends (rise, turn, drift) are said of the walk and the place round it, never
  of a street as such ("here is how a room turns"). The principles doc's three sections are one, `The walk bends`
  (what each bend keeps still, that the walk always scrolls sideways, that a bend is eased and is where the map turns a
  page, that the place goes with the walk), and the card teaches the three words as a level's own. A building's rooms
  take them as a street does (`{ kind: 'stage', kit, rise, turn, drift }`): `brawl-warp.js` placeWarp shears any place
  that already stands, across by the drift and (rooms, whose ground does not climb of itself) up by the rise, a face
  cut at a bend first, its lights, rooms, colliders and anchors moved with it; its dress follows its ground.
- Each street a turn (the game turn, `game/turn.js`, merged from the release candidate): a quick brawl's game now
  carries a flow whose every street asks the brawl's set-up before it loads (`quick.js` brawlSetup, lowered by
  `gameworld/setup.js`): how hard it fights, asked once and held by the save, and who plays, asked before every street
  when the roster has more than one player (the pick is the roster entry's id). The play shell draws the picks on
  mana-ui, loads the street, and takes its end to the results and the next street, so the shell stitches the game. A
  hosted street reads its session when the shell starts it (`brawl-street-read.js` streetSession: the fighter picked
  plays, to four seats; STREET_DIFFICULTY: the tier's crowd rules over the street's and its bosses' minds; the middle
  tier is the street as written). A world's own `setup` is kept, the fighter pick added unless it asks one.
  Proven on test streets (`scripts/spikes/brawler/turns.mjs`: three blockouts, one straight, one that rises, one that
  drifts, two fighters; designed, made, exported and played through the shell in headless Chrome).
- A brawl is made for a wide screen: a quick brawl's world says `screen: 'screen'` unless it or its quick says
  another (a new game's default is the upright phone, and the shell now draws its screens in the game's frame: a
  side view in a phone's column). Found by playing the turn through.
- A street's scenes, in its turn (`brawl/brawl-scenes.js`). A street names its scenes (`street.scenes: { <id>:
  [beat…] }`), a beat one of a card (`title`, `sub`), a line someone says (`say`, `who`), the camera travelling the
  belt (`pan: [from, to]`) or cut to a place on it (`look`), or a rest (`wait`); read against its belt, stepped by
  frames, a line or a card put away by accept, the scene ended by start where it may be skipped. The game calls them:
  a quick brawl's street step says `start: { scene: 'arrive' }` (every street its own, never on a retry) and `end:
  { scene: 'leave', when: 'won' }`. The page plays a staged scene with the fight held under the cinema bars and says
  when it ends; an end scene is played once the street is over and BEFORE its outcome is told, so the save and the
  results come after it. A street that names none is given a starter pair (`quick.js` defaultScenes: its name and who
  holds it, the camera brought back to the player; a card and the way out); its own are kept whole; `scenes: false`
  plays none.
- A hosted street says when its first frame is drawn (the level wire's `shown`), so the shell's loading screen lifts on
  it and the turn's start scene begins then, never under the loading screen. Found by playing the turn through: the
  arrive scene had played hidden.
- The play shell hands a level its end scene (`game/play-shell.js`): an end trigger that is a scene is named to the
  level as it loads (`params.__end: { scene, when, skip? }`) for the level to play on its own page; a video still
  plays over the shell as before ([docs/game-flow.md](../../../../docs/game-flow.md)).
- A composed world makes a brawler: a level walked SIDEWAYS (`gameworld/sideways.js`, `sideways-read.js`). A level
  of the game book says `sideways: true | { ground?, cast?, waves?, things?, scenes? }`: `ground` a brawl level's
  words (the place and its belt: its screens, its dress, its rise, turn and drift; the town's street unsaid), `cast`
  who of the world's bestiary the crowd is drawn as (a foe under a crowd type, under `*` for the rest, under `boss`),
  the rest a street's own, the starter's when not said. The level is alone on its level, read where the world is read.
  The run lays its street with the world's own: the hero (as the book equips it) and each of its cast who joins are
  its players, its cast's foes (fielded for it, each made as the bestiary makes a person or a crew's grunt) the
  crowd's faces, in the world's tradition; the level is a hosted level like any other, and the game the world's
  (its store, its links, its own `setup` and `flow` kept). Its turn asks the set-up, who plays when more than one can,
  and calls the street's scenes where every level is one. A world with no sideways level is made as it was.
- A map is played by a PLAY TYPE (`brawl/brawl-play.js` `PLAY_TYPES`, a row a type: the kit, what the turn asks,
  the screen, what stands in the band, how the map is held, what the end reads back): the same belt, bends, dress,
  scenes and turn, another set of idioms. `play: 'brawl' | 'gun'` on a quick brawl, on one street, or on a composed
  world's `sideways` level. A RUN & GUN (`gun`) plays a street with the gunner's kit, until now the practice range's
  alone: the players hold a gun over their sidearm with their grenades (`guns`, what they may start with; the turn
  asks which when there is more than one, the pick reaching the street as `__picks.gun`; `grenades`), the screen
  shows the gun held, its rounds and the grenades, the end reads accuracy. Unsaid, its map gets shooters on every
  screen with a rush between them (a crew's own shooters where it has them), cover across the band (the setting's:
  sandbags on a base, crates in a facility), a crate holding a gun on each held screen and food before the boss.
  A brawl is made as it was.
- A gun to take up (`things`: `{ kind: 'gun', what }`, in a box or lying; `brawl-things.js` `THINGS.gun`): a gunner
  takes what it walks over, in its stride (a gun, food, a power-up), and holds the gun over its sidearm until it is
  spent; a brawler leaves it lying.
- A wave on an OPEN screen (one with no gate) is fought on the move, in either play: it comes in as the player walks
  in, the camera is not held, and it is let go once a player is on the next wave's screen (those still standing left
  behind). A wave on such a screen was refused before.
- THE FIGHT, MEASURED (`brawl/brawl-measure.js`): a map's encounters have a machine gate. A street is fought down on
  the brawl's own simulation, no page, by a bot that plays the player's kit through its buttons (the masher, the floor:
  it walks up and attacks; the careful one: off a round's line, food when hurt, crates opened, a roll away from a
  brawler when it holds a gun), at each difficulty, over several takes (the middle one is the run), and each wave says
  how long it lasted, what share of the health bar it took and how many fell. The runs are read against the FIGHT LAWS
  (the floor finishes on easy, care is rewarded as written, max can be won, no spike, no slog, it opens gently, it
  ends); a law lost names the wave and what to change. `design_game`'s readout measures each sideways map (a quick
  brawl's streets, a composed world's sideways levels: `gameworld/fight-measure.js`) and adds a `fight` step where a
  law is lost. The whole table: `node scripts/spikes/brawler/measure.mjs`. It advises; the bots and the player are
  stand-ins, and it is not the eyes gate.
- The starter's own fights were set against it, and a deep test holds them to it. A brawl: a held screen opens with
  two bodies (three before), every box holds a roast chicken (an apple in every other before), the boss's screen a
  joint of meat at its door. A run & gun: two shooters and one rushing in on a held screen (a shooter more each), and
  its boss is a shooter (below), not the brawler it first ended on: a gunner had no answer to one, measured. The difficulty tiers (`STREET_DIFFICULTY`): easy and medium send one body at a time (medium with a breath
  between them; it was the crowd's own two at once), max is the crowd's own pace with a boss on its sharpest mind.
- A BOSS OF THE CROWD'S OWN KIND: a wave's `boss` may be `{ type, name?, hp?, volley? }` in place of a fighter's
  recipe: a crowd type's body as the boss, on its type's mind (a shooter holds its range and fires its volleys), with
  a boss's health (four times its type's unless said), its bar on the screen and the street won when it falls. A run &
  gun's starter boss is the crowd's rocket with two shooters beside it.
- A player's round breaks a box open (it stops there): a gunner has no blow to open a crate with.
- COVER FROM THE DRESS: a place's cover is of the place. A cover row named for a dress piece (`brawl-things.js`
  `THINGS.cover`: a barrier, footlockers, steel drums, barrels, a pallet, sacks, a skip, a planter, tyres, a cable
  reel, a desk, cabinets, a sofa, a reception counter, beside the sandbags and crates there were) is that piece stood
  in the band: drawn by the dress's own builder, fitted to the box that stops a round, leaving its matter's debris
  when it breaks (`brawl-dress.js` `coverModels`; the sandbags and crates are drawn so too, a low wall and a mount's
  wreck as they were). A run & gun that names no things takes each screen's cover from the set that screen wears
  (`dressCover`), its setting's where the set has none (`settingCover`, read off the sets: the table by setting is
  gone), each piece stood clear of the band's edges. A map with no dress keeps sandbags and crates.
- Fixed: what stands in the band (a breakable, a piece of cover, what either leaves broken) was drawn paler than the
  same piece against the wall: its colours reached the renderer unconverted. They are brought to linear light on the
  page, and a thing in the band now matches the dress it comes from.
- A BOSS'S PHASES: a boss of a crowd type takes `phases: [{ at, type?, volley?, calls?, says? }]`. As its health
  falls to `at` (a share of it, each lower than the last) it turns: it fights as another crowd type (that type's gun
  and plays) or with more rounds a volley, the bodies it `calls` come in (held off the street until then; never, if it
  falls first), and the screen says its word (`says`, or the phase's number). Its bar carries a pip a phase. The run &
  gun's starter boss throws its rocket down for a burst gun at half its health and calls two more, measured against
  the fight laws.
- A SECOND PLAYER SITS DOWN MID-STREET, in either play: a street makes a body for each spare seat (the playable
  characters no one picked, never one the crowd is drawn as; two seats at least, four at most) and keeps it off the
  street (`streetOf` a player `away`; `joinStreet`). A controller that presses attack or start takes the next seat and
  walks in beside the first, whole and armed as it, the street going on. Before, a second controller began the street
  again, and could be handed a crowd's grunt to play. Its name, health and gun stand under the first player's; the
  street is lost when every seated player is down. Checked on a page: `node scripts/spikes/brawler/street.mjs --coop
  --play gun` (a pad the page reads as any sits down, walks in and fires; exit 0 only if it held).
- THE SCREEN of a side-scrolling action game in play, redone for both plays: FOUR SEATS across the top, a quarter of
  the screen each, so a seat never moves when another is taken. A seat taken shows its tag in its own colour (the
  look's sides; the mark its player stands on wears it too), its name, its health read by its length, and for a run &
  gun the gun in its hands as two letters (`gunCode`: MG, SP, FL, RK), its rounds (marked LOW at a fifth of a
  magazine) and its grenades. A seat open says how to sit down; a seat the game has not leaves its quarter empty. The
  way through and who is left moved to the foot's corners, the boss's bar between them: the middle of the screen is
  the fight's. A new look, `brawl-street` (a theme card: the brawl yard's asphalt and hazard yellow with stencilled
  pictograms coloured by what they mean), on the street's screen and on a brawl's shell; the practice yard keeps
  `brawl-yard`. Two pictograms joined the icon shelf: `bullet` (also said ammo, rounds) and `grenade`.
- ONE STREET, TWO DOORS IN (the street's design door merged in: the `brawl-doors` theme beside this one). A street
  written at its DESIGN (a designed game's `levels.<id>.street`, a quick `brawl` or `rungun` that says `street`,
  `waves`, `lives`, `players`, `armed` or `guns`, a game made from a sentence: its stops and its boss, its crowd the
  game's own cast by role) and one written by its STREETS (a quick brawl's `streets`, `crowd`, `play`: a place of
  its own, its dress, its bends, its scenes) are both played on the one street: the
  seats, the fight laws' numbers, cover, pickups and the turn are the same under either. The page reads a design's
  street (`brawl.practice.street`) as it reads a street's block. What the design door brought onto the street:
  LIVES (`lives`: the falls its players share; a player knocked out is back on its feet where it fell, whole, until
  the last one allowed; hearts at the foot of the screen), a TUNING (`tune`: its players' health, the crowd's as a
  share of its own, the crowd's guns and rules), a crowd body drawn as the cast member its wave names, a fighter boss
  in STAGES (beside a crowd-kind boss's phases; either turns the boss's marks and says its word), and DUCKING and
  JUMPING a round. A quick brawl or rungun that says none of the design's words, in a world with no `foes`, is the
  starter's (the dressed town street, a crew of the comic pack's; a rungun played with guns).
- `sideways` IS FOLDED INTO `street`: a designed game has one key for a street level. `levels.<id>.street` takes a
  `ground` (a place of its own in a kit's stead: a town's street, a stage, a blockout, with its dress and its rise,
  turn and drift; the stops laid along it), its own `things` and `scenes`, and may be `true` or say no stops (three
  that build to the cast's boss). On a ground its play's things (breakables with food; a run & gun's cover from the
  dress, its gun crates) and the starter's scenes are laid unless said, and a world whose every level is such a street
  has each level's turn call them. The fight measure reads a street level as its page does (its cast's waves, its
  lives, its tuning). `levels.<id>.sideways`, its `cast` by crowd type and its raw `waves` are gone: who comes is
  written at the street's stops, by role or by a foe's name.
- A game whose every level is a street wears the street's look (`brawl-street`) on its menus when it says no `ui`,
  as a quick brawl does: its level list, set-up, pause and results are the game UI runtime's, driven from the keys.
  A blockout takes the game's `screen` word, as a stage does (a street on a blockout ground was refused for it).
- Not yet (the two doors): the design door's scripted player and this theme's fight measure both read a street (one check would do); the
  practice room that ends (`stakes`) is still its own path for a wave set with no street.
- Not yet (run & gun): one-hit play, a boss's own attacks (a pattern only it has), the turn asking each
  seat its fighter and gun (a second player takes the next playable and the first's gun), the fight measured with two.
- Not yet (sound): footsteps, a street's bed, the score and its stingers (the cue sheet), the screen's own sounds.
- Not yet: a crowd of its own per street, a boss with a fight of its faction's own, a street of more than one
  block, the town's page under a host's size limit (a town street's page is about 18 MB and slow where a box draws in
  software), the realistic jacked body's wrist (its forearm ends wider than its hand), lives and continues, a rank on the result, two players checked on a page, a brawler from a composed
  (non-quick) world.
