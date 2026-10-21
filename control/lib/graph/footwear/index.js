/**
 * FOOTWEAR — a solver library: footwear in three layers (the SOCK, the protosock, the shoe's close outer layer and its
 * bottom colour; the SOLE; the ADORNMENT the solver lays over them), composed by a CARD (styles.js: pure data, a new look
 * is a card, annotated with its family: shoe, boot, sandal, sneaker, dress;
 * a card extends another by `from`, and wears any colourway by `skin`) through passes (expand.js) under laws (principles.js), worn on any body through its FOOT ADAPTER
 * (adapters/), so every character tool's feet take the same shoes.
 *
 * A FOOT ADAPTER is a body's foot as footwear reads it:
 *   sides                       ['R', 'L']
 *   seg(kind, S)                the part named for `kind` ('foot' | 'toes' | 'shank') on side `S` (null if the body has none)
 *   joints(S)                   { ankle, toeBase, toeTip }, the rig's (the toe base splits the sole so it bends)
 *   bare(name)                  the skin's part: what a sandal is worn on
 *   upper(sock, { id, group })  the body's own close leather over its foot at the sock's height and thickness → parts
 *                               named `<id>_<segment>`
 *   u(kind, share)              the station `u` a share along a segment names on this body
 *
 *   wearFootwear(adapter, card | word, { id, group }) → { parts, tones }   (expand.js)
 *   validateFootwear(card | word) → string[]                              the refusals, by name
 */
export { wearFootwear, validateFootwear, footwearCard, ADORN_PRIMS, FOOTWEAR_FAMILIES, SOLE_PATTERNS } from './expand.js';
export { FOOTWEAR, FOOTWEAR_TONES, SKINS } from './styles.js';
export { FOOTWEAR_LAWS_VERSION } from './principles.js';
export { COBBLER_REGIONS, REGION_SIDES } from './cobbler.js';
