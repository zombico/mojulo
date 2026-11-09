/**
 * brawl guns — the run & gun's shelf: a gun as its ROUND's flight, never a hitscan. A round leaves the muzzle at its
 * speed, crosses the street you can see it on and lands only on a body within its line across the belt (the brawler's
 * first lesson turned into the dodge: step off its line); the FPS's instant bullet (gameworld/feel's realistic RANGED)
 * is not this game's. Speeds are mm a frame at 60 a second: a player's stream fast (12 to 18 m/s), a foe's round slow
 * enough to see and step off (5 to 7 m/s).
 *
 *   GUNS[id] = { says, speed, rate, pellets, spread, jitter, damage, stun, life, pierce, size, line, knock, area, lob,
 *                vy, g, ammo, telegraph }
 *     speed     mm a frame along its aim                 rate      frames between two shots (held, it fires on)
 *     pellets   rounds a shot (a fan)                    spread    degrees between a fan's rounds
 *     jitter    degrees a stream wanders (a cycle of the shot count: deterministic)
 *     damage    a round's                                stun      frames a round staggers a standing body
 *     life      frames a round flies                     pierce    bodies a round passes through before it is spent
 *     size      mm, the round's box                      line      mm across the belt it lands within
 *     knock     'none' | 'down' (a rocket, a grenade)    area      mm, its burst's reach where it lands (0: none)
 *     lob       thrown in an arc (vy up, g down) and bursting where it lands
 *     ammo      rounds a pick-up holds (null: the sidearm's, never out)
 *     telegraph frames a foe aims before it fires (its round's warning)
 *   GUN_IDS
 *   readGun(spec, where?) → a gun: a row's name, or dials (`{ from?: <row>, …its keys }`) passed into a practice room to
 *                           be demoed (throws naming the key)
 *   AIMS                  the eight ways a gun aims on the belt's floor plane ([along, across], each -1 | 0 | 1)
 *   aimVector(aim, face)  → [along, across] a unit's thousandths: along the belt, and across it at ACROSS of the along
 *                           (the across ways shallow, so a round's depth reads under the side camera)
 *   roundsOf(gun, aim, face, n) → each round's velocity [vx, vz] (mm a frame) for a shot, its fan and its jitter
 *
 * Pure: no clock, no dice.
 */

const row = (says, o) => Object.freeze({ says, speed: 200, rate: 12, pellets: 1, spread: 0, jitter: 0, damage: 10, stun: 8, life: 50, pierce: 1, size: 80, line: 300, knock: 'none', area: 0, lob: false, vy: 0, g: 0, ammo: null, telegraph: 0, ...o });
export const GUNS = Object.freeze({
  // the players'
  sidearm: row('the sidearm, never out: a quick round, a steady rate', { speed: 220, rate: 11, damage: 12, stun: 8, life: 50 }),
  'machine-gun': row('a stream: fast rounds close together, wandering a little; it chews through a wave', { speed: 300, rate: 5, jitter: 3, damage: 9, stun: 6, life: 45, ammo: 200 }),
  spread: row('a fan of five: a wave in front of you, a body close takes them all', { speed: 240, rate: 16, pellets: 5, spread: 11, damage: 10, stun: 8, life: 38, ammo: 60 }),
  flame: row('a short wide gout, slow, through whoever stands in it', { speed: 120, rate: 3, jitter: 6, damage: 4, stun: 4, life: 16, pierce: 4, size: 260, line: 420, ammo: 300 }),
  rocket: row('a slow rocket that bursts where it lands, floors what is round it', { speed: 150, rate: 40, damage: 70, stun: 20, life: 90, size: 140, knock: 'down', area: 1300, ammo: 12 }),
  grenade: row('lobbed in an arc over the crowd, it bursts where it lands (about three metres on)', { speed: 55, rate: 30, damage: 80, stun: 20, life: 120, size: 140, knock: 'down', area: 1500, lob: true, vy: 95, g: 5, ammo: 6 }),
  // the foes': slow enough to see and step off, a warning before each
  rifle: row('a foe\'s rifle: a beat of aim, then one slow round', { speed: 110, rate: 60, damage: 40, stun: 16, life: 110, telegraph: 30 }),
  burst: row('a foe\'s burst: a beat of aim, then three rounds close together', { speed: 120, rate: 6, damage: 22, stun: 10, life: 100, telegraph: 26 }),
  bazooka: row('a foe\'s rocket: a long aim, then a slow rocket that bursts', { speed: 90, rate: 90, damage: 70, stun: 20, life: 140, size: 160, knock: 'down', area: 1200, telegraph: 45 }),
  lob: row('a foe\'s grenade: lobbed at where the player stands', { speed: 60, rate: 80, damage: 60, stun: 18, life: 140, size: 140, knock: 'down', area: 1300, lob: true, vy: 90, g: 5, telegraph: 30 }),
});
export const GUN_IDS = Object.freeze(Object.keys(GUNS));

// each dial's range (a passed-in gun is held to them)
const DIALS = Object.freeze({
  speed: [10, 800], rate: [1, 240], pellets: [1, 12], spread: [0, 45], jitter: [0, 20], damage: [0, 999], stun: [0, 60],
  life: [2, 600], pierce: [1, 20], size: [10, 800], line: [50, 1500], area: [0, 4000], vy: [0, 300], g: [0, 40], telegraph: [0, 120],
});
const KNOCKS = ['none', 'down'];

/** A gun: a row by name, or dials over one (`from`) passed into a practice room to be tried. */
export function readGun(spec, where = 'gun') {
  if (typeof spec === 'string') {
    if (!GUNS[spec]) throw new Error(`brawl: ${where} is one of ${GUN_IDS.join(', ')} (or its dials)`);
    return { id: spec, ...GUNS[spec] };
  }
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error(`brawl: ${where} is a gun's name or its dials ({ from?, speed?, rate?, … })`);
  const { from, id, name, ...dials } = spec;
  if (from !== undefined && !GUNS[from]) throw new Error(`brawl: ${where}.from is one of ${GUN_IDS.join(', ')}`);
  for (const [k, v] of Object.entries(dials)) {
    if (k === 'knock') { if (!KNOCKS.includes(v)) throw new Error(`brawl: ${where}.knock is ${KNOCKS.join(' | ')}`); continue; }
    if (k === 'lob') { if (typeof v !== 'boolean') throw new Error(`brawl: ${where}.lob is true or false`); continue; }
    if (k === 'ammo') { if (v !== null && !(Number.isInteger(v) && v >= 1 && v <= 9999)) throw new Error(`brawl: ${where}.ammo is a whole number from 1 to 9999, or null (never out)`); continue; }
    if (k === 'says') { if (typeof v !== 'string') throw new Error(`brawl: ${where}.says is words`); continue; }
    const r = DIALS[k];
    if (!r) throw new Error(`brawl: ${where} has no '${k}' (${[...Object.keys(DIALS), 'knock', 'lob', 'ammo', 'says'].join(', ')})`);
    if (!(Number.isInteger(v) && v >= r[0] && v <= r[1])) throw new Error(`brawl: ${where}.${k} is a whole number from ${r[0]} to ${r[1]}`);
  }
  const base = from ? GUNS[from] : row('a gun of its own', {});
  if (id !== undefined && !(typeof id === 'string' && /^[a-z0-9-]{1,32}$/.test(id))) throw new Error(`brawl: ${where}.id is a short lower-case name`);
  return { ...base, ...dials, id: id ?? (from ? `${from}-tuned` : 'gun'), ...(name ? { name } : {}) };
}

/** the eight ways on the floor plane: along the belt, across it, and the four between */
export const AIMS = Object.freeze([[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]].map((a) => Object.freeze(a)));
/** across the street's share of the along in a diagonal (a shallow slant: its depth reads under the side camera) */
export const ACROSS = 0.5;

/** An aim ([along, across], each -1 | 0 | 1; none: the way the body faces) as a direction in thousandths. */
export function aimVector(aim, face) {
  const ax = aim && (aim[0] || aim[1]) ? aim[0] : face, az = aim ? aim[1] : 0;
  const x = ax, z = ax ? az * ACROSS : az;
  const n = Math.hypot(x, z) || 1;
  return [Math.round((x / n) * 1000), Math.round((z / n) * 1000)];
}

/** Each round's velocity for a shot (its fan about the aim, its stream's wander by the shot's count `n`). */
export function roundsOf(gun, aim, face, n = 0) {
  const [x, z] = aimVector(aim, face);
  const a0 = Math.atan2(z, x);
  // (the stream wanders on a fixed cycle of its shots: up, middle, down, middle)
  const wander = gun.jitter ? [0, 1, 0, -1][n % 4] * gun.jitter : 0;
  return Array.from({ length: gun.pellets }, (_, k) => {
    const a = a0 + (((k - (gun.pellets - 1) / 2) * gun.spread + wander) * Math.PI) / 180;
    return [Math.round(Math.cos(a) * gun.speed), Math.round(Math.sin(a) * gun.speed)];
  });
}
