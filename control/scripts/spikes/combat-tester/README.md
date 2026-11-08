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
is the measures; phase 2 the gym page (the seed drawn: a movement lane, a firing range, a wall yard); the grown arena
follows.

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

**The shoulder camera turns on A and D.** The game's own legend on a third-person shooter says "A / D turn": no mouse
look, as the movement map read. The gym's eye page for the same game looks with the mouse (`turnMode: 'look'`), so the
two can be played side by side.

### One opt-in in lib

rupa's scars gave a world one wall matter, so five walls side by side could not each mark as their own. `rupa.scars`
takes `walls: [{ min, max, matter }]` (`readScarsSpec`), walls of their own matter by the box each stands in; any other
wall is the world's `wall`. Absent, the spec and every page are as they were (the byte pins `test:changed` reaches pass;
`scars.test.js` holds it).

## Gaps, in the order they move a measured number

1. **The sprint**: carried onto the platform rule (a person's, not the mech boost), so the cards' sprints reach a game.
2. **A round's energy from its gun** into rupa (`rupa.shot` per weapon, the shotgun as pellets), so a marks law can
   tell a pistol from a rifle.
3. **The automatic archetypes' bloom and climb**: recovery that waits for the trigger to rest, or numbers that add
   faster than they recover, so a spray costs what the realistic end says it does.
4. **The hero-less first person** on the platform rule (as the shooter spike asked), so the default FPS plays its card.
5. **The boost a person cannot have**: a platform body with no gear and no walk should not thrust.
6. **The walk** from the card.

## Not measured yet

Travelling rounds (lob, the bow: their own measure), the floor's pocks and a burst's crater, the stances (none exist),
the camera's aim (the shoulder's mouse look and the peek: the gym shows it, nothing measures it), animation (the clips
at these speeds). The grown arena is phase 3.
