### The children of Sol: Mercury to Pluto on one shelf, seen whole, in a space level's sky, under foot and flown

A game or an exhibit that wants Mars, Saturn or the Moon now gets the real one from one place instead of making it
again. The shelf (`lib/graph/sol/`) has one row per body (Mercury, Venus, the Earth, the Moon, Mars, Jupiter, Saturn,
Uranus, Neptune, Pluto) under the words people say for it, with its real figures (radius, gravity, day, distance, tilt,
air, temperature, the Sun's width in its sky) and a handle into each place that draws it. `solHandles(word, { view })`
hands a game all of them at once. The guide is [docs/sol.md](../../../../docs/sol.md).

- **The body whole** (the ray-traced planet study, `saturn-view`). The Moon and Pluto join the eight (Pluto with its
  heart), and `gallery: 'sol'` steps through every child of Sol in order out from the Sun. The eight's own gallery is unchanged.
  There are two close passes. `scenario: 'close'` runs low over the limb: a giant's bands carry weather drawn out
  east–west, with festoons, eddies and white ovals, and its cloud tops are in relief; a rocky world shows its small
  craters. `scenario: 'rings'` passes through a ringed world's rings, a little above their plane, with the ringlets drawn
  in. The extra detail is behind a uniform that the globe views never set, so their pictures are unchanged. A raymarched
  study's camera may now come closer than three units (`minDistance`); every other study keeps three.
- **The body in a space level's sky** (`skyscape/planet-gen.js`). Each body is a kind of world with its knobs fixed to
  the real one. No hue is turned and the dice never draw it. Its axial tilt is its own (Uranus lies on its side), and
  Saturn's rings are at their real radii. A level names one wherever it names a kind of world: `space.backdrop.worlds`,
  a theatre's moon, a ground stage's `route.world`. A ringed world held near is drawn with its rings live, in its
  equator's plane: the Saturn density profile, the planet's shadow across the rings, the rings hidden behind the globe,
  and the ringlets faded before they alias. Pages without live rings carry none of that code.
- **The body under foot**, for the bodies with ground: a geocube preset each for Mercury, Venus, the Moon, Mars and
  Pluto. Each comes with its palette and a colony's building seeds. The airless ones (Mercury, the Moon, Pluto) are the
  airless plain: craters, a black sky with the stars out by day, and a low hard sun at its own width (huge at Mercury, a
  star at Pluto). The Earth hangs blue and white over the Moon and Charon hangs over Pluto. Mars is rust dunes under a
  butterscotch sky with Phobos in it. Venus is dark basalt under a lid of orange cloud, with no sun seen.
  What hangs in a world's sky is a cube's new `light.heavens` (`era/heavens.js`): `void` (no air, or `false` to give an
  airless card air), `disc` (the sun's width, or `false`), and `companion` (a body in the sky, its colour and the spots
  of land and cloud on its face). The island specimen (`show: 'land'`) now draws an airless card's sky too. A card that
  grows no grass no longer breaks the island.
- **The giants, flown**. Jupiter, Saturn, Uranus and Neptune have no ground, so they get no geocube; they are flown
  over their cloud tops. An airspace's `sky: { world }` (`sol/skies.js`) is the giant's own weather: a deck that closes
  the sky under the pilot, Jupiter's storm towers, Neptune's white cirrus, the haze, and its colours over the deck and
  under it. The ground under the deck is painted as more of the giant's cloud. A craft seated over a giant starts aloft
  above the deck, since there is nothing to take off from. Saturn's rings, and Uranus's faint ones, stand over the
  flight sky as an arch toward the equator, with the planet's shadow across them. A sky with no rings carries none of
  their code.

Not yet: the composer's words (`gameworld/compose.js`) still read "mars" and "lunar" as the generic airless kit rather
than the real body.
