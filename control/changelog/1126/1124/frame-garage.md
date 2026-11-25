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
  words are mana-ui's, three new campaign idioms (`mana-ui/idioms-campaign.js`): `garage-slots` (the slots and their
  parts, then Sortie), `garage-parts` (a slot's parts, each with what fitting it does to the whole frame as compares)
  and `machine-sheet` (the frame's numbers, its load against its legs', its laws). A part fitted is stood at once;
  Sortie keeps the build in the save and lets the operation go.
- **Parts won** (an operation's `reward`, frame-goal.js; the store's `parts` inventory): each operation's win adds its
  parts to the garage, emitted as it is won (the game channel's `wins`, a level's grants on a success; a level with
  none carries nothing). Warlords of Mars rewards a ladder: a conventional biped kit at Landfall, the close and long
  FCS, the Scatter, the Gatling and the Lance, the light and heavy arms, heads and legs, the Falcon and the Ox, the
  Shear blade, the Arc after the Thunderhead and the Citadel core after Vermilion.
