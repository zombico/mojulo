/**
 * HANDWEAR — a solver library: handwear in two layers (the GLOVE, the protoglove, the hand's own close leather; the
 * ADORNMENT the solver lays over it: a glover's pieces (cutter.js) and primitives, in the hand's design coordinates), composed by a CARD (styles.js: pure data, a new look is a card, annotated with its
 * family; a card extends another by `from`, and wears any colourway by `skin`) through passes (expand.js) under laws
 * (principles.js), worn on any body through its HAND ADAPTER (adapters/). The footwear library's sibling: the same card,
 * the same passes, the same laws, on the hand.
 *
 * A HAND ADAPTER is a body's hand as handwear reads it:
 *   sides                       ['R', 'L']
 *   seg(kind, S)                the part named for `kind` ('hand' | 'thumb' | 'index' | 'middle' | 'ring' | 'little' |
 *                               'foreArm') on side `S` (null if the body has none): rings, `front` the back of the hand
 *                               (a digit's nail side), the R slots the thumb's side on either hand
 *   joints(S)                   { wrist, knuckles, thumbCmc … thumbTip, indexMcp … littleTip }, the rig's
 *   bare(name)                  the skin's part: what the glove stands off, and a bare hand's adornment is worn on
 *   cuff(glove, { id, group })  the body's own close leather up the forearm by the glove's `cuff` share → parts named
 *                               `<id>_<segment>`
 *   gripJoints(S, word)         the hand's joints (as `joints`) with its digits closed by a hand word (null: as it
 *                               rests), at the bind: what a mitten's shell is made round
 *   u(kind, share)              the station `u` a share along a segment names on this body
 *   size()?                     the body's hand length (m; handLength reads it off the adapter): the cards are drawn
 *                               for HAND_REFERENCE's, and worn scaled to this one (`cuff` then takes `k`, the scale, for
 *                               its own close-fit distances)
 *
 *   wearHandwear(adapter, card | word, { id, group }) → { parts, tones, named, grip? }   (expand.js; `grip` the
 *                                                     hand word a mitten closes each hand in, which the body holds
 *                                                     at rest: station-loft-rig.js `holdGrip`)
 *   validateHandwear(card | word) → string[]                                    the refusals, by name
 */
export { wearHandwear, validateHandwear, handwearCard, readTones, ADORN_PRIMS, DIGITS, FINGERS, HANDWEAR_FAMILIES, HAND_REFERENCE, handLength } from './expand.js';
export { GLOVE_REGIONS } from './cutter.js';
export { HANDWEAR_LAWS_VERSION } from './principles.js';
export { HANDWEAR, HANDWEAR_TONES, SKINS } from './styles.js';
