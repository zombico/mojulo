/**
 * THE GATES (docs/metroidvania-map.md "The gates"): what stands in a metroidvania's way until the hero holds what opens
 * it. Each is a row: what it is, what opens it (a POWER found in the box, a KEY found in its ring, a BOSS felled), and
 * its greybox signature, the shape it has in the map before any dress, so a gate reads as what it asks from across the
 * room. A new gate is a row.
 *
 *   form          a grate or a crawlway a third of the hero tall: passed in a small form (mist, a bat)
 *   double-jump   a sill a jump and a half up: reached on the second jump, never on the first
 *   wall-break    a cracked wall across a doorway: broken by the special strike
 *   key           a locked door: its key found in the same ring, before it
 *   boss          the boss room's way on, sealed until the boss falls
 *
 * The castle's hero never STOMPS and never KICKS OFF A WALL: no gate and no climb asks either (REFUSED_MOVES). Every rise
 * on the way is a single jump; a double-jump gate's is a double jump's, and more than a single jump's, so the gate is a
 * gate.
 *
 *   GATES, GATE_IDS, OPENERS, REFUSED_MOVES
 *   GREYBOX_HERO              the hero a greybox is laid for when its words name none: the side map's (its stature and
 *                             Galaxy Boy's measured jump, the double jump a share over it)
 *   gateSill(kind, hero)      → metres the gate's last rise is: a double jump's sill, else a single jump's ledge
 *   readHero(h)               → the hero's measures, read (stature, jump, double), or throws, teaching
 *
 * Pure.
 */
export const GATES = Object.freeze({
  form: Object.freeze({ read: 'a grate or a crawlway a third of the hero tall: passed in a small form', by: 'power', shape: 'grate', colour: '#9b7bff' }),
  'double-jump': Object.freeze({ read: 'a sill a jump and a half up: reached on the second jump', by: 'power', shape: 'sill', colour: '#3fc6e0', move: 'double-jump' }),
  'wall-break': Object.freeze({ read: 'a cracked wall across the way: broken by the special strike', by: 'power', shape: 'cracked', colour: '#f08a3c' }),
  key: Object.freeze({ read: 'a locked door: its key found in the same ring, before it', by: 'key', shape: 'lock', colour: '#e8c547' }),
  boss: Object.freeze({ read: 'the boss room\'s way on, sealed until the boss falls', by: 'boss', shape: 'seal', colour: '#e5484d' }),
});
export const GATE_IDS = Object.freeze(Object.keys(GATES));
/** what opens a gate: a power the hero carries, a key, a boss felled */
export const OPENERS = Object.freeze(['power', 'key', 'boss']);
export const REFUSED_MOVES = Object.freeze({
  stomp: 'no foe and no gate is beaten by landing on it: the castle is fought with the weapon',
  'wall-kick': 'no climb is a chimney: every rise is a ledge a jump apart, or a gate\'s ledge a double jump up',
});

/** The share of a single jump a laid ledge rises (a margin under the jump), a double-jump gate's sill, and the most a
 * double jump clears (the second jump pressed at the first's apex, a little under twice the first). */
export const LEDGE_SHARE = 0.75;
export const SILL_SHARE = 1.4;
export const DOUBLE_SHARE = 1.8;
/** a form gate's slit, as a share of the hero's stature: the small form passes, the body does not */
export const SLIT_SHARE = 1 / 3;

export const GREYBOX_HERO = Object.freeze({ stature: 1.67, jump: 2.24, double: Math.round(2.24 * DOUBLE_SHARE * 1000) / 1000 });

const r3 = (v) => Math.round(v * 1000) / 1000;
const pos = (v) => Number.isFinite(v) && v > 0;

/** The hero's measures, read: { stature, jump, double? } in metres (double, unsaid, the jump's DOUBLE_SHARE). */
export function readHero(h = {}) {
  if (!h || typeof h !== 'object' || Array.isArray(h)) throw new Error('metroidvania: hero is { stature, jump, double? } in metres');
  for (const k of Object.keys(h)) if (!['stature', 'jump', 'double'].includes(k)) throw new Error(`metroidvania: hero.${k} is not a measure (stature, jump, double)`);
  const stature = h.stature ?? GREYBOX_HERO.stature, jump = h.jump ?? GREYBOX_HERO.jump;
  if (!pos(stature)) throw new Error('metroidvania: hero.stature is metres, more than nothing');
  if (!pos(jump)) throw new Error('metroidvania: hero.jump is the metres a single jump rises');
  const double = h.double ?? r3(jump * DOUBLE_SHARE);
  if (!(pos(double) && double > jump * SILL_SHARE)) throw new Error(`metroidvania: hero.double is the metres a double jump rises, over ${SILL_SHARE} jumps (a double-jump gate's sill)`);
  return { stature, jump, double };
}

/** The metres a gate's last rise is: a double-jump gate's sill (over a single jump, under a double), else a ledge. */
export const gateSill = (kind, hero) => r3(kind === 'double-jump' ? SILL_SHARE * hero.jump : LEDGE_SHARE * hero.jump);
