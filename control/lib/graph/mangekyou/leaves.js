/**
 * THE GENERAL READING — what in a recipe can be seen to vary, whatever its kind. A mangekyou never asks a kind what its
 * dials are: it walks the recipe's leaves and reads each by its value and the key it sits under. A leaf is on an AXIS
 * (what a designer varies) or it is left alone; ids, kinds, refs, positions, timings and gameplay numbers are never
 * on one.
 *
 *   readLeaves(manifest, { within?, lock?, vocab? }) → [{ path, axis, form, value, key, words? }]
 *     form: 'hex' (a colour), 'unit' (a 0..1 amount), 'pos' (a positive quantity), 'deg' (a hue angle),
 *           'word' (a word from a vocabulary the team gave), 'roll' (a procedural seed)
 *
 * Pure. `within` narrows to the leaves under some JSON Pointers (default the whole recipe); `lock` is pointers never
 * read; `vocab` the team's words ({ id, axis, keys, words, ordered }), a word read only under a key its row names.
 */

export const AXES = Object.freeze(['colour', 'size', 'silhouette', 'surface', 'detail', 'roll']);

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
// never on an axis: what names, places, times or plays a thing (a rank or an hp is the game's, not the look's)
const NEVER = /^(element|elements|id|ids|ref|refs|kind|kinds|type|version|v|name|title|label|url|src|href|path|locale|class|rank|role|skill|mode|state|status|x|y|z|pos|position|at|origin|rot|rotation|yaw|pitch|roll|quat|matrix|t|time|duration|delay|fps|frame|frames|index|count|n|lod|res|resolution|hp|downs|threat|damage|dps|speed|range|cooldown|ammo|cost|price|level|order|priority|weight|chance|odds|layer|z-index|from|to|by|of|for)$/i;
// each regex is read against the key's words (camelCase, snake_case and kebab-case split), anchored at a word's start
const SIZE = /^(scale|size|height|width|length|depth|radius|girth|bulk|span|thick|diameter|tall|presence|stature)/i;
const SILHOUETTE = /^(stretch|taper|flare|curv|bend|lean|spread|ratio|proportion|horn|tail|wing|crest|spike|neck|limb|head$|hump|arch$|slope|tilt|splay|bulge|waist|shoulder|hip|jaw|brow|silhouette|outline|fit$|coverage|hem$|brim|blade|barrel|stock$|crown|lobe|petal|leaf|leaves|branch|trunk|canopy|mane|ear|snout|muzzle|beak|claw|fin$|tusk|antler|plume|frill|ridge)/i;
const SURFACE = /^(rough|metal|gloss|sheen|wear|grit|grime|dirt|rust|patina|grain|noise|pattern|coat|fur$|texture|finish|material|skin|camo|livery|colourway|colorway|ooze|shading|matte|polish|emissive|glow|opacity|weather|age$|moss|crack|chip)/i;
const DETAIL = /^(detail|ornament|stylize|stylise|ornate|density|complex|register|focal|motif|adorn|trim|accent|decor)/i;
const COLOUR = /^(hue|chroma|saturation|lightness|tint|tone|warm|heat|colour|color|paint|palette)/i;
const SEEDED = /^(seed|seeds|dice)$/i;
// never descended into: the frame a thing is drawn in (its canvas, its camera, its page, its layout), not the thing
const FRAMES = /^(viewBox|viewport|canvas|camera|cameras|cam|shot|shots|shotContract|spatialPlan|screen|page|grid|cell|cells|bounds|bbox|margin|margins|padding|layout|export|exports|meta|provenance|history|review|made|book|audit)$/i;
const words = (key) => String(key).split(/(?=[A-Z])|[_\-\s.]+/).filter(Boolean).map((w) => w.toLowerCase());
const reads = (re, key) => words(key).some((w) => re.test(w));

const esc = (k) => String(k).replace(/~/g, '~0').replace(/\//g, '~1');
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const under = (path, root) => root === '' || path === root || path.startsWith(`${root}/`);

/** The value at a JSON Pointer, or undefined. */
export function valueAt(doc, pointer) {
  if (pointer === '') return doc;
  let node = doc;
  for (const raw of pointer.slice(1).split('/')) {
    const seg = raw.replace(/~1/g, '/').replace(/~0/g, '~');
    if (node === null || typeof node !== 'object') return undefined;
    node = node[Array.isArray(node) ? Number(seg) : seg];
  }
  return node;
}

/** Which axis a key reads as, for a number under it (null: not a visual number). */
function numericAxis(key) {
  if (reads(SIZE, key)) return 'size';
  if (reads(SILHOUETTE, key)) return 'silhouette';
  if (reads(DETAIL, key)) return 'detail';
  if (reads(SURFACE, key)) return 'surface';
  if (reads(COLOUR, key)) return 'colour';
  return null;
}

/** The vocabulary a word belongs to, if the team gave one that holds it. */
function vocabOf(word, key, vocab) {
  for (const v of vocab) if (key && v.keys.test(key) && v.words.includes(word)) return v;
  return null;
}

function readNumber(value, key, axis) {
  if (!Number.isFinite(value) || value === 0) return null; // a zero is usually "off": turning it on is a new thing, not a variant
  if (axis === 'colour' && reads(/^hue/, key) && value >= 0 && value <= 360) return 'deg';
  if (value > 0 && value <= 1 && axis !== 'size') return 'unit';
  if (value > 0) return 'pos';
  return null; // a negative is an offset with a sign that means something: left alone
}

export function readLeaves(manifest, { within = [''], lock = [], vocab = [] } = {}) {
  const out = [];
  const locked = (p) => lock.some((l) => under(p, l));
  // `key` is the nearest object key above the leaf (an array's elements read as their array's key)
  const walk = (node, path, key) => {
    if (locked(path)) return;
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${path}/${i}`, key)); return; }
    if (isObj(node)) { for (const [k, v] of Object.entries(node)) if (!FRAMES.test(k)) walk(v, `${path}/${esc(k)}`, k); return; }
    if (!within.some((w) => under(path, w))) return;
    if (typeof node === 'string') {
      if (HEX.test(node)) { out.push({ path, axis: 'colour', form: 'hex', value: node, key }); return; }
      if (key && NEVER.test(key)) return;
      const v = vocabOf(node, key, vocab);
      if (v) out.push({ path, axis: v.axis, form: 'word', value: node, key, words: v.words, ordered: !!v.ordered, vocab: v.id });
      return;
    }
    if (typeof node === 'number') {
      if (key && SEEDED.test(key) && Number.isInteger(node)) { out.push({ path, axis: 'roll', form: 'roll', value: node, key }); return; }
      if (!key || NEVER.test(key)) return;
      const axis = numericAxis(key);
      if (!axis) return;
      const form = readNumber(node, key, axis);
      if (form) out.push({ path, axis, form, value: node, key, int: Number.isInteger(node) && form === 'pos' });
    }
  };
  walk(manifest, '', null);
  // an INTEGER SCALE: a key that holds a whole number above 1 anywhere in the design (an ornament 0..3) holds steps
  // everywhere, so its 1 is a step on that scale and never a 0..1 amount
  const steps = new Set(out.filter((l) => typeof l.value === 'number' && Number.isInteger(l.value) && l.value > 1 && l.form === 'pos').map((l) => l.key));
  for (const l of out) if (l.form === 'unit' && Number.isInteger(l.value) && steps.has(l.key)) { l.form = 'pos'; l.int = true; }
  return out;
}

/** How many leaves each axis holds (what a concept can reach on this design). */
export function axisCounts(leaves) {
  const c = Object.fromEntries(AXES.map((a) => [a, 0]));
  for (const l of leaves) c[l.axis] += 1;
  return c;
}
