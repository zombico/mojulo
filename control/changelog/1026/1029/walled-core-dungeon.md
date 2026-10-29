### Walled-core dungeon: an interior military base, its maps, terrain and load-bearing doodads

A walled-core dungeon (WCD) is a dungeon built as layers on a critical path toward a final area, the core: inners (each
a dungeon of its own), outers (the spaces that bind them) and intermediaries (the lifts, teleporters and doors between,
each carrying its gate). Its principles are laws read on the recipe. Started with an interior military base: its uses,
panels and load-bearing doodads, stocked by use. Built so far:

- **The recipe** (`wcd/wcd.js`): a design_game world's `wcd: { core, spaces: { <id>: { kind: inner | outer, depth,
  level?, use?, look?, built? } }, doors: [{ from, to, via: lift | teleporter | door | stair, gate?, oneWay? }] }`,
  read against the world's levels and refused by name when malformed. A gate is a clearance (a keycard's level, 1 to 9)
  or a power. `built: false` keeps a space on the path unmade, so a vertical slice ships the inner layers alone. The
  critical path runs from the outermost spaces to the core, a one-way door (a shortcut back out) no way in.
- **The principles, as laws** (advice in design_game's readout, `advice.wcd`; never refused): `deeper` (the path
  deepens at every door and ends in the core, the deepest space), `core-inner`, `outers-bind` (an outer joins two
  spaces or more; the outermost binds the world outside to what it joins), `gated` (every space past the outermost is
  entered through a door, and a door inward names its gate), `distinct` (two spaces a door joins differ in construction
  or palette, read through the composer; the light is the theme's, set once), `same-level` (a lift or a teleporter moves
  within one level).
- **The card** `gameworld-wcd` (`get_game_vocab`), its words the tables' own.
- **A base's buildings** (`era/programs.js` `BASE_USES`): nine corridor-and-core uses whose rooms are what a base is
  stocked for: `hangar-bay` (the ready room and shops, the hangar off its end), `barracks` (bunk rooms on two storeys,
  the first sergeant at the top), `armoury` (the issue window, cleaning, rack cages, the vault), `comms` (radio rooms,
  the server room, crypto at the top), `command` (staff offices, briefing, the operations centre), `mess` (the
  scullery and stores, the dining hall off it, the quartermaster), `med-bay` (triage, wards, theatres, the pharmacy),
  `cell-block` (processing, cells, interview rooms, isolation) and `plant` (switchgear and pumps, the generator hall,
  plant control). Each is on the bay kit of what it is (a hangar's steel, a barracks' painted block, a comms room's
  white panels, a plant's concrete), so layers walked one after another look unlike each other. A space's `use`, a
  level's `building: { use }`, anywhere a building use is read. The world card names them as "a base's"; the WCD card
  lists them.
- **The bunker** (`style/bay-axes.js` construction `bunker`, `era/bay.js` `B.fittings`): board-formed concrete to the
  crown, plate on its columns, beams or a vault, unbraced; a heavy blast-door frame with its leaf parked over the
  opening (its leading edge striped) and chevrons down the jambs; cable trays down the long walls under the crown, one
  cable leaving the tray in every other bay to run `\_/` along the wall (`wallCable`, `dipPath`: a cable bent at 45° in
  the wall's plane); a stencilled placard by each door. Heard in words (`bunker`, `blast door`, `hardened`, `fortified`,
  `underground base`: `blast door` was the military construction's word and is the bunker's now, for new recipes; a
  stored reading keeps its own) or pinned (`compose: { construction: 'bunker' }`). The composer's word pick now takes a
  value that is no register; the registers are the palettes' (they were the constructions'). Every other construction
  lays none of it. `scripts/spikes/bay/bunker.mjs` captures it beside the military register.
- **Stocked by a supply chain** (`era/stocking.js`, laid by `compose-dress.js` `layProps`): a composed base building's
  rooms hold what their use is stocked with, in place of the register's generic clusters: bunk rooms their bunks,
  footlockers and lockers; an armoury's cages their weapon racks and its magazine its rounds; a comms building's
  server racks and radio consoles; a mess's dining hall its tables; a ward its cots; a plant's pump room its pumps and
  fuel; every lobby a sandbag guard post; an extinguisher by each doorway of a stocked room. A command's landmark holds
  the ops table and a plant's the generator; any other base use stands no great object at its landmark. The new pieces
  carry play: sandbags and jersey barriers are cover (a boulder's class: they take a beating), a shipping container is
  climbed. A centre line its room cannot hold (a doorway's sightline across it) lays the rest along the walls. The
  supply chain's laws sit beside the dressing's (`compose.dress`): `weapons-in-armoury`, `fuel-apart` (no drum within
  3 m of ammunition), `extinguisher-by-exit` and `stocked` (every room the tables stock holds some of its stock). Every
  other stage lays what it did.
- **A space builds its level** (`gameworld/world.js` `resolveLevel`, `gameworld/levels.js` `buildingStage`): the WCD
  space a building level is (its `level`) hands the building its look, composed into the stage's construction and
  palette, and its `tone` (a space's new key, read as a stage's tone), the stage's colour; carried on the dungeon, so a
  rerun of the world keeps it. A base building's level is composed, and so stocked, with or without a space's look (on
  its kit's own register). A building that is no base's, named by no space, is laid as it was. A space's malformed tone
  is refused at the world, by name.
- **Extinguishers placed off the room's face**: they were set off the doorway's line, the wall's middle, and so stood
  in the wall on every kit whose rooms sit a half-wall in from it, and were dropped; and they are laid before the stock,
  so the stock does not take the wall beside a door first. The deep sweep stocks each base use as a world builds it, on
  its own kit.
