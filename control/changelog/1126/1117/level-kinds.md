### Level kinds: a rail's primitives, and the holding block

- **A rail's level kinds** (gameworld/level-kinds.js `LEVEL_KINDS`; rails.js `railSheet` carries them as `kinds`, the
  rail's card says them): the kinds of level a game of a rail's type is built from, each a primitive an agent picks by
  name with its shape, the verbs it teaches, what presses on the player there, the laws that prove one of it good, its
  status (built, a spike, or proposed with what it waits on) and where a level of it is made. A game is kinds in an
  order, and the order is its Game Brief's, never the rail's. Steel Serpents names seven: the approach (level 0), the
  compound (level 1's yard), the interior (the barracks, the hangar), the holding block (a spike), and, proposed, the
  gauntlet on alert, the moving checkpoint and the overwatch. A new kind is a row.
- **The kit taken** (worlds/controllable/carry.js `locked: '<item id>'`): until the mission holds that item, the weapon
  menu offers bare hands only and nothing is in hand; the moment it is held, the kit is back, its first slot in hand.
- **The holding block** (scripts/spikes/mission/holding.json, holding.mjs): a level of the new kind on the `cell-block`
  program, its design in the building's own room names. The operative wakes in the last cell of the east wing with the
  kit taken; the kit is on the processing desk; a turnkey walks the cell corridor end to end and a desk sergeant crosses
  the sally port, each looking round at its ends; the front door, reached holding the kit, ends it. Its laws are proved
  by the route search over the building's own walls (`--plan`): the straight way out is seen (by the turnkey at once), a
  way out unseen exists by the round alone (53 s, crouched behind the turnkey), the kit is on a way out, and so no way
  out needs a kill.
