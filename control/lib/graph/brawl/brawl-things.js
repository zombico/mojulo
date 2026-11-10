/**
 * brawl things — what lies on the street: food, power-ups, weapons, and the breakables that hold them. Rows, not code;
 * the brawl's core (brawl-core.js) plays them.
 *
 *   THINGS[kind][what]
 *     food     health back (`hp`), up to the body's own; eaten where it lies
 *     power    a timed state (versus-library.js STATES, the fight's own shelf): held its while
 *     weapon   one of the fight's WEAPONS a brawler can pick up (`throw`: the damage it deals flung): held, its chain
 *              swings it (the body's armed fighter, versus-compile.js's blade rules); special throws it; a body knocked
 *              down drops it
 *     box      a breakable (`hp` the blows it takes, `w` and `h` its size in m): broken, it leaves what it `holds`
 *
 *   readThings(things, belt)   → the street's things as the core holds them (mm, along and across the belt), each
 *                                { id, kind, what, x, z, hp?, holds? } (throws naming the fault)
 *
 * A level names them in the belt's metres: `{ kind, what, at, n?, holds? }` (at along, n across; holds a box's thing).
 * Pure: no clock, no dice.
 */
import { STATES, WEAPONS } from '../versus/versus-library.js';

const row = (o) => Object.freeze(o);
export const THINGS = Object.freeze({
  food: Object.freeze({
    apple: row({ hp: 80, says: 'an apple: a little back' }),
    chicken: row({ hp: 250, says: 'a roast chicken: a quarter back' }),
    meat: row({ hp: 500, says: 'a joint of meat: half back' }),
  }),
  power: Object.freeze(Object.fromEntries(Object.keys(STATES).map((id) => [id, row({ state: id, says: STATES[id].says })]))),
  weapon: Object.freeze({
    pipe: row({ throw: 90, says: WEAPONS.pipe.says }),
    knife: row({ throw: 110, says: WEAPONS.knife.says }),
    katana: row({ throw: 100, says: WEAPONS.katana.says }),
  }),
  box: Object.freeze({
    barrel: row({ hp: 40, w: 0.7, h: 1.0, says: 'a barrel: a blow or two' }),
    crate: row({ hp: 70, w: 0.9, h: 0.9, says: 'a crate: a few blows' }),
    booth: row({ hp: 160, w: 1.1, h: 2.3, says: 'a phone booth: a chain to break' }),
  }),
});
export const THING_KINDS = Object.freeze(Object.keys(THINGS));
export const BRAWL_WEAPONS = Object.freeze(Object.keys(THINGS.weapon));

function readOne(t, at, inBox = false) {
  if (!t || typeof t !== 'object') throw new Error(`brawl: ${at} is { kind, what, at, n?, holds? }`);
  if (!THINGS[t.kind]) throw new Error(`brawl: ${at}.kind is one of ${THING_KINDS.join(', ')}`);
  if (!THINGS[t.kind][t.what]) throw new Error(`brawl: ${at}.what is one of ${Object.keys(THINGS[t.kind]).join(', ')} (a ${t.kind})`);
  if (inBox && t.kind === 'box') throw new Error(`brawl: ${at}: a box holds food, a power-up or a weapon, not another box`);
  if (t.holds !== undefined && t.kind !== 'box') throw new Error(`brawl: ${at}.holds: only a box holds a thing`);
  return { kind: t.kind, what: t.what, ...(t.holds ? { holds: readOne(t.holds, `${at}.holds`, true) } : {}) };
}

/** The street's things in the core's terms. */
export function readThings(things, belt) {
  if (!Array.isArray(things)) throw new Error('brawl: things is a list of { kind, what, at, n?, holds? }');
  const [n0, n1] = belt.depth;
  return things.map((t, i) => {
    const at = `things[${i}]`, one = readOne(t, at);
    if (!(typeof t.at === 'number' && t.at >= 0 && t.at <= belt.length)) throw new Error(`brawl: ${at}.at is metres along the belt, 0 to ${belt.length}`);
    const n = t.n ?? (n0 + n1) / 2;
    if (!(typeof n === 'number' && n >= n0 && n <= n1)) throw new Error(`brawl: ${at}.n is metres across the belt, in its band (${n0} to ${n1})`);
    return { id: i, ...one, x: Math.round(t.at * 1000), z: Math.round(n * 1000), ...(one.kind === 'box' ? { hp: THINGS.box[one.what].hp } : {}) };
  });
}
