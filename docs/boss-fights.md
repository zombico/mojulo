# Boss fights

A boss used to be a foe whose phases changed only its temper (`worlds/controllable/mind.js`: `rank: 'boss'`, `phases`).
`control/lib/graph/boss/` gives a boss what makes a fight with one:

- a gimmick read off its name and design;
- attacks a body can read before they land, each one escapable;
- phases that change what it does;
- for a vehicle, mechanics that beat it, rather than rounds poured into it.

The director (`worlds/controllable/boss.js`) plays them, and the page draws them (`scene/channels/controllable/boss-view.js`).

## Attack patterns: an attack as a timeline

`boss/patterns.js`. A pattern is laid in the boss's frame. Its origin is the boss, +x is the way it faces the body it
attacks (the aim), and the body stands `reach` metres down the aim. A pattern has three parts:

- **tell**: the wind-up, what the boss does, and each hazard's mark on the floor from the moment it is shown (`mark`).
- **hazards**: shapes in time (`at`, `for`), each its `harm` (a share of a body's health). The shapes:

  | shape | what it is |
  |---|---|
  | `line` | a beam, a charge's lane, a lock's shot |
  | `cone` | a volley's fan |
  | `sweep` | a beam turned across an arc |
  | `ring` | a front rolling out |
  | `disc` | a shell's landing |
  | `square` | a charged floor tile |
  | `strafe` | landings walked down a line |

  A hazard with `track` follows the body until that moment, then holds. A `low` one passes over a crouch. A `cover` one
  is stopped by a box between its origin and the body.
- **opening**: the recovery after it. In its opening a human boss stands winded and takes half again.

The shelf is `PATTERNS`: sweep, fan, charge, ring, rain, lock, strafe, grid and scythe. A new attack is a row.

### The laws

`boss/laws.js` measures each one, never takes it on trust. The pattern is laid with the body at its reach. Each hazard is
read on a quarter-metre grid of the ground it touches: when it first lands on each cell after its mark is shown, how long
it stays there, and how far the nearest ground it never touches lies.

| law | holds when |
|---|---|
| told | every landing is shown at least a reaction (0.6 s) before it comes |
| escapable | every cell it lands on is left in time (`out`: run speed times the time left after reacting), passed in a dive's invincible time (`through`), or crouched under (`under`). A cell escaped only behind `cover` is counted as cover the arena must stand. |
| survivable | a body standing still anywhere in it loses half its health at most |
| opening | a recovery of 1.2 s or more follows the last hazard |

The body is the operative's (`BODY`: one pace of 5.8 m/s, a dive of a second, invincible through it). A game passes its
own.

## Human bosses: a gimmick in phases

`boss/bosses.js`. A boss row has:

- **a name and a design read as one idea**: Cinder the flame trooper, Glint the marksman, Breaker the demolisher,
  Lineman the high-voltage man;
- **its moves**: the shelf's patterns, each under its own name and tell, tuned to the idea (`tune`: `reach`, `harm`,
  `at`);
- **the look of its tells**;
- **what its arena wants**;
- **its phases**: from full health, then below each threshold. Each phase gives the moves' weights, its `tempo` (the
  seconds between moves), its mind's `temper`, and an `event` at the crossing:

  | event | what the crossing does |
  |---|---|
  | `burn` | fires along the arena's rim |
  | `relocate` | the boss moves to the next of its perches |
  | `tear` | the piece of its cover nearest the body is torn out |
  | `live` | the floor's grid fires on its own between moves |
  | `adds` | its dormant crew is woken |

A phase may also wear a `look` (one of the boss's `looks`): the figure the page swaps in at the crossing (`bossRule(id,
{ figures: { <look>: <figure> } })`). Cinder's mask cracks open in his last.

### Counters

A **counter** is how a boss is beaten other than by rounds poured in (`counters`, a row a kind). Its kind so far is
`part`: a piece of the boss's own that

- takes what it `takes` (`round`, `explosive`) until its `hits` break it;
- only from where it shows (`from: 'behind'`);
- only while it is bare (`when`: `vent`, the opening of a move that turns the boss away to vent; `open`, any opening;
  `always`);
- and what its breaking does (`breaks`): a `stagger` of seconds where it stands, a `harm` of its health, its pending
  landings called off, a ring of its own fire, and each move in `shorten` reaching a share as far from then on.

The law `counter-<id>` holds it reachable: the move that bares it comes in every phase, and its opening is long enough
to react and land its hits (a round a quarter second).

Cinder's is his tank. Every arc of flame ends with him turned away to vent the lance, his back and the tank toward the
body he attacked. Four rounds into it then and it ruptures.

A `flash` counter is a stun bursting within `within` metres of the boss's eyes, `from` in front of it, with a clear
line to them, while a move holds its eye to a scope (`when: 'scope'`, a move's `scope`). The boss is blinded `blind`
seconds where it stands, its shot called off, taking `mult` times what lands on it. A flash is never used up. Its law
holds the lock long enough, from its start to its shot, to react and throw (a second's flight).

Glint's is his glint. A boss is never knocked out by a stun (`knockout.js`): what one does to it is its counter's alone.

A boss's row may give its mind a `motivation` (`mind`): Glint's is a sentry's, so he holds where he stands and fires
from it rather than walking down to the body. His `relocate` takes him on from the perch he stands at to the next.

The mind crosses the phases itself (`mindPhases`). The laws (`bossLaws`) hold:

- every move holds the pattern laws;
- three moves or more, and two or more a phase;
- thresholds fall;
- each phase as quick as the one before or quicker.

A new boss is a row.

## Vehicle bosses: parts, states and mechanics

`boss/vehicles.js`. A vehicle is won by mechanics.

- **Parts**: boxes in its own frame (x ahead, y left, z up), separate from the `dress` it is drawn in. Each part says:
  - what hits it `takes`: a `round`, an `explosive` (a launcher's round, a grenade) or a `mine`;
  - how many `hits` break it;
  - what it stands `behind` (not there to hit until that part is broken);
  - whether it is `weak` (its hits come off the vehicle's health `mult` times);
  - the state it is `shown` in, or a list of them;
  - where it is reached `from`: `behind` the vehicle, or its own `side`, within an `arc` (a reloader on its back).
- **States** drive it. Each has its moves, its tempo, whether it follows its `route` or flies its `runs`, its altitude,
  and its ways on (`to`): parts broken (`broken`, all of them or `any`), a run flown (`flown`), or seconds out (`after`,
  `slower` for each of some parts broken: a reload, for each reloader shot down). A `window` state (a reload, a walk, a
  fold) lays no move: it is the fight's breath.
- **A mecha** (a row with a `frame`: a word of the mecha shelf) is drawn as its own figure, not as boxes
  (`gameworld/combat/boss-figures.js`): each state says what its body does (`form`: its tank form; `clip`: a clip played
  through the state, `loops` times), its walk and its drive by the ground they cover (`stride`); a part shot off hides its
  `bones`. A round on it is judged along the shot's line through its parts' boxes.
- **A carrier** (a row's `carrier`) fights through what it carries: gunners on it, drones from its bays, and a package a
  hacked drone carries home (below).

| vehicle | how it is won |
|---|---|
| tank | mines laid on its route break its tracks; with both broken it is stranded, and launcher rounds go into its engine grille |
| gunship | its attack runs walk rockets down a line through the body (hard cover, or off the line); launcher rounds go into its rotor hub while it hovers to turn |
| walker | launcher rounds strip a leg's plating (three to a leg), rounds break the bared knee, and with both knees broken it kneels and its cockpit is in reach |
| siege walker | standing, its barrage is marked as it is fired (a wall between you and the gun); mines on its round break a leg (two under one foot) and it folds onto its wheels; its reloaders, shot from behind, slow its reload. Folded it is the tank (its states, moves and parts the tank's: its wheels mined, its engine from behind once stranded), and its hips, bare between its folded legs, are hit from its sides |
| brood walker | a carrier: its gunners (its roof, its two hangar doors) put down from outside their arcs; a courier drone hacked with the RF gun fetches a package and carries it home into a door whose gunner is down, where it goes off in its hangar; from the second delivery its drones chase the hacked one (shoot them off it); three deliveries |

The laws (`vehicleLaws`) hold:

- winnable with the arms in hand: a weak spot reached, everything in front of it breakable by what the level gives, and
  the state it shows in reachable. There is no tank without mines and no walker without a launcher.
- its moves hold;
- every state attacks (a window, and a carrier's states, are not asked);
- enough mines for the parts a mine breaks.

## Played

`worlds/controllable/boss.js` directs a body whose rule carries `boss`. Use `boss/stand.js` to stand one off the
shelf: `bossRule`, `bossMind`, `vehicleEntity`.

- **A human boss** fights with its mind between moves. Every `tempo` it takes a move by weight. Through the tell and the
  hazards it is planted, facing the aim: its rule is held for the step, the way invisible mode borrows a rule, so the
  pipeline is untouched. A charge carries it down its lane.
- **A vehicle** is driven by its state. Each hit on it is judged by part after the step: its health is given back, then
  taken again as each hit counts, by where the round or burst landed in its own frame. A smaller part beats the hull on
  a tie. `E.bossHit` judges a hit another module lands.
- **Hazards** land once on each body of another team inside them, unless that body is invincible (a dive through), is
  crouched or lying under a `low` one, or is behind cover from a `cover` one's origin. Invisible mode starts no move.

**A carrier** (`boss/stand.js` `carrierEntities` stands its gunners and drones):

- its GUNNERS ride it, each laying a burst on the pilot in its arc and in sight (cover as a burst's), or on a hacked drone
  near it; a gunner is a person, killed by rounds or knocked out by the dart, and stays down;
- its DRONES are endless, launched from its bays and reprinted when shot down: a hunter patrols and drops a grenade on a
  pilot it sees (a disc marked from the drone, a roof is cover); a courier laps round it;
- the RF gun (a slot whose weapon says `jam`) held on a courier hacks it: it fetches the nearest package, carries it home
  into a door whose gunner is down and goes off there, an explosive hit on its hangar. From the second, its hunters chase
  the hacked courier; shot down, the package is lost and comes back to its pallet.

**Land mines** (`worlds/controllable/mines.js`, the kit's `mine`) are laid at the feet on the trigger:

- armed after a moment;
- tripped by a person of another team within 1.4 m, or by a vehicle whose footprint stands over one;
- the burst hurts whoever is near, and a vehicle is told so its track breaks.

**The page** (`boss-view.js`) draws:

- each hazard's mark in the boss's tell colour, filling as its landing nears, then the landing itself in its hazard
  colour (a sweep's beam, a ring's front, a strafe's landings one by one);
- the mines, amber while arming and red once armed;
- a scope's glint at the boss's eye while a move holds it there, flaring as the shot nears, and sparks circling its
  head while a flash has it blind;
- a human boss's counter prop on its torso bone (Cinder's tank and its hose to his right hand): glowing while it is bare,
  white for a moment as each hit lands, a burst of fire when it breaks;
- a vehicle's dress and parts: a weak spot red and beating while it can be hit, a broken track wrecked; a mecha's parts
  as marks on its figure, each only while it can be hit, dim where the pilot stands out of its reach;
- a carrier's gunners' guns and their tracers, its drones and a mark over each (a courier green, a hacked one blue with its
  health, a chaser red), its packages, the RF gun's beam and the hack's ring; its gunners and deliveries under the bar.

The HUD draws the boss across the top: its name, its title, and its health with a tick between phases.

`node scripts/spikes/mission/boss.mjs --boss <id> --out dir` stands a boss in an arena laid for what it wants, with the
operative carrying the kit it is beaten with. `--plan` prints its laws. `--guard <ref>` gives the boss a minted figure,
and `--look <look>=<ref>` the figure a look wears (both from the database under `MOJULO_DATA_DIR`):

```bash
node scripts/mcp-stdio.mjs call create_character --json "{\"as\":\"hero\",\"ref\":\"cinder\",\"spec\":$(cat scripts/spikes/mission/cinder.json)}"
node scripts/spikes/mission/boss.mjs --boss cinder --guard cinder --look cracked=cinder-cracked --out /abs/dir
```

(`cinder-cracked` is the same spec with `"headgear": "weldingMaskCracked"`.)

The operative is the player's own the same way: mint `scripts/spikes/mission/operative.json` as `operative` and add
`--hero operative --vault speedVault --roll rollForward --climb climbUp --crouch crouchIdle,crouchWalk --prone
proneIdle,proneCrawl`, his clips by the names his recipe gives them. With both made figures and the cast light the page
is near 19 MB: `node scripts/pack-page.mjs <page> --parts --text` splits it under a host's limit.

## What is not yet

- Cinder and Glint have looks of their own (`--guard` and `--look` on the spike, characters minted from
  `scripts/spikes/mission/cinder.json` and `glint.json`); Breaker and Lineman wear the guard's figure. The `part` and
  `flash` counters are built; Breaker's charge into a wall is still to come.
- A realistic hero remade in place (`update_character`) came back without its head's skin in the database it was read
  from, so its headwear had nothing to pin to; mint the look anew (`create_character`) until that is understood.
- A vehicle off the shelf's boxes is boxes. Its turret does not turn apart from its hull, and the walker does not
  stride. The mecha (the siege walker, the brood walker) are their own figures, but their guns do not turn on their
  mounts yet, and the brood walker's eggs do not open as a drone launches.
- A boss is not yet named by a level: a `design_game` world's `goal.boss` still stands a foe of the boss rank. The
  casting call does not propose a gimmick, and the game book has no boss sheet.
- The radar does not show a vehicle's weak spot. The arena laws (that cover stands where a `cover` hazard needs it)
  are not measured on the arena.
