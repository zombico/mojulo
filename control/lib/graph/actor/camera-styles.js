/**
 * The camera's STYLES: how a scene is covered, as a director of photography and an editor would say it, a card each.
 * The coverage (coverage.js) cuts a scene the same way under every style (on the lines, the crosses, the turns); a card
 * says what each of those cuts is SHOT as, and how long a framing holds before the next cut is let in:
 *
 *   establish   the scene's opening: `wide` on everyone, or `none` (straight in on the first speaker)
 *   dialogue    a line: `over` the listener's shoulder, a clean `single` on the speaker, or the `two` held
 *   turn        a line with a face of its own (a parenthetical): a `close` single, a `push` in on the speaker, or the
 *               `same` as any line
 *   cross       someone moving: back to the `wide`, `follow` the mover in a single, or `hold` the framing (no cut)
 *   sizes       the sizes (shoot/frame.js SIZES): `single`, `close`, `follow`, `two` (the pair as one figure), `push` [from, to]
 *   lens        focal lengths (mm) by setup: `wide`, `over`, `two`, `single`, `close`
 *   angle       the singles' tilt (shoot/framing.js ANGLES or degrees); `rise` the wide's height over its look point (m)
 *   side        how far round from the speaker's front a single stands (degrees: 40 a three-quarter, 0 frontal)
 *   line        whether every camera keeps to the scene's side of the line (the 180° rule)
 *   place       a single's subject across the frame: `lead` (room ahead of its look) or `centre`
 *   least       the least seconds a framing holds: a cut sooner waits until it has, and is let go if the next comes
 *               first (the cutting's pace)
 *   react       a line longer than this (s) is broken by a cut to its listener's reaction, a beat past its middle
 *   oner        one camera all scene, gliding from framing to framing instead of cutting (`glide` seconds to arrive)
 *   shake       the camera's shake (shoot/shake.js) and its `amount`
 *   grain       the picture on twos or threes (shoot/time.js), unless the forge says
 *   quiet       the director's notes (notes.js) the style answers by design: a long take is a oner's point
 *
 * `classical` is the coverage with no style: the same cameras byte for byte. A new style is a card. Pure data.
 */
export const CAMERA_STYLES = Object.freeze([
  { id: 'classical', says: 'continuity coverage: establish wide, over the shoulder for dialogue, close for the turn, wide for a move; one side of the line', after: 'the studio continuity system',
    establish: 'wide', dialogue: 'over', turn: 'close', cross: 'wide', least: 1.2, line: true, quiet: [] },
  { id: 'verite', says: 'handheld and close: no establishing wide, singles on a long lens found as the lines come, the mover followed, the camera breathing', after: 'direct cinema and the documentary drama',
    establish: 'none', dialogue: 'single', turn: 'same', cross: 'follow', sizes: { single: 'mcu', follow: 'ms' }, lens: { single: 75, close: 75 },
    angle: 'eye', side: 35, line: true, place: 'lead', least: 2.4, shake: 'handheld', amount: 1.2, quiet: ['no-close'] },
  { id: 'planimetric', says: 'flat and frontal: the wide square to the action, each speaker centred and facing the lens, a short lens, nothing moving', after: 'the tableau and the symmetrical comedy',
    establish: 'wide', dialogue: 'single', turn: 'close', cross: 'wide', sizes: { single: 'ms', close: 'mcu' }, lens: { wide: 24, single: 28, close: 35 },
    angle: 'eye', side: 0, line: false, place: 'centre', least: 1.2, quiet: ['line-flips'] },
  { id: 'still', says: 'low and patient: the camera below the eyes and level, speakers nearly into the lens, long holds, no moves', after: 'the domestic drama shot from the floor',
    establish: 'wide', dialogue: 'single', turn: 'same', cross: 'wide', sizes: { single: 'mcu' }, lens: { wide: 40, single: 50 },
    angle: -6, rise: -0.5, side: 12, line: false, place: 'centre', least: 3.2, quiet: ['long-take', 'line-flips', 'no-close'] },
  { id: 'oner', says: 'one camera, no cuts: it glides from the room to whoever speaks and back out for a move, on a stabilised rig', after: 'the long take',
    establish: 'wide', dialogue: 'single', turn: 'close', cross: 'wide', sizes: { single: 'ms', close: 'mcu' }, lens: { wide: 28, single: 35, close: 35 },
    angle: 'eye', side: 35, line: true, place: 'lead', least: 1.2, oner: true, glide: 1.2, shake: 'steadicam', amount: 1, quiet: ['long-take', 'no-close'] },
  { id: 'kinetic', says: 'fast and low: quick cuts, tight singles from below, a short lens on the wide, a push on the turn, the mover chased, the camera running', after: 'the action picture',
    establish: 'wide', dialogue: 'single', turn: 'push', cross: 'follow', sizes: { single: 'mcu', follow: 'mls', push: ['mcu', 'cu'] }, lens: { wide: 20, single: 50, close: 50 },
    angle: 'low', side: 40, line: true, place: 'lead', least: 0.7, react: 1.4, shake: 'run', amount: 0.6, quiet: [] },
  { id: 'observational', says: 'from across the room on a long lens: the two held wide and loose, few cuts, a light hand on the camera', after: 'surveillance and the fly on the wall',
    establish: 'wide', dialogue: 'two', turn: 'same', cross: 'hold', sizes: { two: 'fs' }, lens: { wide: 85, two: 85, single: 135 },
    angle: 'eye', line: true, least: 3.5, shake: 'handheld', amount: 0.5, quiet: ['no-close', 'long-take'] },
]);
const WORDS = { continuity: 'classical', hollywood: 'classical', standard: 'classical', handheld: 'verite', 'hand-held': 'verite', documentary: 'verite', 'vérité': 'verite', symmetrical: 'planimetric', symmetric: 'planimetric', frontal: 'planimetric', tableau: 'planimetric', flat: 'planimetric', low: 'still', patient: 'still', tatami: 'still', 'long-take': 'oner', 'one-take': 'oner', 'single-take': 'oner', steadicam: 'oner', action: 'kinetic', fast: 'kinetic', frantic: 'kinetic', surveillance: 'observational', 'fly-on-the-wall': 'observational', distant: 'observational', voyeur: 'observational' };

/** a style by its id or a word it is said by; null if none */
export function cameraStyleOf(word) {
  if (word == null) return null;
  const s = String(word).trim().toLowerCase().replace(/[\s_]+/g, '-');
  return CAMERA_STYLES.find((c) => c.id === s) || CAMERA_STYLES.find((c) => c.id === WORDS[s]) || null;
}

/** error lines for a screenplay's or a film's `camera` (empty = valid) */
export function cameraStyleErrors(v, at = 'camera') {
  if (v === undefined) return [];
  return cameraStyleOf(v) ? [] : [`${at}: a camera style, ${CAMERA_STYLES.map((c) => c.id).join(' | ')} (or a word for one: handheld, symmetrical, long take, action …)`];
}
