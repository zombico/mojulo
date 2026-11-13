/**
 * A LEVEL'S ROLL, read — what its seed picks on it (the runtime: worlds/controllable/roll.js). A level with a roll is a
 * case that plays a different map each time: the recipe never changes, the seed the game's shell sends picks.
 *
 *   roll: {
 *     cover: [{ of: ['<block id>', …], stand: n | [min, max] }, …],
 *   }
 *     cover   groups of the level's `blocks` (playscape/terrain.js: a wall, a pillar, a crate, a slab), each named by
 *             its ask's `id`. Of a group, the seed stands `stand` of them (a number, or any number in a band) and the
 *             rest are not there: gone whole, as if never built. A block in no group always stands.
 *
 * Refused (malformed), teaching: a key that is not a roll's, a group with no blocks, an id no block of the level has, a
 * block in two groups, a `stand` outside its group.
 *
 *   ROLL_KEYS
 *   readRoll(roll, { blocks })   → { cover: [{ of: [id], stand: [min, max] }] }   checked, in the runtime's shape
 *   rolledIds(read)              → Set of every block id a roll may take
 *   rollWays(read)               → how many different rolls there are (the groups' ways multiplied)
 *
 * Pure.
 */
export const ROLL_KEYS = Object.freeze(['cover']);

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const whole = (n) => Number.isInteger(n) && n >= 0;

export function readRoll(roll, { blocks = [] } = {}) {
  if (!isObj(roll)) throw new Error('roll: what the level\'s seed picks, { cover: [{ of: [\'<block id>\', …], stand: n | [min, max] }] }');
  for (const k of Object.keys(roll)) if (!ROLL_KEYS.includes(k)) throw new Error(`roll: no '${k}' (a roll has: ${ROLL_KEYS.join(', ')})`);
  if (!Array.isArray(roll.cover) || !roll.cover.length) throw new Error('roll: cover is a list of groups, each { of: [\'<block id>\', …], stand: n | [min, max] }');
  const named = new Map();
  (Array.isArray(blocks) ? blocks : []).forEach((b) => { if (b && typeof b.id === 'string' && b.id) named.set(b.id, (named.get(b.id) || 0) + 1); });
  const taken = new Set(), cover = [];
  roll.cover.forEach((g, i) => {
    const at = `roll.cover[${i}]`;
    if (!isObj(g)) throw new Error(`${at}: a group is { of: ['<block id>', …], stand: n | [min, max] }`);
    for (const k of Object.keys(g)) if (k !== 'of' && k !== 'stand') throw new Error(`${at}: no '${k}' (a group has: of, stand)`);
    if (!Array.isArray(g.of) || !g.of.length || g.of.some((id) => typeof id !== 'string' || !id)) throw new Error(`${at}: of is the group's blocks by id, at least one`);
    for (const id of g.of) {
      if (!named.has(id)) throw new Error(`${at}: no block '${id}' in the level's blocks (give the block an id: { id: '${id}', form, at, … }; the level has: ${[...named.keys()].join(', ') || 'none with an id'})`);
      if (named.get(id) > 1) throw new Error(`${at}: two blocks are called '${id}': a rolled block's id is its own`);
      if (taken.has(id)) throw new Error(`${at}: '${id}' is in two groups (a block is rolled once)`);
      taken.add(id);
    }
    const band = Array.isArray(g.stand) ? g.stand : [g.stand, g.stand];
    if (band.length !== 2 || !whole(band[0]) || !whole(band[1]) || band[0] > band[1] || band[1] > g.of.length) throw new Error(`${at}: stand is how many of its ${g.of.length} stand, a number or [min, max] from 0 to ${g.of.length}`);
    cover.push({ of: g.of.slice(), stand: [band[0], band[1]] });
  });
  return { cover };
}

export const rolledIds = (read) => new Set(((read && read.cover) || []).flatMap((g) => g.of));

const choose = (n, k) => { let c = 1; for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i; return Math.round(c); };
export function rollWays(read) {
  let ways = 1;
  for (const g of (read && read.cover) || []) { let w = 0; for (let n = g.stand[0]; n <= g.stand[1]; n++) w += choose(g.of.length, n); ways *= w; }
  return ways;
}
