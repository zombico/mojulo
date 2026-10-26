# Changelog

All notable changes to the `mojulo` npm package are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
From `3.0.0` the media, game, connected-service and app loops and the recipe
format are the stable surface, and the chatbot factory is no longer part of
mojulo. From `3.1.0` the connected-service and app tools are no longer listed:
they still answer by name (the CLI, plan steps, skills that name them). The dashboard package, `mojulo-ui`, is released at the same version.
Releases up to 2.1.0, and the detailed log behind 3.0.0, are archived in
[CHANGELOG-2.x.md](CHANGELOG-2.x.md); the detailed log behind 3.1.1 is
[CHANGELOG-3.1.md](CHANGELOG-3.1.md).

## [Unreleased]

### Battle city: sports as a contest over the movement stack

A sports game is two things: what is happening at the ball, and what the game state is. The first is the movement
stack the action games already play (the platform rule, the feel cards, the hero library's clips) with a free body; the
second is rules, deterministic as a board game's. A CONTEST is the rules layer: who may stand where, who has the ball,
the clock and its stoppages, the score, the fouls and the restart each one triggers. The agent composes the contest
recipe; a World page channel draws the kernel's state as the scoreboard, the lit zones and the referee's calls; the
kernel calls every point, never the agent. Two shapes of contest, one kernel: a MEET (lanes, a start, a measure,
attempts: the athletic events) and a MATCH (sides, a ball, possession, zones whose legality depends on the state). The
register ladder from a simulation to an arcade game (a tennis to a cartoon tennis) is the feel card's axis on the body
and a ball card's on the ball. Planned, in order:

- **The registry sees sport**, built: probes for an athletics meet, a net game, a turn sport and a team goal game in
  the cosmos fixtures, and the facet values they ask for (the `meet` and `contest` mechanics as the mechanics table's
  planned values, a `team` party, a `court` level form, a `position` motivation), each absent and priced as one
  package, so the hill-climb page records the gap and the move: every probe reads blocked, naming the values it waits
  on, and the package ranks first of the priced packages by worlds lifted per effort. Each probe is a genre with the
  words a brief uses for it (a sport named is its shape's: "tennis" the net game, "football" the team game, "golf" the
  turn sport, "hurdles" the meet; "race" stays the car's), raises its concerns (a court with its lines mirrored for the
  other side and a broadcast camera; room for a side), and plays in the realistic flavor until the operator's word moves
  it toward the arcade.
- **The contest kernel** (`lib/graph/contest/contest-kernel.js`), built: one self-contained closure (`buildContest`),
  pure and seeded as the board kernel is, a contest as data. A MATCH: a court of named regions (a rectangle or a
  circle in metres, the net at the middle) written for one side and mirrored for the other, half-turn or reflected, or
  shared; a ladder of scoring units, the lowest first (a unit won at `to` ahead by `by` resets and adds one to the next;
  tennis's game is four by two named 0 15 30 40, and the scoreboard says deuce and advantage; a unit with no `to` is the
  clock's); a serve (into a region, or regions cycled by the game's points; so many faults lose the point; a let off the
  cord; the serve changing hands by the game, by points, or on a side-out, each side's servers rotating) or a kickoff;
  the rally's rules (where a bounce is in, how many bounces a side, how many touches, the same player twice); a clock
  of periods with overtime or a draw; fouls that cost a serve fault, the point, a free restart for the other side, or a
  warning; rally or side-out scoring. A MEET: lanes, the set, a gun on the kernel's seeded delay, a false start that
  disqualifies or warns once, a race measured from the gun, or attempts measured in metres with fouls, placings by the
  best. The kernel reads FACTS the movement layer saw (a touch by whom and where, a bounce where, the ball on the cord,
  the ball out, a foul, a goal, the clock's tick, the restart taken; a runner's press, finish or mark) and answers what
  each player may do now (its regions, whether it may touch, whether it serves), the phase, the score, the clock and
  every call (a point and why, a fault, a let, a game, a set, a period, the gun, a false start, the end). A fact the
  rules do not care about changes nothing. It never integrates a body or a ball, and the agent never adjudicates.
  Fixtures in the data alone, one per procedure and not in the book: singles tennis, volleyball, a goal game on a
  clock, a sprint, the long jump. The tests hold the concept on them (the diagonal serve into the box the point names,
  the fault and the double fault, the let, the volleyed serve, reaching over, the ladder to a set and a match, three
  touches and the side-out rotation, kickoff and the free, the periods and the draw and overtime, the gun's clock, a
  disqualification, the best of three attempts), that the same seed and facts are the same contest to the byte, that
  the closure runs from its own source with no imports, and that it never mutates a state. A published game asked for
  by name is written out from the rules the person explains, as the tabletop kernel's rule already says; tiebreaks,
  possession by carry and offside wait on the team game.
- **The ball and the hit**, built, with a recorded stopping point:
  - **Real air on the live ball.** The physics property's integrator (`worlds/physics-sim.js`) gained the `aero` force
    rule: drag with the drag crisis and Magnus lift saturating with the spin ratio, the spin-aware flight model's own
    curves and constants (`physics/flight.js`, the oracle it is held to), the air's density and a spin decay in flight,
    `on` the bodies it acts on. On the model's free-kick launch the live ball lands within half a per cent of the
    oracle's range, apex and curl at the oracle's step, within one at the page's; no crisis flies farther, no spin flies
    straight, no air is the parabola; a body the rule is not on keeps every byte. Every page that embeds the integrator
    re-pins with the rule's source (additions only; a world without an `aero` force runs as before).
  - **The ball card** (`lib/graph/contest/ball-card.js`): the sports' balls (soccer, tennis, volleyball, basketball,
    golf, table tennis: mass, size, the rebound each sport's rule allows as a restitution, the aero curve where one is
    cited, soccer's otherwise and said so), and a card per register, the feel cards' own names: realistic flies the
    sport's ball in real air; action drops the air and grows the rally a share a clean hit to a cap (the cartoon tennis)
    with a livelier bounce; the platformer's ball is slow and floaty under lighter gravity; pinball's never stops
    gaining and bounces lossless. A card makes the sim's body, its force rules and its gravity; the report says what it
    leaves out (a bounce that gives back more than it got is the hit's to add: the table keeps a contact lossless at most).
  - **The hit** (`lib/graph/contest/hit.js`): the join of the swing and the ball. The hit is live through the swing
    system's contact window and lands on its strike phase, on the game type's timeline where one re-times it; a ball
    inside takes a velocity whose direction is the body's facing turned by the stick within the register's spread and
    the verb's arc lifted by the stick, whose speed is the register's base plus its gain on the swing's real tip speed by
    the verb's power (realistic is the tip alone), grown by the ball card's rally, and whose spin is the verb's (topspin
    about up × the heading, backspin the other way, sidespin about the vertical), scaled by the register. The result is
    the sim's own impulse and the contest kernel's `touch` fact.
  - **The forehand, the backhand and the bat** in the swing system (`hero-swing.js`): a level arc on the right side
    taken back and out and carried across the body, the same from the other side, and the two-handed level swing; each
    through every gate the swing system holds on both casts at every class (solvable at mint, the item clear of the head
    and above the floor, the elbow at the shoulder line, the strike on its key). Until a racquet and a bat are gear items
    they swing the hand's gear whatever it is.
  - **Not built, said where it is asked for:** the overhead serve and spike (they lift the elbow over the head, which
    the swing system's law forbids: an overhead clip family is a later step), the volleyball's bare-handed bump and set
    (the swing door needs an item in the hand), the kick (a leg clip from the vault's solve), the throw, the catch and
    the putt. Each is a hit verb already (its arc, spin and power hold) whose window says no clip plays it yet.
- **The meet**, built as a track the World page plays, with a recorded stopping point:
  - **The meet sim** (`lib/graph/contest/meet-sim.js`): an athletic event as a pure function of the lanes' pads at
    60 Hz, in versus's shape, the contest kernel its referee (the set after the marks, the gun on the kernel's seeded
    delay, the race clock from the gun, a press before it a false start on that frame, the finish and the marks its
    facts, its calls the sim's). Each lane is a body on a line whose sprint is the motion flavors' own top speed and
    build-up, register for register (held equal by the test), driven as the register drives it: the realistic register
    holds the run and a press on the footfall's beat lifts the form while one off it drops it (the beat never narrower
    than a frame and a half of stride); the arcade registers mash, the press rate the speed and the full rate the top.
    The hurdles are flights at the 110 m spacing: a hop begun in the approach band clears one and keeps most of the
    speed (the realistic register takes it on the stride itself, the others on the press), a flight met on the ground
    clips the runner into a stumble no pad drives. The long jump takes off on the press in the runway's last metres,
    flies the arc of its speed and the register's angle on the register's gravity, is marked from the board, a
    take-off past the board or a run through it a foul, the runner back for the next attempt until the kernel says
    they are spent. A lane with no pad is run by a seeded computer that never jumps the gun. The same context and
    pads are the same meet to the byte.
  - **The meet arena** (`meet-arena.js`): the venue as a stage recipe, the versus arena's sibling: one long open room
    on a stage kit, the lanes along it, the stands behind them, a broadcast camera, and the `meet` key (the event, the
    lanes, the players, the register, the distance, the attempts, the seed, the kit, the crowd), checked and
    teaching; the track in the stage's frame (each lane's line, the start, the finish, the flights, the board); the
    page's data with the contest compiled and the level wire's names.
  - **The meet on the World page** (`scene/channels/contest.js`, `meet-arena.client.js`): a channel on a world's
    `meet` key that inlines the kernel, the sim and its client by source and owns the camera; up to four players on one
    keyboard or the gamepads by index, the other lanes the computer's; the runners stick figures posed from the sim's
    stride, the air and the stumble (a first drawing); the lane lines, the flights and the board on the floor; a
    broadcast side camera that follows the field; the banners (ON YOUR MARKS, SET, GO, a false start), each lane's
    clock or best, the placings; the hosted wire (READY, the meet INIT brings, the OUTCOME when the placings are in:
    success when a player's lane placed first, or an exhibition). The page's probe runs an exhibition to the placings
    the same meet reaches in Node, frame for frame (the e2e suite, in a real browser). The `meet` fixture joins the
    emission matrix; a page without the key emits no block.
  - **Not built, said:** the quick game's `meet` goal (the arena plays on its own and hosted; the game shell's level
    is the next step), the hero library's clips on the runners (the stick figure stands in), the throws (a javelin or
    a shot is not a sphere, and the flight model is sphere-only by design).
- **The net game**, built as a court the World page plays, with a stopping point: `lib/graph/contest/sports.js` (the
  book of sports: tennis's spec for the kernel beside its dials, the ball, the strokes, the net, where the server and
  the receiver stand; a sport asked for by a name the book lacks is refused by name); `contest/match-sim.js` (the match
  as a pure function of two pads at 60 Hz: the body held to the motion flavors' sprint and build-up register for
  register, the ball the physics property's sphere on its card, the serve from the hand into the box the point names,
  the swing's strike window from the swing system, the floor and the cord as the kernel's bounce, net and out facts,
  the point, game and set the kernel's; in the arcade registers the aimed shot, the arc that lands at the depth the
  stick asks, lifted over the cord, the speed given up for it; the realistic register is never aimed);
  `contest/contest-mind.js` (the court mind at the mind's four tiers: it reads the ball's way on the ball's own
  physics, runs to where it crosses its depth after its reaction, swings in reach at the depth its stick says, serves
  across into the box after its wait; plain, seeded, bounded); `contest/match-arena.js` (the venue a stage recipe with
  the stands behind the far baseline and a broadcast camera, `matchArenaData` the page's data, `graphSource` a module
  inlined by source), `match-arena.client.js` and the `court` channel (`scene/channels/contest.js`: WASD and F or
  Space, the arrows and the right Shift or the keypad 0; the court's lines from the kernel's regions, the net, the
  players, the ball and its shadow, the scoreboard in the kernel's words, the hosted wire), hooked up as the meet is
  (world-scene, channels/index, scene-three, the `court` emit fixture pinned, the engines' marks, test-changed's
  readers), the e2e `court-page.live.test.js` (the page's exhibition equals Node's frame for frame). What building it
  corrected: the kernel's double-bounce rule (a ball bounced in and never returned is the striker's point, in the bounce
  and the out branches; before, the out went to the side that failed to return it), the hit's azimuth (the stick right
  aims right), the aimed elevation's cord check (a cord past the landing is no cord), the racquet on the player's
  right. Stopping point: the quick goal `contest` (the shell's level, as `meet`'s), the hero library's clips on the
  players (stick figures stand in), racquet gear items, the realistic register's depth (a flat forehand at the
  realistic speed carries past a close target, so the mind's lift sits on the cord's floor; depth there is spin and
  pace, which the mind does not yet modulate), volleyball and pong on the same sim, no bus emit; no split screen. The
  eyes gate is open: nobody has watched a rally yet.
- **Turn sports and the positional mind**, built as a course the World page plays, with a stopping point: the kernel's
  third shape, `turns` (seats played hot-seat in order, rounds each seat plays in turn, one shot at a time and the
  ball's rest the shot's end; `strokes`: the tee, the lie, a rest in the water or out of bounds a stroke from the last
  lie, the cup the round's end, the pick-up, the fewest strokes; `pins`: tenpin's frames, strikes and spares, the tenth
  frame's fill, its card with running totals; `lieOf` the region a point lies in; the kernel still calls every
  round); golf and bowling in the book (`sports.js`: three stadium holes as courses of regions with par and the ground's
  rolling resistance by the lie, the clubs by the lie and the distance left; the lane, the gutters, the pit, the ten
  pins on their spots, the hook), the drive, the iron and the roll as hit verbs, the bowling ball on the ball card;
  `contest/turn-sim.js` (the match sim's shape for one pad: the stick turns the aim about the line to the target across
  the sport's spread, a press runs the meter up and back (the action lab's hold-and-release) and its release strikes at
  the meter's share of the club's tip speed; the ball on the physics property's integrator in its register's air over
  the course's ground (the lie's resistance, the cup that takes a slow ball, the water and the out where it went in, the
  gutter to the pit, the pins as spheres that fall when moved from their spots, racked again as the kernel says);
  `probeShot`, a shot tried on a copy); the turn mind in `contest-mind.js` (it plans on the sim's own probe, never a
  guess: the meter bisected until the shot rests at the distance left, the aim bisected until the roll crosses the pin
  line at the pocket, the level's wobble on each); the positional mind there too (`fieldTarget`: a role presses the ball
  near it, stands goal-side of its mark, else holds its home region, always inside the kernel's legal shapes: the seed
  of the team game's teammates); `contest/turn-arena.js` and `turn-arena.client.js` with the `turns` channel (the
  arrows or WASD aim, Space or F charges, Enter again; the course from the kernel's regions, the flag, the pins, the
  aim line, the meter, the card, the camera behind the ball following the shot, the hosted wire), hooked up as the
  court is, the `turns` emit fixture pinned (`meet` and `court` re-pinned for the kernel's, the minds' and the hit's
  source), the e2e `turns-page.live.test.js`. Stopping point: the quick goal `turns` (the shell's level, as `meet`'s
  and `contest`'s), the hero library's clips on the golfer and the bowler (nobody is drawn yet: the ball, the aim and
  the card are the play), the golf ball's own aero constants (it flies on soccer's curves and the card says so), a pin
  that topples (a sphere sweeps instead), the oil pattern (the lane's friction is one number), curling and billiards on
  the same shape, no bus emit. The eyes gate is open: nobody has watched a hole or a frame yet.
- **The team goal game**, built as a pitch the World page plays, with a stopping point: the kernel's goal game
  gained its outs (`outs`: a throw-in for the other side where the ball crossed the touchline; over an end line a
  corner when the defenders touched it last, else a goal kick; without them a free) and offside against the ball
  (`offside: 'ball'`: a pass received by a teammate who stood past the ball's line in the other half when it was
  played, a `touch` fact carrying where the toucher stood at its side's last touch, is a free where it was received);
  soccer (five-a-side, two halves, throw-ins and corners, offside) and hockey (four-a-side on a rink with boards,
  three periods and overtime, no outs; the blue-line offside is not the ball rule and is left out, said so) in the
  book with the puck on the ball card; `contest/team-sim.js` (the match sim's shape for two pads in the screen's
  directions: each pad drives its side's player nearest the ball, a tap passes along the ground, a hold shoots, aimed
  by the stick; a player running at a slow ball carries it; the others hold their role's home and the nearest presses,
  the keeper across its line with a save on a ball coming at it; a goal between the posts under the bar the kernel's
  score, the ball over a line its out, a charge from behind into the carrier a foul, the clock ticking while live; a
  restart placed where the kernel says and taken by the first touch, or by the sim after three seconds); the team mind
  in `contest-mind.js` (the computer side's player at the ball chases, shoots in range, passes to the teammate
  furthest ahead, else carries on) over the positional mind's roles; `contest/team-arena.js`, `team-arena.client.js`
  and the `pitch` channel (WASD and F or Space, the arrows and the right Shift or the keypad 0; the lines, the boxes,
  the goals with nets or the rink's boards, the players as capsules in their side's colour with the one at the pad
  ringed, the scoreboard and the clock, the referee's banners, the hosted wire), hooked up as the court is, the
  `pitch` emit fixture pinned (`meet`, `court` and `turns` re-pinned for the kernel's, the minds' and the hit's
  source), the e2e `pitch-page.live.test.js`. Stopping point: the second local pilot in the controllable runtime (the
  plan's route to the hero body on the pitch) is not taken: the team game plays on the contest pages' own bodies, as
  the court and the course do, so no hero library clip kicks yet and the controllable pins stand untouched; the quick
  goal (phase 7); a tackle (the only challenge is the press and the keeper's save); the second-last-defender offside
  (the ball rule stands in); a wall at a free kick; restarts that walk the players home; the kick's curl one number.
  The eyes gate is open: nobody has watched a match yet.
- **The door and the distilled rulebook**, built: no new listed tool. Two quick goals (`design_game({ quick })`):
  `meet` (the event, the lanes, the players, the register, the distance, the attempts) and `contest` (the sport, the
  players or the seats, the register, the computer's level, the sets, the rounds, the periods and seconds), each read
  by its arena with its own refusals; a sport's quick game is one level, the arena as a stage carrying the play and a
  hosted level's contract (the page posts READY, takes INIT, posts the OUTCOME), and the game that plays it in the
  shell, with no hero, trail or camera of its own (`gameworld/quick.js` readSport and sportArenas, `runner.js`). The
  genres: a meet the athletics meet's, a contest its sport's shape (`intent.js` contestGenre), so the registry's
  probes read makeable and the four sport values (`power.mechanics` meet and contest, `space.levelForm` court,
  `mind.motivation` position, `soul.party` team) read built, each lowering to its module; the hillclimb page
  regenerated. The game vocab's quick cards for both goals; routing rows for a race, a tennis game, mini golf and
  five-a-side, the `game-design` card naming the sport goals. **A sport written out** (`sports.js` resolveSport): the
  contest goal's `sport` may be the book's name or an object `{ id, shape: match | turns | team, words, spec, omits?,
  …the shape's dials }`, the spec the contest kernel's own data (its read the gate), the dials the shape's sim reads
  (their presence checked, their values the sim's to refuse), `omits` the rulebook's sentences the primitives do not
  carry, by name; the three arenas resolve either, so a distilled rulebook plays on the court, the course or the pitch
  with no code change (pickleball and mini golf in the test). **The `distilled-rulebook` catalyst**
  (`lib/mcp/catalysts/distilled-rulebook.md`): the transcriber, not the referee: find the rules (the operator's
  words, a document, a search MCP), name the shape or say it is not one the sims play, distil the kernel's data field
  by field with the source's sentence beside each, distil the dials from the book's nearest sport, write `omits`,
  mint and read the kernel's calls off an exhibition; register is simplification by name, never a second kernel;
  the kernel's read is the gate and the agent never adjudicates. Stopping points: the engines' kernels carry no
  contest (every sport value is `absent` on Godot and Roblox, the page's own simulation); the shapes the sims lack
  (a hoop, a wicket, a wall game) are refused by name, not approximated.
- **The athletes: a sport played by characters**, built: the stick figures and capsules give way to characters made
  with create_character, each slot (a lane, a side's player, a seat) in its own body on the arena's page.
  - **The arenas carry their athletes** (`contest/athletes.js`): `athletes` on a `meet`, `court`, `turns` or `pitch` key is a
    character's ref per slot in the sim's order (null a slot's stick figure), cycled when shorter. The arena stores the
    refs, never the bodies: the World page packs each character's rig bones and rigid parts where it is served
    (`world-scene.js`, versus's `characterBody`), so a sport follows its characters' edits as a versus roster does. A
    ref the store has lost, or a rig the figure cannot stand up, is the stick figure; absent, nothing is added anywhere.
  - **The pose** (`contest/athlete-pose.js`, pure): the sports already pose a stick (the meet's stride, the court's
    swing); a character takes the stick's directions on its own lengths (the trunk turned rigidly onto the stick's,
    each limb laid along its stick bone, each foot turned with its shin), stands on its lowest sole and rises by the
    stick's air, and each bone rides its segment through versus's figure (`figureSegments`), so the chain closes
    everywhere. `strideStick` runs a body the sim keeps as a point and a velocity (the pitch's players, the stride on
    the ground they cover) and `swingStick` addresses a ball (golf's hands on the club, bowling's arm). The tests hold
    the concept on a small rig: lengths kept, directions followed, the sole on the ground, the right side on the right,
    the chain closed.
  - **On the page** (`contest/athlete.client.js`): one geometry per character shared by its slots, relit by the stage's
    key and inked as the versus arena draws a fighter. The meet's runners, the court's players (the racquet in the
    athlete's own hand), the pitch's players (the one at the pad still ringed) and the seat to play on the course (it
    stands to the ball, takes the club or the arm back with the meter, holds its finish while the ball runs; nobody was
    drawn there before). The channel inlines the figure only when the arena carries bodies, so a sport without athletes
    emits what it did; each probe counts its athletes, and `athletes-page.live.test.js` plays all four in a real browser.
    Corrected on the way: the meet's title read `[object Object]` when the track had none.
  - **The quick goals roll them** (`quick.athletes` on `meet` and `contest`, `runner.js`): absent, the athletes are
    rolled in the game's setting (`cast-setting.js`: the kit's tradition draws them anime or western, its era, the
    `meet` and `contest` genres leaning to athletic builds in their prime), a person a slot up to four and cycled; a
    team's sides each a rank of up to three faces in one uniform, the shirt the side's colour. They wear the sport's
    kit whatever the world's wardrobe (a new `athlete` quick figure): on the authored body the paint words on the bare
    body (a vest or a shirt, shorts, socks, white shoes), on the realistic body the `athlete` outfit card. Given, a list of
    `{ ref }` (a character the operator made, adopted as it stands) or hero-door specs (made by the run), cycled over the
    slots; `false` keeps the stick figures. The run's readout says what the setting rolled. Each athlete is a hero step
    (`athlete`, `athlete-2` …) that design_game makes and remakes as it does a guard.
  - **Not built, said:** the hero library's clips (the bodies are posed from the arena's own procedural stick, not the
    character's walk, sprint or swing clips), a kick, a header or a tackle on the pitch (the stride carries the ball),
    a racquet or a club as gear, the realistic body's outfit on the page's rigid parts (the card is chosen, not looked
    at). The eyes gate is open: the frames looked at were machine screenshots of exhibitions, not play.
- **Sport kits: the character designer's shortcut**, built: `kit` on the hero door (create_character, update_character,
  any hero-door spec), a sport's kit in a few words, lowered on every read into the dress the body already has
  (`lib/graph/sportswear/kits.js`, a card per sport and a row per pattern, no geometry anywhere).
  - **The words:** `kit: 'soccer'`, or `{ sport?, colours?: [main, second?, trim?], pattern?, trim?, socks? }`. The
    cards: soccer, keeper (long sleeves and gloves), hockey (long sleeves, pants to the knee, gloves), tennis (whites),
    track (a singlet), basketball (a vest and long shorts), volleyball, golf (a polo and trousers), bowling (a yoke).
    The patterns over the shirt in the second colour: plain, hoops, stripes, band, sleeves, yoke, sides. The trims in
    the third: collar, cuffs, hem, a stripe down the shorts. Socks to the knee, at the ankle, or none.
  - **How it lowers:** on the authored body, the bare body (`detail: 'swimsuit'`) with the card's paint words (a tee,
    a tank or long sleeves; bike shorts carried down the leg; the shoes with their collar cut low; gloves) and paint
    entries on the parts every core has, each pattern band painting only where the shirt is (`only: ['Top']`), so a
    scoop's skin and a sleeve's end hold. On the realistic body, the athlete's outfit card in the kit's colours. The
    kit's colours sit beneath the operator's palette and the operator's paint comes after the kit's; the record keeps
    the words alone (`kittedHero` in `layered.js`, applied where the plan is made and the body expanded), so patching
    `/hero/kit` re-dresses a character in place. A hero without a kit is unchanged to the byte.
  - **The athletes wear them:** a rolled athlete is dressed in its sport's kit (a meet's the track's, a book sport's
    its own, one written out its shape's), the roll's own shirt colour its kit's main, so a field of runners is a field
    of colours; tennis keeps its whites and takes the player's colour as the trim. A team's sides each wear one kit in
    the side's colours, and a keeper (the role named so) a kit of its own: the soccer keeper's, or the sport's in a
    keeper's colour. `quick.kits` (a kit's words each, cycled over the sides or the athletes) chooses the colours and
    the patterns; the quick cards name it.
  - **Held:** the words read and refused by name; the card's defaults; the lowering by role; the operator's own words
    over the kit's; one pattern per procedure painted on the anime body and the streamlined core; the rolled athletes'
    kits, the keepers, the whites, the kits' words. Looked at in machine screenshots (eight kits on two heads, a derby
    in hoops against stripes, a court in whites); the eyes gate is open.
  - **Not built, said:** numbers and names on the back (a decal, not a band), halves and sashes (the paint's window is
    up the trunk and around it, symmetric), a pattern on the realistic body's garments (the outfit card takes the colours
    only), helmets and pads.
- **The holo lift: a board game in a hologram arena**, built for the games of moves, with a stopping point. Battle
  city run back to the tabletop: Duelist Kingdom's way of showing a simple game, the duelists on podiums at either
  end and the board projected between them, every piece a hologram and every event of the game staged. The lift is
  optional and depiction only: the tabletop kernel stays the referee, and the same game still plays as its own page.
  - **The arena** (`tabletop/holo-arena.js`): `readHolo` (the tabletop manifest's game, a book game or one written
    out, the seat player 1 holds, players 0 an exhibition, 1 against the computer or 2 hot-seat, the computer's
    level, the seed, the stage kit), `holoBoard` (the lattice at a cell sized to the arena, floating over the floor,
    a podium behind each side), `holoManifest` (the venue as a stage recipe carrying the `holo` key, a camera behind
    player 1's podium) and `holoArenaData` (the game dealt, each kind's body resolved from the meeple shelf, its value,
    the duelists and their lights, the level wire). A euro, tile, card or round game is refused by name: it plays on
    its own page.
  - **The page** (`holo-arena.client.js`, `scene/channels/holo.js`): one block inlining the kernel and the mind from
    their closures and the client. A projector disc with lit rings and beams, the board as panes of light with lit
    edges and a scan sweeping across, each duelist's podium in its colour (the side to move brighter). Each piece is a
    hologram of its body (a cut-out, a turned profile, a box, a group as real geometry): a translucent body lit at its
    rim with scan lines, its edges in light, a glow under it. What the kernel says is staged as BEATS, played one after
    another while the state is already ahead: the opening summon (the army out of beams of light, about two seconds), an
    attack (the attacker turns and a beam crosses to its victim), a destroy (the victim shatters into light), a move
    (a glide, a leap higher, a castling partner beside it), a promotion (a pillar of light, the piece remade), a flip
    (a convert), CHECK and the end on the banners. LIFE POINTS on the overlay fall with the destroy beat by the piece's
    share of the army; mate takes the loser's to zero. The camera stands behind the person's podium, swings to whoever
    is to move in hot-seat, sways in an exhibition and leans toward each beat. Click a piece, then a lit cell (a
    capture red); a promotion or a drop with a choice asks which. The hosted wire as the sports' (READY, INIT,
    OUTCOME). The probe (`__mojHolo`) runs plies at once, names the beat on stage and the beats seen, and clicks a
    cell as the pointer would.
  - **The door** (`design_game({ quick: { goal: 'tabletop', game, players?, level?, human?, lift: 'holo' } })`): one
    level, the arena in the play shell, its quick card, a line on the tabletop card, the registry's lattice note.
  - **Held:** the minds' duel in the page is Node's move for move (checkers and chess, `holo-page.live.test.js`); a
    capture stages attack, destroy, move in that order; a person's seat waits for them and two clicks play a move; a
    page without the key emits no block (the `holo` emit fixture pinned, every other page byte-identical).
  - **Not built, said:** the euro, tile, card and round families (the dice as a shaker reveal and the card duel with
    summons, spells and responses, the tabletop kernel's own Duel Monsters shape, are the next lifts), characters as
    pieces (the athletes' bodies on the board), sound. The eyes gate is open: the frames looked at were machine
    screenshots of exhibitions and one scripted move, not play.

### Chatbot sweep: what the chatbot factory left behind

- The chatbot factory left in 3.0.0. Its leftovers go:
  - The "nothing came back" guards: a server boot in a child process, and nine absence checks.
  - The 2.x upgrade shims, the moved notice above all. A removed bot tool or pack name is now an unknown tool,
    `mojulo install chatbot` an unknown pack (exit 1), and a `chatbot` token in `MOJULO_PACKS` is skipped as any unknown
    token is. `recommend_catalysts`' deployed-bot arguments, the `artifact_materialization` commit type and the `bot`
    worked example fall to their tools' ordinary refusals, and a catalyst's `requires.protocols` is no longer read.
  - The bot runtime's LLM helpers nothing called: the vision and per-model protocol gates and `generateSummary`
    (`lib/llm-providers.js` keeps the provider table, the model tiers and `generateStructured`).
  - The server instructions and `get_substrate` no longer carry the chatbot paragraph, and code and tests no longer tell
    the factory's history in their comments.
- Kept:
  - The retired-shelf prune of the semantic index, which drops any routing card or catalyst a release deletes.
  - A 2.x install's data stays readable: its documents, its stash bindings to a bot, its meta-context bot rows.

### Test tiers: the tests a change reaches, the whole suite in CI

- **`npm run test:changed`** runs the tests a change needs, picked off the import graph of control's own sources
  (`scripts/test-graph.mjs`, read statically in under half a second). It runs:
  - the test files that import a changed module (one hop; `--depth 2` adds its importers' tests, a branch's check
    before a merge), and a changed test itself;
  - every byte pin (`*.char` / `*.trace`) the change reaches at any depth;
  - its deep sweeps under the deep config.

  A source a module reads as text (inlined into a page, scanned for its keys) counts as a change to that reader. A
  changed data file runs the tests beside it, and a changed config runs the critical tier. Prose runs nothing. The
  e2e suites the change reaches are named, not run. `--since <ref>` adds a branch's commits, `--depth` reaches
  further, `--files` replays a change, `--list` shows the pick. A guard test fails when a module starts reading files
  beside it without being declared a reader of code or of data, so a hidden dependency cannot slip past the graph.
- **CI runs the whole suite, sharded**, three ways on each leg of the matrix, the e2e tier two ways, and the deep
  sweeps and the book once a leg. It runs on pull requests, on pushes to `main` and the release-candidate branches
  (`*-consolidated`), and on demand.
- `test:changed` runs every tier it picked even when an earlier one fails.
- The e2e job gives its test workers a 6 GB heap. `design-game.quick.test.js` was the worker that died on the macOS
  legs, out of V8's default heap; it ran there until the e2e tier moved to its own job.
- A stage's ends memo (`stageEnds`, `gameworld/levels.js`) no longer keeps each stage's whole face list: its height
  lookups keep the matching faces' corners only, about 8 MB a stage where it was about 29 MB. It keeps the last 16
  stages, the oldest dropped first, where it kept up to 64 and then cleared. A long-running server that made many
  games could hold gigabytes in it. Output is unchanged.

### Weapon swing styling: a swing drawn in the game's look, timed by its game type, fed to each action game

- **Mojulo Fighter hosts kinds of fighting game.** A versus game's rules may name a `kind` (`versus-kinds.js`): street
  (Street Fighter), anime-air (Guilty Gear), iron (Tekken), tag (Dragon Ball FighterZ) or platform (Smash). Each is
  data: its systems and dials under the game's own (the game's systems are added, a dial it sets wins), its input
  grammar, how its combos are built, its plane, and the look and game type its effects are drawn in. What versus does
  not run yet of each kind is said (`kindReport(kind).lacks`), never dropped. Four new versus systems, each off
  unless switched on (anime-air switches on all four):
  - `gatling`: a connected normal, on hit or block, cancels into a stronger one of its stance (L → M → H; air into air).
  - `airdash`: forward or back twice in the air flies level for `airDashDist` over `airDashFrames`.
  - `airjump`: up again, a fresh press, jumps again at `airJumpVy` % of the ground jump.
  - `reset`: the Roman cancel. L + M + H together during a move spends `resetCost` of meter and ends the move at once:
    on the ground the fighter stands, in the air it floats free; the page flashes RESET in the fighter's colour.
- **Iron, the Tekken-like kind.** It switches on four more versus systems:
  - `limbs`: four buttons, a limb each (L the lead hand, M the rear hand, H the lead leg, S the rear leg). Every
    player plays the limbs scheme, and each limb has its own normal at each ground stance: the recipe's `limbs`, else
    the first family of its tradition that strikes with that limb (jab, straight, front kick, roundhouse, and the
    crouching four).
  - `strings`: a fighter's strings, each press of the next following on in order, on hit, block or whiff, up to ten.
    Defaults over the limbs: 1,2; 1,2,4; 1,1,2; 3,4; and a ten-hit string.
  - `bound`: normals juggle a falling body, and a heavy blow on one slams it so it bounds back up, once a combo.
  - `sidestep`: a tap of up steps aside. Strikes and shots pass through for `sidestepInvuln` frames; a throw still
    catches. In 2D it is a dodge; tracking moves and circling are listed as lacks.

  A game's page fills in the limbs and strings a fighter's recipe lacks when its rules need them (`kindRecipe`).

  The air dash and the air jump share `airActions` per jump. Kombat is left out for now. An armed fighter's swing
  leaves a trail on the versus page in its kind's look, in the fighter's colour: flat hard bands held on twos (cel:
  anime-air, tag), an added glow with a white cutting edge (isekai: platform), or a faint short sheen (material: street,
  iron). A game without a kind draws none.
- **The held strike.** A gameworld hero who holds a blade or a staff in its right hand now swings it when the game's feel
  carries a string (the rule's contact window), where before it had no melee at all. A platform body playing the hero
  whose rule has a contact window and no strike of its own is armed with what it holds:
  - The runtime's five swing directions are the hero's own swing verbs: neutral its own word (else the chop), forward
    the thrust, back the cleave (the runtime's topple), and the rising diagonal to either side.
  - Each verb plays at the item's class, fitted so the strike lands as the window opens, at the world's game type when
    it names one, and knows its blow (`move` with its tip).
  - The rule takes the item's reach and the class's swing seconds and damage (any the rule names stand).

  A hero holding nothing, or a rule with no window, is as before (`hero-swing.js` HELD_SWINGS, `fitSwing`,
  `swingClipKeys`).
- **Hitstop, live.** A gameworld feel whose template freezes on a blow (`hit.hitstop`: frames at 60 fps, `base` plus
  `perMs` for each unit of the blow's shove, at most `max`) now carries it onto the hero's strike. Before, the readout
  listed it as not carried. A melee connect freezes the striker and the struck for those frames: no timer, rule,
  reaction or clip advances, then both play on. The blow's own frame plays out for both bodies, so both hold the same
  frames whichever comes first in the step. It is an opt-in runtime builder (`hitstop.js`, composed only into a page
  whose world has a body with a hitstop), so every other page keeps every byte. Godot and Roblox name it as not carried.
- **The blow flashes.** Under a composed juice floor, a melee connect throws a short flash at the contact in its spark
  colour. It lights the world (with the effect light), and the struck body's rim field flashes with it.
- **A swing knows its blow.** A hero's swing clip carries its contact data when packed (`move` on the clip, the GLB's
  `moj:move`): its word, hand and class, the impact's phase and the contact window as shares of the clip, its game type
  when timed, and the blade's tip (the item's point at rest on the hand's bone, which carries it rigidly), so an engine's
  hit test or trail can put a locator there. The tip, ridden by the packed hand frames, stays within a millimetre of the
  posed blade point at every frame. The phases a swing reports (`swingKeys`, the hero readout's `gear.<hand>.swing`) now
  fall where the player puts its keys: a normal swing strikes at 0.5, a light at 0.4, a heavy at 0.571. They used to read
  about 7 % of the cycle early.
- **The default swing, timed by its game type.** A hero's swing word (chop, thrust, cleave …) plays in a world at that
  world's game type: a composed floor's flavor (`fxStyle`, a gameworld's `juice`) re-times the swing's own keys when the
  World packs the hero (`hero-swing.js` `swingTiming`). Each role of the swing (the wind-up, the strike, the
  follow-through, the recovery) is scaled; an action game holds a heavy weapon's cock before the strike cracks, and a
  platformer's swing is short throughout. The strike and its contact window are re-read on the new timeline. The poses are
  the swing's own, and the rig's ease runs within each key. Realistic, the plain floor, or no floor leaves the pack as it
  was. The proving ground's swing takes play at their cell's game type.
- **The swing trail.** A composed floor (`fxStyle`, a gameworld's `juice`) draws a weapon's swing as its look draws
  it: isekai a bright glow ribbon shedding glints, cel flat hard-banded smear sheets held on twos, material a short faint
  sheen; the game type sets how long it lingers and how fast the blade must move to leave one. The page samples each
  hand's blade tip (the farthest point of what the hand holds) every frame and draws the swept blade. Its colour is a
  source: the weapon's element, the hero's power colour, the world's palette, a colour, or a function a caller passes
  (`resolveTrailColor`), by default the element, else the power colour, else the palette's accent. A gameworld's
  juice reads them off the game (`trailContext`: the hero's first power's element, else the direction's leading
  element; the character palette's first colour; the world palette's accent), its `trailColor` word or a source passed
  to `juiceOfGame(G, { trailColor })` choosing among them. The proving ground's `swing` and `swing-greatsword` takes
  (with `--rig`) loop a sword hero's swing in place.

### Juice styling: the effects drawn in the game's register, timed by its game type

- **The effects' floor is a composition.** `fxStyle: { register, look?, flavor, …dials }` composes the floor every beam,
  explosion and puff is raised to from two halves. The REGISTER is the art direction, anime or western, and sets
  the look. Anime is the contemporary anime game's (the gacha action RPG's effects): no ink line, a white-hot core
  into saturated ribbons in a near hue, soft trails, glints for sparks, a halo ring where a blow lands and glints
  drifting up after it, and smoke kept short and tinted toward the effect's own colour. Western is material: no ink
  line (an attack's own black edge becomes its glow), one colour, motion blur, streaks and chips, grey smoke that
  lingers and more light thrown on the world. The FLAVOR is the game type's animation (the animation selector's
  four: realistic, action, platformer, pinball) and sets the time: playback rate, anticipation, squash and stretch,
  arcs, echoes, the shake and the impact's flash, and a slight change of shape (round sparks and motes in a
  platformer, streaks at speed). Dials (JUICE_DIALS) pin any one number over both: among them `fps`, which holds an
  effect on its drawings (the page draws that only when an effect carries it), and `comic`, the manga ink burst.
  What stays global holds in every cell: an attack lands on its target (its landing re-read), a line stays a line,
  a laser one beam, a warm bolt burns and a pale ray crackles. A composed floor also styles the preset puffs it can,
  a beam's preset impact, the camera's shakes and a party battle's juice (its attacks, its holds and flashes at the
  game type's pace). `fxStyle: true` is the floor as it was, byte for byte.
- **Full anime, cel-shaded: a second anime look.** A register is drawn in one of its looks (`look`): anime's
  `isekai` (the contemporary anime RPG's, its default) or `cel` (full anime, the anime fighter's: the isekai look's
  high-res colour drawn in hard painterly shapes), western's `material`. Cel lays flat colour in hard bands round a
  hard white core across every strand, with companions in an accent hue, smears its afterimages, draws its sparks as
  speed lines, throws dark debris specks and a swirl ring from the blow, draws a blast's fire as spirit onions (below)
  and its smoke as a few bold flat puffs tinted its colour, glows as hard three-band discs, has no outline and no grey,
  and holds on twos. The page emits its bands and its cel glyphs only where a cel effect is. A gameworld's anime
  fighter or brawler is drawn cel unless it names a look.
- **Spirit onions: the form of a power-up.** `playscape/elements/aura.js`: overlapping onion shells round a centre,
  each a ring of flat cel petals along an onion's profile (a round bulb rising to a point), each spinning its own way
  at its own rate, and rings of spikes round them turning at their own intervals; each petal is shaded flat by how it
  faces the eye. A look wears one as its `aura` layer (the `power-up` look: a fast gold rim, the aura, sparks rising),
  and the cel look draws a blast's fire as one (the `burst` aura, sized to the fire, blooming and fading as it burns)
  in place of a spray. The page draws an aura only where a look or a blast carries one.
- **The characters' rim light: an effect expressed on the bodies it plays among.** `scene/effect-rim.js`: a composed
  floor gives every character a FIELD, a smooth shell a little off its body (its faces' corners welded where they meet
  and their normals averaged, so it is smooth over the whole model whatever its faces are; pushed out by the look's
  gap), its back faces only and kept off the body by the stencil the body marks, so it is one field round the whole
  silhouette, never an outline round each piece. It is drawn purely by its fresnel, in the colour of the effects round
  it (a beam's head going by, a charge at the hand, a blast beside it), falling off with distance. The look decides how
  (isekai a soft halo with a small gap, cel a hard band with the widest, material a hairline) and the game type how
  strongly (action strongest, realistic least); a status's coat takes the look's rim too (a cel band on a cel look). The
  `rim` dial sets it (0: none). It reads the effect light's lights of the frame, gathering them even where the world is
  not lit by them (`fxLight` off), follows the bodies only while a light is live, and exposes the characters' bodies only
  where it is on. The proving ground's `--rig` stands the caster and target up as live characters and
  `--close caster|target` frames one.
- **A gameworld's `juice`.** `juice: 'auto' | false | { register?, look?, flavor?, …dials }` lays the composed floor on
  every level as `fxStyle`. The register comes from the game's tradition: the character book's direction, else the
  kit's pole as the colour theorist leaves it. The game type comes from the feel's template, else the genre's. A
  composed world writes `'auto'`; design_game's readout reports the floor a world lays, or suggests one (a `juice`
  step) for a world that writes none. A world without the word is drawn as it always was. The drawer card is
  `gameworld-juice`.
- **The juice board.** The effects proving ground takes `--juice <register>:<flavor>` and `--board` (every cell of an
  effect, side by side); `juice-sheet.mjs` steps each cell in headless Chrome into a contact sheet. These are the eyes
  gate's material, not its verdict.

### Game feel: the lab's templates in the game loop

- **A gameworld's `feel`.** A game names one of the action lab's templates (`feel: { pole, variant?, toward?, t?, set? }`)
  and its hero moves by that template's card: the run, the ground's acceleration, the jump's height and its gravity
  up and down, coyote time and the jump buffer, the shortest hop, air control, the jump's gather, air jumps, the 2D
  lane. The card is lowered into the platform rule the runtime already plays, laid over the hero's own; what the
  runtime does not carry yet (hitstop, the parry, the hold-release charge, offense armor, a roll's invincible frames,
  the runner) is said in the game's readout, never dropped silently. The cards and templates moved from the lab into
  `lib/graph/gameworld/feel/`, so the card a game is made from is the one the lab plays and holds to its laws.
- **The feel book: sample a made game's controls.** A world that writes a feel has a third book beside its world
  and character bibles (`/api/sketches/<ref>/bible?book=feel`, a `feel` exit on its project page): the action lab's
  stick view locked to the game's own card, on its template's stage and viewer, to run, jump and strike as the game
  will. Each template shows only what it is about (its `demo`: Galaxy Boy the run, the jump, the wall kick, the dash
  and the buster; the runner its lanes, the jump, the roll and the boost): those keys, buttons, dials, readouts and
  strip colours, and only their buttons answer; no prose, the demo speaks for itself (the dials try changes on the
  page only). The gameworld bible names the feel and links to it. The stick view's kernel, page, takes and the hero library's flavors moved
  from the spikes into `lib/graph/gameworld/feel/` (the lab and the animation spike re-export them), and the takes bake
  only the game's base feel on one body, once per process.
- **Genre defaults, suggested and written.** A world that writes no feel is suggested one in `design_game`'s readout
  (a `feel` step with its reason): from the brief's words ("souls-like", "mega man", "endless runner"), from a
  deathmatch's shooter pole, or from its genre (a collectathon plays Jumping Giuseppe, a metroidvania Galaxy Boy, an
  arena shooter Infinity Crisis, a brawler Fallen Angel; a genre off its feet suggests none). A world composed from a
  prompt that names a template has it written. Nothing is laid behind the recipe's back: a world plays the feel it
  writes, so games already made move as they did. The shooter pole is one dial with the feel (Conscription toward
  Infinity Crisis), and a written feel wins over a quick game's own feet. Each genre's card names its feel.

### Action game unification: one feel for the button, the body and the clip

- **A lab, nothing registered** (`scripts/spikes/action-lab/`). The animation-games spike retimed a take on its own
  clock; a game runs on the player's. Measured on the spike's registers, the press waits for the clip: the action
  register's jab is its slowest (14 frames to contact against realistic's 11) and every register's jump waits 10 to
  30 frames for the clip's gather. The lab makes the press the beat. A *feel* card (realistic, action, platformer,
  pinball) says what each button does: ground acceleration and turning; the jump's commit, buffer, coyote time, cut,
  rise and fall gravity and hang; a dodge with invincible frames; a three-move string with startup, active,
  recovery, cancel and buffer; hitstop on both bodies; hitstun by its source; knockback by the force model; what a
  wall does. One pure step function plays the card at 60 Hz in node and in the page, over a *body* (the character's
  reach, real blow and strides), so the same card on the female cast reaches shorter. The hero library's clips are
  fitted to the frames it decides, so the fist meets its contact point on the card's startup frame, and realistic's
  card is the take's own time. `verify.mjs` is the machine gate over scripted pads. It holds on both casts: buffer
  and coyote windows to the frame, apex to the millimetre, hitstop on both bodies, a chained hit's advantage equal to
  the printed frame data, invincible frames, no body through a wall at 20 m/s, every press acted on or dropped with
  its reason, byte-identical traces. `lab.mjs` writes a playable page (keyboard, gamepad, touch) with the feel
  switch, the dials, a frame bar, the event log, frame data and a recorder whose runs become fixtures. The eyes gate
  is open.
- **Jumping on a body, in the lab** (the card's `land`). Bodies no longer pass into each other. Realistic and action
  slide off a body's top into open space; action adds the enemy step (a jump pressed in the air touching a body is a
  fresh jump). Platformer stomps (the body squashed and stunned, the bounce 0.6 m or 1.81 m with the jump held), and
  pinball's spinning body bounces off like a bumper while the body ricochets. A short critter (0.8 m) gives every
  feel something to land on. The gate holds 79 laws on both casts, with a recorded stomp among its fixtures.
- **Game templates in the lab: the poles, each in its own viewer.** Eleven templates, the sane defaults a game starts
  from and the poles its movement is tuned between: Fallen Angel (DMC), Ebon Spirits (GoW, Souls), Cogs of Combat
  (Gears), Infinity Crisis (arena and hero shooters), Conscription (the contemporary FPS), Steel Serpents (Metal Gear),
  Vigilante Justice (superhero games), Mech Battle Kai (mobile-suit-arena), Jumping Giuseppe (the mascot platformer),
  Isekai Party (the RPG) and Mojulo Fighter (the 2D fighter: mojulo's versus loop). Each is a base feel
  with its movement and animation fields, a viewer, a stage and the primitives it still needs; any two blend. The page
  opens each in its own viewer, after mojulo's gameworld cameras: third person, over the shoulder, first person (an arm
  that bobs, dips, reaches and kicks, and a crosshair), the mech's chase, isometric, overhead and side, alongside the ¾
  follow. A lane rule holds the 2D games to their plane, the fighter facing its foe. The gate holds 326 laws on both
  casts.
- **Mojulo Fighter is mojulo's versus loop, in the lab.** The template no longer approximates a fighter with a lab
  card on a lane: the page inlines versus (its pure modules and runtime) and steps a real match, you as P1 on the
  lab's keys (J K L light, medium, heavy, U the special, Q or I the throw, as versus's own page), the CPU or versus's
  training dummy as P2, your fighter, the opponent, the control scheme and your super picked in the header. The lab's
  tools read it from outside: every press acted (the move, the frames it waited) or dropped with the state it met,
  the clock stopped through hitstop as versus keeps a press made then; the frame strip, the frame-data card and
  versus's boxes. The bodies are the lab's sticks on versus's rig, side or ¾. Blended toward another template it
  becomes a lab card made from Kata's own numbers (held equal to `compileFighter`), which leaves the floor, peaks and
  lands its light on versus's frames. `stepMatch` takes the pads a host read itself (`versus-runtime.client.js`).
- **Two more templates in the lab: Galaxy Boy and Commuter Rail Runner.** Galaxy Boy (Mega Man X) is the platformer's
  X movement with a run-and-gun's buster: the attack's tap is a small shot from anything but a hurt, a few out at
  most, and the same press charges. Commuter Rail Runner is the infinite runner on pinball's body, a new `runner`
  rule: the track comes at the hero faster and faster, seeded rows of barriers to jump, overheads to roll under,
  trains to dodge and coins to gather, a stumble and then the end; its variants are the rails (three lanes) and the
  slope (the ball steering free), and any template may now carry variants. The runner draws as a scrolling track to
  the horizon behind the hero.
- **Supers that lock, in versus** (`lib/graph/versus`: a super's `lock`). The first blow that lands catches; the rest
  is a script: a blow every few frames, each its share of the super's damage scaled once by the combo it caught, both
  bodies untouchable and unthrowable, then the finish, a knockdown or a launch. Two kinds: the **hit-combo super**
  plays in the fight with the clock running, the **cutscene super** stops the clock while the page cuts away (closer
  in, darkened and letterboxed). Blocked it is one blocked blow; whiffed, a whiff. Versus's shelf ships one of each
  (`super-chain`, `super-cutscene`), any fighter takes one by `super`, and a recipe's own super takes a `lock`. A caught
  body replays the impact on each blow (`versus-react.js`). Fighters without one fight as before.
- **The heavy-robot rules and the mech, in the lab.** mobile-suit-arena's movement (mojulo's controllable rules) split
  into rules that overlap, each a card field any feel may carry alone: the boost (an instant held thrust on a gauge
  that overheat-locks, its jump and turn costs, an inertia skid), the hover cushion under it, Armored Core's quick
  boost, the stop-and-charge jump, a heavy gait that dips at each footfall, landings that lag by the fall, a grown
  body. The mech is one composition of them laid over any card as a mount (its combat kept, its movement the
  mech's), so it is its own game or a thing to ride in another; one weight knob blends MSA's heavy suit into a swift
  Armored Core frame, and the glider and jetpack ride along. The page draws it heavy (thick limbs, a boxed head,
  footfall shake, a lean and a flame on the boost) with a boost gauge. The gate holds 322 laws on both casts, with
  recorded heavy and swift runs among its fixtures.
- **The loadout, in the lab: mobile-suit-arena's weapons** (the card's `loadout`). Lifted from mobile-suit-arena,
  whose weapons are mojulo's controllable rules, with their field names and meanings: the switch's ready time
  (re-armed each switch, a slot's own winning), the cooldown (auto at a rate of fire, semi with a committed burst), a
  magazine or an energy pool that overheat-locks, a charge shot, the auto-reload that runs for stowed weapons too, and
  the sight, area (assist ring) and lob (gravity, splash, proximity fuze, arm time, fuse) classes. Shooting no longer
  ends a jetpack flight. Realistic carries MSA's machine gun, long rifle and grenade, action a mobile suit's beam rifle,
  hyper bazooka, head vulcan and V78 energy rifle, the platformer a buster and a special weapon; pinball none. What
  would rework the lab rather than add to it stays out (the targeting cones, spread and recoil, damage and poise, melee
  slots). The gate holds 297 laws on both casts, with recorded runs of a switch and a jetpack gun run.
- **The glider and the jetpack, in the lab** (the card's `glide` and `jet`, chosen as gear). Either takes the jump in
  the air once the air jumps are spent, held past the apex or pressed. Realistic's glider is a paraglider opened from
  a height with a stamina limit and its jetpack a slow thrust on a small tank; action glides and hovers; the
  platformer floats for a second and its jetpack is a strong short burst; pinball glides from a slow start into a wall
  grab and flies by flapping until it tires. A hit, a move, a dash or a wall ends a flight; with no gear nothing
  changes. The gate holds 269 laws on both casts, with a recorded glide, jetpack burn and flight among its fixtures.
- **Ranged attacks, in the lab: the enemy's patterns by genre, what a hit does, maneuver armor.** The dummy turns
  shooter and fires its genre's patterns after a telegraph: realistic's are the FPS's, hitscan (a rifle burst whose
  aim trails the target by a reaction, a marksman whose aim locks before the shot), denied by cover or by moving
  across the aim rather than dodged; action's arena fires orbs, fans, a low ring and homing shots, its brawler set a
  low knife and a gun that knocks down; the platformer's and pinball's shots are slow (spreads, aimed shots, a lob
  that bursts, a weaving shot, a bouncing ball). What a hit does is the card's: realistic flinches (control kept, the
  run slowed), the others are knocked back and stunned, then invincible for a mercy (none in the FPS), out of the
  charge or not as the card says. A hit takes life: health, or pinball's rings (all scattered, the next hit the end),
  or one-hit; out of life the body is down, then up again. Maneuver armor cuts a hit's stun and knock while the body
  moves in the card's ways: action's dash and sprint shrug the stun off, the platformer's dash halves it, pinball at
  speed keeps going. The gate holds 247 laws on both casts, with recorded runs of a rifle burst and a marksman's miss,
  a perfect-dodged orb and a shot passing through the mercy among its fixtures.
- **Offense armor, in the lab: what it takes to interrupt an attack.** Every hit is tagged (light or heavy, and its
  kind: shot, stomp, launcher) and every attack may carry armor through its startup and active frames: none (any hit
  interrupts it), interrupted only by hits with certain tags (heavy attacks only, or a trigger such as a shot), by its
  nth hit (poise), or hyper armor (nothing interrupts it). A hit the armor holds against clanks: no stun, no push, the
  attack goes on. The dummy's jab stops at any hit, its hook only at a heavy or a shot, its perilous blow never;
  realistic's charged haymaker shrugs off one light hit, action's heavy every light one, its launcher everything. The
  page draws a halo on an armored body and the frame data gains an armor column. The gate holds 212 laws on both
  casts, with a recorded run of the dummy's three attacks among its fixtures.
- **Hold and release, in the lab: the charge** (the card's `charge`; every feel). The attack's press still acts at
  once, so the tap is never delayed; holding on charges it, and the release fires the charged attack on its own frame
  at the level the hold reached (a release short of the first level fizzles). Realistic and action charge a heavy in a
  slow stance (action's second level a launcher), the platformer charges Mega Man X's buster and fires a shot from
  anywhere while it runs and jumps, and pinball revs Sonic's spin dash, aimed by the stick. A hit taken loses the
  charge. The heavy's rows join the frame data. The gate holds 198 laws on both casts, with a recorded launcher and a
  recorded full-charge shot among its fixtures.
- **Guard and parry, in the lab: the attack's arc and its zones** (the card's `guard`; realistic and action). A held
  guard blocks a hit from the front, with a blockstun and a push back. Every enemy attack swings across an arc drawn
  on the floor through its telegraph, red with an orange segment: a hit met in orange by a guard pressed in time is
  parried (the attacker staggers open for a riposte), met in red it is only blocked, and some attacks are all orange
  or all red and unblockable (dodge those). The sparring dummy cycles a jab, a sweeping hook and a perilous blow.
  Realistic's guard spends stamina and breaks when it runs out; action's perfect dodge slows the attacker to half
  speed. The gate holds 171 laws on both casts, with a recorded parry and riposte among its fixtures.
- **Lock-on, in the lab** (the card's `lock`; realistic and action). A lock button takes the dummy as the target in
  range and lets it go on the next press or when it walks out of range. Locked, the body faces the target, the stick
  strafes, attacks go at it, and the rolls circle it: a side roll arcs round the target at its distance, forward
  closes, back opens. The page's camera swings behind the hero to the target and reads the stick against it. The gate
  holds 151 laws on both casts.
- **Two getaways, in the lab: the directional roll and the dash.** The dodge button is now a directional roll: it
  goes the way the stick points while the body keeps its facing (a roll forward, to either side, or a hop back, each
  its own clip), and with the stick at rest it is a shorter backstep. A new dash button carries the dash and all of
  Mega Man X's moves; action gains a quick ground dash, and realistic, which steps rather than rolls, has none. No
  feel rolls in the air. The gate holds 139 laws on both casts.
- **The dashes, in the lab** (Mega Man X; the card's `dodge`). On the three non-realistic feels: an air dash with
  gravity off, once an airtime (landing and walls give it back); the dash jump, a jump inside a ground dodge that
  leaves on the press and keeps the dodge's speed through the air; and the dash wall jump, which kicks at the dash's
  speed and keeps it. The platformer's dash is X's, lasting while the button is held. The gate holds 127 laws on both
  casts.
- **The air jump and the wall, in the lab** (Mega Man X; the card's `air` and `cling`). On the three non-realistic
  feels, a jump in the air is an air jump while one is left, and falling against a wall with the stick into it slides
  down it at a constant speed. A jump on the wall kicks off it up and away, the stick locked out for the kick's frames,
  and the wall's coyote time keeps the kick a few frames after leaving. Holding back toward the wall, action and
  platformer climb one wall kick by kick; pinball cannot, its kick outrunning its air control. Landing and walls give
  the air jumps back, and the arena gains a tower to climb. The gate holds 112 laws on both casts.
- **The stomp attack, in the lab** (the card's `pound`): an attack in the air turned downward, dropped in a straight
  line. Action's plunge (back + attack) launches a body it lands on or hits one beside it with a shockwave, then lags.
  Platformer's ground pound flips in place, drops, stomps harder and always bounces high, and a jump in its lag is the
  higher ground-pound jump. Pinball's bounce attack rebounds off the floor or a body. Realistic has none. The gate
  holds 92 laws on both casts. The page's spin poses (the flip, pinball's spin jump) drew nothing until now: they
  turned about a joint the drawing does not carry.
- **Ground acceleration in the platform rule** (`rules-platform.js`, opt-in `accel` and `decel`). The first of the
  lab's pieces in the live rules. The body carries a planar drive that builds toward the stick at `accel` and sheds
  at `decel` (default `accel`). In the air both rates scale by `airControl`, and an unpushed body keeps its drive, so
  momentum carries through a jump. A root (charge, kneel, swing, dodge, tackle) stops it at once. A boost sets it to
  the dash, so letting go of F sheds the dash; with `boostInertia` the skid owns the release instead. A wall takes the
  part of the drive that went into it and the body slides on, a lane keeps it on its tangent, and a body a reaction
  owns stops driving (the `drive-stop` suppressed tick). Absent `accel`, the direct step runs byte for byte: the
  controllable trace pins hold, and the 14 controllable pages' emission pins move only by the rule's own source. The
  Godot kernel runs it too (`rules.gd`, held by a new `platform-accel` conformance scenario); Roblox leaves it to the
  Humanoid's own feel. The `controllable` vocab card names it.

### Trademark policy

- **`TRADEMARKS.md`** says how the mojulo name may be used: fork freely under your own name; "powered by
  mojulo" as a description, never in a product, package, domain or handle. The README, `NOTICE` (shipped in the
  package), `TERMS.md` and `CONTRIBUTING.md` point to it. The code stays Apache 2.0.

### Animation games spike: one take, four flavors

- **A research spike, nothing registered** (`scripts/spikes/animation-games/`). A *flavor* renders a take the hero
  library already solves (a strike, a jump, a reaction) for the kind of game it plays in. It keeps the take's poses and
  changes its timing, how far it winds up and follows through, its holds, squash and smears, and the force a blow hands
  on (the *powerscale*: the victim's change of speed against a body on earth's). The four flavors are `realistic`
  (the take as solved, a blow's real momentum), `action` (a deep wind-up, a snap, both bodies frozen for a hitstop that
  grows with the blow, the victim thrown), `platformer` (quick starts, squash and stretch at take-off and landing, a blow
  is a boop) and `pinball` (the take plays faster the faster the body travels, smeared, a hit ricochets). Every cosmos
  genre picks one, and the operator's word overrides it. `verify.mjs` is the machine gate. Contact lands on its point in
  every flavor, realistic is the take frame for frame, and renders are byte-identical. `preview.mjs` writes a
  side-by-side player and filmstrips for the eyes gate, which is still open. The README's findings name the integration
  costs: the 12-key linear packing smears holds and snaps, and hitstop, knockback and rate by speed belong in the live
  rules, not in the clip.
- **Motion: running, then jumping** (`motion.mjs`). A run-up from a jog, the running jump, the landing and a run-out,
  with the body travelling through the world, in the same four flavors. Each flavor sets how fast speed builds and how
  high it tops out, whether the stride keeps pace with the ground (planted feet) or outruns it (pinball's wheel of legs,
  never under four frames a stride), the take-off contact, and the arc: the clip's own on earth's gravity, a hang, or
  the platform rule's rise on 20 and fall on 34. Pinball flies a tucked spin (the forward roll's tuck, whole turns as
  a ball of it would roll, never under 8 frames a turn) in place of the leap. The clip's take-off and landing are the
  flight's ends in every flavor. `motion-verify.mjs` is the machine gate. `motion-preview.mjs` writes follow-camera players and a
  chronophotograph. The findings: the jog → sprint blend slides a planted foot (worse the faster speed builds), the
  platform rule has no acceleration on the ground, and the library has no start from standstill.
- **Collision: walking or running into a wall or another body** (`collision.mjs`), in the same four flavors. The
  flavor decides what the impact does to each body: real momentum, the change shown ×3 with the charger driving
  through, a fixed bonk or boop, or a bumper that gives back more than it got. One shared ladder of the library's
  responses (`hitHigh`, `stagger`, the `knockedOut` collapse, pinball's tuck) picks the reaction from the change shown.
  No trunk passes the wall or the other body. `collision-verify.mjs` is the machine gate, and `collision-preview.mjs`
  writes a player and strobes. The findings: the library has no clip that braces a hand against a surface (the forward
  hand passes 11–26 cm through), and the charge is a flavor rule, not physics.
- **The wall's property** (collision): a non-realistic wall is bouncy (tunable: a restitution, or a fixed rebound and
  hop), a treadmill (the gait goes on in place), or sticky (the body turns onto it and walks up, or climbs it hand over
  hand). The climb is built from the rig's own leg solve and `reachArm`, since the library has no climbing clip. Its
  palms meet the wall within 1.5 mm and its holds hold. A realistic wall refuses a property. A walk into a bouncy wall,
  or into a body, now walks in place instead of freezing as a block.
- **Weapons** (`weapon.mjs`): the hero library's swings (chop, thrust, rising, the two-handed cleave) at each item class,
  in the four registers. Realistic is the rig's own swing. The others show the weight more or less: action charges a
  heavy blade, draws a trail, and freezes longer for a heavier weapon; platformer flattens every weapon to one snappy
  swing. The blade's tip lands on its contact point in every register, and the blow is the body's real tip speed times
  the weapon and arm. The finding: `swingKeys` reports the strike about 7 % of the cycle earlier than the rig's player
  plays it.
- **Combos and hitstun** (`combo.mjs`): strings of 3 and 5 hits (fists, a sword) cancelled one into the next against a
  simulated victim. Hitstun is one law in every register (the next hit links if it lands inside the last hit's stun,
  and a free victim blocks), with a stun from four sources:
  - realistic: the body's reaction time
  - action: the game's combo rule, decaying, ending on a launching finisher
  - platformer: none, with mercy invincibility instead
  - pinball: none, since the ricochet takes the victim out of reach

  The findings: a realistic jab string sits within a frame of the reaction time; action's decay drops a sword
  string's finisher by a frame; strings need a step-in the library lacks.
- **Two views:** every player draws each pane from the side and from a ¾ overhead camera over a floor grid.
- **One review page** (`viewer.mjs`): every part's player, strobes and machine gate on tabs, for the artifact host.

### Realistic catch-up: adults only, one set of primitives, the realistic body's gaps

The realistic body depicts adults; the wearable libraries and the tailor share one set of primitives; the realistic
body catches up to what the authored one wears, and its principles are shared back.

- ADULTS ONLY: a child-coded hero asked of the realistic body (a child or chibi figure cast, or the anime 'kid' look)
  is that cast's stylized western figure instead (`adultsOnly`, the first step of `validateHeroSpec` and `heroRecord`):
  its colours keyed the same (the realistic skin's colour, as the dermis reads its tone, the palette's `Skin` unless the
  palette names one; every palette key as given), the realistic body's own keys left off, its dress as asked.
- ONE SET OF PRIMITIVES: the tailor re-exports the footwear library's `soleSlab`, `strapBand`, `buckleOn` and
  `bindNearest` (its own copies had drifted from them; the library's are the superset, its `buckleOn` now taking a
  slot's name as the tailor's did); both byte pins unchanged.
- docs/realistic-body.md says what the body wears and still refuses as the tree has it.
- HANGING PIECES OVER THE TAILOR'S CLOTH: a panel (coat-tails, a tabard's apron), a cape and a hood on the realistic body
  hang over the cloth the tailor made, not the skin under it. A hull piece takes `over` (more parts it hangs over beside
  what is worn on its body parts; absent, as before): the realistic path hands a panel the trunk's and the legs' cloth,
  a cape and a hood the sleeves' too, and keeps those names where it had filtered `over` to the skin's parts (a cloak had
  shown the jacket through at the shoulder and the elbow). A jacket cut at the waist (a tailcoat's, a spencer's) raises
  its stance till its last button is 3 cm over the hem: below the cloth the front had no surface, and its lapel and
  button were thrown a metre out. The authored pins unchanged.
- THE WAISTCOAT: the outfit language's `waistcoat: true | { front: single | double, buttons: 3–6 }` puts a waistcoat
  between the shirt (and its tie) and the jacket, from the chest to below the waist, the jacket eased over it, worn
  without a belt; a `Waistcoat` tone (the jacket's unless the card names one). On the realistic body the tailor gives it
  its V (narrower than a jacket's, so it shows between the lapels), its buttons down the middle (two rows,
  double-breasted) and its ARMHOLES, painted the shirt's and laid on the shirt slot by slot (`armholes`): taken in under
  the shirt they had stood out as shards, laid on a reach measured over a window of heights they had creased the jacket
  over them. The jacket's V walls over it read as the waistcoat. A seeded card `threepiece`. Cards without the word
  byte-identical (both pins unchanged).
- STATUES ON THE REALISTIC BODY: `statue` is no longer refused there. Every card and format carves: one material over
  every group, no dermis (stone is not skin), a lost head (and a torso study) taking the realistic head's own parts with
  it (the face and the nose, bound to the head beside the plan's head parts), a bust without the upper arms' stumps
  (the torso carries the shoulder; a stump cut from the deltoid's rings stood out as a disc). `detail` stays refused,
  its refusal now saying an outfit dresses this body. The authored statues unchanged.
- docs/realistic-body.md said no exporter carried the correctives and the body had no UVs; both have been in place
  (the skinned GLB's corrective morph targets with their weights baked per clip key, the skin's UV atlas). It says so
  now, and what is still missing: an engine-side driver, so a pose the engine makes itself gets the correctives.
- THE OUTLINE READ ON BOTH BODIES: the dressed outline (dress-outline.js: the family against the bare body's, each half's
  fit, the returns, the divisions, the flair, the advice in each canon) is read for the authored game body's heroes too,
  in the hero's readout beside its ring-for-ring silhouette; a figure it cannot read goes without it, never refused.
- THE LANDINGS MEASURED ON THE GAME BODY: the stylism's proportion stage judged every length word by where it lands on
  the realistic body. Measured on the authored game body (`GAME_LANDINGS`), a top's and a coat's hems from the waist to
  the tunic land 4 to 5 hundredths lower (its trunk is longer for its height), enough that under the anime canon's leg
  line a top worn out at the hip, kept on the realistic body, is moved on the game body; the stage now judges by the
  body the hero is on. Down the leg the bodies agree within about two hundredths. The measuring found a cropped woven
  top refused on the game body (its buttons placed below its window); its row now starts on it.
### Body-part map: dress tailored to the body, not the segment

- The realistic body's skin labelled by BODY PART (chest, abdomen, flank, upper and lower back, seat, hip, groin, neck,
  shoulder cap, armpit, upper arm, elbow, forearm, thigh, knee, shin, calf …) and by the MUSCLE most under each point,
  from the form field's own blend (each mass's share of the skin there), the deep base masses read by position:
  `bodyPartMap(recipe, R, build)` (body-relational-map.js); body-study `--map` colours the skin by part. The ground for
  dress tailored to the parts it covers, one piece across segments.
- Under the iliac crest (a hand over the hip's joint) the trunk is the seat behind, the hip at the side, the groin in
  front; a limb's bands by where a point lies down its bone (the shoulder's cap over the upper arm's top, the elbow, the
  knee, the wrist, the ankle about their joints); the armpit's fill above the hollow the shoulder's cap. A point inside
  another part's skin (the pelvis under the crotch, the arm's top under the cap) is `hidden`, for dress to leave alone.
  The labels eased over each grid (a point of a part fewer than three of its eight neighbours share takes theirs).
- THE FIELD GARMENT, the tee first (body-relational-garment.js `fieldGarment`, `FIELD_GARMENTS`): a piece names the body
  parts it covers, and on each segment that carries them the rings they mostly cover are its (down a limb to its
  `limit`); its surface one CLOTH FIELD, the body's own blended three times looser and eased out, each point cast onto
  it along the skin's own ray, then pulled TAUT along the piece (each slot's distance over the piece's length raised to
  its upper hull: from the bust's apex straight down, no ledge) and over its rings' hollows, at most 40 mm off. On the
  skin's grid, so it takes the skin's bind and correctives; its ends closed beyond its end rings. A realistic hero's
  `outfit: ['tee']` wears it in place of the segment tee. The envelope gains `taut`.
- SKIN-FITTING SHIRTS, outfit words `fittedTee` and `fittedShirt` (its sleeves to the wrist): close to the skin yet
  hiding the musculature and the joints' formations as a shirt does, cloth under tension spanning the GROOVES (the
  abdomen's lines, the cleft between the pecs, the deltoid's border, the spine's furrow, the elbow's hollows) and
  following the FORMS (the chest, the waist's taper, the arm's swell). On the realistic body a field garment: the cloth
  field blended half again looser, eased 2.5 mm, over each ring's hollows and pulled straight over any dip shorter than
  9 cm along the piece (the envelope's `span`: the grooves, the fold under the bust, not the waist's taper), by a SOFT
  cap (the envelope's `soft`: the lift saturating toward 45 mm, no ledge where it binds). Half of it lies within a
  centimetre of the skin (the tee: four). On every other body, segment pieces eased 3 mm. A field garment takes its
  envelope from its word (`looser`, `ease`, `reach`, `taut`, `span`, `along`, `soft`); the tee's as it was. body-study
  `--dress` draws the garments in cloth blue over the clay body.
- TROUSERS on the realistic body as a field garment, at the skin-fitting shirt's thickness (its cloth, so a shirt and
  trousers read as one fidelity): the waist, the hip, the groin, the seat, the thighs, the knees, the shins and the
  calves (`on`: the abdomen's and the back's names counted on the pelvis alone, so the trousers reach the waist and stop
  there). The seat starts where the pelvis's rings rise (`floor`: its lowest rings lie flat at the crotch, widening at
  one height, and cloth copied from them wound inside out), its cap closing between the legs; the trunk's cloth takes
  the thighs in (`join`), so the seat wraps their tops; the seat and the legs CROSS a few centimetres over the crotch
  (under it the seat let down under the legs, over it the legs under the seat), so the seat's edge leaves no lip.

### The tailored suit: a jacket's front and lapels

A suit read as a suit on the realistic body: its front, its lapels and its buttons as words on the outfit card, made
by the tailor. Cards without them unchanged, byte for byte.

- THE WORDS (`outfit/styles.js`): `outer.front` `single` | `double`, `outer.lapel` `notch` | `peak` | `shawl` | `none`,
  `outer.buttons` 1–3; any of them gives the jacket a tailored front (single with a notch lapel and two buttons, double
  with a peak and three rows, unless named). The expander carries them as the build's `tailoring`, beside its pieces;
  the lapel's facing a `Lapel` tone (the card's, else a shade off the jacket's). The authored game body's jacket is
  unchanged by them.
- THE FRONT (`body-relational-tailor.js`): `cutV`, the jacket's V from its top button up to the collar, taken in under
  the shirt, its edge carried onto the roll lines and its walls painted as the shirt (on cloth whose points sit 2 cm
  apart a V cut by them alone is a ragged slit); `lapelBand`, the lapels and the collar one band along the roll lines
  and round the back of the neck, its width the lapel's shape (the notch's step at the gorge, the peak's corner carried
  up and out, the shawl's one curve), the collar falling down over the shoulders, its inner edge rolled over the V's;
  `buttonOn`, a disc on the cloth. The wear adapter places them: the stance by the button count (two a little above the
  waist, one under it, three higher), the roll lines to the side of the neck, one row of buttons or two; a lapelled
  jacket wears no stand collar. Each part closed and wound once; a stride stretches no edge of it past 5 mm.
- CLOSED, ONE SIDE OVER THE OTHER: a closed tailored jacket's right front lies over the left, its edge a band standing
  on the left front from the top button to the hem. A single front is cut away below its last button (the quarters,
  `cutOpening`, opening on the trousers, the left front's edge come out from under the right); a double front is square
  to the hem, its edge past the left row of buttons, its left lapel going down under the right front so the two cross
  above the buttons.
- THE TIE (`language.tie: true`): a blade on the shirt from its collar to the belt (`bladeOn`: the knot a block, the
  blade widening to its point), the jacket carried out over it (`clearOver`) and showing it in the V; a card's `Tie`
  tone, else a deep red.
- Two business cards: `business` (navy, single-breasted, two buttons, notch lapels, a burgundy tie) and
  `doublebreasted` (charcoal, peak lapels, three rows of buttons, a navy tie over a pale blue shirt).
- OPEN, THE LAPELS TO THE HEM: an unbuttoned jacket's fronts hang a little apart from the top button down, its lapels
  carried on down each front's edge to the hem as the facing turned back (its buttons on the front under's edge).
- A WOMAN'S SUIT closes her way, left front over right (the hero's sex handed to the tailor with the front's words),
  every overlap, edge, crossing and button mirrored. A skirt's waistband is a layer under a jacket worn over it, and
  the jacket is carried out over the skirt at its own height (the skirt's rings filled in between, so a ring reads the
  skirt where it is, not 2 cm lower); every garment's trunk clears the trunks worn before it below the waist (close cloth
  over a woman's hips had lain inside the trousers' seat, which bridges from hip to hip, showing them through a
  jacket). Two cards: `skirtsuit` (navy, one button, notch lapels, a pencil skirt to the knee, a white blouse) and
  `trousersuit` (black, double-breasted, peak lapels, gold buttons, wide trousers, an ivory blouse).
- THE SHOULDER AND THE WAIST: `outer.shoulder` `natural` | `structured` and `outer.waist` `suppressed` | `straight`,
  alone or beside the front's words. Structured, the jacket's shoulders squared on a pad (`squareShoulders`: above its
  widest ring each ring's reach to the side carried out to the straight line from the neck's point at 18°, 4 mm past
  the widest, square from there down to it; a centimetre had stood the shoulder out past the sleeve's head). Suppressed,
  the waist drawn in toward what the jacket is worn over (`takeIn`, eased over 11 cm either side); straight, a sack's
  fall from the chest to the hip, the waist's hollow bridged (`fallStraight`). The collar now falls at the back and
  not at the sides of the neck, where over a squared shoulder it had stood out as wings, and is a little narrower. The
  suits wear them: `business`, `doublebreasted` and `trousersuit` structured, `skirtsuit` natural, all suppressed.
- THE LAPEL ALONG THE CLOTH: its outer edge measured along the jacket (`clothWalker`: round the ring at its height, up
  or down the cloth), not stepped out sideways and dropped back onto it, which had stood its top out off the shoulder
  in the air; its section six points across, so over a bust no chord of it dips under the cloth, and its rings twice as
  close along the roll line. A closed front's V is off the middle and a face's paint is mirrored, so the cut's walls
  are painted as the shirt only where both sides are cut (a one-sided wall's paint had laid a strip of white shirt on
  the jacket beyond the lapel); the quarters' paint the same. The belt is made before the jacket's front, the waist
  suppressed onto it and the ridge it leaves eased into the cloth 6 cm above and below (`bridgeRun` now takes a range,
  along the run only, and points to hold); a skirt reads what is under it within 1 cm of each ring (`clearanceOver`
  takes its window), so it no longer flares out too soon into a shelf under a jacket.

### The garment designer: silhouette principles over tailoring primitives

Garments on the realistic body as data over a small set of construction primitives, and the principles
that make a silhouette read as measures with bands, so a garment is chosen and checked rather than designed by hand.

- THE TAILOR (`polygonizer/body-relational-tailor.js`): the realistic body's construction in one place, each a pure
  function that knows no garment: runs (`oneTube`), profiles (`drapeRun`, `clearanceOver`), edges (`fallToFloor`,
  `turnHemIn`), trims (`bandAt`, `strapBand`, `sashOn`, `strip`, `ribbon`, `soleSlab`, `buckleOn`) and binds
  (`bindNearest`, `bindRibbon`, `ringW`). The trousers, the gi and the footwear are each their choice of them. Moved byte
  for byte (`body-relational-tailored.char.test.js`, out of the critical tier: each case mints a realistic body), but
  for one fix: a strap is now the one band, its caps riding with their ring as a cuff's do.
- THE PRINCIPLES (`docs/garment-principles.md`): what makes a dressed silhouette read, each as a measure of the dressed
  figure with a starting band in two styles, western (fashion and tailoring) and anime/game (character costume):
  silhouette families and their shift from the bare body, waist suppression, fit class, return points for loose cloth,
  the dominant division on thirds and never at halves, the leg line, a hem off the limb's widest, the shoulder line,
  fabric stiffness, the flair budget, readability at a thumbnail, and rules for dressing each body type. Every source
  so far seen only in search results, and said so.
- THE DRESSED OUTLINE READ (`polygonizer/dress-outline.js`): the realistic body's outline sliced off the compiled mesh
  against the bare body under it (a tenth of a second): the family, each half's fit, where loose cloth returns to the
  body (by its standoff each side, so layers at a belt count as a return), the divisions (only where a garment spans the
  body and does not go on below), the leg line, a hem's place on the limb, the flair pieces, and advice in each style.
  In the realistic hero's readout as `dress.outline`; `/body-study --outline` draws it. It found the gi's belt a cone up
  to its blouse (the gi now cinched past the belt) and advises the gi's skirt off the thigh's widest.
- OUTFIT CARDS ON THE REALISTIC BODY (`polygonizer/body-relational-wear.js`): the outfit expander's pieces (a card's,
  a stylism's, an outfit word's) worn by the tailor instead of the authored body's ring copies baked on the realistic
  envelope (a cropped top, rippled shoulders, belt shards). The expander still makes every design choice; the adapter
  only makes them: each garment one cloth block over its windows (the trunk's `u`, a limb's `run`), each layer standing
  off the one under it, a limb's two pieces one tube faired over the elbow or the knee, a top's tail and body one; a
  knit or fitted top's second-skin paint made close cloth worn first; a sleeve or leg stopping short of the hand or the
  foot turned back in to the limb; a collar a stand collar up the neck (`collarOn`); boots and shoes the footwear
  primitive; the belt a band with its buckle at the front. Each authored part name a worn piece had is an ALIAS for the
  cloth it became (its `u` shifted where pieces were merged), and the cloth is in the body the dress is made on, so
  what the expander placed on a piece lands on it: trims and an open front painted on its faces, rows of buttons,
  embroidered emblems, pauldrons. Still the authored kernel's: hanging panels, capes, hoods. New tailor primitives:
  `flareRun`, `fairRun`, `collarOn`, a buckle at a named slot.
- STYLISM ON THE REALISTIC BODY: no longer refused. A genre, a register and a target outline lower to an outfit build,
  worn as above. `/body-study --palette` shows a figure in its palette's colours, face by face.
- THE DESIGNER: the stylism given the principles (`stylism/proportion.js`), opt-in, nothing moving without it.
  `stylism.canon: 'western' | 'anime'` names the principles an outfit is designed to: the lengths the solver chose (a
  coat's, a top worn out, a skirt's, a trouser leg's) are judged where they land on the figure, measured on the
  realistic body for each length word, and moved to the nearest word that lands well (never at halves, never on the
  thigh's top or the calf's belly, the leg line kept), the hero's own lengths and a card it named standing; each move a
  note in the stylism's ledger, and the outline read advises in that canon. `stylism.silhouette: 'balance'` picks the
  outline the figure is dressed toward by the canon's rules for its cast and physique (a jacked western male a column, no
  padding; a heavy figure one long vertical run; a drawn female an X), with why. The outline read's calf is the bare
  leg's now, the knee not counted.
- THE PROOF, by data alone: a long coat, a gown, a structured jacket and `balance`, each a stylism with a canon, on
  male and female, athletic and heavyset; every one made without new garment code. What the run found and fixed: a waist
  wrap built for the authored body's girth cut through a heavy figure's coat (now a band, or a sash, made by the tailor
  on the outermost cloth at its height); loose sleeves swelled into balloons (loose cloth past 14 mm of ease now hangs,
  the tailor's fall down the limb, a sleeve narrowing to its cuff); the read judged a hem just under the knee as on the
  calf (now a good landing, as the stage holds); the family cut-offs re-centred on this body as it is read (a gi and a
  straight coat H, a long coat and a gown A, a cinched bodice over a flared skirt X).
- THE REALISTIC REGISTER: the realistic body's cloth cut as a character designer of the seventh console generation
  cuts it (close, with a real wearing ease; the silhouette from the cut, the belt, the coat's skirt and the layers, not
  from volume), where the expander's eases were tuned on the game body. Every garment the close cloth now, its ease
  compressed toward its role's ceiling (a shirt 12 mm, trousers 14, a coat 22: a coat still looser than a jacket, a
  jacket than a shirt) and held no farther than 15 mm past it (`fieldGarment`'s new `stand`: the trunk's cloth no longer
  carried out over the arms at the armpit). A COAT'S SKIRT, or a skirt's own, is the tailor's now (`carrySkirt`): carried
  down from the garment's body, close at the waist, falling from the hips' widest without following the legs back in,
  the hollows bridged, an A by the expander's flare over its drop compressed the same way, its hem turned up inside so
  it opens beneath; a skirt with no body hangs from a waistband of the close cloth, its belt on that. The authored skirt's
  name is an alias for it (turned: its hem the lowest `u`), so a trim painted on its hem lands there. Measured per side
  over the bare body: a long coat's chest about 10 cm → 6, its waist 9–12 → 4, its knee 11 → 7. Also fixed: a stand
  collar with no neck above the garment's top (a heavy figure's shirt) is left off instead of built inside out; the
  martial trousers' shin piece no longer carries a negative flare the authored body refused. SLEEVES are their own
  now: at their own pieces' ease, closer than the body's, a layer out only over the sleeves under them (not the
  trousers), bridged over the arm's hollows (the tailor's `bridgeRun`), and hanging only when the cut itself is loose,
  where every jacket's sleeve used to fall straight from the shoulder (a jacket sleeve 2.4 cm off the arm → 1.0–2.0). A
  jacket worn over the trousers' belt clears it; an open front painted on a jacket whose body and tail are one tube
  is each piece's own again (the tail's paint, in the trousers' colour, had covered the whole front).
- `/garment-design <brief>`: the designer as a skill. The brief in stylism words or a card, the rationale principle by
  principle, the mint and the read, the words adjusted at most three times, the sheet shown; the eyes gate the
  operator's.

### The gi: a wrapped jacket over the martial artist's trousers

A jacket that goes over the wide trousers, on the outfit word `gi` (`polygonizer/body-relational-gi.js`; the authored
body wears a wide top, sleeves to the forearm and a hem over the hips):

- The BODY one tube from the collar to its hem: close over the shoulders, hanging below the chest (the slack eased in,
  so the back has no step), BLOUSED over the belt it is cinched under, then a SKIRT carried straight down past the hip,
  every ring clear of the trousers under it; the skirt's weights the pelvis's, the thigh's shared in toward each side.
- The WRAP: a V from the collar to the crossing, the cloth inside it taken under the skin, which shows; one COLLAR band
  lying on the cloth, up the right edge, standing round the back of the neck, down the left edge and over the crossing to
  the right waist (left over right); the over-panel's edge on down the skirt. Both in `TopFold`, the jacket's own shade.
- WIDE SLEEVES draped as the trousers' legs are, one tube from the shoulder to the forearm, flaring to the hem.
- TURNED HEMS: the skirt's and the sleeves' cloth folded back up inside, so they open as cloth does instead of closing
  with a lid (the loft winds such a tube only from the collar down, its cap's pole back toward the opening).
- The BELT is the jacket's (band, knot, tails); the trousers' sash is left off under a gi. The drape's sash takes a
  station and a name, and its legs an optional `flare` (absent, the trousers are unchanged).
- Machine gate (`body-relational-gi.test.js`): closed and wound once, the skirt outside the trousers from the belt to the
  hem, no jacket over the chest's middle in the V, each sleeve wider than the arm and its hem turned in, no edge grown
  more than 3 cm in a stride or a sprint (a ribbon's corners take one station's weights).

### Loose cloth that falls: the martial artist's wide trousers

Everything the realistic body wore was FITTED: the cloth field close over the forms. Loose cloth now hangs
(`polygonizer/body-relational-drape.js`), on the outfit words `martialPants` and `wideTrousers`:

- The DRAPE: the trousers' leg rings re-made hanging, each slot's radius the widest of its own (and a slack) and the
  ring above's let down slowly (`taper`), so the cloth falls from the seat and the thigh past the knee instead of
  following it in; vertical folds round the ring, deeper toward the hem.
- ONE TUBE A LEG: the thigh's and the shank's rings one piece (no edge across the knee), the shank's taken round at the
  thigh's slots, every point's weights mixed from its own piece's, so a stride carries the cloth with the leg.
- The MIDLINE: each leg's inner side held off the body's middle plane, so the two legs never cross (at the crotch,
  where the thigh's skin reaches the plane, the plane wins).
- The HEM: `martialPants` blouses over a cuff gathered at the ankle (a wrapped band, its caps weighted as its rings,
  so a bent knee carries the whole cuff); `wideTrousers` falls open to just above the ground, over the foot.
- A SASH at the waist, a knot at the front and two tails hanging. Tones `Sash` and `Cuff`.
- Machine gate: closed and wound once, the legs apart at the midline, wider than the calf, the cuff with the ankle in a
  stride and whole on its ring, the open hem never under the ground (`body-relational-drape.test.js`).

### Armour fitted to the realistic body

In progress. An armour build (`adorn: { type: 'armor', style }`) on `form: 'realistic'` was the authored body's kit baked
on the realistic body's envelope: plates sampled 6 × 4, the breast and back windows open at the flanks, the fauld two
coarse wraps crumpling over the belly, the pauldron's anchor folding over the shoulder's turns. Now
(`polygonizer/body-relational-armour.js`, the style still naming every piece, its window and its ornament):

- Every plate sampled as densely as the realistic skin under it and made the kit's own hollow plate (a wall rolled at
  its edges, faired over the forms beneath: `fitPlates`).
- The CUIRASS (the kit's breast and back plates) and the FAULD made field shells round the trunk over their windows
  (a field garment at a plate's clearance, taut over the forms; `fieldGarment` takes a `window` in the segment's
  stations), worn on the body the rest of the kit is baked over, so a tasset or a strap stacks over them.
- The PAULDRONS a JOINT CAP each (`jointCap`): a dome over the shoulder from a centre deep in it, the farthest of the
  skin and the cuirass under each direction faired and held clear, its outer and inner walls rolled at the rim,
  carried by the clavicle; the kit's lames down the arm under it.
- The GORGET optional: the realistic body wears it only when the build names it (`wear: ['gorget']`, armor/expand.js
  validates the word). The authored body's armour byte for byte.
- By ROLE, not by name (`roleOf`: a piece's carrier, its window, whether it wraps, what it spans), so every family is
  fitted alike and a style the fit has never seen is fitted by what its pieces cover: the trunk's panels front and
  back one CUIRASS (the knight's breast and back, the hardsuit's chest, back and abdomen plates); every wrap round the
  trunk a field HOOP over its window, each over the one before in the kit's stacking (a fauld's lames, a belt, the
  lamellar rows), the lowest carried down to a skirt's hanging plates when no cuirass meets them; a pinned panel hangs
  (the lamellar skirt) and keeps its kit shape; a shoulder's anchor a CAP; a foot's wrap a BOOT; a neck's wrap the
  optional gorget; the HEAD's pieces (a helm, a neck guard hung from it) left off, not fitted to the relational head
  yet. A strap hugs what lies under it (its lift read within 2 cm). Plate, lamellar and hardsuit styles mint on the
  realistic body (a lamellar suit refused before: its neck guard's address fell off the realistic neck).
- The SABATONS boots (the realistic foot turns from the ankle to the sole, which folds a plate): the footwear
  primitive's, below. The realistic foot's rings carry the authored foot's `u` (a share of its span), so an address
  made for the authored foot lands on the same share of the realistic one.

### Footwear: a solver library, an adapter per body's foot

In progress (the library and the realistic body's adapter first; heels, laces and the other bodies' feet next).
`lib/graph/footwear/`, on the armour and outfit pattern: footwear in THREE LAYERS (`principles.js`), the SOCK (the
protosock, the shoe's close outer layer and its bottom colour: a height and a thickness, none for a sandal), the SOLE
(its layers stacked from the floor up, each with its own thickness, welt and group: an outsole, a midsole, a stripe; a
layer's patterns: `pod` an air window at the heel, proud of its wall; `heel` a block under the print's rear, a dress
heel on the still-flat foot; `lugs` tread round its edge) and the ADORNMENT the solver lays over them
(`ADORN_PRIMS`: `strap` with a `buckle`, `band` (gilding), `cuff` at the sock's collar, `toeCap` (a quarter egg over the
toes, mapped from the toe base to the frontmost toe with a toe allowance past it (`room`), the leather under it tucked
inside, `rivets` round its back edge, small and dark a brogue's perforations; in the leather's own group a sleek toe);
`panel`, a pattern piece on the upper as a cobbler cuts it (`cobbler.js` COBBLER_REGIONS in the sock's own
coordinates, along the foot and round from the instep's centre line: the `tongue` (standing above the collar by its
`rise`), the `eyestay`s, the `vamp`, the `quarter`s, the `counter`, the `foxing`; or an inline region), a MATCHING PAIR,
lateral and medial, where the piece has two sides; `laces` criss-cross between the eyestays over the tongue; any of
them in a `group` of its own). Composed by CARDS (`styles.js`, pure data: a new look is a card), each annotated
with its `family` (shoe, boot, sandal, sneaker, dress); a card EXTENDS another (`from`: its sock merged, `adornPlus`
appended, its tones merged), and wears any COLOURWAY (`skin`: `SKINS` tripleBlack, tripleWhite, volt, navy, oxblood,
tan, or its own tones by group), the pieces' groups being roles (Overlay, Counter, Eyestay, Midsole …); by passes in a fixed order (`expand.js`: sock, sole, adorn, tone; tones
only for the groups laid), refused by name (`validateFootwear`). Worn on any body through its FOOT ADAPTER (`adapters/`:
which parts are the foot, the toes and the shank, the rig's ankle, toe base and toe tip, the bare skin a sandal is worn
on, the body's own way to lay the sock, and how a share along a segment names its stations): a card's places are shares
of a segment, so it reads on any body. `wearFootwear(adapter, card)`.
The realistic body (`adapters/realistic.js`; `polygonizer/body-relational-footwear.js` re-exports it): the sock a field
garment, close over the foot's forms (`boot`: up the shank as a shaft, the foot's leather tucked under it round the
ankle; `shoe`: from a collar below the ankle; its `thick` the leather's ease). The words on the realistic body: `boots`,
`shoes` (new), `sandals` (new; on the authored body a low close shoe), `workBoots` (a steel toe, riveted),
`adventurerBoots` (a thicker sock, a deep sole, a cuff, a gilt band, a buckled strap), `sneakers` (a court shoe: a white
cupsole on a gum outsole, a rubber toe bumper) and `runners` (a foam midsole with an air pod, a contrast stripe), both
cut as sneakers are: tongue, eyestays, laces, matching quarter overlays, the heel counter. SPORTS varieties over them:
`highTops` (over the ankle, a padded collar, an ankle strap, a deep cupsole on air), `skateShoes` (a vulcanized sole, a
suede vamp, a side stripe), `trailRunners` (a lugged outsole, a toe guard). DRESS shoes (a sleek sock, a leather sole on
a welt, a stacked heel): `oxfords` (cap toe, closed lacing), `brogues` (perforated round the cap), `derbies` (open
lacing over a tongue), `loafers` (a saddle strap), `monkStraps` (two buckled straps), `chelseaBoots` (elastic gussets,
a pull tab). BOOTS cut as a cobbler cuts them: a region's `shaft` carries its piece on up a boot's shank (the quarters past the
ankle, wrapping round to meet at a back seam; the tongue up the front, standing above the top; the eyestays beside it,
the laces on up between them, `shaftRows`; where the foot's piece begins below the ankle, a bridge on the foot's
leather cut round as the shaft's, so no plain leather shows between them), so any boot-height card is cut up the leg
and a shoe is not. Cards
`hikingBoots` (lugged, a padded collar, a toe guard), `combatBoots` (laced to mid-calf), `chukkas` (suede, a crepe
sole), `cowboyBoots` (pull tabs, a stitched band, a cuban heel the body stands on, a long toe), `ridingBoots` (a tall
plain shaft, a low heel); `workBoots` laced. FANTASY, DRAMA AND HISTORY (`fantasy.js`): primitives the cobbler's pieces do not make, composed by cards like any
other: `toePoint` (the toe drawn out past the toes, tapering, curled up by its degrees, a `bell` on its tip), `wrap` (a
ribbon spiralled up the leg, on the leather or the bare leg above a short boot; `cross` a second the other way),
`flare` (a funnel rising from a boot's top and opening out), `buttons` (a row up a boot's side), `spur` (a neck from the
heel and a star rowel), `wings` (a fan of feathers at each side of the ankle), `jewel` (a stone on the toe, the instep or
the ankle), `fur` (a shaggy ruff round the collar, or round the leg at a share: tufts and a drooping fringe of seeded
lengths); the heel kind `teeth` (a board on two teeth, the foot raised level when the toes stand as high as the heel).
Families `historic` and `fantasy`. Cards `poulaines`, `jesterShoes`, `persianSlippers`, `romanCaligae` (hobnailed),
`gladiatorSandals`, `vikingWraps`, `cavalierBoots`, `buttonBoots`, `geta`, `elvenBoots`, `talaria`, `furBoots`, `barbarianBoots`. On the authored body
a card wears its boot, sandal or shoe by its sock. HEELS (`heels: { height, toe, shank, kind: stiletto | kitten | block | wedge }`) change the mechanics: the foot is
tipped about the toe base and the body risen on them, as the RIG'S STANCE (`rig.stance: { rise, toe, pitch }`,
`station-loft-rig.js`: every pose stands in it, the root `rise` higher, each planted foot's toes `toe` up and its
metatarsus `pitch` degrees heel-up, or the pose's own heel where it lifts further, a free foot's toes turned down by the
pitch; absent, nothing changes), solved from the foot's own heel-to-ball length so the legs keep their length; the soles
and the heel cut against where the ground will be under that pose, rigid on the foot's and the toes' bones, the heel
leaned in the bind so it stands plumb when worn, a slender heel's foot under the back of the seat. Cards `pumps`,
`blockHeels`, `wedges`, `platforms`; `chelseaBoots` on a low block heel. A tone may be `{ of: <group>, shade }` (that
group's colour darkened or lightened, read after the palette: `readTones`), so recolouring `Shoes` carries the pieces
cut from it; the dress cards use it. A card's or its skin's named tones stand over the palette's defaults, the
operator's palette over all. body-study `--dress` paints the shoes in their own colours; a rig with a stance stands the
bind in it; `--crop shin` frames a tall boot whole. On the
authored body the library's other words are its boot, its sandal or its shoe by the card's family, for now. `boots`, `shoes` and `sandals` are pinned byte for
byte as the primitive first made them (`footwear.char.test.js`). `fieldGarment` takes `covers: null` (every ring of the
segments it is `on`). body-study `--dress` colours each footwear group by its tone.

### Handwear: a solver library, an adapter per body's hand

The footwear library's sibling for the hands (lib/graph/handwear): a CARD (pure data, a family, `from` its kin, `skin` a
colourway, `adornPlus`) worn through a HAND ADAPTER by passes under laws, the gloves the way the shoes are made.
- THE PROTOGLOVE: the palm's and the digits' own rings stood off by the leather's thickness, a digit cut at its middle
  joint or at its knuckle where the card's `fingers` (and `thumb`) say, its end closed inside the finger; the cuff up
  the forearm by its share (the realistic adapter's close leather, a field garment); a glove with no cuff tucks its
  first ring under the forearm's skin. `glove: false` lays the adornment on the bare hand.
- THE GLOVER'S CUT (cutter.js): pieces in the hand's design coordinates (the plating library's fitted shell: along the
  segment, round it from the back of the hand, the thumb's side +, the palm ±1), named `back`, `palm`, `heel`,
  `knuckles`, `fingerBacks`, `fingerPads`, `thumb`, or `{ seg, t, s }`.
- ADORNMENT PRIMITIVES (`ADORN_PRIMS`): a piece, the points stitched down a dress glove's back, a cuff, a strap (a snap
  or a buckle on its back), a flared gauntlet cuff from the wrist, a hard knuckle guard, studs, a knight's lames, rings
  with stones, a stone on the back or the knuckles, claws curled toward the palm (each rigid on its last phalanx), fur, a
  fighter's crossed wraps. Each takes its surface's weights.
- CARDS by family: glove (`gloves`, `suitGloves`, `fingerless`, `mitts`), dress (`dressGloves`, `operaGloves`,
  `drivingGloves`), work (`workGloves`, `weldingGloves`, `gardenGloves`), sport (`bikerGloves`, `cyclingGloves`,
  `goalkeeperGloves`, `fightGloves`, `skiGloves`, `handWraps`), historic (`cavalierGloves`, `falconryGlove`,
  `knightGauntlets`, `bishopGloves`), fantasy (`clawGloves`, `sorcererGloves`, `furGloves`, `gemGauntlet`); colourways in
  `SKINS`; a piece's tone may be OF the leather's.
- SPORT AND DRESS VARIETIES, skinnable as the shoes are: sport `battingGloves`, `golfGloves`, `liftingGloves`,
  `receiverGloves`, `racingGloves`, `hockeyGloves`, `tacticalGloves`; dress `kidGloves`, `walkingGloves`, `winterGloves`, `eveningGloves`, `mousquetaireGloves`,
  `bridalGloves`, `ceremonialGloves`, `perforatedDrivers`, most a variety of their kin (`from`). Primitives `buttons`
  (a row at the wrist's opening, up the inner forearm along a long cuff) and `perf` (a grid of perforation over a
  region, on each digit of a digits one). Colourways for sport (`tripleWhite`, `infrared`, `royal`, `hiVis`, with
  `volt`, `navy`) and for leather (`cognac`, `chocolate`, `dove`, `burgundy`, `ivory`, with `tan`, `oxblood`): a
  leather colourway carries every piece whose tone is OF the leather. The knight's and the stone gauntlet are the
  `gauntlet` family's.
- THE MITTEN SHELL (a card's `mitten: { pad, grip, thumb }`): one closed padded form over the palm and the four fingers
  in place of their gloves, made round the gloved hand as spheres (the palm's surface, each digit's bones sampled
  along) sliced from the wrist on past the fingers, each slice read out from its middle, its front rounding off where
  the spheres end. With a `grip` (a hand word: a boxing glove's `fist`) the shell is made round the closed hand, rigid
  on the hand bone, and the body HOLDS THE GRIP AT REST (station-loft-rig.js `holdGrip`: the hand's joints and every
  part riding the digits' bones turned into it by the rig's own curl), so the bind, every pose and an export keep the
  fist inside it; without one the shell bends with the fingers inside it, each point taking its nearest skin's
  weights. `thumb: 'apart'` keeps the thumb in its own sheath. Words `boxingGloves` and `sparringGloves` (a fist, its
  thumb sewn to its side), `mittens` (knit, the thumb apart).
- FANTASY AND HISTORIC MITTENS on the shell. `mitten.free` leaves any digits outside it in their own sheaths (a
  trigger finger); a piece aimed at a digit inside the shell skips it, and claws grow from the bare tips through it. The
  primitive `ribs` lays bands across the shell, spaced by its length (lames, scales, trim, cracks). Historic
  `mailMittens` (a mail muffler), `mittenGauntlets` (Gothic, steel lames to the fingertips, the thumb's own),
  `lobsterGauntlets` (blued, lames from the back of the hand), `triggerMittens`, `arcticMittens` (sealskin, trim, fur);
  fantasy `bearPaws`, `pincerGauntlets`, `golemFists` (a stone fist held closed), `dragonClaws`.
- Every card is an outfit word, worn on either body through its adapter (its parts riding their segments' dials, its
  tones under the operator's palette). THE AUTHORED BODY wears them too (adapters/authored.js): the same hand as the
  realistic body's, its glove's cuff new rings sampled round up the authored forearm's few coarse ones, their weights
  mixed from the rings either side. A mitten's grip marks the hand `held` (station-loft-rig.js): a pose's own fingers
  no longer curl it on past its glove's fist (a guard's fist had curled the thumb out through the shell); its wrist
  still turns. body-study paints its groups, a palette's colour
  first.
- The fitted shell reads a coarse ring (the hand's eight points, a digit's six) as it is, unsmoothed: easing toward
  neighbours that far round had lifted the flat back of the hand about 7 mm off it.

### Wearables sized to the body: no one wears the same size shoe

The footwear and the handwear libraries' cards were drawn on the realistic man (every sole, heel, welt, strap, cuff,
claw and mitten's padding in his metres), so the realistic woman, the tall and the short builds wore his sizes. Now each
is worn at the body's size: an adapter reports its body's foot (heel to toe tip along the foot: `footLength`) or hand
(the wrist to the middle finger's tip: `handLength`), and where it differs from the reference the cards were drawn for
(`FOOT_REFERENCE`, `HAND_REFERENCE`, the realistic man's), the body is carried to the reference's size, the card worn
there unchanged (its lengths, the library's defaults and its tolerances alike), and every piece carried back, a heel's
stance with them; the adapter's own close-fit distances (the leather's ease, the envelope's reach) take the scale too.
The reference body is worn as it was, byte for byte (its pins hold). Both libraries' realistic adapters and the
authored hand adapter report their size; the plated suit's feet and hands, being these libraries' cards, follow.

### Plating: segment-paneled armour on the realistic body

In progress (the realistic body first; joint caps, glow seams and the other bodies next). `lib/graph/plating/`, a module
of its own beside the armour (it leaves `armor/` and the realistic fit untouched; the hard-suit can adopt it): a powered
suit as TWO LAYERS, an undersuit (a close field garment over the trunk and the limbs) and PLATES over it, each a REGION
of one segment in that segment's own coordinates (`regions.js` PLATE_REGIONS: along it, round from its front line;
chest, abs, flank, back, lumbar, belt, hip, shoulder, bicep, triceps, gauntlet, thigh, thighOuter, hamstring, shin,
calf; or an inline region), cut from the suit's own grid and standing off it by its `lift` (footwear/cobbler.js
`panelOn`), never across a joint; split into `rows` whose gaps are the PANEL LINES; a matched pair where the region has
two sides; a REACTOR disc on the sternum in a rim, its group rendered full-bright (`emissive`). Composed by SUIT cards
(`styles.js`, pure data; `from`, `platesPlus`, a `skin` colourway), refused by name (`validatePlating`). Outfit words on
the realistic body: `powerSuit` (red and gold), `stealthSuit` (black, wide panel lines), `heavySuit` (gunmetal, far
standoff, more rows), `sleekSuit` (white, few plates); on the authored body none yet. body-study `--dress` paints a
suit's groups in their own colours.
FITTED SHELLS (the layout of a powered suit as a supercar's body is laid out, `shell.js`, `layouts.js`): a segment faired
into one smooth shell (`fairShell`: its grooves bridged), cut along DESIGN LINES in its own coordinates (`t` down it,
`s` round it, + its lateral side) into panels (`shellPanel`) fitted across narrow seams, bevelled down into them, domed
where they cap, stacked by LAYER (an underplate, a trim strip, the overplate, a cap, a light), so the overplates'
windows show the metal beneath; a mirrored panel's pair on the other side. Its lines run STRAIGHT and JOG (`stepped`:
straight runs joined by short straight diagonals, neighbours sharing their jogs so they fit along them), each kink a
sharp corner (a panel takes a section at every kink of its edges).
MUSCLE-MAPPED SHELLS (`muscles.js`): on a muscled segment the body draws the lines. The realistic body's muscle map
(body-relational-map.js) gathered into PLATE GROUPS per segment (`MUSCLE_GROUPS`: the pectoral, the sternum, the collar,
each row of the rectus, the oblique, the lat, the trapezius, the spine; the deltoid, the biceps, the triceps; the
brachioradialis, the extensors, the flexors; the rectus femoris, the vasti, the adductors, the hamstrings, the knee),
each plate's edges the boundaries between its muscle and its neighbours' (at the half-slot between them, so neighbours
share them), STRAIGHTENED (`straighten`: held straight, jogging only where the groove moves and holds), so the seams fall
in the grooves in the stepped style; each group its layer and colour role, an underplate under each segment. A suit's
`muscles: { on, only?, bulk?, seam? }`. The suit `markSuit`: the trunk, the arms and the thighs cut by their muscles, the
greaves, knee caps and sabatons below, a reactor on the sternum. The JOINTS banded (`joints`: two narrow articulated
bands at the shoulder, the elbow, the wrist, the waist, the hip and the groin, the back of the knee; the armpit a banded
group), the grooves wider (14 mm), the calf cut by its muscles (the gastrocnemius's two heads and the soleus, under the
greave's front, `greaveFront`); the labels eased before the cut (a point takes the group most of its neighbours share);
a point inside another part's skin (`hidden`) left out, and each segment's underplate and joint bands kept to the stretch
of it that shows, so the inner of two overlapping skins does not poke through. Where the muscles interleave too finely
to cut by (the lower back, the pelvis, the thigh toward the groin), a DESIGNED cut instead: `spine` (a dark channel down the back, a column of
vertebrae, a sacrum ending in a chevron; a design line may run through the back, `s` past ±1), `lumbar` (stepped plates
either side of the spine), `hips` (seat and hip plates, a codpiece, a low-abdominal plate), `thighs` (a quadriceps plate narrowing to the knee in a chevron, a
trim strip down the outside, a side plate, an adductor plate inside, a teardrop over the vastus medialis, hamstring plates
either side of a back seam); and SERVOS (`servos`: a hub at
the outer and the inner side of each knee and elbow, a disc, a domed core and a light; a panel may be a `circle` sized in
metres). `markSuit` cut by its muscles where they are clear and by design where they are not. Layouts `greave` (a chevron shin plate, side
plates sweeping to the ankle, windows with trim strips, calf plates over them, a cuff, vents), `kneeCap`, `sabaton`. A
suit names its `shells` (with a `bulk`), its undersuit's segments (`suit.on`) and its `feet` (a footwear card: its sole,
its quarter-egg toe). The suit `markBoots`. The footwear library's toe cap is allowed on a bare foot.
GAUNTLETS: the hand and its digits are plating segments (a layout panel's `seg: 'fingers'` lays it on the four), and a
suit names its `hands` (a handwear card: the glove the hand's plates are laid on, in the suit's group). Layouts
`vambrace` (the forearm by design: a top plate over the extensors with a vent, a trim strip down the radius, a flexor
plate, an ulnar plate across the back line, a cuff proud over the wrist), `gauntlet` (an underplate, a stepped back
plate, a blade down the little finger's edge, a domed knuckle cap, a repulsor in the palm, a lame a phalanx on each
finger and the thumb, low), `gauntletHeavy` (a studded knuckle bar, a thumb guard), `gauntletSleek` (one plate with a
light line), `vambraceHeavy` (a ridge, a flared cuff). A shell may be laid on some of its segments (`{ layout, on }`).
Suits `markGauntlets`, `heavyGauntlets`, `sleekGauntlets`, `bracers`; `markSuit` wears the vambraces and the gauntlets.
A plate takes the weights of its surface's nearest point or, where the surface blends by ring (a digit's), its ring's,
so a finger's lames curl with it.
THE PARADIGM CLOSED OUT: a layout is data a card can carry. A shell entry is a layout's name or `{ layout | panels,
drop?, plus?, name?, on?, bulk? }` (a layout of its own, named; or a named one with panels dropped by id and others
added), a variety adds shells to its kin's (`shellsPlus`), and every panel is checked by name (`validatePanel`) before
it is cut. The laws carry it (a layout is data; the extremities are their own libraries' cards), and docs/plating.md
sets out the card, the passes, the laws and the adapter the three wearable libraries share.

### The hero's skin: a part of the character, shown where it shows

- `skin` on the hero door (`form: 'realistic'`): the dermis's dials (dermal-map.js DERMIS_DIALS but `sex`, the cast's:
  tone as an MST swatch or a hex, undertone, age, flush, freckles, oil, lines, dirt, war paint, hair colour …),
  refused by name. `palette.Skin` is its tone when `skin` names none (both, differing: refused). The recipe carries the
  resolved dermis (`recipe.dermis`), which the export paints, and the palette's Skin becomes its base colour
  (dermal-map.js `skinBase`), so the page, a face no texture covers and the texture agree.
- An OUTFIT takes the realistic body's suit off: the trunk and the limbs (painted Top and Bottom) are Skin under a
  garment, so what it leaves bare is skin; the feet keep their shoes. Undressed, the suit as before.
- COVERED skin off the atlas (epidermis/dermal-hero.js `coveredSkin`): a body skin point under a garment or an armour
  (a ray out along its normal meets one carried by its bone or one within two joints, so a hand at the thigh is not
  covered by the trousers). The body's islands (dermal-body.js `bodyChart` `shown`) are each part's runs of rings that
  show (a sixteenth of a ring at least, a ring either side), each ring addressed on its whole part; a face off them,
  and a part painted another group (the suit, the shoes), takes the base colour, no texel. Dressed in the fitted shirt
  and the trousers the atlas went from 2048 × 3072 to 2048 × 2048 and the lit export from 33 s to 17 s.
- The skin in the UNLIT export too (an export asks; the World page does not): its texel times the corner's baked light.
- The BAKE (surface-bake.js, opt-in `bake`) on the realistic hero: its head's layers let down under one another and its
  eyes' globes cast no occlusion (dermal-hero.js `heroHidden`; `bakeChannels` `hidden`), its surface's normals the
  field's (`normals`), so a seam between two parts of one skin reads as none; the globes wear a new `eye` finish (a
  wet, lit globe: the socket's shadow falls above the eye, on the lids, not in it) unless the bake names them. Every
  other figure's bake as before.
- The realistic hero's unlit GLB welded as its lit one is (the figure's `weld`): 17.4 MB → 4.0 MB, drawn the same.

### The realistic hero at the door

- `form: 'realistic'` on the hero door (`create_character`, `mint_solid` via 'hero'): the hero's body re-sampled onto
  the form field (body-relational.js `formSlice`) once its plan is a recipe, the build by the cast's pole (male: norrin,
  female: shalla), with a `physique` (a word, `athletic | skinny | heavyset | jacked`, or `{ from?, bulk, tone, weight,
  height }`), stored with the slice's laws. Absent `form`, every hero as it was.
- The plan is laid out with the hero's tune times the build's (the build's shoulders, the physique's stature and
  shoulders), so the door's athletic Norrin is the body study's slice byte for byte. A slice takes 6 s (male) to 10 s
  (female, jacked) on the first expansion; slices are kept by their inputs (the expanded recipe and the build), so the
  same body again (a world's inline hero each render, an edit that leaves the body) is a tenth of a second.
- What the realistic body does not wear yet refuses by name: `outfit`, `adorn`, `paint`, `detail`, `statue`, `stylism`
  (fitted to the authored body's rings, which the slice re-samples), `body` and `girth` (the physique dials those), a
  cast other than 'male' / 'female', a head other than landmark or none, the streamlined core. The words agents guess
  (`bulk`, `muscle`, `tone`, `weight`, `fat`) point to `physique`; the layered card teaches it.
- The form field split by job, the slice byte for byte: `body-relational-builds.js` (the builds, the physique),
  `-field.js` (the distances, the fields, the crossing and the projection), `-resample.js` (a part re-sampled),
  `-correctives.js` (`correctiveRest`, the shoulder's blend), `-vec.js`; `body-relational.js` keeps `formSlice` and
  re-exports the rest. The sliced recipe's contract (its parts, station ids, slots, rig additions and correctives) is
  `docs/realistic-body.md`, held by hero-realistic.test.js.
- Dress on the realistic body (in progress): the bare body is sliced (kept by what the slice reads, so a dress edit never
  re-slices), the plan expanded again on it (`expandPlan`'s `body`), the outfit, the kits, the armour and the paint made
  on its ENVELOPE (body-relational-envelope.js: each ring over its convex hull, the hollows along the part filled, at
  most 15 mm off the skin) and the skin put back under them, a pinned piece's offsets carried into the skin's frame; a
  garment's points take the body's correctives. The sliced parts keep a `slotT` in the authored part's terms and their
  band paint by position. `detail`, `statue` and `stylism` still refuse. Open: on a physique the pelvis's rings hidden
  under the crotch's level are drawn in to a cone, and a trouser seat fitted on them folds (the male skinny and heavyset,
  the female heavyset); body-study `--hero` renders the door's own hero.
- The female's WAIST drawn in against her hips (body-relational-field.js `waist`, the build's `{ t, w, pinch }`: the
  trunk's field read narrower across about a height on the torso bone, eased out either side, its depth as built). On
  the hero's masses her waist measured 0.67 of her hips' width from the front and his 0.72, so the two read alike; with
  a tenth's pinch hers is 0.61 (21.8 cm against 23.8). His, and every build without `waist`, byte for byte.
- The realistic hero's head is the RELATIONAL head by default (`head` absent on `form: 'realistic'`; `'landmark'` and
  `'none'` still name theirs; a record stores its head, so a hero minted before keeps its own). The hero routing card
  names the realistic form (`form: 'realistic'`, `physique`, the fitted outfit words) and a phrasing that reaches it;
  the layered vocab card's paragraph says what the realistic body now wears.
- The whole loop under test (export-model.realistic.test.js, the E2E tier): a realistic hero minted by the character
  door with the fitted shirt and the trousers, exported as the lit skinned GLB, read back by glTF-Transform: one skinned
  mesh on the rig's joints, the idle, walk and wave clips, the correctives as morph targets by name, the normals, the
  weights summing to one, and the skin: a texture coordinate on every corner and the dermis's atlas as the base colour,
  the head's page in it.
- Fixed: a DRESSED realistic hero lost its face. The plan's body hook (station-loft-plan.js) took in only the parts the
  plan had a name for, so the relational head's visage and nose (the face's own parts) were dropped and the cranium,
  let down under them, showed as a smoothed mask. The hook now takes every part the body brings. An undressed hero is
  byte for byte as it was.
- The realistic hero's GLB WELDED: its pack writes a corner a triangle, so a grid point went out once per face round
  it; corners alike in every attribute and every target's row are now one vertex (scene-gltf.js `weldCorners`, under the
  lit export of a pack carrying its normals), a UV seam's or a crease's two sides apart. The dressed female's lit GLB
  went from 304k vertices and 23.7 MB to 51k and 5.2 MB (16-bit indices), drawn the same. Every other figure's export
  byte for byte.
- The realistic FEET lighter: the foot 36 rings × 48 round (was 45 × 72), the toes 21 × 48 (was 31 × 64), about 5.3k
  triangles a side for 10.4k; the toes, the heel and the ankle read as before (the operator's eyes), the sole's flat
  cut a little coarser.
- The relational head's FIT on the recipe (`recipe.headFit`: `{ sex, k, ty, men }`, the scale and the offsets that seat
  the head on the neck), so an export can read the hero's head back into the head's own frame and chart it.

### Realistic body: correctives posed and exported

In progress. The realistic body's correctives (`recipe.correctives`, docs/realistic-body.md) outside the body study:
- Posed: `poseLayered` (hero-gesture.js) skins the rest with the correctives the pose drives (`correctiveRest`), so a
  standing hero's solid and the door's gesture gates carry them. A recipe without correctives poses byte for byte.
- Packed: `packLayeredRig({ correctives })` (station-loft-rig.js) carries each corner's rows as the face's are
  (`corrective` on a part), the pack's `correctives` (each target's id, driver and weight at rest; each driver joint as
  the bone carrying it and its offset from that bone's head) and every clip's `cw` (each key's weights, by
  `correctiveWeight`, correctiveRest's formula). The layered world resolve asks for them only when the export asks for
  blend shapes (`ctx.face`: the skinned GLB, the Godot pack's figure); the World page's payload is as before.
- Exported: the skinned GLB writes one sparse POSITION target per corrective after the face's, named by its id, its rest
  weight in `mesh.weights`, `mesh.extras.correctives` the drivers and joints for an engine that drives them, and every
  clip a LINEAR weights channel with the weights its poses drive (merged with the face's STEP track, each drawing held
  to a millisecond before the next), so Godot, Blender and Unity play them with the clips. The T-pose (engine skeleton)
  export leaves them out. Without correctives every byte is as before.
- Lit: under the lit GLB (`lit: true`) the realistic body's pack carries the studio weld's normals per corner and no
  baked shade (`packLayeredRig({ engineLit })`), and the skinned writer writes those normals, so the engine shades one
  smooth skin, once (it had the facets' normals and the bake's shade under its own). Every other figure as before.

### Realistic body: the feet on the form field

- The realistic body's feet (`footR/L`, `toesR/L`) re-sampled onto the form field: the foot and the toes are limbs of
  the builds (body-relational-builds.js `foot`, `toes`: the heel, the arch's two columns, the midfoot and the instep,
  the ankle's two bones, the ball; the big toe and the four), on one field with the shank's own skin, so the ankle
  flows out of the shank's last skin with no step. New module `body-relational-feet.js`.
- The sole is flat on the ground the authored shoe stood on (the masses set so their lowest sinks past the rim's
  rounding, then cut), so the gaits plant it where they did; the medial arch stands off it.
- The foot is re-sampled as a SOCK: level rings round the ankle turning down the instep to stand square to the foot,
  the heel the bend's outside; the toes in planes along the toe line, the big toe's tip on the field. The shank's skin
  shows over a level `0.25 W` over the ankle's joint, the foot's under it, crossing there as the knee's chain does.
- The bind: the foot's points near the shank's skin, or over the level, carry the shank's own shares at their height,
  so the two skins move as one through a gait; the toe base is a hinge band (the foot's bone and the toes').
- The physique reaches the feet barely: bulk and weight grow the foot's soft masses by a twenty-fifth at the dials'
  ends; height scales them with the rest.
- Every other part of the slice is byte for byte as before (norrin and shalla, athletic and jacked); the dials gain the
  feet's new station ids. A slice costs about 2 s more.

### Realistic body: the relational head

- `head: 'relational'` on the realistic hero (`form: 'realistic'` only): the relational head (head-relational.js) worn
  as recipe content, fitted to the landmark head it replaces (vertex to menton, the ear canal at its depth), sampled by
  rays from one centre into two parts that share the mouth's ring (`jaw` and `cranium`, their caps the mouth), sealed
  to the neck: the neck ends on a ring wholly under the head and the jaw part starts on that ring. The lower face is
  bound to the rig's jaw bone, its hinge moved to the head's condyles, so the mouth opens. Bald.
- The face sampled from its own direction: rays from one centre grazed the nose, the lips and the lids, and the face
  read stair-stepped. The cranium and the jaw are now sampled on the head's BARE field (head-relational.js `bare`: the
  skin wave without the nose, the lips, the eyes or the ears), let down under the face. The face is parts cast along
  its own look onto the whole field (the dermis study's graft read through the same grid): the `visage`, rings about
  the mouth (the lips run along them); the `nose` and the eyes (`eyeR/L`), rings following the nose's outline and each
  eye's opening, so the wings' creases and the lids' margins run along the rings, not across them; each sunk under the
  next where they hand over (the body's handover), the eyes painted. The ears are their own parts, a tube up each ear
  on the ear's field (`earFields`). About 19k vertices for the head; the swap takes about 50 s once (then kept).
- The head shades by its FIELD, not its facets: each part's stations carry `normals` (every point's unit gradient of the
  field it was sampled from), and the shading takes a part's authored normals where it has them, carried onto a posed
  face by that face's own rotation (station-loft-shade.js `authoredNormals`; the world, the lit export and the lit
  pieces all read `layeredShadingNormals`). Where the parts hand over, each let down under the other by a slope, they
  shade as one skin (the lines round the nose and under the eyes read as wrinkles at full-figure scale); the lids' and
  the nose's wings' blends, finer than the rings, read smooth. A part without `normals` shades as before, every byte.

### Realistic body: the dermal skin on the body

The lit GLB of a realistic hero (`export_model`, `format: 'glb'`, `lit: true`) carries its albedo as the base colour;
the other maps (roughness, translucency, hair) stay on the dev path.
The dermal texturizer's maps on the realistic body (`form: 'realistic'`, docs/realistic-body.md), so its head and its body
wear one skin. `epidermis/dermal-body.js`:

- The body's UVs from its own grids: each skin part (the re-sampled torso, neck, pelvis and limbs; the authored hands,
  fingers, feet and toes) unrolled from its stations × slots into an island at its true size, one texel density over the
  body, v down the rings' centroids (the caps' poles past the ends), u the arc round each ring from its SEAM, where an
  artist cuts: the trunk, the neck and the pelvis down the back, the arms and the legs down the inside, the hands and
  the feet along the inner edge. Each grid point's address is its slot's turn (`front` anterior, the left limb the
  right's mirror, slot for slot) and its station's run; packed by the head's packer (`packRects`, shared out of
  `layoutDermis`).
- The maps painted by the head's painter (`paintIsland`, shared out of `paintDermis`, the head's maps byte for byte):
  albedo, roughness, translucency, hair density and flow, fuzz, the relief tiles' index and the occlusion each part's
  own folds cast (broad, gentle and eased over each point's neighbours, the cage being coarse), written by
  `dermalPngs`. The inner arm's pale skin turns from anteromedial to the forearm's flexor side across the elbow, so the
  two parts meet in one colour. The palms and soles glabrous; the body's terminal hair sparse by default (the
  male's at half the preset's), its tracts the pole's (the forearms, the shins, the chest, the axillae); the neck's
  beard, the chest's patch and the belly's trail fade in with their regions instead of starting at a line, and a body's terminal tract blends across its edge.
- The neck meets the head: its top eased over its upper third toward the tone of the relational head's lowest skin
  (`neckTone`).
- The body-part map (body-relational-map.js) read in: each point of the chart carries its `bodyPart`
  (`bodyDermis`'s `partMap`), and the limbs' seams run through its `hidden` patches (the skin inside the trunk's), so
  the cut is where nothing shows; the study draws the parts on the skin.
- For the export: `bodyDermis(mesh, recipe, { dermis, sex, page, neck, partMap })` → `{ chart, layout, uv: { faceUV, corners,
  vertex }, maps, dermis }`, and `unweldSeams(faces, corners)` to split the seams into one UV a vertex.
- In the export (`epidermis/dermal-hero.js`): `heroDermis(mesh, recipe)` charts the hero's whole skin, the body's
  page and the head's, the minted head read back by `recipe.headFit` and charted on its sphere with its marks
  (`dermal-head.js` `headChartOf`, whose `shownAt` keeps the layers let down under the face from casting occlusion);
  `heroSkinPaint` composes the two albedos on one atlas, the body's over the head's, and hands the figure's pack the
  paint skin-paint.js hands it (each skin face's corners on the atlas, every other face on a white texel, its colour as
  before). The world kind wears it on the realistic hero's lit pack. A garment, an eye's globe and the mouth keep their
  colours.
- The eyes lane: `/dermis-study --body [male] [female] [--physique <word|json>] [--body-page N]`: the realistic body
  textured and lit with the relational head grafted on it (its own atlas and hair), its map's kinds, its channels on the
  shape, the neck close, and the body's atlas pages.

### Dermal texturizer: skin and hair laid out on the realistic register's body

In progress (a dev path: no minted hero changes, no tool surface). The epidermis cube carried from the head to the
body: the skin's layout and the hair it grows, read from an ADDRESS so the shape stays separate. `epidermis/dermal-chart.js`
is the shape's contract (a canonical part, `along`, `around` anatomical, the tangents), with the hero's cage and any
ring-stack body as adapters; `dermal-map.js` lays regions, the painter's colour zones, roughness, translucency, Langer's
lines and hair tracts by a few dials over the egocube's tones; `dermal-texture.js` bakes them to a per-part atlas (seams
on the hidden side, the face weighted up, the scalp paint and the stubble's follicles) with tileable relief tiles;
`dermal-hair.js` grows body hair lying on the skin and scalp locks as clumps on the elastica's guides (curl types
straight to coily, the coil's shrinkage, frizz, ragged tips, flyaways, cards). The realistic head is its shape:
`dermal-head.js` charts the relational head (its field surface-netted and welded, the globes off the skin) and hands
its relations to the map as marks, so the hairline, the nose, the lids, the cheeks, the lips and the beard's line are
laid from the trichion, the nasion and pronasale, the canthi, the cheek points, the stomion and the porion. The ear is its own feature: no beard or hair
grows on it. The scalp is COMBED: one smooth comb over the head (never across the part, which runs over the top only),
guides walked along it lifted off the skull for volume and hung by the elastica where the head turns away, waved in
phase along the flow so a type's crests run across neighbouring locks as bands, and every strand interpolated from its
nearest guides on its own side of the part, so strands run parallel. The CUT is the stylist's: a perimeter line (a
level the head's relations name, the jaw, the shoulder, the collarbone, cut blunt, a-line, stacked, v or u) where each
lock is combed down, cut where it crosses, regrown at that length and cut again so its end lands on the line; a clipper's
taper by the root's rise over the hairline; a shelf (an undercut); layers (no lock longer than this from its root);
point cutting off the line. The library's cuts: buzz, crop, short (tapered), undercut, bob, angled, shoulder, long,
layers. EDITS BY CLUMP NAME: the anime figure's clumps (fringe-1…7, the temples, back-1…11, the crown) as addresses on
the scalp, each edit (`length`, `sweep`, `lift`, `over`, `stand`) reaching the guides about its seat with a soft falloff
so the comb stays one field; the anime traits ported as MOVES over a groom (sleek, voluminous, messy, heavy-, short- and
swept-bangs with the fringe's own cut line, peekaboo, side-parted, flipped, ahoge, chunky). CREATOR LOOKS (`dermal-looks.js`): the realistic head stylized as
a game's character creator draws one, as data over the existing readers: `GAME_FACE` relations (a firmer skin wave, a
heavier brow, cheekbones forward, a squarer jaw, deeper-set eyes) and archetype presets (warrior, shieldmaiden, scholar,
rogue, elder). The dermis takes the creator's sliders: `lines` (the forehead's, the frown, crow's feet, the nasolabial
fold, under the eyes), `dirt` (grime in the cavities and in blotches) and `paint` (war paint: eyes, stripes, band, chin,
mask, in woad, soot, ochre, chalk or blood), painted per texel from the face's landmarks. The atlas bakes OCCLUSION read
from the mesh (`meshOcclusion`, any shape) into the skin's colour. The relational head's chart is spherical about a
centre at the ear's height (`headSphere`), so its undersides keep texels of their own, and what the head closes over (the
teeth, a nostril's inside) is marked `enclosed`: no hair, no bake. PEOPLE OF THE EGOCUBE'S ANCESTRIES
(`readAncestry`): rolled inside each ancestry's own ranges (tone, undertone, hair colour, texture), the texture worn as
the scalp's type in a style that suits it, the eye note through the ancestry's own derive (`sculpt.lidCover +`: the
lid's cover, rolled among `EYE_SHAPES`: an in-fold crease tapering into the inner corner, a monolid, a parallel crease, a
hooded lid; never a slant), the face's structure the
individual's. AFROS: a `stand` dial (the root leaves the scalp toward its normal) with coily hair's spring and shrinkage,
an `envelope` cut rounding it to an ellipsoid, a nape taper; `twa` close to the head; `curls` hanging in ringlets. The hair
shader's highlight scatters with a coil's roughness and its mass shadows itself (a coil's interior dark); the skin
reflects 4 % at every tone, so a deep skin's sheen carries its form. TIES: a tie anchored on a clump's seat (or an azimuth
and a rise) gathers every root, the top section or those within a radius of it; each gathered lock is combed taut over
the head to the tie and arrives at its own slot round the band (the side it came from), so nothing crosses; one bundle
hangs from the tie (the elastica's lock, flaring then tapering, its ends ragged), a bun coils it about the tie, a braid
plaits it in three (each bundle a figure of eight across the braid a third of a turn apart, bound, a brush past the
band). Styles: ponytail, high-ponytail, bun, braid, half-up; the move `temple-braids` (the Nordic braids). The relational eye rig takes
the eye's cover as channels: `creaseHeight`, `creaseShape` (parallel … tapered into the inner corner), `epicanthus` (the
upper lid's skin laid over the inner corner) and `fullness`; each at rest leaves the eye as it was. THE EYES' BASELINE re-measured against the adult norms
(Farkas; MRD1, MRD2): they sat close (the inner canthi 27 mm apart, the pupils 55) and stared (the upper lash line 7.9 mm
over the pupil, 2 mm of white above the iris, the lower lid over its foot). The rule of fifths now reads against the face's
width (`fifths` 0.215) with the inner canthi a little wider apart than an eye (`intercanthal` 1.12): en-en 33.0 / 32.3 mm,
ex-ex 92 / 90, the pupils 62.6 / 61.2, an eye 31 mm wide. The fissure is split at the pupil by a relation (`lidSplit`
0.32 of `fissure` 0.036 above it), so the upper lash line rests 4.4 to 5 mm over the pupil, over the iris's top, and the
lower 5.3 mm under it at its foot: a neutral eye. The relational head is a dev path (no minted row reads it); a lash whose
root cannot be laid within 2 mm of its lash line is dropped. The bands
are returned for drawing. Seen through `/dermis-study --look`, `--ancestry` and `--lineup`.

### Realistic register: a stronger body for the hero

The third point on the hero's style gradient (anime → cartoon → realistic), as western games draw a person: accurate
shape generated relationally (the relational head's method carried to the body), depicted through the hero's cage so
every reader of its stations, slots and body chart keeps working, with the relational head joined on at the neck.
Opt-in and versioned: a default hero keeps its bytes.

- **The stretch audit** (`hero-stretch.js`, `scripts/hero-stretch.mjs`). The hero's shell read ring by ring through
  the studied gaits (walk, jog and sprint over their cycles) and the stand's gestures, against its bind: each closed
  part's station is a ring of its slots, measured for its area and its narrowest slot (a joint's collapse), its twist
  away from its heaviest bone (the blend lagging the bone), and the BAND of skin from it to the next ring, slot by slot
  (a crease's compression, the far side's stretch, folds through itself). Each ring keeps its worst frame, and the knee,
  elbow, hip and shoulder are gathered as regions. The bands carry the read: the hero binds its knee and elbow rings
  rigidly to fold bones, so a ring keeps its area however far the joint bends, and the joint gives in the skin between
  rings. The baseline, male (female alike within a few hundredths), on the gaits as minted now (the swing foot
  following its leg, below): the hip's band stretches to 2.5× its rest length in the sprint and compresses to 0.67 in
  the walk, the knee's to 2.15× and 0.65, the elbow's to 1.6× and 0.75 in the guard; the shoulder's top ring loses a
  quarter of its area in the sprint and twists 9° off its bone in the relaxed stand; the foot's rings keep a third of
  their area and the ankle's ring twists 21° (male) to 39° (female) off the shank at the sprint's curled foot. The SEAMS, where one part's tube is tucked into the
  next (the groin, the armpit, the elbow, the knee, the neck), read whether the child's end ring stays inside its
  parent: the groin and the armpit hold through every frame (the hip's and the shoulder's give is all in their bands),
  while the elbow's and the knee's open: at the hand-on-hip's bent elbow the forearm's tucked slots come 41 mm out of
  the upper arm, and at the sprint's knee, folded as far as the gait means it to (130°), the shank's top comes 41 mm
  out of the thigh.
- **The swing foot follows its leg.** In a hero's walk, jog and sprint the foot in its swing was held level with the
  floor (the toe placed, the ankle rebuilt at the standing heel), so as a run's recovery folded the knee the toes
  pointed forward, and as the knee drove through they were pulled up against the shin. With the hero dial `swingFoot`
  (stamped on every hero gait minted now, the walk's `HERO_WALK` and the run's new `HERO_RUN`; a hero stored before keeps
  its level foot, byte for byte) the swing foot rides its shank at the ankle's standing angle, square to it, eased in
  over the first 30% of the swing and handed back to the flat landing over the last quarter: the tucked foot points out
  behind, and comes round under the knee as it drives through. The rig takes a new channel, `toeTurnL` / `toeTurnR`
  (degrees the toes turn about the ball with a targeted foot; absent, level as a push-off needs), so the swing foot's
  toes turn with it, never hooked back level, cut short where their tip would dip under the floor. The recovery now
  folds as far as the gait means it to (the sprint's `swingTuck`: the level foot had held the knee shallower). Through
  the sprint and the jog the swing ankle stays within 3° of its standing angle; no toe goes through the floor, and each
  gait's speed is unchanged.
- **The shoulder line, hero laws 2.** The hero's shoulders read shrugged: its girdle already declines (8° male, 11°
  female, the casts' `shoulderDrop`), but the trapezius met the neck's side 8 cm over the shoulder joint and the neck rose
  out of it like a post, plainest from behind. Hero laws 2 (`HERO_LAWS_VERSION` 2, hero-form.js `SHOULDER_LINE`) lifts
  the torso's top ring, the neck's root, at its sides and back (its front stays at the sternal notch; the top cap's tip
  rises with it, the cage staying closed on every cast), so the trapezius
  climbs the neck in a concave curve and falls to the acromion at about 27° (male) and 34° (female) from the neck's side.
  Every hero on the structured core reads it, so every one minted now is stamped `laws: 2`; a row minted before (stamped
  laws 1, or unstamped, as a world's inline hero re-recorded on each render is) builds its plan and recipe byte for
  byte, pinned. Garments that reach the shoulders follow the new line on a hero minted now (the outfit laws' ring pins
  re-pinned as a body change; their expansions unchanged). The legacy vajra figure's girdle (figure-vajra.js `CLAVICLE_DECLINE`) and its body chart are left as
  they are: the hero reads neither. `body-study` takes `--laws` to render a hero as minted under an earlier version.
- **The leg set, hero laws 3.** In profile the hero's thighs stood forward of the trunk and its seat out behind: the hip's
  joint sat 2 cm under the groin's skin (the femur's head sits 5 to 6 cm deep, a little forward of the pelvis's middle).
  Hero laws 3 (`HERO_LAWS_VERSION` 3, hero-form.js `LEG_SET`) turns the leg back about the ankle: the hip's joint set back
  into the pelvis by 3.5 % of its height (3 cm on the male) and the knee by its share of that, so the knee keeps its bend
  off the line from the hip to the ankle. The bend stays because the motion reads it as the leg's slack: set straighter
  (the knee to the line's share of a plumb thigh), the leg came within 1 mm of its full reach and the feet's IK clamped,
  planted feet slid in the jumps and rolls, a stop overran, a cloak met an arm. Every hero on the structured core is now
  stamped `laws: 3`; a row stamped 2 or 1 builds byte for byte, pinned (the gesture, the shading and the anime pins each
  keep their laws-2 values beside the new ones); the outfit laws' rings and the statues re-pinned as a body change.
- **The leg length, hero laws 4.** Measured against the body's own ratios (ANSUR II), the hero's hip's joint stood at
  0.49 of its stature (the body's 0.52), the femur at 0.23 (0.245) and the trunk from the shoulder's joint to the hip's
  at 0.30 (0.28): short legs under a long lower trunk. Hero laws 4 (`HERO_LAWS_VERSION` 4, hero-form.js `LEG_LENGTH`)
  lengthens the leg by 5.5 % of the hip's height over the ankle (55 % of it in the femur, the rest in the shank) and
  shortens the lumbar by the same run, so the hip's joint comes up 4 to 5 cm while the navel joint, the shoulders, the
  neck, the head and the stature stay. On the hero proportions' adult casts only: a child's and the anime and herobot
  casts' proportions are their own. Every structured-core hero is now stamped `laws: 4`; a row stamped 3, 2 or 1 builds
  byte for byte.
- **The arm length, hero laws 5.** Read in Leonardo's figures (the body lane's `--vitruvian`), the hero reached 1.08 to
  1.09 of its stature fingertip to fingertip (Leonardo's 1, the body's about 1.03) and its fingertips passed his circle by
  7 to 10 cm. Not the trunk's breadth nor the thighs (the shoulder's joints 0.20 of the stature apart, the femur 0.245,
  as the body's): the humerus stood at 0.189 of the stature from the shoulder's joint to the elbow (the body's about
  0.165) and the forearm at 0.161 (0.146). Hero laws 5 (`HERO_LAWS_VERSION` 5, hero-form.js `ARM_LENGTH`) shortens the
  upper arm's dial by 0.88 and the forearm's by 0.91 on the casts the leg length takes: the span 1.01 and 0.99 of the
  stature on the realistic slice's builds, the middle fingertips on the circle with the arms raised to the head's top.
  A row stamped 4 or before builds byte for byte; the anime wave's raised elbow reads its drop as a share of the humerus.
- **The moves follow the body they were built on.** The leg set and the arm length moved joints the vaults and the guards
  were tuned on. A step vault's trailing foot, its leg set back by laws 3, dragged over the far edge (a male's clearance
  lift 0.091 m, the law 0.08); a guard's hilt, placed in fixed metres off the trunk, sat past the reach of an arm
  shortened by laws 5, the wrists bent past their ease. A hero stamped laws 3 or later vaults on the step vault's own
  `legSet` words (the trailing knee tucked 125° where it was 115°: lift 0.040 m), and one whose arm took laws 5 holds
  every guard drawn in toward the shoulders by its arm's shortening (hero-form.js `takesLegSet`, `takesArmLength`,
  `armReach`, which `heroPlan` itself reads). A hero minted before them, as everything 3.1.1 shipped was, gets
  neither: its clips as they were.
- **A boot under a skirt.** A garment piece is lifted over every garment already worn on its part, and a skirt (a hull
  round the hips and both legs) counts as worn on the shank: a boot's shaft worn after it was lifted round the skirt's
  whole hem, a ring 21 cm across round both legs (the operative's card read as a bell for it). A piece on a shank, a foot,
  a forearm or a hand now goes under a hull hung round several parts (body-garment.js); a piece on the trunk still
  clears it.
- **The body lane** (the `body-study` skill). The hero's body as an engine gets it, the skinned cage shaded smooth,
  from the front, the front ¾, the lateral, the back and below; rows posed at the bind, a gait at a phase, a stand
  gesture or a raw rig pose; crops at the torso, shoulder, hip, knee, hand, foot and the neck's seam, framed on the
  posed joints; and at the bind a sections panel (the trunk cut level at the neck, chest, waist and seat, the right
  limbs square to their bones) with each girth as a tape reads it, and a measures table (stature, heads tall, the
  shoulders' and hips' breadths, the girths). `--tint` colours each part its own (which shell shows where two hand
  over), `--parts` keeps only the parts a pattern names, and `--vitruvian` adds Leonardo's two figures, the front large
  in its square (the arms level: the span against the stature) and its circle as his note sets it on the figure's own
  joints (the legs opened to an equilateral triangle, the figure lowered his 1/14, the arms raised till the middle
  fingertips are level with the head's top; the circle on the navel, its radius the standing navel's height), with what
  each reads in the margin. The eyes gate beside the stretch audit's numbers: the sprint's knee crop
  shows the shank's top out of the thigh where the audit measures it. Baseline, male and female: stature 1753 and
  1664 mm, 7.15 and 6.79 heads tall; chest 107 and 88 cm, waist 84 and 64, seat 86 and 90.
- **The form field, a vertical slice** (`body-relational.js`; seen through `body-study --form`, not yet on the door).
  The body read the way the relational head is: bone where it shows (the ribcage's egg, the clavicles, the spine's
  column) and the muscle masses (trapezius, deltoid's three heads, pectoral, rectus abdominis in its segments, the
  obliques, serratus, latissimus, infraspinatus, erector spinae, sternocleidomastoid; biceps, brachialis, triceps,
  the forearm's flexors and extensors) placed from the hero's REST JOINTS in units of its half biacromial, so the field
  rides any cast and tune, summed into one skin (log-sum-exp: where two masses meet, a groove). The torso, the neck and
  the arms are re-sampled onto it, denser than authored (the torso 48 slots round, 37 rings), each slot on a ray through
  the authored cage's point, then relaxed onto the field (the neighbours' mean, projected back down its gradient) where
  a ray crossed a pocket; the bind follows the authored shares (per slot, and by zone on a hard limb), so the rig poses
  it unchanged, and the pectoral and bust parts give way to the field. The armpit is filled (the hanging arm covers it);
  the deltoid is shared by the torso and the arm and handed over along one cone above the armpit (the torso's skin the
  shoulder's cap, the arm's below it, set a few millimetres under the cap where it reaches in), so the arm grows out of
  the shoulder with no ledge; under the bust the rays come down from above to meet the fold. Two builds, a Silver Surfer-like body: `norrin` (male, lean and sculpted, the
  shoulders 10 % closer by the hero's own tune, the neck thin and flaring into the trapezius, the pectorals defined: the
  sternal head thickest at its lower border under its own tight blend, meeting its partner over the sternum) and `shalla`
  (female, the definition softer; the bust the hero's own breast field laid over the summed skin as a displacement, so
  its upper pole is the pectoral's slope, read as the Female Titan's in Attack on Titan: firm and high, set apart over
  the sternum, the apex rounded, the lower pole full over a clean fold; her torso on a finer cage, 64 by 49, for it). Every re-sampled part closes on both builds; deterministic. The lane wears
  the RELATIONAL head on it (head-relational.js, meshed and fitted vertex to menton, carried by the head bone), bald, in
  a matte silver-grey. The pelvis and the legs are on the field too: the SEAT, one mass round the pelvis (the operator's
  upside-down heart, seen from the front and from behind; a teardrop from the side): two lobes low on the hip's joints
  wrapping the hip from the front round to the glutes, the cleft and the crotch the dip between them, and a taper up
  the middle to the heart's point under the navel and on the sacrum, squashed front to back to the belly's depth, so
  the trunk is widest at the hip's joints and narrows steadily to the waist (a basin, a flank and separate glutes had
  made a shelf at the iliac crest); and the pubis. The SPINE'S CURVE (a build's `spine`): the back's surface carried
  forward at the lumbar curve and back at the thoracic, a warp of the field over the back half only, so in profile the
  lower back sinks in above the seat and the upper back rounds out (the trunk had stood as a straight column). The
  thigh (rectus femoris, vastus lateralis and the medialis's teardrop, the adductors, the hamstrings, the
  patella, and the SWEEP, the operator's: one mass spiralling round the femur from the hip's side under the glute, down
  behind the thigh and in to the knee's inside, the hamstrings and the adductor magnus as one form, so the thigh's back
  rises into the seat in profile and its inside reads full and tapering from the front; a limb's mass may be a `chain`
  of round cones bead to bead) and the shank (both heads of the gastrocnemius, the soleus, the tibialis anterior, the Achilles, the ankle).
  A limb's two segments share one field and hand over by the plane through the joint (each segment's own knee had met
  the other's in a step); the torso and the pelvis hand over by height. THE HIP'S JOIN: the pelvis ends at the crotch,
  and about one level a little over it the thigh samples the pelvis's own field (the body with the thighs' masses, cut
  at the midline), so the two skins meet on one surface; under the level the thighs take the seat's fold, the crotch
  and the groin, and the seat runs on round into the thigh (it had ended at the fold in a flat ring over the narrower
  thigh, and the seam had wandered in teeth across the thigh's front and hemmed the seat in a jagged line). Every
  handover is one crossing: each skin fades in from its line, a ring or so, with no gap between the two fades (a gap
  had left both on one skin, in a sawtooth at the waist, the elbow and the knee). The thigh is rounder and finer than
  the other limbs (32 round, 33 rings). THE LOWER TRUNK ON THE ANATOMY (a build's `lower` frame, bodyFrame): the
  rig's navel joint is a joint of the spine at the ribs' lower edge, and the slice had hung the belly from it, so the
  navel stood 7 to 9 cm high and the crotch hung 11 cm under the hip's joint: navel to crotch ran 0.225 of the stature,
  the body's own 0.125 (ANSUR II). Under the chest's middle every height is now laid by three knots, the navel 30 % of
  the way from the hip's joint to the shoulder's and the seat carried over the hip's joint, so the lower trunk rides
  the leg wherever it is; a mass's height stretches with the frame. The rectus abdominis re-laid for it, three
  segments down to the navel and one long sheet under it to the pubis. Navel to crotch is now 0.139 and 0.134 of the
  stature (norrin, shalla), the crotch 8 cm under the hip's joint. THE LIMBS' VOLUME (a build limb's `thick`): every
  girth had stood 10 to 28 % under ANSUR II's means (the calf and the upper arm most), the bellies ballooned off a slim
  bone; each limb is thickened across, not lengthened (the bone's cone and the bellies' round and out radii, the joints
  as they were, which thickened stood out as knobs), so the upper arm, forearm, thigh, knee and calf read 0.188, 0.167,
  0.335, 0.222 and 0.210 of the stature on norrin and 0.177, 0.147, 0.340, 0.216 and 0.207 on shalla. THE DELTOID RIDES
  THE ARM: the torso's cap over the deltoid had been bound to the trunk and the collarbone and the arm's top half to the
  collarbone, so a raised arm swung up out from under its own deltoid and left the cap hanging at the side like a pad.
  A point's share of the upper arm's bone is now how near it lies to the deltoid's heads, read the same by the cap and
  by the arm's top under it, so the two move as one; none under the armpit, whose folds follow the arm and whose flank
  does not. THE GIRDLE RIDES THE COLLARBONE: the rig lifts the collarbone with a raised arm (the shoulder's joint 5 cm up
  at the arm level, 6.4 overhead), but the torso had given it half a share or less in one band of rings, so the joint
  rose under a shoulder that stayed down. The skin over the girdle (the collarbone, the acromion, the trapezius's fall,
  the scapula's top) is now bound to it by its nearness to the bone, none inside the bone's sternal pivot (rising, it
  turns that side down, and the neck's root split): a raised arm levels the shoulder's top from the neck to the arm.
  The deltoid's share of the arm's bone runs by how far down the humerus a point lies too, none above the joint (the
  deltoid's origin on the acromion and the collarbone stays with the girdle): the whole cap on the arm's bone had swung
  its top in and down about the joint and its side up, a trough over the collarbone and a hump over the arm, against
  the level line of Leonardo's figure. THE ARM IN: the body's breadth is the build's own (`frame`), so the hero's
  `shoulders` tune brings the arm in over a body that stays, the masses it hangs from (the girdle, the collarbone, the
  trapezius's fall, the armpit, the pectoral's tendon: `joint`) drawn in with it. Norrin's arms 20 % in over a body 10 %
  narrower than the hero's, shalla's 8 % over her own: the shoulder's joints 0.205 and 0.194 of the stature apart
  (0.231 and 0.211 before; the body's about 0.20), the deltoids 0.283 and 0.269 across, the pectoral running into the
  shoulder with no ledge between. THE GROIN STRETCHES: a point's share of the thigh's bone by how far down the femur
  it lies (none at the hip's joint, the groin, the crotch and the seat's fold; through the rig's hip fold bone, which
  turns half the leg's swing; wholly a hand's breadth down), read the same by the pelvis and the thigh's top, so an
  opened leg stretches one skin (the thigh's top had been its bone's from the first rings: opened, its root swung away
  from the pelvis in a notch at the crotch, the seat's edge left a shelf); and the adductors' origin, a mass high on
  the thigh's inside, gives the stretch its stuff (the inner thigh's top had pulled across the crotch in a thin web).
  THE KNEE AND THE ELBOW BEND AS ONE SKIN: across a band either side of the joint, the upper segment's and the lower's
  points alike take the upper bone, the rig's fold (turned half the bend) and the lower bone by where they lie, so the
  two shells handed over at the joint's plane move together (the sprint's deep knee had swung the thigh's end out from
  under the shank behind the knee, a lobe with an edge); the shoulder's share of the arm's bone eases over a wider
  band (one narrower folded a ring at the joint's height in the arm's fore-and-aft swing) and the collarbone's fades in
  further off the neck (a swinging arm opened a notch at the neck's root). Read by the stretch audit (hero-stretch.mjs
  `--form`) against the authored hero over the stand, the gaits and the gestures: the elbow's seam opens 11 to 15 mm at
  worst (the authored 20 to 41), the groin's not at all; the knee's back pinches to 0.6 of its ring in the sprint, where
  the authored hero's seam opened 36 mm. THE DEEP HINGE'S CORRECTIVE: beside each knee's and elbow's fold, which pushes
  its head to the bend's outside to keep the kneecap's and the elbow's point, a crease bone turned the same half the
  bend and pushed not at all takes the bend's inside (a point's middle share split between the two by its side of the
  limb, eased round it), where the fold's push had drawn the skin in toward the bone: the sprint's knee pinches to 0.82
  of its ring at worst, and the bent elbow's inside stays full. The rig carries the two helpers (`kneeCrease<S>`,
  `elbowCrease<S>`) as bones an engine skins with. THE NECK STANDS ON THE SHOULDERS, not on a pyramid: the core's
  column and the ribcage's dome had reached 6 cm up inside the neck, and the base's wide blend filled from them to the
  neck in a tent, the neck's silhouette widening from under the jaw straight down to the shoulder at 40 degrees; the
  column now ends at the thoracic inlet and the dome under it, and the upper trapezius leaves the neck's side lower
  (it had begun at the jaw's height), so the neck is a column to its root and the trapezius falls from it at about 30
  degrees to a shoulder that stands where it stood (the collarbone was already nearly level: the slope was the fill).
  THE RAISED ARM LEAVES THE SHOULDER ROUND: a fold at the shoulder (the rig's helper turned half the arm's swing, as the
  hip's, `shoulderFold<S>`) carries the arm's own top from the collarbone to the arm's bone, where it had gone straight
  from one to the other and a raised arm's root pinched to a point at the armpit (its ring 0.55 of its rest, now 0.84;
  its band 0.09, now 0.53; its folds gone); and a skin share that would make a fifth bone on a vertex now drops the
  weakest instead of the share, which had vanished for one ring of the torso under the arm and come back on the next,
  a step where the deltoid's ramp was meant. Hands behind the head is hittable: the forearms reach behind the skull
  on the shoulder's roll (the elbow's hinge alone folds them forward, across the face). The stretch audit takes
  `--poses` (rig poses, `--only` for those alone). THE ELBOW NEVER TWISTS: the forearm is framed from the upper arm's
  frame by the elbow's bend alone (a rig bone's `parent`: its frame the parent's, then the shortest turn from its rest
  line carried there to its posed line), where each had taken the shortest turn to its own line and the two disagreed
  about their roll by as much as the arm had swung: forearms behind the head wrung the elbow 47 degrees (now 14) and
  pinched its ring to 0.51 (now 0.59, the deep bend's own), the arm's creased edges in that pose 306, now 162. Framing
  the arm by the shoulder's roll instead was tried and left: blended skin could only lose a roll of up to 110 degrees
  in a candy wrapper at the shoulder or a spiral down the humerus. THE SHOULDER ROUNDS INTO A RAISED ARM: the torso's
  cap over the deltoid follows the arm's own top (from the collarbone through the shoulder's fold to the arm, by how far
  down the humerus it lies), where it had gone to the arm's bone outright and a raised arm folded it up beside the arm's
  root in a horn, the shoulders square with both arms overhead. THE BICEPS AND THE TRICEPS LINK INTO THE SHOULDER AND
  THE ELBOW: each a chain where each had been an egg at mid-arm, the biceps from the socket's front under the deltoid to
  its peak low on the arm and its tendon into the elbow's crease, the triceps' long head from the shoulder blade behind
  the joint, fullest high on the arm's back, to its tendon at the elbow's point (the arm's front had dipped under the
  deltoid and the back fallen away from mid-arm; the girth now 31.8 cm a tenth down the arm, 29.4 before, the most 33.7).
  THE SHOULDER GIRDLE IS A MECHANISM: a scapula (the acromion and the blade's two angles, `scapula<S>`) the vajra turns
  upward by the scapulohumeral rhythm (past the first 30 degrees of raise one degree to the humerus's two and a half, at
  most 60, about the blade's own normal through the middle of its spine; `SCAPULA_POINTS`), the glenoid riding it, so the
  shoulder rises because the blade turns and the collarbone's lift follows; a rig without a blade lifts the shoulder by
  the collarbone alone, as before, to the byte. At 170 degrees of raise the humerus stands 115 in its socket (the body's
  most is about 120), where it had stood the whole 170 in a socket that never turned. The arm's root and the shoulder's
  fold turn from the blade, over a band 8 cm down the humerus (16 before): raised overhead, the arm's upper third had
  sagged off its bone by up to 4.5 cm, now 1.0; the arm's root ring 0.84 of its rest, now 0.93. body-study `--bones` draws
  the spine, the collarbones, the blades, the humeri and the forearms over the shell. THE PAULDRON: what a raised arm
  bunches over the shoulder, masses of the form field like the rest (the build's `pauldron`, in stages: a water bag
  over the blade, narrow at its top and full at its foot, so it hangs as the trunk stands; the trapezius's cap over the
  shoulder's top, a plate a third as deep as it is wide, so the front and the back see it and the profile hardly does;
  the deltoid's top bunched over the joint, late in the raise, sampled into the arm's top too, the corner a raised arm
  leaves by the head), never in the bind: the torso (and the arm) sampled again with each, the same rings and slots, the
  difference a corrective per side (`recipe.correctives`, an offset per point at full weight, the weight by the arm's
  raise between the stage's own degrees) that `correctiveRest` adds to the rest
  before the skin poses it, an engine's morph target (its export to come); the body study and the stretch audit pose
  through it. The skin over the shoulder's point and over the blade rides the blade, the collarbone its own inner run
  in front: all of it on the collarbone, a raised arm's shoulder top had floated over the acromion under it. Shalla
  wears the hero's pauldron, its masses 0.85 of his; her bust's fold is filleted in the field (`fold`, bust radii: the
  height eases in from flat, the apex kept at its projection), the fold's wall a corner the rings crossed on the slant
  in stair-steps. Only the feet are still the authored cage. THE PHYSIQUE: four dials over a build, each −1 to 1, 0 the
  build as authored (the athletic base, the build itself to the byte): `bulk` the muscles across and how proud they
  stand (the bones and the joints as they are; on the plus side the arms set out with the shoulders' muscle, the
  pauldron grown faster, the calf fuller, longer and higher over a soleus hardly grown (a high diamond over a long taper to a slim ankle), the thigh eased off toward the knee and its front and outer heads set higher (widest up top, not a barrel over the knee), the forearm full down to a wrist the size of hands a tenth bigger),
  `tone` the blends tighter or looser and the abdomen's and the serratus's relief, `weight` a layer of fat over the
  whole skin (thinning down the limbs to none at the wrist, the ankle and the head's base, and eased out between the
  legs, where it fused the thighs), the belly forward, the flanks, the seat behind, the neck; `height` the stature a
  tenth either way, by the hero's own tune. Words for points in it (`PHYSIQUES`): athletic, skinny, heavyset, jacked;
  `physique(build, word | dials)`, body-study `--physique`. Under a physique the crotch is sought no lower than 0.6 W
  under the hip's joint and the pelvis's rings hidden inside the thighs drawn in to a cone round it (thighs that nearly
  meet had folded them in a zigzag). Shalla's calf bellies run a third longer, one form from behind where they had stood
  as two beads. THE SHOULDER BLENDED OVERHEAD, with the pauldron: a raised arm had crumpled the torso's skin round its
  root into folds, and the torso's cap, a few millimetres over the arm's top at rest, stood through the arm's skin in a
  sawtooth of spikes. The slice is posed in two stages, the arms level and the arms overhead, each over the one before:
  there the torso's skin round the shoulder (by its share of the arm's and the girdle's bones, or its nearness to the
  arm) is smoothed over its grid (Taubin's two steps, no shrinking), a point on or through the arm's skin sunk under it,
  and the change carried back to the rest through each point's own skinning map (linear blend skinning is linear in the
  rest point), a corrective per side and stage (`shoulderLevel`, `shoulderOverhead`) over the raise. The shares round
  the arm's root are eased over the grid as well. The edge where the arm leaves the torso is one curve now; a few slivers
  stay deep in the overhead armpit, and the level arm's own root still pinches to a point under it. THE SLICE FASTER, to
  the byte: an athletic slice took 54 s (Norrin) and 94 s (Shalla), now 9.4 s and 12 s, the recipe the same byte for
  byte. The field's masses read without arrays (the same arithmetic in the same order; the allocations were most of the
  cost); the march reads a sample only where the field has not settled it (a sample `f` leaves the skin at least
  |f| / 8 away, so the nearer samples' signs are known: the same samples decide); the crossing within the step found
  by false position (Illinois), a handful of reads where halving took thirty; and a pauldron's stage casts again only
  the rays its mass reaches, the relaxing run over them and a margin round them (`resamplePart` `reuse`); the shoulder's
  blend finds the arm's nearest vertex from a grid, not every vertex; the field's sums read into kept buffers. Then
  faster again, a few points moving: 5 s (Norrin) and 7.7 s (Shalla). The relaxing's projections read the field's
  gradient forward from the value, three reads where centred took six (centred still for a ray's fallback and the
  pelvis, where at the crotch's level the skin's two walls stand close and the cheaper read settled rings on the other
  wall); the march's slope bound 4 (at 2 the shank's masses broke it); a pauldron's stage relaxes a band narrower each
  iteration; the shoulder's blend compiles the torso and the upper arms alone. Of Norrin's 9,428 points 4 moved over
  0.1 mm (0.11 the most); of Shalla's 11,316, 22, and 2 over a millimetre, in the fold under the bust, where a point
  settles a few millimetres along the crease either way (the fold reads the same).

### Science worlds: a demo composed from laws, not authored per experiment

- `create_view` gains three kinds that compose a demo from a closed table of laws instead of
  one hand-authored experiment per kind: `classical` (Newtonian laws, body scale to orbits), `microscopic` (cells
  down to molecules; DNA is the floor) and `quantum` (states in concept space, faithful to the model and claiming
  nothing about reality; it supersedes `atom` for new asks). Chemistry goes to the scale its explanation needs.
  A recipe has two halves: a `model` that is dimension-checked, machine-gated and measurable through
  `measure_view`, and a `dress` that only sells the picture, light and explorable on the interactive page,
  choreographed with timed callouts on film. Every exaggeration is a declared liberty the page shows. A law the
  table lacks is named as a gap, never approximated silently.
- **The classical solver** (`lib/graph/science-worlds/`). A table of
  laws (uniform and universal gravity, springs, rods and ropes, linear and quadratic drag, buoyancy, Coulomb, the
  Lorentz force, planes with restitution and friction, sphere collisions) composes a model; the solver picks velocity
  Verlet or RK4 and a step from the fastest motion, runs it, and checks it: energy conserved (or never gained when
  something loses it), momentum and angular momentum where nothing outside acts, rods held, no tunnelling, and the
  textbook answer wherever one exists (a projectile's apex and range, a spring's and a pendulum's period at any
  amplitude, a Kepler orbit, a cyclotron turn, terminal speed, a slide down a ramp, a head-on collision). Two regime
  checks say when a model has left Newton's ground: near light speed, or a wavelength as large as the path. Units are
  read with their dimension, so a mass in m/s is an error. `machina/quantities` gains charge, temperature and amount,
  and the units the sciences use.
- **`create_view({ kind: 'classical' })`**: the solver as a door. The recipe (`params: { model, dress?,
  liberties? }`) is stored as given and solved again on every render; the mint returns every gate with what it wanted
  and what it saw, and says nobody has looked yet. The page plays the run on equal-time samples (bodies, their trails,
  optional velocity and acceleration arrows, rods, ropes and springs as bars, surfaces as patches) with a system
  readout (the model's own clock, kinetic and potential energy and the total, momentum when nothing outside acts, the
  speeds asked for) and a **What's real · what's drawn** panel: the laws, the checks and their numbers, what the model
  leaves out, and every liberty, the drawing's own included (a scale other than a metre per unit, a body drawn larger
  to be seen, time sped up or slowed). The readout and panel are a new opt-in page block (`scene/channels/science.js`)
  that adds nothing to a page without it. `measure_view` reads a classical world at tier `si`: every body's samples
  and the system's energy, momentum and angular momentum. The `classical` vocab card prints the law and closed-form
  tables from the code (`node scripts/science-cards.mjs`; a test fails when they drift), and its worked examples are
  tested to hold. The same setups composed from the table agree with the mechanics kind (a projectile, a wide
  pendulum, a spring, a rough ramp) and the orbit kind (an ellipse's period and apsides) to a thousandth.
- **The film.** A classical world proposes its own film when its recipe has no shoot plan: a wide shot of the run,
  a close replay of the key moment slowed down (the sharpest change in motion, such as a bounce or a collision, else
  the fastest moment), and an end card that is the honesty panel held on the last frame; `forge_motion` with
  `shot: { motion: 'plan' }` renders it to MP4 or GIF. The film dress (`dress.film`) adds callouts on the model's own
  clock (a caption, or one pinned beside a body), picks the replay's moment and speed, or drops the replay and the
  card. Slow motion is tagged on screen while it plays and listed on the end card; the interactive page never shows
  the film dress, and the film never shows the panel. Any world kind may now propose a film (`defaultShoot` on its
  payload); a recipe's own shoot plan always wins.
- **A shot's `speed`.** Shoot plans gain a time stretch per shot (`speed`, 0.05 to 4): `{ span: [2, 3], speed: 0.25 }`
  is a four-second slow-motion replay of one second of the world, on the World page and in renders alike;
  `set_shot { speed }` edits it. A plan without one is unchanged, byte for byte.
- **`create_view({ kind: 'microscopic' })`**: cells down to molecules, composed from a table of laws (Brownian
  motion with Stokes–Einstein diffusion, drift from a flow or a force, partially permeable membranes, reactions by
  mass action drawn exactly by Gillespie's algorithm in a well-mixed volume). A model is a box, its species (by count
  or concentration; each sphere may stand for many molecules, and the page says what that does to the noise) and
  their laws, run with seeded dice. It is checked: the spread grows as 6·D·t, a drift carries the cloud at v·t, a
  reversible reaction settles at its equilibrium constant, what no reaction can change stays exactly as it began, a
  species that crosses a membrane evens out in proportion to the volumes while one that cannot never crosses; and it
  says when counting stops standing for the volume (reactions outpace mixing) and when a model leaves the scale
  (inertia that lasts, a radius smaller than an atom, flow fast enough for wakes). Statistical checks allow four to
  five standard errors, so a sound run passes for any seed. An enzyme is two reaction rows (E + S ⇌ ES → E + P); an
  unknown law names its scale or what to compose instead. The page draws every shown molecule (up to 300) walking
  its recorded path, changing colour when it reacts, inside a see-through box with each membrane a lattice, counts
  in the readout; its film replays the first reaction slowed. `measure_view` reads every species' count, its count
  on each side of a membrane and its spread at tier `si`. The science readout became rows, shared by both scales,
  and the page helpers moved to `science-worlds/page.js`. `machina/quantities` gains concentration, rate constants,
  diffusivity and the small units.
- **`create_view({ kind: 'quantum' })`**: states and the rules they follow, faithful to the model and claiming
  nothing about reality. A world is one system: a particle on a line (an infinite well, a harmonic well, a
  rectangular barrier, a step, summed into one potential) stepped by Crank–Nicolson; the hydrogen atom's orbitals
  as the exact functions, each drawn as a cloud of points sampled from |ψ|² and coloured by the wavefunction's sign;
  spin-½ atoms through a chain of Stern–Gerlach magnets, each outcome drawn with its odds; unstable nuclei with a
  half-life. It is checked: the total probability and the energy stay as they began, a well's and an oscillator's
  levels, a two-level beat, a displaced packet swinging like a classical mass, a free packet's spreading, a
  barrier's or step's transmission averaged over the packet, an orbital's nodes, norm and mean radius and a χ² that
  its cloud follows |ψ|², each magnet's counts against cos²(θ/2), the measured half-life; and it advises when the
  waves are tiny next to the features, so a classical world would do. Every row carries its sources and the date it
  was last reviewed, and the page lists them. A quantum word that is not a row (tunnelling, superposition, bond)
  comes back as a gap naming the row that is or why there is none. `measure_view` reads each system back. It
  supersedes the curated `atom` kind for orbitals at the door (the routing cards and the atom card point there);
  the `atom` kind still renders. An atom's proposed film circles one orbital, or sways across the front of several. The science readout gains a femto
  prefix and a page without a clock; `machina/quantities` gains eV, Å, pm, fs, ps and the atomic mass unit.
- **Docs.** `docs/AGENT-REFERENCE.md` describes the science worlds (the model and dress split, gaps, the science block,
  the proposed film, the generated cards); the `get_substrate` drawer says in one line that a composed science view
  returns its solver's gates and that its page says what is the model and what is drawn. The `tools/list` payload pin
  rises by 200 bytes for the three new `create_view` kinds (no new tool).
- **The `physics-demo-for-a-class` catalyst**: a teacher's ask to a checked interactive demo and a film. It decides
  the scale first, writes the claim as a measured quantity, keeps exaggerations out of the model, reads the gates,
  measures what the lesson cites, captions from measured numbers, and reports that the eyes gate is the teacher's.
- The ready-made views a composed kind overlaps say when to compose instead, as atom, black-hole and double-slit do:
  mechanics (a demo whose bodies, springs or start are the teacher's → `classical`), orbit (bodies the teacher sets →
  `classical`; an orbit that turns because spacetime curves → `relativistic`) and wavepacket (a well, step or barrier
  the teacher sets → `quantum`). Each keeps its ready-made picture.

### Science worlds further: spacetime, volumes and settings

- **What it is.** Raymarched depictions where a mesh cannot show the model, and science worlds placed in any world.
  The law always lives in JS where the gates run; a shader is generated from the same numbers and held to them by
  a shader conformance gate in headless Chrome ("not run" without a browser). A setting is dress: anything a body
  touches is a law in the model, a gate advises when a body passes through scenery no law covers, and the world
  never changes the physics silently. In order: a fourth scale, `relativistic` (Schwarzschild spacetime: light
  bent round one mass, orbits on geodesics, clocks), a `science` world channel that stands a science world in any
  world, quantum orbitals as volumes and the two-slit plane, and classical field lines and field volumes.
- **The shader conformance gate** (`science-worlds/shader.js`, `conformance.js`). A shader-drawn science page is
  written once as GLSL that defines the picture (`sciImage`, the colour along a ray) and the model quantity it
  computes (`sciValue`); one source makes both the page's full-frame `effects[]` layer and a probe shader, with the
  model's numbers declared once as uniforms. On a capture run the science channel adds a probe bridge that evaluates
  `sciValue` at given inputs into a float target and reads a rendered frame back; an ordinary page carries none of
  it, byte for byte. The gate (`shader-conformance`) compares both with JS: values at probe points, and features
  measured on frames (a dark disk's radius) against their projection. It advises; without a browser it is "not
  run", never a pass. The mint never launches a browser: the e2e tier and `node scripts/science-conformance.mjs
  --selftest` run it, and the self-test holds that a faithful shader agrees and a shader with a hand-typed factor
  in its GLSL disagrees. Shader pages ride the normal World page, so the readout, the honesty panel and film
  capture come with them.
- **`create_view({ kind: 'relativistic' })`**: a fourth scale, the spacetime round one non-rotating mass
  (Schwarzschild), composed from a table of laws with their sources and review dates. One system per world:
  - `light`: what an observer held still sees, drawn by a shader that traces each pixel's light back with the JS
    scheme step for step. You get the shadow (seen at Synge's angle), the photon ring, the sky bent round the mass
    (a grid every 15° or stars), and a thin disk's direct and lensed images, shifted by g (Doppler and gravitational
    together) and brightened by g⁴. Its film swings the eye toward the disk's plane.
  - `orbit`: test bodies on geodesics (RK4 in their own time, played on the far clock's).
  - `clocks`: clocks held at radii or let fall.

  It is checked against the closed forms: the shadow's edge at 3√3/2 Rs by bisection, the bending of light against
  the exact orbit integral, the drawn step against both, the perihelion advance against its elliptic integral each
  lap, each body's fate against its effective potential, the innermost stable orbit at 3 Rs, and a falling clock's
  own time against the cycloid. Mercury comes out at 43″ a century, and the GPS clocks 45.7 µs a day apart. The
  light shader agrees with JS at every probe in Chrome, and one that bends light 3% too little does not.
  `measure_view` reads orbits and clocks back in SI. Lengths may be given in Schwarzschild radii (`'20 Rs'`);
  `machina/quantities` gains `M☉`, `ly`, `pc` and `c`. Relativity, lensing, time dilation and precession now name
  this scale as gaps elsewhere. A spinning hole, gravitational waves and special relativity are gaps saying they
  are not in the table yet. The curated `black-hole` kind keeps its picture, and its card points at this one.
- **A science world in any world**: the `science` world channel (`compose_world` `overrides.science`, or `science`
  on a stored world's recipe; manual: the `science-setting` card) stands a composed demo in any world kind. How it
  stands:
  - A classical demo drawn at one metre per unit stands 1:1 at `at`, turned by `yaw`. Its readout and its "what's
    real · what's drawn" panel ride the world page, the page opens on its camera, and its film is moved into the
    world.
  - Anything else (a microscopic box, an orbital, an orbit or clocks world round a black hole, a solar system drawn
    shrunk) is a bench prop in a glass case, its true magnification on the panel in place of its own scale. A
    light world cannot stand in a world: its shader fills the frame.

  The setting is dress, and what a body touches is a law:
  - `ground: 'from-world'` makes the world's own surface under `at` a plane law at its height, and the panel says
    so.
  - `scenery-clear` checks every body's recorded path against the world's faces near the demo and names any surface
    one passes through that no law covers.
  - `setting-agrees` holds the model's g to the setting's (Earth, Moon, Mars, from the same table as the classical
    frame's presets), and `setting-air` advises on drag where there is no air.

  `compose_world` solves the demo at mint (a bad model refuses the mint) and stamps the setting from the theme
  (`mars-colony` is Mars). The world's surfaces are checked when it renders. Each scale's card gains "In a world",
  and the classical, microscopic, quantum and relativistic assemblers take a plan they were handed. Absent, every
  world is byte-identical.
- **Orbitals as a volume** (`dress.render: 'volume'` on a quantum atom world). Each orbital is ray-marched as a
  density, gold where ψ is positive and blue where it is negative, several side by side in one shader, for every
  orbital up to n = 7. The GLSL is generated from the orbital's own numbers (its Laguerre polynomial's coefficients
  and its real solid harmonic as a polynomial in x, y and z), so nothing in it is a hand-typed twin of the JS. The
  points stay the default, since they are the picture the χ² checks; the volume is a second picture of the same ψ,
  and the panel says which checks are of what. `exposure` sets how strongly it glows. A volume is refused off an
  atom world and in a setting. Its conformance probes are ψ at points of each orbital's cloud against the exact
  function, within a thousandth of the orbital's brightest |ψ|; the worst in Chrome is about 2e-7 of it, out to
  n = 7, and a shader whose ψ falls off 2% too slowly disagrees. `node scripts/science-conformance.mjs --examples`
  runs it, and `--ref` takes a stored volume.
- **The two-slit plane** (the quantum `plane` system and its `slits` row). A packet on a plane, ψ(x, y, t), stepped
  by split-step Fourier, meets a wall with one to six slits. The plane's edge is an absorbing rim whose take is
  counted as it is taken, so what is on the plane and what was taken add to one to round-off. The far field is read
  from the passed wave's transform, zero-padded 4× and integrated along each direction over the packet's spread of
  wavenumbers. Detections are drawn from it one at a time (seeded), and a χ² holds them to it. The checks:
  - fringes against the thin-screen pattern of the grid's own slits, within 3%, with the textbook λ/d beside them
    (two slits come out 0.211 against 0.212, λ/d 0.217; three slits 0.284 against 0.286);
  - `wall-opaque`: the wall struck head on by a packet at the same energy, on the same grid and step;
  - `far-field-settled` and `edges-quiet`: the far field is read once the wave has come through and before the rim
    takes it;
  - `grid-resolves`.

  What the build found:
  - A wall sharp to the cell lets the wave through by the split step's own error: 1e-4 at 20 eV, rising with the
    wall's height, far above its tunnelling. That wave is as wide as the plane and floods the centre of the pattern
    with a spike or a dip. The wall's edges now rise over two cells, which cuts the leak about a thousandfold.
  - A slit in a wall is a short channel, not a thin screen, so one slit's central band comes out 11 to 26% wider than
    λ/w gives. No zero is claimed for it: its `envelope` gate allows up to 35% wider and says why.

  The page plays |ψ|² on a sheet from the solver's own frames (48 frames, 64 cells a side, four to a texel of a float
  texture) through a shader drawn over the page's meshes. A depth prepass keeps the far screen in front of it. The
  wall is a raised slab, and dots arrive at a far screen one at a time over the run's second half, each at its
  detection's angle. The shader conformance gate holds the sheet to the frames (worst 9e-8) and the wall to the
  model's either side of every slit edge. A shader that plays the frames backward between samples and drops the wall
  disagrees. A solve takes about 1.3 s at 128 cells a side; the work is capped at 128² × 1500 grid-steps. `measure_view`
  reads the run, the far field and the detections back. A plane cannot stand in a world. Interference, the double
  slit, diffraction and gratings now name the slits row, and the curated `double-slit` card points here. Whether the
  plane supersedes `double-slit` or `wavepacket` at the door is left to the routing eval.
- **Shader pages over meshes.** `shaderPage` gains `output: 'layer'` (premultiplied, over the page's meshes),
  `dataTextures` (float RGBA, into both the image and the probe shader) and `depthClip` (`sciSceneDistance`, from the
  page's depth prepass). A page without them is byte-identical.
- **Classical fields drawn** (`dress.field` on a classical world). The electric field the `coulomb` and `lorentz`
  rows make, read off the same model at any moment of the run (`classical/field.js`), drawn three ways:
  - `'lines'`: field lines traced by RK4 from the charges where the run starts, as many from each as its share of
    the largest charge, in the charges' plane when they lie in one. Each ends on a charge of the other sign or leaves
    the frame, and a negative charge adds only the lines it still lacks. A uniform E or B is drawn as even lines.
  - `'volume'`: the field's strength glowing on a log scale (from its median in the region to its 99th
    percentile), warm where the potential is positive and cool where negative.
  - `'shells'`: the potential's shells where its size doubles.

  The volume and the shells are a shader layer over the meshes. It reads the charges' paths from a float texture on
  the movers' own clock and interpolation, so the field moves with the bodies. A drawn field adds two gates to the
  page and the mint:
  - `gauss`: the flux through a sphere round each charge is q/ε₀, and none through one round no charge, by a
    Gauss–Legendre surface integral of the field drawn (worst about 4e-16 on the coulomb row's example);
  - `field-lines`: no line stops short, and each charge carries lines in proportion to its charge, within one line
    or a fifth.

  The shader's E and V agree with JS at 48 points and moments through the run as the charge orbits, and one whose
  field falls off as 1/r disagrees. The solver never sees the dress, and a world without a field is byte-identical.
  A volume or shells cannot stand in a world; lines can.
- **Docs.** `docs/AGENT-REFERENCE.md` states the shader rule (the law in JS, the shader generated from the same
  numbers and held to them) beside the setting rule and the channel, and says a page drawn by a shader cannot stand
  in a world. `docs/raymarch-effects-layer.md` gains the science pages as a worked example: the four shader pages,
  the pattern for a picture a gate has to vouch for, and two gotchas: a probe must run on the page's own inputs,
  and a Chrome test that finds no browser passes without proving anything (`MOJULO_CHROMIUM`). The
  `physics-demo-for-a-class` catalyst's scale table names the two-slit plane, orbital volumes and drawn fields, and
  its last step says which demos can stand in a world. The `get_substrate` sentence already named the fourth
  scale. The routing eval that would decide whether `relativistic` supersedes `black-hole`, or the plane supersedes
  `double-slit`, at the door was not run: the curated kinds keep the door, and their cards point at the composed
  ones.

### City hunter: the swinger in a district

- **In progress, nothing built yet.** The city-stalker open world as a primitive: a third-person hero in a city
  district (one `city` segment played as a level). The hero:
  - sticks to any building's wall and launches from it;
  - swings on a gear whose directions its profile constrains (the swinger first: a line to a face above and ahead);
  - fights with the controllable engine's combat.

  Other parts of the theme:
  - **Progression:** gear upgrades open districts, and the reach of the gear is measured against the city's roofs.
  - **Distance:** a planned air (height-aware haze, street smog, a cloud deck, a skyline past the plan) carries the
    city past the district's edge.
  - **Characters** plug into the hero's slot; each new movement state falls back to one every model already has.

  Every key is opt-in; absent, every city level and game renders as before.
- **The probe.** The capability registry (`lib/graph/cosmos`) names the genre, so the hill-climb page measures what it
  waits on:
  - A **City stalker** fixture.
  - `space.levelForm=city`: a city segment played as a level, which is built today (first person, no roofs).
  - Four planned gaps, priced: `power.gear` (a new setting: `none`, built, and `swinger`), `space.traversal=wall`,
    `power.idiom=city-stalker-like` (it requires the swinger and the wall), and `reality.look=city-night`.

  The probe reads blocked on exactly those four. Its Godot export would lose the city level, which no Godot fixture
  plays yet.
- **The district as a stage.** A city segment can be played by a hero, third person (`level.hero: { ref?, gaits? }` on
  a city level; a gameworld's `city.stalker: true` names the world's hero on every segment).
  - **The hero** is the player slot every game uses: the platform rule, a figure-rig body and its clips. It is tuned in
    metres (`CITY_HERO`) and turned into the city's units once (`ruleInUnits`). With no `ref`, a stand-in box plays it.
  - **Roofs are ground.** A lot's box top is ground on the page and in the headless sim alike.
  - **The edges rise to the sky:** over the tallest mass in reach, so only a street leads out.
  - **The camera** chases the hero. The page's own wall pull-in keeps towers out of the frame: its stand-off is read off
    the hero's capsule, so it holds in the city's units.

  One engine addition, opt-in: a rig body's `body.scale`. The page draws the body at that scale, and the code is emitted
  only when some body carries one.

  Without `level.hero`, the walker plays the segment as before.
- **The wall.** A platform body with `rule.wall` holds any collider's face (`worlds/controllable/wall.js`, a body
  owner beside the ladder's climb). Nothing is authored: a box's side is a plane with a known normal.
  - **Taking hold:** pressing forward into a face, in the air, or from the street when the face stands higher than the
    body. A low box, a narrow one (a tree's trunk) or a box marked `hold: false` (a hero level's edge) is not held.
  - **The crawl:** up and down the face, and across it with A / D. It rounds an outside corner onto the box's next
    face, unless another box stands there. A face of stacked boxes climbs as one.
  - **The top:** up past it, the body mantles over the lip onto the roof. Down at the foot it lets go.
  - **Off the wall:** a tapped jump is a wall-jump, out and up. A held jump is a wall-launch, its speed growing to
    twice the jump's.
  - **Between holds:** standing still at a roof's lip is a perch; falling fast off a roof is a dive.

  The wall's defaults are in metres, scaled by the rule's `metre` (world units per metre), so `wall: true` holds in a
  city level's units too.
  - **The city hero** has the wall unless `level.hero.wall: false`. Each of its new states (`wall_crawl`, `mantle`,
    `perch`, `dive`) plays the figure's first fallback clip it has (`TRAVERSAL_FALLBACK` in `playscape/player.js`).
  - **Godot and Roblox** name the wall lost.
  - **The registry** marks `space.traversal=wall` built on the web. The City stalker probe now waits on the swinger,
    the idiom and the look.
- **The swinger.** A platform body with `rule.gear: 'swinger'` casts a line to a building's face and swings on it
  (`worlds/controllable/swing.js`, a body owner after the wall). A gear is a set of direction constraints on where
  its line lands; the swinger's are a face above and ahead.
  - **The anchor** is found for the hero, never aimed. It is the face point nearest an ideal one (55° up, out along
    the heading), within reach, at least 25° up, inside a 75° cone either side of the heading, with a clear line.
    With no face in reach (an open plaza, a park) there is no line. A `hold: false` box takes none.
  - **The swing:** the gear's key (`boost`, F) held in the air. The line cannot stretch; gravity pulls the body; A / D
    steer and forward pumps. Its pivot is the anchor drawn three quarters of the way toward the hero's own line, so
    the arc runs down the street rather than into the wall the line is on. Its length keeps the arc's bottom clear of
    the street.
  - **Letting go:** the key let go, a jump (with a lift), a box across the line, a box met (the wall then takes the
    body), or the ground. The body flies on with the swing's speed.
  - **The zip:** the key pressed on the ground pulls the hero straight to the face, where the wall takes hold.

  Supporting pieces:
  - **The page** draws the line from the hand to the anchor, emitted only where a body has a gear.
  - **The new states** (`swing`, `swing_release`, `zip`) fall back to the leap.
  - **The city hero** carries the swinger unless `level.hero.gear: false`, and its controls legend names F.
  - **Godot and Roblox** name the gear lost.
  - **The registry** marks `power.gear=swinger` built on the web. The City stalker probe now waits on the idiom and
    the look.
- **The air: distance and scale.** A hero's district is a few hundred metres across; from its tallest roof the city
  goes on for kilometres. The stalker's eye (`city/plan/eye.js`) plans the air that carries it past the edge, on the
  pilot's eye's law (`skyscape/map.js`): fog opaque where ρ·d reaches 1.978, its density thinning with height.
  - **The plan:** from the street the hero sees the district and the 140 m ring of real masses round it; from the
    tallest roof, out to a skyline past the plan's edge.
  - **The far ring:** the rest of the plan stands round the district as massing, one instance a lot (two instanced
    meshes in all), lit as the city is and tinted with each lot's own colours.
  - **The skyline band:** seeded cards past the plan's edge, so the city never visibly ends.
  - **The page** thins the haze with the camera's height (`hazeHeight`), composed with any other writer of the fog
    (the weather), and emitted only where a world asks.
  - **A cloud deck** over the district by default (`clouds`: the recipe's own wins), dark by night.
  - **The city kind** now honours `fog` (street smog, clipped to the level) and `clouds`. Both were accepted in a
    recipe before and silently dropped.
  - **The `city-night` look:** concrete, asphalt and neon under a glowing night sky, no sun, so the windows light.
    Its reference card is Midnight Club II. A `city-night` geocube preset carries its colours, buildings and palette.
    The registry marks `reality.look=city-night` built.
  - **Godot and Roblox** name the height thinning lost.

- **Indoors: a warehouse, a dungeon.** The wall and the swinger play under a roof, in any gameworld level.
  - **A hero's starting moves:** `characters.hero.actions.moves: ['wall', 'swinger']` (`HERO_MOVES` in
    `gameworld/actions.js`) puts them on its platform rule in every level it plays: a trail, a building, an inside
    behind a door. Its clips fall back for their states, and F is named on its controls.
  - **Ceilings as colliders:** a building level such a hero plays lays each room's ceiling as a collider
    (`ceilings: true` on a stage; `stageColliders` in `era/anchors.js`). They are never laid over a room a stair rises
    out of, nor under an open sky.
  - **The swinger indoors** also casts to a box's underside over the hero (a ceiling, a beam), aimed where its ideal
    ray meets that plane. Its arc's clearance shrinks with the room under the pivot, and no line shorter than the hero
    casts (a low room swings nothing).
  - **The wall indoors** keeps the head under a lid (a ceiling, a tower's setback) as it climbs.
  - **A warehouse** is a barn with a great floor: `building: { use: 'barn', rooms: { floor: { w: 30, d: 20, h: 12 } } }`.
  - **A dungeon:** a crypt's chain of rooms plays with the moves, and so does a tower up its storeys, its stair rooms
    left open overhead.

- **The reach: progression the map measures.** `game/reach.js` works out which surfaces a hero's moves carry it to: the
  grounds, and every box top with room to stand. It reads the engine's own dials (the platform rule's run and jump,
  the wall's, the gear's).
  - **Its moves:** walk, jump (air jumps added), drop, the wall (a holdable face up to its top, stacked boxes as one)
    and the swing (across a gap under an anchor the line can take, rising a jump and the gear's clearance).
  - **Each law is held to the engine's own runs:** the hero climbs the tower the wall reaches; it swings across the
    gap the line crosses and lands on the far roof; a street swing rises past the law's bound.
  - **What it answers:** `reachUpgrades` says what each move opens; on a district the wall opens every roof. The
    solver is analytic, a law per move: a move it allows the engine makes, and one it refuses a player's skill may
    still find.
  - **The moves as powers:** `wall` and `swinger` are moves a power gives (`TRAVERSAL_MOVES`), so a map world can hide
    them and gate by them. The level contract takes a grant of `true` or a preset's name. The page draws a granted line
    (the drawer is emitted where a grant carries a gear), and the pilot's figure plays the moves' fallback clips.
  - **Keys in a city:** a map world may lay a key in a city level. It lies on the segment's tallest roof the hero's
    own moves reach, by the solver, and is taken only up there. A power found there gives its move in the city's
    units. City levels refused keys before.
  - **The idiom** `city-stalker-like` ("the gear's reach gates the city", an unlock system) is built. **The City
    stalker probe is makeable.**
  - **The swinger's line** is now reeled in at `reel` (20 m/s) from the cast's length. Before, it snapped to its own
    length across the gap, a 12 m jump on the first step.

  The City stalker probe now waits on the idiom alone, and a brief's words find it (`gameworld/intent.js`: rooftops,
  swinging between skyscrapers, a superhero). A hero level with a made character (`level.hero.ref`) now
  draws: the plan read off the lowered level no longer takes the level's `figures` as a city setting.

### Epidermis cube: skin and hair as a recipe

- **Brows.** An epidermis cube (`epidermis/epidermis.js`) is a character's surface as a small recipe, as the geocube
  is a level's look: its first groom is the brows, grown as strands on the relational head by its relations (the
  head over the inner canthus, the arch's peak over the outer edge of the iris, the tail on the line from the nose's
  wing through the outer canthus), in three regions (the head's hairs up, the body's out and up, the tail's out and
  down) with the herringbone along the spine, laid on the skin. The brow hangs on the brow bridge's strings with the
  fold under it: its head is tied on the medial string, its tail on the lateral string (which runs on the line from
  the nose's wing through the outer canthus), and its peak rides the fold's arc. A raised or lowered brow pulls the
  strings, so the hairs and the fold move together, and the same hairs are carried rather than regrown. The field
  lane draws them (`--epidermis`).
- **Lashes.** The cube's second groom roots on the eye rig's lid margins, which the rig now exposes as lash lines.
  The upper lashes are longest centre-lateral and curl up; the lower are shorter and sparser and curl down; the
  lateral lashes flare outward. Each leaves the margin at an elevation set by where the margin sits on the globe and
  the lid's roll, so the lashes ride the openness, a squint, the gaze and a blink, and a shut lid's lashes hang.
  Every lash is grown step by step: a step that would sink into the skin bends off it with its length kept, and a
  lash that cannot clear the skin ends there. Shape words: `natural`, `long`, `curled`, `straight`, `sparse`, `full`,
  each with numbers over it (`length`, `curl`, `density`, `flare`, `lower`, `seed`); `lashes: false` grows none.

- **Skin relief, studied on swatches.** The cube's skin (`epidermis/skin-relief.js`) conveys keratin rather than
  simulating it: a few numbers in, and a height and a roughness out at any point of a flat chart, gray. It has four
  fidelity tiers, each adding to the last: `form` (nothing), `creases`, `keratin` and `micro`.
  - **Creases** are thin lines at the bone/skin connections. They fan from a point (crow's feet across the lateral
    orbital rim) or run beside a tether (under-eye, forehead), each a wavy, tapered, sometimes forked groove with
    the skin bunched beside it.
  - **Keratin** is the primary lines: two crossing families of long, wandering furrows about the skin's tension
    direction, deep in stretches and fading in others, with a weaker family across. Round pores sit near their
    crossings (and scatter between them on the nose), and a faint minor net turns to follow a crease.
  - **Micro** adds the finest net, the keratin grain and its sheen.

  The dials are the region (forehead, cheek, nose, eyelid, chin), age, squint, and the pore and crease scales.
  `/head-study --skin` renders the swatch sheet. The cube reads `skin` (`fidelity`, `age`, `pores`, `creases`,
  `seed`).
- **Skin on the head, by zoom.** The relief lies on the relational head as a shading layer (`epidermis/skin-head.js`):
  a perturbed normal and a cavity darkening per point, never geometry. Each layer shows over its own range of
  millimetres per pixel (`SKIN_ZOOM`): keratin lines and pores from a close-up, the micro layer in a macro shot.
  Coarser than its range a layer is held back rather than aliased, so a whole-head or portrait view is untouched.
  - **Where it lies:** a millimetre chart runs around the head's vertical axis. The regions come from the relations
    (nose, eyelids, forehead, chin, cheek), blended where they meet and with the tension mirrored left to right.
  - **No creases:** the head carries no crow's feet or wrinkles, which read as incongruous with its design. The
    creases tier stays in the swatch study, and lines along a tether are staggered pieces there.
  - **Field lane:** `--skin` shades the field lane with it, and each panel names its zoom and the layers it shows.
    `--crop macro` frames the outer canthus, and a row of `--acts` may carry its own `crop`, which makes a zoom strip.

### Relational head: the face as superposed vajras

- **The head field, seen as it is.** `/head-study --field` meshes the protoform head's field with surface nets
  instead of the latitude rings, so the turntable shows what the field holds. It overlays the head's landmarks, cuts
  sections through the head (the profile, and across at the brow, the nose base and the mouth), and prints caliper
  measurements read off the field itself: head length and breadth, face and jaw width, face and nose height, nose width
  and protrusion, mouth width, and their indices.
- **A head of relations.** `--source relational` reads a second head (`head-relational.js`): named proportions (the
  facial thirds, the eye line, head length and breadth, face and jaw width, the rule of fifths, nasion depth, nose
  projection) place its points, vajras strung between them make the skull (`--layer skull`), and its skin is every
  vajra's wave summed, the bones offset by the forensic soft-tissue depths and the muscles and fat pads at rest. The
  relations are on the skin; the wave's internal points are solved until the skin's calipers meet them, so each
  relation reads its own target (`--untuned` shows the head as authored).
- **The face's actions.** The relational head takes `actions`: `jaw` (the mandible rotates about the condyles and
  glides forward, and the mouth opens between the lips), `smile` (zygomaticus major draws the corners toward the
  cheekbones and lifts the cheeks), `browRaise`, `browLower`, `blink`, and a side alone (`smileL`, `blinkR`). Each
  drives named beads of the vajra graph; their displacements add, so actions compose. `--acts` renders an action strip
  with what each moved from rest.
- **Eyes and mouth.** The eye's opening is an almond read back from the lid margins (the canthi, the lids' apexes,
  `fissure` and `canthalTilt`), cut through the skin to a globe with its cornea: a blink brings the upper lid down to
  the lower and the opening closes; a smile lifts the lower lid. Each lip is two vajras, corner to cupid's bow peak to
  centre, the lower the fuller (`upperVermilion`, `lowerVermilion`), with the lip line, the philtrum and the
  mentolabial sulcus carved. The skin's wavelength shortens near the eyes and the mouth (`featureWave`), so features
  smaller than the wave keep their edges. `--crop face` frames the face.
- **The nose's pyramid and the cheek's balloon.** The nose's base width follows its length (`nasalIndex`, al-al over
  n-sn, tuned like the other relations), and two sidewalls rise from the wings to the mid-bridge, so the nose is a
  ridge with two walls and the wings read as wings. Straight out from the mid-bridge to under the eye's centre is the
  cheek's control point: a cheek balloon is anchored at the jaw's corner (pinned to it, so the cheek's wall follows
  an opening jaw), bulges there, and tapers to the mouth's corner above and below. A balloon keeps its volume, so a
  smile that shortens it bulges the cheek; the zygomaticus thickens the same way.
- **A closed head.** The cheek's side is walled by the buccinator (upper molars, lower molars riding the jaw, the
  raphe between) and sealed to the chin by the depressor anguli oris; the parotid fills behind the ramus, a fill sits
  before the ear, the upper lip's body meets the nose's base and a columella closes the nose beneath. The field
  lane reports `through-holes` (`throughHoles`, lines straight across the head that meet no skin though skin closes
  round them): none at rest, smiling, or with the jaw open to its limit, on either pole. The philtrum is its columns
  alone (the carved groove read as a line). The al-al caliper reads the wing's knee when there is no groove.
- **The nose's base and its nostrils.** Each nostril is its own vajra (the wing's base, the alar lobule, the soft
  triangle beside the tip), placed from the nose's bottom by `nostrilRise` and `nostrilSet`; the alar bar joins the two
  lobules under the subnasale, so the wing's outer side is the alare and al-al meets its target again. The upper lip's
  body is two cones, one per side, from under the wing to the cupid's bow peak, meeting on the midline: the lip slopes
  forward from the subnasale and the nose sits on it, raised from it (one span across had risen over the subnasale and
  melted the nose's base into a bulb). The nose's flesh is a cone down the middle, narrow at the bridge and widening to
  the base over the wings, closing the grooves beside the ridge; a second cone across it, low beside the tip, closes
  the window in each side between the wing, its wall and the tip. Both take their radius from `noseFat`, how fleshy
  the nose is: wider and fuller, never longer (the tip's projection and the wings' width stay their own relations).
  The al-al caliper reads the wing's knee when the tip's slope leaves the wing no crest.
- **The jaw's limit.** `jawOpen` is how far the incisors part at full (`jaw: 1`, ~39 mm male, ~37 mm female: a full,
  comfortable opening), `condyleGlide` how far the condyle glides forward and down the articular eminence. The jaw
  opens by rotation alone at first and glides as it opens wide; the hinge's angle at full is solved so the opening
  meets `jawOpen` (`jawPose`), so the opening grows evenly with the activation and stops at the limit. The head returns
  `jaw` (the angle, the glide, the opening and the limit) and the field lane prints it. The open mouth is an oval that
  rounds into its corners (it was a diamond).
- **The lips stand forward.** Seven masses end beside the mouth's corner, and their summed waves had swelled it ~12 mm
  proud of the cheilion, with the alveolar arch's ends on the corners besides: the mouth sat flat in a trough between
  two mounds. The masses now end at the modiolus, which the tune sets back until the skin at the corner is on the
  cheilion (`mod`), and the arch curves back behind the corners, so the lips stand on a ~12 mm arc in front of the
  cheeks.
- **The lips' bodies and the cheek's fold.** The upper lip is the philtrum's body under the nose, set behind the
  philtral columns, and a thin plate each side out to just above the mouth's corner; the lower lip is a body from corner
  to corner behind its vermilion, riding the jaw, standing forward down to the mentolabial fold. They are their own
  group (`lipBody`), joined to the skin by a smooth minimum like the nose and the vermilion rather than summed with the
  cheeks, so they keep their shapes and do not swell the corners or fill the fold. The cheek takes a fold: a thin roll
  from beside the wing's base, past the mouth's corner, down to the jowl, summed into the cheek as the edge where its fat
  stops against the lip; it rides the cheek's bulge, so a smile deepens it, and the jaw at its foot. The upper lip's top
  sits back under the nose, so the nostrils' base stands off it in an angle, and the lip slopes forward to its peak at
  the vermilion. An alar crease is carved round the back and the bottom of each wing, where it meets the cheek and the
  lip, and the fold begins there; under each wing a sill (the lip's top edge, from the philtrum out to the wing's base)
  tucks under the nostril, so the wing sits on the lip in a crease, not over a slot. `philtrumVolume` is the
  philtrum's fullness: its body's radius down to the bow, the columns growing with it. The upper lip's plates and sills
  taper (each centre bead on the line between its ends, its radius between theirs), so the lip falls off evenly from
  the philtrum to the corner with no terrace for the light to read as a lump. The al-al caliper takes a groove the wing
  runs straight down into, near its edge, as the alar-facial groove even with no crest before it.
- **Lip fullness and the jowl.** `lipFullness` is the vermilion's volume: its beads' radii about their fixed centres
  (the corners stay fine), so fuller lips stand further forward and grow taller and rounder; 1.25 by default, 1.3 on
  the female pole, and the lip line parts them as far forward and as deep as their fullness carries them. The cheek's
  fold ends in the jowl: `jowl` is its roll's radius at the foot (0.012, flatter than before) and `foldReach` how far
  below the mouth's corner it runs (0.05, to the lower lip's edge; ~0.12 carries it past below the lip toward the jaw).
  The fold's top is anchored on the cheek behind the wing, level with the alar crease, so it has a broad base and sits
  back from the lip; its middle rides the zygomaticus up and back as the cheek bunches over it in a smile.
- **The teeth.** The incisal point (`inc`, where the incisors meet behind the stomion, `incisorShow` below it: ~7.4 mm,
  ~6.4 mm female, so ~4 mm of the male's central incisors and ~3 of the female's show under the full upper lip as the
  mouth opens) anchors the dental arches and is where the
  jaw's opening is measured. The upper arch is seven crowns a side on a curved arch (`DENTITION`: central and lateral
  incisors, canine, two premolars, two molars, each placed out from the midline and back from the incisors' faces, the
  arch narrowing into its curve at the front and running nearly straight back along the molars; `archWidth` scales
  it), each crown its own upright vajra from the cervix to its edge or cusps on the occlusal plane, the incisors
  leaning forward and thin at the edge. The lower arch is the upper's mirror across that plane, a touch narrower and
  `overjet` (~3 mm) behind, riding the jaw. The crowns join each other with an all but hard edge, so they read as
  teeth, not a band. The tongue is its own mass on the floor inside the lower arch, apart from the teeth: its stations
  are placed from the lower crowns themselves (the tip a gap behind the incisors, each half's side a gap inside the
  premolars and the first molar, 1 to 3 mm all round), its dorsum a hair under the lower teeth's edges. The palate
  roofs the mouth on the midline above the upper teeth (the cavity had opened into a hollow there). As the jaw opens an oral cavity is carved behind the lips along the arch
  (each side through the incisors, the canine and the first premolar, down the middle and across the back, reaching
  both arches' edges, narrowing inside the cheeks; beside the incisors each station is two beads up and down the line
  between the crowns' edges, since one round bead tilted by the open jaw reached forward through the skin under the
  lower lip's ends), and the teeth and the tongue, joined after it and clipped to its
  neighbourhood (another carve never bares them), line it: the open mouth shows the upper incisors under the lip, the
  lower row and the tongue. A septum fills the nose's midline (a
  pocket there opened to a line seen through from the side as the cheek moved). The through-hole lane finds none over
  the jaw's range in tenths, plain and smiling.
- **A rounder chin.** The mental tubercles (the chin's corners) sit closer in, lower and smaller (the mandible's front
  ends follow them in), so the chin's front rounds off from the midline instead of standing flat between two balls:
  12 mm out it falls 0.7 to 1.1 mm behind the pogonion and 18 mm out 1.5 to 2.3 mm (both were flat to 0.2 mm). The
  jaw's width and the face's height are unchanged. `head-study --field` gains `--crop chin`.
- **The female face's proportions.** Read as ratios (both poles are drawn at one head height, so millimetres against
  adult norms mostly show the female head's smaller size), her face was as long as his for a narrower width and her
  skull too broad: her facial index stood above the male's where the norm (Farkas) sets it ~2.4 below. Her thirds
  shorten (`third` 0.28, the eye line following to 0.49 so the brow keeps its height over the eye) and her vault
  narrows (`cephalic` 0.79): facial index 87.2 → 84.7 (male 86.3), n-gn/g-op 0.615 → 0.592 (male 0.608), n-sn/g-op
  0.291 → 0.280 (male 0.285), eu/g-op 0.802 → 0.790 (male 0.781). The face sits lower on a relatively larger, rounder
  vault; the tune meets every relation as before.
- **The wings' bases.** Each wing meets the face in one crease: the alar crease runs behind the wing's root, clear of
  it, its edge blended, so the root's round end is the wing's heel (cut across the wing in front of the root, it left a
  curled flap outside the groove; cut into the root's back, a point), the root sits just inside the alare so the
  lobule alone is the wing's widest, and the sill under the
  wing sinks its outer end into the cheek (it stood a round knob 7 mm proud of the cheek beside each wing). The
  calipers (al-al, n-sn, sn-prn) are unchanged.
- **A soft mentolabial fold.** The fold between the lower lip and the chin is a broad, shallow hollow curving with the
  lip and thinning away at its ends, its edge blended over ~3 mm (carves take their own edge: the lip line stays crisp).
  Cut as a thin tube with the lip line's sharp edge, it read as a chevron scored into the skin.
- **The lower lip and its fold as the jaw opens.** The fold flattens as the mouth opens (its carve rides the jaw and
  lifts forward out of the skin), and the lower lip stretches down over the lower incisors and settles back (its body
  and centre by up to 6 mm at the limit, its fullest beads by less), so it no longer rolls out over a deep crescent:
  at jaw 0.6 the male's midline reads lip 2 mm ahead of the chin and the fold 2 mm behind it (was 4 mm ahead and 4 mm
  behind), at the limit lip to chin is one line. The tissue over the mandible (the chin's, the angle's, half the
  masseter's and the buccal's) now rides the jaw, so a swung chin keeps its own tissue depth.
- **Ears.** The relational head wears ears in the shape of the operator's sketch (`head-ear.js` `EAR_OUTLINE`, now
  exported): the helix rolled along the outline into the lobule and curling into its root, the antihelix's Y, the
  tragus raised into the notch over the lobe, the concha's bowl and a blind canal. Their place is relational: the top
  at the brow (`earTop`), the lobule level with the nose's base (`earBottom`), the long axis leaning back from
  vertical by `earTilt` degrees, the hinge on the head's own skin, found by probing the field. The concha stands a little
  off the head with its back welded to the skin, and the outer ear folds off it at the antihelix (`earProtrusion`).
  `earlobe` sets the lobule from free (0, tilted off the head) to attached (1, tilted into the cheek, where it fuses).
  `--crop ear` frames the right ear.
- **Expressive eyes.** The relational head's eyes are a rig of their own (`head-relational-eye.js`): a globe whose
  cornea, iris and pupil turn with the gaze; the lids as a skin shell over the globe and its cornea (a shut lid shows
  the gaze), the opening carved between two lid curves, each with its own height, peak (inner to outer) and shape
  (flat and tense to peaked); the upper lid following the gaze's pitch; a crease, a hood and a pretarsal roll that swells
  in a squint. `eyes` takes a word (`neutral`, `wide`, `angry`, `sad`, `sleepy`, `happy`,
  `suspicious`, `focused`, `closed`), channels over it and a side's own; blink, a smile's squint and the brows drive
  the same channels. The field lane paints the sclera, iris and pupil, takes `--eyes` and rows with their own `eyes`,
  and frames `--crop eyes` and `--crop eye`; a crop meshes only its own box.
- **A gaze target.** `eyes: { look: { x, y, z } }` (metres from between the eyes: +x the figure's right, +y ahead,
  +z up) aims each eye from its own centre, so a near target converges them and a far one leaves them parallel; the
  lids follow, and a word or a side's own gaze composes with it. The head reports its `vergence`.
- **The eye's depth.** The eye was set deep in a walled socket: it read from the front but sank from ¾. The skin
  over the lateral orbital rim stood 6–8 mm ahead of the cornea, where it belongs about 10 mm behind, and the brow
  stood 19–22 mm ahead. The cause was the orbit's frame: it was anchored to the glabella, not to the eye.
  - **New relations:** the eye hangs off the nasion by `radix` (11 mm). The brow's outer end sits `orbitRim` behind
    the cornea and the cheekbone's front sits `malarDepth` behind it. A `lateralOrbit` tissue marker gives that rim
    forensic skin.
  - **The brow** is an arch each side, the glabella over a supraorbital peak (`browProjection`, flatter on the
    female pole) to the outer end. It replaces a straight bar, which ran in front of the eyes.
  - **The skull** gains its lateral orbital rim, the zygoma's frontal process (skull only: the skin over it is
    already the wave of its neighbours). Its orbit becomes a cone that holds the globe clear of bone.
  - **Measured** in mm ahead of the cornea, male / female: radix 11 / 11, brow over the pupil 11.6 / 9.3, skin
    over the lateral rim −9.6 / −9.5, the skull's rim −16.1 / −16.1 (Hertel's 12–20). The wave still meets every
    relation within 0.4 mm, with no through-holes.
- **Upright ears.** `earTilt` is now degrees from vertical, not a share of the nose's dorsum. Through the dorsum the
  ears read about 18° along the long axis (helix top to lobule bottom), too angled. At 6° they read about 10°, the
  clinic's floor. The ear still turns about its hinge with its top at the brow and its lobule at the nose's base. The
  tragion moved 0.4 mm and the outer canthus to tragion stays about 76 mm. The attached lobule still fuses, with no
  through-holes.
- **The outer canthus, closed cleanly.** With the outer wall gone, a slab showed at the outer eye corner. The lid
  space's floor ran level past the canthus to the arc's foot, and both it and the opening's sliver end cut back to
  the globe's centre, where the globe no longer reaches, leaving a shelf and a slot.
  - **The lid space:** its floor now rises to the arc's foot, and its cut has a depth floor, shallowing toward the
    feet and past the canthi.
  - **The opening:** it keeps its deep corner pockets where it is open, and grows shallow only where it thins to a
    sliver.
  - **The cut's blend** is softer, so its fold edge is smoother.
- **The iris, patterned.** The iris carries a light pattern: radial fibres, a wavy collarette ring parting a lighter
  pupillary zone from the ciliary, darker crypts, a dark limbal ring and a thin pupillary ruff. It is a tone over its
  colour (`irisTone`, the head's `paintTone`), periodic round the iris, seeded per eye and paint only, with no
  relief. The field lane shades it per pixel.
- **The brow's bridge, and the lid space hung from it.** An invisible bridge runs across the forehead (`browBridge`)
  with four strings hanging from it: two medial strings down beside the nose's root, and two lateral strings down the
  temples. Each eye's arc, the edge of its fold under the brow, hangs between its two strings' feet just past the
  canthi, and the brow is tied on the same strings. The brow pad's action pulls the strings, so a raised brow lifts the arc and a lowered one drops it. The
  upper lid now drapes the globe from its margin to the crease. The fold rolls out of the crease and rises forward
  to the brow at the arc, and the lid space closes where the arc's feet meet the canthi. Before this, the brow's skin
  stood about 19 mm proud of the cornea right down to the lid margin, which hid the lid, the crease and the hood. The
  `hood` channel lowers the crease and draws the fold down, and the crease is a groove along it. `--rig` draws the
  bridge, the strings and the arcs in red on the skin.

### More than meets: one body in two forms

A hero can now transform: the robot you walk and fight in folds into the vehicle you drive or fly, and back, on one
button, the way a Transformers or a transforming mobile suit does. The transformation keeps the parts that exist and
reorients them; it aims at visual plausibility, not mechanical fidelity.

- **One skeleton, two poses** (`lib/graph/transformation/`). The robot is a skeleton: an operator's suit (`unitRef`)
  or an inner frame made to the vehicle's size. The vehicle form is a pose of the same skeleton (the stow), and the
  vehicle's shell is cut into panels along its length, width and height, each panel riding the bone it lies over.
  The sequence between the forms is the skeleton moving joint by joint, staggered, its panels carried. It all bakes
  into one rig figure: the robot's clips, the vehicle form's clips and the two once-clips of the transformation.
- **The ways of transforming are rows** (`transformation/schemes.js`): a car-bot (the hood and nose its chest, the
  roof its back, the doors its forearms, the rear its legs, the front wheels its shoulders), a jet-bot (the nose and
  canopy its chest, the engines its legs, the wings on its back), a waverider (a suit alone, folded into its own
  flight form) and the variable suit's. A row names the stow, the regions the shell is cut into and where each sits
  on the robot.
- **The variable suit** (`transformation/variable-suit.js`): the primitive between a Transformer and a Gundam, a suit
  drawn to fold. Its kit moves apart as it transforms: the kite shield on its forearm becomes the nose, the flight
  binders on its back spread into swept wings, the hip fins flip up into the tail, and the legs close into the engine
  pods, their heel jets the engines. Three palettes (`federal`, `titans`, `crimson`) and breadth dials.
- **Three more ways of transforming.** The REAR FOOT (`rear-foot`, a car): the legs together are the car's rear, its
  bumper split between the feet, the hood the chest, the head folded down into the chest under the middle of the car
  and the last thing out on the way up. The FUSELAGE FOLD (`fuselage-fold`, a jet; its dials `fold` and `legs`): lying
  face down in the jet, the nose and cockpit hinge down onto the chest (`front`) or the tail hinges down behind as a
  pack and the front of the fuselage stands up as the chest (`back`); the legs stretch back as the engine nacelles
  (`stretch`) or tuck up into a box under the fuselage (`box`). A panel may now SWING about a hinge on its way between
  its places. The ALIEN JETSKI (`alien-jetski`): the alien body below, folded.
- **The alien body** (`transformation/alien-body.js`): a humanoid formed of pointed ellipsoid shells and their
  relations, no part a vehicle's or a suit's: shoulders thrown out and up, forearms fattening to blades, a head
  leaning forward like a dart, feet long spurs. Folded face down it is a hover jetski: a long keel (a blade down its
  back standing) runs under it as the hull, the thigh shells slide up beside it as sponsons, the feet hang as skegs,
  its blades, spikes and spine swing back as fins; it skims a hand's breadth over the ground on a light, quick drive.
  Palettes `void`, `chrome`, `ember`.
- **The craft rig** (`craft-shelf/craft-rig.js`): a craft archetype as a rig figure, one bone per item, so a jet form
  is the shelf's jet.
- **Forms in the engine** (`worlds/controllable/forms.js`): an entity carries `forms`, a rule per form, and B (the
  pad's L3) turns it into the next: an owned, invincible beat plays the figure's sequence, then the form's rule and
  pilot rule take over with the speed carried across (a walker's motion is a car's speed and a craft's airspeed, at
  least its take-off speed). A form may name its follow camera's stand-off; a flying form burns its jets with its
  throttle. A body mid-swing, mid-dodge, reeling or downed does not transform.
- **The World page** plays each form's own clips (`vehicle:drive`, `vehicle:idle`), a flying form's attitude on its
  rig and the flight HUD for a body whose form flies, all emitted only when an entity or figure carries `forms`.
- **The doors.** `figures.<name>.transformer: { robot?, vehicle?, scheme?, height? }` bakes the body at resolve (a
  variable suit, a stored suit by `unitRef`, a stored build by `vehicleRef`, a ride, racer, supercar or craft);
  `compose_world` entities take `forms`, refused unless each names a rule the engine knows. A quick game's
  `transformer` is its hero (its `scheme`, `fold` and `legs` read and refused by what the vehicle is): a car-bot or an
  alien jetski plays a trail's goals, a flier the fly goal from its seat in the air. The cosmos
  counts `soul.hero=transformer` (web only; Godot and Roblox have no forms).
- A transformer exports to Godot and Roblox as its starting form. Its hero carries `forms` and no rule of its own (the
  page picks the rule as it starts), so an engine export found no pilot: the pack had nothing to drive. Every engine
  now takes such a body with its starting form's rule, chosen as the page chooses it (`engines/pack.js`
  `startingForms`), and the export names the rest as the page's: `forms` is a figure overlay, absent in both engines
  (the other form and the transform beat). A world without a body in two forms reaches the engines as before.

### Engine legs: the engines as translations, declared

Every engine pack is a translation of the web game. Which engines exist, what each one carries, and how each is
held equal to the web are now said once, in an engine registry, instead of in a Godot-shaped column threaded
through the code. Roblox joins as the second engine with a runtime kernel.

- **The engine registry** (`lib/graph/scene/engines/registry.js`): one row per engine (Godot, Roblox, Unity, Unreal,
  Blender), its kind (a runtime kernel, a scene project, an art pass), its marks module and the folder its pack lands
  in. The desktop packager's ignore list reads the folders, so a Roblox pack beside a desktop app stays out of it.
- **Marks per engine.** A mark row is keyed by its engine (`{ godot: 'built', how }`, `{ roblox: 'absent', how }`),
  every table in one vocabulary (built, approximated, absent), the bus rows among them. Each engine with a runtime
  kernel has its own marks module over the same closed keys (`godot-marks.js`, new `roblox-marks.js`); what no engine
  owns (the camera and traversal rules, the drawing options, the ledger's information rows) is in
  `scene/engines/marks.js`. `bus-abi.js` is the contract alone: which rows an engine performs is its marks' `BUS_MARKS`.
- **The score reads the engine it is for.** `extractEngineScore(…, { engine })` reads the level against that engine's
  marks; Godot packs are byte-identical. Unity and Unreal packs no longer carry Godot's reading rows, Godot's bus
  column, or a flag naming "the Godot kernel": their kernels run no bus, and their portability reads as before.
- **The cosmos counts every engine.** A facet value carries its mark in each engine (a sourced setting's `marks`
  reader runs once per engine; a value no one marked for Roblox reads as absent, while Godot still throws).
  `dryRun` returns `engines: { godot, roblox }`; the sweep, its CLI and the hillclimb page give each engine its
  column and its scoreboard. Roblox starts at zero worlds, and its scoreboard ranks what to build first.
- **The ratchet, per engine** (`scene/engines/marks.test.js`): every engine's tables are closed against the same
  sources (`scene/engines/mark-sources.js`), the cosmos registry agrees with each engine's export tables, and a young
  kernel marks a row only with the part of the place that carries it: a Roblox row not absent says how, and a built one
  names the kernel module or place file that performs it, which must be there.
- **One conformance protocol.** `scene/engines/conformance.js` says what each corpus holds equal (bus, combat, mind,
  rules, scenes: its scenarios, the kernel modules it needs by module id, the web's runs) and compares any engine's
  output to the web's frame by frame; `scene/engines/runners.js` says how each engine's kernel is laid out and run
  headless. `node scripts/conformance.mjs --engine godot|roblox --corpus <name>` replaces the five
  `godot-*-conformance.mjs` scripts (their Godot runners moved to `scripts/conformance/godot/`); it refuses, naming
  the module, a corpus the engine's kernel does not have yet. The sound meter's corpus keeps its own runner.
- **The Roblox kernel's first modules**, in Luau (`scene/roblox-kernel/`): the event bus, the stats and the game store,
  ported from the web runtime and laid out as the Godot kernel's modules, with `js.luau` saying once how JS reads a
  value (null and undefined, an empty array and an empty object, numbers printed as JSON prints them, UTF-16 hashing and
  order) and `json.luau` reading JSON as JSON.parse does. Pure Luau with no host API: the same modules run under Lune
  and in a place. The bus corpus runs equal to the web on them, frame by frame, stats and store scenarios included,
  and every planted bug is caught (`MOJULO_LUNE`, `scene/engines/conformance.test.js`). Lune and Rojo join the
  optional workers (`lib/workers/find.js`: `MOJULO_LUNE`, `MOJULO_ROJO`, a Roblox toolchain manager's or cargo's bin).
- The bus corpus gains words beyond ASCII (`text`: a spawn id hashed over UTF-16 code units, accented and astral words
  matched and stored) and the one place UTF-16 order and code point order part (`text-order`).
- **One pack pipeline.** `scene/engines/pack.js` holds what every pack is built from: the row and its pixelizer
  refusal, the recipe's hash, the level seam (resolveWorldScene → facesToGlb → the engine's score, the bus, the
  level's sound), a game's levels and posture, the music beds, and the clean emit that keeps the developer's folder.
  The Godot, Unity and Unreal legs compose it and keep only their own layout, sidecars and music policy; Blender and
  the arcade leg take its front. Every pack is byte-identical but one: a Unity game whose menu music is also a
  level's now ships `audio/menu.wav` (the importer probes it; the old dedupe dropped it, as Unreal's already did not).
- **`export_game { target: 'roblox' }`**: a game as a Roblox place, written as a Rojo project under `<ref>/roblox/`
  (`rojo build default.project.json -o game.rbxl`, then Play in Studio). The place carries the Roblox kernel as
  ModuleScripts; each level's bus.json and contract.json as the exact JSON text the kernel decodes; a greybox per level
  (every upward face of the level's mesh rastered into floor slabs, each box collider a wall); and a thin server that
  plays the levels in order, one player driving (set Max Players to 1: a script cannot). A Roblox Humanoid walks the
  player, its pace, jump and pull from the pilot's rule; the HUD is drawn as words (readouts in their slots, banners
  and toasts as moments); the bus's own entities are drawn as the page draws them; a key reaches the bus by the page's
  name for it; the outcome is applied to the store and the next open level starts. The level's look rides beside the
  project as `model.glb` for Studio's 3D Importer. What does not travel (menus, the web's walk feel, link travel, saves
  between sessions; a cast, its fight and its scenes since the whole level, below) is the portability report's, with
  each value's Roblox mark.
- **The level step and the game channel, in Luau** (`roblox-kernel/level.luau`, `game.luau`): where the bodies stand
  becomes zone facts, the bus runs in the page's frame order, its warps are handed back, and the page's game channel
  hears the log (the first pattern as written maps an event; an emit gathered and its `{event}` named, an end and its
  exit, a door left by once, the kept numbers rounded as the page rounds them). Held equal by a new **level corpus**
  (`scene/level-conformance.js`): real levels composed from their mechanics (pickups, hazards, a death, doors and named
  exits, a carried chapter, a kept score, laps on foot, a fall off the ground's edge and its warp back), walked in the
  web runtime and replayed under Lune frame by frame, its planted bugs caught. `json.luau` now keeps the order an
  object's keys were written in (`js.keys`), which the channel's first-match reading needs.
- **The Roblox gate** (`node scripts/export-roblox.mjs --ref <game>`, `scene/roblox-gate.js`): Rojo builds the place
  and Lune opens it, checks its tree, compiles its scripts and plays every level from the place's own kernel and data
  over the track the web recorded for it, frame by frame against the web, and checks the kernel it carries is the one
  the corpora hold equal. Advisory: without `MOJULO_ROJO` and `MOJULO_LUNE` the pack is emitted and the gate says why
  it skipped. The eyes gate is the operator's, in Studio.
- **Roblox marks, the first ones flipped**: the bus's logic, guards, warps, zones, timers, start and stats, the game
  channel and the colliders built; the walk and platform rules, the follow and eye cameras, the faces (as the greybox),
  the HUD (as words), key inputs and the play shell's level list approximated. Mechanics follow from the bus rows they
  use: reach-exit, fail-on-death and win-when built; collect, survive, hazard-damage, laps, score, clock and the rest
  of the zone family approximated; a door, a use and a beat absent (a cast, hits and sight came with the whole level,
  below). The hillclimb page's Roblox scoreboard ranks the rest.

- **The Godot kernel, principled** (kernel 0.29.0). Every step below is held by Godot 4.7.2 headless: the five corpora
  and the level corpus equal to the web, every planted bug caught.
  - `kernel/js.gd` says JS value semantics once (truthiness, `===`, ToNumber, the relational operators, String(v),
    numbers as JSON prints them, the deterministic stringify, FNV-1a over UTF-16, the glob, Math.imul and
    Math.round, a heading's vectors, a segment against a box); the copies in the bus, the minds, the fight, the
    rules, the nav and the game shell are gone, and every module calls it.
  - Two JS rules the old copies missed: dictionary keys sort by UTF-16 code units (an astral word before a fullwidth
    one, the bus corpus's `text-order`, now equal), and a glob's `*` stops at line terminators and matches to the
    very end, as a JS regex does (new scenario `glob-lines`). A string compared with `<` compares code units too.
  - `kernel/game_channel.gd`: the page's game channel, out of `level.gd` and held equal by the level corpus (now run
    on Godot too, with its own plants). It settles three ways Godot's outcome drifted from the page's: a level's
    `initial` events are not mapped through the contract (the page's channel listens only once the bus has
    started), a kept number's `scale: 0` is no scale, and a var holding a number's text is kept as its number.
  - `kernel/beat.gd`: the music's beat clock, out of `level.gd`.
  - One frame, live and in the harness (`level.gd _frame`, its order written beside it): the frame's presses, the
    beat, the bus and the fight's first half, then the drivers, the pilot by its rule and the fight's second half.
    Live play steps it on the physics tick with the keys as the pilot's input, where it used to step the pilot on its
    own tick before the bus heard where it stood; a ruled walker no longer steps itself.
  - The cast's edge-detected facts remember the last read in the cast's state, not in the module.
  - One input a frame, for the pilot's rule and the fight: A / D turn and Q / E strafe as the page binds them (the
    fight read A / D as a strafe, so a swing picked a side the page would not), and a recorded `fire` and `aiToggle`
    now reach the fight in the harness; G toggles the AI live.
- **The web harness freezes as the page does.** The level sim (`game/level-sim.js`, the truth the engine harnesses play
  against) walked the pilot on under a menu: it read the menus one step late, and its frozen step passed a zero `dt`,
  which the world's step reads as 1/60. The page steps no world while a menu is up, from the step right after the bus
  that opened it; the sim now does too, and a level that opens a menu under a held key plays equal in both engines
  frame by frame (`godot-frame.test.js`).

- **The Roblox kernel, whole** (`scene/roblox-kernel/`): the motion and camera rules (`rules.luau`), the cast, the fight,
  navigation, the minds and their groups (`cast.luau`, `combat.luau`, `nav.luau`, `mind.luau`, `group.luau`), and the
  scene runner and quest journal (`scenes.luau`, `quests.luau`), ported from the Godot kernel and held equal to the web
  under Lune by the same corpora (rules, combat, mind, scenes), default and seeded, with planted bugs in every module
  (`engines/roblox-rules.test.js`, `roblox-combat.test.js`, `roblox-scenes.test.js`); the corpus holes the plants found
  are listed in those tests as survivors, so a scenario that closes one says so. Every corpus now has its kernel in
  both engines.
- **A whole level in the Roblox place.** `level.luau` builds a level's cast, fight, minds, scenes and journal from its
  bus.json and steps them in the page's frame order, with the Humanoid's pose as the pilot (a Humanoid has moved by the
  time the server steps, so the fight runs in one call where Godot splits it round its own pilot). A new **levelcast
  corpus** (`level-conformance.js castCorpus`) plays real composed levels on the web (guards that spot the pilot, a
  melee fight, an ambush that bites, a cast cued by the bus and a scene) and feeds Lune only the pilot's pose: the bus
  and every other body equal frame by frame, with plants for the order (`engines/roblox-levelcast.test.js`; the
  corpus has no Godot runner, `runCorpus` says so). The place ships every kernel module; the server draws each body as
  an anchored box (downed laid flat, sent away hidden), the left mouse button is the fight's fire, G the minds' world
  switch, and a scene's line and choices show in a box at the bottom. The place gate plays a cast level whole from the
  place's own kernel (`sneak-game` equal to the web). Marks flipped with it: the `ai` rule, the world switch and the
  tier, the cast's facts, hits, beams and sightings, the rearm and the cast rows built; the cast's effects (a box
  each, its moments undrawn), the bodies, scenes (words, no bars or shots) and quests (a word, no journal)
  approximated; the platform rule's strike runs in the fight. hp-pool, defeat-all and unseen now travel.
- **Where the Roblox ports found Godot off the web** (each now a scenario, with a plant per engine). A swing or a
  round spends the hero's guard (`guard-and-overdrive`, `guard-spent-by-a-swing`: a spawn guard held the hero
  unhittable for its whole clock); an overdrive's rounds hit 1.5 times as hard; a respawned mind is a fresh life, its
  last sighting forgotten (`respawn-forgets`; the mind corpus now takes cast ops as the combat corpus does); a scene's
  condition compares as JS does, a number's text as its number (`scenes-text-var`). Below what a corpus can see, the
  same port: a walk's turn in the web's `((x % τ) + τ) % τ` (Godot's `fposmod` parts by an ulp on about one heading in
  sixteen), the spawn's `among` measured in doubles (not a float32 `Vector2`), an empty `land` lands never, a null
  wait time or beat read as the web reads it.
- **A target, as advice** (`intent.target: 'roblox' | 'godot'` on a gameworld). The world names the engine the game is
  meant for, alone or beside its genre and cube; `design_game`'s readout (`intent.target`, a `target` next step) and
  the game bible then say which of the cube's values that engine does not carry and which it carries in part, read
  from the same marks the export reads. Nothing is refused and nothing rewritten: the game still makes and exports
  whatever it holds, and dropping the target drops the advice. An engine without marks is refused as a target, naming
  the engines it can be.
- **The Roblox marks made true across the registry.** A facet value marked inline for Godot read as absent on Roblox
  (its young kernel's default), so the 3D medium, a linear game, a stage kit or melee read as lost: the advice and the
  hillclimb page's Roblox scoreboard said so. Each is now marked for Roblox as the place carries it (the voxel look
  and coloured floors for kits, looks and level forms; the Humanoid for the hero, its walk, jump and stop; the fight
  for melee, ranged and gear; the stats kernel's own table; scenes, quests and talk as words; links, traversal and
  systems by what the greybox and the kernel do), and what the place does not do stays absent (pixel, weather, the
  top-down, side and fixed cameras, hubs and doors between levels, drive and fly, runs, the shot camera).
- **A Roblox place that looks like its level** (`scene/roblox-look.js`), built from the recipe on the operator's machine:
  nothing is uploaded and no account is needed. The floor slabs wear their faces' colours, each a Roblox material its
  texture or group names (grass, rock, bark, brick, slate, soil…), or else what the material shelf stamped on it (a
  metal surface or metal row Metal, mill scale CorrodedMetal, the glass row Glass), a textured face its tint times its
  texture's mean colour, a blend tile's over the ground it lies on where the tile shows (a meadow's grass, the trail's soil through
  it); a slab splits where the look changes, but the grid coarsens on the slabs merged by height alone, so the look
  never changes what the player stands on; a face too small to cover a cell's centre (a lane's dash) colours it only
  where nothing covering it lies near. The floor grid starts no finer than its area allows, so a road world kilometres
  long exports instead of overflowing. The rest of the
  level (walls, rocks, trees, props) is voxelized into boxes of one colour and material each, the voxel coarsening to
  fit a part budget, and the level's instanced repeats (a wall laid in bricks with `instance`, a stand of trees, a
  road's furniture) join it, each instance placed and tinted as the page places it, so they no longer go missing in
  the place, within a box budget of their own so a forest never coarsens the level; ground cover the page draws as cards, ground shadows, blend tiles and a backdrop are left to the
  slabs and the sky. The look is decoration only: no body collides with it and no ray meets it, which the place gate
  now checks part by part. Colliders become unseen, as on the page. The cast stands as block figures (a mind in red,
  the rest in blue) instead of boxes. Marks: the faces, textures and figures approximated; colliders built.
- **The harness stands where the page stands.** The level harness (`game/level-equivalence.js`, the web side of every
  engine comparison) raycast the recipe's raw faces, while the page meshes them first: surface cards realized, then
  de-collided, which lifts a patch stacked on coplanar ground a step for every face under it. A kart track's patch
  sits 1.27 cm above its raw height on the page, and so in Godot, whose land is the GLB the same pass wrote; the
  harness read the raw 0.05, so the fixture matrix blamed Godot. `pageGroundFaces` gives the harness, the level
  corpus's fall and the levelcast corpus's land the page's faces. The kart racers now hold equal for their first
  thirty seconds where they parted in one, and the supercar race is frame-equal start to finish.
- **A walk stands on the ground, on both engines.** The cast's walk (`cast.gd`, `cast.luau`) is pushed out of the
  level's boxes and stood on its land as the web's `stepRoute` does, at the body's own eye, height, radius and step
  (a cast row carries them as `walk` where the rule is not the walk's default). A farmhand minted below the ground
  stood there in Godot; the farming fixture is now frame-equal. The combat corpus prints where each body stands, and
  a scenario walks a body up from below the ground and round a box (`walk-on-the-ground`), with plants per engine.
- **A round's hit says what it dealt, on both engines.** The web's `hit:<id>` fact carries `dmg`, `harm` and `head` for
  a ranged hit (a round or its splash) so the bus can take it from an hp of its own; `cast.gd` and `cast.luau` dropped
  them. The combat corpus's snapshot now prints them (every ranged scenario carries them), and both kernels are equal
  again.
- **Every events key the page reads is marked, on both engines.** The marks ratchet reads the keys the World page's
  events channel takes (`mark-sources.js` `pageEventKeys`) and holds each engine's `EVENT_MARKS` to them, as it holds
  `PAGE_MARKS` to the page's inputs. The party's battles (`rpg`), the effect light and style floor (`fxLight`,
  `fxStyle`) and the minigames (`minigames`) are marked absent in Godot and Roblox, so an export says why each stays
  the page's. What 3.1.1 added is marked too: `versus` absent in both; `vertexContrast` approximated in Godot (shaped
  into the GLB, no Godot leg plays a geocube world yet), absent in Roblox; turn-based combat, now the party's rounds,
  approximated in Godot (the one-on-one battle travels); and the `party` mechanic, whose slice the web's `play.rpg`
  loads and writes, absent in both.

### Godot plays what the web plays

If Godot can run it, the export runs it; what Godot cannot run is named in the export, never dropped silently. The
JS runtime is the truth, and the Godot export is held to it by playing both.

- **One portability source.** `lib/graph/scene/godot-marks.js` marks every World page input, controllable rule,
  events key, gait, system, traversal entry, link and mind value `built`, `approximated` or `absent`; the export
  (`engine-portability.js`, the score's ledger) and the cosmos registry read the same marks, and a mechanic's mark is
  found by lowering it and reading the bus rows it uses (`laps` and `score` travel, keeping no best; `unseen`,
  `on-beat`, `push`, `crops` and `supplies` name the row they lack). Every cosmos value now carries a mark, and a
  value the web builds that Godot loses is what fails a world.
- **The ratchet** (`godot-marks.test.js`, no Godot needed): an unmarked page input, rule, events key, bus verb, cast
  op, ledger row, mechanic or cosmos value fails; so does a cosmos mark that disagrees with the export's tables, and
  a `built` mark that names no Godot leg proving it. `bus-abi.js` reads its verbs from the bus, the cast and the stats
  kernel themselves (a stat cue now counts as `level-up`, which the hand list missed), and gains the `entities`
  (markers) and `shot` rows.
- **The export says what it is.** The score's ledger reads the rules a level runs (its camera's included), the page
  channels and events keys that do not travel whole; `assessPortability` flags them, and `export-godot.mjs` and
  `export_game` stamp `verdict: plays | plays-partly | hollow` with its lost list beside an unchanged `ok`. The pack
  README gains a Portability section. It stamps; it never refuses. Unity and Unreal read as before.
- **The level-equivalence harness.** `lib/graph/game/level-equivalence.js` plays a level in the web runtime from a
  win script (steered toward the contract's audits, recorded as input) and a stay-put control; kernel 0.21.0's level
  replays the same input at the same fixed step (`scripts/godot-level-sim.gd`) and both print one key a frame (the
  bus's `hashState` and the entities, quantized to 5 cm). `scripts/godot-fixture-matrix.mjs` makes every cosmos
  fixture a game through the quick path, exports, imports and plays it in both; `npm run test:godot` runs every
  Godot leg and the matrix, and fails without `MOJULO_GODOT`.
- **The scoreboard.** `docs/tool-surface/hillclimb.md` gains a Godot section: the fixtures' lost lists, the ladders
  and the values that would free the most worlds.
- **The beat travels** (kernel 0.22.0). A level's `audio.beat` rides `score.beat`, and the kernel says each beat on
  the bus from its music player's clock as the page does from its AudioContext: one function, `beats/beat-clock.js`,
  held equal at seeded jumpy clock readings, and an on-beat level is equal on its bus frame by frame. On-beat travels.
  The web's `level-sim.js` keeps the beat too, and the harness's input frames press keys.
- **Rounds and their reserve travel** (kernel 0.22.0): `kernel/cast.gd` performs `rearm` and `kernel/combat.gd`'s
  reload draws from the weapon's reserve, dry when both are out, held equal by the combat corpus.
- **The bus's own entities are drawn** (kernel 0.22.0): `level.gd` draws each as the page does (an unlit sphere, its
  radius and colour, where the bus puts it, shown while on), so a pushed boulder, a growing crop and a supply travel;
  a pick or a shot (`inputs` on `pick` / `fire`) names the marker its ray meets (`fact:aim`, approximated: the ray
  meets the markers and the box colliders, not the GLB's meshes). Push, crops and supplies travel.
- **Turn-based battles and routines travel**, proved equal frame by frame (`godot-story-rows.test.js`): a battle's
  menu, its guarded vars and the foe's answer; a routine's hour cues and the cast's walk. On the way, two kernel
  divergences the harness found are fixed: a menu up now freezes the world and its clock as the page's does (the bus's
  timers and sagas, the cast, the fight; `level-sim.js` models it too), and the cast and the fight step after the bus's
  ops, as the page's world steps after its events (a walk ordered this frame moves this frame).
- **The clock dial travels** (`weather/clock-dial.js`, held equal to the page's own emitted night): a level's clock
  darkens the Godot sky at night and its season swaps the climate (`score.weather.clock`, each season's schedule);
  day-night and seasons travel as the weather does (approximated: fog, colour and light), and growth with them.
- **Planted bugs are a standing test** (`godot-plants.test.js`): mutants per kernel script (a flipped comparison, a
  reserved key dropped, a timer a tick late, a reserve ignored …), each of which must make its corpus fail. Three
  found holes in the corpus (an emit carrying reserved words, a heal past hpMax, a level past its max), now closed.
- **The bus corpus plays every mechanic that travels** (`bus-conformance.js` `mechanic-<kind>`), held equal in Godot;
  the ratchet asks for each by id. **The harness has planted bugs**: `godot-harness.js` `mutate` edits a copy of the
  kernel, and each plant must break an equality.
- **The honest baseline.** The sweep's Godot survivors fall from 56 to 8 of 500 (21 to 0 near the probes): the mind,
  the gaits, the story and the cameras were counted as travelling and do not. The walker's ground is a flat plane
  under a hilly trail (marked approximated, found by the matrix).
- **The pilot walks and runs by the web's own rules** (kernel 0.23.0). `kernel/rules.gd` ports the walk rule and the
  ground half of the platform rule (run; tank, look, world and lane turning; the jump with its cut, buffer, coyote
  time, wind-up, air jumps and glide; boost and its gauge; the colliders slid along), and the pilot stands on the
  level's own faces (the GLB's triangles, as the page's ground raycast meets them), not on a flat plane. The score
  carries the pilot's rule (`score.pilot`, recipe units). A rules corpus (`rules-conformance.js`,
  `scripts/godot-rules-conformance.mjs`) holds it equal to the web's frame by frame, and a whole level climbs a ramp
  and jumps a ledge key for key in both engines, the pilot included. A power's move (`game.powers`) merges into the
  rule when the bus hears it picked up, as the page grants it (`level-sim.js` models it too). The platform rule's
  opt-in moves the kernel does not run (space, the boost hover and slide, the charged jump, the kneel, the dodge, the
  tackle, a loadout) are named per level (`PLATFORM_KEYS`), and a walker besides the pilot is flagged as standing.
  Walk, platform, the platformer kit, unlock, the gap link and the metroidvania idiom are built.
- **The page's cameras travel** (kernel 0.23.0): follow, eye, overhead, side and fixed run in `kernel/rules.gd` after
  the pilot, held equal by the same corpus, and drive the level's own Camera3D as the page's `__driveCamera` drives
  its camera (a whole level checks the pose every frame against the page's own driver, lifted out of its source).
  The score carries the page's camera (`score.camera`). A camera that watches anything but a pilot the kernel walks,
  and a follow camera's lock tracking, are flagged. The page pulls its chase camera in by its 3-unit stand-off even
  with no wall between (a twin bug, named by a failing test in `godot-rules.test.js`); Godot matches it.
- **Travel travels** (kernel 0.23.0). `store.gd` gains the web store's item gate, a door's transit, and a map's
  reachable levels and exits (held equal by the store corpus). `game.gd` goes on through the exit a level was won by
  (telling the next where it came from), takes a door into the linked level by its own door with the session carried,
  draws a run with the web shell's own roll (lifted from `play-shell.js` and held equal) and keeps the deepest, and
  keeps each kept number's best in `user://`; the menu shows a run's title and a map's found levels. A level ends
  through its named exit, leaves by a door once, hears `arrive:<ref>`, stands at the door it came in by, and sends its
  kept numbers, as the page's game channel does (`level-equivalence.js gameChannel` models it for the harness;
  `godot-travel.test.js`, `godot-game-shell.test.js`, each with plants). A level with no faces stands on the score's
  implicit plane; a script that moves the walker's node moves its rule's pose. Interconnected, building, buildings,
  street, runs, doors, links and kept bests are built.
- **Scenes and quests travel** (kernel 0.23.0). `bus.json` carries the scenes' program and the quests' journal;
  `kernel/scenes.gd` ports the page's scene runner (beats, typed lines, presses, holds and skips, choices) and
  `kernel/quests.gd` its journal and news, held equal step by step by a corpus (`scenes-conformance.js`,
  `scripts/godot-scenes-conformance.mjs`, with plants). The level steps the runner where the page does (after the
  bus's ops): its beats go back to the bus, its shots set `kernel/rules.gd`'s new shot rule (frames, moves, the side
  of the line, the clear view) aside the page's camera, a skip lands the walks (`cast.gd finish`), the pilot's input
  is held while one plays, and the bars, the text box and the choices are drawn; J opens the journal and a word shows
  as a quest moves on. `level-sim.js` plays scenes too, so a whole level (a scene watched, answered and skipped) is
  equal key for key with its directed camera. A twin quirk is named (`godot-scenes.test.js`): the page draws half of
  an emoji for a frame as a line types on; Godot keeps the half back. Talk, the shots, framing, steps and quests are
  built.
- **Vehicles travel** (kernel 0.23.0). `kernel/rules.gd` ports the drive rule (its power curve, brakes and reverse,
  the slewed bicycle steer, drag and rolling, the classes' opt-in grip, the ground followed down at a fall rate,
  walls, and flight off a ramp's lip or a crest with `air`), the racer (a rival driving its line: bends braked
  into, laps counted, a lane, a grip-bound speed plan, ramps lifted for, backing off when held up) and fixed-wing
  flight (taxi, takeoff, banked turns, stall, touchdown), held equal by the rules corpus (51 scenarios). A car or a
  plane pilot is walked by its rule with its own node riding the pose; the score carries the rivals
  (`score.drivers`) and the kernel drives them; the chase camera follows the car. A whole race (the car flown off a
  lip, the rival round its loop, the camera) is equal key for key. The ground's surface grip under a car stays the
  web's (`driveSurface`, approximated), and solid bodies that push walkers out on the web are named
  (`bodies_solid`). Drive, racer, fly, the vehicle hero and the circuit are built.
- **The look travels further** (kernel 0.24.0). Game packs ship their rigged figures skinned, as world packs do (one
  mesh, its clips, its face and ink: game-pack emission changes); the skinned suit follows the walker. The score
  carries the page's background colour, its sky dome, its distance haze and its pixel medium (`bg`, `skyDome`,
  `haze`, `pixel`), and `kernel/level.gd` builds them: a sky shader with the dome's gradient, stars, moon and sun
  (`kernel/sky.gdshader`), exponential fog in the horizon colour, the 3D drawn at 1/scale with nearest scaling; a
  toned stage is graded by `kernel/tone.gdshader` (the page's ramps, bands and detail); a metal reflects the sky, or a
  plain studio sky. A blend tile (the two-tile vertex blend) leaves the GLB as the page draws it, faded in per corner
  (COLOR_0 RGBA under a BLEND material, a cut layer masked) instead of an opaque tile over the ground. The figures,
  the background, the tone and the pixel medium are built; the dome and the haze are approximated (hashed stars, an unphased moon, Godot's fog curve); the backdrop image stays the
  web's. Under `--lit` a skinned figure carries smooth rest normals, so an engine light shades it (the default unlit
  export is byte-identical). Machine-held by `godot-look.test.js`; how it looks is the eyes gate.
- **The export's ground is the page's.** The GLB de-collided its blend tiles together with the ground they lie on,
  lifting the ground itself a fraction of a millimetre where the page leaves it; blend faces now go last (the page
  draws them in their own pass), and `score.blendNodes` names their nodes so the kernel's land leaves them out. The
  harness steps the world in the frame a level ends, as the page does. The fixture matrix reports how far a run
  drifts (`keyDrift`: the bus frames that part, the largest gap in quanta) and keeps both engines' keys beside the
  pack.
- **Clips play the page's keys.** Godot's scene importer bakes every clip at 30 fps, cutting across a key that falls
  between two samples (a figure's keys come every twelfth of a second: at a key, the hand of the hero's wave sat
  2.6 cm off the page's). A pack now writes, for each GLB whose keys miss that grid, the lowest rate from 30 up that lands on all of
  them (`animation/fps` in its `.import`; `godot-bake.js`). Pack emission changes for those GLBs only.
- **Worlds that are not games** (kernel 0.25.0). A world with no one to play (no seat, no pilot) opens on its
  authored view, as the page opens on its camera; 0 hands the view to the walker and back. A world's shoot plan plays
  its edit on P: the program camera the GLB carries, cut for cut, its lens frame by frame from `score.shoot` (a glTF
  camera keys no field of view); the set pieces, the transitions and the world's clock stay the page's (`shoot`,
  approximated; the `shoot_edit` ledger row). `--humanoid` (`export-godot.mjs`) ships a humanoid figure's world pack
  on the engine humanoid skeleton (the T-pose rest, VRM names, nested) with Godot's BoneMap named on it, so the
  importer makes it `%GeneralSkeleton` and any humanoid clip retargets onto it; the scene turns it from the VRM
  facing back to the world's. It holds the page's pose at every key; between keys each joint turns against its
  parent, so a fast move strays from the page's path (6 cm at the hand of the wave, between two keys), which is why it is opt-in and the
  default pack's `figure_humanoid` row says how to ask for it. Machine-held by `godot-edit.test.js` and
  `godot-humanoid-pack.test.js`.
- **The supercars and the race moods, named in Godot** (kernel 0.28.0). Every body the world moves now stands in the
  zones in Godot as on the page (the drivers and the cast beside the pilot): a rival that starts on its last checkpoint,
  or crosses one, counts its laps and its place as the web's does, where before only the pilot entered a zone. The
  flight games' chase camera banks with the craft in Godot too (`rollFollow`, a new rules scenario holds it equal). A
  supercar field ships skinned like a racer's, the moods' relit faces and sky with it; what the page alone lays on a
  car is now said per level (`figures_carried`,
  `FIGURE_MARKS`: the live overlay's steer and lean, the juice, a dark mood's headlamp pool and tail-lamp ribbons), as
  is the wet road's film (`PAGE_MARKS.wetRoad`). The fixture matrix gains variants past the cosmos fixtures: a field of
  supercars on a wet night, and an airspace in a palette.
- **The new games, swept** (kernel 0.27.0). On the rebase onto the flight and shooter games, the fly rule's dials run in
  `kernel/rules.gd` (a glider, the throttle lever, space without gravity or lift, the boost and its charge, the barrel
  roll, the arcade and sim assists, the map's bound), held equal by seven new rules scenarios; the space shooter and air
  combat now play key for key, the flight sim to a quantum. The new mechanics (respawn, frags, control, regen,
  abilities) carry their marks, and the arena shooter's match player and the minds' new moves (peek, floors, items, the
  gun for the range, perches, objectives, a flier's clearance) are named per level (`AI_LOST`), as are the guns' new
  ways (spread, recoil, falloff, headshots, the gun's hand, the round to the crosshair, homing missiles: `WEAPON_LOST`),
  until the kernel runs them. The fixture matrix mints the four new games.
- **The mind travels** (kernel 0.26.0). Bodies on the web's `ai` rule decide in `kernel/mind.gd`, a port of the web's
  mind: every motivation (hunt, guard, escort, territorial, wander, forage, flee, sentry), sight and memory with the
  search, cover from the one it fights, the blade with its combo and give-up, the roll off a stagger, the loadout's
  rotation, a world's tier and a body's own tuning, a boss's phases and adapting, the boost juke and space. It paths
  round walls on the web's grid (`kernel/nav.gd`), moves in groups (`kernel/group.gd`: packs, squads, herds, attack
  tokens) and fights with the kernel's trigger, blade and charge (`kernel/combat.gd`; a semi or lob weapon holds fire
  mid-thrust, as on the web). `bus.json` carries the minds (`minds`: each body's rule, the minds' weapons, the tier,
  the walls), the bus hears `seen`, and a level whose minds hit nothing still runs them. The mind corpus
  (`mind-conformance.js`, its first scenarios the cover law) is equal frame by frame at five seeds, and every planted
  bug is caught (`godot-mind.test.js`). The shooter and stealth fixtures now play their levels key for key. What
  stays the page's: the commander, and the shove-down set piece when an opportunist's counter-charge catches the
  pilot (the kernel plays the plain counter).

### Effects noise: flames and lightning, spell circles, a hex shield, an itano circus

- **Noise on the World page.** The terrain's gradient noise reaches the page twice: its own source for strand spines,
  and a GLSL twin on the same integer hash for effect shaders. Nothing carries either unless an attack or a look asks.
- **Lightning and flame.** A strand's `jag` throws lightning across its spine (noise, ends pinned), re-struck `flicker`
  times a second with `forks` branches. Its `fire` draws its head as flame: noise turbulence torn back from its
  flight, white to yellow to red. New presets `lightning` and `fireball`. Under `fxStyle` the attack's colour picks the
  material by rule: a warm bolt burns (its echoes a trail of smaller flames), a pale ray crackles.
- **Spell circles.** `charge.form: 'circle'` opens a sigil square to the target: rings, a rune band turning one way,
  a hexagram turning the other, an overshoot as it opens. The strands leave from it, so a wall or a floating caster can
  fire from a circle (preset `sigil`).
- **A hex shield.** A look's `shield { r, cells }` raises a half-sphere of hex cells round the feet, with a fresnel rim
  and a noise shimmer, and a ripple runs out from wherever a beam lands on it (preset look `ward`).
- **An itano circus.** A strand's `fan` launches each copy its own seeded way round the line, then curves it back in to
  land together. Presets `itano` (missiles with smoke trails) and `itano-laser` (homing rays).

### Effects: light and a style floor, by rule

- **`fxLight: true`.** On a world whose cues fire beams, puffs or explosions, every effect lights what is round it,
  the way fire already did: a strand's head, a ray's body and a charging orb throw the attack's colour as strong and as
  soft as the strand is wide, and a moment its own declared light, tinted by its colour or its kind (a strike cold
  white, a blast warm). Live steel, baked stone, the anime character light and creatures all take it. A night world
  takes it fully, a noon one a quarter. Nothing is authored per effect.
- **`fxStyle: true`.** Every attack is raised to a style floor by rule: no simple shape unless it is a line (a bolt
  trails fading echoes, a ray carries pulse bands and rings, every attack sprays sparks), layered colour (two companion
  strands in an analogous hue), chirality (the companions braid one way, the hand seeded by the attack; an explosion's
  sprays swirl with it), and the principles of animation (a charge before release, a head stretched along its flight,
  a gentle arc, echoes that lag, a flash where it lands, an explosion's ground ring echoed). An ink edge takes the
  attack's own darkened colour instead of black. A laser may stay one beam. An attack that already does a thing keeps
  its own.

### Level age and crystals: a cube's metal tells its age, its land grows crystals

- **`materials: { age }`.** A cube's materials take an age, `new`, `worn`, `old` or `ancient`: copper, brass and bronze
  tarnish brown and then turn verdigris green by their measured film law, and steel dulls and then blackens to forged
  scale. The painted tone of each aged group follows, so the toon light, the paint and the live metal agree. A group the
  cube names ages too, unless it names its own film or finish. Gold does not age. Absent, metal is bright, as before.
- **Armour cards name their materials.** A style card's `materials` says what its pieces are made of where its
  family's table would be wrong: `grim-scifi`'s trim is blasted steel, `armored-hero`'s faceplate brushed stainless, the
  rest of a hardsuit painted. They are worn only on a level that names `materials`, under the level's own overrides and
  age, so sci-fi heroes now take live metal, the cube's light and its age where their designer said metal.
- **Creatures wear their level's materials.** A creature names its level beside its plan (`spec: { plan, geocube }`, or
  `update_character { geocube }`). Where the cube names `materials`, its horn, hoof, beak and shell take a satin gloss,
  its outfit's metal and leather theirs, and its plan's own `materials` (as an armour card's) say the rest, all at the
  cube's age. A creature keeps its character light, so its materials are drawn: a metal steps higher, shades darker
  and glints. A creature's tones are its parts' tints. Absent a level, a creature is as before.
- **A level's cloth and leather are painted.** On a level that names `materials`, a figure's cloth (its top and
  trousers, its outfit's cloth roles, a stylist's garments) takes the bake's painted `cloth` finish, deep in its folds
  and darker toward its hem, and its leather the `leather` finish, a low sheen with its edges rubbed lighter. A group a
  material dresses (metal, satin, glass, rubber) is left to it, and so is every other group. A figure with its own
  `bake` keeps it; the character light keeps its own look. A plain hero is dressed too.
- **Cloths.** `linen`, `cotton`, `canvas`, `wool`, `felt`, `denim`, `silk`, `velvet`, `nylon`, `polymer`, `carbon weave`,
  `ballistic nylon` and the alien `membrane`, `spun filament`, `resin weave` are materials. On a figure each is painted
  its own way: wool soft with no ridge, denim faded pale at its ridges, silk a sheen band toward the sky, velvet dark in
  its body and bright at its rims. Under the character light they are drawn: silk a soft sheen, velvet deep and more in
  shade, wool a soft step, denim a cool shade, the synthetics a small sheen. A stylist's hero wears its genre's cloths
  on its top, trousers and outer layer (fantasy linen and wool, modern cotton, denim and nylon), and a cube names one
  for a group (`materials: { Top: 'velvet', Outer: 'silk' }`). Anywhere a material is taken, a cloth word now resolves
  to its shelf row.
- **`outside.crystals`.** A cube's island grows crystals: `'amethyst'`, or `{ gem, where: 'crags' | 'hollows', count,
  size, glow, seed }`. Seeded clusters stand out of the cliff faces or sit in the land's hollows, off the trail and the
  seam. They are real gems (the crystal channel shades them live, each throwing its own light, and the GLB carries them
  as see-through). Absent, the land is as before.

### Look materials: armour as material, metal in the cube's light

- **`materials` on a geocube.** A hero whose `geocube` names a cube with `materials` wears real materials on its armour,
  outfit and dress: plate as brushed steel, a lamellar's kanamono as gold, leather as leather, a hardsuit as painted
  satin, each metal group's metal read from the tone its card already wrote. `materials: { <group>: <material> }`
  overrides one. Plate then shades as live metal on the World page, in its clips too (the rig pack carries the metal
  channel per part), and exports as PBR. Absent, every hero is as before.
- **Anime heroes draw their materials.** Under the character light (an anime hero whose manifest names `toon.light`)
  the materials are drawn, not reflected: metal steps higher and shades darker (gold leaning red-orange, steel blue)
  with a small gloss tinted by the metal's measured colour, lacquer takes a small sharp gloss, leather a warm shade and
  a dull band, glass a white glint, rubber a deeper shade (`materials/toon-materials.js`). Such a hero wears no live
  metal. An anime hero in the cube's cast light wears the live metal as any hero does.
- **`contrast.metal`: metal in the cube's light.** Metal faces take the cube's occlusion (the foot of a wall, a crease,
  contact) as a multiplier the live metal shader and the GLB carry, and the live metal reflects the cube's own world
  (its sky over a daylit dome, its ground leaned toward grey) instead of the studio's dim room. A hero on such a cube
  takes it on its metal alone. Absent, metal is shaded as it was. `upland-morning` turns both on.

### Sixth-gen land: ground, mix, facets, valley

Four opt-in words on a local meru (and a geocube's outside), each absent unless asked, so every cube and stage
renders byte-identically without them.

- **`ground`: a terrain world under the level.** `meru.ground` / geocube `outside.ground` takes a painted scene
  (`{ from: { heartbeat, splatch, seed }, span, height, at }`) through the `terrain` kind's field (its landform,
  erosion and fracture detail) and lays it under the plain: its lowest point under the level is the datum, its range
  scaled to `height`, eased in from the seam. The island's geology still reads only the mounds and the high shore as
  raised land.
- **`shading.mix`: surfaces mixed per corner.** Each corner takes rock, grass and sand by how much of each lies round
  it, spread `mix` metres and drawn back to a soft, noisy edge, on both sides of a seam: grass meets rock in a curve,
  not in the grid's steps.
- **`shading.facet`: rock in planes.** The rock's grid heights are drawn onto facet planes about `facet` metres wide
  before the land is lit, so a cliff reads as planes of stone instead of a checkerboard of half-metre quads; the
  grass's corners stay where they are.
- **`island.seabed: 'merged'`: the flat seabed in large quads.** Past the beach an island's floor is one plane under
  deep water, yet it was drawn in the land's half-metre quads and was most of the faces. Merged, it is a few dozen
  quads: the upland island goes from 31,944 faces to 10,395 and builds in under half the time, its renders matching the
  grid's to within 13/255 on 0.04% of pixels. `'grid'` (the default) draws it as before.
- **`upland-morning`, a geocube preset with them on.** Valley-morning's look (its colours, light and contrast) on a
  rocky upland: a `rocky-irregular` ground at 45 m and 3.5 m, mix, facet and valley. Its island merges its seabed. The shipped presets are unchanged.
  The geocube card took an `outside` line naming relief, ground and the land words (its ceiling re-pinned 4000 → 4600).
- **`shading.valley`: the sky a hollow loses.** The foot of a slope, a hollow and a gully darken toward the shade by
  how much sky the land round them hides, read over tens of metres and beyond what an even slope of the same grade
  hides.

### Perlin spike: relief for the geocube land

- **One noise module.** `lib/graph/noise/noise.js`: 2D gradient noise on the terrain kernel's integer hash and
  8-direction table (the same values as `terrain-kernel.js gn`), its analytic gradient, fractal sums in four flavours
  (`fbm`, `ridged`, `billow`, `damped`: detail suppressed where the slope is already steep, the eroded look) with
  octaves rotated off the lattice, domain warp and terraces. Only + − × ÷, floor and imul on the height path, so a
  field is the same in every engine.
- **`relief` on a geocube's outside.** `outside.relief` (and `outside.terrains.<name>.relief`) names a relief card
  (`rolling`, `craggy`, `eroded`, `terraced`, `dune`) or `{ from, …changes }`; the stage's meru carries it and the
  local meru lays it on the plain under the seam fade. On an island it only lifts the plain (a hollow would drown the
  grass in beach), and where the island draws its mountain as land (`walk: 'base'`) it runs up the mounds too, so the
  geology breaks already-broken ground. Octaves are set in metres, not by the mesh. A cube without relief lowers and
  renders byte-identically. The geocube routing card names the word.
- **Grain in the vertex.** The relief's octaves finer than the land's cells go to colour only, filtered over each
  corner's footprint (`relief.grain`), so the polygon land's light carries detail its geometry cannot.

### RPG improvements: a cast rolled for the game, familiars that fight on their own, moves per character, minigames

- **The cast roller** (`lib/graph/egocube/cast.js`, `rollCast`): an anchor Egocube and the people rolled against it,
  as docs/egocube.md designs it. Relations (shadow, rival, foil, mentor, party, familiar, lieutenant, mastermind, rank,
  and the journey's herald, threshold guardian, trickster, shapeshifter, ally) aim a target distance from the anchor on
  the archetype wheel, the role, the build and the age, and pull motivation and order; `complement` proposes the roles
  and archetypes a party lacks. The laws are checked as each member is rolled (party silhouettes distinct, a shadow in
  its anchor's shape and a rival in another, the size ladder, the bookends on motivation); a broken law draws the later
  member again, never the anchor nor an ask, and one still broken is kept and named. Seeds are keyed by path and members
  roll in order, so a cast only grows. `castOfScale` is the completeness ladder: hero, rival, party, journey.
- **Beasts, beast-kin and mascots in a cast.** `bond: 'party'` is first party (Kimahri, Red XIII); `bond: 'familiar'`
  is second party, kept by its parent and wearing its accent (a stand, a summon, a poke-companion). A body is a person,
  beast-kin (a beast lineage), a beast (a real species, through the animal door) or a mascot (chibi); unasked, a party
  member's and a familiar's body is thrown on the setting's odds (a myth has beast-kin at its fires), `bodies` leans them.
- **`rollEgocube` takes `lean`, `pull` and `redraw`**: a relation's multipliers on the priors, motivation and order drawn
  near a target on each attempt's own die (never an ask), and the attempts a cast's re-draw starts at. Absent, every
  sheet is byte-identical.
- **A cast is a cube**: `create_sketch({ kind: 'egocube', cast: { anchor, cast, factions, setting, bodies, seed } })`
  rolls and keeps the cast (`castSheet`); its preview is the members standing in a line, a beast among them as the animal
  kind makes it. `create_character({ egocube, member: 'hero/rival' })` makes one member through its door (a beast through
  the animal door); the character records the member it was made from. New routing card `cast`.
- **The casting page** (`lib/graph/gameworld/casting.js`, `characters.casting`): the book's people rolled for the game in
  its setting (a turn-based world reads as a battle), as many as it asks for: `scale` hero | rival | party | journey, or,
  absent, the world's prompt words (saga, a party of four, rival, familiar, chibi, beastfolk), else a party for a world
  that fights turn by turn. The run writes one egocube row (`<ref>-casting`) and makes each member from it
  (`<ref>-cast-<id>`); a journey cast's members wait on the new `characters:cast` review part (the sheets are the
  proposal). The first party fights in the battle party from the start, and the hero with it, each in the class its sheet
  reads as (`classOf`) instead of the rotation; a `joins` flag on a member brings it to the field as a written companion.
  The story, the bible and the field party read the rolled members as cast members. A book without the page is untouched.
- **Familiars that fight on their own** (`play.rpg` party `auto: true | { keeper }`): a second-party member picks for
  itself when its turn comes, from the field as it stands and never on the dice: it mends the hurt (its keeper first),
  raises the fallen, strikes a weakness, finishes the weakest foe, else hits the one that hits hardest. The page asks no
  command of it, on rounds or on the timeline, and it takes no place of the party's `size`. A casting page's familiar
  of the hero or of a first-party member fights beside its keeper. The kernel and the rpg channel are emitted into every
  page with `play.rpg`, so those pages' text moves; a party with no `auto` member plays the same battles.
- **Reactions for every hero, lifted from the versus fighter** (`lib/graph/polygonizer/hero-react.js`): new motion words
  `hitHigh`, `hitBody`, `hitLow` and `stagger`, a `react` move family. The fight's own impact poses and its stagger
  (`versus/versus-react.js`) are read onto the hero's rig through `planeToVajra` (the fight plane's segment angles as
  the hero's joints), not copied: struck fast, held through the blow, given back slowly, the feet planted, home on the
  stand. With the rest `knockedOut` (the topple and the rise) a hero can now take a hit, fall and get up.
- **A cast member is made with its moves** (`lib/graph/egocube/moves.js`, `moveSetOf`): its ready stance and its attack
  by its role, its reactions, and its win by its archetype, as hero motion words, so its page's clip picker plays them;
  `create_character` says which (`egocube.moves`). One character from a single egocube is made as before.
- **The combat states play a hero's own reactions** (`playscape/player.js` `playerStates`): `stagger`, `topple` and
  `getup` map to its `stagger` (or `hitHigh`), `knockedOutDown` and `knockedOutUp` when it has them.
- **The level map plays each member's own moves.** A casting page's member carries its `field`: the runtime states its
  own moves play (`egocube/moves.js` `fieldStatesOf`: the hit's lurch, the topple and the rise, a swing as its attack).
  A figures-map hero takes `moves` beside `clips` (`worlds/world-scene.js`): each state plays the hero's own clip over
  the library's when it has it, and keeps the library's when not. Its first party and its familiars walk beside the hero
  from the start (`play.party` members may now leave out `joins`: woken as the level starts, no flag carried). A level
  with no casting page is byte-identical.
- **Beasts, mascots and beast-kin walk the level map too.** A cast's beast is made with its two gaits rigged
  (`moves.js` `beastGaitsOf`: the wolf's walk and trot, a bird's walk and hop), and a beast-kin below the hero door with a
  walk, a jog and the moves its creature rig solves (`creatureMovesOf`: a stance, a strike, the reactions and the fall;
  a showcase pose is a person's). On the field each walks on its own clips with no library (casting.js `fieldOf`): the
  mascot its run, walk and idle, the creature its jog and its moves, the beast its gaits. A figures-map entry marked
  `walker: true` (it follows or stands, never pilots) may be any rigged character (`heroRefError`'s `walker`).
- **A beast takes a blow** (`lib/graph/fauna/behavior/react.js`): new animal motion words `flinch` (dropped low, the
  head thrown up, back to the stand), `fall` (onto its side, gathering speed) and `rise` (back up), each a one-shot
  between poses the behavior solver already solves for its own body (every bone slerped between them), on any body
  with legs (`{ reactions: 'all' }`, or the words in a motion list). A cast's beast is made with them, and on the level
  map its hit, topple and get-up play them. An animal without them builds byte-identically.
- **Legless beasts and mascots take a blow too.** A snake or an octopus flinches by rearing back from its coil into its
  strike coil and falls laid out flat (the flatter of on its belly or on its side for that body); a swimmer has none
  yet. A cast's mascot is made with `flinch` (squashed down, the arms thrown up, the surprised face), `fall` (tipped
  over its feet onto its back, eyes shut, its head on the floor) and `rise` (back up through a crouch), and plays them
  on the field (`mascotPlan`'s `reactions`; every other mascot is minted as it was).
- **Keyed one-shots and a body tipped over its feet** (`polygonizer/station-loft-rig.js`): a plan clip may be
  `{ once: true, keys }`, packed 0 … 1 inclusive as a function clip with `once` is (a fall that ends lying down); a key's
  `body: { pitch?, roll?, up? }` without `at` turns the figure about the floor under its feet. Clips that use neither
  are byte-identical.
- **Minigames: the games inside the game** (`playscape/ui/minigames.js`, `scene/channels/minigame-channel.js`).
  `play.minigames: [{ id, game, at?, prompt?, goal?, gold?, purse?, prize?, flag? }]`: interact at its place (or emit
  `minigame:<id>`) and a round comes up in a pixel window over the field, the world held still as in a battle; `blocks`
  and `match` are the arcade cabinet's own reducers (brickster, the philosopher's stone trial), `fishing` a new one
  (`pixelizer/fishing-core.js`, `fishing-skin.js`: hold the line over a darting fish until it is landed, a few casts a
  round, five fish from minnow to golden koi). Its score pays gold into the party's purse (a bag transfer when the purse
  is the bag's, so it is carried), keeps `minigame-best-<id>`, and says `minigame-won:<id>` or `minigame-lost:<id>`; the
  first win gives its prize and sets its flag. The page inlines only the games a level plays; a level without one
  carries not a byte of them.
- **Minigames in the game book** (`gameworld/minigames.js`): `minigames: true | false | [game | { game, … }]`, or heard
  in the prompt (minigames, carnival, fishing, arcade, match-3). A keeper (one figure, made as the foe is) stands at each,
  spread across the game; the winnings go into the carried bag (the battles' bag, or its own). A world that asks for
  none makes the same steps it did.
- **An arcade in the inn.** A game's `where: 'inside' | 'trail'` (blocks and match inside by default, fishing on a
  trail, each on the other when the world has none of its kind) puts its keeper in a building's room: a tavern's snug
  or taproom, a hall's hall, a shop's floor, a library's reading room (`ROOMS_KEPT`), in the corner farthest from the
  way in, a building level or the inside of one entered by its door alike. A building level now takes a stage's extra
  (its rooms and use on its ends, its mechanics the level's); a building without one is the level it was.
- **One way to stand people on a stage** (`gameworld/stage-figures.js`): a figure on the shared library or on its own
  clips, a person's body numbers, the entity of one who stands, and a stage's extras composed, where battles, minigames,
  the story's cast, guards and every quick goal's figures each wrote their own. Every run's orders are unchanged.
- **A quick game's cast** (quick.js `cast`, casting.js `castingPage`): any quick goal on foot takes the casting page
  (less the journey; `true` a party of one), rolled in the game's setting and made as the book makes it (one cast row,
  each member by path). Its party and familiars walk beside the hero from the start on the escort motive and fight what
  it fights, on the pilot's side in a team game; a rival with a person's body stands as the first foe in a battle, a
  shooter or a deathmatch; the readout says where each went. A quick game without one makes the steps it did.
- **Every person a run makes can take a blow on its own rig** (a world's `moves: true`, a quick game's lever; egocube/moves.js
  `REACT_MOTION`, `reactStatesOf`): the hero (through its motion page), the battles' foe, a keeper, and every quick
  figure (foes, guards, towers, farmhands) are made with their own hit, stagger, fall and rise, and each figure standing
  for one plays them over the library's (levels.js stageLevelOrder `moves`); a mascot hero its own flinch, fall and rise.
- **Beast foes** (`foe: { species }` on the book's battles, a quick battle or a defence; stage-figures.js `foeFigure`): the
  foe is made through the animal door with its two gaits and its reactions (design_game realizes an `animal` order) and
  stands, walks and takes a blow on its own body; a shooter's or a deathmatch's foes keep a person's hands.

### README demo: a floor plan to rooms you can live in

- The README and the npm page lead with `docs/images/decor-demo.gif` in place of `lounge-handoff-demo.gif` (which
  the long tour keeps). It is one real Claude Code session, recorded rather than staged: a homeowner uploads their
  floor plan as a picture and asks, in their own words, for ideas for living in it (warm, natural, a bit cozy: the
  living room, the dining room and the big bedroom), then for sage green living-room walls and the sofa turned to the
  windows, then for a walkthrough video. The agent reads the plan, builds the house with `mint_building`, designs and
  then repaints and rearranges the rooms with `design_interior`, and films and stitches the walkthrough itself. The
  change is shown from eye level, aimed at what moved, as a before and after swept in by a glowing line; the last
  slide is the session's own working time, tokens and cost at API list price. README section 2 walks through it.
- `docs/images/src/decor-demo/` re-runs it end to end: `plan.mjs` draws the uploaded plan (`house.json` as its own
  A-101 sheet), `run.mjs` drives `claude -p` (`--resume` per ask, the plan as an image in the first message) with
  mojulo as the only tool server, `capture.mjs` films from a replay of the session's calls, checked against the
  recipes it stored, so a kernel fix re-shoots the same session, and `compose.mjs` sets it in a generic chat and
  encodes the GIF. `session.json` is the record of the session the GIF shows: every call, reply, token count and the
  recipes it left. The media helpers launch Chromium without its sandbox when they run as root, as in a Linux
  container.
- `docs/tech-requirements.md` is measured for 3.1.1 (Linux x64, 2026-10-18: an 11.6 MB tarball, 251 MB installed
  across 130 packages, the per-dependency sizes again, and what the measurement turned up), records the Linux runs
  behind the demo (Claude Code driving the stdio server, Chrome for Testing baking without its sandbox as root), and
  names `stitch_motion`'s MP4 decode. The READMEs carry the 3.1.1 install size and name the ChatGPT plugin
  ([plugins/mojulo-chatgpt](../plugins/mojulo-chatgpt/README.md)) beside the Claude one.
- `design_interior`'s reply says where each piece stands: `at` (its centre, mm from the room's corner) and `facing`
  beside its id and size, so the next call can move a piece by id knowing where it is, and a reader can tell what a
  revision moved.
- `design_interior`: a dining room has its chairs. They tuck a little under the table, and the placement check
  counted the table they tuck under as in their way, so every chair was left out ("collides with dining.table") and a
  dining room was a table, a rug and a sideboard. `brief.seats` now seats that many where the room fits them.
- `design_interior`: a plain cloth asked by name on a piece (`finish: { fabric: 'velvet' }`, also linen, canvas,
  bouclé, twill) changes the cloth and keeps the scheme's colour. It used to drop the colour, so the piece wore the
  preset's own (velvet's emerald): "make the sofa velvet" turned the sofa green. A room that names such a fabric
  renders in its scheme's colour now; a patterned cloth (tartan, ticking …) and a full fabric spec are as they were.
- `stitch_motion` joins World clips (a furnished room, a city, a level), which it used to refuse. A World clip its
  forge baked to MP4 is decoded from that video, so a stitch of three room clips takes seconds rather than a fresh
  headless render of every frame; one without an MP4 is rendered again from its recipe.

### Test tiers: the e2e suites run once, in their own CI job

- `npm test` leaves out the e2e tier: the whole worlds made through the real handlers and the games whose audit walks
  each level in headless Chrome (the `E2E` list, now in `vitest.config.js`). Measured on one full run, they were a
  third of the suite's time, and CI ran them on every leg of its matrix. CI runs them once now, in an `e2e` job on
  Ubuntu with Node 22 (`npm run test:e2e`); the byte pins they rest on still run on every leg.
- `lib/mcp/test-tiers.test.js` holds the new shape: the e2e suites run in `test:e2e` and in neither `npm test` nor
  `test:critical`. CLAUDE.md and CONTRIBUTING.md say when to run the tier.

### Claude plugin: the server installs from a lockfile the plugin ships

- The plugin no longer runs `npx -y mojulo@<version>`. Its server is `node ${CLAUDE_PLUGIN_ROOT}/server/launch.mjs`,
  which runs `npm ci` against `plugins/mojulo/server/package-lock.json` once per version, into
  `~/.mojulo/plugin/<version>-<lock hash>/`, then starts the installed server. The lockfile names mojulo and every
  package under it by exact version, registry.npmjs.org source and integrity hash, which npm checks on install; the
  Claude plugin directory held a plugin that ran an npm package without one. A later start runs at once.
- The install is built in a temporary folder and renamed into place when `npm ci` finishes, so two sessions starting
  together share one install, and a start Claude Code cuts short leaves nothing half-built (the next clears it). npm
  writes to stderr: stdout stays the MCP channel.
- `control/scripts/plugin-lock.mjs` writes the launcher's `package.json` and lockfile for the version
  `control/package.json` carries, once it is on npm (`--check` resolves again and compares).
  `check-plugin-version.mjs` now holds the plugin to the launcher: `node` on `launch.mjs`, the distribution flag, a
  `package.json` on exactly the version, and a lockfile that locks it, every entry hashed and from npm.

### Fractal structures

- **Towers for any world, from a few words.** A new kind-generic `structures` channel grows landmark towers from
  four words: a plan (square, turned squares, a star, a stepped circle, offset faces cut again to a depth), a rise
  (how the plan narrows, turns and is banded as it climbs, r(f) = top + (1 − top)(1 − f^p)), a crown (a ribbed disc,
  a dome or a finial) and an echo (smaller copies of the whole against its own flanks, each echoing again: a tower of
  towers). The principles are the Indian temple builders', lifted off the temple. Presets (`PRESETS` in
  `fractal-structure/presets.js`) and a seeded `auto` that rolls a varied skyline.
- Pass them to `compose_world` as `overrides.structures` on any base, or set `structures` on a stored world and
  patch it in place. The faces join before the material, texture and shadow passes; an entity world also gets a box
  collider for each tier and plinth step, so a stepped rise's terraces stand a walker. A face budget trims the
  deepest copies first, never the tower. Absent, every world is byte-identical. Manual: the `structures` view-vocab
  card; kernel: `lib/graph/fractal-structure/`.
- **A structure made of structures.** A `colonnade` stands any structure's words (a fluted `column` by default)
  round the plan, spaced evenly along its perimeter, or on a grid, under an entablature that can roof a walk to the
  wall, or carrying the body on top; a `hollow` body is a wall round open ground whose edge can step out as it rises
  (a seating bowl); `stretch` makes a plan oval; a `top` echo stands a lantern on the crown. New presets come of
  it: `column`, `rotunda` (a tholos with its lantern), `cloister`, `hall` (a pillared hall under a stepped roof) and
  `arena` (an oval bowl behind a storeyed, columned wall). The stepped-circle spire is now `beehive`.

### Mutagenic oozes: base animals made into game creatures

- **An animal takes oozes.** `create_character({ as: 'animal', spec: { species, ooze } })` turns a real species
  into a game creature, drawn to read in a game rather than a field guide: `dire` (bigger and front-heavy, a crest of
  hackles, a snarling face and glowing eyes, still the animal), `skeletal`, `zombie`, `techno`, `crystal`,
  `mythical` (boss size), `herobot` (a toy hero robot in the animal's own colours: a helmeted big head, antennae, ball
  joints and pauldrons, panel seams and vents, flared boots, plastic), `transmetal` (the animal's outline and fur, its details machined: chrome faceplate, plates, pistons), and
  the elements `fire`, `frost`, `storm`, `venom`, `shadow`, and `mascot` (the animal as its own mascot on its own legs,
  by the mascot laws and its family's mascot card: a big round head, toon eyes, a short face, stumpy limbs, owned
  colours and one signature piece its folk promise says). Oozes compose
  (`['dire', 'frost']`), each with a `strength`, in four layers run in a fixed order: form (girth, and size only
  uniformly), sites (what grows at the joints and on seeded spots), surface (palette, metal, glow) and aura (the
  live elemental look). One `seed` places every spot. Absent, every animal is byte-identical.
- **Design notes style a creature up.** `stylism: { register, detail, focal, motif }` on an animal, with or without
  oozes, is the hero door's stylism tuner compressed for a beast: the register heightens every push together, the
  detail budget spends ornaments (horns, spurs, spikes, a ruff, bands, a burning tail) from the focal out by the
  tuner's laws (hierarchy, one echo, rest, an accent from heroic up), all in one motif a clear value step from the coat,
  and the mint returns its design notes. `mythical` (a boss) carries its own mythic, rich stylism.
- **From pure to chimera.** `stylism.chimera` (pure · touched · hybrid · chimera) grafts what the animal should not
  have, in the order it breaks the silhouette: horns, a ridge of plates down the back and tail, another creature's tail
  (serpent, scorpion, lion, dragon), wings (feathered or membrane by the motif, carried half raised), a second crown.
  The seed and the motif choose the kinds; a mythic register is hybrid unless told.
- **An oozed creature takes its game's look.** `spec.setting` (the setting the game rail hands its people: tradition and
  ramps) gives an anime world's creature the character light, lit as a creature is, and dresses what the oozes make
  (pieces, armour, panels, marks, ornaments) from the world's ramps, keeping its values; the coat, glows, metals and
  signal colours stay their own, and the result ledgers every move. A shelf metal named by its word (`'gold'`,
  `'chrome'`, `'gunmetal'`) now draws under the character light instead of throwing.
- **A plan names its materials.** A ring plan's `surfaces` (`{ <group> | '*': <material> }`, validated against the
  material shelf) reach its recipe as a statue's do, so a techno creature is real gunmetal on the World page and in
  the exports. Absent, nothing changes.
- **The creature's own rig.** An oozed animal with `motion` moves on its own body: the fauna rig reads a body
  registry (`lib/graph/fauna/body.js`), so its skeleton is derived from the mutated plan (a grown creature's bones are
  its species' at its size, its clips the same turns), a grafted tail is carved into bones of its own and swings, and
  grafted wings get wing bones and the `fly` and `glide` gaits. Ornaments ride the bone at their root. The stored motion
  keeps the species and the ooze, so the World page and the GLB, Godot and other exports rebuild the same body. Every
  species is byte-identical. Manual: the `ooze` section of the animal vocab card; kernel: `lib/graph/mutagen/`.
- **Articulated wings.** `wearWings(…, { articulated: true })` weighs every wing point to the wing bones it hangs from
  (an arm or digit its bone, a feather its ray's, the membrane each sub-ray's blend), honoured by `bindLayered` as a
  pinned part's `boneWeights`, so a wing folds and beats along its bones. Grafted wings take it; birds and bats keep
  their rigid wings until they opt in.

### Strategy board: spots on the map for tactics and tower defence

A game can carry a board: square spots laid over its terrain as their own layer, each with a height, a terrain type
and at most one unit. From any state the board lists every legal move, so a player can run out of options. Turn-based
tactics (in the manner of Final Fantasy Tactics), tower defence and real-time strategy share it. A board lies over a geocube's level,
indoors (its rooms) or out (its land), or is a diorama the cube paints. Web only. In progress:

- **Real-time strategy on the board** (`lib/graph/board/board-rts.js`, `board-rts-page.js`), built, North star
  StarCraft at a spike's depth: two bases on the board's spots, workers mining gold nodes, a barracks raised over
  time, soldiers and archers trained for gold and sent to a rally point. Units take orders, one or a box of them:
  move, attack-move, attack, hold, stop, gather. Paths walk round buildings and nodes. The other side is played by a
  plain mind (workers to a count, a barracks, waves that grow), and the game ends when a base falls. A fixed step
  and no dice: the same orders at the same times make the same game, however the time is cut. On the page: click,
  shift-click or drag a box; right-click to move, attack, gather or set a rally; A attack-move, B build, H hold, S
  stop, Q / W train, Ctrl+A the army. The board kind and a board over a stage take `rts` (one of `td`, `rts`, a
  battle or units), with `enemy` for a handicap. The quick goal `conquer` is a skirmish on the stage's spots
  (`board: { cols, rows, gold }`), the level the board's to end. Web only.
- **Civilizations as skirmish sides** (`lib/graph/board/board-rts-tech.js`), built: a gameworld civilization's
  technology read into the roster it fields, as StarCraft's sides are unalike. Its hand weapons arm its infantry
  (melee, ranged, a shield's guard); what moves and carries is its worker; armoured vehicles are heavy, small ones
  scout, armed ones fight, armed flyers cross any spot out of melee's reach; machine weapons are siege, three times
  as hard on a building; a turret is a defence that shoots, a barrier a wall, a thing that stores a depot, a thing
  that makes the works its vehicles come from (after a barracks). Stats move with the words (armour, energy, a size,
  a showpiece's rank), and every cost comes from one worth formula, so no side buys more fight for its gold. What a
  civilization lacks is filled from the plain worker, soldier and archer, and every crafted thing says what it
  fields as or why not (a vessel waits for water). The skirmish kernel takes a roster per side; a side without one
  plays as before. The mind raises what it builds in order, past the first only once it has sent a wave, and sends
  everything it has once the gold nodes are spent; a skirmish where the gold is gone and nobody stands is a draw.
  Its ladder: infantry from the start, its machines once researched (tier 2: the works stands only then), its
  showpieces after (tier 3: what its technology ranks its focus, the armoured walker), researched one step at a time
  at what it crafts that signals, senses or lifts (a relay mast, a dish), else a plain lab; its power and growing
  things are income steps, each making a trip pay a fifth more. The mind climbs the ladder after its first wave,
  keeping back what the next step costs. A base now defends itself (it shoots at units in range), stands longer, and
  the gold nodes hold more, so a first wave seldom ends a skirmish and the machines come out.
  On the page (`lib/graph/board/board-rts-look.js`), each side is drawn as its technology crafted it: its walkers,
  crawlers, haulers, masts and turrets as their chassis and adornment (or their block), painted in the
  civilization's finish, cut to the largest faces that read from the RTS camera and fitted to a spot, the main mass
  leaning to the side's team colour; its infantry carries its crafted weapon; a flyer flies over its shadow. What
  a civilization did not craft (a plain base, barracks, lab) is drawn as before. The panel names the roster's
  units, marks what its tier still locks, and shows the next research; B builds (again for the next building),
  Q W E R train, T researches. Defences, siege and flyers shoot their own effects.
  In the flow: quick `conquer` takes `sides: [player, enemy?]`, each a civilization of the world by its id or one in
  words ("armed attack helicopters, a bronze cannon, swords and crossbows"). The level keeps each side as its
  civilization's own words with the kit, seed and team colour it is tunnelled on (`rts.sides`), and the board reads
  them into rosters and looks as it renders, met through the top-down camera (technology's LOD). A world's bible
  shows, on each civilization's technology page, what it fields in a skirmish: its units, buildings, ladder and the
  ledger of why. The registry holds `power.systems=research`, and the real-time strategy probe asks for it.
- **The skirmish's principles: jobs and capabilities**, built: a building is its capabilities, any of them
  together (a factory training over time, research over time, a stationary unit that shoots, a depot), and one lock
  serves buildings, units and research steps alike (a building standing or a step known, then a tier). Workers
  build at the site: a building laid is a foundation, raised only while workers build it (faster with more); the
  nearest worker goes when none is named, and goes back to mining after. Workers repair buildings and machines,
  paying a gold for every ten hp mended. An idle worker keeps to its work instead of picking fights; the mind trains
  the best its factories have opened and sends a worker to any foundation left unbuilt.
  Fighters without a weapon: what carries, shelters or lifts, unarmed (or what its words call a carrier: a troop
  transport, a shuttle), is a transport: units board it (right-click it), ride where it goes, a flyer's over what
  they cannot cross, and unload (U); what it carries falls with it. What its words call medical (a medic, an
  ambulance) mends its own nearby, never a machine. Each is priced by what it carries or mends.
  Transforms: siege deploys to fire (farther and harder, but still until it packs up: D); a building grows in place
  into another (the base into its civilization's fort once its machines are known, harder and shooting farther: G);
  what technology calls deployable (a deployable sentry turret) comes out of the works folded and is set up where
  it stops. The mind deploys its siege where a foe is in reach and packs it to walk on, and grows its fort last. A
  side counts as spent when nothing more can come (it cannot earn, nothing is queued and nothing is in its purse's
  reach), and a skirmish where neither side can is a draw.
- **The skirmish's abilities and effects**, built: a unit or building is a light, armoured or structure class, and a
  blow is multiplied by its striker's bonus against that class (a polearm or launcher pierces machines, a blade or
  axe cuts the unarmoured, siege on structures); siege bursts, half its blow on those round what it hits. Statuses
  run on a timer: a stun (it does nothing), poison (the tactics battles' too, biting on), a slow, a stim, a shield
  that takes blows first; they come on hit (energy weapons stun every fourth hit, poisoned words poison, frost words
  slow) or are cast (F: stim where its words say berserk or stim, paid in hp; a shield where it carries a field),
  each with its cooldown. A cloaked unit (stealth words) is unseen and untouched but by a detector (a sensor, a dish
  that now watches); auras lift a side's own (a banner) or slow its foes (a jammer); researched upgrades lift a side
  at once (its charged or honed weapons, its plating in its finish). Every one is read from the technology's words
  and dials, said in its ledger, and priced by the same worth formula. On the page each status has a mark on whom
  it is on (a spinning ring for a stun, a ring at the feet for a slow, poison or stim, a bubble for a shield), an
  aura its ring on the ground, a selected unit its reach; a struck unit flashes; a cloaked foe shows only once seen.
  The mind casts when a foe is in sight, trains its latest factory's best first and saves for what a tier opened,
  spends what it has when it can earn no more; a worker stopped between spots by its depot steps back to drop off.
- **The skirmish's tree and economy**, built: past its machines a civilization's research branches (flight opens what
  flies, siege works its siege; the showpieces their own step), and its upgrades run in lines (weapons II, plating II
  after the first and its top tier). A civilization may write its own steps in `technology.research` (what each
  opens of what it crafts, what it follows: a step, by name or as machines / showpieces, or a building it raises; a
  buff across its side), every name it uses read against what it fields and refused with what it could name. The
  mind passes over a step that opens only what it never fields, and saves for one that opens what it does.
  Doctrines, chosen before a skirmish (`rts.doctrine`, quick conquer's `doctrine`): economy (two more workers, a
  tenth more a trip), aggression (fighters a tenth harder and faster), fortress (buildings a quarter sturdier,
  defences a quarter cheaper), science (research a quarter quicker, 15% cheaper); a civilization may name the ones
  it allows (`technology.doctrines`), refused otherwise.
  A second resource, named for what a civilization powers itself with (power, else biomass, else crystal), mined
  from its own nodes a step beyond the gold (`nodes2`, laid by default when a side's things cost it): its machines
  and its research cost some, said with the gold when either is short. A supply cap: each unit takes some (the
  bigger, the more), the base and fort hold some, and quarters (what it crafts that shelters, else plain) hold more;
  a unit past the cap is refused, naming what to raise. The mind keeps a third of its workers on the second
  resource, raises quarters as it nears its cap, and is spent when nothing more can come (a board with no nodes at
  all has nothing to run out of; an idle worker's odd load, or a worker with nothing to mine, is nothing more).
- **The skirmish's clock and hand**, built: every action the player takes goes through the kernel's one way in
  (`act`: an order, a training, a building, a step, an upgrade, a rally, a standing order) and is logged by the
  step it was taken before, so a game replays from its log (`replay`), however the page's frames cut the time. Each
  side's actions a minute (APM, over game time) beside a game clock in the panel, the mind's counted as it plays.
  P pauses; [ and ] slow and speed the clock (half, normal, faster, double). Control groups: Ctrl+1 to 9 keep the
  selection (or a building), Shift adds, the digit takes it again, twice running the camera goes there; `.` selects
  the next idle worker and goes to it. Standing orders: what a kind does when idle (I: a worker waits, gathers at
  the nearest node or repairs, a foundation first; a fighter waits or holds), a factory that repeats what it trains
  while it can pay (Y), a kind that casts its abilities on its own when a foe is in sight (C). A mind plays at a
  level (`rts.level`: easy, normal, hard, or one each side): its workers, its first wave and how fast the next
  grow, its actions a minute (easy is held to 40, a few seconds' worth in hand) and how often it thinks; each
  side's waves now its own.
- **The match**, built: a skirmish played end to end as a match, not a campaign's battle. Expansions
  (`rts.expansions`: up to three fields a side, two nodes and a hall's spot each, the same for both sides, mirrored
  through the board's middle and chosen by `rts.seed`) are claimed by a hall, a second depot that trains workers;
  the mind raises one on the nearest field once its own nodes run low. The victory rule (`rts.victory`): a side
  loses when its base falls, or under the melee rule only when its last building does. A side may give up
  (`act({ k: 'surrender' })`). Each side's match is counted: trained, units lost, raised, buildings lost, mined,
  research done, and its army's worth every ten seconds. The fog (`rts.fog`): each side sees what its units and
  buildings see (a flyer a step farther), keeps the ground it explored and the foe's buildings as it last saw them;
  a unit strikes only what its side sees (a siege out of sight needs a spotter), and the mind plays under the same
  fog, its waves sent where it last saw the foe, else where the foe started, then the fields. On the page the
  unexplored ground is dark, the explored dim, the foe hidden out of sight and its buildings remembered as ghosts.
  A match (`rts.match`, quick conquer's `match: true`) is the closed loop: a lobby before the clock (your side and
  the opponent's: as minted, the other's, the plain tables or random; the opponent's level; the purse; the workers;
  the victory rule; the fog), the match under the fog and the melee rule with a field a side unless said, End twice
  to give up, then the results (the winner, the time, each side's count, its APM and its army over time) with
  Rematch (the same setup, its fields laid anew by the next seed), New match (the lobby) and Leave (the level ends as
  the last match went). The lobby's choices are the match's setup (`setup`), so a match replays from them and its log.
- **The command card**, built: the skirmish is commanded as an RTS is. Clicking a building shows it (its health,
  queue with progress, research, upgrade, rally, repeat); clicking a unit shows it (health, attack, range, speed,
  armour, statuses, cooldowns, its idle rule); a box dragged over the ground picks the player's units, never
  buildings, shown a tile each (a click on one picks it). Beside it a command card of buttons, each with its hotkey:
  Move, Stop, Hold, Attack, Attack-move and Patrol for units, then what the kind can (its abilities, Unload, Deploy,
  Build, Gather, Repair); train, research, upgrade, repeat and rally for a building. A command that needs a target
  arms the next click on the board; a button that cannot act says why. Patrol is a new order: an attack-move back and
  forth between where the units were and where they were sent. Every action's key can be rebound in the card's Keys
  panel (kept in the browser), and a game may set its own defaults (`rts.keys`).
- **The genre sweep asks for it, and now finds it.** Probes for a tactics game and a real-time strategy game, and
  registry values for what the board makes: the board's spots, the tactical camera, tactics combat, the epoch map
  (`progression: map`) and its chapters (`chapters: epochs`), scenes told on the board (`shots: board`), the maze
  defence's placement (`systems: maze`) and the summons. The tactics probe asks for FFT's whole shape and is
  makeable; so is the real-time strategy probe, with unit orders built (`systems: orders`). Re-swept on
  `docs/tool-surface/hillclimb.md`: more rolled worlds makeable, the board no longer the top gap.

- **The board kernel** (`lib/graph/board/board-kernel.js`), built: square spots with heights and terrain types, one
  unit a spot; reach by move and jump (through allies, never foes); aim (a diamond or a line, between a reach's
  bounds, within a height) and area; facing (a blow from the side or behind hits harder) and height; every legal
  move listed, ending always among them. The turn is FFT's: move once and act once, in either order, then face; a
  charge-time clock on the party battles' timeline rule, a turn costing less for not moving or not acting. Blows
  follow the party battles' formula. Pure and seeded, a self-contained closure a page can carry.
- **Boards from a geocube** (`lib/graph/board/board-lay.js`), built, indoors and out:
  - a diorama the cube paints: seeded columns in whole steps, banded a step at a time so a height reads at a
    glance, grass and stone outside, floor and trim inside, water optional;
  - over the cube's rooms: spots on the floor, props shutting theirs, the rooms joined only through their
    doorways;
  - over the cube's land (a trail's valley by default): heights and types read off the ground, trees shutting
    their spots, laid inside the site where the most ground can be stood on.
- **The board on the World page**, built: a `board` world kind (`{ board, units, camera, cursor }`) shows a board over
  its ground with a faint grid of its spots, highlights for reach, aim and area, a cursor and the units, and plays it
  with **the tactical camera**: a locked pitch with two stops, quarter turns (Q / E), zoom stops (Z / X or the
  wheel), the cursor moving the way the screen shows whichever way the view is turned. The widest stop holds the
  whole board; the closer ones follow the cursor. Selecting a unit shows its reach from the board kernel, and moving
  it hops the kernel's path. A room is seen as a dollhouse (no ceiling, its walls cut at the waist); over land the
  overlay drapes on the ground. An RTS form pans and scrolls at the edge instead of turning. A page without a board
  keeps every byte. The `board` input scheme names its keys.
- **Battles on the board**, built: a board world kind's `battle` (`{ party, foes, bag?, players? }`) is played on
  the page. The party stands in its classes and the foes by preset, read from the party battles' own book (stats,
  gear, skills, weaknesses), with only the board's numbers added: how far each moves and climbs, the shape of each
  skill (a blow the next spot, a spell four, a mending three, an area for many). Skills, items, statuses and buffs
  work as in party battles, and a blow lands for exactly what a party battle's would on the same dice; from the side or
  behind it lands harder (a spell lands the same from anywhere). The player's units take a menu (Move, Act, Wait,
  then a facing) with the reach and aim shown and a forecast of each act; the other side is a plain mind that weighs
  every spot and act. A turn-order bar, the active unit's card, numbers off the units, and the level hears
  `board-won` or `board-lost`. Classes and humanoid foes stand as figures that walk spot to spot; beasts stay tokens.
- **Tactics games through the game book**, built: `battles: { on: 'board' }` makes each stage that meets packs a
  battle level, fought on spots laid over the stage's own ground, indoors or out (any level can carry a `board`). The
  book's party (the hero and the cast who join, standing as themselves) deploys on the near rows, up to four, before
  the first turn; the stage's packs stand in the far rows. A battle is won when every foe is down (or by its rules: a
  leader down, turns survived, a guest to protect) and lost when the hero falls; the level ends there (the `board`
  mechanic). The party is carried as party battles carry it: each battle stands it as the store has it, at full HP,
  and puts its spoils back (xp, class points and the skills they teach, gold, drops), counted exactly as party battles
  count them. FFT's permadeath countdown is a rule, off by default. A world whose intent fights tactics gets board
  battles without writing them.
- **The epoch map**, built: a tactics book is travelled from a map, its first level: a diorama in the first stage's
  geocube, each stage a dot on it in story order (a battle or a story stop), joined by roads laid spot by spot. A dot
  opens when the one before it is won; the party's marker walks the open roads to the dot chosen, and the map is left
  by that dot (the `map` mechanic). Every dot's level, when won, goes back to the map, where the party stands at the
  dot it came from.
- **Epochs**, built: a tactics book is played in epochs (chapters), each with its own map. By default each of the
  book's levels is an epoch; `battles.board.epochs` cuts them into chapters of its own. Winning an epoch's last stage
  goes on to the next epoch's map, the party and bag carried; a later epoch's skirmishes draw from the harder packs
  met by then. The final epoch's last stage completes the game, and its map stays open for what is left.
- **Story slots**, built: places in a tactics game where a scene or dialogue goes, empty until the story fills them.
  A battle holds for a scene before its first turn and after its win (the level ends once it has played); a walked
  stage plays its before at its start and its after at its exit; an epoch's map plays its begin as it opens, once a
  game, and an epoch's end follows its last stage's own after. The book fills one with a story moment
  (`when: { slot }`, `where: { level }` or `where: { epoch }`), bound and reported as other moments are. A slot
  nobody fills adds nothing to the page.
- **Scenes told on the board**, built: a scene's shot on a board cuts the tactical camera to whoever it names (a unit,
  a dot, the party on a map, a spot), turned to see them from the front, and gives the player's view back after. The
  words float over whoever speaks, a speaking figure gestures, and `talk: { portrait: true }` (on a board, or the
  book's `battles.board.talk`) adds a close portrait of the speaker, their own figure drawn live beside the words. The
  camera also shakes (the same way every time) and orbits, for what comes next.
- **Special animations on the board**, built: every act plays on the map itself (a spell its element's effect: fire
  rises in a pillar, ice spikes from the ground, a bolt falls; a mending glows, a blow sparks), and its numbers land
  with its strike. Effects are timelines of camera moves (shake, orbit, a shot), light (the world dimmed, a flash) and
  3D pieces (rings, rune circles, pillars, orbs, shards, spikes, bolts), seeded, so the same act plays the same way. A
  scene plays one by the bus (`fx:quake:<who>`, `fx:meteor`).
- **Summons**, built: a summoner class (the board's own book beside the party battles' presets) calls five beings,
  each built in 3D and animated on the map: an inferno giant raining fire, a glacier colossus raising ice, a tempest
  crown calling bolts, a stone colossus whose fist quakes the ground, a wyrm of light that circles and breathes. The
  world dims, the camera circles the place, the map shakes; then the view settles back on its quarter. A summon hurts
  exactly as the party battles' formula says. Any member may know one (`skills`); a book gives the class with
  `battles.party.<id>.class: 'summoner'`.
- **A game's final level** (`final` on `create_game`, the light shell): its first win completes the game. The front's
  end plays (or the result says the game is complete) instead of travelling on, and the game counts as cleared by
  that level alone, not every level. A game without one is unchanged.
- **Skirmishes to fight again**, built: each area of the map gets a skirmish dot after its first battle, open once
  that battle is won and fought as often as the party likes. A skirmish draws its foes from the book's packs when it
  starts, scaled to the party (its mean level, give or take one); win and the next visit meets another pack, lose and
  the same one waits. Any board battle can draw (`draw`: packs, weakest first, in place of `foes`);
  `battles.board.skirmish: false` leaves them off.
- **Tower defence on the board**, built: a board's `td` (or the quick path's `defend` with `board: true`) is a tower
  defence on its spots. Foes come in waves from gates in the far row and walk to the base in the near row; towers
  (arrow: long range; cannon: a blast on everyone near; frost: slows) stand on any free spot, paid from the purse,
  and the road bends round them. A tower may only stand where every gate, and every foe already walking, still has a
  way to the base, so the player runs out of spots as well as gold. Bounties pay for kills, a tower sells for half,
  and the next wave can be called early for gold. Foes reaching the base cost lives; holding every wave wins the
  level. Its own kernel (`board-td.js`), the same game in Node and on the page: no dice, a fixed step. Seen from
  above as a commander would (the camera pans and scrolls at the edge). Without `board`, `defend` is the trail's as
  before.

### Traditional board games: a board world of tiles, pieces and rules

Board games composed, not coded: a board is a connection of tiles, and chess, checkers and euro games of resources,
dice and trading are put together from the same systems and meeples (pieces, move rules, turns and exceptions; places,
resources, building, cards, trading, scores), played against the computer. The book holds only games nobody owns: a
published game asked for by name is written out from the rules the person explains, never guessed. The board is
abstract (representational state, heights allowed, no map yet), drawn as an SVG plan and, where it is good enough,
in CSS 3D. In progress:

- **The lattice** (`lib/graph/polygonizer/lattice.js`), built: mandala-space tiled. Square and hex boards (pointy or
  flat, a rectangle or a hexagon of hexes, carved by holes or a heights grid) as cells, corners and edges with shared
  ids, so a piece can stand on a cell, a corner (a settlement) or an edge (a road). The relations are explicit: each
  cell's neighbour by direction, in manji names (N E S W on a square; E NE NW W SW SE on a pointy hex), its corners
  and edges in order round it, each corner's cells and edges, each edge's two corners and its cells. Heights stand on
  the meru. Cells are named as on a chessboard (`C4`), a corner or an edge by any cell it touches and the way to it
  (`C4.ne`), every alias the same record. Lattice vectors move on it (a step, a slide until the board or a hole
  ends it, a jump) and turn and mirror with the board, so a piece's moves are one vector under the board's symmetry:
  a knight is eight moves from one, and the same piece plays on a hex. The relations' invariants are checked
  (`latticeLaws`), and Euler counts the holes.
- **The board drawn** (`lattice-svg.js`, `lattice-css3d.js`), built: the plan as SVG (cells in the board's own
  colouring, corners, edges and names, highlights over them), and the board in CSS 3D, a top a cell, sides where a
  cell stands above its neighbour or the rim, a seat at the table and a view from above.
- **The tabletop kernel** (`lib/graph/tabletop/tabletop-kernel.js`), built: a game as a pure function of its moves,
  composed from data. A piece is what it can do: a vector (or a way) under the board's symmetry, stepped, slid or
  leapt, landing on an empty cell, a foe or either, the cells it crosses empty, held by a foe or anything, taking what
  it lands on, what it jumps or what left a mark. Exceptions are conditions (unmoved, a row counted from the player's
  own side, a mark the last move left), marks, a partner piece that moves with it and a path that must not be
  attacked; promotion offers each piece a pawn may become; a chain lets the same piece go again (a multi-jump). A
  rule is written once for the first player and turned to face each other one. The game's rules: a royal piece that
  may not be left attacked (mate and stalemate follow), compulsory capture, no move loses or draws, repetition, a
  quiet count, a turn cap, moves a turn and passing, and a clock (base, increment, delay) that spends the time the
  page measured, the kernel never reading one. One self-contained closure, as the strategy board's, so a page can
  carry it.
- **Chess and checkers as data** (`lib/graph/tabletop/games/`), built: written in those words alone, chess with
  castling, en passant, promotion, check, the fifty-move rule and threefold repetition, and English draughts with
  compulsory and chained jumps and crowning. A chess position loads from FEN. Their move counts match the published
  perft tables (chess from the start, Kiwipete and the standard test positions; checkers from the start).
- **The computer across the table** (`lib/graph/tabletop/tabletop-mind.js`), built: alpha-beta over the kernel's
  moves, captures followed past the horizon, scored by what the game declares (its pieces' values, a promoting
  piece's progress, the middle of the board), three levels (easy, fair, hard) by depth and by how far below the best
  a pick may fall. Bounded by a count of positions, never a clock, with seeded dice between equal moves: the same
  position and seed give the same move on any machine. A closure over the kernel, so a page carries both. The attack
  test walks each capturing rule backwards from the square, which made the search about three times faster.
- **The game to play** (`lib/graph/tabletop/tabletop-page.js`), built: one self-contained page against the computer,
  carrying the board, the game, the kernel and the mind. Two views of one board: the plan (SVG) and the table (CSS 3D,
  every cell's top a div played by clicking, a piece a token that slides from cell to cell). Select a piece to see
  where it may go, a promotion picker, the last move marked, check and the outcome in the status, the move list, undo,
  a new game, the level (easy, fair, hard), and the clocks when the game has one (the page measures a move's time and
  hands the kernel the number). The person sits at their own side: playing black turns the plan and the table.
- **The economy** (the tabletop kernel, grown), built: a game with building, dice or an opening is played on places,
  a cell, a corner or an edge, so a settlement stands on a corner and a road on an edge. Stocks (a player's pieces
  off the board), hands and a bank, costs; building as data, with conditions over the place graph (no building within
  so many steps, beside the player's own kinds, a road reaching from the player's net and not through a foe's
  settlement) and upgrades (a city on a settlement). Seeded dice at the turn's start; production (each hex showing
  the roll pays the pieces on its corners, not under the robber, the bank's shortage rule); rolls that do something
  else (a seven: half a hand over seven given up, the robber moved, a card stolen). Forced choices queue, even out of
  turn, one move at a time. Decks shuffled from the seed, cards bought and held, played one a turn and never the turn
  bought, their effects in a few verbs (the robber, free placements, gain from the bank, claim from every other
  player). An opening in rounds (the snake), then roll and build. Scores from pieces, cards and awards (the longest
  trail of a kind, broken by a foe's building; the most of a card played), a win on one's own turn. A view per player
  deals what it cannot see again from what is unseen, so a computer never reads a hidden card or the dice ahead. A
  bank exchange is an option. Chess and checkers keep their counts.
- **The deal**, built: a system for a seeded setup. Cell types and numbers shuffled onto the board from the game's
  seed, numberless types left bare, chosen numbers kept off neighbouring cells, neutral pieces set on a type; the same
  seed, the same board.
- **Trading between players**, built: a system (`trade: { offers, shapes }`). After the roll the player to move offers
  any whole cards it holds for others; each other player answers in turn, accepting only what it can pay; the offerer
  deals with one who accepted or calls it off; a few offers a turn, so a game always ends. The computer answers by
  expected value and the table: what the trade does for its own position (points, income, hand, and how many rolls
  it now stands from its next build) less what it does for the offerer's, weighed heavier when the offerer is ahead
  of it and heavier again when the offerer leads, and never a trade with a player two points from winning. It offers
  only what it foresees accepted and helpful, and deals with the partner its own position likes best. Four computers
  with trading finish a dealt island in fewer turns than without (56, 128 and 66 turns against 96, 114 and 107 on
  three seeds).
- **An island economy, as a test fixture** (`lib/graph/tabletop/fixtures/island-economy.js`), built: nineteen hexes
  dealt by the deal system, settlements, cities and roads, dice, production and the seven's robber, development cards,
  the longest road and the largest army, an opening in rounds, and trading when asked: written in the systems alone,
  the way a person's own rules would be once explained. Not in the book and not reachable from the tools.
- **The computer at a euro game**, built: a turn planner. From its own view it weighs lines of its own actions this
  turn, the best few at each step, each forced choice on the way taken greedily, and plays the first action of the
  best line. A seat's worth is its points, what its pieces earn a roll (a spread of resources over a pile), its hand,
  the builds it can pay for, the corners it can settle next, its cards, its army and its road, less a share of the
  leader's. Four computers play a dealt island to a winner.
- **A euro game to play** (`lib/graph/tabletop/tabletop-euro-page.js`), built: the same page for a euro game. The island
  on the plan and the table, its numbers, the pieces in the players' colours; the corners, edges and hexes that can
  be taken now marked and clicked; the person's hand and cards, the roll, the builds, buying and playing cards, and
  the forced choices as prompts (what to give up, where the robber goes, whom to rob); every seat's open points,
  cards and awards; a log; with trading, an offer drafted card by card (checked by the kernel's own rule), the
  computers' offers to accept or decline, and the partner chosen from those who accepted. The computers play their
  turns a beat apart, so their moves can be followed.
- **Meeple shapes** (`lib/graph/tabletop/tabletop-shapes.js`, `tabletop-bodies.js`), built: a piece given a body, not
  only a cube or a flat token. A shape is a cut-out with thickness (a meeple, a house, a city, a tower, a barn, a ship,
  a horse's head), a turned profile (a checker, a stack, the chess set, a robber), a box (a cube, a road) or a group
  of those, named from a shelf or written out in cell units. The table view stands each piece as a body of panels lit
  in its owner's colour and turned to face its player, a road lying along its edge; the plan draws each piece's side
  silhouette, as a diagram does. A turned piece's tapering bands are unmasked rectangles, so a full chess set of 32
  bodies draws in a few seconds where masked bands took minutes. Chess, checkers and the island economy wear them; a
  shape is checked when the game is made.
- **Placement and groups**, built: pieces put down rather than moved. A kind may be dropped from the player's stock onto
  an empty cell, falling a way until something stops it, or turning the lines of foes it closes. One groups engine
  (a side's pieces joined across edges, and the empty cells beside them) serves enclosure (a group with no empty
  neighbour is taken; no suicide; no ko: the board may not return to how it stood before the other player's move),
  connection (a group joining a player's own two sides wins) and the scorers. A line of k along any axis wins.
  Passes in a row or a full board end a game by its points: pieces counted, territory (empty areas one side alone
  borders), majorities in named regions (first and second, ties sharing the places' points), the largest group, an
  added half point. A rhombus of hexes joins the lattice. The computer reads each game by what wins it: open lines
  toward k, the shortest way left to join two sides, groups down to their last empty neighbour, and the game's own
  points; it narrows a wide board to the cells near the play. Five fixtures, each named by its principle (enclosure,
  lines with and without falling, connection, sandwiching, majorities), are played by clicking on the plan or the
  table, with a pass, the score in the status and the regions tinted.
- **Tile placement**, built: a board grown a tile at a time. Tile types are segments of feature types over a tile's
  edges (an area, a line) or its centre; tiles come from a seeded bag, one drawn a turn, laid beside the laid ones,
  turned any of the board's turns, every shared edge's label matching (square or hex alike); a tile that fits nowhere
  is set aside. A segment of the tile just laid may be claimed with a piece from stock if its feature has none. A
  feature (segments joined across edges) with no open edge pays at once, its tiles times its rate, to the most claims
  in it, a tie paying each, and its claims return; a centre feature is done when every cell round it is laid. An empty
  bag ends the game, open features paying their lower rate. A player's view deals the bag again. The computer weighs
  every placement and turn with the best claim it allows: points, each feature it leads at its chance of being done,
  a claim in hand worth more the fuller the bag, less a share of the leader's. A tile-placement fixture named by its
  principle (walls, paths, shrines). The page draws each tile from its segments on the plan (cropped to what is laid)
  and on the table (the art on the cell's top, claims as standing bodies, the view following the play); the drawn tile
  is turned by hand and laid where it fits, then a claim chosen or not.
- **Piles, hands and markets**, built: card games, with no board (`piles`). Card types are data (a cost, coins, points, a
  treasure, effects to play in a few verbs: draw, coins, actions, buys, points, gain a card up to a cost, trash from
  the hand; tags). Each player has a deck, a hand, a discard, the cards played this turn and a tableau; a supply of
  piles and a market, a row face up refilled from its own seeded deck. Deck building: a hand drawn, treasures played
  freely and others for one of the turn's actions, buys into the discard, the turn's cards to the discard and a new
  hand, the discard shuffled into a deck when it runs out; a gain or a trash owed is chosen one card at a time.
  Drafting: a turn takes one card from the row to the tableau. Set collection scorers: the cards' points, different
  values of a tag held, the same value held so many times, a tag's numbers summed, the most of a value (a tie sharing
  the bonus). The game ends as a turn ends (a pile gone, so many piles gone, the market empty, a turn count). A
  player's view keeps its own hand and deals deck order, the others' hands and the market's deck again. The computer
  plays what leaves its turn the most to buy with (an action that keeps the actions going first), then buys what
  leaves its seat worth most: its points weighed more as the end nears, the average hand its deck draws weighed less;
  at a draft, the card worth most to it less half the next seat's best take. Against fixed strategies (a money-only
  buyer, a buyer of the dearest card) it wins about half its games; it beats random play every time. Two fixtures
  named by principle (deck building; drafting and set collection), played on a card page: the supply and the market
  lit where a buy, a take or a gain may go, the hand lit where a play or a trash may, the others' piles as counts and
  their tableaux face up, actions, buys and coins, every seat's points as the game scores them now, a log.
- **The engine, stage 1: one object model**, built. The thesis behind the next stages: every board game is the same
  duel of objects (things with characteristics in zones; a turn of phases; windows to act; a chain of responses;
  triggers; world effects; rules checked between actions), so the kernel grows that engine rather than one feature per
  paradigm. Stage 1 unifies what things are. Every piece, card and laid tile is now an object in one table: a board
  piece as before, a card in its owner's zones (deck, hand, discard, played, tableau; zones hold object ids in order),
  a laid tile and a claim at their cell, an economy card held or played. A shared supply of like things (a supply
  pile, a bag of tiles, a bank, a stock of meeples) stays counted by kind until one comes out of it. Pieces, card types,
  tile types and economy cards share one namespace (a name used twice is refused). One function derives an object's
  characteristics: its definition, then its modifiers in a fixed order (set, add, counters, grant and remove
  abilities, by timestamp within each); with no counters and no modifiers it is the definition itself, so a game that
  uses neither pays nothing, and an object leaving play keeps none of them. Machine gates: the seeded mind-against-mind
  games of every mode (chess, enclosure, tiles, deck building, drafting, three island games, one with trading) replay
  move for move as before the change; perft's counts and time are unchanged; the kernel grew by 8.7 per cent.
- **The engine, stage 2: rounds of phases, sealed choices and utilization**, built. A game with `round` is played in
  rounds, each a list of phases written as data: taken in turns from the first seat while anyone can act, together
  (each player's choice sealed and hidden from every other player's view, all revealed and resolved at once, the
  phase repeating while what it acts on lasts), or by itself (workers made ready, cards dealt, a lot revealed, upkeep
  paid, lots nobody took cleared). Its moves: a worker placed on a space (exhausted; a space holds so many; its
  effects at once: resources, points, another worker, the first seat), a sealed bid (the highest pays and takes the
  lot, a tie to the first in order, nothing on all zeros), a sealed pick (kept, the hands passed on), a pass. Workers
  are objects; resources are pools that carry over; cards and their scorers are the card mode's; the first seat may
  pass on each round. **Utilization**: capacity that expires (a deck turn's actions, buys and coins; workers in a
  round) is kept in a ledger per player, spent and idle (left when it expired while a move could still have spent
  it), and `utilization` reports the share used. The computer optimizes it (a small term preferring capacity used
  over idle when worths are close) and is tuned by it: a level's `use` is how often an option that spends capacity is
  seen at all, so a weaker computer leaves capacity idle where idling is allowed and misplaces where spending is
  forced, the way a weaker player forgets the card in hand (easy 0.7, fair 0.92, hard 1). The computer in a round
  game places a worker where its seat's worth gains most (resources valued by the game's own conversions, upkeep and
  end rates; workers by the spaces' yield for the rounds left), bids by expected value (the lot's worth to it, the
  coins, whether it beats what each rival would pay by the same reckoning, half a rival's gain), and picks what is
  worth most to it less half what the next seat could take from the hand it passes. Three fixtures named by
  principle (worker placement, sealed bids, drafting by passing) and a round page (spaces and their workers, the lot
  and the bids, the hand, pools, every seat's points and utilization, sealed choices shown only as made until
  revealed). Machine gates: hard beats easy 12 of 12 deck games, easy using 72 per cent of its capacity to hard's 96,
  and hard beats easy 9 of 10 worker games; the computer beats random play in every round paradigm; chess,
  enclosure, tiles, drafting and the island games replay move for move as before; perft unchanged; the kernel grew
  to 103,295 bytes (from 85,992) and the mind to 31,575 (from 24,059).
- **The engine, stage 3: a player's own turn, the chain, the initiative and triggers**, built. A round game may give
  each seat a turn of its own (`round.turn`): auto phases acting for the player whose turn it is (ready its objects,
  a pool that grows by one each turn and is refilled, what was left gone; a draw; damage mended) and an active phase
  where it casts cards and uses abilities. Players have a deck, a hand, a discard and a field. A summon enters the
  field exhausted; a spell resolves and goes to the discard; an ability may exhaust its object and cost from a pool.
  Everything cast or used goes on the chain, resolved last in, first out. After a link goes on, the initiative passes
  round, but only to a player who can answer (a fast card it can pay for, a fast ability), never to the one whose own
  link is on top; when all have passed the top link resolves, and with nobody able to answer, links resolve at once,
  so neither a person nor the computer is asked to pass for nothing. Triggers (enters, dies, at its controller's turn
  start, when a foe casts) go on after each action, the active player's first. Checks between actions: damage
  reaching guard kills, a player at the floor of its `lose` pool loses. One target chosen at casting, skipped if gone
  by resolution; a counter cancels the spell beneath it; an ability's power is the source's as it was when used. A
  loop guard: past `cap` actions in a turn or a hundred links, a draw. Energy left at a turn's end while a card could
  have been paid for is idle (utilization). The overlooking dial now holds for the whole turn, decided by a hash of
  the game, the turn, the seat and the option (a forgotten card stays forgotten), so in the deck game hard beats easy
  10 of 10 (95 per cent used against 70). The computer: a duel planner that plays each move and settles the chain
  before weighing the seat (life, the field's power and guard, the hand), and Monte Carlo tree search for any game,
  seeded and bounded by playouts, each from a fresh determinization of its own view, opt in by `search: 'mcts'`. A
  fixture by principle, a response duel (summons, spells, fast answers, a fast ability, four kinds of trigger, a
  counter, strikes), and the round page grown for it (fields, the chain top first, targets, answer or pass). Machine
  gates: forty random duels keep every invariant (each card in one zone, its zone its list, the chain's cards nowhere
  else, no negative pool, no stall); the duel planner beats random play 11 of 12 and hard beats easy 9 of 12; search
  wins 4 of 10 against the planner at about 67 ms a move (it stays opt in); every other mode replays move for move
  except where the dial plays (deck building, worker placement); perft unchanged; the kernel grew to 120,163 bytes
  and the mind to 38,442. A test now refuses two top-level declarations of one name in either closure (a second
  `settle` had silently replaced the first). Re-expressing the existing modes' turn loops as phases was dropped: none
  needs a response window.
- **The engine, stage 4: world effects, counters, ready and exhausted**, built. An object's characteristics now
  gather the world effects that cover it: static abilities of objects in play (an aura on one's own summons, a curse
  on the foe's, a cost cut on the hand) and the game's own (`world`). They apply in one fixed order, written down and
  not pretending to be layered: set, then add (numbers, or objects of numbers summed key by key, a cost never below
  nothing), then counters, then grant and remove abilities, by timestamp within each (the time a source entered play,
  or a modifier was made). A world effect's sources are read from their definitions and their own modifiers, never
  from other world effects, so nothing depends on anything; copies and changes of control are left out. A game with
  no static ability takes the shared definition as before. Effects gain a boost (lasting, or until the turn ends,
  when it is taken off), counters placed or removed, and readying; an ability may cost counters from its own object,
  and a card may enter play with counters (a wand with three charges); a step may empty a pool; damage never goes
  below nothing. Utilization gains ready objects: a summon left ready at the turn's end while it could have struck is
  idle, so the dial now reaches forgotten strikes (in the duel hard beats easy 11 of 12, easy using 84 per cent). The
  duel grows eight cards that use each (an aura, a foe aura, a cost cut, a rally until the turn ends, growth
  counters, a charged wand, a readying spell, a curse that sets power and strips abilities), and the page shows stats
  as derived (raised green, lowered brown) and counters. Machine gates: forty random duels keep every invariant with
  the new cards; every other mode replays move for move as before (the world-effect path costs nothing where there is
  none); perft unchanged; the kernel grew to 125,634 bytes.
- **The engine, stage 5: fixtures that join the systems**, built. *A summoning duel on a board*: a turn game given
  a board puts its summons on the lattice. A summon card names a piece, whose rules (vectors under the board's
  symmetry, as chess's) move it; it is cast onto an empty cell of its controller's home row; a ready summon goes (a
  move onto an empty cell, which simply happens) or attacks (a move onto a foe, which goes on the chain so the foe can
  answer before blows land), either exhausting it; blows are struck together, each its power, and an attacker takes
  the cell of a defender that dies; an ability may need its object's row, so a summon strikes the foe only from the
  far row; a summon leaving play leaves its cell. The fixture (footmen, outriders that leap as knights, lancers that
  charge forward two, a captain's aura, bolts, a counter, a snare) on a five by five board. *Deck building on the turn
  engine*: the card mode's deck game built from its own cards and played on turns, a treasure a card cast for
  nothing that gives coins, an action costing one of the turn's actions, buying a move from a counted supply (a
  card's price, one of the buy pool), cast cards waiting in play until cleanup, a step that discards the hand and
  what was played, pools set each turn, the discard reshuffled into the deck when it runs out, the game ended by the
  supply's piles, every owned card scored (the cards that trash or gain, a choice of several cards, are left out). A
  scripted turn gives the same coins, the same purchase, the same discard and the same next hand in both engines.
  *Worker placement as exhaust and ready* had already been built so in stage 2. The round page shows the board (the
  summons standing on their cells; a summon picked lights where it may go, green, and whom it may attack, red; a
  summon cast lights the cells it may enter), a supply to buy from, and card faces drawn from data (a summon's piece's
  silhouette, a card's glyph); a cell's name no longer swallows the click meant for its cell. Machine gates: thirty
  board duels, random and computer, keep every board invariant (a cell's object stands there, a summon in play stands
  on its cell, nothing off the field holds one); on the board the computer beats random play 12 of 12 and hard beats
  easy 8 of 12; on turns deck building the computer beats random 6 of 6 and hard beats easy 6 of 6; every other mode,
  the response duel too, replays move for move; perft unchanged; the kernel grew to 132,580 bytes and the mind to
  42,449.
- **The engine, stage 6: Monte Carlo search as the third mind**, built, and placed where it measured stronger. The
  search gains priors (the game's own judgement one move deep orders the untried moves and biases the choice, fading
  with visits; a move legal only in some deals of what is hidden counts as even) and centred values (a worth counted
  as its change since the root, so a game whose worths run large is not flattened). Measured against each game's
  hard planner: tiles 9 of 12 (500 playouts, about a second a move), placement whose drops flip lines 8 of 8 (the
  planner's terms do not read it), four in a row about even, the duels about even at fifty to three hundred times
  the cost, deck building and connection and enclosure lost (long one-player turns it could not order; alpha-beta
  with the game's own terms on small perfect-information boards). So hard (`search: 'auto'`) searches the tile game
  (400 playouts) and games whose drops flip, and keeps the planners everywhere else; easier levels keep the
  planners, which carry the difficulty dials; a written game may decide for itself (`mind: { search: 'mcts' | 'plan',
  playouts }`). Seeded and bounded by playouts, never a clock: the same position and seed give the same move. On the
  tile page the computer at hard takes about a second and a half a turn in the browser. Every game at fair replays
  move for move as before.
- **The door** (`create_game`'s `tabletop`), built: `create_game({ title, tabletop: { game } })` makes a board game
  against the computer, chess or checkers from the book or a game written out from the systems, with the person's
  side, the level, the view, a seed and a clock. A published game asked for by name sends the agent to ask the person
  for its rules first. It is a recipe: a game row (`engine:
  'tabletop'`) whose page is made again on every read, played at `/api/sketches/<ref>/game`, edited with
  `update_sketch` (the kernel checks the edit) and exported by `export_game` as one page and its recipe. A game the
  kernel cannot play is refused when it is made. A routing card, two routing rows, and a vocab card
  (`get_game_vocab({ id: 'tabletop' })`) with the systems' grammar and the book's own chess pieces; the cosmos registry's board
  learns `lattice`. The `tools/list` payload pin is raised for the one schema property.

### Mobile genres

- **Swipe.** One reader turns a finger's flick into a tap or a direction, shared by every touch game.
- **A match-3 saga.** `create_pixelizer_game({ reducer: 'stone-saga' })` makes Philosopher's Stone a saga: a map of
  levels (thirty by default, `saga: { seed, levels }`), each a few moves to reach a score or to dissolve so many of one
  reagent, with a bonus for every move left and up to three stars. The map opens a level at a time and remembers the
  stars in the browser; there are no lives, a level is retried as often as you like. The map is made from the
  recipe's seed (the title's, unless you name one), so the same game is the same map everywhere, and its curve was
  measured against a steady player: the first levels are generous, the last leave little to spare. A gem is swiped
  toward its neighbour, or tapped twice. Philosopher's Stone without a saga is unchanged.
- **An endless runner.** `design_game({ quick: { goal: 'runner' } })` makes a game where your hero runs on its own down
  three lanes, faster and faster: swipe left or right to change lane, up to jump a hurdle, down to slide under a bar
  (A / D, Space and S on a keyboard), and take the coins. The rows come from the level's seed as you run, each with a
  way through; a crash ends the run and the best score and distance are kept. `distance: n` makes reaching it the win;
  `runner: { lanes, speed, max, palette, … }` tunes the run. A level of a world can be a run too (`levels.<id>.runner`).
  It plays in the browser (not in an engine export). Worlds without a runner are unchanged.
- **What can be made, measured.** The capability page gains the two genres: the endless runner is makeable; the
  match-3 saga is made by Stone Saga, and a world game's levels taking stars and a map is the next step it names.

### Resolution lock

- **A game is made for a screen.** A gameworld's `screen` (beside `camera`; `quick.screen` too) names the screen it is
  designed for: `'phone'` (upright, 9:16), `'tablet'` (an iPad on its side, 4:3; `{ pole: 'tablet', orientation:
  'portrait' }` stands it up), `'screen'` (a monitor, 16:9), or `{ aspect: [w, h] }`. A new game `design_game` starts
  is made for a phone unless another screen is named; `screen: null` asks for none. A stored game without one plays
  exactly as it did.
- **The frame is held.** Each level plays in the screen's frame, the least a player sees: a longer device shows more
  world along the frame's long axis (up to a third more), and bars past that or on a shorter device. The camera's
  field of view across the frame's short side never changes, so an upright phone keeps the view it was designed with.
  The game's pages leave room for the notch and the home bar.
- **The gates measure it.** The first-frame check and traversals render each level at its screen's frame.
- **Cameras framed for an upright screen.** On a phone (or any upright frame) each camera is framed by its kind, never
  by genre: a chase camera is pulled back and looks a little higher, so the hero stands about a third of the way up
  the screen, clear of the thumbs, with the way ahead above; the top-down and side cameras pull back; the view across
  the width narrows so the screen's height does not stretch. A frame on its side plays every camera as authored.
  `screen: { pole: 'phone', fov }` names the view across the short side yourself.
- **Touch controls.** A game made for a screen draws a touch pad on a touch device: a stick that rises where the left
  thumb lands, a look zone the right thumb drags (a first-person camera, a craft), and the buttons the hero answers
  to (jump; up and down in flight; fire when armed; use while standing where something is used). The layout follows
  the hero's kind of movement and the camera, never the genre: a side-scroller's stick runs left and right only. The
  pad is a gamepad drawn on the screen, so a remapped gamepad control moves with it, and a real gamepad, once
  connected, takes over. `?touch=1` shows it on any device, `?touch=0` hides it.
- **The screens laid out for it.** A game made for a screen lays out its UI once by that screen, never per game. The
  HUD's corners stay clear of the notch and the home bar, and its bottom row rises over the touch pad while the pad
  shows. Upright, a long banner wraps to the width, the battle menu stacks, and the title screen stands its title and
  menu at the foot of the screen in reach of the thumbs, with the cover above. On touch, the level's control hint and
  the pause sheet say what the thumbs do instead of naming keys, and the pad steps aside while a menu, a battle or the
  journal is open.
- **The exports carry it.** The desktop app opens in the screen's shape (a phone game upright at 450×800, a monitor
  game at 1280×720). The Godot project holds the frame (`[display]`: the base viewport, `canvas_items` + `expand`, the
  handheld orientation), and its kernel (0.30.0) keeps an upright game's view across the width, as the browser does.
  Roblox does not carry the screen: `screen` is a World page input marked approximated in Godot (the project file
  holds the frame; the touch pad and the safe-area zones are the page's) and absent in Roblox, and an endless run is
  the page's in both (`runner`, and the runner mechanic, whose events only the page's lanes send).
  The level cameras every engine reads take the screen's view. The Unity and Unreal guides add the two steps that match
  the editor's play view and a mobile build's orientation. The touch pad and the screen's UI layout stay in the browser.
- **Told when a screen fits badly.** A side-scroller or a fight on an upright phone is advised in the run's readout
  (a tablet or a screen frames them better); it is never refused.

## [3.1.1] - 2026-10-16

The first published release of the 3.1 line. `mojulo` 3.1.0 reached npm from a stale build of 2026-10-10 and is
deprecated (npm refuses to unpublish a package others depend on); no `mojulo-ui` 3.1.0 exists. Where this changelog
and the code say 3.1.0 for a change, it first ships here.

3.1 turns mojulo toward games: a sentence becomes a playable game in a named genre, with its own world, its own
people and its own look, played in the browser, shipped as a desktop app or exported to an engine. The detailed
log behind this summary, theme by theme, is [CHANGELOG-3.1.md](CHANGELOG-3.1.md).

### Upgrading from 3.0

- **Update the Claude plugin.** It runs `npx -y mojulo@3.1.1`; an unpinned `npx -y mojulo` moves to 3.1.1 once it
  is npm `latest`. `mojulo-ui` 3.1.1 is the matching dashboard. No new Node requirement and no new dependency.
- **Retired from the tool list, still callable by name**, so a plan step, script or skill that names one keeps
  working:
  - the office wing: apps, runtime daemons, the contextmap, mcp-orbit, triggers and primitive binding
    (`pack_runtime`, `pack_connected_services`; see `RETIRED_PACKS` in `lib/mcp/packs.js`);
  - game projects (`create_game_project` and its siblings): a game's home is its gameworld, through `design_game`;
  - `create_shoot_plan` and `update_shoot_plan`: a shoot plan is `forge_motion({ shoot })`.
- **The dashboard is view-only.** The copy-prompt buttons and the in-page edits (folders, gallery, stash) are gone;
  `/apps`, `/mcp-skills`, `/map` and `/graph` are removed, and `/maker` redirects home. Sign-in and Settings stay.
- **Stored rows that render differently** (the exceptions to byte-identical re-render):
  - **Heroes** get a structured midsection by default; `core: 'streamlined'` restores the 3.0 body byte for byte.
  - **Houses, stores, restaurants and malls** were the mirror image of their plans in the World and every export;
    they are now built the way the plan reads. House floors are muted. SVG stills were mirrored too and are now
    right-handed.
  - **The default animals'** silhouettes and proportions are retuned; a minted animal redraws on its next read.
- **The recipe book ships inside the package.** `MOJULO_RECIPE_BOOK` and the separate `mojulo-recipe-book` repo are
  deprecated: a clone still loads and warns at boot, until 4.0. `MOJULO_BUNDLED_BOOK=off` detaches the bundled book.
- **Every recipe records the mojulo version** that minted it and that last edited it.

### Games

- **The doors.** `design_game` makes a game: `quick: { goal }` for a genre in one call, `compose: { prompt }` for a
  whole gameworld from a sentence, or the full gameworld (world bible, character book, levels). `create_game`
  audits it; `export_game` ships it.
- **Genres** (`quick.goal`):
  - **Fighting game:** a side-view one-on-one fighter, local two-player, on 3D arena stages; every fighter is a
    character the character loop designs.
  - **RPG battles:** turn-based fights, a party of up to four switchable classes against groups of foes, with
    battle effects.
  - **Arena shooter:** deathmatch and team deathmatch against bots, first person or over the shoulder; the arena is
    made from words and one dial runs from realistic to stylized. Also a cover shooter along a trail.
  - **Racing:** a kart racer on a loop against rival drivers, and supercars on the grid (any paint, liveries, race
    moods, night driving). A true-scale divided freeway is the first piece of a driving world.
  - **Flight:** a flight sim (fly the ring gates and land), and air combat or a space shooter (`shoot` with a
    `craft`), on one flight model; craft are assembled from a shelf of aircraft and spacecraft parts.
  - **Also:** reach, collect, survive, avoid, sneak (guards and sightlines), rhythm, defend (tower defence), puzzle
    (block pushing) and farm.
- **Levels and places.** Buildings and room kits play as levels (a house, a store, a school, a crypt); a city is
  planned on a board and played as levels; towns, fixed-camera walkmesh scenes, and chapters of the same world over
  time.
- **What a game carries:** stats, inventory and shops, front menus, a cover and credits, scenes and two characters
  talking, a story bound to its world, weather, destruction, beams and explosions, and a soundtrack scored per level
  with action sounds.
- **Where it plays.** A browser shell runs title, levels and result. `export_game({ target: 'desktop' })` packs it
  as a desktop app with one seam for a store (Steam, GOG, Epic); mojulo ships no store SDK and uploads nothing.
  The Godot pack carries the event bus, combat and looks, and is the most complete engine translation.
- **What can be made next.** The cosmos cube describes a game as six facets, and its sweep measures what the builder
  can and cannot make yet ([docs/tool-surface/hillclimb.md](../docs/tool-surface/hillclimb.md)).

### Characters

- **`create_character`** (`as: 'hero' | 'creature' | 'animal'`) is the first door; `update_character` revises any
  part.
- **Each game's own people.** The Egocube rolls a cast from a game's setting and era: modern and future gear,
  mascots that walk as well as drive, and a palette that keeps its world's era.
- **The look.** An anime hero can be drawn painterly, with a painted face that animates. A stylism solver works
  silhouette, then value, then detail. Clothes fit the body, armour and creature apparel read as what they are,
  hair grows as locks, and light is painted onto the surface. Each character is drawn for its target screen.
- **Motion.** Showcase poses, ready stances, strikes, sitting and rising, vaults and carrying on the hero door, and
  a walk calibrated against measured human gait.
- **Animals.** Sea creatures, insects and other arthropods that move, behaviours said once and done per species,
  and an encyclopedia entry per species.

### Worlds and the look

- **The geocube** is a level's look as data. The color theorist solves its palette from what the world is
  for (land, sky, HUD and cover from one solve), and vertex contrast lights the whole world.
- **Stage kits** in the sixth-gen manner: an isekai meadow, bamboo and sakura groves, a research lab and night, with
  live grass, wind, fire and water.
- **Historic cultures** as walkable `historic` worlds from cited records, with period music and people: Sumer,
  Hellenistic Lindos, Qin Xianyang, Pompeii and Giza. Later eras through the same historic solver.
- **Buildings.** The `interior` kind furnishes one room of a house; houses gain finishes and composed or true-size
  furniture; a structure book documents a house, store, restaurant, mall or school.

### Making things

- **Solids.** The fabricator resolves a part's job from a shelf of standard parts and sizes it; `measure_solid`
  reads strength (bending, tension, print infill); mechanisms move with mass and friction; the `scad` kind gains a
  pinned library for threads, gears and text, and warns where they used to fail silently. Exploded views and teardowns.
- **Asset receipts.** `sign_asset` and `verify_asset` sign an exported file with a per-install creator key.
- **Audio, film and diagrams.** Orchestral strings and brass, a robot-rock style card; a world's shoot plan and a
  Blender film pack from `forge_motion`; flow charts lay themselves out.

### The agent's surface

- **One door per intent.** A new capability is an argument and a routing card on the tool that owns its intent,
  not a new listed tool. A pack opens to a menu; `create_sketch` and `cook` list routing only and read their manuals
  on demand. A routing eval with a held-out set measures where requests land.
- **Model tiering.** An agent task names how much judgment it needs (`ride`, `fill`, `judge`, `design`), never a
  model.
- **Self-description.** Mojulo describes itself by what it makes: things to Play, Print, Read, Hear and Observe.

### For contributors

- Test tiers: `test:critical` is quick again, the game and world suites that walk levels in headless Chrome are
  `test:e2e`, and range sweeps are `*.deep.test.js`. A test picks one case per procedure, never a whole catalog.

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
