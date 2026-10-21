// footwear/principles — the laws a footwear card obeys, read by expand.js's passes.
//
//   1. THREE LAYERS, IN ORDER. The SOCK (the protosock: the close outer layer of the shoe, in the visual realm its bottom
//      colour), the SOLE under it, then the ADORNMENT the solver lays over both. A look is a composition of the three,
//      never a new mesh: "adventurer boots" is a thicker sock, a deep sole and the ankle dressed.
//   2. THE SOCK HAS A HEIGHT AND A THICKNESS. A shoe from a collar below the ankle, a boot up the shank as a shaft; none
//      at all for a sandal (the sole and the straps on the bare foot). Thicker leather stands farther off the foot.
//   3. THE SOLE MAKES THE STANCE. Its thickness, its welt (how far it stands out of the footprint), and later its heel's
//      structure; split at the toe base so it bends with the toes.
//   4. PLACES ARE SHARES OF THE FOOT, NOT CENTIMETRES. A strap at 0.6 of the foot, a cuff at the sock's collar, a toe cap
//      from the toe base to the toe tip (the rig's joints): so a card reads on any body's foot (each body's adapter turns a share into its
//      own rings).
//   5. AN ADORNMENT IS A PRIMITIVE IN ITS OWN GROUP. A steel toe is a quarter egg over the toes, toe base to tip (the half
//      teacup), in Steel, rivets along its back edge; gilding a thin band in Gilt; a cuff a turned band at the collar.
//      Each takes the weights of the layer under it, so it moves as that does.
//   6. CUT AS A COBBLER CUTS. The upper is pattern pieces (cobbler.js): the tongue down the instep under the lacing, the
//      eyestays either side of it, the vamp over the forefoot, the quarters at the sides, the counter round the heel, the
//      foxing along the sole. A piece with two sides comes as a MATCHING PAIR, lateral and medial; laces cross between the
//      eyestays over the tongue. A sneaker reads as one by its cut, not by its colour.
//   7. A VARIETY IS ITS KIN AND A FEW KEYS. A card extends another (`from`): the high-top is the court shoe over the ankle,
//      the brogue the oxford perforated. The pieces stay in their groups by ROLE (Overlay, Counter, Eyestay, Midsole …),
//      so a COLOURWAY (`skin`) recolours any card, and every piece rides the rig by the weights of the layer under it.
//   8. A CARD'S TONES ARE SUGGESTIONS. The ones it (or its skin) names stand over a palette's defaults; the operator's own
//      palette over all.
export const FOOTWEAR_LAWS_VERSION = 1;
