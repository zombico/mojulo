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
- **Getting over things** (`rule.freeRun`, worlds/controllable/free-run.js, opt-in): the runtime's half of the free-run
  library, whose vault clips (polygonizer/hero-vault.js) nothing on the runtime played. A body running at a thing no
  higher than its hip and no deeper than a table goes over it on an arc that clears the top and lands running, with
  nothing pressed; the jump at a taller thing (to a standing reach) climbs onto its top, or over it where the top is
  too thin to stand on. Refused where another thing stands at the landing or over the top. A wall laid in courses or
  crates stacked are one thing. The page plays `vault` and `mantle` (`TRAVERSAL_FALLBACK`: a figure without the clip
  plays a state it has). It wraps the world's step: every other page keeps every byte.
- **The infiltration yard runs by default and goes over its cover**: the stick's push is the feel's fast gait with
  nothing held; its low walls are vaulted out of the run and its stacked crates climbed on the jump. The operative
  carries the solved clips (`motion: stepVault, speedVault, hurdle`) and the vault plays its step vault; the climb has
  no clip of its own yet (it plays the jump's start).
- **What is in hand, from a held menu** (`rule.carry`, worlds/controllable/carry.js, opt-in): one weapon equipped at a
  time, or none. The weapon menu is held (G, the D-pad's up); the look or the wheel steps through nothing in hand and
  each weapon, turning nothing, and letting go chooses. Nothing in hand puts the gun away: it is not drawn, fired or
  reloaded until another is chosen. The item menu (H, the D-pad's left) is the same, and letting go uses the consumable
  stepped to (a ration gives health back, to the body's most). The keys and the wheel that switched a kit's slots are
  held off. Its strip on the screen is plain DOM for now, not mana-ui's.
- **One pace**: the infiltration yard's stick is the feel's fast gait and there is no sprint: the feel's sprint, its
  stamina and the dodge on the sprint's key are left out of the room's rule, and the operative scheme has no sprint.
- **The dive on a button** (`rule.dive`, worlds/controllable/dive.js, opt-in): the platform rule's dodge taken on one
  press, where the rule asks for a double tap of the boost; `jump: false` gives the body no jump, its button the
  dive's. The infiltration yard's dive is 0.8 s and about 4.8 m, a second after it ends before another. The climb
  moves to the action (`freeRun.on: 'act'`).
- **Nothing in hand, the fists** (carry.js): a body that carries a loadout and a moveset has its rule read two ways.
  With a weapon in hand its strings are set aside and the trigger is the gun's; with nothing in hand its loadout is,
  and the trigger is its strings' light beat. The yard lays the basic arsenal's fist on the operative, its ground
  strings alone: the jab, the cross and the hook on the trigger, the uppercut on the heavy, each the solved clip, a
  bare hand's reach and a damage of 8, 10 and 16 of a target's 100. The aim is held off with nothing in hand.
