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
- **The radio call** (`gameworld/script.js` `calls`, `scene/channels/calls.js`): a level's script makes calls beside
  its lines, each at its moment, and a call stops the game: the world held as a menu holds it, a screen over it with the
  two on the line (the one called on the left, the caller on the right, the speaker lit and named), the words; Enter,
  Space or a click passes a line, Escape ends the call. Made once unless it says `again`; a call waits while the game's
  opening is up and its turn behind another; its end is said on the bus (`call:<id>:end`, `:skip`), so a task or another
  call can wait on it. A moment may now be any event the bus hears (`{ event }`: the garrison's `alarm:found`, a hand on
  a ledge, a scene's end), and a sequence on the alarm's or the ledge's events has the runtime's facts fed to the bus
  (playscape/ui/cast.js). A level writes its own `script` (`levels.<id>.script`, its tasks numbered as its objectives
  number them); the script book reads it, its calls' lines among its lines. Played in headless Chrome on the
  infiltration level: the opening call after the title, the world held and the keys its own, each line passed, play on
  where it was; a call on the first sighting, ended with Escape. Absent, a page emits none of it.
- **A ship's deck, the sea and what is seen across it** (infiltration-words.js, infiltration-level.js): an infiltration
  level's ground may be a deck (`ground.deck`: its length, its beam, a rail round it whose collider is deeper than a
  vault crosses, so the free run never carries a body over it), the sea under it lower than a vault lands (`sea`), boxes
  seen and never walked (`scenery`: an island's cliff, a fortress, `lit` the colour a window keeps at night), cover
  raised off the floor to crawl under (`cover[].z`), `night`, the operative's `kit` on this level (a quick kit's arms in
  place of the world's), and `marks`, named places its scenes frame (levels.js stageSpots). With no `exit` the level is
  won as its last task is met (a scene's end). A call waits out a scene as it waits out the opening.
- **The prologue's first level** (`scripts/spikes/jericho/world.json`, `build.mjs`): Hidden Jericho's supply boat, a
  designed world through the real doors. The title and the chapter's card, the opening scene (the boat on the night sea,
  the fortress on its island off the bow, then Coral at the stern), the Liaison's call, the lessons as calls (the deck,
  the pipe run crawled under, the crates vaulted and the container climbed by its lip), the package taken at the bow,
  the keycard scene, the results. Played end to end in headless Chrome by a bot on the stand-in: every task met, no page
  error. Coral made through the character door on the operative's body (stubble, swept hair; the watch cap not yet).
  The lessons' words are placeholders in brackets, for the person's own.
- **The bandana tied lower and narrower** (headgear/realistic.js `bandana`): its front a little over a third of the way
  from the brow to the hairline (half before), its back near the skull's back point, its band 26 mm (34), its cloth
  thinner, so it reads as cloth knotted round the head with the hair standing above it rather than a rim round a helmet.
- **A vest without its back panel, and a piece worn in place of its card's** (polygonizer/outfit-plan.js `vest.back`,
  outfit/expand.js `outfitPieces`): a vest's `back: false` leaves the panel hung high on the back off (the "backpack"); a
  build's piece that says `replace: true` stands in for its style card's pieces of its kind, where the build's and the
  card's were both worn (the security card's slick vest under the operative's plate one, its back panel with it). Absent,
  every outfit as it was.
