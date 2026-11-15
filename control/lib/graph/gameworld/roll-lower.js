/**
 * A WORLD'S ROLL, lowered into its levels — a world that says `roll` makes levels that play a different map each time:
 * each walking level a run lays on a trail takes a `roll` on its recipe (game/roll.js), over what the level already
 * holds. Nothing new is invented for it: the cover is the cover concern's own (lay-concerns.js coverBlocks, by the
 * trail's beats, walls and crates set to the sides of the way so no roll of them shuts it), and the items are the
 * level's own pickups.
 *
 *   roll: true | { cover?: boolean, items?: boolean }     true: both
 *     cover   the level's cover (laid for the roll when the level's concerns laid none) named and rolled: of its
 *             pieces, half of them or more stand, and never all
 *     items   the level's pickups named and rolled: of them, half or more lie, and never all
 *
 *   readWorldRoll(v)   → { cover, items } checked (teaching), or null for false / absent
 *   rollOfLevel(roll, { cover, mechanics, rule }) → { cover, mechanics, rule, roll } | null
 *     cover       the level's cover blocks (asks), or [] : given ids `cover-<n>` where they have none
 *     mechanics   the level's game mechanics: its collects' pickups given ids `item-<n>` where they have none
 *     rule        the pilot's rule: given a body (a collide radius) when it has none, since no cover stops a pilot
 *                 without one (a first-person walker's)
 *     roll        the level's `roll`, or null when there is nothing on the level to roll (then the rest is as given)
 *
 * A level's start is not rolled here: a trail has one way in. Levels that are not a trail walked on foot (a roadway,
 * an airspace, a runner's lanes, an arena, a building) are left as they are.
 *
 * Pure.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const BODY = Object.freeze({ collideRadius: 0.3, collideHeight: 1.7, step: 0.3 });

export function readWorldRoll(v) {
  if (v == null || v === false) return null;
  if (v === true) return { cover: true, items: true };
  if (!isObj(v)) throw new Error('gameworld: roll is true (its levels roll their cover and their items) or { cover?: true | false, items?: true | false }');
  for (const k of Object.keys(v)) if (k !== 'cover' && k !== 'items') throw new Error(`gameworld: roll has no '${k}' (cover, items)`);
  for (const k of ['cover', 'items']) if (v[k] !== undefined && typeof v[k] !== 'boolean') throw new Error(`gameworld: roll.${k} is true or false`);
  const out = { cover: v.cover !== false, items: v.items !== false };
  if (!out.cover && !out.items) throw new Error('gameworld: roll rolls nothing (cover and items both false): leave roll out');
  return out;
}

// of n things, half or more and never all (one thing: nothing to roll)
const band = (n) => (n >= 2 ? [Math.ceil(n / 2), n - 1] : null);

export function rollOfLevel(roll, { cover = [], mechanics = [], rule = null } = {}) {
  const R = readWorldRoll(roll);
  if (!R) return null;
  const out = {};
  let named = cover, mech = mechanics;
  const cb = R.cover ? band(cover.length) : null;
  if (cb) {
    named = cover.map((b, k) => (typeof b.id === 'string' && b.id ? b : { ...b, id: `cover-${k + 1}` }));
    out.cover = [{ of: named.map((b) => b.id), stand: cb }];
  }
  const count = mechanics.reduce((n, m) => n + (m && m.kind === 'collect' && Array.isArray(m.pickups) ? m.pickups.length : 0), 0), ib = R.items ? band(count) : null;
  if (ib) {
    let n = 0;
    const ids = [];
    mech = mechanics.map((m) => (m && m.kind === 'collect' && Array.isArray(m.pickups) ? { ...m, pickups: m.pickups.map((p) => { n++; const id = typeof p.id === 'string' && p.id ? p.id : `item-${n}`; ids.push(id); return { ...p, id }; }) } : m));
    out.items = [{ of: ids, lay: ib }];
  }
  if (!out.cover && !out.items) return { cover, mechanics, rule, roll: null };
  return { cover: named, mechanics: mech, rule: rule && !(rule.collideRadius > 0) ? { ...rule, ...BODY } : rule, roll: out };
}
