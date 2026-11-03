### Subway elevation

- **An open rail run** (`passageOf({ …, open: true })`, network/passage.js): a rail or tube passage graded straight
  between its two ends, wherever they lie against the ground. Each span is built by where its track lies:
  - a TUNNEL where its ceiling stays under the ground;
  - a CUT where its track is under the ground but its roof would show: retaining walls up past the ground to a capped
    railing, open to the sky, its signals and cables still on its walls;
  - GRADE at the ground, between fences;
  - a VIADUCT over the ground: its deck on girders, parapets inside and out, column pairs on cross-heads every 12 m,
    each held, down to the ground; a deck too low to stand on columns sits on fill.

  Only a tunnel is roofed: its ceiling, soffit, lamps, columns and rings stop at the portal, and a tunnel's end face
  stands only where it ends underground. Its readout `runs` gives the metres of each. Its cover is measured on its full
  tunnel only, and a climb steeper than its section's grade is a finding. Walked from the tunnel up through the cut and
  out along the viaduct, and back. Without `open`, a passage is built as before, byte for byte.
- **Stations by elevation** (`station: { elevation: 'deep' | 'cut' | 'elevated' }`, network/station.js; `ground` its
  street over its track bed when a line lays it). Deep is the default, unchanged byte for byte.
  - A station in a CUT is open to the sky. Its walls are retaining walls that stop at a railing 1.1 m over the street,
    and a canopy in the line's band covers each platform. The canopy stands on its columns' posts, or hangs from the
    wall over a side platform, with a lamp strip under it. An island's mezzanine is a bridge across the cut at street
    level, its way out a gap in the railing. A side platform's way out is a stair up the wall to a landing at the
    street.
  - An ELEVATED station stands on its deck over the street, on paired piers with cross-heads every 12 m. It has
    parapets each side and canopies on steel posts. An island's stair goes down a railed well to a station house hung
    under its mezzanine end. Each way out is a flight down the station's outside to the street, with a landing halfway
    on a long one.
  - An open station's ways out are ports at the street (`street: true`), and its readout gives its elevation and
    street. A stage lays the street round it, open over a cut. Walked along each platform and out to the street, and
    back.
- **A line that rises out of the ground** (`subway.stations[].elevation`, network/subway.js). A station on a line can be
  `cut` or `elevated`. Its track bed is then stood against the street over its middle: a cut's mezzanine at the
  street, an elevated one's station house over it.
  - The gap to the next station is lengthened to what the rail's grade wants for the climb between them; the readout
    gives the `gaps` where they differ.
  - A run out of or into an open station is laid open: tunnel, cut, grade and viaduct where it lies, its `spans` in
    the readout. An open run also says where the ground must open over it (`openings`), and the street is opened over
    each cut, a station's and a run's.
  - An open station's ways out end at the street, so it takes no entrance; a deep station on the same line keeps its
    pavilions. A teleport's stubs out of an open station are laid open too.
  - New cameras: each open station from its street, and the line rising out of the ground.
  - Walked through every run, down the cut's stairs and the el's flights; played as a level from the deep platform
    to the street under the el. A line of deep stations is laid as before, byte for byte.
- **The el in the geocity** (`geocity.subway.elevation: 'elevated'`, or a list with one word a station, `'deep'` or
  `'elevated'`; geocity/subway.js). An elevated station stands over the avenue's carriageway on piers, each pier on the
  road under it where the street falls. Its flights stand out over the kerb (`flightGap`), so each lands on a sidewalk,
  their feet on the street there. Between two elevated stations the line is an el on its viaduct.
  - Where an el meets a deep station, the line dives through a cut in the road (the road opened over it) into its
    tunnel. The city's plan settles the line's spacing with the gaps lengthened to the rail's grade, and hands them to
    the line.
  - Nothing of the street's stands under the el: its lamps, poles, signs and a streetcar's wires are checked along their
    span, and trees by their crowns. An elevated station is no node of the network under the city.
  - New cameras `subway-el` (the el from the far sidewalk) and `subway-rise` (the dive, from over the kerb lane).
  - A station in a cut stays a stage's: a city's sloping street cannot keep a level retaining wall, and a cut is refused
    by name.
  - Walked along the el's platforms, its viaduct's walkway and down each flight to the sidewalk, and back; a line that
    dives from the el to a deep station is played as a level to the street. A deep line under the city is laid as before.
- **A line's track runs on past its ends** (`subway.runOn`, network/subway.js; a geocity's line always, up to 240 m each
  way as its land allows). The first and last stations open their outer ends (portals, the steps down to the
  walkway), and the track runs on out of what is shown:
  - from a deep station, a tunnel into the dark;
  - from an elevated one, an el on its viaduct to a buffer wall at its far end, held (passage.js: an open run's blind
    end).

  The readout's `runOn` gives each run-on's length and spans. A stage's line still ends at its buffers unless asked.
- **Levels and teleport over elevation.** A teleport's stations are joined by no track, so its gaps stay as asked and
  are not lengthened for a climb.
  - Each stub runs out of its station as the station stands: a tunnel out of a deep one, out of a cut one (a box deep
    enough to be a tunnel by its end), and an el out of an elevated one, to a buffer wall.
  - Each warp stands the walker on the next platform at its height: up from a deep stub onto the el, down into the cut.
    Its arrival is shown over the walker's shoulder down the el's platform.
  - Played as a level on the stage and in the geocity, a piece walked between each two warps, and won on the street
    under the el, or on a sidewalk down its flight. The warp up onto the el moves the walker in the page and fires its
    arrival scene (checked in headless Chrome).
