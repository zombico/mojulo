### Warlords of Mars: the hangar and the garage

- **The frame builds in the page** (`assault-frame/kernel.js`): the parts, the assembly, the body, its clips and the
  pilot's entity as one page-runnable kernel, so a level can stand any build the player chose. Its packed figure is
  the server's, byte for byte (a tripwire test).
- **A frame level stands the save's build** (`assault-frame/hangar.js`, the store's `hangar` slice): the build kept as
  a flag a slot (`frame.<slot>`: a part's id, `-` for none). Every frame level consumes the slice, a world with frame
  levels declares it, and the page builds the frame it says with the kernel and stands it in the pilot's place: its
  figure in the light the level's own pilot was made under, its numbers, its weapons, its HUD.
- **The hangar** (`scene/channels/controllable/frame-garage.js`, a frame stage's `garage: true`): every operation opens
  with the frame on its pad in a hangar bay (the field put away behind a render layer of the bay's own), the camera
  swaying slowly across its front, the operation held behind it. Its
  words are mana-ui's, three new campaign idioms (`mana-ui/idioms-campaign.js`), read as tables on solid plates for
  fitting: `garage-slots` (the slots and their parts, then Sortie), `garage-parts` (a slot's parts in a list, the one
  in focus said in a line, and one table of every part's figures, each with its change from the fitted part; a column
  only where the parts differ, its labels said once) and `machine-sheet` (the frame's load as a bar against its legs',
  its figures in two columns, its laws). A part fitted is stood at once; Sortie keeps the build in the save and lets
  the operation go. While it is up the field's HUD (its radar, banners, legend and readouts) is put away.
  - The bay is dressed: panelled walls (inset plates, vents, lamps), cable trays and loose cables sagging between the
    ribs and down the gantries, steel crates stacked in the corners and along the walls, drums in clusters; the
    turntable's deck is plate drawn in the page (ring and radial seams with their bolts, a hub, a hazard band at the
    rim). Laid by fixed dice: the same bay every time.
- **Parts won** (an operation's `reward`, frame-goal.js; the store's `parts` inventory): each operation's win adds its
  parts to the garage, emitted as it is won (the game channel's `wins`, a level's grants on a success; a level with
  none carries nothing). Warlords of Mars rewards a ladder: a conventional biped kit at Landfall, the close and long
  FCS, the Scatter, the Gatling and the Lance, the light and heavy arms, heads and legs, the Falcon and the Ox, the
  Shear blade, the Arc after the Thunderhead and the Citadel core after Vermilion.
- **The operation's briefing** (`campaign/operation-brief.js`, a frame stage's `briefing: true`): an operation is told
  on the holo table before the drop, as Rebel Storm's missions and Wolf Squadron's stages are. The table is the field's
  own ground (its height grid the hologram's terrain; a works' field its machines, decks, furnaces and racks stood up as
  masses), the drop, every group of the operation where it stands as a miniature with its count, and each beacon. The
  steps are the operation's own design (an operation's `briefing`: a region and its steps, each a title, its words, what
  it lights and the routes it draws), else a step for the field and one a task. The briefing channel holds the operation
  behind it; Launch hands it to the hangar. The table's roster is headed in the design's word (`rosterTitle`: an
  operation's Forces; a squadron's Flight groups, as before). The ground force's other cards stand on the table as the
  nearest miniature (a frame, a drone and a gunship join the unit minis).
- **Two designed operations.** The Siq (the gorge massif, Valles Marineris): guns on the high ground over a slot canyon,
  Wasps raking its length, two Bastions shutting the narrows, then out to the beacon at its mouth. Furnace Row (the
  smelter hall, Pavonis Works): walkers on the operating decks, the crane controls reached and held while the main
  ladle is cut loose, then the foreman's pack of two Jackals and their Rhino.
- The hangar's idioms (`garage-slots`, `garage-parts`, `machine-sheet`) have a hangar in mana-ui's sample state, so the wireframe board and the idiom sweep draw them full.
