/**
 * PLATING — segment-paneled armour (a powered suit): an undersuit and PLATES cut from the body's segments as regions in
 * their own coordinates (regions.js), parted by panel lines (their gaps), in matched pairs, a reactor glowing on the
 * sternum; composed by SUIT cards (styles.js: pure data) through passes (expand.js) under laws (principles.js), worn on a
 * body through its adapter (adapters/). The footwear library's cut (footwear/cobbler.js) carried to the whole body.
 *
 * A BODY ADAPTER:  sides ['R', 'L'];  part(name) the skin's part;  u(kind, share) the station `u` a share along a segment
 *   names;  suit(spec, { id, group }) the body's own undersuit → parts named `<id>_<segment>`
 *
 *   wearPlating(adapter, card | word, { id, group }) → { parts, tones, emissive, named }
 *   validatePlating(card | word) → string[]                   the refusals, by name
 */
export { wearPlating, validatePlating, suitCard } from './expand.js';
export { SUITS, SKINS, PLATING_TONES } from './styles.js';
export { PLATE_REGIONS, PLATE_SIDES } from './regions.js';
export { PLATING_LAWS_VERSION } from './principles.js';
