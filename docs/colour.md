# The game's colour

How a game is coloured as a whole, and how that is decided. The colour theorist
(`control/lib/graph/color-theorist/`) solves a palette for a **world**: its land, its sky, its light. Who walks that
world was coloured elsewhere (a lineage's own skin, a pack's cloth, a hero's shirt off the grass ramp), so a green
people could sink into a green meadow and nothing said so. This is the bridge between the two, and the aid that makes
the choice repeatable from one game to the next.

## Figures on a ground

`color-theorist/figures.js`. The world's palette is the ground the cast are figures on, as it is the road a race's
cars are figures on (`livery.js`). A figure is measured by its OKLab distance from what it stands on (the ground) and
what is behind it (the foliage); under `FIGURE_MIN` it sinks. Solved, a figure is moved until it clears the land and
the figures placed before it, by every eye (the distances are held under protan, deutan and tritan simulation too).

A figure says how much of it may move:

| `keep` | what moves | for |
|---|---|---|
| `colour` | nothing: it is measured only | a hero already dressed, a colour the creator wrote |
| `hue` | its value and chroma, inside its own hue family (`HUE_KEEP` degrees) | a creature: a goblin stays green |
| `free` | anything | a cloth with no colour of its own |

Of the candidates that clear, the one nearest the colour it had is taken, and the hue turns last: lighter or richer a
creature is still itself. A figure may instead name what it wears: the palette's `accent` (the protagonist's), its
`accent2` (the mark of those against it), or `against`, the protagonist's complement, which a second accent falls
back to where the two accents are neighbours and a mark in it would read as the protagonist's own colour. The laws
(`FIGURE_LAWS`) measure and advise; none refuses.

## Colour directions

`color-theorist/directions.js`. A direction is a move on a palette's spec that an art director would name in a
sentence, kept as a row so the same choices are offered to every game. It never picks a hue: the palette's character
stays the world's own; a direction says where the value and the chroma are spent (a quiet land that leaves colour to
the figures; a script that travels across the levels). A new direction is a row.

One direction names hues, and they are not a pick: `kit-card` gives the land back to its kit's card
(`cardPaletteSpec`: the card's character in the theorist's terms, a row in `CARD_CHARACTER`, and each role locked to
the card's own middle stop, read from the card's swatches). Solved, it is the card; shifted, it is the card somewhere
else. It is offered only where the world's kit has a row.

## Each place its own light

A world's palette is home's. Every other place is that palette MOVED (a `shift`: its values, chroma and warmth moved,
its seed and hue relations kept), so a map reads as one world and each place as itself. On a world map each block may
carry one as its region's word, `palette: { shift }` (`gameworld/world-map.js` `PLACE_LIGHT`: a row a place, said in
a sentence), and the grid scene paints that block's tiles in the level's cube moved by it. The cast is seen on every
place's land (`colour.js` `landsOf`), so a figure painted clear is clear everywhere it will stand.

## A game, read into those terms

`gameworld/world-palette.js` reads the world: the palette spec it is solved from, its accent, and what a figure on
foot is seen against (the solved palette's roles; a world with no palette, its kit card's own ramps).
`gameworld/colour.js` reads the cast (`FIGURE_READERS`, a row per kind of figure): the hero in its garment, a kin foe's
skin, a pack's mark. What it cannot read yet (a crew's dress, a beast's coat) is said `unread`, never guessed.

- `colourOfGame(G)`: the game as it is, measured: each figure's clearance, the laws, who sinks.
- `colourOptions(world)`: the ways it could go. `cast`: the same land, the cast painted clear of it. Then one option
  per direction the world can take, its land moved and the cast solved against the land that makes. Each option is a
  patch (`design_game({ ref, patch })`), with its figures, its laws and the palette laws it leaves advising, and the
  machine names its pick: the first under which every figure law holds, the fewest palette laws advising.
- `colourBookHtml(world)`: the colour book, `/api/sketches/<ref>/bible?book=colour`. Every option painted into the
  same small landscape with the cast standing on its ground, so the only thing that differs between two rows is the
  colour. The machine half is on the page; which row reads as the game is the eyes gate's.

`design_game`'s readout says when a figure sinks (a `colour` step, with the book's address); the agent's card is
`gameworld-colour`.

## What the sentence door does

A world laid from a sentence is coloured once, when it is stored:

- its hero, where the door designs one, wears the world's accent (`gameworld/hero-design.js`);
- its cast is painted against its ground (`paintedCast`): a kin's coat written as `foes.<id>.skin.body.coat`, a pack's
  mark as `skin.pack.accent`, and what moved kept in `brief.colour.cast`;
- a genre with a direction chosen for it is laid in that direction (`GENRE_COLOUR`, a row per decision made at the
  eyes gate; the direction's axes are written into the cube's palette words).

Every one of these is recipe data the creator can rewrite. An existing world is untouched until an option is taken.

## Adding to it

- A new kind of figure (a crew's uniform, a beast's coat, a quick game's rolled people, a vehicle): a reader in
  `FIGURE_READERS` that answers `{ id, hex | wear, keep, at, field }`, where `at` and `field` say where its colour is
  written, so the options' patches reach it.
- A new direction: a row in `COLOUR_DIRECTIONS`.
- A decision for a genre: a row in `GENRE_COLOUR`.
- A kit whose card can be a palette: a row in `CARD_CHARACTER`. A place's light: a row in `PLACE_LIGHT`.
