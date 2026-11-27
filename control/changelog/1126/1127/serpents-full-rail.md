### Steel Serpents' full rail: a stealth game led by radio and cutscenes

- **In progress.** Steel Serpents taken onto the full game rail a frame operation stands on (its opening and chapter
  card, its script said as comms, its lessons and guide, its objectives with their pauses, retry and alarms, its
  results), in the stealth game's own idioms: no ally on the field, the player led by the radio and the cutscenes.
- **The ledge in the infiltration yard** (`worlds/controllable/ledge.js`, from the cinematic rail): the operative takes
  a lip. Walked or dropped off something taller than a body, the hands catch its edge and hang; the stick shimmies
  along it, the dive's button pulls up over it (a body that dives on the jump's button has the dive's press as its jump
  while it hangs, `dive.js`), held away it lets go. The bus hears `ledge:catch | pull | leap | drop`. Absent, a page
  emits none of it.
- **The ledge's poses** (`playscape/player.js` `STUNT_CLIPS`, `stuntStates`): hung by the hands, the arms up to the lip
  and the legs loose; the hands drawn together and spread again along it; the elbows driven down and a knee brought up
  over it. The yard's stand-in carries them, and the free run's climb now plays the pull up where it played the jump's
  start; a made hero minted with them says so (`stunt: true`), else it hangs on its jump's flight.
- **The registry**: `space.traversal=ledge` built.
- **Hidden Jericho, the prologue's model** (`scripts/spikes/jericho/prologue.json`, a spike: no recipe key reads it
  yet): a solo mission led by the Liaison on the radio, drafted as a walled-core dungeon. The supply boat outside it; a
  big circle in from the hangar dock by the cliff yard and the research wing to two prototype bays (a walker that only
  walks, the armed personnel walker), back round to the engineering lab over the hangar; the walker bay its core. The
  card's three inserts raise its clearance on the screen and unlock the walker bay's elevator for another; the hold-up,
  the escape and the cargo submarine as shot beats. Every one of the dungeon's laws holds on it.
- **A stealth level a designed game lays** (`levels.<id>.infiltration`, `gameworld/infiltration-level.js`; world.js reads
  it, levels.js lays it as one stage): a level's floor (a walled square, `ground.half`), its cover (boxes, each a
  collider), its guards (a patrol from `at` to `to` and back, or a post looking toward `facing`; `cone`, `range`,
  `speed`, a look round at each end), the garrison's `alarm` numbers and its `backup`, and its `tasks` (reach, take, act
  on a bus event) done in order before its `exit`. The operative is the infiltration yard's, the world's own hero where
  made; each guard is the yard's guard on its own round. Being seen loses nothing: it raises the alarm, and the way out of
  it is to hide. Laid as every designed level is, so a level's `opening`, the results, the saves and the objectives reach
  it. Played in headless Chrome: the opening loads and waits, the operative runs, a guard's sighting raises the alarm, no
  page error. Not yet: the task's words on the HUD (the count alone), a geocube's land under it (a greybox floor), the
  cover's look.
