/**
 * hand-shape-words — the WORDS the hand shapes answer to (hero-digits.js HAND_SHAPES), with no imports, so the door's
 * checks (hero-gesture.js) can name them without loading the hand solver (whose imports reach back to the door through
 * the gear and the world). hero-digits.js's shapes and these words are held equal by its test.
 *   aliases  each shape's name and its plain aliases
 *   poles    the shapes named for the hand words (station-loft-rig.js HAND_POSES): at the door those words keep the
 *            meaning every hero minted before was made with; the shapes are reached in code, the solved grip as `haft`
 */
export const HAND_SHAPE_ALIASES = Object.freeze({
  craneBeak: Object.freeze(['beak']), tigerClaw: Object.freeze(['claw']), swordFingers: Object.freeze(['sword']), leopardFist: Object.freeze(['leopard']),
  phoenixEye: Object.freeze(['phoenix']), verticalPalm: Object.freeze(['palm', 'flat']), pinch: Object.freeze([]), ok: Object.freeze(['okay']),
  fist: Object.freeze([]), grip: Object.freeze(['haft']), point: Object.freeze([]),
});
export const HAND_SHAPE_POLES = Object.freeze(['fist', 'grip', 'point']);
/** every word a hand shape answers to AT THE DOOR: its name and its aliases, but the hand words */
export const HAND_SHAPE_WORDS = Object.freeze(Object.entries(HAND_SHAPE_ALIASES).flatMap(([k, a]) => [k, ...a]).filter((w) => !HAND_SHAPE_POLES.includes(w)));
