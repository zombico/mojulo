# Changelog

All notable changes to the `mojulo` npm package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
From `3.0.0` the media, game, connected-service and app loops and the recipe
format are the stable surface, and the chatbot factory is no longer part of
mojulo. From `3.1.0` the connected-service and app tools are no longer listed:
they still answer by name (the CLI, plan steps, skills that name them). The dashboard package, `mojulo-ui`, is released at the same version.
Releases up to 2.1.0, and the detailed log behind 3.0.0, are archived in
[CHANGELOG-2.x.md](CHANGELOG-2.x.md).

## [Unreleased]

### Teardown: exploded views, disassembly and construction, in order

- **A piece's teardown, read off what it already knows.** `teardownPlan` / `teardownTracks`
  (`playscape/destruct/teardown.js`) turn a workbench `frames` entry into ordered steps: its instruction manual's
  steps, each with the parts that move and the way they seat. They then turn the steps into per-part offset tracks:
  `exploded` (held open), `disassemble`, and `assemble` (the same tracks reversed in time). The defaults need nothing
  authored: the order is the manual's, the distance is 12% of the piece's largest side, and each step is 0.6 s with a
  0.25 s hold. Pure, with the same bytes for the same piece.
- **`teardown` on a workbench frame.** A `frames` entry (a buildable furniture piece's included) takes
  `teardown: true | 'exploded' | 'assemble' | 'disassemble' | { show, at?, seconds?, distance? }`.
  - The exploded still and any `at` move the faces: what `export_model` and the World show.
  - `assemble` and `disassemble` play in the World on the mover channel, one mover per face group, so `forge_motion`
    records them. The cameras and floor are framed to hold the piece apart as well as together.
  - The frame validator names the shows. A teardown supersedes `explode`, and refuses a `kit` layout.
  - Absent or `false`: byte-identical.
- **A moved group carries its texture.** In the World page, a mover on a textured group now moves the group's
  texture sub-meshes with it: the wood goes with the part, and a labelled lid swings with its label. This is emitted
  only when a mover moves a textured group; every other page is byte-identical.
- **One explode law.** A frame's static `explode` and the teardown's exploded pose are now the same function
  (`explodeParts` in `construction/frame.js`), so the two agree to 1e-9. `explode` renders byte-for-byte as before.

### Geocube: one style for a level's inside and outside, and the front door for building one

- **`geocube`, a world kind.** A cube is a level's core look as data: its light (a sixth-gen reference, the moon for a night outside, the outside's fog), its key colours (each a ramp), its register, its surfaces' patterns, the bones of its inside, the base of its outside and its principles, one line each. `{ kind: 'geocube', cube, show: 'room' | 'land' }` shows one of its two specimens: a bare room (the bones, an accent wall) or an island landform. `cube` is a preset (`gothic-night`, `island-noon`, `jungle-haze`) or a whole document; a document is checked key by key.
- **A stage builds on a cube.** A `stage` recipe's `geocube` lowers the cube under the recipe's own keys: the kit, reference, tone and tiles of the inside, or (with `meru`) the outside's look card, its land ramps, light and air. What the recipe says wins, so the next step varies the cube instead of restyling the level.
- **`meru.shading`: the land lit by polygons.** Cliffs and boulders are baked, not drawn as lit and shaded tiles; rock is lit once per facet; ground and sand are smoothed across the grid; the land keeps its continuous light instead of the card's bands; and three rules read from the land's own shape go into its corner colours: `crevice` darkens what is concave toward the cube's shade colour (never black), `ridge` lifts a convex lip, `blend` carries a neighbouring surface's colour over a seam. A cube's outside has it on. Absent, the land builds as before.
- **Routing.** A level with its own look (rooms, open land, an island) starts from a geocube: the studio index, the world card and a new `geocube` card say so.
- **A level copies its cube.** Building on a cube copies it into the level's recipe; a changed or new cube rebuilds nothing until the level is re-created from it, by hand.
- **`shadows` on a stage: the gen-6.0 shadow upgrades.** `torch: 'hard' | 'soft'` gives every placed light and brazier a shadow test, so a torch no longer lights what a pilaster hides from it (`soft` spreads the flame over a small cross of taps, for about four times the bake); `sun` is the key's soft edge in degrees; `cells` cuts the surfaces finer (to 0.25 m) so a shadow has corners to land on. A cube's inside takes hard torch shadows, a 1.5° sun and half-metre cells. `meru.shading.sun` softens the land's sun the same way (1.5° by default). Absent, the bake is as before.

### Geocube specimens: a room's bare bones and an island to check terrain on

- **`dress: false` on a stage** builds the kit's bones only: the walls, floor, vault, trim and torch seats, with no set
  piece, accent wall, doodads or blends. A room specimen of structure and light before anything is placed in it.
  Absent, the kit is dressed as before.
- **`island` on a local meru** sets it in a sea. Past the shore the plain falls to a seabed under a translucent water
  sheet, clear over the shallows and deep over the bed. On the low side the shore is a sand beach; on the `high` side
  the land stands up and drops straight in, and the cliff rule paints the drop as rock. `island: true` takes the
  defaults (`shore`, `beach`, `sea`, `depth`, `high: { azimuth, height, span }`). Without it, a meru builds byte for
  byte as before.
- **`island.geology: true`** runs the raised land (the mountain and the high shore) through the card's landform, as
  the nature shell runs its cliff, without the beds: joints break it into planar facets and talus sheds scree, so the
  mountain, the shore and the boulders are one faceted rock.
  Every face of the raised land that is not a flat bench or top is rock, so a mountain never reads as a turned mound.
  **`island.walk: 'base'`** draws only the approach to the mountain's foot, no way up it.

### Cosmos cube: a game as six facets, and a dry run of what the builder can make

- **Six facets.** A cosmos cube describes a game as six facets:
  - **Reality:** the look and how assets are made. This facet is the geocube.
  - **Space:** the levels and how they connect.
  - **Power:** the verbs and rules.
  - **Soul:** the characters.
  - **Mind:** what the others decide.
  - **Time:** the story.
- **Each facet is a small seed with a depth.** The depth runs from 0 (a preset reference) to 3 (samples the operator
  approved). It is measured, never claimed.
- **A capability registry.** It is generated from the tables that already define what mojulo builds, with hand notes
  where a table is silent. It says what each facet setting lowers to today.
- **A dry run over game types.** Fixtures and seeded sweeps resolve game types against the registry and report each
  one as makeable, makeable with gaps (naming the facet and the setting) or blocked. Nothing is built, and every
  existing world, character and game is byte-identical.
- **An unlock ranking.** The sweep recounts its rolled cubes as if one value, or one whole facet, were built, and
  ranks them by how many games that would lift. `node scripts/cosmos-sweep.mjs` prints the map; `--fixture <id>`
  shows one game type row by row; `--json` gives the whole report.

### Cosmos gaps: what the sweep found missing, filled in the order it pays

- **The map prices its gaps.** Every missing or partial value in Space, Power, Soul and Mind carries a rough effort
  (S, M or L), and values that one change fills are grouped into a work package. The sweep ranks packages by the
  games they lift per unit of work, so the build order is recomputed on every run.
- **A mind is a matrix.** Every non-player character meets six situations: idle, notice, engage, strike, pressed and
  lost. Each one resolves, as fauna behaviors do, from four axes:
  - motivation and aggressiveness, which are authored;
  - the actions and capability its body measures, which are never authored. So a mind cannot ask for a verb its body
    does not hold.

  Two more authored dials sit beside them:
  - **Rank.** Minibosses and bosses duel: they hold a repertoire and rotate through it. Bosses also shift at health
    phases and adapt.
  - **Skill.** It is set for a whole class of minds and tuned per character.

  The arena's three difficulty tiers are exactly three skill × aggressiveness pairs. Every species gets a mind from
  the tags it already carries. `scripts/gen-mind-table.mjs` writes the table of what each named mind and each
  species does. The Mind facet now reads these axes.
- **The arena's brain is the engine's mind.** The `ai` rule left the mobile-suit pack and joined the controllable
  engine as `worlds/controllable/mind.js`. It is organised by situation, and its difficulty tiers are built from skill
  and aggressiveness. Every arena bout steps byte-identically.
  - A world's `aiDifficulty` still tunes every mind in it.
  - A character can now tune itself on top with `rule.mind: { skill, aggressiveness, tune }`, so a boss can be
    sharper than its troops.
  - A passive mind never engages; a defensive one engages only once hurt.
  - Pages that embed the controllable engine changed only in that embedded source.
- **Maneuvers are engine verbs.** The acrobatic dodge, the tackle, loadout cycling with its switch ready time, and
  boost inertia left the mobile-suit pack too, as `worlds/controllable/maneuvers.js`. Any rule can opt into them, and
  a mind can carry a loadout without the pack. Nothing in `lib/graph/mobile-suit/` is tracked or published any more.
- **Guards and prey.** `rule.mind.motivation` shapes a mind outside the arena:
  - **A guard** engages only intruders within `guardRadius` of its post (where it was placed, or `rule.post`). It
    walks back to the post once they leave.
  - **Prey** turns and runs from a threat inside `fearRadius` and never fights.

  Every species' mind runs on the engine's rule, so prey animals flee with no authoring.
- **A commander can drive a mind.** The arena's live commander joined the engine as
  `worlds/controllable/commander.js`. Every few seconds it reads a digest of the fight and sets the mind's posture
  (rush, skirmish, siege or kite), its boost, melee and dodge, and which gun it leads with, while the mind keeps its
  reflexes.
  - A body opts in with `rule.commanded: true`. The world's `commander: { port, period, url, hook }` picks who
    commands: the built-in reference commander, a page hook (`__mojCommander` by default) or an HTTP endpoint, so
    any model can play.
  - A page with no commanded body is byte-identical.
  - The arena's dodge, tackle and boost behaviour tests now live beside the engine's maneuvers.
- **Animals live in packs and herds.** Every species has a social structure: pack, herd, flock, school or solitary
  (`lib/graph/mind/social.js`). `faunaGroup(species, id)` gives its group.
  - **Packs** (wolves, lions, raptors) fan out, ring their prey and bite two at a time.
  - **Herds, flocks and schools** graze as before, but stray no farther than a few body lengths from the leader. When
    any member is frightened the whole group runs, each animal on its own bearing, until all are clear of the threat.
- **Groups: N minds as one.** Minds that share `rule.mind.group` act together (`worlds/controllable/group.js`):
  - **Shared focus, spacing and sight.** They share a target and keep a spacing between members, and one member's
    sighting is the whole group's.
  - **Traversal patterns** give every member a slot:
    - travelling: column, line and wedge;
    - closing in: fan-out, encircle, pincer and close;
    - breaking: scatter.
  - **Plans** chain patterns on triggers: distance to the target, time, or how many members have arrived. Named plans
    are `pack-hunt`, `squad` and `herd`.
  - **Attack tokens** let only K members press in at once while the rest hold their slots.

  A group with no target travels in formation behind its leader. Worlds without groups are unchanged.
- **Predators hunt.** Every predator species' mind now carries a natural weapon: a bite whose reach and damage scale
  with the animal's size, which staggers without knocking down. A predator hunts any body not of its own kind, so a
  pack never bites itself. Prey flee the nearest threat, which is the player or any hunting mind, so deer run from
  wolves with no player near.
- **Idle minds move.** Motivations that used to stand still now have something to do:
  - **Wander** roams near home, pausing between legs. Territorial minds idle the same way.
  - **Forage** walks to bodies tagged as food and grazes there, or drifts and grazes when there is none.
  - **Escort** keeps to its ward (`rule.escort`, else the pilot) and fights only what comes near the ward.
  - **Territorial** warns an intruder inside its territory before it attacks, and leaves alone what stays outside.

  The walks are seeded by the body's id, so a world plays the same way every run.
- **Minds see, and remember.** `rule.mind.perception: 'sight'` limits a mind to what it can see: in range, in its
  facing cone, with a clear line past the walls. Out of sight it forgets. `'memory'` adds a last-seen record: it walks
  to where it last saw the target, searches there, and gives up after a while (a guard goes back to its post). Minds
  without a perception setting are unchanged.
- **Minds find their way round walls.** With `rule.mind.pathing: 'navmesh'` a mind with no line to its target, or to
  its post, walks a path round what is in the way instead of pressing against it, and holds its fire until it can
  see. The path comes from `worlds/controllable/nav.js`: a walk grid baked from the world's colliders for the body's
  size, rebuilt when they change, searched with A* and pulled tight to its corners. One floor at the body's height;
  space and stairs are not covered.
- **Bosses change as they lose health, and adapt.** A boss (`rule.mind.rank: 'boss'`) crosses health phases: under
  two thirds it turns one step more aggressive, under a third relentless, and it closes to the blade when it holds one.
  Each crossing holds a short planted, invincible beat so the change reads, and a heal never undoes one.
  `rule.mind.phases: [{ below, aggressiveness, skill, tune, rule, shift }]` authors them for any mind.
  - A boss also adapts: it books the damage it took and dealt to the mode it was fighting in, melee or ranged, and
    every few seconds it benches the mode that lost the trade for the next window. A miniboss adapts when asked
    (`adapt: true`).
  - Minds without a rank or phases are unchanged, and every arena bout steps byte-identically.
- **First person was already there.** A level with no hero plays in first person, so the registry now records it as
  partial (no named mode, no pitch, no body hiding) instead of absent.
- **Time is progression, not text.** The Time facet now reads as three layers:
  - **Chapters:** the same world at a later point. `passage` says how the world aged in between: day and night,
    seasons, growth, aftermath or eras.
  - **Advance:** what moves play on (cues, steps, quests).
  - **Shots:** the directed camera that presents a turn (in-world, staged, or a face-to-face banter screen), with
    `framing` read from the floormap's shot table.

  Mojulo supplies the speaker, the text box, the advance and the camera. The lines are a slot it never writes.
  Playscape's cues, menus and cast and the motion comic already cover most of Time. What remains is sized as three
  packages (chapter overlays, quests, the 3D shot), plus passage values of their own; only day and night, and eras,
  are absent. Gated progression is built: a cue's `emit`, mapped by the level's `game.on` to a `setFlag`, opens a flag
  gate. Time values are marked as lost on a Godot export, which carries only linear progression. A
  story-adventure probe joins the fixtures.
- **A value builds what it needs.** A registry value may name the values it `requires`. The sweep credits a value,
  a facet or a package with everything its closure builds, and prices a package at the effort of every package in
  that closure (`cost`, `needs`). A quest needs a character who talks; a passage needs chapters. An unknown
  requirement throws.
- **A fair roll, and sweeps near the probes.** By default every facet gets about the same number of settings in a
  rolled cube, whatever its size, so a facet no longer leads the map by having more settings (`--roll flat` keeps
  the old draw). `--around <fixture>|probes` nudges real game types one or two settings at a time instead of rolling
  blind.
- **The progression check.** `checkProgression` (`lib/graph/game/progression-check.js`) reads a game's level gates
  and each level's contract, and names every level a player could never open: a gate on a missing level, on itself,
  on a cycle, or on a flag no reachable level may set. A flag gate counts as set when a reachable level's `game.on`
  maps a bus event to that flag. When a contract only permits the flag, the gate is reported as unproven. It is pure
  and advisory, and nothing calls it yet.
- **Godot marks, checked against what travels.** An unmarked value used to count as surviving a Godot export, so
  web-only values passed. Checked against the Godot kernel 0.16.0:
  - Travel: `win-when` (the bus runs it), every stat op, and the `walk`, `platform` and `follow` rules
    (`GODOT_MECHANICS`, `GODOT_RULES` in `scene/engine-portability.js`, the stats kernel's `STAT_OPS`).
  - Web only: melee and ranged combat, systems, beams, explosions, the other motion rules, and `hp-pool` and
    `defeat-all` (they wait on hits only the web's combat deals).
  - The two anchors stay makeable; the crawler's melee and the collectathon's glide are named as what Godot loses.
  - The portability check's bus and store exemptions apply to Godot only; Unity and Unreal keep their warnings.

- **Three more cameras: first person, top-down and side.** A gameworld (or a quick game) names its `camera`:
  `third-person`, `first-person`, `top-down` or `side`. Left out, nothing changes.
  - **First person** rides the hero's eye (the `eye` camera). The mouse looks up, down and around, A and D step
    aside, and the hero's body is hidden so the view is not inside its head. With no hero, the walker looks and
    pitches the same way.
  - **Top-down** is a ¾ overhead camera (`overhead`) with north up the screen, 60° below the horizon and never
    straight down. W walks up the screen whichever way the hero faces; the hero turns to face where it runs
    (`platform` `move: 'world'`). It needs a hero to watch, and says so.
  - **Side** is a side-scroller on the trail's own line (`side`, `platform` `move: 'lane'`): A and D run along it, and
    the hero is held on the line round every bend while the camera swings with it, square on. The goal's pickups move
    onto the line. A climb has no line to run, so a side game is trails only, and it says so.
  - Each piece is opt-in on its own key, so existing worlds play exactly as before: the controllable trace pins hold.
  - The cosmos marks `space.camera` first-person, top-down and side as built. Top-down and side are marked lost on a
    Godot export, because Godot has no camera modes yet.

- **Levels that join both ways: an interconnected world.** A gameworld with `topology: 'interconnected'` plays as a
  map, not a list.
  - Every link between its levels runs both ways, and so do the stages inside a level.
  - A level is left by one of its exits: the trail's end, a side pocket, or the way back behind the spawn. The game
    travels straight to the level that exit leads to, arriving at the matching end.
  - A link can be locked by a key, an item laid as a pickup in another level and carried in the bag, so a door found
    early is opened by going back.
  - Underneath:
    - a level exit names itself (`reach-exit` `exit`, `on` `{ end, exit }`, the envelope's `exit`);
    - a level lists `exits` and their gates;
    - a gate can be `{ has: <item> }`;
    - the shell travels and arrives (`arrive`).
  - A list game, and a gameworld without the setting, are unchanged.
- **Powers that open the way: a hero's power can be a key.** In a map world, a link's `key` can name one of the hero's
  powers. The power lies in another level; picking it up opens the door and gives the hero the move.
  - A power can name its move: `double-jump`, `glide` or `high-jump`. The move works from the moment it is picked up,
    and in every level after.
  - The platform rule gains `airJumps` (jumps in the air, reset on landing) and `glideFall` (a held jump slows the
    fall). Without them it moves as before.
  - Underneath: a level's `game.powers` names the slice, the hero and each power's rule change; the game applies the
    ones held at start and the one picked up.
  - Item keys, and worlds without power keys, are unchanged.
  - Godot still plays a list from its menu, so the cosmos marks the value lost on a Godot export.

### Scene layer: a shot that takes the camera, and two characters talking

- **A directing camera.** A camera rule `shot` frames named subjects by a word (`wide`, `low`, `profile`, `corner`,
  `overhead`, `two`, `close`) and can hold, push in, orbit or track. A scene takes the camera from the player and
  hands it back with an ease.
- **`play.scenes`.** A scene starts on a happening or a bus event, as a cue does, and plays its beats in order: a
  shot, the cast's walks and other cue effects, a wait, a line in the text box, or a banter. While it plays, the
  player's input is held and letterbox bars show. A click or key advances a line; holding it, or Esc, skips to the
  scene's end state.
- **Banter.** Two characters talk: the camera cuts to whoever speaks, the box names them and types the line on.
  The words are a slot: without `say`, a line shows as a placeholder (`[Mayor: greeting]`).
- **Conditions and flags.** A scene's `if` says when it may play: a flag set or not, a chapter turned, a value
  crossing a line. Its `sets` writes flags as it ends. With `play.carry`, flags travel between levels in the game
  store as chapters do, so a later level's scenes can depend on an earlier one.
- **A shot can frame a place** (a spot), not only a character.
- **In design_game.** A gameworld level takes `scenes`. Its places (`start`, `exit`, its pockets and landmarks) are
  ready to frame and walk to, and a world whose scenes use flags gets a `story` slice that every level carries.
- A world without scenes is byte-identical.

### Story cascade: a story written first, bound to whatever world it meets

- **The cast.** A gameworld's character book takes `cast`: the other people (a mayor, a guard), each with looks and
  motion like the hero's, styled by the same direction. design_game makes each one, after the hero.
- **`story`.** A gameworld can carry its story apart from its levels. Each moment names who is in it, where it
  happens (a level, a stage, a kind of place) and when, with conditions and the flags it sets. When the world is
  built, each moment binds to the level and place it names, its people are placed there, and it plays as a scene.
- **Reshape freely.** The story names the world, never its coordinates, so a world can change without breaking it. A
  moment that can no longer find its place is reported as unplaced, with what is missing; the rest of the world builds.
- **Conditions on the store.** A scene's `if` can also ask for an item held (`has`) or a level completed (`done`).
- **In the bibles.** The cast has its page in the character bible, and the story its page in the world bible, each with
  a stamp to approve before it is built.
- A world without cast or story is byte-identical, and its levels are not remade.

### Chapters: the same world at a later point

- **`play.chapters`.** Each chapter is a difference against the base world (spawn, vanish, set, weather, or any cue
  effect) that a happening turns, or that turns right after another chapter (`{ after }`). A menu can present the
  turn. A chapter turns once. It lowers to ordinary cues and two bus counters, so the runtime gains nothing new, and
  the UI board shows chapters as cue rows.
- **Carried between levels.** With `play.carry: '<flags slice>'`, a turn writes the store flag `chapter:<id>` through
  the level contract (`game.on`), and a game can gate a level on it. A later level that holds the flag starts with
  that world applied. Nothing is presented again, and meeting the same happening again turns nothing.
- **The play drawer teaches it.** There is a `ui-chapters` card and a line in the play guide. The lines of dialogue
  are a slot: mojulo supplies the speaker, the box and the turn, never the words.
- A world without `chapters` is byte-identical.

### Godot plays the bus: behaviour travels as data, one reducer on both sides

- **`kernel/bus.gd`.** The Godot kernel now holds a port of the web's event-bus reducer: reactions, watches,
  sequences, timers, vars and zone facts. Every behaviour mojulo lowers (cues, chapters, menu picks, mechanics) is a
  fragment of that bus, so it can travel to Godot as data rather than one feature at a time.
- **Levels run it (kernel 0.8.0).** A world with behaviour exports `bus.json` beside its score: the bus fragment,
  versioned `bus/1`, in recipe units. `level.gd` runs it every frame:
  - Facts in: the walker's zones and the interact key at a usable place (E, with the place's prompt).
  - Effects out: warps move the walker, and the score's banners, toasts, readouts and legends paint as text.
  - Every event is a `bus_event` signal a project's own scripts can connect to.

  A chapter town turns its chapters at the gate in a headless Godot. A world without behaviour exports exactly as
  before.
- **The store travels (kernel 0.9.0).** `kernel/store.gd` ports the web's game store, held equal by the same
  conformance corpus (error messages compared word for word).
  - Each game level ships its contract (`levels/<ref>/contract.json`). Its `on` maps the level's bus events to typed
    store events or ends the level, and the level finishes with one outcome envelope that `Game` applies atomically.
  - Beating a level records it in the progression slice. Flag and completion gates open the level list.
  - A level starts with the slices it consumes, so a chapter turned earlier is applied as the next level opens.
  - The store saves as the web's save does.

  A two-level game plays through in a headless Godot: the town's chapter opens the walls, and the walls start with the
  town's world. Games without a store schema keep completion-only progress, as before.
- **Menus in Godot (kernel 0.10.0).** The score carries the play's menus, and `level.gd` draws the open one (the last
  whose `ui-menu-<id>` var is 1, as on the web) as a plain panel with its `{var}` words filled from the bus.
  - Keys: arrows or W / S move the focus. Enter, Space or E accept: a read turns its pages, a pick sends
    `menu-pick:<menu>:<n>`, anything else closes. Esc closes.
  - The walker waits while a menu is up.
  - A talk opened by a chapter's turn picks its second choice in a headless Godot, and that choice's effect reaches
    the bus.
- **Characters in Godot (kernel 0.11.0).** `kernel/cast.gd` ports the web's character world (`castOps`, `castFacts`,
  the route walk).
  - `bus.json` carries the cast rows: where each character stands, its heading, asleep or not, its hp and pace.
  - The ops: spawn, vanish, kill, hurt, heal, walk, stop, status, lift, transfigure and shake.
  - The facts sent back: down, gone, spawned, arrive and stuck. A status that runs out reports `faded`.
  - Each character's node follows its row: shown or not, where it stands, its heading, lying down when felled, its
    statuses worn as looks.
  - A walk has no collider push-out or ground snap in Godot. Puffs, beams and transits stay on the web.
  - In a headless Godot, a warning wakes a soldier at the gate; he walks to his post, is felled there, and the bus
    hears each step. The merchant is sent away.
- **A cue forces the sky in Godot (kernel 0.12.0).** The score's weather row now lists the states a cue can force.
  `level.gd` hands the newest `weather-force:<cue>` still set to `weather.gd`, which eases fog, colour and light to it
  over the cue's blend, holds it, and eases back to the schedule when no force is left: the web page's rule.
- **A pack a developer can build on (kernel 0.13.0).**
  - The level emits named signals: `chapter_turned(id, carried)`, `cue_fired`, `menu_opened`, `menu_picked`,
    `line_requested(who, text, menu, i)` (a talk's line, where a dialogue tool plugs in), `character_event` and
    `bus_event`.
  - `game/` is the developer's: a re-mint keeps it whole, and writes its seed `game/hooks.gd` only when it is missing.
    The kernel attaches `game/hooks.gd` to every level.
  - Both pack READMEs say which part of the folder is theirs.
- **Parts a cue shows or hides, and phases, on the page.** A cue's `show`, `hide`, `state` and `phase` set bus vars
  that nothing drew. Now a part keeps its `id` on its HUD row, and its `when` rides as phase indices; the page hides a
  row while its part is hidden or out of phase, and draws its state (disabled, alert, focus, active). A hidden banner
  or toast does not fire. A HUD without ids or phases emits the same bytes as before.
- **The HUD in Godot (kernel 0.14.0).** `kernel/hud.gd` draws the page's widgets: a column per slot, readouts as text,
  counters, bars or clocks, banners with their `{var}` words, toasts that stack and rise, legends that fade. It gates
  parts and phases as the page does. The score's new `hudStyle` (only when the world declares a look) carries the
  guide's colours, its font and the register's frame and plate; motion, sound, cursor and light stay the web's.
  - Menus sit centred on the guide's panel, a row per choice. Keys, a gamepad (d-pad or stick, A, B) and the
    pointer drive them; the mouse is freed while one is open.
  - The reach prompt sits centred on the same plate.
  - In a headless Godot, a bell rung at a place hides its hint, restates the purse to alert, fills a banner from a
    var and raises the gold's change as a toast. The mayor's talk is picked by keys, a pad and a click alike.
- **Stats in Godot (kernel 0.15.0).** `kernel/stats.gd` ports the web's stats kernel: levels on xp, resources,
  guarded purchases (tech nodes with ranks and subtrees, offers, epochs), derived stats on every curve, buffs, and
  formulas on the cast's ops. It runs inside the bus's watch fixpoint, as on the web, and `bus.json` carries its
  config. The conformance corpus gains a stats play and seeded runs over it, equal frame by frame (a planted curve bug
  is caught). Bound bodies reach the cast and the walker's pace. In a headless Godot, praying at a shrine levels the
  hero, fires the level-up cue, and the HUD shows the gold and the new level.
- **An exported minted game plays (kernel 0.16.0).** Exporting a minted two-level chapter town found three gaps,
  now closed:
  - A primitive body (a box or a sphere) baked no geometry, so the kernel drew a gold placeholder. The score now
    carries its shape, size and colour, and the kernel builds it, shaded, with a soft sun when the export has no light.
  - The portability check said a bus level's win and a store's flag gate do not travel. Both do now; the flags are
    gone for such games.
  - The export passes the machine gate, and a headless run plays it through: the warning, the mayor's menu, the
    town's end, the saved flags, the walls unlocked and starting with the carried chapter.
- **The bus contract.** `scene/bus-abi.js` names the facts a world's behaviour takes and the effects it gives, each
  with a status per kernel. Because a page effect is mostly a bus var (an open menu is `ui-menu-<id>`), the next
  adapters are var watchers. The score's ledger lists what the Godot kernel performs, does in part, and does not. The
  portability check names the rows it does not perform yet (menus, cast ops, forced weather, stats) instead of
  calling every runtime behaviour lost. The pack README gains a Behaviour section.
- **Proven equal, frame by frame.** `scripts/godot-bus-conformance.mjs` runs a corpus through both reducers and
  compares the canonical state string (`hashState`) after every frame. The corpus has hand scenarios, real
  chapters and mechanics lowered as a world lowers them, and seeded scenarios over every predicate and verb. A
  vitest gate runs it when `MOJULO_GODOT` is set. Planted bugs are caught.
- **Exact numbers.** Godot's JSON parser rounds some decimals to a neighbouring double. A 60 Hz step, for one,
  arrives one unit off, enough to flip a timer. `kernel/json_exact.gd` reads each number back to the double the web
  held, using the shortest-form spelling both engines print. The bus keeps JS's `undefined` apart from `null`, so a
  var set from a missing field compares the same on both sides.

### Godot plays the fight: combat, the systems, beams and explosions travel

- **The sweep measures what Godot would gain.** `sweep()` returns `unlock.godot`: for each value a Godot export
  loses, and for each setting as a group, how many of the rolled cubes would survive the export if it travelled. A
  ladder adds a facet's settings one at a time, largest gain first. `cosmos-sweep.mjs` prints both.
- **A beam striking is named as lost on Godot.** `struck` has its own bus row. Before, it counted as one of the cast
  facts the Godot kernel performs, so a level whose cue waits on a beam reported as covered and never fired. The
  ledger and the portability flags now name `fact:struck`.
- **Hits reach the bus.** Every hit a character takes (a blade, a round, a splash, a tackle) is a `hit:<id>` fact,
  carrying who dealt it. That is the event `hp-pool` counts, so a level's health pools and `defeat-all` now run on
  the hits its combat deals; before, nothing in the runtime produced them. A page reads its characters' facts when a
  reaction listens for a hit, as it already did when a cue reaches the cast.
- **Melee's contact test stands on its own.** `meleeContacts` says who a swing meets this step (an ally, a clash, a
  hit) before anything is done to them; `stepMelee` applies it in the same order, so play is unchanged. An engine
  kernel holds its own adjudication equal to it.
- **The fight travels to Godot (kernel 0.17.0).** A platform hero's fight rides `bus.json` as `combat`: its five
  swings, its weapon, the world's cover and every hittable body. `kernel/combat.gd` runs it over the cast:
  - the strike: the fire press, the cut the held keys pick, the cooldown and the two-hit combo;
  - the trigger: semi, automatic, burst, charge, magazine and reload, heat; the ray against eggs and spheres, cover,
    frontal shields; lobbed rounds swept along their flight, the proximity fuze and the splash;
  - what a hit does: a reacting body staggers, topples, lies flat, gets up untouchable (with its wake guard), and a
    killing blow floors it; its fall blasts a stagger around it.

  Each hit is a `hit:<id>` fact, so `hp-pool` and `defeat-all` travel too. A level shows a stagger and a topple as
  a lean and draws the rounds in flight. It is held equal to the web frame by frame
  (`scripts/godot-combat-conformance.mjs`, its Godot leg when `MOJULO_GODOT` is set): every number is equal but a
  round's flight, which is held to 1e-9 because the two engines' sine and cosine can differ in the last bit. What
  stays on the web: the combo's stun, scaling and juggle, the clash, tackle and shove-down set pieces, the deferred
  wreck finisher, a loadout's other slots and every AI's attack. The portability flags say so, and so does the Godot
  pack's own ledger, which now lists `hp-pool` and `defeat-all` as running on the bus (`bus_mechanics`) instead of
  as outside the kernel's vocabulary.
- **A game's systems travel to Godot (kernel 0.18.0).** Resource, stamina, unlock, transform and equip already
  lowered to stats, cues, HUD rows and a status page, which the Godot kernel runs; what it lacked was their keys.
  `bus.json` now carries `events.inputs` bound to a key or a click, and `level.gd` feeds them to the bus as the page
  does (a key by the character it types, as `KeyboardEvent.key` names it): a power fires on its number, the status
  page opens on `i`. A pick or a shot on what the pointer is over stays the page's; the bus contract names it
  (`fact:aim`).
- **Beams and explosions travel to Godot.** A cue's beam and blast are moments on the cast's clock in
  `kernel/cast.gd`, as on the web:
  - a beam leaves the hand (or rises over the head for a charge) toward a character or a place, lands after its
    distance by the web's land rule, sets off its impact and shake there, and its target hears `struck`;
  - an explosion puffs at a place or a character's feet; a chain scatters its blasts by the web's own dice and
    staggers them, with a shake.

  Held equal to the web by the combat corpus (every kind of each). `level.gd` draws them simpler than the page: a
  bolt that grows to where it lands, a glowing ball that swells and fades, in the spec's colour. The cast rows carry
  where each character stands below its position (`foot`). `fact:struck` is performed in Godot.
- **Numbers read and print exactly in Godot.** `kernel/json_exact.gd` reads a small number's late digits (Godot's
  own reader dropped them, so about one double in two hundred arrived as its neighbour) and `js_number` prints a
  double as JS does: the fewest digits, the even one on a tie, the exponent forms and the subnormals included. The
  bus prints with it, so a var a HUD shows and the state the conformance corpus compares read the same on both sides.

### Destruction: every blow breaks things its own way

- **The cut.** `playscape/destruct/cuts.js` names how a blow breaks what it breaks: a pattern (cleave's slice, grid or
  voronoi, or dismantle's severed joints) and a style (blade, laser, anime, impact), as presets (slash, cleave, chip,
  shatter, blast, burn, dice, sever). A blow's cut is the thing's own (glass shatters whatever hits it), else the
  blow's, else its element's (fire burns, ice shatters, wind slashes, shock cleaves, dusty severs), else its source's
  (a swing slashes, a round chips, a burst blasts, a beam by its kind). Tables, not code.
- **What breaks is a game's convention, by degree.** Nothing breaks by default. A level says how much does with
  `destruction`: `none`, `objects` (the action-game default: crates, barrels, amphorae, pots, glass, planks, bones,
  a lid; buildings and fixtures hold), `cover` (furniture, doors, boulders and coffins too) or `world` (walls,
  pilasters and set pieces as well); a thing's own `breakable` wins over it. A thing's class is the name it already
  has. Each breakable solid thing becomes a block the runtime breaks (a swing in reach, a round that stops on it, a
  burst over it), its faces their own render group, and the World page hides it when it breaks. Today the gothic and
  catacomb kits' props carry what this needs; a thing not yet named on its faces (a pooled rock) or blocking nothing
  (planks, bones) stays as it is. Absent, a page is byte-identical. A game says it once, in its gameworld's
  `mechanics.destruction`, and `design_game` copies it onto every level it makes; the gameworld's own stages place no
  named things yet, so for now nothing on them breaks. An engine export holds what breaks whole: each breakable
  travels back as a solid collider, and the ledger says so (`breakables_held`).
- **A broken thing comes apart.** Each breakable is cut ahead of time, once for each cut it can take (a swing slashes
  it in two, a round or a fall chips it, a burst blasts it; its own `cut` wins), and when it breaks on the World page
  a flash and a ring cover the swap to those pieces. They part the cut's way, carry the thing's own texture with a
  darker inside, fall, tumble, bounce off the walls, settle on the floor it stood on, then sink away. The box is what is
  cut, so a barrel breaks as a box would; a severing cut plays the chip for now.

### Structure rails: the structure book

- A house (`floorplan` row) is getting **the structure book**, one tabbed HTML view of the whole building in the game
  designer's idiom. It has a tab per component concern: Cover, Site, Massing, Plan, Rooms, Elements, Objects,
  Structure, Services, Quantities, Checks, Walk and Open.
  - Elements (walls, slabs, openings, members) and objects (furniture, fixtures) carry one tag. The tag links a
    sheet, its schedule, its room card and the live walk.
  - Tabs appear as the building deepens, through four outcomes: Concept, Layout, Drawings and Build (the frame,
    trades, takeoff, checks and IFC).
  - The path stays short: `mint_building`, `update_sketch`, `export_model` (adding `sheets` and `schedules`) and the
    existing Workflows.
- Built in `lib/graph/structure/`, served at `/api/sketches/<ref>/bible` and exported by `export_model`:
  - **The read model** (`readStructure`) reads the building from the recipe as tagged data. Framed, it also gives
    the frame's members, marks and fields, the wiring and the rainwater. The worlds are byte-identical.
  - **The drawing set** (`drawingSet`) is in NCS conventions and discipline order, and each sheet appears only when
    the recipe has what it draws:
    - C-101 site;
    - S-101… foundation, storey and roof framing plans with framing keys;
    - A-10x plans, A-20x elevations, A-301 sections and A-60x schedules;
    - P-101 roof drainage;
    - E-10x electrical plans with circuit schedules.
- **Stairs:** `stairs: true` on an authored `levels[]` stack now joins every level from the ground: up to each floor
  and down to each basement. Before, it always ran one flight down to a basement, even when there was none, so a
  ground-and-second house (every multi-storey house the drawer makes) had no way up.
  - A ground with its basement keeps the flight it had.
  - The book flags a level no stair reaches and names the field that adds one.
  - Sections draw the flights, and framing plans mark the stair opening.
- **Livability around the stair:**
  - **`design.clearance`** (`true` for the passage, feet, or `false`) keeps furniture off the flight, its landing,
    and the well upstairs.
  - **`design.waive`** accepts a finding as built.
  - **`{ repair: true, clearance: true }`** is a livability pass: walkways clear the stair, and nothing crowds it.
  - **The structure book** walks every stack and flags furniture within the clearance of a stair in its own room.
    Its Plan tab shows the rules in force and how to override them, and a waived finding stays visible as waived.
  - **Existing rows:** a recipe without `clearance` builds exactly as before.
- **New houses are minted by laws** (`structure/infer.js`), on both doors. Each law fills only a field the recipe leaves
  out, writes an ordinary value, and gives its reason in `notes.inferred`, which the book's Cover lists. An explicit
  value, even `false`, is kept. The laws only run at mint, so stored rows keep their bytes.
  - A house without `windows` gets `windows: true`. A recipe laid out by hand had no windows, so every bedroom failed
    egress (the drawer already gave windows to the houses it lays out).
  - A `levels[]` stack gets `stairs: true`.
  - A stack gets `design: { repair: true, clearance: true }`, and a given `design` without `clearance` gets
    `clearance: true`.
  - A framed single floor becomes a stack of one (`levels: [{ index: 0 }]`), since framing needs a stack.
  - A roof style that names a form, such as `gable`, becomes the bungalow style with that form. Before, it silently
    drew a hip roof.
- **`next` is by outcome.** `mint_building`, `create_sketch` and `update_sketch` answer a house with what it has not
  reached, from the recipe as stored. Concerns are grouped into four outcomes: Concept, Layout, Drawings and Build.
  Each concern names the field that adds it, or the export that takes the house out, and the outcome card that
  teaches it. Before, it named a ladder of rungs and offered "add roof" to a house that had one.
  - **New cards:** `house-concept`, `house-livability`, `house-drawings` and `house-build`. Each has the questions to
    ask from zero, the laws, and the fields that open each of the book's tabs.
  - **One table** (`structure/open.js`) feeds both `next` and the book's Open tab. The tab now groups its cards by
    outcome and names each card; exports are steps, not open tabs, so only `next` lists them.
  - **The `design` readout** carries the stair clearance beside the walkway, with the patch that keeps it or how to
    waive it. A crowded stair is a `livability` step under Layout.
  - **The roof step** names a style (`roof: 'bungalow'`, `form: 'gable'`). Before, the Open tab offered
    `roof: 'gable'`, which is a form, not a style.
  - **A framed house with a roof and no covering** gets a Build step for `roof.covering`.
- **One path for buildings.** Building asks now route to `mint_building` and nothing else.
  - **The `house` routing card** is the one routing prose for buildings. It leads with the structure book and the four
    outcome cards. The studio's HOUSE line, the building form, the tool line and the `mint_building` description
    point to it. Two `routing-eval` rows pin drawings and a framing takeoff asked for without the word "house".
  - **The picture recipes no longer alias buildings.** `house`, `home`, `building`, `buildingHouse`, `architecture`
    and `interior` answer with `mint_building` and name the two illustration families by their own names.
  - **The blockout lingo** routes a house massing to `mint_building`.
  - **The polygonizer's blueprint style** says it never draws a building's sheets.
  - **Edifice is out of the building path** (it has no slabs, windows, stairs or rooms to draw). Its card is for an
    institutional block for a world.
  - **Removed, with no callers:** the orphaned `floorplan-office.js`, `renderFloorplanPlanSvg`,
    `renderHouseElevationSvg` and `renderSitePlanSvg`. The A-, C- and S-sheets draw what they drew.
  - **The house cards** name `mint_building` as the door, with `create_sketch` still accepting `kind: 'floorplan'`.
    `floor-plan` indexes the outcome cards ahead of the manuals.
- **Fixes from cold-agent runs.** Five fresh agents each worked a brief: one per outcome, plus a showroom with two
  custom pieces placed by `ref`. Every brief was met at least in large part. What they tripped on:
  - **Stacks named by role** (`levels: [{ role: 'ground' }, { role: 'second' }]`) now get the stair and the
    livability pass at mint. They were counted as one level.
  - **The open core is named for what shares it** (`living / kitchen / dining`). Agents read "lounge" as a missing
    kitchen.
  - **A tier that builds fewer bedrooms than it asks** becomes a Layout step. It names `tier.study: false` when an
    upstairs study took the slot, else a larger footprint.
  - **The stair schedule shows the width built,** with its risers and going. The card says `design.stair.width` is
    the rule checked against and `stairs[].width` builds a wider flight.
  - **The Walk tab no longer offers a game-level handoff** that `create_game` refuses for a house. It offers the
    world's walk and fly modes and a `forge_motion` film.
  - **`get_sketch_vocab` names an argument it does not take** and points at `{ id }`, instead of listing every card.
  - **Card corrections:**
    - the bathroom glyph `W` is in the glyph table;
    - `roof.pitch` is documented;
    - the furnishing defaults no longer contradict the mint's (`windows: true`, `furnishing: 'composed'`,
      `furnish` off);
    - "walk at `/world`" is now the Walk tab and its walk button.
- **A room and a house are different things,** and every surface says which one it is.
  - **A room** is one space, not counting halls: a showroom, a set. Its book is a Room book. It is furnished, walked
    and drawn, and graded as a room, with no adjacency advice. It never gets a livability verdict, and it is
    offered only furnishing, windows and drawings, never site, roof, stair or frame steps.
  - **A house is livable only with a kitchen, a bathroom and a bedroom.** The kitchen can be its own room or the
    open core's. Without one, the Cover says "a house, not yet a home", the Checks tab advises "not livable as a
    home", and `next` names a `dwelling` step.
  - **The readout carries `subject: 'room' | 'house'`,** and `notAHome` when a house lacks one of the three.
  - **A house that is not a home is never ok.** The home check cannot be waived. `design.ok` is false for such a
    house whatever its walkways, and the Cover shows "a home: no" beside the plan grade, which grades rooms, not the
    home.

### Fitted furnishings: true-size fixtures and furniture in a house

- **A house can be furnished at true size** with `furnishing: 'fitted'`. Pieces are built in mm at their catalogue
  size and placed by the rules about the room: a wet wall, the clearances an inspector wants, nothing in a door's
  way. They are never stretched to a share of the room. Without it, a house renders as before, byte for byte. The
  bathroom comes first; the kitchen and the rest of the furniture follow.
- **The fitted bathroom** (`furnishings/fixtures.js`, `furnishings/bathroom.js`):
  - Fixtures: a water closet (pan, seat, cistern, flush), a basin on a vanity (a double one in a wide room), a bathtub
    with its filler on the wet wall, a shower beside the tub in a big room, a mirror over each basin, a towel rail
    and a bath mat.
  - Layouts: the tub along a side wall with the WC and vanity down the wet wall, or the tub across the wet wall of a
    narrow room, or a WC and basin where no tub fits.
  - Each fixture is a roster row (`rooms[].items: [{ type: 'bathtub' }]` places one anywhere).
- **The book reads them:**
  - The Objects tab and the schedules carry a plumbing fixture schedule, marked WC, LAV, TUB, SHR, MIR and TR, at
    catalogue size.
  - A livability check, `fixture-clearance`, checks each clearance (21 in before the WC and basin, 15 in each side of
    the WC, room to step into the tub, 24 in before the shower) and says when a bathroom holds no basin or no tub or
    shower.

### Solid powerscale: solids routed by what they are for

- **`mint_solid` names its doors by purpose.** The description groups the kinds as characters, objects from words
  (equipment, furniture), hard-edged or fitted parts (scad and its `mj_*` library, with `fabricate_solid` for the
  standard parts), and measured or organic objects (workbench, code). It used to leave scad, equipment and furniture
  unnamed, and its tool line listed only some of the kinds.
- **Fitted parts stay home.** The workbench and scad routing cards no longer send threaded, toleranced or geared
  parts to a B-rep handoff: the `scad` kind's `mj_*` library prints them. Only STEP, GD&T or a constraint solver
  still goes through `translate_modeler_lingo({ lingo: 'precision cad' })`. The workbench card names all of its
  primitives, not "rotational primitives only".
- **Furniture has a routing card.** A sofa, chair, table or piece of casework by style lands on `mint_solid` kind
  `furniture`, not on the house or the workbench.
- **The routing eval checks the kind.** `mint_solid` is the entry for every solid, so new card rows pin a fitted part
  to the scad card, a measured form to the workbench card and a styled piece to the furniture card.
- **The size of the ask caps the ladder.** A solid's `spec.ask` names how serious the ask is: `look` (it reads
  right), `fit` (it fits a thing: true size and the print check), `function` (standard parts, strength, a bill of
  materials) or `engineered` (motion, materials, printed walls and coupons). The agent judges it; nothing infers it.
  It is stored on the recipe, patched at `/ask` to climb, and caps `next` at its rung, so a trinket is not walked
  toward a tensile coupon (`lib/mcp/tools/solid-next.js`). Without it, a scad part's `next` is unchanged byte for byte.
- **The workbench has a `next`.** A workbench, code, equipment or furniture row returns the open steps once it is
  meant to be made (frames, a fabricate plan, a strength spec, or mm units off a `build`), or whenever it carries an
  `ask`: the print check, fabricate and the bill for frames, the strength rail, 3MF. A plain look returns none, as before.
- **Parts by name, from the recipe book.** `mint_solid({ kind: 'scad', spec: { part: 'wall-hook' } })` is a finished,
  printable hook; `params` fit it (`{ reach: 60, screw: 'M5' }`). A part is a new recipe-book entry type, `part`: a
  pure `builder.js` that writes an OpenSCAD program over the `mj_*` library from named params, each with a default
  and a range. The program is stamped on the row beside `part` and `params` and rewritten when `/params` change; a
  hand edit under `/source` detaches the row into a plain scad part. Three to start: `wall-hook` (countersunk ISO
  screws, filleted inside), `phone-stand` (a groove sized to the device in its case, a cable slot) and `lidded-box`
  (sized by the inside, the lid's lip at a printed fit). The book validator checks the lane (`npm run test:book`),
  and each part mints closed through OpenSCAD in `scad-part.test.js`. Book 0.9.0.
- **`measure_solid` reads the ask.** On a row with an `ask`, the readings left unnamed follow it: a look skips the
  Manifold volume union (the slow leg), and an engineered scad part with a `mechanism` runs its motion and collision
  sweep. The reading carries `ask: { level, ran, wants }`. `wants` is the ladder's `add` steps, what the recipe still
  lacks for that ask (a strength spec for a function, printed walls or a material for engineered). A reading passed
  in always wins, and a row without `ask` measures exactly as before.
- **The size a keepsake prints whole at.** Under an `ask`, `measure_solid` also returns `ask.prints_whole`:
  `{ at_mm, fine, over_bed? }`, the print size at which every feature the advisories name as under the printer's
  floor reaches it (`printsWhole` in `print-advisory.js`). The features are thin walls, tiny sections and bores, and
  the sampled walls. Detail scales as a size, never a cut: the recipe is untouched. `over_bed` says thickening the
  detail is the move, not a bigger print. Any solid row takes `ask` by an `update_sketch` patch at `/ask`, a
  character included.

## [3.1.0] - 2026-10-10

### Drawer alignment: the agent supplies the words, the server the rest

- **A 3D factory with a media studio.** Mojulo describes itself by what it makes, named by what people do with it:
  things to **Play** (games), **Print** (solids at true scale), **Read** (diagrams, illustrations, views,
  publications), **Hear** (scores, sound, voices) and **Observe** (any of them watched: turntables, flythroughs,
  recorded runs). **Workflows** (plans, sweeps, stash and cook, catalysts) orchestrate the rest. `get_substrate` holds
  the words; the initialize preamble (back inside its word budget), `forward_context`, the register-kit glossary and
  the tool index follow it. Packs carry a `ring` (solids, audio, read, worlds, games, kernel, workflows) in place of
  the studio and office wings.
- **The office wing leaves the tool surface.** Apps and their env, the runtime daemons, the contextmap, mcp-orbit,
  triggers and primitive binding are no longer listed, indexed or routed to (`RETIRED_PACKS` in `packs.js`).
  `pack_runtime` and `pack_connected_services` still dispatch and every one of their tools still answers by name,
  so a compiled plan or a skill that names one keeps working. `forward_context` has one body; `mode: 'office'` gets
  it with a line saying where the office went. The connected-service and app worked examples and routing cards are
  gone. The flat tools/list fell from 242,317 to 208,224 bytes, packs mode from 33,840 to 31,248.
- **A Characters ring.** `create_character({ as: 'hero' | 'creature' | 'animal', spec })` is its own door, listed
  first (`pack_character`, form `character`): a person by cast word, proportions, face, hair, clothes and armour; an
  invented body from a ring plan; a real species. It mints the same recipes `mint_solid` makes (kinds `layered` and
  `animal`), byte for byte (`create-character.test.js`), and `mint_solid` keeps every kind. The hero, creature,
  animal and armour routing cards enter on it, and a CHARACTER row heads the mint dispatch.
- **A stuffy, furred in Blender.** `blender-bake --fur` grows particle fur on a character's palette groups and
  leaves the eyes, mouth, nose, claws and horns smooth (`lib/graph/scene/fur-groups.js` names which), with a
  matte-sheen strand in each group's colour, a span-scaled `plush` light rig and stills from three angles under
  `outcomes/<ref>/fur/`, plus an optional turntable and `.blend`. `--fur-short Skin` gives a doll a felt face. The
  `make-stuffy` catalyst drives it: a plush body from `create_character`, then the operator's Blender MCP when one is
  connected, this script when not. The recipe never changes, and glTF cannot carry the strands, so the export, the
  game and the print keep the smooth body. Machine gate: a real headless Blender furs a minted character (skipped
  without one); the eyes gate is the operator's.
- **Workers and other MCPs stay reachable.** `pack_catalysts` now carries what a power user needs to reach past
  mojulo: catalysts landed as Skills beside the host's other MCPs, the inventory and provider-capability reads, and
  the agent-task queue (`pull_agent_task`, `submit_envelope_inference`, `cancel_agent_task`). The routing index has a
  WORKFLOW row, so a chain written once (`execute_plan`), a sweep and a catalyst are one hop from the first read.
- **The office catalysts leave the shelf.** `refresh-connected-services` and the `local-storage` technique sealed
  their work in the contextmap; `get_catalyst` on either says where they went and points at `make-stuffy` and
  `research-mcp-vendor`. `make-stuffy` is the exemplar `custom_catalyst` teaches from now, and the author's guide
  speaks of creative destinations (`dcc-like`: Blender, Houdini; `engine-like`; `image-like`; `slicer-like`) in place
  of CRMs and ticket queues. Every host adapter card loses its primitive-binding flow for a short "Reaching other
  MCPs and workers" section, and no card points at `list_env` or the contextmap any more.
- The commitment floor names states the studio has: proposed vs made, dry run vs promoted, machine gate vs eyes gate,
  advisory vs refused.
- Under the Claude plugin profile the `g-series` card no longer names the skin tools.
- The first card read of a process no longer stalls about 6 s. The animal entry cards' DOES lines came from solving every
  species' behaviors on its skeleton at catalog load. They are read from a generated table now
  (`fauna/behavior/does-table.js`, written by `node scripts/gen-fauna-does.mjs`, held equal to the live solve by
  `does-table.deep.test.js`), and a species not in it is still solved live. The cards are byte-identical. The stall
  fell on the first `get_solid_vocab`, `semantic_search` or `sketch_what_possible` of every session.
- The first `get_view_vocab` of a process no longer takes about 0.6 s. The historic entry cards' statue-slot lines came
  from planning every city at load; they are read from a generated table now (`historic/slot-table.js`, written by
  `node scripts/gen-historic-slots.mjs`, held equal to the live plan by `slot-table.deep.test.js`), and a culture not in
  it is still planned live. The cards are byte-identical. Every vocab reader's first read is now under 0.1 s.
- A world motion's GIF is a preview: 480 wide and at most 12 fps (each kept frame held so the run keeps its length),
  `shot.params.gif_width` to change the width. The MP4 still carries the full capture. A seven-second traversal's GIF
  fell from 19.5 MB to 5.1 MB. Painted scenes and cels keep their own size and timing.
- **A plan carries its own refs.** Anywhere in a manifest step's args, `{ "$step": n, "path": "/ref" }` is the value at
  that JSON Pointer in step n's result (no `path`: the whole result), so mint → export → measure is one manifest
  written once instead of a call per step with the ref copied by hand (`lib/mcp/plan-refs.js`). Compile refuses a
  reference to the same or a later step. Execution stops at a pointer that finds nothing, naming the keys that were
  there, and the execution log records the value each reference took. The manual is in `enter_plan_mode` and the plan
  pack's body; tools/list is unchanged.
- `mint_drawer` lives in `pack_stash` beside the stash it sub-groups; `pack_catalysts` no longer offers "a new drawer".
- **One line per tool.** Every listed tool has one short line and a verb (create, update, compose, observe,
  maintain, orient) in `lib/mcp/tool-lines.js`, and `get_tool_index`, each `get_creative_toolset({ form })` body and
  the pack menus are generated from it; the tool's description stays its manual. `get_tool_index` now lists every
  tool by ring (the creative tools were only in the form drawers) and ends with its body hash: 17.8 KB, so a host
  capped at 20 KB reads it whole instead of the compact card. The form bodies shrank by about two thirds, the
  drawer reads by 30% in all, and no tool-to-tool pointer was lost. The plugin build drops hidden tools by name
  instead of editing prose. A pack's menu no longer repeats the spine list, and a member homed in another pack
  is one line pointing at its manual there. `forward_context` keeps the commitment floor as one standing line
  (the table is in `get_register_kit`) and puts the per-call settings, the disclosure directive and the pulse
  last.
- **Readouts say ids, not sentences.** `design_game`'s `next` is step ids (`review`, `play`, `run`, `rerun`, `wait`,
  `advice`, …) with the parts or URL each needs; what each asks is the new `gameworld-next` card. `readout: 'changed'`
  answers only the parts whose stamp moved and the steps run. A run that makes nothing, the same recipe written again,
  or a verdict already held writes no revision. Within one MCP session, `measure_solid` of the same recipe and params
  names the reading the agent already has (`same_as`, `full: true` to measure again), and a print `export_model` names
  that measure instead of reading it out (the README beside the file keeps it whole). The vocab readers' no-id
  listings are one short row per card (`id`, `when`, and its family, entry or scope; `detail: true` for the full
  rows): 188 KB to 93 KB across the six. `sketch_stash` stops repeating each hint in its steps.
- **Variations of any recipe.** `run_experiment_sweep({ ref, path, values })` copies the stored recipe once per value
  with that value set at the JSON Pointer `path`, mints each copy through `create_sketch`'s gates as a new sketch, and
  puts the variants in one new folder; the source is unchanged. 2–12 values; it stops at the first copy its kind
  refuses and answers what it minted. The mechanics experiment (`research_ref`, `base`, `param`) is unchanged.
- **The fabricator's second call takes shapes.** `fabricate_solid({ needs, bodies: { base: 'cube([40, 40, 20]);', … } })`
  writes the source and its `parts`: each part is its body minus the cuts its needs place in it (`at`, `axis`,
  `parts`), plus its adds. The agent no longer writes the `fab_cuts` / `fab_adds` wiring; a part a need names without
  a body is refused by name. `source` works as before.
- **Stash and cook in one call.** `cook({ items, aim, report_md, … })` takes gather-shaped items instead of `slices`:
  every item is checked against the intake contract before any is stored, then a stash (titled `stash_title`, else
  the aim) is minted with the drawers the items name, the items are gathered, and that stash is cooked. The answer
  carries `gathered: { stash_ref, item_ids }`; if the cook itself fails, the error names the stash to cook again.
  `mint_stash` → `gather` → `cook({ slices })` stays for material collected over many turns.
- **One render handoff door.** `render_handoff({ medium: 'image' | 'mesh', op: 'request' | 'pull' | 'submit' | 'accept' | 'reject', … })`
  is the listed tool for the external worker loop. The ten per-op tools (`request_image_render` … `reject_mesh_render`)
  stay registered and callable by name, unlisted, so worker scripts, packets and catalysts that name them keep working.
  The flat `tools/list` payload falls from about 210.2 KB to 202.4 KB with this phase's other additions.
- **Which workers this host has.** `version({ workers: true })` lists Blender, Godot, Unity, Unreal, a slicer,
  OpenSCAD, ffmpeg and Chromium: the path found or `null`, the env var that points at each, what it runs, and what
  still happens without it. It launches nothing (a found path is a file; the script that uses it still checks it).
  The search orders now live in one place, `lib/workers/find.js`, and the export, bake and verify scripts use it;
  `blender-bake`, `bake-world-gi` and `audit-figure-mesh` now also find a `blender` on PATH, as the export scripts did.
- **The docs follow the surface.** `docs/AGENT-REFERENCE.md` and `docs/MCP-ARCHITECTURE.md` lead with ring → pack →
  tool line and the Workflows rails, drop the wing split (packs no longer declare `wing`), and mark the office
  surfaces as retired but callable by name. They also say plainly that an unlisted tool is reachable from the CLI and
  plan steps, not from the agent's own tool call. The README, the plugin README and the plugin skill's trigger
  description carry the 3.1 position (a 3D factory with a media studio).

### Gameworlds: a door for agents

The gameworld and its character book become what an agent builds a game with: a rail in front of the game tools that
takes the back-and-forth of system-making (the hero, its gear, the numbers, the HUD, the levels) and leaves every page
the creator's to change after. The older game tools stay, behind it: the rail calls them.

- **A gameworld is a sketch.** `create_sketch({ kind: 'gameworld' })` stores the recipe as written and
  `update_sketch` iterates it in place; every mint and update reads it, and the reader's teaching errors are the
  refusal. An approval is a patch on its `review`. It is read, not played: its sketch page shows its bible (the
  character bible when it has a character book, else the world bible) from `/api/sketches/<ref>/bible`, resolved
  from the recipe on every read; it has no PNG and never appears in the Arcade.
- **The rail's door and its runner.** `design_game` writes a gameworld (`world` to start or replace it, `patch` to
  edit it by part), takes the creator's verdicts (`approve`, `revise` with a note), and runs it (`run: true`): every
  step that is ready is made through the same handlers an agent would call. The hero goes through the hero door, the
  systems world through `create_sketch`, each class of gear through the equipment door, all at refs derived from the
  gameworld's own. The hero's base is pinned as the revision it was made at, and the motion branches from it. What a
  run made is recorded in the recipe (`made`) with the prints of its order and of what it left. A run with nothing
  changed makes nothing; a page that moved is remade in place, byte for byte what a fresh mint would store. What the
  creator edited by hand since is left as it is unless `force`. Gated worlds wait for verdicts; an autonomous world
  makes everything that settles in one run. Its answer is each part's stamp, which steps may start, what was made, and
  the next moves.
- **The drawer leads with the rail.** `get_game_vocab` opens on the game book's guide (`gameworld-guide`: the loop,
  page by page, and the principles: ask before deriving, the derivation is a floor and not a design, laws not presets,
  fragments not worlds) and a card per page (world, direction, looks, motion, actions, adornment, equipment, systems).
  Each card's words are generated from the tables the reader reads. Where a card needs an example it shows a contrast
  pair: two fragments answering the same question from two briefs, each with what the book derives from it, computed
  when the card is read. No test fixture appears in any card or sample, checked by a test. The store, mechanic, kit,
  glyph, sfx, hud and idiom cards follow as the machinery; the kit cards say they are what a game type compiles from,
  not a design to adopt. Its description shrank from 1,650 to 858 characters.
- **Synthetic samples.** `get_game_vocab({ samples: 'direction' | 'actions' | 'motion' | 'gear', n?, seed? })` draws
  random fragments of a page from the same tables, without the brief, each with what the book derives from it (a
  direction's palette and clothes, a power set's items, system and costs, a feel's stand and gaits, a gear language's
  classes and stats). Seeded and never stored: the same seed draws the same samples again.
- **The hero door's manual in sections.** The `layered` vocab card opens at its base with a menu of the hero door's
  parts (`hero-looks`, `hero-hair`, `hero-outfit`, `hero-gear`, `hero-motion` …), so a reader pulls kilobytes, not the
  whole card; its body, which search indexes, is unchanged.
- **The rail fronts the game form.** `design_game` is registered first in the game cluster and the game pack. The game
  form's list, the studio's GAME row and a new `game-design` routing card lead with it; `create_game` stays the door
  for composing levels already made into one playable whole, and its description now calls a kit machinery.
- **Advice in every readout, measured, never a verdict.** How much of the world is the creator's (the pages written
  and the pages left to the book's first reading). A world that reads as a test fixture on most of its distinctive
  choices is told so. A tradition, an idiom or a kit is shared by many worlds, so these are named but not counted. A
  page that is a synthetic sample verbatim is also told so, with its seed. Where the recipe has a `brief`, the
  elements, motif and feel it does not explain come back as questions (words only, a heuristic, said to be one).
- **A reference on request, a comparison after.** `design_game({ example })` makes a reference world at its own ref
  only when asked. `design_game({ ref, compare })` compares a world with it page by page, and is refused until the
  world has made its own (a reference read before the design is a template).
- **Proved from a cold start, then fixed where it bit.** Two agents with no context and only the command line each
  designed an original game from a contrasting brief (a lighthouse keeper's daughter holding back the sea; a cocky
  scrap-robot courier). Both wrote every page themselves, copied nothing, and the rail made their heroes, systems
  worlds and gear. Each also took 10 to 12 refusals, and both read the numbers outside the tools. Fixed from their
  reports:
  - The guide carries the recipe's skeleton: where each page lives, the level walk's nodes and edges, the patch ops
    (`set | remove | add`), and how each looks page is written (the tune's names, the head's look words, the hair
    words by head, the palette groups, the underlayer as the outfit build itself).
  - The world card says which kits take a look in words and which take civilizations, and that a civilization is a
    name and what it builds in words, the rest best left out. The equipment card lists the role materials, the metals
    and the finishes, each metal-only finish with its metal.
  - A page the hero door would refuse is refused when it is written, in the door's words, not first when a run makes
    the hero. A failure after the world was stored names its ref, so the next call patches it rather than starting a
    new world.
  - The readout carries `numbers`: the stats, the resource, the levels and epochs, each power's key, spend and look,
    and the HUD's parts.
  - `mechanics.powers.<id>.spends` sets what one power spends of the resource (0: free, a guard that costs nothing),
    ledgered.
  - A brief may be `{ text, why: { <choice word>: '<the brief words it answers>' } }`: an answered choice closes its
    question. The world bible renders any brief shape (a plain string brief no longer breaks it).
  - A run makes `hero-equipped` too: the base holding what it carries, in the stand that shows it. The base stays
    bare.
  - `forward_context`'s worked-example line says a trace shows how the calls go, never what to make.
- **Levels made playable, the book compiled into a game.** A run makes each stage of each level as a world the hero
  pilots (holding its gear when the equipped hero is made), with the systems' HUD and powers, then `create_game` over
  them with the store compiled from the book. Walkable by construction; beatability is the creator's, in play, and
  the game records its levels as unaudited.
- **The quick path.** `design_game({ quick: { goal, ... } })` (goal: reach, collect, survive, avoid) writes a one-level
  gameworld, places the goal on the stage's own anchors and makes the game in one call, with no hero (first person) or
  any hero-door hero, the ground in words and the shell's theme. It stays a gameworld, so adding the hero's pages
  turns it into the book in place. The guide opens with "Size the ask"; the `gameworld-quick` card is all a quick ask
  reads.
- Not yet: the rail's cards in `semantic_search`. Found and left
  for a decision: the systems HUD wears its own tokens, not the direction's colours; a resource only drains; and a
  power that comes from what the hero bolts on cannot be gear (the equipment kernel holds weapons only).

### Character book: the hero, looks and actions

The game book's second concern, beside the world bible: the `characters` slot a gameworld held open. Its first page
is the hero, in two halves. Looks are visual only, with each element (body, head, hair, colour) designed and
reviewed on its own page, then composed through the hero door into a base version. The base wears only an
underlayer chosen to fit the world's setting and dressed in the direction's leading and supporting elements (the
kit's ramps fill what they leave), and it is kept as a pinned revision. Each page also yields the tool
calls that realize it, so a gameworld can drive the tools in place of the create-game tools. Actions are what the hero
can do beyond platforming: the power system, the main power set, and an early-to-mid escalation, or an idiom read as
"x-like". Western or anime is chosen explicitly. A crossing between them
is a named bridge, ledgered. The direction (motif, primary and secondary elements) is inherited from the world or
set custom. Animation is assigned by vibe, and custom edits are saved as revisions from that baseline.

- **Reviewed like the world.** The direction, the four looks pages, the pinned base, the motion and the actions are
  parts of the same review gate (approved, changed since, sent back, waiting, or `auto` in an autonomous world, never
  approved by the agent). `characterReady` says when adornment and the game's systems may start; it advises.
- **A layered hero keeps its history.** `layered` joins the revisioned kinds, so a hero edit archives the manifest
  before it; the base is pinned as `{ ref, rev, print }` and reads as pinned, drifted or missing.
- **Motion by vibe.** Words (cocky, heavy, floaty) sum into four axes (energy, weight, poise, confidence), which move the
  walk, jog and sprint dials through a fixed table; a hero with no vibe has no motion and is unchanged. The `snap` axis
  is not built.
- **The sheet.** `out-sheet.mjs characters [--render]` draws the character bible; `--render` mints the hero in memory and
  draws it in colour (the World page's own render, photographed front, three-quarter and back on the sheet's paper),
  with the wire views folded beneath as its construction, and the live World page. Without a Chromium the colour
  plates are left out and the wire views stand alone. Not yet done: the eyes gate on every plate and on the motion's table, the
  vibe table run through the rig's deep sweep (the adornment and systems pages followed, below).

- **More oomph for the example hero.** A ponytail, sharp determined eyes and swept bangs, and a fitted cut of the
  meadow's tunic. The wind's tint is a jade that holds on cloth, not a pastel. The creator's own underlayer keeps the
  direction's tones (it dropped them before).

### Character book: adornment and equipment

The character book's third page, over the pinned base. Equipment is derived from the hero's actions, the main loop's
final design: an item exists because a power needs it, grows with the stage that unlocks it, and may serve a second
power as an alternate use. What the page conceives is the template of its class in the world's equipment table.

- **From the loop to the kit.** A table reads each power's verb, attack or look as an item and a hand, or as the body's
  own (a dash, a rise). It reads whole words and their forms ("stabbing", "flies"), and the verb's first word it knows
  decides. The leading element picks a staff's stone, the motif the base ornament, and the progression the tiers. It is
  a proposal with its reasons: a power it cannot read is left to the creator.
- **Equipment, a concern of the world.** `equipment.classes` has one row per class of gear the equipment kernel holds.
  The hero's adornment item of a class seeds its row (its build, hand and tiers); a row the world writes wins and is
  ledgered; the rest are left empty, the creator's to fill. Gear is made once the stats exist: its orders wait on the
  systems step and on `mechanics` (a `design_game` run makes each class through the equipment door, below).
- **Reviewed like the rest.** The adornment and the equipment are parts of the review gate. The loop leaves open an
  item that serves no power and a final-design power that nothing serves; an empty class is a task, not a fault.
- **On the sheet.** The character bible draws the adornment (the items, their tiers by stage, their alternate uses, or
  the proposal while none is adopted) and the equipment table with its rows to fill.
- **One gear language.** `equipment.style` is a style card (a sample or an inline card) every class wears unless its
  row names its own, so a world's gear reads as one set. A seeded row wears it too, unless it would break the template
  (said on the page, never thrown). The meadow's example fills every class from one wind-and-brass card.
- **Drawn.** The sheet photographs each filled class at its last tier and the hero equipped at the final stage, holding
  the table's gear for each item it carries; the equipment step lists the mints it will make once ready.
- Fixed: the equipment orders put the build where `mint_solid` reads it (`spec`); before, every one would have been
  refused.
- Not yet: the eyes gate on every item and tier, worn armour and paint, and the table's calibration.

### Character book: the game's systems

The fourth step of the character book: the hero's actions numbered. The world's `mechanics` slot is read from the
actions' mechanics seed: each stage becomes an epoch, each power a node of the tree in its stage, and the system's
resource a resource the powers spend. It lowers to the `play.stats` the stats kernel runs, with a HUD derived from what
the systems publish. Every derived number carries its reason, and the creator's own numbers are laid over it, ledgered.
Equipment is made once the stats stand: each class of gear raises a stat by tier.

- **Each system its own way.** A metroidvania-like power is found (a free node a pickup buys); a shonen-like one is
  bought with the points each level gives, each form raising power; a soulslike one is learned, with gear and sparse
  upgrades offered for coin; an action-adventure-like one is opened by the item that serves it. How each power is used
  (what it spends, how hard it lands by stage) is carried as data until the powers have an input.
- **The dials and the creator's own.** `mechanics.scale` (hp, power, cost, curve) moves the derivation;
  `mechanics.stats` lays the creator's numbers over it by id and key, ledgered and judged by the stats kernel;
  `mechanics.gear` says what a class of gear raises.
- **The HUD.** Bars for health and the system's resource, a level counter, a banner on each level and stage, and a
  status page, styled by the world's UI direction (`propose` by default, gated when the world is minted).
- **Reviewed, and playable.** The stats and the HUD are parts of the review gate; the equipment step waits on the stats.
  The orders mint a player world with the hero and the play block. The character bible draws the systems and what each
  gear tier raises.
- **Fixed: a world's stats reach the page when it has events of its own.** The play block's `play.stats` was dropped
  in the merge with a manifest's own `events` (a player world's controls legend), so the stats kernel never ran there.
- **Played on keys.** Each power is on a key (1, 2, 3 …): it spends its cost and shows its look on the hero, an attack
  the look of its element. I opens the status page; the legend names the keys. The stats ride the player world's pilot,
  so the bound health reaches its body, and the HP bar's max is the health stat, so it follows the levels.
- Not yet: the eyes gate on the numbers in play; a power fires whether it has been gained or can be afforded (the bus
  has no such guard); how hard a power lands waits for targets; the page draws the HP bar once the body publishes its
  health to the bus.

### World weather: a climate in the bible, fog that moves, rain on camera

- **Why.** Weather was a status a body wore (a rain cloud over the hero) or a moment at a spot (a strike). The world's air was fixed when it was built: one fog, day or night, and "stormy" in a prompt only chose a cloud.
- **States in values.** `weather/weather.js` names what the sky can do: clear, haze, overcast, mist, fog, drizzle, rain, downpour, thunderstorm, snow, blizzard, dust, duststorm, petals, leaves.
  - Each state is designed in values, never hue: how thick the fog, the value it takes, how dim the light, what falls (its glyph, rate, size, speed, slant, and what it does when it lands), the wind, the lightning.
  - The style guide colours it, as it colours everything else.
- **A climate on a dice roll.** A climate weighs states (or names a preset: temperate, monsoon, alpine, desert, spring-blossom, autumn, storm-coast).
  - `weatherAt(W, seed, t)` cuts time into slots, rolls each slot's dwell and state with its own dice, and blends into the next. The same seed gives the same sky at every moment, in node and on the page.
- **In the bible.** `style.weather` is a climate's name or `{ climate, dwell?, blend?, start?, surface? }`; a level may name its own and the ledger records it.
  - Prompt words (rainy, foggy, stormy, snowy, dusty, monsoon, autumn, blossom…) set it beside the clouds.
  - The Natural world section gains a Weather card (each state as a grey still, and the first twenty minutes of the dice) when the world has a climate.
- **On the page.** A world recipe's `weather` (a climate's name or the same object) plays on the live World page, a pure function of the world clock and the seed.
  - The fog thickens and thins and takes the state's value, the light dims, rain streaks and snow, dust and petals fall round the camera, landings ring on the ground, storms flash.
  - Absent `weather` adds not a byte to the page.
- **Cues.** `then: { weather: 'blizzard' }` (or `{ is, for?, blend? }`) forces a state, for `for` seconds or until the cue ends; `when: { every: 300 }` is a heartbeat the bus lacked.
  - "Entering the pass starts a blizzard until you leave" and "every 300 s the fog rolls in" are one cue each. The sky eases in from what was showing and back out to its schedule.
- **The air is the style's.** The style guide owns an air card per kit (`era/air.js` reads it, `airOfKit` in `gameworld/style-guide.js` picks it): the fog's hue, the world's shade (the style's ambient, never black), how the fog is drawn (smooth, banded in flat planes, or dithered), what a dust storm or a blizzard is in that style, and how strong cast shadows are. The weather asks the card and holds no colour; `weather.air` tunes it.
  - A cel kit gets banded fog in its own steps and a blue shade; a painted kit a smooth gradient. A dust storm is the style's ochre, and the light a storm takes off is multiplied in as the shade, never black. Cast shadows fade with the sun and the fog, and the sky gives way to the fog.
  - The bible's Weather card draws each state in the style's air.
- **A level's sky.** A level recipe and each of its nodes take `weather`; every section's stage page carries it, and a gameworld level hands its inherited or overridden sky down (the ledger records a section's own). A level's sections share one sky, seeded by the level's seed.
- **Engine handoff.** The engine score carries the sky (`score.weather`: the schedule's first half hour and each state in the style's air, in metres). The Godot kernel (0.7.0) and the Unity runtime play its fog, colour and light through the schedule; Unreal's rig opens in its first state; Blender and a bare GLB carry it as data. Falling rain, snow and lightning stay the web build's, and the ledger says so.
- **Reachable by an agent.** `compose_world` takes `overrides.weather` on any base (a bad climate refuses the mint, teaching), `update_sketch` refuses a bad one the same way, and the intent routes through a `weather` card to its manual (`get_view_vocab({ id: 'weather' })`).
- **A gallery.** `node scripts/weather-gallery.mjs <dir>` writes standalone pages (a cel, a painted, an alien-night and a dithered pixel style) and an index: every state held, every climate played a minute a second.
- **Sound from principles.** `audio: { weather: true }` rolls the sky's sound on the page (`beats/weather-audio.js`, card `beats-weather`), with no sampled audio and no kernel change.
  - A bed, a rain of small drops and rare thunder. Intensity is the rate of drops, size is their band, the surface (leaf, stone, tin, water, sand, snow) is the resonance, and distance is lowpass, delay and length.
  - The world's seed picks this world's rain; each event jitters round it, so two storms sound alike and never the same.
  - Levels set by measuring: each bank carries a gain so its bed lands at a measured loudness (the first levels spread
    over 30 dB and snow was silent), the rings sit under the drops, and a test renders every bank offline and pins
    the levels, their order and the thunder over the bed.

### Realistic ground: the opposite pole of the isekai look

- **Why.** The isekai look carries its ground on grass cards and pixel tiles. On bare ground (a desert, a clay plain) the mesh underneath showed through:
  - each landform cell was lit with its own facet normal, so slopes broke into steps;
  - the sun's shadow was sampled at four corners and smeared across two triangles (the "waffle");
  - a warm ramp's lit and shaded stops sat too close to give any contrast.
- **The realistic pole.** A look card's `ground` (grammar facet) draws the ground as material under light:
  - The colour belongs to the material: `dirt`, `scree` and `packed` tiles painted in the ramp's stops, round the ramp's middle. The trail sits a stop paler.
  - The baked corners carry light only, and the page multiplies texel × light.
  - The light is smooth over the form (the heightfield's normal at each corner, shared by every cell meeting there), with a warm key and a cool sky fill.
  - Cavity darkens hollows and lifts crests.
  - The sun's shadow is hard: a cell whose shadow changes inside it is split, so the shade gathers into pockets with an edge.
  - The tiles show clods with an outline on the shadow side and a lit chip on the sun side, plus patches and grit.
  - A card without `ground` renders exactly as before, so every written isekai card is unchanged.
- **Variants that join.** The ground tiles come in edge-matched variants (Wang tiles), so the ground doesn't repeat in rows from far:
  - each tile edge has a type;
  - each edge is painted once, as a strip across the seam;
  - each block's variant is set by its four edges' types, each type chosen by its own dice;
  - clods lie as thick by a seam as anywhere else.
- **In the land tunnel.**
  - A `realistic` trait (realism, realistic, naturalistic) pulls the pole.
  - A new `pocketing` look law measures contrast at two scales: sun on a flat against its shade, and the ground tile from its darkest to its lightest texel.
  - When the law fails, its tweak deepens the shade (the sky's fill down) or widens the tile's window.
- **The pole cascades.** A look decides its pole once (`card.pole`: absent is banded, `'material'` is realistic), and every drawer reads it through `era/style/pole.js`; no drawer decides it.
  - **Materials.** A surface's material comes from the ramp its colour comes from: stone, grain (timber, bark, rope), leaf, dirt, otherwise plaster. A machine's finish names its own (`FINISH_MATERIALS`: an alloy body is metal). Paint, lenses, glow, the accent and openings stay flat.
  - **One painter set** (`isekai-tiles.js`): dirt, scree, packed, stone, plaster, grain, leaf, metal. `materialBlocks` gives any material in any five stops, a texel a block.
  - **The stage.** The cliffs, rocks, hats, fringes, grass cards and trees are texel × light. Every tile's window is re-centred, the light makes the band, and the trees take leaf and grain tiles. Locked colour no longer applies to them.
  - **The plates.** On a structure, machine, castle, land, flora or town plate, each face is a pixel pattern of its material in the five stops round its lit stop, a block a plate pixel.
  - **The far ring.** Past it the texel is under the eye spot and the air carries the colour: far ridges, their clumps, the clouds and the cloud plate stay flat on either pole.
- **A palette that reads as realism.** Four look laws apply on the material pole; a banded look stands aside.
  - `hue-steady`: a material ramp keeps one hue, and the light shifts it, not the ramp.
  - `chroma-ceiling`: natural ground is muted, with no stop past half saturated and its ends less.
  - `albedo-band`: a material's middle sits low-middle, and the sun makes it bright.
  - `one-family`: the ground's materials share a hue family and part by value and texture.
  - One tweak rebuilds a failing ramp round its middle made real, with almost no hue lean (`toHsl` / `toRgb` are now exported from `look-facets.js`).
- **Alpha patches by cause.** Five patches lie over the realistic ground on the page's blend layer:
  - **fines** in hollows, a stop darker;
  - **gravel** on slopes and the talus apron;
  - **dust** drifted over flats, a stop paler;
  - a lichen **crust** on stable flats off the trail;
  - **trodden** fines along the trail's edges.
- **How a patch draws.** Each patch is a material tile in its ramp's stops, and its alpha is a block noise from ½ to 1. It is drawn alpha-tested against its weight (`blend: 'cut'`: tex.a × weight against ½), so its edge is a ragged pixel edge that grows with the weight. Each patch takes the light of the piece it lies on, so shadows stay crisp.
- **Rock drawn real.** Recolouring alone left the rock isekai: the banded `cliff` tile paints its own light in (lit bench tops, black ledges), and `rock` is two flat blotch levels with ink cracks.
  - On the material pole the cliff is drawn as `strata` (a fine mottle, uneven bedding planes broken here and there, few joints, so they never close into bricks) and the rock as a `rockface` (mottle, thin fractures lit along their upper edge, speckle). A card's tile may name its painter (`paint`).
  - Rock and cliff are lit smooth corner by corner (a form's normals summed at its shared corners), with the shadow still the face's own and crisp.
  - Boulders stand bare: no grass hats.
  - A `sky-fill` law keeps the sky's fill near grey (chroma ≤ 48), so rock in shade leans cool instead of turning blue.
  - On the plates, rock is a rock face and worked stone is stone.
- **Leaves, not blobs.** On the material pole a crown is stamped with the look's LEAF DIE (`LEAF_DIES`: oval, lance, cleft, lobed, needle), chosen by what grows: scrub and thorn are cleft, oak lobed, willow lance, pine needle, birch oval, and oval otherwise.
  - **The skin.** It comes in four bands of light (`canopy-b0`…`b3`), and figure and ground swap as the light falls: lit is a light ground with a few dark leaves, then denser, then a dark ground with light leaves, then a few light leaves in the deepest shade. Each crown face takes its band by the light it was baked with, and the corner colour carries only the light left over (its hue kept).
  - **Leaf cards.** Crossed cutout cards (`leafcard`) stand out of every crown mass, dense at the foot and ragged at the tip, so a crown's edge breaks into leaf shapes.
  - **The plates.** Foliage on a look with a die is its canopy skin, banded by the face's light.
- **Compact cut layers.** A cut layer with a world-locked uv (`uvScale`) ships compact: four corners a quad, sRGB bytes, and the uv and triangles rebuilt in the page. Existing blend layers are byte-identical.

### Scapeshift tunnels: blocks, not kits

- A thing is tunnelled, not templated (`lib/graph/gameworld/tunnel.js`): an intent is read into traits (each a measure
  on the result; a phrase names its own trait and its words still say what they say alone), the blocks that can show
  them are pulled and combined, the result is assessed (every trait's measure and the domain's laws), tweaked inside its
  rails and reassessed for a bounded number of passes, every pass logged, then it goes on the plan. A trait nothing can
  show is a gap, named with what would close it, never filled silently. One loop, three domains.
- Blocks (`lib/graph/era/blocks.js`): primitives in code (box, drum, tube, cone, dish, truss, panel, wheel, track, arm,
  fin, lamp, ring), blocks as data the agent writes (parts on rails, numbers as expressions over params, a `many` dial
  from little to many, sockets, an automation's cycle), every part gated by the eye spot at its tier's ring, and laws
  (one leads, the signature reads at its ring, every claimed function shows its reads, one status light, budget,
  stands). Finishes point the technology's surface groups at a kit's ramps. A starter library
  (`era/tech-blocks.js`) and the block index sheet (`out-sheet.mjs blocks`).
- Buildings tunnel (`gameworld/tunnel-buildings.js`): building intents ("a modular sci-fi habitat, raised, with a comms
  mast and solar") as ops on the building elements and technology mounted on them, spoken for a programme so modules
  emerge as annexes. Its first run named a gap, panel seams; the wall's bond rail gained `panels` to close it.
- Technology tunnel (`gameworld/tunnel-tech.js`): civilizations gain technology, conceptual and visual only. Functions
  (power, store, move, lift, make, sense, signal, keep, grow, light) are what the eye must find; a layout grammar lays
  a part for every read on a body at the tier's scale (tool, machine, installation, automation); the plan is a block a
  civilization's library keeps. A lost signature piece is thickened, not the whole thing. The technology index sheet
  (`out-sheet.mjs tech`).
- Land tunnel (`gameworld/tunnel-land.js`): a look composed from words instead of a kit written by hand. Style cards come
  apart into facets (`era/look-facets.js`: palette, grammar, geology, flora, sky, air, water) and every written card
  round-trips; colour phrases build ramps; the look's laws (ramps climb, shadows are colours, the sky brightest by day,
  aerial perspective, tiles inside their ramps) tweak what they find. Looks register under a content-addressed id
  (`era/style/looks.js`) and every kit lookup falls back to them, so a stage, a sheet and a bible draw one like any kit.
  A day sky may carry a companion world.
- In the gameworld: a civilization's `builds` and `technology` and a style's `look` are words, tunnelled when the world is
  read; the graph gains `thing` nodes (`makes`); the bible shows each tunnel's work and each machine. Autonomous mode
  runs all three tunnels from its prompt. An example frontier, Halden Reach, composed entirely through them.

### Gameworlds: a world above its levels

- A gameworld recipe (`lib/graph/gameworld/`) in two concerns: the style (the kit its ground is drawn in, the
  ground's character for trails and climbs) and its civilizations, as many as it keeps, each a building language, a
  fortification and how it lays out a town and raises a castle. Every level inherits both and is settled by one
  civilization; a town or a castle may be built by another. A level, a section or a place may override any of it,
  and each override is kept in a ledger beside the world's value. Levels lay out through the level graph unchanged.
  Characters, mechanics and the people of the civilizations are left open.
- The gameworld graph: worlds, kits, civilizations, languages, fortifications, levels, sections and places as nodes,
  with typed edges (contains, styled, drawn-in, settled-by, built-by, speaks, raises, seam, leads, overrides), drawn as a map, an outline or a Mermaid flowchart as a document needs.
- The gameworld bible (`out-sheet.mjs gameworld`): a cover, the world map, the natural world, a card for each
  civilization (its houses, its castle, what its language makes of a castle, where it builds), the style and color
  key, a page for each level (its walk, its places and who built them, what it overrides) and the open sections.
- The natural world: each kit the world is drawn in, its land designed as the buildings are: the land index's forms
  at the variant and the step from little to many the world chose (a level may choose its own, kept in its ledger),
  each step's strip beside it as guidance, and the kit's card (trees, grass, water, sky by day or night with its
  moon, light, air, far layers). A kit's own land is read from its style card where the world leaves it. The style
  and color key lays out every kit's ramps, shadow to light, and what each one paints. Creatures are left open.
- The bible is scapeshifting's approval gate (`gameworld/review.js`): a world is reviewed in parts (its shape, its
  natural world, its civilizations, its color key, each level), each with a fingerprint of what it resolves to. The
  creator's verdicts live in the recipe (`review`: approved on a print, sent back with a note, or waiting); an
  approval whose part has changed since stands stale and the part comes back. The cover lists every stamp and what
  to look at next; each section carries its own.
- Autonomous mode (`gameworld/compose.js`, `out-sheet.mjs gameworld --auto "a few words"`): a whole gameworld from a
  prompt. Its words are read against a lexicon of what they say about the ground (a kit, a building language, a
  fortification, the land's forms and how much of each, the ground's character); the seed decides the rest inside
  the same rails; a level whose town's laws advise is laid again on the next seed. Every unreviewed part is stamped
  by its machine gate (auto, or revise), never approved; the bible shows the prompt and what each word decided.
- The land index (`era/out-land.js`, `out-sheet.mjs land`), beside the flora index: six forms (the lie of the
  ground, rock formations, the sediment in a cliff, what a cliff's face is built of, clouds, natural landmarks), each
  a few primitives under a few dials with named variants, a little-to-many dial in five named steps (flat to rugged,
  bare to a field, massive to laminated, smooth to shattered, clear to overcast, alone to a range), built by reveal
  ring inside a face budget and skinned by a kit's ramps.

### Scapeshift structures

Outdoor towns for scapeshift, drawn first as a sheet: nothing is placed in a world yet.

- **Elements first.** A town's elements are designed before any building is composed
  (`lib/graph/era/out-anchor-elements.js`): building elements (the wall and its bond, the cap, the light, the door, the
  socle, cornice, sills, lintels, quoins, shutters, chimney, points, ribs, bands, frame) and street elements (road,
  footway, kerb, lamp, post, fence). Each is a set of rules, not a shape: every param has a rail and says whether the
  street holds it (storey height, pitch, eave, the lights' head line, the bond) or a house may vary it (a bay ± 12 %, a
  light more or fewer, a dome's rise), or whether it is a household's choice (shutters, ribs, by share); each has a
  depth and reads at a ring as geometry, a mark in the tile, or not at all. An element off its rail, an unknown kind,
  or a detail its mass cannot carry (sills on a shell, a cornice with no eave) is refused, saying why.
- **The anchor is a citizen in its slice of street.** The anchor is composed from its elements as the town's ordinary
  house, at full effort; every other use is a promotion of it (a counter, a work floor, the hall with the accent, the
  tower that dares height). It stands in a slice of street (road, kerb, footway, lamp, posts) that every route in the
  town is laid in, stepped down the ranks: the lane in the anchor's road paving with full footways, a branch narrower,
  a back lane earth with none; lots stand behind the footways. Lamps, posts and boundaries in the town are built from the
  anchor's elements at their strides. `seedAnchor(n)` draws elements first, each choice constraining the next, then the
  composition they allow.
- **A town is spoken from one anchor structure.** No house shape is stored. A town names a single anchor structure
  (`lib/graph/era/out-anchor-structure.js`), built black and white and in pieces from a small generic vocabulary
  (masses: block, drum, shell; caps: gable, hip, pyramid, dome, cone, flat; lights: rect, arch, round, lens; entries:
  door, tunnel; ornaments: point, chimney, rib, band, frame, shutters; relations: annex, tiers), each piece a value on a
  surface group. `decompileAnchor` reads it into the town's language (vocabulary, normalised proportions, rhythm,
  values, the depth each piece is spoken at); the grammar refuses what it does not allow (a cone on a block, a door in
  a curved wall), saying why. `speak` builds every building from the language on its lot and programme: the plan from
  the lot inside the anchor's reach, storeys from the need, the anchor's cap at its pitch, its lights in its rhythm,
  its ornaments at their counts, households varying inside the language and mirroring their plans. It is fractal:
  what a plan cannot hold is the language again behind (an annex, a depth shallower), a focus that must stand over the
  street takes a taller storey, a steeper cap, or the language once more on top; the ring prunes the tree (far is one
  envelope) and the eye spot gates every piece. Three anchors are authored (a timber house, a shell, a tiered
  tower-house) and `seedAnchor(n)` draws one from the grammar by a number; `roundTrip` checks the decompile is faithful.
  A kit's craft is its `chunk` and its default anchor; a town recipe's `anchor` names another (an id, pieces, or
  `{ seed }`).
- **What every building answers to, whatever its anchor** (`lib/graph/era/out-structures.js`): the uses as programmes,
  the rings and the eye spot (a part is geometry at a ring only where its least span covers 12 frame px at the ring's
  read distance; smaller marks go into the tile, smaller things on the silhouette are not built), budgets by ring, the
  laws of scale (storey, door, one-leads, value-order, eye-spot, budget, programme) and the anchor's laws
  (speaks-the-anchor, reach, sheds, rise, rhythm, ornament-even), measured on every building; they advise.
- **Roofs are laid in courses.** Pitched caps carry their covering's courses as shadow lines clipped per slope (tile,
  shingle, slate; thatch none, rolled at the ridge), drawn in the tile; the ridge cap is geometry where it covers the
  eye spot.
- **Values first, paint second.** Every piece is built in values on a surface group (`str:plaster`, `str:tile`,
  `str:lens`, `str:accent`, `town:grass`, `dress:timber`, …); no builder reads a colour. The style guide paints as a
  separate concern (`lib/graph/era/out-structures-paint.js`): each group a kit ramp, the lit value picks the stop, the
  accent kept for the one surface that marks a use, a cap on its walls' ramp a stop under them, trim on a cap's ramp a
  stop over it; its law checks the paint keeps the anchor's value order. The alien-night swatches gain a blue `lens`
  ramp.
- **The secondary.** Every anchor has a counterpoint derived from its elements by contrast rules (`deriveSecondary`,
  `secondaryOf`; `SECONDARY_RULES`): it shares the street, the storey height, the door, the lights' form, the ground
  storey and the details, and turns the rest: a compact square plan, a pyramid 12° steeper (a cone over a drum or a
  shell's), the anchor's neighbouring covering (never its walls' material), a dark boarded body in a pale street or a
  pale one in a dark street, lights 0.85 × 1.15, a finial and a band at every storey. The town sets secondaries as
  punctuation (corners and run ends in a fuller town, then a rhythm by the recipe's `secondary` 0…1, never two
  together), each in the lowest band that rises a metre over both neighbours and under the hall round the square, or
  a citizen where none fits; law `secondary`. They wear the anchor's paint fitted to their own values.
- **Heartbeats and ruled paint.** A town's `heartbeat` (hamlet, village, market, burgh) is its height as a curve: a band
  of storeys at the heart and at the edge, eased by distance off the square, a back lane a storey lower; every citizen
  keeps to it (a shell as far as its rise allows). Citizens are painted by ruled variation of the anchor's paint
  (`streetPaints`): roofs hold, walls step a stop or swap among the group's kit ramps, neighbours on a frontage differ,
  every variant keeps the value order, the focus and the landmark wear the anchor's own. The painter fits a paint to a
  language (`fitPaint`: a cap over its walls steps down, or the walls up) and never lets a covering sink to the
  openings' stop; a tower told to stand taller climbs by storeys first. Town laws `street-holds`,
  `heartbeat`, `section`; paint laws `roofs-hold`, `neighbours-differ`, `variants-keep-values`. A building past its
  ring's budget puts its finest details (quoins, lintels, sills, shutters) into the tile first.
- **A town is drawn path first** (`lib/graph/era/out-town.js`). The lane sways with the trail and forks at the reveal
  into the square, a branch climbs from it through up to two terraces (each held by a retaining wall and climbed by a
  flight whose going is the man-made index's `steps`) to the landmark, an upper lane runs along the first terrace, a
  back lane behind the frontage, a second way drops to a pocket. Lots are cut from every frontage in walking order on an
  occupancy grid, each use by cause, each ring by distance off the walk; the mid ring repeats in pairs, the far ring is
  farmsteads in their fields; the focus and the landmark are told how tall to stand. Paving is the route's rank, door
  paths cross each front; the back lane yields behind the square so the hall keeps its ground. The recipe (`length`,
  `sway`, `branches`, `levels`, `back`, `farms`, `heartbeat`, `dress`, `paint`, `anchor`) is read against the town card
  and refused anything else.
- **Walks and boundaries are structures** (`lib/graph/era/out-anchor-elements.js`, `lib/graph/era/out-town.js`). The
  footway is a function with four equivalent forms (`kerbed`, `flush` with a channel and posts along its line, `boards`
  on sleepers, `verge` with a clear path behind the grass). The `fence` element is replaced by `boundary`: forms rail,
  paling, picket, hedge, drystone, coursed and rendered, each with its thickness, the heights it stands to and the rise
  it can hold back; height classes (kerb, low, waist, screen, high) measured against a body; roles (front, side, back,
  field, precinct, guard, retain) that say how high a line stands by what it does. An anchor names its boundaries and
  their roles; a role a named form cannot reach falls to the strongest that can, then to a coursed wall. Each line is
  built by depth (mass; coping, piers and rails; its laying as marks; gate leaves), the ring choosing the depth. The
  town plan lays them out after the buildings: a lived lot's front gated at its door path, one party line down the
  passage between neighbours (and one back line between yards back to back), yards' backs, the hall's precinct, the
  fields, each terrace held by a retaining wall and guarded along its drop; town laws `bounded`, `gated`, `sightline`,
  `guarded`, `form-reach`, `walls-clear`, `party-once`. The dress no longer grows fences; flush walks are posted.
  `streetTile(anchor, rank, { ring, kind })` gives a route's section as a tile (run, crossing, end), whole paving units
  long and the same at both ends, at three degrees of detail, with laws `seamless`, `whole-units`, `budget`. A seeded
  anchor draws its walk and boundaries from their own dice, so the building it draws is unchanged.
- **A fortified town, the lord's land inside** (`lib/graph/era/out-fortress.js`, `lib/graph/era/out-town.js`). One dial,
  `fortified` 0…1 on the town recipe (0 is the open town, unchanged): a curtain traced round the town (an octagon off
  the routes) with a gate wherever a route crosses it and towers at its corners, where it steps a terrace and at a
  rhythm that tightens with the dial; from 0.4 a ditch and an approach that runs under the west wall outside it and
  turns into the gate; from 0.6 each terrace's wall a ward's curtain, entered by one gate where the branch climbs (the
  branch dog-legs inside so no two gates line up); from 0.75 one gate; from 0.85 the lord's land, two wards over the bailey and
  the lane drawn in. Nothing is built on the road outside the gates. The fortification is designed elements first (`fort`: the
  curtain and its base, the parapet, the walk, the tower's plan and crown, the gate, the ditch; rails; a rampart of
  5–9 m, game-scaled): the bay (a length of curtain) is its citizen, built by depth; the tower is derived from the bay
  by contrast (it rises, stands out of the face to flank it, turns its plan, crowns itself); the gatehouse composes
  towers over the passage (twin, or a box gate-tower); the keep is the town's landmark on a broad lot, raised over every
  tower, a secondary held two metres under it. Two authored compositions, `crenellated` and `battered`, and `seedFort`.
  Laws `enclosed`, `flanking`, `bent-entry`, `commands`, `skyline`, `glacis`, `gates-only`, `one-way-up`. Along the
  way: a lot on the inside of a bend steps back until both front corners clear the walk; a front reaches a passage's
  middle only where it stays clear of the walk; back-to-back yards share their line where the two overlap; a secondary
  is never its neighbour's repeat. `node scripts/out-sheet.mjs fortified-town` writes the Fortified Town Index: the dial
  at 0, 0.5 and 1, each composition's elements by depth with the tower's derivation and the gatehouse, a fortified town
  from above, standing and from the south with its laws, the other composition, and a seeded one.
- **A castle is the lord's land drawn tight** (`lib/graph/era/out-castle.js`). The fortified town spends its surface
  on its walls (its lord's ward is about 4 % built, its keep 1.4 % of the ward); a castle takes the town's walls off and
  compresses what they kept into one structure, the town outside it. It is composed inward from its wall by a budget:
  the keep first (a third of the ward's breadth on the back corner, straddling the curtain; a great tower with corner
  turrets and a forebuilding, a drum, or a tiered keep on its stone base, `build.keep` by depth), then ranges backed
  onto every curtain (lots spoken in the town's language, wall to wall: the hall by the keep, lodgings, stables and work
  by the gates, a chapel when the court would be a field), the court what is left. The inner ward stands on a platform
  (a battered base holds its ward high and its wall low), climbed by a flight inside its gate; with `wards: 2` a
  forecourt before it, its gate on the other hand, the walk turning under the inner wall. The walls are cut to what
  they keep: no higher than the language's lodgings can show over. Settings `fort`, `size` 40–56, `wards` 1–2, `rise`.
  Laws `filled`, `court-span`, `rich-inside`, `keep-weight`, `shows-over`, `flanking`, `commands`, `bent-entry`,
  `one-gate-each`, `climbed`. The town recipe's `castle` (never with `fortified`) sets it on the highest ground past
  the branch's end, the branch brought to its bridge, the keep the town's landmark (law `outside`). A curtain holding
  ground behind it now shows its inner face over that ground. `node scripts/out-sheet.mjs castle` writes the Castle
  Index: the budget against the fortified town's, the keep by depth, both compositions (plan, standing, from the
  south), one ward, a seeded one with its chapel, and the town below its castle. The castle is designed by the style it
  keeps (`STYLE_INFLUENCE`, `influenceOf`): a language that builds round (shells, drums) draws its curtain as an
  ellipse as long as its masses (the keep a third out past the far end of the long axis, the hall at the near focus,
  the wards nested rings, the walk round the forecourt under the inner wall, ranges on every length of the ring, the
  ring's lengths a building long); its cap speaks on the towers (shells and domes crown drums with a dome, a flat roof
  carries the crenels round); its landmark becomes the keep (shells stack into a keep of orbs, tiers under flat roofs
  step into a platform with a stair and a shrine). `build.keep` gains `form: 'orbs' | 'stepped'`, the tower a `dome`
  crown. A round keep is drawn a ninth broader to weigh as a square; the court takes a building in each room while it
  is a field (the hall's focus first, stepped aside of the flight).
- **Town interceptors dress it** (`lib/graph/era/out-town-dress.js`): lamps, posts, wells, market stalls, benches,
  carts, barrels, woodpiles, planters, signs and trees, each a site finder over the map, a grower and an
  aggressiveness 0…1, seeded and capped, never on the walk but for lamps, posts and signs.
- **The sheet.** `lib/graph/era/out-structures-html.js` draws the Outdoor Structures Index: the elements (each drawn on
  its own, its holds and how it reads by ring), the citizen in its slice of street (axonometric and in section), the
  anchor in pieces and its language, the language spoken on every use (by depth, by ring, by household), one frontage
  of six households with the street's lines drawn across it, the secondary (its derivation, rule by rule, and a
  frontage with it set in as skyline, values and paint), walks and boundaries (the four walks, every role at its
  height against a body, each line by depth, one lot and the lines the plan gives it), street tiles, the town in miniature (a top-down map and an
  axonometric), the heartbeats (curves and a frontage in elevation at each), a gallery of other anchors and the towns they speak, values and paint, one use on five lots,
  routes and levels, paving, the interceptors, the vocabulary, the laws, roofs by covering, every kit. The drawer is
  `era/out-structures-draw.js`, the town's cards `era/out-town-html.js`. `node scripts/out-sheet.mjs
  <index|flora|structures> [out.html] [--seed N] [--kit id]` writes any of the outdoor sheets to disk.

### UI controls

A game reads what the player means (jump, rotate clockwise, accept), never a key. A control scheme says which
controls of each input device serve each intent, using the conventions players of that genre already know. The
pause legend is read off the same table, so it only teaches controls the world answers to, and a remap will
relabel it. The model is OpenXR's action system: a scheme is an action set, a device family is an interaction
profile, and a scheme's bindings are suggested bindings.

- **`lib/graph/controls/devices.js` names each input device family after the standard it follows.**
  - `keyboard`: `KeyboardEvent.code`, positional.
  - `mouse`: `MouseEvent.button`.
  - `gamepad`: the W3C Gamepad "standard" mapping. Buttons have positional names (`south`, `rb`) and print in
    Xbox, PlayStation or Nintendo layout.
  - `xr`: the WebXR "xr-standard" mapping, per hand (`right.trigger`, `left.thumbstickY-`).
  - `sim`: USB HID Simulation Controls (steering, accelerator, brake, clutch, throttle, rudder, aileron, elevator,
    toe brake), plus buttons and a hat switch.
  - A control is a key code, a button, an axis, or a half axis (`leftY-` is the stick pushed up). A family's driver
    turns raw device state into control values. `xr` and `sim` are declared with no driver yet: their controls can
    already be bound, labelled, validated and checked for conflicts.
- **`schemes.js` holds the schemes as plain data.**
  - `pilot`: 3D walk, platform, suit, glide, drive, fly and spectate.
  - `falling-block`: the guideline layout.
  - `grid`, `point` and `menu`.
  - Each action binds up to two controls per device family and names the contexts where it is live. Two actions may
    share a control only in different contexts.
  - Defaults follow each genre: WASD and mouse; left stick moves and right stick looks; in VR the left thumbstick
    walks and the right one turns; on a wheel, the accelerator, brake and wheel drive.
  - Adding a device family means one `devices.js` entry plus bindings. No new fields.
- **`controls-kernel.js` is import-free; pages run its `toString()`.**
  - It reads any family through a driver's `read(control)`: held buttons, analog values, and axes taken slot by
    slot. Controls a held chord button silences can be quieted.
  - `gamepadRead` is the reference driver: digital reads use the browser's pressed threshold, and analog reads give
    raw trigger travel.
  - It resolves a scheme with per-family overrides, dropping anything that is not a control of that family.
  - It labels every family, builds legend rows per family from live world flags, and lists conflicts per family and
    context.
- **The controllable runtime reads the pilot scheme through the keyboard, mouse and gamepad families.**
  - `__BIND` is the live table in place of literals. Input is unchanged for the default bindings. One exception: in
    glide, Space with one Shift held now cancels instead of ascending.
  - Look keys are new and unbound by default. Binding them gives a keyboard-only player the camera.
  - The pause legend comes from `__ctlLegend`. It now names tackle and target lock when the world has them, shows
    the weapon pad rows only when armed, and says throttle / brake for a vehicle.
- **Confirm and cancel are gamepad roles, not positions.**
  - The menu, grid and point schemes bind `confirm` / `cancel`.
  - `resolve` places them for the pad's layout: the bottom button accepts on Xbox and PlayStation, and A (on the right)
    accepts on a Nintendo pad.
  - `padLayout(id)` reads Xbox, PlayStation or Nintendo off a Gamepad id. The 3D runtime re-resolves when the layout
    changes, and its legend and weapon-selector glyphs print in that layout.
- **Brickster reads `KeyboardEvent.code` and the gamepad from the falling-block scheme.**
  - Keys are positional, so Caps Lock and other layouts no longer miss Z / X / C. Ctrl now rotates counter-clockwise,
    following the guideline.
  - The pad layout follows the console guideline:
    - D-pad or left stick moves and soft-drops, D-pad ↑ hard-drops;
    - the right face button rotates clockwise and the bottom one counter-clockwise;
    - LB / RB hold, start restarts.
  - A held move or soft drop repeats like the touch knob. The first press lifts the start gate. A line under the board
    names the pad's own buttons.
- **The game shell's pause comes from a `shell` scheme** (gamepad start), not a hard-coded button index.

### Floormap

A floormap is scapeshift's primitive for fixed-camera levels: it places floor, not rooms. Regions of any shape, how
they join, what lies along their edges (a wall, a rail over a drop, water), what stands on them, and where the
cameras sit. Everything off the floor is backdrop to be depicted. Its outcome is the walkmesh.

- **The recipe, the camera solve and the board (`lib/graph/era/floormap*.js`).** Nothing reaches the World page
  yet.
  - `floormap.js`: regions are a rect, a polygon, a disc or a strip (a path at a width, one leg per segment). Links
    join them open, by a door, a stair or a gap. Each region's boundary is cut into pieces:
    - open where it meets a linked region, and a wall where it meets an unlinked one;
    - one opening per door link;
    - elsewhere the floormap's edge kind, unless an edge rule names it by side (a compass word) and span: wall,
      rail, drop, water, foliage, void, or an exit to another map's door.

    Items (stand, block, hotspot, pickup, spawn, trigger, light) leave as stage-style anchors. `floormapFaces` is
    the greybox: walls face into their region, and the walkmesh bake reads it as is.
  - `floormap-cameras.js`: shots are corner, wide, low, overhead and profile. Each camera owns a zone (a region, a
    corridor leg, or a region split along its long axis), stands inside it, and turns and widens until it holds
    the figures and 90% of the floor. Under `cameras: 'auto'`, a region one shot can't hold gets another, and a
    camera that would turn the figure round across a cut is placed elsewhere. `cutsOf` lists the cuts.
  - `floormap-laws.js`: regions apart, links that touch, rules that land, reachable from the spawn, items on the
    floor, shots that cover, the figure readable, screen direction kept across cuts, stands that hide.
  - `floormap-board-html.js`: the floor from above (zones, edges by kind, doors, exits, items, cameras and their
    view) and a greybox shot per camera, drawn in plain SVG with no browser.
- **A floormap becomes a walkmesh, baked or painted (`playscape/walkmesh/from-floormap.js`).**
  `walkmeshOfFloormap` makes one plate per camera, all in one space, each holding its camera's zone.
  - A baked plate freezes the floormap's greybox: `floormapPayload` shades it in values and cuts concave floors into
    triangles.
  - A painted plate (an image handed in for that camera) gets everything projected from the floormap through the
    camera it was painted over: its floor, holes (blocks), occluders (stands, tall blocks), exits and spawns.
    Nothing is traced.
- **One floor, several cameras.** Walkmesh plates in one `space` each hold a `zone` of a shared floor, and crossing a
  zone line cuts to the next plate without an exit. `cutsOf` lists zone cuts beside exits, and a plate judges only
  its zone's floor. A painted plate may stand over a known `camera` instead of a fitted `ground`, and may carry
  `holes`.
- **The plate brief (`era/floormap-brief.js`).** Per camera: what it sees and a prompt in the floormap's own words
  (a region's or item's `form`, the edge kinds' depictions, style from the caller), with a guide drawing (the
  greybox in values). What it sees is judged by a small depth raster, not by the frame alone. The floormap board
  prints each brief under its shot.
- **Cameras keep clear of tall pieces.** The solve won't seat a camera within 1.5 m of a stand or tall block, or
  looking at its zone through one; that ranks worse than turning the figure round at a cut. A `shot-clear` law
  advises when no clear seat exists.
- **The walkmesh bake drops sealed pockets:** a patch of floor enclosed by standing faces and smaller than a square
  metre is inside a solid (a column, a crate), not floor.
- **Camera triggers: a trigger can cut the shot.** A `trigger` item (a disc, or a rect with `size` and `rot`) takes
  `cut`:
  - a camera's id: walking into the trigger switches to that camera, and it holds until the next cut. With `from`,
    it fires only while that camera is live, so two offset triggers keep a doorway from flickering between shots.
  - a shot (`{ shot, at?, look?, fov? }`): an insert, a camera of its own that holds just the trigger's floor.
    Walking in cuts to it, walking out cuts back.

  `cutsOf` names how each cut fires (`by`: zone, trigger, leave). The plan draws each trigger's cut, and a
  `trigger-cuts` law advises a trigger that no live camera can fire. The walkmesh carries them as `triggers`.

### Walkmesh

A walkmesh is a world kind scapeshift can't make: a fixed-camera plate (the background, painted or baked from a
world) with an invisible floor the figure walks on, occluders it walks behind, and exits that cut to other plates.
Only the floor has to be geometrically true, so the background is isolated as an image and can be anything.

- **The vocabulary and the board (`lib/graph/playscape/walkmesh/`).** Nothing reaches the World page yet.
  - `camera.js`: one pinhole per plate, the one every still and the World use (`resolveCameraBasis`). A painted
    plate is fitted by its horizon line, eye height and field of view; `lift` takes a plate pixel to the floor in
    metres and `project` brings it back.
  - `walkmesh.js`: `readWalkmesh` reads painted plates (floor, occluders, exits and spawns in plate px) and baked
    plates (a scapeshift world and a camera; exits and spawns in metres) to one floor in metres. Exits go to
    `'<plate>.<exit>'` or to an era map door; `cutsOf` is the cut graph.
  - `bake.js`: a baked plate's floor is read off the world on a quarter-metre grid (an up face within a step of the
    ground, nothing standing across it at body height); its occluders are the world itself. Decals, light volumes
    and cutout cards are not solid.
  - `mask.js`: where the figure stands seen and where it stands hidden, for both sources.
  - `laws.js`: the floor below the horizon and inside the plate, exits on the floor's edge and leading back,
    spawns on the floor, every exit reachable, occluders standing on the floor, the figure readable at the front and
    the back, the start resolving.
  - `board-html.js`: per plate, the plate with the floor seen and hidden, occluders, exits and spawns; the scale
    ladder (the figure at five depths); the floor from above with the camera's view; then the cut graph and the
    laws. `bakePlatePng` renders a baked plate from its camera.

### Playscape UI

Playscape treats the interface as a layout problem. A UI part says four things:
- where it sits: a screen region, an object, a point in the world, the cursor;
- what it shows: a bus var, an event, a store slice, a sense of the world;
- which appearance state it is in;
- what it looks like: a style guide of tokens over values, under the black-and-white law that game objects follow.

Parts compose up five rungs:
- UI that is the game;
- switches with cause and effect;
- a live HUD for games with a few states;
- HUDs composed from a complex game's systems;
- deep menus and stat displays.

This step builds the contract and the approval gate. No rung is served yet.

- **A world takes a `play` block, and its parts lower exactly onto today's HUD.**
  - `lib/graph/playscape/ui/parts.js`: `PARTS` holds readout (text, counter, bar, clock), banner, toast and legend.
    `readPart` and `lowerParts` turn `{ part, variant, bind, at, when }` into `events.hud` rows. Those rows normalize
    to the same widgets as the idioms that make them.
  - `regions.js` holds the nine regions (the page draws seven; `left` and `right` are wireframe words until the
    rung-0 renderer), the layers and the surfaces.
  - `world-scene.js` lowers the block between the hand rows and the mechanics' rows. A hand-written `events.style`
    still wins over the play block's style.
  - Absent `play`, the emission is byte-identical.
- **The UI is proposed and approved before it is created.** `direction.js` follows scapeshift's art direction:
  - `play.ui: 'propose' | 'auto' | { register, pin, seed }` is filled at authoring time (`resolvePlayUi` in
    `sketch-mint.js`) into five items: guide, motion, parts, layout, wireframes. Each item is `proposed`,
    `approved` or `auto`.
  - `'reroll'` on the guide or the motion redraws that item only. Parts, layout and wireframes follow
    `play.parts` and `play.phases` (at most eight).
  - While any item is proposed, `lowerPlay` gives the page greybox tokens. Once every item is approved or auto, it
    gives the guide's tokens and the register's dials.
  - Every guide value names the layer that set it: operator, hints (a stage's optional `play_hints`), world (the
    stage's tone), roll, or default.
- **One register slider, from modern to immersive.** `register.js` defines it:
  - `REGISTER_STOPS`: modern 0, clean 0.25, framed 0.5, console 0.75, immersive 1.
  - The slider moves nine `DIALS` together (type, frame, plate, surface, layout, motion, sound, cursor, light). Any
    dial can be pinned on its own.
  - `registerCss` is the dom backend. It reads closed words only, so no author string reaches CSS.
  - `scene/channels/events.js` lays it over the HUD sheet when a settled direction brings `events.register`.
    Without one, no bytes are added.
- **Motion is counted in frames on the game clock.** `motion.js` holds snap, punch, roll, shake, pulse, hold-fade,
  slide and sway. Each has a rail its rolled frame count stays inside, and the motion dial sets the curve: eased,
  snapped, stepped or mechanical.
- **The UI board is assembled from tracked pieces.** `board-html.js`:
  - Pieces: `ui:guide`, `ui:motion`, `ui:part:<part>.<variant>`, `ui:layout`, `ui:wireframe:<phase>`. Each part
    is drawn in every appearance state, in values and then dressed by the guide, using the page's own `HUD_CSS`.
  - `uiSheetHtml` is the reference sheet: every part, variant and state at a register.
  - `create_sketch` and `update_sketch` answer with the board as an image (`play-board-result.js`), with the pending
    items and the exact patches to approve or reroll.
  - `laws.js` advises, and never refuses, on `centre-is-focus`, `region-budget` and `scene-backend`.
- **Stylized borders: art over the frame, composed from elements.** `lib/graph/playscape/ui/borders.js`:
  - `BORDER_ELEMENTS` are ticks, scanlines, dotgrid, hazard, sidebar, brackets, tendrils, notch, stitch, glow and
    soft. Each takes a slot: one element per slot, except the background and shadow slots, which stack.
    `readBorder` refuses only geometry that cannot hold together: a notch clips away whatever stands off the edge.
  - `BORDER_FLAVORS` are named sets of elements, each with the face, dials and tint that go with it:
    - `covert`: brackets, scanlines, ticks;
    - `futurepunk`: ticks, notch, dotgrid, glow;
    - `mech-cockpit`: hazard, sidebar, notch;
    - `cozy`: soft, stitch, tendrils.
  - The art draws in the guide's tokens only. A flavor's tint is a token proposal with source `flavor`;
    `tint: false` keeps the world's colours.
  - Precedence: the operator's words, then the hints, then the flavor, then the register and the world.
  - `borderCss` is the dom backend. The World page lays it after the register's sheet, from the settled
    `events.register`.
- **Pixelated is a tuning beside the register.** `play.ui.pixel` is 0, 2, 3 or 4, or `true` for 3. It turns off font
  smoothing and gives hard edges, stepped corners, integer strokes, stepped bar fills and the mono face. Every border
  element draws at the pixel size.
- **The board answers the black-and-white test.**
  - Each part the world declares gets its own row, keyed by what it binds, in its own colour.
  - The values row drains even the semantic hues.
  - The `values-apart` law advises when two standing parts of one kind in one region differ only by colour and label.
  - The guide piece shows the border and the pixel tuning, each with its source. The drawer gains `ui-border` and
    `ui-pixel` cards.
- **Shared status: whose value a part shows, and who may see it.**
  - `bind.of` is `self`, `team`, `all` or `each:<tag>`; `each` makes one part many. `audience` is `self`, `team`,
    `all` or `spectator`.
  - `nameplate` sits over each tagged entity (`at: 'over'`). `scoreboard` is a row per entity.
  - The board draws a wireframe per phase per view (player, spectator), with ally and enemy markers, so what each
    view is shown can be checked before anything is built.
  - The `owners-apart` law advises when a part enemies also see doesn't tell mine from theirs by shape
    (`mark: { ally, enemy }`).
  - The bus stays local; team and per-entity parts are designed on the board, and authority over shared state is
    the exported engine's.
- **Flow parts for management screens: rates, not stocks.** `ledger` (stocks with rates), `forecast` ("runs out in
  2:10"), `trend`, `alerts` (held until acted on), `allocator` (splitting a fixed pool) and `queue`.
- **Designed on the board before the page draws them.**
  - A part the page can't draw yet (`page: false`) is drawn on the board, dashed in the wireframes, and left out of
    the lowering. The `board-only` law names each one.
  - A part placed at `left` or `right` is now board-only too, instead of an error.
- **Pace scales the layout laws.**
  - `play.ui.pace` is `glance`, `scan` (the default) or `study`. Each pace has its own region budgets
    (`REGION_BUDGETS` in `regions.js`).
  - At `study` pace the centre may hold a standing panel.
  - The drawer gains `ui-shared` and `ui-pace` cards.
- **The shooter's idioms are parts, and systems publish what they read.**
  - `lib/graph/playscape/ui/systems.js` lists what the piloted runtime already keeps: weapon (ammo, magazine,
    reload, cooldown, charge, energy, hit, assist-hit and miss events), lock (the target), body (hp, harm) and match
    (kills, the feed).
  - New parts bind a system (`bind: { from }`, by default their own): `reticle` (ring, cross, dot or chevron, with
    core, assist, status and charge layers), `hitmarker`, `ammo` (count, pips, bar or gauge), `weapon` (icon-name or
    loadout), `lock` and `target` over what you aim at (`bind.of: 'target'`), `damage` arcs and the kill `feed`.
  - A readout may read a system field: `bind: { from: 'body', field: 'hp' }`.
  - The laws: the reticle stands in the centre by right. `hit-reads` advises when a reticle has no hitmarker,
    because then a hit reads only as a colour flash.
  - On the board, the centre marks draw bare (no plate, no border art) and sit at the exact centre of the
    wireframes. `board-only` advice is grouped by reason.
  - The piloted runtime keeps drawing its own HUD until it is drawn from these parts.
  - The drawer gains a `ui-systems` card.
- **`get_play_vocab` is the play drawer, scaled to the ask.**
  - With no argument it returns the ladder: board, click, level, systems, game.
  - `rung` returns what that rung admits; `id` returns one card. The cards (`play-guide`, `ui-board`,
    `ui-register`, `ui-motion`, `ui-layout`, `ui-part-<part>`) are generated in `cards.js`.
  - The tool lives in `pack_game`. Studio routing gets a PLAY row, and a `play` routing card is added. The
    tools/list payload is re-pinned (242,400 since `design_game`).
- **Cues: one primitive for the UI answering the game (`playscape/ui/cues.js`).** A cue says, in game words, when
  the UI acts, what it does and until when:
  - when: the figure enters, leaves or comes near a zone, uses a thing, takes an item, a value crosses a line, any
    bus event, or the level starts;
  - then: words on screen (a banner, a toast, a prompt), a part shown, hidden or put in a state, or a phase;
  - until: another happening, or a time; `once` fires it the first time only.

  Each cue fires one bus event, `cue:<id>`, so any part can bind to it. The words are drawn on the page today; showing,
  hiding and states are set on the bus and drawn on the board until the page reads them. Parts may carry an `id`.
- **Menus, opened from anything in any map.** A cue's zone may name an anchor, the addressable places and things
  every scapeshift map already carries (a stage, a dungeon, a floormap, a trail), so a shop counter, a bed, a sign
  or a chest can open a menu. `play.menus` holds them, each one of a closed set of kinds: read, talk, confirm, shop,
  chest, save, map, list. A talk's choices and a confirm's answers do cue effects, which also gain `open`, `close`,
  `set` (a var) and `emit` (a bus event). A menu carries no style of its own: the world's UI style guide dresses it,
  as it does the parts.
- **The page draws menus.** A world with menus gets an overlay that shows the open menu over the play, from the
  same markup the board draws (`menuHtml`), dressed by the guide:
  - up and down move the focus; enter, space or E picks; escape closes; a click picks;
  - a read menu turns its pages and closes after the last;
  - keys go to the menu while it is open, so the walker stands still;
  - the overlay is rewritten only when its markup changes, since a rewrite every frame swaps the choice under the
    pointer between press and release and the click never lands.

  A cue's zone watches the world's walker, so its own props don't set it off. A world without menus emits exactly
  what it did. A shop's buying waits on an "afford it?" check the bus doesn't have yet: picking from its stock only
  closes it.

### Elements

- **Statuses are names; looks are what they wear.** A cue or a menu choice puts a status on a character by any name
  (`{ status: { who, is: 'poisoned', look?, for?, color? } }`); nothing is built into the name. Its look is what the
  page draws on the body as it moves, in layers: a fresnel `coat` (a rim glow that breathes, grows, flashes, flickers or
  holds: "this is happening now"), `motes`, `bolts`, `fire`, `ice`, `water` and `steam`. `play.looks` designs your own;
  presets to start from are named by what they do (glow, orbit, rise, spiral, burst, converge, ring, twinkle, fall,
  column, flare, kokusen, fire, blaze, ice, frost, wet, steam). `{ lift }` takes one off; `{ faded }` fires when one
  runs out or is lifted; an untimed status comes off when its cue ends. A page carries only the looks its cues name and
  only the layers they use.
- **One wave for every orbiting light.** The juice verbs (enchant, heal, charge, ward, sparkle, drain, aura, …) were
  each a path of lights round a body; they are now one parameterized wave: streams, trail, cycle, turns, radius and
  height from → to, arc, tilt (a ring), wobble, spread, a brightness envelope, pulse, size, or a scatter that twinkles.
  A look may stack several.
- **Kokusen.** Black-flash lightning (left behind by the sprite backend, which can only add light): black strokes over
  a red glow edge, each struck with its own weight, kinked node to node and tapering to a hairline, some forking.
- **Fire, one layer.** `fire: { size, color }` lights the world's own fire on the body (its flames, embers and smoke,
  lighting what is near) and carries it there while the status lasts: a small one licks up from the top of the body, a
  big one engulfs it from the feet. Its colour is any colorant (copper blue, barium green, strontium red, potassium
  lilac, …) or `#rrggbb`. It stands on no prop and lights the world at a share of a standing fire's light.
- **Water in its three states.** `ice: { mode: 'encase' }` closes the body in a randomized, angular block of ice (a
  faceted shell pulled about at every corner, different on every body, flat on the ground, frost-shaded with its edges
  drawn white); `mode: 'spikes'` grows crystals out of its surface (the carved-letter ice effect, now in 3D). `water`:
  drops gather, fall to its feet and ring out. `steam`: vapour rises, swells and thins. These grow from the body's own
  meshes, so they fit a box, a ball or a figure and move with it.
- **Values first.** Every preset reads apart with the colour taken out; the `looks-apart` law names two statuses a play
  uses that differ only in colour, and `status-lifts` one that never comes off. `?values` shows the page in greys.

### Transitory effects

- **Appear, vanish, transfigure.** `spawn` and `vanish` take `with`: `smoke` (a burst of puffs, the body pops in or is
  gone behind it), `hologram` (an edge wireframe flickers on, the skin fills in), `scan` (a glowing plane sweeps up the
  body, printing it), `transporter` (sparks gather onto the body's surface). Going, each plays in reverse on a ghost of
  the body where it stood. `{ transfigure: { who, into, with? } }` turns one character into another minted asleep: it
  wakes where the first stood, by default `galvatron`: the skin goes to wire, a cloud of points morphs one form into the
  other, the new form re-skins (the carved-letter effects of the same names, in 3D on any body). `{ puff: who | { at } }`
  is a puff of smoke at a place.
- **Water changes state.** Ice rises from the ground as it freezes and sinks away as it thaws; water boils off in a burst
  of steam when it comes off. Every look now fades its layers out instead of vanishing.

### Weather and moments

- **Drift.** A look's `drift` layer is a particle spray, as `motes` is a wave: `{ glyph, count, from, v, el, go,
  gravity, swirl, life, grow, spin, size, rings?, color? }`, one closed form in time that the page runs as written.
  Presets `rain` (a cloud over the head, drops ringing out at the feet), `snow`, `wind` (streaks and leaves swirled
  round), `embers`, `dusty`.
- **Lightning.** `bolts: { bright: true }` strikes white-hot over the coloured glow; the `shock` preset crackles with
  it.
- **Moments.** `puff.is` is `smoke`, `dust`, `splash`, `flash` (an impact: a starburst and speed lines), `strike`
  (lightning from the sky onto the spot), `sparks` or `fireworks`, with `color?` and `shake?`.
- **Shake.** `{ shake: k | { k, for? } }` shakes the camera, decaying; it is added around each draw, so no camera keeps
  it.

### Stats

- **A stat is felt through the phenomena it scales.** `play.stats` declares holders (a character, or `game`) and
  their stats. Strength appears nowhere in the world: a hit just lands harder. Where a phenomenon takes a number
  (`hurt.by`, `heal.by`, `explode.scale`, `status.for`, `shake.k`, `puff.shake`, `walk.speed`), a scaling
  `{ stat, of?, base?, per?, min?, max? }` reads it live. A scaling may read a stat, a resource, `level`, `xp`, `epoch`
  or a tech node's rank.
- **Levels, resources and buying.** A level track (`start`, `max`, xp thresholds as a list or `{ base, growth }`)
  gives auto raises and stat currency on every level (`each`) and at named levels (`at`). Resources (points, gold)
  are balances on the bus. `{ buy: id }` is one atomic transaction: when the requirements are met, the rank is not
  at max and the holder can afford it, the cost is deducted, the gives apply and `bought` fires. Otherwise nothing
  changes and `denied` fires, saying why.
- **Epochs and tech trees.** Epochs are ordered bundles over levels (hatchery, lair, hive). A holder reaches one by
  level, by buying it, or both. Tech nodes have ranks with cost growth, require levels, epochs (that epoch or a later
  one), other nodes' ranks or stats, and carry subtrees that open at the parent's rank. Cues hear `levelled`,
  `bought`, `denied`, `epoch` and `opened`, and fire `raise`, `grant`, `xp`, `level` and `buy`.
- **Formulas.** A number may be a formula: a term `{ stat, of?, base?, per? }`, or `{ sum, mul, curve, min, max }`
  nesting terms. `of: 'target'` reads the stats of whoever the phenomenon lands on, which covers defence and level
  gaps. Holders may start with their own values (`{ id: 'ogre', stats: { armor: 100 } }`). There are three curves:
  `{ mitigate: k }` is the armor curve `k / (k + v)`, a factor that never reaches zero; `{ soft: at, slope }` is a
  soft cap; and `sqrt`. Expression strings are never accepted.
- **Modifier layers.** The effective stat is (base + Σ add) × (1 + Σ pct) × Π mul, held to its min and max.
  `<holder>.<stat>` is the effective value; raises move `<holder>.<stat>.base`. `{ buff: { id, mods, for? } }` and
  `{ unbuff: id }` add and remove modifiers. A status may carry `mods`: they come off when the status is lifted, when
  its time runs out, or when its cue ends.
- **Derived stats.** `{ id, from: formula }` follows the stats it reads; it is never raised, and a cycle is refused.
  `bodies: { hpMax, speed }` binds a stat to each holder character's body. When hpMax rises, hp gains the
  difference.
- **A third kernel, only when used.** `playscape/stats/kernel.js` runs on the node side and on the page from one
  source. It drains its own intents from the bus's `ctrl` queue and resolves the scalings on the cast's intents.
  The bus is unchanged, and a world without `play.stats` emits no new bytes.

### Explosions

- **Blasts as functions.** `{ explode: { who | at, is, color?, scale? } }` sets one off at a character's feet or a place.
  An explosion is parts: a `flash`, a `fireball` that billows out and stops, `smoke` that rises and lingers, `debris`,
  `sparks`, a `shock` ring along the ground, a `shell` of air round the middle, a `scorch` left on the ground, a `comic`
  black-edged white starburst, a mushroom's `stem`, an `implode` ring closing in first, a light and a shake; `count`,
  `spread` and `stagger` chain it. Values first: a white flash, a coloured fire, dark smoke, an ink burst.
- **Presets.** `pop`, `blast`, `mushroom`, `comic`, `chain`, `implode`; `play.explosions` designs your own, and a
  beam's `impact` may name one.
- **Sprays slow and change colour.** A spray takes `drag` (it slows and stops) and `ramp` (colours over a particle's
  life), and a shell's spray may go inward.

### Beams

- **Attacks as functions.** `{ beam: { who, to, is } }` fires an attack from a character's hand at a character or a
  place. An attack is strands, each one closed form in time: a `ray` (it grows to the target, holds, and its tail runs
  after it) or a `bolt` (a body and a head that fly), shaped by `speed`, `width`, `length`, `head`, `taper`, `pulse`,
  and a path: `arc`, `bow` (each copy curves out its own way and lands on the target), `wave` (a slither the body
  follows), `twist` (strands braiding round the line). `count`, `stagger` and `vary` make a barrage. Layers: a
  `charge` (an orb gathering at the hand or over the head), `rings` along a ray, `sparks` at a head, an `impact` (a puff
  kind) and a `shake`. `edge: ink` draws a black edge round a white core, so attacks read in black and white first.
- **Presets.** `orb`, `serpent`, `ray`, `nova`, `barrage`, `braid`, `laser`; `play.beams` designs your own.
- **Struck.** When a beam reaches a character, `struck` fires (`{ struck: who }`), so a cue can hurt, mark or puff.

### Looks in Godot

- **The pack carries the looks.** A world whose cues put on statuses ships them in `score.looks`, and kernel 0.6.0
  draws them: `Looks.wear(node, name)` lays the coat on every mesh as a `material_overlay` and drives its shape, waves
  and drift run as billboards from the same closed forms, and `Looks.transit(node, kind, dir)` plays a transit as an
  animation clip. Cues do not travel, so the ledger says nothing wears a look until a script calls it.

### Places

- **Box bodies.** `body.collide: { box: [hx, hy, hz?] }` is an axis-aligned box of those half sizes round the body's
  position, as a mesh box is placed. A round collide is a disc on the ground (a 4 m gate made of one blocked 2 m of
  road); a box blocks its whole width. Walkers and the cast slide along it; it holds, and two boxes don't shove each
  other. Eggs behave as before.
- **Stand points.** A doorway gives a place on each side, named by the room it stands in (`doorway-nave-crypt@nave`);
  a door gives `<id>@front` and `<id>@back`. Each is 0.75 m off the sill, the door's own use-point reach, facing the
  opening, so a walk, a spawn or a cue can send someone to a door without walking them into its frame.
- **Zones that watch anyone.** `near`, `enter` and `leave` take `who` (`{ anchor | at, r, who: 'guard' }`): the zone
  fires for that character (a glob) instead of the player.
- **Laws.** `stuck-retry` (a cue on `stuck` that sends the same walk again, not `once`, loops every second) and
  `round-collide` (a heavy body with a round collide wider than 1.5 m blocks a disc; a box blocks a wall).

### Interaction

- **An interact key.** The pilot scheme gains `interact` (E; the pad's west face, X / □ / Y; the left grip in VR),
  live only in a new `reach` context: while the figure stands somewhere usable, E interacts and doesn't strafe;
  anywhere else E strafes as it did. The pause legend lists it in worlds that have somewhere to use.
- **Places you use.** A cue's `when: { use: '<place>' }` (a spot or an anchor, or `{ anchor, r }` / `{ at, r }`),
  with an optional `prompt` word, makes the place usable: standing in it is reach, the page shows the live key and
  the word ("E  talk", "X  talk" on a pad), and the press sends `use-<place>` to the bus. What the cue opened closes
  when the figure walks off. `use` naming no place keeps its meaning (the `use-<id>` event alone, a door's click).
  The page carries this only when a world has a usable place.
- **Menus read the menu scheme.** The menu overlay takes its keys from the `menu` scheme (arrows or W / S, Enter or
  Space or the interact key, Esc) and now answers the gamepad (D-pad or stick, confirm and cancel where the pad's
  layout puts them, so a Nintendo pad confirms with A on the right). While a menu is up the figure takes no input at
  all: a key held as it opened, the pad and the mouse look all wait.

### World events

- **The bus and the characters talk both ways.** Nothing a character did reached the event bus but standing in a zone,
  and the bus could do nothing to a character but warp it. A bus verb `{ do: 'ctrl', op, … }` queues an intent that
  `syncToCtrl` hands to the character world (`cast`), and the character world reports what happened to it (`facts`):
  `down` (it fell), `gone`, `spawned`, `arrive` (at a point of its walk, by name) and `stuck`. The page carries the two
  lines only when the world uses them; every other world emits what it did.
- **Cues reach the cast.** `play.cues` and menu choices take the new happenings (`when: { down | gone | spawned |
  stuck: '<who>' }`, `{ arrive: '<who>' | { who, at } }`) and effects:
  - `spawn` wakes a character minted asleep (`dormant: true`) or sent away, where it's told (`at`, `face`), revived.
    The cast stays fixed at build, so a world replays the same;
  - `vanish` sends one away; `kill`, `hurt { by }` and `heal` act on its `body.hp`, and a killed plain body lies down;
  - `walk { who, to: [places], speed?, then: stay | loop | back }` is a dumb path: straight lines, ground snap, the
    world's collider boxes push it out, no pathfinding. A second without progress is `stuck` and drops the walk.
    `stop` ends one.
- **Spots.** `play.spots: [{ id, at, face?, pose? }]` are action points: where someone stands to do a thing. A walk
  that ends on a spot takes its facing and its pose (recorded; figures don't draw poses yet). Spots are places like a
  map's anchors: a cue's zone, a walk's points, a spawn's place.
- **Bodies keep their space.** `body.collide` eggs pushed only `platform` bodies; `walk` bodies and anyone walking a
  path are pushed now too (on the ground plane), so the walker and the cast don't pass through each other.
  `body.heavy` holds still. Laws: `cast-known` (an effect names someone the world doesn't have), `cast-places` (a
  place it doesn't carry), `spawn-asleep` (a spawn of someone already up and never sent away).

### Aura poses

- Not yet on the hero door or in exports: the library and its tests only.
- Standing showcase poses (`polygonizer/hero-aura.js`): `heroAura(name, R, { body, seconds })` returns the performance
  clip from the stand to the held pose (`clip.fn(t)`), its keys, the held pose, the face track (the anime channels per
  beat), the beats and the checks. `auraBody(R, mesh, skin)` gives the body the hands rest on: each bone's surface as a
  radial profile of the skinned mesh, and the face's landmarks from the head's own parts.
- The poses, each right-handed with a `<name>Left` mirror, in four families:
  - aura: `hairToss`, `ojouLaugh`, `fistCrush`, `crossedArms`, `heroHips`, `niceGuy`, `pocketsCool`, `glassesPush`,
    `fingerGuns`, `fistToSky`, `peaceWink`;
  - jojo: `dioBack`, `jotaroPoint`, `killerQueen`, `josuke`, `giorno`, `josephPoint`, `jonathanArch`;
  - squad: `sentaiRoll`, `henshin`, `ginyu`, `recoome`;
  - meme: `tPose`.
- A pose is design words per beat, never keyed angle by angle:
  - the feet and the weight (`FOOTINGS`, from `together` to `crane`);
  - the trunk (turn, chest, bend, curl, hinge);
  - the look and the head;
  - each hand placed at a body landmark (on its surface) or aimed from the shoulder, with the part of the hand that
    goes there, its shape (`SHAPES`: the rig's hand words, plus `flat`, `vee`, `thumb`, `claw`, `gun`, `pinch`,
    `cup`), the way the palm faces and the fingers point, and the elbow's bend.

  The solver sinks the hips until the legs reach. It carries the core over the feet, turns the neck and head to the
  look, then reaches each arm with the wrist turned to its words and the hand's own point brought onto its goal.
- The performance: a foot that moves between beats steps, with the weight over the other foot. Where a transition
  would pass a hand or forearm through the body, a via key carries that arm round the front of it.
- Checks:
  - the balance (one foot is an area, not a line);
  - the legs' reach and the knees;
  - each hand on its goal and turned within its aim;
  - no hand or forearm inside the body, with a resting hand excused only against what it rests on, to a resting depth;
  - the forearms clear of each other;
  - the gaze;
  - over the clip: the planted toes, the fastest hand, and the clearance through every transition.

  `hero-aura.deep.test.js` sweeps every pose and its mirror on both anime casts.
- `render-motion.mjs --auras name,…` draws the performance.

### Free run

- Not yet on the hero door or in exports: the library and its tests only.
- Clearing a low box out of the run (`polygonizer/hero-vault.js`): `heroVault(name, R, { h, d, w, from, seconds })` returns
  the clip in place (`fn(t)`, keys at 30 per second), its root track (`root.y`, `root.z`: the engine carries the
  character along it), the entry (the gait's phase, the take-off foot, the take-off distance to the near face), the
  exit (the phase it hands back to, the landing past the far face), the flights, the beats, the box and its checks.
- The moves, each from either foot (`<name>Left` takes off from the right): `hurdle` (a thin bar), `stepVault` (a hand
  and a foot on the top, out of the jog), `speedVault` (a rail, out of the sprint), `kongVault` (a table, out of the
  sprint).
- A clip is a route of contact states between two of the gait's own frames: the take-off foot's touchdown and the
  landing foot's toe-off, so the run plays into it and out of it with nothing to blend.
  - The flights are ballistic: the centre of mass flies a parabola under g; the take-off speed follows.
  - Where it takes off is solved from where the hands land on the top; the hurdle's air time is the least that clears.
  - Each support state's height is solved between clearing the box and the held hands reaching their points.
- `freeRun(state, obstacle, R)` picks the move for a box from the frame the runner is in (`{ gait, phase }`): the band
  (the box's height as a share of the hip height, its depth, the gait), the take-off foot and the stretch of the next
  footfalls (within ±20 %) that puts the take-off toe on its spot. A box under the swing's clearance is `stride`; one
  out of every band, or too near, returns `move: null` and why.
- Rig: `seatL` / `seatR` carry one free leg past the hip's swivel cone (`seat` for that leg alone). Absent, nothing
  changes.
- Checks: the ends on the gait's frames; clear of the box by 3 cm; feet and hands hold; the floor; the take-off under
  3.2 m/s up; the landing a foot past the far face; knees and hips in range; the fastest limb under 1.5× the gait's
  own; the clearance lift off the parabolas under 8 cm. `hero-vault.deep.test.js` sweeps every move across its band,
  from each foot, on both anime casts.
- `render-motion.mjs --vaults name:h:d[:gait]` draws the box passing under the figure.

### Rise and sit

- Not yet on the hero door or in exports: the library and its tests only.
- Getting up out of every rest pose, and sitting or lying down into it (`polygonizer/hero-rise.js`):
  `heroRise(rest, R, { down, seconds })` returns the clip (`fn(t)`, keys at 30 per second), its states and their
  times, its beats, the rest's props and its checks.
- A clip is a route of contact states timed in seconds. The words flow through the states; the contacts are re-solved
  every frame:
  - a planted foot holds its spot;
  - a stepping foot is lifted on a min-jerk arc; one carried a long way swings round beside the body while it is up;
  - a held hand keeps its hold, its arm solved step by step from the last so it never flips;
  - the sit bones keep the seat;
  - the body is lifted off the floor by whatever of it would go through.
- From a chair or a couch, by the phases of sit-to-stand: sit up off the backrest, scoot forward, draw the feet back,
  flex forward and leave the seat, the transfer, extend.
  - The flexion at seat-off is solved: the least for which the body's momentum carries its centre of mass over the
    feet (the extrapolated centre of mass, x + v / ω₀).
  - The hands push off the thighs, the couch seat or an armrest.
  - Sitting down plays the states back, slower; a lounge is let down onto the backrest on the arms.
- From the floor: uncross into a knees-up sit, lean over the right knee, the left leg comes under onto its knee (a deep
  half kneel), the back knee lifts on tucked toes, push over the front foot, the back foot steps up.
- From lying: sit up off the back or the side, propped on the hands, into the knees-up sit, then the floor route. A
  knocked-out body gets up slower.
- Knocked down (`knockedOut`, `yamcha` with `down`): the knees buckle, then the body falls about its feet as a rod
  under gravity (θ'' = 3g / 2L · sin θ), lands, and the limbs settle.
- Checks:
  - the ends equal the rest pose and the stand;
  - nothing through the floor or the seat; planted feet hold;
  - balance: the extrapolated centre of mass inside what bears the body (feet, sit bones and thighs on a seat, knees,
    bearing hands), out of it no longer than a step takes (0.3 s);
  - the knees and hips in range;
  - no joint faster than 4 m/s outside a fall; in a fall, under half again the rod's own tip speed.
- `hero-rest.js` exports the seat, sit-bone, turn, flesh and flat-hand helpers it already had; `hero-jump.js` exports
  its monotone curve. Neither changes what it returns.
- `render-motion.mjs --rise <rest>[Down]` draws a clip with its seat.

### At rest

- Not yet on the hero door or in exports: the library and its tests only.
- Sitting and lying, solved from what the body rests on (`polygonizer/hero-rest.js`): `heroRest(name, R)` returns the
  held pose, its seat drawn as boxes, the face it wears and its checks.
- Seated: the sit bones placed on the seat. A pose that rests its back reclines the whole trunk about the hips
  (bisected) until the upper back meets the backrest. A planted foot is turned back flat against the recline.
- Feet reach their contacts by the rig's leg solve:
  - flat under the knees, out ahead, or crossed at the ankles;
  - tucked in a cross-legged sit (the knees out by the foot's turn);
  - flat by the seat with the knee up;
  - folded flat on the floor.
- A leg that isn't planted is searched over the rig's own hip and knee words.
- Hands rest on the thighs, the lap, the knees, an armrest, along a backrest, on the floor behind, or with a forearm
  over a raised knee. A hand on the floor is laid flat (its wrist searched).
- Lying: the body turned onto its back or side and let down until its lowest flesh meets the floor. The limbs are
  laid on the floor; a knocked-out body rests every limb.
- Poses (`RESTS`): `chairUpright`, `chairSlouch` (slid forward, rounded, leaning on the back), `couchSit`,
  `couchLounge`, `crossLegged`, `lotus`, `kneeUp`, `lieBack`, `lieSide`, `knockedOut`, and `yamcha` (curled on the
  side in a crater).
- Seats (`SEATS`): a chair at popliteal height (about a quarter of the stature), a couch (lower, deeper and reclined
  further, the body by its right armrest), and the floor.
- Checks: every contact held, nothing through the floor, the knees and hips in range, an upright sitter balanced over
  its sit bones and feet, and a limp body resting each limb.
- Effort counts only what the body holds up itself: none lying; the arms only when the back rests on a backrest.
- The lotus is approximate on this rig (`approx: 'lotus'`). The hip turns out 45° and the leg solve bends the knee
  toward a level pole, so each foot rests into the other shin rather than up on the thigh.
- `render-motion.mjs --rest <pose>` draws a pose with its seat.

### Carrying

- Not yet on the hero door or in exports: the library and its tests only.
- Holding things in a mode, solved from the thing (`polygonizer/hero-carry.js`): `heroHold(name, R, { kg, regime })`
  places the thing by what the mode is for, then closes each hand on its station with hero-grip's arm solve.
  `heroCarry(item, mode, R, { hands })` picks the hold.
- Things (`CARRIED`): pistol, carbine, shotgun, lmg, box, suitcase, lantern, sack (generic proxies with true sizes,
  masses and stations: grips, a support hand's handguard and magazine, a butt, a sight line, a rest point), and the
  sword and greatsword from gear. Mass is a word.
- Holds (`HOLDS`), relax and aim, one hand, two hands and dual:
  - Relax: hung from a straight arm under gravity, out until it clears the thigh (pistol, suitcase, lantern, the
    trail carry of a long gun at its balance, the lmg by its handle, a sword); low ready; hugged (box, pulled in as
    the effort rises); rested (a sack on the shoulder, a greatsword's point planted before the feet).
  - Aim: a long gun's cheek weld (the butt in the shoulder pocket, the sight line from the dominant eye to the
    mark, the neck, head and the butt's place in the pocket solved together, and the support hand kept in reach); a
    pistol's sights on the eye's line at the arms' reach (isosceles, one hand); two pistols pointed at the mark; a
    lantern held out.
  - A support hand slides along its handguard and turns round it to where the wrist sits easiest, and grips the
    magazine when its arm cannot hold the handguard; a rested thing spins about its length the same way.
- Perceived effort (`effortOf`): the static moments at each shoulder, elbow and wrist and at the low back, from the
  arms' own segments (de Leva) and the thing's weight shared between its supports by the lever rule, over adult
  strengths scaled by body mass (female upper limb about 0.6 of male), read as Borg CR10 (10 × %MVC) and as
  Rohmert's endurance time.
- The body answers the effort: a hold eases the thing in toward the trunk; the trunk bends back or aside, and the
  ankles take the rest, so the body and the load stand where the body alone stood (an aim leans into the gun, never
  back); the free arm swings out against a one-sided load; the knees soften by the load's share of body mass; relax
  keeps the hold whose effort plus its style cost is least. The weightless regime perceives none of it.
- Checks per hold: hands on stations, wrists in their anatomical range (how far past the functional range each
  strays is reported), humerus, arms clear of the trunk, the thing clear of the body (touching only where it rests),
  aim (eye on the sight line, the line on the mark, the butt in the pocket), balance, and the load held.
- Every hold passes on both anime casts (`hero-carry.deep.test.js`).
- `render-motion.mjs --carry <hold>[:kg][~]` draws a hold with the thing in hand.
- `heroStance` takes stance words as well as a name. `holdArm` takes `range` and `clear` weights (defaults are the
  guards' own). `hero-grip` exports `landmark`, `mountOf`, `stationsOf`, `withTrunk` and `liteOf`. Output is
  unchanged when none of these are used.

### Action faces

- The anime hero's face acting an action (`polygonizer/hero-face-action.js`). `actionFace(action, { seed })` takes a
  solved strike, jump, roll or guard and returns a face sequence on the face tracks' 30-fps grid, in the four
  expression channels, timed to the action's own beats (load, contact, follow; take-off, apex, touch-down, kick;
  a roll's start and end; a guard's arms closing and set).
- Each family has a few samples: strikes kiai, grit, focus, cocky and flinch; jumps effort, joy and startle; rolls
  tuck and brave; guards resolve, calm, smirk and fire. The seed picks one, weighted by the action's intensity (a
  cross shouts more often than a jab, a lunge holds a fencer's stillness, a weightless guard smirks), and shifts
  each drawing's frame and channels within the sample's ranges. `after` makes the previous take's sample a quarter
  as likely.
- Timing rules: the set face leads the load; the shout or clench starts a frame or two before the contact so it is on
  screen at it; a jump's hup lands on the take-off and its lids squash on the touch-down; no eye shuts from a
  strike's load to the end of its follow; blinks come after. Drawings hold at least two frames, eyes are drawn only at
  their knots with their in-betweens, a one-shot ends back on the authored face and a guard on its held one.
  `preroll` reports how many frames the face wanted to lead the clip's first frame.
- `actionFaceTrack(take)` gives the take as face-track keys (half a frame early, the weights in the hero's targets).
  Nothing calls it yet: no clip or export changes.

### Sword holding

- Sword guards solved from the sword (`polygonizer/hero-grip.js`). A guard names the sword's frame in the target's
  frame: where the grip sits (a landmark of the posed body), where the point aims (a mark on an opponent of the
  figure's own size, or a direction) and which way the edge faces. Each hand then closes on its station of the grip
  with gear's own hold, the arm reaches the wrist and the wrist turns the rest of the way.
- Twelve guards, each with its exact mirror (`chudanLeft`, …):
  - Skilled two-hand: `chudan`, `jodan`, `hasso`, `gedan`, `waki`.
  - Skilled one-hand: `terza`, `hanging`.
  - Dual: `niten`.
  - Sword and shield: `shield`.
  - Weightless (the anime holds): `challenge`, `reverse`, `trailing`.
- `GRIPS` sets the blade's angle off the hand's long axis: `hammer` (45°, gear's own hold) and `handshake` (25°, the
  hilt rolled toward the heel of the palm), each with a reverse.
- The arm's elbow swivel is solved by Levenberg–Marquardt from several seeds, weighing the wrist against the elbow.
- Wrists are read against an anatomical forearm frame (the elbow's flexion plane), not the rig's shortest-arc
  forearm. They must stay inside the anatomical range; skilled guards must also stay inside the functional range
  daily tasks use.
- The upper arm's turn about its own axis (read from the elbow's flexion plane) stays within a shoulder's ±90°, so an
  elbow never folds backward.
- The upper arm and forearm stay clear of the trunk: a third of the shoulder span plus an arm's radius. A guard can
  set its own trunk (`trunk: { turn, lean, bow }` on its stance's spine); waki turns and bows toward the sword with
  its back elbow lifted out.
- A strapped shield is held in the hand, its wrist locked by the straps.
- Checks per guard: hands on the hilt, wrist range, point, edge, the blade's clearance of the body, balance with the
  sword's mass, and (skilled only) the sword's lever on each holding shoulder.
- `render-motion.mjs --guards` draws the held sword and shield on the card.
- `hero-stance` exports `hull` and `margin`, and `reachArm` takes an optional `pole`. `mirrored()` now swaps
  `fingers<S>`. Output is unchanged when none of these are used.

### Ready stances

- Straight strikes out of the stances (`polygonizer/hero-strike.js`): `jab` and `cross` from `guard`, `thrust` (a
  fencer's lunge) from `fencing`, each with its exact mirror (`jabLeft`, …). A strike is design words (the hand, its
  reach, how far the hips and chest turn, the weight at contact, the rear foot's pivot, a lunge, the other hand's
  counter, the timing) solved from principles: the hand's contact point on the target line at its shoulder's height,
  reached along a straight path; a body-led strike drives up the chain (the weight, then the hips, then the chest, each
  peaking and braking as the next takes over, the hand alone fastest into contact), a hand-led one extends the arm first
  and lunges after; the weight moves toward the lead foot over the planted feet (a new rig channel, `shift`: the core
  carried over the floor, absent ⇒ byte-identical); a small load the other way first; the eyes on the target; the guard
  hand riding the chest, a counter swinging in joint space. One-shot clips from the stance's held pose back to it, with
  checks (the hand on its point, the path's straightness, the chain's order, balance, planted feet, the elbow at
  contact). The motion card draws them (`render-motion.mjs --strikes`). Not yet on the hero door or in exports.
- Hard limbs: the structured core's limbs bend at their joints and nowhere else. Each bone's rings are rigid on it; a
  joint's blend eases in only within about a limb's radius of the joint (`bind.zone`, metres, on the thigh, shin, upper
  arm and forearm: the refine pass and the shaping rings ease by the rings' distance from the joint's ring instead of
  spreading linearly over the span), where it ran up to 23 cm into the bone and bowed a bent arm or leg like a hose.
  The hip, knee and elbow each have a FOLD bone (`hipFold<S>`, `kneeFold<S>`, `elbowFold<S>`: station-loft-rig.js
  `folds`) carrying the rings at the joint, turned half the bend (the mitre of the two tubes; the hip's half the
  thigh's turn off the pelvis) and pushed to the bend's convex side by the mitre's own growth (at most 0.6 of the limb's
  radius), so a crouch's knees and a guard's elbows keep their volume instead of folding flat, and a turned-out thigh
  comes out of the hip instead of standing in the pelvis like a tube. Six more joints in the skinned export (57); the
  streamlined core is unchanged.
- Ready stances for the main actions (`polygonizer/hero-stance.js`), sorted by where the feet stand and so how the body
  faces: SQUARE (`athletic`, `low`, `centre`: the body facing the target) and BLADED (`guard`, `fencing`, `hitting`: side
  on), each bladed or staggered stance with its exact mirror (`guardLeft`, …). A stance is design words (the feet's
  spread and line, each toe's turn, the sink, the lean, the weight between the feet, the hands' places in the target's
  frame) solved from principles: the body's facing follows from the feet, squared to the foot line only as far as each
  hip can keep its knee over its toes; the centre of mass is set over the feet at the weight asked; the neck and head
  turn the eyes back to the target; each arm reaches its hand's place with the elbow down. Each stance gives its held
  pose, an enter clip from the stand (the feet stepping into place one at a time, the body turning over them) and its
  checks (balance margin, knees over toes, hip turnout, gaze, reach). The rig takes two new pose channels, `facing` (the
  body turned over planted feet) and `splay<S>` (a planted foot turned on its ball, its knee with it); absent, every
  pose and export is byte-identical (a planted leg under a `facing` reads its bones from its own solve). Not yet on the hero door or in exports. The motion card draws them
  (`render-motion.mjs --stances`, with `--views front,side,top`).

### Character rig presets

- `motion` on the hero door (`hero.motion: { walk?, jog?, sprint? }`, each `true` or the gait's own dials plus `tilt`
  and `seconds`): locomotion that travels instead of walking in place. The jog leans 10° and runs soft; the sprint
  leans 18° with effort (knee drive, heel tuck, a right-angled arm pump, a long stride, more flight). `tilt` leans the
  body from the hips with the spine straight and the gaze held ahead. Each gait is the vajra stick figure's walk or run
  baked on the hero's own rig (`polygonizer/hero-motion.js`): every toe on the gait's path, on the floor through its
  stance and sliding back at one constant speed, the swing clearing the floor, the trailing heel rising at push-off and
  the root sinking to reach a long stride along ONE smooth curve planned over the whole cycle (its first four
  harmonics, never below any phase's need), so the head bobs and never drops in a frame as a foot lands — no shake for a
  camera on the head. A gait replaces the hero's clip of its name (the stock walk, four
  keys in place) as a 24-key clip carrying its ground speed `v`. Unknown gaits and dials refuse by name; absent,
  every hero and export is byte-identical. Documented in the layered manual (THE MOTION).
- Jumps on the hero door's `motion` (`polygonizer/hero-jump.js`): `jump`, `jumpForward`, `jumpBack`, `doubleJump` and
  `runningJump` (a hurdler's leap between sprint strides, its planted feet sliding at the hero's sprint speed), each
  `true` or `{ seconds }`. One-shot clips in place (the engine flies the arc), timed key poses on smooth monotone
  curves (no stop at a key), the planted feet blending into the air pose at take-off and touch-down without a pop, a
  directional jump's feet landing ahead (or behind) and the body rolling over them; a toe touches the floor only once its
  blend from the swing is whole, so no foot skates at touch-down. Each carries its `air` timing
  (take-off, touch-down, apex, the designed height; a double jump's kick and second apex): the packed clip's `once` and
  `air`, the GLB animation's `extras['moj:jump']`, the engine score's `locomotion.jumps`.
- Rolls on the hero door's `motion`: `rollForward` (the combat roll over the right shoulder, the head never on the floor)
  and `rollSide` (a tucked barrel roll to the right), and their exact mirrors `rollForwardLeft` and `rollSideLeft`, each
  `true` or `{ seconds }`. The rig takes a whole-body turn
  (`body: { roll, pitch, at, up }`; each bone's frame is the upright solve's turned by it, so a head or a hand is never
  spun by a shortest arc), the roll set down so its lowest part rests on the floor along a smooth envelope, the turn
  waiting for the feet to leave. Each carries its `roll` ground (axis, side, start, end, travel, speed): the packed clip's `roll`,
  the GLB's `extras['moj:roll']`, the engine score's `locomotion.rolls`.
- Stops on the hero door's `motion`: `walkStop`, `jogStop` and `sprintStop`, each `true` or `{ seconds }`, play when
  forward is let go. The game halts the character on the spot; the clip shows the momentum it had. Starting from the
  gait's own frame, the swinging foot sets down as a brake, the trunk pitches past the feet with the arms swinging
  forward, the trailing foot steps up beside it, and the trunk recoils just past upright onto the stand. The feet never
  slide, and the lurch grows with the gait's speed. Each bakes two clips, one per braking foot (`jogStop`,
  `jogStopLeft`), each carrying its `stop` (the gait it leaves, the lead, the gait phase it starts at) so an engine
  picks the one nearest the cycle: the packed clip's `stop`, the GLB's `extras['moj:stop']`, the engine score's
  `locomotion.stops`.
- Anime hands at adult size: the anime casts' hands were about 25–35 % short and 40 % narrow for the figure (a critic
  reading the proportions sheet, and two blind judges preferring the change on the heroine and the tough). They now
  keep an adult hand's share of the height (wrist to fingertip about 0.10 on the female, 0.105 on the male) through the
  cast's `hands` (1.2), and a broader palm through a new `handWidth` (1.17 female, 1.25 male: the palm's width, the
  knuckles' spread and the digits' width across, their depth by its root). The feet are unchanged. Every anime hero's
  mesh moves at the hand; its pins are re-pinned.
- Ribbons, bows and streamers: a `ribbon` adornment signature, a cloth strand tessellated as the anime hair's sections
  are (a sheet of columns across, an outer and an inner face, a `ridge` or `flute`, a `taper`, a `twist`, its end cut
  `square`, to a `point` or into a `swallow` tail). Any signature takes a `rigidity`: its elements then flow, each hung on a
  strand from where it is tied (`root`, carried on the part), swinging with the stride, the stop and the wind like the
  hair (`polygonizer/hero-flow.js`). Without it every adornment is as it was.
- The shoulders rise with the arms: the structured core has a SHOULDER GIRDLE, a collarbone each side from the shoulder
  line to the shoulder, that lifts with a raised arm (past 30° of raise a third of the further raise, at most 25°: the
  scapulohumeral rhythm), the arm carried up with it in its own direction. The arm's cap and the chest's skin at the side
  of the shoulder ride it, so an arm overhead takes the top of the shoulder with it instead of leaving the chest's
  square corner beside it. The chest takes its roll from where the shoulders sat, so one arm raised never rolls it.
  Garment rings now carry the body's own slot weights (the shoulder's over the collarbone, a pectoral's), so the cloth
  bends as the skin under it. The skinned export has two more joints; structured pins re-pinned.
- The hips bend as one piece: on the structured core the pelvis bone now TIPS with the hip hinge (a `pelvisTilt`
  reference the vajra carries with the pelvis, never with the spine), so the basin, the waistband and the belt go over
  the thighs with the trunk instead of staying upright under it (the waist opened a gap, a shelf at the back, whenever
  the figure bent at the hips: a lean, a stop, a jump's load). A skirt's cloth below the seat now hangs from both
  thighs evenly instead of the pelvis, so the tipping pelvis never swings it into the legs. Every hinged pose of a
  structured hero moves; their pins are re-pinned. The streamlined core is as it was.
- What flows, on control strings (`polygonizer/hero-flow.js`, a spike: not yet on the door's bake or in the exports).
  RIGIDITY (`polygonizer/rigidity.js`), the garment canon's long-named fourth axis, is now a word: `shell` (locked, the
  default), `stiff`, `crisp`, `soft`, `flowing`, or 0 … 1. A garment piece takes it (`rigidity` on a garment, or an
  outfit build's `language.bottom.rigidity` for a skirt); it rides the part and leaves the mesh as it was. Each
  section of the anime hair carries its own (the back soft, the fringe stiff, the ahoge springy). What flows hangs on
  strings: a STRAND (one chain: a hair section from the skull) or a CURTAIN (a chain every 22.5° round a hanging edge,
  neighbours coupled: a skirt). Each joint is pulled toward where the piece's own skin would carry it (a skirt still
  follows the legs) and swings with inertia, gravity as its carrier tilts, and the air (the world's seeded gust field,
  `vegetation/wind.js`, less the body's own motion: a sprint streams it back, a stop throws it forward). Everything
  locked (the body and its shell pieces) is one COLLISION FORM of tapered capsules; what flows stays out of it, leaving
  a limb on its own side (a leg sweeping through a skirt does not catch it), and above the floor. The rig's `flow`
  channel places a string joint in its carrier's frame (absent ⇒ the rig as it was). The motion card takes `--hair`,
  `--flow <part>=<rigidity>` and `--wind speed,dir,gust`.
- Elbows down (`polygonizer/hero-elbow.js`): in every gait and jump a raised, bent arm rolls at the shoulder so the
  forearm folds up with the elbow beneath it, never sideways across the chest; the roll follows the raise smoothly and
  leaves hanging and back-swung arms alone.
- `locomotionCameraCurve` (hero-motion.js): a hero gait's first-person bob in the shape the World walk reads
  (`walk.bob`, as gait-camera.js bakes from the stick figure), read off that hero's own baked gait.
- The rig's leg solve takes `feet` (a toe target per leg) and `sink` (the root lowered, metres) as pose channels, and
  `packLayeredRig` a key count per function clip and `speeds` (the packed clip's `v`); absent, as before.
- Exports carry the ground speed engine-neutrally: the skinned GLB's animation `extras['moj:speed']` and the engine
  score's `locomotion.walkSpeed` (engine metres a second). The Godot kernel (0.6.0) and the Unity kernel play the
  player's walk at planar speed ÷ walkSpeed (clamped ¼ … 3×), so its planted feet stay put; the Godot probe's dump
  prints the rate.
- `docs/examples/humanoid/MOTION.md`: the motion loop, what good motion looks like, the motion critic and the blind
  judge. `render-motion.mjs` beside it: the motion card — a hero's clips (its own, its `motion` gaits, or any vajra
  motion spec) posed on the skinned mesh from the side, the three-quarter and the rear three-quarter gameplay camera
  with the stick figure and a foot trace, an eight-phase strip, and the measures (stance, planted slide, stride, lift,
  ground speed, bob).

### Handedness

- The still camera is right-handed. The pinhole projector behind every SVG still and the CSS-3D scene
  (`resolveCameraBasis`, `cameraMatrixFromWorldFraming`, `projectWorldToScreen`) read right = up × forward, which
  put the world's left on screen-right: every still was the mirror image of the same scene in the three.js World and
  in every engine export, and the wire still (already right-handed) disagreed with the filled one. Right is now
  forward × up. The figure and animal stills negated screen-x to undo the mirror; that negation is gone, so their
  stills read as before, and the figure's study views (head, top, under), which negated x over a camera that was
  already right-handed, stop mirroring.
- A house is built the way round its plan reads. A floor plan is authored as the plan card draws it — x east, y south,
  N the y0 wall — and its (x, y) went straight into the z-up world, where north is +y: every house, restaurant, store
  and mall in the World, the GLB, USDZ, STL and 3MF and the Godot, Unity, Unreal and Blender legs was the mirror image
  of its plan (the mirrored stills hid it). Each floorplan-family assembler now hands its payload through one reflection
  on the way out (`planToWorld`, `polygonizer/floorplan-world.js`): corners and normals reflect with their winding
  turned, per-corner arrays follow, an explicit `uv` mirrors in u so textures read true, a CSS clip is re-measured,
  and cameras, the walk spawn and yaw, pot lights, the manifest light, stamped repeats and item refs move with them.
  Plan logic (wall and facing letters, layouts, furnishing, the plan card) is untouched; a `ref` item is placed
  true-handed at its world facing. The IFC4 model reflects the same way (`ifc.js`: boxes, slabs, roof planes, gables,
  members, walls, gutters), its local frames built right-handed from the reflected points. The default house cameras
  stand off the plan's south side, so the aerial reads as the plan card, north up. A floorplan-family manifest's
  `walk` is no longer replaced, after the kind framed it, by the raw manifest value (which dropped the eye height and
  walker radius and would have put the spawn back in the plan). Re-pinned: the floorplan, restaurant, store and mall
  rows of `world-scene.kinds` (their geometry moved); `floorplan-world.test.js` pins the laws.
- The turntable's World is the CSS scene, not its mirror: CSS space (x right, y down, z toward the viewer) is
  left-handed, and its rotation into the world flipped the lit side. It maps as [-x, z, -y], winding reversed.
- The `walk` rule turns the way its keys say. Its tank turn added the turn axis to the heading, and the heading
  climbs counter-clockwise from above, so D turned the walker left and A right; `platform` and `drive` already
  negated it. A is a left turn now, D a right one. Re-pinned: the controllable rows of `emit-channels.char` (the
  rule ships in the page) and the walk world's golden trace.

### Anime game hero

- `genki` on the anime hero door (`hero.genki`, 0 … 1): the shonen spirit translated onto the character as one
  amount over the look and the own layer. Broader shoulders, a narrower waist and stronger forearms and calves; on the
  male bigger, rounder eyes, on the female a narrower opening; a heavier, lower brow set into a V; more taper and crown
  in the hair; the brow set, the mouth more open and the smile wider; the stand on a wider base, chest and chin up.
  Ratios compose as ratio^amount and offsets scale with it, so 0.5 is halfway; absent or 0 changes nothing and stores
  nothing. Dress, adornment, gear and clips fit the body it makes. Documented in the layered manual (GENKI) and the
  create-hero catalyst; `anime-genki.test.js` covers the zero law, the layer laws, the door and a dressed mint.
- The worked lead (`docs/examples/humanoid/cast/lead.json`) has a matured face: bigger eyes (width ×1.12, height ×1.2,
  the opening ×1.15) and a long jaw narrowing to a small square chin (the lower face ×1.19, the chin ×0.62, the jaw
  corner raised), measured against front-facing shonen references.

### Blender film

- A world camera shot goes to Blender as a real camera. `forge_motion` with `export: 'blender'` (turntable,
  orbit, push-in, dolly-zoom, flythrough over a world) writes the GIF preview plus a Blender film pack in the
  motion's folder: the world's Blender pack, `shot.json` (the exact per-frame cameras the preview was rendered
  from), and three scripts. `film_shots.py` keys a camera per shot, aimed at a target empty, with a timeline
  marker per shot so several shots cut; `film_light.py` lights it (below); `film_render.py` renders a resumable
  PNG sequence and cuts the MP4 in Blender's own sequencer, as an EEVEE draft or a Cycles final. A traversal is
  refused: it is an input script, not a camera path.
- `scripts/export-blender-film.mjs --motion mo_a [--motion mo_b …] [--render draft|final]` does it in one go
  for any world motion, cutting several shots of one world into one film. A re-run keeps `film.blend`'s lights
  and art and replaces only the cameras. The film workspace lives under `$MOJULO_HOME/films/`; an output folder
  inside a git working tree is refused, so renders never land in a checkout.
- The film is lit as the recipe declared it. `atmosphere.json` carries the world's sky preset, each street lamp's
  intensity, the fog's look and the water surfaces the pack leaves out, from the same unshaded resolve the pack
  reads; `film_light.py` performs them: a sky and sun per preset (day, dawn/dusk, a night sky with a faint moon,
  interior), mojulo's lamps (already in `model.glb` as point lights) at street-lamp power, a ground fog that glows
  in its own colour like mojulo's, and the water as a rippled reflective mesh. The draft render turns on EEVEE
  ray tracing for reflections. Light once: a scene with the operator's own light (mojulo's imported lamps aside)
  is left alone, and a placed rig is kept unless `--force`. The fog's defaults are one shared `FOG_DEFAULTS`; the
  fog shader is byte-identical.
- Machine gate: `film_shots.py --verify` reads every keyed frame back against `shot.json` (position, aim, FOV)
  into `film-gate.json`. Eyes gate: `--check` renders Workbench stills to hold against the GIF.
- Manual: the `blender-film` motion-vocab card. `renderWorldMotion` now returns the cameras it rendered from,
  through one shared `worldMotionCameras`; the frames are unchanged.

### Giza exhibit

- Old Kingdom Giza is now an exhibit of its monuments rather than a full level: the three pyramid
  complexes with their temples and causeways, the queens' and satellite pyramids, the boat pits, and the
  Sphinx in its quarry with its temple, on the plateau above the floodplain.
  - Left out: the mastaba cemeteries, the Wall of the Crow and the workers' town, the bakeries, the
    building sites, the main quarry and the ships. Their assets are gone from the kit.
  - Views: valley, pyramid, harbour and summit (cemetery, town and works are gone).
  - The page is about 5 MB, down from about 14 MB, and builds in about a third of the time.
- The plateau and the floodplain now have ground under them. A misplaced comment had swallowed the step
  that starts each run of flat ground, so only the escarpment and the squares round each view were drawn.
  The squares round a view now sit on their own layers so the de-overlap pass does not stack them on the runs.

### Every new house a different draw

- **A new house is minted with its own seed, varied layouts and composed furniture.** `mint_building` (and
  `create_sketch` for a floorplan) stamps three knobs onto a new house when they are absent, beside the `style:
  'auto'` it already stamps: a `seed` (drawn from the ref when one is named, else at random), `layout: 'varied'` and
  `furnishing: 'composed'`. The draw is written into the recipe, so a minted house renders the same every time and
  any knob given explicitly wins. Rows minted before this keep their bytes.
- **`layout: 'varied'` rearranges rooms by seed.** Each room's arrangement is keyed on the house seed as well as
  the room's place, and each room draws a layout variant and a mirror, and turns a quarter where its shape allows. A
  living room may face the media wall, seat two sofas facing across the coffee table, or keep one armchair beside an
  off-centre sofa. A bedroom may centre its bed between two nightstands. A deep dining room runs its table the long
  way. The door, stair and window passes still clear every layout. Absent the knob, layouts are unchanged.
- **Fix: `furnishing: 'composed'` was refused at mint.** The house validator only knew `'constructed'`.
- **A new house draws its own program, size and storeys.** A new generated house (no `rooms`, `levels` or
  `storeys` given) now draws, from its seed, a tier and its program (`tier: { base, beds, study, core }`: a one- or
  two-bedroom cottage, a two- to four-bedroom house, a villa of up to five, with or without a study and a separate
  dining room), one or two storeys (`levels`, with a stair), and a footprint sized to that program. It is built by
  the program generator, so every house has its bedrooms, bathrooms and one kitchen (the single-floor generator
  could draw a house with no bedroom and two kitchens). A new house also gets windows and a front door, and a porch,
  a stoop or neither, weighted by its style. Every draw is an ordinary knob in the stored recipe; any knob given
  explicitly wins, and `program: false` keeps the single-floor generator.
- **`tier` names a base.** `tier: { base: 'villa', beds: 5 }` overrides a named tier; an override object without
  `base` merges over `'house'` as before. A bad tier is refused at mint, naming what is valid.

### Quiet floors

- **The house floor is muted.** The floorboards were saturated mid-brown with dark seams every 6 inches, so every room
  read as stripes. The plank tints of each house style moved halfway to a warm grey of their own lightness (each
  family keeps its character: brick and mission stay the darker woods). The seams are now a hairline a shade under
  the plank (0.9 of it, was 0.62) on 7.2-inch boards (were 6). Wet-room marble seams are softer (0.93, was 0.88).
  This is an emission change: every furnished house and every store, restaurant and mall floor moves. The store,
  room and World characterization pins are re-pinned with the reason beside them.

### Furniture grammar

- **Composed houses: `furnishing: 'composed'`.** Each furnished room's sofa, easy chairs, dining chairs, tables and
  casework become composed pieces in the house style's furniture language
  ([lib/graph/furnishings/languages.js](lib/graph/furnishings/languages.js)): per style, the styles a role may take,
  and the legs, cloths and timbers its pieces wear. A cottage gets roll-arm sofas, turned legs and linen; a brick
  house chesterfields and club chairs in velvet and tweed; a modern one tapered and hairpin legs and bouclé. Each room
  picks per role, seeded by the house, the room and the role: every chair round one table is the same chair, one
  house keeps one timber, a plain cloth takes the house palette's colour, and re-rolling the seed refurnishes. Each
  piece's group names the style that landed (`asset:composed-furniture:chesterfield-main`). A media console keeps
  its television and a nightstand its lamp. `furnitureLanguage` overrides the house style's language. `furniture:
  { <role>: { like?, forms?, finish? } | 'omit' }` sets a role in every room, and a room's own `furniture` wins. A
  bad language or override is refused once per house, naming what is valid. Beds, rugs, lamps and the kitchen run
  keep their meshes. Absent the opt-in, every house is byte-identical. Cost: a composed living room is about 1.1 s to
  build the first time (39 ms cached) and about 3.4× the faces of a mesh room.

- **A piece is a kind, a form in each slot, a finish and a size**
  ([lib/graph/furnishings/forms.js](lib/graph/furnishings/forms.js)), the way a bug is a bauplan.
  - Kinds are `sofa`, `chair`, `table` and `casework`, over the workbench builds.
  - Slots are arms (`track`, `rolled`, `tuxedo`, `rolled-high`, `none`), back (`loose`, `tight`, `tufted`),
    seat (`loose`, `bench`), legs (`block`, `tapered`, `turned`, `bun`, `hairpin`) and the casework front
    (`open`, `doors`, `doors-over-drawer`, `drawers`, `two-drawers`).
  - A finish is fabric, timber, wood finish, tint, board, paint and piping, checked against what each kind wears.
- **Styles are worked pieces over the same grammar.** The eleven room facades are the first; the chesterfield is a sofa
  with high rolled arms, a tufted back and one bench seat, in velvet. Composed ones join them: tuxedo, English
  roll-arm, mid-century sofa, armless settee, club chair, farmhouse table, mid-century table, turned side chair,
  painted dresser.
- **`resolveFurniture({ like, kind, forms, finish, size, palette })` locks a piece.** It starts from a style, swaps in
  the forms and finish asked for, reports them (`worn`), and refuses an unknown style, slot, form or finish by naming
  the valid ones. The lock is the build's resolved dials, cloth, tint, legs and size, so a locked piece re-renders
  identically however the forms and styles are retuned. `lockedFurnitureFaces` draws it at its own size, never
  stretched.
- **Leg forms are drawn over the square blank the build cuts**, so the members, joints and cut list stay the blank's.
  A turned leg keeps a square pommel, and a chair's back leg is turned only to its rails. A hairpin leg stands on a
  mounting plate and a glide.
- **`mint_solid({ kind: 'furniture', spec: { like?, piece?, forms?, finish?, size?, buildable? } })`** composes and
  locks a piece for furnishing houses. By default it is a display asset (`furnishings/asset.js`): a workbench row whose
  `build: { type: 'furniture', piece, dials, legs?, size, fabric?, tint? }` is drawn the way a room draws its furniture
  (no joints, pulls on, legs shaped), filled to its size exactly, and flagged `buildable: false`, with no construction
  report or cut list. It places in a house as `rooms[i].items: [{ ref }]` and travels into an assembly by ref.
  `update_sketch` restyles it in place (`/build/dials/<dial>`, `/build/legs`, `/build/fabric`, `/build/size`).
  `buildable: true` stores the jointed build instead, one workbench frame the furniture report, manual and bill of
  materials read, and notes any axis the build held to its own proportions (a sofa's back runs 680–1000 mm). The
  result names the style it started from and what was swapped. The card is `get_solid_vocab({ id: 'furniture' })`;
  a test holds it to every kind, slot, form, finish key and style.
- **A frame's `legs`** (block, tapered, turned, bun, hairpin) draws a build's legs in that form on the workbench too
  (`construction/legs.js`); an unknown form is refused naming the forms.
- **Roster rows name the style that composes them** (`style`), so a room slot can lock a recipe in a piece's place.
- **The room facades are now derived from the styles.** A characterization pin covers every facade recipe at three
  footprints, plain and in a house palette, and the room and condo hashes hold: no house changes.

### Furnishings roster

- **One row per piece of room furniture** ([lib/graph/furnishings/roster.js](lib/graph/furnishings/roster.js)).
  A piece used to answer to up to five spellings across the arranger types, box-net presets and nets, the
  share-mode meshes and the constructed stand-ins (the bookshelf was `bookshelf`, `bookcase` and
  `constructed-bookcase`). Each row now gives the piece one id, a label, a role (what a room asks for: `sofa`,
  `desk`, `bookcase`…), the words people say for it, and its handles into those tables. The roster names; the
  tables still measure, and no builder reads the roster yet, so every house is byte-identical.
- **`resolveFurnishing(word)`**, the animals' rule: "a Couch", "bookshelves", "TV stand" and "credenza" each resolve
  to one piece. The name index throws when one word would name two pieces.
- **The contract** (`roster.test.js`): every key of every furniture table, and every type and mesh an arranger
  emits, belongs to exactly one row; `SHARE_ASSETS` and `CONSTRUCTED_FOR` agree with the rows; a row missing a
  line fails with the line it needs. It found `l-table` in the wall-hugging set with no preset, band or net
  behind it (it is only a mesh).

### Fabricator shelf and naming

- **The shelf reaches metal, sheet and extrusion work:**
  - Rivet nuts thread sheet.
  - Thumb screws go into tapped metal or rivet nuts.
  - Hardened pins locate metal parts; tabs and slots locate sheet parts.
  - Profile linear rails slide.
  - A die-cast box or an extrusion frame with panels encloses.
  - Hanging bins on a louvred panel store.
  - Steel square tube or a timber frame carries the loads.
  - Countersunk screws mount to a plain surface.
  - A heat-set joint takes a heavy load reached from one side.
  - Hardwood runners slide a drawer too short for a stock slide.

  Of the 1530 probe needs, 1283 now resolve from the shelf (84 %, up from 1148), 146 from a known principle, and 101
  remain gaps. Most of those are `print-only` needs that rightly cannot print a bought part. The rest are a 3 mm shaft
  at 300 N, a 25 mm shaft, a board with no hole pattern and a heavy printed frame. The coverage test now holds the
  shelf above 80 %.
- **Provenance review packet** ([docs/fabricator-provenance.md](../docs/fabricator-provenance.md)): the tiers as the
  code enforces them, every row that names someone else's product, the identifiers that still carry a trade name
  (`mj_gt2_pulley`, `nyloc-*` codes, the hardware labels' "Pozidriv"), and the questions for counsel. No lawyer has
  reviewed it. A test keeps the packet's table in step with the inventory.
- **Generic names on the bill of materials:**
  - A printed part is named by its generic row (a "2 mm pitch timing pulley", not the library module's name), with
    the call as its code.
  - The chipboard screw's buy text says "cross-recess (PZ)".
  - The generic-name test also checks for GT2, Pozidriv and Nyloc.
- **The vehicle family layer is no longer called the "meta-fabricator"** in what agents read (the `vehicle` card, the
  mint_solid drawer, the modeler lingo, the vehicle-family catalyst), so it is not confused with `fabricate_solid`. The
  module file keeps its name.
- **`--help` names the command you typed:** `node scripts/mcp-stdio.mjs` in a checkout, `npx -y mojulo@<version>`
  through npx. The CLI's usage errors and its unknown-tool and unknown-pack messages do the same.

### Fabricator placement and re-plan

A plan now follows the object after mint, and writes its own cuts where a need says where. Every existing kind builds
byte-identically. A scad row that never calls `fab_cuts` is never touched.

- **Placement** (`lib/graph/fabricator/place.js`). A need may name:
  - `at`: the points it happens at.
  - `axis`: the way the cut runs.
  - `parts`: which source part takes each side (`{ into, head, hub }`, or `part`).

  Its scad cuts are then written as an OpenSCAD block of `fab_cuts(part)` and `fab_adds(part)` between marker lines,
  placed at the top of the source when the source calls them. A two-part joint's pilot sits at the mating plane, and
  its counterbore enters the head part from its outer face. A pin's slip hole and the second magnet run the other way
  into the other part. Each point may turn its own way.

  A cut whose geometry needs more than a point (a nut trap's far face, a seal along a rim), and a cut with too few
  points or an unnamed part, is listed in `placement.manual` with the reason. Nothing is guessed.
- **Re-plan in place:**
  - `fabricate_solid({ ref })` plans a stored row again from its stored needs. With `needs` it plans the row with the
    new ones.
  - The plan, a scad row's placement block, and a frames row's recounted fittings replace what was stored.
  - `changes` names each need whose strategy or size moved, and each bill-of-materials line added, removed or recounted.
  - A scad or frames row minted without a plan takes one the same way, which is what the scad ladder's `add: 'fabricate'`
    asks for.
  - A mint onto a taken ref is refused, and the refusal points at the re-plan.
- **A stale list is said.** A BOM export of a scad row whose source no longer calls a planned cut warns, and says to
  re-plan, in both the result and `bom.md`.

### Fabricator sizing

A fabricated part is now the smallest stock size that holds its load, not the size its load class names. The rigidity
sensor's own checks pick it, and the bill of materials exports for whoever buys and builds. Every existing kind builds
byte-identically. A stored plan is frozen with its version (`fabricator-v0.3.0`), so a minted row keeps its sizes.

- **Sized by strength** (`lib/graph/fabricator/sizing.js`; plans are now `fabricator-v0.5.0`):
  - Bolts: tension, shear, thread stripping and heat-set pull-out (`strength/checks.js` `bolt`).
  - Bearings: the slimmest whose typical static rating carries its share, and its basic life when `rpm` is said.
  - Steppers: by usable torque.
  - Printed gears: by Lewis tooth bending.

  The safety factor asked is the sensor's own, by how certain the load is (`certainty`). New need fields: `loadDir`,
  `loadKind`, `certainty`, `material`, `grade`, `torqueNm`, `rpm`, `hours`. Each sized need carries `sizing` (size,
  weakest mode, safety factor, the one asked, whether the load was assumed). A sized bolt line carries its `grade`.
- **Honest failures.** No stock size holding passes the strategy over, and `refused` says why, so a heavy joint gets a
  stronger strategy or a from-scratch design, never an undersized part. An unsaid load is assumed at 20 N, and `next`
  says which needs assumed it. A given `size` is checked, never replaced, and `next` says when it is too weak.
- **What changes in new plans:** a 300 N shaft on two bearings now takes the slim 688 (150 N each, safety factor near
  4) where the load class took the 608. Four lid screws sharing 300 N stay M3 where the class took M5. A 3 kN pull on
  one heat-set insert takes M8. Shelf coverage of the probe needs moved from 1157 to 1148 of 1530 with sizing alone: loads
  no stock part holds resolve from scratch, as they should (the shelf work above then raised it).
- **`export_model({ ref, format: 'bom' })`** writes `bom.csv` (RFC 4180, one row per line) and `bom.md` (buy, print,
  cut, tools, notices) beside the model. It reads a fabricated row's frozen plan (a frames row's fittings are recounted
  from its stored frames, the same report the mint read) or any furniture workbench row's fittings and sheet cut list.
  A row with nothing to buy is not eligible, and says how to get a list. A fabricated mint names the call in
  `stats.fabrication.export`.

### Level graph

A level is a graph of sections, and its layout is a behaviour of the graph. Trails already composed into levels by
each naming the one it follows; this step writes the whole level down in one place, so a level can be read, laid out
and documented as one thing. Nothing a section builds changes.

- **The graph** (`lib/graph/level/graph.js`, `readLevel`). Nodes are sections (`trail` or `meru`, each its own recipe
  less `id` and `after`, with its own `kit` and `seed` or the level's); edges are the joins (`seam` so far). One node
  is the root, node 0: the origin of the level's frame, whatever kind of place it is (the first node listed unless
  `root` names one). Where the player starts is a separate concern: `spawn` is a node and a place on it, the root's
  entry unless it says otherwise. An unknown word is refused with the ones it knows.
- **The sequential layout** (`level/sequential.js`, `layLevel`). It reads the graph as one walk from the root (a path,
  however it twists in 3D; edges may be left out and the nodes read in the order listed) and compiles it to the
  `after` chain the sections already follow: one stage recipe a section, in walking order. A trail then a meru
  builds the pages the hand-written chain builds, byte for byte. A meru on another kit follows its trail in the
  trail's own look. What it does not lay out yet is refused by name: a branch, a section after a meru, two trails in
  a row in different looks.

### Mountain levelling

A level where the walk goes up: a stack of tiers joined by connectors, apart from buildings and from indoors or
outdoors. It is built on the meru, the vertical ruler every two-point picture already stands on. This step makes the
place and its guide; what joins the tiers is playscape's to answer.

- **The meru is its own primitive** (`lib/graph/polygonizer/meru.js`). `meruStack` is the storey stack that was
  inside the house builder: levels of their own heights, a slab between, below and above the ground. `houseMeru` is
  now that ruler over the floorplan defaults, and builds byte-identically. `meruMarks` carries named heights up one
  axis, as the landmark towers are drawn: a base, a deck, an apex.
- **A stairs site says its way on.** A trail's stairs site anchor now carries `N` (the way on, as a beat's does) and
  its two ends on the walk (`from`, `to`), so what answers it does not assume the trail runs along +y.
- **A local meru from a recipe** (`lib/graph/local-meru/plan.js`). The base unit is a mound, a stairway spiralling
  round it, and a watchtower on the summit. A recipe sets the mound (height, foot, summit, profile), the path (width,
  turns, hand, approach, edge), the going and the tower; an unknown word is refused with the ones it knows. With
  `after: { kit, seed, trail }` it is laid on from the end of an isekai trail: from the seam, on the trail's line,
  heading and height. The risers share the whole rise evenly, at most ten to a flight, and the landings between
  flights are as long as the turns ask. The level's meru names every tier (seam, landings, summit, deck, rail, eave,
  apex), and its mandala gives the radius at every height. It builds no faces and no connectors. It asks for them as
  anchors: a stairs site for every flight (its way on, its ends, its going and the curve it lies on), a climb site up
  the tower with the link it prefers, and the landings, the summit and the deck as tiers. Playscape answers them.
- **The level's laws.** The steps' laws are the man-made index's own. The level adds its own: every riser within the
  walker's step, landings long enough to stand on, the turns asked for, shelves that never stack, a railed edge where
  a fall would hurt, the tower and a walk round it inside the summit, a climb of one pull, the tower seen from the
  seam, the mound past the seam, and the seam met. They advise; none refuses.
- **The premap** (`lib/graph/local-meru/premap.js`): the level as a guide before it is built, in black and white, the
  landform board's sibling. It has four panels and two tables: the plan (the trail it follows, the seam, the mound's
  rings, the spiral with a tick at every riser, the tower and its climb), a half-section through the meru (named
  heights and the radius at each), the heartbeat (from the followed trail's start, over the seam, round the spiral
  and up the climb), a two-point massing drawn through `projectTwoPoint` with a level camera, the laws, and the
  anchors playscape answers.
- **A local meru, built: `meru` on an isekai stage** (`lib/graph/local-meru/scene.js`). A stage recipe with a `meru`
  builds the level in the isekai look, on the page after the trail it follows (`after` reads the stage's kit and seed
  unless it names others). The ground is laid on that trail's own grid, so its last row is the trail's last row at
  the seam, and it eases to level. The mound rises from it, cliff where steep and grass where not, drawn by the isekai
  builder's rules. The walk runs on a shelf round the flank, held up by a rock wall. The watchtower is timber: posts,
  bracing, a deck, a rail open where the climb arrives, and a roof. A stand-in ladder stands on the climb until
  playscape's ladder is placed there. A flight is walked as the slope its shelf lays, as a trail's stairs site is.
  The payload carries the anchors, the level's laws and cameras from the seam, from wide, at the climb and from the
  deck. On a kit that is not isekai it is refused; a stage without `meru` builds as before.
- **A World's walk can climb** (`scene/channels/walk.js`, opt-in `walk.climbs`). A climb is a foot, a lip, the way
  in and a width. Facing it at its foot, W climbs and S comes down. At the lip the walker steps onto what is behind
  it, and walking out over the lip from up there takes the climb down. A local meru's climb anchors become its
  climbs. A walk without climbs emits the same script as before.
- **A level is a stack of tiers** (`local-meru/plan.js`). Each tier stands on the top of the one below and says
  how the walk gets up it. There are two forms: a `mound` (a plan of `sides`, 0 round or 3 and more a polygon,
  narrowing from its foot to its summit) and a `tower`. There are three ways up: a `spiral` round the flank, a
  `stair` straight up one face (cut into it, or standing out from it), and a `climb`. Every tier faces the way the
  walk arrives on the one below, and a tower with a tier on it is left open, with no roof. The laws are per tier and
  per way up, and add two: each tier fits on the top below it, and a stair starts on what it climbs from. The older
  one-mound, one-tower words still read.
- **Presets are tier lists** (`local-meru/presets.js`, `preset`): a mountain lookout, a terraced mountain, a
  ziggurat, a temple pyramid and a stacked lookout. None needs code of its own.
- **What people build takes the kit's made style** (era/out-made.js `madeStyle`). The kit's chunk sizes the tower's
  members, its edge word makes a stair stone or timber, its paint share decides whether a roof is painted, and every
  made colour is locked to the kit's made ramps (timber, stone, paint).
- **The level is walked in a test** (`local-meru.walk.test.js`). A headless walker follows the World's own rules
  (gravity, the floor ray, the eye and shin rays, the climb). Steered along the spiral from the seam, it reaches the
  summit at walking pace; it climbs the tower to the deck and back down; without the climb the deck is out of reach;
  and walked straight at the flank from all round, it never reaches the summit, because a shelf's wall stops a
  scramble from below. Every preset is walked and climbed from the seam to its top. The World's walk has no slope limit of its own, so steep rock can be scrambled up to that wall.

### Playscape

The first step toward Playscape, which makes a scapeshifted world playable on a ladder of four rungs: click demos,
walk demos, a single level, a game of levels. This step starts its encyclopedia: the game idioms on a shelf of their
own, the laws a game object is judged by, and the first entry, the door, where what a thing does is kept apart from
what it looks like. No tool is added; `get_game_vocab` gains a family.

- **The game idioms have cards.** `get_game_vocab({ scope: 'idiom' })` and `semantic_search({ kinds: ['game_idiom'] })`
  return an `idiom-guide` and an `idiom-<kind>` card per idiom, generated from an about row kept beside each idiom
  function (`IDIOM_ABOUT` in `lib/graph/worlds/game-idioms.js`). Each card lowers its own example and prints the
  event-bus rows it becomes, so it cannot drift; an idiom without an about row fails the shelf's test. Each idiom is
  tagged with the lowest rung it serves (`click`, `walk`, `level`, `game`). A migration adds the `game_idiom` kind.
- **One lowering map.** `IDIOM_LOWERING` and `lowerIdioms()` in `game-idioms.js` replace the action world's private
  map, which now also takes `banner`, `legend` and `toast` in `idioms` (before, only raw `events.hud` rows reached them).
- **Object laws.** `lib/graph/playscape/objects/` judges a game object the way the hero is judged: the build is
  measured and read against bands, with advice per law, never a refusal (`objectMeasures`, `objectAdvice`). The laws
  (`objects/laws.js`): inverse interest (the more a thing matters, the more distinct its silhouette segments, counted
  as notches that open onto the outline at play distance in the era's 640×448 frame), 33/66 (the primary detail a
  third of the main mass and wider than the eye spot), emboss (the rest of the mass shaded in by value), values only
  (greys on `obj:*` groups, colour left to a tone), the detail a band apart from the mass under 3, 4 and 5 hard steps,
  the accent kept for what can be used, and juxtaposition (a placement law). One interest rank (filler, prop,
  interactable, focus) sets the bands.
- **The door entry: what it does apart from what it looks like.** `objects/mechanism.js` moves leaves on three joints
  (hinge, slide, lift); the door's five variants are rows over it: `single`, `double`, `sliding-single`,
  `sliding-double` and `portcullis`. Fitted to an opening (a doorway anchor sizes it) at any t from closed to open, a
  door answers for itself: its collider at t, the space its leaves sweep (a level keeps it clear: the swing in front,
  the wall pocket, the headroom), the width and height a walker gets through, and where it is used from (both sides of
  the handle, or a control beside a portcullis). Its look is a skin worn on top (`greybox`, `plank`), drawn on the
  closed leaf and carried by the joint. Its rules are built from the idioms: a use opens it; locked, it waits for its
  unlock event (a key's pickup), then for a use (a sequence, since reactions carry no guard). `ejectObject` freezes
  the variant, skin and numbers. The entry's card is generated from the variants and measured off the mechanism
  (`lib/graph/playscape/entries.js`); it is served once a recipe can place a door.
- **Drives: what moves an entry's t.** `objects/drive.js`: a `clock` (back and forth or round a loop over a period),
  a `ride` (standing on it sends it to the far end; it waits `dwell` seconds empty, then comes home), a `call` (a use at
  a stop sends it there) and a `rule` (a bus var; the door's `<id>-open`). Stepped by dt, so a timeline replays exactly.
- **The platform entry, called by its surface area.** `objects/platform.js`: `area` is the walkable deck top in square
  metres (`aspect` shapes it), and reads to a player as a rest, a step, a tight landing or too small. Variants
  `static`, `shuttle` and `rail` (round if it loops, else back and forth, by distance at one pace). It answers for its
  deck and collider at t, the space it sweeps and the headroom a rider needs over it all along, and lowers to the
  platformer world: a still deck is a floor face and a collider, a moving one a `mover` carrier with a visible box
  body (moving platforms rendered nothing before). Its `island` skin (a lighter deck over a keel of rock) holds every
  object law at every area: a still island hangs one keel point, a moving one two tiers.
- **The lift entry, vertical traversal.** `objects/lift.js`: a platform's deck carried between stops at `speed` metres
  a second. Two stops ride; more are called. It answers for its shaft (from under the lowest stop to a rider's
  headroom over the highest: a level leaves it open), its landings (board, and a step off to either side, at every
  stop), and its ride time and dwell. A called lift runs as a ride between its ends until calls reach the runtime.
- **Movers run rails and ride drives.** The `mover` rule (`worlds/controllable/rules-basic.js`) takes a `path` of
  points (by distance; `loop`, `mode: 'loop'`) and `drive: 'ride'` (`speed`, `dwell`); the carry pass marks a
  ride-driven carrier `_ridden` while a rider stands on it, still or moving. A mover with neither runs as before (the
  controllable-world trace pins hold).
- **The catapult entry: a launcher tuned by the approach.** `objects/catapult.js` stays put and throws the player:
  `fixed` (one arc; give a `target` and it solves the power), `redirect` (keeps the run-up's speed along the pad) and
  `bounce` (returns the fall, so a higher drop goes higher). Tunable `power`, `angle`, `gain`, `cap`, `restitution`, a
  `cone` of approaches, `reload`. Its arc is stepped with the platform rule's own integrator (rise and fall gravity,
  fall cap), so a solved target is where the world lands the rider; it answers for the arc, apex, landing, the tube
  the rider flies through and how far steering can move the landing. The rider steers in the air by default;
  `locked` holds the arc until it lands, for a scenic route.
- **The `launcher` rule.** `worlds/controllable/rules-basic.js`: a `launch` world pass reads each rider's approach
  (its run across the ground, its fall) and throws it through the platform rule's own momentum (`vel` z and
  `dashVel`); a `launch-lock` pre-step takes a locked rider's stick until it lands. The platform rule's jump cut skips
  a thrown rider (`launchedBy`); without a launcher it runs as before. The pipeline-order pin and the emission pins
  re-pinned with notes.
- **Items keep their blocks.** `era/props.js` `obox` also records each box it builds into a face list made by
  `blockSink()` (its range of faces, value, group; the playscape skins tag the part); any other list gets the same
  panels as before. Every playscape entry resolves with its blocks; the door's ride its leaf's pose.
- **Cleave: the shaped cut.** `playscape/destruct/cleave.js` cuts an item's blocks by a pattern of convex cells into
  closed convex chunks (`polytope.js`, plane clipping), whatever the shape: `grid` dices (a lattice in the item's frame,
  each axis split evenly, a thin axis never cut), `voronoi` shatters (seeded sites, through the thickness on a thin
  axis). A chunk is a cell's pieces of every block, so a handle stays with its slab; cut faces are the inside, two
  emboss steps darker.
- **Dismantle: the concept cut.** `destruct/dismantle.js` reads joints off the geometry (blocks that touch) and anchors
  (the ground, or given boxes), severs parts, joints or all, and splits what no longer reaches an anchor into bodies
  that fall whole. Relief thinner than 2.4 cm rides the one block it touches most.
- **Collapse.** `destruct/collapse.js`: a seeded, stepped timeline per body: the spread (the lattice opening, a hold),
  then a passive fall or an explosion; rigid bodies land with impulses at their corners on the ground and on what
  still stands, and rest. They pass through each other (an engine's solver takes over on export).
- **Slicing interceptors: the cut while it happens.** `destruct/interceptors.js`, on scapeshift's interceptor contract
  (grown after, never colliding, never named; each kind a site finder, a grower and a 0 to 1 dial, seeded, its own
  `fx:*` group). The sites are the cleave's own: each cut face names its plane, and the score is where a plane meets
  the item's skin. `score` (the slice line drawn along the stroke), `blade` (a band sweeping the plane), `spark`,
  `glint` (a cut face flashing white as it opens, riding its chunk) and `dust` (in the opening gaps). A grid is drawn
  plane by plane, axis by axis; a shatter cracks out from the impact at `speed`, across the item and not through it.
  `cutAt` is when the last stroke is drawn: `collapse({ delay })` keeps the chunks whole until then. They are the
  cover-up for an engine's swap to pre-cut chunks; an engine that cannot play them drops them.
- **The cut is a style.** `CUT_STYLES` in `destruct/interceptors.js`, a setting like a tone: it picks the timing, the
  marks and how the pieces part, all in values on `fx:*` groups, so colour stays the tone's. `blade` (stroke by
  stroke, a radial spread), `laser` (one beam at a time from off the face, the score cooling behind it, a spray, the
  pieces barely parting), `anime` (the slash, the beat, every score at once with a flash, the halves slipping along
  the cut) and `impact` (a ring and a flash, fast cracks, chips and dust, a burst from the hit). New marks: `beam`,
  `ring`, `flash`, the crescent blade. A mark can be tuned (`marks`) or dialled per call. `collapse` takes per-body
  `spread.offsets`; cleave adds the `slice` pattern (one to three clean planes, or the planes given).
- **Destruction sounds as cues.** `destruct/sounds.js`: the cut and the collapse say when which cue fires, how loud
  and where (`{ t, cue, gain, mark, at }`), never audio itself. Each cut style names a cue per mark; `slicing()`
  returns `sounds`; `collapse()` records `hits` (landings by speed and mass) and its `parting`, and `collapseSounds()`
  turns them into thuds, clacks and a whoosh. `DESTRUCT_SFX` is a valid beats-sfx manifest defining every default
  cue; a call renames, re-gains or silences any mark (`sounds: { beam: 'my-laser', spark: false }`), and a world
  re-voices a cue by defining the same name in its `audio.cues`.
- **The bridge entry: a static platform from bank to bank.** `objects/bridge.js`, called by its ends (`from`, `to`,
  `width`) or `over` a trail's pit hazard anchor. Variants `plank`, `deck`, `rope` (it sags; a long one reads as a
  scramble) and `arch` (a humpback with end piers, its motif along the parapets). Each is built of the ELEMENTS a
  style guide names (planks, stringers, posts, rails, braces, footropes, handropes, lashings, ring, crown, keystone,
  spandrels, parapets, coping, abutments, piers), each turned off or tuned by name. It answers as a platform: its deck
  line, its crossing read (road, path, plank, beam; walk or scramble), bearings, clearance under, and the deck as floor
  faces and colliders with the rails as lines. The runs (rails, ropes, posts, dentils) shade the 66 and one middle-third
  part is the 33, so every variant holds the object laws from 3 to 10 m (a 2 m rope bridge and a 14 m arch still draw
  advice). Built of blocks: sever a rope bridge's footropes and its planks fall.
- **Object measures read roles.** A face's role is its part when the part names one, else its `obj:*` group, so an
  entry that names parts by element is judged; a silhouette notch must be 3 px each way (a rasterised sliver along the
  hull no longer counts). Existing entries measure as before. A notch must also be 3 px thick on average, so a sliver
  along a sloped edge (a long box and no depth) does not count either.
- **The bridge dressed by a kit, and held to the outdoor index's structural laws.** `dress` (a kit's tokens from
  `era/out-made.js` `madeStyle`) dresses a bridge without moving what it plays (its deck, colliders, rails and clearances
  are the plain bridge's): members chunkier or slighter in section (a post is never slighter than what it carries; a
  rope is a rope in every kit), posts capped (a grass hat, a round, a bevel, an open culm), every rail meeting a post
  joined as the kit joins (lashed, pegged, notched), the deck's fascia in the kit's relief, abutments and piers coursed
  (mortared, or laid dry), the fill worn to a spread of values, whole kinds of part painted. Dressing is the 66's
  texture: on `obj:fill`, no more than 3 mm proud, never darker than the fill's band, so a dressed bridge keeps the
  object laws wherever the plain one holds them. Two structural fixes from the index's laws: a deck's stringers deepen
  with the bay they span (bay ÷ depth ≤ 16; the abutments and piers bear at their underside), and an arch's parapet is a
  rail (0.86 m, its coping to 0.96). A value on a tone band's edge now measures in the band above it.
- **Links: where scapeshift meets playscape.** `playscape/links.js`. Scapeshift makes the place and marks where it
  asks to be joined (a trail's stairs site, a pit, a stream); playscape answers with a VERB (walk, climb, cross, ride,
  launch, hop, drop) and the entry that performs it. `riseLinks(from, to)` lists every way between two levels that
  fits the rise and the room on the ground (a hop is the walker's own jump, a drop only goes down), quickest first.
  `linkStyle(kit)` reads a scapeshift kit's made tokens (`era/out-made.js` `madeStyle`) as the words the entries take:
  its joinery picks a rope or a deck bridge and lashes or pegs a ladder, its edge word sets the outdoor steps' risers,
  and every part an entry builds names the swatch role the tone will paint it from. `answerAnchor(anchor, { kit })`
  answers a trail anchor in the kit's style: a stairs site gets a walk where one fits (the trail's own outdoor steps
  first) and a climb where none does; a pit or a stream gets a bridge in the kit's joinery, beside the hop or the
  ford it already is. Scapeshift imports nothing from playscape.
- **The ladder entry: a climb from one level to the next.** `objects/ladder.js`, called by its ends like a bridge
  (`to`, the lip; `from`, or a `rise` and a `facing`). Variants `ladder` (a lean ladder at 4:1, horns past the lip),
  `rungs` (a fixed ladder on brackets, grab bars, a cage past 6 m), `rope` (hung from a beam, wrapped where the hands
  close, a whipped tail) and `net` (a cargo net, climbed across as well as up). The kit's `timber` sets the rails'
  section and its `joint` the middle third's joints, the 33 (lashings, pegs, notches, collars). Its laws (rung pitch,
  width, 4:1, extension past the lip, cage, holds, clear, mesh, drape) come back in the man-made index's shape. Every
  variant holds the object laws and its own from 2 to 8 m.
- **The climb in the world runtime.** The `climb` body owner: a platform body takes hold of a `climbable` entity by
  walking into its face, by falling past it pressing toward it, or by walking off its lip toward it; forward climbs,
  strafe crosses a net, jump kicks off, the lip steps it off onto the level and the foot lets go. The climb owns the
  body (the rule and its gravity are suppressed); a hit or a drop lets go. The pipeline pin names `climb` after
  `drop`; the World page's runtime gained 80 lines and the emission pins re-pinned.
- **The stairs entry: a walk from one level to the next.** `objects/stairs.js`, called by its ends (it fits its going
  to the run between) or by a `rise` and a `facing` (it lays its own). Variants `flight` (closed risers between
  stringers, balusters under a rail past 0.6 m, newels, a landing every 16 risers), `steps` (outdoor steps cut into a
  bank, a staked board or a laid stone at each riser by the kit's `edge` word, a landing every 10) and `ramp` (a deck
  between kerbs under the walk's grade, cleats, trestles, a landing every 9 m). The going comes from the stride
  (2R + T); the outdoor steps are measured by the man-made index's own `steps` laws. It lowers to a floor face over a
  solid block under each tread, so the platform rule walks up it riser by riser. Judged side-on: every variant holds
  the object laws from 0.5 to 5 m (a ramp to 3.2 m: one with three landings draws one segment too many, and a 0.5 m
  stone stoop's pins run a hair over the third).
- **Breakable terrain: scapeshift gives the shape, playscape makes it break.** `playscape/terrain.js` takes either
  scapeshift's own boxes (`fromColliders(stage.colliders, 'wall:crypt')` picks colliders by their `of` and hands the
  rest back untouched) or a form asked of its library (`wall` in running bond, `pillar`, `crate`, `slab`), cuts them
  into axis-aligned blocks a hit takes one at a time, and draws each block's faces under its own `node`
  (`break:<id>`, as scapeshift's anchors do) for the page to hide. A block is standing (a collider: it blocks the walk,
  the sight, the shot and holds up whatever stands on it) or broken (gone from the colliders). The runtime keeps the
  state: `createWorld({ breakables })` puts each block in the colliders, and the new `break` world pass, after the
  projectiles, takes one hp per hit from this tick's records: a hitscan that stopped on a block, a burst whose splash
  reaches it, a swing whose reach and cone take it in (once a swing). Blocks have 1 hp while this is tested. A break
  leaves a seq-keyed record on `state.breaks`; `breakBlock(state, id)` breaks one by hand; `groundOf(colliders)`
  stands a walker on what still stands, so a broken slab drops it. `blockPieces` gives a broken block's shatter from
  the destruct primitives' cleave. The pipeline pin names `break` after `projectiles`; the World page's runtime gained
  117 lines with the gravity below and the emission pins re-pinned. The page does not yet hide a broken block or play
  its pieces.
- **Gravity for breakable terrain: what stacks, what falls.** A block stands while it is held: on the floor, on a
  collider that is not a block (scapeshift's own), or on a held block; a slab's tiles (`bond: 'lateral'`) are also
  held by each other, so a slab spans between its legs. Whenever a block breaks or lands the held set is worked out
  again, and a block no longer held falls (18 m/s²), still a collider, onto the highest top under it that is not
  falling, snapped so a stack lands stacked. A landing faster than 7 m/s (about 1.4 m) breaks the block and the
  block it lands on (`how: 'fall'`, `'crush'`). So a running-bond wall keeps a block while either block under it
  stands, a stack drops a block when its foot goes, and a crate on a slab falls through the hole a broken tile
  leaves. `spec.breakFloor`, `fallGravity` and `fallBreak` tune it; `FORM_BOND` and `ask.bond` set the bond.
- **The player: a hero from the hero door, driven in a world.** `playscape/player.js`: the move set adds what a hero
  lacks for the runtime's states (`PLAYER_CLIPS`: the jump's wind-up `squat` and its flight `leap`, in the door's pose
  words) and names which of its clips plays each state (`playerStates`: forward runs, idle idles relaxed, leap and boost
  hold the flight, turn walks); `playerWorld({ hero | heroRef })` is a controllable world with the hero as the pilot on
  the platform rule (W/S run, A/D turn, Space jump; a 4 m/s run, a hop of about a metre), a follow camera, a test
  course (hop-up blocks, a flight of stairs onto a terrace, a wall) and the controls as a `legend` idiom. The figures
  map takes a hero (world-scene.js): `figures.<name>.hero` (inline, as the door takes it) or `heroRef` (a stored
  layered hero) resolves through the layered kind to the packed rig every rig body plays, without the static solid or
  the preview, with `clips` naming the hero's clip for each runtime state (a name it lacks is refused by name). A
  world's `events` block that is HUD-only (a legend alone) now reaches the page; before, it needed a reaction or a
  sequence. The anime heroine (docs/examples/humanoid/cast/heroine.json) runs, idles, jumps and lands on the course on
  the World page.
- **Clips from an outside animation library, on mojulo's own rigs.** `figures/clip-library.js` reads a humanoid glTF
  library (its skin and clips) into HUB clips: each humanoid bone's world turn away from the library's bind T-pose, in
  the native frame (z up, facing +y), keyed by VRM name, and the hips' bob and sway as a share of the hip height
  (`hubClips`; `LIBRARY_MAPS` maps a library's joints, Quaternius's Universal Animation Library first). `retargetClip`
  composes each turn on the T-pose mold's rest → T offset (rig-tpose.js) and recomputes the heads down the rig's own
  tree, so the clip lands in the keys every rig body plays; a rig with fewer spine bones takes each bone's own turn.
  `scripts/import-clip-library.mjs` writes a hub from a library's file; Quaternius's free CC0 locomotion ships as one
  (`figures/library/quaternius-ual.js`: idle, walk, jog, sprint, the jump's start, loop and land, crouch idle and walk,
  a hit; 241 KB, loaded only by a world that names it). A hero in the figures map takes `library`, and a state's clip
  the hero lacks is retargeted from it (a clip not named `_Loop` plays once and holds). The player starts from the
  library (`LIBRARY_STATES`: the jog, the idle, the jump's start and loop), the hero's own clips and the move set's
  filling the gaps; `library: false` plays the hero's own. Against the library's own mannequin, the heroine's limbs
  point within 4.7° of its limbs on every frame of the walk, the jog and the jump; the whole residual is the library's
  shin, which leans 4.7° back in its bind pose where the mold stands the leg straight.

### Scapeshift

The first step toward Scapeshift, a scene-generation door that builds a place from a described scene by
orchestrating the existing tools. This step makes the sixth-gen stage findable; no tool is added or changed.

- **The stage, its kits and its looks have cards.** `get_view_vocab` and `semantic_search({ kinds: ['view_vocab'] })`
  now return a `stage` hub, a `stage/<kit>` card per stage kit and a `look/<reference>` card per sixth-gen reference,
  generated from the kit, style and reference cards at catalog load (`lib/graph/era/entries.js`), so they cannot drift.
  A kit card gives its shell, the look it pairs with, the options its style card carries (night, decay, wind, fire),
  its first principles and a starter manifest that plans. A look card gives its palette, light and air, and says when
  the kit it names is not built yet. Before this, the kit list lived only in the stage's refusal message.
- **Looks and kits are named for what they are, not for a game.** The five looks are `gothic-night`, `desert-dusk`,
  `island-noon`, `jungle-haze` and `lab-dark`, set as a stage recipe's `"reference"`; the plaza kit is `island-plaza`.
  No card names a game, studio or console: each describes its setting, light, air and surfaces, so the agent matches an
  ask ("a dark castle lit by torches", "a desert town at sunset") on its own. The reference cards in `era/sixth-gen.js`
  keep the research record. A recipe that already carries a reference card's own id or `delfino-plaza` still plans as
  before; the refusal lists only the look ids. A stage with no title is now titled by its look.
- **Every principle is counted.** `lib/graph/era/laws.js` maps each principle every style card states (its own, its
  night's, its decay's) to the shared laws it is an instance of, and each law to the layer that must carry it when the
  look leaves the stage: look (light, value, palette, air, sky), surface (density, materials, blends, cards),
  composition (focus, subject line, distinctness, causes) or dressing (a kit's own set pieces). The era card's own laws
  (baked vertex light, vertex and texel density, the readout frame, the cast over the world) are listed too. A style card
  that gains a principle without a mapping fails `laws.test.js`. A generated `sixth-gen-laws` card lists the laws by
  layer, and each kit card names the laws its principles state.
- **A look is a setting on any world.** `look: 'gothic-night'` (or `{ id, cell }`) on a world's manifest
  (`lib/graph/era/look.js`). A kind that resolves to raw albedo (the dungeon, the city, the controllable world, the
  object kinds) is resolved unshaded and re-lit by the stage's own bake: every large face is split to a cell (2 m by
  default, in metres whatever the world's unit) so the light has corners to land on, then baked with the look's
  ambient, its sun with cast shadows and ground bounce, and the world's own point lights as torches, their flames
  drawn. The page takes the look's fog and sky; an interior keeps its own sky and the look's fog behind. Any other
  kind takes the air and sky only and its payload says so (`lookNote`), as does a sunless look on a world that places
  no lights. Absent `look`, nothing changes. This lands the look laws baked-light, vertex-density, shade-is-colour,
  depth-by-air and sky-is-a-place; value order, palette, pixel lock and the surface laws are next.
- **A stage recipe paints its own tiles and sets its own proportions.** `tiles: { wall: { gen: 'stone-brick', stone,
  mortar, rows, cols, bevel, … } }` per surface (generators `stone-brick`, `flagstone`, `rock`), and
  `proportions: { column: { r, sides }, plinth: { h }, torch: { every }, … }`, each setting inside its rail
  (`lib/graph/era/tile-specs.js`); anything outside is refused with its range. A tile family is named from its own
  numbers and rebuilt from the recipe on every read, so it survives restarts and any number can be edited later with
  `update_sketch`; the kit keeps its value band per surface but the recipe's colour is the hue. Each room kit offers only
  the proportions it draws (`STAGE_KIT_PROPORTIONS`, measured: the plaza and the lab take `bay` only). A generated
  `stage-rails` card lists every setting and range, and each kit card names its surfaces and parts.
- **Two stage fixes.** `torch.every: 1` seated no torches (the seat rule was `k % every === 1`); it now seats one per
  pilaster, with the kits' own spacing unchanged. A sunlit kit (the plaza) given a look with no sun threw a TypeError; it
  now refuses with the looks that have one.
- **The laws are checked on every room stage.** `lib/graph/era/law-checks.js` reads value order (torchlit wall, open
  floor, vault, as baked colour × tile mean), materials by layer (the vault never the walls' tile nor coursed brick),
  blends by cause, cutout cards, a focus and coloured shade off a built stage: a readout that advises, never refuses.
  The bare gothic-stone passed 1 of 6.
- **gothic-stone is a crypt.** A new style card (`style/crypt.js`, its principles counted in `laws.js`) and dressing
  (`era/crypt.js`): a tomb chest on a stepped dais in the last room of the walk, set back from the way in; candle
  clusters at its corners, each a baked light that leaves no soot; cobwebs in pilaster angles, never on two neighbours;
  moss and grime blended by cause (the nave's blends, now `blendsByCause` for any kit); a limewash vault darker than the
  walls; a `tomb` camera that frames the set piece from the way in. Passes 6 of 6. The nave and the plaza are cut from
  gothic-stone's original numbers and are unchanged. Authored `lights` still replace the torches; the candles stay.
- **Repeating elements, an accent wall, corner things.** Three new laws (`repeat-adjacent`, `accent-wall`,
  `corner-things`), stated on the crypt's card and checked: every bare bay of the crypt carries the same framed burial
  niche (in two tiers on a tall wall, an urn in some), never in a doorway; the wall behind the tomb is the accent, its
  courses cut in larger, darker ashlar named from its numbers and bare of niches; and `lib/graph/era/props.js` gathers
  crates, barrels, leaning planks, stones, a boulder and debris where floor meets wall, clusters in the corners and
  singles at the wall bases, off the walking line, out of doorways and clear of the tomb, never two of a kind side by
  side. Any room kit's dressing can name its own `props: { kinds, share }`. `checkStageLaws` takes `only`, so a kit is
  read against the laws its own card states.
- **Real fire in the crypt's starter.** The kit card's starter carries `fire: true`: its torches burn through the fire
  channel. The candles stay baked lights.
- **Grime is a setting.** `grime: 0…1` on a room-kit recipe scales the dressing's moss and grime, the baked dirt (soot,
  damp, age, traffic) and the crypt's own wall wear together; the crypt stands at 0.5.
- **Brick wears.** `stone-brick` tiles take `jointDepth` (recessed mortar, grime along the arrises), `grime` (streaks
  down from the bed joints) and `chips` (broken arrises), each 0–1; absent, every preset tile is byte-identical.
- **Round, never boxed.** A new law, `arches-and-rounds`, is stated on the crypt's and the catacomb's cards and checked
  (a vaulted ceiling, arched trim, at least 8% of the built faces curved). A room kit opts in with `arch`
  (`lib/graph/era/arches.js`): doorways under a semicircular head with an archivolt and a curved soffit through the
  wall, and a barrel vault on transverse ribs over every room (the nave's vault, struck round; a segment of a circle
  past `maxRise`), cut so no face outgrows its light cell. The crypt takes it, with arched niches, turned barrels and a
  coped tomb lid. The nave and the other kits are unchanged.
- **Wood is a tile spec.** `gen: 'wood'` joins the tile generators (early and late colours, ring frequency, warp,
  cathedral, streaks); unset settings give quiet straight grain. The props' crates, barrels and planks take a muted,
  weathered grey-brown from it instead of the preset oak and walnut; a dressing can name its own (`props.wood`).
- **The catacomb kit.** Burial galleries cut in soft rock (`style/catacomb.js`, dressed by `era/crypt.js` from its own
  card): walls, piers and vault one generated tufa, the vault sooted darker, worn flags in earth; loculi in up to four
  tiers in every bare bay, some sealed with a slab; an ossuary accent wall of bone ends with rows of skulls on ledges
  behind a sarcophagus; amphorae, bone heaps, stones and debris at the wall bases. Passes 9 of 9.
- **Both starters are six rooms.** The crypt's walk runs nave, gallery, passage, charnel, chapel and sepulchre, turning
  back to end beside where it began; the catacomb's runs a stair, two galleries, a cubiculum, a crossing and the
  ossuary. Both open under the stage page budget (`stage-budget.test.js`).
- **Art direction comes first.** A room-kit stage recipe takes `art: 'propose'`: at create_sketch the palette (ramps,
  shade end cool, light end warm), materials (texture numbers; colours from the palette), architecture (proportions and
  the vault's rise) and motifs (the niche, the accent wall, the corner things) are rolled by seeded dice inside the
  kit's rails (`lib/graph/era/art-direction.js`) and stored in the recipe as numbers, each item `proposed`. The answer
  carries the art board as an image: five panels in mojulo's own SVG (`art-board.js`) with the actual tiles, a wall
  elevation and room section drawn from the proportions, motif glyphs and the floor plan, rasterized by sharp (without
  it the answer says so and carries the readout). Approve an item with a patch to `/art/status/<item>`; send one back
  with `/art/<item>: 'reroll'`; `art: 'auto'` is hands off. The recipe's own `tiles` and `proportions` still win. No new
  tool. Every roll keeps the kit's laws (`art-direction.deep.test.js`). Absent `art`, nothing changes.
- **Bricks take a radius and a shadow.** `stone-brick` tiles take `radius` (corners rounded, 1 makes each stone a disc)
  and `shadow` (each stone casts a soft box-shadow into the joint below and to its right); `rows` and `cols` now run
  to 12. The crypt's walls and accent wall use both; the ossuary's courses are now discs, bone ends seen end-on. Absent,
  every preset tile is byte-identical.
- **The art direction is seven items, and rolls stop repeating.** Palette, materials, architecture, MOTIFS (small: a
  frieze carved in a band along the plinth or cornice; `gen: 'frieze'`, seven patterns), DOODADS (large: the set piece,
  the accent wall, the things on the floor), ATMOSPHERE, and the plan. Materials choose between whole specs by weight:
  walls in running, Flemish, coursed-ashlar or stack bond, or rubble (dark stones in grey mortar); floors in flags,
  herringbone, basketweave or hexagons. The board shows all seven; the deep sweep keeps every kit law and the page
  budget on every roll.
- **Brick bonds.** `stone-brick` takes `bond`: `running` (the default, byte-identical), `stack`, `flemish`, `ashlar`,
  `herringbone`, `basketweave`, `hex` (a hex lattice gone asymmetric) and `rubble` (shaped field stones piled in the
  mortar); radius and shadow work on all of them.
- **Earth, ivy, lift.** Room-kit recipes take `earth: 0…1` (the floor giving way to packed dirt, in patches and along
  the way), `ivy: 0…1` (ivy rooted in the joints above the plinth, climbing; never on the accent wall) and `lift: 1…2`
  (every room taller). Each is also rolled by the art direction.
- **Set pieces and the doodad rule.** The set piece is a closed tomb, an empty one (its lid off and leaning, the dark
  inside showing), an altar or a well. A stone coffin joins the corner things. Two doodads never stand within 2.5 m
  unless a corner gathers them on purpose (`clusters`). New laws `dare-height`, `motif-small` and `doodads-apart` are
  stated on both cards and checked.
- **Atmosphere.** `atmosphere: { fog, dust, flicker }` on a room-kit stage: the look's fog thickened or thinned, dust
  motes drifting in still air and lit near the lights (`scene/channels/motes.js`; absent, no bytes), and the torches'
  flicker pace. Fire sources take `pace` (0.2–2); the crypt's and catacomb's torches burn at 0.45, calmer.
- **Page weight.** Pilaster sides are lit in metre cells, niche arches take six segments and the crypt's gutter holds
  less rubble, so the six-room starters keep room under the budget for taller rolls.
- **A built stage is addressable.** A room-kit stage's payload carries `rooms` (id, interior box, its doorways),
  `anchors` (each doorway between two rooms, the recipe's doors and items, the set piece and its lid, every doodad and
  prop by form and count such as `coffin-2`, each torch, niche and the accent wall, each with its room and position)
  and `colliders` (every closed wall as slabs cut at its doorways with a lintel kept, the pilasters, a hull per solid
  thing). A thing's faces carry its id as `node`, and the GLB gives each its own node by that name. The engine score
  and the GLB scene extras (`moj:rooms`, `moj:anchors`) carry the address, and the ledger counts it. The Godot kernel
  (0.5.0) walks against the colliders, makes every anchor a named `Marker3D`, turns rooms, doorways and doors into
  triggers (a door locked by an item opens once the bag holds it) and items into pickups whose node hides when
  taken. The World page never reads any of it: its bytes are unchanged.
- **Tone: colour as its own concern.** A room-kit stage takes `tone`: a preset (`noir`, `flat`, `isekai`) or a
  direction of its own (`texture: 'value' | 'shade'`, `steps`, `key`, `gain`, `detail`, five-stop `ramps`, `groups`,
  `keep`). The build drains the colour out: tinted faces bake grey, and tiles become their greyscale `value:` twins
  (about half the bytes) or `shade:` twins (the shadow only, the faces flat). The World page lights first and colours
  after (`scene/channels/tone.js`): the baked light is banded into `steps` and picks a colour off the surface's ramp,
  and the tile's own value adds detail inside the band. Exposure is measured: the median baked light lands on `key`.
  Engine exports carry the grey build and `score.tone`; the ledger says the grading is the page's for now. Absent
  `tone`, the page's bytes are unchanged.
- **Interceptors: immersive detail that never collides.** A room-kit stage takes `growth` (0…1 for every plant, or
  `{ grass, vines, creep, fungus }`), `litter` and `cracks` (0…1). Each interceptor finds its sites on the built rooms
  (the floor's stones and joints, the bare runs of wall, the large things, the corners) and grows there before the
  bake. Litter is pebble patches and a few stones in the floor's own shade, kept off the walk. Cracks are a decal
  inside a single flagstone. Grass grows at every height in the joints and at the wall foot, thinning toward the walk.
  Vines and roots hang from under the cornice, clear of the piers. Creeping ivy is rooted at the feet of the set piece
  and the doodads. Fungi grow in the corners, or at the foot of whatever stands in one, and at the piers' feet. No
  interceptor adds a collider or an anchor, and each kind's count is capped and spread evenly over the rooms, so every
  room gets its share and the page stays under budget at full aggressiveness on the tallest lift (tested). The art
  direction rolls `growth`, `litter` and `cracks` under `materials.weathering` from dice of their own, so a seed rolled
  before keeps every other number, and a stored direction without them grows nothing. New cards: `card:fungus`,
  `card:crack`, `card:pebbles` (the small ones ship at half size). Tones colour each interceptor's group from a ramp.
- **An outdoor trail from a recipe: `trail` on an open-ground kit** (`isekai-meadow`, the groves, `trail-valley`;
  `lib/graph/era/out-trail.js`). The first rung of an outdoor ladder named `out-trail` → `out-section` → `out-level`, apart
  from the rooms' halls and floors. What the hand-built trails shared is now a grammar the builder reads as numbers:
  - **a spine** sized by `run` (seconds at the walker's 6 m/s; 12 by default, the isekai meadow's 72 m, the least that
    holds two minutes of exploring; up to 25);
  - **beats** along it, at least 11 m apart: pinch, reveal, landmark, crossing, pocket, rest, pit. Drawn by dice when
    `beats` is not given: always a reveal, a landmark and a pocket, the landmark early, never two alike together, and as
    many as keep the exploring under three minutes (a long trail is a sparse one);
  - **the heartbeat** (`heartbeat` 0–1): the trail's height along its length, each beat its own shape (a climb into a
    reveal, a dip into a pinch or a ford, flat at a rest);
  - **bumpiness** (0–1): mounds and hollows, full off the walk and a tenth on it.
  The ground is built in passes, each kept: rough (the heartbeat, the beats' edges, the bumps), then smooth (the profile
  averaged, the walk laid level, the cliff's geology, the walk laid again over it, the pits cut). Where the smoothed walk
  is still steeper than 0.3 it is a stairs site, recorded for the next rung. The cliff breathes with the beats (drawn in
  at a pinch, pushed back at a reveal); a pocket is a clearing with a bank round it but for its mouth; a ford is a
  stream from the cliff's foot across the valley; a pit breaks the ribbon and is cut 2.6 m deep, with the ground whole
  wide of it; the landmark is a tall stone, the least that the trailhead (or a beat 15 m short of it) can see, and the
  trailhead's camera frames it.
- **Every beat and hazard is annotated.** The answer carries `anchors` (a beat with its station and the way on; a
  pocket's mouth; the landmark by node; a hazard's zone, `severity` and `respawn`; a stairs site) and `outTrail` (its
  length, run and exploring seconds, its beats and its laws: run, explore, spacing, order, grade, crest, hazards,
  landmark). A sweep holds every law for every seed, heartbeat and run (`out-trail.deep.test.js`).
- **A trail follows another: `trail.after`** (the followed trail's recipe and its stage `seed`). It starts where that
  one leaves: on its line and heading (easing into its own sway over 24 m), at its height, on its last row of ground
  (eased over 12 m), its cliff carried on. A `junction-<from>-<to>` anchor marks the seam, as a doorway does between
  rooms; every anchor names its `trail`; `outTrail.after` and `origin` say where its site sits beside the followed one,
  and a chain carries the origin on. Each trail is still its own page. A `seam` law measures the join (line, heading,
  height and ground under a centimetre). A trail's depth is a whole number of ground cells, so every trail's grid
  shares one spacing and two trails' vertices meet at a seam (they did not, and a cliff opened a crack).
- **A pit or a ford is on level ground.** The smoothed walk is laid flat within 3 m of each (a `level` law: no stairs
  site there); a pit had landed mid-staircase.
- **The outer wall: `trail.bounds`** (`lib/graph/era/out-bounds.js`). A trail's site edge is mapped like a floor plan's
  walls, so nobody walks off the world and an area can be closed off. Each side (`-x`, `+x`, `-y`, `+y`) is a run of
  segments (a face for the whole side, or `{ from, to, face }` in metres), each a collider (`of: 'bound:<trail>:<side>'`)
  and an anchor (`kind: 'bound'`), and each with a face — what the wall does besides stopping a walker: `wall` (unseen),
  `natural` (behind a barrier the land makes: the cliff side's default), `paint` (a panel with the recipe's `png`, or
  the style's far hills painted in three bands against the real sky), `mirror` (the site's near band reflected past
  the wall: the world seems to go on; not the grass tufts), `penalty` (a trigger strip before it, `reset`, `hurt` or
  `slow`, with a respawn on the nearest beat) and `open` (a seam: the side after another trail opens by default; a
  trail that leads on says `'+y': 'open'`). A mirror's OFFSET-WRAP: `offset` slides the reflection along the wall,
  wrapping in the segment, and `stutter` (metres, or true for 8) gives each chunk its own slide by dice, so it reads as
  other land. Only the things standing on the reflected ground slide, each whole (a trunk with its crown), set down
  where they land; the ground never does, so the reflection meets the real ground at the wall without a step. A
  `bounded` law: every side covered, open only at a seam. No wrap: a mirror shows the world going on, the wall holds.
- **Wind on a trail is free.** `wind` on an isekai kit with a `trail` gives it live grass with no change: the grass
  reads the grammar's ground and trail line.
- **The landform board** (`out-trail-board.js`): the land in black and white before anything grows on it — both passes
  as depth maps with the trail, beats, pockets, hazards and stairs drawn over them, the heartbeat strip, and the laws.
  Absent `trail`, every open-ground kit builds byte-identically; `trail` on a room kit or the jungle is refused.
- **The outdoor master index: man-made architecture and the swatches** (`lib/graph/era/out-made.js`,
  `era/style/swatches.js`, drawn by `era/out-index-html.js`). Documentation first: nothing is placed in a world yet.
  What people build along a trail (posts and fences, signs, beam bridges, steps, stepping stones, a stacked stone figure,
  laid paving) is a cascade: structural LAWS no layer can loosen (rail height, span over depth, 2R + T, balance), then
  the KIT's tokens rolled in rails by its seed (timber, joinery, chunk, caps, relief, wear, bond, paint), then a
  trail's `made` block (narrow a token, re-point a swatch role, add a piece; anything else refused with what is
  allowed), then the PIECE, a pattern's dimensions rolled inside rails that sit inside its laws. Patterns are parts put
  together by joints, drawn in black and white elevation, section and plan, dimensioned and measured. The SWATCHES
  record every outdoor colour, land and made: the isekai cards now read their ramps from them and nature-trail its
  blaze, so art direction for colour is controlled there (every kit builds byte-identically).
- **One vocabulary for what built things are made of** (`era/made-elements.js`): every element word (a bridge's
  stringers, footropes, keystone; the index's parts; the dressing's caps, lashings, courses) names its part and its
  material. A playscape object's values become a kit's colours through it: the material picks the swatch ramp, the
  value the stop, and what you use (`obj:status`) takes the kit's accent and nothing else does. The index's bridge is
  now the playscape entry: the kit's `bridge` token picks the variant, its tokens dress it, and the index measures its
  span-depth, bearing, handrail and flush laws on the built thing (a plank or a beam crossing is a challenge and needs no
  rail); the index's own beam bridge is retired.
- **The outdoor flora index: plants as doodads** (`era/out-flora.js`, drawn by `era/out-flora-html.js`). Research
  first: nothing is placed in a world yet. Four forms make the plants a kit needs, each a few primitives under a few
  dials rolled in rails by a seed: masses on a stick (lollipop, broccoli, cloud pads, column), a cap on a stalk
  (parasol, bell, funnel, toadstool), organic growth (brackets, puffballs, frills) and sausage fingers (saguaro, pads,
  coral, tube bundles). Built in values on named parts, skinned by a kit's swatch ramps, and built per reveal ring
  under a face budget. Leaf density is depicted (masses, overlap, a dark core through the gaps), never modelled. Read
  laws, not botany: one shape leads, the weight sits over the foot, body and wood differ in value, the ring's budget
  holds. Bark is exposed as the fracture model's dials and the stylized pattern each reads as; grass is chosen from
  mojulo's own primitives; the jungle is restated as a composition of layers, each with the form it would be.
- **Incongruity: the distortion pass as juxtaposition** (`era/out-flora.js` `incongrue`). A doodad is now a plan of
  base composition blocks (masses, caps, pads, knuckles, shelves) joined by links, then a mesh. Two dials mismatch the
  blocks: vertical (along a stack, sizes out of step and one joint jogs or kinks off the line) and horizontal (side by
  side, sizes alternate, heights go jagged, one stands out). Held by the sixth-gen object principles: one mismatch
  leads per run (the 33), the leading shape is never the one mismatched and never shrinks (the 66), filler stays quiet
  and a focus may be loud, and a leading mismatch under the eye spot at play distance is dropped as noise. Every stack's
  weight is brought back over what holds it and the whole over its foot, then the doodad is fitted back into its own
  bounds, so its footprint never changes. Under the eye spot, incongruity moves up to the composition: a cluster's
  members answer each other the same way, gated by the eye radius (full near the trail, half mid, none far).
- **Ikebana: `clustersprout` and the zone painter** (`era/out-ikebana.js`, drawn by `era/out-ikebana-html.js`). A
  bundling aid: a cluster is arranged, not scattered. `clustersprout` grows one arrangement from a single root (the
  kenzan): three principals in scalene steps (shin, soe at three quarters, hikae at three quarters of soe), each leaning
  its style's angle (upright, slanting, spreading) toward its own side of the viewer's line, as far as it still
  stands; an odd count of fillers inside their triangle, each sized by its footprint so it never spreads wider than
  soe; a flowering root at the foot (the broccoli form gains a `bush` variant and `blooms`, a part each kit skins); and
  the ma, a sector toward the viewer left open. Every stem is a flora doodad with its height pinned to its share and
  its own incongruity scaled by its role's interest. The zone painter sprouts arrangements along painted strokes with
  scale, bend, density, variation, kenzan and ma dials, each turned to a trail or a view, neighbours in alternate
  hands and one odd one out per stroke. A finger's radius now scales with its height, so every form does.
- **Wide ikebana: mixed media, its own ground, and walking** (`era/out-ikebana.js`, `era/out-flora.js`). Fillers
  cycle through their list, never the same thing twice running, and a `mix` law asks for three different things when
  the materials offer them. The flora index gains the terrain an arrangement is made of: `stone` (boulder, a cairn of
  stacked courses, standing slab, outcrop), `ground` (a mound whose crown is the root; a hollow whose pool lies in the
  ma) and `tuft` (ground cover, plain or in flower). Wide presets (garden, oasis, crater) set every element on the
  ground's surface with cover over the footprint; a solid mass weighs more than its height, so boulders and puffballs
  are fillers, never principals. Each element is classed for a walker from its built geometry (`WALK`): block (a trunk,
  a stone or bush over a step, any cactus, a mound steeper than it can be climbed), walk (tufts, flowers, anything
  under a step), under (a canopy over head height), wade (a shallow pool), as plan colliders. `walk: 'open'` keeps a way
  in down the ma (a crowding stem turns away from the front) and `walk: 'thicket'` makes every filler block; the zone
  painter moves an arrangement back whole until nothing that blocks stands within the trail's clearance.
- **Ikebana in tiers, plants only** (`era/out-ikebana.js`, `era/out-flora.js`). Arrangements no longer use stones as
  decoration: every preset is plants at every size. Fillers stand in TIERS down from the principals (an understory of
  small trees behind, bushes in and out of bloom either side, flowers in front either side of the ma) over a ground of
  tufts and daisies on every preset: tall behind, short in front. Each tier's materials cycle so nothing repeats. The
  flora index gains `flower` (spike, umbel, daisy, plume: one stalk leads, a spike envelopes far) and a second bloom
  colour per kit. Three laws hold the variety: `layers` (at least four height bands, canopy to ground), `shapes` (at
  least three silhouettes: columnar, round, spreading, made so by swapping a filler when one is missing) and `depth`
  (the herbs nearer the viewer than the understory). Flowers, like tufts, are walked through.
- **The `isekai-garden` kit: ikebana placed in a level** (`era/ikebana-place.js`, `era/style/isekai-garden.js`). A card's
  opt-in `ikebana` paints arrangements along the trail's banks (each bank its own zone and dials: the near banks at
  mid detail, a far row sparser at far detail without cover), clear of the cliff, the apron and the trail's reserved
  places, every arrangement facing the trail with open lawn between them (the ma at the composition's scale). Every
  element stands on the land at its own foot, coloured from the kit's swatches through the flora skin and banded by
  the stage's cel light, casting and taking the sun's shadow. What a walker pushes through goes in a soft group the
  page walks through (`soft`, a new opt-in on the World emitter: absent, every page emits as before); what blocks is a
  collider for an engine, and every arrangement an anchor. Faces never seen are not built: a face buried inside another
  mass of the same plant, a downturned face under the eye, a face under the ground. A flower's head is never smaller
  than reads at play distance. The garden is the meadow's grammar with no loose trees and a short lawn; every other kit
  builds byte-identically.
- **The `alien-night` kit: another world at night, from the isekai grammar** (`era/style/alien-night.js`). A style card
  and a row of swatches: spires for boulders, lantern stalks for trees, a taller scarp, jagged far silhouettes, every
  ramp dark and coloured. Three opt-in card fields on the isekai builder carry the night: `night` (the sky dark, the
  stars out, the moon drawn on the dome where the key light comes from, a pale world where the card hangs it), `glow`
  (each lantern crown a light baked into the ground round it and lifting the cel band near it; the crowns self-lit,
  lifted up their ramp, a few with halos), and `water` (a trail's stream in its own colour). Trails, joins, outer walls
  and wind work on it unchanged. Absent the fields, every kit builds byte-identically.
- **Fix: under a tone, cards stay cut out.** A toned card's texture (`value:card:…`) is alpha-tested like the card.
- **The world routing card points at `stage`.** A sixth-gen level is a `create_sketch` recipe read from card `stage`.
- The platformer game kit's search line no longer names game characters.
- The generated cards are family `world` with entry `create_sketch`; the family-world tests now tell them apart from
  the curated `compose_world` base cards.

### Pack CLI

- **`mojulo pack_x --json '{…}'` takes the pack call's own arguments.** Flags straight after the pack id are what
  `pack_x({…})` takes over MCP: `--json '{"manual":["mint_solid","edit_solid"]}'` (a name or a list),
  `{"tool":…,"args":{…}}`, or `--manual` / `--tool` / `--args` flags, checked against the pack schema. Before this,
  the form that pack bodies and `orient` teach failed with "pack dispatch needs a tool name before flags". The
  `pack_x <tool> --json …` and `pack_x --manual a,b` forms are unchanged.
- **`orient` names the command in use.** Its shell translation and the `tools` footer say
  `node scripts/mcp-stdio.mjs` when the repo script is run from a checkout, `npx -y mojulo@<version>` under npx, and
  `mojulo` otherwise. `orient` also maps `pack_x({ manual: … })` now. The MCP `initialize` and `tools/list` bytes do
  not change.

### Workbench ladder

- **The workbench card opens at a first object.** `get_solid_vocab({ id: 'workbench' })` returns the spec shape,
  the quick-start mug, lathes, extrudes and sweeps, assembly, materials and units, the composition rules for
  frames and arrays, and the candlestick, with a menu of the deeper families and their sizes: lofts, fields,
  expression terms, rocks, crystals, light rigs, domain operators, timber frames and masonry, furniture,
  upholstery, drapes, reliefs, shells, cuts, metal surfaces and toon, composition moves, and groups and movers.
  Each menu line names the asks its section answers (a bookcase, cabinet or flat-pack carcass → `furniture`). The
  text moved and was not rewritten; search and the embeddings still index the whole card.
- **What an agent reads.** A plain object: 74.9 KB before, 20.3 KB now. A bookcase: 74.9 KB before, 26.0 KB now
  (the base and `furniture`).
- **The plugin profile edits a sectioned card's base.** Its lines about label wraps from a painted render stay in
  the base, and the profile's body edits now apply to the base it serves as well as to the body search reads.
  `tools/list` does not move.

### Furniture fittings

- **Fittings no longer meet inside a board.** A member joined at the same place from both faces, such as a carcass
  partition with a fixed shelf or adjustable shelves on each side, got the second joint's fittings in the same holes
  as the first's: 11 mm of cam bolt from each face of 18 mm board, dowels and shelf-pin holes back to back. The
  second joint's cams, dowels, confirmats, screws and shelf pins now move along the contact toward its middle, by the
  least whole millimetre that leaves 3 mm of board between holes. Where nothing collides, nothing moves.
- **A single cam gets a dowel.** A cam on a short contact (a 60 mm plinth) had no dowel and could pivot on its bolt.
  It now gets one 32 mm beside it, or 16 mm where the contact is shorter. The middle cam of a three-cam row (panels
  about 390 mm deep or more) had its dowel placed in its own bolt hole. That dowel now goes beside the cam too.
- **The interference report checks fittings.** `furniture.interference` lists two fittings whose holes meet inside
  a member (`fittings: true`, `in`), and the mint warns about each one.
- **Output changes.** These fixes change re-renders of existing rows. Every `kd` carcass with a plinth gains two
  dowels. Every carcass with a partition and shelves on both sides, and every `kd` carcass with panels about 390 mm
  deep or more, moves fittings. A dowel-jointed table also moves fittings, because its two apron dowels met in each
  leg. Frames where no fittings collided render byte-identical.

### Fabricator

A fabrication need is said once, by the job a part does, and resolved from the shelf of standard parts first and from
scratch last: the cluster every new object draws from. Every existing kind builds byte-identically; a scad row minted without the door is unchanged.

- **Function words** (`fasten`, `thread`, `locate`, `hinge`, `slide`, `spin`, `drive`, `transmit`, `retain`, `seal`,
  `catch`, `mount`, `enclose`, `store`, `frame`) resolve to a strategy: parts taken by a route (buy, fit the standard
  interface into your part, print the standard part) or, last, a mint. Capabilities are measured from the need's
  numbers (host material, load, cycles, access, shaft, axes, the host it mounts to); intent tags are a closed set
  (`serviceable`, `tool-free`, `print-only`, `waterproof` …), each read by some strategy. `resolve`, `repertoire` and
  `coverage` in `lib/graph/fabricator/`.
- **The inventory** names families, not sizes: sizes are read from the construction hardware codes and the
  mechanical library's own tables, so there is one copy of every bearing bore and motor bolt square.
- **Provenance gates the route.** Standards, commodity parts, openly licensed systems (kept with their licence) and
  mojulo's own designs may be bought, fitted and printed. Another owner's product or system is reference-only: bought,
  or fitted by the interface its owner publishes, named only to say what fits, never reproduced. A refused strategy
  is reported, and the resolver moves on (a three-prong camera mount resolves to a bought adapter).
- **Coverage:** of the probe needs, three quarters resolve from the shelf; the rest name the gap they wait for.
- **`fabricate_solid`:** the fabricator decides and the kind that owns the material's joinery executes. A wood need
  whose strategy is a furniture joint (cam-lock, confirmat, insert-bolt, screwed, dowel, shelf-pin, hinge, slide) is
  planned as that joint for a workbench `frames` entry, whose joint code places and counts the fittings. A need solved
  by `mj_*` cuts or printed parts is planned for an OpenSCAD `source`. With `needs` alone the tool mints nothing and
  hands back the plan: each need's executor, strategy and why, the bill of materials, the cuts and the joints. With
  the `source` or the `frames` it mints the row with the plan frozen beside it as `fabricate`.
  - **Advisory checks:** planned cuts or joint types the body never makes, and needs planned for the other executor,
    are warned about. None is refused.
  - **One shopping-list shape:** the bill of materials uses the furniture report's and the instruction manual's line
    shape (`code`, `label`, `count`, `tool`, …). After a frames mint it is the frame's own hardware report, not the
    plan's estimate.
  - **Manual:** `get_solid_vocab({ id: 'fabricate' })`.
  - **Tightened by three agent trials** (a spool holder, a waterproof Raspberry Pi box, a flat-pack bookcase):
    - A part that is seated is bought: heat-set inserts were cut for and never listed, and a board's standoffs bought
      no screws. A test holds every strategy that fits a seat to buy as many as it seats.
    - Counts and depths agree: two bearings get two seats. A threaded hole runs 2 mm past the bolt tip. A fastening
      need says the grip its bolt length assumed.
    - Every cut says `where` it goes.
    - One job per need: a sealed box is the box. Its rim seal (O-ring cord sized to the rim), cable gland and
      breather are suggested as their own needs, and a need another one already covers is reported as an overlap.
    - Furniture in wood reads as furniture: shelves are shelf pins, a back is a groove joint, the wall fixing is an
      anti-tip kit, and a frame-placed fitting is left for the frame to count. A frames row takes the frames' unit.
  - **On the scad ladder:** a scad row that cuts a standard part's interface (a bearing seat, a heat-set pilot, a
    nut trap, a NEMA face …) and has no plan beside it opens `next` with `{ add: 'fabricate', tool:
    'fabricate_solid' }`. The cutters are read off the inventory, so there is one list.
- **Kept apart from the assembler.** The assembler places finished workbench parts in a scene; `fabricate_solid` says
  which real hardware does a job. The routing cards contrast the two, and the assembler, handed a scad row, now says
  that a scad object assembles inside its own source (`parts`, `mechanism`, the plan's `bom`) instead of only that
  it is not a workbench.

### Scad ladder

- **The scad card opens to its first step.** `get_solid_vocab({ id: 'scad' })` returns the part itself (spec,
  idioms, the worked example, what the kind does not do) and a menu of the deeper steps with their sizes: the
  mechanical library, standards and composition, outputs, mechanisms, dynamics, and the rigidity sensor.
  `get_solid_vocab({ id: 'scad', section: 'mechanism' })` reads one; a list reads several. The text moved and was not
  rewritten; search and the embeddings still index the whole card.
- **Any solid card can do this.** A card marks a section in its body, and a card without marks reads as before.
- **`next` on scad rows.** `mint_solid` kind scad and `update_sketch` on a scad row return the steps open from the
  recipe as stored, each with the section that teaches it: a mechanism for a part list, dynamics for a mechanism,
  the motion and strength readings, a print as printed and its coupon, a DXF for sheet metal, and the print
  package. It is computed, never stored, and names a step without predicting its result.
- **Ratchet.** `get_solid_vocab`'s `section` property moves the flat `tools/list` pin by 63 bytes (239,264 to
  239,327; pin 239,400). The card a plain part reads drops from 26.3 KB to 9.6 KB.

### Bug motion

The arthropods move. A bug minted with `motion` (a worked one by `species`, or one nobody has built by `bug`) carries a
skeleton derived from the parts it is assembled from and clips the World plays, packed as the animals' are.

- **The skeleton.** Bones along the body (the trunk's segments, the neck, the head, the abdomen's segments, a
  scorpion's tail), a coxa / femur / tibia / tarsus chain per leg, the antennae, mouthparts, wings and wing cases; each
  part bound to its bone, a section's rings blended along its segments.
- **Walking.** One footfall rule for every leg count: each pair a fixed share of a stride behind the pair in front, the
  two sides half a stride apart, so six legs walk the insect's alternating tripod, eight the spider's alternating
  four, and many the millipede's wave. A planted foot holds the ground while the body passes over it.
- **Flying, swimming and escaping.** Wings stroke about their roots (a beetle's wing cases raised clear first), oar
  legs row, a lobster's tail flips it backwards, a crab walks sideways.
- **Wingbeats.** A flight beats at the order's measured rate where a screen can show it (a butterfly's ten beats a
  second); past that (a bee's two hundred) the World draws the wing's swept fan, see-through, instead of strobing
  wings, while an engine export plays them beating at the screen's limit. `wingbeat` asks for beating, the blur, or a
  rate.
- **Behaviors.** Relaxing, alert, eating and sleeping, done the arthropod's way: antennae sweeping, forelegs or claws
  raised, a scorpion's sting over its back, mouthparts working, legs drawn in.

### Fauna behavior

What an animal does, said once for every animal and resolved per species to how its body does it. `relax` is one
word: a sheep lies with its legs folded under and chews the cud, a horse dozes on its feet with a hind hoof cocked, a
cat curls nose to tail, a vulture perches on one leg, a python coils, a salmon hovers. A minted animal carries them as
animation clips beside its gaits. Every species builds byte-identically, and an animal minted without behaviors is
unchanged.

- **Behaviors.** `relax`, `alert`, `eat` and `sleep`, each a loop or a hold, in `lib/graph/fauna/behavior/`.
- **Strategies.** Each behavior's ways of doing it, written in mechanism words a solver poses (what holds the body
  up, where the head goes, what the tail does, the small motion that loops), tried most specific first and ending on
  a fallback any body can do.
- **Capabilities from the bones.** Four legs or two, wings, fins, legs that fold, a neck that reaches the ground, a
  tail long enough to wrap, a supple back: measured from the skeleton, never authored.
- **Tags for habits.** A closed vocabulary of the habits the bones cannot tell (`ruminant`, `dozes-standing`,
  `perches`, `hoods`, …), set per family with species overrides. Every tag must be read by some strategy.
- **Every animal resolves.** `resolveBehavior(id, behavior)` names the strategy and why (the capabilities and tags
  it matched, and each more specific strategy it passed over); `behaviorTable()` gives every species at once.
- **Posed on the bones.** `behaviorFrames(id, behavior)` poses the strategy on the species' own skeleton, in the
  gait frame's shape, one principle per mechanism word: the trunk lowered until the belly rests on the ground, rolled
  or shifted over a foot; each foot block placed by the support (planted where it stood, folded flat under the chest
  or beside the belly, drawn up into the feathers) and the leg hung to it by the gait solver's two-link; a neck bent
  until the muzzle reaches the grass, a short-necked grazer's shoulders lowering when it cannot; the face turned back
  along the flank; nothing on land through the ground. A legless body is laid out as a coil, or a coil with the front
  third raised in an S. Standing, dozing on a cocked hind leg, lying folded, the sphinx, the curl, perching on one
  leg, sitting down over the feet, sitting up, rearing, lying on the side, the crouch, lying belly-flat, floating, the
  coil, hovering and swimming on are posed; a strategy whose words are not yet posed says which (`posable`).
- **Sitting up and rearing.** The trunk pitches up about the hips; sitting, its lowest point (the rump and the tail's
  root) comes down onto the ground and the hind feet lie flat out in front, knees up; rearing, the hips ride on the
  near-straight hind legs. The forelegs hang free (resting on the ground where they reach it, a chimpanzee's), or bring
  the hands up to the mouth to eat. The neck takes back most of the pitch and the face is aimed by the head word. A
  raccoon, a squirrel, a bear, a panda and a chimpanzee relax sitting up and eat from their hands; a raccoon, a bear
  and a chimpanzee rear to look.
- **Lying on the side, the crouch, and the meal.** Lying on the side, the trunk rolls onto its left flank and settles
  on the ground (by its trunk line, or its hips and shoulders where those sit lower), the legs lying loose out to the
  side; a head lowered on a rolled body bends about the world's horizontal, not the body's own. A crouch sinks the
  hips on planted feet, the front a little lower. A lying predator gnaws the meal between its paws, a pig or a bear
  roots, a raptor or a theropod tears upward from food pinned underfoot.
- **Belly-flat and afloat.** A crocodile, a monitor and a tortoise lie belly-flat, the feet sprawled out wide on the
  ground and the elbows and knees up. A floating body sinks by its buoyancy (a duck rides high, a mammal floats with
  its back awash, no lower than keeps its head at the surface), its head clear of the water, its legs hanging slack and
  its tail lying out on the surface; a floating frame reports the water's surface (`water`), and the stick strip draws
  it. An otter eats floating on its back, the food held up at its mouth. Only an animal that eats from its paws eats
  afloat (a hippo grazes), and only a bird sleeps afloat with its head tucked into its back.
- **Repertoires.** `repertoire(id, behavior)` lists every way an animal does a behavior, its own first: a raccoon
  relaxes sitting up or curled, a bear sitting up or sprawled. The catch-alls (lying folded, standing at ease) are
  left out when anything more its own qualifies. `resolveBehavior`, `poseBehavior` and `behaviorFrames` take
  `{ variant }` to pick another from the repertoire.
- **Behaviors as clips.** An animal's `motion` takes behavior words beside gait words (`['walk', 'relax']`,
  `{ behaviors: 'all' }`, `{ behaviors: ['relax'], variants: { relax: 'curl' } }`). Each behavior packs as one looping
  clip named for its word, through the same rig as the gaits, so the World previews it and the skinned GLB and the
  Godot pack carry it. A loop lasts as long as its motion takes (a breath, a chew, a scan round), slower on a bigger
  body. A behavior the species is not posed doing, or a way not in its repertoire, is refused with what it can do.
  Each species' entry card gains a `DOES` line: the behaviors it can be minted with and the way it does each.
- **A tail carried high wraps.** A curled cat's tail, which rests pointing up, is laid level before it wraps round
  the curl (it stood straight up).
- **The stick strip takes a behavior.** `scripts/fauna-gait-strip.mjs sheep relax` draws the loop it resolves to;
  `--variant curl` draws another way from the repertoire.
- **Shared solver pieces.** The leg chain and its two-link solve (`fauna/limb.js`) and the vector kit (`fauna/vec.js`)
  moved out of the gait solver so both solvers use them; every gait poses byte-identically.


### Test cull

The suite carried tests for modules no product code reaches: spikes, renderers and planners that were built and
never wired into a tool, a kind or a route. They are gone with their tests, and a quick critical tier joins the full run.

- **Removed, with their tests:** the aircraft fuselage wrap-net (and its spike, which wrote review SVGs into the
  removed `lite-template/` tree on every run), the box-vehicle face-net and its cards and variants (plus a second
  spike writer), the civic-glyph city composer, the figure landmark slots, the houseplant, the manga-cel,
  imperfect-cel and field-cel renderers with their shared cell geometry, the terrain region plan, the wave-drape
  fitter, the face-material role selector, the pixelizer prerender seam, the mega-boy flipbook spike and the
  beats diff exhibit. None was reachable from `app/`, `bin/`, the MCP registry or a package script.
- **Kept on purpose:** the removal guards (chatbot carve-out, moved notices, pack boundaries), the deprecated
  `MOJULO_RECIPE_BOOK` loader tests (it still loads until 4.0), and the proof worlds the game runtime's tests use
  as fixtures.
- **The `wardrobe-construction` card** described the drape fit as a function call no tool exposes. It now states
  the principle.
- **`npm run test:critical`** (`vitest.critical.config.js`): the MCP surface and its pins, the plugin profile, the
  guards, the database, versions, auth, the bundled book, scripts, the dashboard and every characterization pin,
  without the geometry-heavy suites. About 2,400 tests in two minutes against the full run's eight; CI still runs
  `npm test`.
- **A deep tier for exhaustive sweeps.** `*.deep.test.js` files are left out of `npm test` and run with
  `npm run test:deep` (CI runs it after `npm test`). `npm run test:deep:changed` runs only the sweeps whose imports
  touch an uncommitted change, so editing a city kernel runs none and editing `anime-head.js`, `anime-sculpt.js` or
  `station-loft.js` runs the anime ones. First in: the anime head's range-end and named-cut sweeps and every look
  built on both bases (`anime-head.deep.test.js`, `anime-looks.deep.test.js`), about 160 of the suite's
  file-seconds. The law tests stay in `anime-head.test.js` and `anime-looks.test.js`.

### Pack menu

Opening a pack (`pack_x({})`) returned every member's full description and input schema, and those manuals were
about 85% of what came back: opening `pack_stash` to call `gather` also read the 16 KB `cook` manual. A pack now
opens to a menu, and a member's manual is read when the agent picks it. Dispatch is unchanged.

- **The menu.** The pack's orientation, one line per member, and the full manual inline for light members (800 B
  or less). A heavy member's line ends with its manual's size and how to read it, so the cost is visible before
  it is paid.
- **`manual`.** `pack_x({ manual: 'cook' })` returns that member's manual alone (the same description and schema
  the pack used to inline); a list returns several. A member homed in another pack, a spine tool, an unknown
  name and a member the Claude plugin profile hides answer as dispatch does.
- **Errors point at the manual.** A member's error through a pack ends with where its manual is. Structured
  refusals (a JSON body with a code and the next action) are passed through untouched.
- **The listing did not grow.** The pack input schema is repeated in every pack entry; its `tool` and `args`
  wording was shortened to pay for `manual`.
- **CLI.** `mojulo <pack_id> --manual <name>[,<name>]` reads manuals from a shell; `mojulo <pack_id>` opens the
  menu.

### Building ladder

A house is one recipe that gains depth: a layout, then a dwelling (furnished, storeys), then its construction
(framing, roof, drainage), then a BIM model. The surface taught all of it at once (one 23.6 KB card, read for any
house) and spread it over three packs. Being built on this branch.

- **`mint_building`.** One door for the house: it takes the floorplan manifest `create_sketch` takes, unchanged,
  and stores the same row. `create_sketch` with `kind: 'floorplan'` still works.
- **`next` in the result.** A minted or updated building names the steps it can take from here (furnishing,
  storeys, framing, roof, drainage, the IFC export) and the card for each, computed from what the recipe already
  has. `mint_building`, `create_sketch` and `update_sketch` all return it for a house. Never stored.
- **One card per step.** The 23.2 KB `floor-plan` card is split by step: `house-layout` (4.1 KB: seed, footprint,
  rooms and glyphs, one-room plans, views), `house-dwelling` (8.4 KB: furnishing, your own items, finishes, light,
  styles), `house-storeys` (3.4 KB: storeys, levels, the walkway check), `house-construction` (6.5 KB: framing,
  roof covering, drainage) and `house-bim` (1.6 KB: IFC and glTF export). `floor-plan` is now a 1.6 KB index of
  them, so existing references still land. A layout-only house reads 4.1 KB instead of 23.6; a framed house as IFC
  reads 15.6 KB. Every JSON example in the six cards is a whole manifest, and a test mints each one.
- **The door fills two fields.** `kind: 'floorplan'` and the manifest's `title` may be left out; each is added in
  front only when absent, so a manifest `create_sketch` accepts is stored exactly as `create_sketch` stores it.
- **A building form and pack.** `get_creative_toolset({ form: 'building' })` and `pack_building` (with
  `update_sketch`, `get_sketch_vocab` and `export_model` shared in). The studio's HOUSE row and the `house`
  routing card point at `mint_building`.
- **Redirects removed.** `pack_diagram`, `pack_object`, `pack_world`, `create_sketch`, `mint_solid`,
  `compose_world` and the world drawer no longer describe how to mint a house; they say it is `mint_building`.
- **Ratchet.** One more pack and one more tool cost more than the redirects saved: the packs-mode listing pin
  rises by 577 bytes (33,263 to 33,840 over the pack menu; pin 33,900) and the flat pin by 931 (237,662 to
  238,593; pin 238,700).

### create_sketch diet

`create_sketch` listed a full drawing manual in `tools/list`: about 15.5 KB, the second-heaviest tool. It now
lists routing only (1.7 KB), and the manual is read on demand from cards. Nothing it accepts or stores changed.

- **A lean listing.** The description names the kinds (`floorplan`, `store` / `mall` / `restaurant`, `historic`,
  the painted kinds), the recipe door, hand-built marks and stations, and the world-recipe restore. It points
  plain flows and charts at `mint_diagram` and says to read the card before minting. `manifest` is an open object.
  `bucket` and `preloadMetadata` are still accepted but no longer listed, and `preload` lost its nested schema.
- **New sketch_vocab cards.** `mark-primitives` covers the 2D marks, style fields and station kinds.
  `construction-marks` covers blob, sphere, egg, cylinder, the volume cup, form, solid, partition, array, the
  presets, sticker shading, gesture placement and one-point perspective. Defaults are read from the expander, and
  every example mints. `edge-notation` gains `via` / `curvature` routing.
- **A lean result.** The `preload` echo names each prior (`ref`, `title`, and `as` / `note` / `metadata`) and no
  longer re-sends its whole manifest. With up to eight priors, that was up to eight full manifests riding back into
  the agent's context for nothing, since the agent composed against them before the call.
- **Ratchet.** The flat `tools/list` pin drops from 268,400 to 254,600 bytes. `create_sketch` leaves the
  description allowlist because it fits the 700-character ceiling.

### Diagram auto layout

A flow chart no longer needs a coordinate. Name the boxes and the arrows; the kernel places them. This was the
biggest reasoning cost left in `mint_diagram` and `create_sketch`: every station needed a hand-picked x, y, w and h.

- **Auto-placed stations.** When no station carries a position (no `x`/`y`, `cell` or `lane`), `lowerDiagramKinds`
  lays them out (`expandAutoLayout`, `lib/diagram-core.js`):
  - **Ranks:** longest path along the edges. A cycle's back edge is set aside in declaration order.
  - **Order:** barycenter sweeps within each rank.
  - **Box size:** fitted to the label, sublabel and items. A station's own `w`/`h` win.
  - **viewBox:** fitted when absent. A given one only grows.
  - **Direction:** `layout: { direction: 'LR' | 'TB' }`.

  It is deterministic, and the stored manifest holds the resolved coordinates. A manifest that places any station
  never reaches the pass, so every existing row is byte-identical. Both mint doors share it, and the binding holds.
- **Edges routed around boxes.** In an auto-placed diagram, an edge whose path or label pill would cross a box is
  routed on the clear side:
  - Rank-skipping edges, back edges, and a second edge between the same pair all count.
  - Lanes on the same side stack outward, and ties go to the emptier side.
  - An edge with its own `via` or `curvature` is left alone.
- **`edges[].channel`.** A new optional number pins a `via` edge's lane (x for left/right, y for top/bottom), so
  the lane can clear a wider box between the endpoints. Absent, nothing moves.
- **Readable without adjustment.** A contrast pass over diagram ink, measured on the app floor, the dark export
  and the light surface:
  - **SVG download and inline view:** the dark export was transparent, so opened directly or in a host page's
    `<img>` its pale ink sat on white at about 1.4:1. The route now paints the surface colour behind the drawing
    (`renderSketchToSvg({ backdrop: true })`). Decks, outcome pages and world textures, which composite onto
    their own backdrop, are unchanged.
  - **Station outlines:** all clear 3:1 on every surface. `input` was a 1.3:1 hairline, `filesystem` fell to 1.7
    on light, and `db_row` sat at 2.6–3.0; they now use the surface-aware `--text-muted` / `--entity-purple` inks.
    The `/graph` legend matches.
  - **Station sublabels:** move from `--text-muted` (about 4.0:1 at 10px) to `--text-secondary` (8:1 or more).
- **`mint_diagram`.** The listing says boxes are auto-placed when their positions are left out, and its arrowhead
  list moved to the `edge-notation` card (697 → 659 characters). The `mark-primitives` card teaches the auto-placed
  form first; `edge-notation` gains `channel`.

### update_sketch diagram lowering

`update_sketch` with a replacement diagram manifest skipped the diagram-kind lowering that `create_sketch` and
`mint_diagram` run. A `kind: 'sequence'` or `kind: 'gantt'` spec failed validation, and a `lanes[]` or
`boundaries[]` manifest was stored without its bands or boxes.

- **One pipeline.** `create_sketch` and `update_sketch` now share one helper in `sketch-mint.js`. It runs
  `lowerDiagramKinds` (sequence, gantt, swimlanes, auto layout), then grid cells, `expandBoundaries` and
  Rendrant. An update stores what a mint of the same manifest stores. A lowering error on update now reads
  `Invalid manifest: … manifest manual`, as at mint, instead of `Rendrant expansion error`.
- **No double lowering.** The lowerings keep their trigger (`kind`, `lanes`, `boundaries`) and prepend marks,
  so running them again on a stored row stacked a second copy of every mark. Swimlanes also shrank the viewBox,
  because the first pass drops `col`. `loweredDiagramKinds` (`lib/diagram-core.js`) recognises a lowering
  already present by the label text it paints, and that step is skipped. A stored row sent back whole or as a
  patch, or re-minted as a copy through `create_sketch` or `mint_diagram`, is stored unchanged. The binding test
  pins that both mint paths render a re-minted row the same way. As before, editing the spec of an already-lowered row
  (a message, a task, a lane) does not redraw it. Send the bare spec to redraw it.
- **Lanes with placed stations: intended change.** A `lanes[]` manifest whose stations all carry explicit
  `x`/`y` used to pass `update_sketch` with no lane bands. It now gets them, as `create_sketch` always gave
  it. Mint also sized those bands from `col` alone and overwrote the viewBox with that width, which clipped a
  station placed past it. The bands and viewBox now grow to hold every placed station. Laned stations on the
  column grid never reach past it, so their output is byte-identical.

### cook diet

`cook` listed every publication kind's layout manual in `tools/list`: 16.2 KB, the heaviest tool. It now lists
4.3 KB, and each kind's guide is read for the one kind being published. What cook accepts and makes is unchanged.

- **A lean listing.** The description keeps the three steps (cleave, aim, nucleate) and the authoring model, names
  the kinds, and says to call `sketch_stash({ intent, target_kind })` before any kind but essay. The deprecated
  `template` alias is still accepted but no longer listed.
- **Each kind's guide.** `sketch_stash` answers with `guide`: the kind's layout (how items, drawers and metadata map
  onto it) and the least content that renders well, word for word what cook's listing used to carry.
- **Two kinds that could not be scaffolded now can.** `sketch_stash` listed `site` and `photojournal` but refused
  both. Each now has a stash recipe, and `photojournal` has a guide (it had none).
- **Ratchet.** The flat `tools/list` pin drops from 268,900 to 256,800 bytes.

### Contextmap trim

The contextmap tools came from the chatbot era and still read like it. Their listings are shorter, and the 2.x
parts no longer show. Nothing they accept or record changed.

- `meta_context_commit` lists 3.3 KB instead of 7.1 KB: one line per type, with the app, connected-service and
  trigger records first, since those are what the dashboard's Apps and Connected Services panes list.
- `meta_context_brief` (1.7 KB to 0.9 KB) and `meta_context_analyze` (1.4 KB to 0.8 KB) are shorter too.
- No longer listed, still accepted: the 2.x `artifact_materialization` commit, which answers with the chatbot
  notice, and the `bot` brief scope, which reads a 2.x install's rows.
- `gather` and `execute_plan` stop mentioning bots and deploys.
- **Ratchet.** The flat `tools/list` pin drops from 256,800 to 251,600 bytes.

### Rigidity sensor

- `measure_solid` now takes a `strength` spec. It reads how far a part bends under the work it does, how far it is
  from breaking, and how much to trust that answer. It is a sensor, not a guarantee: every reading names its
  assumptions and never says "safe".
- **Material table.** A new mechanical table (`lib/graph/strength/materials.js`) covers FDM, powder and resin
  prints, stock metals, plastics and clear wood. Each entry has typical stiffness and strength, spread, creep and
  service temperature, all stamped "check the supplier datasheet".
  - For prints, strength across the layers falls off by Hankinson's formula.
  - For wood, strength across the grain falls off the same way.
  - An undeclared build direction takes the worst case.
- **Measured sections.** The real cross-section is cut from the mesh and integrated exactly: area, centroid,
  principal second moments, holes. Works for every solid kind.
- **Element checks**, each tested against a textbook answer and an overload control that flips the reading:
  - cantilever: bending, shear and deflection by Castigliano, so a varying section is exact. Swept from the root to
    the load, so the weak spot is found, not assumed.
  - lever: the effort comes from machina's lever.
  - shaft: torsion and twist.
  - strut: Euler or Johnson buckling.
  - bolt: ISO stress area, thread stripping, heat-set pull-out.
  - gear: Lewis tooth bending.
- **Stress raisers.** Steps in section and holes are found with an estimated Kt, on the face where the step sits.
  Kt is applied for brittle materials and repeated loads. For a ductile part under a static load it is reported
  but not applied.
- **Each reading reports:**
  - the margin: the safety factor of the weakest mode
  - rigidity against a limit
  - a confidence grade: the weakest of material, idealization, load, duty and environment, each with its reason
  - the safety factor that grade calls for (Pugsley-style; × 1.25 for brittle materials)
  - a verdict and one plain line
- **Stored on the row.** The spec can live on the row as `strength` (shape-checked at `update_sketch`), so the
  reading reproduces.
- **Weak-spot pointer.** The World draws a pointer at the weak spot: rings that ripple out from the point, with an
  arrow and a label. Only the rings animate; the part, the arrow and the label stay still. This is a new opt-in
  `marks` channel, which any row can also author directly. It is not a face, so no mesh export carries it. A row
  without `marks` or `strength` is byte-identical.
- **Card and routing.** The scad card has a "Will it hold?" section, and `translate_modeler_lingo` has a
  `strength-check` entry (PARTIAL; FEA, fatigue and creep are handed off).
- machina's quantities gain stress, area and second-moment units.
- **Ratchet.** With the drawing leg and `motion`, the flat `tools/list` pin rises by 671 bytes on the release
  candidate (238,593 to 239,264; pin 239,300). The packs-mode listing is unchanged.

### Industrial gen study

A study of the parts people most often ask a CAD tool for, minted as an agent writes them first. Most of them
mint, but the hard ones fail without saying so: threads no nut fits, gears and pulleys that only look right, text that
renders blank, and hand-made helices and lofts that break apart. The `scad` kind gains the vendored, pinned library its
card promised, and both silent failures now warn. A source that calls no `mj_` name is byte-identical.

- **The mechanical library.** A source that calls any `mj_` module or function gets mojulo's own OpenSCAD library
  prepended (`lib/graph/scad/mech-lib.js`), stamped `mechlib: <version>` in the ledger. It covers:
  - ISO metric coarse fasteners M2–M24 (`mj_bolt` with hex, socket, button or countersunk heads, `mj_nut`,
    `mj_washer`).
  - Real helical threads (`mj_thread`, `mj_tapped_hole`, `mj_trapezoid_thread`). The ISO 68-1 profile is swept on a
    sheared grid, so the part is a closed manifold and an `mj_nut` turns onto an `mj_bolt`.
  - Holes that print true: `mj_hole` circumscribes the polygon and adds a named fit. Also counterbores, countersinks,
    nut traps and slots, and heat-set pilots.
  - Involute gears: spur, helical and herringbone (`mj_spur_gear`), `mj_rack`, `mj_ring_gear`, and `mj_planetary`,
    which phases the planets and refuses a set that cannot assemble. A meshing pair sits at `mj_gear_center`.
  - Bevel gears and worms, which are approximations and labelled as such.
  - GT2 pulleys.
  - Exact fillets and chamfers, edge by edge.
  - Molded shells with draft, bosses and ribs.
  - NACA sections lofted into blades.
- **Standards.** Library v2 adds the dimensions agents get wrong from memory. Every table is from the published
  standard and the card says to check the supplier's sheet:
  - NEMA 11/14/17/23 motor mounts, with a stand-in motor.
  - Bearing seats for 623–6204, 688 and LM8/10/12UU.
  - DIN 6885 keyways, DIN 471/472 circlip grooves, and D-flat motor bores.
  - O-ring glands for face, piston and rod.
  - Raspberry Pi and Arduino standoff patterns, VESA patterns, T-slot extrusion, and Gridfinity bins.
- **Composition.** Parts are placed by how they meet. `mj_gear_meshed` puts a gear in mesh at any angle, and
  `mj_bolt_and_nut` threads the nut on in phase. `mj_enclosure` derives the base, the lid lip, the screw posts and
  the countersinks from one set of numbers. A top-level `$mj_fit_add` shifts every fit for a printer. Each fit is
  tested both ways: clean in place, and colliding when nudged.
- **Outputs.**
  - `mj_sheet` folds a chain of flanges. `mj_sheet_flat` unrolls it by bend allowance.
  - `export_model` gains `format: 'dxf' | 'svg'` for scad rows: a 2D program as written, a `slice_z` cut, or the
    outline, with `part` for a row that has several.
  - `mj_fit_coupon` prints a pin and a hole for every fit.
  - `translate_modeler_lingo` gains a `sheet metal` entry.
- **Silent failures are said.** Two cases now warn: a `text()` call (this OpenSCAD build has no fonts, so glyphs render
  as nothing), and a `polyhedron()` that OpenSCAD's kernel takes apart as non-manifold.
- **The routes say so.** The `scad` card has a library section. `translate_modeler_lingo` `precision cad` and
  `chamfer` now route threads, gears, fits and exact chamfers to the library. STEP, GD&T and constraint solving stay
  a CAD tool's.

### Industrial motion

A scad row with `parts` can declare how those parts move. The World plays the mechanism, and `measure_solid` checks
it for collisions across the cycle and reports torque, speed and force. Stress and strength are not modelled. A
manifest without `mechanism` is byte-identical.

- **Joints and couplings.** A `mechanism` block names a revolute or prismatic joint for each moving part (`on` rides
  another part, as a planet rides its carrier). The couplings that tie the joints together are gears, ring gears,
  belts, racks, screws, plain ratios, and rigid links between two pins.
- **One driver, everything else solved.** The authored pose is the rest pose. Each step of the drive's cycle is
  solved by Newton with continuation from the step before. The degrees of freedom are counted, so a part nothing
  drives is named rather than left still. A linkage that cannot close, at a dead point or failing Grashof, is reported
  at the drive value where it locks.
- **The World plays it.** The solved cycle becomes the mover channel's own `turn`, `path` and `pose` tables, derived
  at scene time and never stored.
- **`measure_solid({ ref, motion: true })`.**
  - Every joint's range, ratio to the driver, and peak speed.
  - Every pair of parts intersected across the cycle, with the steps where they collide and by how much.
  - Torque and force by virtual work, through stated efficiencies. A lead screw's efficiency comes from its lead
    angle, and the report says whether it self-locks.
  - Against a stated drive torque, a margin at the worst point of the cycle.
- **A gear train chains.** `mj_gear_meshed` gains `phase`, the previous gear's own turn, so a third gear meshes
  against a second that was itself turned into mesh (mech library v3). A sweep of a three-gear train found the gap.
- **The routes say so.** The `scad` card has a mechanisms section. `translate_modeler_lingo` gains a
  `mechanism-motion` entry: kinematics, linkages, gear trains and interference checks route to `mechanism`, and
  dynamics, contact forces and stress hand off to a multibody or FEA tool.

### Industrial dynamics

A mechanism with a material now carries real weight, inertia and friction, and the loads it computes go to the
rigidity sensor. The motion report then reads the whole machine's strength, not one part's. Without the new fields
the output is byte-identical.

- **Mass from the mesh.** Each part's volume, centre of mass and inertia tensor are computed exactly from its closed
  mesh, then multiplied by the material's density and an optional print fill share. A stated `mass` overrides it.
- **Dynamics by energy.** The drive effort through the cycle includes:
  - the inertia of every moving body at the drive speed
  - gravity on every rising part
  - a start-up term for a stated `spinup` time
  - the speed fluctuation under a mean torque, with the flywheel inertia that holds 5 %
  - the shaking force on the frame
- **Joint forces and friction.** For a tree-shaped mechanism, mojulo computes the force through every gear mesh, rod,
  screw and pin from the power downstream of it. Pin friction (μ·R·r) and slide friction (μ·N) are added to the drive,
  and a plastic bushing's PV is checked against a typical limit.
- **Into strength.** With a material, every rod is checked as a pinned strut and every gear by Lewis, each at its peak
  load, and the worst part is named.
- **Flags.** Load cycles over a stated duty, a self-locking screw holding a load on a material that creeps, unbalance,
  a NEMA motor's typical torque against the peak and start-up effort, and back-driving.

### Tensile view

The rigidity sensor reads tension and draws the curve every materials course draws. A materials and structures study
probed 32 everyday problems. Three of them were wrong with no warning, and this theme fixes the two in the sensor's
own checks.

- **`tie` element.** It checks a member in tension: a strap, a hanger, a rod that pulls, a test bar. It reads the
  peak over the swept sections, which includes the net section at a hole with its axial Kt and the bending an
  off-centre pull adds. It also gives the stretch ∫F/EA and the strain. A stretch limit is optional.
- **Struts are pushes only.** A strut with a negative force used to lose its sign and read as compression: a pulled
  bar came back as "buckling, predicted to fail". It is now refused and pointed at `tie`. A cantilever whose load runs
  straight along it says it is a tie or a strut.
- **A hollow section is not a hole.** The hole Kt now applies only where a section's topology changes (a cross-hole,
  or a cavity ending). It used to apply all along a tube or a hollow print, which doubled the stress in brittle
  materials and under repeated loads. Readings of such parts change. The ligaments either side of a hole no longer
  count as separate pieces.
- **The tensile view.** Every reading carries the material's idealised stress–strain curve in the stressed direction:
  brittle to the break; ductile elastic, then yield, then hardening to the ultimate where it is tabled. Across a
  print's layers the curve is brittle. On it sit:
  - the working point (the governing stress as a tensile equivalent, with its strain and zone)
  - the stress this confidence allows
  - the capacity mode, buckling or stripping, when one governs
- **The World draws it.** A row with a stored spec gets a static chart panel beside the weak spot. Only the rings
  move, as before. Marks without a chart emit the same bytes as before.
- **The table.** Metals and polycarbonate gain `ultimate`, and bolt grades gain their elongation. These are new
  fields, so existing readings are unchanged.
- **Coupon calibration.** `mj_tensile_coupon(t, upright)` (mech library v4) prints the ISO 527-2 1A dogbone. The
  strength spec's `coupon: { break_n, build }` turns a pulled coupon into the in-plane strength (flat) or the layer
  factor (upright). The reading is then marked calibrated and records what was measured.
- **Mechanisms.** A rod that pulls is now also checked as a tie at its peak tension.

### Prints as printed

The rigidity sensor reads a print's cross-section the way the slicer lays it down. It used to read every print as
solid and ignore a declared infill, which overstated a typical part's strength about 2× with no warning.

- **`print: { walls, line_mm, top_bottom, layer_mm, infill, pattern }`** on the strength spec, or on one check.
  Absent, or at 100 % infill, the reading is exactly as before.
- **The printed section.** Each cut is filled on a grid aligned with the build. The walls are a sideways offset and
  the skins a vertical one; in a cut that lies along a layer the walls are an even offset. What is left is the infill
  core. The section becomes the composite ("transformed") section: the exact solid values minus the core's lost
  stiffness. Beams, levers, ties, struts (buckling on the printed I) and shafts all read it.
- **Infill by pattern and direction.** Gibson–Ashby scaling, labelled typical ±50 %:
  - prism walls that run with the stress carry ρ
  - a bending-dominated lattice carries ρ²
  - triangles and lines across the build carry ρ/3 and ρ/4
  `infill_E` and `infill_strength` from your own test replace the table.
- **The core is advisory.** At low density its cells crack before the walls do. The reading notes it, but the
  walls set the margin.
- **Confidence names the section** ("2 walls and 0.8 mm skins around a 20 % grid core …"). It drops to low when
  the core carries more than a quarter of the stiffness and the infill was not measured.
- **Checked.** A declared 0 % print reads the same as an explicit 0.8 mm shell mesh (79.0 MPa). The study's PLA bar
  at 2 walls and 20 % grid reads 74.5 MPa against 35.9 solid.

### Audio improvements

Bodies for the orchestra and phrasing for the score: the bowed strings and brass the field score plays move from the
'80s synth-section recipe toward the instruments, and its melodies stop playing every note at one level. All opt-in by
name or field; recipes that don't use them render byte-identical. Ears gate: the operator's A/B listens.

- **Section v3: bodies.** `violin-3`, `viola-3`, `cello-3`, `contrabass-3`: the bowed sawtooth through each size's body
  (the air mode, the two corpus modes, the bridge hill) over a cut below the body's lowest mode, so vibrato sweeps the
  partials across fixed resonances; a bow onset. `trumpet-3`, `french-horn-3`, `trombone-3`, `tuba-3`: the bell's
  radiation peak and a lip scoop into pitch. Level-matched to the `-2` names. Built from the `body` and `filter` chain
  effects and existing patch fields.
- **Phrase shaping.** A composition part's `shape: 'phrase'` (or `{ bars, arch, contour, contrast, end }`) scales its
  note velocities: an arch across each phrase, higher notes a touch louder, long notes over short ones, the phrase's
  last note eased. Lowered at render like a chord chart; a part without it is byte-identical.
- **Woodwinds v3: tone follows force.** `flute-3`, `clarinet-3`, `oboe-3`, `bassoon-3`: solo players whose spectrum is
  blended per note from a soft table to a loud one by velocity (`harmonicsLoud`), with the energy the added partials
  carry, so playing harder brightens and widens the dynamic range instead of only turning up. Level-matched to the solo
  winds at mezzo-forte.
- **Wooden bodies v2: the modal body.** `body` takes `model: 'modal'`: a computed impulse of dozens of seeded body
  modes shaped by the resonance set, convolved under the dry signal, independent per side. `acoustic-guitar-2`,
  `nylon-guitar-2`, `classical-guitar-2`, `flamenco-guitar-2`, `gypsy-jazz-guitar-2` (on the tuned string), `harp-2`
  and `grand-piano-2` use it. Level-matched; wider in stereo.
- **Held notes breathe (`life`).** The fixed-loop "held MIDI note": a sustain that never moves. With `life`, one
  seeded slow pressure walk per note moves level, upper-partial brightness (a high shelf at the note's 4th partial) and
  vibrato depth and rate together, and a hairpin brightens as it swells. On by default for the `-3` strings, brass and
  woodwinds; `patchParams: { life: false }` holds a note still. Measured on a held clarinet: level wander 0.01 → 0.6 dB,
  brightness wander 0.1% → 3.1%.
- **The natural dial.** `life: 0–2` on a recipe (any musical kind) scales the breathing of every row whose instrument
  breathes; on a part, track or channel it overrides the recipe and, above 0, wakes any instrument. 0 is mechanical
  (byte-identical to `life: false`), 1 the natural default, 2 more. Lowered at render to `patchParams.life`; an explicit
  `patchParams.life` wins.
- **Piano v3.** `grand-piano-3`: each key's unison strings detuned their own way (`unisonSpread`, seeded by pitch, so a
  key is the same key every strike) with the second string ringing a little shorter, so keys beat and decay at their
  own rates; and the pedal-down halo, a `sympathetic` chain effect convolving the part with every undamped string.
  Measured on a released chord: the halo rings ~21 dB over `grand-piano-2`, ~20 dB under the chord. The `life` dial
  scales both; `life: 0` renders byte-identical to `grand-piano-2`. The halo's impulse costs ~0.3 s once per page.
- **A pianist's touch and the dampers.** A part's `touch: 'pianist'` (or `{ top, inner, bass, roll }`) plays each chord
  the way hands do: the top voice brought out, the inner voices softer, the bass a little present (level-neutral per
  chord), and the notes rolled up from the bass a few seeded milliseconds apart. Lowered at authoring: no kernel bytes.
  The piano's new `damper` patch field: a felt thud at key-off, a longer release in the bass where dampers grip less,
  and no damper at all on the top keys (above E6), which ring on after release as on a grand. And `ringExact`: the
  string loop's own filter lost more per second in the top two octaves than the patch's ring time allowed (C7 rang
  ~0.3 s for a 1.4 s target); it now caps the loop damping per note so the target holds (C7: ~160 → ~45 dB/s).
  `grand-piano-3` carries all three; other patches are unchanged. The instruments card now tells agents to write piano
  phrased by default: the melody its own part with `shape`, the accompaniment under it with `touch`, a ritardando at the end.
- **A sustain pedal you can write.** `sustainPedal` on a recipe (every part whose instrument has dampers: the
  piano) or on a part: `'per-chord'` re-pedals the way a pianist does, lifting just after each new harmony over a new
  bass note and catching it again; `'held'` keeps it down; or a list of `[time, 'down' | 'up' | 'half']`. Released
  notes ring on to the next lift (a half pedal shortens them instead), and the piano's halo rises and drains with the
  pedal instead of staying on. Lowered at authoring; the halo's ride reuses the sweep automation. The instruments card
  says which repertoire to pedal (Chopin, Satie, Debussy, Bach's broken chords) and which to leave dry (Mozart's runs).
- **Phrase shaping reaches `form` phrases** through per-part shaped copies; the shared phrase is untouched.
- **One new kernel feature, `timbre`** (the velocity spectra, the modal body and `life`), sliced like the rest: pages that don't
  use it carry the previous kernel byte for byte.
- **The field score uses all of it** for new scores: the orchestral palettes name the v3 sections and the leads carry
  `shape: 'phrase'`, their base velocity lowered a little so the arch's peaks stay under each energy's ceiling. Stored
  scores keep the instruments they name.

### Statue maker

The hero door carves the Western character creator's figure as sculpture: posed, draped or nude, in a period's stone or
bronze, cut to a bust, a herm or a torso study, with losses, on a base. Opt-in; a hero without `statue` is
byte-identical. Being built on this branch; the sphinx comes next.

- **The statue build.** `statue: '<card>'` or `{ type: 'statue', style, material, crop, lose, base, dials: { wear } }`
  (`lib/graph/statue/`), stamped with its laws version like an outfit or armour build. Period cards, plain JSON:
  `archaic`, `classical`, `hellenistic`, `roman`, `roman-bust`, `egyptian`, `renaissance`. A card's stand, stillness and
  drapery (an outfit card per silhouette) sit beneath the hero's own words; its hair is set at mint.
- **Carved.** One material over every group: blank eyes, carved hair, the bare body's zones skin. `marble`,
  `limestone`, `sandstone`, `granite`, `basalt`, `bronze` (its patina by `wear`, from brown to verdigris), `gilt`, and
  `painted`: reconstructed polychromy over the card's stone, which the readout always calls conjecture.
- **Cut.** `crop`: `full`, `bust` (below the chest, through the upper arms), `herm`, `torso` (no head or arms, the
  thighs cut). `lose`: whole parts with what they carry (`forearmR` takes the hand), each closed in its own cap. No
  fracture surfaces yet.
- **On a base.** `block`, `attic`, `drum`, `socle`, `herm` or `none`, in stone, built at read time under the posed figure
  from the footprint it stands on; the figure is lifted onto it. The base rides every export as its own group.
- **A surface for the exports.** A layered recipe's `surfaces` (group → a shelf material or a metal surface, `'*'` the
  rest) tags its faces (`spec` and `pbr`; a metal surface's `metal`), so a bronze statue exports metallic, in its
  patina's colour, to GLB and Godot. Absent, byte-identical.
- **The readout.** `hero.statue`: the card, period, material, format, the parts lost, the base, wear, `basis:
  'unverified'` (the cards are drawn from the general record of each type, not from sources read) and the caption
  derived work carries ("inspired by …").
- **Statues in historic cities.** A `historic` manifest's `statues: [{ ref, at, figure, height }]` stands a stored statue
  on one of the city's statue slots in the World: a Forum monument (Marsyas at `ficus`, the Sibyls, the Concord pair,
  Vortumnus, the Castor cella's cult statues, the Basilica Aemilia's portico figures, …) or a statue asset's slot
  (`ln-statue:<n>` at Lindos, `pp-statue:<n>` at Pompeii, `votive-row:0` at Sumer, `eg-colossus:<n>` at Thebes, `pp-equestrian:<n>` at Pompeii). The stand-in comes down, its base stays, and the statue is
  fitted at the stand-in's height and facing, baked under the city's sun. The entry card's `STATUES` line lists the
  slots. Absent, the city is byte-identical.
- **Sumer's worshippers.** A `sumerian` card: the Early Dynastic votive figure, frontal, the forearms folded and the hands
  clasped at the chest, a flared skirt (the man shaven: no beard is carved yet), limestone; painted, the eyes lapis
  under bitumen brows. Sumer's votive row is a slot (`votive-row:0`), one figure per plinth numbered along the row, so a
  carved worshipper can stand among the others.
- **Seated statues.** `stand: 'seated'` on a statue build (or a card) sits the figure on a block throne built with its
  base: the thighs level, the shins hanging, the hands flat on the knees. A long skirt is cut at the knee, since a drape
  over the lap isn't carved yet. The rig gains an opt-in `seat` channel that turns the free legs forward past the hip's
  cone; absent, every pose is unchanged. Thebes's seated colossi are slots (`eg-colossus:<n>`): the stand-in king and his
  throne come down, and a seated statue sits there on its own throne. The nemes and the crowns aren't carved yet.
- **Carved animals.** The `animal` kind takes `statue` (`true`, or `{ type: 'statue', material, base, dials: { wear } }`):
  the animal in one stone or metal, its fur and skin textures dropped, tagged for the exports, on an oblong base the
  length of its body. Absent, every animal is byte-identical.
- **Equestrian statues.** `stand: 'mounted'` sets a hero statue astride a horse carved in the same material. The rider sits on the saddle
  found from its own hip joints, legs down the flanks, the right arm raised in address, both on one oblong block. The
  equestrian slots take it: the Forum's Octavian horseman and Pompeii's standing equestrian bronzes
  (`pp-equestrian:<n>`), each facing the way its stand-in's horse did. A standing statue on an equestrian slot, or a
  mounted one on a standing slot, is refused by name. Entry cards list a slot range with gaps one by one.
- **A horse in the library.** A horse ring plan for the layered kind, built with the creature-from-plan loop: a barrel
  body, an arched crested neck, a long wedge head carried down, straight cannons on single hooves, the hind leg angled at
  stifle and hock, 1.6 m at the withers. It is core (`horsePlan({ scale, palette })`), worked as
  `docs/examples/ring-plans/horse.plan.json` (mint it with `via: 'plan'`), and it is the equestrian statues' horse.
  A loft takes `frame: 'keep'`, which keeps a near-level barrel's rings from twisting (and a run along a flank from
  collapsing); absent, every loft is unchanged.
- **A sphinx in the library.** A sphinx ring plan, built the same way: a lion lying on its belly in the Great Sphinx's own
  proportions, forelegs reaching forward, hind legs folded, the tail along the right flank, wearing the hero's carved
  landmark head (no hair, no beard) in a nemes with the uraeus. The nemes is a striped wrap, not a cap: its opening
  tilted so the brow band crosses the forehead and the face looks out of it, its stripes radiating back over the crown;
  behind the face it folds out each side like a cobra's hood, the wings flaring past the shoulders, striped across, and
  the lappets hang striped down a breast that is broad and flat, as a man's chest, set back under the face. Carved, the stripes are grooves: a palette group named `…Groove` takes the
  stone a shade darker. The criosphinx's headcloth is striped the same way. Core as `sphinxPlan({ preset, scale, palette })`, worked as
  `docs/examples/ring-plans/sphinx.plan.json`.
- **Carved creatures and library forms.** Any layered plan that is not a hero takes `statue` (the creature filter: one
  material, an oblong base). A historic city's statue entry may name a library form instead of a stored statue:
  `{ "at": "gz-sphinx:0", "form": "sphinx", "material"? }` stands the carved sphinx in Giza's quarry in place of the
  block stand-in, limestone by default. Giza's entry card says so.
- **The criosphinx and the bull.** Two more ring plans built the same way. The criosphinx is Amun's ram-headed sphinx
  of Karnak's avenue: a domed ram's skull with horns coiled round the ears, the headcloth over the shoulders, a small
  king between the paws (`criosphinxPlan()`, sandstone). The bull is Sumer's copper guardian: a deep barrel, the
  shoulder hump, the head forward, horns out and up (`bullPlan()`, bronze gone green). Thebes's sphinx rows and Sumer's
  guardian pair are slots, one figure per pedestal or plinth, and take them as `form: 'criosphinx'` and `form: 'bull'`.
- **`statues: "carved"`.** One word on a historic city carves every slot with its period's statue: a slot's own form
  (the sphinxes, the bulls), the seated granite king on the Theban colossi, a bronze horseman on an equestrian slot
  and nowhere else, and the culture's card everywhere else (Roman at the Forum and Pompeii, Hellenistic at Lindos,
  Sumerian worshippers), men and women, marble and bronze, decided by each slot's own dice so the city carves the same
  each time. The city's standing figures use the hero's light body (the streamlined core, low-poly), since the Forum
  carves 38 of them. An entry may also give a hero statue inline (`hero: { cast, statue }`), with nothing stored.

### Recipe versions

- **Every recipe records the mojulo version that wrote it.** A mint stores the version that minted
  it; an edit to the recipe (`update_sketch`, `edit_solid` and the other in-place revisions) stores the
  version that last changed it. A retitle, a folder move or a gallery pin leaves it alone, since what
  renders is unchanged. Each archived revision of a solid and each beats revision carries the version
  that wrote that manifest.
- `export_model` answers with `versions: { minted, revised, rendered }`, so an export says which
  mojulo made the recipe and which one rendered it. To reproduce an export exactly as the recipe's own
  version drew it, render it under that version (`npx -y mojulo@<version>`) in a separate
  `MOJULO_HOME`.
- Recipes written before this release read `null`: they were made by 3.0 or earlier, and which one is
  not recorded, so nothing is guessed. The columns are added on first start; nothing else changes.

### Recipe book

- **The recipe book ships with mojulo.** The catalog that lived in the separate `mojulo-recipe-book`
  repo now lives at `control/book/` and is in the npm package, so every install has it with no setup,
  including an agent box (the Claude app and web, ChatGPT's Work box), where nothing can be cloned
  beside the package and the old attached book never loaded. It comes in at the book's 0.8.0: study
  objects, math, worlds, loops, solids, shots and the wardrobe (garments, outfits, footwear), and the
  `aurora` and `foucault-pendulum` view kinds. Named outfits such as `business-suit` now resolve on
  every install.
- Precedence is unchanged in spirit and gains one tier at the bottom: core kinds, then your cookbook,
  then an attached clone, then the bundled book. `MOJULO_BUNDLED_BOOK=off` leaves it unattached.
- **Deprecated:** `MOJULO_RECIPE_BOOK` and the separate `mojulo-recipe-book` repo. A clone you
  already point at still loads, ahead of the bundled book, and warns at boot; it is removed no earlier
  than 4.0. Book entries are now contributed to `control/book/` in this repo (see CONTRIBUTING.md).
- The ChatGPT Work-box runner installs 3.1.0 by default, so a Work box gets the bundled book.
- `npm run test:book` runs the book validator and the builders' own tests; CI runs it, and
  `npm test` checks the bundled book as well.

### MIDI orchestra

- **In progress.** The robot band learns styles from studied masters, written as manuals an agent reads
  before composing, not as presets. The first is **robot rock**: the 16-bit action-game sound of a rock band
  played by machines. The card `beats-robot-rock` (via `get_beats_vocab` or `semantic_search`) covers:
  - one fixed band and one room for a whole game, with each stage choosing only what is wet;
  - a riff-and-bass engine, with the bass answering the lead;
  - an intensity ladder from stage select to final boss, with a form for each scenario: stage, boss,
    fortress, select, victory;
  - an element (water, fire, ice, machine) signalled inside the groove rather than by swapping the band;
  - an 8-voice discipline.
- Every manual is white label: it names traits, never a franchise or composer.
- The second style manual, **field orchestra**, covers the 32-bit strategy-RPG score: an orchestra written for a
  few voices that still reads as orchestral. The card `beats-field-orchestra` covers:
  - an energy ladder (idyllic, adventurous, processional, battle), with a form and a mix for each step;
  - layers that enter one at a time;
  - one shared hall, with the sustained sections wet and the percussion dry;
  - the orchestra played as a band;
  - loops that never close V–i;
  - instrument families as dramatic tags.
- New authoring vocabulary. All of it is opt-in; recipes without it expand and render byte-identical:
  - rhythms `dotted`, `dotted-quarter` and the 6/8 `lilt`;
  - voicings `pedal`, `pedal-5` and `drone` (the key's tonic, fifth or open fifth held under any chart);
  - grooves `march`, `processional` and `travel`;
  - snare-rudiment fills `paradiddle`, `drag`, `five-stroke` and `long-roll`;
  - woodwind and timpani band roles;
  - bands `orchestra-pastoral`, `orchestra-field`, `orchestra-processional` and `orchestra-battle`.
- Harmony gains:
  - the Phrygian bII as the danger chord;
  - the tonic pedal;
  - loop-seam cadences;
  - the tonic flip;
  - the Aeolian march;
  - modes ranked by tension;
  - key shifts by a third or a fifth between sections.
- The worked set, `lib/graph/beats/field-moods.js`: idyllic `plains`, `desert`, `village` and `forest`; adventurous
  `highlands`, `expedition` and `wayfarer`. Each row carries an `energy`. Not yet wired to a world or a tool.
  Machine gates in `field-moods.test.js` hold each energy to its budget:
  - one colour alone at the opening;
  - parts and leads per bar;
  - no V–i at the seam;
  - a dynamics ceiling;
  - adventurous moods keep moving.
- Never the same score twice. `lib/graph/beats/field-score.js` generates field cues from these principles:
  - `scoreIdentity(gameSeed)` rolls a game's identity: home key, a palette flavour (orchestral, folk, chamber,
    synth-era, silk-road) with its instruments per role from the shelf, one hall, and a motif rhythm.
  - `fieldScore(mood, { seed, identity })` rolls a cue inside the mood: mode, tempo, meter, a progression from
    the mood's harmony family, new melodies, the arrangement order and the gear change.
  - Same seeds give the same music; new seeds give a different score. Over 60 seeds per mood every melody
    differs, every key appears, and all 420 recipes are distinct. Cues sharing an identity keep its tonic,
    palette, hall and motif.
  - `field-gates.js`: the principles as an advisory check over any beats composition, run on every generated
    seed and on the hand-written takes. The village take keeps its flute counterline as a recorded exception.
  - The card tells an agent composing by hand to use a fresh seed and a game identity.
- A field score is now one call away, and mojulo suggests one:
  - a world takes `audio: { soundtrack: 'field:plains' }` (or `{ score: { mood, seed, game } }`) and plays a
    generated field cue. `compose_world` stores a fresh seed, so every world sounds different until you keep one;
  - `create_beats({ kind: 'beats-composition', title, score: { mood } })` mints a field cue with fresh seeds and
    says how to keep a whole game in one identity (`game`);
  - a world composed without music gets a suggested mood and the exact `audio` line in the reply.
- Loop points. A render with `loop` (`export_beats { loop: true }`, `beats.wav?loop=1`, or the recipe's
  `export.loop`) is exactly one pass, cut at the next bar line. The ring-out is folded back onto the start, the way
  a live loop carries it, and a `smpl` loop chunk marks the loop for samplers and game engines. The Godot pack
  renders every music bed this way, so a level or menu loops without the old gap of silence. Off by default;
  renders without it are byte-identical.
- More than fields. The same generator now writes the rest of a game's non-battle music, each mood a set of
  leanings inside the same principles:
  - towns and interiors: `town`, `tavern` (folk instruments in any game), `shop`, `chapel`;
  - `night`;
  - `ceremony`, a stately procession with a brass lead (a new `processional` energy in the gates);
  - story cues: `prayer`, `sorrow`, `tension` (before a fight, not the fight), `betrayal`, `triumph`.
  Every mood carries its role (field, travel, town, interior, story), and the suggestion knows the new places.
  The existing moods are unchanged, note for note.

### Bug builder

- Arthropods join the animal kind, built from parts instead of a species list. Insects, spiders, scorpions,
  crabs, woodlice, centipedes and millipedes share one assembler: a head (or none, fused into the trunk), a
  trunk of repeated segments each carrying leg pairs, and a tail. Each part is chosen by form: a walking,
  running, jumping, grasping, digging, swimming or stilt leg; a chela; filiform, elbowed, clubbed, comb or
  feathered antennae; mandibles, a coiled proboscis, a beak or fangs; clear, scaled or narrow wings, tegmina,
  halteres or elytra; cerci, a sting or a scorpion's tail. Two bugs share a part by naming the same form, so a
  bee and a fly stand on the same leg and a grasshopper's jumping leg serves any jumper.
- Legs are bent chains whose feet are solved onto the ground, and segments are the shapes the anime hair uses:
  tapering cones for leg and antenna segments, flat crescents for mandibles and claw fingers, curved spikes for
  claws, fangs and stings. A bug is built at its published length exactly: the body is measured and rebuilt at
  the scale that matches.
- `mint_solid { kind: 'animal' }` mints a worked bug by `species`, or one nobody has built by `bug`: an order
  and a few part forms find the closest worked bug, and the asked forms are worn over it (a wasp from the bee
  with a waisted abdomen, a crayfish from the crab with a long carapace and a tail fan). The mint returns the
  stance, the leg count, the basis it started from and each part it swapped.
- `scripts/fauna-fit.mjs --bug <id>` gates an arthropod at true scale: closed, grounded, every foot planted
  and body length, each tolerance a share of the body. Animal species are measured exactly as before.
- Every worked bug went through the same design loop as the animals: a critic, one fix pass and two blind
  judges. Optional settings cover what the loop asked for: a leg joint turning out of its plane (a crab's claw
  across its face), where each leg pair attaches, jaws tipped up or down with several teeth, a flat underside,
  finer stripes and spots, markings on legs, and a scorpion's sting bulb and hook.
- The arthropods join the animal encyclopedia: every worked bug has an entry card (its common name, other
  names, scientific name, published size and source, and a starter to copy), and each class (insect, arachnid,
  crustacean, myriapod) a hub naming the arthropods not built yet with the bug that stands in. Search finds "a
  ladybug", "crawdad" or "daddy longlegs", and `species` (or `bug.like`) takes any of those names.

### Historic city

- **In progress.** A historic city becomes its own generator rather than a setting of the metro city,
  built one period at a time from the first cities of Sumer toward the present. A period is read as a
  composition of shared visual patterns (sun-dried earth, flat-roofed cubes, courtyard houses, stepped
  platforms, niched walls, towered ring walls, canals through town), so later cultures reuse them.
- The town is built in two steps. The layout claims ground and asks for buildings by slot: the
  ziggurat site, each house lot facing its lane, each wall run, tower and gate facing out. A per-period
  asset kit builds each slot on its own random stream, so redesigning one building moves nothing else.
  Each kit asset is designed from a massing sheet dreamed on the optional local image worker, then
  rebuilt as plain masses; the sheet is a design aid and is never stored. Until an asset is designed, a
  plain placeholder stands in its slot. The metro city is unchanged.
- Mud brick leans: walls, towers, tiers and platforms are battered, stairs climb on slopes, and the
  reed hall is a round vault. The ground is surfaced for street level — beaten mud alleys, rubble and
  sherd main streets, baked-brick quays, precinct and courts, cracked dry earth outside the wall — and
  the page opens on a street view or a view from the precinct court as well as from the air. Palms are
  low-poly date palms, which cut a whole town's page to about a quarter of its size.
- A town carries its art and its street life. The shared vocabulary gains art (votive figures,
  stelae, door emblems, guardian beasts, friezes, mosaic skins, ritual vessels, altars) and street
  structures (wells, kilns, granaries, boats), each noted where it recurs across cultures, and the
  layout places them by meaning: offerings, guardians and the altar on the sacred axis at the
  ziggurat's stair, the goddess's reed posts at her doors, stelae inside the precinct gate, worshippers
  facing the god, wells where lanes meet, kilns under the wall, granaries by the precinct, boats at the
  quays. Sumer's set includes the cone-mosaic Pillar Hall of Uruk, copper bulls, the Uruk vase and a
  temple portal with its cattle frieze and lion-headed eagle. Round, domed and hooped forms are new
  building blocks.
- Each asset can be drawn as an SVG blueprint from its own parts before it is rendered: front and side
  elevations, plan, dimensions, a parts table and build notes, so a design is checked in pure geometry
  first and the drawing never drifts from the model.
- Walls show what they are made of. A transparent material layer rides over each wall's own lit
  colour, so sun and shade are kept: bare mud brick with a herringbone course on the city wall and the
  platforms, baked brick in dark bitumen joints on the ziggurat's casing, mud render on the houses
  (rain streaks, a fallen patch, the courses showing through where the foot of the wall has worn), and
  lime whitewash with hairline cracks on the temples and pale houses. Each culture says which mass
  wears which material. The coursing is pinned to world height, so neighbouring faces line up. The
  layer shows in the CSS 3D page only; the WebGL World keeps flat colour for now.
- The town can be walked. A loose grid of narrow alleys runs between the blocks, so every house
  fronts a lane and no block is more than two houses deep (before, about a third of the houses had no
  way in), and each house stands a little in from its lot so neighbours read as separate buildings.
- The sacred precinct has room: it is larger, kept clear of the wall's towers, and its temples stand
  by measured clearance from the ziggurat and its long front stair instead of crowding them.
- The canal is a smooth channel sunk below the town between baked-brick embankments, with one quay
  strip along each bank and nothing laid over it. Where a main street crosses, a humped brick bridge
  climbs by stairs over a corbelled opening high enough for a reed boat's horns, and the boats float
  on the water. A canal view looks along the quay at the middle bridge.
- Brick walls read as brick in the walkable World as well as the page: bolder courses with relief,
  the reed-mat layers Sumerian builders laid between courses, a stamped course in the baked brick,
  and a share of houses left as bare brick instead of mud render.
- A second culture, New Kingdom Thebes, on the same template: the Nile along the town, the temple
  of Amun on an axis from its river quay through an avenue of sphinxes, obelisks and colossi, a
  pylon, a court and a hypostyle hall to the sanctuary, a sacred lake, and an unwalled town of
  mudbrick houses and villas. Each culture now brings its own layout; the grid, alleys, house lots
  and slot placement are shared.
- Thebes' temple walls show figures drawn to the Egyptian canon instead of one repeated group: the
  king in the blue crown making offerings to Amun, Mut, Khonsu and Ra-Horakhty, each god with their
  own crown and emblems, in a set of different ritual scenes with hieroglyph captions and
  cartouches. Each wall gets whole registers of scenes, and every scene faces into the temple; each
  pylon tower shows one smiting scene, centred, with the god standing by the gate.
- Thebes' ram-headed sphinxes are modelled in rounded forms instead of blocks: a barrel back,
  rounded shoulders and haunch, forelegs rising into the chest, a ram's head with a long sloping nose
  and horns curled round the ears, on a moulded pedestal. Small carved parts on every asset no longer
  show a jagged fringe at their edges.
- A third culture, Old Kingdom Giza (c. 2515 BCE, under Menkaure), shows the pyramids as they looked
  new: cased smooth in white limestone to the apex, Khafre's foot in red granite, Menkaure's lower
  casing in undressed granite. Each pyramid stands on its court with a mortuary temple on its east
  face, and a causeway runs down to a valley temple on a harbour. The site also has:
  - the Great Sphinx in its quarry, with no beard yet, and its temple before it;
  - Khufu's queens' pyramids and boat pits;
  - mastaba tombs laid out in streets;
  - the Wall of the Crow and the workers' town of galleries, bakeries and houses;
  - ships bringing stone along the canal.
  It is the first site on a raised plateau: the ground falls from the desert down an escarpment to the
  floodplain, and slanted faces now turn and lift with their asset.
- Giza at work: Khufu's and Khafre's satellite pyramids, and Menkaure's temples as a building site with
  stacked blocks, a mud-brick ramp and loaded sledges. The main quarry stands south of Khafre, stepped
  down from its rim, and Tura limestone sits stacked on the quays. Each capstone is plain limestone, as
  the one found at Giza is; `pyramidion: 'electrum'` gilds them as a labelled conjecture, since gilded
  capstones are attested only from the 5th Dynasty on. New views: the building site, and beside the
  Great Pyramid's apex.

### Historic countryside

- **In progress.** A historic city gains sub-scenes for what its people could make and grow, beside
  what they built: the first is the countryside that fed Sumer. A branch canal leads water through
  baked-brick sluices into channels on low banks, with long strip fields between them. Off in the
  fields stands a farmstead: a house round a walled yard (bread oven, reed shade, a ground loom), a
  blind storehouse filled from roof hatches up an end stair (the barn of a dry country), a stable of
  piers and mangers, a reed byre with ringed reed posts through its roof and its dairy jars, a
  reed-fenced sheepfold, a round threshing floor, a tool shed, a shaduf on the canal bank and a palm
  garden.
- The tools are the period's own. An ard plough (a seeder with its funnel in the sowing season),
  clay sickles (Sumer reaped with sickles; the scythe is Iron Age), hoes, mattocks and winnowing
  shovels, a two-wheeled cart and a four-wheeled wagon on solid three-plank wheels, a threshing
  sledge, grain heaps sealed in mud, measures, baskets and jars.
- The scene keeps to a season, because a Sumerian year kept the work apart. At harvest (the default)
  the barley stands and is being cut, sheaves are stooked and carted and the threshing floor is
  busy, while a fallow strip is broken with the plain ard. At sowing the seeder plough is in the
  furrow and the fields are furrowed and sprouting. Fields show as furrows, sown rows, stubble and
  standing barley. The page opens from the air, in the yard, at the threshing floor, at the edge of
  the reaping, or by the plough.
- Tools and buildings only, at rest: people and beasts are left to their own builders, so a plough
  stands with its yoke on the ground, a cart with its pole down, the pens and stalls empty.
- Each piece cites its record, every gap reported. A beam (a straight timber at any slope) joins the
  angled building blocks. Small faces no longer stretch along their length when they are sealed
  against hairline gaps; before, a long roof edge overshot its building by up to a third, in the
  town too.
- A second sub-scene shows the works: how Sumer made its tools and its building stuff, and from
  what. The plain had clay, reed, water and palm, and no stone, ore or tall timber.
  - Its quarry is a clay pit sunk into the plain by a canal. Beside it are treading pits with straw
    for temper, a moulding field of fresh bricks drying in rows (the wooden mould left at the end of
    the last row), stacked hacks, and an updraft brick kiln with its fuel, ash and baked bricks.
  - The potters have a shade over the wheel, greenware drying, stacks of bevelled-rim bowls,
    settling tanks, a wasters heap and the town's beehive kilns.
  - A landing takes in what the plain lacked: stone, basalt querns and flint, with a knapping
    floor. Bitumen boilers cook mastic beside it.
  - The forge is a coppersmiths' yard. Ingots smelted at the mines are melted there in crucibles on
    bowl hearths blown with reed pipes, then cast in stone moulds and finished at an anvil stone.
    Charcoal clamps burn beside it.
  - A wheelwright makes the carts' three-plank wheels.
  - The reed cutters stack and plait at the marsh.
  - The page opens from the air, or at eye level in the brickyard, the forge, the potters', the
    landing, the clay pit or the wheelwright's.
- A slanted panel now turns with its piece, so pieces can carry sloping faces like a pit's cut
  sides. A roof on posts draws its underside.
- A third scene sets the city in its land. The walled town stands in the middle and its canal runs
  on past the walls both ways. Around it the land is zoned by what each place needs:
  - Upstream: the brick and pottery quarter on both banks (clay pits, brick fields and kilns,
    potters' yards).
  - Below the town: the harbour (kar), with its quays and boats, merchants' storehouses, bitumen
    boilers, and the coppersmiths with their charcoal clamps.
  - Along the levees by the walls: palm gardens.
  - North and south: strip fields on their channels, with a farmstead in each quarter.
  - Where the canal runs out: the reed marsh. On the steppe at the edge: sheepfolds.
  - The page opens from the air, from low over the quarter or the harbour, or at eye level in the
    fields, at the harbour or by the kilns.
  - From the air the small things (jars, tools, fence posts) are left out. An eye-level page
    carries only its own view: it leaves out what is behind the camera and draws the ground only to
    about 220 m. Drawing a whole land's ground at that detail runs the page out of texture memory.
- The town can be planned without its own fields and palms outside the walls, and gives the line of
  its canal, so a larger scene can carry the canal on.
- Egypt gets the same sub-scenes, at the date of the Thebes town (about 1250 BCE): a countryside
  and its works, built from Egypt's own tools and buildings.
  - Kept from Sumer: the clay pit, the treading pits, the brick field and the hacks. Egypt made
    brick the same way and did not fire it, so there is no brick kiln.
  - The farm ploughs with a horn-yoked ard and broadcasts its seed. It reaps high with flint-toothed
    wooden sickles, and carries the grain off in rope nets and donkey panniers rather than carts.
  - The cattle trample the threshing floor inside its kerb. Scribes measure the grain under a shade,
    and it is stored in a court of domed silos. The A-shaped hoe sits in the tool shed.
  - Newer things Egypt had: an upright loom, a vineyard on forked-post pergolas with its treading vat,
    pottery beehives, and checkerboard garden beds by a shaduf pool.
  - A third season: the inundation, with the basins under water.
  - The works:
    - a sandstone quarry face with stepped benches and blocks freed by trenches and wedges;
    - sledges on wetted sleepers bringing blocks to a masons' yard, where a colossus stands in its
      scaffold;
    - a stone quay with a barge carrying a granite block;
    - a foundry blown by trodden pot bellows, with oxhide ingots;
    - a glass and faience works;
    - carpenters sawing a plank lashed to a post;
    - a chariot shop making spoked wheels;
    - a boatyard with a plank hull on stocks;
    - the potters' tall kilns and bread moulds;
    - papyrus works by the marsh.
  - The farm opens from the air, in the yard, at the threshing floor, at the reaping, by the plough
    or over the flooded basins. The works open from the air, or at eye level at the quarry face, on
    the sledge road, in the masons' yard, the foundry, on the quay, in the boatyard, the glass works,
    the chariot shop, the brickyard or the potters'.
  - Each piece cites its record, every gap reported.
- The farm's eye-level views (Sumer's too) cut the ground finer near the camera, so it no longer
  drops out in front of the eye.
- Egypt's farm and works now use the Thebes town's own colours and wall skins, so a farm and the town
  beside it are the same Nile mud and the same gypsum wash.
- Thebes in its land: the town on the Nile's east bank, about 780 × 640 m of country around it.
  - The river runs on north and south past the town.
  - Downstream (north): the harbour, with stone quays, a barge and ships, a boatyard and granaries.
  - Upstream (south): the works, set by what each needs. The clay pits are at the water, with brick
    fields behind them. A stone quay and the masons' yard take the sandstone barged down from the
    quarries; then come the potters, carpenters, chariot makers, the foundry and the glass works.
  - East of the town: basins between their dykes, with the estates among them, out to the edge of the
    low desert. Shadufs and palms line the bank.
  - Three seasons: in the flood, the basins lie under water.
  - It opens from the air, in the fields, on a harbour quay, in the works, from a boat on the Nile,
    or in any of the town's own views.
- A region of an unknown culture is an error rather than a Sumerian town.
- The region's ground stays on the ground in the walkable World. A region is large enough that the
  World read the town's thin ground layers as one plane and stacked overlapping strips upward (by up
  to 4 m in Sumer's); its layers are now spread far enough apart to stay separate planes.

### Historic light

- **In progress.** A historic town takes the sixth-gen composer's light: the sun is baked once at build
  time and carried by the page. Each culture has a style card (`lib/graph/historic/style/`) that states
  how its town should look as principles, plus the numbers the builder reads. Each principle has a
  machine check (`style.test.js`).
- Cast shadows on the ground (`lib/graph/historic/light.js`). Every mass stands in an occluder
  heightfield. Battered walls, ziggurat tiers and pyramids are sliced so their slopes cast their true
  stepped profile. One sweep along the sun's azimuth then finds the ground in shade. A palm's crown
  floats and casts a gappy disc from its height.
- Sky occlusion darkens the foot of every wall and the floor of every narrow alley.
- The shade is a cool tint at the card's alpha, never black. It is one map for the whole town (about
  300 KB), laid into every ground face's background at that face's place, so overlapping shadows never
  darken twice.
- Measured on the current plans: Sumer's alleys are about a third in shade, against a twentieth of its
  main streets and a tenth of the precinct court.
- The page's backdrop is the card's sky, hazy blue overhead and pale with dust at the horizon,
  replacing the flat beige.
- `shade: false` leaves both off. The CSS 3D page only: the WebGL World ignores the map and keeps its own
  light. Shadows land on the ground, not yet on walls or lower roofs. The region, farmstead, works and
  asset-sheet scenes are unchanged.

### Historic Hellenic

- **In progress.** The first Greek city: Hellenistic Lindos on Rhodes, c. 180 BCE (`culture: 'lindos'`), and the
  first town on a sea cliff. The sanctuary of Athena stands on a rock 116 m over the water. Below it the town lies on
  the saddle between the great harbour and St Paul's bay. The picture is cropped to what the eye reads (the rock,
  the town, the two bays), not the whole district.
- Its record (`lib/graph/historic/record/lindos.js`) cites the temple (21.65 × 7.75 m, four Doric columns at each
  end), the propylaia, the 87 m stoa with its 42 columns and 21 m stair, the theatre and Pythokritos' ship relief. It
  lists what the scene must not show: the Knights' castle, the white cubic village, whitewash, the 1930s
  restorations, the Lindian Chronicle. Athena's sacrifices were fireless, so her altar never burns. Heights the
  record lacks are marked as conjecture in the kit.
- Rock is made, not drawn (`lib/graph/historic/rock.js`). The layout gives the rock its shape, and the landform
  operators weather it: strata bench and band the faces, joints break them into blocks, talus sheds scree at their
  feet. It is meshed in slices at the bed planes, so the cliff reads in bands. Only steep ground is weathered. The
  summit the temple stands on, the climb, the stair, the theatre and the town keep their exact levels.
- Ground that is not flat, for any culture (`lib/graph/historic/terrain.js`). A layout's height function may jump.
  Where it does, the step stands as a vertical face on the true contour, found by bisection: a cliff (bare rock) or,
  under 4 m, a dry-stone terrace wall. The town is built on terraces 3 m apart, with a street at the foot of every
  terrace wall and stairs climbing between them.
- The land casts. A style card can stand the land in the light bake (`light.terrain`), so the cliffs throw their
  shade on the sea. Lindos' card states six principles, each with a machine check: the value order of stucco,
  plaster, rock and cliff; the cliffs' shade on the water; the climb rising station by station, with nothing higher
  than the goddess; terrace walls no taller than a storey; turquoise shallows and a deep sea; fire in the town,
  never on the altar.
- A kit of the Doric order shared by every building: column, entablature with triglyphs, pediment, tile roof. It
  builds the temple, propylaia, stoa, great stair, theatre, courtyard houses on stone socles, the ship relief, statues,
  towers, kilns, a round tomb, warships and boats. Each was designed from a massing sheet dreamed on the local image
  worker. New patterns: classical order, tile roof, stoa, propylon, theatre, round tomb, peristyle, acropolis,
  terraced hillside, sea cliff, rock relief, statue base. New wall skins: dry stone, stuccoed poros, isodomic ashlar.
- Fire is opt-in (`fire: true`). The plan hands over its house hearths and potters' kilns as fire sources, in the
  fire channel's kinds. Without it the plan carries none.
- The generic Hellenistic polis (`culture: 'polis'`) is the same plan on a gentle hill, with no cliff and no open
  sea, so other Greek towns can start from it.
- **Historic cities on the WebGL World page** (`assembleHistoricWorld`, `renderHistoricCityToWorld`). The CSS 3D
  page draws each face as its own HTML element, and Chrome starts dropping faces when a town's eye-level views pass
  about ten thousand of them. On the World page the same faces are a few draw calls. Lindos loads in under a
  second and holds 60 fps in every view, at about 7.9 MB against 12.4 MB for the CSS page. The World page takes
  the scene as it is, its ground tiles and wall skins resolved to textures and the style card's sky as its sky
  dome. The CSS shade map is not baked for it (the World never reads it). The CSS page stays the light aerial
  preview.
- **Water you can see into.** On the World page the Lindos sea takes the native water look (`lagoon`): ripples,
  the sky reflected more strongly at a grazing angle, a sun glint, and froth where the water thins against the
  shore. Its depth comes from a seabed that shelves gently off the beaches and drops away under the cliffs, worked
  out from the distance to the shore. The water is clear turquoise over the sand in the shallows and opaque blue
  offshore, set by each corner's opacity on one translucent sheet whose pieces never overlap. The seabed (about a
  thousand triangles near the shore) is drawn on the World page only. The CSS page keeps its opaque two-tone sea.
  A culture opts in with `water.look`; terrain water takes `liquid`, `alphaAt`, `sheetFill` and `fine`.
- **Live fire on the World page.** With `fire: true` the potters' kilns and the hearths in the house courts burn
  live: flames, sparks, smoke and their light on the walls and ground. The painted flame cards stand down there,
  and the CSS page keeps them. The fire channel takes a new opt-in `unit` (metres per scene unit;
  `firePageChannel(…, { unit })`). The fires are given and burn in metres, since their buoyancy, smoke and sparks are
  physical, and the page scales them into the world's units, with their light falling off over the same metres.
  Without `unit` the fire script is byte-identical.
- Views: the great harbour from a boat (`bay`), the climb, the stoa's terrace and great stair, the temple court, the cliff from the sea, the
  theatre and a town street. Sumer, Thebes and Giza are byte-identical.

### Historic Qin

- **In progress.** Qin Xianyang and the Lishan works at c. 212 BCE, the first Chinese culture. Qin is the
  earliest Chinese city that still reads as Chinese (grey tile roofs, red columns, raised earth terraces,
  walled axial compounds), and early enough that its roofs are honestly straight.
- Its own record (`lib/graph/historic/record/qin.js`): Xianyang Palace No. 1, Epang's front hall begun,
  the Lishan mound, enclosures, gates and halls, terracotta Pit 1, the Wei bridge and the Zhengguo Canal.
  Each entry is cited and dated, with its confidence and the disputes between sources. Settled by the record:
  - No outer wall at Xianyang has been found, so none is drawn as fact.
  - Upswept eaves and glazed roof tiles are held with their much later dates.
  - The Han analogues (the Gaoyi que, pottery tower models, the Sichuan market brick) carry their CE dates,
    so a Qin scene uses one only by naming it as an analogue.
- A style card with a design language (`style/qin.js`):
  - One batter for every earth face, about 77°, with pounded courses of 6–10 cm.
  - Columns six to eight diameters tall on stone bases, one bracket block each.
  - Straight hip and gable roofs, with eave-end tiles 16 cm across.
  - A palette sampled from reference swatches.

  Each principle is checked on the kit before any town plan exists. The reference drawings, and what each
  one gives the kit, are indexed in `docs/historic/qin/`.
- The town (`culture: 'qin'`, layout `wei-wards`): Xianyang on the north bank of the Wei, with no outer
  wall.
  - The palace enclosure holds Palace No. 1 on its two-tier terrace, a lesser hall either side, and a
    pair of que in its south gate.
  - The axis runs on as a poplar-lined avenue to a timber pile bridge over the river.
  - Walled wards line the avenue, each with its gate on an east–west avenue and lanes of courtyard houses
    inside; the row under the palace is the elite's, with higher walls and tiled, hipped halls.
  - One ward is a walled market with its drum tower (a Han analogue, labelled as one).
  - Across the river, Epang's front hall is a building site of rising earth sections, plank forms, ramps
    and spoil.
  - Loess fields of millet and wheat lie round the town.
  - Views: palace, gate, avenue, ward, market, bridge, works.
- The Qin kit (`assets/qin.js`) builds every piece from the card's numbers: hall on terrace, que,
  rammed-earth wall, ward gate, courtyard house, market, terrace works, bridge and trees.
  - Roofs are frusta whose top is a ridge line, so they are straight by construction.
  - Two new wall skins: `hangtu` (pounded courses, rammer dimples, the board-form lifts and tie holes) and
    `tile-roof` (cover rows over pan channels). The tile skin is the first laid on a sloped face.
- New shared patterns: rammed earth, tiled roof, timber frame, terrace hall, walled ward, market and bridge.
- The page is about 21 MB, between Giza's and Thebes'. The other cultures are unchanged.
- The Qin ground in two steps, on the shared terrain mesher (`terrain.js`) as Lindos' is: the layout gives one
  height function and the mesher stands the steps up.
  - The palace stands on the lip of the Xianyang tableland, 10 m up. The bluff beneath it is sheer loess,
    ragged except under the palace, and cut by two gullies whose floors climb to the tableland.
  - The wards lie on the plain below. The axis climbs the bluff to the que as a rammed-earth causeway.
  - A new `bluff` view looks along the edge.
- The Wei through the same water channel as Lindos' sea. It uses the native `river` look, silty and flowing
  east, near opaque over the channel and clearer over the bars' shoulders, with a riverbed under it on the
  World page.
  - It is braided round sandbars. Each bar stands out of the bed with a low lip, so the mesher traces its
    outline on the true contour instead of stepping it to the grid.
- The World page is cropped to the town. A layout can ask for a skirt (`plan.world.skirt`): the land runs a short
  way past the frame, its heights carried out from the frame's edge, each corner fading to the sky's horizon
  colour with its distance. Past it there is only sky, so the town stays the focus however the World is turned.
  Qin's runs 260 m. Cultures without a skirt are unchanged.
  - Beyond it, on the World page only, a hazy Qinling in the south and the northern hills. They are brought in
    and scaled so they sit at about their real angle on the horizon.
- The height of the bluff and the line of the river are drawn, not measured. Both are in the record as
  unverified (`xianyang-tableland`, `wei-braided`); the Wei has since moved north over the old town.
- Qin opens on the shared World page (`renderHistoricCityToWorld`) like Lindos: about 15 MB self-contained,
  against about 21 MB for the CSS page.

### Historic entries

- **In progress.** The historic cities reach the agent. Until now they were reachable only from code.
- New world kind `historic`: `create_sketch({ manifest: { kind: 'historic', culture, scene, seed, … } })` mints
  a culture at its period as a walkable World:
  - `scene` is `city` (every culture), or `region`, `farm` or `works` where the culture has one;
  - an unknown culture or scene is refused with the list of ids;
  - the cities, regions, farms and works render as they did, byte-identical.
- Each culture card gains `readAt`, `period` and `place` as data, from its own documented header. Sumer has
  no read-at year yet: its card spans the Uruk and Early Dynastic periods. The generic polis has no place;
  it is invented.
- A caption for every historic scene (`lib/graph/depiction.js` `describeHistoric`), read from the cards.
  It keeps two questions apart: the PERIOD (when and where) and the DEPICTION (the era's budget plus a look).
  For example: "New Kingdom Thebes · New Kingdom, c. 1550–1070 BCE (read at c. 1250 BCE) · Thebes, Upper Egypt
  — drawn sixth-gen, to the thebes style card". A field a card lacks is never guessed.
- Encyclopedia entries, generated from the culture, record and style cards (`lib/graph/historic/entries.js`)
  and served as view-vocab cards of a new family `entry`. No tool is added and no tool description names an
  entry. An agent goes from a cold ask to a world in three calls:
  1. `semantic_search` finds the entry;
  2. `get_view_vocab({ id })` reads it;
  3. `create_sketch` mints one of its starters.
- What the cards carry:
  - **An entry** holds the infobox (subject, period, place, depiction, basis, checks), its parts by the ids
    its generators use, its scenes, and STARTERS: `historic` manifests to copy and change.
  - **Its record** (`<id>/record`) lists each record entry with its confidence and sources. It is read on
    demand and kept out of search, so an entry always answers before its sources.
  - **A region with more than one culture** (Egypt, the Greek world) gets a hub listing its entries in time
    order.
  - **BASIS** follows the record: read → ATTESTED, secondary → RECONSTRUCTED, unverified → CONJECTURAL. The
    town plan is never ATTESTED.
  - **SCOPE** says up front that each entry is a general depiction of its period, not one year's town, so
    anachronisms are expected: pieces from across the span side by side, gaps filled from parallels. The
    hubs and the routing card say the same, and the agent is told to say it when it hands a world over.
- Culture cards gain `region`, `aliases` (the words people search with: pharaoh, Luxor, ziggurat) and
  `record`, the record the entry stands on. The entries are found on the default lexical path, with no
  embedding model.
- A card contract test holds what an entry reads off each culture card: `years`, `period`, `readAt` (or null),
  `place` (or null when invented), `region`, `aliases` and `record` (or null). A new culture that lacks a line
  fails with the list of lines its card still needs. A card that says nothing about its place reads "place not
  recorded", never "invented". A region with no row of its own still gets its hub.
- Pompeii and the Forum Romanum (79 CE) are entries too, with their records and a Roman Italy hub: "pompeii",
  "vesuvius", "the roman forum" and "ancient rome" find them.
- `semantic_search` takes English terms, as its description already says. The host model translates first.
- A routing card, `historic`, sends a cold request to the entries. The routing eval gains rows for it.
- `get_view_vocab` takes the `entry` family. create_sketch's `manifest` property names the `historic` kind.
  The `tools/list` payload pin moves from 267,900 to 268,200 (measured 268,159).
- Fix: an upgraded install now indexes cards a release ships. The search index used to be built only when
  empty, so new cards (these entries, and any routing card added since) stayed unsearchable until a manual
  reindex. Once per process, before the first search, a corpus built by a reindex is checked for shipped
  cards it lacks, and one reindex adds them.
- Fix: record cards cite a group author whole ("various", not "various (sxlib").

### Historic on-ramp

- **In progress.** Adding a culture is a card, a registry line and a scaffold, at any depth:
  - depth 0: a card on another culture's layout and kit, in its own colours;
  - depth 1: plus its record and style card;
  - depth 2: plus its own assets;
  - depth 3: plus its own layout.
- Registries, one line per culture or layout: `historic/cultures/index.js`, `historic/layouts/index.js` and
  `historic/regions.js`, beside `historic/style/index.js`. `planHistoricCity` dispatches from the layout table
  and refuses an unknown layout id. A view the scale table does not name renders at eye level instead of an
  undefined scale. Every page is byte-identical.
- Each culture's depth is found, never claimed (`historic/depth.js`): what it shares with a culture
  registered before it, by identity. Its entry says it on a DEPTH line, for example "0 of 3: its own style
  card; record, assets and layout from lindos" for the polis.
- A card's `land` names its farm and works scenes, replacing a table written into three files. The scene lists
  follow the registry.
- `scripts/new-culture.mjs <id> --like <culture> …` scaffolds a culture at depth 0:
  - it writes a card spread from an existing culture, with every contract line filled or null, `record: null`
    and `land: null`;
  - it adds the registry line and `docs/historic/<id>/README.md`;
  - the culture renders, mints and is an entry on the first run;
  - `--dry` prints without writing; bad input is refused with what is on offer.
- A culture checklist test (`historic/cultures.test.js`): every layout is registered, every style card has
  its culture, every entry states its depth, every layout takes a card spread under a new id, and the
  scaffold is checked dry.
- The guide, `docs/historic/README.md`, covers the parts of a culture and their registries, the depths with
  the asset loop, new regions, the gates, and landing a culture on the trunk. A project skill,
  `/historic-culture`, runs it in order.

### Historic lineage

- **In progress.** Cultures draw on cultures. A culture card's `draws` names the earlier cultures it continues,
  inherits from, took forms from by contact, or varies, and what each relation carries (palette, skins,
  patterns, assets, layout, record).
- `historic/lineage.js` reads the tree off the cards. Its brief lists what a new culture can draw on at its
  year: patterns, skins and assets, and the record entries in use then. Drawn record entries stay the source's:
  each is a parallel to verify, never the new culture's own basis.
- What a record carries depends on the kind of relation. A tradition travels as its materials and methods
  (`inherits`, `contact`, `contemporary`); a culture's particular buildings and town form pass only on the same
  ground (`continues`) or to a version of the same town (`variant`).
- The relations now recorded: Thebes continues Giza; the polis is a variant of Lindos; Pompeii and the Forum
  inherit the Hellenistic orders from Lindos; the Forum is Pompeii's contemporary.
- Each entry gains a LINEAGE line, and a `historic-lineage` card in the encyclopedia holds the tree.
- `scripts/new-culture.mjs --draws <culture>:<kind>[:<parts>]` writes the relations on the new card, joins
  the patterns they carry, and writes the brief into its README. Dry runs for a Ptolemaic Thebes
  (continues Thebes, contact with Lindos) and a Byzantine Constantinople (inherits from the Forum and Lindos)
  each list what to start from.
- `historic/lineage.test.js` holds relations to history: every source registered, no culture its own ancestor,
  a source beginning before the culture drawing on it ends, a continuation beginning earlier, a variant on its
  source's layout. Every historic page is byte-identical.

### Animal entries

- The animal roster reaches search the way the historic cultures do. Each species gets an encyclopedia entry,
  generated from the roster (`lib/graph/fauna/entries.js`) and served as a solid-vocab card. No tool is added,
  and no tool description names an animal.
  - **The index** (`animals`) lists every animal by the name people say, plus the animals people ask for that
    aren't built yet, each with the built species that stands in.
  - **A hub per family** (`animal/feline`) lists its species and its NOT YET rows.
  - **An entry per species** (`animal/houseCat`) gives the subject, size, stance and basis, the STARTER spec to
    mint, and its kin.
- Each family module gains `about` (`common`, `aliases`, `sci`, `size`, `source`, moved out of the thesis
  comments into data) and `wanted` (`near`, `aliases`, `note`). The facts never reach a plan: every species
  builds byte-identically.
- `mint_solid` kind `animal` takes the name people say: `species: 'cat'` mints `houseCat`, and the result's
  `resolved_from` says so. Plurals and articles resolve too ('a penguin', 'wolves'). An asked-for animal
  that isn't built yet ('koala') is refused with its stand-in named. An unknown word points at the roster.
- A species minted as a ring plan reports its real stance (`four legs`, `two legs (a bird)`, `swims`,
  `legless`, …), not `quadruped` for all of them.
- A roster contract test holds what an entry reads:
  - every species has an `about` row;
  - every `wanted` row names a built stand-in and isn't built itself;
  - no name is claimed by two animals.
  A new roster (the arthropods) joins by adding itself to `ROSTERS`.
- The `get_solid_vocab` bare listing stays one row per kind and op: the generated entries are left out, and
  the `animal` card points at their index. The unknown-card error lists the hand-written cards and names the
  entries.
- The `animal` manual and routing card no longer list the old species ids or say `opts` work on a species.
  They point at the `animals` card.
- Fix: an upgraded install now indexes new solid-vocab cards too. The shipped-card check used to look at
  view-vocab and routing cards only.

### Fauna roster completion

The animal encyclopedia's asked-for animals built, and the house cat given a head that reads as a cat. Every species
already built keeps its plan except where named below.

- **The faceted feline head.** The house cat's head is now a low-poly mesh built from interlocking facial volumes
  (cranium, cheekbones, muzzle pads, nasal bridge, chin; the eye sockets carved in), placed by landmarks measured off a
  reference sheet: almond eyes with vertical slit pupils, a pyramid nose, wedge ears with a recessed inner ear. Its
  lower jaw is its own shell, hinged on the same `jawOpen` dial as the ring-plan heads (0–35°), the mouth's lining
  showing when it opens. Worn through `headMesh`, which takes a jaw and an `anchorZ` (the height a head is seated on the
  neck by; default the middle, so the raccoon is unchanged). The cat's trunk and legs are fuller and its neck shorter.
- **Eyes that show.** The seated ("set") eye now opens its lids nearly round, sinks the ball a third of its radius and
  keeps the lid a narrow rim; a species that wants a drowsy eye asks for its own opening.
- **Fifty more animals.** Every animal the encyclopedia listed as asked-for is built, each at its published size
  (`about` names the source) and passing the fit gates (closed, attached, grounded, size): coyote, spotted hyena,
  jaguar, Eurasian lynx, warthog, woolly mammoth; donkey, llama, reindeer, elk, yak, water buffalo; house mouse, brown
  rat, Syrian hamster, guinea pig, European hedgehog, North American porcupine, brown hare, European badger, striped
  skunk, meerkat; white-faced capuchin, western lowland gorilla, Bornean orangutan, ring-tailed lemur, three-toed
  sloth, koala, red-necked wallaby; tokay gecko, green iguana, veiled chameleon, American alligator, red-eared slider,
  green sea turtle, common toad; Atlantic bluefin tuna, white-spotted puffer, southern stingray; ostrich, rooster,
  turkey, peacock, American flamingo, mute swan, Canada goose, rock pigeon, American crow, toco toucan, ruby-throated
  hummingbird. Their gaits follow their families, with species overrides where the animal moves differently (the
  lizards stand on four sprawled legs, the ostrich does not fly, the waterbirds paddle, the sea turtle flies underwater
  on its flippers, the sloth only crawls, the meerkat sits up and walks). The bobcat, emu and raven are asked-for rows
  now, standing in as the lynx, ostrich and crow (they had been aliases of other species).
- **Spotted coats.** The jaguar, lynx and hyena wear their spots on a fine coat shell (`lib/graph/fauna/coats.js`):
  round, irregular patches and broken rosettes laid out in metres, not whole faces of the trunk's coarse ring.
- **The throat.** A long face's jaw is joined to the neck (a giraffe's, a camel's, a horse's jaw held its rear corner
  out in the air); buried where the neck already meets it; birds, frogs and worn head meshes leave it out.

### Animal locomotion studies

- **In progress.** Every animal gets the way it moves, written down by the biomechanics of its family, so it
  can later be animated by the leg-step and spine mechanics of its kind.
- The roster sorts into nine shared rigs (`lib/graph/fauna/locomotion/`): running toe-walkers, hoofed,
  flat-footed, pillar-legged, sprawling, hoppers, two-legged, wing-walkers, and whole-body wave (snakes and
  fish). Each rig file holds its families' entries:
  - the gaits, named in plain words (walk, trot, gallop, hop, slither, swim, …), each pointing at a footfall
    pattern or body wave with its duty factor, stride length per hip height and speed band (Froude number);
  - the spine bone counts, fixed per family;
  - how the spine, girdles, head and tail move with the stride;
  - species overrides where a family holds very different movers (snakes and the monitor lizard; the manta).
- Where scientists disagree, the entry takes the more visual reading and says so beside the value.
- Each species' encyclopedia entry lists its gaits (`MOVES`). No plan changes: every species builds
  byte-identically.
- Every species gets a bone tree (`lib/graph/fauna/skeleton.js`), derived from the plan it already builds:
  - spine, neck and tail bones laid along the body's own centreline, in the family's fixed counts, and a
    head bone pitched as worn; a camel's or plesiosaur's lofted neck is followed along its curve;
  - one bone per leg row, chained joint to joint; the main chain of each shoulder and hip limb carries a role
    (`fore.humerus` … `hind.metatarsus`), the shared animal profile a gait solver or a clip library maps by;
  - paired fins as their own bones; snakes and fish carve their tail from the rear of the body;
  - a binding for every plan part: torso, neck and tail stations ride the bones of their own region, a leg
    stripe rides its leg, other decorations ride the body.
  It is not wired into minting yet.
- A gait solver (`lib/graph/fauna/gait.js`) poses a species' skeleton through one stride of any of its gaits, in
  place on a treadmill:
  - feet plant at their phase offset for the gait's duty factor and swing forward between; the upper leg solves
    two-link to the foot block, the foot rolls over its ground contact at the ends of the stance and the girdle
    glides (the shoulder blade on the ribs) where the leg cannot reach;
  - the body dips with the stance legs and, in a flight phase, rises on a ballistic arc timed by the speed its
    stride implies (stride/h ≈ 2.3·Fr^0.3);
  - the spine flexes once a stride in gallops, bounds and hops, bends sideways as a standing wave in the
    sprawlers, and travels as a serpenoid wave in snakes and fish (the coiled snake straightened first);
  - fins and flippers stroke, heads hold level or nod, tails trail or counter-swing and drag on the ground.
  Wing beats wait for the wing bones. `scripts/fauna-gait-strip.mjs <species> <gait>` draws the stride as a
  stick GIF (side view over top view) for the eyes gate; a machine gate checks every gait of every species
  poses rigid bones and that planted feet stay down for their duty factor.
- The snakes' spine count rises to 20 trunk and 4 tail bones: two body waves need them.
- The skeleton gains the wing bones `wing.js` builds (the arm chain with `wing.humerus` / `wing.radius` /
  `wing.hand` roles, and the digits), and a penguin's flippers as fin bones. A `fly` gait rebuilds the wing at
  each instant's fold (spread on the downstroke, half folded coming up) and rolls it about the body's long axis;
  `glide` holds it spread. Strokes beat only their own limb group (wings, pectoral fins, flippers, paddles).
- **Animals move.** `mint_solid { kind: 'animal', spec: { species, motion } }` binds the minted solid to the
  species' skeleton and carries its gaits as clips. `motion` is `true` (every gait), a gait word or a list, or
  `{ gaits, keys }`; an unknown gait is refused with the species' own list. Without `motion` the plan is the
  species' own, byte-identical.
  - The plan gets a `bind` on every segment (a limb's joint rings shared with the bones either side, a body
    station blended toward the next bone as it nears that bone's end) and on the head, plus a `motion` record
    that expandPlan carries to the recipe.
  - The mint gate binds every vertex and checks the weights; the stats report the bones and the clips.
  - At read time `packFaunaRig` (`lib/graph/fauna/rig.js`) packs the mesh through `packLayeredRig` with a stand-in
    rig of the skeleton's bones and no clips (the humanoid path is untouched), then appends one clip per gait from
    the gait solver: the absolute rotation and posed head of every bone at every key, and the stride's own
    duration. The World page previews the clips, the skinned GLB carries them (`export_model { clips: '_all',
    skinned: true }`), and the Godot pack plays the first.
  - The worn wing still rides its root bone rigidly; weighting its surface from wing.js's own bindings is next.
- The equine trunk is shaped in its mammal regions instead of one even barrel: a rounded buttock, broad quarters
  over the hip, the loin and flank tucked in and up (the belly line climbs to the stifle), the rib barrel deepening to
  the girth behind the elbow, the withers, and a narrow breast. It sits on the stable ring frame (`torsoUp`) so the
  centres can rise and fall. The horse and zebra change (the zebra's stripe hoops now follow the trunk's height as
  well as its radius); the camel keeps its own level trunk and builds byte-identically.
- The horse and zebra heads are rebuilt level at true size and pitched nose-down (`headPitch`), instead of sheared
  (the shear stretched the skull along its slope to ~0.9 m, half again a horse's, and slanted every feature). Now
  ~0.59 m poll to lips (published 0.55–0.65 m): a broad flat forehead with the eyes set on the sides at its widest,
  seated and lidded (the set eye); a nasal line narrowing to ~0.10 m mid-face; a soft muzzle flaring at large open
  nostrils with no bare nose pad; a round jowl curving up into a thin under-jaw, chin and lower lip; the mouth line
  only over the last quarter (behind the corner the jaw covers the seam). The zebra's head grows to ~0.52 m.
  Three opt-in builder fields carry it, each zero bytes when absent: `nostrilR` / `nostrilSquash`, `nosePad: false`,
  `webJaw` (the jaw end of the mouth-corner web). The camel and the giraffe (whose head starts from the equine one,
  now exported as `CLASSIC_HEAD`) build byte-identically.
- Tails balance the body instead of swinging as decoration. A tail is the snakes' and fish's travelling wave run
  from the pelvis (one helper, `travelling`, now drives both; every snake and fish wave is bit-for-bit unchanged): its
  root answers the spin the swinging legs give the body, each foot's fore-aft travel signed by its side for the yaw
  and summed for the pitch, so a trot's diagonal pairs cancel and the tail rides calm, a biped's stride or a pace sways
  it, and a hop or bound swings it up and down. The plain tail words (`TAILS` in the locomotion data) carry the
  mechanics: a `counter`weight swings stiffly against the spin, a `trail`ing tail follows late with a whipping tip, a
  `prop` is planted as a fifth leg (the kangaroo's slow walk presses it to the ground with the forelegs), `drive`
  trails on land and rests while fins row. A heavy tail answers with a smaller swing (it shrinks as the tail outgrows
  the hip height). The kangaroo's tail is now `prop` and the crocodile's `counter`; every species card carries a
  `TAIL` line saying what the tail does.
- A tail's motion now follows from what it is made of and how long it is, measured from the model. `TAIL_BUILDS`
  (flesh, fur, hair switch, stub, feather) say how much of the drawn girth is mass, how freely it swings and whether
  air lifts it; each family has one (the squirrel's is fur). From the plan: the tail's inertia over the body's and
  over each leg pair's, and its swinging length (a horse's hair included). A counterweight answers the legs' angular
  momentum by their inertia over the tail's (a T. rex's heavy legs sway its tail; a squirrel's light legs barely
  move its), a share of it in steady straight gaits (turns and leaps use the rest). A trailing tail sways with the
  hips at a walk and trot and is braced at the gallop (Wada et al. 1993, dogs). On top, every free tail is a
  pendulum shaken at its root by the hips' sway and the body's real bob: a long hair switch swings late and wide, a
  bushy brush shaken fast stays put while the body bounds beneath it, and hair and fur stream up at speed. The
  white-tailed deer flags its tail in flight (`flag`); the moose holds its still. A body part that is not a tail no
  longer binds to tail bones (the kangaroo's trunk rode `tail0`). Cards read `TAIL  <build>: <use>`.
- The spine follows the footfalls instead of a fixed wave. From above, each girdle turns with its own pair's leading
  leg (`axial.yaw`, which the solver had ignored: the shoulder or hip swings forward with its leg, lengthening the
  stride), and the trunk bends between the two (`axial.lateral`, the sprawlers' standing wave, now locked to which
  feet are down): opposite turns in a trot bow it into a C that flips each step, the same turn in a pace bends
  nothing, and most of the girdles' common turn is cancelled so the trunk swings about its middle. From the side the
  back rounds as the legs gather (hind feet forward, forefeet back) and stretches as they extend (`axial.flex`): hard
  in a gallop and a bound, slight in a trot, none in a pronk. The planted feet still hold (the legs absorb the
  girdles' turn); every snake and fish wave is unchanged.

### Environmental sound

- **In progress.** A historic world can carry its period's music: add `"audio": { "soundtrack": "default" }`
  to a `historic` manifest and the world plays a synthesized bed in its culture's mood
  (`lib/graph/historic/soundtrack.js`). Each mood is led by a timbre standing in for an instrument the culture
  played:

  | Mood | Cultures | Lead instruments |
  |---|---|---|
  | Sumer | Sumer | a dark lyre pluck and a reed pipe over a drone |
  | Egypt | Thebes, Giza | a harp ostinato with sistrum shimmer |
  | Greek | Lindos, the polis | a kithara and a droning aulos over the sea |
  | Qin | Qin | a zheng with pressed bends, bronze bell chimes |
  | Roman | Pompeii, the Forum | a water organ, a cithara and a distant horn call |

- The instruments are attested; the scales, tempi and harmony are conjecture, since no ancient performance
  survives as sound. The world's seed re-rolls the performance, so two towns of one culture sound related but
  not the same.
- Without the opt-in a world is silent and unchanged. The other `audio` fields (wind, bindings, cues) still
  combine with it.
- A culture names its mood on its card (`soundtrack`). A culture scaffolded from another plays its parent's
  mood until it has its own, and a new mood is a row in `MOODS`.
- Each entry gains a SOUND line and a starter with its period music.

### Historic miniatures

- **Spike.** A historic city can stand its people about for scale and flavour: add `"people": true` (or
  `{ "density": 0–1, "citizens": false, "hands": false }`) to a `historic` manifest with the `city` scene, and
  the World page fills in two groups (`lib/graph/historic/miniatures.js`). Static figures only: no motion, no
  paths.
  - Citizens stand alone, in pairs or in households on the lanes, the open ground and the plan's square. They
    are thicker on a main street than in a back alley.
  - Field hands work in gangs on the flat ground outside the wall: stooped over the crop, at the hoe, or
    carrying.
- Each figure is the fractal city's pedestrian at a new `mini` level of detail, under 300 quads. Nobody is bare:
  every garment covers the torso and hangs a skirt of cloth to its hem (`cut`: knee, shin or ankle).
  - The skirt is fitted to the posed figure. Its top is the trunk's own waist, so it tilts when the figure bends;
    each ring below wraps the hips and legs at its height, so a stride or a bent knee pushes the cloth out
    instead of poking through. The legs under it are not drawn.
  - Sleeves carry the shirt down the forearm, and `legs` give trousers.
  - Colour is the culture's palette over the body's regions and the skirt.
  - Dress per culture: Roman tunic, toga and stola; Greek chiton, himation and peplos; the Egyptian linen tunic over
    a kilt, and the sheath; the Sumerian fleece skirt under a shawl; the Qin long dark robe, and the labourer's
    jacket over hemp trousers.
  - New work poses: `stoop`, `hoe`, `carry`.
- Beasts of burden (`lib/graph/historic/beasts.js`), on unless `beasts: false`:
  - In the fields, plough teams: two oxen abreast under a yoke at the neck, the ploughman behind.
  - On the open streets, pack donkeys and mules with panniers, and horses, each led by a driver at its head.
  - Each culture works its own herd: oxen and donkeys from Sumer to Egypt, mules among the Greeks and Romans,
    horses and oxen for Qin.
  - Each beast was designed with the creature creator (`mint_solid` kind `animal`, iterated with `update_sketch`)
    and is carried as the recipe that sketch stores. The ox is the bull gelded to a heavier draught body, short
    horns and a pale coat; the donkey and the mule are new, from the horse; the horse and the camel are the
    species. The camel is drawn by no culture here, since it came after these periods.
  - `lib/graph/figures/beast-asset.js` bakes a recipe low-poly (about 400 faces against about 9,000). It uses the
    animal kind's overlap body, keeps the coat and its pale belly, and drops the eye and nose dots.
  - Beasts come after the people on their own seeded stream, so turning them off moves no one. Each needs footing
    under all four hooves, clear of the people.
- The people and the beasts are shaded smooth (`lib/graph/figures/smooth-corners.js`). Each corner takes the
  normal averaged over the faces that share it in its own part (a limb, the trunk, the skirt), and the World page
  shades by corner (`cornerFills`), so the low-poly forms read as rounded rather than faceted. The silhouette and
  the face count are unchanged, and a colour edge (a hem, a sleeve, a belly) stays crisp. The pedestrian takes it
  as `smooth`, off by default, so the fractal city's people are unchanged.
- The region, the farm and the works take `people` too (`lib/graph/historic/crews.js`). Their kits build every
  tool and building at rest and say who belongs there, and this places them.
  - Hitching: every yoke with a pole run back from it gets its team, two abreast, necks at the yoke, facing away
    from the pole. The yoke and the pole's front end lift from the ground to the necks. Oxen draw the plough, the
    culture's pack animal the cart, oxen or (in Sumer, as its kit says) donkeys the threshing sledge, and horses
    the chariot. The ploughman stands behind the stilts; any other driver at the head.
  - Crews: each workshop and farm building names its workers in `CREWS` (reapers bent along the barley's cut edge,
    diggers in the clay pit, moulders on the brick field, smiths, potters, the haulers ahead of a stone sledge,
    scribes in the shade). They stand in the slot's own frame, at its working front, inside it or ahead of it,
    each in a pose for the work. Byres, stables and grain packs get their beasts.
  - The region's town has its citizens on the town's own claim grid, where the region set it down. Its strip
    fields have field hands and plough teams, and its estates and quarters their crews.
  - Outside a town, a figure stands on the scene's own ground heights, so the clay pit's diggers stand on its
    floor.
  - With `people` absent every scene is byte-identical, and the CSS pages never draw people. `crews: false` leaves
    out the crews. The town's own output is unchanged by the shared placing kit this needed (`folkKit`).
- The city takes the same crews. Its work places name their people too: priests and worshippers at the altars
  and before the temples, women with jars at the wells and fountains, shopkeepers at Pompeii's shop fronts with
  customers in the street, potters at the kilns, bakers and craftsmen in Giza's bakeries and workshops, quarrymen,
  porters on the quays, boatmen aboard, traffic and a pack animal at the gates, and traders and their beasts in
  the Qin market. A crew can now stand before a slot facing into it (`before`), work up on a quay's top or a
  ship's hull (`deck`), and fill a big market or court in proportion to its area (`per`). Priests, shopkeepers and
  guards wear the town's dress rather than the labourer's. The town's own people are unchanged; the Forum, whose
  layout has no slots, has none yet.
- Dress changes with the era. Clothing is now part of each culture's record, as dated and cited `dress` entries
  next to its materials and building types (`lib/graph/historic/dress.js`). Each entry is one garment: who wore
  it (the man or the woman of the street, or the labourer), its span, its hem, sleeves or trousers, and a few
  colourways. The people wear what was in use at the culture's year, and `people.year` asks for another year:
  the buildings stay as they are, and the people dress as that year's people did.
  - A culture with nothing recorded for a year dresses as the culture it draws its dress from (the new `dress`
    part of a lineage relation): the Forum from Pompeii, the polis from Lindos, Thebes before the New Kingdom
    from Giza, and Pompeii, before its Roman entries begin, from the Greek tradition.
  - `checkRecord` checks a dress entry like any other: its wearer, its hem, its colours, and that every look
    covers the torso.
- Cloaks and headwear. The miniature can wear a cloak, hung from a collar over the shoulders, the trunk and the
  upper arms to the hip or the knee, with the forearms coming out under it. It can also wear one of three head
  coverings: a `cap`, a broad-brimmed hat (`brim`), or a `veil` that falls past the chin onto the shoulders and
  leaves the face open. Each is fitted to the posed figure the way the skirt is, in its own colour, and the
  figure is unchanged without one (`lib/graph/figures/pedestrian-asset.js`). The record now dresses people in:
  - the Roman paenula, on labourers from the early Empire and on citizens from the 3rd century;
  - the Roman palla, and the Greek himation, drawn over the head;
  - the Greek chlamys, from the 5th to the 3rd century, and the petasos on labourers;
  - the Sumerian sheepskin over the kaunakes;
  - the fur cap of the Zhao horsemen's dress, and the Qin commoner's black headcloth from 221 BCE.
- A figure stands on a kerb or a step and refuses a spot taken by anything taller.
- Without the opt-in, a world and the CSS page are unchanged, and so are the fractal city's pedestrians.
- Not yet: instanced drawing, sheep and goats for the folds, people on the Forum (its layout returns no claim grid),
  and seated poses (the scribes stand). Pompeii
  with people is a little over twice the faces of Pompeii without. The Forum layout returns no claim grid yet, so
  it has no people.

### Pompeii's land

- Pompeii gets a farm scene (`scene: 'farm'`), and a works scene is next. Both draw on a new cited record of
  its land and workshops (`lib/graph/historic/record/pompeii-land.js`), spread into Pompeii's record.
  - The record covers:
    - the villas of Boscoreale: Villa Regina's 18 dolia (about 10,000 litres) and the Pisanella's olive mill;
    - the lever press of the Villa of the Mysteries;
    - the vineyard inside the walls;
    - the bakeries with their donkey mills, the fullery, the fish-sauce works, the tannery, the dyers, the
      potters, a building site and a smithy;
    - the carts and the stable of Civita Giuliana.

    Each entry is cited, with its confidence and its disputes. What was working at the eruption but has no
    recorded building date is held from 79, not back-dated.
  - The farm is a villa rustica at the vintage, its one season. It is a new `villa` layout beside the flood-plain
    farm, which stays as it was.
    - The villa stands round its court, facing a country road rutted at its cart's gauge, with the dolia sunk in
      the court.
    - The press room and the olive mill stand behind it, the stable beside it, and the threshing terrace and a
      barn with its pergola to the east.
    - The vineyard lies in blocks of staked rows over the north, with an olive grove and a reaped field.
    - A cart waits at the gate for the grapes, its pole down to the yoke.
  - Its nine pieces (`lib/graph/historic/assets/pompeii-land.js`) are placeholders, `designed: false`, massed to
    the record's numbers where it gives them and to stated conjecture where it does not.
  - With `people`, pickers work the vine rows, treaders and pressmen the press room, two men the olive mill, and
    the household the court. Horses stand in the stable, and the cart's pair is hitched with its carter.
  - The farm's aerial view can be aimed by its plan (`aerialAt`). Sumer's and Egypt's farm and works scenes are
    byte-identical.

### Historic Rome

- **In progress.** The first Roman culture: Pompeii on a summer morning of 79 CE, before the eruption. It is
  the best-attested Roman town, town-sized like Lindos and Xianyang, and it gives a fixed moment to read at.
  - The scene covers the western half: the forum, the old town, the theatres on the south bluff, the Stabian
    Baths, Via dell'Abbondanza to Via Stabiana, and the Porta Marina climb. That is about Qin's frame, so its
    page budget is known. The amphitheatre, about 1 km east, waits for a later phase.
- Its own record (`lib/graph/historic/record/pompeii.js`): the forum and its temples, halls and porticoes, the
  theatres, the baths, the houses, shops and bakeries, the walls and gates, the water, and the tombs outside
  Porta Ercolano. Each entry is cited and dated, with its confidence and the disputes between sources.
  Settled by the record:
  - Every building carries its state at 79 CE (standing, repaired, damaged, under repair, unfinished, relic).
    Seventeen years after the earthquake of 62 the town is mid-repair, and a scene draws it that way: the
    Capitolium awaits restoration, the Temple of Venus and the Central Baths are unfinished, and only the
    Temple of Isis was wholly rebuilt.
  - Marble is a veneer on a few buildings, much of it stripped or unfinished. The town is tufa, limestone,
    concrete and painted stucco.
  - Vesuvius is one broad mountain, flat-topped and in vines. The eruption and the modern cone are held from 80,
    so a 79 read excludes them; so are the excavated ruins, the 1943 bomb damage and the post-war rebuilds.
- A style card (`style/pompeii.js`) with six principles, each checked on the kit:
  - the podium temple rules the forum;
  - painted walls, never white;
  - low red roofs;
  - the street as a channel of lava between kerbs, with stepping stones;
  - the orders' proportions;
  - a Campanian sky.

  Its roof pitch, kerb and stepping-stone sizes are design numbers, since the sources read give none. Its
  palette is estimated until the reference swatches exist.
- A design brief for the reference drawings (`docs/historic/pompeii/README.md`), in the house style of Qin's,
  with the kit constants and the gaps the record leaves. The drawings themselves are not made yet.
- The town laid out before its pieces are designed (culture `pompeii`, layout `lava-spur`). Every building is a
  placeholder until it is designed, so the asset call lists all of them as still to design and gives the drawing
  brief real sizes.
  - The forum at the record's 143 × 38 m: the Capitolium on its podium at the north end between two arches,
    porticoes on three sides, and the halls round it where they stood.
  - Via dell'Abbondanza at its recorded widths, with the other named streets. Every street runs as lava paving
    sunk between kerbed pavements.
  - The Stabian Baths, the theatre quarter on the south bluff, and the Temple of Venus inside Porta Marina.
  - About 700 houses, those on the main streets with shops, and fountains at the main crossings.
  - The spur over the plain, with the Porta Marina ramp; Vesuvius and the Monti Lattari on the World page's
    horizon.
  - Each monument's slot carries its state from the record: the Capitolium stands roofless, and Venus, the
    Apollo repairs and the travertine colonnade have scaffolding.
- The placeholders are massing blocks in the card's numbers, plus pieces borrowed as they stand from Lindos
  (the courtyard house less its porch, the wall, towers, the theatre, statues). The World page is about 15 MB,
  Qin's size.
- New shared patterns: podium temple, forum, atrium house, taberna, arch, street fountain, kerbed street. The
  other cultures' pages are byte-identical.
- The town's art, sourced into the record first (Mau's *Pompeii, Its Life and Art*, the Naples museum, Pompeii in
  Pictures):
  - **Floors and pools.** About two houses in five have a black-and-white mosaic floor in the atrium (a new ground
    tile, `tessellatum`), and every atrium has its marble-rimmed impluvium.
  - **The House of the Faun.** About 3,000 m², with two atria, the bronze Dancing Faun (0.71 m) in the first one's
    pool, and the Alexander Mosaic (5.82 × 3.13 m) in its four colours on the exedra floor between the two gardens.
  - **Painted fronts.** House fronts in cream, yellow or red stucco, a red field on a black socle. Lots on the main
    streets now face them and open shops on them. Their walls carry the election notices: a new wall skin,
    `dipinti`, with red and black capitals on whitewashed panels at head height.
  - **The forum's statues.** A row of equestrian bases down the west side and four colossal bases across the south
    end. No forum statue survives and they were probably stored after 62, so most bases stand empty; the two
    statues drawn are conjecture.
  - **Burning altars.** Before the Temples of Apollo, Vespasian (newly placed) and Isis. Roman sacrifice was burnt,
    the opposite of Athena Lindia's fireless rite; with `fire: true` the World page burns them live.
- A second pass at Porta Marina and the roofs:
  - **The gate.** Its two passages are barrel-vaulted under round arches, ringed in paler stone, with a parapet on top.
    The climb to it is as wide as the gate: a cart ramp up to the wide passage and a stepped footway up to the narrow
    one, between cheek walls, and a paved space inside. The middle cheek wall fills the full width of the pier between
    the passages, and a stone footing carries the gate's front where it stands out past the spur's edge. A walker can
    go from the foot of the ramp through the gate into town without falling.
  - **The roofs.** The borrowed Lindos house roofs rise above the wall top to their outer edge, so they seemed to float.
    They are now closed onto the walls, and the halls' gable ends are closed flush in stucco.
- New shared patterns: mosaic floor, painted notice. The World page is about 19.7 MB. The other cultures' pages are
  still byte-identical.
- A close-scale study beside the town, in progress: the Forum Romanum on the same summer day of 79, about 240 × 160 m,
  where the detail goes into the buildings themselves.
  - **The orders as real parts** (`assets/orders.js`), measured in the column's lower diameter as the Romans wrote
    them. The Attic base has its plinth, tori and scotia; the shaft is fluted in 24 channels and tapers above its
    lower third. The Corinthian capital has two rows of acanthus with raised midribs and drooping tips, the
    caulicoli, corner volutes, inner helices, and the abacus with its flowers. Ionic and Tuscan capitals sit beside
    it. The entablature segment has three fasciae, the frieze, dentils, modillions, the corona and the sima.
  - Each part is built once, to stand many times as an instance on the World page, so the detail costs its faces
    once. A Corinthian column is about 1,200 panels.
  - **The record** (`record/forum.js`), read at Pompeii's moment with Pompeii's states, mostly from Platner & Ashby,
    Digital Augustan Rome and the Parco del Colosseo:
    - Each temple carries its podium and its order with column counts and sizes. The orders are dated methods, so a
      building can use only an order Rome already had.
    - In 79 the Temple of Vespasian does not exist yet, since Vespasian was deified only after his death that June.
      Its plot below the Tabularium stays open.
    - Vesta and the House of the Vestals stand rebuilt after the fire of 64, and the Capitoline temple after 69.
    - Anachronisms are held at their real dates: Saturn's late-antique Ionic porch, Diocletian's brick Curia and
      basilica piers, the Severan Vesta, the Equus Domitiani, the Umbilicus.
    - The disputes are recorded and the scene takes one side of each: Saturn Corinthian in 79, Concord's porch of
      six columns, Divus Julius Ionic.
  - **The style card** (`style/forum.js`), six principles, each measured on the built parts:
    - each order's height, base, capital and taper in lower diameters;
    - the entablature about a quarter of the column;
    - podia with a front stair, and close-set columns;
    - Luna marble brightest, then travertine, tufa, peperino and basalt;
    - the long open square;
    - the summer sky.
    The orders module reads its numbers from the card. The design brief, with nine drawing prompts, is in
    `docs/historic/forum/README.md`.
  - **The site** (`layouts/forum.js`, the `forum` culture): a measured plan, not a generated one. Every monument
    stands at the record's size and in its facing, all of them placeholders:
    - the Tabularium's arcade over its blank wall;
    - Concord's wide cella with its six-column pronaos;
    - Saturn on its 9 m podium;
    - the Rostra with two rows of bronze beaks;
    - the Arch of Tiberius and the Golden Milestone;
    - the Curia with its porch;
    - the Basilica Aemilia's two-storey arcade over the Tabernae Novae, and the Basilica Julia's, with their naves and
      clerestories;
    - Castor, octastyle peripteral with 8 × 11 columns on its 7 m podium, its tribunal part way up the stair;
    - Divus Julius on its beaked platform round the altar niche;
    - the three-bay Arch of Augustus;
    - the Regia, the round Temple of Vesta with its 20 columns, and the House of the Vestals;
    - in the square, the Lacus Curtius, and the fig and the olive with Marsyas.

    The plot where the Temple of Vespasian will stand is left open. On the World page the Capitoline rises behind the
    Tabularium with Vespasian's rebuilt Temple of Jupiter on it, and the Palatine to the south-east. Views: the square
    from Divus Julius, Castor's corner, the Sacra Via, the Rostra, and the Capitoline brow.
  - **Instancing.** The 315 columns, entablature runs and arcade bays are 55 templates (`assets/forum.js`), which the
    World page draws as instances (`repeats`). A part turned to another side is its own template, because templates
    are baked lit; columns never turn. The CSS page draws a light stand-in for each. The World page is about 7.4 MB.
  - New shared patterns: basilica, round temple, rostra. The other cultures' pages are byte-identical.
  - **Roofs, monuments and reliefs**, sourced into the record first (Pliny's *Natural History*, dedicated in 77, says
    what "still stands"; Velleius; Platner & Ashby):
    - **Tiled roofs.** Every slope is a bed of tegulae under rows of imbrices, each tile its own shade, with
      antefixes along the eaves, ridge tiles, and a soffit under the eaves so a roof seen from below closes.
      Jupiter's temple on the Capitol has gilt-bronze tiles, and Vesta's cone bronze ribs.
    - **By the Rostra:** Octavian's horseman on the platform; the three Sibyls and the Hercules in a tunic beside
      it; Duilius's rostral column and Octavian's gilded one with his statue.
    - **In the square:**
      - the Lacus Curtius, moved to its place near the west end, with the Curtius relief on its balustrade and a
        puteal;
      - the fig, the olive and the vine with Marsyas;
      - the praetor's timber tribunal;
      - Surdinus's inscription as written, `L·NAEVIVS·L·F·SVRDINVS·PR`, in bronze letters 30 cm high set into
        the travertine.
    - **Round the square:**
      - the shrine of Ianus Geminus at the Argiletum, its bronze doors shut, as Vespasian left them;
      - Venus Cloacina's railed round shrine and the Lapis Niger;
      - Hercules and Mercury at Concord's stair, and the Victory and statues on the Curia;
      - the kneeling captives in coloured marble and the portrait shields on the Basilica Aemilia's attic;
      - the bronze Vortumnus at the Vicus Tuscus, and Caesar's cuirassed statue;
      - the Dioscuri with their horses at the Juturna basin.
    - **Reliefs and lettering** (new wall skins drawn in `relief-art.js`):
      - an acanthus scroll on Divus Julius's frieze;
      - the Basilica Aemilia's Doric frieze of ox skulls and libation bowls;
      - the Fasti's lists in the Arch of Augustus's side bays;
      - one band of gilt-bronze capitals across the fronts of Saturn and Divus Julius. These are real Roman
        letterforms, but the record holds no text for those dedications, so the letters spell nothing.
    - **Festival dressing (opt-in, `festival: true`).** Livy has the aediles hang shields in the forum only on
      procession days, so the ordinary day shows none. The option hangs gilded shields on the basilicas' piers and
      garlands across the temple fronts. Awnings are Republican one-offs (Pliny) and are not drawn.
    - Fixed: a lifted building now lifts its beams too, so the roofs of temples set on platforms sit on them. The
      World page collects an instanced template's textures, so friezes and lettering show on it.
    - The World page is about 11.9 MB, or 12.3 MB with the festival.
  - **The Basilica Julia, opened.** In the forum, as at Rome generally, decorated floors were indoors: the square was
    travertine. The record gives the Julia a coloured-marble pavement in its central hall and white marble in its
    aisles, and about 80 game boards scratched into its steps and floor (Platner & Ashby). The basilica is now a hall to
    walk into:
    - steps up from the Sacra Via onto its podium;
    - the façade arcade on all four sides;
    - aisles all round, two deep along the long sides (the five aisles);
    - inner pier arcades on two storeys carrying the galleries;
    - the nave, 82 × 16 m, rising to clerestory windows under a trussed timber roof.

    Two new floor tiles in `ground.js`:
    - `opus-sectile`: panels of cut, veined marble framed in white, alternating a giallo field round a pavonazzetto
      lozenge and an africano roundel with a porta santa field round a cipollino ring;
    - `lusoria`: white marble slabs with merels boards, the eight-spoked wheel and twelve-line boards scratched in.

    A walker crosses from the nave through the arcades to the front aisle on the floor. The page is about 12.6 MB.
  - **The Temple of Castor, as Platner & Ashby describe it, and opened.**
    - **The stairs, corrected.** The platform's front is a sheer face, a speakers' platform with a balustrade, and is
      reached by "two narrow staircases, at the ends and not in front". The broad flight of eleven steps runs from the
      platform up to the porch.
    - **The podium's vaults:** chambers in its flanks behind bronze grilles, the banks and strongrooms of the fiscus and
      of private depositors.
    - **The cella:** at the record's 16 × 19.7 m, its bronze doors swung back. Inside are the Tiberian black-and-white
      mosaic floor (later replaced by coloured marble, date unknown: recorded as a dispute), smaller columns of giallo
      antico along the walls (Italian Wikipedia), and a coffered ceiling. The twins' cult statues stand on a base at
      the back; their form is unverified.
    - A walker goes from the porch through the doorway down the cella on its floor. The page is about 13.2 MB.

### Sixth-gen composer

- Planned: levels authored the way PS2, GameCube and Xbox levels were built. They use kit pieces on a
  grid, small painted tiles and trim sheets, two-tile vertex blends and hand-placed lights baked into
  vertex colour. The character stays slightly more detailed than the world through a measured fidelity
  ratio.
- Era card and reference moods (Devil May Cry 3, Pokémon Colosseum, Super Mario Sunshine, Metal Gear
  Solid 3) in `lib/graph/era/sixth-gen.js`.
- `measureFidelity` (`lib/graph/era/fidelity.js`): renders a z-buffer at the era's 640×448 frame from
  one camera. It reports triangles, vertices and texels per pixel for the cast and for the world, and
  the cast-to-world ratio. It is advisory only.
- New world kind `stage` (`lib/graph/era/stage.js`). It takes rooms on a grid joined by doorways and
  dresses them from a kit card. The first card, `gothic-stone`, adds plinths, cornices, pilasters,
  ceiling ribs, door frames and stone tiles. Torches are seated automatically or placed by hand. Each
  one is baked into the vertex colour of nearby corners, drawn as a sconce with a glowing flame, and
  exported as a point light in the GLB. The reference's fog becomes distance haze. The stage is walkable.
- A stage is built in three layers that never share a material: the floor, a band where floor meets wall,
  and the walls.
  - The floor is flagstone paving, a different shape from the coursed walls. It is laid one tile per
    structural bay, so its long joints line up with the pilasters, and each bay uses its own variant.
  - The band is a recessed gutter in front of the plinth, with basalt rubble from the rock pool fallen
    into it.
- New `flagstone` surface tiles (`flagstone`, `flagstone-warm`, `flagstone-slate`, four variants each).
  Square and oblong flags of mixed sizes sit on a grid, with wandering joints and worn, grimy edges.
  Some flags are cracked, and the odd one is lost to its gravel bed. Every tile edge is a joint, so
  each variant can have its own layout.
- The `gothic-nave` stage kit, with curved geometry in `lib/graph/era/gothic.js`. Pointed arches have
  real depth: a recess, reveals, a soffit and a moulded ring. Engaged columns are 10-sided. The ceiling is
  a tall pointed barrel vault with transverse ribs, a ridge rib and filled end walls. Each bay has a blind
  arcade arch, a string course, and a clerestory lancet whose glass glows and casts cool light. Torches
  stand on alternate columns.
- A stage room can leave sides `open`, a set seen from the open side for iterating on one view. The
  view is then framed from the open corner.
- First exterior stage kit: `delfino-plaza`, an open-air square (`lib/graph/era/plaza.js`).
  - Each side is a row of house fronts of different heights, giving a stepped skyline. Each house has its
    own stucco colour, a stone base band, an arched door, windows with surrounds and projecting sills,
    sometimes a balcony, and an eave over a pitched terracotta roof.
  - A raised pavement step runs along the house fronts, and the square is paved in warm flagstone bays.
- The `delfino-plaza` exterior is lit by a baked sun (`lib/graph/era/sun.js`). Each vertex is tested
  against the scene for a cast shadow, and faces that look down or sideways get a sky fill and warm
  ground bounce. It is drawn under the reference's painted sky dome.
- `trail-valley` stage kit: a nature level built to a style card. The card
  (`lib/graph/era/style/nature-trail.js`) states the art style as principles and also holds the numbers
  the builder reads. The builder (`lib/graph/era/nature.js`) makes:
  - faceted ground, with material chosen by slope;
  - a trail as a curved ribbon with grass edges;
  - a cliff of leaning rock bands with ledges, buttresses and gullies, with fallen rocks at its foot;
  - spruce trees planted in clusters;
  - red trail-marker posts;
  - ridges that fade into the fog.

  Moss, wet stains and wear are applied by cause. The scene is lit by the baked sun, and trees cast shadows.
  Each principle has an automated check, including the brightness order trail > rock > grass > foliage.
- The trail level is composed by where the eye lands. The style card names focus areas: a trailhead, and a
  boulder gate at a bend.
  - Inside a focus area, rocks are chipped (more detailed) and each one is different, grass tufts are
    fuller and denser, and two boulders frame the trail.
  - Outside, cheaper rocks and tufts repeat.
  - The trail's width and grass edges vary along its length, with pebbles along the edges.
  - Grass is instanced tufts (tussock, meadow, sedge), darkened where shade falls. Every boulder and tree
    sits on a soft contact shadow.
- The trail's cliff is now real geology on one heightfield with the valley, using mojulo's landform
  operators: a scarp, rock beds that form benches, jointed facets and a talus apron. Fallen rock lies where
  the scree came to rest.
- Debris on and beside the trail: roots surfacing from nearby trees, a fallen log with bark, sticks and
  cones, flat stones worn flush, and a puddle with wet soil around it.
- Walk mode on the trail no longer falls through the ground: the spawn is at eye height above the trail.
- The trail level's sky has weather: mojulo's cloud deck, lit by the level's sun.
- `composeCloudDeck` takes `depthClip`. With it, the deck reads the scene's depth and no longer paints over
  trees, cliffs or buildings that stand in front of it. `emitThreeWorld` gives any effect layer that asks
  for depth a shared depth pass before each render. Worlds that don't ask are unchanged.
- `jungle-trail` stage kit: a late sixth-gen jungle in the manner of Metal Gear Solid 3, built to the
  `jungle-mgs3` style card (`lib/graph/era/style/jungle-mgs3.js`) by `lib/graph/era/jungle.js`. It reuses the
  trail's ground, trail ribbon, rocks and debris, with a low mossy ravine wall and a mud trail. On it stand:
  - giant figs grown by mojulo's vegetation engine, kept for their wood (trunk, limbs, buttresses, barked near
    the trail). Their crowns are leaf cards placed at the grown tree's own leaf clusters;
  - tree ferns, fern and broadleaf understory, leaf litter on the floor, hanging vines and sagging lianas;
  - a canopy roof with holes, which opens over the trail;
  - layered walls of foliage beyond the visible area that fade into the fog.

  Detail is revealed by ring out from the trail: dense and distinct near, sparser and coarser further out,
  and only the fading walls beyond. Sunlight reaches the floor only through the canopy's holes, as dapples,
  with soft light shafts standing where it does. A filmic grade pulls every colour toward olive and sepia.
  Each principle has an automated check, including the brightness order dapples > trail > trunks > foliage
  > shade.
- The jungle trail blends into the floor. Trail, edge and floor share one mud tile mapped the same way, so
  there is no seam. The trail is told apart by brightness and wear instead: a packed, lighter centre that
  wanders out into the darker, patchier floor. Leaf litter piles along the edges, some lies on the trail,
  and twigs lie across it.
- Jungle shade is deeper, while sunlit dapples and shafts stay bright. Leaves carry their own shade: plants
  darken toward their base, crown clumps toward their undersides, and soft shadows lie under the plants
  near the trail.
- Each giant near the trail has its own bark (oak, chestnut or beech) and small ferns and broadleaf plants
  growing on its big limbs. Moss, pale lichen and dark wet streaks are applied by cause to the trunks and to
  the tree-fern trunks.
- The jungle's flora draws on mojulo's tropical plants, and twists:
  - Giants grow with stronger kinks and a stronger reach toward light, using the vegetation grower's own
    settings, so their limbs bend toward the canopy's gaps.
  - A banyan stands at the gate. Its pillar roots land on both sides of the trail, never on it, so the
    path runs between them. Each pillar wanders, flares at its foot and is braided with a thinner strand.
    Its hanging roots are curtains of a new root card.
  - Lianas wind up the trunks.
  - Clumps of mojulo's clumping bamboo stand on the wet ground at the foot of the ravine wall, with their
    foliage drawn as a new bamboo card. Culms on the wall side stand upright instead of leaning into the rock.
- The jungle takes five more principles from Snake Eater's own frames, each with a check:
  - The floor is two materials blended. A painted moss tile (`floor:moss`, `lib/graph/era/floor-tiles.js`)
    fades in over the soil at each corner. It is worn off the trail, thick in patches and in shade, and climbs
    the massive trunks.
  - The floor undulates. The style card's optional `lumps` adds mounds, hollows and banks either side of the
    trail, which sits sunk between them. Styles without it are unchanged.
  - Occasional massive trunks: low-poly boles 2.7–3.4 m across, lumpy and flared. They carry oak bark at a
    larger crack scale, buttress roots on the side away from the trail, and moss.
  - Tall grass is cards of broad blades (`card:grass`), placed where sunlight reaches the floor. It is lit
    and shaded with the rest of the scene, and walked through.
- The `trail-valley` kit takes three principles back from the jungle, each with a check:
  - One ground, two tiles. The trail ribbon and the meadow within 9 m of it share one soil, mapped the floor's
    way, so the ribbon's edge has no seam. The grass returns over it as a blend: worn off the trail, wandering
    at its edge, thinned under the spruce and in bare patches, and whole where the meadow tile takes over.
  - Foliage is painted cards. Spruces are grown (`vegetation/conifer.js`): the trunk is barked near the trail,
    and the crown is bough cards (`card:bough`) placed at the grown limbs. Cards are finer near the trail and
    coarser further off, and dark toward the trunk. Grass tufts are cards (`card:meadow`, `card:grass`) instead
    of instanced tufts, so they take the scene's light and shade. The sun falls through the cards' gaps.
  - The ground is never flat: mounds and hollows at three scales, and a bank either side of the trail. Roots
    surface in pieces instead of running as rails, and the trail's stones are its own rock.
- The `gothic-nave` kit is dressed to a style card (`lib/graph/era/style/gothic-nave.js`, dressing in
  `lib/graph/era/nave.js`), with a check for each principle:
  - Light leads, measured: glass > torchlit stone > the shafts' pools > the open floor > the vault. The vault's
    stone is darker than the shell's ceiling.
  - Each clerestory lancet facing the light throws a shaft across the nave as soft translucent sheets. Where it
    lands, a pool of light is baked into the floor. Pools are not exported as lights and leave no soot.
  - Two-tile blends by cause: moss (`floor:moss`) rises up the wall bases and fills the gutter. Grime
    (`floor:grime`, new; `lib/graph/era/floor-tiles.js` now holds the stage's painted tiles) gathers at the floor's edges and is worn off the walking line.
  - Painted cutouts, each placed for a reason: ivy spills from the string course, cobwebs sit in the angle
    between column and wall at the plinth and at the arcade's springing, and banners hang in alternate bays
    from iron rods. No two neighbouring bays are both bare.
  - A scale break at the focus: the end wall holds a great door (`portal` in `lib/graph/era/gothic.js`) in
    three stepped orders under a hood moulding, with an oak leaf banded in iron. It rises half again the
    arcade's height, with an oculus (`oculus`) above it and a torch on each flank.
  - The ceiling is its own material: the vault's web is plaster painted night-blue with gilt stars
    (`vault:stars`), flaked where damp has lifted it, between the stone ribs.
  - The floor is not the walls' grid: a runner of hexagonal tiles (`floor:hex`) down the walking line between
    slate kerbs, and irregular flags with no two alike (`floor:incertum`, opus incertum) either side.
  `gothic-stone` and `delfino-plaza` are unchanged.
- The `delfino-plaza` kit is dressed to a style card (`lib/graph/era/style/delfino-plaza.js`, dressing in
  `lib/graph/era/plaza-dress.js`), with a check for each principle:
  - Hard sun, measured: sunlit stucco > sunlit paving > the shade (a pale blue, never black) > terracotta.
  - A fountain at the square's centre: a lathed marble basin, pedestal, bowl and finial, water standing in
    basin and bowl and falling from the bowl's lip in streams, ringed by sandstone paving.
  - The floor is fan-pattern setts (`floor:fan`, new): overlapping arcs, no two setts alike.
  - Blends by cause: sand blown against the house fronts and drifted deepest into the corner, worn off at
    the doors and along the way in; the ring round the basin dark where it splashes.
  - Painted cutouts on the fronts: flower boxes under windows, striped awnings over doors whose shade is
    striped (the sun reads the card), and laundry strung across the corner.
  - The town goes on: rows of rooftop cards beyond the closed sides, each row carried toward the reference's
    horizon colour by its distance (aerial perspective after the light, not baked).
  - No two neighbouring houses dress alike.
  - A Renaissance order (`lib/graph/era/piazza.js`): a portico of grey-stone columns and round arches along
    the sunlit side, with blue-and-white roundels in the spandrels. Its roof is a walkway of hexagonal cotto.
    The shade under it is warm, lit from below by the square (measured: warmer than a wall turned from the
    sun, darker than the paving). Houses behind it carry no balconies, and their doors no awnings.
  - Walkways railed in stone: lathed balusters between a plinth and a rail, pedestals on the column lines
    carrying urns, and a stair of even treads climbing the portico's front to a landing, with a raking rail.
  - Two red granite obelisks on stepped pedestals, either side of the fountain across the line from the way
    in, standing over every eave, with bronze balls under the shaft and a cross on the point.
  - Long-and-short quoins up every house edge.
  - The sky is a place: a cloud deck (`effects`, the `undershot` deck the trail uses) over the square, and
    the town's ribbed dome and banded bell tower over the roofs, faded toward the horizon like the rooftop
    rows. A stage carries `effects` only when its dressing names clouds.
  `plazaWall` takes an optional `record` that receives each house's door and windows. The nave's dressing and
  the plaza's share one shape the stage composes. `lathe` moves to `lib/graph/era/geom.js`. `gothic-stone`
  and `gothic-nave` are unchanged.
- `card` and `crossed` (one painted card, and cards crossed about a vertical axis) move to
  `lib/graph/era/geom.js`, and `dice` is exported from `lib/graph/era/nature.js`, shared by the trail and the
  jungle. The jungle's output is unchanged.
- `emitThreeWorld` draws faces marked `blend: true` in their own translucent pass: a second texture faded in
  per corner by `cornerAlpha`, multiplied by the baked colour, drawn over the surface beneath it without
  flickering. This is the era's two-tile vertex blend. Worlds without blend faces are unchanged.
- Leaf cards (`lib/graph/era/leaf-cards.js`): painted RGBA leaf textures (`card:broadleaf`, `card:fern`,
  `card:spray`, `card:vine`, `card:litter`, `card:roots`, `card:bamboo`, `card:grass`, `card:bough`,
  `card:meadow`, `card:ivy`, `card:cobweb`, `card:banner`, `card:flowers`, `card:laundry`, `card:awning`,
  `card:roofs`), resolved through the surface-texture registry. New
  `encodePngRgba` in `lib/graph/landscape/surface-textures.js`.
- `emitThreeWorld` takes `cutouts`, a list of texture keys whose alpha is cut out (alpha-tested). Those
  surfaces drop their clear texels, including from the depth pass, and are not walk colliders, so foliage
  is walked through. Worlds that don't pass it are unchanged.
- `makeSunShadow` takes `maskOf`, so a cutout card blocks the sun only where its texture is opaque.
- Dirt is baked into the vertex colour by cause (`lib/graph/era/dirt.js`):
  - soot above torches;
  - streaks under the cornice;
  - damp wall bases;
  - a worn walking path and grimy floor edges.

  The recipe's `dirt` scales each cause. Baked ambient occlusion is on for the `stage` kind.

### Stage isekai

- A new stage kit, `isekai-meadow`, for the open-field anime look of current-era games. Its reference cards are
  Genshin Impact and Breath of the Wild (`lib/graph/era/current-gen.js`). It is built only from sixth-gen parts:
  - painted 256-px tiles;
  - baked vertex light;
  - cutout cards.
- A PALETTE LOCK (`lib/graph/era/palette.js`): the style card names ramps of colour stops. Every baked colour on a
  locked group is projected onto its ramp, so shading moves a colour along its ramp and never off it.
- PIXEL-LOCKED rocks and cliffs:
  - The tiles (`lib/graph/era/isekai-tiles.js`, the `isekai:` resolver) are painted only in their ramp's stops.
  - They are drawn unlit, and the light lives in the choice of tile: each facet takes a lit or a shade tile by the
    sun and its cast shadow. That gives two-tone cel bands with no new renderer.
  - The cliffs are the landform's own geology drawn with strata tiles.
  - The rocks are new chunky boulders, lofted from an irregular footprint to a flat top.
- HATS: a boulder's top wears a grass cap with a ragged fringe hanging round its rim, and every cliff lip gets the
  same fringe hanging over the face.
- Trees are crowns of overlapping round masses on a short trunk, with one hero tree where the eye lands. Grass is
  crossed blade cards, pixel-locked, and within reach of the trail it stands as one continuous field of blades.
- DEPTH BY PAINTED LAYERS:
  - Far ranges stand as rings round the site, each its own colour from the far ramp, with a peaked skyline.
  - The nearest layer is a skirt of land from the site's own edge up to its skyline, banded from grass to the
    hills' colour.
  - The haze is thin, so each layer keeps its colour.
- THE PAINTED SKY: heaped cumulus cards stand behind the ranges, pixel-locked to a cloud ramp and lit in crescents.
  The sun sits on the dome where the bake's sun is.
- Other stage kits are byte-identical.

### Stage isekai groves

- Two smaller isekai levels in the same art style. Every isekai level is a style card, and the builder reads it:
  - **`isekai-bamboo`:** clumps of bamboo culms. Each culm is a pole pixel-locked in a striped `culm` tile with pale
    node rings, two-toned by the sun. Cutout leaf sprays fan from the upper culm, and the sun bake reads their alpha,
    so the floor is dappled.
  - **`isekai-sakura`:** sakura trees. Dark leaning trunks fork into limbs under crowns of round masses locked to a
    pink blossom ramp, with petal litter on the ground beneath.
- New pixel-locked tiles: `culm`, `spray` and `petals`. The meadow is unchanged.
- With `wind`:
  - both groves take the live grass;
  - crowns, culms and sprays sway;
  - the sakura's petals fall, carried by the same gust field.

### Stage isekai sakura pass

- The sakura grove's trees are grown, not heaped: a branching skeleton (trunk, limbs, branches, twigs) with blossom
  clumps at its tips.
  - **Hero trees:** two framed sakura at full depth, with a `hero` camera under one crown's edge.
  - **The rest:** the same tree at a lower depth, so the limbs show in the gaps of the crown.
  - New pixel-locked tiles: `bark` (the sakura's horizontal lenticel bands), `bloom` (packed five-petal flowers on
    each clump) and `sprig` (cutout flower clusters that break each clump's silhouette).
- The petal litter is repainted as notched sakura petals in drifts.
- With `wind`:
  - live 3-D petals lie round the walker, pixel-locked like the grass and stirred by gusts. They gather in piles (drifts,
    the path's edges, the feet of the trunks) and stay thin on open grass, so the grass stays the main read;
  - falling petals take the same notched, cupped shape and tumble.
- The meadow and the bamboo grove are unchanged.

### Stage trail blend

- A trail no longer sits on the ground as a separate ribbon. The outdoor trail primitive has a blended rim along both
  edges: a narrow band out from the edge and its mirror in. In the band, the trail's soil and the outer ground meet
  along one ragged boundary that wanders both ways about the edge, so soil bleeds into the grass in some places and
  grass creeps over the trail in others.
- The isekai levels draw the rim in two new pixel-locked cutout tiles, `rim` and `creep`, painted from one shared noise
  field so the two sides meet. The boundary frays in a stipple of palette colours, so the colour lock holds. Each strip
  takes the palette stop nearest the baked colour of the lane it continues, so the blend matches the light on both
  sides. The meadow, bamboo and sakura trails all take it.
- The jungle takes it too, through the same primitive's shared edge (`trailEdgeCover`): one wandering boundary between
  the trail and the floor. The moss now gives out along that line, and the trail's packed-soil wear follows it too,
  so moss and mud meet along one edge instead of fading on two separate noises.
- The nature trail, which has its own grass blend, is unchanged.

### Stage live grass

- `wind` on an isekai recipe turns on a LIVE FIELD of grass on the World page (`lib/graph/scene/channels/stage-grass.js`).
  - Grown stylized blades stand within 30 m of the walker, placed in the page from grids the stage ships: heights, a
    grass mask that keeps them off the trail, rocks, trunks and the cliff, and the sun's shade.
  - They thin with distance and bend in the terrain's gust field.
- The palette lock holds through the motion. Each blade's colour is looked up from a nearest-filtered ramp texture of
  the grass stops by its height and its lit or shade window, so only palette stops reach the screen.
- A gust above the mean steps the upper blade up the ramp: the gust is seen as a bright band rolling across the field.
- Blades near the walker bend away from it.
- The static blade cards stay as the floor and as the band beyond 30 m. Inside the field's reach they dissolve, dithered
  across its edge.
- The tree crowns sway in the same gust field, weighted by height above the ground.
- Absent `wind`, the payload is byte-identical.

### Stage doors

- A stage recipe can name DOOR ENDS (`doors: [{ id, at, to: { map, door } }]`), resolved by
  `lib/graph/era/doors.js` from what the kit already knows (a plaza house door, the nave's great portal, a point
  on a wall). Each end carries a trigger in front of it and a spawn further in, facing into the room. The payload
  carries `doors` only when the recipe names them.
- The World page's doors channel (`lib/graph/scene/channels/doors.js`): walking into a trigger asks the parent
  page to cross (`map-door`); the parent places the walker at an end (`map-enter`). Absent doors, the page is
  byte-identical.
- A wall-point end on a closed wall gets a door: an oak leaf in a stone frame, in the middle of its bay, standing
  proud of the wall's plinth.
- ITEMS (`items: [{ id, at: [x, y] }]`): a thing on a plinth (a gold key, turning) in its own group. Walking up to
  it takes it; the page hides it and reports the taking.
- A LOCKED end (`locked: '<item id>'`) refuses the crossing until the run holds that item; the page says what the
  door needs.
- An ATLAS (`lib/graph/era/atlas.js`) joins maps by their door ends. `validateAtlas` checks that:
  - every end names an end that names it back;
  - every lock's item is held by some map;
  - no item is placed twice.

  `emitAtlasShell` hosts one map at a time, crosses on `map-door`, and carries the run's state across: the
  crossing log, the refusals, visits per map, the items held, and each map's own state. A key taken stays taken
  when you come back.
- Played maps are closed rooms. The plaza dressing no longer assumes the open-sided set:
  - the portico stands clear of a closed side it meets;
  - the obelisks take the way in from the square's first door, and their symmetric spread shrinks until both
    pedestals clear the walls and the portico.

  The open set is byte-identical.

### Stage decay

- `decay` on a stage whose style card carries one (the lab's): a number 0–1 for every event at that strength, or
  `{ collapse, leak, breach, blackout, abandon, seed }`, each 0–1. Every event is a cause, and the mess it leaves has
  a place it came from (era/decay.js picks where, from the rooms and the bays alone):
  - **collapse**: a bay of the roof came down. The deck is open over it, with torn sheets hanging from the edges.
    The duct broke at the bay's trusses (one length down to the floor, a stub drooping), one troffer hangs from a
    single chain and another lies in the debris heaped under the hole.
  - **leak**: a pipe burst at the service band. Streaks and rust run down the wall under it, there's a puddle at its
    foot and, with `water`, a thin stream.
  - **breach**: the tank broke. Its glass is a jagged ring, the liquid is drained to a skim, the glow is out and a
    hoop lies on the dais. The spill spreads toward the side it split, with shards strewn the same way.
  - **blackout**: most troffers are dead, the clerestory is dark and the screens are black but for a few on their
    batteries. Red emergency lamps on the columns are baked red, the ambient is down and the air thicker.
  - **abandon**: chairs tipped and shoved, monitors face down on the floor, the cart rolled and over, the
    extinguisher down and glassware broken. Papers are strewn, more of them against the walls. There's dust on
    everything that faces up, and the walked path has faded.
- The things are records, so abandonment changes them before they are built (`tip` lets a thing down onto the
  floor). The dressing hands the stage its extra lights, its dirt (`leaks`, `dust`) and its water. Spills and
  puddles take the water look with `water`.
- Dying lamps flicker on the page (scene/channels/stage-flicker.js): some troffers that survive the blackout stutter
  (baked on, they go off in bursts, taking their pool and their tube with them), and a troffer hanging by one chain
  sparks (baked off, it flashes now and then). The page scales each lit mesh's baked vertex colour by the lamp's change
  near it, so exports keep the floor (the bake). Absent `flicker` ⇒ the channel isn't emitted.
- The tank now has a frame of four struts, so its cap stands on something.
- The style card's decay principles are machine checks (lab-decay.test.js). The derelict lab is in the page budget.
  No decay (absent, 0, or every event at 0) is the clean lab, byte for byte. Other stages are byte-identical.

### Stage lab

- A fourth stage kit and the first modern one: `research-lab`, after a new reference card `doom3` (Doom 3's UAC
  labs). It's a tall closed lab whose structure shows (era/lab.js):
  - a vinyl tile floor with a darker band and a rubber skirting;
  - walls of steel I-columns at the bays, a kick band, painted panels, a service shelf and a clerestory of
    observation windows glowing cool;
  - a corrugated deck high up with trusses across the short span, two ducts and a cable tray down the long one, and
    troffers hung on chains between the trusses (the light);
  - a blast door with chamfered top corners, a hazard-striped surround and a red status lamp.
- Its painted surfaces are the stage's own `lab:` tiles (era/lab-tiles.js): vinyl tile, steel panel, corrugated deck,
  grating, hazard stripes, a screen, a server rack's face, a whiteboard.
- The dressing (era/lab-dress.js, style/research-lab.js):
  - a containment tank at the centre on a hazard-ringed dais, glowing, with cables down its steps into grated
    trenches that run to three walls (never across the way in);
  - benches in two rows, each carrying different things from its neighbours (monitors with lit screens, a
    microscope, glassware, papers, a toolbox), with chairs pulled out;
  - server racks, lockers, a whiteboard, an extinguisher and a cart.
  - Every thing is placed as a record first and built in its own frame after, so a later pass can move, tip or
    break it.
- The style card's principles are machine checks (era/lab.test.js), and the lab is in the page budget. Other stages
  are byte-identical.

### Stage night

- `time: 'night'` on a stage whose style card carries a night (the plaza's does): the card's moon becomes the bake's
  key (cool and low, casting the obelisks' long shadows) under a deep blue ambient, and the reference's air and dome
  give way to the night's. The sky shows stars and a phase-carved moon placed on the dome where the moonlight comes
  from, and the cloud deck is lit by the moon. The town beyond is dimmed.
- The placed light makes the picture (era/plaza-night.js): lanterns on iron brackets by most doors, lanterns hung in
  the portico's bays, a glow under the fountain's water, and some windows lit warm with their light spilled on the
  sill. All of it is baked like the nave's torches; the lanterns' panes glow and carry a halo.
- The style card's night has its own principles, each a machine check (plaza-night.test.js). `time: 'day'`, or no
  `time`, is the plaza as before, byte for byte; a kit without a night refuses one.
- Jets take an opt-in `lit` colour for the light their white water is seen in (`jetLight` on the page). The night
  fountain uses it so its falling sheets aren't daylight-white. Jets without it emit as before.

### Stage page budget

- A stage's World page now costs about 5 MB to open with every element on (the plaza was 8.7 MB), under a budget
  (`STAGE_PAGE_BUDGET`, 7 MB) a test holds each stage to.
- `pack` on `emitThreeWorld` (opt-in; a stage's payload sets it): each textured sub-mesh is welded, so corners equal
  in position, uv and colour are shared through an index, and its baked colour goes as 8-bit sRGB decoded back to
  linear in the page. Renders differ by at most 2 levels in 255. Without `pack` every page is byte-identical.

### Stage elements

- Sixth-gen is a floor, not a ceiling: a stage takes the merged fire and water elements as opt-ins, and without them
  it is byte-identical (the baked torches, the painted spill).
- `fire` on a stage (`true` or the fire object): its torches go to the fire channel as fires its bake already holds,
  so the page only flickers their light. The stage keeps an iron arm and a collar on the wall and leaves the staff
  and the flame to the channel. The nave's style card sizes its torches up (`fire.torch`) and stands two braziers by
  the great portal, their light baked into the room like the torches'.
- `water` on a stage: the plaza fountain's basin and bowl take the water look (a tinted `lagoon`, its shore foam
  turned down for a basin a hand deep). The bowl brims over its lip in falling sheets (`jets`) in place of the
  painted strips.
- Jets whose `controls` are all false carry no flow panel; pages with any other jets are byte-identical.
- `wind` on a stage (`true` or the terrain's wind object): the dressing's hung cloth swings in the terrain's gust
  field (the same GLSL, now shared as `WIND_AT_GLSL`; the terrain page is byte-identical). Each style card names the
  groups that take the wind (`sway`): the plaza's washing billows on its lines, an awning's valance flaps and the
  flowers nod; in the nave the wind is the draught through the doors (`draught`), and the banners and ivy stir. Those
  cards are cut into a small grid so they bend down their length; the bake and the sun's shadow stay at rest.

### Flame depiction

- Fire in worlds (`fire`, opt-in on any world): campfires, braziers, torches and candles drawn as live flames that puff at their own rate, lean in the wind and throw embers and smoke, and whose flicker lights the world around them. `fire: true` on a dungeon lights its chambers with braziers and its tunnels with torches; `fire: { sources }` places fires anywhere, on the ground in terrain worlds. Absent ⇒ byte-identical.
- Coloured fire (`fire.color`, or per source): as fireworks are coloured, by a metal salt in the flame (sodium, calcium, strontium, lithium, barium, boron, copper, potassium, or a mix), or any `'#rrggbb'` for a fire no salt gives. A coloured flame burns clean and lights the world in its hue; a dungeon bakes the hue into its walls. `smokeColor` gives a source a signal smoke.
- Fire that burns up and down (`life`: kindling, dying back; `flares`: a whoosh now and then; the wind feeding a fire it does not blow out), fireballs (`kind: 'fireball'` on a `path`: the tail is where the ball was a moment ago, and it bursts where it lands, swelling and throwing a shell of sparks), and grass fires on terrain (`fire.spread`: the front runs downwind as an ellipse after Rothermel and Anderson, with flames sized by Byram's law, black ground and a band of embers behind it, stopping at water and burning out at `extent`).
- Fire in a Blender Cycles still: a world with `fire` exported through the Blender pack (`export_model({ format: 'blender', fire_t })`, which writes the same pack as `scripts/export-blender.mjs --fire-t <seconds>` and hands back the render command) carries its fire at that instant as the World page draws it. Each flame becomes a volume of light (the page's flame shader evaluated per voxel, written to OpenVDB inside Blender), each fire's smoke a density volume, and the embers, coals and props come as mojulo geometry; each fire gets a light, and a `Fire` camera frames the brightest. `import_mojulo.py --mode render` renders a still at any resolution. All of it stays in a `mojulo-fire` collection that the machine gate and the return leave out. The props are now one description (`firePropParts`) shared by the page and the pack.
- A lit match (spike, `scripts/spikes/flame/`): fire drawn as a consumer of the wind's air field. The flame is a streakline, the burning gas rising on its own buoyancy while the room's air (`windField`, plus a breath) carries it sideways, so it leans downwind, flickers when a draught passes and blows out past a speed that grows with its size. φ = 0 stands it straight up in any wind. The match strikes (a flare and sparks), burns its head, then creeps along the stick at a rate set by its angle (head down races, head up starves); the stick chars, curls and glows at the front; blown out, the ember lets go a wisp that rises as a thread and snakes as it goes unstable. The page marches the flame as emission against the scene's depth, lights the scene from it in a match's balance of brightness, and shimmers the air above it.

### Wind element

- Terrain `wind` (opt-in, flat worlds with `grass` or `plants`): one seeded gust field that the live World page's grass and trees bend in. Gusts travel downwind and reshape as they go; a tuft or a tree sways as one stem of its height, lagging the gusts and ringing at its own frequency, its shape the production elastica under the wind's load (baked once, read as a 3D texture by a vertex shader). New principle, **flaccidity**: the share of the wind's push a thing takes, 0 for everything that existed before (unchanged, byte-identical pages without `wind`), 1 for grass and plants unless `flaccidity: { grass, plants }` says less. `compose_world` carries `wind` to the stored recipe. Exports carry none.
- Wind debris: fallen leaves and dust around the camera ride the same gust field (one self-contained field function shared by the shader's texture and the particles), lying still until a gust passes their lift, then tumbling downwind and settling. On by default with `wind`; `debris: false` for none, `flaccidity.debris` to dial it.
- Cherry grove (spike, `scripts/spikes/sakura/`): a `cherry` species in full bloom (Rauh made decurrent through a new species `over`; `bloom` recolours its leaves as blossom and `bloom.fill` fills its clusters), `plants.kinds` to grow named trees in place of the climate's, and petals as a new kind of wind debris, given off by crowns in bloom in gusts, fluttering down, carpeting the ground and lifting again. Other species and worlds without a cherry are byte-identical.
- Hero cherry grove (spike, `scripts/spikes/sakura/hero-grove.mjs`): a standalone close-up scene built from the ground up. The cherries are grown with the species' hand and smooth axes (below). Blossom sits in umbels at the ends of the shoots, and each flower is built from its parts with fractal-edged petals. Levels go by distance: whole flowers near the eye, one lit disc per flower beyond, then the pool's levels. One wind drives tree sway, flower flutter, the lawn and the petals, and the frame goes through an HDR lighting pass. The page has a season dial (bud, bloom, petal fall, leaf-out), a petal carpet that builds where petals land, three lighting moods, and compact encodings (8.5 MB).
- Trees with a hand (`arch.hand`, opt-in): new internodes are turned as they grow (a consistent twist, a winding lean, zig-zag laterals). Smooth axes (`arch.smooth`, opt-in) bend between nodes instead of kinking. The cherry has both; other species grow and mesh byte-identically.
- `vegetation/blossom.js`: where a grown tree carries its flowers (umbels at the shoot tips) and one flower built from its parts at its levels of detail.
- Terrain worlds draw a tree in bloom flower by flower: at L1 and L2, its bare wood plus one disc per flower (lit in the world's light, bent by the wind, at most about ten pixels), up to 1.2M flowers, largest trees on screen first; past that a tree keeps its clusters. Worlds without a species in bloom are byte-identical.
- Trees of many ages (`growth` on a species): one variant is grown at each age, some in a stand, so height, girth and clear trunk come from growth rather than scale. Each plant picks its age by its height in the species' range. The cherry has five ages, from 8 to 21 years. Other species are unchanged.
- Research spike behind it (`scripts/spikes/wind/`): one seeded wind field (gusts carried downwind, log profile, veer) that bends plants and carries debris. Introduces flaccidity φ ∈ [0, 1], the share of the air's push an element takes; everything before is φ = 0 and stays byte-identical. Plant poses reuse the production elastica through a baked table; debris (dust, leaves, twigs) lifts and settles by kind. Standalone interactive preview, no schema, exporter or runtime integration.

### Aqua rendering

- **Water has a look of its own.** A water preset (`ocean`, `lagoon`, `lake`, `river`, `canal`, `pool`,
  `falls`) shades it on the World page with light-weight maths instead of a flat tint: fine ripples
  layered over the waves, the sky reflected more strongly the lower you look (water is a mirror at a
  grazing angle and nearly clear head-on), and a sharp sun glint that softens with distance so far
  water does not shimmer.
- **Foam forms where waves fold.** The animated oceans, beaches, rivers and spillways now place
  whitecaps where the wave surface folds over itself, and draw foam as a lacy pattern of bubbles
  rather than a white tint. Shore breakers, river banks and the foot of a falling sheet froth the same
  way.
- **Rivers flow along their banks.** A river's surface runs in lanes parallel to its banks that turn
  with every bend; ripples stream downstream along them and foam gathers in lines that drift with the
  current.
- **You can see into the water.** Water now fades with depth the way real water does: sand and riverbeds
  show through the shallows in the water's own clear tint (turquoise for a lagoon, olive for a river), and
  deep water turns opaque. Where water is thin, against a beach, a bank or a floating buoy, it froths
  in bands that lap toward the edge. The beach view gains a seabed that falls away offshore so its water
  shades from shallows to deeps. Open sea with nothing beneath it looks as before.
- **Water leaves with the scene.** Exported GLBs carry each body of water as its own `water:<kind>` node
  with a clear-water material (transmission, index of refraction 1.333, and absorption that keeps
  blue and loses red), which Blender reads. Animated seas, beaches and rivers, which no export carried
  before, leave as one frozen frame with their foam baked in; the ocean view now exports at all. Godot
  packs (kernel 0.4.0) shade that water live with a water shader: the seabed seen through the water,
  bent by the ripples and fading red-first with depth, foam where the water thins, sky reflection and
  sun glint, and drifting ripples. The waves themselves stand still in an export.
- **Pools and ponds you can touch (groundwork).** A page can now carry shallow bodies of water whose
  surface is simulated rather than drawn: still until something disturbs it, with waves that slow in
  the shallows, bounce off a pool's walls and die out on a pond's bank. Walking in slows you with depth,
  splashes on entry and leaves a frothing wake; floating toys and leaves bob on the live surface and get
  pushed aside; rain rings it; a click splashes it. Everything that touches the water goes through one
  interface, `window.__aqWater` (`query`, `disturb`). The floor is seen through the water, bent by the
  ripples, with caustics where crests focus the sun. No world kind emits them yet.
- **Wet sand follows the swash.** On an aqua beach the swash now runs a thin sheet of water up the
  sand, with a lace of foam on its leading edge, then drains: the sheet shines with the sky and the
  sun for a second or two, and the sand it leaves stays dark while it dries, with a damp band above
  the highest reach. It is worked out from the swash's own timing, so it costs only a shader and an
  export carries the band as it stands at the first frame. Beaches take `detail`
  (`'still' | 'animated' | 'touch' | 'showpiece'`, default `'animated'`); `'still'` keeps the baked band.
- **Footprints in the sand (`detail: 'touch'`).** A beach at the touch tier opens in walk mode facing
  the sea, and the sand around you takes footprints: a bed of loose sand (3 cm cells) follows you as
  you walk and blends into the beach with no visible edge. Damp sand holds a print's walls, dry sand
  up the beach slumps them into soft dimples, and the backwash levels any print it runs over. The
  ground kernel graduated from the soft-ground spike with per-cell moisture, a window that slides
  with the walker, and slopes measured on the sand alone so loose sand never slides off the beach
  face; with neither in use it replays the spike byte for byte. The beach declares its unit
  (1 unit = 1 m at scale 1).
- **Wading into the surf.** At the touch tier the sea around you answers too: walking in slows you
  with depth, splashes on entry, and leaves a wake and a cloud of stirred-up sand in the water. The
  disturbance is simulated in a small window that follows you and rides on top of the existing
  waves (it reaches the water shader as a texture, so it adds no geometry and no seams). One step
  routes by depth: on dry or shallow ground it prints the sand, in the surf it prints the sand and
  stirs the water, and past waist depth only the water answers.
- **The swash strands its foam.** On every animated beach the foam the uprush carries is left on the
  sand where the sheet stops: it slides back with the backwash while the water still covers it, stays
  put once the water leaves, and opens into holes and pops over a few seconds. The backwash's edge
  carries no foam line of its own.
- **A faucet and the basin it fills (study).** A falling stream (`jets` on the World page) is drawn on
  the GPU along its fall: it thins as it speeds up, carries a ripple from the spout that grows until a
  thin stream breaks into a string of beads, and below a threshold set by the spout's width it drips
  instead. An aerator turns it white. Where it lands on a dry or barely wet floor it spreads into a
  hydraulic jump; in standing water it plunges, with a crater, rings and foam that push floating
  things away. Its basin is a new `basin` kind of shallow water whose level moves: it fills with the
  plug in, drains through the plug hole with it out, and stops at the overflow, and a duck in it rides
  up and settles on the floor when it empties. The page has a panel for flow, plug and aerator.
- **Waterfalls (`create_view` kind `waterfall`).** The same falling water, at landscape scale: a river
  runs along a plateau, pours off the cliff, falls, and plunges into a pool that drains away as a
  second river. Three kinds: `veil` (a tall thin ribbon that frays to streaks), `curtain` (a broad,
  heavy block of water) and `horsetail` (a round spout shot through a slot in the rock). Over the lip
  the water is glassy and pours at the depth a river takes going over an edge; it whitens as it falls
  and, past a break-up length set by how much water there is, frays into streaks and fingers and
  spreads, with mist at its foot. The pool's surface is simulated, so the fall churns it into foam and
  rings and pushes floating leaves away. A flow slider on the page turns the fall down to a trickle or
  up to five times its size. Falling water can now be a sheet over a lip as well as a round stream,
  so any world can place one.
- **Recipes choose the water.** The ocean, beach and river views and painted-landscape lakes take
  `aqua: '<kind>'` to pick another preset, or `aqua: false` to keep the previous look; canal cities
  use `canal`.
- **Glass is untouched.** Windows share the old translucent-water pass; only faces tagged `liquid`
  take the new look, and pages without water emit the same bytes as before.

### Particle vacuum spike

- Isolated development experiment: frozen wave-manji carriers activated by spatial contact events, with deterministic replay and a standalone interactive preview. No level schema or runtime integration.
- Wave-ground follow-up: conservative sand depth over sampled wave-field terrain, with 3D surface preview and slope-driven redistribution.
- Lightweight sand follow-up: bounded occupancy grid, sleeping grains, local support-change wakeups, hopper gate and editable terrain preview.
- Grain physics follow-up: integer gravity with terminal speed, work–energy Coulomb friction (dynamic μ sets the heap angle instead of the grid's 45°), static friction with avalanche hysteresis, and inelastic impact in the sand kernel; still no library.
- Sand-bed follow-up: integer depth layer where walking leaves persistent footprints (displaced sand forms a rim biased toward the push) and a pushed crate plows a berm, relaxed by the same static/sliding friction pair; walkable standalone preview, no production channel yet.
- Soft-ground materials: the same bed with a compaction ratio (snow packs under the boot and bears load, little rim) and viscosity (mud oozes back over seconds); dry sand, damp sand, fresh snow and mud presets in the walkable preview.

### Emote bridge

Steps toward playing common-parlance emotes and humanoid clip libraries on mojulo's figures
([docs/emote-bridge.md](../docs/emote-bridge.md)): the head turn the figure never had, a T-pose rest and an engine skeleton
for the engines, and Godot's retargeter set up on import.
Both are opt-in: without them every figure, hero and export is byte-identical. Being built on this branch; each bullet is
rewritten as its phase lands.

- **`turn` on the neck and head.** `neck: { turn }` and `head: { turn }` (degrees, + the face to the figure's left;
  35° and 45° caps) turn the skull about the neck line, so a nodded head's nod turns with the face. `glance: 'left' |
  'right' | 'ahead' | degrees` splits a glance across the two, and the hero's gestures and clips take it too.
- **Turned bones.** A turn reaches the frames that have an orientation: rigid armor heads, the hero's neck and head
  bones (and the jaw, face and hair that ride them), and the packed rig's head, so it bakes into the GLB and Godot
  clips. The joint graph does not move.
- **`headshake` turns the head.** The emote is a real "no" now, instead of a torso twist under a head tilt.
- **The T-pose mold.** `export_model { skinned: true, humanoid: true, rest: 'tpose' }` re-rests a humanoid figure or
  hero in the VRM T-pose the engines retarget from (arms straight out, palms down, legs straight, feet and head as
  they were), with every clip re-expressed on it so it plays the same motion. No recipe changes; without `rest` the
  export is byte-identical.
- **An engine skeleton, and Godot.** With `rest: 'tpose'` the skinned humanoid is written the way the engines read one:
  joints nested on the VRM humanoid tree (the biped's hand and foot leaves, and a clavicle each side, as weightless bones:
  an engine's humanoid profile hangs the arm off a shoulder with a large rest turn; and the chest and upper chest a rig
  lacks, split out of its torso bone with the torso's skin spread along them, so a retargeted chest turn bends the
  flesh), each parent-local, in
  the VRM space (y up, facing +z, the figure's left on +x), every rest rotation the identity. Beside the GLB come a
  Godot `BoneMap` per figure, a post-import script giving its surfaces their vertex colour (Godot imports a
  vertex-coloured GLB white), and the `.import` naming both (place the folder at `res://mojulo/<ref>/`); the engine
  figure is a scene-level node beside the z-up root, since Godot's rest fixer resets a skeleton's ancestors. On import Godot
  renames the bones to its humanoid profile and the skeleton becomes `%GeneralSkeleton`, so the project's humanoid
  animations play on the figure and its clips on any humanoid. `docs/examples/humanoid/godot-retarget.mjs` is the gate:
  a real Godot plays the flat figure's bow on a hero's skeleton.

### Figure adornment: clothes that fit

Clothes for the hero that fit the body they are worn on, in two tiers: second-skin garments painted on the body's own
faces, and garments with volume built on the adornment loop. Opt-in; no stored hero changes. Being built on this branch.

- **Second skin.** The hero door's `paint`: a word (`tank`, `crop`, `sportsBra`, `tee`, `longSleeve`, `leotard`,
  `leggings`, `bikeShorts`, `tights`, `catsuit`, `socks`, `gloves`), an entry `{ part, u?, run?, t?, only?, group }` or a
  list, worn in order over the detail. The swimsuit's band rule as declared data on the expanded rings (the plan
  grammar's `paint` block), so a segment's generated rings take it like a loft's; colour only, every ring point the
  bare body's, so it fits every cast, tune, core and pose. Words name only the parts the body has (the structured
  core's pelvis and toes, a breast), and one over the hips clears the swimwear beneath. Absent, zero bytes.
- **Outfits that follow the body.** The hero door's `outfit`: garments with volume (`tee`, `shirt`, `trousers`, `shorts`,
  `boots`, or a piece `{ id, part, u?, run?, ease, flare?, over?, group }`), built as new L1 parts copied from the body
  part's rings over a window, carried out by an ease that scales with the cast and lifted over the layers beneath (the
  chest's, earlier garments: worn in order, so a shirt can be worn out or tucked in). Each copies its body part's bind
  station by station, so every garment vertex skins exactly as the skin under it and bends at the elbow and knee; every
  dial naming the body part names its garment. The plan grammar's `garments` block. Absent, zero bytes.
- **Flat footwear.** A piece's `fit: 'shoe'` (the boots' foot) is built, not copied: a round ellipsoid over the heel and
  a flat half-ellipsoid over the forefoot, each fitted to hold the foot's and toes' points with the ease, their sections
  superposed ring by ring and cut on one flat sole, so a boot stands flat with a round heel cup and a low toe box over
  any foot; each ring binds as the foot's nearest station.
- **Cloth shades smoothly.** Under the studio light, cloth welds its corner normals at 70°, as the skin does
  (`STUDIO_SMOOTH_CREASE.$cloth`). Cloth is every face of a garment part (marked `garment`) and the faces a second skin
  painted (a part's `painted` groups). So a shirt reads as one draped form, while a right angle such as a boot's sole
  edge stays sharp. Other groups keep 35°, and a hero without cloth welds exactly as before.
- **Outfit builds.** `outfit: { type: 'outfit', style, dials?, language? }`: a styled look built the way an armour build
  is (`lib/graph/outfit/`), from laws, dials (`stylize`, `fit`, `coverage`, `ornament`), seeded JSON cards (`casual`,
  `office`, `athlete`, `adventurer`) and language words for lengths on landmarks, family (knit or woven), tuck and focal.
  It is expanded on every read in fixed passes:
  - **CUT:** the pieces.
  - **FIT:** ease and hang toward the free hems.
  - **LAYER:** tucked or worn out.
  - **CONSTRUCTION:** a woven placket.
  - **ORNAMENT:** from the focal out — a collar or a knit rib band, buttons as body-detail rows on the shirt, a belt as an
    adornment on the trousers; then cuffs, hems and the waistband painted on the garment parts; then the seams.
  - **TONE.**
  - **LEDGER:** the dress readout, with warnings, never refusals.

  The laws version is stamped on the hero record. Supporting changes:
  - A garment piece may add `rings` where its edges are finished, so a trim is as narrow as it is drawn.
  - Paint runs after the garments, so it reaches them.
  - A paint window too narrow for a coarse ring paints the band holding its middle.
  - A cap takes paint only from an entry that covers its part end to end.
  - The card's tones reach the head's include, as an armour kit's do.
- **Skirts and dresses.** A garment `fit: 'skirt'` is one hull round the hips and both legs, from the waist to a hem on a
  landmark:
  - each of its rings is the support of everything at that height, made symmetric;
  - it never narrows below the hips and widens by its cut (pencil, A-line, full);
  - it is two-faced, folded at the hem, so it is open beneath and its hem is an edge;
  - each point is skinned by nearness: the cloth over a leg follows that leg, and the cloth between and behind the legs
    stays with the pelvis, so a stride swings the skirt and the knees stay inside it.

  Outfit builds take `bottom { kind: 'skirt', leg, cut }` and `dress: true`. Tops drape from the bust and shoulder blades
  rather than hugging back in under them. New female cards: `sundress`, `blouse` and `athleisure`.

### Figure articulation: herobot

The hero robot on the hero door: the toy-hero read of the late platformer renders, an original robot on the anime head,
built from words the door already reads plus a few new ones. Every addition is opt-in, so no stored hero changes. Being
built on this branch; each bullet is rewritten as its phase lands.

- **`proportions: 'herobot'`.** A third proportion word beside `hero` and `anime`, at about 4.4 heads tall: a big head,
  a short torso, short arms (a cast may now scale both arm segments' lengths) and a short neck, with big hands and feet
  for the gauntlets and boots to sit on. Its hands are bigger still, puffed into a cartoon glove's fat, rounded digits and gloved in
  the palette's `Glove` (white unless named), its neck in the body stocking (`Top`), and its shins a little longer for an
  action hero's stride (a cast may carry `hands`, `puff`, `glove`, `suitNeck` and `shank`). The body keeps adult limbs and is not child-coded, unlike `chibi`.

- **The `volume` signature.** Figure-fluff's girth contrast on the rig: a free solid round its carrier, sized from the
  carrier's own measured axis and radius, riding that bone. It takes the fluff shapes (`football`, `cone`, `bell`,
  `slab`, `bead`), a superellipse section, a `bore` (a muzzle disc), a `lip` (a cuff) and a `half` cut (a flat sole, for a half-egg foot). The robot's ball pauldrons,
  barrel chest plate, collar, briefs, wide forearms, thigh rims, flared boots, pointed half-egg feet and knee pads are adornment data.
  A `bead` can point its crest back toward the window's start (`point: 'start'`), so a knee pad on the shank points up. The carrying shell
  of a volume is a slender core buried on the carrier's axis, so only the volume shows.

- **The `plaque` signature.** A thick trapezoid plate lying on its carrier between two stations, wider at one end,
  lifted forward off whatever lies beneath, with a bevelled face: an embossed ab plate jutting down under a chest plate. Set off the front by `c`, a pair
  makes pec plates.
  Every signature now also reads its adornment's `carrier`.

- **The helm's face window.** The `helm` signature takes a `window` (the face open, the helm wrapping the crown, temples
  and cheeks) with `brow`, `w`, `bottom`, `nape`, `rim`, cheek guards curled under the jaw (`jaw`: `drop`, `curl`,
  `wrap`), a back tucked round to the nape (`back`), the lower sides and back rounded in like an egg to hug the face (`hug`), and the window's top edge brought down as a raised V to the bridge of the nose
  (`v`), whose two lines can carry on as embossed `stripes` over the crown to the nape. A V `frame` grows the V into the visor's whole frame: wide
  cheek bands tapering to the jaw, a brow band, and two horns rising to points either side of a diamond gem set in its notch. It also takes ear domes
  (`ears`) and a brow gem (`gem`), round or a faceted `diamond` on a border plate (`fit: 'v'` sets its lower edges parallel to the V). Sized from `parts`, so `['face', 'earR', 'earL']` fits it to the anime head as raw
  kit data, and `scale` grows the whole helm about its centre. The armour builds' helms still refuse on the anime head.

- **The `gloss` highlight.** A third highlight kind on the character light: N·L above a high threshold anywhere on a
  group, with no band. This is the moulded-plastic hot spot on each rounded armour form. Like `ring` and `streak`, it
  is baked and conforming.

- **Horns, a ponytail and plate pauldrons.** The helm takes `horns` (a pair of tapering blades off the temples) and a
  `ponytail` (wild flattened clumps out of its back, scattered by a fixed pattern, so it stays deterministic). A `volume`
  takes the `plate` shape: an angular plate arched over the carrier's outer side in flat facets, a pauldron over a ball.

- **Worked casts.** `docs/examples/humanoid/cast/herobot-classic.json` and its rival, `herobot-rival.json`: red and white,
  horns and a ponytail, and a more angular silhouette from the same adornment kit.

### Figure hair

Four anime cuts from the operator's sketches, as hair words anywhere a hair word goes, and the construction words they
needed on the anime head. Being built on this branch.

- **The cuts.** `flipped-long` (long, curtain bangs framing the face, the ends kicked out), `blunt-bob` (a level fringe
  split off centre, the left side falling long), `side-tail` (the side-parted sheet gathered into a low tail over the
  left shoulder).
- **The words.** `flip`, `spikes`, `sideTail` (its clump `tail`, part `hairTail`) and `fringeNotch` join the hair form
  words; each is absent unless given, so every stored hero builds as before.
- **Hair as shapes.** `shapes` composes a hairstyle from one family of primitives placed on the cap or laid in rows
  that flow from the whorl — carrots (cut conical carrots), bananas (flat crescents) or peppers (chilis, thin strands)
  — scaled against the head, and may take over the studio's clump groups. Three male characters wear it: `broku`
  (carrots, classic shonen spikes), `jinto` (bananas, comma hair), his cousin `jingo` (bananas, few, grown from the dome like a cap, for a long face) and `kairo` (chili
  peppers, a wolf cut), the last three after a hairstylist's pass; the first heroine, `bidel`, wears bananas in a short tomboy cut. Shaped hair never cuts through the body: the hero's
  neck and torso are handed to the head and a lock that meets them drapes over them. A layer's `cap` grows each lock
  along the dome and lets it fall only past the hairline, so the crown's locks come out longest. A fourth family,
  PEELS (layered banana peels: thin leaf-shaped sheets cupped to the scalp), dresses `jona`, a side-swept swoop, `selene`, long hair heavy on her right, and `sintia`, flower petals to the shoulder blades. A layer's `flick` hooks
  a lock's end out from the head (or under it), and a layer's `length` now reaches 6. A layer's `gather: [az°, el°]` walks each lock
  into a TIE and ends it there, so `frieda` wears twin tails and `frieda-pony` one ponytail.
- **Blunt cuts and strands.** A layer's `hem` cuts its locks on a LEVEL line (`fringeHem` for the ones leaving over the
  face) and `blunt` keeps a lock's full width to the cut: `hiraku` is a bowl bob, `miwako` a
  neck-length one. The character light's `strands` draws lines inside the hair in its own tone darkened
  (the hue kept), never the ink's black; absent, every light's pieces are as before. The cast gains both as card specs.
- **Face zones and the veil.** `hairCoverage.face` reads the share of the face the hair hides from the front and both
  ¾: RED (each eye, the nose and mouth) and YELLOW (brows, lids, cheeks, jaw). Hair over red past 15 %, or curtaining
  yellow past 75 %, advises. The hair word `veil` (0 … 1) is the mystery and allure lever: one eye may go under the
  hair (to 75 %) and the yellow to 95 %; the other eye and the mouth stay restricted. Advice only; nothing it builds.
- **Sideburn patches.** Every anime head with hair now wears a thin patch in the hair's colour on the skin before each
  ear, from under the scalp's bottom edge (it follows the hairline, so no skin shows between) to the ear's bottom, so no bare gap shows between the hair and the ear
  (`hairSideburnL`, `hairSideburnR`), and the graphic face's ears sit a little closer in to the head. A bald head shows
  its own skin there. The anime heroes' pinned payloads moved
  with it.
  A layer's `swirl` turns its flow one way (a fringe swept off its part), and a style takes up to 12 layers.
  `sideburns` works on any style. The
  principles and recipes cross-referenced to shonen and JRPG heroes are in `docs/examples/humanoid/DESIGNING.md`.
- **Fixed.** An anime hero whose hair is a list (`['long', { locks }]`) now wears that family: before, the list was not
  read as naming one, the base's cut was worn under it and its clump edits were lost.

### Figure articulation: pelvic

The hero's midsection structured from the vajra core it already carries, on the regular and the anime hero alike, and
the default for every hero (`core: 'structured'`). Every hero changes: a stored hero regenerates with it. `core:
'streamlined'` is the hero before it, byte for byte. Being built on this branch; each bullet is rewritten as its phase
lands.

- **The default.** Every hero is built on the structured core unless it says `core: 'streamlined'`. The tune keeps its
  contract on it: `thigh` thickens the thigh about its own rings, `calf` the knee and the shin, `legs` moves the joints
  and no radius; and the outline is one curve in every register (each ring's radius solved from the width it draws).
  A swing word's keys stand on a base of their own, reachable on every verb.

- **The pelvis bone.** On the structured core the `pelvis` bone is the basin: it turns with the hip girdle alone, as
  the vajra's own pelvis does, so a spine curl or arch bends the lower back over a still pelvis instead of tipping it. A
  new `lumbar` bone carries what `pelvis` used to (the pelvis hub to the navel); the hem and the top of the thighs blend
  the two, and a hip-slung blade rides the basin. A rig bone may now take `align`, two joints whose line orients it.
- **The legs converge.** On the structured core the thigh slants in from the hip to the knee, more on the female, so
  the knees sit inside the hips and the feet under the knees. The female casts no longer stand with their knees wider
  than their hips and a deep V between the thighs: their narrowed hips had left the knees behind.
- **The stand owns its base.** New pose words `stance` (how far apart the planted feet stand, as a multiple of the hip
  spread) and `stagger` (one foot forward, one back), and `heelL` / `heelR` in a stand. With converged legs the
  presets plant both feet on a base of their own: the guard wide and bladed with the rear heel up, the relaxed and
  hand-on-hip stands close-set with a soft free knee, a swing on the guard's base. Without these words a planted foot
  stands where it always did.
- **The pelvis mesh.** On the structured core a `pelvis` part on the vajra basket runs from the crotch up into the
  hem, its back the seat, and the thigh is rooted at the hip socket inside it. The hip is one curve out from the waist:
  the female's widest at the trochanter and narrowing steadily to the knee, the male's straight. The front recedes to the
  crotch, the thighs meet under it, and the thigh comes out of the pelvis along the groin's diagonal. Gone: the corner
  and pinch at the side of the female hip, the front standing proud of the belly, the shelf at the hem, the step at the
  knee, and the flat seat.
- **The dress follows the pelvis.** On the structured core the hip pieces hang from the pelvis and ride it: a knight's
  faulds carry on down over the hips under the breastplate and the tassets hang from the crest over the hip, fitted close
  and clear of the thighs at every dial. Every piece that stands off the thighs (a fauld, a belt, a kit of the
  operator's) stands off the pelvis too, and thigh plates wrap the share of the thigh they were drawn for. On converged
  legs a hardsuit's inner knee plate turns less far in, clear of the other knee.
- **The torso.** On the structured core the torso is built on the vajra rib cage: a waist above the hem, the ribs
  widening to a lifted chest, the male's back widest under the arms and the female's narrower, and the shoulders sloping
  from the neck under the arm's own cap instead of a box with square corners. The new rings sit between the five the
  dress addresses, so every torso address (`s` 0 … 4, a collar's station) lands where it did.
- **The chest layers.** On the structured core a pectoral lies over each side of the rib cage, its own part hugging
  the chest: the pair meets at the sternum as one domed chest, its lower border standing proud as the shelf and its
  armpit end moving a little with the arm. The adult female hero carries a bust by default (a child or chibi cast, or
  the kid look, never does): a breast per side over the pectoral, each its own part and a bone each (`bustR`, `bustL`)
  an engine's spring can drive. The breast is a studied field over the chest (`breast-field.js`): its footprint and its
  poles' profiles are a handful of anatomy words, and gates measured on the field hold it to what an artist checks (the
  upper and lower poles 45 : 55, the fold a wall, the upper pole straight or concave, the lower pole full, the margins
  melting into the chest, one clean peak). The pair meets at the midline in a cleavage valley (the field's `cleft`, a
  share of the projection there), not two mounds with flat chest between them, and the triangle between the clavicles
  and the upper poles stays shallow. A bare belly carries a navel, set where the canon puts it: about level with the elbow, a little under the
  narrowest waist. A clothed jerkin covers the pectorals, and every piece worn on the torso stands off the layers. A trunk ring
  may now name its own `u` (the address parameter) and `push` named slots off the ring, a skin blend may weigh one point
  (`station.slot`) over its ring, a new plan kind `rings` gives a part's rings point by point, and a `ring20` slot
  family is there for a finely sampled form. The knight's and
  the ranger's pauldrons and the jerkin's quilt sit on the new shoulder.
- **The swimsuit view.** New `detail: 'swimsuit'` shows the body bare: every shirt, trouser and shoe colour is skin, and
  swimwear is painted on the body's own surface (the adult male's trunks, the adult female's two-piece — on the structured core a speedo and a thong — a child-coded
  figure's rash vest and trunks; the female's cups follow her breasts with a sweetheart top edge that dips into the
  cleft), in a `Swim` tone you can name (by default dark, so the swimwear sorts into the dark
  value band apart from the skin and the hair). A plan segment may now carry `bandGroups` (a group
  per band and slot) and `slotT` (each slot's address parameter).
- **The shoulders and the neck.** On the structured core the neck rises out of the chest: the sternal notch sits under
  the base of the neck at the back, so the neck shows from the front instead of the chin resting on the shoulders. The
  male's trapezius slopes from the neck to the shoulder instead of standing as a plateau, and the shoulder rounds over the arm as a deltoid instead of ending in a square corner. Under the
  anime head the neck's shade is the jaw's shadow, its lower edge a V toward the notch, no longer the whole neck down
  to its seam on the chest. The upper arm's widest point sits a quarter down it, as the deltoid's does, its top a
  dome over the joint; the western figure's neck is a round column whose back rises into the head, and the pectoral's
  top edge rises from the breastbone toward the shoulder as the clavicle does. A segment may name its caps' height (`cap`).
- **The seat.** On the structured core the female's seat is her own shape, not the male's a size up: fuller and
  set further back, fullest halfway down it, its two halves parted by a deep cleft (drawn on bare skin in a darker
  second shade), under a lower back that curves in over it; the male's is square and high, his back running
  straight down into it, two masses with a cleft between them. On the structured core the swimsuit is a speedo for
  the male (low and level, no leg, a clean leg line, the cleft a crease in it) and a thong for the female (a front
  triangle, a thin string rising over the hip and a V at the back narrowing into her cleft, her seat bare), so the two
  seats show; the thong's back is drawn under the studio light as well as the character light.
- **The hands.** On the structured core the hand is a palm and five digits instead of a mitten, on the regular and
  the anime hero alike (the anime casts' hands smaller, the same shape): the palm flat across the back with the thumb's
  and the little finger's pads in front, the knuckles on an arc, the fingers in a relaxed curl that deepens toward the
  little finger, the thumb opposed. The hand hangs facing the thigh, the forearm tapering into it at a rounded wrist. The wrist is a joint and the fingers bend: the
  pose words `wristL` / `wristR` (flex, or `{ flex, deviation, twist }`) and `fingersL` / `fingersR` (a curl, a curl
  per digit, or a hand word: `relaxed`, `open`, `fist`, `point`, `grip`) now move a structured hero instead of being
  refused; a streamlined hero still refuses them. Fifteen finger bones a hand, named as VRM and Godot name them. A rig
  may now carry `hands`, the wrist and digit chains its posing turns in the hand's own frame.
- **The arms.** On the structured core the upper arm and the forearm carry their muscles instead of running as two
  cones: under the deltoid the triceps fills the back of the upper arm and the biceps the front lower down, into an
  elbow that is wider across than it is deep; the forearm is fullest across just below the elbow and slims into the
  wrist over its last third. The male's are marked, the female's softer, the anime casts' softer still. Cuffs,
  bracers and armour land where they did; a streamlined hero is unchanged. A segment may carry shaping rings between
  its own (`shape`), addressed between its rings so its addresses keep their meaning.
- **The legs.** The same on the structured legs: the thigh's front fuller over its upper half, the hamstrings behind
  and the inner thigh full high, the inner bulge just above the knee and the knee narrower under it; the calf full at
  the back and lower on the inside, the leg slimming above the ankle. Swimsuit leg lines, wraps and greaves land where
  they did. A loft's station may name its `u` too.
- **The feet.** A bare structured hero (the swimsuit's) stands on feet instead of shoes: a rounded heel under the
  Achilles, the two ankle bones, the instep rising to the shin, the arch lifted on the inside, the ball wide on a
  slant; the big toe its own, apart from the rest (the grip), the other four side by side with the lines between them.
  The toes bend with the toe bone. Footwear replaces the foot: a hero in shoes, clothes or armour keeps the shoe as it
  was, and sandals and boots to come take the foot's place on the same joints.
- **The western forehead.** The landmark head's forehead rises from the brow instead of leaning back from it, and the
  brow's outer end stands level with the corner of the eye instead of sinking in behind it, so the far side of the face
  no longer caves in over the eye in the ¾ and the profile. The hair rides the new forehead. Every hero with the landmark
  head changes a little above the eyes, the streamlined core's too.
- **The ear.** The ear is an ear, not an egg, on the landmark and the anime head alike. From the side the broad top
  runs into a nearly straight back edge and down on a diagonal into a broad lobe, the front open where the rim ends, the
  ear leaning back. It is a thin plate, like a leaf, joined to the head at its front and angled off it toward its back.
  On the landmark ear the rim is raised, the antihelix rises inside it and the bowl dips behind, in the darker inner
  tone, so the light shows its depth; the anime ear is a simpler rim, fold and bowl, drawn by its outline. The anime
  head's studio-exact face (`sculpt: false`) keeps its own ear.
- **Smooth shading on the western hero.** A hero under the studio light (the landmark head, or no head) is shaded
  smoothly instead of one flat tone per triangle: the face reads as one form instead of facets over the nose and the
  cheeks, and the chest, the belly, the back and the limbs read as muscle instead of a grid. The skin blends across
  edges that turn up to 70°; hair, cloth and the swimsuit keep their edges. The clip preview shades the same way. The
  anime hero is unchanged (its two tones already follow a smoothed surface), and so is every layered sketch that is not
  a hero.
- **The jaw seam.** A standing hero with the landmark head no longer shows a dark line from the mouth along the jaw to
  the ear when the head is turned: the jaw now turns exactly with the head, so it stays closed against the skull, and it
  still opens at its hinge.
- **The hair over the temple.** The skull no longer pokes through the hair at the left temple like a horn: the hair's
  cap is folded outward over the skull on both sides alike, where its left half used to sink between its points. Every
  cut with a cap changes slightly, the anime cuts' cap under their locks too.
- **The head stored once.** A stored hero kept its anime head twice, once in the plan and again in the recipe the plan
  expands to: about half of every hero row. The recipe's copy is no longer stored; it comes back from the plan when the
  row is read, so every tool, render and export still sees the whole recipe. A head part edited by hand under
  `/recipe` is stored as edited. A hero row is about 1.2 MB instead of 2.35 MB; a row stored before shrinks on its next
  edit.
- **The torso's anatomy.** On the round register the structured torso and pelvis are rounder (twelve points a ring,
  addressed on the old scale, so every armour piece, kit and quilt lands where it did), and they carry the forms a
  silhouette is marked by: the male's chest and its shelf, the sternum, the belly and the navel, the lats and the
  waist's taper, the shoulder blades and the spine; the female's deeper waist and the curve of the lower back; the seat's
  two masses on the pelvis. The step at the waist is gone.
- **Core measures.** Every hero's readout carries `core`: the waist to hip, where the hip peaks, the seat, how far the
  front falls below the waist, any pouch, the largest step in the outline, and whether the legs converge, with advice
  against bands per body that names the word to move. On the structured core the advice is a warning; on a streamlined
  hero it stays in `core.advice`. The design loop's critic reads it. `render-pelvic-overlay.mjs`
  draws the vajra core over the hero mesh before and after.

## [3.0.0] - 2026-10-01

### Upgrading from 2.x

- **3.0.0 is the release after 2.1.0.** A 2.2 was prepared and never published; everything it carried
  is in this release. Removing the chatbot factory is why this is a major version.
- **Node 22.14 or newer.** 2.x asked for 22.12, but on Node 22.12 and 22.13 the database library
  (better-sqlite3) crashes the process the first time it opens the database, with no message; 2.1.0
  crashes the same way. 3.0 checks the version at start-up and says which Node to install.
- **The 2.x line is unmaintained.** No 2.x release will be patched, and running one is not
  recommended. 2.1.0 and the bot image it deploys (`mojulo-bot` 0.5.1) have known security issues: an
  open relay on deployed bots (`/api/send-webhook`), SSRF in `upload_document_from_url`, path
  traversal in the Office-document parser, Fly credentials in the machine environment, dashboard DNS
  rebinding and cross-site writes, a revoked delegate's dashboard session that outlives the
  revocation, a delegate's dashboard session that holds the operator's authority, and an
  `update_sketch` patch that reaches the prototype chain
  ([SECURITY.md](https://github.com/zombico/mojulo/blob/v3.0.0/SECURITY.md#known-issues-in-2x)). Bots
  already deployed from 2.x run on their own, on that image, until you take them down.
- **Unpinned installs move to 3.0 on their next start once 3.0.0 is npm `latest`.** A host that runs
  `npx -y mojulo` (every config 2.x `mojulo init` wrote, the README's manual lines, and the Claude
  plugin up to 2.0.1) installs 3.0.0 on its next start, whether or not the plugin was updated. The
  3.0 plugin runs `npx -y mojulo@3.0.0`; update it, and remove any `mojulo init` or `claude mcp add`
  registration beside it (two registrations run two servers). Exact pins and a global
  `npm i -g mojulo` stay on their version until you change them. The first start downloads about
  79 MB (the package and its dependencies); if the host gives up, start Claude Code with
  `MCP_TIMEOUT=60000`, or run `npx -y mojulo@3.0.0 --help` once in a terminal. Restart every host
  afterwards so no 2.x server keeps running against the same `~/.mojulo`.
- **Saved provider keys become unreadable to 2.x.** With `API_KEY_ENCRYPTION_KEY` unset (the
  default), the first time a 3.0 process reads saved keys (`mojulo-config`, `list` included;
  `mojulo init`'s key prompt; the dashboard's key settings; `mint_solid` `via:'prompt'` without an
  inline `apiKey`), it re-encrypts every key a 2.x install saved, the Fly token included, under a
  per-install key at `$MOJULO_HOME/secret.key`. 2.x cannot decrypt them after that; the change is
  one way. **Back up `secret.key` together with the database:** without it 3.0 cannot read the keys
  either.
- **What left, and what it left behind.** The chatbot factory is no longer part of mojulo as of 3.0
  and is moving to its own project. Earlier 2.x versions that include it are unmaintained and have
  known security issues. Its tools, packs and dashboard pages are not in 3.0; calling one of its
  tools, `mojulo install chatbot` or an `artifact_materialization` commit does nothing and answers
  with that notice. Its tables (`deployments`, `modular_sessions`, `mcp_jobs`) and their rows, and the
  `packs/chatbot` marker, stay in `~/.mojulo`, inert: 3.0 does not use them, and you may delete them.
  **`~/.mojulo/data/artifacts/` holds each old bot's `.env` with its provider key in plain text:
  delete it.**
- **Downloaded helpers and draft figure specs move out of the npx cache.** 2.1.0 kept Chrome for
  Testing, ffmpeg, gallery stills, turntable strips and draft figure specs inside its package folder;
  3.0 keeps them under `$MOJULO_HOME`. An unpinned upgrade replaces that folder, so they are not
  carried over; pending figure specs are lost unless another version's npx folder still holds them
  (3.0 copies those across once). The browser (now build 154) is no longer fetched in the
  background: with no browser installed, gallery thumbnails stay blank until one is available (an
  installed one, `MOJULO_CHROMIUM`, or, outside the Claude plugin build, an explicit render's
  download).
  @puppeteer/browsers 3 has no proxy support, so a host behind an HTTP proxy sets `MOJULO_CHROMIUM`.
- **Other changes a 2.x setup can notice.**
  - `mojulo init` changes nothing without `--yes` when stdin is not a terminal: it prints its plan and
    exits 2. With the Claude plugin installed it leaves Claude Code to the plugin.
  - The dashboard is its own package, `mojulo-ui` (`npx -y mojulo-ui`); `npx -y -p mojulo mojulo-ui`
    downloads the matching version on first use (`MOJULO_UI_NO_FETCH=1` refuses). It answers 403 to
    a `Host` other than loopback, `MOJULO_UI_HOST` or a name in `MOJULO_UI_ALLOWED_HOSTS`, and to a
    cross-site write, so a LAN, proxy or tunnel setup needs `MOJULO_UI_ALLOWED_HOSTS`.
  - `mint_solid` `via:'prompt'` requires `provider`: nothing chooses the provider for you any more.
    The key is `apiKey`, the saved key named by `apiKeyId`, or else your saved key for the provider
    you name.
  - Exported World pages are self-contained by default again (`world.html`, no third-party fetch);
    `cdn: true` writes `world.cdn.html`, and `world.offline.html` is no longer written.
  - Stored `floorplan` and `condo-complex` rows that relied on the old room defaults re-render
    roomier, and the furnish pass doors sealed rooms, parks interior doors open against the wall and
    moves wall pieces out of a door's way
    ([Room livability](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#room-livability),
    [Furniture audit](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#furniture-audit)).
  - `chatbot` or `ops` in `MOJULO_PACKS` is ignored, so `MOJULO_PACKS=chatbot` alone now leaves the
    creative tools on.
  - `MOJULO_MCP_TELEMETRY=off` stops only the local tool-call log, no longer the tool timeout, and
    `MOJULO_MCP_TOOL_TIMEOUT_MS` can raise a tool's budget but not lower it. Render tools get 600 s.
  - `mojulo install creative` installs nothing (the creative pack always ships), and
    `mojulo install recall` now works from npm and npx. With the runtime already installed and the
    search model missing, it fetches the model instead of reporting nothing to do.
  - A delegate (roles pack) signed in to the dashboard reads and no longer writes (below).
  - A city minted from now on wears the round street kit (below); stored cities are unchanged, and
    `elements: { roundKit: false }` keeps the block kit.
  - A material object whose `metal` is a name (`{ metal: 'steel', finish: 'brushed' }`) is a metal
    surface (below); beside `base` or `preset` it is refused. The shelf's numeric `metal: 1` is
    unchanged.

### What 3.0 is

- **A 3D compiler for agents.** Your agent builds objects, walkable worlds and games by conversation
  as small deterministic recipes on your machine, compiled back to the same geometry (byte for byte on
  the same platform) and exported to STL / 3MF, glTF, OpenUSD, IFC4, self-contained HTML, Godot,
  Blender, Unity and Unreal. The bot factory, which never fit that, is gone.

### Determinism

- **What "the same geometry" means.** A recipe compiles to the same geometry every time: byte for byte
  on the same platform (OS, CPU and Node version), and to within floating-point rounding on any other.
  V8's `Math` is not one function everywhere: its arm64 builds round `sin`, `cos`, `exp`, `atan2` and the
  rest differently from x64, and since Node 24 `Math.pow` and `**` call the platform's C library. An
  embedded texture PNG can also differ in its compressed bytes between Node builds (Homebrew's Node links
  a different zlib), never in its pixels.
- **3.0's generators go further.** The vegetation engine, terrain worlds, the anime head and hero, stores
  and construction, metro and canal cities, the metro refacade and the Tian Tan Buddha take their
  transcendental functions from a deterministic math module (fdlibm in plain double arithmetic), so their
  pinned outputs are the same bytes on Linux and macOS, x64 and arm64, Node 22 and 24, and CI checks them
  on every runner. The older helpers they reach switch to it only inside a 3.0 build, so nothing minted
  with 2.x changes. A few older helpers still use the engine's `Math` (specular shading, sRGB conversion,
  some textures, roads, the metro World's walkers and cars).

### Lean install

- **3.0.0 against the published 2.1.0, one method.** A cold start with an empty npm cache and a
  fresh `HOME` and `MOJULO_HOME` (`npm exec --package=<tarball> -- mojulo`) through a local registry
  stand-in, timed from spawn to the `initialize` answer, on one macOS arm64 machine (M1 Max). Sizes
  are decimal MB; the installed and downloaded rows include the package itself, and "downloaded" is
  the unique tarballs plus the package metadata, estimated gzipped.

  | | 2.1.0 | 3.0.0 |
  |---|---|---|
  | npm tarball | 31.2 MB | 6.7 MB |
  | Unpacked package | 121.7 MB | 21.3 MB |
  | Installed, package and dependencies | 539 MB, 426 packages | 227 MB, 153 packages |
  | Downloaded on a cold start, package included | about 182 MB | about 79 MB |
  | Cold start to `initialize`, median (p90) | 12.7 s (15.7 s), 14 runs | 4.5 s (4.6 s), 6 runs |

- **Machine caveat.** The two timings come from separate sessions on a busy machine: 2.1.0 on
  2026-09-27 (load average 3 to 12), 3.0.0 on 2026-09-30 (7 to 11). In the 3.0.0 session, runs of a
  pre-release 3.0 candidate interleaved with the release's took a median 6.1 s: the release installs
  one copy of sharp instead of two, 26 packages fewer. Trust the sizes more than the seconds, and
  expect the real registry to be slower than the stand-in. npm also keeps the downloaded tarballs in
  its cache, about 140 MB for 3.0.0. 2.1.0's package carried the dashboard build; 3.0.0's dashboard
  is `mojulo-ui` (12.7 MB packed, 57.0 MB unpacked), fetched only when it is opened.
- **The package never carries a local content pack.** A tarball or `mojulo-ui` build made from a
  checkout holding the operator-local mobile-suit content pack carried it; the package file list
  leaves it out, a test fails any tarball carrying a gitignored file, and the dashboard build refuses
  such a checkout. A clean install no longer prints warnings about that absent pack.
- **What left the install:** the dashboard build, `@swc/core`, `three`, the dashboard-only libraries,
  `dotenv`, and the chatbot factory's `officeparser` and `pdf2json`. puppeteer-core, archiver and
  react load on first use, so the stdio server boots without them. Details:
  [docs/tech-requirements.md](https://github.com/zombico/mojulo/blob/v3.0.0/docs/tech-requirements.md),
  [Lean cold start](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#lean-cold-start).

### Security and consent

- Saved provider keys are encrypted under a random per-install key (`$MOJULO_HOME/secret.key`, mode
  0600) instead of a constant in the source. The dashboard refuses DNS-rebinding and cross-site
  requests. `mint_solid` `via:'prompt'` never chooses the LLM provider for the caller: `provider` is
  required, and the key is `apiKey`, the saved key `apiKeyId` names, or the caller's saved key for
  that provider.
- Chrome for Testing downloads only for an explicit render and says so (never under the Claude
  plugin, below); headless Chromium keeps its sandbox (on Linux it falls back only on Chrome's
  sandbox errors or as root); the ffmpeg download is SHA-256 pinned; everything mojulo writes lazily
  lands under `~/.mojulo`.
- `mojulo init` needs `--yes` when nobody is at a keyboard. "No telemetry" is now "no external
  telemetry", with the local tool-call log described. Core has no Docker, Fly, GHCR, webhook or
  uploaded-document code path.
  ([Security hardening](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#security-hardening),
  [Runtime footprint and consent](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#runtime-footprint-and-consent))
- **Revoking a delegate's key now ends their dashboard session on their next request.** Before, the
  dashboard checked only a session's signature and 7-day cookie expiry. A delegate (roles pack) whose
  key was revoked with `revoke_role_key`, had expired, or had its token epoch bumped could keep using
  the dashboard until the cookie ran out, even though their MCP bearer had already stopped working.
  Such a session now gets the same 401 on `/api/*` and redirect to `/login` as no session, and with
  the roles pack off a delegate session is refused outright. The dashboard middleware now runs on the
  Node runtime so it can make this check. The operator's own session, installs with login off, and
  installs without the roles pack make no database read.
- **A delegate's dashboard session is read-only.** No dashboard route checks a role, a grant or a
  flag, so on 2.x a signed-in delegate held the operator's authority there, whatever the role
  granted: deleting the operator's saved keys, writing an app's `.env` and starting the app, deleting
  sketches. A live delegate session now reads pages and the API, and gets 403 (`DELEGATE_READ_ONLY`)
  on every write and on the settings API. The roles pack's grants still bind the delegate's MCP key;
  the operator's session is unchanged.

- **sharp 0.35.5.** The image library moves past high-severity advisories in its bundled libvips and
  libheif (GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c), and `mojulo-ui` no longer carries the older copy
  Next.js keeps for `next/image`, which the dashboard never imports. An image submitted for a render
  that does not decode is refused at submit.
- **A patch cannot reach the prototype chain.** An `update_sketch` patch path through `__proto__` or
  `constructor/prototype` set or deleted a property on every object in the server process until it
  restarted. Such a path, or the same key in a set-by-id merge, now refuses by name.

### Claude plugin and directory readiness

- Every tool carries a `title` and behavior `annotations`, `initialize` negotiates `2025-06-18`,
  `2025-03-26` or `2024-11-05`, and the Claude plugin pins `npx -y mojulo@3.0.0`
  ([annotations](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#mcp-tool-annotations-and-protocol-negotiation),
  [disclosure](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#directory-listing-and-disclosure)).
- **The Claude plugin build.** When the Claude plugin starts mojulo, it leaves out the handoff tools
  for AI image, voice and mesh generators. That covers the image-render and mesh handoffs, the voice
  registers, sprite sheets, style presets, the skin op, the painted sketch kinds, the painted cover
  title, `forge_motion`'s scene and cel sources, the character-from-dream figure specs and a
  figure's `dream_audit`, and the image-driven catalysts. The vocab cards and catalysts it keeps are
  served without their lines about those loops. It also leaves out the keyed
  `mint_solid via:'prompt'` door (use `via:'packet'`) and every automatic download:
  - renders use a Chrome, Chromium, Edge or Brave you already have, or `MOJULO_CHROMIUM`;
  - MP4 encodes use an ffmpeg you already have, or `MOJULO_FFMPEG`;
  - the search model arrives only through `install recall`.

  Exported World and game pages are always self-contained there: `cdn: true` is ignored, and the
  result says so. The host adapter cards are served without their image-generator and CDN lines, and
  the MCP Apps preview is not offered. A call to a tool the plugin build leaves out answers in-band.
  Installs from npm or a checkout are unchanged.
- **The plugin listing.** It is rewritten for 3.0 with three example prompts that work in the plugin
  build, a table of what it installs, fetches, runs and writes, a privacy policy link, an "Upgrading
  from 2.x" note, and an icon.

### Hosts

- **ChatGPT.** Its own adapter card (`get_adapter({ id: 'chatgpt' })`) and handoff profile, for
  connected MCP and for a shell-enabled Work box. A separate ChatGPT skills package
  ([plugins/mojulo-chatgpt](https://github.com/zombico/mojulo/blob/v3.0.0/plugins/mojulo-chatgpt/README.md))
  prefers connected MCP and otherwise sets up a pinned, workspace-local CLI in the box. Handoff notes
  keep a file on the MCP server apart from a file in the session, and promise no attachment or inline
  preview the session has not shown. Codex is no longer recognized by the bare OpenAI vendor name.
- **Meta Muse.** A host profile and adapter card for the shell-only agent on its own persistent Linux
  VM, where `npx mojulo call` is the whole surface and `MOJULO_HOST=muse` names its doors: pages leave
  through its Artifacts, files through its Library. A bundle export's `<ref>.courier.html` lists the
  export's files under `outcomes/<ref>/`, each with a Save where the viewer allows it, so one HTML page
  can deliver any of them. A host profile
  may name its own page words (`pageVerb`, `pageTool`, `pageOpensIn`), what its page door does with
  inline scripts (`inlinePage`), and a `drop-folder` file door.
- **`MOJULO_HOST`** picks the adapter card on the CLI, for `get_adapter`, catalyst composition and
  recommendations, when no client identity says which host is calling. An explicit adapter id or a
  recognized client still wins.
- **Recipe recovery.** `create_sketch` accepts an exported world recipe and passes it through the same
  validation and ledger stamp as `update_sketch`, so a recipe carried out of a temporary box comes back
  as it left, a hero with its hand edits. A duplicate ref refuses, and referenced assets must already
  exist.
- **MCP Apps preview, opt-in.** With `MOJULO_MCP_APPS=1`, `preview_world` shows an inline mesh
  snapshot of a stored ref in a host that supports MCP Apps; the exported HTML stays the full world.
  Nothing is hosted publicly.

### Dashboard package

- **The dashboard is its own npm package, `mojulo-ui`,** published at the same version as `mojulo`
  and depending on exactly that version. `npx -y mojulo-ui` starts it; core's `mojulo-ui` command
  runs the matching package or downloads it after saying so. It has no bot pages. Both packages
  carry LICENSE and NOTICE, and the dashboard lists every package it redistributes in
  `THIRD_PARTY_NOTICES.md`
  ([Dashboard package](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#dashboard-package)).

### Creative work

- **Characters and heroes:** the hero as a core form with a create-hero loop and tunes kept as the
  record, fitted landmark heads with a face tune and a hair library, the ring plan and creature loop,
  planar humanoids, and worn things that follow the dials
  ([Create hero](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#create-hero),
  [Hero detail](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hero-detail),
  [Hero tune](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hero-tune),
  [Fitted heads](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#fitted-heads),
  [Face tune](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#face-tune),
  [Hair library](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#hair-library),
  [Ring plan](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#ring-plan),
  [Planar detail](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-detail),
  [Planar humanoid](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-humanoid),
  [Read and attach](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#read-and-attach)).
  The hero also wears the Anime Form Studio's head (`head: 'anime'`) on anime proportions, with
  fitted hair forms, looks as composable words, a graphic face and neck, a character light with
  designed shadow shapes, draw layers and clips at the door; its skinned GLB and Godot pack carry the
  face. Worn armour (plate, samurai lamellar and hard-suits, with themes carried down a suit) and held
  gear with swings ride the hero door
  ([layered manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/layered.md),
  [designing a hero](https://github.com/zombico/mojulo/blob/v3.0.0/docs/examples/humanoid/DESIGNING.md)).
- **Arms, metal and gems:** swords, daggers, greatswords, staves, bows and shields composed from a few
  dials and laws, pattern-welded blades included (`mint_solid` kind `equipment`); metal as a surface
  any part, facade, roof or trim can wear (a metal, a finish and an oxide film), reflected on the World
  page and kept in glTF and USD; gems with their optics and exact light prints, and crystals as light
  operators in worlds, performed in Godot
  ([equipment manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/equipment.md),
  [workbench manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/workbench.md)).
- **Cities and worlds:** metro and canal profiles for the fractal city, redrawn landmarks and sacred
  buildings, stores and malls from concept cards, and large cities streamed by tile
  ([City scale](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#city-scale),
  [Canal city](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#canal-city),
  [Local city refacade](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#local-city-refacade),
  [Retail concept cards](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#retail-concept-cards),
  [World streaming](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#world-streaming)).
  New cities wear a round street kit: lamps, poles, bins, bollards, piers, playground frames and
  rooftop equipment drawn round, a few of them in metal.
- **Interiors:** houses minted in a style, livable default room sizes, and a furniture audit that
  gives every room a way in
  ([House styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#house-styles),
  [Room livability](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#room-livability),
  [Furniture audit](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#furniture-audit)).
- **Buildings and furniture:** timber from a synthetic log, steel sections, reinforced concrete and
  masonry, joined by Western and Japanese joinery through the exact kernel and checked, never refused;
  houses framed, lined and wired by their building tradition, carrying a building model with a
  takeoff; tile roofs and drainage; houses exported as IFC4 (`export_model` `format: 'ifc'`); house
  design checks that measure the walkways, with a repair; furniture built from sheet goods and
  fittings (carcasses, tables, chairs, sofas with upholstery and cloth from a weave draft), checked for
  sag, racking and tipping, with wordless assembly manuals; and the built pieces placed in rooms and
  condos ([floor plan manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/sketch-vocab/floor-plan.md),
  [workbench manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/solid-vocab/workbench.md)).
- **Terrain and nature:** a painted landscape made real-scale ground you walk, fly and orbit, up to a
  small planet, or a world composed from features (a river, a range, a lake, a volcano, a coast) sized
  on real-world bands, with fractal cities sited on its hills; plants grown rather than drawn (trees by
  their architecture, palms, bamboo, figs and conifers), standing as forests where the ground is
  painted wood, and grass; rocks built from their minerals, and landforms and erosion on painted
  landscapes ([terrain manual](https://github.com/zombico/mojulo/blob/v3.0.0/control/lib/graph/views/view-vocab/terrain.md),
  [vegetation](https://github.com/zombico/mojulo/blob/v3.0.0/docs/vegetation.md)).
- **Look and drawing:** shading normals from the hull, outlines and rims carried into Godot, Unity
  and Unreal, key-and-fill art direction, and the `layered` kind drawn from its compiled mesh, with
  rigs and clips
  ([Shader look](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#shader-look),
  [Art direction](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#art-direction),
  [Planar drawing](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#planar-drawing)).
  A line drawn on a `layered` solid becomes a recipe op (a silhouette solves the shape dials, a
  contour becomes a ridge strip, a brush a dial), with the share of the line it could not hold.
- **Audio:** stereo and per-hit variation, tuned strings, orchestral scoring and era synths, and
  anthem and roots song styles, all synthesized from formulas and opt-in
  ([Audio fidelity](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#audio-fidelity),
  [Orchestra and era synthesis](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#orchestra-and-era-synthesis),
  [Anthem styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#anthem-styles),
  [Roots styles](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md#roots-styles)).

2.1.0 and earlier releases, and the detailed log behind this release, are in
[CHANGELOG-2.x.md](https://github.com/zombico/mojulo/blob/v3.0.0/control/CHANGELOG-2.x.md).
