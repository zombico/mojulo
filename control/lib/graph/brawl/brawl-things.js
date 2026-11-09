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
 *     cover    COVER (the run & gun's, any street's): sandbags, a stack of crates, a low wall (`w` along, `d` across, `h`
 *              in m, `hp`): a round meeting it is stopped (unless its shooter stands right behind it: a body fires over
 *              its own cover), each round wearing it down; blows and bursts break it too; no body walks through it;
 *              `sound` the shelf's voice a round makes on it
 *
 *   MOUNTS, MOUNT_IDS          what a foe rides in on (a motorcycle, a scooter): its speed, its steering, its ram, its wreck
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
  cover: Object.freeze({
    sandbags: row({ hp: 320, w: 1.4, d: 0.7, h: 0.9, sound: 'dirt-impact', says: 'sandbags: low and long, they soak a stream' }),
    crates: row({ hp: 180, w: 1.0, d: 1.0, h: 1.3, sound: 'wood-impact', says: 'a stack of crates: tall, splintered by a stream' }),
    wall: row({ hp: 600, w: 2.2, d: 0.4, h: 1.1, sound: 'stone-impact', says: 'a low wall: long, it takes a rocket to bring down' }),
    // (a mount's wreck, or one parked: left on the street where its rider came off it)
    motorcycle: row({ hp: 160, w: 1.9, d: 0.6, h: 0.8, sound: 'metal-impact', says: 'a motorcycle on its side: low cover, metal' }),
    scooter: row({ hp: 110, w: 1.5, d: 0.6, h: 0.7, sound: 'metal-impact', says: 'a scooter on its side: a little cover' }),
  }),
});

/**
 * THE MOUNTS a foe comes in riding (brawl-core.js `ride`): its speed along the street (mm a frame), how fast it steers
 * across it onto its target's line, the damage and knockdown of running a body over, its length (the ram's reach), the
 * seat's height (where the rider sits, drawn), and the cover it leaves (`wreck`, a THINGS.cover row) when its rider
 * comes off it or steps off it.
 */
export const MOUNTS = Object.freeze({
  motorcycle: row({ speed: 150, steer: 28, ram: 70, len: 1900, seat: 800, wreck: 'motorcycle', says: 'a motorcycle: fast, it runs you down; knocked off, its rider goes flying' }),
  scooter: row({ speed: 105, steer: 36, ram: 40, len: 1500, seat: 720, wreck: 'scooter', says: 'a scooter: slower, nimbler, a lighter knock' }),
});
export const MOUNT_IDS = Object.freeze(Object.keys(MOUNTS));
export const THING_KINDS = Object.freeze(Object.keys(THINGS));
export const BRAWL_WEAPONS = Object.freeze(Object.keys(THINGS.weapon));

function readOne(t, at, inBox = false) {
  if (!t || typeof t !== 'object') throw new Error(`brawl: ${at} is { kind, what, at, n?, holds? }`);
  if (!THINGS[t.kind]) throw new Error(`brawl: ${at}.kind is one of ${THING_KINDS.join(', ')}`);
  if (!THINGS[t.kind][t.what]) throw new Error(`brawl: ${at}.what is one of ${Object.keys(THINGS[t.kind]).join(', ')} (a ${t.kind})`);
  if (inBox && (t.kind === 'box' || t.kind === 'cover')) throw new Error(`brawl: ${at}: a box holds food, a power-up or a weapon, not another box`);
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
    return { id: i, ...one, x: Math.round(t.at * 1000), z: Math.round(n * 1000), ...(one.kind === 'box' || one.kind === 'cover' ? { hp: THINGS[one.kind][one.what].hp } : {}) };
  });
}
