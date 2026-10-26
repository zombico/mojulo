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

## The packages

| Package | Look | Motion | Register default |
|---|---|---|---|
| `network` | smoked navy glass, chrome rims, gold for the decisive call | exponential eases, a sheen across the metal, closeups | realistic |
| `stadium` | slanted slabs, heavy chrome rims | a slam with an overshoot and a flash | action |
| `arcade` | rounded, saturated, inked type, cel metal in hard bands | an elastic pop | platformer, pinball |
| `clean` | flat glass, no metal | fades; no closeups | (by name only) |

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

- **Machine:** the package and client suites (headless, on a stub canvas), the arenas' reads, the quick goal's lever,
  the emit pins, and the contest pages' live probes in Chromium.
- **Eyes:** the operator's. Screenshots were taken while building; nobody has watched a broadcast yet.
