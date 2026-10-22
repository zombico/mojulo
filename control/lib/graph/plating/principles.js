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
//   7. THE BODY DRAWS THE LINES (muscles.js). On a muscled segment the seams fall in the grooves between the muscles (the
//      body's muscle map), a plate per muscle group (the pectoral's heads one plate, each row of the rectus its own, the
//      deltoid's heads a cap), its edges straightened into the stepped lines of law 6; the bone between masses is left to
//      the underplate. Where a segment is bone (the shin's face) or its muscles interleave too finely to cut by (the lower
//      back, the pelvis), a designed layout cuts it instead; a mechanical joint shows its SERVO (a hub at the knee's and the
//      elbow's sides).
//   8. GROUPS ARE ROLES (Plate, Trim, Alloy, Suit, Reactor, Light), so a COLOURWAY recolours any suit; every plate rides the rig by
//      the weights of the suit under it.
//   9. A LAYOUT IS DATA. A panel is { id, seg, layer, t, left, right } in the segment's design coordinates (or a `circle`
//      sized in metres), so a layout (layouts.js) is a list of them, and a card may cut its own (`shells: [{ name,
//      panels }]`), take a named one and drop panels from it or add to it (`{ layout, drop, plus }`), lay one on some of
//      its segments (`on`), stand it farther off (`bulk`), or add shells to its kin's (`shellsPlus`). Every one is
//      checked by name before it is cut.
//  10. THE EXTREMITIES ARE THEIR OWN LIBRARIES' CARDS. The feet a footwear card (its sole, its toe cap), the hands a
//      handwear card (the glove the gauntlet's plates are laid on), so a suit composes with any shoe and any glove, and
//      a plate on a finger curls with it (each plate takes its surface's weights, by point or by ring).
//  11. THE CANON IS THE OUTFIT'S. A suit has no canon of its own: it is read in the one the outfit is designed to, by the
//      dressed outline (dress-outline.js: western | anime, docs/garment-principles.md): the shoulder line's band (armour
//      at 0.15 and past), and in anime/game the plates standing out past the body counted among the one to three flair
//      pieces, the rest of the body line close.
export const PLATING_LAWS_VERSION = 1;
