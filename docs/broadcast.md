# The broadcast package

The TV graphics over a contest page: what a network's graphics department hands the director. The contest pages
(`control/lib/graph/contest/*-arena.client.js`) draw the game; the broadcast draws the coverage over it. Two files:

- [broadcast-package.js](../control/lib/graph/broadcast/broadcast-package.js) (Node, pure, on `dmath`): the
  packages, the colour theory, the metals, the cue table, the recipe's `broadcast` word. `broadcastData` is the
  page's data.
- [broadcast.client.js](../control/lib/graph/broadcast/broadcast.client.js) (the browser, inlined by source into
  every contest block before its arena client): the graphics engine on the overlay canvas and the director's camera.

## What it draws

| Graphic | When | Notes |
|---|---|---|
| The open | the contest begins | the event on the accent metal, the sides or the field beneath it; it goes into the bug |
| The bug | always | the title tab, a row a side, lane or seat (its kit's chip, its name, a mark: the server's ball, the seat to play), the hot column on the accent metal, the clock and period, the tab beneath it; a changed value rolls and flashes the row's colour |
| The call plate | a kernel call | the referee's word, its sub on a tab; the tone by the call's weight (the side's ramp, the accent metal, the referee's amber, the starter's green, the glass) |
| The lower third | with a closeup | the tag on the accent metal, the name on the side's ramp, a stat line on the glass, staggered in |
| The closeup | the dead ball after a decisive call | the camera eased onto the player (or the cup), a slow push and a breath of drift, letterboxed, and given back |
| The meter | a charge | the glass track, the fill in the player's ramp, alight near the top |
| The results board | the end | a row a place, the medals gold, silver, bronze, staggered in; the bug steps aside |

One plate holds the frame. A weightier call takes it at once, an equal one once the plate on screen has been read,
and a lighter one waits its turn (one word waits: the weightiest). Nothing is raised over the open.

## The stats

What a broadcast counts, it counts from the referee. Each sim keeps a log of the kernel's calls and its own events, each
stamped with its frame: a serve and its faults, a point and why, a hit and its speed, a kick, a save, a goal, a ball out
and its restart, a lie, a holed ball, a roll and its mark, a finish, a mark and a take-off.
[contest-stats.js](../control/lib/graph/contest/contest-stats.js) folds that log into a sport's stats. It runs the same
on the page (inlined after the sim, before this client) and in Node, and it never adds a judgement of its own.

| Shape | Stats |
|---|---|
| a net game (by side) | points won, aces (the server's points the receiver never touched), double faults, 1st serve in, winners and errors (by the last hit), longest rally, fastest serve |
| a goal game (by side) | goals, shots (a kick the sim calls `goalward`: struck at the goal from the attacking half, or any goal or save), on target, possession (the time since each side's last kick, play live), passes (to a team-mate), corners, fouls, offsides, saves |
| a turn sport (by seat) | golf: to par, putts, fairways, greens in regulation, penalties; bowling: pinfall, strikes, spares, open frames, ball speed |
| a meet (by lane) | time and place, hurdles hit; a jump's best, fouls and run-up speed |

A share with nothing to share (a first-serve percentage before a player has served) shows as a dash.

The broadcast shows them where the sport pauses (`STAT_COVERAGE` in the package):

- **The stats panel** (`tvPanel`): head to head, the stat's words between the two columns (or before a column a seat),
  the one best value lit in its side's colour. Shown at a tennis changeover, at half time or the end of a period, after
  every hole and every third frame. Nothing is raised over the results board.
- **The lower third:** the match's last closeup, a scorer, a strike or a spare, a jump's mark, each with its line's stats.
- **The results board:** a stat beside each place (aces, shots, putts, strikes, hurdles hit, fouls, run-up).
- **The outcome:** a hosted level's OUTCOME carries `stats.contest` (`{ <stat>: { <side, seat or lane>: n } }`).

`broadcast.stats` on the recipe: `false` turns the stats graphics off; `{ panel?, strap?, board?: [stat ids], at? }`
chooses the rows and the break over the contest's coverage.

## The packages

| Package | Look | Motion | Register default |
|---|---|---|---|
| `network` | smoked navy glass, chrome rims, gold for the decisive call | exponential eases, a sheen across the metal, closeups | realistic |
| `stadium` | slanted slabs, heavy chrome rims | a slam with an overshoot and a flash | action |
| `arcade` | rounded, saturated, inked type, cel metal in hard bands | an elastic pop | platformer, pinball |
| `clean` | flat glass, no metal | fades; no closeups | (by name only) |
| `table` | the game's own furniture: plates of its wood or felt, scores on its light inlay, brass fittings, a book face in mixed case | quiet fades, no sheen, no closeups | the board games |

## The board games

The tabletop pages (chess, checkers, the placement, euro, tile, card and round games against the computer) are
covered by the same package, written as CSS for a DOM page:
[broadcast-dom.js](../control/lib/graph/broadcast/broadcast-dom.js).

- **Seat plates** replace the status line and the clocks. Each player gets its kit's chip, a name ("You", or the
  player), a note (its colour, or the pieces it has taken), a score on the inlay (the points, or in a game of moves the
  material taken by the pieces' values), and its clock. The seat to play is lit, and a score that rose pops.
- **Calls** hang under the plates, over the board's top edge, so they never hide the play. The board page calls check,
  promotion and a multiple capture; the euro game calls its dice; the round game calls a new round. All of them call the
  end.
- **The result** comes a beat after the end's call: the places by points with their medals, and "See the board" and
  "Play again".
- The last move's cell flashes once.

A board game is shown in the `table` package by default, built of the page's own materials (`TABLE_LOOKS`: the board's
wood frame under its light square, or the card table's felt under the card stock), so the graphics read as the game's
furniture rather than a broadcast. Its tones come from the board, not the referee: the marker's red, the felt's green.
`tabletop.broadcast` names a TV look instead. A new tabletop page calls `tableBroadcastData`, puts `broadcastDomCss`
in its style, inlines `broadcastDomClient`, and calls `tv.table(...)` (or `tv.frame` and `tv.call`) from its render.

## Colour

- The sides' kits are kept apart in OKLab, and again as a deutan and a protan see them (Viénot, Brettel and Mollon's
  dichromat simulation). A kit too near an earlier one wears its alternate, its lightness thrown to the other end, as
  an away kit does.
- The type on a colour is white or the near-black, whichever has the higher WCAG contrast. Every default kit reads at
  4.5:1 or more.
- Each kit is a ramp in OKLCH: the lightness moves, the hue holds, and the chroma is clamped into gamut, so the darks
  are not muddy.
- A kit that sinks into the glass (a black side) is keylined.
- Lanes and seats default to the Okabe–Ito set, the colour-blind-safe categorical palette. Its black is lifted to a
  grey because the glass is dark.

## Metal

A rim, the accent and the medals are gradient stops. Each one is a bevel reflecting a studio sweep (a cool softbox
above, the dark horizon below the middle, the floor's warm bounce), weighted by the metal's measured reflectance at the
bevel's angle (`materials/metal-surface.js` `metalRgb`). It is deepened as F^1.6 for the light's second meeting in
the bevel's relief, then tone-mapped on its luminance so gold stays gold. Cel metal is the same sweep in three hard
bands. A small cell takes the lit band flat, so a digit is never cut by a band.

## A new sport

A sport the book holds, or one written out with the `distilled-rulebook` catalyst, plays on a shape whose page already
feeds the broadcast. There is nothing to do.

A new contest page (a new shape) does three things:

1. Lists `broadcast/broadcast.client.js` before its arena client in its page modules (and in
   `scripts/test-changed.mjs`'s reader for it).
2. Carries `broadcast: broadcastData(M.broadcast, { register, count, kind })` in its page data, and reads the
   `broadcast` key in its arena.
3. Calls `tvAdvance` on its tick, `tvCall` for each kernel call (with names for its sides or players), `tvShot` after
   it sets the camera, and `tvDraw` with its feed: `{ title, cols?, hot?, rows: [{ name, color, cells, mark? }], clock?,
   period?, tab?, meter?, hint? }`. It decides when a cut is safe (the dead ball, no player's body needing the wide
   shot).

`broadcast.client.test.js` fails for any `*-arena.client.js` that does not do this. `broadcast-package.test.js` fails
for any kernel call without a cue: a new call kind gets a row in `CALL_CUES`, or `null` to stay silent by name.

## Gates

- **Machine:** the package and client suites (headless, on a stub canvas), the stats folds on written-out call logs and
  on a real game against the kernel's score, the arenas' reads, the quick goal's lever, the emit pins, and the contest
  pages' live probes in Chromium.
- **Eyes:** the operator's. Screenshots were taken while building; nobody has watched a broadcast yet.
