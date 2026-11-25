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
