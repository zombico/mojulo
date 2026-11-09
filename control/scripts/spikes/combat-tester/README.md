# Combat tester: a game's gym for its weapons, movement, feel and destruction

Branch: `1108-realism-combat-tester`. A spike in the shooter spike's manner (`../shooter/`): nothing registers a kind,
a door, an MCP tool or a recipe field. Arena shooters, FPS games and military sims run on different rails over the same
ground: they shoot things, they blow things up, they mark the place, and the body moves at some speed. The tester
measures that ground for one game at a time, played its own way.

```sh
# from control/
node scripts/spikes/combat-tester/measure.mjs [game …] [--quick '<json>'] [--json <path>] [--twice]
```

`--quick` measures a recipe of your own (a `design_game` quick: its goal, `arms`, `camera`, `hero`, `pole`,
`world.feel`). `--twice` measures again and checks the two runs are byte-equal. About 20 s a game, most of it the mint.

## The flow: the meru island's, for gameplay

The meru island is the seed at a game's scale that a trail is grown on. Here the seed is the game's **gym**: its own
numbers, measured on the runtime it ships, validated there; its levels are then grown from those measures and held to
the same laws (as `gameworld/feel/reach.js` already sizes a platformer's segments from what its hero can cross). Phase 1
is the measures; phase 2 the gym page (the seed drawn: a movement lane, a firing range, a wall yard); phase 3 the arena
grown from it; phase 4 the gaps closed; phase 5 the measures and the gym in lib and the combat book.

## How it measures

Each game is a recipe. `measure.mjs` mints it through the real handlers (`design_game`), resolves its first level, and
takes the player the level gives (its rule, its weapon, its carried kit) and the foe it gives (its body). Every number
is that rule stepped on the controllable runtime at 60 Hz on scripted presses, never a formula:

| measure | what it plays |
|---|---|
| mobility | forward held 2 s and let go (top speed, time to 95% of it, the stop); strafe right 1 s then left (the counter-strafe); the walk and the boost held; a jump out of the run |
| lethality | per carried gun: the game's own foe at 5, 15 and 30 m, standing, strafing (A/D every 0.4 s), aimed (sights raised first), aimed at the head; the aim tracks perfectly and pulls the climb down, so what misses is the cone and the sway; the cone the runtime fired the first round in, and the tenth of a held spray, and the climb under it |
| destruction as seen | the operator's scope (1108): a plausible depiction, not physics. rupa's `scars` on a wall that never breaks: ten rounds at a wall 10 m off in brick, concrete, pine, sheet metal and steel: each mark's kind, size, depth, spall, and where it sits |
| switching | from each carried gun to each other: the press to the incoming gun's first round; each gun's reload, emptied and asked for (R) |

What the game asked for is its feel's card (`world.feel`, `feel/cards.js` POLES). A law compares the card with the
runtime, and a gap is a FAIL naming both numbers, as `lowerFeel` reports carried and lost.

## The games measured

| game | as | rule | camera |
|---|---|---|---|
| `conscription` | the contemporary FPS, hero-less (the default first person) | walk | first person |
| `conscription-hero` | the same with a body | platform | first person |
| `infinity-crisis` | the arena and hero shooter, stylized pole and its feel | platform | first person |
| `cogs-of-combat` | the cover shooter | platform | over the shoulder |
| `steel-serpents` | the military sim's body | platform | over the shoulder |
| `pole-realistic`, `pole-stylized` | the shooter pole alone, no feel | platform | the goal's |

## What was measured (machine gate; nobody has played it)

142 laws hold, 31 fail, over the seven games. Two runs are byte-equal.

### Mobility

| game | run | to it | stop | counter-strafe | walk | jump | the card's sprint |
|---|---|---|---|---|---|---|---|
| conscription (walker) | 4.6 | 0.017 s | 0.017 s, 0 m | 0.017 s | none | none | 7.2, not carried |
| conscription-hero | 4.6 | 0.28 s | 0.23 s, 0.49 m | 0.52 s | 1.6 | 0.55 m, 3.1 m long | 7.2, not carried |
| infinity-crisis | 6.5 | 0.10 s | 0.10 s, 0.25 m | 0.18 s | 1.6 (card 2.5) | 1.3 m, 3.6 m | 8.5, not carried |
| cogs-of-combat | 3.8 | 0.42 s | 0.32 s, 0.57 m | 0.73 s | 1.6 | 0.4 m, 2.2 m | 7, not carried |
| steel-serpents | 4.2 | 0.50 s | 0.35 s, 0.70 m | 0.85 s | 1.6 (card 1.3) | 0.4 m, 2.4 m | 5.8, not carried |
| pole-realistic | 4.5 | instant | instant | instant | none | 0.23 m | (boost 15.75) |
| pole-stylized | 6.5 | instant | instant | instant | none | 1.74 m | (boost 22.75) |

- **With a body, the feel is carried**: run, acceleration and jump land on the card's numbers. The counter-strafe is
  the readable dial between the games: 0.18 s for the arena shooter, 0.52 s for the contemporary FPS, 0.85 s for the
  military sim's body.
- **The default first person cannot play its template.** Hero-less, Conscription is the `walk` rule: instant to its
  run and instant to rest, no jump, no walk. The card's speed reaches it and nothing else does.
- **The sprint is carried nowhere** (five games). `lower.js` says so; the tester measures it.
- **The walk is the hero library's 1.6 m/s** whatever the card says (Infinity Crisis 2.5, Steel Serpents 1.3).
- **The pole alone moves instantly** (no acceleration), and **F boosts a person at a mech's multiple**: the hero-less
  pole player is an armed platform body with no `walkSpeed`, so the boost input (F, `controls/schemes.js`) runs it at
  3.5× its pace, 15.75 m/s at the realistic end and 22.75 at the stylized.

### Lethality

- **No automatic gun blooms or climbs.** The rifle's tenth round leaves in the first round's cone (0.6°) with 0.01° of
  climb; the SMG's the same. At its own rate the archetype recovers faster than it adds (`arms-kit.js` `auto`: bloom
  0.45° a round against 5°/s of recovery at 9 rounds a second is 0.56° recovered between rounds; the kick 0.41° against
  0.44°). The semi guns do climb (the handgun 1.75° under its tenth pull), so it is the numbers, not the mechanism.
- **The cost of moving is real and measured.** The cone widens on the move for every gun (the rifle 0.6° → 3.6°), so
  strafing at 30 m costs the rifle 8 rounds standing against 70 strafing (Conscription). Aiming tightens it (0.21°).
- **Headshots** are a multiplier only where the archetype has one (marksman, sniper, magnum). The sniper drops the
  military sim's foe with one aimed round to the body, so its head multiple is untested by that foe.

### Destruction as seen

| matter | mark | size | depth | spall |
|---|---|---|---|---|
| brick | chip | 5.4 cm | 22 mm | 10 |
| concrete | chip | 4.7 cm | 19 mm | 7 |
| pine | chip | 4.7 cm | 19 mm | 2 |
| sheet metal | dent | 2.4 cm | 10 mm | 0 |
| steel | dent | 2.4 cm | 10 mm | 0 |

Every round that met a wall left its mark where it stopped, metal dents while masonry and wood chip, and the softer
wall is marked wider. **Every gun leaves the same mark**: a handgun, a rifle, a shotgun and a sniper all chip brick
5.4 cm, because a round's energy is the world's (`rupa.shot`, 2000 J), never its gun's. The shotgun leaves one mark,
not a spread of pellets. Sheet metal and armour steel dent alike.

### Switching and reloading

Carried, everywhere, to within two frames of the arm's own numbers: the switch is the arm's stow plus the incoming
arm's draw (`handling.js`), and a sidearm is drawn faster than a long gun (0.55 s against the rifle's 0.88 and the
sniper's 1.15). An emptied magazine reloads in the gun's time and R reloads a partly spent one and refills it.

## Phase 2: the gym page

```sh
# from control/
node scripts/spikes/combat-tester/gym.mjs <out-dir> [game …] [--quick '<json>'] [--camera own|other|both] [--check]
```

The game's seed, drawn in graybox and played as the game plays: its own player (rule, kit, figure), its own camera
(and the other one: over the shoulder for a first-person game, the eye for a shoulder one), its own foe. Writes
`<game>.html` and `<game>-<other camera>.html`, about 4.6 MB each, self-contained. Three stations round a start pad:

- **the range** (ahead): the game's foe at 5, 15 and 30 m, standing back up 1.5 s after it drops (the match layer, its
  scoreboard counting); distance posts every 5 m; a concrete backstop
- **the wall yard** (right): brick, concrete, pine, sheet metal and steel side by side, 10 m off, each marked as its own
  matter (rupa's scars: nothing breaks)
- **the lane** (left): the run's strip with the measured stop box past the line, a step inside the rule's step and one
  over it, a ledge at what the jump reaches and one past it, a gap it crosses and one it does not, half and full cover

Every station is labelled with its numbers and a readout carries the game's measures. **Green is meant to be made, red
is not.** Two gates hold it:

- **the stations, headless**: the game's rule driven at each on the gym's own boxes (the floor the page finds: the
  nearest top straight below), every jump tried at every press from the edge to 3 m before it, as a player's timing
  would find. 28 of 28 as meant over the four games.
- **the page** (`--check`): each page opened in headless Chromium and its own runtime stepped frame by frame
  (`window.__mojCtrl.step`; software rendering is too slow to play in real time): it loads clean, a round drops the
  15 m dummy, each wall takes its matter's mark (chips on masonry and wood, dents on metal), the green step is climbed
  and the red is not. 32 of 32 over eight pages. Over the shoulder a round goes to the camera's crosshair (`converge`),
  which a script turning the body does not move, so the check aims the body's own line: the gun is tested, not the
  camera.

### What the gym found

**A jump reaches further on boxes than on a floor.** The jump stations are laid from the reach measured on boxes (the
highest ledge and the widest gap the rule makes at its best timing, by bisection), not from the flat jump, because the
runtime adds two things to every arc:

- **The step lifts every jump.** In the air the platform rule still steps onto any top within its step of the feet, so
  a ledge is reached at the jump's height plus the step (Cogs of Combat: 0.4 m of jump, a 0.69 m ledge).
- **A jump's gather is finished off a lip.** Pressed at a platform's edge, the body runs on, falls, and takes off from
  the air when its gather ends: Cogs of Combat leaves 0.73 m out over the gap, 0.18 m below the lip. With the step's
  catch on landing, its gaps are crossed at 3.0 m where its arc is 2.11 m.

| game | jump | ledge reached | arc | gap crossed |
|---|---|---|---|---|
| conscription-hero | 0.55 m | 0.84 m | 3.0 m | 3.7 m |
| infinity-crisis | 1.3 m | 1.59 m | 3.54 m | 3.99 m |
| cogs-of-combat | 0.4 m | 0.69 m | 2.11 m | 3.0 m |
| steel-serpents | 0.4 m | 0.69 m | 2.33 m | 3.34 m |

Whether a realistic body should finish a jump it began on the ground once the ground has gone is a design call; today
it does, and a level laid from the flat jump would be beaten by it.

**The shoulder camera turned on A and D** (closed after phase 5, below). The game's own legend on a third-person shooter
said "A / D turn": no mouse look, as the movement map read. Both of a game's gym pages look with the mouse now.

### One opt-in in lib

rupa's scars gave a world one wall matter, so five walls side by side could not each mark as their own. `rupa.scars`
takes `walls: [{ min, max, matter }]` (`readScarsSpec`), walls of their own matter by the box each stands in; any other
wall is the world's `wall`. Absent, the spec and every page are as they were (the byte pins `test:changed` reaches pass;
`scars.test.js` holds it).

## Phase 3: the arena, grown from the gym

```sh
# from control/
node scripts/spikes/combat-tester/grow.mjs <out-dir> [game …] [--quick '<json>'] [--words '<arena words>'] [--cross <s>] [--cover <s>] [--check]
```

The meru island's step: the gym is the seed, and the arena is grown from it. `grow.mjs` takes a game's measures and its
reach on boxes, reads them as the arena's numbers (**the seed**), tunnels the arena grammar (`gameworld/tunnel-arena.js`,
the arena concern's own laws and tweaks) from the asked words (default "a three-lane arena with high ground") with its
size from the seed, and holds what comes out to laws in **the game's own numbers**, where the arena concern's laws hold
fixed ones (an eye at 1.6 m, cover within 3.5 m, any box counted as cover):

| grown law | the game's number it reads |
|---|---|
| crossed in the seed's time | the run: the arena is `--cross` seconds of it across (default 8), inside the grammar's rails |
| cover that hides the eye within a second's run | the eye (no crouch: a box under it hides nothing) and the run (`--cover` seconds of it, default 1) |
| sightlines the guns use | each gun's reach: the farthest band where it drops the game's foe, hip or aimed, within twice its time at 5 m |
| each tower's stair is climbed by the game's rule | the step, and the rule itself driven up each flight |
| no tower top is jumped onto from the floor | the reach on boxes |
| no perch the jump makes sees a spawn | the reach on boxes: a crate or wall top the jump lands on is high ground the arena's laws never looked from |

What fails is **tended** by the game's laws as the grammar's tweaks tend its own: a crate the jump reaches that sees a
spawn is stacked over the jump (its turned partner with it), and every law (the arena concern's and the grown ones) is
run again. Then the arena is drawn as the gym is, played as the game plays, the game's player on the first spawn, its
foe on the next four (standing back up after they drop), crates marked as pine and the rest as concrete, the perches
the jump makes in yellow; `--check` drives each page's own runtime: it loads clean, a tower's stair is climbed on the
page, a round drops a foe at its spawn.

### What was measured

All four games: the arena concern's eight laws, the six grown laws and the page checks hold, 80 of 80, and two runs
write byte-identical pages.

| game | the seed (run, reach of the guns) | grown | tended |
|---|---|---|---|
| conscription-hero | 4.6 m/s; rifle and handgun 30 m, shotgun 5 m | 36.8 m across, 99% of 387 lines within 30 m | – |
| infinity-crisis | 6.5 m/s; rifle and SMG 30 m | 52 m across (the grammar's largest), 91% of 2043 lines within 30 m, the longest 50.6 m | 4 crates stacked over its 1.59 m jump: they saw spawns |
| cogs-of-combat | 3.8 m/s; rifle 30 m, shotgun 5 m | 30.4 m across, all 370 lines within 30 m | – |
| steel-serpents | 4.2 m/s; handgun and sniper 30 m | 33.6 m across, all 439 lines within 30 m | – |

- **How fast the body moves sizes the map.** Eight seconds across is 30 m for the cover shooter and 52 m for the arena
  shooter; the arena shooter's would be larger still but for the grammar's rail.
- **A high jump turns cover into high ground.** Infinity Crisis's jump stands on a 1 m crate, and from four of them a
  spawn was in sight: the arena's own spawn law looks only from tower tops. Tended, they are two high.
- **Half cover is a third of the cover** (12 to 16 of 35 to 49 pieces are under the eye) and nothing can use it: there
  is no crouch. The arena holds its cover law only by its taller pieces.
- **The arena shooter's longest lines outrun its guns**: 9% of its lines are past 30 m. A long gun, or a smaller arena
  (a faster `--cross`), is the call.

## Phase 4: the gaps closed, each moving a measured number

Five of the gaps the measures named are closed in lib, each an opt-in, so a game that does not ask keeps every byte of
its recipe's output (the page's runtime text grows; the emitted-page pins are re-pinned with a note saying how):

| gap | the change | before → after (measure.mjs) |
|---|---|---|
| the sprint carried by no game | a person's sprint on the platform rule (`sprintSpeed`, Shift held, the stick forward; never while firing or aiming), lowered from the card with the feel's `takes` | Conscription 7.2, Infinity Crisis 8.5, Cogs of Combat 7, Steel Serpents 5.8 m/s: the cards' sprints, none before |
| the walk the library's whatever the card | the card's walk lowered with its `takes` (`walkSpeed`) | Infinity Crisis 1.6 → 2.5, Steel Serpents 1.6 → 1.3 m/s |
| F boosts the pole's hero-less player at 3.5 × its run | a person's walk on the pole's platform feet (`walkSpeed`: no thrust, Z walks, the dodge kept) | realistic 15.75, stylized 22.75 m/s → none; walk 1.6 |
| no automatic gun blooms or climbs | a spread's and a recoil's `wait` (settling only once the trigger rests), 0.15 s on the automatic archetypes | the rifle's tenth round 0.6° / 0.01° → 4° / 3.69°; the SMG's 0.9° → 4.05°, 1.62° of climb |
| every gun leaves the same mark | a round's `blow` (joules, about its cartridge's at the muzzle) and a shell's `pellets`, carried on the shot to rupa's marks and blows | brick: the handgun 3.4 cm, the rifle 5.2, the sniper 7.8; the shotgun nine pellet chips of 3.1 cm (5.4 cm for every gun before) |
| the hero-less first person cannot play its template | a hero-less first person with a feel stands on the platform rule at its eye (a person's walk); without one, the walker as before | Conscription: to its run in 0.017 → 0.28 s, the stop 0 → 0.49 m, the jump none → 0.55 m |

`takes` (the hero's own jumps and the card's moves, unreleased on this line: the 1105 platformer slice) now carries the
card's sprint and walk too, so a platformer with `takes` sprints on Shift at its card's sprint. The tester's games ask
for their takes. Every law of the seven games holds (`measure.mjs`: 171 of 171).

## Phase 5: promoted, and a book page

The measures and the gym live in lib now, as the action lab's kernel did (`lib/graph/gameworld/feel/` and the feel
book): this spike's scripts re-export them, so their commands and gates keep their paths.

- `lib/graph/gameworld/combat/measure.js`: `measureCombat(pilot, foe, { feel })` (mobility, lethality, marks,
  switching) and `combatLaws(m)`, over a level's own player and foe (`combatantsOf(payload)`)
- `lib/graph/gameworld/combat/gym.js`: `reachOnBoxes`, `layGym`, `gymGate`, `gymOf`, `gymPageHtml`
- `lib/graph/gameworld/combat/book.js`: **the combat book**, `/api/sketches/<ref>/bible?book=combat` (`&view=other` for
  the other camera). The made game's first level's player and foe, measured on its runtime and set in the gym laid from
  those numbers, the readout and the laws beside them: where the feel book plays the card a game is made from, the
  combat book plays the game as it was made. A world that fights with guns (`combat/game.js`: a goal that shoots, or
  arms) is linked from `design_game`'s readout (`combatBook`) and the rail's exits once it is made; its `equipment`
  chapter reads it before the character bible. Tested in `combat.test.js` on the smallest game (a person, a card, a
  rifle and a sidearm, a foe): every law holds, the gym's stations are as meant, the page is written from both cameras.

The page checks' drive has a player's hand now: an automatic in three-round bursts with a rest past its wait, the climb
pulled down, the aim settled between targets, and the range fired until the foe drops. Phase 4 made a held spray bloom
and climb, and the old drive (the trigger held, nothing pulled) missed a 15 m body with it, which is the realistic
end's cost of spraying.

**The measures fire an automatic as a player does at range** (`burst`: aimed, three-round bursts): Cogs of Combat's
rifle drops the foe at 15 m in 8 rounds and 1.3 s in bursts, against 31 rounds and 5.8 s held. A gun's reach (the grown
arena's seed) reads the best of hip, aimed and burst.

**The arenas, grown again on phase 4's guns.** The rifles' reach is 15 m now (30 m in bursts takes 3 s, past twice
their close time), and the grow step tends an arena whose lines outrun its guns: it grows it again in close quarters
(the grammar's own trait) and keeps it when it serves the guns better without losing what the words asked. Infinity
Crisis's 52 m arena goes from 60% to 88% of its lines within 15 m (its law still fails: a 52 m arena for a 15 m kit);
Cogs of Combat's would reach 98% but loses its high ground, so the first is kept and the pull between them said (77%).
Both are the operator's call: a smaller arena (`--cross`), a long gun, or a spray that blooms less. Every other arena
law and page check holds (78 of 80).

## The third person, looked into (found recording the book)

The recording showed a figure facing the camera on the shoulder page. It was not the hero: it was the 5 m foe, facing
the player as it should. The hero was not drawn at all, and two bugs in the game were found and fixed:

- **A hero carrying a kit had no body.** The page builds a body per loadout slot's figure (a mobile suit's weapons each
  carry one); a kit's guns (arms-kit.js) name none, so nothing was built. Every third-person shooter whose hero carries
  `arms` was hit. The loadout branch runs only when a slot names a figure now (`armed-body.chrome.test.js`, which fails
  without the fix).
- **The over-the-shoulder camera stood on the hero's head.** The page stands a follow camera's eye 3 m short of the
  rule's (the chase's stand-off, follow-pull-in.js); the shoulder camera is 2.8 m behind, so its eye was drawn about
  0.3 m behind the hero, looking 10 m ahead, the hero under the frame. The simulation converges rounds from the rule's
  eye, so the crosshair the player saw was off the rounds' line too. A camera's `standOff` (0 for the shoulder,
  gameworld/quick.js SHOULDER) stands the eye where the rule puts it; the wall pull-in still applies.

- **The shoulder's controls.** The camera turned on A and D and, on a page without mouse look, nothing but a pad's trigger
  fired, though the legend said "click fire". The shoulder camera carries `mouseLook` now (gameworld/quick.js SHOULDER),
  and a third-person hero that shoots stands on `turnMode: 'look'` (levels.js): a click captures the mouse, the mouse
  turns and pitches the hero, A and D step aside, the left button fires and the right one aims; the legend says
  "A / D  step aside · mouse  look". Driven on a made Cogs page in headless Chromium (200 px left turned it 0.5 rad left,
  100 px up pitched it 0.25 rad, D moved it 2.3 m across with its heading kept, the held button fired, the right button
  raised the sights and let them down), and held by `design-game.quick.test.js`. (Headless Chromium's pointer lock sends
  its own recentring moves; a harness drops them and sends its own `movementX`.)

- **The gun in the hero's hands.** Over the shoulder the kit's gun was drawn nowhere: the eye's view carries it in first
  person, and the hero has no clip that holds one. The page now carries it on the body (gunplay-view.js): the chest
  turned side-on about the spine, a long gun's butt in the right shoulder's pocket and a pistol out at the arms' reach,
  pointed along the look and dipped at a low ready until the sights come up or a round goes, each hand closed on its
  station (the kit's `view.hands`, from arms/handling.js) with the arm reached to it in two bones and the fingers
  curled. Measured on a made Cogs page with all five long and short guns, ready, aimed, looking up and down, running
  and reloading: each wrist reaches its station (0 cm short). Getting there found two things: the run clip twists the
  chest each stride, swinging the support shoulder 20 to 30 cm back (the twist is taken out, a shooter's chest holds
  still over running legs), and a long shotgun's pump is out of reach in the run's crouch however far the chest turns
  (the gun is drawn back along its line, the butt under the arm, as a low ready carries it).

- **The shot's look.** The kit's guns set no effect scale, so the page drew them at its default, a mech's: a muzzle
  flash 1.5 m across, rounds as rods 30 cm thick and 5 m long, a ring and a star where they hit. A gun's `round`
  (gameworld/rounds.js) draws small arms as a sim does: a flash of 9 to 22 cm by cartridge for two frames, a wisp of
  smoke, a faint one-pixel streak crossing at the round's speed, dust where it strikes; measured on the page, the
  flash 7 cm in radius and the smoke 9 cm. Looking at it found a bug: the crosshair's point was searched from the
  simulation's camera, which stays behind a wall the page pulls its camera in front of, so with a wall at the hero's
  back every round flew backwards into it, at the camera (`shoulder.test.js` holds the fix).

- **Hands in first person.** The eye's view drew a gun with no hands. Gloved hands and sleeves now close on the gun's
  stations; the support hand draws and seats the magazine through a reload; a reach and a grab for a pickup or a use;
  a quick knife on V (`rule.knife`, the arms kernel's combat knife), drawn in the free hand and cut as a melee strike
  the runtime adjudicates (gunplay.test.js: an arm's length taken, 3 m not, no round while it cuts, two cuts drop a
  body). The page reports what the hands show (`__mojCtrl.hands()`), checked in Chromium. The knife cuts from the eye
  only (V is the chase camera's reverse view over the shoulder).

Still open over the shoulder: the head is not brought down onto the stock (no cheek weld), the support hand does not
slide along a handguard, the bow is not carried, and the foes' guns are not in their hands.

## Gaps, in the order they move a measured number

Closed in phase 4: the sprint, the round's energy (and the pellets), the automatic archetypes' bloom and climb, the
hero-less first person, the boost a person cannot have, the walk. Still open:

1. **The camera's aim over the shoulder**: the mouse looks now; its rounds go to the camera's crosshair, which nothing
   measures (the peek neither).
2. **A sprint clip**: the sprint runs the jog's clip faster (no sprint gait is picked at speed); the stance clips (none
   exist: crouch, prone).
3. **Crouch** (half cover is a third of an arena's cover and nothing uses it), and the slide and mantle the contemporary
   FPS template names.
4. **A jump's gather finished off a lip** and the step taken in the air: a design call (today the runtime does both).
5. **The barrel's length and the muzzle's words** (a suppressor, a longer barrel) change no number; the shot leaves from
   a fixed hand offset, not the arm's muzzle station.

## Not measured yet

Travelling rounds (lob, the bow: their own measure), the floor's pocks and a burst's crater, the stances (none exist),
the camera's aim (the shoulder's look and the peek: the gym plays them, nothing measures them), animation (the clips
at these speeds), a team or control arena (the grammar lays them; the grown laws have not been run on one).

## The firing range, for a game being designed

The gym and the book measure a game already made. The range comes before: its inputs are the weapons the game needs
and their fire types, optionally their skins (lib: `gameworld/combat/range.js`; `range.mjs` here prints it and writes
the page).

    node scripts/spikes/combat-tester/range.mjs [--spec '<json>'] [--out page.html] [--json out.json]

    { weapons: [ 'rifle'                                                   a kit word: its numbers and look the kit's
               | { name, fire: 'hitscan' | 'projectile' | 'melee', ... }    a fire type and the numbers it asks
               | { name, weapon } ],                                       a runtime weapon row as it is
      skins?: { <name>: <kit word> | { item, model?, parts? } },           the look only; absent, a graybox
      foe?: { hp } }

A person (the made first-person shooter's walk, its eye at 1.7 m) carries them; a body's box stands at 5, 15 and 30 m.
Hitscan is measured as the kit's guns are; a projectile adds its flight to each band and its burst; a melee weapon is
the body's quick knife (V), its cuts to drop a body at three quarters of its reach and whether one half a metre past it
is touched. The example spec (a kit rifle, an automatic of its own skinned as an SMG, a rocket launcher with no skin, a
blade skinned as a tanto) found an automatic given no climb fails "a held spray climbs"; given a fire type's defaults it
holds every law. A rocket is drawn at a person's launcher's scale (`fxScale` 0.5; the page's default is a mech's).

The range is heard: each weapon voiced from the SFX shelf by what it is (`range-sound.js`), or by a shelf word the spec
names (`sounds: { <weapon>: { shot?, reload?, hit?, draw? } }`, a melee weapon's `{ swing?, hit? }`); `quiet: true`
for none. The shelf had no small arms, so a `gunshot` family joined it (by cartridge, suppressed). In headless Chrome
each action's sources are counted (`range-sound.chrome.test.js`): a still range starts none; a rifle shot about 17, a
reload 53, a switch 21, a cut 22, a rocket's launch 82 and its burst 60.

## The artillery range, a big gun's

The firing range's sibling at a big gun's scale (lib: `gameworld/combat/artillery.js`; `artillery.mjs` here prints the
rounds' flight, what each does to each stand at each band, the laws, and writes the page). One turret
(`worlds/controllable/turret.js`) on its base, its rounds by key.

    node scripts/spikes/combat-tester/artillery.mjs [--spec '<json>'] [--out page.html]

    { mount?: 'battle-tank' | 'light-tank' | 'field-gun' | 'howitzer' | 'tower' | { class, ...its fields },
      ordnance?: [ 'apfsds' | 'heat' | 'he' | 'indirect' ],    up to four, keys 1 to 4 (the indirect shell: a mount past 45°)
      base?: 'fixed' | 'hull', reload?, sounds?: { shot?, reload?, burst? }, quiet? }

The stands (`terminal.js` STANDS) stand in a row at 250, 500, 1000 and 2000 m, each row on its own bearing so none hides
another; with the indirect shell, a bunker's roof and a ring of sandbags at 3, 4 and 5 km. The page is played from the
gun's sight: a mark under the bore for each band of the loaded round (from its flight measured on the runtime), zoom on
the right button, O for the outside view; the indirect shell's chart on the readout. A round's burst is marked by the
measures' own law (a hole, a breach, a spall, a dent, a scorch, a crater). In headless Chrome
(`artillery.chrome.test.js`): the long rod laid by its 1000 m mark holes 300 mm of armour, the HE shell breaches brick at
500 m, a shell on the ground craters it. Found on the way: the near marks are not in order of range (the sight sits above
the target's centre, so near targets sit further under the bore: parallax, kept); one indirect shell laid off the chart
lands about 12 m from 4 km, so the 12 m bunker takes a few rounds (its 1.5 mils of dispersion).

The base can be a vehicle of the library: `base: { vehicle: 'light tank', livery?: 'woodland', wear? }` draws the
vehicle registry's light tank as itself, driven on its own class, the turret's mount laid at its gun's trunnion
(`car-designer/military.js` splits the gun onto a `gun` bone with `gun: true`) and its turret and gun bones turned by
the mount. The graybox bases have their own looks by mount: the tower's tower, the field gun's carriage, a plinth for
the others. Found on the way: the tank's gun rode in its turret's faces (an elevation bone was waiting for a parented
rig), now split opt-in; the stabilized gun trails a hull still turning by about half a degree.

And a frame of the mecha shelf: `base: { frame: 'rover walker', stance?: 'brace' | 'roll' | …, palette? }`
(`gameworld/combat/frames.js`). The armed walkers fire from their own backpack mounts, the field walker takes its weapons
backpack, the rest (the work frames, the all-terrain walker, the brood walker) are fitted the shelf's own ring, cradle
and autocannon on their roof. Each frame stands at its stance (no gait is built). New rounds for the walkers' weapons
(`ordnance.js` WEAPON_ROUNDS): a 30 mm core and HE shell, an unguided rocket, a launcher's missile. Found on the way: the
rod's 650 mm law was the 120 mm round's own; "the faster round is laid lower" fails across calibres (a 30 mm HE shell
leaves faster than a 120 mm one and arrives later), restated by arrival; a rocket's 6-mil scatter read as 2 because its
low rounds struck the ground short of the band (now measured from a gun stood high); a big frame's 200k corners overflow
`Math.max(...)`.

The frames walk (`mecha-shelf/mecha-gait.js`): W / S at the gait its structure and size give it, O to the view beside it.
Found on the way: the reach at a stride's two ends is not the cycle's (a foot lifting flat from behind asks the ankle
most: a knee-forward work frame's stride fell to a third of its natural one until its swing lifted later, its foot
carried forward first); a swinging foot lifted less than a millimetre read as planted; the turret's pivot must be the
mount where the walk has carried it.
