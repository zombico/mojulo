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
