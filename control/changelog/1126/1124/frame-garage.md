### Warlords of Mars: the hangar and the garage

- **The frame builds in the page** (`assault-frame/kernel.js`): the parts, the assembly, the body, its clips and the
  pilot's entity as one page-runnable kernel, so a level can stand any build the player chose. Its packed figure is
  the server's, byte for byte (a tripwire test).
- **A frame level stands the save's build** (`assault-frame/hangar.js`, the store's `hangar` slice): the build kept as
  a flag a slot (`frame.<slot>`: a part's id, `-` for none). Every frame level consumes the slice, a world with frame
  levels declares it, and the page builds the frame it says with the kernel and stands it in the pilot's place: its
  figure in the light the level's own pilot was made under, its numbers, its weapons, its HUD.
