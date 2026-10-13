/**
 * THE EGOCUBE'S CHANNELS: where a design note lands. Every channel is BORN (what a character is given) or LIVED (what
 * their life does with it); the composer merges notes per channel, so the facets make one face, not six lists.
 * Design: docs/egocube.md.
 *
 * DIALS is the register a note's `derives` may name: each family is a door word the character loop already reads,
 * with the keys it takes. A derive is a string, a dial and a direction or a word:
 *
 *   'expression.mouthCorner -'   lower it      'axes.confidence +'   raise it
 *   'cast = brute'               set the word  'silhouette = column' (the create-hero catalyst's silhouette words)
 *
 * It names where a note can land, never an amount: the loop decides. A word family names one word a sheet, except a
 * `many` family (the creature loop's detail passes), which may name several. The tests cross-check every key against
 * the live tables (humanoid-head WESTERN_CHANNELS, anime-sculpt, hero-vibe AXES, hero-gesture GESTURE_WORDS, hero-form
 * TUNE_KEYS and HERO_CASTS, figure-cast CAST_PRESETS, humanoid-hair's controls, the creature head library, the
 * creature-from-plan catalyst's pass table).
 */

/** Channel id → { life: born | lived, asks }. In the order a sheet prints them. */
export const CHANNELS = Object.freeze({
  frame:      { life: 'born',  asks: 'build, height, mass, where the weight sits' },
  structure:  { life: 'born',  asks: 'the bones of the face: skull, jaw, cheek, nose, eye set' },
  colouring:  { life: 'born',  asks: 'skin, hair and eyes as given' },
  cover:      { life: 'born',  asks: 'what covers the body when it is not skin alone: scales, fur, feathers, chitin, bone' },
  ornament:   { life: 'born',  asks: 'what grows from it: horns, ears, tusks, claws, antennae' },
  rest:       { life: 'lived', asks: 'the habitual expression set into the neutral face' },
  eyes:       { life: 'lived', asks: 'where the gaze goes, how open, how lit' },
  stance:     { life: 'lived', asks: 'the carriage at rest and ready' },
  silhouette: { life: 'lived', asks: 'the shape at 64 px' },
  dress:      { life: 'lived', asks: 'what they chose to wear and carry, and why' },
  hair:       { life: 'lived', asks: 'how it is kept, or not' },
  palette:    { life: 'lived', asks: 'value, saturation, the accent they chose' },
  wear:       { life: 'lived', asks: 'scars, lines, grey, weathering, repairs' },
});
export const CHANNEL_IDS = Object.freeze(Object.keys(CHANNELS));

/** The lived channels age scales: a youth's life shows in the posture, an elder's in the face. */
export const FACE_OF_LIFE = Object.freeze(['rest', 'eyes', 'wear']);

/** Dial family → its keys (null: a word the door takes). `kind` says how a derive names it: `dir` (+ or -) or `word`. */
export const DIALS = Object.freeze({
  expression: { kind: 'dir', keys: ['browRaise', 'browTilt', 'mouthCorner', 'aperture'], door: 'expression (western head)' },
  sculpt:     { kind: 'dir', keys: ['lidWeight', 'lidCover', 'browThick', 'browGap', 'browAngle', 'catchlight'], door: 'sculpt (anime head)' },
  axes:       { kind: 'dir', keys: ['energy', 'weight', 'poise', 'confidence'], door: 'motion.axes' },
  tune:       { kind: 'dir', keys: ['stature', 'shoulders', 'waist', 'hips', 'legs', 'neck', 'head'], door: 'tune' },
  gesture:    { kind: 'word', keys: ['rest', 'relaxed', 'hand-on-hip', 'guard'], door: 'gesture' },
  cast:       { kind: 'word', keys: ['canonical', 'heroic', 'brute', 'lithe', 'stout', 'child', 'chibi'], door: 'cast (figure preset)' },
  trait:      { kind: 'word', keys: ['soft', 'sharp', 'youthful', 'mature', 'narrow-eyes', 'large-eyes'], door: 'face traits (anime head)' },
  silhouette: { kind: 'word', keys: ['needle', 'bell', 'barrel', 'column'], door: 'the THESIS silhouette word (create-hero)' },
  hair:       { kind: 'dir', keys: ['volume', 'length', 'fringe', 'wave'], door: 'hair controls (landmark head)' },
  face:       { kind: 'dir', keys: ['lower', 'chin', 'chinHeight', 'nose', 'jaw', 'eyeHeight', 'eyeWidth', 'iris', 'faceLength', 'noseSize', 'jawWidth', 'eyeSize', 'browRidge', 'chinProjection'], door: 'face (anime head: lower, chin, nose, jaw, eye…; landmark head: faceLength, noseSize, jawWidth, eyeSize, browRidge…)' },
  palette:    { kind: 'dir', keys: ['Skin', 'Top', 'Bottom', 'Shoes', 'Hair', 'HairHighlight', 'Ink', 'Trim', 'Glove'], door: 'palette (a group; + lighter or more saturated, - darker or muted)' },
  armor:      { kind: 'dir', keys: ['mass', 'coverage', 'ornament'], door: 'armour card dials' },
  outfit:     { kind: 'dir', keys: ['fit', 'coverage', 'ornament', 'stylize'], door: 'outfit card dials' },
  door:       { kind: 'word', keys: ['hero', 'creature'], door: 'create_character as: hero (the hero door) or creature (the creature loop)' },
  head:       { kind: 'word', keys: ['dragon', 'bear', 'wolf'], door: 'a library creature head (creature-heads/index.js HEAD_LIBRARY)' },
  legs:       { kind: 'word', keys: ['plantigrade', 'digitigrade'], door: 'the creature plan\'s legs (THESIS stance)' },
  wings:      { kind: 'word', keys: ['membrane', 'feather'], door: 'the wing patterns (docs/examples/wings)' },
  pass:       { kind: 'word', many: true, keys: ['masses', 'regions', 'ornaments', 'patches', 'correctives', 'hair', 'colour'], door: 'a detail pass of the creature loop (creature-from-plan catalyst)' },
});

const DERIVE = /^([a-z]+)\.([A-Za-z-]+) ([+-])$|^([a-z]+) = ([a-z-]+)$/;

/** Parse a derive string to { family, key, dir? , word? }, or throw naming what is known. */
export function readDerive(text) {
  const m = DERIVE.exec(text);
  if (!m) throw new Error(`egocube: a derive is 'family.key +|-' or 'family = word' (got '${text}')`);
  const [family, key, dir] = m[1] ? [m[1], m[2], m[3]] : [m[4], m[5], null];
  const dial = DIALS[family];
  if (!dial) throw new Error(`egocube: unknown dial family '${family}' (known: ${Object.keys(DIALS).join(', ')})`);
  if ((dial.kind === 'dir') !== (dir != null)) throw new Error(`egocube: '${family}' takes ${dial.kind === 'dir' ? 'a direction' : 'a word'} (got '${text}')`);
  if (!dial.keys.includes(key)) throw new Error(`egocube: unknown ${family} '${key}' (known: ${dial.keys.join(', ')})`);
  return dir ? { family, key, dir } : { family, word: key };
}

/** What a derive claims on a sheet: a dial (a direction), a word family (one word), or a word of a `many` family. */
export function dialKey(r) {
  if (r.dir) return `${r.family}.${r.key}`;
  return DIALS[r.family].many ? `${r.family} = ${r.word}` : r.family;
}
