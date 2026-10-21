/**
 * HANDWEAR — a solver library: handwear in two layers (the GLOVE, the protoglove, the hand's own close leather; the
 * ADORNMENT the solver lays over it), composed by a CARD (styles.js: pure data, a new look is a card, annotated with its
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
 *   u(kind, share)              the station `u` a share along a segment names on this body
 *
 *   wearHandwear(adapter, card | word, { id, group }) → { parts, tones, named }   (expand.js)
 *   validateHandwear(card | word) → string[]                                    the refusals, by name
 */
export { wearHandwear, validateHandwear, handwearCard, readTones, DIGITS, FINGERS, HANDWEAR_FAMILIES } from './expand.js';
export { HANDWEAR, HANDWEAR_TONES, SKINS } from './styles.js';
