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
