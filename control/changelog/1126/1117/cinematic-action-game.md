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
- **The dive plays the hero's own roll** (`dive.clip`): a body with a roll of its own (the hero library's
  `rollForward`, a dive over the shoulder into a tucked roll, which nothing on the runtime played) turns to face the
  way it dives and plays it through the dodge, its phase the dodge's, where the runtime held one tucked pose and
  tumbled the whole body.
- **A vault that stays low** (`freeRun.clipH`): with the body's own vault clip known, the body is lifted only by what
  the thing is taller than the box the clip was solved for, so it passes just over the top (about half a metre of
  lift over a metre's wall, where the arc lifted its feet clear of it). The yard plays the speed vault: one hand on
  the top, the body turned and reclined, the legs over together beside it.
- **A climb solved from the hands** (free-run.js): taken only where the hands reach the edge (`grab`, a standing
  reach) and there is room to stand on the top. The hands take the edge and stay on it; the body is where that puts
  it through the reach, the pull to the chest, the press to the hips and the step up, so the feet leave the ground
  only once the arms have drawn up. It always ends standing on the top. The operative carries a keyed clip for it
  (`climbUp`).
- **The chase is not pulled in on cover the body goes over**, nor while it climbs (a `freeRun` page's only).
- **A climb with nothing pressed** (`freeRun.on: 'push'`): the stick held into a thing the body can climb, for a
  quarter of a second, climbs it (and takes a low thing it came to too slowly to vault). What is in its hand is put
  away through the climb and is in hand again as it stands. The infiltration yard climbs this way.
- **The gun hold carries the elbow's crease** (scene/channels/controllable/gunplay-view.js): a hero whose rig has an
  `elbowCrease` bone had the ring of sleeve it carries left where the stride had the arm while the hold moved the arm
  to the gun, floating beside it. The crease now goes with the elbow, as the elbow's fold does.
- **A bodystocking** (the hero door's `stocking: true`, the realistic body): the body's suit is kept under its outfit,
  the trunk and the limbs in the Top's and the Bottom's own colours, where an outfit took it off and left skin. A gap
  between two garments at an elbow, a hip or a knee shows their colour, not skin. The operative wears one.
- **A climb from the side**: a leg goes onto the ledge first and the body rolls over it, so it stands a little to
  that side of where it took hold (the right where the top has room there, else the left, else straight). The
  operative's climb clip is keyed for it.
- **The chase keeps its distance by anything the body gets over**: it is pulled in neither by a thing it vaults nor by
  one it climbs, so it does not close in as the body comes up to a crate and is not let out again as it goes up.
- **What a watcher sees, drawn** (`rule.sightShown`, scene/channels/controllable/sight-view.js, opt-in): the cone of a
  body with a mind's sight laid on the floor as a fan, its range and half-angle the rule's own, each ray stopped by
  what stops the mind's line of sight (a box across its eye's height), calm while it sees no one and hot while it
  sees the pilot; a fresh sighting is said on the screen with the count. It reads the world and changes nothing.
- **A guard in the infiltration yard**: a patrol in a person's skin walking its round across the far half, its sight
  drawn. It engages what it sees and takes up its round again; it can be struck and shot.
- **The chase's pull-in reads what the thing is**: a `freeRun` page skips a hit only on a thing whose top its body
  gets over (by the runtime's own boxes), where it skipped by the hit's height and stood behind a tall wall.
- **The radar at a person's scale** (a pilot's `rule.radarRange`, metres to its rim): the radar's reach was an arena of
  machines' (620 m), so the bodies of a yard all stood under its centre. With a reach given, a body with a mind reads
  on it as an enemy, red. The infiltration yard reads 30 m: its targets blue, its guard red.
- **The yard's guard is dressed**: a rifleman of the comic pack's private military (`create_character { pack: {
  id: 'comic-hero', grunt: 'privateMilitary', colourway: 'woodland', look: 'realistic-night' } }`), carried by ref.
- **The takedown** (`rule.takedown`, worlds/controllable/takedown.js, opt-in): the action pressed behind a watcher that
  has not seen the body lately, near it and facing it, puts it down in one move. The body is held through the move and
  turned onto the watcher, which goes down at its middle (its health spent, struck by the body: a death as any
  other). From the front, from too far, with the back turned or once it has been seen, the press is whatever else
  the action is. The infiltration yard's operative has it.
- **The yard's guard fires its carbine**: the carbine is its one weapon slot in place of the patrol's blow, so what it
  sees it shoots, in short bursts from where it stands off (a round 8 of the hero's 100).
- **Hurt, it looks round** (`rule.startle`, worlds/controllable/startle.js, opt-in): a watcher that takes damage from
  what it has not seen stops, turns to where the blow came from and sweeps its gaze there. Who it then sees its mind
  has, as on any sighting; a striker that has got behind cover before it has turned is not seen, and it takes up what
  it was doing after its seconds. It only turns the body: what is seen is the mind's own to say. The yard's guard has
  it: struck from behind in the open it turned in about a second and fired; with the striker behind cover it looked
  and went back to its round.
- **The crouch** (`rule.stance.crouch`, worlds/controllable/stance.js, opt-in): down on a press and up on the next (C,
  the left stick's click on the operative scheme). Crouched the body is slower and shorter, and since a watcher's
  sight is eye to eye it is not seen over what its lowered eye is under: behind a wall a metre high it is out of
  sight, where standing it is seen. It stands for a dive, a vault and a climb. The page plays `crouch_idle` and
  `crouch_walk`; the operative carries keyed clips for both.
- **The yard's punches land plainly**: its effects are the western register in the realistic flavour with the shake,
  the impact's flash and its sparks turned well down, and no blow of the fist shoves harder than the jab or knocks
  down (the hook's and the uppercut's longer freeze and the hook's knockdown are gone).
- **It hears** (`rule.startle.hears: { shot?, quiet?, run?, pace? }`, startle.js): a watcher that sees no one hears a
  shot within `shot` metres (25; a weapon marked `quiet`, within 6) and a body moving at a run within `run` metres (7)
  on its feet; a crouched or lying body, or a slow one, makes no sound. It turns to the sound and looks, as it does
  when hurt, and who it then sees its mind has. The yard's guard hears.
- **The prone** (`rule.stance.prone: { speed?, height? }`, `hold`, stance.js): the crouch's button held lies the body
  down, from standing or crouched; lying, a tap comes up to the crouch and a hold stands. Lying it crawls (0.9 m/s) and
  its eye is under a wall half a metre high, where a crouch is seen over it. The page plays `prone_idle` and
  `prone_crawl` with the whole body turned onto its front about its middle (the dodge's whole-body turn, which on a
  page with a prone says where it pivots and how high that rests); the eye's camera rides the lowered eye. The
  operative carries keyed clips for both.
- **The fan is a line of sight in height** (sight-view.js): it is drawn for the pilot as it stands now. A box as tall
  as the watcher's eye ends a ray; a lower one that stands over the pilot's eye leaves a hole behind it, out to where
  the line from eye to eye clears its top, and the fan takes up again beyond. Crouching opens a hole behind a wall a
  metre high; lying down opens one behind any low cover. It draws what the mind's own sight already said.
- **The crosshair is where the round goes** (the aim held's pages): a gun that converges sends its round to the point
  under the centre of the over-the-shoulder view, but its reticle was drawn out along the body's own line, which lies
  beside that centre by the shoulder's offset. Over the shoulder the reticle now sits at the view's centre; from the
  eye it is the body's line as before.
- **The operative in a facility** (`scripts/spikes/mission/facility.mjs`): the yard's hero, its kit and its guard stood
  in a geocube level of the seventh generation, a military hangar bay on a land with its hall dressed as a garage and a
  siege walker parked in it. A geocube recipe takes no pilot, so the script lays the hero's camera and events on the
  resolved payload; the level's own start is the walk's, under the hall's slab, so the hero starts on the hall floor.
  Played headless: it stands, runs and vaults the hall's barriers under the level's light, the guard walks its round.
- **Level 1 planned dry as a walled-core dungeon in miniature** (`scripts/spikes/mission/level1.json`, `plan.mjs`): a
  mission's layers are the segments of one level (an outdoor section of its walk, a building's inside by its door),
  its doors the joins, its gates what is found in the layer before. The briefed mission is intel on the assault
  walkers in the main hangar; clues there lead to a second hangar beneath, the core, where the siege walker stands.
  Nothing is built: the level is laid through `gameStages` to say which segments the rail makes, the dungeon's laws
  are read on it by its own reader and the mission's beside them (a key in the space its door leaves, clues enough
  that one may be missed, what stands parked a vehicle the registry parks, one result where the core's way out
  leads). The core is no separate place: it is floor 0 of the same building, lodged under the ground, a hall under
  the main hangar joined to it by the freight lift. The planner lays the building dry with its program's floor 0
  (era/program-core.js `basement`) and says what it finds: the rail lays a stage for every segment and both halls are
  rooms of the one building; the hall under is a storey high (3.5 m) where the siege walker stands 8.4 m, the floors
  are joined by the stair core and no lift is built, and nothing inside a level opens on what the player holds.
- **A floor 0 lodged deeper** (a core building's `basement: { hall: <metres> }`, era/program-core.js): the annex's
  undercroft is a hall that high, so the whole storey lies that much further under the ground; its other rooms keep
  their height. The core's stair does not climb that far in its shaft, so no flight is laid to it (a finding says so):
  what joins it is its level's. `basement: true` is as it was.
- **A mission in one level** (`rule.mission`, worlds/controllable/mission.js, opt-in; its page half
  scene/channels/controllable/mission-view.js): things found by walking onto them, clues read with the action, a
  reveal when enough are read, ways between two floors (a lift, a stairwell) ridden with the action once what they
  need is held and set, barriers that stand until then, objectives in order and one result. It is the walled-core
  dungeon's gate played inside a level, which was not built. The page marks each thing, says the objective, what the
  action would do or what it still needs, and closes the screen over the middle of a ride. Plain DOM, not mana-ui's.
- **Level 1's hangar, played** (`scripts/spikes/mission/hangar.mjs`): the hangar bay with its floor 0 ten metres down,
  three assault walkers on the line in the main hall, the siege walker in the hall under it, the freight lift between
  the two (its key in the parts store, and two of three clues read), the stairwell shut from above and the way back
  out once the proof is in hand, the operative and its kit, two guards above and one below.
- **A door between two segments' pages** (mission.js `exits`, `arrivals`, `state.msCarry`): an exit taken with the
  action, once what it needs is held, sends the page to the other segment's; what is held, read and set and the
  body's health go with it in the address, and the body stands at the door it came in by. A spike's own hop: the play
  shell's door transit and its store are the rail's, and this does not use them yet.
- **Level 1's perimeter yard, played** (`scripts/spikes/mission/yard.mjs`): the stage the rail lays for the level's
  `perimeter` section (its trail on the land, the hangar behind its door, the barracks walked into), the operative and
  two guards on rounds along the trail, the hangar's key in the barracks' day room, the hangar's side door into the
  hangar's page and back, and the mission's one result at the trail's head with both proofs in hand. The trail's
  bounds give way to a perimeter round the trail and the buildings.
- **The chase sees through what grows and past its own lead** (the aim held's pages): it is no longer pulled in on a
  crown, a bush, the grass or a cloud, nor on what stands between its look point and the body (the look leads the
  body, so a body run up against a wall had its look point inside it and the view jammed into its back).
- **The yard starts clear of the hangar's wall**: the rail stands the hangar's shut shell along the trail with its
  corner on the trailhead, so the body starts six metres clear of what is built, and the result is there.
- **The yard in the seventh generation**: the rail lays the level's section as a `stage` painted by its geocube, and
  the form render (the land, the trail and the plants as material under the cube's light) is a geocube scene's alone,
  so the yard read as it stood was painted land beside a form-lit hangar. `yard.mjs` asks for the same section as the
  geocube's own path in gen-7 (its cube, seed, trail and buildings the rail's), with an apron, containers and floods
  by the barracks; the bodies and the mission are placed on the land as it is read back.
- **The game's HUD on the mission's pages** (after the UI branch's merge): the spike's pages ask for the level HUD in
  the game's look (`levelHud`, the `field-brief` theme), and the held carry menu is its weapon wheel
  (carry-view.js answers `window.__mojWc` while a menu is held on a page with that HUD; its own strip is put away).
  The mission's own words (objective, prompt, found) are still plain DOM.
- **A lift's opening in a building** (a core building's `basement: { lift: true | { w?, d?, at? } }`, era/program-core.js;
  a stage's `lifts`, era/storeys.js `placeLifts`): an opening through the floor between the annex and the hall under
  it, cut as a stair's is (the ceiling under it, the floor over it), its shaft lined between them, its edge a marked
  curb on the upper floor, an anchor of kind `lift` saying where. No flight and no rail is laid: what travels it is the
  level's. A building that asks for none is as it was.
- **A lift ridden for real** (mission.js, a way's `deck`): the deck is an entity, a slab that fills the opening; ridden,
  it travels its shaft eased over the way's seconds and the body is carried on it, where the ride was the screen
  closed and the body stood on the other floor. Pressed at the end the deck is not at, the deck is called and comes
  alone. The page's ground is the world's meshes, never a body's, so a deck is stood on through the mission's own
  ground. The opening is open when the deck is away.
- **A ride's shot** (a way's `shot: { <end>: '<cue>' }`, `face`): a carried ride to that end plays the cued shot of the
  page's shoot plan with the view the plan's through it and bars top and bottom, and hands the view back as the ride
  ends (mission-view.js on channels/shoot.js `cue` and `look`). Level 1's lift down is three framings on one camera,
  cut hard: the deck coming down seen from the lower hall's floor, the hall over the operative's shoulder as the
  walker rises into it, and the walker low and wide on a push.
- **Stealth routes, found by search** (gameworld/stealth-routes.js): the ways through a watched place, so a sneak's
  level is proved to have them. A grid over the ground, a metre a cell; a watcher sees as the runtime's minds do (a
  cone, a range, a line from eye to eye that is in height too, so low cover hides a body only as low as it); a run is
  heard from close by; a patrol's round is known second by second. For a start and a goal it says the way anyone
  tries first and where it is seen, the fastest way never seen or heard (its waits, its crouch and crawl, its detour),
  and a second way apart from the first; and it holds the place to four laws (the first try is seen, a way unseen, it
  costs patience or a detour, a second way). Advice, never a refusal. Coarse on purpose: flat ground, the round from
  the first second.
- **Level 0, the approach** (`scripts/spikes/mission/level0.json`, `level0-plan.mjs`, `level0.mjs`): the starter's first
  segment, on the geocube's land with nothing built on it. The controls are told where they are first needed
  (mission.js `hints`). Two places ask for a sneak: a convoy parked across the land with one gap on the trail and a
  slot at its far end, a patrol through the gap and one along its front; and a camp beside the trail with a lookout
  on the trail and the open ground, a guard on its back and a patrol past it. Its cover is the registry's parked
  vehicles, two logs and a stack of crates, and the land's own shrubs. The planner says each place's first try is
  seen and each has two ways unseen: through the convoy's gap along the shrubs behind the patrol or round by the far
  slot; through the camp behind the lookout or a crawl behind the logs. Its trail's end is the door to the yard.
- **The starter says it is a template** (`scripts/spikes/mission/README.md`): what the three segments are, the word
  that changes each thing a person will ask to change, and the rule that a change is tried on the planner before a
  page is built. `lib.mjs` holds what every segment's builder does the same way (the land's height under a point
  among them, so what is parked and laid stands on the ground as it was laid).
- **A watcher's sight on the radar** (`sightShown: 'radar'`; gameworld/radar.js, the game UI's `minimap`): a watcher
  whose rule shows its sight carries it on the HUD's radar, its mark's `fan` a wedge from where it stands along its
  facing, each ray ended by what would hide the pilot as it stands now (so a wedge stops at a metre of cover for a
  crouch and runs on past it for a body standing), tinted by its state: calm, searching, seeing. The map part draws
  any marker's `fan` (points, itself first) under it, cut with a clip path. A watcher that says `'radar'` lays no fan
  on the ground (sight-view.js still says a sighting); `true` lays it on the ground as before. The HUD's radar reads
  the pilot's own `radarRange` where it names one. The starter's guards show their sight on the radar, and the
  infiltration yard's page takes the game's HUD so it is drawn there too.
