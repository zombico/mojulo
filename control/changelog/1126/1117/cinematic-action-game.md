### Cinematic action game: a mission spiked on Steel Serpents' first level

A spike of one primitive, the mission: an encapsulated sortie with a preset loadout, a walled-core dungeon infiltrated a
layer a page, cutscenes between and inside its layers, and one result. Nothing registers a kind, a mechanic, an MCP tool
or a recipe key; the spike mints through the real doors and measures.

- **The probe** (`scripts/spikes/mission/`): Steel Serpents' base written through `design_game` as it stands, to say
  what builds, what is refused and what is dropped. In progress.
- **A bandana** (`headgear: 'bandana'`, headgear/cards.js): a cloth band tied round the brow over the hair. On the
  realistic head it is the circlet's band wide and without its gem, a knot at the back and two tails hanging from it
  (headgear/realistic.js `tails`; a wide band takes one support over its whole height, so nothing stands through it);
  on the game body the band alone. Held to the headwear law beside the circlet and the hats.
- **The aim held** (`rule.aimView`, worlds/controllable/aim-view.js, opt-in): a third-person body moves under a free
  camera; while its aim is held the camera stands behind its shoulder, the body turns with the look and the trigger
  fires (it does not with the aim down, unless `hip`); from the aim, an edge goes to the eye and back (the body hidden
  while the camera rides it), another to the other shoulder. Let go, the free camera again, looking where the aim left
  it. It wraps the world's step, so every other page keeps every byte.
- **The operative's controls** (`SCHEMES.operative`, controls/schemes.js): the pilot's actions laid out as a stealth
  action game lays them. The aim on the left trigger and the right mouse, fire on the right trigger, the eye on the
  right shoulder and Tab, the other shoulder on the right stick's click and Q, the sprint on the left stick's click
  and Shift, the action on the west face, reload on the east, the dive on the north, the weapon in hand on the D-pad's
  up. A page whose pilot aims this way reads it in the pilot scheme's place. The stance, the binoculars, the radio and
  the item slots have no action yet.
- **The infiltration yard** (gameworld/infiltration-room.js, `scripts/spikes/mission/room.mjs`): a practice room for
  this kind of game. The world's hero on its feel, its template's kit in its hands (Steel Serpents: a handgun and a
  knife), a walled yard of cover and a person's box at 5, 15 and 30 m and behind a corner. Not on the practice door
  yet. Played headless on real key and mouse presses: the run, the sprint, no round unaimed, the aim, a round, the
  other shoulder, the eye, the free camera again, with no page error; nobody has played it.
- **A practice room's hero under the cast rig** (`castLight: { cube, hour? }` on a world that is no form page,
  worlds/world-scene.js): its bodies are read as a level's form page reads them, the skinned body under one light, where
  a greybox page drew the painted figure, whose skin showed through its cloth at the shoulders, the collar and the
  joints. The infiltration yard asks for it (the `theatre-grey` cube) and bakes its hero at the play grade. Absent, a
  page is as it was.
- **The camera back from the eye** (the aim held's pages only): a follow camera is no longer pulled in on what is not
  drawn. The eye's own hands and gun, hidden once the aim leaves the eye, pulled the chase into the hero's back.
