### Buildings from a brief: corridor-and-core programs for genre levels

A stage's `program: { use }` (`era/programs.js`) lays buildings as well as houses and keeps. Built so far:

- **Corridor and core** (`era/program-core.js`, a use's `shape: 'core'`): a core holding the stair (10 × 12 m, its
  wings meeting it along its front band and its back corner, so its flight finds a wall clear of the doorways), wings
  off it as an I, an L, a T or a U, each a corridor wide enough for the kit's doorway at its end with rooms a bay wide
  along one side (`single`: the corridor's other side the outside wall) or both (`double`), a lobby in front holding the
  way in, and an annex (a warehouse's shed, a lab's instrument bay) off the first wing's end on the ground with nothing
  over it and its own ways out. Every storey above the ground the same plate, so each room upstairs stands over its
  twin. Rooms are numbered by storey (`office-203`), the goal is its role (`boardroom`: the top storey's farthest
  room), and every size snaps to the kit's grid. Findings: `unreached`, `deep` (more than four doors from the stair),
  `no-goal`.
- **The uses**: `office` (an L of offices, kitchens and meeting rooms, four storeys, on `bay-everyday`),
  `lab-building` (labs both sides of a clean corridor, an instrument bay, on `bay-science`), `warehouse` (an office
  block over the lockers, the tall shed off its end with its dock doors, on `bay-utility`), `clinic` (a T of consult
  rooms off a waiting room). Their settings are the plan's: `storeys` (1 to 6), `wings`, `loading`, `bays` (a wing's
  length). A building's use names its bay kit (the recipe's own kit wins) and lowers with its `ways`.
- **Only for genre levels**: a game's `building: { use: 'office', storeys, wings, … }` lays one on its own bay kit
  whatever the world's language (`gameworld/levels.js` `buildingStage`, the game's building settings in `world.js`),
  played to its goal up its storeys. The `game` routing card and the `game-building` card say the split: a genre level
  set in a building (a stealth mission through an office) is the game's; a building asked for as a building, or a level
  asked for with no genre (an office to climb), stays `mint_building`'s. Three routing rows hold it. (The `game` card's
  line calling a game the fourth paradigm, sibling to bots, went: the chatbot factory left in 3.0.0.)
- **Walked** (`scripts/spikes/bay/building-walk.mjs`): the page's own walk in node, steered through each doorway and up
  each stair (then round its railed hole, as a walker goes) from the way in to every storey's farthest room; every use
  and the U-shaped office walk to their top floors.
- **The page budget**: a four-storey office's gen-7 page went from 28.6 MB to 13.1 MB. The bay shell rations its
  services in a building's small rooms (a ceiling panel out in a share of the low rooms by their dice; boxes, breaker
  panels and ceiling pipes only where a room is long enough to run services along; a return grille low on a narrow
  room's wall, in a wide one's ceiling; the `overhead` law reads a low room's air as what hangs in it); a thin band's
  bake cells are 2 m; only a field surface carries two variants. A page whose maps pass `ROOM_MAPS.budget`
  (`form/room-form.js`) draws its dressed tiles' relief at 256², their colour kept whole (`form.room.reliefSize`).
- **Buildings to walk** (`scripts/spikes/bay/buildings.mjs`): each use's plates, its gen-6 and gen-7 pages held to the
  16 MB budget, captured from the lobby, a corridor, the stair and the top storey.
