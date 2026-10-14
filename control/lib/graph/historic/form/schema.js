/**
 * historic/form/schema — what a town's FORM may say: the principles a historic town is laid out by, as data the solver
 * (../solver/) reads, in metres. A form is a culture's document (./towns.js) or `{ from: '<culture>', …changes }` that
 * rewrites any field of that culture's form (objects merge, lists replace), held to FORM_SCHEMA and refused by name.
 *
 *   frame      the ground each view plans on: the town, the region round it (`slice` crops the region)
 *   site       the lie of the land: flat, a river plain, a bluff (high ground on one side), a hill (terraced toward
 *              its top), a plateau (a high shelf over a valley); where the high ground is and how high
 *   water      none, a canal through the town, a river along a side, the sea on a side; its width, how far it lies
 *              below the town, and which way it `flows` (upstream and downstream are where the crafts go)
 *   armature   what the town is organised round: its MONUMENT at the heart, at the end of an axis from the water, on
 *              the summit above the town, or at the head of a forum square; the approach to it and the precinct round it
 *              (`at`: where the monument (or the square) stands, as fractions of the town, x from the west, y from the north)
 *   enclosure  none, a ring wall round the town (towers, gates), or walled wards
 *   streets    the pattern (a meander from the gates to the heart, a lattice, an orthogonal grid, streets along the
 *              contours), the widths, how far apart the alleys run and how often they jog
 *   density    the lot sizes, the gap between neighbours, how much of the free ground is built
 *   houses     the house assets by size, the largest whose threshold a lot meets
 *   placement  what stands by meaning or need, and where: wells at crossings, kilns under the wall, art at thresholds
 *   hinterland the fields and trees outside the town
 *   activities the work of the land and the crafts, as groups of the culture's farm and works assets, placed by need;
 *              one whose `cites` are not yet in reach at the town's year is left out (the field guide says so)
 *   borrow     cultures whose asset kits stand in where this one has none of its own (a house, a wall): the field guide
 *              says what was borrowed
 *   cites      the ledger rows (`<record>/<id>`) each principle stands on: the field guide shows them
 *
 * Pure: the reader rolls no dice.
 */
export const SIDES = Object.freeze(['n', 's', 'e', 'w']);
export const LANDFORMS = Object.freeze(['flat', 'bluff', 'hill', 'plateau']);
export const WATERS = Object.freeze(['none', 'canal', 'river', 'sea']);
export const ARMATURES = Object.freeze(['heart', 'axis', 'summit', 'forum']);
export const ENCLOSURES = Object.freeze(['none', 'ring', 'wards']);
export const STREET_PATTERNS = Object.freeze(['meander', 'lattice', 'grid', 'contour']);
export const SURFACES = Object.freeze(['mud', 'rubble', 'brick', 'flagstone', 'dry-earth']);
export const TREES = Object.freeze(['palm', 'olive', 'poplar', 'round', 'none']);
/** Where a placed thing stands: each a rule in ../solver/placement.js. */
export const WHERE = Object.freeze({
  crossing: 'where three or four streets meet, spread through the town',
  'main-street': 'on the lots that front a main street (the asset replaces the house)',
  'near-monument': 'on the large lots nearest the precinct (the asset replaces the house)',
  'wall-strip': 'in the open strip inside the wall, on one stretch of it',
  'precinct-gate': 'either side of the precinct gate',
  'monument-front': 'before the monument, on its axis',
  precinct: 'inside the precinct, beside the monument',
  'square-edge': 'round the forum square, facing it',
  approach: 'lining the approach to the monument',
  water: 'afloat on the water',
  bank: 'on the bank of the water, outside the town',
  'water-edge': 'on the water\'s edge inside the town',
  'town-edge': 'just outside the town, round its edge',
});
export const ACTIVITY_WHERE = Object.freeze({ fields: 'among the fields', upstream: 'by the water, upstream of the town', downstream: 'by the water, downstream', outside: 'outside the town, clear of it' });
export const FORM_KEYS = Object.freeze(['label', 'frame', 'site', 'water', 'armature', 'enclosure', 'streets', 'density', 'houses', 'walls', 'placement', 'hinterland', 'activities', 'borrow', 'cites']);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (lo, hi) => (v) => (typeof v === 'number' && v >= lo && v <= hi ? null : `a number ${lo}–${hi}`);
const int = (lo, hi) => (v) => (Number.isInteger(v) && v >= lo && v <= hi ? null : `a whole number ${lo}–${hi}`);
const range = (lo, hi) => (v) => (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number' && x >= lo && x <= hi) && v[0] <= v[1] ? null : `[low, high], ${lo}–${hi}`);
const word = (xs) => (v) => (xs.includes(v) ? null : xs.map((x) => `'${x}'`).join(' | '));
const str = (v) => (typeof v === 'string' && v.length > 0 && v.length <= 160 ? null : 'a short text (at most 160 characters)');
const asset = (v) => (typeof v === 'string' && /^[a-z][a-z0-9-]*$/.test(v) ? null : 'an asset id');
const bool = (v) => (typeof v === 'boolean' ? null : 'true or false');
const prob = num(0, 1);
const pair = (lo, hi) => (v) => (Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number' && x >= lo && x <= hi) ? null : `[a, b], each ${lo}–${hi}`);
const size = pair(0.5, 400);
const listOf = (shape, min = 0) => (v, at) => {
  if (!Array.isArray(v) || v.length < min) return `a list${min ? ` of at least ${min}` : ''}`;
  for (const [i, x] of v.entries()) { const e = check(shape, x, `${at}[${i}]`); if (e) return e; }
  return null;
};
const keysOf = (v) => (Array.isArray(v) && v.every((k) => typeof k === 'string' && /^[a-z]+\/[a-z0-9-]+$/.test(k)) ? null : "a list of ledger keys '<record>/<id>'");

/** Every field a form may write, and what each leaf holds. A leaf marked `?` in the docs above may be left out. */
export const FORM_SCHEMA = Object.freeze({
  label: str,
  frame: { town: pair(80, 1200), region: pair(200, 2400) },
  site: { landform: word(LANDFORMS), high: word(SIDES), relief: num(0, 150), edge: num(0.05, 0.95), terraces: num(0, 20), cliff: bool, rock: num(0, 150), town: word(['high', 'low', 'both']) },
  water: { kind: word(WATERS), side: word(SIDES), width: num(0, 400), sink: num(0, 20), bank: num(0, 40), bridge: asset, flows: word(SIDES) },
  armature: {
    kind: word(ARMATURES), monument: asset, square: pair(10, 300), at: pair(0.05, 0.95),
    approach: { width: num(0, 60), flank: asset, flankDepth: num(1, 20), quay: asset, quaySize: size, way: num(0, 30) },
    precinct: { margin: num(0, 120), back: num(0, 200), wall: asset, gate: asset, thickness: num(0.5, 12), height: num(0, 20), terrace: num(0, 10), floor: word(SURFACES) },
  },
  enclosure: { kind: word(ENCLOSURES), thickness: num(1, 12), towerEvery: num(10, 200), gates: int(0, 8), strip: num(0, 30), ward: pair(30, 300), extent: pair(0.2, 1), market: asset },
  streets: {
    pattern: word(STREET_PATTERNS), main: num(2, 30), alley: num(1, 12), block: pair(6, 120), jog: prob, branches: int(0, 200), crossEvery: num(20, 400), stairs: asset,
    surface: { main: word(SURFACES), alley: word(SURFACES) },
  },
  density: { lot: range(3, 60), gap: num(0, 3), fill: prob },
  houses: listOf({ asset, minSide: num(0, 100), minArea: num(0, 5000), onMain: bool }, 1),
  walls: { run: asset, tower: asset, gate: asset, wardGate: asset },
  placement: listOf({ asset, where: word(Object.keys(WHERE)), max: int(0, 400), every: num(0, 400), size, monument: asset }),
  hinterland: { fields: prob, trees: prob, tree: word(TREES), max: int(0, 2000), band: num(0, 400) },
  activities: listOf({ id: asset, read: str, kit: word(['farm', 'works']), where: word(Object.keys(ACTIVITY_WHERE)), pieces: listOf(asset, 1), cites: keysOf }),
  borrow: listOf(asset),
  cites: (v) => (isObj(v) && Object.entries(v).every(([k, x]) => FORM_KEYS.includes(k) && !keysOf(x)) ? null : `{ <principle>: ['<record>/<id>', …] } for principles ${FORM_KEYS.join(', ')}`),
});

function check(shape, v, at) {
  if (typeof shape === 'function') { const e = shape(v, at); return e ? (e.startsWith(at) ? e : `${at} is ${e}`) : null; }   // a list's own entry speaks for itself
  if (!isObj(v)) return `${at} is { ${Object.keys(shape).join(', ')} }`;
  for (const k of Object.keys(v)) {
    if (!(k in shape)) return `${at}.${k} is not a setting (${at}: ${Object.keys(shape).join(', ')})`;
    if (v[k] === undefined) continue;
    const e = check(shape[k], v[k], `${at}.${k}`);
    if (e) return e;
  }
  return null;
}

const merge = (a, b) => (isObj(a) && isObj(b) ? Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => [k, k in b ? merge(a[k], b[k]) : a[k]])) : b === undefined ? a : b);

/**
 * A form document, checked and with its base merged in: `forms` is the registry ({ <culture>: form }); a `from` names
 * the culture whose form it starts from. Refused by name: an unknown field, a value out of range, an unknown base.
 */
export function readForm(doc, forms) {
  if (!isObj(doc)) throw new Error('form: a form is a document { site, water, armature, … } or { from: <culture>, …changes }');
  let f = doc;
  if (doc.from !== undefined) {
    const { from, ...rest } = doc;
    if (!forms[from]) throw new Error(`form: from '${from}' is not a culture with a form (${Object.keys(forms).join(', ')})`);
    f = merge(structuredClone(forms[from]), rest);
  }
  const e = check(FORM_SCHEMA, f, 'form');
  if (e) throw new Error(e);
  for (const k of ['frame', 'site', 'water', 'armature', 'enclosure', 'streets', 'density', 'houses']) if (f[k] === undefined) throw new Error(`form.${k} is missing`);
  return f;
}
