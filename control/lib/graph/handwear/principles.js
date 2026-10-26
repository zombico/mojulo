// handwear/principles — the laws a handwear card obeys, read by expand.js's passes. The footwear library's laws carried
// to the hand.
//
//   1. TWO LAYERS, IN ORDER. The GLOVE (the protoglove: the hand's own close leather, in the visual realm its bottom
//      colour), then the ADORNMENT the solver lays over it. A look is a composition of the two, never a new mesh: a
//      rider's glove is a glove, a palm, a knuckle guard and a strap.
//   2. THE GLOVE HAS A CUFF, A THICKNESS AND A REACH. Its cuff a share up the forearm (none: at the wrist; the whole:
//      an opera glove's, to the elbow); thicker leather stands farther off the hand; its fingers whole, cut at the
//      middle joint (fingerless), or at the knuckle (a mitt's), each digit's end closed inside the finger so it reads
//      open. None at all: the adornment on the bare hand (hand wraps, claws, rings).
//   3. PLACES ARE THE HAND'S OWN COORDINATES, NOT CENTIMETRES. A piece lies in the segment's design coordinates (the
//      plating library's fitted shell: along it from the wrist or the palm, round it from the back of the hand, the
//      thumb's side +, the palm ±1), so a card reads on any body's hand and on both hands alike.
//   4. CUT AS A GLOVER CUTS (cutter.js). The back, the palm and its heel, the knuckles, the fingers' backs and pads, the
//      thumb: pattern pieces laid over the glove, each a thin bevelled slab in its own group.
//   5. AN ADORNMENT IS A PRIMITIVE IN ITS OWN GROUP. The points stitched down a dress glove's back, a cuff, a strap with
//      its snap or buckle, a flared gauntlet cuff, a hard knuckle guard, studs, a knight's lames, rings and stones,
//      claws, fur, a fighter's wraps. Each takes the weights of the surface under it (by point or by ring), so it bends
//      with the finger it is on; a claw rides its last phalanx.
//   6. A VARIETY IS ITS KIN AND A FEW KEYS. A card extends another (`from`); the pieces stay in their groups by ROLE
//      (Overlay, Cuff, Strap, Guard, Pad …) and a piece's tone may be OF the leather's (darker or lighter), so a
//      COLOURWAY (`skin`) recolours any card.
//   7. A CARD'S TONES ARE SUGGESTIONS. The ones it (or its skin) names stand over a palette's defaults; the operator's own
//      palette over all.
//   8. THE CANON IS THE OUTFIT'S. A glove has no canon of its own: it is read in the one the outfit is designed to, by the
//      dressed outline (dress-outline.js: western | anime, docs/garment-principles.md). In anime/game a gauntlet's flared
//      cuff standing out past the forearm is one of the one to three flair pieces, the rest of the arm close; western, a
//      glove the hand's own size.
export const HANDWEAR_LAWS_VERSION = 1;
