### The metro's highways: expressways on piers over its arterials and its shore, driven by its traffic

- **Highways join the far neighbourhoods.** A metro now runs its expressways (`geocity/highways.js`, a new metro
  setting `highways`: `count`, `lanes` each way, `height`, `along`; `false` none). They are elevated on piers, so they
  cross the street grid without touching it. By default it runs four, after a lake city's:
  - a **lakeshore expressway** along its shore over the water's edge, on single piers in the water;
  - a **crosstown** over the arterial farthest from the shore, out to the country at both ends;
  - two **cross highways** over its outermost arterials the other way. Each flies over the crosstown where they meet,
    risen clear of its deck, and joins the shore's deck at its level where it reaches it.

  `along` names their lines (an arterial's id, or `'shore'`). Without a shore, the metro's long way takes the crosstown's
  part.
- **The deck.** Three lanes each way between shoulders and a median by default. Its deck follows the ground smoothed
  along it, its height over it, held to 4.5% between its stations both ways. It is drawn as asphalt over concrete fascia
  and underside, with a barrier at each edge and down its median, lane lines and shoulder lines, and lamps down its
  median. Its piers are a pair of columns in its arterial's kerb lanes (clear since the kerbs carry no parked cars)
  under a cap beam, never in a crossing; a column is a walker's collider.
- **Under it.** The street's lamps, its wooden poles and their wires and its trees are taken out where a deck is lower
  than they are. Signals, signs and the streetcars' overhead stand under its underside.
- **Driven.** Each highway's lanes join the metro's traffic (`geocity/flow.js`): each way on its own side of the median
  by the metro's hand, faster than the streets (24 m/s), through no signal, on the deck's own height. The page steps and
  draws them near the camera like the rest.
- **Laws and readout.** Two laws: `highway-grade` (no steeper than 4.5%) and `highway-clear` (5.2 m under every deck
  over the land and under every flyover). The readout carries `highways`: each one's role, line, length, lanes, the deck
  it joins and the one it flies over.
