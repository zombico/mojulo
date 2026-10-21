// plating/principles — the laws a plated suit obeys (segment-paneled armour, a powered suit's), read by expand.js.
//
//   1. TWO LAYERS. The SUIT (a close undersuit over the trunk and the limbs: the colour the panel lines show) and the
//      PLATES over it. A suit is a composition of plates, never a sculpted shell.
//   2. A PLATE IS A REGION OF ONE SEGMENT, cut from the skin's own grid in its own coordinates (along the segment, round
//      from its front line, on the lateral or the medial side, the left or the right), standing off by its `lift` (bulk
//      is standoff). It never crosses a joint: a cap over a joint is a plate of its own.
//   3. PANEL LINES ARE GAPS. A region split into `rows` leaves bands of suit between them; a pair leaves the centre line.
//      The gaps are the design: the same plates read as a different suit by where they part.
//   4. MATCHED PAIRS. A region with two sides comes as a pair (left and right on the trunk, lateral and medial on a limb),
//      and a limb's plates on both limbs.
//   5. THE GLOW SPENDS ON THE FOCAL. The reactor on the sternum (and what a card names) in groups rendered full-bright.
//   6. A FITTED SHELL IS CUT, NOT GRIDDED (shell.js, layouts.js: a supercar's body, a jet's skin). The segment is first
//      faired into one smooth shell (its grooves bridged, never a muscle's bump), then cut along DESIGN LINES (diagonals
//      sweeping down and forward, chevrons narrowing down the front) into panels that FIT their neighbours across a narrow
//      seam, each BEVELLED down into it; panels STACK by layer (an underplate, a trim, the overplate, a cap over a joint),
//      so an overplate's window shows the metal beneath. Caps dome over the joints they guard.
//   7. GROUPS ARE ROLES (Plate, Trim, Alloy, Suit, Reactor, Light), so a COLOURWAY recolours any suit; every plate rides the rig by
//      the weights of the suit under it.
export const PLATING_LAWS_VERSION = 1;
