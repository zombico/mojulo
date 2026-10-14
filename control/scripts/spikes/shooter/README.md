# Shooter: what an FPS / arena shooter needs, measured against what mojulo has

Branch: `1014-shooter-spike`. A research spike in the kart racer's manner: mechanics and map structure only (no looks,
characters or animation). Nothing registers a kind, mechanic, MCP tool, schema or bus verb. The two scripts mint
through the real handlers and measure; the rest of this page is the gap map they and a read of the source produced,
and the concepts a build would solidify.

```sh
# from control/
node scripts/spikes/shooter/probe.mjs [foes=4] [kit=trail-valley]   # the quick shooter's map and fight, PASS/FAIL per convention
node scripts/spikes/shooter/deathmatch.mjs [bots=4] [seconds=120]   # the same stage as a free-for-all on the engine's match layer
```

`PROBE_JSON=<path>` writes the probe's measurements; `DM_TRACE=1` prints the bout every 10 s to stderr. The probe needs
a kit that lays a trail (trail-valley, isekai-meadow, isekai-bamboo, isekai-sakura, alien-night, isekai-garden).

## The finding in one paragraph

Mojulo has **two combat stacks that do not meet**. The *bus stack* (`game/mechanics.js`: vars, guarded reactions,
watches, timers) is what `goal: 'shoot'`, the cosmos registry, the level sim and Godot all speak. It knows a campaign
corridor: foes at posts, `defeat-all`, `fail-on-death`, `supplies` taken once. The *engine match layer*
(`worlds/controllable/combat-match.js` + `worlds/match-modes.js`, from the mobile-suit arena) knows a bout: kills
credited to the last hitter, respawn at the spawn farthest from the living, spawn guards, teams, `killTarget`, a feed
and a scoreboard. It lives in `state.match`, is reached only through `create_controllable_world`'s `match` channel on
a pack map, and never reaches the bus, the level sim or Godot. So most of what an arena shooter needs is "built in
stack 2, absent in stack 1". And the map side has nothing at all: a shooter level is a trail with walls at its beats.
There is no arena site, no lanes, no spawn layout, no sightline law and no item placement by risk.

## What was measured (machine gate; nobody has looked at it yet)

`probe.mjs` on the default quick shooter. The numbers are identical on trail-valley, isekai-meadow and alien-night:
the layout comes from the trail's beats, not the kit.

| convention | held | measured |
|---|---|---|
| routes loop back (an arena, not a corridor) | no | spawn to far end 65.5 m for 96.9 m walked; one line, `extent` 26 × 65 m, 3.6 m of height |
| crossfire (2+ posts see a spot) on 10–40% of the way | no | 55% of the way; 3 posts on 12% |
| a mix of short (< 10 m) and long (> 25 m) sightlines | yes | p10 / p50 / p90 / max = 2 / 11.7 / 22.8 / 27.1 m, capped by the gunners' 28 m range |
| no post sees the spawn | no | foe-1 sees it |
| a hidden spot within 3 m of 80% of exposed spots | no | 30 of 49 (61%) |
| cover tiers | – | 16 of 16 pieces are full cover (2 m walls, 2-crate stacks); none is half cover, and there is no crouch to use it |
| a 1v1 at 15 m lasts 2–10 s | no | the player kills in 1.1 s (4 shots); a foe needs 13 unanswered hits over 12.8 s to kill the player |
| someone respawns after going down | no | no match layer on the level |
| a score or time limit ends it | no | `fail-on-death`, `supplies`, `defeat-all` |
| bots fight each other | no | one team, `foes` |

`deathmatch.mjs` hands the same stage and gunners to the engine's match layer as a free-for-all (`rule.target: 'all'`,
`killTarget: 5`, the posts as spawns). Over 120 s: **5 shots fired, 0 kills.** Every bot engages in the first ten
seconds. By twenty seconds every one stands still and stays that way: `pickTarget` takes the *nearest* body even
behind a wall, sight and memory forget it after `memorySpan`, and a hunter with nothing remembered stands where it is.
The deathmatch loop exists in the engine and stalls on any map with walls.

Defects these runs turned up, each small:

- `quick.foes` accepts 1–8 but is quietly cut to the trail's beats (4 on these kits): `foes: 6` and `foes: 8` mint 4
  (`gameworld/quick.js` `shootPosts` → `lay-concerns.js` `beatPosts`).
- The player's hp drops by a flat `SHOOT.hit` per hit (`fail-on-death`'s `hits`). The foe weapon's `damage` never
  reaches the player's hp.
- The hero-less quick shooter (the default) pilots on the `walk` rule. `scene/combat-score.js` exports combat only
  for a `platform` pilot, so **its gunfight does not travel to Godot at all**. Foes never shoot in Godot in any case
  (`godot-kernel/combat.gd`).
- `simLevel` passes only `{ entities, colliders }` to `createWorld`, so a level's `match` is dropped headless.
- The `down` fact carries no killer. The killer is the last `hit:<id>`'s `by`, and nothing joins them.
- `concerns.js` has no `laws` on any row, so `concernsOf` reports `checked: false` even where `concernLaws` checks the
  concern (cover, loop, watchers).
- Unverified: `respawnEntity` says volatile state is cleared, but the mind's `lastSeen`, `coverAt`, `navPath` and
  `mindPhase` look like they carry across a respawn.

## The concepts: mechanics

Status is the code as of this branch. **Built** means it exists and works for a shooter. **Stack 2** means only the
engine match layer has it (web, `create_controllable_world` only). **Absent** means nowhere.

### Weapon feel

| concept | status | where, and what is weak |
|---|---|---|
| hitscan / projectile | built | `fireClass` `sight` \| `area` \| `lob` (`combat-ranged.js` `initWeapon`) |
| fire modes, magazine, reserve, reload, heat | built | `auto`/`rof`/`cooldown`/`burst`/charge; `magazine`, `reserve`, `reload`; `energy*` |
| manual reload | absent | reload only on empty; no input for it |
| spread, bloom, recoil | absent | deterministic by design (the *seeded dice* rule permits a seeded cone; none exists); `ui/systems.js` names a `spread` nothing makes |
| aim down sights / zoom | absent | no fov change, no aim input |
| damage falloff | absent | flat at any range; splash flat inside `splashRadius` |
| knockback, self-splash, rocket jump | absent | hits move poise, never velocity; the shooter is excluded from its own splash |
| slots and switching | built (web) | `rule.loadout`, R cycles, 1–N picks, `switchReady`; slot 0 only in Godot |
| quick melee, grenades | partial | each needs its own loadout slot (`strike`, `throw`); no bounce, no cook |
| weapon archetypes | absent | `SHOOT.rifle` / `SHOOT.gun` are the only firearms; gear (`equipment.js`) has no firearm class and makes no combat stats |

The concept to solidify is **the weapon archetype as a role**, not a stat block: each archetype is a job on a
sightline band (close burst, mid precision, long precision, area denial, power weapon). Its numbers come from that
band and from a target time-to-kill, so a map's sightline histogram and a weapon set can be checked against each
other.

### Damage, health, armor

| concept | status | where, and what is weak |
|---|---|---|
| hit volume | partial | one egg per body (`combat-hit.js`); a head over a wall can be hit, but no zone pays more |
| headshot multiplier | absent | |
| armor that absorbs | absent | `body.shield` is a frontal arc, not a pool; no armor pickup or readout |
| friendly fire | built, fixed off | allies pass through and stagger (`combat-ranged.js`); no switch |
| player hp from the weapon | weak | flat `hits` per hit on the bus (above) |
| **time to kill** as a dial | absent | today it falls out of hp, damage and cooldown, and it is 1.1 s one way against 12.8 s the other |

**TTK** should become the authored number. hp, damage and rate are then derived from it, and the probe's duel
measures it.

### Pickups and item timing

| concept | status | where |
|---|---|---|
| health, ammo | built | `supplies`, each taken once; ammo refills the weapon in hand (`rearm`) |
| respawn on a timer | absent | composable from a timer and the `__sp_` flags, not lowered |
| armor, weapon, power-up pickups | absent | `buff`/`status` exist, nothing wires them to a pickup or to damage |
| bots that want items | absent | the forager's `grazeStep` is the template |

### Match structure, modes, score

| concept | status | where |
|---|---|---|
| respawn, spawn guard, farthest spawn | stack 2 | `respawnEntity`, `fireGuard`, `iFrames`, `respawnDelay` |
| teams, team kills | stack 2 (bot targeting built) | team mode from `e.team`; `pickTarget(…, 'enemy')` |
| frag limit | stack 2 | `killTarget` |
| time limit (most frags at the horn), draw, overtime, rounds | absent | `survive` is a countdown to *success*; a level ends only `success \| fail \| abort` |
| kill feed, scoreboard (kills, deaths, damage, accuracy) | stack 2 | `m.feed`, `m.stats`; drawn on the web page and the shell's score screen |
| a kill on the bus (killer, victim, weapon) | absent | `down` has the victim only |
| place / leader on the bus | absent | the racer's `laps` + `rivals` is the model: per-actor counters unrolled at lowering, a lead per rival (bus predicates compare a var with a constant, never two vars) |
| deathmatch, team deathmatch | stack 2 | `buildFfa`, `buildTeam` (pack maps only) |
| elimination, horde on the player | partial | `defeat-all` is one-sided; `waves` walks to a base, not at the player |
| capture the flag, king of the hill / control, bomb, gun game | absent | zone facts, `while`-gated timers and guards are the parts; nothing composes them |
| the match in the cosmos cube | absent | the shooter probe is "makeable" because the cube has no axis for match structure |

**The match is a mechanic on the bus.** The agent mapping mechanics proposed this and the racer proves the pattern:
lower kills, respawns, a limit and a place to vars and unrolled reactions, so the bus stack gains stack 2's semantics.
It then travels to the level sim and to Godot for free. Modes (CTF, control) are zone-and-timer mechanics on top of it.

### Movement

Jump, double jump, air control, strafe with mouse look, jump pads (`launcher`) and dash are built (`rules-platform.js`,
`maneuvers.js`). Sprint (boost is the nearest thing), crouch-walk with a lower hit volume (`kneel` roots the body),
slide and mantle are absent. Movement is the dial the arena genre turns hardest. It is mostly there, but only on the
`platform` rule, and the hero-less quick shooter doesn't use that rule.

### The bots

| concept | status | weak spot |
|---|---|---|
| target choice | partial | nearest only, even unseen; re-picked every frame (no stickiness, no threat, no "who shot me") |
| aim | partial | turn rate, reaction delay and a deterministic wobble by skill; no leading, no first-shot penalty |
| cover | built | `rule.cover`; no peek, no suppression |
| roaming that seeks the fight | **absent** | measured above: a free-for-all stalls in about 15 s |
| hearing shots | absent | a hit refreshes memory only with cover on |
| strafing at walk speed, jumping | absent | weave only during boost; gunners stand and shoot |
| items | absent | |
| squads | partial | `group.js` focus fire, pincer, shared sight; fires through allies |
| Godot | absent | no mind, nav, group or AI fire travels |

The racer's lesson applies: its `racer` rule drives the *player's own car* with input synthesised from a line. A
shooter bot should likewise be the player's own `platform` rule, its input synthesised by a mind that wants things
(the fight, an item, a position). The arena `ai` rule today moves its own transform.

## The concepts: map structure

Every value below is something a laid site can be measured for, the way the loop's laws measure a track.

| concept | status | what it means, measurably |
|---|---|---|
| **arena site** | absent (loopSite is the template) | a bounded, closed play space laid on a stage, reserved from what grows (`_keepOut`), flattened as the loop is. A circuit for feet. Law: every walkable cell reaches every other (`reachable`), and the bound holds the body |
| **map scale** | absent | infantry metres: a small arena about 30–45 m across, a medium one about 60–80 m. `arenaGeometry` is mech scale (radius ≥ 260) |
| **routes and loops** | absent | the walk graph has cycles; each spawn has ≥ 2 ways to the centre. Law: no articulation point (no single corridor) between the spawn zones |
| **lanes** | absent | three-lane / figure-8 / hub-and-spoke as route *topologies*. A lane is a corridor of the walk graph with its own sightline band |
| **chokepoints** | absent | narrow cells many routes pass through. Measured as betweenness on the nav grid; a law caps how many there are, and how narrow they get without a flank |
| **flanks** | named, not laid | `concerns.js` asks "a way round each strong point" and nothing lays or checks it |
| **sightlines** | partial (stealth only) | `blindSpots` checks a guard's sight. Needed: the sightline-length histogram over the map, matched to the weapon set's bands (the probe measures it today) |
| **cover tiers and density** | partial | full walls and crates at posts only. Needed: half cover (with a crouch to use it), and the probe's law (a hidden spot within 3 m of most exposed spots) |
| **spawns** | stack 2 | spawn zones on the map and spawn safety as a law (no enemy sightline into a spawn, a minimum distance to the nearest power position); the farthest-spawn pick exists |
| **verticality, power positions** | parts only | storeys, stairs, ladders, lifts and jump pads exist (`era/storeys.js`, `playscape/objects`), but nav is one floor (`nav.js`: "stairs, multi-level floors and space are out of scope"). A power position is high ground that sees much and is reached by few routes |
| **item placement by risk** | absent | health in safe pockets, armor and power weapons in contested space (high betweenness, exposed, at a height). Item timing comes from respawn timers |
| **symmetry** | absent | mirror and rotational layouts so team maps are fair by construction, and team bases at the mirror's ends |
| **objectives** | absent | flag stands and control zones are sites, placed by symmetry |
| **interiors** | built, closed to the shooter | building and room-kit levels are full of rooms and doors; `shoot` refuses a building (`quick.js`) and cover is trail-only |

The **map is a graph first**: places, the routes between them, and each route's sightline band and cover. That graph
is what the laws read; the geometry is laid from it. The floormap (`era/floormap.js`: regions at heights, `stair` and
`gap` links, `stand` items that hide, and its `reachable` / `stand-hides` laws) is the closest existing substrate. A
shooter map is plausibly a floormap with a combat program, as `program: { use }` lays a tavern's rooms by role.

## Built since the spike

- **Phase 1, the match on the bus**: the `frags` mechanic (`game/mechanics.js`, card `mechanic-cards/frags.md`):
  kills credited and said as `kill { killer, victim }`, the fallen back at rotating spawns, a frag and a time limit,
  the place, the player's death held by the cast. Laws in `game/mechanics.test.js` (frags on the bus) and
  `game/frags.test.js` (a match played in the level sim).
- A defect it surfaced on the way: the bus's event budget was counted over its life, so every level went deaf after
  4096 events; it is per drain now, on the web and in Godot.
- Open from phase 1: a spawn guard (in the sim a gunner respawned in front of the player's rifle was downed in the
  same frame), the farthest spawn on the bus, teams.

- **Phase 2, bots that play a match**: the mind's `frag` motivation (`worlds/controllable/mind.js`). It fights whom
  it sees and whoever shot it, heads for the noise or a hunch when it sees no one, and strafes as it shoots; a respawn
  starts its mind clean. `deathmatch.mjs` now runs it by default (`DM_MIND=hunt` for the hunters that stalled): the
  4-bot bout reaches its limit of 5 in 88 s with kills spread 5 / 4 / 2 / 3, where the hunters made 0 in 120 s.
  Laws in `worlds/controllable/frag.test.js`. Open: leading a moving target, item seeking, jumping, not firing
  through allies, and any mind in Godot.

## A build order, if this goes ahead

As the hill-climb asks: composed concepts, each one moving a genre probe, opt-in, absent keys keep every byte.

1. **The match on the bus** (M). A `match` mechanic: credited kills (`down` joined to the last `hit`'s `by`),
   respawn through the cast's `spawn` op after a timer with a spawn guard, a frag limit, a time limit that crowns
   the leader, and a place by unrolled lead counters as in `laps`. Also the kill on the bus, `simLevel` forwarding it,
   and Godot reading it as it reads guarded reactions. The cube gains a match axis (`power.mode` or `time.match`) so
   the sweep can tell a corridor from a deathmatch.
2. **Bots that play a match** (M). Target choice by sight and threat with stickiness; roaming toward the last fight
   or a map's hot spots when nothing is seen; hearing shots; strafing at walk speed; wanting items. The proof is
   `deathmatch.mjs` reaching its frag limit on a walled stage.
3. **The arena site** (L). A laid concern beside `loop`: a bounded floormap-like graph of places at heights with ≥ 2
   routes per spawn, lanes, a power position and spawn zones, with laws (reachable, no single corridor, spawn safety,
   sightline bands, cover density) and multi-floor nav, at least stair-linked per-floor legs, as building levels
   already route.
4. **Pickups with timing** (S). `supplies` that respawn; armor as an absorbing pool with a readout; weapon and
   power-up pickups that add a loadout slot or a timed `buff`; placed by the site's risk map.
5. **Weapon roles and TTK** (M). Archetypes keyed to sightline bands, TTK as the authored dial, a seeded spread cone,
   falloff, a head zone, a manual reload, ADS as an fov dial; knockback and self-splash for rocket jumps.
6. **Modes on top** (S each). Team deathmatch, elimination, control and CTF as zone + timer mechanics over (1), placed
   by the site's symmetry in (3).

Smaller fixes that stand on their own: `foes` beyond the beats; the player's hp from the foe weapon's damage; the
hero-less shooter on the `platform` rule (so its fight exports); `concerns.js` `checked`; clearing mind state on
respawn.

## Out of scope here

Looks, characters, animation, audio, the HUD's drawing (the `reticle` / `hitmarker` / `damage` / `feed` parts are
declared in `playscape/ui/parts.js` and not drawn), netcode (single operator, loopback only), and seventh-generation
fidelity.
