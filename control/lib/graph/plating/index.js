/**
 * PLATING — segment-paneled armour (a powered suit), an ADORNMENT PARADIGM of its own: an undersuit, then a FITTED SHELL
 * per segment (shell.js: the segment faired, then cut into panels along design lines, bevelled, fitted across seams,
 * stacked by layer) by LAYOUTS (layouts.js: pure data, panels in the segment's design coordinates) or where the body's
 * muscles part (muscles.js), grid plates by region (regions.js), servos, a reactor; composed by SUIT cards (styles.js:
 * pure data; `from` its kin, `skin` a colourway, `platesPlus` / `shellsPlus`, a layout of its own or one extended)
 * through passes (expand.js) under laws (principles.js), worn on a body through its adapter (adapters/). The feet and
 * the hands are the footwear and the handwear libraries' cards. Authoring a suit or a layout: docs/plating.md.
 *
 * A BODY ADAPTER:  sides ['R', 'L'];  part(name) the skin's part;  u(kind, share) the station `u` a share along a segment
 *   names;  suit(spec, { id, group }) the body's own undersuit → parts named `<id>_<segment>`;  and, where it has them,
 *   muscle(seg, st, slot) the muscle under a skin point, hidden(seg, st, slot) a point inside another part's skin,
 *   feet(card, { id }) and hands(card, { id, group }) the footwear and the handwear libraries on its feet and hands
 *
 *   wearPlating(adapter, card | word, { id, group }) → { parts, tones, emissive, named }
 *   validatePlating(card | word) → string[]                   the refusals, by name (validatePanel: one panel's)
 */
export { wearPlating, validatePlating, validatePanel, suitCard, shellOf } from './expand.js';
export { SUITS, SKINS, PLATING_TONES } from './styles.js';
export { PLATE_REGIONS, PLATE_SIDES } from './regions.js';
export { LAYOUTS, LAYERS } from './layouts.js';
export { fairShell, shellPanel, stepped } from './shell.js';
export { MUSCLE_GROUPS, muscleLayout, straighten } from './muscles.js';
export { PLATING_LAWS_VERSION } from './principles.js';
