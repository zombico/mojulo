# Local multiplayer principles: one screen, everyone's state in view

The principles a game played by several people at one machine is designed and checked by: one device, one app, several
controllers (or one keyboard's halves), and one screen whose shared state every player can see at all times. They are
written for the rails, not for a genre: a game is a point in the space the settings below name, and each value is built
once so every composition that asks for it works.

Gate: machine for what a law measures (a seated body on screen, a seat's colour, a replay's hash); eyes for whether it
plays well together, which is the operator's. Every law here advises; none refuses ([bicycles.md](bicycles.md)).

## The settings (the soul facet)

Playing together lives in the cosmos cube's `soul` facet, beside `party` (the characters in the group): `party` says who
is in it, these say who drives them. Each value starts `absent` in the registry until it is built, so the sweep and the
hill-climb page (`docs/tool-surface/hillclimb.md`) say how many compositions each value would open.

| setting | values | what it decides |
|---|---|---|
| `seats` | one · two · four | how many players a game seats at most |
| `contest` | co-op · versus · teams · free-for-all | who wins against whom, and how a score is read |
| `dependence` | parallel · roles · handoff | parallel: each plays the same verb side by side; roles: each has a different job; handoff: one player's step needs another's |
| `frame` | follow-all · fixed · scroll · split | how the screen holds every seat: a camera framing them all, one fixed screen, a screen the game scrolls, or one view per seat |
| `input` | real-time · window · turns | real-time: each seat's input every tick; window: a contest read over a time window (mash, timing, hold and release); turns: one seat at a time |
| `pool` | shared · own | lives, score and pickups held by the team or by each seat |
| `join` | drop-in · lobby | when a seat may join or leave |

A genre is a preset point, never a lock (as an intent's genre is a starting cube: `gameworld/intent.js`).

## The principles

1. **One device, one app.** Every seat is a controller on the same machine: a pad, a keyboard half, or the touch pad
   (which seats one player at most). Nothing here reaches another device.
2. **Everyone is always on screen.** The frame holds every seated body. Following all, the camera widens to a limit;
   past it, the screen's edge holds the leader back or the straggler is brought in (a bubble, a warp). A seat is never
   stranded out of view.
3. **The camera decides the frame.** A camera that can frame every body (side-on, top-down, a fixed or isometric
   arena, a pulled-back third person) shares the screen. A first-person or chase camera cannot: one view per seat,
   split. So `frame: split` follows from `space.camera` (first person, chase), and a shared frame on such a camera is
   reported, never silently drawn.
4. **A seat is an identity.** Each seat has a number and a colour, in the four-port convention (P1 red, P2 blue, P3
   yellow, P4 green), a mark over its body, its own hits tinted, and a corner of the screen for its own state. No body
   on screen is anonymous.
5. **Shared state is shown, never inferred.** What belongs to everyone (the order queue, the boss's bar, the team's
   lives, the clock) sits in one place for all; what belongs to a seat (its score, its health, what it carries) sits in
   its corner. No player needs another's screen or memory to know the state of the game.
6. **Joining is free.** With `join: drop-in`, a press joins at any time, as a coin-op's start did. A seat that leaves
   hands its body to the AI or takes it off, as the game says. The game scales to the seats present (foes, health,
   orders, waves) and never makes a player wait to begin.
7. **A seat takes a body, and an unseated body stays itself.** Every pilotable body already runs a pilot rule or an AI
   rule. A seat is the switch: a second hero, a deathmatch bot, a race rival, a versus fighter. With no seat it plays
   as it does today. This is the plug: a game names the bodies a seat may take, and nothing else changes.
8. **Dependence and contest set the rules.** Parallel co-op needs room and fair shares; roles need each job to be
   needed; handoff needs the step between players to be visible (what is carried, where it goes, who waits on whom).
   Versus needs symmetry or a stated asymmetry; teams need the team's colour as well as the seat's.
9. **Shared or own is a choice the screen shows.** Shared lives (one pool, everyone continues) or own lives (each seat's
   credits), a shared score or a seat's own, pickups to the taker or to the team: the HUD shows which, at a glance.
   Friendly fire is off unless the game asks for it.
10. **Readable in a crowd.** Effects scale down as seats are added (four players' juice at full strength is noise:
    `scene/juice-style.js`), and a seat's own hits stay distinct from everyone else's.
11. **Inputs are the record.** Every seat's input, tick by tick, is the replay: the same inputs give the same state, so
    a two- or four-player run is audited, replayed and held equal across the engine legs the way a single player's
    is. Seeded dice only, as everywhere (CLAUDE.md, Golden rules).
12. **A window is an input model.** A contest read over a window (who pressed most, closest to the beat, held longest)
    is a pure function of every seat's presses over that window. It needs no physics and no camera, so a whole family
    of party games is a set of rules over input streams.
13. **Absent means as it was.** A game with no seats settings is a one-seat game, and its pages and recipes are byte for
    byte what they were (an absent opt-in channel adds zero bytes).

## The controller seam

Every seat reads through the controls library (`control/lib/graph/controls/`): schemes of intents, device families, and
the kernel that resolves bindings and layouts (Xbox, PlayStation, Nintendo glyphs). A seat is a device bound to a scheme,
so a remap, a legend and a conflict check are per seat. No runtime reads a pad by its button numbers, and a pad keeps its
seat by its `Gamepad.index`, not by the order pads were plugged in.

## The reference points (fixtures, not products)

Four archetypes probe the space; each is a cube, and the sweep says what it waits on.

| reference | contest | dependence | frame | input | pool | join |
|---|---|---|---|---|---|---|
| A cooperative kitchen (Overcooked) | co-op | handoff | fixed | real-time | shared | drop-in |
| A party mash (most presses wins) | free-for-all | parallel | fixed | window | own | lobby |
| Brothers on a quest (Giuseppe and friends; a belt-scroll brawler in 3D) | co-op | parallel | follow-all | real-time | own | drop-in |
| A shared bullet hell (Contra, Raiden) | co-op | parallel | scroll | real-time | shared | drop-in |

Points between them are the reason for the rails, each made by values already on the list: one player drives while
another shoots (co-op, roles, scroll); two kitchens racing (teams, handoff, fixed); a brawl whose clashes resolve as
mash-offs (versus, window, follow-all); a platformer where one holds the door for the other (co-op, handoff,
follow-all). A first-person deathmatch (GoldenEye) and a kart race need `frame: split` (principle 3), so they wait on it.
