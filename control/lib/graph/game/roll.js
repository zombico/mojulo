/**
 * A LEVEL'S ROLL, read — what its seed picks on it (the runtime: worlds/controllable/roll.js). A level with a roll is a
 * case that plays a different map each time: the recipe never changes, the seed the game's shell sends picks.
 *
 *   roll: {
 *     cover?: [{ of: ['<block id>', …], stand: n | [min, max] }, …],
 *     items?: [{ of: ['<pickup id>', …], lay: n | [min, max] }, …],
 *     start?: [{ pos: [x, y, z], heading? }, …],
 *   }
 *     cover   groups of the level's `blocks` (playscape/terrain.js: a wall, a pillar, a crate, a slab), each named by
 *             its ask's `id`. Of a group, the seed stands `stand` of them (a number, or any number in a band) and the
 *             rest are not there: gone whole, as if never built. A block in no group always stands.
 *     items   groups of the level's pickups (its `collect` mechanic's `pickups`), each named by its `id`. Of a group,
 *             the seed lays `lay` of them and the rest are not there to be found. A pickup in no group always lies.
 *     start   the places the pilot may set out from, each written as the pilot's own `transform` is (`pos` its eye
 *             for a walker, `heading` in radians, the pilot's own when unsaid): the seed picks one. A fall's respawn
 *             and a level's doors are not moved: they stay where the level wrote them.
 *
 * Refused (malformed), teaching: a roll that picks nothing, a key that is not a roll's, a group with nothing in it, an
 * id the level has no block or pickup by, one in two groups, a count outside its group, a start that is no place.
 *
 *   ROLL_KEYS
 *   readRoll(roll, { blocks, pickups })   → { cover?, items?, start? }   checked, in the runtime's shape (a band for
 *                                           every count; an item by its zone on the bus)
 *     pickups   [{ id, zone }]: the level's pickups that have an id, and the bus zone each lowers to (pickupsOf)
 *   pickupsOf(mechanics)         → [{ id, zone, at }]   a level's pickups with an id (game.mechanics' collects)
 *   rolledIds(read)              → Set of every block id a roll may take
 *   rollWays(read)               → how many different rolls there are (every group's ways and the starts multiplied)
 *
 * Pure.
 */
export const ROLL_KEYS = Object.freeze(['cover', 'items', 'start']);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const whole = (n) => Number.isInteger(n) && n >= 0;
const SHAPE = "{ cover?: [{ of: ['<block id>', …], stand }], items?: [{ of: ['<pickup id>', …], lay }], start?: [{ pos, heading? }] }";

/** A level's pickups that have an id, each with the zone it lowers to on the bus (game/mechanics.js collect: pk_<i>_<j>). */
export function pickupsOf(mechanics) {
  const out = [];
  (Array.isArray(mechanics) ? mechanics : []).forEach((m, i) => {
    if (!m || m.kind !== 'collect' || !Array.isArray(m.pickups)) return;
    m.pickups.forEach((pk, j) => { if (pk && typeof pk.id === 'string' && pk.id) out.push({ id: pk.id, zone: `pk_${i}_${j}`, at: pk.at || [0, 0, 0] }); });
  });
  return out;
}

// groups of named things, each with a count or a band: the cover's blocks (`stand`), the items' pickups (`lay`)
function readGroups(list, key, word, named, what, hint) {
  if (!Array.isArray(list) || !list.length) throw new Error(`roll: ${key} is a list of groups, each { of: ['<${what} id>', …], ${word}: n | [min, max] }`);
  const count = new Map();
  for (const id of named) count.set(id, (count.get(id) || 0) + 1);
  const taken = new Set();
  return list.map((g, i) => {
    const at = `roll.${key}[${i}]`;
    if (!isObj(g)) throw new Error(`${at}: a group is { of: ['<${what} id>', …], ${word}: n | [min, max] }`);
    for (const k of Object.keys(g)) if (k !== 'of' && k !== word) throw new Error(`${at}: no '${k}' (a group has: of, ${word})`);
    if (!Array.isArray(g.of) || !g.of.length || g.of.some((id) => typeof id !== 'string' || !id)) throw new Error(`${at}: of is the group's ${what}s by id, at least one`);
    for (const id of g.of) {
      if (!count.has(id)) throw new Error(`${at}: no ${what} '${id}' in the level (${hint(id)}; the level has: ${[...count.keys()].join(', ') || 'none with an id'})`);
      if (count.get(id) > 1) throw new Error(`${at}: two ${what}s are called '${id}': a rolled ${what}'s id is its own`);
      if (taken.has(id)) throw new Error(`${at}: '${id}' is in two groups (a ${what} is rolled once)`);
      taken.add(id);
    }
    const band = Array.isArray(g[word]) ? g[word] : [g[word], g[word]];
    if (band.length !== 2 || !whole(band[0]) || !whole(band[1]) || band[0] > band[1] || band[1] > g.of.length) throw new Error(`${at}: ${word} is how many of its ${g.of.length}, a number or [min, max] from 0 to ${g.of.length}`);
    return { of: g.of.slice(), band: [band[0], band[1]] };
  });
}

export function readRoll(roll, { blocks = [], pickups = [] } = {}) {
  if (!isObj(roll)) throw new Error(`roll: what the level's seed picks, ${SHAPE}`);
  for (const k of Object.keys(roll)) if (!ROLL_KEYS.includes(k)) throw new Error(`roll: no '${k}' (a roll has: ${ROLL_KEYS.join(', ')})`);
  if (!ROLL_KEYS.some((k) => roll[k] !== undefined)) throw new Error(`roll: it picks nothing; say what the seed picks, ${SHAPE}`);
  const out = {};
  if (roll.cover !== undefined) {
    const ids = (Array.isArray(blocks) ? blocks : []).filter((b) => b && typeof b.id === 'string' && b.id).map((b) => b.id);
    out.cover = readGroups(roll.cover, 'cover', 'stand', ids, 'block', (id) => `give the block an id: { id: '${id}', form, at, … }`).map((g) => ({ of: g.of, stand: g.band }));
  }
  if (roll.items !== undefined) {
    const P = Array.isArray(pickups) ? pickups : [], zone = new Map(P.map((p) => [p.id, p.zone]));
    out.items = readGroups(roll.items, 'items', 'lay', P.map((p) => p.id), 'pickup', (id) => `give the pickup an id in the level's collect: { id: '${id}', item, at }`).map((g) => ({ of: g.of.map((id) => zone.get(id)), lay: g.band }));
  }
  if (roll.start !== undefined) {
    if (!Array.isArray(roll.start) || !roll.start.length) throw new Error('roll: start is the places the pilot may set out from, each { pos: [x, y, z], heading? }');
    out.start = roll.start.map((s, i) => {
      const at = `roll.start[${i}]`;
      if (!isObj(s) || !Array.isArray(s.pos) || s.pos.length !== 3 || !s.pos.every(Number.isFinite)) throw new Error(`${at}: a place is { pos: [x, y, z], heading? }, written as the pilot's own transform is`);
      for (const k of Object.keys(s)) if (k !== 'pos' && k !== 'heading') throw new Error(`${at}: no '${k}' (a place has: pos, heading)`);
      if (s.heading !== undefined && !Number.isFinite(s.heading)) throw new Error(`${at}: heading is in radians, a number`);
      return { pos: s.pos.slice(), ...(s.heading !== undefined ? { heading: s.heading } : {}) };
    });
  }
  return out;
}

export const rolledIds = (read) => new Set(((read && read.cover) || []).flatMap((g) => g.of));

const choose = (n, k) => { let c = 1; for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i; return Math.round(c); };
export function rollWays(read) {
  let ways = 1;
  const groups = [...((read && read.cover) || []).map((g) => [g.of.length, g.stand]), ...((read && read.items) || []).map((g) => [g.of.length, g.lay])];
  for (const [len, band] of groups) { let w = 0; for (let n = band[0]; n <= band[1]; n++) w += choose(len, n); ways *= w; }
  if (read && read.start && read.start.length) ways *= read.start.length;
  return ways;
}
